

const RUBY_LANG = {
    EN: {
        welcome: "Welcome to RUBY",
        subtext: "Your exclusive casino experience",
        statsTitle: "Today's Stats",
        gamesTitle: "Games",
        online: "Online",
        wins: "Total Wins today",
        wagered: "Wagered today",
        bets: "Total Bets today",
        betLabel: "BET AMOUNT",
        playBtn: "PLAY",
        soonBtn: "SOON",
        diceTitle: "Dice Roll",
        diceDesc: "Classic dice game with high multipliers",
        dice_rolling: "ROLLING...",
        dice_press: "PRESS ROLL",
        dice_won: "WON",
        dice_lost: "LOST",
        rocketTitle: "Rocket Crash",
        rocketDesc: "Eject before it crashes!",
        rocket_wait: "WAITING",
        rocket_launch: "LAUNCHING IN",
        rocket_fly: "FLYING",
        rocket_crash: "CRASHED",
        rocket_bet: "PLACE BET",
        rocket_cashout: "CASHOUT",
        rocket_placed: "BET PLACED",
        minesTitle: "Mines",
        minesDesc: "Find gems, avoid bombs!",
        mines_won: "CASHED OUT",
        profileTitle: "Your Profile",
        balanceLabel: "Balance:",
        joinedLabel: "Joined:",
        lastBetLabel: "Last Bet:",
        totalWageredLabel: "Total Wagered:",
        depositBtn: "Deposit",
        withdrawBtn: "Withdraw",
        depositTitle: "Deposit USDT",
        withdrawTitle: "Withdraw RUBY",
        depositLabel: "Amount (USDT)",
        withdrawLabel: "Amount (RUBY)",
        payBtn: "PAY",
        withdrawActionBtn: "WITHDRAW",
        depositRate: "MIN DEPOSIT: 1 USDT\nRATE: 1 USDT = 100 RUBY",
        withdrawRate: "MIN WITHDRAW: 1000 RUBY (10 USDT)\nRATE: 100 RUBY = 1 USDT"
    },
    UA: {
        welcome: "Ласкаво просимо в RUBY",
        subtext: "Ваш ексклюзивний досвід чекає",
        statsTitle: "Статистика дня",
        gamesTitle: "Ігри",
        online: "Онлайн",
        wins: "Всього виграшів сьогодні",
        wagered: "Cумма всіх ставок за сьогодні",
        bets: "Всього ставок сьогодні",
        betLabel: "СУМА СТАВКИ",
        playBtn: "ГРАТИ",
        soonBtn: "СКОРО",
        diceTitle: "Кидок Кубика",
        diceDesc: "Класична гра з високими множниками",
        dice_rolling: "КРУТИМО...",
        dice_press: "НАТИСНИ",
        dice_won: "ВИГРАШ",
        dice_lost: "ПРОГРАШ",
        rocketTitle: "Rocket Crash",
        rocketDesc: "Катапультуйся до вибуху!",
        rocket_wait: "ОЧІКУВАННЯ",
        rocket_launch: "СТАРТ ЗА",
        rocket_fly: "ПОЛІТ",
        rocket_crash: "ВИБУХ",
        rocket_bet: "СТАВКА",
        rocket_cashout: "ЗАБРАТИ",
        rocket_placed: "ПРИЙНЯТО",
        minesTitle: "Міни",
        minesDesc: "Шукай діаманти, уникай бомб!",
        mines_won: "ЗАБРАНО",
        profileTitle: "Ваш Профіль",
        balanceLabel: "Баланс:",
        joinedLabel: "Приєднався:",
        lastBetLabel: "Остання ставка:",
        totalWageredLabel: "Всього поставлено:",
        depositBtn: "Поповнити",
        withdrawBtn: "Вивести",
        depositTitle: "Поповнення USDT",
        withdrawTitle: "Виведення RUBY",
        depositLabel: "Сума (USDT)",
        withdrawLabel: "Сума (RUBY)",
        payBtn: "СПЛАТИТИ",
        withdrawActionBtn: "ВИВЕСТИ",
        depositRate: "МІН ВНЕСОК: 1 USDT\nКУРС: 1 USDT = 100 RUBY",
        withdrawRate: "МІН ВИВІД: 1000 RUBY (10 USDT)\nКУРС: 100 RUBY = 1 USDT"
    }
};

class RubyApp {
    constructor() {
        this.token = localStorage.getItem('ruby_token');
        this.sessionId = localStorage.getItem('ruby_session');
        this.user = JSON.parse(localStorage.getItem('ruby_user') || 'null');
        this.currentLanguage = (this.user?.language === 'UA') ? 'UA' : 'EN';
        this.currentTheme = this.user?.theme || 'dark';
        this.tg = window.Telegram?.WebApp;
        this.isTelegramWebApp = !!this.tg;
        this.haptic = this.tg?.HapticFeedback;
        this.isInitialized = false;
        this.socket = null; 
    }

