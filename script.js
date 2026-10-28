const canvas = document.getElementById('arcadeCanvas');
const ctx = canvas.getContext('2d');
const infoText = document.getElementById('info-text');
const btnRestart = document.getElementById('btn-restart');
const homeStats = document.getElementById('home-stats');
const canvasContainer = document.querySelector('.canvas-container');
const statsStorageKey = 'arcadeGameStats';
const gameStats = loadGameStats();

function loadGameStats() {
    const defaults = {
        cookie: { highScore: 0, played: 0, deaths: 0 },
        flappy: { highScore: 0, played: 0, deaths: 0 },
        parkour: { highScore: 0, played: 0, deaths: 0 }
    };
    try {
        const saved = JSON.parse(localStorage.getItem(statsStorageKey));
        Object.keys(defaults).forEach(game => {
            if (saved && saved[game]) {
                defaults[game].highScore = Number(saved[game].highScore) || 0;
                defaults[game].played = Number(saved[game].played) || 0;
                defaults[game].deaths = Number(saved[game].deaths) || 0;
            }
        });
    } catch (error) {
        // Keep default statistics when browser storage is unavailable or invalid.
    }
    return defaults;
}

function saveGameStats() {
    try {
        localStorage.setItem(statsStorageKey, JSON.stringify(gameStats));
    } catch (error) {
        // Statistics remain available for the current page session.
    }
}

function renderGameStats() {
    Object.keys(gameStats).forEach(game => {
        document.getElementById(`high-${game}`).textContent = gameStats[game].highScore;
        document.getElementById(`played-${game}`).textContent = gameStats[game].played;
        document.getElementById(`deaths-${game}`).textContent = gameStats[game].deaths;
    });
}

function startGameSession(gameName) {
    if (!gameStats[gameName]) return;
    gameStats[gameName].played++;
    saveGameStats();
    renderGameStats();
}

renderGameStats();

// System States
let currentGame = 'menu';
let score = 0;
let gameOver = false;
let birdDying = false;
let bombExplosion = null;
let gameAudioContext = null;

// Shared Input Controls
let mouseX = canvas.width / 2;

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        triggerJump();
    }
});
canvas.addEventListener('mousedown', (e) => {
    triggerJump();
});

function triggerJump() {
    if (gameOver) return;
    if (currentGame === 'flappy') {
        if (birdDying) return;
        bird.velocity = bird.jump;
    }
    if (currentGame === 'parkour') playerParkour.jump();
}

function prepareGameAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!gameAudioContext) gameAudioContext = new AudioContextClass();
    if (gameAudioContext.state === 'suspended') gameAudioContext.resume();
}

function playPointSound() {
    prepareGameAudio();
    if (!gameAudioContext) return;

    const oscillator = gameAudioContext.createOscillator();
    const volume = gameAudioContext.createGain();
    const now = gameAudioContext.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, now);
    oscillator.frequency.exponentialRampToValueAtTime(990, now + 0.09);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(volume);
    volume.connect(gameAudioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.16);
}

function playGameOverSound() {
    prepareGameAudio();
    if (!gameAudioContext) return;

    const oscillator = gameAudioContext.createOscillator();
    const volume = gameAudioContext.createGain();
    const now = gameAudioContext.currentTime;

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(440, now);
    oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.45);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    oscillator.connect(volume);
    volume.connect(gameAudioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.5);
}

function finishGame() {
    if (gameOver) return;
    gameOver = true;
    if (gameStats[currentGame]) {
        gameStats[currentGame].deaths++;
        gameStats[currentGame].highScore = Math.max(gameStats[currentGame].highScore, score);
        saveGameStats();
        renderGameStats();
    }
    btnRestart.style.display = 'inline-block';
    canvas.style.cursor = 'default';
    playGameOverSound();
}

// --- DATA GAME 1: TANGKAP KUE & BOM ---
const basket = { x: 160, y: 460, width: 80, height: 15, color: '#e67e22' };
const cake = { x: 200, y: 0, radius: 14, speed: 4, color: '#ff3366' };
const bomb = { x: 100, y: -200, radius: 10, speed: 5, color: '#111111' }; // OBJEK BARU: BOM

// --- DATA GAME 2: FLAPPY BIRD ---
const bird = { x: 50, y: 200, radius: 12, gravity: 0.4, velocity: 0, jump: -6.5, color: '#ffcc00' };
let pipes = [];
let pipeFrameCount = 0;

