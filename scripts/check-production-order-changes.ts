import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createProductionChangeForm, state } from '../src/pages/production/context.ts'
import * as changeDomain from '../src/data/fcs/production-tech-pack-change-domain.ts'
import { listMaterialArchives } from '../src/data/pcs-material-archive-repository.ts'
import {
  ensureProcessWorkOrdersForFormalProductionOrder,
  type FormalProductionOrderProcessSnapshot,
} from '../src/data/fcs/production-process-work-order-service.ts'
import { getDyeWorkOrderById } from '../src/data/fcs/dyeing-task-domain.ts'
import {
  adaptLegacyQuantityLinesForEdit,
  areMaterialSelectionsEquivalent,
  buildProductionChangeRecord,
  buildProductionChangePreview,
  buildMaterialReplacementAllocations,
  createFollowingOrderPlans,
  createProductionChangeFactsFingerprint,
  createNextProductionChangeRecordId,
  createQuantityLinesForOrder,
  executeProductionChange,
  getProductionChangeLockMessage,
  getProductionChangeRecord,
  inferProductionChangeResult,
  isProductionChangeObjectLocked,
  listProductionChangeRecords,
  listProductionChangeDocumentTraces,
  listAffectedDocumentNosForOrder,
  listReplacementMaterialOptions,
  LEGACY_ORIGINAL_MATERIAL_PREFIX,
  LEGACY_REPLACEMENT_MATERIAL_PREFIX,
  createLegacyMaterialValue,
  normalizeMaterialReplacementAllocations,
  productionChangeResultLabels,
  quantityChangeRequiresNewFormalVersion,
  resolveFollowingOrderStateFromProgressFallback,
  replaceProductionChangeRecordsForTesting,
  resetProductionChangeRecordsForTesting,
  saveProductionChangeRecord,
  validateProductionChangeDecisions,
  type ProductionChangeDraft,
  type ProductionChangePreview,
} from '../src/data/fcs/production-order-change-workflow.ts'

if (typeof (globalThis as any).HTMLInputElement === 'undefined') {
  ;(globalThis as any).HTMLInputElement = function HTMLInputElement() {}
}
if (typeof (globalThis as any).HTMLSelectElement === 'undefined') {
  ;(globalThis as any).HTMLSelectElement = function HTMLSelectElement() {}
}
if (typeof (globalThis as any).HTMLTextAreaElement === 'undefined') {
  ;(globalThis as any).HTMLTextAreaElement = function HTMLTextAreaElement() {}
}

function requireFunction<T extends (...args: never[]) => unknown>(exports: Record<string, unknown>, name: string): T {
  const value = exports[name]
  assert.equal(typeof value, 'function', `缺少 ${name} 导出`)
  return value as T
}

function assertIncludesAny(html: string, texts: string[], message: string): void {
  assert.ok(texts.some((text) => html.includes(text)), message)
}

function assertHomeDoesNotIncludeLegacyEntries(html: string, label: string): void {
  ;[
    '查看发布待评估',
    '冻结版本',
    '最新正式版',
    '版本关系状态',
    '查看关系',
    '是否存在新正式版',
    '是否存在补丁',
  ].forEach((text) => {
    assert.ok(!html.includes(text), `${label}不应出现旧技术包/版本关系/补丁入口：${text}`)
  })
}

const quantityLines: ProductionChangeDraft['quantityLines'] = [
  {
    id: 'QTY-LINE-001',
    skuCode: 'SKU-BLK-M',
    color: '黑色',
    size: 'M',
    originalQty: 120,
    currentQty: 120,
    targetQty: 90,
    unit: '件',
    isNew: false,
    coveredByCurrentVersion: true,
  },
]

assert.deepEqual(
  productionChangeResultLabels,
  {
    PRODUCTION_PATCH: '生产单打补丁',
    VERSION_RELATION: '正式版本绑定调整',
    VERSION_AND_PATCH: '生产单打补丁 + 正式版本绑定调整',
  },
  '生产单变更最终结果只能使用新工作流定义的三个结果',
)

assert.equal(getProductionChangeLockMessage(), '生产单正在变更，请稍后再试', '锁定提示必须使用统一文案')

const initialProductionChangeRecords = listProductionChangeRecords()
const initialQuantitySeed = initialProductionChangeRecords.find((record) => record.id === 'BG-20260710-001')
const initialMaterialSeed = initialProductionChangeRecords.find((record) => record.id === 'BG-20260710-002')
const initialRolledBackSeed = initialProductionChangeRecords.find((record) => record.id === 'BG-20260710-003')
assert.equal(initialQuantitySeed?.changeType, 'QUANTITY_CHANGE', '初始数量变更种子必须使用固定变更单号')
assert.equal(initialQuantitySeed?.status, 'DONE', '初始数量变更种子必须为 DONE')
assert.equal(initialMaterialSeed?.changeType, 'MATERIAL_REPLACEMENT', '初始替换物料种子必须使用固定变更单号')
assert.equal(initialMaterialSeed?.status, 'READY', '初始替换物料种子必须为 READY')
assert.deepEqual(initialMaterialSeed?.documentTraces, [], 'READY 种子不得伪造执行后单据留痕')
assert.equal(initialRolledBackSeed?.status, 'ROLLED_BACK', '初始回滚种子必须使用固定变更单号并为 ROLLED_BACK')
assert.ok(
  initialRolledBackSeed?.documentTraces.every((trace) => trace.afterText.includes('未生效')),
  '回滚尝试的变更后语义必须明确未生效',
)
assert.ok(initialQuantitySeed?.currentFactsSnapshot, '最终记录必须保存当前事实快照')

const executionPreview: ProductionChangePreview = {
  result: 'PRODUCTION_PATCH',
  resultReason: '测试同步执行',
  factsFingerprint: createProductionChangeFactsFingerprint('PO-202603-0004'),
  affectedOrderIds: ['PO-202603-0004'],
  autoItems: [],
  decisionItems: [],
  summary: {
    affectedOrderCount: 1,
    affectedDocumentCount: 1,
    materialDeltaText: '测试数量变化',
    costDeltaText: '测试成本变化',
    deliveryImpactText: '测试交期变化',
  },
  lockObjectIds: [' PO-202603-0004 ', '', 'DOC-LOCK-001', 'PO-202603-0004'],
}
const executionPreviewBefore = structuredClone(executionPreview)
let successHookCount = 0
const successfulExecution = executeProductionChange(executionPreview, {
  onStep: () => {
    successHookCount += 1
    assert.ok(
      ['PO-202603-0004', 'DOC-LOCK-001'].every(isProductionChangeObjectLocked),
      '成功执行 hook 内全部处理对象必须保持锁定',
    )
  },
  persist: () => {
    assert.ok(
      ['PO-202603-0004', 'DOC-LOCK-001'].every(isProductionChangeObjectLocked),
      '事实写入和记录保存回调执行时全部处理对象必须仍保持锁定',
    )
  },
})
assert.equal(successfulExecution instanceof Promise, false, '同步执行函数不得返回 Promise')
assert.ok(successHookCount > 0, '成功执行必须同步触发步骤 hook')
assert.equal(successfulExecution.status, 'DONE', '成功执行必须返回 DONE')
assert.equal(successfulExecution.message, '全部处理成功并已统一生效。', '成功提示必须精确')
assert.equal(successfulExecution.progress, 100, '成功执行必须返回 100%')
assert.deepEqual(successfulExecution.lockObjectIds, ['PO-202603-0004', 'DOC-LOCK-001'], '锁 ID 必须过滤空值并去重')
assert.ok(successfulExecution.steps.every((step) => step.status === 'DONE'), '成功步骤必须全部 DONE')
assert.ok(
  ['PO-202603-0004', 'DOC-LOCK-001'].every((id) => !isProductionChangeObjectLocked(id)),
  '成功返回后必须释放全部锁',
)
assert.deepEqual(executionPreview, executionPreviewBefore, '成功执行不得修改输入 preview')

const persistenceAttempts: string[] = []
const persistenceFailureResult = executeProductionChange(executionPreview, {
  persist: (result) => {
    persistenceAttempts.push(result.status)
    throw new Error('模拟持久化失败')
  },
})
assert.deepEqual(persistenceAttempts, ['DONE'], '持久化异常不得再次调用同一回调写入矛盾状态')
assert.equal(persistenceFailureResult.status, 'ROLLED_BACK', '持久化异常必须返回标准回滚结果')

const staleFactLines = createQuantityLinesForOrder('PO-202603-0004')
staleFactLines[0].targetQty -= 1
const staleFactPreview = buildProductionChangePreview({
  productionOrderId: 'PO-202603-0004',
  changeType: 'QUANTITY_CHANGE',
  reason: '事实变化探针',
  quantityLines: staleFactLines,
  materialReplacement: null,
  decisionValues: {},
  affectedDocumentNos: listAffectedDocumentNosForOrder('PO-202603-0004'),
})
changeDomain.applyProductionOrderQuantityFactChange(
  'PO-202603-0004',
  [{ ...staleFactLines[0], targetQty: staleFactLines[0].currentQty - 2 }],
  'BG-STALE-PROBE',
  '2026-07-11 08:00',
)
const staleFactExecution = executeProductionChange(staleFactPreview)
assert.equal(staleFactExecution.status, 'ROLLED_BACK', '执行前事实变化必须整单回滚')
assert.equal(staleFactExecution.message, '当前事实已变化，请重新确认处理方案')
changeDomain.resetProductionOrderChangeCurrentFactsForTesting()

let failureHookCount = 0
const failedExecution = executeProductionChange(executionPreview, {
  shouldFail: true,
  onProgress: () => {
    failureHookCount += 1
    assert.ok(
      ['PO-202603-0004', 'DOC-LOCK-001'].every(isProductionChangeObjectLocked),
      '失败执行 hook 内全部处理对象必须保持锁定',
    )
  },
})
assert.ok(failureHookCount > 0, '失败执行必须同步触发进度 hook')
assert.equal(failedExecution.status, 'ROLLED_BACK', '失败执行必须返回 ROLLED_BACK')
assert.equal(failedExecution.message, '执行失败，本次没有修改任何单据。', '失败提示必须说明没有修改单据')
assert.equal(failedExecution.progress, 100, '失败回滚也必须返回 100%')
assert.ok(
  failedExecution.steps
    .filter((step) => step.id === 'CHANGE' || step.id === 'TRACE')
    .every((step) => step.status === 'ROLLED_BACK'),
  '失败时 CHANGE/TRACE 不得产生 DONE 留痕',
)
assert.equal(failedExecution.steps.at(-1)?.label, '全部回滚', '失败最后一步必须显示全部回滚')
assert.ok(
  ['PO-202603-0004', 'DOC-LOCK-001'].every((id) => !isProductionChangeObjectLocked(id)),
  '失败返回后必须释放全部锁',
)
assert.deepEqual(executionPreview, executionPreviewBefore, '失败执行不得修改输入 preview')

let nestedExecution: ReturnType<typeof executeProductionChange> | undefined
const outerExecution = executeProductionChange(executionPreview, {
  onStep: () => {
    if (nestedExecution) return
    nestedExecution = executeProductionChange(executionPreview)
    assert.equal(nestedExecution.status, 'ROLLED_BACK', '相同范围的嵌套执行必须拒绝重入')
    assert.equal(nestedExecution.message, getProductionChangeLockMessage(), '锁冲突必须返回统一锁提示')
    assert.ok(nestedExecution.steps.every((step) => step.status === 'ROLLED_BACK'), '锁冲突步骤必须全部说明已回滚')
    assert.ok(
      ['PO-202603-0004', 'DOC-LOCK-001'].every(isProductionChangeObjectLocked),
      '内层冲突返回后不得释放外层持有的锁',
    )
  },
})
assert.equal(outerExecution.status, 'DONE', '拒绝内层重入不得影响外层同步执行')
assert.ok(
  ['PO-202603-0004', 'DOC-LOCK-001'].every((id) => !isProductionChangeObjectLocked(id)),
  '外层执行结束后才释放锁',
)

const thrownHookExecution = executeProductionChange(executionPreview, {
  onProgress: () => {
    throw new Error('测试 hook 异常')
  },
})
assert.equal(thrownHookExecution.status, 'ROLLED_BACK', 'hook 异常不得向调用方传播')
assert.equal(thrownHookExecution.message, '执行失败，本次没有修改任何单据。', 'hook 异常必须返回标准失败提示')
assert.equal(thrownHookExecution.progress, 100, 'hook 异常必须完成标准回滚状态')
assert.ok(
  thrownHookExecution.steps
    .filter((step) => step.id === 'CHANGE' || step.id === 'TRACE')
    .every((step) => step.status === 'ROLLED_BACK'),
  'hook 异常时 CHANGE/TRACE 必须回滚',
)
assert.equal(thrownHookExecution.steps.at(-1)?.label, '全部回滚', 'hook 异常最后一步必须全部回滚')
assert.ok(
  ['PO-202603-0004', 'DOC-LOCK-001'].every((id) => !isProductionChangeObjectLocked(id)),
  'hook 异常返回后必须释放锁',
)
assert.equal(executeProductionChange(executionPreview).status, 'DONE', 'hook 异常回滚后必须允许再次执行')

const workflowSyncSnapshot: FormalProductionOrderProcessSnapshot = {
  productionOrderId: 'PO-CHANGE-WORKFLOW-SYNC',
  productionOrderNo: 'PO-CHANGE-WORKFLOW-SYNC',
  orderedAt: '2026-07-16 11:00:00',
  techPackVersionId: 'TP-CHANGE-SYNC-V1',
  techPackVersionLabel: '技术包 V1',
  materialId: 'MAT-CHANGE-SYNC-V1',
  materialName: '变更同步前面料',
  targetColor: '藏青',
  plannedQty: 100,
  qtyUnit: '米',
  processCodes: ['DYE'],
  dyeProcessName: '活性染色',
  spuCode: 'SPU-CHANGE-SYNC',
  spuName: '生产变更同步款',
  requiredDeliveryDate: '2026-08-20',
}
const workflowSyncOrder = ensureProcessWorkOrdersForFormalProductionOrder(workflowSyncSnapshot)
const workflowChangedSnapshot = { ...workflowSyncSnapshot, materialId: 'MAT-CHANGE-SYNC-V2', materialName: '变更同步后面料', plannedQty: 120 }
const workflowSuccess = executeProductionChange(executionPreview, {
  processWorkOrderSnapshots: [workflowChangedSnapshot],
  changeRecordId: 'BG-WORKFLOW-SYNC-001',
  persist: (result) => result,
})
assert.equal(workflowSuccess.status, 'DONE')
assert.equal(getDyeWorkOrderById(workflowSyncOrder.dyeWorkOrderId!)?.materialId, 'MAT-CHANGE-SYNC-V2', '生产变更成功持久化后必须自动同步加工单')

const workflowAtomicFirst: FormalProductionOrderProcessSnapshot = {
  ...workflowSyncSnapshot,
  productionOrderId: 'PO-CHANGE-WORKFLOW-ATOMIC-FIRST',
  productionOrderNo: 'PO-CHANGE-WORKFLOW-ATOMIC-FIRST',
}
const workflowAtomicSecond: FormalProductionOrderProcessSnapshot = {
  ...workflowSyncSnapshot,
  productionOrderId: 'PO-CHANGE-WORKFLOW-ATOMIC-SECOND',
  productionOrderNo: 'PO-CHANGE-WORKFLOW-ATOMIC-SECOND',
}
const workflowAtomicFirstOrder = ensureProcessWorkOrdersForFormalProductionOrder(workflowAtomicFirst)
ensureProcessWorkOrdersForFormalProductionOrder(workflowAtomicSecond)
let invalidBatchPersistCount = 0
const invalidBatchExecution = executeProductionChange(executionPreview, {
  processWorkOrderSnapshots: [
    { ...workflowAtomicFirst, plannedQty: 160 },
    { ...workflowAtomicSecond, materialId: '' },
  ],
  changeRecordId: 'BG-WORKFLOW-ATOMIC-INVALID',
  persist: (result) => {
    invalidBatchPersistCount += 1
    return result
  },
})
assert.equal(invalidBatchExecution.status, 'ROLLED_BACK', '任一加工快照准备失败必须整批回滚')
assert.equal(invalidBatchPersistCount, 0, '加工快照批量准备失败时不得调用生产变更 persist')
assert.equal(getDyeWorkOrderById(workflowAtomicFirstOrder.dyeWorkOrderId!)?.plannedQty, 100, '第二条准备失败不得改写第一张加工单')

const noSyncBefore = getDyeWorkOrderById(workflowSyncOrder.dyeWorkOrderId!)!
executeProductionChange(executionPreview, {
  shouldFail: true,
  processWorkOrderSnapshots: [{ ...workflowChangedSnapshot, plannedQty: 130 }],
  changeRecordId: 'BG-WORKFLOW-SYNC-ROLLBACK',
})
assert.equal(getDyeWorkOrderById(workflowSyncOrder.dyeWorkOrderId!)?.plannedQty, noSyncBefore.plannedQty, 'shouldFail 回滚不得同步加工单')
executeProductionChange(executionPreview, {
  processWorkOrderSnapshots: [{ ...workflowChangedSnapshot, plannedQty: 140 }],
  changeRecordId: 'BG-WORKFLOW-SYNC-PERSIST-ROLLBACK',
  persist: () => ({ ...successfulExecution, status: 'ROLLED_BACK' }),
})
assert.equal(getDyeWorkOrderById(workflowSyncOrder.dyeWorkOrderId!)?.plannedQty, noSyncBefore.plannedQty, '持久化返回回滚不得同步加工单')
const persistenceThrowExecution = executeProductionChange(executionPreview, {
  processWorkOrderSnapshots: [{ ...workflowChangedSnapshot, plannedQty: 150 }],
  changeRecordId: 'BG-WORKFLOW-SYNC-PERSIST-THROW',
  persist: () => {
    throw new Error('模拟生产变更持久化异常')
  },
})
assert.equal(persistenceThrowExecution.status, 'ROLLED_BACK', '持久化抛错必须返回回滚结果')
assert.equal(getDyeWorkOrderById(workflowSyncOrder.dyeWorkOrderId!)?.plannedQty, noSyncBefore.plannedQty, '持久化抛错不得提交已准备的加工单批次')

;[
  [
    '数量变更且无需新正式版本',
    inferProductionChangeResult({ changeType: 'QUANTITY_CHANGE', requiresNewFormalVersion: false }),
    'PRODUCTION_PATCH',
  ],
  [
    '数量变更且需要新正式版本',
    inferProductionChangeResult({ changeType: 'QUANTITY_CHANGE', requiresNewFormalVersion: true }),
    'VERSION_AND_PATCH',
  ],
  [
    '物料剩余数量替换 + 当前生产单',
    inferProductionChangeResult({
      changeType: 'MATERIAL_REPLACEMENT',
      replacementMode: 'REMAINING',
      scope: 'CURRENT_ONLY',
    }),
    'PRODUCTION_PATCH',
  ],
  [
    '物料全部数量替换 + 当前生产单',
    inferProductionChangeResult({
      changeType: 'MATERIAL_REPLACEMENT',
      replacementMode: 'FULL',
      scope: 'CURRENT_ONLY',
    }),
    'PRODUCTION_PATCH',
  ],
  [
    '物料剩余数量替换 + 当前及后续生产单',
    inferProductionChangeResult({
      changeType: 'MATERIAL_REPLACEMENT',
      replacementMode: 'REMAINING',
      scope: 'CURRENT_AND_FOLLOWING',
    }),
    'VERSION_AND_PATCH',
  ],
  [
    '物料全部数量替换 + 当前及后续生产单',
    inferProductionChangeResult({
      changeType: 'MATERIAL_REPLACEMENT',
      replacementMode: 'FULL',
      scope: 'CURRENT_AND_FOLLOWING',
    }),
    'VERSION_RELATION',
  ],
].forEach(([scenario, actual, expected]) => {
  assert.equal(actual, expected, `${scenario}的最终结果不正确`)
})

assert.equal(
  quantityChangeRequiresNewFormalVersion([
    ...quantityLines,
    {
      ...quantityLines[0],
      id: 'QTY-LINE-NEW',
      size: 'XXL',
      isNew: true,
      coveredByCurrentVersion: false,
    },
  ]),
  true,
  '新增且未被当前正式版本覆盖的数量明细必须触发新正式版本',
)
assert.equal(
  quantityChangeRequiresNewFormalVersion([
    {
      ...quantityLines[0],
      coveredByCurrentVersion: false,
    },
  ]),
  false,
  '非新增明细即使未被当前正式版本覆盖也不得触发新正式版本',
)
assert.equal(
  quantityChangeRequiresNewFormalVersion([
    {
      ...quantityLines[0],
      isNew: true,
      coveredByCurrentVersion: true,
    },
  ]),
  false,
  '新增明细已被当前正式版本覆盖时不得触发新正式版本',
)
assert.equal(
  quantityChangeRequiresNewFormalVersion([
    {
      ...quantityLines[0],
      isNew: true,
      coveredByCurrentVersion: false,
      targetQty: 0,
    },
  ]),
  false,
  '新增但目标数量为 0 的取消行不得触发新正式版本',
)

