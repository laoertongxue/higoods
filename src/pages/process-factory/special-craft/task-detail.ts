import {
  buildSpecialCraftTaskDetailPath,
  buildSpecialCraftTaskOrdersPath,
  getSpecialCraftOperationBySlug,
} from '../../../data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftTaskOrderById,
} from '../../../data/fcs/special-craft-task-orders.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { executeProcessWebAction } from '../../../data/fcs/process-web-status-actions.ts'
import {
  renderGarmentSkuConfirmDialog,
  renderCutPieceFeiTicketConfirmDialog,
} from './shared.ts'

import {
  handleProcessWebStatusActionDialogEvent,
} from '../shared/web-status-action-dialog.ts'
import {
  formatQty,
  formatSpecialCraftFactoryLabel,
  getFastSpecialCraftWebActions,
  renderEmptyState,
  renderSpecialCraftFactoryContextBlockedLayout,
  renderSpecialCraftPageLayout,
  renderStatusBadge,
  renderTable,
  renderWebActionPanel,
  resolveSpecialCraftFactoryContextGuard,
} from './shared.ts'

type SpecialCraftTaskDetailTab = 'overview' | 'demand' | 'warehouse' | 'events'

const specialCraftTaskDetailTabs: Array<{ key: SpecialCraftTaskDetailTab; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'demand', label: '任务明细' },
  { key: 'warehouse', label: '仓库流转' },
  { key: 'events', label: '节点记录' },
]

function getCurrentTaskDetailTab(): SpecialCraftTaskDetailTab {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const tab = new URLSearchParams(queryString).get('tab')
  return specialCraftTaskDetailTabs.some((item) => item.key === tab) ? (tab as SpecialCraftTaskDetailTab) : 'overview'
}

