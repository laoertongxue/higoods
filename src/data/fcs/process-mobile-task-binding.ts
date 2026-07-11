import { buildFcsCuttingDomainSnapshot } from '../../domain/fcs-cutting-runtime/index.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'
import { listGeneratedCutOrderSourceRecords } from './cutting/generated-cut-orders.ts'
import {
  getDyeWorkOrderById,
  getDyeWorkOrderByTaskId,
  listDyeWorkOrders,
  type DyeWorkOrder,
} from './dyeing-task-domain.ts'
import {
  listPdaTaskFlowTasks,
  type PdaTaskFlowProjectedTask,
} from './pda-cutting-execution-source.ts'
import {
  getWoolWorkOrderById,
  getWoolWorkOrderByTaskId,
  listWoolMobileProcessTasks,
  listWoolWorkOrders,
  type WoolWorkOrder,
} from './wool-task-domain.ts'
import { listPdaGenericTasksByProcess } from './pda-task-mock-factory.ts'
import {
  getPostFinishingWorkOrderById,
  getPostFinishingTaskById,
  listPostFinishingTasks,
  type PostFinishingTaskView,
} from './post-finishing-domain.ts'
import type { ProcessTask } from './process-tasks.ts'
import {
  getPrintWorkOrderById,
  getPrintWorkOrderByTaskId,
  listPrintWorkOrders,
  type PrintWorkOrder,
} from './printing-task-domain.ts'
import {
  getSpecialCraftTaskOrderById,
  getSpecialCraftTaskWorkOrderById,
  listSpecialCraftTaskOrders,
  listSpecialCraftTaskWorkOrders,
  type SpecialCraftTaskOrder,
  type SpecialCraftTaskWorkOrder,
} from './special-craft-task-orders.ts'
import { applyPendingDispatchAutoAcceptance } from './runtime-process-tasks.ts'
import {
  getWaterSolubleWorkOrderById,
  getWaterSolubleWorkOrderByTaskId,
  listWaterSolubleMobileTasks,
  listWaterSolubleWorkOrders,
} from './water-soluble-task-domain.ts'

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
}

export type BindingReasonCode =
  | 'OK'
  | 'TASK_MISSING'
  | 'TASK_NOT_BOUND'
  | 'TASK_PROCESS_TYPE_MISMATCH'
  | 'TASK_FACTORY_MISMATCH'
  | 'TASK_NOT_ACCEPTED'
  | 'TASK_IN_BIDDING'
  | 'TASK_WAITING_AWARD'
  | 'TASK_REJECTED'
  | 'TASK_CLOSED'
  | 'TASK_NOT_VISIBLE_IN_MOBILE_LIST'
  | 'SOURCE_OBJECT_MISSING'
  | 'UNKNOWN'

export type MobileTaskProcessType =
  | 'PRINT'
  | 'DYE'
  | 'WATER_SOLUBLE'
  | 'CUTTING'
  | 'WOOL'
  | 'SPECIAL_CRAFT'
  | 'POST_FINISHING'
  | 'SEWING'
  | 'UNKNOWN'

export interface ProcessMobileTaskBindingResult {
  workOrderId: string
  workOrderNo: string
  processType: MobileTaskProcessType
  sourceType: string
  sourceId: string
  expectedTaskId: string
  expectedTaskNo: string
  actualTaskId: string
  actualTaskNo: string
  isBound: boolean
  isTaskFound: boolean
  isProcessTypeMatched: boolean
  isFactoryMatched: boolean
  isAcceptedOrExecutable: boolean
  isVisibleInMobileExecutionList: boolean
  canOpenMobileExecution: boolean
  canExecuteInMobile: boolean
  reasonCode: BindingReasonCode
  reasonLabel: string
  suggestedAction: string
}

interface ValidateBindingContext {
  workOrderId: string
  workOrderNo: string
  processType: MobileTaskProcessType
  sourceType: string
  sourceId: string
  expectedTaskId?: string
  expectedTaskNo?: string
  expectedFactoryId?: string
  expectedOperationName?: string
  sourceExists: boolean
  actualTask: ProcessTask | null
  currentFactoryId: string
  requireExactTaskId?: boolean
}

export interface ValidateProcessMobileTaskBindingParams {
  processType: MobileTaskProcessType
  sourceId: string
  taskId?: string
  currentFactoryId?: string
}

interface MobileTaskAccessResult {
  canOpenMobileExecution: boolean
  canExecuteInMobile: boolean
  reasonCode: BindingReasonCode
  reasonLabel: string
  suggestedAction: string
}

type GenericMobileTask = ProcessTask & {
  mockOrigin?: string
  cutOrderIds?: string[]
  cutOrderNos?: string[]
  processBusinessName?: string
  craftName?: string
  productionOrderNo?: string
  taskOrderId?: string
  taskOrderNo?: string
}

const EXECUTABLE_STATES = new Set(['待开工', '进行中', '生产暂停'])
const OPENABLE_STATES = new Set(['待开工', '进行中', '生产暂停', '已完工'])

export const ONBOARDING_CUTTING_DEMO_FACTORIES: ReadonlyArray<{ factoryId: string; factoryName: string }> = [
  { factoryId: 'FACTORY-ONBOARD-0034', factoryName: '定向裁演示工厂34' },
  { factoryId: 'FACTORY-ONBOARD-0035', factoryName: '定位裁演示工厂35' },
]

export function getOnboardingCuttingDemoFactoryName(factoryId: string): string {
  return ONBOARDING_CUTTING_DEMO_FACTORIES.find((factory) => factory.factoryId === factoryId)?.factoryName || ''
}

export function isOnboardingCuttingDemoFactory(factoryId: string): boolean {
  return Boolean(getOnboardingCuttingDemoFactoryName(factoryId))
}

function getTaskOrigin(task: ProcessTask): string {
  return String((task as GenericMobileTask).mockOrigin || '')
}

function mapPostFinishingStatusToTaskStatus(status: string): ProcessTask['status'] {
  if (status.includes('差异')) return 'BLOCKED'
  if (status.includes('中')) return 'IN_PROGRESS'
  if (status.includes('已交出') || status.includes('已回写') || status.includes('已完成')) return 'DONE'
  if (status === '待质检' || status === '待后道' || status === '待复检' || status === '待交出') return 'IN_PROGRESS'
  return 'NOT_STARTED'
}

