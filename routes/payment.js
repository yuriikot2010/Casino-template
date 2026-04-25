const express = require('express');
const { createDepositInvoice, getInvoices, verifyWebhook, sendWithdrawal, getAppBalance, EXCHANGE_RATE } = require('../services/crypto');
const { createTransaction, getPendingDeposits, completeDeposit, getAllPendingDeposits, getTransactionByExternalId, getUserStats, db, getUser, updateTransactionStatus } = require('../shared-db');
const router = express.Router();


router.post('/deposit', async (req, res) => {
    try {
        const amount = parseFloat(req.body.amount); 
        if (isNaN(amount) || amount < 1) {
            return res.status(400).json({ error: 'Minimum deposit is 1 USDT' });
        }

        const r = await createDepositInvoice(req.userId, amount);
        createTransaction({
            userId: req.userId, type: 'deposit', amountRuby: r.amountRuby, 
            amountCrypto: amount, asset: 'USDT', externalId: r.invoiceId
        });
        res.json({ success: true, url: r.payUrl });
    } catch(e) { 
        console.error("Deposit Error:", e);
        res.status(500).json({ error: 'Deposit failed' }); 
    }
});


router.post('/withdraw', async (req, res) => {
    try {
        const { amountRuby } = req.body; 
        if (!amountRuby) return res.status(400).json({ error: 'Invalid amount' });

        const amountCrypto = (amountRuby / EXCHANGE_RATE).toFixed(2); 

        if (parseFloat(amountCrypto) < 10) {
            return res.status(400).json({ error: `Min withdrawal is 10 USDT (${10 * EXCHANGE_RATE} RUBY)` });
        }

        const userStats = getUserStats(req.userId);
        if (userStats.balance < amountRuby) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        const casinoBalance = await getAppBalance();
        if (casinoBalance < parseFloat(amountCrypto)) {
            return res.status(500).json({ error: 'System liquidity low. Please try again later.' });
        }

        const txId = require('crypto').randomUUID();
        

        db.prepare('UPDATE user_stats SET balance = balance - ? WHERE user_id = ?').run(amountRuby, req.userId);
        

        db.prepare(`INSERT INTO transactions (id, user_id, type, amount_ruby, amount_crypto, asset, status) VALUES (?, ?, 'withdraw', ?, ?, 'USDT', 'pending')`)
          .run(txId, req.userId, amountRuby, amountCrypto);

        try {
            const telegramId = getUser(req.userId).id; 
            await sendWithdrawal(telegramId, amountCrypto, txId);
            
            updateTransactionStatus(txId, 'paid');
            res.json({ success: true });

        } catch (e) {
            console.error("Transfer failed:", e.message);
            
            // Refund Logic
            try {
                db.prepare('UPDATE user_stats SET balance = balance + ? WHERE user_id = ?').run(amountRuby, req.userId);
                updateTransactionStatus(txId, 'failed');
            } catch (dbErr) {
                console.error("CRITICAL: Failed to refund user in DB", dbErr);
            }

            // Just return generic failure
            res.status(500).json({ error: 'Transfer failed. Funds refunded. Try starting cryptobot.' });
        }
    } catch (e) { 
        console.error("Server Error during withdraw:", e);
        res.status(500).json({ error: 'Server Error' }); 
    }
});


router.get('/check', async (req, res) => {
    try {
        const pending = getPendingDeposits(req.userId);
        let updated = false;
        if (pending.length > 0) {
            const validIds = pending.map(t => t.external_id).filter(id => id);
            if (validIds.length > 0) {
                const invoices = await getInvoices(validIds.join(','));
                for (const inv of invoices) {
                    if (inv.status === 'paid') {
                        const tx = pending.find(t => t.external_id == inv.invoice_id);
                        if (tx) { completeDeposit(tx.id, tx.amount_ruby); updated = true; }
                    }
                }
            }
        }
        res.json({ success: true, updated });
    } catch (e) { console.error(e); res.json({ success: false }); }
});


router.post('/webhook', (req, res) => {
    const signature = req.headers['crypto-pay-api-signature'];
    if (!verifyWebhook(req.rawBody, signature)) return res.status(403).json({ error: 'Invalid signature' });
    
    if (req.body.update_type === 'invoice_paid') {
        const inv = req.body.payload;
        const tx = getTransactionByExternalId(inv.invoice_id);
        if (tx && tx.status === 'pending') completeDeposit(tx.id, tx.amount_ruby);
    }
    res.json({ success: true });
});

router.backgroundWorker = async () => {
    try {
        const pending = getAllPendingDeposits();
        if (pending.length === 0) return;
        const validIds = pending.map(t => t.external_id).filter(id => id);
        if (validIds.length === 0) return;

        const invoices = await getInvoices(validIds.join(','));
        for (const inv of invoices) {
            if (inv.status === 'paid') {
                const tx = pending.find(t => t.external_id == inv.invoice_id);
                if (tx) completeDeposit(tx.id, tx.amount_ruby);
            }
        }
    } catch (e) {}
};

module.exports = router;