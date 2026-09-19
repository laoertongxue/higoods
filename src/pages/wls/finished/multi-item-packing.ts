import type { AppState } from '../../../state/store';

import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderSimpleConfirmDialog } from '../../../components/ui/dialog.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'

const EVENT_PREFIX = 'wls-multi-item-packing'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

const state: { basketCode: string; started: boolean; released: boolean } = {
  basketCode: 'BS-0012',
  started: false,
  released: false,
}

type PackingProduct = {
  id: string;
  spu: string;
  sku: string;
  materialName: string;
  allocatedLocation: string;
  outboundQuantity: number;
  pickedQuantity: number;
  reviewedQuantity: number;
};

type PackingOrder = {
  outboundOrderNo: string;
  relatedOrderNo: string;
  receivingUnit: string;
  trackingNo: string;
  outboundQuantity: number;
  productItems: PackingProduct[];
};

const MOCK_PACKING_ORDER: PackingOrder = {
  outboundOrderNo: 'CK2026900012',
  relatedOrderNo: 'SO2026700012',
  receivingUnit: '广州总店',
  trackingNo: 'SF1000012345',
  outboundQuantity: 7,
  productItems: [
    { id: 'PP-001', spu: 'SPU-GC-10001', sku: 'SKU-GC-20001', materialName: '黑色连衣裙 M', allocatedLocation: 'A01-01', outboundQuantity: 2, pickedQuantity: 2, reviewedQuantity: 2 },
    { id: 'PP-002', spu: 'SPU-GC-10001', sku: 'SKU-GC-20002', materialName: '黑色连衣裙 L', allocatedLocation: 'A01-02', outboundQuantity: 1, pickedQuantity: 1, reviewedQuantity: 1 },
    { id: 'PP-003', spu: 'SPU-GC-10003', sku: 'SKU-GC-20005', materialName: '白色短袖 M', allocatedLocation: 'A02-03', outboundQuantity: 2, pickedQuantity: 2, reviewedQuantity: 1 },
    { id: 'PP-004', spu: 'SPU-GC-10005', sku: 'SKU-GC-20009', materialName: '灰色百褶裙 M', allocatedLocation: 'B01-02', outboundQuantity: 1, pickedQuantity: 1, reviewedQuantity: 0 },
    { id: 'PP-005', spu: 'SPU-GC-10007', sku: 'SKU-GC-20013', materialName: '卡其夹克 S', allocatedLocation: 'C01-01', outboundQuantity: 1, pickedQuantity: 1, reviewedQuantity: 1 },
  ],
};

const MOCK_BASKET = {
  basket_code: 'BS-0012',
  current_wave_no: 'JH-WAVE-20260829-003',
  binding_status: '已绑定订单',
};

