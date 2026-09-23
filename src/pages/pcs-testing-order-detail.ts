import { renderProductInformation } from './pcs-product-information.ts'
import { getStyleArchiveById } from '../data/pcs-style-archive-repository.ts'
// @page-pattern: detail
import { escapeHtml } from '../utils.ts'
import {
  advanceTestingOrder,
  bootstrapTestingOrders,
  completeLabelStep,
  completeSampleInbound,
  getTestingOrderById,
  pushChannelProducts,
  rejectBuyerConfirm,
  rejectPricing,
  setBulkDecision,
  updateTestingOrder,
  TESTING_ORDER_STEPS,
  TESTING_ORDER_STEP_TEAMS,
  type TestingOrderRecord,
  type TestingOrderStepKey,
} from '../data/pcs-testing-order-repository.ts'
import { PCS_CHANNEL_OPTIONS } from '../data/pcs-channel-options.ts'
import { getDefaultPcsStoreIdByChannel, resolvePcsStoreCurrency } from '../data/pcs-channel-store-master.ts'

bootstrapTestingOrders()
let actionNotice = ''

const STEP_TITLES: Record<TestingOrderStepKey, string> = Object.fromEntries(
  TESTING_ORDER_STEPS.map((step) => [step.key, step.title]),
) as Record<TestingOrderStepKey, string>

function statusBadge(order: TestingOrderRecord): string {
  return order.status === '已结束'
    ? '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">已结束</span>'
    : '<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">进行中</span>'
}

function renderSteps(order: TestingOrderRecord): string {
  const currentIndex = TESTING_ORDER_STEPS.findIndex((step) => step.key === order.currentStepKey)
  const team = TESTING_ORDER_STEP_TEAMS[order.currentStepKey] || '—'
  return `
    <section class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
      当前步骤责任团队：<strong>${escapeHtml(team)}</strong>
    </section>
    <ol class="grid gap-2 md:grid-cols-5">
      ${TESTING_ORDER_STEPS.map((step, index) => {
        const active = index === currentIndex
        const done = index < currentIndex || (order.status === '已结束' && index <= currentIndex)
        return `
          <li class="rounded-lg border px-3 py-2 text-xs ${active ? 'border-blue-300 bg-blue-50 text-blue-800' : done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}">
            <div class="font-medium">${escapeHtml(step.title)}</div>
            <div class="mt-1 leading-4 opacity-80">${escapeHtml(step.description)}</div>
          </li>
        `
      }).join('')}
    </ol>
  `
}