    getTrans(key) {
        if (!RUBY_LANG) return key;
        const dict = RUBY_LANG[this.currentLanguage] || RUBY_LANG.EN;
        return dict[key] || key;
    }

    async init() {
        try {
            if (this.isTelegramWebApp) {
                this.tg.expand();
                this.tg.enableClosingConfirmation();
                this.grabTelegramPhoto(); 
            }
            this.showLoading();
            await this.authenticate();
            if (this.token) {
                await Promise.all([this.loadUserData(), this.loadStats()]);
            }
            this.initUI();
            this.connectSocket();
        } catch (error) { 
            console.error("Init Error:", error); 
        } 
        finally { 
            setTimeout(() => { this.hideLoading(); this.showApp(); this.isInitialized = true; }, 500); 
        }
    }

    grabTelegramPhoto() {
        try {
            const unsafe = this.tg?.initDataUnsafe?.user;
            if (unsafe?.photo_url) {
                if (!this.user) this.user = {};
                this.user.photoUrl = unsafe.photo_url;
                localStorage.setItem('ruby_user_avatar', unsafe.photo_url);
            }
        } catch (e) {}
    }

    async changeLanguage(lang) {
        this.applyLanguage(lang);
        this.hideModal('language-modal');
        if (this.token) {
            try {
                if(this.user) {
                    this.user.language = lang;
                    localStorage.setItem('ruby_user', JSON.stringify(this.user));
                }
                await this.apiCall('user/language', 'POST', { language: lang });
                if(window.Game) window.Game.updateUI(); 
            } catch (e) {}
        }
    }

    applyLanguage(lang) {
        this.currentLanguage = lang;
        const t = RUBY_LANG[lang] || RUBY_LANG.EN;
        const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

        set('current-lang', lang);
        set('welcome-text', t.welcome);
        set('welcome-subtext', t.subtext);
        set('stats-title', t.statsTitle);
        set('games-title', t.gamesTitle);
        set('online-label', t.online);
        set('wins-label', t.wins);
        set('wagered-label', t.wagered);
        set('bets-label', t.bets);
        set('dice-title', t.diceTitle);
        set('dice-desc', t.diceDesc);
        
        const minesCard = document.getElementById('play-mines');
        if (minesCard) {
            minesCard.querySelector('h3').textContent = t.minesTitle;
            minesCard.querySelector('p').textContent = t.minesDesc;
        }

        set('profile-title', t.profileTitle);
        set('balance-label', t.balanceLabel);
        set('joined-label', t.joinedLabel);
        set('total-bets-label', t.bets);
        set('total-wins-label', t.wins);
        set('last-bet-label', t.lastBetLabel);
        set('total-wagered-label', t.totalWageredLabel);

        document.querySelectorAll('.current-bet .label').forEach(el => el.textContent = t.betLabel);
        document.querySelectorAll('.play-button').forEach(b => {
            if (!b.disabled && !b.id.includes('action')) b.textContent = t.playBtn;
        });

        const rocketCard = document.getElementById('play-rocket');
        if (rocketCard) {
            rocketCard.querySelector('h3').textContent = t.rocketTitle;
            rocketCard.querySelector('p').textContent = t.rocketDesc;
        }
        
        document.querySelectorAll('.language-option').forEach(el => {
            if (el.getAttribute('data-lang') === lang) el.classList.add('active');
            else el.classList.remove('active');
        });
    }

    initUI() {
        this.applyTheme(this.currentTheme);
        this.applyLanguage(this.currentLanguage);
        
        this.bindClick('theme-toggle', () => this.toggleTheme());
        this.bindClick('language-switcher', () => this.showModal('language-modal'));
        
        this.bindClick('profile-btn', () => { this.updateProfileModal(); this.showModal('profile-modal'); });
        this.bindClick('close-profile', () => this.hideModal('profile-modal'));
        this.bindClick('close-language', () => this.hideModal('language-modal'));
        
        document.querySelectorAll('.language-option').forEach(option => {
            option.onclick = () => {
                const lang = option.getAttribute('data-lang');
                this.changeLanguage(lang);
            };
        });

        this.bindClick('deposit-btn', () => { this.showModal('payment-modal'); this.setupPaymentUI('deposit'); });
        this.bindClick('withdraw-btn', () => { this.showModal('payment-modal'); this.setupPaymentUI('withdraw'); });
        this.bindClick('close-payment', () => this.hideModal('payment-modal'));
        this.bindClick('payment-submit', () => this.handlePaymentSubmit());

        const diceBtn = document.getElementById('play-dice');
        if (diceBtn) diceBtn.addEventListener('click', () => this.launchDiceGame());
        
        const rocketBtn = document.getElementById('play-rocket');
        if (rocketBtn) rocketBtn.addEventListener('click', () => this.launchRocketGame());

        const minesBtn = document.getElementById('play-mines');
        if (minesBtn) minesBtn.addEventListener('click', () => this.launchMinesGame());

        document.getElementById('rocket-back')?.addEventListener('click', () => {
            document.body.style.overflow = ''; 
            document.getElementById('rocket-screen')?.classList.add('hidden');
            this.loadUserData(); 
        });
        document.getElementById('mines-back')?.addEventListener('click', () => {
            document.body.style.overflow = ''; 
            document.getElementById('mines-screen')?.classList.add('hidden');
            this.loadUserData(); 
        });
        document.getElementById('game-back')?.addEventListener('click', () => {
            document.body.style.overflow = ''; 
            if(window.Game) window.Game.close();
        });

        this.updateUserUI();
    }

