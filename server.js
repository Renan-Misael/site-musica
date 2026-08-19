const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database(path.join(__dirname, 'harmonia.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS inscricoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT,
    instrumento TEXT NOT NULL,
    nivel TEXT NOT NULL,
    curso TEXT,
    mensagem TEXT,
    data_inscricao TEXT NOT NULL,
    status TEXT DEFAULT 'pendente'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL,
    telefone TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS servicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    preco REAL NOT NULL,
    tempo_estimado INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    responsavel TEXT NOT NULL,
    total REAL NOT NULL,
    tempo_total INTEGER NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS itens_agendamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agendamento_id INTEGER NOT NULL,
    servico_id INTEGER NOT NULL,
    preco_cobrado REAL NOT NULL,
    FOREIGN KEY (agendamento_id) REFERENCES agendamentos (id),
    FOREIGN KEY (servico_id) REFERENCES servicos (id)
  )`);
});

app.post('/api/inscricoes', (req, res) => {
  const { nome, email, telefone, instrumento, nivel, curso, mensagem } = req.body;
  if (!nome || !email || !instrumento || !nivel) {
    return res.status(400).json({ success: false, error: 'Preencha os campos obrigatórios.' });
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return res.status(400).json({ success: false, error: 'E-mail inválido.' });
  }
  const data = new Date().toISOString();
  const sql = `INSERT INTO inscricoes
    (nome, email, telefone, instrumento, nivel, curso, mensagem, data_inscricao, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`;
  db.run(sql, [
    nome.trim(),
    email.trim().toLowerCase(),
    (telefone || '').trim(),
    instrumento,
    nivel,
    curso || '',
    mensagem || '',
    data
  ], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Erro ao salvar inscrição.' });
    }
    res.json({ success: true, id: this.lastID, message: 'Inscrição realizada com sucesso!' });
  });
});

app.get('/api/inscricoes', (req, res) => {
  db.all(`SELECT * FROM inscricoes ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.patch('/api/inscricoes/:id/status', (req, res) => {
  const { status } = req.body;
  const allowed = ['pendente', 'confirmada', 'cancelada'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, error: 'Status inválido.' });
  }
  db.run(`UPDATE inscricoes SET status = ? WHERE id = ?`, [status, req.params.id], function (err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

app.post('/salvar-cliente', (req, res) => {
  const { nome, cpf, telefone } = req.body;
  if (!nome || !cpf || !telefone) {
    return res.status(400).send('Preencha todos os campos.');
  }
  db.run(`INSERT INTO clientes (nome, cpf, telefone) VALUES (?, ?, ?)`, [nome.trim(), cpf.trim(), telefone.trim()], (err) => {
    if (err) return res.status(500).send('Erro ao salvar cliente: ' + err.message);
    res.redirect('/clientes.html');
  });
});

app.get('/listar-clientes', (req, res) => {
  db.all(`SELECT * FROM clientes ORDER BY nome ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/salvar-servico', (req, res) => {
  const { descricao, preco, tempo_estimado } = req.body;
  if (!descricao || preco === undefined || !tempo_estimado) {
    return res.status(400).send('Preencha todos os campos.');
  }
  db.run(`INSERT INTO servicos (descricao, preco, tempo_estimado) VALUES (?, ?, ?)`, [descricao.trim(), parseFloat(preco), parseInt(tempo_estimado, 10)], (err) => {
    if (err) return res.status(500).send('Erro ao salvar serviço: ' + err.message);
    res.redirect('/servicos.html');
  });
});

app.get('/listar-servicos', (req, res) => {
  db.all(`SELECT * FROM servicos ORDER BY descricao ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/finalizar-agendamento', (req, res) => {
  const { cliente_id, data, responsavel, total, tempo_total, servicos } = req.body;
  if (!cliente_id || !data || !responsavel || !Array.isArray(servicos) || servicos.length === 0) {
    return res.status(400).json({ success: false, error: 'Dados incompletos do agendamento.' });
  }
  const sqlMestre = `INSERT INTO agendamentos (cliente_id, data, responsavel, total, tempo_total) VALUES (?, ?, ?, ?, ?)`;
  db.run(sqlMestre, [cliente_id, data, responsavel, total, tempo_total], function (err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const agendamentoId = this.lastID;
    const sqlDetalhe = `INSERT INTO itens_agendamento (agendamento_id, servico_id, preco_cobrado) VALUES (?, ?, ?)`;
    const stmt = db.prepare(sqlDetalhe);
    for (const item of servicos) {
      stmt.run(agendamentoId, item.id, item.preco);
    }
    stmt.finalize((errFinalize) => {
      if (errFinalize) return res.status(500).json({ success: false, error: errFinalize.message });
      res.json({ success: true, id: agendamentoId });
    });
  });
});

app.get('/listar-agendamentos', (req, res) => {
  const sql = `SELECT a.id, a.data, a.responsavel, a.total, a.tempo_total, c.nome AS nome_cliente
    FROM agendamentos a INNER JOIN clientes c ON a.cliente_id = c.id ORDER BY a.id DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/detalhes-agendamento/:id', (req, res) => {
  const sql = `SELECT i.preco_cobrado, s.descricao, s.tempo_estimado
    FROM itens_agendamento i INNER JOIN servicos s ON i.servico_id = s.id WHERE i.agendamento_id = ?`;
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('====================================================');
  console.log('  Harmonia Academy + Gestão  |  Porta ' + PORT);
  console.log('  Banco: harmonia.db');
  console.log('  Site:  http://localhost:' + PORT);
  console.log('  Inscrições: http://localhost:' + PORT + '/inscricoes.html');
  console.log('====================================================');
});
