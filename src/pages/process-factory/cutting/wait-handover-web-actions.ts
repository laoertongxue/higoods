// @page-pattern: form
import { renderButton } from '../../../components/ui/button.ts'
import { escapeHtml } from '../../../utils.ts'

export type WaitHandoverWebAction = 'bagging' | 'inbound' | 'handover'

export interface WaitHandoverWebFormState {
  bagCode: string
  ticketCodes: string[]
  locationCode: string
  sewingTaskCode: string
  productionOrderNo: string
  receiverFactoryName: string
  resultMessage: string
  errorMessage: string
}

export interface WaitHandoverWebCandidates {
  bags: Array<{
    bagCode: string
    productionOrderNo: string
    ticketCodes: string[]
    status: '待装袋' | '已装袋待入仓' | '已入待交出仓' | '已交出' | '已作废'
    locationCode?: string
    boundSewingTaskCode?: string
  }>
  tickets: Array<{
    ticketCode: string
    productionOrderNo: string
    status: '可装袋' | '已装袋' | '已作废'
  }>
  sewingTasks: Array<{
    sewingTaskCode: string
    productionOrderNo: string
    receiverFactoryName: string
    receivable: boolean
  }>
}

export type WaitHandoverWebCommand =
  | { type: 'add-ticket'; ticketCode: string }
  | { type: 'resolve-handover' }
  | { type: 'submit'; action: WaitHandoverWebAction }

export interface WaitHandoverWebCommandResult {
  ok: boolean
  state: WaitHandoverWebFormState
  candidates: WaitHandoverWebCandidates
}

const initialCandidates: WaitHandoverWebCandidates = {
  bags: [
    { bagCode: 'WEB-BAG-001', productionOrderNo: '', ticketCodes: [], status: '待装袋' },
    {
      bagCode: 'WEB-BAG-002',
      productionOrderNo: 'PO-H000123',
      ticketCodes: ['WEB-FEI-IN-001'],
      status: '已装袋待入仓',
    },
    {
      bagCode: 'WEB-BAG-003',
      productionOrderNo: 'PO-H000123',
      ticketCodes: ['WEB-FEI-OUT-001', 'WEB-FEI-OUT-002'],
      status: '已入待交出仓',
      locationCode: '裁床仓 A-01',
    },
    {
      bagCode: 'WEB-BAG-004',
      productionOrderNo: 'PO-H000124',
      ticketCodes: ['WEB-FEI-CROSS-001'],
      status: '已入待交出仓',
      locationCode: '裁床仓 A-02',
    },
    {
      bagCode: 'WEB-BAG-DONE',
      productionOrderNo: 'PO-H000123',
      ticketCodes: ['WEB-FEI-DONE-001'],
      status: '已交出',
      boundSewingTaskCode: 'SEW-TASK-001',
    },
  ],
  tickets: [
    { ticketCode: 'WEB-FEI-001', productionOrderNo: 'PO-H000123', status: '可装袋' },
    { ticketCode: 'WEB-FEI-002', productionOrderNo: 'PO-H000123', status: '可装袋' },
    { ticketCode: 'WEB-FEI-003', productionOrderNo: 'PO-H000124', status: '可装袋' },
    { ticketCode: 'WEB-FEI-IN-001', productionOrderNo: 'PO-H000123', status: '已装袋' },
    { ticketCode: 'WEB-FEI-OUT-001', productionOrderNo: 'PO-H000123', status: '已装袋' },
    { ticketCode: 'WEB-FEI-OUT-002', productionOrderNo: 'PO-H000123', status: '已装袋' },
    { ticketCode: 'WEB-FEI-CROSS-001', productionOrderNo: 'PO-H000124', status: '已装袋' },
    { ticketCode: 'WEB-FEI-DONE-001', productionOrderNo: 'PO-H000123', status: '已装袋' },
  ],
  sewingTasks: [
    {
      sewingTaskCode: 'SEW-TASK-001',
      productionOrderNo: 'PO-H000123',
      receiverFactoryName: '印尼一厂',
      receivable: true,
    },
    {
      sewingTaskCode: 'SEW-TASK-002',
      productionOrderNo: 'PO-H000124',
      receiverFactoryName: '印尼二厂',
      receivable: true,
    },
    {
      sewingTaskCode: 'SEW-TASK-CLOSED',
      productionOrderNo: 'PO-H000123',
      receiverFactoryName: '印尼一厂',
      receivable: false,
    },
  ],
}

