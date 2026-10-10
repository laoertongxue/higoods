import test from 'node:test'
import assert from 'node:assert/strict'
import {getCutPieceDispatchReadinessForTask,assertCutPieceReleaseDispatchAvailable} from '../../src/data/fcs/cut-piece-release.ts'
const line={skuCode:'ASYSA26060310-Black-M',color:'Black',size:'M',qty:150}
const command=(skuLines:any[])=>({productionOrderId:'po-14671',productionOrderNo:'PO14671',skuLines})
test('共享分配门禁拒绝同SKU错色码或错生产单身份',()=>{assert.equal(getCutPieceDispatchReadinessForTask(command([line])).canDispatch,true);for(const wrong of [{...line,color:'其他成衣色'},{...line,size:'其他码'}]){const input=command([wrong]);assert.equal(getCutPieceDispatchReadinessForTask(input).canDispatch,false);assert.throws(()=>assertCutPieceReleaseDispatchAvailable(input))}assert.equal(getCutPieceDispatchReadinessForTask({...command([line]),productionOrderId:'WRONG'}).canDispatch,false)})
test('共享保存拒绝重复借同格，空身份与非法数量',()=>{for(const lines of [[line,line],[line,{...line,skuCode:'ALIAS'}],...[NaN,-1,0,1.5].map(qty=>[{...line,qty}]),[{...line,skuCode:''}],[{...line,color:''}],[{...line,size:''}]]){assert.equal(getCutPieceDispatchReadinessForTask(command(lines)).canDispatch,false);assert.throws(()=>assertCutPieceReleaseDispatchAvailable(command(lines)))}})
