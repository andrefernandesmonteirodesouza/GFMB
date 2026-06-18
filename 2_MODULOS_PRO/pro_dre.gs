/* =====================================================================
   GFMB PRO — MÓDULO DRE & RELATÓRIOS (pro_dre.gs)
   CORRIGIDO V4: Agrupamento de Repasses + Saldo Real (Sinal)
   ===================================================================== */

// --- SHELL ---
function PRO_DRE_DL_SHELL(payload) {
  let contract = PRO_DataContract_wrap(payload);
  const clusters = contract.core.afa.clusters || [];
  const normalized = contract.core.normalized || [];
  contract.pro.dre_dl = {
    version: "5.0-Unified-FixV4",
    dre: {}, dl: {},
    summary: { totalClusters: clusters.length, totalLines: normalized.length },
    entries: clusters.map((cluster, cIndex) => ({
      clusterIndex: cIndex,
      items: cluster.map(i => ({ index: i, desc: normalized[i].desc, value: normalized[i].value }))
    }))
  };
  payload = PRO_DataContract_unwrap(payload, contract);
  payload.meta.PRO_DRE_DL = { executed: true, mode: "shell" };
  return payload;
}

// --- ENGINE ---
function PRO_DRE_DFC_GENERATE(dataInicio, dataFim, contasFiltro) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Consolidacao");
  const shCard = ss.getSheetByName("Detalhamento_Cartao");
  
  if (!sh || sh.getLastRow() < 2) return _getEmptyStructure(_loadSaldosDetalhados(ss));

  const saldos = _loadSaldosDetalhados(ss); 
  const movAnt = { "CORA": 0, "ASAAS": 0, "STONE": 0 };
  const movAtu = { "CORA": 0, "ASAAS": 0, "STONE": 0 };

  const kpis = { receita: 0, despesa: 0, resultado: 0, maiorDespesa: { valor: 0 }, maiorReceita: { valor: 0 } };
  const tree = { "01": { nome: "Receitas", valor: 0, filhos: {} }, "02": { nome: "Despesas", valor: 0, filhos: {} }, "03": { nome: "Outras", valor: 0, filhos: {} } };
  const matrixMensal = {};

  let rowsToProcess = [];

  // LEITURA CONSOLIDAÇÃO
  const dadosCons = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues();
  const coresCons = sh.getRange(2, 6, sh.getLastRow() - 1, 1).getBackgrounds();

  dadosCons.forEach((row, i) => {
      const bg = coresCons[i][0];
      // Ignora sugestões IA e Linhas Pai de Split ('S')
      if ((bg === '#e3f2fd' || bg === '#E3F2FD') || row[3] === "S") return; 
      
      rowsToProcess.push({ 
        dt: row[0], desc: String(row[1]), 
        val: Number(row[2]), // Usa valor com sinal real (Negativo para Saída)
        tipo: String(row[3]), conta: String(row[4]).toUpperCase().trim(), 
        rubrica: String(row[5]).trim(), origem: "CONTA" 
      });
  });

  // LEITURA CARTÃO
  if (shCard && shCard.getLastRow() > 1) {
      const dadosCard = shCard.getRange(2, 1, shCard.getLastRow() - 1, 8).getValues();
      dadosCard.forEach(row => {
          rowsToProcess.push({ 
            dt: row[1], desc: String(row[3]), val: Number(row[4]), 
            tipo: (Number(row[4]) < 0) ? "D" : "C", conta: "CARTAO", rubrica: String(row[7]).trim(), origem: "CARTAO" 
          });
      });
  }

  rowsToProcess.forEach(r => {
    let rData = (r.dt instanceof Date) ? r.dt : new Date(r.dt);
    if (isNaN(rData.getTime())) return;

    // --- CÁLCULO DE SALDO ---
    // Usa valor direto (r.val) que já tem o sinal correto (-/+)
    if (r.origem === "CONTA") {
        if (rData < dataInicio) { if (movAnt.hasOwnProperty(r.conta)) movAnt[r.conta] += r.val; }
        else if (rData <= dataFim) { if (movAtu.hasOwnProperty(r.conta)) movAtu[r.conta] += r.val; }
    }

    if (rData < dataInicio || rData > dataFim) return;
    if (contasFiltro && contasFiltro.length > 0 && r.origem === "CONTA" && !contasFiltro.includes(r.conta)) return;
    if (r.rubrica.startsWith("05.01") || r.tipo === "T" || r.rubrica.startsWith("06.01")) return; 

    // Popula DRE
    const grp = r.rubrica.substring(0, 2);
    if (r.val > 0) {
       kpis.receita += r.val;
       if (r.val > kpis.maiorReceita.valor) kpis.maiorReceita = { valor: r.val, desc: r.desc };
    } else {
       kpis.despesa += r.val;
       if (r.val < kpis.maiorDespesa.valor) kpis.maiorDespesa = { valor: r.val, desc: r.desc };
    }

    if (tree[grp]) {
       tree[grp].valor += r.val;
       if (!tree[grp].filhos[r.rubrica]) {
           tree[grp].filhos[r.rubrica] = { nome: r.rubrica.replace(/^[\d\.\s—-]+/, ""), valor: 0, items: [] };
       }
       tree[grp].filhos[r.rubrica].valor += r.val;
       
       // 🔥 LÓGICA DE AGRUPAMENTO (REPASSES) 🔥
       if (r.rubrica.includes("Repasses a agenciados")) {
           let existingItem = tree[grp].filhos[r.rubrica].items.find(i => i.desc === r.desc);
           if (existingItem) {
               existingItem.val += r.val; // Soma ao existente
           } else {
               tree[grp].filhos[r.rubrica].items.push({ dt: "", desc: r.desc, val: r.val });
           }
       } 
       else if (tree[grp].filhos[r.rubrica].items.length < 50) { 
           tree[grp].filhos[r.rubrica].items.push({ 
               dt: Utilities.formatDate(rData, Session.getScriptTimeZone(), "dd/MM"), 
               desc: r.desc, val: r.val 
           });
       }
    }

    const mes = rData.getMonth();
    if (!matrixMensal[r.rubrica]) matrixMensal[r.rubrica] = Array(12).fill(0);
    matrixMensal[r.rubrica][mes] += r.val;
  });

  const saldosFinais = {};
  let saldoGeral = 0;
  ["CORA", "ASAAS", "STONE"].forEach(b => {
     const final = (saldos[b] || 0) + (movAnt[b] || 0) + (movAtu[b] || 0);
     saldosFinais[b] = final;
     saldoGeral += final;
  });

  kpis.resultado = kpis.receita + kpis.despesa;
  return { kpis, tree, saldos: saldosFinais, saldoGeral, matrixMensal };
}

function _loadSaldosDetalhados(ss) {
  const sh = ss.getSheetByName("Saldos_Iniciais");
  const s = { "CORA": 0, "ASAAS": 0, "STONE": 0 };
  if (!sh) return s;
  const data = sh.getRange(2, 1, sh.getLastRow(), 3).getValues();
  data.forEach(r => { let k = String(r[0]).toUpperCase().trim(); if (s.hasOwnProperty(k)) s[k] = Number(r[2]); });
  return s;
}

function _getEmptyStructure(saldos) {
    return { kpis: { receita: 0, despesa: 0, resultado: 0, maiorDespesa: {}, maiorReceita: {} }, tree: {}, saldos: saldos, saldoGeral: 0, matrixMensal: {} };
}