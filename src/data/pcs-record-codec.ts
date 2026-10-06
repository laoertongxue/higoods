import { parseEngineeringBomSnapshot } from './pcs-engineering-bom-storage.ts'
import type { PcsStoredRecord } from './pcs-record-db.ts'

export type PcsRecordEntry = { position: number; data: unknown }
type StoredInput = Omit<PcsStoredRecord, 'version'>
type Metadata = { array: boolean; fields?: Record<string, unknown>; groups?: string[] }

/** Convert the previous field name at the storage boundary, including saved references. */
export function normalizePcsRecordSnapshot(key: string, raw: string): unknown {
  const value = key === 'higood-pcs-engineering-bom-pricing-plan-store-v2'
    ? parseEngineeringBomSnapshot(raw) : JSON.parse(raw)
  // JSON parsing has already created a private tree. Update the few legacy
  // references there instead of allocating another copy of every saved field.
  const rename = (item: unknown): void => {
    if (!item || typeof item !== 'object') return
    if (Array.isArray(item)) { for (const child of item) rename(child); return }
    const object = item as Record<string, unknown>
    for (const name of Object.keys(object)) {
      const child = object[name]
      if (name === 'productConfigRefs' && child && typeof child === 'object') {
        const refs = child as Record<string, unknown>
        if (refs.styleCodes && !refs.categoryNumbers) refs.categoryNumbers = refs.styleCodes
        delete refs.styleCodes
      }
      if (child && typeof child === 'object') rename(child)
    }
  }
  // Current snapshots already use categoryNumbers. Walking every nested field
  // is only necessary when the old reference actually exists.
  if (raw.includes('"styleCodes"') || raw.includes('\\u')) rename(value)
  const normalized = value as Record<string, unknown>
  if (key === 'higood-pcs-config-workspace-store-v1' && normalized?.flatOptions) {
    const old = normalized.flatOptions as Record<string, unknown[]>
    const options = Object.entries(old).flatMap(([dimensionId, rows]) => rows.map(row => ({
      ...(row as object), dimensionId: dimensionId === 'styleCodes' ? 'categoryNumbers' : dimensionId,
    })))
    const { flatOptions: _oldOptions, ...rest } = normalized
    return { ...rest, configuredDimensions: Object.fromEntries(Object.keys(old).map(id => [id === 'styleCodes' ? 'categoryNumbers' : id, true])), options }
  }
  return normalized
}

/** A record's own identity takes precedence over every parent/reference identity. */
export function pcsRecordIdentity(key: string, group: string, value: unknown, position: number): string {
  if (!value || typeof value !== 'object') return String(position)
  const item = value as Record<string, unknown>
  const text = (name: string) => typeof item[name] === 'string' && item[name] ? String(item[name]) : undefined
  if (key === 'higood-pcs-material-config-v1' && group === 'templates' && text('templateId')) return `${item.templateId}:v${item.version}`
  if (key === 'higood-pcs-config-workspace-store-v1' && group === 'options' && text('dimensionId') && text('id')) return `${item.dimensionId}:${item.id}`
  if (key === 'higood-pcs-channel-catalog-v1' || key === 'higood-pcs-channel-store-v1') {
    if (text('id')) return text('id')!
    throw new Error('渠道记录缺少自身编号，未保存。')
  }
  const materialIds: Record<string, string> = { records: 'materialId', skuRecords: 'materialSkuId', usageRecords: 'usageId', logRecords: 'logId', processDefinitions: 'processDefinitionId', unitRelations: 'relationId', packages: 'packageSpecId', costVersions: 'costVersionId', assets: 'assetId' }
  if (key === 'higood-pcs-material-archive-store-v2' && materialIds[group]) {
    const id = text(materialIds[group]); if (id) return id
    throw new Error(`物料记录缺少自身编号 ${materialIds[group]}，未保存。`)
  }
  if (text('resultVersionId')) return text('resultVersionId')!
  if ('itemId' in item && 'purpose' in item && 'taskId' in item) return `${item.taskId}:${item.itemId}:${item.purpose}`
  for (const name of ['conversionId', 'transferId', 'eventId', 'sampleId', 'id', 'batchId', 'logId', 'notificationId', 'pendingRelationId', 'pendingItemId', 'pendingId', 'recordId', 'projectRelationId', 'relationId', 'pricingPlanId', 'planId', 'samplingTaskId', 'bomDraftVersionId', 'versionId', 'bomVersionId', 'testingOrderId', 'channelProductId', 'technicalVersionId', 'skuId', 'masterOrderId', 'styleId']) {
    if (text(name)) return text(name)!
  }
  throw new Error(`业务记录缺少稳定编号，未保存（字段：${Object.keys(item).join(',')}）。`)
}

