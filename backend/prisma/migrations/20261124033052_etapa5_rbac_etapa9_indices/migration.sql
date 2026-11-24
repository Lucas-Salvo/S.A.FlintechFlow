-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "sobrenome" TEXT,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'operador',
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
INSERT INTO "new_Usuario" ("atualizadoEm", "criadoEm", "email", "empresaId", "id", "nome", "notifAlteracoes", "notifResumoSemanal", "notifSaldoMinimo", "notifVencimentos", "resetTokenExp", "resetTokenHash", "senhaHash", "sessaoMinutos", "sobrenome") SELECT "atualizadoEm", "criadoEm", "email", "empresaId", "id", "nome", "notifAlteracoes", "notifResumoSemanal", "notifSaldoMinimo", "notifVencimentos", "resetTokenExp", "resetTokenHash", "senhaHash", "sessaoMinutos", "sobrenome" FROM "Usuario";
DROP TABLE "Usuario";
ALTER TABLE "new_Usuario" RENAME TO "Usuario";
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");
CREATE INDEX "Usuario_resetTokenHash_idx" ON "Usuario"("resetTokenHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Auditoria_empresaId_acao_idx" ON "Auditoria"("empresaId", "acao");

-- CreateIndex
CREATE INDEX "Recebivel_empresaId_status_vencimento_idx" ON "Recebivel"("empresaId", "status", "vencimento");

-- CreateIndex
CREATE INDEX "Transacao_empresaId_arquivado_status_idx" ON "Transacao"("empresaId", "arquivado", "status");

-- CreateIndex
CREATE INDEX "Transacao_empresaId_valor_data_idx" ON "Transacao"("empresaId", "valor", "data");
