const express = require('express');
const jwt = require('jsonwebtoken');
const { ensureUserExists, getUser, getUserStats } = require('../shared-db');
const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || 'dev-secret';

router.post('/telegram', (req, res) => {
    try {
        const userData = JSON.parse(new URLSearchParams(req.body.initData).get('user'));
        ensureUserExists(userData);
        const token = jwt.sign({ userId: userData.id }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ success: true, token, user: { ...getUser(userData.id), ...getUserStats(userData.id) } });
    } catch (e) { res.status(500).json({ error: 'Auth failed' }); }
});
module.exports = router;