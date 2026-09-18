// Auto-extracted from Higood-wms App.tsx line 30639-31400
// 预出库管理 — finished warehouse pre-outbound

import type { AppState } from '../../../state/store';

const PAGE_SIZE = 20;

type PreOutboundStatus = '待处理' | '待拣货' | '拣货中' | '待出库' | '部分出库' | '已出库' | '已取消';

type PreOutboundItem = {
  id: string;
  outboundOrderNo: string;
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
  stockStatus: '库存充足' | '库存部分充足' | '库存不足';
  ownerName: string;
  status: PreOutboundStatus;
  createTime: string;
  payTime: string;
  shipDeadline: string;
};

const PRE_OUTBOUND_SEED: PreOutboundItem[] = (() => {
  const statuses: PreOutboundStatus[] = ['待处理', '待拣货', '拣货中', '待出库', '部分出库', '已出库'];
  const stockStatuses: Array<'库存充足' | '库存部分充足' | '库存不足'> = ['库存充足', '库存部分充足', '库存不足'];
  const outboundTypes = ['现货出库', '预售出库', '调拨出库', '退货出库'];
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01'];
  const owners = ['广州总店', '深圳分店', '武汉分店', '杭州分店', '成都分店'];
  const items: PreOutboundItem[] = [];

  for (let i = 0; i < 48; i++) {
    const status = statuses[i % statuses.length];
    const stockStatus = stockStatuses[i % 3];
    const outboundQty = 10 + (i * 3) % 50;
    const pickedQty = status === '已出库' ? outboundQty : status === '部分出库' ? Math.floor(outboundQty * 0.6) : status === '拣货中' ? Math.floor(outboundQty * 0.3) : 0;
    const dayOffset = Math.floor(i / 8);
    const baseDate = new Date(2026, 8, 18 - dayOffset);
    const createDate = baseDate.toISOString().slice(0, 16).replace('T', ' ');
    const payDate = new Date(baseDate.getTime() - 3600000).toISOString().slice(0, 16).replace('T', ' ');
    const deadlineDate = new Date(baseDate.getTime() + 86400000 * 2).toISOString().slice(0, 16).replace('T', ' ');

    items.push({
      id: `PO-${String(i + 1).padStart(5, '0')}`,
      outboundOrderNo: `CK2026${String(9000 + i).padStart(6, '0')}`,
      pickOrderNo: `PJ2026${String(8000 + i).padStart(6, '0')}`,
      relatedOrderNo: `SO2026${String(7000 + i).padStart(6, '0')}`,
      trackingNo: `SF${String(1000000000 + i * 12345).slice(0, 12)}`,
      spu: `SPU-GC-${String(10001 + (i % 20)).padStart(5, '0')}`,
      sku: `SKU-GC-${String(20001 + i).padStart(5, '0')}`,
      skuCount: 1 + (i % 3),
      outboundWarehouse: warehouses[i % warehouses.length],
      outboundType: outboundTypes[i % outboundTypes.length],
      receivingUnit: owners[i % owners.length],
      outboundQuantity: outboundQty,
      pickedQuantity: pickedQty,
      stockStatus,
      ownerName: owners[i % owners.length],
      status,
      createTime: createDate,
      payTime: payDate,
      shipDeadline: deadlineDate,
    });
  }
  return items;
})();

function statusBadgeClass(status: PreOutboundStatus): string {
  switch (status) {
    case '待处理': return 'bg-[#FEF0C7] text-[#B54708]';
    case '待拣货': return 'bg-[#EEF4FF] text-[#175CD3]';
    case '拣货中': return 'bg-[#F4EBFF] text-[#6941C6]';
    case '待出库': return 'bg-[#CFF9FE] text-[#155B75]';
    case '部分出库': return 'bg-[#E0EAFF] text-[#3538CD]';
    case '已出库': return 'bg-[#D1FADF] text-[#067647]';
    case '已取消': return 'bg-[#F2F4F7] text-[#475467]';
    default: return 'bg-[#F2F4F7] text-[#475467]';
  }
}

