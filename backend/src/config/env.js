// [ETAPA 2 · Backend] Configuração lida do .env (ETAPA 1: projeto Node + dotenv).
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET não definido. Copie .env.example para .env e preencha.');
}

module.exports = {
  PORT: Number(process.env.PORT) || 3333,
  JWT_SECRET: process.env.JWT_SECRET,
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://127.0.0.1:5500')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
  IS_PROD: process.env.NODE_ENV === 'production',
};
