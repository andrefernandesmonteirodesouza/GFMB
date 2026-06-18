/* =====================================================================
   GFMB PRO — MÓDULO CONCILIAÇÃO (pro_conciliacao.gs)
   Contém:
   1. Shell Estrutural (Preparação)
   2. Transferências Internas (Lógica de Pareamento)
   ===================================================================== */

/* ---------------------------------------------------------------------
   PARTE 1: SHELL ESTRUTURAL
   Prepara o objeto 'pro.conciliacao' para receber dados.
   --------------------------------------------------------------------- */
function PRO_CONCILIACAO_SHELL(payload) {
  let contract = PRO_DataContract_wrap(payload);
  
  contract.pro.conciliacao = {
    version: "5.0-Unified",
    accountsProcessed: 0,
    entries: []
  };

  const accounts = contract.core.conciliation.accounts || {};
  const out = [];

  for (const account in accounts) {
    const rows = accounts[account] || [];
    out.push({
      account,
      totalItems: rows.length,
      entries: rows.map(r => ({ id: r.id, desc: r.desc, value: r.value, date: r.data }))
    });
  }

  contract.pro.conciliacao.entries = out;
  contract.pro.conciliacao.accountsProcessed = out.length;

  payload = PRO_DataContract_unwrap(payload, contract);
  payload.meta.PRO_CONCILIACAO = { executed: true, mode: "shell" };
  return payload;
}

/* ---------------------------------------------------------------------
   PARTE 2: TRANSFERÊNCIAS INTERNAS
   Identifica movimentações entre contas (Saída A = Entrada B).
   Proteção: Exige menção à empresa ("FERMONT") ou match perfeito.
   --------------------------------------------------------------------- */
function PRO_TRANSF_EXECUTE(payload) {
  if (!payload || !payload.datalake || !payload.datalake.rows) return payload;

  const rows = payload.datalake.rows;
  const map = {};
  let matchesFound = 0;
  
  const RUBRICA_TRANSF = "05.01 — Interno — Transferência — Transferência entre Contas (Entrada/Saídas)";
  const COMPANY_KEYWORDS = ["FERMONT", "LIMPEZA E CUIDADOS", "54.331.672"];

  const isCompanyMention = (desc) => {
    if (!desc) return false;
    const d = desc.toUpperCase();
    return COMPANY_KEYWORDS.some(kw => d.includes(kw));
  };

  // 1. Agrupamento (Data + Valor Absoluto)
  rows.forEach(row => {
    if (row.rubrica && row.rubrica !== "") return;

    let d = row.data;
    if (typeof d === 'string') d = new Date(d);
    if (!d || isNaN(d.getTime())) return;

    const dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
    const valStr = Math.abs(Number(row.value)).toFixed(2);
    
    if (valStr === "0.00") return;

    const key = `${dateStr}|${valStr}`;
    if (!map[key]) map[key] = { D: [], C: [] };
    
    if (row.type === 'D') map[key].D.push(row);
    else if (row.type === 'C') map[key].C.push(row);
  });

  // 2. Pareamento Seguro
  for (const key in map) {
    const bucket = map[key];
    
    if (bucket.D.length > 0 && bucket.C.length > 0) {
      bucket.D.forEach(debito => {
        if (debito._matched) return;

        const creditoMatch = bucket.C.find(c => {
            if (c._matched) return false;
            if (c.account === debito.account) return false; // Mesma conta não vale

            // Proteção contra falsos positivos (ex: Devolução de Cliente)
            const dHasName = isCompanyMention(debito.desc);
            const cHasName = isCompanyMention(c.desc);
            
            // Exige que pelo menos um lado cite a empresa ou seja óbvio
            if (!dHasName && !cHasName) return false; 
            
            return true;
        });

        if (creditoMatch) {
          debito.rubrica = RUBRICA_TRANSF;
          debito._matched = true;
          debito.desc = `${debito.desc} [>>> ${creditoMatch.account}]`; 
          debito.type = 'T';

          creditoMatch.rubrica = RUBRICA_TRANSF;
          creditoMatch._matched = true;
          creditoMatch.desc = `${creditoMatch.desc} [<<< ${debito.account}]`;
          creditoMatch.type = 'T';

          matchesFound++;
        }
      });
    }
  }

  if (!payload.meta.PRO_TRANSF) payload.meta.PRO_TRANSF = {};
  payload.meta.PRO_TRANSF = { executed: true, matches: matchesFound };
  
  if (matchesFound > 0) {
      GFMB_toast(`🔄 ${matchesFound} transferências conciliadas.`, "Conciliação");
  }

  return payload;
}