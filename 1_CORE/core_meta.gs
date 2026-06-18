/* =====================================================================
   GFMB CORE5 — BLOCO 4.6 (Registro PRO-ready no Meta)
   Fase 4 — Implementação Avançada do CORE5
   Registra no payload.meta que o pipeline completo atingiu o estado
   mínimo exigido para execução segura dos módulos PRO.
   ===================================================================== */

/*
   FUNÇÃO: CORE_META_isProReady
   Verifica se as estruturas essenciais da Fase 4 foram geradas:
   - conciliation.pro
   - memory.pro
   - datalake.validation
*/
function CORE_META_isProReady(payload) {
  if (!payload) return false;

  const c = payload.conciliation && payload.conciliation.pro;
  const m = payload.memory && payload.memory.pro;
  const d = payload.datalake && payload.datalake.validation;

  return Boolean(c && m && d);
}

/*
   FUNÇÃO: CORE_META_registerProReady
   Marca no payload.meta o status PRO-ready e registra telemetria.
*/
function CORE_META_registerProReady(payload) {
  if (!payload.meta) payload.meta = {};

  const ready = CORE_META_isProReady(payload);

  payload.meta.PRO_READY = {
    ready,
    timestamp: new Date().toISOString(),
    details: {
      conciliation: !!(payload.conciliation && payload.conciliation.pro),
      memory: !!(payload.memory && payload.memory.pro),
      datalake: !!(payload.datalake && payload.datalake.validation)
    }
  };

  return payload;
}
