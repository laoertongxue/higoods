import {
  listMaterialRequestDraftsByOrder,
  listMaterialRequests,
  listMaterialRequestsByOrder,
  type MaterialRequestDraftLine,
  type MaterialRequestProgressStatus,
  type MaterialRequestRecord,
} from './material-request-drafts.ts'
import {
  getRuntimeTaskById,
  isRuntimeTaskExecutionTask,
  listRuntimeExecutionTasks,
  listRuntimeTasksByBaseTaskId,
  type RuntimeExecutorKind,
  type RuntimeProcessTask,
  type RuntimeTaskScopeType,
} from './runtime-process-tasks.ts'

export type WarehouseExecutionDocType = 'ISSUE' | 'RETURN' | 'INTERNAL_TRANSFER'
export type WarehouseExecutionStatus =
  | 'PLANNED'
  | 'PREPARING'
  | 'PARTIALLY_PREPARED'
  | 'READY'
  | 'ISSUED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'PARTIALLY_RETURNED'
  | 'RETURNED'
  | 'CLOSED'

export type WarehouseExecutionTargetType = 'EXTERNAL_FACTORY' | 'WAREHOUSE_WORKSHOP'

export interface WarehouseExecutionLineBase {
  lineId: string
  docId: string
  materialCode?: string
  materialName: string
  materialSpec?: string
  unit: string
  plannedQty: number
  preparedQty: number
  shortQty: number
  skuCode?: string
  skuColor?: string
  skuSize?: string
  pieceName?: string
  pieceCountPerUnit?: number
  sourceType?: string
  sourceTaskId?: string
  sourceProcessCode?: string
}

export interface WarehouseIssueLine extends WarehouseExecutionLineBase {
  issuedQty: number
  returnedQty: number
  transferredQty: number
}

export interface WarehouseReturnLine extends WarehouseExecutionLineBase {
  issuedQty: number
  returnedQty: number
  transferredQty: number
}

export interface WarehouseInternalTransferLine extends WarehouseExecutionLineBase {
  issuedQty: number
  returnedQty: number
  transferredQty: number
}

interface WarehouseExecutionDocBase {
  id: string
  docNo: string
  docType: WarehouseExecutionDocType
  status: WarehouseExecutionStatus
  productionOrderId: string
  baseTaskId: string
  runtimeTaskId: string
  taskNo: string
  rootTaskNo?: string
  splitGroupId?: string
  splitFromTaskNo?: string
  isSplitResult?: boolean
  processCode: string
  processNameZh: string
  scopeType: RuntimeTaskScopeType
  scopeKey: string
  scopeLabel: string
  materialRequestNo?: string
  targetType: WarehouseExecutionTargetType
  targetFactoryId?: string
  targetFactoryName?: string
  executorKind: RuntimeExecutorKind
  warehouseId?: string
  warehouseName?: string
  createdAt: string
  updatedAt: string
  remark?: string
}

export interface WarehouseIssueOrder extends WarehouseExecutionDocBase {
  docType: 'ISSUE'
  lines: WarehouseIssueLine[]
}

export interface WarehouseReturnOrder extends WarehouseExecutionDocBase {
  docType: 'RETURN'
  lines: WarehouseReturnLine[]
}

export interface WarehouseInternalTransferOrder extends WarehouseExecutionDocBase {
  docType: 'INTERNAL_TRANSFER'
  lines: WarehouseInternalTransferLine[]
}

export type WarehouseExecutionDoc =
  | WarehouseIssueOrder
  | WarehouseReturnOrder
  | WarehouseInternalTransferOrder

export interface WarehouseExecutionSummaryByOrder {
  productionOrderId: string
  requestCount: number
  issueOrderCount: number
  returnOrderCount: number
  internalTransferCount: number
  plannedLineCount: number
  shortLineCount: number
  readyLineCount: number
  issuedLineCount: number
  returnedLineCount: number
  completionRate: number
  completenessRate: number
}

export interface WarehouseExecutionLineStatsByOrder {
  productionOrderId: string
  plannedLineCount: number
  shortLineCount: number
  readyLineCount: number
  issuedLineCount: number
  returnedLineCount: number
  totalPlannedQty: number
  totalCompletedQty: number
  totalPreparedQty: number
  totalShortQty: number
  completionRate: number
  completenessRate: number
}

