/* =====================================================================
   ARQUIVO: 1_CORE/core_main.gs
   ORQUESTRADOR DO PIPELINE (Ordenação Ajustada em 3 Blocos)
   ===================================================================== */

function CORE_MAIN_EXECUTE() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let payload = { 
    source: "DRIVE", raw: [], normalized: [], ids: [], meta: { startTime: new Date() }
  };

  if (typeof CORE_IMPORT === 'function') payload = CORE_IMPORT(payload);
  if (typeof CORE_INIT === 'function') payload = CORE_INIT(payload);
  if (typeof CORE_NORMALIZE === 'function') payload = CORE_NORMALIZE(payload);
  if (typeof CORE_ID === 'function') payload = CORE_ID(payload);
  if (typeof CORE_ANTIDUP === 'function') payload = CORE_ANTIDUP(payload);
  
  if (typeof GFMB_persistToConsolidation === 'function') {
      GFMB_persistToConsolidation(payload, ss);
  }

  payload.datalake = { rows: _CORE_LOAD_DATALAKE_ROWS(ss) };

  if (typeof PRO_TRANSF_EXECUTE === 'function') payload = PRO_TRANSF_EXECUTE(payload);
  if (typeof IA_ENGINE_RUN === 'function') payload = IA_ENGINE_RUN(payload); 

  _CORE_UPDATE_DATALAKE_ROWS(ss, payload.datalake.rows);
  _CORE_ORGANIZE_DATALAKE(ss);
  
  if (typeof protectConsolidatedRows === 'function') protectConsolidatedRows(ss);
}

// --- HELPERS ---

function _CORE_LOAD_DATALAKE_ROWS(ss) {
  const sh = ss.getSheetByName("Consolidacao");
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  return data.map((r, i) => ({
    rowIdx: i + 2,
    data: r[0], desc: r[1], value: r[2], type: r[3],
    account: r[4], rubrica: r[5], id: r[6]
  }));
}

function _CORE_UPDATE_DATALAKE_ROWS(ss, rows) {
  const sh = ss.getSheetByName("Consolidacao");
  rows.forEach(r => {
    if (r._autoClassified || r._matched) {
      if (r.rubrica) sh.getRange(r.rowIdx, 6).setValue(r.rubrica);
      if (r.type) sh.getRange(r.rowIdx, 4).setValue(r.type);
      if (r.desc && r._matched) sh.getRange(r.rowIdx, 2).setValue(r.desc);
      if (r._autoClassified) sh.getRange(r.rowIdx, 6).setBackground('#E3F2FD'); 
    }
  });
}

function _CORE_ORGANIZE_DATALAKE(ss) {
  const sh = ss.getSheetByName("Consolidacao");
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const range = sh.getRange(2, 1, lastRow - 1, 9);
  const values = range.getValues();
  const backgrounds = range.getBackgrounds();
  const fontColors = range.getFontColors();

  const rows = values.map((r, i) => ({
    val: r, bg: backgrounds[i], font: fontColors[i],
    rubrica: r[5], type: r[3], date: new Date(r[0]).getTime(), bgRubrica: backgrounds[i][5],
    desc: String(r[1])
  }));

  // 🔥 ORDENAÇÃO CUSTOMIZADA (3 BLOCOS)
  rows.sort((a, b) => {
    const getPriority = (row) => {
      // BLOCO 1 (TOPO): Sem Rubrica e Fundo Branco (Pendentes Críticos)
      if ((!row.rubrica || row.rubrica === "") && row.bgRubrica === '#ffffff') return 1;
      
      // BLOCO 2 (MEIO): Com Rubrica e Fundo Azul (Sugestão IA)
      if (row.rubrica && (row.bgRubrica === '#e3f2fd' || row.bgRubrica === '#E3F2FD')) return 2;
      
      // BLOCO 3 (FUNDO): Todo o resto (Consolidados, Splits, Cinzas)
      return 3;
    };
    
    const pA = getPriority(a);
    const pB = getPriority(b);
    
    if (pA !== pB) return pA - pB; 
    
    // Desempate por Data (Mais recente primeiro)
    return b.date - a.date; 
  });

  range.setValues(rows.map(r => r.val));
  range.setBackgrounds(rows.map(r => r.bg));
  range.setFontColors(rows.map(r => r.font));
}