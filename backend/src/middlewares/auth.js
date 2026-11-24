
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('../config/env');
const AppError = require('../utils/AppError');

const COOKIE_NAME = 'token';

// [ETAPA 5] Papéis do sistema e o que cada grupo de rotas exige.
const PAPEIS = ['admin', 'operador', 'leitor'];
const PERMISSOES = {
  ler: ['admin', 'operador', 'leitor'],  // consultar transações, recebíveis, dashboard, relatórios
  operar: ['admin', 'operador'],         // criar, editar, arquivar, antecipar
  administrar: ['admin'],                // auditoria, dados da empresa, papéis dos usuários
};

// [ETAPA 4] Verificação do token.
async function autenticar(req, res, next) {
  const header = req.headers.authorization;
  const token = req.cookies?.[COOKIE_NAME] || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) throw new AppError(401, 'Não autenticado.');

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    res.clearCookie(COOKIE_NAME);
    throw new AppError(401, 'Sessão expirada ou inválida. Faça login novamente.');
  }

  const user = await prisma.usuario.findUnique({ where: { id: Number(payload.sub) }, include: { empresa: true } });
  if (!user) throw new AppError(401, 'Usuário não encontrado.');

  req.user = user;
  next();
}

// [ETAPA 5] RBAC: uso nas rotas -> autorizar(...PERMISSOES.operar)
function autorizar(...papeis) {
  return (req, res, next) => {
    if (!req.user) throw new AppError(401, 'Não autenticado.');
    if (!papeis.includes(req.user.papel)) {
      throw new AppError(403, 'Seu perfil não tem permissão para esta ação.', { papelNecessario: papeis });
    }
    next();
  };
}

module.exports = { autenticar, autorizar, COOKIE_NAME, PAPEIS, PERMISSOES };
