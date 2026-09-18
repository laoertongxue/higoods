import assert from 'node:assert/strict'

// Isolated in-memory browser surfaces; never accesses a user's browser profile.
const values = new Map<string, string>()
let failedKey: string | undefined
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (key === failedKey) throw new Error(`审查模拟存储失败: ${key}`)
    values.set(key, value)
  },
  removeItem: (key: string) => values.delete(key),
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  localStorage: storage, sessionStorage: storage, addEventListener() {}, dispatchEvent() {},
  location: { pathname: '/fcs/pda/warehouse/outbound-records', search: '', origin: 'http://localhost:5186' },
  history: { pushState() {}, replaceState() {} },
} })
Object.defineProperty(globalThis, 'document', { configurable: true, value: {
  addEventListener() {}, querySelector() { return null }, querySelectorAll() { return [] },
} })
const { listPdaTaskFlowTasks } = await import('../src/data/fcs/pda-cutting-execution-source.ts')
const { buildFcsCuttingDomainSnapshot } = await import('../src/domain/fcs-cutting-runtime/index.ts')
const snapshot = buildFcsCuttingDomainSnapshot()
const all = structuredClone(listPdaTaskFlowTasks(snapshot))
const factories = [...new Set(all.map(task => task.assignedFactoryId).filter(Boolean))] as string[]
assert(factories.includes('OWN_WOOL_FACTORY'))
assert(factories.length > 3)
for (const factoryId of [...factories, 'NO-SUCH-FACTORY']) {
  assert.deepEqual(listPdaTaskFlowTasks(snapshot, factoryId), all.filter(task => task.assignedFactoryId === factoryId), factoryId)
}
console.log(`✓ ${factories.length}工厂及不存在工厂：提前限定工厂与全量投影后筛选逐字段相等`)
const { validateWoolPdaTaskAccess } = await import('../src/data/fcs/wool-pda-task-access.ts')
assert.equal(validateWoolPdaTaskAccess({taskId:'TASK-WOOL-STAGE-002:KNITTING',currentFactoryId:'OWN_WOOL_FACTORY'}).canAccess, true)
assert.equal(validateWoolPdaTaskAccess({taskId:'TASK-WOOL-STAGE-002:KNITTING',currentFactoryId:'ID-F002'}).reasonCode, 'TASK_FACTORY_MISMATCH')
assert.equal(validateWoolPdaTaskAccess({taskId:'MISSING:KNITTING',currentFactoryId:'OWN_WOOL_FACTORY'}).canAccess, false)
console.log('✓ 精准加载仍校验实际阶段任务与当前工厂，无权及不存在任务阻断')

const wool = await import('../src/data/fcs/wool-task-domain.ts')
const handovers = await import('../src/data/fcs/pda-handover-events.ts')
const order = wool.readWoolStore().workOrders['WOOL-STAGE-004:LINKING']
const before = handovers.listHandoverOrdersByTaskId(order.taskId)
const fact = wool.addWoolHandover(order.woolOrderId, {
  commandId: 'PDA-READ-SNAPSHOT-TEST', outputSkuCode: order.outputPlanLines[0].outputSkuCode,
  handoverQty: 8, handedOverAt: '2026-09-18 19:00:00', handedOverBy: '查询验收',
})
const head = handovers.listHandoverOrdersByTaskId(order.taskId).find(row => row.sourceDocId === fact.handoverId)!
assert(head)
assert(!before.some(row => row.sourceDocId === fact.handoverId))
const record = handovers.getPdaHandoverRecordsByHead(head.handoverId)[0]
assert.equal(record.submittedQty, 8)
head.qtyExpectedTotal = 999
record.recordLines![0].submittedQty = 999
assert.equal(handovers.findPdaHandoverHead(head.handoverId)!.qtyExpectedTotal, 8)
assert.equal(handovers.getPdaHandoverRecordsByHead(head.handoverId)[0].recordLines![0].submittedQty, 8)
wool.confirmWoolDownstreamReceipt(fact.handoverId, {
  commandId: 'PDA-READ-SNAPSHOT-RECEIVE', actualReceivedQty: 8,
  receivedAt: '2026-09-18 19:01:00', receivedBy: '实际接收人',
})
assert.equal(handovers.findPdaHandoverHead(head.handoverId)!.writtenBackQtyTotal, 8)
assert.equal(handovers.getPdaHandoverRecordsByHead(head.handoverId)[0].receiverWrittenQty, 8)
console.log('✓ PDA交接查询的返回副本可独立修改，新增交出及实际接收后立即读取新事实')

const { getFactoryMobileTodos } = await import('../src/data/fcs/factory-mobile-todos.ts')
const todos = getFactoryMobileTodos('OWN_WOOL_FACTORY').filter(todo => todo.executionProcessType === 'WOOL')
const currentOrders = Object.values(wool.readWoolStore().workOrders)
assert(todos.some(todo => todo.todoTitle === '缝盘加工单待确认接收外加工回货片'))
assert(todos.some(todo => todo.todoTitle === '横机加工单待确认接收纱线'))
assert(todos.some(todo => todo.todoTitle === '缝盘加工单等待横机填报同步' && todo.todoType === '待开工'))
for (const todo of todos) {
  const source = currentOrders.find(order => order.taskId === todo.relatedTaskId)!
  assert(source)
  assert(todo.todoTitle.startsWith(source.stage === 'KNITTING' ? '横机加工单' : '缝盘加工单'))
  if (source.stage === 'LINKING') assert(!todo.todoTitle.includes('纱线'))
}
console.log('✓ PDA待办按横机/缝盘和实际允许动作提示，回货片与纱线不混淆，自动衔接不指引重复接收')

const blocked = wool.readWoolStore()
const missingPieces = blocked.workOrders['WOOL-STAGE-001:LINKING']
assert.equal(missingPieces.externalPieces.length, 0)
missingPieces.generationIssues.push('技术包存在外工艺，但缺少逐片实例')
wool.replaceWoolStore(blocked)
const blockedTodo = getFactoryMobileTodos('OWN_WOOL_FACTORY').find(todo => todo.relatedTaskId === missingPieces.taskId && todo.executionProcessType === 'WOOL')!
assert.equal(blockedTodo.todoType, '异常待处理')
assert.equal(blockedTodo.todoTitle, '缝盘加工单资料不完整，请核对技术包')
assert(!blockedTodo.todoTitle.includes('等待横机填报同步'))
console.log('✓ 缺逐片资料的缝盘待办提示核对技术包，不冒称正常自动同步')
