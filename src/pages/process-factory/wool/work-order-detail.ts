import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils'
import {
  buildWoolPartPanelFeiTicketSourceId,
  getWoolWorkOrderById,
  getWoolAllowedActions,
  getWoolYarnUsageSummary,
  getWoolWorkOrderKindLabel,
  getWoolWorkOrderStatusLabel,
  listWoolMobileProcessTasks,
  type WoolWorkOrder,
} from '../../../data/fcs/wool-task-domain.ts'
import {
  buildFeiTicketLabelPrintLink,
  buildWoolMachineScheduleLink,
  buildWoolMachinesLink,
  buildWoolWaitHandoverWarehouseLink,
  buildWoolWaitProcessWarehouseLink,
  buildWoolWorkOrderDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import { getTaskMilestoneState } from '../../../data/fcs/pda-exec-link.ts'
import { getTaskStartDueInfo, getTaskStartRuleState } from '../../../data/fcs/pda-start-link.ts'
import {
  formatMoney,
  formatQty,
  renderBadge,
  renderField,
  renderKindBadge,
  renderPageHeader,
  renderPaginatedTable,
  renderSection,
  renderStatusBadge,
} from './shared'

type WoolDetailTab = 'base' | 'yarn' | 'machine' | 'whole' | 'fei' | 'handover' | 'price' | 'evidence'

function getDetailTabs(order: WoolWorkOrder): Array<{ key: WoolDetailTab; label: string }> {
  const tabs: Array<{ key: WoolDetailTab; label: string }> = [
    { key: 'base', label: '基本信息' },
    { key: 'yarn', label: '领料信息' },
    { key: 'machine', label: '横机成片' },
  ]

  if (order.kind === 'WHOLE_GARMENT') {
    tabs.push({ key: 'whole', label: '缝盘熨烫包装' })
  } else {
    tabs.push({ key: 'fei', label: '毛织菲票' })
  }

  tabs.push(
    { key: 'handover', label: '送货交出' },
    { key: 'price', label: '价格信息' },
    { key: 'evidence', label: '异常证据' },
  )

  return tabs
}

function getCurrentTab(order: WoolWorkOrder): WoolDetailTab {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const tab = new URLSearchParams(queryString).get('tab') as WoolDetailTab | null
  const tabs = getDetailTabs(order)
  return tabs.some((item) => item.key === tab) ? tab || 'base' : 'base'
}

function renderDetailTabs(order: WoolWorkOrder, activeTab: WoolDetailTab): string {
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${getDetailTabs(order)
        .map((item) => {
          const active = item.key === activeTab
          return `
            <button
              type="button"
              class="rounded px-3 py-1.5 text-sm ${active ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
              data-nav="${escapeHtml(buildWoolWorkOrderDetailLink(order.woolOrderId, item.key))}"
            >
              ${escapeHtml(item.label)}
            </button>
          `
        })
        .join('')}
    </nav>
  `
}

function getOrderExecutionTask(order: WoolWorkOrder) {
  return listWoolMobileProcessTasks().find((task) => task.taskId === order.taskNo)
}

function getStartStatusLabel(order: WoolWorkOrder): string {
  if (order.status === 'WAIT_ACCEPT') return '未接单'
  if (order.status === 'WAIT_PICKUP') return '待领料'
  if (order.status === 'PICKUP_IN_PROGRESS') return '领料中'
  if (order.status === 'WAIT_MACHINE_SCHEDULE') return '待排机'
  const task = getOrderExecutionTask(order)
  if (!task) return '移动端任务未同步'
  const rule = getTaskStartRuleState(task)
  if (!rule.required) return '不要求开工'
  if (task.startedAt) return '已开工'
  return task.acceptedAt ? '待开工' : '待领料'
}

function renderNodeActions(order: WoolWorkOrder, nodeName: string): string {
  const actions = getWoolAllowedActions(order).filter((action) => action.nodeName === nodeName)
  if (!actions.length) return '<span class="text-xs text-muted-foreground">当前不可操作</span>'
  return `
    <div class="flex flex-wrap gap-2">
      ${actions.map((action) => `
        <button
          type="button"
          class="rounded-md border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
          data-wool-workflow-action="${escapeHtml(action.code)}"
          data-wool-order-id="${escapeHtml(order.woolOrderId)}"
          data-node-name="${escapeHtml(nodeName)}"
        >${escapeHtml(action.label)}</button>
      `).join('')}
    </div>
  `
}

function getMilestoneStatusLabel(order: WoolWorkOrder): string {
  const task = getOrderExecutionTask(order)
  if (!task) return '移动端任务未同步'
  const milestone = getTaskMilestoneState(task)
  if (!milestone.required) return '不要求关键节点'
  return milestone.status === 'REPORTED' ? '已上报' : '待上报'
}

function getMilestoneQtyText(order: WoolWorkOrder): string {
  const task = getOrderExecutionTask(order)
  if (!task) return '未同步'
  const milestone = getTaskMilestoneState(task)
  if (!milestone.reportedQty) return '未上报'
  const unit = order.kind === 'PART_PANEL' ? '片' : '件'
  return formatQty(milestone.reportedQty, unit)
}

function renderDetailWorkflowActions(order: WoolWorkOrder): string {
  const actions = getWoolAllowedActions(order)
  if (!actions.length) return ''
  return actions.map((action) => `
    <button
      type="button"
      class="rounded-md ${action.tone === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border hover:bg-muted'} px-3 py-2 text-sm font-medium"
      data-wool-workflow-action="${escapeHtml(action.code)}"
      data-wool-order-id="${escapeHtml(order.woolOrderId)}"
      ${action.nodeName ? `data-node-name="${escapeHtml(action.nodeName)}"` : ''}
    >${escapeHtml(action.label)}</button>
  `).join('')
}

function renderExecutionReportSection(order: WoolWorkOrder): string {
  const task = getOrderExecutionTask(order)
  if (!task) {
    return renderSection(
      '开工与关键节点',
      '<div class="text-sm text-muted-foreground">当前毛织加工单尚未同步到工厂端移动任务。</div>',
    )
  }

  const startRule = getTaskStartRuleState(task)
  const startDue = getTaskStartDueInfo(task)
  const milestone = getTaskMilestoneState(task)
  const startProofCount = task.startProofFiles?.length ?? 0
  const milestoneProofCount = milestone.proofFiles.length
  const overdueText = milestone.overdueExceptionEnabled
    ? `${milestone.overdueHours} 小时未上报生成 ${milestone.exceptionSeverity} 执行异常`
    : '不启用'

  return renderSection(
    '开工与关键节点',
    `
      <div class="grid gap-3 lg:grid-cols-2">
        <article class="rounded-md border bg-muted/20 p-3">
          <div class="flex items-center justify-between gap-3">
            <div class="text-sm font-medium">开工确认</div>
            ${renderBadge(getStartStatusLabel(order), task.startedAt ? 'success' : startRule.required ? 'warning' : 'muted')}
          </div>
          <div class="mt-3 grid gap-2 text-sm md:grid-cols-2">
            ${renderField('配置规则', startRule.ruleLabel)}
            ${renderField('凭证要求', startRule.proofRequirementLabel)}
            ${renderField('开工时间', task.startedAt || '未开工')}
            ${renderField('开工时限', startDue.startDueAt || (task.acceptedAt ? `接单后 ${startRule.dueHours} 小时内` : '待领料完成后计算'))}
            ${renderField('凭证数量', `${startProofCount} 个`)}
            ${renderField('前置状态', startDue.prerequisiteMet ? '已满足' : '待完成领料单与横机排产')}
          </div>
        </article>
        <article class="rounded-md border bg-muted/20 p-3">
          <div class="flex items-center justify-between gap-3">
            <div class="text-sm font-medium">关键节点上报</div>
            ${renderBadge(getMilestoneStatusLabel(order), milestone.status === 'REPORTED' ? 'success' : milestone.required ? 'warning' : 'muted')}
          </div>
          <div class="mt-3 grid gap-2 text-sm md:grid-cols-2">
            ${renderField('配置规则', milestone.required ? milestone.ruleLabel : '不要求关键节点上报')}
            ${renderField('凭证要求', milestone.proofRequirementLabel)}
            ${renderField('上报时间', milestone.reportedAt || '未上报')}
            ${renderField('上报数量', getMilestoneQtyText(order))}
            ${renderField('凭证数量', `${milestoneProofCount} 个`)}
            ${renderField('超时异常', overdueText)}
          </div>
        </article>
      </div>
      <div class="mt-3 grid gap-3 text-sm md:grid-cols-3">
        ${renderField('移动端任务', task.taskNo || task.taskId)}
        ${renderField('执行工厂', task.assignedFactoryName || order.factoryName)}
        ${renderField('完成交出', order.downstreamTarget)}
      </div>
    `,
  )
}

function renderBaseTab(order: WoolWorkOrder): string {
  const yarnUsage = getWoolYarnUsageSummary(order)
  return `
    ${renderSection(
      '加工单概览',
      `
        <div class="grid gap-3 text-sm md:grid-cols-3">
          ${renderField('毛织单号', order.woolOrderNo)}
          ${renderField('任务类型', getWoolWorkOrderKindLabel(order.kind))}
          ${renderField('当前状态', getWoolWorkOrderStatusLabel(order.status))}
          ${renderField('生产单', order.productionOrderNo)}
          ${renderField('款号', order.styleNo)}
          ${renderField('款式名称', order.styleName)}
          ${renderField('颜色', order.colorName)}
          ${renderField('尺码范围', order.sizeRange)}
          ${renderField('计划数量', `${order.plannedQty} ${order.qtyUnit}`)}
          ${renderField('开工领用纱线', formatQty(yarnUsage.processingUsageWeightKg, 'kg'))}
          ${renderField('缝盘损耗纱线', formatQty(yarnUsage.linkingLossWeightKg, 'kg'))}
          ${renderField('回收入仓纱线', formatQty(yarnUsage.recoveredWeightKg, 'kg'))}
          ${renderField('毛织工厂', order.factoryName)}
          ${renderField('交出对象', order.downstreamTarget)}
          ${renderField('包装要求', order.kind === 'WHOLE_GARMENT' ? (order.needsPackaging ? '需要包装' : '无需包装') : '部位毛织无包装节点')}
        </div>
      `,
    )}
    ${renderExecutionReportSection(order)}
  `
}

function renderYarnTab(order: WoolWorkOrder): string {
  const receipt = order.yarnReceipt
  const yarnUsage = getWoolYarnUsageSummary(order)
  return renderSection(
    '领料信息',
    `
      <div class="grid gap-3 text-sm md:grid-cols-3">
        ${renderField('纱线 SKU', receipt.yarnSku)}
        ${renderField('纱线名称', receipt.yarnName)}
        ${renderField('纱线颜色', receipt.colorName)}
        ${renderField('计划送料重量', formatQty(receipt.plannedWeightKg, 'kg'))}
        ${renderField('毛织厂实收重量', formatQty(receipt.receivedWeightKg, 'kg'))}
        ${renderField('差异重量', formatQty(receipt.differenceWeightKg, 'kg'))}
        ${renderField('开工领用重量', formatQty(yarnUsage.processingUsageWeightKg, 'kg'))}
        ${renderField('缝盘损耗重量', formatQty(yarnUsage.linkingLossWeightKg, 'kg'))}
        ${renderField('回收入仓重量', formatQty(yarnUsage.recoveredWeightKg, 'kg'))}
        ${renderField('待加工仓结余', formatQty(yarnUsage.waitProcessStockWeightKg, 'kg'))}
        ${renderField('确认人', receipt.receiverName)}
        ${renderField('确认时间', receipt.receivedAt)}
        ${renderField('证据', receipt.evidenceText || '无差异证据')}
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildWoolWaitProcessWarehouseLink(order.woolOrderId))}">查看待加工仓</button>
      </div>
    `,
  )
}

function renderMachineTab(order: WoolWorkOrder): string {
  const yarnUsage = getWoolYarnUsageSummary(order)
  const nodes = order.nodes.filter((node) => node.nodeName === '横机成片')

  return renderSection(
    '横机成片',
    `
      <div class="mb-3 grid gap-3 text-sm md:grid-cols-3">
        ${renderField('计划横机台数', `${order.plannedMachineCount} 台`)}
        ${renderField('计划开始', order.scheduledStartAt)}
        ${renderField('计划完成', order.scheduledEndAt)}
      </div>
      <div class="mb-3 flex flex-wrap gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildWoolMachineScheduleLink(order.woolOrderId))}">查看横机排产</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildWoolMachinesLink())}">查看横机设备</button>
      </div>
      ${renderPaginatedTable(
        ['节点', '状态', '计划数量', '完成数量', '开工领用纱线', '横机编号', '操作人', '开始时间', '完成时间', 'Web操作'],
        nodes,
        (node) => `
          <tr class="border-b last:border-b-0">
            <td class="px-3 py-3">${escapeHtml(node.nodeName)}</td>
            <td class="px-3 py-3">${renderBadge(node.status, node.status === '已完成' ? 'success' : node.status === '进行中' ? 'info' : 'muted')}</td>
            <td class="px-3 py-3">${formatQty(node.plannedQty, node.unit)}</td>
            <td class="px-3 py-3">${formatQty(node.completedQty, node.unit)}</td>
            <td class="px-3 py-3">${formatQty(yarnUsage.processingUsageWeightKg, 'kg')}</td>
            <td class="px-3 py-3">${escapeHtml(node.machineNos?.join('、') || '未排机')}</td>
            <td class="px-3 py-3">${escapeHtml(node.operatorName || '—')}</td>
            <td class="px-3 py-3">${escapeHtml(node.startedAt || '—')}</td>
            <td class="px-3 py-3">${escapeHtml(node.finishedAt || '—')}</td>
            <td class="px-3 py-3">${renderNodeActions(order, node.nodeName)}</td>
          </tr>
        `,
        'min-w-[1400px]',
        'detailMachinePage',
        '条横机节点',
      )}
    `,
  )
}

function renderWholeTab(order: WoolWorkOrder): string {
  const yarnUsage = getWoolYarnUsageSummary(order)
  const nodes = order.nodes.filter((node) => node.nodeName !== '横机成片')

  return renderSection(
    '整件毛织节点',
    `
      <div class="mb-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        整件毛织固定包含缝盘和熨烫；包装按加工单要求决定是否执行。
      </div>
      ${renderPaginatedTable(
        ['节点', '状态', '计划数量', '完成数量', '纱线损耗', '操作人', '开始时间', '完成时间', '备注', 'Web操作'],
        nodes,
        (node) => `
          <tr class="border-b last:border-b-0">
            <td class="px-3 py-3">${escapeHtml(node.nodeName)}</td>
            <td class="px-3 py-3">${renderBadge(node.status, node.status === '已完成' ? 'success' : node.status === '进行中' ? 'info' : node.status === '已跳过' ? 'muted' : 'warning')}</td>
            <td class="px-3 py-3">${formatQty(node.plannedQty, node.unit)}</td>
            <td class="px-3 py-3">${formatQty(node.completedQty, node.unit)}</td>
            <td class="px-3 py-3">${node.nodeName === '缝盘' ? formatQty(yarnUsage.linkingLossWeightKg, 'kg') : '—'}</td>
            <td class="px-3 py-3">${escapeHtml(node.operatorName || '—')}</td>
            <td class="px-3 py-3">${escapeHtml(node.startedAt || '—')}</td>
            <td class="px-3 py-3">${escapeHtml(node.finishedAt || '—')}</td>
            <td class="px-3 py-3">${escapeHtml(node.remark || '—')}</td>
            <td class="px-3 py-3">${renderNodeActions(order, node.nodeName)}</td>
          </tr>
        `,
        'min-w-[1400px]',
        'detailWholePage',
        '条整件节点',
      )}
    `,
  )
}

function renderFeiTab(order: WoolWorkOrder): string {
  const panels = order.partPanels
  return renderSection(
    '部位毛织菲票',
    `
      <div class="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        部位毛织只包含横机成片和菲票流转，不进入缝盘、熨烫、包装节点。
      </div>
      ${renderPaginatedTable(
        ['部位', '颜色', '尺码', '计划片数', '完成片数', '菲票号', '打印状态', '后续去向', '操作'],
        panels,
        (panel) => {
      const sourceId = buildWoolPartPanelFeiTicketSourceId(order, panel)
      return `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(panel.partName)}</td>
          <td class="px-3 py-3">${escapeHtml(panel.colorName)}</td>
          <td class="px-3 py-3">${escapeHtml(panel.sizeCode)}</td>
          <td class="px-3 py-3">${formatQty(panel.plannedPieces, '片')}</td>
          <td class="px-3 py-3">${formatQty(panel.completedPieces, '片')}</td>
          <td class="px-3 py-3">${escapeHtml(panel.feiTicketNo || '待生成')}</td>
          <td class="px-3 py-3">${renderBadge(panel.feiTicketStatus, panel.feiTicketStatus === '已打印' ? 'success' : 'warning')}</td>
          <td class="px-3 py-3">${escapeHtml(order.downstreamTarget)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildFeiTicketLabelPrintLink(sourceId, 'first'))}">${panel.feiTicketStatus === '已打印' ? '打印预览' : '打印菲票'}</button>
              ${
                panel.feiTicketStatus === '已打印'
                  ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildFeiTicketLabelPrintLink(sourceId, 'reprint'))}">补打</button>`
                  : ''
              }
            </div>
          </td>
        </tr>
      `
        },
        'min-w-[1280px]',
        'detailFeiPage',
        '行菲票',
      )}
    `,
  )
}

