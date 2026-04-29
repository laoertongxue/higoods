import {
  buildSpecialCraftTaskDetailPath,
  buildSpecialCraftWorkOrderDetailPath,
  getSpecialCraftOperationBySlug,
} from '../../../data/fcs/special-craft-operations.ts'
import { buildHandoverDifferenceRequestPrintLink, buildTaskDetailLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  buildMobileExecutionListLocatePathForTask,
  getMobileExecutionTaskById,
} from '../../../data/fcs/mobile-execution-task-index.ts'
import { validateSpecialCraftMobileTaskBinding } from '../../../data/fcs/process-mobile-task-binding.ts'
import {
  executeProcessWebAction,
  getAvailableSpecialCraftWebActions,
  getProcessWebOperationRecordsBySource,
  type ProcessWebAction,
  type ProcessWebOperationRecord,
} from '../../../data/fcs/process-web-status-actions.ts'
import {
  getSpecialCraftTaskOrderById,
  getSpecialCraftTaskWorkOrderById,
  getSpecialCraftTaskWorkOrderLinesByWorkOrderId,
} from '../../../data/fcs/special-craft-task-orders.ts'
import {
  getSpecialCraftFeiTicketFlowEventsByWorkOrderId,
  listCuttingSpecialCraftFeiTicketBindings,
  listSpecialCraftQtyDifferenceReports,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  applySpecialCraftDifferenceToFeiTickets,
  getDifferenceRecordsByWorkOrderId,
  getHandoverRecordsByWorkOrderId,
  getWarehouseRecordsByWorkOrderId,
  handleProcessHandoverDifference,
} from '../../../data/fcs/process-warehouse-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import { appStore } from '../../../state/store.ts'
import {
  formatQty,
  formatSpecialCraftFactoryLabel,
  renderEmptyState,
  renderSpecialCraftFactoryContextBlockedLayout,
  renderSpecialCraftPageLayout,
  resolveSpecialCraftFactoryContextGuard,
  renderStatusBadge,
  renderTable,
} from './shared.ts'

type SpecialCraftDetailTab = 'base' | 'lines' | 'fei' | 'quantity' | 'difference' | 'events'

const specialCraftDetailTabs: Array<{ key: SpecialCraftDetailTab; label: string }> = [
  { key: 'base', label: '基本信息' },
  { key: 'lines', label: '明细行' },
  { key: 'fei', label: '绑定菲票数量' },
  { key: 'quantity', label: '数量变化' },
  { key: 'difference', label: '差异上报' },
  { key: 'events', label: '流转记录' },
]

const consumedWebActionKeys = new Set<string>()

function getCurrentDetailTab(): SpecialCraftDetailTab {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const tab = new URLSearchParams(queryString).get('tab')
  return specialCraftDetailTabs.some((item) => item.key === tab) ? (tab as SpecialCraftDetailTab) : 'base'
}

