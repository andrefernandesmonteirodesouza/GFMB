/* =====================================================================
   GFMB PRO — CARTÃO BACKEND (pro_cartao.gs)
   ===================================================================== */

function PRO_CARTAO_openModal(rowId, hashLinha, dataFatura) {
  const sh = SpreadsheetApp.getActiveSheet();
  const descFatura = sh.getRange(rowId, 2).getValue();
  const valorFatura = sh.getRange(rowId, 3).getValue(); 

  let sugestaoInteligente = null;
  try {
    if (typeof SMART_SPLIT_GET_SUGGESTION === 'function') {
        sugestaoInteligente = SMART_SPLIT_GET_SUGGESTION(descFatura, valorFatura, hashLinha);
    }
  } catch (e) {
    console.warn("Smart Split falhou: " + e.message);
  }

  // Empacotamento Seguro (Base64)
  let payloadSeguro = "";
  if (sugestaoInteligente) {
      payloadSeguro = Utilities.base64Encode(JSON.stringify(sugestaoInteligente), Utilities.Charset.UTF_8);
  }

  const html = HtmlService.createTemplateFromFile("3_UI-HTML/Dialogos/ui_dialog_cartao_split");
  html.dados = {
    rowId: rowId,
    hash: hashLinha,
    dataFatura: dataFatura,
    totalFatura: Math.abs(valorFatura), 
    payload64: payloadSeguro
  };

  return html.evaluate().setTitle("💳 Detalhar Fatura").setWidth(1250).setHeight(800);
}

function PRO_CARTAO_saveDetails(list, hashLinha, dataFatura) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("Detalhamento_Cartao");

  if (!sh) {
    sh = ss.insertSheet("Detalhamento_Cartao");
    sh.appendRow(["ID_Fatura", "Data_Competencia", "Data_Compra", "Descricao", "Valor", "Parcela_Atual", "Parcela_Total", "Rubrica"]);
    sh.setFrozenRows(1);
  }

  // Remove versão anterior
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) === String(hashLinha)) sh.deleteRow(i + 1);
  }

  const rows = [];
  list.forEach(item => {
    let raw = String(item.valor).trim().replace(/\./g,"").replace(",",".");
    const isNegativeInput = raw.startsWith("-");
    let num = Math.abs(Number(raw));
    const finalValue = isNegativeInput ? num : num * -1; // Despesa = Negativo

    rows.push([
      hashLinha, dataFatura, item.dataCompra || "", item.descricao || "",
      finalValue, item.parcelaAtual || "", item.parcelaTotal || "", item.rubrica || ""
    ]);
  });

  if (rows.length > 0) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  sh.getRange(2, 5, sh.getLastRow(), 1).setNumberFormat('"R$ "* #,##0.00;[Red]"-" "R$ "* #,##0.00');

  PRO_CARTAO_marcarLinhaMaeComoSplit(hashLinha);
  if (typeof GFMB_toast === 'function') GFMB_toast("💳 Detalhamento salvo!");
  
  SpreadsheetApp.flush();
  return true;
}

function PRO_CARTAO_marcarLinhaMaeComoSplit(hashLinha) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Consolidacao");
  const values = sh.getRange(2, 9, sh.getLastRow() - 1, 1).getValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(hashLinha)) {
      const rowIndex = i + 2;
      sh.getRange(rowIndex, 4).setValue("S");
      sh.getRange(rowIndex, 6).setValue("");
      sh.getRange(rowIndex, 1, 1, 9).setBackground("#f3f3f3").setFontColor("#666666");
      return true;
    }
  }
}

function PRO_CARTAO_listarRubricas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Plano de Contas");
  if (!sh) return [];
  const valores = sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues();
  return valores.map(r => r[0]).filter(x => x && String(x).trim() !== "");
}