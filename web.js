

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');


const { getUser } = require('./shared-db');
const RocketEngine = require('./games/rocket');
const minesGame = require('./games/mines'); 


const PORT = process.env.WEB_PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'dev-secret';


const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });


app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());

    // Capture raw body for Webhook Signature Verification
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.use(express.static(path.join(__dirname, 'web')));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 2000 }));


const rocketGame = new RocketEngine(io);


const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const paymentRoutes = require('./routes/payment');
const userRoutes = require('./routes/user');


const verifyToken = (req, res, next) => {
    if (req.path.includes('/auth') || req.path.includes('/stats/public') || req.path.includes('/webhook')) {
        return next();
    }
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.userId;
        next();
    } catch (e) {
        res.status(403).json({ error: 'Invalid token' });
    }
};

app.use('/api/', verifyToken);
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/payment', paymentRoutes);
app.post('/api/payment/webhook', paymentRoutes); 
app.use('/api/user', userRoutes);
app.use('/api', userRoutes);


app.post('/webhook', paymentRoutes);


io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        socket.userId = decoded.userId;
        next();
    } catch (e) {
        next(new Error("Authentication error"));
    }
});


io.on('connection', (socket) => {
    

    socket.on('rocketBet', (data) => {
        const user = { id: socket.userId, ...getUser(socket.userId) };
        const result = rocketGame.handleBet(user, data.amount);
        socket.emit('betResult', result);
    });

    socket.on('rocketCashout', () => {
        const user = { id: socket.userId };
        const result = rocketGame.handleCashout(user);
        socket.emit('cashoutResult', result);
    });


    socket.on('minesAction', (data) => {
        const user = { id: socket.userId };
        let result;

        if (data.type === 'create') {
            result = minesGame.createGame(user.id, data.bet, data.mines);
        } 
        else if (data.type === 'click') {
            result = minesGame.clickTile(user.id, data.index);
        } 
        else if (data.type === 'cashout') {
            result = minesGame.cashout(user.id);
        }
        else if (data.type === 'restore') {
            result = minesGame.restoreGame(user.id);
        }

        if (result) {
            if (result.error) {
                socket.emit('minesState', { type: 'error', message: result.error }); 
            } else {
                socket.emit('minesState', result);
            }
        }
    });

}); 


setInterval(() => {
    if (paymentRoutes.backgroundWorker) paymentRoutes.backgroundWorker();
}, 60000);


server.listen(PORT, '0.0.0.0', () => {
    console.log(`💎 RUBY Casino Server running on port ${PORT}`);
    // Automatic webhook registration removed (must be done manually in Telegram Bot)
});