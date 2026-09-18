// Auto-extracted from Higood-wms App.tsx line 32775-33053
// 即时库存查询 — supports finished / raw / transit variants

import type { AppState } from '../../../state/store';
import { stockRealtimeSeed } from '../../../data/wls/seed/stock-seed';
import { materialCategoryLabelMap } from '../../../data/wls/shared/warehouse-config';
import type { StockRealtimeItem, MaterialInventorySummary, MaterialCategory } from '../../../data/wls/types';

type Variant = 'finished' | 'raw' | 'transit';

const PAGE_SIZE = 20;

function formatDualQty(pkgQty: number, pkgUnit: string, baseQty: number, baseUnit: string): string {
  return `${pkgQty} ${pkgUnit} / ${baseQty} ${baseUnit}`;
}

const RAW_MATERIAL_INVENTORY: MaterialInventorySummary[] = (() => {
  const categories: MaterialCategory[] = ['FABRIC', 'ACCESSORY', 'YARN', 'CONSUMABLE', 'PACKAGING'];
  const warehouses = ['中央总仓-面料仓', '中央总仓-辅料仓', '中央总仓-纱线仓', '中央总仓-耗材仓', '中央总仓-包材仓'];
  const items: MaterialInventorySummary[] = [];
  const sampleData = [
    { cat: 'FABRIC' as MaterialCategory, name: '全棉平纹布 32S', spu: 'SPU-MF-10001', sku: 'SKU-MF-10001', wh: '中央总仓-面料仓', pkgU: '卷', baseU: '米', pkg: 120, base: 9600, availPkg: 98, availBase: 7840, reqPkg: 12, reqBase: 960, pendPkg: 10, pendBase: 800 },
    { cat: 'FABRIC' as MaterialCategory, name: '涤纶针织面料 40D', spu: 'SPU-MF-10002', sku: 'SKU-MF-10002', wh: '中央总仓-面料仓', pkgU: '卷', baseU: '米', pkg: 85, base: 6800, availPkg: 70, availBase: 5600, reqPkg: 8, reqBase: 640, pendPkg: 7, pendBase: 560 },
    { cat: 'FABRIC' as MaterialCategory, name: '氨纶弹力布 20D', spu: 'SPU-MF-10003', sku: 'SKU-MF-10003', wh: '中央总仓-面料仓', pkgU: '卷', baseU: '米', pkg: 3, base: 240, availPkg: 0, availBase: 0, reqPkg: 3, reqBase: 240, pendPkg: 0, pendBase: 0 },
    { cat: 'ACCESSORY' as MaterialCategory, name: '树脂纽扣 11.5mm 白色', spu: 'SPU-MA-20001', sku: 'SKU-MA-20001', wh: '中央总仓-辅料仓', pkgU: '包', baseU: '颗', pkg: 200, base: 40000, availPkg: 180, availBase: 36000, reqPkg: 15, reqBase: 3000, pendPkg: 5, pendBase: 1000 },
    { cat: 'ACCESSORY' as MaterialCategory, name: '金属拉链 5# 黑色 60cm', spu: 'SPU-MA-20002', sku: 'SKU-MA-20002', wh: '中央总仓-辅料仓', pkgU: '包', baseU: '颗', pkg: 150, base: 30000, availPkg: 120, availBase: 24000, reqPkg: 20, reqBase: 4000, pendPkg: 10, pendBase: 2000 },
    { cat: 'YARN' as MaterialCategory, name: '缝纫线 40S/2 本白', spu: 'SPU-MY-30001', sku: 'SKU-MY-30001', wh: '中央总仓-纱线仓', pkgU: '包', baseU: 'kg', pkg: 96, base: 2400, availPkg: 80, availBase: 2000, reqPkg: 6, reqBase: 150, pendPkg: 10, pendBase: 250 },
    { cat: 'YARN' as MaterialCategory, name: '绣花线 120D 藏青', spu: 'SPU-MY-30002', sku: 'SKU-MY-30002', wh: '中央总仓-纱线仓', pkgU: '包', baseU: 'kg', pkg: 6, base: 150, availPkg: 4, availBase: 100, reqPkg: 2, reqBase: 50, pendPkg: 0, pendBase: 0 },
    { cat: 'CONSUMABLE' as MaterialCategory, name: '工业缝纫针 DB×1 14#', spu: 'SPU-MC-40001', sku: 'SKU-MC-40001', wh: '中央总仓-耗材仓', pkgU: '包', baseU: '个', pkg: 50, base: 3000, availPkg: 45, availBase: 2700, reqPkg: 3, reqBase: 180, pendPkg: 2, pendBase: 120 },
    { cat: 'PACKAGING' as MaterialCategory, name: 'OPP透明包装袋 30×40cm', spu: 'SPU-MP-50001', sku: 'SKU-MP-50001', wh: '中央总仓-包材仓', pkgU: '箱', baseU: '个', pkg: 80, base: 9600, availPkg: 72, availBase: 8640, reqPkg: 5, reqBase: 600, pendPkg: 3, pendBase: 360 },
    { cat: 'PACKAGING' as MaterialCategory, name: '瓦楞纸箱 5层 60×40×30cm', spu: 'SPU-MP-50002', sku: 'SKU-MP-50002', wh: '中央总仓-包材仓', pkgU: '箱', baseU: '个', pkg: 45, base: 5400, availPkg: 38, availBase: 4560, reqPkg: 4, reqBase: 480, pendPkg: 3, pendBase: 360 },
    { cat: 'FABRIC' as MaterialCategory, name: '亚麻棉混纺 20×16', spu: 'SPU-MF-10004', sku: 'SKU-MF-10004', wh: '中央总仓-面料仓', pkgU: '卷', baseU: '米', pkg: 0, base: 0, availPkg: 0, availBase: 0, reqPkg: 0, reqBase: 0, pendPkg: 0, pendBase: 0 },
    { cat: 'ACCESSORY' as MaterialCategory, name: '热转印标码 S码', spu: 'SPU-MA-20003', sku: 'SKU-MA-20003', wh: '中央总仓-辅料仓', pkgU: '包', baseU: '颗', pkg: 300, base: 60000, availPkg: 280, availBase: 56000, reqPkg: 10, reqBase: 2000, pendPkg: 10, pendBase: 2000 },
  ];
  for (const d of sampleData) {
    items.push({
      id: `MI-${d.sku}`,
      material_category: d.cat,
      material_name: d.name,
      spu_code: d.spu,
      sku_code: d.sku,
      warehouse_name: d.wh,
      area_name: 'A区',
      location_code: `A-01-${String(items.length + 1).padStart(2, '0')}`,
      package_qty: d.pkg,
      package_unit: d.pkgU,
      base_qty: d.base,
      base_unit: d.baseU,
      available_package_qty: d.availPkg,
      available_base_qty: d.availBase,
      requisition_occupied_package_qty: d.reqPkg,
      requisition_occupied_base_qty: d.reqBase,
      pending_putaway_package_qty: d.pendPkg,
      pending_putaway_base_qty: d.pendBase,
      package_unit_count: d.pkg,
      supplier_name: '默认供应商',
      batch_no: `B2026${String(items.length + 1).padStart(4, '0')}`,
      stock_status: d.pkg > 0 ? '正常' : '待上架',
    });
  }
  return items;
})();

