

const crypto = require('crypto');
const { rocketDB, processBet, processWin } = require('../shared-db');

// CONFIGURATION
// 0.99 = 1% House Edge (Standard). 
// If you want more profit, use 0.96 (4%). Don't go below 0.90.
const HOUSE_EDGE_PERCENT = 0.99; 
const INSTANT_CRASH_CHANCE = 0.03; // Reduced to 3% chance of 1.00x
const MAX_CASINO_LOSS = 200000; 

class RocketEngine {
    constructor(io) {
        this.io = io;
        this.gameState = 'waiting';
        this.multiplier = 1.00;
        this.gameId = 0;
        this.startTime = 0;
        
        this.bets = new Map();           
        this.nextRoundBets = new Map();  
        
        this.loop();
    }

    loop() {
        this.gameId = Date.now();
        

        this.bets = new Map(this.nextRoundBets);
        this.nextRoundBets.clear();
        
        this.multiplier = 1.00;
        this.gameState = 'waiting';
        
        try { 
            rocketDB.createGame(this.gameId);
            this.bets.forEach(bet => {
                rocketDB.placeBet(this.gameId, bet.userId, bet.bet);
            });
        } catch(e) {}
        
        this.broadcastState();

        // 5 seconds waiting time
        setTimeout(() => {
            this.gameState = 'starting';
            this.runCountdown();
        }, 5000);
    }

    runCountdown() {
        let timeLeft = 5;
        const interval = setInterval(() => {
            timeLeft--;
            this.io.emit('rocketState', { 
                status: 'starting', 
                timeLeft, 
                bets: Array.from(this.bets.values()) 
            });
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                this.startGame();
            }
        }, 1000);
    }

    generateCrashPoint(hasBets) {
        const buffer = crypto.randomBytes(4);
        const randomFloat = buffer.readUInt32LE(0) / 0xFFFFFFFF;


        if (randomFloat < INSTANT_CRASH_CHANCE) return 1.00;



        let rawCrash = HOUSE_EDGE_PERCENT / (1 - randomFloat);


        if (hasBets) rawCrash = rawCrash * 0.99; 


        if (rawCrash > 20000) rawCrash = 20000;


        let crash = Math.floor(rawCrash * 100) / 100;


        if (crash < 1.00) crash = 1.00;

        return crash;
    }

    startGame() {
        this.gameState = 'running';
        this.startTime = Date.now();

        let totalBetPool = 0;
        this.bets.forEach(b => totalBetPool += b.bet);
        const hasBets = totalBetPool > 0;

        let targetCrash = this.generateCrashPoint(hasBets);


        // If the calculated crash point would bankrupt the casino, cap it.
        if (hasBets) {
            // Example: Pool 100, MaxLoss 200,000. Cap = 2001x.
            const safetyCap = (MAX_CASINO_LOSS + totalBetPool) / totalBetPool;
            if (targetCrash > safetyCap) {
                console.log(`⚠️ Safety Cap Hit: Target ${targetCrash}x reduced to ${safetyCap.toFixed(2)}x`);
                targetCrash = Math.floor(safetyCap * 100) / 100;
            }
        }

        if (targetCrash < 1.00) targetCrash = 1.00;

        console.log(`🚀 Launch: ${this.gameId} | Pool: ${totalBetPool} | Target: ${targetCrash}x`);

        const interval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            // Standard exponential growth curve
            this.multiplier = Math.pow(Math.E, 0.00006 * elapsed);

            if (this.multiplier >= targetCrash) {
                clearInterval(interval);
                this.crash(targetCrash);
            } else {
                this.broadcastState();
            }
        }, 100); 
    }

    crash(point) {
        this.gameState = 'crashed';
        this.multiplier = point;
        
        try { 
            rocketDB.finishGame(this.gameId, point); 
            rocketDB.failBets(this.gameId); 
        } catch(e) {}
        
        this.io.emit('rocketState', { 
            status: 'crashed', 
            crashPoint: point, 
            bets: Array.from(this.bets.values()) 
        });

        setTimeout(() => this.loop(), 3000);
    }

    broadcastState() {
        this.io.emit('rocketState', { 
            status: this.gameState, 
            multiplier: this.multiplier, 
            bets: Array.from(this.bets.values()) 
        });
    }

    handleBet(user, amount) {
        if (this.gameState === 'running') return { error: 'Wait for crash' };
        if (this.bets.has(user.id) || this.nextRoundBets.has(user.id)) return { error: 'Bet active' };
        if (amount > 50000) return { error: 'Max bet is 50,000' };
        if (amount <= 0) return { error: 'Invalid bet' };

        try {
            const newStats = processBet(user.id, amount);
            
            const betData = { 
                userId: user.id, 
                username: user.username || 'User', 
                avatar: user.photo_url, 
                bet: amount, 
                cashedOut: false 
            };
            
            if (this.gameState === 'crashed') {
                this.nextRoundBets.set(user.id, betData);
            } else {
                this.bets.set(user.id, betData);
                rocketDB.placeBet(this.gameId, user.id, amount);
                this.broadcastState();
            }

            return { success: true, newBalance: newStats.balance };
        } catch(e) { return { error: 'Insufficient funds' }; }
    }

    handleCashout(user) {
        if (this.gameState !== 'running') return { error: 'Not running' };

        const betData = this.bets.get(user.id);
        if (!betData || betData.cashedOut) return { error: 'Invalid' };

        const point = this.multiplier;
        const win = Math.floor(betData.bet * point);
        const profit = win - betData.bet;
        
        betData.cashedOut = true;
        betData.multiplier = point;
        betData.profit = profit;
        this.bets.set(user.id, betData);

        const newStats = processWin(user.id, win);
        rocketDB.cashoutBet(this.gameId, user.id, point, profit);

        this.io.emit('rocketCashoutNotify', { username: user.username, profit, mult: point });
        return { success: true, winAmount: win, newBalance: newStats.balance };
    }
}

module.exports = RocketEngine;