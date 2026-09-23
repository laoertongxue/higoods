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

export function listPrintingFactoryOptions(records: ReadonlyArray<{ printFactoryId: string; printFactoryName: string }> = []): Array<{ id: string; name: string }> {
  const options = new Map<string, { id: string; name: string }>(PRINTING_FACTORIES.map(factory => [factory.id, { ...factory }]))
  for (const record of records) {
    if (record.printFactoryId && !options.has(record.printFactoryId)) {
      options.set(record.printFactoryId, { id: record.printFactoryId, name: record.printFactoryName || record.printFactoryId })
    }
  }
  return [...options.values()]
}