const materialDraft: ProductionChangeDraft = {
  productionOrderId: 'PO-202603-004',
  changeType: 'MATERIAL_REPLACEMENT',
  reason: '原面料供应不足，替换未生产数量。',
  quantityLines: [],
  affectedDocumentNos: ['MR-202603-010', 'MI-202603-006', 'SP-202603-004-01', 'CUT-202603-004-01'],
  materialReplacement: {
    originalMaterialId: 'MAT-FAB-018',
    replacementMaterialId: 'MAT-FAB-026',
    replacementMode: 'FULL',
    scope: 'CURRENT_AND_FOLLOWING',
    suggestedProductionQty: 180,
    confirmedProductionQty: 180,
    allocations: [
      {
        id: 'ALLOC-001',
        skuCode: 'SKU-BLK-M',
        color: '黑色',
        size: 'M',
        demandQty: 120,
        oldMaterialFactQty: 30,
        suggestedReplacementQty: 90,
        confirmedReplacementQty: 90,
      },
    ],
    followingOrders: [
      {
        productionOrderId: 'PO-202603-005',
        progressText: '已领料，尚未裁剪',
        started: true,
        suggestedMode: 'REMAINING',
        confirmedMode: 'REMAINING',
      },
    ],
  },
  decisionValues: {
    'following-order-mode-PO-202603-005': { value: 'FULL', reason: '' },
  },
}

const remainingCurrentPreview = buildProductionChangePreview({
  ...materialDraft,
  materialReplacement: {
    ...materialDraft.materialReplacement!,
    replacementMode: 'REMAINING',
    scope: 'CURRENT_ONLY',
    followingOrders: [],
  },
  decisionValues: {},
})
assert.ok(
  remainingCurrentPreview.autoItems.some((item) => item.id === 'old-material-fact-kept'),
  '剩余数量替换时旧料已形成事实必须由系统继续计入当前生产单',
)
assert.ok(
  remainingCurrentPreview.decisionItems.every((item) => item.id !== 'old-material-disposition'),
  '剩余数量替换不得产生旧料实物去向判断',
)

const fullCurrentPreview = buildProductionChangePreview({
  ...materialDraft,
  materialReplacement: {
    ...materialDraft.materialReplacement!,
    replacementMode: 'FULL',
    scope: 'CURRENT_ONLY',
    followingOrders: [],
  },
  decisionValues: {},
})
const fullDispositionDecision = fullCurrentPreview.decisionItems.find((item) => item.id === 'old-material-disposition')
assert.ok(fullDispositionDecision, '全部数量替换且存在旧料事实时必须产生实物去向判断')
assert.ok(
  fullDispositionDecision.options.every(
    (option) => option.value !== 'CONTINUE_USE' && !option.label.includes('继续计入当前需求'),
  ),
  '全部数量替换的旧料去向不得允许继续计入当前需求',
)
assert.deepEqual(
  fullDispositionDecision.options.map((option) => option.value).sort(),
  ['DISPOSE', 'RETURN_TO_STOCK', 'TRANSFER_USE'].sort(),
  '全部数量替换的旧料只能转库存、转其他生产单或处置',
)
assert.ok(!fullCurrentPreview.lockObjectIds.includes('MAT-FAB-018'), '锁定对象不得包含原物料主数据 ID')
const realAffectedDocumentNos = ['MR-202603-010', 'MI-202603-006', 'SP-202603-004-01', 'CUT-202603-004-01']
assert.ok(
  realAffectedDocumentNos.every(
    (documentNo) =>
      fullCurrentPreview.autoItems.some((item) => item.affectedDocumentNo === documentNo) &&
      fullCurrentPreview.lockObjectIds.includes(documentNo),
  ),
  '备料、领料、铺布和裁剪真实关联单据必须进入自动计划与锁定对象',
)
assert.ok(
  !fullCurrentPreview.affectedOrderIds.some((orderId) => orderId !== materialDraft.productionOrderId),
  '当前生产单范围不得误加入后续生产单',
)

const followingOrdersDraft: ProductionChangeDraft = {
  ...materialDraft,
  materialReplacement: {
    ...materialDraft.materialReplacement!,
    replacementMode: 'REMAINING',
    scope: 'CURRENT_AND_FOLLOWING',
    followingOrders: [
      {
        productionOrderId: 'PO-202603-006',
        progressText: '尚未备料',
        started: false,
        suggestedMode: 'REMAINING',
        confirmedMode: 'REMAINING',
        affectedDocumentNos: ['MR-FOLLOW-006'],
      },
      {
        productionOrderId: 'PO-202603-007',
        progressText: '已领料，尚未裁剪',
        started: true,
        suggestedMode: 'REMAINING',
        confirmedMode: 'REMAINING',
        affectedDocumentNos: ['MI-FOLLOW-007', 'CUT-FOLLOW-007'],
      },
      {
        productionOrderId: 'PO-202603-008',
        progressText: '已完成并结算',
        started: true,
        suggestedMode: 'FULL',
        confirmedMode: 'FULL',
        changeable: false,
        affectedDocumentNos: ['SETTLED-FOLLOW-008'],
      },
    ],
  },
  decisionValues: {},
}
const followingOrdersPreview = buildProductionChangePreview(followingOrdersDraft)
const futureOnlyPreview = buildProductionChangePreview({
  ...followingOrdersDraft,
  materialReplacement: {
    ...followingOrdersDraft.materialReplacement!,
    followingOrders: [],
  },
})
assert.ok(
  futureOnlyPreview.autoItems.some((item) => item.id === 'future-production-order-version-relation'),
  '当前没有已创建后续单时，正式版本调整仍必须作用于以后新建生产单',
)
const futureRelationItem = futureOnlyPreview.autoItems.find(
  (item) => item.id === 'future-production-order-version-relation',
)
assert.ok(futureRelationItem?.affectedDocumentNo.startsWith('正式版本关系-'), '未来生产单正式版本调整必须绑定明确关系对象')
assert.ok(
  futureRelationItem && futureOnlyPreview.lockObjectIds.includes(futureRelationItem.affectedDocumentNo),
  '未来生产单正式版本关系必须进入锁定范围',
)
const noOldMaterialFollowingPreview = buildProductionChangePreview({
  ...followingOrdersDraft,
  materialReplacement: {
    ...followingOrdersDraft.materialReplacement!,
    replacementMode: 'FULL',
    followingOrders: [
      {
        productionOrderId: 'PO-202603-0102',
        progressText: '任务已建立但尚未领料',
        started: true,
        suggestedMode: 'FULL',
        confirmedMode: 'FULL',
        affectedDocumentNos: [],
      },
    ],
  },
  decisionValues: {
    'following-order-mode-PO-202603-0102': { value: 'FULL', reason: '' },
  },
})
assert.ok(
  !noOldMaterialFollowingPreview.decisionItems.some(
    (item) => item.id === 'following-old-material-disposition-PO-202603-0102',
  ),
  '后续生产单没有旧料、裁片或完成数量时不得制造实物去向判断',
)
const followingTraceDecisionValues = {
  'following-order-mode-PO-202603-007': { value: 'REMAINING', reason: '按已领料事实只处理剩余数量。' },
}
const followingTraceRecord = buildProductionChangeRecord(
  'BG-CHECK-FOLLOWING-TRACE',
  { ...followingOrdersDraft, decisionValues: followingTraceDecisionValues },
  'DONE',
  '2026-07-11 12:00',
)
const followingTracePlanDocumentNos = [...followingTraceRecord.preview.autoItems, ...followingTraceRecord.preview.decisionItems]
  .map((item) => item.affectedDocumentNo.trim())
  .filter(Boolean)
const followingTraceCurrentFactDocumentNos = (followingTraceRecord.currentFactsSnapshot?.documentFacts ?? [])
  .map((fact) => fact.documentNo.trim())
  .filter(Boolean)
const followingTraceExpectedDocumentNos = Array.from(new Set([
  ...followingTraceRecord.preview.affectedOrderIds,
  ...followingTraceCurrentFactDocumentNos,
  ...followingTracePlanDocumentNos,
])).sort()
assert.deepEqual(
  followingTraceRecord.affectedDocumentNos?.slice().sort(),
  followingTraceExpectedDocumentNos,
  '最终记录受影响单据必须是当前事实与预览计划单据的稳定去重并集',
)
;['PO-202603-006', 'MR-FOLLOW-006', 'PO-202603-007', 'MI-FOLLOW-007', 'CUT-FOLLOW-007'].forEach((documentNo) => {
  assert.ok(
    followingTraceRecord.affectedDocumentNos?.includes(documentNo),
    `当前及后续成功记录必须保留后续单据留痕：${documentNo}`,
  )
  const trace = followingTraceRecord.documentTraces.find((item) => item.documentNo === documentNo)
  assert.ok(trace, `详情留痕必须包含后续单据：${documentNo}`)
  assert.equal(trace?.changeOrderId, followingTraceRecord.id, '后续留痕必须可反查来源变更单号')
  assert.ok(trace?.beforeText && trace.afterText && trace.handlingText, '留痕必须包含前后值和处理方式')
  assert.equal(trace?.executedAt, '2026-07-11 12:00', '成功留痕必须保存执行时间')
})
assert.ok(
  new Set(followingTraceRecord.documentTraces.map((trace) => `${trace.beforeText}\u0000${trace.afterText}`)).size > 1,
  '不同生产单和上下游单据必须生成各自的前后差异，不能复制同一段留痕',
)
assert.ok(
  followingTraceRecord.documentTraces.some((trace) => trace.documentTypeLabel === '生产单') &&
    followingTraceRecord.documentTraces.some((trace) => trace.documentTypeLabel === '裁剪单'),
  '留痕必须识别生产单和具体上下游单据类型',
)
const unstartedFollowingAutoItem = followingOrdersPreview.autoItems.find(
  (item) => item.id === 'following-order-auto-PO-202603-006',
)
assert.ok(unstartedFollowingAutoItem, '未开工后续生产单必须由系统自动处理')
assert.ok(
  unstartedFollowingAutoItem.description.includes('全部切换新正式版本'),
  '未开工后续生产单必须全部切换新正式版本，不受当前单替换模式影响',
)
const suggestedFollowingDecision = followingOrdersPreview.decisionItems.find(
  (item) => item.id === 'following-order-mode-PO-202603-007',
)
assert.ok(suggestedFollowingDecision, '已开工后续生产单必须产生剩余/全部替换判断')
assert.equal(suggestedFollowingDecision.selectedValue, '', '系统建议不得自动成为跟单已确认选择')
assert.equal(suggestedFollowingDecision.reasonRequired, false, '尚未选择时不得提前要求填写偏离原因')
assert.ok(
  validateProductionChangeDecisions(followingOrdersPreview).includes(suggestedFollowingDecision.id),
  'decisionValues 为空时已开工后续单判断必须校验失败',
)
const acceptedSuggestedFollowingPreview = buildProductionChangePreview({
  ...followingOrdersDraft,
  decisionValues: {
    [suggestedFollowingDecision.id]: { value: 'REMAINING', reason: '' },
  },
})
assert.ok(
  !validateProductionChangeDecisions(acceptedSuggestedFollowingPreview).includes(suggestedFollowingDecision.id),
  '跟单明确选择 suggestedMode 后必须通过且不要求原因',
)
;['MI-FOLLOW-007', 'CUT-FOLLOW-007'].forEach((documentNo) => {
  assert.ok(
    [...followingOrdersPreview.autoItems, ...followingOrdersPreview.decisionItems].some(
      (item) => item.affectedDocumentNo === documentNo,
    ),
    `已开工后续单关联单据 ${documentNo} 必须进入处理计划`,
  )
  assert.ok(followingOrdersPreview.lockObjectIds.includes(documentNo), `已开工后续单关联单据 ${documentNo} 必须锁定`)
})
const frozenFollowingOrderId = 'PO-202603-008'
const frozenFollowingOrderReference = '202603-008'
assert.ok(!followingOrdersPreview.affectedOrderIds.includes(frozenFollowingOrderId), '不可变更后续单不得进入影响生产单')
assert.ok(
  ![...followingOrdersPreview.autoItems, ...followingOrdersPreview.decisionItems].some(
    (item) => item.id.includes(frozenFollowingOrderReference) || item.affectedDocumentNo.includes(frozenFollowingOrderReference),
  ),
  '不可变更后续单不得生成计划项',
)
assert.ok(
  !followingOrdersPreview.lockObjectIds.some((id) => id.includes(frozenFollowingOrderReference)),
  '不可变更后续单不得进入锁定对象',
)

const illegalFollowingPreview = buildProductionChangePreview({
  ...followingOrdersDraft,
  decisionValues: {
    [suggestedFollowingDecision.id]: { value: 'INVALID_MODE', reason: '非法选项不应通过。' },
  },
})
assert.ok(
  validateProductionChangeDecisions(illegalFollowingPreview).includes(suggestedFollowingDecision.id),
  '判断值不属于可选项时必须校验失败',
)
const deviatedFollowingPreview = buildProductionChangePreview({
  ...followingOrdersDraft,
  decisionValues: {
    [suggestedFollowingDecision.id]: { value: 'FULL', reason: '' },
  },
})
const deviatedFollowingDecision = deviatedFollowingPreview.decisionItems.find(
  (item) => item.id === suggestedFollowingDecision.id,
)
assert.ok(deviatedFollowingDecision?.reasonRequired, '偏离系统建议时必须要求填写原因')
assert.ok(
  validateProductionChangeDecisions(deviatedFollowingPreview).includes(suggestedFollowingDecision.id),
  '偏离系统建议但未填写原因时必须校验失败',
)
const explainedDeviationPreview = buildProductionChangePreview({
  ...followingOrdersDraft,
  decisionValues: {
    [suggestedFollowingDecision.id]: { value: 'FULL', reason: '现场确认已领旧料全部退回。' },
  },
})
assert.ok(
  !validateProductionChangeDecisions(explainedDeviationPreview).includes(suggestedFollowingDecision.id),
  '偏离系统建议并填写原因后必须校验通过',
)

const confirmedModePreview = buildProductionChangePreview({
  ...followingOrdersDraft,
  materialReplacement: {
    ...followingOrdersDraft.materialReplacement!,
    followingOrders: [
      {
        productionOrderId: 'PO-202603-009',
        progressText: '已领料，尚未裁剪',
        started: true,
        suggestedMode: 'REMAINING',
        confirmedMode: 'FULL',
        affectedDocumentNos: ['MI-FOLLOW-009'],
      },
    ],
  },
  decisionValues: {},
})
const confirmedModeDecision = confirmedModePreview.decisionItems.find(
  (item) => item.id === 'following-order-mode-PO-202603-009',
)
assert.equal(confirmedModeDecision?.selectedValue, '', 'confirmedMode 可用于结果预估，但不得冒充跟单当前选择')
assert.equal(confirmedModeDecision?.reasonRequired, false, '未明确选择时不得因 confirmedMode 偏离建议而要求原因')
assert.ok(
  confirmedModeDecision && validateProductionChangeDecisions(confirmedModePreview).includes(confirmedModeDecision.id),
  'confirmedMode 存在时仍必须等待跟单明确选择',
)

const fullCurrentWithRemainingFollowingDraft: ProductionChangeDraft = {
  ...materialDraft,
  materialReplacement: {
    ...materialDraft.materialReplacement!,
    replacementMode: 'FULL',
    scope: 'CURRENT_AND_FOLLOWING',
    followingOrders: [
      {
        productionOrderId: 'PO-202603-010',
        progressText: '已领料，尚未裁剪',
        started: true,
        suggestedMode: 'FULL',
        confirmedMode: 'FULL',
        affectedDocumentNos: ['MI-FOLLOW-010', 'CUT-FOLLOW-010'],
      },
    ],
  },
  decisionValues: {
    'following-order-mode-PO-202603-010': { value: 'REMAINING', reason: '现场已形成不可逆生产事实。' },
  },
}
const fullCurrentWithRemainingFollowingPreview = buildProductionChangePreview(fullCurrentWithRemainingFollowingDraft)
assert.equal(
  fullCurrentWithRemainingFollowingPreview.result,
  'VERSION_AND_PATCH',
  '当前单全部替换但已开工后续单改选剩余替换时必须同时调整版本并打补丁',
)
assert.ok(
  fullCurrentWithRemainingFollowingPreview.decisionItems.some(
    (item) => item.id === 'following-order-mode-PO-202603-010' && item.description.includes('剩余部分打补丁'),
  ),
  '已开工后续单选择剩余替换时计划必须体现剩余部分打补丁',
)
assert.ok(
  fullCurrentWithRemainingFollowingPreview.resultReason.includes('包含剩余数量替换') &&
    !fullCurrentWithRemainingFollowingPreview.summary.materialDeltaText.includes('最终均为全部替换'),
  '综合结果原因与摘要必须反映后续单剩余替换',
)

const allFullPreview = buildProductionChangePreview({
  ...fullCurrentWithRemainingFollowingDraft,
  decisionValues: {
    'following-order-mode-PO-202603-010': { value: 'FULL', reason: '' },
  },
})
assert.equal(allFullPreview.result, 'VERSION_RELATION', '当前单和所有可变更后续单均全部替换时只调整正式版本绑定')
assert.ok(
  allFullPreview.decisionItems.some(
    (item) => item.id === 'following-order-mode-PO-202603-010' && item.description.includes('整体切换'),
  ),
  '已开工后续单选择全部替换时计划必须体现整体切换',
)
assert.ok(
  allFullPreview.resultReason.includes('最终均为全部替换'),
  '全部替换方案的结果原因必须与综合最终模式一致',
)

const noDocumentFactsPreview = buildProductionChangePreview({
  ...materialDraft,
  affectedDocumentNos: undefined,
  materialReplacement: {
    ...materialDraft.materialReplacement!,
    replacementMode: 'REMAINING',
    scope: 'CURRENT_ONLY',
    followingOrders: [],
  },
  decisionValues: {},
})
assert.deepEqual(noDocumentFactsPreview.lockObjectIds, [materialDraft.productionOrderId], '未传关联单据事实时不得制造单据锁')
assert.ok(
  [...noDocumentFactsPreview.autoItems, ...noDocumentFactsPreview.decisionItems].every(
    (item) => item.affectedDocumentNo === '',
  ),
  '未传关联单据事实时计划项不得拼接伪造单据号',
)

const dirtyFollowingPreview = buildProductionChangePreview({
  ...followingOrdersDraft,
  affectedDocumentNos: [' MR-CURRENT-001 ', '', 'MR-CURRENT-001'],
  materialReplacement: {
    ...followingOrdersDraft.materialReplacement!,
    followingOrders: [
      {
        productionOrderId: '   ',
        progressText: '无生产单号',
        started: false,
        suggestedMode: 'FULL',
        confirmedMode: 'FULL',
        affectedDocumentNos: ['SHOULD-NOT-LOCK'],
      },
      {
        productionOrderId: 'PO-DUPLICATE-001',
        progressText: '尚未备料',
        started: false,
        suggestedMode: 'FULL',
        confirmedMode: 'FULL',
        affectedDocumentNos: ['MR-DUPLICATE-001', '', 'MR-DUPLICATE-001'],
      },
      {
        productionOrderId: ' PO-DUPLICATE-001 ',
        progressText: '重复生产单',
        started: true,
        suggestedMode: 'REMAINING',
        confirmedMode: 'REMAINING',
        affectedDocumentNos: ['SHOULD-NOT-LOCK-DUPLICATE'],
      },
    ],
  },
  decisionValues: {},
})
assert.deepEqual(
  dirtyFollowingPreview.affectedOrderIds,
  [followingOrdersDraft.productionOrderId, 'PO-DUPLICATE-001'],
  '后续生产单必须过滤空 ID、清理空格并按 ID 去重',
)
assert.ok(!dirtyFollowingPreview.lockObjectIds.includes(''), '清洗后的锁定对象不得包含空值')
assert.equal(
  new Set(dirtyFollowingPreview.lockObjectIds).size,
  dirtyFollowingPreview.lockObjectIds.length,
  '清洗后的锁定对象不得重复',
)
assert.ok(!dirtyFollowingPreview.lockObjectIds.includes('SHOULD-NOT-LOCK'), '空生产单不得带入关联单据锁')
assert.ok(
  !dirtyFollowingPreview.lockObjectIds.includes('SHOULD-NOT-LOCK-DUPLICATE'),
  '重复生产单不得生成第二组计划或关联单据锁',
)
assert.equal(
  dirtyFollowingPreview.autoItems.filter((item) => item.id === 'following-order-auto-PO-DUPLICATE-001').length,
  1,
  '重复后续生产单只能生成一个主计划项',
)
const dirtyPlanItemIds = [...dirtyFollowingPreview.autoItems, ...dirtyFollowingPreview.decisionItems].map((item) => item.id)
assert.equal(new Set(dirtyPlanItemIds).size, dirtyPlanItemIds.length, '清洗后的计划项 ID 不得重复')

const incompletePreview = buildProductionChangePreview(materialDraft)
assert.ok(incompletePreview.autoItems.length > 0, '预览必须生成系统自动处理项')
assert.ok(incompletePreview.decisionItems.length > 0, '业务无法自动判断时必须生成待跟单判断项')
assert.ok(incompletePreview.autoItems.every((item) => item.kind === 'AUTO'), 'autoItems 只能包含系统自动处理项')
assert.ok(
  incompletePreview.decisionItems.every((item) => item.kind === 'MERCHANDISER_DECISION'),
  'decisionItems 只能包含待跟单判断项',
)
assert.deepEqual(
  validateProductionChangeDecisions(incompletePreview).sort(),
  incompletePreview.decisionItems.map((item) => item.id).sort(),
  '未选择或未填写必要原因的判断项必须被校验发现',
)
const oldMaterialDispositionDecision = incompletePreview.decisionItems.find(
  (item) => item.id === 'old-material-disposition',
)
assert.equal(oldMaterialDispositionDecision?.selectedValue, '', 'FULL 旧料去向初始必须为空')
assert.ok(
  oldMaterialDispositionDecision && validateProductionChangeDecisions(incompletePreview).includes(oldMaterialDispositionDecision.id),
  'FULL 旧料去向未选择时必须校验失败',
)
assert.ok(incompletePreview.lockObjectIds.includes(materialDraft.productionOrderId), '锁定对象必须包含当前生产单')
assert.ok(incompletePreview.lockObjectIds.every((id) => id.trim().length > 0), '锁定对象不得包含空值')
const affectedDocumentNos = [...incompletePreview.autoItems, ...incompletePreview.decisionItems]
  .map((item) => item.affectedDocumentNo)
  .filter((documentNo) => documentNo.trim().length > 0)
