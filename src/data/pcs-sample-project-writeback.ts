import {
  getSampleAssetByCode,
  listSampleAssets,
  upsertSampleAsset,
} from './pcs-sample-asset-repository.ts'
import { createBootstrapSampleEventInputs, SAMPLE_BOOTSTRAP_MARKER_KEY } from './pcs-sample-bootstrap.ts'
import {
  getSampleLedgerEventById,
  listSampleLedgerEvents,
  listSampleWritebackPendingItems,
  upsertSampleLedgerEvent,
  upsertSampleWritebackPendingItem,
} from './pcs-sample-ledger-repository.ts'
import {
  getProjectById,
  findProjectByCode,
  findProjectNodeById,
  findProjectNodeByWorkItemTypeCode,
  getProjectStoreSnapshot,
  updateProjectNodeRecord,
} from './pcs-project-repository.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import { upsertProjectInlineNodeRecord } from './pcs-project-inline-node-record-repository.ts'
import type { ProjectNodeIdentityRef } from './pcs-project-types.ts'
import type {
  SampleAssetRecord,
  SampleAvailabilityStatus,
  SampleInventoryStatus,
  SampleLedgerEventRecord,
  SampleLedgerEventType,
  SampleLedgerWriteInput,
  SampleWritebackPendingItem,
} from './pcs-sample-types.ts'
import { SAMPLE_LEDGER_EVENT_NAME_MAP } from './pcs-sample-types.ts'

interface ResolvedTargetResult {
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string | null
  workItemTypeCode: string
  workItemTypeName: string
  nodeIdentity: ProjectNodeIdentityRef | null
  pendingReason: string
}

interface SampleStatusAfterEvent {
  inventoryStatus: SampleInventoryStatus
  availabilityStatus: SampleAvailabilityStatus
}

interface SampleWritebackResult {
  asset: SampleAssetRecord
  event: SampleLedgerEventRecord
  targetNodeId: string | null
  pendingWritten: boolean
}

type SampleInlineDetailMeta = {
  returnRecipient?: string
  returnDepartment?: string
  returnAddress?: string
  returnDate?: string
  logisticsProvider?: string
  trackingNumber?: string
  modificationReason?: string
}

const SAMPLE_APPLICATION_ALLOWED_NODE_CODES = ['LIVE_TEST', 'VIDEO_TEST', 'SAMPLE_SHOOT_FIT', 'PATTERN_TASK']

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function nextSampleAssetId(): string {
  return `sample_asset_${String(listSampleAssets().length + 1).padStart(4, '0')}`
}

function nextPendingId(): string {
  return `sample_pending_${String(listSampleWritebackPendingItems().length + 1).padStart(4, '0')}`
}

function eventCodePrefix(eventType: SampleLedgerEventType): string {
  const map: Record<SampleLedgerEventType, string> = {
    RECEIVE_ARRIVAL: 'ARV',
    CHECKIN_VERIFY: 'CHK',
    RESERVE_LOCK: 'RSV',
    CANCEL_RESERVE: 'CAN',
    CHECKOUT_BORROW: 'OUT',
    RETURN_CHECKIN: 'RET',
    SHIP_OUT: 'SHP',
    DELIVER_SIGNED: 'SGN',
    STOCKTAKE: 'STK',
    DISPOSAL: 'DSP',
    RETURN_SUPPLIER: 'RSP',
  }
  return map[eventType]
}

function nextLedgerEventCode(eventType: SampleLedgerEventType): string {
  const prefix = eventCodePrefix(eventType)
  const datePart = nowText().slice(0, 10).replace(/-/g, '')
  return `LE-${datePart}-${prefix}-${String(listSampleLedgerEvents().length + 1).padStart(3, '0')}`
}

function normalizeStatusAfterEvent(
  eventType: SampleLedgerEventType,
  currentInventoryStatus: SampleInventoryStatus,
  currentAvailabilityStatus: SampleAvailabilityStatus,
): SampleStatusAfterEvent {
  if (eventType === 'RECEIVE_ARRIVAL') {
    return { inventoryStatus: '在库待核对', availabilityStatus: '不可用' }
  }
  if (eventType === 'CHECKIN_VERIFY') {
    return { inventoryStatus: '在库可用', availabilityStatus: '可用' }
  }
  if (eventType === 'RESERVE_LOCK') {
    return { inventoryStatus: '预占锁定', availabilityStatus: '不可用' }
  }
  if (eventType === 'CANCEL_RESERVE') {
    return { inventoryStatus: '在库可用', availabilityStatus: '可用' }
  }
  if (eventType === 'CHECKOUT_BORROW') {
    return { inventoryStatus: '借出占用', availabilityStatus: '不可用' }
  }
  if (eventType === 'RETURN_CHECKIN') {
    return { inventoryStatus: '在库可用', availabilityStatus: '可用' }
  }
  if (eventType === 'SHIP_OUT') {
    return { inventoryStatus: '在途待签收', availabilityStatus: '不可用' }
  }
  if (eventType === 'DELIVER_SIGNED') {
    return { inventoryStatus: '借出占用', availabilityStatus: '不可用' }
  }
  if (eventType === 'STOCKTAKE') {
    return { inventoryStatus: currentInventoryStatus, availabilityStatus: currentAvailabilityStatus }
  }
  if (eventType === 'DISPOSAL') {
    return { inventoryStatus: '已处置', availabilityStatus: '不可用' }
  }
  return { inventoryStatus: '已退货', availabilityStatus: '不可用' }
}