const WAREHOUSE_SEEDS = [
  { id: 'WH-JKT-01', name: '雅加达中心仓' },
  { id: 'WH-TNG-01', name: '丹格朗仓库' },
  { id: 'WH-BKS-01', name: '勿加泗仓库' },
  { id: 'WH-BDG-01', name: '万隆仓库' },
] as const

function toTimeNumber(value: string | undefined): number {
  if (!value) return 0
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const ts = new Date(normalized).getTime()
  return Number.isFinite(ts) ? ts : 0
}

function sortByUpdatedAtDesc<T extends { updatedAt: string }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => toTimeNumber(b.updatedAt) - toTimeNumber(a.updatedAt))
}

function hashCode(text: string): number {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function clampQty(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value * 100) / 100)
}

function getWarehouseByOrder(orderId: string): { warehouseId: string; warehouseName: string } {
  const index = hashCode(orderId) % WAREHOUSE_SEEDS.length
  const warehouse = WAREHOUSE_SEEDS[index]
  return { warehouseId: warehouse.id, warehouseName: warehouse.name }
}

function inferProcessCodeByTaskType(taskType: MaterialRequestRecord['taskType']): string {
  if (taskType === 'PRINT') return 'PROC_PRINT'
  if (taskType === 'DYE') return 'PROC_DYE'
  if (taskType === 'CUT') return 'PROC_CUT'
  return 'PROC_SEW'
}

function resolveRuntimeTaskForRequest(request: MaterialRequestRecord): RuntimeProcessTask | null {
  const direct = getRuntimeTaskById(request.taskId)
  if (direct && isRuntimeTaskExecutionTask(direct)) return direct

  const byBase = listRuntimeTasksByBaseTaskId(request.taskId).filter((task) =>
    isRuntimeTaskExecutionTask(task),
  )
  if (byBase.length === 0) return null
  if (byBase.length === 1) return byBase[0]

  const assigned = byBase.filter((task) => Boolean(task.assignedFactoryId))
  if (assigned.length === 1) return assigned[0]

  const matchedByTaskNo = byBase.find((task) => (task.taskNo || task.taskId) === request.taskNo)
  if (matchedByTaskNo) return matchedByTaskNo

  const orderScope = byBase.find((task) => task.scopeType === 'ORDER')
  return orderScope ?? byBase[0]
}

function getDraftLinesForRequest(request: MaterialRequestRecord): MaterialRequestDraftLine[] {
  const drafts = listMaterialRequestDraftsByOrder(request.productionOrderNo)
  const draft = drafts.find(
    (item) =>
      item.taskId === request.taskId &&
      item.draftStatus === 'created' &&
      item.createdMaterialRequestNo === request.materialRequestNo,
  )

  if (!draft) return []
  return draft.lines.filter((line) => line.selected && line.confirmedQty > 0)
}

function mapRequestStatusToIssueStatus(
  requestStatus: MaterialRequestProgressStatus,
  targetType: WarehouseExecutionTargetType,
): WarehouseExecutionStatus {
  if (requestStatus === '待配料') return 'PREPARING'
  if (requestStatus === '待配送' || requestStatus === '待自提') return 'READY'

  // 已完成时，外部发料视为已发出，仓内流转视为已接收。
  return targetType === 'EXTERNAL_FACTORY' ? 'ISSUED' : 'RECEIVED'
}

function derivePreparedAndDoneQty(input: {
  plannedQty: number
  status: WarehouseExecutionStatus
  targetType: WarehouseExecutionTargetType
}): {
  preparedQty: number
  issuedQty: number
  transferredQty: number
} {
  const planned = clampQty(input.plannedQty)

  if (input.status === 'PREPARING') {
    const prepared = clampQty(planned * 0.6)
    return { preparedQty: prepared, issuedQty: 0, transferredQty: 0 }
  }

  if (input.status === 'PARTIALLY_PREPARED') {
    const prepared = clampQty(planned * 0.85)
    return { preparedQty: prepared, issuedQty: 0, transferredQty: 0 }
  }

  if (input.status === 'READY') {
    return { preparedQty: planned, issuedQty: 0, transferredQty: 0 }
  }

  if (input.targetType === 'EXTERNAL_FACTORY') {
    return { preparedQty: planned, issuedQty: planned, transferredQty: 0 }
  }

  return { preparedQty: planned, issuedQty: 0, transferredQty: planned }
}