export function decodePcsRecordSnapshot(key: string, raw: string): StoredInput[] {
  const value = normalizePcsRecordSnapshot(key, raw)
  if (value === null || typeof value !== 'object') throw new Error('业务资料格式不正确，原资料已保留。')
  const result: StoredInput[] = []
  const groups: Record<string, unknown[]> = Array.isArray(value) ? { items: value } : Object.fromEntries(Object.entries(value).filter(([, v]) => Array.isArray(v))) as Record<string, unknown[]>
  const metadata: Metadata = Array.isArray(value) ? { array: true } : { array: false, fields: Object.fromEntries(Object.entries(value).filter(([, v]) => !Array.isArray(v))), groups: Object.keys(groups) }
  result.push({ id: `${key}/meta`, collection: key, value: metadata })
  for (const [group, values] of Object.entries(groups)) {
    const seen = new Set<string>()
    values.forEach((data, position) => {
      const id = `${key}/${group}/${encodeURIComponent(pcsRecordIdentity(key, group, data, position))}`
      if (seen.has(id)) throw new Error(`业务记录编号重复，未保存（${id}）。`)
      seen.add(id)
      result.push({ id, collection: `${key}/${group}`, value: { position, data } satisfies PcsRecordEntry })
    })
  }
  return result
}

export function assemblePcsRecordSnapshot(key: string, rows: PcsStoredRecord[], seed?: string, seedIdFilter?: (id: string) => boolean): unknown {
  const seedRows = seed ? decodePcsRecordSnapshot(key, seed).filter(row => !seedIdFilter || row.id === `${key}/meta` || seedIdFilter(row.id)) : []
  const relevant = rows.filter(row => row.id.startsWith(`${key}/`))
  const trigger = (row: StoredInput) => (row.value as { data?: { bulkProductionQualification?: { uniqueTriggerKey?: string } } } | null)?.data?.bulkProductionQualification?.uniqueTriggerKey
  const existingTriggers = new Set(relevant.filter(row => !row.deleted).map(trigger).filter(Boolean))
  const combined = new Map(seedRows.filter(row => !trigger(row) || !existingTriggers.has(trigger(row))).map(row => [row.id, row]))
  for (const row of relevant) { if (row.deleted) combined.delete(row.id); else combined.set(row.id, row) }
  const metadata = combined.get(`${key}/meta`)?.value as Metadata | undefined
  if (!metadata) return null
  const seedMeta = seedRows.find(row => row.id === `${key}/meta`)?.value as Metadata | undefined
  const grouped = new Map<string, PcsRecordEntry[]>()
  for (const row of combined.values()) {
    if (row.id === `${key}/meta`) continue
    const list = grouped.get(row.collection) ?? []
    list.push(row.value as PcsRecordEntry); grouped.set(row.collection, list)
  }
  const read = (group: string) => (grouped.get(`${key}/${group}`) ?? []).sort((a, b) => a.position - b.position).map(row => row.data)
  const groups = [...new Set([...(seedMeta?.groups ?? []), ...(metadata.groups ?? [])])]
  return metadata.array ? read('items') : { ...seedMeta?.fields, ...metadata.fields, ...Object.fromEntries(groups.map(group => [group, read(group)])) }
}

export function encodePcsRecordSnapshot(key: string, rows: PcsStoredRecord[], seed?: string, seedIdFilter?: (id: string) => boolean, serialize: (value: unknown) => string = JSON.stringify): string | null {
  const value = assemblePcsRecordSnapshot(key, rows, seed, seedIdFilter)
  if (value === null) return null
  const raw = serialize(value)
  // The assembled current-format records are already normalized. Only a real
  // legacy field/format needs another parse; current large collections used to
  // be parsed, recursively copied and serialized twice on every refresh.
  const legacy = raw.includes('"styleCodes"')
    || (key === 'higood-pcs-config-workspace-store-v1' && raw.includes('"flatOptions"'))
    || (key === 'higood-pcs-engineering-bom-pricing-plan-store-v2' && raw.includes('"higood-bom-dictionary-v1"'))
  return legacy ? JSON.stringify(normalizePcsRecordSnapshot(key, raw)) : raw
}

/** Compare the same record after deriving redundant legacy metadata from its own collection. */
export function equalPcsRecordValues(left: StoredInput, right: StoredInput, leftRows: readonly StoredInput[], rightRows: readonly StoredInput[]): boolean {
  const canonical = (row: StoredInput, rows: readonly StoredInput[]): unknown => {
    if (row.id !== 'higood-pcs-config-workspace-store-v1/meta') return row.value
    const meta = row.value as Metadata
    const fields = { ...meta.fields }
    const configured = { ...(fields.configuredDimensions as Record<string, boolean> | undefined) }
    for (const option of rows) {
      if (option.collection !== 'higood-pcs-config-workspace-store-v1/options' || (option as PcsStoredRecord).deleted) continue
      const dimension = ((option.value as PcsRecordEntry)?.data as { dimensionId?: string })?.dimensionId
      if (dimension) configured[dimension] = true
    }
    if (Object.keys(configured).length) fields.configuredDimensions = configured
    else delete fields.configuredDimensions
    return { ...meta, fields, groups: [...(meta.groups || [])].sort() }
  }
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([name, child]) => [name, stable(child)])) : value
  return JSON.stringify(stable(canonical(left, leftRows))) === JSON.stringify(stable(canonical(right, rightRows)))
}
