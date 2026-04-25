

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'casino.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');


db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, first_name TEXT, username TEXT,photo_url TEXT,
    language TEXT DEFAULT 'EN', theme TEXT DEFAULT 'dark',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY, balance INTEGER DEFAULT 0 CHECK (balance >= 0),
    total_bets INTEGER DEFAULT 0, today_bets INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0, total_wagered INTEGER DEFAULT 0,
    last_bet_date DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS web_sessions (
    session_id TEXT PRIMARY KEY, user_id INTEGER, init_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME,
    last_ping DATETIME DEFAULT CURRENT_TIMESTAMP, is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS online_users (
    user_id INTEGER PRIMARY KEY, last_ping DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_count INTEGER DEFAULT 1, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY, user_id INTEGER, type TEXT, amount_ruby INTEGER,
    amount_crypto REAL, asset TEXT, status TEXT DEFAULT 'pending', external_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE INDEX IF NOT EXISTS idx_web_sessions_active ON web_sessions(is_active, last_ping);
  
  -- GAME TABLES
  CREATE TABLE IF NOT EXISTS crash_games (
    id INTEGER PRIMARY KEY, crash_point REAL, status TEXT, started_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS crash_bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER, user_id INTEGER,
    bet_amount INTEGER, cashout_point REAL, profit INTEGER, status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (game_id) REFERENCES crash_games(id)
  );
`);



const processBet = db.transaction((userId, amount) => {
    const now = new Date().toISOString();
    const current = db.prepare('SELECT balance FROM user_stats WHERE user_id = ?').get(userId);
    if (!current || current.balance < amount) throw new Error('Insufficient funds');

    db.prepare(`
        UPDATE user_stats 
        SET balance = balance - ?, 
            total_bets = total_bets + 1, 
            total_wagered = total_wagered + ?, 
            last_bet_date = ?
        WHERE user_id = ?
    `).run(amount, amount, now, userId);

    return db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
});

const processWin = db.transaction((userId, winAmount) => {
    db.prepare(`
        UPDATE user_stats 
        SET balance = balance + ?, 
            total_wins = total_wins + 1
        WHERE user_id = ?
    `).run(winAmount, userId);
    return db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
});



function ensureUserExists(userData) {
    try {

        
        const photo = userData.photo_url || null;

        if (photo) {
            // If we have a photo, update everything
            db.prepare(`
                INSERT INTO users (id, first_name, username, photo_url, language, theme) 
                VALUES (?, ?, ?, ?, 'EN', 'dark')
                ON CONFLICT(id) DO UPDATE SET 
                    first_name=excluded.first_name, 
                    username=excluded.username,
                    photo_url=excluded.photo_url 
            `).run(userData.id, userData.first_name || '', userData.username || '', photo);
        } else {
            // If no photo (Bot start), don't overwrite existing photo_url with null
            db.prepare(`
                INSERT INTO users (id, first_name, username, language, theme) 
                VALUES (?, ?, ?, 'EN', 'dark')
                ON CONFLICT(id) DO UPDATE SET 
                    first_name=excluded.first_name, 
                    username=excluded.username
            `).run(userData.id, userData.first_name || '', userData.username || '');
        }
        
        db.prepare('INSERT OR IGNORE INTO user_stats (user_id, balance) VALUES (?, 0)').run(userData.id);
        return true;
    } catch (e) { console.error("DB Error:", e); return false; }
}

function getUser(userId) { return db.prepare('SELECT * FROM users WHERE id = ?').get(userId); }
function getUserStats(userId) { return db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId); }

function updateUserLastSeen(userId) {
    try {
        const now = new Date().toISOString();
        db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now, userId);
        db.prepare(`INSERT INTO online_users (user_id, last_ping, session_count) VALUES (?, ?, 1)
            ON CONFLICT(user_id) DO UPDATE SET last_ping = excluded.last_ping`).run(userId, now);
    } catch (e) {}
}
function setUserBalance(userId, amount) {
    try {
        // Ensure amount is integer
        const safeAmount = parseInt(amount);
        if (isNaN(safeAmount) || safeAmount < 0) return false;

        const info = db.prepare('UPDATE user_stats SET balance = ? WHERE user_id = ?').run(safeAmount, userId);
        
        // changes > 0 means a row was found and updated
        return info.changes > 0;
    } catch (e) {
        console.error("Set Balance Error:", e);
        return false;
    }
}

function getTodayStats() {
    try {
        const online = db.prepare('SELECT COUNT(*) as count FROM online_users').get().count;
        
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as totalBets,
                COALESCE(SUM(bet_amount), 0) as totalWagered,
                COUNT(CASE WHEN profit > 0 THEN 1 END) as totalWins
            FROM crash_bets 
            WHERE created_at >= date('now', 'localtime', 'start of day')
        `).get();

        return { 
            onlineUsers: online, 
            totalWins: stats.totalWins, 
            totalWagered: stats.totalWagered, 
            totalBets: stats.totalBets 
        };
    } catch (e) { 
        return { onlineUsers: 0, totalWins: 0, totalWagered: 0, totalBets: 0 }; 
    }
}

