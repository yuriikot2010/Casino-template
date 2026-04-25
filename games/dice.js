

const crypto = require('crypto');
const { processBet, processWin } = require('../shared-db');

// CONFIGURATION (Currency: 100 = $1)
const MAX_BET = 50000; // Max Bet $500
const MAX_NET_PROFIT = 200000; // Max Win allowed per round $2,000
const FORCED_LOSS_CHANCE = 0.10; // 10% Chance to force a low roll (1, 2, or 3)
const PAYOUT_MULTIPLIER = 1.94; // Pays 1.94x on a 50% chance (House Edge built-in)

class DiceGame {
    static play(userId, bet) {

        if (!bet || bet < 10) throw new Error('Min bet is 10 (0.10$)');
        if (bet > MAX_BET) throw new Error('Max bet exceeded (500$)');
        

        let stats = processBet(userId, bet); 


        let forceLoss = false;


        const potentialProfit = (bet * PAYOUT_MULTIPLIER) - bet;
        if (potentialProfit > MAX_NET_PROFIT) {
            console.log(`⚠️ Dice: Cap hit for user ${userId}. Forcing Loss.`);
            forceLoss = true;
        }


        if (Math.random() < FORCED_LOSS_CHANCE) {
            forceLoss = true;
        }


        let roll;
        
        if (forceLoss) {


            roll = crypto.randomInt(1, 4); 
        } else {

            roll = crypto.randomInt(1, 7);
        }


        const isWin = roll >= 4;
        
        const winAmount = isWin ? Math.floor(bet * PAYOUT_MULTIPLIER) : 0;

        if (isWin) {
            stats = processWin(userId, winAmount);
        }

        return { 
            success: true, 
            roll, 
            won: isWin, 
            winAmount, 
            balance: stats.balance, 
            userStats: stats 
        };
    }
}
module.exports = DiceGame;