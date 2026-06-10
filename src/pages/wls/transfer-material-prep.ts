import { renderBadge } from '../../components/ui/badge.ts'
import type { BadgeVariant } from '../../components/ui/types.ts'
import {
  getMaterialPrepOrderProjection,
  getMaterialPrepRecordItems,
  listMaterialPrepOrderProjections,
  materialPrepStatusLabelMap,
  materialPrepWorkbenchTabs,
  pickupStatusLabelMap,
  type MaterialPrepLine,
  type MaterialPrepOrderProjection,
  type MaterialPrepOrderStatus,
  type MaterialPrepRecord,
  type PickupRecord,
  type PrepRejectRecord,
} from '../../data/fcs/cutting/production-material-prep.ts'
import { escapeHtml } from '../../utils.ts'

const statusVariantMap: Record<string, BadgeVariant> = {
  NEED_PREP: 'warning',
  CONTINUE_PREP: 'info',
  SHORTAGE_TRACKING: 'warning',
  REJECTED_REWORK: 'danger',
  READY: 'success',
  CLOSED: 'neutral',
  WAIT_PICKUP: 'warning',
  PARTIAL_PICKABLE: 'info',
  WAIT_CONTINUE_PICKUP: 'warning',
  REJECTED_WAIT_WLS: 'danger',
  PICKUP_DONE: 'success',
  ACTUAL_CLOSED: 'neutral',
  NOT_PICKABLE: 'neutral',
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
  return `/wls/transfer-warehouse/material-prep${query ? `?${query}` : ''}`
}

function buildDetailHref(prepOrderId: string, activeTab?: string): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', prepOrderId)
  if (activeTab) params.set('fromTab', activeTab)
  return `/wls/transfer-warehouse/material-prep-detail?${params.toString()}`
}

function formatQty(value: number, unit = '米'): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function renderMaterialThumb(line: MaterialPrepLine): string {
  return `
    <div class="h-12 w-12 overflow-hidden rounded-md border bg-muted">
      <img src="${escapeHtml(line.materialImageUrl)}" alt="${escapeHtml(line.materialName)}" class="h-full w-full object-cover" loading="lazy" />
    </div>
  `
}

function renderStatus(status: string, label: string): string {
  return renderBadge(label, statusVariantMap[status] || 'neutral')
}

function getLinePrepRecordCount(row: MaterialPrepOrderProjection, line: MaterialPrepLine): number {
  return row.prepRecords.filter((record) =>
    getMaterialPrepRecordItems(record).some((item) => item.prepLineId === line.prepLineId),
  ).length
}

function getLinePickupRecordCount(row: MaterialPrepOrderProjection, line: MaterialPrepLine): number {
  return row.pickupRecords.filter((record) => record.prepLineId === line.prepLineId).length
}

function renderNeedPrepState(line: MaterialPrepLine): string {
  if (line.linePrepStatus === '被打回') return renderBadge('需要重配', 'danger')
  if (line.linePrepStatus === '按实关闭') return renderBadge('后续不配', 'neutral')
  if (line.remainingNeedQty <= 0) return renderBadge('无需配料', 'success')
  if (line.canPrepQty > 0) return renderBadge('还需要配料', 'warning')
  return renderBadge('等待上游', 'info')
}

