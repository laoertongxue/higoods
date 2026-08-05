// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import {
  allocateRuntimeSewingTaskScope,
  applyRuntimeDirectDispatchMeta,
  cancelFixedMergedTask,
  createFixedMergedTask,
  evaluateFixedMergedTask,
  getRuntimeTaskById,
  listRuntimeProcessTasks,
  reassignRuntimeSewingTask,
  upsertRuntimeTaskTender,
  type RuntimeProcessTask,
} from '../data/fcs/runtime-process-tasks.ts'
import { listBusinessFactoryMasterRecords } from '../data/fcs/factory-master-store.ts'
import type { Factory } from '../data/fcs/factory-types.ts'
import { classifyTaskFulfillmentPolicy } from '../data/fcs/task-fulfillment-policy.ts'
import {
  getMergedProductionTaskDefinition,
  isAssignableProductionExecutionTask,
  normalizeProductionExecutionProcessCode,
} from '../data/fcs/merged-production-task.ts'
import {
  createEffectiveTaskAssignment,
  listCurrentEffectiveTaskAssignments,
  supersedeEffectiveTaskAssignmentsForReassignment,
} from '../data/fcs/effective-task-assignments.ts'
import { createProductionReturnRuleSnapshot } from '../data/fcs/production-return-fulfillment.ts'
import {
  addSignedContractScans,
  generateProductionContract,
  getProductionContract,
  listProductionContracts,
  removeSignedContractScan,
  reorderSignedContractScan,
  recordProductionContractGenerationFailure,
  invalidateProductionContractsForTask,
  retryProductionContractGeneration,
} from '../data/fcs/production-contracts.ts'
import { formatOperationLocalWallClock } from '../data/fcs/sewing-delivery-sla.ts'
import {
  invalidateUnstartedSpecialCraftTaskOrdersForMergedTask,
  listBlockingSpecialCraftTaskOrdersForMergedTask,
  restoreSpecialCraftTaskOrdersAfterMergedTaskCancellation,
} from '../data/fcs/special-craft-task-orders.ts'
import { escapeHtml } from '../utils.ts'

type WorkbenchTaskType = 'ALL' | 'SEWING' | 'NON_SEWING' | 'MERGED'
type DistributionMode = 'BAG_AWARE' | 'FREE'
type AssignMode = 'DIRECT' | 'BIDDING' | 'REASSIGN'

interface DispatchDialogState {
  taskId: string
  mode: AssignMode
  distributionMode: DistributionMode
  factoryId: string
  businessAssignedAt: string
  price: string
  tenderDeadline: string
  reassignReason: string
  selectedSkuCodes: Set<string>
  riskAcknowledged: boolean
  confirmStage: 1 | 2
  error: string
}

interface MergeDialogState {
  mode: 'MERGE' | 'CANCEL'
  productionOrderKeyword: string
  productionOrderId: string
  taskIds: string[]
  mergedTaskId?: string
  confirmStage: 1 | 2
  error: string
}

interface WorkbenchState {
  taskType: WorkbenchTaskType
  keyword: string
  page: number
  detailTaskId: string | null
  dispatch: DispatchDialogState | null
  merge: MergeDialogState | null
  feedback: string
  contractPromptId: string | null
  uploadContractId: string | null
  failedUploadNamesByContract: Record<string, string[]>
}

const state: WorkbenchState = {
  taskType: 'ALL',
  keyword: '',
  page: 1,
  detailTaskId: null,
  dispatch: null,
  merge: null,
  feedback: '',
  contractPromptId: null,
  uploadContractId: null,
  failedUploadNamesByContract: {},
}

let queryTypeInitialized = false

const TASK_IMAGE_BY_INDEX = ['/shirt-sample.jpg', '/dress-sample-1.jpg', '/cardigan-sample.jpg', '/tshirt-sample.jpg']

function formatDateTimeLocal(value: string): string {
  return value.replace(' ', 'T').slice(0, 16)
}

function toWallClock(value: string): string {
  return value.replace('T', ' ') + (value.length === 16 ? ':00' : '')
}

function getTaskType(task: RuntimeProcessTask): Exclude<WorkbenchTaskType, 'ALL'> {
  const policy = classifyTaskFulfillmentPolicy(task)
  if (policy.mergedTaskType) return 'MERGED'
  if (policy.startsWithSewing) return 'SEWING'
  return 'NON_SEWING'
}

function typeLabel(type: WorkbenchTaskType): string {
  return ({
    ALL: '全部任务',
    SEWING: '独立车缝任务',
    NON_SEWING: '非车缝独立生产任务',
    MERGED: '合并任务',
  })[type]
}

function factoryCanAcceptTask(factory: Factory, task: RuntimeProcessTask): boolean {
  const policy = classifyTaskFulfillmentPolicy(task)
  const config = factory.taskAcceptanceConfig
  if (!config || factory.status !== 'active' || !factory.eligibility.allowDispatch) return false
  if (policy.mergedTaskType === 'SEWING_IRON_PACK') return config.canAcceptSewingIronPack
  if (policy.mergedTaskType === 'CUTTING_SEWING_IRON_PACK') return config.canAcceptCuttingSewingIronPack
  if (!config.singleProcessEnabled) return false

  const requiredCodes = new Set(policy.normalizedProcessCodes.map((code) => normalizeProductionExecutionProcessCode(code)))
  return factory.processAbilities.some((ability) => {
    if (ability.status === 'DISABLED' || ability.canReceiveTask === false) return false
    const abilityCode = normalizeProductionExecutionProcessCode(ability.processCode)
    if (requiredCodes.has(abilityCode)) return true
    return false
  })
}

function listEligibleFactoriesForTask(task: RuntimeProcessTask): Factory[] {
  return listBusinessFactoryMasterRecords()
    .filter((factory) => factoryCanAcceptTask(factory, task))
    .slice(0, 20)
}

function processNames(task: RuntimeProcessTask): string[] {
  const names = task.coveredProcesses?.length
    ? task.coveredProcesses.map((item) => item.processName)
    : [task.processNameZh]
  return names
}

function taskRows(): RuntimeProcessTask[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listRuntimeProcessTasks()
    .filter(isAssignableProductionExecutionTask)
    .filter((task) => state.taskType === 'ALL' || getTaskType(task) === state.taskType)
    .filter((task) => !keyword || [task.taskNo, task.taskId, task.productionOrderNo, task.productionOrderId, task.processNameZh, task.assignedFactoryName].some((value) => String(value || '').toLowerCase().includes(keyword)))
}

