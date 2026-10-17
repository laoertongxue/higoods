import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
function staticDependencies(entry: string): Set<string> {
  const visited = new Set<string>()
  const visit = (file: string): void => {
    if (visited.has(file)) return
    visited.add(file)
    const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    for (const node of ast.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue
      if ((ts.isExportDeclaration(node) && node.isTypeOnly)
        || (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly)) continue
      const binding = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : node.exportClause
      if (binding && (ts.isNamedImports(binding) || ts.isNamedExports(binding))
        && binding.elements.every(item => item.isTypeOnly)
        && !(ts.isImportDeclaration(node) && node.importClause?.name)) continue
      const specifier = (node.moduleSpecifier as ts.StringLiteral | undefined)?.text
      if (!specifier?.startsWith('.')) continue
      const candidate = path.resolve(path.dirname(file), specifier)
      const dependency = [candidate, `${candidate}.ts`, `${candidate}/index.ts`]
        .find(value => /\.ts$/.test(value) && existsSync(value))
      if (dependency) visit(dependency)
    }
  }
  visit(path.resolve(root, entry))
  return new Set([...visited].map(value => path.relative(root, value)))
}

test('reading an auxiliary work-order list does not load complete print or preparation execution', () => {
  const dependencies = staticDependencies('src/pages/process-factory/special-craft/task-orders.ts')
  for (const file of ['src/data/fcs/printing-task-domain.ts', 'src/data/fcs/dyeing-task-domain.ts',
    'src/data/fcs/cutting/production-material-prep.ts']) assert.ok(!dependencies.has(file), file)
})

test('reading an auxiliary work-order detail does not statically load complete print or dye execution', () => {
  const dependencies = staticDependencies('src/pages/process-factory/special-craft/task-detail.ts')
  for (const file of ['src/data/fcs/printing-task-domain.ts', 'src/data/fcs/dyeing-task-domain.ts']) {
    assert.ok(!dependencies.has(file), file)
  }
})

test('handover source labels retain the original public map without execution imports', async () => {
  const leaf = await import('../../src/data/fcs/process-work-order-source-labels.ts')
  const original = await import('../../src/data/fcs/process-work-order-domain.ts')
  assert.equal(leaf.PROCESS_WORK_ORDER_SOURCE_LABEL, original.PROCESS_WORK_ORDER_SOURCE_LABEL)
  assert.deepEqual(leaf.PROCESS_WORK_ORDER_SOURCE_LABEL, {
    PRODUCTION_ORDER: '生产单自动生成', PRODUCTION_DEMAND: '生产需求单提前创建', STOCK: '备货手动创建',
    CUT_PIECE_SUPPLEMENT: '裁片补料生成', DESIGN_REVISION: '设计改款任务',
  })
})

test('confirmed preparation readers keep the original API identity and invalid-record rules', async () => {
  const leaf = await import('../../src/data/fcs/cutting/material-prep-record-read.ts')
  const original = await import('../../src/data/fcs/cutting/production-material-prep.ts')
  assert.equal(leaf.listStoredConfirmedMaterialPrepRecords, original.listStoredConfirmedMaterialPrepRecords)
  assert.equal(leaf.getMaterialPrepRecordItems, original.getMaterialPrepRecordItems)
  const valid = { prepOrderId: 'PREP-A', recordStatus: 'CONFIRMED', items: [{ preparedQty: 1.235 }] }
  const rows = [valid, { ...valid, prepOrderId: 'PREP-B' }, { ...valid, recordStatus: 'REJECTED' },
    { ...valid, items: [{ preparedQty: -1 }] }, { ...valid, items: [{ preparedQty: null }] }]
  const keys: string[] = []
  const storage = { getItem(key: string) { keys.push(key); return JSON.stringify({ prepRecords: rows }) } }
  assert.deepEqual(leaf.listStoredConfirmedMaterialPrepRecords('PREP-A', storage), [valid])
  assert.deepEqual(keys, ['productionMaterialPrepWorkflow'])
  assert.deepEqual(leaf.listStoredConfirmedMaterialPrepRecords('PREP-A', { getItem: () => '{' }), [])
  assert.deepEqual(leaf.listStoredConfirmedMaterialPrepRecords('PREP-A', { getItem() { throw Error('denied') } }), [])
})

