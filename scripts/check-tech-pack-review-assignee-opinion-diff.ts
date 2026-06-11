import assert from 'node:assert/strict'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
  },
  configurable: true,
})

const {
  approveTechPackReview,
  getTechnicalReviewPendingReviewerText,
  startTechPackReview,
  submitTechPackFirstStageReview,
} = await import('../src/data/pcs-tech-pack-review.ts')
const { buildTechPackReviewDiffSnapshot } = await import('../src/data/pcs-tech-pack-review-diff.ts')
const {
  getTechnicalDataVersionById,
  replaceTechnicalDataVersionStore,
} = await import('../src/data/pcs-technical-data-version-repository.ts')

const styleId = 'STYLE-REVIEW-ASSIGNEE-DIFF'
const publishedId = 'tdv_review_assignee_diff_published'
const draftId = 'tdv_review_assignee_diff_draft'

function createRecord(
  technicalVersionId: string,
  versionNo: number,
  status: TechnicalDataVersionRecord['versionStatus'],
): TechnicalDataVersionRecord {
  return {
    technicalVersionId,
    technicalVersionCode: `TDV-REVIEW-ASSIGNEE-DIFF-${versionNo}`,
    versionLabel: `V${versionNo}`,
    versionNo,
    styleId,
    styleCode: styleId,
    styleName: '指定审核人与差异验证款',
    sourceProjectId: 'PRJ-REVIEW-ASSIGNEE-DIFF',
    sourceProjectCode: 'PRJ-REVIEW-ASSIGNEE-DIFF',
    sourceProjectName: '指定审核人与差异验证项目',
    sourceProjectNodeId: '',
    primaryPlateTaskId: '',
    primaryPlateTaskCode: '',
    primaryPlateTaskVersion: '',
    linkedRevisionTaskIds: [],
    linkedPatternTaskIds: [],
    linkedArtworkTaskIds: [],
    createdFromTaskType: 'MANUAL',
    createdFromTaskId: '',
    createdFromTaskCode: '',
    baseTechnicalVersionId: '',
    baseTechnicalVersionCode: '',
    changeScope: '手动新增',
    changeSummary: '指定审核人与差异验证',
    garmentDifficultyGrade: 'B',
    linkedPartTemplateIds: [],
    linkedPatternLibraryVersionIds: [],
    linkedPatternAssetIds: [],
    linkedPatternAssetCodes: [],
    archiveCollectedFlag: false,
    archiveCollectedAt: '',
    versionStatus: status,
    bomStatus: 'DRAFT',
    patternStatus: 'DRAFT',
    processStatus: 'DRAFT',
    gradingStatus: 'DRAFT',
    qualityStatus: 'DRAFT',
    colorMaterialStatus: 'DRAFT',
    designStatus: 'EMPTY',
    attachmentStatus: 'EMPTY',
    bomItemCount: 1,
    patternFileCount: 1,
    processEntryCount: 1,
    gradingRuleCount: 1,
    qualityRuleCount: 1,
    colorMaterialMappingCount: 1,
    designAssetCount: 0,
    attachmentCount: 0,
    completenessScore: 100,
    missingItemCodes: [],
    missingItemNames: [],
    publishedAt: status === 'PUBLISHED' ? '2026-05-20 10:00' : '',
    publishedBy: status === 'PUBLISHED' ? '测试用户' : '',
    createdAt: '2026-05-20 09:00',
    createdBy: '测试用户',
    updatedAt: '2026-05-25 10:00',
    updatedBy: '测试用户',
    note: '',
    legacySpuCode: '',
    legacyVersionLabel: '',
  }
}

function createContent(
  technicalVersionId: string,
  materialName: string,
  patternName: string,
): TechnicalDataVersionContent {
  return {
    technicalVersionId,
    patternFiles: [
      {
        id: 'pattern-review-assignee-diff-1',
        recordKind: 'PACKAGE',
        patternName,
        fileName: `${patternName}.dxf`,
        fileUrl: '#',
        uploadedAt: '2026-05-25 10:00',
        uploadedBy: '版师',
      },
    ],
    patternDesc: '',
    processEntries: [],
    sizeTable: [],
    bomItems: [
      {
        id: 'bom-review-assignee-diff-1',
        type: '面料',
        name: materialName,
        spec: '棉',
        unitConsumption: 1,
        lossRate: 0.03,
        supplier: '供应商甲',
      },
    ],
    qualityRules: [],
    colorMaterialMappings: [
      {
        id: 'mapping-review-assignee-diff-1',
        spuCode: styleId,
        colorCode: 'BK',
        colorName: '黑色',
        status: 'CONFIRMED',
        generatedMode: 'MANUAL',
        lines: [],
      },
    ],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {
      materialCostItems: [{ id: 'MC-review-assignee-diff-1', bomItemId: 'bom-review-assignee-diff-1', price: 12, currency: '人民币', unit: '人民币/件' }],
    },
  }
}

