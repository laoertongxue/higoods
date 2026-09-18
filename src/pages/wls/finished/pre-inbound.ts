// Auto-extracted from Higood-wms App.tsx line 35115-35334
// 预入库管理 / Pre-Inbound Management

import type { AppState } from '../../../state/store';
import type { PreInboundOrder } from '../../../data/wls/types';
import { preInboundSeed } from '../../../data/wls/seed/raw-seed';
import { materialCategoryLabelMap } from '../../../data/wls/shared/warehouse-config';

export function renderFinishedPreInbound(state: AppState): string {
  const preInboundOrders: PreInboundOrder[] = preInboundSeed;

  return `
    <section>
      <div class="mb-4">
        <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">成衣入库单列表</h2>
        <p class="mt-1 text-[13px] text-[var(--text-muted)]">用于查看入库前置单据，包含单号、商品、送货单位、货主与发货时间等信息。</p>
      </div>

      <div class="rounded-[12px] border border-[var(--border-default)] bg-white mb-3 p-3">
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <input
              id="pre-inbound-search"
              type="text"
              placeholder="搜索入库单号 / 关联单号（ASN） / 入库类型 / 跟踪单号 / SPU / SKU / 入库仓库 / 送货单位 / 货主 / 状态"
              class="h-9 w-[480px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 text-[13px]"
            />
            <div class="inline-flex items-center rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1">
              <button data-status="待收货" class="pre-inbound-status-btn rounded-[6px] px-3 py-1 text-[12px] transition bg-white font-medium text-[var(--primary)] shadow-[0_1px_2px_rgba(16,24,40,0.08)]">待收货</button>
              <button data-status="收货中" class="pre-inbound-status-btn rounded-[6px] px-3 py-1 text-[12px] transition bg-white font-medium text-[var(--primary)] shadow-[0_1px_2px_rgba(16,24,40,0.08)]">收货中</button>
              <button data-status="部分收货" class="pre-inbound-status-btn rounded-[6px] px-3 py-1 text-[12px] transition bg-white font-medium text-[var(--primary)] shadow-[0_1px_2px_rgba(16,24,40,0.08)]">部分收货</button>
              <button data-status="全部收货" class="pre-inbound-status-btn rounded-[6px] px-3 py-1 text-[12px] transition text-[var(--text-secondary)] hover:text-[var(--text-primary)]">全部收货</button>
            </div>
            <button id="pre-inbound-clear" class="h-9 rounded-[8px] border border-[var(--border-default)] bg-white px-3 text-[13px] text-[var(--text-secondary)]">清除</button>
          </div>
        </div>
      </div>

      <div class="rounded-[12px] border border-[var(--border-default)] bg-white">
        <div class="overflow-x-auto rounded-[10px] border border-[var(--border-default)]">
          <table class="w-full min-w-[1500px] text-[13px]">
            <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
              <tr>
                <th class="px-3 py-2 text-left font-medium">单号</th>
                <th class="px-3 py-2 text-left font-medium">商品SPU</th>
                <th class="px-3 py-2 text-left font-medium">商品SKU</th>
                <th class="px-3 py-2 text-left font-medium">送货数量</th>
                <th class="px-3 py-2 text-left font-medium">已收货数量</th>
                <th class="px-3 py-2 text-left font-medium">入库仓库</th>
                <th class="px-3 py-2 text-left font-medium">入库类型</th>
                <th class="px-3 py-2 text-left font-medium">送货单位</th>
                <th class="px-3 py-2 text-left font-medium">货主</th>
                <th class="px-3 py-2 text-left font-medium">操作人员</th>
                <th class="px-3 py-2 text-left font-medium">状态</th>
                <th class="px-3 py-2 text-left font-medium">时间</th>
                <th class="px-3 py-2 text-left font-medium sticky right-0 z-20 border-l border-[var(--border-default)] bg-[var(--bg-subtle)]">操作</th>
              </tr>
            </thead>
            <tbody>
              ${preInboundOrders.slice(0, 20).map((item) => {
                const spus = Array.from(new Set(item.productItems.map((p) => p.spu)));
                const statusClass = item.status === '全部收货' ? 'bg-[#F0FDF4] text-[#15803D]' :
                                   item.status === '收货中' ? 'bg-[#EEF4FF] text-[#175CD3]' :
                                   item.status === '部分收货' ? 'bg-[#FFF7ED] text-[#B54708]' :
                                   'bg-[#FEF3F2] text-[#B42318]';
                return `
                  <tr class="hover:bg-[var(--bg-hover)] border-b border-[var(--border-light)]">
                    <td class="px-3 py-2">
                      <div class="space-y-1">
                        <div>
                          <span class="text-[var(--text-muted)]">入库单号：</span>
                          <span class="text-[var(--text-primary)]">${item.inboundOrderNo}</span>
                        </div>
                        <div>
                          <span class="text-[var(--text-muted)]">关联单号（ASN）：</span>
                          <span class="text-[var(--text-primary)]">${item.relatedOrderNo}</span>
                        </div>
                        <div>
                          <span class="text-[var(--text-muted)]">跟踪单号：</span>
                          <span class="text-[var(--text-primary)]">${item.trackingNo}</span>
                        </div>
                      </div>
                    </td>
                    <td class="px-3 py-2">
                      <div class="space-y-1">
                        ${spus.map((spu) => {
                          const skuCount = item.productItems.filter((p) => p.spu === spu).length;
                          return `<div class="text-[var(--link)]">${spu}（${skuCount}个SKU）</div>`;
                        }).join('')}
                      </div>
                    </td>
                    <td class="px-3 py-2">
                      <div class="space-y-1">
                        ${item.productItems.slice(0, 3).map((p) => `<div>${p.sku}</div>`).join('')}
                        ${item.productItems.length > 3 ? `<div class="text-[var(--text-muted)]">+${item.productItems.length - 3} 更多</div>` : ''}
                      </div>
                    </td>
                    <td class="px-3 py-2">
                      <div class="space-y-1">
                        ${item.productItems.slice(0, 3).map((p) => {
                          const deliveryQty = p.deliveryQuantity || 0;
                          const packageQty = p.package_qty || 0;
                          const baseQty = p.base_qty || 0;
                          return `<div>${packageQty} ${p.package_unit || '包'} / ${baseQty} ${p.base_unit || '个'}</div>`;
                        }).join('')}
                      </div>
                    </td>
                    <td class="px-3 py-2">
                      <div class="space-y-1">
                        ${item.productItems.slice(0, 3).map((p) => {
                          const receivedPackage = p.received_package_qty || p.current_package_qty || 0;
                          const receivedBase = p.received_base_qty || p.current_base_qty || 0;
                          return `<div>${receivedPackage} ${p.package_unit || '包'} / ${receivedBase} ${p.base_unit || '个'}</div>`;
                        }).join('')}
                      </div>
                    </td>
                    <td class="px-3 py-2">${item.inboundWarehouse}</td>
                    <td class="px-3 py-2">${item.inboundType}</td>
                    <td class="px-3 py-2">${item.deliveryUnit}</td>
                    <td class="px-3 py-2">${item.ownerName}</td>
                    <td class="px-3 py-2">${item.operatorName || '-'}</td>
                    <td class="px-3 py-2">
                      <span class="inline-flex rounded-[999px] px-2 py-0.5 text-[12px] font-medium ${statusClass}">${item.status}</span>
                    </td>
                    <td class="px-3 py-2">
                      <div class="space-y-1">
                        <div>
                          <span class="text-[var(--text-muted)]">发货：</span>
                          <span class="text-[var(--text-primary)]">${item.shippingTime || '-'}</span>
                        </div>
                        <div>
                          <span class="text-[var(--text-muted)]">收货：</span>
                          <span class="text-[var(--text-primary)]">${item.receivedTime || '-'}</span>
                        </div>
                        <div>
                          <span class="text-[var(--text-muted)]">上架：</span>
                          <span class="text-[var(--text-primary)]">${item.putawayTime || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td class="px-3 py-2 sticky right-0 z-10 border-l border-[var(--border-default)] bg-white">
                      <button class="mr-2 h-7 rounded-[8px] border border-[var(--border-default)] bg-white px-3 text-[13px] text-[var(--text-secondary)]">查看详情</button>
                      <button class="h-7 rounded-[8px] bg-[#175CD3] px-3 text-[13px] font-medium text-white ${item.status === '全部收货' ? 'cursor-not-allowed opacity-50' : ''}" ${item.status === '全部收货' ? 'disabled' : ''}>开始收货</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between border-t border-[var(--border-default)] px-4 py-3">
          <div class="text-[13px] text-[var(--text-secondary)]">
            共 <span class="font-medium text-[var(--text-primary)]">${preInboundOrders.length}</span> 条记录
          </div>
          <div class="flex items-center gap-2">
            <button class="h-8 rounded-[8px] border border-[var(--border-default)] bg-white px-3 text-[13px] text-[var(--text-secondary)]">上一页</button>
            <div class="flex items-center gap-1">
              <button class="h-8 w-8 rounded-[8px] bg-[#175CD3] text-[13px] font-medium text-white">1</button>
              <button class="h-8 w-8 rounded-[8px] border border-[var(--border-default)] bg-white text-[13px] text-[var(--text-secondary)]">2</button>
              <button class="h-8 w-8 rounded-[8px] border border-[var(--border-default)] bg-white text-[13px] text-[var(--text-secondary)]">3</button>
            </div>
            <button class="h-8 rounded-[8px] border border-[var(--border-default)] bg-white px-3 text-[13px] text-[var(--text-secondary)]">下一页</button>
          </div>
        </div>
      </div>
    </section>

    <script>
      (function() {
        // Status filter buttons
        const statusBtns = document.querySelectorAll('.pre-inbound-status-btn');
        statusBtns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            const isActive = this.classList.contains('bg-white');
            if (isActive) {
              this.classList.remove('bg-white', 'font-medium', 'text-[var(--primary)]', 'shadow-[0_1px_2px_rgba(16,24,40,0.08)]');
              this.classList.add('text-[var(--text-secondary)]');
            } else {
              this.classList.add('bg-white', 'font-medium', 'text-[var(--primary)]', 'shadow-[0_1px_2px_rgba(16,24,40,0.08)]');
              this.classList.remove('text-[var(--text-secondary)]');
            }
          });
        });

        // Clear button
        const clearBtn = document.getElementById('pre-inbound-clear');
        if (clearBtn) {
          clearBtn.addEventListener('click', function() {
            const searchInput = document.getElementById('pre-inbound-search');
            if (searchInput) searchInput.value = '';
            statusBtns.forEach(function(btn, idx) {
              if (idx < 3) {
                btn.classList.add('bg-white', 'font-medium', 'text-[var(--primary)]', 'shadow-[0_1px_2px_rgba(16,24,40,0.08)]');
                btn.classList.remove('text-[var(--text-secondary)]');
              } else {
                btn.classList.remove('bg-white', 'font-medium', 'text-[var(--primary)]', 'shadow-[0_1px_2px_rgba(16,24,40,0.08)]');
                btn.classList.add('text-[var(--text-secondary)]');
              }
            });
          });
        }

        // Search input
        const searchInput = document.getElementById('pre-inbound-search');
        if (searchInput) {
          searchInput.addEventListener('input', function() {
            console.log('Search:', this.value);
          });
        }
      })();
    </script>
  `;
}