function renderOrderMaterialRows(row: MaterialPrepOrderProjection): string {
  return `
    <div class="rounded-md border bg-background">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div class="text-sm font-medium">物料配料明细</div>
        <div class="text-xs text-muted-foreground">每个生产单至少 8 个物料：面料 3 个、辅料 3 个、纱线 1 个、包材 1 个。</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1320px] text-left text-xs">
          <thead class="bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-3 py-2">图片</th>
              <th class="px-3 py-2">类别</th>
              <th class="px-3 py-2">物料</th>
              <th class="px-3 py-2">需要多少</th>
              <th class="px-3 py-2">已配多少</th>
              <th class="px-3 py-2">剩余未配</th>
              <th class="px-3 py-2">配料记录</th>
              <th class="px-3 py-2">领料记录</th>
              <th class="px-3 py-2">是否还需要配料</th>
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
                <td class="px-3 py-2">${formatQty(line.requiredQty, line.unit)}</td>
                <td class="px-3 py-2">${formatQty(line.confirmedPrepQty, line.unit)}</td>
                <td class="px-3 py-2">${formatQty(line.remainingNeedQty, line.unit)}</td>
                <td class="px-3 py-2">${getLinePrepRecordCount(row, line)} 条</td>
                <td class="px-3 py-2">${getLinePickupRecordCount(row, line)} 条</td>
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

function renderKpi(label: string, value: number | string, desc: string): string {
  return `
    <div class="rounded-lg border bg-card px-4 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-2xl font-semibold">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(desc)}</div>
    </div>
  `
}

function renderTabs(rows: MaterialPrepOrderProjection[], activeTab: MaterialPrepOrderStatus): string {
  return `
    <div class="flex flex-wrap gap-2">
      ${materialPrepWorkbenchTabs.map((tab) => {
        const count = rows.filter((row) => row.order.overallPrepStatus === tab.key).length
        return `
          <button type="button" data-nav="${escapeHtml(buildHref({ tab: tab.key, prepOrderId: undefined }))}" class="rounded-md border px-3 py-2 text-sm ${tab.key === activeTab ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}">
            ${escapeHtml(tab.label)} <span class="ml-1 text-xs opacity-80">${count}</span>
          </button>
        `
      }).join('')}
    </div>
  `
}

function renderOrderTable(rows: MaterialPrepOrderProjection[], activeTab: MaterialPrepOrderStatus): string {
  return `
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">配料工作台</h2>
        <span class="text-xs text-muted-foreground">列表只展示待处理对象；点击查看详情后再处理配料记录。</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">生产单</th>
              <th class="px-3 py-2">款式 / SPU</th>
              <th class="px-3 py-2">配料进度</th>
              <th class="px-3 py-2">领料状态</th>
              <th class="px-3 py-2">物料行</th>
              <th class="px-3 py-2">缺料与上游</th>
              <th class="px-3 py-2">最近操作</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((row) => `
              <tr class="border-t">
                <td class="px-3 py-3 align-top">
                  <button type="button" data-nav="${escapeHtml(buildDetailHref(row.order.prepOrderId, activeTab))}" class="font-medium text-blue-700 hover:underline">${escapeHtml(row.order.productionOrderNo)}</button>
                  <div class="mt-1 text-xs text-muted-foreground">配料单：${escapeHtml(row.order.prepOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">交期：${escapeHtml(row.order.deliveryDate)}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="font-medium">${escapeHtml(row.order.styleNo)} / ${escapeHtml(row.order.styleName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.order.spu)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">计划 ${row.order.planQty.toLocaleString('zh-CN')} 件</div>
                </td>
                <td class="px-3 py-3 align-top">
                  ${renderStatus(row.order.overallPrepStatus, materialPrepStatusLabelMap[row.order.overallPrepStatus])}
                  <div class="mt-2 text-xs text-muted-foreground">已确认 ${formatQty(row.totalConfirmedPrepQty)} / 需求 ${formatQty(row.totalRequiredQty)}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  ${renderStatus(row.order.pickupStatus, pickupStatusLabelMap[row.order.pickupStatus])}
                  <div class="mt-2 text-xs text-muted-foreground">已领 ${formatQty(row.totalPickedQty)}，可领 ${formatQty(row.totalAvailableToPickupQty)}</div>
                </td>
                <td class="px-3 py-3 align-top text-xs">
                  <div>物料行：${row.lineCount}</div>
                  <div>已配齐：${row.readyLineCount}</div>
                  <div>未配齐：${row.shortageLineCount}</div>
                  <div>可继续配：${row.canContinuePrepLineCount}</div>
                  <div>被打回：${row.rejectedRecordCount}</div>
                </td>
                <td class="px-3 py-3 align-top text-xs">
                  <div>缺口：${formatQty(row.totalShortageQty)}</div>
                  <div>最早可配：${escapeHtml(row.earliestExpectedAvailableAt || '暂无')}</div>
                </td>
                <td class="px-3 py-3 align-top text-xs">
                  <div>${escapeHtml(row.latestOperatorName)}</div>
                  <div class="mt-1 text-muted-foreground">${escapeHtml(row.latestOperatedAt || row.order.createdAt)}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  <button type="button" data-nav="${escapeHtml(buildDetailHref(row.order.prepOrderId, activeTab))}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">查看详情</button>
                </td>
              </tr>
              <tr class="bg-muted/20">
                <td colspan="8" class="px-3 pb-4 pt-0">
                  ${renderOrderMaterialRows(row)}
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="8" class="px-3 py-8 text-center text-sm text-muted-foreground">当前状态下暂无配料单。</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderProductionDemand(projection: MaterialPrepOrderProjection): string {
  const order = projection.order
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">1、生产需求信息</h3>
      <div class="mt-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
        <div><div class="text-xs text-muted-foreground">生产单</div><div class="font-medium">${escapeHtml(order.productionOrderNo)}</div></div>
        <div><div class="text-xs text-muted-foreground">款式</div><div class="font-medium">${escapeHtml(order.styleNo)} / ${escapeHtml(order.styleName)}</div></div>
        <div><div class="text-xs text-muted-foreground">SPU</div><div class="font-medium">${escapeHtml(order.spu)}</div></div>
        <div><div class="text-xs text-muted-foreground">计划数量</div><div class="font-medium">${order.planQty.toLocaleString('zh-CN')} 件</div></div>
        <div><div class="text-xs text-muted-foreground">客户</div><div class="font-medium">${escapeHtml(order.customerName)}</div></div>
        <div><div class="text-xs text-muted-foreground">交期</div><div class="font-medium">${escapeHtml(order.deliveryDate)}</div></div>
        <div><div class="text-xs text-muted-foreground">创建人</div><div class="font-medium">${escapeHtml(order.creatorName)}</div></div>
        <div><div class="text-xs text-muted-foreground">创建时间</div><div class="font-medium">${escapeHtml(order.createdAt)}</div></div>
      </div>
      ${order.isClosed ? `<div class="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">配料已关闭：${escapeHtml(order.closeReason)} / ${escapeHtml(order.closedAt)}</div>` : ''}
    </section>
  `
}

