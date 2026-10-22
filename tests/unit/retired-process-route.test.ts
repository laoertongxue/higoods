import assert from 'node:assert/strict'
import test from 'node:test'
import { removeRetiredProcessRouteEntries, validateProcessRouteGraph, type ProcessRouteGraphEntry } from '../../src/data/tech-pack-process-route.ts'
import { removeRetiredTechnicalProcessContent, projectUneditedLegacyTechnicalDemo } from '../../src/data/pcs-technical-data-demo-projection.ts'
import type { TechnicalDataVersionContent, TechnicalDataVersionRecord, TechnicalDataVersionStoreSnapshot } from '../../src/data/pcs-technical-data-version-types.ts'

const entry = (id: string, processCode: string, parents?: string[]): ProcessRouteGraphEntry => ({ id, stageCode: 'PREP', processCode, ...(parents ? { predecessorEntryIds: parents } : {}) })

test('退役加工节点从原显式边中移除，保留其他工艺身份及原始输入', () => {
  const original = [entry('dye', 'DYE', []), entry('old', 'WASH', ['dye']), entry('print', 'PRINT', ['old']), entry('other', 'SEW', [])]
  const before = structuredClone(original)
  const next = removeRetiredProcessRouteEntries(original)
  assert.deepEqual(next.map(item => item.id), ['dye', 'print', 'other'])
  assert.deepEqual(next[1].predecessorEntryIds, ['dye'])
  assert.deepEqual(next[2], original[3])
  assert.deepEqual(original, before)
})

test('连续退役节点接回原并行前置，合并重复边而不按名称重排', () => {
  const next = removeRetiredProcessRouteEntries([
    entry('b', 'PRINT', []), entry('a', 'DYE', []), entry('old-1', 'WASH', ['b', 'a']), entry('old-2', 'craft-wash', ['old-1']), entry('cut', 'CUT_PANEL', ['old-2', 'a']),
  ])
  assert.deepEqual(next.map(item => item.id), ['b', 'a', 'cut'])
  assert.deepEqual(next[2].predecessorEntryIds, ['b', 'a'])
})

test('没有退役节点时不新增前置字段，显式空前置也不按步骤猜链', () => {
  const original = [{ ...entry('one', 'PRINT'), routeStepNo: 1 }, { ...entry('two', 'DYE', []), routeStepNo: 2 }]
  assert.deepEqual(removeRetiredProcessRouteEntries(original), original)
  const next = removeRetiredProcessRouteEntries([...original, { ...entry('old', 'WASH', []), routeStepNo: 3 }, { ...entry('four', 'CUT_PANEL', []), routeStepNo: 4 }])
  assert.equal(Object.hasOwn(next[0], 'predecessorEntryIds'), false)
  assert.deepEqual(next[2].predecessorEntryIds, [])
})

test('不能用新手感替代旧节点，也不能将现场手感提前确认成固定路线', () => {
  const next = removeRetiredProcessRouteEntries([entry('print', 'PRINT', []), entry('old', 'WASH', ['print'])])
  assert.equal(next.some(item => item.processCode === 'STENTER_HAND_FEEL'), false)
  assert(validateProcessRouteGraph([entry('old', 'WASH')]).some(issue => issue.code === 'RETIRED_PROCESS_ROUTE'))
  assert(validateProcessRouteGraph([entry('site', 'STENTER_HAND_FEEL')]).some(issue => issue.code === 'SITE_HAND_FEEL_NOT_STATIC_ROUTE'))
})

test('原退役前置存在回路时拒绝猜测接法，缺失的原前置仍明确保留供既有校验处理', () => {
  assert.throws(() => removeRetiredProcessRouteEntries([entry('old-a', 'WASH', ['old-b']), entry('old-b', 'craft-wash', ['old-a']), entry('cut', 'CUT_PANEL', ['old-a'])]), /循环/)
  const next = removeRetiredProcessRouteEntries([entry('old', 'WASH', ['missing']), entry('cut', 'CUT_PANEL', ['old'])])
  assert.deepEqual(next[0].predecessorEntryIds, ['missing'])
})

function content(overrides: Partial<TechnicalDataVersionContent> = {}): TechnicalDataVersionContent {
  return { technicalVersionId: 'published-retirement-fixture', patternFiles: [], patternDesc: '保留原纸样说明', processEntries: [], processRouteSchemaVersion: 2, sizeTable: [], bomItems: [], qualityRules: [], colorMaterialMappings: [], patternDesigns: [], attachments: [], legacyCompatibleCostPayload: {}, ...overrides }
}

