import type { AppState } from '../../../state/store'

type StockLocationRow = {
  warehouse: string; zone: string; location: string
  spu: string; sku: string; qty: string; updatedAt: string
}

const seedRows: StockLocationRow[] = [
  { warehouse: '中央总仓-面料仓', zone: '面料区A', location: 'FAB-A-01', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50001', qty: '12 卷 / 960 米', updatedAt: '2026-05-30 14:20' },
  { warehouse: '中央总仓-面料仓', zone: '面料区A', location: 'FAB-A-02', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50002', qty: '8 卷 / 640 米', updatedAt: '2026-05-30 14:25' },
  { warehouse: '中央总仓-面料仓', zone: '面料区A', location: 'FAB-A-03', spu: 'SPU-FAB-1002', sku: 'SKU-FAB-50003', qty: '5 卷 / 400 米', updatedAt: '2026-05-30 14:30' },
  { warehouse: '中央总仓-面料仓', zone: '面料区B', location: 'FAB-B-01', spu: 'SPU-FAB-1003', sku: 'SKU-FAB-50004', qty: '20 卷 / 1600 米', updatedAt: '2026-05-30 15:00' },
  { warehouse: '中央总仓-辅料仓', zone: '辅料货架区', location: 'TRM-A-01', spu: 'SPU-TRM-1001', sku: 'SKU-TRM-50001', qty: '30 包 / 15000 颗', updatedAt: '2026-05-30 13:10' },
  { warehouse: '中央总仓-辅料仓', zone: '辅料货架区', location: 'TRM-A-02', spu: 'SPU-TRM-1002', sku: 'SKU-TRM-50002', qty: '18 包 / 9000 颗', updatedAt: '2026-05-30 13:15' },
  { warehouse: '中央总仓-辅料仓', zone: '辅料暂存区', location: 'TRM-T-01', spu: 'SPU-TRM-1003', sku: 'SKU-TRM-50003', qty: '6 包 / 3000 颗', updatedAt: '2026-05-30 13:20' },
  { warehouse: '中央总仓-耗材仓', zone: '耗材区', location: 'CON-A-01', spu: 'SPU-CON-1001', sku: 'SKU-CON-50001', qty: '24 箱 / 2880 个', updatedAt: '2026-05-30 12:00' },
  { warehouse: '中央总仓-耗材仓', zone: '耗材区', location: 'CON-A-02', spu: 'SPU-CON-1002', sku: 'SKU-CON-50002', qty: '10 箱 / 1200 个', updatedAt: '2026-05-30 12:05' },
  { warehouse: '中央总仓-包材仓', zone: '包材区', location: 'PKG-A-01', spu: 'SPU-PKG-1001', sku: 'SKU-PKG-50001', qty: '40 包 / 8000 个', updatedAt: '2026-05-30 11:30' },
  { warehouse: '中央总仓-纱线仓', zone: '纱线区', location: 'YRN-A-01', spu: 'SPU-YRN-1001', sku: 'SKU-YRN-50001', qty: '15 卷 / 1200 米', updatedAt: '2026-05-30 10:40' },
  { warehouse: '中央总仓-纱线仓', zone: '纱线区', location: 'YRN-A-02', spu: 'SPU-YRN-1002', sku: 'SKU-YRN-50002', qty: '8 卷 / 640 米', updatedAt: '2026-05-30 10:45' },
]

export function renderRawStockLocation(_state: AppState): string {
  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-800">仓位库存查询</h1>
        <p class="text-sm text-slate-500 mt-0.5">用于按仓库、库区、库位维度查看库存分布。</p>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input id="wlsRawSLSearch" type="text" placeholder="搜索仓库名称 / 仓库库区 / 仓库库位 / 商品SPU / 商品SKU" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-96 focus:border-blue-400 focus:outline-none">
        <button id="wlsRawSLClear" class="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">清除</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedRows.length} 条记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1200px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">仓库名称</th>
            <th class="px-3 py-2 text-left font-medium">仓库库区</th>
            <th class="px-3 py-2 text-left font-medium">仓库库位</th>
            <th class="px-3 py-2 text-left font-medium">商品SPU</th>
            <th class="px-3 py-2 text-left font-medium">商品SKU</th>
            <th class="px-3 py-2 text-right font-medium">库存数量</th>
            <th class="px-3 py-2 text-left font-medium">更新时间</th>
          </tr></thead>
          <tbody id="wlsRawSLBody">
            ${buildStockLocationRows(seedRows)}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    window.__wlsRawStockLocation = {
      allRows: ${JSON.stringify(seedRows)},
      init() {
        const input = document.getElementById('wlsRawSLSearch');
        const clearBtn = document.getElementById('wlsRawSLClear');
        if (input) {
          input.addEventListener('input', () => {
            const kw = input.value.trim().toLowerCase();
            const filtered = kw ? this.allRows.filter(r =>
              r.warehouse.toLowerCase().includes(kw) ||
              r.zone.toLowerCase().includes(kw) ||
              r.location.toLowerCase().includes(kw) ||
              r.spu.toLowerCase().includes(kw) ||
              r.sku.toLowerCase().includes(kw)
            ) : this.allRows;
            document.getElementById('wlsRawSLBody').innerHTML = this.renderRows(filtered);
          });
        }
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            if (input) input.value = '';
            document.getElementById('wlsRawSLBody').innerHTML = this.renderRows(this.allRows);
          });
        }
      },
      renderRows(rows) {
        return ${buildStockLocationRows.toString().replace('seedRows', 'rows')};
      }
    };
    window.__wlsRawStockLocation.init();
  </script>`
}

function buildStockLocationRows(rows: StockLocationRow[]): string {
  /* Compute rowSpan groups for warehouse and zone */
  const whGroups: Record<string, number> = {}
  const zoneGroups: Record<string, number> = {}
  rows.forEach(r => {
    whGroups[r.warehouse] = (whGroups[r.warehouse] || 0) + 1
    const zk = r.warehouse + '|' + r.zone
    zoneGroups[zk] = (zoneGroups[zk] || 0) + 1
  })

  const whSeen: Record<string, boolean> = {}
  const zoneSeen: Record<string, boolean> = {}
  let html = ''

  rows.forEach(r => {
    const zk = r.warehouse + '|' + r.zone
    const isFirstWh = !whSeen[r.warehouse]
    const isFirstZone = !zoneSeen[zk]
    whSeen[r.warehouse] = true
    zoneSeen[zk] = true

    html += `<tr class="border-t border-slate-100 hover:bg-slate-50">`
    if (isFirstWh) {
      html += `<td class="px-3 py-2 text-slate-700 font-medium" rowspan="${whGroups[r.warehouse]}">${r.warehouse}</td>`
    }
    if (isFirstZone) {
      html += `<td class="px-3 py-2 text-slate-600" rowspan="${zoneGroups[zk]}">${r.zone}</td>`
    }
    html += `
      <td class="px-3 py-2 font-mono text-xs text-slate-700">${r.location}</td>
      <td class="px-3 py-2"><a href="javascript:void(0)" class="text-blue-600 hover:underline text-xs font-mono">${r.spu}</a></td>
      <td class="px-3 py-2 text-slate-600 text-xs font-mono">${r.sku}</td>
      <td class="px-3 py-2 text-right text-slate-700 font-medium whitespace-nowrap">${r.qty}</td>
      <td class="px-3 py-2 text-slate-400 text-xs">${r.updatedAt}</td>
    </tr>`
  })

  return html
}
