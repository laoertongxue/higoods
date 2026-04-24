import {
  buildSpecialCraftPreferredWarehousePath,
  buildSpecialCraftTaskOrdersPath,
  buildSpecialCraftWorkOrderDetailPath,
  getSpecialCraftOperationBySlug,
} from '../../../data/fcs/special-craft-operations.ts'
import { buildTaskRouteCardPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  getSpecialCraftTaskOrderById,
  getSpecialCraftTaskWorkOrdersByTaskOrderId,
} from '../../../data/fcs/special-craft-task-orders.ts'
import {
  getSpecialCraftBindingsByTaskOrderId,
  getSpecialCraftQtyDifferenceReportsByTaskOrderId,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatQty,
  renderEmptyState,
  renderSpecialCraftFactoryContextBlockedLayout,
  renderSpecialCraftPageLayout,
  resolveSpecialCraftFactoryContextGuard,
  renderStatusBadge,
  renderTable,
} from './shared.ts'

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
    return renderEmptyState('未找到对应特殊工艺任务详情。')
  }
  const factoryGuard = resolveSpecialCraftFactoryContextGuard(operation)
  if (factoryGuard.blocked) {
    return renderSpecialCraftFactoryContextBlockedLayout({
      operation,
      title: `${operation.operationName}任务详情`,
      description: '查看任务明细、子工艺单、菲票流转和差异上报。',
      activeSubNav: 'tasks',
      factoryName: factoryGuard.factoryName,
    })
  }

  const basicInfo = renderInfoGrid([
    { label: '任务号', value: escapeHtml(taskOrder.taskOrderNo) },
    { label: '生产单', value: escapeHtml(taskOrder.productionOrderNo) },
    { label: '来源', value: escapeHtml(taskOrder.generationSourceLabel || '生产单生成') },
    { label: '技术包版本', value: escapeHtml(taskOrder.techPackVersion || '—') },
    { label: '生成批次', value: escapeHtml(taskOrder.generationBatchId || '—') },
    { label: '特殊工艺', value: escapeHtml(taskOrder.operationName) },
    { label: '执行工厂', value: escapeHtml(taskOrder.factoryName) },
    { label: '作用对象', value: escapeHtml(taskOrder.targetObject) },
    { label: '分配状态', value: renderStatusBadge(taskOrder.assignmentStatusLabel || '待分配') },
    { label: '执行状态', value: renderStatusBadge(taskOrder.executionStatusLabel || taskOrder.status) },
    { label: '计划裁片数量', value: `${formatQty(taskOrder.planQty)}${escapeHtml(taskOrder.unit)}` },
    { label: '已接收裁片数量', value: `${formatQty(taskOrder.receivedQty)}${escapeHtml(taskOrder.unit)}` },
    { label: '已完成裁片数量', value: `${formatQty(taskOrder.completedQty)}${escapeHtml(taskOrder.unit)}` },
    { label: '待交出裁片数量', value: `${formatQty(taskOrder.waitHandoverQty)}${escapeHtml(taskOrder.unit)}` },
    { label: '当前状态', value: renderStatusBadge(taskOrder.status) },
    { label: '异常状态', value: renderStatusBadge(taskOrder.abnormalStatus) },
    { label: '交期', value: escapeHtml(taskOrder.dueAt.slice(0, 10)) },
  ])

  const pieceInfo = isCutPieceTarget(taskOrder.targetObject)
    ? renderInfoGrid([
        { label: '裁片部位', value: escapeHtml(taskOrder.partName || '—') },
        { label: '颜色', value: escapeHtml(taskOrder.fabricColor || '—') },
        { label: '尺码', value: escapeHtml(taskOrder.sizeCode || '—') },
        { label: '菲票号', value: escapeHtml(taskOrder.feiTicketNos.join('、') || '待绑定') },
        { label: '中转袋号', value: escapeHtml(taskOrder.transferBagNos.join('、') || '—') },
        { label: '数量', value: `${formatQty(taskOrder.planQty)}${escapeHtml(taskOrder.unit)}` },
      ])
    : ''

  const fabricInfo = isFabricTarget(taskOrder.targetObject)
    ? renderInfoGrid([
        { label: '面料 SKU', value: escapeHtml(taskOrder.materialSku || '—') },
        { label: '颜色', value: escapeHtml(taskOrder.fabricColor || '—') },
        { label: '卷号', value: escapeHtml(taskOrder.fabricRollNos.join('、') || '—') },
        { label: '数量', value: `${formatQty(taskOrder.planQty)}${escapeHtml(taskOrder.unit)}` },
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
          <td class="px-3 py-3">${
            warehouseLink.status === '差异' || warehouseLink.status === '异议中'
              ? renderStatusBadge(warehouseLink.status)
              : '—'
          }</td>
        </tr>
      `,
    )
    .join('')

  const abnormalRows = taskOrder.abnormalRecords
    .map(
      (abnormalRecord) => `
        <tr class="align-top">
          <td class="px-3 py-3">${renderStatusBadge(abnormalRecord.abnormalType)}</td>
          <td class="px-3 py-3">${formatQty(abnormalRecord.qty)}${escapeHtml(abnormalRecord.unit)}</td>
          <td class="px-3 py-3">${escapeHtml(abnormalRecord.description)}</td>
          <td class="px-3 py-3">${String(abnormalRecord.photoCount)}</td>
          <td class="px-3 py-3">${escapeHtml(abnormalRecord.reportedBy)}</td>
          <td class="px-3 py-3">${escapeHtml(abnormalRecord.reportedAt)}</td>
          <td class="px-3 py-3">${renderStatusBadge(abnormalRecord.status)}</td>
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

  const bindingRows = getSpecialCraftBindingsByTaskOrderId(taskOrder.taskOrderId)
    .map(
      (binding) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(binding.feiTicketNo)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.workOrderNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(binding.partName)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.colorName)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.sizeCode)}</td>
          <td class="px-3 py-3">${formatQty(binding.originalQty)} ${escapeHtml(binding.unit)}</td>
          <td class="px-3 py-3">${formatQty(binding.currentQty)} ${escapeHtml(binding.unit)}</td>
          <td class="px-3 py-3">${formatQty(binding.cumulativeScrapQty)} ${escapeHtml(binding.unit)}</td>
          <td class="px-3 py-3">${formatQty(binding.cumulativeDamageQty)} ${escapeHtml(binding.unit)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.currentLocation)}</td>
          <td class="px-3 py-3">${renderStatusBadge(binding.specialCraftFlowStatus)}</td>
          <td class="px-3 py-3">${renderStatusBadge(binding.specialCraftFlowStatus === '已回仓' ? '已回仓' : binding.currentLocation === '回仓途中' ? '回仓途中' : binding.specialCraftFlowStatus === '待回仓' ? '待回仓' : binding.specialCraftFlowStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.dispatchHandoverRecordNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(binding.returnHandoverRecordNo || '—')}</td>
          <td class="px-3 py-3">${binding.differenceQty ?? '—'}</td>
          <td class="px-3 py-3">${escapeHtml(binding.receiveDifferenceStatus || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(binding.returnDifferenceStatus || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(binding.objectionStatus || '—')}</td>
        </tr>
      `,
    )
    .join('')

  const workOrderRows = getSpecialCraftTaskWorkOrdersByTaskOrderId(taskOrder.taskOrderId)
    .map((workOrder) => {
      const workOrderHref = buildSpecialCraftWorkOrderDetailPath(operation, workOrder.workOrderId)
      return `
        <tr class="align-top">
          <td class="px-3 py-3 font-medium text-blue-700"><button type="button" class="hover:underline" data-nav="${workOrderHref}">${escapeHtml(workOrder.workOrderNo)}</button></td>
          <td class="px-3 py-3">${escapeHtml(workOrder.partName)}</td>
          <td class="px-3 py-3">${formatQty(workOrder.planQty)}</td>
          <td class="px-3 py-3">${formatQty(workOrder.currentQty)}</td>
          <td class="px-3 py-3">${formatQty(workOrder.scrapQty)}</td>
          <td class="px-3 py-3">${formatQty(workOrder.damageQty)}</td>
          <td class="px-3 py-3">${String(workOrder.feiTicketNos.length)}</td>
          <td class="px-3 py-3">${String(getSpecialCraftBindingsByTaskOrderId(taskOrder.taskOrderId).filter((binding) => binding.workOrderId === workOrder.workOrderId && binding.specialCraftFlowStatus === '已回仓').length)}</td>
          <td class="px-3 py-3">${String(workOrder.openDifferenceReportCount)}</td>
          <td class="px-3 py-3">${String(workOrder.openObjectionCount)}</td>
          <td class="px-3 py-3">${renderStatusBadge(workOrder.status)}</td>
          <td class="px-3 py-3"><button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${workOrderHref}">查看工艺单</button></td>
        </tr>
      `
    })
    .join('')

  const differenceRows = getSpecialCraftQtyDifferenceReportsByTaskOrderId(taskOrder.taskOrderId)
    .map(
      (report) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(report.reportPhase)}</td>
          <td class="px-3 py-3">${escapeHtml(report.workOrderNo)}</td>
          <td class="px-3 py-3">${escapeHtml(report.feiTicketNo)}</td>
          <td class="px-3 py-3">${formatQty(report.expectedQty)}${escapeHtml(report.unit)}</td>
          <td class="px-3 py-3">${formatQty(report.actualQty)}${escapeHtml(report.unit)}</td>
          <td class="px-3 py-3">${formatQty(report.differenceQty)}${escapeHtml(report.unit)}</td>
          <td class="px-3 py-3">${escapeHtml(report.sourceRecordNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(report.reason)}</td>
          <td class="px-3 py-3">${renderStatusBadge(report.platformStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(report.processRemark || '—')}</td>
        </tr>
      `,
    )
    .join('')

  const content = [
    renderSection('基本信息', basicInfo),
    isCutPieceTarget(taskOrder.targetObject) ? renderSection('裁片信息', pieceInfo) : '',
    isFabricTarget(taskOrder.targetObject) ? renderSection('面料信息', fabricInfo) : '',
    renderSection(
      '任务明细',
      demandRows
        ? renderTable(
            ['裁片部位', '颜色', '尺码', '每件片数', '生产数量', '计划片数', '来源纸样', '来源裁片明细', '菲票号'],
            demandRows,
            'min-w-[1120px]',
          )
        : renderEmptyState('暂无任务明细'),
    ),
    renderSection(
      '菲票流转',
      bindingRows
        ? renderTable(
            ['菲票号', '工艺单号', '裁片部位', '颜色', '尺码', '原裁片数量', '当前裁片数量', '累计报废裁片数量', '累计货损裁片数量', '当前所在', '发料状态', '回仓状态', '发料交出记录', '回仓交出记录', '差异裁片数量', '接收差异', '回仓差异', '异议状态'],
            bindingRows,
            'min-w-[1880px]',
          )
        : renderEmptyState('暂无菲票流转'),
    ),
    renderSection(
      '子工艺单',
      workOrderRows
        ? renderTable(
            ['工艺单号', '裁片部位', '计划裁片数量', '当前裁片数量', '累计报废裁片数量', '累计货损裁片数量', '已绑定菲票数', '已回仓菲票数', '接收差异', '回仓差异', '状态', '操作'],
            workOrderRows,
            'min-w-[1320px]',
          )
        : renderEmptyState('暂无子工艺单'),
    ),
    renderSection(
      '接收差异上报 / 回仓差异上报',
      differenceRows
        ? renderTable(['差异类型', '工艺单号', '菲票号', '应收裁片数量', '实收裁片数量', '差异裁片数量', '来源记录', '原因', '平台状态', '处理备注'], differenceRows, 'min-w-[1280px]')
        : renderEmptyState('暂无差异上报'),
    ),
    renderSection(
      '节点记录',
      renderTable(['节点', '操作', '数量', '操作人', '操作时间', '关联单号', '照片数量', '备注'], nodeRows, 'min-w-[1160px]'),
    ),
    renderSection(
      '仓库记录',
      renderTable(
        ['仓库类型', '仓库名称', '入库记录', '出库记录', '待加工仓记录', '待交出仓记录', '交出记录', '交出二维码', '回写状态', '差异 / 异议'],
        warehouseRows || `<tr><td colspan="10" class="px-3 py-6 text-center text-muted-foreground">暂无数据</td></tr>`,
        'min-w-[1420px]',
      ),
    ),
    renderSection(
      '异常记录',
      abnormalRows
        ? renderTable(['异常类型', '数量', '描述', '照片数量', '上报人', '上报时间', '状态'], abnormalRows, 'min-w-[980px]')
        : renderEmptyState('暂无异常记录'),
    ),
    `
      <div class="flex flex-wrap gap-2">
        <button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${buildSpecialCraftTaskOrdersPath(operation)}">返回</button>
        <button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${buildTaskRouteCardPrintLink('SPECIAL_CRAFT_TASK_ORDER', taskOrder.taskOrderId)}">打印任务流转卡</button>
        <button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${buildSpecialCraftPreferredWarehousePath(taskOrder)}">查看仓库记录</button>
        <button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="/fcs/pda/handover">查看交出记录</button>
      </div>
    `,
  ].join('')

  return renderSpecialCraftPageLayout({
    operation,
    title: `${operation.operationName}任务详情`,
    description: '只读展示特殊工艺任务的节点、仓库和异常记录；本页不提供新增执行主流程动作。',
    activeSubNav: 'tasks',
    content,
  })
}
