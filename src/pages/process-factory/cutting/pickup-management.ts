import { renderBadge } from '../../../components/ui/badge.ts'
import type { BadgeVariant } from '../../../components/ui/types.ts'
import {
  getMaterialPrepRecordContext,
  listMaterialPrepOrderProjections,
  listPickupCandidates,
  pickupStatusLabelMap,
  pickupWorkbenchTabs,
  type MaterialPrepOrderProjection,
  type PickupOrderStatus,
  type PrepRecordPickupCandidate,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import { escapeHtml } from '../../../utils.ts'
import { getCanonicalCuttingMeta, renderCuttingPageHeader } from './meta.ts'

const statusVariantMap: Record<string, BadgeVariant> = {
  WAIT_PICKUP: 'warning',
  PARTIAL_PICKABLE: 'info',
  WAIT_CONTINUE_PICKUP: 'warning',
  REJECTED_WAIT_WLS: 'danger',
  PICKUP_DONE: 'success',
  ACTUAL_CLOSED: 'neutral',
  NOT_PICKABLE: 'neutral',
  NEED_PREP: 'warning',
  CONTINUE_PREP: 'info',
  SHORTAGE_TRACKING: 'warning',
  REJECTED_REWORK: 'danger',
  READY: 'success',
  CLOSED: 'neutral',
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
  return `/fcs/craft/cutting/pickup-management${query ? `?${query}` : ''}`
}

function buildDetailHref(prepOrderId: string, activeTab?: string, prepRecordId?: string, prepLineId?: string): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', prepOrderId)
  if (activeTab) params.set('fromTab', activeTab)
  if (prepRecordId) params.set('prepRecordId', prepRecordId)
  if (prepLineId) params.set('prepLineId', prepLineId)
  return `/fcs/craft/cutting/pickup-management-detail?${params.toString()}`
}

