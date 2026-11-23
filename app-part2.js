const scoresData = [
    { id:1, title:"Estudo Op. 10 nº 1", composer:"Fernando Sor", level:"iniciante", style:"estudo", tags:["Violão"], icon:"🎸",
      desc:"Estudo de arpejos para violão.",
      notation:"Compaso 4/4 | Dó maior\n\nDó Mi Sol Dó'\nMi Sol Dó' Mi'\nSol Dó' Mi' Sol'" },
    { id:2, title:"Minueto em Sol", composer:"J. S. Bach", level:"iniciante", style:"classico", tags:["Piano"], icon:"🎹",
      desc:"Minueto clássico.",
      notation:"Compaso 3/4 | Sol maior\n\nSol Ré Si | Lá Fá# Ré\nSol Mi Dó | Ré Si Sol" },
    { id:3, title:"Escalas em Dó", composer:"Harmonia Academy", level:"iniciante", style:"estudo", tags:["Escalas"], icon:"📜",
      desc:"Escala de Dó maior.",
      notation:"Compaso 4/4 | Dó maior\n\nDó Ré Mi Fá | Sol Lá Si Dó'\nDó' Si Lá Sol | Fá Mi Ré Dó" },
    { id:4, title:"Asa Branca (tema)", composer:"Luiz Gonzaga", level:"intermediario", style:"popular", tags:["Popular"], icon:"🎵",
      desc:"Tema do forró.",
      notation:"Compaso 2/4 | Sol maior\n\nSol Lá Si Dó' | Ré' Si\nLá Sol Fá# Sol | Mi" },
    { id:5, title:"Ode à Alegria", composer:"Beethoven", level:"iniciante", style:"classico", tags:["Clássico"], icon:"🎹",
      desc:"Tema da 9ª Sinfonia.",
      notation:"Compaso 4/4 | Ré maior\n\nMi Mi Fá Sol | Sol Fá Mi Ré\nDó Dó Ré Mi | Mi Ré" },
    { id:6, title:"Estudo de Ligados", composer:"M. Carcassi", level:"intermediario", style:"estudo", tags:["Violão"], icon:"🎸",
      desc:"Ligados ascendentes.",
      notation:"Compaso 4/4 | Lá menor\n\nLá Si Dó Ré | Mi Dó\nRé Mi Fá Sol | Lá" }
];
let currentScore = null, originalNotation = '', currentTranspose = 0;
function renderScores(filter) {
    const grid = document.getElementById('scoresGrid');
    if (!grid) return;
    const list = (!filter || filter === 'all') ? scoresData : scoresData.filter(s => s.style === filter);
    grid.innerHTML = list.map(s => `<div class="score-card"><div style="font-size:2rem">${s.icon}</div><h3>${s.title}</h3><p style="color:#78716c;font-size:.85rem">${s.composer}</p><button class="btn btn-primary btn-sm" data-open="${s.id}">Abrir</button></div>`).join('');
    grid.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => openScore(Number(btn.dataset.open))));
}
function openScore(id) {
    currentScore = scoresData.find(s => s.id === id);
    if (!currentScore) return;
    originalNotation = currentScore.notation; currentTranspose = 0;
    const modal = document.getElementById('scoreModal');
    const t = document.getElementById('modalTitle'); if (t) t.textContent = currentScore.title;
    const c = document.getElementById('modalComposer'); if (c) c.textContent = currentScore.composer;
    const d = document.getElementById('modalDesc'); if (d) d.textContent = currentScore.desc;
    const n = document.getElementById('modalNotation'); if (n) n.textContent = originalNotation;
    if (modal) { modal.classList.add('open'); modal.style.display = 'flex'; }
}
document.getElementById('modalClose')?.addEventListener('click', () => {
    const m = document.getElementById('scoreModal'); if (m) { m.classList.remove('open'); m.style.display = 'none'; }
});
document.getElementById('scoreModal')?.addEventListener('click', e => {
    if (e.target.id === 'scoreModal') { e.currentTarget.classList.remove('open'); e.currentTarget.style.display = 'none'; }
});
document.getElementById('applyTranspose')?.addEventListener('click', () => {
    currentTranspose = Number(document.getElementById('transposeSelect')?.value || 0);
    const n = document.getElementById('modalNotation'); if (n) n.textContent = transposeText(originalNotation, currentTranspose);
});
document.getElementById('resetTranspose')?.addEventListener('click', () => {
    currentTranspose = 0;
    const s = document.getElementById('transposeSelect'); if (s) s.value = '0';
    const n = document.getElementById('modalNotation'); if (n) n.textContent = originalNotation;
});
document.getElementById('downloadPdfBtn')?.addEventListener('click', () => {
    if (!currentScore || !window.jspdf) { alert('PDF indisponível.'); return; }
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFontSize(16); doc.text(currentScore.title, 14, 20);
    doc.setFontSize(11); doc.text(currentScore.composer, 14, 28);
    const notation = document.getElementById('modalNotation')?.textContent || originalNotation;
    doc.text(doc.splitTextToSize(notation, 180), 14, 40);
    doc.save(currentScore.title.replace(/\s+/g, '_') + '.pdf');
});
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); renderScores(btn.dataset.filter);
    });
});
renderScores('all');