function mapPostFinishingTaskToTask(task: PostFinishingTaskView, seq: number): ProcessTask {
  const isRejected = task.acceptanceStatus === 'REJECTED'
  return {
    taskId: task.postTaskId,
    taskNo: task.postTaskNo,
    rootTaskNo: task.postTaskNo,
    productionOrderId: task.productionOrderNo,
    seq,
    processCode: 'POST_FINISHING',
    processNameZh: '后道',
    stage: 'POST',
    qty: task.plannedGarmentQty,
    qtyUnit: 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: isRejected ? 'UNASSIGNED' : 'ASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['FINISHING'] },
    assignedFactoryId: task.managedPostFactoryId,
    assignedFactoryName: task.managedPostFactoryName,
    qcPoints: [],
    attachments: [],
    status: mapPostFinishingStatusToTaskStatus(task.currentStatus),
    acceptanceStatus: task.acceptanceStatus,
    acceptedAt: task.acceptedAt,
    acceptedBy: task.acceptedBy,
    dispatchedAt: task.createdAt,
    dispatchedBy: '系统',
    dispatchRemark: '生产单级后道任务同步到工厂端移动应用执行',
    acceptDeadline: task.createdAt,
    taskDeadline: task.updatedAt,
    receiverKind: 'MANAGED_POST_FACTORY',
    receiverId: task.managedPostFactoryId,
    receiverName: task.managedPostFactoryName,
    handoverStatus: task.waitHandoverQty > 0 ? 'OPEN' : task.currentStatus === '已完成' ? 'WRITTEN_BACK' : 'NOT_CREATED',
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    sourceProductionOrderId: task.productionOrderId,
    sourceTaskId: task.postTaskId,
    processBusinessName: '后道',
    taskScope: 'POST_ROLLUP_TASK',
    auditLogs: [
      {
        id: `AL-${task.postTaskId}-DISPATCH`,
        action: 'DISPATCH',
        detail: 'Web 后道任务派单到后道工厂',
        at: task.createdAt,
        by: '系统',
      },
      ...(task.acceptanceStatus === 'ACCEPTED' && task.acceptedAt
        ? [{
            id: `AL-${task.postTaskId}-ACCEPT`,
            action: 'ACCEPT_TASK',
            detail: '后道工厂确认接单',
            at: task.acceptedAt,
            by: task.acceptedBy || task.managedPostFactoryName,
          }]
        : []),
      ...(task.acceptanceStatus === 'REJECTED' && task.rejectedAt
        ? [{
            id: `AL-${task.postTaskId}-REJECT`,
            action: 'REJECT_TASK',
            detail: `后道工厂拒绝接单${task.rejectReason ? `：${task.rejectReason}` : ''}`,
            at: task.rejectedAt,
            by: task.rejectedBy || task.managedPostFactoryName,
          }]
        : []),
    ],
  }
}

export function listPostFinishingMobileExecutionTasks(): ProcessTask[] {
  return listPostFinishingTasks().map((task, index) => mapPostFinishingTaskToTask(task, index + 1))
}

function mapSpecialCraftExecutionStatus(status: string): ProcessTask['status'] {
  if (status === 'PROCESSING') return 'IN_PROGRESS'
  if (status === 'DIFFERENCE' || status === 'OBJECTION' || status === 'ABNORMAL') return 'BLOCKED'
  if (status === 'COMPLETED' || status === 'WAIT_HANDOVER' || status === 'HANDED_OVER' || status === 'WRITTEN_BACK') return 'DONE'
  return 'NOT_STARTED'
}

function mapSpecialCraftTaskOrderToMobileTask(taskOrder: SpecialCraftTaskOrder, seq: number): ProcessTask {
  const taskId = taskOrder.sourceTaskId || taskOrder.taskOrderId
  const taskNo = taskOrder.sourceTaskNo || taskOrder.taskOrderNo
  const isAssigned = taskOrder.assignmentStatus === 'ASSIGNED'
  const assignedFactoryId = isAssigned ? taskOrder.assignedFactoryId || taskOrder.factoryId : undefined
  const assignedFactoryName = isAssigned ? taskOrder.assignedFactoryName || taskOrder.factoryName : undefined
  return {
    taskId,
    taskNo,
    rootTaskNo: taskOrder.taskOrderNo,
    productionOrderId: taskOrder.productionOrderId,
    seq,
    processCode: 'SPECIAL_CRAFT',
    processNameZh: taskOrder.operationName,
    stage: 'SPECIAL',
    qty: taskOrder.planQty,
    qtyUnit: 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: isAssigned ? 'ASSIGNED' : 'UNASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['FINISHING'] },
    assignedFactoryId,
    assignedFactoryName,
    qcPoints: [],
    attachments: [],
    status: mapSpecialCraftExecutionStatus(taskOrder.executionStatus),
    acceptanceStatus: isAssigned ? 'ACCEPTED' : 'PENDING',
    acceptedAt: isAssigned ? taskOrder.createdAt : undefined,
    acceptedBy: isAssigned ? assignedFactoryName : undefined,
    dispatchedAt: taskOrder.createdAt,
    dispatchedBy: '系统',
    dispatchRemark: '特殊工艺任务同步到工厂端移动应用执行',
    taskDeadline: taskOrder.dueAt,
    processBusinessName: '特殊工艺',
    craftName: taskOrder.operationName,
    sourceTaskId: taskOrder.taskOrderId,
    createdAt: taskOrder.createdAt,
    updatedAt: taskOrder.updatedAt,
    auditLogs: [],
  }
}

function isSpecialCraftTask(task: ProcessTask): boolean {
  return getMobileTaskProcessType(task) === 'SPECIAL_CRAFT'
}

