import {
  createEmptyProjectDraft,
  createProject,
  getProjectById,
  getProjectCreateCatalog,
  getProjectNodeRecordByWorkItemTypeCode,
  listActiveProjectTemplates,
  listProjects,
  listProjectNodes,
  updateProjectNodeRecord,
  updateProjectRecord,
} from './pcs-project-repository.ts'
import type {
  PcsProjectCreateDraft,
  PcsProjectNodeRecord,
  PcsProjectRecord,
} from './pcs-project-types.ts'
import { type ProjectTemplate, type TemplateStyleType } from './pcs-templates.ts'
import type { PcsProjectWorkItemCode } from './pcs-project-domain-contract.ts'
import {
  getLatestProjectInlineNodeRecord,
  saveProjectInlineNodeFieldEntry,
} from './pcs-project-inline-node-record-repository.ts'
import type { PcsProjectInlineNodeRecordWorkItemTypeCode } from './pcs-project-inline-node-record-types.ts'
import {
  listProjectRelationsByProjectNode,
  upsertProjectRelation,
} from './pcs-project-relation-repository.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import { getProjectTestingSummaryAggregate } from './pcs-channel-product-project-repository.ts'
import {
  syncProjectNodeInstanceRuntime,
  syncProjectNodeInstancesByProject,
} from './pcs-project-node-instance-registry.ts'
import {
  approveProjectInitAndSync,
  isClosedProjectNodeStatus,
  markProjectNodeCompletedAndUnlockNext,
  syncProjectLifecycle,
  terminateProject,
} from './pcs-project-flow-service.ts'
import {
  findLatestProjectInstance,
  getProjectInstanceFieldValue,
  type PcsProjectInstanceItem,
} from './pcs-project-instance-model.ts'

const DEMO_OPERATOR = '系统演示'
const DEMO_SEED_VERSION_STORAGE_KEY = 'higood-pcs-project-demo-seed-version'
const DEMO_SEED_VERSION = '2026-04-17-revision-template-remove-feasibility'
const EXISTING_COVERAGE_PROJECT_THRESHOLD = 40

let projectDemoSeedReady = false

const COVERAGE_PROJECTS_PER_NODE = 3
const INLINE_NODE_WORK_ITEM_CODE_SET = new Set<PcsProjectInlineNodeRecordWorkItemTypeCode>([
  'SAMPLE_ACQUIRE',
  'SAMPLE_INBOUND_CHECK',
  'FEASIBILITY_REVIEW',
  'SAMPLE_SHOOT_FIT',
  'SAMPLE_CONFIRM',
  'SAMPLE_COST_REVIEW',
  'SAMPLE_PRICING',
  'TEST_DATA_SUMMARY',
  'TEST_CONCLUSION',
  'SAMPLE_RETURN_HANDLE',
])

interface CoverageBlueprint {
  projectLabel: string
  categoryName: string
  ownerName: string
  teamName: string
  brandName: string
  styleCodeName: string
  styleTags: string[]
  channels: string[]
  projectSourceType: PcsProjectCreateDraft['projectSourceType']
}

interface CoverageSeedContext {
  currentNodeIndex: number
  styleArchiveIndex: number
  archiveReadyIndex: number
  revisionTaskIndex: number
  replicaIndex: number
}

const COVERAGE_BLUEPRINTS: Record<TemplateStyleType, CoverageBlueprint[]> = {
  基础款: [
    {
      projectLabel: '基础针织T恤',
      categoryName: '上衣',
      ownerName: '张丽',
      teamName: '商品企划组',
      brandName: 'Chicmore',
      styleCodeName: '1-Casul Shirt-18-30休闲衬衫',
      styleTags: ['基础', '休闲'],
      channels: ['tiktok-shop', 'shopee'],
      projectSourceType: '企划提案',
    },
    {
      projectLabel: '基础宽松衬衫',
      categoryName: '上衣',
      ownerName: '周芳',
      teamName: '商品企划组',
      brandName: 'MODISH',
      styleCodeName: '48-Casul Shirt-30-45宽松衬衫',
      styleTags: ['基础', '通勤'],
      channels: ['tiktok-shop', 'wechat-mini-program'],
      projectSourceType: '渠道反馈',
    },
    {
      projectLabel: '基础休闲连衣裙',
      categoryName: '连衣裙',
      ownerName: '李娜',
      teamName: '商品企划组',
      brandName: 'PRIMA',
      styleCodeName: '55-Casual Dress-18-30休闲连衣裙',
      styleTags: ['基础', '优雅'],
      channels: ['shopee', 'tiktok-shop'],
      projectSourceType: '测款沉淀',
    },
  ],
  快时尚款: [
    {
      projectLabel: '快反印花上衣',
      categoryName: '上衣',
      ownerName: '王明',
      teamName: '快反开发组',
      brandName: 'FADFAD',
      styleCodeName: '5-print top-25-45印花上衣',
      styleTags: ['印花', '快反'],
      channels: ['tiktok-shop', 'lazada'],
      projectSourceType: '渠道反馈',
    },
    {
      projectLabel: '快反度假连衣裙',
      categoryName: '连衣裙',
      ownerName: '李娜',
      teamName: '快反开发组',
      brandName: 'Asaya',
      styleCodeName: '22-Casual Dress-30-45休闲连衣裙',
      styleTags: ['度假', '印花'],
      channels: ['shopee', 'tiktok-shop'],
      projectSourceType: '企划提案',
    },
    {
      projectLabel: '快反牛仔半裙',
      categoryName: '半裙',
      ownerName: '赵云',
      teamName: '快反开发组',
      brandName: 'LUXME',
      styleCodeName: '45-Skirt-18-30-半裙',
      styleTags: ['牛仔', '快反'],
      channels: ['tiktok-shop', 'wechat-mini-program'],
      projectSourceType: '测款沉淀',
    },
  ],
  改版款: [
    {
      projectLabel: '改版穆斯林上衣',
      categoryName: '上衣',
      ownerName: '赵云',
      teamName: '工程打样组',
      brandName: 'Asaya',
      styleCodeName: '50-muslim OL shirt-25-45穆斯林通勤上衣',
      styleTags: ['改版', '穆斯林'],
      channels: ['shopee', 'tiktok-shop'],
      projectSourceType: '历史复用',
    },
    {
      projectLabel: '改版通勤连衣裙',
      categoryName: '连衣裙',
      ownerName: '周芳',
      teamName: '工程打样组',
      brandName: 'PRIMA',
      styleCodeName: '25- OL dress-30-45通勤连衣裙',
      styleTags: ['改版', '通勤'],
      channels: ['wechat-mini-program', 'shopee'],
      projectSourceType: '历史复用',
    },
    {
      projectLabel: '改版印花套装',
      categoryName: '套装',
      ownerName: '张丽',
      teamName: '工程打样组',
      brandName: 'Tendblank',
      styleCodeName: '89-Printed Set-35-55印花套装',
      styleTags: ['改版', '印花'],
      channels: ['tiktok-shop', 'shopee'],
      projectSourceType: '渠道反馈',
    },
  ],
  设计款: [
    {
      projectLabel: '设计礼服长裙',
      categoryName: '连衣裙',
      ownerName: '李娜',
      teamName: '设计研发组',
      brandName: 'Tendblank',
      styleCodeName: '38-senior dress-高级连衣裙',
      styleTags: ['设计', '礼服'],
      channels: ['tiktok-shop', 'wechat-mini-program'],
      projectSourceType: '外部灵感',
    },
    {
      projectLabel: '设计印花套装',
      categoryName: '套装',
      ownerName: '王明',
      teamName: '设计研发组',
      brandName: 'Chicmore',
      styleCodeName: '32- fashion set-30-45时尚套装',
      styleTags: ['设计', '印花'],
      channels: ['tiktok-shop', 'lazada'],
      projectSourceType: '企划提案',
    },
    {
      projectLabel: '设计花型衬衫',
      categoryName: '上衣',
      ownerName: '赵云',
      teamName: '设计研发组',
      brandName: 'MODISH',
      styleCodeName: '61-design shirt-25-45设计衬衫',
      styleTags: ['设计', '花型'],
      channels: ['shopee', 'wechat-mini-program'],
      projectSourceType: '外部灵感',
    },
  ],
}

function canUseSeedStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function getDemoSeedVersion(): string {
  if (!canUseSeedStorage()) return ''
  try {
    return localStorage.getItem(DEMO_SEED_VERSION_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function persistDemoSeedVersion(): void {
  if (!canUseSeedStorage()) return
  try {
    localStorage.setItem(DEMO_SEED_VERSION_STORAGE_KEY, DEMO_SEED_VERSION)
  } catch {
    // ignore storage errors in prototype
  }
}

function getProjectTypeLabel(styleType: TemplateStyleType): PcsProjectCreateDraft['projectType'] {
  if (styleType === '快时尚款') return '快反上新'
  if (styleType === '改版款') return '改版开发'
  if (styleType === '设计款') return '设计研发'
  return '商品开发'
}

function getTemplateByStyleType(styleType: TemplateStyleType): ProjectTemplate | null {
  return listActiveProjectTemplates().find((template) => template.styleType.includes(styleType)) ?? null
}

function findCatalogOptionByName(
  options: Array<{ id: string; name: string }>,
  name: string,
): { id: string; name: string } | null {
  return options.find((item) => item.name === name) ?? options[0] ?? null
}

function findCategoryOptionByName(
  name: string,
): { categoryId: string; categoryName: string; subCategoryId: string; subCategoryName: string } | null {
  const catalog = getProjectCreateCatalog()
  const category = catalog.categories.find((item) => item.name === name) ?? catalog.categories[0]
  if (!category) return null
  const child = category.children[0] ?? { id: '', name: '' }
  return {
    categoryId: category.id,
    categoryName: category.name,
    subCategoryId: child.id,
    subCategoryName: child.name,
  }
}

function serializeRelationNoteMeta(meta: Record<string, unknown>): string {
  return JSON.stringify(meta)
}

function buildInstanceFieldMap(instance: PcsProjectInstanceItem | null | undefined): Record<string, string> {
  if (!instance) return {}
  return instance.fields.reduce<Record<string, string>>((result, field) => {
    if (field.fieldKey) result[field.fieldKey] = field.value
    return result
  }, {})
}

function buildFallbackUpstreamChannelProductCode(channelProductCode: string, projectCode: string): string {
  if (channelProductCode) return `${channelProductCode}-UP`
  return `${projectCode}-UP`
}

function getCurrentChannelProductRelation(projectId: string): PcsProjectInstanceItem | null {
  return findLatestProjectInstance(
    projectId,
    (instance) =>
      instance.sourceLayer === '正式业务对象' &&
      (instance.moduleName === '渠道店铺商品' || instance.moduleName === '渠道商品') &&
      (instance.objectType === '渠道店铺商品' || instance.objectType === '渠道商品'),
  )
}

function buildDemoDraft(input: {
  projectName: string
  styleType: TemplateStyleType
  projectSourceType: PcsProjectCreateDraft['projectSourceType']
  categoryName: string
  ownerName: string
  teamName: string
  brandName: string
  styleCodeName: string
  styleTags: string[]
  channels: string[]
  remark: string
}): PcsProjectCreateDraft {
  const catalog = getProjectCreateCatalog()
  const template = getTemplateByStyleType(input.styleType)
  const category = findCategoryOptionByName(input.categoryName)
  const owner = findCatalogOptionByName(catalog.owners, input.ownerName)
  const team = findCatalogOptionByName(catalog.teams, input.teamName)
  const brand = findCatalogOptionByName(catalog.brands, input.brandName)
  const styleCode = findCatalogOptionByName(catalog.styleCodes, input.styleCodeName)
  const supplier = catalog.sampleSuppliers[0] ?? { id: '', name: '' }

  return {
    ...createEmptyProjectDraft(),
    projectName: input.projectName,
    projectType: getProjectTypeLabel(input.styleType),
    projectSourceType: input.projectSourceType,
    templateId: template?.id ?? '',
    categoryId: category?.categoryId ?? '',
    categoryName: category?.categoryName ?? '',
    subCategoryId: category?.subCategoryId ?? '',
    subCategoryName: category?.subCategoryName ?? '',
    brandId: brand?.id ?? '',
    brandName: brand?.name ?? '',
    styleCodeId: styleCode?.id ?? '',
    styleCodeName: styleCode?.name ?? '',
    styleNumber: styleCode?.name ?? input.projectName,
    styleType: input.styleType,
    yearTag: '2026',
    seasonTags: ['夏季'],
    styleTags: [...input.styleTags],
    styleTagNames: [...input.styleTags],
    priceRangeLabel: catalog.priceRanges[1] ?? '',
    targetChannelCodes: [...input.channels],
    sampleSourceType: catalog.sampleSourceTypes[0] ?? '',
    sampleSupplierId: supplier.id,
    sampleSupplierName: supplier.name,
    sampleLink: 'https://example.com/mock-sample',
    sampleUnitPrice: '79',
    ownerId: owner?.id ?? '',
    ownerName: owner?.name ?? '',
    teamId: team?.id ?? '',
    teamName: team?.name ?? '',
    priorityLevel: '中',
    remark: input.remark,
  }
}

function upsertDemoRelation(input: {
  project: PcsProjectRecord
  workItemTypeCode: PcsProjectWorkItemCode
  sourceModule: ProjectRelationRecord['sourceModule']
  sourceObjectType: ProjectRelationRecord['sourceObjectType']
  sourceObjectId: string
  sourceObjectCode: string
  sourceTitle: string
  sourceStatus: string
  businessDate: string
  relationRole?: ProjectRelationRecord['relationRole']
  sourceLineId?: string | null
  sourceLineCode?: string | null
  ownerName?: string
  noteMeta?: Record<string, unknown>
}): void {
  const node = getProjectNodeRecordByWorkItemTypeCode(input.project.projectId, input.workItemTypeCode)
  if (!node) return
  upsertProjectRelation({
    projectRelationId: '',
    projectId: input.project.projectId,
    projectCode: input.project.projectCode,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: node.workItemTypeCode,
    workItemTypeName: node.workItemTypeName,
    relationRole: input.relationRole || '产出对象',
    sourceModule: input.sourceModule,
    sourceObjectType: input.sourceObjectType,
    sourceObjectId: input.sourceObjectId,
    sourceObjectCode: input.sourceObjectCode,
    sourceLineId: input.sourceLineId ?? null,
    sourceLineCode: input.sourceLineCode ?? null,
    sourceTitle: input.sourceTitle,
    sourceStatus: input.sourceStatus,
    businessDate: input.businessDate,
    ownerName: input.ownerName || input.project.ownerName,
    createdAt: input.businessDate,
    createdBy: DEMO_OPERATOR,
    updatedAt: input.businessDate,
    updatedBy: DEMO_OPERATOR,
    note: serializeRelationNoteMeta(input.noteMeta || {}),
    legacyRefType: '',
    legacyRefValue: '',
  })
}

function seedNodeStatus(
  projectId: string,
  workItemTypeCode: string,
  patch: Partial<PcsProjectNodeRecord>,
  operatorName = DEMO_OPERATOR,
): void {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  if (!node) return
  updateProjectNodeRecord(projectId, node.projectNodeId, patch, operatorName)
}

function buildQuickRecordPayload(
  project: PcsProjectRecord,
  node: PcsProjectNodeRecord,
  input: { businessDate: string; note: string },
): {
  values: Record<string, unknown>
  detailSnapshot?: Record<string, unknown>
} | null {
  const note = input.note.trim() || `${node.workItemTypeName}已更新。`
  const currentChannelProduct = getCurrentChannelProductRelation(project.projectId)
  const currentChannelMeta = buildInstanceFieldMap(currentChannelProduct)
  const testingAggregate = getProjectTestingSummaryAggregate(project.projectId)

  switch (node.workItemTypeCode) {
    case 'SAMPLE_ACQUIRE':
      return {
        values: {
          sampleSourceType: project.sampleSourceType || '外采',
          sampleSupplierId: project.sampleSupplierId || 'supplier-demo',
          sampleLink: project.sampleLink || 'https://example.com/mock-sample',
          sampleUnitPrice: project.sampleUnitPrice ?? 79,
        },
        detailSnapshot: {
          acquireMethod: project.sampleSourceType || '外采',
          acquirePurpose: '商品项目打样准备',
          applicant: project.ownerName,
          expectedArrivalDate: input.businessDate,
          handler: project.ownerName,
          specNote: note,
        },
      }
    case 'SAMPLE_INBOUND_CHECK':
      return {
        values: {
          sampleCode: `${project.projectCode}-Y001`,
          arrivalTime: `${input.businessDate} 10:00`,
          checkResult: note,
        },
        detailSnapshot: {
          receiver: project.ownerName,
          warehouseLocation: '样衣仓 A-01',
          sampleQuantity: 1,
          approvalStatus: '已入库',
        },
      }
    case 'FEASIBILITY_REVIEW':
      return {
        values: {
          reviewConclusion: '通过',
          reviewRisk: note,
        },
        detailSnapshot: {
          evaluationDimension: ['版型', '渠道适配', '面料'],
          judgmentDescription: note,
          evaluationParticipants: [project.ownerName, project.teamName],
          approvalStatus: '已评审',
        },
      }
    case 'SAMPLE_SHOOT_FIT':
      return {
        values: {
          shootPlan: '完成试穿拍摄',
          fitFeedback: note,
          sampleFlatImageIds: [],
          sampleTryOnImageIds: [],
          sampleDetailImageIds: [],
          sampleVideoUrls: [],
          shootImageNote: '',
          listingCandidateImageIds: [],
          styleArchiveCandidateImageIds: [],
        },
        detailSnapshot: {
          shootDate: input.businessDate,
          shootLocation: '摄影棚 A',
          modelInvolved: true,
          modelName: '演示模特',
          editingRequired: true,
        },
      }
    case 'SAMPLE_CONFIRM':
      return {
        values: {
          confirmResult: '通过',
          confirmNote: note,
        },
        detailSnapshot: {
          appearanceConfirmation: '通过',
          sizeConfirmation: '通过',
          craftsmanshipConfirmation: '通过',
          materialConfirmation: '通过',
          confirmationNotes: note,
        },
      }
    case 'SAMPLE_COST_REVIEW':
      return {
        values: {
          costTotal: 86,
          costNote: note,
        },
        detailSnapshot: {
          actualSampleCost: 86,
          targetProductionCost: 79,
          costVariance: 7,
          costCompliance: '可接受',
        },
      }
    case 'SAMPLE_PRICING':
      return {
        values: {
          priceRange: project.priceRangeLabel || '两百元主销带',
          pricingNote: note,
        },
        detailSnapshot: {
          baseCost: 86,
          targetProfitMargin: '58%',
          finalPrice: 199,
          pricingStrategy: '主销引流款',
          approvalStatus: '已确认',
        },
      }
    case 'TEST_DATA_SUMMARY':
      return {
        values: {
          summaryText: note,
          totalExposureQty: testingAggregate.totalExposureQty,
          totalClickQty: testingAggregate.totalClickQty,
          totalOrderQty: testingAggregate.totalOrderQty,
          totalGmvAmount: testingAggregate.totalGmvAmount,
          channelBreakdownLines: testingAggregate.channelBreakdownLines,
          storeBreakdownLines: testingAggregate.storeBreakdownLines,
          channelProductBreakdownLines: testingAggregate.channelProductBreakdownLines,
          testingSourceBreakdownLines: testingAggregate.testingSourceBreakdownLines,
          currencyBreakdownLines: testingAggregate.currencyBreakdownLines,
        },
        detailSnapshot: {
          summaryOwner: project.ownerName,
          summaryAt: `${input.businessDate} 18:30`,
          liveRelationIds: testingAggregate.liveRelationIds,
          videoRelationIds: testingAggregate.videoRelationIds,
          liveRelationCodes: testingAggregate.liveRelationCodes,
          videoRelationCodes: testingAggregate.videoRelationCodes,
          channelProductId: currentChannelProduct?.sourceObjectId || '',
          channelProductCode: currentChannelProduct?.instanceCode || `${project.projectCode}-CP`,
          upstreamChannelProductCode: String(
            getProjectInstanceFieldValue(currentChannelProduct, 'upstreamChannelProductCode') ||
              buildFallbackUpstreamChannelProductCode(
                currentChannelProduct?.instanceCode || `${project.projectCode}-CP`,
                project.projectCode,
              ),
          ),
          channelBreakdowns: testingAggregate.channelBreakdowns,
          storeBreakdowns: testingAggregate.storeBreakdowns,
          channelProductBreakdowns: testingAggregate.channelProductBreakdowns,
          testingSourceBreakdowns: testingAggregate.testingSourceBreakdowns,
          currencyBreakdowns: testingAggregate.currencyBreakdowns,
        },
      }
    case 'TEST_CONCLUSION':
      return {
        values: {
          conclusion: '通过',
          conclusionNote: note,
          linkedChannelProductCode: currentChannelProduct?.instanceCode || `${project.projectCode}-CP`,
          invalidationPlanned: false,
          linkedStyleId: project.linkedStyleId || '',
          linkedStyleCode: project.linkedStyleCode || '',
          invalidatedChannelProductId: '',
          nextActionType: '生成款式档案',
        },
        detailSnapshot: {
          channelProductId: currentChannelProduct?.sourceObjectId || '',
          channelProductCode: currentChannelProduct?.instanceCode || `${project.projectCode}-CP`,
          upstreamChannelProductCode: String(
            getProjectInstanceFieldValue(currentChannelProduct, 'upstreamChannelProductCode') ||
              buildFallbackUpstreamChannelProductCode(
                currentChannelProduct?.instanceCode || `${project.projectCode}-CP`,
                project.projectCode,
              ),
          ),
        },
      }
    case 'SAMPLE_RETURN_HANDLE':
      return {
        values: {
          returnResult: '已退回供应商',
        },
        detailSnapshot: {
          returnDate: input.businessDate,
          returnRecipient: project.sampleSupplierName || '演示供应商',
          trackingNumber: `${project.projectCode}-RET`,
          modificationReason: note,
        },
      }
    default:
      return null
  }
}

function seedInlineRecordAndComplete(
  projectId: string,
  workItemTypeCode: PcsProjectInlineNodeRecordWorkItemTypeCode,
  input: {
    businessDate: string
    note: string
  },
): void {
  const project = getProjectById(projectId)
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  if (!project || !node) return

  const payload = buildQuickRecordPayload(project, node, input)
  if (!payload) return

  saveProjectInlineNodeFieldEntry(
    projectId,
    node.projectNodeId,
    {
      businessDate: `${input.businessDate} 10:00`,
      values: payload.values,
      detailSnapshot: payload.detailSnapshot,
    },
    DEMO_OPERATOR,
  )

  markProjectNodeCompletedAndUnlockNext(projectId, node.projectNodeId, {
    operatorName: DEMO_OPERATOR,
    timestamp: `${input.businessDate} 10:30`,
    resultType: '已完成',
    resultText: input.note,
  })
}

function seedInlineRecord(
  projectId: string,
  workItemTypeCode: PcsProjectInlineNodeRecordWorkItemTypeCode,
  input: {
    businessDate: string
    note: string
  },
): void {
  const project = getProjectById(projectId)
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  if (!project || !node) return

  const payload = buildQuickRecordPayload(project, node, input)
  if (!payload) return

  saveProjectInlineNodeFieldEntry(
    projectId,
    node.projectNodeId,
    {
      businessDate: `${input.businessDate} 10:00`,
      values: payload.values,
      detailSnapshot: payload.detailSnapshot,
    },
    DEMO_OPERATOR,
  )
  syncProjectNodeInstanceRuntime(projectId, node.projectNodeId, DEMO_OPERATOR, `${input.businessDate} 10:00`)
}

function isInlineNodeWorkItemTypeCode(value: string): value is PcsProjectInlineNodeRecordWorkItemTypeCode {
  return INLINE_NODE_WORK_ITEM_CODE_SET.has(value as PcsProjectInlineNodeRecordWorkItemTypeCode)
}

function getOrderedTemplateNodes(template: ProjectTemplate): ProjectTemplate['nodes'] {
  return template.nodes
    .filter((node) => node.enabledFlag !== false)
    .slice()
    .sort((left, right) => {
      if (left.phaseCode === right.phaseCode) return left.sequenceNo - right.sequenceNo
      return left.phaseCode.localeCompare(right.phaseCode)
    })
}

function getCoverageBlueprint(styleType: TemplateStyleType, replicaIndex: number): CoverageBlueprint {
  const blueprints = COVERAGE_BLUEPRINTS[styleType] ?? COVERAGE_BLUEPRINTS.基础款
  return blueprints[replicaIndex % blueprints.length] ?? blueprints[0]
}

function buildCoverageProjectName(
  styleType: TemplateStyleType,
  workItemTypeName: string,
  replicaIndex: number,
): string {
  const blueprint = getCoverageBlueprint(styleType, replicaIndex)
  return `${styleType}-${blueprint.projectLabel}-${workItemTypeName}-覆盖${replicaIndex + 1}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function getCoverageBusinessDate(nodeIndex: number, replicaIndex: number, offset = 0): string {
  const day = 2 + ((nodeIndex * 3 + replicaIndex * 5 + offset) % 26)
  return `2026-04-${pad(day)}`
}

function getCoverageTimestamp(nodeIndex: number, replicaIndex: number, hour = 10): string {
  const date = getCoverageBusinessDate(nodeIndex, replicaIndex)
  return `${date} ${pad(hour + ((nodeIndex + replicaIndex) % 6))}:${pad((replicaIndex * 17) % 60)}`
}

function buildClickRate(clicks: number, exposure: number): string {
  if (!exposure) return ''
  return `${((clicks / exposure) * 100).toFixed(1)}%`
}

interface DemoStoreMeta {
  channelCode: string
  channelName: string
  storeId: string
  storeName: string
  currency: string
}

interface CoverageObjectRefs {
  skuId: string
  skuCode: string
  skuName: string
  channelProductId: string
  channelProductCode: string
  upstreamChannelProductCode: string
  styleId: string
  styleCode: string
  styleName: string
  techPackVersionId: string
  techPackVersionCode: string
  techPackVersionLabel: string
  archiveId: string
  archiveNo: string
  revisionTaskId: string
  revisionTaskCode: string
  plateTaskId: string
  plateTaskCode: string
  artworkTaskId: string
  artworkTaskCode: string
  firstSampleTaskId: string
  firstSampleTaskCode: string
  preProductionTaskId: string
  preProductionTaskCode: string
  liveSessionId: string
  liveSessionCode: string
  liveLineId: string
  liveLineCode: string
  videoRecordId: string
  videoRecordCode: string
  sampleAssetId: string
}

function getDemoStoreMeta(project: PcsProjectRecord, replicaIndex: number): DemoStoreMeta {
  const channelCode = project.targetChannelCodes[replicaIndex % Math.max(project.targetChannelCodes.length, 1)] || 'tiktok-shop'
  const metaMap: Record<string, { channelName: string; stores: string[]; currency: string }> = {
    'tiktok-shop': {
      channelName: '抖音商城',
      stores: ['抖音商城旗舰店', '抖音商城测款店', '抖音商城精选店'],
      currency: 'IDR',
    },
    shopee: {
      channelName: '虾皮',
      stores: ['Shopee ID Store-A', 'Shopee ID Store-B', 'Shopee ID Store-C'],
      currency: 'IDR',
    },
    'wechat-mini-program': {
      channelName: '微信小程序',
      stores: ['微信小程序商城', '微信小程序快反店', '微信小程序品牌店'],
      currency: 'CNY',
    },
    lazada: {
      channelName: 'Lazada',
      stores: ['Lazada MY Store-A', 'Lazada MY Store-B', 'Lazada MY Store-C'],
      currency: 'MYR',
    },
  }
  const meta = metaMap[channelCode] ?? metaMap['tiktok-shop']
  return {
    channelCode,
    channelName: meta.channelName,
    storeId: `${channelCode}-store-${pad(replicaIndex + 1)}`,
    storeName: meta.stores[replicaIndex % meta.stores.length] ?? meta.stores[0],
    currency: meta.currency,
  }
}

function getCoverageObjectRefs(project: PcsProjectRecord, context: CoverageSeedContext): CoverageObjectRefs {
  const codeSeed = project.projectCode.replace(/[^0-9A-Za-z]/g, '')
  const suffix = codeSeed.slice(-8) || codeSeed || project.projectId.slice(-8)
  const versionNo = context.currentNodeIndex >= context.archiveReadyIndex && context.archiveReadyIndex >= 0 ? 2 : 1
  return {
    skuId: `${project.projectId}-sku-${context.replicaIndex + 1}`,
    skuCode: `SKU-${suffix}-${context.replicaIndex + 1}`,
    skuName: `${project.projectName} ${['主推款', '延展款', '补充款'][context.replicaIndex % 3]}`,
    channelProductId: `${project.projectId}-channel-product-${context.replicaIndex + 1}`,
    channelProductCode: `CP-${suffix}-${context.replicaIndex + 1}`,
    upstreamChannelProductCode: `UP-${suffix}-${context.replicaIndex + 1}`,
    styleId: `${project.projectId}-style-${context.replicaIndex + 1}`,
    styleCode: `SPU-${suffix}-${context.replicaIndex + 1}`,
    styleName: `${project.projectName} 款式档案`,
    techPackVersionId: `${project.projectId}-tech-pack-v${versionNo}`,
    techPackVersionCode: `TP-${suffix}-V${versionNo}`,
    techPackVersionLabel: `V${versionNo}`,
    archiveId: `${project.projectId}-archive-${context.replicaIndex + 1}`,
    archiveNo: `ARC-${suffix}-${context.replicaIndex + 1}`,
    revisionTaskId: `${project.projectId}-revision-${context.replicaIndex + 1}`,
    revisionTaskCode: `REV-${suffix}-${context.replicaIndex + 1}`,
    plateTaskId: `${project.projectId}-plate-${context.replicaIndex + 1}`,
    plateTaskCode: `PLATE-${suffix}-${context.replicaIndex + 1}`,
    artworkTaskId: `${project.projectId}-artwork-${context.replicaIndex + 1}`,
    artworkTaskCode: `ART-${suffix}-${context.replicaIndex + 1}`,
    firstSampleTaskId: `${project.projectId}-first-sample-${context.replicaIndex + 1}`,
    firstSampleTaskCode: `FS-${suffix}-${context.replicaIndex + 1}`,
    preProductionTaskId: `${project.projectId}-pre-production-${context.replicaIndex + 1}`,
    preProductionTaskCode: `PPS-${suffix}-${context.replicaIndex + 1}`,
    liveSessionId: `${project.projectId}-live-${context.replicaIndex + 1}`,
    liveSessionCode: `LS-${suffix}-${context.replicaIndex + 1}`,
    liveLineId: `${project.projectId}-live-line-${context.replicaIndex + 1}`,
    liveLineCode: `LS-LINE-${suffix}-${context.replicaIndex + 1}`,
    videoRecordId: `${project.projectId}-video-${context.replicaIndex + 1}`,
    videoRecordCode: `SV-${suffix}-${context.replicaIndex + 1}`,
    sampleAssetId: `${project.projectId}-sample-asset-${context.replicaIndex + 1}`,
  }
}

function buildLiveMetrics(nodeIndex: number, replicaIndex: number): {
  exposure: number
  click: number
  cart: number
  order: number
  gmv: number
} {
  const exposure = 18000 + nodeIndex * 3200 + replicaIndex * 1800
  const click = Math.round(exposure * (0.075 + replicaIndex * 0.006))
  const cart = Math.max(120, Math.round(click * 0.18))
  const order = Math.max(36, Math.round(cart * 0.32))
  const gmv = order * (169 + replicaIndex * 20 + nodeIndex * 6)
  return { exposure, click, cart, order, gmv }
}

function buildVideoMetrics(nodeIndex: number, replicaIndex: number): {
  views: number
  clicks: number
  likes: number
  orders: number
  gmv: number
} {
  const views = 22000 + nodeIndex * 3600 + replicaIndex * 2100
  const clicks = Math.round(views * (0.082 + replicaIndex * 0.005))
  const likes = Math.max(clicks, Math.round(views * (0.09 + replicaIndex * 0.01)))
  const orders = Math.max(28, Math.round(clicks * 0.024))
  const gmv = orders * (159 + replicaIndex * 18 + nodeIndex * 5)
  return { views, clicks, likes, orders, gmv }
}

function updateNodeRuntimeMeta(
  projectId: string,
  nodeId: string,
  patch: {
    currentStatus: PcsProjectNodeRecord['currentStatus']
    updatedAt: string
    latestResultType: string
    latestResultText: string
    pendingActionType: string
    pendingActionText: string
    lastEventType: string
    lastEventTime: string
  },
): void {
  updateProjectNodeRecord(
    projectId,
    nodeId,
    {
      currentStatus: patch.currentStatus,
      updatedAt: patch.updatedAt,
      latestResultType: patch.latestResultType,
      latestResultText: patch.latestResultText,
      pendingActionType: patch.pendingActionType,
      pendingActionText: patch.pendingActionText,
      currentIssueType: '',
      currentIssueText: '',
      lastEventType: patch.lastEventType,
      lastEventTime: patch.lastEventTime,
    },
    DEMO_OPERATOR,
  )
}

function ensureFormalNodeRelation(
  project: PcsProjectRecord,
  node: PcsProjectNodeRecord,
  nodeIndex: number,
  context: CoverageSeedContext,
): void {
  const refs = getCoverageObjectRefs(project, context)
  const storeMeta = getDemoStoreMeta(project, context.replicaIndex)
  const businessDate = getCoverageTimestamp(nodeIndex, context.replicaIndex, 10 + (nodeIndex % 4))
  const revisionPath = context.revisionTaskIndex >= 0 && context.currentNodeIndex >= context.revisionTaskIndex
  const styleReady = context.styleArchiveIndex >= 0 && context.currentNodeIndex >= context.styleArchiveIndex
  const archiveReady = context.archiveReadyIndex >= 0 && context.currentNodeIndex >= context.archiveReadyIndex
  const techPackStatus = archiveReady ? '已发布' : styleReady ? '待完善' : '草稿'
  const channelProductStatus = revisionPath ? '已作废' : styleReady ? '已生效' : '已上架待测款'
  const upstreamSyncStatus = revisionPath ? '无需更新' : archiveReady ? '已更新' : styleReady ? '待更新' : '无需更新'
  const latestStatus = nodeIndex < context.currentNodeIndex ? '已完成' : '进行中'

  switch (node.workItemTypeCode) {
    case 'CHANNEL_PRODUCT_LISTING': {
      upsertDemoRelation({
        project,
        workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
        sourceModule: '渠道店铺商品',
        sourceObjectType: '渠道店铺商品',
        sourceObjectId: refs.channelProductId,
        sourceObjectCode: refs.channelProductCode,
        sourceTitle: `${project.projectName} ${storeMeta.channelName}${storeMeta.storeName}渠道店铺商品`,
        sourceStatus: channelProductStatus,
        businessDate,
        noteMeta: {
          targetChannelCodes: project.targetChannelCodes,
          activeListingCount: 1,
          skuId: refs.skuId,
          skuCode: refs.skuCode,
          skuName: refs.skuName,
          channelCode: storeMeta.channelCode,
          channelName: storeMeta.channelName,
          storeId: storeMeta.storeId,
          storeName: storeMeta.storeName,
          targetChannelCode: storeMeta.channelName,
          targetStoreId: storeMeta.storeName,
          listingTitle: `${project.projectName} ${['主推款', '引流款', '补充款'][context.replicaIndex % 3]}`,
          listingPrice: 169 + nodeIndex * 10 + context.replicaIndex * 18,
          currency: storeMeta.currency,
          channelProductId: refs.channelProductId,
          channelProductCode: refs.channelProductCode,
          upstreamChannelProductCode: refs.upstreamChannelProductCode,
          channelProductStatus,
          upstreamSyncStatus,
          linkedStyleId: styleReady ? refs.styleId : '',
          linkedStyleCode: styleReady ? refs.styleCode : '',
          invalidatedReason: revisionPath ? '历史测款结论待重新确认，当前渠道店铺商品已作废。' : '',
        },
      })
      return
    }
    case 'VIDEO_TEST': {
      const metrics = buildVideoMetrics(nodeIndex, context.replicaIndex)
      upsertDemoRelation({
        project,
        workItemTypeCode: 'VIDEO_TEST',
        sourceModule: '短视频',
        sourceObjectType: '短视频记录',
        sourceObjectId: refs.videoRecordId,
        sourceObjectCode: refs.videoRecordCode,
        sourceTitle: `${project.projectName} 短视频测款`,
        sourceStatus: latestStatus,
        businessDate,
        relationRole: '执行记录',
        noteMeta: {
          projectRef: project.projectCode,
          title: `${project.projectName} 短视频测款`,
          platform: storeMeta.channelName,
          account: storeMeta.storeName,
          creator: project.ownerName,
          publishedAt: businessDate,
          videoUrl: `https://example.com/video/${encodeURIComponent(refs.videoRecordCode)}`,
          views: metrics.views,
          clicks: metrics.clicks,
          clickRate: buildClickRate(metrics.clicks, metrics.views),
          likes: metrics.likes,
          orders: metrics.orders,
          gmv: metrics.gmv,
          note: '短视频测款数据已完成录入，可直接参与项目汇总。',
          channelName: storeMeta.channelName,
          channelCode: storeMeta.channelCode,
          storeId: storeMeta.storeId,
          storeName: storeMeta.storeName,
          currency: storeMeta.currency,
          channelProductId: refs.channelProductId,
          channelProductCode: refs.channelProductCode,
          upstreamChannelProductCode: refs.upstreamChannelProductCode,
          exposureQty: metrics.views,
          clickQty: metrics.clicks,
          orderQty: metrics.orders,
          gmvAmount: metrics.gmv,
          videoRecordId: refs.videoRecordId,
          videoRecordCode: refs.videoRecordCode,
        },
      })
      return
    }
    case 'LIVE_TEST': {
      const metrics = buildLiveMetrics(nodeIndex, context.replicaIndex)
      upsertDemoRelation({
        project,
        workItemTypeCode: 'LIVE_TEST',
        sourceModule: '直播',
        sourceObjectType: '直播商品明细',
        sourceObjectId: refs.liveSessionId,
        sourceObjectCode: refs.liveSessionCode,
        sourceLineId: refs.liveLineId,
        sourceLineCode: refs.liveLineCode,
        sourceTitle: `${project.projectName} 直播测款`,
        sourceStatus: latestStatus,
        businessDate,
        relationRole: '执行记录',
        noteMeta: {
          projectRef: project.projectCode,
          title: `${project.projectName} 直播测款`,
          liveAccount: storeMeta.storeName,
          anchor: project.ownerName,
          startAt: businessDate,
          endAt: businessDate.replace(/(\d{2}):(\d{2})$/, '23:$2'),
          exposure: metrics.exposure,
          click: metrics.click,
          clickRate: buildClickRate(metrics.click, metrics.exposure),
          cart: metrics.cart,
          order: metrics.order,
          gmv: metrics.gmv,
          note: '直播测款数据已完成录入，可直接参与项目汇总。',
          channelName: storeMeta.channelName,
          channelCode: storeMeta.channelCode,
          storeId: storeMeta.storeId,
          storeName: storeMeta.storeName,
          currency: storeMeta.currency,
          channelProductId: refs.channelProductId,
          channelProductCode: refs.channelProductCode,
          upstreamChannelProductCode: refs.upstreamChannelProductCode,
          exposureQty: metrics.exposure,
          clickQty: metrics.click,
          orderQty: metrics.order,
          gmvAmount: metrics.gmv,
          liveSessionId: refs.liveSessionId,
          liveSessionCode: refs.liveSessionCode,
          liveLineId: refs.liveLineId,
          liveLineCode: refs.liveLineCode,
        },
      })
      return
    }
    case 'STYLE_ARCHIVE_CREATE': {
      upsertDemoRelation({
        project,
        workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
        sourceModule: '款式档案',
        sourceObjectType: '款式档案',
        sourceObjectId: refs.styleId,
        sourceObjectCode: refs.styleCode,
        sourceTitle: refs.styleName,
        sourceStatus: styleReady ? '技术包待完善' : '建档中',
        businessDate,
        noteMeta: {
          styleId: refs.styleId,
          styleCode: refs.styleCode,
          styleName: refs.styleName,
          archiveStatus: styleReady ? '技术包待完善' : '建档中',
          linkedChannelProductCode: refs.channelProductCode,
          upstreamChannelProductCode: refs.upstreamChannelProductCode,
        },
      })
      if (archiveReady) {
        upsertDemoRelation({
          project,
          workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
          sourceModule: '项目资料归档',
          sourceObjectType: '项目资料归档',
          sourceObjectId: refs.archiveId,
          sourceObjectCode: refs.archiveNo,
          sourceTitle: `${project.projectName} 项目资料归档`,
          sourceStatus: '已归档',
          businessDate,
          noteMeta: {
            linkedStyleId: refs.styleId,
            linkedStyleCode: refs.styleCode,
            linkedStyleName: refs.styleName,
            linkedTechPackVersionCode: refs.techPackVersionCode,
            linkedTechPackVersionLabel: refs.techPackVersionLabel,
            linkedTechPackVersionStatus: techPackStatus,
            linkedTechPackVersionSourceTask: revisionPath ? refs.revisionTaskCode : refs.plateTaskCode,
            linkedTechPackVersionTaskChain: revisionPath
              ? `改版任务：${refs.revisionTaskCode}\n制版任务：${refs.plateTaskCode}\n花型任务：${refs.artworkTaskCode}`
              : `制版任务：${refs.plateTaskCode}\n花型任务：${refs.artworkTaskCode}\n首版样衣：${refs.firstSampleTaskCode}`,
            linkedTechPackVersionDiffSummary: '当前版本已补齐关键工艺、尺寸说明和花型版本差异。',
            projectArchiveNo: refs.archiveNo,
            projectArchiveStatus: '已归档',
            projectArchiveDocumentCount: 6 + context.replicaIndex,
            projectArchiveFileCount: 12 + context.replicaIndex * 2,
            projectArchiveMissingItemCount: 0,
            projectArchiveCompletedFlag: '是',
            projectArchiveFinalizedAt: businessDate,
          },
        })
      }
      return
    }
    case 'REVISION_TASK': {
      upsertDemoRelation({
        project,
        workItemTypeCode: 'REVISION_TASK',
        sourceModule: '改版任务',
        sourceObjectType: '改版任务',
        sourceObjectId: refs.revisionTaskId,
        sourceObjectCode: refs.revisionTaskCode,
        sourceTitle: `${project.projectName} 改版任务`,
        sourceStatus: latestStatus,
        businessDate,
        noteMeta: {
          revisionTaskId: refs.revisionTaskId,
          revisionTaskCode: refs.revisionTaskCode,
          revisionScopeNames: ['版型调整', '工艺优化'],
          revisionVersion: 'R1',
          priorityLevel: project.priorityLevel,
          ownerName: project.ownerName,
          dueAt: businessDate.replace(/(\d{2}):(\d{2})$/, '18:$2'),
          note: '历史改版任务示例，保留为正式任务关系演示。',
          sourceType: '测款结论驱动',
          upstreamModule: '商品项目',
          upstreamObjectType: '商品项目',
          upstreamObjectId: project.projectId,
          upstreamObjectCode: project.projectCode,
          taskStatus: latestStatus,
          linkedTechPackVersionId: refs.techPackVersionId,
          linkedTechPackVersionCode: refs.techPackVersionCode,
          linkedTechPackVersionLabel: refs.techPackVersionLabel,
          linkedTechPackVersionStatus: techPackStatus,
          acceptedAt: businessDate,
          confirmedAt: nodeIndex < context.currentNodeIndex ? businessDate : '',
        },
      })
      return
    }
    case 'PATTERN_TASK': {
      upsertDemoRelation({
        project,
        workItemTypeCode: 'PATTERN_TASK',
        sourceModule: '制版任务',
        sourceObjectType: '制版任务',
        sourceObjectId: refs.plateTaskId,
        sourceObjectCode: refs.plateTaskCode,
        sourceTitle: `${project.projectName} 制版任务`,
        sourceStatus: latestStatus,
        businessDate,
        noteMeta: {
          patternBrief: '完成结构纸样、关键尺寸和版型风险点说明。',
          productStyleCode: refs.styleCode,
          sizeRange: 'S-3XL',
          patternVersion: 'P1',
          sourceType: '开发推进',
          upstreamModule: '款式档案',
          upstreamObjectType: '款式档案',
          upstreamObjectId: refs.styleId,
          upstreamObjectCode: refs.styleCode,
          linkedTechPackVersionId: refs.techPackVersionId,
          linkedTechPackVersionCode: refs.techPackVersionCode,
          linkedTechPackVersionLabel: refs.techPackVersionLabel,
          linkedTechPackVersionStatus: techPackStatus,
          taskStatus: latestStatus,
          acceptedAt: businessDate,
          confirmedAt: nodeIndex < context.currentNodeIndex ? businessDate : '',
        },
      })
      return
    }
    case 'PATTERN_ARTWORK_TASK': {
      upsertDemoRelation({
        project,
        workItemTypeCode: 'PATTERN_ARTWORK_TASK',
        sourceModule: '花型任务',
        sourceObjectType: '花型任务',
        sourceObjectId: refs.artworkTaskId,
        sourceObjectCode: refs.artworkTaskCode,
        sourceTitle: `${project.projectName} 花型任务`,
        sourceStatus: latestStatus,
        businessDate,
        noteMeta: {
          artworkType: '印花',
          patternMode: '定位花',
          artworkName: `${project.projectName} 主花型`,
          artworkVersion: 'A1',
          sourceType: '开发推进',
          upstreamModule: '款式档案',
          upstreamObjectType: '款式档案',
          upstreamObjectId: refs.styleId,
          upstreamObjectCode: refs.styleCode,
          linkedTechPackVersionId: refs.techPackVersionId,
          linkedTechPackVersionCode: refs.techPackVersionCode,
          linkedTechPackVersionLabel: refs.techPackVersionLabel,
          linkedTechPackVersionStatus: techPackStatus,
          taskStatus: latestStatus,
          acceptedAt: businessDate,
          confirmedAt: nodeIndex < context.currentNodeIndex ? businessDate : '',
        },
      })
      return
    }
    case 'FIRST_SAMPLE': {
      upsertDemoRelation({
        project,
        workItemTypeCode: 'FIRST_SAMPLE',
        sourceModule: '首版样衣打样',
        sourceObjectType: '首版样衣打样任务',
        sourceObjectId: refs.firstSampleTaskId,
        sourceObjectCode: refs.firstSampleTaskCode,
        sourceTitle: `${project.projectName} 首版样衣打样`,
        sourceStatus: latestStatus,
        businessDate,
        noteMeta: {
          factoryId: 'FAC-GZ-001',
          factoryName: '广州样衣一厂',
          targetSite: '广州',
          expectedArrival: getCoverageBusinessDate(nodeIndex, context.replicaIndex, 2),
          trackingNo: `${refs.firstSampleTaskCode}-SF`,
          sampleCode: `${project.projectCode}-SAMPLE-01`,
          sourceType: '任务打样',
          upstreamModule: '制版任务',
          upstreamObjectType: '制版任务',
          upstreamObjectId: refs.plateTaskId,
          upstreamObjectCode: refs.plateTaskCode,
          taskStatus: latestStatus,
          acceptedAt: businessDate,
          confirmedAt: nodeIndex < context.currentNodeIndex ? businessDate : '',
          sampleAssetId: refs.sampleAssetId,
        },
      })
      return
    }
    case 'PRE_PRODUCTION_SAMPLE': {
      upsertDemoRelation({
        project,
        workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
        sourceModule: '产前版样衣',
        sourceObjectType: '产前版样衣任务',
        sourceObjectId: refs.preProductionTaskId,
        sourceObjectCode: refs.preProductionTaskCode,
        sourceTitle: `${project.projectName} 产前版样衣`,
        sourceStatus: latestStatus,
        businessDate,
        noteMeta: {
          factoryId: 'FAC-SZ-002',
          factoryName: '深圳产前样二厂',
          targetSite: '深圳',
          expectedArrival: getCoverageBusinessDate(nodeIndex, context.replicaIndex, 3),
          patternVersion: 'P2',
          artworkVersion: 'A2',
          trackingNo: `${refs.preProductionTaskCode}-YT`,
          sampleCode: `${project.projectCode}-PPS-01`,
          sourceType: '产前确认',
          upstreamModule: '技术包',
          upstreamObjectType: '技术包版本',
          upstreamObjectId: refs.techPackVersionId,
          upstreamObjectCode: refs.techPackVersionCode,
          taskStatus: latestStatus,
          acceptedAt: businessDate,
          confirmedAt: nodeIndex < context.currentNodeIndex ? businessDate : '',
          sampleAssetId: refs.sampleAssetId,
        },
      })
      return
    }
    default:
      return
  }
}

