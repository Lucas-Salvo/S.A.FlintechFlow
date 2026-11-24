// =============================================================================
// ETAPA 8 · Backend — Validação centralizada
//   Regras de conversão/validação usadas por todos os controllers, para a API
//   responder com as mesmas mensagens que o front mostra.
// =============================================================================

const CATEGORIAS = ['Recebíveis', 'Antecipação', 'Fornecedores', 'Aluguel', 'Folha', 'Impostos', 'Serviços', 'Outros'];
const TIPOS = ['entrada', 'saida'];
const STATUS_TX = ['concluido', 'pendente'];
const STATUS_REC = ['aberto', 'antecipado', 'liquidado'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Aceita número ou texto "1.250,50", "1250.5", "1250". Retorna NaN se inválido.
function parseValor(entrada) {
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? Math.round(entrada * 100) / 100 : NaN;
  let s = String(entrada ?? '').trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return /^-?\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
}

// "AAAA-MM-DD" válido? (rejeita 2026-02-31, por exemplo)
function dataValida(s) {
  if (typeof s !== 'string' || !DATA_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Data de hoje ("AAAA-MM-DD") no fuso da empresa.
function hojeISO(fuso = 'America/Sao_Paulo') {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const isoParaDate = (s) => new Date(s + 'T00:00:00Z');
const dateParaIso = (d) => d.toISOString().slice(0, 10);
const diasEntre = (de, ate) => Math.round((isoParaDate(ate) - isoParaDate(de)) / 86400000);

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtBRL = (v) => BRL.format(Number(v));
const fmtPct = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

// Valor líquido de um recebível antecipado hoje (mesma regra do front).
function liquidoRecebivel(bruto, taxa, vencimentoIso, hoje) {
  const dias = Math.max(diasEntre(hoje, vencimentoIso), 0);
  return Math.round(Number(bruto) * (1 - (Number(taxa) / 100) * dias / 30) * 100) / 100;
}

// "TX-4821" ou "4821" -> 4821
function parseId(param, prefixo) {
  const m = String(param).toUpperCase().match(new RegExp(`^(?:${prefixo}-)?(\\d+)$`));
  return m ? Number(m[1]) : NaN;
}

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

module.exports = {
  CATEGORIAS, TIPOS, STATUS_TX, STATUS_REC, EMAIL_RE,
  parseValor, dataValida, hojeISO, isoParaDate, dateParaIso, diasEntre,
  fmtBRL, fmtPct, liquidoRecebivel, parseId, texto,
};