assert.ok(
  affectedDocumentNos.every((documentNo) => incompletePreview.lockObjectIds.includes(documentNo)),
  '所有计划项关联单据都必须进入锁定对象',
)
assert.equal(
  new Set(incompletePreview.lockObjectIds).size,
  incompletePreview.lockObjectIds.length,
  '锁定对象必须去重',
)

const completedDecisionValues = Object.fromEntries(
  incompletePreview.decisionItems.map((item) => [
    item.id,
    { value: item.options[item.options.length - 1]?.value ?? '', reason: '跟单已核对现场事实。' },
  ]),
)
const completedPreview = buildProductionChangePreview({
  ...materialDraft,
  decisionValues: completedDecisionValues,
})
completedPreview.decisionItems.forEach((item) => {
  assert.equal(item.selectedValue, completedDecisionValues[item.id]?.value, 'decisionValues 必须覆盖判断项默认选择')
  assert.equal(item.reason, completedDecisionValues[item.id]?.reason, 'decisionValues 必须覆盖判断项原因')
})
assert.deepEqual(validateProductionChangeDecisions(completedPreview), [], '必要判断完成后校验必须通过')

const quantityFactoryOrderId = 'PO-202603-0004'
const factoryQuantityLines = createQuantityLinesForOrder(quantityFactoryOrderId)
assert.ok(factoryQuantityLines.length >= 2, '现有关系生产单必须生成至少两条数量明细')
const factoryDemandFacts = changeDomain.getProductionOrderChangeCurrentFacts(quantityFactoryOrderId)?.demandQuantityFacts ?? []
assert.deepEqual(
  factoryQuantityLines.map((line) => [line.id, line.skuCode, line.color, line.size, line.currentQty]),
  factoryDemandFacts.map((fact) => [fact.id, fact.skuCode, fact.color, fact.size, fact.currentDemandQty]),
  '第一步当前需求事实与第二步数量明细必须逐行来自同一数据对象',
)
assert.ok(createQuantityLinesForOrder('PO-202604-0018').length > 0, 'PO-202604-0018 必须能从当前事实进入变更流程')
const factBasedAllocations = buildMaterialReplacementAllocations(quantityFactoryOrderId, 0)
factBasedAllocations.forEach((allocation) => {
  const fact = factoryDemandFacts.find((item) =>
    item.skuCode === allocation.skuCode && item.color === allocation.color && item.size === allocation.size,
  )
  assert.equal(allocation.oldMaterialFactQty, Math.min(fact?.executedQty ?? 0, allocation.demandQty), '已完成生产件数必须读取事实')
  assert.equal(allocation.suggestedReplacementQty, allocation.demandQty - allocation.oldMaterialFactQty, '剩余待生产件数必须由需求减已完成得到')
})
factoryQuantityLines.forEach((line) => {
  assert.equal(line.unit, '件', '数量明细单位必须为件')
  assert.equal(line.originalQty, line.currentQty, '数量明细原数量与当前数量必须一致')
  assert.equal(line.currentQty, line.targetQty, '数量明细当前数量与目标数量初始值必须一致')
})
const legacyQuantityOrder = changeDomain.listProductionOrderChangeOrders().find(
  (order) => order.id === 'CHANGE-PO-202603-0004-001',
)
assert.ok(legacyQuantityOrder?.quantityLines, '旧数量编辑适配检查需要 CHANGE-PO-202603-0004-001')
const legacyQuantityAdaptation = adaptLegacyQuantityLinesForEdit(
  quantityFactoryOrderId,
  legacyQuantityOrder.quantityLines,
)
assert.equal(
  legacyQuantityAdaptation.quantityLines.length,
  factoryQuantityLines.length,
  '旧数量记录适配不得增加当前需求行数',
)
assert.ok(
  legacyQuantityAdaptation.quantityLines.every((line) => line.isNew === false),
  '旧数量记录匹配结果不得伪装成新增需求',
)
const adaptedBlackM = legacyQuantityAdaptation.quantityLines.find(
  (line) => line.color === '黑色' && line.size === 'M',
)
assert.equal(adaptedBlackM?.targetQty, 1170, '黑色 M 必须按旧记录差额 -30 映射到当前事实 1200→1170')
assert.equal(
  legacyQuantityAdaptation.quantityLines.reduce((sum, line) => sum + line.targetQty, 0),
  factoryQuantityLines.reduce((sum, line) => sum + line.currentQty, 0) - 50,
  '目标总量必须等于当前需求总量加所有已匹配旧行差额',
)
assert.deepEqual(legacyQuantityAdaptation.unmatchedLegacyLines, [], '当前事实中的两条旧记录必须全部安全匹配')
const safeLegacyQuantityAdaptation = adaptLegacyQuantityLinesForEdit(
  quantityFactoryOrderId,
  [legacyQuantityOrder.quantityLines[0]],
)
assert.equal(safeLegacyQuantityAdaptation.unmatchedLegacyLines.length, 0, '全部可匹配的旧记录必须保持可编辑')

const legacyOriginalIdentity = createLegacyMaterialValue(
  LEGACY_ORIGINAL_MATERIAL_PREFIX,
  '原面料：特殊混纺　面料 280G',
)
const legacyReplacementIdentity = createLegacyMaterialValue(
  LEGACY_REPLACEMENT_MATERIAL_PREFIX,
  '新面料:  特殊混纺 面料 280g',
)
assert.ok(
  areMaterialSelectionsEquivalent(legacyOriginalIdentity, [], legacyReplacementIdentity, []),
  '不同兼容前缀包装的相同非 FAB 文本必须识别为同一物料',
)

const replacementMaterialOptions = listReplacementMaterialOptions()
const validFabricMaterialIds = Array.from(
  new Set(listMaterialArchives('fabric').map((material) => material.materialId.trim()).filter(Boolean)),
).sort()
const replacementMaterialOptionValues = replacementMaterialOptions.map((option) => option.value)
assert.deepEqual(
  [...replacementMaterialOptionValues].sort(),
  validFabricMaterialIds,
  '替换物料候选必须严格等于系统 fabric 主档有效 ID 集合',
)
assert.ok(replacementMaterialOptionValues.every((value) => value.trim().length > 0), '替换物料候选 value 不得为空')
assert.equal(
  new Set(replacementMaterialOptionValues).size,
  replacementMaterialOptions.length,
  '替换物料候选 value 必须唯一',
)

const followingOrderPlans = createFollowingOrderPlans(quantityFactoryOrderId)
assert.ok(followingOrderPlans.length >= 2, 'PO-202603-0004 必须覆盖至少两张后续生产单场景')
const followingOrderIds = followingOrderPlans.map((plan) => plan.productionOrderId)
assert.ok(followingOrderIds.every((id) => id.trim().length > 0), '后续生产单不得包含空 ID')
assert.equal(new Set(followingOrderIds).size, followingOrderIds.length, '后续生产单 ID 必须去重')
assert.ok(
  followingOrderPlans.every((plan) => plan.changeable === true),
  '后续生产单计划必须已通过结构化关闭状态过滤',
)
const startedFollowingOrderPlan = followingOrderPlans.find((plan) => plan.started)
assert.ok(startedFollowingOrderPlan, 'PO-202603-0004 后续单场景必须包含已开工生产单')
assert.equal(startedFollowingOrderPlan.suggestedMode, 'REMAINING', '已开工后续生产单必须建议只替换剩余数量')
assert.equal(startedFollowingOrderPlan.confirmedMode, 'REMAINING', '已开工后续生产单初始必须确认剩余数量替换')
assert.equal(startedFollowingOrderPlan.changeable, true, '已开工场景种子必须从 EXECUTING 推导为可变更')
assert.ok(
  (startedFollowingOrderPlan.affectedDocumentNos ?? []).length > 0,
  '已开工后续生产单必须带明确受影响单据号',
)
const unstartedFollowingOrderPlan = followingOrderPlans.find((plan) => !plan.started)
assert.ok(unstartedFollowingOrderPlan, 'PO-202603-0004 后续单场景必须包含未开工生产单')
assert.equal(unstartedFollowingOrderPlan.progressText, '尚未开始', '未开工后续生产单进度必须明确为尚未开始')
assert.equal(unstartedFollowingOrderPlan.suggestedMode, 'FULL', '未开工后续生产单必须建议全部替换')
assert.equal(unstartedFollowingOrderPlan.confirmedMode, 'FULL', '未开工后续生产单初始必须确认全部替换')
assert.equal(unstartedFollowingOrderPlan.changeable, true, '未开工场景种子必须从 READY_FOR_BREAKDOWN 推导为可变更')

assert.deepEqual(
  resolveFollowingOrderStateFromProgressFallback(['裁片：已完成', '车缝：未交出']),
  { changeable: true, started: true },
  '局部环节已完成不得排除整张生产单，且应视为已开工',
)
assert.deepEqual(
  resolveFollowingOrderStateFromProgressFallback(['配料：已配 20%', '领料：未开始']),
  { changeable: true, started: true },
  '已配进度必须保守视为已开工',
)
assert.deepEqual(
  resolveFollowingOrderStateFromProgressFallback(['印花：加工中', '菲票：已生成']),
  { changeable: true, started: true },
  '加工中或已生成事实必须保守视为已开工',
)
;[['生产单已完成'], ['整单已结算'], ['已完成'], ['已结算']].forEach((progressTexts) => {
  assert.equal(
    resolveFollowingOrderStateFromProgressFallback(progressTexts).changeable,
    false,
    `${progressTexts[0]}必须排除后续变更`,
  )
})

const documentFactOrder = changeDomain.listProductionOrderTechPackRelations().find(
  (relation) => (changeDomain.getProductionOrderChangeCurrentFacts(relation.productionOrderId)?.documentFacts.length ?? 0) > 0,
)
assert.ok(documentFactOrder, '必须找到当前事实单据非空的真实生产单')
const currentFacts = changeDomain.getProductionOrderChangeCurrentFacts(documentFactOrder.productionOrderId)
const currentFactDocumentNos = Array.from(
  new Set((currentFacts?.documentFacts ?? []).map((fact) => fact.documentNo.trim()).filter(Boolean)),
).sort()
assert.ok(currentFactDocumentNos.length > 0, '真实生产单当前事实单据集合不得为空')
const affectedDocumentNosForOrder = listAffectedDocumentNosForOrder(documentFactOrder.productionOrderId)
assert.ok(affectedDocumentNosForOrder.length > 0, '受影响单据号结果不得为空')
assert.ok(affectedDocumentNosForOrder.every((documentNo) => documentNo.trim().length > 0), '受影响单据号不得为空值')
assert.equal(new Set(affectedDocumentNosForOrder).size, affectedDocumentNosForOrder.length, '受影响单据号必须去重')
assert.deepEqual(
  [...affectedDocumentNosForOrder].sort(),
  currentFactDocumentNos,
  '受影响单据号集合必须与真实当前事实单据集合完全一致',
)

const quantityPreviewDocumentNos = listAffectedDocumentNosForOrder(quantityFactoryOrderId)
const quantityPreviewLines = createQuantityLinesForOrder(quantityFactoryOrderId)
quantityPreviewLines[0].targetQty -= 20
const quantityPreview = buildProductionChangePreview({
  productionOrderId: quantityFactoryOrderId,
  changeType: 'QUANTITY_CHANGE',
  reason: '黑色 M 减少 20 件。',
  quantityLines: quantityPreviewLines,
  materialReplacement: null,
  decisionValues: {},
  affectedDocumentNos: quantityPreviewDocumentNos,
})
const cuttingAutoItem = quantityPreview.autoItems.find(
  (item) => item.title === '裁剪单未执行数量自动调整',
)
assert.ok(cuttingAutoItem, '数量变更必须生成裁剪单未执行数量自动调整 AUTO 项')
assert.equal(
  cuttingAutoItem.description,
  '已执行数量保持不变，按每条需求明细的增减分别调整剩余计划并写入变更留痕。',
  '裁剪数量 AUTO 项必须使用确认后的系统处理文案',
)
assert.ok(
  quantityPreviewDocumentNos.includes(cuttingAutoItem.affectedDocumentNo),
  '裁剪数量 AUTO 项必须使用当前事实中的实际单据号',
)
assert.equal(quantityPreview.decisionItems.length, 0, '数量变更的可判断事项必须全部由系统自动处理')

const coveredNewLinePreview = buildProductionChangePreview({
  productionOrderId: quantityFactoryOrderId,
  changeType: 'QUANTITY_CHANGE',
  reason: '新增正式版本已覆盖的黑色 S 明细',
  quantityLines: [
    ...createQuantityLinesForOrder(quantityFactoryOrderId),
    {
      id: 'QTY-COVERED-S',
      skuCode: 'SKU-010-S-BLK',
      color: '黑色',
      size: 'S',
      originalQty: 0,
      currentQty: 0,
      targetQty: 50,
      unit: '件',
      isNew: true,
      coveredByCurrentVersion: false,
    },
  ],
  materialReplacement: null,
  decisionValues: {},
  affectedDocumentNos: quantityPreviewDocumentNos,
})
assert.equal(coveredNewLinePreview.result, 'PRODUCTION_PATCH', '正式版本已覆盖的新增明细只能生成生产单补丁')
const coveredOtherOrderLines = createQuantityLinesForOrder('PO-202604-0018')
const coveredOtherOrderPreview = buildProductionChangePreview({
  productionOrderId: 'PO-202604-0018',
  changeType: 'QUANTITY_CHANGE',
  reason: '其他生产单新增正式版本已覆盖的 XS 明细',
  quantityLines: [
    ...coveredOtherOrderLines,
    {
      id: 'QTY-018-COVERED-XS',
      skuCode: 'SKU-018-XS-PRINT',
      color: '全色',
      size: 'XS',
      originalQty: 0,
      currentQty: 0,
      targetQty: 40,
      unit: '件',
      isNew: true,
      coveredByCurrentVersion: false,
    },
  ],
  materialReplacement: null,
  decisionValues: {},
  affectedDocumentNos: listAffectedDocumentNosForOrder('PO-202604-0018'),
})
assert.equal(coveredOtherOrderPreview.result, 'PRODUCTION_PATCH', '所有生产单都必须按各自当前正式版本判断新增明细覆盖关系')
const uncoveredNewLinePreview = buildProductionChangePreview({
  productionOrderId: quantityFactoryOrderId,
  changeType: 'QUANTITY_CHANGE',
  reason: '新增正式版本未覆盖的绿色 XXL 明细',
  quantityLines: [
    ...createQuantityLinesForOrder(quantityFactoryOrderId),
    {
      id: 'QTY-UNCOVERED-XXL',
      skuCode: 'SKU-NEW-XXL-GRN',
      color: '绿色',
      size: 'XXL',
      originalQty: 0,
      currentQty: 0,
      targetQty: 30,
      unit: '件',
      isNew: true,
      coveredByCurrentVersion: true,
    },
  ],
  materialReplacement: null,
  decisionValues: {},
  affectedDocumentNos: quantityPreviewDocumentNos,
})
assert.equal(uncoveredNewLinePreview.result, 'VERSION_AND_PATCH', '正式版本未覆盖的新增明细必须同时调整版本绑定并打补丁')

const offsetQuantityLines = createQuantityLinesForOrder(quantityFactoryOrderId)
offsetQuantityLines[0].targetQty += 30
offsetQuantityLines[1].targetQty -= 30
const offsetQuantityPreview = buildProductionChangePreview({
  productionOrderId: quantityFactoryOrderId,
  changeType: 'QUANTITY_CHANGE',
  reason: '两条明细一增一减且总量不变',
  quantityLines: offsetQuantityLines,
  materialReplacement: null,
  decisionValues: {},
  affectedDocumentNos: quantityPreviewDocumentNos,
})
assert.ok(
  offsetQuantityPreview.autoItems.some((item) => item.description.includes('每条需求明细的增加或减少')),
  '总量净变化为零时仍必须逐明细驱动物料、成本和交期处理',
)

const belowExecutedLines = createQuantityLinesForOrder(quantityFactoryOrderId)
belowExecutedLines[0].targetQty = 300
const belowExecutedPreview = buildProductionChangePreview({
  productionOrderId: quantityFactoryOrderId,
  changeType: 'QUANTITY_CHANGE',
  reason: '目标数量低于已完成数量',
  quantityLines: belowExecutedLines,
  materialReplacement: null,
  decisionValues: {},
  affectedDocumentNos: quantityPreviewDocumentNos,
})
assert.ok(
  belowExecutedPreview.decisionItems.some((item) => item.id === `quantity-over-produced-${belowExecutedLines[0].id}`),
  '目标数量低于已完成数量时必须要求跟单确认超出成品去向',
)

const totalDemandQty = factoryQuantityLines.reduce((sum, line) => sum + line.currentQty, 0)
const allocationScenarios = [
  { input: 10.5, expected: 11, label: '小数件四舍五入' },
  { input: -10, expected: 0, label: '负数归零' },
  { input: Number.NaN, expected: 0, label: 'NaN 归零' },
  { input: 0, expected: 0, label: '零件' },
  { input: 777, expected: 777, label: '中间整数' },
  { input: totalDemandQty + 100, expected: totalDemandQty, label: '超需求限制' },
]
allocationScenarios.forEach(({ input, expected, label }) => {
  const allocations = buildMaterialReplacementAllocations(quantityFactoryOrderId, input)
  assert.equal(
    allocations.reduce((sum, line) => sum + line.confirmedReplacementQty, 0),
    expected,
    `${label}的分配总数不正确`,
  )
  allocations.forEach((line) => {
    assert.ok(Number.isInteger(line.confirmedReplacementQty), `${label}不得产生小数件`)
    assert.ok(line.confirmedReplacementQty >= 0, `${label}每行确认替换数量不得为负数`)
    assert.ok(line.confirmedReplacementQty <= line.demandQty, `${label}每行确认替换数量不得超过需求数量`)
  })
})

const canonicalAllocations = buildMaterialReplacementAllocations(quantityFactoryOrderId, 120)
const unbalancedAllocations = canonicalAllocations.map((line, index) => ({
  ...line,
  confirmedReplacementQty: index === 0 ? line.demandQty + 20.7 : 0.4,
}))
const normalizedUnbalanced = normalizeMaterialReplacementAllocations(
  quantityFactoryOrderId,
  unbalancedAllocations,
  120.4,
)
assert.equal(normalizedUnbalanced.confirmedProductionQty, 120, '确认生产件数必须整数化')
assert.equal(
  normalizedUnbalanced.allocations.reduce((sum, line) => sum + line.confirmedReplacementQty, 0),
  normalizedUnbalanced.confirmedProductionQty,
  '不守恒分配归一后合计必须等于确认生产件数',
)
assert.ok(normalizedUnbalanced.wasNormalized, '超限、小数或合计不等的分配必须标记为已归一')
normalizedUnbalanced.allocations.forEach((line) => {
  assert.ok(Number.isInteger(line.confirmedReplacementQty), '归一后的单行分配必须为整数')
  assert.ok(line.confirmedReplacementQty >= 0, '归一后的单行分配不得为负数')
  assert.ok(line.confirmedReplacementQty <= line.demandQty, '归一后的单行分配不得超过需求数量')
})
const preservedAllocations = normalizeMaterialReplacementAllocations(
  quantityFactoryOrderId,
  canonicalAllocations,
  120,
)
assert.deepEqual(preservedAllocations.allocations, canonicalAllocations, '合法且守恒的已有分配必须原样保留')
assert.equal(preservedAllocations.wasNormalized, false, '合法且守恒的已有分配不应标记为已归一')

const firstChangeForm = createProductionChangeForm()
const secondChangeForm = createProductionChangeForm()
assert.notEqual(firstChangeForm.quantityLines, secondChangeForm.quantityLines, '数量明细数组不得复用引用')
assert.notEqual(firstChangeForm.materialReplacement, secondChangeForm.materialReplacement, '物料替换对象不得复用引用')
assert.notEqual(
  firstChangeForm.materialReplacement.allocations,
  secondChangeForm.materialReplacement.allocations,
  '物料分配数组不得复用引用',
)
assert.notEqual(
  firstChangeForm.materialReplacement.followingOrders,
  secondChangeForm.materialReplacement.followingOrders,
  '后续生产单数组不得复用引用',
)
assert.notEqual(firstChangeForm.decisionValues, secondChangeForm.decisionValues, '判断值对象不得复用引用')
assert.notEqual(firstChangeForm.execution, secondChangeForm.execution, '执行状态对象不得复用引用')
assert.notEqual(firstChangeForm.execution.steps, secondChangeForm.execution.steps, '执行步骤数组不得复用引用')
firstChangeForm.reason = '第一份表单变更原因'
firstChangeForm.decisionValues.test = { value: 'FULL', reason: '第一份表单判断' }
firstChangeForm.materialReplacement.allocations.push({
  id: 'TEST-ALLOC-001',
  skuCode: 'TEST-SKU',
  color: '黑色',
  size: 'M',
  demandQty: 1,
  oldMaterialFactQty: 0,
  suggestedReplacementQty: 1,
  confirmedReplacementQty: 1,
})
firstChangeForm.execution.steps.push({ id: 'TEST-STEP-001', label: '测试步骤', status: 'WAITING' })
assert.equal(secondChangeForm.reason, '', '修改第一份表单原因不得污染第二份表单')
assert.deepEqual(secondChangeForm.decisionValues, {}, '修改第一份判断值不得污染第二份表单')
assert.deepEqual(secondChangeForm.materialReplacement.allocations, [], '修改第一份分配不得污染第二份表单')
assert.deepEqual(secondChangeForm.execution.steps, [], '修改第一份执行步骤不得污染第二份表单')

