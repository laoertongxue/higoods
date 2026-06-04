import {
  DOMESTIC_PURCHASE_SAMPLE_TEMPLATE_ID,
  WANLONG_REVISION_SAMPLE_TEMPLATE_ID,
  type PcsProjectWorkItemCode,
} from './pcs-project-domain-contract.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectById,
  getProjectCreateCatalog,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjectNodes,
  resetProjectRepository,
} from './pcs-project-repository.ts'
import {
  approveProjectInitAndSync,
  completeProjectNode,
  saveProjectNodeFormalRecord,
} from './pcs-project-flow-service.ts'
import {
  createProjectChannelProductFromListingNode,
  launchProjectChannelProductListing,
  listProjectChannelProductsByProjectId,
  markProjectChannelProductListingCompleted,
  resetProjectChannelProductRepository,
  submitProjectTestingConclusion,
  submitProjectTestingSummary,
  type ProjectChannelProductRecord,
} from './pcs-channel-product-project-repository.ts'
import {
  clearProjectRelationStore,
  listProjectRelationsByProject,
  upsertProjectRelation,
} from './pcs-project-relation-repository.ts'
import {
  createProjectImageAssetRecords,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from './pcs-project-image-repository.ts'
import {
  getLatestProjectInlineNodeRecord,
  resetProjectInlineNodeRecordRepository,
} from './pcs-project-inline-node-record-repository.ts'
import {
  completeRevisionTask,
  createRevisionTask,
} from './pcs-task-project-relation-writeback.ts'
import {
  resetRevisionTaskRepository,
  listRevisionTasksByProject,
  updateRevisionTask,
} from './pcs-revision-task-repository.ts'
import { resetLiveTestingRepository } from './pcs-live-testing-repository.ts'
import { resetVideoTestingRepository } from './pcs-video-testing-repository.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'

type TemplateKind = 'domestic' | 'wanlong'
export type SixFlowTestConclusion = '通过' | '不通过' | '继续测试'

interface SixFlowCaseFixture {
  colorName: string
  sizeNames: string[]
  categoryIndex: number
  styleCodeIndex: number
  styleIndexes: number[]
  ownerIndex: number
  samplePrice: number
  listingPrice: number
  liveExposure: number
  liveClick: number
  liveCart: number
  liveOrder: number
  videoViews: number
  videoClicks: number
  videoLikes: number
  videoOrders: number
}

export interface SixFlowValidationSeedFlow {
  index: number
  templateKind: TemplateKind
  templateName: string
  conclusion: SixFlowTestConclusion
  projectId: string
  projectCode: string
  projectName: string
  projectStatus: string
  currentPhaseName: string
  channelProductCode: string
  branchText: string
}

export interface SixFlowValidationSeedResult {
  seededAt: string
  flowCount: number
  flows: SixFlowValidationSeedFlow[]
}

interface SeedOptions {
  reset?: boolean
  operatorName?: string
  log?: (message: string) => void
}

const domesticFlow: PcsProjectWorkItemCode[] = [
  'PROJECT_INIT',
  'SAMPLE_ACQUIRE',
  'SAMPLE_INBOUND_CHECK',
  'FEASIBILITY_REVIEW',
  'CHANNEL_PRODUCT_LISTING',
  'LIVE_TEST',
  'VIDEO_TEST',
  'TEST_DATA_SUMMARY',
  'TEST_CONCLUSION',
  'STYLE_ARCHIVE_CREATE',
  'SAMPLE_RETURN_HANDLE',
]

const wanlongFlow: PcsProjectWorkItemCode[] = [
  'PROJECT_INIT',
  'SAMPLE_ACQUIRE',
  'REVISION_TASK',
  'SAMPLE_INBOUND_CHECK',
  'FEASIBILITY_REVIEW',
  'CHANNEL_PRODUCT_LISTING',
  'LIVE_TEST',
  'VIDEO_TEST',
  'TEST_DATA_SUMMARY',
  'TEST_CONCLUSION',
  'STYLE_ARCHIVE_CREATE',
  'SAMPLE_RETURN_HANDLE',
]

const CASE_FIXTURES: SixFlowCaseFixture[] = [
  {
    colorName: 'Apricot',
    sizeNames: ['S', 'M', 'L'],
    categoryIndex: 0,
    styleCodeIndex: 2,
    styleIndexes: [0, 6],
    ownerIndex: 0,
    samplePrice: 76,
    listingPrice: 189000,
    liveExposure: 18420,
    liveClick: 1474,
    liveCart: 186,
    liveOrder: 31,
    videoViews: 9200,
    videoClicks: 690,
    videoLikes: 410,
    videoOrders: 12,
  },
  {
    colorName: 'Black',
    sizeNames: ['M', 'L', 'XL'],
    categoryIndex: 1,
    styleCodeIndex: 7,
    styleIndexes: [2, 6],
    ownerIndex: 1,
    samplePrice: 82,
    listingPrice: 209000,
    liveExposure: 12680,
    liveClick: 735,
    liveCart: 54,
    liveOrder: 4,
    videoViews: 5300,
    videoClicks: 220,
    videoLikes: 148,
    videoOrders: 1,
  },
  {
    colorName: 'Coffee',
    sizeNames: ['S', 'M', 'L', 'XL'],
    categoryIndex: 0,
    styleCodeIndex: 5,
    styleIndexes: [0, 1],
    ownerIndex: 2,
    samplePrice: 69,
    listingPrice: 179000,
    liveExposure: 15800,
    liveClick: 1190,
    liveCart: 132,
    liveOrder: 16,
    videoViews: 7600,
    videoClicks: 520,
    videoLikes: 276,
    videoOrders: 6,
  },
  {
    colorName: 'Blue',
    sizeNames: ['S', 'M', 'L'],
    categoryIndex: 1,
    styleCodeIndex: 10,
    styleIndexes: [1, 3],
    ownerIndex: 3,
    samplePrice: 128,
    listingPrice: 229000,
    liveExposure: 22400,
    liveClick: 2016,
    liveCart: 248,
    liveOrder: 44,
    videoViews: 11200,
    videoClicks: 930,
    videoLikes: 520,
    videoOrders: 19,
  },
  {
    colorName: 'Green',
    sizeNames: ['M', 'L', 'XL'],
    categoryIndex: 1,
    styleCodeIndex: 11,
    styleIndexes: [2, 4],
    ownerIndex: 4,
    samplePrice: 134,
    listingPrice: 239000,
    liveExposure: 9800,
    liveClick: 390,
    liveCart: 29,
    liveOrder: 2,
    videoViews: 4100,
    videoClicks: 160,
    videoLikes: 93,
    videoOrders: 0,
  },
  {
    colorName: 'Dusty Pink',
    sizeNames: ['S', 'M', 'L', 'XL'],
    categoryIndex: 0,
    styleCodeIndex: 8,
    styleIndexes: [0, 5],
    ownerIndex: 5,
    samplePrice: 118,
    listingPrice: 219000,
    liveExposure: 14600,
    liveClick: 1022,
    liveCart: 118,
    liveOrder: 13,
    videoViews: 6900,
    videoClicks: 430,
    videoLikes: 240,
    videoOrders: 5,
  },
]

function getFixture(index: number): SixFlowCaseFixture {
  return CASE_FIXTURES[index - 1] ?? CASE_FIXTURES[0]
}

function optionAt<T>(options: T[], index: number): T {
  return options[index % options.length] ?? options[0]
}

function formatIdr(amount: number): string {
  return `IDR ${amount.toLocaleString('zh-CN')}`
}

function getSubCategoryName(categoryName: string): string {
  if (categoryName === '连衣裙') return '长袖连衣裙'
  if (categoryName === '套装') return '休闲套装'
  if (categoryName === '半裙') return 'A字半裙'
  if (categoryName === '裤子') return '阔腿裤'
  return '衬衫 / Blouse'
}

function buildStyleNo(kind: TemplateKind, index: number): string {
  return `PCS-SIX-${kind === 'wanlong' ? 'WL' : 'CG'}-${String(index).padStart(3, '0')}`
}

function buildSampleCode(kind: TemplateKind, index: number): string {
  return `SAMPLE-SIX-${kind === 'wanlong' ? 'WL' : 'CG'}-${String(index).padStart(3, '0')}`
}

function buildSampleCodes(kind: TemplateKind, index: number, quantity: number): string[] {
  const baseCode = buildSampleCode(kind, index)
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1
  if (safeQuantity === 1) return [baseCode]
  return Array.from({ length: safeQuantity }, (_, sampleIndex) => `${baseCode}-${String(sampleIndex + 1).padStart(2, '0')}`)
}

function buildSamplePurchaseSpecQty(kind: TemplateKind, _index: number, fixture: SixFlowCaseFixture): string[] {
  const sourceLabel = kind === 'wanlong' ? '万隆打样' : '外采样衣'
  return fixture.sizeNames.map((sizeName, sizeIndex) => {
    const qty = kind === 'wanlong' ? 2 : sizeIndex === 0 ? 1 : 2
    return `${sourceLabel} / ${fixture.colorName} / ${sizeName}：采购 ${qty} 件，单价 ${fixture.samplePrice} RMB`
  })
}

function getConclusionProfile(conclusion: SixFlowTestConclusion) {
  if (conclusion === '通过') {
    return {
      productPositioningConclusion: '爆款',
      stockGrade: 'A',
      continueTestFlag: false,
      downShelfFlag: false,
      returnDestination: '样衣库存留样',
      nextTestPlan: '测款通过，进入款式档案和大货评估，不再安排下一轮测款。',
      note: '直播和短视频数据均超过目标线，点击、加购、成交表现稳定，建议进入款式档案和大货准备。',
    }
  }
  if (conclusion === '不通过') {
    return {
      productPositioningConclusion: '滞销款',
      stockGrade: 'F',
      continueTestFlag: false,
      downShelfFlag: true,
      returnDestination: '退回供应商',
      nextTestPlan: '本轮不再继续测试，渠道商品下架作废，样衣按退回供应商处理。',
      note: '曝光后点击和订单均未达到最低线，且评论反馈集中在版型和价格不匹配，判定不通过。',
    }
  }
  return {
    productPositioningConclusion: '数据款',
    stockGrade: 'C',
    continueTestFlag: true,
    downShelfFlag: false,
    returnDestination: '样衣库存留样',
    nextTestPlan: '保留当前渠道商品，下一轮改用晚场直播 + 达人短视频，重点验证主图、价格和尺码反馈。',
    note: '本轮点击率尚可但成交不足，评论对颜色和尺码仍有分歧，需要继续测试补齐数据。',
  }
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function fail(message: string): never {
  throw new Error(message)
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message)
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    fail(`${message}，实际为 ${String(actual)}，期望为 ${String(expected)}`)
  }
}

