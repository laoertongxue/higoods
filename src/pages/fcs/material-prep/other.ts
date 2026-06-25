import { renderBadge } from '../../../components/ui/badge.ts'
import type { BadgeVariant } from '../../../components/ui/types.ts'
import {
  listMaterialPrepOrderProjections,
  classifyPrepLineType,
  pickMaterialPrepRecord,
  stageMaterialPrepRecord,
  confirmMaterialPrepRecord,
  getMaterialPrepRecordItems,
  materialPrepStatusLabelMap,
  materialPrepRecordStatusLabelMap,
  materialPrepWorkbenchTabs,
  type MaterialPrepOrderProjection,
  type MaterialPrepOrderStatus,
  type MaterialPrepLine,
  type MaterialPrepRecord,
  type MaterialPrepRecordStatus,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import { escapeHtml } from '../../../utils.ts'

const statusVariantMap: Record<string, BadgeVariant> = {
  NEED_PREP_NO_STOCK: 'warning',
  NEED_PREP_PARTIAL_STOCK: 'info',
  NEED_PREP_ALL_STOCK: 'success',
  REJECTED_REWORK: 'danger',
  READY: 'success',
  CLOSED: 'neutral',
}

const categoryLabel = '其他配料'
const pageBasePath = '/fcs/material-prep/other'

function filterOrders(): MaterialPrepOrderProjection[] {
  return listMaterialPrepOrderProjections().filter(p =>
    p.lines.some(l => classifyPrepLineType(l) === categoryLabel)
  )
}

function getSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function buildHref(params: Record<string, string | undefined>): string {
  const search = getSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
    else search.delete(key)
  })
  const query = search.toString()
  return `${pageBasePath}${query ? `?${query}` : ''}`
}

function buildDetailHref(prepOrderId: string, activeTab?: string): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', prepOrderId)
  if (activeTab) params.set('fromTab', activeTab)
  return `${pageBasePath}/detail?${params.toString()}`
}

function formatQty(value: number): string {
  return (Number(value || 0)).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function renderStatusBadge(status: string, label: string): string {
  return renderBadge(label, statusVariantMap[status] || 'neutral')
}

function renderImageThumb(imageUrl: string, label: string, className = 'h-12 w-12'): string {
  return `
    <div class="${escapeHtml(className)} overflow-hidden rounded-md border bg-muted">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}" class="h-full w-full object-cover" loading="lazy" />
    </div>
  `
}

function renderMaterialThumb(line: MaterialPrepLine): string {
  return renderImageThumb(line.materialImageUrl, line.materialName)
}

function renderSpuThumb(order: MaterialPrepOrderProjection['order'], className = 'h-14 w-14'): string {
  return `
    <div class="shrink-0">
      ${renderImageThumb(order.spuImageUrl, `${order.styleNo} / ${order.spu} 款式SPU图`, className)}
      <div class="mt-1 text-center text-[10px] text-muted-foreground">款式/SPU</div>
    </div>
  `
}

function renderKpi(label: string, value: number | string, desc: string): string {
  return `
    <div class="rounded-lg border bg-card px-4 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-2xl font-semibold">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(desc)}</div>
    </div>
  `
}

const legacyPrepStatusMap: Record<string, MaterialPrepOrderStatus> = {
  NEED_PREP: 'NEED_PREP_PARTIAL_STOCK',
  CONTINUE_PREP: 'NEED_PREP_PARTIAL_STOCK',
  SHORTAGE_TRACKING: 'NEED_PREP_NO_STOCK',
}

function normalizeMaterialPrepStatus(value: string | null | undefined): MaterialPrepOrderStatus {
  if (value && value in materialPrepStatusLabelMap) return value as MaterialPrepOrderStatus
  return legacyPrepStatusMap[value || ''] || 'NEED_PREP_NO_STOCK'
}

function renderTabs(rows: MaterialPrepOrderProjection[], activeTab: MaterialPrepOrderStatus): string {
  return `
    <div class="flex flex-wrap gap-2">
      ${materialPrepWorkbenchTabs.map((tab) => {
        const count = rows.filter((row) => row.order.overallPrepStatus === tab.key).length
        return `
          <button type="button" data-nav="${escapeHtml(buildHref({ tab: tab.key, prepOrderId: undefined, detailTab: undefined }))}" class="rounded-md border px-3 py-2 text-sm ${tab.key === activeTab ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}">
            ${escapeHtml(tab.label)} <span class="ml-1 text-xs opacity-80">${count}</span>
          </button>
        `
      }).join('')}
    </div>
  `
}

function renderLineTaskLinks(line: MaterialPrepLine): string {
  if (!line.taskLinks.length) return renderBadge('待分配', 'neutral')
  return `
    <div class="space-y-1">
      ${line.taskLinks.map((task) => `
        <div class="rounded-md border bg-background px-2 py-1">
          <div class="flex flex-wrap items-center gap-1">
            ${renderBadge(task.allocationStatus, task.allocationStatus === '已分配' ? 'success' : task.allocationStatus === '未分配' ? 'neutral' : 'neutral')}
            <span class="font-medium">${escapeHtml(task.taskNo)}</span>
          </div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskName)} / ${escapeHtml(task.factoryName)}</div>
        </div>
      `).join('')}
    </div>
  `
}