function renderFinishedColumns(variant: Variant): string {
  const columns: Array<{ label: string; tip: string }> = [
    { label: '商品图片', tip: '商品主图，用于快速识别商品。' },
    { label: '商品名称', tip: '商品在系统中的标准名称。' },
    { label: '商品SPU', tip: '商品SPU（款级编码），用于标识商品款。' },
    { label: '商品SKU', tip: '商品SKU（规格编码），用于标识具体规格。' },
  ];
  if (variant === 'transit') {
    columns.push({ label: '单位', tip: '按SKU主数据展示单位。' });
  }
  columns.push(
    { label: '仓库名称', tip: '当前库存所属仓库。' },
    { label: '总库存', tip: '总库存 = 现货库存 + 在途库存（不含瑕疵品库存、破损库存）。' },
    { label: '现货库存', tip: '仓库内库存。' },
    { label: '在途库存', tip: '已发运但未正式入库的库存数量。' },
    { label: '退货待检库存', tip: '按需质检数统计的退货待检库存。' },
    { label: '瑕疵品库存', tip: '质检结果为瑕疵且完成上架的库存数量。' },
    { label: '破损库存', tip: '质检结果为报废的库存数量。' },
    { label: '预售订单占用库存', tip: '出库类型为预售出库的订单占用库存。' },
    { label: '现货订单占用库存', tip: '除预售出库外，其他出库类型的订单占用库存。' },
    { label: '可售库存', tip: '可售库存 = 现货库存 - 预售订单占用库存 - 现货订单占用库存。' },
  );
  return columns
    .map(
      (col) => `<th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium text-[var(--text-secondary)]">
      <span class="inline-flex items-center gap-1">
        <span>${col.label}</span>
        <button type="button"
          class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-default)] bg-white text-[10px] leading-none text-[var(--text-muted)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
          aria-label="${col.label} 字段说明：${col.tip}"
          data-tip="${col.tip}"
          onclick="window.__wlsStockRealtime?.showTip(event, this)"
          onmouseenter="window.__wlsStockRealtime?.showTip(event, this)"
          onmouseleave="window.__wlsStockRealtime?.hideTip()"
          onfocus="window.__wlsStockRealtime?.showTip(event, this)"
          onblur="window.__wlsStockRealtime?.hideTip()">?</button>
      </span>
    </th>`,
    )
    .join('');
}

