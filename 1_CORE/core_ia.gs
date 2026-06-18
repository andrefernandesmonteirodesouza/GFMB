/* =====================================================================
   GFMB 5.0 — INTELIGÊNCIA ARTIFICIAL (core_ia.gs)
   Versão: Diamond Rules + Blindagem contra Splits
   ===================================================================== */

const IA_CONFIG = { 
  SHEET_MEMORY: "Memoria",
  REC_AVULSO:  "01.01 — Receitas — Receitas de Serviços — Receitas de Serviços Avulsos",
  REC_PACOTE:  "01.01 — Receitas — Receitas de Serviços — Receitas de Serviços Pacote",
  TAR_BOLETO:      "02.02 — Despesas — Despesas com Vendas e Serviços — Tarifa de Boleto",
  TAR_PIX:         "02.02 — Despesas — Despesas com Vendas e Serviços — Tarifa de PIX",
  TAR_CARTAO:      "02.02 — Despesas — Despesas com Vendas e Serviços — Tarifa de Cartão de Crédito",
  TAR_ANTECIPACAO: "02.02 — Despesas — Despesas com Vendas e Serviços — Tarifa de Antecipação de Cartão de Crédito",
  TAR_EMISSAO_NF:  "02.02 — Despesas — Despesas com Vendas e Serviços — Tarifa de Emissão de Nota Fiscal Asaas",
  DESP_IOF:        "02.10 — Despesas — Despesas Financeiras — IOF",
  DESP_TARIFAS:    "02.10 — Despesas — Despesas Financeiras — Tarifas Bancárias",
  IMP_SIMPLES:     "02.01 — Despesas — Impostos sobre Serviços — Simples Nacional – DAS",
  MKT_META:        "02.06 — Despesas — Despesas Comerciais — Marketing e Publicidade - Meta Ads",
  MKT_GOOGLE:      "02.06 — Despesas — Despesas Comerciais — Marketing e Publicidade - Google Ads",
  TRANSF_INTERNA:  "05.01 — Interno — Transferência — Transferência entre Contas (Entrada/Saídas)",
  INVESTIMENTOS:   "06.01 — Externo — Transferência — Transferência — Aplicação / Resgate de Investimentos"
};

function IA_ENGINE_RUN(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const memory = _IA_loadMemory(ss); 
  const rows = payload.datalake.rows || [];
  let appliedCount = 0;

  rows.forEach(row => {
    // 🔥 TRAVA DE SEGURANÇA MÁXIMA 🔥
    // Se é Split (Tipo 'S'), NÃO TOCA. Retorna imediatamente.
    if (row.type === 'S') return; 
    
    // Se já tem rubrica, não toca.
    if (row.rubrica && row.rubrica !== "") return; 

    let sugestao = null;

    // 1. Regras Diamante
    sugestao = _IA_checkGranularRules(row.desc, row.value);
    
    // 2. Memória
    if (!sugestao) {
       const key = _IA_generateSmartKey(row.desc, row.type, row.value);
       if (memory[key]) sugestao = memory[key];
       else {
          const match = _IA_findTokenMatch(row.desc, memory);
          if (match) sugestao = match;
       }
    }

    // 3. Fallback
    if (!sugestao && row.value > 0) {
       sugestao = _IA_checkValueProfile(row.value);
    }

    if (sugestao) {
       row.rubrica = sugestao;
       row._autoClassified = true; 
       appliedCount++;
    }
  });

  return payload;
}

function IA_ENGINE_TRAIN() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shCons = ss.getSheetByName("Consolidacao");
  const shMem = _IA_getOrCreateMemorySheet(ss);
  
  if (shCons.getLastRow() < 2) return;

  const data = shCons.getRange(2, 1, shCons.getLastRow() - 1, 6).getValues(); 
  const statsMap = {}; 

  data.forEach(r => {
    const desc = String(r[1]); 
    const valor = r[2];        
    const tipo = r[3];         
    const rubrica = r[5];      

    // 🔥 NÃO APRENDE COM SPLIT 🔥
    if (desc && rubrica && rubrica !== "" && !rubrica.startsWith("05.01") && tipo !== 'S') {
      const key = _IA_generateSmartKey(desc, tipo, valor);
      if (key) {
        if (!statsMap[key]) statsMap[key] = {};
        if (!statsMap[key][rubrica]) statsMap[key][rubrica] = 0;
        statsMap[key][rubrica]++;
      }
    }
  });

  const finalMemory = [];
  for (let key in statsMap) {
    let bestRubrica = Object.keys(statsMap[key]).reduce((a, b) => statsMap[key][a] > statsMap[key][b] ? a : b);
    finalMemory.push([key, bestRubrica]);
  }

  shMem.clearContents();
  shMem.appendRow(["CHAVE_PADRAO", "RUBRICA_APRENDIDA"]);
  if (finalMemory.length > 0) {
    shMem.getRange(2, 1, finalMemory.length, 2).setValues(finalMemory);
  }
  
  if(typeof GFMB_toast === 'function') GFMB_toast(`🧠 IA Treinada! ${finalMemory.length} padrões.`);
}

