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
  console.log('index.html incompleto — restaurando versao completa...');
  https.get(GOOD_INDEX_URL, (res) => {
    if (res.statusCode !== 200) {
      console.error('Falha ao restaurar index.html:', res.statusCode);
      return;
    }
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => {
      let html = Buffer.concat(chunks).toString('utf8');
      if (!html.includes('login.html')) {
        html = html.replace(
          '<li><a href="#inscricao">Inscrição</a></li>',
          '<li><a href="#inscricao">Inscrição</a></li>\n        <li><a href="login.html">Login</a></li>'
        );
      }
      const oldBlock = "if (valid) {\n        document.getElementById('enrollForm').style.display = 'none';\n        document.getElementById('formSuccess').classList.add('show');\n        playSuccess();\n    }";
      if (html.includes(oldBlock) && !html.includes('/api/inscricoes')) {
        html = html.replace(oldBlock, `if (valid) {
        const payload = {
          nome: document.getElementById('nome').value.trim(),
          email: document.getElementById('email').value.trim(),
          telefone: '',
          instrumento: document.getElementById('instrumento').value,
          nivel: document.getElementById('nivel').value,
          curso: '',
          mensagem: (document.getElementById('mensagem') || {}).value || ''
        };
        fetch('/api/inscricoes', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).finally(() => {
          document.getElementById('enrollForm').style.display = 'none';
          document.getElementById('formSuccess').classList.add('show');
          playSuccess();
        });
    }`);
      }
      fs.writeFileSync(INDEX_PATH, html, 'utf8');
      console.log('index.html restaurado (' + html.length + ' bytes)');
    });
  }).on('error', (err) => console.error('Erro ao baixar index.html:', err.message));
}
ensureIndexHtml();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sessions = new Map();
const ADMIN_USER = 'Renan';
const ADMIN_PASS = '1408';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) {
      try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
    }
  });
  return out;
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, createdAt: Date.now() });
  return token;
}

function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies.harmonia_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function wantsHtml(req) {
  if (req.path.endsWith('.html')) return true;
  const accept = (req.headers.accept || '').toLowerCase();
  if (accept.includes('application/json')) return false;
  if (req.path.startsWith('/api/') || req.path.startsWith('/listar-') ||
      req.path.startsWith('/salvar-') || req.path.startsWith('/finalizar-') ||
      req.path.startsWith('/detalhes-')) return false;
  return accept.includes('text/html');
}

function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session) {
    if (wantsHtml(req)) {
      return res.redirect('/login.html?next=' + encodeURIComponent(req.originalUrl || req.path));
    }
    return res.status(401).json({ success: false, error: 'Faça login como administrador.' });
  }
  req.admin = session;
  next();
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `harmonia_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'harmonia_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

app.post('/api/login', (req, res) => {
  const usuario = String(req.body.usuario || req.body.username || '').trim();
  const senha = String(req.body.senha || req.body.password || '');
  if (usuario === ADMIN_USER && senha === ADMIN_PASS) {
    const token = createSession(usuario);
    setSessionCookie(res, token);
    return res.json({ success: true, user: usuario, role: 'admin', message: 'Login realizado com sucesso.' });
  }
  res.status(401).json({ success: false, error: 'Usuário ou senha incorretos.' });
});

app.post('/api/logout', (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.harmonia_session) sessions.delete(cookies.harmonia_session);
  clearSessionCookie(res);
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const session = getSession(req);
  if (!session) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user: session.user, role: 'admin' });
});

['/inscricoes.html','/clientes.html','/servicos.html','/agendamentos.html','/consulta_agendamentos.html'].forEach(page => {
  app.get(page, requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, page.replace(/^\//, '')));
  });
});

app.use(express.static(path.join(__dirname)));

const db = new sqlite3.Database(path.join(__dirname, 'harmonia.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS inscricoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL, telefone TEXT,
    instrumento TEXT NOT NULL, nivel TEXT NOT NULL, curso TEXT, mensagem TEXT,
    data_inscricao TEXT NOT NULL, status TEXT DEFAULT 'pendente')`);
  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cpf TEXT NOT NULL, telefone TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS servicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, preco REAL NOT NULL, tempo_estimado INTEGER NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL, data TEXT NOT NULL,
    responsavel TEXT NOT NULL, total REAL NOT NULL, tempo_total INTEGER NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes (id))`);
  db.run(`CREATE TABLE IF NOT EXISTS itens_agendamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT, agendamento_id INTEGER NOT NULL, servico_id INTEGER NOT NULL, preco_cobrado REAL NOT NULL,
    FOREIGN KEY (agendamento_id) REFERENCES agendamentos (id), FOREIGN KEY (servico_id) REFERENCES servicos (id))`);
});

app.post('/api/inscricoes', (req, res) => {
  const { nome, email, telefone, instrumento, nivel, curso, mensagem } = req.body || {};
  if (!nome || !email || !instrumento || !nivel) {
    return res.status(400).json({ success: false, error: 'Preencha os campos obrigatórios.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ success: false, error: 'E-mail inválido.' });
  }
  const data = new Date().toISOString();
  db.run(`INSERT INTO inscricoes (nome,email,telefone,instrumento,nivel,curso,mensagem,data_inscricao,status)
    VALUES (?,?,?,?,?,?,?,?,'pendente')`,
    [String(nome).trim(), String(email).trim().toLowerCase(), String(telefone||'').trim(),
     String(instrumento).trim(), String(nivel).trim(), String(curso||'').trim(), String(mensagem||'').trim(), data],
    function (err) {
      if (err) { console.error(err); return res.status(500).json({ success: false, error: 'Erro ao salvar inscrição.' }); }
      res.json({ success: true, id: this.lastID, message: 'Inscrição realizada com sucesso!' });
    });
});

app.get('/api/inscricoes', requireAdmin, (req, res) => {
  db.all(`SELECT * FROM inscricoes ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.patch('/api/inscricoes/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!['pendente','confirmada','cancelada'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Status inválido.' });
  }
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
  db.run(`INSERT INTO clientes (nome,cpf,telefone) VALUES (?,?,?)`, [String(nome).trim(), String(cpf).trim(), String(telefone).trim()], (err) => {
    if (err) return res.status(500).send('Erro ao salvar cliente: ' + err.message);
    res.redirect('/clientes.html');
  });
});

