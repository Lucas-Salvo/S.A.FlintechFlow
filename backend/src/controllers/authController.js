/* =============================================================================
 * ETAPA 4 · Backend — Desenvolvimento de autenticação JWT
 *   cadastro (bcrypt) · login (gera JWT no cookie httpOnly) · logout · me
 *   recuperação de senha com token de uso único.
 * ETAPA 5 · Arquiteto — Critérios de segurança aplicados aqui:
 *   - senha só como hash bcrypt; nunca é devolvida pela API
 *   - cookie httpOnly + SameSite; Secure em produção
 *   - mesma mensagem para "e-mail não existe" e "senha errada"
 *   - token de recuperação guardado como hash SHA-256, expira em 30 min
 * ============================================================================= */
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET, IS_PROD, FRONTEND_URL } = require('../config/env');
const { COOKIE_NAME } = require('../middlewares/auth');
const AppError = require('../utils/AppError');
const auditar = require('../utils/auditar');
const serialize = require('../utils/serializers');
const { EMAIL_RE, texto } = require('../utils/valores');

const SALT_ROUNDS = 10;
const LEMBRAR_MINUTOS = 60 * 24 * 7; // "Lembrar de mim": 7 dias
// Hash usado quando o e-mail não existe, para o tempo de resposta não revelar isso.
const HASH_FALSO = bcrypt.hashSync('senha-que-nao-existe', SALT_ROUNDS);

// [ETAPA 4] Assina o JWT e grava no cookie httpOnly.
function emitirSessao(res, user, minutos) {
  const token = jwt.sign({ sub: String(user.id), empresaId: user.empresaId, papel: user.papel }, JWT_SECRET, { expiresIn: `${minutos}m` });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,               // JavaScript do navegador não consegue ler
    secure: IS_PROD,              // só HTTPS em produção
    sameSite: IS_PROD ? 'none' : 'lax',
    maxAge: minutos * 60 * 1000,
  });
  return token;
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// POST /api/auth/cadastro
async function cadastro(req, res) {
  const nome = texto(req.body.nome);
  const sobrenome = texto(req.body.sobrenome) || null;
  const email = texto(req.body.email).toLowerCase();
  const senha = req.body.senha ?? '';
  const nomeEmpresa = texto(req.body.empresa);

  const erros = {};
  if (!nome) erros.nome = 'Informe seu nome.';
  if (!EMAIL_RE.test(email)) erros.email = 'Informe um e-mail válido.';
  if (typeof senha !== 'string' || senha.length < 8) erros.senha = 'A senha deve ter pelo menos 8 caracteres.';
  if (Object.keys(erros).length) throw new AppError(400, 'Dados inválidos.', { campos: erros });

  if (await prisma.usuario.findUnique({ where: { email } })) {
    throw new AppError(409, 'Já existe uma conta com este e-mail.', { campos: { email: 'E-mail já cadastrado.' } });
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
  const user = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({ data: { razaoSocial: nomeEmpresa || `Empresa de ${nome}` } });
    // [ETAPA 5] Quem cria a conta vira admin da própria empresa.
    const u = await tx.usuario.create({ data: { nome, sobrenome, email, senhaHash, papel: 'admin', empresaId: empresa.id } });
    await auditar({ usuario: u, acao: 'criou', alvo: 'Conta', detalhe: `Conta criada para ${email}` }, tx);
    return u;
  });

  res.status(201).json({ mensagem: 'Conta criada com sucesso.', usuario: serialize.usuario(user) });
}

// POST /api/auth/login
async function login(req, res) {
  const email = texto(req.body.email).toLowerCase();
  const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
  if (!email || !senha) throw new AppError(400, 'Informe e-mail e senha.');

  const user = await prisma.usuario.findUnique({ where: { email }, include: { empresa: true } });
  const ok = await bcrypt.compare(senha, user ? user.senhaHash : HASH_FALSO);
  if (!user || !ok) throw new AppError(401, 'E-mail ou senha incorretos.');

  const minutos = req.body.lembrar ? LEMBRAR_MINUTOS : user.sessaoMinutos;
  const token = emitirSessao(res, user, minutos);
  await auditar({ usuario: user, acao: 'login', alvo: 'Sessão', detalhe: 'Autenticação concluída com token JWT' });

  res.json({
    usuario: serialize.usuario(user),
    empresa: serialize.empresa(user.empresa),
    expiraEmMinutos: minutos,
    // O token também vai no cookie httpOnly; devolvemos aqui para clientes que usam header (ex.: Insomnia).
    token,
  });
}

// POST /api/auth/logout
function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: IS_PROD, sameSite: IS_PROD ? 'none' : 'lax' });
  res.status(204).end();
}

// GET /api/auth/me
function me(req, res) {
  res.json({ usuario: serialize.usuario(req.user), empresa: serialize.empresa(req.user.empresa) });
}

// POST /api/auth/esqueci-senha
async function esqueciSenha(req, res) {
  const email = texto(req.body.email).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new AppError(400, 'Informe um e-mail válido.');

  const user = await prisma.usuario.findUnique({ where: { email } });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.usuario.update({
      where: { id: user.id },
      data: { resetTokenHash: sha256(token), resetTokenExp: new Date(Date.now() + 30 * 60 * 1000) },
    });
    const link = `${FRONTEND_URL}/redefinir-senha.html?token=${token}`;
    // Sem serviço de e-mail configurado: o link aparece no terminal do servidor.
    console.log(`[recuperação de senha] ${email} -> ${link}`);
  }
  // Mesma resposta exista ou não a conta (não revela e-mails cadastrados).
  res.json({ mensagem: 'Se o endereço estiver cadastrado, você receberá um link para redefinir a senha.' });
}

// POST /api/auth/redefinir-senha
async function redefinirSenha(req, res) {
  const token = texto(req.body.token);
  const senha = req.body.senha ?? '';
  if (!token) throw new AppError(400, 'Token ausente.');
  if (typeof senha !== 'string' || senha.length < 8) throw new AppError(400, 'A senha deve ter pelo menos 8 caracteres.');

  const user = await prisma.usuario.findFirst({ where: { resetTokenHash: sha256(token), resetTokenExp: { gt: new Date() } } });
  if (!user) throw new AppError(400, 'Link inválido ou expirado. Solicite um novo.');

  await prisma.usuario.update({
    where: { id: user.id },
    data: { senhaHash: await bcrypt.hash(senha, SALT_ROUNDS), resetTokenHash: null, resetTokenExp: null },
  });
  await auditar({ usuario: user, acao: 'editou', alvo: 'Conta', detalhe: 'Senha redefinida pelo link de recuperação' });
  res.json({ mensagem: 'Senha redefinida. Faça login com a nova senha.' });
}

module.exports = { cadastro, login, logout, me, esqueciSenha, redefinirSenha, SALT_ROUNDS };
