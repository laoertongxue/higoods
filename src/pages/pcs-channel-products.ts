import {
  getProjectChannelProductById,
  listProjectChannelProducts,
  type ProjectChannelProductRecord,
} from '../data/pcs-channel-product-project-repository.ts'
import { getStyleArchiveById } from '../data/pcs-style-archive-repository.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

const PREFERRED_PROJECT_ORDER = [
  'PRJ-20251216-015',
  'PRJ-20251216-025',
  'PRJ-20251216-024',
  'PRJ-20251216-023',
  'PRJ-20251216-014',
  'PRJ-20251216-013',
  'PRJ-20251216-022',
  'PRJ-20251216-021',
  'PRJ-20251216-011',
]

function listDisplayRecords(): ProjectChannelProductRecord[] {
  const priority = new Map(PREFERRED_PROJECT_ORDER.map((code, index) => [code, index]))
  return [...listProjectChannelProducts()].sort((left, right) => {
    const leftPriority = priority.get(left.projectCode) ?? Number.MAX_SAFE_INTEGER
    const rightPriority = priority.get(right.projectCode) ?? Number.MAX_SAFE_INTEGER
    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

function getChannelLabel(channelCode: string): string {
  if (channelCode === 'shopee') return 'Shopee'
  if (channelCode === 'wechat-mini-program') return 'wechat-mini-program'
  if (channelCode === 'lazada') return 'Lazada'
  return 'tiktok-shop'
}

function getStoreLabel(record: ProjectChannelProductRecord): string {
  if (record.storeId === 'store-shopee-01') return '虾皮马来西亚店'
  if (record.storeId === 'store-mini-program-01') return '微信小程序商城'
  if (record.storeId === 'store-lazada-01') return 'Lazada 菲律宾店'
  if (record.storeId === 'store-tiktok-01') return '抖音商城旗舰店'
  return record.storeName || '-'
}

function getViewLabel(record: ProjectChannelProductRecord): string {
  if (record.channelProductStatus === '已生效') return '已生效渠道商品'
  if (record.channelProductStatus === '已作废') return '已作废历史商品'
  if (record.channelProductStatus === '已上架待测款') return '正式测款渠道商品'
  return '待上架渠道商品'
}

function getLinkageDescription(record: ProjectChannelProductRecord): string {
  if (record.channelProductStatus === '已作废') {
    return record.testingStatusText || record.invalidatedReason || record.upstreamSyncNote || '当前渠道商品已作废'
  }
  if (record.styleCode && record.upstreamSyncStatus === '已更新') {
    return '测款通过，已关联款式档案并完成上游最终更新'
  }
  if (record.styleCode && record.upstreamSyncStatus === '待更新') {
    return '测款通过，已生成款式档案，待启用技术包'
  }
  if (record.channelProductStatus === '已上架待测款') {
    return '已完成上架，等待直播 / 短视频正式测款结论'
  }
  return record.upstreamSyncNote || record.testingStatusText || '-'
}

function renderBadge(text: string, className: string): string {
  return `<span class="${escapeHtml(toClassName('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', className))}">${escapeHtml(text)}</span>`
}

function renderChannelStatusBadge(status: ProjectChannelProductRecord['channelProductStatus']): string {
  if (status === '已生效') return renderBadge(status, 'bg-emerald-100 text-emerald-700')
  if (status === '已作废') return renderBadge(status, 'bg-rose-100 text-rose-700')
  if (status === '已上架待测款') return renderBadge(status, 'bg-blue-100 text-blue-700')
  return renderBadge(status, 'bg-slate-100 text-slate-600')
}

function renderUpstreamStatusBadge(status: ProjectChannelProductRecord['upstreamSyncStatus']): string {
  if (status === '已更新') return renderBadge(status, 'bg-emerald-100 text-emerald-700')
  if (status === '待更新') return renderBadge(status, 'bg-amber-100 text-amber-700')
  return renderBadge(status, 'bg-slate-100 text-slate-600')
}

function renderDateTimeCell(value: string): string {
  const formatted = formatDateTime(value)
  if (formatted === '-') return '-'
  const [dateText, timeText] = formatted.split(' ')
  return `
    <div class="text-sm text-slate-500">
      <div>${escapeHtml(dateText || '-')}</div>
      <div class="mt-0.5">${escapeHtml(timeText || '')}</div>
    </div>
  `
}

function renderListRow(record: ProjectChannelProductRecord): string {
  const detailHref = `/pcs/products/channel-products/${encodeURIComponent(record.channelProductId)}`
  const projectHref = `/pcs/projects/${encodeURIComponent(record.projectId)}`

  return `
    <tr class="border-t border-slate-200 align-top">
      <td class="px-4 py-4 text-[15px] font-semibold text-slate-900">${escapeHtml(record.channelProductCode)}</td>
      <td class="px-4 py-4">
        <button type="button" class="text-left text-[15px] font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(projectHref)}">${escapeHtml(record.projectCode)}</button>
        <div class="mt-1 max-w-[156px] text-xs leading-5 text-slate-500">${escapeHtml(record.projectName)}</div>
      </td>
      <td class="px-4 py-4">
        <div class="text-[15px] font-medium leading-6 text-slate-900">${escapeHtml(record.listingInstanceCode)}</div>
        <div class="mt-1 text-xs leading-5 text-slate-500">${escapeHtml(record.projectNodeId)}</div>
      </td>
      <td class="px-4 py-4 text-[15px] leading-6 text-slate-900">${escapeHtml(`${getChannelLabel(record.channelCode)} / ${getStoreLabel(record)}`)}</td>
      <td class="px-4 py-4 text-[15px] leading-6 text-slate-900">${escapeHtml(getViewLabel(record))}</td>
      <td class="px-4 py-4">${renderChannelStatusBadge(record.channelProductStatus)}</td>
      <td class="px-4 py-4">${renderUpstreamStatusBadge(record.upstreamSyncStatus)}</td>
      <td class="px-4 py-4 text-[15px] leading-6 text-slate-900">${escapeHtml(record.styleCode || '尚未关联')}</td>
      <td class="px-4 py-4 text-[15px] leading-6 text-slate-900">${escapeHtml(record.upstreamChannelProductCode || '-')}</td>
      <td class="px-4 py-4">
        <div class="max-w-[200px] text-xs leading-5 text-slate-500">${escapeHtml(getLinkageDescription(record))}</div>
      </td>
      <td class="px-4 py-4">${renderDateTimeCell(record.updatedAt)}</td>
      <td class="px-4 py-4">
        <div class="flex flex-col items-end gap-2">
          <button type="button" class="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(detailHref)}">详情</button>
          <button type="button" class="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(projectHref)}">查看项目</button>
        </div>
      </td>
    </tr>
  `
}

function renderDetailField(label: string, value: string): string {
  return `
    <div class="flex items-start justify-between gap-4 text-sm">
      <span class="text-slate-500">${escapeHtml(label)}</span>
      <span class="text-right font-semibold text-slate-900">${escapeHtml(value || '-')}</span>
    </div>
  `
}

function renderCodeBox(label: string, value: string): string {
  return `
    <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div class="text-sm text-slate-500">${escapeHtml(label)}</div>
      <div class="mt-1.5 text-base font-semibold text-slate-900">${escapeHtml(value || '-')}</div>
    </div>
  `
}

function renderDetailButton(label: string, href: string | null): string {
  if (!href) {
    return `<button type="button" class="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-300" disabled>${escapeHtml(label)}</button>`
  }
  return `<button type="button" class="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(href)}">${escapeHtml(label)}</button>`
}

export function renderPcsChannelProductListPage(): string {
  const records = listDisplayRecords()

  return `
    <div class="p-4">
      <section class="rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-5 py-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-[22px] font-semibold text-slate-900">渠道店铺商品</h1>
              <p class="mt-1 text-sm text-slate-500">聚合来源项目、商品上架节点、渠道店铺、款式档案与上游更新链路。</p>
            </div>
            <div class="rounded-xl bg-slate-50 px-3 py-2 text-right">
              <div class="text-xs text-slate-500">当前记录</div>
              <div class="mt-1 text-[18px] font-semibold text-slate-900">${records.length}</div>
            </div>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-[1760px] table-fixed">
            <thead class="bg-slate-50 text-left text-[13px] font-semibold text-slate-500">
              <tr>
                <th class="w-[132px] px-4 py-3">渠道商品编码</th>
                <th class="w-[176px] px-4 py-3">来源项目</th>
                <th class="w-[290px] px-4 py-3">来源商品上架实例</th>
                <th class="w-[255px] px-4 py-3">渠道 / 店铺</th>
                <th class="w-[118px] px-4 py-3">测款来源视角</th>
                <th class="w-[112px] px-4 py-3">渠道商品状态</th>
                <th class="w-[112px] px-4 py-3">上游更新状态</th>
                <th class="w-[152px] px-4 py-3">关联款式档案</th>
                <th class="w-[130px] px-4 py-3">关联上游编码</th>
                <th class="w-[260px] px-4 py-3">链路说明</th>
                <th class="w-[130px] px-4 py-3">更新时间</th>
                <th class="w-[110px] px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              ${records.map((record) => renderListRow(record)).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
}

export function renderPcsChannelProductDetailPage(channelProductId: string): string {
  const record = getProjectChannelProductById(channelProductId)

  if (!record) {
    return `
      <div class="p-4">
        <section class="rounded-[20px] border border-slate-200 bg-white px-6 py-8 shadow-sm">
          <h1 class="text-2xl font-semibold text-slate-900">未找到渠道店铺商品</h1>
          <p class="mt-3 text-sm text-slate-500">请返回列表重新选择。</p>
          <button type="button" class="mt-6 inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/channel-products">
            返回列表
          </button>
        </section>
      </div>
    `
  }

  const style = record.styleId ? getStyleArchiveById(record.styleId) : null
  const projectHref = `/pcs/projects/${encodeURIComponent(record.projectId)}`
  const styleHref = style ? `/pcs/products/styles/${encodeURIComponent(style.styleId)}` : null
  const completedUpstreamUpdate = record.upstreamSyncStatus === '已更新'
  const upstreamUpdateTime = record.lastUpstreamSyncAt || (completedUpstreamUpdate ? record.updatedAt : '')

  return `
    <div class="p-4">
      <div class="space-y-4">
        <section class="rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button type="button" class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/channel-products">
                <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
              </button>
              <div class="mt-3 text-xs text-slate-500">商品档案 / 渠道商品 / 项目测款来源</div>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <h1 class="text-[20px] font-semibold text-slate-900">${escapeHtml(record.channelProductCode)}</h1>
                ${renderBadge(getViewLabel(record), record.channelProductStatus === '已作废' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700')}
              </div>
              <div class="mt-2 text-sm text-slate-500">${escapeHtml(`${getChannelLabel(record.channelCode)} / ${getStoreLabel(record)} ｜ 渠道标题 ${record.listingTitle}`)}</div>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              ${renderDetailButton('查看来源项目', projectHref)}
              ${renderDetailButton('查看款式档案', styleHref)}
            </div>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-3">
          <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <h2 class="text-base font-semibold text-slate-900">来源与节点</h2>
            <div class="mt-4 space-y-3">
              ${renderDetailField('来源项目', record.projectCode)}
              ${renderDetailField('项目名称', record.projectName)}
              ${renderDetailField('来源商品上架实例', record.listingInstanceCode)}
              ${renderDetailField('来源工作项节点', record.projectNodeId)}
              ${renderDetailField('渠道 / 店铺', `${getChannelLabel(record.channelCode)} / ${getStoreLabel(record)}`)}
              ${renderDetailField('币种 / 售价', `${record.currency} / ${record.listingPrice}`)}
            </div>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <h2 class="text-base font-semibold text-slate-900">测款与作废状态</h2>
            <div class="mt-4 space-y-3">
              ${renderDetailField('当前测款状态', getLinkageDescription(record))}
              ${renderDetailField('渠道商品状态', record.channelProductStatus)}
              ${renderDetailField('是否已作废', record.channelProductStatus === '已作废' ? '是' : '否')}
              ${renderDetailField('作废原因', record.invalidatedReason || '—')}
              ${renderDetailField('关联改版任务', record.linkedRevisionTaskCode || '—')}
            </div>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <h2 class="text-base font-semibold text-slate-900">款式档案与上游更新</h2>
            <div class="mt-4 space-y-3">
              ${renderDetailField('款式档案编码', record.styleCode || '—')}
              ${renderDetailField('上游渠道商品编码', record.upstreamChannelProductCode || '—')}
              ${renderDetailField('上游更新状态', record.upstreamSyncStatus)}
              ${renderDetailField('是否已完成上游最终更新', completedUpstreamUpdate ? '是' : '否')}
              ${renderDetailField('最后一次上游更新时间', upstreamUpdateTime ? formatDateTime(upstreamUpdateTime) : '—')}
            </div>
          </section>
        </div>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <h2 class="text-base font-semibold text-slate-900">三码关联结果</h2>
          <div class="mt-4 grid gap-3 xl:grid-cols-3">
            ${renderCodeBox('款式档案编码', record.styleCode || '—')}
            ${renderCodeBox('渠道商品编码', record.channelProductCode)}
            ${renderCodeBox('上游渠道商品编码', record.upstreamChannelProductCode || '—')}
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <h2 class="text-base font-semibold text-slate-900">上游更新日志</h2>
          <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div class="text-sm font-semibold text-slate-900">${escapeHtml(record.upstreamSyncNote || record.upstreamSyncLog || '当前暂无上游更新日志。')}</div>
            <div class="mt-1.5 text-xs leading-5 text-slate-500">${escapeHtml(record.upstreamSyncLog || (upstreamUpdateTime ? `${formatDateTime(upstreamUpdateTime)} 记录当前状态。` : '尚未触发上游更新。'))}</div>
          </div>
        </section>
      </div>
    </div>
  `
}
