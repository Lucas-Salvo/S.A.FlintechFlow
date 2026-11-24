/* =============================================================================
 * ETAPA 10 · Arquiteto — Documentação final da API (Swagger / OpenAPI 3)
 *   Servida em http://localhost:3333/api/docs  (JSON em /api/docs.json)
 * ============================================================================= */

const ref = (nome) => ({ $ref: `#/components/schemas/${nome}` });
const json = (schema) => ({ 'application/json': { schema } });
const ok = (descricao, schema) => ({ description: descricao, ...(schema ? { content: json(schema) } : {}) });
const corpo = (schema, obrigatorio = true) => ({ required: obrigatorio, content: json(schema) });
const erro = (descricao) => ({ description: descricao, content: json(ref('Erro')) });
const path = (nome, exemplo) => ({ name: nome, in: 'path', required: true, schema: { type: 'string' }, example: exemplo });
const query = (nome, descricao, schema = { type: 'string' }) => ({ name: nome, in: 'query', required: false, description: descricao, schema });

const ERROS_AUTH = { 401: erro('Não autenticado'), 403: erro('Papel sem permissão (RBAC)') };
const lista = (item) => ({
  type: 'object',
  properties: {
    dados: { type: 'array', items: ref(item) },
    total: { type: 'integer' },
    page: { type: 'integer' },
    perPage: { type: 'integer' },
    totalPaginas: { type: 'integer' },
  },
});

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'FinTech Flow API',
    version: '1.0.0',
    description:
      'API de tesouraria: transações, recebíveis, dashboard, relatórios e auditoria.\n\n' +
      '**Autenticação (ETAPA 4):** faça `POST /auth/login`; o JWT volta num cookie httpOnly `token` ' +
      'e também no corpo. Aqui no Swagger, clique em **Authorize** e cole o token.\n\n' +
      '**RBAC (ETAPA 5):** `leitor` só consulta · `operador` cria/edita/arquiva/antecipa · `admin` também vê auditoria, edita a empresa e muda papéis.',
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Auth', description: 'ETAPA 4 · Autenticação JWT' },
    { name: 'Transações', description: 'ETAPA 3 · GET/POST/PUT · ETAPA 7 · filtros, paginação e busca' },
    { name: 'Recebíveis', description: 'ETAPA 3 · GET/POST/PUT' },
    { name: 'Dashboard e relatórios', description: 'ETAPA 6 · agregações · ETAPA 9 · relatórios' },
    { name: 'Auditoria', description: 'ETAPA 5 · somente admin' },
    { name: 'Conta e empresa', description: 'ETAPA 3 · configurações · ETAPA 5 · papéis' },
  ],
  components: {
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookie: { type: 'apiKey', in: 'cookie', name: 'token' },
    },
    schemas: {
      Erro: {
        type: 'object',
        properties: {
          erro: { type: 'string', example: 'Revise os campos destacados.' },
          campos: { type: 'object', additionalProperties: { type: 'string' }, example: { valor: 'O valor precisa ser maior que zero.' } },
        },
      },
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, nome: { type: 'string' }, sobrenome: { type: 'string', nullable: true },
          nomeCompleto: { type: 'string' }, email: { type: 'string' },
          papel: { type: 'string', enum: ['admin', 'operador', 'leitor'] },
          empresaId: { type: 'integer' }, preferencias: { type: 'object' },
        },
      },
      Empresa: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, razaoSocial: { type: 'string' }, cnpj: { type: 'string', nullable: true },
          fusoHorario: { type: 'string', example: 'America/Sao_Paulo' }, saldoInicial: { type: 'number' },
        },
      },
      Transacao: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'TX-4821' }, desc: { type: 'string' }, cat: { type: 'string' },
          tipo: { type: 'string', enum: ['entrada', 'saida'] }, valor: { type: 'number', example: 5000 },
          data: { type: 'string', format: 'date' }, status: { type: 'string', enum: ['concluido', 'pendente'] },
          obs: { type: 'string', nullable: true }, resp: { type: 'string' }, arquivado: { type: 'boolean' },
        },
      },
      NovaTransacao: {
        type: 'object',
        required: ['tipo', 'desc', 'valor', 'data'],
        properties: {
          tipo: { type: 'string', enum: ['entrada', 'saida'] },
          desc: { type: 'string', minLength: 3, maxLength: 120, example: 'Pagamento de fornecedor' },
          valor: { oneOf: [{ type: 'number' }, { type: 'string' }], example: '1.250,00', description: 'Sempre positivo' },
          data: { type: 'string', format: 'date', example: '2026-11-20', description: 'Não pode ser futura' },
          cat: { type: 'string', enum: ['Recebíveis', 'Antecipação', 'Fornecedores', 'Aluguel', 'Folha', 'Impostos', 'Serviços', 'Outros'] },
          status: { type: 'string', enum: ['concluido', 'pendente'] },
          obs: { type: 'string' },
          confirmarDuplicidade: { type: 'boolean', description: 'Envie true depois de um 409 DUPLICIDADE' },
        },
      },
      Recebivel: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'REC-3310' }, sacado: { type: 'string' },
          vence: { type: 'string', format: 'date' }, bruto: { type: 'number' }, taxa: { type: 'number', description: '% ao mês' },
          status: { type: 'string', enum: ['aberto', 'antecipado', 'liquidado'] },
        },
      },
      NovoRecebivel: {
        type: 'object',
        required: ['sacado', 'vence', 'bruto', 'taxa'],
        properties: { sacado: { type: 'string' }, vence: { type: 'string', format: 'date' }, bruto: { type: 'number' }, taxa: { type: 'number' } },
      },
      EventoAuditoria: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, quando: { type: 'string', format: 'date-time' }, usuario: { type: 'string' },
          acao: { type: 'string', enum: ['criou', 'editou', 'arquivou', 'bloqueou', 'login'] }, alvo: { type: 'string' }, detalhe: { type: 'string' },
        },
      },
    },
  },
  security: [{ bearer: [] }, { cookie: [] }],
  paths: {
    // ---------------- ETAPA 4 · Auth ----------------
    '/auth/cadastro': {
      post: {
        tags: ['Auth'], summary: 'Cria conta e empresa (usuário vira admin)', security: [],
        requestBody: corpo({ type: 'object', required: ['nome', 'email', 'senha'], properties: { nome: { type: 'string' }, sobrenome: { type: 'string' }, empresa: { type: 'string' }, email: { type: 'string' }, senha: { type: 'string', minLength: 8 } } }),
        responses: { 201: ok('Conta criada'), 400: erro('Dados inválidos'), 409: erro('E-mail já cadastrado') },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login: devolve o JWT (cookie httpOnly + corpo)', security: [],
        requestBody: corpo({ type: 'object', required: ['email', 'senha'], properties: { email: { type: 'string', example: 'ana@safecash.com' }, senha: { type: 'string', example: 'senha1234' }, lembrar: { type: 'boolean' } } }),
        responses: { 200: ok('Autenticado', { type: 'object', properties: { usuario: ref('Usuario'), empresa: ref('Empresa'), token: { type: 'string' }, expiraEmMinutos: { type: 'integer' } } }), 401: erro('E-mail ou senha incorretos') },
      },
    },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Apaga o cookie da sessão', security: [], responses: { 204: ok('Sessão encerrada') } } },
    '/auth/esqueci-senha': {
      post: { tags: ['Auth'], summary: 'Gera link de recuperação (exibido no terminal da API)', security: [], requestBody: corpo({ type: 'object', properties: { email: { type: 'string' } } }), responses: { 200: ok('Sempre a mesma resposta') } },
    },
    '/auth/redefinir-senha': {
      post: { tags: ['Auth'], summary: 'Define nova senha com o token do link', security: [], requestBody: corpo({ type: 'object', properties: { token: { type: 'string' }, senha: { type: 'string' } } }), responses: { 200: ok('Senha redefinida'), 400: erro('Token inválido/expirado') } },
    },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Usuário e empresa logados', responses: { 200: ok('OK', { type: 'object', properties: { usuario: ref('Usuario'), empresa: ref('Empresa') } }), 401: erro('Não autenticado') } } },

    // ---------------- ETAPA 3 / 7 · Transações ----------------
    '/transacoes': {
      get: {
        tags: ['Transações'], summary: 'Lista com filtros, busca e paginação (ETAPA 7)',
        parameters: [
          query('q', 'Busca por ID, descrição, categoria ou responsável'),
          query('tipo', 'entrada | saida'), query('cat', 'Categoria'), query('status', 'concluido | pendente'),
          query('arquivadas', 'true para incluir arquivadas'), query('de', 'AAAA-MM-DD'), query('ate', 'AAAA-MM-DD'),
          query('page', 'Página (começa em 1)', { type: 'integer' }), query('perPage', 'Itens por página (máx. 100). Sem ele, devolve tudo.', { type: 'integer' }),
        ],
        responses: { 200: ok('OK', { ...lista('Transacao'), properties: { ...lista('Transacao').properties, resumo: { type: 'object', properties: { entradas: { type: 'number' }, saidas: { type: 'number' }, liquido: { type: 'number' } } } } }), ...ERROS_AUTH },
      },
      post: {
        tags: ['Transações'], summary: 'Cria lançamento (operador/admin)',
        requestBody: corpo(ref('NovaTransacao')),
        responses: { 201: ok('Criado', ref('Transacao')), 400: erro('Validação (valor negativo, data futura...)'), 409: erro('DUPLICIDADE: confirme com confirmarDuplicidade=true'), ...ERROS_AUTH },
      },
    },
    '/transacoes/categorias': { get: { tags: ['Transações'], summary: 'Categorias aceitas', responses: { 200: ok('OK') } } },
    '/transacoes/duplicata': {
      get: { tags: ['Transações'], summary: 'Verifica se já existe lançamento igual', parameters: [query('desc', ''), query('valor', ''), query('data', '')], responses: { 200: ok('OK') } },
    },
    '/transacoes/{id}': {
      parameters: [path('id', 'TX-4821')],
      get: { tags: ['Transações'], summary: 'Detalhe', responses: { 200: ok('OK', ref('Transacao')), 404: erro('Não encontrada') } },
      put: { tags: ['Transações'], summary: 'Edita (campos parciais; mudanças vão para a auditoria)', requestBody: corpo(ref('NovaTransacao')), responses: { 200: ok('OK', ref('Transacao')), 400: erro('Validação'), 409: erro('Arquivada'), ...ERROS_AUTH } },
    },
    '/transacoes/{id}/arquivar': {
      patch: { tags: ['Transações'], summary: 'Arquiva (soft delete)', parameters: [path('id', 'TX-4821')], requestBody: corpo({ type: 'object', properties: { motivo: { type: 'string' } } }, false), responses: { 200: ok('OK', ref('Transacao')), 409: erro('Já arquivada'), ...ERROS_AUTH } },
    },
    '/transacoes/{id}/restaurar': {
      patch: { tags: ['Transações'], summary: 'Restaura lançamento arquivado', parameters: [path('id', 'TX-4821')], responses: { 200: ok('OK', ref('Transacao')), ...ERROS_AUTH } },
    },

    // ---------------- ETAPA 3 · Recebíveis ----------------
    '/recebiveis': {
      get: { tags: ['Recebíveis'], summary: 'Lista (filtro: status)', parameters: [query('status', 'aberto | antecipado | liquidado')], responses: { 200: ok('OK', lista('Recebivel')), ...ERROS_AUTH } },
      post: { tags: ['Recebíveis'], summary: 'Cria recebível', requestBody: corpo(ref('NovoRecebivel')), responses: { 201: ok('Criado', ref('Recebivel')), 400: erro('Validação'), ...ERROS_AUTH } },
    },
    '/recebiveis/{id}': {
      parameters: [path('id', 'REC-3310')],
      get: { tags: ['Recebíveis'], summary: 'Detalhe', responses: { 200: ok('OK', ref('Recebivel')) } },
      put: { tags: ['Recebíveis'], summary: 'Edita (só em aberto)', requestBody: corpo(ref('NovoRecebivel')), responses: { 200: ok('OK', ref('Recebivel')), ...ERROS_AUTH } },
    },
    '/recebiveis/{id}/antecipar': {
      patch: { tags: ['Recebíveis'], summary: 'Antecipa e lança a entrada do valor líquido', parameters: [path('id', 'REC-3310')], responses: { 200: ok('OK'), 409: erro('Não está em aberto'), ...ERROS_AUTH } },
    },
    '/recebiveis/{id}/liquidar': {
      patch: { tags: ['Recebíveis'], summary: 'Marca como liquidado', parameters: [path('id', 'REC-3310')], responses: { 200: ok('OK', ref('Recebivel')), ...ERROS_AUTH } },
    },

    // ---------------- ETAPA 6 / 9 · Dashboard e relatórios ----------------
    '/dashboard': { get: { tags: ['Dashboard e relatórios'], summary: 'KPIs, série de 6 meses e alertas (ETAPA 6)', responses: { 200: ok('OK'), ...ERROS_AUTH } } },
    '/relatorios/dre': {
      get: { tags: ['Dashboard e relatórios'], summary: 'Demonstrativo e despesas por categoria (ETAPA 9)', parameters: [query('meses', '3, 6 ou 12', { type: 'integer', enum: [3, 6, 12] })], responses: { 200: ok('OK'), ...ERROS_AUTH } },
    },

    // ---------------- ETAPA 5 · Auditoria ----------------
    '/auditoria': {
      get: {
        tags: ['Auditoria'], summary: 'Linha do tempo (somente admin)',
        parameters: [query('acao', 'criou | editou | arquivou | bloqueou | login'), query('q', 'Busca'), query('page', '', { type: 'integer' }), query('perPage', '', { type: 'integer' })],
        responses: { 200: ok('OK', lista('EventoAuditoria')), ...ERROS_AUTH },
      },
    },

    // ---------------- ETAPA 3 / 5 · Conta e empresa ----------------
    '/conta/perfil': { put: { tags: ['Conta e empresa'], summary: 'Atualiza nome e e-mail', requestBody: corpo({ type: 'object', properties: { nome: { type: 'string' }, sobrenome: { type: 'string' }, email: { type: 'string' } } }), responses: { 200: ok('OK', ref('Usuario')), 409: erro('E-mail em uso') } } },
    '/conta/senha': { put: { tags: ['Conta e empresa'], summary: 'Troca a senha', requestBody: corpo({ type: 'object', properties: { atual: { type: 'string' }, nova: { type: 'string' } } }), responses: { 200: ok('OK'), 400: erro('Senha atual incorreta') } } },
    '/conta/preferencias': { put: { tags: ['Conta e empresa'], summary: 'Tempo de sessão e notificações', requestBody: corpo({ type: 'object', properties: { sessaoMinutos: { type: 'integer', enum: [15, 60, 480] }, notifSaldoMinimo: { type: 'boolean' }, notifVencimentos: { type: 'boolean' }, notifResumoSemanal: { type: 'boolean' }, notifAlteracoes: { type: 'boolean' } } }), responses: { 200: ok('OK', ref('Usuario')) } } },
    '/empresa': {
      get: { tags: ['Conta e empresa'], summary: 'Dados da empresa', responses: { 200: ok('OK', ref('Empresa')) } },
      put: { tags: ['Conta e empresa'], summary: 'Atualiza a empresa (admin)', requestBody: corpo(ref('Empresa')), responses: { 200: ok('OK', ref('Empresa')), ...ERROS_AUTH } },
    },
    '/usuarios': { get: { tags: ['Conta e empresa'], summary: 'Usuários da empresa (admin)', responses: { 200: ok('OK'), ...ERROS_AUTH } } },
    '/usuarios/{id}/papel': {
      put: { tags: ['Conta e empresa'], summary: 'Altera o papel de um usuário (admin)', parameters: [path('id', '2')], requestBody: corpo({ type: 'object', properties: { papel: { type: 'string', enum: ['admin', 'operador', 'leitor'] } } }), responses: { 200: ok('OK', ref('Usuario')), ...ERROS_AUTH } },
    },
  },
};
