/* =====================================================================
   GFMB CORE5 — MÓDULO DE CONCILIAÇÃO (core_conciliation.gs)
   Blueprint Técnico + Manual Técnico + Arquitetura Modular 4.7.3

   OBJETIVO (FASE 1 — Estrutura Integral)
   - Preparar a estrutura de conciliação dentro do CORE5.
   - Separar registros por conta.
   - Criar um “mapa de contas” padronizado para conciliações posteriores.
   - Fornecer funções auxiliares que serão usadas por:
        • Conciliação determinística (Fase 3+)
        • Pareamento interno
        • Memória
        • Painéis externos (PRO)

   REGRAS DE FASE 1:
   - Nenhum pareamento deve ser realizado.
   - Nenhuma rubrica deve ser aplicada.
   - Nenhuma lógica bancária específica é implementada agora.
   - SOMENTE estrutura, indexação e isolamento por conta.

   ===================================================================== */



// =====================================================================
// 1) Função PRINCIPAL do módulo
// =====================================================================
function CORE_CONCILIATION(payload) {

  if (!payload || !payload.datalake) {
    payload.errors.push("CORE_CONCILIATION: datalake ausente.");
    return payload;
  }

  // Cria estrutura base da conciliação
  if (!payload.conciliation) payload.conciliation = {};

  // Limpa conciliação anterior (Fase LAB)
  payload.conciliation = {
    accounts: {},  // mapa de contas → lançamentos
    totalAccounts: 0,
    totalRecords: 0
  };

  // Preencher mapas por conta (estrutura fundamental)
  payload.datalake.rows.forEach(function(row) {
    const account = row.account || "DESCONHECIDA";

    if (!payload.conciliation.accounts[account]) {
      payload.conciliation.accounts[account] = [];
    }

    payload.conciliation.accounts[account].push({
      id: row.id,
      date: row.data,
      desc: row.desc,
      value: row.value,
      type: row.type,
      account: account,
      _meta: row._meta
    });
  });

  // Cálculo rápido das métricas
  payload.conciliation.totalAccounts = Object.keys(payload.conciliation.accounts).length;
  payload.conciliation.totalRecords  = payload.datalake.count;

  // Registra execução
  payload.meta.CORE_CONCILIATION = {
    executed: true,
    timestamp: new Date(),
    version: "5.0-LAB",
    accounts: payload.conciliation.totalAccounts,
    records: payload.conciliation.totalRecords
  };

  return payload;
}



// =====================================================================
// 2) Função auxiliar — obter lançamentos de uma conta
// =====================================================================
function CORE_CONCILIATION_GET_ACCOUNT(payload, accountName) {
  if (!payload || !payload.conciliation) return [];
  
  return payload.conciliation.accounts[accountName] || [];
}



// =====================================================================
// 3) Função auxiliar — listar contas detectadas
// =====================================================================
function CORE_CONCILIATION_LIST_ACCOUNTS(payload) {
  if (!payload || !payload.conciliation) return [];
  
  return Object.keys(payload.conciliation.accounts);
}



// =====================================================================
// 4) Manifesto auxiliar (debug)
// =====================================================================
function CORE_CONCILIATION_MANIFEST() {
  return {
    module: "CONCILIATION",
    version: "5.0-LAB",
    responsibilities: [
      "Organizar datalake por conta",
      "Criar mapas estruturais para conciliações futuras",
      "Preparar pareamento (fases futuras)"
    ],
    timestamp: new Date()
  };
}
/* =====================================================================
   GFMB CORE5 — BLOCO 3.6 (Conciliação Pré-PRO)
   Fase 3 — Implementação Inicial das Lógicas Internas
   Este bloco acrescenta estruturas que preparam o módulo para a Fase 4.
   Não substituir core_conciliation.gs.
   ===================================================================== */

/*
   FUNÇÃO: CORE_CONCILIATION_groupByDay
   Agrupa registros por dia dentro de cada conta.
   Isto será útil para conciliação avançada futura.
*/
function CORE_CONCILIATION_groupByDay(records) {
  const map = {};
  records.forEach(r => {
    const d = r.data ? Utilities.formatDate(r.data, "GMT-03:00", "yyyy-MM-dd") : "INVALID";
    if (!map[d]) map[d] = [];
    map[d].push(r);
  });
  return map;
}

/*
   FUNÇÃO: CORE_CONCILIATION_groupByValue
   Agrupa registros por valor absoluto.
   Isso auxilia pareamentos futuros (Fase 4).
*/
function CORE_CONCILIATION_groupByValue(records) {
  const map = {};
  records.forEach(r => {
    const key = Math.abs(r.value || 0);
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });
  return map;
}

