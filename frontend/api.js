/* ==========================================================================
   FinTech Flow · cliente da API

   ETAPA 3 · Frontend — Consumir rotas de leitura (GET), gravação (POST) e
             atualização (PUT/PATCH). Todas as telas usam window.api.
   ETAPA 4 · Frontend — Autenticação: o JWT fica num cookie httpOnly que o
             navegador envia sozinho (credentials: 'include'). Resposta 401
             leva para login.html.
   ETAPA 10 · Frontend — Deploy: em produção, defina a URL da API com
             <meta name="ff-api" content="https://sua-api.com/api"> nas páginas
             ou com localStorage.setItem('ff_api', '...').
   ========================================================================== */

(() => {
  // [ETAPA 10] Endereço do backend (meta ff-api > localStorage > padrão local).
  // Usa o mesmo host da página (localhost ou 127.0.0.1): o cookie do JWT é
  // SameSite=Lax e não é enviado entre "localhost" e "127.0.0.1".
  const host = location.hostname || 'localhost';
  let base = document.querySelector('meta[name="ff-api"]')?.content || `http://${host}:3333/api`;
  try { base = localStorage.getItem('ff_api') || base; } catch { /* sem storage */ }

  class ApiError extends Error {
    constructor(status, corpo) {
      super(corpo?.erro || `Erro ${status}`);
      this.status = status;
      this.corpo = corpo || {};
      this.campos = this.corpo.campos || {};
    }
  }

  async function req(metodo, caminho, corpo, { redirecionar401 = true } = {}) {
    let res;
    try {
      res = await fetch(base + caminho, {
        method: metodo,
        credentials: 'include',
        headers: corpo !== undefined ? { 'Content-Type': 'application/json' } : {},
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      });
    } catch {
      throw new ApiError(0, { erro: 'Não foi possível conectar à API. O backend está rodando?' });
    }

    const dados = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.status === 401 && redirecionar401 && !/login\.html$/.test(location.pathname)) {
      location.href = 'login.html';
      return new Promise(() => {}); // a página está saindo; não continua o fluxo
    }
    if (!res.ok) throw new ApiError(res.status, dados);
    return dados;
  }

  window.api = {
    ApiError,
    get: (c, o) => req('GET', c, undefined, o),
    post: (c, b, o) => req('POST', c, b ?? {}, o),
    put: (c, b, o) => req('PUT', c, b ?? {}, o),
    patch: (c, b, o) => req('PATCH', c, b ?? {}, o),
  };
})();
