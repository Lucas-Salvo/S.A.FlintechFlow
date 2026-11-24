/* ==========================================================================
   ETAPA 4 · Frontend — Tela de login com autenticação
     Login   -> POST /api/auth/login    (JWT em cookie httpOnly)
     Cadastro-> POST /api/auth/cadastro
   A validação roda no navegador e é repetida na API (ETAPA 8 do backend).
   ETAPA 8 · Frontend — loader no botão e erros por campo
   ========================================================================== */

const tabs = document.querySelectorAll('.tab');
const tabsWrapper = document.getElementById('authTabs');
const formLogin = document.getElementById('formLogin');
const formCad = document.getElementById('formCadastro');
const successMsg = document.getElementById('successMsg');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const cadastroForm = document.getElementById('cadastroForm');
const cadastroBtn = document.getElementById('cadastroBtn');
const cadSenhaInput = document.getElementById('cadSenha');
const pwFill = document.getElementById('pwFill');
const pwLabel = document.getElementById('pwLabel');

function switchTab(target) {
  tabs.forEach((t) => {
    const ativo = t.dataset.tab === target;
    t.classList.toggle('active', ativo);
    t.setAttribute('aria-selected', ativo);
  });
  tabsWrapper.dataset.active = target;
  formLogin.classList.toggle('hidden', target !== 'login');
  formCad.classList.toggle('hidden', target !== 'cadastro');
  successMsg.classList.add('hidden');
  clearAllErrors();
}

tabs.forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
document.querySelectorAll('.link-btn').forEach((btn) =>
  btn.addEventListener('click', () => switchTab(btn.dataset.switch)));
if (window.location.hash === '#cadastro') switchTab('cadastro');

document.querySelectorAll('.toggle-pw').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const mostrando = input.type === 'text';
    input.type = mostrando ? 'password' : 'text';
    btn.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
    btn.querySelector('.eye-show').classList.toggle('hidden', !mostrando);
    btn.querySelector('.eye-hide').classList.toggle('hidden', mostrando);
  });
});

function showError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (el) el.textContent = msg;
}
function clearError(fieldId) {
  const el = document.getElementById(fieldId);
  if (el) el.textContent = '';
}
function clearAllErrors() {
  document.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
  document.querySelectorAll('.input').forEach((el) => el.classList.remove('is-invalid', 'is-valid'));
}
function setInputState(input, valid) {
  input.classList.toggle('is-invalid', !valid);
  input.classList.toggle('is-valid', valid);
}
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.querySelector('.btn-text').classList.toggle('hidden', loading);
  btn.querySelector('.btn-loader').classList.toggle('hidden', !loading);
}
// Mostra, nos campos do formulário, os erros que a API devolveu.
function mostrarErrosApi(err, mapa) {
  Object.entries(err.campos || {}).forEach(([campo, msg]) => {
    if (!mapa[campo]) return;
    showError(mapa[campo][0], msg);
    setInputState(document.getElementById(mapa[campo][1]), false);
  });
}

/* Força da senha */
const strengthLevels = [
  { pct: 0,   color: 'var(--red)',    label: 'Muito fraca' },
  { pct: 25,  color: 'var(--red)',    label: 'Fraca' },
  { pct: 50,  color: 'var(--amber)',  label: 'Razoável' },
  { pct: 75,  color: 'var(--lav-500)',   label: 'Boa' },
  { pct: 100, color: 'var(--green)',  label: 'Forte' },
];
function calcStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}
if (cadSenhaInput) {
  cadSenhaInput.addEventListener('input', () => {
    const pw = cadSenhaInput.value;
    if (!pw) {
      pwFill.style.width = '0%';
      pwLabel.textContent = 'Força da senha';
      return;
    }
    const level = strengthLevels[calcStrength(pw)];
    pwFill.style.width = level.pct + '%';
    pwFill.style.background = level.color;
    pwLabel.textContent = level.label;
  });
}

