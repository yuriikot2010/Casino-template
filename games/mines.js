

const crypto = require('crypto'); 
const { processBet, processWin } = require('../shared-db');

// CONFIGURATION
const HOUSE_EDGE = 0.94; // 6% House Edge
const MAX_PAYOUT_CAP = 630000; // Cap raised (in cents)
const MAX_BET = 5000; 
const FORCED_LOSS_CHANCE = 0.05; 

class MinesEngine {
    constructor() {
        this.games = new Map(); 
    }


    generateMines(count) {

        const deck = Array.from({ length: 25 }, (_, i) => i);
        

        for (let i = deck.length - 1; i > 0; i--) {
            const j = crypto.randomInt(0, i + 1);
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        

        return new Set(deck.slice(0, count));
    }

    createGame(userId, bet, minesCount) {
        if (this.games.has(userId)) this.games.delete(userId);
        if (minesCount < 1 || minesCount > 24) return { error: 'Mines must be between 1 and 24' };
        if (bet <= 0) return { error: 'Invalid bet' };
        if (bet > MAX_BET) return { error: `Max bet is ${MAX_BET/100}$` };

        try {
            const stats = processBet(userId, bet);

            // Use the new shuffle method
            const mines = this.generateMines(minesCount);

            const gameState = {
                userId,
                bet,
                minesCount,
                mines, 
                revealed: new Set(), 
                profit: 0
            };

            this.games.set(userId, gameState);
            return { type: 'start', balance: stats.balance };

        } catch (e) {
            return { error: 'Insufficient funds' };
        }
    }

    restoreGame(userId) {
        const game = this.games.get(userId);
        if (!game) return { type: 'restore', active: false };

        const totalTiles = 25;
        const safeTiles = totalTiles - game.minesCount;
        const revealedCount = game.revealed.size;

        let fairMultiplier = 1.0;
        for (let i = 0; i < revealedCount; i++) {
            fairMultiplier *= ((totalTiles - i) / (safeTiles - i));
        }
        
        const potentialMultiplier = fairMultiplier * HOUSE_EDGE;
        const potentialTotalPayout = Math.floor(game.bet * potentialMultiplier);
        const currentNetProfit = revealedCount === 0 ? 0 : potentialTotalPayout - game.bet;

        return {
            type: 'restore',
            active: true,
            bet: game.bet,
            minesCount: game.minesCount,
            revealed: Array.from(game.revealed),
            profit: currentNetProfit
        };
    }

    clickTile(userId, tileIndex) {
        const game = this.games.get(userId);
        if (!game) return { error: 'No active game' };
        
        if (tileIndex < 0 || tileIndex > 24) return { error: 'Invalid tile' };
        if (game.revealed.has(tileIndex)) return { error: 'Tile already revealed' };

        const totalTiles = 25;
        const safeTiles = totalTiles - game.minesCount;
        const revealedCount = game.revealed.size + 1;

        let fairMultiplier = 1.0;
        for (let i = 0; i < revealedCount; i++) {
            fairMultiplier *= ((totalTiles - i) / (safeTiles - i));
        }
        
        const potentialMultiplier = fairMultiplier * HOUSE_EDGE;
        const potentialTotalPayout = Math.floor(game.bet * potentialMultiplier);
        const potentialNetProfit = potentialTotalPayout - game.bet;


        let forceLoss = false;

        if (potentialNetProfit > MAX_PAYOUT_CAP) forceLoss = true;

        if (!game.mines.has(tileIndex) && !forceLoss) {
            if (Math.random() < FORCED_LOSS_CHANCE) forceLoss = true;
        }

        if (forceLoss && !game.mines.has(tileIndex)) {

            const currentMines = Array.from(game.mines);
            const randomMineIndex = crypto.randomInt(0, currentMines.length);
            const mineToRemove = currentMines[randomMineIndex];

            game.mines.delete(mineToRemove);
            game.mines.add(tileIndex);
        }

        if (game.mines.has(tileIndex)) {
            this.games.delete(userId);
            return { 
                type: 'gameover', 
                win: false, 
                mines: Array.from(game.mines), 
                profit: 0 
            };
        } else {
            game.revealed.add(tileIndex);
            game.profit = potentialTotalPayout;

            if (revealedCount === safeTiles) {
                return this.cashout(userId);
            }

            return { 
                type: 'reveal', 
                index: tileIndex, 
                isGem: true,
                profit: potentialNetProfit 
            };
        }
    }

    cashout(userId) {
        const game = this.games.get(userId);
        if (!game) return { error: 'No active game' };
        if (game.revealed.size === 0) return { error: 'Reveal a tile first' };

        const totalPayout = game.profit || game.bet;
        const netProfit = totalPayout - game.bet;
        const allMines = Array.from(game.mines); 
        
        this.games.delete(userId);

        const stats = processWin(userId, totalPayout);

        return { 
            type: 'gameover', 
            win: true, 
            profit: Math.floor(netProfit), 
            balance: stats.balance,
            mines: allMines
        };
    }
}

module.exports = new MinesEngine();