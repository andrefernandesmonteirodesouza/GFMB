/* =====================================================================
   GFMB 5.0 — BACKUP (tools_backup.gs)
   ===================================================================== */

function TOOLS_BACKUP_EXECUTE() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Consolidacao");
  
  if (!sh) { ss.toast("❌ Aba 'Consolidacao' não encontrada."); return; }

  try {
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm");
    const backupName = `BKP_Consolidacao_${timestamp}`;
    const folderName = "GFMB_BACKUPS";
    
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    const newSS = SpreadsheetApp.create(backupName);
    sh.copyTo(newSS);
    
    // Limpeza da nova planilha
    const defaultSheet = newSS.getSheetByName("Página1");
    if (defaultSheet) newSS.deleteSheet(defaultSheet);
    newSS.getSheets()[0].setName("Consolidacao_Snapshot");

    DriveApp.getFileById(newSS.getId()).moveTo(folder);
    ss.toast(`✅ Backup salvo em: ${folderName}`, "Sucesso");

  } catch (e) {
    ss.toast(`❌ Erro no backup: ${e.message}`);
  }
}