const prisma = require('../config/prisma');
const { nomeCompleto } = require('./serializers');

// [ETAPA 5 · Arquiteto] Critério de segurança: toda ação relevante gera um evento de auditoria.
// Registra um evento na trilha de auditoria.
// `db` permite usar dentro de uma transação do Prisma (tx).
function auditar({ usuario, empresaId, acao, alvo, detalhe }, db = prisma) {
  return db.auditoria.create({
    data: {
      acao,
      alvo,
      detalhe,
      usuarioNome: usuario ? nomeCompleto(usuario) : 'Sistema',
      usuarioId: usuario ? usuario.id : null,
      empresaId: empresaId ?? usuario.empresaId,
    },
  });
}

module.exports = auditar;