function renderHandoverTab(order: WoolWorkOrder): string {
  const handoverActions = getWoolAllowedActions(order).filter((action) =>
    action.code === 'SUBMIT_HANDOVER' || action.code === 'CONFIRM_HANDOVER_RECEIPT',
  )
  return renderSection(
    '送货交出',
    `
      <div class="grid gap-3 text-sm md:grid-cols-3">
        ${renderField('交出对象', order.downstreamTarget)}
        ${renderField('交出单', order.handoverOrderNo || '未生成')}
        ${renderField('待交数量', formatQty(order.completedQty, order.qtyUnit))}
        ${renderField('已交数量', typeof order.handoverQty === 'number' ? formatQty(order.handoverQty, order.qtyUnit) : '未交出')}
        ${renderField('接收方回写', typeof order.receiverWrittenQty === 'number' ? formatQty(order.receiverWrittenQty, order.qtyUnit) : '未回写')}
        ${renderField('交出差异', typeof order.handoverDifferenceQty === 'number' ? formatQty(order.handoverDifferenceQty, order.qtyUnit) : '暂无差异')}
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        ${handoverActions.map((action) => `
          <button
            type="button"
            class="rounded-md ${action.tone === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border hover:bg-muted'} px-3 py-2 text-sm font-medium"
            data-wool-workflow-action="${escapeHtml(action.code)}"
            data-wool-order-id="${escapeHtml(order.woolOrderId)}"
          >${escapeHtml(action.label)}</button>
        `).join('')}
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildWoolWaitHandoverWarehouseLink(order.woolOrderId))}">查看待交出仓</button>
      </div>
    `,
  )
}

