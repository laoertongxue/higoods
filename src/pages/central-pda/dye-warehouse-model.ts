import { getDyeingWarehouseView } from '../../data/fcs/dyeing-warehouse-view.ts'
import { listFactoryInternalWarehouses } from '../../data/fcs/factory-internal-warehouse.ts'
import { withWashingStaticRead } from '../../data/fcs/fabric-washing-storage-bridge.ts'
import { listCentralDyeFacts } from './dye-model.ts'

/** Read the same actual balances and registry as Web; never allocate output
 * summaries or historical unlocated stock to an invented shelf. */
export function centralDyeWarehouse(factoryId: string) {
  return withWashingStaticRead(() => {
    const facts = listCentralDyeFacts(factoryId), ids = new Set(facts.map(fact => fact.order.dyeOrderId))
    const view = getDyeingWarehouseView({ factoryId })
    return {
      warehouses: listFactoryInternalWarehouses().filter(warehouse => warehouse.factoryId === factoryId),
      input: view.waitProcessItems.filter(item => ids.has(item.sourceRecordId)).map(item => ({ ...item,
        orderNo: facts.find(fact => fact.order.dyeOrderId === item.sourceRecordId)!.order.dyeOrderNo })),
      output: view.waitHandoverItems.filter(item => ids.has(item.stockItemId.replace(/^DYE-OUTPUT-/, ''))),
      uses: view.usageRecords.filter(item => ids.has(item.sourceRecordId)).map(item => {
        const nodes = facts.find(fact => fact.order.dyeOrderId === item.sourceRecordId)!.nodes
        const people = new Set(nodes.filter(node => node.nodeCode === 'DYE' && node.startedAt === item.usedAt
          && (node.startedByName || node.operatorName) === item.usedBy).map(node => node.startedByUserId || node.operatorUserId).filter(Boolean))
        return { ...item, usedByUserId: people.size === 1 ? [...people][0] : undefined }
      }),
      facts,
    }
  })
}
