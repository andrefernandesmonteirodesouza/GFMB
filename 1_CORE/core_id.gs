/* =====================================================================
   GFMB 5.0 — GERADOR DE IDs (core_id.gs)
   ===================================================================== */

function CORE_ID(payload) {
  if (!payload || !payload.normalized) return payload;
  if (!payload.ids) payload.ids = [];
  
  payload.normalized.forEach(function(line) {
    const id = CORE_ID_BUILD(line);
    line.id = id;
    payload.ids.push(id);
  });
  
  CORE_ID_runEnhancements(payload);
  return payload;
}

function CORE_ID_BUILD(line) {
  const date = line.data instanceof Date ? Utilities.formatDate(line.data, Session.getScriptTimeZone(), "yyyy-MM-dd") : "";
  const valueAbs = Math.abs(Number(line.value || 0)).toFixed(2);
  const type = (line.type || "").toString().trim().toUpperCase();
  const desc = (line.desc || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const account = (line.account || "").toString().trim().toUpperCase();

  const key = [date, valueAbs, type, desc, account].join("|");
  return CORE_SHA_HASH(key).substring(0, 16);
}

function CORE_ID_runEnhancements(payload) {
  if (!payload || !Array.isArray(payload.normalized)) return payload;
  payload.ids_enhanced = payload.normalized.map(line => CORE_ID_generateEnhanced(line));
  return payload;
}

function CORE_ID_generateEnhanced(line) {
  if (!line) return "";
  let data = line.data ? Utilities.formatDate(line.data, "GMT-03:00", "yyyy-MM-dd") : "";
  let valor = Number(line.value) || 0;
  let tipo = line.type || "";
  let desc = (line.desc || "").toUpperCase();
  let acct = (line.account || "").toUpperCase();
  
  let signature = "";
  if (/PIX/.test(desc)) signature += "P";
  if (/TED|DOC/.test(desc)) signature += "T";
  if (/PAGAMENTO/.test(desc)) signature += "G";
  if (/COMPRA|DEBITO/.test(desc)) signature += "C";
  
  const input = [data, Math.abs(valor), tipo, desc, acct, signature].join("|");
  return CORE_SHA_HASH(input).substring(0, 24); 
}