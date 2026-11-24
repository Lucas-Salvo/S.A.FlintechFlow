/* ==========================================================================
   FinTech Flow · camada de interface do aplicativo

   Cada tela consome a API (ver api.js). Os blocos deste arquivo estão
   marcados com a etapa de entrega correspondente:

   ETAPA 3 · Frontend — Consumir rotas de leitura, gravação e atualização
   ETAPA 5 · Frontend — Criação do dashboard              (renderDashboard)
   ETAPA 6 · Frontend — Consumo do dashboard e gráficos   (GET /dashboard)
   ETAPA 7 · Frontend — Componentização de tabelas, busca e filtros na UI
   ETAPA 8 · Frontend — Feedbacks: toasts, loaders e modais de erro
   ETAPA 9 · Frontend — Otimização de renderização, memoização e responsividade
   ETAPA 6 · Arquiteto — Validação dos fluxos de navegação (guarda + RBAC)
   ========================================================================== */

(() => {
  /* ======================================================================
     Utilidades
     ====================================================================== */
  const $ = (id) => document.getElementById(id);
  const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmt = (v) => BRL.format(v);
  const pctTxt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  const ESC = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dataBR = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
  const dataHoraBR = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const diasEntre = (de, ate) => Math.round((new Date(ate + 'T00:00:00') - new Date(de + 'T00:00:00')) / 86400000);
  const hojeLocal = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  };
  const qs = (obj) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== '' && v != null && v !== false)).toString();

  // Interpreta "1.250,50", "1250.5" ou "1250". Retorna NaN se inválido.
  function parseBRL(texto) {
    let s = String(texto).trim().replace(/\s/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    return /^-?\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
  }

  /* ---------- [ETAPA 9] Otimização: debounce e memoização ---------- */
  // Espera o usuário parar de digitar antes de chamar a API.
  function debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
  // Guarda o resultado de funções puras (ex.: cálculo do líquido de um recebível).
  function memo(fn) {
    const cache = new Map();
    return (...args) => {
      const k = JSON.stringify(args);
      if (!cache.has(k)) cache.set(k, fn(...args));
      return cache.get(k);
    };
  }
  // Só aplica a resposta da requisição mais recente (evita "piscar" com respostas fora de ordem).
  function ultimaResposta() {
    let seq = 0;
    return (promessa) => {
      const meu = ++seq;
      return promessa.then((r) => (meu === seq ? r : new Promise(() => {})));
    };
  }

  /* ---------- [ETAPA 8] Feedbacks: toast, loader e modal de erro ---------- */
  function toast(msg, tipo = 'ok') {
    const stack = $('toasts');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.setAttribute('role', tipo === 'err' ? 'alert' : 'status');
    el.textContent = msg;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3400);
  }

  // Linha de "carregando" para o corpo de uma tabela.
  const linhaLoader = (colunas, texto = 'Carregando…') =>
    `<tr><td colspan="${colunas}" class="loading-cell"><span class="spinner" aria-hidden="true"></span>${texto}</td></tr>`;

  // Bloco de "carregando" para listas e cartões.
  const blocoLoader = (texto = 'Carregando…') =>
    `<li class="loading-cell"><span class="spinner" aria-hidden="true"></span>${texto}</li>`;

  // Modal de erro, com botão opcional de "tentar novamente".
  function modalErro(titulo, mensagem, { tentar, sair } = {}) {
    document.querySelector('.modal-back')?.remove();
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modalTitulo" aria-describedby="modalMsg">
        <div class="modal-icon" aria-hidden="true">!</div>
        <h2 id="modalTitulo">${ESC(titulo)}</h2>
        <p id="modalMsg">${ESC(mensagem)}</p>
        <div class="modal-actions">
          ${sair ? `<button class="btn btn-ghost" data-m="sair">${ESC(sair.rotulo)}</button>` : '<button class="btn btn-ghost" data-m="fechar">Fechar</button>'}
          ${tentar ? '<button class="btn btn-primary" data-m="tentar">Tentar novamente</button>' : ''}
        </div>
      </div>`;
    document.body.appendChild(back);
    const fechar = () => back.remove();
    back.addEventListener('click', (e) => {
      const acao = e.target.closest('[data-m]')?.dataset.m;
      if (acao === 'fechar' || e.target === back) fechar();
      if (acao === 'tentar') { fechar(); tentar(); }
      if (acao === 'sair') { fechar(); sair.acao(); }
    });
    back.querySelector('[data-m="tentar"], [data-m="fechar"], [data-m="sair"]')?.focus();
  }

  function baixarCsv(nome, linhas) {
    const esc = (v) => {
      const s = String(v);
      return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const conteudo = '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nome });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Arquivo ${nome} gerado.`);
  }

  /* ======================================================================
     [ETAPA 5 · Arquiteto] RBAC na interface — mesma matriz do backend
     (backend/src/middlewares/auth.js). A API continua sendo quem decide;
     aqui só escondemos o que o usuário não pode usar.
     ====================================================================== */
  const PERMISSOES = {
    ler: ['admin', 'operador', 'leitor'],
    operar: ['admin', 'operador'],
    administrar: ['admin'],
  };
  let SESSAO = null; // { usuario, empresa }
  const pode = (acao) => Boolean(SESSAO && PERMISSOES[acao].includes(SESSAO.usuario.papel));

  /* ======================================================================
     [ETAPA 7] Componentes reutilizáveis: pills, linhas, tabela e paginador
     ====================================================================== */
  const pillStatus = (t) => {
    if (t.arquivado) return '<span class="pill muted">Arquivado</span>';
    return t.status === 'pendente'
      ? '<span class="pill warn">Pendente</span>'
      : '<span class="pill ok">Concluído</span>';
  };

  const pillRecebivel = (status) => ({
    aberto: '<span class="pill info">Em aberto</span>',
    antecipado: '<span class="pill gold">Antecipado</span>',
    liquidado: '<span class="pill ok">Liquidado</span>',
  }[status]);

  function linhaTx(t, comAcoes = false) {
    const entrada = t.tipo === 'entrada';
    const acao = comAcoes && pode('operar')
      ? `<button class="btn btn-ghost btn-sm" data-arquivar="${t.id}">${t.arquivado ? 'Restaurar' : 'Arquivar'}</button>` : '';
    return `<tr class="${t.arquivado ? 'is-archived' : ''}">
      <td class="mono muted">${t.id}</td>
      <td><div class="cell-main">${ESC(t.desc)}</div><div class="cell-sub">${ESC(t.resp)}</div></td>
      <td>${ESC(t.cat)}</td>
      <td class="mono">${dataBR(t.data)}</td>
      <td>${pillStatus(t)}</td>
      <td class="num ${entrada ? 'pos' : 'neg'}">${entrada ? '+' : '−'} ${fmt(t.valor)}</td>
      ${comAcoes ? `<td class="actions">${acao}</td>` : ''}
    </tr>`;
  }

  // Tabela: recebe as linhas já prontas, mostra mensagem quando vazia.
  function Tabela(idCorpo, { colunas, vazio }) {
    return {
      carregando: () => setHTML(idCorpo, linhaLoader(colunas)),
      erro: (msg) => setHTML(idCorpo, `<tr><td colspan="${colunas}" class="empty">${ESC(msg)}</td></tr>`),
      desenhar: (linhas) => setHTML(idCorpo, linhas.length ? linhas.join('') : `<tr><td colspan="${colunas}" class="empty">${vazio}</td></tr>`),
    };
  }

  // Paginador: botões anterior/próxima que chamam onMudar(novaPagina).
  function Paginador(idEl, onMudar) {
    $(idEl)?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pag]');
      if (b && !b.disabled) onMudar(Number(b.dataset.pag));
    });
    return {
      desenhar: (pag, totPag) => setHTML(idEl, `
        <button class="btn btn-ghost btn-sm" data-pag="${pag - 1}" ${pag <= 1 ? 'disabled' : ''}>← Anterior</button>
        <span class="mono">Página ${pag} de ${totPag}</span>
        <button class="btn btn-ghost btn-sm" data-pag="${pag + 1}" ${pag >= totPag ? 'disabled' : ''}>Próxima →</button>`),
    };
  }

  /* ---------- [ETAPA 6] Gráficos (SVG/CSS puro, sem bibliotecas) ---------- */
  function graficoBarras(serie) {
    const max = Math.max(...serie.map((x) => Math.max(x.entradas, x.saidas)), 1);
    const alt = (v) => ((v / max) * 100).toFixed(1) + '%';
    return serie.map((m) => `
      <div class="bar-col">
        <div class="bar-pair">
          <span class="bar in" style="--h:${alt(m.entradas)}" title="Entradas: ${fmt(m.entradas)}"></span>
          <span class="bar out" style="--h:${alt(m.saidas)}" title="Saídas: ${fmt(m.saidas)}"></span>
        </div>
        <span class="bar-label">${m.label}</span>
      </div>`).join('');
  }

  function linhaSvg(valores) {
    const w = 600, h = 220, pad = 14;
    const min = Math.min(...valores) * 0.96;
    const max = Math.max(...valores) * 1.04;
    const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(valores.length - 1, 1);
    const y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
    const pts = valores.map((v, i) => [x(i), y(v)]);
    const linha = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const area = `${linha} L${x(valores.length - 1)} ${h} L${x(0)} ${h} Z`;
    const bolas = pts.map((p) =>
      `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="#FFFFFF" stroke="#6B47C2" stroke-width="1.6"/>`).join('');
    return `<svg class="line-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolução do saldo ao longo dos meses">
      <defs>
        <linearGradient id="areaSaldo" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#8163D3" stop-opacity="0.28"/>
          <stop offset="1" stop-color="#8163D3" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#areaSaldo)"/>
      <path d="${linha}" fill="none" stroke="#6B47C2" stroke-width="2" stroke-linejoin="round"/>
      ${bolas}
    </svg>`;
  }

  function setDelta(id, atual, anterior, invertido = false) {
    const el = $(id);
    if (!el) return;
    const d = anterior ? ((atual - anterior) / Math.abs(anterior)) * 100 : 0;
    const bom = invertido ? d <= 0 : d >= 0;
    el.className = 'delta ' + (bom ? 'up' : 'down');
    el.textContent = `${d >= 0 ? '▲' : '▼'} ${pctTxt(Math.abs(d))} vs. mês anterior`;
  }

  /* ======================================================================
     [ETAPA 5] Dashboard  ·  [ETAPA 6] Consumo de GET /dashboard e gráficos
     ====================================================================== */
  async function renderDashboard() {
    setHTML('ultimasTx', linhaLoader(6));
    setHTML('alertas', blocoLoader());

    const [d, recentes] = await Promise.all([
      api.get('/dashboard'),
      api.get('/transacoes?' + qs({ perPage: 6 })),
    ]);

    const serie = d.serie;
    setText('kpiSaldo', fmt(d.saldoAtual));
    setDelta('kpiSaldoDelta', serie.at(-1).saldo, serie.at(-2).saldo);
    setText('kpiEntradas', fmt(d.mesAtual.entradas));
    setDelta('kpiEntradasDelta', d.mesAtual.entradas, d.mesAnterior.entradas);
    setText('kpiSaidas', fmt(d.mesAtual.saidas));
    setDelta('kpiSaidasDelta', d.mesAtual.saidas, d.mesAnterior.saidas, true);
    setText('kpiReceber', fmt(d.aReceber.total));
    setText('kpiReceberSub', `${d.aReceber.titulos} títulos em aberto`);

    setHTML('chartFluxo', graficoBarras(serie));
    setHTML('chartSaldo', linhaSvg(serie.map((m) => m.saldo)));
    setHTML('chartSaldoLabels', serie.map((m) => `<span>${m.label}</span>`).join(''));

    Tabela('ultimasTx', { colunas: 6, vazio: 'Nenhum lançamento ainda.' }).desenhar(recentes.dados.map((t) => linhaTx(t)));

    setHTML('alertas', d.alertas.length
      ? d.alertas.map((a) => {
        const extra = a.tom === 'warn' ? `${fmt(a.valor)} · ${a.extra}` : `em ${a.dias} dia(s)`;
        return `<li><i class="dot ${a.tom}"></i>${ESC(a.texto)}<small>${ESC(extra)}</small></li>`;
      }).join('')
      : '<li class="muted"><i class="dot ok"></i>Nenhuma pendência no momento.</li>');
  }

  /* ======================================================================
     [ETAPA 7] Transações — tabela, busca, filtros e paginação no servidor
     [ETAPA 3] Atualização: arquivar / restaurar (PATCH)
     ====================================================================== */
  async function renderTransacoes() {
    const st = { q: '', tipo: 'todos', cat: 'todas', status: 'todos', arq: false, pag: 1, PER: 8 };
    const tabela = Tabela('txBody', { colunas: 7, vazio: 'Nenhum lançamento encontrado com esses filtros.' });
    const pager = Paginador('pager', (p) => { st.pag = p; desenhar(); });
    const somente = ultimaResposta();

    const filtros = () => ({
      q: st.q,
      tipo: st.tipo === 'todos' ? '' : st.tipo,
      cat: st.cat === 'todas' ? '' : st.cat,
      status: st.status === 'todos' ? '' : st.status,
      arquivadas: st.arq ? 'true' : '',
    });

    async function desenhar() {
      tabela.carregando();
      try {
        const r = await somente(api.get('/transacoes?' + qs({ ...filtros(), page: st.pag, perPage: st.PER })));
        st.pag = r.page;
        tabela.desenhar(r.dados.map((t) => linhaTx(t, true)));
        setText('resumoEnt', fmt(r.resumo.entradas));
        setText('resumoSai', fmt(r.resumo.saidas));
        setText('resumoLiq', fmt(r.resumo.liquido));
        setText('resumoQtd', `${r.total} registro(s)`);
        pager.desenhar(r.page, r.totalPaginas);
      } catch (err) {
        tabela.erro(err.message);
        toast(err.message, 'err');
      }
    }

    const { dados: cats } = await api.get('/transacoes/categorias');
    $('fCat')?.insertAdjacentHTML('beforeend', cats.map((c) => `<option value="${ESC(c)}">${ESC(c)}</option>`).join(''));

    const buscar = debounce(() => { st.pag = 1; desenhar(); }, 300); // [ETAPA 9]
    $('busca')?.addEventListener('input', (e) => { st.q = e.target.value.trim(); buscar(); });
    $('fTipo')?.addEventListener('change', (e) => { st.tipo = e.target.value; st.pag = 1; desenhar(); });
    $('fCat')?.addEventListener('change', (e) => { st.cat = e.target.value; st.pag = 1; desenhar(); });
    $('fStatus')?.addEventListener('change', (e) => { st.status = e.target.value; st.pag = 1; desenhar(); });
    $('mostrarArq')?.addEventListener('change', (e) => { st.arq = e.target.checked; st.pag = 1; desenhar(); });

    // Arquivar é soft delete: o registro continua no banco e pode ser restaurado.
    $('txBody')?.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-arquivar]');
      if (!b) return;
      const restaurar = b.textContent.trim() === 'Restaurar';
      b.disabled = true;
      b.textContent = '…';
      try {
        const t = await api.patch(`/transacoes/${b.dataset.arquivar}/${restaurar ? 'restaurar' : 'arquivar'}`);
        toast(t.arquivado
          ? `${t.id} arquivado. O registro foi preservado (soft delete).`
          : `${t.id} restaurado.`, t.arquivado ? 'warn' : 'ok');
      } catch (err) {
        toast(err.message, 'err');
      }
      desenhar();
    });

    $('exportar')?.addEventListener('click', async () => {
      try {
        const { dados } = await api.get('/transacoes?' + qs(filtros()));
        const linhas = dados.map((t) => [
          t.id, t.desc, t.cat, t.tipo, t.valor.toFixed(2).replace('.', ','), t.data, t.status, t.resp,
        ]);
        baixarCsv('lancamentos.csv', [['ID', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Data', 'Status', 'Responsável'], ...linhas]);
      } catch (err) {
        toast(err.message, 'err');
      }
    });

    await desenhar();
  }

  /* ======================================================================
     [ETAPA 3] Nova transação — gravação (POST /transacoes)
     ====================================================================== */
  function initNovaTransacao() {
    const form = $('txForm');
    if (!form) return;

    const hoje = hojeLocal();
    form.data.value = hoje;
    form.data.max = hoje;
    let dupAtual = null;

    const marcaErro = (campo, msg) => {
      setText('err-' + campo, msg || '');
      const input = form.elements[campo];
      if (input && input.classList) input.classList.toggle('is-invalid', Boolean(msg));
    };

    function mostrarDuplicata(dup) {
      dupAtual = dup;
      $('boxDup')?.classList.toggle('hidden', !dup);
      if (dup) setText('txtDup', `Já existe o lançamento ${dup.id} com mesmo valor, data e descrição.`);
      else $('confirmaDup').checked = false;
    }

    // [ETAPA 9] A checagem de duplicidade consulta a API só quando o usuário para de digitar.
    const somente = ultimaResposta();
    const checarDuplicata = debounce(async () => {
      const valor = parseBRL(form.valor.value);
      const desc = form.desc.value.trim();
      if (!Number.isFinite(valor) || valor <= 0 || !desc || !form.data.value) return mostrarDuplicata(null);
      try {
        const r = await somente(api.get('/transacoes/duplicata?' + qs({ desc, valor, data: form.data.value })));
        mostrarDuplicata(r.duplicata);
      } catch { /* a API valida de novo no envio */ }
    }, 400);

    function atualizarPreview() {
      const tipo = form.tipo.value;
      const v = parseBRL(form.valor.value);
      const ok = Number.isFinite(v) && v > 0;
      setText('pvValor', ok ? `${tipo === 'entrada' ? '+' : '−'} ${fmt(v)}` : fmt(0));
      $('pvValor').className = 'pv-valor ' + (tipo === 'entrada' ? 'pos' : 'neg');
      setText('pvDesc', form.desc.value.trim() || 'Descrição do lançamento');
      setText('pvTipo', tipo === 'entrada' ? 'Entrada' : 'Saída');
      setText('pvCat', form.cat.value);
      setText('pvData', form.data.value ? dataBR(form.data.value) : '—');
      checarDuplicata();
    }

    form.addEventListener('input', atualizarPreview);
    form.addEventListener('change', atualizarPreview);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const desc = form.desc.value.trim();
      const v = parseBRL(form.valor.value);
      let primeiro = null;
      const checa = (campo, erro) => {
        marcaErro(campo, erro);
        if (erro && !primeiro) primeiro = form.elements[campo];
      };

      // Validação no navegador (a API repete as mesmas regras — ETAPA 8 do backend).
      checa('desc', desc.length < 3 ? 'Informe uma descrição com pelo menos 3 caracteres.' : '');
      checa('valor',
        !Number.isFinite(v) ? 'Informe um valor numérico, por exemplo 1.250,00.'
          : v < 0 ? 'Valores negativos não são aceitos. Para registrar uma saída, selecione o tipo Saída.'
          : v === 0 ? 'O valor precisa ser maior que zero.'
          : '');
      checa('data',
        !form.data.value ? 'Informe a data do lançamento.'
          : form.data.value > form.data.max ? 'A data não pode ser futura.'
          : '');

      const dupPendente = Boolean(dupAtual) && !$('confirmaDup').checked;
      setText('err-dup', dupPendente ? 'Confirme que este lançamento não é uma duplicidade.' : '');
      if (dupPendente && !primeiro) primeiro = $('confirmaDup');

      if (primeiro || dupPendente) {
        toast('Revise os campos destacados antes de salvar.', 'err');
        primeiro?.focus();
        return;
      }

      const botao = form.querySelector('button[type="submit"]');
      const rotulo = botao.textContent;
      botao.disabled = true;
      botao.textContent = 'Salvando…'; // [ETAPA 8] loader no botão
      try {
        const nova = await api.post('/transacoes', {
          tipo: form.tipo.value,
          desc,
          valor: v,
          data: form.data.value,
          cat: form.cat.value,
          status: form.status.value,
          obs: form.obs.value,
          confirmarDuplicidade: Boolean(dupAtual) && $('confirmaDup').checked,
        });
        toast(`Lançamento ${nova.id} de ${fmt(nova.valor)} salvo.`);
        form.reset();
        form.data.value = hoje;
        mostrarDuplicata(null);
        atualizarPreview();
      } catch (err) {
        // Mostra os erros que a API devolveu nos mesmos campos do formulário.
        Object.entries(err.campos || {}).forEach(([campo, msg]) =>
          (campo === 'dup' ? setText('err-dup', msg) : marcaErro(campo, msg)));
        if (err.corpo?.codigo === 'DUPLICIDADE') mostrarDuplicata(err.corpo.duplicata);
        toast(err.message, 'err');
      } finally {
        botao.disabled = false;
        botao.textContent = rotulo;
      }
    });

    atualizarPreview();
  }

  /* ======================================================================
     [ETAPA 3] Recebíveis — leitura (GET) e atualização (PATCH antecipar)
     ====================================================================== */
  async function renderRecebiveis() {
    const tabela = Tabela('recBody', { colunas: 9, vazio: 'Nenhum recebível cadastrado.' });
    tabela.carregando();
    const { dados: lista, hoje } = await api.get('/recebiveis');

    // [ETAPA 9] memoização: o líquido só é recalculado quando os dados mudam.
    const liquido = memo((bruto, taxa, vence) =>
      bruto * (1 - (taxa / 100) * Math.max(diasEntre(hoje, vence), 0) / 30));
    const liq = (r) => liquido(r.bruto, r.taxa, r.vence);

    function desenhar() {
      const abertos = lista.filter((r) => r.status === 'aberto');
      const antecipados = lista.filter((r) => r.status === 'antecipado');
      const taxaMedia = lista.length ? lista.reduce((s, r) => s + r.taxa, 0) / lista.length : 0;
      const sacados = new Set(lista.filter((r) => r.status !== 'liquidado').map((r) => r.sacado)).size;

      setText('rAberto', fmt(abertos.reduce((s, r) => s + r.bruto, 0)));
      setText('rAbertoSub', `${abertos.length} título(s) aguardando vencimento`);
      setText('rAntec', fmt(antecipados.reduce((s, r) => s + liq(r), 0)));
      setText('rAntecSub', `${antecipados.length} título(s) já antecipados (líquido)`);
      setText('rTaxa', pctTxt(taxaMedia) + ' a.m.');
      setText('rSacados', String(sacados));

      tabela.desenhar(lista.map((r) => {
        const d = diasEntre(hoje, r.vence);
        const prazo = r.status === 'liquidado' ? '<span class="muted">—</span>'
          : `<span class="mono ${d <= 7 ? 'neg' : ''}">${d} d</span>`;
        const acao = r.status === 'aberto' && pode('operar')
          ? `<button class="btn btn-ghost btn-sm" data-antecipar="${r.id}">Antecipar</button>` : '';
        return `<tr>
          <td class="mono muted">${r.id}</td>
          <td class="cell-main">${ESC(r.sacado)}</td>
          <td class="mono">${dataBR(r.vence)}</td>
          <td>${prazo}</td>
          <td class="num">${fmt(r.bruto)}</td>
          <td class="num">${pctTxt(r.taxa)}</td>
          <td class="num">${fmt(liq(r))}</td>
          <td>${pillRecebivel(r.status)}</td>
          <td class="actions">${acao}</td>
        </tr>`;
      }));
    }

    $('recBody')?.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-antecipar]');
      if (!b) return;
      const r = lista.find((x) => x.id === b.dataset.antecipar);
      b.disabled = true;
      b.textContent = '…';
      try {
        const resp = await api.patch(`/recebiveis/${r.id}/antecipar`);
        Object.assign(r, resp.recebivel);
        toast(`${r.id} antecipado. Valor líquido de ${fmt(resp.liquido)} lançado em ${resp.transacao.id}.`);
      } catch (err) {
        toast(err.message, 'err');
      }
      desenhar();
    });

    desenhar();
  }

  /* ======================================================================
     [ETAPA 6] Relatórios — consumo de GET /relatorios/dre (ETAPA 9 do backend)
     ====================================================================== */
  async function renderRelatorios() {
    const sel = $('periodo');
    if (!sel) return;
    const somente = ultimaResposta();
    let atual = null;

    async function desenhar() {
      setHTML('cats', blocoLoader());
      setHTML('dre', `<tbody>${linhaLoader(1)}</tbody>`);
      try {
        const r = await somente(api.get('/relatorios/dre?' + qs({ meses: sel.value })));
        atual = r;
        const margem = (res, rec) => (rec ? pctTxt((res / rec) * 100) : '—');
        const linha = (rotulo, celulas, total, cls = '') =>
          `<tr class="${cls}"><td>${rotulo}</td>${celulas.map((c) => `<td class="num">${c}</td>`).join('')}<td class="num">${total}</td></tr>`;
        const sinal = (v) => `<span class="${v >= 0 ? 'pos' : 'neg'}">${fmt(v)}</span>`;

        setHTML('dre', `
          <thead><tr>
            <th>Demonstrativo</th>
            ${r.meses.map((m) => `<th class="num">${m.label}</th>`).join('')}
            <th class="num">Total</th>
          </tr></thead>
          <tbody>
            ${linha('Receitas', r.meses.map((m) => fmt(m.receitas)), fmt(r.total.receitas))}
            ${linha('Despesas', r.meses.map((m) => `− ${fmt(m.despesas)}`), `− ${fmt(r.total.despesas)}`)}
            ${linha('Resultado', r.meses.map((m) => sinal(m.resultado)), sinal(r.total.resultado), 'row-strong')}
            ${linha('Margem', r.meses.map((m) => margem(m.resultado, m.receitas)), margem(r.total.resultado, r.total.receitas), 'row-muted')}
          </tbody>`);

        const maxCat = Math.max(1, ...r.despesasPorCategoria.map((c) => c.valor));
        setHTML('cats', r.despesasPorCategoria.map((c) => `<li>
            <div class="hbar-head"><span>${ESC(c.categoria)}</span><span class="mono">${fmt(c.valor)}</span></div>
            <div class="hbar"><span style="width:${((c.valor / maxCat) * 100).toFixed(1)}%"></span></div>
          </li>`).join('') || '<li class="empty">Sem despesas no período.</li>');
      } catch (err) {
        setHTML('cats', `<li class="empty">${ESC(err.message)}</li>`);
        toast(err.message, 'err');
      }
    }

    sel.addEventListener('change', desenhar);
    $('exportarDre')?.addEventListener('click', () => {
      if (!atual) return;
      const f2 = (v) => v.toFixed(2).replace('.', ',');
      const linhas = atual.meses.map((m) => [m.label, f2(m.receitas), f2(m.despesas), f2(m.resultado)]);
      baixarCsv(`demonstrativo-${sel.value}-meses.csv`, [['Mês', 'Receitas', 'Despesas', 'Resultado'], ...linhas]);
    });

    await desenhar();
  }

  /* ======================================================================
     [ETAPA 7] Auditoria — busca e filtro no servidor (GET /auditoria)
     ====================================================================== */
  const ACOES = {
    criou:    { rotulo: 'criou',     icone: '+' },
    editou:   { rotulo: 'editou',    icone: '~' },
    arquivou: { rotulo: 'arquivou',  icone: '⊘' },
    bloqueou: { rotulo: 'bloqueou',  icone: '!' },
    login:    { rotulo: 'acessou',   icone: '→' },
  };

  async function renderAuditoria() {
    const st = { acao: 'todas', q: '' };
    const somente = ultimaResposta();

    async function desenhar() {
      setHTML('timeline', blocoLoader());
      try {
        const r = await somente(api.get('/auditoria?' + qs({ acao: st.acao === 'todas' ? '' : st.acao, q: st.q })));
        setHTML('resumoAcoes', Object.keys(ACOES).map((a) =>
          `<li><span class="tl-dot ${a}">${ACOES[a].icone}</span>${ACOES[a].rotulo[0].toUpperCase() + ACOES[a].rotulo.slice(1)}
             <strong>${r.resumo[a] ?? 0}</strong></li>`).join(''));
        setHTML('timeline', r.dados.length ? r.dados.map((e) => `
          <li class="tl-item">
            <span class="tl-dot ${e.acao}" aria-hidden="true">${ACOES[e.acao]?.icone ?? '·'}</span>
            <div>
              <div class="tl-head"><strong>${ESC(e.usuario)}</strong> ${ACOES[e.acao]?.rotulo ?? e.acao} <span class="mono muted">${ESC(e.alvo)}</span></div>
              <p>${ESC(e.detalhe)}</p>
              <time class="mono">${dataHoraBR(e.quando)}</time>
            </div>
          </li>`).join('') : '<li class="empty">Nenhum evento encontrado com esses filtros.</li>');
        setText('auditQtd', `${r.total} evento(s)`);
      } catch (err) {
        setHTML('timeline', `<li class="empty">${ESC(err.message)}</li>`);
        toast(err.message, 'err');
      }
    }

    $('fAcao')?.addEventListener('change', (e) => { st.acao = e.target.value; desenhar(); });
    $('buscaAud')?.addEventListener('input', debounce((e) => { st.q = e.target.value.trim(); desenhar(); }, 300));
    await desenhar();
  }

  /* ======================================================================
     [ETAPA 3] Configurações — atualização (PUT /conta/*, /empresa)
     ====================================================================== */
  function initConfiguracoes() {
    const { usuario, empresa } = SESSAO;
    const perfil = $('formPerfil'), emp = $('formEmpresa'), senha = $('formSenha');
    if (!perfil) return;

    $('pNome').value = usuario.nome;
    $('pSob').value = usuario.sobrenome || '';
    $('pEmail').value = usuario.email;
    $('eRazao').value = empresa.razaoSocial;
    $('eCnpj').value = empresa.cnpj || '';
    $('eFuso').value = empresa.fusoHorario;
    $('sSessao').value = String(usuario.preferencias.sessaoMinutos);
    document.querySelectorAll('[data-pref]').forEach((c) => { c.checked = Boolean(usuario.preferencias[c.dataset.pref]); });

    // [ETAPA 5] Só admin edita a empresa.
    if (!pode('administrar')) {
      emp.querySelectorAll('input, select, button').forEach((el) => { el.disabled = true; });
      emp.insertAdjacentHTML('afterbegin', '<p class="hint span-2">Somente administradores podem alterar os dados da empresa.</p>');
    }

    const enviar = (form, fazer) => form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const botao = form.querySelector('button[type="submit"]');
      botao.disabled = true;
      try {
        toast(await fazer());
      } catch (err) {
        toast(err.message, 'err');
      } finally {
        botao.disabled = false;
      }
    });

    enviar(perfil, async () => {
      const u = await api.put('/conta/perfil', { nome: $('pNome').value, sobrenome: $('pSob').value, email: $('pEmail').value });
      Object.assign(usuario, u);
      preencherUsuario();
      return 'Perfil atualizado.';
    });

    enviar(emp, async () => {
      const e = await api.put('/empresa', { razaoSocial: $('eRazao').value, cnpj: $('eCnpj').value, fusoHorario: $('eFuso').value });
      Object.assign(empresa, e);
      preencherUsuario();
      return 'Dados da empresa salvos.';
    });

    enviar(senha, async () => {
      if (senha.nova.value !== senha.confirma.value) {
        senha.confirma.focus();
        throw new Error('As novas senhas não coincidem.');
      }
      await api.put('/conta/senha', { atual: $('sAtual').value, nova: senha.nova.value });
      senha.reset();
      $('sSessao').value = String(usuario.preferencias.sessaoMinutos);
      return 'Senha alterada.';
    });

    const salvarPref = async (dados, msg) => {
      try {
        const u = await api.put('/conta/preferencias', dados);
        usuario.preferencias = u.preferencias;
        toast(msg);
      } catch (err) {
        toast(err.message, 'err');
      }
    };
    $('sSessao').addEventListener('change', (e) =>
      salvarPref({ sessaoMinutos: Number(e.target.value) }, 'Tempo de sessão atualizado. Vale a partir do próximo login.'));
    document.querySelectorAll('[data-pref]').forEach((c) =>
      c.addEventListener('change', () => salvarPref({ [c.dataset.pref]: c.checked }, 'Preferência de notificação salva.')));
  }

  /* ======================================================================
     Shell (comum a todas as telas) e
     [ETAPA 6 · Arquiteto] Validação dos fluxos de navegação
     ====================================================================== */
  const ROTULO_PAPEL = { admin: 'Administrador', operador: 'Operador', leitor: 'Leitura' };

  // Página -> permissão necessária. Sem permissão, volta para o dashboard.
  const PAGINA_EXIGE = { auditoria: 'administrar', 'nova-transacao': 'operar' };

  function initShell() {
    const page = document.body.dataset.page;

    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
    });

    const abre = (v) => document.body.classList.toggle('nav-open', v);
    $('menuBtn')?.addEventListener('click', () => abre(!document.body.classList.contains('nav-open')));
    $('scrim')?.addEventListener('click', () => abre(false));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      abre(false);
      document.querySelector('.modal-back')?.remove();
    });

    document.querySelectorAll('[data-today]').forEach((el) => {
      const t = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      el.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    });

    document.querySelectorAll('[data-logout]').forEach((b) =>
      b.addEventListener('click', async () => {
        try { await api.post('/auth/logout'); } catch { /* sai mesmo assim */ }
        window.location.href = 'login.html';
      }));
  }

  // Usuário logado na barra lateral, empresa no topo e menu conforme o papel.
  function preencherUsuario() {
    const { usuario, empresa } = SESSAO;
    const iniciais = [usuario.nome, usuario.sobrenome].filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    document.querySelectorAll('[data-user-initials]').forEach((el) => { el.textContent = iniciais || '?'; });
    document.querySelectorAll('[data-user-name]').forEach((el) => {
      el.textContent = usuario.nomeCompleto;
      const papel = el.nextElementSibling;
      if (papel) papel.textContent = ROTULO_PAPEL[usuario.papel] || usuario.papel;
    });
    document.querySelectorAll('[data-empresa]').forEach((el) => { el.textContent = empresa.razaoSocial; });

    // [ETAPA 6 · Arquiteto] Esconde o que o papel não pode acessar.
    document.querySelectorAll('[data-nav="auditoria"]').forEach((a) => { a.hidden = !pode('administrar'); });
    document.querySelectorAll('[data-nav="nova-transacao"], a.btn[href="nova-transacao.html"]').forEach((a) => {
      a.hidden = !pode('operar');
    });
  }

  const PAGINAS = {
    dashboard: renderDashboard,
    transacoes: renderTransacoes,
    'nova-transacao': initNovaTransacao,
    recebiveis: renderRecebiveis,
    relatorios: renderRelatorios,
    auditoria: renderAuditoria,
    configuracoes: initConfiguracoes,
  };

  /* ======================================================================
     Inicialização: sessão (ETAPA 4) → permissão (ETAPA 6 Arq.) → tela
     ====================================================================== */
  async function iniciar() {
    const page = document.body.dataset.page;
    try {
      // /auth/me funciona como guarda: sem login, api.js leva para login.html.
      SESSAO = await api.get('/auth/me');
      preencherUsuario();

      const exige = PAGINA_EXIGE[page];
      if (exige && !pode(exige)) {
        modalErro('Acesso restrito', 'Seu perfil não tem permissão para abrir esta tela.', {
          sair: { rotulo: 'Ir para o dashboard', acao: () => { location.href = 'dashboard.html'; } },
        });
        return;
      }

      await PAGINAS[page]?.();
    } catch (err) {
      console.error(err);
      // [ETAPA 8] Falha ao carregar a tela (API fora do ar, etc.): modal com nova tentativa.
      modalErro('Não foi possível carregar', err.message || 'Falha ao carregar os dados.', {
        tentar: () => location.reload(),
      });
    }
  }

  initShell();
  iniciar();
})();
