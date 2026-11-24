/* =============================================================================
 * ETAPA 3 · Backend — Rotas GET, POST e PUT de recebíveis
 * ETAPA 8 · Backend — Validação com erros por campo
 * ============================================================================= */
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const auditar = require('../utils/auditar');
const serialize = require('../utils/serializers');
const {
  STATUS_REC, parseValor, dataValida, hojeISO, isoParaDate, dateParaIso, fmtBRL, fmtPct, liquidoRecebivel, texto,
} = require('../utils/valores');

// req.idNum vem do middleware validarId('REC') (ETAPA 5).
async function buscar(req) {
  const r = await prisma.recebivel.findFirst({ where: { id: req.idNum, empresaId: req.user.empresaId } });
  if (!r) throw new AppError(404, 'Recebível não encontrado.');
  return r;
}

function validar(body, atual) {
  const b = body || {};
  const tem = (k) => b[k] !== undefined;
  const sacado = tem('sacado') ? texto(b.sacado) : atual?.sacado;
  const vence = tem('vence') ? b.vence : atual ? dateParaIso(atual.vencimento) : undefined;
  const bruto = tem('bruto') ? parseValor(b.bruto) : atual ? Number(atual.valorBruto) : NaN;
  const taxa = tem('taxa') ? parseValor(b.taxa) : atual ? Number(atual.taxa) : NaN;

  const erros = {};
  if (!sacado || sacado.length < 2) erros.sacado = 'Informe o sacado.';
  if (!dataValida(vence)) erros.vence = 'Informe a data de vencimento (AAAA-MM-DD).';
  if (!Number.isFinite(bruto) || bruto <= 0) erros.bruto = 'O valor bruto precisa ser maior que zero.';
  if (!Number.isFinite(taxa) || taxa < 0 || taxa > 20) erros.taxa = 'Taxa deve estar entre 0% e 20% ao mês.';
  if (Object.keys(erros).length) throw new AppError(400, 'Revise os campos destacados.', { campos: erros });
  return { sacado, vence, bruto, taxa };
}

// GET /api/recebiveis  (filtro opcional: status)
async function listar(req, res) {
  const where = { empresaId: req.user.empresaId };
  if (STATUS_REC.includes(req.query.status)) where.status = req.query.status;
  const lista = await prisma.recebivel.findMany({ where, orderBy: { vencimento: 'asc' } });
  res.json({ dados: lista.map(serialize.recebivel), hoje: hojeISO(req.user.empresa.fusoHorario) });
}

// GET /api/recebiveis/:id
async function obter(req, res) {
  res.json(serialize.recebivel(await buscar(req)));
}

// POST /api/recebiveis
async function criar(req, res) {
  const d = validar(req.body);
  const r = await prisma.$transaction(async (tx) => {
    const novo = await tx.recebivel.create({
      data: { sacado: d.sacado, vencimento: isoParaDate(d.vence), valorBruto: d.bruto, taxa: d.taxa, empresaId: req.user.empresaId },
    });
    await auditar({ usuario: req.user, acao: 'criou', alvo: `REC-${novo.id}`, detalhe: `${d.sacado} · ${fmtBRL(d.bruto)} com vencimento em ${d.vence.split('-').reverse().join('/')}` }, tx);
    return novo;
  });
  res.status(201).json(serialize.recebivel(r));
}

// PUT/PATCH /api/recebiveis/:id
async function editar(req, res) {
  const atual = await buscar(req);
  if (atual.status !== 'aberto') throw new AppError(409, 'Só recebíveis em aberto podem ser editados.');
  const d = validar(req.body, atual);

  const mudancas = [];
  if (d.sacado !== atual.sacado) mudancas.push(`Sacado alterado para "${d.sacado}"`);
  if (d.vence !== dateParaIso(atual.vencimento)) mudancas.push(`Vencimento alterado para ${d.vence.split('-').reverse().join('/')}`);
  if (d.bruto !== Number(atual.valorBruto)) mudancas.push(`Valor bruto alterado de ${fmtBRL(atual.valorBruto)} para ${fmtBRL(d.bruto)}`);
  if (d.taxa !== Number(atual.taxa)) mudancas.push(`Taxa de antecipação ajustada de ${fmtPct(atual.taxa)} para ${fmtPct(d.taxa)}`);
  if (!mudancas.length) return res.json(serialize.recebivel(atual));

  const r = await prisma.$transaction(async (tx) => {
    const upd = await tx.recebivel.update({
      where: { id: atual.id },
      data: { sacado: d.sacado, vencimento: isoParaDate(d.vence), valorBruto: d.bruto, taxa: d.taxa },
    });
    await auditar({ usuario: req.user, acao: 'editou', alvo: `REC-${atual.id}`, detalhe: mudancas.join('; ') }, tx);
    return upd;
  });
  res.json(serialize.recebivel(r));
}

// PATCH /api/recebiveis/:id/antecipar
// Marca como antecipado e lança a entrada do valor líquido no caixa.
async function antecipar(req, res) {
  const atual = await buscar(req);
  if (atual.status !== 'aberto') throw new AppError(409, 'Só recebíveis em aberto podem ser antecipados.');

  const hoje = hojeISO(req.user.empresa.fusoHorario);
  const liquido = liquidoRecebivel(atual.valorBruto, atual.taxa, dateParaIso(atual.vencimento), hoje);

  const { rec, transacao } = await prisma.$transaction(async (tx) => {
    const rec = await tx.recebivel.update({ where: { id: atual.id }, data: { status: 'antecipado', antecipadoEm: new Date() } });
    const transacao = await tx.transacao.create({
      data: {
        descricao: `Antecipação de recebível #${atual.id}`, categoria: 'Antecipação', tipo: 'entrada',
        valor: liquido, data: isoParaDate(hoje), status: 'concluido',
        observacoes: `Sacado: ${atual.sacado} · bruto ${fmtBRL(atual.valorBruto)} · taxa ${fmtPct(atual.taxa)} a.m.`,
        empresaId: req.user.empresaId, responsavelId: req.user.id,
      },
      include: { responsavel: true },
    });
    await auditar({
      usuario: req.user, acao: 'editou', alvo: `REC-${atual.id}`,
      detalhe: `Recebível antecipado · líquido de ${fmtBRL(liquido)} lançado em TX-${transacao.id}`,
    }, tx);
    await auditar({
      usuario: req.user, acao: 'criou', alvo: `TX-${transacao.id}`,
      detalhe: `${transacao.descricao} · entrada de ${fmtBRL(liquido)}`,
    }, tx);
    return { rec, transacao };
  });

  res.json({ recebivel: serialize.recebivel(rec), liquido, transacao: serialize.transacao(transacao) });
}

// PATCH /api/recebiveis/:id/liquidar  (sacado pagou no vencimento)
async function liquidar(req, res) {
  const atual = await buscar(req);
  if (atual.status === 'liquidado') throw new AppError(409, 'Recebível já liquidado.');
  const r = await prisma.$transaction(async (tx) => {
    const upd = await tx.recebivel.update({ where: { id: atual.id }, data: { status: 'liquidado' } });
    await auditar({ usuario: req.user, acao: 'editou', alvo: `REC-${atual.id}`, detalhe: 'Recebível marcado como liquidado' }, tx);
    return upd;
  });
  res.json(serialize.recebivel(r));
}

module.exports = { listar, obter, criar, editar, antecipar, liquidar };