function derivePieceName(line: MaterialRequestDraftLine): string | undefined {
  if (!line.pieceSummaryText) return undefined
  const first = line.pieceSummaryText.split('；')[0]?.trim()
  return first || undefined
}

function deriveSkuScope(line: MaterialRequestDraftLine, task: RuntimeProcessTask | null): {
  skuCode?: string
  skuColor?: string
  skuSize?: string
} {
  if (line.sourceSkuCodes && line.sourceSkuCodes.length === 1) {
    const skuCode = line.sourceSkuCodes[0]
    const matched = task?.scopeSkuLines.find((item) => item.skuCode === skuCode)
    return {
      skuCode,
      skuColor: matched?.color ?? task?.skuColor,
      skuSize: matched?.size ?? task?.skuSize,
    }
  }

  if (task?.scopeType === 'SKU') {
    return {
      skuCode: task.skuCode,
      skuColor: task.skuColor,
      skuSize: task.skuSize,
    }
  }

  return {}
}

function createIssueOrTransferFromRequest(
  request: MaterialRequestRecord,
): WarehouseIssueOrder | WarehouseInternalTransferOrder {
  const task = resolveRuntimeTaskForRequest(request)
  const lines = getDraftLinesForRequest(request)
  const { warehouseId, warehouseName } = getWarehouseByOrder(request.productionOrderNo)

  const targetType: WarehouseExecutionTargetType =
    task?.executorKind === 'WAREHOUSE_WORKSHOP' ? 'WAREHOUSE_WORKSHOP' : 'EXTERNAL_FACTORY'
  const status = mapRequestStatusToIssueStatus(request.requestStatus, targetType)

  const baseDoc = {
    productionOrderId: request.productionOrderNo,
    baseTaskId: task?.baseTaskId ?? request.taskId,
    runtimeTaskId: task?.taskId ?? request.taskId,
    taskNo: task?.taskNo ?? request.taskNo ?? request.taskId,
    rootTaskNo: task?.rootTaskNo ?? request.rootTaskNo,
    splitGroupId: task?.splitGroupId ?? request.splitGroupId,
    splitFromTaskNo: task?.splitFromTaskNo ?? request.splitFromTaskNo,
    isSplitResult: task?.isSplitResult ?? request.isSplitResult ?? false,
    processCode: task?.processCode ?? inferProcessCodeByTaskType(request.taskType),
    processNameZh: task?.processNameZh ?? request.taskName,
    scopeType: task?.scopeType ?? 'ORDER',
    scopeKey: task?.scopeKey ?? 'ORDER',
    scopeLabel: task?.scopeLabel ?? '整单',
    materialRequestNo: request.materialRequestNo,
    targetType,
    targetFactoryId: task?.assignedFactoryId,
    targetFactoryName: task?.assignedFactoryName,
    executorKind: task?.executorKind ?? (targetType === 'WAREHOUSE_WORKSHOP' ? 'WAREHOUSE_WORKSHOP' : 'EXTERNAL_FACTORY'),
    warehouseId,
    warehouseName,
    createdAt: request.updatedAt,
    updatedAt: request.updatedAt,
    remark:
      targetType === 'WAREHOUSE_WORKSHOP'
        ? '仓内后道执行，使用仓内流转单'
        : request.materialModeLabel,
  } as const

  if (targetType === 'EXTERNAL_FACTORY') {
    const id = `ISSUE-${request.materialRequestNo}`
    const docNo = `WL-${request.materialRequestNo}`
    const issueLines: WarehouseIssueLine[] = lines.map((line, index) => {
      const plannedQty = clampQty(line.confirmedQty)
      const qty = derivePreparedAndDoneQty({ plannedQty, status, targetType })
      const shortQty = clampQty(plannedQty - qty.preparedQty)
      const skuScope = deriveSkuScope(line, task)

      return {
        lineId: `${id}-L${String(index + 1).padStart(3, '0')}`,
        docId: id,
        materialCode: line.materialCode,
        materialName: line.materialName,
        materialSpec: line.materialSpec,
        unit: line.unit,
        plannedQty,
        preparedQty: qty.preparedQty,
        issuedQty: qty.issuedQty,
        returnedQty: 0,
        transferredQty: 0,
        shortQty,
        skuCode: skuScope.skuCode,
        skuColor: skuScope.skuColor,
        skuSize: skuScope.skuSize,
        pieceName: derivePieceName(line),
        pieceCountPerUnit: line.patternTotalPieceCount,
        sourceType: line.sourceType,
        sourceTaskId: task?.taskId ?? request.taskId,
        sourceProcessCode: task?.processCode,
      }
    })

    return {
      id,
      docNo,
      docType: 'ISSUE',
      status,
      ...baseDoc,
      lines: issueLines,
    }
  }

  const id = `TRANSFER-${request.materialRequestNo}`
  const docNo = `NL-${request.materialRequestNo}`
  const transferLines: WarehouseInternalTransferLine[] = lines.map((line, index) => {
    const plannedQty = clampQty(line.confirmedQty)
    const qty = derivePreparedAndDoneQty({ plannedQty, status, targetType })
    const shortQty = clampQty(plannedQty - qty.preparedQty)
    const skuScope = deriveSkuScope(line, task)

    return {
      lineId: `${id}-L${String(index + 1).padStart(3, '0')}`,
      docId: id,
      materialCode: line.materialCode,
      materialName: line.materialName,
      materialSpec: line.materialSpec,
      unit: line.unit,
      plannedQty,
      preparedQty: qty.preparedQty,
      issuedQty: 0,
      returnedQty: 0,
      transferredQty: qty.transferredQty,
      shortQty,
      skuCode: skuScope.skuCode,
      skuColor: skuScope.skuColor,
      skuSize: skuScope.skuSize,
      pieceName: derivePieceName(line),
      pieceCountPerUnit: line.patternTotalPieceCount,
      sourceType: line.sourceType,
      sourceTaskId: task?.taskId ?? request.taskId,
      sourceProcessCode: task?.processCode,
    }
  })

  return {
    id,
    docNo,
    docType: 'INTERNAL_TRANSFER',
    status,
    ...baseDoc,
    lines: transferLines,
  }
}

