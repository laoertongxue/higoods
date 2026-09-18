import type { AppState } from '../../../state/store';

type InventoryCountRow = {
  countNo: string;
  warehouseName: string;
  countType: string;
  scope: string;
  detailCount: number;
  status: '待盘点' | '盘点中' | '待审核' | '已完成' | '已取消';
  creator: string;
  updatedAt: string;
};

const INVENTORY_COUNT_SEED: InventoryCountRow[] = (() => {
  const statuses: Array<'待盘点' | '盘点中' | '待审核' | '已完成' | '已取消'> = ['待盘点', '盘点中', '待审核', '已完成', '已取消'];
  const countTypes = ['全仓', '库区', '库位', 'SKU'];
  const scopes = ['成衣仓全仓', 'A区', 'B区-货架区', 'SPU-GC-10001 ~ SPU-GC-10010'];
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01'];
  const creators = ['张仓管', '李主管', '王组长', '赵仓管'];
  const rows: InventoryCountRow[] = [];

  for (let i = 0; i < 20; i++) {
    const status = statuses[i % 5];
    const dayOffset = Math.floor(i / 5);
    const baseDate = new Date(2026, 8, 18 - dayOffset, 9 + (i % 8), (i * 13) % 60);

    rows.push({
      countNo: `PD-2026082${String(i + 1).padStart(2, '0')}`,
      warehouseName: warehouses[i % warehouses.length],
      countType: countTypes[i % countTypes.length],
      scope: scopes[i % scopes.length],
      detailCount: 5 + (i * 3) % 30,
      status,
      creator: creators[i % creators.length],
      updatedAt: baseDate.toISOString().slice(0, 16).replace('T', ' '),
    });
  }
  return rows;
})();

function statusBadgeClass(status: string): string {
  switch (status) {
    case '已完成': return 'bg-[#ECFDF3] text-[#027A48]';
    case '待审核': return 'bg-[#EEF4FF] text-[#175CD3]';
    case '已取消': return 'bg-[#F2F4F7] text-[#475467]';
    default: return 'bg-[#FFEAD5] text-[#B54708]';
  }
}

export function renderFinishedInventoryCount(_state: AppState): string {
  const rows = INVENTORY_COUNT_SEED;

  return `<section>
    <div class="mb-4">
      <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">库存盘点</h2>
      <p class="mt-1 text-[13px] text-[var(--text-muted)]">以包装单位为主、基础单位为辅，记录账面数量、实盘数量和差异数量。</p>
    </div>

    <div class="mb-3 rounded-[12px] border border-[var(--border-default)] bg-white p-3">
      <div class="flex flex-wrap items-center gap-2">
        <input class="w-[360px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" placeholder="搜索盘点单号 / 仓库 / 盘点原因 / 创建人" />
        <select class="w-40 rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20">
          <option value="全部">状态：全部</option>
          <option value="待盘点">待盘点</option>
          <option value="盘点中">盘点中</option>
          <option value="待审核">待审核</option>
          <option value="已完成">已完成</option>
          <option value="已取消">已取消</option>
        </select>
        <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" onclick="window.__wlsInventoryCount?.reset()">重置</button>
        <button type="button" class="rounded-[8px] bg-[var(--primary)] px-3 py-[7px] text-[13px] font-medium text-white transition hover:opacity-90" onclick="window.__wlsInventoryCount?.openCreate()">新建盘点单</button>
      </div>
    </div>

    <div class="rounded-[12px] border border-[var(--border-default)] bg-white">
      <div class="overflow-x-auto rounded-[10px] border border-[var(--border-default)]">
        <table class="w-full min-w-[1180px] text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">盘点单号</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">盘点仓库</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">盘点类型</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">盘点范围</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">明细行数</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">状态</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">创建人</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">更新时间</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium sticky right-0 z-20 border-l border-[var(--border-default)] bg-[var(--bg-subtle)]">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `<tr class="hover:bg-[var(--bg-hover)]">
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 font-medium text-[var(--link)]">${row.countNo}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${row.warehouseName}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${row.countType}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${row.scope}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${row.detailCount}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">
                <span class="inline-flex rounded-[999px] px-2 py-0.5 text-[12px] font-medium ${statusBadgeClass(row.status)}">${row.status}</span>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${row.creator}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${row.updatedAt}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 sticky right-0 z-10 border-l border-[var(--border-default)] bg-white">
                <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" onclick="window.__wlsInventoryCount?.openDetail('${row.countNo}')">查看</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <script>
    (function() {
      window.__wlsInventoryCount = {
        openCreate: function() { console.log('Open create inventory count'); },
        openDetail: function(countNo) { console.log('Open inventory count detail:', countNo); },
        reset: function() { console.log('Reset inventory count filters'); }
      };
    })();
    </script>
  </section>`;
}
