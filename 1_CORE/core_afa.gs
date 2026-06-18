/* =====================================================================
   GFMB 5.0 — AFA (ADVANCED FINANCIAL ANALYSIS)
   Unificação dos blocos 5.1 a 5.5
   ===================================================================== */

const AFA_SEEDS = {
  PIX: { keywords: ["PIX", "TRANSFERENCIA", "TRANSF"], weight: 1.0 },
  TED: { keywords: ["TED", "DOC"], weight: 1.0 },
  CARTAO: { keywords: ["COMPRA", "DEBITO", "CREDITO", "MASTERCARD", "VISA"], weight: 0.9 },
  PAGAMENTO: { keywords: ["PAGAMENTO", "BOLETO"], weight: 0.9 },
  REC: { keywords: ["RECEB", "DEPOSITO"], weight: 0.9 },
  SERVICO: { keywords: ["SERV", "PREST", "TRAB"], weight: 0.6 },
  BANCO: { keywords: ["TARIFA", "COBRANCA", "ENC"], weight: 0.7 },
  ONLINE: { keywords: ["IFOOD", "UBER", "AMAZON", "NETFLIX", "SPOTIFY"], weight: 0.5 }
};

// --- 5.1: PATTERNS ---
function AFA_runSeedsAndPatterns(payload) {
  if (!payload || !Array.isArray(payload.normalized)) return payload;

  const patterns = [];
  const featureMap = [];

  payload.normalized.forEach(line => {
    const pat = AFA_buildPatterns(line);
    patterns.push(pat);
    featureMap.push(AFA_buildFeatureMap(pat));
  });

  payload.afa = payload.afa || {};
  payload.afa.seeds = AFA_SEEDS;
  payload.afa.patterns = patterns;
  payload.afa.featureMap = featureMap;

  return payload;
}

function AFA_buildPatterns(line) {
  const desc = (line.desc || "").toUpperCase();
  const value = Math.abs(Number(line.value || 0));
  
  let bucket = "R0";
  if (value >= 1 && value < 50) bucket = "R1";
  else if (value < 200) bucket = "R2";
  else if (value < 800) bucket = "R3";
  else if (value < 2500) bucket = "R4";
  else bucket = "R5";

  let semantic = "";
  if (/PIX/.test(desc)) semantic += "P";
  if (/TED|DOC/.test(desc)) semantic += "T";
  if (/COMPRA|DEBITO/.test(desc)) semantic += "C";
  if (/PAGAMENTO/.test(desc)) semantic += "G";
  if (/DEPOSITO/.test(desc)) semantic += "D";
  
  return { bucket, semantic: semantic + (line.type || ""), acct: (line.account || "").toUpperCase(), descShort: desc.substring(0, 20) };
}

function AFA_buildFeatureMap(pattern) {
  const features = [];
  const bucketMap = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4, R5: 5 };
  features.push(bucketMap[pattern.bucket] || 0);
  features.push(pattern.semantic.length);
  features.push(pattern.acct.length % 7);

  const desc = (pattern.descShort || "").toUpperCase();
  for (const key in AFA_SEEDS) {
    const seed = AFA_SEEDS[key];
    let score = 0;
    for (const kw of seed.keywords) if (desc.includes(kw)) score += seed.weight;
    features.push(score);
  }
  return features;
}

// --- 5.2: FEATURE ENGINEERING ---
function AFA_runFeatureEngineering(payload) {
  if (!payload || !payload.afa || !Array.isArray(payload.afa.patterns)) return payload;

  const patterns = payload.afa.patterns;
  const featureRaw = payload.afa.featureMap;
  const finalVectors = [];

  for (let i = 0; i < patterns.length; i++) {
    const vec = [];
    const rawNorm = AFA_normalizeVector(featureRaw[i]);
    vec.push(...rawNorm);
    vec.push(Math.log10(Math.abs(Number(payload.normalized[i].value || 0)) + 1)); // Log Scale
    vec.push(patterns[i].semantic.length);
    vec.push((patterns[i].acct.length % 7) / 7);
    finalVectors.push(vec);
  }

  payload.afa.features = finalVectors;
  return payload;
}

function AFA_normalizeVector(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return vec;
  const min = Math.min(...vec);
  const max = Math.max(...vec);
  return (min === max) ? vec.map(() => 0) : vec.map(v => (v - min) / (max - min));
}

// --- 5.3 & 5.4: SIMILARITY & CLUSTERING ---
function AFA_runClusterizer(payload) {
  if (!payload || !payload.afa || !payload.afa.features) return payload;

  // Matriz de Similaridade (Simplificada para performance)
  // Nota: Em grandes volumes, isso pode ser lento. Mantendo K-Lite.
  const feats = payload.afa.features;
  const n = feats.length;
  const sim = [];

  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
       // Weighted Similarity inline
       const cos = AFA_cosineSimilarity(feats[i], feats[j]);
       const sameBucket = (payload.afa.patterns[i].bucket === payload.afa.patterns[j].bucket) ? 1 : 0;
       row.push(0.7 * cos + 0.3 * sameBucket);
    }
    sim.push(row);
  }

  // Clustering K-Lite
  const visited = new Array(n).fill(false);
  const clusters = [];
  const threshold = 0.85; 

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const cluster = [i];
    visited[i] = true;
    for (let j = i + 1; j < n; j++) {
      if (!visited[j] && sim[i][j] >= threshold) {
        cluster.push(j);
        visited[j] = true;
      }
    }
    clusters.push(cluster);
  }

  payload.afa.clusters = clusters;
  return payload;
}

function AFA_cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return (normA === 0 || normB === 0) ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- 5.5: API LOOKUP ---
function AFA_lookup(payload, query) {
  if (!query || !query.type) return null;
  if (query.type === "cluster" && payload.afa.clusters) {
     for (let cIndex = 0; cIndex < payload.afa.clusters.length; cIndex++) {
       if (payload.afa.clusters[cIndex].includes(query.idx)) return { id: cIndex, members: payload.afa.clusters[cIndex] };
     }
  }
  return null;
}