function expectFlow(actual: PcsProjectWorkItemCode[], expected: PcsProjectWorkItemCode[], message: string): void {
  const sameLength = actual.length === expected.length
  const sameItems = sameLength && actual.every((item, index) => item === expected[index])
  if (!sameItems) {
    fail(`${message}，实际为 ${actual.join(' > ')}，期望为 ${expected.join(' > ')}`)
  }
}

function assertOk(result: { ok: boolean; message: string }, label: string): void {
  expectEqual(result.ok, true, `${label}失败：${result.message}`)
}

export function resetPcsProductTestingSixFlowRuntimeStores(): void {
  resetProjectRepository()
  resetProjectInlineNodeRecordRepository()
  resetProjectImageAssets()
  resetProjectChannelProductRepository()
  clearProjectRelationStore()
  resetRevisionTaskRepository()
  resetLiveTestingRepository()
  resetVideoTestingRepository()
}

function buildDraft(kind: TemplateKind, index: number, conclusion: SixFlowTestConclusion) {
  const catalog = getProjectCreateCatalog()
  const fixture = getFixture(index)
  const category = optionAt(catalog.categories, fixture.categoryIndex)
  const brand = optionAt(catalog.brands, index - 1)
  const owner = optionAt(catalog.owners, fixture.ownerIndex)
  const team = optionAt(catalog.teams, kind === 'wanlong' ? 3 : 1)
  const styleCode = optionAt(catalog.styleCodes, fixture.styleCodeIndex)
  const crowdPositioning = optionAt(catalog.crowdPositioning, kind === 'wanlong' ? 1 : 0)
  const age = optionAt(catalog.ages, index % catalog.ages.length)
  const crowd = optionAt(catalog.crowds, index % catalog.crowds.length)
  const positioning = optionAt(catalog.productPositioning, kind === 'wanlong' ? 2 : 0)
  const styleTags = fixture.styleIndexes.map((styleIndex) => catalog.styleTags[styleIndex]).filter(Boolean)
  const collaborators = [
    optionAt(catalog.collaborators, 6 + (index % 2)),
    optionAt(catalog.collaborators, 8 + (index % 2)),
  ]
  const templateId =
    kind === 'wanlong'
      ? WANLONG_REVISION_SAMPLE_TEMPLATE_ID
      : DOMESTIC_PURCHASE_SAMPLE_TEMPLATE_ID
  const conclusionProfile = getConclusionProfile(conclusion)
  const styleNo = buildStyleNo(kind, index)
  const subCategoryName = getSubCategoryName(category.name)

  return {
    ...createEmptyProjectDraft(),
    projectName:
      kind === 'wanlong'
        ? `六轮验收-${index}-万隆改版${category.name}${fixture.colorName}测款-${conclusion}`
        : `六轮验收-${index}-国内采购${category.name}${fixture.colorName}测款-${conclusion}`,
    projectSourceType: kind === 'wanlong' ? '历史复用' : '渠道反馈',
    templateId,
    categoryId: category.id,
    categoryName: category.name,
    subCategoryId: `${category.id}-manual-${index}`,
    subCategoryName,
    brandId: brand.id,
    brandName: brand.name,
    styleNumber: styleNo,
    styleCodeId: styleCode.id,
    styleCodeName: styleCode.name,
    yearTag: catalog.yearTags[1] ?? catalog.yearTags[0],
    seasonTags: index % 2 === 0 ? ['夏季', '秋季'] : ['春季', '夏季'],
    styleTags,
    styleTagIds: styleTags,
    styleTagNames: styleTags,
    crowdPositioningIds: [crowdPositioning.id],
    crowdPositioningNames: [crowdPositioning.name],
    ageIds: [age.id],
    ageNames: [age.name],
    crowdIds: [crowd.id],
    crowdNames: [crowd.name],
    productPositioningIds: [positioning.id],
    productPositioningNames: [positioning.name],
    targetAudienceTags: [
      crowdPositioning.name,
      age.name,
      crowd.name,
      conclusionProfile.productPositioningConclusion,
      kind === 'wanlong' ? '旧款改版' : '采购样衣',
    ],
    priceRangeLabel: catalog.priceRanges[index % 3 === 0 ? 2 : 1] ?? catalog.priceRanges[1] ?? catalog.priceRanges[0],
    targetChannelCodes: [catalog.channelOptions[0]?.code || 'tiktok'],
    projectAlbumUrls: [
      `https://picsum.photos/seed/pcs-six-${index}-reference-1/640/860`,
      `https://picsum.photos/seed/pcs-six-${index}-reference-2/640/860`,
    ],
    sampleSourceType: kind === 'wanlong' ? '委托打样' : '外采',
    sampleSupplierId: kind === 'wanlong' ? 'SUP-WANLONG' : `SUP-DOMESTIC-${String(index).padStart(2, '0')}`,
    sampleSupplierName: kind === 'wanlong' ? '万隆改版打样组' : '栀子花女装供应商（1688）',
    sampleLink:
      kind === 'wanlong'
        ? `https://pcs.local/revision/base-style/OLD-WL-${String(index).padStart(3, '0')}`
        : `https://detail.1688.com/offer/pcs-six-${String(index).padStart(3, '0')}.html`,
    sampleUnitPrice: String(fixture.samplePrice),
    ownerId: owner.id,
    ownerName: owner.name,
    teamId: team.id,
    teamName: team.name,
    collaboratorIds: collaborators.map((item) => item.id),
    collaboratorNames: collaborators.map((item) => item.name),
    priorityLevel: '中' as const,
    remark:
      kind === 'wanlong'
        ? `基于旧款 ${styleNo} 做万隆改版出样，目标结论分支：${conclusion}。`
        : `国内采购样衣进入直播/短视频测款，目标结论分支：${conclusion}。`,
  }
}