function deriveReturnStatus(task: RuntimeProcessTask): WarehouseExecutionStatus {
  if (task.status === 'DONE') return 'RETURNED'
  if (task.status === 'IN_PROGRESS' || task.status === 'BLOCKED') return 'IN_TRANSIT'
  if (task.status === 'CANCELLED') return 'CLOSED'
  return 'PLANNED'
}

function buildReturnOrdersForOrder(productionOrderId: string): WarehouseReturnOrder[] {
  const runtimeTasks = listRuntimeExecutionTasks().filter((task) => task.productionOrderId === productionOrderId)
  const { warehouseId, warehouseName } = getWarehouseByOrder(productionOrderId)

  return runtimeTasks
    .filter((task) => Boolean(task.assignedFactoryId && task.assignedFactoryName))
    .filter((task) => task.executorKind === 'EXTERNAL_FACTORY')
    .filter((task) => task.transitionToNext !== 'SAME_FACTORY_CONTINUE')
    .filter((task) => task.transitionToNext === 'RETURN_TO_WAREHOUSE' || task.transitionToNext === 'NOT_APPLICABLE')
    .map((task) => {
      const id = `RETURN-${task.taskId}`
      const docNo = `RH-${task.taskId}`
      const status = deriveReturnStatus(task)
      const plannedQty = clampQty(task.scopeQty)
      const returnedQty =
        status === 'RETURNED' || status === 'CLOSED'
          ? plannedQty
          : status === 'IN_TRANSIT'
            ? clampQty(plannedQty * 0.5)
            : 0

      const line: WarehouseReturnLine = {
        lineId: `${id}-L001`,
        docId: id,
        materialCode: `${task.processCode}-OUTPUT`,
        materialName: `${task.processNameZh}半成品回货`,
        materialSpec: task.scopeLabel,
        unit: task.qtyUnit,
        plannedQty,
        preparedQty: plannedQty,
        issuedQty: 0,
        returnedQty,
        transferredQty: 0,
        shortQty: clampQty(plannedQty - returnedQty),
        skuCode: task.skuCode,
        skuColor: task.skuColor,
        skuSize: task.skuSize,
        sourceType: 'upstream_output',
        sourceTaskId: task.taskId,
        sourceProcessCode: task.processCode,
      }

      return {
        id,
        docNo,
        docType: 'RETURN',
        status,
        productionOrderId,
        baseTaskId: task.baseTaskId,
        runtimeTaskId: task.taskId,
        taskNo: task.taskNo || task.taskId,
        rootTaskNo: task.rootTaskNo || task.taskNo || task.taskId,
        splitGroupId: task.splitGroupId,
        splitFromTaskNo: task.splitFromTaskNo,
        isSplitResult: task.isSplitResult === true,
        processCode: task.processCode,
        processNameZh: task.processNameZh,
        scopeType: task.scopeType,
        scopeKey: task.scopeKey,
        scopeLabel: task.scopeLabel,
        targetType: 'WAREHOUSE_WORKSHOP',
        targetFactoryId: task.assignedFactoryId,
        targetFactoryName: task.assignedFactoryName,
        executorKind: task.executorKind ?? 'EXTERNAL_FACTORY',
        warehouseId,
        warehouseName,
        createdAt: task.updatedAt,
        updatedAt: task.updatedAt,
        remark: '外部工序完成后回货入仓',
        lines: [line],
      }
    })
}

