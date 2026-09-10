import assert from 'node:assert/strict'
import { getFilteredPrintingWorkOrders, refreshPrintingWorkOrderListPage } from '../src/pages/process-factory/printing/work-orders.ts'
import { printingUpstreamNames } from '../src/pages/process-factory/printing/relations.ts'
import { changePrintingInput } from '../src/data/fcs/printing-work-order-business.ts'
const first = getFilteredPrintingWorkOrders()
const source = printingUpstreamNames(first[0])
for(let i=0;i<10;i++) {
 assert.equal(getFilteredPrintingWorkOrders()[0],first[0], '筛选复用本页事实对象，不重复全量投影')
 assert.equal(printingUpstreamNames(first[0]),source,'同一事实的上游读取只发生一次')
}
refreshPrintingWorkOrderListPage(false)
assert.equal(getFilteredPrintingWorkOrders()[0],first[0])
const target = first.find(row=>row.output.completedQty===0)!
changePrintingInput(target.workOrderId,{newSku:target.plannedInput.sku,newMaterialName:'快照重新载入验证物料',newImageUrl:target.plannedInput.imageUrl,newGsm:target.plannedInput.gsm,newWidthCm:target.plannedInput.widthCm,newOrderUnitUsage:target.usage.orderUnitUsage,newPlannedQty:target.plannedInput.plannedQty,reason:'专项核对业务保存后的新投影',operatorName:'专项检查'})
refreshPrintingWorkOrderListPage()
const next=getFilteredPrintingWorkOrders().find(row=>row.workOrderId===target.workOrderId)!
assert.notEqual(next,target)
assert.equal(next.plannedInput.materialName,'快照重新载入验证物料')
assert.notEqual(printingUpstreamNames(next),source,'新投影不沿用旧对象缓存')
console.log('PASS 筛选/选择局部刷新复用快照，上游仅取一次，业务刷新重新读取已修改事实')