function renderInventoryProgress(lines: MaterialPrepLine[]): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">2、当前中转仓库存信息与上游进度</h3>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[980px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">图片</th>
              <th class="px-3 py-2">类别</th>
              <th class="px-3 py-2">物料</th>
              <th class="px-3 py-2">需求</th>
              <th class="px-3 py-2">已确认配料</th>
              <th class="px-3 py-2">已领料</th>
              <th class="px-3 py-2">中转仓库存</th>
              <th class="px-3 py-2">当前可配</th>
              <th class="px-3 py-2">缺口</th>
              <th class="px-3 py-2">采购/印花/染色进度</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map((line) => `
              <tr class="border-t">
                <td class="px-3 py-3">${renderMaterialThumb(line)}</td>
                <td class="px-3 py-3">${renderBadge(line.materialType, line.materialType === '面料' ? 'info' : line.materialType === '辅料' ? 'warning' : line.materialType === '纱线' ? 'success' : 'neutral')}</td>
                <td class="px-3 py-3">
                  <div class="font-medium">${escapeHtml(line.materialSku)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialName)} / ${escapeHtml(line.color)} / ${escapeHtml(line.spec)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">裁片单：${escapeHtml(line.cutOrderNo)}</div>
                </td>
                <td class="px-3 py-3">${formatQty(line.requiredQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.confirmedPrepQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.pickedQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.availableStockQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.canPrepQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.shortageQty, line.unit)}</td>
                <td class="px-3 py-3">
                  ${renderBadge(line.upstreamProgressStatus, line.upstreamProgressStatus === '已到仓可配' ? 'success' : line.upstreamProgressStatus === '无需跟进' ? 'neutral' : 'warning')}
                  <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(line.upstreamSourceType)} / ${escapeHtml(line.expectedAvailableAt || '无预计时间')}</div>
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

function renderPrepRecords(records: MaterialPrepRecord[], lines: MaterialPrepLine[]): string {
  const lineById = new Map(lines.map((line) => [line.prepLineId, line]))
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">3、配料记录</h3>
        <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white">手动新增配料记录</button>
      </div>
      <div class="mt-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        新增记录默认为未确认；确认对象是整条配料记录，记录内物料明细不单独确认。下游打回后，该配料记录会回到未确认/待重配状态，不影响同单其他配料记录。
      </div>
      <div class="mt-3 space-y-3">
        ${records.length ? records.map((record) => {
          const recordItems = getMaterialPrepRecordItems(record)
          const statusLabel = record.recordStatus === 'CONFIRMED' ? '已确认' : record.recordStatus === 'REJECTED' ? '被打回待重配' : '未确认'
          const statusVariant: BadgeVariant = record.recordStatus === 'CONFIRMED' ? 'success' : record.recordStatus === 'REJECTED' ? 'danger' : 'warning'
          const totalQty = recordItems.reduce((sum, item) => sum + Number(item.preparedQty || 0), 0)
          const totalRollCount = recordItems.reduce((sum, item) => sum + Number(item.rollCount || 0), 0)
          return `
            <article class="rounded-md border bg-background">
              <div class="flex flex-wrap items-start justify-between gap-3 border-b px-3 py-3">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium">${escapeHtml(record.batchNo)}</span>
                    ${renderBadge(statusLabel, statusVariant)}
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">配料记录：${escapeHtml(record.prepRecordId)} / ${escapeHtml(record.preparedAt)} / ${escapeHtml(record.operatorName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">整条记录合计：${formatQty(totalQty)} / ${totalRollCount} 卷 / ${recordItems.length} 个物料明细</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  ${record.recordStatus !== 'CONFIRMED'
                    ? '<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">确认整条配料记录</button>'
                    : '<span class="rounded-md bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">整条记录已进入领料管理</span>'}
                </div>
              </div>
              <div class="px-3 py-3">
                <div class="mb-2 text-xs font-medium text-muted-foreground">记录内物料明细</div>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[820px] text-left text-sm">
                    <thead class="bg-muted/60 text-xs text-muted-foreground">
                      <tr>
                        <th class="px-3 py-2">图片</th>
                        <th class="px-3 py-2">类别</th>
                        <th class="px-3 py-2">物料</th>
                        <th class="px-3 py-2">数量</th>
                        <th class="px-3 py-2">库区库位</th>
                        <th class="px-3 py-2">来源流水</th>
                        <th class="px-3 py-2">明细备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${recordItems.map((item) => {
                        const line = lineById.get(item.prepLineId)
                        return `
                          <tr class="border-t">
                            <td class="px-3 py-3">${line ? renderMaterialThumb(line) : ''}</td>
                            <td class="px-3 py-3">${line ? renderBadge(line.materialType, line.materialType === '面料' ? 'info' : line.materialType === '辅料' ? 'warning' : line.materialType === '纱线' ? 'success' : 'neutral') : '-'}</td>
                            <td class="px-3 py-3">
                              <div class="font-medium">${escapeHtml(line?.materialSku || item.prepLineId)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line ? `${line.materialName} / ${line.color} / ${line.cutOrderNo}` : '')}</div>
                            </td>
                            <td class="px-3 py-3">${formatQty(item.preparedQty, line?.unit || '米')} / ${item.rollCount} 卷</td>
                            <td class="px-3 py-3">${escapeHtml(item.warehouseArea)} / ${escapeHtml(item.locationCode)}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(item.sourceStockEventId || '-')}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(item.remark || '随整条配料记录确认')}</td>
                          </tr>
                        `
                      }).join('')}
                    </tbody>
                  </table>
                </div>
                <div class="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                  <div>确认记录：${escapeHtml(record.confirmedAt || '未确认')} ${escapeHtml(record.confirmedBy)}</div>
                  <div class="text-rose-600">打回记录：${escapeHtml(record.rejectReason || '无')}</div>
                </div>
              </div>
            </article>
          `
        }).join('') : '<div class="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">暂无配料记录。</div>'}
      </div>
    </section>
  `
}