function resolveProject(input: SampleLedgerWriteInput) {
  if (input.projectId) {
    const project = getProjectById(input.projectId)
    return project
  }
  if (input.projectCode) {
    return findProjectByCode(input.projectCode)
  }
  return null
}

function buildPendingItem(input: SampleLedgerWriteInput, reason: string): SampleWritebackPendingItem {
  return {
    pendingId: nextPendingId(),
    sourcePage: input.sourcePage,
    sourceDocType: input.sourceDocType || '未知来源单据',
    sourceDocCode: input.sourceDocCode,
    sampleCode: input.sampleCode,
    rawProjectField: input.projectCode || input.projectId || input.legacyProjectRef || '',
    rawWorkItemField: input.projectNodeId || input.workItemTypeCode || input.legacyWorkItemInstanceId || '',
    reason,
    discoveredAt: nowText(),
  }
}

function resolveNodeByRule(projectId: string, input: SampleLedgerWriteInput): ProjectNodeIdentityRef | null {
  if (input.sourceDocType === '首版样衣打样任务') return findProjectNodeByWorkItemTypeCode(projectId, 'FIRST_SAMPLE')
  if (input.sourceDocType === '产前版样衣任务') return findProjectNodeByWorkItemTypeCode(projectId, 'PRE_PRODUCTION_SAMPLE')
  if (input.sourceDocType === '样衣退回单') return findProjectNodeByWorkItemTypeCode(projectId, 'SAMPLE_RETURN_HANDLE')
  if (input.sourceDocType === '样衣处置单') return findProjectNodeByWorkItemTypeCode(projectId, 'SAMPLE_RETAIN_REVIEW')
  if (input.sourceDocType === '样衣获取单' && input.eventType === 'RECEIVE_ARRIVAL') return findProjectNodeByWorkItemTypeCode(projectId, 'SAMPLE_ACQUIRE')
  if (input.sourceDocType === '样衣获取单' && input.eventType === 'CHECKIN_VERIFY') return findProjectNodeByWorkItemTypeCode(projectId, 'SAMPLE_INBOUND_CHECK')
  return null
}

function getExpectedNodeCode(input: SampleLedgerWriteInput): string {
  if (input.sourceDocType === '首版样衣打样任务') return 'FIRST_SAMPLE'
  if (input.sourceDocType === '产前版样衣任务') return 'PRE_PRODUCTION_SAMPLE'
  if (input.sourceDocType === '样衣退回单') return 'SAMPLE_RETURN_HANDLE'
  if (input.sourceDocType === '样衣处置单') return 'SAMPLE_RETAIN_REVIEW'
  if (input.sourceDocType === '样衣获取单' && input.eventType === 'RECEIVE_ARRIVAL') return 'SAMPLE_ACQUIRE'
  if (input.sourceDocType === '样衣获取单' && input.eventType === 'CHECKIN_VERIFY') return 'SAMPLE_INBOUND_CHECK'
  return ''
}

