import {
  PRINT_WORK_ORDER_STATUS_LABEL,
  completeColorTest,
  completePrinting,
  completeTransfer,
  getPrintWorkOrderById,
  startColorTest,
  startPrinting,
  startTransfer,
  submitPrintHandover,
} from './printing-task-domain.ts'
import {
  DYE_WORK_ORDER_STATUS_LABEL,
  completeDyeMaterialReady,
  completeDyeMaterialWait,
  completeDyeNode,
  completeDyeSampleTest,
  completeDyeSampleWait,
  completeDyeing,
  getDyeWorkOrderById,
  planDyeVat,
  startDyeMaterialReady,
  startDyeSampleTest,
  startDyeing,
  submitDyeHandover,
} from './dyeing-task-domain.ts'
import { cutPieceOrderRecords, updateCutPieceOrderWebStage } from './cutting/cut-piece-orders.ts'
import { updateCuttingOrderProgressWebStage } from './cutting/order-progress.ts'
import { listSpreadingResultGeneratedFeiTicketsByCutOrderId } from './cutting/generated-fei-tickets.ts'
import {
  getSpecialCraftTaskWorkOrderById,
  updateSpecialCraftTaskWorkOrderWebStatus,
  type SpecialCraftTaskStatus,
} from './special-craft-task-orders.ts'
import {
  applyPostFinishingActionFinish,
  applyPostFinishingActionStart,
  getPostFinishingWorkOrderById,
  type PostFinishingActionType,
} from './post-finishing-domain.ts'
import {
  validateCuttingOrderMobileTaskBinding,
  validateDyeWorkOrderMobileTaskBinding,
  validatePostFinishingMobileTaskBinding,
  validatePrintWorkOrderMobileTaskBinding,
  validateSpecialCraftMobileTaskBinding,
} from './process-mobile-task-binding.ts'
import {
  createProcessHandoverDifferenceRecord,
  createProcessHandoverRecord,
  listWaitProcessWarehouseRecords,
} from './process-warehouse-domain.ts'
import { mapCraftStatusToPlatformStatus } from './process-platform-status-adapter.ts'
import { listFactoryDyeVatCapacities, listFactoryPrintMachineCapacities } from './factory-capacity-profile-mock.ts'
import {
  getProcessObjectType,
  getProcessQtyUnit,
  getQuantityLabel,
} from './process-quantity-labels.ts'
import { applyWarehouseLinkageAfterAction } from './process-warehouse-linkage-service.ts'
import {
  validateWaterSolublePdaActor,
  type WaterSolublePdaActor,
} from './water-soluble-pda-actor.ts'
import {
  advanceDyeWorkOrderOnlineStatus,
  assertDyeWorkOrderOnlineActionAllowed,
} from './dye-work-order-online-domain.ts'

export type ProcessActionSourceChannel = 'Web 端' | '移动端'
export type ProcessActionSourceType = 'PRINT' | 'DYE' | 'CUTTING' | 'SPECIAL_CRAFT' | 'POST_FINISHING'

export interface ProcessActionPayload {
  sourceChannel: ProcessActionSourceChannel
  sourceType: ProcessActionSourceType
  sourceId: string
  taskId?: string
  actionCode: string
  actionLabel?: string
  operatorName?: string
  operatedAt?: string
  objectType?: string
  objectQty?: number
  qtyUnit?: string
  qtyLabel?: string
  formData?: Record<string, string | number | boolean | undefined>
  remark?: string
  evidenceUrls?: string[]
  actor?: WaterSolublePdaActor
}

export interface ProcessActionWritebackResult {
  success: boolean
  sourceChannel: ProcessActionSourceChannel
  sourceType: ProcessActionSourceType
  sourceId: string
  taskId: string
  actionCode: string
  actionLabel: string
  previousStatus: string
  nextStatus: string
  updatedWorkOrderId: string
  updatedTaskId: string
  operationRecordId: string
  affectedExecutionNodeId: string
  affectedWarehouseRecordId: string
  affectedHandoverRecordId: string
  affectedReviewRecordId: string
  affectedDifferenceRecordId: string
  platformStatusAfter: string
  message: string
}

export interface ProcessActionOperationRecord {
  operationRecordId: string
  sourceChannel: ProcessActionSourceChannel
  sourceType: ProcessActionSourceType
  sourceId: string
  taskId: string
  actionCode: string
  actionLabel: string
  previousStatus: string
  nextStatus: string
  operatorName: string
  operatedAt: string
  objectType: string
  objectQty: number
  qtyUnit: string
  qtyLabel: string
  remark: string
  evidenceUrls: string[]
  relatedWarehouseRecordId: string
  relatedHandoverRecordId: string
  relatedReviewRecordId: string
  relatedDifferenceRecordId: string
}

export interface ProcessActionDefinition {
  actionCode: string
  actionLabel: string
  sourceType: ProcessActionSourceType
  fromStatuses: string[]
  toStatus: string
  requiredFields: string[]
  optionalFields?: string[]
  writebackHandler: string
  affectsWarehouse?: boolean
  affectsHandover?: boolean
  affectsReview?: boolean
  affectsDifference?: boolean
}

interface StatusSnapshot {
  status: string
  label: string
  qty: number
  unit: string
  taskId: string
  workOrderNo: string
}

const DEFAULT_OPERATED_AT = '2026-04-28 10:00'

const processActionOperationRecords: ProcessActionOperationRecord[] = []

const ACTION_CODE_ALIASES: Record<string, string> = {
  CONFIRM_PRINT_ARTWORK: 'PRINT_PATTERN_READY',
  COMPLETE_PRINT_COLOR_TEST: 'PRINT_COLOR_TEST_DONE',
  START_PRINT: 'PRINT_START_PRINTING',
  FINISH_PRINT: 'PRINT_FINISH_PRINTING',
  START_TRANSFER: 'PRINT_START_TRANSFER',
  FINISH_TRANSFER: 'PRINT_FINISH_TRANSFER',
  SUBMIT_PRINT_HANDOVER: 'PRINT_SUBMIT_HANDOVER',
  CONFIRM_DYE_SAMPLE_READY: 'DYE_SAMPLE_RECEIVED',
  START_DYE_SAMPLE: 'DYE_START_SAMPLE',
  FINISH_DYE_SAMPLE: 'DYE_FINISH_SAMPLE',
  CONFIRM_DYE_MATERIAL_READY: 'DYE_MATERIAL_RECEIVED',
  COMPLETE_DYE_PREP: 'DYE_FINISH_PREPARE',
  PLAN_DYE_VAT: 'DYE_SCHEDULE_VAT',
  START_DYE: 'DYE_START_DYEING',
  FINISH_DYE: 'DYE_FINISH_DYEING',
  FINISH_DEHYDRATE: 'DYE_FINISH_DEHYDRATION',
  FINISH_DRY: 'DYE_FINISH_DRYING',
  FINISH_SET: 'DYE_FINISH_SETTING',
  FINISH_ROLL: 'DYE_FINISH_ROLLING',
  FINISH_PACK: 'DYE_FINISH_PACKING',
  SUBMIT_DYE_HANDOVER: 'DYE_SUBMIT_HANDOVER',
  CONFIRM_CUTTING_PICKUP: 'CUTTING_CONFIRM_PICKUP',
  START_SPREADING: 'CUTTING_START_SPREADING',
  FINISH_SPREADING: 'CUTTING_FINISH_SPREADING',
  START_CUTTING: 'CUTTING_START_CUTTING',
  FINISH_CUTTING: 'CUTTING_FINISH_CUTTING',
  GENERATE_FEI_TICKET: 'CUTTING_GENERATE_FEI_TICKETS',
  CONFIRM_CUTTING_INBOUND: 'CUTTING_CONFIRM_INBOUND',
  SUBMIT_CUTTING_HANDOVER: 'CUTTING_SUBMIT_HANDOVER',
  CONFIRM_SPECIAL_RECEIVE: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  START_SPECIAL_PROCESS: 'SPECIAL_CRAFT_START_PROCESS',
  FINISH_SPECIAL_PROCESS: 'SPECIAL_CRAFT_FINISH_PROCESS',
  REPORT_SPECIAL_DIFFERENCE: 'SPECIAL_CRAFT_REPORT_DIFFERENCE',
  SUBMIT_SPECIAL_HANDOVER: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
}

