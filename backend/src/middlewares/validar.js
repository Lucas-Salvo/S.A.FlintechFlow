
const AppError = require('../utils/AppError');
const { parseId } = require('../utils/valores');

// Aceita "TX-4821" ou "4821" no :id e guarda o número em req.idNum.
function validarId(prefixo) {
  return (req, res, next) => {
    const id = parseId(req.params.id, prefixo);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(400, `ID inválido. Use ${prefixo}-123 ou 123.`);
    req.idNum = id;
    next();
  };
}

// Exige corpo JSON (objeto) em POST/PUT/PATCH de criação/edição.
function exigirCorpo(req, res, next) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new AppError(400, 'Envie um corpo JSON (Content-Type: application/json).');
  }
  next();
}

module.exports = { validarId, exigirCorpo };