function renderPickupRecords(records: PickupRecord[], rejectRecords: PrepRejectRecord[]): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">4、与配料记录关联的领料记录</h3>
      <div class="mt-3 grid gap-3 lg:grid-cols-2">
        <div class="rounded-md border">
          <div class="border-b px-3 py-2 text-sm font-medium">领料记录</div>
          <div class="divide-y">
            ${records.length ? records.map((record) => `
              <div class="px-3 py-3 text-sm">
                <div class="font-medium">${escapeHtml(record.pickupRecordId)}</div>
                <div class="mt-1 text-xs text-muted-foreground">配料记录：${escapeHtml(record.prepRecordId)}</div>
                <div class="mt-1 text-xs text-muted-foreground">领料：${formatQty(record.pickedQty)} / ${record.rollCount} 卷 / ${escapeHtml(record.receiverName)} / ${escapeHtml(record.pickedAt)}</div>
                <div class="mt-1 text-xs text-muted-foreground">入库：${escapeHtml(record.warehouseArea)} / ${escapeHtml(record.locationCode)} / 流水 ${escapeHtml(record.waitProcessLedgerEventId)}</div>
                ${record.differenceReason ? `<div class="mt-1 text-xs text-amber-700">差异：${escapeHtml(record.differenceReason)}</div>` : ''}
              </div>
            `).join('') : '<div class="px-3 py-4 text-sm text-muted-foreground">暂无领料记录。</div>'}
          </div>
        </div>
        <div class="rounded-md border">
          <div class="border-b px-3 py-2 text-sm font-medium">打回记录</div>
          <div class="divide-y">
            ${rejectRecords.length ? rejectRecords.map((record) => `
              <div class="px-3 py-3 text-sm">
                <div class="font-medium text-rose-700">${escapeHtml(record.rejectReason)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.rejectDetail)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.rejectedBy)} / ${escapeHtml(record.rejectedAt)}</div>
              </div>
            `).join('') : '<div class="px-3 py-4 text-sm text-muted-foreground">暂无打回记录。</div>'}
          </div>
        </div>
      </div>
    </section>
  `
}

function renderDetail(projection: MaterialPrepOrderProjection): string {
  return `
    <div class="space-y-4">
      ${renderProductionDemand(projection)}
      ${renderInventoryProgress(projection.lines)}
      ${renderPrepRecords(projection.prepRecords, projection.lines)}
      ${renderPickupRecords(projection.pickupRecords, projection.rejectRecords)}
    </div>
  `
}

export function renderWlsTransferMaterialPrepPage(): string {
  const params = getSearchParams()
  const activeTab = (params.get('tab') || 'NEED_PREP') as MaterialPrepOrderStatus
  const allRows = listMaterialPrepOrderProjections()
  const rows = allRows.filter((row) => row.order.overallPrepStatus === activeTab)
  const counts = materialPrepWorkbenchTabs.reduce<Record<string, number>>((accumulator, tab) => {
    accumulator[tab.key] = allRows.filter((row) => row.order.overallPrepStatus === tab.key).length
    return accumulator
  }, {})

  return `
    <div class="space-y-5 p-6">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-sm text-muted-foreground">仓储物流系统 / 中转仓管理</div>
          <h1 class="mt-1 text-2xl font-bold">配料管理</h1>
          <p class="mt-2 text-sm text-muted-foreground">按生产单组织配料，让配料人员知道哪些需要配、哪些可继续配、哪些未配齐需跟进、哪些已配齐。</p>
        </div>
        <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="/fcs/craft/cutting/pickup-management">查看裁床领料管理</button>
      </header>

      <section class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        ${renderKpi('待配料', counts.NEED_PREP || 0, '完全未配且已有库存')}
        ${renderKpi('可继续配料', counts.CONTINUE_PREP || 0, '之前配过且现在有库存')}
        ${renderKpi('未配齐跟进', counts.SHORTAGE_TRACKING || 0, '展示采购/印花/染色进度')}
        ${renderKpi('被打回待重配', counts.REJECTED_REWORK || 0, '领料端打回记录')}
        ${renderKpi('已配齐', counts.READY || 0, '需求已全部确认配料')}
        ${renderKpi('已关闭', counts.CLOSED || 0, '后续不再配')}
      </section>

      ${renderTabs(allRows, activeTab)}
      ${renderOrderTable(rows, activeTab)}
    </div>
  `
}

export function renderWlsTransferMaterialPrepDetailPage(): string {
  const params = getSearchParams()
  const allRows = listMaterialPrepOrderProjections()
  const activeOrderId = params.get('prepOrderId') || allRows[0]?.order.prepOrderId || ''
  const projection = getMaterialPrepOrderProjection(activeOrderId) || allRows[0]
  const backTab = params.get('fromTab') || projection?.order.overallPrepStatus || 'NEED_PREP'
  const backHref = buildHref({ tab: backTab, prepOrderId: undefined, fromTab: undefined })

  if (!projection) {
    return `
      <div class="space-y-5 p-6">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-sm text-muted-foreground">仓储物流系统 / 中转仓管理 / 配料管理</div>
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
          <div class="text-sm text-muted-foreground">仓储物流系统 / 中转仓管理 / 配料管理</div>
          <h1 class="mt-1 text-2xl font-bold">配料详情</h1>
          <p class="mt-2 text-sm text-muted-foreground">生产单 ${escapeHtml(projection.order.productionOrderNo)} / 配料单 ${escapeHtml(projection.order.prepOrderNo)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(backHref)}">返回配料列表</button>
          <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="/fcs/craft/cutting/pickup-management">查看裁床领料管理</button>
        </div>
      </header>

      <section class="grid gap-3 md:grid-cols-4">
        ${renderKpi('配料状态', materialPrepStatusLabelMap[projection.order.overallPrepStatus], `已确认 ${formatQty(projection.totalConfirmedPrepQty)} / 需求 ${formatQty(projection.totalRequiredQty)}`)}
        ${renderKpi('领料状态', pickupStatusLabelMap[projection.order.pickupStatus], `已领 ${formatQty(projection.totalPickedQty)} / 可领 ${formatQty(projection.totalAvailableToPickupQty)}`)}
        ${renderKpi('物料行', `${projection.readyLineCount}/${projection.lineCount}`, `未配齐 ${projection.shortageLineCount} 行，可继续配 ${projection.canContinuePrepLineCount} 行`)}
        ${renderKpi('缺料缺口', formatQty(projection.totalShortageQty), `最早可配 ${projection.earliestExpectedAvailableAt || '暂无'}`)}
      </section>

      ${renderDetail(projection)}
    </div>
  `
}