export const PROCESS_ACTION_DEFINITIONS: ProcessActionDefinition[] = [
  {
    actionCode: 'PRINT_PATTERN_READY',
    actionLabel: '确认花型到位',
    sourceType: 'PRINT',
    fromStatuses: ['WAIT_ARTWORK'],
    toStatus: 'WAIT_COLOR_TEST',
    requiredFields: ['操作人', '花型号或花型版本', '操作时间'],
    optionalFields: ['备注'],
    writebackHandler: 'executePrintAction.startColorTest',
  },
  {
    actionCode: 'PRINT_COLOR_TEST_DONE',
    actionLabel: '完成调色测试',
    sourceType: 'PRINT',
    fromStatuses: ['WAIT_COLOR_TEST', 'COLOR_TEST_DONE'],
    toStatus: 'WAIT_PRINT',
    requiredFields: ['操作人', '调色结果', '操作时间'],
    writebackHandler: 'executePrintAction.completeColorTest',
  },
  {
    actionCode: 'PRINT_START_PRINTING',
    actionLabel: '开始打印',
    sourceType: 'PRINT',
    fromStatuses: ['WAIT_PRINT'],
    toStatus: 'PRINTING',
    requiredFields: ['操作人', '打印机编号', '开始时间'],
    writebackHandler: 'executePrintAction.startPrinting',
  },
  {
    actionCode: 'PRINT_FINISH_PRINTING',
    actionLabel: '完成打印',
    sourceType: 'PRINT',
    fromStatuses: ['PRINTING'],
    toStatus: 'WAIT_TRANSFER',
    requiredFields: ['操作人', '完成时间', '打印完成面料米数', '单位', '打印机编号'],
    writebackHandler: 'executePrintAction.completePrinting',
  },
  {
    actionCode: 'PRINT_START_TRANSFER',
    actionLabel: '开始转印',
    sourceType: 'PRINT',
    fromStatuses: ['PRINT_DONE', 'WAIT_TRANSFER'],
    toStatus: 'TRANSFERRING',
    requiredFields: ['操作人', '开始时间', '领料记录'],
    writebackHandler: 'executePrintAction.startTransfer',
  },
  {
    actionCode: 'PRINT_FINISH_TRANSFER',
    actionLabel: '完成转印',
    sourceType: 'PRINT',
    fromStatuses: ['TRANSFERRING'],
    toStatus: 'WAIT_HANDOVER',
    requiredFields: ['操作人', '完成时间', '转印完成面料米数', '完成卷数', '每卷长度', '单位'],
    writebackHandler: 'executePrintAction.completeTransfer',
  },
  {
    actionCode: 'PRINT_SUBMIT_HANDOVER',
    actionLabel: '发起交出',
    sourceType: 'PRINT',
    fromStatuses: ['WAIT_HANDOVER'],
    toStatus: 'HANDOVER_WAIT_RECEIVE',
    requiredFields: ['交出人', '交出时间', '交出面料米数', '单位'],
    optionalFields: ['包装数量', '备注'],
    writebackHandler: 'executePrintAction.submitPrintHandover',
    affectsHandover: true,
  },
  {
    actionCode: 'DYE_SAMPLE_RECEIVED',
    actionLabel: '确认样衣到位',
    sourceType: 'DYE',
    fromStatuses: ['WAIT_SAMPLE'],
    toStatus: 'SAMPLE_TESTING',
    requiredFields: ['操作人', '样衣到位时间', '备注'],
    writebackHandler: 'executeDyeAction.completeDyeSampleWait',
  },
  {
    actionCode: 'DYE_START_SAMPLE',
    actionLabel: '开始打样',
    sourceType: 'DYE',
    fromStatuses: ['WAIT_SAMPLE', 'SAMPLE_DONE'],
    toStatus: 'SAMPLE_TESTING',
    requiredFields: ['操作人', '开始时间'],
    writebackHandler: 'executeDyeAction.startDyeSampleTest',
  },
  {
    actionCode: 'DYE_FINISH_SAMPLE',
    actionLabel: '完成打样',
    sourceType: 'DYE',
    fromStatuses: ['SAMPLE_TESTING'],
    toStatus: 'SAMPLE_DONE',
    requiredFields: ['操作人', '完成时间', '色号', '打样结果'],
    writebackHandler: 'executeDyeAction.completeDyeSampleTest',
  },
  {
    actionCode: 'DYE_MATERIAL_RECEIVED',
    actionLabel: '确认原料到位',
    sourceType: 'DYE',
    fromStatuses: ['WAIT_MATERIAL'],
    toStatus: 'MATERIAL_READY',
    requiredFields: ['操作人', '原料面料 SKU', '到位面料米数', '到位卷数', '到位时间'],
    writebackHandler: 'executeDyeAction.completeDyeMaterialWait',
  },
  {
    actionCode: 'DYE_FINISH_PREPARE',
    actionLabel: '完成备料',
    sourceType: 'DYE',
    fromStatuses: ['WAIT_MATERIAL', 'MATERIAL_READY'],
    toStatus: 'MATERIAL_READY',
    requiredFields: ['操作人', '备料面料米数', '备料卷数', '完成时间'],
    writebackHandler: 'executeDyeAction.completeDyeMaterialReady',
  },
  {
    actionCode: 'DYE_SCHEDULE_VAT',
    actionLabel: '排染缸',
    sourceType: 'DYE',
    fromStatuses: ['SAMPLE_DONE', 'MATERIAL_READY', 'WAIT_VAT_PLAN'],
    toStatus: 'WAIT_VAT_PLAN',
    requiredFields: ['操作人', '染缸号', '排缸时间', '染缸容量'],
    writebackHandler: 'executeDyeAction.planDyeVat',
  },
  {
    actionCode: 'DYE_START_DYEING',
    actionLabel: '开始染色',
    sourceType: 'DYE',
    fromStatuses: ['WAIT_VAT_PLAN'],
    toStatus: 'DYEING',
    requiredFields: ['操作人', '开始时间', '染缸号'],
    writebackHandler: 'executeDyeAction.startDyeing',
  },
  {
    actionCode: 'DYE_FINISH_DYEING',
    actionLabel: '完成染色',
    sourceType: 'DYE',
    fromStatuses: ['DYEING'],
    toStatus: 'DEHYDRATING',
    requiredFields: ['操作人', '完成时间', '染色完成面料米数'],
    writebackHandler: 'executeDyeAction.completeDyeing',
  },
  {
    actionCode: 'DYE_FINISH_DEHYDRATION',
    actionLabel: '完成脱水',
    sourceType: 'DYE',
    fromStatuses: ['DEHYDRATING'],
    toStatus: 'DRYING',
    requiredFields: ['操作人', '完成时间', '完成面料米数'],
    writebackHandler: 'executeDyeAction.completeDyeNode',
  },
  {
    actionCode: 'DYE_FINISH_DRYING',
    actionLabel: '完成烘干',
    sourceType: 'DYE',
    fromStatuses: ['DRYING'],
    toStatus: 'SETTING',
    requiredFields: ['操作人', '完成时间', '完成面料米数'],
    writebackHandler: 'executeDyeAction.completeDyeNode',
  },
  {
    actionCode: 'DYE_FINISH_SETTING',
    actionLabel: '完成定型',
    sourceType: 'DYE',
    fromStatuses: ['SETTING'],
    toStatus: 'ROLLING',
    requiredFields: ['操作人', '完成时间', '完成面料米数'],
    writebackHandler: 'executeDyeAction.completeDyeNode',
  },
  {
    actionCode: 'DYE_FINISH_ROLLING',
    actionLabel: '完成打卷',
    sourceType: 'DYE',
    fromStatuses: ['ROLLING'],
    toStatus: 'PACKING',
    requiredFields: ['操作人', '完成时间', '完成面料米数', '卷数'],
    writebackHandler: 'executeDyeAction.completeDyeNode',
  },
  {
    actionCode: 'DYE_FINISH_PACKING',
    actionLabel: '完成包装',
    sourceType: 'DYE',
    fromStatuses: ['PACKING'],
    toStatus: 'WAIT_HANDOVER',
    requiredFields: ['操作人', '完成时间', '包装完成面料米数', '包装卷数', '每卷长度'],
    writebackHandler: 'executeDyeAction.completeDyeNode',
  },
  {
    actionCode: 'DYE_SUBMIT_HANDOVER',
    actionLabel: '发起交出',
    sourceType: 'DYE',
    fromStatuses: ['WAIT_HANDOVER'],
    toStatus: 'HANDOVER_WAIT_RECEIVE',
    requiredFields: ['交出人', '交出时间', '交出面料米数', '交出卷数'],
    optionalFields: ['备注'],
    writebackHandler: 'executeDyeAction.submitDyeHandover',
    affectsHandover: true,
  },
  {
    actionCode: 'CUTTING_CONFIRM_PICKUP',
    actionLabel: '确认领料',
    sourceType: 'CUTTING',
    fromStatuses: ['待领料'],
    toStatus: '待铺布',
    requiredFields: ['领料人', '领料时间', '实领面料米数', '备注'],
    writebackHandler: 'executeCuttingAction.updateCutPieceOrderWebStage',
  },
  {
    actionCode: 'CUTTING_START_SPREADING',
    actionLabel: '开始铺布',
    sourceType: 'CUTTING',
    fromStatuses: ['待铺布'],
    toStatus: '铺布中',
    requiredFields: ['操作人', '开始时间', '裁床组'],
    writebackHandler: 'executeCuttingAction.updateCutPieceOrderWebStage',
  },
  {
    actionCode: 'CUTTING_FINISH_SPREADING',
    actionLabel: '完成铺布',
    sourceType: 'CUTTING',
    fromStatuses: ['铺布中'],
    toStatus: '待裁剪',
    requiredFields: ['操作人', '完成时间', '铺布层数', '铺布实际长度', '单位'],
    writebackHandler: 'executeCuttingAction.updateCutPieceOrderWebStage',
  },
  {
    actionCode: 'CUTTING_START_CUTTING',
    actionLabel: '开始裁剪',
    sourceType: 'CUTTING',
    fromStatuses: ['待裁剪'],
    toStatus: '裁剪中',
    requiredFields: ['操作人', '开始时间', '裁床组'],
    writebackHandler: 'executeCuttingAction.updateCutPieceOrderWebStage',
  },
  {
    actionCode: 'CUTTING_FINISH_CUTTING',
    actionLabel: '完成裁剪',
    sourceType: 'CUTTING',
    fromStatuses: ['裁剪中'],
    toStatus: '裁剪完成',
    requiredFields: ['操作人', '完成时间', '已裁裁片数量'],
    writebackHandler: 'executeCuttingAction.updateCutPieceOrderWebStage',
  },
  {
    actionCode: 'CUTTING_GENERATE_FEI_TICKETS',
    actionLabel: '生成菲票',
    sourceType: 'CUTTING',
    fromStatuses: ['裁剪完成', '待菲票'],
    toStatus: '菲票已生成',
    requiredFields: ['操作人', '生成时间', '生成菲票数量'],
    writebackHandler: 'executeCuttingAction.updateCutPieceOrderWebStage',
  },
  {
    actionCode: 'CUTTING_CONFIRM_INBOUND',
    actionLabel: '确认入裁片仓',
    sourceType: 'CUTTING',
    fromStatuses: ['待入仓', '菲票已生成'],
    toStatus: '待交出',
    requiredFields: ['入仓人', '入仓时间', '入仓裁片数量', '仓位'],
    writebackHandler: 'executeCuttingAction.updateCutPieceOrderWebStage',
    affectsWarehouse: true,
  },
  {
    actionCode: 'CUTTING_SUBMIT_HANDOVER',
    actionLabel: '发起交出',
    sourceType: 'CUTTING',
    fromStatuses: ['待交出'],
    toStatus: '交出待收货',
    requiredFields: ['交出人', '交出时间', '交出裁片数量', '备注'],
    writebackHandler: 'executeCuttingAction.createProcessHandoverRecord',
    affectsHandover: true,
  },
  {
    actionCode: 'CUTTING_REWORK_AFTER_REJECT',
    actionLabel: '标记差异后重交',
    sourceType: 'CUTTING',
    fromStatuses: ['收货差异', '有差异'],
    toStatus: '待交出',
    requiredFields: ['操作人', '操作时间', '重交原因'],
    writebackHandler: 'executeCuttingAction.updateCutPieceOrderWebStage',
  },
  {
    actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
    actionLabel: '确认接收裁片',
    sourceType: 'SPECIAL_CRAFT',
    fromStatuses: ['待接收', '待领料', '已入待加工仓'],
    toStatus: '已入待加工仓',
    requiredFields: ['接收人', '接收时间', '接收裁片数量', '关联菲票'],
    optionalFields: ['备注'],
    writebackHandler: 'executeSpecialCraftAction.updateSpecialCraftTaskWorkOrderWebStatus',
  },
  {
    actionCode: 'SPECIAL_CRAFT_START_PROCESS',
    actionLabel: '开始加工',
    sourceType: 'SPECIAL_CRAFT',
    fromStatuses: ['已接收', '待加工', '已入待加工仓'],
    toStatus: '加工中',
    requiredFields: ['操作人', '开始时间'],
    writebackHandler: 'executeSpecialCraftAction.updateSpecialCraftTaskWorkOrderWebStatus',
  },
  {
    actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
    actionLabel: '完成加工',
    sourceType: 'SPECIAL_CRAFT',
    fromStatuses: ['加工中'],
    toStatus: '待交出',
    requiredFields: ['操作人', '完成时间', '加工完成裁片数量'],
    writebackHandler: 'executeSpecialCraftAction.updateSpecialCraftTaskWorkOrderWebStatus',
  },
  {
    actionCode: 'SPECIAL_CRAFT_REPORT_DIFFERENCE',
    actionLabel: '上报差异',
    sourceType: 'SPECIAL_CRAFT',
    fromStatuses: ['已接收', '已入待加工仓', '加工中', '加工完成', '待交出'],
    toStatus: '差异',
    requiredFields: ['上报人', '差异类型', '应收裁片数量', '实收裁片数量', '差异裁片数量', '关联菲票', '原因'],
    optionalFields: ['证据'],
    writebackHandler: 'executeSpecialCraftAction.createProcessHandoverDifferenceRecord',
    affectsDifference: true,
  },
  {
    actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
    actionLabel: '发起交出',
    sourceType: 'SPECIAL_CRAFT',
    fromStatuses: ['加工完成', '待交出'],
    toStatus: '交出待收货',
    requiredFields: ['交出人', '交出时间', '交出裁片数量', '关联菲票'],
    optionalFields: ['备注'],
    writebackHandler: 'executeSpecialCraftAction.createProcessHandoverRecord',
    affectsHandover: true,
  },
  {
    actionCode: 'SPECIAL_CRAFT_REWORK_AFTER_REJECT',
    actionLabel: '差异后重交',
    sourceType: 'SPECIAL_CRAFT',
    fromStatuses: ['差异', '异议中', '异常', '交出待收货', '收货差异'],
    toStatus: '待交出',
    requiredFields: ['操作人', '重交裁片数量', '备注'],
    writebackHandler: 'executeSpecialCraftAction.updateSpecialCraftTaskWorkOrderWebStatus',
  },
  {
    actionCode: 'POST_RECEIVE_START',
    actionLabel: '开始扫码收货',
    sourceType: 'POST_FINISHING',
    fromStatuses: ['待扫码收货'],
    toStatus: '接收中',
    requiredFields: ['操作人', '开始时间'],
    writebackHandler: 'executePostFinishingAction.applyPostFinishingActionStart',
  },
  {
    actionCode: 'POST_RECEIVE_FINISH',
    actionLabel: '确认收货入库',
    sourceType: 'POST_FINISHING',
    fromStatuses: ['接收中'],
    toStatus: '待质检',
    requiredFields: ['操作人', '完成时间', '接收成衣件数'],
    writebackHandler: 'executePostFinishingAction.applyPostFinishingActionFinish',
    affectsWarehouse: true,
  },
  {
    actionCode: 'POST_QC_START',
    actionLabel: '开始质检',
    sourceType: 'POST_FINISHING',
    fromStatuses: ['待质检'],
    toStatus: '质检中',
    requiredFields: ['质检人', '开始时间'],
    writebackHandler: 'executePostFinishingAction.applyPostFinishingActionStart',
  },
  {
    actionCode: 'POST_QC_FINISH',
    actionLabel: '完成质检',
    sourceType: 'POST_FINISHING',
    fromStatuses: ['质检中'],
    toStatus: '待后道',
    requiredFields: ['质检人', '完成时间', '质检通过成衣件数', '质检不合格成衣件数', '质检结果'],
    writebackHandler: 'executePostFinishingAction.applyPostFinishingActionFinish',
    affectsWarehouse: true,
  },
  {
    actionCode: 'POST_PROCESS_START',
    actionLabel: '开始后道',
    sourceType: 'POST_FINISHING',
    fromStatuses: ['待后道'],
    toStatus: '后道中',
    requiredFields: ['后道操作人', '开始时间'],
    writebackHandler: 'executePostFinishingAction.applyPostFinishingActionStart',
  },
  {
    actionCode: 'POST_PROCESS_FINISH',
    actionLabel: '完成后道',
    sourceType: 'POST_FINISHING',
    fromStatuses: ['后道中'],
    toStatus: '待复检',
    requiredFields: ['后道操作人', '完成时间', '后道完成成衣件数'],
    writebackHandler: 'executePostFinishingAction.applyPostFinishingActionFinish',
    affectsWarehouse: true,
  },
  {
    actionCode: 'POST_RECHECK_START',
    actionLabel: '开始复检',
    sourceType: 'POST_FINISHING',
    fromStatuses: ['待复检'],
    toStatus: '复检中',
    requiredFields: ['复检人', '开始时间'],
    writebackHandler: 'executePostFinishingAction.applyPostFinishingActionStart',
  },
  {
    actionCode: 'POST_RECHECK_FINISH',
    actionLabel: '完成复检',
    sourceType: 'POST_FINISHING',
    fromStatuses: ['复检中'],
    toStatus: '待交出',
    requiredFields: ['复检人', '完成时间', '复检确认成衣件数', '复检不合格成衣件数'],
    writebackHandler: 'executePostFinishingAction.applyPostFinishingActionFinish',
    affectsWarehouse: true,
  },
  {
    actionCode: 'POST_REPORT_DIFFERENCE',
    actionLabel: '上报差异',
    sourceType: 'POST_FINISHING',
    fromStatuses: ['质检中', '后道中', '复检中', '待交出'],
    toStatus: '有差异',
    requiredFields: ['上报人', '差异类型', '应收成衣件数', '实收成衣件数', '差异成衣件数', '原因'],
    optionalFields: ['证据'],
    writebackHandler: 'executePostFinishingAction.createProcessHandoverDifferenceRecord',
    affectsDifference: true,
  },
  {
    actionCode: 'POST_REWORK_AFTER_REJECT',
    actionLabel: '驳回后重交',
    sourceType: 'POST_FINISHING',
    fromStatuses: ['有差异', '平台处理中'],
    toStatus: '待交出',
    requiredFields: ['操作人', '操作时间', '重交原因'],
    writebackHandler: 'executePostFinishingAction.reworkAfterReject',
  },
]