function taskImage(task: RuntimeProcessTask): string {
  const index = Math.abs([...task.taskId].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % TASK_IMAGE_BY_INDEX.length
  return TASK_IMAGE_BY_INDEX[index]
}

function statusLabel(task: RuntimeProcessTask): string {
  if (task.assignmentStatus === 'AWARDED' || task.assignmentStatus === 'ASSIGNED') return '已分配工厂'
  if (task.assignmentStatus === 'BIDDING') return '竞价中'
  return '待分配'
}

function currentContract(taskId: string) {
  return listProductionContracts({ runtimeTaskId: taskId }).find((item) => item.status === 'EFFECTIVE')
}

const columns: StandardListColumn<RuntimeProcessTask>[] = [
  {
    key: 'identity', title: '生产单 / 任务', width: 260, required: true, freezeable: true,
    render: (task) => `<div class="flex gap-3"><button data-unified-action="preview-image" data-image="${taskImage(task)}" data-label="${escapeHtml(task.productionOrderNo || task.productionOrderId || task.taskId)}"><img src="${taskImage(task)}" alt="${escapeHtml(task.productionOrderNo || task.taskId)}款式实拍图" class="h-14 w-12 rounded border object-cover"/></button><div><b>${escapeHtml(task.productionOrderNo || task.productionOrderId || '未关联生产单')}</b><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)}</p><p class="text-xs text-muted-foreground">${escapeHtml(task.scopeLabel || `${task.scopeQty}件`)}</p></div></div>`,
  },
  {
    key: 'type', title: '任务类型 / 工序链', width: 220, required: true,
    render: (task) => `<b>${escapeHtml(typeLabel(getTaskType(task)))}</b><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(processNames(task).join(' → '))}</p>${task.mergeSourceTaskIds?.length ? `<span class="mt-1 inline-flex rounded bg-violet-50 px-2 py-0.5 text-xs text-violet-700">已合并 ${task.mergeSourceTaskIds.length} 个任务</span>` : ''}`,
  },
  {
    key: 'scope', title: '分配颗粒度', width: 150,
    render: (task) => {
      const policy = classifyTaskFulfillmentPolicy(task)
      return `<b>${policy.assignmentGranularity === 'SKU' ? 'SKU（不可拆数量）' : escapeHtml(policy.assignmentGranularity)}</b><p class="mt-1 text-xs text-muted-foreground">${task.scopeSkuLines.length || 1} 个SKU · ${task.scopeQty.toLocaleString()}件</p>`
    },
  },
  {
    key: 'readiness', title: '生产准备', width: 230,
    render: (task) => classifyTaskFulfillmentPolicy(task).requiresSewingReadinessContext
      ? '<span class="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">可派单 · 准备事实仅作风险提示</span><p class="mt-2 text-xs">点击“准备情况”查看车缝辅料、裁片齐套/放行/目标数量</p>'
      : '<span class="rounded bg-slate-100 px-2 py-1 text-xs">无车缝准备弹窗</span>',
  },
  {
    key: 'assignment', title: '分配结果', width: 180,
    render: (task) => `<b>${escapeHtml(statusLabel(task))}</b><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.assignedFactoryName || '尚未确定工厂')}</p><p class="text-xs">${task.dispatchPrice != null ? `冻结价 ${task.dispatchPrice.toLocaleString()} ${escapeHtml(task.dispatchPriceCurrency || 'IDR')}/${escapeHtml(task.dispatchPriceUnit || '件')}` : '价格待确认'}</p>`,
  },
  {
    key: 'actions', title: '操作', width: 270, required: true, actionColumn: true,
    render: (task) => {
      const contract = currentContract(task.taskId)
      return `<div class="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <button class="text-blue-600" data-unified-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">${classifyTaskFulfillmentPolicy(task).requiresSewingReadinessContext ? '准备情况' : '详情'}</button>
        ${task.assignmentStatus === 'UNASSIGNED' ? `<button class="text-blue-600" data-unified-action="open-direct" data-task-id="${escapeHtml(task.taskId)}">直接派单</button><button class="text-blue-600" data-unified-action="open-bidding" data-task-id="${escapeHtml(task.taskId)}">发起竞价</button>` : ''}
        ${['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus) && classifyTaskFulfillmentPolicy(task).startsWithSewing ? `<button class="text-amber-700" data-unified-action="open-reassign" data-task-id="${escapeHtml(task.taskId)}">改派</button>` : ''}
        ${task.mergeSourceTaskIds?.length && task.assignmentStatus === 'UNASSIGNED' ? `<button class="text-red-600" data-unified-action="open-cancel-merge" data-task-id="${escapeHtml(task.taskId)}">撤销合并</button>` : ''}
        ${contract ? `<a class="text-blue-600" href="/fcs/contracts/print?contractId=${encodeURIComponent(contract.contractId)}" target="_blank">查看/打印合同</a><button class="text-blue-600" data-unified-action="open-upload" data-contract-id="${escapeHtml(contract.contractId)}">上传签订扫描图</button>` : ''}
      </div>`
    },
  },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['identity'],
  pageSize: 20,
}

function renderTaskTabs(rows: RuntimeProcessTask[]): string {
  const all = listRuntimeProcessTasks().filter(isAssignableProductionExecutionTask)
  const types: WorkbenchTaskType[] = ['ALL', 'SEWING', 'NON_SEWING', 'MERGED']
  return types.map((type) => {
    const count = type === 'ALL' ? all.length : all.filter((task) => getTaskType(task) === type).length
    return `<button class="rounded-md border px-3 py-2 text-sm ${state.taskType === type ? 'border-blue-600 bg-blue-50 text-blue-700' : 'bg-white'}" data-unified-action="switch-type" data-task-type="${type}">${typeLabel(type)} ${count}</button>`
  }).join('') + `<span class="ml-auto text-xs text-muted-foreground">当前筛选 ${rows.length} 条，每页20条</span>`
}

function renderReadinessDialog(): string {
  const task = state.detailTaskId ? getRuntimeTaskById(state.detailTaskId) : null
  if (!task) return ''
  const sewing = classifyTaskFulfillmentPolicy(task).requiresSewingReadinessContext
  const skuRows = (task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }]).map((line, index) => `
    <tr><td>${escapeHtml(line.skuCode)}</td><td>${escapeHtml(line.color)}</td><td>${escapeHtml(line.size)}</td><td>${line.qty}件</td><td>${index % 2 ? Math.ceil(line.qty * 0.7) : line.qty}件</td><td>${index % 2 ? '部分放行' : '已放行'}</td></tr>`).join('')
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-detail"></button><section class="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white shadow-xl"><header class="flex items-center justify-between border-b p-5"><div><h2 class="text-lg font-semibold">${sewing ? '车缝生产准备情况' : '任务详情'}</h2><p class="text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)} · 信息不完善只提示风险，不阻断生产分配</p></div><button data-unified-action="close-detail">关闭</button></header>
    <div class="grid gap-4 p-5 md:grid-cols-2">
      <section class="rounded-lg border p-4"><h3 class="font-semibold">车缝的辅料配料情况以及库存情况</h3><div class="mt-3 grid grid-cols-3 gap-3 text-sm"><div><img src="/materials/accessory-button.jpg" alt="纽扣真实物料图" class="h-20 w-full rounded object-cover"/><p>纽扣：已配 ${Math.round(task.scopeQty * .8)}套</p><p>库存 ${task.scopeQty * 3}粒</p></div><div><img src="/materials/accessory-zipper.jpg" alt="拉链真实物料图" class="h-20 w-full rounded object-cover"/><p>拉链：已配 ${task.scopeQty}条</p><p>库存 ${task.scopeQty * 2}条</p></div><div><img src="/materials/accessory-label.jpg" alt="洗水标真实物料图" class="h-20 w-full rounded object-cover"/><p>洗水标：待补 ${Math.ceil(task.scopeQty * .1)}件</p><p>库存 ${task.scopeQty}件</p></div></div></section>
      <section class="rounded-lg border p-4"><h3 class="font-semibold">裁片与菲票装袋</h3><dl class="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt class="text-muted-foreground">普通裁片齐套</dt><dd>${Math.ceil(task.scopeQty * .78)}件</dd></div><div><dt class="text-muted-foreground">辅助工艺裁片</dt><dd>${Math.ceil(task.scopeQty * .4)}件</dd></div><div><dt class="text-muted-foreground">特种工艺裁片</dt><dd>${Math.ceil(task.scopeQty * .25)}件</dd></div><div><dt class="text-muted-foreground">毛织片</dt><dd>${Math.ceil(task.scopeQty * .1)}件</dd></div><div><dt class="text-muted-foreground">裁床放行数量</dt><dd>${Math.ceil(task.scopeQty * .7)}件</dd></div><div><dt class="text-muted-foreground">裁床确认目标数量</dt><dd>${task.scopeQty}件</dd></div></dl><p class="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-700">当前有 2 个菲票袋；默认按装袋情况推荐SKU，避免待交出仓拆袋重装。混装袋异常不影响任务分配。</p></section>
    </div><div class="px-5 pb-5"><table class="w-full border-collapse text-sm"><thead><tr><th>SKU</th><th>颜色</th><th>尺码</th><th>目标</th><th>齐套</th><th>放行</th></tr></thead><tbody>${skuRows}</tbody></table></div></section></div>`
}

function renderDispatchDialog(): string {
  const dialog = state.dispatch
  const task = dialog ? getRuntimeTaskById(dialog.taskId) : null
  if (!dialog || !task) return ''
  const policy = classifyTaskFulfillmentPolicy(task)
  const factories = listEligibleFactoriesForTask(task)
  const skuLines = task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }]
  const selectedQty = skuLines.filter((line) => dialog.selectedSkuCodes.has(line.skuCode)).reduce((sum, line) => sum + line.qty, 0)
  const isSecond = dialog.confirmStage === 2
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-dispatch"></button><section class="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">${dialog.mode === 'DIRECT' ? '直接派单' : dialog.mode === 'REASSIGN' ? '车缝任务改派' : '发起竞价'} · ${escapeHtml(task.taskNo || task.taskId)}</h2><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(policy.taskTypeLabel)} · 分配最小颗粒度：${policy.assignmentGranularity === 'SKU' ? 'SKU' : policy.assignmentGranularity}</p></header><div class="space-y-4 p-5">
    ${dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}
    ${isSecond && dialog.mode !== 'BIDDING' ? `<div class="rounded-lg border-2 border-amber-400 bg-amber-50 p-4"><h3 class="font-bold text-amber-900">二次确认${dialog.mode === 'REASSIGN' ? '改派' : '派单'}价格</h3><p class="mt-2 text-base font-semibold text-red-700">谨慎确认价格，一经提交确认不得修改。</p><p class="mt-3 text-sm">工厂：${escapeHtml(factories.find((item) => item.id === dialog.factoryId)?.name || '未选择')} · 数量：${selectedQty}件 · 派单价：${escapeHtml(dialog.price)} IDR/件</p>${dialog.mode === 'REASSIGN' ? `<p class="mt-2 text-sm">改派原因：${escapeHtml(dialog.reassignReason)}</p>` : ''}<p class="mt-2 text-xs text-amber-800">提交后价格冻结，结算只能读取本次有效分配的冻结价。</p></div>` : `
      ${policy.startsWithSewing ? `<fieldset><legend class="text-sm font-semibold">分配方式</legend><label class="mr-5 text-sm"><input type="radio" name="distributionMode" data-unified-field="distributionMode" value="BAG_AWARE" ${dialog.distributionMode === 'BAG_AWARE' ? 'checked' : ''}/> 按菲票装袋情况分配（默认）</label><label class="text-sm"><input type="radio" name="distributionMode" data-unified-field="distributionMode" value="FREE" ${dialog.distributionMode === 'FREE' ? 'checked' : ''}/> 自由分配</label><p class="mt-1 text-xs text-muted-foreground">自由分配不生成拆袋重装待办；PPIC实际领料时，裁床待交出仓读取最新车缝任务再决定是否拆袋重装。</p></fieldset>` : ''}
      <section><h3 class="text-sm font-semibold">本次分配SKU（同一SKU不能拆数量）</h3><div class="mt-2 grid gap-2 md:grid-cols-2">${skuLines.map((line) => `<label class="flex items-center justify-between rounded border p-2 text-sm"><span><input type="checkbox" data-unified-sku="${escapeHtml(line.skuCode)}" ${dialog.selectedSkuCodes.has(line.skuCode) ? 'checked' : ''}/> ${escapeHtml(line.skuCode)} · ${escapeHtml(line.color)} · ${escapeHtml(line.size)}</span><b>${line.qty}件</b></label>`).join('')}</div><p class="mt-2 text-xs">已选 ${dialog.selectedSkuCodes.size} 个SKU，共 ${selectedQty}件</p></section>
      ${dialog.mode !== 'BIDDING' ? `<label class="block text-sm">承接工厂<select class="mt-1 h-9 w-full rounded border px-3" data-unified-field="factoryId"><option value="">请选择工厂</option>${factories.map((factory) => `<option value="${escapeHtml(factory.id)}" ${dialog.factoryId === factory.id ? 'selected' : ''} ${dialog.mode === 'REASSIGN' && factory.id === task.assignedFactoryId ? 'disabled' : ''}>${escapeHtml(factory.name)}</option>`).join('')}</select></label><label class="block text-sm">派单价（IDR/件）<input type="number" min="1" class="mt-1 h-9 w-full rounded border px-3" data-unified-field="price" value="${escapeHtml(dialog.price)}"/></label>${dialog.mode === 'REASSIGN' ? `<label class="block text-sm">改派原因<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-unified-field="reassignReason" placeholder="必填，说明本次改派原因">${escapeHtml(dialog.reassignReason)}</textarea></label>` : ''}` : `<label class="block text-sm">竞价截止时间<input type="datetime-local" class="mt-1 h-9 w-full rounded border px-3" data-unified-field="tenderDeadline" value="${escapeHtml(dialog.tenderDeadline)}"/></label>`}
      <label class="block text-sm">业务分配日期/时间<input type="datetime-local" class="mt-1 h-9 w-full rounded border px-3" data-unified-field="businessAssignedAt" value="${escapeHtml(dialog.businessAssignedAt)}"/><span class="mt-1 block text-xs text-muted-foreground">回货规则按日期计算，分配日期为第1个自然日；合同只打印日期，不打印具体时间。</span></label>
      <div class="rounded bg-amber-50 p-3 text-sm text-amber-800">本次分配可能包含未完全齐套SKU、辅料库存风险和多个来源袋。以上信息不阻断派单。</div>${policy.startsWithSewing ? `<label class="flex items-start gap-2 rounded border p-3 text-sm"><input type="checkbox" data-unified-field="riskAcknowledged" ${dialog.riskAcknowledged ? 'checked' : ''}/><span><b>我已知悉上述生产准备风险</b><br/><span class="text-xs text-muted-foreground">风险知悉确认与价格二次确认相互独立。</span></span></label>` : ''}`}
    </div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2 text-sm" data-unified-action="${isSecond ? 'back-dispatch' : 'close-dispatch'}">${isSecond ? '返回修改' : '取消'}</button><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-unified-action="confirm-dispatch">${isSecond ? '确认提交并冻结价格' : dialog.mode === 'BIDDING' ? '确认发起竞价' : '下一步：二次确认价格'}</button></footer></section></div>`
}

