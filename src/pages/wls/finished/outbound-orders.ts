// Auto-extracted from Higood-wms App.tsx line 30639-31424
// 出库单列表 — finished warehouse outbound orders

import type { AppState } from '../../../state/store';

const PAGE_SIZE = 20;

type OutboundOrderStatus = '待出库' | '已出库';
type FulfillmentMode = 'SINGLE_SCAN_SHIP' | 'STANDARD_SHIP' | 'STANDARD_REVIEW_SHIP';

type OutboundOrderItem = {
  id: string;
  outboundOrderNo: string;
  reviewOrderNo: string;
  pickOrderNo: string;
  relatedOrderNo: string;
  trackingNo: string;
  spu: string;
  sku: string;
  skuCount: number;
  outboundWarehouse: string;
  outboundType: string;
  receivingUnit: string;
  outboundQuantity: number;
  pickedQuantity: number;
  reviewedQuantity: number;
  fulfillmentMode: FulfillmentMode;
  waybillPrintCount: number;
  ownerName: string;
  operatorName: string;
  outboundOrderStatus: OutboundOrderStatus;
  stockDeducted: boolean;
  createTime: string;
  shipDeadline: string;
};

const OUTBOUND_ORDER_SEED: OutboundOrderItem[] = (() => {
  const statuses: OutboundOrderStatus[] = ['待出库', '已出库'];
  const modes: FulfillmentMode[] = ['SINGLE_SCAN_SHIP', 'STANDARD_SHIP', 'STANDARD_REVIEW_SHIP'];
  const outboundTypes = ['现货出库', '预售出库', '调拨出库'];
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01'];
  const owners = ['广州总店', '深圳分店', '武汉分店', '杭州分店', '成都分店'];
  const operators = ['张伟', '李娜', '王强', '刘洋', '陈静'];
  const items: OutboundOrderItem[] = [];

  for (let i = 0; i < 42; i++) {
    const status = statuses[i % 2];
    const mode = modes[i % 3];
    const outboundQty = 20 + (i * 5) % 80;
    const pickedQty = status === '已出库' ? outboundQty : Math.floor(outboundQty * (0.4 + (i % 5) * 0.12));
    const reviewedQty = status === '已出库' ? outboundQty : Math.min(pickedQty, Math.floor(outboundQty * 0.8));
    const stockDeducted = status === '已出库';
    const dayOffset = Math.floor(i / 7);
    const baseDate = new Date(2026, 8, 18 - dayOffset);
    const createDate = baseDate.toISOString().slice(0, 16).replace('T', ' ');
    const deadlineDate = new Date(baseDate.getTime() + 86400000 * 2).toISOString().slice(0, 16).replace('T', ' ');

    items.push({
      id: `OO-${String(i + 1).padStart(5, '0')}`,
      outboundOrderNo: `CK2026${String(6000 + i).padStart(6, '0')}`,
      reviewOrderNo: `FH2026${String(5000 + i).padStart(6, '0')}`,
      pickOrderNo: `PJ2026${String(8000 + i).padStart(6, '0')}`,
      relatedOrderNo: `SO2026${String(7000 + i).padStart(6, '0')}`,
      trackingNo: `SF${String(2000000000 + i * 54321).slice(0, 12)}`,
      spu: `SPU-GC-${String(10001 + (i % 15)).padStart(5, '0')}`,
      sku: `SKU-GC-${String(30001 + i).padStart(5, '0')}`,
      skuCount: 1 + (i % 4),
      outboundWarehouse: warehouses[i % warehouses.length],
      outboundType: outboundTypes[i % outboundTypes.length],
      receivingUnit: owners[i % owners.length],
      outboundQuantity: outboundQty,
      pickedQuantity: pickedQty,
      reviewedQuantity: reviewedQty,
      fulfillmentMode: mode,
      waybillPrintCount: mode === 'SINGLE_SCAN_SHIP' ? 0 : (status === '已出库' ? 1 : 0),
      ownerName: owners[i % owners.length],
      operatorName: operators[i % operators.length],
      outboundOrderStatus: status,
      stockDeducted,
      createTime: createDate,
      shipDeadline: deadlineDate,
    });
  }
  return items;
})();

