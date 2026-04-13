import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderFormDialog } from '../components/ui'
import {
  CHANNEL_PRODUCT_STATUS_META,
  CHANNEL_OPTIONS,
  LISTING_INSTANCES,
  MAP_STATUS_META,
  PRODUCT_LOGS,
  PRODUCT_ORDER_TRACES,
  PRODUCT_VARIANTS,
  STORE_OPTIONS,
  getChannelProductDetail,
  type ProductDetail,
} from '../data/pcs-channels'
import {
  getProjectChannelProductById,
  type ProjectChannelProductRecord,
} from '../data/pcs-channel-product-project-repository.ts'

type ProductDetailTab = 'overview' | 'variants' | 'listing' | 'orders' | 'logs'

interface DetailState {
  productId: string
  activeTab: ProductDetailTab
  listingDrawerOpen: boolean
  switchSpuDialogOpen: boolean
  bindSkuDialog: { open: boolean; variantId: string | null }
  listingStore: string
  listingPrice: string
  targetSpu: string
  targetSku: string
  notice: string | null
}

const state: DetailState = {
  productId: '',
  activeTab: 'overview',
  listingDrawerOpen: false,
  switchSpuDialogOpen: false,
  bindSkuDialog: { open: false, variantId: null },
  listingStore: '',
  listingPrice: '',
  targetSpu: '',
  targetSku: '',
  notice: null,
}

const TABS: Array<{ key: ProductDetailTab; label: string }> = [
  { key: 'overview', label: '概览信息' },
  { key: 'variants', label: '变体与映射' },
  { key: 'listing', label: '上架实例' },
  { key: 'orders', label: '订单追溯' },
  { key: 'logs', label: '日志审计' },
]

function getDetail(): ProductDetail | null {
  return getChannelProductDetail(state.productId)
}

function getProjectProductDetail(): ProjectChannelProductRecord | null {
  return getProjectChannelProductById(state.productId)
}

