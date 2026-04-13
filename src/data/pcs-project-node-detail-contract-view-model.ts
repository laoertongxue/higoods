import { getFirstSampleTaskById } from './pcs-first-sample-repository.ts'
import { getPatternTaskById } from './pcs-pattern-task-repository.ts'
import { getPlateMakingTaskById } from './pcs-plate-making-repository.ts'
import {
  buildProjectChannelProductChainSummary,
} from './pcs-channel-product-project-repository.ts'
import {
  getProjectById,
  getChannelNamesByCodes,
} from './pcs-project-repository.ts'
import type { ProjectRelationItemViewModel } from './pcs-project-relation-view-model.ts'
import type { ProjectNodeDetailViewModel } from './pcs-project-view-model.ts'
import { getPreProductionSampleTaskById } from './pcs-pre-production-sample-repository.ts'
import { resolveLatestProjectInlineNodeRecordFieldValue } from './pcs-project-inline-node-record-view-model.ts'
import {
  getProjectWorkItemContract,
  type PcsProjectNodeFieldDefinition,
  type PcsProjectNodeOperationDefinition,
  type PcsProjectNodeStatusDefinition,
  type PcsProjectWorkItemContract,
} from './pcs-project-domain-contract.ts'

export interface ProjectNodeContractFieldRowViewModel {
  label: string
  fieldKey: string
  sourceText: string
  meaning: string
  scenarioText: string
  businessLogicText: string
  requiredText: string
  readonlyText: string
  currentValueText: string
}

export interface ProjectNodeContractOperationRowViewModel {
  actionName: string
  preconditionsText: string
  businessScenarioText: string
  businessLogicText: string
  effectsText: string
  writebackRulesText: string
}

export interface ProjectNodeContractStatusRowViewModel {
  statusName: string
  businessMeaningText: string
  entryConditionsText: string
  exitConditionsText: string
}

export interface ProjectNodeContractDetailViewModel {
  contract: PcsProjectWorkItemContract
  fieldRows: ProjectNodeContractFieldRowViewModel[]
  operationRows: ProjectNodeContractOperationRowViewModel[]
  statusRows: ProjectNodeContractStatusRowViewModel[]
}

interface NodeFieldResolveContext {
  data: ProjectNodeDetailViewModel
  relationItems: ProjectRelationItemViewModel[]
  contract: PcsProjectWorkItemContract
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '当前无实例值'
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('zh-CN') : '当前无实例值'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => String(item).trim())
      .filter(Boolean)
    return parts.length > 0 ? parts.join('、') : '当前无实例值'
  }
  const text = String(value).trim()
  return text ? text : '当前无实例值'
}

function getFirstRelationItem(
  items: ProjectRelationItemViewModel[],
  matcher: (item: ProjectRelationItemViewModel) => boolean,
): ProjectRelationItemViewModel | null {
  return items.find(matcher) ?? null
}