function resolveTarget(input: SampleLedgerWriteInput): ResolvedTargetResult {
  const project = resolveProject(input)
  if (!project) {
    return {
      projectId: input.projectId || '',
      projectCode: input.projectCode || '',
      projectName: input.projectName || '',
      projectNodeId: null,
      workItemTypeCode: input.workItemTypeCode || '',
      workItemTypeName: input.workItemTypeName || '',
      nodeIdentity: null,
      pendingReason: input.projectId || input.projectCode || input.legacyProjectRef
        ? '样衣事件引用了不存在的商品项目。'
        : '',
    }
  }

  if (input.projectNodeId) {
    const node = findProjectNodeById(project.projectId, input.projectNodeId)
    if (node) {
      const expectedNodeCode = getExpectedNodeCode(input)
      if (input.sourceDocType === '样衣使用申请' && !SAMPLE_APPLICATION_ALLOWED_NODE_CODES.includes(node.workItemTypeCode)) {
        return {
          projectId: project.projectId,
          projectCode: project.projectCode,
          projectName: project.projectName,
          projectNodeId: null,
          workItemTypeCode: input.workItemTypeCode || node.workItemTypeCode,
          workItemTypeName: input.workItemTypeName || node.workItemTypeName,
          nodeIdentity: null,
          pendingReason: '样衣使用申请绑定的项目节点不在允许的工作项范围内。',
        }
      }
      if (expectedNodeCode && node.workItemTypeCode !== expectedNodeCode) {
        return {
          projectId: project.projectId,
          projectCode: project.projectCode,
          projectName: project.projectName,
          projectNodeId: null,
          workItemTypeCode: input.workItemTypeCode || node.workItemTypeCode,
          workItemTypeName: input.workItemTypeName || node.workItemTypeName,
          nodeIdentity: null,
          pendingReason: '项目节点与当前样衣事件类型不匹配。',
        }
      }
      if (input.workItemTypeCode && node.workItemTypeCode !== input.workItemTypeCode) {
        return {
          projectId: project.projectId,
          projectCode: project.projectCode,
          projectName: project.projectName,
          projectNodeId: null,
          workItemTypeCode: input.workItemTypeCode,
          workItemTypeName: input.workItemTypeName || '',
          nodeIdentity: null,
          pendingReason: '来源单据携带的工作项与项目节点不一致。',
        }
      }
      return {
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectName: project.projectName,
        projectNodeId: node.projectNodeId,
        workItemTypeCode: node.workItemTypeCode,
        workItemTypeName: node.workItemTypeName,
        nodeIdentity: node,
        pendingReason: '',
      }
    }
    return {
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: null,
      workItemTypeCode: input.workItemTypeCode || '',
      workItemTypeName: input.workItemTypeName || '',
      nodeIdentity: null,
      pendingReason: '项目存在，但指定的项目节点不存在。'
    }
  }

  if (input.workItemTypeCode && input.sourceDocType === '样衣使用申请') {
    return {
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: null,
      workItemTypeCode: input.workItemTypeCode,
      workItemTypeName: input.workItemTypeName || '',
      nodeIdentity: null,
      pendingReason: '样衣使用申请未绑定正式项目节点，不能自动猜测。',
    }
  }

  const node = resolveNodeByRule(project.projectId, input)
  if (node) {
    return {
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: node.workItemTypeCode,
      workItemTypeName: node.workItemTypeName,
      nodeIdentity: node,
      pendingReason: '',
    }
  }

  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: null,
    workItemTypeCode: input.workItemTypeCode || '',
    workItemTypeName: input.workItemTypeName || '',
    nodeIdentity: null,
    pendingReason: input.projectId || input.projectCode ? '项目存在，但无法定位对应的项目节点。' : '',
  }
}

function buildOrUpdateAsset(
  existingAsset: SampleAssetRecord | null,
  input: SampleLedgerWriteInput,
  resolvedTarget: ResolvedTargetResult,
  eventId: string,
  eventType: SampleLedgerEventType,
  eventTime: string,
): SampleAssetRecord {
  const currentInventoryStatus = existingAsset?.inventoryStatus || '在途'
  const currentAvailabilityStatus = existingAsset?.availabilityStatus || '不可用'
  const afterState = {
    inventoryStatus: input.inventoryStatusAfter || normalizeStatusAfterEvent(eventType, currentInventoryStatus, currentAvailabilityStatus).inventoryStatus,
    availabilityStatus: input.availabilityAfter || normalizeStatusAfterEvent(eventType, currentInventoryStatus, currentAvailabilityStatus).availabilityStatus,
  }

  return {
    sampleAssetId: existingAsset?.sampleAssetId || input.sampleAssetId || nextSampleAssetId(),
    sampleCode: input.sampleCode,
    sampleName: input.sampleName,
    sampleType: input.sampleType || existingAsset?.sampleType || '样衣',
    responsibleSite: input.responsibleSite || existingAsset?.responsibleSite || '',
    inventoryStatus: afterState.inventoryStatus,
    availabilityStatus: afterState.availabilityStatus,
    locationType: input.locationType || existingAsset?.locationType || '仓库',
    locationCode: input.locationCode || existingAsset?.locationCode || '',
    locationDisplay: input.locationDisplay || input.locationAfter || existingAsset?.locationDisplay || '',
    custodianType: input.custodianType || existingAsset?.custodianType || '仓管',
    custodianName: input.custodianName || existingAsset?.custodianName || '',
    projectId: resolvedTarget.projectId,
    projectCode: resolvedTarget.projectCode,
    projectName: resolvedTarget.projectName,
    projectNodeId: resolvedTarget.projectNodeId || '',
    workItemTypeCode: resolvedTarget.workItemTypeCode,
    workItemTypeName: resolvedTarget.workItemTypeName,
    sourceDocType: input.sourceDocType,
    sourceDocId: input.sourceDocId,
    sourceDocCode: input.sourceDocCode,
    lastEventId: eventId,
    lastEventType: eventType,
    lastEventTime: eventTime,
    createdAt: existingAsset?.createdAt || eventTime,
    createdBy: existingAsset?.createdBy || (input.operatorName || '当前用户'),
    updatedAt: eventTime,
    updatedBy: input.operatorName || '当前用户',
    legacyProjectRef: input.legacyProjectRef || existingAsset?.legacyProjectRef || '',
    legacyWorkItemInstanceId: input.legacyWorkItemInstanceId || existingAsset?.legacyWorkItemInstanceId || '',
  }
}