console.log('production change form state and stable mock checks passed')

const changePages = await import('../src/pages/production/changes-domain.ts')
const productionEvents = await import('../src/pages/production/events.ts')
const pageExports = changePages as Record<string, unknown>
const domainExports = changeDomain as Record<string, unknown>
const eventExports = productionEvents as Record<string, unknown>

const renderProductionChangesPage = requireFunction<() => string>(pageExports, 'renderProductionChangesPage')
const renderProductionChangeNewPage = requireFunction<() => string>(pageExports, 'renderProductionChangeNewPage')
const renderProductionChangeEditPage = requireFunction<(changeOrderId: string) => string>(
  pageExports,
  'renderProductionChangeEditPage',
)
const renderProductionChangeFormSteps = requireFunction<(step: typeof state.productionChangeFormStep) => string>(
  pageExports,
  'renderProductionChangeFormSteps',
)
const renderProductionChangeFormBody = requireFunction<(
  step: typeof state.productionChangeFormStep,
  form: typeof state.productionChangeForm,
) => string>(pageExports, 'renderProductionChangeFormBody')
const renderProductionChangeCurrentFactsSummary = requireFunction<(
  facts: NonNullable<ReturnType<typeof changeDomain.getProductionOrderChangeCurrentFacts>>,
) => string>(pageExports, 'renderProductionChangeCurrentFactsSummary')
const listCurrentMaterialOptionsForOrder = requireFunction<(
  productionOrderId: string,
) => Array<{ value: string; label: string }>>(pageExports, 'listCurrentMaterialOptionsForOrder')
const renderProductionChangeOrderDetailPage = requireFunction<(id: string) => string>(
  pageExports,
  'renderProductionChangeOrderDetailPage',
)
const renderProductionChangeRelationDetailPage = requireFunction<(id: string) => string>(
  pageExports,
  'renderProductionChangeRelationDetailPage',
)

const listProductionOrderChangeOrders = requireFunction<() => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeOrders',
)
const listProductionOrderTechPackRelations = requireFunction<() => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderTechPackRelations',
)
const getProductionOrderChangeOrder = requireFunction<(id: string) => Record<string, any> | undefined>(
  domainExports,
  'getProductionOrderChangeOrder',
)
const submitProductionOrderChangeOrder = requireFunction<(input: Record<string, any>) => Record<string, any>>(
  domainExports,
  'submitProductionOrderChangeOrder',
)
const createInitializedProductionChangeForm = requireFunction<(
  productionOrderId: string,
  changeType: typeof state.productionChangeForm.changeType,
) => typeof state.productionChangeForm>(eventExports, 'createInitializedProductionChangeForm')
const validateProductionChangeFormStep = requireFunction<(
  step: typeof state.productionChangeFormStep,
  form: typeof state.productionChangeForm,
) => string>(eventExports, 'validateProductionChangeFormStep')
const createProductionChangeFormFromRecord = requireFunction<(
  order: Record<string, any>,
) => typeof state.productionChangeForm>(eventExports, 'createProductionChangeFormFromRecord')
const applyProductionChangeFieldValue = requireFunction<(
  form: typeof state.productionChangeForm,
  field: string,
  value: string,
  meta?: { lineId?: string; allocationId?: string; decisionId?: string },
) => { handled: boolean; normalizedValue?: string; syncAllocationInputs?: boolean }>(
  eventExports,
  'applyProductionChangeFieldValue',
)
const transitionProductionChangeStep = requireFunction<(
  currentStep: typeof state.productionChangeFormStep,
  targetStep: typeof state.productionChangeFormStep,
  form: typeof state.productionChangeForm,
) => { step: typeof state.productionChangeFormStep; error: string }>(eventExports, 'transitionProductionChangeStep')
const executeProductionChangeForForm = requireFunction<(
  form: typeof state.productionChangeForm,
  options?: {
    shouldFail?: boolean
    execute?: (preview: ProductionChangePreview) => ReturnType<typeof executeProductionChange>
  },
) => {
  executed: boolean
  step: typeof state.productionChangeFormStep
  error: string
}>(eventExports, 'executeProductionChangeForForm')
const buildPostChangeProcessWorkOrderSnapshotsForForm = requireFunction<(
  form: typeof state.productionChangeForm,
  preview: ProductionChangePreview,
) => FormalProductionOrderProcessSnapshot[]>(eventExports, 'buildPostChangeProcessWorkOrderSnapshotsForForm')
const handleProductionEvent = requireFunction<(target: HTMLElement) => boolean>(
  eventExports,
  'handleProductionEvent',
)

const uiQuantitySnapshot: FormalProductionOrderProcessSnapshot = {
  ...workflowSyncSnapshot,
  productionOrderId: 'PO-CHANGE-UI-QUANTITY',
  productionOrderNo: 'PO-CHANGE-UI-QUANTITY',
  plannedQty: 100,
}
const uiQuantityOrder = ensureProcessWorkOrdersForFormalProductionOrder(uiQuantitySnapshot)
const uiQuantityForm = createProductionChangeForm()
Object.assign(uiQuantityForm, {
  recordId: 'BG-UI-QUANTITY-001',
  productionOrderId: uiQuantitySnapshot.productionOrderId,
  changeType: 'QUANTITY_CHANGE',
  quantityLines: [{
    id: 'UI-QTY-1', skuCode: 'SKU-UI', color: '蓝色', size: 'M', currentQty: 100, targetQty: 125,
    isNew: false, coveredByCurrentVersion: true,
  }],
})
const uiQuantityChangedSnapshots = buildPostChangeProcessWorkOrderSnapshotsForForm(uiQuantityForm, {
  ...executionPreview,
  affectedOrderIds: [uiQuantitySnapshot.productionOrderId],
})
assert.equal(uiQuantityChangedSnapshots[0]?.plannedQty, 125, 'events 数量变更快照必须从当前加工单事实按确认数量更新计划数量')
assert.equal(uiQuantityChangedSnapshots[0]?.productionOrderNo, uiQuantitySnapshot.productionOrderNo, 'events 快照必须保留正式生产单号')
assert.equal(getDyeWorkOrderById(uiQuantityOrder.dyeWorkOrderId!)?.plannedQty, 100, 'events helper 只构造候选快照，不得提前写加工单')
const uiQuantityIdentityBefore = getDyeWorkOrderById(uiQuantityOrder.dyeWorkOrderId!)!
const uiQuantityExecution = executeProductionChange(executionPreview, {
  processWorkOrderSnapshots: uiQuantityChangedSnapshots,
  changeRecordId: uiQuantityForm.recordId,
  processWorkOrderSyncRecordedAt: '2026-07-16 12:10:00',
  persist: (result) => result,
})
assert.equal(uiQuantityExecution.status, 'DONE', 'events 同款 options 必须可提交数量变更加工快照')
assert.deepEqual(
  [getDyeWorkOrderById(uiQuantityOrder.dyeWorkOrderId!)?.dyeOrderId, getDyeWorkOrderById(uiQuantityOrder.dyeWorkOrderId!)?.dyeOrderNo],
  [uiQuantityIdentityBefore.dyeOrderId, uiQuantityIdentityBefore.dyeOrderNo],
  '数量变更同步后加工单 ID 和单号必须保持不变',
)
assert.equal(getDyeWorkOrderById(uiQuantityOrder.dyeWorkOrderId!)?.plannedQty, 125, '数量变更必须真实更新加工单计划数量')

const uiMaterialArchive = listMaterialArchives('fabric').find((material) => material.materialId !== uiQuantitySnapshot.materialId)
assert(uiMaterialArchive, '缺少可用于 UI 物料变更快照检查的面料档案')
const uiMaterialForm = createProductionChangeForm()
Object.assign(uiMaterialForm, {
  recordId: 'BG-UI-MATERIAL-001',
  productionOrderId: uiQuantitySnapshot.productionOrderId,
  changeType: 'MATERIAL_REPLACEMENT',
  materialReplacement: {
    ...uiMaterialForm.materialReplacement,
    originalMaterialId: uiQuantitySnapshot.materialId,
    replacementMaterialId: uiMaterialArchive.materialId,
    replacementMode: 'FULL',
    confirmedProductionQty: 125,
  },
})
const uiMaterialChangedSnapshots = buildPostChangeProcessWorkOrderSnapshotsForForm(uiMaterialForm, {
  ...executionPreview,
  affectedOrderIds: [uiQuantitySnapshot.productionOrderId],
})
assert.deepEqual(
  [uiMaterialChangedSnapshots[0]?.materialId, uiMaterialChangedSnapshots[0]?.materialName],
  [uiMaterialArchive.materialId, uiMaterialArchive.materialName],
  'events 物料变更快照必须使用已确认的真实物料档案 ID 和名称',
)
const uiMaterialIdentityBefore = getDyeWorkOrderById(uiQuantityOrder.dyeWorkOrderId!)!
const uiMaterialExecution = executeProductionChange(executionPreview, {
  processWorkOrderSnapshots: uiMaterialChangedSnapshots,
  changeRecordId: uiMaterialForm.recordId,
  processWorkOrderSyncRecordedAt: '2026-07-16 12:11:00',
  persist: (result) => result,
})
assert.equal(uiMaterialExecution.status, 'DONE', 'events 同款 options 必须可提交物料变更加工快照')
assert.deepEqual(
  [getDyeWorkOrderById(uiQuantityOrder.dyeWorkOrderId!)?.dyeOrderId, getDyeWorkOrderById(uiQuantityOrder.dyeWorkOrderId!)?.dyeOrderNo],
  [uiMaterialIdentityBefore.dyeOrderId, uiMaterialIdentityBefore.dyeOrderNo],
  '物料变更同步后加工单 ID 和单号必须保持不变',
)
assert.deepEqual(
  [getDyeWorkOrderById(uiQuantityOrder.dyeWorkOrderId!)?.materialId, getDyeWorkOrderById(uiQuantityOrder.dyeWorkOrderId!)?.composition],
  [uiMaterialArchive.materialId, uiMaterialArchive.materialName],
  '物料变更必须真实更新加工单物料事实',
)

const initializedQuantityForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
assert.equal(initializedQuantityForm.productionOrderId, quantityFactoryOrderId, '初始化必须保留所选生产单')
assert.deepEqual(
  initializedQuantityForm.quantityLines,
  createQuantityLinesForOrder(quantityFactoryOrderId),
  '选择生产单后必须按当前事实初始化数量明细',
)
assert.deepEqual(initializedQuantityForm.decisionValues, {}, '初始化必须清空第三步判断')
assert.equal(initializedQuantityForm.execution.status, 'IDLE', '初始化必须清空第四步执行状态')

const fieldHelperQuantityForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
const fieldHelperQuantityLine = fieldHelperQuantityForm.quantityLines[0]
assert.ok(fieldHelperQuantityLine, '字段 helper 检查需要数量明细')
applyProductionChangeFieldValue(
  fieldHelperQuantityForm,
  'productionChangeQuantityTargetQty',
  String(fieldHelperQuantityLine.targetQty - 10),
  { lineId: fieldHelperQuantityLine.id },
)
assert.equal(fieldHelperQuantityLine.targetQty, fieldHelperQuantityLine.currentQty - 10, '数量 target helper 必须更新表单 state')
applyProductionChangeFieldValue(fieldHelperQuantityForm, 'productionChangeReason', '数量变更原因')
assert.equal(fieldHelperQuantityForm.reason, '数量变更原因', '原因 helper 必须更新表单 state')

assert.deepEqual(
  transitionProductionChangeStep('order', 'content', createProductionChangeForm()),
  { step: 'order', error: '请选择有效生产单。' },
  'order 未选生产单时步骤 helper 必须阻断',
)
const invalidContentTransition = transitionProductionChangeStep('content', 'handling', fieldHelperQuantityForm)
assert.equal(invalidContentTransition.step, 'handling', '合法 content 必须允许进入 handling')
const unchangedContentForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
const blockedContentTransition = transitionProductionChangeStep('content', 'handling', unchangedContentForm)
assert.equal(blockedContentTransition.step, 'content', '内容未变化时 content 必须阻断进入 handling')
assert.ok(blockedContentTransition.error.includes('数量内容未发生变化'))
const incompleteHandlingForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'MATERIAL_REPLACEMENT')
const helperReplacementOption = listReplacementMaterialOptions()[0]
assert.ok(helperReplacementOption, '字段 helper 检查需要替换面料候选')
incompleteHandlingForm.materialReplacement.replacementMaterialId = helperReplacementOption.value
incompleteHandlingForm.materialReplacement.replacementMode = 'FULL'
incompleteHandlingForm.materialReplacement.allocations.forEach((line) => {
  line.confirmedReplacementQty = line.demandQty
})
incompleteHandlingForm.materialReplacement.confirmedProductionQty = incompleteHandlingForm.materialReplacement.allocations.reduce(
  (sum, line) => sum + line.confirmedReplacementQty,
  0,
)
incompleteHandlingForm.reason = '全部数量替换。'
const blockedHandlingTransition = transitionProductionChangeStep('handling', 'execution', incompleteHandlingForm)
assert.equal(blockedHandlingTransition.step, 'handling', '判断未完成时 handling 必须阻断进入 execution')
assert.match(blockedHandlingTransition.error, /^请先完成 \d+ 项待跟单判断。$/)

const eventSuccessForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
const eventSuccessLine = eventSuccessForm.quantityLines[0]
assert.ok(eventSuccessLine, '事件执行检查需要数量明细')
const eventSuccessFactBefore = changeDomain.getProductionOrderChangeCurrentFacts(quantityFactoryOrderId)
eventSuccessLine.targetQty -= 1
eventSuccessForm.reason = '同步执行成功检查'
const eventSuccessResult = executeProductionChangeForForm(eventSuccessForm)
assert.equal(eventSuccessResult.executed, true, '正式执行必须在同一 helper 内完成并写回')
assert.equal(eventSuccessResult.step, 'execution', '正式执行成功后必须停留在第四步')
assert.equal(eventSuccessForm.execution.status, 'DONE', '正式执行必须写回 DONE')
assert.equal(eventSuccessForm.execution.message, '全部处理成功并已统一生效。', '正式执行必须写回成功提示')
assert.equal(executeProductionChangeForForm(eventSuccessForm).executed, false, 'DONE 必须阻止重复执行')
assert.equal(
  changeDomain.getProductionOrderChangeCurrentFacts(quantityFactoryOrderId)?.demandQuantityFacts[0]?.currentDemandQty,
  (eventSuccessFactBefore?.demandQuantityFacts[0]?.currentDemandQty ?? 0) - 1,
  '成功执行后下一次读取必须得到已更新的需求明细事实',
)
const doneReason = eventSuccessForm.reason
applyProductionChangeFieldValue(eventSuccessForm, 'productionChangeReason', '试图覆写完成记录')
assert.equal(eventSuccessForm.reason, doneReason, 'DONE 表单字段必须保持只读')

const factsBeforeNestedIndependentChanges = changeDomain.listProductionOrderChangeCurrentFacts()
const recordsBeforeNestedIndependentChanges = listProductionChangeRecords()
const outerIndependentForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
outerIndependentForm.quantityLines[0].targetQty -= 1
outerIndependentForm.reason = '外层独立生产单变更'
const innerIndependentForm = createInitializedProductionChangeForm('PO-202604-0018', 'QUANTITY_CHANGE')
innerIndependentForm.quantityLines[0].targetQty -= 1
innerIndependentForm.reason = '内层不冲突生产单变更'
let innerIndependentResult: ReturnType<typeof executeProductionChangeForForm> | null = null
const outerIndependentResult = executeProductionChangeForForm(outerIndependentForm, {
  execute: (preview, executionOptions) => {
    innerIndependentResult = executeProductionChangeForForm(innerIndependentForm, { executedAt: '2026-07-12 09:10' })
    return executeProductionChange(preview, executionOptions)
  },
  executedAt: '2026-07-12 09:11',
})
assert.equal(innerIndependentResult?.executed, true, '不冲突内层生产单变更必须执行成功')
assert.equal(outerIndependentResult.executed, true, '外层生产单变更必须执行成功')
assert.equal(getProductionChangeRecord(innerIndependentForm.recordId)?.status, 'DONE', '外层提交不得抹掉内层最终记录')
assert.equal(
  changeDomain.getProductionOrderChangeCurrentFacts('PO-202604-0018')?.demandQuantityFacts[0]?.currentDemandQty,
  innerIndependentForm.quantityLines[0].targetQty,
  '外层回滚快照不得抹掉不冲突生产单的新事实',
)
changeDomain.replaceProductionOrderChangeCurrentFacts(factsBeforeNestedIndependentChanges)
replaceProductionChangeRecordsForTesting(recordsBeforeNestedIndependentChanges)

const lockConflictForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
lockConflictForm.quantityLines[0].targetQty -= 1
lockConflictForm.reason = '锁冲突不得消耗变更单号'
const lockConflictPreview = buildProductionChangePreview({
  productionOrderId: lockConflictForm.productionOrderId,
  changeType: lockConflictForm.changeType,
  reason: lockConflictForm.reason,
  quantityLines: lockConflictForm.quantityLines,
  materialReplacement: null,
  decisionValues: lockConflictForm.decisionValues,
  affectedDocumentNos: listAffectedDocumentNosForOrder(lockConflictForm.productionOrderId),
})
let lockConflictEventResult: ReturnType<typeof executeProductionChangeForForm> | null = null
executeProductionChange(lockConflictPreview, {
  onStep: () => {
    if (lockConflictEventResult) return
    lockConflictEventResult = executeProductionChangeForForm(lockConflictForm)
  },
})
assert.equal(lockConflictEventResult?.executed, false, '锁冲突必须在事件入口直接阻断')
assert.equal(lockConflictEventResult?.error, getProductionChangeLockMessage(), '锁冲突必须使用统一提示')
assert.equal(lockConflictForm.recordId, '', '锁冲突不得预留或消耗生产单变更记录 ID')

const staleFormExecution = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
const staleFormLine = staleFormExecution.quantityLines[0]
assert.ok(staleFormLine, '陈旧表单执行探针需要需求明细')
staleFormLine.targetQty += 1
staleFormExecution.reason = '陈旧表单不得覆盖新事实'
const factsBeforeStaleFormProbe = changeDomain.listProductionOrderChangeCurrentFacts()
changeDomain.applyProductionOrderQuantityFactChange(
  quantityFactoryOrderId,
  [{ ...staleFormLine, targetQty: staleFormLine.currentQty - 2 }],
  'BG-STALE-FORM-PROBE',
  '2026-07-11 08:45',
)
const currentQtyAfterExternalChange = changeDomain.getProductionOrderChangeCurrentFacts(
  quantityFactoryOrderId,
)?.demandQuantityFacts[0]?.currentDemandQty
const staleFormResult = executeProductionChangeForForm(staleFormExecution)
assert.equal(staleFormResult.step, 'content', '陈旧表单必须退回第二步重新填写变更内容')
assert.equal(staleFormExecution.execution.status, 'IDLE', '陈旧表单刷新事实后不得保留可直接重试的执行状态')
assert.equal(
  staleFormExecution.quantityLines[0]?.currentQty,
  currentQtyAfterExternalChange,
  '陈旧表单必须重新读取最新需求事实',
)
assert.equal(
  executeProductionChangeForForm(staleFormExecution).step,
  'content',
  '刷新事实后未重新填写变更内容不得直接执行',
)
assert.equal(
  changeDomain.getProductionOrderChangeCurrentFacts(quantityFactoryOrderId)?.demandQuantityFacts[0]?.currentDemandQty,
  currentQtyAfterExternalChange,
  '陈旧表单回滚不得覆盖外部已经形成的新事实',
)
changeDomain.replaceProductionOrderChangeCurrentFacts(factsBeforeStaleFormProbe)

const emptyExecutionResult = executeProductionChangeForForm(createProductionChangeForm())
assert.equal(emptyExecutionResult.executed, false, '空表单不得直接生成成功记录')
assert.equal(emptyExecutionResult.step, 'order', '空表单必须在第一步被阻断')

for (const invalidQty of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, -1, Number.MAX_VALUE]) {
  const invalidForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
  invalidForm.quantityLines[0].targetQty = invalidQty
  invalidForm.reason = '非法数量执行探针'
  const invalidResult = executeProductionChangeForForm(invalidForm)
  assert.equal(invalidResult.executed, false, `非法数量 ${String(invalidQty)} 不得执行`)
  assert.equal(invalidResult.step, 'content', '非法数量必须在变更内容步骤阻断')
}

const duplicateQuantityForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
duplicateQuantityForm.quantityLines[0].targetQty -= 1
duplicateQuantityForm.quantityLines.push({
  ...structuredClone(duplicateQuantityForm.quantityLines[0]),
  id: 'QTY-DUPLICATE-PROBE',
  targetQty: 1,
  isNew: true,
})
duplicateQuantityForm.reason = '重复需求明细探针'
assert.ok(
  executeProductionChangeForForm(duplicateQuantityForm).error.includes('组合不能重复'),
  '重复商品编码、颜色、尺码组合必须在执行入口阻断',
)

const duplicateQuantityIdForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
duplicateQuantityIdForm.quantityLines[0].targetQty -= 1
duplicateQuantityIdForm.quantityLines.push({
  id: duplicateQuantityIdForm.quantityLines[0].id,
  skuCode: 'SKU-MALICIOUS-NEW',
  color: '绿色',
  size: 'XXL',
  originalQty: 0,
  currentQty: 0,
  targetQty: 10,
  unit: '件',
  isNew: true,
  coveredByCurrentVersion: false,
})
duplicateQuantityIdForm.reason = '新增需求明细 ID 冲突探针'
assert.match(
  executeProductionChangeForForm(duplicateQuantityIdForm).error,
  /需求明细标识不能重复|新增需求明细与已有事实冲突/,
  '新增需求明细不得复用已有事实 ID',
)
const factsBeforeDuplicateNewIdProbe = changeDomain.listProductionOrderChangeCurrentFacts()
assert.throws(
  () => changeDomain.applyProductionOrderQuantityFactChange(
    quantityFactoryOrderId,
    [
      {
        id: 'QTY-SAME-NEW',
        skuCode: 'SKU-NEW-A',
        color: '绿色',
        size: 'S',
        originalQty: 0,
        currentQty: 0,
        targetQty: 10,
        isNew: true,
      },
      {
        id: 'QTY-SAME-NEW',
        skuCode: 'SKU-NEW-B',
        color: '绿色',
        size: 'M',
        originalQty: 0,
        currentQty: 0,
        targetQty: 20,
        isNew: true,
      },
    ],
    'BG-DUPLICATE-NEW-ID-PROBE',
    '2026-07-12 09:30',
  ),
  /需求明细标识不能重复/,
  '领域写入层必须拒绝同一批新增明细复用相同 ID',
)
assert.throws(
  () => changeDomain.applyProductionOrderQuantityFactChange(
    quantityFactoryOrderId,
    [
      {
        id: ' DQF-PO-202603-0004-BLK-M ',
        skuCode: 'SKU-WHITESPACE-COLLISION',
        color: '绿色',
        size: 'XXL',
        originalQty: 0,
        currentQty: 0,
        targetQty: 10,
        isNew: true,
      },
    ],
    'BG-WHITESPACE-ID-PROBE',
    '2026-07-12 09:31',
  ),
  /与已有事实冲突/,
  '领域写入层必须先标准化 ID，再拒绝空格变体复用已有事实 ID',
)
changeDomain.replaceProductionOrderChangeCurrentFacts(factsBeforeDuplicateNewIdProbe)

const invalidMaterialForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'MATERIAL_REPLACEMENT')
invalidMaterialForm.materialReplacement.replacementMaterialId = 'FAB-NOT-IN-SYSTEM'
invalidMaterialForm.reason = '非法面料探针'
assert.ok(
  executeProductionChangeForForm(invalidMaterialForm).error.includes('系统中的新面料'),
  '不在系统物料档案中的新面料必须被执行入口阻断',
)

const invalidTimeForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
invalidTimeForm.quantityLines[0].targetQty -= 1
invalidTimeForm.reason = '无效时间探针'
assert.equal(
  executeProductionChangeForForm(invalidTimeForm, { executedAt: '2026-02-30 09:00' }).executed,
  false,
  '不存在的日历时间不得落入最终记录',
)
assert.equal(invalidTimeForm.recordId, '', '时间校验失败前不得分配变更单号')

const eventFailureForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
const eventFailureLine = eventFailureForm.quantityLines[0]
assert.ok(eventFailureLine, '事件失败检查需要数量明细')
eventFailureLine.targetQty -= 1
eventFailureForm.reason = '同步执行失败检查'
const recordCountBeforeFailure = listProductionChangeRecords().length
const eventFailureResult = executeProductionChangeForForm(eventFailureForm, {
  shouldFail: true,
  executedAt: '2026-07-11 09:00',
})
assert.equal(eventFailureResult.executed, true, '失败演示必须在同一 helper 内完成并写回')
assert.equal(eventFailureForm.execution.status, 'ROLLED_BACK', '失败演示必须写回 ROLLED_BACK')
assert.ok(eventFailureForm.recordId, '首次执行必须向表单写入最终记录 ID')
const rolledBackRecordId = eventFailureForm.recordId
assert.equal(listProductionChangeRecords().length, recordCountBeforeFailure + 1, '第一次回滚必须新增一张最终记录')
const rolledBackRecord = getProductionChangeRecord(rolledBackRecordId)
assert.equal(rolledBackRecord?.status, 'ROLLED_BACK', '首次执行记录必须保存回滚状态')
assert.equal(rolledBackRecord?.createdAt, '2026-07-11 09:00', '首次回滚时间必须作为变更单创建时间')
assert.equal(rolledBackRecord?.lastExecutedAt, '2026-07-11 09:00', '回滚尝试必须保存本次失败执行时间')
assert.ok(
  rolledBackRecord?.documentTraces.every((trace) => trace.executedAt === '2026-07-11 09:00'),
  '回滚留痕必须使用本次失败执行时间',
)
assert.equal(
  executeProductionChangeForForm(eventFailureForm, { executedAt: '2026-07-11 10:30' }).executed,
  true,
  'ROLLED_BACK 必须允许同步重试',
)
assert.equal(eventFailureForm.execution.status, 'DONE', '回滚后同步重试成功必须写回 DONE')
assert.equal(eventFailureForm.recordId, rolledBackRecordId, '回滚重试必须复用同一记录 ID')
assert.equal(listProductionChangeRecords().length, recordCountBeforeFailure + 1, '回滚重试成功不得新增第二张记录')
const retriedRecord = getProductionChangeRecord(rolledBackRecordId)
assert.equal(retriedRecord?.status, 'DONE', '重试成功必须覆盖同一记录为 DONE')
assert.equal(retriedRecord?.createdAt, '2026-07-11 09:00', '重试覆盖不得修改首次创建时间')
assert.equal(retriedRecord?.lastExecutedAt, '2026-07-11 10:30', '重试成功必须更新本次执行时间')
assert.ok(
  retriedRecord?.documentTraces.every((trace) => trace.executedAt === '2026-07-11 10:30'),
  '最终成功留痕必须使用本次成功执行时间',
)

const eventThrownForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
const eventThrownLine = eventThrownForm.quantityLines[0]
assert.ok(eventThrownLine, '事件异常检查需要数量明细')
eventThrownLine.targetQty -= 1
eventThrownForm.reason = '事件异常回滚检查'
const eventThrownResult = executeProductionChangeForForm(eventThrownForm, {
  execute: () => {
    throw new Error('测试执行函数意外抛出')
  },
})
assert.equal(eventThrownResult.executed, true, '事件层捕获执行异常后仍应完成本次写回')
assert.equal(eventThrownForm.execution.status, 'ROLLED_BACK', '事件层必须把意外异常兜底为 ROLLED_BACK')
assert.equal(eventThrownForm.execution.progress, 100, '事件异常兜底必须写回 100%')
assert.equal(eventThrownForm.execution.message, '执行失败，本次没有修改任何单据。')
assert.ok(eventThrownForm.execution.steps.every((step) => step.status === 'ROLLED_BACK'), '事件异常步骤必须全部回滚')
assert.equal(eventThrownForm.execution.steps.at(-1)?.label, '全部回滚', '事件异常最后一步必须全部回滚')
assert.equal(executeProductionChangeForForm(eventThrownForm).executed, true, '事件异常回滚后必须允许重试')
assert.equal(eventThrownForm.execution.status, 'DONE', '事件异常回滚后重试必须可成功')

const eventIncompleteResult = executeProductionChangeForForm(incompleteHandlingForm)
assert.equal(eventIncompleteResult.executed, false, '判断不完整时不得执行')
assert.equal(eventIncompleteResult.step, 'handling', '判断不完整时必须退回 handling')
assert.match(eventIncompleteResult.error, /^请先完成 \d+ 项待跟单判断。$/)
assert.equal(createProductionChangeForm().recordId, '', '新表单必须清空上一次最终记录 ID')
assert.equal(
  createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE').recordId,
  '',
  '重新选择生产单或场景必须使用新的业务变更身份',
)
resetProductionChangeRecordsForTesting()
changeDomain.resetProductionOrderChangeCurrentFactsForTesting()

const initializedMaterialForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'MATERIAL_REPLACEMENT')
const initialMaterialSuggestion = initializedMaterialForm.materialReplacement.allocations.reduce(
  (sum, line) => sum + line.suggestedReplacementQty,
  0,
)
assert.equal(
  initializedMaterialForm.materialReplacement.originalMaterialId,
  listCurrentMaterialOptionsForOrder(quantityFactoryOrderId)[0]?.value,
  '物料表单必须默认当前生产单第一条有效面料事实',
)
assert.equal(
  initializedMaterialForm.materialReplacement.suggestedProductionQty,
  initialMaterialSuggestion,
  '剩余数量替换建议必须等于各行建议替换数量合计',
)
assert.equal(
  initializedMaterialForm.materialReplacement.confirmedProductionQty,
  initialMaterialSuggestion,
  '物料表单初始确认数量必须等于系统建议',
)
assert.equal(
  initializedMaterialForm.materialReplacement.allocations.reduce(
    (sum, line) => sum + line.confirmedReplacementQty,
    0,
  ),
  initialMaterialSuggestion,
  '物料表单初始分配必须与确认数量守恒',
)
assert.deepEqual(
  initializedMaterialForm.materialReplacement.followingOrders,
  createFollowingOrderPlans(quantityFactoryOrderId),
  '物料表单必须按当前事实初始化后续生产单',
)

const partialFullReplacementForm = structuredClone(initializedMaterialForm)
partialFullReplacementForm.materialReplacement.replacementMaterialId = helperReplacementOption.value
partialFullReplacementForm.materialReplacement.replacementMode = 'FULL'
partialFullReplacementForm.reason = '全部数量替换不能只填部分数量'
assert.match(
  validateProductionChangeFormStep('content', partialFullReplacementForm),
  /全部数量替换必须覆盖当前需求总数/,
  '全部数量替换必须严格等于需求总数',
)

const excessiveRemainingForm = structuredClone(initializedMaterialForm)
excessiveRemainingForm.materialReplacement.replacementMaterialId = helperReplacementOption.value
excessiveRemainingForm.reason = '剩余数量替换不能覆盖已完成事实'
const excessiveRemainingLine = excessiveRemainingForm.materialReplacement.allocations[0]
assert.ok(excessiveRemainingLine, '剩余数量边界测试需要颜色尺码分配')
excessiveRemainingLine.confirmedReplacementQty = excessiveRemainingLine.suggestedReplacementQty + 1
excessiveRemainingForm.materialReplacement.confirmedProductionQty = excessiveRemainingForm.materialReplacement.allocations.reduce(
  (sum, line) => sum + line.confirmedReplacementQty,
  0,
)
assert.match(
  validateProductionChangeFormStep('content', excessiveRemainingForm),
  /不能超过对应颜色尺码的剩余待生产数量|不能超过剩余待生产总数/,
  '剩余数量替换不得再次覆盖已完成生产数量',
)

const followingFullDispositionForm = structuredClone(initializedMaterialForm)
followingFullDispositionForm.materialReplacement.replacementMaterialId = helperReplacementOption.value
followingFullDispositionForm.materialReplacement.scope = 'CURRENT_AND_FOLLOWING'
followingFullDispositionForm.reason = '后续已开工生产单全部替换'
followingFullDispositionForm.decisionValues['following-order-mode-PO-202603-0101'] = {
  value: 'FULL',
  reason: '',
}
const followingFullDispositionPreview = buildProductionChangePreview({
  productionOrderId: followingFullDispositionForm.productionOrderId,
  changeType: 'MATERIAL_REPLACEMENT',
  reason: followingFullDispositionForm.reason,
  quantityLines: followingFullDispositionForm.quantityLines,
  materialReplacement: followingFullDispositionForm.materialReplacement,
  decisionValues: followingFullDispositionForm.decisionValues,
  affectedDocumentNos: listAffectedDocumentNosForOrder(followingFullDispositionForm.productionOrderId),
})
assert.ok(
  followingFullDispositionPreview.decisionItems.some(
    (item) => item.id === 'following-old-material-disposition-PO-202603-0101',
  ),
  '已开工后续生产单选择全部替换时必须单独确认旧料和在制品去向',
)
const multiOrderSnapshotRecord = buildProductionChangeRecord(
  'BG-MULTI-ORDER-SNAPSHOT',
  {
    productionOrderId: followingFullDispositionForm.productionOrderId,
    changeType: 'MATERIAL_REPLACEMENT',
    reason: followingFullDispositionForm.reason,
    quantityLines: followingFullDispositionForm.quantityLines,
    materialReplacement: followingFullDispositionForm.materialReplacement,
    decisionValues: followingFullDispositionForm.decisionValues,
    affectedDocumentNos: listAffectedDocumentNosForOrder(followingFullDispositionForm.productionOrderId),
  },
  'DONE',
  '2026-07-12 09:00',
)
assert.deepEqual(
  multiOrderSnapshotRecord.affectedOrderFactsSnapshots.map((facts) => facts.productionOrderId).sort(),
  ['PO-202603-0004', 'PO-202603-0101', 'PO-202603-0102'].sort(),
  '当前及后续范围的最终记录必须保存全部受影响生产单事实快照',
)
const followingCutTrace = multiOrderSnapshotRecord.documentTraces.find(
  (trace) => trace.documentNo === 'CUT-260306-101-01',
)
assert.ok(followingCutTrace?.beforeText.includes('计划 1,000 件'), '后续裁剪单留痕必须保存自身计划数量')
assert.ok(
  followingCutTrace?.afterText.includes(followingFullDispositionForm.materialReplacement.replacementMaterialId),
  '后续裁剪单留痕必须明确记录执行后的新面料',
)
const convertedUnitLines = createQuantityLinesForOrder('PO-202603-0101')
convertedUnitLines[0].targetQty = 900
const convertedUnitRecord = buildProductionChangeRecord(
  'BG-CONVERTED-UNIT-TRACE',
  {
    productionOrderId: 'PO-202603-0101',
    changeType: 'QUANTITY_CHANGE',
    reason: '验证领料单单位换算后的新计划',
    quantityLines: convertedUnitLines,
    materialReplacement: null,
    decisionValues: {},
    affectedDocumentNos: ['WLS-PL-260306-101'],
  },
  'DONE',
  '2026-07-12 09:05',
)
assert.ok(
  convertedUnitRecord.documentTraces.find((trace) => trace.documentNo === 'WLS-PL-260306-101')?.afterText.includes('新计划 1134 米'),
  '非件数单据必须按需求明细到单据单位的换算关系记录自身新计划',
)

const followingFactProbeForm = structuredClone(initializedMaterialForm)
followingFactProbeForm.materialReplacement.replacementMaterialId = helperReplacementOption.value
followingFactProbeForm.materialReplacement.scope = 'CURRENT_AND_FOLLOWING'
const followingFactPreview = buildProductionChangePreview({
  productionOrderId: followingFactProbeForm.productionOrderId,
  changeType: 'MATERIAL_REPLACEMENT',
  reason: '后续生产单事实变化探针',
  quantityLines: followingFactProbeForm.quantityLines,
  materialReplacement: followingFactProbeForm.materialReplacement,
  decisionValues: followingFactProbeForm.decisionValues,
  affectedDocumentNos: listAffectedDocumentNosForOrder(followingFactProbeForm.productionOrderId),
})
const followingFactOrderId = followingFactPreview.affectedOrderIds.find((id) => id !== quantityFactoryOrderId)
assert.ok(followingFactOrderId, '跨生产单替换必须包含至少一张后续生产单')
const followingFactProbeFacts = changeDomain.listProductionOrderChangeCurrentFacts()
changeDomain.replaceProductionOrderChangeCurrentFacts([
  ...followingFactProbeFacts.map((facts) => {
    if (facts.productionOrderId !== followingFactOrderId) return facts
    const copiedFacts = structuredClone(facts)
    if (copiedFacts.demandQuantityFacts[0]) copiedFacts.demandQuantityFacts[0].currentDemandQty += 1
    return copiedFacts
  }),
])
const followingFactExecution = executeProductionChange(followingFactPreview)
assert.equal(followingFactExecution.status, 'ROLLED_BACK', '后续生产单事实变化也必须整单回滚')
assert.equal(followingFactExecution.message, '当前事实已变化，请重新确认处理方案')
changeDomain.resetProductionOrderChangeCurrentFactsForTesting()

const helperMaterialForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'MATERIAL_REPLACEMENT')
helperMaterialForm.materialReplacement.replacementMaterialId = helperReplacementOption.value
helperMaterialForm.reason = '测试字段 helper。'
const confirmedQtyResult = applyProductionChangeFieldValue(
  helperMaterialForm,
  'productionChangeConfirmedProductionQty',
  '120.4',
)
assert.equal(helperMaterialForm.materialReplacement.confirmedProductionQty, 120, '确认件数 helper 必须把归一结果写回 state')
assert.equal(
  helperMaterialForm.materialReplacement.allocations.reduce((sum, line) => sum + line.confirmedReplacementQty, 0),
  120,
  '确认件数 helper 必须把同一份归一分配写回 state',
)
assert.equal(confirmedQtyResult.normalizedValue, '120', '确认件数 helper 必须返回 DOM 使用的归一值')
assert.equal(confirmedQtyResult.syncAllocationInputs, true, '确认件数 helper 必须要求 DOM 同步归一分配')
const helperAllocation = helperMaterialForm.materialReplacement.allocations[0]
assert.ok(helperAllocation, '字段 helper 检查需要分配明细')
const preservedOtherAllocationValues = helperMaterialForm.materialReplacement.allocations.slice(1).map((line) => line.confirmedReplacementQty)
applyProductionChangeFieldValue(
  helperMaterialForm,
  'productionChangeAllocationQty',
  String(helperAllocation.confirmedReplacementQty - 1),
  { allocationId: helperAllocation.id },
)
assert.equal(
  helperMaterialForm.materialReplacement.allocations.reduce((sum, line) => sum + line.confirmedReplacementQty, 0),
  119,
  '手工分配 helper 必须保留临时不守恒输入，交给 validator 阻断',
)
assert.deepEqual(
  helperMaterialForm.materialReplacement.allocations.slice(1).map((line) => line.confirmedReplacementQty),
  preservedOtherAllocationValues,
  '手工分配不得重新分配其他合法自定义值',
)
assert.ok(
  validateProductionChangeFormStep('content', helperMaterialForm).includes('分配合计必须等于确认生产件数'),
  '手工分配不守恒后 validator 必须阻断',
)
const helperDecisionOrder = helperMaterialForm.materialReplacement.followingOrders.find((order) => order.started)
assert.ok(helperDecisionOrder, 'decision helper 检查需要已开工后续生产单')
helperMaterialForm.materialReplacement.scope = 'CURRENT_AND_FOLLOWING'
const helperDecisionId = `following-order-mode-${helperDecisionOrder.productionOrderId}`
const helperDeviatedDecisionValue = helperDecisionOrder.suggestedMode === 'FULL' ? 'REMAINING' : 'FULL'
applyProductionChangeFieldValue(helperMaterialForm, 'productionChangeDecisionValue', helperDeviatedDecisionValue, { decisionId: helperDecisionId })
applyProductionChangeFieldValue(helperMaterialForm, 'productionChangeDecisionReason', '偏离建议原因', { decisionId: helperDecisionId })
assert.deepEqual(
  helperMaterialForm.decisionValues[helperDecisionId],
  { value: helperDeviatedDecisionValue, reason: '偏离建议原因' },
  'decision value/reason helper 必须写回 state',
)
applyProductionChangeFieldValue(
  helperMaterialForm,
  'productionChangeDecisionValue',
  helperDecisionOrder.suggestedMode,
  { decisionId: helperDecisionId },
)
assert.equal(helperMaterialForm.decisionValues[helperDecisionId]?.reason, '', '切回系统建议时必须清空隐藏判断原因')

assert.ok(
  validateProductionChangeFormStep('content', initializedQuantityForm).includes('数量内容未发生变化'),
  '数量内容未发生变化时必须阻断进入第三步',
)
const validQuantityTransitionForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
validQuantityTransitionForm.quantityLines[0].targetQty -= 10
validQuantityTransitionForm.reason = '跟单确认需求减少 10 件。'
assert.equal(
  validateProductionChangeFormStep('content', validQuantityTransitionForm),
  '',
  '数量、原因和明细合法时必须允许进入第三步',
)
const incompleteNewLineForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
incompleteNewLineForm.reason = '新增需求明细。'
incompleteNewLineForm.quantityLines.push({
  id: 'TEST-NEW-LINE',
  skuCode: '',
  color: '',
  size: '',
  originalQty: 0,
  currentQty: 0,
  targetQty: 10,
  unit: '件',
  isNew: true,
  coveredByCurrentVersion: false,
})
assert.ok(
  validateProductionChangeFormStep('content', incompleteNewLineForm).includes('商品编码、颜色和尺码'),
  '新增数量大于 0 时商品编码、颜色和尺码不完整必须阻断',
)