/* Login */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllErrors();

  const email = loginForm.email.value.trim();
  const senha = loginForm.senha.value;
  let valid = true;

  if (!email || !validateEmail(email)) {
    showError('loginEmailErr', 'Informe um e-mail válido.');
    setInputState(loginForm.email, false);
    valid = false;
  } else {
    setInputState(loginForm.email, true);
  }

  if (!senha || senha.length < 6) {
    showError('loginSenhaErr', 'A senha deve ter pelo menos 6 caracteres.');
    setInputState(loginForm.senha, false);
    valid = false;
  } else {
    setInputState(loginForm.senha, true);
  }

  if (!valid) return;

  setLoading(loginBtn, true);
  try {
    await api.post('/auth/login', {
      email,
      senha,
      lembrar: document.getElementById('rememberMe')?.checked || false,
    }, { redirecionar401: false });
    window.location.href = 'dashboard.html';
  } catch (err) {
    setLoading(loginBtn, false);
    showError('loginSenhaErr', err.message);
    if (err.status === 401) {
      setInputState(loginForm.email, false);
      setInputState(loginForm.senha, false);
    }
  }
});

/* Cadastro */
cadastroForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllErrors();

  const nome = cadastroForm.nome.value.trim();
  const email = cadastroForm.email.value.trim();
  const senha = cadastroForm.senha.value;
  const conf = cadastroForm.senha_conf.value;
  const terms = document.getElementById('acceptTerms').checked;
  let valid = true;

  if (!nome) {
    showError('cadNomeErr', 'Informe seu nome.');
    setInputState(document.getElementById('cadNome'), false);
    valid = false;
  } else {
    setInputState(document.getElementById('cadNome'), true);
  }

  if (!email || !validateEmail(email)) {
    showError('cadEmailErr', 'Informe um e-mail válido.');
    setInputState(document.getElementById('cadEmail'), false);
    valid = false;
  } else {
    setInputState(document.getElementById('cadEmail'), true);
  }

  if (!senha || senha.length < 8) {
    showError('cadSenhaErr', 'A senha deve ter pelo menos 8 caracteres.');
    setInputState(cadSenhaInput, false);
    valid = false;
  } else {
    setInputState(cadSenhaInput, true);
  }

  if (senha !== conf) {
    showError('cadSenhaConfErr', 'As senhas não coincidem.');
    setInputState(document.getElementById('cadSenhaConf'), false);
    valid = false;
  } else if (conf) {
    setInputState(document.getElementById('cadSenhaConf'), true);
  }

  if (!terms) {
    showError('termsErr', 'Você precisa aceitar os termos para continuar.');
    valid = false;
  }

  if (!valid) return;

  setLoading(cadastroBtn, true);
  try {
    await api.post('/auth/cadastro', {
      nome,
      sobrenome: cadastroForm.sobrenome?.value.trim() || '',
      empresa: cadastroForm.empresa?.value.trim() || '',
      email,
      senha,
    });
    formCad.classList.add('hidden');
    successMsg.classList.remove('hidden');
    loginForm.email.value = email;
  } catch (err) {
    mostrarErrosApi(err, {
      nome: ['cadNomeErr', 'cadNome'],
      email: ['cadEmailErr', 'cadEmail'],
      senha: ['cadSenhaErr', 'cadSenha'],
    });
    if (!Object.keys(err.campos || {}).length) showError('termsErr', err.message);
  } finally {
    setLoading(cadastroBtn, false);
  }
});

document.getElementById('goLogin').addEventListener('click', () => {
  successMsg.classList.add('hidden');
  switchTab('login');
});

/* Ao sair do campo, valida o e-mail */
document.querySelectorAll('input[type="email"]').forEach((input) => {
  input.addEventListener('blur', () => {
    if (!input.value) return;
    const ok = validateEmail(input.value);
    setInputState(input, ok);
    const errId = input.id === 'loginEmail' ? 'loginEmailErr' : 'cadEmailErr';
    showError(errId, ok ? '' : 'E-mail inválido.');
  });
});

/* Confirmação de senha em tempo real */
document.getElementById('cadSenhaConf').addEventListener('input', (e) => {
  const conf = e.target.value;
  const senha = cadSenhaInput.value;
  if (!conf) {
    e.target.classList.remove('is-invalid', 'is-valid');
    clearError('cadSenhaConfErr');
    return;
  }
  const ok = conf === senha;
  setInputState(e.target, ok);
  showError('cadSenhaConfErr', ok ? '' : 'As senhas não coincidem.');
});
