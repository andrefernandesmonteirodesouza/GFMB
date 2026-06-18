/* =====================================================================
   GFMB PRO — DASHBOARD BACKEND (pro_dashboard.gs)
   ===================================================================== */

function PRO_DASHBOARD_open() {
  const html = HtmlService.createTemplateFromFile('3_UI-HTML/Dialogos/dashboard_pro')
      .evaluate().setTitle('📊 Painel Financeiro').setWidth(1250).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, 'Visão Gerencial');
}

function PRO_DASHBOARD_getData(modo, dtIni, dtFim, conta) {
  const hoje = new Date();
  let inicio, fim;

  if (modo === 'MES_ANTERIOR') {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  } else if (modo === 'ANO') {
    inicio = new Date(hoje.getFullYear(), 0, 1);
    fim = new Date(hoje.getFullYear(), 11, 31);
  } else if (modo === 'CUSTOM' && dtIni && dtFim) {
    inicio = new Date(dtIni + 'T00:00:00');
    fim = new Date(dtFim + 'T23:59:59');
  } else {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  }

  let contasFiltro = (conta && conta !== 'TODAS') ? [conta] : ['CORA', 'ASAAS', 'STONE'];

  const dados = PRO_DRE_DFC_GENERATE(inicio, fim, contasFiltro);
  if (!dados) throw new Error("Erro gerando dados financeiros.");

  const topClientes = _getTopClientsClean(inicio, fim, contasFiltro);

  // Calcula Maiores Segmentos
  let maiorRecSeg = { nome: "-", valor: 0 };
  let maiorDespSeg = { nome: "-", valor: 0 };
  
  const scan = (grupo, target) => {
      const filhos = dados.tree[grupo] ? dados.tree[grupo].filhos : {};
      for (let k in filhos) {
          const v = Math.abs(filhos[k].valor);
          if (v > Math.abs(target.valor)) {
              target.nome = filhos[k].nome;
              target.valor = filhos[k].valor;
          }
      }
  };
  scan("01", maiorRecSeg);
  scan("02", maiorDespSeg);

  // Payload Final
  return {
    kpis: {
      receita: _fmtBRL(dados.kpis.receita),
      despesa: _fmtBRL(dados.kpis.despesa),
      resultado: _fmtBRL(dados.kpis.resultado),
      resultadoVal: dados.kpis.resultado,
      margem: (dados.kpis.receita > 0 ? (dados.kpis.resultado / dados.kpis.receita * 100).toFixed(1) : 0) + "%",
      maiorRecItem: { val: _fmtBRL(dados.kpis.maiorReceita.valor), desc: dados.kpis.maiorReceita.desc },
      maiorDespItem: { val: _fmtBRL(dados.kpis.maiorDespesa.valor), desc: dados.kpis.maiorDespesa.desc },
      maiorRecSeg: { val: _fmtBRL(maiorRecSeg.valor), nome: maiorRecSeg.nome },
      maiorDespSeg: { val: _fmtBRL(maiorDespSeg.valor), nome: maiorDespSeg.nome }
    },
    saldos: {
      cora: _fmtBRL(dados.saldos["CORA"]),
      asaas: _fmtBRL(dados.saldos["ASAAS"]),
      stone: _fmtBRL(dados.saldos["STONE"]),
      geral: _fmtBRL(dados.saldoGeral)
    },
    dre: dados.tree,
    dreContabil: dados.matrixMensal,
    dfc: { 
       entradas: dados.kpis.receita,
       saidas: dados.kpis.despesa,
       resultado: dados.kpis.resultado,
       saldoInicial: dados.saldoGeral - dados.kpis.resultado 
    },
    graficos: {
      clientes: topClientes,
      despesas: dados.tree["02"] ? dados.tree["02"].filhos : {} 
    },
    meta: { periodo: `${_fmtDate(inicio)} a ${_fmtDate(fim)}` }
  };
}

/** Regex Limpeza de Clientes */
function _getTopClientsClean(inicio, fim, contas) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Consolidacao");
  if(!sh || sh.getLastRow() < 2) return {};
  
  const data = sh.getRange(2, 1, sh.getLastRow()-1, 7).getValues();
  const cores = sh.getRange(2, 6, sh.getLastRow()-1, 1).getBackgrounds();
  const map = {};
  
  for(let i=0; i<data.length; i++) {
     if (cores[i][0] === '#e3f2fd') continue; // Pula sugestão IA
     const r = data[i];
     const dt = new Date(r[0]);
     if (dt < inicio || dt > fim) continue;
     
     if (contas && !contas.includes(String(r[4]).toUpperCase().trim())) continue;
     if (Number(r[2]) <= 0) continue; // Só entradas
     if (String(r[5]).startsWith("05.01") || String(r[5]).startsWith("06.01")) continue;

     let desc = String(r[1]).trim();
     let clean = desc;

     // Regex Avançado
     if (desc.match(/fatura\s*(?:nr\.?|nº)\.?\s*\d+/i)) clean = desc.split(/fatura\s*(?:nr\.?|nº)\.?\s*\d+/i)[1] || desc;
     else if (desc.match(/^Pix recebido/i)) clean = desc.replace(/^Pix recebido\s*[-–]?\s*/i, "");
     else if (desc.match(/^Transferência recebida de/i)) clean = desc.replace(/^Transferência recebida de\s*/i, "");

     clean = clean.trim().toUpperCase().replace(/^[-–]\s*/, "").split(" - ")[0];
     if (clean.length < 2) continue;

     map[clean] = (map[clean] || 0) + Number(r[2]);
  }
  return map;
}

function _fmtBRL(val) { return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function _fmtDate(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy"); }