const replacementOption = listReplacementMaterialOptions()[0]
assert.ok(replacementOption, '事件校验需要至少一个新面料候选')
const sameMaterialForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'MATERIAL_REPLACEMENT')
sameMaterialForm.materialReplacement.replacementMaterialId = sameMaterialForm.materialReplacement.originalMaterialId
sameMaterialForm.reason = '测试同物料阻断。'
assert.ok(
  validateProductionChangeFormStep('content', sameMaterialForm).includes('新面料不能与原面料相同'),
  '新面料与原面料相同时必须阻断进入第三步',
)
const unbalancedMaterialForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'MATERIAL_REPLACEMENT')
unbalancedMaterialForm.materialReplacement.replacementMaterialId = replacementOption.value
unbalancedMaterialForm.reason = '测试分配守恒。'
unbalancedMaterialForm.materialReplacement.allocations[0].confirmedReplacementQty -= 1
assert.ok(
  validateProductionChangeFormStep('content', unbalancedMaterialForm).includes('分配合计必须等于确认生产件数'),
  '分配不守恒时必须阻断进入第三步',
)
const incompleteDecisionForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'MATERIAL_REPLACEMENT')
incompleteDecisionForm.materialReplacement.replacementMaterialId = replacementOption.value
incompleteDecisionForm.materialReplacement.replacementMode = 'FULL'
incompleteDecisionForm.reason = '全部数量替换并确认旧料去向。'
assert.ok(
  /^请先完成 \d+ 项待跟单判断。$/.test(
    validateProductionChangeFormStep('handling', incompleteDecisionForm),
  ),
  '待跟单判断未完成时必须阻断进入第四步',
)

state.productionChangeListTab = 'change-orders'
state.techPackChangeKeyword = ''
state.productionChangeOrderPage = 1

const relation = listProductionOrderTechPackRelations()[0]
assert.ok(relation, '至少需要一张可发起变更的生产单样本')

const listHtml = renderProductionChangesPage()

;[
  '生产单变更管理',
  '新增变更',
  '变更单列表',
  '待处理生产单',
  '搜索变更单号 / 生产单号 / 变更场景 / 处理状态 / 变更原因',
  '变更单号',
  '生产单号',
].forEach((text) => {
  assert.ok(listHtml.includes(text), `列表页缺少「${text}」`)
})

assert.ok(listHtml.includes('修改生产单需求数量'), '首页必须有修改生产单需求数量入口')
assert.ok(listHtml.includes('替换物料'), '首页必须有替换物料入口')
assertHomeDoesNotIncludeLegacyEntries(listHtml, '默认首页')
assert.ok(!listHtml.includes('已分发委托'), '首页不应出现抽象文案：已分发委托')
assert.ok(!listHtml.includes('执行对象'), '首页不应出现抽象文案：执行对象')
assert.ok(!listHtml.includes('来源记录'), '首页不应出现抽象文案：来源记录')
assert.ok(!listHtml.includes('状态流转'), '首页不应出现抽象文案：状态流转')
assert.ok(!listHtml.includes('写回'), '首页不应出现抽象文案：写回')
assert.ok(!listHtml.includes('投影'), '首页不应出现抽象文案：投影')
;['主管', '审核', '负责人', '撤回'].forEach((text) => {
  assert.ok(!listHtml.includes(text), `生产单变更列表和场景卡不得出现旧口径「${text}」`)
})

state.productionChangeListTab = 'candidate-orders'
const candidateListHtml = renderProductionChangesPage()
assert.ok(candidateListHtml.includes('待处理生产单'), '待处理生产单页签必须保留业务入口')
assert.ok(candidateListHtml.includes('修改生产单需求数量'), '待处理生产单页签必须提供修改生产单需求数量入口')
assert.ok(candidateListHtml.includes('替换物料'), '待处理生产单页签必须提供替换物料入口')
assert.ok(
  candidateListHtml.includes(`data-change-type="QUANTITY_CHANGE" data-order-id="${relation.productionOrderId}"`),
  '待处理生产单的修改数量入口必须带入生产单号',
)
assert.ok(
  candidateListHtml.includes(`data-change-type="MATERIAL_REPLACEMENT" data-order-id="${relation.productionOrderId}"`),
  '待处理生产单的替换物料入口必须带入生产单号',
)
assertHomeDoesNotIncludeLegacyEntries(candidateListHtml, '待处理生产单页签')
state.productionChangeListTab = 'change-orders'

const newHtml = renderProductionChangeNewPage()
const removedCopy = [
  '待主管确认',
  '主管确认',
  '主管确认需要处理的事',
  '相关负责人',
  '通知相关负责人处理',
  '相关单据留痕',
  '预览并提交',
  '适用颜色',
  '适用尺码',
  '从哪里开始用新物料',
  '提交审核',
]
;['选择生产单', '填写变更内容', '确认处理方案', '同步执行'].forEach((text) => {
  assert.ok(newHtml.includes(text), `新增页缺少统一四步文案「${text}」`)
})
const stepsHtml = renderProductionChangeFormSteps('order')
const stepTitles = ['选择生产单', '填写变更内容', '确认处理方案', '同步执行']
let previousStepTitleIndex = -1
stepTitles.forEach((title) => {
  const titleIndex = stepsHtml.indexOf(title)
  assert.ok(titleIndex > previousStepTitleIndex, `统一四步必须按顺序展示「${title}」`)
  previousStepTitleIndex = titleIndex
})
assert.ok(newHtml.includes('跟单'), '新增页角色必须包含跟单')
assert.ok(!newHtml.includes('系统反推，不要求业务人员先选版本关系或补丁'), '新增页不应展示旧系统反推说明')
assert.ok(!newHtml.includes('系统反推结果'), '新增页不应展示旧系统反推结果')
assert.ok(!newHtml.includes('执行策略'), '新增页不应展示旧执行策略')
assert.ok(!newHtml.includes('是否生产补丁'), '新增页不应要求选择是否生产补丁')
assert.ok(!newHtml.includes('是否版本关系变更'), '新增页不应要求选择是否版本关系变更')

const staleNewEntryForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
staleNewEntryForm.recordId = 'BG-STALE-001'
staleNewEntryForm.reason = '上一张变更单的原因'
staleNewEntryForm.decisionValues = { stale: { value: 'FULL', reason: '上一张变更单的判断' } }
staleNewEntryForm.execution = {
  status: 'DONE',
  message: '全部处理成功并已统一生效。',
  progress: 100,
  steps: [{ id: 'STALE', label: '上一张变更单', status: 'DONE' }],
}
state.productionChangeForm = staleNewEntryForm
state.productionChangeFormStep = 'execution'
state.productionChangeFormError = '上一张变更单的错误'
state.productionChangeSelectedOrderId = ''
const newEntryActionNode = {
  dataset: { prodAction: 'start-production-change' },
  closest(selector: string) {
    return selector === '[data-prod-field]' ? null : selector === '[data-prod-action]' ? this : null
  },
} as unknown as HTMLElement
assert.equal(handleProductionEvent(newEntryActionNode), true, '新增变更必须通过明确事件动作处理')
assert.equal(state.productionChangeFormStep, 'order', '新增变更事件必须回到第一步')
assert.equal(state.productionChangeForm.recordId, '', '新增变更必须清空旧变更单号')
assert.equal(state.productionChangeForm.productionOrderId, '', '主入口新增变更不得预留旧生产单')
assert.equal(state.productionChangeForm.reason, '', '新增变更必须清空旧变更原因')
assert.deepEqual(state.productionChangeForm.decisionValues, {}, '新增变更必须清空旧跟单判断')
assert.equal(state.productionChangeForm.execution.status, 'IDLE', '新增变更必须清空旧执行结果')
assert.equal(state.productionChangeFormError, '', '新增变更必须清空旧错误')
const preselectedEntryActionNode = {
  dataset: {
    prodAction: 'start-production-change-type',
    changeType: 'MATERIAL_REPLACEMENT',
    orderId: quantityFactoryOrderId,
  },
  closest(selector: string) {
    return selector === '[data-prod-field]' ? null : selector === '[data-prod-action]' ? this : null
  },
} as unknown as HTMLElement
assert.equal(handleProductionEvent(preselectedEntryActionNode), true, '预选生产单入口必须由统一事件处理')
assert.equal(state.productionChangeFormStep, 'order', '预选生产单后仍必须停留在第一步查看当前事实')
assert.equal(state.productionChangeForm.productionOrderId, quantityFactoryOrderId, '预选入口必须保留生产单')
assert.ok(renderProductionChangeNewPage().includes('当前事实'), '预选生产单第一步必须展示当前事实')
state.productionChangeForm.reason = '当前页输入内容'
state.productionChangeFormStep = 'content'
assert.ok(renderProductionChangeNewPage().includes('当前页输入内容'), '当前页重渲染不得重置正在填写的表单')
assert.ok(listHtml.includes('data-prod-action="start-production-change"'), '主列表新增入口必须使用明确事件动作')
assert.ok(listHtml.includes('搜索变更单号 / 生产单号 / 变更场景 / 处理状态 / 变更原因'), '搜索框只能承诺实际支持字段')

state.productionChangeFormStep = 'order'
state.productionChangeForm.productionOrderId = ''
const emptyOrderStepHtml = renderProductionChangeFormBody('order', state.productionChangeForm)
assert.ok(
  emptyOrderStepHtml.includes('data-prod-field="productionChangeProductionOrderId"'),
  '第一步必须提供生产单选择器',
)
assert.ok(emptyOrderStepHtml.includes('选择生产单后'), '未选择生产单时必须显示清晰空态')
const productionOrderSelectHtml = emptyOrderStepHtml.match(
  /<select data-prod-field="productionChangeProductionOrderId"[^>]*>([\s\S]*?)<\/select>/,
)?.[1] ?? ''
const selectableProductionOrderIds = Array.from(
  productionOrderSelectHtml.matchAll(/<option value="([^"]+)"/g),
  (match) => match[1],
).filter(Boolean)
assert.ok(selectableProductionOrderIds.length > 0, '第一步至少需要一个具有当前事实的生产单候选')
selectableProductionOrderIds.forEach((productionOrderId) => {
  const factsBeforeRender = changeDomain.getProductionOrderChangeCurrentFacts(productionOrderId)
  assert.ok(factsBeforeRender, `生产单选择器候选 ${productionOrderId} 必须存在当前事实`)
  assert.ok(
    createQuantityLinesForOrder(productionOrderId).length > 0,
    `生产单选择器候选 ${productionOrderId} 必须存在可操作的颜色尺码需求明细`,
  )

  const candidateForm = createProductionChangeForm()
  candidateForm.productionOrderId = productionOrderId
  const candidateOrderHtml = renderProductionChangeFormBody('order', candidateForm)
  ;['审核', '主管', '负责人'].forEach((text) => {
    assert.ok(!candidateOrderHtml.includes(text), `生产单 ${productionOrderId} 当前事实展示不得出现旧口径「${text}」`)
  })
  factsBeforeRender.historyFacts.forEach((history) => {
    ;[history.changeOrderNo, history.affectedScope, history.lockStatus].forEach((text) => {
      assert.ok(candidateOrderHtml.includes(text), `生产单 ${productionOrderId} 历史留痕缺少「${text}」`)
    })
  })
  assert.deepEqual(
    changeDomain.getProductionOrderChangeCurrentFacts(productionOrderId),
    factsBeforeRender,
    `生产单 ${productionOrderId} 当前事实源数据不得被展示归一改写`,
  )

  const candidateMaterialForm = createInitializedProductionChangeForm(productionOrderId, 'MATERIAL_REPLACEMENT')
  const candidateMaterialHtml = renderProductionChangeFormBody('content', candidateMaterialForm)
  const candidateTotalDemandQty = Number(
    candidateMaterialHtml.match(/data-prod-field="productionChangeConfirmedProductionQty"[^>]*max="(\d+)"/)?.[1] ?? 0,
  )
  assert.ok(candidateTotalDemandQty > 0, `生产单 ${productionOrderId} 的物料表单总需求上限必须大于 0`)
})
assert.ok(selectableProductionOrderIds.includes('PO-202604-0018'), '具备当前需求明细的生产单必须进入候选')

const legacyHistoryFactsBeforeRender = changeDomain.getProductionOrderChangeCurrentFacts('PO-202604-0018')
assert.ok(legacyHistoryFactsBeforeRender, '历史展示归一检查需要旧流程事实样本')
const legacyHistoryForm = createProductionChangeForm()
legacyHistoryForm.productionOrderId = 'PO-202604-0018'
const normalizedLegacyHistoryHtml = renderProductionChangeFormBody('order', legacyHistoryForm)
assert.ok(normalizedLegacyHistoryHtml.includes('处理中'), '旧流程“审核中”状态必须在展示层归一为“处理中”')
legacyHistoryFactsBeforeRender.historyFacts.forEach((history) => {
  assert.ok(!normalizedLegacyHistoryHtml.includes(history.note), '历史自由备注不得在新表单中机械改写后展示')
})
;['审核', '主管', '负责人'].forEach((text) => {
  assert.ok(!normalizedLegacyHistoryHtml.includes(text), `历史事实展示不得出现旧口径「${text}」`)
})
assert.deepEqual(
  changeDomain.getProductionOrderChangeCurrentFacts('PO-202604-0018'),
  legacyHistoryFactsBeforeRender,
  '历史展示文案归一不得改写底层历史事实',
)

state.productionChangeForm.productionOrderId = 'PO-WITHOUT-CURRENT-FACTS'
const missingFactsOrderStepHtml = renderProductionChangeFormBody('order', state.productionChangeForm)
assert.ok(missingFactsOrderStepHtml.includes('找不到当前事实'), '生产单找不到事实时必须显示区别于未选择的空态')

state.productionChangeForm.productionOrderId = documentFactOrder.productionOrderId
const selectedOrderStepHtml = renderProductionChangeFormBody('order', state.productionChangeForm)
;['当前事实只读', '当前需求明细', '物料事实', '关联单据', '历史留痕', '计划数量', '已完成', '待处理'].forEach((text) => {
  assert.ok(selectedOrderStepHtml.includes(text), `选择有效生产单后第一步缺少「${text}」`)
})
assert.ok(!selectedOrderStepHtml.includes('type="number"'), '第一步不得提供任何进度或事实数量输入')
assert.ok(currentFacts, '事实溢出检查需要有效当前事实')
const overflowFacts = {
  ...currentFacts,
  documentFacts: Array.from({ length: 10 }, (_, index) => ({
    ...currentFacts.documentFacts[0],
    id: `OVERFLOW-FACT-${index + 1}`,
    documentNo: `OVERFLOW-DOC-${index + 1}`,
  })),
}
const overflowFactsHtml = renderProductionChangeCurrentFactsSummary(overflowFacts)
assert.ok(overflowFactsHtml.includes('OVERFLOW-DOC-1'), '事实表必须展示首条事实')
assert.ok(overflowFactsHtml.includes('OVERFLOW-DOC-10'), '事实表不得因首屏限制丢失末条事实')
assert.ok(
  overflowFactsHtml.includes('data-production-change-fact-overflow'),
  '超过 8 条的事实必须使用带稳定锚点的展开区承载其余项',
)
assert.equal(
  (overflowFactsHtml.match(/>单据类型</g) ?? []).length,
  2,
  '展开的剩余事实表必须重复展示与首表一致的表头',
)

state.productionChangeForm.productionOrderId = relation.productionOrderId
;(state.productionChangeForm as any).changeType = 'QUANTITY_CHANGE'
state.productionChangeFormStep = 'content'
const quantityFormHtml = renderProductionChangeNewPage()
;['商品编码', '颜色', '尺码', '原需求', '变更后数量', '变更原因'].forEach((text) => {
  assert.ok(quantityFormHtml.includes(text), `数量变更表单缺少「${text}」`)
})
assert.ok(quantityFormHtml.includes('新增明细'), '数量变更表单必须支持新增明细')
assert.ok(quantityFormHtml.includes('按每条需求明细修改'), '数量变更必须明确按每条需求明细修改')
assert.ok(
  quantityFormHtml.includes('data-prod-action="add-production-change-quantity-line"'),
  '新增明细按钮缺少事件契约',
)
assert.ok(
  /data-prod-field="productionChangeQuantityTargetQty"[^>]*data-line-id="[^"]+"[^>]*type="number"[^>]*min="0"[^>]*step="1"/.test(quantityFormHtml),
  '变更后数量输入必须带明细 ID，并限制为非负整数',
)
;['productionChangeQuantitySkuCode', 'productionChangeQuantityColor', 'productionChangeQuantitySize'].forEach((field) => {
  assert.ok(quantityFormHtml.includes(`data-prod-field="${field}"`), `新增明细缺少字段契约 ${field}`)
})
assert.ok(quantityFormHtml.includes('data-prod-field="productionChangeReason"'), '数量变更缺少变更原因字段契约')
assertIncludesAny(quantityFormHtml, ['已取消', '改为 0'], '数量变更表单必须表达取消明细或数量改为 0')
assert.ok(!quantityFormHtml.includes('变更后总数'), '数量变更表单不得出现变更后总数')
const cancelledQuantityForm = createProductionChangeForm()
cancelledQuantityForm.productionOrderId = relation.productionOrderId
cancelledQuantityForm.changeType = 'QUANTITY_CHANGE'
cancelledQuantityForm.quantityLines = createQuantityLinesForOrder(relation.productionOrderId)
assert.ok(cancelledQuantityForm.quantityLines[0], '取消行检查至少需要一条需求明细')
cancelledQuantityForm.quantityLines[0].targetQty = 0
const cancelledLineId = cancelledQuantityForm.quantityLines[0].id
const cancelledQuantityHtml = renderProductionChangeFormBody('content', cancelledQuantityForm)
assert.ok(
  cancelledQuantityHtml.includes(`data-production-change-quantity-row data-line-id="${cancelledLineId}"`),
  '数量行必须提供稳定行锚点和明细 ID',
)
assert.ok(
  cancelledQuantityHtml.includes(`data-production-change-quantity-delta data-line-id="${cancelledLineId}"`),
  '数量变化必须提供稳定锚点和明细 ID',
)
assert.ok(
  new RegExp(`data-production-change-quantity-status data-line-id="${cancelledLineId}"[^>]*>已取消<`).test(cancelledQuantityHtml),
  'targetQty=0 时必须在对应状态锚点内显示“已取消”',
)
assert.ok(cancelledQuantityHtml.includes('data-production-change-quantity-summary'), '数量汇总必须提供稳定锚点')

