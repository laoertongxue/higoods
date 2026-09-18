import type { AppState } from '../../../state/store'

type Log = { type: string; order: string; sku: string; qty: number | string; box: string; location: string; operator: string; time: string; note: string }

const seedLogs: Log[] = [
  { type: '创建拣货波次', order: 'JH-20260829-001、JH-20260829-002', sku: '-', qty: 6, box: '-', location: 'A区', operator: '仓库主管-王敏', time: '2026-08-29 10:20', note: '仅增加波次占用，库存位置未变化' },
  { type: 'PDA拣货', order: 'JH-20260829-003', sku: 'SKU-JACKET-KHA-S', qty: 1, box: '-', location: 'C01-01', operator: 'PDA操作员-张伟', time: '2026-08-29 10:40', note: '库位与SKU扫码校验通过' },
  { type: 'PDA拣货', order: 'JH-20260820-018', sku: 'SKU-CARD-WHT-M', qty: 1, box: '-', location: 'A03-08', operator: 'PDA操作员-张伟', time: '2026-08-29 09:15', note: '库位与SKU扫码校验通过' },
  { type: '交接集货区', order: 'JH-20260820-018', sku: 'SKU-CARD-WHT-M', qty: 1, box: '-', location: '集货区待分配', operator: 'PDA操作员-张伟', time: '2026-08-29 09:45', note: '来源 A03-08，正常库存减少、波次占用释放、待分配库存增加' },
  { type: '二次分拨', order: 'JH-20260829-001', sku: 'SKU-DRESS-BLK-M', qty: 2, box: 'BOX-001', location: '订单集货箱', operator: 'PDA操作员-张伟', time: '2026-08-29 10:31', note: 'SKU与集货箱扫码确认' },
  { type: '二次分拨', order: 'JH-20260829-002', sku: 'SKU-DRESS-BLK-M', qty: 2, box: 'BOX-002', location: '订单集货箱', operator: 'PDA操作员-张伟', time: '2026-08-29 10:33', note: 'SKU与集货箱扫码确认' },
  { type: '集货移出回库', order: 'JH-CANCEL-001', sku: 'SKU-HOOD-BLK-L', qty: 1, box: 'BOX-003', location: 'A05-01', operator: '张仓管', time: '2026-08-29 11:20', note: '订单取消；扫码回库' },
]

export function renderCollectionRecords(_state: AppState): string {
  const rows = seedLogs.map(l => `
    <tr class="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
      <td class="px-3 py-3">${l.type}</td>
      <td class="px-3 py-3">${l.order}</td>
      <td class="px-3 py-3 font-mono text-xs">${l.sku}</td>
      <td class="px-3 py-3 text-center">${l.qty}</td>
      <td class="px-3 py-3">${l.box}</td>
      <td class="px-3 py-3">${l.location}</td>
      <td class="px-3 py-3">${l.operator}</td>
      <td class="px-3 py-3 whitespace-nowrap">${l.time}</td>
      <td class="px-3 py-3 text-[var(--text-muted)]">${l.note}</td>
    </tr>
  `).join('')

  return `
    <div class="space-y-4">
      <div>
        <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">集货记录</h2>
        <p class="mt-1 text-[13px] text-[var(--text-muted)]">成衣仓预售订单提前集货流程 · 完整操作追溯</p>
      </div>

      <div class="overflow-auto rounded-lg border border-[var(--border-default)] bg-white">
        <table class="min-w-[1200px] w-full text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="px-3 py-3 text-left font-medium">动作类型</th>
              <th class="px-3 py-3 text-left font-medium">关联订单</th>
              <th class="px-3 py-3 text-left font-medium">SKU</th>
              <th class="px-3 py-3 text-center font-medium">数量</th>
              <th class="px-3 py-3 text-left font-medium">箱/波次</th>
              <th class="px-3 py-3 text-left font-medium">位置</th>
              <th class="px-3 py-3 text-left font-medium">操作人</th>
              <th class="px-3 py-3 text-left font-medium">时间</th>
              <th class="px-3 py-3 text-left font-medium">说明</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <div class="rounded-lg border border-[var(--border-default)] bg-white p-5 text-sm">
        <h3 class="font-semibold text-[var(--text-primary)]">功能逻辑说明</h3>
        <div class="mt-3 space-y-2 text-[var(--text-muted)]">
          <p><b class="text-[var(--text-secondary)]">完整追溯：</b>记录规则运行、创建波次、领取、扫码、短拣和交接动作。</p>
          <p><b class="text-[var(--text-secondary)]">数据来源：</b>执行创建波次、PDA拣货或交接后将在这里形成记录。</p>
        </div>
      </div>
    </div>
  `
}
