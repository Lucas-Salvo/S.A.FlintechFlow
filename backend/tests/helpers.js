/* =============================================================================
 * ETAPA 9 · Arquiteto — Estratégia de testes (apoio dos testes de API)
 *   Usa um banco separado (prisma/test.db), recriado e populado pelo seed a
 *   cada execução, e sobe a API numa porta aleatória.
 * ============================================================================= */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-so-para-testes';
process.env.NODE_ENV = 'test';

// Apaga só o banco de TESTE, recria as tabelas e roda o seed.
function prepararBanco() {
  const raiz = path.join(__dirname, '..');
  for (const f of ['test.db', 'test.db-journal']) fs.rmSync(path.join(raiz, 'prisma', f), { force: true });
  const opts = { cwd: raiz, env: process.env, stdio: 'ignore' };
  execSync('npx prisma migrate deploy', opts);
  execSync('node prisma/seed.js', opts);
}

// Sobe a API e devolve um cliente que guarda o cookie de sessão (como o navegador).
async function subirApi() {
  const app = require('../src/app');
  const server = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  function cliente() {
    let cookie = '';
    return async (metodo, caminho, corpo) => {
      const res = await fetch(base + caminho, {
        method: metodo,
        headers: { ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const dados = res.status === 204 ? null : await res.json();
      return { status: res.status, dados };
    };
  }

  async function fechar() {
    server.close();
    await require('../src/config/prisma').$disconnect();
  }
  return { cliente, fechar };
}

module.exports = { prepararBanco, subirApi };
