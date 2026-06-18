/* =====================================================================
   GFMB 5.0 — CONFIGURAÇÃO & UTILITÁRIOS (setup.gs)
   ===================================================================== */

const GFMB_CONFIG = {
  // ID da pasta de extratos (Ajuste conforme seu Drive)
  DRIVE_FOLDER_ID: "1tZdox39roa3_DhJ0lNW-5us4MTT9y1Df",
  
  // Nomes de Abas do Sistema
  ABAS: {
    LOG: "Log_Importacoes",
    CONSOLIDACAO: "Consolidacao",
    MEMORIA: "Memoria",
    DRE: "DRE",
    ERROR_LOG: "Log_Erros"
  },

  // Bancos suportados
  BANCOS: {
    CORA: "CORA",
    ASAAS: "ASAAS",
    STONE: "STONE"
  },

  // Versão do Sistema
  VERSION: "5.0-PRO"
};

/**
 * Valida se a configuração mínima existe.
 */
function CONFIG_check() {
  if (!GFMB_CONFIG.DRIVE_FOLDER_ID) throw new Error("CONFIG: DRIVE_FOLDER_ID não definido.");
  return true;
}

/**
 * Helper Global para Toasts (Notificações Visuais)
 */
function GFMB_toast(msg, title) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(msg, title || "GFMB 5.0", 5);
  } catch(e) {
    // Falha silenciosa se não houver UI
  }
}

/* =====================================================================
   PROTEÇÃO INTELIGENTE (SMART BLOCKING)
   ===================================================================== */

/**
 * Protege linhas Consolidadas e Splits para evitar edições acidentais.
 * Usa processamento em lote para performance.
 */
function protectConsolidatedRows(ss) {
  const sh = ss.getSheetByName("Consolidacao");
  if (!sh) return;

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  // 1. Remove proteções antigas
  const protections = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  protections.forEach(p => {
    if (p.getDescription() === "Consolidado (GFMB)") p.remove();
  });

  // 2. Leitura de dados
  const rubricas = sh.getRange(2, 6, lastRow - 1, 1).getValues();
  const bgColors = sh.getRange(2, 6, lastRow - 1, 1).getBackgrounds();
  const tipos = sh.getRange(2, 4, lastRow - 1, 1).getValues();

  const blocksToProtect = [];
  let currentBlockStart = -1;

  // 3. Identifica blocos contínuos para proteger
  for (let i = 0; i < rubricas.length; i++) {
    const rubrica = rubricas[i][0];
    const bg = bgColors[i][0];
    const tipo = tipos[i][0];
    
    // Critérios: Linha Split ('S') OU Consolidada (Branco + Rubrica)
    let shouldProtect = false;
    if (tipo === 'S') shouldProtect = true;
    else if (rubrica && rubrica !== "" && bg === '#ffffff') shouldProtect = true;

    if (shouldProtect) {
      if (currentBlockStart === -1) currentBlockStart = i; 
    } else {
      if (currentBlockStart !== -1) {
        blocksToProtect.push({ start: currentBlockStart, end: i - 1 });
        currentBlockStart = -1;
      }
    }
  }
  
  if (currentBlockStart !== -1) {
    blocksToProtect.push({ start: currentBlockStart, end: rubricas.length - 1 });
  }

  // 4. Aplica proteção
  if (blocksToProtect.length === 0) return;

  blocksToProtect.forEach(block => {
    const rowStart = block.start + 2;
    const numRows = (block.end - block.start) + 1;
    const range = sh.getRange(rowStart, 1, numRows, sh.getLastColumn());
    const protection = range.protect();
    
    protection.setDescription("Consolidado (GFMB)");
    protection.setWarningOnly(true); // Permite edição com aviso (mais seguro)
  });
  
  GFMB_toast(`🔒 ${blocksToProtect.length} blocos protegidos.`, "Blindagem");
}

/**
 * Desbloqueia todas as linhas (manutenção).
 */
function GFMB_unlockAllConsolidated() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Consolidacao");
  if (!sh) return;
  const protections = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  protections.forEach(p => {
    if (p.getDescription() === "Consolidado (GFMB)") p.remove();
  });
  GFMB_toast("🔓 Proteções removidas.", "Desbloqueio");
}