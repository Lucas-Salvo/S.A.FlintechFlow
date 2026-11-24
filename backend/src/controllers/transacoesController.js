/* =============================================================================
 * ETAPA 3 · Backend — Rotas GET, POST e PUT de transações
 * ETAPA 7 · Backend — Filtros, paginação e busca (função `listar`)
 * ETAPA 8 · Backend — Validação (função `validar`) com erros por campo
 * ETAPA 9 · Backend — Consultas feitas no banco, usando os índices do schema
 * ============================================================================= */
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const auditar = require('../utils/auditar');
const serialize = require('../utils/serializers');
const {
  CATEGORIAS, TIPOS, STATUS_TX, parseValor, dataValida, hojeISO, isoParaDate, dateParaIso, fmtBRL, texto,
} = require('../utils/valores');

const incluir = { responsavel: true };

// req.idNum vem do middleware validarId('TX') (ETAPA 5).
async function buscar(req) {
  const t = await prisma.transacao.findFirst({ where: { id: req.idNum, empresaId: req.user.empresaId }, include: incluir });
  if (!t) throw new AppError(404, 'Transação não encontrada.');
  return t;
}

// [ETAPA 9] Usa o índice (empresaId, valor, data).
// Procura lançamento ativo com mesmo valor, data e descrição (sem diferenciar maiúsculas).
async function acharDuplicata(empresaId, { valor, data, descricao }, ignorarId) {
  const candidatos = await prisma.transacao.findMany({
    where: { empresaId, arquivado: false, valor, data: isoParaDate(data), NOT: ignorarId ? { id: ignorarId } : undefined },
    include: incluir,
  });
  return candidatos.find((t) => t.descricao.toLowerCase() === descricao.toLowerCase()) || null;
}

// [ETAPA 8] Valida o corpo (criação ou edição). Em edição, campos ausentes mantêm o valor atual.
async function validar(req, atual) {
  const b = req.body || {};
  const tem = (k) => b[k] !== undefined;
  const erros = {};

  const descricao = tem('desc') ? texto(b.desc) : atual?.descricao;
  const tipo = tem('tipo') ? b.tipo : atual?.tipo ?? 'entrada';
  const categoria = tem('cat') ? b.cat : atual?.categoria ?? 'Outros';
  const status = tem('status') ? b.status : atual?.status ?? 'concluido';
  const data = tem('data') ? b.data : atual ? dateParaIso(atual.data) : undefined;
  const valor = tem('valor') ? parseValor(b.valor) : atual ? Number(atual.valor) : NaN;
  const observacoes = tem('obs') ? texto(b.obs) || null : atual?.observacoes ?? null;

  if (!descricao || descricao.length < 3) erros.desc = 'Informe uma descrição com pelo menos 3 caracteres.';
  else if (descricao.length > 120) erros.desc = 'A descrição pode ter no máximo 120 caracteres.';
  if (!TIPOS.includes(tipo)) erros.tipo = 'Tipo deve ser "entrada" ou "saida".';
  if (!CATEGORIAS.includes(categoria)) erros.cat = `Categoria inválida. Use: ${CATEGORIAS.join(', ')}.`;
  if (!STATUS_TX.includes(status)) erros.status = 'Status deve ser "concluido" ou "pendente".';
  if (observacoes && observacoes.length > 500) erros.obs = 'Observações podem ter no máximo 500 caracteres.';

  if (!Number.isFinite(valor)) erros.valor = 'Informe um valor numérico, por exemplo 1.250,00.';
  else if (valor < 0) erros.valor = 'Valores negativos não são aceitos. Para registrar uma saída, selecione o tipo Saída.';
  else if (valor === 0) erros.valor = 'O valor precisa ser maior que zero.';

  if (!data) erros.data = 'Informe a data do lançamento.';
  else if (!dataValida(data)) erros.data = 'Data inválida. Use o formato AAAA-MM-DD.';
  else if (data > hojeISO(req.user.empresa.fusoHorario)) erros.data = 'A data não pode ser futura.';

  if (Object.keys(erros).length) {
    // Tentativa de valor negativo fica registrada na auditoria.
    if (Number.isFinite(valor) && valor < 0) {
      await auditar({
        usuario: null,
        empresaId: req.user.empresaId,
        acao: 'bloqueou',
        alvo: atual ? `TX-${atual.id}` : 'Nova transação',
        detalhe: `Tentativa de valor negativo (${fmtBRL(valor)}) por ${req.user.email} bloqueada pela validação da API`,
      });
    }
    throw new AppError(400, 'Revise os campos destacados.', { campos: erros });
  }

  return { descricao, tipo, categoria, status, data, valor, observacoes };
}