function renderRawHeader(): string {
  const heads = ['物料分类', '物料名称', '物料 SPU', '物料 SKU', '仓库', '总库存', '现货库存', '在途库存', '领料单占用库存', '可用库存', '待上架库存'];
  return heads
    .map((h) => `<th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium text-[var(--text-secondary)]">${h}</th>`)
    .join('');
}

function categoryBadgeClass(cat: MaterialCategory): string {
  switch (cat) {
    case 'FABRIC': return 'bg-[#DBEAFE] text-[#1D4ED8]';
    case 'ACCESSORY': return 'bg-[#DCFCE7] text-[#166534]';
    case 'CONSUMABLE': return 'bg-[#FFEDD5] text-[#C2410C]';
    case 'PACKAGING': return 'bg-[#F3E8FF] text-[#7E22CE]';
    default: return 'bg-[#CFFAFE] text-[#0E7490]';
  }
}

function renderFinishedRows(items: StockRealtimeItem[], variant: Variant): string {
  return items
    .map((item) => {
      const totalStock = item.spotStock + item.transitStock;
      const availableStock = item.spotStock <= 0 ? 0 : Math.max(0, item.spotStock - item.preSaleOrderOccupiedQuantity - item.spotOrderOccupiedQuantity);
      const unitCol = variant === 'transit' ? `<td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.unit || '-'}</td>` : '';
      return `<tr class="hover:bg-[var(--bg-hover)]">
        <td class="min-w-[10rem] border-b border-[var(--border-subtle)] px-3 py-2">
          <img src="${item.image}" alt="${item.productName}" class="h-12 w-12 rounded-[7px] border border-[var(--border-default)] object-cover" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22><rect width=%2248%22 height=%2248%22 fill=%22%23f1f5f9%22/><text x=%2224%22 y=%2228%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-size=%2210%22>图片</text></svg>'"/>
        </td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.productName}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] text-[var(--link)]">${item.spu}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.sku}</td>
        ${unitCol}
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.warehouseName}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] font-medium text-[var(--text-primary)]">${totalStock}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.spotStock}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.transitStock}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] font-semibold text-[#B54708]">${item.pendingReturnQualityQuantity}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] font-semibold text-[#C4320A]">${item.defectiveStock}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] font-semibold text-[#B42318]">${item.damagedStock}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] font-semibold text-[#B42318]">${item.preSaleOrderOccupiedQuantity}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] font-semibold text-[#B42318]">${item.spotOrderOccupiedQuantity}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] font-semibold text-[#067647]">${availableStock}</td>
      </tr>`;
    })
    .join('');
}