function listThirdPartyCuttingMarkerPreconditionTasks(existingTaskIds: Set<string>): ProcessTask[] {
  const groups = new Map<string, ReturnType<typeof listGeneratedCutOrderSourceRecords>>()
  listGeneratedCutOrderSourceRecords()
    .filter((record) => record.executionRoute === 'FACTORY_PDA')
    .forEach((record) => {
      const key = record.cuttingTaskId || record.productionOrderId
      groups.set(key, [...(groups.get(key) || []), record])
    })

  return Array.from(groups.entries())
    .filter(([taskId]) => !existingTaskIds.has(taskId))
    .map(([taskId, rows], index) => {
      const first = rows[0]
      const taskNo = first.cuttingTaskNo || taskId
      return {
        taskId,
        taskNo,
        productionOrderId: first.productionOrderId,
        seq: 1,
        processCode: 'PROC_CUT',
        processNameZh: '裁片',
        stage: 'CUTTING',
        qty: rows.reduce((total, row) => total + Number(row.requiredQty || 0), 0),
        qtyUnit: '件',
        assignmentMode: 'DIRECT',
        assignmentStatus: 'ASSIGNED',
        ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['CUTTING'] },
        assignedFactoryId: first.cuttingTaskAssigneeFactoryId,
        assignedFactoryName: first.cuttingTaskAssigneeFactoryName,
        qcPoints: ['按我方唛架方案裁剪', '裁后数量回传'],
        attachments: [],
        status: 'NOT_STARTED',
        acceptanceStatus: 'ACCEPTED',
        acceptedAt: '2026-04-03 10:05',
        acceptedBy: first.cuttingTaskAssigneeFactoryName,
        taskDeadline: '2026-04-08 18:00',
        dispatchedAt: '2026-04-03 10:00',
        dispatchedBy: '裁床计划',
        dispatchRemark: '三方裁片任务：我方裁床厂统一排唛架后，作为工厂端 PDA 执行前置信息。',
        processBusinessCode: 'CUT_PANEL',
        processBusinessName: '裁片',
        craftName: '三方裁片',
        rootTaskNo: taskNo,
        createdAt: '2026-04-03 10:00',
        updatedAt: '2026-04-03 10:00',
        auditLogs: [
          {
            id: `AL-${taskId}-marker-precondition`,
            action: 'MARKER_PRECONDITION_READY',
            detail: `已同步我方排唛架前置信息，关联 ${rows.length} 张裁片单。`,
            at: '2026-04-03 10:00',
            by: '系统',
          },
        ],
        productionOrderNo: first.productionOrderNo,
        cutOrderIds: uniqueStrings(rows.map((row) => row.cutOrderId)),
        cutOrderNos: uniqueStrings(rows.map((row) => row.cutOrderNo)),
        markerPlanNos: ['待我方唛架方案确认'],
        materialSku: uniqueStrings(rows.map((row) => row.materialSku)).join(' / '),
        spuCode: first.spuCode,
        spuName: first.styleName,
        mockReceiveSummary: '三方工厂按裁片任务接单，按唛架方案准备裁剪。',
        mockExecutionSummary: '执行前需查看我方裁床厂排好的唛架方案；不生成我方铺布单。',
        mockHandoverSummary: '若三方只做裁片，按任务交出回我方裁片厂；若三方继续车缝/后道，则产出为成衣。',
      } satisfies ProcessTask & {
        productionOrderNo: string
        cutOrderIds: string[]
        cutOrderNos: string[]
        markerPlanNos: string[]
        materialSku: string
        spuCode: string
        spuName: string
        mockReceiveSummary: string
        mockExecutionSummary: string
        mockHandoverSummary: string
      }
    })
}

export function listPdaMobileExecutionTasks(): ProcessTask[] {
  applyPendingDispatchAutoAcceptance()
  listPrintWorkOrders()
  listDyeWorkOrders()

  const waterSolubleTasks = listWaterSolubleMobileTasks()
  const waterSolubleArtifactIds = new Set(listWaterSolubleWorkOrders().map((order) => order.sourceArtifactId))
  const isSupersededWaterSolubleTask = (task: ProcessTask): boolean => {
    if (task.taskUnitType !== 'SINGLE_PROCESS_TASK') return false
    if (task.coveredProcesses?.length !== 1) return false
    const coveredProcess = task.coveredProcesses[0]
    if (coveredProcess.processCode !== 'WATER_SOLUBLE') return false
    return coveredProcess.sourceArtifactIds.length === 1
      && waterSolubleArtifactIds.has(coveredProcess.sourceArtifactIds[0])
  }
  const baseTasks = listPdaTaskFlowTasks().filter((task) =>
    !isSpecialCraftTask(task)
    && getMobileTaskProcessType(task) !== 'WOOL'
    && !isSupersededWaterSolubleTask(task),
  )
  const existingTaskIds = new Set(baseTasks.map((task) => task.taskId))
  const genericProcessTasks = [
    ...listPdaGenericTasksByProcess('PRINTING'),
    ...listPdaGenericTasksByProcess('DYEING'),
  ].filter((task) => !existingTaskIds.has(task.taskId) && !isSupersededWaterSolubleTask(task))
  const existingWithGeneric = new Set([...existingTaskIds, ...genericProcessTasks.map((task) => task.taskId)])
  const standaloneWaterSolubleTasks = waterSolubleTasks.filter((task) => !existingWithGeneric.has(task.taskId))
  const existingWithWaterSoluble = new Set([...existingWithGeneric, ...standaloneWaterSolubleTasks.map((task) => task.taskId)])
  const woolTasks = listWoolMobileProcessTasks().filter((task) => !existingWithWaterSoluble.has(task.taskId))
  const existingWithWool = new Set([...existingWithWaterSoluble, ...woolTasks.map((task) => task.taskId)])
  const specialCraftTasks = listSpecialCraftTaskOrders()
    .map((taskOrder, index) => mapSpecialCraftTaskOrderToMobileTask(taskOrder, baseTasks.length + genericProcessTasks.length + woolTasks.length + index + 1))
    .filter((task) => !existingWithWool.has(task.taskId))
  const existingWithSpecial = new Set([...existingWithWool, ...specialCraftTasks.map((task) => task.taskId)])
  const postTasks = listPostFinishingMobileExecutionTasks()
    .filter((task) => !existingWithSpecial.has(task.taskId))
  const existingWithPost = new Set([...existingWithSpecial, ...postTasks.map((task) => task.taskId)])
  const thirdPartyCuttingTasks = listThirdPartyCuttingMarkerPreconditionTasks(existingWithPost)
  return [...baseTasks, ...genericProcessTasks, ...standaloneWaterSolubleTasks, ...woolTasks, ...specialCraftTasks, ...postTasks, ...thirdPartyCuttingTasks]
}