function renderTaskDetailTabs(baseHref: string, activeTab: SpecialCraftTaskDetailTab): string {
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${specialCraftTaskDetailTabs
        .map((item) => {
          const active = item.key === activeTab
          return `
            <button
              type="button"
              class="rounded px-3 py-1.5 text-sm ${active ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
              data-nav="${escapeHtml(`${baseHref}?tab=${item.key}`)}"
            >
              ${escapeHtml(item.label)}
            </button>
          `
        })
        .join('')}
    </nav>
  `
}

function renderInfoGrid(items: Array<{ label: string; value: string }>): string {
  return `
    <div class="grid border-y bg-white md:grid-cols-2 xl:grid-cols-4">
      ${items
        .map(
          (item) => `
            <div class="border-b px-1 py-3 md:px-3 xl:border-r">
              <div class="text-xs text-muted-foreground">${escapeHtml(item.label)}</div>
              <div class="mt-1 text-sm font-medium text-foreground">${item.value}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSection(title: string, body: string): string {
  return `
    <section class="space-y-3 border-t pt-4">
      <h2 class="text-base font-semibold text-foreground">${escapeHtml(title)}</h2>
      <div>${body}</div>
    </section>
  `
}

function isCutPieceTarget(targetObject: string): boolean {
  return targetObject === '裁片' || targetObject === '已裁部位'
}

function isFabricTarget(targetObject: string): boolean {
  return targetObject === '面料' || targetObject === '完整面料'
}

export function renderSpecialCraftTaskDetailPage(operationSlug: string, taskOrderId: string): string {
  const operation = getSpecialCraftOperationBySlug(operationSlug)
  const taskOrder = getSpecialCraftTaskOrderById(decodeURIComponent(taskOrderId))

  if (!operation || !taskOrder || taskOrder.operationId !== operation.operationId) {
    return renderEmptyState('未找到对应加工单详情。')
  }
  const factoryGuard = resolveSpecialCraftFactoryContextGuard(operation)
  if (factoryGuard.blocked) {
    return renderSpecialCraftFactoryContextBlockedLayout({
      operation,
      title: `${operation.operationName}加工单详情`,
      description: '',
      activeSubNav: 'tasks',
      factoryName: factoryGuard.factoryName,
    })
  }

  const objectMeta = {
    objectType: taskOrder.targetObject === '成衣' ? '成衣' : '裁片',
    objectLabel: taskOrder.targetObject === '成衣' ? '成衣' : '裁片',
    qtyUnit: taskOrder.unit || '件',
    qtyRule: taskOrder.targetObject === '成衣' ? '按 SKU 件数汇总' : '按裁片数量统计',
  }
  const webActions = getFastSpecialCraftWebActions(taskOrder)
  const taskOrderQty = taskOrder.currentQty || taskOrder.planQty || 1

  const basicInfo = renderInfoGrid([
    { label: '任务号', value: escapeHtml(taskOrder.taskOrderNo) },
    { label: '生产单', value: escapeHtml(taskOrder.productionOrderNo) },
    { label: '来源', value: escapeHtml(taskOrder.generationSourceLabel || '生产单生成') },
    { label: '技术包版本', value: escapeHtml(taskOrder.techPackVersion || '—') },
    { label: '生成批次', value: escapeHtml(taskOrder.generationBatchId || '—') },
    { label: '工艺', value: escapeHtml(taskOrder.operationName) },
    { label: '执行工厂', value: escapeHtml(formatSpecialCraftFactoryLabel(taskOrder.factoryName, taskOrder.factoryId)) },
    { label: '作用对象', value: escapeHtml(taskOrder.targetObject) },
    { label: '分配状态', value: renderStatusBadge(taskOrder.assignmentStatusLabel || '待分配') },
    { label: '执行状态', value: renderStatusBadge(taskOrder.executionStatusLabel || taskOrder.status) },
    { label: '计划裁片数量', value: `${formatQty(taskOrder.planQty)}${escapeHtml(taskOrder.unit)}` },
    { label: '已接收数量', value: `${formatQty(taskOrder.receivedQty)}${escapeHtml(taskOrder.unit)}` },
    { label: '已完成裁片数量', value: `${formatQty(taskOrder.completedQty)}${escapeHtml(taskOrder.unit)}` },
    { label: '待交出裁片数量', value: `${formatQty(taskOrder.waitHandoverQty)}${escapeHtml(taskOrder.unit)}` },
    { label: '当前状态', value: renderStatusBadge(taskOrder.status) },
    { label: '交期', value: escapeHtml(taskOrder.dueAt.slice(0, 10)) },
  ])

  const pieceInfo = isCutPieceTarget(taskOrder.targetObject)
    ? renderInfoGrid([
        { label: '裁片部位', value: escapeHtml(taskOrder.partName || '—') },
        { label: '颜色', value: escapeHtml(taskOrder.fabricColor || '—') },
        { label: '尺码', value: escapeHtml(taskOrder.sizeCode || '—') },
        { label: '菲票号', value: escapeHtml(taskOrder.feiTicketNos.join('、') || '待绑定') },
        { label: '中转袋号', value: escapeHtml(taskOrder.transferBagNos.join('、') || '—') },
        { label: '计划加工数量', value: `${formatQty(taskOrder.planQty)}${escapeHtml(taskOrder.unit)}` },
      ])
    : ''

  const fabricInfo = isFabricTarget(taskOrder.targetObject)
    ? renderInfoGrid([
        { label: '面料 SKU', value: escapeHtml(taskOrder.materialSku || '—') },
        { label: '颜色', value: escapeHtml(taskOrder.fabricColor || '—') },
        { label: '卷号', value: escapeHtml(taskOrder.fabricRollNos.join('、') || '—') },
        { label: '计划加工数量', value: `${formatQty(taskOrder.planQty)}${escapeHtml(taskOrder.unit)}` },
        { label: '单位', value: escapeHtml(taskOrder.unit) },
      ])
    : ''

  const nodeRows = taskOrder.nodeRecords
    .map(
      (nodeRecord) => `
        <tr class="align-top">
          <td class="px-3 py-3">${renderStatusBadge(nodeRecord.nodeName)}</td>
          <td class="px-3 py-3">${escapeHtml(nodeRecord.actionName)}</td>
          <td class="px-3 py-3">${formatQty(nodeRecord.qty)}${escapeHtml(nodeRecord.unit)}</td>
          <td class="px-3 py-3">${escapeHtml(nodeRecord.operatorName)}</td>
          <td class="px-3 py-3">${escapeHtml(nodeRecord.operatedAt)}</td>
          <td class="px-3 py-3">${escapeHtml(nodeRecord.relatedRecordNo || '—')}</td>
          <td class="px-3 py-3">${String(nodeRecord.photoCount)}</td>
          <td class="px-3 py-3">${escapeHtml(nodeRecord.remark || '—')}</td>
        </tr>
      `,
    )
    .join('')

  const warehouseRows = taskOrder.warehouseLinks
    .map(
      (warehouseLink) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(warehouseLink.warehouseKind)}</td>
          <td class="px-3 py-3">${escapeHtml(warehouseLink.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(warehouseLink.inboundRecordNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(warehouseLink.outboundRecordNo || '—')}</td>
          <td class="px-3 py-3">${warehouseLink.waitProcessStockItemId ? '已关联' : '—'}</td>
          <td class="px-3 py-3">${warehouseLink.waitHandoverStockItemId ? '已关联' : '—'}</td>
          <td class="px-3 py-3">${escapeHtml(warehouseLink.handoverRecordNo || '—')}</td>
          <td class="px-3 py-3">${warehouseLink.handoverRecordId ? '已生成' : '—'}</td>
          <td class="px-3 py-3">${
            warehouseLink.status === '已回写' ? renderStatusBadge('已回写') : '未回写'
          }</td>
        </tr>
      `,
    )
    .join('')

  const demandRows = (taskOrder.demandLines ?? [])
    .map(
      (line) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(line.partName)}</td>
          <td class="px-3 py-3">${escapeHtml(line.colorName)}</td>
          <td class="px-3 py-3">${escapeHtml(line.sizeCode)}</td>
          <td class="px-3 py-3">${formatQty(line.pieceCountPerGarment)}</td>
          <td class="px-3 py-3">${formatQty(line.orderQty)}</td>
          <td class="px-3 py-3">${formatQty(line.planPieceQty)}</td>
          <td class="px-3 py-3">${escapeHtml(line.patternFileName)}</td>
          <td class="px-3 py-3">${escapeHtml(line.pieceRowId)}</td>
          <td class="px-3 py-3">${escapeHtml(line.feiTicketNos.join('、') || '待绑定')}</td>
        </tr>
      `,
    )
    .join('')

  const bindingRows = taskOrder.feiTicketNos
    .map(
      (feiTicketNo) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(feiTicketNo)}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.partName || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.fabricColor || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.sizeCode || '多尺码')}</td>
          <td class="px-3 py-3">${formatQty(taskOrder.planQty)} ${escapeHtml(taskOrder.unit)}</td>
          <td class="px-3 py-3">${renderStatusBadge(taskOrder.status)}</td>
        </tr>
      `,
    )
    .join('')

  const taskDetailHref = buildSpecialCraftTaskDetailPath(operation, taskOrder.taskOrderId)
  const activeTab = getCurrentTaskDetailTab()
  const targetInfoSection = isCutPieceTarget(taskOrder.targetObject)
    ? renderSection('裁片信息', pieceInfo)
    : isFabricTarget(taskOrder.targetObject)
      ? renderSection('面料信息', fabricInfo)
      : ''
  const firstDemandLine = (taskOrder.demandLines ?? [])[0]
  const demandSummary = renderInfoGrid([
    { label: '任务明细', value: `${formatQty(taskOrder.demandLines?.length || 0)} 条` },
    { label: '来源纸样', value: escapeHtml(firstDemandLine?.patternFileName || '—') },
    { label: '来源裁片明细', value: escapeHtml(firstDemandLine?.pieceRowId || '—') },
    { label: '菲票状态', value: escapeHtml(taskOrder.feiTicketNos.join('、') || '待绑定') },
  ])

  const sections: Record<SpecialCraftTaskDetailTab, string> = {
    overview: `
      <div class="space-y-5">
        ${renderSection('基本信息', basicInfo)}
        ${renderSection('任务明细摘要', demandSummary)}
        ${targetInfoSection}
      </div>
    `,
    demand: renderSection(
      '任务明细',
      demandRows
        ? renderTable(
            ['裁片部位', '颜色', '尺码', '每件片数', '生产成衣件数', '计划裁片数量', '来源纸样', '来源裁片明细', '菲票号'],
            demandRows,
            'min-w-[1120px]',
          )
        : renderEmptyState('暂无加工明细'),
    ),
    warehouse: `
      <div class="space-y-5">
        ${renderSection(
          '菲票流转',
          bindingRows
            ? renderTable(
                ['菲票号', '裁片部位', '颜色', '尺码', '计划数量', '当前状态'],
                bindingRows,
                'min-w-[860px]',
              )
            : renderEmptyState('暂无菲票流转'),
        )}
        ${renderSection(
          '仓库记录',
          renderTable(
            [
              '仓库类型',
              '仓库名称',
              '入库记录',
              '出库记录',
              '待加工仓记录',
              '待交出仓记录',
              '交出记录',
              '交出二维码',
              '回写状态',
            ],
            warehouseRows || `<tr><td colspan="9" class="px-3 py-6 text-center text-muted-foreground">暂无数据</td></tr>`,
            'min-w-[1280px]',
          ),
        )}
      </div>
    `,
    events: renderSection(
      '节点记录',
      renderTable(['节点', '操作', '操作裁片数量', '操作人', '操作时间', '关联单号', '照片数量', '备注'], nodeRows, 'min-w-[1160px]'),
    ),
  }

  const content = `
    <section class="border-y bg-white py-3">
      <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div>
          <div class="text-xs text-muted-foreground">加工单号</div>
          <div class="mt-1 font-semibold text-foreground">${escapeHtml(taskOrder.taskOrderNo)}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">生产单 / 技术包</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(taskOrder.productionOrderNo)} / ${escapeHtml(taskOrder.techPackVersion || '—')}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">执行工厂</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(formatSpecialCraftFactoryLabel(taskOrder.factoryName, taskOrder.factoryId))}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">当前状态</div>
          <div class="mt-1">${renderStatusBadge(taskOrder.status)}</div>
        </div>
      </div>
    </section>
    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <main class="min-w-0 space-y-4">
        ${renderTaskDetailTabs(taskDetailHref, activeTab)}
        ${sections[activeTab]}
      </main>
      <aside class="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <section class="space-y-4 border-l pl-4">
          <div class="space-y-1">
            <h2 class="text-base font-semibold text-foreground">当前处理</h2>
            <p class="text-xs text-muted-foreground">${escapeHtml(objectMeta.qtyRule)}</p>
          </div>
          ${renderWebActionPanel(taskOrder.taskOrderId, taskOrder.status, webActions, taskOrderQty, objectMeta)}
          <div class="grid gap-2 border-t pt-3 text-sm">
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">计划数量</span><span class="font-medium">${formatQty(taskOrder.planQty)} ${escapeHtml(taskOrder.unit)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">已完成</span><span class="font-medium">${formatQty(taskOrder.completedQty)} ${escapeHtml(taskOrder.unit)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">已交出</span><span class="font-medium">${formatQty(taskOrder.waitHandoverQty)} ${escapeHtml(taskOrder.unit)}</span></div>
          </div>
          <button type="button" class="w-full rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-special-craft-task-action="go-back">返回列表</button>
        </section>
      </aside>
    </div>
  `

  return renderSpecialCraftPageLayout({
    operation,
    title: `${operation.operationName}加工单详情`,
    description: '',
    activeSubNav: 'tasks',
    content,
  })
}

