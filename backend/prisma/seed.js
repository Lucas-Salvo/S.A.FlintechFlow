// [ETAPA 3 · Backend] Popula o banco com os mesmos dados de demonstração que existiam no front (app.js).
// [ETAPA 5] Um usuário de cada papel do RBAC: admin, operador e leitor.
// Rode com: npm run seed   (apaga e recria os dados!)
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const D = (s) => new Date(s.length === 10 ? s + 'T00:00:00Z' : s + ':00-03:00');

async function main() {
  await prisma.auditoria.deleteMany();
  await prisma.transacao.deleteMany();
  await prisma.recebivel.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.empresa.deleteMany();

  const empresa = await prisma.empresa.create({
    data: { razaoSocial: 'SafeCash Ltda.', cnpj: '12.345.678/0001-90', saldoInicial: 30000 },
  });

  const senhaHash = await bcrypt.hash('senha1234', 10);
  const novo = (nome, sobrenome, email, papel) =>
    prisma.usuario.create({ data: { nome, sobrenome, email, papel, senhaHash, empresaId: empresa.id } });
  const ana = await novo('Ana', 'Souza', 'ana@safecash.com', 'admin');
  const bruno = await novo('Bruno', 'Lima', 'bruno@safecash.com', 'operador');
  await novo('Usuário', 'Demo', 'usuario@empresa.com', 'leitor');

  const TX = [
    [4821, 'Antecipação de recebível #4821', 'Antecipação', 'entrada', 5000, '2026-11-21', 'concluido', ana],
    [4820, 'Pagamento de aluguel', 'Aluguel', 'saida', 2000, '2026-11-20', 'concluido', bruno],
    [4819, 'Recebível #3310', 'Recebíveis', 'entrada', 8750, '2026-11-18', 'concluido', ana],
    [4818, 'Fornecedor — embalagens', 'Fornecedores', 'saida', 3420.5, '2026-11-17', 'pendente', bruno],
    [4817, 'Folha de pagamento', 'Folha', 'saida', 12800, '2026-11-05', 'concluido', ana],
    [4816, 'Antecipação #4790', 'Antecipação', 'entrada', 4200, '2026-11-04', 'concluido', ana],
    [4815, 'Impostos — DAS', 'Impostos', 'saida', 1875.3, '2026-11-03', 'concluido', bruno],
    [4814, 'Recebível #3289', 'Recebíveis', 'entrada', 6300, '2026-10-29', 'concluido', ana],
    [4813, 'Serviços de contabilidade', 'Serviços', 'saida', 900, '2026-10-27', 'concluido', bruno],
    [4812, 'Fornecedor — matéria-prima', 'Fornecedores', 'saida', 7150, '2026-10-22', 'concluido', bruno],
    [4811, 'Antecipação #4755', 'Antecipação', 'entrada', 3600, '2026-10-15', 'concluido', ana],
    [4810, 'Pagamento de aluguel', 'Aluguel', 'saida', 2000, '2026-10-10', 'concluido', bruno],
    [4809, 'Recebível #3201', 'Recebíveis', 'entrada', 9400, '2026-10-08', 'concluido', ana],
    [4808, 'Folha de pagamento', 'Folha', 'saida', 12800, '2026-10-05', 'concluido', ana],
    [4807, 'Recebível #3188', 'Recebíveis', 'entrada', 5100, '2026-09-30', 'concluido', ana],
    [4806, 'Impostos — ISS', 'Impostos', 'saida', 1320, '2026-09-22', 'concluido', bruno],
    [4805, 'Fornecedor — frete', 'Fornecedores', 'saida', 980, '2026-09-18', 'concluido', bruno],
    [4804, 'Antecipação #4702', 'Antecipação', 'entrada', 2900, '2026-09-12', 'concluido', ana],
    [4803, 'Folha de pagamento', 'Folha', 'saida', 12500, '2026-09-05', 'concluido', ana],
    [4802, 'Recebível #3140', 'Recebíveis', 'entrada', 7800, '2026-08-28', 'concluido', ana],
    [4801, 'Pagamento de aluguel', 'Aluguel', 'saida', 2000, '2026-08-10', 'concluido', bruno],
    [4800, 'Serviços de TI', 'Serviços', 'saida', 2450, '2026-08-07', 'concluido', bruno],
    [4799, 'Recebível #3097', 'Recebíveis', 'entrada', 6900, '2026-07-26', 'concluido', ana],
    [4798, 'Folha de pagamento', 'Folha', 'saida', 12200, '2026-07-05', 'concluido', ana],
    [4797, 'Antecipação #4650', 'Antecipação', 'entrada', 4100, '2026-06-18', 'concluido', ana],
    [4796, 'Fornecedor — embalagens', 'Fornecedores', 'saida', 2300, '2026-06-12', 'concluido', bruno],
  ];
  // Em ordem crescente de ID para o autoincremento continuar a partir de 4822.
  for (const [id, descricao, categoria, tipo, valor, data, status, resp] of TX.reverse()) {
    await prisma.transacao.create({
      data: { id, descricao, categoria, tipo, valor, data: D(data), status, empresaId: empresa.id, responsavelId: resp.id },
    });
  }

  const REC = [
    [3275, 'Loja Central Eletro', '2026-11-12', 3750, 1.6, 'liquidado'],
    [3289, 'Agro Campos Ltda.', '2026-11-02', 6300, 1.6, 'liquidado'],
    [3310, 'Mercado Aurora Ltda.', '2026-12-03', 9000, 1.89, 'aberto'],
    [3314, 'Padaria Brasa ME', '2026-12-10', 2400, 1.89, 'aberto'],
    [3318, 'Construtora Vale Norte', '2026-12-18', 15800, 1.45, 'antecipado'],
    [3321, 'Clínica Vitta S/S', '2026-11-28', 4300, 1.72, 'aberto'],
    [3330, 'Transportes Rota Sul', '2027-01-08', 22000, 1.38, 'antecipado'],
    [3336, 'Farmácia Bem Viver', '2026-12-27', 5100, 1.72, 'aberto'],
  ];
  for (const [id, sacado, vence, valorBruto, taxa, status] of REC) {
    await prisma.recebivel.create({ data: { id, sacado, vencimento: D(vence), valorBruto, taxa, status, empresaId: empresa.id } });
  }

  const AUD = [
    ['2026-11-15T13:40', ana, 'editou', 'REC-3321', 'Taxa de antecipação ajustada de 1,80% para 1,72%'],
    ['2026-11-16T10:14', bruno, 'login', 'Sessão', 'Autenticação concluída com token JWT'],
    ['2026-11-17T08:55', bruno, 'criou', 'TX-4818', 'Fornecedor — embalagens · saída de R$ 3.420,50'],
    ['2026-11-17T16:20', null, 'bloqueou', 'TX-4818', 'Tentativa de valor negativo bloqueada pela validação da API'],
    ['2026-11-18T11:02', ana, 'arquivou', 'TX-4790', 'Lançamento arquivado (soft delete) · motivo: duplicidade'],
    ['2026-11-19T17:45', ana, 'editou', 'TX-4815', 'Valor alterado de R$ 1.800,00 para R$ 1.875,30'],
    ['2026-11-20T09:10', bruno, 'criou', 'TX-4820', 'Pagamento de aluguel · saída de R$ 2.000,00'],
    ['2026-11-21T14:32', ana, 'criou', 'TX-4821', 'Antecipação de recebível #4821 · entrada de R$ 5.000,00'],
  ];
  for (const [quando, u, acao, alvo, detalhe] of AUD) {
    await prisma.auditoria.create({
      data: {
        quando: D(quando), acao, alvo, detalhe, empresaId: empresa.id,
        usuarioId: u?.id ?? null, usuarioNome: u ? `${u.nome} ${u.sobrenome}` : 'Sistema',
      },
    });
  }

  console.log('Seed concluído. Logins de teste (senha: senha1234):');
  console.log('  ana@safecash.com (admin) · bruno@safecash.com (operador) · usuario@empresa.com (leitor)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
