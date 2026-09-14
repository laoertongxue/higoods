import type { WaterSolubleWorkOrder } from './water-soluble-task-domain.ts'
import type { ProcessDispatchDocument, ProcessOutputRoll } from './process-output-types.ts'
import { resolveTerminalProcessOrderReceivingTarget } from './process-order-receiving-target.ts'

/** 具名本地演示案例；沿用原水溶单的款式/BOM物料，保留原三条执行案例。 */
export function addWaterOutputDemoOrders(store: Map<string, WaterSolubleWorkOrder>): void {
  const sources = [...store.values()]
  for (let n = 1; n <= 4; n++) {
    const source = sources[(n - 1) % sources.length]
    if (!source) continue
    const id = `WATER-OUTPUT-DEMO-${n}`, no = `SRJG-20260914-DEMO-${String(n).padStart(3,'0')}`
    const at = '2026-09-14 08:30:00', qty = [240,180,120,160][n-1]
    const rolls: ProcessOutputRoll[] = [1,2].map(i => ({ id:`${id}-R${i}`,barcode:`${no}_${String(i).padStart(4,'0')}`,rollNo:String(i).padStart(4,'0'),qty:qty/2,weightKg:0,widthCm:1.5,gsm:0,vatNo:'',remark:'本白水溶花边，按实物卷长交接',createdAt:at,...(n!==4?{printedAt:'2026-09-14 08:35:00',printedBy:'水溶仓管 Budi'}:{}) }))
    const order: WaterSolubleWorkOrder = { ...structuredClone(source),sourceArtifactId:`PREPART-WATER-OUTPUT-DEMO-${n}`,handoverDemoSourceOrderId:source.waterOrderId,waterOrderId:id,waterOrderNo:no,generationKey:id,taskId:`TASK-${id}`,taskNo:`TASK-SR-${n.toString().padStart(4,'0')}`,taskQrValue:`TASK:${`TASK-${id}`}`,factoryId:'F090',factoryName:'测试专用工厂',acceptanceStatus:'ACCEPTED',acceptedAt:'2026-09-14 08:00:00',acceptedBy:'水溶仓管 Budi',plannedQty:qty,completedQty:qty,inputQty:qty,qtyUnit:'米',handoverQty:0,receivedQty:0,handoverBatches:[],handoverOrderId:undefined,status:'WAIT_HANDOVER',exceptionReason:undefined,supervisorDecision:undefined,createdAt:'2026-09-14 07:30:00',updatedAt:at,outputRolls:rolls,nextOutputRollNo:3,dispatchDocuments:[],materialReceipts:[{receiptId:`${id}-INPUT`,qty,receiverName:'水溶仓管 Budi',receivedAt:'2026-09-14 08:00:00'}],actionLogs:[{action:'创建水溶演示单',detail:`演示来源 ${source.waterOrderNo}；沿用其款式和水溶花边`,at:'2026-09-14 07:30:00',operatorName:'计划员 Lilis'},{action:'开始水溶',detail:`投入 ${qty} 米`,at:'2026-09-14 08:10:00',operatorName:'水溶操作员 Sari'},{action:'完成水溶',detail:`完成 ${qty} 米，2 卷`,at,operatorName:'水溶操作员 Sari'}] }
    if(n===3){
      const target=resolveTerminalProcessOrderReceivingTarget({sourceType:'PRODUCTION_ORDER',productionOrderNo:order.productionOrderNo})
      const doc: ProcessDispatchDocument={id:'SJ-SR-20260914-001',status:'草稿',createdAt:'2026-09-14 08:45:00',operator:'水溶仓管 Budi',transport:{driver:'Agus',vehicle:'厢式货车',plate:'B 8261 KJ',note:'本白水溶花边，按卷核对'},scans:[],lines:[{orderId:id,orderNo:no,taskNo:order.taskNo,factoryId:'F090',factoryName:'测试专用工厂',receiver:target.targetName,partner:{kind:'WAREHOUSE',id:target.targetBusinessId,name:target.targetName,warehouseAttribute:'裁床配套中转仓'},sku:order.materialCode,unit:order.qtyUnit,rolls:structuredClone(rolls)}]}
      order.dispatchDocuments=[doc]
    }
    store.set(order.generationKey,order)
  }
}
