function normalizeWarehouseInventoryQueryCode(value: string): string {
  return value.trim().toUpperCase()
}

export function matchesWarehouseInventoryQueryCode(searchCodes: string[], rawQuery: string): boolean {
  const normalizedQuery = normalizeWarehouseInventoryQueryCode(rawQuery)
  if (!normalizedQuery) return false
  return searchCodes.some((code) => normalizeWarehouseInventoryQueryCode(code) === normalizedQuery)
}
