import {test} from 'node:test'
import assert from 'node:assert/strict'
import {setGeneratedCutReleaseReader,getCutPieceReleaseMatrix,recordCutOrderReleaseStatusChange,listLateCutPieceReleaseEvents,listCutPieceReleaseMatrixVersions,confirmCutPieceReleaseTarget,getCutPieceReleaseSupplementBasis,getCutPieceReleaseTargetSnapshot} from '../../src/data/fcs/cut-piece-release.ts'
const po='PO-FROZEN-BOUNDARY',cut='CUT-FROZEN-BOUNDARY'
const detail=(id:string,qty:number):any=>({ticketId:id,ticketNo:id,sourceType:'手动唛架',sourceNo:'MARKER1',cutOrderNo:cut,garmentColor:'红',size:'M',fabricColor:'白',materialId:'MAT::BOM',materialName:'主料',partId:'FRONT',partName:'前片',printedPieceQty:100,physicalPieceQty:qty,eligiblePieceQty:qty,validity:'可用',bagCode:'BAG1',requiresSpecialCraft:true,craftRequirementKnown:true,completionEvidenceKnown:true,craftSteps:[]})
const fact=(id:string,qty:number):any=>({factId:id,sourceEventId:id,productionOrderId:po,cutOrderId:cut,cutOrderNo:cut,garmentColor:'红',size:'M',materialId:'MAT::BOM',partId:'FRONT',actualPieceQty:qty,physicalPieceQty:qty,ticketDetail:detail(id,qty),direction:'正向',sourceStatus:'持续更新',occurredAt:'2026-10-09T05:00:00Z'})
let facts=[fact('FT-OLD',100)]
const source:any={productionOrderId:po,productionOrderNo:po,cutOrderId:cut,cutOrderNo:cut,styleName:'测试款',materialSku:'MAT',skuScopeLines:[{color:'红',size:'M',skuCode:'SKU-RED-M'}]}
setGeneratedCutReleaseReader(()=>[{input:{productionOrderId:po,productionOrderNo:po,spuCode:'SPU',planQtyByColorSize:{红:{M:100}},requirements:[{materialId:'MAT::BOM',materialName:'主料',partId:'FRONT',partName:'前片',piecesPerGarment:1,garmentColor:'红',size:'M'}],facts:structuredClone(facts),factsComplete:true},sources:[source],latestAt:'2026-10-09T05:00:00Z',operator:'仓管'}])
test('冻结原票的真实仓库实收继续更新；冻结后新票进晚到队列，不冒充原产出',()=>{
 assert.equal(getCutPieceReleaseMatrix(po)!.colorGroups[0].completeKitBySize.M,100)
 const target=confirmCutPieceReleaseTarget({productionOrderId:po,matrixVersion:listCutPieceReleaseMatrixVersions(po).at(-1)!.version,colorSizeTargets:{'红::M':100},confirmedBy:'主管'});assert.equal(target.ok,true)
 assert.equal(recordCutOrderReleaseStatusChange({eventId:'FREEZE1',cutOrderId:cut,cutOrderNo:cut,status:'已冻结',occurredAt:'2026-10-09T06:00:00Z',operator:'主管',reason:'裁剪依据冻结'}).status,'applied')
 facts=[fact('FT-OLD',90),fact('FT-LATE',20)]
 const matrix=getCutPieceReleaseMatrix(po)!
 assert.equal(matrix.colorGroups[0].completeKitBySize.M,90)
 const basis=getCutPieceReleaseSupplementBasis(target.snapshot!.snapshotId)!;assert.equal(basis.targetPreview.colorSizeTargets['红::M'],100);assert.equal(basis.targetPreview.differences[0].differenceQty,-10);assert.equal(getCutPieceReleaseTargetSnapshot(target.snapshot!.snapshotId)!.matrixSnapshot.colorGroups[0].completeKitBySize.M,100,'历史目标不改写');
 assert.equal(matrix.colorGroups[0].materialRows[0].cells[0].sourceStatus,'已冻结')
 const late=listLateCutPieceReleaseEvents(po);assert.equal(late.length,1);assert.equal(late[0].ticketId,'FT-LATE');assert.equal(late[0].spreadingOrderNo,'');assert.equal(late[0].sourceType,'手动唛架')
 const count=listCutPieceReleaseMatrixVersions(po).length;getCutPieceReleaseMatrix(po);assert.equal(listCutPieceReleaseMatrixVersions(po).length,count,'重复读取不得增加矩阵事件')
})
