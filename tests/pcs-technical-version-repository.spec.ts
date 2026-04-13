import assert from 'node:assert/strict'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  buildTechnicalDataDerivedState,
  getTechnicalDataVersionStoreSnapshot,
  listTechnicalDataVersionPendingItems,
  resetTechnicalDataVersionRepository,
} from '../src/data/pcs-technical-data-version-repository.ts'

resetStyleArchiveRepository()
resetTechnicalDataVersionRepository()

const snapshot = getTechnicalDataVersionStoreSnapshot()
assert.ok(snapshot.records.length > 0, '旧 FCS 技术包种子补齐后，应生成正式技术包版本记录')
assert.ok(
  snapshot.records.some((item) => item.styleCode === 'SPU-2024-001' && item.versionStatus === 'PUBLISHED'),
  '已发布的旧 FCS 技术包应写入正式技术包版本仓储',
)
assert.equal(snapshot.pendingItems.length, 0, '已纳入款式档案的旧 FCS 技术包不应继续停留在待补齐清单')
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
