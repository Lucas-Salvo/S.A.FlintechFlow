
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
