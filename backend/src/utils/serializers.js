// [ETAPA 3 · Backend] Converte os registros do banco para o formato que o front já usa (app.js).
const { dateParaIso } = require('./valores');

const nomeCompleto = (u) => [u.nome, u.sobrenome].filter(Boolean).join(' ');

const transacao = (t) => ({
  id: `TX-${t.id}`,
  desc: t.descricao,
  cat: t.categoria,
  tipo: t.tipo,
  valor: Number(t.valor),
  data: dateParaIso(t.data),
  status: t.status,
  obs: t.observacoes,
  resp: t.responsavel ? nomeCompleto(t.responsavel) : null,
  arquivado: t.arquivado,
  arquivadoEm: t.arquivadoEm,
  motivoArquivamento: t.motivoArquivamento,
  criadoEm: t.criadoEm,
});

const recebivel = (r) => ({
  id: `REC-${r.id}`,
  sacado: r.sacado,
  vence: dateParaIso(r.vencimento),
  bruto: Number(r.valorBruto),
  taxa: Number(r.taxa),
  status: r.status,
  antecipadoEm: r.antecipadoEm,
});

const auditoria = (a) => ({
  id: a.id,
  quando: a.quando.toISOString(),
  usuario: a.usuarioNome,
  acao: a.acao,
  alvo: a.alvo,
  detalhe: a.detalhe,
});

const usuario = (u) => ({
  id: u.id,
  nome: u.nome,
  sobrenome: u.sobrenome,
  nomeCompleto: nomeCompleto(u),
  email: u.email,
  papel: u.papel, // [ETAPA 5] RBAC
  empresaId: u.empresaId,
  preferencias: {
    sessaoMinutos: u.sessaoMinutos,
    notifSaldoMinimo: u.notifSaldoMinimo,
    notifVencimentos: u.notifVencimentos,
    notifResumoSemanal: u.notifResumoSemanal,
    notifAlteracoes: u.notifAlteracoes,
  },
});

const empresa = (e) => ({
  id: e.id,
  razaoSocial: e.razaoSocial,
  cnpj: e.cnpj,
  fusoHorario: e.fusoHorario,
  saldoInicial: Number(e.saldoInicial),
});

module.exports = { nomeCompleto, transacao, recebivel, auditoria, usuario, empresa };