function hydrateProjectOutputRefs(project: PcsProjectRecord, context: CoverageSeedContext): void {
  const refs = getCoverageObjectRefs(project, context)
  const patch: Partial<PcsProjectRecord> = {}

  if (context.styleArchiveIndex >= 0 && context.currentNodeIndex >= context.styleArchiveIndex) {
    patch.linkedStyleId = refs.styleId
    patch.linkedStyleCode = refs.styleCode
    patch.linkedStyleName = refs.styleName
    patch.linkedStyleGeneratedAt = getCoverageTimestamp(context.styleArchiveIndex, context.replicaIndex, 11)
  }

  if (context.archiveReadyIndex >= 0 && context.currentNodeIndex >= context.archiveReadyIndex) {
    patch.linkedTechPackVersionId = refs.techPackVersionId
    patch.linkedTechPackVersionCode = refs.techPackVersionCode
    patch.linkedTechPackVersionLabel = refs.techPackVersionLabel
    patch.linkedTechPackVersionStatus = '已发布'
    patch.linkedTechPackVersionPublishedAt = getCoverageTimestamp(context.archiveReadyIndex, context.replicaIndex, 15)
    patch.projectArchiveId = refs.archiveId
    patch.projectArchiveNo = refs.archiveNo
    patch.projectArchiveStatus = '已归档'
    patch.projectArchiveDocumentCount = 6 + context.replicaIndex
    patch.projectArchiveFileCount = 12 + context.replicaIndex * 2
    patch.projectArchiveMissingItemCount = 0
    patch.projectArchiveUpdatedAt = getCoverageTimestamp(context.archiveReadyIndex, context.replicaIndex, 16)
    patch.projectArchiveFinalizedAt = getCoverageTimestamp(context.archiveReadyIndex, context.replicaIndex, 17)
  }

  if (Object.keys(patch).length > 0) {
    updateProjectRecord(project.projectId, patch, DEMO_OPERATOR)
  }
}