state.productionChangeForm = createInitializedProductionChangeForm(relation.productionOrderId, 'MATERIAL_REPLACEMENT')
state.productionChangeFormStep = 'content'
const currentMaterialOptions = listCurrentMaterialOptionsForOrder(relation.productionOrderId)
const originalMaterialOption = currentMaterialOptions[0]
const alternativeMaterialOption = replacementMaterialOptions[0]
assert.ok(originalMaterialOption && alternativeMaterialOption, '物料替换边界检查需要当前面料和系统新面料候选')
state.productionChangeForm.materialReplacement.originalMaterialId = originalMaterialOption.value
state.productionChangeForm.materialReplacement.replacementMaterialId = alternativeMaterialOption.value
const materialFormHtml = renderProductionChangeNewPage()
;[
  '原面料',
  '新面料',
  '剩余数量替换',
  '全部数量替换',
  '只处理当前生产单',
  '后续生产单也替换',
  '建议替换生产数量',
].forEach((text) => {
  assert.ok(materialFormHtml.includes(text), `替换物料表单缺少「${text}」`)
})
;[
  ['set-production-change-replacement-mode', 'REMAINING'],
  ['set-production-change-replacement-mode', 'FULL'],
  ['set-production-change-scope', 'CURRENT_ONLY'],
  ['set-production-change-scope', 'CURRENT_AND_FOLLOWING'],
].forEach(([action, value]) => {
  const valueAttribute = action === 'set-production-change-replacement-mode' ? 'data-mode' : 'data-scope'
  assert.ok(
    new RegExp(`<button[^>]*data-prod-action="${action}"[^>]*${valueAttribute}="${value}"[^>]*>`).test(materialFormHtml),
    `替换物料表单缺少 ${value} 完整分段按钮契约`,
  )
})
assert.ok(
  /data-prod-field="productionChangeConfirmedProductionQty"[^>]*type="number"[^>]*min="0"[^>]*max="\d+"[^>]*step="1"/.test(materialFormHtml),
  '确认替换生产数量必须限制在总需求内且只允许整数件',
)
assert.ok(
  materialFormHtml.includes('data-prod-action="toggle-production-change-allocation"'),
  '替换物料表单缺少调整颜色尺码分配入口',
)
assert.ok(materialFormHtml.includes('不是修改需求明细'), '替换物料表单必须说明数量输入的业务对象')
assert.ok(materialFormHtml.includes('不是填写面料米数'), '替换物料表单必须排除面料米数口径')
const originalMaterialSelectHtml = materialFormHtml.match(
  /<select data-prod-field="productionChangeOriginalMaterialId"[^>]*>([\s\S]*?)<\/select>/,
)?.[1] ?? ''
const originalMaterialIds = Array.from(
  originalMaterialSelectHtml.matchAll(/<option value="([^"]+)"/g),
  (match) => match[1],
).filter(Boolean)
assert.deepEqual(
  originalMaterialIds.sort(),
  currentMaterialOptions.map((option) => option.value).sort(),
  '原面料候选必须严格来自当前生产单面料事实',
)
const replacementMaterialSelectHtml = materialFormHtml.match(
  /<select data-prod-field="productionChangeReplacementMaterialId"[^>]*>([\s\S]*?)<\/select>/,
)?.[1] ?? ''
const replacementMaterialIds = Array.from(
  replacementMaterialSelectHtml.matchAll(/<option value="([^"]+)"/g),
  (match) => match[1],
).filter(Boolean)
assert.ok(
  replacementMaterialIds.every((value) => replacementMaterialOptionValues.includes(value)),
  '新面料候选必须严格来自系统面料主档',
)
state.productionChangeForm.materialReplacement.originalMaterialId = alternativeMaterialOption.value
state.productionChangeForm.materialReplacement.replacementMaterialId = alternativeMaterialOption.value
const sameMaterialFormHtml = renderProductionChangeNewPage()
assert.ok(sameMaterialFormHtml.includes('新面料不能与原面料相同'), '原面料与新面料同值时必须显示明确中文错误')
const legacySameMaterialForm = createProductionChangeForm()
legacySameMaterialForm.productionOrderId = relation.productionOrderId
legacySameMaterialForm.changeType = 'MATERIAL_REPLACEMENT'
legacySameMaterialForm.materialReplacement.originalMaterialId = legacyOriginalIdentity
legacySameMaterialForm.materialReplacement.replacementMaterialId = legacyReplacementIdentity
const legacySameMaterialHtml = renderProductionChangeFormBody('content', legacySameMaterialForm)
assert.ok(
  legacySameMaterialHtml.includes('新面料不能与原面料相同'),
  '同一非 FAB 文本使用不同兼容前缀时也必须显示同值错误',
)
state.productionChangeForm.materialReplacement.originalMaterialId = originalMaterialOption.value
state.productionChangeForm.materialReplacement.replacementMaterialId = alternativeMaterialOption.value
state.productionChangeForm.advancedAllocationOpen = true
const expandedMaterialFormHtml = renderProductionChangeNewPage()
assert.ok(
  /data-prod-field="productionChangeAllocationQty"[^>]*data-allocation-id="[^"]+"[^>]*type="number"[^>]*min="0"[^>]*max="\d+"[^>]*step="1"/.test(expandedMaterialFormHtml),
  '展开颜色尺码分配后，每行输入必须带分配 ID 并限制为需求内整数件',
)
const inconsistentAllocationForm = createProductionChangeForm()
inconsistentAllocationForm.productionOrderId = relation.productionOrderId
inconsistentAllocationForm.changeType = 'MATERIAL_REPLACEMENT'
inconsistentAllocationForm.advancedAllocationOpen = true
inconsistentAllocationForm.materialReplacement.confirmedProductionQty = 120
inconsistentAllocationForm.materialReplacement.allocations = canonicalAllocations.map((line, index) => ({
  ...line,
  confirmedReplacementQty: index === 0 ? line.confirmedReplacementQty - 1 : line.confirmedReplacementQty,
}))
const inconsistentAllocationHtml = renderProductionChangeFormBody('content', inconsistentAllocationForm)
assert.ok(
  inconsistentAllocationHtml.includes('data-production-change-allocation-summary'),
  '物料分配摘要必须提供稳定锚点',
)
assert.ok(inconsistentAllocationHtml.includes('分配合计 119 件 / 确认 120 件'), 'renderer 必须展示 state 的实际不守恒数值')
assert.ok(inconsistentAllocationHtml.includes('分配合计需等于确认生产件数，还差 1 件'), 'renderer 必须展示 state 的不一致提示')
assert.ok(!inconsistentAllocationHtml.includes('分配已按确认生产件数自动归一'), 'renderer 不得用未写回 state 的局部归一结果冒充真实值')
assert.ok(
  inconsistentAllocationHtml.includes(`value="${inconsistentAllocationForm.materialReplacement.allocations[0].confirmedReplacementQty}"`),
  'renderer 的分配输入值必须与 state 一致',
)
state.productionChangeForm.advancedAllocationOpen = false
;['适用批次', '适用颜色', '适用尺码'].forEach((text) => {
  assert.ok(!materialFormHtml.includes(text), `替换物料表单不得出现「${text}」`)
})
assert.ok(!quantityFormHtml.includes('productionChangeReplacementMaterialId'), '数量表单不得混入新面料字段')
assert.ok(!materialFormHtml.includes('productionChangeQuantityTargetQty'), '物料表单不得混入需求明细数量字段')

const quantityEditOrder = listProductionOrderChangeOrders().find((order) => order.quantityLines?.length)
assert.ok(quantityEditOrder, '编辑页检查至少需要一张旧数量变更单')
state.productionChangeSelectedOrderId = ''
state.productionChangeFormStep = 'order'
const quantityEditHtml = renderProductionChangeEditPage(quantityEditOrder.id)
assert.equal(state.productionChangeFormStep, 'content', '从默认 order 进入旧记录页时必须重置为 content')
assert.ok(quantityEditHtml.includes('data-production-change-form-body="content"'), '旧记录页必须固定渲染 content 主体')
;['order', 'handling', 'execution'].forEach((step) => {
  assert.ok(!quantityEditHtml.includes(`data-production-change-form-body="${step}"`), `旧记录页不得渲染 ${step} 主体`)
})
assert.ok(
  /data-prod-field="productionChangeQuantityTargetQty"[^>]*value="1170"/.test(quantityEditHtml),
  '数量编辑页必须按差额把黑色 M 回填为 1170',
)
assert.equal(
  (quantityEditHtml.match(/data-production-change-quantity-row/g) ?? []).length,
  factoryQuantityLines.length,
  '数量编辑页不得因旧记录增加需求行',
)
assert.ok(
  /<strong[^>]*data-production-change-quantity-target-total[^>]*>\s*2050\s*件\s*<\/strong>/.test(quantityEditHtml),
  '数量编辑页目标合计必须按当前事实应用两条旧行差额',
)
assert.ok(!quantityEditHtml.includes('data-line-id="CHANGE-PO-202603-0004-001-LEGACY'), '未匹配旧行不得渲染为新增需求行')
assert.ok(quantityEditHtml.includes('旧记录只读，如需调整请按原记录新建变更'), '旧数量变更记录必须明确提示只读')
assert.ok(quantityEditHtml.includes('藏青色') && quantityEditHtml.includes('L'), '旧记录必须展示藏青色 L 明细')
assert.ok(!quantityEditHtml.includes('data-prod-action="save-production-change-draft"'), '旧数量变更记录不得显示保存草稿动作')
assert.ok(!quantityEditHtml.includes('data-prod-action="submit-production-change-order"'), '旧数量变更记录不得显示保存变更内容动作')
assert.ok(!quantityEditHtml.includes('data-prod-action="set-production-change-type"'), '旧数量变更记录不得允许切换变更类型')
assert.ok(quantityEditHtml.includes('按原记录新建变更'), '旧数量变更记录必须提供按原记录新建入口')
const clonedQuantityForm = createProductionChangeFormFromRecord(quantityEditOrder)
assert.equal(clonedQuantityForm.productionOrderId, quantityEditOrder.productionOrderId, '按原记录新建必须保留生产单')
assert.equal(clonedQuantityForm.changeType, quantityEditOrder.changeType, '按原记录新建必须保留变更类型')
assert.equal(clonedQuantityForm.reason, quantityEditOrder.reason, '按原记录新建必须保留变更原因')
assert.ok(
  clonedQuantityForm.quantityLines.some((line) => line.targetQty !== line.currentQty),
  '按原记录新建必须保留可安全映射的数量变化',
)
assert.deepEqual(clonedQuantityForm.decisionValues, {}, '按原记录新建必须清空旧判断结果')
assert.equal(clonedQuantityForm.execution.status, 'IDLE', '按原记录新建必须清空旧执行状态')

const materialEditOrder = listProductionOrderChangeOrders().find(
  (order) => order.materialReplacement && createQuantityLinesForOrder(order.productionOrderId).length > 0,
)
assert.ok(materialEditOrder?.materialReplacement, '编辑页检查至少需要一张可映射的旧物料变更单')
state.productionChangeFormStep = 'handling'
const materialEditHtml = renderProductionChangeEditPage(materialEditOrder.id)
assert.equal(state.productionChangeFormStep, 'content', '从 handling 进入旧记录页时必须重置为 content')
assert.ok(materialEditHtml.includes('data-production-change-form-body="content"'), '旧物料记录页必须固定渲染 content 主体')
const materialEditFields = Array.from(materialEditHtml.matchAll(/<(?:input|select|textarea)\b[^>]*data-prod-field="[^"]+"[^>]*>/g), (match) => match[0])
assert.ok(materialEditFields.length > 0, '旧物料记录页必须展示只读字段')
materialEditFields.forEach((fieldHtml) => {
  assert.ok(/\sdisabled(?:\s|>|=)/.test(fieldHtml), `旧物料记录字段不得处于可编辑状态：${fieldHtml}`)
})
assert.ok(
  materialEditHtml.includes(materialEditOrder.materialReplacement.originalMaterial),
  '物料编辑页必须保留原记录的原面料内容',
)
assert.ok(
  materialEditHtml.includes(materialEditOrder.materialReplacement.replacementMaterial),
  '物料编辑页必须保留原记录的新面料内容',
)
assert.ok(materialEditHtml.includes('data-production-change-allocation-summary'), '物料编辑页必须初始化守恒分配摘要')
assert.ok(materialEditHtml.includes('旧记录只读，如需调整请按原记录新建变更'), '旧物料变更记录必须明确提示只读')
assert.ok(!materialEditHtml.includes('data-prod-action="save-production-change-draft"'), '旧物料变更记录不得显示保存草稿动作')
assert.ok(!materialEditHtml.includes('data-prod-action="submit-production-change-order"'), '旧物料变更记录不得显示保存变更内容动作')
assert.ok(!materialEditHtml.includes('data-prod-action="set-production-change-type"'), '旧物料变更记录不得允许切换变更类型')
assert.ok(materialEditHtml.includes('data-prod-action="start-production-change"'), '旧物料变更记录必须提供按原记录新建 action')
assert.ok(materialEditHtml.includes('data-change-type="MATERIAL_REPLACEMENT"'), '按原物料记录新建必须保留物料替换场景')

const editHtml = `${quantityEditHtml}${materialEditHtml}`
;['提交审核', '主管确认', '相关负责人'].forEach((text) => {
  assert.ok(!editHtml.includes(text), `生产单变更编辑页不得出现旧口径「${text}」`)
})
assert.ok(editHtml.includes('返回详情'), '旧记录只读页必须提供返回入口')

const quantityHandlingForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
quantityHandlingForm.quantityLines[0].targetQty -= 20
quantityHandlingForm.reason = '黑色 M 减少 20 件。'
const quantityHandlingHtml = renderProductionChangeFormBody('handling', quantityHandlingForm)
;['最终变更类型', '数量与物料', '上下游单据', '成本与交期'].forEach((text) => {
  assert.ok(quantityHandlingHtml.includes(text), `确认处理方案步骤缺少摘要「${text}」`)
})
;['系统自动处理', '待跟单判断', '当前没有需要跟单判断的事项'].forEach((text) => {
  assert.ok(quantityHandlingHtml.includes(text), `确认处理方案步骤缺少「${text}」`)
})
assert.ok(quantityHandlingHtml.includes('data-production-change-handling'), '第三步主体必须提供稳定锚点')
assert.ok(quantityHandlingHtml.includes('裁剪单未执行数量自动调整'), '第三步必须展示数量场景 AUTO 项')
assert.ok(quantityHandlingHtml.includes('生产单打补丁'), '第三步必须展示最终结果中文名')
assert.ok(quantityHandlingHtml.includes('变更明细均被当前正式版本覆盖'), '第三步必须展示最终结果原因')
;['受影响生产单及关联单据当前事实', '计划数量', '已完成', '待处理', 'SP-202603-004-01', 'CUT-202603-004-01'].forEach((text) => {
  assert.ok(quantityHandlingHtml.includes(text), `第三步必须展示当前生产单及关联单据事实「${text}」`)
})

const suggestedDecisionForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'MATERIAL_REPLACEMENT')
suggestedDecisionForm.materialReplacement.replacementMaterialId = replacementOption.value
suggestedDecisionForm.materialReplacement.scope = 'CURRENT_AND_FOLLOWING'
suggestedDecisionForm.reason = '后续生产单同步替换。'
const startedPlan = suggestedDecisionForm.materialReplacement.followingOrders.find((order) => order.started)
assert.ok(startedPlan, '第三步判断渲染需要已开工后续生产单')
const followingDecisionId = `following-order-mode-${startedPlan.productionOrderId}`
const suggestedDecisionHtml = renderProductionChangeFormBody('handling', suggestedDecisionForm)
;['PO-202603-0101', 'WLS-PL-260306-101', 'CUT-260306-101-01', '部分领料', '部分裁剪'].forEach((text) => {
  assert.ok(suggestedDecisionHtml.includes(text), `第三步必须展示后续生产单真实进度和数量「${text}」`)
})
assert.ok(
  suggestedDecisionHtml.includes(`data-prod-field="productionChangeDecisionValue" data-decision-id="${followingDecisionId}"`),
  '待跟单判断必须使用约定 select 和 decisionId',
)
assert.ok(suggestedDecisionHtml.includes('<option value="">请选择</option>'), '判断 select 必须提供空值“请选择”')
assert.ok(
  !suggestedDecisionHtml.includes(`<option value="${startedPlan.suggestedMode}" selected>`),
  '系统建议不得在跟单未操作时自动选中',
)
assert.ok(
  !suggestedDecisionHtml.includes(`data-prod-field="productionChangeDecisionReason" data-decision-id="${followingDecisionId}"`),
  '跟单尚未选择时不得显示偏离原因输入',
)
suggestedDecisionForm.decisionValues[followingDecisionId] = { value: startedPlan.suggestedMode, reason: '' }
const acceptedSuggestedDecisionHtml = renderProductionChangeFormBody('handling', suggestedDecisionForm)
assert.ok(
  acceptedSuggestedDecisionHtml.includes(`<option value="${startedPlan.suggestedMode}" selected>`),
  '跟单明确接受系统建议后必须显示已选择',
)
assert.ok(
  !acceptedSuggestedDecisionHtml.includes(`data-prod-field="productionChangeDecisionReason" data-decision-id="${followingDecisionId}"`),
  '跟单明确接受系统建议时不得要求填写原因',
)
suggestedDecisionForm.decisionValues[followingDecisionId] = { value: 'FULL', reason: '' }
const deviatedDecisionHtml = renderProductionChangeFormBody('handling', suggestedDecisionForm)
assert.ok(
  deviatedDecisionHtml.includes(`data-prod-field="productionChangeDecisionReason" data-decision-id="${followingDecisionId}"`),
  '偏离系统建议时必须显示原因输入',
)
const handlingHtml = `${quantityHandlingHtml}${suggestedDecisionHtml}${deviatedDecisionHtml}`
;['逐项确认', '相关负责人', '主管确认', '人工上报进度'].forEach((text) => {
  assert.ok(!handlingHtml.includes(text), `确认处理方案步骤不得出现「${text}」`)
})

;[
  quantityFormHtml,
  materialFormHtml,
].forEach((html) => {
  assert.ok(
    /data-prod-field="productionChangeReason"[^>]*data-skip-page-rerender="true"/.test(html),
    '变更原因输入必须跳过整页重绘',
  )
})
assert.ok(
  /data-prod-field="productionChangeQuantityTargetQty"[^>]*data-skip-page-rerender="true"/.test(quantityFormHtml),
  '数量输入必须跳过整页重绘',
)
assert.ok(
  /data-prod-field="productionChangeConfirmedProductionQty"[^>]*data-skip-page-rerender="true"/.test(materialFormHtml),
  '确认生产件数输入必须跳过整页重绘',
)

const productionEventsSource = readFileSync(
  new URL('../src/pages/production/events.ts', import.meta.url),
  'utf8',
)
const productionChangeWorkflowSource = readFileSync(
  new URL('../src/data/fcs/production-order-change-workflow.ts', import.meta.url),
  'utf8',
)
const productionContextSource = readFileSync(
  new URL('../src/pages/production/context.ts', import.meta.url),
  'utf8',
)
const productionChangesDomainSource = readFileSync(
  new URL('../src/pages/production/changes-domain.ts', import.meta.url),
  'utf8',
)
;[
  'PRODUCTION_CHANGE_EMPTY_FORM',
  'productionChangeFormSource',
  'productionChangeFormEffectiveMode',
  'productionChangeFormChangeContent',
  'productionChangeFormExecutionMode',
  'productionChangeMaterialColors',
  'productionChangeMaterialSizes',
  'productionChangeMaterialEffectiveFromText',
  "state.productionChangeFormStep = 'preview'",
  "step === 'preview'",
  '生产单变更已提交审核',
  '已通知相关负责人处理',
  "tab === 'approval'",
  "action === 'save-production-patch-draft'",
  "executionStrategy: 'AFTER_APPROVAL'",
].forEach((text) => {
  assert.ok(!productionEventsSource.includes(text), `events.ts 不得保留旧生产单变更口径「${text}」`)
})
assert.ok(!productionContextSource.includes("| 'approval'"), '生产单变更详情页签类型不得保留 approval')
assert.ok(!productionChangesDomainSource.includes("{ key: 'approval'"), '生产单变更详情不得继续渲染主管确认页签')
assert.ok(
  !productionChangesDomainSource.includes('data-prod-action="save-production-patch-draft"'),
  '生产补丁不得保留借旧生产单变更单保存草稿的入口',
)
assert.ok(
  !newHtml.includes('data-prod-action="save-production-change-draft"'),
  '新增页 header 不得保留无 handler 的保存草稿 action',
)
assert.ok(newHtml.includes('data-prod-action="go-production-change-next-step"'), '新增页 header 必须保留下一步 action')
assert.ok(
  productionEventsSource.includes("if (action === 'start-production-change-from-order')"),
  'events.ts 必须处理按原记录新建 action',
)
assert.ok(
  productionEventsSource.includes('startProductionChange(orderId, state.productionChangeForm.changeType)'),
  '追加变更 handler 必须按生产单创建全新表单，不得复用旧记录',
)
assert.ok(!productionChangesDomainSource.includes('>继续处理</button>'), '旧记录入口不得误导为可原地继续处理')
assert.ok(!productionChangesDomainSource.includes('withdraw-production-change-order'), '生产单变更不得保留无状态变更的撤回入口')
assert.ok(!productionEventsSource.includes("action === 'withdraw-production-change-order'"), 'events.ts 不得保留撤回死 action handler')
;[
  'patchProductionChangeQuantityDom',
  'patchProductionChangeAllocationDom',
  'productionChangeDecisionValue',
  'productionChangeDecisionReason',
].forEach((text) => {
  assert.ok(productionEventsSource.includes(text), `events.ts 缺少第三步或局部更新实现「${text}」`)
})

const executeProductionChangeSource = productionChangeWorkflowSource.slice(
  productionChangeWorkflowSource.indexOf('export function executeProductionChange('),
  productionChangeWorkflowSource.indexOf('export type InferProductionChangeResultInput'),
)
;['setTimeout', 'Promise', 'async ', 'queue'].forEach((text) => {
  assert.ok(!executeProductionChangeSource.includes(text), `同步执行函数不得包含异步机制「${text}」`)
})
;[
  "action === 'execute-production-change'",
  "action === 'simulate-production-change-failure'",
  "form.execution.status === 'RUNNING'",
  "existingRecord?.status === 'DONE'",
  'persist: persistExecutionResult',
  'form.execution = createProductionChangeRolledBackResult(preview)',
].forEach((text) => {
  assert.ok(productionEventsSource.includes(text), `events.ts 缺少第四步同步写回或防重复证据「${text}」`)
})
assert.ok(executeProductionChangeSource.includes('options.persist?.(result)'), '同步执行器必须在锁内完成事实和记录持久化')

const task5RenderedSurfaces = [
  ['列表和场景卡', listHtml],
  ['数量旧记录页', quantityEditHtml],
  ['物料旧记录页', materialEditHtml],
  ...listProductionOrderChangeOrders().map((order) => [
    `变更单详情 ${order.id}`,
    renderProductionChangeOrderDetailPage(order.id),
  ]),
] as Array<[string, string]>
task5RenderedSurfaces.forEach(([label, html]) => {
  ;['主管', '审核', '负责人'].forEach((text) => {
    assert.ok(!html.includes(text), `${label}不得出现旧业务口径「${text}」`)
  })
})

state.productionChangeSelectedOrderId = ''
state.productionChangeFormStep = 'execution'
const executionHtml = renderProductionChangeNewPage()
assert.ok(executionHtml.includes('data-production-change-execution'), '同步执行步骤必须渲染独立第四步主体')
assert.ok(
  !executionHtml.includes('data-prod-action="go-production-change-next-step"'),
  '第四步 header 不得显示无效下一步动作',
)
const idleExecutionState = state.productionChangeForm.execution
state.productionChangeForm.execution = successfulExecution
const doneExecutionPageHtml = renderProductionChangeNewPage()
assert.ok(
  !doneExecutionPageHtml.includes('data-prod-action="go-production-change-next-step"'),
  'DONE 第四步 header 不得显示无效下一步动作',
)
state.productionChangeForm.execution = failedExecution
const rolledBackExecutionPageHtml = renderProductionChangeNewPage()
assert.ok(
  !rolledBackExecutionPageHtml.includes('data-prod-action="go-production-change-next-step"'),
  'ROLLED_BACK 第四步 header 不得显示无效下一步动作',
)
state.productionChangeForm.execution = idleExecutionState
;[
  '同步执行',
  '全部成功才生效',
  '当前尚未执行，变更尚未正式生效。',
  '确认执行后，系统会在同一次操作内锁定处理范围并返回最终结果。',
  '锁定处理范围',
  '最后核对当前事实',
  '执行全部处理动作',
  '写入双向留痕',
  '统一提交',
  '待执行',
].forEach((text) => {
  assert.ok(executionHtml.includes(text), `同步执行步骤缺少「${text}」`)
})
assert.ok(!executionHtml.includes('生产单正在变更，请稍后再试'), 'IDLE 不得显示正在变更锁提示')
assert.ok(!executionHtml.includes('只能查看'), 'IDLE 不得声称处理范围当前只读锁定')
assert.ok(executionHtml.includes('data-prod-action="execute-production-change"'), '执行前必须显示确认执行主按钮')
assert.ok(executionHtml.includes('>确认执行</button>'), '执行前主按钮文案必须为确认执行')
assert.ok(
  executionHtml.includes('data-prod-action="simulate-production-change-failure"'),
  '执行前必须在演示区域提供失败演示按钮',
)

