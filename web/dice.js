

class DiceGame {
    constructor() {
        this.bet = 100;
        this.isPlaying = false;
        this.anim = null;
        this.app = window.RubyApp;
        
        this.screen = document.getElementById('game-screen');
        this.lottieContainer = document.getElementById('lottie-container');
        this.betInput = document.getElementById('bet-input');
        this.balanceDisplay = document.getElementById('game-balance');
        this.resultDisplay = document.getElementById('game-result');
        this.rollButton = document.getElementById('roll-button');
        
        this.init();
    }

    init() {
        if (this.rollButton) {
            const newBtn = this.rollButton.cloneNode(true);
            this.rollButton.parentNode.replaceChild(newBtn, this.rollButton);
            this.rollButton = newBtn;
            this.rollButton.addEventListener('click', () => this.play());
        }
        
        document.getElementById('game-back')?.addEventListener('click', () => this.close());
        document.getElementById('btn-decrease')?.addEventListener('click', () => this.adjustBet(-10));
        document.getElementById('btn-increase')?.addEventListener('click', () => this.adjustBet(10));

        if (this.betInput) {
            this.betInput.addEventListener('input', (e) => {
                if(e.target.value === '') return; 
                let val = parseInt(e.target.value);
                if (isNaN(val)) val = 0;
                this.bet = val;
            });
            this.betInput.addEventListener('blur', () => {
                if(this.betInput.value === '' || parseInt(this.betInput.value) < 10) this.bet = 10;
                this.validateBet();
            });
        }
        this.showIdleState();
    }

    showIdleState() {
        if (this.anim) { this.anim.destroy(); this.anim = null; }
        

        this.lottieContainer.innerHTML = '<img src="assets/dice.svg" style="width: 140px; opacity: 0.9; filter: drop-shadow(0 0 20px rgba(51,102,255,0.4));">';
        
        this.resultDisplay.textContent = this.app.getTrans('dice_press');
        this.resultDisplay.className = 'game-result';
        if(this.rollButton) this.rollButton.textContent = this.app.getTrans('dice_press');
    }

    open() {
        this.screen.classList.remove('hidden');
        this.updateUI();
        if (!this.anim) this.showIdleState();
    }

    close() {
        this.screen.classList.add('hidden');
        if (this.anim) { this.anim.destroy(); this.anim = null; }
        this.app.loadUserData(); 
    }

    adjustBet(amount) {
        if (this.isPlaying) return;
        let newBet = this.bet + amount;
        if (newBet < 10) newBet = 10;
        this.bet = newBet;
        this.updateUI();
    }

    validateBet() {
        if (this.bet < 10) this.bet = 10;
        this.updateUI();
    }

    updateUI() {
        if (!this.app.user) return;
        if (this.betInput && document.activeElement !== this.betInput) {
            this.betInput.value = this.bet;
        }
        if (this.balanceDisplay) this.balanceDisplay.textContent = this.app.user.balance.toLocaleString();
        
        // Update Labels (Translations)
        const label = document.querySelector('.current-bet .label');
        if(label) label.textContent = this.app.getTrans('betLabel');

        if (!this.isPlaying) {
             this.rollButton.textContent = this.app.getTrans('dice_press');
             if (!this.resultDisplay.classList.contains('win') && !this.resultDisplay.classList.contains('loss')) {
                 this.resultDisplay.textContent = this.app.getTrans('dice_press');
             }
        }
    }

    async play() {
        if (this.isPlaying) return;
        if (this.app.user.balance < this.bet) return this.app.notify('Please deposit funds!', 'error');

        this.isPlaying = true;
        this.resultDisplay.textContent = this.app.getTrans('dice_rolling');
        this.resultDisplay.className = 'game-result';
        this.rollButton.classList.add('disabled');
        this.rollButton.disabled = true;
        this.betInput.disabled = true;

        const visualBalance = this.app.user.balance - this.bet;
        this.balanceDisplay.textContent = visualBalance.toLocaleString();

        try {
            const result = await this.app.apiCall('game/dice', 'POST', { bet: this.bet });
            if (!result || !result.success) throw new Error(result?.error || 'Error');

            this.playAnimation(`dice${result.roll}`, false);
            await new Promise(r => setTimeout(r, 2000));

            this.app.user.balance = result.balance;
            this.app.user.totalBets = result.userStats.total_bets;
            this.app.user.totalWins = result.userStats.total_wins;
            this.app.user.totalWagered = result.userStats.total_wagered;
            
            localStorage.setItem('ruby_user', JSON.stringify(this.app.user));
            this.updateUI();
            this.app.updateUserUI();

            if (result.won) {
                this.resultDisplay.textContent = `${this.app.getTrans('dice_won')} ${result.winAmount}`;
                this.resultDisplay.classList.add('win');
                if(this.app.haptic) this.app.haptic.notificationOccurred('success');
            } else {
                this.resultDisplay.textContent = `${this.app.getTrans('dice_lost')} ${this.bet}`;
                this.resultDisplay.classList.add('loss');
                if(this.app.haptic) this.app.haptic.notificationOccurred('error');
            }

        } catch (e) {
            this.resultDisplay.textContent = 'Error';
            this.app.notify(e.message, 'error');
            this.app.loadUserData(); 
        }
        
        this.isPlaying = false;
        this.rollButton.classList.remove('disabled');
        this.rollButton.disabled = false;
        this.betInput.disabled = false;
        this.rollButton.textContent = this.app.getTrans('dice_press');
    }
    
    playAnimation(name, loop = false) {
        if (this.anim) this.anim.destroy();
        this.lottieContainer.innerHTML = '';
        try {
            this.anim = lottie.loadAnimation({
                container: this.lottieContainer,
                renderer: 'svg',
                loop: loop,
                autoplay: true,
                path: `assets/animations/${name}.json` 
            });
        } catch (e) {}
    }
}

window.addEventListener('load', () => {
    setTimeout(() => { window.Game = new DiceGame(); }, 500);
});