/* =====================================================================
   GFMB CORE5 — MÓDULO HOOKS (core_hooks.gs)
   Blueprint Técnico + Manual Técnico + Arquitetura Modular 4.7.3

   OBJETIVO
   - Permitir extensibilidade SEM alterar o CORE.
   - Registrar funções que serão executadas ao final do pipeline.
   - Suportar lógica PRO, dashboards, observadores e integrações futuras.
   - Seguir o padrão imutável do CORE5.

   STATUS (FASE 1 — Estrutura Completa)
   - Sistema de hooks funcional.
   - Registro dinâmico.
   - Execução segura com try/catch.
   ===================================================================== */



// =====================================================================
// 1) Registro global dos hooks
// =====================================================================
var CORE_HOOKS_REGISTRY = [];



// =====================================================================
// 2) Função para registrar novos hooks
//    (módulos externos e PRO usarão isso)
// =====================================================================
function CORE_HOOKS_REGISTER(fn) {

  if (typeof fn !== "function") {
    throw new Error("CORE_HOOKS_REGISTER: parâmetro não é função.");
  }

  CORE_HOOKS_REGISTRY.push(fn);

  return {
    ok: true,
    total: CORE_HOOKS_REGISTRY.length
  };
}



// =====================================================================
// 3) Execução dos hooks após o pipeline
// =====================================================================
function CORE_HOOKS(payload) {

  if (!payload || !payload.meta) {
    throw new Error("CORE_HOOKS: payload inválido.");
  }

  var errors = [];

  CORE_HOOKS_REGISTRY.forEach(function(fn) {
    try {
      fn(payload);
    } catch (e) {
      errors.push(String(e));
    }
  });

  payload.meta.CORE_HOOKS = {
    executed: true,
    timestamp: new Date(),
    version: "5.0-LAB",
    hooksExecuted: CORE_HOOKS_REGISTRY.length,
    errors: errors
  };

  return payload;
}



// =====================================================================
// 4) Manifesto auxiliar para debug e inspeção
// =====================================================================
function CORE_HOOKS_MANIFEST() {
  return {
    module: "HOOKS",
    version: "5.0-LAB",
    registered: CORE_HOOKS_REGISTRY.length,
    timestamp: new Date(),
    responsibilities: [
      "Extensibilidade",
      "Suporte a módulos externos",
      "Execução segura após pipeline"
    ]
  };
}
/* =====================================================================
   GFMB CORE5 — BLOCO 4.1 (Hooks Avançados — PRO-ready)
   Fase 4 — Implementação Avançada do CORE5
   Incremento do módulo HOOKS — não substituir arquivo inteiro.
   ===================================================================== */

/*
   Estrutura oficial de HOOKS (PRO-ready)
   --------------------------------------
   HOOKS servem como pontos de extensão que módulos externos (PRO)
   podem utilizar para executar lógica antes e/ou depois do pipeline.
   O CORE5 nunca chama módulos externos diretamente — somente via HOOKS.
*/

/*
   FUNÇÃO: CORE_HOOKS_register
   Registra HOOKS do tipo:
   - beforePipeline
   - afterPipeline
   - beforeModule.<MODULO>
   - afterModule.<MODULO>

   Exemplo de uso (no módulo PRO):
   CORE_HOOKS_register("afterPipeline", myFunction);
*/
function CORE_HOOKS_register(hookName, fn) {
  if (!hookName || typeof fn !== "function") return false;

  if (!globalThis.GFMB_HOOKS) {
    globalThis.GFMB_HOOKS = {};
  }

  if (!globalThis.GFMB_HOOKS[hookName]) {
    globalThis.GFMB_HOOKS[hookName] = [];
  }

  globalThis.GFMB_HOOKS[hookName].push(fn);
  return true;
}

/*
   FUNÇÃO: CORE_HOOKS_execute
   Executa todos os HOOKS registrados de um tipo específico.
*/
function CORE_HOOKS_execute(hookName, payload) {
  if (!globalThis.GFMB_HOOKS || !globalThis.GFMB_HOOKS[hookName]) {
    return payload;
  }

  const list = globalThis.GFMB_HOOKS[hookName];

  for (let i = 0; i < list.length; i++) {
    try {
      payload = list[i](payload) || payload;
    } catch (e) {
      payload.warnings.push(`HOOK ERROR in ${hookName}: ${e}`);
    }
  }

  return payload;
}

/*
   FUNÇÃO: CORE_HOOKS_injectPipelineHooks
   Injeta HOOKS antes/depois do pipeline completo.
*/
function CORE_HOOKS_injectPipelineHooks(payload) {
  // BEFORE PIPELINE
  payload = CORE_HOOKS_execute("beforePipeline", payload);

  // EXECUÇÃO DO PIPELINE COMPLETO
  // (a chamada do pipeline continua no core_main.gs)
  
  return payload;
}

/*
   FUNÇÃO: CORE_HOOKS_finalizePipelineHooks
   Executa HOOKS finais após a conclusão de todas as etapas do pipeline.
*/
function CORE_HOOKS_finalizePipelineHooks(payload) {
  payload = CORE_HOOKS_execute("afterPipeline", payload);

  payload.meta.CORE_HOOKS.enhanced = true;
  payload.meta.CORE_HOOKS.totalHooksExecuted =
    globalThis.GFMB_HOOKS ? Object.values(globalThis.GFMB_HOOKS).flat().length : 0;

  return payload;
}

/*
   FUNÇÃO: CORE_HOOKS_moduleHooks
   Permite ganchos ANTES e DEPOIS de cada módulo individual.
   Exemplo:
   - beforeModule.IMPORT
   - afterModule.DATALAKE
*/
function CORE_HOOKS_moduleHooks(moduleName, payload, phase) {
  const hookKey = `${phase}Module.${moduleName}`;
  return CORE_HOOKS_execute(hookKey, payload);
}
