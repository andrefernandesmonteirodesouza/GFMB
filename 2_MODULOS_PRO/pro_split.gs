/* =====================================================================
   GFMB PRO — SPLIT MANUAL (pro_split.gs)
   ===================================================================== */

function PRO_SPLIT_openModal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  
  if (sh.getName() !== "Consolidacao") {
    ss.toast('Apenas na aba "Consolidacao".');
    return;
  }

  const row = sh.getActiveRange().getRow();
  if (row <= 1) return;

  const values = sh.getRange(row, 1, 1, 9).getValues()[0];
  const transacao = {
    row: row, data: values[0], desc: values[1], valor: Number(values[2]),
    tipo: String(values[3]).toUpperCase(), conta: values[4], rubrica: values[5], id: values[6]
  };

  if (transacao.tipo === "S") {
    SpreadsheetApp.getUi().alert('Erro: Linha já dividida (Tipo S).');
    return;
  }

  const html = HtmlService.createTemplateFromFile('3_UI-HTML/Dialogos/ui_dialog_split');
  html.dados = { ...transacao, valorAbs: Math.abs(transacao.valor) };

  SpreadsheetApp.getUi().showModalDialog(html.evaluate().setWidth(1250).setHeight(800), 'Dividir Lançamento');
}

function PRO_SPLIT_execute(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Consolidacao");
  const row = Number(payload.row);
  const partes = payload.partes; 
  
  const values = sh.getRange(row, 1, 1, 9).getValues()[0];
  const valorOriginal = Number(values[2]);
  const sinal = valorOriginal < 0 ? -1 : 1; 
  const ID_PAI = values[6]; 
  
  // Validação Soma
  const somaPartes = partes.reduce((acc, p) => acc + Number(p.valorAbs), 0);
  if (Math.abs(Math.abs(valorOriginal) - somaPartes) > 0.02) throw new Error("Soma diverge do original.");

  // Cria Linhas Filhas
  const novasLinhas = partes.map((p, i) => [
    values[0], `[SPLIT ID:${ID_PAI}] — ${values[1]}`, Number(p.valorAbs) * sinal,
    values[3], values[4], p.rubrica, `${ID_PAI}-${i + 1}`, values[7], values[8]
  ]);

  sh.insertRowsAfter(row, novasLinhas.length);
  const rangeFilhas = sh.getRange(row + 1, 1, novasLinhas.length, 9);
  rangeFilhas.setValues(novasLinhas);
  rangeFilhas.setFontStyle("italic").setFontColor("#666666").setBackground("#f3f3f3");
  rangeFilhas.offset(0, 0, novasLinhas.length, 1).setNumberFormat('dd/MM/yyyy');
  rangeFilhas.offset(0, 2, novasLinhas.length, 1).setNumberFormat('"R$ "* #,##0.00;[RED]"-R$ "* #,##0.00');
  
  // Atualiza Pai
  sh.getRange(row, 6).clearContent(); 
  sh.getRange(row, 4).setValue("S"); 
  sh.getRange(row, 2).setValue(`[DIVIDIDO] — ${values[1]}`); 
  sh.getRange(row, 1, 1, 9).setBackground("#f3f3f3").setFontStyle("italic").setFontColor("#666666");

  return { success: true };
}

function PRO_SPLIT_getRubricas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Plano de Contas");
  if (!sh) return [];
  const dados = sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues();
  const lista = dados.map(r => r[0]).filter(i => i && String(i).trim().length > 2);
  return [...new Set(lista)].sort();
}