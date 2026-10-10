// SOURCE-001/002/003 QTY-003/004/005：有效装袋票源契约，原裁剪产量不可直接贡献。
import assert from 'node:assert/strict'
import {buildGeneratedCutReleaseInputs} from '../src/data/fcs/cutting/generated-cut-release.ts'
import {buildReleaseMatrix} from '../src/data/fcs/cut-piece-release-domain.ts'
import {buildTicketReleaseFacts,type ReleaseBagEvidence,projectReleaseTicket} from '../src/data/fcs/cutting/cut-piece-release-facts.ts'
const source:any={productionOrderId:'NEW',productionOrderNo:'PO-NEW',cutOrderId:'CUT-A',cutOrderNo:'CUT-A',spuCode:'SPU',styleName:'test',materialSku:'MAT',materialName:'面料',sourceBomItemIds:['BOM-A'],skuScopeLines:[{skuCode:'SKU-S',color:'Black',size:'S',plannedQty:6},{skuCode:'SKU-XL',color:'Black',size:'XL',plannedQty:4}],pieceRows:[['front',1],['back',1],['sleeve',2]].map(([partCode,pieceCountPerUnit])=>({partCode,partName:partCode,pieceCountPerUnit,applicableSkuCodes:[]}))}
const tickets:any[]=['S','XL'].flatMap(size=>source.pieceRows.map((part:any)=>({feiTicketId:`${size}-${part.partCode}`,feiTicketNo:`FT-${size}-${part.partCode}`,productionOrderId:'NEW',cutOrderId:'CUT-A',sourceBasisType:'ACTUAL_CUTTING_OUTPUT',spreadingOrderNo:'PB-1',garmentColor:'Black',skuSize:size,partCode:part.partCode,partName:part.partCode,actualCutPieceQty:(size==='S'?6:4)*part.pieceCountPerUnit,issuedAt:'2026-10-09T00:00:00Z',specialCrafts:[],hasSpecialCraft:false,printStatus:'PRINTED',fabricColor:'面料白',materialSku:'MAT',materialIdentity:{materialName:'面料'},partInstanceNo:''})))
const detail=(ticket:any,bagged=true)=>projectReleaseTicket({ticket,materialId:'MAT',materialName:'面料',bag:bagged?{ticketId:ticket.feiTicketId,bagCode:'BAG',eventId:'PACK',at:ticket.issuedAt,operator:'Agus',locationLabel:'架1'}:undefined,receipts:[],craftRequirementKnown:true})
const project=(s:any[],ts:any[],bagged=true)=>buildGeneratedCutReleaseInputs(s,[],{tickets:ts,details:ts.map(ticket=>detail(ticket,bagged))})[0].input
let p=project([source],tickets);assert.equal(p.facts.reduce((sum,x)=>sum+x.actualPieceQty,0),40);assert.deepEqual(buildReleaseMatrix(p).colorGroups[0].completeKitBySize,{S:6,XL:4});assert.deepEqual(project([source],[...tickets,...tickets]),p)
assert.equal(project([source],tickets,false).facts.length,0,'未装袋的实际裁剪票不可计入')
const missing=tickets.filter(x=>x.feiTicketId!=='S-sleeve');assert.equal(buildReleaseMatrix(project([source],missing)).colorGroups[0].completeKitBySize.S,0,'已知缺部位显示零，其他部位不能掩盖')
const branch={...source,cutOrderId:'CUT-B',sourceBomItemIds:['BOM-B']};assert.equal(buildReleaseMatrix(project([source,branch],tickets)).colorGroups[0].completeKitBySize.S,0,'BOM不同分支不得互补')
assert.equal(project([source],[...tickets,{...tickets[0],feiTicketId:'OTHER',productionOrderId:'OTHER',actualCutPieceQty:999}]).facts.reduce((sum,x)=>sum+x.actualPieceQty,0),40)
const manual=tickets.map(ticket=>({...ticket,sourceBasisType:'MANUAL_MARKER_PLAN',spreadingOrderNo:'',manualUpdatedAt:ticket.issuedAt}))
assert.equal(project([source],manual).facts.reduce((sum,x)=>sum+x.actualPieceQty,0),40,'合法手动票装袋可贡献且不伪造铺布')
assert.ok(project([source],manual).facts.every(fact=>fact.spreadingOrderNo===''))
assert.equal(buildReleaseMatrix(project([{...source,pieceRows:[]}],tickets)).calculationStatus,'数据不完整')
assert.equal(project([source],[]).facts.length,0)
const instances=tickets.filter(ticket=>ticket.skuSize==='S').flatMap(ticket=>ticket.partCode==='sleeve'?[{...ticket,feiTicketId:ticket.feiTicketId+'1',partInstanceNo:'1',actualCutPieceQty:12}]:[ticket])
assert.equal(buildReleaseMatrix(project([source],instances)).colorGroups[0].completeKitBySize.S,0,'左袖双倍不能补缺失右袖')
assert.equal(buildReleaseMatrix(project([source],[],true)).colorGroups[0].completeKitBySize.S,0)
const leftRight=instances.flatMap(ticket=>ticket.partCode==='sleeve'?[{...ticket,partInstanceNo:'左',actualCutPieceQty:6},{...ticket,feiTicketId:ticket.feiTicketId+'R',feiTicketNo:ticket.feiTicketNo+'R',partInstanceNo:'右',actualCutPieceQty:5}]:[ticket])
assert.equal(buildReleaseMatrix(project([source],leftRight)).colorGroups[0].completeKitBySize.S,5,'明确左右标签各自满足，右袖5片是短板')
const wrongIdentity=tickets.map(ticket=>detail(ticket));wrongIdentity[0]={...wrongIdentity[0],garmentColor:'其他色'}
assert.equal(buildReleaseMatrix(buildGeneratedCutReleaseInputs([source],[],{tickets,details:wrongIdentity})[0].input).calculationStatus,'数据不完整','错成衣颜色身份不能借票或当正常0')
const initialScope={initialOrderIds:new Set(['NEW'])}
assert.equal(buildGeneratedCutReleaseInputs([source],[],{tickets:[],details:[]},initialScope).length,0,'没有现场票的初始演示订单保留原演示')
assert.equal(buildGeneratedCutReleaseInputs([source],[],{tickets:tickets.map(ticket=>({...ticket,printStatus:'UNPRINTED'})),details:[]},initialScope).length,0,'未打印的自动票不能激活实际数量')
assert.equal(buildGeneratedCutReleaseInputs([source],[],{tickets:[{...tickets[0],productionOrderId:'OTHER'}],details:[]},initialScope).length,0,'错生产单票不能借裁剪单激活')
const active=buildGeneratedCutReleaseInputs([source,branch],[],{tickets:[manual[0]],details:[detail(manual[0])]},initialScope)[0].input
assert.equal(active.requirements.length,12,'真实手动票激活整单全部正式BOM与尺码部位，不只保留已出现部位')
assert.equal(buildReleaseMatrix(active).colorGroups[0].completeKitBySize.S,0,'单独前片不能算整件齐套')
assert.equal(buildGeneratedCutReleaseInputs([source],[],{tickets:[tickets[0]],details:[]},initialScope).length,1,'已打印自动票进入正式数量')
assert.equal(buildGeneratedCutReleaseInputs([source],[],{tickets:[],details:[]},{...initialScope,currentOrderIds:new Set(['NEW'])})[0].input.facts.length,0,'已进入实际口径的订单归零后不能回退演示数量')
console.log('PASS 有效装袋40片→S6 XL4；未装袋排除；去重/外单/BOM隔离/左右实例；手动来源与缺资料/已知零')