function renderDetailTabs(baseHref: string, activeTab: SpecialCraftDetailTab): string {
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${specialCraftDetailTabs
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
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${items
        .map(
          (item) => `
            <div class="rounded-2xl border bg-slate-50/60 p-3">
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
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 class="text-base font-semibold text-foreground">${escapeHtml(title)}</h2>
      <div class="mt-4">${body}</div>
    </section>
  `
}

function renderWebActionPanel(workOrderId: string, currentStatus: string, actions: ProcessWebAction[], detailHref: string): string {
  const actionable = actions.filter((action) => !action.disabledReason)
  const disabledReason = actions.find((action) => action.disabledReason)?.disabledReason
  const actionHref = (actionCode: string) => `${detailHref}?webAction=${encodeURIComponent(actionCode)}`
  return renderSection(
    '可执行动作',
    `
      <div class="space-y-3">
        ${renderInfoGrid([
          { label: '当前状态', value: escapeHtml(currentStatus) },
          { label: '操作方式', value: escapeHtml('仅展示当前状态允许的下一步动作') },
          { label: '数量口径', value: escapeHtml('操作裁片数量必须关联菲票，差异会写入统一差异记录') },
          { label: '禁止事项', value: escapeHtml('不新增后道工序作为特殊工艺动作') },
        ])}
        ${
          actionable.length
            ? `<div class="flex flex-wrap gap-2">
                ${actionable
                  .map(
                    (action) => `
                      <button
                        type="button"
                        class="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        data-nav="${escapeHtml(actionHref(action.actionCode))}"
                      >
                        ${escapeHtml(action.actionLabel)}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
              <div class="rounded-md border border-dashed bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                操作弹窗字段：${escapeHtml(actionable[0].requiredFields.join('、'))}；确认后写回特殊工艺事实源并生成 Web 端操作记录。
              </div>`
            : `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">${escapeHtml(disabledReason || '当前状态暂无可执行动作')}</div>`
        }
      </div>
    `,
  )
}

function renderWebOperationRecords(records: ProcessWebOperationRecord[]): string {
  return renderSection(
    'Web 端操作记录',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">操作动作</th>
              <th class="px-3 py-2 font-medium">前状态</th>
              <th class="px-3 py-2 font-medium">后状态</th>
              <th class="px-3 py-2 font-medium">操作人</th>
              <th class="px-3 py-2 font-medium">操作时间</th>
              <th class="px-3 py-2 font-medium">操作对象与数量单位</th>
              <th class="px-3 py-2 font-medium">来源</th>
              <th class="px-3 py-2 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            ${
              records.length
                ? records
                    .map(
                      (record) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.actionLabel)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.previousStatus)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.nextStatus)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.operatorName)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.operatedAt)}</td>
                          <td class="px-3 py-3 text-sm"><div>${escapeHtml(record.qtyLabel || '操作裁片数量')}</div><div class="text-xs text-muted-foreground">${formatQty(record.objectQty)} ${escapeHtml(record.qtyUnit)}</div></td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceChannel)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || '—')}</td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">暂无 Web 端状态操作记录</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `,
  )
}

function resolveDifferenceAction(): { differenceId: string; action: string } | undefined {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const params = new URLSearchParams(queryString)
  const differenceId = params.get('differenceId') || ''
  const action = params.get('differenceAction') || ''
  return differenceId && action ? { differenceId, action } : undefined
}

function applyDifferenceActionFromUrl(): void {
  const input = resolveDifferenceAction()
  if (!input) return
  if (input.action === 'apply-fei') {
    applySpecialCraftDifferenceToFeiTickets(input.differenceId, {
      operatorName: '平台处理员',
      reason: '特殊工艺差异同步菲票数量',
    })
    return
  }
  const actionMap: Record<string, Parameters<typeof handleProcessHandoverDifference>[1]['nextAction']> = {
    confirm: '确认差异继续流转',
    rework: '要求重新交出',
    close: '关闭记录',
    processing: '平台处理',
  }
  const nextAction = actionMap[input.action]
  if (!nextAction) return
  handleProcessHandoverDifference(input.differenceId, {
    handlingResult: nextAction,
    responsibilitySide: nextAction === '确认差异继续流转' ? '非工厂责任' : '待判定',
    nextAction,
    handledBy: '平台处理员',
    remark: '特殊工艺交出差异处理',
  })
}

function applyWebActionFromUrl(workOrderId: string): void {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const params = new URLSearchParams(queryString)
  const actionCode = params.get('webAction') || ''
  if (!actionCode) return
  const actionKey = `${workOrderId}:${actionCode}`
  if (consumedWebActionKeys.has(actionKey)) return
  consumedWebActionKeys.add(actionKey)
  try {
    executeProcessWebAction({
      sourceType: 'SPECIAL_CRAFT_WORK_ORDER',
      sourceId: workOrderId,
      actionCode,
      operatorName: 'Web 端工艺操作员',
      operatedAt: '2026-04-28 10:00',
      remark: '特殊工艺 Web 端状态操作',
    })
  } catch {
    // 页面仍展示当前可操作原因；失败不写入事实源。
  }
}

export function renderSpecialCraftWorkOrderDetailPage(operationSlug: string, workOrderId: string): string {
  applyDifferenceActionFromUrl()
  applyWebActionFromUrl(decodeURIComponent(workOrderId))
  const operation = getSpecialCraftOperationBySlug(operationSlug)
  const workOrder = getSpecialCraftTaskWorkOrderById(decodeURIComponent(workOrderId))
  if (!operation || !workOrder || workOrder.operationId !== operation.operationId) {
    return renderEmptyState('未找到对应工艺单。')
  }
  const factoryGuard = resolveSpecialCraftFactoryContextGuard(operation)
  if (factoryGuard.blocked) {
    return renderSpecialCraftFactoryContextBlockedLayout({
      operation,
      title: '工艺单详情',
      description: '查看工艺单明细、绑定菲票数量、差异上报和流转事件。',
      activeSubNav: 'tasks',
      factoryName: factoryGuard.factoryName,
    })
  }
  const taskOrder = getSpecialCraftTaskOrderById(workOrder.taskOrderId)
  const bindings = listCuttingSpecialCraftFeiTicketBindings().filter((binding) => binding.workOrderId === workOrder.workOrderId)
  const lines = getSpecialCraftTaskWorkOrderLinesByWorkOrderId(workOrder.workOrderId)
  const reports = listSpecialCraftQtyDifferenceReports().filter((report) => report.workOrderId === workOrder.workOrderId)
  const events = getSpecialCraftFeiTicketFlowEventsByWorkOrderId(workOrder.workOrderId)
  const warehouseRecords = getWarehouseRecordsByWorkOrderId(workOrder.workOrderId)
  const handoverRecords = getHandoverRecordsByWorkOrderId(workOrder.workOrderId)
  const unifiedDifferenceRecords = getDifferenceRecordsByWorkOrderId(workOrder.workOrderId)
  const webActions = getAvailableSpecialCraftWebActions(workOrder.workOrderId)
  const webOperationRecords = getProcessWebOperationRecordsBySource('SPECIAL_CRAFT_WORK_ORDER', workOrder.workOrderId)
  const mobileBinding = validateSpecialCraftMobileTaskBinding(workOrder.workOrderId)
  const mobileBindingReasonLabel =
    mobileBinding.reasonCode === 'TASK_NOT_VISIBLE_IN_MOBILE_LIST'
      ? '移动端执行列表不可见，请检查工厂或任务状态'
      : mobileBinding.reasonLabel
  const mobileExecutionTask = mobileBinding.actualTaskId ? getMobileExecutionTaskById(mobileBinding.actualTaskId) : null
  const mobileExecutionLink =
    mobileBinding.canOpenMobileExecution && mobileExecutionTask
      ? buildTaskDetailLink(mobileBinding.actualTaskId, {
          returnTo: buildMobileExecutionListLocatePathForTask(mobileExecutionTask, {
            currentFactoryId: workOrder.factoryId,
            keyword: workOrder.workOrderNo,
          }),
          sourceType: 'SPECIAL_CRAFT_WORK_ORDER',
          sourceId: workOrder.workOrderId,
          currentFactoryId: workOrder.factoryId,
          keyword: workOrder.workOrderNo,
        })
      : ''

  const basicInfo = renderInfoGrid([
    { label: '工艺单号', value: escapeHtml(workOrder.workOrderNo) },
    { label: '生产单', value: escapeHtml(workOrder.productionOrderNo) },
    { label: '特殊工艺', value: escapeHtml(workOrder.operationName) },
    { label: '工厂', value: escapeHtml(formatSpecialCraftFactoryLabel(workOrder.factoryName, workOrder.factoryId)) },
    { label: '裁片部位', value: escapeHtml(workOrder.partName) },
    { label: '原裁片数量', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.originalQty, 0))} 片` },
    { label: '当前裁片数量', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.currentQty, 0) || workOrder.currentQty)} 片` },
    { label: '累计报废裁片数量', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.cumulativeScrapQty, 0) || workOrder.scrapQty)} 片` },
    { label: '累计货损裁片数量', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.cumulativeDamageQty, 0) || workOrder.damageQty)} 片` },
    { label: '已回仓裁片数量', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.returnedQty, 0) || workOrder.returnedQty)} 片` },
    { label: '当前状态', value: renderStatusBadge(workOrder.status) },
    { label: '绑定菲票数量', value: escapeHtml(bindings.map((binding) => binding.feiTicketNo).join('、') || '待绑定') },
    { label: '统一仓记录', value: escapeHtml(warehouseRecords.map((record) => record.warehouseRecordNo).join('、') || '暂无') },
    { label: '统一交出记录', value: escapeHtml(handoverRecords.map((record) => record.handoverRecordNo).join('、') || '暂无') },
  ])
  const mobileBindingInfo = `
    <div class="mt-4 space-y-3">
      ${renderInfoGrid([
        { label: '移动端执行任务号', value: escapeHtml(mobileBinding.actualTaskNo || mobileBinding.expectedTaskNo || '未绑定') },
        { label: '绑定状态', value: escapeHtml(mobileBinding.canOpenMobileExecution ? '有效' : '不可执行') },
        { label: '校验结果', value: escapeHtml(mobileBinding.canOpenMobileExecution ? '允许打开移动端执行页' : '当前不可执行') },
        { label: '不可执行原因', value: escapeHtml(mobileBindingReasonLabel) },
      ])}
      <div class="flex flex-wrap gap-2">
        ${
          mobileBinding.canOpenMobileExecution
            ? `<button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${escapeHtml(mobileExecutionLink)}">打开移动端执行页</button>`
            : '<button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm opacity-50" disabled>打开移动端执行页</button>'
        }
        <span class="inline-flex items-center rounded-md border ${mobileBinding.canOpenMobileExecution ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'} px-3 py-2 text-xs">${escapeHtml(mobileBinding.suggestedAction)}</span>
      </div>
    </div>
  `

  const lineRows = lines
    .map(
      (line) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(line.colorName)}</td>
          <td class="px-3 py-3">${escapeHtml(line.sizeCode)}</td>
          <td class="px-3 py-3">${formatQty(line.planPieceQty)}</td>
          <td class="px-3 py-3">${formatQty(bindings.filter((binding) => binding.workOrderLineId === line.lineId).reduce((sum, binding) => sum + binding.currentQty, 0))}</td>
          <td class="px-3 py-3">${escapeHtml(line.feiTicketNos.join('、') || '待绑定')}</td>
        </tr>
      `,
    )
    .join('')

  const bindingRows = bindings
    .map(
      (binding) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(binding.feiTicketNo)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.colorName)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.sizeCode)}</td>
          <td class="px-3 py-3">${formatQty(binding.originalQty)}</td>
          <td class="px-3 py-3">${formatQty(binding.currentQty)}</td>
          <td class="px-3 py-3">${formatQty(binding.cumulativeScrapQty)}</td>
          <td class="px-3 py-3">${formatQty(binding.cumulativeDamageQty)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.completedOperationNames.join('、') || '—')}</td>
          <td class="px-3 py-3">${renderStatusBadge(binding.specialCraftFlowStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.receiveDifferenceStatus || binding.returnDifferenceStatus || '—')}</td>
        </tr>
      `,
    )
    .join('')

  const reportRows = reports
    .map(
      (report) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(report.reportPhase)}</td>
          <td class="px-3 py-3">${escapeHtml(report.feiTicketNo)}</td>
          <td class="px-3 py-3">${formatQty(report.expectedQty)}</td>
          <td class="px-3 py-3">${formatQty(report.actualQty)}</td>
          <td class="px-3 py-3">${formatQty(report.differenceQty)}</td>
          <td class="px-3 py-3">${renderStatusBadge(report.platformStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(report.reason)}</td>
          <td class="px-3 py-3">—</td>
        </tr>
      `,
    )
    .join('')
  const detailHref = buildSpecialCraftWorkOrderDetailPath(operation, workOrder.workOrderId)
  const unifiedDifferenceRows = unifiedDifferenceRecords
    .map(
      (record) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(record.differenceType)}</td>
          <td class="px-3 py-3">${escapeHtml(record.relatedFeiTicketIds.join('、') || '—')}</td>
          <td class="px-3 py-3">${formatQty(record.expectedObjectQty)}</td>
          <td class="px-3 py-3">${formatQty(record.actualObjectQty)}</td>
          <td class="px-3 py-3">${formatQty(record.diffObjectQty)}</td>
          <td class="px-3 py-3">${renderStatusBadge(record.status)}</td>
          <td class="px-3 py-3">${escapeHtml(record.remark || record.handlingResult || '统一交出差异')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(`${detailHref}?tab=difference&differenceId=${record.differenceRecordId}&differenceAction=apply-fei`)}">同步菲票数量</button>
              <button class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(`${detailHref}?tab=difference&differenceId=${record.differenceRecordId}&differenceAction=confirm`)}">确认差异继续流转</button>
              <button class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(`${detailHref}?tab=difference&differenceId=${record.differenceRecordId}&differenceAction=rework`)}">要求重新交出</button>
              <button class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(`${detailHref}?tab=difference&differenceId=${record.differenceRecordId}&differenceAction=processing`)}">标记平台处理中</button>
              <button class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(buildHandoverDifferenceRequestPrintLink(record.differenceRecordId))}">打印差异处理申请单</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')

  const eventRows = events
    .map(
      (event) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(event.eventType)}</td>
          <td class="px-3 py-3">${escapeHtml(event.feiTicketNo)}</td>
          <td class="px-3 py-3">${event.beforeQty ?? '—'}</td>
          <td class="px-3 py-3">${event.changedQty ?? '—'}</td>
          <td class="px-3 py-3">${event.afterQty ?? '—'}</td>
          <td class="px-3 py-3">${escapeHtml(event.operatorName)}</td>
          <td class="px-3 py-3">${escapeHtml(event.occurredAt)}</td>
          <td class="px-3 py-3">${escapeHtml(event.relatedRecordNo || '—')}</td>
        </tr>
      `,
    )
    .join('')
  const unifiedHandoverRows = handoverRecords
    .map(
      (record) => `
        <tr class="align-top">
          <td class="px-3 py-3">统一交出记录</td>
          <td class="px-3 py-3">—</td>
          <td class="px-3 py-3">${formatQty(record.handoverObjectQty)}</td>
          <td class="px-3 py-3">${formatQty(record.receiveObjectQty - record.handoverObjectQty)}</td>
          <td class="px-3 py-3">${formatQty(record.receiveObjectQty)}</td>
          <td class="px-3 py-3">${escapeHtml(record.handoverPerson)}</td>
          <td class="px-3 py-3">${escapeHtml(record.handoverAt)}</td>
          <td class="px-3 py-3">${escapeHtml(record.handoverRecordNo)}</td>
        </tr>
      `,
    )
    .join('')

  const quantityRows = events
    .filter((event) => event.beforeQty !== undefined || event.changedQty !== undefined || event.afterQty !== undefined)
    .map(
      (event) => `
        <tr class="align-top">
          <td class="px-3 py-3">${event.beforeQty ?? '—'}</td>
          <td class="px-3 py-3">${event.changedQty ?? '—'}</td>
          <td class="px-3 py-3">${event.afterQty ?? '—'}</td>
          <td class="px-3 py-3">${escapeHtml(event.operatorName)}</td>
          <td class="px-3 py-3">${escapeHtml(event.occurredAt)}</td>
          <td class="px-3 py-3">${escapeHtml(event.relatedRecordNo || '—')}</td>
        </tr>
      `,
    )
    .join('')

  const activeTab = getCurrentDetailTab()
  const sections: Record<SpecialCraftDetailTab, string> = {
    base: renderSection('基本信息', `${basicInfo}${mobileBindingInfo}`),
    lines: renderSection('明细行', lineRows ? renderTable(['颜色', '尺码', '计划裁片数量', '当前裁片数量', '绑定菲票数量'], lineRows, 'min-w-[820px]') : renderEmptyState('暂无明细行')),
    fei: renderSection('绑定菲票数量', bindingRows ? renderTable(['菲票号', '颜色', '尺码', '原裁片数量', '当前裁片数量', '累计报废裁片数量', '累计货损裁片数量', '已完成特殊工艺', '状态', '差异状态'], bindingRows, 'min-w-[1180px]') : renderEmptyState('暂无绑定菲票数量')),
    quantity: renderSection('数量变化', quantityRows ? renderTable(['前裁片数量', '变化裁片数量', '后裁片数量', '操作人', '时间', '关联记录'], quantityRows, 'min-w-[900px]') : renderEmptyState('暂无数量变化')),
    difference: renderSection(
      '差异上报',
      reportRows || unifiedDifferenceRows
        ? renderTable(['差异类型', '菲票号', '交出裁片数量', '实收裁片数量', '差异裁片数量', '平台状态', '原因', '操作'], `${reportRows}${unifiedDifferenceRows}`, 'min-w-[1280px]')
        : renderEmptyState('暂无差异上报'),
    ),
    events: renderSection(
      '流转记录',
      eventRows || unifiedHandoverRows
        ? renderTable(['事件', '菲票号', '前裁片数量', '变化裁片数量', '后裁片数量', '操作人', '时间', '关联记录'], `${eventRows}${unifiedHandoverRows}`, 'min-w-[1080px]')
        : renderEmptyState('暂无流转记录'),
    ),
  }

  const content = [
    renderDetailTabs(detailHref, activeTab),
    renderWebActionPanel(workOrder.workOrderId, workOrder.status, webActions, detailHref),
    sections[activeTab],
    renderWebOperationRecords(webOperationRecords),
    mobileBinding.canOpenMobileExecution
      ? `<button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${escapeHtml(mobileExecutionLink)}">打开移动端执行页</button>`
      : `<span class="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">不可执行：${escapeHtml(mobileBindingReasonLabel)}</span>`,
    `<button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${buildSpecialCraftTaskDetailPath(operation, taskOrder?.taskOrderId || workOrder.taskOrderId)}">返回任务详情</button>`,
  ].join('')

  return renderSpecialCraftPageLayout({
    operation,
    title: '工艺单详情',
    description: '按裁片部位展示特殊工艺执行、数量变化、差异上报和流转事件。',
    activeSubNav: 'tasks',
    content,
  })
}

export function handleSpecialCraftWorkOrderDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-special-craft-web-action]')
  if (!actionNode) return false
  const sourceId = actionNode.dataset.sourceId
  const actionCode = actionNode.dataset.actionCode
  if (!sourceId || !actionCode) return true
  try {
    executeProcessWebAction({
      sourceType: 'SPECIAL_CRAFT_WORK_ORDER',
      sourceId,
      actionCode,
      operatorName: 'Web 端工艺操作员',
      operatedAt: '2026-04-28 10:00',
      remark: '特殊工艺 Web 端状态操作',
    })
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.alert(error instanceof Error ? error.message : '状态操作失败')
    }
  }
  return true
}