function statusBadgeClass(status: OutboundOrderStatus): string {
  return status === '待出库' ? 'bg-[#FEF0C7] text-[#B54708]' : 'bg-[#D1FADF] text-[#067647]';
}

function fulfillmentModeLabel(mode: FulfillmentMode): string {
  switch (mode) {
    case 'SINGLE_SCAN_SHIP': return '单件扫码发货';
    case 'STANDARD_SHIP': return '标准发货';
    case 'STANDARD_REVIEW_SHIP': return '复核发货';
  }
}

function fulfillmentModeBadgeClass(mode: FulfillmentMode): string {
  return mode === 'SINGLE_SCAN_SHIP' ? 'bg-[#EEF4FF] text-[#175CD3]' : 'bg-[#F2F4F7] text-[#475467]';
}

function renderPagination(total: number, page: number, totalPages: number): string {
  if (totalPages <= 1) return '';
  return `<div class="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] px-1 pt-3">
    <span class="text-[12px] text-[var(--text-muted)]">共 ${total} 条记录，第 ${page}/${totalPages} 页</span>
    <div class="flex items-center gap-1">
      <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40" ${page <= 1 ? 'disabled' : ''} onclick="window.__wlsOutboundOrders?.goPage(${page - 1})">上一页</button>
      <button type="button" class="rounded-[6px] border border-[var(--primary)] bg-[var(--primary)] px-2 py-1 text-[12px] text-white">${page}</button>
      <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40" ${page >= totalPages ? 'disabled' : ''} onclick="window.__wlsOutboundOrders?.goPage(${page + 1})">下一页</button>
    </div>
  </div>`;
}

const OPERATION_LOGS = [
  { id: 'L001', operatedAt: '2026-09-18 14:32', source: 'Web', orderNo: 'CK2026006001', action: '确认发货', operator: '张伟', remark: '面单已打印' },
  { id: 'L002', operatedAt: '2026-09-18 14:15', source: 'PDA', orderNo: 'CK2026006005', action: '拣货完成', operator: '李娜', remark: '-' },
  { id: 'L003', operatedAt: '2026-09-18 13:50', source: 'Web', orderNo: 'CK2026006012', action: '复核通过', operator: '王强', remark: '-' },
  { id: 'L004', operatedAt: '2026-09-18 13:22', source: 'Web', orderNo: 'CK2026006018', action: '生成拣货单', operator: '刘洋', remark: '波次 W20260918-03' },
  { id: 'L005', operatedAt: '2026-09-18 12:45', source: 'PDA', orderNo: 'CK2026006022', action: '扫码拣货', operator: '陈静', remark: '3/8 件' },
];