replaceTechnicalDataVersionStore({
  version: 3,
  records: [
    createRecord(publishedId, 1, 'PUBLISHED'),
    createRecord(draftId, 2, 'DRAFT'),
  ],
  contents: [
    createContent(publishedId, '旧主面料', '旧前片纸样'),
    createContent(draftId, '新主面料', '新前片纸样'),
  ],
  pendingItems: [],
})

assert.throws(
  () =>
    submitTechPackFirstStageReview(draftId, {
      buyerReviewerId: 'PATTERN-001',
      patternMakerReviewerId: 'PATTERN-001',
      merchandiserReviewerId: 'MERCH-001',
      operator: { id: 'U001', name: 'Budi Santoso' },
    }),
  /不是买手/,
  '买手审核节点不能指定版师',
)

let current = submitTechPackFirstStageReview(draftId, {
  buyerReviewerId: 'BUYER-001',
  patternMakerReviewerId: 'PATTERN-001',
  merchandiserReviewerId: 'MERCH-001',
  operator: { id: 'U001', name: 'Budi Santoso' },
})
assert.equal(current.buyerReview?.assignedReviewerName, '买手A', '买手节点应保存指定审核人')
assert.equal(current.patternMakerReview?.assignedReviewerName, '版师B', '版师节点应保存指定审核人')
assert.equal(current.merchandiserReview?.assignedReviewerName, '跟单C', '跟单节点应保存指定审核人')
assert.equal(getTechnicalReviewPendingReviewerText(current), '买手：买手A、版师：版师B', '待审核提示应展示具体审核人')

assert.throws(
  () =>
    startTechPackReview(draftId, 'BUYER', {
      operator: { id: 'PATTERN-001', name: '版师B' },
      opinion: '试图代审',
    }),
  /仅指定审核人 买手A/,
  '非指定审核人不能处理买手节点',
)
assert.throws(
  () =>
    startTechPackReview(draftId, 'BUYER', {
      operator: { id: 'BUYER-001', name: '买手A' },
      opinion: '',
    }),
  /请填写开始审核意见/,
  '开始审核必须填写意见',
)

current = startTechPackReview(draftId, 'BUYER', {
  operator: { id: 'BUYER-001', name: '买手A' },
  opinion: '开始核对物料清单和核价。',
})
assert.equal(current.buyerReview?.startedOpinion, '开始核对物料清单和核价。', '开始审核说明应保存到节点')
assert.equal(current.buyerReview?.diffStatus, '有差异', '买手节点应生成与最新发布版本的差异状态')
assert.ok(current.buyerReview?.diffSummaryText.includes('最新已发布版本'), '买手差异摘要应说明对比基线')

assert.throws(
  () => approveTechPackReview(draftId, 'BUYER', '', { id: 'BUYER-001', name: '买手A' }),
  /请填写审核意见/,
  '审核通过必须填写审核意见',
)
current = approveTechPackReview(draftId, 'BUYER', '物料清单和核价差异确认通过。', {
  id: 'BUYER-001',
  name: '买手A',
})
assert.equal(current.buyerReview?.opinion, '物料清单和核价差异确认通过。', '审核意见应保存到节点')

const diff = buildTechPackReviewDiffSnapshot(getTechnicalDataVersionById(draftId)!, 'BUYER')
assert.equal(diff.baselineVersionCode, 'TDV-REVIEW-ASSIGNEE-DIFF-1', '差异基线应取最新已发布版本')
assert.equal(diff.diffStatus, '有差异', '当前草稿和已发布版本存在差异')
assert.ok(diff.items.some((item) => item.scope === '物料清单' && item.changeType === '修改'), '差异明细应包含物料清单修改')

console.log('check:tech-pack-review-assignee-opinion-diff passed')
