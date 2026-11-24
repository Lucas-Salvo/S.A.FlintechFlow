# Etapas de entrega · onde cada uma está no código

Toda etapa está marcada no código com um comentário no formato `ETAPA N · Equipe`.
Para listar todas de uma vez:

```bash
grep -rn "ETAPA" backend/src backend/prisma backend/tests frontend/*.js frontend/*.html frontend/*.css e2e --exclude-dir=node_modules
```

No VS Code: `Ctrl+Shift+F` e pesquise `ETAPA 5` (por exemplo).

Status: ✅ entregue · ⚠️ entregue com ressalva (ver observação)

---

## Backend

| Etapa | Entrega | Status | Onde está |
|---|---|---|---|
| 1 | Iniciar projeto Node | ✅ | `backend/package.json`, `backend/src/server.js`, `backend/src/config/prisma.js`, `backend/prisma/schema.prisma` |
| 2 | Arquitetura de pastas | ✅ | Árvore comentada no topo de `backend/src/app.js` (config, routes, controllers, middlewares, utils, docs) |
| 3 | Rotas GET, POST e PUT | ✅ | `backend/src/routes/index.js` (seções `[ETAPA 3]`), `controllers/transacoesController.js`, `controllers/recebiveisController.js`, `controllers/contaController.js` |
| 4 | Autenticação JWT | ✅ | `backend/src/controllers/authController.js` (bcrypt + `jwt.sign` + cookie httpOnly), `middlewares/auth.js` → `autenticar` |
| 5 | Rotas protegidas e validação de middleware | ✅ | `middlewares/auth.js` → `autenticar` + `autorizar` (RBAC), `middlewares/validar.js` → `validarId`, `exigirCorpo`; aplicados em `routes/index.js` |
| 6 | Rotas para dashboard e agregações | ✅ | `GET /api/dashboard` → `controllers/relatoriosController.js` → `dashboard` |
| 7 | Filtros, paginação e busca | ✅ | `GET /api/transacoes` → `transacoesController.js` → `montarFiltro` + `listar`; `GET /api/auditoria` → `auditoriaController.js` |
| 8 | Tratamento centralizado de erros e validação | ✅ | `middlewares/errorHandler.js`, `utils/AppError.js`, `utils/valores.js`, `validar()` dos controllers |
| 9 | Otimização do banco, índices e rotas de relatórios | ✅ | Índices `[ETAPA 9]` em `prisma/schema.prisma` (migration `etapa5_rbac_etapa9_indices`); paginação/soma no banco em `transacoesController.js`; `GET /api/relatorios/dre` com `groupBy` em `relatoriosController.js` |
| 10 | Build | ✅ | `npm run build` (`prisma generate && prisma migrate deploy`) + `npm start`; comentário em `src/server.js` |
| 11 | Vídeo testando + subir no GitHub | ⚠️ | O repositório já vem com git iniciado. **O vídeo e o `git push` são com vocês:** roteiro do vídeo e comandos na seção "Etapa 11" abaixo |

## Frontend

| Etapa | Entrega | Status | Onde está |
|---|---|---|---|
| 1 | Iniciar projeto React com Vite | ⚠️ | O front que vocês enviaram é **HTML + CSS + JavaScript puro**, não React. Ele foi mantido assim e só ganhou a integração com a API. Marcação em `frontend/index.html` |
| 2 | Criar a logo | ✅ | Logo `◈ FinTechFlow` em todas as páginas (comentário `[ETAPA 2 · Frontend]`), estilos `.logo` em `theme.css` |
| 3 | Consumir rotas de leitura, gravação e atualização | ✅ | `frontend/api.js` (get/post/put/patch); uso em `app.js`: `initNovaTransacao` (POST), arquivar/restaurar e antecipar (PATCH), `initConfiguracoes` (PUT) |
| 4 | Tela de login com autenticação | ✅ | `frontend/login.html` + `login.js` (POST `/auth/login` e `/auth/cadastro`), guarda de sessão em `api.js` (401 → login) |
| 5 | Criação do dashboard | ✅ | `frontend/dashboard.html` + `app.js` → `renderDashboard` |
| 6 | Consumo do dashboard e exibição de gráficos | ✅ | `app.js` → `renderDashboard` consome `GET /api/dashboard`; gráficos `graficoBarras` e `linhaSvg`; relatórios consomem `GET /api/relatorios/dre` |
| 7 | Componentização de tabelas, busca e filtros | ✅ | `app.js` → componentes `Tabela`, `Paginador`, `linhaTx`, `pillStatus`; `renderTransacoes` e `renderAuditoria` com busca/filtros no servidor |
| 8 | Toasts, loaders e modais de erro | ✅ | `app.js` → `toast`, `linhaLoader`, `blocoLoader`, `modalErro`; estilos no fim de `app.css` |
| 9 | Otimização de renderização, memoização e responsividade | ✅ | `app.js` → `debounce`, `memo`, `ultimaResposta`; breakpoints marcados em `app.css` |
| 10 | Deploy e build de produção | ⚠️ | Pronto para hospedagem estática (Vercel/Netlify/S3), sem etapa de build porque não há bundler. Configuração da URL da API em produção: cabeçalho de `api.js`. Passo a passo abaixo. **O deploy em si é feito com a conta de vocês** |