export function renderFinishedOutboundOrders(state: AppState): string {
  const allItems = OUTBOUND_ORDER_SEED;
  const totalItems = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageItems = allItems.slice(0, PAGE_SIZE);

  return `<section>
    <div class="mb-4">
      <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">出库单列表</h2>
      <p class="mt-1 text-[13px] text-[var(--text-muted)]">用于查看出库单复核与发货进度，状态为待复核、复核中、待出库、已出库。</p>
    </div>

    <div class="mb-3 rounded-[12px] border border-[var(--border-default)] bg-white p-3">
      <div class="flex flex-wrap items-center gap-2">
        <input id="wls-oo-search" value="" placeholder="搜索出库单号 / 复核单号 / 拣货单号 / 关联单号 / 出库类型 / 跟踪单号 / SPU / SKU / 出库仓库 / 收货单位 / 货主 / 状态" class="w-[480px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
        <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" onclick="window.__wlsOutboundOrders?.reset()">重置</button>
      </div>
    </div>

    <div class="rounded-[12px] border border-[var(--border-default)] bg-white">
      <div class="overflow-x-auto rounded-[10px] border border-[var(--border-default)]">
        <table class="w-full min-w-[1580px] text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">单号</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">商品SPU</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">商品SKU</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">出库仓库</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">出库类型</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">收货单位</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">拣货数量</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">复核数量</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">履约模式</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">面单打印次数</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">货主</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">操作人员</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">状态</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">时间</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium sticky right-0 z-20 border-l border-[var(--border-default)] bg-[var(--bg-subtle)]">操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.map((item) => `<tr class="hover:bg-[var(--bg-hover)]">
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <div class="space-y-1">
                  <div><span class="text-[var(--text-muted)]">出库单号：</span><span class="text-[var(--text-primary)]">${item.outboundOrderNo}</span></div>
                  <div><span class="text-[var(--text-muted)]">复核单号：</span><span class="text-[var(--text-primary)]">${item.reviewOrderNo}</span></div>
                  <div><span class="text-[var(--text-muted)]">拣货单号：</span><span class="text-[var(--text-primary)]">${item.pickOrderNo}</span></div>
                  <div><span class="text-[var(--text-muted)]">跟踪单号：</span><span class="text-[var(--text-primary)]">${item.trackingNo}</span></div>
                </div>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <div class="text-[var(--link)]">${item.spu}（${item.skuCount}个SKU）</div>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.sku}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.outboundWarehouse}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.outboundType}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.receivingUnit}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.pickedQuantity}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.reviewedQuantity}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <span class="inline-flex rounded-[999px] px-2 py-0.5 text-[12px] font-medium ${fulfillmentModeBadgeClass(item.fulfillmentMode)}">${fulfillmentModeLabel(item.fulfillmentMode)}</span>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.waybillPrintCount}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.ownerName}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.operatorName}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <span class="inline-flex rounded-[999px] px-2 py-0.5 text-[12px] font-medium ${statusBadgeClass(item.outboundOrderStatus)}">${item.outboundOrderStatus}</span>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <div class="min-w-[150px] space-y-1 text-[12px] text-[var(--text-secondary)]">
                  <div><span class="text-[var(--text-muted)]">创建时间：</span><span>${item.createTime}</span></div>
                  <div><span class="text-[var(--text-muted)]">发货截止：</span><span>${item.shipDeadline}</span></div>
                </div>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] sticky right-0 z-10 border-l border-[var(--border-default)] bg-white">
                <div class="flex items-center gap-2">
                  ${item.fulfillmentMode === 'SINGLE_SCAN_SHIP'
                    ? `<span class="inline-flex rounded-[999px] bg-[#F3F4F6] px-3 py-1 text-[12px] font-medium text-[#6B7280]">${item.stockDeducted ? '已发货' : '待发货'}</span>
                       <span class="text-[11px] text-[var(--text-muted)]">自动打包机</span>`
                    : item.fulfillmentMode === 'STANDARD_SHIP'
                      ? `<button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">生成/打印拣货单</button>
                         <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">查看拣货进度</button>
                         <button type="button" class="rounded-[8px] bg-[var(--primary)] px-3 py-1 text-[12px] font-medium text-white transition hover:opacity-90 ${item.stockDeducted || item.pickedQuantity < item.outboundQuantity ? 'cursor-not-allowed opacity-50' : ''}" ${item.stockDeducted || item.pickedQuantity < item.outboundQuantity ? 'disabled' : ''}>Web打印面单/确认发货</button>`
                      : `<button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">复核</button>
                         <button type="button" class="rounded-[8px] bg-[var(--primary)] px-3 py-1 text-[12px] font-medium text-white transition hover:opacity-90 ${item.stockDeducted ? 'cursor-not-allowed opacity-50' : ''}" ${item.stockDeducted ? 'disabled' : ''}>Web打印面单/确认发货</button>`
                  }
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(totalItems, 1, totalPages)}

      <div class="mt-3 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
        <div class="mb-2 text-[13px] font-medium text-[var(--text-primary)]">出库操作日志</div>
        <div class="max-h-[180px] space-y-1 overflow-auto text-[12px]">
          ${OPERATION_LOGS.map((log) => `<div class="rounded-[6px] border border-[var(--border-default)] bg-white px-2 py-1">[${log.operatedAt}] ${log.source} / ${log.orderNo} / ${log.action} / ${log.operator} / ${log.remark}</div>`).join('')}
        </div>
      </div>
    </div>

    <script>
    (function() {
      window.__wlsOutboundOrders = {
        goPage: function(page) { console.log('Go to page:', page); },
        reset: function() {
          var search = document.getElementById('wls-oo-search');
          if (search) search.value = '';
        }
      };
    })();
    </script>
  </section>`;
}
