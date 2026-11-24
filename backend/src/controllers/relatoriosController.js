/* =============================================================================
 * ETAPA 6 · Backend — Rotas para dashboard e agregações de dados  (dashboard)
 * ETAPA 9 · Backend — Otimização do banco e rotas de relatórios      (dre)
 *   - busca só as colunas necessárias (select) e só o período pedido
 *   - despesas por categoria agregadas no próprio banco (groupBy + _sum)
 *   - saldo anterior ao período agregado no banco (aggregate), sem trazer linhas
 * Mesmas regras de cálculo que o front usava no app.js.
 * ============================================================================= */
const prisma = require('../config/prisma');
const { hojeISO, dateParaIso, diasEntre } = require('../utils/valores');

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const r2 = (v) => Math.round(v * 100) / 100;

function ultimosMeses(n, hoje) {
  const [a, m] = hoje.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: MESES[d.getUTCMonth()] };
  });
}

// [ETAPA 9] Carrega apenas o necessário para os últimos N meses.
async function carregar(req, nMeses) {
  const empresaId = req.user.empresaId;
  const hoje = hojeISO(req.user.empresa.fusoHorario);
  const meses = ultimosMeses(nMeses, hoje);
  const inicio = new Date(meses[0].key + '-01T00:00:00Z');
  const base = { empresaId, arquivado: false, status: 'concluido' };

  const [noPeriodo, antes, rec] = await Promise.all([
    prisma.transacao.findMany({
      where: { ...base, data: { gte: inicio } },
      select: { tipo: true, valor: true, data: true, categoria: true },
    }),
    // Saldo acumulado antes do período: uma soma por tipo, calculada no banco.
    prisma.transacao.groupBy({ by: ['tipo'], where: { ...base, data: { lt: inicio } }, _sum: { valor: true } }),
    prisma.recebivel.findMany({ where: { empresaId, status: 'aberto' }, orderBy: { vencimento: 'asc' } }),
  ]);

  const concluidas = noPeriodo.map((t) => ({ ...t, valor: Number(t.valor), data: dateParaIso(t.data) }));
  const somaAntes = (tipo) => Number(antes.find((g) => g.tipo === tipo)?._sum.valor ?? 0);
  const saldoAntes = Number(req.user.empresa.saldoInicial) + somaAntes('entrada') - somaAntes('saida');

  const fluxo = (key) => {
    const l = concluidas.filter((t) => t.data.slice(0, 7) === key);
    const soma = (tipo) => r2(l.filter((t) => t.tipo === tipo).reduce((s, t) => s + t.valor, 0));
    return { entradas: soma('entrada'), saidas: soma('saida') };
  };
  const saldoAte = (key) => r2(concluidas
    .filter((t) => t.data.slice(0, 7) <= key)
    .reduce((s, t) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), saldoAntes));

  return { meses, rec, fluxo, saldoAte, hoje, inicio, empresaId };
}

// GET /api/dashboard
async function dashboard(req, res) {
  const { meses, rec: aberto, fluxo, saldoAte, hoje, empresaId } = await carregar(req, 6);
  const pendentes = await prisma.transacao.findMany({
    where: { empresaId, arquivado: false, status: 'pendente' },
    select: { id: true, descricao: true, valor: true },
  });

  const alertas = [
    ...pendentes.map((t) => ({ tom: 'warn', texto: t.descricao, valor: Number(t.valor), extra: 'pendente', alvo: `TX-${t.id}` })),
    ...aberto.map((r) => ({ r, dias: diasEntre(hoje, dateParaIso(r.vencimento)) }))
      .filter(({ dias }) => dias <= 10)
      .map(({ r, dias }) => ({ tom: 'info', texto: `${r.sacado} · vencimento próximo`, dias, alvo: `REC-${r.id}` })),
  ];

  res.json({
    hoje,
    saldoAtual: saldoAte(meses.at(-1).key),
    mesAtual: fluxo(meses.at(-1).key),
    mesAnterior: fluxo(meses.at(-2).key),
    aReceber: { total: r2(aberto.reduce((s, r) => s + Number(r.valorBruto), 0)), titulos: aberto.length },
    serie: meses.map((m) => ({ ...m, saldo: saldoAte(m.key), ...fluxo(m.key) })),
    alertas,
  });
}

// GET /api/relatorios/dre?meses=3|6|12
async function dre(req, res) {
  const n = [3, 6, 12].includes(Number(req.query.meses)) ? Number(req.query.meses) : 6;
  const { meses: lista, fluxo, inicio, empresaId } = await carregar(req, n);
  const meses = lista.map((m) => {
    const f = fluxo(m.key);
    return { ...m, receitas: f.entradas, despesas: f.saidas, resultado: r2(f.entradas - f.saidas) };
  });
  const receitas = r2(meses.reduce((s, m) => s + m.receitas, 0));
  const despesas = r2(meses.reduce((s, m) => s + m.despesas, 0));

  // [ETAPA 9] Agregação feita no banco: soma das saídas por categoria no período.
  const porCategoria = await prisma.transacao.groupBy({
    by: ['categoria'],
    where: { empresaId, arquivado: false, status: 'concluido', tipo: 'saida', data: { gte: inicio } },
    _sum: { valor: true },
  });

  res.json({
    meses,
    total: { receitas, despesas, resultado: r2(receitas - despesas), margem: receitas ? r2(((receitas - despesas) / receitas) * 100) : null },
    despesasPorCategoria: porCategoria
      .map((g) => ({ categoria: g.categoria, valor: r2(Number(g._sum.valor)) }))
      .sort((a, b) => b.valor - a.valor),
  });
}

module.exports = { dashboard, dre };