function nowText(): string {
  return DEFAULT_OPERATED_AT
}

function normalizeActionCode(actionCode: string): string {
  return ACTION_CODE_ALIASES[actionCode] || actionCode
}

export function getCanonicalProcessActionCode(actionCode: string): string {
  return normalizeActionCode(actionCode)
}

export function listProcessActionDefinitions(sourceType?: ProcessActionSourceType): ProcessActionDefinition[] {
  return sourceType ? PROCESS_ACTION_DEFINITIONS.filter((item) => item.sourceType === sourceType) : [...PROCESS_ACTION_DEFINITIONS]
}

export function getProcessActionDefinition(sourceType: ProcessActionSourceType, actionCode: string): ProcessActionDefinition | undefined {
  const canonicalActionCode = normalizeActionCode(actionCode)
  return PROCESS_ACTION_DEFINITIONS.find((item) => item.sourceType === sourceType && item.actionCode === canonicalActionCode)
}

function getDefaultF090PrinterNo(): string {
  return listFactoryPrintMachineCapacities('F090')[0]?.printerNo || 'CRAFT_2000001-F090'
}

function getDefaultF090DyeVatNo(): string {
  return listFactoryDyeVatCapacities('F090')[0]?.dyeVatNo || 'CRAFT_2000003-F090'
}

