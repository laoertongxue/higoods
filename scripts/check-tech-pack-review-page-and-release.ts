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
  approveTechPackReview,
  startTechPackReview,
} = await import('../src/data/pcs-tech-pack-review.ts')
const { publishTechnicalDataVersion } = await import('../src/data/pcs-project-technical-data-writeback.ts')
const {
  getTechnicalDataVersionById,
  replaceTechnicalDataVersionStore,
} = await import('../src/data/pcs-technical-data-version-repository.ts')
const { handleTechPackEvent, renderTechPackPage } = await import('../src/pages/tech-pack.ts')

const technicalVersionId = 'tdv_review_page_001'
const styleId = 'STYLE-REVIEW-PAGE'
const styleCode = 'STYLE-REVIEW-PAGE'

const record = {
  technicalVersionId,
  technicalVersionCode: 'TDV-REVIEW-PAGE-001',
  versionLabel: 'V1',
  versionNo: 1,
  styleId,
  styleCode,
  styleName: '审核页面验证款',
  sourceProjectId: 'PRJ-REVIEW-PAGE',
  sourceProjectCode: 'PRJ-REVIEW-PAGE',
  sourceProjectName: '审核页面验证项目',
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
  changeSummary: '审核页面验证',
  garmentDifficultyGrade: 'B',
  linkedPartTemplateIds: [],
  linkedPatternLibraryVersionIds: [],
  linkedPatternAssetIds: [],
  linkedPatternAssetCodes: [],
  archiveCollectedFlag: false,
  archiveCollectedAt: '',
  versionStatus: 'DRAFT',
  reviewStage: '已发布',
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
  publishedAt: '',
  publishedBy: '',
  createdAt: '2026-05-25 11:00',
  createdBy: '测试用户',
  updatedAt: '2026-05-25 11:00',
  updatedBy: '测试用户',
  note: '',
  legacySpuCode: '',
  legacyVersionLabel: '',
} satisfies TechnicalDataVersionRecord

const content: TechnicalDataVersionContent = {
  technicalVersionId,
  patternFiles: [
    {
      id: 'pattern-review-page-1',
      recordKind: 'MATERIAL_ASSOCIATION',
      patternName: '后片纸样',
      fileName: 'back.dxf',
      fileUrl: '#',
      uploadedAt: '2026-05-25 11:00',
      uploadedBy: '版师',
    },
  ],
  patternDesc: '',
  processEntries: [
    {
      id: 'process-review-page-1',
      entryType: 'CRAFT',
      stageCode: 'PROD',
      stageName: '生产阶段',
      processCode: 'SEW',
      processName: '车缝',
      craftCode: 'SEW_BASE',
      craftName: '基础车缝',
      assignmentGranularity: 'ORDER',
      defaultDocType: 'TASK',
      taskTypeMode: 'CRAFT',
      isSpecialCraft: false,
    },
  ],
  sizeTable: [{ id: 'size-review-page-1', part: '衣长', S: 60, M: 62, L: 64, XL: 66, tolerance: 1 }],
  bomItems: [
    {
      id: 'bom-review-page-1',
      type: '面料',
      name: '主面料',
      spec: '弹力棉',
      unitConsumption: 1.1,
      lossRate: 0.02,
      supplier: '供应商乙',
    },
  ],
  qualityRules: [
    {
      id: 'quality-review-page-1',
      checkItem: '尺寸',
      standardText: '按尺码表公差',
      samplingRule: '抽检',
      note: '',
    },
  ],
  colorMaterialMappings: [
    {
      id: 'mapping-review-page-1',
      spuCode: styleCode,
      colorCode: 'WH',
      colorName: '白色',
      status: 'CONFIRMED',
      generatedMode: 'MANUAL',
      lines: [],
    },
  ],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {
    materialCostItems: [{ id: 'MC-bom-review-page-1', bomItemId: 'bom-review-page-1', price: 18, currency: '人民币', unit: '人民币/件' }],
  },
}

replaceTechnicalDataVersionStore({
  version: 3,
  records: [record],
  contents: [content],
  pendingItems: [],
})

function fireTechAction(action: string, dataset: Record<string, string> = {}): void {
  handleTechPackEvent({
    closest: (selector: string) =>
      selector === '[data-tech-action]'
        ? ({ dataset: { techAction: action, ...dataset } } as HTMLElement)
        : null,
  } as unknown as HTMLElement)
}