const runningForm = createProductionChangeForm()
runningForm.execution.status = 'RUNNING'
const runningExecutionHtml = renderProductionChangeFormBody('execution', runningForm)
assert.ok(runningExecutionHtml.includes('生产单正在变更，请稍后再试'), 'RUNNING 必须显示精确锁提示')
assert.ok(
  runningExecutionHtml.includes('执行期间，处理范围内的生产单和关联单据只能查看。'),
  'RUNNING 必须说明处理范围只能查看',
)
assert.ok(!runningExecutionHtml.includes('当前尚未执行'), 'RUNNING 不得显示 IDLE 预执行说明')
assert.match(
  runningExecutionHtml,
  /data-prod-action="execute-production-change"[\s\S]*?disabled/,
  'RUNNING 时必须禁用重复执行',
)
assert.ok(!runningExecutionHtml.includes('data-prod-action="simulate-production-change-failure"'), 'RUNNING 时不得触发失败演示')

const renderExecutionState = (
  result: keyof typeof productionChangeResultLabels,
  execution: ReturnType<typeof executeProductionChange>,
): string => {
  const form = createProductionChangeForm()
  Object.assign(form.execution, { ...execution, result, resultLabel: productionChangeResultLabels[result] })
  return renderProductionChangeFormBody('execution', form)
}

const doneExecutionHtml = renderExecutionState('PRODUCTION_PATCH', successfulExecution)
assert.ok(doneExecutionHtml.includes('全部处理成功并已统一生效。'), '成功后必须展示成功 message')
assert.ok(doneExecutionHtml.includes('执行完成，锁定已释放'), 'DONE 必须说明执行完成且锁已释放')
assert.ok(doneExecutionHtml.includes('100%'), '成功后必须展示 100%')
assert.ok(!doneExecutionHtml.includes('data-prod-action="execute-production-change"'), '成功后不得显示执行主按钮')
;['当前尚未执行', '尚未正式生效', '生产单正在变更，请稍后再试', '只能查看', '待执行'].forEach((text) => {
  assert.ok(!doneExecutionHtml.includes(text), `DONE 不得显示「${text}」`)
})

const rolledBackExecutionHtml = renderExecutionState('VERSION_RELATION', failedExecution)
assert.ok(rolledBackExecutionHtml.includes('执行失败，本次没有修改任何单据。'), '回滚后必须展示失败 message')
assert.ok(
  rolledBackExecutionHtml.includes('已全部回滚，锁定已释放，本次没有生效'),
  'ROLLED_BACK 必须说明全部回滚、释放锁且未生效',
)
assert.ok(rolledBackExecutionHtml.includes('>重新执行</button>'), '回滚后必须允许同步重新执行')
assert.ok(
  rolledBackExecutionHtml.includes('data-prod-action="execute-production-change"'),
  '回滚后的重新执行必须复用正式执行 action',
)
;['当前尚未执行', '尚未正式生效', '生产单正在变更，请稍后再试', '只能查看', '待执行'].forEach((text) => {
  assert.ok(!rolledBackExecutionHtml.includes(text), `ROLLED_BACK 不得显示「${text}」`)
})

const versionAndPatchHtml = renderExecutionState('VERSION_AND_PATCH', {
  ...successfulExecution,
  result: 'VERSION_AND_PATCH',
  resultLabel: productionChangeResultLabels.VERSION_AND_PATCH,
})
;[
  [doneExecutionHtml, productionChangeResultLabels.PRODUCTION_PATCH],
  [rolledBackExecutionHtml, productionChangeResultLabels.VERSION_RELATION],
  [versionAndPatchHtml, productionChangeResultLabels.VERSION_AND_PATCH],
].forEach(([html, resultLabel]) => {
  assert.ok(html.includes(resultLabel), `执行结果页必须展示最终结果「${resultLabel}」`)
})

const newFlowStepHtml: Array<[string, string]> = [
  ['选择生产单', newHtml],
  ['数量变更内容', quantityFormHtml],
  ['物料替换内容', materialFormHtml],
  ['确认处理方案', handlingHtml],
  ['同步执行', executionHtml],
]
newFlowStepHtml.forEach(([step, html]) => {
  removedCopy.forEach((text) => {
    assert.ok(!html.includes(text), `${step}步骤不应出现旧文案「${text}」`)
  })
})

assert.deepEqual(
  Object.keys(productionChangeResultLabels).sort(),
  ['PRODUCTION_PATCH', 'VERSION_AND_PATCH', 'VERSION_RELATION'].sort(),
  '生产单变更最终结果只能有三种',
)
assert.ok(
  listHtml.includes('同一套流程：选择生产单 → 填写变更内容 → 确认处理方案 → 同步执行'),
  '主入口场景卡必须明确展示统一四步流程',
)
assert.ok(
  !listHtml.includes('同一套流程：变更内容 → 需要处理的事 → 处理记录 → 单据记录'),
  '主入口场景卡不得继续展示旧四步词组',
)

const records = listProductionChangeRecords()
assert.deepEqual(
  Array.from(new Set(records.map((record) => record.status))).filter(
    (status) => !['DRAFT', 'READY', 'EXECUTING', 'DONE', 'ROLLED_BACK'].includes(status),
  ),
  [],
  '最终记录状态只能使用五态契约',
)

const copiedRecords = listProductionChangeRecords()
copiedRecords[0].reason = '污染列表副本'
if (copiedRecords[0].currentFactsSnapshot?.documentFacts[0]) {
  copiedRecords[0].currentFactsSnapshot.documentFacts[0].documentNo = '污染列表快照'
}
assert.notEqual(listProductionChangeRecords()[0].reason, '污染列表副本', 'list 必须返回深拷贝')
assert.notEqual(
  listProductionChangeRecords()[0].currentFactsSnapshot?.documentFacts[0]?.documentNo,
  '污染列表快照',
  'list 返回值中的事实快照也必须深拷贝',
)
const copiedRecord = getProductionChangeRecord(records[0].id)
assert.ok(copiedRecord, 'get 必须能按变更单号查询')
copiedRecord.reason = '污染详情副本'
if (copiedRecord.currentFactsSnapshot?.documentFacts[0]) {
  copiedRecord.currentFactsSnapshot.documentFacts[0].documentNo = '污染详情快照'
}
assert.notEqual(getProductionChangeRecord(records[0].id)?.reason, '污染详情副本', 'get 必须返回深拷贝')
assert.notEqual(
  getProductionChangeRecord(records[0].id)?.currentFactsSnapshot?.documentFacts[0]?.documentNo,
  '污染详情快照',
  'get 返回值中的事实快照也必须深拷贝',
)

const savedRecord = buildProductionChangeRecord(
  'BG-CHECK-SAVE-001',
  {
    productionOrderId: records[0].productionOrderId,
    changeType: records[0].changeType,
    reason: '检查保存深拷贝',
    quantityLines: structuredClone(records[0].quantityLines),
    materialReplacement: structuredClone(records[0].materialReplacement),
    decisionValues: structuredClone(records[0].decisionValues),
    affectedDocumentNos: structuredClone(records[0].affectedDocumentNos),
  },
  'DRAFT',
  '2026-07-11 09:00',
)
assert.deepEqual(savedRecord.documentTraces, [], 'DRAFT 记录不得生成执行后单据留痕')
const executingRecord = buildProductionChangeRecord(
  'BG-CHECK-EXECUTING-001',
  {
    productionOrderId: records[0].productionOrderId,
    changeType: records[0].changeType,
    reason: '检查执行中留痕',
    quantityLines: structuredClone(records[0].quantityLines),
    materialReplacement: structuredClone(records[0].materialReplacement),
    decisionValues: structuredClone(records[0].decisionValues),
    affectedDocumentNos: structuredClone(records[0].affectedDocumentNos),
  },
  'EXECUTING',
  '2026-07-11 09:01',
)
assert.deepEqual(executingRecord.documentTraces, [], 'EXECUTING 记录不得生成执行后单据留痕')
assert.ok(
  initialQuantitySeed?.documentTraces.every((trace) => trace.executedAt === initialQuantitySeed.createdAt),
  'DONE 记录留痕必须保存真实执行时间',
)
saveProductionChangeRecord(savedRecord)
savedRecord.reason = '污染保存入参'
if (savedRecord.currentFactsSnapshot?.documentFacts[0]) {
  savedRecord.currentFactsSnapshot.documentFacts[0].documentNo = '污染保存快照'
}
assert.equal(getProductionChangeRecord(savedRecord.id)?.reason, '检查保存深拷贝', 'save 必须深拷贝保存入参')
assert.notEqual(
  getProductionChangeRecord(savedRecord.id)?.currentFactsSnapshot?.documentFacts[0]?.documentNo,
  '污染保存快照',
  'save 必须深拷贝保存事实快照',
)

resetProductionChangeRecordsForTesting()
assert.equal(createNextProductionChangeRecordId('2026-07-10 12:00'), 'BG-20260710-004', 'ID 必须按发起日期续号')
assert.equal(createNextProductionChangeRecordId('2026-07-11 08:00'), 'BG-20260711-001', '跨日期必须从新日期 001 开始')
const julyElevenRecord = structuredClone(initialQuantitySeed!)
julyElevenRecord.id = 'BG-20260711-001'
julyElevenRecord.createdAt = '2026-07-11 08:01'
julyElevenRecord.documentTraces.forEach((trace) => { trace.changeOrderId = julyElevenRecord.id })
saveProductionChangeRecord(julyElevenRecord)
assert.equal(createNextProductionChangeRecordId('2026-07-11 09:00'), 'BG-20260711-002', '同日期必须按已有记录续号')
resetProductionChangeRecordsForTesting()
assert.equal(createNextProductionChangeRecordId('2026-07-12 09:00'), 'BG-20260712-001', '首次分配必须预留当日 001')
assert.equal(createNextProductionChangeRecordId('2026-07-12 09:00'), 'BG-20260712-002', '连续分配必须返回不同变更单号')
assert.throws(() => createNextProductionChangeRecordId('2026-02-30 09:00'), /时间无效/, '不存在的日期不得生成变更单号')
assert.throws(() => createNextProductionChangeRecordId('2026-99-99 09:00'), /时间无效/, '非法月份不得生成变更单号')
assert.throws(
  () => saveProductionChangeRecord(structuredClone(initialQuantitySeed!)),
  /不能覆盖/,
  '默认保存不得静默覆盖同 ID 最终记录',
)
assert.throws(
  () => saveProductionChangeRecord(structuredClone(initialQuantitySeed!), { allowReplace: true }),
  /已完成.*不能覆盖/,
  '即使显式允许替换，领域保存层也不得覆盖 DONE 记录',
)
resetProductionChangeRecordsForTesting()

const finalStatusLabels = ['草稿', '待确认执行', '同步执行中', '已完成', '已回滚']
const finalListHeaders = ['变更单号', '生产单', '变更场景', '最终结果', '待判断事项', '处理状态', '执行结果', '发起时间', '操作']
finalListHeaders.forEach((text) => assert.ok(listHtml.includes(text), `最终列表缺少固定列「${text}」`))
finalStatusLabels.forEach((text) => assert.ok(productionChangesDomainSource.includes(text), `缺少最终状态中文标签「${text}」`))
assert.ok(listHtml.includes('上一页') && listHtml.includes('下一页') && listHtml.includes('每页'), '最终列表必须分页')
assert.ok(
  productionChangesDomainSource.includes('listProductionChangeRecords()'),
  '最终主列表必须使用 listProductionChangeRecords',
)
const unifiedRelationHtml = renderProductionChangeRelationDetailPage('PO-202603-0004')
assert.ok(unifiedRelationHtml.includes('data-prod-action="start-production-change"'), '生产单关系页变更动作必须进入统一四步流程')
assert.ok(!unifiedRelationHtml.includes('data-prod-action="open-tech-pack-version-change"'), '生产单关系页不得绕过四步直接变更版本')
assert.ok(!unifiedRelationHtml.includes('data-prod-action="open-production-patch"'), '生产单关系页不得绕过四步直接发起补丁')

const quantityRecord = records.find((record) => record.changeType === 'QUANTITY_CHANGE' && record.status === 'DONE')
assert.ok(quantityRecord, '需要一张已完成数量变更样例')
const quantityDetailHtml = renderProductionChangeOrderDetailPage(quantityRecord.id)
;['变更内容', '当前事实', '处理方案', '执行结果', '相关单据留痕'].forEach((text) => {
  assert.ok(quantityDetailHtml.includes(text), `数量变更详情缺少「${text}」`)
})
;['来源变更单号', '变更前', '变更后', '处理方式 / 跟单决定', '执行时间'].forEach((text) => {
  assert.ok(quantityDetailHtml.includes(text), `数量变更相关单据记录缺少「${text}」`)
})
assert.ok(quantityRecord.documentTraces.length > 0, '已完成数量变更必须有双向单据留痕')
assert.ok(quantityRecord.documentTraces.every((trace) => trace.changeOrderId === quantityRecord.id), '每条留痕必须可反查来源变更单号')
assert.ok(
  quantityRecord.documentTraces
    .filter((trace) => trace.documentTypeLabel === '裁剪/铺布/裁片')
    .every((trace) => trace.afterText.includes('新计划') && trace.afterText.includes('→')),
  '件数单据留痕必须包含该单据自己的变更后计划数量和关联需求明细前后值',
)
quantityRecord.documentTraces.forEach((trace) => {
  assert.ok(
    listProductionChangeDocumentTraces(trace.documentNo).some((item) => item.changeOrderId === quantityRecord.id),
    `单据 ${trace.documentNo} 自身必须能按单据号反查来源变更`,
  )
})
;['商品编码', '原需求', '当前需求', '已完成', '待处理', '物料', '可变更', '单据类型', '计划数量'].forEach((text) => {
  assert.ok(quantityDetailHtml.includes(text), `最终详情当前事实必须展示明细字段「${text}」`)
})
const finalRecordEditHtml = renderProductionChangeEditPage(quantityRecord.id)
assert.ok(finalRecordEditHtml.includes('查看生产单变更记录'), 'BG 最终记录 edit 路由必须读取最终记录数据源')
assert.ok(finalRecordEditHtml.includes('已形成的变更记录只读'), 'BG 最终记录 edit 路由必须明确只读')
assert.ok(finalRecordEditHtml.includes('按原记录新建变更'), 'BG 最终记录 edit 路由必须提供新建入口')
assert.ok(!finalRecordEditHtml.includes(`未找到生产单变更单：${quantityRecord.id}`), 'BG 最终记录 edit 路由不得误报未找到')
const detailSnapshotBeforeMutation = quantityDetailHtml
const returnedRecordForMutation = getProductionChangeRecord(quantityRecord.id)
if (returnedRecordForMutation?.currentFactsSnapshot?.documentFacts[0]) {
  returnedRecordForMutation.currentFactsSnapshot.documentFacts[0].documentNo = '外部修改后的事实单据'
}
assert.equal(
  renderProductionChangeOrderDetailPage(quantityRecord.id),
  detailSnapshotBeforeMutation,
  '修改返回对象不得改变历史详情中的当前事实快照',
)

const materialRecord = records.find((record) => record.changeType === 'MATERIAL_REPLACEMENT')
assert.ok(materialRecord, '需要一张物料替换样例')
const materialDetailHtml = renderProductionChangeOrderDetailPage(materialRecord.id)
;['变更内容', '当前事实', '处理方案', '执行结果', '相关单据留痕'].forEach((text) => {
  assert.ok(materialDetailHtml.includes(text), `物料替换详情缺少「${text}」`)
})
assert.ok(materialDetailHtml.includes('原物料'), '物料替换详情必须展示原物料')
assert.ok(materialDetailHtml.includes('新物料'), '物料替换详情必须展示新物料')

;[
  ['首页', listHtml],
  ['新增页', newHtml],
  ['数量变更表单', quantityFormHtml],
  ['替换物料表单', materialFormHtml],
  ['数量变更详情', quantityDetailHtml],
  ['物料替换详情', materialDetailHtml],
].forEach(([label, html]) => {
  ;['主管', '负责人', '需要谁处理', '客户要求', '审核'].forEach((text) => {
    assert.ok(!html.includes(text), `${label}不应出现旧角色或审批文案：${text}`)
  })
})

assert.ok(
  productionChangesDomainSource.includes('getProductionChangeRecord(changeOrderId)'),
  '最终详情必须使用 getProductionChangeRecord',
)
const mainListSource = productionChangesDomainSource.slice(
  productionChangesDomainSource.indexOf('export function renderProductionChangesPage()'),
  productionChangesDomainSource.indexOf('function renderDetailTabButtons()'),
)
const finalDetailSource = productionChangesDomainSource.slice(
  productionChangesDomainSource.indexOf('export function renderProductionChangeOrderDetailPage('),
  productionChangesDomainSource.indexOf('export function renderProductionChangeRelationDetailPage('),
)
assert.ok(
  !finalDetailSource.includes('getProductionOrderChangeCurrentFacts('),
  '最终历史详情不得按生产单重新读取实时当前事实',
)
;[mainListSource, finalDetailSource].forEach((source) => {
  assert.ok(!source.includes('listProductionOrderChangeOrders('), '最终主列表不得依赖旧 listProductionOrderChangeOrders')
  assert.ok(!source.includes('getProductionOrderChangeOrder('), '最终详情不得依赖旧 getProductionOrderChangeOrder')
})

const persistedForm = createInitializedProductionChangeForm(quantityFactoryOrderId, 'QUANTITY_CHANGE')
persistedForm.reason = '检查第四步最终记录保存'
persistedForm.quantityLines[0].targetQty += 1
const countBeforeExecutionSave = listProductionChangeRecords().length
const persistedExecution = executeProductionChangeForForm(persistedForm)
assert.equal(persistedExecution.executed, true, '完整表单必须执行并保存最终记录')
assert.equal(listProductionChangeRecords().length, countBeforeExecutionSave + 1, '第四步成功后必须新增最终记录')
const persistedRecord = listProductionChangeRecords().find((record) => record.reason === persistedForm.reason)
assert.equal(persistedRecord?.status, 'DONE', '执行成功记录必须保存为 DONE')
assert.equal(getProductionChangeRecord(persistedRecord?.id ?? '')?.execution.status, 'DONE', '执行后详情必须可查询')

resetProductionChangeRecordsForTesting()
const escapedUnitRecord = structuredClone(initialQuantitySeed!)
escapedUnitRecord.id = 'BG-20260711-ESCAPE'
escapedUnitRecord.quantityLines[0].unit = '<b>件</b>' as any
escapedUnitRecord.documentTraces.forEach((trace) => { trace.changeOrderId = escapedUnitRecord.id })
saveProductionChangeRecord(escapedUnitRecord)
const escapedUnitDetailHtml = renderProductionChangeOrderDetailPage(escapedUnitRecord.id)
assert.ok(!escapedUnitDetailHtml.includes('<b>件</b>'), '数量单位不得作为原始 HTML 注入详情')
assert.ok(escapedUnitDetailHtml.includes('&lt;b&gt;件&lt;/b&gt;'), '数量单位必须以转义文本展示')

const paginationRecords = Array.from({ length: 13 }, (_, index) => {
  const record = structuredClone(initialQuantitySeed!)
  record.id = `BG-20260712-${String(index + 1).padStart(3, '0')}`
  record.createdAt = `2026-07-12 ${String(8 + Math.floor(index / 6)).padStart(2, '0')}:${String((index % 6) * 10).padStart(2, '0')}`
  record.documentTraces.forEach((trace) => { trace.changeOrderId = record.id })
  return record
})
replaceProductionChangeRecordsForTesting(paginationRecords)
paginationRecords[0].reason = '污染替换仓库入参'
assert.notEqual(listProductionChangeRecords()[0].reason, '污染替换仓库入参', 'replace 测试辅助入口必须深拷贝')
state.productionChangeOrderPage = 1
const firstPageHtml = renderProductionChangesPage()
assert.ok(firstPageHtml.includes('BG-20260712-001'), '第一页必须展示第一条记录')
assert.ok(!firstPageHtml.includes('BG-20260712-013'), '第一页不得提前渲染第十三条记录')
assert.ok(firstPageHtml.includes('data-page="2"'), '第一页必须提供可达的第二页操作')
state.productionChangeOrderPage = 2
const secondPageHtml = renderProductionChangesPage()
assert.ok(secondPageHtml.includes('BG-20260712-013'), '第二页必须展示不同的第十三条记录')
assert.ok(!secondPageHtml.includes('BG-20260712-001'), '第二页不得重复第一页首条记录')
assert.ok(secondPageHtml.includes('data-nav="/fcs/production/changes/BG-20260712-013"'), '第二页记录必须保留详情操作')
resetProductionChangeRecordsForTesting()
state.productionChangeOrderPage = 1

console.log('production order changes check passed')