function renderActivePanel(order: TestingOrderRecord): string {
  if (order.status === '已结束') {
    return `
      <section class="rounded-lg border border-slate-200 bg-white p-4">
        <div class="text-sm font-medium text-slate-900">测款已结束</div>
        <p class="mt-1 text-sm text-slate-600">${escapeHtml(order.endReason || '已结束')} · ${escapeHtml(order.endedAt || '—')}</p>
        ${order.bulkDecision ? `<p class="mt-2 text-sm">大货判断：<strong>${escapeHtml(order.bulkDecision)}</strong> ${escapeHtml(order.bulkDecisionNote)}</p>` : ''}
        ${order.buyerDecision ? `<p class="mt-1 text-sm">买手确认：${escapeHtml(order.buyerDecision)} ${escapeHtml(order.buyerDecisionNote)}</p>` : ''}
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" class="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-nav="/pcs/production-preparation/orders">进入生产准备</button>
        </div>
      </section>
    `
  }

  const step = order.currentStepKey
  const panel: Record<TestingOrderStepKey, string> = {
    archive: `
      <p class="text-sm text-slate-600">${order.archiveMode === 'linked' ? '已关联现有商品档案' : '系统建档已完成'}：SPU ${escapeHtml(order.spuCode)}，SKU ${escapeHtml(order.skuCodes.join('、') || '—')}。</p>
      <button type="button" class="mt-3 h-9 rounded-md bg-slate-900 px-4 text-sm text-white" data-pcs-testing-action="advance" data-step="purchase-link">下一步：②采购下单</button>
    `,
    'purchase-link': `
      <label class="block text-sm"><span class="text-xs text-slate-500">采购链接（仅存本测款单）</span>
        <input type="url" value="${escapeHtml(order.purchaseLinks[0] || '')}" data-pcs-testing-field="purchase-link" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" placeholder="https://..." />
      </label>
      <p class="mt-2 text-xs text-slate-500">档案 SKU 不落采购链接字段（TEST-005 / ARCH-007）。</p>
      <button type="button" class="mt-3 h-9 rounded-md bg-slate-900 px-4 text-sm text-white" data-pcs-testing-action="save-purchase-link">保存并下一步</button>
    `,
    logistics: `
      <div class="grid gap-3 sm:grid-cols-3">
        <label class="text-sm">快递<input value="${escapeHtml(order.logisticsCarrier)}" data-pcs-testing-field="carrier" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>
        <label class="text-sm">运单号<input value="${escapeHtml(order.logisticsTrackingNo)}" data-pcs-testing-field="tracking" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>
        <label class="text-sm">预计到达<input value="${escapeHtml(order.logisticsEta)}" data-pcs-testing-field="eta" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" placeholder="YYYY-MM-DD" /></label>
      </div>
      <button type="button" class="mt-3 h-9 rounded-md bg-slate-900 px-4 text-sm text-white" data-pcs-testing-action="save-logistics">保存并下一步：④样衣入库</button>
    `,
    'sample-inbound': `
      <p class="text-sm text-slate-600">样衣入库：由样衣模块确认样品入库成功后推进（责任团队：仓储/现场）。</p>
      ${order.sampleInboundAt ? `<p class="mt-2 text-sm text-emerald-700">已入库 ${escapeHtml(order.sampleInboundAt)}${order.sampleInboundNote ? ` · ${escapeHtml(order.sampleInboundNote)}` : ''}</p>` : ''}
      <label class="mt-3 block text-sm">入库备注
        <input value="${escapeHtml(order.sampleInboundNote)}" data-pcs-testing-field="sample-note" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" placeholder="样衣已入样衣仓" />
      </label>
      <button type="button" class="mt-3 h-9 rounded-md bg-slate-900 px-4 text-sm text-white" data-pcs-testing-action="complete-sample-inbound">确认样衣入库并下一步</button>
    `,
    label: `
      <p class="text-sm text-slate-600">打标完成条件：已贴码且码值等于 SKU 编码。本单 SKU：${escapeHtml(order.skuCodes.join('、') || '—')}</p>
      <label class="mt-3 block text-sm">贴码 SKU 编码
        <input value="${escapeHtml(order.labeledSkuCode || order.skuCodes[0] || '')}" data-pcs-testing-field="label-sku" list="pcs-testing-sku-list" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" />
      </label>
      <datalist id="pcs-testing-sku-list">${order.skuCodes.map((code) => `<option value="${escapeHtml(code)}"></option>`).join('')}</datalist>
      <button type="button" class="mt-3 h-9 rounded-md bg-slate-900 px-4 text-sm text-white" data-pcs-testing-action="complete-label">确认贴码并完成本步</button>
    `,
    'buyer-confirm': `
      <p class="text-sm text-slate-600">买手确认淘汰 → 测款单结束并保留淘汰事实。</p>
      <label class="mt-3 block text-sm">确认说明
        <input value="${escapeHtml(order.buyerDecisionNote)}" data-pcs-testing-field="buyer-note" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" />
      </label>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="h-9 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm text-rose-700" data-pcs-testing-action="buyer-kill">确认淘汰并结束</button>
        <button type="button" class="h-9 rounded-md bg-slate-900 px-4 text-sm text-white" data-pcs-testing-action="advance" data-step="pricing">通过，进入⑦核价</button>
      </div>
    `,
    pricing: `
      <div class="grid gap-3 sm:grid-cols-3">
        <label class="text-sm">初步 BOM 成本<input type="number" value="${order.pricing.initialBomCost}" data-pcs-testing-field="bom-cost" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>
        <label class="text-sm">工艺成本<input type="number" value="${order.pricing.processCost}" data-pcs-testing-field="process-cost" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>
        <label class="text-sm">目标定价<input type="number" value="${order.pricing.targetPrice}" data-pcs-testing-field="target-price" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>
      </div>
      <label class="mt-3 block text-sm">核价备注<input value="${escapeHtml(order.pricing.note)}" data-pcs-testing-field="pricing-note" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="h-9 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm text-rose-700" data-pcs-testing-action="pricing-kill">核价淘汰并结束</button>
        <button type="button" class="h-9 rounded-md bg-slate-900 px-4 text-sm text-white" data-pcs-testing-action="save-pricing">保存并进入⑧寄样+渠道上架</button>
      </div>
    `,
    'channel-listing': `
      <p class="text-sm text-slate-600">寄样方式与第二次上架（区别于①建档上架）：创建渠道商品并推送测款渠道，推送后按档案清单回写。</p>
      <div class="mt-3 flex flex-wrap gap-3">
        ${PCS_CHANNEL_OPTIONS.map(
          (channel) => `
          <label class="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
            <input type="checkbox" value="${channel.code}" ${order.channelCodes.includes(channel.code) ? 'checked' : ''} data-pcs-testing-field="channel" />
            ${escapeHtml(channel.name)}
          </label>`,
        ).join('')}
      </div>
      <label class="mt-3 block text-sm">寄样方式
        <select data-pcs-testing-field="ship-method" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm">
          <option value="人头" ${order.shipMethod === '人头' ? 'selected' : ''}>人头</option>
          <option value="空运" ${order.shipMethod === '空运' ? 'selected' : ''}>空运</option>
        </select>
      </label>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">${PCS_CHANNEL_OPTIONS.map((channel) => {
        const currency = resolvePcsStoreCurrency(getDefaultPcsStoreIdByChannel(channel.code), channel.code)
        return `<label class="text-sm">${escapeHtml(channel.name)} 渠道售价（${escapeHtml(currency)}）<input type="number" min="0.01" step="0.01" value="${order.channelPrices?.[channel.code] || ''}" data-pcs-testing-field="channel-price-${escapeHtml(channel.code)}" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>`
      }).join('')}</div>
      <p class="mt-2 text-xs text-slate-500">核价金额为人民币参考；各渠道按店铺币种填写售价，不自动换算。</p>
      <button type="button" class="mt-3 h-9 rounded-md bg-slate-900 px-4 text-sm text-white" data-pcs-testing-action="push-channels">推送渠道并按清单回写档案</button>
      ${actionNotice ? `<p role="status" class="mt-2 text-sm text-amber-700">${escapeHtml(actionNotice)}</p>` : ''}
    `,
    'live-testing': `
      <label class="block text-sm">直播测款执行记录
        <textarea data-pcs-testing-field="live-note" rows="3" class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm">${escapeHtml(order.liveSessionNote)}</textarea>
      </label>
      <button type="button" class="mt-3 h-9 rounded-md bg-slate-900 px-4 text-sm text-white" data-pcs-testing-action="save-live">保存并进入⑩大货判断</button>
    `,
    'bulk-decision': `
      <p class="text-sm text-slate-600">大货判断支持 是 / 否 / 待定；待定保持进行中，可再次判断。</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="h-9 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm text-emerald-700" data-pcs-testing-action="bulk" data-value="是">是（结束并进入生产准备）</button>
        <button type="button" class="h-9 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm text-rose-700" data-pcs-testing-action="bulk" data-value="否">否（结束）</button>
        <button type="button" class="h-9 rounded-md border border-amber-200 bg-amber-50 px-4 text-sm text-amber-700" data-pcs-testing-action="bulk" data-value="待定">待定（保持进行中）</button>
      </div>
      <label class="mt-3 block text-sm">判断说明
        <input value="${escapeHtml(order.bulkDecisionNote)}" data-pcs-testing-field="bulk-note" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" />
      </label>
      ${order.status === '进行中' && order.bulkDecision && order.bulkDecision !== '待定' ? '' : ''}
    `,
  }
  return `<section class="rounded-lg border border-blue-200 bg-blue-50/40 p-4">${panel[step]}</section>`
}

