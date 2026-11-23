/* ========== TRANSPOSIÇÃO ========== */
const NOTE_NAMES = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
const NOTE_ALIASES = {
    'Do': 0, 'Dó': 0, 'C': 0,
    'Do#': 1, 'Dó#': 1, 'C#': 1, 'Réb': 1, 'Reb': 1, 'Db': 1,
    'Re': 2, 'Ré': 2, 'D': 2,
    'Re#': 3, 'Ré#': 3, 'D#': 3, 'Mib': 3, 'Eb': 3,
    'Mi': 4, 'E': 4,
    'Fa': 5, 'Fá': 5, 'F': 5,
    'Fa#': 6, 'Fá#': 6, 'F#': 6, 'Solb': 6, 'Gb': 6,
    'Sol': 7, 'G': 7,
    'Sol#': 8, 'G#': 8, 'Láb': 8, 'Lab': 8, 'Ab': 8,
    'La': 9, 'Lá': 9, 'A': 9,
    'La#': 10, 'Lá#': 10, 'A#': 10, 'Sib': 10, 'Bb': 10,
    'Si': 11, 'B': 11
};

function transposeNoteName(name, semitones) {
    const clean = name.replace(/'/g, '').trim();
    let idx = NOTE_ALIASES[clean];
    if (idx === undefined) {
        const map = { 'Do': 0, 'Re': 2, 'Fa': 5, 'La': 9 };
        idx = map[clean];
    }
    if (idx === undefined) return name;
    const newIdx = ((idx + semitones) % 12 + 12) % 12;
    const apostrophe = name.includes("'") ? "'" : '';
    return NOTE_NAMES[newIdx] + apostrophe;
}

function transposeText(text, semitones) {
    if (!semitones) return text;
    let result = text.replace(/\b(Dó#|Ré#|Fá#|Sol#|Lá#|Dó|Ré|Mi|Fá|Sol|Lá|Si|Do#|Re#|Fa#|Sol#|La#|Do|Re|Fa|La)('+)?\b/gi, (match) => transposeNoteName(match, semitones));
    result = result.replace(/\b([A-G](?:#|b)?)(m|maj|min|dim|aug|sus|add)?(\d)?\b/g, (full, root, quality, num) => {
        const sharpMap = { 'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11 };
        let idx = sharpMap[root];
        if (idx === undefined) return full;
        const newIdx = ((idx + semitones) % 12 + 12) % 12;
        const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        return names[newIdx] + (quality || '') + (num || '');
    });
    return result;
}

let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}
function playTone(freq, duration, type = 'sine', volume = 0.25) {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration);
}
function playSuccess() {
    playTone(523.25, 0.12); setTimeout(() => playTone(659.25, 0.12), 100); setTimeout(() => playTone(783.99, 0.2), 200);
}
function playError() {
    playTone(200, 0.15, 'square', 0.12); setTimeout(() => playTone(150, 0.25, 'square', 0.12), 120);
}
function playClick(freq = 900, vol = 0.2) { playTone(freq, 0.06, 'square', vol); }
function playRhythmPattern(pattern, tempoMs = 350) {
    pattern.forEach((isStrong, i) => setTimeout(() => playClick(isStrong ? 1000 : 700, isStrong ? 0.25 : 0.15), i * tempoMs));
}

const navbar = document.getElementById('navbar');
if (navbar) window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 50));
document.getElementById('menuToggle')?.addEventListener('click', () => document.getElementById('navLinks')?.classList.toggle('open'));
document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => document.getElementById('navLinks')?.classList.remove('open')));

