# 💎 RUBY Casino | Telegram Mini App

RUBY is a high-performance, premium Telegram Casino Bot and Mini App built for a seamless gambling experience. It features real-time multiplayer games, a robust crypto payment system, and a modern glassmorphic UI.

![RUBY Preview](web/assets/phonecrystal.png)

## 🚀 Features

- **Multi-Game Platform**: Includes Rocket Crash, Mines, and Dice.
- **Telegram Mini App (TMA)**: A fully integrated web interface inside Telegram.
- **Real-time Synchronization**: Powered by Socket.io for live game states and multiplayer actions.
- **Crypto Integration**: Seamless deposits and withdrawals via Crypto Pay API.
- **Bilingual Support**: Full support for English and Ukrainian.
- **Automated Janitor**: Intelligent database cleanup and session management.
- **Secure Backend**: JWT-based authentication and rate limiting.

## 🎮 Included Games

### 🚀 Rocket Crash
An adrenaline-pumping multiplayer game. Place your bet, watch the multiplier climb, and cash out before the rocket explodes. Features a live leaderboard and exponential growth curves.

### 💣 Mines
A classic game of strategy. Find the gems and avoid the hidden bombs. Features customizable mine counts and progressive multipliers.

### 🎲 Dice Roll
Fast-paced classic dice rolling. Simple mechanics with high-speed results and provably fair-style rigging protection.

## 🛠 Tech Stack

- **Backend**: Node.js, Express
- **Real-time**: Socket.io
- **Database**: SQLite (better-sqlite3)
- **Bot Framework**: Telegraf
- **Frontend**: Vanilla JS, CSS3, HTML5 (Mini App)
- **Security**: JWT, Helmet, Express-Rate-Limit

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yuriikot2010/Casino-template.git
   cd Casino-template
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Copy `.env-example` to `.env` and fill in your credentials.
   ```bash
   cp .env-example .env
   ```

4. **Start the application**:
   ```bash
   node main.js
   ```

## ⚙️ Configuration

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Your Telegram Bot API Token |
| `MINIAPP_URL` | The public URL where the Mini App is hosted |
| `WEB_PORT` | Port for the Express server (default: 3000) |
| `JWT_SECRET` | Secret key for signing authentication tokens |
| `CRYPTO_PAY_TOKEN` | API Token from @CryptoBot |
| `CRYPTO_NET` | `mainnet` or `testnet` for payments |

## 📁 Project Structure

```text
├── games/           # Server-side game logic (Rocket, Mines, Dice)
├── routes/          # API endpoints for auth, payments, and users
├── services/        # External service integrations (Crypto)
├── web/             # Frontend Mini App (HTML, CSS, JS)
├── assets/          # Static assets (images, animations)
├── bot.js           # Telegram bot handler
├── web.js           # Express & Socket.io server
├── shared-db.js     # Database schema and shared logic
└── main.js          # Master process to run bot and web concurrently
```
## Note from dev
tbh its kinda good if you want to modify it 
fix some bugs,get into it and i think you will be fine 
as i remember there are some problems with balance update in some games,you should fix it 
## 📜 License

This project is licensed under the ISC License.

---
*Built with ❤️ for the RUBY community.*