    setupPaymentUI(type) {
        this.paymentType = type;
        const isDep = type === 'deposit';
        const t = RUBY_LANG[this.currentLanguage] || RUBY_LANG.EN;

        const set = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        
        set('payment-title', isDep ? t.depositTitle : t.withdrawTitle);
        set('payment-label', isDep ? t.depositLabel : t.withdrawLabel);
        set('payment-submit', isDep ? t.payBtn : t.withdrawActionBtn);
        set('payment-rate', isDep ? t.depositRate : t.withdrawRate);
        
        const oldInput = document.getElementById('payment-input');
        if(oldInput) {
            const newInput = oldInput.cloneNode(true);
            oldInput.parentNode.replaceChild(newInput, oldInput);
            newInput.value = '';             
            newInput.disabled = false;       
            newInput.placeholder = isDep ? "Min 1.00" : "Min 1000";
            setTimeout(() => newInput.focus(), 150);
        }
    }

    connectSocket() {
        if (typeof io === 'undefined' || this.socket) return;
        this.socket = io({
            auth: { token: this.token },
            transports: ['websocket']
        });
    }

    async apiCall(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        
        const res = await fetch(`/api/${endpoint}`, { 
            method, headers, body: body ? JSON.stringify(body) : null 
        });

        let data = {};
        try { data = await res.json(); } catch (e) {}

        if (!res.ok) {
            throw new Error(data.error || res.statusText || "Unknown Error");
        }

        return data;
    }

    async authenticate() {
        if (this.isTelegramWebApp) {
            const initData = this.tg.initData;
            const data = await this.apiCall('auth/telegram', 'POST', { initData });
            this.processAuthResponse(data);
        }
    }

    processAuthResponse(data) {
        this.token = data.token;
        this.sessionId = data.sessionId;
        this.user = data.user;
        if (data.user.language) this.currentLanguage = data.user.language;
        
        localStorage.setItem('ruby_token', this.token);
        localStorage.setItem('ruby_session', this.sessionId);
        localStorage.setItem('ruby_user', JSON.stringify(this.user));
    }

    async loadUserData() {
        try {
            const data = await this.apiCall('user/profile');
            if (data?.user) {
                const cachedPhoto = localStorage.getItem('ruby_user_avatar') || this.user?.photoUrl;
                this.user = { ...this.user, ...data.user };
                if (cachedPhoto && !this.user.photoUrl) this.user.photoUrl = cachedPhoto;
                localStorage.setItem('ruby_user', JSON.stringify(this.user));
                this.updateUserUI();
                if(!document.getElementById('profile-modal').classList.contains('hidden')) {
                    this.updateProfileModal();
                }
            }
        } catch (e) {}
    }

    async loadStats() {
        try {
            const data = await this.apiCall('stats/public');
            if (data?.stats) this.updateStatsUI(data.stats);
        } catch (e) {}
    }

     launchMinesGame() {
        if (this.user.balance <= 0) {
            this.showModal('payment-modal');
            this.setupPaymentUI('deposit');
            return;
        }
        document.body.style.overflow = 'hidden'; 
        document.getElementById('mines-screen').classList.remove('hidden');
        
        if (!this.minesGame && typeof MinesGame !== 'undefined') {
            this.minesGame = new MinesGame(this);
        } else if (this.minesGame) {

            this.minesGame.updateUIState();
        }
    }
    launchRocketGame() {
        if (this.user.balance <= 0) {
            this.showModal('payment-modal');
            this.setupPaymentUI('deposit');
            return;
        }
        document.body.style.overflow = 'hidden'; 
        document.getElementById('rocket-screen').classList.remove('hidden');
        

        this.updateUserUI();

        if (!this.rocketGame && typeof RocketGame !== 'undefined') {
            this.rocketGame = new RocketGame(this);
        }
    }
    
