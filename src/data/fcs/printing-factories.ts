/** Online printing factory directory from the 2026-09-14 reference screenshot.
 * Name-only entries use local prototype IDs; existing organization IDs are reused.
 * This directory does not invent machine capacity, stock or completed transactions.
 */
export const PRINTING_FACTORIES = [
  { id: 'FAC-FLOWER', name: 'FLOWER' },
  { id: 'PRINT-FACTORY-ANJANI', name: 'ANJANI' },
  { id: 'PRINT-FACTORY-BAGUS', name: 'BAGUS' },
  { id: 'PRINT-FACTORY-CLINT', name: 'Clint' },
  { id: 'PRINT-FACTORY-DANIS', name: 'DANIS' },
  { id: 'PRINT-FACTORY-IRIJAYA', name: 'Irijaya printing' },
  { id: 'PRINT-FACTORY-MIDDAY-89', name: 'MIDDAY 89' },
  { id: 'PRINT-FACTORY-TEETWO', name: 'TEETWO KONVEKSI' },
  { id: 'ID-FAC-001165', name: 'sipatax' },
  { id: 'F090', name: '测试专用工厂' },
] as const

// Persisted demo document identities must not change when the factory directory changes.
// Slot 09 belonged to goto_global before it was removed as a printing supplier.
export const PRINTING_FACTORY_DEMO_CODES: Readonly<Record<string, string>> = {
  'FAC-FLOWER': '01', 'PRINT-FACTORY-ANJANI': '02', 'PRINT-FACTORY-BAGUS': '03',
  'PRINT-FACTORY-CLINT': '04', 'PRINT-FACTORY-DANIS': '05', 'PRINT-FACTORY-IRIJAYA': '06',
  'PRINT-FACTORY-MIDDAY-89': '07', 'PRINT-FACTORY-TEETWO': '08', 'ID-FAC-001165': '10',
}

/** Recognize exact previously issued identities, without adding retired suppliers to new orders. */
export function isKnownPrintingFactoryDemoIdentity(orderId: string, taskId: string, factoryId: string): boolean {
  const match = /^PWO-PRINT-DEMO-(\d{2})-([1-5])$/.exec(orderId)
  if (!match || taskId !== `TASK-PRINT-DEMO-${match[1]}-${match[2]}`) return false
  return PRINTING_FACTORY_DEMO_CODES[factoryId] === match[1]
    // The short-lived directory-index release also issued slot 09 to sipatax.
    || (match[1] === '09' && (factoryId === 'DYE-GOTO-GLOBAL' || factoryId === 'ID-FAC-001165'))
}

export function listPrintingFactoryOptions(records: ReadonlyArray<{ printFactoryId: string; printFactoryName: string }> = []): Array<{ id: string; name: string }> {
  const options = new Map<string, { id: string; name: string }>(PRINTING_FACTORIES.map(factory => [factory.id, { ...factory }]))
  for (const record of records) {
    if (record.printFactoryId && !options.has(record.printFactoryId)) {
      options.set(record.printFactoryId, { id: record.printFactoryId, name: record.printFactoryName || record.printFactoryId })
    }
  }
  return [...options.values()]
}