function showToast(message: string): void {
  if (typeof document === 'undefined') return
  const root = document.getElementById('special-craft-page-toast-root') || document.body
  const toast = document.createElement('div')
  toast.className = 'fixed right-4 top-4 z-[180] rounded-md border bg-background px-3 py-2 text-sm shadow-lg'
  toast.textContent = message
  root.appendChild(toast)
  window.setTimeout(() => toast.remove(), 2400)
}

export function handleSpecialCraftTaskDetailEvent(target: HTMLElement): boolean {
  const dialogHandled = handleProcessWebStatusActionDialogEvent(target, {
    toast: showToast,
    refresh: () => {
      const current = appStore.getState().pathname || '/'
      const [path, queryString = ''] = current.split('?')
      const params = new URLSearchParams(queryString)
      params.set('actionResultAt', String(Date.now()))
      appStore.navigate(`${path}?${params.toString()}`, { historyMode: 'replace' })
    },
  })
  if (dialogHandled !== null) return dialogHandled

  const taskActionNode = target.closest<HTMLElement>('[data-special-craft-task-action]')
  if (taskActionNode) {
    const action = taskActionNode.dataset.specialCraftTaskAction
    if (action === 'go-back') {
      const pathname = appStore.getState().pathname || ''
      const match = pathname.match(/\/fcs\/process-factory\/special-craft\/([^/]+)\/tasks\//)
      if (match) {
        appStore.navigate(`/fcs/process-factory/special-craft/${encodeURIComponent(match[1])}/tasks`)
        return true
      }
      window.history.back()
      return true
    }
    return false
  }

  const actionNode = target.closest<HTMLElement>('[data-special-craft-web-action]')
  const customConfirmNode = target.closest<HTMLElement>('[data-special-craft-sku-confirm], [data-special-craft-fei-confirm]')
  if (!actionNode && !customConfirmNode) return false

  if (actionNode?.dataset.specialCraftWebAction === 'open-web-status-action-dialog') {
    const actionCode = actionNode.dataset.actionCode || ''
    const sourceId = actionNode.dataset.sourceId || ''
    const taskOrder = getSpecialCraftTaskOrderById(sourceId)
    if (!taskOrder) return true

    const isCustomDialog = actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE'
      || actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT'
      || actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER'
      || actionCode === 'SPECIAL_CRAFT_COMPLETE_ORDER'

    if (isCustomDialog) {
      const isGarment = taskOrder.targetObject === '成衣'
      const lines = taskOrder.demandLines || []
      const readonly = actionCode === 'SPECIAL_CRAFT_COMPLETE_ORDER'

      if (isGarment) {
        const title =
          actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE' ? '确认接收 - 逐 SKU 确认实收件数'
          : actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT' ? '加工填报 - 逐 SKU 确认完工件数'
          : actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER' ? '发起交出 - 逐 SKU 确认交出件数'
          : '完成加工单 - 核对汇总后完结'
        const dialogHtml = renderGarmentSkuConfirmDialog(sourceId, actionCode, title, lines, 'planPieceQty', {
          showReceived: actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE' || readonly,
          showCompleted: actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT' || readonly,
          showHandover: actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER' || readonly,
          readonly,
          receivedQty: actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE' ? Math.max(taskOrder.planQty - taskOrder.receivedQty, 0) : taskOrder.receivedQty,
          completedQty: actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT' ? Math.max(taskOrder.receivedQty - taskOrder.completedQty, 0) : taskOrder.completedQty,
          returnedQty: actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER' ? Math.max(taskOrder.completedQty - (taskOrder.returnedQty || 0), 0) : (taskOrder.returnedQty || 0),
        })
        ;(document.getElementById('app') || document.body).insertAdjacentHTML('beforeend', dialogHtml)
      } else {
        const feiGroups = new Map<string, { feiTicketNo: string; partName: string; colorName: string; sizeCode: string; planQty: number }>()
        lines.forEach((line) => {
          const ticketNos = line.feiTicketNos?.length ? line.feiTicketNos : ['无菲票']
          const ticketQty = line.planPieceQty / ticketNos.length
          ticketNos.forEach((ticketNo) => {
            if (feiGroups.has(ticketNo)) {
              feiGroups.get(ticketNo)!.planQty += ticketQty
            } else {
              feiGroups.set(ticketNo, { feiTicketNo: ticketNo, partName: line.partName, colorName: line.colorName, sizeCode: line.sizeCode, planQty: ticketQty })
            }
          })
        })
        const groups = [...feiGroups.values()].map((g) => ({ ...g, defaultQty: g.planQty }))
        const title =
          actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE' ? '确认接收 - 逐菲票确认实收数量'
          : actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT' ? '加工填报 - 逐菲票确认完工数量'
          : actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER' ? '发起交出 - 逐菲票确认交出数量'
          : '完成加工单 - 核对汇总后完结'
        const dialogHtml = renderCutPieceFeiTicketConfirmDialog(sourceId, actionCode, title, groups, {
          showReceived: actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE' || readonly,
          showCompleted: actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT' || readonly,
          showHandover: actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER' || readonly,
          showWriteback: readonly,
          readonly,
          writebackQty: taskOrder.writebackQty || 0,
        })
        ;(document.getElementById('app') || document.body).insertAdjacentHTML('beforeend', dialogHtml)
      }
      return true
    }

    return true
  }

  if (actionNode) return true

  // SKU 确认对话框提交
  const skuConfirmNode = target.closest<HTMLElement>('[data-special-craft-sku-confirm]')
  if (skuConfirmNode) {
    const taskId = skuConfirmNode.dataset.taskId || ''
    const actionCode = skuConfirmNode.dataset.actionCode || ''
    const dialog = document.getElementById('special-craft-garment-sku-dialog')
    if (!dialog) return true

    const taskOrder = getSpecialCraftTaskOrderById(taskId)
    const skuQtyBySkuCode: Record<string, number> = {}
    const inputPrefix = actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT'
      ? 'sku-completed'
      : actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER'
        ? 'sku-handover'
        : 'sku-qty'
    if (actionCode !== 'SPECIAL_CRAFT_COMPLETE_ORDER') {
      dialog.querySelectorAll<HTMLInputElement>(`input[name^="${inputPrefix}-"]`).forEach((input) => {
        const skuCode = input.dataset.skuCode || ''
        const qty = Number(input.value) || 0
        if (skuCode && qty >= 0) skuQtyBySkuCode[skuCode] = qty
      })
    }
    dialog.remove()

    try {
      const result = executeProcessWebAction({
        sourceType: 'SPECIAL_CRAFT',
        sourceId: taskId,
        actionCode,
        operatorName: 'Web 端操作员',
        operatedAt: '2026-07-23 10:00',
        objectType: taskOrder?.targetObject ?? '裁片',
        objectQty: actionCode === 'SPECIAL_CRAFT_COMPLETE_ORDER' ? undefined : Object.values(skuQtyBySkuCode).reduce((s, q) => s + q, 0),
        qtyUnit: taskOrder?.unit ?? '件',
        skuQtyBySkuCode: actionCode === 'SPECIAL_CRAFT_COMPLETE_ORDER' ? undefined : skuQtyBySkuCode,
        skuScrapQtyBySkuCode: actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT' && taskOrder?.demandLines ? Object.fromEntries(taskOrder.demandLines.map((line) => [line.skuCode, 0])) : undefined,
        skuDamageQtyBySkuCode: actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT' && taskOrder?.demandLines ? Object.fromEntries(taskOrder.demandLines.map((line) => [line.skuCode, 0])) : undefined,
      })
      showToast(result.message)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败')
    }
    const current = appStore.getState().pathname || '/'
    appStore.navigate(current, { historyMode: 'replace' })
    return true
  }

  // 菲票确认对话框提交
  const feiConfirmNode = target.closest<HTMLElement>('[data-special-craft-fei-confirm]')
  if (feiConfirmNode) {
    const taskId = feiConfirmNode.dataset.taskId || ''
    const actionCode = feiConfirmNode.dataset.actionCode || ''
    const dialog = document.getElementById('special-craft-fei-ticket-dialog')
    if (!dialog) return true

    const feiQtyByTicketNo: Record<string, number> = {}
    const inputPrefix = actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT'
      ? 'fei-completed'
      : actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER'
        ? 'fei-handover'
        : 'fei-qty'
    if (actionCode !== 'SPECIAL_CRAFT_COMPLETE_ORDER') {
      const inputs = dialog.querySelectorAll<HTMLInputElement>('input[type="number"]')
      inputs.forEach((input) => {
        const name = input.name || ''
        if (!name.startsWith(`${inputPrefix}-`)) return
        const ticketNo = input.dataset.feiTicketNo || name.replace(`${inputPrefix}-`, '')
        feiQtyByTicketNo[ticketNo] = Number(input.value) || 0
      })
    }

    dialog.remove()

    const totalQty = Object.values(feiQtyByTicketNo).reduce((s, q) => s + q, 0)
    try {
      const result = executeProcessWebAction({
        sourceType: 'SPECIAL_CRAFT',
        sourceId: taskId,
        actionCode,
        operatorName: 'Web 端操作员',
        operatedAt: '2026-07-23 10:00',
        objectQty: actionCode === 'SPECIAL_CRAFT_COMPLETE_ORDER' ? undefined : totalQty,
        qtyUnit: '片',
        remark: `逐菲票确认，合计 ${totalQty} 片`,
      })
      showToast(result.message)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败')
    }
    const current = appStore.getState().pathname || '/'
    appStore.navigate(current, { historyMode: 'replace' })
    return true
  }

  return false
}