function cloneCandidates(candidates: WaitHandoverWebCandidates): WaitHandoverWebCandidates {
  return {
    bags: candidates.bags.map((bag) => ({ ...bag, ticketCodes: [...bag.ticketCodes] })),
    tickets: candidates.tickets.map((ticket) => ({ ...ticket })),
    sewingTasks: candidates.sewingTasks.map((task) => ({ ...task })),
  }
}

let runtimeCandidates = cloneCandidates(initialCandidates)
let activeAction: WaitHandoverWebAction = 'bagging'
const WAIT_HANDOVER_WEB_MODAL_ID = 'cutting-wait-handover-focused-action-modal'
const runtimeStates: Record<WaitHandoverWebAction, WaitHandoverWebFormState> = {
  bagging: createWaitHandoverWebFormState(),
  inbound: createWaitHandoverWebFormState(),
  handover: createWaitHandoverWebFormState(),
}

export function createWaitHandoverWebFormState(): WaitHandoverWebFormState {
  return {
    bagCode: '',
    ticketCodes: [],
    locationCode: '',
    sewingTaskCode: '',
    productionOrderNo: '',
    receiverFactoryName: '',
    resultMessage: '',
    errorMessage: '',
  }
}

function withError(state: WaitHandoverWebFormState, errorMessage: string): WaitHandoverWebFormState {
  return { ...state, resultMessage: '', errorMessage }
}

export function addWaitHandoverWebTicket(
  state: WaitHandoverWebFormState,
  rawTicketCode: string,
  candidates: WaitHandoverWebCandidates,
): { ok: boolean; state: WaitHandoverWebFormState } {
  const bagCode = state.bagCode.trim()
  const ticketCode = rawTicketCode.trim()
  if (!bagCode) return { ok: false, state: withError(state, '请先输入中转袋编号') }
  if (!ticketCode) return { ok: false, state: withError(state, '请输入菲票编号') }

  const bag = candidates.bags.find((item) => item.bagCode === bagCode)
  if (!bag || bag.status !== '待装袋') {
    return { ok: false, state: withError(state, '该中转袋不可装袋') }
  }
  if (state.ticketCodes.includes(ticketCode)) {
    return { ok: false, state: withError(state, '该菲票已录入当前中转袋') }
  }
  const assignedBag = candidates.bags.find(
    (item) => item.bagCode !== bagCode && item.ticketCodes.includes(ticketCode),
  )
  if (assignedBag) {
    return { ok: false, state: withError(state, `该菲票已在其他中转袋 ${assignedBag.bagCode}`) }
  }

  const ticket = candidates.tickets.find((item) => item.ticketCode === ticketCode)
  if (!ticket || ticket.status !== '可装袋') {
    return { ok: false, state: withError(state, '该菲票不可装袋') }
  }
  const firstTicket = candidates.tickets.find((item) => item.ticketCode === state.ticketCodes[0])
  if (firstTicket && firstTicket.productionOrderNo !== ticket.productionOrderNo) {
    return { ok: false, state: withError(state, '同一中转袋只能装入同一生产单的菲票') }
  }

  return {
    ok: true,
    state: {
      ...state,
      bagCode,
      ticketCodes: [...state.ticketCodes, ticketCode],
      resultMessage: '',
      errorMessage: '',
    },
  }
}

