import { postFinishingQualitySourceLabel } from '../../../data/fcs/post-finishing-qc-entry.ts'
import { listFinishedInventoryTransfers, getFinishedInventoryApplication } from '../../../data/wls/finished-inventory-quality.ts'
import type { FinishedInventoryTransfer } from '../../../data/wls/finished-inventory-quality-types.ts'
import { renderFinishedInventoryTransferSummary } from '../../wls/finished/inventory-quality.ts'
import { runPostFinishingCommand } from '../../../data/fcs/post-finishing-records.ts'
import { showPostFinishingActionFailure } from './storage-notice.ts'
// @page-pattern: list

import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  getPostFinishingFullFlowQcTask,
  getPostFinishingFullFlowOutboundOrder,
  dispatchPostFinishingOutboundOrder,
  getCurrentPostFinishingActor,
  POST_FINISHING_ACCEPTANCE_ACTORS,
  getPostFinishingFactoryReturn,
  getPostFinishingWaitHandoverWarehouseRecord,
  listPostFinishingFullFlowOutboundOrders,
  listPostFinishingWarehouseReceipts,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostStatusBadge } from './shared.ts'

type OutboundRecord = NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>

interface OutboundRow {
  record?: OutboundRecord
  transfer?: FinishedInventoryTransfer
  sourceKind: 'PRODUCTION_RETURN' | 'WAREHOUSE_STOCK'
  outboundId: string; outboundNo: string; sourceNo: string; productionNo: string; taskNo: string
  factoryName: string; targetName: string; sourceAction: string; createdAt: string; operator: string
  outboundQty: number; inboundQty: number; statusLabel: string
}
const stockOutboundNo = (row: FinishedInventoryTransfer) => `${row.applicationNo}-${row.category === '正常返仓' ? 'RETURN' : row.category === '瑕疵入仓' ? 'DEFECT' : 'REWORK'}`

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string>): void {
  const params = query()
  Object.entries(overrides).forEach(([key, value]) => params.set(key, value))
  appStore.navigate(`/fcs/craft/post-finishing/outbound-orders?${params.toString()}`)
}

