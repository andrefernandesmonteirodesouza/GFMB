function CORE_INIT(payload) {
  if (!payload || typeof payload !== "object") payload = {};
  if (!payload.raw) payload.raw = [];
  if (!payload.normalized) payload.normalized = [];
  if (!payload.ids) payload.ids = [];
  if (!payload.datalake) payload.datalake = {};
  if (!payload.memory) payload.memory = {};
  if (!payload.meta) payload.meta = {};
  if (!payload.warnings) payload.warnings = [];
  if (!payload.errors) payload.errors = [];
  return payload;
}