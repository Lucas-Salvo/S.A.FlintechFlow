// [ETAPA 8 · Backend] Erro "esperado" da API, convertido em JSON pelo middlewares/errorHandler.js.
class AppError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

module.exports = AppError;
