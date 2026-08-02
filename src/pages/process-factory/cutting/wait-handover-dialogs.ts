import { escapeHtml } from '../../../utils.ts'

export type WaitHandoverWebAction =
  | 'bagging'
  | 'inbound'
  | 'repack'
  | 'handover'
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
}

export interface WaitHandoverActionDialogModel {
  current: WaitHandoverDialogCurrent | null
  ticketOptions: WaitHandoverDialogOption[]
  repackSources: WaitHandoverDialogOption[]
  handoverOptions: WaitHandoverDialogOption[]
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
  { action: 'repack', label: '拆袋重装', tone: 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { action: 'handover', label: '中转袋交出', tone: 'border bg-background text-slate-700 hover:bg-muted' },
  { action: 'recovery', label: '中转袋回收', tone: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { action: 'scrap', label: '中转袋报废', tone: 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' },
]

const TITLE: Record<WaitHandoverWebAction, string> = Object.fromEntries(
  ACTIONS.map((item) => [item.action, item.label]),
) as Record<WaitHandoverWebAction, string>

const SUBMIT: Record<WaitHandoverWebAction, string> = {
  bagging: '确认菲票装袋',
  inbound: '确认中转袋入仓',
  repack: '确认重装',
  handover: '确认整袋交出',
  recovery: '确认回收',
  scrap: '确认报废',
}

export function renderWaitHandoverActionButtons(): string {
  return `
    <div class="flex flex-nowrap items-center gap-2 overflow-x-auto" data-wait-handover-six-actions>
      <button type="button" class="h-10 shrink-0 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-skip-page-rerender="true" data-wait-handover-action="open-bagging">菲票装袋</button>
      <button type="button" class="h-10 shrink-0 rounded-md border bg-background px-4 text-sm font-medium text-slate-700 hover:bg-muted" data-skip-page-rerender="true" data-wait-handover-action="open-inbound">中转袋入仓</button>
      <button type="button" class="h-10 shrink-0 rounded-md border border-violet-200 bg-violet-50 px-4 text-sm font-medium text-violet-700 hover:bg-violet-100" data-skip-page-rerender="true" data-wait-handover-action="open-repack">拆袋重装</button>
      <button type="button" class="h-10 shrink-0 rounded-md border bg-background px-4 text-sm font-medium text-slate-700 hover:bg-muted" data-skip-page-rerender="true" data-wait-handover-action="open-handover">中转袋交出</button>
      <button type="button" class="h-10 shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-100" data-skip-page-rerender="true" data-wait-handover-action="open-recovery">中转袋回收</button>
      <button type="button" class="h-10 shrink-0 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 hover:bg-rose-100" data-skip-page-rerender="true" data-wait-handover-action="open-scrap">中转袋报废</button>
    </div>
  `
}

function optionsHtml(options: WaitHandoverDialogOption[], emptyText: string): string {
  if (!options.length) return `<option value="" disabled selected>${escapeHtml(emptyText)}</option>`
  return options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.disabled ? 'disabled' : ''}>${escapeHtml(option.label)}</option>`).join('')
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
    return `<div data-wait-handover-eligibility class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><div>${escapeHtml(`${current.bagCode} 当前生产单 ${current.productionOrderNo || '待核查'}，还有 ${current.tickets.length} 张菲票，不得直接报废。`)}</div><button type="button" class="mt-2 rounded-md border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium text-violet-700" data-skip-page-rerender="true" data-wait-handover-action="open-repack" data-wait-handover-selection="${escapeHtml(current.bagCode)}">去拆袋重装</button></div>`
  }
  if (current.mainStatus === 'DISABLED') return `<div data-wait-handover-eligibility class="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">${escapeHtml(current.bagCode)} 已报废停用，不能重复报废。</div>`
  if (current.flowStage === 'HANDED_OVER_WAITING_RETURN') return '<div data-wait-handover-eligibility class="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">该袋已交出待回收；仅可在实物空袋已到场时选择“回收后再报废”。</div>'
  if (current.mainStatus !== 'IDLE') return '<div data-wait-handover-eligibility class="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">当前袋状态不明确，禁止报废，请主管核查。</div>'
  return '<div data-wait-handover-eligibility class="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">空闲袋可按危险动作流程报废；仍需填写原因、授权人并二次确认。</div>'
}

export function isWaitHandoverScrapBlocked(current: WaitHandoverDialogCurrent | null): boolean {
  if (!current) return true
  if (['PACKED', 'INBOUND_STORED', 'READY_HANDOVER'].includes(current.flowStage) || current.tickets.length) return true
  if (current.mainStatus === 'DISABLED') return true
  return current.mainStatus !== 'IDLE' && current.flowStage !== 'HANDED_OVER_WAITING_RETURN'
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
    <section class="rounded-lg border bg-blue-50/50 p-3"><div class="text-sm font-semibold">特殊工艺带袋回仓（识别后分支）</div><div class="mt-1 text-xs text-muted-foreground">识别到开放中的特殊工艺交出后，仍由“确认中转袋入仓”恢复原袋原票；空袋请去中转袋回收。</div><select class="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm" data-wait-handover-field="specialCraftSource"><option value="">普通中转袋入仓</option>${optionsHtml(model.specialCraftReturnOptions, '暂无特殊工艺待回仓记录')}</select>${field('回仓菲票编号', 'returnedTicketIds', '', '多张菲票用空格分隔')}</section>
    <section class="grid gap-3 md:grid-cols-2">${field('库区', 'warehouseArea', '', '扫码或选择库区')}${field('库位', 'locationCode', '', '扫码或选择库位')}</section>
    <section class="grid gap-3 md:grid-cols-2">${field('操作人', 'operatorName', '裁床仓管')}${field('备注', 'remark')}</section>
  </div>`
}

function repackContent(model: WaitHandoverActionDialogModel): string {
  const sources = model.repackSources.length
    ? optionsHtml(model.repackSources, '暂无可重装来源袋')
    : '<option value="" disabled>暂无可重装来源袋</option>'
  return `<div class="grid min-w-0 gap-4 xl:grid-cols-2" data-wait-handover-repack-workspace>
    <section class="rounded-lg border p-4"><h3 class="font-semibold">来源袋 / 菲票</h3><p class="mt-1 text-xs text-muted-foreground">可选多个来源袋；每张当前菲票只能进入一个结果袋。</p><select multiple size="7" class="mt-3 w-full rounded-md border bg-background p-2 text-sm" data-wait-handover-field="sourceBagCodes">${sources}</select><div class="mt-2 text-xs text-muted-foreground">第 1 页 / 共 1 页 · 每页 20 条</div></section>
    <section class="rounded-lg border p-4"><h3 class="font-semibold">按接收车缝工厂分组</h3><p class="mt-1 text-xs text-muted-foreground">系统只展示事实分组；最终以每张菲票选择的结果袋为准。</p><div class="mt-3 whitespace-pre-line rounded-md bg-muted/20 p-3 text-sm" data-wait-handover-repack-group-preview>请选择来源袋，系统将显示生产单、接收车缝工厂、菲票张数和裁片片数。</div><div class="mt-3 space-y-2" data-wait-handover-repack-ticket-assignments></div></section>
    <section class="rounded-lg border p-4"><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">结果袋 / 复用旧袋</h3><p class="mt-1 text-xs text-muted-foreground">可新增多个结果袋，也可填写本次来源袋码复用旧袋。</p></div><button type="button" class="shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium text-violet-700" data-skip-page-rerender="true" data-wait-handover-action="add-repack-result">新增结果袋</button></div><div class="mt-3 space-y-2" data-wait-handover-repack-results></div></section>
    <section class="rounded-lg border p-4"><h3 class="font-semibold">合计与确认</h3><div class="mt-3 grid grid-cols-2 gap-2 text-sm" data-wait-handover-repack-total-preview><div class="rounded bg-muted/20 p-3">来源：系统自动汇总张数 / 片数</div><div class="rounded bg-muted/20 p-3">结果：确认前校验数量守恒</div></div><div class="mt-3 text-xs text-muted-foreground">重装和交出是两个独立确认；非空结果袋进入待交出，不再重新入仓。</div>${field('操作人', 'operatorName', '裁片仓重装员')}<input type="hidden" data-wait-handover-field="repackBatchId" value="${escapeHtml(model.repackBatchId)}" /></section>
  </div>`
}

function handoverContent(model: WaitHandoverActionDialogModel): string {
  return `<div class="space-y-4"><label class="space-y-1.5"><span class="text-sm font-medium">待交出整袋</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-wait-handover-field="handoverSelection">${optionsHtml(model.handoverOptions, '暂无同一接收工厂的可交出整袋')}</select></label><div class="rounded-lg border bg-muted/10 p-3 text-sm">一次只交出一个完整中转袋。同袋可包含多个车缝任务，但必须属于唯一接收车缝工厂；跨工厂请先拆袋重装。</div>${field('操作人', 'operatorName', '交出仓管')}</div>`
}

function recoveryContent(model: WaitHandoverActionDialogModel, bagCode: string): string {
  return `<div class="space-y-4"><section class="grid gap-3 md:grid-cols-2">${field('中转袋二维码 / 袋码', 'bagCode', bagCode, '只扫描实物已在手上的空袋')}${bagSummary(model)}</section><fieldset class="grid gap-3 md:grid-cols-2"><label class="rounded-lg border p-3 text-sm"><input type="radio" name="recoveryMode" value="NORMAL" checked data-wait-handover-field="recoveryMode" /> <strong>普通回收</strong><span class="mt-1 block text-xs text-muted-foreground">后道或裁床收到实物空袋。</span></label><label class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><input type="radio" name="recoveryMode" value="FORCED" data-wait-handover-field="recoveryMode" /> <strong>强制回收</strong><span class="mt-1 block text-xs text-amber-800">只允许已交出待回收且实物空袋在场。</span></label></fieldset><div class="grid gap-3 md:grid-cols-2"><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="physicalBagReceived" />实物袋已收到</label><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="physicalBagEmpty" />实物袋为空</label></div><section class="grid gap-3 md:grid-cols-2">${field('回收节点', 'recoveryNode', model.recoveryNodeOptions[0] || '裁床待交出仓')}${field('回收位置', 'recoveryLocation', '空袋回收区')}${field('强制回收原因', 'reason', '', '强制回收时必填')}${field('操作人', 'operatorName', '空袋回收员')}</section><label class="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><input type="checkbox" data-wait-handover-field="secondConfirm" />强制回收二次确认：实物袋在我手上并且为空</label></div>`
}

function scrapContent(model: WaitHandoverActionDialogModel, bagCode: string): string {
  return `<div class="space-y-4"><section class="grid gap-3 md:grid-cols-2">${field('中转袋二维码 / 袋码', 'bagCode', bagCode, '扫描待报废空袋')}${bagSummary(model)}</section><div class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">使用中的袋不得报废；如有生产单或菲票，请先拆袋重装。已交出空袋可选择回收后再报废，系统连续写入两条事实。</div><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="recoverFirst" />回收后再报废</label><div class="grid gap-3 md:grid-cols-2"><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="physicalBagReceived" />实物袋已收到</label><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-wait-handover-field="physicalBagEmpty" />实物袋为空</label></div><section class="grid gap-3 md:grid-cols-2">${field('报废原因', 'reason', '', '说明破损或不可继续使用原因')}${field('授权人', 'authorizedBy', '', '主管姓名')}${field('操作人', 'operatorName', '中转袋主管')}${field('回收节点 / 位置', 'recoveryNode', '裁床待交出仓 / 报废区')}</section><label class="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900"><input type="checkbox" data-wait-handover-field="secondConfirm" />报废二次确认：已核对袋码、实物空袋和报废原因</label></div>`
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
          : action === 'recovery' ? recoveryContent(model, bagCode)
            : scrapContent(model, bagCode)
  const actionContent = action === 'scrap'
    ? `${content}${renderWaitHandoverScrapEligibility(model.current)}`
    : content
  const submitDisabled = action === 'scrap' && isWaitHandoverScrapBlocked(model.current)
  const wide = action === 'repack' ? 'w-[min(1180px,calc(100vw-32px))]' : 'w-[min(760px,calc(100vw-32px))]'
  return `<div id="cutting-wait-handover-web-action-modal" class="fixed inset-0 z-[130]" data-skip-page-rerender="true" data-wait-handover-modal="${action}">
    <button type="button" class="absolute inset-0 bg-black/45" data-skip-page-rerender="true" data-wait-handover-action="close-dialog" aria-label="关闭"></button>
    <section class="absolute left-1/2 top-1/2 flex max-h-[calc(100vh-24px)] ${wide} -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
      <header class="flex shrink-0 items-center justify-between border-b px-5 py-4"><div><h2 class="text-base font-semibold">${TITLE[action]}</h2><p class="mt-1 text-xs text-muted-foreground">扫码优先，手工输入兜底；失败会保留当前输入。</p></div><button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-skip-page-rerender="true" data-wait-handover-action="close-dialog">关闭</button></header>
      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">${actionContent}<div class="mt-4 ${model.error ? 'border-rose-300 bg-rose-50 text-rose-800' : model.feedback ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'hidden'} rounded-lg border p-3 text-sm" role="status" data-wait-handover-feedback>${escapeHtml(model.error || model.feedback)}</div></div>
      <footer class="flex shrink-0 items-center justify-between gap-3 border-t bg-background px-5 py-4"><span class="text-xs text-muted-foreground">重复双击不会新增第二条业务事实。</span><div class="flex gap-2"><button type="button" class="h-10 rounded-md border px-4 text-sm" data-skip-page-rerender="true" data-wait-handover-action="close-dialog">取消</button><button type="button" class="h-10 rounded-md ${action === 'scrap' ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300' : 'bg-blue-600 hover:bg-blue-700'} px-4 text-sm font-medium text-white" data-skip-page-rerender="true" data-wait-handover-submit-disabled="${submitDisabled ? 'true' : 'false'}" data-wait-handover-action="submit-${action}" ${submitDisabled ? 'disabled' : ''}>${SUBMIT[action]}</button></div></footer>
    </section>
  </div>`
}