test('preparation item quantities preserve two decimals, explicit zero rolls and legacy fallback', async () => {
  const { getMaterialPrepRecordItems } = await import('../../src/data/fcs/cutting/material-prep-record-read.ts')
  type RecordInput = Parameters<typeof getMaterialPrepRecordItems>[0]
  const base = { prepRecordId: 'REC-A', prepLineId: 'LINE-A', preparedQty: 1.235, rollCount: 0,
    warehouseArea: 'AREA', locationCode: 'LOC', sourceStockEventId: 'EVENT', remark: 'memo' }
  const fallback = getMaterialPrepRecordItems(base as RecordInput)
  assert.equal(fallback.length, 1)
  assert.equal(fallback[0].preparedQty, 1.24)
  assert.equal(fallback[0].rollCount, 0)
  assert.equal(fallback[0].prepRecordItemId, 'REC-A:item:LINE-A')
  assert.equal(fallback[0].sourceStockEventId, 'EVENT')
  const explicit = getMaterialPrepRecordItems({ ...base, items: [{ preparedQty: 2.345, rollCount: 1.6,
    sourceMaterialSku: 'SKU-A', sourceUnit: 'm', stockAvailableQty: 8 }] } as RecordInput)
  assert.equal(explicit[0].preparedQty, 2.35)
  assert.equal(explicit[0].rollCount, 2)
  assert.equal(explicit[0].sourceMaterialSku, 'SKU-A')
  assert.equal(explicit[0].sourceUnit, 'm')
  assert.equal(explicit[0].stockWarehouseArea, 'AREA')
  assert.equal(explicit[0].stockLocationCode, 'LOC')
})

