import { listFactoryWarehouseOutboundRecords } from '../data/fcs/factory-internal-warehouse.ts';
import { FULL_CAPABILITY_FACTORY_ID, listPostFinishingWaitHandoverWarehouseRecords, } from '../data/fcs/post-finishing-domain.ts';
import { renderPdaFrame } from './pda-shell';
import { buildWarehouseDifferenceText, escapeAttr, formatWarehouseDateTime, getMobileWarehouseSearchParams, getMobileWarehouseRuntimeContext, getWarehouseGeneratedModeLabel, getWarehouseQrDisplayText, renderCompactFieldList, renderMobilePageEmptyState, renderSectionFilterChips, renderStatusPill, renderWarehouseSummaryHeader, resolveOutboundRoute, } from './pda-warehouse-shared';
import { escapeHtml } from '../utils';
import { getSpecialCraftFeiTicketSummary } from '../data/fcs/cutting/special-craft-fei-ticket-flow.ts';
const state = {
    status: '全部',
    detailId: null,
    querySyncKey: '',
};
const FILTERS = [
    { value: '全部', label: '全部' },
    { value: '已出库', label: '已出库' },
    { value: '已回写', label: '已回写' },
    { value: '差异', label: '差异' },
    { value: '异议中', label: '异议中' },
];
const LINKED_QR_FIELD = ['handoverRecord', 'QrValue'].join('');
function normalizePostFinishingIdSegment(value) {
    return value.replace(/[^A-Za-z0-9]/g, '').slice(-16) || 'UNKNOWN';
}
function buildPostFinishingPdaHandoverRoute(recheckOrderNo) {
    return `/fcs/pda/handover/HOH-POST-${normalizePostFinishingIdSegment(recheckOrderNo)}`;
}
function getLinkedQrValue(source) {
    const value = source[LINKED_QR_FIELD];
    return typeof value === 'string' ? value : undefined;
}
function getPostFinishingOutboundRows() {
    return listPostFinishingWaitHandoverWarehouseRecords().flatMap((record) => record.flowRecords
        .filter((flow) => flow.flowType === '交出出仓')
        .map((flow) => ({
        recordId: flow.flowRecordId,
        warehouseRecordNo: record.warehouseRecordNo,
        recheckOrderNo: record.recheckOrderNo,
        flow,
        sourceProductionOrderNo: record.sourceProductionOrderNo,
        sourceTaskNo: record.sourceTaskNo,
        spuName: record.spuName,
        skuSummary: record.skuSummary,
        receivedQty: record.receivedHandoverGarmentQty,
        diffQty: record.diffGarmentQty,
    })));
}
function getRows() {
    const runtime = getMobileWarehouseRuntimeContext();
    if (!runtime)
        return [];
    return listFactoryWarehouseOutboundRecords()
        .filter((item) => item.factoryId === runtime.factoryId)
        .filter((item) => (state.status === '全部' ? true : item.status === state.status));
}
function syncStateFromQuery() {
    const params = getMobileWarehouseSearchParams();
    const nextKey = params.toString();
    if (state.querySyncKey === nextKey)
        return;
    state.querySyncKey = nextKey;
    const status = params.get('status');
    if (status && FILTERS.some((item) => item.value === status)) {
        state.status = status;
    }
    const recordId = params.get('recordId');
    state.detailId = recordId || null;
}
function renderDetailDrawer() {
    const row = getRows().find((item) => item.outboundRecordId === state.detailId);
    if (!row)
        return '';
    const specialCraftSummary = row.feiTicketNo ? getSpecialCraftFeiTicketSummary(row.feiTicketNo) : null;
    return `
    <div class="fixed inset-0 z-[120]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-outbound-detail"></button>
      <section class="absolute inset-x-0 bottom-[72px] rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">出库记录</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-outbound-detail">关闭</button>
        </div>
        <div class="mt-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
          ${renderCompactFieldList([
        { label: '出库单号', value: row.outboundRecordNo },
        { label: '来源动作', value: '交出记录' },
        { label: '生成方式', value: getWarehouseGeneratedModeLabel() },
        { label: '出库仓', value: row.warehouseName },
        { label: '来源任务', value: row.sourceTaskNo || '-' },
        { label: '交出单', value: row.handoverOrderNo || '-' },
        { label: '交出记录', value: row.handoverRecordNo || '-' },
        { label: '交出二维码', value: getWarehouseQrDisplayText(getLinkedQrValue(row)) },
        { label: '接收方', value: row.receiverName || '-' },
        { label: '物料 / 裁片类型', value: `${row.itemKind} / ${row.itemName}` },
        { label: '面料 SKU / 裁片部位', value: row.materialSku || row.partName || '-' },
        { label: '颜色', value: row.fabricColor || '-' },
        { label: '尺码', value: row.sizeCode || '-' },
        { label: '菲票号', value: row.feiTicketNo || '-' },
        { label: '特殊工艺', value: specialCraftSummary ? specialCraftSummary.operationNames.join(' / ') || '无' : '-' },
        { label: '当前所在', value: specialCraftSummary?.currentLocation || '-' },
        { label: '已完成特殊工艺', value: specialCraftSummary?.completedOperationNames.join(' / ') || '-' },
        { label: '当前特殊工艺', value: specialCraftSummary?.currentOperationName || '-' },
        { label: '原裁片数量 / 当前裁片数量', value: specialCraftSummary ? `${specialCraftSummary.originalQty} / ${specialCraftSummary.currentQty}` : '-' },
        { label: '报废裁片数量 / 货损裁片数量', value: specialCraftSummary ? `${specialCraftSummary.cumulativeScrapQty} / ${specialCraftSummary.cumulativeDamageQty}` : '-' },
        { label: '差异状态', value: specialCraftSummary ? [specialCraftSummary.receiveDifferenceStatus, specialCraftSummary.returnDifferenceStatus].filter((item) => item && item !== '—').join(' / ') || '无' : '-' },
        { label: '发料状态 / 回仓状态', value: specialCraftSummary ? `${specialCraftSummary.dispatchStatus} / ${specialCraftSummary.returnStatus}` : '-' },
        { label: '中转袋号', value: row.transferBagNo || '-' },
        { label: '卷号', value: row.fabricRollNo || '-' },
        { label: '出库数量', value: `${row.outboundQty} ${row.unit}` },
        { label: '回写数量', value: row.receiverWrittenQty === undefined ? '-' : `${row.receiverWrittenQty} ${row.unit}` },
        { label: '差异数量', value: buildWarehouseDifferenceText(row.differenceQty) },
        { label: '操作人', value: row.operatorName },
        { label: '出库时间', value: formatWarehouseDateTime(row.outboundAt) },
        { label: '状态', value: row.status },
    ])}
          <div class="mt-4 flex gap-2">
            <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeAttr(resolveOutboundRoute(row))}">查看交出</button>
            ${row.status === '差异' || row.status === '异议中'
        ? `<button type="button" class="flex-1 rounded-xl border border-destructive/30 px-3 py-2.5 text-sm text-destructive">查看回写</button>`
        : ''}
          </div>
        </div>
      </section>
    </div>
  `;
}
function renderPostFinishingOutboundDetailDrawer() {
    const row = getPostFinishingOutboundRows().find((item) => item.recordId === state.detailId);
    if (!row)
        return '';
    return `
    <div class="fixed inset-0 z-[120]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-outbound-detail"></button>
      <section class="absolute inset-x-0 bottom-[72px] rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">后道出库流水</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-outbound-detail">关闭</button>
        </div>
        <div class="mt-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
          ${renderCompactFieldList([
        { label: '流水号', value: row.flow.flowRecordNo },
        { label: '出库类型', value: '交出记录出仓' },
        { label: '仓库记录', value: row.warehouseRecordNo },
        { label: '复检单', value: row.recheckOrderNo },
        { label: '生产单', value: row.sourceProductionOrderNo },
        { label: '后道任务', value: row.sourceTaskNo },
        { label: '款式', value: row.spuName },
        { label: 'SKU', value: row.skuSummary },
        { label: '出库数量', value: `${row.flow.qty} ${row.flow.qtyUnit}` },
        { label: '接收方回写', value: row.receivedQty ? `${row.receivedQty} ${row.flow.qtyUnit}` : '-' },
        { label: '差异', value: `${row.diffQty} ${row.flow.qtyUnit}` },
        { label: '来源交出记录', value: row.flow.sourceActionRecordNo },
        { label: '操作人', value: row.flow.operatorName },
        { label: '出库时间', value: formatWarehouseDateTime(row.flow.operatedAt) },
        { label: '备注', value: row.flow.remark },
    ])}
          <div class="mt-4">
            <button type="button" class="w-full rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeAttr(buildPostFinishingPdaHandoverRoute(row.recheckOrderNo))}">查看交出单</button>
          </div>
        </div>
      </section>
    </div>
  `;
}
function renderPostFinishingOutboundRecordsPage(runtimeFactoryName) {
    const rows = getPostFinishingOutboundRows();
    const totalQty = rows.reduce((sum, row) => sum + row.flow.qty, 0);
    const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-lg font-semibold text-foreground">后道出库流水</div>
            <div class="mt-1 text-xs text-muted-foreground">交出记录提交后形成出仓流水，接收方回写后在待交出仓更新。</div>
          </div>
          <div class="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">${escapeHtml(runtimeFactoryName)}</div>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div class="rounded-2xl bg-muted/50 px-3 py-3"><div class="text-muted-foreground">流水</div><div class="mt-1 text-base font-semibold">${rows.length} 条</div></div>
          <div class="rounded-2xl bg-muted/50 px-3 py-3"><div class="text-muted-foreground">出库数量</div><div class="mt-1 text-base font-semibold">${totalQty} 件</div></div>
        </div>
      </section>
      <section class="space-y-3">
        ${rows.length > 0 ? rows.map((row) => `
          <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold">${escapeHtml(row.flow.flowRecordNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">交出记录出仓 · ${escapeHtml(row.skuSummary)}</div>
              </div>
              ${renderStatusPill(row.diffQty === 0 && row.receivedQty ? '已回写' : '待回写')}
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div>生产单：${escapeHtml(row.sourceProductionOrderNo)}</div>
              <div>交出记录：${escapeHtml(row.flow.sourceActionRecordNo)}</div>
              <div>出库数量：${row.flow.qty} ${escapeHtml(row.flow.qtyUnit)}</div>
              <div>出库时间：${escapeHtml(formatWarehouseDateTime(row.flow.operatedAt))}</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-outbound-detail" data-record-id="${escapeAttr(row.recordId)}">查看</button>
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(buildPostFinishingPdaHandoverRoute(row.recheckOrderNo))}">查看交出</button>
            </div>
          </article>
        `).join('') : renderMobilePageEmptyState('暂无后道出库流水', '交出记录提交后，会形成出库流水。')}
      </section>
      ${renderPostFinishingOutboundDetailDrawer()}
    </div>
  `;
    return renderPdaFrame(content, 'warehouse', { headerTitle: '后道出库流水', disableTodoAutoOpen: true });
}
export function renderPdaWarehouseOutboundRecordsPage() {
    const runtime = getMobileWarehouseRuntimeContext();
    if (!runtime)
        return renderPdaFrame(renderMobilePageEmptyState('未登录', '请先登录工厂端移动应用。'), 'warehouse');
    syncStateFromQuery();
    if (runtime.factoryId === FULL_CAPABILITY_FACTORY_ID)
        return renderPostFinishingOutboundRecordsPage(runtime.factoryName);
    const rows = getRows();
    const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderWarehouseSummaryHeader('出库记录', '交出记录提交后，自动生成出库记录并关联交出二维码。', runtime.overview)}
      ${renderSectionFilterChips(state.status, FILTERS, 'outbound-status')}
      <section class="space-y-3">
        ${rows.length > 0
        ? rows
            .map((row) => `
                    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                          <div class="text-sm font-semibold text-foreground">${escapeHtml(row.outboundRecordNo)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.handoverOrderNo || '-')} · ${escapeHtml(row.receiverName || '-')}</div>
                        </div>
                        ${renderStatusPill(row.status)}
                      </div>
                      <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        <div>来源动作：交出记录</div>
                        <div>生成方式：${escapeHtml(getWarehouseGeneratedModeLabel())}</div>
                        <div>出库仓：${escapeHtml(row.warehouseName)}</div>
                        <div>来源任务：${escapeHtml(row.sourceTaskNo || '-')}</div>
                        <div>交出记录：${escapeHtml(row.handoverRecordNo || '-')}</div>
                        <div>交出二维码：${escapeHtml(getWarehouseQrDisplayText(getLinkedQrValue(row)))}</div>
                        <div>物料 / 裁片类型：${escapeHtml(`${row.itemKind} / ${row.itemName}`)}</div>
                        <div>面料 SKU / 裁片部位：${escapeHtml(row.materialSku || row.partName || '-')}</div>
                        <div>颜色 / 尺码：${escapeHtml(row.fabricColor || '-')} / ${escapeHtml(row.sizeCode || '-')}</div>
                        <div>菲票号 / 中转袋号 / 袋内菲票数：${escapeHtml(row.feiTicketNo || '-')} / ${escapeHtml(row.transferBagNo || '-')} / ${row.transferBagNo ? '查看中转袋' : '-'}</div>
                        ${row.feiTicketNo
            ? (() => {
                const specialCraftSummary = getSpecialCraftFeiTicketSummary(row.feiTicketNo);
                return `<div>特殊工艺 / 当前所在：${escapeHtml(specialCraftSummary.operationNames.join(' / ') || '无')} / ${escapeHtml(specialCraftSummary.currentLocation)}</div>
                                        <div>当前特殊工艺 / 已完成特殊工艺：${escapeHtml(specialCraftSummary.currentOperationName)} / ${escapeHtml(specialCraftSummary.completedOperationNames.join(' / ') || '无')}</div>
                                        <div>原裁片数量 / 当前裁片数量：${specialCraftSummary.originalQty} / ${specialCraftSummary.currentQty}</div>
                                        <div>报废裁片数量 / 货损裁片数量：${specialCraftSummary.cumulativeScrapQty} / ${specialCraftSummary.cumulativeDamageQty}</div>
                                        <div>差异状态：${escapeHtml([specialCraftSummary.receiveDifferenceStatus, specialCraftSummary.returnDifferenceStatus].filter((item) => item && item !== '—').join(' / ') || '无')}</div>
                                        <div>发料状态 / 回仓状态：${escapeHtml(specialCraftSummary.dispatchStatus)} / ${escapeHtml(specialCraftSummary.returnStatus)}</div>`;
            })()
            : ''}
                        <div>卷号：${escapeHtml(row.fabricRollNo || '-')}</div>
                        <div>出库数量 / 回写数量：${row.outboundQty} / ${row.receiverWrittenQty ?? '-'} ${escapeHtml(row.unit)}</div>
                        <div>差异数量：${escapeHtml(buildWarehouseDifferenceText(row.differenceQty))}</div>
                        <div>出库时间：${escapeHtml(formatWarehouseDateTime(row.outboundAt))}</div>
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-outbound-detail" data-record-id="${escapeAttr(row.outboundRecordId)}">查看</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveOutboundRoute(row))}">查看交出</button>
                        ${row.status === '差异' || row.status === '异议中'
            ? `<button type="button" class="rounded-full border border-destructive/30 px-3 py-1.5 text-xs text-destructive" data-pda-warehouse-action="open-outbound-detail" data-record-id="${escapeAttr(row.outboundRecordId)}">查看回写</button>`
            : ''}
                      </div>
                    </article>
                  `)
            .join('')
        : renderMobilePageEmptyState('暂无出库记录', '交出记录提交成功后，会自动生成出库记录。')}
      </section>
      ${renderDetailDrawer()}
    </div>
  `;
    return renderPdaFrame(content, 'warehouse', { headerTitle: '出库记录' });
}
export function handlePdaWarehouseOutboundRecordsEvent(target) {
    const actionNode = target.closest('[data-pda-warehouse-action]');
    const action = actionNode?.dataset.pdaWarehouseAction;
    if (action === 'open-outbound-detail' && actionNode.dataset.recordId) {
        state.detailId = actionNode.dataset.recordId;
        return true;
    }
    if (action === 'close-outbound-detail') {
        state.detailId = null;
        return true;
    }
    const fieldNode = target.closest('[data-pda-warehouse-field]');
    if (fieldNode?.dataset.pdaWarehouseField === 'outbound-status') {
        state.status = (fieldNode.dataset.value || '');
        return true;
    }
    return false;
}