function normalizeCuttingStatus(status: string): string {
  if (status === '已领料') return '待铺布'
  if (status === '裁片执行中') return '裁剪中'
  if (status === '待维护唛架') return '待铺布'
  if (status === '已入仓') return '待交出'
  return status
}

function getLatestRecord(sourceType: ProcessActionSourceType, sourceId: string): ProcessActionOperationRecord | undefined {
  return processActionOperationRecords.find((record) => record.sourceType === sourceType && record.sourceId === sourceId)
}

export function getProcessActionStatusSnapshot(sourceType: ProcessActionSourceType, sourceId: string): StatusSnapshot {
  if (sourceType === 'PRINT') {
    const order = getPrintWorkOrderById(sourceId)
    if (!order) throw new Error('印花加工单不存在')
    return {
      status: order.status,
      label: PRINT_WORK_ORDER_STATUS_LABEL[order.status],
      qty: order.plannedQty,
      unit: order.qtyUnit,
      taskId: order.taskId,
      workOrderNo: order.printOrderNo,
    }
  }

  if (sourceType === 'DYE') {
    const order = getDyeWorkOrderById(sourceId)
    if (!order) throw new Error('染色加工单不存在')
    return {
      status: order.status,
      label: DYE_WORK_ORDER_STATUS_LABEL[order.status],
      qty: order.plannedQty,
      unit: order.qtyUnit,
      taskId: order.taskId,
      workOrderNo: order.dyeOrderNo,
    }
  }

  if (sourceType === 'CUTTING') {
    const binding = validateCuttingOrderMobileTaskBinding(sourceId)
    const record = cutPieceOrderRecords.find(
      (item) => item.cutOrderId === sourceId || item.cutOrderNo === sourceId || item.id === sourceId,
    )
    const latestRecord = getLatestRecord('CUTTING', sourceId)
    const status = normalizeCuttingStatus(latestRecord?.nextStatus || record?.currentStage || '待铺布')
    return {
      status,
      label: status,
      qty: latestRecord?.objectQty || record?.markerInfo.totalPieces || record?.orderQty || 100,
      unit: latestRecord?.qtyUnit || '片',
      taskId: binding.actualTaskId,
      workOrderNo: binding.workOrderNo,
    }
  }

  if (sourceType === 'POST_FINISHING') {
    const order = getPostFinishingWorkOrderById(sourceId)
    if (!order) throw new Error('后道单不存在')
    const binding = validatePostFinishingMobileTaskBinding(order.postOrderId)
    return {
      status: order.currentStatus,
      label: order.currentStatus,
      qty: order.plannedGarmentQty,
      unit: order.plannedGarmentQtyUnit,
      taskId: binding.actualTaskId || order.sourceTaskId,
      workOrderNo: order.postOrderNo,
    }
  }

  const workOrder = getSpecialCraftTaskWorkOrderById(sourceId)
  if (!workOrder) throw new Error('特殊工艺加工单不存在')
  const binding = validateSpecialCraftMobileTaskBinding(sourceId)
  const objectMeta = resolveSpecialCraftObjectMeta(workOrder.targetObject)
  return {
    status: workOrder.status,
    label: workOrder.status,
    qty: workOrder.currentQty || workOrder.planQty,
    unit: objectMeta.qtyUnit,
    taskId: binding.actualTaskId,
    workOrderNo: workOrder.workOrderNo,
  }
}

function validateBinding(sourceType: ProcessActionSourceType, sourceId: string, sourceChannel?: ProcessActionPayload['sourceChannel']): { ok: boolean; reason: string; taskId: string } {
  const binding =
    sourceType === 'PRINT'
      ? validatePrintWorkOrderMobileTaskBinding(sourceId)
      : sourceType === 'DYE'
        ? validateDyeWorkOrderMobileTaskBinding(sourceId)
        : sourceType === 'CUTTING'
          ? validateCuttingOrderMobileTaskBinding(sourceId)
          : sourceType === 'SPECIAL_CRAFT'
            ? validateSpecialCraftMobileTaskBinding(sourceId)
            : validatePostFinishingMobileTaskBinding(sourceId)
  const prototypeCanUseFactoryScopedSpecialCraft =
    (sourceChannel === 'Web 端' || sourceChannel === '移动端') &&
    sourceType === 'SPECIAL_CRAFT' &&
    binding.isBound &&
    binding.isTaskFound &&
    binding.isProcessTypeMatched &&
    binding.isAcceptedOrExecutable
  return {
    ok: binding.canOpenMobileExecution || prototypeCanUseFactoryScopedSpecialCraft,
    reason: binding.reasonLabel,
    taskId: binding.actualTaskId,
  }
}

function toPlatformStatus(sourceType: ProcessActionSourceType, sourceId: string, nextStatus: string): string {
  const result = mapCraftStatusToPlatformStatus({
    sourceType,
    sourceId,
    processType: sourceType,
    craftStatusCode: nextStatus,
    craftStatusLabel: nextStatus,
  })
  return result.platformStatusLabel
}

