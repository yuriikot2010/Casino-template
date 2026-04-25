class RocketGame {
    constructor(app) {
        this.app = app;
        this.socket = null;
        this.canvas = document.getElementById('rocketCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        this.data = {
            status: 'disconnected',
            multiplier: 1.00,
            playerBet: null,
            history: []
        };
        
        this.stars = Array(50).fill().map(() => ({
            x: Math.random() * 800,
            y: Math.random() * 600,
            s: Math.random() * 2,
            a: Math.random()
        }));

        this.init();
        this.lastBetsHash = '';
    }

    init() {
         const rocketInput = document.getElementById('betRocket');
        if (rocketInput) {
            rocketInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) this.data.playerBet = null; 
            });
        }
        if (typeof io !== 'undefined') {
            if (this.app.socket && this.app.socket.connected) {
                this.socket = this.app.socket;
                this.setupSocketEvents();
            } else {
                this.socket = io({ 
                    auth: { token: localStorage.getItem('ruby_token') },
                    transports: ['websocket'] 
                });
                this.setupSocketEvents();
            }
        }

        const bindBtn = (id, fn) => {
            const old = document.getElementById(id);
            if(old) {
                const nue = old.cloneNode(true);
                old.parentNode.replaceChild(nue, old);
                nue.addEventListener('click', fn);
            }
        };

        bindBtn('rocketBetBtn', () => this.placeBet());
        bindBtn('rocketCashoutBtn', () => this.cashout());

        this.draw();
    }

    setupSocketEvents() {
        this.socket.on('rocketState', (data) => {
            this.data.status = data.status;
            this.renderBetsList(data.bets);

            if (data.status === 'waiting') {
                this.updateStatus(this.app.getTrans('rocket_wait'));
                this.data.multiplier = 1.00;
                this.resetUI();
            } 
            else if (data.status === 'starting') {
                this.updateStatus(`${this.app.getTrans('rocket_launch')} ${Math.floor(data.timeLeft)}s`);
                this.data.multiplier = 1.00;
                this.resetUI();
            }
            else if (data.status === 'running') {
                this.data.multiplier = data.multiplier;
                this.updateStatus(this.app.getTrans('rocket_fly'));
                this.updateMultiplierDisplay(data.multiplier);
                
                if (this.data.playerBet) {
                    const currentWin = Math.floor(this.data.playerBet * data.multiplier);
                    document.getElementById('rocketCashoutAmount').textContent = currentWin.toLocaleString();
                    document.getElementById('rocketBetBtn').classList.add('hidden');
                    document.getElementById('rocketCashoutBtn').classList.remove('hidden');
                    
                    // Update button text with translation
                    const btn = document.getElementById('rocketCashoutBtn');
                    // We need to preserve the span with the amount
                    btn.childNodes[0].nodeValue = this.app.getTrans('rocket_cashout') + ' '; 
                }
            } 
            else if (data.status === 'crashed') {
                this.data.multiplier = data.crashPoint;
                this.updateStatus(this.app.getTrans('rocket_crash'));
                this.updateMultiplierDisplay(data.crashPoint, true);
                
                document.getElementById('rocketCashoutBtn').classList.add('hidden');
                const btn = document.getElementById('rocketBetBtn');
                btn.classList.remove('hidden');
                btn.disabled = false;
                btn.textContent = this.app.getTrans('rocket_bet');
                
                if (this.data.playerBet) this.data.playerBet = null;
                this.addHistory(data.crashPoint);
            }
        });

        this.socket.on('betResult', (res) => {
            if (res.error) {
                this.app.notify(res.error,'error');
                const btn = document.getElementById('rocketBetBtn');
                btn.disabled = false;
                btn.textContent = this.app.getTrans('rocket_bet');
            } else {
                this.data.playerBet = parseInt(document.getElementById('betRocket').value);
                this.app.user.balance = res.newBalance;
                this.app.updateUserUI();
                
                const btn = document.getElementById('rocketBetBtn');
                btn.textContent = this.app.getTrans('rocket_placed');
                btn.disabled = true;
            }
        });

        this.socket.on('cashoutResult', (res) => {
            if (res.success) {
                this.data.playerBet = null;
                this.app.user.balance = res.newBalance;
                this.app.updateUserUI();
                if(this.app.haptic) this.app.haptic.notificationOccurred('success');
                document.getElementById('rocketCashoutBtn').classList.add('hidden');
            }
        });
    }

    renderBetsList(bets) {
        if (!bets) return;
        const sortedBets = [...bets].sort((a, b) => {
            if (a.cashedOut !== b.cashedOut) return a.cashedOut ? 1 : -1;
            return b.bet - a.bet;
        });

        const currentHash = JSON.stringify(sortedBets);
        if (currentHash === this.lastBetsHash) return; 
        this.lastBetsHash = currentHash;

        const list = document.getElementById('rocketBetsList');
        document.getElementById('total-round-bets').textContent = `${sortedBets.length} Players`;
        
        let html = '';
        sortedBets.forEach(b => {
            const isMe = b.userId === this.app.user.id;
            const statusClass = b.cashedOut ? 'cashed-out' : (this.data.status === 'crashed' ? 'lost' : '');
            

            const avatarSrc = b.avatar || 'assets/default_avatar.png'; // Make sure this exists or use fontawesome
            const avatarHtml = b.avatar 
                ? `<img src="${b.avatar}">` 
                : `<div class="profile-avatar" style="width:24px;height:24px;font-size:12px;border:none"><i class="fas fa-user"></i></div>`;

            let statusText = '-';
            if (b.cashedOut) statusText = `<span style="color:#00cc88">${b.multiplier.toFixed(2)}x (+${b.profit})</span>`;
            else if (this.data.status === 'crashed') statusText = `<span style="color:#ff3355">${this.app.getTrans('rocket_crash')}</span>`;
            else statusText = this.app.getTrans('rocket_fly');

            html += `
            <div class="bet-row ${statusClass}" ${isMe ? 'style="border:1px solid #ff3366; background:rgba(255,51,102,0.1)"' : ''}>
                <div class="bet-user">
                    ${avatarHtml}
                    <span>${b.username ? b.username.substring(0, 10) : 'User'}</span>
                </div>
                <div class="bet-amount">${b.bet.toLocaleString()}</div>
                <div class="bet-cashout">${statusText}</div>
            </div>`;
        });
        list.innerHTML = html;
    }

    placeBet() {
        if (!this.socket.connected) return this.app.notify("Disconnected!",'error');
        const input = document.getElementById('betRocket');
        let rawValue = input.value.replace(/,/g, '.');
        const amount = parseInt(rawValue);
        if(!amount || amount < 10) return this.app.notify("Min bet 10",'error');
        
        this.socket.emit('rocketBet', { amount });
        const btn = document.getElementById('rocketBetBtn');
        btn.disabled = true;
        btn.textContent = "SENDING...";
    }

    cashout() { this.socket.emit('rocketCashout'); }

    resetUI() {
        document.getElementById('rocketMultiplier').textContent = '1.00x';
        document.getElementById('rocketMultiplier').classList.remove('crashed-text');
        if (!this.data.playerBet) {
            const btn = document.getElementById('rocketBetBtn');
            btn.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = this.app.getTrans('rocket_bet');
            document.getElementById('rocketCashoutBtn').classList.add('hidden');
        }
    }

    updateStatus(text) { document.getElementById('rocketStatus').textContent = text; }

    updateMultiplierDisplay(val, crashed = false) {
        const el = document.getElementById('rocketMultiplier');
        el.textContent = `${val.toFixed(2)}x`;
        if(crashed) el.classList.add('crashed-text');
        else el.classList.remove('crashed-text');
    }

    addHistory(mult) {
        const container = document.getElementById('rocketHistoryItems');
        const div = document.createElement('div');
        let type = 'low';
        if(mult >= 2) type = 'medium';
        if(mult >= 10) type = 'high';
        
        div.className = `history-bubble ${type}`;
        div.textContent = `${mult.toFixed(2)}x`;
        container.prepend(div);
        if(container.children.length > 20) container.lastChild.remove();
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        const container = this.canvas.parentElement;
        if (this.canvas.width !== container.clientWidth || this.canvas.height !== container.clientHeight) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        }
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, w, h);
        this.drawStars(ctx, w, h);
        this.drawGrid(ctx, w, h);
        if (this.data.status === 'running' || this.data.status === 'crashed') {
            this.drawTrajectory(ctx, w, h, this.data.multiplier);
            if (this.data.status === 'running') this.drawFancyRocket(ctx, w, h, this.data.multiplier);
            else this.drawExplosion(ctx, w, h, this.data.multiplier);
        } else {
            this.drawFancyRocket(ctx, w, h, 1.0, true);
        }
        this.animId = requestAnimationFrame(() => this.draw());
    }

    drawStars(ctx, w, h) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        this.stars.forEach(star => {
            if(this.data.status === 'running') star.x -= (star.s * 0.5);
            if(star.x < 0) star.x = w;
            ctx.globalAlpha = star.a;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.s, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;
    }

    drawGrid(ctx, w, h) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
        ctx.lineWidth = 1;
        const step = 60;
        for (let x = 0; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }

    drawTrajectory(ctx, w, h, mult) {
        const progress = Math.min((mult - 1) / 8, 1);
        const startX = w * 0.1;
        const startY = h * 0.9;
        const endX = startX + (w * 0.8 * progress);
        const endY = startY - (h * 0.8 * progress);
        const cp1X = startX + (w * 0.2 * progress);
        const cp1Y = startY; 
        const cp2X = endX - (w * 0.1 * progress);
        const cp2Y = endY;
        const grad = ctx.createLinearGradient(startX, startY, endX, endY);
        grad.addColorStop(0, "rgba(51, 102, 255, 0)");
        grad.addColorStop(1, "#3366ff");
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
        ctx.lineWidth = 4;
        ctx.strokeStyle = grad;
        ctx.stroke();
        ctx.lineTo(endX, h);
        ctx.lineTo(startX, h);
        ctx.closePath();
        ctx.fillStyle = "rgba(51, 102, 255, 0.05)";
        ctx.fill();
        return { x: endX, y: endY };
    }

    drawFancyRocket(ctx, w, h, mult, isIdle = false) {
        const progress = Math.min((mult - 1) / 8, 1);
        let x, y, rot;
        if (isIdle) {
            x = w * 0.1;
            y = h * 0.9;
            rot = -45 * Math.PI / 180;
        } else {
            x = (w * 0.1) + (w * 0.8 * progress);
            y = (h * 0.9) - (h * 0.8 * progress);
            const dy = -0.8; 
            const dx = 0.8;
            rot = (-10 - (35 * progress)) * Math.PI / 180; 
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#3366ff";
        if (!isIdle) {
            const flicker = Math.random() * 5;
            ctx.fillStyle = "#ffaa00";
            ctx.beginPath();
            ctx.moveTo(-15, -5);
            ctx.lineTo(-30 - flicker, 0); 
            ctx.lineTo(-15, 5);
            ctx.fill();
            ctx.fillStyle = "#ff3355"; 
            ctx.beginPath();
            ctx.moveTo(-15, -2);
            ctx.lineTo(-22 - flicker, 0);
            ctx.lineTo(-15, 2);
            ctx.fill();
        }
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3366ff";
        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.lineTo(-18, -12);
        ctx.lineTo(-5, -5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-10, 5);
        ctx.lineTo(-18, 12);
        ctx.lineTo(-5, 5);
        ctx.fill();
        ctx.fillStyle = "#0b0b0f";
        ctx.beginPath();
        ctx.arc(8, -2, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    drawExplosion(ctx, w, h, mult) {
        const progress = Math.min((mult - 1) / 8, 1);
        const x = (w * 0.1) + (w * 0.8 * progress);
        const y = (h * 0.9) - (h * 0.8 * progress);
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("💥", x, y);
    }
}