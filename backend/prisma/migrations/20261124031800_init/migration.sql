-- CreateTable
CREATE TABLE "Empresa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT,
    "fusoHorario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "saldoInicial" DECIMAL NOT NULL DEFAULT 0,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "sobrenome" TEXT,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "sessaoMinutos" INTEGER NOT NULL DEFAULT 60,
    "notifSaldoMinimo" BOOLEAN NOT NULL DEFAULT true,
    "notifVencimentos" BOOLEAN NOT NULL DEFAULT true,
    "notifResumoSemanal" BOOLEAN NOT NULL DEFAULT false,
    "notifAlteracoes" BOOLEAN NOT NULL DEFAULT true,
    "resetTokenHash" TEXT,
    "resetTokenExp" DATETIME,
    "empresaId" INTEGER NOT NULL,
    CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL NOT NULL,
    "data" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'concluido',
    "observacoes" TEXT,
    "arquivado" BOOLEAN NOT NULL DEFAULT false,
    "arquivadoEm" DATETIME,
    "motivoArquivamento" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "responsavelId" INTEGER NOT NULL,
    CONSTRAINT "Transacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transacao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recebivel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sacado" TEXT NOT NULL,
    "vencimento" DATETIME NOT NULL,
    "valorBruto" DECIMAL NOT NULL,
    "taxa" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "antecipadoEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "empresaId" INTEGER NOT NULL,
    CONSTRAINT "Recebivel_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quando" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acao" TEXT NOT NULL,
    "alvo" TEXT NOT NULL,
    "detalhe" TEXT NOT NULL,
    "usuarioNome" TEXT NOT NULL,
    "usuarioId" INTEGER,
    "empresaId" INTEGER NOT NULL,
    CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Auditoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Transacao_empresaId_data_idx" ON "Transacao"("empresaId", "data");

-- CreateIndex
CREATE INDEX "Auditoria_empresaId_quando_idx" ON "Auditoria"("empresaId", "quando");
