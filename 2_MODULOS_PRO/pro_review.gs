/* =====================================================================
   GFMB PRO — REVISÃO (pro_review.gs)
   CORRIGIDO V4: Filtro Agressivo para remover Splits da Revisão
   ===================================================================== */

function PRO_REVIEW_openModal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Consolidacao");
  if (!sh) return;

  const lastRow = sh.getLastRow();
  if (lastRow < 2) { 
    if (typeof GFMB_toast === 'function') GFMB_toast("Nada para revisar."); 
    return; 
  }

  const data = sh.getRange(2, 1, lastRow - 1, 11).getValues();
  const bgColors = sh.getRange(2, 6, lastRow - 1, 1).getBackgrounds();
  
  const suggestions = [];

  data.forEach((row, i) => {
    const bg = bgColors[i][0];
    const rubrica = row[5]; 
    const tipo = String(row[3]).toUpperCase();
    const desc = String(row[1]).toUpperCase(); // Força uppercase para busca

    // --- FILTROS DE BLINDAGEM ---
    // 1. É Pai de Split? (Tipo S) -> TCHAU
    // 2. É Filha de Split? (Tem "[SPLIT" ou "[DIVIDIDO" no texto) -> TCHAU
    // 3. Já está confirmado? (Fundo Branco) -> TCHAU
    
    const isSplitDad = (tipo === "S");
    const isSplitChild = (desc.includes("[SPLIT") || desc.includes("[DIVIDIDO"));
    const isConfirmed = (bg === "#ffffff");
    const hasRubrica = (rubrica && rubrica !== "");

    // Só entra se NÃO for split, TIVER rubrica e NÃO for branco
    if (!isSplitDad && !isSplitChild && hasRubrica && !isConfirmed) {
      suggestions.push({
        rowIndex: i + 2,
        dataDisplay: Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "dd/MM/yy"),
        dataStamp: new Date(row[0]).getTime(),
        desc: row[1], // Mantém descrição original visualmente
        valor: row[2], 
        rubrica: rubrica, 
        color: bg
      });
    }
  });

  if (suggestions.length === 0) {
    if (typeof GFMB_toast === 'function') GFMB_toast("✨ Tudo limpo!", "Revisão");
    return;
  }

  const html = HtmlService.createTemplateFromFile('3_UI-HTML/Dialogos/ui_dialog_review');
  html.dados = { list: suggestions };
  
  SpreadsheetApp.getUi().showModalDialog(
    html.evaluate().setWidth(1250).setHeight(800), 
    `Revisar ${suggestions.length} Itens`
  );
}

function PRO_REVIEW_confirm(list) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Consolidacao");
  if (!list || list.length === 0) return { success: false };

  list.forEach(item => {
    const cell = sh.getRange(item.rowIndex, 6); 
    cell.setValue(item.rubrica);
    cell.setBackground("#ffffff");
  });

  if (typeof IA_ENGINE_TRAIN === 'function') IA_ENGINE_TRAIN(); 
  return { success: true };
}

function PRO_REVIEW_getRubricas() {
  if (typeof PRO_SPLIT_getRubricas === 'function') return PRO_SPLIT_getRubricas();
  return [];
}