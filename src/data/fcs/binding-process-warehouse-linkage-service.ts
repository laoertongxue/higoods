import {
  captureBindingProcessOrderStore,
  executeBindingProcessAction,
  getBindingOrderAvailableInputMaterialQty,
  getBindingProcessOrderById,
  restoreBindingProcessOrderStore,
  type ExecuteBindingProcessActionInput,
} from '../../pages/process-factory/cutting/binding-strip-orders.ts'
import {
  captureProcessWarehouseMutationState,
  createProcessHandoverRecord,
  createWaitHandoverWarehouseRecord,
  createWaitProcessWarehouseRecord,
  getWarehouseRecordsByWorkOrderId,
  restoreProcessWarehouseMutationState,
  updateWarehouseRecordQty,
} from './process-warehouse-domain.ts'

function token(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')
}

export function executeBindingProcessActionWithWarehouse(input: ExecuteBindingProcessActionInput) {
  const beforeOrder = getBindingProcessOrderById(input.bindingOrderId)
  if (!beforeOrder) throw new Error('捆条加工单不存在')
  const duplicated = (beforeOrder.actionRecords || []).some((record) =>
    record.actionCode === input.actionCode && record.confirmationKey === input.confirmationKey.trim(),
  )
  if (duplicated) return beforeOrder

  const orderSnapshot = captureBindingProcessOrderStore()
  const warehouseSnapshot = captureProcessWarehouseMutationState()
  try {
    const order = executeBindingProcessAction(input)
    const common = {
      craftType: 'BINDING' as const,
      craftName: '捆条',
      sourceTaskOrderId: order.bindingOrderId,
      sourceWorkOrderNo: order.bindingOrderNo,
      workOrderId: order.bindingOrderId,
      workOrderNo: order.bindingOrderNo,
      sourceTaskId: order.sourceTaskId,
      sourceTaskNo: order.sourceTaskNo,
      sourceProductionOrderId: order.sourceProductionOrderId,
      sourceProductionOrderNo: order.sourceProductionOrderNo,
      sourceFactoryId: order.factoryId,
      sourceFactoryName: order.factoryName,
      targetFactoryId: order.factoryId,
      targetFactoryName: order.factoryName,
      materialSku: order.materialIdentity.materialSku,
      materialName: order.materialIdentity.materialName,
      styleNo: order.sourceProductionOrderNo,
      batchNo: order.sourceCutOrderNo,
      relatedFeiTicketIds: order.sourceFeiTicketIds,
      updatedAt: input.operatedAt,
    }

    if (input.actionCode === 'BINDING_CONFIRM_RECEIVE') {
      createWaitProcessWarehouseRecord({
        ...common,
        objectType: '面料',
        qtyUnit: '米',
        currentActionName: '确认接收捆条面料',
        targetWarehouseName: '裁床捆条待加工仓',
        plannedObjectQty: order.requiredMaterialLength,
        receivedObjectQty: order.receivedMaterialLength,
        availableObjectQty: getBindingOrderAvailableInputMaterialQty(order),
        status: order.status === '加工中' ? '加工中' : '已入仓',
        inboundAt: order.receivedAt,
        remark: `捆条加工单 ${order.bindingOrderNo} 的面料投入，按米记录。`,
      })
    }

    if (input.actionCode === 'BINDING_PROCESS_REPORT') {
      const waitProcess = getWarehouseRecordsByWorkOrderId(order.bindingOrderId)
        .find((record) => record.recordType === 'WAIT_PROCESS')
      if (waitProcess) {
        updateWarehouseRecordQty(waitProcess.warehouseRecordId, {
          receivedObjectQty: order.receivedMaterialLength,
          availableObjectQty: getBindingOrderAvailableInputMaterialQty(order),
          status: '加工中',
          updatedAt: input.operatedAt,
        })
      }
      createWaitHandoverWarehouseRecord({
        ...common,
        objectType: '捆条',
        qtyUnit: '米',
        currentActionName: '捆条加工填报',
        targetWarehouseName: '捆条待交出仓',
        plannedObjectQty: order.plannedOutputQty,
        receivedObjectQty: order.actualOutputQty,
        availableObjectQty: Math.max(order.actualOutputQty - (order.handedOverQty || 0), 0),
        handedOverObjectQty: order.handedOverQty || 0,
        status: '待交出',
        inboundAt: input.operatedAt,
        remark: `捆条加工单 ${order.bindingOrderNo} 的加工后捆条，按米记录。`,
      })
    }

    if (input.actionCode === 'BINDING_SUBMIT_HANDOVER') {
      let waitHandover = getWarehouseRecordsByWorkOrderId(order.bindingOrderId)
        .find((record) => record.recordType === 'WAIT_HANDOVER')
      if (!waitHandover) {
        waitHandover = createWaitHandoverWarehouseRecord({
          ...common,
          objectType: '捆条',
          qtyUnit: '米',
          currentActionName: '捆条加工填报',
          targetWarehouseName: '捆条待交出仓',
          plannedObjectQty: order.plannedOutputQty,
          receivedObjectQty: order.actualOutputQty,
          availableObjectQty: Math.max(order.actualOutputQty - (order.handedOverQty || 0) + Number(input.qty || 0), 0),
          handedOverObjectQty: Math.max((order.handedOverQty || 0) - Number(input.qty || 0), 0),
          status: '待交出',
          inboundAt: input.operatedAt,
        })
      }
      createProcessHandoverRecord({
        ...common,
        warehouseRecordId: waitHandover.warehouseRecordId,
        handoverRecordId: `PHR-BIND-${token(order.bindingOrderId)}-${token(input.confirmationKey)}`,
        handoverRecordNo: `JH-${order.bindingOrderNo}-${String(order.actionRecords?.filter((record) => record.actionCode === 'BINDING_SUBMIT_HANDOVER').length || 1).padStart(2, '0')}`,
        handoverFactoryId: order.factoryId,
        handoverFactoryName: order.factoryName,
        receiveFactoryId: 'WAREHOUSE-CENTRAL-ACCESSORY',
        receiveFactoryName: '中央辅料仓',
        receiveWarehouseName: '中央辅料仓',
        objectType: '捆条',
        handoverObjectQty: Number(input.qty || 0),
        qtyUnit: '米',
        packageQty: 1,
        packageUnit: '卷',
        handoverPerson: input.operatorName,
        handoverAt: input.operatedAt,
        relatedFeiTicketIds: order.sourceFeiTicketIds,
        remark: input.remark || `捆条加工单 ${order.bindingOrderNo} 分批交出。`,
      })
    }
    return order
  } catch (error) {
    restoreBindingProcessOrderStore(orderSnapshot)
    restoreProcessWarehouseMutationState(warehouseSnapshot)
    throw error
  }
}