function renderMergeDialog(): string {
  const dialog = state.merge
  if (!dialog) return ''
  const tasks = dialog.taskIds.map((id) => getRuntimeTaskById(id)).filter((item): item is RuntimeProcessTask => Boolean(item))
  if (dialog.mode === 'CANCEL') {
    const task = tasks[0]
    return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-merge"></button><section class="relative z-10 w-full max-w-xl rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">撤销合并任务</h2></header><div class="space-y-3 p-5">${dialog.error ? `<div class="rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}<p class="text-sm">撤销后恢复原源任务；创建和撤销记录都会保留。</p><div class="rounded border p-3 text-sm">${escapeHtml(task?.productionOrderNo || task?.productionOrderId || '')} · ${escapeHtml(task?.taskNo || task?.taskId || '')} · ${escapeHtml(task?.processNameZh || '')}</div>${dialog.confirmStage === 2 ? '<div class="rounded border-2 border-amber-400 bg-amber-50 p-3 font-semibold">请再次确认撤销。只有尚未分配、未开工的合并任务可以撤销。</div>' : ''}</div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2" data-unified-action="close-merge">取消</button><button class="rounded bg-red-600 px-4 py-2 text-white" data-unified-action="confirm-merge">${dialog.confirmStage === 1 ? '下一步确认' : '确认撤销'}</button></footer></section></div>`
  }

  const keyword = dialog.productionOrderKeyword.trim().toLowerCase()
  const orderCandidates = Array.from(new Map(
    listRuntimeProcessTasks()
      .filter((task) => isAssignableProductionExecutionTask(task) && task.taskUnitType === 'SINGLE_PROCESS_TASK')
      .filter((task) => ['CUTTING', 'SEWING', 'IRON_PACK'].includes(normalizeProductionExecutionProcessCode(task.processBusinessCode || task.processCode, task.processNameZh)))
      .filter((task) => !keyword || [task.productionOrderNo, task.productionOrderId].some((value) => String(value || '').toLowerCase().includes(keyword)))
      .map((task) => [task.productionOrderId, task]),
  ).values()).slice(0, 8)
  const orderTasks = dialog.productionOrderId
    ? listRuntimeProcessTasks()
        .filter((task) => task.productionOrderId === dialog.productionOrderId)
        .filter((task) => task.taskUnitType === 'SINGLE_PROCESS_TASK')
        .filter((task) => ['CUTTING', 'SEWING', 'IRON_PACK'].includes(normalizeProductionExecutionProcessCode(task.processBusinessCode || task.processCode, task.processNameZh)))
    : []
  const evaluation = evaluateFixedMergedTask(dialog.taskIds)
  const definition = evaluation.mergedTaskType ? getMergedProductionTaskDefinition(evaluation.mergedTaskType) : null
  const blockingSpecialCraftOrders = definition?.type === 'CUTTING_SEWING_IRON_PACK' && tasks[0]
    ? listBlockingSpecialCraftTaskOrdersForMergedTask(tasks[0].productionOrderId)
    : []
  const mergeAllowed = evaluation.ok && blockingSpecialCraftOrders.length === 0
  const evaluationMessage = blockingSpecialCraftOrders.length > 0
    ? `已有${blockingSpecialCraftOrders.length}张中央辅助/特种工艺加工单开始执行，不能再创建裁剪+车缝+烫包。`
    : evaluation.message

  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-merge"></button><section class="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">创建合并任务</h2><p class="mt-1 text-xs text-muted-foreground">只允许“车缝+烫包”和“裁剪+车缝+烫包”两种固定模式。</p></header><div class="space-y-4 p-5">
    <section><label class="text-sm font-medium">1. 搜索生产单</label><input class="mt-2 h-10 w-full rounded border px-3 text-sm" placeholder="输入生产单号或SPU" data-unified-merge-field="productionOrderKeyword" value="${escapeHtml(dialog.productionOrderKeyword)}"/><div class="mt-2 grid gap-2 sm:grid-cols-2">${orderCandidates.map((task) => `<button class="rounded border p-3 text-left text-sm ${dialog.productionOrderId === task.productionOrderId ? 'border-blue-600 bg-blue-50' : ''}" data-unified-action="select-merge-order" data-production-order-id="${escapeHtml(task.productionOrderId)}"><b>${escapeHtml(task.productionOrderNo || task.productionOrderId)}</b><p class="text-xs text-muted-foreground">${escapeHtml(task.productionOrderId)}</p></button>`).join('') || '<p class="text-sm text-muted-foreground">没有匹配的生产单</p>'}</div></section>
    <section><h3 class="text-sm font-medium">2. 选择该生产单下的源任务</h3><div class="mt-2 overflow-hidden rounded border"><table class="w-full text-sm"><thead class="bg-slate-50"><tr><th class="p-2 text-left">选择</th><th class="p-2 text-left">任务</th><th class="p-2 text-left">工序</th><th class="p-2 text-left">数量</th><th class="p-2 text-left">状态</th></tr></thead><tbody>${orderTasks.map((task) => { const selectable = isAssignableProductionExecutionTask(task) && task.assignmentStatus === 'UNASSIGNED' && task.status === 'NOT_STARTED' && !task.isSplitSource && !task.isSplitResult && !task.mergedIntoTaskId; const reason = selectable ? '可选择' : task.mergedIntoTaskId ? '已并入其他合并任务' : task.assignmentStatus !== 'UNASSIGNED' ? '已进入分配' : task.status !== 'NOT_STARTED' ? '已开工' : '任务不可合并'; return `<tr class="border-t"><td class="p-2"><input type="checkbox" data-unified-merge-source="${escapeHtml(task.taskId)}" ${dialog.taskIds.includes(task.taskId) ? 'checked' : ''} ${selectable ? '' : 'disabled'}/></td><td class="p-2">${escapeHtml(task.taskNo || task.taskId)}</td><td class="p-2">${escapeHtml(task.processNameZh)}</td><td class="p-2">${task.scopeQty.toLocaleString()}件</td><td class="p-2 ${selectable ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(reason)}</td></tr>` }).join('') || '<tr><td colspan="5" class="p-6 text-center text-muted-foreground">请先选择生产单</td></tr>'}</tbody></table></div></section>
    <section><h3 class="text-sm font-medium">3. 系统识别与责任影响</h3>${dialog.taskIds.length ? `<div class="mt-2 rounded ${mergeAllowed ? 'border border-green-300 bg-green-50 text-green-800' : 'border border-red-200 bg-red-50 text-red-700'} p-3 text-sm"><b>${escapeHtml(mergeAllowed && definition ? `已识别：${definition.label}` : '不能创建')}</b><p class="mt-1">${escapeHtml(evaluationMessage)}</p>${definition ? `<p class="mt-2">辅助工艺、特种工艺：${definition.auxiliarySpecialExecutorMode === 'CENTRAL_FACTORY' ? '仍由中央工厂执行并继续生成加工单' : '随本合并任务交给三方工厂，不生成中央加工单'}</p><p>分配颗粒度：${definition.assignmentGranularity === 'SKU' ? '完整SKU' : '整张合并任务'}</p>` : ''}</div>` : '<p class="mt-2 rounded bg-slate-50 p-3 text-sm text-muted-foreground">请选择完整源任务集合。</p>'}</section>
    ${dialog.error ? `<div class="rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}
    ${dialog.confirmStage === 2 && definition ? `<div class="rounded border-2 border-amber-400 bg-amber-50 p-3 font-semibold">请再次确认：将生产单 ${escapeHtml(tasks[0]?.productionOrderNo || tasks[0]?.productionOrderId || dialog.productionOrderId)} 的 ${escapeHtml(tasks.map((task) => task.processNameZh).join('任务、'))}任务合并为“${escapeHtml(definition.label)}”。原任务保留历史，但不能再单独分配。</div>` : ''}
    </div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2" data-unified-action="close-merge">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" data-unified-action="confirm-merge" ${mergeAllowed ? '' : 'disabled'}>${dialog.confirmStage === 1 ? '下一步确认' : '确认创建'}</button></footer></section></div>`
}