function renderPriceTab(order: WoolWorkOrder): string {
  return renderSection(
    '价格信息',
    `
      <div class="grid gap-3 text-sm md:grid-cols-3">
        ${renderField('横机时间', `${order.priceInfo.flatWoolMinutes} 分钟/件或片`)}
        ${renderField('缝盘时间', order.priceInfo.linkingMinutes ? `${order.priceInfo.linkingMinutes} 分钟/件` : '部位毛织无缝盘')}
        ${renderField('熨烫计价', order.priceInfo.ironingIncluded ? '包含' : '不包含')}
        ${renderField('包装计价', order.priceInfo.packagingIncluded ? '包含' : '不包含')}
        ${renderField('公式状态', order.priceInfo.formulaStatus === '已估算' ? '已按临时公式估算' : '待提供正式公式')}
        ${renderField('估算派单价', formatMoney(order.priceInfo.estimatedDispatchPrice, order.priceInfo.currency))}
      </div>
      <div class="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">${escapeHtml(order.priceInfo.remark)}</div>
    `,
  )
}

function renderEvidenceTab(order: WoolWorkOrder): string {
  return renderSection(
    '异常证据',
    renderPaginatedTable(
      ['事项', '说明', '提交人', '提交时间'],
      order.evidenceItems,
      (item) => `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(item.title)}</td>
          <td class="px-3 py-3">${escapeHtml(item.description)}</td>
          <td class="px-3 py-3">${escapeHtml(item.ownerName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.createdAt)}</td>
        </tr>
      `,
      'min-w-[960px]',
      'detailEvidencePage',
      '条证据',
    ),
  )
}