## Arquiteto

| Etapa | Entrega | Status | Onde está |
|---|---|---|---|
| 1 | Requisitos funcionais e não funcionais | ✅ | `docs/ARQUITETURA.md` §1 |
| 2 | Organizar tarefas da equipe no Trello | ⚠️ | Quadro sugerido (colunas e cartões) em `docs/ARQUITETURA.md` §2, pronto para copiar para o Trello |
| 4 | Validação do fluxo de dados e endpoints | ✅ | `docs/ARQUITETURA.md` §3 (diagrama do fluxo) + `backend/tests/api.test.js` |
| 5 | Critérios de segurança e RBAC | ✅ | `docs/ARQUITETURA.md` §4 + `backend/src/middlewares/auth.js` (`PERMISSOES`) |
| 6 | Validação dos fluxos de navegação | ✅ | `docs/ARQUITETURA.md` §5 + `frontend/app.js` (`PAGINA_EXIGE`, `preencherUsuario`, guarda em `iniciar`) |
| 7 | Modelagem de desempenho das consultas e métricas | ✅ | `docs/ARQUITETURA.md` §6 + índices em `prisma/schema.prisma` |
| 8 | Homologação de usabilidade (UX/UI) e padronização | ✅ | Checklist em `docs/ARQUITETURA.md` §7 |
| 9 | Estratégia de testes (unitários e e2e) | ✅ | `docs/ARQUITETURA.md` §8, `backend/tests/unit.test.js`, `backend/tests/api.test.js`, `e2e/fluxo-completo.js` |
| 10 | Documentação final da API (Swagger) | ✅ | `backend/src/docs/openapi.js`, servida em **http://localhost:3333/api/docs** |

---

## Etapa 10 (Frontend) · Deploy

1. Publique o **backend** em um serviço Node (Render, Railway, Fly.io…). Variáveis: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN=https://seu-front.vercel.app`, `NODE_ENV=production`. Comandos: build `npm install && npm run build`, start `npm start`.
   Em produção prefira PostgreSQL (veja o README do backend), porque o disco desses serviços costuma ser apagado a cada deploy.
2. Em todas as páginas do front, dentro do `<head>`, coloque:
   `<meta name="ff-api" content="https://sua-api.onrender.com/api" />`
3. Publique a pasta `frontend/` como site estático (na Vercel: *Add New → Project → Framework: Other → Root: frontend*).
4. Com `NODE_ENV=production` o cookie sai com `Secure` e `SameSite=None`, o que permite front e API em domínios diferentes, desde que os dois usem **HTTPS**.

## Etapa 11 · Vídeo e GitHub

**Roteiro sugerido para o vídeo (≈ 5 min):**
1. `npm run setup` e `npm run dev` no terminal; abrir `/api/docs` (Swagger).
2. `npm test` mostrando os 15 testes passando.
3. Login com senha errada (erro) e depois como **ana@safecash.com** (admin).
4. Dashboard → Transações: busca "folha", filtros, paginação, arquivar e restaurar.
5. Nova transação: valor negativo (bloqueado), data futura (bloqueada), duplicidade (pede confirmação).
6. Recebíveis: antecipar e ver a entrada aparecer em Transações.
7. Relatórios (3/6/12 meses) e exportar CSV.
8. Auditoria mostrando tudo o que foi feito, inclusive o "bloqueou".
9. Sair e entrar como **bruno@safecash.com** (operador): Auditoria some do menu e a URL direta mostra "Acesso restrito".
10. Entrar como **usuario@empresa.com** (leitor): sem Nova transação, sem botões de arquivar/antecipar.

**Subir no GitHub** (o repositório local já tem o primeiro commit):

```bash
git remote add origin https://github.com/SEU-USUARIO/fintech-flow.git
```
```bash
git branch -M main
```
```bash
git push -u origin main
```
