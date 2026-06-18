/* =====================================================================
   GFMB 5.0 — ORGANIZADOR (tools_organizer.gs)
   ===================================================================== */

function TOOLS_ORGANIZE_FILES() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ROOT_FOLDER_ID = (typeof GFMB_CONFIG !== 'undefined') ? GFMB_CONFIG.DRIVE_FOLDER_ID : "1tZdox39roa3_DhJ0lNW-5us4MTT9y1Df"; 
  const MAPA_MESES = ["01-Janeiro", "02-Fevereiro", "03-Março", "04-Abril", "05-Maio", "06-Junho", "07-Julho", "08-Agosto", "09-Setembro", "10-Outubro", "11-Novembro", "12-Dezembro"];

  try {
    const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const files = rootFolder.getFiles();
    let movedCount = 0;
    
    ss.toast("🧹 Organizando arquivos...", "Organizador");

    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType() !== MimeType.CSV && !file.getName().toLowerCase().endsWith(".csv")) continue;

      const content = file.getBlob().getDataAsString("UTF-8");
      const dateStats = _TOOLS_analyzeDates(content);
      
      if (!dateStats) continue;

      const folderNameMonth = MAPA_MESES[dateStats.month];
      const yearFolder = _TOOLS_getOrCreateSubFolder(rootFolder, dateStats.year.toString());
      const targetFolder = _TOOLS_getOrCreateSubFolder(yearFolder, folderNameMonth);

      file.moveTo(targetFolder);
      movedCount++;
    }

    if (movedCount > 0) ss.toast(`✅ ${movedCount} arquivos movidos.`, "Organizador");
    else ss.toast("Nenhum arquivo para organizar.", "Organizador");

  } catch (e) {
    ss.toast(`❌ Erro: ${e.message}`, "Falha");
  }
}

function _TOOLS_analyzeDates(content) {
  const regexDate = /(\d{2})\/(\d{2})\/(\d{4})/g;
  const matches = [...content.matchAll(regexDate)];
  if (matches.length === 0) return null;

  const stats = {};
  matches.forEach(m => {
    const key = `${m[3]}-${parseInt(m[2]) - 1}`; // Ano-MêsIndex
    stats[key] = (stats[key] || 0) + 1;
  });

  let bestKey = Object.keys(stats).reduce((a, b) => stats[a] > stats[b] ? a : b);
  const parts = bestKey.split("-");
  return { year: parseInt(parts[0]), month: parseInt(parts[1]) };
}

function _TOOLS_getOrCreateSubFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(folderName);
}