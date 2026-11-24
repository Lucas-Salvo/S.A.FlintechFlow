/* =============================================================================
 * ETAPA 3 · Backend — Rotas PUT da tela de Configurações
 *   perfil · senha · preferências · empresa
 * ETAPA 5 · Backend/Arquiteto — RBAC: listagem de usuários e troca de papel (admin)
 * ============================================================================= */
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const auditar = require('../utils/auditar');
const serialize = require('../utils/serializers');
const { EMAIL_RE, parseValor, texto } = require('../utils/valores');
const { SALT_ROUNDS } = require('./authController');
const { PAPEIS } = require('../middlewares/auth');

const CNPJ_RE = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/;
const SESSOES = [15, 60, 480];

// PUT /api/conta/perfil
async function atualizarPerfil(req, res) {
  const nome = texto(req.body.nome);
  const sobrenome = texto(req.body.sobrenome) || null;
  const email = texto(req.body.email).toLowerCase();
  const erros = {};
  if (!nome) erros.nome = 'Informe seu nome.';
  if (!EMAIL_RE.test(email)) erros.email = 'Informe um e-mail válido.';
  if (Object.keys(erros).length) throw new AppError(400, 'Dados inválidos.', { campos: erros });

  if (email !== req.user.email && await prisma.usuario.findUnique({ where: { email } })) {
    throw new AppError(409, 'Este e-mail já está em uso.', { campos: { email: 'E-mail já cadastrado.' } });
  }
  const u = await prisma.usuario.update({ where: { id: req.user.id }, data: { nome, sobrenome, email } });
  await auditar({ usuario: u, acao: 'editou', alvo: 'Perfil', detalhe: 'Dados do perfil atualizados' });
  res.json(serialize.usuario(u));
}

// PUT /api/conta/senha
async function alterarSenha(req, res) {
  const { atual, nova } = req.body;
  if (typeof atual !== 'string' || !atual) throw new AppError(400, 'Informe a senha atual.');
  if (typeof nova !== 'string' || nova.length < 8) throw new AppError(400, 'A nova senha deve ter pelo menos 8 caracteres.');
  if (!(await bcrypt.compare(atual, req.user.senhaHash))) {
    throw new AppError(400, 'Senha atual incorreta.', { campos: { atual: 'Senha atual incorreta.' } });
  }
  await prisma.usuario.update({ where: { id: req.user.id }, data: { senhaHash: await bcrypt.hash(nova, SALT_ROUNDS) } });
  await auditar({ usuario: req.user, acao: 'editou', alvo: 'Conta', detalhe: 'Senha alterada' });
  res.json({ mensagem: 'Senha alterada.' });
}

// PUT /api/conta/preferencias
async function atualizarPreferencias(req, res) {
  const b = req.body || {};
  const data = {};
  if (b.sessaoMinutos !== undefined) {
    if (!SESSOES.includes(Number(b.sessaoMinutos))) throw new AppError(400, `sessaoMinutos deve ser ${SESSOES.join(', ')}.`);
    data.sessaoMinutos = Number(b.sessaoMinutos);
  }
  for (const k of ['notifSaldoMinimo', 'notifVencimentos', 'notifResumoSemanal', 'notifAlteracoes']) {
    if (b[k] !== undefined) data[k] = Boolean(b[k]);
  }
  const u = await prisma.usuario.update({ where: { id: req.user.id }, data });
  res.json(serialize.usuario(u));
}

// GET /api/empresa
function obterEmpresa(req, res) {
  res.json(serialize.empresa(req.user.empresa));
}

// PUT /api/empresa
async function atualizarEmpresa(req, res) {
  const b = req.body || {};
  const razaoSocial = texto(b.razaoSocial);
  const cnpj = texto(b.cnpj) || null;
  const erros = {};
  if (!razaoSocial) erros.razaoSocial = 'Informe a razão social.';
  if (cnpj && !CNPJ_RE.test(cnpj)) erros.cnpj = 'CNPJ inválido. Ex.: 00.000.000/0000-00';

  const data = { razaoSocial, cnpj };
  if (b.fusoHorario !== undefined) {
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: b.fusoHorario });
      data.fusoHorario = b.fusoHorario;
    } catch {
      erros.fusoHorario = 'Fuso horário inválido.';
    }
  }
  if (b.saldoInicial !== undefined) {
    const v = parseValor(b.saldoInicial);
    if (!Number.isFinite(v)) erros.saldoInicial = 'Saldo inicial inválido.';
    else data.saldoInicial = v;
  }
  if (Object.keys(erros).length) throw new AppError(400, 'Dados inválidos.', { campos: erros });

  const e = await prisma.empresa.update({ where: { id: req.user.empresaId }, data });
  await auditar({ usuario: req.user, acao: 'editou', alvo: 'Empresa', detalhe: 'Dados da empresa atualizados' });
  res.json(serialize.empresa(e));
}

// [ETAPA 5] GET /api/usuarios  (admin) — usuários da mesma empresa
async function listarUsuarios(req, res) {
  const lista = await prisma.usuario.findMany({ where: { empresaId: req.user.empresaId }, orderBy: { nome: 'asc' } });
  res.json({ dados: lista.map(serialize.usuario) });
}

// [ETAPA 5] PUT /api/usuarios/:id/papel  (admin) — { papel: "admin" | "operador" | "leitor" }
async function alterarPapel(req, res) {
  const { papel } = req.body;
  if (!PAPEIS.includes(papel)) throw new AppError(400, `Papel inválido. Use: ${PAPEIS.join(', ')}.`);
  if (req.idNum === req.user.id) throw new AppError(400, 'Você não pode alterar o próprio papel.');

  const alvo = await prisma.usuario.findFirst({ where: { id: req.idNum, empresaId: req.user.empresaId } });
  if (!alvo) throw new AppError(404, 'Usuário não encontrado.');

  const u = await prisma.usuario.update({ where: { id: alvo.id }, data: { papel } });
  await auditar({ usuario: req.user, acao: 'editou', alvo: `USR-${alvo.id}`, detalhe: `Papel de ${alvo.email} alterado de ${alvo.papel} para ${papel}` });
  res.json(serialize.usuario(u));
}

module.exports = { listarUsuarios, alterarPapel, atualizarPerfil, alterarSenha, atualizarPreferencias, obterEmpresa, atualizarEmpresa };