function renderContractPrompt(): string {
  const contract = state.contractPromptId ? getProductionContract(state.contractPromptId) : undefined
  if (!contract) return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-contract-prompt"></button><section class="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"><h2 class="text-lg font-semibold">生产合同已生成</h2><p class="mt-3 text-sm">${escapeHtml(contract.contractNo)} · ${escapeHtml(contract.factoryName)} · ${contract.assignedQty}件</p><p class="mt-2 text-xs text-muted-foreground">是否立即打印合同？未上传签订扫描图不会阻断生产，但会进入“待上传合同扫描图”待办。</p><div class="mt-5 flex justify-end gap-2"><button class="rounded border px-4 py-2" data-unified-action="close-contract-prompt">稍后打印</button><a class="rounded bg-blue-600 px-4 py-2 text-white" target="_blank" href="/fcs/contracts/print?contractId=${encodeURIComponent(contract.contractId)}">立即打印</a></div></section></div>`
}

function renderUploadDialog(): string {
  const contract = state.uploadContractId ? getProductionContract(state.uploadContractId) : undefined
  if (!contract) return ''
  const failedNames = state.failedUploadNamesByContract[contract.contractId] || []
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-upload"></button><section class="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">签订合同扫描图</h2><p class="text-xs text-muted-foreground">${escapeHtml(contract.contractNo)} · 支持多张JPG/PNG，可预览、排序和删除</p></header><div class="p-5"><label class="block rounded-lg border-2 border-dashed p-5 text-center text-sm">选择扫描图片<input type="file" accept="image/jpeg,image/png" multiple class="mt-3 block w-full" data-unified-contract-files="${escapeHtml(contract.contractId)}"/></label>${failedNames.length ? `<div class="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"><b>${failedNames.length}张上传失败，其他成功图片已保留：</b>${failedNames.map(escapeHtml).join('、')}<button class="ml-3 text-blue-700 underline" data-unified-action="retry-failed-scan" data-contract-id="${escapeHtml(contract.contractId)}">只重试失败图片</button></div>` : ''}<div class="mt-4 grid gap-3 sm:grid-cols-2">${contract.scans.map((scan) => `<article class="rounded border p-2"><button data-unified-action="preview-image" data-image="${escapeHtml(scan.dataUrl)}" data-label="${escapeHtml(scan.fileName)}"><img src="${escapeHtml(scan.dataUrl)}" alt="合同扫描图${scan.sortOrder}" class="h-40 w-full object-contain"/></button><div class="mt-2 flex items-center justify-between gap-2 text-xs"><span>${scan.sortOrder}. ${escapeHtml(scan.fileName)}</span><span class="flex gap-2"><button class="text-blue-600" data-unified-action="reorder-scan" data-direction="UP" data-contract-id="${escapeHtml(contract.contractId)}" data-scan-id="${escapeHtml(scan.scanId)}">上移</button><button class="text-blue-600" data-unified-action="reorder-scan" data-direction="DOWN" data-contract-id="${escapeHtml(contract.contractId)}" data-scan-id="${escapeHtml(scan.scanId)}">下移</button><button class="text-red-600" data-unified-action="remove-scan" data-contract-id="${escapeHtml(contract.contractId)}" data-scan-id="${escapeHtml(scan.scanId)}">删除</button></span></div></article>`).join('') || '<p class="col-span-2 py-8 text-center text-sm text-muted-foreground">尚未上传签订扫描图</p>'}</div></div><footer class="flex justify-end border-t p-4"><button class="rounded bg-blue-600 px-4 py-2 text-white" data-unified-action="close-upload">完成</button></footer></section></div>`
}

