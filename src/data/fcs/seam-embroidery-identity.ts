/** One current identity. Numeric source values are used only to read/migrate saved facts. */
export const SEAM_EMBROIDERY = {
  craftCode: 'CRAFT_3000010', craftName: '缝边绣', legacyValue: 3000010,
  operationId: 'AUX-OP-SEAM-EMBROIDERY',
} as const
const sourceValues = new Set([1048576, 3000003, 3000004, 3000005])

export function needsSeamEmbroideryNormalization(raw: string): boolean {
  return raw.includes('\\u') || /CRAFT_(?:1048576|300000[345])|"legacyValue"\s*:\s*(?:1048576|300000[345])|specialCrafts-4|AUX-WP-AREA-(?:08|09|10)/.test(raw)
}

export function canonicalSeamCraftCode(code: string): string {
  const match = /^CRAFT_(\d+)$/.exec(code)
  return match && sourceValues.has(Number(match[1])) ? SEAM_EMBROIDERY.craftCode : code
}

/** Normalize a private JSON tree, retaining document/node IDs, quantities and factory facts.
 * This is a projection at ordinary reads; only the owning repository may persist it.
 * Repeated route nodes are separate operations and must never be coalesced.
 */
export function normalizeSeamEmbroideryReferences<T>(value: T): T {
  const rewrite = (item: unknown, inherited = new Set<string>()): void => {
    if (!item || typeof item !== 'object') return
    if (Array.isArray(item)) {
      item.forEach((child, index) => {
        if (typeof child === 'string') item[index] = inherited.has(child) ? SEAM_EMBROIDERY.craftName : canonicalSeamCraftCode(child)
        else rewrite(child, inherited)
      })
      return
    }
    const row = item as Record<string, unknown>
    if (typeof row.areaId === 'string' && /^AUX-WP-AREA-(?:08|09|10)$/.test(row.areaId)) {
      row.areaId = 'AUX-WP-AREA-08'
      if ('areaName' in row) row.areaName = '缝边绣-裁片库区'
    }
    // A different craft starts its own scope; names must not spill into siblings.
    const labels = typeof row.craftCode === 'string' ? new Set<string>() : new Set(inherited)
    const addLabel = (label: unknown): void => {
      if (typeof label === 'string' && label.trim()) labels.add(label)
    }
    const fromCode = typeof row.craftCode === 'string' && canonicalSeamCraftCode(row.craftCode) !== row.craftCode
    const fromValue = typeof row.legacyValue === 'number' && sourceValues.has(row.legacyValue)
    const fromOption = row.id === 'specialCrafts-4' && (row.dimensionId === 'specialCrafts' || row.code === '4')
    for (const field of ['linkedCraftCode', 'sourceCraftCode', 'targetCraftCode']) {
      const code = row[field]
      if (typeof code !== 'string' || canonicalSeamCraftCode(code) === code) continue
      const name = field.replace(/Code$/, 'Name')
      if (typeof row[name] === 'string') { addLabel(row[name]); row[name] = SEAM_EMBROIDERY.craftName }
      row[field] = SEAM_EMBROIDERY.craftCode
    }
    if (Array.isArray(row.craftCodes)) {
      const names = Array.isArray(row.craftNames) ? row.craftNames : []
      row.craftCodes.forEach((code, index) => {
        if (typeof code === 'string' && canonicalSeamCraftCode(code) !== code && typeof names[index] === 'string') {
          addLabel(names[index])
          names[index] = SEAM_EMBROIDERY.craftName
        }
      })
      row.craftCodes = [...new Set(row.craftCodes.map(code => typeof code === 'string' ? canonicalSeamCraftCode(code) : code))]
    }
    if (fromCode || fromValue || fromOption) {
      for (const name of ['craftName', 'legacyCraftName', 'operationName', 'displayName', 'name_zh']) {
        addLabel(row[name])
      }
      if ('craftCode' in row) row.craftCode = SEAM_EMBROIDERY.craftCode
      if ('legacyValue' in row) row.legacyValue = SEAM_EMBROIDERY.legacyValue
      for (const name of ['craftName', 'legacyCraftName', 'operationName', 'displayName', 'name_zh']) if (name in row) row[name] = SEAM_EMBROIDERY.craftName
      if ('operationId' in row) row.operationId = SEAM_EMBROIDERY.operationId
    }
    if (fromCode || fromValue) {
      if ('processCode' in row && row.processCode !== 'SPECIAL_CRAFT') {
        row.processCode = 'SPECIAL_CRAFT'
        if ('processName' in row) row.processName = '特殊工艺'
      }
      if ('systemProcessCode' in row) row.systemProcessCode = 'PROC_SPECIAL_CRAFT'
    }
    for (const [key, child] of Object.entries(row)) {
      if (typeof child === 'string') {
        const code = canonicalSeamCraftCode(child)
        const identity = /(?:Id|Ids|Key|Code|Url|Path|No)$/.test(key) || key === 'id'
        row[key] = identity ? code : [...labels].reduce((text, label) => text.replaceAll(label, SEAM_EMBROIDERY.craftName), code)
      } else rewrite(child, labels)
      if (key === 'specialCrafts' && Array.isArray(child)) {
        const seen = new Set<string>()
        row[key] = child.filter(entry => {
          if (!entry || typeof entry !== 'object' || 'id' in entry || 'sourceEntryId' in entry) return true
          const signature = JSON.stringify(entry)
          if (seen.has(signature)) return false
          seen.add(signature)
          return true
        })
      }
      const canonicalKey = canonicalSeamCraftCode(key)
      if (canonicalKey !== key) {
        if (canonicalKey in row && JSON.stringify(row[canonicalKey]) !== JSON.stringify(row[key])) throw new Error('缝边绣配置存在不同来源的冲突值，原资料已保留，请核对后保存。')
        row[canonicalKey] = row[key]
        delete row[key]
      }
    }
  }
  rewrite(value)
  return value
}