const exerciseBank = {
    figuras: { title: "Figuras Musicais", questions: [
        { q: "Qual figura vale 4 tempos (em 4/4)?", options: ["Semínima","Mínima","Semibreve","Colcheia"], correct: 2, explanation: "A semibreve vale 4 tempos." },
        { q: "Quantas colcheias cabem em uma semínima?", options: ["1","2","4","8"], correct: 1, explanation: "2 colcheias = 1 semínima." },
        { q: "A mínima equivale a quantas semínimas?", options: ["1","2","4","8"], correct: 1, explanation: "1 mínima = 2 semínimas." },
        { q: "Pausa da colcheia?", options: ["Pausa de semínima","Pausa de colcheia","Pausa de mínima","Pausa de semibreve"], correct: 1, explanation: "Mesmo valor da figura." },
        { q: "Em 4/4, quantas semínimas?", options: ["2","3","4","8"], correct: 2, explanation: "4 unidades de semínima." },
        { q: "A semínima vale quantos tempos?", options: ["1","2","4","1/2"], correct: 0, explanation: "A semínima vale 1 tempo." },
        { q: "Duas mínimas equivalem a?", options: ["1 semínima","1 semibreve","1 colcheia","2 colcheias"], correct: 1, explanation: "2 mínimas = 1 semibreve." },
        { q: "A fusa é mais rápida que a colcheia?", options: ["Sim","Não","Às vezes","Só em 3/4"], correct: 0, explanation: "A fusa vale metade da colcheia." }
    ]},
    ritmos: { title: "Ritmos & Compassos", questions: [
        { q: "Compasso 4/4 tem quantos tempos?", options: ["3","4","6","2"], correct: 1, explanation: "O numerador indica os tempos." },
        { q: "Em 3/4, a unidade de tempo é?", options: ["Semibreve","Mínima","Semínima","Colcheia"], correct: 2, explanation: "Denominador 4 = semínima." },
        { q: "Síncope é?", options: ["Nota longa","Acento fora do tempo forte","Pausa","Acelerando"], correct: 1, explanation: "Deslocamento do acento." },
        { q: "Compasso binário simples?", options: ["6/8","3/4","2/4","9/8"], correct: 2, explanation: "2/4 é binário simples." },
        { q: "6/8 é?", options: ["Simples ternário","Composto binário","Simples binário","Quaternário"], correct: 1, explanation: "6/8 = composto binário." },
        { q: "Andamento Allegro significa?", options: ["Lento","Moderado","Rápido","Muito lento"], correct: 2, explanation: "Allegro = rápido." },
        { q: "O que é um ostinato?", options: ["Solo","Padrão rítmico repetido","Pausa longa","Crescendo"], correct: 1, explanation: "Motivo repetido." },
        { q: "BPM significa?", options: ["Batidas por música","Batidas por minuto","Baixo por meio","Barra por compasso"], correct: 1, explanation: "Beats per minute." },
        { q: "Tempo forte no 4/4 costuma ser?", options: ["2º tempo","1º tempo","3º tempo","4º tempo"], correct: 1, explanation: "O 1º tempo é o mais forte." },
        { q: "Fermata indica?", options: ["Acelerar","Segurar a nota","Pausar o metrônomo","Tocar piano"], correct: 1, explanation: "Prolongar a duração." }
    ]},
    intervalos: { title: "Intervalos", questions: [
        { q: "Intervalo de Dó a Sol?", options: ["3ª","4ª","5ª","6ª"], correct: 2, explanation: "Dó–Sol = 5ª justa." },
        { q: "Dó a Mi é?", options: ["2ª","3ª maior","4ª","5ª"], correct: 1, explanation: "3ª maior." },
        { q: "Oitava justa tem quantos semitons?", options: ["10","11","12","13"], correct: 2, explanation: "12 semitons." },
        { q: "Semitom é?", options: ["Tom inteiro","Menor distância entre notas","Trítono","Oitava"], correct: 1, explanation: "Menor intervalo." },
        { q: "Dó a Fá é?", options: ["3ª","4ª justa","5ª","2ª"], correct: 1, explanation: "4ª justa." },
        { q: "Intervalo de 2 semitons?", options: ["Semitom","Tom","3ª","4ª"], correct: 1, explanation: "1 tom = 2 semitons." },
        { q: "Lá a Dó (acima) é?", options: ["2ª","3ª menor","3ª maior","4ª"], correct: 1, explanation: "3ª menor." }
    ]},
    escalas: { title: "Escalas & Tonalidades", questions: [
        { q: "Escala maior de Dó tem quantos sustenidos?", options: ["0","1","2","3"], correct: 0, explanation: "Dó maior sem alterações." },
        { q: "Sol maior tem?", options: ["Fá#","Dó#","Sol#","Nenhum"], correct: 0, explanation: "1 sustenido: Fá#." },
        { q: "Escala menor natural relativa de Dó?", options: ["Ré menor","Lá menor","Mi menor","Sol menor"], correct: 1, explanation: "Lá menor." },
        { q: "Armadura de Fá maior?", options: ["1 sustenido","1 bemol","2 bemóis","Nenhum"], correct: 1, explanation: "Si♭." },
        { q: "Modo maior caracteriza-se por?", options: ["3ª menor","3ª maior","5ª diminuta","7ª menor"], correct: 1, explanation: "3ª maior a partir da tônica." },
        { q: "Pentatônica tem quantas notas?", options: ["4","5","6","7"], correct: 1, explanation: "5 notas." },
        { q: "Escala cromática usa?", options: ["Só tons","Só semitons","Tons e semitons","Só naturais"], correct: 1, explanation: "Todos os semitons." }
    ]},
    acordes: { title: "Acordes & Harmonia", questions: [
        { q: "Tríade maior é formada por?", options: ["Tônica, 3ª menor, 5ª","Tônica, 3ª maior, 5ª justa","Tônica, 4ª, 5ª","Tônica, 3ª, 7ª"], correct: 1, explanation: "3ª maior + 5ª justa." },
        { q: "Cifra Am significa?", options: ["Lá maior","Lá menor","Lá aumentado","Lá com 7ª"], correct: 1, explanation: "m = menor." },
        { q: "Acorde de 7ª dominante em Dó?", options: ["Cmaj7","C7","Cm7","Cdim"], correct: 1, explanation: "C7 = dominante." },
        { q: "Tríade diminuta tem?", options: ["3ª maior e 5ª justa","3ª menor e 5ª diminuta","3ª maior e 5ª aumentada","Só tônica e 5ª"], correct: 1, explanation: "3ª menor + 5ª dim." },
        { q: "Inversão de acorde significa?", options: ["Tocar mais alto","Baixo não é a tônica","Tocar ao contrário","Mudar de tom"], correct: 1, explanation: "Outra nota no baixo." },
        { q: "G7 é acorde de?", options: ["Tônica em Dó","Dominante em Dó","Subdominante","Relativa"], correct: 1, explanation: "V7 de Dó." },
        { q: "Cifra C/E indica?", options: ["Dó e Mi separados","Dó com Mi no baixo","Dó menor","Erro de cifra"], correct: 1, explanation: "Barra = baixo alternativo." }
    ]},
    progressoes: { title: "Progressões", questions: [
        { q: "Progressão I–V–vi–IV é comum em?", options: ["Só jazz","Pop/rock","Só clássico","Só blues"], correct: 1, explanation: "Muito usada no pop." },
        { q: "Em Dó, o acorde V é?", options: ["Fá","Sol","Lá","Ré"], correct: 1, explanation: "V = Sol." },
        { q: "Cadência perfeita típica?", options: ["IV–I","V–I","ii–V","vi–IV"], correct: 1, explanation: "V–I." },
        { q: "Grau vi em Dó maior?", options: ["Fá","Sol","Lá menor","Ré"], correct: 2, explanation: "vi = Lá menor." },
        { q: "12 compassos é típico de?", options: ["Valsa","Blues","Samba","Minueto"], correct: 1, explanation: "Blues de 12 compassos." },
        { q: "ii–V–I é progressão de?", options: ["Só pop","Jazz (e outros)","Só barroco","Só metal"], correct: 1, explanation: "Base do jazz." }
    ]}
};

