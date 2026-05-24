import { buildSpecialCraftPreferredWarehousePath, buildSpecialCraftTaskDetailPath, buildSpecialCraftTaskOrdersPath, buildSpecialCraftWorkOrderDetailPath, getSpecialCraftOperationBySlug, } from '../../../data/fcs/special-craft-operations.ts';
import { buildTaskRouteCardPrintLink } from '../../../data/fcs/fcs-route-links.ts';
import { getSpecialCraftTaskOrderById, getSpecialCraftTaskWorkOrdersByTaskOrderId, } from '../../../data/fcs/special-craft-task-orders.ts';
import { appStore } from '../../../state/store.ts';
import { escapeHtml } from '../../../utils.ts';
import { formatQty, formatSpecialCraftFactoryLabel, renderEmptyState, renderSpecialCraftFactoryContextBlockedLayout, renderSpecialCraftPageLayout, resolveSpecialCraftFactoryContextGuard, renderStatusBadge, renderTable, } from './shared.ts';
const specialCraftTaskDetailTabs = [
    { key: 'overview', label: '概览' },
    { key: 'demand', label: '任务明细' },
    { key: 'work-orders', label: '子加工单' },
    { key: 'warehouse', label: '仓库流转' },
    { key: 'exceptions', label: '差异异常' },
    { key: 'events', label: '节点记录' },
];
function getCurrentTaskDetailTab() {
    const [, queryString = ''] = (appStore.getState().pathname || '').split('?');
    const tab = new URLSearchParams(queryString).get('tab');
    return specialCraftTaskDetailTabs.some((item) => item.key === tab) ? tab : 'overview';
}
function renderTaskDetailTabs(baseHref, activeTab) {
    return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${specialCraftTaskDetailTabs
        .map((item) => {
        const active = item.key === activeTab;
        return `
            <button
              type="button"
              class="rounded px-3 py-1.5 text-sm ${active ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
              data-nav="${escapeHtml(`${baseHref}?tab=${item.key}`)}"
            >
              ${escapeHtml(item.label)}
            </button>
          `;
    })
        .join('')}
    </nav>
  `;
}
function renderInfoGrid(items) {
    return `
    <div class="grid border-y bg-white md:grid-cols-2 xl:grid-cols-4">
      ${items
        .map((item) => `
            <div class="border-b px-1 py-3 md:px-3 xl:border-r">
              <div class="text-xs text-muted-foreground">${escapeHtml(item.label)}</div>
              <div class="mt-1 text-sm font-medium text-foreground">${item.value}</div>
            </div>
          `)
        .join('')}
    </div>
  `;
}
function renderSection(title, body) {
    return `
    <section class="space-y-3 border-t pt-4">
      <h2 class="text-base font-semibold text-foreground">${escapeHtml(title)}</h2>
      <div>${body}</div>
    </section>
  `;
}
function isCutPieceTarget(targetObject) {
    return targetObject === '裁片' || targetObject === '已裁部位';
}
function isFabricTarget(targetObject) {
    return targetObject === '面料' || targetObject === '完整面料';
}
export function renderSpecialCraftTaskDetailPage(operationSlug, taskOrderId) {
    const operation = getSpecialCraftOperationBySlug(operationSlug);
    const taskOrder = getSpecialCraftTaskOrderById(decodeURIComponent(taskOrderId));
    if (!operation || !taskOrder || taskOrder.operationId !== operation.operationId) {
        return renderEmptyState('未找到对应加工单详情。');
    }
    const factoryGuard = resolveSpecialCraftFactoryContextGuard(operation);
    if (factoryGuard.blocked) {
        return renderSpecialCraftFactoryContextBlockedLayout({
            operation,
            title: `${operation.operationName}加工单详情`,
            description: '',
            activeSubNav: 'tasks',
            factoryName: factoryGuard.factoryName,
        });
    }
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
        { label: '已接收裁片数量', value: `${formatQty(taskOrder.receivedQty)}${escapeHtml(taskOrder.unit)}` },
        { label: '已完成裁片数量', value: `${formatQty(taskOrder.completedQty)}${escapeHtml(taskOrder.unit)}` },
        { label: '待交出裁片数量', value: `${formatQty(taskOrder.waitHandoverQty)}${escapeHtml(taskOrder.unit)}` },
        { label: '当前状态', value: renderStatusBadge(taskOrder.status) },
        { label: '异常状态', value: renderStatusBadge(taskOrder.abnormalStatus) },
        { label: '交期', value: escapeHtml(taskOrder.dueAt.slice(0, 10)) },
    ]);
    const pieceInfo = isCutPieceTarget(taskOrder.targetObject)
        ? renderInfoGrid([
            { label: '裁片部位', value: escapeHtml(taskOrder.partName || '—') },
            { label: '颜色', value: escapeHtml(taskOrder.fabricColor || '—') },
            { label: '尺码', value: escapeHtml(taskOrder.sizeCode || '—') },
            { label: '菲票号', value: escapeHtml(taskOrder.feiTicketNos.join('、') || '待绑定') },
            { label: '中转袋号', value: escapeHtml(taskOrder.transferBagNos.join('、') || '—') },
            { label: '计划加工数量', value: `${formatQty(taskOrder.planQty)}${escapeHtml(taskOrder.unit)}` },
        ])
        : '';
    const fabricInfo = isFabricTarget(taskOrder.targetObject)
        ? renderInfoGrid([
            { label: '面料 SKU', value: escapeHtml(taskOrder.materialSku || '—') },
            { label: '颜色', value: escapeHtml(taskOrder.fabricColor || '—') },
            { label: '卷号', value: escapeHtml(taskOrder.fabricRollNos.join('、') || '—') },
            { label: '计划加工数量', value: `${formatQty(taskOrder.planQty)}${escapeHtml(taskOrder.unit)}` },
            { label: '单位', value: escapeHtml(taskOrder.unit) },
        ])
        : '';
    const nodeRows = taskOrder.nodeRecords
        .map((nodeRecord) => `
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
      `)
        .join('');
    const warehouseRows = taskOrder.warehouseLinks
        .map((warehouseLink) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(warehouseLink.warehouseKind)}</td>
          <td class="px-3 py-3">${escapeHtml(warehouseLink.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(warehouseLink.inboundRecordNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(warehouseLink.outboundRecordNo || '—')}</td>
          <td class="px-3 py-3">${warehouseLink.waitProcessStockItemId ? '已关联' : '—'}</td>
          <td class="px-3 py-3">${warehouseLink.waitHandoverStockItemId ? '已关联' : '—'}</td>
          <td class="px-3 py-3">${escapeHtml(warehouseLink.handoverRecordNo || '—')}</td>
          <td class="px-3 py-3">${warehouseLink.handoverRecordId ? '已生成' : '—'}</td>
          <td class="px-3 py-3">${warehouseLink.status === '已回写' ? renderStatusBadge('已回写') : '未回写'}</td>
          <td class="px-3 py-3">${warehouseLink.status === '差异' || warehouseLink.status === '异议中'
        ? renderStatusBadge(warehouseLink.status)
        : '—'}</td>
        </tr>
      `)
        .join('');
    const abnormalRows = taskOrder.abnormalRecords
        .map((abnormalRecord) => `
        <tr class="align-top">
          <td class="px-3 py-3">${renderStatusBadge(abnormalRecord.abnormalType)}</td>
          <td class="px-3 py-3">${formatQty(abnormalRecord.qty)}${escapeHtml(abnormalRecord.unit)}</td>
          <td class="px-3 py-3">${escapeHtml(abnormalRecord.description)}</td>
          <td class="px-3 py-3">${String(abnormalRecord.photoCount)}</td>
          <td class="px-3 py-3">${escapeHtml(abnormalRecord.reportedBy)}</td>
          <td class="px-3 py-3">${escapeHtml(abnormalRecord.reportedAt)}</td>
          <td class="px-3 py-3">${renderStatusBadge(abnormalRecord.status)}</td>
        </tr>
      `)
        .join('');
    const demandRows = (taskOrder.demandLines ?? [])
        .map((line) => `
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
      `)
        .join('');
    const bindingRows = taskOrder.feiTicketNos
        .map((feiTicketNo) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(feiTicketNo)}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.partName || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.fabricColor || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.sizeCode || '多尺码')}</td>
          <td class="px-3 py-3">${formatQty(taskOrder.planQty)} ${escapeHtml(taskOrder.unit)}</td>
          <td class="px-3 py-3">${renderStatusBadge(taskOrder.status)}</td>
        </tr>
      `)
        .join('');
    const workOrderRows = getSpecialCraftTaskWorkOrdersByTaskOrderId(taskOrder.taskOrderId)
        .map((workOrder) => {
        const workOrderHref = buildSpecialCraftWorkOrderDetailPath(operation, workOrder.workOrderId);
        return `
        <tr class="align-top">
          <td class="px-3 py-3 font-medium text-blue-700"><button type="button" class="hover:underline" data-nav="${workOrderHref}">${escapeHtml(workOrder.workOrderNo)}</button></td>
          <td class="px-3 py-3">${escapeHtml(workOrder.partName)}</td>
          <td class="px-3 py-3">${formatQty(workOrder.planQty)}</td>
          <td class="px-3 py-3">${formatQty(workOrder.currentQty)}</td>
          <td class="px-3 py-3">${formatQty(workOrder.scrapQty)}</td>
          <td class="px-3 py-3">${formatQty(workOrder.damageQty)}</td>
          <td class="px-3 py-3">${String(workOrder.feiTicketNos.length)}</td>
          <td class="px-3 py-3">${workOrder.returnedQty > 0 ? String(workOrder.feiTicketNos.length) : '0'}</td>
          <td class="px-3 py-3">${String(workOrder.openDifferenceReportCount)}</td>
          <td class="px-3 py-3">${String(workOrder.openObjectionCount)}</td>
          <td class="px-3 py-3">${renderStatusBadge(workOrder.status)}</td>
          <td class="px-3 py-3"><button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${workOrderHref}">查看加工单</button></td>
        </tr>
      `;
    })
        .join('');
    const differenceRows = taskOrder.abnormalRecords
        .map((report) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(report.abnormalType)}</td>
          <td class="px-3 py-3">${formatQty(report.qty)}${escapeHtml(report.unit)}</td>
          <td class="px-3 py-3">${escapeHtml(report.description)}</td>
          <td class="px-3 py-3">${escapeHtml(report.reportedBy)}</td>
          <td class="px-3 py-3">${escapeHtml(report.reportedAt)}</td>
          <td class="px-3 py-3">${renderStatusBadge(report.status)}</td>
        </tr>
      `)
        .join('');
    const taskDetailHref = buildSpecialCraftTaskDetailPath(operation, taskOrder.taskOrderId);
    const activeTab = getCurrentTaskDetailTab();
    const targetInfoSection = isCutPieceTarget(taskOrder.targetObject)
        ? renderSection('裁片信息', pieceInfo)
        : isFabricTarget(taskOrder.targetObject)
            ? renderSection('面料信息', fabricInfo)
            : '';
    const firstDemandLine = (taskOrder.demandLines ?? [])[0];
    const demandSummary = renderInfoGrid([
        { label: '任务明细', value: `${formatQty(taskOrder.demandLines?.length || 0)} 条` },
        { label: '来源纸样', value: escapeHtml(firstDemandLine?.patternFileName || '—') },
        { label: '来源裁片明细', value: escapeHtml(firstDemandLine?.pieceRowId || '—') },
        { label: '菲票状态', value: escapeHtml(taskOrder.feiTicketNos.join('、') || '待绑定') },
    ]);
    const sections = {
        overview: `
      <div class="space-y-5">
        ${renderSection('基本信息', basicInfo)}
        ${renderSection('任务明细摘要', demandSummary)}
        ${targetInfoSection}
      </div>
    `,
        demand: renderSection('任务明细', demandRows
            ? renderTable(['裁片部位', '颜色', '尺码', '每件片数', '生产成衣件数', '计划裁片数量', '来源纸样', '来源裁片明细', '菲票号'], demandRows, 'min-w-[1120px]')
            : renderEmptyState('暂无加工明细')),
        'work-orders': renderSection('子加工单', workOrderRows
            ? renderTable(['加工单号', '裁片部位', '计划裁片数量', '当前裁片数量', '累计报废裁片数量', '累计货损裁片数量', '绑定菲票数量', '已回仓菲票数量', '接收差异裁片数量', '回仓差异裁片数量', '状态', '操作'], workOrderRows, 'min-w-[1320px]')
            : renderEmptyState('暂无子加工单')),
        warehouse: `
      <div class="space-y-5">
        ${renderSection('菲票流转', bindingRows
            ? renderTable(['菲票号', '裁片部位', '颜色', '尺码', '计划数量', '当前状态'], bindingRows, 'min-w-[860px]')
            : renderEmptyState('暂无菲票流转'))}
        ${renderSection('仓库记录', renderTable([
            '仓库类型',
            '仓库名称',
            '入库记录',
            '出库记录',
            '待加工仓记录',
            '待交出仓记录',
            '交出记录',
            '交出二维码',
            '回写状态',
            '差异 / 异议',
        ], warehouseRows || `<tr><td colspan="10" class="px-3 py-6 text-center text-muted-foreground">暂无数据</td></tr>`, 'min-w-[1420px]'))}
      </div>
    `,
        exceptions: `
      <div class="space-y-5">
        ${renderSection('接收差异上报 / 回仓差异上报', differenceRows
            ? renderTable(['差异类型', '差异数量', '原因', '上报人', '上报时间', '状态'], differenceRows, 'min-w-[860px]')
            : renderEmptyState('暂无差异上报'))}
        ${renderSection('异常记录', abnormalRows
            ? renderTable(['异常类型', '异常裁片数量', '描述', '照片数量', '上报人', '上报时间', '状态'], abnormalRows, 'min-w-[980px]')
            : renderEmptyState('暂无异常记录'))}
      </div>
    `,
        events: renderSection('节点记录', renderTable(['节点', '操作', '操作裁片数量', '操作人', '操作时间', '关联单号', '照片数量', '备注'], nodeRows, 'min-w-[1160px]')),
    };
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
        <section class="space-y-3 border-l pl-4">
          <h2 class="text-base font-semibold text-foreground">当前处理</h2>
          <div class="grid gap-2 text-sm">
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">作用对象</span><span class="font-medium text-foreground">${escapeHtml(taskOrder.targetObject)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">计划数量</span><span class="font-medium text-foreground">${formatQty(taskOrder.planQty)} ${escapeHtml(taskOrder.unit)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">已接收</span><span class="font-medium text-foreground">${formatQty(taskOrder.receivedQty)} ${escapeHtml(taskOrder.unit)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">已完成</span><span class="font-medium text-foreground">${formatQty(taskOrder.completedQty)} ${escapeHtml(taskOrder.unit)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">待交出</span><span class="font-medium text-foreground">${formatQty(taskOrder.waitHandoverQty)} ${escapeHtml(taskOrder.unit)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">交期</span><span class="font-medium text-foreground">${escapeHtml(taskOrder.dueAt.slice(0, 10))}</span></div>
          </div>
          <div class="grid gap-2 pt-2">
            <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${escapeHtml(buildSpecialCraftTaskOrdersPath(operation))}">返回列表</button>
            <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${escapeHtml(buildTaskRouteCardPrintLink('SPECIAL_CRAFT_TASK_ORDER', taskOrder.taskOrderId))}">打印任务流转卡</button>
            <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${escapeHtml(buildSpecialCraftPreferredWarehousePath(taskOrder))}">查看仓库记录</button>
            <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="/fcs/pda/handover">查看交出记录</button>
          </div>
        </section>
      </aside>
    </div>
  `;
    return renderSpecialCraftPageLayout({
        operation,
        title: `${operation.operationName}加工单详情`,
        description: '',
        activeSubNav: 'tasks',
        content,
    });
}
