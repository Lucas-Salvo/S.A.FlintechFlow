/* =============================================================================
 * ETAPA 1 · Backend — Iniciar projeto Node
 *   Ponto de entrada da API. `npm run dev` sobe este arquivo com nodemon.
 *
 * ETAPA 10 · Backend — Build
 *   Em produção: `npm run build` (gera o Prisma Client e aplica as migrations)
 *   e depois `npm start`. Ver package.json e README.
 * ============================================================================= */
const { PORT } = require('./config/env');
const app = require('./app');
const prisma = require('./config/prisma');

const server = app.listen(PORT, () => {
  console.log(`API FinTech Flow rodando em http://localhost:${PORT}/api`);
  console.log(`Documentação (Swagger): http://localhost:${PORT}/api/docs`);
});

async function encerrar() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