    launchDiceGame() {
         if (this.user.balance <= 0) {
            this.showModal('payment-modal');
            this.setupPaymentUI('deposit');
            return;
        }
        if (typeof DiceGame !== 'undefined') { 
            document.body.style.overflow = 'hidden';
            window.Game = new DiceGame(); 
            window.Game.open(); 
        }
    }

    updateUserUI() {
        if (!this.user) return;
        

        const balEl = document.getElementById('header-balance');
        if(balEl) balEl.textContent = this.user.balance || 0;
        

        ['mines-balance', 'game-balance', 'rocket-balance'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.textContent = this.user.balance || 0;
        });

        document.getElementById('online-users')?.classList.add('online-badge');
    }

    updateProfileModal() {
        if (!this.user) return;
        const set = (id, txt) => { const e = document.getElementById(id); if(e) e.textContent = txt; };
        
        const name = this.user.first_name || this.user.firstName || this.user.username || 'Player';
        set('user-name', name);
        set('user-id', `ID: ${this.user.id || '...'}`);
        set('profile-balance', `${(this.user.balance||0).toLocaleString()} RUBY`);
        
        const get = (k1, k2) => this.user[k1] !== undefined ? this.user[k1] : (this.user[k2] || 0);
        set('profile-total-bets', get('totalBets', 'total_bets'));
        set('profile-total-wins', get('totalWins', 'total_wins'));
        set('profile-total-wagered', `${get('totalWagered', 'total_wagered').toLocaleString()} RUBY`);
        set('join-date', this.user.created_at ? new Date(this.user.created_at).toLocaleDateString() : '--');

        const lastBet = this.user.last_bet_date || this.user.lastBetDate;
        let dateDisplay = '--';
        if (lastBet) {
            const d = new Date(lastBet);
            dateDisplay = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        set('last-bet-date', dateDisplay);

        const avatarEl = document.querySelector('.profile-avatar');
        if (avatarEl) {
            const initials = (name[0] || 'U').toUpperCase();
            if (this.user.photoUrl) {
                avatarEl.innerHTML = `
                    <img src="${this.user.photoUrl}" 
                         style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" 
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                    <div class="initials-fallback" style="display:none">${initials}</div>`;
            } else {
                avatarEl.innerHTML = `<div class="initials-fallback">${initials}</div>`;
            }
        }
    }

    updateStatsUI(stats) {
        if (!stats) return;
        const set = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val.toLocaleString(); };
        set('online-users', stats.onlineUsers);
        set('total-wins', stats.totalWins || 0);
        set('total-wagered', stats.totalWagered || 0);
        set('total-bets', stats.totalBets || 0);
    }

    async handlePaymentSubmit() {
        const input = document.getElementById('payment-input');
        if(!input) return;
        
        const val = parseFloat(input.value.replace(/,/g, '.'));
        if (isNaN(val) || val <= 0) return this.notify('Invalid amount', 'error');

        const btn = document.getElementById('payment-submit');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
            if (this.paymentType === 'deposit') {
                const res = await this.apiCall('payment/deposit', 'POST', { amount: val });
                if (res.url) this.tg.openLink(res.url);
                this.hideModal('payment-modal');
                btn.disabled = false;
                btn.textContent = originalText;
            } else {
                const res = await this.apiCall('payment/withdraw', 'POST', { amountRuby: val });
                if (res.success) {
                    this.notify('Withdrawal Successful!', 'success');
                    this.loadUserData();
                    this.hideModal('payment-modal');
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
            }
        } catch (e) {
            this.notify(e.message || 'Error', 'error');
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    bindClick(id, fn) { const el = document.getElementById(id); if(el) el.addEventListener('click', fn); }
    showModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
    hideModal(id) { document.getElementById(id)?.classList.add('hidden'); }
    showLoading() { document.getElementById('loading-screen')?.classList.remove('hidden', 'active'); document.getElementById('loading-screen')?.classList.add('active'); }
    hideLoading() { document.getElementById('loading-screen')?.classList.remove('active'); setTimeout(() => document.getElementById('loading-screen')?.classList.add('hidden'), 300); }
    showApp() { document.getElementById('app')?.classList.remove('hidden'); }
    
    notify(msg, type = 'info') {
        const container = document.getElementById('notification-area');
        if(!container) return alert(msg);
        
        const toast = document.createElement('div');
        toast.className = `toast ${type} show`;
        toast.innerHTML = `<span>${msg}</span>`;
        container.appendChild(toast);
        if(this.haptic) this.haptic.notificationOccurred(type === 'error' ? 'error' : 'success');
        setTimeout(() => toast.remove(), 3000);
    }

    applyTheme(theme) {
        document.body.className = `${theme}-theme`;
    }
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(this.currentTheme);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.RubyApp = new RubyApp();
    window.RubyApp.init();
});