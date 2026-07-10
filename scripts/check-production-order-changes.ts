import assert from 'node:assert/strict'
import { createProductionChangeForm, state } from '../src/pages/production/context.ts'
import * as changeDomain from '../src/data/fcs/production-tech-pack-change-domain.ts'
import { listMaterialArchives } from '../src/data/pcs-material-archive-repository.ts'
import {
  buildProductionChangePreview,
  buildMaterialReplacementAllocations,
  createFollowingOrderPlans,
  createQuantityLinesForOrder,
  inferProductionChangeResult,
  listAffectedDocumentNosForOrder,
  listReplacementMaterialOptions,
  productionChangeResultLabels,
  quantityChangeRequiresNewFormalVersion,
  resolveFollowingOrderStateFromProgressFallback,
  validateProductionChangeDecisions,
  type ProductionChangeDraft,
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
    '补丁',
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
assert.equal(suggestedFollowingDecision.selectedValue, 'REMAINING', '已开工后续生产单必须默认采用 suggestedMode')
assert.equal(suggestedFollowingDecision.reasonRequired, false, '接受系统建议时不得要求填写原因')
assert.ok(
  !validateProductionChangeDecisions(followingOrdersPreview).includes(suggestedFollowingDecision.id),
  '接受系统建议且未填写原因时判断校验必须通过',
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
assert.equal(confirmedModeDecision?.selectedValue, 'FULL', '后续单必须优先使用已确认模式，再回退系统建议')
assert.equal(confirmedModeDecision?.reasonRequired, true, '已确认模式偏离系统建议时必须要求原因')

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
factoryQuantityLines.forEach((line) => {
  assert.equal(line.unit, '件', '数量明细单位必须为件')
  assert.equal(line.originalQty, line.currentQty, '数量明细原数量与当前数量必须一致')
  assert.equal(line.currentQty, line.targetQty, '数量明细当前数量与目标数量初始值必须一致')
})

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
const pageExports = changePages as Record<string, unknown>
const domainExports = changeDomain as Record<string, unknown>

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
const renderProductionChangeOrderDetailPage = requireFunction<(id: string) => string>(
  pageExports,
  'renderProductionChangeOrderDetailPage',
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
  '搜索生产单号 / 变更单号 / 需求单号 / SPU / 款式 / 负责人',
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
  assert.ok(
    changeDomain.getProductionOrderChangeCurrentFacts(productionOrderId),
    `生产单选择器候选 ${productionOrderId} 必须存在当前事实`,
  )
})

state.productionChangeForm.productionOrderId = 'PO-WITHOUT-CURRENT-FACTS'
const missingFactsOrderStepHtml = renderProductionChangeFormBody('order', state.productionChangeForm)
assert.ok(missingFactsOrderStepHtml.includes('找不到当前事实'), '生产单找不到事实时必须显示区别于未选择的空态')

state.productionChangeForm.productionOrderId = documentFactOrder.productionOrderId
const selectedOrderStepHtml = renderProductionChangeFormBody('order', state.productionChangeForm)
;['当前事实只读', '当前需求明细', '物料事实', '关联单据', '历史留痕', '计划数量', '已完成', '待处理'].forEach((text) => {
  assert.ok(selectedOrderStepHtml.includes(text), `选择有效生产单后第一步缺少「${text}」`)
})
assert.ok(!selectedOrderStepHtml.includes('type="number"'), '第一步不得提供任何进度或事实数量输入')

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

;(state.productionChangeForm as any).changeType = 'MATERIAL_REPLACEMENT'
state.productionChangeFormStep = 'content'
const originalMaterialOption = replacementMaterialOptions[0]
const alternativeMaterialOption = replacementMaterialOptions[1]
assert.ok(originalMaterialOption && alternativeMaterialOption, '物料替换边界检查至少需要两个面料候选')
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
  assert.ok(
    materialFormHtml.includes(`data-prod-action="${action}"`) && materialFormHtml.includes(`="${value}"`),
    `替换物料表单缺少 ${value} 分段按钮契约`,
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
const replacementMaterialSelectHtml = materialFormHtml.match(
  /<select data-prod-field="productionChangeReplacementMaterialId"[^>]*>([\s\S]*?)<\/select>/,
)?.[1] ?? ''
const replacementMaterialIds = Array.from(
  replacementMaterialSelectHtml.matchAll(/<option value="([^"]+)"/g),
  (match) => match[1],
).filter(Boolean)
assert.ok(
  !replacementMaterialIds.includes(originalMaterialOption.value),
  '新面料候选不得包含当前原面料',
)
state.productionChangeForm.materialReplacement.replacementMaterialId = originalMaterialOption.value
const sameMaterialFormHtml = renderProductionChangeNewPage()
assert.ok(sameMaterialFormHtml.includes('新面料不能与原面料相同'), '原面料与新面料同值时必须显示明确中文错误')
state.productionChangeForm.materialReplacement.replacementMaterialId = alternativeMaterialOption.value
state.productionChangeForm.advancedAllocationOpen = true
const expandedMaterialFormHtml = renderProductionChangeNewPage()
assert.ok(
  /data-prod-field="productionChangeAllocationQty"[^>]*data-allocation-id="[^"]+"[^>]*type="number"[^>]*min="0"[^>]*max="\d+"[^>]*step="1"/.test(expandedMaterialFormHtml),
  '展开颜色尺码分配后，每行输入必须带分配 ID 并限制为需求内整数件',
)
state.productionChangeForm.advancedAllocationOpen = false
;['适用批次', '适用颜色', '适用尺码'].forEach((text) => {
  assert.ok(!materialFormHtml.includes(text), `替换物料表单不得出现「${text}」`)
})
assert.ok(!quantityFormHtml.includes('productionChangeReplacementMaterialId'), '数量表单不得混入新面料字段')
assert.ok(!materialFormHtml.includes('productionChangeQuantityTargetQty'), '物料表单不得混入需求明细数量字段')