function assertReviewDialogAboveDrawer(html: string, layer: string, message: string): void {
  const layerPattern = new RegExp(
    `class="[^"]*z-\\[80\\][^"]*" data-dialog-backdrop="true" data-tech-review-layer="${layer}"`,
  )
  assert.match(html, layerPattern, message)
  assert.ok(html.includes('技术包审核详情'), '审核子弹窗打开时应保持审核详情侧边栏上下文')
}

const initialHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.equal(getTechnicalDataVersionById(technicalVersionId)?.reviewStage, '未提交审核', '草稿技术包不应继承已发布审核阶段')
assert.ok(initialHtml.includes('提交审核'), '未提交时右上角应提供提交审核入口')
assert.ok(
  initialHtml.indexOf('data-tech-action="submit-review"') < initialHtml.indexOf('关键项检查'),
  '提交审核入口应排在关键项检查前，避免被检查项挤出可视区域',
)
assert.equal(initialHtml.includes('data-tech-pack-review-panel="true"'), false, '主页面不应直接展示技术包审核详情面板')
assert.equal(initialHtml.includes('发布版本'), false, '未提交审核时右上角不应展示发布版本')
assert.ok(initialHtml.includes('核价'), '技术包页签应展示核价模块')

assert.throws(
  () => publishTechnicalDataVersion(technicalVersionId, '测试用户'),
  /跟单审核通过后才能发布正式版本/,
  '跟单未审核通过前不能发布正式版本',
)

fireTechAction('submit-review')
const submitConfirmHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(submitConfirmHtml.includes('确认提交技术包审核'), '点击提交审核后应先二次确认')
assert.ok(submitConfirmHtml.includes('请再次确认技术包已维护齐全且正确'), '提交审核二次确认应提醒维护齐全且正确')
assert.ok(submitConfirmHtml.includes('固定审核人'), '提交审核二次确认应展示固定审核人')
assert.equal(submitConfirmHtml.includes('data-tech-field="review-submit-buyer"'), false, '提交审核不应再选择买手审核人')
assert.equal(submitConfirmHtml.includes('data-tech-field="review-submit-pattern"'), false, '提交审核不应再选择版师审核人')
assert.equal(submitConfirmHtml.includes('data-tech-field="review-submit-merchandiser"'), false, '提交审核不应再选择跟单审核人')

fireTechAction('confirm-submit-review')
const submittedRecord = getTechnicalDataVersionById(technicalVersionId)
assert.equal(submittedRecord?.reviewStage, '第一阶段并行审核', '确认提交后应进入买手、版师并行审核')
assert.equal(submittedRecord?.buyerReview?.assignedReviewerName, 'Budi Santoso', '提交审核应使用款式固定买手审核人')
assert.equal(submittedRecord?.patternMakerReview?.assignedReviewerName, 'Budi Santoso', '提交审核应使用款式固定版师审核人')

const reviewingHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(reviewingHtml.includes('查看审核详情'), '审核过程中右上角应展示查看审核详情')
assert.ok(
  reviewingHtml.indexOf('data-tech-action="open-review-detail-drawer"') < reviewingHtml.indexOf('关键项检查'),
  '查看审核详情入口应排在关键项检查前，避免被检查项挤出可视区域',
)
assert.ok(reviewingHtml.includes('买手：'), '审核过程中右上角应展示买手审核摘要')
assert.ok(reviewingHtml.includes('版师：'), '审核过程中右上角应展示版师审核摘要')
assert.ok(reviewingHtml.includes('跟单：'), '审核过程中右上角应展示跟单审核摘要')
assert.equal(reviewingHtml.includes('当前：'), false, '审核过程中右上角摘要不应再展示当前状态')
assert.equal(reviewingHtml.includes('发布版本'), false, '审核过程中右上角不应展示发布版本')

fireTechAction('open-review-detail-drawer')
const drawerHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(drawerHtml.includes('技术包审核详情'), '查看审核详情应打开侧边栏')
assert.ok(drawerHtml.includes('当前阶段'), '审核详情侧边栏应展示当前阶段')
assert.ok(drawerHtml.includes('买手审核'), '审核详情侧边栏应展示买手审核')
assert.ok(drawerHtml.includes('版师审核'), '审核详情侧边栏应展示版师审核')
assert.ok(drawerHtml.includes('跟单审核'), '审核详情侧边栏应展示跟单审核')
assert.ok(drawerHtml.includes('开始审核'), '审核详情侧边栏应保留审核操作入口')