export function getPdaMobileExecutionTaskById(taskId: string): ProcessTask | null {
  return listPdaMobileExecutionTasks().find((task) => task.taskId === taskId) ?? null
}

function classifyStructuredProcessCode(value: string | undefined | null): MobileTaskProcessType | null {
  const code = String(value || '').trim().toUpperCase()
  if (!code) return null
  if (code === 'WATER_SOLUBLE' || code === 'PROC_WATER_SOLUBLE') return 'WATER_SOLUBLE'
  if (code === 'DYE' || code === 'DYEING' || code === 'PROC_DYE') return 'DYE'
  if (code === 'PRINT' || code === 'PRINTING' || code === 'PROC_PRINT') return 'PRINT'
  if (code === 'CUTTING' || code === 'PROC_CUT' || code === 'PROC_CUTTING') return 'CUTTING'
  if (code === 'WOOL' || code === 'PROC_WOOL') return 'WOOL'
  if (code === 'POST_FINISHING' || code === 'POST_FINISH' || code === 'PROC_POST_FINISHING') return 'POST_FINISHING'
  if (code === 'SEWING' || code === 'SEW' || code === 'PROC_SEW') return 'SEWING'
  if (code === 'SPECIAL_CRAFT' || code === 'PROC_SPECIAL_CRAFT') return 'SPECIAL_CRAFT'
  return null
}

function classifyTaskBySource(task: ProcessTask): MobileTaskProcessType | null {
  const taskLike = task as GenericMobileTask
  if ((task.taskId.startsWith('TASK-WATER-') || 'waterOrderId' in taskLike) && getWaterSolubleWorkOrderByTaskId(task.taskId)) {
    return 'WATER_SOLUBLE'
  }
  if (task.taskId.startsWith('TASK-DYE-') && getDyeWorkOrderByTaskId(task.taskId)) return 'DYE'
  if (task.taskId.startsWith('TASK-PRINT-') && getPrintWorkOrderByTaskId(task.taskId)) return 'PRINT'
  if ((task.taskId.startsWith('TASK-WOOL-') || task.taskId.startsWith('WOOL-')) && getWoolWorkOrderByTaskId(task.taskId)) return 'WOOL'
  if ((task.processCode === 'POST_FINISHING' || task.taskId.startsWith('TASK-POST-'))
    && (getPostFinishingTaskById(task.taskId) || getPostFinishingWorkOrderById(task.taskId))) return 'POST_FINISHING'

  if (taskLike.cutOrderIds?.length || taskLike.cutOrderNos?.length) return 'CUTTING'
  if (listSpecialCraftTaskOrders().some((order) => order.sourceTaskId === task.taskId || order.taskOrderId === task.taskId)) {
    return 'SPECIAL_CRAFT'
  }
  return null
}

function classifyCoveredProcesses(task: ProcessTask): MobileTaskProcessType | null {
  const coveredTypes = new Set(
    (task.coveredProcesses || [])
      .map((process) => classifyStructuredProcessCode(process.processCode))
      .filter((type): type is MobileTaskProcessType => Boolean(type)),
  )
  if (coveredTypes.size === 2 && coveredTypes.has('DYE') && coveredTypes.has('WATER_SOLUBLE')) return 'DYE'
  if (coveredTypes.size === 1) return [...coveredTypes][0]
  return null
}

export function getMobileTaskProcessType(task: ProcessTask | null | undefined): MobileTaskProcessType {
  if (!task) return 'UNKNOWN'
  const explicitType = classifyStructuredProcessCode(task.processBusinessCode)
    || classifyStructuredProcessCode(task.processCode)
  if (explicitType) return explicitType

  const sourceType = classifyTaskBySource(task)
  if (sourceType) return sourceType

  const coveredType = classifyCoveredProcesses(task)
  if (coveredType) return coveredType

  const explicitFields = [
    task.processNameZh,
    (task as GenericMobileTask).processBusinessName,
  ]
    .filter(Boolean)
    .join(' ')
  const craftFields = [
    explicitFields,
    (task as GenericMobileTask).craftName,
    task.stage,
  ]
    .filter(Boolean)
    .join(' ')
  if (/PROC_PRINT|PRINT\b|印花|转印/.test(explicitFields)) return 'PRINT'
  if (/PROC_DYE|DYE\b|染色/.test(explicitFields)) return 'DYE'
  if (/PROC_WATER_SOLUBLE|WATER_SOLUBLE|水溶/.test(explicitFields)) return 'WATER_SOLUBLE'
  if (/PROC_CUT|CUTTING|裁片|定位裁/.test(explicitFields)) return 'CUTTING'
  if (/PROC_WOOL|WOOL|毛织|毛织/.test(explicitFields)) return 'WOOL'
  if (/POST_FINISH|后道/.test(explicitFields)) return 'POST_FINISHING'
  if (/SEW|车缝/.test(explicitFields)) return 'SEWING'
  if (/SPECIAL|特殊工艺|绣花|打揽|打条|激光切|烫画|直喷|捆条/.test(craftFields)) return 'SPECIAL_CRAFT'
  return 'UNKNOWN'
}

export function getMobileTaskFactoryId(task: ProcessTask | null | undefined): string {
  return String((task as GenericMobileTask | null | undefined)?.assignedFactoryId || '')
}

export function isMobileTaskFactoryMatched(
  task: ProcessTask | null | undefined,
  currentFactoryId = TEST_FACTORY_ID,
  expectedFactoryId?: string,
): boolean {
  if (!task) return false
  const taskFactoryId = getMobileTaskFactoryId(task)
  const expected = expectedFactoryId || currentFactoryId
  if (taskFactoryId === expected && taskFactoryId === currentFactoryId) return true
  return isOnboardingCuttingDemoFactory(currentFactoryId)
    && taskFactoryId === TEST_FACTORY_ID
    && (!expectedFactoryId || expectedFactoryId === TEST_FACTORY_ID || expectedFactoryId === currentFactoryId)
    && getMobileTaskProcessType(task) === 'CUTTING'
}