export function resolveWaitHandoverWebHandoverContext(
  state: WaitHandoverWebFormState,
  candidates: WaitHandoverWebCandidates,
): { ok: boolean; state: WaitHandoverWebFormState } {
  const bagCode = state.bagCode.trim()
  const sewingTaskCode = state.sewingTaskCode.trim()
  if (!bagCode || !sewingTaskCode) {
    return { ok: false, state: withError(state, '请输入中转袋编号和车缝任务号') }
  }
  const bag = candidates.bags.find((item) => item.bagCode === bagCode)
  if (!bag || bag.status !== '已入待交出仓') {
    return { ok: false, state: withError(state, '该中转袋不在待交出状态') }
  }
  const task = candidates.sewingTasks.find((item) => item.sewingTaskCode === sewingTaskCode)
  if (!task) return { ok: false, state: withError(state, '未找到车缝任务') }
  if (!task.receivable) return { ok: false, state: withError(state, '该车缝任务当前不可接收') }
  if (task.productionOrderNo !== bag.productionOrderNo) {
    return { ok: false, state: withError(state, '中转袋与车缝任务不属于同一生产单') }
  }
  return {
    ok: true,
    state: {
      ...state,
      bagCode,
      sewingTaskCode,
      productionOrderNo: task.productionOrderNo,
      receiverFactoryName: task.receiverFactoryName,
      resultMessage: '',
      errorMessage: '',
    },
  }
}

export function submitWaitHandoverWebActionState(
  action: WaitHandoverWebAction,
  state: WaitHandoverWebFormState,
  candidates: WaitHandoverWebCandidates,
): WaitHandoverWebCommandResult {
  const nextCandidates = cloneCandidates(candidates)
  const bagCode = state.bagCode.trim()
  const bag = nextCandidates.bags.find((item) => item.bagCode === bagCode)

  if (action === 'bagging') {
    if (!bag || bag.status !== '待装袋') {
      return { ok: false, state: withError(state, '该中转袋不可装袋'), candidates }
    }
    if (state.ticketCodes.length === 0) {
      return { ok: false, state: withError(state, '请至少录入一张菲票'), candidates }
    }
    const tickets = state.ticketCodes.map((code) =>
      nextCandidates.tickets.find((ticket) => ticket.ticketCode === code),
    )
    if (tickets.some((ticket) => !ticket || ticket.status !== '可装袋')) {
      return { ok: false, state: withError(state, '存在不可装袋的菲票'), candidates }
    }
    const productionOrderNos = new Set(tickets.map((ticket) => ticket?.productionOrderNo))
    if (productionOrderNos.size !== 1) {
      return { ok: false, state: withError(state, '同一中转袋只能装入同一生产单的菲票'), candidates }
    }
    bag.productionOrderNo = tickets[0]!.productionOrderNo
    bag.ticketCodes = [...state.ticketCodes]
    bag.status = '已装袋待入仓'
    tickets.forEach((ticket) => {
      ticket!.status = '已装袋'
    })
    return {
      ok: true,
      state: { ...createWaitHandoverWebFormState(), resultMessage: '装袋成功' },
      candidates: nextCandidates,
    }
  }

  if (action === 'inbound') {
    if (!bag || bag.status !== '已装袋待入仓') {
      return { ok: false, state: withError(state, '该中转袋不可入仓'), candidates }
    }
    const locationCode = state.locationCode.trim()
    if (!locationCode) {
      return { ok: false, state: withError(state, '请输入库区库位'), candidates }
    }
    bag.status = '已入待交出仓'
    bag.locationCode = locationCode
    return {
      ok: true,
      state: { ...createWaitHandoverWebFormState(), resultMessage: '入仓成功' },
      candidates: nextCandidates,
    }
  }

  if (!bag || bag.status !== '已入待交出仓') {
    return { ok: false, state: withError(state, '该中转袋不在待交出状态'), candidates }
  }
  const task = nextCandidates.sewingTasks.find(
    (item) => item.sewingTaskCode === state.sewingTaskCode.trim(),
  )
  if (
    !task ||
    !task.receivable ||
    task.productionOrderNo !== bag.productionOrderNo ||
    state.productionOrderNo !== task.productionOrderNo ||
    state.receiverFactoryName !== task.receiverFactoryName
  ) {
    return { ok: false, state: withError(state, '请先查询并确认匹配的车缝任务'), candidates }
  }
  bag.status = '已交出'
  bag.boundSewingTaskCode = task.sewingTaskCode
  return {
    ok: true,
    state: { ...createWaitHandoverWebFormState(), resultMessage: '交出成功' },
    candidates: nextCandidates,
  }
}

