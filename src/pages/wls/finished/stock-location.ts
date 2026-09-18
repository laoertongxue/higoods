import type { AppState } from '../../../state/store';

type StockLocationRow = {
  id: string;
  warehouseName: string;
  warehouseZone: string;
  warehouseLocation: string;
  spu: string;
  sku: string;
  quantity: number;
  updatedAt: string;
};

const STOCK_LOCATION_SEED: StockLocationRow[] = (() => {
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01'];
  const zones = ['A区', 'B区', 'C区'];
  const locations = ['A01-01', 'A01-02', 'A02-03', 'B01-02', 'B03-01', 'C01-01', 'C02-01'];
  const rows: StockLocationRow[] = [];

  for (let i = 0; i < 40; i++) {
    const wh = warehouses[i % warehouses.length];
    const zone = zones[i % zones.length];
    const loc = locations[i % locations.length];
    const dayOffset = Math.floor(i / 10);
    const baseDate = new Date(2026, 8, 18 - dayOffset, 10 + (i % 8), (i * 7) % 60);

    rows.push({
      id: `SL-${String(i + 1).padStart(5, '0')}`,
      warehouseName: wh,
      warehouseZone: zone,
      warehouseLocation: loc,
      spu: `SPU-GC-${String(10001 + (i % 20)).padStart(5, '0')}`,
      sku: `SKU-GC-${String(20001 + i).padStart(5, '0')}`,
      quantity: 10 + (i * 7) % 120,
      updatedAt: baseDate.toISOString().slice(0, 16).replace('T', ' '),
    });
  }
  return rows;
})();

export function renderFinishedStockLocation(_state: AppState): string {
  const rows = STOCK_LOCATION_SEED;

  return `<section>
    <div class="mb-4">
      <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">仓位库存查询</h2>
      <p class="mt-1 text-[13px] text-[var(--text-muted)]">用于按仓库、库区、库位维度查看库存分布。</p>
    </div>

    <div class="mb-3 rounded-[12px] border border-[var(--border-default)] bg-white p-3">
      <div class="flex flex-wrap items-center gap-2">
        <input value="" placeholder="搜索仓库名称 / 仓库库区 / 仓库库位 / 商品SPU / 商品SKU" class="w-[420px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
        <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" onclick="window.__wlsStockLocation?.clear()">清除</button>
      </div>
    </div>

    <div class="rounded-[12px] border border-[var(--border-default)] bg-white">
      <div class="overflow-x-auto rounded-[10px] border border-[var(--border-default)]">
        <table class="w-full min-w-[1200px] text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">仓库名称</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">仓库库区</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">仓库库位</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">商品SPU</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">商品SKU</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">库存数量</th>
              <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `<tr class="hover:bg-[var(--bg-hover)]">
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${row.warehouseName}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${row.warehouseZone}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${row.warehouseLocation}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[var(--link)]">${row.spu}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${row.sku}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2 font-medium text-[var(--text-primary)]">${row.quantity}</td>
              <td class="border-b border-[var(--border-subtle)] px-3 py-2">${row.updatedAt}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <script>
    (function() {
      window.__wlsStockLocation = {
        clear: function() { console.log('Clear stock location filters'); }
      };
    })();
    </script>
  </section>`;
}
