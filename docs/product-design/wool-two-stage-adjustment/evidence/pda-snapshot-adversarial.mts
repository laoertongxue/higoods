import assert from 'node:assert/strict'
const root = '/Users/laoer/Documents/higoods/.worktrees/work-20260918'
await import(root + '/scripts/check-wool-pda-factory-projection.ts')
const wool = await import(root + '/src/data/fcs/wool-task-domain.ts')
const store = await import(root + '/src/data/fcs/wool-domain/store.ts')
const pda = await import(root + '/src/data/fcs/pda-handover-events.ts')
const session = await import(root + '/src/data/fcs/store-domain-pda.ts')
const todos = await import(root + '/src/data/fcs/factory-mobile-todos.ts')
const nonWool = () => pda.listPdaHandoverHeads().filter((head:any) => head.processBusinessCode !== 'WOOL')
const baseline = nonWool()
const original = wool.readWoolQuerySnapshot()
assert(Object.isFrozen(original)); assert(Object.isFrozen(original.handovers)); assert(Object.isFrozen(original.workOrders['WOOL-STAGE-004:LINKING'].outputPlanLines))
const order = original.workOrders['WOOL-STAGE-004:LINKING']
const fact = wool.addWoolHandover(order.woolOrderId, {commandId:'INDEPENDENT-WRITER-7',outputSkuCode:order.outputPlanLines[0].outputSkuCode,handoverQty:7,handedOverAt:'2026-09-18 19:05:00',handedOverBy:'独立验收'})
const afterHandover = wool.readWoolQuerySnapshot()
assert.notEqual(afterHandover, original)
assert(!original.handovers.some((row:any)=>row.handoverId===fact.handoverId))
const head = pda.listHandoverOrdersByTaskId(order.taskId).find((row:any)=>row.sourceDocId===fact.handoverId)!
const record = pda.getPdaHandoverRecordsByHead(head.handoverId)[0]
const user = session.listFactoryPdaUsers(head.factoryId)[0]
assert(user); session.setPdaSession(session.createPdaSessionFromUser(user))
const result = pda.writeBackHandoverRecord({handoverRecordId:record.recordId,receiverWrittenQty:7,receiverWrittenAt:'2026-09-18 19:06:00',receiverWrittenBy:'独立验收接收人'})
assert.equal(result.receiverWrittenQty,7)
const afterWrite = wool.readWoolQuerySnapshot()
assert.notEqual(afterWrite,afterHandover)
assert.equal(afterHandover.handovers.find((row:any)=>row.handoverId===fact.handoverId).downstreamReceipt.status,'PENDING')
assert.equal(afterWrite.handovers.find((row:any)=>row.handoverId===fact.handoverId).downstreamReceipt.actualReceivedQty,7)
assert.equal(pda.findPdaHandoverHead(head.handoverId).writtenBackQtyTotal,7)
assert.equal(pda.getPdaHandoverRecordsByHead(head.handoverId)[0].receiverWrittenQty,7)
result.recordLines[0].submittedQty=999; result.factoryProofFiles.push('mutated')
assert.equal(pda.getPdaHandoverRecordsByHead(head.handoverId)[0].recordLines[0].submittedQty,7)
assert.deepEqual(nonWool(),baseline)
console.log('INDEPENDENT PASS: deeply frozen read snapshots stay unchanged, actual PDA writeBackHandoverRecord succeeds through current receiving factory, revision changes twice, post-save head/record immediately read 7, returned record remains independently mutable, non-wool heads equal baseline.')
const draft=store.readWoolStore()
for(const id of ['WOOL-STAGE-002:KNITTING','WOOL-STAGE-002:LINKING']) draft.workOrders[id].generationIssues=['技术包存在工艺但缺少逐片实例，先维护技术包']
store.replaceWoolStore(draft)
const todo=todos.getFactoryMobileTodos('OWN_WOOL_FACTORY').find((row:any)=>row.relatedTaskId==='TASK-WOOL-STAGE-002:LINKING')
console.log('BOUNDARY TODO:',JSON.stringify({title:todo?.todoTitle,type:todo?.todoType,actions:wool.getWoolAllowedActions('WOOL-STAGE-002:LINKING'),issues:wool.readWoolQuerySnapshot().workOrders['WOOL-STAGE-002:LINKING'].generationIssues}))
assert(!todo?.todoTitle.includes('等待横机填报同步'),'资料问题阻断的缝盘被误提示正常自动同步')

const perSku=store.readWoolStore(); const perSkuOrder=perSku.workOrders['WOOL-STAGE-002:LINKING']; perSkuOrder.generationIssues=[]; perSkuOrder.generationIssuesBySku={[perSkuOrder.outputPlanLines[0].outputSkuCode]:['绑定SKU缺少逐片实例']}; store.replaceWoolStore(perSku); const perSkuTodo=todos.getFactoryMobileTodos('OWN_WOOL_FACTORY').find((row:any)=>row.relatedTaskId===perSkuOrder.taskId); assert.equal(perSkuTodo.todoType,'异常待处理'); assert(perSkuTodo.todoTitle.includes('核对技术包')); console.log('INDEPENDENT PASS: both order-level and SKU-specific missing-piece issues show actionable technical-package correction, not automatic-sync waiting.'); process.exit(0)