const editableChangeOrder = listProductionOrderChangeOrders()[0]
assert.ok(editableChangeOrder, '编辑页检查至少需要一张生产单变更单')
const editHtml = renderProductionChangeEditPage(editableChangeOrder.id)
;['提交审核', '主管确认', '相关负责人'].forEach((text) => {
  assert.ok(!editHtml.includes(text), `生产单变更编辑页不得出现旧口径「${text}」`)
})
assertIncludesAny(editHtml, ['保存变更内容', '保存草稿'], '生产单变更编辑页必须使用单角色保存动作')

state.productionChangeFormStep = 'handling'
const handlingHtml = renderProductionChangeNewPage()
;['系统自动处理', '待跟单判断'].forEach((text) => {
  assert.ok(handlingHtml.includes(text), `确认处理方案步骤缺少「${text}」`)
})
assert.ok(!handlingHtml.includes('逐项确认'), '确认处理方案步骤不得要求逐项确认')

state.productionChangeFormStep = 'execution'
const executionHtml = renderProductionChangeNewPage()
assert.ok(executionHtml.includes('data-production-change-execution'), '同步执行步骤必须渲染独立第四步主体')
;['全部成功才生效', '生产单正在变更，请稍后再试'].forEach((text) => {
  assert.ok(executionHtml.includes(text), `同步执行步骤缺少「${text}」`)
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

const orders = listProductionOrderChangeOrders()
assert.ok(
  orders.some((order) => order.changeType === 'QUANTITY_CHANGE'),
  '生产单变更必须覆盖修改生产单需求数量',
)
assert.ok(
  orders.some((order) => order.changeType === 'MATERIAL_REPLACEMENT'),
  '生产单变更必须覆盖替换物料',
)

const quantityOrder = orders.find((order) => order.changeType === 'QUANTITY_CHANGE')
assert.ok(quantityOrder, '需要一张数量变更样例')
const quantityDetailHtml = renderProductionChangeOrderDetailPage(quantityOrder.id)
;['变更内容', '当前事实', '需要处理的事', '处理记录', '相关单据记录'].forEach((text) => {
  assert.ok(quantityDetailHtml.includes(text), `数量变更详情缺少「${text}」`)
})
assertIncludesAny(quantityDetailHtml, ['变更单记录', '变更单留痕'], '数量变更详情必须展示变更单记录或留痕')
assert.ok(
  quantityDetailHtml.includes('来自哪张变更单') || quantityDetailHtml.includes('本单已按变更单'),
  '被改单据必须能反查变更单',
)
assert.ok(quantityDetailHtml.includes('原数量'), '数量变更留痕必须展示原数量')
assert.ok(quantityDetailHtml.includes('新数量'), '数量变更留痕必须展示新数量')
assert.ok(quantityDetailHtml.includes('差异'), '数量变更留痕必须展示数量差异')
;['需要谁处理', '要做什么', '当前做到哪了', '调整原因'].forEach((text) => {
  assert.ok(quantityDetailHtml.includes(text), `数量变更详情处理事项缺少「${text}」`)
})
;['相关单据', '原来', '现在', '谁确认', '确认时间', '原因'].forEach((text) => {
  assert.ok(quantityDetailHtml.includes(text), `数量变更相关单据记录缺少「${text}」`)
})

const materialOrder = orders.find((order) => order.changeType === 'MATERIAL_REPLACEMENT')
assert.ok(materialOrder, '需要一张物料替换样例')
const materialDetailHtml = renderProductionChangeOrderDetailPage(materialOrder.id)
;['变更内容', '当前事实', '需要处理的事', '处理记录', '相关单据记录'].forEach((text) => {
  assert.ok(materialDetailHtml.includes(text), `物料替换详情缺少「${text}」`)
})
assertIncludesAny(materialDetailHtml, ['变更单记录', '变更单留痕'], '物料替换详情必须展示变更单记录或留痕')
assert.ok(
  materialDetailHtml.includes('来自哪张变更单') || materialDetailHtml.includes('本单已按变更单'),
  '被改单据必须能反查变更单',
)
assert.ok(materialDetailHtml.includes('原物料'), '物料替换详情必须展示原物料')
assert.ok(materialDetailHtml.includes('替代物料'), '物料替换详情必须展示替代物料')
assert.ok(materialDetailHtml.includes('旧料') || materialDetailHtml.includes('新物料'), '物料替换详情必须展示旧料/新物料处理事项')
;['适用颜色', '适用尺码', '从哪里开始用新物料'].forEach((text) => {
  assert.ok(materialDetailHtml.includes(text), `物料替换详情缺少「${text}」`)
})
;['需要谁处理', '要做什么', '当前做到哪了', '调整原因'].forEach((text) => {
  assert.ok(materialDetailHtml.includes(text), `物料替换详情处理事项缺少「${text}」`)
})
;['相关单据', '原来', '现在', '谁确认', '确认时间', '原因'].forEach((text) => {
  assert.ok(materialDetailHtml.includes(text), `物料替换相关单据记录缺少「${text}」`)
})
assert.ok(!materialDetailHtml.includes('适用批次'), '物料替换详情不应出现适用批次')

;[
  ['首页', listHtml],
  ['新增页', newHtml],
  ['数量变更表单', quantityFormHtml],
  ['替换物料表单', materialFormHtml],
  ['数量变更详情', quantityDetailHtml],
  ['物料替换详情', materialDetailHtml],
].forEach(([label, html]) => {
  ;['已分发委托', '执行对象', '来源记录', '状态流转', '写回', '投影'].forEach((text) => {
    assert.ok(!html.includes(text), `${label}不应出现抽象文案：${text}`)
  })
})

const beforeCount = listProductionOrderChangeOrders().length
assert.throws(
  () =>
    submitProductionOrderChangeOrder({
      productionOrderId: relation.productionOrderId,
      source: 'DELIVERY_REQUIREMENT_CHANGE',
      changeModules: ['BOM'],
      reason: '自动检查：缺少变更类型必须失败。',
      expectedEffectiveMode: 'FROM_NEXT_PREP',
      effectiveDescription: '从下一次配料开始',
      changeResult: 'PRODUCTION_PATCH',
      executionStrategy: 'AFTER_APPROVAL',
      operatorName: '自动检查',
    }),
  /请选择生产单变更类型/,
  '创建生产单变更单必须显式选择改数量或换物料',
)
assert.throws(
  () =>
    submitProductionOrderChangeOrder({
      productionOrderId: relation.productionOrderId,
      changeType: 'QUANTITY_CHANGE',
      source: 'DELIVERY_REQUIREMENT_CHANGE',
      changeModules: ['BOM'],
      reason: '自动检查：数量变更缺少色码明细必须失败。',
      expectedEffectiveMode: 'FROM_NEXT_PREP',
      effectiveDescription: '从下一次配料开始',
      changeResult: 'PRODUCTION_PATCH',
      executionStrategy: 'AFTER_APPROVAL',
      operatorName: '自动检查',
    }),
  /修改生产单需求数量必须填写颜色尺码数量明细/,
  '修改生产单需求数量必须携带颜色尺码明细',
)
assert.throws(
  () =>
    submitProductionOrderChangeOrder({
      productionOrderId: relation.productionOrderId,
      changeType: 'MATERIAL_REPLACEMENT',
      source: 'MATERIAL_SHORTAGE',
      changeModules: ['BOM'],
      reason: '自动检查：替换物料缺少明细必须失败。',
      expectedEffectiveMode: 'FROM_NEXT_PICKUP',
      effectiveDescription: '从下一次领料开始',
      changeResult: 'PRODUCTION_PATCH',
      executionStrategy: 'AFTER_APPROVAL',
      operatorName: '自动检查',
    }),
  /替换物料必须填写原物料、替代物料、适用颜色、适用尺码和开始使用节点/,
  '替换物料必须携带原物料和替代物料明细',
)

const createdQuantity = submitProductionOrderChangeOrder({
  productionOrderId: relation.productionOrderId,
  changeType: 'QUANTITY_CHANGE',
  source: 'DELIVERY_REQUIREMENT_CHANGE',
  changeModules: ['BOM', 'PROCESS'],
  reason: '自动检查：按颜色尺码修改生产单需求数量。',
  expectedEffectiveMode: 'FROM_NEXT_PREP',
  effectiveDescription: '从下一次配料开始',
  changeResult: 'PRODUCTION_PATCH',
  executionStrategy: 'AFTER_APPROVAL',
  operatorName: '自动检查',
  quantityLines: [
    { color: '黑色', size: 'M', currentQty: 120, newQty: 90, unit: '件' },
    { color: '藏青色', size: 'L', currentQty: 100, newQty: 80, unit: '件' },
  ],
})
assert.equal(createdQuantity.changeType, 'QUANTITY_CHANGE', '数量变更提交必须保留业务类型')
assert.equal(createdQuantity.quantityLines?.[0]?.newQty, 90, '数量变更提交必须保留颜色尺码新数量')
assert.equal(createdQuantity.materialReplacement, undefined, '数量变更提交不应挂物料替换明细')

const createdMaterial = submitProductionOrderChangeOrder({
  productionOrderId: relation.productionOrderId,
  changeType: 'MATERIAL_REPLACEMENT',
  source: 'MATERIAL_SHORTAGE',
  changeModules: ['BOM'],
  reason: '自动检查：替换物料后可查询变更单。',
  expectedEffectiveMode: 'FROM_NEXT_PICKUP',
  effectiveDescription: '从下一次领料开始',
  changeResult: 'PRODUCTION_PATCH',
  executionStrategy: 'AFTER_APPROVAL',
  operatorName: '自动检查',
  materialReplacement: {
    originalMaterial: '自动检查原物料 A',
    replacementMaterial: '自动检查替代物料 B',
    colors: ['黑色'],
    sizes: ['M', 'L'],
    effectiveFromText: '从下一次领料开始用新物料',
  },
})
assert.equal(createdMaterial.changeType, 'MATERIAL_REPLACEMENT', '物料替换提交必须保留业务类型')
assert.equal(createdMaterial.materialReplacement?.replacementMaterial, '自动检查替代物料 B', '物料替换提交必须保留替代物料')
assert.equal(createdMaterial.quantityLines, undefined, '物料替换提交不应挂数量变更明细')

assert.equal(listProductionOrderChangeOrders().length, beforeCount + 2, '新增变更必须进入变更单列表')
assert.equal(getProductionOrderChangeOrder(createdQuantity.id)?.id, createdQuantity.id, '新增数量变更必须可按变更单号查询')
assert.equal(getProductionOrderChangeOrder(createdMaterial.id)?.id, createdMaterial.id, '新增物料替换必须可按变更单号查询')

console.log('production order changes check passed')
