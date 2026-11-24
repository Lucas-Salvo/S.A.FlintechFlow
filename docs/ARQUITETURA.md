# FinTech Flow · Documento de arquitetura

Entregáveis da coluna **Arquiteto** da planilha de etapas.

---

## 1. Requisitos (ETAPA 1 · Arquiteto)

### Funcionais

| ID | Requisito | Onde |
|---|---|---|
| RF01 | Cadastrar conta (nome, e-mail, senha, empresa) | `POST /auth/cadastro` |
| RF02 | Entrar e sair do sistema | `POST /auth/login`, `POST /auth/logout` |
| RF03 | Recuperar senha por link | `POST /auth/esqueci-senha`, `POST /auth/redefinir-senha` |
| RF04 | Registrar entradas e saídas | `POST /transacoes` |
| RF05 | Listar, buscar, filtrar e paginar lançamentos | `GET /transacoes` |
| RF06 | Editar lançamento | `PUT /transacoes/:id` |
| RF07 | Arquivar e restaurar lançamento (sem apagar) | `PATCH /transacoes/:id/arquivar` e `/restaurar` |
| RF08 | Bloquear valor negativo e data futura | `transacoesController.validar` |
| RF09 | Avisar sobre lançamento duplicado e exigir confirmação | `acharDuplicata` + 409 |
| RF10 | Cadastrar, editar, antecipar e liquidar recebíveis | `/recebiveis` |
| RF11 | Dashboard: saldo, entradas e saídas do mês, a receber, gráficos e alertas | `GET /dashboard` |
| RF12 | Demonstrativo de 3/6/12 meses e despesas por categoria, com exportação CSV | `GET /relatorios/dre` |
| RF13 | Trilha de auditoria de todas as ações | `GET /auditoria` |
| RF14 | Editar perfil, senha, preferências e dados da empresa | `/conta/*`, `/empresa` |
| RF15 | Perfis de acesso (admin, operador, leitor) | RBAC, §4 |

### Não funcionais

| ID | Requisito | Como foi atendido |
|---|---|---|
| RNF01 | Segurança: senha nunca em texto puro | bcrypt (10 rounds) |
| RNF02 | Segurança: sessão não acessível por JavaScript | JWT em cookie httpOnly, SameSite, Secure em produção |
| RNF03 | Segurança: CORS restrito | `CORS_ORIGIN` no `.env` |
| RNF04 | Integridade: nenhum lançamento é apagado fisicamente | sem rota DELETE; soft delete |
| RNF05 | Rastreabilidade | tabela `Auditoria`, escrita na mesma transação do banco |
| RNF06 | Desempenho: listagem em até ~200 ms com milhares de registros | paginação e somas no banco, índices (§6) |
| RNF07 | Isolamento entre empresas (multi-tenant) | toda consulta filtra por `empresaId` do usuário logado |
| RNF08 | Padronização de erros | JSON `{ erro, campos }` em toda a API |
| RNF09 | Usabilidade: feedback para toda ação | toasts, loaders, modal de erro (§7) |
| RNF10 | Responsividade | breakpoints 1100/860/560 px |
| RNF11 | Manutenibilidade | camadas routes → middlewares → controllers → Prisma; testes automatizados |
| RNF12 | Documentação | Swagger em `/api/docs` |

---

## 2. Quadro de tarefas para o Trello (ETAPA 2 · Arquiteto)

Colunas: **Backlog · A fazer · Fazendo · Revisão · Feito**. Etiquetas: `Backend` `Frontend` `Arquiteto`.
Um cartão por linha da planilha:

| Cartão | Etiqueta | Critério de pronto |
|---|---|---|
| E1 · Iniciar projeto Node | Backend | `npm run dev` sobe a API |
| E1 · Iniciar projeto do front | Frontend | páginas abrem no Live Server |
| E1 · Levantar requisitos | Arquiteto | §1 revisado pela equipe |
| E2 · Arquitetura de pastas | Backend | estrutura do `app.js` |
| E2 · Criar a logo | Frontend | logo em todas as páginas |
| E2 · Organizar o Trello | Arquiteto | este quadro criado |
| E3 · Rotas GET/POST/PUT | Backend | rotas respondem no Insomnia/Swagger |
| E3 · Consumir rotas | Frontend | telas leem e gravam na API |
| E4 · Autenticação JWT | Backend | login gera o cookie |
| E4 · Tela de login | Frontend | login/cadastro funcionando |
| E4 · Validar fluxo de dados | Arquiteto | `api.test.js` passando |
| E5 · Rotas protegidas e middleware | Backend | 401/403 corretos |
| E5 · Dashboard (tela) | Frontend | layout pronto |
| E5 · Segurança e RBAC | Arquiteto | matriz §4 aprovada |
| E6 · Rotas de dashboard | Backend | `GET /dashboard` |
| E6 · Consumo do dashboard e gráficos | Frontend | KPIs e gráficos com dados reais |
| E6 · Fluxos de navegação | Arquiteto | §5 validado |
| E7 · Filtros, paginação e busca | Backend | query params funcionando |
| E7 · Tabelas e filtros na UI | Frontend | busca/paginação na tela |
| E7 · Desempenho das consultas | Arquiteto | índices §6 |
| E8 · Erros centralizados | Backend | JSON padrão |
| E8 · Toasts, loaders e modais | Frontend | feedback em todas as ações |
| E8 · Homologação UX/UI | Arquiteto | checklist §7 |
| E9 · Índices e relatórios | Backend | `GET /relatorios/dre` |
| E9 · Otimização e responsividade | Frontend | debounce/memo; mobile ok |
| E9 · Estratégia de testes | Arquiteto | `npm test` verde |
| E10 · Build | Backend | `npm run build` |
| E10 · Deploy do front | Frontend | site no ar |
| E10 · Swagger | Arquiteto | `/api/docs` |
| E11 · Vídeo + GitHub | Todos | link do vídeo no README |