function stockStatusBadgeClass(status: string): string {
  switch (status) {
    case '库存不足': return 'bg-[#FEE4E2] text-[#B42318]';
    case '库存部分充足': return 'bg-[#FFF4E5] text-[#B54708]';
    default: return 'bg-[#D1FADF] text-[#067647]';
  }
}

function renderPagination(total: number, page: number, totalPages: number): string {
  if (totalPages <= 1) return '';
  return `<div class="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] px-1 pt-3">
    <span class="text-[12px] text-[var(--text-muted)]">共 ${total} 条记录，第 ${page}/${totalPages} 页</span>
    <div class="flex items-center gap-1">
      <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40" ${page <= 1 ? 'disabled' : ''} onclick="window.__wlsPreOutbound?.goPage(${page - 1})">上一页</button>
      <button type="button" class="rounded-[6px] border border-[var(--primary)] bg-[var(--primary)] px-2 py-1 text-[12px] text-white">${page}</button>
      <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40" ${page >= totalPages ? 'disabled' : ''} onclick="window.__wlsPreOutbound?.goPage(${page + 1})">下一页</button>
    </div>
  </div>`;
}

export function renderFinishedPreOutbound(state: AppState): string {
  const allItems = PRE_OUTBOUND_SEED;
  const totalItems = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageItems = allItems.slice(0, PAGE_SIZE);

  const timeoutStats = {
    todayTimeoutCount: 8,
    tomorrowTimeoutCount: 15,
    threeDaysTimeoutCount: 42,
  };

  const statusOptions: PreOutboundStatus[] = ['待处理', '待拣货', '拣货中', '待出库', '部分出库', '已出库', '已取消'];

  return `<section>
    <div class="mb-4">
      <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">预出库管理</h2>
      <p class="mt-1 text-[13px] text-[var(--text-muted)]">用于查看出库前置单据，包含单号、商品、收货单位、货主与时间等信息。</p>
    </div>

    <div class="mb-3 rounded-[12px] border border-[var(--border-default)] bg-white p-3">
      <div class="flex flex-wrap items-center gap-2">
        <input id="wls-po-search" value="" placeholder="搜索出库单号 / 拣货单号 / 关联单号 / 出库类型 / 跟踪单号 / SPU / SKU / 出库仓库 / 收货单位 / 货主 / 状态" class="w-[480px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
        <div class="inline-flex items-center rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1">
          ${statusOptions.map((s) => `<button type="button" class="rounded-[6px] px-3 py-1 text-[12px] transition text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onclick="window.__wlsPreOutbound?.toggleStatus('${s}')">${s}</button>`).join('')}
        </div>
        <select id="wls-po-item-type" class="w-[150px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20">
          <option value="ALL">订单件数：全部</option>
          <option value="SINGLE_SKU">一单一件</option>
          <option value="MULTI_SKU">一单多件</option>
        </select>
        <select id="wls-po-time-type" class="w-[170px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20">
          <option value="">时间类型：默认创建时间</option>
          <option value="CREATE_TIME">创建时间</option>
          <option value="PAY_TIME">支付时间</option>
          <option value="SHIP_DEADLINE">发货截止时间</option>
        </select>
        <input type="datetime-local" class="w-[190px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
        <span class="text-[12px] text-[var(--text-muted)]">至</span>
        <input type="datetime-local" class="w-[190px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
        <button type="button" class="rounded-[8px] bg-[var(--primary)] px-3 py-[7px] text-[13px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" disabled>生成波次</button>
        <span class="text-[12px] text-[var(--text-muted)]">已选 0 条</span>
        <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" onclick="window.__wlsPreOutbound?.reset()">重置</button>
      </div>
    </div>

    <div class="mb-3 rounded-[12px] border border-[var(--border-default)] bg-white p-3">
      <div class="mb-2 text-[13px] font-medium text-[var(--text-primary)]">超时发货统计</div>
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
          <div class="text-[12px] text-[var(--text-muted)]">今日超时</div>
          <div class="mt-1 text-[20px] font-semibold leading-6 text-[#D92D20]">${timeoutStats.todayTimeoutCount}</div>
        </div>
        <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
          <div class="text-[12px] text-[var(--text-muted)]">明日超时</div>
          <div class="mt-1 text-[20px] font-semibold leading-6 text-[#B54708]">${timeoutStats.tomorrowTimeoutCount}</div>
        </div>
        <div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
          <div class="text-[12px] text-[var(--text-muted)]">3天内超时</div>
          <div class="mt-1 text-[20px] font-semibold leading-6 text-[#175CD3]">${timeoutStats.threeDaysTimeoutCount}</div>
        </div>
      </div>
    </div>

    <div class="rounded-[12px] border border-[var(--border-default)] bg-white">
      <div class="overflow-x-auto rounded-[10px] border border-[var(--border-default)]">
        <table class="w-full min-w-[1580px] text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="min-w-[44px] w-[44px] border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-2 text-center text-[12px] font-medium">
                <input type="checkbox" class="h-4 w-4 cursor-pointer accent-[var(--primary)]" />
              </th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">单号</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">商品SPU</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">商品SKU</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">出库仓库</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">出库类型</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">收货单位</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">计划出库数量</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">库存状态</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">已拣货数量</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">货主</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">状态</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">时间</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium sticky right-0 z-20 border-l border-[var(--border-default)] bg-[var(--bg-subtle)]">操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.map((item) => `<tr class="hover:bg-[var(--bg-hover)]">
              <td class="border-b border-[var(--border-subtle)] px-2 py-2 text-center">
                <input type="checkbox" class="h-4 w-4 cursor-pointer accent-[var(--primary)]" ${item.status !== '待处理' ? 'disabled' : ''} />
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <div class="space-y-1">
                  <div><span class="text-[var(--text-muted)]">出库单号：</span><span class="text-[var(--text-primary)]">${item.outboundOrderNo}</span></div>
                  <div><span class="text-[var(--text-muted)]">拣货单号：</span><span class="text-[var(--text-primary)]">${item.pickOrderNo}</span></div>
                  <div><span class="text-[var(--text-muted)]">关联单号：</span><span class="text-[var(--text-primary)]">${item.relatedOrderNo}</span></div>
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
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.outboundQuantity}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <span class="inline-flex rounded-[999px] px-2 py-0.5 text-[12px] font-medium ${stockStatusBadgeClass(item.stockStatus)}">${item.stockStatus}</span>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.pickedQuantity}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.ownerName}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <span class="inline-flex rounded-[999px] px-2 py-0.5 text-[12px] font-medium ${statusBadgeClass(item.status)}">${item.status}</span>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <div class="min-w-[150px] space-y-1 text-[12px] text-[var(--text-secondary)]">
                  <div><span class="text-[var(--text-muted)]">创建时间：</span><span>${item.createTime}</span></div>
                  <div><span class="text-[var(--text-muted)]">支付时间：</span><span>${item.payTime}</span></div>
                  <div><span class="text-[var(--text-muted)]">发货截止：</span><span>${item.shipDeadline}</span></div>
                </div>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] sticky right-0 z-10 border-l border-[var(--border-default)] bg-white">
                <div class="flex items-center gap-2">
                  <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">查看</button>
                  ${item.status === '待处理' ? '<button type="button" class="rounded-[8px] bg-[var(--primary)] px-3 py-1 text-[12px] font-medium text-white transition hover:opacity-90">生成拣货单</button>' : ''}
                  ${item.status === '待拣货' || item.status === '拣货中' ? '<button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">打印拣货单</button>' : ''}
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(totalItems, 1, totalPages)}
    </div>

    <script>
    (function() {
      window.__wlsPreOutbound = {
        toggleStatus: function(status) {
          console.log('Toggle status filter:', status);
        },
        goPage: function(page) {
          console.log('Go to page:', page);
        },
        reset: function() {
          var search = document.getElementById('wls-po-search');
          if (search) search.value = '';
          var itemType = document.getElementById('wls-po-item-type');
          if (itemType) itemType.value = 'ALL';
          var timeType = document.getElementById('wls-po-time-type');
          if (timeType) timeType.value = '';
        }
      };
    })();
    </script>
  </section>`;
}
