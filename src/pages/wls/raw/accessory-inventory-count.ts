import type { AppState } from '../../../state/store'

type CountOrder = {
  countNo: string; warehouse: string; countType: string; scope: string
  detailCount: number; status: string; creator: string; updatedAt: string
}

const statusClass: Record<string, string> = {
  '已完成': 'bg-emerald-50 text-emerald-700',
  '待审核': 'bg-blue-50 text-blue-700',
  '盘点中': 'bg-orange-50 text-orange-700',
  '待盘点': 'bg-orange-50 text-orange-700',
  '已取消': 'bg-slate-100 text-slate-400',
}

const seedCounts: CountOrder[] = [
  { countNo: 'PD-ACC-001', warehouse: '中央总仓-辅料仓', countType: '全仓', scope: '全仓盘点', detailCount: 18, status: '已完成', creator: 'VM', updatedAt: '2026-05-29 09:20' },
  { countNo: 'PD-ACC-002', warehouse: '中央总仓-辅料仓', countType: 'SKU', scope: '重点SKU盘点', detailCount: 8, status: '待审核', creator: 'Rina', updatedAt: '2026-05-29 10:20' },
  { countNo: 'PD-ACC-003', warehouse: '中央总仓-辅料仓', countType: '库区', scope: '辅料货架区盘点', detailCount: 12, status: '盘点中', creator: 'VM', updatedAt: '2026-05-29 11:20' },
  { countNo: 'PD-ACC-004', warehouse: '中央总仓-辅料仓', countType: '全仓', scope: '全仓盘点', detailCount: 18, status: '待盘点', creator: 'Rina', updatedAt: '2026-05-29 12:20' },
  { countNo: 'PD-ACC-005', warehouse: '中央总仓-辅料仓', countType: '库位', scope: 'TRM-A-01盘点', detailCount: 4, status: '已完成', creator: 'VM', updatedAt: '2026-05-29 13:20' },
]

export function renderRawAccessoryInventoryCount(_state: AppState): string {
  const statusCounts: Record<string, number> = {}
  seedCounts.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1 })

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-800">辅料盘点</h1>
        <p class="text-sm text-slate-500 mt-0.5">以包装单位为主、基础单位为辅，记录辅料账面数量与实盘差异。</p>
      </div>
      <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">新建盘点单</button>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input id="wlsRawACSearch" type="text" placeholder="搜索盘点单号 / 仓库 / 创建人" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-72 focus:border-blue-400 focus:outline-none">
        <select id="wlsRawACStatus" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部</option>
          <option value="待盘点">待盘点 (${statusCounts['待盘点'] || 0})</option>
          <option value="盘点中">盘点中 (${statusCounts['盘点中'] || 0})</option>
          <option value="待审核">待审核 (${statusCounts['待审核'] || 0})</option>
          <option value="已完成">已完成 (${statusCounts['已完成'] || 0})</option>
          <option value="已取消">已取消 (${statusCounts['已取消'] || 0})</option>
        </select>
        <button id="wlsRawACReset" class="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">重置</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedCounts.length} 条记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1180px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">盘点单号</th>
            <th class="px-3 py-2 text-left font-medium">盘点仓库</th>
            <th class="px-3 py-2 text-left font-medium">盘点类型</th>
            <th class="px-3 py-2 text-left font-medium">盘点范围</th>
            <th class="px-3 py-2 text-right font-medium">明细行数</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium">创建人</th>
            <th class="px-3 py-2 text-left font-medium">更新时间</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody>
            ${seedCounts.map(c => `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2"><a href="javascript:void(0)" class="text-blue-600 hover:underline text-xs font-mono">${c.countNo}</a></td>
                <td class="px-3 py-2 text-slate-600">${c.warehouse}</td>
                <td class="px-3 py-2 text-slate-600">${c.countType}</td>
                <td class="px-3 py-2 text-slate-500">${c.scope}</td>
                <td class="px-3 py-2 text-right text-slate-600">${c.detailCount}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${statusClass[c.status] || 'bg-slate-100 text-slate-500'}">${c.status}</span></td>
                <td class="px-3 py-2 text-slate-600 text-xs">${c.creator}</td>
                <td class="px-3 py-2 text-slate-400 text-xs">${c.updatedAt}</td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <button class="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">查看</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    window.__wlsRawAccessoryCount = {
      init() {
        const select = document.getElementById('wlsRawACStatus');
        const resetBtn = document.getElementById('wlsRawACReset');
        const searchInput = document.getElementById('wlsRawACSearch');
        if (select) select.addEventListener('change', () => {});
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (select) select.value = '';
          });
        }
      }
    };
    window.__wlsRawAccessoryCount.init();
  </script>`
}