function renderNotFound(productId: string): string {
  return `
    <div class="space-y-4">
      <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-product-detail-action="go-list">
        <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回列表
      </button>
      <section class="rounded-lg border border-dashed bg-card px-4 py-14 text-center text-muted-foreground">
        <i data-lucide="file-x-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
        <p class="mt-2">未找到渠道商品：${escapeHtml(productId)}</p>
      </section>
    </div>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-channel-product-detail-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(detail: ProductDetail): string {
  const statusMeta = CHANNEL_PRODUCT_STATUS_META[detail.status]

  return `
    <header class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-product-detail-action="go-list">
            <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回列表
          </button>
          <p class="text-xs text-muted-foreground">商品档案 / 渠道商品</p>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-semibold">${escapeHtml(detail.platformItemTitle)}</h1>
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${statusMeta.color}">${statusMeta.label}</span>
          </div>
          <p class="text-sm text-muted-foreground">${escapeHtml(detail.channel)} / ${escapeHtml(detail.store)} ｜ 平台ID ${escapeHtml(detail.platformItemId)} ｜ 挂接 ${escapeHtml(detail.internalRefCode)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${
            detail.status === 'DRAFT' || detail.status === 'OFFLINE'
              ? '<button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-channel-product-detail-action="open-listing"><i data-lucide="upload" class="mr-1 h-3.5 w-3.5"></i>发起上架</button>'
              : ''
          }
          ${
            detail.internalRefType === 'CANDIDATE'
              ? '<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-product-detail-action="open-switch-spu"><i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>切换绑定到款式档案</button>'
              : ''
          }
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-product-detail-action="go-mapping"><i data-lucide="map" class="mr-1 h-3.5 w-3.5"></i>渠道属性对应</button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-product-detail-action="go-store-view"><i data-lucide="store" class="mr-1 h-3.5 w-3.5"></i>店铺视图</button>
        </div>
      </div>
    </header>
  `
}

function renderTabs(): string {
  return `
    <div class="flex flex-wrap gap-2 border-b pb-3">
      ${TABS.map((tab) => {
        const active = state.activeTab === tab.key
        return `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-channel-product-detail-action="set-tab" data-tab-key="${tab.key}">${tab.label}</button>`
      }).join('')}
    </div>
  `
}

function renderOverview(detail: ProductDetail): string {
  return `
    <section class="grid gap-3 xl:grid-cols-3">
      <article class="rounded-lg border bg-card p-3 text-sm">
        <p class="text-xs text-muted-foreground">基础信息</p>
        <div class="mt-2 space-y-1">
          <p>平台商品ID：${escapeHtml(detail.platformItemId)}</p>
          <p>平台类目：${escapeHtml(detail.platformCategory)}</p>
          <p>上架时间：${escapeHtml(detail.listingTime)}</p>
          <p>更新时间：${escapeHtml(detail.updatedAt)}</p>
        </div>
      </article>
      <article class="rounded-lg border bg-card p-3 text-sm">
        <p class="text-xs text-muted-foreground">内部绑定</p>
        <div class="mt-2 space-y-1">
          <p>绑定类型：${escapeHtml(detail.internalRefType)}</p>
          <p>内部编码：${escapeHtml(detail.internalRefCode)}</p>
          <p>内部名称：${escapeHtml(detail.internalRefTitle)}</p>
          <p>映射健康：${escapeHtml(detail.mappingHealth)}</p>
        </div>
      </article>
      <article class="rounded-lg border bg-card p-3 text-sm">
        <p class="text-xs text-muted-foreground">链路提醒</p>
        <div class="mt-2 space-y-1 text-muted-foreground">
          <p>渠道商品详情承接商品上架节点生成的正式渠道商品主档、变体映射、上架实例、订单追溯、日志审计。</p>
          <p>若挂接异常，请前往“渠道属性对应”修复。</p>
        </div>
      </article>
    </section>
  `
}

function renderVariants(): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">平台规格编码</th>
              <th class="px-3 py-2 font-medium">卖家规格编码</th>
              <th class="px-3 py-2 font-medium">规格</th>
              <th class="px-3 py-2 text-right font-medium">价格</th>
              <th class="px-3 py-2 font-medium">内部规格编码</th>
              <th class="px-3 py-2 font-medium">映射状态</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${PRODUCT_VARIANTS.map(
              (variant) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-3 py-3">${escapeHtml(variant.platformSkuId)}</td>
                  <td class="px-3 py-3">${escapeHtml(variant.sellerSku)}</td>
                  <td class="px-3 py-3">${escapeHtml(variant.color)} / ${escapeHtml(variant.size)}</td>
                  <td class="px-3 py-3 text-right">${variant.price.toLocaleString()}</td>
                  <td class="px-3 py-3">${escapeHtml(variant.internalSkuId ?? '-')}</td>
                  <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${MAP_STATUS_META[variant.mapStatus].color}">${MAP_STATUS_META[variant.mapStatus].label}</span></td>
                  <td class="px-3 py-3">
                    <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-product-detail-action="open-bind-sku" data-variant-id="${escapeHtml(variant.id)}">绑定规格</button>
                  </td>
                </tr>
              `,
            ).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderListing(): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">实例编号</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">负责人</th>
              <th class="px-3 py-2 font-medium">创建时间</th>
              <th class="px-3 py-2 font-medium">完成时间</th>
              <th class="px-3 py-2 font-medium">失败原因</th>
            </tr>
          </thead>
          <tbody>
            ${LISTING_INSTANCES.map(
              (instance) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-3 py-3">${escapeHtml(instance.code)}</td>
                  <td class="px-3 py-3">${escapeHtml(instance.status)}</td>
                  <td class="px-3 py-3">${escapeHtml(instance.owner)}</td>
                  <td class="px-3 py-3">${escapeHtml(instance.createdAt)}</td>
                  <td class="px-3 py-3">${escapeHtml(instance.completedAt ?? '-')}</td>
                  <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(instance.failReason ?? '-')}</td>
                </tr>
              `,
            ).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderOrders(): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">订单号</th>
              <th class="px-3 py-2 font-medium">买家</th>
              <th class="px-3 py-2 text-right font-medium">数量</th>
              <th class="px-3 py-2 text-right font-medium">金额</th>
              <th class="px-3 py-2 font-medium">下单时间</th>
              <th class="px-3 py-2 font-medium">平台规格编码</th>
              <th class="px-3 py-2 font-medium">对应规格编码</th>
            </tr>
          </thead>
          <tbody>
            ${PRODUCT_ORDER_TRACES.map(
              (order) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-3 py-3 font-mono">${escapeHtml(order.platformOrderId)}</td>
                  <td class="px-3 py-3">${escapeHtml(order.buyerName)}</td>
                  <td class="px-3 py-3 text-right">${order.qty}</td>
                  <td class="px-3 py-3 text-right">${order.amount.toLocaleString()}</td>
                  <td class="px-3 py-3">${escapeHtml(order.orderTime)}</td>
                  <td class="px-3 py-3">${escapeHtml(order.platformSkuId)}</td>
                  <td class="px-3 py-3">${escapeHtml(order.mappedTo)}</td>
                </tr>
              `,
            ).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderLogs(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">日志审计</h3>
      <div class="mt-3 space-y-2 text-sm">
        ${PRODUCT_LOGS.map(
          (log) => `
            <article class="rounded-md border bg-background px-3 py-2">
              <p class="font-medium">${escapeHtml(log.action)} · ${escapeHtml(log.operator)}</p>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(log.time)} ｜ ${escapeHtml(log.detail)}</p>
            </article>
          `,
        ).join('')}
      </div>
    </section>
  `
}

function renderProjectProductDetail(record: ProjectChannelProductRecord): string {
  const channelName = CHANNEL_OPTIONS.find((item) => item.id === record.channelCode)?.name || record.channelCode
  const storeName = STORE_OPTIONS.find((item) => item.id === record.storeId)?.name || record.storeName
  const sourceLabel = record.styleId ? '已生效渠道商品' : record.channelProductStatus === '已作废' ? '已作废渠道商品' : '测款候选商品'

  return `
    <div class="space-y-4">
      <header class="space-y-3 rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-product-detail-action="go-list">
              <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回列表
            </button>
            <p class="text-xs text-muted-foreground">商品档案 / 渠道商品 / 项目测款来源</p>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold">${escapeHtml(record.channelProductCode)}</h1>
              <span class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">${escapeHtml(sourceLabel)}</span>
            </div>
            <p class="text-sm text-muted-foreground">${escapeHtml(channelName)} / ${escapeHtml(storeName)} ｜ 渠道标题 ${escapeHtml(record.listingTitle)}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-product-detail-action="go-project" data-project-id="${escapeHtml(record.projectId)}">查看来源项目</button>
            ${
              record.styleId
                ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-product-detail-action="go-style" data-style-id="${escapeHtml(record.styleId)}">查看款式档案</button>`
                : ''
            }
          </div>
        </div>
      </header>
      ${renderNotice()}
      <section class="grid gap-3 xl:grid-cols-3">
        <article class="rounded-lg border bg-card p-4 text-sm">
          <h2 class="text-base font-semibold">来源与节点</h2>
          <div class="mt-3 space-y-2">
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">来源项目</span><span class="font-medium">${escapeHtml(record.projectCode)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">项目名称</span><span class="font-medium">${escapeHtml(record.projectName)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">来源商品上架节点</span><span class="font-medium">${escapeHtml(record.projectNodeId)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">渠道 / 店铺</span><span class="font-medium">${escapeHtml(channelName)} / ${escapeHtml(storeName)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">币种 / 售价</span><span class="font-medium">${escapeHtml(record.currency)} / ${record.listingPrice.toLocaleString()}</span></div>
          </div>
        </article>
        <article class="rounded-lg border bg-card p-4 text-sm">
          <h2 class="text-base font-semibold">测款与作废状态</h2>
          <div class="mt-3 space-y-2">
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">当前测款状态</span><span class="font-medium">${escapeHtml(record.testingStatusText)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">渠道商品状态</span><span class="font-medium">${escapeHtml(record.channelProductStatus)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">是否已作废</span><span class="font-medium">${record.channelProductStatus === '已作废' ? '是' : '否'}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">作废原因</span><span class="font-medium">${escapeHtml(record.invalidatedReason || '—')}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">关联改版任务</span><span class="font-medium">${escapeHtml(record.linkedRevisionTaskCode || '—')}</span></div>
          </div>
        </article>
        <article class="rounded-lg border bg-card p-4 text-sm">
          <h2 class="text-base font-semibold">款式档案与上游更新</h2>
          <div class="mt-3 space-y-2">
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">款式档案编码</span><span class="font-medium">${escapeHtml(record.styleCode || '尚未关联')}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">上游渠道商品编码</span><span class="font-medium">${escapeHtml(record.upstreamChannelProductCode || '尚未回填')}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">上游更新状态</span><span class="font-medium">${escapeHtml(record.upstreamSyncStatus)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">是否已完成上游最终更新</span><span class="font-medium">${record.upstreamSyncStatus === '已更新' ? '是' : '否'}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">最后一次上游更新时间</span><span class="font-medium">${escapeHtml(record.lastUpstreamSyncAt || '暂无')}</span></div>
          </div>
        </article>
      </section>
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">三码关联结果</h2>
        <div class="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <div class="rounded-lg border bg-muted/20 p-3">
            <p class="text-xs text-muted-foreground">款式档案编码</p>
            <p class="mt-1 font-medium">${escapeHtml(record.styleCode || '尚未建立')}</p>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <p class="text-xs text-muted-foreground">渠道商品编码</p>
            <p class="mt-1 font-medium">${escapeHtml(record.channelProductCode)}</p>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <p class="text-xs text-muted-foreground">上游渠道商品编码</p>
            <p class="mt-1 font-medium">${escapeHtml(record.upstreamChannelProductCode || '尚未回填')}</p>
          </div>
        </div>
      </section>
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">上游更新日志</h2>
        <div class="mt-3 space-y-2 text-sm">
          <article class="rounded-md border bg-muted/20 p-3">
            <p class="font-medium">${escapeHtml(record.upstreamSyncNote || '暂无上游更新说明')}</p>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.upstreamSyncLog || '暂无上游更新日志')}</p>
          </article>
        </div>
      </section>
    </div>
  `
}

function renderTabContent(detail: ProductDetail): string {
  if (state.activeTab === 'overview') return renderOverview(detail)
  if (state.activeTab === 'variants') return renderVariants()
  if (state.activeTab === 'listing') return renderListing()
  if (state.activeTab === 'orders') return renderOrders()
  return renderLogs()
}

function renderListingDrawer(detail: ProductDetail): string {
  if (!state.listingDrawerOpen) return ''

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-pcs-channel-product-detail-action="close-listing" aria-label="关闭"></button>
      <section class="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 border-b bg-background px-4 py-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold">发起上架</h3>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(detail.id)} ｜ ${escapeHtml(detail.platformItemTitle)}</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-pcs-channel-product-detail-action="close-listing" aria-label="关闭"><i data-lucide="x" class="h-4 w-4"></i></button>
          </div>
        </header>
        <div class="space-y-3 p-4 text-sm">
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">目标店铺</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="如：HiGood官方旗舰店" value="${escapeHtml(state.listingStore)}" data-pcs-channel-product-detail-field="listing-store" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">上架价格</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="如：199000" value="${escapeHtml(state.listingPrice)}" data-pcs-channel-product-detail-field="listing-price" />
          </div>
          <p class="text-xs text-muted-foreground">提交后将生成一条“上架实例”，用于追踪执行结果。</p>
        </div>
        <footer class="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-product-detail-action="close-listing">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-channel-product-detail-action="confirm-listing">确认发起</button>
        </footer>
      </section>
    </div>
  `
}

function renderSwitchSpuDialog(): string {
  if (!state.switchSpuDialogOpen) return ''

  const formContent = `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">目标款式编码</label>
      <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="如：STYLE-20260409-001" value="${escapeHtml(state.targetSpu)}" data-pcs-channel-product-detail-field="target-spu" />
    </div>
  `

  return renderFormDialog(
    {
      title: '切换绑定到款式档案',
      description: '用于候选商品转档后更新内部绑定。',
      closeAction: { prefix: 'pcs-channel-product-detail', action: 'close-switch-spu' },
      submitAction: { prefix: 'pcs-channel-product-detail', action: 'confirm-switch-spu', label: '确认切换' },
      width: 'sm',
    },
    formContent
  )
}

function renderBindSkuDialog(): string {
  if (!state.bindSkuDialog.open) return ''

  const formContent = `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">目标规格编码</label>
      <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="请输入内部规格编码" value="${escapeHtml(state.targetSku)}" data-pcs-channel-product-detail-field="target-sku" />
    </div>
  `

  return renderFormDialog(
    {
      title: '绑定内部规格',
      description: `变体：${escapeHtml(state.bindSkuDialog.variantId ?? '-')}`,
      closeAction: { prefix: 'pcs-channel-product-detail', action: 'close-bind-sku' },
      submitAction: { prefix: 'pcs-channel-product-detail', action: 'confirm-bind-sku', label: '确认绑定' },
      width: 'sm',
    },
    formContent
  )
}

function closeAllDialogs(): void {
  state.listingDrawerOpen = false
  state.switchSpuDialogOpen = false
  state.bindSkuDialog = { open: false, variantId: null }
}

export function renderPcsChannelProductDetailPage(productId: string): string {
  state.productId = productId
  const projectDetail = getProjectProductDetail()
  if (projectDetail) return renderProjectProductDetail(projectDetail)
  const detail = getDetail()
  if (!detail) return renderNotFound(productId)

  return `
    <div class="space-y-4">
      ${renderHeader(detail)}
      ${renderNotice()}
      ${renderTabs()}
      ${renderTabContent(detail)}
      ${renderListingDrawer(detail)}
      ${renderSwitchSpuDialog()}
      ${renderBindSkuDialog()}
    </div>
  `
}

export function handlePcsChannelProductDetailEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-channel-product-detail-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsChannelProductDetailField
    if (field === 'listing-store') state.listingStore = fieldNode.value
    if (field === 'listing-price') state.listingPrice = fieldNode.value
    if (field === 'target-spu') state.targetSpu = fieldNode.value
    if (field === 'target-sku') state.targetSku = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-channel-product-detail-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsChannelProductDetailAction
  if (!action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/products/channel-products')
    return true
  }

  if (action === 'go-project') {
    const projectId = actionNode.dataset.projectId
    if (projectId) {
      appStore.navigate(`/pcs/projects/${projectId}`)
    }
    return true
  }

  if (action === 'go-style') {
    const styleId = actionNode.dataset.styleId
    if (styleId) {
      appStore.navigate(`/pcs/products/styles/${styleId}`)
    }
    return true
  }

  if (action === 'go-mapping') {
    appStore.navigate('/pcs/products/channel-attributes')
    return true
  }

  if (action === 'go-store-view') {
    appStore.navigate('/pcs/products/channel-products/store')
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'set-tab') {
    state.activeTab = (actionNode.dataset.tabKey as ProductDetailTab | undefined) ?? 'overview'
    return true
  }

  if (action === 'open-listing') {
    state.listingDrawerOpen = true
    state.listingStore = ''
    state.listingPrice = ''
    return true
  }

  if (action === 'close-listing') {
    state.listingDrawerOpen = false
    return true
  }

  if (action === 'confirm-listing') {
    if (!state.listingStore.trim() || !state.listingPrice.trim()) {
      state.notice = '请填写目标店铺和上架价格。'
      return true
    }
    state.listingDrawerOpen = false
    state.notice = '上架实例创建成功（演示态）。'
    return true
  }

  if (action === 'open-switch-spu') {
    state.switchSpuDialogOpen = true
    state.targetSpu = ''
    return true
  }

  if (action === 'close-switch-spu') {
    state.switchSpuDialogOpen = false
    state.targetSpu = ''
    return true
  }

  if (action === 'confirm-switch-spu') {
    if (!state.targetSpu.trim()) {
      state.notice = '请先填写目标款式编码。'
      return true
    }
    state.switchSpuDialogOpen = false
    state.notice = `已切换绑定到 ${state.targetSpu}（演示态）。`
    return true
  }

  if (action === 'open-bind-sku') {
    const variantId = actionNode.dataset.variantId
    if (!variantId) return false
    state.bindSkuDialog = { open: true, variantId }
    state.targetSku = ''
    return true
  }

  if (action === 'close-bind-sku') {
    state.bindSkuDialog = { open: false, variantId: null }
    state.targetSku = ''
    return true
  }

  if (action === 'confirm-bind-sku') {
    if (!state.targetSku.trim()) {
      state.notice = '请先填写目标规格编码。'
      return true
    }
    state.notice = `${state.bindSkuDialog.variantId ?? ''} 已绑定 ${state.targetSku}（演示态）。`
    state.bindSkuDialog = { open: false, variantId: null }
    state.targetSku = ''
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsChannelProductDetailDialogOpen(): boolean {
  return state.listingDrawerOpen || state.switchSpuDialogOpen || state.bindSkuDialog.open
}
