'use strict';

/* ===== Constants ===== */
const DIGIT_COUNT = 4;
const CONFETTI_COLORS = [
    '#ff6b6b', '#ffd93d', '#7c6fff', '#6bcb77',
    '#ff9f43', '#00d2d3', '#fd79a8', '#a29bfe'
];

/* ===== Game State ===== */
const state = {
    secret: [],
    attempts: 0,
    bestScore: parseInt(localStorage.getItem('hab_best') || '0', 10),
    gameOver: false,
    history: [],
};

/* ===== Secret Generation ===== */
function generateSecret() {
    const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, DIGIT_COUNT);
}

/* ===== Hit & Blow Calculation ===== */
function calcResult(guess, secret) {
    let hits = 0;
    let blows = 0;
    for (let i = 0; i < DIGIT_COUNT; i++) {
        if (guess[i] === secret[i]) {
            hits++;
        } else if (secret.includes(guess[i])) {
            blows++;
        }
    }
    return { hits, blows };
}

/* ===== DOM Helpers ===== */
function getInputs() {
    return Array.from(document.querySelectorAll('.digit-input'));
}

function getGuessDigits() {
    return getInputs().map(el => el.value);
}

function setHint(text, isError = false) {
    const el = document.getElementById('hint-text');
    el.textContent = text;
    el.classList.toggle('error-msg', isError);
}

function setHintTemp(text, isError = false, duration = 1800) {
    setHint(text, isError);
    setTimeout(() => {
        setHint('4桁の数字を入力（各桁は異なる数字）', false);
    }, duration);
}

/* ===== Input Handling ===== */
function handleInput(e, index) {
    const input = e.target;
    const val = input.value;

    if (val.length > 1) {
        input.value = val.slice(-1);
    }

    if (!/^\d$/.test(input.value)) {
        input.value = '';
        input.classList.remove('filled');
        return;
    }

    input.classList.add('filled');

    const inputs = getInputs();
    if (index < DIGIT_COUNT - 1) {
        inputs[index + 1].focus();
    } else {
        document.getElementById('submit-btn').focus();
    }
}

function handleKeyDown(e, index) {
    const inputs = getInputs();

    if (e.key === 'Backspace') {
        if (!inputs[index].value && index > 0) {
            inputs[index - 1].value = '';
            inputs[index - 1].classList.remove('filled');
            inputs[index - 1].focus();
            e.preventDefault();
        } else {
            inputs[index].value = '';
            inputs[index].classList.remove('filled');
            e.preventDefault();
        }
    }

    if (e.key === 'ArrowLeft'  && index > 0)              inputs[index - 1].focus();
    if (e.key === 'ArrowRight' && index < DIGIT_COUNT - 1) inputs[index + 1].focus();
    if (e.key === 'Enter') submitGuess();
}

function handlePaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    const inputs = getInputs();
    let focusIndex = 0;

    for (let i = 0; i < Math.min(text.length, DIGIT_COUNT); i++) {
        inputs[i].value = text[i];
        inputs[i].classList.add('filled');
        focusIndex = i;
    }

    const next = focusIndex + 1;
    if (next < DIGIT_COUNT) {
        inputs[next].focus();
    } else {
        document.getElementById('submit-btn').focus();
    }
}

/* ===== Validate & Submit ===== */
function submitGuess() {
    if (state.gameOver) return;

    const raw = getGuessDigits();
    const inputs = getInputs();

    if (raw.some(d => d === '')) {
        inputs.forEach(inp => { if (!inp.value) inp.classList.add('error'); });
        setHintTemp('4桁すべて入力してください！', true);
        setTimeout(() => inputs.forEach(inp => inp.classList.remove('error')), 500);
        return;
    }

    const nums = raw.map(Number);

    if (new Set(nums).size !== DIGIT_COUNT) {
        inputs.forEach(inp => inp.classList.add('error'));
        setHintTemp('各桁は異なる数字を使ってください！', true);
        setTimeout(() => inputs.forEach(inp => inp.classList.remove('error')), 500);
        return;
    }

    const { hits, blows } = calcResult(nums, state.secret);
    state.attempts++;
    state.history.push({ nums, hits, blows });

    addHistoryItem(nums, hits, blows, state.attempts);
    updateStats();
    clearInputs();

    if (hits === DIGIT_COUNT) {
        state.gameOver = true;
        saveBest(state.attempts);
        setTimeout(() => showWinModal(), 700);
    } else {
        const hint = hits === 0 && blows === 0
            ? 'ヒントなし… でも諦めずに！'
            : `${hits} HIT, ${blows} BLOW — 続けてください！`;
        setHint(hint, false);
        getInputs()[0].focus();
    }
}

function clearInputs() {
    getInputs().forEach(inp => {
        inp.value = '';
        inp.classList.remove('filled', 'error');
    });
    setHint('4桁の数字を入力（各桁は異なる数字）', false);
    getInputs()[0].focus();
}

/* ===== History ===== */
function addHistoryItem(nums, hits, blows, index) {
    const list = document.getElementById('history-list');
    const empty = list.querySelector('.history-empty');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'history-item';

    const numEl = document.createElement('div');
    numEl.className = 'history-num';
    numEl.textContent = index;

    const digitsEl = document.createElement('div');
    digitsEl.className = 'history-digits';

    nums.forEach((d, i) => {
        const el = document.createElement('div');
        el.className = 'history-digit';
        el.textContent = d;
        if (d === state.secret[i]) {
            el.classList.add('is-hit');
        } else if (state.secret.includes(d)) {
            el.classList.add('is-blow');
        }
        digitsEl.appendChild(el);
    });

    const resultEl = document.createElement('div');
    resultEl.className = 'history-result';
    resultEl.innerHTML = `
        <div class="result-badge hit">
            <span class="result-count">${hits}</span>
            <span class="result-label">HIT</span>
        </div>
        <div class="result-badge blow">
            <span class="result-count">${blows}</span>
            <span class="result-label">BLOW</span>
        </div>
    `;

    item.appendChild(numEl);
    item.appendChild(digitsEl);
    item.appendChild(resultEl);

    // latest first
    list.insertBefore(item, list.firstChild);
}

