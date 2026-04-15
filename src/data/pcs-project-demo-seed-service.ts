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
import { saveProjectInlineNodeFieldEntry } from './pcs-project-inline-node-record-repository.ts'
import type { PcsProjectInlineNodeRecordWorkItemTypeCode } from './pcs-project-inline-node-record-types.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import { getProjectTestingSummaryAggregate } from './pcs-channel-product-project-repository.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'
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

let projectDemoSeedReady = false

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
          revisionTaskId: '',
          revisionTaskCode: '',
          linkedStyleId: project.linkedStyleId || '',
          linkedStyleCode: project.linkedStyleCode || '',
          invalidatedChannelProductId: '',
          projectTerminated: false,
          projectTerminatedAt: '',
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
    case 'SAMPLE_RETAIN_REVIEW':
      return {
        values: {
          retainResult: '留样',
          retainNote: note,
        },
        detailSnapshot: {
          sampleCode: `${project.projectCode}-Y001`,
          availabilityAfter: '可调拨',
          locationAfter: '样衣仓 B-02',
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

export function ensurePcsProjectDemoDataReady(): void {
  if (projectDemoSeedReady) return
  if (listProjects().some((project) => project.projectName.includes('双渠道归档项目'))) {
    projectDemoSeedReady = true
    return
  }

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
    latestResultType: '已创建渠道店铺商品',
    latestResultText: '已生成抖音商城渠道店铺商品，等待发起上架。',
    pendingActionType: '发起上架',
    pendingActionText: '请补充上架标题和售价后提交上架。',
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
    sourceTitle: `${ongoingProject.projectName} 抖音商城渠道店铺商品`,
    sourceStatus: '待上架',
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
      channelProductStatus: '待上架',
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
    latestResultText: '请确认测款结论：通过、调整、暂缓或淘汰。',
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
  seedInlineRecordAndComplete(terminatedProject.projectId, 'FEASIBILITY_REVIEW', {
    businessDate: '2026-04-07',
    note: '改版目标明确，但渠道预期一般。',
  })
  terminateProject(terminatedProject.projectId, '测款表现未达标，决定停止继续开发。', DEMO_OPERATOR, '2026-04-08 15:20')
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
    workItemTypeCode: 'PROJECT_TRANSFER_PREP',
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
    note: '测款通过，进入款式档案与转档准备阶段。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_RETAIN_REVIEW', {
    businessDate: '2026-04-06',
    note: '保留主推色样衣供后续复盘与素材使用。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_RETURN_HANDLE', {
    businessDate: '2026-04-06',
    note: '非主推色样衣已完成退回处理。',
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

  projectDemoSeedReady = true
}