function renderRawRows(items: MaterialInventorySummary[]): string {
  return items
    .map(
      (item) => `<tr class="hover:bg-[var(--bg-hover)]">
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">
          <span class="inline-flex rounded-full px-2 py-[2px] text-[11px] ${categoryBadgeClass(item.material_category)}">${materialCategoryLabelMap[item.material_category]}</span>
        </td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.material_name}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] text-[var(--link)]">${item.spu_code}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.sku_code}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${item.warehouse_name}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${formatDualQty(item.package_qty, item.package_unit, item.base_qty, item.base_unit)}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${formatDualQty(Math.max(0, item.package_qty - item.pending_putaway_package_qty), item.package_unit, Math.max(0, item.base_qty - item.pending_putaway_base_qty), item.base_unit)}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px]">${formatDualQty(item.pending_putaway_package_qty, item.package_unit, item.pending_putaway_base_qty, item.base_unit)}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] text-[#B42318]">${item.requisition_occupied_base_qty > 0 ? formatDualQty(item.requisition_occupied_package_qty, item.package_unit, item.requisition_occupied_base_qty, item.base_unit) : '0'}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] font-semibold text-[#067647]">${formatDualQty(item.available_package_qty, item.package_unit, item.available_base_qty, item.base_unit)}</td>
        <td class="border-b border-[var(--border-subtle)] px-3 py-2 text-[13px] text-[#B54708]">${formatDualQty(item.pending_putaway_package_qty, item.package_unit, item.pending_putaway_base_qty, item.base_unit)}</td>
      </tr>`,
    )
    .join('');
}

function renderPagination(total: number, page: number, totalPages: number): string {
  if (totalPages <= 1) return '';
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  return `<div class="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] px-1 pt-3">
    <span class="text-[12px] text-[var(--text-muted)]">共 ${total} 条记录，第 ${page}/${totalPages} 页</span>
    <div class="flex items-center gap-1">
      <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40" ${page <= 1 ? 'disabled' : ''} onclick="window.__wlsStockRealtime?.goPage(${page - 1})">上一页</button>
      ${pages.map((p) => `<button type="button" class="rounded-[6px] border px-2 py-1 text-[12px] transition ${p === page ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]'}" onclick="window.__wlsStockRealtime?.goPage(${p})">${p}</button>`).join('')}
      <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40" ${page >= totalPages ? 'disabled' : ''} onclick="window.__wlsStockRealtime?.goPage(${page + 1})">下一页</button>
    </div>
  </div>`;
}