function buildEventRecord(
  asset: SampleAssetRecord,
  existingAsset: SampleAssetRecord | null,
  input: SampleLedgerWriteInput,
  resolvedTarget: ResolvedTargetResult,
  eventId: string,
  eventCode: string,
  eventTime: string,
): SampleLedgerEventRecord {
  return {
    ledgerEventId: eventId,
    ledgerEventCode: eventCode,
    eventType: input.eventType,
    eventName: SAMPLE_LEDGER_EVENT_NAME_MAP[input.eventType],
    sampleAssetId: asset.sampleAssetId,
    sampleCode: asset.sampleCode,
    sampleName: asset.sampleName,
    quantity: input.quantity || 1,
    responsibleSite: input.responsibleSite,
    inventoryStatusBefore: input.inventoryStatusBefore || existingAsset?.inventoryStatus || '',
    inventoryStatusAfter: asset.inventoryStatus,
    availabilityBefore: input.availabilityBefore || existingAsset?.availabilityStatus || '',
    availabilityAfter: asset.availabilityStatus,
    locationBefore: input.locationBefore || existingAsset?.locationDisplay || '',
    locationAfter: input.locationAfter || asset.locationDisplay,
    sourceModule: input.sourceModule,
    sourceDocType: input.sourceDocType,
    sourceDocId: input.sourceDocId,
    sourceDocCode: input.sourceDocCode,
    projectId: resolvedTarget.projectId,
    projectCode: resolvedTarget.projectCode,
    projectName: resolvedTarget.projectName,
    projectNodeId: resolvedTarget.projectNodeId || '',
    workItemTypeCode: resolvedTarget.workItemTypeCode,
    workItemTypeName: resolvedTarget.workItemTypeName,
    operatorId: input.operatorId || '',
    operatorName: input.operatorName || '当前用户',
    businessDate: eventTime,
    note: input.note || resolvedTarget.pendingReason || '',
    legacyProjectRef: input.legacyProjectRef || '',
    legacyWorkItemInstanceId: input.legacyWorkItemInstanceId || '',
    createdAt: eventTime,
    createdBy: input.operatorName || '当前用户',
  }
}

