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
Object.defineProperty(globalThis, 'HTMLInputElement', { value: class HTMLInputElement {}, configurable: true })
Object.defineProperty(globalThis, 'HTMLSelectElement', { value: class HTMLSelectElement {}, configurable: true })
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { value: class HTMLTextAreaElement {}, configurable: true })

const {
  canEditTechnicalModule,
  getTechnicalReviewPendingReviewerText,
  getTechnicalReviewPendingRoles,
  startTechPackReview,
  submitTechPackFirstStageReview,
} = await import('../src/data/pcs-tech-pack-review.ts')
const {
  getTechnicalDataVersionById,
  replaceTechnicalDataVersionStore,
} = await import('../src/data/pcs-technical-data-version-repository.ts')
const {
  listTechPackReviewNotificationsByNode,
  resetTechPackReviewNotificationRepository,
} = await import('../src/data/pcs-tech-pack-review-notification-repository.ts')
const { renderTechPackPage } = await import('../src/pages/tech-pack.ts')
const { state } = await import('../src/pages/tech-pack/context.ts')

const styleId = 'STYLE-REVIEW-NO-CHANGE'
const styleCode = 'STYLE-REVIEW-NO-CHANGE'
const publishedId = 'tdv_review_no_change_published'
const draftId = 'tdv_review_no_change_draft'

function createRecord(
  technicalVersionId: string,
  versionNo: number,
  status: TechnicalDataVersionRecord['versionStatus'],
): TechnicalDataVersionRecord {
  return {
    technicalVersionId,
    technicalVersionCode: `TDV-REVIEW-NO-CHANGE-${versionNo}`,
    versionLabel: `V${versionNo}`,
    versionNo,
    styleId,
    styleCode,
    styleName: '无差异免审验证款',
    sourceProjectId: 'PRJ-REVIEW-NO-CHANGE',
    sourceProjectCode: 'PRJ-REVIEW-NO-CHANGE',
    sourceProjectName: '无差异免审验证项目',
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
    changeSummary: '买手和版师范围无差异',
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
    publishedAt: status === 'PUBLISHED' ? '2026-06-01 10:00' : '',
    publishedBy: status === 'PUBLISHED' ? '测试用户' : '',
    createdAt: '2026-06-01 09:00',
    createdBy: '测试用户',
    updatedAt: '2026-06-02 10:00',
    updatedBy: '测试用户',
    note: '',
    legacySpuCode: '',
    legacyVersionLabel: '',
  }
}

function createContent(technicalVersionId: string): TechnicalDataVersionContent {
  return {
    technicalVersionId,
    patternFiles: [
      {
        id: 'pattern-review-no-change-package',
        recordKind: 'PACKAGE',
        patternName: '基础纸样包',
        fileName: 'base-pattern.dxf',
        fileUrl: '#',
        uploadedAt: '2026-06-01 10:00',
        uploadedBy: '版师',
      },
      {
        id: 'pattern-review-no-change-link',
        recordKind: 'MATERIAL_ASSOCIATION',
        patternName: '主面料关联纸样',
        fileName: 'material-link.dxf',
        fileUrl: '#',
        uploadedAt: '2026-06-01 10:00',
        uploadedBy: '跟单',
      },
    ],
    patternDesc: '',
    processEntries: [
      {
        id: `process-${technicalVersionId}`,
        entryType: 'CRAFT',
        stageCode: 'PROD',
        stageName: '生产阶段',
        processCode: 'SEW',
        processName: technicalVersionId === draftId ? '车缝复核' : '基础车缝',
        craftCode: 'SEW_BASE',
        craftName: '基础车缝',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'CRAFT',
        isSpecialCraft: false,
      },
    ],
    sizeTable: [{ id: 'size-review-no-change-1', part: '衣长', S: 60, M: 62, L: 64, XL: 66, tolerance: 1 }],
    bomItems: [
      {
        id: 'bom-review-no-change-1',
        type: '面料',
        name: '主面料',
        spec: '棉',
        unitConsumption: 1,
        lossRate: 0.03,
        supplier: '供应商甲',
      },
    ],
    qualityRules: [],
    colorMaterialMappings: [
      {
        id: 'mapping-review-no-change-1',
        spuCode: styleCode,
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
      materialCostItems: [
        {
          id: 'MC-review-no-change-1',
          bomItemId: 'bom-review-no-change-1',
          price: 12,
          currency: '人民币',
          unit: '人民币/件',
        },
      ],
    },
  }
}

resetTechPackReviewNotificationRepository()
replaceTechnicalDataVersionStore({
  version: 3,
  records: [
    createRecord(publishedId, 1, 'PUBLISHED'),
    createRecord(draftId, 2, 'DRAFT'),
  ],
  contents: [createContent(publishedId), createContent(draftId)],
  pendingItems: [],
})

renderTechPackPage(styleCode, { styleId, technicalVersionId: draftId })
state.reviewSubmitDialogOpen = true
const submitDialogHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId: draftId })
assert.ok(submitDialogHtml.includes('审核范围判断'), '提交审核确认弹窗应展示差异审核范围判断')
assert.ok(submitDialogHtml.includes('买手审核 · 物料清单、核价'), '提交审核确认弹窗应展示买手审核范围')
assert.ok(submitDialogHtml.includes('版师审核 · 纸样池'), '提交审核确认弹窗应展示版师审核范围')
assert.equal((submitDialogHtml.match(/无需审核/g) || []).length >= 2, true, '买手和版师无差异时弹窗应标记无需审核')
state.reviewSubmitDialogOpen = false