export function getMobileTaskAcceptanceState(task: ProcessTask | null | undefined): '待接单' | '已接单' | '已拒单' | '不适用' | '未知' {
  if (!task) return '未知'
  const origin = getTaskOrigin(task)
  if (origin === 'AWARDED_PENDING') return '待接单'
  if (origin.endsWith('REJECTED')) return '已拒单'
  if (task.acceptanceStatus === 'PENDING') return '待接单'
  if (task.acceptanceStatus === 'ACCEPTED') return '已接单'
  if (task.acceptanceStatus === 'REJECTED') return '已拒单'
  return '不适用'
}

export function getMobileTaskBiddingState(task: ProcessTask | null | undefined): '待报价' | '已报价' | '待定标' | '已中标' | '非报价任务' | '未知' {
  if (!task) return '未知'
  const origin = getTaskOrigin(task)
  if (origin === 'BIDDING_PENDING') return '待报价'
  if (origin === 'BIDDING_QUOTED') return '待定标'
  if (origin.startsWith('AWARDED')) return '已中标'
  if (task.assignmentStatus === 'BIDDING') return '已报价'
  if (task.assignmentStatus === 'AWARDED') return '已中标'
  return '非报价任务'
}

export function getMobileTaskExecutionState(task: ProcessTask | null | undefined): '待开工' | '进行中' | '生产暂停' | '已完工' | '已关闭' | '未知' {
  if (!task) return '未知'
  const origin = getTaskOrigin(task)
  if (task.status === 'CANCELLED' || origin.endsWith('CANCELLED')) return '已关闭'
  if (task.status === 'DONE') return '已完工'
  if (task.status === 'BLOCKED' || origin.endsWith('BLOCKED')) return '生产暂停'
  if (task.status === 'IN_PROGRESS') return '进行中'
  if (task.startedAt) return '进行中'
  if (task.status === 'NOT_STARTED') return '待开工'
  return '未知'
}

export function isTaskAccepted(task: ProcessTask | null | undefined): boolean {
  return getMobileTaskAcceptanceState(task) === '已接单'
}

export function isTaskInBiddingOrAwarding(task: ProcessTask | null | undefined): boolean {
  const biddingState = getMobileTaskBiddingState(task)
  return biddingState === '待报价' || biddingState === '已报价' || biddingState === '待定标'
}

function isTaskRejected(task: ProcessTask | null | undefined): boolean {
  return getMobileTaskAcceptanceState(task) === '已拒单' || getTaskOrigin(task as ProcessTask).endsWith('REJECTED')
}

function isTaskClosed(task: ProcessTask | null | undefined): boolean {
  return getMobileTaskExecutionState(task) === '已关闭'
}

export function isTaskExecutable(task: ProcessTask | null | undefined): boolean {
  if (!task || !isTaskAccepted(task) || isTaskRejected(task) || isTaskInBiddingOrAwarding(task) || isTaskClosed(task)) return false
  return EXECUTABLE_STATES.has(getMobileTaskExecutionState(task))
}

export function isTaskVisibleInMobileExecutionList(task: ProcessTask | null | undefined, currentFactoryId = TEST_FACTORY_ID): boolean {
  if (!task) return false
  if (!isMobileTaskFactoryMatched(task, currentFactoryId)) return false
  if (!isTaskAccepted(task)) return false
  if (isTaskRejected(task) || isTaskInBiddingOrAwarding(task) || isTaskClosed(task)) return false
  return OPENABLE_STATES.has(getMobileTaskExecutionState(task))
}

function isSpecialCraftOperationMatched(task: ProcessTask, expectedOperationName?: string): boolean {
  if (!expectedOperationName) return getMobileTaskProcessType(task) === 'SPECIAL_CRAFT'
  const haystack = [
    task.processNameZh,
    (task as GenericMobileTask).processBusinessName,
    (task as GenericMobileTask).craftName,
    task.taskNo,
    task.rootTaskNo,
  ]
    .filter(Boolean)
    .join(' ')
  return getMobileTaskProcessType(task) === 'SPECIAL_CRAFT' && haystack.includes(expectedOperationName)
}

function getReasonMeta(reasonCode: BindingReasonCode): { label: string; action: string } {
  const map: Record<BindingReasonCode, { label: string; action: string }> = {
    OK: { label: '绑定有效，可打开移动端执行页', action: '允许打开移动端执行页' },
    TASK_MISSING: { label: '移动端任务不存在', action: '补齐移动端任务或修正 taskId / taskNo' },
    TASK_NOT_BOUND: { label: '当前加工单尚未绑定移动端执行任务', action: '补充正确的 taskId / taskNo' },
    TASK_PROCESS_TYPE_MISMATCH: { label: '移动端任务工艺类型不匹配', action: '改绑同工艺的移动端任务' },
    TASK_FACTORY_MISMATCH: { label: '当前任务不属于当前工厂', action: '请切换到任务所属工厂账号后查看' },
    TASK_NOT_ACCEPTED: { label: '当前任务尚未接单，不能执行', action: '先在接单模块完成接单，再开放执行入口' },
    TASK_IN_BIDDING: { label: '当前任务仍在报价阶段，不能执行', action: '改绑已接单且可执行的移动端任务' },
    TASK_WAITING_AWARD: { label: '当前任务仍在待定标阶段，不能执行', action: '等待定标完成后再绑定执行任务' },
    TASK_REJECTED: { label: '当前任务已拒单或未中标，不能执行', action: '改绑有效执行任务' },
    TASK_CLOSED: { label: '当前任务已关闭或已作废，不能执行', action: '改绑有效执行任务' },
    TASK_NOT_VISIBLE_IN_MOBILE_LIST: { label: '当前任务不在移动端执行列表中', action: '检查工厂、接单状态和执行状态是否满足列表过滤规则' },
    SOURCE_OBJECT_MISSING: { label: '来源加工单不存在', action: '先修复来源对象，再重新校验绑定关系' },
    UNKNOWN: { label: '绑定校验失败', action: '检查任务主数据和绑定字段' },
  }
  return map[reasonCode]
}

