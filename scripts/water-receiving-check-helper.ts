import * as water from '../src/data/fcs/water-soluble-task-domain.ts'
import * as receiving from '../src/data/fcs/factory-receiving.ts'
import {confirmFactoryMaterialReceipt} from '../src/data/fcs/factory-receiving-links.ts'
/** Explicit test steps: physical receipt, then a separate start command. */
export function receiveAndStartWaterForCheck(orderId:string,input:{qty:number;receiptId:string;upstreamRecordId?:string;receiverName?:string}){
 try{
  const order=water.getWaterSolubleWorkOrderById(orderId)!
  if(receiving.listFactoryReceipts().some(r=>r.id===input.receiptId))return {ok:false,message:'重复确认'}
  const id=`SRC-${input.receiptId}`,material=water.getWaterSolubleReceivingMaterial(orderId)
  receiving.registerFactoryReceivingSource({id,documentNo:id,type:'TRANSFER',origin:{kind:'WAREHOUSE',id:'WH-FITTING-001',name:'辅料中央仓(GTP)',warehouseAttribute:'辅料中央仓'},targetFactoryId:order.factoryId!,targetFactoryName:order.factoryName!,createdBy:'仓管',createdAt:'2026-09-12 08:00:00',approvedAt:'2026-09-12 08:10:00',lines:[{id:`${id}-L1`,material,plannedQty:input.qty,sentQty:input.qty,unit:order.qtyUnit,waterOrderId:orderId,rolls:[],label:id,taskNo:order.taskNo}]})
  confirmFactoryMaterialReceipt({id:input.receiptId,factoryId:order.factoryId!,operatorName:input.receiverName||'仓管',operatorId:'CHECK-WATER',receivedAt:'2026-09-12 09:00:00',remark:'测试明确登记重量和实测原单数量',lines:[{sourceId:id,sourceLineId:`${id}-L1`,weightKg:input.qty/100,businessQty:input.qty,businessUnit:order.qtyUnit,...receiving.getDefaultFactoryReceiptPosition(order.factoryId!)}]})
  return water.startWaterSoluble(orderId,input.receiverName||'操作员')
 }catch(e){return {ok:false,message:(e as Error).message}}
}
