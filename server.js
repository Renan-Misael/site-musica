const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const app = express();

const INDEX_PATH = path.join(__dirname, 'index.html');
const GOOD_INDEX_URL = 'https://raw.githubusercontent.com/Renan-Misael/site-musica/5ce715361f160dffad6279f1d30e479ab60d328f/index.html';

function ensureIndexHtml() {
  let needsRestore = false;
  try {
    const cur = fs.readFileSync(INDEX_PATH, 'utf8');
    if (cur.includes('PLACEHOLDER') || cur.length < 5000 || !cur.includes('enrollForm')) {
      needsRestore = true;
    }
  } catch {
    needsRestore = true;
  }
  if (!needsRestore) return;
  console.log('index.html incompleto — restaurando...');
  https.get(GOOD_INDEX_URL, (res) => {
    if (res.statusCode !== 200) return console.error('Falha restaurar index', res.statusCode);
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => {
      let html = Buffer.concat(chunks).toString('utf8');
      if (!html.includes('login.html')) {
        html = html.replace('<li><a href="#inscricao">Inscrição</a></li>',
          '<li><a href="#inscricao">Inscrição</a></li>\n        <li><a href="login.html">Login</a></li>');
      }
      fs.writeFileSync(INDEX_PATH, html, 'utf8');
      console.log('index.html restaurado');
    });
  }).on('error', e => console.error(e.message));
}
ensureIndexHtml();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sessions = new Map();
const ADMIN_USER = 'Renan';
const ADMIN_PASS = '1408';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); }
  });
  return out;
}
function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, createdAt: Date.now() });
  return token;
}
function getSession(req) {
  const token = parseCookies(req).harmonia_session;
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) { sessions.delete(token); return null; }
  return s;
}
function wantsHtml(req) {
  if (req.path.endsWith('.html')) return true;
  const a = (req.headers.accept || '').toLowerCase();
  if (a.includes('application/json')) return false;
  if (/^\/(api|listar-|salvar-|finalizar-|detalhes-)/.test(req.path)) return false;
  return a.includes('text/html');
}
function requireAdmin(req, res, next) {
  if (!getSession(req)) {
    if (wantsHtml(req)) return res.redirect('/login.html?next=' + encodeURIComponent(req.originalUrl || req.path));
    return res.status(401).json({ success: false, error: 'Faça login como administrador.' });
  }
  next();
}
function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `harmonia_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS/1000)}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'harmonia_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

app.post('/api/login', (req, res) => {
  const usuario = String(req.body.usuario || '').trim();
  const senha = String(req.body.senha || '');
  if (usuario === ADMIN_USER && senha === ADMIN_PASS) {
    setSessionCookie(res, createSession(usuario));
    return res.json({ success: true, user: usuario, role: 'admin' });
  }
  res.status(401).json({ success: false, error: 'Usuário ou senha incorretos.' });
});
app.post('/api/logout', (req, res) => {
  const t = parseCookies(req).harmonia_session;
  if (t) sessions.delete(t);
  clearSessionCookie(res);
  res.json({ success: true });
});
app.get('/api/me', (req, res) => {
  const s = getSession(req);
  if (!s) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user: s.user, role: 'admin' });
});

['/inscricoes.html','/clientes.html','/servicos.html','/agendamentos.html','/consulta_agendamentos.html'].forEach(p => {
  app.get(p, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, p.slice(1))));
});

app.use(express.static(path.join(__dirname)));

const db = new sqlite3.Database(path.join(__dirname, 'harmonia.db'));
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS inscricoes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL, telefone TEXT, instrumento TEXT NOT NULL, nivel TEXT NOT NULL, curso TEXT, mensagem TEXT, data_inscricao TEXT NOT NULL, status TEXT DEFAULT 'pendente')`);
  db.run(`CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cpf TEXT NOT NULL, telefone TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS servicos (id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, preco REAL NOT NULL, tempo_estimado INTEGER NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS agendamentos (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL, data TEXT NOT NULL, responsavel TEXT NOT NULL, total REAL NOT NULL, tempo_total INTEGER NOT NULL, FOREIGN KEY (cliente_id) REFERENCES clientes (id))`);
  db.run(`CREATE TABLE IF NOT EXISTS itens_agendamento (id INTEGER PRIMARY KEY AUTOINCREMENT, agendamento_id INTEGER NOT NULL, servico_id INTEGER NOT NULL, preco_cobrado REAL NOT NULL, FOREIGN KEY (agendamento_id) REFERENCES agendamentos (id), FOREIGN KEY (servico_id) REFERENCES servicos (id))`);
});