app.get('/listar-clientes', requireAdmin, (req, res) => {
  db.all(`SELECT * FROM clientes ORDER BY nome ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/salvar-servico', requireAdmin, (req, res) => {
  const { descricao, preco, tempo_estimado } = req.body || {};
  if (!descricao || preco === undefined || preco === '' || !tempo_estimado) return res.status(400).send('Preencha todos os campos.');
  db.run(`INSERT INTO servicos (descricao,preco,tempo_estimado) VALUES (?,?,?)`, [String(descricao).trim(), parseFloat(preco), parseInt(tempo_estimado,10)], (err) => {
    if (err) return res.status(500).send('Erro ao salvar serviço: ' + err.message);
    res.redirect('/servicos.html');
  });
});

app.get('/listar-servicos', requireAdmin, (req, res) => {
  db.all(`SELECT * FROM servicos ORDER BY descricao ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/finalizar-agendamento', requireAdmin, (req, res) => {
  const { cliente_id, data, responsavel, total, tempo_total, servicos } = req.body || {};
  if (!cliente_id || !data || !responsavel || !Array.isArray(servicos) || servicos.length === 0) {
    return res.status(400).json({ success: false, error: 'Dados incompletos do agendamento.' });
  }
  db.run(`INSERT INTO agendamentos (cliente_id,data,responsavel,total,tempo_total) VALUES (?,?,?,?,?)`,
    [Number(cliente_id), String(data), String(responsavel).trim(), Number(total)||0, Number(tempo_total)||0],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      const agendamentoId = this.lastID;
      const stmt = db.prepare(`INSERT INTO itens_agendamento (agendamento_id,servico_id,preco_cobrado) VALUES (?,?,?)`);
      let pending = servicos.length, failed = null;
      servicos.forEach(item => {
        stmt.run(agendamentoId, item.id, item.preco, function (runErr) {
          if (runErr && !failed) failed = runErr;
          pending -= 1;
          if (pending === 0) {
            stmt.finalize(() => {
              if (failed) return res.status(500).json({ success: false, error: failed.message });
              res.json({ success: true, id: agendamentoId });
            });
          }
        });
      });
    });
});

app.get('/listar-agendamentos', requireAdmin, (req, res) => {
  db.all(`SELECT a.id,a.data,a.responsavel,a.total,a.tempo_total,c.nome AS nome_cliente
    FROM agendamentos a INNER JOIN clientes c ON a.cliente_id=c.id ORDER BY a.id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/detalhes-agendamento/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido.' });
  db.all(`SELECT i.preco_cobrado,s.descricao,s.tempo_estimado FROM itens_agendamento i
    INNER JOIN servicos s ON i.servico_id=s.id WHERE i.agendamento_id=?`, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Harmonia Academy | porta ' + PORT);
  console.log('Login: http://localhost:' + PORT + '/login.html');
});
