/* =====================================================================
   GFMB 5.0 — SMART SPLIT ENGINE (pro_smart_split.gs)
   Inteligência Híbrida: Histórico + Padrões.
   ===================================================================== */

function SMART_SPLIT_GET_SUGGESTION(currentDesc, currentValue, currentHash) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shCons = ss.getSheetByName("Consolidacao");
  const shCard = ss.getSheetByName("Detalhamento_Cartao");
  
  if (!shCons || !shCard) return null;

  const safeHash = String(currentHash).trim();
  const safeDesc = String(currentDesc).trim().toUpperCase();

  // 1. Modo Edição (Já existe?)
  const existingItems = _FETCH_EXISTING_ITEMS(shCard, safeHash);
  if (existingItems && existingItems.length > 0) {
      return { mode: "EDIT", msg: "✏️ Editando detalhamento existente.", items: existingItems };
  }

  // 2. Modo Smart (Histórico)
  const parentData = _FIND_PARENT_TRANSACTION_GLOBAL(shCons, safeDesc, safeHash);
  if (!parentData) return null; 

  // 3. Busca Filhos do Pai
  const suggestions = _FETCH_AND_CALCULATE_CHILDREN(shCard, parentData.hash);
  if (!suggestions || suggestions.length === 0) return null;

  return {
      mode: "SMART",
      msg: `🤖 Padrão detectado de ${parentData.dateStr}.`,
      items: suggestions
  };
}

function _FETCH_EXISTING_ITEMS(sheet, myHash) {
  const data = sheet.getDataRange().getValues(); 
  const results = [];
  for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === myHash) {
          results.push({
              desc: String(data[i][3]),
              val: Math.abs(Number(data[i][4])),
              rubrica: String(data[i][7]),
              parcela: data[i][5],
              total: data[i][6],
              dataCompra: _formatDate(data[i][2])
          });
      }
  }
  return results;
}

function _FIND_PARENT_TRANSACTION_GLOBAL(sheet, targetDescRaw, ignoreHash) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues(); 
  const targetDesc = String(targetDescRaw).toUpperCase().trim();
  let candidates = [];

  for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rawDate = row[0];
      let validDate = (rawDate instanceof Date) ? rawDate : new Date(rawDate);
      
      if (!validDate || isNaN(validDate.getTime())) continue;

      const rDesc = String(row[1]).toUpperCase().trim();
      const rTipo = String(row[3]);
      const rHash = String(row[8]).trim();

      if (rHash === ignoreHash) continue;

      // Match Flexível
      const isMatch = rDesc.includes(targetDesc) || targetDesc.includes(rDesc);

      if (isMatch && rTipo === 'S' && rHash !== "") {
          candidates.push({ date: validDate, hash: rHash });
      }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.date.getTime() - a.date.getTime()); // Mais recente
  return { hash: candidates[0].hash, dateStr: Utilities.formatDate(candidates[0].date, Session.getScriptTimeZone(), "dd/MM/yyyy") };
}

function _FETCH_AND_CALCULATE_CHILDREN(sheet, parentHash) {
  const data = sheet.getDataRange().getValues(); 
  const results = [];
  const targetHashStr = String(parentHash).trim();

  for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === targetHashStr) {
          let parcAtual = data[i][5];
          let parcTotal = data[i][6];
          
          // Lógica de Avanço de Parcela
          if (parcTotal && Number(parcTotal) > 0) {
              let atual = Number(parcAtual);
              if (atual < Number(parcTotal)) parcAtual = atual + 1;
              else continue; // Parcela acabou
          } 

          results.push({
              desc: String(data[i][3]),
              val: Math.abs(Number(data[i][4])),
              rubrica: String(data[i][7]),
              parcela: parcAtual,
              total: parcTotal,
              dataCompra: _formatDate(data[i][2])
          });
      }
  }
  return results;
}

function _formatDate(d) {
    if (!d) return "";
    if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yy");
    return String(d);
}