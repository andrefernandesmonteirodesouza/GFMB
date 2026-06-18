/* =====================================================================
   GFMB 5.0 — IMPORTAÇÃO (core_import.gs)
   CORRIGIDO: Detecção por Nome do Arquivo (Cora)
   ===================================================================== */

function CORE_IMPORT(payload) {
  if (!payload) payload = {};
  if (!payload.context) payload.context = { filesProcessed: [] };
  if (!payload.raw) payload.raw = [];
  if (!payload.meta) payload.meta = {};
  if (!payload.warnings) payload.warnings = [];
  if (!payload.errors) payload.errors = [];
  
  if (!payload.source) payload.source = "DRIVE";
  
  if (payload.source === "DRIVE") return CORE_IMPORT_RUN_FROM_DRIVE(payload);
  return payload; 
}

function CORE_IMPORT_RUN_FROM_DRIVE(payload) {
  try {
    const folderId = (typeof GFMB_CONFIG !== 'undefined') ? GFMB_CONFIG.DRIVE_FOLDER_ID : "1tZdox39roa3_DhJ0lNW-5us4MTT9y1Df"; 
    const files = CORE_IMPORT_LIST_FILES(folderId);
    
    files.forEach(file => {
      const content = file.blob.getDataAsString("UTF-8");
      
      // 🔥 DETECÇÃO ROBUSTA POR NOME 🔥
      const banco = CORE_IMPORT_DETECT_BANK(file.name, content);
      
      if (!banco) {
        payload.warnings.push(`Ignorado: ${file.name}`);
        return;
      }

      let csvData = [];
      try { csvData = Utilities.parseCsv(content); } 
      catch (e) { csvData = Utilities.parseCsv(content, ';'); }

      let rows = [];
      if (banco === "CORA")  rows = CORE_IMPORT_PARSER_CORA_NATIVE(csvData);
      if (banco === "ASAAS") rows = CORE_IMPORT_PARSER_ASAAS_NATIVE(csvData);
      if (banco === "STONE") rows = CORE_IMPORT_PARSER_STONE_NATIVE(csvData);
      
      rows.forEach(r => {
        payload.raw.push({
          data: r.data, desc: r.desc, value: r.value, type: r.type, account: r.account,
          _meta: { fileId: file.id, fileName: file.name, banco: banco }
        });
      });
      
      payload.context.filesProcessed.push({ name: file.name, banco: banco, count: rows.length });
    });

    payload.meta.CORE_IMPORT = { executed: true, timestamp: new Date(), files: files.length };

  } catch (e) {
    payload.errors.push(`Erro Importação: ${e.message}`);
  }
  return payload;
}

function CORE_IMPORT_DETECT_BANK(fileName, content) {
  const n = fileName.toLowerCase();
  
  // 🔥 CORA: Prioridade para o nome do arquivo, ignorando cabeçalho bugado
  if (n.includes("fermont-servicos") || n.includes("cora")) return "CORA";
  
  if (n.includes("extrato asaas") || n.includes("asaas")) return "ASAAS";
  if (n.includes("comprovante de extrato") || n.includes("stone")) return "STONE";

  // Fallback (Conteúdo)
  const head = content.slice(0, 1000).toUpperCase();
  if (head.includes("SALDO INICIAL")) return "ASAAS";
  if ((head.includes("DESTINO") && head.includes("MOVIMENTA")) || head.includes("STONE")) return "STONE";
  
  // Cora Fallback (Aceita "IDENTIFICA" parcial)
  if (head.includes("IDENTIFICA") && head.includes("DEBIT")) return "CORA";
  
  return null;
}

function CORE_IMPORT_LIST_FILES(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const iterator = folder.getFiles();
  const out = [];
  while (iterator.hasNext()) {
    const f = iterator.next();
    if (f.getMimeType() === MimeType.CSV || f.getName().toLowerCase().endsWith('.csv')) {
      out.push({ id: f.getId(), name: f.getName(), blob: f.getBlob() });
    }
  }
  return out;
}

function _toNumber(val) {
  if (!val) return 0;
  let s = String(val).trim().replace(/R\$/gi, '').replace(/\s+/g, '');
  if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.indexOf(',') >= 0) s = s.replace(',', '.');
  return Number(s) || 0;
}