export function renderStockRealtime(state: AppState, variant: Variant = 'finished'): string {
  const isRaw = variant === 'raw';
  const isTransit = variant === 'transit';
  const title = isRaw ? '即时库存查询' : '即时库存查询';
  const subtitle = isRaw ? '用于查询原料仓库当前SKU库存数量。' : '用于查看当前各库位库存实时分布。';
  const searchPlaceholder = isRaw ? '搜索物料名称 / SPU / SKU / 库位' : '搜索商品名称 / SPU / SKU / 仓库名称';
  const tableMinWidth = isRaw ? '1720px' : '2140px';

  const allFinishedItems = stockRealtimeSeed.filter((item) => {
    if (variant === 'raw') return false;
    if (variant === 'transit') return item.warehouse_type === 'TRANSIT';
    return item.warehouse_type !== 'TRANSIT' && item.warehouse_type !== 'FABRIC' && item.warehouse_type !== 'ACCESSORY' && item.warehouse_type !== 'YARN' && item.warehouse_type !== 'CONSUMABLE' && item.warehouse_type !== 'PACKAGING';
  });

  const rawItems = isRaw ? RAW_MATERIAL_INVENTORY : [];
  const finishedItems = isRaw ? [] : allFinishedItems;
  const totalItems = isRaw ? rawItems.length : finishedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageItems = isRaw ? rawItems.slice(0, PAGE_SIZE) : finishedItems.slice(0, PAGE_SIZE);

  const rawWarehouseOptions = [...new Set(RAW_MATERIAL_INVENTORY.map((i) => i.warehouse_name))];
  const rawPackageUnitOptions = [...new Set(RAW_MATERIAL_INVENTORY.map((i) => i.package_unit))];

  return `<section>
    <div class="mb-4">
      <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">${title}</h2>
      <p class="mt-1 text-[13px] text-[var(--text-muted)]">${subtitle}</p>
    </div>

    <div class="mb-3 rounded-[12px] border border-[var(--border-default)] bg-white p-3">
      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <input id="wls-stock-rt-search" value="" placeholder="${searchPlaceholder}" class="w-[360px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
          ${isRaw ? `<select id="wls-stock-rt-cat" class="w-[150px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20">
            <option value="全部">物料分类：全部</option>
            <option value="FABRIC">物料分类：面料</option>
            <option value="ACCESSORY">物料分类：辅料</option>
            <option value="CONSUMABLE">物料分类：耗材</option>
            <option value="PACKAGING">物料分类：包材</option>
            <option value="YARN">物料分类：纱线</option>
          </select>
          <select id="wls-stock-rt-wh" class="w-[150px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20">
            <option value="全部">仓库：全部</option>
            ${rawWarehouseOptions.map((w) => `<option value="${w}">仓库：${w}</option>`).join('')}
          </select>
          <select id="wls-stock-rt-pkg" class="w-[150px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20">
            <option value="全部">包装单位：全部</option>
            ${rawPackageUnitOptions.map((u) => `<option value="${u}">包装单位：${u}</option>`).join('')}
          </select>` : ''}
          <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" onclick="window.__wlsStockRealtime?.clear()">清除</button>
        </div>
      </div>
    </div>

    <div class="rounded-[12px] border border-[var(--border-default)] bg-white">
      <div class="overflow-x-auto rounded-[10px] border border-[var(--border-default)]">
        <table class="w-full text-[13px]" style="min-width:${tableMinWidth}">
          <thead>${isRaw ? `<tr>${renderRawHeader()}</tr>` : `<tr>${renderFinishedColumns(variant)}</tr>`}</thead>
          <tbody>${isRaw ? renderRawRows(pageItems as MaterialInventorySummary[]) : renderFinishedRows(pageItems as StockRealtimeItem[], variant)}</tbody>
        </table>
      </div>
      ${renderPagination(totalItems, 1, totalPages)}
    </div>

    <div id="wls-stock-rt-tooltip" class="pointer-events-none fixed z-[9999] hidden w-max max-w-[280px] whitespace-normal rounded-[12px] border border-[var(--border-default)] bg-white px-3 py-2 text-left text-[12px] font-normal leading-[1.4] text-[var(--text-primary)] shadow-[0_12px_32px_rgba(16,24,40,0.16)]" style="transform:translate(-50%,-100%)">
      <span id="wls-stock-rt-tooltip-text"></span>
      <span class="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[var(--border-default)] bg-white"></span>
    </div>

    <script>
    (function() {
      var variant = ${JSON.stringify(variant)};
      var allFinished = ${JSON.stringify(finishedItems.map((i) => ({ ...i, image: i.image || '' })))};
      var allRaw = ${JSON.stringify(rawItems)};
      var pageSize = ${PAGE_SIZE};
      var currentPage = 1;
      var keyword = '';
      var catFilter = '全部';
      var whFilter = '全部';
      var pkgFilter = '全部';

      function getFiltered() {
        var items = variant === 'raw' ? allRaw : allFinished;
        if (!keyword && catFilter === '全部' && whFilter === '全部' && pkgFilter === '全部') return items;
        return items.filter(function(item) {
          if (variant === 'raw') {
            if (catFilter !== '全部' && item.material_category !== catFilter) return false;
            if (whFilter !== '全部' && item.warehouse_name !== whFilter) return false;
            if (pkgFilter !== '全部' && item.package_unit !== pkgFilter) return false;
            if (keyword) {
              var kw = keyword.toLowerCase();
              return (item.material_name || '').toLowerCase().includes(kw) || (item.spu_code || '').toLowerCase().includes(kw) || (item.sku_code || '').toLowerCase().includes(kw) || (item.warehouse_name || '').toLowerCase().includes(kw);
            }
            return true;
          } else {
            if (keyword) {
              var kw = keyword.toLowerCase();
              return (item.productName || '').toLowerCase().includes(kw) || (item.spu || '').toLowerCase().includes(kw) || (item.sku || '').toLowerCase().includes(kw) || (item.warehouseName || '').toLowerCase().includes(kw);
            }
            return true;
          }
        });
      }

      function render() {
        var filtered = getFiltered();
        var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;
        var start = (currentPage - 1) * pageSize;
        var pageItems = filtered.slice(start, start + pageSize);
        var tbody = document.querySelector('#wls-stock-rt-table-body');
        if (!tbody) return;
        /* Re-render is handled by full page re-render via navigation; for prototype we update inline */
      }

      window.__wlsStockRealtime = {
        showTip: function(event, el) {
          var tip = el.getAttribute('data-tip');
          if (!tip) return;
          var rect = el.getBoundingClientRect();
          var tooltip = document.getElementById('wls-stock-rt-tooltip');
          var text = document.getElementById('wls-stock-rt-tooltip-text');
          if (!tooltip || !text) return;
          text.textContent = tip;
          tooltip.style.left = (rect.left + rect.width / 2) + 'px';
          tooltip.style.top = rect.top + 'px';
          tooltip.classList.remove('hidden');
        },
        hideTip: function() {
          var tooltip = document.getElementById('wls-stock-rt-tooltip');
          if (tooltip) tooltip.classList.add('hidden');
        },
        goPage: function(page) {
          currentPage = page;
          render();
        },
        clear: function() {
          var search = document.getElementById('wls-stock-rt-search');
          if (search) search.value = '';
          keyword = '';
          if (variant === 'raw') {
            var cat = document.getElementById('wls-stock-rt-cat');
            var wh = document.getElementById('wls-stock-rt-wh');
            var pkg = document.getElementById('wls-stock-rt-pkg');
            if (cat) cat.value = '全部';
            if (wh) wh.value = '全部';
            if (pkg) pkg.value = '全部';
            catFilter = '全部';
            whFilter = '全部';
            pkgFilter = '全部';
          }
          currentPage = 1;
          render();
        }
      };

      var searchInput = document.getElementById('wls-stock-rt-search');
      if (searchInput) {
        searchInput.addEventListener('input', function(e) {
          keyword = e.target.value;
          currentPage = 1;
          render();
        });
      }
      if (variant === 'raw') {
        var catSel = document.getElementById('wls-stock-rt-cat');
        var whSel = document.getElementById('wls-stock-rt-wh');
        var pkgSel = document.getElementById('wls-stock-rt-pkg');
        if (catSel) catSel.addEventListener('change', function(e) { catFilter = e.target.value; currentPage = 1; render(); });
        if (whSel) whSel.addEventListener('change', function(e) { whFilter = e.target.value; currentPage = 1; render(); });
        if (pkgSel) pkgSel.addEventListener('change', function(e) { pkgFilter = e.target.value; currentPage = 1; render(); });
      }
    })();
    </script>
  </section>`;
}

export function renderFinishedStockRealtime(state: AppState): string {
  return renderStockRealtime(state, 'finished');
}

export function renderRawStockRealtime(state: AppState): string {
  return renderStockRealtime(state, 'raw');
}

export function renderTransitStockRealtime(state: AppState): string {
  return renderStockRealtime(state, 'transit');
}