---

## 3. Fluxo de dados e endpoints (ETAPA 4 · Arquiteto)

```
Navegador (frontend/*.html + app.js)
   │  fetch(credentials: 'include')  ← api.js
   ▼
Express (backend/src/app.js)
   ├─ cors            só origens do .env
   ├─ express.json    corpo JSON (até 100 kb)
   ├─ cookieParser    lê o cookie "token"
   ▼
routes/index.js
   ├─ rotas /auth públicas
   ├─ autenticar      JWT válido? → req.user        (401 se não)
   ├─ autorizar(...)  papel permite?                 (403 se não)
   ├─ validarId       :id no formato TX-123 / 123    (400 se não)
   ├─ exigirCorpo     corpo JSON presente            (400 se não)
   ▼
controllers/*  →  validar() regras de negócio        (400/409)
   ▼
Prisma  →  SQLite (dev) / PostgreSQL (prod)
   │       + auditar() na mesma transação
   ▼
serializers.js  →  JSON no formato que o front usa
   ▼
errorHandler.js →  qualquer erro vira { erro, campos }
```

A validação automática deste fluxo está em `backend/tests/api.test.js`. Cada teste tem no nome a etapa que valida.

---

## 4. Segurança e RBAC (ETAPA 5 · Arquiteto)

### Matriz de permissões

| Ação | leitor | operador | admin |
|---|:-:|:-:|:-:|
| Ver dashboard, transações, recebíveis, relatórios | ✅ | ✅ | ✅ |
| Criar/editar transação e recebível | | ✅ | ✅ |
| Arquivar/restaurar transação | | ✅ | ✅ |
| Antecipar/liquidar recebível | | ✅ | ✅ |
| Ver auditoria | | | ✅ |
| Editar dados da empresa | | | ✅ |
| Listar usuários e mudar papéis | | | ✅ |
| Editar o próprio perfil, senha e preferências | ✅ | ✅ | ✅ |

Implementação: `PERMISSOES` em `backend/src/middlewares/auth.js` (o front repete a matriz só para esconder botões, e quem decide é sempre a API).
Quem cria a conta vira `admin` da própria empresa. Um admin não pode trocar o próprio papel.

### Critérios de segurança

1. Senhas com bcrypt. O hash nunca sai da API.
2. JWT assinado com `JWT_SECRET` (mínimo de 48 bytes aleatórios), expiração conforme a preferência do usuário (15 min / 1 h / 8 h; 7 dias com "lembrar").
3. Cookie `httpOnly` + `SameSite=Lax` (dev) / `None; Secure` (produção).
4. Login responde a mesma mensagem para e-mail inexistente e senha errada, com tempo de resposta parecido (hash falso).
5. Recuperação de senha: token aleatório de 32 bytes, guardado só como SHA-256, expira em 30 min e só pode ser usado uma vez. A resposta não revela se o e-mail existe.
6. Toda consulta filtra por `empresaId`: um usuário nunca vê dados de outra empresa.
7. Validação de entrada no servidor, mesmo com validação no front.
8. Sem DELETE de lançamentos; auditoria somente leitura.
9. Tentativas bloqueadas (valor negativo) também são auditadas.
10. Pendências para produção: limite de tentativas de login (`express-rate-limit`), cabeçalhos de segurança (`helmet`), envio real de e-mail.

---

## 5. Fluxos de navegação (ETAPA 6 · Arquiteto)

```
index.html ──► login.html ──(login ok)──► dashboard.html
                 │   ▲                          │
                 │   └──── 401 em qualquer tela ┘   (api.js)
                 ├──► esqueci-senha.html ──► (link no terminal) ──► redefinir-senha.html ──► login.html
                 └──► cadastro (aba) ──► mensagem de sucesso ──► login

dashboard ⇄ relatorios ⇄ transacoes ⇄ nova-transacao* ⇄ recebiveis ⇄ auditoria** ⇄ configuracoes
   *  nova-transacao: só operador/admin (menu escondido para leitor)
   ** auditoria: só admin (menu escondido; URL direta mostra "Acesso restrito")
```

