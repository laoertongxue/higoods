import assert from 'node:assert/strict'
import {
  buildTechnicalDataDerivedState,
  getTechnicalDataVersionStoreSnapshot,
  listTechnicalDataVersionPendingItems,
  resetTechnicalDataVersionRepository,
} from '../src/data/pcs-technical-data-version-repository.ts'

resetTechnicalDataVersionRepository()

const snapshot = getTechnicalDataVersionStoreSnapshot()
assert.equal(snapshot.records.length, 0, '历史技术资料未匹配到正式款式档案时，不应误建正式技术资料版本')
assert.ok(snapshot.pendingItems.length > 0, '未匹配到正式款式档案的历史技术资料应进入待补齐清单')
assert.deepEqual(snapshot.pendingItems, listTechnicalDataVersionPendingItems(), '待补齐清单应可通过正式仓储接口读取')

const derived = buildTechnicalDataDerivedState('DRAFT', {
  technicalVersionId: 'tdv_test_empty',
  patternFiles: [],
  patternDesc: '',
  processEntries: [],
  sizeTable: [],
  bomItems: [],
  qualityRules: [],
  colorMaterialMappings: [],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {
    costDraft: true,
  },
})

assert.equal(derived.completenessScore, 0, '核心域全部为空时完成度应为 0')
assert.equal(derived.qualityStatus, 'EMPTY', '质检标准为空时状态应为未建立')
assert.ok(derived.missingItemCodes.includes('QUALITY'), '质检标准为空时缺失项必须包含 QUALITY')
assert.ok(derived.missingItemNames.includes('质检标准'), '缺失项中文名必须包含质检标准')

console.log('pcs-technical-version-repository.spec.ts PASS')