// Transaction Helpers
function createTransaction(data) {
    const id = require('crypto').randomUUID();
    db.prepare(`INSERT INTO transactions (id, user_id, type, amount_ruby, amount_crypto, asset, status, external_id) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).run(id, data.userId, data.type, data.amountRuby, data.amountCrypto, data.asset, data.externalId || null);
    return id;
}
function updateTransactionStatus(id, status, externalId = null) {
    const stmt = externalId 
        ? db.prepare('UPDATE transactions SET status = ?, external_id = ? WHERE id = ?')
        : db.prepare('UPDATE transactions SET status = ? WHERE id = ?');
    stmt.run(externalId ? [status, externalId, id] : [status, id]);
}
function getPendingDeposits(userId) { return db.prepare("SELECT * FROM transactions WHERE user_id = ? AND type = 'deposit' AND status = 'pending'").all(userId); }
function getAllPendingDeposits() { return db.prepare("SELECT * FROM transactions WHERE type = 'deposit' AND status = 'pending'").all(); }
function getTransactionByExternalId(externalId) { return db.prepare('SELECT * FROM transactions WHERE external_id = ?').get(externalId); }

const completeDeposit = db.transaction((txId, amountRuby) => {
    const tx = db.prepare('SELECT status, user_id FROM transactions WHERE id = ?').get(txId);
    if (tx && tx.status === 'pending') {
        db.prepare("UPDATE transactions SET status = 'paid' WHERE id = ?").run(txId);
        db.prepare('UPDATE user_stats SET balance = balance + ? WHERE user_id = ?').run(amountRuby, tx.user_id);
        return true;
    }
    return false;
});

// Rocket Specific DB Actions
const rocketDB = {
    createGame: (id) => db.prepare("INSERT INTO crash_games (id, status) VALUES (?, 'running')").run(id),
    finishGame: (id, point) => db.prepare("UPDATE crash_games SET crash_point = ?, status = 'ended' WHERE id = ?").run(point, id),
    placeBet: (gId, uId, amt) => db.prepare("INSERT INTO crash_bets (game_id, user_id, bet_amount, status) VALUES (?, ?, ?, 'active')").run(gId, uId, amt),
    cashoutBet: (gId, uId, pt, prof) => db.prepare("UPDATE crash_bets SET status = 'cashed_out', cashout_point = ?, profit = ? WHERE game_id = ? AND user_id = ?").run(pt, prof, gId, uId),
    failBets: (gId) => db.prepare("UPDATE crash_bets SET status = 'lost' WHERE game_id = ? AND status = 'active'").run(gId),
    getHistory: () => db.prepare("SELECT * FROM crash_games WHERE status = 'ended' ORDER BY id DESC LIMIT 10").all()
};


setInterval(() => {
    try {
        const now = new Date();
        const thirtySecAgo = new Date(now - 30 * 1000).toISOString();
        const fiveMinsAgo = new Date(now - 5 * 60 * 1000).toISOString();
        

        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString(); 
        const twentyThreeHoursAgo = new Date(now - 23 * 60 * 60 * 1000).toISOString(); 


        db.prepare(`UPDATE web_sessions SET is_active = 0 WHERE last_ping < ? AND is_active = 1`).run(thirtySecAgo);
        db.prepare('DELETE FROM online_users WHERE user_id NOT IN (SELECT DISTINCT user_id FROM web_sessions WHERE is_active = 1)').run();


        db.prepare("UPDATE crash_bets SET status = 'lost' WHERE status = 'active' AND created_at < ?").run(fiveMinsAgo);


        db.prepare("DELETE FROM web_sessions WHERE last_ping < ?").run(oneDayAgo);


        db.prepare("DELETE FROM crash_bets WHERE created_at < ?").run(twentyThreeHoursAgo); // 23h Cutoff
        db.prepare("DELETE FROM crash_games WHERE started_at < ?").run(oneDayAgo); // 24h Cutoff


        db.prepare("DELETE FROM transactions WHERE type = 'deposit' AND status = 'pending' AND created_at < ?").run(oneDayAgo);


        const staleWithdrawals = db.prepare("SELECT * FROM transactions WHERE type = 'withdraw' AND status = 'pending' AND created_at < ?").all(oneDayAgo);
        
        for (const tx of staleWithdrawals) {
            db.transaction(() => {
                db.prepare('UPDATE user_stats SET balance = balance + ? WHERE user_id = ?').run(tx.amount_ruby, tx.user_id);
                db.prepare("DELETE FROM transactions WHERE id = ?").run(tx.id);
            })();
            console.log(`Refunded stale withdrawal for user ${tx.user_id}`);
        }

    } catch (e) {
        console.error("Janitor Error:", e.code || e.message);
    }
}, 60000);

module.exports = {
    db, ensureUserExists, getUser, getUserStats, updateUserLastSeen, getTodayStats,
    processBet, processWin, updateTransactionStatus,
    createTransaction, getPendingDeposits, getAllPendingDeposits, getTransactionByExternalId, completeDeposit,
    rocketDB,
    saveUserLanguage: (uid, lang) => db.prepare('UPDATE users SET language = ? WHERE id = ?').run(lang, uid),
    getVideoFileId: () => db.prepare("SELECT value FROM settings WHERE key = 'video_file_id'").get()?.value,
    saveVideoFileId: (fid) => db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('video_file_id', ?)").run(fid),
    setUserBalance
};