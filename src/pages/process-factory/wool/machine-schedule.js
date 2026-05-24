import { escapeHtml } from '../../../utils';
import { appStore } from '../../../state/store.ts';
import { getWoolMachineScheduleSummary, getWoolWorkOrderKindLabel, getWoolWorkOrderById, getWoolWorkOrderStatusLabel, listWoolWorkOrders, listWoolMachineSchedules, scheduleWoolMachines, } from '../../../data/fcs/wool-task-domain.ts';
import { buildWoolMachineScheduleLink, buildWoolMachinesLink, buildWoolStatisticsLink, buildWoolWorkOrderDetailLink, buildWoolWorkOrdersLink, } from '../../../data/fcs/fcs-route-links.ts';
import { formatNumber, formatQty, paginateWoolItems, renderBadge, renderKindBadge, renderMetricCard, renderPageHeader, renderPaginationControls, renderSection, renderStatusBadge, renderTable, } from './shared';
function renderScheduleStatusBadge(status) {
    const tone = status === '已完成'
        ? 'success'
        : status === '生产中'
            ? 'info'
            : status === '延误'
                ? 'danger'
                : status === '待开工'
                    ? 'warning'
                    : 'muted';
    return renderBadge(status, tone);
}
function getMachineNode(order) {
    return order?.nodes.find((node) => node.nodeName === '横机成片');
}
function getCompletionPercent(order) {
    const node = getMachineNode(order);
    if (!node || node.plannedQty <= 0)
        return 0;
    return Math.min(100, Math.round((node.completedQty / node.plannedQty) * 100));
}
function getCurrentQueryParams() {
    const [, storeQueryString = ''] = (appStore.getState().pathname || '').split('?');
    if (storeQueryString)
        return new URLSearchParams(storeQueryString);
    if (typeof window === 'undefined')
        return new URLSearchParams();
    return new URLSearchParams(window.location.search);
}
function getScheduleCreateLink(woolOrderId = '') {
    const params = new URLSearchParams();
    params.set('dialog', 'create');
    if (woolOrderId)
        params.set('woolOrderId', woolOrderId);
    return `${buildWoolMachineScheduleLink()}?${params.toString()}`;
}
function listWaitingScheduleOrders() {
    return listWoolWorkOrders().filter((order) => order.status === 'WAIT_MACHINE_SCHEDULE');
}
function readSelectedScheduleOrderId(fallback = '') {
    const select = document.querySelector('[data-wool-schedule-field="woolOrderId"]');
    return select?.value || fallback;
}
function readScheduleTextField(field) {
    const node = document.querySelector(`[data-wool-schedule-field="${field}"]`);
    return node?.value.trim() || '';
}
function parseMachineNos(value) {
    return value
        .split(/[、,，/\\s]+/)
        .map((machineNo) => machineNo.trim())
        .filter(Boolean);
}
function buildDefaultMachineNos(order) {
    const startNo = order.kind === 'PART_PANEL' ? 31 : 11;
    const count = Math.max(1, order.plannedMachineCount || (order.kind === 'PART_PANEL' ? 4 : 6));
    return Array.from({ length: count }, (_, index) => `H-${String(startNo + index).padStart(3, '0')}`).join('、');
}
function renderTopActions() {
    return `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(getScheduleCreateLink())}">新增横机排产</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildWoolWorkOrdersLink())}">返回加工单</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildWoolMachinesLink())}">横机设备</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildWoolStatisticsLink())}">查看毛织统计</button>
    </div>
  `;
}
function renderSummaryCards() {
    const summary = getWoolMachineScheduleSummary();
    const loadPercent = summary.totalMachineCount > 0 ? Math.round((summary.inUseMachineCount / summary.totalMachineCount) * 100) : 0;
    return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
      ${renderMetricCard('排产记录', String(summary.scheduleCount), '周哥毛织厂')}
      ${renderMetricCard('已排加工单', String(summary.scheduledWorkOrderCount), '只含自有毛织任务')}
      ${renderMetricCard('样例横机台数', `${formatNumber(summary.totalMachineCount)} 台`, '排产视图展示')}
      ${renderMetricCard('占用横机', `${formatNumber(summary.inUseMachineCount)} 台`, `${loadPercent}% 负荷`)}
      ${renderMetricCard('空闲横机', `${formatNumber(summary.idleMachineCount)} 台`, '可插急单或返修')}
      ${renderMetricCard('部位排产', String(summary.partPanelScheduleCount), '后续走菲票')}
      ${renderMetricCard('延误', String(summary.delayedScheduleCount), '当前无红色延误')}
    </section>
  `;
}
function renderFilters() {
    return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${[
        ['工厂', '周哥毛织厂'],
        ['排产日期', '2026-05-07 至 2026-05-12'],
        ['任务类型', '整件毛织 / 部位毛织'],
        ['机台组', '全部横机组'],
    ]
        .map(([label, value]) => `
              <div>
                <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
                <div class="mt-1 rounded-md border bg-muted px-3 py-2 text-sm">${escapeHtml(value)}</div>
              </div>
            `)
        .join('')}
      </div>
    </section>
  `;
}
function renderWaitingScheduleOrders() {
    const orders = listWaitingScheduleOrders();
    const paging = paginateWoolItems(orders, 'scheduleWaitingPage', 10);
    const rows = paging.rows
        .map((order) => `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3 font-mono text-xs font-medium">${escapeHtml(order.woolOrderNo)}</td>
          <td class="px-3 py-3">${renderKindBadge(order.kind)}</td>
          <td class="px-3 py-3 text-sm">
            <div class="font-medium">${escapeHtml(order.styleName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.styleNo)} / ${escapeHtml(order.productionOrderNo)}</div>
          </td>
          <td class="px-3 py-3 text-sm">${formatQty(order.plannedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(order.yarnReceipt.yarnSku)}</div>
            <div class="mt-1 text-xs text-muted-foreground">已完成领料 ${formatQty(order.yarnReceipt.receivedWeightKg, 'kg')}</div>
          </td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.scheduledStartAt)} - ${escapeHtml(order.scheduledEndAt)}</td>
          <td class="px-3 py-3">${renderStatusBadge(order.status)}</td>
          <td class="px-3 py-3">
            <button type="button" class="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(getScheduleCreateLink(order.woolOrderId))}">排产</button>
          </td>
        </tr>
      `)
        .join('');
    return renderSection(`待排机加工单（${orders.length}）`, orders.length
        ? renderTable(['毛织单号', '任务类型', '款式', '计划数量', '领料状态', '计划时间', '当前状态', '操作'], rows, 'min-w-[1200px]') + renderPaginationControls(paging, '条待排机加工单')
        : '<div class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">暂无待排机加工单。</div>');
}
function renderMachineCards() {
    const paging = paginateWoolItems(listWoolMachineSchedules(), 'scheduleCardsPage', 10);
    const cards = paging.rows
        .map((schedule) => {
        const order = schedule.woolOrderId ? getWoolWorkOrderById(schedule.woolOrderId) : undefined;
        const percent = getCompletionPercent(order);
        return `
        <article class="rounded-lg border bg-card p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-semibold">${escapeHtml(schedule.machineGroupName)}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(schedule.machineNos.join('、'))}</div>
            </div>
            ${renderScheduleStatusBadge(schedule.status)}
          </div>
          <div class="mt-4 h-2 rounded-full bg-muted">
            <div class="h-2 rounded-full ${schedule.status === '空闲' ? 'bg-slate-300' : 'bg-blue-500'}" style="width: ${schedule.status === '空闲' ? 100 : percent}%"></div>
          </div>
          <div class="mt-3 text-sm">
            <div class="font-medium">${escapeHtml(order?.styleName || '空闲可排')}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order?.woolOrderNo || schedule.riskText)}</div>
          </div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground">
            <div>计划：${escapeHtml(schedule.plannedStartAt)} - ${escapeHtml(schedule.plannedEndAt)}</div>
            <div>完成：${order ? `${percent}%` : '待排任务'}</div>
          </div>
        </article>
      `;
    })
        .join('');
    return renderSection('横机负荷卡片', `
      <div class="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        横机排产只服务周哥毛织厂自有任务；三方外派毛织不进入本排产看板。
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">${cards}</div>
      ${renderPaginationControls(paging, '条横机排产')}
    `);
}
function renderReadonlyField(label, value) {
    return `
    <div>
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 min-h-9 rounded-md border bg-muted px-3 py-2 text-sm">${escapeHtml(value || '—')}</div>
    </div>
  `;
}
function renderScheduleCreateDialog() {
    const params = getCurrentQueryParams();
    if (params.get('dialog') !== 'create')
        return '';
    const orders = listWaitingScheduleOrders();
    const requestedOrderId = params.get('woolOrderId') || '';
    const selected = orders.find((order) => order.woolOrderId === requestedOrderId) || orders[0];
    const isPartPanel = selected?.kind === 'PART_PANEL';
    const machineGroupName = isPartPanel ? '部位毛织组' : '整件毛织组';
    const machineNos = selected ? buildDefaultMachineNos(selected) : '';
    const capacityHint = selected ? `${getWoolWorkOrderKindLabel(selected.kind)}，默认安排 ${selected.plannedMachineCount} 台横机` : '';
    const orderOptions = orders
        .map((order) => `
        <option value="${escapeHtml(order.woolOrderId)}" ${selected?.woolOrderId === order.woolOrderId ? 'selected' : ''}>
          ${escapeHtml(`${order.woolOrderNo} / ${getWoolWorkOrderKindLabel(order.kind)} / ${order.styleName}`)}
        </option>
      `)
        .join('');
    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-background shadow-xl">
        <header class="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">新增横机排产</h2>
            <p class="mt-1 text-sm text-muted-foreground">仅选择已完成领料单、状态为待排机的周哥毛织厂任务。</p>
          </div>
          <button type="button" class="rounded-md border px-3 py-1 text-sm hover:bg-muted" data-wool-schedule-action="close-create">关闭</button>
        </header>
        <div class="space-y-4 p-5">
          ${selected
        ? `
                <section class="rounded-lg border p-4">
                  <div class="grid gap-4 md:grid-cols-2">
                    <label>
                      <div class="text-xs text-muted-foreground">待排毛织单</div>
                      <select class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" data-wool-schedule-field="woolOrderId">
                        ${orderOptions}
                      </select>
                    </label>
                    ${renderReadonlyField('当前状态', getWoolWorkOrderStatusLabel(selected.status))}
                    ${renderReadonlyField('任务类型', getWoolWorkOrderKindLabel(selected.kind))}
                    ${renderReadonlyField('款式 / 生产单', `${selected.styleNo} ${selected.styleName} / ${selected.productionOrderNo}`)}
                    ${renderReadonlyField('计划数量', formatQty(selected.plannedQty, selected.qtyUnit))}
                    ${renderReadonlyField('领料结果', `实收 ${formatQty(selected.yarnReceipt.receivedWeightKg, 'kg')}，差异 ${formatQty(selected.yarnReceipt.differenceWeightKg, 'kg')}`)}
                  </div>
                </section>
                <section class="rounded-lg border p-4">
                  <div class="grid gap-4 md:grid-cols-2">
                    <label>
                      <div class="text-xs text-muted-foreground">机台组</div>
                      <select class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" data-wool-schedule-field="machineGroupName">
                        <option selected>${escapeHtml(machineGroupName)}</option>
                      </select>
                    </label>
                    <label>
                      <div class="text-xs text-muted-foreground">横机编号</div>
                      <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(machineNos)}" data-wool-schedule-field="machineNos" />
                    </label>
                    <label>
                      <div class="text-xs text-muted-foreground">计划开始</div>
                      <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(selected.scheduledStartAt)}" data-wool-schedule-field="plannedStartAt" />
                    </label>
                    <label>
                      <div class="text-xs text-muted-foreground">计划完成</div>
                      <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(selected.scheduledEndAt)}" data-wool-schedule-field="plannedEndAt" />
                    </label>
                    <label class="md:col-span-2">
                      <div class="text-xs text-muted-foreground">排产说明</div>
                      <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(capacityHint)}" data-wool-schedule-field="remark" />
                    </label>
                  </div>
                </section>
              `
        : '<div class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">暂无可排产的待排机加工单。</div>'}
        </div>
        <footer class="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-wool-schedule-action="close-create">取消</button>
          <button
            type="button"
            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            data-wool-schedule-action="save-create"
            data-wool-order-id="${escapeHtml(selected?.woolOrderId || '')}"
            ${selected ? '' : 'disabled'}
          >保存排产</button>
        </footer>
      </div>
    </div>
  `;
}
function renderScheduleDetails() {
    const schedules = listWoolMachineSchedules();
    const paging = paginateWoolItems(schedules, 'scheduleDetailPage', 10);
    const rows = paging.rows
        .map((schedule) => {
        const order = schedule.woolOrderId ? getWoolWorkOrderById(schedule.woolOrderId) : undefined;
        const node = getMachineNode(order);
        const detailLink = order ? buildWoolWorkOrderDetailLink(order.woolOrderId, 'machine') : buildWoolWorkOrdersLink();
        return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(schedule.machineGroupName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.machineNos.join('、'))}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order?.woolOrderNo || '未占用')}</td>
          <td class="px-3 py-3">${order ? renderKindBadge(order.kind) : renderBadge('空闲', 'muted')}</td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(order?.styleName || '暂无任务')}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order ? `${order.styleNo} / ${order.productionOrderNo}` : schedule.remark)}</div>
          </td>
          <td class="px-3 py-3 text-sm">${order ? formatQty(node?.plannedQty, node?.unit) : '—'}</td>
          <td class="px-3 py-3 text-sm">${order ? formatQty(node?.completedQty, node?.unit) : '—'}</td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(schedule.plannedStartAt)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(schedule.plannedEndAt)}</div>
          </td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(schedule.actualStartAt || '未开机')}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(schedule.actualEndAt || '未完成')}</div>
          </td>
          <td class="px-3 py-3">${renderScheduleStatusBadge(schedule.status)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.riskText)}</td>
          <td class="px-3 py-3">${order ? renderStatusBadge(order.status) : renderBadge('可排', 'muted')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(detailLink)}">${order ? '查看横机节点' : '查看加工单'}</button>
              ${order
            ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolWorkOrderDetailLink(order.woolOrderId, order.kind === 'PART_PANEL' ? 'fei' : 'whole'))}">${order.kind === 'PART_PANEL' ? '查看菲票' : '查看整件节点'}</button>`
            : ''}
            </div>
          </td>
        </tr>
      `;
    })
        .join('');
    return renderSection('排产明细', renderTable(['机台组', '横机编号', '毛织单号', '任务类型', '款式', '计划数量', '完成数量', '计划时间', '实际时间', '排产状态', '风险提示', '加工单状态', '操作'], rows, 'min-w-[1800px]') + renderPaginationControls(paging, '条排产明细'));
}
export function renderCraftWoolMachineSchedulePage() {
    return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('横机排产', '周哥毛织厂自有横机排产，看机台占用、任务类型、横机成片进度和风险。', renderTopActions())}
      ${renderSummaryCards()}
      ${renderFilters()}
      ${renderWaitingScheduleOrders()}
      ${renderMachineCards()}
      ${renderScheduleDetails()}
      ${renderScheduleCreateDialog()}
    </div>
  `;
}
export function handleCraftWoolMachineScheduleEvent(target) {
    const actionNode = target.closest('[data-wool-schedule-action]');
    if (!actionNode)
        return false;
    const action = actionNode.dataset.woolScheduleAction;
    if (action === 'close-create') {
        appStore.navigate(buildWoolMachineScheduleLink());
        return true;
    }
    if (action === 'save-create') {
        const orderId = readSelectedScheduleOrderId(actionNode.dataset.woolOrderId || '');
        if (orderId) {
            scheduleWoolMachines(orderId, 'Web端排产员', undefined, {
                machineNos: parseMachineNos(readScheduleTextField('machineNos')),
                scheduledStartAt: readScheduleTextField('plannedStartAt'),
                scheduledEndAt: readScheduleTextField('plannedEndAt'),
                remark: readScheduleTextField('remark'),
            });
        }
        appStore.navigate(buildWoolMachineScheduleLink());
        return true;
    }
    return false;
}