function buildNodePatch(input: SampleLedgerWriteInput, event: SampleLedgerEventRecord) {
  const common = {
    updatedAt: event.businessDate,
    lastEventId: event.ledgerEventId,
    lastEventType: event.eventType,
    lastEventTime: event.businessDate,
  }

  if (input.sourceDocType === '样衣获取单' && event.eventType === 'RECEIVE_ARRIVAL') {
    return {
      ...common,
      currentStatus: '进行中',
      latestResultType: '已到样',
      latestResultText: '样衣已到样，待核对入库',
      currentIssueType: '',
      currentIssueText: '',
      pendingActionType: '核对入库',
      pendingActionText: '请完成到样核对与入库',
    }
  }
  if (input.sourceDocType === '样衣获取单' && event.eventType === 'CHECKIN_VERIFY') {
    return {
      ...common,
      currentStatus: '已完成',
      latestResultType: '已核对入库',
      latestResultText: '样衣已完成核对入库',
      currentIssueType: '',
      currentIssueText: '',
      pendingActionType: '',
      pendingActionText: '',
    }
  }
  if (input.sourceDocType === '样衣使用申请' && event.eventType === 'RESERVE_LOCK') {
    return {
      ...common,
      currentStatus: '进行中',
      latestResultType: '样衣已预占',
      latestResultText: '已预占样衣，待领用或寄送',
      pendingActionType: '领用或寄送',
      pendingActionText: '请完成样衣交接',
    }
  }
  if (input.sourceDocType === '样衣使用申请' && event.eventType === 'CANCEL_RESERVE') {
    return {
      ...common,
      latestResultType: '已取消预占',
      latestResultText: '本次样衣预占已取消',
      pendingActionType: '重新申请',
      pendingActionText: '如仍需使用样衣，请重新发起申请',
    }
  }
  if (input.sourceDocType === '样衣使用申请' && event.eventType === 'CHECKOUT_BORROW') {
    return {
      ...common,
      latestResultType: '样衣已领用',
      latestResultText: '样衣已完成领用，当前正在使用',
      pendingActionType: '归还入库',
      pendingActionText: '使用完成后请及时归还入库',
    }
  }
  if (input.sourceDocType === '样衣使用申请' && event.eventType === 'SHIP_OUT') {
    return {
      ...common,
      latestResultType: '样衣已寄出',
      latestResultText: '样衣已寄出，等待签收',
      pendingActionType: '待签收',
      pendingActionText: '请关注物流与签收情况',
    }
  }
  if (input.sourceDocType === '样衣使用申请' && event.eventType === 'DELIVER_SIGNED') {
    return {
      ...common,
      latestResultType: '样衣已签收',
      latestResultText: '样衣已签收，可继续使用',
      pendingActionType: '归还入库',
      pendingActionText: '使用完成后请及时归还入库',
    }
  }
  if (input.sourceDocType === '样衣使用申请' && event.eventType === 'RETURN_CHECKIN') {
    return {
      ...common,
      latestResultType: '样衣已归还入库',
      latestResultText: '样衣已归还并重新入库',
      pendingActionType: '',
      pendingActionText: '',
    }
  }
  if (input.sourceDocType === '首版样衣打样任务' && event.eventType === 'SHIP_OUT') {
    return {
      ...common,
      currentStatus: '进行中',
      latestResultType: '首版样衣已寄出',
      latestResultText: '首版样衣已寄出，等待到样',
      pendingActionType: '待到样',
      pendingActionText: '请关注物流与到样时间',
    }
  }
  if (input.sourceDocType === '首版样衣打样任务' && event.eventType === 'RECEIVE_ARRIVAL') {
    return {
      ...common,
      currentStatus: '进行中',
      latestResultType: '首版样衣已到样',
      latestResultText: '首版样衣已到样，待验收',
      pendingActionType: '待验收',
      pendingActionText: '请完成首版样衣验收',
    }
  }
  if (input.sourceDocType === '首版样衣打样任务' && event.eventType === 'CHECKIN_VERIFY') {
    return {
      ...common,
      currentStatus: '进行中',
      latestResultType: '首版样衣已入库',
      latestResultText: '首版样衣已完成入库，可进入验收',
      pendingActionType: '待验收',
      pendingActionText: '请完成首版样衣验收',
    }
  }
  if (input.sourceDocType === '产前版样衣任务' && event.eventType === 'SHIP_OUT') {
    return {
      ...common,
      currentStatus: '进行中',
      latestResultType: '产前版样衣已寄出',
      latestResultText: '产前版样衣已寄出，等待到样',
      pendingActionType: '待到样',
      pendingActionText: '请关注物流与到样时间',
    }
  }
  if (input.sourceDocType === '产前版样衣任务' && event.eventType === 'RECEIVE_ARRIVAL') {
    return {
      ...common,
      currentStatus: '进行中',
      latestResultType: '产前版样衣已到样',
      latestResultText: '产前版样衣已到样，待验收',
      pendingActionType: '待验收',
      pendingActionText: '请完成产前版样衣验收',
    }
  }
  if (input.sourceDocType === '产前版样衣任务' && event.eventType === 'CHECKIN_VERIFY') {
    return {
      ...common,
      currentStatus: '进行中',
      latestResultType: '产前版样衣已入库',
      latestResultText: '产前版样衣已完成入库，可进入验收',
      pendingActionType: '待验收',
      pendingActionText: '请完成产前版样衣验收',
    }
  }
  if (input.sourceDocType === '样衣退回单' && event.eventType === 'RETURN_SUPPLIER') {
    return {
      ...common,
      currentStatus: '已完成',
      latestResultType: '样衣已退回',
      latestResultText: '样衣已完成退回处理',
      currentIssueType: '',
      currentIssueText: '',
      pendingActionType: '',
      pendingActionText: '',
    }
  }
  if (input.sourceDocType === '样衣处置单' && event.eventType === 'DISPOSAL') {
    return {
      ...common,
      currentStatus: '已完成',
      latestResultType: '样衣处置完成',
      latestResultText: '样衣已完成处置或留存处理',
      currentIssueType: '',
      currentIssueText: '',
      pendingActionType: '',
      pendingActionText: '',
    }
  }
  return common
}