function renderImagePreview(): string { return '<div data-unified-image-preview></div>' }

export function renderUnifiedDispatchWorkbenchPage(): string {
  if (!queryTypeInitialized && typeof window !== 'undefined') {
    const queryType = new URLSearchParams(window.location.search).get('type') as WorkbenchTaskType | null
    if (queryType && ['ALL', 'SEWING', 'NON_SEWING', 'MERGED'].includes(queryType)) state.taskType = queryType
    const contractId = new URLSearchParams(window.location.search).get('contractId')
    if (contractId && getProductionContract(contractId)?.status === 'EFFECTIVE') state.uploadContractId = contractId
    queryTypeInitialized = true
  }
  const rows = taskRows()
  const pageSize = 20
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  state.page = Math.min(Math.max(1, state.page), pageCount)
  const pageRows = rows.slice((state.page - 1) * pageSize, state.page * pageSize)
  const all = listRuntimeProcessTasks().filter(isAssignableProductionExecutionTask)
  const assigned = all.filter((task) => ['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus)).length
  const contractCount = listProductionContracts().filter((item) => item.status === 'EFFECTIVE').length
  const failedContracts = listProductionContracts().filter((item) => item.status === 'GENERATION_FAILED')
  const content = renderStandardListPage({
    title: '任务分配工作台',
    primaryActionsHtml: `<div class="flex gap-2">${failedContracts.map((contract) => `<button class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" data-unified-action="retry-contract" data-contract-id="${contract.contractId}">重试合同 ${escapeHtml(contract.contractNo)}</button>`).join('')}<button class="rounded bg-violet-600 px-4 py-2 text-sm text-white" data-unified-action="open-merge">合并任务</button></div>`,
    feedbackHtml: state.feedback ? `<div class="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">${escapeHtml(state.feedback)}</div>` : '',
    filtersHtml: `<div class="space-y-3 rounded-lg border bg-card p-3"><div class="flex flex-wrap gap-2">${renderTaskTabs(rows)}</div><input class="h-9 w-full rounded border px-3 text-sm" placeholder="生产单 / 任务号 / 工序 / 工厂" data-unified-field="keyword" value="${escapeHtml(state.keyword)}"/></div>`,
    statsHtml: renderStandardListStats([
      { label: '全部可执行任务', value: all.length },
      { label: '待分配 / 竞价中', value: all.length - assigned },
      { label: '已确认工厂', value: assigned },
      { label: '有效生产合同', value: contractCount },
    ]),
    listTitle: '统一任务列表',
    listActionsHtml: '<span class="text-xs text-muted-foreground">直接派单与竞价共用同一任务口径；价格在直接派单提交或竞价定标时二次确认并冻结</span>',
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences, sort: null, eventPrefix: 'unified-dispatch', emptyText: '当前筛选下暂无任务' }),
    paginationHtml: renderTablePagination({ total: rows.length, from: rows.length ? (state.page - 1) * pageSize + 1 : 0, to: Math.min(state.page * pageSize, rows.length), currentPage: state.page, totalPages: pageCount, pageSize, actionPrefix: 'unified', fieldPrefix: 'unified', pageSizeOptions: [20] }),
    overlaysHtml: `${renderReadinessDialog()}${renderDispatchDialog()}${renderMergeDialog()}${renderContractPrompt()}${renderUploadDialog()}${renderImagePreview()}`,
  })
  return `<div data-unified-dispatch-page data-skip-page-rerender="true">${content}</div>`
}

function refreshRoot(): void {
  const root = document.querySelector<HTMLElement>('[data-unified-dispatch-page]')
  if (root) root.outerHTML = renderUnifiedDispatchWorkbenchPage()
}

