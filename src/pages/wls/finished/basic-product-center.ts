import type { AppState } from '../../../state/store'

type Product = { spu: string; sku: string; name: string; productType: 'FINISHED_GOODS' | 'MATERIAL'; materialCategory: string; baseUnit: string; packagingUnit: string; sourceSystem: string; syncTime: string; syncStatus: '同步成功' | '同步中' | '同步失败' }

const syncStatusClass = (s: string) => {
  if (s === '同步成功') return 'bg-emerald-50 text-emerald-700'
  if (s === '同步中') return 'bg-blue-50 text-blue-700'
  return 'bg-red-50 text-red-700'
}

const seedProducts: Product[] = [
  { spu: 'SPU-DRESS-BLK', sku: 'SKU-DRESS-BLK-S', name: '黑色连衣裙 S', productType: 'FINISHED_GOODS', materialCategory: '-', baseUnit: '件', packagingUnit: '件', sourceSystem: '商品中心', syncTime: '2026-08-28 08:00', syncStatus: '同步成功' },
  { spu: 'SPU-DRESS-BLK', sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', productType: 'FINISHED_GOODS', materialCategory: '-', baseUnit: '件', packagingUnit: '件', sourceSystem: '商品中心', syncTime: '2026-08-28 08:00', syncStatus: '同步成功' },
  { spu: 'SPU-TEE-WHT', sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', productType: 'FINISHED_GOODS', materialCategory: '-', baseUnit: '件', packagingUnit: '件', sourceSystem: '商品中心', syncTime: '2026-08-28 08:00', syncStatus: '同步成功' },
  { spu: 'SPU-JEAN-BLU', sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', productType: 'FINISHED_GOODS', materialCategory: '-', baseUnit: '件', packagingUnit: '件', sourceSystem: '商品中心', syncTime: '2026-08-28 08:00', syncStatus: '同步成功' },
  { spu: 'MAT-COTTON', sku: 'MAT-COTTON-001', name: '纯棉面料 A', productType: 'MATERIAL', materialCategory: '面料', baseUnit: '米', packagingUnit: '卷', sourceSystem: '物料中心', syncTime: '2026-08-28 09:00', syncStatus: '同步成功' },
  { spu: 'MAT-BUTTON', sku: 'MAT-BUTTON-001', name: '金属纽扣 银色', productType: 'MATERIAL', materialCategory: '辅料', baseUnit: '个', packagingUnit: '包', sourceSystem: '物料中心', syncTime: '2026-08-28 09:00', syncStatus: '同步中' },
  { spu: 'MAT-ZIPPER', sku: 'MAT-ZIPPER-001', name: '隐形拉链 40cm', productType: 'MATERIAL', materialCategory: '辅料', baseUnit: '条', packagingUnit: '包', sourceSystem: '物料中心', syncTime: '2026-08-28 09:00', syncStatus: '同步失败' },
]

export function renderBasicProductCenter(_state: AppState): string {
  const rows = seedProducts.map(p => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs font-mono text-slate-700">${p.spu}</td>
    <td class="px-3 py-2 text-xs font-mono text-slate-700">${p.sku}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${p.name}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">${p.productType === 'FINISHED_GOODS' ? '成衣商品' : '面辅料物料'}</span></td>
    <td class="px-3 py-2 text-xs text-slate-600">${p.materialCategory}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${p.baseUnit}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${p.packagingUnit}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${p.sourceSystem}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${p.syncTime}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${syncStatusClass(p.syncStatus)}">${p.syncStatus}</span></td>
    <td class="px-3 py-2 text-xs">
      <button class="text-[var(--link)] hover:underline">查看详情</button>
    </td>
  </tr>`).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">商品中心</h1>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="mb-3 flex gap-2">
        <button class="rounded-md border border-[var(--link)] bg-[var(--link)] px-3 py-1 text-xs text-white">成衣商品</button>
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">面辅料物料</button>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <input type="text" placeholder="SPU编码" class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <input type="text" placeholder="SKU编码" class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <input type="text" placeholder="商品 / 物料名称" class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <input type="text" placeholder="物料分类" class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <input type="text" placeholder="基础单位" class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部状态</option><option>同步成功</option><option>同步中</option><option>同步失败</option>
        </select>
      </div>
      <div class="mt-3 flex gap-2">
        <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">查询</button>
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">重置</button>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedProducts.length} 条记录 · 数据来源于外部商品中心，仅支持查询</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1400px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">SPU编码</th><th class="px-3 py-2">SKU编码</th><th class="px-3 py-2">商品 / 物料名称</th>
              <th class="px-3 py-2">产品类型</th><th class="px-3 py-2">物料分类</th><th class="px-3 py-2">基础单位</th>
              <th class="px-3 py-2">包装单位</th><th class="px-3 py-2">来源系统</th><th class="px-3 py-2">同步时间</th>
              <th class="px-3 py-2">状态</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsBasicProductCenter = {};</script>`
}
