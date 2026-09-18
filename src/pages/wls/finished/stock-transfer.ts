import type { AppState } from '../../../state/store';

type StockTransferRecord = {
  id: string;
  transferNo: string;
  sourceWarehouse: string;
  sourceZone: string;
  sourceLocation: string;
  targetWarehouse: string;
  targetZone: string;
  targetLocation: string;
  spu: string;
  sku: string;
  quantity: number;
  createdTime: string;
  status: '待执行' | '移货中' | '已完成';
};

const TRANSFER_SEED: StockTransferRecord[] = (() => {
  const statuses: Array<'待执行' | '移货中' | '已完成'> = ['待执行', '移货中', '已完成'];
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01'];
  const zones = ['A区', 'B区', 'C区'];
  const locations = ['A01-01', 'A01-02', 'A02-03', 'B01-02', 'B03-01', 'C01-01'];
  const records: StockTransferRecord[] = [];

  for (let i = 0; i < 24; i++) {
    const status = statuses[i % 3];
    const dayOffset = Math.floor(i / 8);
    const baseDate = new Date(2026, 8, 18 - dayOffset, 9 + (i % 8), (i * 11) % 60);

    records.push({
      id: `ST-${String(i + 1).padStart(4, '0')}`,
      transferNo: `YH2026${String(3000 + i).padStart(6, '0')}`,
      sourceWarehouse: warehouses[i % 2],
      sourceZone: zones[i % 3],
      sourceLocation: locations[i % 6],
      targetWarehouse: warehouses[i % 2],
      targetZone: zones[(i + 1) % 3],
      targetLocation: locations[(i + 2) % 6],
      spu: `SPU-GC-${String(10001 + (i % 15)).padStart(5, '0')}`,
      sku: `SKU-GC-${String(20001 + i).padStart(5, '0')}`,
      quantity: 5 + (i * 3) % 40,
      createdTime: baseDate.toISOString().slice(0, 16).replace('T', ' '),
      status,
    });
  }
  return records;
})();

function statusBadgeClass(status: string): string {
  switch (status) {
    case '已完成': return 'bg-[#ECFDF3] text-[#027A48]';
    case '移货中': return 'bg-[#EEF4FF] text-[#175CD3]';
    default: return 'bg-[#FFEAD5] text-[#B54708]';
  }
}

export function renderFinishedStockTransfer(_state: AppState): string {
  const records = TRANSFER_SEED;

  return `<section>
    <div class="mb-4">
      <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">移货操作</h2>
      <p class="mt-1 text-[13px] text-[var(--text-muted)]">用于仓库内部不同库区、库位之间的移货操作。</p>
    </div>

    <div class="mb-3 rounded-[12px] border border-[var(--border-default)] bg-white p-4">
      <div class="flex items-center justify-between gap-3">
        <div class="text-[13px] text-[var(--text-muted)]">点击"新增移货任务"创建待执行任务，再在列表中执行。</div>
        <button type="button" class="rounded-[8px] bg-[var(--primary)] px-3 py-[7px] text-[13px] font-medium text-white transition hover:opacity-90" onclick="window.__wlsStockTransfer?.openCreate()">新增移货任务</button>
      </div>
    </div>

    <div class="rounded-[12px] border border-[var(--border-default)] bg-white">
      <div class="overflow-x-auto rounded-[10px] border border-[var(--border-default)]">
        <table class="w-full min-w-[1400px] text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">移货单号</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">调出仓位</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">调入仓位</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">商品SPU</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">商品SKU</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">移货数量</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">创建时间</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">状态</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium sticky right-0 z-20 border-l border-[var(--border-default)] bg-[var(--bg-subtle)]">操作</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((record) => `<tr class="hover:bg-[var(--bg-hover)]">
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[var(--link)]">${record.transferNo}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${record.sourceWarehouse} / ${record.sourceZone} / ${record.sourceLocation}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${record.targetWarehouse} / ${record.targetZone} / ${record.targetLocation}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${record.spu}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${record.sku}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 font-medium text-[var(--text-primary)]">${record.quantity}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${record.createdTime}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">
                <span class="inline-flex rounded-[999px] px-2 py-0.5 text-[12px] font-medium ${statusBadgeClass(record.status)}">${record.status}</span>
              </td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 sticky right-0 z-10 border-l border-[var(--border-default)] bg-white">
                <button type="button" class="rounded-[8px] ${record.status === '待执行' ? 'bg-[var(--primary)] text-white' : 'border border-[var(--border-default)] bg-white text-[var(--text-secondary)]'} px-3 py-1 text-[12px] transition hover:opacity-90" onclick="window.__wlsStockTransfer?.openDetail('${record.id}')">
                  ${record.status === '已完成' ? '已执行' : record.status === '移货中' ? '移货中' : '执行移货'}
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <script>
    (function() {
      window.__wlsStockTransfer = {
        openCreate: function() { console.log('Open create stock transfer task'); },
        openDetail: function(id) { console.log('Open stock transfer detail:', id); }
      };
    })();
    </script>
  </section>`;
}