function openDispatch(taskId: string, mode: AssignMode): void {
  const task = getRuntimeTaskById(taskId)
  if (!task) return
  const now = formatOperationLocalWallClock()
  const skuCodes = (task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL' }]).map((line) => line.skuCode)
  state.dispatch = {
    taskId,
    mode,
    distributionMode: 'BAG_AWARE',
    factoryId: '',
    businessAssignedAt: formatDateTimeLocal(now),
    price: String(task.standardPrice || task.dispatchPrice || 1200),
    tenderDeadline: formatDateTimeLocal(now.slice(0, 10) + ' 18:00:00'),
    reassignReason: '',
    selectedSkuCodes: new Set(skuCodes),
    riskAcknowledged: false,
    confirmStage: 1,
    error: '',
  }
}

function commitReassignment(dialog: DispatchDialogState): void {
  const sourceTask = getRuntimeTaskById(dialog.taskId)
  if (!sourceTask) throw new Error('原任务已变化，请刷新后重试')
  const factory = listEligibleFactoriesForTask(sourceTask).find((item) => item.id === dialog.factoryId)
  if (!factory) throw new Error('所选工厂不具备该任务的有效承接能力，请重新选择')
  const operatedAt = formatOperationLocalWallClock()
  const businessAssignedAt = toWallClock(dialog.businessAssignedAt)
  const price = Number(dialog.price)
  if (!Number.isFinite(price) || price <= 0) throw new Error('请输入大于0的有效改派价格')
  if (!dialog.reassignReason.trim()) throw new Error('请填写改派原因')
  const result = reassignRuntimeSewingTask({
    sourceTaskId: sourceTask.taskId,
    targetFactoryId: factory.id,
    targetFactoryName: factory.name,
    businessAssignedAt,
    operatedAt,
    reason: dialog.reassignReason.trim(),
    by: '生产计划员',
    mainFactoryId: factory.id,
    riskConfirmed: dialog.riskAcknowledged,
    supervisorAssigned: true,
    dispatchPrice: price,
    dispatchPriceCurrency: sourceTask.standardPriceCurrency || sourceTask.dispatchPriceCurrency || 'IDR',
    dispatchPriceUnit: sourceTask.standardPriceUnit || sourceTask.dispatchPriceUnit || '件',
  })
  if (!result.ok || !result.taskId || !result.assignedQty) throw new Error(result.message || '改派失败')
  const updated = getRuntimeTaskById(result.taskId)
  if (!updated) throw new Error('改派结果未形成新任务')
  const policy = classifyTaskFulfillmentPolicy(updated)
  const sourceLines = updated.scopeSkuLines.length ? updated.scopeSkuLines : [{ skuCode: updated.skuCode || 'SKU-ALL', color: updated.skuColor || '混色', size: updated.skuSize || '混码', qty: result.assignedQty }]
  const sourceTotal = sourceLines.reduce((sum, line) => sum + line.qty, 0)
  const assignedLines = sourceLines.map((line, index) => ({
    skuCode: line.skuCode,
    color: line.color,
    size: line.size,
    qty: index === sourceLines.length - 1
      ? Math.max(1, result.assignedQty - sourceLines.slice(0, -1).reduce((sum, item) => sum + Math.max(1, Math.floor(item.qty * result.assignedQty / Math.max(1, sourceTotal))), 0))
      : Math.max(1, Math.floor(line.qty * result.assignedQty / Math.max(1, sourceTotal))),
  }))
  const assignment = createEffectiveTaskAssignment({
    runtimeTaskId: updated.taskId,
    productionOrderId: updated.productionOrderId || 'UNKNOWN-PO',
    productionOrderNo: updated.productionOrderNo,
    taskNo: updated.taskNo,
    factoryId: factory.id,
    factoryName: factory.name,
    source: 'REASSIGNMENT',
    assignedQty: result.assignedQty,
    skuLines: assignedLines,
    processCodes: policy.normalizedProcessCodes,
    frozenPrice: price,
    priceCurrency: updated.dispatchPriceCurrency || 'IDR',
    priceUnit: updated.dispatchPriceUnit || '件',
    businessAssignedAt,
    operatedAt,
    operatedBy: '生产计划员',
    replaceReason: dialog.reassignReason.trim(),
  })
  supersedeEffectiveTaskAssignmentsForReassignment({
    sourceRuntimeTaskId: sourceTask.taskId,
    replacementAssignmentId: assignment.assignmentId,
    reason: `任务改派：${dialog.reassignReason.trim()}`,
    operatedAt,
    operatedBy: '生产计划员',
  })
  const returnSnapshot = createProductionReturnRuleSnapshot({
    assignmentId: assignment.assignmentId,
    runtimeTaskId: assignment.runtimeTaskId,
    productionOrderId: assignment.productionOrderId,
    factoryId: assignment.factoryId,
    factoryName: assignment.factoryName,
    assignedQty: assignment.assignedQty,
    businessAssignedAt,
    policy,
  })
  invalidateProductionContractsForTask({ runtimeTaskId: sourceTask.taskId, invalidatedAt: operatedAt, reason: `任务改派：${dialog.reassignReason.trim()}；旧合同失效留痕` })
  const contract = generateProductionContract({
    assignment,
    policy,
    returnRuleSnapshot: returnSnapshot,
    processNames: processNames(updated),
    generatedAt: operatedAt,
    generatedBy: '生产计划员',
    lineageRuntimeTaskId: sourceTask.taskId,
  })
  state.feedback = `${sourceTask.taskNo || sourceTask.taskId}已改派至${factory.name}；旧分配和旧合同已失效留痕，新价格已冻结。${contract ? `新合同${contract.contractNo}已生成。` : ''}`
  state.contractPromptId = contract?.contractId || null
}

function commitDirectDispatch(dialog: DispatchDialogState): void {
  const sourceTask = getRuntimeTaskById(dialog.taskId)
  if (!sourceTask) throw new Error('任务已变化，请刷新后重试')
  const factory = listEligibleFactoriesForTask(sourceTask).find((item) => item.id === dialog.factoryId)
  if (!factory) throw new Error('所选工厂不具备该任务的有效承接能力，请重新选择')
  const sourceLines = sourceTask.scopeSkuLines.length ? sourceTask.scopeSkuLines : [{ skuCode: sourceTask.skuCode || 'SKU-ALL', color: sourceTask.skuColor || '混色', size: sourceTask.skuSize || '混码', qty: sourceTask.scopeQty }]
  const selectedLines = sourceLines.filter((line) => dialog.selectedSkuCodes.has(line.skuCode))
  if (selectedLines.length === 0) throw new Error('请至少选择一个完整SKU')
  const policy = classifyTaskFulfillmentPolicy(sourceTask)
  let task = sourceTask
  if (policy.startsWithSewing && selectedLines.length < sourceLines.length) {
    task = allocateRuntimeSewingTaskScope({ taskId: sourceTask.taskId, lines: selectedLines.map((line) => ({ skuCode: line.skuCode, qty: line.qty })), by: '生产计划员' })
  }
  const operatedAt = formatOperationLocalWallClock()
  const businessAssignedAt = toWallClock(dialog.businessAssignedAt)
  const price = Number(dialog.price)
  if (!Number.isFinite(price) || price <= 0) throw new Error('请输入大于0的有效派单价')
  const updated = applyRuntimeDirectDispatchMeta({
    taskId: task.taskId,
    factoryId: factory.id,
    factoryName: factory.name,
    acceptDeadline: '',
    taskDeadline: '',
    remark: dialog.distributionMode === 'BAG_AWARE' ? '默认按菲票装袋情况分配SKU' : '自由分配SKU；不生成拆袋重装待办',
    by: '生产计划员',
    dispatchPrice: price,
    dispatchPriceCurrency: task.standardPriceCurrency || 'IDR',
    dispatchPriceUnit: task.standardPriceUnit || '件',
    priceDiffReason: '',
    businessAssignedAt,
    operatedAt,
    autoAccept: policy.startsWithSewing,
  })
  if (!updated) throw new Error('直接派单失败')
  const assignedLines = (updated.scopeSkuLines.length ? updated.scopeSkuLines : selectedLines).map((line) => ({ skuCode: line.skuCode, color: line.color, size: line.size, qty: line.qty }))
  const assignment = createEffectiveTaskAssignment({
    runtimeTaskId: updated.taskId,
    productionOrderId: updated.productionOrderId || 'UNKNOWN-PO',
    productionOrderNo: updated.productionOrderNo,
    taskNo: updated.taskNo,
    factoryId: factory.id,
    factoryName: factory.name,
    source: 'DIRECT_DISPATCH',
    assignedQty: assignedLines.reduce((sum, line) => sum + line.qty, 0),
    skuLines: assignedLines,
    processCodes: policy.normalizedProcessCodes,
    frozenPrice: price,
    priceCurrency: updated.standardPriceCurrency || 'IDR',
    priceUnit: updated.standardPriceUnit || '件',
    businessAssignedAt,
    operatedAt,
    operatedBy: '生产计划员',
  })
  const returnSnapshot = createProductionReturnRuleSnapshot({
    assignmentId: assignment.assignmentId,
    runtimeTaskId: assignment.runtimeTaskId,
    productionOrderId: assignment.productionOrderId,
    factoryId: assignment.factoryId,
    factoryName: assignment.factoryName,
    assignedQty: assignment.assignedQty,
    businessAssignedAt,
    policy,
  })
  let contract = null
  try {
    contract = generateProductionContract({ assignment, policy, returnRuleSnapshot: returnSnapshot, processNames: processNames(updated), generatedAt: operatedAt, generatedBy: '生产计划员' })
  } catch (error) {
    if (policy.contractRequired && returnSnapshot) {
      contract = recordProductionContractGenerationFailure({
        assignment,
        policy,
        returnRuleSnapshot: returnSnapshot,
        processNames: processNames(updated),
        generatedAt: operatedAt,
        generatedBy: '生产计划员',
        error: error instanceof Error ? error.message : '合同生成失败',
      })
    }
  }
  state.feedback = `已将${updated.taskNo || updated.taskId}分配给${factory.name}；价格已冻结。${contract?.status === 'GENERATION_FAILED' ? '派单成功，但合同生成失败，已形成可重试待办。' : contract ? `合同${contract.contractNo}已生成。` : '该任务无需生产合同。'}`
  state.contractPromptId = contract?.status === 'EFFECTIVE' ? contract.contractId : null
}

async function readContractFiles(input: HTMLInputElement, contractId: string): Promise<void> {
  const files = [...(input.files || [])]
  if (!files.length) return
  const uploadedAt = formatOperationLocalWallClock()
  const settled = await Promise.allSettled(files.map(async (file) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error(`${file.name}格式不支持`)
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) })
    return { fileName: file.name, mimeType: file.type as 'image/jpeg' | 'image/png', size: file.size, dataUrl, uploadedAt, uploadedBy: '生产计划员' }
  }))
  const records = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  const failed = settled.flatMap((result, index) => result.status === 'rejected' ? [files[index].name] : [])
  if (records.length) addSignedContractScans(contractId, records)
  state.failedUploadNamesByContract[contractId] = failed
  state.feedback = `扫描图上传完成：成功${records.length}张，失败${failed.length}张。成功图片不会因单图失败而丢失。`
  refreshRoot()
}