export function handleWaitHandoverWebCommand(
  command: WaitHandoverWebCommand,
  state: WaitHandoverWebFormState,
  candidates: WaitHandoverWebCandidates,
): WaitHandoverWebCommandResult {
  if (command.type === 'add-ticket') {
    const result = addWaitHandoverWebTicket(state, command.ticketCode, candidates)
    return { ...result, candidates }
  }
  if (command.type === 'resolve-handover') {
    const result = resolveWaitHandoverWebHandoverContext(state, candidates)
    return { ...result, candidates }
  }
  return submitWaitHandoverWebActionState(command.action, state, candidates)
}

function renderField(
  label: string,
  field: keyof WaitHandoverWebFormState | 'ticketCode',
  value: string,
  placeholder: string,
  readOnly = false,
): string {
  return `
    <label class="space-y-1.5">
      <span class="block text-sm font-medium text-slate-700">${escapeHtml(label)}</span>
      <input
        class="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        data-wait-handover-web-field="${field}"
        data-skip-page-rerender="true"
        ${readOnly ? 'readonly' : ''}
      />
    </label>
  `
}

function renderFeedback(state: WaitHandoverWebFormState): string {
  if (state.errorMessage) {
    return `<div class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(state.errorMessage)}</div>`
  }
  if (state.resultMessage) {
    return `<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">${escapeHtml(state.resultMessage)}</div>`
  }
  return ''
}

function actionButton(label: string, action: string, variant: 'primary' | 'secondary' = 'secondary'): string {
  return `
    <span class="contents" data-skip-page-rerender="true">
      ${renderButton({
        label,
        variant,
        action: { prefix: 'wait-handover-web', action },
      })}
    </span>
  `
}

