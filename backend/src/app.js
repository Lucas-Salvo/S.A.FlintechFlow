
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const { CORS_ORIGIN } = require('./config/env');
const routes = require('./routes');
const openapi = require('./docs/openapi');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// [ETAPA 4] CORS com credentials para o navegador enviar o cookie do JWT.
app.use(cors({
  origin(origin, cb) {
    // Sem origin = Insomnia/Postman/curl. Com origin, só as liberadas no .env.
    if (!origin || CORS_ORIGIN.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser()); // [ETAPA 4] lê o cookie "token"

app.get('/api/health', (req, res) => res.json({ ok: true }));

// [ETAPA 10 · Arquiteto] Documentação final da API (Swagger).
app.get('/api/docs.json', (req, res) => res.json(openapi));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'FinTech Flow API' }));

app.use('/api', routes);

// [ETAPA 8] Tratamento centralizado de erros (sempre o último middleware).
app.use(notFound);
app.use(errorHandler);

module.exports = app;
