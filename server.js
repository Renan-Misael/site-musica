const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const app = express();

// Configurações do Servidor
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Necessário para processar o JSON estruturado dos agendamentos
app.use(express.static('.')); // Serve as páginas HTML, CSS e imagens do projeto

// Conexão com o Novo Banco de Dados do Projeto
const db = new sqlite3.Database('./siscristovao.db');

// Inicialização das Tabelas (Cria a estrutura caso não exista)
db.serialize(() => {
    // 1. Tabela de Clientes (Solicitantes dos Serviços)
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        nome TEXT NOT NULL, 
        cpf TEXT NOT NULL, 
        telefone TEXT NOT NULL
    )`);

    // 2. Tabela de Serviços (Catálogo de Assistência do Laboratório)
    db.run(`CREATE TABLE IF NOT EXISTS servicos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        descricao TEXT NOT NULL, 
        preco REAL NOT NULL, 
        tempo_estimado INTEGER NOT NULL
    )`);

    // 3. Tabela Mestre: Agendamentos (Guarda a Ordem de Serviço geral)
    db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        cliente_id INTEGER NOT NULL, 
        data TEXT NOT NULL, 
        responsavel TEXT NOT NULL,
        total REAL NOT NULL,
        tempo_total INTEGER NOT NULL,
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    )`);

    // 4. Tabela Detalhe: Itens do Agendamento (Relaciona os serviços aplicados a cada O.S.)
    db.run(`CREATE TABLE IF NOT EXISTS itens_agendamento (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        agendamento_id INTEGER NOT NULL, 
        servico_id INTEGER NOT NULL, 
        preco_cobrado REAL NOT NULL,
        FOREIGN KEY (agendamento_id) REFERENCES agendamentos (id),
        FOREIGN KEY (servico_id) REFERENCES servicos (id)
    )`);
});

/* ==========================================================================
   ROTAS DO MÓDULO: CLIENTES
   ========================================================================== */

// Salvar um novo cliente
app.post('/salvar-cliente', (req, res) => {
    const { nome, cpf, telefone } = req.body;
    const sql = `INSERT INTO clientes (nome, cpf, telefone) VALUES (?, ?, ?)`;
    
    db.run(sql, [nome, cpf, telefone], (err) => {
        if (err) return res.status(500).send("Erro ao salvar cliente: " + err.message);
        // Redireciona de volta para a página de listagem/cadastro
        res.redirect('/clientes.html');
    });
});

// Listar todos os clientes (API JSON)
app.get('/listar-clientes', (req, res) => {
    const sql = `SELECT * FROM clientes ORDER BY nome ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/* ==========================================================================
   ROTAS DO MÓDULO: SERVIÇOS
   ========================================================================== */

// Salvar um novo serviço no catálogo
app.post('/salvar-servico', (req, res) => {
    const { descricao, preco, tempo_estimado } = req.body;
    const sql = `INSERT INTO servicos (descricao, preco, tempo_estimado) VALUES (?, ?, ?)`;
    
    db.run(sql, [descricao, parseFloat(preco), parseInt(tempo_estimado)], (err) => {
        if (err) return res.status(500).send("Erro ao salvar serviço: " + err.message);
        res.redirect('/servicos.html');
    });
});

// Listar todos os serviços (API JSON)
app.get('/listar-servicos', (req, res) => {
    const sql = `SELECT * FROM servicos ORDER BY descricao ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/* ==========================================================================
   ROTAS DO MÓDULO: AGENDAMENTOS (TRANSAÇÃO MESTRE-DETALHE)
   ========================================================================== */

// Gravar Agendamento Completo (Mestre e Detalhes encapsulados)
app.post('/finalizar-agendamento', (req, res) => {
    const { cliente_id, data, responsavel, total, tempo_total, servicos } = req.body;

    // 1. Insere o registro na tabela Mestre (agendamentos)
    const sqlMestre = `INSERT INTO agendamentos (cliente_id, data, responsavel, total, tempo_total) VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sqlMestre, [cliente_id, data, responsavel, total, tempo_total], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });

        // Recupera o ID gerado automaticamente para este agendamento
        const agendamentoId = this.lastID;

        // 2. Prepara a inserção dos múltiplos serviços vinculados a este agendamento (Detalhe)
        const sqlDetalhe = `INSERT INTO itens_agendamento (agendamento_id, servico_id, preco_cobrado) VALUES (?, ?, ?)`;
        const stmt = db.prepare(sqlDetalhe);

        // Percorre o array de serviços que veio do front-end e executa o statement
        servicos.forEach(item => {
            stmt.run(agendamentoId, item.id, item.preco);
        });

        // Finaliza o statement para liberar o banco de dados
        stmt.finalize((errFinalize) => {
            if (errFinalize) return res.status(500).json({ success: false, error: errFinalize.message });
            res.json({ success: true });
        });
    });
});

// Listar todos os Agendamentos salvos (Mestre) com INNER JOIN para pegar o nome do cliente
app.get('/listar-agendamentos', (req, res) => {
    const sql = `
        SELECT a.id, a.data, a.responsavel, a.total, a.tempo_total, c.nome as nome_cliente 
        FROM agendamentos a 
        INNER JOIN clientes c ON a.cliente_id = c.id 
        ORDER BY a.id DESC`;
        
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Listar serviços específicos de um agendamento (Detalhe)
app.get('/detalhes-agendamento/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT i.preco_cobrado, s.descricao, s.tempo_estimado 
        FROM itens_agendamento i 
        INNER JOIN servicos s ON i.servico_id = s.id 
        WHERE i.agendamento_id = ?`;
        
    db.all(sql, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Inicialização do Servidor na Porta 3000
app.listen(3000, () => {
    console.log('====================================================');
    console.log('🚀 SisCristóvão Rodando com Sucesso na Porta 3000!');
    console.log('📂 Banco de Dados: siscristovao.db');
    console.log('====================================================');
});