function buildExecutionDocuments(): {
  issueOrders: WarehouseIssueOrder[]
  returnOrders: WarehouseReturnOrder[]
  internalTransferOrders: WarehouseInternalTransferOrder[]
} {
  const requests = listMaterialRequests()
  const issueOrders: WarehouseIssueOrder[] = []
  const internalTransferOrders: WarehouseInternalTransferOrder[] = []

  requests.forEach((request) => {
    const doc = createIssueOrTransferFromRequest(request)
    if (doc.docType === 'ISSUE') {
      issueOrders.push(doc)
    } else {
      internalTransferOrders.push(doc)
    }
  })

  if (issueOrders.length === 0) {
    issueOrders.push({
      id: 'WIE-FALLBACK-001',
      docNo: 'LL-FALLBACK-001',
      docType: 'ISSUE',
      status: 'ISSUED',
      productionOrderId: 'PO-FALLBACK-001',
      baseTaskId: 'TASK-FALLBACK-001',
      runtimeTaskId: 'TASK-FALLBACK-001',
      taskNo: 'TASK-FALLBACK-001',
      processCode: 'SPECIAL_CRAFT',
      processNameZh: '特殊工艺',
      scopeType: 'ORDER',
      scopeKey: 'PO-FALLBACK-001',
      scopeLabel: 'PO-FALLBACK-001',
      targetType: 'EXTERNAL_FACTORY',
      targetFactoryId: 'ID-F002',
      targetFactoryName: 'PT Prima Printing Center',
      executorKind: 'EXTERNAL_FACTORY',
      warehouseId: WAREHOUSE_SEEDS[0].id,
      warehouseName: WAREHOUSE_SEEDS[0].name,
      createdAt: '2026-04-23 09:00:00',
      updatedAt: '2026-04-23 09:30:00',
      remark: '演示领料记录',
      lines: [
        {
          lineId: 'WIE-FALLBACK-001-L01',
          docId: 'WIE-FALLBACK-001',
          materialCode: 'FAB-FALLBACK-001',
          materialName: '特殊工艺裁片',
          materialSpec: '标准批次',
          unit: '片',
          plannedQty: 120,
          preparedQty: 120,
          shortQty: 0,
          skuCode: 'SKU-FALLBACK-001',
          skuColor: '标准色',
          skuSize: 'M',
          pieceName: '前片',
          pieceCountPerUnit: 1,
          sourceType: 'SPECIAL_CRAFT',
          sourceTaskId: 'TASK-FALLBACK-001',
          sourceProcessCode: 'SPECIAL_CRAFT',
          issuedQty: 120,
          returnedQty: 0,
          transferredQty: 0,
        },
      ],
    })
  }

  const orderIds = Array.from(
    new Set([
      ...requests.map((request) => request.productionOrderNo),
      ...issueOrders.map((order) => order.productionOrderId),
      ...internalTransferOrders.map((order) => order.productionOrderId),
    ]),
  )

  const returnOrders = orderIds.flatMap((orderId) => buildReturnOrdersForOrder(orderId))

  return {
    issueOrders: sortByUpdatedAtDesc(issueOrders),
    returnOrders: sortByUpdatedAtDesc(returnOrders),
    internalTransferOrders: sortByUpdatedAtDesc(internalTransferOrders),
  }
}