// --- DATA GAME 3: WALL PARKOUR ---
const playerParkour = {
    x: 20, y: 440, radius: 12, side: 'left',
    vy: 0, gravity: 0.5, isJumping: false, color: '#00ffcc',
    jumpStartX: 20, jumpTargetX: 20, jumpProgress: 0,
    jump: function() {
        if (!this.isJumping) {
            this.vy = -5;
            this.isJumping = true;
            this.jumpStartX = this.x;
            this.side = this.side === 'left' ? 'right' : 'left';
            this.jumpTargetX = this.side === 'left' ? 20 : canvas.width - 20;
            this.jumpProgress = 0;
            if (currentGame === 'parkour' && !gameOver) {
                score++;
                playPointSound();
            }
        }
    }
};
let obstacles = [];
let obstacleFrameCount = 0;

// --- LOGIKA UTAMA SWITCH GAME ---
function switchGame(gameName) {
    prepareGameAudio();
    currentGame = gameName;
    resetGameEngine();
    canvasContainer.classList.toggle('menu-screen', gameName === 'menu');
    homeStats.style.display = gameName === 'menu' ? 'block' : 'none';
    if (gameName !== 'menu') startGameSession(gameName);
    
    document.querySelectorAll('.btn-menu').forEach(btn => btn.classList.remove('active'));
    
    if (gameName === 'menu') {
        infoText.innerText = "Pilih salah satu game di atas untuk mulai bermain!";
        canvas.style.cursor = 'default';
    } else if (gameName === 'cookie') {
        infoText.innerText = "Tangkap Kue: Ambil Kue, HINDARI Bom (Hitam)!";
        canvas.style.cursor = 'none';
    } else if (gameName === 'flappy') {
        infoText.innerText = "Flappy Bird: Hindari pipa hijau";
        canvas.style.cursor = 'pointer';
    } else if (gameName === 'parkour') {
        infoText.innerText = "Wall Parkour: Hindari duri di dinding!";
        canvas.style.cursor = 'pointer';
    }
}

function resetGameEngine() {
    score = 0;
    gameOver = false;
    birdDying = false;
    bombExplosion = null;
    btnRestart.style.display = 'none';
    
    // Reset Cookie & Bomb
    cake.y = 0; cake.x = Math.random() * (canvas.width - 40) + 20; cake.speed = 4;
    bomb.y = -150; bomb.x = Math.random() * (canvas.width - 40) + 20; bomb.speed = 4.5;
    
    // Reset Flappy
    bird.y = 200; bird.velocity = 0; pipes = []; pipeFrameCount = 0;
    
    // Reset Parkour
    playerParkour.y = 440; playerParkour.vy = 0; playerParkour.side = 'left'; playerParkour.x = 20; playerParkour.isJumping = false;
    playerParkour.jumpStartX = 20; playerParkour.jumpTargetX = 20; playerParkour.jumpProgress = 0;
    obstacles = []; obstacleFrameCount = 0;
}