function _parseDataTime(str) {
    if (!str) return null;
    str = String(str).trim(); 
    const parts = str.split(/[\/-]/);
    if (parts.length === 3) {
       const d = parseInt(parts[0], 10);
       const m = parseInt(parts[1], 10) - 1;
       let y = parseInt(parts[2], 10);
       if (y < 100) y += 2000;
       const dataObj = new Date(y, m, d);
       if (!isNaN(dataObj.getTime())) return dataObj;
    }
    const nativeDate = new Date(str);
    if (!isNaN(nativeDate.getTime())) return nativeDate;
    return null;
}

// --- PARSERS ---

function CORE_IMPORT_PARSER_CORA_NATIVE(csvData) {
  const out = [];
  let start = -1;
  // Tenta achar cabeçalho, se não achar, assume linha 0
  for(let i=0; i<csvData.length; i++) {
     const rowStr = csvData[i].join("|").toUpperCase();
     if(rowStr.includes("DATA") && (rowStr.includes("TRANSA") || rowStr.includes("IDENTIFICA"))) { start = i; break; }
  }
  if (start === -1) start = 0; 

  for (let i = start + 1; i < csvData.length; i++) {
    const cols = csvData[i];
    if (cols.length < 3) continue;

    const valorIdx = cols[4] !== undefined ? 4 : 3;
    const descIdx = valorIdx === 4 ? 3 : 2;
    const valor = _toNumber(cols[valorIdx]);
    const desc = (cols[descIdx] || "").trim();
    let tipo = valor < 0 ? "D" : "C";
    if (cols[2] && cols[2].toUpperCase().includes("DÉBITO")) tipo = "D";

    out.push({ data: _parseDataTime(cols[0]), desc: desc, value: Math.abs(valor), type: tipo, account: "CORA" });
  }
  return out;
}

function CORE_IMPORT_PARSER_ASAAS_NATIVE(csvData) {
  const out = [];
  let start = -1;
  for(let i=0; i<csvData.length; i++) {
     const rowStr = csvData[i].join("|").toUpperCase();
     if(rowStr.includes("DATA") && rowStr.includes("VALOR")) { start = i; break; }
  }
  
  for (let i = start + 1; i < csvData.length; i++) {
    const cols = csvData[i];
    if (cols.length < 3) continue;
    const valor = _toNumber(cols[5] || cols[cols.length-1]);
    if (Math.abs(valor) < 0.01) continue; 
    const desc = (cols[4] || cols[1] || "").trim();
    if (desc.toUpperCase().includes("SALDO") || desc.toUpperCase().includes("TOTAL")) continue;
    let tipo = valor < 0 ? "D" : "C";
    if (cols[2] && cols[2].toUpperCase().includes("DÉBITO")) tipo = "D";
    out.push({ data: _parseDataTime(cols[0]), desc: desc, value: Math.abs(valor), type: tipo, account: "ASAAS" });
  }
  return out;
}

function CORE_IMPORT_PARSER_STONE_NATIVE(csvData) {
  const out = [];
  let headerIdx = -1;
  for(let i=0; i<csvData.length; i++) {
     const rowStr = csvData[i].join("|").toUpperCase();
     if(rowStr.includes("MOVIMENTA") && rowStr.includes("VALOR")) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return out;
  const I_MOV = 0, I_VAL = 2, I_DATA = 6, I_DESTINO = 10;
  for (let i = headerIdx + 1; i < csvData.length; i++) {
    const cols = csvData[i];
    if (cols.length <= I_DESTINO) continue;
    const valor = _toNumber(cols[I_VAL]);
    if (valor === 0) continue;
    let tipoContabil = "C";
    const movStr = (cols[I_MOV] || "").toUpperCase();
    if (valor < 0 || movStr.includes("DÉBITO") || movStr.includes("DEBITO")) tipoContabil = "D";
    let desc = cols[I_DESTINO].trim();
    if (!desc || desc === "") continue;
    out.push({ data: _parseDataTime(cols[I_DATA]), desc: desc, value: Math.abs(valor), type: tipoContabil, account: "STONE" });
  }
  return out;
}