function resolveProjectCurrentNodeIndex(nodes: PcsProjectNodeRecord[], project: PcsProjectRecord): number {
  if (nodes.length <= 1) return 0
  const activeIndex = nodes.findIndex((node) => node.currentStatus === '进行中' || node.currentStatus === '待确认')
  if (activeIndex > 0) return activeIndex
  const completedIndexes = nodes
    .map((node, index) => ({ index, node }))
    .filter((item) => item.node.currentStatus === '已完成')
    .map((item) => item.index)
  const lastCompletedIndex = completedIndexes[completedIndexes.length - 1] ?? 0
  if (project.projectStatus === '已归档' || project.projectStatus === '已终止') {
    return Math.max(1, lastCompletedIndex)
  }
  return Math.max(1, lastCompletedIndex, 1)
}

function normalizeProjectNodeChain(
  project: PcsProjectRecord,
  nodes: PcsProjectNodeRecord[],
  currentNodeIndex: number,
  replicaIndex: number,
): void {
  const normalizedCurrentIndex = Math.max(1, Math.min(currentNodeIndex, nodes.length - 1))
  nodes.forEach((node, index) => {
    const timestamp = getCoverageTimestamp(index, replicaIndex, 10 + (index % 5))

    if (index === 0) {
      updateNodeRuntimeMeta(project.projectId, node.projectNodeId, {
        currentStatus: '已完成',
        updatedAt: timestamp,
        latestResultType: '立项完成',
        latestResultText: '商品项目立项已完成。',
        pendingActionType: '已完成',
        pendingActionText: '节点已完成',
        lastEventType: '立项完成',
        lastEventTime: timestamp,
      })
      return
    }

    if (project.projectStatus === '已归档') {
      updateNodeRuntimeMeta(project.projectId, node.projectNodeId, {
        currentStatus: '已完成',
        updatedAt: timestamp,
        latestResultType: '节点完成',
        latestResultText: `${node.workItemTypeName}已完成。`,
        pendingActionType: '已完成',
        pendingActionText: '节点已完成',
        lastEventType: '节点完成',
        lastEventTime: timestamp,
      })
      return
    }

    if (project.projectStatus === '已终止') {
      if (index <= normalizedCurrentIndex) {
        updateNodeRuntimeMeta(project.projectId, node.projectNodeId, {
          currentStatus: '已完成',
          updatedAt: timestamp,
          latestResultType: '节点完成',
          latestResultText: `${node.workItemTypeName}已完成。`,
          pendingActionType: '已完成',
          pendingActionText: '节点已完成',
          lastEventType: '节点完成',
          lastEventTime: timestamp,
        })
      } else {
        updateNodeRuntimeMeta(project.projectId, node.projectNodeId, {
          currentStatus: '已取消',
          updatedAt: timestamp,
          latestResultType: '项目终止',
          latestResultText: '项目已终止，当前节点不再继续。',
          pendingActionType: '已取消',
          pendingActionText: '项目已终止',
          lastEventType: '项目终止',
          lastEventTime: timestamp,
        })
      }
      return
    }

    if (index < normalizedCurrentIndex) {
      updateNodeRuntimeMeta(project.projectId, node.projectNodeId, {
        currentStatus: '已完成',
        updatedAt: timestamp,
        latestResultType: '节点完成',
        latestResultText: `${node.workItemTypeName}字段已补齐。`,
        pendingActionType: '已完成',
        pendingActionText: '节点已完成',
        lastEventType: '节点完成',
        lastEventTime: timestamp,
      })
      return
    }

    if (index === normalizedCurrentIndex) {
      updateNodeRuntimeMeta(project.projectId, node.projectNodeId, {
        currentStatus: '进行中',
        updatedAt: timestamp,
        latestResultType: '进行中',
        latestResultText: `当前正在处理${node.workItemTypeName}。`,
        pendingActionType: '待处理',
        pendingActionText: `当前请处理：${node.workItemTypeName}`,
        lastEventType: '进入节点',
        lastEventTime: timestamp,
      })
      return
    }

    updateNodeRuntimeMeta(project.projectId, node.projectNodeId, {
      currentStatus: '未开始',
      updatedAt: timestamp,
      latestResultType: '',
      latestResultText: '',
      pendingActionType: '未开始',
      pendingActionText: `等待前置节点完成后解锁${node.workItemTypeName}`,
      lastEventType: '',
      lastEventTime: '',
    })
  })
}

