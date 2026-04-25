

class MinesGame {
    constructor(app) {
        this.app = app;
        this.socket = app.socket;
        this.grid = document.getElementById('mines-grid');
        this.actionBtn = document.getElementById('mines-action-btn');
        this.betInput = document.getElementById('mines-bet-input');
        this.countDisplay = document.getElementById('mines-count-display');
        
        this.minesCount = 5; // Default
        this.isPlaying = false;
        this.soundEnabled = true;

        this.init();
    }

    init() {
        // Render 25 tiles
        this.grid.innerHTML = '';
        for (let i = 0; i < 25; i++) {
            const tile = document.createElement('div');
            tile.className = 'mine-tile';
            tile.dataset.index = i;
            tile.onclick = () => this.clickTile(i);
            this.grid.appendChild(tile);
        }

        // Bind Controls
        const decBtn = document.getElementById('mines-dec');
        const incBtn = document.getElementById('mines-inc');
        
        // Clone to prevent duplicate listeners if game re-inited
        const newDec = decBtn.cloneNode(true);
        decBtn.parentNode.replaceChild(newDec, decBtn);
        newDec.onclick = () => this.setMines(-1);

        const newInc = incBtn.cloneNode(true);
        incBtn.parentNode.replaceChild(newInc, incBtn);
        newInc.onclick = () => this.setMines(1);

        const newAction = this.actionBtn.cloneNode(true);
        this.actionBtn.parentNode.replaceChild(newAction, this.actionBtn);
        this.actionBtn = newAction; // Update reference
        this.actionBtn.onclick = () => this.handleAction();
        
        this.setupSocket();
        this.resetGrid();
        
        // Force display sync
        this.countDisplay.textContent = this.minesCount;


        if(this.socket) {
            this.socket.emit('minesAction', { type: 'restore' });
        }
    }

    setupSocket() {
        this.socket.off('minesState'); 
        this.socket.on('minesState', (data) => {
            
            if (data.type === 'error') {
                this.app.notify(data.message, 'error');
                return;
            }


            if (data.type === 'restore') {
                if(data.active) {
                    this.isPlaying = true;
                    this.minesCount = data.minesCount;
                    this.countDisplay.textContent = this.minesCount;
                    this.betInput.value = data.bet;
                    
                    // Restore Tiles (Visually)
                    data.revealed.forEach(idx => {
                        const tile = this.grid.children[idx];
                        tile.classList.add('revealed', 'gem');
                        tile.innerHTML = '<img src="assets/gem-mine.png" class="gem-icon">';
                    });

                    // Update UI Button with Profit
                    if (data.profit > 0) {
                        this.actionBtn.textContent = `${this.app.getTrans('mines_won')} ${data.profit}`;
                    }
                    this.updateUIState();
                }
                return;
            }


            if (data.type === 'start') {
                this.isPlaying = true;
                this.updateUIState();
                this.app.user.balance = data.balance;
                this.app.updateUserUI();
            } 
            else if (data.type === 'reveal') {
                this.revealTile(data.index, data.isGem);
                // Update button text with current profit
                this.actionBtn.textContent = `${this.app.getTrans('mines_won')} ${data.profit}`;
                if (data.balance) {
                    this.app.user.balance = data.balance;
                    this.app.updateUserUI();
                }
            } 
            else if (data.type === 'gameover') {
                this.isPlaying = false;
                this.revealAll(data.mines);
                this.updateUIState();
                
                if (data.win) {
                    this.app.notify(`${this.app.getTrans('mines_won')} ${data.profit}`, 'success');
                    if(this.app.haptic) this.app.haptic.notificationOccurred('success');
                } else {
                    this.app.notify(this.app.getTrans('dice_lost'), 'error');
                    if(this.app.haptic) this.app.haptic.notificationOccurred('error');
                }
                
                this.app.user.balance = data.balance !== undefined ? data.balance : this.app.user.balance;
                this.app.updateUserUI();
            }
        });
    }

     setMines(delta) {
        if (this.isPlaying) return;
        let newCount = this.minesCount + delta;
        if (newCount < 5) newCount = 5; // Min 1
        if (newCount > 24) newCount = 24;
        this.minesCount = newCount;
        this.countDisplay.textContent = this.minesCount;
    }


    handleAction() {
        if (this.isPlaying) {
            // Cashout
            this.socket.emit('minesAction', { type: 'cashout' });
        } else {
            // Start
            const bet = parseInt(this.betInput.value);
            if (!bet || bet <= 0) return this.app.notify('Invalid bet', 'error');
            if (bet > this.app.user.balance) return this.app.notify('Insufficient funds', 'error');
            
            this.resetGrid();
            this.socket.emit('minesAction', { type: 'create', bet, mines: this.minesCount });
        }
    }

    clickTile(index) {
        if (!this.isPlaying) return;
        const tile = this.grid.children[index];
        if (tile.classList.contains('revealed')) return;
        
        this.socket.emit('minesAction', { type: 'click', index });
    }

    revealTile(index, isGem) {
        const tile = this.grid.children[index];
        tile.classList.add('revealed');
        if (isGem) {
            tile.classList.add('gem');

            tile.innerHTML = '<img src="assets/gem-mine.png" class="gem-icon">';
            if(this.soundEnabled) new Audio('assets/sounds/tile_open.mp3').play().catch(()=>{});
        } else {
            tile.classList.add('bomb');

            tile.innerHTML = '<img src="assets/bomb-mine.png" class="bomb-icon">';
        }
    }

    revealAll(mineIndices) {
        // Show all bombs
        mineIndices.forEach(idx => {
            const tile = this.grid.children[idx];
            if (!tile.classList.contains('revealed')) {
                tile.classList.add('revealed', 'bomb', 'dimmed');
                tile.innerHTML = '<img src="assets/bomb-mine.png" class="bomb-icon">';
            }
        });
        // Dim unclicked gems
        Array.from(this.grid.children).forEach(tile => {
            if (!tile.classList.contains('revealed')) {
                tile.classList.add('revealed', 'gem', 'dimmed');
                tile.innerHTML = '<img src="assets/gem-mine.png" class="gem-icon">';
            }
        });
    }

    resetGrid() {
        Array.from(this.grid.children).forEach(tile => {
            tile.className = 'mine-tile';
            tile.classList.remove('revealed', 'gem', 'bomb', 'dimmed');
            tile.innerHTML = '';
        });
        this.updateUIState();
    }

    updateUIState() {
        if (this.isPlaying) {
            this.actionBtn.textContent = this.app.getTrans('rocket_cashout');
            this.actionBtn.classList.add('cashout-mode');
            this.betInput.disabled = true;
        } else {
            this.actionBtn.textContent = this.app.getTrans('playBtn');
            this.actionBtn.classList.remove('cashout-mode');
            this.betInput.disabled = false;
        }

        if (this.app.user) {
             document.getElementById('mines-balance').textContent = this.app.user.balance.toLocaleString();
        }
    }
}