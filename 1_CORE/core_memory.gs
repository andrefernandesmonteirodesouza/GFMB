/* =====================================================================
   GFMB CORE5 — MÓDULO DE MEMÓRIA (core_memory.gs)
   Blueprint Técnico + Manual Técnico + Arquitetura Modular 4.7.3

   OBJETIVO (FASE 1 — Estrutura Completa)
   - Criar o módulo de memória interna do CORE5.
   - Registrar estrutura de armazenamento dos padrões aprendidos.
   - Preparar indexadores e APIs internas.
   - Permitir que módulos futuros gravem, leiam e consultem padrões.

   IMPORTANTE:
   - Nesta fase, NÃO há aprendizado automático.
   - Nesta fase, NÃO há atribuição de rubricas.
   - Nesta fase, NÃO há heurísticas.
   - Apenas estrutura, indexação e APIs.

   ===================================================================== */



// =====================================================================
// 1) Função principal do módulo MEMORY
// =====================================================================
function CORE_MEMORY(payload) {

  if (!payload) {
    throw new Error("CORE_MEMORY: payload inválido.");
  }

  // Cria estrutura da memória caso ainda não exista
  if (!payload.memory) {
    payload.memory = {
      entries: [],     // lista de memórias
      index: {},       // index por ANCHOR (chave determinística)
      count: 0         // número total
    };
  }

  // Nesta fase, não há inserção automática

  payload.meta.CORE_MEMORY = {
    executed: true,
    timestamp: new Date(),
    version: "5.0-LAB",
    entries: payload.memory.count
  };

  return payload;
}



// =====================================================================
// 2) Função auxiliar — gerar chave-âncora determinística (ANCHOR)
//    ANCHOR = sha256(descNorm + '|' + valueAbs)
// =====================================================================
function CORE_MEMORY_ANCHOR(desc, value) {
  
  const d = (desc || "")
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const v = Math.abs(Number(value || 0)).toFixed(2);

  const key = d + "|" + v;
  return CORE_SHA_HASH(key).substring(0, 24);  // Âncora mais longa para memória
}



// =====================================================================
// 3) Função auxiliar — gravar memória manual (a ser usada nas Fases 3/4)
// =====================================================================
function CORE_MEMORY_ADD(payload, desc, value, rubrica, sourceMeta) {

  if (!payload || !payload.memory) return null;

  const anchor = CORE_MEMORY_ANCHOR(desc, value);

  const entry = {
    anchor: anchor,
    desc: desc,
    valueAbs: Math.abs(Number(value || 0)),
    rubrica: rubrica,
    meta: sourceMeta || {},
    timestamp: new Date()
  };

  payload.memory.entries.push(entry);
  payload.memory.index[anchor] = entry;
  payload.memory.count = payload.memory.entries.length;

  return entry;
}



// =====================================================================
// 4) Função auxiliar — obter memória por âncora
// =====================================================================
function CORE_MEMORY_GET(payload, desc, value) {
  if (!payload || !payload.memory) return null;

  const anchor = CORE_MEMORY_ANCHOR(desc, value);
  return payload.memory.index[anchor] || null;
}



// =====================================================================
// 5) Manifesto auxiliar
// =====================================================================
function CORE_MEMORY_MANIFEST() {
  return {
    module: "MEMORY",
    version: "5.0-LAB",
    responsibilities: [
      "Criar estrutura de memória",
      "Indexar padrões (Fase 3+)",
      "Permitir consultas futuras",
      "Expor APIs determinísticas"
    ],
    timestamp: new Date()
  };
}
/* =====================================================================
   GFMB CORE5 — BLOCO 3.7 (Memória pré-AFA)
   Fase 3 — Implementação Inicial das Lógicas Internas
   Este bloco adiciona estrutura para aprendizado futuro (Fase 5),
   sem alterar o funcionamento básico. Incremento 100% seguro.
   ===================================================================== */

/*
   FUNÇÃO: CORE_MEMORY_buildAnchor
   Cria "âncoras semânticas" para cada registro:
   - resumo da descrição
   - faixa de valor
   - tipo
   - conta
   - assinatura semântica (do módulo ID)
   Essas âncoras serão usadas nos clusters da Fase 5.
*/
function CORE_MEMORY_buildAnchor(line, idEnhanced) {
  const desc = (line.desc || "").toUpperCase();
  const value = Math.abs(Number(line.value || 0));
  const type = (line.type || "").toUpperCase();
  const acct = (line.account || "").toUpperCase();

  // faixa de valor
  let valueBucket = "R0";
  if (value >= 1 && value < 50) valueBucket = "R1";
  else if (value < 200) valueBucket = "R2";
  else if (value < 800) valueBucket = "R3";
  else if (value < 2500) valueBucket = "R4";
  else valueBucket = "R5";

  // padrão textual
  let semantic = "";
  if (/PIX/.test(desc)) semantic += "P";
  if (/TED|DOC/.test(desc)) semantic += "T";
  if (/COMPRA|DEBITO/.test(desc)) semantic += "C";
  if (/PAGAMENTO/.test(desc)) semantic += "G";
  if (/DEPOSITO/.test(desc)) semantic += "D";
  if (/TRANSFER/.test(desc)) semantic += "X";
  semantic += type;

  return {
    descShort: desc.substring(0, 18),
    bucket: valueBucket,
    type,
    acct,
    semantic,
    enhanced: idEnhanced || ""
  };
}