function ensureProjectNodeDemoPayloads(
  project: PcsProjectRecord,
  _template: ProjectTemplate,
  currentNodeIndex: number,
  replicaIndex: number,
): void {
  const orderedNodes = listProjectNodes(project.projectId)
  if (orderedNodes.length === 0) return

  const styleArchiveIndex = orderedNodes.findIndex((node) => node.workItemTypeCode === 'STYLE_ARCHIVE_CREATE')
  const revisionTaskIndex = orderedNodes.findIndex((node) => node.workItemTypeCode === 'REVISION_TASK')
  const archiveReadyIndex = revisionTaskIndex >= 0 ? revisionTaskIndex : styleArchiveIndex
  const context: CoverageSeedContext = {
    currentNodeIndex: Math.max(1, Math.min(currentNodeIndex, orderedNodes.length - 1)),
    styleArchiveIndex,
    archiveReadyIndex,
    revisionTaskIndex,
    replicaIndex,
  }

  orderedNodes.forEach((node, index) => {
    if (index === 0 || index > context.currentNodeIndex) return

    const businessDate = getCoverageBusinessDate(index, replicaIndex)
    if (isInlineNodeWorkItemTypeCode(node.workItemTypeCode)) {
      seedInlineRecord(project.projectId, node.workItemTypeCode, {
        businessDate,
        note: `${node.workItemTypeName}演示数据已补齐。`,
      })
      return
    }

    ensureFormalNodeRelation(project, node, index, context)
  })

  hydrateProjectOutputRefs(project, context)
  normalizeProjectNodeChain(project, orderedNodes, context.currentNodeIndex, replicaIndex)
  syncProjectNodeInstancesByProject(
    project.projectId,
    DEMO_OPERATOR,
    getCoverageTimestamp(context.currentNodeIndex, replicaIndex, 18),
  )
  syncProjectLifecycle(project.projectId, DEMO_OPERATOR, getCoverageTimestamp(context.currentNodeIndex, replicaIndex, 19))
}

