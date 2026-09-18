// Auto-extracted from Higood-wms App.tsx line 36832-37050
// 成衣仓首页 / Dashboard

import type { AppState } from '../../../state/store';
import { warehouseSeed } from '../../../data/wls/seed/shared-seed';
import { isWarehouseInSystem } from '../../../data/wls/shared/warehouse-config';

export function renderFinishedDashboard(state: AppState): string {
  const activeWarehouseSystem = 'finished';
  const activeWarehouseSystemLabel = '成衣仓';
  const activeSystemWarehouses = warehouseSeed.filter((wh) => isWarehouseInSystem(wh.businessType || 'FINISHED', activeWarehouseSystem));
  const dashboardWarehouseCode = activeSystemWarehouses[0]?.code || '';
  const dashboardWarehouseName = activeSystemWarehouses[0]?.name || '中央总仓-成衣仓';
  const currentAccountName = '管理员';
  const dashboardDateLabel = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  // Mock metrics data
  const dashboardMetrics = [
    { key: 'inbound', title: '今日预入库', value: '24', hint: '待处理 8 单', target: 'preInbound' },
    { key: 'outbound', title: '今日预出库', value: '36', hint: '待拣货 12 单', target: 'preOutbound' },
    { key: 'putaway', title: '待上架', value: '15', hint: '紧急 3 单', target: 'putaway' },
    { key: 'picking', title: '拣货中', value: '42', hint: '超时 2 单', target: 'waveManage' },
    { key: 'stock', title: '库存总量', value: '128,456', hint: '件', target: 'stockRealtime' },
    { key: 'location', title: '库位使用率', value: '78%', hint: '剩余 231 个', target: 'stockLocation' },
    { key: 'transfer', title: '调拨在途', value: '18', hint: '单', target: 'stockTransfer' },
    { key: 'exception', title: '异常待处理', value: '5', hint: '条', target: 'dashboard' },
  ];

  // Mock progress groups
  const dashboardProgressGroups = [
    {
      key: 'inbound',
      title: '入库进度',
      items: [
        { label: '预入库收货', done: 16, total: 24 },
        { label: '上架完成', done: 12, total: 15 },
        { label: '质检通过', done: 20, total: 24 },
      ],
    },
    {
      key: 'outbound',
      title: '出库进度',
      items: [
        { label: '波次生成', done: 30, total: 36 },
        { label: '拣货完成', done: 24, total: 36 },
        { label: '复核出库', done: 18, total: 36 },
      ],
    },
    {
      key: 'collection',
      title: '集货进度',
      items: [
        { label: '集货中', done: 8, total: 12 },
        { label: '分拨完成', done: 6, total: 12 },
        { label: '装车待发', done: 4, total: 12 },
      ],
    },
  ];

  // Mock exception rows
  const dashboardExceptionRows = [
    { id: '1', type: '拣货超时', orderNo: 'CK20260918001', warehouse: '中央总仓-成衣仓', owner: '张三', time: '2026-09-18 10:30', status: '处理中', viewTarget: 'waveManage', processTarget: 'waveManage' },
    { id: '2', type: '库存差异', orderNo: 'YD20260918005', warehouse: '中央总仓-成衣仓', owner: '李四', time: '2026-09-18 11:15', status: '待处理', viewTarget: 'stockRealtime', processTarget: 'stockTransfer' },
    { id: '3', type: '质检异常', orderNo: 'TH20260918003', warehouse: '中央总仓-成衣仓', owner: '王五', time: '2026-09-18 13:20', status: '处理中', viewTarget: 'returnQuality', processTarget: 'returnQuality' },
  ];

  // Mock inventory summary
  const dashboardInventorySummary = [
    { key: 'total', label: '总库存', value: '128,456 件' },
    { key: 'available', label: '可用库存', value: '115,234 件' },
    { key: 'locked', label: '锁定库存', value: '8,522 件' },
    { key: 'defective', label: '瑕疵品', value: '4,700 件' },
  ];

  // Mock quick groups
  const dashboardQuickGroups = [
    {
      key: 'inbound',
      title: '入库管理',
      items: [
        { title: '预入库管理', target: 'preInbound' },
        { title: '入库单列表', target: 'putaway' },
        { title: '退货收货', target: 'returnOrders' },
      ],
    },
    {
      key: 'outbound',
      title: '出库管理',
      items: [
        { title: '预出库管理', target: 'preOutbound' },
        { title: '出库单列表', target: 'outboundOrders' },
        { title: '波次管理', target: 'waveManage' },
      ],
    },
    {
      key: 'collection',
      title: '集货管理',
      items: [
        { title: '集货订单', target: 'collectionOrders' },
        { title: '集货拣货', target: 'collectionPicking' },
        { title: '二次分拨', target: 'collectionSorting' },
      ],
    },
    {
      key: 'stock',
      title: '库存管理',
      items: [
        { title: '实时库存', target: 'stockRealtime' },
        { title: '库位库存', target: 'stockLocation' },
        { title: '库存流水', target: 'stockFlow' },
      ],
    },
    {
      key: 'basic',
      title: '基础数据',
      items: [
        { title: '仓库管理', target: 'warehouse' },
        { title: '商品中心', target: 'productCenter' },
        { title: '供应商管理', target: 'supplier' },
      ],
    },
  ];

  return `
    <section class="space-y-4">
      <div class="rounded-[12px] border border-[#D9E6FF] bg-[linear-gradient(135deg,#EEF4FF_0%,#F7FAFF_100%)] p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-[13px] text-[#175CD3]">HiGood · ${activeWarehouseSystemLabel}系统</div>
            <h2 class="mt-1 text-[24px] font-semibold text-[var(--text-primary)]">${dashboardWarehouseName}</h2>
            <p class="mt-1 text-[14px] text-[var(--text-secondary)]">欢迎回来，${currentAccountName}</p>
            <p class="mt-1 text-[13px] text-[var(--text-muted)]">今日：${dashboardDateLabel}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <select id="dashboard-warehouse-select" class="h-9 min-w-[220px] rounded-[8px] border border-[#B2CCFF] bg-white px-3 text-[13px]">
              ${activeSystemWarehouses.map((wh) => `<option value="${wh.code}" ${wh.code === dashboardWarehouseCode ? 'selected' : ''}>${wh.name}</option>`).join('')}
            </select>
            <button id="dashboard-switch-warehouse" class="h-9 rounded-[8px] border border-[#B2CCFF] bg-white px-3 text-[13px] font-medium text-[#175CD3]">切换仓库</button>
            <button id="dashboard-refresh" class="h-9 rounded-[8px] bg-[#175CD3] px-3 text-[13px] font-medium text-white">刷新数据</button>
            <button id="dashboard-empty-mode" class="h-9 rounded-[8px] border border-[var(--border-default)] bg-white px-3 text-[13px] text-[var(--text-secondary)]">空数据模式</button>
          </div>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        ${dashboardMetrics.map((metric) => `
          <button data-target="${metric.target}" class="dashboard-metric-btn rounded-[12px] border border-[var(--border-default)] bg-white p-3 text-left transition hover:border-[#B2CCFF] hover:shadow-[0_8px_18px_rgba(16,24,40,0.08)]">
            <div class="text-[12px] text-[var(--text-muted)]">${metric.title}</div>
            <div class="mt-2 text-[26px] font-semibold leading-none text-[var(--text-primary)]">${metric.value}</div>
            <div class="mt-2 text-[12px] text-[#175CD3]">${metric.hint}</div>
          </button>
        `).join('')}
      </div>

      <div class="grid gap-4 xl:grid-cols-3">
        ${dashboardProgressGroups.map((group) => `
          <div class="rounded-[12px] border border-[var(--border-default)] bg-white p-4">
            <h3 class="mb-3 text-[16px] font-semibold text-[var(--text-primary)]">${group.title}</h3>
            <div class="space-y-3">
              ${group.items.map((item) => {
                const percent = item.total > 0 ? Math.min(100, Math.round((item.done / item.total) * 100)) : 0;
                return `
                  <div>
                    <div class="mb-1 flex items-center justify-between text-[13px]">
                      <span class="text-[var(--text-secondary)]">${item.label}</span>
                      <span class="text-[var(--text-primary)]">${item.done}/${item.total}</span>
                    </div>
                    <div class="h-2 rounded-[999px] bg-[#EEF2F6]">
                      <div class="h-full rounded-[999px] bg-[#175CD3]" style="width: ${percent}%"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="rounded-[12px] border border-[var(--border-default)] bg-white p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-[16px] font-semibold text-[var(--text-primary)]">异常预警区</h3>
          <span class="rounded-[999px] bg-[#FEF3F2] px-2 py-1 text-[12px] font-medium text-[#B42318]">${dashboardExceptionRows.length} 条待关注</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[980px] text-[13px]">
            <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
              <tr>
                <th class="px-3 py-2 text-left font-medium">异常类型</th>
                <th class="px-3 py-2 text-left font-medium">单号</th>
                <th class="px-3 py-2 text-left font-medium">仓库</th>
                <th class="px-3 py-2 text-left font-medium">责任人</th>
                <th class="px-3 py-2 text-left font-medium">发生时间</th>
                <th class="px-3 py-2 text-left font-medium">状态</th>
                <th class="px-3 py-2 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${dashboardExceptionRows.map((row) => `
                <tr class="border-b border-[var(--border-light)] hover:bg-[var(--bg-hover)]">
                  <td class="px-3 py-2">${row.type}</td>
                  <td class="px-3 py-2 text-[var(--link)]">${row.orderNo}</td>
                  <td class="px-3 py-2">${row.warehouse}</td>
                  <td class="px-3 py-2">${row.owner}</td>
                  <td class="px-3 py-2">${row.time}</td>
                  <td class="px-3 py-2">
                    <span class="inline-flex rounded-[999px] px-2 py-0.5 text-[12px] ${row.status === '处理中' ? 'bg-[#EEF4FF] text-[#175CD3]' : 'bg-[#FEF3F2] text-[#B42318]'}">
                      ${row.status}
                    </span>
                  </td>
                  <td class="px-3 py-2">
                    <button data-target="${row.viewTarget}" class="dashboard-nav-btn mr-3 text-[var(--link)]">查看</button>
                    <button data-target="${row.processTarget}" class="dashboard-nav-btn text-[#175CD3]">处理</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-[12px] border border-[var(--border-default)] bg-white p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-[16px] font-semibold text-[var(--text-primary)]">库存概览区</h3>
          <div class="flex items-center gap-2 text-[12px]">
            <button data-target="stockRealtime" class="dashboard-nav-btn rounded-[8px] border border-[var(--border-default)] px-2 py-1 text-[var(--link)]">即时库存查询</button>
            <button data-target="stockLocation" class="dashboard-nav-btn rounded-[8px] border border-[var(--border-default)] px-2 py-1 text-[var(--link)]">库位库存查询</button>
            <button data-target="stockFlow" class="dashboard-nav-btn rounded-[8px] border border-[var(--border-default)] px-2 py-1 text-[var(--link)]">库存流水查询</button>
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          ${dashboardInventorySummary.map((item) => `
            <div class="rounded-[10px] border border-[var(--border-light)] bg-[var(--bg-subtle)] px-3 py-2.5">
              <div class="text-[12px] text-[var(--text-muted)]">${item.label}</div>
              <div class="mt-1 text-[20px] font-semibold text-[var(--text-primary)]">${item.value}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="rounded-[12px] border border-[var(--border-default)] bg-white p-4">
        <h3 class="mb-3 text-[16px] font-semibold text-[var(--text-primary)]">快捷入口区</h3>
        <div class="grid gap-3 xl:grid-cols-5">
          ${dashboardQuickGroups.map((group) => `
            <div class="rounded-[10px] border border-[var(--border-light)] bg-[var(--bg-subtle)] p-3">
              <div class="mb-2 text-[14px] font-semibold text-[var(--text-primary)]">${group.title}</div>
              <div class="space-y-1.5">
                ${group.items.map((item) => `
                  <button data-target="${item.target}" class="dashboard-nav-btn flex w-full items-center justify-between rounded-[8px] bg-white px-2.5 py-2 text-left text-[12px] text-[var(--text-secondary)] hover:text-[var(--link)]">
                    <span>${item.title}</span>
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <script>
      (function() {
        // Metric buttons
        document.querySelectorAll('.dashboard-metric-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            if (target && window.navigateToMenu) window.navigateToMenu(target);
          });
        });

        // Navigation buttons
        document.querySelectorAll('.dashboard-nav-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            if (target && window.navigateToMenu) window.navigateToMenu(target);
          });
        });

        // Warehouse selector
        const warehouseSelect = document.getElementById('dashboard-warehouse-select');
        if (warehouseSelect) {
          warehouseSelect.addEventListener('change', function() {
            console.log('Warehouse changed:', this.value);
          });
        }

        // Action buttons
        const switchBtn = document.getElementById('dashboard-switch-warehouse');
        if (switchBtn) {
          switchBtn.addEventListener('click', function() {
            const select = document.getElementById('dashboard-warehouse-select');
            if (select && select.options.length > 1) {
              const currentIndex = select.selectedIndex;
              const nextIndex = (currentIndex + 1) % select.options.length;
              select.selectedIndex = nextIndex;
              select.dispatchEvent(new Event('change'));
            }
          });
        }

        const refreshBtn = document.getElementById('dashboard-refresh');
        if (refreshBtn) {
          refreshBtn.addEventListener('click', function() {
            console.log('Refresh data');
            window.location.reload();
          });
        }

        const emptyModeBtn = document.getElementById('dashboard-empty-mode');
        if (emptyModeBtn) {
          emptyModeBtn.addEventListener('click', function() {
            console.log('Toggle empty mode');
          });
        }
      })();
    </script>
  `;
}