function renderActiveTab(order: WoolWorkOrder, activeTab: WoolDetailTab): string {
  if (activeTab === 'yarn') return renderYarnTab(order)
  if (activeTab === 'machine') return renderMachineTab(order)
  if (activeTab === 'whole' && order.kind === 'WHOLE_GARMENT') return renderWholeTab(order)
  if (activeTab === 'fei' && order.kind === 'PART_PANEL') return renderFeiTab(order)
  if (activeTab === 'handover') return renderHandoverTab(order)
  if (activeTab === 'price') return renderPriceTab(order)
  if (activeTab === 'evidence') return renderEvidenceTab(order)
  return renderBaseTab(order)
}

export function renderCraftWoolWorkOrderDetailPage(woolOrderId: string): string {
  const order = getWoolWorkOrderById(woolOrderId)
  if (!order) {
    return `
      <div class="space-y-4 p-4">
        ${renderPageHeader('毛织加工单详情', '未找到对应的毛织加工单')}
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/wool/work-orders">返回毛织加工单</button>
      </div>
    `
  }

  const activeTab = getCurrentTab(order)

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader(
        '毛织加工单详情',
        `${order.woolOrderNo} / ${getWoolWorkOrderKindLabel(order.kind)} / ${order.downstreamTarget}`,
        `
          <div class="flex flex-wrap gap-2">
            ${renderDetailWorkflowActions(order)}
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/wool/work-orders">返回毛织加工单</button>
          </div>
        `,
      )}
      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-center gap-2">
          ${renderKindBadge(order.kind)}
          ${renderStatusBadge(order.status)}
          <span class="text-sm text-muted-foreground">${escapeHtml(order.styleName)} / ${escapeHtml(order.colorName)} / ${escapeHtml(order.sizeRange)}</span>
        </div>
      </section>
      ${renderDetailTabs(order, activeTab)}
      ${renderActiveTab(order, activeTab)}
    </div>
  `
}