fireTechAction('open-review-diff', { reviewNode: 'BUYER' })
const diffLayerHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assertReviewDialogAboveDrawer(diffLayerHtml, 'diff-dialog', '审核差异弹窗层级应高于审核详情侧边栏')
fireTechAction('close-review-diff')

fireTechAction('open-review-notifications', { reviewNode: 'BUYER' })
const notificationLayerHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assertReviewDialogAboveDrawer(notificationLayerHtml, 'notification-dialog', '飞书记录弹窗层级应高于审核详情侧边栏')
fireTechAction('close-review-notifications')

fireTechAction('start-review', { reviewNode: 'BUYER' })
const actionLayerHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assertReviewDialogAboveDrawer(actionLayerHtml, 'action-dialog', '开始审核弹窗层级应高于审核详情侧边栏')
fireTechAction('close-review-action')
fireTechAction('close-review-detail-drawer')

startTechPackReview(technicalVersionId, 'BUYER', 'Budi Santoso')
approveTechPackReview(technicalVersionId, 'BUYER', '买手通过', 'Budi Santoso')
startTechPackReview(technicalVersionId, 'PATTERN_MAKER', 'Budi Santoso')
approveTechPackReview(technicalVersionId, 'PATTERN_MAKER', '版师通过', 'Budi Santoso')

const merchandiserHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(merchandiserHtml.includes('跟单：'), '买手和版师都通过后右上角仍应展示跟单审核摘要')
fireTechAction('open-review-detail-drawer')
const merchandiserDrawerHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(merchandiserDrawerHtml.includes('待跟单复核'), '买手和版师都通过后应进入待跟单复核')
assert.ok(merchandiserDrawerHtml.includes('剩余部分、整体复核'), '跟单审核详情应在侧边栏标明审核范围')
assert.ok(merchandiserDrawerHtml.includes('开始审核'), '跟单审核详情应在侧边栏保留操作入口')
fireTechAction('close-review-detail-drawer')

fireTechAction('start-review', { reviewNode: 'MERCHANDISER' })
const startDialogHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(startDialogHtml.includes('处理动作'), '开始审核弹窗应明确这是处理动作')
assert.ok(startDialogHtml.includes('开始审核 · 进入审核中'), '开始审核弹窗应说明只进入审核中')
assert.ok(startDialogHtml.includes('不产生通过或不通过结论'), '开始审核弹窗应说明此时不产生审核结论')
assert.ok(startDialogHtml.includes('确认开始'), '开始审核弹窗确认按钮应明确动作')
fireTechAction('close-review-action')

assert.throws(
  () => publishTechnicalDataVersion(technicalVersionId, '测试用户'),
  /跟单审核通过后才能发布正式版本/,
  '跟单待审核时仍不能发布',
)

startTechPackReview(technicalVersionId, 'MERCHANDISER', 'Budi Santoso')

fireTechAction('reject-review', { reviewNode: 'MERCHANDISER' })
const rejectDialogHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(rejectDialogHtml.includes('审核结论'), '审核不通过弹窗必须展示审核结论')
assert.ok(rejectDialogHtml.includes('不通过'), '审核不通过弹窗必须展示不通过结论')
assert.ok(rejectDialogHtml.includes('确认不通过'), '审核不通过弹窗确认按钮应明确结论')
fireTechAction('close-review-action')

fireTechAction('approve-review', { reviewNode: 'MERCHANDISER' })
const approveDialogHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(approveDialogHtml.includes('审核结论'), '审核处理弹窗必须展示审核结论')
assert.ok(approveDialogHtml.includes('通过'), '审核通过弹窗必须展示通过结论')
assert.ok(approveDialogHtml.includes('确认通过'), '审核通过弹窗确认按钮应明确结论')
fireTechAction('close-review-action')

approveTechPackReview(technicalVersionId, 'MERCHANDISER', '整体复核通过', 'Budi Santoso')

const readyRecord = getTechnicalDataVersionById(technicalVersionId)
assert.equal(readyRecord?.reviewStage, '待发布', '跟单审核通过后应进入待发布')
const readyHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(readyHtml.includes('发布新版本'), '全部审核通过后右上角才展示发布新版本')

const published = publishTechnicalDataVersion(technicalVersionId, '测试用户')
assert.equal(published.versionStatus, 'PUBLISHED', '跟单审核通过后发布应成功')

console.log('check:tech-pack-review-page-and-release passed')