function getNode(projectId: string, code: PcsProjectWorkItemCode) {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, code)
  ensure(node, `缺少项目节点：${code}`)
  return node
}

function completeInlineNode(
  projectId: string,
  code: PcsProjectWorkItemCode,
  values: Record<string, unknown>,
  operatorName: string,
  detailSnapshot: Record<string, unknown> = {},
): void {
  const node = getNode(projectId, code)
  const result = saveProjectNodeFormalRecord({
    projectId,
    projectNodeId: node.projectNodeId,
    payload: {
      values,
      detailSnapshot,
      businessDate: '2026-06-04 10:00',
      sourceDocType: `${node.workItemTypeName}验收记录`,
    },
    completeAfterSave: true,
    operatorName,
  })
  assertOk(result, `${code} 正式记录保存并完成`)
}

function completeWanlongRevisionTask(projectId: string, index: number, operatorName: string, fixture: SixFlowCaseFixture): void {
  const project = getProjectById(projectId)
  ensure(project, '缺少万隆改版商品项目')
  const styleNo = buildStyleNo('wanlong', index)
  const targetStyleNo = `${styleNo}-REV`
  const result = createRevisionTask({
    projectId,
    title: `${project.projectName} 改版任务`,
    sourceType: '测款触发',
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    participantNames: ['曲蓉', '张丽', '万隆样衣间'],
    dueAt: '2026-06-10 18:00',
    priorityLevel: '中',
    revisionScopeCodes: ['STYLE', 'MATERIAL'],
    revisionScopeNames: ['版型调整', '面辅料调整'],
    revisionVersion: 'V1',
    issueSummary: `旧款 ${styleNo} 上身偏宽，${fixture.colorName} 色评论反馈更适合轻薄垂感面料。`,
    evidenceSummary: '业务会议确认：基于旧款保留销售卖点，调整腰线、袖口和面料后重新出样衣测款。',
    evidenceImageUrls: [
      `https://picsum.photos/seed/pcs-wl-${index}-old/640/860`,
      `https://picsum.photos/seed/pcs-wl-${index}-target/640/860`,
    ],
    baseStyleCode: `OLD-WL-${String(index).padStart(3, '0')}`,
    baseStyleName: `${project.brandName} 旧款参考 ${project.categoryName}`,
    targetStyleCodeCandidate: targetStyleNo,
    targetStyleNameCandidate: `${project.brandName} 改版${project.categoryName}${fixture.colorName}`,
    sampleQty: 2,
    stylePreference: '保留旧款主图风格，整体更显瘦，袖口收口更干净。',
    patternMakerId: 'pattern-maker-wanlong-01',
    patternMakerName: '曲蓉',
    revisionSuggestionRichText: '降低腰线 2cm；胸围放量 1.5cm；袖口收窄 1cm；换成 120g 轻薄雪纺，印花保持小碎花方向。',
    paperPrintAt: '2026-06-04 14:30',
    deliveryAddress: '万隆样衣间 - Jl. Kopo No.18, Bandung',
    patternArea: '印尼',
    materialAdjustmentLines: [
      {
        lineId: `MAT-SIX-${index}-01`,
        materialImageId: `MAT-IMG-SIX-${index}-01`,
        materialName: '轻薄雪纺面料',
        materialSku: `WL-CHIFFON-${fixture.colorName.toUpperCase().replace(/\s+/g, '-')}`,
        printRequirement: '小碎花数码印，颜色比旧款降低 10% 饱和度',
        quantity: 2.4,
        unitPrice: 18.6,
        amount: 44.64,
        note: '用于改版样衣面料替换',
      },
      {
        lineId: `MAT-SIX-${index}-02`,
        materialImageId: `MAT-IMG-SIX-${index}-02`,
        materialName: '同色包边辅料',
        materialSku: `WL-TRIM-${fixture.colorName.toUpperCase().replace(/\s+/g, '-')}`,
        printRequirement: '无需印花',
        quantity: 1.2,
        unitPrice: 3.2,
        amount: 3.84,
        note: '袖口与领口包边',
      },
    ],
    newPatternSpuCode: targetStyleNo,
    patternChangeNote: '纸样按新胸围、腰线和袖口尺寸重出，样衣完成后进入样衣结果核对。',
    patternPieceImageIds: [`PATTERN-PIECE-SIX-${index}-01`, `PATTERN-PIECE-SIX-${index}-02`],
    patternFileIds: [`PATTERN-DXF-SIX-${index}`],
    mainImageIds: [`REVISION-MAIN-SIX-${index}-01`],
    designDraftImageIds: [`DESIGN-DRAFT-SIX-${index}-01`],
    liveRetestRequired: false,
    liveRetestStatus: '不需要',
    liveRetestSummary: '本次为改版出样前置任务，样衣产出后由商品项目进入正式测款。',
    operatorName,
  })
  assertOk(result, '创建万隆改版任务')
  ensure(result.task, '创建万隆改版任务后应返回任务')
  updateRevisionTask(result.task.revisionTaskId, {
    generatedNewTechPackVersionFlag: true,
    generatedNewTechPackVersionAt: '2026-06-04 16:10',
    linkedTechPackVersionId: `TDV-SIX-WL-${String(index).padStart(3, '0')}`,
    linkedTechPackVersionCode: `TDV-SIX-WL-${String(index).padStart(3, '0')}`,
    linkedTechPackVersionLabel: '改版出样 V1.0',
    linkedTechPackVersionStatus: '已发布',
    linkedTechPackUpdatedAt: '2026-06-04 16:10',
    revisionSuggestionRichText: '降低腰线 2cm；胸围放量 1.5cm；袖口收窄 1cm；换成 120g 轻薄雪纺，印花保持小碎花方向。',
    liveRetestRequired: false,
    liveRetestStatus: '不需要',
  })
  const completeResult = completeRevisionTask(result.task.revisionTaskId, operatorName)
  assertOk(completeResult, '完成万隆改版任务')
  expectEqual(getNode(projectId, 'REVISION_TASK').currentStatus, '已完成', '万隆改版任务节点应完成')
}

