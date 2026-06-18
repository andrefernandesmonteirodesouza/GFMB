/* =====================================================================
   FERRAMENTA DE DEBUG - IMPORTAÇÃO CORA (Foco no Topo/Recentes)
   ===================================================================== */

function RUN_DEBUG_CORA_TOPO() {
  const folderId = "1tZdox39roa3_DhJ0lNW-5us4MTT9y1Df"; 
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  
  let targetFile = null;
  // Pega o arquivo mais recente do Cora
  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().toLowerCase().includes("fermont-servicos") && f.getName().endsWith(".csv")) {
      if (!targetFile || f.getLastUpdated() > targetFile.getLastUpdated()) {
        targetFile = f;
      }
    }
  }

  if (!targetFile) { console.log("❌ Nenhum arquivo encontrado."); return; }

  console.log(`📂 Lendo Topo do Arquivo: ${targetFile.getName()}`);
  const content = targetFile.getBlob().getDataAsString("UTF-8");
  const linhasBrutas = content.split("\n");

  // 1. Mostra as primeiras 5 linhas brutas (logo após o cabeçalho)
  console.log("🔍 Primeiras 5 linhas de dados (RAW):");
  // Começa do 1 para pular o cabeçalho
  for (let i = 1; i <= 5 && i < linhasBrutas.length; i++) {
    console.log(`[Linha ${i}]: ${linhasBrutas[i]}`);
  }

  // 2. Teste do Parser
  console.log("\n🧪 Processando Parser...");
  let csvData = [];
  try { csvData = Utilities.parseCsv(content); } catch (e) { csvData = Utilities.parseCsv(content, ';'); }

  // Chama o parser de debug que está no mesmo arquivo (ou no core_import se tiver copiado)
  // Nota: Estou assumindo que a função CORE_IMPORT_PARSER_CORA_NATIVE_DEBUG ainda está no seu arquivo debug_cora.gs
  const parsedRows = CORE_IMPORT_PARSER_CORA_NATIVE_DEBUG(csvData); 
  
  console.log(`✅ Total extraído: ${parsedRows.length}`);
  console.log("🔍 Primeiros 5 lançamentos interpretados (Objeto):");
  
  // Mostra os primeiros 5 objetos (onde devem estar os dias 09 e 10)
  parsedRows.slice(0, 5).forEach(r => {
    // Formata a data para garantir que o JS entendeu certo
    const dataFormatada = Utilities.formatDate(r.data, Session.getScriptTimeZone(), "dd/MM/yyyy");
    console.log(`📅 ${dataFormatada} | 💰 ${r.value} | ${r.desc}`);
  });
}

// (Mantenha as funções auxiliares CORE_IMPORT_PARSER_CORA_NATIVE_DEBUG, _toNumber e _parseDataTime aqui embaixo iguais ao script anterior)