function writeProjectRelations(asset: SampleAssetRecord, event: SampleLedgerEventRecord, resolvedTarget: ResolvedTargetResult): void {
  if (!resolvedTarget.projectId) return

  upsertProjectRelation({
    projectRelationId: `${event.ledgerEventId}::ledger`,
    projectId: resolvedTarget.projectId,
    projectCode: resolvedTarget.projectCode,
    projectNodeId: resolvedTarget.projectNodeId,
    workItemTypeCode: resolvedTarget.workItemTypeCode,
    workItemTypeName: resolvedTarget.workItemTypeName,
    relationRole: '执行记录',
    sourceModule: '样衣台账',
    sourceObjectType: '样衣台账事件',
    sourceObjectId: event.ledgerEventId,
    sourceObjectCode: event.ledgerEventCode,
    sourceLineId: asset.sampleAssetId,
    sourceLineCode: asset.sampleCode,
    sourceTitle: asset.sampleName,
    sourceStatus: event.inventoryStatusAfter,
    businessDate: event.businessDate,
    ownerName: event.operatorName,
    createdAt: event.createdAt,
    createdBy: event.createdBy,
    updatedAt: event.businessDate,
    updatedBy: event.operatorName,
    note: resolvedTarget.pendingReason,
    legacyRefType: event.legacyProjectRef ? 'legacyProjectRef' : '',
    legacyRefValue: event.legacyProjectRef,
  })

  if (event.eventType === 'CHECKIN_VERIFY' && resolvedTarget.projectNodeId) {
    upsertProjectRelation({
      projectRelationId: `${asset.sampleAssetId}::asset`,
      projectId: resolvedTarget.projectId,
      projectCode: resolvedTarget.projectCode,
      projectNodeId: resolvedTarget.projectNodeId,
      workItemTypeCode: resolvedTarget.workItemTypeCode,
      workItemTypeName: resolvedTarget.workItemTypeName,
      relationRole: '产出对象',
      sourceModule: '样衣资产',
      sourceObjectType: '样衣资产',
      sourceObjectId: asset.sampleAssetId,
      sourceObjectCode: asset.sampleCode,
      sourceLineId: asset.sampleAssetId,
      sourceLineCode: asset.sampleCode,
      sourceTitle: asset.sampleName,
      sourceStatus: asset.inventoryStatus,
      businessDate: event.businessDate,
      ownerName: event.operatorName,
      createdAt: event.createdAt,
      createdBy: event.createdBy,
      updatedAt: event.businessDate,
      updatedBy: event.operatorName,
      note: '',
      legacyRefType: event.legacyProjectRef ? 'legacyProjectRef' : '',
      legacyRefValue: event.legacyProjectRef,
    })
  }
}

function writeProjectNode(input: SampleLedgerWriteInput, event: SampleLedgerEventRecord, resolvedTarget: ResolvedTargetResult): void {
  if (!resolvedTarget.projectId || !resolvedTarget.projectNodeId || !resolvedTarget.nodeIdentity) return
  if (event.eventType === 'STOCKTAKE') return
  const currentNode = getProjectStoreSnapshot()
    .nodes
    .find((item) => item.projectId === resolvedTarget.projectId && item.projectNodeId === resolvedTarget.projectNodeId)
  if (!currentNode) return

  if (currentNode.lastEventTime && event.businessDate.localeCompare(currentNode.lastEventTime) < 0) {
    return
  }

  const patch = buildNodePatch(input, event)
  const keepCurrentStatus = currentNode.currentStatus === '已完成' || currentNode.currentStatus === '已取消'
  const limitedPatch = keepCurrentStatus
    ? {
        updatedAt: patch.updatedAt,
        lastEventId: patch.lastEventId,
        lastEventType: patch.lastEventType,
        lastEventTime: patch.lastEventTime,
        latestResultType: patch.latestResultType || currentNode.latestResultType,
        latestResultText: patch.latestResultText || currentNode.latestResultText,
      }
    : {
        ...patch,
        currentStatus: patch.currentStatus,
        latestResultType: patch.latestResultType || currentNode.latestResultType,
        latestResultText: patch.latestResultText || currentNode.latestResultText,
        currentIssueType: patch.currentIssueType ?? currentNode.currentIssueType,
        currentIssueText: patch.currentIssueText ?? currentNode.currentIssueText,
        pendingActionType: patch.pendingActionType ?? currentNode.pendingActionType,
        pendingActionText: patch.pendingActionText ?? currentNode.pendingActionText,
      }
  updateProjectNodeRecord(resolvedTarget.projectId, resolvedTarget.projectNodeId, limitedPatch, event.operatorName)
}

