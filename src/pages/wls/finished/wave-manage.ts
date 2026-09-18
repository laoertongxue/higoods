// Auto-extracted from Higood-wms App.tsx line 31842-31977
// 波次管理 — finished warehouse wave management

import type { AppState } from '../../../state/store';

const PAGE_SIZE = 20;

type WaveStatus = '待拣货' | '部分拣货' | '拣货完成';
type WaveType = 'MULTI_ITEM_BASKET' | 'SINGLE_SKU';

type WaveRecord = {
  id: string;
  waveNo: string;
  warehouseName: string;
  waveType: WaveType;
  orderCount: number;
  skuCount: number;
  outboundQuantity: number;
  pickedQuantity: number;
  operatorName: string;
  status: WaveStatus;
  createdAt: string;
};

const WAVE_SEED: WaveRecord[] = (() => {
  const statuses: WaveStatus[] = ['待拣货', '部分拣货', '拣货完成'];
  const types: WaveType[] = ['MULTI_ITEM_BASKET', 'SINGLE_SKU'];
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01'];
  const operators = ['张伟', '李娜', '王强', '刘洋', '陈静', '赵敏'];
  const items: WaveRecord[] = [];

  for (let i = 0; i < 36; i++) {
    const status = statuses[i % 3];
    const waveType = types[i % 2];
    const orderCount = 5 + (i * 3) % 25;
    const skuCount = orderCount + (i % 8);
    const outboundQty = orderCount * (10 + (i % 5) * 3);
    const pickedQty = status === '拣货完成' ? outboundQty : status === '部分拣货' ? Math.floor(outboundQty * 0.5) : 0;
    const dayOffset = Math.floor(i / 6);
    const baseDate = new Date(2026, 8, 18 - dayOffset, 8 + (i % 10), (i * 7) % 60);
    const createdAt = baseDate.toISOString().slice(0, 16).replace('T', ' ');

    items.push({
      id: `WV-${String(i + 1).padStart(5, '0')}`,
      waveNo: `W2026091${String(i + 1).padStart(2, '0')}-${String((i % 5) + 1).padStart(2, '0')}`,
      warehouseName: warehouses[i % warehouses.length],
      waveType,
      orderCount,
      skuCount,
      outboundQuantity: outboundQty,
      pickedQuantity: pickedQty,
      operatorName: operators[i % operators.length],
      status,
      createdAt,
    });
  }
  return items;
})();

function statusBadgeClass(status: WaveStatus): string {
  switch (status) {
    case '拣货完成': return 'bg-[#D1FADF] text-[#067647]';
    case '部分拣货': return 'bg-[#FEF0C7] text-[#B54708]';
    default: return 'bg-[#F2F4F7] text-[#475467]';
  }
}

function waveTypeLabel(type: WaveType): string {
  return type === 'MULTI_ITEM_BASKET' ? '一单多件篮分播' : '单 SKU 波次';
}

function renderPagination(total: number, page: number, totalPages: number): string {
  if (totalPages <= 1) return '';
  return `<div class="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] px-1 pt-3">
    <span class="text-[12px] text-[var(--text-muted)]">共 ${total} 条记录，第 ${page}/${totalPages} 页</span>
    <div class="flex items-center gap-1">
      <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40" ${page <= 1 ? 'disabled' : ''} onclick="window.__wlsWaveManage?.goPage(${page - 1})">上一页</button>
      <button type="button" class="rounded-[6px] border border-[var(--primary)] bg-[var(--primary)] px-2 py-1 text-[12px] text-white">${page}</button>
      <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40" ${page >= totalPages ? 'disabled' : ''} onclick="window.__wlsWaveManage?.goPage(${page + 1})">下一页</button>
    </div>
  </div>`;
}

export function renderFinishedWaveManage(state: AppState): string {
  const allItems = WAVE_SEED;
  const totalItems = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageItems = allItems.slice(0, PAGE_SIZE);

  return `<section>
    <div class="mb-4">
      <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">波次管理</h2>
      <p class="mt-1 text-[13px] text-[var(--text-muted)]">用于按仓库与日期查看出库波次汇总与处理进度。</p>
    </div>

    <div class="mb-3 rounded-[12px] border border-[var(--border-default)] bg-white p-3">
      <div class="flex flex-wrap items-center gap-2">
        <input id="wls-wm-search" value="" placeholder="搜索波次号 / 仓库 / 状态" class="w-[360px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
        <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50" disabled>删除波次</button>
        <span class="text-[12px] text-[var(--text-muted)]">已选 0 条</span>
        <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" onclick="window.__wlsWaveManage?.clear()">清除</button>
      </div>
    </div>

    <div class="rounded-[12px] border border-[var(--border-default)] bg-white">
      <div class="overflow-x-auto rounded-[10px] border border-[var(--border-default)]">
        <table class="w-full min-w-[1040px] text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="min-w-[44px] w-[44px] border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-2 text-center text-[12px] font-medium">
                <input type="checkbox" class="h-4 w-4 cursor-pointer accent-[var(--primary)]" />
              </th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">波次号</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">出库仓库</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">波次类型</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">订单数</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">SKU数</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">计划出库数量</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">已拣货数量</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">操作人员</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">状态</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">创建时间</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.map((item) => `<tr class="hover:bg-[var(--bg-hover)]">
              <td class="border-b border-[var(--border-subtle)] px-2 py-2 text-center">
                <input type="checkbox" class="h-4 w-4 cursor-pointer accent-[var(--primary)]" />
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <button type="button" class="text-[var(--link)] hover:underline">${item.waveNo}</button>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.warehouseName}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <span class="inline-flex rounded-[999px] bg-[#E0F2FE] px-2 py-0.5 text-[12px] font-medium text-[#026AA2]">${waveTypeLabel(item.waveType)}</span>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.orderCount}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.skuCount}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.outboundQuantity}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.pickedQuantity}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.operatorName || '-'}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
                <span class="inline-flex rounded-[999px] px-2 py-0.5 text-[12px] font-medium ${statusBadgeClass(item.status)}">${item.status}</span>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.createdAt}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(totalItems, 1, totalPages)}
    </div>

    <script>
    (function() {
      window.__wlsWaveManage = {
        goPage: function(page) { console.log('Go to page:', page); },
        clear: function() {
          var search = document.getElementById('wls-wm-search');
          if (search) search.value = '';
        }
      };
    })();
    </script>
  </section>`;
}