function materialDraftSession(action: string) {
  const file = path.resolve(root, 'src/pages/production/events.ts')
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const helper = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleMaterialDraftPreparedAction')!
  const guard = ast.statements.find(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(item => ts.isIdentifier(item.name) && item.name.text === 'materialDraftActionLoading'))!
  assert.ok(helper && guard, 'the actual scoped event entry and guard exist')
  const code = ts.transpileModule(`${guard.getText(ast)}\n${helper.getText(ast)}`.replaceAll('import(', 'loadModule('),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const state = { materialDraftOrderId: action === 'open-material-draft-drawer' ? null : 'ORDER-A',
    ordersActionMenuId: 'MENU', materialDraftAddDraftId: 'ADD', materialDraftAddSelections: new Set(['kept']) }
  const location = { href: 'https://example.test/fcs/production/orders' }
  const node = { isConnected: true, dataset: { orderId: 'ORDER-A', draftId: 'DRAFT-A' } }
  const draft = { productionOrderId: 'ORDER-A', draftStatus: 'pending', confirmedQty: 7 }
  const calls: string[] = [], messages: string[] = []
  let release!: () => void, reject!: (error: Error) => void, entered!: () => void, loads = 0
  const pending = new Promise<void>((resolve, fail) => { release = resolve; reject = fail })
  const reached = new Promise<void>(resolve => { entered = resolve })
  const reader = () => null
  let loader = async () => { entered(); await pending; return { getMaterialPrepOrderProjection: reader } }
  const dependencies = { state, window: { location }, currentUser: { id: 'USER', name: '跟单员' },
    loadModule: (module: string) => { assert.equal(module, '../../data/fcs/cutting/production-material-prep.ts'); loads++; return loader() },
    getMaterialRequestDraftById: () => ({ ...draft }),
    prepareMaterialRequestDraftsForOrder: (id: string, actualReader: unknown) => {
      assert.equal(id, 'ORDER-A'); assert.equal(actualReader, reader); calls.push('prepare')
    },
    restoreMaterialDraftSuggestion: (id: string, _name: string, actualReader: unknown) => {
      assert.equal(id, 'DRAFT-A'); assert.equal(actualReader, reader); calls.push('restore')
    },
    confirmMaterialRequestDraft: (id: string, _operator: unknown, actualReader: unknown) => {
      assert.equal(id, 'DRAFT-A'); assert.equal(actualReader, reader); calls.push('confirm'); draft.draftStatus = 'created'
      return { ok: true, request: { materialRequestNo: 'REQ-A' } }
    },
    showPlanMessage: (message: string) => messages.push(message),
  }
  const handle = new Function('dependencies', `with (dependencies) { ${code}; return handleMaterialDraftPreparedAction }`)(dependencies)
  return { state, location, node, draft, calls, messages, reached, release, reject, loads: () => loads,
    run: (target = node) => handle(target, action) as Promise<boolean>,
    useReadyLoader: () => { loader = async () => ({ getMaterialPrepOrderProjection: reader }) } }
}
const materialActions = ['open-material-draft-drawer', 'restore-material-draft-suggestion', 'confirm-material-request-draft']

test('all three material entries wait before opening input or calling a synchronous command', async () => {
  for (const action of materialActions) {
    const s = materialDraftSession(action), before = structuredClone(s.state)
    const pending = s.run(); await s.reached
    assert.deepEqual(s.calls, []); assert.deepEqual(s.state, before)
    s.release(); assert.equal(await pending, true); assert.equal(s.calls.length, 1)
  }
})

test('pending material entries deduplicate same-tick clicks and pass the original reader', async () => {
  for (const action of materialActions) {
    const s = materialDraftSession(action), first = s.run(); await s.reached
    assert.equal(await s.run(), true); assert.equal(s.loads(), 1); assert.deepEqual(s.calls, [])
    s.release(); await first; assert.equal(s.calls.length, 1)
  }
})

test('failed material-module loading preserves input and a real retry releases the guard', async () => {
  for (const action of materialActions) {
    const s = materialDraftSession(action), before = structuredClone({ state: s.state, draft: s.draft })
    const pending = s.run(); await s.reached; s.reject(Error('projection reader unavailable')); await pending
    assert.deepEqual(s.calls, []); assert.deepEqual({ state: s.state, draft: s.draft }, before)
    assert.deepEqual(s.messages, ['projection reader unavailable'])
    s.useReadyLoader(); await s.run(); assert.equal(s.loads(), 2); assert.equal(s.calls.length, 1)
  }
})

test('old material clicks cannot act after leaving, returning with new DOM or switching drawers', async () => {
  for (const action of materialActions) for (const mode of ['url', 'detached', 'return-same-url', 'drawer']) {
    const s = materialDraftSession(action), pending = s.run(); await s.reached
    const oldUrl = s.location.href, oldDrawer = s.state.materialDraftOrderId
    if (mode === 'url') s.location.href += '?another=1'
    if (mode === 'detached' || mode === 'return-same-url') s.node.isConnected = false
    if (mode === 'return-same-url') { s.location.href += '/other'; s.location.href = oldUrl }
    if (mode === 'drawer') s.state.materialDraftOrderId = 'ORDER-B'
    s.release(); await pending; assert.deepEqual(s.calls, [], `${action}/${mode}`); assert.deepEqual(s.messages, [])
    s.location.href = oldUrl; s.state.materialDraftOrderId = oldDrawer
    s.useReadyLoader(); await s.run({ ...s.node, isConnected: true }); assert.equal(s.calls.length, 1)
  }
})

test('a delayed restore or confirm cannot overwrite a created or differently owned draft', async () => {
  for (const action of materialActions.slice(1)) for (const mode of ['created', 'owner']) {
    const s = materialDraftSession(action), pending = s.run(); await s.reached
    if (mode === 'created') s.draft.draftStatus = 'created'
    else s.draft.productionOrderId = 'ORDER-B'
    const before = structuredClone(s.draft)
    s.release(); await pending; assert.deepEqual(s.calls, []); assert.deepEqual(s.draft, before)
    assert.match(s.messages[0], /草稿已变化/)
  }
})

test('two explicit confirmations cannot create a second formal request', async () => {
  const s = materialDraftSession('confirm-material-request-draft'), first = s.run(); await s.reached
  s.release(); await first; s.useReadyLoader(); await s.run()
  assert.deepEqual(s.calls, ['confirm']); assert.equal(s.draft.draftStatus, 'created')
})

test('the actual synchronous material action still rolls all facts back on a save failure', () => {
  const file = path.resolve(root, 'src/data/fcs/material-request-drafts.ts')
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const action = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'runMaterialRequestAction')!
  assert.ok(!action.modifiers?.some(node => node.kind === ts.SyntaxKind.AsyncKeyword))
  const code = ts.transpileModule(action.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const saved = new Map([['FORMAL', 'original']])
  const deps = { materialRequestDraftSeedState: 'ready', materialRequestActionDepth: 0,
    materialRequestDrafts: [{ id: 'DRAFT', status: 'pending' }], materialRequests: [] as object[], materialDraftOperationLogs: [] as object[],
    taskBindings: new Map([['TASK', 'old']]), materialRequestSequence: 1, materialDraftLogSeq: 1,
    processTasks: [{ hasMaterialRequest: false, materialRequestNo: 'old', materialMode: 'warehouse_delivery',
      materialModeLabel: '仓库配送到厂', materialRequestStatus: '待配料' }],
    head: { id: 'old' }, ensureMaterialRequestDraftSeedData() {},
    capturePdaHandoverState: () => structuredClone(deps.head), restorePdaHandoverState: (head: { id: string }) => { deps.head = head },
    FORMAL_MATERIAL_REQUEST_STORAGE_KEY: 'FORMAL',
    localStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value), removeItem: (key: string) => saved.delete(key) },
    saveFormalMaterialRequests: () => { saved.set('FORMAL', 'partial'); throw Error('quota') },
  }
  const before = structuredClone({ drafts: deps.materialRequestDrafts, requests: deps.materialRequests,
    logs: deps.materialDraftOperationLogs, bindings: deps.taskBindings, tasks: deps.processTasks, head: deps.head })
  const run = new Function('dependencies', `with (dependencies) { ${code}; return runMaterialRequestAction }`)(deps)
  assert.throws(() => run(() => {
    deps.materialRequestDrafts[0].status = 'created'; deps.materialRequests.push({ id: 'REQ' }); deps.materialDraftOperationLogs.push({ id: 'LOG' })
    deps.taskBindings.set('TASK', 'new'); deps.materialRequestSequence++; deps.materialDraftLogSeq++
    deps.processTasks[0].hasMaterialRequest = true; deps.processTasks[0].materialRequestNo = 'REQ'
    deps.processTasks[0].materialMode = 'factory_pickup'; deps.processTasks[0].materialModeLabel = '工厂到仓自提'
    deps.processTasks[0].materialRequestStatus = '已完成'; deps.head.id = 'new'
  }), /接收需求未保存.*quota/)
  assert.deepEqual({ drafts: deps.materialRequestDrafts, requests: deps.materialRequests, logs: deps.materialDraftOperationLogs,
    bindings: deps.taskBindings, tasks: deps.processTasks, head: deps.head }, before)
  assert.equal(saved.get('FORMAL'), 'original'); assert.equal(deps.materialRequestSequence, 1)
  assert.equal(deps.materialDraftLogSeq, 1); assert.equal(deps.materialRequestActionDepth, 0)
})