function buildInlineRecordId(projectNodeId: string, sourceDocId: string): string {
  return `${projectNodeId}::${sourceDocId}`.replace(/[^a-zA-Z0-9:_-]/g, '_')
}

function buildSampleInlineRecordCode(projectCode: string, suffix: string): string {
  return `INR-${projectCode.slice(-3)}-${suffix}`
}

function writeProjectInlineNodeRecord(
  input: SampleLedgerWriteInput,
  asset: SampleAssetRecord,
  event: SampleLedgerEventRecord,
  resolvedTarget: ResolvedTargetResult,
): void {
  if (!resolvedTarget.projectId || !resolvedTarget.projectNodeId || !resolvedTarget.nodeIdentity) return
  const project = getProjectById(resolvedTarget.projectId)
  if (!project) return
  const inlineMeta = input as SampleLedgerWriteInput & SampleInlineDetailMeta

  if (input.sourceDocType === '样衣处置单' && event.eventType === 'DISPOSAL') {
    upsertProjectInlineNodeRecord({
      recordId: buildInlineRecordId(resolvedTarget.projectNodeId, input.sourceDocId),
      recordCode: buildSampleInlineRecordCode(project.projectCode, 'RETAIN'),
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: resolvedTarget.projectNodeId,
      workItemTypeCode: 'SAMPLE_RETAIN_REVIEW',
      workItemTypeName: resolvedTarget.workItemTypeName,
      businessDate: event.businessDate,
      recordStatus: '已完成',
      ownerId: project.ownerId,
      ownerName: event.operatorName,
      payload: {
        retainResult: '已完成处置',
        retainNote: input.note || '样衣已按处置单完成正式处置。',
      },
      detailSnapshot: {
        sampleAssetId: asset.sampleAssetId,
        sampleCode: asset.sampleCode,
        sampleLedgerEventId: event.ledgerEventId,
        sampleLedgerEventCode: event.ledgerEventCode,
        inventoryStatusAfter: event.inventoryStatusAfter,
        availabilityAfter: event.availabilityAfter,
        locationAfter: event.locationAfter,
        disposalDocId: input.sourceDocId,
        disposalDocCode: input.sourceDocCode,
      },
      sourceModule: input.sourceModule,
      sourceDocType: input.sourceDocType,
      sourceDocId: input.sourceDocId,
      sourceDocCode: input.sourceDocCode,
      upstreamRefs: [
        {
          refModule: '样衣资产',
          refType: '样衣资产',
          refId: asset.sampleAssetId,
          refCode: asset.sampleCode,
          refTitle: asset.sampleName,
          refStatus: asset.inventoryStatus,
        },
        {
          refModule: '样衣台账',
          refType: '样衣台账事件',
          refId: event.ledgerEventId,
          refCode: event.ledgerEventCode,
          refTitle: event.eventName,
          refStatus: event.inventoryStatusAfter,
        },
      ],
      downstreamRefs: [
        {
          refModule: '样衣处置单',
          refType: '样衣处置单',
          refId: input.sourceDocId,
          refCode: input.sourceDocCode,
          refTitle: input.note || '样衣处置单',
          refStatus: '已完成',
        },
      ],
      createdAt: event.businessDate,
      createdBy: event.operatorName,
      updatedAt: event.businessDate,
      updatedBy: event.operatorName,
      legacyProjectRef: input.legacyProjectRef || null,
      legacyWorkItemInstanceId: input.legacyWorkItemInstanceId || null,
    })
    return
  }

  if (input.sourceDocType === '样衣退回单' && event.eventType === 'RETURN_SUPPLIER') {
    upsertProjectInlineNodeRecord({
      recordId: buildInlineRecordId(resolvedTarget.projectNodeId, input.sourceDocId),
      recordCode: buildSampleInlineRecordCode(project.projectCode, 'RETURN'),
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: resolvedTarget.projectNodeId,
      workItemTypeCode: 'SAMPLE_RETURN_HANDLE',
      workItemTypeName: resolvedTarget.workItemTypeName,
      businessDate: event.businessDate,
      recordStatus: '已完成',
      ownerId: project.ownerId,
      ownerName: event.operatorName,
      payload: {
        returnResult: '已完成退回',
      },
      detailSnapshot: {
        returnRecipient: inlineMeta.returnRecipient || '供应商收货人',
        returnDepartment: inlineMeta.returnDepartment || '样衣管理组',
        returnAddress: inlineMeta.returnAddress || `${asset.responsibleSite} 供应商回寄地址`,
        returnDate: inlineMeta.returnDate || event.businessDate,
        logisticsProvider: inlineMeta.logisticsProvider || '线下回寄',
        trackingNumber: inlineMeta.trackingNumber || input.sourceDocCode,
        modificationReason: inlineMeta.modificationReason || input.note || '',
        sampleAssetId: asset.sampleAssetId,
        sampleCode: asset.sampleCode,
        sampleLedgerEventId: event.ledgerEventId,
        sampleLedgerEventCode: event.ledgerEventCode,
        returnDocId: input.sourceDocId,
        returnDocCode: input.sourceDocCode,
      },
      sourceModule: input.sourceModule,
      sourceDocType: input.sourceDocType,
      sourceDocId: input.sourceDocId,
      sourceDocCode: input.sourceDocCode,
      upstreamRefs: [
        {
          refModule: '样衣资产',
          refType: '样衣资产',
          refId: asset.sampleAssetId,
          refCode: asset.sampleCode,
          refTitle: asset.sampleName,
          refStatus: asset.inventoryStatus,
        },
        {
          refModule: '样衣台账',
          refType: '样衣台账事件',
          refId: event.ledgerEventId,
          refCode: event.ledgerEventCode,
          refTitle: event.eventName,
          refStatus: event.inventoryStatusAfter,
        },
      ],
      downstreamRefs: [
        {
          refModule: '样衣退回单',
          refType: '样衣退回单',
          refId: input.sourceDocId,
          refCode: input.sourceDocCode,
          refTitle: input.note || '样衣退回单',
          refStatus: '已完成',
        },
      ],
      createdAt: event.businessDate,
      createdBy: event.operatorName,
      updatedAt: event.businessDate,
      updatedBy: event.operatorName,
      legacyProjectRef: input.legacyProjectRef || null,
      legacyWorkItemInstanceId: input.legacyWorkItemInstanceId || null,
    })
  }
}