let bpm = 100, isPlaying = false, intervalId = null;
const bpmDisplay = document.getElementById('bpmDisplay');
const toggleBtn = document.getElementById('metronomeToggle');
const beatIndicator = document.getElementById('beatIndicator');
document.getElementById('bpmUp')?.addEventListener('click', () => {
    if (bpm < 240) { bpm += 5; if (bpmDisplay) bpmDisplay.textContent = bpm; if (isPlaying) { stopMetronome(); startMetronome(); } }
});
document.getElementById('bpmDown')?.addEventListener('click', () => {
    if (bpm > 40) { bpm -= 5; if (bpmDisplay) bpmDisplay.textContent = bpm; if (isPlaying) { stopMetronome(); startMetronome(); } }
});
function playMetroClick() {
    playClick(1000, 0.22);
    beatIndicator?.classList.add('pulse');
    setTimeout(() => beatIndicator?.classList.remove('pulse'), 100);
}
function startMetronome() {
    playMetroClick(); intervalId = setInterval(playMetroClick, 60000 / bpm); isPlaying = true;
    if (toggleBtn) { toggleBtn.textContent = 'Parar'; toggleBtn.classList.add('active'); }
}
function stopMetronome() {
    clearInterval(intervalId); isPlaying = false;
    if (toggleBtn) { toggleBtn.textContent = 'Iniciar'; toggleBtn.classList.remove('active'); }
    beatIndicator?.classList.remove('pulse');
}
toggleBtn?.addEventListener('click', () => isPlaying ? stopMetronome() : startMetronome());

document.getElementById('enrollForm')?.addEventListener('submit', e => {
    e.preventDefault();
    let valid = true;
    document.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
    if ((document.getElementById('nome')?.value.trim() || '').length < 3) { document.getElementById('errorNome')?.classList.add('show'); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.getElementById('email')?.value || '')) { document.getElementById('errorEmail')?.classList.add('show'); valid = false; }
    if (!document.getElementById('instrumento')?.value) { document.getElementById('errorInstrumento')?.classList.add('show'); valid = false; }
    if (!document.getElementById('nivel')?.value) { document.getElementById('errorNivel')?.classList.add('show'); valid = false; }
    if (valid) {
        document.getElementById('enrollForm').style.display = 'none';
        document.getElementById('formSuccess')?.classList.add('show');
        playSuccess();
    }
});
document.getElementById('resetForm')?.addEventListener('click', () => {
    document.getElementById('formSuccess')?.classList.remove('show');
    const f = document.getElementById('enrollForm'); if (f) { f.style.display = 'block'; f.reset(); }
});