function createListingImage(projectId: string, index: number, operatorName: string): string {
  const project = getProjectById(projectId)
  ensure(project, '创建上架图片前应存在商品项目')
  const [image] = createProjectImageAssetRecords(
    project,
    [
      {
        imageUrl: `https://picsum.photos/seed/pcs-six-flow-${index}-listing/640/860`,
        imageName: `${project.projectName} 上架主图`,
        imageType: '上架图',
        sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
        sourceRecordId: projectId,
        sourceType: '商品上架',
        usageScopes: ['商品上架', '项目资料归档'],
        imageStatus: '可用于上架',
        mainFlag: true,
        sortNo: 1,
      },
    ],
    operatorName,
    '2026-06-04 10:10',
  )
  ensure(image, '创建上架图片后应返回图片记录')
  upsertProjectImageAssets([image])
  return image.imageId
}

function createSampleEvidenceImages(projectId: string, index: number, operatorName: string): string[] {
  const project = getProjectById(projectId)
  ensure(project, '创建样衣图片前应存在商品项目')
  const images = createProjectImageAssetRecords(
    project,
    [1, 2, 3].map((sortNo) => ({
      imageUrl: `https://picsum.photos/seed/pcs-six-${index}-sample-${sortNo}/640/860`,
      imageName: `${project.projectName} 样衣核对图 ${sortNo}`,
      imageType: sortNo === 1 ? '样衣正面图' : sortNo === 2 ? '样衣细节图' : '样衣吊牌图',
      sourceNodeCode: 'SAMPLE_INBOUND_CHECK',
      sourceRecordId: projectId,
      sourceType: '样衣结果核对',
      usageScopes: ['样衣核对', '商品上架', '项目资料归档'],
      imageStatus: '可用于上架',
      mainFlag: sortNo === 1,
      sortNo,
    })),
    operatorName,
    '2026-06-04 10:05',
  )
  ensure(images.length === 3, '创建样衣图片后应返回 3 张图片记录')
  upsertProjectImageAssets(images)
  return images.map((image) => image.imageId)
}

function createAndCompleteChannelProduct(
  projectId: string,
  kind: TemplateKind,
  index: number,
  operatorName: string,
  fixture: SixFlowCaseFixture,
): ProjectChannelProductRecord {
  const project = getProjectById(projectId)
  ensure(project, '创建渠道商品前应存在商品项目')
  const imageId = createListingImage(projectId, index, operatorName)
  const createResult = createProjectChannelProductFromListingNode(
    projectId,
    {
      targetChannelCode: project.targetChannelCodes[0],
      listingTitle: `${project.brandName} ${project.categoryName} ${fixture.colorName} 直播测款款`,
      listingDescription: `${project.styleCodeName}。面向 ${project.crowdPositioningNames.join('、')} / ${project.ageNames.join('、')}，本轮用于 TikTok 印尼主店直播与短视频测款。`,
      defaultPriceAmount: fixture.listingPrice,
      currencyCode: 'IDR',
      listingMainImageId: imageId,
      listingImageIds: [imageId],
      listingImages: [{ imageId, sortNo: 1, mainFlag: true }],
      listingRemark: `六轮验收第 ${index} 轮：${project.projectName}，规格按样衣核对结果创建。`,
      specLines: fixture.sizeNames.map((sizeName, sizeIndex) => ({
          productImageId: imageId,
          colorName: fixture.colorName,
          sizeName,
          printName: project.styleTags[0] || '常规',
          sellerSku: `${buildStyleNo(kind, index)}-${fixture.colorName.replace(/\s+/g, '').toUpperCase()}-${sizeName}`,
          priceAmount: fixture.listingPrice,
          currencyCode: 'IDR',
          stockQty: 10 + sizeIndex * 4,
        })),
    },
    operatorName,
  )
  assertOk(createResult, '创建渠道店铺商品')
  ensure(createResult.record, '创建渠道店铺商品后应返回记录')

  const launchResult = launchProjectChannelProductListing(createResult.record.channelProductId, operatorName)
  assertOk(launchResult, '上传款式到渠道')
  const completeResult = markProjectChannelProductListingCompleted(createResult.record.channelProductId, operatorName)
  assertOk(completeResult, '标记商品上架完成')
  expectEqual(getNode(projectId, 'CHANNEL_PRODUCT_LISTING').currentStatus, '已完成', '商品上架节点应完成')
  return completeResult.record ?? createResult.record
}