| Cenário | Resultado esperado | Verificado em |
|---|---|---|
| Abrir qualquer tela sem login | vai para `login.html` | `api.js` + e2e |
| Sessão expira no meio do uso | próxima chamada vai para `login.html` | `api.js` |
| Operador abre `auditoria.html` | modal "Acesso restrito" → dashboard | `app.js` `PAGINA_EXIGE` + e2e |
| Leitor abre `nova-transacao.html` | modal "Acesso restrito" | idem |
| Sair | cookie apagado; voltar ao app pede login | e2e |
| API fora do ar | modal "Não foi possível carregar" com "Tentar novamente" | `app.js` `iniciar` |

---

## 6. Desempenho das consultas e métricas (ETAPA 7 · Arquiteto)

| Consulta | Antes (front com dados fixos) | Agora | Índice |
|---|---|---|---|
| Listagem de transações | todas as linhas no navegador | `skip/take` no banco, 8 por página | `(empresaId, data)` |
| Filtros tipo/status/arquivado | no navegador | `WHERE` no banco | `(empresaId, arquivado, status)` |
| Totais entradas/saídas da tela | soma no navegador | `groupBy(tipo) _sum` no banco | idem |
| Checagem de duplicidade | varria a lista inteira | busca por valor + data | `(empresaId, valor, data)` |
| Dashboard / relatório | todas as transações | só o período pedido; saldo anterior com `groupBy` | `(empresaId, data)` |
| Despesas por categoria | no navegador | `groupBy(categoria) _sum` | `(empresaId, data)` |
| Auditoria | lista inteira | paginada + `groupBy(acao)` | `(empresaId, quando)`, `(empresaId, acao)` |
| Recebíveis em aberto (alertas) | lista inteira | `WHERE status='aberto' ORDER BY vencimento` | `(empresaId, status, vencimento)` |

**Métricas a acompanhar:** tempo de resposta p95 por rota (meta < 200 ms), quantidade de consultas por requisição (≤ 3), tamanho da resposta da listagem (≤ 10 kb com 8 itens).
Para medir em desenvolvimento, ative o log de consultas do Prisma: `new PrismaClient({ log: ['query'] })` em `src/config/prisma.js`.

---

## 7. Homologação de usabilidade e padronização (ETAPA 8 · Arquiteto)

| Item | Padrão adotado | OK |
|---|---|:-:|
| Toda gravação dá retorno | toast verde (sucesso), amarelo (aviso), vermelho (erro) | ✅ |
| Carregamento visível | spinner nas tabelas/listas, botão "Salvando…" | ✅ |
| Erro de validação | mensagem embaixo do campo + borda vermelha + foco no primeiro campo | ✅ |
| Erro fatal | modal com opção de tentar de novo | ✅ |
| Mesma mensagem no front e na API | textos de `utils/valores.js` iguais aos do `app.js` | ✅ |
| Ações perigosas reversíveis | arquivar em vez de excluir; botão "Restaurar" | ✅ |
| Acessibilidade | `role="alert"` nos toasts de erro, modal com `aria-modal`, Esc fecha, respeita `prefers-reduced-motion` | ✅ |
| Formatos | moeda `R$ 1.234,56`, datas `dd/mm/aaaa`, IDs `TX-0000` / `REC-0000` | ✅ |
| Mobile | menu lateral vira gaveta abaixo de 860 px | ✅ |

---

## 8. Estratégia de testes (ETAPA 9 · Arquiteto)

| Nível | Ferramenta | Arquivo | O que cobre | Como rodar |
|---|---|---|---|---|
| Unitário | `node:test` (nativo, sem dependência) | `backend/tests/unit.test.js` | conversão de valores, datas, IDs, cálculo do líquido | `npm test` |
| Integração (API + banco) | `node:test` + `fetch` | `backend/tests/api.test.js` | login, cadastro, CRUD, regras (negativo, futuro, duplicidade), filtros/paginação, dashboard, RBAC, auditoria, logout | `npm test` |
| E2E (navegador) | Playwright | `e2e/fluxo-completo.js` | o sistema inteiro pela interface, com os 3 papéis | ver cabeçalho do arquivo |

Os testes de integração usam um banco separado (`prisma/test.db`), recriado a cada execução, e não mexem no banco de desenvolvimento.
Regra da equipe: nenhum cartão vai para "Feito" no Trello com `npm test` vermelho.

---

## 9. Documentação da API (ETAPA 10 · Arquiteto)

Swagger em **http://localhost:3333/api/docs** (JSON em `/api/docs.json`), gerado de `backend/src/docs/openapi.js`.
Para testar rotas protegidas no Swagger: faça o login em `POST /auth/login`, copie o `token` da resposta, clique em **Authorize** e cole.
