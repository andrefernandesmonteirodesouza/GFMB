/* =====================================================================
   GFMB 5.0 — PERSISTÊNCIA (core_datalake.gs)
   ===================================================================== */

function GFMB_persistToConsolidation(payload, ss) {
  const SHEET_NAME = 'Consolidacao';
  let sh = ss.getSheetByName(SHEET_NAME);
  
  const HEADER = ['Data', 'Descricao', 'Valor', 'Tipo', 'Conta', 'Rubrica', 'ID_Transacao', 'IdArquivo', 'HashLinha'];

  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER])
      .setBackground('#274472').setFontColor('#ffffff').setFontWeight('bold');
    sh.setFrozenRows(1);
  }

  if (!payload.normalized || payload.normalized.length === 0) return;

  const newRows = [];
  const lastRow = sh.getLastRow();
  const startRow = lastRow + 1;
  
  payload.normalized.forEach(item => {
    let val = Number(item.value);
    // Ajuste visual: Débito fica negativo
    if (item.type === 'D') val = Math.abs(val) * -1;
    else val = Math.abs(val);

    newRows.push([
      item.data, item.desc, val, item.type, item.account,
      "", item.id, item._meta.fileId, item._meta.hash
    ]);
  });

  if (newRows.length > 0) {
    const numRows = newRows.length;
    const numCols = newRows[0].length;
    
    sh.getRange(startRow, 1, numRows, numCols).setValues(newRows);
    sh.getRange(startRow, 1, numRows, 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(startRow, 3, numRows, 1).setNumberFormat('"R$ "* #,##0.00;[Red]"-" "R$ "* #,##0.00');
    
    const shPlano = ss.getSheetByName("Plano de Contas");
    if (shPlano && shPlano.getLastRow() > 1) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInRange(shPlano.getRange(2, 6, shPlano.getLastRow() - 1, 1), true)
        .setAllowInvalid(false).build();
      sh.getRange(startRow, 6, numRows, 1).setDataValidation(rule);
    }
  }
}

function CORE_DATALAKE(payload) { return payload; }