/*
   FUNÇÃO: CORE_CONCILIATION_groupBySemantic
   Agrupa por padrões observados na descrição e tipo.
   Não faz pareamento — apenas cluster.
*/
function CORE_CONCILIATION_groupBySemantic(records) {
  const map = {};
  records.forEach(r => {
    const desc = (r.desc || "").toUpperCase();
    const type = (r.type || "").toUpperCase();
    const acct = (r.account || "").toUpperCase();

    let signature = "";
    if (/PIX/.test(desc)) signature += "P";
    if (/TED|DOC/.test(desc)) signature += "T";
    if (/COMPRA|DEBITO/.test(desc)) signature += "C";
    if (/PAGAMENTO/.test(desc)) signature += "G";
    if (/DEPOSITO/.test(desc)) signature += "D";
    if (/TRANSFER/.test(desc)) signature += "X";
    signature += type;

    if (/NUBANK/.test(acct)) signature += "_NB";
    if (/BRADESCO/.test(acct)) signature += "_BD";
    if (/INTER/.test(acct)) signature += "_IT";
    if (/SANTANDER/.test(acct)) signature += "_ST";

    if (!map[signature]) map[signature] = [];
    map[signature].push(r);
  });
  return map;
}

/*
   FUNÇÃO: CORE_CONCILIATION_buildPreProStructure
   Cria estrutura pré-PRO para cada conta, com agrupadores internos.
*/
function CORE_CONCILIATION_buildPreProStructure(records) {
  return {
    byDay: CORE_CONCILIATION_groupByDay(records),
    byValue: CORE_CONCILIATION_groupByValue(records),
    bySemantic: CORE_CONCILIATION_groupBySemantic(records)
  };
}

/*
   FUNÇÃO: CORE_CONCILIATION_runEnhancements
   Enriquecimento inicial do módulo de conciliação.
*/
function CORE_CONCILIATION_runEnhancements(payload) {
  if (!payload || !payload.conciliation || !payload.conciliation.accounts) return payload;

  const accounts = payload.conciliation.accounts;
  const prepro = {};

  for (const account in accounts) {
    const records = accounts[account];
    prepro[account] = CORE_CONCILIATION_buildPreProStructure(records);
  }

  payload.conciliation.prepro = prepro;

  payload.meta.CORE_CONCILIATION.prepro = true;
  payload.meta.CORE_CONCILIATION.accounts = Object.keys(accounts).length;
  payload.meta.CORE_CONCILIATION.totalRecords = payload.datalake.count || 0;

  return payload;
}
/* =====================================================================
   GFMB CORE5 — BLOCO 4.2 (Conciliação PRO — Estrutura)
   Fase 4 — Implementação Avançada do CORE5
   Este bloco adiciona estruturas e mapas internos necessários
   para conciliação PRO, sem realizar conciliação real ainda.
   Incremento seguro: não substitui core_conciliation.gs.
   ===================================================================== */

/*
   FUNÇÃO: CORE_CONCILIATION_createProSlots
   Cria “slots” internos que o módulo PRO utilizará na Fase 5 & 6
   para pareamento de lançamentos, identificação de entradas/saídas,
   reconciliação interna e cruzamento com saldos.
*/
function CORE_CONCILIATION_createProSlots() {
  return {
    // pré-pareamento
    candidates: [],

    // pareamentos possíveis (sem lógica ainda)
    matches: [],

    // inconsistências detectadas (serão preenchidas pelo PRO)
    anomalies: [],

    // agrupadores por valor e data (usados no PRO)
    matrix: {
      byDate: {},
      byValue: {},
      byAccount: {}
    },

    // slots futuros para conciliação automática
    auto: {
      planned: [],
      executed: []
    }
  };
}

/*
   FUNÇÃO: CORE_CONCILIATION_buildMatrix
   Estrutura auxiliar para construir matriz de conciliação
   (usada posteriormente pelo GFMB PRO).
*/
function CORE_CONCILIATION_buildMatrix(records) {
  const byDate = {};
  const byValue = {};
  const byAccount = {};

  for (const r of records) {
    // DATA
    const d = r.data ? Utilities.formatDate(r.data, "GMT-03:00", "yyyy-MM-dd") : "INVALID";
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);

    // VALOR ABSOLUTO
    const v = Math.abs(Number(r.value || 0));
    if (!byValue[v]) byValue[v] = [];
    byValue[v].push(r);

    // CONTA
    const acct = (r.account || "").toUpperCase();
    if (!byAccount[acct]) byAccount[acct] = [];
    byAccount[acct].push(r);
  }

  return { byDate, byValue, byAccount };
}

/*
   FUNÇÃO: CORE_CONCILIATION_runProStructure
   Constrói a estrutura pré-PRO dentro do payload.conciliation.pro
*/
function CORE_CONCILIATION_runProStructure(payload) {
  if (!payload || !payload.conciliation || !payload.conciliation.accounts) {
    return payload;
  }

  const accounts = payload.conciliation.accounts;
  const pro = {};

  for (const account in accounts) {
    const rows = accounts[account];

    pro[account] = {
      slots: CORE_CONCILIATION_createProSlots(),

      matrix: CORE_CONCILIATION_buildMatrix(rows),

      metadata: {
        totalRecords: rows.length,
        prepared: true,
        enhanced: true
      }
    };
  }

  payload.conciliation.pro = pro;
  payload.meta.CORE_CONCILIATION.pro = true;

  return payload;
}
