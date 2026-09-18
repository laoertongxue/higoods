// Auto-extracted from Higood-wms App.tsx line 34327-34726
// 入库单列表 — finished warehouse putaway orders

import type { AppState } from '../../../state/store';

const PAGE_SIZE = 20;

type PutawayStatus = '待上架' | '上架中' | '部分上架' | '上架完成';

type PutawayItemLine = {
  spuCode: string;
  skuCode: string;
  inboundQuantity: number;
  putawayQuantity?: number;
  sourceLocation?: string;
  targetLocation?: string;
};

type PutawayOrder = {
  id: string;
  orderNo: string;
  inboundOrderNo: string;
  paNo: string;
  relatedOrderNo: string;
  batchNo: string;
  inboundWarehouse: string;
  status: PutawayStatus;
  itemLines: PutawayItemLine[];
  receivedTime: string;
  putawayTime: string;
  operatorName: string;
};

const PUTAWAY_SEED: PutawayOrder[] = (() => {
  const statuses: PutawayStatus[] = ['待上架', '上架中', '部分上架', '上架完成'];
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01'];
  const operators = ['张伟', '李娜', '王强', '刘洋', '陈静'];
  const zones = ['A区', 'B区', 'C区', 'D区'];
  const items: PutawayOrder[] = [];

  for (let i = 0; i < 38; i++) {
    const status = statuses[i % 4];
    const lineCount = 1 + (i % 3);
    const lines: PutawayItemLine[] = [];
    for (let j = 0; j < lineCount; j++) {
      const inboundQty = 50 + ((i + j) * 7) % 200;
      const putawayQty = status === '上架完成' ? inboundQty : status === '部分上架' ? Math.floor(inboundQty * 0.6) : status === '上架中' ? Math.floor(inboundQty * 0.3) : 0;
      lines.push({
        spuCode: `SPU-GC-${String(10001 + ((i + j) % 20)).padStart(5, '0')}`,
        skuCode: `SKU-GC-${String(40001 + i * 3 + j).padStart(5, '0')}`,
        inboundQuantity: inboundQty,
        putawayQuantity: putawayQty > 0 ? putawayQty : undefined,
        sourceLocation: status !== '待上架' ? `${zones[(i + j) % zones.length]}-${String((i % 12) + 1).padStart(2, '0')}-${String((j % 4) + 1).padStart(2, '0')}` : undefined,
        targetLocation: status !== '待上架' ? `${zones[(i + j + 1) % zones.length]}-${String(((i + 1) % 12) + 1).padStart(2, '0')}-${String(((j + 1) % 4) + 1).padStart(2, '0')}` : undefined,
      });
    }

    const dayOffset = Math.floor(i / 8);
    const baseDate = new Date(2026, 8, 18 - dayOffset, 7 + (i % 10), (i * 13) % 60);
    const receivedTime = baseDate.toISOString().slice(0, 16).replace('T', ' ');
    const putawayTime = status !== '待上架' ? new Date(baseDate.getTime() + 3600000 * (1 + (i % 3))).toISOString().slice(0, 16).replace('T', ' ') : '-';

    items.push({
      id: `PA-${String(i + 1).padStart(5, '0')}`,
      orderNo: `RK2026${String(3000 + i).padStart(6, '0')}`,
      inboundOrderNo: `IR2026${String(2000 + i).padStart(6, '0')}`,
      paNo: `SJ2026${String(1000 + i).padStart(6, '0')}`,
      relatedOrderNo: `ASN2026${String(500 + i).padStart(6, '0')}`,
      batchNo: `B2026${String(900 + i).padStart(5, '0')}`,
      inboundWarehouse: warehouses[i % warehouses.length],
      status,
      itemLines: lines,
      receivedTime,
      putawayTime,
      operatorName: operators[i % operators.length],
    });
  }
  return items;
})();

function statusBadgeClass(status: PutawayStatus): string {
  switch (status) {
    case '待上架': return 'bg-[#FFEAD5] text-[#B54708]';
    case '部分上架': return 'bg-[#FEF0C7] text-[#B54708]';
    case '上架中': return 'bg-[#EEF4FF] text-[#175CD3]';
    case '上架完成': return 'bg-[#D1FADF] text-[#067647]';
    default: return 'bg-[#F2F4F7] text-[#475467]';
  }
}

function renderPagination(total: number, page: number, totalPages: number): string {
  if (totalPages <= 1) return '';
  return `<div class="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] px-1 pt-3">
    <span class="text-[12px] text-[var(--text-muted)]">共 ${total} 条记录，第 ${page}/${totalPages} 页</span>
    <div class="flex items-center gap-1">
      <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40" ${page <= 1 ? 'disabled' : ''} onclick="window.__wlsPutaway?.goPage(${page - 1})">上一页</button>
      <button type="button" class="rounded-[6px] border border-[var(--primary)] bg-[var(--primary)] px-2 py-1 text-[12px] text-white">${page}</button>
      <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40" ${page >= totalPages ? 'disabled' : ''} onclick="window.__wlsPutaway?.goPage(${page + 1})">下一页</button>
    </div>
  </div>`;
}

