/* =====================================================================
   GFMB 5.0 — ANTI-DUPLICAÇÃO (core_antidup.gs)
   ===================================================================== */

function CORE_ANTIDUP(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Consolidacao");
  const existingIDs = new Set();

  if (sh && sh.getLastRow() > 1) {
    const data = sh.getRange(2, 7, sh.getLastRow() - 1, 1).getValues();
    data.forEach(r => { if(r[0]) existingIDs.add(String(r[0])); });
  }

  const uniqueItems = [];
  if (payload.normalized && payload.normalized.length > 0) {
    payload.normalized.forEach(item => {
      if (!existingIDs.has(item.id)) {
         existingIDs.add(item.id);
         uniqueItems.push(item);
      }
    });
  }

  payload.normalized = uniqueItems; 
  if (uniqueItems.length === 0) GFMB_toast("Sem dados novos.", "Anti-Dup");
  return payload;
}