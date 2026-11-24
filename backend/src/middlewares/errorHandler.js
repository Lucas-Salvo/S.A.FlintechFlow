/* =============================================================================
 * ETAPA 8 · Backend — Tratamento centralizado de erros e validação
 *   Todo erro lançado nas rotas (Express 5 captura async automaticamente)
 *   chega aqui e vira um JSON padronizado:
 *     { "erro": "mensagem", "campos": { "campo": "mensagem" } }
 * ============================================================================= */
const AppError = require('../utils/AppError');
const { IS_PROD } = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.message, ...err.extra });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ erro: 'Registro duplicado.' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.', ...(IS_PROD ? {} : { detalhe: err.message }) });
}

module.exports = { notFound, errorHandler };
