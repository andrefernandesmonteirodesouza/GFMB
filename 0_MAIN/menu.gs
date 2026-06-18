/* =====================================================================
   GFMB 5.0 — MENU (menu.gs)
   ===================================================================== */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('🚀 GFMB 5.0')
      .addItem('🌟 RODAR TUDO (Pipeline + IA + Revisão)', 'GFMB_MASTER_RUN')
      .addSeparator()
      .addItem('▶️ Executar Pipeline (Importar)', 'GFMB_RUN_PIPELINE')
      .addSeparator()
      .addItem('💳 Detalhar Fatura', 'UI_OPEN_CARD_SPLIT')
      .addItem('✂️ Dividir Lançamento', 'UI_OPEN_MANUAL_SPLIT')
      .addSeparator()
      .addItem('🧠 Treinar IA', 'IA_TRAIN_MEMORY')
      .addItem('✅ Revisar Sugestões IA', 'UI_OPEN_REVIEW')
      .addItem('📊 Abrir Dashboard PRO', 'UI_OPEN_DASHBOARD')
      .addSeparator()
      .addSubMenu(ui.createMenu('🛠️ Ferramentas')
          .addItem('💾 Fazer Backup Agora', 'TOOLS_BACKUP_EXECUTE')
          .addItem('🧹 Arquivar Extratos Processados', 'TOOLS_ORGANIZE_FILES')
          .addSeparator()
          .addItem('🔒 Proteger Consolidado', 'UTILS_PROTECT_ROWS')
          .addItem('🔓 Desbloquear Tudo', 'UTILS_UNPROTECT_ROWS')
      )
      .addToUi();
}

/**
 * ORQUESTRADOR MASTER
 */
function GFMB_MASTER_RUN() {
  const ss = SpreadsheetApp.getActive();
  
  ss.toast("1/3: Executando Pipeline...", "Rodar Tudo");
  GFMB_RUN_PIPELINE();
  Utilities.sleep(1500); 
  
  ss.toast("2/3: Refinando Inteligência...", "Rodar Tudo");
  IA_ENGINE_TRAIN();
  Utilities.sleep(1000);

  ss.toast("3/3: Abrindo Revisão...", "Rodar Tudo");
  UI_OPEN_REVIEW();
}

// --- WRAPPERS SEGUROS ---

function GFMB_RUN_PIPELINE() {
  const ss = SpreadsheetApp.getActive();
  ss.toast("🚀 Iniciando...", "GFMB 5.0", 2);
  try {
    if (typeof CORE_MAIN_EXECUTE === 'function') {
      CORE_MAIN_EXECUTE();
      SpreadsheetApp.flush();
      ss.toast("✅ Pipeline Finalizado!", "Concluído", 4);
    } else throw new Error("CORE_MAIN_EXECUTE não encontrado.");
  } catch (e) { 
    ss.toast("❌ Erro: " + e.message, "Falha", 10);
  }
}

function UI_OPEN_REVIEW() { if (typeof PRO_REVIEW_openModal === 'function') PRO_REVIEW_openModal(); }
function UI_OPEN_DASHBOARD() { if (typeof PRO_DASHBOARD_open === 'function') PRO_DASHBOARD_open(); }
function IA_TRAIN_MEMORY() { if (typeof IA_ENGINE_TRAIN === 'function') IA_ENGINE_TRAIN(); }
function UI_OPEN_MANUAL_SPLIT() { if (typeof PRO_SPLIT_openModal === 'function') PRO_SPLIT_openModal(); }
function UTILS_PROTECT_ROWS() { if (typeof protectConsolidatedRows === 'function') protectConsolidatedRows(SpreadsheetApp.getActive()); }
function UTILS_UNPROTECT_ROWS() { if (typeof GFMB_unlockAllConsolidated === 'function') GFMB_unlockAllConsolidated(); }
function TOOLS_BACKUP_EXECUTE() { if (typeof TOOLS_BACKUP_EXECUTE === 'function') TOOLS_BACKUP_EXECUTE(); }
function TOOLS_ORGANIZE_FILES() { if (typeof TOOLS_ORGANIZE_FILES === 'function') TOOLS_ORGANIZE_FILES(); }

function UI_OPEN_CARD_SPLIT() { 
  const ss = SpreadsheetApp.getActive(); 
  const row = ss.getActiveSheet().getActiveCell().getRow();
  const val = ss.getActiveSheet().getRange(row, 9).getValue(); 
  if (typeof PRO_CARTAO_openModal === 'function') {
      const h = PRO_CARTAO_openModal(row, val, ""); 
      SpreadsheetApp.getUi().showModalDialog(h, "Detalhar Fatura");
  }
}