app.post('/api/inscricoes', (req, res) => {
  const { nome, email, telefone, instrumento, nivel, curso, mensagem } = req.body || {};
  if (!nome || !email || !instrumento || !nivel) return res.status(400).json({ success: false, error: 'Preencha os campos obrigatórios.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return res.status(400).json({ success: false, error: 'E-mail inválido.' });
  db.run(`INSERT INTO inscricoes (nome,email,telefone,instrumento,nivel,curso,mensagem,data_inscricao,status) VALUES (?,?,?,?,?,?,?,?,'pendente')`,
    [String(nome).trim(), String(email).trim().toLowerCase(), String(telefone||'').trim(), String(instrumento).trim(), String(nivel).trim(), String(curso||'').trim(), String(mensagem||'').trim(), new Date().toISOString()],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: 'Erro ao salvar inscrição.' });
      res.json({ success: true, id: this.lastID, message: 'Inscrição realizada com sucesso!' });
    });
});
app.get('/api/inscricoes', requireAdmin, (req, res) => {
  db.all(`SELECT * FROM inscricoes ORDER BY id DESC`, [], (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows));
});
app.patch('/api/inscricoes/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!['pendente','confirmada','cancelada'].includes(status)) return res.status(400).json({ success: false, error: 'Status inválido.' });
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'ID inválido.' });
  db.run(`UPDATE inscricoes SET status = ? WHERE id = ?`, [status, id], function (err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});
app.post('/salvar-cliente', requireAdmin, (req, res) => {
  const { nome, cpf, telefone } = req.body || {};
  if (!nome || !cpf || !telefone) return res.status(400).send('Preencha todos os campos.');
  db.run(`INSERT INTO clientes (nome,cpf,telefone) VALUES (?,?,?)`, [String(nome).trim(), String(cpf).trim(), String(telefone).trim()], err => err ? res.status(500).send(err.message) : res.redirect('/clientes.html'));
});
app.get('/listar-clientes', requireAdmin, (req, res) => {
  db.all(`SELECT * FROM clientes ORDER BY nome ASC`, [], (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows));
});
app.post('/salvar-servico', requireAdmin, (req, res) => {
  const { descricao, preco, tempo_estimado } = req.body || {};
  if (!descricao || preco === undefined || preco === '' || !tempo_estimado) return res.status(400).send('Preencha todos os campos.');
  db.run(`INSERT INTO servicos (descricao,preco,tempo_estimado) VALUES (?,?,?)`, [String(descricao).trim(), parseFloat(preco), parseInt(tempo_estimado,10)], err => err ? res.status(500).send(err.message) : res.redirect('/servicos.html'));
});
app.get('/listar-servicos', requireAdmin, (req, res) => {
  db.all(`SELECT * FROM servicos ORDER BY descricao ASC`, [], (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows));
});
app.post('/finalizar-agendamento', requireAdmin, (req, res) => {
  const { cliente_id, data, responsavel, total, tempo_total, servicos } = req.body || {};
  if (!cliente_id || !data || !responsavel || !Array.isArray(servicos) || !servicos.length) return res.status(400).json({ success: false, error: 'Dados incompletos.' });
  db.run(`INSERT INTO agendamentos (cliente_id,data,responsavel,total,tempo_total) VALUES (?,?,?,?,?)`, [Number(cliente_id), String(data), String(responsavel).trim(), Number(total)||0, Number(tempo_total)||0], function (err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const id = this.lastID;
    const stmt = db.prepare(`INSERT INTO itens_agendamento (agendamento_id,servico_id,preco_cobrado) VALUES (?,?,?)`);
    let pending = servicos.length, failed = null;
    servicos.forEach(item => {
      stmt.run(id, item.id, item.preco, function (e) {
        if (e && !failed) failed = e;
        if (--pending === 0) stmt.finalize(() => failed ? res.status(500).json({ success: false, error: failed.message }) : res.json({ success: true, id }));
      });
    });
  });
});
app.get('/listar-agendamentos', requireAdmin, (req, res) => {
  db.all(`SELECT a.id,a.data,a.responsavel,a.total,a.tempo_total,c.nome AS nome_cliente FROM agendamentos a INNER JOIN clientes c ON a.cliente_id=c.id ORDER BY a.id DESC`, [], (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows));
});
app.get('/detalhes-agendamento/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido.' });
  db.all(`SELECT i.preco_cobrado,s.descricao,s.tempo_estimado FROM itens_agendamento i INNER JOIN servicos s ON i.servico_id=s.id WHERE i.agendamento_id=?`, [id], (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Harmonia Academy | porta ' + PORT);
  console.log('Login: http://localhost:' + PORT + '/login.html');
});