function buildTestingRelation(input: {
  projectId: string
  projectCode: string
  projectNodeId: string
  workItemTypeCode: 'LIVE_TEST' | 'VIDEO_TEST'
  sourceModule: '直播' | '短视频'
  sourceObjectType: '直播商品明细' | '短视频记录'
  sourceObjectId: string
  sourceObjectCode: string
  sourceLineId: string | null
  sourceLineCode: string | null
  sourceTitle: string
  channelProductCode: string
  index: number
  fixture: SixFlowCaseFixture
  listingPrice: number
  operatorName: string
}): ProjectRelationRecord {
  const isLive = input.workItemTypeCode === 'LIVE_TEST'
  const exposure = isLive ? input.fixture.liveExposure : input.fixture.videoViews
  const click = isLive ? input.fixture.liveClick : input.fixture.videoClicks
  const order = isLive ? input.fixture.liveOrder : input.fixture.videoOrders
  const gmv = order * input.listingPrice
  const clickRate = exposure > 0 ? Number(((click / exposure) * 100).toFixed(2)) : 0
  const liveMeta = {
    title: input.sourceTitle,
    liveAccount: 'jefashion_',
    anchor: input.index % 2 === 0 ? 'Annisa Sunatari' : 'Christine Charlene',
    startAt: '2026-06-04 19:00',
    endAt: '2026-06-04 20:30',
    exposure,
    click,
    clickRate,
    cart: input.fixture.liveCart,
    order,
    gmv,
    note:
      input.fixture.liveOrder >= 20
        ? '直播间评论集中在版型显瘦和颜色好搭，建议保留当前主图和价格。'
        : '直播间有点击但成交不足，尺码和价格反馈需要下一轮继续验证。',
    liveSessionId: input.sourceObjectId,
    liveSessionCode: input.sourceObjectCode,
    liveLineId: input.sourceLineId || '',
    liveLineCode: input.sourceLineCode || '',
    liveResult: `曝光 ${exposure.toLocaleString('zh-CN')}，点击 ${click.toLocaleString('zh-CN')}，加购 ${input.fixture.liveCart.toLocaleString('zh-CN')}，订单 ${order.toLocaleString('zh-CN')}。`,
  }
  const videoMeta = {
    title: input.sourceTitle,
    platform: 'TikTok',
    account: 'higood.id',
    creator: input.index % 2 === 0 ? 'Selviana Rizky Devi Ramadhani' : 'Riesta Nabilah Sopian',
    publishedAt: '2026-06-05 12:30',
    videoUrl: `https://video.example.com/pcs-six-${input.index}`,
    views: exposure,
    clicks: click,
    clickRate,
    likes: input.fixture.videoLikes,
    orders: order,
    gmv,
    note:
      input.fixture.videoOrders >= 10
        ? '短视频封面点击稳定，评论关注面料垂感和上身效果，可作为直播主图补充素材。'
        : '短视频播放有量但转化偏弱，需要换封面或换达人账号继续测试。',
    videoChannel: 'TikTok 短视频',
    videoResult: `播放 ${exposure.toLocaleString('zh-CN')}，点击 ${click.toLocaleString('zh-CN')}，点赞 ${input.fixture.videoLikes.toLocaleString('zh-CN')}，订单 ${order.toLocaleString('zh-CN')}。`,
  }
  return {
    projectRelationId: `REL-SIX-${input.projectId}-${input.workItemTypeCode}`,
    projectId: input.projectId,
    projectCode: input.projectCode,
    projectNodeId: input.projectNodeId,
    workItemTypeCode: input.workItemTypeCode,
    workItemTypeName: input.workItemTypeCode === 'LIVE_TEST' ? '直播测款' : '短视频测款',
    relationRole: '执行记录',
    sourceModule: input.sourceModule,
    sourceObjectType: input.sourceObjectType,
    sourceObjectId: input.sourceObjectId,
    sourceObjectCode: input.sourceObjectCode,
    sourceLineId: input.sourceLineId,
    sourceLineCode: input.sourceLineCode,
    sourceTitle: input.sourceTitle,
    sourceStatus: '已完成',
    businessDate: '2026-06-04 10:20',
    ownerName: input.operatorName,
    createdAt: '2026-06-04 10:20',
    createdBy: input.operatorName,
    updatedAt: '2026-06-04 10:20',
    updatedBy: input.operatorName,
    note: JSON.stringify({
      channelCode: 'tiktok',
      channelName: 'TikTok',
      storeId: 'store-tiktok-01',
      storeName: 'TikTok 印尼主店',
      currency: 'IDR',
      channelProductCode: input.channelProductCode,
      exposureQty: exposure,
      clickQty: click,
      orderQty: order,
      gmvAmount: gmv,
      listingPrice: input.listingPrice,
      ...(isLive ? liveMeta : videoMeta),
    }),
    legacyRefType: '',
    legacyRefValue: '',
  }
}

function bindTestingRelationsAndCompleteNodes(
  projectId: string,
  index: number,
  operatorName: string,
  fixture: SixFlowCaseFixture,
): void {
  const project = getProjectById(projectId)
  ensure(project, '绑定测款关系前应存在商品项目')
  const channelProduct = listProjectChannelProductsByProjectId(projectId)[0]
  ensure(channelProduct, '绑定测款关系前应存在渠道店铺商品')

  const liveNode = getNode(projectId, 'LIVE_TEST')
  const videoNode = getNode(projectId, 'VIDEO_TEST')
  upsertProjectRelation(
    buildTestingRelation({
      projectId,
      projectCode: project.projectCode,
      projectNodeId: liveNode.projectNodeId,
      workItemTypeCode: 'LIVE_TEST',
      sourceModule: '直播',
      sourceObjectType: '直播商品明细',
      sourceObjectId: `LIVE-SIX-${index}`,
      sourceObjectCode: `LIVE-SIX-${index}`,
      sourceLineId: `LIVE-LINE-SIX-${index}`,
      sourceLineCode: `LIVE-LINE-SIX-${index}`,
      sourceTitle: `${project.projectName} 直播测款`,
      channelProductCode: channelProduct.channelProductCode,
      index,
      fixture,
      listingPrice: channelProduct.listingPrice || fixture.listingPrice,
      operatorName,
    }),
  )
  upsertProjectRelation(
    buildTestingRelation({
      projectId,
      projectCode: project.projectCode,
      projectNodeId: videoNode.projectNodeId,
      workItemTypeCode: 'VIDEO_TEST',
      sourceModule: '短视频',
      sourceObjectType: '短视频记录',
      sourceObjectId: `VIDEO-SIX-${index}`,
      sourceObjectCode: `VIDEO-SIX-${index}`,
      sourceLineId: null,
      sourceLineCode: null,
      sourceTitle: `${project.projectName} 短视频测款`,
      channelProductCode: channelProduct.channelProductCode,
      index,
      fixture,
      listingPrice: channelProduct.listingPrice || fixture.listingPrice,
      operatorName,
    }),
  )

  completeProjectNode(projectId, liveNode.projectNodeId, {
    operatorName,
    timestamp: '2026-06-04 10:25',
    resultType: '直播测款完成',
    resultText: '已完成直播测款并形成正式关系记录。',
  })
  completeProjectNode(projectId, videoNode.projectNodeId, {
    operatorName,
    timestamp: '2026-06-04 10:26',
    resultType: '短视频测款完成',
    resultText: '已完成短视频测款并形成正式关系记录。',
  })
}

