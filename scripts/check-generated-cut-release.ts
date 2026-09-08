// EXEC-007/008/010：隔离技术契约，不创建浏览器业务记录。
import assert from 'node:assert/strict'
import {buildGeneratedCutReleaseInputs} from '../src/data/fcs/cutting/generated-cut-release.ts'
import {buildReleaseMatrix} from '../src/data/fcs/cut-piece-release-domain.ts'
const source:any={productionOrderId:'NEW',productionOrderNo:'PO-NEW',cutOrderId:'CUT-A',cutOrderNo:'CUT-A',spuCode:'SPU',styleName:'test',materialSku:'MAT',materialName:'面料',sourceBomItemIds:['BOM-A'],skuScopeLines:[{skuCode:'SKU-S',color:'Black',size:'S',plannedQty:6},{skuCode:'SKU-XL',color:'Black',size:'XL',plannedQty:4}],pieceRows:[['front',1],['back',1],['sleeve',2]].map(([partCode,pieceCountPerUnit])=>({partCode,partName:partCode,pieceCountPerUnit,applicableSkuCodes:[]}))}
const outputs:any[]=['S','XL'].flatMap(size=>source.pieceRows.map((part:any)=>({outputLineId:`${size}-${part.partCode}`,productionOrderId:'NEW',cutOrderId:'CUT-A',sourceBasisType:'ACTUAL_CUTTING_OUTPUT',sourceSpreadingSessionNo:'PB-1',garmentColor:'Black',sizeCode:size,partCode:part.partCode,actualCutPieceQty:(size==='S'?6:4)*part.pieceCountPerUnit,createdAt:'2026-09-08 00:01',createdBy:'Agus'})))
const project=(s:any[],o:any[])=>buildGeneratedCutReleaseInputs(s,o)[0].input
let p=project([source],outputs);assert.equal(p.facts.reduce((s,x)=>s+x.actualPieceQty,0),40);assert.deepEqual(buildReleaseMatrix(p).colorGroups[0].completeKitBySize,{S:6,XL:4});assert.deepEqual(project([source],[...outputs,...outputs]),p)
const missing=outputs.filter(x=>x.outputLineId!=='S-sleeve');assert.equal(buildReleaseMatrix(project([source],missing)).colorGroups[0].completeKitBySize.S,null)
const branch={...source,cutOrderId:'CUT-B',sourceBomItemIds:['BOM-B']};assert.equal(buildReleaseMatrix(project([source,branch],outputs)).colorGroups[0].completeKitBySize.S,null)
assert.equal(project([source],[...outputs,{...outputs[0],productionOrderId:'OTHER',actualCutPieceQty:999},{...outputs[0],sourceBasisType:'MANUAL_MARKER_PLAN',actualCutPieceQty:999}]).facts.reduce((s,x)=>s+x.actualPieceQty,0),40)
assert.equal(buildReleaseMatrix(project([{...source,pieceRows:[]}],outputs)).calculationStatus,'数据不完整')
assert.equal(project([source],[]).facts.length,0)
console.log('PASS original quantities 40 pieces -> S6 XL4; duplicate/foreign/manual excluded; missing part/BOM branch blocked; missing requirement incomplete; no actual output not fabricated')
