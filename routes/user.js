const express = require('express');
const { getUser, getUserStats, updateUserLastSeen, getTodayStats,saveUserLanguage  } = require('../shared-db');
const router = express.Router();

router.get('/profile', (req, res) => {
    updateUserLastSeen(req.userId);
    res.json({ success: true, user: { ...getUser(req.userId), ...getUserStats(req.userId) } });
});

router.post('/ping', (req, res) => {
    updateUserLastSeen(req.userId);
    res.json({ success: true });
});

router.post('/language', (req, res) => {
    try {
        const { language } = req.body;
        // Validate input
        if (!language || !['EN', 'UA'].includes(language)) {
            return res.status(400).json({ error: 'Invalid language' });
        }
        
        saveUserLanguage(req.userId, language);
        res.json({ success: true, language });
    } catch (e) {
        console.error("Failed to update user language:", e);
        res.status(500).json({ error: 'Failed to update language' });
    }
});

// This is the route app.js calls for stats
router.get('/stats/public', (req, res) => {
    res.json({ success: true, stats: getTodayStats() });
});
router.get('/stats/today', (req, res) => { // Alias
    res.json({ success: true, stats: getTodayStats() });
});

module.exports = router;