import {DYE_PARTNERS,DYE_DEMO_DETAILS} from './dye-work-order-demo-details.ts'
import {calculateYarnWeight} from './yarn-weight.ts'
import type {FactoryReceivingSource,FactoryReceivingSourceLine,ReceivingMaterial} from './factory-receiving-types.ts'
/** Complete named scenarios, deliberately not claims about live warehouse balances. */
export const RECEIVING_YARN_MATERIAL:ReceivingMaterial={sku:'YARN-COTTON-MIXED',name:'粉黑白段染棉纱（演示）',kind:'YARN',imageUrl:'/materials/process-orders/cotton-yarn-cone.jpg',color:'粉/黑/白段染',composition:'100% 棉',specification:'筒装；按实称重量接收',batchNo:'Y260911-01'}
const fabric=(id:string):ReceivingMaterial=>{const d=DYE_DEMO_DETAILS[id];return {sku:d.rawSku,name:d.materialName,kind:'FABRIC',imageUrl:id==='DWO-002'?'/materials/process-orders/white-black-cotton-jersey.jpg':d.outputImage,color:id==='DWO-002'?'本白':d.colorName,composition:d.composition,specification:`幅宽 ${d.widthCm} cm · 克重 ${d.gsm} g/m²`,batchNo:d.batchNo}}
const lace:ReceivingMaterial={sku:'MAT-WATER-DYE-081',name:'15 mm 水溶花边',kind:'ACCESSORY',imageUrl:'/materials/process-orders/white-water-soluble-lace-12-15mm.jpg',color:'本白',composition:'100% 涤纶',specification:'幅宽 15 mm · 克重 130 g/m²',batchNo:'L260911-01'}
export function buildFactoryReceivingDemoSources():FactoryReceivingSource[]{
 const sources:FactoryReceivingSource[]=[]
 function add(n:number,type:FactoryReceivingSource['type'],origin:FactoryReceivingSource['origin'],material:ReceivingMaterial,qty:number,options:{unapproved?:boolean;draft?:boolean;voided?:boolean;unshipped?:boolean;order?:string;target?:string;rollCount?:number;unit?:string}={}){
  const id=`RCV-SRC-${String(n).padStart(3,'0')}`, unit=options.unit||(material.kind==='FABRIC'?'Yard':'kg')
  const rolls=material.kind==='FABRIC'?Array.from({length:options.rollCount||4},(_,i)=>({barcode:`ROLL-260911-${n}-${String(i+1).padStart(2,'0')}`,yard:qty/(options.rollCount||4)*(unit==='米'?1/.9144:1)})):[]
  const line:FactoryReceivingSourceLine={id:`${id}-L1`,material:structuredClone(material),plannedQty:qty,unit,sentQty:options.unshipped?0:qty,rolls,label:material.kind==='FABRIC'?'卷码见逐卷清单':`TAG-260911-${n}`,...(options.order?{dyeOrderId:options.order,productionOrderNo:options.order==='DWO-001'?'PO-202603-086':'PO-202603-088',taskNo:options.order==='DWO-001'?'TASK-DYE-000721':'TASK-DYE-000722'}:{})}
  if(material.kind==='YARN')line.yarn=calculateYarnWeight(qty,{PAPER:0,CONICAL:0,PAGODA:20})
  sources.push({id,documentNo:`${type==='HANDOUT'?'JC':'DB'}-260911-${String(n).padStart(3,'0')}`,type,origin:structuredClone(origin),targetFactoryId:options.target||'ID-F003',targetFactoryName:options.target==='ID-F002'?'MJS':'GTG',createdAt:`2026-09-11 08:${String(n).padStart(2,'0')}:00`,createdBy:origin.kind==='WAREHOUSE'?'GKP 仓管 Sari':'工厂交出员 Dewi',approvedAt:type!=='HANDOUT'&&!options.unapproved?'2026-09-11 09:00:00':undefined,approvedBy:type!=='HANDOUT'&&!options.unapproved?'主管 Budi':undefined,handedOutAt:type==='HANDOUT'&&!options.draft?'2026-09-11 09:15:00':undefined,voidedAt:options.voided?'2026-09-11 09:30:00':undefined,workOrderNo:type==='HANDOUT'?`YH-260911-${n}`:undefined,lines:[line]})
 }
 add(1,'TRANSFER',DYE_PARTNERS.fabric,fabric('DWO-001'),400,{order:'DWO-001'})
 add(2,'TRANSFER',DYE_PARTNERS.fabric,fabric('DWO-002'),400,{order:'DWO-002'})
 add(3,'HANDOUT',DYE_PARTNERS.berys,fabric('DWO-001'),300,{order:'DWO-001',rollCount:3})
 add(4,'TRANSFER',DYE_PARTNERS.fabric,fabric('DWO-001'),400,{unshipped:true})
 add(5,'TRANSFER',DYE_PARTNERS.sea,fabric('DWO-003'),1000,{rollCount:10})
 add(6,'TRANSFER',DYE_PARTNERS.accessory,lace,12.345)
 add(7,'HANDOUT',DYE_PARTNERS.trims,lace,500,{unit:'Yard'})
 add(8,'TRANSFER',{kind:'WAREHOUSE',id:'WH-MAOSHA-001',name:'纱线中央仓',warehouseAttribute:'纱线中央仓'},RECEIVING_YARN_MATERIAL,12)
 add(9,'HANDOUT',DYE_PARTNERS.special,fabric('DWO-001'),200,{rollCount:2})
 add(10,'TRANSFER',DYE_PARTNERS.newCutting,fabric('DWO-003'),365.76,{unit:'米'})
 add(11,'TRANSFER',DYE_PARTNERS.fabric,fabric('DWO-001'),400,{unapproved:true})
 add(12,'HANDOUT',DYE_PARTNERS.cik,fabric('DWO-002'),400,{draft:true})
 add(13,'HANDOUT',DYE_PARTNERS.cik,fabric('DWO-003'),400,{voided:true})
 add(14,'TRANSFER',DYE_PARTNERS.accessory,lace,8.125,{target:'ID-F002'})
 add(15,'HANDOUT',DYE_PARTNERS.berys,fabric('DWO-001'),500,{target:'ID-F002',rollCount:5})
 // One source with two SKU lines, preserving distinct original line identities.
 const multi=structuredClone(sources[0]);multi.id='RCV-SRC-016';multi.documentNo='DB-260911-016';multi.lines=[sources[0].lines[0],sources[1].lines[0]].map((l,i)=>({...structuredClone(l),id:`RCV-SRC-016-L${i+1}`,rolls:l.rolls.map(r=>({...r,barcode:`MULTI-${r.barcode}`}))}));sources.push(multi)
 return sources
}
