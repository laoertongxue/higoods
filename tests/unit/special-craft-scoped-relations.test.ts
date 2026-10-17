import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { getProcessOrderTaskRelationView, withProcessOrderTaskRelationRead } from '../../src/data/fcs/process-order-task-links.ts'
import { listSpecialCraftTaskOrders } from '../../src/data/fcs/special-craft-task-orders.ts'

test('已知生产单的详情关系读取直接限定范围，不先全量枚举准备单', () => {
  const source=readFileSync(new URL('../../src/data/fcs/process-order-task-links.ts',import.meta.url),'utf8')
  const ast=ts.createSourceFile('relations.ts',source,ts.ScriptTarget.Latest,true)
  const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='getProcessOrderTaskRelationView')!
  const javascript=ts.transpileModule(node.getText(ast).replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const expected={documentId:'AUX-ONE',productionOrderId:'PO-ONE'}
  const read=new Function('dependencies',`with(dependencies){${javascript};return getProcessOrderTaskRelationView}`)({
    readRuntimeTaskById:()=>undefined,processTasks:[],
    readRelationSources:()=>{throw Error('详情在已知生产单时全量枚举了无关准备单')},
    buildDocumentRefs:(productionOrderId:string)=>{assert.equal(productionOrderId,'PO-ONE');return [expected]},
    buildProcessOrderTaskRelationViewFromDocuments:(documentId:string,documents:unknown[])=>{assert.equal(documentId,'AUX-ONE');assert.deepEqual(documents,[expected]);return expected},
  })
  assert.equal(read('AUX-ONE','PO-ONE'),expected)
})

test('全部136张普通辅助和特种单限定生产单后，来源上下游及明细与原完整关系相同', () => {
  const orders=listSpecialCraftTaskOrders().filter(order=>!order.woolPieceKey)
  assert.equal(orders.length,136)
  const expected=withProcessOrderTaskRelationRead(()=>orders.map(order=>getProcessOrderTaskRelationView(order.taskOrderId)))
  for(const [i,order] of orders.entries()) assert.deepEqual(getProcessOrderTaskRelationView(order.taskOrderId,order.productionOrderId),expected[i],order.taskOrderNo)
  assert.equal(getProcessOrderTaskRelationView('missing-document','missing-production-order'),undefined)
})

test('已知生产路线只初始化实际工序，缺路线仍完整恢复而不猜测为空', () => {
  const source=readFileSync(new URL('../../src/data/fcs/process-order-task-links.ts',import.meta.url),'utf8')
  const ast=ts.createSourceFile('relations.ts',source,ts.ScriptTarget.Latest,true)
  const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='buildDocumentRefs')!
  const javascript=ts.transpileModule(node.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  for(const route of [[{processCode:'CUT_PANEL'},{processCode:'SEW'}],[]]) {
    const stopped=Symbol('read boundary');let observed:unknown
    const read=new Function('dependencies',`with(dependencies){${javascript};return buildDocumentRefs}`)({
      listGeneratedCutOrderSourceRecords:()=>[],listSpecialCraftTaskOrders:()=>[],
      getProductionOrderProcessEntries:()=>route,removePredeterminedWashing:(entries:unknown)=>entries,
      listWoolWorkOrders:()=>[],listCurrentLaceFormalRouteSnapshots:()=>[],
      readRelationSources:(codes:unknown)=>{observed=codes;throw stopped},
    })
    assert.throws(()=>read('PO-ONE'),error=>error===stopped)
    assert.deepEqual(observed,route.length?new Set(['CUT_PANEL','SEW']):undefined)
  }
})