function renderNeedPrepState(line: MaterialPrepLine): string {
  if (line.linePrepStatus === '被打回') return renderBadge('需要重配', 'danger')
  if (line.linePrepStatus === '按实关闭') return renderBadge('后续不配', 'neutral')
  if (line.remainingNeedQty <= 0) return renderBadge('无需配料', 'success')
  if (line.availableStockQty <= 0) return renderBadge('无库存可配', 'warning')
  if (line.availableStockQty >= line.remainingNeedQty) return renderBadge('库存充足', 'success')
  return renderBadge('库存不足', 'info')
}

function renderPrepRecordStatusRow(record: MaterialPrepRecord): string {
  const statusClassMap: Record<MaterialPrepRecordStatus, string> = {
    DRAFT: 'border-l-slate-400 bg-slate-50/60',
    PICKED: 'border-l-blue-500 bg-blue-50/60',
    STAGED: 'border-l-amber-500 bg-amber-50/60',
    CONFIRMED: 'border-l-green-500 bg-green-50/60',
    REJECTED: 'border-l-rose-500 bg-rose-50/60',
  }
  const statusClass = statusClassMap[record.recordStatus] || statusClassMap.DRAFT
  const statusLabel = materialPrepRecordStatusLabelMap[record.recordStatus]

  const recordItems = getMaterialPrepRecordItems(record)
  const totalRollCount = recordItems.reduce((sum, item) => sum + Number(item.rollCount || 0), 0)

  return `
    <div class="rounded-md border border-l-4 ${statusClass} px-3 py-3 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium">${escapeHtml(record.batchNo)}</span>
            ${renderBadge(statusLabel, record.recordStatus === 'CONFIRMED' ? 'success' : record.recordStatus === 'REJECTED' ? 'danger' : record.recordStatus === 'STAGED' ? 'warning' : record.recordStatus === 'PICKED' ? 'info' : 'neutral')}
          </div>
          <div class="mt-1 text-xs text-muted-foreground">
            ${formatQty(record.preparedQty)} / ${record.rollCount} 卷 / ${escapeHtml(record.warehouseArea)} / ${escapeHtml(record.locationCode)}
          </div>
          <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(record.operatorName)} / ${escapeHtml(record.preparedAt)}</div>
          ${record.stagingArea ? `<div class="mt-0.5 text-xs text-muted-foreground">暂存区：${escapeHtml(record.stagingArea)}</div>` : ''}
          ${record.rejectReason ? `<div class="mt-1 text-xs text-rose-600">打回原因：${escapeHtml(record.rejectReason)}</div>` : ''}
          ${record.remark ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.remark)}</div>` : ''}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${renderPrepRecordActions(record)}
        </div>
      </div>
      ${recordItems.length > 1 ? `
        <div class="mt-3 border-t pt-2">
          <div class="text-xs font-medium text-muted-foreground">记录内物料明细（${recordItems.length} 行 / ${totalRollCount} 卷）</div>
          <div class="mt-2 grid gap-1">
            ${recordItems.map((item) => `
              <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>${escapeHtml(item.prepLineId)}</span>
                <span>${formatQty(item.preparedQty)}</span>
                <span>${item.rollCount} 卷</span>
                <span>${escapeHtml(item.warehouseArea || record.warehouseArea)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `
}

function renderPrepRecordActions(record: MaterialPrepRecord): string {
  const id = escapeHtml(record.prepRecordId)
  const rejectReason = escapeHtml(record.rejectReason || '')

  switch (record.recordStatus) {
    case 'DRAFT':
      return `<button type="button" data-fcs-material-prep-action="pick-record" data-prep-record-id="${id}" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">确认拣货</button>`
    case 'PICKED':
      return `<button type="button" data-fcs-material-prep-action="stage-record" data-prep-record-id="${id}" class="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white">确认入暂存区</button>`
    case 'STAGED':
      return `<button type="button" data-fcs-material-prep-action="confirm-record" data-prep-record-id="${id}" class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">确认配料完成</button>`
    case 'CONFIRMED':
      return `<span class="rounded-md bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">已确认，可加工领料</span>`
    case 'REJECTED':
      return `
        <span class="rounded-md bg-rose-50 px-3 py-1.5 text-xs text-rose-700">被打回</span>
        <button type="button" data-fcs-material-prep-action="stage-record" data-prep-record-id="${id}" class="rounded-md border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50">重新入暂存区</button>
      `
  }
}