let currentQuestions = [], currentQuestion = 0, score = 0, answered = false, currentCategory = '';
const exerciseMenu = document.getElementById('exerciseMenu');
const quizWrapper = document.getElementById('quizWrapper');
const questionText = document.getElementById('questionText');
const questionExplanation = document.getElementById('questionExplanation');
const optionsContainer = document.getElementById('optionsContainer');
const quizProgress = document.getElementById('quizProgress');
const quizTitle = document.getElementById('quizTitle');
const nextBtn = document.getElementById('nextBtn');
const quizBody = document.getElementById('quizBody');
const quizResult = document.getElementById('quizResult');
const playExampleBtn = document.getElementById('playExampleBtn');

document.querySelectorAll('.exercise-card').forEach(c => c.addEventListener('click', () => startExercise(c.dataset.category)));
function startExercise(cat) {
    currentCategory = cat;
    if (cat === 'misto') {
        const all = [];
        Object.keys(exerciseBank).forEach(k => { if (k !== 'misto') all.push(...exerciseBank[k].questions); });
        currentQuestions = all.sort(() => Math.random() - 0.5).slice(0, 12);
        if (quizTitle) quizTitle.textContent = 'Desafio Misto';
    } else {
        if (!exerciseBank[cat]) return;
        currentQuestions = exerciseBank[cat].questions.slice();
        if (quizTitle) quizTitle.textContent = exerciseBank[cat].title;
    }
    currentQuestion = 0; score = 0;
    if (exerciseMenu) exerciseMenu.style.display = 'none';
    if (quizWrapper) quizWrapper.classList.add('active');
    if (quizResult) quizResult.classList.remove('show');
    if (quizBody) quizBody.style.display = 'block';
    loadQuestion();
}
function loadQuestion() {
    answered = false;
    const q = currentQuestions[currentQuestion];
    if (!q || !optionsContainer) return;
    if (questionText) questionText.textContent = q.q;
    if (quizProgress) quizProgress.textContent = `Pergunta ${currentQuestion+1} de ${currentQuestions.length}`;
    optionsContainer.innerHTML = '';
    if (nextBtn) nextBtn.style.display = 'none';
    if (questionExplanation) { questionExplanation.className = 'question-explanation'; questionExplanation.innerHTML = ''; }
    if (playExampleBtn) {
        if (q.rhythm && q.rhythm.length) {
            playExampleBtn.style.display = 'inline-flex';
            playExampleBtn.onclick = () => playRhythmPattern(q.rhythm, 350);
        } else playExampleBtn.style.display = 'none';
    }
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => selectOption(i, btn));
        optionsContainer.appendChild(btn);
    });
}
function selectOption(index, btn) {
    if (answered) return;
    answered = true;
    const q = currentQuestions[currentQuestion];
    const buttons = optionsContainer.querySelectorAll('.option-btn');
    buttons.forEach(b => b.disabled = true);
    if (index === q.correct) {
        btn.classList.add('correct'); score++; playSuccess();
        if (questionExplanation) {
            questionExplanation.className = 'question-explanation show correct-exp';
            questionExplanation.innerHTML = '<strong>✓ Correto</strong> ' + q.explanation;
        }
    } else {
        btn.classList.add('wrong');
        if (buttons[q.correct]) buttons[q.correct].classList.add('correct');
        playError();
        if (questionExplanation) {
            questionExplanation.className = 'question-explanation show wrong-exp';
            questionExplanation.innerHTML = '<strong>✗ Incorreto</strong> ' + q.explanation;
        }
    }
    if (nextBtn) {
        nextBtn.style.display = 'inline-flex';
        nextBtn.textContent = currentQuestion < currentQuestions.length - 1 ? 'Próxima →' : 'Ver Resultado';
    }
}
nextBtn?.addEventListener('click', () => {
    currentQuestion++;
    if (currentQuestion < currentQuestions.length) loadQuestion();
    else {
        if (quizBody) quizBody.style.display = 'none';
        if (quizResult) quizResult.classList.add('show');
        const fs = document.getElementById('finalScore');
        if (fs) fs.textContent = `${score}/${currentQuestions.length}`;
        const pct = Math.round(score / currentQuestions.length * 100);
        const rm = document.getElementById('resultMessage');
        if (rm) rm.textContent = pct === 100 ? 'Perfeito!' : pct >= 70 ? 'Muito bem!' : pct >= 40 ? 'Bom começo.' : 'Continue praticando.';
        if (pct === 100) playSuccess();
    }
});
function backToMenu() {
    if (quizWrapper) quizWrapper.classList.remove('active');
    if (exerciseMenu) exerciseMenu.style.display = 'block';
    if (quizResult) quizResult.classList.remove('show');
    if (quizBody) quizBody.style.display = 'block';
}
document.getElementById('backToMenu')?.addEventListener('click', backToMenu);
document.getElementById('backToMenu3')?.addEventListener('click', backToMenu);
document.getElementById('restartQuiz')?.addEventListener('click', () => startExercise(currentCategory));
