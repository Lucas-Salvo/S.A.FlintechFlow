# FinTech Flow · Backend

> As etapas de entrega estão marcadas no código (`ETAPA N · Backend`). Mapa completo em [`../docs/ETAPAS.md`](../docs/ETAPAS.md).

API REST do FinTech Flow feita com **Express 5**, **Prisma** (SQLite por padrão), **bcrypt**, **jsonwebtoken**, **cookie-parser**, **cors** e **nodemon**.

## Como rodar

```bash
cd backend
npm install
cp .env.example .env        # no Windows: copy .env.example .env
# edite o .env e troque JWT_SECRET por um valor aleatório
npm run setup               # cria o banco (migration) e popula com os dados de demonstração
npm run dev                 # sobe a API com nodemon em http://localhost:3333/api
```

Depois abra o front com o **Live Server** do VS Code (porta 5500), entrando por `frontend/login.html`.

Logins de teste (senha `senha1234`), um por papel do RBAC:

| E-mail | Papel |
|---|---|
| `ana@safecash.com` | admin |
| `bruno@safecash.com` | operador |
| `usuario@empresa.com` | leitor |

Documentação interativa (Swagger): **http://localhost:3333/api/docs**

### Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | API com nodemon (reinicia ao salvar) |
| `npm start` | API sem nodemon |
| `npm run build` | **ETAPA 10:** gera o Prisma Client e aplica as migrations (produção) |
| `npm test` | **ETAPA 9 (Arquiteto):** testes unitários + integração (banco de teste separado) |
| `npm run setup` | migrations + seed (desenvolvimento) |
| `npm run seed` | apaga e recria os dados de demonstração |
| `npm run db:migrate` | gera migration depois de mudar o `schema.prisma` |
| `npm run db:studio` | abre o Prisma Studio para ver o banco |

## Autenticação

- Senhas guardadas com **bcrypt** (10 rounds).
- O login gera um **JWT** e o grava num cookie `token` **httpOnly** (o JavaScript do navegador não consegue ler).
- A duração do token é a preferência "Encerrar sessão após inatividade" do usuário (15 min, 1 h ou 8 h); com "Lembrar de mim", 7 dias.
- Rotas protegidas aceitam o cookie ou o header `Authorization: Bearer <token>` (útil no Insomnia/Postman; o login também devolve o token no JSON).
- **CORS** liberado só para as origens de `CORS_ORIGIN`, com `credentials: true`.
- **RBAC (ETAPA 5):** `leitor` só consulta; `operador` cria, edita, arquiva e antecipa; `admin` também vê a auditoria, edita a empresa e muda papéis. Matriz completa em `docs/ARQUITETURA.md` §4.

> Abra o front e a API pelo **mesmo host** (`127.0.0.1` com `127.0.0.1`, ou `localhost` com `localhost`). O navegador trata os dois como sites diferentes e não envia o cookie entre eles. O `api.js` do front já usa o host da página.

## Rotas (`/api`)

**Públicas**

| Método | Rota | Corpo |
|---|---|---|
| POST | `/auth/cadastro` | `{ nome, sobrenome?, empresa?, email, senha }` |
| POST | `/auth/login` | `{ email, senha, lembrar? }` |
| POST | `/auth/logout` | — |
| POST | `/auth/esqueci-senha` | `{ email }` (o link aparece no terminal da API) |
| POST | `/auth/redefinir-senha` | `{ token, senha }` |

**Protegidas (precisa estar logado; operador/admin para gravar)**

| Método | Rota | Observação |
|---|---|---|
| GET | `/auth/me` | usuário + empresa logados |
| GET | `/transacoes` | filtros: `q, tipo, cat, status, arquivadas=true, de, ate, page, perPage` |
| GET | `/transacoes/categorias` | |
| GET | `/transacoes/duplicata?desc=&valor=&data=` | checa duplicidade |
| GET | `/transacoes/:id` | aceita `TX-4821` ou `4821` |
| POST | `/transacoes` | `{ tipo, desc, valor, data, cat, status, obs?, confirmarDuplicidade? }` |
| PUT/PATCH | `/transacoes/:id` | edição parcial, registra o que mudou na auditoria |
| PATCH | `/transacoes/:id/arquivar` | soft delete, `{ motivo? }` |
| PATCH | `/transacoes/:id/restaurar` | |
| GET | `/recebiveis` | filtro: `status` |
| POST | `/recebiveis` | `{ sacado, vence, bruto, taxa }` |
| PUT/PATCH | `/recebiveis/:id` | só em aberto |
| PATCH | `/recebiveis/:id/antecipar` | marca antecipado e lança a entrada do valor líquido |
| PATCH | `/recebiveis/:id/liquidar` | |
| GET | `/auditoria` | admin · filtros: `acao, q, page, perPage` (somente leitura) |
| GET | `/dashboard` | saldo, entradas/saídas do mês, a receber, série de 6 meses, alertas |
| GET | `/relatorios/dre?meses=3\|6\|12` | demonstrativo e despesas por categoria |
| PUT | `/conta/perfil` | `{ nome, sobrenome, email }` |
| PUT | `/conta/senha` | `{ atual, nova }` |
| PUT | `/conta/preferencias` | `{ sessaoMinutos, notifSaldoMinimo, ... }` |
| GET/PUT | `/empresa` | `{ razaoSocial, cnpj, fusoHorario, saldoInicial }` (PUT só admin) |
| GET | `/usuarios` | admin · usuários da empresa |
| PUT | `/usuarios/:id/papel` | admin · `{ papel: "admin" \| "operador" \| "leitor" }` |

Erros sempre voltam como `{ "erro": "mensagem", "campos": { "campo": "mensagem" } }`.

## Regras de negócio (as mesmas que o front mostra)

- O valor é sempre positivo; o tipo (`entrada`/`saida`) define o sentido. Uma tentativa de valor negativo é bloqueada **e fica registrada na auditoria**.
- Datas futuras são recusadas (usando o fuso horário da empresa).
- Um lançamento com mesmo valor, data e descrição de outro ativo devolve **409** até vir `confirmarDuplicidade: true`.
- Não existe DELETE: lançamentos são **arquivados** (soft delete) e podem ser restaurados.
- Toda criação, edição, arquivamento e login gera um evento de auditoria.
- Cada empresa só enxerga os próprios dados (o cadastro cria uma empresa nova para o usuário).

## Estrutura

```
backend/
├── tests/                 # ETAPA 9 (Arquiteto): unit.test.js e api.test.js
├── prisma/
│   ├── schema.prisma      # modelos + índices (ETAPA 9)
│   ├── migrations/
│   └── seed.js            # dados de demonstração (os mesmos que estavam no front)
└── src/
    ├── server.js          # sobe o servidor
    ├── app.js             # express, cors, cookie-parser, rotas
    ├── config/            # .env e cliente Prisma
    ├── docs/              # openapi.js — Swagger (ETAPA 10 Arquiteto)
    ├── middlewares/       # JWT, RBAC, validação e tratamento de erros
    ├── controllers/       # regras de cada recurso
    ├── routes/            # mapa das rotas
    └── utils/             # validações, formatação, auditoria
```

## Usar PostgreSQL ou MySQL

Em `prisma/schema.prisma`, troque `provider = "sqlite"` por `"postgresql"` ou `"mysql"`, ajuste a `DATABASE_URL` no `.env`, apague a pasta `prisma/migrations` e rode `npx prisma migrate dev --name init` e depois `npm run seed`.
