/* =============================================================================
 * ETAPA 9 · Arquiteto — Estratégia de testes: TESTE E2E (navegador real)
 *   Percorre o sistema como um usuário, com os três papéis do RBAC.
 *   Pré-requisitos: API rodando (npm run dev) e front servido na porta 5500.
 *   cd e2e && npm install && npx playwright install chromium && npm test
 * ============================================================================= */
const { chromium } = require('playwright');
const SHOT = __dirname + '/';
const W = process.env.FRONT_URL || 'http://127.0.0.1:5500/';
(async () => {
  const b = await chromium.launch();
  const erros = [];
  async function login(email) {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => erros.push(email + ': ' + e.message));
    await p.goto(W + 'login.html');
    await p.fill('#loginEmail', email); await p.fill('#loginSenha', 'senha1234');
    await p.click('#loginBtn'); await p.waitForURL(/dashboard/); await p.waitForTimeout(900);
    return p;
  }
  const p = await login('ana@safecash.com');
  console.log('dash:', await p.textContent('#kpiSaldo'), '| papel:', await p.textContent('.side-foot span'), '| alertas:', await p.locator('#alertas li').count(), '| últimas:', await p.locator('#ultimasTx tr').count());
  await p.screenshot({ path: SHOT + 'dash2.png' });

  await p.goto(W + 'transacoes.html'); await p.waitForTimeout(900);
  console.log('tx:', await p.locator('#txBody tr').count(), await p.textContent('#resumoQtd'), await p.textContent('#pager span'));
  await p.fill('#busca', 'folha'); await p.waitForTimeout(900);
  console.log('busca folha:', await p.textContent('#resumoQtd'), await p.textContent('#resumoSai'));
  await p.fill('#busca', ''); await p.waitForTimeout(700);
  await p.click('[data-pag="2"]'); await p.waitForTimeout(700);
  console.log('pág:', await p.textContent('#pager span'));
  await p.click('#txBody [data-arquivar]'); await p.waitForTimeout(900);
  console.log('toast:', await p.locator('.toast').last().textContent());

  await p.goto(W + 'nova-transacao.html'); await p.waitForTimeout(600);
  await p.check('input[value="saida"]', { force: true });
  await p.fill('#desc', 'Pagamento de aluguel'); await p.fill('#valor', '2.000,00'); await p.fill('#data', '2026-11-20');
  await p.waitForTimeout(900);
  console.log('dup box visível:', await p.isVisible('#boxDup'));
  await p.check('#confirmaDup'); await p.click('button[type="submit"]'); await p.waitForTimeout(900);
  console.log('toast:', await p.locator('.toast').last().textContent());

  await p.goto(W + 'relatorios.html'); await p.waitForTimeout(900);
  console.log('dre linhas:', await p.locator('#dre tbody tr').count(), 'cats:', await p.locator('#cats li').count());
  await p.goto(W + 'auditoria.html'); await p.waitForTimeout(900);
  console.log('aud:', await p.textContent('#auditQtd'));
  await p.fill('#buscaAud', 'aluguel'); await p.waitForTimeout(900);
  console.log('aud busca:', await p.textContent('#auditQtd'));

  const op = await login('bruno@safecash.com');
  console.log('operador vê auditoria no menu?', await op.isVisible('[data-nav="auditoria"]'));
  await op.goto(W + 'auditoria.html'); await op.waitForTimeout(900);
  console.log('operador abre auditoria -> modal:', await op.textContent('.modal h2'));
  await op.screenshot({ path: SHOT + 'modal.png' });
  await op.goto(W + 'recebiveis.html'); await op.waitForTimeout(900);
  await op.click('[data-antecipar]'); await op.waitForTimeout(900);
  console.log('toast:', await op.locator('.toast').last().textContent());

  const le = await login('usuario@empresa.com');
  console.log('leitor: nova-transacao no menu?', await le.isVisible('[data-nav="nova-transacao"]'));
  await le.goto(W + 'transacoes.html'); await le.waitForTimeout(900);
  console.log('leitor botões arquivar:', await le.locator('[data-arquivar]').count());
  await le.goto(W + 'configuracoes.html'); await le.waitForTimeout(900);
  console.log('leitor empresa desabilitada:', await le.isDisabled('#eRazao'));

  console.log('erros JS:', erros);
  await b.close();
})();