test('技术内容退役仅移除对应成本与BOM工序引用，保留洗水唛和护理等其他物料事实', () => {
  const source = content({ processEntries: [entry('print', 'PRINT', []), entry('old', 'WASH', ['print']), entry('cut', 'CUT_PANEL', ['old'])] as TechnicalDataVersionContent['processEntries'], bomItems: [{ id: 'label', materialName: '洗水唛', usageProcessCodes: ['SEW', 'WASH'] }] as TechnicalDataVersionContent['bomItems'], legacyCompatibleCostPayload: { processCostItems: [{ id: 'c-old', processId: 'old', price: 9 }, { id: 'c-cut', processId: 'cut', price: 5 }], customCostItems: [{ id: 'care', name: '成衣护理说明' }] } })
  const before = structuredClone(source), next = removeRetiredTechnicalProcessContent(source)
  assert.deepEqual(next.processEntries.map(item => item.id), ['print', 'cut'])
  assert.deepEqual(next.processEntries[1].predecessorEntryIds, ['print'])
  assert.equal(next.bomItems.length, 1)
  assert.equal((next.bomItems[0] as unknown as { materialName: string }).materialName, '洗水唛')
  assert.deepEqual(next.bomItems[0].usageProcessCodes, ['SEW'])
  assert.deepEqual(next.legacyCompatibleCostPayload.processCostItems, [{ id: 'c-cut', processId: 'cut', price: 5 }])
  assert.deepEqual(next.legacyCompatibleCostPayload.customCostItems, source.legacyCompatibleCostPayload.customCostItems)
  assert.equal(next.patternDesc, source.patternDesc)
  assert.deepEqual(source, before)
})

test('V1只使用既有步骤迁移一次后接回，V2显式空前置不从相邻步骤补链', () => {
  const base = { routeObjectKey: 'BOM:main', inputObjectType: 'FABRIC', outputObjectType: 'FABRIC' } as const
  const legacy = content({ processRouteSchemaVersion: 1, processEntries: [{ ...entry('print', 'PRINT'), ...base, routeStepNo: 1 }, { ...entry('old', 'WASH'), ...base, routeStepNo: 2 }, { ...entry('cut', 'CUT_PANEL'), ...base, routeStepNo: 3 }] as TechnicalDataVersionContent['processEntries'] })
  const migrated = removeRetiredTechnicalProcessContent(legacy)
  assert.equal(migrated.processRouteSchemaVersion, 2)
  assert.deepEqual(migrated.processEntries[1].predecessorEntryIds, ['print'])
  const explicit = removeRetiredTechnicalProcessContent({ ...legacy, processRouteSchemaVersion: 2, processEntries: legacy.processEntries.map(item => ({ ...item, predecessorEntryIds: [] })) })
  assert.deepEqual(explicit.processEntries[1].predecessorEntryIds, [])
})

test('没有旧节点时也移除带明确退役身份的孤立成本，不猜测其他孤立成本身份', () => {
  const source = content({ legacyCompatibleCostPayload: { processCostItems: [{ processId: 'WASH', price: 5 }, { processId: 'unattributed-old-id', price: 3 }] } })
  const next = removeRetiredTechnicalProcessContent(source)
  assert.deepEqual(next.legacyCompatibleCostPayload.processCostItems, [{ processId: 'unattributed-old-id', price: 3 }])
  assert.deepEqual(next.processEntries, [])
})

test('已发布内容仍只精确退役旧节点，保留原发布人与其他事实并同步可见工艺数量', () => {
  const originalContent = content({ processEntries: [entry('print', 'PRINT', []), entry('old', 'WASH', ['print']), entry('cut', 'CUT_PANEL', ['old'])] as TechnicalDataVersionContent['processEntries'] })
  const originalRecord = { technicalVersionId: originalContent.technicalVersionId, versionStatus: 'PUBLISHED', publishedBy: '原发布人', publishedAt: '2026-01-01', note: '原现场说明', processEntryCount: 3 } as TechnicalDataVersionRecord
  const original: TechnicalDataVersionStoreSnapshot = { version: 1, records: [originalRecord], contents: [originalContent], pendingItems: [] }
  const replacement: TechnicalDataVersionStoreSnapshot = { version: 1, records: [{ ...originalRecord, note: '不得覆盖的演示替换', publishedBy: '其他人' }], contents: [content({ patternDesc: '不得替换原纸样' })], pendingItems: [] }
  const next = projectUneditedLegacyTechnicalDemo(original, replacement)
  assert.equal(next.records[0].publishedBy, '原发布人')
  assert.equal(next.records[0].publishedAt, '2026-01-01')
  assert.equal(next.records[0].note, '原现场说明')
  assert.equal(next.records[0].processEntryCount, 2)
  assert.equal(next.contents[0].patternDesc, '保留原纸样说明')
  assert.deepEqual(next.contents[0].processEntries[1].predecessorEntryIds, ['print'])
  assert.equal(original.records[0].processEntryCount, 3)
})
