import { escapeHtml } from '../../../utils.ts'

export type WaitHandoverWebAction =
  | 'bagging'
  | 'inbound'
  | 'repack'
  | 'handover'
  | 'special-craft-return'
  | 'recovery'
  | 'scrap'

export interface WaitHandoverDialogTicket {
  feiTicketId: string
  feiTicketNo: string
  productionOrderNo: string
  receiverFactoryName: string
  pieceQty: number
}

export interface WaitHandoverDialogCurrent {
  bagCode: string
  productionOrderNo: string
  mainStatus: 'IDLE' | 'IN_USE' | 'DISABLED'
  flowStage: string
  mainStatusLabel: string
  flowStageLabel: string
  tickets: WaitHandoverDialogTicket[]
  compatibilityBlockedReason: string
  latestHandoverSummary: string
}

export interface WaitHandoverDialogOption {
  value: string
  label: string
  disabled?: boolean
  selected?: boolean
}

export interface WaitHandoverActionDialogModel {
  current: WaitHandoverDialogCurrent | null
  ticketOptions: WaitHandoverDialogOption[]
  repackSources: WaitHandoverDialogOption[]
  handoverTaskOptions: WaitHandoverDialogOption[]
  handoverPpicOptions: WaitHandoverDialogOption[]
  specialCraftReturnOptions: WaitHandoverDialogOption[]
  recoveryNodeOptions: string[]
  locationOptions: WaitHandoverDialogOption[]
  feedback: string
  error: string
  repackBatchId: string
}