function renderOrderMaterialRows(row: MaterialPrepOrderProjection): string {
  return `
    <div class="rounded-md border bg-background">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div class="text-sm font-medium">物料配料明细</div>
        <div class="text-xs text-muted-foreground">配料类型：${escapeHtml(categoryLabel)}</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1200px] text-left text-xs">
          <thead class="bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-3 py-2">图片</th>
              <th class="px-3 py-2">类别</th>
              <th class="px-3 py-2">物料</th>
              <th class="px-3 py-2">关联任务</th>
              <th class="px-3 py-2">需求</th>
              <th class="px-3 py-2">已配</th>
              <th class="px-3 py-2">已领</th>
              <th class="px-3 py-2">剩余未配</th>
              <th class="px-3 py-2">是否需要配料</th>
              <th class="px-3 py-2">上游进度</th>
            </tr>
          </thead>
          <tbody>
            ${row.lines.map((line) => `
              <tr class="border-t">
                <td class="px-3 py-2">${renderMaterialThumb(line)}</td>
                <td class="px-3 py-2">${renderBadge(line.materialType, line.materialType === '面料' ? 'info' : line.materialType === '辅料' ? 'warning' : line.materialType === '纱线' ? 'success' : 'neutral')}</td>
                <td class="px-3 py-2">
                  <div class="font-medium">${escapeHtml(line.materialSku)}</div>
                  <div class="mt-1 text-muted-foreground">${escapeHtml(line.materialName)} / ${escapeHtml(line.color)} / ${escapeHtml(line.spec)}</div>
                  <div class="mt-1 text-muted-foreground">裁片单：${escapeHtml(line.cutOrderNo)}</div>
                </td>
                <td class="px-3 py-2">${renderLineTaskLinks(line)}</td>
                <td class="px-3 py-2">${formatQty(line.requiredQty)} ${escapeHtml(line.unit)}</td>
                <td class="px-3 py-2">${formatQty(line.confirmedPrepQty)} ${escapeHtml(line.unit)}</td>
                <td class="px-3 py-2">${formatQty(line.pickedQty)} ${escapeHtml(line.unit)}</td>
                <td class="px-3 py-2">${formatQty(line.remainingNeedQty)} ${escapeHtml(line.unit)}</td>
                <td class="px-3 py-2">${renderNeedPrepState(line)}</td>
                <td class="px-3 py-2">
                  ${renderBadge(line.upstreamProgressStatus, line.upstreamProgressStatus === '已到仓可配' ? 'success' : line.upstreamProgressStatus === '无需跟进' ? 'neutral' : 'warning')}
                  <div class="mt-1 text-muted-foreground">${escapeHtml(line.upstreamProgressDetail)}</div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderOrderTable(rows: MaterialPrepOrderProjection[], activeTab: MaterialPrepOrderStatus): string {
  return `
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">${escapeHtml(categoryLabel)} 配料工作台</h2>
        <span class="text-xs text-muted-foreground">共 ${rows.length} 条配料单</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[960px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">生产单</th>
              <th class="px-3 py-2">款式 / SPU</th>
              <th class="px-3 py-2">配料进度</th>
              <th class="px-3 py-2">状态</th>
              <th class="px-3 py-2">物料行</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((row) => `
              <tr class="border-t hover:bg-muted/30">
                <td class="px-3 py-3 align-top">
                  <button type="button" data-fcs-material-prep-action="view-detail" data-prep-order-id="${escapeHtml(row.order.prepOrderId)}" class="font-medium text-blue-700 hover:underline">${escapeHtml(row.order.productionOrderNo)}</button>
                  <div class="mt-1 text-xs text-muted-foreground">配料单：${escapeHtml(row.order.prepOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">交期：${escapeHtml(row.order.deliveryDate)}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="flex items-start gap-3">
                    ${renderSpuThumb(row.order)}
                    <div>
                      <div class="font-medium">${escapeHtml(row.order.styleNo)} / ${escapeHtml(row.order.styleName)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.order.spu)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">计划 ${row.order.planQty.toLocaleString('zh-CN')} 件</div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-3 align-top">
                  ${renderStatusBadge(row.order.overallPrepStatus, materialPrepStatusLabelMap[row.order.overallPrepStatus])}
                  <div class="mt-2 text-xs text-muted-foreground">已确认 ${formatQty(row.totalConfirmedPrepQty)} / 需求 ${formatQty(row.totalRequiredQty)}</div>
                </td>
                <td class="px-3 py-3 align-top text-xs">
                  <div>物料行：${row.lineCount}</div>
                  <div>已配齐：${row.readyLineCount}</div>
                  <div>未配齐：${row.shortageLineCount}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  <button type="button" data-fcs-material-prep-action="view-detail" data-prep-order-id="${escapeHtml(row.order.prepOrderId)}" class="rounded-md border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50">查看详情</button>
                </td>
              </tr>
              <tr class="bg-muted/20">
                <td colspan="6" class="px-3 pb-4 pt-0">
                  ${renderOrderMaterialRows(row)}
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="6" class="px-3 py-8 text-center text-sm text-muted-foreground">当前状态下暂无${escapeHtml(categoryLabel)}配料单。</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderPrepRecords(projection: MaterialPrepOrderProjection): string {
  const records = projection.prepRecords
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">配料记录</h3>
      <div class="mt-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        配料记录按 DRAFT → PICKED → STAGED → CONFIRMED 流转；打回后可从 STAGED 重新确认；已确认的配料可被裁床领料；每条记录整体确认，记录内物料明细不单独确认。
      </div>
      <div class="mt-3 space-y-3">
        ${records.length ? records.map((record) => renderPrepRecordStatusRow(record)).join('') : '<div class="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">暂无配料记录。</div>'}
      </div>
    </section>
  `
}

function renderDetail(projection: MaterialPrepOrderProjection): string {
  return `
    <div class="space-y-4">
      ${renderPrepRecords(projection)}
      ${renderOrderMaterialRows(projection)}
    </div>
  `
}

function renderList(): string {
  const params = getSearchParams()
  const activeTab = normalizeMaterialPrepStatus(params.get('tab'))
  const allRows = filterOrders()
  const rows = allRows.filter((row) => row.order.overallPrepStatus === activeTab)

  return `
    <div class="space-y-5 p-6">
      <header>
        <div>
          <div class="text-sm text-muted-foreground">生产协同系统 / 配料管理</div>
          <h1 class="mt-1 text-2xl font-bold">其他配料（包材）</h1>
          <p class="mt-2 text-sm text-muted-foreground">按生产单组织${escapeHtml(categoryLabel)}配料，让配料人员知道哪些无库存可配、哪些部分有库存可配、哪些全部都有充足库存、哪些被打回重配、哪些已配齐。</p>
        </div>
      </header>

      ${renderTabs(allRows, activeTab)}
      ${renderOrderTable(rows, activeTab)}
    </div>
  `
}

function renderDetailPage(): string {
  const params = getSearchParams()
  const allRows = filterOrders()
  const prepOrderId = params.get('prepOrderId') || allRows[0]?.order.prepOrderId || ''
  const projection = allRows.find((row) => row.order.prepOrderId === prepOrderId) || allRows[0]
  const backTab = normalizeMaterialPrepStatus(params.get('fromTab') || projection?.order.overallPrepStatus)
  const backHref = buildHref({ tab: backTab, prepOrderId: undefined, detailTab: undefined })

  if (!projection) {
    return `
      <div class="space-y-5 p-6">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-sm text-muted-foreground">生产协同系统 / 配料管理 / 其他配料（包材）</div>
            <h1 class="mt-1 text-2xl font-bold">配料详情</h1>
          </div>
          <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(backHref)}">返回配料列表</button>
        </header>
        <section class="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">未找到配料单。</section>
      </div>
    `
  }

  return `
    <div class="space-y-5 p-6">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-sm text-muted-foreground">生产协同系统 / 配料管理 / 其他配料（包材）</div>
          <h1 class="mt-1 text-2xl font-bold">配料详情</h1>
          <p class="mt-2 text-sm text-muted-foreground">生产单 ${escapeHtml(projection.order.productionOrderNo)} / 配料单 ${escapeHtml(projection.order.prepOrderNo)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(backHref)}">返回配料列表</button>
        </div>
      </header>

      <section class="grid gap-3 md:grid-cols-4">
        ${renderKpi('配料状态', materialPrepStatusLabelMap[projection.order.overallPrepStatus], `已确认 ${formatQty(projection.totalConfirmedPrepQty)} / 需求 ${formatQty(projection.totalRequiredQty)}`)}
        ${renderKpi('领料状态', projection.order.pickupStatus === 'WAIT_PICKUP' ? '待领料' : projection.order.pickupStatus === 'PICKUP_DONE' ? '已领料完结' : projection.order.pickupStatus === 'ACTUAL_CLOSED' ? '按实完结' : '暂不可领', `已领 ${formatQty(projection.totalPickedQty)} / 可领 ${formatQty(projection.totalAvailableToPickupQty)}`)}
        ${renderKpi('物料行', `${projection.readyLineCount}/${projection.lineCount} 已配齐`, `未配齐 ${projection.shortageLineCount} 行，库存充足 ${projection.stockSufficientLineCount} 行，库存不足 ${projection.stockInsufficientLineCount} 行，无库存 ${projection.noStockLineCount} 行`)}
        ${renderKpi('缺料缺口', formatQty(projection.totalShortageQty), `最早可配 ${escapeHtml(projection.earliestExpectedAvailableAt || '暂无')}`)}
      </section>

      ${renderDetail(projection)}
    </div>
  `
}

export function renderFcsOtherPrepPage(): string {
  const params = getSearchParams()
  const prepOrderId = params.get('prepOrderId')
  if (prepOrderId) return renderDetailPage()
  return renderList()
}

export function handleFcsOtherPrepEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-fcs-material-prep-action]')
  const action = actionNode?.dataset.fcsMaterialPrepAction
  if (!actionNode || !action) return false

  if (action === 'view-detail') {
    const prepOrderId = actionNode.dataset.prepOrderId || ''
    if (!prepOrderId) return false
    const href = buildDetailHref(prepOrderId)
    window.history.pushState({}, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  if (action === 'pick-record') {
    const prepRecordId = actionNode.dataset.prepRecordId || ''
    if (!prepRecordId) return false
    pickMaterialPrepRecord(prepRecordId, '仓库 张三')
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  if (action === 'stage-record') {
    const prepRecordId = actionNode.dataset.prepRecordId || ''
    if (!prepRecordId) return false
    const area = window.prompt('请输入暂存区域名称：', '中转仓暂存区 A')
    if (area === null) return true
    stageMaterialPrepRecord(prepRecordId, area || '中转仓暂存区', '配料小组 周敏')
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  if (action === 'confirm-record') {
    const prepRecordId = actionNode.dataset.prepRecordId || ''
    if (!prepRecordId) return false
    confirmMaterialPrepRecord(prepRecordId, '配料小组 周敏')
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  return false
}