replaceTechnicalDataVersionStore({
  version: 3,
  records: [
    createRecord(publishedId, 1, 'PUBLISHED'),
    createRecord(draftId, 2, 'DRAFT'),
  ],
  contents: [createContent(publishedId), createContent(draftId)],
  pendingItems: [],
})

let current = submitTechPackFirstStageReview(draftId, {
  buyerReviewerId: 'BUYER-001',
  patternMakerReviewerId: 'PATTERN-001',
  merchandiserReviewerId: 'MERCH-001',
  operator: { id: 'U001', name: 'Budi Santoso' },
})
assert.equal(current.buyerReview?.status, '无需审核', '买手范围无差异时应标记无需审核')
assert.equal(current.patternMakerReview?.status, '无需审核', '版师范围无差异时应标记无需审核')
assert.equal(current.reviewStage, '跟单复核', '买手和版师均无需审核时应直接进入跟单复核')
assert.deepEqual(getTechnicalReviewPendingRoles(current), ['跟单'], '免审后待审核角色只剩跟单')
assert.equal(getTechnicalReviewPendingReviewerText(current), '跟单：跟单C', '免审后待审核人只显示跟单')
assert.equal(canEditTechnicalModule(current, 'BOM'), false, '买手免审后物料清单应锁定')
assert.equal(canEditTechnicalModule(current, 'PATTERN'), false, '版师免审后纸样池应锁定')
assert.throws(
  () => startTechPackReview(draftId, 'BUYER', { operator: { id: 'BUYER-001', name: '买手A' }, opinion: '开始审核' }),
  /无需审核/,
  '无需审核节点不能再开始审核',
)
assert.equal(listTechPackReviewNotificationsByNode(draftId, 'BUYER').length, 0, '买手免审时不应发送买手审核提醒')
assert.equal(listTechPackReviewNotificationsByNode(draftId, 'PATTERN_MAKER').length, 0, '版师免审时不应发送版师审核提醒')
assert.equal(listTechPackReviewNotificationsByNode(draftId, 'MERCHANDISER').length, 1, '买手和版师均免审时应通知跟单复核')

state.reviewDetailDrawerOpen = true
const drawerHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId: draftId })
assert.ok(drawerHtml.includes('买手：<span class="font-medium text-foreground">无需审核</span>'), '审核详情摘要应标记买手无需审核')
assert.ok(drawerHtml.includes('版师：<span class="font-medium text-foreground">无需审核</span>'), '审核详情摘要应标记版师无需审核')
assert.ok(drawerHtml.includes('指定审核人：<span class="font-medium text-foreground">无需指定</span>'), '免审卡片应显示无需指定审核人')
assert.ok(drawerHtml.includes('飞书提醒：<span class="font-medium text-foreground">无需发送</span>'), '免审卡片应显示无需发送飞书提醒')

current = getTechnicalDataVersionById(draftId)!
assert.equal(current.merchandiserReview?.status, '待审核', '免审后跟单节点仍待审核')

console.log('check:tech-pack-review-no-change-skip passed')