function resolveFieldValue(field: PcsProjectNodeFieldDefinition, context: NodeFieldResolveContext): string {
  const project = getProjectById(context.data.projectId)
  const chain = buildProjectChannelProductChainSummary(context.data.projectId)
  const inlineRecordValue = resolveLatestProjectInlineNodeRecordFieldValue(
    context.data.node.projectNodeId,
    context.data.node.workItemTypeCode as Parameters<typeof resolveLatestProjectInlineNodeRecordFieldValue>[1],
    field.fieldKey,
  )
  const liveItem = getFirstRelationItem(context.relationItems, (item) => Boolean(item.liveTestingDetail))
  const videoItem = getFirstRelationItem(context.relationItems, (item) => Boolean(item.videoTestingDetail))
  const channelItem = getFirstRelationItem(context.relationItems, (item) => Boolean(item.channelProductDetail))
  const styleItem = getFirstRelationItem(context.relationItems, (item) => Boolean(item.styleArchiveDetail))
  const technicalItem = getFirstRelationItem(context.relationItems, (item) => Boolean(item.technicalVersionDetail))
  const archiveItem = getFirstRelationItem(context.relationItems, (item) => Boolean(item.projectArchiveDetail))
  const firstTaskRelation = getFirstRelationItem(context.relationItems, (item) => item.sourceObjectType === '首版样衣打样任务')
  const preProductionRelation = getFirstRelationItem(
    context.relationItems,
    (item) => item.sourceObjectType === '产前版样衣任务',
  )
  const plateRelation = getFirstRelationItem(context.relationItems, (item) => item.sourceObjectType === '制版任务')
  const artworkRelation = getFirstRelationItem(context.relationItems, (item) => item.sourceObjectType === '花型任务')
  const firstSampleTask = firstTaskRelation ? getFirstSampleTaskById(firstTaskRelation.sourceObjectId) : null
  const preProductionTask = preProductionRelation
    ? getPreProductionSampleTaskById(preProductionRelation.sourceObjectId)
    : null
  const plateTask = plateRelation ? getPlateMakingTaskById(plateRelation.sourceObjectId) : null
  const artworkTask = artworkRelation ? getPatternTaskById(artworkRelation.sourceObjectId) : null
  const testingItems = context.relationItems.filter((item) => item.liveTestingDetail || item.videoTestingDetail)
  const testingTotals = testingItems.reduce(
    (acc, item) => {
      const live = item.liveTestingDetail
      const video = item.videoTestingDetail
      acc.exposureQty += live?.exposureQty ?? video?.exposureQty ?? 0
      acc.clickQty += live?.clickQty ?? video?.clickQty ?? 0
      acc.orderQty += live?.orderQty ?? video?.orderQty ?? 0
      acc.gmvAmount += live?.gmvAmount ?? video?.gmvAmount ?? 0
      return acc
    },
    { exposureQty: 0, clickQty: 0, orderQty: 0, gmvAmount: 0 },
  )

  if (!project) return '当前无实例值'
  if (inlineRecordValue !== undefined) return formatValue(inlineRecordValue)

  const relationValueMap: Record<string, unknown> = {
    sampleCode:
      firstSampleTask?.sampleCode ||
      preProductionTask?.sampleCode ||
      getFirstRelationItem(context.relationItems, (item) => Boolean(item.sampleAssetDetail))?.sampleAssetDetail?.sampleCode ||
      getFirstRelationItem(context.relationItems, (item) => Boolean(item.sampleLedgerDetail))?.sampleLedgerDetail?.sampleCode ||
      '',
    arrivalTime: context.data.node.lastEventTime,
    checkResult: context.data.node.latestResultText,
    targetChannelCode: channelItem?.channelProductDetail?.channelProductCode
      ? `${chain?.channelProducts.find((item) => item.channelProductCode === channelItem.channelProductDetail?.channelProductCode)?.channelName || ''} / ${chain?.channelProducts.find((item) => item.channelProductCode === channelItem.channelProductDetail?.channelProductCode)?.channelCode || ''}`
      : '',
    targetStoreId: chain?.channelProducts.find((item) => item.channelProductId === chain.currentChannelProductId)?.storeId
      ? `${chain?.channelProducts.find((item) => item.channelProductId === chain.currentChannelProductId)?.storeId} · ${chain?.channelProducts.find((item) => item.channelProductId === chain.currentChannelProductId)?.storeName}`
      : '',
    listingTitle: chain?.channelProducts.find((item) => item.channelProductId === chain.currentChannelProductId)?.listingTitle || '',
    listingPrice: chain?.channelProducts.find((item) => item.channelProductId === chain.currentChannelProductId)?.listingPrice,
    currency: chain?.channelProducts.find((item) => item.channelProductId === chain.currentChannelProductId)?.currency || '',
    channelProductCode: chain?.currentChannelProductCode || channelItem?.channelProductDetail?.channelProductCode || '',
    upstreamChannelProductCode:
      chain?.currentUpstreamChannelProductCode || channelItem?.channelProductDetail?.upstreamChannelProductCode || '',
    channelProductStatus:
      chain?.currentChannelProductStatus || channelItem?.channelProductDetail?.channelProductStatus || '',
    upstreamSyncStatus:
      chain?.currentUpstreamSyncStatus || channelItem?.channelProductDetail?.upstreamSyncStatus || '',
    linkedStyleCode: chain?.linkedStyleCode || context.data.linkedStyleCode,
    invalidatedReason: chain?.invalidatedReason || channelItem?.channelProductDetail?.invalidatedReason || '',
    liveSessionId: liveItem?.sourceObjectId || '',
    liveSessionCode: liveItem?.liveTestingDetail?.liveSessionCode || '',
    liveLineId: liveItem?.sourceLineId || '',
    liveLineCode: liveItem?.liveTestingDetail?.liveLineCode || '',
    videoChannel: videoItem?.videoTestingDetail?.channelName || '',
    channelProductId: chain?.currentChannelProductId || '',
    exposureQty:
      context.data.node.workItemTypeCode === 'TEST_DATA_SUMMARY'
        ? testingTotals.exposureQty
        : liveItem?.liveTestingDetail?.exposureQty ?? videoItem?.videoTestingDetail?.exposureQty ?? '',
    clickQty:
      context.data.node.workItemTypeCode === 'TEST_DATA_SUMMARY'
        ? testingTotals.clickQty
        : liveItem?.liveTestingDetail?.clickQty ?? videoItem?.videoTestingDetail?.clickQty ?? '',
    orderQty:
      context.data.node.workItemTypeCode === 'TEST_DATA_SUMMARY'
        ? testingTotals.orderQty
        : liveItem?.liveTestingDetail?.orderQty ?? videoItem?.videoTestingDetail?.orderQty ?? '',
    gmvAmount:
      context.data.node.workItemTypeCode === 'TEST_DATA_SUMMARY'
        ? testingTotals.gmvAmount
        : liveItem?.liveTestingDetail?.gmvAmount ?? videoItem?.videoTestingDetail?.gmvAmount ?? '',
    videoResult: videoItem?.sourceTitle || '',
    liveResult: liveItem?.sourceTitle || '',
    totalExposureQty: testingTotals.exposureQty,
    totalClickQty: testingTotals.clickQty,
    totalOrderQty: testingTotals.orderQty,
    totalGmvAmount: testingTotals.gmvAmount,
    linkedChannelProductCode: chain?.currentChannelProductCode || '',
    invalidationPlanned: chain?.currentConclusion ? chain.currentConclusion !== '通过' : '',
    styleId: context.data.linkedStyleId,
    styleCode: context.data.linkedStyleCode,
    styleName: context.data.linkedStyleName,
    archiveStatus: chain?.linkedStyleStatus || styleItem?.styleArchiveDetail?.archiveStatus || '',
    linkedTechPackVersionCode: context.data.linkedTechPackVersionCode,
    linkedTechPackVersionStatus: context.data.linkedTechPackVersionStatus,
    projectArchiveNo: context.data.projectArchiveNo,
    projectArchiveStatus: context.data.projectArchiveStatus,
    productStyleCode: plateTask?.productStyleCode || artworkTask?.productStyleCode || '',
    sizeRange: plateTask?.sizeRange || '',
    patternVersion:
      plateTask?.patternVersion || preProductionTask?.patternVersion || '',
    artworkType: artworkTask?.artworkType || '',
    patternMode: artworkTask?.patternMode || '',
    artworkName: artworkTask?.artworkName || '',
    artworkVersion: artworkTask?.artworkVersion || preProductionTask?.artworkVersion || '',
    factoryId:
      firstSampleTask?.factoryId
        ? `${firstSampleTask.factoryId} · ${firstSampleTask.factoryName}`
        : preProductionTask?.factoryId
          ? `${preProductionTask.factoryId} · ${preProductionTask.factoryName}`
          : '',
    targetSite: firstSampleTask?.targetSite || preProductionTask?.targetSite || '',
    expectedArrival: firstSampleTask?.expectedArrival || preProductionTask?.expectedArrival || '',
    trackingNo: firstSampleTask?.trackingNo || preProductionTask?.trackingNo || '',
    retainResult: context.data.node.latestResultType,
    retainNote: context.data.node.latestResultText,
    returnResult: context.data.node.latestResultText,
  }
  if (field.fieldKey in relationValueMap) return formatValue(relationValueMap[field.fieldKey])

  const projectValueMap: Record<string, unknown> = {
    projectName: project.projectName,
    templateId: project.templateId && project.templateName ? `${project.templateId} · ${project.templateName}` : project.templateId,
    projectSourceType: project.projectSourceType,
    categoryId: project.categoryId ? `${project.categoryId} · ${project.categoryName}` : '',
    brandId: project.brandId ? `${project.brandId} · ${project.brandName}` : '',
    styleCodeId: project.styleCodeId ? `${project.styleCodeId} · ${project.styleCodeName}` : '',
    styleTagIds: project.styleTagNames,
    crowdPositioningIds: project.crowdPositioningNames,
    ageIds: project.ageNames,
    crowdIds: project.crowdNames,
    productPositioningIds: project.productPositioningNames,
    targetChannelCodes:
      project.targetChannelCodes.length > 0
        ? getChannelNamesByCodes(project.targetChannelCodes).map((name, index) => {
            const code = project.targetChannelCodes[index] || ''
            return code ? `${name}（${code}）` : name
          })
        : [],
    ownerId: project.ownerId ? `${project.ownerId} · ${project.ownerName}` : '',
    teamId: project.teamId ? `${project.teamId} · ${project.teamName}` : '',
    collaboratorIds: project.collaboratorNames,
    priorityLevel: project.priorityLevel,
    remark: project.remark,
    sampleSourceType: project.sampleSourceType,
    sampleSupplierId: project.sampleSupplierId ? `${project.sampleSupplierId} · ${project.sampleSupplierName}` : '',
    sampleLink: project.sampleLink,
    sampleUnitPrice: project.sampleUnitPrice,
  }
  if (field.fieldKey in projectValueMap) return formatValue(projectValueMap[field.fieldKey])

  const nodeValueMap: Record<string, unknown> = {
    reviewConclusion: context.data.node.latestResultType,
    reviewRisk: context.data.node.currentIssueText,
    fitFeedback: context.data.node.latestResultText,
    confirmResult: context.data.node.latestResultType,
    confirmNote: context.data.node.latestResultText,
    costNote: context.data.node.latestResultText,
    pricingNote: context.data.node.latestResultText,
    summaryText: context.data.node.latestResultText,
    conclusion: chain?.currentConclusion || context.data.node.latestResultType,
    conclusionNote: context.data.node.latestResultText,
  }
  if (field.fieldKey in nodeValueMap) return formatValue(nodeValueMap[field.fieldKey])

  if (field.fieldKey === 'styleCode') {
    return formatValue(context.data.linkedStyleCode)
  }
  if (field.fieldKey === 'styleName') {
    return formatValue(context.data.linkedStyleName)
  }
  if (field.fieldKey === 'linkedTechPackVersionCode') {
    return formatValue(context.data.linkedTechPackVersionCode)
  }
  if (field.fieldKey === 'linkedTechPackVersionStatus') {
    return formatValue(context.data.linkedTechPackVersionStatus)
  }
  if (field.fieldKey === 'projectArchiveNo') {
    return formatValue(archiveItem?.projectArchiveDetail?.archiveNo || context.data.projectArchiveNo)
  }
  if (field.fieldKey === 'projectArchiveStatus') {
    return formatValue(archiveItem?.projectArchiveDetail?.archiveStatus || context.data.projectArchiveStatus)
  }
  if (field.fieldKey === 'archiveStatus') {
    return formatValue(styleItem?.styleArchiveDetail?.archiveStatus || chain?.linkedStyleStatus)
  }
  if (field.fieldKey === 'linkedTechPackVersionCode') {
    return formatValue(technicalItem?.technicalVersionDetail?.technicalVersionCode || context.data.linkedTechPackVersionCode)
  }

  return '当前无实例值'
}