/*
   FUNÇÃO: CORE_MEMORY_clusterize
   Agrupa anchors de memória por (semantic + bucket + account).
   Isso é a prévia dos clusters de aprendizado (AFA).
*/
function CORE_MEMORY_clusterize(anchors) {
  const clusters = {};

  anchors.forEach(a => {
    const key = `${a.semantic}|${a.bucket}|${a.acct}`;
    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(a);
  });

  return clusters;
}

/*
   FUNÇÃO: CORE_MEMORY_runEnhancements
   Executada após a criação básica do módulo de memória.
*/
function CORE_MEMORY_runEnhancements(payload) {
  if (!payload || !Array.isArray(payload.normalized)) return payload;

  const anchors = [];

  for (let i = 0; i < payload.normalized.length; i++) {
    const line = payload.normalized[i];
    const idEnhanced = payload.ids_enhanced ? payload.ids_enhanced[i] : null;

    anchors.push(
      CORE_MEMORY_buildAnchor(line, idEnhanced)
    );
  }

  payload.memory.anchors = anchors;
  payload.memory.clusters = CORE_MEMORY_clusterize(anchors);
  payload.memory.count = anchors.length;

  payload.meta.CORE_MEMORY.enhanced = true;
  payload.meta.CORE_MEMORY.totalAnchors = anchors.length;

  return payload;
}
/* =====================================================================
   GFMB CORE5 — BLOCO 4.4 (Estrutura PRO na Memória)
   Fase 4 — Implementação Avançada do CORE5
   Este bloco prepara a camada de memória para uso pelo GFMB PRO.
   Não substituir o módulo inteiro. Incremento seguro.
   ===================================================================== */

/*
   FUNÇÃO: CORE_MEMORY_buildProKey
   Constrói uma chave PRO que será usada para lookup rápido.
   Baseada em:
   - assinatura semântica
   - faixa de valor
   - conta
   - prefixo da descrição
*/
function CORE_MEMORY_buildProKey(anchor) {
  if (!anchor) return "";

  return [
    anchor.semantic || "",
    anchor.bucket || "",
    anchor.acct || "",
    (anchor.descShort || "").substring(0, 8)
  ].join("|");
}

/*
   FUNÇÃO: CORE_MEMORY_buildProIndex
   Cria um index PRO que permite lookup de anchors por:
   - chave PRO
   - valor exato
   - faixa de valor
   - assinatura semântica
*/
function CORE_MEMORY_buildProIndex(anchors) {
  const byKey = {};
  const byValue = {};
  const byBucket = {};
  const bySemantic = {};

  anchors.forEach(a => {
    const key = CORE_MEMORY_buildProKey(a);

    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(a);

    const v = Math.abs(Number(a.value || 0)) || 0;
    if (!byValue[v]) byValue[v] = [];
    byValue[v].push(a);

    const b = a.bucket || "";
    if (!byBucket[b]) byBucket[b] = [];
    byBucket[b].push(a);

    const s = a.semantic || "";
    if (!bySemantic[s]) bySemantic[s] = [];
    bySemantic[s].push(a);
  });

  return { byKey, byValue, byBucket, bySemantic };
}

/*
   FUNÇÃO: CORE_MEMORY_runProStructure
   Executada após a memória básica + pré-AFA.
   Constrói a camada PRO para lookup e pareamento.
*/
function CORE_MEMORY_runProStructure(payload) {
  if (!payload || !payload.memory || !Array.isArray(payload.memory.anchors)) {
    return payload;
  }

  const anchors = payload.memory.anchors;

  // Criar index PRO
  const proIndex = CORE_MEMORY_buildProIndex(anchors);

  payload.memory.pro = {
    index: proIndex,
    totalAnchors: anchors.length,
    prepared: true
  };

  payload.meta.CORE_MEMORY.pro = true;
  payload.meta.CORE_MEMORY.proIndexKeys = Object.keys(proIndex.byKey).length;

  return payload;
}
