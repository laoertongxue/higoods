import { PRINT_WORK_ORDER_STATUS_LABEL, getPrintWorkOrderById, } from './printing-task-domain.ts';
import { DYE_WORK_ORDER_STATUS_LABEL, getDyeWorkOrderById, } from './dyeing-task-domain.ts';
import { cutPieceOrderRecords } from './cutting/cut-piece-orders.ts';
import { getSpecialCraftTaskWorkOrderById, } from './special-craft-task-orders.ts';
import { getPostFinishingWorkOrderById, } from './post-finishing-domain.ts';
import { validateCuttingOrderMobileTaskBinding, validateDyeWorkOrderMobileTaskBinding, validatePostFinishingMobileTaskBinding, validatePrintWorkOrderMobileTaskBinding, validateSpecialCraftMobileTaskBinding, } from './process-mobile-task-binding.ts';
import { executeProcessAction, getProcessActionOperationRecordsBySource, getProcessActionOperationRecordsByTask, listProcessActionOperationRecords, } from './process-action-writeback-service.ts';
import { getQuantityLabel } from './process-quantity-labels.ts';
const DEFAULT_OPERATED_AT = '2026-04-28 10:00';
const PRINT_ACTIONS = [
    {
        actionCode: 'PRINT_PATTERN_READY',
        actionLabel: '确认花型到位',
        processType: 'PRINT',
        fromStatuses: ['WAIT_ARTWORK'],
        toStatus: 'WAIT_COLOR_TEST',
        requiredFields: ['操作人', '花型号或花型版本', '操作时间'],
        optionalFields: ['备注'],
        writebackHandler: 'startColorTest',
    },
    {
        actionCode: 'PRINT_COLOR_TEST_DONE',
        actionLabel: '完成调色测试',
        processType: 'PRINT',
        fromStatuses: ['WAIT_COLOR_TEST', 'COLOR_TEST_DONE'],
        toStatus: 'WAIT_PRINT',
        requiredFields: ['操作人', '调色结果', '操作时间'],
        writebackHandler: 'completeColorTest',
    },
    {
        actionCode: 'PRINT_START_PRINTING',
        actionLabel: '开始打印',
        processType: 'PRINT',
        fromStatuses: ['WAIT_PRINT'],
        toStatus: 'PRINTING',
        requiredFields: ['操作人', '打印机编号', '开始时间'],
        writebackHandler: 'startPrintNode',
    },
    {
        actionCode: 'PRINT_FINISH_PRINTING',
        actionLabel: '完成打印',
        processType: 'PRINT',
        fromStatuses: ['PRINTING'],
        toStatus: 'WAIT_TRANSFER',
        requiredFields: ['操作人', '完成时间', '打印完成面料米数', '单位', '打印机编号'],
        writebackHandler: 'finishPrintNode',
    },
    {
        actionCode: 'PRINT_START_TRANSFER',
        actionLabel: '开始转印',
        processType: 'PRINT',
        fromStatuses: ['PRINT_DONE', 'WAIT_TRANSFER'],
        toStatus: 'TRANSFERRING',
        requiredFields: ['操作人', '开始时间', '领料记录'],
        writebackHandler: 'startTransfer',
    },
    {
        actionCode: 'PRINT_FINISH_TRANSFER',
        actionLabel: '完成转印',
        processType: 'PRINT',
        fromStatuses: ['TRANSFERRING'],
        toStatus: 'WAIT_HANDOVER',
        requiredFields: ['操作人', '完成时间', '转印完成面料米数', '完成卷数', '每卷长度', '单位'],
        writebackHandler: 'finishTransfer',
    },
    {
        actionCode: 'PRINT_SUBMIT_HANDOVER',
        actionLabel: '发起交出',
        processType: 'PRINT',
        fromStatuses: ['WAIT_HANDOVER'],
        toStatus: 'HANDOVER_WAIT_RECEIVE',
        requiredFields: ['交出人', '交出时间', '交出面料米数', '单位'],
        optionalFields: ['包装数量', '备注'],
        writebackHandler: 'submitPrintHandover',
        affectsHandover: true,
    },
];
const DYE_ACTIONS = [
    {
        actionCode: 'DYE_SAMPLE_RECEIVED',
        actionLabel: '确认样衣到位',
        processType: 'DYE',
        fromStatuses: ['WAIT_SAMPLE'],
        toStatus: 'SAMPLE_TESTING',
        requiredFields: ['操作人', '样衣到位时间', '备注'],
        writebackHandler: 'completeDyeSampleWait',
    },
    {
        actionCode: 'DYE_START_SAMPLE',
        actionLabel: '开始打样',
        processType: 'DYE',
        fromStatuses: ['WAIT_SAMPLE', 'SAMPLE_DONE'],
        toStatus: 'SAMPLE_TESTING',
        requiredFields: ['操作人', '开始时间'],
        writebackHandler: 'startDyeSampleTest',
    },
    {
        actionCode: 'DYE_FINISH_SAMPLE',
        actionLabel: '完成打样',
        processType: 'DYE',
        fromStatuses: ['SAMPLE_TESTING'],
        toStatus: 'SAMPLE_DONE',
        requiredFields: ['操作人', '完成时间', '色号', '打样结果'],
        writebackHandler: 'completeDyeSampleTest',
    },
    {
        actionCode: 'DYE_MATERIAL_RECEIVED',
        actionLabel: '确认原料到位',
        processType: 'DYE',
        fromStatuses: ['WAIT_MATERIAL'],
        toStatus: 'MATERIAL_READY',
        requiredFields: ['操作人', '原料面料 SKU', '到位面料米数', '到位卷数', '到位时间'],
        writebackHandler: 'completeDyeMaterialWait',
    },
    {
        actionCode: 'DYE_FINISH_PREPARE',
        actionLabel: '完成备料',
        processType: 'DYE',
        fromStatuses: ['WAIT_MATERIAL', 'MATERIAL_READY'],
        toStatus: 'MATERIAL_READY',
        requiredFields: ['操作人', '备料面料米数', '备料卷数', '完成时间'],
        writebackHandler: 'completeDyeMaterialReady',
    },
    {
        actionCode: 'DYE_SCHEDULE_VAT',
        actionLabel: '排染缸',
        processType: 'DYE',
        fromStatuses: ['SAMPLE_DONE', 'MATERIAL_READY', 'WAIT_VAT_PLAN'],
        toStatus: 'WAIT_VAT_PLAN',
        requiredFields: ['操作人', '染缸号', '排缸时间', '染缸容量'],
        writebackHandler: 'planDyeVat',
    },
    {
        actionCode: 'DYE_START_DYEING',
        actionLabel: '开始染色',
        processType: 'DYE',
        fromStatuses: ['WAIT_VAT_PLAN'],
        toStatus: 'DYEING',
        requiredFields: ['操作人', '开始时间', '染缸号'],
        writebackHandler: 'startDyeNode',
    },
    {
        actionCode: 'DYE_FINISH_DYEING',
        actionLabel: '完成染色',
        processType: 'DYE',
        fromStatuses: ['DYEING'],
        toStatus: 'DEHYDRATING',
        requiredFields: ['操作人', '完成时间', '染色完成面料米数'],
        writebackHandler: 'finishDyeNode',
    },
    {
        actionCode: 'DYE_FINISH_DEHYDRATION',
        actionLabel: '完成脱水',
        processType: 'DYE',
        fromStatuses: ['DEHYDRATING'],
        toStatus: 'DRYING',
        requiredFields: ['操作人', '完成时间', '完成面料米数'],
        writebackHandler: 'finishDyeNode',
    },
    {
        actionCode: 'DYE_FINISH_DRYING',
        actionLabel: '完成烘干',
        processType: 'DYE',
        fromStatuses: ['DRYING'],
        toStatus: 'SETTING',
        requiredFields: ['操作人', '完成时间', '完成面料米数'],
        writebackHandler: 'finishDyeNode',
    },
    {
        actionCode: 'DYE_FINISH_SETTING',
        actionLabel: '完成定型',
        processType: 'DYE',
        fromStatuses: ['SETTING'],
        toStatus: 'ROLLING',
        requiredFields: ['操作人', '完成时间', '完成面料米数'],
        writebackHandler: 'finishDyeNode',
    },
    {
        actionCode: 'DYE_FINISH_ROLLING',
        actionLabel: '完成打卷',
        processType: 'DYE',
        fromStatuses: ['ROLLING'],
        toStatus: 'PACKING',
        requiredFields: ['操作人', '完成时间', '完成面料米数', '卷数'],
        writebackHandler: 'finishDyeNode',
    },
    {
        actionCode: 'DYE_FINISH_PACKING',
        actionLabel: '完成包装',
        processType: 'DYE',
        fromStatuses: ['PACKING'],
        toStatus: 'WAIT_HANDOVER',
        requiredFields: ['操作人', '完成时间', '包装完成面料米数', '包装卷数', '每卷长度'],
        writebackHandler: 'finishDyeNode',
    },
    {
        actionCode: 'DYE_SUBMIT_HANDOVER',
        actionLabel: '发起交出',
        processType: 'DYE',
        fromStatuses: ['WAIT_HANDOVER'],
        toStatus: 'HANDOVER_WAIT_RECEIVE',
        requiredFields: ['交出人', '交出时间', '交出面料米数', '交出卷数'],
        optionalFields: ['备注'],
        writebackHandler: 'submitDyeHandover',
        affectsHandover: true,
    },
];
const CUTTING_ACTIONS = [
    {
        actionCode: 'CUTTING_CONFIRM_PICKUP',
        actionLabel: '确认领料',
        processType: 'CUTTING',
        fromStatuses: ['待领料'],
        toStatus: '待铺布',
        requiredFields: ['领料人', '领料时间', '实领面料米数', '备注'],
        writebackHandler: 'cuttingWebStageAdapter',
    },
    {
        actionCode: 'CUTTING_START_SPREADING',
        actionLabel: '开始铺布',
        processType: 'CUTTING',
        fromStatuses: ['待铺布'],
        toStatus: '铺布中',
        requiredFields: ['操作人', '开始时间', '裁床组'],
        writebackHandler: 'cuttingWebStageAdapter',
    },
    {
        actionCode: 'CUTTING_FINISH_SPREADING',
        actionLabel: '完成铺布',
        processType: 'CUTTING',
        fromStatuses: ['铺布中'],
        toStatus: '待裁剪',
        requiredFields: ['操作人', '完成时间', '铺布层数', '铺布实际长度', '单位'],
        writebackHandler: 'cuttingWebStageAdapter',
    },
    {
        actionCode: 'CUTTING_START_CUTTING',
        actionLabel: '开始裁剪',
        processType: 'CUTTING',
        fromStatuses: ['待裁剪'],
        toStatus: '裁剪中',
        requiredFields: ['操作人', '开始时间', '裁床组'],
        writebackHandler: 'cuttingWebStageAdapter',
    },
    {
        actionCode: 'CUTTING_FINISH_CUTTING',
        actionLabel: '完成裁剪',
        processType: 'CUTTING',
        fromStatuses: ['裁剪中'],
        toStatus: '裁剪完成',
        requiredFields: ['操作人', '完成时间', '已裁裁片数量'],
        writebackHandler: 'cuttingWebStageAdapter',
    },
    {
        actionCode: 'CUTTING_GENERATE_FEI_TICKETS',
        actionLabel: '生成菲票',
        processType: 'CUTTING',
        fromStatuses: ['裁剪完成', '待菲票'],
        toStatus: '菲票已生成',
        requiredFields: ['操作人', '生成时间', '生成菲票数量'],
        writebackHandler: 'cuttingWebStageAdapter',
    },
    {
        actionCode: 'CUTTING_CONFIRM_INBOUND',
        actionLabel: '确认入裁片仓',
        processType: 'CUTTING',
        fromStatuses: ['待入仓', '菲票已生成'],
        toStatus: '待交出',
        requiredFields: ['入仓人', '入仓时间', '入仓裁片数量', '仓位'],
        writebackHandler: 'cuttingWebStageAdapter',
        affectsWarehouse: true,
    },
    {
        actionCode: 'CUTTING_SUBMIT_HANDOVER',
        actionLabel: '发起交出',
        processType: 'CUTTING',
        fromStatuses: ['待交出'],
        toStatus: '交出待收货',
        requiredFields: ['交出人', '交出时间', '交出裁片数量', '备注'],
        writebackHandler: 'createProcessHandoverRecord',
        affectsHandover: true,
    },
];
const SPECIAL_CRAFT_ACTIONS = [
    {
        actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
        actionLabel: '确认接收裁片',
        processType: 'SPECIAL_CRAFT',
        fromStatuses: ['待接收', '待领料', '已入待加工仓'],
        toStatus: '已入待加工仓',
        requiredFields: ['接收人', '接收时间', '接收裁片数量', '关联菲票'],
        optionalFields: ['备注'],
        writebackHandler: 'startSpecialCraftTask',
    },
    {
        actionCode: 'SPECIAL_CRAFT_START_PROCESS',
        actionLabel: '开始加工',
        processType: 'SPECIAL_CRAFT',
        fromStatuses: ['已接收', '待加工', '已入待加工仓'],
        toStatus: '加工中',
        requiredFields: ['操作人', '开始时间'],
        writebackHandler: 'startSpecialCraftTask',
    },
    {
        actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
        actionLabel: '完成加工',
        processType: 'SPECIAL_CRAFT',
        fromStatuses: ['加工中'],
        toStatus: '待交出',
        requiredFields: ['操作人', '完成时间', '加工完成裁片数量'],
        writebackHandler: 'finishSpecialCraftTask',
    },
    {
        actionCode: 'SPECIAL_CRAFT_REPORT_DIFFERENCE',
        actionLabel: '上报差异',
        processType: 'SPECIAL_CRAFT',
        fromStatuses: ['已接收', '已入待加工仓', '加工中', '加工完成', '待交出'],
        toStatus: '差异',
        requiredFields: ['上报人', '差异类型', '应收裁片数量', '实收裁片数量', '差异裁片数量', '关联菲票', '原因'],
        optionalFields: ['证据'],
        writebackHandler: 'createProcessHandoverDifferenceRecord',
        affectsDifference: true,
    },
    {
        actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
        actionLabel: '发起交出',
        processType: 'SPECIAL_CRAFT',
        fromStatuses: ['加工完成', '待交出'],
        toStatus: '交出待收货',
        requiredFields: ['交出人', '交出时间', '交出裁片数量', '关联菲票'],
        optionalFields: ['备注'],
        writebackHandler: 'createProcessHandoverRecord',
        affectsHandover: true,
    },
    {
        actionCode: 'SPECIAL_CRAFT_REWORK_AFTER_REJECT',
        actionLabel: '差异后重交',
        processType: 'SPECIAL_CRAFT',
        fromStatuses: ['差异', '异议中', '异常', '交出待收货', '收货差异'],
        toStatus: '待交出',
        requiredFields: ['操作人', '重交裁片数量', '备注'],
        optionalFields: [],
        writebackHandler: 'reworkAfterReject',
        affectsHandover: true,
    },
];
const POST_FINISHING_ACTIONS = [
    {
        actionCode: 'POST_RECEIVE_START',
        actionLabel: '开始扫码收货',
        processType: 'POST_FINISHING',
        fromStatuses: ['待扫码收货'],
        toStatus: '接收中',
        requiredFields: ['操作人', '开始时间'],
        writebackHandler: 'applyPostFinishingActionStart',
    },
    {
        actionCode: 'POST_RECEIVE_FINISH',
        actionLabel: '确认收货入库',
        processType: 'POST_FINISHING',
        fromStatuses: ['接收中'],
        toStatus: '待质检',
        requiredFields: ['操作人', '完成时间', '接收成衣件数'],
        writebackHandler: 'applyPostFinishingActionFinish',
        affectsWarehouse: true,
    },
    {
        actionCode: 'POST_QC_START',
        actionLabel: '开始质检',
        processType: 'POST_FINISHING',
        fromStatuses: ['待质检'],
        toStatus: '质检中',
        requiredFields: ['质检人', '开始时间'],
        writebackHandler: 'applyPostFinishingActionStart',
    },
    {
        actionCode: 'POST_QC_FINISH',
        actionLabel: '完成质检',
        processType: 'POST_FINISHING',
        fromStatuses: ['质检中'],
        toStatus: '待后道',
        requiredFields: [
            '质检人',
            '完成时间',
            '质检数量',
            '合格数量',
            '不合格数量',
            '质检结果',
            '不合格处置',
            '不合格原因',
            '根因类型',
            '责任判定状态',
            '工厂责任数量',
            '非工厂责任数量',
            '责任方',
            '扣款决策',
        ],
        optionalFields: ['缺陷项', '证据', '扣款备注', '处置备注'],
        writebackHandler: 'applyPostFinishingActionFinish',
        affectsWarehouse: true,
    },
    {
        actionCode: 'POST_PROCESS_START',
        actionLabel: '开始后道',
        processType: 'POST_FINISHING',
        fromStatuses: ['待后道'],
        toStatus: '后道中',
        requiredFields: ['后道操作人', '开始时间'],
        writebackHandler: 'applyPostFinishingActionStart',
    },
    {
        actionCode: 'POST_PROCESS_FINISH',
        actionLabel: '完成后道',
        processType: 'POST_FINISHING',
        fromStatuses: ['后道中'],
        toStatus: '待复检',
        requiredFields: ['后道操作人', '完成时间', '后道完成成衣件数'],
        writebackHandler: 'applyPostFinishingActionFinish',
        affectsWarehouse: true,
    },
    {
        actionCode: 'POST_RECHECK_START',
        actionLabel: '开始复检',
        processType: 'POST_FINISHING',
        fromStatuses: ['待复检'],
        toStatus: '复检中',
        requiredFields: ['复检人', '开始时间'],
        writebackHandler: 'applyPostFinishingActionStart',
    },
    {
        actionCode: 'POST_RECHECK_FINISH',
        actionLabel: '完成复检',
        processType: 'POST_FINISHING',
        fromStatuses: ['复检中'],
        toStatus: '待交出',
        requiredFields: ['复检人', '完成时间', '复检确认成衣件数', '复检不合格成衣件数'],
        writebackHandler: 'applyPostFinishingActionFinish',
        affectsWarehouse: true,
    },
    {
        actionCode: 'POST_REPORT_DIFFERENCE',
        actionLabel: '上报差异',
        processType: 'POST_FINISHING',
        fromStatuses: ['质检中', '后道中', '复检中', '待交出'],
        toStatus: '有差异',
        requiredFields: ['上报人', '差异类型', '应收成衣件数', '实收成衣件数', '差异成衣件数', '原因'],
        optionalFields: ['证据'],
        writebackHandler: 'createProcessHandoverDifferenceRecord',
        affectsDifference: true,
    },
];
function nowText() {
    return DEFAULT_OPERATED_AT;
}
function toAction(definition, currentStatus, disabledReason) {
    return {
        actionCode: definition.actionCode,
        actionLabel: definition.actionLabel,
        processType: definition.processType,
        fromStatus: currentStatus,
        toStatus: definition.toStatus,
        requiredFields: definition.requiredFields,
        optionalFields: definition.optionalFields || ['备注'],
        confirmText: `确认执行“${definition.actionLabel}”，状态将从“${currentStatus}”变更为“${definition.toStatus}”。`,
        disabledReason,
        writebackHandler: definition.writebackHandler,
        affectsWarehouse: Boolean(definition.affectsWarehouse),
        affectsHandover: Boolean(definition.affectsHandover),
        affectsReview: Boolean(definition.affectsReview),
        affectsDifference: Boolean(definition.affectsDifference),
        affectsPlatformStatus: true,
    };
}
function normalizeCuttingStatus(status) {
    if (status === '已领料')
        return '待铺布';
    if (status === '裁片执行中')
        return '裁剪中';
    if (status === '待维护唛架')
        return '待铺布';
    if (status === '已入仓')
        return '待交出';
    return status;
}
function listMatchingActions(definitions, currentStatus, disabledReason) {
    return definitions
        .filter((definition) => definition.fromStatuses.includes(currentStatus))
        .map((definition) => toAction(definition, currentStatus, disabledReason));
}
function withPrintQuantityFields(action, printOrderId) {
    const order = getPrintWorkOrderById(printOrderId);
    if (!order)
        return action;
    const context = {
        processType: 'PRINT',
        sourceType: 'PRINT_WORK_ORDER',
        sourceId: printOrderId,
        objectType: order.objectType,
        qtyUnit: order.qtyUnit,
        isPiecePrinting: order.isPiecePrinting,
        isFabricPrinting: order.isFabricPrinting,
    };
    const dynamicLabels = {
        PRINT_FINISH_PRINTING: getQuantityLabel({ ...context, operationCode: 'PRINT_FINISH_PRINTING', qtyPurpose: '已完成' }),
        PRINT_FINISH_TRANSFER: getQuantityLabel({ ...context, operationCode: 'PRINT_FINISH_TRANSFER', qtyPurpose: '已完成' }),
        PRINT_SUBMIT_HANDOVER: getQuantityLabel({ ...context, operationCode: 'PRINT_SUBMIT_HANDOVER', qtyPurpose: '已交出' }),
    };
    const label = dynamicLabels[action.actionCode];
    if (!label)
        return action;
    return {
        ...action,
        requiredFields: action.requiredFields.map((field) => field.includes('面料米数') || field.includes('裁片数量') || field.includes('对象数量') ? label : field),
    };
}
function getPrintStatus(printOrderId) {
    const order = getPrintWorkOrderById(printOrderId);
    if (!order)
        return null;
    return {
        status: order.status,
        label: PRINT_WORK_ORDER_STATUS_LABEL[order.status],
        qty: order.plannedQty,
        unit: order.qtyUnit,
        taskId: order.taskId,
    };
}
function getDyeStatus(dyeOrderId) {
    const order = getDyeWorkOrderById(dyeOrderId);
    if (!order)
        return null;
    return {
        status: order.status,
        label: DYE_WORK_ORDER_STATUS_LABEL[order.status],
        qty: order.plannedQty,
        unit: order.qtyUnit,
        taskId: order.taskId,
    };
}
function getCuttingStatus(cuttingOrderId) {
    const binding = validateCuttingOrderMobileTaskBinding(cuttingOrderId);
    const record = cutPieceOrderRecords.find((item) => item.cutOrderId === cuttingOrderId || item.cutOrderNo === cuttingOrderId || item.id === cuttingOrderId);
    const latestRecord = listProcessActionOperationRecords({ sourceType: 'CUTTING', sourceId: cuttingOrderId })[0];
    const status = normalizeCuttingStatus(latestRecord?.nextStatus || record?.currentStage || '待铺布');
    return {
        status,
        label: status,
        qty: latestRecord?.objectQty || record?.markerInfo.totalPieces || record?.orderQty || 100,
        unit: latestRecord?.qtyUnit || '片',
        taskId: binding.actualTaskId,
    };
}
function getSpecialCraftStatus(workOrderId) {
    const workOrder = getSpecialCraftTaskWorkOrderById(workOrderId);
    if (!workOrder)
        return null;
    const binding = validateSpecialCraftMobileTaskBinding(workOrderId);
    return {
        status: workOrder.status,
        label: workOrder.status,
        qty: workOrder.currentQty || workOrder.planQty,
        unit: '片',
        taskId: binding.actualTaskId,
    };
}
function getPostFinishingStatus(postOrderId) {
    const order = getPostFinishingWorkOrderById(postOrderId);
    if (!order)
        return null;
    const binding = validatePostFinishingMobileTaskBinding(postOrderId);
    return {
        status: order.currentStatus,
        label: order.currentStatus,
        qty: order.plannedGarmentQty,
        unit: order.plannedGarmentQtyUnit,
        taskId: binding.actualTaskId || order.sourceTaskId,
        isPostDoneBySewingFactory: order.isPostDoneBySewingFactory,
    };
}
function isMobileBindingValid(sourceType, sourceId) {
    const result = sourceType === 'PRINT_WORK_ORDER'
        ? validatePrintWorkOrderMobileTaskBinding(sourceId)
        : sourceType === 'DYE_WORK_ORDER'
            ? validateDyeWorkOrderMobileTaskBinding(sourceId)
            : sourceType === 'CUTTING_ORDER'
                ? validateCuttingOrderMobileTaskBinding(sourceId)
                : sourceType === 'SPECIAL_CRAFT_WORK_ORDER'
                    ? validateSpecialCraftMobileTaskBinding(sourceId)
                    : validatePostFinishingMobileTaskBinding(sourceId);
    return {
        ok: result.canOpenMobileExecution,
        reason: result.reasonLabel,
        taskId: result.actualTaskId,
    };
}
export function getAvailablePrintWebActions(printOrderId) {
    const binding = isMobileBindingValid('PRINT_WORK_ORDER', printOrderId);
    const status = getPrintStatus(printOrderId);
    if (!status)
        return [];
    if (!binding.ok)
        return [toAction(PRINT_ACTIONS[0], status.label, binding.reason)];
    return listMatchingActions(PRINT_ACTIONS, status.status).map((action) => withPrintQuantityFields(action, printOrderId));
}
export function getAvailableDyeWebActions(dyeOrderId) {
    const binding = isMobileBindingValid('DYE_WORK_ORDER', dyeOrderId);
    const status = getDyeStatus(dyeOrderId);
    if (!status)
        return [];
    if (!binding.ok)
        return [toAction(DYE_ACTIONS[0], status.label, binding.reason)];
    return listMatchingActions(DYE_ACTIONS, status.status);
}
export function getAvailableCuttingWebActions(cuttingOrderId) {
    const binding = isMobileBindingValid('CUTTING_ORDER', cuttingOrderId);
    const status = getCuttingStatus(cuttingOrderId);
    if (!binding.ok)
        return [toAction(CUTTING_ACTIONS[0], status.label, binding.reason)];
    return listMatchingActions(CUTTING_ACTIONS, status.status);
}
export function getAvailableSpecialCraftWebActions(workOrderId) {
    const binding = isMobileBindingValid('SPECIAL_CRAFT_WORK_ORDER', workOrderId);
    const status = getSpecialCraftStatus(workOrderId);
    if (!status)
        return [];
    if (!binding.ok)
        return [toAction(SPECIAL_CRAFT_ACTIONS[0], status.label, binding.reason)];
    return listMatchingActions(SPECIAL_CRAFT_ACTIONS, status.status);
}
export function getAvailablePostFinishingWebActions(postOrderId) {
    const binding = isMobileBindingValid('POST_FINISHING_WORK_ORDER', postOrderId);
    const status = getPostFinishingStatus(postOrderId);
    if (!status)
        return [];
    if (!binding.ok)
        return [toAction(POST_FINISHING_ACTIONS[0], status.label, binding.reason)];
    const definitions = status.isPostDoneBySewingFactory
        ? POST_FINISHING_ACTIONS.filter((action) => !['POST_PROCESS_START', 'POST_PROCESS_FINISH'].includes(action.actionCode))
        : POST_FINISHING_ACTIONS;
    return listMatchingActions(definitions, status.status);
}
export function listAvailableWebActions(sourceType, sourceId) {
    if (sourceType === 'PRINT_WORK_ORDER')
        return getAvailablePrintWebActions(sourceId);
    if (sourceType === 'DYE_WORK_ORDER')
        return getAvailableDyeWebActions(sourceId);
    if (sourceType === 'CUTTING_ORDER')
        return getAvailableCuttingWebActions(sourceId);
    if (sourceType === 'SPECIAL_CRAFT_WORK_ORDER')
        return getAvailableSpecialCraftWebActions(sourceId);
    return getAvailablePostFinishingWebActions(sourceId);
}
export function validateProcessWebAction(payload) {
    const actions = listAvailableWebActions(payload.sourceType, payload.sourceId);
    const action = actions.find((item) => item.actionCode === payload.actionCode);
    if (!action)
        return { ok: false, message: '当前状态暂无该可执行动作' };
    if (action.disabledReason)
        return { ok: false, message: action.disabledReason };
    if (!payload.operatorName?.trim())
        return { ok: false, message: '请填写操作人' };
    if (!payload.operatedAt?.trim())
        return { ok: false, message: '请填写操作时间' };
    if (action.requiredFields.some((field) => field.includes('数量')) && !Number.isFinite(payload.objectQty)) {
        return { ok: false, message: '请填写带对象和单位的操作数量' };
    }
    return { ok: true, message: '校验通过', action };
}
function getStatusSnapshot(sourceType, sourceId) {
    const snapshot = sourceType === 'PRINT_WORK_ORDER'
        ? getPrintStatus(sourceId)
        : sourceType === 'DYE_WORK_ORDER'
            ? getDyeStatus(sourceId)
            : sourceType === 'CUTTING_ORDER'
                ? getCuttingStatus(sourceId)
                : sourceType === 'SPECIAL_CRAFT_WORK_ORDER'
                    ? getSpecialCraftStatus(sourceId)
                    : getPostFinishingStatus(sourceId);
    if (!snapshot)
        throw new Error('来源对象不存在，不能执行状态操作');
    return snapshot;
}
function toProcessActionSourceType(sourceType) {
    if (sourceType === 'PRINT_WORK_ORDER')
        return 'PRINT';
    if (sourceType === 'DYE_WORK_ORDER')
        return 'DYE';
    if (sourceType === 'CUTTING_ORDER')
        return 'CUTTING';
    if (sourceType === 'SPECIAL_CRAFT_WORK_ORDER')
        return 'SPECIAL_CRAFT';
    return 'POST_FINISHING';
}
function toProcessWebSourceType(sourceType) {
    if (sourceType === 'PRINT')
        return 'PRINT_WORK_ORDER';
    if (sourceType === 'DYE')
        return 'DYE_WORK_ORDER';
    if (sourceType === 'CUTTING')
        return 'CUTTING_ORDER';
    if (sourceType === 'SPECIAL_CRAFT')
        return 'SPECIAL_CRAFT_WORK_ORDER';
    return 'POST_FINISHING_WORK_ORDER';
}
function toProcessWebRecord(record) {
    return {
        operationRecordId: record.operationRecordId,
        sourceType: toProcessWebSourceType(record.sourceType),
        sourceId: record.sourceId,
        processType: record.sourceType,
        actionCode: record.actionCode,
        actionLabel: record.actionLabel,
        previousStatus: record.previousStatus,
        nextStatus: record.nextStatus,
        operatorName: record.operatorName,
        operatedAt: record.operatedAt,
        objectType: record.objectType,
        objectQty: record.objectQty,
        qtyUnit: record.qtyUnit,
        qtyLabel: record.qtyLabel,
        remark: record.remark,
        evidenceUrls: [...record.evidenceUrls],
        relatedMobileTaskId: record.taskId,
        relatedWarehouseRecordId: record.relatedWarehouseRecordId,
        relatedHandoverRecordId: record.relatedHandoverRecordId,
        relatedReviewRecordId: record.relatedReviewRecordId,
        relatedDifferenceRecordId: record.relatedDifferenceRecordId,
        sourceChannel: record.sourceChannel,
    };
}
export function executeProcessWebAction(payload) {
    const snapshot = getStatusSnapshot(payload.sourceType, payload.sourceId);
    const hydratedPayload = {
        ...payload,
        operatorName: payload.operatorName || 'Web 端操作员',
        operatedAt: payload.operatedAt || nowText(),
        objectQty: Number.isFinite(payload.objectQty) ? Number(payload.objectQty) : snapshot.qty,
        qtyUnit: payload.qtyUnit || snapshot.unit,
    };
    const validation = validateProcessWebAction(hydratedPayload);
    if (!validation.ok || !validation.action) {
        throw new Error(validation.message);
    }
    const action = validation.action;
    const result = executeProcessAction({
        sourceChannel: 'Web 端',
        sourceType: toProcessActionSourceType(payload.sourceType),
        sourceId: payload.sourceId,
        taskId: snapshot.taskId,
        actionCode: action.actionCode,
        actionLabel: action.actionLabel,
        operatorName: hydratedPayload.operatorName,
        operatedAt: hydratedPayload.operatedAt,
        objectType: hydratedPayload.objectType,
        objectQty: hydratedPayload.objectQty,
        qtyUnit: hydratedPayload.qtyUnit,
        formData: hydratedPayload.fields,
        remark: hydratedPayload.remark,
        evidenceUrls: hydratedPayload.evidenceUrls,
    });
    return {
        success: true,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        previousStatus: result.previousStatus,
        nextStatus: result.nextStatus,
        operationRecordId: result.operationRecordId,
        updatedWorkOrderId: result.updatedWorkOrderId,
        updatedTaskId: result.updatedTaskId,
        affectedWarehouseRecordId: result.affectedWarehouseRecordId,
        affectedHandoverRecordId: result.affectedHandoverRecordId,
        affectedReviewRecordId: result.affectedReviewRecordId,
        affectedDifferenceRecordId: result.affectedDifferenceRecordId,
        platformStatusAfter: result.platformStatusAfter,
        message: result.message,
    };
}
export function listProcessWebOperationRecords(filter = {}) {
    return listProcessActionOperationRecords().map(toProcessWebRecord).filter((record) => {
        if (filter.sourceType && record.sourceType !== filter.sourceType)
            return false;
        if (filter.sourceId && record.sourceId !== filter.sourceId)
            return false;
        if (filter.processType && record.processType !== filter.processType)
            return false;
        return true;
    });
}
export function getProcessWebOperationRecordsBySource(sourceType, sourceId) {
    return getProcessActionOperationRecordsBySource(toProcessActionSourceType(sourceType), sourceId).map(toProcessWebRecord);
}
export function getUnifiedOperationRecordsForProcessWorkOrder(sourceType, sourceId, taskId) {
    const records = [
        ...getProcessActionOperationRecordsBySource(toProcessActionSourceType(sourceType), sourceId),
        ...(taskId ? getProcessActionOperationRecordsByTask(taskId) : []),
    ];
    return records
        .filter((record, index, list) => list.findIndex((item) => item.operationRecordId === record.operationRecordId) === index)
        .map(toProcessWebRecord)
        .sort((left, right) => right.operatedAt.localeCompare(left.operatedAt, 'zh-CN'));
}
export function getUnifiedOperationRecordsForPostFinishing(postOrderId, taskId) {
    return getUnifiedOperationRecordsForProcessWorkOrder('POST_FINISHING_WORK_ORDER', postOrderId, taskId);
}
export const PROCESS_WEB_STATUS_ACTION_SOURCE = '工艺工厂 Web 端状态操作';
