# Harmonia Academy — site-musica

## Como rodar

```bash
npm install
npm start
```

Abra http://localhost:3000

## Páginas

| Página | Função |
|--------|--------|
| index.html | Site principal + **inscrição nas aulas** |
| inscricoes.html | Painel admin das inscrições |
| clientes.html | Cadastro de clientes/alunos |
| servicos.html | Catálogo de serviços/aulas |
| agendamentos.html | Novo agendamento |
| consulta_agendamentos.html | Histórico de agendamentos |

## API de inscrição

- `POST /api/inscricoes` — { nome, email, telefone, instrumento, nivel, curso, mensagem }
- `GET /api/inscricoes` — lista todas
- `PATCH /api/inscricoes/:id/status` — { status: "pendente"\|"confirmada"\|"cancelada" }

Banco SQLite: `harmonia.db` (criado automaticamente).

## Correções feitas

- Links CSS (`estilo.css` → também disponível; páginas usam `style.css`)
- Script quebrado em `consulta_agendamentos.html`
- JS truncado em `agendamentos.html` restaurado
- Escape HTML nas listagens (XSS)
- Formulário de inscrição salva no servidor + fallback localStorage
- `package.json` com dependências corretas
