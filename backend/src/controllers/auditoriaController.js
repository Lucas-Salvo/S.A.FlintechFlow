/* =============================================================================
 * ETAPA 5 · Arquiteto — Trilha de auditoria (somente leitura, só admin)
 * ETAPA 7 · Backend — Filtros, paginação e busca
 *   GET /api/auditoria?acao=&q=&page=&perPage=
 * ============================================================================= */
const prisma = require('../config/prisma');
const serialize = require('../utils/serializers');
const { texto } = require('../utils/valores');

const ACOES = ['criou', 'editou', 'arquivou', 'bloqueou', 'login'];

async function listar(req, res) {
  const empresaId = req.user.empresaId;
  const where = { empresaId };
  if (ACOES.includes(req.query.acao)) where.acao = req.query.acao;
  const termo = texto(req.query.q);
  if (termo) {
    where.OR = [
      { usuarioNome: { contains: termo } },
      { alvo: { contains: termo } },
      { detalhe: { contains: termo } },
    ];
  }
  const perPage = Math.min(Math.max(Number(req.query.perPage) || 0, 0), 500) || 500;
  const page = Math.max(Number(req.query.page) || 1, 1);

  const [linhas, total, grupos] = await Promise.all([
    prisma.auditoria.findMany({ where, orderBy: { quando: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
    prisma.auditoria.count({ where }),
    prisma.auditoria.groupBy({ by: ['acao'], where: { empresaId }, _count: true }), // [ETAPA 9] índice (empresaId, acao)
  ]);

  const resumo = Object.fromEntries(ACOES.map((a) => [a, 0]));
  grupos.forEach((g) => { resumo[g.acao] = g._count; });

  res.json({
    dados: linhas.map(serialize.auditoria),
    total,
    page,
    perPage,
    totalPaginas: Math.max(1, Math.ceil(total / perPage)),
    resumo,
  });
}

module.exports = { listar };