function submitSummaryAndConclusion(
  projectId: string,
  conclusion: SixFlowTestConclusion,
  operatorName: string,
  fixture: SixFlowCaseFixture,
): void {
  const conclusionProfile = getConclusionProfile(conclusion)
  const liveGmv = fixture.liveOrder * fixture.listingPrice
  const videoGmv = fixture.videoOrders * fixture.listingPrice
  const totalExposure = fixture.liveExposure + fixture.videoViews
  const totalClick = fixture.liveClick + fixture.videoClicks
  const totalOrder = fixture.liveOrder + fixture.videoOrders
  const totalGmv = liveGmv + videoGmv
  const summaryResult = submitProjectTestingSummary(
    projectId,
    {
      summaryText: [
        `直播曝光 ${fixture.liveExposure.toLocaleString('zh-CN')}、点击 ${fixture.liveClick.toLocaleString('zh-CN')}、加购 ${fixture.liveCart.toLocaleString('zh-CN')}、订单 ${fixture.liveOrder.toLocaleString('zh-CN')}，GMV ${formatIdr(liveGmv)}。`,
        `短视频播放 ${fixture.videoViews.toLocaleString('zh-CN')}、点击 ${fixture.videoClicks.toLocaleString('zh-CN')}、点赞 ${fixture.videoLikes.toLocaleString('zh-CN')}、订单 ${fixture.videoOrders.toLocaleString('zh-CN')}，GMV ${formatIdr(videoGmv)}。`,
        `合计曝光 ${totalExposure.toLocaleString('zh-CN')}、点击 ${totalClick.toLocaleString('zh-CN')}、订单 ${totalOrder.toLocaleString('zh-CN')}、GMV ${formatIdr(totalGmv)}；准备判定：${conclusion}。`,
      ].join('\n'),
    },
    operatorName,
  )
  assertOk(summaryResult, '提交测款数据汇总')
  expectEqual(summaryResult.relationCount, 2, '测款汇总应承接直播和短视频两条正式测款关系')
  expectEqual(getNode(projectId, 'TEST_DATA_SUMMARY').currentStatus, '已完成', '测款数据汇总节点应完成')
  expectEqual(getNode(projectId, 'TEST_CONCLUSION').currentStatus, '待确认', '测款结论节点应待确认')

  const conclusionResult = submitProjectTestingConclusion(
    projectId,
    {
      conclusion,
      note: `六轮验收结论：${conclusion}。${conclusionProfile.note}`,
      productPositioningConclusion: conclusionProfile.productPositioningConclusion,
      stockGrade: conclusionProfile.stockGrade,
      continueTestFlag: conclusionProfile.continueTestFlag,
      downShelfFlag: conclusionProfile.downShelfFlag,
      returnDestination: conclusionProfile.returnDestination,
      nextTestPlan: conclusionProfile.nextTestPlan,
    },
    operatorName,
  )
  assertOk(conclusionResult, `提交测款结论 ${conclusion}`)
}