const ACTIONS: Array<{ action: WaitHandoverWebAction; label: string; tone: string }> = [
  { action: 'bagging', label: '菲票装袋', tone: 'bg-blue-600 text-white hover:bg-blue-700' },
  { action: 'inbound', label: '中转袋入仓', tone: 'border bg-background text-slate-700 hover:bg-muted' },
  { action: 'handover', label: '中转袋交出', tone: 'border bg-background text-slate-700 hover:bg-muted' },
  { action: 'special-craft-return', label: '特殊工艺回仓', tone: 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { action: 'recovery', label: '中转袋回收', tone: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { action: 'scrap', label: '中转袋报废', tone: 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' },
]

const TITLE: Record<WaitHandoverWebAction, string> = Object.fromEntries(
  ACTIONS.map((item) => [item.action, item.label]),
) as Record<WaitHandoverWebAction, string>

const SUBMIT: Record<WaitHandoverWebAction, string> = {
  bagging: '确认菲票装袋',
  inbound: '确认中转袋入仓',
  repack: '确认本次交出',
  handover: '确认本次交出',
  'special-craft-return': '确认特殊工艺回仓',
  recovery: '确认回收',
  scrap: '确认报废',
}

export function renderWaitHandoverActionButtons(): string {
  return `
    <div class="flex flex-nowrap items-center gap-2 overflow-x-auto" data-wait-handover-six-actions>
      <button type="button" class="h-10 shrink-0 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-skip-page-rerender="true" data-wait-handover-action="open-bagging">菲票装袋</button>
      <button type="button" class="h-10 shrink-0 rounded-md border bg-background px-4 text-sm font-medium text-slate-700 hover:bg-muted" data-skip-page-rerender="true" data-wait-handover-action="open-inbound">中转袋入仓</button>
      <button type="button" class="h-10 shrink-0 rounded-md border bg-background px-4 text-sm font-medium text-slate-700 hover:bg-muted" data-skip-page-rerender="true" data-wait-handover-action="open-handover">中转袋交出</button>
      <button type="button" class="h-10 shrink-0 rounded-md border border-violet-200 bg-violet-50 px-4 text-sm font-medium text-violet-700 hover:bg-violet-100" data-skip-page-rerender="true" data-wait-handover-action="open-special-craft-return">特殊工艺回仓</button>
      <button type="button" class="h-10 shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-100" data-skip-page-rerender="true" data-wait-handover-action="open-recovery">中转袋回收</button>
      <button type="button" class="h-10 shrink-0 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 hover:bg-rose-100" data-skip-page-rerender="true" data-wait-handover-action="open-scrap">中转袋报废</button>
    </div>
  `
}

function optionsHtml(options: WaitHandoverDialogOption[], emptyText: string): string {
  if (!options.length) return `<option value="" disabled selected>${escapeHtml(emptyText)}</option>`
  return options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.disabled ? 'disabled' : ''} ${option.selected ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')
}

function field(label: string, name: string, value = '', placeholder = ''): string {
  return `<label class="space-y-1.5"><span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" /></label>`
}

export function renderWaitHandoverBagSummary(current: WaitHandoverDialogCurrent | null): string {
  if (!current) return '<div data-wait-handover-bag-summary class="rounded-lg border border-dashed bg-muted/10 p-3 text-sm text-muted-foreground">输入或扫描袋码后，系统在这里显示当前状态和改法。</div>'
  const pieceQty = current.tickets.reduce((sum, item) => sum + item.pieceQty, 0)
  return `<div data-wait-handover-bag-summary class="rounded-lg border bg-background p-3 text-sm">
    <div class="flex flex-wrap items-center justify-between gap-2"><strong>${escapeHtml(current.bagCode)}</strong><span>${escapeHtml(`${current.mainStatusLabel}${current.flowStageLabel ? ` / ${current.flowStageLabel}` : ''}`)}</span></div>
    <div class="mt-2 text-xs text-muted-foreground">生产单 ${escapeHtml(current.productionOrderNo || '—')} · ${current.tickets.length} 张菲票 · ${pieceQty} 片</div>
    ${current.latestHandoverSummary ? `<div class="mt-2 text-xs text-muted-foreground">最近交出：${escapeHtml(current.latestHandoverSummary)}</div>` : ''}
    ${current.compatibilityBlockedReason ? `<div class="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">${escapeHtml(current.compatibilityBlockedReason)}</div>` : ''}
  </div>`
}

export function renderWaitHandoverScrapEligibility(current: WaitHandoverDialogCurrent | null): string {
  if (!current) return '<div data-wait-handover-eligibility class="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">请先输入或扫描待报废袋码。</div>'
  if (['PACKED', 'INBOUND_STORED', 'READY_HANDOVER'].includes(current.flowStage) || current.tickets.length) {
    return `<div data-wait-handover-eligibility class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><div>${escapeHtml(`${current.bagCode} 当前生产单 ${current.productionOrderNo || '待核查'}，还有 ${current.tickets.length} 张菲票，不得直接报废。`)}</div><button type="button" class="mt-2 rounded-md border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium text-violet-700" data-skip-page-rerender="true" data-wait-handover-action="open-handover" data-wait-handover-selection="${escapeHtml(current.bagCode)}">去中转袋交出处理</button></div>`
  }
  if (current.mainStatus === 'DISABLED') return `<div data-wait-handover-eligibility class="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">${escapeHtml(current.bagCode)} 已报废停用，不能重复报废。</div>`
  if (current.flowStage === 'HANDED_OVER_WAITING_RETURN') return '<div data-wait-handover-eligibility class="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">该袋已交出待回收；仅可在实物空袋已到场时选择“回收后再报废”。</div>'
  if (current.mainStatus !== 'IDLE') return '<div data-wait-handover-eligibility class="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">当前袋状态不明确，禁止报废，请主管核查。</div>'
  return '<div data-wait-handover-eligibility class="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">空闲袋可按危险动作流程报废；仍需填写原因、授权人并二次确认。</div>'
}

export interface WaitHandoverRecoveryEligibilityInput {
  bagCode: string
  physicalBagReceived: boolean
  physicalBagEmpty: boolean
  recoveryMode: 'NORMAL' | 'FORCED'
  recoveryNode: string
  recoveryLocation: string
  reason: string
  operatorName: string
  secondConfirm: boolean
}

export function renderWaitHandoverRecoveryEligibility(
  current: WaitHandoverDialogCurrent | null,
  input: WaitHandoverRecoveryEligibilityInput,
): string {
  const attr = 'data-wait-handover-recovery-eligibility'
  if (!current) return `<div ${attr} class="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">请先输入或扫描待回收袋码。</div>`
  const pieceQty = current.tickets.reduce((sum, item) => sum + item.pieceQty, 0)
  if (['PACKED', 'INBOUND_STORED', 'READY_HANDOVER'].includes(current.flowStage) || current.tickets.length) {
    return `<div ${attr} class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><div>${escapeHtml(`${current.bagCode} 当前生产单 ${current.productionOrderNo || '待核查'}，还有 ${current.tickets.length} 张菲票、${pieceQty} 片，不能回收。`)}</div><button type="button" class="mt-2 rounded-md border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium text-violet-700" data-skip-page-rerender="true" data-wait-handover-action="open-handover" data-wait-handover-selection="${escapeHtml(current.bagCode)}">去中转袋交出处理</button></div>`
  }
  if (current.mainStatus === 'DISABLED') return `<div ${attr} class="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">${escapeHtml(current.bagCode)} 已报废停用，不能回收。</div>`
  if (current.mainStatus === 'IDLE') return `<div ${attr} class="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">${escapeHtml(current.bagCode)} 当前空闲，无需回收；可直接用于下次装袋。</div>`
  if (current.flowStage !== 'HANDED_OVER_WAITING_RETURN') return `<div ${attr} class="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">当前袋不是已交出待回收状态，请先完成当前环节或叫主管核查。</div>`
  if (!input.physicalBagReceived || !input.physicalBagEmpty) return `<div ${attr} class="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">请确认实物袋已收到且袋内为空，确认后才能回收。</div>`
  if (!input.recoveryNode || !input.recoveryLocation || !input.reason || !input.operatorName || !input.secondConfirm) return `<div ${attr} class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">还需填写回收节点、位置、原因、操作人，并完成二次确认。</div>`
  const readyText = input.recoveryMode === 'FORCED'
    ? '强制回收条件与最近交出事实已核对，可以确认回收。'
    : '普通回收条件与最近交出事实已核对，可以确认回收。'
  return `<div ${attr} class="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">${readyText}</div>`
}

export function isWaitHandoverRecoveryBlocked(
  current: WaitHandoverDialogCurrent | null,
  input: WaitHandoverRecoveryEligibilityInput,
): boolean {
  if (!input.bagCode || !current || current.mainStatus === 'DISABLED') return true
  if (['PACKED', 'INBOUND_STORED', 'READY_HANDOVER'].includes(current.flowStage) || current.tickets.length) return true
  if (current.flowStage !== 'HANDED_OVER_WAITING_RETURN') return true
  if (!input.physicalBagReceived || !input.physicalBagEmpty) return true
  return !input.recoveryNode
    || !input.recoveryLocation
    || !input.reason
    || !input.operatorName
    || !input.secondConfirm
}

export interface WaitHandoverScrapEligibilityInput {
  recoverFirst: boolean
  physicalBagReceived: boolean
  physicalBagEmpty: boolean
  reason: string
  authorizedBy: string
  operatorName: string
  secondConfirm: boolean
}

export function isWaitHandoverScrapBlocked(
  current: WaitHandoverDialogCurrent | null,
  input: WaitHandoverScrapEligibilityInput = {
    recoverFirst: false,
    physicalBagReceived: false,
    physicalBagEmpty: false,
    reason: '',
    authorizedBy: '',
    operatorName: '',
    secondConfirm: false,
  },
): boolean {
  if (!current) return true
  if (['PACKED', 'INBOUND_STORED', 'READY_HANDOVER'].includes(current.flowStage) || current.tickets.length) return true
  if (current.mainStatus === 'DISABLED') return true
  const commonMissing = !input.reason || !input.authorizedBy || !input.operatorName || !input.secondConfirm
  if (current.flowStage === 'HANDED_OVER_WAITING_RETURN') {
    return !input.recoverFirst || !input.physicalBagReceived || !input.physicalBagEmpty || commonMissing
  }
  if (current.mainStatus === 'IDLE') return commonMissing
  return true
}

function bagSummary(model: WaitHandoverActionDialogModel): string {
  return renderWaitHandoverBagSummary(model.current)
}

function baggingContent(model: WaitHandoverActionDialogModel, bagCode: string): string {
  return `<div class="space-y-4">
    <section class="grid gap-3 md:grid-cols-2">${field('中转袋二维码 / 袋码', 'bagCode', bagCode, '扫码或输入中转袋编号')}${renderWaitHandoverBagSummary(model.current)}</section>
    <section class="space-y-2"><label class="space-y-1.5"><span class="text-sm font-medium">待装袋菲票</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-wait-handover-field="feiTicketId">${optionsHtml(model.ticketOptions, '暂无可装袋菲票')}</select></label>${field('菲票码（可多张）', 'ticketScanInput', '', '空格、换行或顿号分隔')}</section>
    <section class="grid gap-3 md:grid-cols-2">${field('操作人', 'operatorName', '裁床装袋员')}${field('强制回收原因', 'forceRecoveryReason', '', '仅线上已交出、实物空袋在场时填写')}</section>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="physicalBagReceived" />实物袋已收到</label>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="physicalBagEmpty" />实物袋为空</label>
  </div>`
}

function inboundContent(model: WaitHandoverActionDialogModel, bagCode: string): string {
  return `<div class="space-y-4">
    <section class="grid gap-3 md:grid-cols-2">${field('中转袋二维码 / 袋码', 'bagCode', bagCode, '扫码或输入中转袋编号')}${renderWaitHandoverBagSummary(model.current)}</section>
    <section class="grid gap-3 md:grid-cols-2">${field('库区', 'warehouseArea', '', '扫码或选择库区')}${field('库位', 'locationCode', '', '扫码或选择库位')}</section>
    <section class="grid gap-3 md:grid-cols-2">${field('操作人', 'operatorName', '裁床仓管')}${field('备注', 'remark')}</section>
  </div>`
}

function repackContent(model: WaitHandoverActionDialogModel): string {
  const selectedSources = model.repackSources.map((item) => ({
    ...item,
    selected: item.value === model.current?.bagCode,
  }))
  const sourceOptions = selectedSources.length
    ? optionsHtml(selectedSources, '当前没有可重装来源袋')
    : '<option value="" disabled>当前没有可重装来源袋</option>'
  return `<div class="min-w-0 space-y-4" data-wait-handover-repack-workspace>
    <section class="rounded-lg border bg-slate-50 p-4" data-wait-handover-repack-progress>
      <div class="flex items-center justify-between gap-3"><div class="font-semibold">中转袋交出进度</div><div class="text-sm font-medium text-violet-700" data-wait-handover-repack-progress-label>第 1 步，共 5 步</div></div>
      <div class="mt-3 grid grid-cols-5 gap-2 text-center text-[11px] text-muted-foreground">${['确定车缝任务', '核对相关中转袋', '直接交出或重装', '剩余来源袋', '汇总确认'].map((label, index) => `<div class="rounded-md border bg-background px-1 py-2" data-wait-handover-repack-progress-step="${index + 1}"><span class="block font-semibold">${index + 1}</span><span>${label}</span></div>`).join('')}</div>
    </section>
    <section class="rounded-lg border border-violet-200 bg-violet-50/30 p-4" data-wait-handover-repack-step="sources">
      <div class="flex items-start gap-3"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">1</span><div><h3 class="font-semibold">1 确定生产单和车缝任务</h3><p class="mt-1 text-xs text-muted-foreground">可以直接填写车缝任务编号，或填写生产单后选择接收车缝工厂。</p></div></div>
      <div class="mt-4 grid gap-3 md:grid-cols-2">${field('车缝任务编号', 'handoverTaskNo', '', '手工填写车缝任务编号')}<label class="space-y-1.5"><span class="text-sm font-medium">可选车缝任务</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-skip-page-rerender="true" data-wait-handover-field="handoverTaskSelection"><option value="">请选择</option>${optionsHtml(model.handoverTaskOptions, '暂无可用车缝任务')}</select></label>${field('生产单号', 'handoverProductionOrderNo', '', '也可先填写生产单号')}${field('接收车缝工厂', 'handoverReceiverFactoryName', '', '生产单方式下填写或选择工厂')}<label class="space-y-1.5 md:col-span-2"><span class="text-sm font-medium">交出接收人（PPIC）</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-skip-page-rerender="true" data-wait-handover-field="handoverPpicSelection"><option value="">请先选择车缝任务</option></select></label></div>
      <select multiple class="hidden" data-wait-handover-field="sourceBagCodes">${sourceOptions}</select>
      <div class="mt-4 space-y-2" data-wait-handover-repack-selected-sources><div class="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">确定车缝任务后，系统自动查找目标菲票所在的全部中转袋。</div></div>
      <div class="mt-3 hidden" data-wait-handover-repack-direct-handover></div>
      <input type="hidden" data-wait-handover-field="handoverBatchId" value="WEB-HANDOVER-${Date.now()}" /><div class="mt-4 flex justify-end"><button type="button" class="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white" data-skip-page-rerender="true" data-wait-handover-action="repack-next">下一步：核对相关中转袋</button></div>
    </section>
    <section class="hidden rounded-lg border p-4" data-wait-handover-repack-step="groups"><div class="flex items-start gap-3"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">2</span><div><h3 class="font-semibold">2 核对目标菲票和相关中转袋</h3><p class="mt-1 text-xs text-muted-foreground">袋内全部菲票属于当前任务时可直接交出；存在其他菲票时正常进入拆袋重装，不作为异常。</p></div></div><div class="mt-4 space-y-3" data-wait-handover-repack-group-preview></div><div class="mt-4 flex justify-between gap-2"><button type="button" class="rounded-md border px-4 py-2 text-sm" data-skip-page-rerender="true" data-wait-handover-action="repack-back">上一步</button><button type="button" class="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white" data-skip-page-rerender="true" data-wait-handover-action="repack-next">下一步：处理交出袋</button></div></section>
    <section class="hidden rounded-lg border p-4" data-wait-handover-repack-step="results"><div class="flex items-start gap-3"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">3</span><div><h3 class="font-semibold">3 直接交出或指定结果袋</h3><p class="mt-1 text-xs text-muted-foreground">完整袋由系统直接交出；需要重装时新增或复用结果袋，并把当前任务菲票全部装入结果袋。</p></div></div><div class="mt-4 space-y-4" data-wait-handover-repack-results></div><div class="hidden" data-wait-handover-repack-ticket-assignments></div><div class="mt-4 flex justify-between gap-2"><button type="button" class="rounded-md border px-4 py-2 text-sm" data-skip-page-rerender="true" data-wait-handover-action="repack-back">上一步</button><button type="button" class="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white" data-skip-page-rerender="true" data-wait-handover-action="repack-next">下一步：处理剩余来源袋</button></div></section>
    <section class="hidden rounded-lg border p-4" data-wait-handover-repack-step="returns"><div class="flex items-start gap-3"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">4</span><div><h3 class="font-semibold">4 处理剩余来源袋</h3><p class="mt-1 text-xs text-muted-foreground">未作为结果袋且仍有菲票的来源袋必须重新入仓；默认原库位，可以修改。</p></div></div><div class="mt-4 space-y-3" data-wait-handover-repack-source-returns></div><div class="mt-4 flex justify-between gap-2"><button type="button" class="rounded-md border px-4 py-2 text-sm" data-skip-page-rerender="true" data-wait-handover-action="repack-back">上一步</button><button type="button" class="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white" data-skip-page-rerender="true" data-wait-handover-action="repack-next">下一步：汇总确认</button></div></section>
    <section class="hidden rounded-lg border p-4" data-wait-handover-repack-step="confirm"><div class="flex items-start gap-3"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">5</span><div><h3 class="font-semibold">5 汇总并确认</h3><p class="mt-1 text-xs text-muted-foreground">核对结果袋、重新入仓来源袋、空闲袋以及菲票和裁片数量；确认后结果袋直接交出。</p></div></div><div class="mt-4" data-wait-handover-repack-total-preview></div><div class="mt-3 rounded-md bg-blue-50 p-3 text-xs text-blue-800">系统先完成重装，再逐只交出结果袋；剩余来源袋完成入仓；清空来源袋变为空闲。</div><label class="mt-3 block space-y-1.5"><span class="text-sm font-medium">操作人（当前）</span><input class="h-10 w-full rounded-md border bg-muted/20 px-3 text-sm" data-wait-handover-field="operatorName" value="裁片仓重装员" readonly /></label><input type="hidden" data-wait-handover-field="repackBatchId" value="${escapeHtml(model.repackBatchId)}" /><div class="mt-4"><button type="button" class="rounded-md border px-4 py-2 text-sm" data-skip-page-rerender="true" data-wait-handover-action="repack-back">上一步</button></div></section>
  </div>`
}

function handoverContent(model: WaitHandoverActionDialogModel): string {
  return repackContent(model)
}

function specialCraftReturnContent(model: WaitHandoverActionDialogModel): string {
  return `<div class="space-y-4"><label class="space-y-1.5"><span class="text-sm font-medium">来源特殊工艺交出记录</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-wait-handover-field="specialCraftSource">${optionsHtml(model.specialCraftReturnOptions, '暂无特殊工艺待回仓记录')}</select></label>${field('中转袋编号', 'bagCode', '', '手工填写回仓中转袋编号')}${field('回仓菲票编号', 'returnedTicketIds', '', '多张菲票用空格分隔')}<section class="grid gap-3 md:grid-cols-2">${field('库区', 'warehouseArea', '', '填写回仓库区')}${field('库位', 'locationCode', '', '填写回仓库位')}${field('操作人', 'operatorName', '特殊工艺回仓员')}</section></div>`
}

function recoveryContent(model: WaitHandoverActionDialogModel, bagCode: string): string {
  const initial = { bagCode, physicalBagReceived: false, physicalBagEmpty: false, recoveryMode: 'NORMAL' as const, recoveryNode: model.recoveryNodeOptions[0] || '裁床待交出仓', recoveryLocation: '空袋回收区', reason: '', operatorName: '空袋回收员', secondConfirm: false }
  return `<div class="space-y-4"><section class="grid gap-3 md:grid-cols-2">${field('中转袋二维码 / 袋码', 'bagCode', bagCode, '只扫描实物已在手上的空袋')}${bagSummary(model)}</section>${renderWaitHandoverRecoveryEligibility(model.current, initial)}<fieldset class="grid gap-3 md:grid-cols-2"><label class="rounded-lg border p-3 text-sm"><input type="radio" name="recoveryMode" value="NORMAL" checked data-wait-handover-field="recoveryMode" /> <strong>普通回收</strong><span class="mt-1 block text-xs text-muted-foreground">后道或裁床收到实物空袋。</span></label><label class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><input type="radio" name="recoveryMode" value="FORCED" data-wait-handover-field="recoveryMode" /> <strong>强制回收</strong><span class="mt-1 block text-xs text-amber-800">只允许已交出待回收且实物空袋在场，并核对最近交出事实。</span></label></fieldset><div class="grid gap-3 md:grid-cols-2"><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="physicalBagReceived" />实物袋已收到</label><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="physicalBagEmpty" />实物袋为空</label></div><section class="grid gap-3 md:grid-cols-2">${field('回收节点', 'recoveryNode', model.recoveryNodeOptions[0] || '裁床待交出仓')}${field('回收位置', 'recoveryLocation', '空袋回收区')}${field('回收原因', 'reason', '', '普通与强制回收均必填')}${field('操作人', 'operatorName', '空袋回收员')}</section><label class="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><input type="checkbox" data-wait-handover-field="secondConfirm" />回收二次确认：已核对袋码、实物空袋、节点、位置和原因</label></div>`
}

function scrapContent(model: WaitHandoverActionDialogModel, bagCode: string): string {
  return `<div class="space-y-4"><section class="grid gap-3 md:grid-cols-2">${field('中转袋二维码 / 袋码', 'bagCode', bagCode, '扫描待报废空袋')}${bagSummary(model)}</section><div class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">使用中的袋不得报废；如有生产单或菲票，请先通过中转袋交出完成菲票转移。已交出空袋可选择回收后再报废，系统连续写入两条事实。</div><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="recoverFirst" />回收后再报废</label><div class="grid gap-3 md:grid-cols-2"><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="physicalBagReceived" />实物袋已收到</label><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="physicalBagEmpty" />实物袋为空</label></div><section class="grid gap-3 md:grid-cols-2">${field('报废原因', 'reason', '', '说明破损或不可继续使用原因')}${field('授权人', 'authorizedBy', '', '主管姓名')}${field('操作人', 'operatorName', '中转袋主管')}${field('回收节点 / 位置', 'recoveryNode', '裁床待交出仓 / 报废区')}</section><label class="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900"><input type="checkbox" data-wait-handover-field="secondConfirm" />报废二次确认：已核对袋码、实物空袋和报废原因</label></div>`
}

export function renderWaitHandoverActionDialog(input: {
  action: WaitHandoverWebAction
  bagCode: string
  model: WaitHandoverActionDialogModel
}): string {
  const { action, bagCode, model } = input
  const content = action === 'bagging' ? baggingContent(model, bagCode)
    : action === 'inbound' ? inboundContent(model, bagCode) // 中转袋二维码 / 袋码、库区、库位
      : action === 'repack' ? repackContent(model)
        : action === 'handover' ? handoverContent(model)
          : action === 'special-craft-return' ? specialCraftReturnContent(model)
            : action === 'recovery' ? recoveryContent(model, bagCode)
            : scrapContent(model, bagCode)
  const actionContent = action === 'scrap'
    ? `${content}${renderWaitHandoverScrapEligibility(model.current)}`
    : content
  const submitDisabled = action === 'repack'
    ? true
    : action === 'recovery'
    ? isWaitHandoverRecoveryBlocked(model.current, { bagCode, physicalBagReceived: false, physicalBagEmpty: false, recoveryMode: 'NORMAL', recoveryNode: model.recoveryNodeOptions[0] || '裁床待交出仓', recoveryLocation: '空袋回收区', reason: '', operatorName: '空袋回收员', secondConfirm: false })
    : action === 'scrap' && isWaitHandoverScrapBlocked(model.current)
  const wide = action === 'repack' || action === 'handover' ? 'w-[min(1180px,calc(100vw-32px))]' : 'w-[min(760px,calc(100vw-32px))]'
  return `<div id="cutting-wait-handover-web-action-modal" class="fixed inset-0 z-[130]" data-skip-page-rerender="true" data-wait-handover-modal="${action}">
    <button type="button" class="absolute inset-0 bg-black/45" data-skip-page-rerender="true" data-wait-handover-action="close-dialog" aria-label="关闭"></button>
    <section class="absolute left-1/2 top-1/2 flex max-h-[calc(100vh-24px)] ${wide} -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
      <header class="flex shrink-0 items-center justify-between border-b px-5 py-4"><div><h2 class="text-base font-semibold">${TITLE[action]}</h2><p class="mt-1 text-xs text-muted-foreground">Web 端手工填写为主；失败会保留当前输入。</p></div><button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-skip-page-rerender="true" data-wait-handover-action="close-dialog">关闭</button></header>
      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">${actionContent}<div class="mt-4 ${model.error ? 'border-rose-300 bg-rose-50 text-rose-800' : model.feedback ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'hidden'} rounded-lg border p-3 text-sm" role="status" data-wait-handover-feedback>${escapeHtml(model.error || model.feedback)}</div></div>
      <footer class="flex shrink-0 items-center justify-between gap-3 border-t bg-background px-5 py-4"><span class="text-xs text-muted-foreground">重复双击不会新增第二条业务事实。</span><div class="flex gap-2"><button type="button" class="h-10 rounded-md border px-4 text-sm" data-skip-page-rerender="true" data-wait-handover-action="close-dialog">取消</button><button type="button" class="h-10 rounded-md ${action === 'repack' || action === 'handover' ? 'hidden' : ''} ${action === 'scrap' ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300'} px-4 text-sm font-medium text-white" data-skip-page-rerender="true" data-wait-handover-submit-disabled="${submitDisabled ? 'true' : 'false'}" data-wait-handover-action="submit-${action}" ${submitDisabled ? 'disabled' : ''}>${SUBMIT[action]}</button><button type="button" class="hidden h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:bg-slate-300" data-skip-page-rerender="true" data-wait-handover-submit-disabled="true" data-wait-handover-action="submit-repack" disabled>确认本次交出</button></div></footer>
    </section>
  </div>`
}