// --- ENGINE UPDATE ---
function update() {
    if (gameOver || currentGame === 'menu') return;

    if (currentGame === 'cookie' && bombExplosion) {
        bombExplosion.frame++;
        if (bombExplosion.frame >= 42) {
            finishGame();
        }
        return;
    }

    // Let the bird fall briefly after a collision before showing Game Over.
    if (currentGame === 'flappy' && birdDying) {
        bird.velocity += bird.gravity;
        bird.y += bird.velocity;
        if (bird.y - bird.radius > canvas.height) {
            finishGame();
        }
        return;
    }

    // --- LOGIKA UPDATE: COOKIE ---
    if (currentGame === 'cookie') {
        basket.x = mouseX - basket.width / 2;
        if (basket.x < 0) basket.x = 0;
        if (basket.x > canvas.width - basket.width) basket.x = canvas.width - basket.width;

        // Gerak kue
        cake.y += cake.speed;
        if (cake.y >= basket.y && cake.x >= basket.x && cake.x <= basket.x + basket.width) {
            score++;
            playPointSound();
            cake.y = 0; cake.x = Math.random() * (canvas.width - 40) + 20;
            cake.speed = 4 + Math.floor(score / 5);
        }
        if (cake.y > canvas.height) { cake.y = 0; cake.x = Math.random() * (canvas.width - 40) + 20; }

        // Gerak bom
        bomb.y += bomb.speed;
        if (bomb.y >= basket.y && bomb.x >= basket.x && bomb.x <= basket.x + basket.width) {
            bombExplosion = { x: bomb.x, y: basket.y - 12, frame: 0 };
        }
        if (bomb.y > canvas.height) {
            bomb.y = -50; 
            bomb.x = Math.random() * (canvas.width - 40) + 20;
            bomb.speed = 4.5 + Math.floor(score / 5);
        }

    // --- LOGIKA UPDATE: FLAPPY ---
    } else if (currentGame === 'flappy') {
        bird.velocity += bird.gravity;
        bird.y += bird.velocity;
        
        if (bird.y + bird.radius > canvas.height || bird.y - bird.radius < 0) triggerGameOver();

        pipeFrameCount++;
        // Spawn Pipa secara berkala
        if (pipeFrameCount % 90 === 0) {
            let gap = 130;
            let topHeight = Math.random() * (canvas.height - gap - 150) + 50;
            pipes.push({ x: canvas.width, top: topHeight, bottom: canvas.height - topHeight - gap, passed: false });
        }

        // Jalankan & cek pipa
        pipes.forEach(p => {
            p.x -= 3;
            if (!p.passed && p.x < bird.x) {
                score++;
                playPointSound();
                p.passed = true;
            }
            if (bird.x + bird.radius > p.x && bird.x - bird.radius < p.x + 50) {
                if (bird.y - bird.radius < p.top || bird.y + bird.radius > canvas.height - p.bottom) triggerGameOver();
            }
        });
        pipes = pipes.filter(p => p.x > -50);

    // --- LOGIKA UPDATE: PARKOUR ---
    } else if (currentGame === 'parkour') {
        playerParkour.vy += playerParkour.gravity;
        playerParkour.y += playerParkour.vy;
        if (playerParkour.isJumping) {
            playerParkour.jumpProgress = Math.min(1, playerParkour.jumpProgress + 0.1);
            const easedProgress = playerParkour.jumpProgress * playerParkour.jumpProgress * (3 - 2 * playerParkour.jumpProgress);
            playerParkour.x = playerParkour.jumpStartX + (playerParkour.jumpTargetX - playerParkour.jumpStartX) * easedProgress;
        }

        if (playerParkour.y >= 440) { playerParkour.y = 440; playerParkour.vy = 0; playerParkour.isJumping = false; playerParkour.x = playerParkour.jumpTargetX; }

        obstacleFrameCount++;
        // Spawn duri dinding
        if (obstacleFrameCount % 60 === 0) {
            let side = Math.random() > 0.5 ? 'left' : 'right';
            obstacles.push({ x: side === 'left' ? 0 : canvas.width - 30, y: 0, width: 30, height: 20, side: side });
        }

        // Cek rintangan dinding
        obstacles.forEach(o => {
            o.y += 4;
            if (o.y + o.height > playerParkour.y - playerParkour.radius && o.y < playerParkour.y + playerParkour.radius) {
                if (o.side === playerParkour.side) triggerGameOver();
            }
        });
        obstacles = obstacles.filter(o => o.y < canvas.height);
    }
}