export function listWarehouseIssueOrders(): WarehouseIssueOrder[] {
  return buildExecutionDocuments().issueOrders
}

export function listWarehouseIssueOrdersByOrder(productionOrderId: string): WarehouseIssueOrder[] {
  return listWarehouseIssueOrders().filter((order) => order.productionOrderId === productionOrderId)
}

export function listWarehouseIssueOrdersByRuntimeTaskId(runtimeTaskId: string): WarehouseIssueOrder[] {
  return listWarehouseIssueOrders().filter((order) => order.runtimeTaskId === runtimeTaskId)
}

export function listWarehouseReturnOrders(): WarehouseReturnOrder[] {
  return buildExecutionDocuments().returnOrders
}

export function listWarehouseReturnOrdersByOrder(productionOrderId: string): WarehouseReturnOrder[] {
  return listWarehouseReturnOrders().filter((order) => order.productionOrderId === productionOrderId)
}

export function listWarehouseReturnOrdersByRuntimeTaskId(runtimeTaskId: string): WarehouseReturnOrder[] {
  return listWarehouseReturnOrders().filter((order) => order.runtimeTaskId === runtimeTaskId)
}

export function listWarehouseInternalTransferOrders(): WarehouseInternalTransferOrder[] {
  return buildExecutionDocuments().internalTransferOrders
}

export function listWarehouseInternalTransferOrdersByOrder(
  productionOrderId: string,
): WarehouseInternalTransferOrder[] {
  return listWarehouseInternalTransferOrders().filter((order) => order.productionOrderId === productionOrderId)
}

export function listWarehouseInternalTransferOrdersByRuntimeTaskId(
  runtimeTaskId: string,
): WarehouseInternalTransferOrder[] {
  return listWarehouseInternalTransferOrders().filter((order) => order.runtimeTaskId === runtimeTaskId)
}

export function listWarehouseExecutionDocsByOrder(productionOrderId: string): WarehouseExecutionDoc[] {
  const docs = [
    ...listWarehouseIssueOrdersByOrder(productionOrderId),
    ...listWarehouseReturnOrdersByOrder(productionOrderId),
    ...listWarehouseInternalTransferOrdersByOrder(productionOrderId),
  ]

  return docs.sort((a, b) => toTimeNumber(b.updatedAt) - toTimeNumber(a.updatedAt))
}

export function listWarehouseExecutionDocsByRuntimeTaskId(runtimeTaskId: string): WarehouseExecutionDoc[] {
  const docs = [
    ...listWarehouseIssueOrdersByRuntimeTaskId(runtimeTaskId),
    ...listWarehouseReturnOrdersByRuntimeTaskId(runtimeTaskId),
    ...listWarehouseInternalTransferOrdersByRuntimeTaskId(runtimeTaskId),
  ]
  return docs.sort((a, b) => toTimeNumber(b.updatedAt) - toTimeNumber(a.updatedAt))
}

export function getWarehouseExecutionDocById(docId: string, productionOrderId?: string): WarehouseExecutionDoc | null {
  const docs = productionOrderId
    ? listWarehouseExecutionDocsByOrder(productionOrderId)
    : ([
        ...listWarehouseIssueOrders(),
        ...listWarehouseReturnOrders(),
        ...listWarehouseInternalTransferOrders(),
      ] as WarehouseExecutionDoc[])

  return docs.find((doc) => doc.id === docId || doc.docNo === docId) ?? null
}

export function listWarehouseExecutionDocsByMaterialRequestNo(materialRequestNo: string): WarehouseExecutionDoc[] {
  const docs = [
    ...listWarehouseIssueOrders().filter((doc) => doc.materialRequestNo === materialRequestNo),
    ...listWarehouseInternalTransferOrders().filter((doc) => doc.materialRequestNo === materialRequestNo),
  ]
  return docs.sort((a, b) => toTimeNumber(b.updatedAt) - toTimeNumber(a.updatedAt))
}