export function renderPcsTestingOrderDetailPage(testingOrderId: string): string {
  const order = getTestingOrderById(decodeURIComponent(testingOrderId))
  if (!order) {
    return '<section class="rounded-lg border bg-white p-10 text-center text-slate-500">未找到测款单。<button type="button" class="ml-3 text-blue-700 underline" data-nav="/pcs/testing/orders">返回列表</button></section>'
  }

  return `
    <div class="space-y-4 p-4">
      <section class="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-white p-4 shadow-sm">
        <div class="flex items-start gap-4">
          <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/testing/orders">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
          </button>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(order.orderCode)}</h1>
              ${statusBadge(order)}
            </div>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(order.styleCode)} · ${escapeHtml(order.styleName)}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          ${order.styleImageUrl ? `<button type="button" class="relative shrink-0 cursor-zoom-in overflow-hidden rounded-md border" data-pcs-testing-action="preview-image" data-pda-image-preview-url="${escapeHtml(order.styleImageUrl)}" data-pda-image-preview-title="${escapeHtml(order.styleName)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(order.styleName)}大图">
            <img src="${escapeHtml(order.styleImageUrl)}" alt="${escapeHtml(order.styleName)}" class="h-20 w-20 object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" /><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-xs text-slate-600">图片加载中</span>
          </button>` : '<span class="flex h-20 w-20 shrink-0 items-center justify-center rounded border text-xs text-red-600">缺少图片</span>'}
          <div class="grid gap-1 text-xs text-slate-500">
            <div>SPU ${escapeHtml(order.spuCode)}</div>
            <div>SKU ${escapeHtml(order.skuCodes.join('、') || '—')}</div>
            <div>买手 ${escapeHtml(order.buyerName || '待分配')}</div>
            <div>寄样 ${escapeHtml(order.shipMethod)}</div>
          </div>
        </div>
      </section>
      ${renderSteps(order)}
      ${renderActivePanel(order)}
      <details class="rounded-lg border bg-white"><summary class="cursor-pointer p-4 text-sm font-medium">商品信息（来自商品档案）</summary>${renderProductInformation(getStyleArchiveById(order.styleId))}</details>
      <section class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-lg border bg-white p-4 shadow-sm">
          <div class="text-sm font-medium text-slate-900">关键事实</div>
          <dl class="mt-3 grid gap-2 text-sm">
            <div class="flex justify-between gap-3"><dt class="text-slate-500">采购链接</dt><dd class="text-right text-slate-700">${escapeHtml(order.purchaseLinks[0] || '—')}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">物流</dt><dd class="text-right text-slate-700">${escapeHtml([order.logisticsCarrier, order.logisticsTrackingNo, order.logisticsEta].filter(Boolean).join(' · ') || '—')}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">打标</dt><dd class="text-right text-slate-700">${order.labeledAt ? `${escapeHtml(order.labeledSkuCode)} @ ${escapeHtml(order.labeledAt)}` : '未打标'}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">核价</dt><dd class="text-right text-slate-700">BOM ¥${order.pricing.initialBomCost} · 工艺 ¥${order.pricing.processCost} · 定价 ¥${order.pricing.targetPrice}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">渠道</dt><dd class="text-right text-slate-700">${escapeHtml(order.channelCodes.join('、'))}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">大货判断</dt><dd class="text-right text-slate-700">${escapeHtml(order.bulkDecision || '—')}</dd></div>
          </dl>
        </div>
        <div class="rounded-lg border bg-white p-4 shadow-sm">
          <div class="text-sm font-medium text-slate-900">操作历史</div>
          <ol class="mt-3 space-y-2 text-sm text-slate-600">
            ${order.history
              .slice(0, 8)
              .map(
                (item) =>
                  `<li class="border-b border-slate-50 pb-2">${escapeHtml(item.time)} · ${escapeHtml(item.action)} · ${escapeHtml(item.actor)}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</li>`,
              )
              .join('')}
          </ol>
        </div>
      </section>
    </div>
  `
}