function selectOptions(values: string[], selected: string): string {
  return ['<option value="">全部</option>', ...values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`)].join('')
}

function authorizationText(record: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>): string {
  return record.warehouseAuthorizedBy
    ? `${record.warehouseAuthorizedBy.authorizerName} / ${record.warehouseAuthorizationId}`
    : '无差异'
}

function image(line: { sku: Pick<OutboundRecord['lines'][number]['sku'], 'skuCode' | 'colorName' | 'sizeName' | 'imageUrl' | 'spuName'> }): string {
  const label = `${line.sku.skuCode} ${line.sku.colorName} ${line.sku.sizeName}`
  return `<button type="button" class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(line.sku.imageUrl)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button>`
}

function renderDetail(record: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>): string {
  const receipt = listPostFinishingWarehouseReceipts().find((item) => item.outboundOrderId === record.outboundOrderId)
  const waitHandover = getPostFinishingWaitHandoverWarehouseRecord(record.outboundOrderId)
  const delivery = getPostFinishingFactoryReturn(record.deliveryId)
  const factoryName = delivery?.managedPostFactoryName || '—'
  const displayStatus = record.status
  const directFromQc = record.sourceType === '质检直达'
  const sourceLocation = `${waitHandover?.areaName || `${factoryName}-待出货区`} / ${waitHandover?.locationCode || '未记录'}`
  const sourceAction = directFromQc ? '质检完成 → 待出货 → 实际发出 → 成衣仓接收' : '后道加工完成 → 待出货 → 实际发出 → 成衣仓接收'
  const traceNodes = [record.deliveryOrderNo, record.qcTaskNo, record.postTaskNo, record.outboundOrderNo].filter(Boolean)
  const rows = record.lines.map((line) => `<tr>
    <td class="px-3 py-3">${record.lines.indexOf(line) + 1}</td><td class="px-3 py-3">${image(line)}</td><td class="px-3 py-3"><span class="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">成品</span></td><td class="px-3 py-3 font-mono text-xs">${escapeHtml(line.sku.skuCode)}</td><td class="px-3 py-3">${escapeHtml(line.sku.spuName)}</td><td class="px-3 py-3">${escapeHtml(line.sku.colorName)}</td><td class="px-3 py-3">${escapeHtml(line.sku.sizeName)}</td><td class="px-3 py-3">—</td><td class="px-3 py-3">—</td><td class="px-3 py-3">—</td><td class="px-3 py-3">${line.outboundQty}</td><td class="px-3 py-3">${line.receivedQty ?? 0}</td><td class="px-3 py-3">件</td><td class="px-3 py-3">${displayStatus === '已接收入库' ? '成衣仓已确认接收' : displayStatus === '待出货' ? '尚未实际发出' : '待成衣仓确认接收'}</td>
  </tr>`).join('')
  return `<div class="space-y-4">
    <section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">单头信息</h3><p class="mt-2 text-sm">业务类型：${postFinishingQualitySourceLabel(getPostFinishingFullFlowQcTask(record.qcTaskId)?.sourceKind)}</p><dl class="mt-4 grid gap-x-8 gap-y-3 text-sm md:grid-cols-2"><div><dt class="text-xs text-muted-foreground">出货单号</dt><dd class="font-mono">${escapeHtml(record.outboundOrderNo)}</dd></div><div><dt class="text-xs text-muted-foreground">状态</dt><dd>${renderPostStatusBadge(displayStatus)}</dd></div><div><dt class="text-xs text-muted-foreground">工厂</dt><dd>${escapeHtml(factoryName)}</dd></div><div><dt class="text-xs text-muted-foreground">交出位置</dt><dd>${escapeHtml(sourceLocation)}</dd></div><div><dt class="text-xs text-muted-foreground">接收仓</dt><dd>成衣仓</dd></div><div><dt class="text-xs text-muted-foreground">来源动作</dt><dd>${escapeHtml(sourceAction)}</dd></div><div><dt class="text-xs text-muted-foreground">任务范围 / 后道责任</dt><dd>${escapeHtml(`${record.responsibility.taskTypeLabel} · ${record.responsibility.responsibilityLabel}`)}</dd></div><div><dt class="text-xs text-muted-foreground">交接来源</dt><dd>${escapeHtml(record.sourceType)}</dd></div><div><dt class="text-xs text-muted-foreground">生产单号</dt><dd class="font-mono">${escapeHtml(record.productionOrderNo)}</dd></div><div><dt class="text-xs text-muted-foreground">任务单号</dt><dd class="font-mono">${escapeHtml(delivery?.sewingTaskNo || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">来源对象</dt><dd>${directFromQc ? '质检单' : '后道加工单'}</dd></div><div><dt class="text-xs text-muted-foreground">来源单号</dt><dd class="font-mono">${escapeHtml(directFromQc ? record.qcTaskNo : record.postTaskNo || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">后道加工单</dt><dd class="font-mono">${escapeHtml(record.postTaskNo || '不适用（质检直达成衣仓）')}</dd></div><div><dt class="text-xs text-muted-foreground">库区 / 库位</dt><dd>${escapeHtml(`${waitHandover?.areaName || '待出货区'} / ${waitHandover?.locationCode || '未记录'}`)}</dd></div><div><dt class="text-xs text-muted-foreground">应交数量</dt><dd>${record.lines.reduce((sum, line) => sum + line.outboundQty, 0)} 件</dd></div><div><dt class="text-xs text-muted-foreground">成衣仓实收</dt><dd>${record.lines.reduce((sum, line) => sum + (line.receivedQty || 0), 0)} 件</dd></div><div><dt class="text-xs text-muted-foreground">生成时间</dt><dd>${escapeHtml(new Date(record.createdAt).toLocaleString('zh-CN'))}</dd></div><div><dt class="text-xs text-muted-foreground">成衣仓接收人</dt><dd>${escapeHtml(record.receivedBy?.actorName || '待接收')}</dd></div><div class="md:col-span-2"><dt class="text-xs text-muted-foreground">备注</dt><dd>${escapeHtml(receipt?.differenceReason || (directFromQc ? 'QC无需后道加工，出货准备和实际发出分别记录，仓库按实际接收登记' : '后道全部完成后准备出货，实际发出后由仓库接收'))}</dd></div><div class="md:col-span-2"><dt class="text-xs text-muted-foreground">追溯链路</dt><dd class="font-mono text-xs">${traceNodes.map(escapeHtml).join(' → ')}</dd></div></dl></section>
    <section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">出货明细</h3><div class="mt-3 overflow-x-auto"><table class="min-w-[1500px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr>${['序号','图片','类型','SKU','名称','颜色','尺码','项次号','袋号','卷号','本单出货','仓库实收','单位','行状态'].map((head) => `<th class="px-3 py-2">${head}</th>`).join('')}</tr></thead><tbody class="divide-y">${rows}</tbody></table></div></section>
    ${receipt ? `<section class="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 class="font-semibold text-emerald-900">仓库接收记录</h3><div class="mt-2 text-sm text-emerald-800">${escapeHtml(receipt.receivedBy.actorName)} · ${escapeHtml(new Date(receipt.receivedAt).toLocaleString('zh-CN'))} · ${escapeHtml(receipt.differenceReason || '数量一致')}</div></section>` : ''}
  </div>`
}

function outboundActions(row: OutboundRow): string {
  const detail = `/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(row.outboundId)}`
  if (row.transfer) return `<div class="flex flex-wrap gap-3"><a href="${detail}" data-nav="${detail}" class="text-xs text-blue-700 underline">详情</a><a href="/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(row.transfer.applicationId)}" data-nav="/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(row.transfer.applicationId)}" class="text-xs text-blue-700 underline">${row.transfer.shippedAt ? '查看分类交接' : row.statusLabel==='待后道加工' ? '查看待加工进度' : '办理整批交出'}</a></div>`
  const record = row.record!
  return `<div class="grid grid-cols-3 gap-x-3 gap-y-2">${record.status === '待出货' ? `<button class="text-left text-xs font-semibold text-blue-700" data-post-outbound-dispatch="${escapeHtml(record.outboundOrderId)}">确认实际发出</button>` : ''}<a href="${detail}" data-nav="${detail}" class="whitespace-nowrap text-xs font-medium text-blue-700">详情</a><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND&id=${encodeURIComponent(record.outboundOrderId)}" class="whitespace-nowrap text-xs text-blue-700">打印整单</a><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND_BARCODE&id=${encodeURIComponent(record.outboundOrderId)}" class="whitespace-nowrap text-xs text-blue-700">打印条码</a><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND_HANGTAG&id=${encodeURIComponent(record.outboundOrderId)}" class="whitespace-nowrap text-xs text-blue-700">打印吊牌</a></div>`
}
const outboundColumns: StandardListColumn<OutboundRow>[] = [
  { key:'outboundNo',title:'出货单号',width:210,required:true,freezeable:true,render:row=>`<strong class="break-all font-mono">${escapeHtml(row.outboundNo)}</strong>` },
  { key:'sourceKind',title:'业务类型',width:150,required:true,render:row=>postFinishingQualitySourceLabel(row.sourceKind) },
  { key:'factory',title:'发出工厂 / 接收方',width:180,required:true,render:row=>`<div>${escapeHtml(row.factoryName)}</div><div class="mt-1 text-xs text-muted-foreground">→ ${escapeHtml(row.targetName)}</div>` },
  { key:'productionNo',title:'生产单 / 来源单',width:210,required:true,render:row=>`<div class="break-all font-mono text-xs">${escapeHtml(row.productionNo || '不适用（成衣库存质检）')}</div><div class="mt-1 break-all text-xs">${escapeHtml(row.sourceNo)}</div>` },
  { key:'taskNo',title:'任务单号',width:150,required:true,render:row=>escapeHtml(row.taskNo || '不适用') },
  { key:'source',title:'交接来源',width:160,required:true,render:row=>escapeHtml(row.sourceAction) },
  { key:'outboundQty',title:'本单出货数量',width:100,required:true,align:'center',render:row=>`${row.outboundQty} 件` },
  { key:'inboundQty',title:'实际接收数量',width:100,required:true,align:'center',render:row=>row.transfer && !row.transfer.receivedAt ? '待实际接收' : `${row.inboundQty} 件` },
  { key:'status',title:'状态',width:110,required:true,render:row=>renderPostStatusBadge(row.statusLabel) },
  { key:'createdAt',title:'创建时间',width:160,required:true,render:row=>escapeHtml(new Date(row.createdAt).toLocaleString('zh-CN')) },
  { key:'operator',title:'实际交出人',width:120,required:true,render:row=>escapeHtml(row.operator) },
  { key:'actions',title:'操作',width:310,required:true,actionColumn:true,render:outboundActions },
]
export function renderPostFinishingOutboundOrdersPage(): string {
  const current = query(), keyword = current.get('keyword')?.trim().toLowerCase() || '', status = current.get('status') || '', factory = current.get('factory') || '', sourceKind = current.get('sourceKind') || '', createdFrom = current.get('createdFrom') || '', createdTo = current.get('createdTo') || ''
  const native: OutboundRow[] = listPostFinishingFullFlowOutboundOrders().map(record => {
    const delivery = getPostFinishingFactoryReturn(record.deliveryId)
    return { record,sourceKind:getPostFinishingFullFlowQcTask(record.qcTaskId)?.sourceKind || 'PRODUCTION_RETURN',outboundId:record.outboundOrderId,outboundNo:record.outboundOrderNo,sourceNo:record.qcTaskNo,productionNo:record.productionOrderNo,taskNo:delivery?.sewingTaskNo || '',factoryName:delivery?.managedPostFactoryName || '—',targetName:'成衣仓',sourceAction:`${record.sourceType}${record.postTaskNo ? ` · ${record.postTaskNo}` : ''}`,createdAt:record.createdAt,operator:record.dispatchedBy?.actorName || record.receivedBy?.actorName || '待实际发出',outboundQty:record.lines.reduce((n,line)=>n+line.outboundQty,0),inboundQty:record.lines.reduce((n,line)=>n+(line.receivedQty || 0),0),statusLabel:record.status }
  })
  const inventory: OutboundRow[] = listFinishedInventoryTransfers().filter(transfer=>transfer.category!=='送后道').map(transfer=>({ transfer,sourceKind:'WAREHOUSE_STOCK',outboundId:transfer.id,outboundNo:stockOutboundNo(transfer),sourceNo:transfer.applicationNo,productionNo:'',taskNo:'',factoryName:transfer.sourceWarehouseName,targetName:transfer.targetName,sourceAction:transfer.category,createdAt:transfer.createdAt,operator:transfer.shippedBy || '待实际发出',outboundQty:transfer.lines.reduce((n,line)=>n+line.quantity,0),inboundQty:transfer.lines.reduce((n,line)=>n+(line.receivedQty || 0),0),statusLabel:transfer.category==='正常返仓' && getFinishedInventoryApplication(transfer.applicationId)?.postTaskId && !getFinishedInventoryApplication(transfer.applicationId)?.postCompletedAt?'待后道加工':!transfer.shippedAt?'待出货':!transfer.receivedAt?transfer.category==='返工交接'?'待返工接收':'待仓库接收':transfer.category==='返工交接'?'已完成':transfer.putawayAt?'已接收入库':'待上架' }))
  const allRows = [...inventory,...native]
  const rows = allRows.filter(row=>(!keyword || [row.outboundNo,row.sourceNo,row.productionNo,row.taskNo,row.factoryName,row.targetName].join(' ').toLowerCase().includes(keyword)) && (!status || row.statusLabel===status) && (!factory || row.factoryName===factory) && (!sourceKind || row.sourceKind===sourceKind) && (!createdFrom || row.createdAt.slice(0,10)>=createdFrom) && (!createdTo || row.createdAt.slice(0,10)<=createdTo))
  const pageSize=Math.max(10,Math.min(50,Number(current.get('pageSize') || 20))),slice=paginateStandardListRows(rows,Number(current.get('page') || 1),pageSize)
  const preferences:StandardListColumnPreferences={order:outboundColumns.map(column=>column.key),visibleKeys:outboundColumns.map(column=>column.key),frozenKeys:['outboundNo'],pageSize}
  const factories=[...new Set(allRows.map(row=>row.factoryName))]
  return renderStandardListPage({title:'后道出货单列表',primaryActionsHtml:'',filtersHtml:`<form action="/fcs/craft/post-finishing/outbound-orders" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3 xl:grid-cols-6"><label class="text-xs text-muted-foreground md:col-span-2">关键词<input name="keyword" value="${escapeHtml(current.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="出货单、来源单、生产单或接收方"></label><label class="text-xs text-muted-foreground">业务类型<select name="sourceKind" aria-label="业务类型" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"><option value="">全部类型</option>${(['WAREHOUSE_STOCK','PRODUCTION_RETURN'] as const).map(kind=>`<option value="${kind}" ${sourceKind===kind?'selected':''}>${postFinishingQualitySourceLabel(kind)}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['待后道加工','待出货','待仓库接收','待返工接收','待上架','已接收入库','已完成'],status)}</select></label><label class="text-xs text-muted-foreground">工厂<select name="factory" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(factories,factory)}</select></label><label class="text-xs text-muted-foreground">创建开始<input type="date" name="createdFrom" value="${escapeHtml(createdFrom)}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"></label><label class="text-xs text-muted-foreground">创建结束<input type="date" name="createdTo" value="${escapeHtml(createdTo)}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"></label><div class="flex items-end justify-end gap-2 md:col-span-3 xl:col-span-6"><a data-nav="/fcs/craft/post-finishing/outbound-orders" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">重置</a><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white">查询</button></div></form>`,tableHtml:renderStandardListTable({columns:outboundColumns,rows:slice.rows,preferences,sort:null,eventPrefix:'post-finishing-outbound-orders',emptyText:'暂无符合条件的后道出货单'}),paginationHtml:renderTablePagination({...slice,actionPrefix:'post-finishing-outbound-orders',fieldPrefix:'post-finishing-outbound-orders'})})
}

// schema 1 仅用于旧链接只读查看；历史链接迁移验收完成后连同 archive 键删除。
// 不加入当前列表、数量统计、出货和收货命令，也不以旧记录补造当前业务事实。
function renderArchivedOutbound(id: string): string {
  try {
    const archive = JSON.parse(globalThis.localStorage?.getItem('higood-fcs-post-finishing-outbound-orders-v1:archive') || 'null')
    if (archive?.schemaVersion !== 1) return ''
    const records: unknown = JSON.parse(archive.raw)
    if (!Array.isArray(records)) return ''
    const record = records.find((item) => item && (item.outboundOrderId === id || item.outboundOrderNo === id) && Array.isArray(item.lines))
    if (!record) return ''
    const text = (value: unknown) => escapeHtml(String(value ?? '—'))
    const rows = record.lines.map((line: Record<string, unknown>) => `<tr>
      <td class="p-3"><div class="flex items-center gap-2">${line.skuImageUrl ? image({ sku: { imageUrl: String(line.skuImageUrl), skuCode: String(line.skuCode || ''), spuName: String(line.spuName || ''), colorName: String(line.colorName || ''), sizeName: String(line.sizeName || '') } }) : '<span class="text-amber-700">历史图片缺失</span>'}<span>${text(line.spuName)}<br>${text(line.skuCode)}</span></div></td>
      <td class="p-3">${text(line.colorName)} / ${text(line.sizeName)}</td><td class="p-3">${text(line.plannedQty)} ${text(line.qtyUnit)}</td><td class="p-3">${text(line.inboundQty)} ${text(line.qtyUnit)}</td>
    </tr>`).join('')
    return `<section class="space-y-4 rounded-xl border bg-white p-4" data-testid="archived-post-outbound">
      <h2 class="font-semibold">历史出货单 · ${text(record.outboundOrderNo || record.outboundOrderId)}</h2>
      <p class="text-sm text-amber-700">历史记录仅供查看。数量和状态保留原记录，不参与当前出货或入库。</p>
      <p class="text-sm">生产单：${text(record.productionOrderNo)}　原状态：${text(record.status)}　来源复检单：${text(record.recheckOrderNo)}</p>
      <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b text-left"><th class="p-3">款式 / SKU</th><th class="p-3">颜色 / 尺码</th><th class="p-3">原出货数量</th><th class="p-3">原入库数量</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>`
  } catch { return '' }
}

export function renderPostFinishingOutboundOrderDetailPage(id: string): string {
  const stock = listFinishedInventoryTransfers().find(row=>row.id===id && row.category!=='送后道')
  if(stock){
    const app=getFinishedInventoryApplication(stock.applicationId)
    return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('后道出货单详情',stockOutboundNo(stock))}<section class="rounded border bg-white p-4"><strong>业务类型：成衣库存质检</strong><p class="mt-2">关联质检单：${escapeHtml(app?.qcTaskNo || '待核对')}</p><p class="mt-2">原成衣仓：${escapeHtml(app?.warehouseName || '待核对')}</p><div class="mt-3 flex flex-wrap gap-3"><a class="text-blue-700 underline" href="/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(stock.applicationId)}" data-nav="/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(stock.applicationId)}">办理或查看分类交接</a><a class="text-blue-700 underline" data-nav="/fcs/craft/post-finishing/outbound-orders">返回出货单列表</a></div></section>${renderFinishedInventoryTransferSummary(stock)}</div>`
  }
  const record = getPostFinishingFullFlowOutboundOrder(id)
  const actions = record ? `<div class="flex flex-wrap items-center justify-end gap-2">${record.status==='待出货'?`<button class="rounded bg-blue-600 px-4 py-2 text-white" data-post-outbound-dispatch="${escapeHtml(record.outboundOrderId)}">确认实际发出</button>`:''}<a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND&id=${encodeURIComponent(record.outboundOrderId)}" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white">打印整单</a><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND_BARCODE&id=${encodeURIComponent(record.outboundOrderId)}" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">打印条码</a><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND_HANGTAG&id=${encodeURIComponent(record.outboundOrderId)}" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">打印吊牌</a><a data-nav="/fcs/craft/post-finishing/outbound-orders" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">返回出货单列表</a></div>` : `<a data-nav="/fcs/craft/post-finishing/outbound-orders" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">返回出货单列表</a>`
  return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('后道出货单详情', record?.outboundOrderNo || '', actions)}${record ? renderDetail(record) : renderArchivedOutbound(id) || '<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">未找到后道出货单。</div>'}</div>`
}

export async function handlePostFinishingOutboundOrderEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const dispatch=target.closest<HTMLElement>('[data-post-outbound-dispatch]')
  if(dispatch){
    const id=dispatch.dataset.postOutboundDispatch||'',record=getPostFinishingFullFlowOutboundOrder(id)
    if(!record||record.status!=='待出货')return true
    if(dispatch.dataset.pending==='true')return true
    const quantity=record.lines.reduce((sum,line)=>sum+line.outboundQty,0)
    if(!window.confirm(`确认 ${record.outboundOrderNo} 的 ${record.lines.length} 个SKU、共 ${quantity} 件现已实际发出？确认后进入待仓库接收。`))return true
    dispatch.dataset.pending='true'
    try{await runPostFinishingCommand(()=>dispatchPostFinishingOutboundOrder({outboundOrderId:id,actor:getCurrentPostFinishingActor(POST_FINISHING_ACCEPTANCE_ACTORS.postOperator.actorId)}));delete target.dataset.postFinishingPreserveInput;delete dispatch.dataset.postFinishingPreserveInput;document.querySelector('[data-post-finishing-action-error]')?.remove();appStore.navigate(`/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(id)}`)}catch(error){showPostFinishingActionFailure(error instanceof Error?error.message:String(error),target)}finally{dispatch.dataset.pending='false'}
    return true
  }
  const action = target.closest<HTMLElement>('[data-post-finishing-outbound-orders-action]')?.dataset.postFinishingOutboundOrdersAction
  if (action === 'prev-page' || action === 'next-page') {
    navigate({ page: String(Math.max(1, Number(query().get('page') || 1) + (action === 'prev-page' ? -1 : 1))) })
    return true
  }
  const pageSize = target.closest<HTMLSelectElement>('[data-post-finishing-outbound-orders-field="pageSize"]')
  if (pageSize && event?.type === 'change') {
    navigate({ page: '1', pageSize: pageSize.value })
    return true
  }
  return false
}