function formatQty(value: number, unit = '米'): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function renderStatus(status: string, label: string): string {
  return renderBadge(label, statusVariantMap[status] || 'neutral')
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

function renderTabs(rows: MaterialPrepOrderProjection[], activeTab: PickupOrderStatus): string {
  return `
    <div class="flex flex-wrap gap-2">
      ${pickupWorkbenchTabs.map((tab) => {
        const count = rows.filter((row) => row.order.pickupStatus === tab.key).length
        return `
          <button type="button" data-nav="${escapeHtml(buildHref({ tab: tab.key, prepOrderId: undefined, prepRecordId: undefined }))}" class="rounded-md border px-3 py-2 text-sm ${tab.key === activeTab ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}">
            ${escapeHtml(tab.label)} <span class="ml-1 text-xs opacity-80">${count}</span>
          </button>
        `
      }).join('')}
    </div>
  `
}

function buildWaitProcessClaimHref(candidate: PrepRecordPickupCandidate): string {
  const params = new URLSearchParams({
    tab: 'claimRecords',
    warehouseAction: 'claim',
    prepRecordId: candidate.prepRecordId,
    prepOrderId: candidate.prepOrderId,
    prepLineId: candidate.prepLineId,
    cutOrderId: candidate.cutOrderId,
  })
  return `/fcs/craft/cutting/warehouse-management/wait-process?${params.toString()}`
}

function renderOrderTable(rows: MaterialPrepOrderProjection[], candidates: PrepRecordPickupCandidate[], activeTab: PickupOrderStatus): string {
  const candidateByOrder = candidates.reduce<Record<string, PrepRecordPickupCandidate[]>>((accumulator, candidate) => {
    accumulator[candidate.prepOrderId] = accumulator[candidate.prepOrderId] || []
    accumulator[candidate.prepOrderId].push(candidate)
    return accumulator
  }, {})

  return `
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">领料工作台</h2>
        <span class="text-xs text-muted-foreground">列表只展示领料对象；可领记录、打回和明细进入详情页处理。</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">生产单</th>
              <th class="px-3 py-2">款式 / 物料概况</th>
              <th class="px-3 py-2">领料状态</th>
              <th class="px-3 py-2">可领 / 已领 / 缺料</th>
              <th class="px-3 py-2">待加工仓入库</th>
              <th class="px-3 py-2">最近动作</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((row) => {
              const rowCandidates = candidateByOrder[row.order.prepOrderId] || []
              const firstCandidate = rowCandidates[0]
              return `
                <tr class="border-t">
                  <td class="px-3 py-3 align-top">
                    <button type="button" data-nav="${escapeHtml(buildDetailHref(row.order.prepOrderId, activeTab, firstCandidate?.prepRecordId, firstCandidate?.prepLineId))}" class="font-medium text-blue-700 hover:underline">${escapeHtml(row.order.productionOrderNo)}</button>
                    <div class="mt-1 text-xs text-muted-foreground">配料单：${escapeHtml(row.order.prepOrderNo)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">交期：${escapeHtml(row.order.deliveryDate)}</div>
                  </td>
                  <td class="px-3 py-3 align-top">
                    <div class="font-medium">${escapeHtml(row.order.styleNo)} / ${escapeHtml(row.order.styleName)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.order.spu)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">物料 ${row.lineCount} 行，已配齐 ${row.readyLineCount} 行</div>
                  </td>
                  <td class="px-3 py-3 align-top">
                    ${renderStatus(row.order.pickupStatus, pickupStatusLabelMap[row.order.pickupStatus])}
                    ${row.order.isClosed ? `<div class="mt-2 text-xs text-slate-600">配料端已关闭，业务含义为后续不再配。</div>` : ''}
                  </td>
                  <td class="px-3 py-3 align-top text-xs">
                    <div>可领：${formatQty(row.totalAvailableToPickupQty)}</div>
                    <div>已领：${formatQty(row.totalPickedQty)}</div>
                    <div>缺料：${formatQty(row.totalShortageQty)}</div>
                  </td>
                  <td class="px-3 py-3 align-top text-xs">
                    ${row.pickupRecords.length ? row.pickupRecords.slice(0, 2).map((record) => `<div>${escapeHtml(record.warehouseArea)} / ${escapeHtml(record.locationCode)} / ${formatQty(record.pickedQty)}</div>`).join('') : '暂无入库'}
                  </td>
                  <td class="px-3 py-3 align-top text-xs">
                    <div>${escapeHtml(row.latestOperatorName)}</div>
                    <div class="mt-1 text-muted-foreground">${escapeHtml(row.latestOperatedAt || row.order.createdAt)}</div>
                  </td>
                  <td class="px-3 py-3 align-top">
                    <div class="flex flex-col gap-2">
                      ${firstCandidate ? `<button type="button" data-nav="${escapeHtml(buildWaitProcessClaimHref(firstCandidate))}" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">去待加工仓领料</button>` : ''}
                      <button type="button" data-nav="${escapeHtml(buildDetailHref(row.order.prepOrderId, activeTab, firstCandidate?.prepRecordId, firstCandidate?.prepLineId))}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">查看详情</button>
                      <button type="button" data-nav="${escapeHtml(`/wls/transfer-warehouse/material-prep-detail?prepOrderId=${row.order.prepOrderId}`)}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">查看配料单</button>
                    </div>
                  </td>
                </tr>
              `
            }).join('') : `
              <tr>
                <td colspan="7" class="px-3 py-8 text-center text-sm text-muted-foreground">当前状态下暂无领料单。</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderCandidateList(candidates: PrepRecordPickupCandidate[]): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">可领配料记录</h3>
      <div class="mt-3 grid gap-3 lg:grid-cols-2">
        ${candidates.length ? candidates.map((candidate) => `
          <article class="rounded-md border p-3 text-sm">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="font-medium">${escapeHtml(candidate.materialSku)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(candidate.materialName)} / ${escapeHtml(candidate.color)} / ${escapeHtml(candidate.cutOrderNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">配料记录：${escapeHtml(candidate.prepRecordId)} / 明细：${escapeHtml(candidate.prepRecordItemId)}</div>
              </div>
              ${renderBadge('已确认可领', 'success')}
            </div>
            <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div><div class="text-muted-foreground">配料数量</div><div class="font-medium">${formatQty(candidate.preparedQty, candidate.unit)}</div></div>
              <div><div class="text-muted-foreground">已领数量</div><div class="font-medium">${formatQty(candidate.pickedQty, candidate.unit)}</div></div>
              <div><div class="text-muted-foreground">本次可领</div><div class="font-medium">${formatQty(candidate.availableToPickupQty, candidate.unit)}</div></div>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" data-nav="${escapeHtml(buildWaitProcessClaimHref(candidate))}" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">去待加工仓领料</button>
              <button type="button" data-nav="${escapeHtml(buildDetailHref(candidate.prepOrderId, undefined, candidate.prepRecordId, candidate.prepLineId))}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">打回/查看</button>
            </div>
          </article>
        `).join('') : '<div class="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">当前页签下暂无可领配料记录。</div>'}
      </div>
    </section>
  `
}

function renderRejectPanel(prepRecordId: string, prepLineId = ''): string {
  const context = prepRecordId ? getMaterialPrepRecordContext(prepRecordId, prepLineId) : null
  if (!context) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-base font-semibold">打回配料记录</h3>
        <div class="mt-2 text-sm text-muted-foreground">选择一条已确认配料记录后，可在这里填写打回原因并退回中转仓重新配料。</div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">打回配料记录</h3>
      <div class="mt-3 rounded-md border bg-muted/20 p-3 text-sm">
        <div class="font-medium">${escapeHtml(context.record.batchNo)} / ${escapeHtml(context.record.prepRecordId)}</div>
        <div class="mt-1 text-xs text-muted-foreground">当前查看记录内物料：${escapeHtml(context.line.materialSku)} / ${escapeHtml(context.line.materialName)}。</div>
        <div class="mt-1 text-xs text-muted-foreground">打回对象是整条配料记录，不是记录内某一物料。打回后该记录变为未确认/待重配，不影响同配料单其他记录。</div>
      </div>
      <div class="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">打回原因（必填）</span>
          <select class="mt-1 h-10 w-full rounded-md border px-3 text-sm">
            <option>色号不符</option>
            <option>数量与配料记录不一致</option>
            <option>卷号/库位无法核对</option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">详细说明（必填）</span>
          <input class="mt-1 h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(context.record.rejectReason || '请仓库复核后重新确认配料')}" />
        </label>
        <div class="flex items-end">
          <button type="button" class="h-10 rounded-md border border-rose-200 px-4 text-sm font-medium text-rose-700 hover:bg-rose-50">打回中转仓</button>
        </div>
      </div>
    </section>
  `
}

function renderOrderDetail(projection: MaterialPrepOrderProjection | null): string {
  if (!projection) return ''
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">领料详情</h3>
      <div class="mt-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-5">
        <div><div class="text-xs text-muted-foreground">生产单</div><div class="font-medium">${escapeHtml(projection.order.productionOrderNo)}</div></div>
        <div><div class="text-xs text-muted-foreground">配料单</div><div class="font-medium">${escapeHtml(projection.order.prepOrderNo)}</div></div>
        <div><div class="text-xs text-muted-foreground">已确认可领</div><div class="font-medium">${formatQty(projection.totalAvailableToPickupQty)}</div></div>
        <div><div class="text-xs text-muted-foreground">已领料</div><div class="font-medium">${formatQty(projection.totalPickedQty)}</div></div>
        <div><div class="text-xs text-muted-foreground">缺料</div><div class="font-medium">${formatQty(projection.totalShortageQty)}</div></div>
      </div>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[920px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">物料</th>
              <th class="px-3 py-2">需求</th>
              <th class="px-3 py-2">已确认配料</th>
              <th class="px-3 py-2">已领</th>
              <th class="px-3 py-2">缺料进度</th>
            </tr>
          </thead>
          <tbody>
            ${projection.lines.map((line) => `
              <tr class="border-t">
                <td class="px-3 py-3">
                  <div class="font-medium">${escapeHtml(line.materialSku)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialName)} / ${escapeHtml(line.color)}</div>
                </td>
                <td class="px-3 py-3">${formatQty(line.requiredQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.confirmedPrepQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.pickedQty, line.unit)}</td>
                <td class="px-3 py-3">
                  ${renderBadge(line.upstreamProgressStatus, line.upstreamProgressStatus === '已到仓可配' ? 'success' : line.upstreamProgressStatus === '无需跟进' ? 'neutral' : 'warning')}
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.upstreamProgressDetail)}</div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

export function renderCraftCuttingPickupManagementPage(): string {
  const params = getSearchParams()
  const activeTab = (params.get('tab') || 'WAIT_PICKUP') as PickupOrderStatus
  const allRows = listMaterialPrepOrderProjections()
  const rows = allRows.filter((row) => row.order.pickupStatus === activeTab)
  const candidates = listPickupCandidates()
  const counts = pickupWorkbenchTabs.reduce<Record<string, number>>((accumulator, tab) => {
    accumulator[tab.key] = allRows.filter((row) => row.order.pickupStatus === tab.key).length
    return accumulator
  }, {})

  return `
    <div class="space-y-5 p-6">
      ${renderCuttingPageHeader(getCanonicalCuttingMeta('pickup-management'))}
      <section class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        ${renderKpi('待领料', counts.WAIT_PICKUP || 0, '配料已确认待领取')}
        ${renderKpi('可部分领料', counts.PARTIAL_PICKABLE || 0, '未配齐但已有可领')}
        ${renderKpi('待继续领料', counts.WAIT_CONTINUE_PICKUP || 0, '当前可领已领完')}
        ${renderKpi('打回待仓库处理', counts.REJECTED_WAIT_WLS || 0, '已打回中转仓')}
        ${renderKpi('已领料完结', counts.PICKUP_DONE || 0, '已配齐且已领完')}
        ${renderKpi('按实完结', counts.ACTUAL_CLOSED || 0, '配料端关闭后按实结束')}
      </section>
      ${renderTabs(allRows, activeTab)}
      ${renderOrderTable(rows, candidates, activeTab)}
    </div>
  `
}

export function renderCraftCuttingPickupManagementDetailPage(): string {
  const params = getSearchParams()
  const allRows = listMaterialPrepOrderProjections()
  const activeOrderId = params.get('prepOrderId') || allRows.find((row) => row.order.pickupStatus === 'WAIT_PICKUP')?.order.prepOrderId || allRows[0]?.order.prepOrderId || ''
  const activeProjection = allRows.find((row) => row.order.prepOrderId === activeOrderId) || allRows[0] || null
  const candidates = listPickupCandidates().filter((candidate) => candidate.prepOrderId === activeOrderId)
  const activePrepRecordId = params.get('prepRecordId') || candidates[0]?.prepRecordId || activeProjection?.prepRecords.find((record) => record.recordStatus === 'CONFIRMED')?.prepRecordId || ''
  const activePrepLineId = params.get('prepLineId') || candidates.find((candidate) => candidate.prepRecordId === activePrepRecordId)?.prepLineId || ''
  const backTab = params.get('fromTab') || activeProjection?.order.pickupStatus || 'WAIT_PICKUP'
  const backHref = buildHref({ tab: backTab, prepOrderId: undefined, prepRecordId: undefined, fromTab: undefined })

  if (!activeProjection) {
    return `
      <div class="space-y-5 p-6">
        ${renderCuttingPageHeader(getCanonicalCuttingMeta('pickup-management'), {
          actionsHtml: `<button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(backHref)}">返回领料列表</button>`,
        })}
        <section class="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">未找到领料单。</section>
      </div>
    `
  }

  return `
    <div class="space-y-5 p-6">
      ${renderCuttingPageHeader(getCanonicalCuttingMeta('pickup-management'), {
        actionsHtml: `
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(backHref)}">返回领料列表</button>
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(`/wls/transfer-warehouse/material-prep-detail?prepOrderId=${activeProjection.order.prepOrderId}`)}">查看中转仓配料详情</button>
          </div>
        `,
      })}
      <section class="rounded-lg border bg-card p-4">
        <div class="text-sm text-muted-foreground">裁前准备 / 领料管理</div>
        <h2 class="mt-1 text-xl font-semibold">领料详情</h2>
        <p class="mt-2 text-sm text-muted-foreground">生产单 ${escapeHtml(activeProjection.order.productionOrderNo)} / 配料单 ${escapeHtml(activeProjection.order.prepOrderNo)}</p>
      </section>
      <section class="grid gap-3 md:grid-cols-4">
        ${renderKpi('领料状态', pickupStatusLabelMap[activeProjection.order.pickupStatus], `可领 ${formatQty(activeProjection.totalAvailableToPickupQty)} / 已领 ${formatQty(activeProjection.totalPickedQty)}`)}
        ${renderKpi('配料记录', `${activeProjection.prepRecords.length} 条`, `可领记录 ${candidates.length} 条`)}
        ${renderKpi('待加工仓入库', activeProjection.pickupRecords.length ? `${activeProjection.pickupRecords.length} 条` : '暂无', `最近 ${activeProjection.latestOperatedAt || activeProjection.order.createdAt}`)}
        ${renderKpi('缺料缺口', formatQty(activeProjection.totalShortageQty), `最早可配 ${activeProjection.earliestExpectedAvailableAt || '无需跟进'}`)}
      </section>
      ${renderCandidateList(candidates)}
      ${renderRejectPanel(activePrepRecordId, activePrepLineId)}
      ${renderOrderDetail(activeProjection)}
    </div>
  `
}