function getFormFieldValue(fields: ProcessActionPayload['formData'] | undefined, aliases: string[]): string {
  if (!fields) return ''
  for (const alias of aliases) {
    const value = fields[alias]
    if (value != null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

function assertPositiveFormNumber(fields: ProcessActionPayload['formData'] | undefined, aliases: string[], label: string): void {
  const value = getFormFieldValue(fields, aliases)
  if (!value || !Number.isFinite(Number(value)) || Number(value) <= 0) throw new Error(`请填写${label}`)
}

function assertNonEmptyFormValue(fields: ProcessActionPayload['formData'] | undefined, aliases: string[], label: string): void {
  if (!getFormFieldValue(fields, aliases)) throw new Error(`请填写${label}`)
}

function assertPrintTransferPickupReady(printOrderId: string): void {
  const pickupRecords = listWaitProcessWarehouseRecords({
    craftType: 'PRINT',
    sourceWorkOrderId: printOrderId,
  })
  const hasPickup = pickupRecords.some((record) => record.receivedObjectQty > 0 || record.availableObjectQty > 0)
  if (!hasPickup) throw new Error('开始转印前必须先在交接模块完成本单领料记录')
}

function assertActionSpecificFields(payload: ProcessActionPayload, definition: ProcessActionDefinition): void {
  const fields = payload.formData || {}
  if (definition.actionCode === 'PRINT_START_TRANSFER') {
    assertPrintTransferPickupReady(payload.sourceId)
  }
  if (definition.actionCode === 'PRINT_FINISH_TRANSFER') {
    assertPositiveFormNumber(fields, ['转印完成卷数', '完成卷数', '卷数'], '转印完成卷数')
    assertNonEmptyFormValue(fields, ['每卷长度', '每卷长度明细', '卷长明细'], '每卷长度')
  }
  if (definition.actionCode === 'DYE_FINISH_PACKING') {
    assertPositiveFormNumber(fields, ['包装卷数', '完成卷数', '卷数'], '包装卷数')
    assertNonEmptyFormValue(fields, ['每卷长度', '每卷长度明细', '卷长明细'], '每卷长度')
  }
}

function resolveSpecialCraftObjectMeta(targetObject: string | undefined): { objectType: '面料' | '裁片' | '成衣'; qtyUnit: '米' | '片' | '件' } {
  const normalized = String(targetObject || '')
  if (normalized.includes('成衣')) return { objectType: '成衣', qtyUnit: '件' }
  if (normalized.includes('面料')) return { objectType: '面料', qtyUnit: '米' }
  return { objectType: '裁片', qtyUnit: '片' }
}

function assertRequiredFields(payload: ProcessActionPayload, definition: ProcessActionDefinition, qty: number, allowZeroQty = false): void {
  const fields = payload.formData || {}
  for (const field of definition.requiredFields) {
    if (
      field === '操作人' ||
      field === '交出人' ||
      field === '领料人' ||
      field === '接收人' ||
      field === '入仓人' ||
      field === '上报人' ||
      field === '质检人' ||
      field === '后道操作人' ||
      field === '复检人'
    ) {
      if (!payload.operatorName?.trim()) throw new Error(`请填写${field}`)
      continue
    }
    if (field.includes('时间')) {
      if (!payload.operatedAt?.trim()) throw new Error(`请填写${field}`)
      continue
    }
    if (field.includes('数量') || field.includes('米数') || field.includes('卷数') || field.includes('长度')) {
      if (!Number.isFinite(qty) || (allowZeroQty ? qty < 0 : qty <= 0)) throw new Error('请填写带对象和单位的操作数量')
      continue
    }
    if (field === '单位') {
      if (!payload.qtyUnit?.trim()) throw new Error('请填写单位')
      continue
    }
    if (field === '领料记录') {
      continue
    }
    const looseKey = field
    const value = fields[looseKey]
    if (value == null || String(value).trim() === '') {
      // 原型里页面不会提供所有业务字段，非数量字段允许由写回服务补默认值。
      continue
    }
  }
}

export function validateProcessAction(payload: ProcessActionPayload): { ok: boolean; message: string; definition?: ProcessActionDefinition; snapshot?: StatusSnapshot } {
  const definition = getProcessActionDefinition(payload.sourceType, payload.actionCode)
  if (!definition) return { ok: false, message: '当前动作未注册，不能写回' }
  const binding = validateBinding(payload.sourceType, payload.sourceId, payload.sourceChannel)
  if (!binding.ok) return { ok: false, message: binding.reason || '加工单与移动端任务绑定无效' }
  const combinedMobileDyeOrder = payload.sourceChannel === '移动端'
    && payload.sourceType === 'DYE'
    && definition.actionCode === 'DYE_FINISH_DYEING'
    ? getDyeWorkOrderById(payload.sourceId)
    : undefined
  if (combinedMobileDyeOrder?.requiresWaterSoluble) {
    if (payload.taskId !== combinedMobileDyeOrder.taskId) {
      return { ok: false, message: '当前任务与含水溶染色加工单不一致，不能写回。' }
    }
    if (!payload.actor) {
      return { ok: false, message: '缺少当前操作员身份，请重新登录。' }
    }
    const actorError = validateWaterSolublePdaActor(payload.actor, combinedMobileDyeOrder.dyeFactoryId, 'OPERATE')
    if (actorError) return { ok: false, message: actorError }
    if (payload.objectQty === undefined || !Number.isFinite(payload.objectQty)) {
      return { ok: false, message: '请填写大于或等于 0 的有效染色完成数量。' }
    }
  }
  const snapshot = getProcessActionStatusSnapshot(payload.sourceType, payload.sourceId)
  if (!definition.fromStatuses.includes(snapshot.status)) {
    return { ok: false, message: `当前状态“${snapshot.label}”不能执行“${definition.actionLabel}”` }
  }
  const qty = Number.isFinite(payload.objectQty) ? Number(payload.objectQty) : snapshot.qty
  const allowZeroQty = payload.sourceType === 'DYE'
    && definition.actionCode === 'DYE_FINISH_DYEING'
    && getDyeWorkOrderById(payload.sourceId)?.requiresWaterSoluble === true
  try {
    assertRequiredFields(payload, definition, qty, allowZeroQty)
    assertActionSpecificFields(payload, definition)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '必填字段不完整' }
  }
  return { ok: true, message: '校验通过', definition, snapshot }
}

function getActionObjectType(sourceType: ProcessActionSourceType, payload: ProcessActionPayload): string {
  return getProcessObjectType({
    processType: sourceType,
    sourceType,
    sourceId: payload.sourceId,
    objectType: payload.objectType,
    qtyUnit: payload.qtyUnit,
  })
}

function getActionQtyUnit(sourceType: ProcessActionSourceType, payload: ProcessActionPayload, snapshot: StatusSnapshot): string {
  return getProcessQtyUnit({
    processType: sourceType,
    sourceType,
    sourceId: payload.sourceId,
    objectType: payload.objectType,
    qtyUnit: payload.qtyUnit || snapshot.unit,
  })
}

export function executePrintAction(payload: ProcessActionPayload): Partial<ProcessActionWritebackResult> {
  const operatorName = payload.operatorName || (payload.sourceChannel === '移动端' ? '移动端操作员' : 'Web 端操作员')
  const qty = Number(payload.objectQty || getProcessActionStatusSnapshot('PRINT', payload.sourceId).qty || 0)
  const fields = payload.formData || {}
  const actionCode = normalizeActionCode(payload.actionCode)

  if (actionCode === 'PRINT_PATTERN_READY') {
    startColorTest(payload.sourceId, operatorName)
  } else if (actionCode === 'PRINT_COLOR_TEST_DONE') {
    completeColorTest(payload.sourceId, { passed: true, operatorName, remark: payload.remark })
  } else if (actionCode === 'PRINT_START_PRINTING') {
    startPrinting(payload.sourceId, { printerNo: String(fields.printerNo || getDefaultF090PrinterNo()), operatorName })
  } else if (actionCode === 'PRINT_FINISH_PRINTING') {
    completePrinting(payload.sourceId, { outputQty: qty, operatorName })
  } else if (actionCode === 'PRINT_START_TRANSFER') {
    assertPrintTransferPickupReady(payload.sourceId)
    startTransfer(payload.sourceId, operatorName)
  } else if (actionCode === 'PRINT_FINISH_TRANSFER') {
    const usedMaterialQty = Number(
      fields['实际使用原料面料米数']
        || fields['实际使用原料裁片数量']
        || fields['实际使用原料']
        || fields['usedMaterialQty']
        || qty,
    )
    completeTransfer(payload.sourceId, {
      usedMaterialQty: Number.isFinite(usedMaterialQty) && usedMaterialQty > 0 ? usedMaterialQty : qty,
      actualCompletedQty: qty,
      operatorName,
    })
  } else if (actionCode === 'PRINT_SUBMIT_HANDOVER') {
    const result = submitPrintHandover(payload.sourceId, {
      handoverQty: qty,
      handoverPerson: operatorName,
      handoverAt: payload.operatedAt,
      remark: payload.remark,
    })
    return { affectedHandoverRecordId: result.recordIds[0] || '' }
  }
  return {}
}

export function executeDyeAction(payload: ProcessActionPayload): Partial<ProcessActionWritebackResult> {
  const operatorName = payload.operatorName || (payload.sourceChannel === '移动端' ? '移动端操作员' : 'Web 端操作员')
  const fields = payload.formData || {}
  const actionCode = normalizeActionCode(payload.actionCode)
  const qty = Number(payload.objectQty ?? getProcessActionStatusSnapshot('DYE', payload.sourceId).qty ?? 0)

  if (actionCode === 'DYE_SAMPLE_RECEIVED') {
    completeDyeSampleWait(payload.sourceId, operatorName)
  } else if (actionCode === 'DYE_START_SAMPLE') {
    startDyeSampleTest(payload.sourceId, operatorName)
  } else if (actionCode === 'DYE_FINISH_SAMPLE') {
    completeDyeSampleTest(payload.sourceId, { colorNo: String(fields.colorNo || 'F090-色号'), operatorName })
  } else if (actionCode === 'DYE_MATERIAL_RECEIVED') {
    completeDyeMaterialWait(payload.sourceId, operatorName)
  } else if (actionCode === 'DYE_FINISH_PREPARE') {
    startDyeMaterialReady(payload.sourceId, operatorName)
    completeDyeMaterialReady(payload.sourceId, { outputQty: qty, operatorName })
  } else if (actionCode === 'DYE_SCHEDULE_VAT') {
    planDyeVat(payload.sourceId, { dyeVatNo: String(fields.dyeVatNo || getDefaultF090DyeVatNo()), operatorName })
  } else if (actionCode === 'DYE_START_DYEING') {
    if (payload.sourceChannel === '移动端') assertDyeWorkOrderOnlineActionAllowed(payload.sourceId, '开工')
    startDyeing(payload.sourceId, { dyeVatNo: String(fields.dyeVatNo || getDefaultF090DyeVatNo()), operatorName })
    if (payload.sourceChannel === '移动端') {
      advanceDyeWorkOrderOnlineStatus(payload.sourceId, {
        action: '开工', operatorName, operatedAt: payload.operatedAt || '', source: 'PDA',
      })
    }
  } else if (actionCode === 'DYE_FINISH_DYEING') {
    if (payload.sourceChannel === '移动端') assertDyeWorkOrderOnlineActionAllowed(payload.sourceId, '完工')
    const node = completeDyeing(payload.sourceId, { outputQty: qty, operatorName })
    if (payload.sourceChannel === '移动端') {
      advanceDyeWorkOrderOnlineStatus(payload.sourceId, {
        action: '完工', operatorName, operatedAt: payload.operatedAt || '', source: 'PDA',
        completedQty: node.outputQty || 0,
        lossQty: node.lossQty || 0,
      })
    }
  } else if (actionCode === 'DYE_FINISH_DEHYDRATION') {
    completeDyeNode(payload.sourceId, 'DEHYDRATE', { outputQty: qty, operatorName })
  } else if (actionCode === 'DYE_FINISH_DRYING') {
    completeDyeNode(payload.sourceId, 'DRY', { outputQty: qty, operatorName })
  } else if (actionCode === 'DYE_FINISH_SETTING') {
    completeDyeNode(payload.sourceId, 'SET', { outputQty: qty, operatorName })
  } else if (actionCode === 'DYE_FINISH_ROLLING') {
    completeDyeNode(payload.sourceId, 'ROLL', { outputQty: qty, operatorName })
  } else if (actionCode === 'DYE_FINISH_PACKING') {
    completeDyeNode(payload.sourceId, 'PACK', { outputQty: qty, operatorName })
  } else if (actionCode === 'DYE_SUBMIT_HANDOVER') {
    if (payload.sourceChannel === '移动端') assertDyeWorkOrderOnlineActionAllowed(payload.sourceId, '交出')
    const result = submitDyeHandover(payload.sourceId, {
      handoverQty: qty,
      handoverPerson: operatorName,
      handoverAt: payload.operatedAt,
      remark: payload.remark,
    })
    if (payload.sourceChannel === '移动端') {
      advanceDyeWorkOrderOnlineStatus(payload.sourceId, {
        action: '交出', operatorName, operatedAt: payload.operatedAt || '', source: 'PDA', remark: payload.remark,
      })
    }
    return { affectedHandoverRecordId: result.recordIds[0] || '' }
  }
  return {}
}

export function executeCuttingAction(payload: ProcessActionPayload): Partial<ProcessActionWritebackResult> {
  const definition = getProcessActionDefinition('CUTTING', payload.actionCode)
  if (!definition) throw new Error('裁片动作未注册')
  updateCutPieceOrderWebStage(payload.sourceId, {
    currentStage: definition.toStatus,
    operatorName: payload.operatorName,
    operatedAt: payload.operatedAt,
    notes: payload.remark,
  })
  updateCuttingOrderProgressWebStage(payload.sourceId, {
    cuttingStage: definition.toStatus,
    operatorName: payload.operatorName,
    operatedAt: payload.operatedAt,
  })
  const binding = validateCuttingOrderMobileTaskBinding(payload.sourceId)
  const qty = Number(payload.objectQty || getProcessActionStatusSnapshot('CUTTING', payload.sourceId).qty || 0)
  if (definition.actionCode === 'CUTTING_SUBMIT_HANDOVER') {
    const relatedFeiTicketIds = listSpreadingResultGeneratedFeiTicketsByCutOrderId(payload.sourceId).map((ticket) => ticket.feiTicketNo)
    const handover = createProcessHandoverRecord({
      craftType: 'CUTTING',
      craftName: '裁片',
      sourceWorkOrderId: payload.sourceId,
      sourceWorkOrderNo: binding.workOrderNo,
      sourceTaskId: binding.actualTaskId,
      sourceTaskNo: binding.actualTaskNo,
      sourceProductionOrderId: '',
      sourceProductionOrderNo: '',
      handoverFactoryId: 'F090',
      handoverFactoryName: '全能力测试工厂',
      receiveFactoryId: 'F090',
      receiveFactoryName: '全能力测试工厂',
      receiveWarehouseName: '裁片仓',
      objectType: '裁片',
      handoverObjectQty: qty,
      receiveObjectQty: 0,
      diffObjectQty: 0,
      qtyUnit: payload.qtyUnit || '片',
      handoverPerson: payload.operatorName || '操作员',
      handoverAt: payload.operatedAt,
      relatedFeiTicketIds,
      remark: payload.remark || `${payload.sourceChannel}发起裁片交出`,
    })
    return { affectedHandoverRecordId: handover.handoverRecordId }
  }
  return {}
}

export function executeSpecialCraftAction(payload: ProcessActionPayload): Partial<ProcessActionWritebackResult> {
  const definition = getProcessActionDefinition('SPECIAL_CRAFT', payload.actionCode)
  if (!definition) throw new Error('特殊工艺动作未注册')
  const workOrder = getSpecialCraftTaskWorkOrderById(payload.sourceId)
  if (!workOrder) throw new Error('特殊工艺加工单不存在')
  const qty = Number(payload.objectQty || workOrder.currentQty || workOrder.planQty || 0)
  const binding = validateSpecialCraftMobileTaskBinding(payload.sourceId)
  const nextStatus = definition.toStatus as SpecialCraftTaskStatus
  const objectMeta = resolveSpecialCraftObjectMeta(workOrder.targetObject)
  const updated = updateSpecialCraftTaskWorkOrderWebStatus(payload.sourceId, {
    status: nextStatus,
    operatorName: payload.operatorName,
    operatedAt: payload.operatedAt,
    currentQty: definition.actionCode === 'SPECIAL_CRAFT_REPORT_DIFFERENCE' ? Math.max((workOrder.currentQty || workOrder.planQty) - qty, 0) : undefined,
    receivedQty: definition.actionCode === 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES' ? qty : undefined,
    waitReturnQty: definition.actionCode === 'SPECIAL_CRAFT_FINISH_PROCESS' ? qty : undefined,
    returnedQty: definition.actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER' ? qty : undefined,
    remark: payload.remark,
  })

  if (definition.actionCode === 'SPECIAL_CRAFT_REPORT_DIFFERENCE') {
    const handover = createProcessHandoverRecord({
      craftType: 'SPECIAL_CRAFT',
      craftName: workOrder.operationName,
      sourceWorkOrderId: workOrder.workOrderId,
      sourceWorkOrderNo: workOrder.workOrderNo,
      sourceTaskId: binding.actualTaskId,
      sourceTaskNo: binding.actualTaskNo,
      sourceProductionOrderId: workOrder.productionOrderId,
      sourceProductionOrderNo: workOrder.productionOrderNo,
      handoverFactoryId: workOrder.factoryId,
      handoverFactoryName: workOrder.factoryName,
      receiveFactoryId: workOrder.factoryId,
      receiveFactoryName: workOrder.factoryName,
      receiveWarehouseName: '特殊工艺待处理区',
      objectType: objectMeta.objectType,
      handoverObjectQty: workOrder.planQty,
      receiveObjectQty: Math.max(workOrder.planQty - qty, 0),
      diffObjectQty: qty,
      qtyUnit: objectMeta.qtyUnit,
      handoverPerson: payload.operatorName || '操作员',
      handoverAt: payload.operatedAt,
      relatedFeiTicketIds: [...workOrder.feiTicketNos],
      remark: payload.remark || `${payload.sourceChannel}上报特殊工艺差异`,
    })
    const difference = createProcessHandoverDifferenceRecord({
      handoverRecordId: handover.handoverRecordId,
      warehouseRecordId: handover.warehouseRecordId,
      sourceWorkOrderId: workOrder.workOrderId,
      sourceWorkOrderNo: workOrder.workOrderNo,
      sourceProductionOrderId: workOrder.productionOrderId,
      sourceProductionOrderNo: workOrder.productionOrderNo,
      craftType: 'SPECIAL_CRAFT',
      craftName: workOrder.operationName,
      objectType: objectMeta.objectType,
      expectedObjectQty: workOrder.planQty,
      actualObjectQty: Math.max(workOrder.planQty - qty, 0),
      diffObjectQty: qty,
      qtyUnit: objectMeta.qtyUnit,
      reportedBy: payload.operatorName || '操作员',
      relatedFeiTicketIds: [...workOrder.feiTicketNos],
      remark: payload.remark || `${payload.sourceChannel}差异上报`,
    })
    return {
      affectedHandoverRecordId: handover.handoverRecordId,
      affectedDifferenceRecordId: difference.differenceRecordId,
      updatedWorkOrderId: updated?.workOrderId || workOrder.workOrderId,
    }
  }

  if (definition.actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER') {
    const handover = createProcessHandoverRecord({
      craftType: 'SPECIAL_CRAFT',
      craftName: workOrder.operationName,
      sourceWorkOrderId: workOrder.workOrderId,
      sourceWorkOrderNo: workOrder.workOrderNo,
      sourceTaskId: binding.actualTaskId,
      sourceTaskNo: binding.actualTaskNo,
      sourceProductionOrderId: workOrder.productionOrderId,
      sourceProductionOrderNo: workOrder.productionOrderNo,
      handoverFactoryId: workOrder.factoryId,
      handoverFactoryName: workOrder.factoryName,
      receiveFactoryId: workOrder.factoryId,
      receiveFactoryName: workOrder.factoryName,
      receiveWarehouseName: '特殊工艺交出仓',
      objectType: objectMeta.objectType,
      handoverObjectQty: qty,
      receiveObjectQty: 0,
      diffObjectQty: 0,
      qtyUnit: objectMeta.qtyUnit,
      handoverPerson: payload.operatorName || '操作员',
      handoverAt: payload.operatedAt,
      relatedFeiTicketIds: [...workOrder.feiTicketNos],
      remark: payload.remark || `${payload.sourceChannel}发起特殊工艺交出`,
    })
    return { affectedHandoverRecordId: handover.handoverRecordId, updatedWorkOrderId: updated?.workOrderId || workOrder.workOrderId }
  }

  return { updatedWorkOrderId: updated?.workOrderId || workOrder.workOrderId }
}

function getPostFinishingActionType(actionCode: string, currentStatus?: string): PostFinishingActionType {
  if (actionCode.includes('RECEIVE')) return '扫码收货'
  if (actionCode.includes('QC')) return '质检'
  if (actionCode.includes('PROCESS')) return '后道'
  if (actionCode.includes('RECHECK')) return '复检'
  if (currentStatus?.includes('质检')) return '质检'
  if (currentStatus?.includes('后道')) return '后道'
  if (currentStatus?.includes('复检') || currentStatus === '待交出') return '复检'
  return '扫码收货'
}

function getPostFinishingRejectedQty(payload: ProcessActionPayload, actionCode: string): number {
  const fields = payload.formData || {}
  if (actionCode === 'POST_QC_FINISH') return Number(fields['不合格数量'] || fields['质检不合格成衣件数'] || 0)
  if (actionCode === 'POST_RECHECK_FINISH') return Number(fields['复检不合格成衣件数'] || 0)
  return 0
}

export function executePostFinishingAction(payload: ProcessActionPayload): Partial<ProcessActionWritebackResult> {
  const definition = getProcessActionDefinition('POST_FINISHING', payload.actionCode)
  if (!definition) throw new Error('后道动作未注册')
  const order = getPostFinishingWorkOrderById(payload.sourceId)
  if (!order) throw new Error('后道单不存在')
  const actionCode = normalizeActionCode(payload.actionCode)
  const operatorName = payload.operatorName || (payload.sourceChannel === '移动端' ? '移动端操作员' : 'Web 端操作员')
  const qty = Number(payload.objectQty || order.plannedGarmentQty || 0)
  const actionType = getPostFinishingActionType(actionCode, order.currentStatus)

  if (actionCode.endsWith('_START')) {
    const updated = applyPostFinishingActionStart({
      postOrderId: payload.sourceId,
      actionType,
      operatorName,
      startedAt: payload.operatedAt,
    })
    return { updatedWorkOrderId: updated.postOrderId, nextStatus: updated.currentStatus } as Partial<ProcessActionWritebackResult>
  }

  if (actionCode === 'POST_REPORT_DIFFERENCE') {
    const fields = payload.formData || {}
    const expectedQty = Number(fields['应收成衣件数'] || order.plannedGarmentQty || qty)
    const actualQty = Number(fields['实收成衣件数'] || Math.max(expectedQty - qty, 0))
    const diffQty = Number(fields['差异成衣件数'] || Math.max(expectedQty - actualQty, 0) || qty)
    const updated = applyPostFinishingActionFinish({
      postOrderId: payload.sourceId,
      actionType,
      operatorName,
      finishedAt: payload.operatedAt,
      submittedGarmentQty: expectedQty,
      acceptedGarmentQty: actualQty,
      rejectedGarmentQty: 0,
      diffGarmentQty: diffQty,
      remark: payload.remark || '后道差异上报',
    })
    return { updatedWorkOrderId: updated.postOrderId, nextStatus: '有差异' } as Partial<ProcessActionWritebackResult>
  }

  if (actionCode.endsWith('_FINISH')) {
    const fields = payload.formData || {}
    const rejectedQty = getPostFinishingRejectedQty(payload, actionCode)
    const submittedQty = actionCode === 'POST_QC_FINISH' ? Number(fields['质检数量'] || qty) : qty
    const acceptedQty = actionCode === 'POST_QC_FINISH'
      ? Number(fields['合格数量'] || Math.max(submittedQty - (Number.isFinite(rejectedQty) ? rejectedQty : 0), 0))
      : Math.max(qty - (Number.isFinite(rejectedQty) ? rejectedQty : 0), 0)
    const updated = applyPostFinishingActionFinish({
      postOrderId: payload.sourceId,
      actionType,
      operatorName,
      finishedAt: payload.operatedAt,
      submittedGarmentQty: submittedQty,
      acceptedGarmentQty: acceptedQty,
      rejectedGarmentQty: Number.isFinite(rejectedQty) ? rejectedQty : 0,
      diffGarmentQty: 0,
      remark: payload.remark,
      qualityFields: actionCode === 'POST_QC_FINISH'
        ? ({
            qcResult: String(fields['质检结果'] || ''),
            unqualifiedDisposition: String(fields['不合格处置'] || ''),
            unqualifiedReasonSummary: String(fields['不合格原因'] || ''),
            rootCauseType: String(fields['根因类型'] || ''),
            liabilityStatus: String(fields['责任判定状态'] || ''),
            factoryLiabilityQty: Number(fields['工厂责任数量'] || 0),
            nonFactoryLiabilityQty: Number(fields['非工厂责任数量'] || 0),
            responsiblePartyName: String(fields['责任方'] || ''),
            deductionDecision: String(fields['扣款决策'] || ''),
            deductionDecisionRemark: String(fields['扣款备注'] || ''),
            dispositionRemark: String(fields['处置备注'] || ''),
          } as any)
        : undefined,
    })
    return { updatedWorkOrderId: updated.postOrderId, nextStatus: updated.currentStatus } as Partial<ProcessActionWritebackResult>
  }

  return { updatedWorkOrderId: payload.sourceId }
}

function buildOperationRemark(payload: ProcessActionPayload, definition?: ProcessActionDefinition): string {
  const fields = payload.formData || {}
  const rollCount = getFormFieldValue(fields, ['转印完成卷数', '包装卷数', '完成卷数', '卷数', '交出卷数'])
  const rollLength = getFormFieldValue(fields, ['每卷长度', '每卷长度明细', '卷长明细'])
  const parts = [payload.remark || definition?.actionLabel || '']
  if (rollCount) parts.push(`卷数：${rollCount}`)
  if (rollLength) parts.push(`每卷长度：${rollLength}`)
  return parts.filter(Boolean).join('；')
}

export function createProcessActionOperationRecord(
  payload: ProcessActionPayload,
  definition?: ProcessActionDefinition,
  previousStatus = '',
  nextStatus = '',
  result: Partial<ProcessActionWritebackResult> = {},
): ProcessActionOperationRecord {
  const snapshot = previousStatus ? undefined : getProcessActionStatusSnapshot(payload.sourceType, payload.sourceId)
  const quantityContext = {
    processType: payload.sourceType,
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    objectType: payload.objectType,
    qtyUnit: payload.qtyUnit || snapshot?.unit,
    operationCode: normalizeActionCode(payload.actionCode),
    qtyPurpose: normalizeActionCode(payload.actionCode).includes('HANDOVER') ? '已交出' as const : '已完成' as const,
  }
  const record: ProcessActionOperationRecord = {
    operationRecordId: `PAO-${String(processActionOperationRecords.length + 1).padStart(4, '0')}`,
    sourceChannel: payload.sourceChannel,
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    taskId: payload.taskId || snapshot?.taskId || '',
    actionCode: normalizeActionCode(payload.actionCode),
    actionLabel: payload.actionLabel || definition?.actionLabel || normalizeActionCode(payload.actionCode),
    previousStatus: previousStatus || snapshot?.label || '',
    nextStatus: nextStatus || definition?.toStatus || '',
    operatorName: payload.operatorName || (payload.sourceChannel === '移动端' ? '移动端操作员' : 'Web 端操作员'),
    operatedAt: payload.operatedAt || nowText(),
    objectType: getActionObjectType(payload.sourceType, payload),
    objectQty: Number.isFinite(payload.objectQty) ? Number(payload.objectQty) : snapshot?.qty || 0,
    qtyUnit: getProcessQtyUnit(quantityContext),
    qtyLabel: payload.qtyLabel || getQuantityLabel(quantityContext),
    remark: buildOperationRemark(payload, definition),
    evidenceUrls: [...(payload.evidenceUrls || [])],
    relatedWarehouseRecordId: result.affectedWarehouseRecordId || '',
    relatedHandoverRecordId: result.affectedHandoverRecordId || '',
    relatedReviewRecordId: result.affectedReviewRecordId || '',
    relatedDifferenceRecordId: result.affectedDifferenceRecordId || '',
  }
  processActionOperationRecords.unshift(record)
  return record
}

export function executeProcessAction(payload: ProcessActionPayload): ProcessActionWritebackResult {
  const canonicalPayload: ProcessActionPayload = {
    ...payload,
    actionCode: normalizeActionCode(payload.actionCode),
    operatorName: payload.operatorName || (payload.sourceChannel === '移动端' ? '移动端操作员' : 'Web 端操作员'),
    operatedAt: payload.operatedAt || nowText(),
  }
  if (canonicalPayload.sourceChannel === '移动端' && canonicalPayload.sourceType === 'DYE') {
    const onlineAction = canonicalPayload.actionCode === 'DYE_START_DYEING'
      ? '开工'
      : canonicalPayload.actionCode === 'DYE_FINISH_DYEING'
        ? '完工'
        : canonicalPayload.actionCode === 'DYE_SUBMIT_HANDOVER'
          ? '交出'
          : null
    if (onlineAction) assertDyeWorkOrderOnlineActionAllowed(canonicalPayload.sourceId, onlineAction)
  }
  const validation = validateProcessAction(canonicalPayload)
  if (!validation.ok || !validation.definition || !validation.snapshot) {
    throw new Error(validation.message)
  }
  const definition = validation.definition
  const snapshot = validation.snapshot
  const qty = Number.isFinite(canonicalPayload.objectQty) ? Number(canonicalPayload.objectQty) : snapshot.qty
  const hydratedPayload: ProcessActionPayload = {
    ...canonicalPayload,
    actionLabel: canonicalPayload.actionLabel || definition.actionLabel,
    taskId: canonicalPayload.taskId || snapshot.taskId,
    objectType: getActionObjectType(canonicalPayload.sourceType, canonicalPayload),
    objectQty: qty,
    qtyUnit: getActionQtyUnit(canonicalPayload.sourceType, canonicalPayload, snapshot),
  }
  hydratedPayload.qtyLabel = canonicalPayload.qtyLabel || getQuantityLabel({
    processType: hydratedPayload.sourceType,
    sourceType: hydratedPayload.sourceType,
    sourceId: hydratedPayload.sourceId,
    objectType: hydratedPayload.objectType,
    qtyUnit: hydratedPayload.qtyUnit,
    operationCode: hydratedPayload.actionCode,
    qtyPurpose: hydratedPayload.actionCode.includes('HANDOVER') ? '已交出' : '已完成',
  })
  const partial =
    hydratedPayload.sourceType === 'PRINT'
      ? executePrintAction(hydratedPayload)
      : hydratedPayload.sourceType === 'DYE'
        ? executeDyeAction(hydratedPayload)
        : hydratedPayload.sourceType === 'CUTTING'
          ? executeCuttingAction(hydratedPayload)
          : hydratedPayload.sourceType === 'SPECIAL_CRAFT'
            ? executeSpecialCraftAction(hydratedPayload)
            : executePostFinishingAction(hydratedPayload)
  const actualNextStatus = partial.nextStatus || definition.toStatus
  const platformStatusAfter = toPlatformStatus(hydratedPayload.sourceType, hydratedPayload.sourceId, actualNextStatus)
  const preliminaryResult: ProcessActionWritebackResult = {
    success: true,
    sourceChannel: hydratedPayload.sourceChannel,
    sourceType: hydratedPayload.sourceType,
    sourceId: hydratedPayload.sourceId,
    taskId: hydratedPayload.taskId || snapshot.taskId,
    actionCode: definition.actionCode,
    actionLabel: definition.actionLabel,
    previousStatus: snapshot.label,
    nextStatus: actualNextStatus,
    updatedWorkOrderId: partial.updatedWorkOrderId || hydratedPayload.sourceId,
    updatedTaskId: partial.updatedTaskId || hydratedPayload.taskId || snapshot.taskId,
    operationRecordId: '',
    affectedExecutionNodeId: partial.affectedExecutionNodeId || '',
    affectedWarehouseRecordId: partial.affectedWarehouseRecordId || '',
    affectedHandoverRecordId: partial.affectedHandoverRecordId || '',
    affectedReviewRecordId: partial.affectedReviewRecordId || '',
    affectedDifferenceRecordId: partial.affectedDifferenceRecordId || '',
    platformStatusAfter,
    message: `${definition.actionLabel}已由${hydratedPayload.sourceChannel}写回，平台聚合状态为${platformStatusAfter}`,
  }
  const linkage = applyWarehouseLinkageAfterAction({
    ...preliminaryResult,
    sourceChannel: hydratedPayload.sourceChannel,
    objectType: hydratedPayload.objectType,
    objectQty: hydratedPayload.objectQty,
    qtyUnit: hydratedPayload.qtyUnit,
  })
  const linkedPartial: Partial<ProcessActionWritebackResult> = {
    ...partial,
    affectedWarehouseRecordId:
      linkage.updatedWaitHandoverWarehouseRecordId ||
      linkage.createdWaitHandoverWarehouseRecordId ||
      linkage.updatedWaitProcessWarehouseRecordId ||
      linkage.createdWaitProcessWarehouseRecordId ||
      partial.affectedWarehouseRecordId ||
      '',
    affectedHandoverRecordId: linkage.updatedHandoverRecordId || linkage.createdHandoverRecordId || partial.affectedHandoverRecordId || '',
    affectedReviewRecordId: linkage.updatedReviewRecordId || linkage.createdReviewRecordId || partial.affectedReviewRecordId || '',
    affectedDifferenceRecordId: linkage.updatedDifferenceRecordId || linkage.createdDifferenceRecordId || partial.affectedDifferenceRecordId || '',
  }
  const operationRecord = createProcessActionOperationRecord(hydratedPayload, definition, snapshot.label, actualNextStatus, linkedPartial)
  return {
    success: true,
    sourceChannel: hydratedPayload.sourceChannel,
    sourceType: hydratedPayload.sourceType,
    sourceId: hydratedPayload.sourceId,
    taskId: hydratedPayload.taskId || snapshot.taskId,
    actionCode: definition.actionCode,
    actionLabel: definition.actionLabel,
    previousStatus: snapshot.label,
    nextStatus: actualNextStatus,
    updatedWorkOrderId: partial.updatedWorkOrderId || hydratedPayload.sourceId,
    updatedTaskId: partial.updatedTaskId || hydratedPayload.taskId || snapshot.taskId,
    operationRecordId: operationRecord.operationRecordId,
    affectedExecutionNodeId: linkedPartial.affectedExecutionNodeId || '',
    affectedWarehouseRecordId: linkedPartial.affectedWarehouseRecordId || '',
    affectedHandoverRecordId: linkedPartial.affectedHandoverRecordId || '',
    affectedReviewRecordId: linkedPartial.affectedReviewRecordId || '',
    affectedDifferenceRecordId: linkedPartial.affectedDifferenceRecordId || '',
    platformStatusAfter,
    message: `${definition.actionLabel}已由${hydratedPayload.sourceChannel}写回，${linkage.message}，平台聚合状态为${platformStatusAfter}`,
  }
}

export function executeMobileProcessAction(payload: Omit<ProcessActionPayload, 'sourceChannel'> & { sourceChannel?: ProcessActionSourceChannel }): ProcessActionWritebackResult {
  return executeProcessAction({ ...payload, sourceChannel: '移动端' })
}

export function listProcessActionOperationRecords(
  filter: Partial<Pick<ProcessActionOperationRecord, 'sourceChannel' | 'sourceType' | 'sourceId' | 'taskId'>> = {},
): ProcessActionOperationRecord[] {
  return processActionOperationRecords.filter((record) => {
    if (filter.sourceChannel && record.sourceChannel !== filter.sourceChannel) return false
    if (filter.sourceType && record.sourceType !== filter.sourceType) return false
    if (filter.sourceId && record.sourceId !== filter.sourceId) return false
    if (filter.taskId && record.taskId !== filter.taskId) return false
    return true
  })
}

export function getProcessActionOperationRecordsBySource(sourceType: ProcessActionSourceType, sourceId: string): ProcessActionOperationRecord[] {
  return listProcessActionOperationRecords({ sourceType, sourceId })
}

export function getProcessActionOperationRecordsByTask(taskId: string): ProcessActionOperationRecord[] {
  return listProcessActionOperationRecords({ taskId })
}

export const PROCESS_ACTION_WRITEBACK_SERVICE_SOURCE = '移动端与 Web 端共用写回函数'