/* ===== Stats ===== */
function updateStats() {
    const el = document.getElementById('attempt-count');
    el.textContent = state.attempts;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
}

function saveBest(score) {
    if (state.bestScore === 0 || score < state.bestScore) {
        state.bestScore = score;
        localStorage.setItem('hab_best', String(score));
    }
    renderBestScore();
}

function renderBestScore() {
    const el = document.getElementById('best-score');
    el.textContent = state.bestScore > 0 ? state.bestScore : '--';
}

/* ===== Win Modal ===== */
function showWinModal() {
    const modal   = document.getElementById('win-modal');
    const msgEl   = document.getElementById('win-message');
    const answerEl = document.getElementById('win-answer');

    const n = state.attempts;
    let emoji = '🎉';
    let msg;

    if (n <= 3) {
        emoji = '🏆';
        msg = `驚異的！わずか ${n} 回で正解！\nあなたは天才です！`;
    } else if (n <= 6) {
        emoji = '🎯';
        msg = `素晴らしい！${n} 回で正解！\n鮮やかな推理力です！`;
    } else if (n <= 10) {
        emoji = '👍';
        msg = `よくできました！${n} 回で正解！\n粘り強さが実りました！`;
    } else {
        emoji = '💪';
        msg = `${n} 回で正解！\n諦めずに頑張りました！`;
    }

    document.getElementById('win-emoji').textContent = emoji;
    msgEl.textContent = msg;

    answerEl.innerHTML = '';
    state.secret.forEach(d => {
        const el = document.createElement('div');
        el.className = 'win-digit';
        el.textContent = d;
        answerEl.appendChild(el);
    });

    modal.classList.add('active');
    launchConfetti();
    document.getElementById('game-status').textContent = 'クリア！';
}

/* ===== Confetti ===== */
function launchConfetti() {
    const container = document.getElementById('confetti-container');
    container.innerHTML = '';

    const count = 60;
    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';

        const size    = 6 + Math.random() * 7;
        const left    = Math.random() * 100;
        const rotEnd  = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720);
        const txEnd   = (Math.random() - 0.5) * 120;
        const dur     = 1.6 + Math.random() * 2;
        const delay   = Math.random() * 0.8;
        const color   = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        const isCircle = Math.random() > 0.5;

        piece.style.cssText = `
            left: ${left}%;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: ${isCircle ? '50%' : '2px'};
            --tx: translateX(${txEnd}px);
            --rot: ${rotEnd}deg;
            animation-duration: ${dur}s;
            animation-delay: ${delay}s;
            transform: translateX(${txEnd * 0}px) translateY(0) rotate(0deg);
        `;
        container.appendChild(piece);
    }
}

/* ===== Floating Background Digits ===== */
function initBackground() {
    const container = document.getElementById('bg-animation');
    container.innerHTML = '';

    const digits = '0123456789';
    for (let i = 0; i < 18; i++) {
        const el = document.createElement('div');
        el.className = 'bg-digit';
        el.textContent = digits[Math.floor(Math.random() * digits.length)];
        el.style.left     = Math.random() * 100 + 'vw';
        el.style.fontSize = (3 + Math.random() * 4) + 'rem';
        el.style.animationDelay    = (Math.random() * 22) + 's';
        el.style.animationDuration = (16 + Math.random() * 18) + 's';
        container.appendChild(el);
    }
}

/* ===== Game Init / Reset ===== */
function initGame() {
    state.secret   = generateSecret();
    state.attempts = 0;
    state.gameOver = false;
    state.history  = [];

    document.getElementById('attempt-count').textContent = '0';
    document.getElementById('game-status').textContent   = 'プレイ中';
    document.getElementById('history-list').innerHTML    =
        '<div class="history-empty">まだ回答がありません<br><small>上の入力欄に4桁の数字を入力してください</small></div>';

    renderBestScore();
    clearInputs();
    getInputs()[0].focus();
}

function restartGame() {
    document.getElementById('win-modal').classList.remove('active');
    initGame();
}

/* ===== Event Listeners ===== */
function bindEvents() {
    getInputs().forEach((input, i) => {
        input.addEventListener('input',   e => handleInput(e, i));
        input.addEventListener('keydown', e => handleKeyDown(e, i));
        input.addEventListener('focus',   e => e.target.select());
        input.addEventListener('paste',   handlePaste);
    });

    document.getElementById('submit-btn').addEventListener('click', submitGuess);
    document.getElementById('play-again-btn').addEventListener('click', restartGame);
    document.getElementById('new-game-btn').addEventListener('click', () => {
        if (state.attempts === 0 || confirm('現在のゲームを終了して新しいゲームを始めますか？')) {
            restartGame();
        }
    });

    // Close modal on backdrop click
    document.getElementById('win-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) restartGame();
    });
}

/* ===== Boot ===== */
document.addEventListener('DOMContentLoaded', () => {
    initBackground();
    bindEvents();
    initGame();
});