// -----------------------------------------------------------------------------
// [ETAPA 7] GET /api/transacoes — filtros, busca e paginação feitos no banco
//   ?q=        busca por ID (TX-4821), descrição, categoria ou responsável
//   ?tipo=     entrada | saida
//   ?cat=      categoria
//   ?status=   concluido | pendente
//   ?arquivadas=true   inclui arquivadas
//   ?de= &ate=         período (AAAA-MM-DD)
//   ?page= &perPage=   paginação (sem perPage devolve tudo)
// Resposta: { dados, total, page, perPage, totalPaginas, resumo:{entradas,saidas,liquido} }
// -----------------------------------------------------------------------------
function montarFiltro(req) {
  const { q, tipo, cat, status, arquivadas, de, ate } = req.query;
  const where = { empresaId: req.user.empresaId };
  if (arquivadas !== 'true') where.arquivado = false;
  if (TIPOS.includes(tipo)) where.tipo = tipo;
  if (cat && cat !== 'todas') where.categoria = String(cat);
  if (STATUS_TX.includes(status)) where.status = status;
  if (dataValida(de) || dataValida(ate)) {
    where.data = {};
    if (dataValida(de)) where.data.gte = isoParaDate(de);
    if (dataValida(ate)) where.data.lte = isoParaDate(ate);
  }
  const termo = texto(q);
  if (termo) {
    const ou = [
      { descricao: { contains: termo } },
      { categoria: { contains: termo } },
      { responsavel: { nome: { contains: termo } } },
      { responsavel: { sobrenome: { contains: termo } } },
    ];
    const id = termo.toUpperCase().match(/^(?:TX-?)?(\d+)$/);
    if (id) ou.push({ id: Number(id[1]) });
    where.OR = ou;
  }
  return where;
}

async function listar(req, res) {
  const where = montarFiltro(req);
  const perPage = Math.min(Math.max(Number(req.query.perPage) || 0, 0), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);

  // Três consultas em paralelo: página, total e somatório por tipo (agregação no banco).
  const [linhas, total, somas] = await Promise.all([
    prisma.transacao.findMany({
      where,
      include: incluir,
      orderBy: [{ data: 'desc' }, { id: 'desc' }],
      ...(perPage ? { skip: (page - 1) * perPage, take: perPage } : {}),
    }),
    prisma.transacao.count({ where }),
    prisma.transacao.groupBy({ by: ['tipo'], where: { ...where, arquivado: false }, _sum: { valor: true } }),
  ]);

  const soma = (t) => Number(somas.find((g) => g.tipo === t)?._sum.valor ?? 0);
  const entradas = soma('entrada');
  const saidas = soma('saida');

  res.json({
    dados: linhas.map(serialize.transacao),
    total,
    page: perPage ? page : 1,
    perPage: perPage || total,
    totalPaginas: perPage ? Math.max(1, Math.ceil(total / perPage)) : 1,
    resumo: { entradas, saidas, liquido: Math.round((entradas - saidas) * 100) / 100 },
  });
}

// GET /api/transacoes/categorias
function categorias(req, res) {
  res.json({ dados: CATEGORIAS });
}

// GET /api/transacoes/duplicata?desc=&valor=&data=   (usado pela pré-visualização)
async function verificarDuplicata(req, res) {
  const valor = parseValor(req.query.valor);
  const descricao = texto(req.query.desc);
  const { data } = req.query;
  if (!Number.isFinite(valor) || !descricao || !dataValida(data)) return res.json({ duplicata: null });
  const dup = await acharDuplicata(req.user.empresaId, { valor, data, descricao });
  res.json({ duplicata: dup ? serialize.transacao(dup) : null });
}

// GET /api/transacoes/:id
async function obter(req, res) {
  res.json(serialize.transacao(await buscar(req)));
}