// --- ENGINE DRAW ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentGame === 'menu') {
        ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 24px Segoe UI'; ctx.textAlign = 'center';
        ctx.fillText('SILAKAN PILIH GAME', canvas.width / 2, canvas.height / 2);
        return;
    }

    if (gameOver) {
        ctx.fillStyle = '#ff3366'; ctx.font = 'bold 32px Segoe UI'; ctx.textAlign = 'center';
        ctx.fillText('GAME OVER 💀', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#fff'; ctx.font = '20px Segoe UI';
        ctx.fillText('Skor Akhir: ' + score, canvas.width / 2, canvas.height / 2 + 20);
        return;
    }

    // --- DRAW COOKIE ---
    if (currentGame === 'cookie') {
       // 1. Gradasi Langit Pastel
        let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        skyGrad.addColorStop(0, '#ffc6ff');
        skyGrad.addColorStop(0.5, '#ffd6ff');
        skyGrad.addColorStop(1, '#e7c6ff');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Awan 1 (Kiri Atas)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(70, 80, 20, 0, Math.PI * 2);
        ctx.arc(95, 70, 28, 0, Math.PI * 2);
        ctx.arc(120, 80, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        // Awan 2 (Kanan Atas)
        ctx.beginPath();
        ctx.arc(canvas.width - 100, 110, 18, 0, Math.PI * 2);
        ctx.arc(canvas.width - 75, 98, 24, 0, Math.PI * 2);
        ctx.arc(canvas.width - 50, 110, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        // 2. Lapisan bukit krim dengan gradasi lembut
        const backCakeGrad = ctx.createLinearGradient(0, canvas.height - 220, 0, canvas.height);
        backCakeGrad.addColorStop(0, '#ffe0e8');
        backCakeGrad.addColorStop(0.55, '#f7a9bd');
        backCakeGrad.addColorStop(1, '#d97891');
        ctx.fillStyle = backCakeGrad;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        ctx.lineTo(0, canvas.height - 150);
        ctx.bezierCurveTo(canvas.width / 3, canvas.height - 220, (canvas.width / 3) * 2, canvas.height - 100, canvas.width, canvas.height - 180);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.fill();
        ctx.closePath();

        // 3. Lapisan kue depan dengan gradasi dan tekstur remah
        const frontCakeGrad = ctx.createLinearGradient(0, canvas.height - 130, 0, canvas.height);
        frontCakeGrad.addColorStop(0, '#ffb0c1');
        frontCakeGrad.addColorStop(0.35, '#ee7895');
        frontCakeGrad.addColorStop(1, '#c94f72');
        ctx.fillStyle = frontCakeGrad;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        ctx.lineTo(0, canvas.height - 80);
        ctx.bezierCurveTo(canvas.width / 4, canvas.height - 130, (canvas.width / 4) * 3, canvas.height - 40, canvas.width, canvas.height - 90);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.fill();
        ctx.closePath();

        // Sedikit tekstur pada sisi kue
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#8e3c58';
        [[30, 455, 18, 2], [82, 477, 12, 2], [145, 452, 16, 2], [225, 480, 20, 2], [305, 455, 14, 2], [365, 478, 16, 2]].forEach(([x, y, w, h]) => {
            ctx.beginPath();
            ctx.ellipse(x, y, w / 2, h, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        // Lapisan krim putih dengan gradasi dan kilau lembut
        const frostingGrad = ctx.createLinearGradient(0, 385, 0, 455);
        frostingGrad.addColorStop(0, '#ffffff');
        frostingGrad.addColorStop(0.45, '#fff6f2');
        frostingGrad.addColorStop(1, '#e9b9c8');
        ctx.fillStyle = frostingGrad;
        ctx.beginPath();
        ctx.moveTo(0, 405);
        ctx.bezierCurveTo(90, 385, 145, 425, 220, 405);
        ctx.bezierCurveTo(290, 385, 340, 425, canvas.width, 400);
        ctx.lineTo(canvas.width, 420);
        ctx.quadraticCurveTo(375, 438, 365, 420);
        ctx.quadraticCurveTo(350, 455, 335, 420);
        ctx.quadraticCurveTo(250, 438, 235, 418);
        ctx.quadraticCurveTo(220, 452, 205, 418);
        ctx.quadraticCurveTo(105, 438, 90, 416);
        ctx.quadraticCurveTo(75, 448, 60, 414);
        ctx.quadraticCurveTo(25, 426, 0, 420);
        ctx.closePath();
        ctx.fill();

        // Permen warna-warni menghiasi tanah kue
        const gumdrops = [
            { x: 35, y: 450, color: '#ff477e' }, { x: 105, y: 465, color: '#ffd166' },
            { x: 180, y: 448, color: '#06d6a0' }, { x: 270, y: 465, color: '#7b61ff' },
            { x: 350, y: 445, color: '#ff9f1c' }
        ];
        gumdrops.forEach(candy => {
            ctx.beginPath();
            ctx.ellipse(candy.x, candy.y, 10, 14, 0, Math.PI, Math.PI * 2);
            ctx.fillStyle = candy.color;
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(candy.x - 3, candy.y - 8, 2, 4, -0.4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fill();
        });

        // 4. --- CANDY CANE (PERMEN TONGKAT NATAL) KIRI ---
        ctx.save();
        ctx.translate(40, 160); // Posisi permen tongkat kiri
        // Batang utama putih (melengkung)
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, 80);
        ctx.lineTo(0, 15);
        ctx.arc(10, 15, 10, Math.PI, 0, false);
        ctx.stroke();
        // Garis-garis belang merah
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-5, 70); ctx.lineTo(5, 60);
        ctx.moveTo(-5, 50); ctx.lineTo(5, 40);
        ctx.moveTo(-5, 30); ctx.lineTo(5, 20);
        ctx.stroke();
        ctx.restore();

        // 5. --- CANDY CANE (PERMEN TONGKAT NATAL) KANAN ---
        ctx.save();
        ctx.translate(canvas.width - 50, 110); // Posisi permen tongkat kanan
        // Batang utama putih (melengkung)
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, 80);
        ctx.lineTo(0, 15);
        ctx.arc(10, 15, 10, Math.PI, 0, false);
        ctx.stroke();
        // Garis-garis belang merah
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-5, 70); ctx.lineTo(5, 60);
        ctx.moveTo(-5, 50); ctx.lineTo(5, 40);
        ctx.moveTo(-5, 30); ctx.lineTo(5, 20);
        ctx.stroke();
        ctx.restore();
        // 6. Taburan Meses (Sprinkles) di Udara
        const sprinkles = [
            {x: 80, y: 50, color: '#ffb703'}, {x: 150, y: 90, color: '#fb8500'},
            {x: 230, y: 60, color: '#8ecae6'}, {x: 50, y: 240, color: '#219ebc'},
            {x: 270, y: 220, color: '#ff0054'}, {x: 180, y: 300, color: '#ffb703'}
        ];
        sprinkles.forEach(s => {
            ctx.fillStyle = s.color;
            ctx.fillRect(s.x, s.y, 10, 4);
        });
        // Woven wicker basket with a shaded, elliptical rim.
        const basketTop = basket.y - 11;
        const basketBottom = basket.y + 17;
        const basketBody = ctx.createLinearGradient(basket.x, basketTop, basket.x + basket.width, basketTop);
        basketBody.addColorStop(0, '#75401f');
        basketBody.addColorStop(0.2, '#c17b38');
        basketBody.addColorStop(0.48, '#e0a45b');
        basketBody.addColorStop(0.78, '#b66c30');
        basketBody.addColorStop(1, '#683719');

        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#603847';
        ctx.beginPath();
        ctx.ellipse(basket.x + basket.width / 2, basketBottom + 2, basket.width * 0.52, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Dark interior behind the basket walls.
        ctx.fillStyle = '#613718';
        ctx.beginPath();
        ctx.ellipse(basket.x + basket.width / 2, basketTop + 2, basket.width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(basket.x + 2, basketTop);
        ctx.lineTo(basket.x + basket.width - 2, basketTop);
        ctx.lineTo(basket.x + basket.width - 10, basketBottom);
        ctx.quadraticCurveTo(basket.x + basket.width / 2, basketBottom + 5, basket.x + 10, basketBottom);
        ctx.closePath();
        ctx.fillStyle = basketBody;
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(basket.x + 2, basketTop);
        ctx.lineTo(basket.x + basket.width - 2, basketTop);
        ctx.lineTo(basket.x + basket.width - 10, basketBottom);
        ctx.quadraticCurveTo(basket.x + basket.width / 2, basketBottom + 5, basket.x + 10, basketBottom);
        ctx.closePath();
        ctx.clip();

        // Crosshatched strips suggest tightly woven wicker.
        for (let row = basketTop + 5; row < basketBottom + 5; row += 7) {
            ctx.strokeStyle = 'rgba(255, 218, 151, 0.62)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(basket.x - 2, row);
            ctx.quadraticCurveTo(basket.x + basket.width / 2, row + 3, basket.x + basket.width + 2, row);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(91, 45, 20, 0.55)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(basket.x + 12, row - 3);
            ctx.lineTo(basket.x + 17, row + 5);
            ctx.moveTo(basket.x + 30, row - 3);
            ctx.lineTo(basket.x + 35, row + 5);
            ctx.moveTo(basket.x + 48, row - 3);
            ctx.lineTo(basket.x + 53, row + 5);
            ctx.moveTo(basket.x + 66, row - 3);
            ctx.lineTo(basket.x + 71, row + 5);
            ctx.stroke();
        }
        ctx.restore();

        // Thick rolled rim and a fine highlight along the front edge.
        ctx.beginPath();
        ctx.ellipse(basket.x + basket.width / 2, basketTop, basket.width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#d4934d';
        ctx.fill();
        ctx.strokeStyle = '#75401f';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(basket.x + basket.width / 2, basketTop - 1, basket.width / 2 - 4, 5, 0, Math.PI, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 226, 174, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Textured, golden-brown chocolate chip cookie
        ctx.save();
        ctx.translate(cake.x, cake.y);
        ctx.scale(cake.radius / 14, cake.radius / 14);

        ctx.beginPath();
        ctx.moveTo(-13, -3);
        ctx.bezierCurveTo(-15, -8, -9, -14, -4, -13);
        ctx.bezierCurveTo(1, -16, 5, -11, 9, -12);
        ctx.bezierCurveTo(15, -9, 15, -4, 13, 0);
        ctx.bezierCurveTo(16, 5, 10, 13, 5, 12);
        ctx.bezierCurveTo(0, 16, -5, 11, -9, 13);
        ctx.bezierCurveTo(-15, 10, -16, 3, -13, -3);
        ctx.closePath();

        const cookieGrad = ctx.createRadialGradient(-5, -6, 2, 0, 0, 18);
        cookieGrad.addColorStop(0, '#f8d99a');
        cookieGrad.addColorStop(0.65, '#d99a4e');
        cookieGrad.addColorStop(1, '#a85d2a');
        ctx.fillStyle = cookieGrad;
        ctx.shadowColor = 'rgba(83, 42, 24, 0.35)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#8b4a27';
        ctx.stroke();

        // A few uneven chocolate chunks with tiny highlights
        const chips = [
            { x: -7, y: -6, r: 2.1 }, { x: 2, y: -8, r: 1.7 },
            { x: 8, y: -2, r: 2 }, { x: -3, y: 1, r: 2.2 },
            { x: 5, y: 6, r: 1.8 }, { x: -8, y: 7, r: 1.6 },
            { x: 0, y: 9, r: 1.4 }
        ];
        chips.forEach(chip => {
            ctx.beginPath();
            ctx.ellipse(chip.x, chip.y, chip.r, chip.r * 0.75, -0.3, 0, Math.PI * 2);
            ctx.fillStyle = '#4b281d';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(chip.x - 0.4, chip.y - 0.5, chip.r * 0.28, 0, Math.PI * 2);
            ctx.fillStyle = '#8a5238';
            ctx.fill();
        });
        ctx.restore();
        // Bom bulat dengan badan logam, sumbu, dan percikan kartun
        if (!bombExplosion) {
        ctx.save();
        ctx.translate(bomb.x, bomb.y);
        ctx.strokeStyle = '#5b4636';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(1, -8);
        ctx.quadraticCurveTo(4, -14, 9, -14);
        ctx.stroke();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(10, -15, 2, 0, Math.PI * 2);
        ctx.fill();
        const bombGrad = ctx.createRadialGradient(-4, -5, 2, 1, 1, 13);
        bombGrad.addColorStop(0, '#777984');
        bombGrad.addColorStop(0.45, '#343741');
        bombGrad.addColorStop(1, '#11131a');
        ctx.fillStyle = bombGrad;
        ctx.beginPath();
        ctx.arc(0, 2, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0b0c10';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(-4, -2, 2, 4, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#777984';
        ctx.fillRect(-4, -10, 8, 4);
        ctx.restore();
        }

        if (bombExplosion) {
            const progress = bombExplosion.frame / 42;
            const radius = 8 + progress * 48;
            const fade = 1 - progress;
            ctx.save();
            ctx.globalAlpha = fade;

            const glow = ctx.createRadialGradient(bombExplosion.x, bombExplosion.y, 2, bombExplosion.x, bombExplosion.y, radius);
            glow.addColorStop(0, '#fff7ad');
            glow.addColorStop(0.35, '#ffb52e');
            glow.addColorStop(0.72, '#ff5a24');
            glow.addColorStop(1, 'rgba(180, 35, 20, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(bombExplosion.x, bombExplosion.y, radius, 0, Math.PI * 2);
            ctx.fill();

            // Jagged cartoon blast and sparks expand as the explosion fades.
            ctx.beginPath();
            for (let i = 0; i < 16; i++) {
                const angle = (Math.PI * 2 * i) / 16;
                const pointRadius = radius * (i % 2 === 0 ? 0.9 : 0.55);
                const x = bombExplosion.x + Math.cos(angle) * pointRadius;
                const y = bombExplosion.y + Math.sin(angle) * pointRadius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = '#ffcf4a';
            ctx.strokeStyle = '#f04b22';
            ctx.lineWidth = 3;
            ctx.fill();
            ctx.stroke();

            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 * i) / 8 + 0.2;
                const inner = radius * 0.75;
                const outer = radius * (1.15 + (i % 3) * 0.08);
                ctx.strokeStyle = i % 2 ? '#fff2a6' : '#ff6a2a';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(bombExplosion.x + Math.cos(angle) * inner, bombExplosion.y + Math.sin(angle) * inner);
                ctx.lineTo(bombExplosion.x + Math.cos(angle) * outer, bombExplosion.y + Math.sin(angle) * outer);
                ctx.stroke();
            }
            ctx.restore();
        }

    // --- DRAW FLAPPY ---
    } else if (currentGame === 'flappy') {let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        skyGrad.addColorStop(0, '#4ea8de'); // Biru muda di atas
        skyGrad.addColorStop(1, '#90e0ef'); // Biru cerah di bawah
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Awan 1 (Kiri)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.arc(60, 100, 15, 0, Math.PI * 2);
        ctx.arc(80, 90, 22, 0, Math.PI * 2);
        ctx.arc(100, 100, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        // Awan 2 (Kanan)
        ctx.beginPath();
        ctx.arc(220, 260, 18, 0, Math.PI * 2);
        ctx.arc(245, 248, 25, 0, Math.PI * 2);
        ctx.arc(270, 260, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
        // -------------------------------------------------

        // Gambar burung
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(Math.max(-0.35, Math.min(0.6, bird.velocity * 0.05)));

        // Badan
        ctx.beginPath();
        ctx.ellipse(0, 0, bird.radius + 3, bird.radius - 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = bird.color;
        ctx.fill();
        ctx.closePath();

        // Sayap
        ctx.beginPath();
        ctx.ellipse(-3, 3, 7, 4, -0.25, 0, Math.PI * 2);
        ctx.fillStyle = '#f4a900';
        ctx.fill();
        ctx.closePath();

        // Mata
        ctx.beginPath();
        ctx.arc(6, -5, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(7, -5, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.closePath();

        // Paruh
        ctx.beginPath();
        ctx.moveTo(11, -1);
        ctx.lineTo(21, 2);
        ctx.lineTo(11, 5);
        ctx.closePath();
        ctx.fillStyle = '#ff7b00';
        ctx.fill();
        ctx.restore();
        
        // Shaded green pipes with raised rims and glossy highlights
        pipes.forEach(p => {
            const pipeBottomY = canvas.height - p.bottom;
            const drawPipe = (x, y, width, height, capAtBottom) => {
                if (height <= 0) return;

                const pipeGrad = ctx.createLinearGradient(x, 0, x + width, 0);
                pipeGrad.addColorStop(0, '#176b36');
                pipeGrad.addColorStop(0.18, '#31a852');
                pipeGrad.addColorStop(0.42, '#62d477');
                pipeGrad.addColorStop(0.7, '#2b9848');
                pipeGrad.addColorStop(1, '#155b30');
                ctx.fillStyle = pipeGrad;
                ctx.fillRect(x, y, width, height);

                // Narrow glossy stripe and dark edge lines give the pipe a rounded surface.
                ctx.fillStyle = 'rgba(225,255,225,0.32)';
                ctx.fillRect(x + 9, y, 5, height);
                ctx.fillStyle = 'rgba(0,45,18,0.3)';
                ctx.fillRect(x + width - 4, y, 4, height);

                const capHeight = 18;
                const capY = capAtBottom ? y + height - capHeight : y;
                const capX = x - 5;
                const capWidth = width + 10;
                const capGrad = ctx.createLinearGradient(capX, 0, capX + capWidth, 0);
                capGrad.addColorStop(0, '#155b30');
                capGrad.addColorStop(0.2, '#39b85b');
                capGrad.addColorStop(0.48, '#76e18a');
                capGrad.addColorStop(0.78, '#2b9848');
                capGrad.addColorStop(1, '#124b28');
                ctx.fillStyle = capGrad;
                ctx.fillRect(capX, capY, capWidth, capHeight);
                ctx.strokeStyle = 'rgba(10,65,28,0.85)';
                ctx.lineWidth = 2;
                ctx.strokeRect(capX + 1, capY + 1, capWidth - 2, capHeight - 2);
                ctx.fillStyle = 'rgba(235,255,235,0.38)';
                ctx.fillRect(capX + 7, capY + 3, 4, capHeight - 6);
            };

            drawPipe(p.x, 0, 50, p.top, true);
            drawPipe(p.x, pipeBottomY, 50, p.bottom, false);
        });
// --- DRAW PARKOUR ---
} else if (currentGame === 'parkour') {
// Simple cartoon sky, clouds, hills, and a ground strip
const parkourSky = ctx.createLinearGradient(0, 0, 0, canvas.height);
parkourSky.addColorStop(0, '#8ed8ff');
parkourSky.addColorStop(1, '#d7f4ff');
ctx.fillStyle = parkourSky;
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = 'rgba(255,255,255,0.85)';
[[85, 95], [270, 175]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.arc(x + 22, y - 8, 23, 0, Math.PI * 2);
    ctx.arc(x + 47, y, 17, 0, Math.PI * 2);
    ctx.fill();
});
ctx.fillStyle = '#8bd17c';
ctx.beginPath();
ctx.moveTo(0, 390);
ctx.quadraticCurveTo(100, 330, 200, 390);
ctx.quadraticCurveTo(300, 335, canvas.width, 385);
ctx.lineTo(canvas.width, canvas.height);
ctx.lineTo(0, canvas.height);
ctx.fill();
ctx.fillStyle = '#5abf68';
ctx.fillRect(0, 470, canvas.width, 30);
ctx.fillStyle = '#3e3e56';
ctx.fillRect(0, 0, 10, canvas.height);
ctx.fillRect(canvas.width - 10, 0, 10, canvas.height);
// Mini cartoon runner, facing toward the center of the wall course.
ctx.save();
ctx.translate(playerParkour.x, playerParkour.y);
const facing = playerParkour.side === 'left' ? 1 : -1;
const limbSwing = playerParkour.isJumping ? -0.65 : Math.sin(obstacleFrameCount * 0.18) * 0.35;
ctx.scale(facing, 1);
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// Arms and legs, drawn behind the body.
ctx.strokeStyle = '#f2b27f';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(-4, -5);
ctx.lineTo(-8 - limbSwing * 3, 1);
ctx.moveTo(4, -5);
ctx.lineTo(8 + limbSwing * 3, -1);
ctx.stroke();
ctx.strokeStyle = '#34415e';
ctx.lineWidth = 5;
ctx.beginPath();
ctx.moveTo(-3, 4);
ctx.lineTo(-5 - limbSwing * 4, 10);
ctx.lineTo(-7 - limbSwing * 4, 11);
ctx.moveTo(3, 4);
ctx.lineTo(5 + limbSwing * 4, 10);
ctx.lineTo(7 + limbSwing * 4, 11);
ctx.stroke();

// Bright shirt and a small neck.
ctx.fillStyle = '#f2b27f';
ctx.fillRect(-2, -10, 4, 4);
ctx.fillStyle = '#ff6b6b';
ctx.beginPath();
ctx.moveTo(-2, -8);
ctx.lineTo(2, -8);
ctx.quadraticCurveTo(6, -8, 6, -4);
ctx.lineTo(6, 3);
ctx.quadraticCurveTo(6, 6, 3, 6);
ctx.lineTo(-3, 6);
ctx.quadraticCurveTo(-6, 6, -6, 3);
ctx.lineTo(-6, -4);
ctx.quadraticCurveTo(-6, -8, -2, -8);
ctx.closePath();
ctx.fill();
ctx.strokeStyle = '#d94c59';
ctx.lineWidth = 1;
ctx.stroke();

// Head, hair, and a cheerful face.
ctx.fillStyle = '#f2b27f';
ctx.beginPath();
ctx.arc(0, -15, 6.5, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '#55352f';
ctx.beginPath();
ctx.arc(0, -17, 6.5, Math.PI, Math.PI * 2);
ctx.quadraticCurveTo(5, -21, 6, -16);
ctx.lineTo(4, -14);
ctx.quadraticCurveTo(2, -18, 0, -17);
ctx.closePath();
ctx.fill();
ctx.fillStyle = '#263238';
ctx.beginPath();
ctx.arc(3 * facing, -15, 1, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#a94f50';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.arc(3 * facing, -12.5, 1.5, 0.15, Math.PI - 0.15);
ctx.stroke();

// Small shoes.
ctx.fillStyle = '#fff';
ctx.beginPath();
ctx.ellipse(-7 - limbSwing * 4, 11, 4, 2, 0, 0, Math.PI * 2);
ctx.ellipse(7 + limbSwing * 4, 11, 4, 2, 0, 0, Math.PI * 2);
ctx.fill();
ctx.restore();

// Pointed steel spikes face inward from either wall
obstacles.forEach(o => {
    const pointsRight = o.side === 'left';
    const baseX = pointsRight ? o.x : o.x + o.width;
    const tipX = pointsRight ? o.x + o.width : o.x;
    ctx.beginPath();
    ctx.moveTo(baseX, o.y);
    ctx.lineTo(tipX, o.y + o.height / 2);
    ctx.lineTo(baseX, o.y + o.height);
    ctx.closePath();
    const spikeGrad = ctx.createLinearGradient(o.x, o.y, o.x + o.width, o.y);
    spikeGrad.addColorStop(0, '#626a75');
    spikeGrad.addColorStop(0.5, '#d1d6dc');
    spikeGrad.addColorStop(1, '#737c87');
    ctx.fillStyle = spikeGrad;
    ctx.fill();
    ctx.strokeStyle = '#424952';
    ctx.lineWidth = 2;
    ctx.stroke();
});
}
// Papan Skor global
ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Segoe UI'; ctx.textAlign = 'left';
ctx.fillText('🏆 Skor: ' + score, 20, 30);
}
function triggerGameOver() {
if (currentGame === 'flappy') {
    birdDying = true;
    return;
}
finishGame();
}
btnRestart.addEventListener('click', () => {
    resetGameEngine();
    startGameSession(currentGame);
    if (currentGame === 'cookie') canvas.style.cursor = 'none';
});
function gameLoop() {
update();
draw();
requestAnimationFrame(gameLoop);
}
gameLoop();