export function recordSampleLedgerEvent(input: SampleLedgerWriteInput): SampleWritebackResult {
  const eventId = input.ledgerEventId || `${input.sourceDocCode || 'sample'}::${input.eventType}::${input.sampleCode}`
  const existingEvent = getSampleLedgerEventById(eventId)
  if (existingEvent) {
    const asset = getSampleAssetByCode(existingEvent.sampleCode)
    if (!asset) {
      throw new Error('样衣事件已存在，但未找到对应样衣资产。')
    }
    return {
      asset,
      event: existingEvent,
      targetNodeId: existingEvent.projectNodeId || null,
      pendingWritten: false,
    }
  }

  const eventTime = input.businessDate || nowText()
  const resolvedTarget = resolveTarget(input)
  const existingAsset = getSampleAssetByCode(input.sampleCode)
  const eventCode = input.ledgerEventCode || nextLedgerEventCode(input.eventType)
  const asset = upsertSampleAsset(
    buildOrUpdateAsset(existingAsset, input, resolvedTarget, eventId, input.eventType, eventTime),
  )
  const event = upsertSampleLedgerEvent(
    buildEventRecord(asset, existingAsset, input, resolvedTarget, eventId, eventCode, eventTime),
  )

  let pendingWritten = false
  if (resolvedTarget.pendingReason) {
    upsertSampleWritebackPendingItem(buildPendingItem(input, resolvedTarget.pendingReason))
    pendingWritten = true
  }

  if (resolvedTarget.projectId) {
    writeProjectRelations(asset, event, resolvedTarget)
    if (resolvedTarget.projectNodeId) {
      const currentNode = findProjectNodeById(resolvedTarget.projectId, resolvedTarget.projectNodeId)
      if (currentNode) {
        writeProjectNode(input, event, resolvedTarget)
        writeProjectInlineNodeRecord(input, asset, event, resolvedTarget)
      } else {
        upsertSampleWritebackPendingItem(buildPendingItem(input, '项目存在，但目标节点不存在。'))
        pendingWritten = true
      }
    }
    syncExistingProjectArchiveByProjectId(resolvedTarget.projectId, input.operatorName || '系统同步')
  }

  return {
    asset,
    event,
    targetNodeId: resolvedTarget.projectNodeId,
    pendingWritten,
  }
}

export function ensureSampleBootstrapInitialized(): void {
  if (canUseStorage() && localStorage.getItem(SAMPLE_BOOTSTRAP_MARKER_KEY) === 'done') return
  if (listSampleLedgerEvents().length > 0 || listSampleAssets().length > 0) {
    if (canUseStorage()) {
      localStorage.setItem(SAMPLE_BOOTSTRAP_MARKER_KEY, 'done')
    }
    return
  }

  createBootstrapSampleEventInputs().forEach((input) => {
    recordSampleLedgerEvent(input)
  })

  if (canUseStorage()) {
    localStorage.setItem(SAMPLE_BOOTSTRAP_MARKER_KEY, 'done')
  }
}
