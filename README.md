# FinTech Flow

Sistema de tesouraria: transações, recebíveis, dashboard, relatórios e auditoria.

| Pasta | O que é |
|---|---|
| `backend/` | API em Express + Prisma + JWT ([README](backend/README.md)) |
| `frontend/` | Interface em HTML/CSS/JS ligada à API |
| `docs/ETAPAS.md` | **Mapa das etapas de entrega → arquivos do código** |
| `docs/ARQUITETURA.md` | Entregáveis do Arquiteto (requisitos, Trello, fluxo, RBAC, desempenho, UX, testes) |
| `e2e/` | Teste de ponta a ponta no navegador (Playwright) |

Cada etapa está marcada no código com o comentário `ETAPA N · Backend|Frontend|Arquiteto`.
Para listar todas: `grep -rn "ETAPA" backend/src frontend e2e --exclude-dir=node_modules` (ou `Ctrl+Shift+F` no VS Code).

## Rodando

```bash
cd backend
npm install
cp .env.example .env      # troque o JWT_SECRET
npm run setup             # banco + dados de demonstração
npm run dev               # http://localhost:3333/api  ·  Swagger em /api/docs
npm test                  # 15 testes
```

Depois abra `frontend/login.html` com o **Live Server** (porta 5500).

| Login (senha `senha1234`) | Papel |
|---|---|
| ana@safecash.com | admin |
| bruno@safecash.com | operador |
| usuario@empresa.com | leitor |

## Vídeo de demonstração (Etapa 11)

https://drive.google.com/file/d/1khJKD7_HHwzYVkzVjro9wMjXN6z8BFBJ/view?usp=sharing

