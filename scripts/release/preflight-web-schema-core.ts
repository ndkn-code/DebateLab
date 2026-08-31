export function hasRequiredChatContract(tableProbeStatus: number) {
  // PostgREST validates a selected column before applying RLS. A successful
  // table probe therefore proves product_context exists; 400-level schema
  // errors (such as undefined product_context) and auth failures fail closed.
  return tableProbeStatus >= 200 && tableProbeStatus < 300;
}

export function isRetryableSchemaProbeStatus(tableProbeStatus: number) {
  return tableProbeStatus === 408 || tableProbeStatus === 429 || tableProbeStatus >= 500;
}
