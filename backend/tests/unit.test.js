/* =============================================================================
 * ETAPA 9 · Arquiteto — Estratégia de testes: TESTES UNITÁRIOS
 *   Funções puras de validação/cálculo (src/utils/valores.js), sem banco.
 *   Rodar: npm test
 * ============================================================================= */
const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/utils/valores');

test('parseValor entende formato brasileiro e americano', () => {
  assert.equal(v.parseValor('1.250,50'), 1250.5);
  assert.equal(v.parseValor('1250.5'), 1250.5);
  assert.equal(v.parseValor('R$ 10'), 10);
  assert.equal(v.parseValor(99.999), 100);
  assert.ok(Number.isNaN(v.parseValor('abc')));
  assert.ok(Number.isNaN(v.parseValor('')));
  assert.equal(v.parseValor('-10'), -10); // negativo é lido; a regra de negócio é quem bloqueia
});

test('dataValida rejeita datas inexistentes e formato errado', () => {
  assert.equal(v.dataValida('2026-11-20'), true);
  assert.equal(v.dataValida('2026-02-31'), false);
  assert.equal(v.dataValida('20/11/2026'), false);
  assert.equal(v.dataValida(undefined), false);
});

test('parseId aceita com e sem prefixo', () => {
  assert.equal(v.parseId('TX-4821', 'TX'), 4821);
  assert.equal(v.parseId('tx-4821', 'TX'), 4821);
  assert.equal(v.parseId('4821', 'TX'), 4821);
  assert.ok(Number.isNaN(v.parseId('REC-1', 'TX')));
});

test('liquidoRecebivel desconta a taxa proporcional aos dias', () => {
  // 30 dias a 2% a.m. -> desconto de 2%
  assert.equal(v.liquidoRecebivel(1000, 2, '2026-12-01', '2026-11-01'), 980);
  // vencido: sem desconto
  assert.equal(v.liquidoRecebivel(1000, 2, '2026-10-01', '2026-11-01'), 1000);
});

test('diasEntre conta dias corridos', () => {
  assert.equal(v.diasEntre('2026-11-01', '2026-11-11'), 10);
  assert.equal(v.diasEntre('2026-11-11', '2026-11-01'), -10);
});