// POST /api/transacoes
async function criar(req, res) {
  const d = await validar(req);

  const dup = await acharDuplicata(req.user.empresaId, d);
  if (dup && req.body.confirmarDuplicidade !== true) {
    throw new AppError(409, `Já existe o lançamento TX-${dup.id} com mesmo valor, data e descrição.`, {
      codigo: 'DUPLICIDADE',
      duplicata: serialize.transacao(dup),
      campos: { dup: 'Confirme que este lançamento não é uma duplicidade.' },
    });
  }

  const t = await prisma.$transaction(async (tx) => {
    const nova = await tx.transacao.create({
      data: {
        descricao: d.descricao, tipo: d.tipo, categoria: d.categoria, status: d.status,
        valor: d.valor, data: isoParaDate(d.data), observacoes: d.observacoes,
        empresaId: req.user.empresaId, responsavelId: req.user.id,
      },
      include: incluir,
    });
    await auditar({
      usuario: req.user, acao: 'criou', alvo: `TX-${nova.id}`,
      detalhe: `${d.descricao} · ${d.tipo === 'entrada' ? 'entrada' : 'saída'} de ${fmtBRL(d.valor)}${dup ? ' (duplicidade confirmada)' : ''}`,
    }, tx);
    return nova;
  });

  res.status(201).json(serialize.transacao(t));
}

// PUT/PATCH /api/transacoes/:id
async function editar(req, res) {
  const atual = await buscar(req);
  if (atual.arquivado) throw new AppError(409, 'Restaure o lançamento antes de editá-lo.');

  const d = await validar(req, atual);
  const mudancas = [];
  const cmp = (rotulo, antes, depois, f = (x) => x) => {
    if (String(antes) !== String(depois)) mudancas.push(`${rotulo} alterado de ${f(antes)} para ${f(depois)}`);
  };
  cmp('Valor', Number(atual.valor), d.valor, fmtBRL);
  cmp('Descrição', atual.descricao, d.descricao, (x) => `"${x}"`);
  cmp('Tipo', atual.tipo, d.tipo);
  cmp('Categoria', atual.categoria, d.categoria);
  cmp('Status', atual.status, d.status);
  cmp('Data', dateParaIso(atual.data), d.data, (x) => x.split('-').reverse().join('/'));
  if ((atual.observacoes || null) !== d.observacoes) mudancas.push('Observações alteradas');

  if (!mudancas.length) return res.json(serialize.transacao(atual));

  const t = await prisma.$transaction(async (tx) => {
    const upd = await tx.transacao.update({
      where: { id: atual.id },
      data: {
        descricao: d.descricao, tipo: d.tipo, categoria: d.categoria, status: d.status,
        valor: d.valor, data: isoParaDate(d.data), observacoes: d.observacoes,
      },
      include: incluir,
    });
    await auditar({ usuario: req.user, acao: 'editou', alvo: `TX-${atual.id}`, detalhe: mudancas.join('; ') }, tx);
    return upd;
  });
  res.json(serialize.transacao(t));
}

// PATCH /api/transacoes/:id/arquivar   (soft delete: o registro continua no banco)
async function arquivar(req, res) {
  const atual = await buscar(req);
  if (atual.arquivado) throw new AppError(409, 'Lançamento já está arquivado.');
  const motivo = texto(req.body?.motivo) || null;

  const t = await prisma.$transaction(async (tx) => {
    const upd = await tx.transacao.update({
      where: { id: atual.id },
      data: { arquivado: true, arquivadoEm: new Date(), motivoArquivamento: motivo },
      include: incluir,
    });
    await auditar({
      usuario: req.user, acao: 'arquivou', alvo: `TX-${atual.id}`,
      detalhe: `Lançamento arquivado (soft delete)${motivo ? ` · motivo: ${motivo}` : ''}`,
    }, tx);
    return upd;
  });
  res.json(serialize.transacao(t));
}

// PATCH /api/transacoes/:id/restaurar
async function restaurar(req, res) {
  const atual = await buscar(req);
  if (!atual.arquivado) throw new AppError(409, 'Lançamento não está arquivado.');

  const t = await prisma.$transaction(async (tx) => {
    const upd = await tx.transacao.update({
      where: { id: atual.id },
      data: { arquivado: false, arquivadoEm: null, motivoArquivamento: null },
      include: incluir,
    });
    await auditar({ usuario: req.user, acao: 'editou', alvo: `TX-${atual.id}`, detalhe: 'Lançamento restaurado do arquivo' }, tx);
    return upd;
  });
  res.json(serialize.transacao(t));
}

module.exports = { listar, categorias, verificarDuplicata, obter, criar, editar, arquivar, restaurar };