function buildFieldRow(
  field: PcsProjectNodeFieldDefinition,
  context: NodeFieldResolveContext,
): ProjectNodeContractFieldRowViewModel {
  return {
    label: field.label,
    fieldKey: field.fieldKey,
    sourceText: `${field.sourceKind} / ${field.sourceRef}`,
    meaning: field.meaning,
    scenarioText: `${field.groupTitle}：${field.groupDescription}`,
    businessLogicText: field.businessLogic,
    requiredText: field.required ? '是' : field.conditionalRequired ? `条件必填：${field.conditionalRequired}` : '否',
    readonlyText: field.readonly ? '是' : '否',
    currentValueText: resolveFieldValue(field, context),
  }
}

function buildOperationRow(
  contract: PcsProjectWorkItemContract,
  operation: PcsProjectNodeOperationDefinition,
): ProjectNodeContractOperationRowViewModel {
  return {
    actionName: operation.actionName,
    preconditionsText: operation.preconditions.join('；') || '无固定前置条件',
    businessScenarioText: contract.scenario,
    businessLogicText: contract.businessRules.join('；') || contract.description,
    effectsText: operation.effects.join('；') || '无直接执行效果说明',
    writebackRulesText: operation.writebackRules.join('；') || '无额外写回规则',
  }
}

function buildStatusRow(status: PcsProjectNodeStatusDefinition): ProjectNodeContractStatusRowViewModel {
  return {
    statusName: status.statusName,
    businessMeaningText: status.businessMeaning,
    entryConditionsText: status.entryConditions.join('；') || '无固定进入条件',
    exitConditionsText: status.exitConditions.join('；') || '无固定退出触发',
  }
}

export function buildProjectNodeContractDetailViewModel(
  data: ProjectNodeDetailViewModel,
): ProjectNodeContractDetailViewModel {
  const contract = getProjectWorkItemContract(data.node.workItemTypeCode as Parameters<typeof getProjectWorkItemContract>[0])
  const context: NodeFieldResolveContext = {
    data,
    relationItems: data.relationSection.items,
    contract,
  }

  return {
    contract,
    fieldRows: contract.fieldDefinitions.map((field) => buildFieldRow(field, context)),
    operationRows: contract.operationDefinitions.map((operation) => buildOperationRow(contract, operation)),
    statusRows: contract.statusDefinitions.map(buildStatusRow),
  }
}
