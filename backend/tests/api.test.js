/* =============================================================================
 * ETAPA 4 · Arquiteto — Validação do fluxo de dados e endpoints
 * ETAPA 9 · Arquiteto — Estratégia de testes: TESTES DE INTEGRAÇÃO (API + banco)
 *   Sobe a API de verdade contra um banco de teste e percorre os fluxos
 *   principais: login → CRUD → regras → RBAC → logout.
 *   Rodar: npm test
 * ============================================================================= */
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepararBanco, subirApi } = require('./helpers');

let api;
let fechar;

test.before(async () => {
  prepararBanco();
  ({ cliente: api, fechar } = await subirApi());
});
test.after(() => fechar());

test('ETAPA 5: rota protegida sem login devolve 401', async () => {
  const c = api();
  const r = await c('GET', '/transacoes');
  assert.equal(r.status, 401);
});

test('ETAPA 4: login com senha errada falha e com senha certa grava o cookie', async () => {
  const c = api();
  assert.equal((await c('POST', '/auth/login', { email: 'ana@safecash.com', senha: 'errada' })).status, 401);
  const r = await c('POST', '/auth/login', { email: 'ana@safecash.com', senha: 'senha1234' });
  assert.equal(r.status, 200);
  assert.equal(r.dados.usuario.papel, 'admin');
  assert.equal((await c('GET', '/auth/me')).status, 200);
});

test('ETAPA 4: cadastro cria conta admin e recusa e-mail repetido', async () => {
  const c = api();
  const novo = { nome: 'Carla', email: 'carla@teste.com', senha: '12345678', empresa: 'Carla ME' };
  const r = await c('POST', '/auth/cadastro', novo);
  assert.equal(r.status, 201);
  assert.equal(r.dados.usuario.papel, 'admin');
  assert.equal((await c('POST', '/auth/cadastro', novo)).status, 409);
});

test('ETAPA 3 + 8: POST/PUT de transação com validações', async () => {
  const c = api();
  await c('POST', '/auth/login', { email: 'ana@safecash.com', senha: 'senha1234' });

  const negativo = await c('POST', '/transacoes', { tipo: 'saida', desc: 'Teste', valor: '-5', data: '2026-11-01', cat: 'Outros' });
  assert.equal(negativo.status, 400);
  assert.ok(negativo.dados.campos.valor);

  const futura = await c('POST', '/transacoes', { tipo: 'saida', desc: 'Teste', valor: 5, data: '2999-01-01', cat: 'Outros' });
  assert.equal(futura.status, 400);
  assert.ok(futura.dados.campos.data);

  const criada = await c('POST', '/transacoes', { tipo: 'entrada', desc: 'Venda balcão', valor: '1.234,56', data: '2026-11-10', cat: 'Outros' });
  assert.equal(criada.status, 201);
  assert.equal(criada.dados.valor, 1234.56);

  const dup = await c('POST', '/transacoes', { tipo: 'entrada', desc: 'venda balcão', valor: 1234.56, data: '2026-11-10', cat: 'Outros' });
  assert.equal(dup.status, 409);
  assert.equal(dup.dados.codigo, 'DUPLICIDADE');

  const editada = await c('PUT', `/transacoes/${criada.dados.id}`, { valor: 2000 });
  assert.equal(editada.status, 200);
  assert.equal(editada.dados.valor, 2000);

  const arq = await c('PATCH', `/transacoes/${criada.dados.id}/arquivar`, { motivo: 'teste' });
  assert.equal(arq.dados.arquivado, true);
  assert.equal((await c('PUT', `/transacoes/${criada.dados.id}`, { valor: 1 })).status, 409);
});

test('ETAPA 7: filtros, busca e paginação', async () => {
  const c = api();
  await c('POST', '/auth/login', { email: 'ana@safecash.com', senha: 'senha1234' });

  const pag = await c('GET', '/transacoes?perPage=5&page=2');
  assert.equal(pag.dados.dados.length, 5);
  assert.equal(pag.dados.page, 2);
  assert.ok(pag.dados.totalPaginas >= 5);

  const folha = await c('GET', '/transacoes?q=folha');
  assert.ok(folha.dados.total >= 4);
  assert.ok(folha.dados.dados.every((t) => t.cat === 'Folha'));

  const porId = await c('GET', '/transacoes?q=TX-4821');
  assert.equal(porId.dados.dados[0].id, 'TX-4821');

  const saidas = await c('GET', '/transacoes?tipo=saida&status=pendente');
  assert.ok(saidas.dados.dados.every((t) => t.tipo === 'saida' && t.status === 'pendente'));
  assert.equal(saidas.dados.resumo.entradas, 0);
});

test('ETAPA 6 + 9: dashboard e relatório', async () => {
  const c = api();
  await c('POST', '/auth/login', { email: 'ana@safecash.com', senha: 'senha1234' });
  const d = await c('GET', '/dashboard');
  assert.equal(d.status, 200);
  assert.equal(d.dados.serie.length, 6);
  assert.equal(typeof d.dados.saldoAtual, 'number');

  const dre = await c('GET', '/relatorios/dre?meses=12');
  assert.equal(dre.dados.meses.length, 12);
  assert.ok(dre.dados.despesasPorCategoria.length > 0);
});

test('ETAPA 5: RBAC — leitor só lê, operador não administra', async () => {
  const leitor = api();
  await leitor('POST', '/auth/login', { email: 'usuario@empresa.com', senha: 'senha1234' });
  assert.equal((await leitor('GET', '/transacoes')).status, 200);
  assert.equal((await leitor('POST', '/transacoes', { tipo: 'entrada', desc: 'x', valor: 1, data: '2026-11-01' })).status, 403);
  assert.equal((await leitor('PATCH', '/recebiveis/REC-3314/antecipar')).status, 403);

  const operador = api();
  await operador('POST', '/auth/login', { email: 'bruno@safecash.com', senha: 'senha1234' });
  assert.equal((await operador('GET', '/auditoria')).status, 403);
  assert.equal((await operador('PUT', '/empresa', { razaoSocial: 'X' })).status, 403);
  assert.equal((await operador('PATCH', '/recebiveis/REC-3314/antecipar')).status, 200);
});

test('ETAPA 5: middleware valida o ID antes do controller', async () => {
  const c = api();
  await c('POST', '/auth/login', { email: 'ana@safecash.com', senha: 'senha1234' });
  assert.equal((await c('GET', '/transacoes/abc')).status, 400);
  assert.equal((await c('GET', '/transacoes/TX-999999')).status, 404);
});

test('ETAPA 5: auditoria registra as ações e a tentativa de valor negativo', async () => {
  const c = api();
  await c('POST', '/auth/login', { email: 'ana@safecash.com', senha: 'senha1234' });
  const a = await c('GET', '/auditoria?acao=bloqueou');
  assert.ok(a.dados.dados.some((e) => e.detalhe.includes('valor negativo')));
  assert.ok(a.dados.resumo.login >= 1);
});

test('ETAPA 4: logout encerra a sessão', async () => {
  const c = api();
  await c('POST', '/auth/login', { email: 'ana@safecash.com', senha: 'senha1234' });
  assert.equal((await c('POST', '/auth/logout')).status, 204);
  assert.equal((await c('GET', '/auth/me')).status, 401);
});
