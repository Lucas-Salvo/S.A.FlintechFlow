/* =============================================================================
 * Mapa das rotas da API (prefixo /api)
 *
 * ETAPA 3 · Backend — Entrega das rotas de GET, POST e PUT
 * ETAPA 4 · Backend — Autenticação JWT (rotas /auth)
 * ETAPA 5 · Backend — Rotas protegidas e validação de middleware
 *           (autenticar + autorizar[RBAC] + validarId/exigirCorpo)
 * ETAPA 6 · Backend — Rotas para dashboard e agregações de dados
 * ETAPA 7 · Backend — Filtros, paginação e busca (query string em GET /transacoes e /auditoria)
 * ETAPA 9 · Backend — Rotas de relatórios
 * ETAPA 4 · Arquiteto — Validação do fluxo de dados e endpoints: ver tests/api.test.js
 * ============================================================================= */
const { Router } = require('express');
const { autenticar, autorizar, PERMISSOES } = require('../middlewares/auth');
const { validarId, exigirCorpo } = require('../middlewares/validar');
const auth = require('../controllers/authController');
const tx = require('../controllers/transacoesController');
const rec = require('../controllers/recebiveisController');
const aud = require('../controllers/auditoriaController');
const rel = require('../controllers/relatoriosController');
const conta = require('../controllers/contaController');

const r = Router();
const ler = autorizar(...PERMISSOES.ler);
const operar = autorizar(...PERMISSOES.operar);
const administrar = autorizar(...PERMISSOES.administrar);
const idTx = validarId('TX');
const idRec = validarId('REC');
const idUsuario = validarId('USR');

// ---------------------------------------------------------------------------
// [ETAPA 4] Autenticação JWT — rotas públicas
// ---------------------------------------------------------------------------
r.post('/auth/cadastro', exigirCorpo, auth.cadastro);
r.post('/auth/login', exigirCorpo, auth.login);
r.post('/auth/logout', auth.logout);
r.post('/auth/esqueci-senha', exigirCorpo, auth.esqueciSenha);
r.post('/auth/redefinir-senha', exigirCorpo, auth.redefinirSenha);

// ---------------------------------------------------------------------------
// [ETAPA 5] Daqui para baixo toda rota é protegida pelo middleware de JWT
// ---------------------------------------------------------------------------
r.use(autenticar);

r.get('/auth/me', auth.me);

// ---------------------------------------------------------------------------
// [ETAPA 3] Transações — GET, POST e PUT
// [ETAPA 7] GET /transacoes aceita ?q=&tipo=&cat=&status=&arquivadas=&de=&ate=&page=&perPage=
// ---------------------------------------------------------------------------
r.get('/transacoes', ler, tx.listar);
r.get('/transacoes/categorias', ler, tx.categorias);
r.get('/transacoes/duplicata', ler, tx.verificarDuplicata);
r.get('/transacoes/:id', ler, idTx, tx.obter);
r.post('/transacoes', operar, exigirCorpo, tx.criar);
r.put('/transacoes/:id', operar, idTx, exigirCorpo, tx.editar);
r.patch('/transacoes/:id', operar, idTx, exigirCorpo, tx.editar);
r.patch('/transacoes/:id/arquivar', operar, idTx, tx.arquivar);
r.patch('/transacoes/:id/restaurar', operar, idTx, tx.restaurar);
// Sem DELETE de propósito: lançamentos só são arquivados (soft delete).

// ---------------------------------------------------------------------------
// [ETAPA 3] Recebíveis — GET, POST e PUT
// ---------------------------------------------------------------------------
r.get('/recebiveis', ler, rec.listar);
r.get('/recebiveis/:id', ler, idRec, rec.obter);
r.post('/recebiveis', operar, exigirCorpo, rec.criar);
r.put('/recebiveis/:id', operar, idRec, exigirCorpo, rec.editar);
r.patch('/recebiveis/:id', operar, idRec, exigirCorpo, rec.editar);
r.patch('/recebiveis/:id/antecipar', operar, idRec, rec.antecipar);
r.patch('/recebiveis/:id/liquidar', operar, idRec, rec.liquidar);

// ---------------------------------------------------------------------------
// [ETAPA 6] Dashboard e agregações  ·  [ETAPA 9] Relatórios
// ---------------------------------------------------------------------------
r.get('/dashboard', ler, rel.dashboard);
r.get('/relatorios/dre', ler, rel.dre);

// ---------------------------------------------------------------------------
// [ETAPA 5] Auditoria e administração (somente papel "admin")
// [ETAPA 7] GET /auditoria aceita ?acao=&q=&page=&perPage=
// ---------------------------------------------------------------------------
r.get('/auditoria', administrar, aud.listar);
r.get('/empresa', ler, conta.obterEmpresa);
r.put('/empresa', administrar, exigirCorpo, conta.atualizarEmpresa);
r.get('/usuarios', administrar, conta.listarUsuarios);
r.put('/usuarios/:id/papel', administrar, idUsuario, exigirCorpo, conta.alterarPapel);

// ---------------------------------------------------------------------------
// [ETAPA 3] Conta do próprio usuário (qualquer papel)
// ---------------------------------------------------------------------------
r.put('/conta/perfil', exigirCorpo, conta.atualizarPerfil);
r.put('/conta/senha', exigirCorpo, conta.alterarSenha);
r.put('/conta/preferencias', exigirCorpo, conta.atualizarPreferencias);

module.exports = r;
