import { confirmPickupNodeReceiptRuntime, type ConfirmPickupNodeReceiptRuntimeInput } from '../../../runtime/fcs/cutting/pickup-management-runtime.ts'
import { runCuttingEventAction } from './cutting-event-repository.ts'
import { buildCuttingWarehouseMapProjectionForWarehouse } from '../../../pages/process-factory/cutting/warehouse-location-map.ts'
import { listWarehouseLocationMapCells, revalidateWarehouseLocationSelection } from '../../../pages/process-factory/cutting/warehouse-location-map-model.ts'
import type { PickupSession } from './pickup-node-domain.ts'
import { warehouseLayoutSourceKeys } from '../../../pages/process-factory/cutting/warehouse-location-layout-store.ts'

/** Original receipt rules, with current locations and all receipt facts committed together. */
export async function confirmCuttingPickupNodeReceipt(input: ConfirmPickupNodeReceiptRuntimeInput & { expectedFactoryId?: string }, options: { assertCurrent?: () => void } = {}): Promise<PickupSession> {
  const original = structuredClone(input)
  return runCuttingEventAction({
    id: `cutting-node-receipt:${original.pickupNodeId}:v${original.pickupNodeVersion}`,
    intent: JSON.stringify(original),
    pickupReceipt: true,
    assertCurrent: options.assertCurrent,
    action: storage => {
      options.assertCurrent?.()
      const first = original.toLocationRefs[0]
      if (!first || original.toLocationRefs.some(ref => ref.factoryId !== first.factoryId || ref.warehouseId !== first.warehouseId || ref.warehouseKind !== 'WAIT_PROCESS')) throw new Error('请选择同一裁床待加工仓的当前库位。')
      if (original.expectedFactoryId && first.factoryId !== original.expectedFactoryId) throw new Error('所选库位不属于当前工厂，请重新选择。')
      for (const key of warehouseLayoutSourceKeys(first.factoryId, 'WAIT_PROCESS', first.warehouseId)) storage.getItem(key)
      const current = buildCuttingWarehouseMapProjectionForWarehouse('WAIT_PROCESS', first.warehouseId)
      if (!current || current.warehouse.factoryId !== first.factoryId) throw new Error('当前待加工仓已不可用，请重新选择。')
      const selection = revalidateWarehouseLocationSelection(current.projection, original.toLocationRefs.map(ref => ref.locationId))
      if (!selection.ok) throw new Error(selection.message)
      const cells = listWarehouseLocationMapCells(current.projection)
      if (original.toLocationRefs.some(ref => !cells.some(cell => cell.factoryId === ref.factoryId && cell.warehouseId === ref.warehouseId && cell.locationId === ref.locationId
        && cell.areaId === ref.areaId && cell.areaName === ref.areaName && cell.shelfId === ref.shelfId && cell.shelfNo === ref.shelfNo && cell.locationNo === ref.locationNo))) throw new Error('所选库位资料已变化，请重新选择。')
      return confirmPickupNodeReceiptRuntime(original, storage)
    },
    validate: ({ result, after }) => {
      const node = result.pickupNodeSnapshot
      if (!node || node.nodeId !== original.pickupNodeId || node.version !== original.pickupNodeVersion || result.receiverName !== original.receiverName.trim()
        || result.pickupRecordIds.length !== node.items.length || !result.storageFootprint || JSON.stringify(result.toLocationRefs) !== JSON.stringify(original.toLocationRefs)) throw new Error('接收节点、实物或责任信息不完整，全部未保存。')
      for (const item of node.items) {
        const events = after.filter(event => event.eventType === '中转仓接收' && event.refs.handoverRecordId === `${result.pickupSessionId}:${item.prepLineId}`)
        if (events.length !== 1 || events[0].inventoryEffect?.direction !== 'IN' || events[0].inventoryEffect?.qty !== item.currentAvailableQty
          || events[0].inventoryEffect?.unit !== item.unit || events[0].operatorName !== result.receiverName || events[0].material?.materialSku !== item.materialSku) throw new Error('接收明细与入仓流水不一致，全部未保存。')
      }
    },
  })
}