function assertConclusionBranch(projectId: string, conclusion: SixFlowTestConclusion): string {
  const conclusionNode = getNode(projectId, 'TEST_CONCLUSION')
  const styleNode = getNode(projectId, 'STYLE_ARCHIVE_CREATE')
  const returnNode = getNode(projectId, 'SAMPLE_RETURN_HANDLE')
  const channelProduct = listProjectChannelProductsByProjectId(projectId)[0]
  ensure(channelProduct, '结论后应保留渠道店铺商品记录')
  const conclusionRecord = getLatestProjectInlineNodeRecord(conclusionNode.projectNodeId)
  ensure(conclusionRecord, '测款结论节点应生成正式结论记录')
  expectEqual(conclusionRecord.payload.conclusion, conclusion, '正式结论记录应写入本轮结论')

  if (conclusion === '通过') {
    expectEqual(conclusionNode.currentStatus, '已完成', '通过时测款结论节点应完成')
    expectEqual(conclusionNode.latestResultType, '通过', '通过时结论节点结果应为通过')
    expectEqual(styleNode.currentStatus, '进行中', '通过时应解锁款式档案创建')
    if (channelProduct.channelProductStatus === '已作废') {
      fail('通过时渠道店铺商品不能作废')
    }
    expectEqual(channelProduct.conclusion, '通过', '通过时渠道店铺商品应回写通过结论')
    expectEqual(conclusionRecord.payload.invalidationPlanned, false, '通过时不应计划作废')
    return '通过后已解锁款式档案创建，渠道商品保持有效。'
  }

  if (conclusion === '不通过') {
    expectEqual(conclusionNode.currentStatus, '已完成', '不通过时测款结论节点应完成')
    expectEqual(conclusionNode.latestResultType, '不通过', '不通过时结论节点结果应为不通过')
    expectEqual(returnNode.currentStatus, '进行中', '不通过时应进入样衣退回处理')
    expectEqual(channelProduct.channelProductStatus, '已作废', '不通过时渠道店铺商品应作废')
    expectEqual(channelProduct.conclusion, '不通过', '不通过时渠道店铺商品应回写不通过结论')
    expectEqual(conclusionRecord.payload.invalidationPlanned, true, '不通过时应计划作废')
    return '不通过后渠道商品已作废，并进入样衣退回处理。'
  }

  expectEqual(conclusionNode.currentStatus, '已完成', '继续测试时测款结论节点应完成并记录本轮结果')
  expectEqual(conclusionNode.latestResultType, '继续测试', '继续测试时结论节点结果应为继续测试')
  expectEqual(getNode(projectId, 'LIVE_TEST').currentStatus, '进行中', '继续测试时应回到测款执行补充数据')
  if (styleNode.currentStatus === '进行中') {
    fail('继续测试时不能解锁款式档案创建')
  }
  if (returnNode.currentStatus === '进行中') {
    fail('继续测试时不能进入样衣退回处理')
  }
  if (channelProduct.channelProductStatus === '已作废') {
    fail('继续测试时渠道店铺商品不能作废')
  }
  expectEqual(channelProduct.conclusion, '继续测试', '继续测试时渠道店铺商品应回写继续测试结论')
  expectEqual(conclusionRecord.payload.invalidationPlanned, false, '继续测试时不应计划作废')
  return '继续测试后已回到直播测款补充数据，未解锁归档也未退样。'
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function getInlinePayload(projectId: string, code: PcsProjectWorkItemCode): Record<string, unknown> {
  const node = getNode(projectId, code)
  const record = getLatestProjectInlineNodeRecord(node.projectNodeId)
  ensure(record, `${code} 应存在正式记录`)
  return record.payload as Record<string, unknown>
}

function expectPayloadFields(payload: Record<string, unknown>, keys: string[], label: string): void {
  for (const key of keys) {
    ensure(hasMeaningfulValue(payload[key]), `${label} 缺少有效字段：${key}`)
  }
}

function parseRelationMeta(relation: ProjectRelationRecord | undefined): Record<string, unknown> {
  if (!relation?.note) return {}
  try {
    const parsed = JSON.parse(relation.note) as Record<string, unknown>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveSampleReturnHandleDraft(projectId: string, index: number, operatorName: string, sampleCode: string): void {
  const returnNode = getNode(projectId, 'SAMPLE_RETURN_HANDLE')
  const result = saveProjectNodeFormalRecord({
    projectId,
    projectNodeId: returnNode.projectNodeId,
    payload: {
      values: {
        handleType: '退样',
        destination: '退回供应商',
        handledQty: 1,
        handledBy: operatorName,
        handledAt: '2026-06-04 17:30',
        returnResult: '已生成退回处理草稿，等待样衣仓确认寄回。',
      },
      detailSnapshot: {
        returnRecipient: '栀子花女装供应商售后',
        returnDepartment: '样衣仓',
        returnAddress: '广州市番禺区南村镇样衣供应商退货仓',
        returnDate: '2026-06-05',
        modificationReason: '测款不通过，按结论退回供应商。',
        sampleCode,
        returnDocId: `RETURN-SIX-${index}`,
        returnDocCode: `YTH-SIX-${String(index).padStart(3, '0')}`,
      },
      businessDate: '2026-06-04 17:30',
      sourceDocType: '样衣退回处理草稿',
    },
    completeAfterSave: false,
    operatorName,
  })
  assertOk(result, '保存样衣退回处理草稿')
}

function assertRichFlowData(
  projectId: string,
  kind: TemplateKind,
  conclusion: SixFlowTestConclusion,
  fixture: SixFlowCaseFixture,
): void {
  const project = getProjectById(projectId)
  ensure(project, '富数据校验前应存在商品项目')
  expectPayloadFields(
    {
      categoryName: project.categoryName,
      subCategoryName: project.subCategoryName,
      brandName: project.brandName,
      styleNumber: project.styleNumber,
      styleCodeName: project.styleCodeName,
      seasonTags: project.seasonTags,
      styleTagNames: project.styleTagNames,
      crowdPositioningNames: project.crowdPositioningNames,
      ageNames: project.ageNames,
      crowdNames: project.crowdNames,
      productPositioningNames: project.productPositioningNames,
      targetAudienceTags: project.targetAudienceTags,
      priceRangeLabel: project.priceRangeLabel,
      targetChannelCodes: project.targetChannelCodes,
    },
    [
      'categoryName',
      'subCategoryName',
      'brandName',
      'styleNumber',
      'styleCodeName',
      'seasonTags',
      'styleTagNames',
      'crowdPositioningNames',
      'ageNames',
      'crowdNames',
      'productPositioningNames',
      'targetAudienceTags',
      'priceRangeLabel',
      'targetChannelCodes',
    ],
    '商品项目立项',
  )

  const acquirePayload = getInlinePayload(projectId, 'SAMPLE_ACQUIRE')
  expectPayloadFields(
    acquirePayload,
    kind === 'wanlong'
      ? ['sampleSourceType', 'sampleSupplierId']
      : [
          'sampleSourceType',
          'purchaseSupplierName',
          'sampleLink',
          'sampleUnitPrice',
          'freightAmount',
          'receiverName',
          'saleType',
          'targetRegionCodes',
          'needTransitFlag',
          'samplePurchaseSpecQty',
        ],
    '样衣获取',
  )

  if (kind === 'wanlong') {
    const revisionTask = listRevisionTasksByProject(projectId)[0]
    ensure(revisionTask, '万隆改版项目应创建改版任务')
    expectPayloadFields(
      revisionTask as unknown as Record<string, unknown>,
      [
        'baseStyleCode',
        'targetStyleCodeCandidate',
        'revisionScopeNames',
        'revisionSuggestionRichText',
        'materialAdjustmentLines',
        'newPatternSpuCode',
        'linkedTechPackVersionCode',
        'generatedNewTechPackVersionAt',
      ],
      '改版任务',
    )
  }

  const inboundPayload = getInlinePayload(projectId, 'SAMPLE_INBOUND_CHECK')
  expectPayloadFields(
    inboundPayload,
    ['sampleInboundLines', 'receivedQty', 'generatedSampleCodes', 'receivedAt', 'sampleImageIds', 'qualityCheckResult', 'checkResult'],
    '样衣结果核对',
  )
  const feasibilityPayload = getInlinePayload(projectId, 'FEASIBILITY_REVIEW')
  expectPayloadFields(
    feasibilityPayload,
    ['reviewConclusion', 'reviewRisk'],
    '初步可行性判断',
  )
  expectEqual(feasibilityPayload.reviewConclusion, '进入测款', '初步可行性判断应明确进入测款后再上架')

  const channelProduct = listProjectChannelProductsByProjectId(projectId)[0]
  ensure(channelProduct, '商品上架后应存在渠道店铺商品')
  expectPayloadFields(
    channelProduct as unknown as Record<string, unknown>,
    ['listingTitle', 'listingPrice', 'channelProductCode', 'specLineCount', 'uploadedSpecLineCount', 'upstreamProductId'],
    '渠道店铺商品',
  )
  ensure(channelProduct.specLineCount >= fixture.sizeNames.length, '渠道店铺商品规格数应覆盖样衣尺码')

  const relations = listProjectRelationsByProject(projectId)
  const liveMeta = parseRelationMeta(relations.find((relation) => relation.sourceObjectType === '直播商品明细'))
  const videoMeta = parseRelationMeta(relations.find((relation) => relation.sourceObjectType === '短视频记录'))
  expectPayloadFields(
    liveMeta,
    ['title', 'liveAccount', 'anchor', 'startAt', 'endAt', 'exposure', 'click', 'clickRate', 'cart', 'order', 'gmv', 'note'],
    '直播测款',
  )
  expectPayloadFields(
    videoMeta,
    ['title', 'platform', 'account', 'creator', 'publishedAt', 'videoUrl', 'views', 'clicks', 'likes', 'orders', 'gmv', 'note'],
    '短视频测款',
  )

  const summaryPayload = getInlinePayload(projectId, 'TEST_DATA_SUMMARY')
  expectPayloadFields(
    summaryPayload,
    [
      'summaryText',
      'totalExposureQty',
      'totalClickQty',
      'totalOrderQty',
      'totalGmvAmount',
      'channelBreakdownLines',
      'storeBreakdownLines',
      'channelProductBreakdownLines',
      'testingSourceBreakdownLines',
      'currencyBreakdownLines',
    ],
    '测款数据汇总',
  )

  const conclusionPayload = getInlinePayload(projectId, 'TEST_CONCLUSION')
  expectPayloadFields(
    conclusionPayload,
    [
      'conclusion',
      'conclusionNote',
      'linkedChannelProductCode',
      'productPositioningConclusion',
      'stockGrade',
      'continueTestFlag',
      'downShelfFlag',
      'returnDestination',
      'nextTestPlan',
      'nextActionType',
    ],
    '测款结论判定',
  )
  expectEqual(conclusionPayload.conclusion, conclusion, '测款结论应与验收分支一致')

  if (conclusion === '不通过') {
    const returnPayload = getInlinePayload(projectId, 'SAMPLE_RETURN_HANDLE')
    expectPayloadFields(returnPayload, ['handleType', 'destination', 'handledQty', 'handledBy', 'handledAt', 'returnResult'], '样衣退回处理')
  }
}

function runOneFlow(
  kind: TemplateKind,
  conclusion: SixFlowTestConclusion,
  index: number,
  operatorName: string,
): SixFlowValidationSeedFlow {
  const fixture = getFixture(index)
  const createResult = createProject(buildDraft(kind, index, conclusion), operatorName)
  const project = createResult.project
  ensure(project, '应成功创建商品项目')
  expectFlow(
    listProjectNodes(project.projectId).map((node) => node.workItemTypeCode),
    kind === 'wanlong' ? wanlongFlow : domesticFlow,
    `${project.projectName} 节点顺序应符合业务模板`,
  )

  const initResult = approveProjectInitAndSync(project.projectId, operatorName)
  assertOk(initResult, '完成商品项目立项')
  expectEqual(getNode(project.projectId, 'PROJECT_INIT').currentStatus, '已完成', '立项节点应完成')

  completeInlineNode(
    project.projectId,
    'SAMPLE_ACQUIRE',
    kind === 'wanlong'
      ? {
          sampleSourceType: '委托打样',
          sampleSupplierId: 'SUP-WANLONG',
        }
      : {
          sampleSourceType: '外采',
          sampleSupplierId: `SUP-DOMESTIC-${String(index).padStart(2, '0')}`,
          purchaseSupplierName: '栀子花女装供应商（1688）',
          sampleLink: `https://detail.1688.com/offer/pcs-six-${String(index).padStart(3, '0')}.html`,
          sampleUnitPrice: fixture.samplePrice,
          freightAmount: 12 + index,
          receiverName: '朝群',
          saleType: '预售',
          targetRegionCodes: ['ID', 'MY'],
          needTransitFlag: false,
          samplePurchaseSpecQty: buildSamplePurchaseSpecQty(kind, index, fixture),
        },
    operatorName,
    {
      acquireMethod: kind === 'wanlong' ? '万隆改版出样' : '国内采购样衣',
      acquirePurpose: '直播与短视频测款',
      applicant: project.ownerName,
      externalPlatform: kind === 'wanlong' ? '万隆改版任务' : '1688',
      externalShop: kind === 'wanlong' ? '万隆样衣间' : '栀子花女装供应商',
      orderTime: '2026-06-04 09:30',
      quantity: kind === 'wanlong' ? 2 : fixture.sizeNames.length,
      colors: [fixture.colorName],
      sizes: fixture.sizeNames,
      specNote: `${fixture.colorName} / ${fixture.sizeNames.join('、')}，用于 ${project.targetChannelCodes.join('、')} 测款。`,
      sampleCode: buildSampleCode(kind, index),
      sampleStatus: '已下单待到样',
      approvalStatus: '已确认',
      approver: '商品负责人',
      handler: operatorName,
    },
  )

  if (kind === 'wanlong') {
    completeWanlongRevisionTask(project.projectId, index, operatorName, fixture)
  }

  const sampleImageIds = createSampleEvidenceImages(project.projectId, index, operatorName)
  const receivedQty = kind === 'wanlong' ? 2 : 1
  const sampleCodes = buildSampleCodes(kind, index, receivedQty)
  const sampleCode = sampleCodes[0]
  const inboundLine = `${fixture.colorName} / ${fixture.sizeNames.join('/')}：实收 ${receivedQty} 件`
  completeInlineNode(
    project.projectId,
    'SAMPLE_INBOUND_CHECK',
    {
      sampleInboundLines: [inboundLine],
      receivedQty,
      generatedSampleCodes: sampleCodes,
      receivedAt: '2026-06-04 10:05',
      sampleImageIds,
      qualityCheckResult: '通过',
      checkResult:
        kind === 'wanlong'
          ? '样衣已收到，腰线、袖口、面料和设计稿要求均已核对，实物到样完整。'
          : '样衣已收到，颜色、尺码、吊牌和面料手感与采购要求一致，实物到样完整。',
    },
    operatorName,
    {
      sampleIds: sampleCodes,
      warehouseLocation: kind === 'wanlong' ? '万隆样衣架 A-03' : '广州样衣仓 C-12',
      receiver: '朝群',
      inboundRequestNo: `IN-SIX-${String(index).padStart(3, '0')}`,
      sampleQuantity: receivedQty,
      colorCode: fixture.colorName,
      sizeCombination: fixture.sizeNames.join('/'),
      expressCompany: kind === 'wanlong' ? '万隆内部送样' : '顺丰速运',
      trackingNumber: kind === 'wanlong' ? `WL-SAMPLE-${index}` : `SF${202606040000 + index}`,
      arrivalPhotos: sampleImageIds,
      inboundVoucher: `VOUCHER-SIX-${String(index).padStart(3, '0')}`,
      sampleAssets: sampleCodes.map((code) => ({
        sampleCode: code,
        specText: `${fixture.colorName} / ${fixture.sizeNames.join('/')}`,
        colorName: fixture.colorName,
        sizeName: fixture.sizeNames.join('/'),
        sourceLine: inboundLine,
      })),
      approvalStatus: '已核对',
      approver: project.ownerName,
      currentHandler: operatorName,
    },
  )

  completeInlineNode(
    project.projectId,
    'FEASIBILITY_REVIEW',
    {
      reviewConclusion: '进入测款',
      reviewRisk:
        kind === 'wanlong'
          ? '改版样衣实物已到位，版型调整和面料表现满足本轮测款要求，进入商品上架与市场测款。'
          : '采购样衣实物已到位，图片表现、面料手感和目标价格带匹配，进入商品上架与市场测款。',
    },
    operatorName,
    {
      evaluationDimension: ['实物完整性', '版型表现', '价格带匹配', '测款潜力'],
      judgmentDescription: '到样核对通过后完成初步可行性判断，本轮进入测款。',
      evaluationParticipants: [project.ownerName, operatorName],
      approvalStatus: '已确认',
      approver: project.ownerName,
    },
  )

  const channelProduct = createAndCompleteChannelProduct(project.projectId, kind, index, operatorName, fixture)
  bindTestingRelationsAndCompleteNodes(project.projectId, index, operatorName, fixture)
  submitSummaryAndConclusion(project.projectId, conclusion, operatorName, fixture)
  const branchText = assertConclusionBranch(project.projectId, conclusion)
  if (conclusion === '不通过') {
    saveSampleReturnHandleDraft(project.projectId, index, operatorName, sampleCode)
  }
  assertRichFlowData(project.projectId, kind, conclusion, fixture)
  const updatedProject = getProjectById(project.projectId)
  ensure(updatedProject, '结论后应能读取商品项目')

  return {
    index,
    templateKind: kind,
    templateName: kind === 'wanlong' ? '万隆改版出样衣测款项目' : '国内采购样衣测款项目',
    conclusion,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectStatus: updatedProject.projectStatus,
    currentPhaseName: updatedProject.currentPhaseName,
    channelProductCode: channelProduct.channelProductCode,
    branchText,
  }
}

export function seedPcsProductTestingSixFlowValidationData(options: SeedOptions = {}): SixFlowValidationSeedResult {
  const shouldReset = options.reset ?? true
  const operatorName = options.operatorName ?? '六轮验收脚本'
  if (shouldReset) {
    resetPcsProductTestingSixFlowRuntimeStores()
  }

  const conclusions: SixFlowTestConclusion[] = ['通过', '不通过', '继续测试']
  const flows: SixFlowValidationSeedFlow[] = []
  let index = 1
  for (const kind of ['domestic', 'wanlong'] as const) {
    for (const conclusion of conclusions) {
      const flow = runOneFlow(kind, conclusion, index, operatorName)
      flows.push(flow)
      options.log?.(`${flow.projectCode} ${flow.projectName} -> ${conclusion} passed`)
      index += 1
    }
  }

  return {
    seededAt: nowText(),
    flowCount: flows.length,
    flows,
  }
}