function ensureTemplateCoverageProjects(): void {
  listActiveProjectTemplates().forEach((template) => {
    const styleType = template.styleType[0] ?? '基础款'
    const orderedNodes = getOrderedTemplateNodes(template)
    orderedNodes.forEach((node, nodeIndex) => {
      if (node.workItemTypeCode === 'PROJECT_INIT') return

      Array.from({ length: COVERAGE_PROJECTS_PER_NODE }).forEach((_, replicaIndex) => {
        const projectName = buildCoverageProjectName(styleType, node.workItemTypeName, replicaIndex)
        const existingProject =
          listProjects().find((project) => project.projectName === projectName && project.templateId === template.id) ?? null

        const blueprint = getCoverageBlueprint(styleType, replicaIndex)
        const project =
          existingProject ??
          createProject(
            buildDemoDraft({
              projectName,
              styleType,
              projectSourceType: blueprint.projectSourceType,
              categoryName: blueprint.categoryName,
              ownerName: blueprint.ownerName,
              teamName: blueprint.teamName,
              brandName: blueprint.brandName,
              styleCodeName: blueprint.styleCodeName,
              styleTags: blueprint.styleTags,
              channels: blueprint.channels,
              remark: `${node.workItemTypeName}覆盖演示数据`,
            }),
            DEMO_OPERATOR,
          ).project

        if (!existingProject) {
          approveProjectInitAndSync(project.projectId, DEMO_OPERATOR)
          updateProjectRecord(
            project.projectId,
            {
              createdAt: getCoverageTimestamp(nodeIndex, replicaIndex, 9),
              updatedAt: getCoverageTimestamp(nodeIndex, replicaIndex, 9),
            },
            DEMO_OPERATOR,
          )
        }

        ensureProjectNodeDemoPayloads(project, template, nodeIndex, replicaIndex)
      })
    })
  })
}

function ensureExistingProjectDemoConsistency(): void {
  const templateMap = new Map(listActiveProjectTemplates().map((template) => [template.id, template]))
  listProjects().forEach((project, projectIndex) => {
    const template = templateMap.get(project.templateId)
    if (!template) return
    ensureProjectNodeDemoPayloads(
      project,
      template,
      resolveProjectCurrentNodeIndex(listProjectNodes(project.projectId), project),
      projectIndex % COVERAGE_PROJECTS_PER_NODE,
    )
  })
}