function renderPackingWorkspace(): string {
  const basket = MOCK_BASKET;
  const order = MOCK_PACKING_ORDER;

  return `<section>
    <div class="mb-4">
      <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">多件打包</h2>
      <p class="mt-1 text-[13px] text-[var(--text-muted)]">打包台扫描拣货篮二维码，按篮子复核一单多件商品并确认出库。</p>
    </div>

    <div class="mb-3 rounded-[12px] border border-[var(--border-default)] bg-white p-3">
      <div class="flex flex-wrap items-center gap-2">
        <input value="${escapeHtml(state.basketCode)}" placeholder="扫描/输入拣货篮二维码" data-${EVENT_PREFIX}-field="basket" data-scan-enter="true" data-skip-page-rerender="true" class="w-[320px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
        <button type="button" class="rounded-[8px] bg-[var(--primary)] px-3 py-[7px] text-[13px] font-medium text-white transition hover:opacity-90" data-${EVENT_PREFIX}-action="start-packing">${state.started ? '重新读取篮子' : '开始打包'}</button>
        <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" data-${EVENT_PREFIX}-action="back-to-basket">返回拣货篮管理</button>
      </div>
    </div>

    <div class="space-y-3">
      <div class="rounded-[12px] border border-[var(--border-default)] bg-white p-3 text-[13px] text-[var(--text-secondary)]">
        <div class="grid gap-2 md:grid-cols-4">
          <div>拣货篮：<span class="font-medium text-[var(--text-primary)]">${basket.basket_code}</span></div>
          <div>波次号：<span class="font-medium text-[var(--text-primary)]">${basket.current_wave_no}</span></div>
          <div>出库单号：<span class="font-medium text-[var(--text-primary)]">${order.outboundOrderNo}</span></div>
          <div>绑定状态：<span class="font-medium text-[var(--text-primary)]">${basket.binding_status}</span></div>
          <div>关联单号：<span class="font-medium text-[var(--text-primary)]">${order.relatedOrderNo}</span></div>
          <div>收货单位：<span class="font-medium text-[var(--text-primary)]">${order.receivingUnit}</span></div>
          <div>跟踪单号：<span class="font-medium text-[var(--text-primary)]">${order.trackingNo}</span></div>
          <div>商品件数：<span class="font-medium text-[var(--text-primary)]">${order.outboundQuantity}</span></div>
        </div>
      </div>

      <div class="rounded-[12px] border border-[var(--border-default)] bg-white">
        <div class="overflow-x-auto rounded-[10px] border border-[var(--border-default)]">
          <table class="w-full min-w-[900px] text-[13px]">
            <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
              <tr>
                <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">SPU</th>
                <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">SKU</th>
                <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">商品名称</th>
                <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">库位</th>
                <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">应打包</th>
                <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">已拣货</th>
                <th class="whitespace-nowrap border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-[12px] font-medium">已复核</th>
              </tr>
            </thead>
            <tbody>
              ${order.productItems.map((product) => `<tr class="hover:bg-[var(--bg-hover)]">
                <td class="border-b border-[var(--border-subtle)] px-3 py-2">${product.spu}</td>
                <td class="border-b border-[var(--border-subtle)] px-3 py-2">${product.sku}</td>
                <td class="border-b border-[var(--border-subtle)] px-3 py-2">${product.materialName}</td>
                <td class="border-b border-[var(--border-subtle)] px-3 py-2">${product.allocatedLocation}</td>
                <td class="border-b border-[var(--border-subtle)] px-3 py-2">${product.outboundQuantity}</td>
                <td class="border-b border-[var(--border-subtle)] px-3 py-2">${product.pickedQuantity}</td>
                <td class="border-b border-[var(--border-subtle)] px-3 py-2">${product.reviewedQuantity}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="mt-3 flex flex-wrap justify-end gap-2 px-3 pb-3">
          <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" data-${EVENT_PREFIX}-action="print-waybill">打印面单</button>
          <button type="button" class="rounded-[8px] bg-[var(--primary)] px-3 py-[7px] text-[13px] font-medium text-white transition hover:opacity-90" data-${EVENT_PREFIX}-action="confirm-outbound" ${state.released ? 'disabled' : ''}>${state.released ? '已出库并释放篮子' : '确认出库并释放篮子'}</button>
        </div>
      </div>
    </div>
  ${state.released || !state.started ? '' : renderSimpleConfirmDialog({
      prefix: EVENT_PREFIX,
      closeAction: 'cancel-outbound',
      confirmAction: 'confirm-outbound-run',
      title: '确认出库并释放拣货篮',
      description: `确认拣货篮 ${state.basketCode} 的 ${MOCK_PACKING_ORDER.outboundQuantity} 件商品已全部复核？出库后篮子释放给下一个波次，本单不可撤销。`,
      confirmLabel: '确认出库',
    })}</section>`;
}

function packingRoot(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshPacking(): void {
  const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!host) return
  host.innerHTML = renderPackingWorkspace()
  hydrateIcons(host)
}

function readBasketCode(): string {
  const input = packingRoot()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="basket"]`)
  return input ? input.value.trim() : state.basketCode.trim()
}

function startPacking(): void {
  const code = readBasketCode()
  if (!code) {
    showListFeedback('请先扫描或输入拣货篮二维码', 'warning')
    return
  }
  state.basketCode = code
  state.started = true
  showListFeedback(`拣货篮 ${code} 已绑定出库单 ${MOCK_PACKING_ORDER.outboundOrderNo}，共 ${MOCK_PACKING_ORDER.outboundQuantity} 件`)
  refreshPacking()
}

export function renderFinishedMultiItemPacking(): string {
  return `<div data-${EVENT_PREFIX}-root><div data-${EVENT_PREFIX}-workspace>${renderPackingWorkspace()}</div></div>`
}

export function handleFinishedMultiItemPackingEvent(target: HTMLElement, event?: Event): boolean {
  if (!packingRoot()) return false

  const field = target.closest<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="basket"]`)
  if (field) {
    if (event?.type === 'keydown') { startPacking(); return true }
    state.basketCode = field.value
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false

  if (action === 'start-packing') { startPacking(); return true }
  if (action === 'back-to-basket') {
    window.history.pushState(window.history.state, '', '/wls/finished/basic/basket')
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }
  if (action === 'print-waybill') {
    if (!state.started) {
      showListFeedback('请先扫描拣货篮开始打包，再打印面单', 'warning')
      return true
    }
    showListFeedback(`已调起面单打印：${MOCK_PACKING_ORDER.trackingNo}`)
    window.print()
    return true
  }
  if (action === 'confirm-outbound') {
    if (!state.started) {
      showListFeedback('请先扫描拣货篮开始打包', 'warning')
      return true
    }
    if (state.released) {
      showListFeedback('本单已出库，篮子已释放', 'info')
      return true
    }
    refreshPacking()
    return true
  }
  if (action === 'cancel-outbound') {
    refreshPacking()
    return true
  }
  if (action === 'confirm-outbound-run') {
    state.released = true
    showListFeedback(`出库单 ${MOCK_PACKING_ORDER.outboundOrderNo} 已出库，拣货篮 ${state.basketCode} 已释放`)
    refreshPacking()
    return true
  }
  return false
}