const CHANGE_RERENDER_ACTIONS = new Set([
  'advance',
  'save-purchase-link',
  'save-logistics',
  'complete-sample-inbound',
  'complete-label',
  'buyer-kill',
  'save-pricing',
  'pricing-kill',
  'push-channels',
  'save-live',
  'bulk',
])

export function handlePcsTestingOrderInput(_target: Element): boolean {
  // Text fields are only read on button actions. Returning true would trigger a
  // full re-render on every input and wipe the in-progress value.
  return false
}

export function handlePcsTestingOrderEvent(target: HTMLElement): boolean {
  const node = target.closest<HTMLElement>('[data-pcs-testing-action]')
  if (!node) return false
  const action = node.dataset.pcsTestingAction || ''
  const orderId = (window.location.pathname.match(/\/pcs\/testing\/orders\/([^/]+)/) || [])[1] || ''
  const id = decodeURIComponent(orderId)
  const order = getTestingOrderById(id)
  if (!order) return false

  const read = (name: string): string => {
    const el = document.querySelector<HTMLElement>(`[data-pcs-testing-field="${name}"]`)
    return el ? (el as HTMLInputElement).value : ''
  }

  if (action === 'advance') {
    const step = node.dataset.step as TestingOrderStepKey
    return advanceTestingOrder(id, step).ok
  }
  if (action === 'save-purchase-link') {
    const link = read('purchase-link')
    updateTestingOrder(id, { purchaseLinks: link ? [link] : [] }, '当前用户', '保存采购链接')
    return advanceTestingOrder(id, 'logistics').ok
  }
  if (action === 'save-logistics') {
    updateTestingOrder(
      id,
      {
        logisticsCarrier: read('carrier'),
        logisticsTrackingNo: read('tracking'),
        logisticsEta: read('eta'),
      },
      '当前用户',
      '保存物流信息',
    )
    return advanceTestingOrder(id, 'sample-inbound').ok
  }
  if (action === 'complete-sample-inbound') {
    return completeSampleInbound(id, read('sample-note') || '样衣已入样衣仓').ok
  }
  if (action === 'complete-label') {
    return completeLabelStep(id, read('label-sku') || order.skuCodes[0] || '').ok
  }
  if (action === 'buyer-kill') {
    return rejectBuyerConfirm(id, read('buyer-note') || '买手确认淘汰').ok
  }
  if (action === 'save-pricing') {
    updateTestingOrder(
      id,
      {
        pricing: {
          initialBomCost: Number(read('bom-cost') || 0),
          processCost: Number(read('process-cost') || 0),
          targetPrice: Number(read('target-price') || 0),
          note: read('pricing-note'),
        },
      },
      '当前用户',
      '保存核价',
    )
    return advanceTestingOrder(id, 'channel-listing').ok
  }
  if (action === 'pricing-kill') {
    return rejectPricing(id, read('pricing-note') || '核价淘汰').ok
  }
  if (action === 'push-channels') {
    const checked = [...document.querySelectorAll<HTMLInputElement>('[data-pcs-testing-field="channel"]:checked')].map(
      (el) => el.value,
    )
    const channelPrices = Object.fromEntries(PCS_CHANNEL_OPTIONS.map((channel) =>
      [channel.code, Number(read(`channel-price-${channel.code}`))],
    ))
    updateTestingOrder(
      id,
      { channelCodes: checked, channelPrices, shipMethod: (read('ship-method') || '人头') as '人头' | '空运' },
      '当前用户',
      '配置渠道与寄样',
    )
    const pushed = pushChannelProducts(id)
    actionNotice = pushed.ok ? '' : pushed.message || '渠道商品创建失败。'
    return true
  }
  if (action === 'save-live') {
    updateTestingOrder(id, { liveSessionNote: read('live-note') }, '当前用户', '保存直播测款记录')
    return advanceTestingOrder(id, 'bulk-decision').ok
  }
  if (action === 'bulk') {
    const value = node.dataset.value as '是' | '否' | '待定'
    return setBulkDecision(id, value, read('bulk-note')).ok
  }
  if (action === 'preview-image') {
    return true
  }
  return CHANGE_RERENDER_ACTIONS.has(action)
}

export function isPcsTestingOrderDialogOpen(): boolean {
  return false
}
