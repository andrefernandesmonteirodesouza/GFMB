/* =====================================================================
   GFMB PRO — INFRAESTRUTURA (pro_infra.gs)
   Centraliza toda a orquestração do sistema PRO:
   1. Contratos de Dados (Data Contracts)
   2. Gatekeeper (Segurança)
   3. Overrides (Interceptadores)
   4. Build (Finalização)
   5. Pipeline (Executor Principal)
   ===================================================================== */

// --- 1. CONTRATOS DE DADOS ---
function PRO_DataContract_input(payload) {
  return {
    core: {
      normalized: payload.normalized || [],
      ids: payload.ids || [],
      datalake: payload.datalake || {},
      conciliation: payload.conciliation || {},
      memory: payload.memory || {},
      afa: payload.afa || {}
    },
    pro: {},
    meta: payload.meta || {},
    warnings: payload.warnings || []
  };
}
function PRO_DataContract_wrap(payload) { return PRO_DataContract_input(payload); }
function PRO_DataContract_unwrap(payload, contract) {
  payload.pro = contract.pro || {};
  payload.warnings = contract.warnings || payload.warnings;
  payload.meta.PRO_CONTRACT = { applied: true, timestamp: new Date().toISOString() };
  return payload;
}

// --- 2. GATEKEEPER ---
function GFMB_PRO_isPayloadReady(payload) {
  return !!(payload && payload.datalake && payload.datalake.rows);
}
function GFMB_PRO_executeSafely(payload, name, fn) {
  if (!GFMB_PRO_isPayloadReady(payload)) {
    payload.warnings.push(`PRO BLOCKED: Payload inválido para ${name}`);
    return payload;
  }
  try {
    const result = fn(payload) || payload;
    if (!payload.meta.PRO) payload.meta.PRO = {};
    payload.meta.PRO[name] = { executed: true, timestamp: new Date().toISOString() };
    return result;
  } catch (e) {
    payload.warnings.push(`PRO EXCEPTION in ${name}: ${e.message}`);
    return payload;
  }
}
function GFMB_PRO_register(name, fn) {
  if (!globalThis.GFMB_PRO_MODULES) globalThis.GFMB_PRO_MODULES = {};
  globalThis.GFMB_PRO_MODULES[name] = fn;
}

// --- 3. OVERRIDES ---
const PRO_OVERRIDES = { beforePRO: [], afterPRO: [], beforeModule: {}, afterModule: {} };
function PRO_Overrides_register(type, moduleName, fn) {
  if (typeof moduleName === "function") { fn = moduleName; moduleName = null; }
  if (typeof fn !== "function") return false;
  if (type === "beforePRO" || type === "afterPRO") PRO_OVERRIDES[type].push(fn);
  else if (moduleName) {
     if (!PRO_OVERRIDES[type][moduleName]) PRO_OVERRIDES[type][moduleName] = [];
     PRO_OVERRIDES[type][moduleName].push(fn);
  }
}
function PRO_Overrides_apply(payload, stage, phase) {
  const execute = (list) => {
     if (!list) return;
     for (const fn of list) { try { payload = fn(payload) || payload; } catch (e) { payload.warnings.push(`OVERRIDE ERROR: ${e}`); } }
  };
  if (phase === "before") { execute(PRO_OVERRIDES.beforePRO); execute(PRO_OVERRIDES.beforeModule[stage]); }
  else { execute(PRO_OVERRIDES.afterModule[stage]); execute(PRO_OVERRIDES.afterPRO); }
  return payload;
}

// --- 4. BUILD REGISTRATION ---
function PRO_BUILD_REGISTRATION(payload) {
  let checksum = "0";
  try {
    const base = JSON.stringify({ ids: payload.ids.length, norm: payload.normalized.length });
    let hash = 0;
    for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) % 1000000007;
    checksum = String(hash);
  } catch (e) {}
  payload.meta.PRO_BUILD = { version: "5.0-Enterprise", completed: true, timestamp: new Date().toISOString(), checksum: checksum };
  payload.meta.PRO_READY = true;
  return payload;
}

// --- 5. PIPELINE EXECUTOR (O MAESTRO PRO) ---
function GFMB_PRO_PIPELINE(payload) {
  let contract = PRO_DataContract_wrap(payload);
  if (typeof PRO_Overrides_apply === 'function') contract = PRO_Overrides_apply(contract, "PREP", "before"); 

  // Executa Shells disponíveis
  if (typeof PRO_CONCILIACAO_SHELL === 'function') contract = GFMB_PRO_executeSafely(contract, "PRO_CONCILIACAO_SHELL", PRO_CONCILIACAO_SHELL);
  if (typeof PRO_DRE_DL_SHELL === 'function') contract = GFMB_PRO_executeSafely(contract, "PRO_DRE_DL_SHELL", PRO_DRE_DL_SHELL);
  
  if (typeof PRO_BUILD_REGISTRATION === 'function') contract = PRO_BUILD_REGISTRATION(contract);
  if (typeof PRO_Overrides_apply === 'function') contract = PRO_Overrides_apply(contract, "PREP", "after");

  payload = PRO_DataContract_unwrap(payload, contract);

  // Executa Lógica de Dados
  if (typeof PRO_TRANSF_EXECUTE === 'function') payload = PRO_TRANSF_EXECUTE(payload);
  if (typeof IA_ENGINE_RUN === 'function') payload = IA_ENGINE_RUN(payload);

  payload.meta.PRO_PIPELINE = { executed: true, timestamp: new Date().toISOString() };
  return payload;
}