import { getFabricDemandBoardRows } from '../wls/fabric-demand-board.ts'
import { preInboundSeed } from '../wls/seed/raw-seed.ts'
import { listPmsMaterialPurchaseInventoryPostings,listPmsMaterialPurchaseOrders,type PmsMaterialPurchaseInventoryPosting } from './material-purchase-orders.ts'

/** Read-only procurement view of the existing WLS material stock source. */
export interface PmsMaterialInventoryRow {
  id:string;spu:string;sku:string;name:string;imageUrl:string;largeImageUrl:string
  warehouse:string;warehouseType:string;area:string;location:string;unit:string
  stockQty:number;transitQty:number|null;lockedQty:number|null;availableQty:number|null
  localPostings?:PmsMaterialPurchaseInventoryPosting[]
}
export function listPmsMaterialInventory():PmsMaterialInventoryRow[] {
  const rows:PmsMaterialInventoryRow[]=getFabricDemandBoardRows().flatMap(material=>material.warehouseStocks.map(stock=>({
    id:`${material.id}:${stock.warehouseName}`,spu:material.materialSpu,sku:material.materialSku,name:material.materialName,imageUrl:material.materialImageUrl,largeImageUrl:material.materialLargeImageUrl,
    warehouse:stock.warehouseName,warehouseType:stock.warehouseName.includes('待加工')?'待加工仓':stock.warehouseName==='中转仓'?'中转仓':'原料仓',area:stock.areaName,location:stock.locationCode,unit:stock.unit,
    stockQty:stock.qty,transitQty:null,lockedQty:null,availableQty:null,
  })))
  for(const posting of listPmsMaterialPurchaseInventoryPostings()){
    const existing=rows.find(row=>row.sku===posting.materialCode&&row.warehouse===posting.warehouse&&row.unit===posting.unit)
    if(existing){existing.stockQty=Math.round((existing.stockQty+posting.qty)*10000)/10000;(existing.localPostings??=[]).push(posting)}
    else rows.push({id:`purchase:${posting.id}`,spu:'',sku:posting.materialCode,name:posting.materialName,imageUrl:posting.imageUrl,largeImageUrl:posting.imageUrl,warehouse:posting.warehouse,warehouseType:'未指定',area:'',location:'',unit:posting.unit,stockQty:posting.qty,transitQty:null,lockedQty:null,availableQty:null,localPostings:[posting]})
  }
  return rows
}
export interface PmsMaterialInventoryBarcode {
  barcode:string;qty:number;unit:string;status:string;location:string;inboundNo:string
  sourceKind:'wls'|'local-demo';targetArea?:string;movedAt?:string;movedBy?:string
}
/** Exact SKU, warehouse and unit association; local barcode moves do not change warehouse quantities. */
export function listPmsMaterialInventoryBarcodes(sku:string,warehouse?:string,unit?:string):PmsMaterialInventoryBarcode[] {
  const wls:PmsMaterialInventoryBarcode[]=preInboundSeed.filter(order=>!warehouse||order.inboundWarehouse===warehouse).flatMap(order=>order.productItems.filter(item=>item.sku===sku).flatMap(item=>(item.roll_details||[]).filter(roll=>!unit||roll.unit===unit).map(roll=>({barcode:roll.roll_no,qty:roll.length,unit:roll.unit,status:roll.status||'未记录',location:roll.location_code||'',inboundNo:order.inboundOrderNo,sourceKind:'wls' as const}))))
  const local:PmsMaterialInventoryBarcode[]=listPmsMaterialPurchaseOrders().filter(order=>order.materialCode===sku&&(!unit||order.unit===unit)).flatMap(order=>(order.detailBarcodes||[]).filter(row=>(!warehouse||row.warehouse===warehouse)&&(!unit||row.unit===unit)).map(row=>({barcode:row.code,qty:row.quantity,unit:row.unit,status:row.status,location:'',inboundNo:order.purchaseOrderNo,sourceKind:'local-demo' as const,targetArea:row.targetArea,movedAt:row.movedAt,movedBy:row.movedBy})))
  return [...wls,...local]
}
export async function listPmsMaterialInventoryFlows(sku:string,warehouse:string) {
  const module=await import('../../pages/wls/raw/stock-flow.ts')
  return module.listRawMaterialStockFlows().filter(row=>row.sku===sku&&row.warehouse===warehouse)
}
export async function listPmsMaterialInventoryCounts(sku:string) {
  const module=await import('../../pages/wls/raw/fabric-inventory-count.ts')
  // The current WLS count source stores a scope, but has no per-SKU lines. Do not invent an association.
  return module.listRawFabricInventoryCountRecords().filter(row=>row.scope===sku)
}
