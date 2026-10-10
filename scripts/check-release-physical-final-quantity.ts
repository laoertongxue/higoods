import assert from 'node:assert/strict'
import {buildReleaseMatrix,buildTargetPreview,buildSupplementPartShortages,type BuildReleaseMatrixInput} from '../src/data/fcs/cut-piece-release-domain.ts'
const input:BuildReleaseMatrixInput={productionOrderId:'PO-TEST',productionOrderNo:'TEST',spuCode:'SPU',factsComplete:true,planQtyByColorSize:{红:{XL:100,S:100,M:100,L:100}},requirements:[{materialId:'A',materialName:'主料',partId:'front',partName:'前片',piecesPerGarment:1},{materialId:'B',materialName:'袖料',partId:'sleeve',partName:'袖片',piecesPerGarment:2}],facts:[{factId:'front',sourceEventId:'t1',productionOrderId:'PO-TEST',garmentColor:'红',size:'M',materialId:'A',partId:'front',actualPieceQty:0,physicalPieceQty:100,direction:'正向',sourceStatus:'持续更新',occurredAt:'2026-10-09T00:00:00Z'},{factId:'sleeve',sourceEventId:'t2',productionOrderId:'PO-TEST',garmentColor:'红',size:'M',materialId:'B',partId:'sleeve',actualPieceQty:180,physicalPieceQty:180,direction:'正向',sourceStatus:'持续更新',occurredAt:'2026-10-09T00:00:00Z'}]}
const matrix=buildReleaseMatrix(input)
assert.deepEqual(matrix.colorGroups[0].sizes,['S','M','L','XL'])
assert.equal(matrix.colorGroups[0].completeKitBySize.M,0,'未最终回仓不能计入 K')
assert.equal(matrix.colorGroups[0].materialRows[0].cells.find(x=>x.size==='M')!.physicalGarmentQty,100,'已装袋待工艺仍支持 C')
const preview=buildTargetPreview(matrix,{'红::M':100})
assert.equal(buildSupplementPartShortages(matrix,preview).length,1,'等待工艺前片不得误计补裁缺口')
assert.equal(buildSupplementPartShortages(matrix,preview)[0].actualMissingPieceQty,20)
assert.equal(matrix.colorGroups[0].completeKitBySize.S,0,'完整来源下没有有效票为已知 0')
assert.throws(()=>buildTargetPreview(matrix,{'红::M':100.5}))
assert.equal(buildReleaseMatrix({...input,factsComplete:false,facts:[]}).colorGroups[0].completeKitBySize.M,null,'未知来源保留 null')
assert.equal(buildReleaseMatrix({...input,facts:[{...input.facts[0],actualPieceQty:-1}]}).calculationStatus,'数据不完整')
const unknownCraft=buildReleaseMatrix({...input,facts:[{...input.facts[0],ticketDetail:{craftRequirementKnown:false} as any},input.facts[1]]})
assert.equal(unknownCraft.colorGroups[0].materialRows[0].cells.find(x=>x.size==='M')!.physicalGarmentQty,100,'缺工艺资料不抹去已知实物 C')
assert.equal(unknownCraft.colorGroups[0].completeKitBySize.M,null,'缺工艺资料 K 必须待核对')
assert.doesNotThrow(()=>buildTargetPreview(unknownCraft,{'红::M':100}))
// S01 / S08：完整三部位及奇数实收，按现场片数核对件数和短板。
const complete={...input,requirements:[{materialId:'A',materialName:'主料',partId:'front',partName:'前片',piecesPerGarment:1},{materialId:'A',materialName:'主料',partId:'back',partName:'后片',piecesPerGarment:1},{materialId:'B',materialName:'袖料',partId:'sleeve',partName:'袖片',piecesPerGarment:2}],facts:[{...input.facts[0],actualPieceQty:100,physicalPieceQty:100},{...input.facts[0],factId:'back',sourceEventId:'t3',partId:'back',actualPieceQty:100,physicalPieceQty:100},{...input.facts[1],actualPieceQty:200,physicalPieceQty:200}]}
assert.equal(buildReleaseMatrix(complete).colorGroups[0].completeKitBySize.M,100,'S01：100/100/200片，单耗1/1/2，只支持100件')
const odd=buildReleaseMatrix({...complete,facts:complete.facts.map(f=>f.partId==='sleeve'?{...f,actualPieceQty:95,physicalPieceQty:95}:f)})
assert.equal(odd.colorGroups[0].completeKitBySize.M,47,'S08：95片且每件2片，不能四舍五入成48件或直接当95件')
assert.equal(odd.colorGroups[0].materialRows.find(r=>r.materialId==='B')?.cells.find(c=>c.size==='M')?.physicalGarmentQty,47,'实物候选同样按单耗向下取整')
console.log('物理候选/最终齐套/整数/尺码/已知零/缺资料契约通过')