export function getMobileTaskAccessResult(task: ProcessTask | null | undefined, currentFactoryId = TEST_FACTORY_ID): MobileTaskAccessResult {
  if (!task) {
    const reasonMeta = getReasonMeta('TASK_MISSING')
    return {
      canOpenMobileExecution: false,
      canExecuteInMobile: false,
      reasonCode: 'TASK_MISSING',
      reasonLabel: reasonMeta.label,
      suggestedAction: reasonMeta.action,
    }
  }
  let reasonCode: BindingReasonCode = 'OK'
  if (!isMobileTaskFactoryMatched(task, currentFactoryId)) {
    reasonCode = 'TASK_FACTORY_MISMATCH'
  } else if (isTaskRejected(task)) {
    reasonCode = 'TASK_REJECTED'
  } else if (isTaskClosed(task)) {
    reasonCode = 'TASK_CLOSED'
  } else if (getMobileTaskBiddingState(task) === '待定标') {
    reasonCode = 'TASK_WAITING_AWARD'
  } else if (isTaskInBiddingOrAwarding(task)) {
    reasonCode = 'TASK_IN_BIDDING'
  } else if (!isTaskAccepted(task)) {
    reasonCode = 'TASK_NOT_ACCEPTED'
  } else if (!isTaskVisibleInMobileExecutionList(task, currentFactoryId)) {
    reasonCode = 'TASK_NOT_VISIBLE_IN_MOBILE_LIST'
  }
  const reasonMeta = getReasonMeta(reasonCode)
  const canOpenMobileExecution = reasonCode === 'OK'
  return {
    canOpenMobileExecution,
    canExecuteInMobile: canOpenMobileExecution && EXECUTABLE_STATES.has(getMobileTaskExecutionState(task)),
    reasonCode,
    reasonLabel: reasonMeta.label,
    suggestedAction: reasonMeta.action,
  }
}

function validateBinding(context: ValidateBindingContext): ProcessMobileTaskBindingResult {
  const expectedTaskId = context.expectedTaskId || ''
  const expectedTaskNo = context.expectedTaskNo || ''
  const task = context.actualTask
  const actualTaskId = task?.taskId || ''
  const actualTaskNo = task?.taskNo || task?.taskId || ''
  const isTaskFound = Boolean(task)
  const isBound = Boolean(expectedTaskId || actualTaskId)
    && (!context.requireExactTaskId || Boolean(expectedTaskId && actualTaskId === expectedTaskId))
  const isProcessTypeMatched = task
    ? context.processType === 'SPECIAL_CRAFT'
      ? isSpecialCraftOperationMatched(task, context.expectedOperationName)
      : getMobileTaskProcessType(task) === context.processType
    : false
  const isFactoryMatched = task
    ? isMobileTaskFactoryMatched(task, context.currentFactoryId, context.expectedFactoryId)
    : false
  const isAcceptedOrExecutable = Boolean(task) && (isTaskAccepted(task) || isTaskExecutable(task))
  const isVisibleInMobileExecutionList = isTaskVisibleInMobileExecutionList(task, context.currentFactoryId)

  let reasonCode: BindingReasonCode = 'OK'
  if (!context.sourceExists) {
    reasonCode = 'SOURCE_OBJECT_MISSING'
  } else if (!expectedTaskId && !actualTaskId) {
    reasonCode = 'TASK_NOT_BOUND'
  } else if (!isTaskFound) {
    reasonCode = 'TASK_MISSING'
  } else if (!isBound) {
    reasonCode = 'TASK_NOT_BOUND'
  } else if (!isProcessTypeMatched) {
    reasonCode = 'TASK_PROCESS_TYPE_MISMATCH'
  } else if (!isFactoryMatched) {
    reasonCode = 'TASK_FACTORY_MISMATCH'
  } else if (isTaskRejected(task)) {
    reasonCode = 'TASK_REJECTED'
  } else if (isTaskClosed(task)) {
    reasonCode = 'TASK_CLOSED'
  } else if (getMobileTaskBiddingState(task) === '待定标') {
    reasonCode = 'TASK_WAITING_AWARD'
  } else if (isTaskInBiddingOrAwarding(task)) {
    reasonCode = 'TASK_IN_BIDDING'
  } else if (!isTaskAccepted(task)) {
    reasonCode = 'TASK_NOT_ACCEPTED'
  } else if (!isVisibleInMobileExecutionList) {
    reasonCode = 'TASK_NOT_VISIBLE_IN_MOBILE_LIST'
  }

  const reasonMeta = getReasonMeta(reasonCode)
  const canOpenMobileExecution = reasonCode === 'OK'

  return {
    workOrderId: context.workOrderId,
    workOrderNo: context.workOrderNo,
    processType: context.processType,
    sourceType: context.sourceType,
    sourceId: context.sourceId,
    expectedTaskId,
    expectedTaskNo,
    actualTaskId,
    actualTaskNo,
    isBound,
    isTaskFound,
    isProcessTypeMatched,
    isFactoryMatched,
    isAcceptedOrExecutable,
    isVisibleInMobileExecutionList,
    canOpenMobileExecution,
    canExecuteInMobile: canOpenMobileExecution && EXECUTABLE_STATES.has(getMobileTaskExecutionState(task)),
    reasonCode,
    reasonLabel: reasonMeta.label,
    suggestedAction: reasonMeta.action,
  }
}

function getPrintTask(order: PrintWorkOrder): ProcessTask | null {
  return order.taskId ? getPdaMobileExecutionTaskById(order.taskId) : null
}

function getDyeTask(order: DyeWorkOrder): ProcessTask | null {
  return order.taskId ? getPdaMobileExecutionTaskById(order.taskId) : null
}

function getWoolTask(order: WoolWorkOrder): ProcessTask | null {
  return getPdaMobileExecutionTaskById(order.taskNo)
}

function selectBestCuttingTask(orderId: string): ProcessTask | null {
  const cuttingTasks = listPdaMobileExecutionTasks()
    .filter((task) => getMobileTaskProcessType(task) === 'CUTTING')
    .filter((task) => {
      const taskLike = task as GenericMobileTask
      return taskLike.cutOrderIds?.includes(orderId) || taskLike.cutOrderNos?.includes(orderId)
    })
  const sorted = cuttingTasks.sort((left, right) => {
    const leftVisible = isTaskVisibleInMobileExecutionList(left, TEST_FACTORY_ID) ? 0 : 1
    const rightVisible = isTaskVisibleInMobileExecutionList(right, TEST_FACTORY_ID) ? 0 : 1
    if (leftVisible !== rightVisible) return leftVisible - rightVisible
    const rank = (task: ProcessTask) => {
      const state = getMobileTaskExecutionState(task)
      if (state === '待开工') return 0
      if (state === '进行中') return 1
      if (state === '生产暂停') return 2
      if (state === '已完工') return 3
      return 4
    }
    return rank(left) - rank(right)
  })
  return sorted[0] ?? null
}