export function renderFinishedPutaway(state: AppState): string {
  const allItems = PUTAWAY_SEED;
  const totalItems = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageItems = allItems.slice(0, PAGE_SIZE);

  const statusOptions: Array<'全部' | PutawayStatus> = ['全部', '待上架', '上架中', '部分上架', '上架完成'];

  return `<section>
    <div class="mb-4">
      <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">入库单列表</h2>
      <p class="mt-1 text-[13px] text-[var(--text-muted)]">用于查看入库任务执行信息，包含单号与状态等字段。</p>
    </div>

    <div class="mb-3 rounded-[12px] border border-[var(--border-default)] bg-white p-3">
      <div class="flex flex-wrap items-center gap-2">
        <input id="wls-pw-search" value="" placeholder="搜索单号 / 关联单号（ASN） / SPU / SKU / 批次号 / 库位" class="w-[420px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
        <select id="wls-pw-status" class="w-[160px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20">
          ${statusOptions.map((s) => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" onclick="window.__wlsPutaway?.clear()">清除</button>
        <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">导出Excel</button>
      </div>
    </div>

    <div class="rounded-[12px] border border-[var(--border-default)] bg-white">
      <div class="overflow-x-auto rounded-[10px] border border-[var(--border-default)]">
        <table class="w-full min-w-[2200px] text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">单号</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">入库仓库</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">状态</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">上架方式</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">入库数量</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">SPU编码</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">SKU 编码</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">库区</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">目标库位</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">上架数量</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">时间</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem]">操作人员</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium min-w-[10rem] sticky right-0 z-20 border-l border-[var(--border-default)] bg-[var(--bg-subtle)]">操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.map((item) => {
              const lines = item.itemLines.length > 0 ? item.itemLines : [{ spuCode: 'SPU-GC-10001', skuCode: 'SKU-GC-40001', inboundQuantity: 0 }];
              const lineRows = lines.map((line, lineIndex) => {
                const isFirst = lineIndex === 0;
                const rowSpan = lines.length;
                const qty = line.inboundQuantity > 0 ? line.inboundQuantity : '-';
                const putawayQty = line.putawayQuantity && line.putawayQuantity > 0 ? line.putawayQuantity : '暂无';
                const sourceLoc = item.status !== '待上架' ? (line.sourceLocation || '暂无') : '暂无';
                const targetLoc = item.status !== '待上架' ? (line.targetLocation || '暂无') : '暂无';

                if (isFirst) {
                  return `<tr class="hover:bg-[var(--bg-hover)]">
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]" rowspan="${rowSpan}">
                      <div class="space-y-1">
                        <div><span class="text-[var(--text-muted)]">入库单号：</span><span class="text-[var(--text-primary)]">${item.inboundOrderNo || item.orderNo}</span></div>
                        <div><span class="text-[var(--text-muted)]">上架单号：</span><span class="text-[var(--text-primary)]">${item.paNo}</span></div>
                        <div><span class="text-[var(--text-muted)]">关联单号（ASN）：</span><span class="text-[var(--text-primary)]">${item.relatedOrderNo || item.orderNo}</span></div>
                        <div><span class="text-[var(--text-muted)]">批次号：</span><span class="text-[var(--text-primary)]">${item.batchNo}</span></div>
                      </div>
                    </td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]" rowspan="${rowSpan}">${item.inboundWarehouse || '暂无'}</td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]" rowspan="${rowSpan}">
                      <span class="inline-flex rounded-[999px] px-2 py-0.5 text-[12px] font-medium ${statusBadgeClass(item.status)}">${item.status}</span>
                    </td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]" rowspan="${rowSpan}">
                      <span class="inline-flex rounded-[999px] bg-[#EFF8FF] px-2 py-0.5 text-[12px] font-medium text-[#175CD3]">手动上架</span>
                    </td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${qty}</td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${line.spuCode}</td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${line.skuCode}</td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${sourceLoc}</td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${targetLoc}</td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${putawayQty}</td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]" rowspan="${rowSpan}">
                      <div class="space-y-1">
                        <div><span class="text-[var(--text-muted)]">收货：</span><span class="text-[var(--text-primary)]">${item.receivedTime}</span></div>
                        <div><span class="text-[var(--text-muted)]">上架：</span><span class="text-[var(--text-primary)]">${item.putawayTime}</span></div>
                      </div>
                    </td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]" rowspan="${rowSpan}">${item.operatorName || '-'}</td>
                    <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] sticky right-0 z-10 border-l border-[var(--border-default)] bg-white whitespace-nowrap" rowspan="${rowSpan}">
                      <div class="flex items-center gap-2">
                        <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] ${item.status === '上架完成' ? 'cursor-not-allowed text-[var(--text-disabled)]' : ''}" ${item.status === '上架完成' ? 'disabled' : ''}>上架</button>
                      </div>
                    </td>
                  </tr>`;
                }
                return `<tr class="hover:bg-[var(--bg-hover)]">
                  <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${qty}</td>
                  <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${line.spuCode}</td>
                  <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${line.skuCode}</td>
                  <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${sourceLoc}</td>
                  <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${targetLoc}</td>
                  <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${putawayQty}</td>
                </tr>`;
              }).join('');
              return lineRows;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(totalItems, 1, totalPages)}
    </div>

    <script>
    (function() {
      window.__wlsPutaway = {
        goPage: function(page) { console.log('Go to page:', page); },
        clear: function() {
          var search = document.getElementById('wls-pw-search');
          if (search) search.value = '';
          var status = document.getElementById('wls-pw-status');
          if (status) status.value = '全部';
        }
      };
    })();
    </script>
  </section>`;
}