function _IA_checkGranularRules(desc, valor) {
  const d = desc.toUpperCase();
  if (d.includes("COBRANÇA RECEBIDA") && valor > 0) { const perfil = _IA_checkValueProfile(valor); if (perfil) return perfil; }
  if (d.includes("TAXA") || d.includes("TARIFA")) {
      if (d.includes("BOLETO")) return IA_CONFIG.TAR_BOLETO;
      if (d.includes("PIX")) return IA_CONFIG.TAR_PIX;
      if (d.includes("CARTAO") || d.includes("CARTÃO")) return IA_CONFIG.TAR_CARTAO;
      if (d.includes("ANTECIPA")) return IA_CONFIG.TAR_ANTECIPACAO;
      if (d.includes("EMISSÃO") || d.includes("NOTA FISCAL")) return IA_CONFIG.TAR_EMISSAO_NF;
  }
  if (d.includes("IOF")) return IA_CONFIG.DESP_IOF;
  if (d.includes("APLICAÇÃO") || d.includes("RESGATE") || d.includes("RENDIMENTO")) return IA_CONFIG.INVESTIMENTOS;
  if (d.includes("DAS") || d.includes("SIMPLES NACIONAL")) return IA_CONFIG.IMP_SIMPLES;
  if (d.includes("FACEBK") || d.includes("META") || d.includes("INSTAGRAM")) return IA_CONFIG.MKT_META;
  if (d.includes("GOOGLE") && d.includes("ADS")) return IA_CONFIG.MKT_GOOGLE;
  return null;
}

function _IA_checkValueProfile(valor) {
  const v = Math.abs(valor);
  if (v >= 150 && v <= 350) return IA_CONFIG.REC_AVULSO;
  if (v >= 400 && v <= 9000) return IA_CONFIG.REC_PACOTE;
  return null;
}

function _IA_generateSmartKey(desc, tipo, valor) {
  let clean = desc.toString().toUpperCase();
  clean = clean.replace(/FATURA\s*(NR\.?|Nº)?\s*\d+/g, ""); 
  clean = clean.replace(/PIX (ENVIADO|RECEBIDO)/g, ""); 
  clean = clean.replace(/COBRANÇA RECEBIDA/g, "");
  clean = clean.replace(/\d{3,}/g, ""); 
  clean = clean.replace(/[^A-Z\s]/g, ""); 
  clean = clean.trim();
  if (clean.length < 3) return null;
  const v = Math.abs(Number(valor));
  let bucket = "OUTROS";
  if (v < 10) bucket = "MICRO"; 
  else if (v >= 150 && v <= 350) bucket = "AVULSO";
  else if (v >= 400 && v <= 9000) bucket = "PACOTE";
  else bucket = "HIGH";
  return `${clean}|${tipo}|${bucket}`;
}

function _IA_findTokenMatch(text, memory) {
  const clean = text.toString().toUpperCase();
  for (let key in memory) {
      const keyText = key.split("|")[0]; 
      if (keyText.length > 4 && clean.includes(keyText)) return memory[key];
  }
  return null;
}

function _IA_loadMemory(ss) {
    const sh = ss.getSheetByName(IA_CONFIG.SHEET_MEMORY);
    if (!sh) return {};
    const data = sh.getRange(2, 1, sh.getLastRow(), 2).getValues();
    const map = {};
    data.forEach(r => { if(r[0]) map[r[0]] = r[1]; });
    return map;
}

function _IA_getOrCreateMemorySheet(ss) {
  let sh = ss.getSheetByName(IA_CONFIG.SHEET_MEMORY);
  if (!sh) sh = ss.insertSheet(IA_CONFIG.SHEET_MEMORY);
  return sh;
}