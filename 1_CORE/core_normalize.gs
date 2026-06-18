/* =====================================================================
   GFMB 5.0 — NORMALIZAÇÃO (core_normalize.gs)
   ===================================================================== */

function CORE_NORMALIZE(payload) {
  if (!payload || !payload.raw) return payload;

  payload.normalized = [];

  payload.raw.forEach((line, idx) => {
    try {
      const normData = _normDate(line.data);
      const normDesc = String(line.desc || "").replace(/\s+/g, " ").trim();
      const normValue = _normValue(line.value);
      const normType = String(line.type || "").toUpperCase();
      const normAccount = String(line.account || "DESCONHECIDA").toUpperCase();

      // Assinatura de Integridade (HashLinha)
      const rawSignature = [
         normData ? normData.toISOString() : "NODATE",
         normValue.toFixed(2),
         normDesc,
         normAccount
      ].join("|");
      
      const hashLinha = (typeof CORE_SHA_HASH === 'function') 
          ? CORE_SHA_HASH(rawSignature).substring(0, 12) 
          : "NOHASH";

      payload.normalized.push({
        data: normData,
        desc: normDesc,
        value: normValue,
        type: normType,
        account: normAccount,
        _meta: {
          ...(line._meta || {}),
          hash: hashLinha,
          sourceIndex: idx
        }
      });

    } catch (e) {
      payload.errors.push(`Erro normalizando linha ${idx}: ${e.message}`);
    }
  });

  payload.meta.CORE_NORMALIZE = { executed: true, count: payload.normalized.length };
  return payload;
}

function _normValue(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let s = String(val).replace(/R\$/g, "").trim();
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  return parseFloat(s) || 0;
}

function _normDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}