function getSpecialCraftTaskOrderByTaskOrderId(taskOrderId: string): SpecialCraftTaskOrder | null {
  return getSpecialCraftTaskOrderById(taskOrderId) ?? null
}

export function validatePrintWorkOrderMobileTaskBinding(printOrderId: string): ProcessMobileTaskBindingResult {
  const order = getPrintWorkOrderById(printOrderId)
  return validateBinding({
    workOrderId: order?.printOrderId || printOrderId,
    workOrderNo: order?.printOrderNo || printOrderId,
    processType: 'PRINT',
    sourceType: 'PRINT_WORK_ORDER',
    sourceId: printOrderId,
    expectedTaskId: order?.taskId,
    expectedTaskNo: order?.taskNo,
    expectedFactoryId: order?.printFactoryId || TEST_FACTORY_ID,
    sourceExists: Boolean(order),
    actualTask: order ? getPrintTask(order) : null,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

export function validateDyeWorkOrderMobileTaskBinding(dyeOrderId: string): ProcessMobileTaskBindingResult {
  const order = getDyeWorkOrderById(dyeOrderId)
  return validateBinding({
    workOrderId: order?.dyeOrderId || dyeOrderId,
    workOrderNo: order?.dyeOrderNo || dyeOrderId,
    processType: 'DYE',
    sourceType: 'DYE_WORK_ORDER',
    sourceId: dyeOrderId,
    expectedTaskId: order?.taskId,
    expectedTaskNo: order?.taskNo,
    expectedFactoryId: order?.dyeFactoryId || TEST_FACTORY_ID,
    sourceExists: Boolean(order),
    actualTask: order ? getDyeTask(order) : null,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

export function validateWaterSolubleWorkOrderMobileTaskBinding(
  sourceId: string,
  options: { taskId?: string; currentFactoryId?: string } = {},
): ProcessMobileTaskBindingResult {
  const order = getWaterSolubleWorkOrderById(sourceId) ?? getWaterSolubleWorkOrderByTaskId(sourceId)
  const linkedOrder = order ? getWaterSolubleWorkOrderByTaskId(order.taskId) : null
  const sourceExists = Boolean(order && linkedOrder?.waterOrderId === order.waterOrderId)
  return validateBinding({
    workOrderId: order?.waterOrderId || sourceId,
    workOrderNo: order?.waterOrderNo || sourceId,
    processType: 'WATER_SOLUBLE',
    sourceType: 'WATER_SOLUBLE_WORK_ORDER',
    sourceId,
    expectedTaskId: order?.taskId,
    expectedTaskNo: order?.taskNo,
    expectedFactoryId: order?.factoryId,
    sourceExists,
    actualTask: options.taskId || order?.taskId
      ? getPdaMobileExecutionTaskById(options.taskId || order!.taskId)
      : null,
    currentFactoryId: options.currentFactoryId || order?.factoryId || TEST_FACTORY_ID,
    requireExactTaskId: true,
  })
}

export function validateWoolWorkOrderMobileTaskBinding(woolOrderId: string): ProcessMobileTaskBindingResult {
  const order = getWoolWorkOrderById(woolOrderId) ?? getWoolWorkOrderByTaskId(woolOrderId)
  return validateBinding({
    workOrderId: order?.woolOrderId || woolOrderId,
    workOrderNo: order?.woolOrderNo || woolOrderId,
    processType: 'WOOL',
    sourceType: 'WOOL_WORK_ORDER',
    sourceId: woolOrderId,
    expectedTaskId: order?.taskNo,
    expectedTaskNo: order?.taskNo,
    expectedFactoryId: order?.factoryId,
    sourceExists: Boolean(order),
    actualTask: order ? getWoolTask(order) : null,
    currentFactoryId: order?.factoryId || TEST_FACTORY_ID,
  })
}

export function validateCuttingOrderMobileTaskBinding(cuttingOrderId: string): ProcessMobileTaskBindingResult {
  const snapshot = buildFcsCuttingDomainSnapshot()
  const order = snapshot.cutOrders.find(
    (item) => item.cutOrderId === cuttingOrderId || item.cutOrderNo === cuttingOrderId,
  )
  const actualTask = selectBestCuttingTask(cuttingOrderId)
  return validateBinding({
    workOrderId: order?.cutOrderId || cuttingOrderId,
    workOrderNo: order?.cutOrderNo || cuttingOrderId,
    processType: 'CUTTING',
    sourceType: 'CUTTING_ORDER',
    sourceId: cuttingOrderId,
    expectedTaskId: actualTask?.taskId,
    expectedTaskNo: actualTask?.taskNo || actualTask?.taskId,
    expectedFactoryId: TEST_FACTORY_ID,
    sourceExists: Boolean(order),
    actualTask,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

export function validateSpecialCraftTaskOrderMobileTaskBinding(taskOrderId: string): ProcessMobileTaskBindingResult {
  const taskOrder = getSpecialCraftTaskOrderByTaskOrderId(taskOrderId)
  const expectedTaskId = taskOrder?.sourceTaskId || taskOrder?.taskOrderId
  return validateBinding({
    workOrderId: taskOrder?.taskOrderId || taskOrderId,
    workOrderNo: taskOrder?.taskOrderNo || taskOrderId,
    processType: 'SPECIAL_CRAFT',
    sourceType: 'SPECIAL_CRAFT_TASK_ORDER',
    sourceId: taskOrderId,
    expectedTaskId,
    expectedTaskNo: taskOrder?.sourceTaskNo || taskOrder?.taskOrderNo,
    expectedFactoryId: taskOrder?.factoryId || TEST_FACTORY_ID,
    expectedOperationName: taskOrder?.operationName,
    sourceExists: Boolean(taskOrder),
    actualTask: expectedTaskId ? getPdaMobileExecutionTaskById(expectedTaskId) : null,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

export function validateSpecialCraftMobileTaskBinding(workOrderId: string): ProcessMobileTaskBindingResult {
  const workOrder = getSpecialCraftTaskWorkOrderById(workOrderId)
  const taskOrder = workOrder ? getSpecialCraftTaskOrderByTaskOrderId(workOrder.taskOrderId) : null
  const expectedTaskId = taskOrder?.sourceTaskId || taskOrder?.taskOrderId
  return validateBinding({
    workOrderId: workOrder?.workOrderId || workOrderId,
    workOrderNo: workOrder?.workOrderNo || workOrderId,
    processType: 'SPECIAL_CRAFT',
    sourceType: 'SPECIAL_CRAFT_WORK_ORDER',
    sourceId: workOrderId,
    expectedTaskId,
    expectedTaskNo: taskOrder?.sourceTaskNo || taskOrder?.taskOrderNo,
    expectedFactoryId: workOrder?.factoryId || TEST_FACTORY_ID,
    expectedOperationName: workOrder?.operationName,
    sourceExists: Boolean(workOrder && taskOrder),
    actualTask: expectedTaskId ? getPdaMobileExecutionTaskById(expectedTaskId) : null,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

export function validatePostFinishingMobileTaskBinding(postOrderId: string): ProcessMobileTaskBindingResult {
  const task = getPostFinishingTaskById(postOrderId)
  const order = task ? undefined : getPostFinishingWorkOrderById(postOrderId)
  const expectedTaskId = task?.postTaskId || order?.postTaskId || order?.sourceTaskId || ''
  const expectedFactoryId = task?.managedPostFactoryId || order?.managedPostFactoryId || TEST_FACTORY_ID
  return validateBinding({
    workOrderId: task?.postTaskId || order?.postOrderId || postOrderId,
    workOrderNo: task?.postTaskNo || order?.postOrderNo || postOrderId,
    processType: 'POST_FINISHING',
    sourceType: task ? 'POST_FINISHING_TASK' : 'POST_FINISHING_WORK_ORDER',
    sourceId: postOrderId,
    expectedTaskId,
    expectedTaskNo: task?.postTaskNo || order?.postOrderNo || order?.sourceTaskNo,
    expectedFactoryId,
    sourceExists: Boolean(task || order),
    actualTask: expectedTaskId ? getPdaMobileExecutionTaskById(expectedTaskId) : null,
    currentFactoryId: expectedFactoryId,
  })
}

export function validateProcessMobileTaskBinding(params: ValidateProcessMobileTaskBindingParams): ProcessMobileTaskBindingResult {
  if (params.processType === 'PRINT') return validatePrintWorkOrderMobileTaskBinding(params.sourceId)
  if (params.processType === 'DYE') return validateDyeWorkOrderMobileTaskBinding(params.sourceId)
  if (params.processType === 'WATER_SOLUBLE') {
    return validateWaterSolubleWorkOrderMobileTaskBinding(params.sourceId, {
      taskId: params.taskId,
      currentFactoryId: params.currentFactoryId,
    })
  }
  if (params.processType === 'WOOL') return validateWoolWorkOrderMobileTaskBinding(params.sourceId)
  if (params.processType === 'CUTTING') return validateCuttingOrderMobileTaskBinding(params.sourceId)
  if (params.processType === 'SPECIAL_CRAFT') return validateSpecialCraftMobileTaskBinding(params.sourceId)
  if (params.processType === 'POST_FINISHING') return validatePostFinishingMobileTaskBinding(params.sourceId)
  return validateBinding({
    workOrderId: params.sourceId,
    workOrderNo: params.sourceId,
    processType: params.processType,
    sourceType: 'UNKNOWN',
    sourceId: params.sourceId,
    sourceExists: false,
    actualTask: null,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

function listKnownCuttingOrderIds(): string[] {
  const ids = new Set<string>()
  const snapshot = buildFcsCuttingDomainSnapshot()
  const cutOrders = Array.isArray(snapshot.cutOrders)
    ? snapshot.cutOrders
    : Object.values((snapshot as { cutOrdersById?: Record<string, { cutOrderId: string }> }).cutOrdersById || {})
  cutOrders.forEach((order) => ids.add(order.cutOrderId))
  return [...ids]
}

export function listInvalidProcessMobileTaskBindings(filter: { processType?: MobileTaskProcessType } = {}): ProcessMobileTaskBindingResult[] {
  const results: ProcessMobileTaskBindingResult[] = []
  if (!filter.processType || filter.processType === 'PRINT') {
    results.push(...listPrintWorkOrders().map((order) => validatePrintWorkOrderMobileTaskBinding(order.printOrderId)))
  }
  if (!filter.processType || filter.processType === 'DYE') {
    results.push(...listDyeWorkOrders().map((order) => validateDyeWorkOrderMobileTaskBinding(order.dyeOrderId)))
  }
  if (!filter.processType || filter.processType === 'WATER_SOLUBLE') {
    results.push(...listWaterSolubleWorkOrders()
      .map((order) => validateWaterSolubleWorkOrderMobileTaskBinding(order.waterOrderId)))
  }
  if (!filter.processType || filter.processType === 'WOOL') {
    results.push(...listWoolWorkOrders().map((order) => validateWoolWorkOrderMobileTaskBinding(order.woolOrderId)))
  }
  if (!filter.processType || filter.processType === 'CUTTING') {
    results.push(...listKnownCuttingOrderIds().map((orderId) => validateCuttingOrderMobileTaskBinding(orderId)))
  }
  if (!filter.processType || filter.processType === 'SPECIAL_CRAFT') {
    results.push(...listSpecialCraftTaskWorkOrders().map((workOrder) => validateSpecialCraftMobileTaskBinding(workOrder.workOrderId)))
  }
  if (!filter.processType || filter.processType === 'POST_FINISHING') {
    results.push(...listPostFinishingTasks().map((task) => validatePostFinishingMobileTaskBinding(task.postTaskId)))
  }
  return results.filter((item) => item.reasonCode !== 'OK')
}

export function assertValidProcessMobileTaskBinding(params: { processType: MobileTaskProcessType; sourceId: string }): ProcessMobileTaskBindingResult {
  const result = validateProcessMobileTaskBinding(params)
  if (!result.canOpenMobileExecution) {
    throw new Error(`${result.workOrderNo} 绑定校验失败：${result.reasonLabel}`)
  }
  return result
}

export const PROCESS_MOBILE_TASK_BINDING_DEMO_FACTORY = {
  factoryId: TEST_FACTORY_ID,
  factoryName: TEST_FACTORY_NAME,
}
