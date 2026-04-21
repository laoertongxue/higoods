import {
  getProjectChannelProductById,
  listProjectChannelProducts,
  type ProjectChannelProductRecord,
} from '../data/pcs-channel-product-project-repository.ts'
import {
  CHANNEL_PRODUCT_STATUS_RULES,
  resolveChannelProductBusinessStatus,
} from '../data/pcs-product-lifecycle-governance.ts'
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
  if (channelCode === 'wechat-mini-program') return '微信小程序'
  if (channelCode === 'lazada') return 'Lazada'
  return 'TikTok Shop'
}

function getStoreLabel(record: ProjectChannelProductRecord): string {
  if (record.storeId === 'store-shopee-01') return '虾皮马来西亚店'
  if (record.storeId === 'store-mini-program-01') return '微信小程序商城'
  if (record.storeId === 'store-lazada-01') return 'Lazada 菲律宾店'
  if (record.storeId === 'store-tiktok-01') return '抖音商城旗舰店'
  return record.storeName || '-'
}

function getViewLabel(record: ProjectChannelProductRecord): string {
  return CHANNEL_PRODUCT_STATUS_RULES[resolveChannelProductBusinessStatus(record)].label
}

function getLinkageDescription(record: ProjectChannelProductRecord): string {
  if (record.channelProductStatus === '已作废') {
    return record.testingStatusText || record.invalidatedReason || record.upstreamSyncNote || '当前款式上架批次已作废'
  }
  if (record.styleCode && record.upstreamSyncStatus === '已更新') {
    return '测款通过，已关联款式档案并完成上游最终更新'
  }
  if (record.styleCode && record.upstreamSyncStatus === '待更新') {
    return '测款通过，已生成款式档案，待启用技术包'
  }
  if (record.channelProductStatus === '已上架待测款') {
    return '已完成上架，等待直播或短视频正式测款'
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
  if (status === '已上传待确认') return renderBadge(status, 'bg-amber-100 text-amber-700')
  return renderBadge(status, 'bg-slate-100 text-slate-600')
}

function renderBusinessStatusBadge(record: ProjectChannelProductRecord): string {
  const rule = CHANNEL_PRODUCT_STATUS_RULES[resolveChannelProductBusinessStatus(record)]
  return renderBadge(rule.label, rule.className)
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

function renderSpecLineSummary(record: ProjectChannelProductRecord): string {
  return `
    <div class="space-y-1">
      <div class="text-[15px] font-medium leading-6 text-slate-900">${escapeHtml(String(record.specLineCount || record.specLines.length || 0))} 条</div>
      <div class="text-xs leading-5 text-slate-500">已上传 ${escapeHtml(String(record.uploadedSpecLineCount || 0))} 条</div>
    </div>
  `
}

function getListingMainImage(record: ProjectChannelProductRecord): {
  url: string
  title: string
} | null {
  const mainImage =
    record.listingImages.find((item) => item.imageId === record.listingMainImageId) ||
    record.listingImages[0] ||
    null
  if (mainImage) {
    return {
      url: mainImage.imageUrl,
      title: mainImage.imageName,
    }
  }
  if (record.mainImageUrls[0]) {
    return {
      url: record.mainImageUrls[0],
      title: '上架主图',
    }
  }
  return null
}

function renderListRow(record: ProjectChannelProductRecord): string {
  const detailHref = `/pcs/products/channel-products/${encodeURIComponent(record.channelProductId)}`
  const projectHref = `/pcs/projects/${encodeURIComponent(record.projectId)}`
  const mainImage = getListingMainImage(record)

  return `
    <tr class="border-t border-slate-200 align-top">
      <td class="px-4 py-4 text-[15px] font-semibold text-slate-900">${escapeHtml(record.channelProductCode)}</td>
      <td class="px-4 py-4">
        <button type="button" class="text-left text-[15px] font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(projectHref)}">${escapeHtml(record.projectCode)}</button>
        <div class="mt-1 max-w-[156px] text-xs leading-5 text-slate-500">${escapeHtml(record.projectName)}</div>
      </td>
      <td class="px-4 py-4">
        <div class="text-[15px] font-medium leading-6 text-slate-900">${escapeHtml(record.listingBatchCode || record.channelProductCode)}</div>
        <div class="mt-1 text-xs leading-5 text-slate-500">${escapeHtml(record.listingInstanceCode || '-')}</div>
      </td>
      <td class="px-4 py-4 text-[15px] leading-6 text-slate-900">${escapeHtml(`${getChannelLabel(record.channelCode)} / ${getStoreLabel(record)}`)}</td>
      <td class="px-4 py-4">
        <div class="max-w-[220px] text-[15px] leading-6 text-slate-900">${escapeHtml(record.styleListingTitle || record.listingTitle || '-')}</div>
      </td>
      <td class="px-4 py-4">
        ${
          mainImage
            ? `<button type="button" class="group block h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-50" data-nav="${escapeHtml(detailHref)}"><img src="${escapeHtml(mainImage.url)}" alt="${escapeHtml(mainImage.title)}" class="h-full w-full object-cover transition group-hover:scale-105" /></button>`
            : '<div class="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[11px] text-slate-400">暂无主图</div>'
        }
      </td>
      <td class="px-4 py-4">${renderSpecLineSummary(record)}</td>
      <td class="px-4 py-4">${renderBusinessStatusBadge(record)}</td>
      <td class="px-4 py-4 text-[15px] leading-6 text-slate-900">${escapeHtml(record.upstreamProductId || record.upstreamChannelProductCode || '-')}</td>
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

function renderDetailButton(label: string, href: string | null): string {
  if (!href) {
    return `<button type="button" class="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-300" disabled>${escapeHtml(label)}</button>`
  }
  return `<button type="button" class="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(href)}">${escapeHtml(label)}</button>`
}

function renderSpecLineRows(record: ProjectChannelProductRecord): string {
  if (!record.specLines.length) {
    return '<tr><td colspan="9" class="px-3 py-4 text-center text-xs text-slate-400">暂无规格明细</td></tr>'
  }
  return record.specLines
    .map(
      (line) => `
        <tr>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.colorName || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.sizeName || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.printName || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.sellerSku || line.specLineCode || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(String(line.priceAmount || '-'))}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.currencyCode || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.stockQty ? String(line.stockQty) : '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.upstreamSkuId || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.lineStatus || '-')}</td>
        </tr>
      `,
    )
    .join('')
}

export function renderPcsChannelProductListPage(): string {
  const records = listDisplayRecords()

  return `
    <div class="p-4">
      <section class="rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-5 py-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-[22px] font-semibold text-slate-900">渠道商品上架批次</h1>
              <p class="mt-1 text-sm text-slate-500">按项目渠道上架批次查看款式、店铺、规格明细与上游回填结果。</p>
            </div>
            <div class="rounded-xl bg-slate-50 px-3 py-2 text-right">
              <div class="text-xs text-slate-500">当前记录</div>
              <div class="mt-1 text-[18px] font-semibold text-slate-900">${records.length}</div>
            </div>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-[1600px] table-fixed">
            <thead class="bg-slate-50 text-left text-[13px] font-semibold text-slate-500">
              <tr>
                <th class="w-[132px] px-4 py-3">批次编码</th>
                <th class="w-[176px] px-4 py-3">来源项目</th>
                <th class="w-[220px] px-4 py-3">来源商品上架批次</th>
                <th class="w-[235px] px-4 py-3">渠道 / 店铺</th>
              <th class="w-[220px] px-4 py-3">上架标题</th>
                <th class="w-[110px] px-4 py-3">上架主图</th>
                <th class="w-[132px] px-4 py-3">规格数量</th>
                <th class="w-[120px] px-4 py-3">上架状态</th>
                <th class="w-[160px] px-4 py-3">上游款式商品编号</th>
                <th class="w-[260px] px-4 py-3">链路状态</th>
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
          <h1 class="text-2xl font-semibold text-slate-900">未找到渠道商品上架批次</h1>
          <p class="mt-3 text-sm text-slate-500">请返回列表重新选择。</p>
          <button type="button" class="mt-6 inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/channel-products">
            返回列表
          </button>
        </section>
      </div>
    `
  }

  const projectHref = `/pcs/projects/${encodeURIComponent(record.projectId)}`
  const styleHref = record.styleId ? `/pcs/products/styles/${encodeURIComponent(record.styleId)}` : null
  const completedUpstreamUpdate = record.upstreamSyncStatus === '已更新'
  const upstreamUpdateTime = record.lastUpstreamSyncAt || (completedUpstreamUpdate ? record.updatedAt : '')
  const currentRule = CHANNEL_PRODUCT_STATUS_RULES[resolveChannelProductBusinessStatus(record)]
  const listingImages = record.listingImages
    .slice()
    .sort((left, right) => left.sortNo - right.sortNo)

  return `
    <div class="p-4">
      <div class="space-y-4">
        <section class="rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button type="button" class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/channel-products">
                <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
              </button>
              <div class="mt-3 text-xs text-slate-500">商品档案 / 渠道商品上架批次</div>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <h1 class="text-[20px] font-semibold text-slate-900">${escapeHtml(record.listingBatchCode || record.channelProductCode)}</h1>
                ${renderBusinessStatusBadge(record)}
              </div>
              <div class="mt-2 text-sm text-slate-500">${escapeHtml(`${getChannelLabel(record.channelCode)} / ${getStoreLabel(record)} ｜ ${record.styleListingTitle || record.listingTitle || '-'}`)}</div>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              ${renderDetailButton('查看来源项目', projectHref)}
              ${renderDetailButton('查看款式档案', styleHref)}
            </div>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-3">
          <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <h2 class="text-base font-semibold text-slate-900">来源与上架信息</h2>
            <div class="mt-4 space-y-3">
              ${renderDetailField('来源项目', record.projectCode)}
              ${renderDetailField('项目名称', record.projectName)}
              ${renderDetailField('来源商品上架批次', record.listingInstanceCode || record.channelProductCode)}
              ${renderDetailField('来源工作项节点', record.projectNodeId)}
              ${renderDetailField('渠道 / 店铺', `${getChannelLabel(record.channelCode)} / ${getStoreLabel(record)}`)}
              ${renderDetailField('上架标题', record.styleListingTitle || record.listingTitle || '—')}
              ${renderDetailField('默认售价 / 币种', `${record.defaultPriceAmount || record.listingPrice || '—'} / ${record.currencyCode || record.currency || '—'}`)}
            </div>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <h2 class="text-base font-semibold text-slate-900">规格上传结果</h2>
            <div class="mt-4 space-y-3">
              ${renderDetailField('规格数量', String(record.specLineCount || record.specLines.length || 0))}
              ${renderDetailField('已上传规格数量', String(record.uploadedSpecLineCount || 0))}
              ${renderDetailField('上架批次状态', record.listingBatchStatus || record.channelProductStatus)}
              ${renderDetailField('上游款式商品编号', record.upstreamProductId || record.upstreamChannelProductCode || '—')}
              ${renderDetailField('上传结果', record.uploadResultText || '—')}
              ${renderDetailField('上传时间', record.uploadedAt ? formatDateTime(record.uploadedAt) : '—')}
            </div>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <h2 class="text-base font-semibold text-slate-900">测款与链路状态</h2>
            <div class="mt-4 space-y-3">
              ${renderDetailField('当前测款状态', getLinkageDescription(record))}
              ${renderDetailField('渠道商品状态', record.channelProductStatus)}
              ${renderDetailField('是否已作废', record.channelProductStatus === '已作废' ? '是' : '否')}
              ${renderDetailField('作废原因', record.invalidatedReason || '—')}
              ${renderDetailField('关联改版任务', record.linkedRevisionTaskCode || '—')}
            </div>
          </section>
        </div>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <div class="grid gap-4 xl:grid-cols-[1.3fr,1fr]">
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div class="flex flex-wrap items-center gap-2">
                ${renderBusinessStatusBadge(record)}
                <span class="text-sm text-slate-500">当前正式业务状态</span>
              </div>
              <div class="mt-3 text-sm leading-6 text-slate-700">${escapeHtml(currentRule.scene)}</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div class="text-sm font-medium text-slate-900">当前可操作项</div>
              <div class="mt-3 flex flex-wrap gap-2">
                ${currentRule.operations.map((item) => renderBadge(item, 'bg-white text-slate-700')).join('')}
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <h2 class="text-base font-semibold text-slate-900">上架图片</h2>
          <div class="mt-4">
            ${
              listingImages.length > 0
                ? `<div class="flex flex-wrap gap-3">
                    ${listingImages
                      .map(
                        (image) => `
                          <div class="w-24">
                            <div class="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                              <img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageName)}" class="h-24 w-24 object-cover" />
                              ${image.imageId === record.listingMainImageId ? '<span class="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">主图</span>' : ''}
                            </div>
                            <div class="mt-1 text-[11px] text-slate-500">${escapeHtml(image.imageName)}</div>
                            <div class="text-[11px] text-slate-400">排序 ${escapeHtml(String(image.sortNo))}</div>
                          </div>
                        `,
                      )
                      .join('')}
                  </div>`
                : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">暂无上架图片</div>'
            }
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <h2 class="text-base font-semibold text-slate-900">规格明细</h2>
          <div class="mt-4 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th class="px-3 py-2 font-medium">颜色</th>
                  <th class="px-3 py-2 font-medium">尺码</th>
                  <th class="px-3 py-2 font-medium">花型</th>
                  <th class="px-3 py-2 font-medium">平台销售 SKU</th>
                  <th class="px-3 py-2 font-medium">价格</th>
                  <th class="px-3 py-2 font-medium">币种</th>
                  <th class="px-3 py-2 font-medium">初始库存</th>
                  <th class="px-3 py-2 font-medium">上游规格编号</th>
                  <th class="px-3 py-2 font-medium">状态</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 bg-white">
                ${renderSpecLineRows(record)}
              </tbody>
            </table>
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <h2 class="text-base font-semibold text-slate-900">上游更新日志</h2>
          <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div class="text-sm font-semibold text-slate-900">${escapeHtml(record.upstreamSyncNote || record.upstreamSyncLog || '当前暂无上游更新日志。')}</div>
            <div class="mt-1.5 text-xs leading-5 text-slate-500">${escapeHtml(record.upstreamSyncLog || (upstreamUpdateTime ? `${formatDateTime(upstreamUpdateTime)} 记录当前状态。` : '尚未触发上游更新。'))}</div>
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <h2 class="text-base font-semibold text-slate-900">关联对象</h2>
          <div class="mt-4 grid gap-3 xl:grid-cols-4">
            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div class="text-sm text-slate-500">款式档案编码</div>
              <div class="mt-1.5 text-base font-semibold text-slate-900">${escapeHtml(record.styleCode || '—')}</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div class="text-sm text-slate-500">渠道商品批次编码</div>
              <div class="mt-1.5 text-base font-semibold text-slate-900">${escapeHtml(record.channelProductCode)}</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div class="text-sm text-slate-500">上游款式商品编号</div>
              <div class="mt-1.5 text-base font-semibold text-slate-900">${escapeHtml(record.upstreamProductId || record.upstreamChannelProductCode || '—')}</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div class="text-sm text-slate-500">最后一次上游更新时间</div>
              <div class="mt-1.5 text-base font-semibold text-slate-900">${escapeHtml(upstreamUpdateTime ? formatDateTime(upstreamUpdateTime) : '—')}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `
}
