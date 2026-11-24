// [ETAPA 1 · Backend] Cliente único do Prisma (ORM) usado pela API inteira.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