export function renderWaitHandoverWebActionPanel(
  action: WaitHandoverWebAction,
  state = runtimeStates[action],
): string {
  const feedback = renderFeedback(state)
  if (action === 'bagging') {
    return `
      <div class="space-y-5">
        <div class="grid gap-4 lg:grid-cols-2">
          ${renderField('中转袋编号', 'bagCode', state.bagCode, '例如 WEB-BAG-001')}
          <div class="space-y-1.5">
            <span class="block text-sm font-medium text-slate-700">菲票编号</span>
            <div class="flex gap-2">
              <div class="min-w-0 flex-1">${renderField('', 'ticketCode', '', '逐张输入菲票编号')}</div>
              ${actionButton('加入', 'add-ticket')}
            </div>
          </div>
        </div>
        <div class="flex min-h-10 flex-wrap items-center gap-2" data-wait-handover-web-ticket-list>
          ${
            state.ticketCodes.length
              ? state.ticketCodes
                  .map(
                    (code) =>
                      `<span class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">${escapeHtml(code)}</span>`,
                  )
                  .join('')
              : '<span class="text-sm text-slate-400">尚未录入菲票</span>'
          }
        </div>
        ${feedback}
        <div class="flex justify-end">${actionButton('确认装袋', 'submit-bagging', 'primary')}</div>
      </div>
    `
  }
  if (action === 'inbound') {
    return `
      <div class="space-y-5">
        <div class="grid gap-4 lg:grid-cols-2">
          ${renderField('中转袋编号', 'bagCode', state.bagCode, '例如 WEB-BAG-002')}
          ${renderField('库区库位', 'locationCode', state.locationCode, '例如 裁床仓 A-01')}
        </div>
        ${feedback}
        <div class="flex justify-end">${actionButton('确认入仓', 'submit-inbound', 'primary')}</div>
      </div>
    `
  }
  return `
    <div class="space-y-5">
      <div class="grid gap-4 lg:grid-cols-2">
        ${renderField('中转袋编号', 'bagCode', state.bagCode, '例如 WEB-BAG-003')}
        <div class="space-y-1.5">
          <span class="block text-sm font-medium text-slate-700">车缝任务号</span>
          <div class="flex gap-2">
            <div class="min-w-0 flex-1">${renderField('', 'sewingTaskCode', state.sewingTaskCode, '例如 SEW-TASK-001')}</div>
            ${actionButton('查询任务', 'resolve-handover')}
          </div>
        </div>
        ${renderField('生产单号', 'productionOrderNo', state.productionOrderNo, '查询后自动带出', true)}
        ${renderField('接收工厂', 'receiverFactoryName', state.receiverFactoryName, '查询后自动带出', true)}
      </div>
      ${feedback}
      <div class="flex justify-end">${actionButton('确认整袋交出', 'submit-handover', 'primary')}</div>
    </div>
  `
}

export function renderWaitHandoverWebActionDialog(
  action: WaitHandoverWebAction,
  state = runtimeStates[action],
): string {
  const title =
    action === 'bagging' ? '菲票装袋' : action === 'inbound' ? '中转袋入仓' : '中转袋交出'
  return `
    <div
      id="${WAIT_HANDOVER_WEB_MODAL_ID}"
      class="fixed inset-0 z-[130]"
      data-wait-handover-modal="${action}"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/45"
        aria-label="关闭"
        data-skip-page-rerender="true"
        data-wait-handover-web-action="close-dialog"
      ></button>
      <section class="absolute left-1/2 top-1/2 flex max-h-[88vh] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-white shadow-2xl">
        <header class="flex items-center justify-between border-b px-5 py-4">
          <h2 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h2>
          <button
            type="button"
            class="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
            data-skip-page-rerender="true"
            data-wait-handover-web-action="close-dialog"
          >关闭</button>
        </header>
        <div class="overflow-y-auto p-5" data-wait-handover-web-workspace>
          ${renderWaitHandoverWebActionPanel(action, state)}
        </div>
      </section>
    </div>
  `
}

function removeWaitHandoverWebActionDialog(): void {
  if (typeof document === 'undefined') return
  document.getElementById(WAIT_HANDOVER_WEB_MODAL_ID)?.remove()
}

function openWaitHandoverWebActionDialog(action: WaitHandoverWebAction): void {
  if (typeof document === 'undefined') return
  activeAction = action
  removeWaitHandoverWebActionDialog()
  ;(document.getElementById('app') || document.body).insertAdjacentHTML(
    'beforeend',
    renderWaitHandoverWebActionDialog(action),
  )
}

function readRuntimeState(action: WaitHandoverWebAction): WaitHandoverWebFormState {
  const state = runtimeStates[action]
  const read = (field: string): string => {
    const input = document.querySelector<HTMLInputElement>(`[data-wait-handover-web-field="${field}"]`)
    return input?.value ?? ''
  }
  return {
    ...state,
    bagCode: read('bagCode'),
    locationCode: action === 'inbound' ? read('locationCode') : state.locationCode,
    sewingTaskCode: action === 'handover' ? read('sewingTaskCode') : state.sewingTaskCode,
  }
}

function refreshWebWorkspace(): void {
  const workspace = document.querySelector<HTMLElement>('[data-wait-handover-web-workspace]')
  if (workspace) workspace.innerHTML = renderWaitHandoverWebActionPanel(activeAction)
}

export function handleCraftCuttingWaitHandoverWebActionsEvent(target: HTMLElement): boolean {
  const trigger = target.closest<HTMLElement>('[data-wait-handover-web-action]')
  const actionName = trigger?.dataset.waitHandoverWebAction
  if (!actionName) return false

  if (
    actionName === 'open-bagging' ||
    actionName === 'open-inbound' ||
    actionName === 'open-handover'
  ) {
    openWaitHandoverWebActionDialog(
      actionName.replace('open-', '') as WaitHandoverWebAction,
    )
    return true
  }
  if (actionName === 'close-dialog') {
    removeWaitHandoverWebActionDialog()
    return true
  }

  const currentState = readRuntimeState(activeAction)
  let command: WaitHandoverWebCommand
  if (actionName === 'add-ticket') {
    const ticketCode =
      document.querySelector<HTMLInputElement>('[data-wait-handover-web-field="ticketCode"]')?.value ?? ''
    command = { type: 'add-ticket', ticketCode }
  } else if (actionName === 'resolve-handover') {
    command = { type: 'resolve-handover' }
  } else if (actionName === 'submit-bagging') {
    command = { type: 'submit', action: 'bagging' }
  } else if (actionName === 'submit-inbound') {
    command = { type: 'submit', action: 'inbound' }
  } else if (actionName === 'submit-handover') {
    command = { type: 'submit', action: 'handover' }
  } else {
    return false
  }

  const result = handleWaitHandoverWebCommand(command, currentState, runtimeCandidates)
  runtimeStates[activeAction] = result.state
  runtimeCandidates = result.candidates
  refreshWebWorkspace()
  return true
}
