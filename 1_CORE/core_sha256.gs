/* =====================================================================
   GFMB 5.0 — CRIPTOGRAFIA (core_sha256.gs)
   ===================================================================== */

function CORE_SHA_HASH(text) {
  if (text === null || text === undefined) text = "";
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(b => {
     const v = (b & 0xFF).toString(16);
     return v.length === 1 ? "0" + v : v;
  }).join("");
}

// Alias de compatibilidade
function CORE_SHA256_hash(text) { return CORE_SHA_HASH(text); }

function CORE_SHA256_stableStringify(input) {
  const seen = new WeakSet();
  function serialize(value) {
    if (value === null) return "null";
    if (value === undefined) return "";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      if (seen.has(value)) return "";
      seen.add(value);
      if (Array.isArray(value)) return "[" + value.map(v => serialize(v)).join(",") + "]";
      const keys = Object.keys(value).sort();
      const body = keys.map(k => `${k}:${serialize(value[k])}`).join(",");
      return `{${body}}`;
    }
    return "";
  }
  return serialize(input);
}