export function ensurePcsProjectDemoDataReady(): void {
  if (projectDemoSeedReady) return
  const existingProjects = listProjects()
  const hasLegacyDemoSeed = existingProjects.some((project) => project.projectName.includes('双渠道归档项目'))
  const hasCoverageScaleData = existingProjects.length >= EXISTING_COVERAGE_PROJECT_THRESHOLD
  const seedVersion = getDemoSeedVersion()

  if (seedVersion === DEMO_SEED_VERSION || hasCoverageScaleData) {
    if (hasCoverageScaleData && seedVersion !== DEMO_SEED_VERSION) {
      persistDemoSeedVersion()
    }
    projectDemoSeedReady = true
    return
  }

  if (!hasLegacyDemoSeed) {
  const pendingProject = createProject(
    buildDemoDraft({
      projectName: '2026夏季宽松基础T恤',
      styleType: '基础款',
      projectSourceType: '企划提案',
      categoryName: '上衣',
      ownerName: '张丽',
      teamName: '商品企划组',
      brandName: 'Chicmore',
      styleCodeName: '1-Casul Shirt-18-30休闲衬衫',
      styleTags: ['休闲', '基础'],
      channels: ['tiktok-shop', 'shopee'],
      remark: '等待负责人补齐并完成立项。',
    }),
    DEMO_OPERATOR,
  ).project
  updateProjectRecord(
    pendingProject.projectId,
    {
      createdAt: '2026-04-13 09:10',
      updatedAt: '2026-04-13 09:10',
    },
    DEMO_OPERATOR,
  )
  seedNodeStatus(pendingProject.projectId, 'PROJECT_INIT', {
    updatedAt: '2026-04-13 09:10',
    latestResultType: '已创建项目',
    latestResultText: '商品项目已创建，请补齐并完成立项信息。',
    lastEventType: '创建项目',
    lastEventTime: '2026-04-13 09:10',
  })
  syncProjectLifecycle(pendingProject.projectId, DEMO_OPERATOR, '2026-04-13 09:10')

  const ongoingProject = createProject(
    buildDemoDraft({
      projectName: '2026夏季印花短袖快反项目',
      styleType: '快时尚款',
      projectSourceType: '渠道反馈',
      categoryName: '上衣',
      ownerName: '王明',
      teamName: '快反开发组',
      brandName: 'FADFAD',
      styleCodeName: '2-prin shirt-18-30印花衬衫',
      styleTags: ['休闲', '度假'],
      channels: ['tiktok-shop', 'lazada'],
      remark: '已进入渠道店铺商品上架准备。',
    }),
    DEMO_OPERATOR,
  ).project
  approveProjectInitAndSync(ongoingProject.projectId, DEMO_OPERATOR)
  seedInlineRecordAndComplete(ongoingProject.projectId, 'SAMPLE_ACQUIRE', {
    businessDate: '2026-04-10',
    note: '已完成样衣外采，首批样衣到仓。',
  })
  seedInlineRecordAndComplete(ongoingProject.projectId, 'SAMPLE_INBOUND_CHECK', {
    businessDate: '2026-04-10',
    note: '样衣完整，无明显瑕疵。',
  })
  seedInlineRecordAndComplete(ongoingProject.projectId, 'FEASIBILITY_REVIEW', {
    businessDate: '2026-04-11',
    note: '渠道适配度良好，建议继续推进。',
  })
  seedInlineRecordAndComplete(ongoingProject.projectId, 'SAMPLE_CONFIRM', {
    businessDate: '2026-04-11',
    note: '样衣确认通过，可进入渠道上架。',
  })
  seedInlineRecordAndComplete(ongoingProject.projectId, 'SAMPLE_COST_REVIEW', {
    businessDate: '2026-04-11',
    note: '核价已确认，成本符合快反策略。',
  })
  seedInlineRecordAndComplete(ongoingProject.projectId, 'SAMPLE_PRICING', {
    businessDate: '2026-04-12',
    note: '建议以 199 元主销价上架。',
  })
  seedNodeStatus(ongoingProject.projectId, 'CHANNEL_PRODUCT_LISTING', {
    currentStatus: '进行中',
    validInstanceCount: 1,
    latestInstanceId: `${ongoingProject.projectId}-listing-001`,
    latestInstanceCode: `${ongoingProject.projectCode}-CP-001`,
    latestResultType: '已创建款式上架批次',
    latestResultText: '已创建抖音商城款式上架批次，待上传到渠道。',
    pendingActionType: '上传款式到渠道',
    pendingActionText: '请补齐规格明细并上传款式到渠道。',
    updatedAt: '2026-04-12 18:40',
    lastEventType: '创建渠道店铺商品',
    lastEventTime: '2026-04-12 18:40',
  })
  upsertDemoRelation({
    project: ongoingProject,
    workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
    sourceModule: '渠道店铺商品',
    sourceObjectType: '渠道店铺商品',
    sourceObjectId: `${ongoingProject.projectId}-channel-product-001`,
    sourceObjectCode: `${ongoingProject.projectCode}-CP-001`,
    sourceTitle: `${ongoingProject.projectName} 抖音商城款式上架批次`,
    sourceStatus: '待上传',
    businessDate: '2026-04-12 18:40',
    noteMeta: {
      channelCode: 'tiktok-shop',
      targetChannelCode: '抖音商城',
      storeId: 'store-tiktok-01',
      targetStoreId: '抖音商城旗舰店',
      listingTitle: `${ongoingProject.projectName} 首轮测款款`,
      listingPrice: 199,
      currency: 'CNY',
      channelProductId: `${ongoingProject.projectId}-channel-product-001`,
      channelProductCode: `${ongoingProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${ongoingProject.projectCode}-CP-001-UP`,
      channelProductStatus: '待上传',
      upstreamSyncStatus: '无需更新',
      linkedStyleCode: '',
      invalidatedReason: '',
    },
  })
  updateProjectRecord(
    ongoingProject.projectId,
    {
      updatedAt: '2026-04-12 18:40',
    },
    DEMO_OPERATOR,
  )
  syncProjectLifecycle(ongoingProject.projectId, DEMO_OPERATOR, '2026-04-12 18:40')

  const decisionProject = createProject(
    buildDemoDraft({
      projectName: '2026秋季礼服设计研发项目',
      styleType: '设计款',
      projectSourceType: '外部灵感',
      categoryName: '连衣裙',
      ownerName: '李娜',
      teamName: '设计研发组',
      brandName: 'Tendblank',
      styleCodeName: '3-Sweet Blouse-18-30设计上衣',
      styleTags: ['礼服', '名媛'],
      channels: ['tiktok-shop', 'wechat-mini-program'],
      remark: '已完成测款数据汇总，待负责人做结论判定。',
    }),
    DEMO_OPERATOR,
  ).project
  approveProjectInitAndSync(decisionProject.projectId, DEMO_OPERATOR)
  seedInlineRecordAndComplete(decisionProject.projectId, 'SAMPLE_ACQUIRE', {
    businessDate: '2026-04-09',
    note: '设计样衣已完成采购并入库。',
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'SAMPLE_INBOUND_CHECK', {
    businessDate: '2026-04-09',
    note: '样衣质检通过，进入设计评估。',
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'FEASIBILITY_REVIEW', {
    businessDate: '2026-04-10',
    note: '评估结论为可推进，建议保留设计亮点。',
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'SAMPLE_CONFIRM', {
    businessDate: '2026-04-10',
    note: '样衣确认通过，进入成本与定价阶段。',
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'SAMPLE_COST_REVIEW', {
    businessDate: '2026-04-11',
    note: '核价完成，成本可控。',
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'SAMPLE_PRICING', {
    businessDate: '2026-04-11',
    note: '建议以 299 元作为首轮测款定价。',
  })
  seedNodeStatus(decisionProject.projectId, 'CHANNEL_PRODUCT_LISTING', {
    currentStatus: '已完成',
    validInstanceCount: 1,
    latestInstanceId: `${decisionProject.projectId}-listing-001`,
    latestInstanceCode: `${decisionProject.projectCode}-CP-001`,
    latestResultType: '上架完成',
    latestResultText: '已完成渠道上架并生成上游编码。',
    pendingActionType: '已完成',
    pendingActionText: '节点已完成',
    updatedAt: '2026-04-11 16:40',
    lastEventType: '上架完成',
    lastEventTime: '2026-04-11 16:40',
  })
  seedNodeStatus(decisionProject.projectId, 'VIDEO_TEST', {
    currentStatus: '已完成',
    validInstanceCount: 2,
    latestResultType: '短视频测款完成',
    latestResultText: '已关联 2 条短视频测款事实。',
    pendingActionType: '已完成',
    pendingActionText: '节点已完成',
    updatedAt: '2026-04-12 11:10',
    lastEventType: '短视频测款完成',
    lastEventTime: '2026-04-12 11:10',
  })
  seedNodeStatus(decisionProject.projectId, 'LIVE_TEST', {
    currentStatus: '已完成',
    validInstanceCount: 1,
    latestResultType: '直播测款完成',
    latestResultText: '已完成 1 场直播测款。',
    pendingActionType: '已完成',
    pendingActionText: '节点已完成',
    updatedAt: '2026-04-12 13:20',
    lastEventType: '直播测款完成',
    lastEventTime: '2026-04-12 13:20',
  })
  seedNodeStatus(decisionProject.projectId, 'TEST_CONCLUSION', {
    currentStatus: '待确认',
    latestResultType: '待结论判定',
    latestResultText: '请确认测款结论：通过或淘汰。',
    pendingActionType: '结论判定',
    pendingActionText: '当前待确认：测款结论判定',
    updatedAt: '2026-04-12 21:30',
    lastEventType: '提交汇总',
    lastEventTime: '2026-04-12 21:30',
  })
  upsertDemoRelation({
    project: decisionProject,
    workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
    sourceModule: '渠道店铺商品',
    sourceObjectType: '渠道店铺商品',
    sourceObjectId: `${decisionProject.projectId}-channel-product-001`,
    sourceObjectCode: `${decisionProject.projectCode}-CP-001`,
    sourceTitle: `${decisionProject.projectName} 测款渠道店铺商品`,
    sourceStatus: '已上架待测款',
    businessDate: '2026-04-11 16:40',
    noteMeta: {
      channelCode: 'tiktok-shop',
      targetChannelCode: '抖音商城',
      storeId: 'store-tiktok-01',
      targetStoreId: '抖音商城旗舰店',
      listingTitle: `${decisionProject.projectName} 礼服首测款`,
      listingPrice: 299,
      currency: 'CNY',
      channelProductId: `${decisionProject.projectId}-channel-product-001`,
      channelProductCode: `${decisionProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${decisionProject.projectCode}-CP-001-UP`,
      channelProductStatus: '已上架待测款',
      upstreamSyncStatus: '无需更新',
      linkedStyleCode: '',
      invalidatedReason: '',
    },
  })
  upsertDemoRelation({
    project: decisionProject,
    workItemTypeCode: 'VIDEO_TEST',
    sourceModule: '短视频',
    sourceObjectType: '短视频记录',
    sourceObjectId: `${decisionProject.projectId}-video-001`,
    sourceObjectCode: `${decisionProject.projectCode}-VIDEO-001`,
    sourceTitle: '礼服上身试穿短视频',
    sourceStatus: '已发布',
    businessDate: '2026-04-12 11:10',
    relationRole: '执行记录',
    noteMeta: {
      videoRecordId: `${decisionProject.projectId}-video-001`,
      videoRecordCode: `${decisionProject.projectCode}-VIDEO-001`,
      channelProductId: `${decisionProject.projectId}-channel-product-001`,
      channelProductCode: `${decisionProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${decisionProject.projectCode}-CP-001-UP`,
      videoChannel: '抖音 / 礼服测款号',
      exposureQty: 42600,
      clickQty: 2680,
      orderQty: 104,
      gmvAmount: 31096,
      videoResult: '礼服试穿内容收藏率高，点击转化表现稳定。',
    },
  })
  upsertDemoRelation({
    project: decisionProject,
    workItemTypeCode: 'LIVE_TEST',
    sourceModule: '直播',
    sourceObjectType: '直播商品明细',
    sourceObjectId: `${decisionProject.projectId}-live-001`,
    sourceObjectCode: `${decisionProject.projectCode}-LIVE-001`,
    sourceLineId: `${decisionProject.projectId}-live-line-001`,
    sourceLineCode: `${decisionProject.projectCode}-LIVE-LINE-001`,
    sourceTitle: '礼服专场直播测款',
    sourceStatus: '已结束',
    businessDate: '2026-04-12 13:20',
    relationRole: '执行记录',
    noteMeta: {
      liveSessionId: `${decisionProject.projectId}-live-001`,
      liveSessionCode: `${decisionProject.projectCode}-LIVE-001`,
      liveLineId: `${decisionProject.projectId}-live-line-001`,
      liveLineCode: `${decisionProject.projectCode}-LIVE-LINE-001`,
      channelProductId: `${decisionProject.projectId}-channel-product-001`,
      channelProductCode: `${decisionProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${decisionProject.projectCode}-CP-001-UP`,
      exposureQty: 38200,
      clickQty: 1640,
      orderQty: 88,
      gmvAmount: 26312,
      liveResult: '直播试穿讲解有效，成交集中在主推尺码。',
    },
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'TEST_DATA_SUMMARY', {
    businessDate: '2026-04-12',
    note: '直播与短视频汇总后，点击率和转化率均高于同类款式。',
  })
  updateProjectRecord(decisionProject.projectId, { updatedAt: '2026-04-12 21:30' }, DEMO_OPERATOR)
  syncProjectLifecycle(decisionProject.projectId, DEMO_OPERATOR, '2026-04-12 21:30')

  const terminatedProject = createProject(
    buildDemoDraft({
      projectName: '2026秋季衬衫改版修订项目',
      styleType: '改版款',
      projectSourceType: '历史复用',
      categoryName: '上衣',
      ownerName: '赵云',
      teamName: '工程打样组',
      brandName: 'Asaya',
      styleCodeName: '4-Short Sleeve Top-18-35短袖上衣',
      styleTags: ['复古', '修订'],
      channels: ['shopee'],
      remark: '因测款表现不足终止项目。',
    }),
    DEMO_OPERATOR,
  ).project
  approveProjectInitAndSync(terminatedProject.projectId, DEMO_OPERATOR)
  seedInlineRecordAndComplete(terminatedProject.projectId, 'SAMPLE_ACQUIRE', {
    businessDate: '2026-04-07',
    note: '改版样衣已完成准备。',
  })
  seedInlineRecordAndComplete(terminatedProject.projectId, 'SAMPLE_CONFIRM', {
    businessDate: '2026-04-07',
    note: '改版样衣已确认，但渠道预期一般。',
  })
  terminateProject(terminatedProject.projectId, '测款表现未达标，当前项目结束。', DEMO_OPERATOR, '2026-04-08 15:20')
  updateProjectRecord(terminatedProject.projectId, { updatedAt: '2026-04-08 15:20' }, DEMO_OPERATOR)
  syncProjectLifecycle(terminatedProject.projectId, DEMO_OPERATOR, '2026-04-08 15:20')

  const archivedProject = createProject(
    buildDemoDraft({
      projectName: '双渠道归档项目-2026春季针织连衣裙',
      styleType: '基础款',
      projectSourceType: '测款沉淀',
      categoryName: '连衣裙',
      ownerName: '周芳',
      teamName: '商品企划组',
      brandName: 'Chicmore',
      styleCodeName: '1-Casul Shirt-18-30休闲衬衫',
      styleTags: ['名媛', '基础'],
      channels: ['tiktok-shop', 'wechat-mini-program'],
      remark: '已完成转档并进入资料归档。',
    }),
    DEMO_OPERATOR,
  ).project
  approveProjectInitAndSync(archivedProject.projectId, DEMO_OPERATOR)
  listProjectNodes(archivedProject.projectId).forEach((node) => {
    if (node.workItemTypeCode === 'PROJECT_INIT' || isClosedProjectNodeStatus(node.currentStatus)) return
    markProjectNodeCompletedAndUnlockNext(archivedProject.projectId, node.projectNodeId, {
      operatorName: DEMO_OPERATOR,
      timestamp: '2026-04-06 10:10',
      resultType: '节点完成',
      resultText: `${node.workItemTypeName}已完成归档前置处理。`,
    })
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
    sourceModule: '渠道店铺商品',
    sourceObjectType: '渠道店铺商品',
    sourceObjectId: `${archivedProject.projectId}-channel-product-001`,
    sourceObjectCode: `${archivedProject.projectCode}-CP-001`,
    sourceTitle: `${archivedProject.projectName} 正式候选款`,
    sourceStatus: '已生效',
    businessDate: '2026-04-03 17:20',
    noteMeta: {
      channelCode: 'wechat-mini-program',
      targetChannelCode: '微信小程序',
      storeId: 'store-mini-program-01',
      targetStoreId: '微信小程序商城',
      listingTitle: `${archivedProject.projectName} 正式款`,
      listingPrice: 239,
      currency: 'CNY',
      channelProductId: `${archivedProject.projectId}-channel-product-001`,
      channelProductCode: `${archivedProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${archivedProject.projectCode}-CP-001-UP`,
      channelProductStatus: '已生效',
      upstreamSyncStatus: '已更新',
      linkedStyleCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
      invalidatedReason: '',
    },
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'VIDEO_TEST',
    sourceModule: '短视频',
    sourceObjectType: '短视频记录',
    sourceObjectId: `${archivedProject.projectId}-video-001`,
    sourceObjectCode: `${archivedProject.projectCode}-VIDEO-001`,
    sourceTitle: '春季连衣裙短视频测款',
    sourceStatus: '已发布',
    businessDate: '2026-04-04 11:00',
    relationRole: '执行记录',
    noteMeta: {
      videoRecordId: `${archivedProject.projectId}-video-001`,
      videoRecordCode: `${archivedProject.projectCode}-VIDEO-001`,
      channelProductId: `${archivedProject.projectId}-channel-product-001`,
      channelProductCode: `${archivedProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${archivedProject.projectCode}-CP-001-UP`,
      videoChannel: '微信视频号 / 连衣裙测款号',
      exposureQty: 32800,
      clickQty: 1820,
      orderQty: 74,
      gmvAmount: 17686,
      videoResult: '内容完播率稳定，女性客群收藏转化较好。',
    },
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'LIVE_TEST',
    sourceModule: '直播',
    sourceObjectType: '直播商品明细',
    sourceObjectId: `${archivedProject.projectId}-live-001`,
    sourceObjectCode: `${archivedProject.projectCode}-LIVE-001`,
    sourceLineId: `${archivedProject.projectId}-live-line-001`,
    sourceLineCode: `${archivedProject.projectCode}-LIVE-LINE-001`,
    sourceTitle: '春季连衣裙直播测款专场',
    sourceStatus: '已结束',
    businessDate: '2026-04-04 20:30',
    relationRole: '执行记录',
    noteMeta: {
      liveSessionId: `${archivedProject.projectId}-live-001`,
      liveSessionCode: `${archivedProject.projectCode}-LIVE-001`,
      liveLineId: `${archivedProject.projectId}-live-line-001`,
      liveLineCode: `${archivedProject.projectCode}-LIVE-LINE-001`,
      channelProductId: `${archivedProject.projectId}-channel-product-001`,
      channelProductCode: `${archivedProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${archivedProject.projectCode}-CP-001-UP`,
      exposureQty: 45200,
      clickQty: 2140,
      orderQty: 96,
      gmvAmount: 22944,
      liveResult: '直播连麦试穿后成交集中爆发，主推颜色卖断码。',
    },
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    sourceModule: '款式档案',
    sourceObjectType: '款式档案',
    sourceObjectId: `${archivedProject.projectId}-style-001`,
    sourceObjectCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
    sourceTitle: '针织连衣裙款式档案',
    sourceStatus: '已启用',
    businessDate: '2026-04-05 09:20',
    noteMeta: {
      styleId: `${archivedProject.projectId}-style-001`,
      styleCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
      styleName: `${archivedProject.projectName} 款式档案`,
      archiveStatus: 'ACTIVE',
      linkedChannelProductCode: `${archivedProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${archivedProject.projectCode}-CP-001-UP`,
      linkedTechPackVersionCode: `TP-${archivedProject.projectCode.split('-').slice(-1)[0]}-V2`,
      linkedTechPackVersionStatus: 'PUBLISHED',
    },
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    sourceObjectId: `${archivedProject.projectId}-archive-001`,
    sourceObjectCode: `ARC-${archivedProject.projectCode.split('-').slice(-2).join('-')}`,
    sourceTitle: `${archivedProject.projectName} 项目资料归档`,
    sourceStatus: 'FINALIZED',
    businessDate: '2026-04-06 10:10',
    noteMeta: {
      linkedStyleCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
      linkedTechPackVersionCode: `TP-${archivedProject.projectCode.split('-').slice(-1)[0]}-V2`,
      linkedTechPackVersionStatus: 'PUBLISHED',
      projectArchiveNo: `ARC-${archivedProject.projectCode.split('-').slice(-2).join('-')}`,
      projectArchiveStatus: 'FINALIZED',
    },
  })

  ;[
    {
      projectName: '印尼风格碎花连衣裙测款项目',
      styleType: '快时尚款' as TemplateStyleType,
      projectSourceType: '测款沉淀' as PcsProjectCreateDraft['projectSourceType'],
      categoryName: '上衣',
      ownerName: '李娜',
      teamName: '快反开发组',
      brandName: 'Chicmore',
      styleCodeName: '2-prin shirt-18-30印花衬衫',
      styleTags: ['印花', '测款'],
      channels: ['tiktok-shop'],
      remark: '用于直播/短视频测款条目回跳商品项目。',
      timestamp: '2026-04-01 15:20',
    },
    {
      projectName: '波西米亚风印花半身裙测款项目',
      styleType: '设计款' as TemplateStyleType,
      projectSourceType: '测款沉淀' as PcsProjectCreateDraft['projectSourceType'],
      categoryName: '上衣',
      ownerName: '赵云',
      teamName: '设计研发组',
      brandName: 'FADFAD',
      styleCodeName: '2-prin shirt-18-30印花衬衫',
      styleTags: ['印花', '半裙'],
      channels: ['tiktok-shop'],
      remark: '用于直播/短视频测款条目回跳商品项目。',
      timestamp: '2026-04-01 15:10',
    },
    {
      projectName: '牛仔短裤夏季款测款项目',
      styleType: '基础款' as TemplateStyleType,
      projectSourceType: '测款沉淀' as PcsProjectCreateDraft['projectSourceType'],
      categoryName: '上衣',
      ownerName: '周芳',
      teamName: '商品企划组',
      brandName: 'Chicmore',
      styleCodeName: '1-Casul Shirt-18-30休闲衬衫',
      styleTags: ['牛仔', '夏季'],
      channels: ['tiktok-shop'],
      remark: '用于直播测款条目回跳商品项目。',
      timestamp: '2026-04-01 15:00',
    },
  ].forEach((seed) => {
    const project = createProject(
      buildDemoDraft({
        projectName: seed.projectName,
        styleType: seed.styleType,
        projectSourceType: seed.projectSourceType,
        categoryName: seed.categoryName,
        ownerName: seed.ownerName,
        teamName: seed.teamName,
        brandName: seed.brandName,
        styleCodeName: seed.styleCodeName,
        styleTags: seed.styleTags,
        channels: seed.channels,
        remark: seed.remark,
      }),
      DEMO_OPERATOR,
    ).project
    approveProjectInitAndSync(project.projectId, DEMO_OPERATOR)
    updateProjectRecord(
      project.projectId,
      {
        createdAt: seed.timestamp,
        updatedAt: seed.timestamp,
        remark: seed.remark,
      },
      DEMO_OPERATOR,
    )
    seedNodeStatus(project.projectId, 'PROJECT_INIT', {
      updatedAt: seed.timestamp,
      latestResultType: '已完成',
      latestResultText: '测款项目已建立，可供直播测款与短视频测款关联。',
      lastEventType: '立项完成',
      lastEventTime: seed.timestamp,
    })
    syncProjectLifecycle(project.projectId, DEMO_OPERATOR, seed.timestamp)
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'PATTERN_TASK',
    sourceModule: '制版任务',
    sourceObjectType: '制版任务',
    sourceObjectId: `${archivedProject.projectId}-pattern-001`,
    sourceObjectCode: `${archivedProject.projectCode}-PATTERN-001`,
    sourceTitle: '针织连衣裙 P1 制版任务',
    sourceStatus: '已完成',
    businessDate: '2026-04-05 15:30',
    noteMeta: {
      patternBrief: '完成版型结构确认并输出首轮纸样。',
      productStyleCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
      sizeRange: 'S-L',
      patternVersion: 'P1',
    },
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'FIRST_SAMPLE',
    sourceModule: '首版样衣打样',
    sourceObjectType: '首版样衣打样任务',
    sourceObjectId: `${archivedProject.projectId}-first-sample-001`,
    sourceObjectCode: `${archivedProject.projectCode}-FS-001`,
    sourceTitle: '针织连衣裙首版样衣打样',
    sourceStatus: '已完成',
    businessDate: '2026-04-05 18:40',
    noteMeta: {
      factoryId: 'FAC-GZ-001',
      factoryName: '广州一厂',
      targetSite: '广州',
      expectedArrival: '2026-04-08',
      trackingNo: `${archivedProject.projectCode}-SF001`,
      sampleCode: `${archivedProject.projectCode}-Y001`,
    },
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_ACQUIRE', {
    businessDate: '2026-04-01',
    note: '样衣来源已锁定为外采，供应商交付稳定。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_INBOUND_CHECK', {
    businessDate: '2026-04-01',
    note: '到样核对完成，样衣状态良好。',
  })
  seedInlineRecord(archivedProject.projectId, 'FEASIBILITY_REVIEW', {
    businessDate: '2026-04-02',
    note: '版型与渠道适配性良好，建议进入正式测款。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_SHOOT_FIT', {
    businessDate: '2026-04-02',
    note: '拍摄和试穿反馈积极，主推尺码呈现稳定。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_CONFIRM', {
    businessDate: '2026-04-02',
    note: '样衣确认通过，可进入市场测款。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_COST_REVIEW', {
    businessDate: '2026-04-03',
    note: '核价通过，成本满足目标毛利率。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_PRICING', {
    businessDate: '2026-04-03',
    note: '定价口径确认，以 239 元进入正式测款。',
  })
  seedInlineRecord(archivedProject.projectId, 'TEST_DATA_SUMMARY', {
    businessDate: '2026-04-04',
    note: '双渠道测款结果稳定，转化率和复购意向均达到归档标准。',
  })
  seedInlineRecord(archivedProject.projectId, 'TEST_CONCLUSION', {
    businessDate: '2026-04-04',
    note: '测款通过，进入款式档案与后续开发阶段。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_RETURN_HANDLE', {
    businessDate: '2026-04-06',
    note: '项目样衣已完成退回与处置收尾。',
  })
  updateProjectRecord(
    archivedProject.projectId,
    {
      projectStatus: '已归档',
      updatedAt: '2026-04-06 10:10',
      linkedStyleId: `${archivedProject.projectId}-style-001`,
      linkedStyleCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
      linkedStyleName: `${archivedProject.projectName} 款式档案`,
      linkedStyleGeneratedAt: '2026-04-05 09:20',
      linkedTechPackVersionId: `${archivedProject.projectId}-techpack-002`,
      linkedTechPackVersionCode: `TP-${archivedProject.projectCode.split('-').slice(-1)[0]}-V2`,
      linkedTechPackVersionLabel: 'V2',
      linkedTechPackVersionStatus: 'PUBLISHED',
      linkedTechPackVersionPublishedAt: '2026-04-05 14:10',
      projectArchiveId: `${archivedProject.projectId}-archive-001`,
      projectArchiveStatus: '已归档',
      projectArchiveNo: `ARC-${archivedProject.projectCode.split('-').slice(-2).join('-')}`,
      projectArchiveDocumentCount: 6,
      projectArchiveFileCount: 14,
      projectArchiveMissingItemCount: 0,
      projectArchiveUpdatedAt: '2026-04-06 10:10',
      projectArchiveFinalizedAt: '2026-04-06 10:10',
    },
    DEMO_OPERATOR,
  )
  syncProjectLifecycle(archivedProject.projectId, DEMO_OPERATOR, '2026-04-06 10:10')
  }

  persistDemoSeedVersion()
  projectDemoSeedReady = true
}