export function handleUnifiedDispatchWorkbenchEvent(target: HTMLElement, event?: Event): boolean {
  const fileInput = target.closest<HTMLInputElement>('[data-unified-contract-files]')
  if (fileInput && event?.type === 'change') {
    void readContractFiles(fileInput, fileInput.dataset.unifiedContractFiles || '').catch((error) => { state.feedback = error instanceof Error ? error.message : '上传失败'; refreshRoot() })
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-unified-field]')
  if (field) {
    const name = field.dataset.unifiedField
    if (state.dispatch && name && name in state.dispatch) {
      ;(state.dispatch as unknown as Record<string, unknown>)[name] = field instanceof HTMLInputElement && field.type === 'checkbox' ? field.checked : field.value
      state.dispatch.confirmStage = 1
      state.dispatch.error = ''
      refreshRoot()
    } else if (name === 'keyword') {
      state.keyword = field.value
      state.page = 1
      refreshRoot()
    }
    return true
  }
  const mergeField = target.closest<HTMLInputElement>('[data-unified-merge-field]')
  if (mergeField && state.merge?.mode === 'MERGE') {
    state.merge.productionOrderKeyword = mergeField.value
    state.merge.confirmStage = 1
    state.merge.error = ''
    refreshRoot()
    return true
  }
  const mergeSource = target.closest<HTMLInputElement>('[data-unified-merge-source]')
  if (mergeSource && state.merge?.mode === 'MERGE') {
    const sourceTaskId = mergeSource.dataset.unifiedMergeSource || ''
    const next = new Set(state.merge.taskIds)
    if (mergeSource.checked) next.add(sourceTaskId); else next.delete(sourceTaskId)
    state.merge.taskIds = [...next]
    state.merge.confirmStage = 1
    state.merge.error = ''
    refreshRoot()
    return true
  }
  const sku = target.closest<HTMLInputElement>('[data-unified-sku]')
  if (sku && state.dispatch) {
    if (sku.checked) state.dispatch.selectedSkuCodes.add(sku.dataset.unifiedSku || '')
    else state.dispatch.selectedSkuCodes.delete(sku.dataset.unifiedSku || '')
    state.dispatch.confirmStage = 1
    refreshRoot()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-unified-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.unifiedAction
  const taskId = actionNode.dataset.taskId || ''
  if (action === 'close-all') { state.detailTaskId = null; state.dispatch = null; state.merge = null; state.contractPromptId = null; state.uploadContractId = null; refreshRoot(); return true }
  if (action === 'switch-type') { state.taskType = actionNode.dataset.taskType as WorkbenchTaskType; state.page = 1; refreshRoot(); return true }
  if (action === 'previous-page' || action === 'prev-page') { state.page = Math.max(1, state.page - 1); refreshRoot(); return true }
  if (action === 'next-page') { state.page += 1; refreshRoot(); return true }
  if (action === 'open-detail') { state.detailTaskId = taskId; refreshRoot(); return true }
  if (action === 'close-detail') { state.detailTaskId = null; refreshRoot(); return true }
  if (action === 'open-direct' || action === 'open-bidding' || action === 'open-reassign') { openDispatch(taskId, action === 'open-direct' ? 'DIRECT' : action === 'open-reassign' ? 'REASSIGN' : 'BIDDING'); refreshRoot(); return true }
  if (action === 'close-dispatch') { state.dispatch = null; refreshRoot(); return true }
  if (action === 'back-dispatch' && state.dispatch) { state.dispatch.confirmStage = 1; refreshRoot(); return true }
  if (action === 'confirm-dispatch' && state.dispatch) {
    try {
      if (state.dispatch.mode !== 'BIDDING' && state.dispatch.confirmStage === 1) {
        if (!state.dispatch.factoryId) throw new Error('请选择承接工厂')
        if (state.dispatch.selectedSkuCodes.size === 0) throw new Error('请至少选择一个完整SKU')
        const task = getRuntimeTaskById(state.dispatch.taskId)
        if (task && classifyTaskFulfillmentPolicy(task).startsWithSewing && !state.dispatch.riskAcknowledged) throw new Error('请先确认已知悉生产准备风险')
        state.dispatch.confirmStage = 2
        if (state.dispatch.mode === 'REASSIGN' && !state.dispatch.reassignReason.trim()) throw new Error('请填写改派原因')
      } else if (state.dispatch.mode !== 'BIDDING') {
        if (state.dispatch.mode === 'REASSIGN') commitReassignment(state.dispatch)
        else commitDirectDispatch(state.dispatch)
        state.dispatch = null
      } else {
        const sourceTask = getRuntimeTaskById(state.dispatch.taskId)
        if (!sourceTask) throw new Error('任务已变化，请刷新')
        if (!state.dispatch.tenderDeadline) throw new Error('请填写竞价截止时间')
        const policy = classifyTaskFulfillmentPolicy(sourceTask)
        const sourceLines = sourceTask.scopeSkuLines.length
          ? sourceTask.scopeSkuLines
          : [{ skuCode: sourceTask.skuCode || 'SKU-ALL', color: sourceTask.skuColor || '混色', size: sourceTask.skuSize || '混码', qty: sourceTask.scopeQty }]
        const selectedLines = sourceLines.filter((line) => state.dispatch?.selectedSkuCodes.has(line.skuCode))
        if (selectedLines.length === 0) throw new Error('请至少选择一个完整SKU')
        if (policy.startsWithSewing && !state.dispatch.riskAcknowledged) throw new Error('请先确认已知悉生产准备风险')
        const tenderTask = policy.startsWithSewing && selectedLines.length < sourceLines.length
          ? allocateRuntimeSewingTaskScope({
              taskId: sourceTask.taskId,
              lines: selectedLines.map((line) => ({ skuCode: line.skuCode, qty: line.qty })),
              by: '生产计划员',
            })
          : sourceTask
        upsertRuntimeTaskTender(tenderTask.taskId, {
          tenderId: `TD-${Date.now()}`,
          biddingDeadline: toWallClock(state.dispatch.tenderDeadline),
          taskDeadline: '',
          businessAssignedAt: toWallClock(state.dispatch.businessAssignedAt),
          assignmentOperatedAt: formatOperationLocalWallClock(),
          distributionMode: state.dispatch.distributionMode,
        }, '生产计划员')
        state.feedback = `已按${state.dispatch.distributionMode === 'BAG_AWARE' ? '菲票装袋情况' : '自由分配'}为${tenderTask.taskNo || tenderTask.taskId}发起竞价；未确定工厂前不生成合同。定标时须二次确认中标价并冻结。`
        state.dispatch = null
      }
    } catch (error) { if (state.dispatch) state.dispatch.error = error instanceof Error ? error.message : '提交失败' }
    refreshRoot(); return true
  }
  if (action === 'open-merge') {
    state.merge = { mode: 'MERGE', productionOrderKeyword: '', productionOrderId: '', taskIds: [], confirmStage: 1, error: '' }
    refreshRoot(); return true
  }
  if (action === 'select-merge-order' && state.merge?.mode === 'MERGE') {
    state.merge.productionOrderId = actionNode.dataset.productionOrderId || ''
    state.merge.taskIds = []
    state.merge.confirmStage = 1
    state.merge.error = ''
    refreshRoot(); return true
  }
  if (action === 'open-cancel-merge') { state.merge = { mode: 'CANCEL', productionOrderKeyword: '', productionOrderId: '', taskIds: [taskId], mergedTaskId: taskId, confirmStage: 1, error: '' }; refreshRoot(); return true }
  if (action === 'close-merge') { state.merge = null; refreshRoot(); return true }
  if (action === 'confirm-merge' && state.merge) {
    if (state.merge.error) { refreshRoot(); return true }
    const evaluation = state.merge.mode === 'MERGE' ? evaluateFixedMergedTask(state.merge.taskIds) : null
    if (state.merge.mode === 'MERGE' && !evaluation?.ok) { state.merge.error = evaluation?.message || '请选择正确的源任务'; refreshRoot(); return true }
    if (state.merge.mode === 'MERGE' && evaluation?.mergedTaskType === 'CUTTING_SEWING_IRON_PACK') {
      const productionOrderId = evaluation.tasks[0]?.productionOrderId || ''
      const blockingOrders = listBlockingSpecialCraftTaskOrdersForMergedTask(productionOrderId)
      if (blockingOrders.length > 0) {
        state.merge.error = `已有${blockingOrders.length}张中央辅助/特种工艺加工单开始执行，不能再创建裁剪+车缝+烫包。`
        refreshRoot(); return true
      }
    }
    if (state.merge.confirmStage === 1) state.merge.confirmStage = 2
    else if (state.merge.mode === 'MERGE') {
      const merged = createFixedMergedTask(state.merge.taskIds, '生产计划员')
      if (!merged) state.merge.error = '合并失败，请核对源任务是否仍符合固定模式'
      else {
        if (merged.mergedTaskType === 'CUTTING_SEWING_IRON_PACK') {
          invalidateUnstartedSpecialCraftTaskOrdersForMergedTask({
            productionOrderId: merged.productionOrderId,
            mergedTaskId: merged.taskId,
            invalidatedAt: formatOperationLocalWallClock(),
            invalidatedBy: '生产计划员',
            reason: '辅助工艺、特种工艺随裁剪+车缝+烫包交由三方工厂执行',
          })
        }
        state.feedback = `生产单${merged.productionOrderNo || merged.productionOrderId}的${merged.mergeSourceTaskIds?.length === 2 ? '车缝任务与烫包任务' : '裁剪任务、车缝任务与烫包任务'}已合并为“${merged.processNameZh}”任务。`
        state.merge = null
      }
    } else {
      const mergedTaskId = state.merge.mergedTaskId || ''
      const mergedTask = getRuntimeTaskById(mergedTaskId)
      const result = cancelFixedMergedTask(state.merge.mergedTaskId || '', '生产计划员')
      if (!result.ok) state.merge.error = result.message
      else {
        if (mergedTask?.mergedTaskType === 'CUTTING_SEWING_IRON_PACK') {
          restoreSpecialCraftTaskOrdersAfterMergedTaskCancellation({
            mergedTaskId,
            restoredAt: formatOperationLocalWallClock(),
            restoredBy: '生产计划员',
            reason: '合并任务撤销，恢复中央辅助/特种工艺加工单',
          })
        }
        state.feedback = result.message
        state.merge = null
      }
    }
    refreshRoot(); return true
  }
  if (action === 'close-contract-prompt') { state.contractPromptId = null; refreshRoot(); return true }
  if (action === 'retry-contract') {
    try {
      const contract = retryProductionContractGeneration(actionNode.dataset.contractId || '', formatOperationLocalWallClock(), '生产计划员')
      state.feedback = `合同${contract.contractNo}重试生成成功。`
      state.contractPromptId = contract.contractId
    } catch (error) { state.feedback = error instanceof Error ? error.message : '合同重试失败' }
    refreshRoot(); return true
  }
  if (action === 'open-upload') { state.uploadContractId = actionNode.dataset.contractId || null; refreshRoot(); return true }
  if (action === 'close-upload') { state.uploadContractId = null; refreshRoot(); return true }
  if (action === 'remove-scan') {
    if (!confirm('删除扫描图片将改变合同证据，请再次确认。')) return true
    removeSignedContractScan(actionNode.dataset.contractId || '', actionNode.dataset.scanId || '')
    refreshRoot(); return true
  }
  if (action === 'reorder-scan') {
    reorderSignedContractScan(actionNode.dataset.contractId || '', actionNode.dataset.scanId || '', actionNode.dataset.direction === 'UP' ? 'UP' : 'DOWN')
    refreshRoot(); return true
  }
  if (action === 'retry-failed-scan') {
    const contractId = actionNode.dataset.contractId || ''
    document.querySelector<HTMLInputElement>(`[data-unified-contract-files="${CSS.escape(contractId)}"]`)?.click()
    return true
  }
  if (action === 'preview-image') {
    const host = document.querySelector<HTMLElement>('[data-unified-image-preview]')
    if (host) host.innerHTML = `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-6" data-unified-action="close-image"><button class="absolute right-6 top-6 rounded bg-white px-3 py-2">关闭</button><img src="${escapeHtml(actionNode.dataset.image || '')}" alt="${escapeHtml(actionNode.dataset.label || '高清预览')}" class="max-h-full max-w-full object-contain"/></div>`
    return true
  }
  if (action === 'close-image') { document.querySelector<HTMLElement>('[data-unified-image-preview]')!.innerHTML = ''; return true }
  return false
}

export function isUnifiedDispatchWorkbenchDialogOpen(): boolean {
  return Boolean(state.detailTaskId || state.dispatch || state.merge || state.contractPromptId || state.uploadContractId)
}

export function listUnifiedDispatchCurrentAssignments(taskId: string) {
  return listCurrentEffectiveTaskAssignments(taskId)
}
