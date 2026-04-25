const express = require('express');
const DiceGame = require('../games/dice');
const router = express.Router();

router.post('/dice', (req, res) => {
    try {
        const result = DiceGame.play(req.userId, req.body.bet);
        res.json(result);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;