function getDocLineMetrics(doc: WarehouseExecutionDoc): Array<{
  plannedQty: number
  preparedQty: number
  completedQty: number
  shortQty: number
  ready: boolean
  issued: boolean
  returned: boolean
}> {
  return doc.lines.map((line) => {
    const plannedQty = clampQty(line.plannedQty)
    const preparedQty = clampQty(line.preparedQty)
    const shortQty = clampQty(line.shortQty)

    if (doc.docType === 'RETURN') {
      const completedQty = clampQty(line.returnedQty)
      return {
        plannedQty,
        preparedQty,
        completedQty,
        shortQty,
        ready: false,
        issued: false,
        returned: completedQty >= plannedQty && plannedQty > 0,
      }
    }

    if (doc.docType === 'ISSUE') {
      const completedQty = clampQty(line.issuedQty)
      return {
        plannedQty,
        preparedQty,
        completedQty,
        shortQty,
        ready: preparedQty >= plannedQty && completedQty < plannedQty,
        issued: completedQty >= plannedQty && plannedQty > 0,
        returned: false,
      }
    }

    const completedQty = clampQty(line.transferredQty)
    return {
      plannedQty,
      preparedQty,
      completedQty,
      shortQty,
      ready: preparedQty >= plannedQty && completedQty < plannedQty,
      issued: completedQty >= plannedQty && plannedQty > 0,
      returned: false,
    }
  })
}

export function getWarehouseExecutionLineStatsByOrder(productionOrderId: string): WarehouseExecutionLineStatsByOrder {
  const docs = listWarehouseExecutionDocsByOrder(productionOrderId)

  let plannedLineCount = 0
  let shortLineCount = 0
  let readyLineCount = 0
  let issuedLineCount = 0
  let returnedLineCount = 0
  let totalPlannedQty = 0
  let totalCompletedQty = 0
  let totalPreparedQty = 0
  let totalShortQty = 0

  docs.forEach((doc) => {
    const metrics = getDocLineMetrics(doc)
    plannedLineCount += metrics.length
    shortLineCount += metrics.filter((item) => item.shortQty > 0).length
    readyLineCount += metrics.filter((item) => item.ready).length
    issuedLineCount += metrics.filter((item) => item.issued).length
    returnedLineCount += metrics.filter((item) => item.returned).length
    totalPlannedQty += metrics.reduce((sum, item) => sum + item.plannedQty, 0)
    totalCompletedQty += metrics.reduce((sum, item) => sum + item.completedQty, 0)
    totalPreparedQty += metrics.reduce((sum, item) => sum + item.preparedQty, 0)
    totalShortQty += metrics.reduce((sum, item) => sum + item.shortQty, 0)
  })

  const completionRate = totalPlannedQty > 0 ? Math.round((Math.min(totalCompletedQty, totalPlannedQty) / totalPlannedQty) * 100) : 0
  const completenessRate = totalPlannedQty > 0 ? Math.round(((totalPlannedQty - totalShortQty) / totalPlannedQty) * 100) : 0

  return {
    productionOrderId,
    plannedLineCount,
    shortLineCount,
    readyLineCount,
    issuedLineCount,
    returnedLineCount,
    totalPlannedQty,
    totalCompletedQty,
    totalPreparedQty,
    totalShortQty,
    completionRate,
    completenessRate,
  }
}

export function getWarehouseExecutionSummaryByOrder(productionOrderId: string): WarehouseExecutionSummaryByOrder {
  const issueOrderCount = listWarehouseIssueOrdersByOrder(productionOrderId).length
  const returnOrderCount = listWarehouseReturnOrdersByOrder(productionOrderId).length
  const internalTransferCount = listWarehouseInternalTransferOrdersByOrder(productionOrderId).length
  const lineStats = getWarehouseExecutionLineStatsByOrder(productionOrderId)

  return {
    productionOrderId,
    requestCount: listMaterialRequestsByOrder(productionOrderId).length,
    issueOrderCount,
    returnOrderCount,
    internalTransferCount,
    plannedLineCount: lineStats.plannedLineCount,
    shortLineCount: lineStats.shortLineCount,
    readyLineCount: lineStats.readyLineCount,
    issuedLineCount: lineStats.issuedLineCount,
    returnedLineCount: lineStats.returnedLineCount,
    completionRate: lineStats.completionRate,
    completenessRate: lineStats.completenessRate,
  }
}
