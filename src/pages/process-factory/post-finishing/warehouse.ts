// @page-pattern: workflow

import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  POST_FINISHING_SEWING_TASK_TYPE_LABEL,
  confirmPostFinishingFactoryReturn,
  correctPostFinishingFactoryReturnConfirmation,
  getPostFinishingFactoryReturn,
  listPostFinishingFactoryReturns,
  listPostFinishingReturnConfirmationVersions,
  listPostFinishingWaitProcessWarehouseMovements,
  listPostFinishingWaitProcessWarehouseRecords,
  loadPostFinishingDemoData,
  sendPostFinishingFactoryReturnToQc,
  uploadPostFinishingDeliveryQcReference,
  type PostFinishingFactoryReturnDelivery,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { listPostFinishingQcReferences } from '../../../data/fcs/post-finishing-qc-reference.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostStatusBadge } from './shared.ts'

let pageMessage = ''
let pageMessageTone: 'success' | 'error' = 'success'

function currentDeliveryId(): string {
  return typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('deliveryId') || ''
}

function currentTab(): 'pending' | 'inventory' | 'movements' {
  const value = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('tab') || ''
  return value === 'inventory' || value === 'movements' ? value : 'pending'
}

function refresh(deliveryId = currentDeliveryId()): void {
  const tab = currentTab()
  const query = deliveryId
    ? `?tab=${tab}&deliveryId=${encodeURIComponent(deliveryId)}&refresh=${Date.now()}`
    : `?tab=${tab}&refresh=${Date.now()}`
  appStore.navigate(`/fcs/craft/post-finishing/wait-process-warehouse${query}`)
}

function renderMessage(): string {
  if (!pageMessage) return ''
  const tone = pageMessageTone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-red-200 bg-red-50 text-red-700'
  return `<div class="rounded-lg border px-4 py-3 text-sm ${tone}" role="status">${escapeHtml(pageMessage)}</div>`
}

function qty(record: PostFinishingFactoryReturnDelivery, key: 'registeredQty' | 'confirmedQty'): number {
  return record.lines.reduce((sum, line) => sum + (line[key] || 0), 0)
}

function renderDeliveryCards(records: PostFinishingFactoryReturnDelivery[]): string {
  if (!records.length) {
    return `<div class="rounded-xl border border-dashed bg-white px-6 py-12 text-center"><div class="text-sm font-medium">暂无车缝回货登记</div><p class="mt-2 text-xs text-muted-foreground">请先在公共 PDA 扫描回货来源码并完成 5 个 SKU 登记。</p><a data-nav="/fcs/pda/handover/sewing-self-return" class="mt-4 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">打开公共 PDA 回货登记</a></div>`
  }
  return `<div class="grid gap-3 xl:grid-cols-2">${records.map((record) => {
    const hasDifference = record.lines.some((line) => (line.differenceQty || 0) !== 0)
    return `<article class="rounded-xl border bg-card p-4 shadow-sm" data-return-card="${escapeHtml(record.deliveryId)}">
      <div class="flex items-start justify-between gap-3"><div><button type="button" class="font-mono text-sm font-semibold text-blue-700 hover:underline" data-nav="/fcs/craft/post-finishing/wait-process-warehouse?deliveryId=${encodeURIComponent(record.deliveryId)}">${escapeHtml(record.deliveryOrderNo)}</button><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.productionOrderNo)} · 第 ${record.returnIndex} 次回货 · ${escapeHtml(record.sewingFactoryName)}</div></div>${renderPostStatusBadge(record.status)}</div>
      <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(POST_FINISHING_SEWING_TASK_TYPE_LABEL[record.sewingTaskType])} · ${escapeHtml(record.sewingTaskNo)} · ${escapeHtml(record.executionTaskId)}</div>
      <div class="mt-3 grid grid-cols-3 gap-2 text-xs"><div class="rounded-lg bg-slate-50 p-2"><span class="text-muted-foreground">SKU</span><strong class="mt-1 block">${record.lines.length} 个</strong></div><div class="rounded-lg bg-slate-50 p-2"><span class="text-muted-foreground">工厂登记</span><strong class="mt-1 block">${qty(record, 'registeredQty')} 件</strong></div><div class="rounded-lg ${hasDifference ? 'bg-amber-50 text-amber-800' : 'bg-slate-50'} p-2"><span>后道最终确认</span><strong class="mt-1 block">${record.confirmedAt ? `${qty(record, 'confirmedQty')} 件` : '待点数'}</strong></div></div>
      <div class="mt-3 flex flex-wrap gap-2"><a data-nav="/fcs/craft/post-finishing/wait-process-warehouse?deliveryId=${encodeURIComponent(record.deliveryId)}" class="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white">${record.status === '已确认待送检' ? '查看并送检' : '点数确认'}</a>${record.qcTaskNo ? `<a data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(record.qcTaskNo)}" class="rounded-md border px-3 py-2 text-xs">质检任务 ${escapeHtml(record.qcTaskNo)}</a>` : ''}</div>
    </article>`
  }).join('')}</div>`
}

function renderWarehouseOverview(): string {
  const tab = currentTab()
  const deliveries = listPostFinishingFactoryReturns().sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
  const warehouseRecords = listPostFinishingWaitProcessWarehouseRecords()
  const movements = listPostFinishingWaitProcessWarehouseMovements()
  const pendingIds = new Set(warehouseRecords.filter((record) => record.status === '待确认').map((record) => record.deliveryId))
  const inventoryIds = new Set(warehouseRecords.filter((record) => record.status === '待送检').map((record) => record.deliveryId))
  const pendingDeliveries = deliveries.filter((record) => pendingIds.has(record.deliveryId))
  const inventoryDeliveries = deliveries.filter((record) => inventoryIds.has(record.deliveryId))
  const availableQty = warehouseRecords.reduce((sum, record) => sum + record.lines.reduce((lineSum, line) => lineSum + line.availableQty, 0), 0)
  const tabs = [
    { key: 'pending', label: `待确认回货 ${pendingDeliveries.length}` },
    { key: 'inventory', label: `可用库存 / 待送检 ${inventoryDeliveries.length}` },
    { key: 'movements', label: `出入库流水 ${movements.length}` },
  ] as const
  const tabHtml = `<nav class="flex flex-wrap gap-2 rounded-xl border bg-card p-2" aria-label="后道待加工仓视图">${tabs.map((item) => `<a data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=${item.key}" class="rounded-lg px-4 py-2 text-sm font-medium ${tab === item.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}">${item.label}</a>`).join('')}</nav>`
  const stats = `<div class="grid gap-3 sm:grid-cols-4"><div class="rounded-xl border bg-card p-4"><div class="text-xs text-muted-foreground">生产单</div><strong class="mt-1 block text-2xl">${new Set(deliveries.map((item) => item.productionOrderNo)).size}</strong></div><div class="rounded-xl border bg-card p-4"><div class="text-xs text-muted-foreground">回货单</div><strong class="mt-1 block text-2xl">${deliveries.length}</strong></div><div class="rounded-xl border bg-card p-4"><div class="text-xs text-muted-foreground">待确认</div><strong class="mt-1 block text-2xl">${pendingDeliveries.length}</strong></div><div class="rounded-xl border bg-card p-4"><div class="text-xs text-muted-foreground">仓内可用</div><strong class="mt-1 block text-2xl">${availableQty} 件</strong></div></div>`
  let content = renderDeliveryCards(pendingDeliveries)
  if (tab === 'inventory') {
    content = inventoryDeliveries.length
      ? `<div class="grid gap-3 xl:grid-cols-2">${inventoryDeliveries.map((delivery) => {
        const record = warehouseRecords.find((item) => item.deliveryId === delivery.deliveryId)!
        const qty = record.lines.reduce((sum, line) => sum + line.availableQty, 0)
        return `<article class="rounded-xl border bg-card p-4 shadow-sm" data-wait-process-inventory-card="${escapeHtml(record.warehouseRecordId)}"><div class="flex items-start justify-between gap-3"><div><div class="font-mono text-sm font-semibold">${escapeHtml(record.deliveryOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.productionOrderNo)} · 第 ${record.returnIndex} 次回货</div></div>${renderPostStatusBadge('待送检')}</div><div class="mt-3 grid grid-cols-3 gap-2 text-xs"><div class="rounded-lg bg-slate-50 p-2">暂存区<strong class="mt-1 block">${escapeHtml(record.areaName)}</strong></div><div class="rounded-lg bg-slate-50 p-2">库位<strong class="mt-1 block font-mono">${escapeHtml(record.locationCode)}</strong></div><div class="rounded-lg bg-blue-50 p-2 text-blue-800">可送检<strong class="mt-1 block">${qty} 件 · ${record.lines.length} SKU</strong></div></div><a data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=inventory&deliveryId=${encodeURIComponent(record.deliveryId)}" class="mt-3 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">查看并送检</a></article>`
      }).join('')}</div>`
      : '<div class="rounded-xl border border-dashed bg-white px-6 py-12 text-center text-sm text-muted-foreground">暂无已确认待送检库存。</div>'
  }
  if (tab === 'movements') {
    content = `<div class="overflow-x-auto rounded-xl border bg-card"><table class="min-w-[980px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">时间</th><th class="px-3 py-2">出入库动作</th><th class="px-3 py-2">送货单 / 生产单</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">操作人</th><th class="px-3 py-2">仓位</th></tr></thead><tbody class="divide-y">${movements.map((movement) => {
      const record = warehouseRecords.find((item) => item.warehouseRecordId === movement.warehouseRecordId)
      return `<tr data-wait-process-movement="${escapeHtml(movement.movementId)}"><td class="px-3 py-3">${escapeHtml(new Date(movement.operatedAt).toLocaleString('zh-CN'))}</td><td class="px-3 py-3 font-semibold ${movement.movementType === '确认入库' ? 'text-emerald-700' : 'text-blue-700'}">${escapeHtml(movement.movementType)}</td><td class="px-3 py-3"><div class="font-mono">${escapeHtml(movement.deliveryOrderNo)}</div><div class="text-xs text-muted-foreground">${escapeHtml(movement.productionOrderNo)}</div></td><td class="px-3 py-3">${movement.quantities.reduce((sum, line) => sum + line.quantity, 0)} 件 / ${movement.quantities.length} SKU</td><td class="px-3 py-3">${escapeHtml(movement.operator.actorName)}</td><td class="px-3 py-3 font-mono">${escapeHtml(record?.locationCode || '—')}</td></tr>`
    }).join('') || '<tr><td colspan="6" class="px-6 py-12 text-center text-muted-foreground">确认回货后生成入库流水，送检后生成出库流水。</td></tr>'}</tbody></table></div>`
  }
  return `${stats}<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><span>默认演示数据覆盖 3 个生产单 × 每单 5 个 SKU × 每单 5 次回货，并分布在待确认、在仓、质检、后道、复检和已出货状态。</span><button type="button" class="rounded-md border border-blue-300 bg-white px-3 py-2 text-xs font-medium" data-post-finishing-action="full-flow-load-demo">恢复 3×5×5 演示数据</button></div>${tabHtml}${content}`
}

function renderConfirmationVersionHistory(record: PostFinishingFactoryReturnDelivery): string {
  const versions = listPostFinishingReturnConfirmationVersions({ deliveryId: record.deliveryId })
  if (!versions.length) return ''
  return `<section class="rounded-xl border bg-card p-4"><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">后道最终确认版本</h3><p class="mt-1 text-xs text-muted-foreground">只有当前生效版本进入 PPIC 回货及 30% / 70% / 100% 节点；旧版本只作审计留痕。</p></div><span class="text-xs text-muted-foreground">${versions.length} 个版本</span></div><div class="mt-3 space-y-2">${versions.slice().reverse().map((version) => `<article class="rounded-lg border p-3 text-sm ${version.status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50' : 'bg-slate-50 text-slate-600'}"><div class="flex flex-wrap items-center justify-between gap-2"><div class="font-mono text-xs font-semibold">${escapeHtml(version.confirmationVersionId)}</div><span class="rounded-full border px-2 py-0.5 text-xs">${version.status === 'ACTIVE' ? '当前生效' : '已被订正'}</span></div><div class="mt-2 grid gap-2 text-xs md:grid-cols-4"><div>类型：${version.versionKind === 'FINAL_CONFIRMATION' ? '最终确认' : '主管订正'}</div><div>确认：${version.confirmedQty} 件</div><div>操作人：${escapeHtml(version.confirmedBy.actorName)}</div><div>时间：${escapeHtml(version.confirmedAt)}</div></div>${version.correctionReason ? `<div class="mt-2 text-xs">订正原因：${escapeHtml(version.correctionReason)}</div>` : ''}</article>`).join('')}</div></section>`
}

function renderConfirmationCorrection(record: PostFinishingFactoryReturnDelivery): string {
  if (record.status !== '已确认待送检') return ''
  return `<section class="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 class="font-semibold text-amber-900">后道回货主管订正</h3><p class="mt-1 text-xs text-amber-800">仅用于送检前发现最终确认数量有误。订正会生成新版本，原版本保留，不允许静默覆盖。</p><div class="mt-3 overflow-x-auto"><table class="min-w-[720px] w-full text-left text-sm"><thead><tr class="text-xs text-amber-900"><th class="px-3 py-2">SKU</th><th class="px-3 py-2">登记数量</th><th class="px-3 py-2">当前确认</th><th class="px-3 py-2">订正后数量</th></tr></thead><tbody class="divide-y divide-amber-200">${record.lines.map((line) => `<tr data-return-correction-line="${escapeHtml(line.sku.skuId)}"><td class="px-3 py-2">${escapeHtml(line.sku.skuCode)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</td><td class="px-3 py-2">${line.registeredQty} 件</td><td class="px-3 py-2">${line.confirmedQty ?? 0} 件</td><td class="px-3 py-2"><input type="number" min="0" step="1" value="${line.confirmedQty ?? 0}" class="h-9 w-24 rounded-md border bg-white px-2" data-return-correction-count /></td></tr>`).join('')}</tbody></table></div><label class="mt-3 block text-sm text-amber-900">订正原因<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2" data-return-correction-reason placeholder="必须说明为什么订正"></textarea></label><button type="button" class="mt-3 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white" data-post-finishing-action="full-flow-correct-return" data-delivery-id="${escapeHtml(record.deliveryId)}">主管确认订正并保留版本</button></section>`
}

function renderImageButton(record: PostFinishingFactoryReturnDelivery, line: PostFinishingFactoryReturnDelivery['lines'][number]): string {
  return `<button type="button" class="relative flex h-12 w-12 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(line.sku.imageUrl)}" data-image-label="${escapeHtml(`${line.sku.skuCode} ${line.sku.colorName} ${line.sku.sizeName}`)}"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" /><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button>`
}

function renderConfirmationDetail(record: PostFinishingFactoryReturnDelivery): string {
  const showSecond = ['待二次点数', '差异待授权'].includes(record.status)
  const showAuthorization = record.status === '差异待授权'
  const references = listPostFinishingQcReferences({ deliveryId: record.deliveryId })
  return `<div class="space-y-4" data-return-confirm-root="${escapeHtml(record.deliveryId)}">
    <div class="flex flex-wrap items-center justify-between gap-3"><button type="button" class="text-sm text-blue-700 hover:underline" data-nav="/fcs/craft/post-finishing/wait-process-warehouse">← 返回回货列表</button><div class="flex gap-2">${record.status === '已确认待送检' ? `<button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-post-finishing-action="full-flow-send-qc" data-delivery-id="${escapeHtml(record.deliveryId)}">送检并生成质检任务</button>` : ''}${record.qcTaskNo ? `<a data-nav="/fcs/craft/post-finishing/print?type=SEND_QC&id=${encodeURIComponent(record.deliveryId)}" class="rounded-md border px-3 py-2 text-sm">打印送检单</a><a data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(record.qcTaskNo)}" class="rounded-md border px-3 py-2 text-sm">打开质检任务</a>` : ''}</div></div>
    <section class="rounded-xl border bg-card p-4"><div class="flex items-start justify-between gap-4"><div><h2 class="text-lg font-semibold">${escapeHtml(record.deliveryOrderNo)}</h2><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)} · 第 ${record.returnIndex} 次回货 · ${escapeHtml(record.deliveryPersonName)}</p></div>${renderPostStatusBadge(record.status)}</div><div class="mt-3 grid gap-3 text-sm md:grid-cols-4"><div><span class="text-xs text-muted-foreground">执行任务</span><div>${escapeHtml(record.sewingTaskNo)}</div><div class="font-mono text-xs text-muted-foreground">${escapeHtml(record.executionTaskId)}</div></div><div><span class="text-xs text-muted-foreground">分配与任务类型</span><div>${escapeHtml(record.assignmentId)}</div><div class="text-xs text-muted-foreground">${escapeHtml(POST_FINISHING_SEWING_TASK_TYPE_LABEL[record.sewingTaskType])}</div></div><div><span class="text-xs text-muted-foreground">后道最终确认人</span><div>${escapeHtml(record.confirmedBy?.actorName || '—')}</div><div class="text-xs text-muted-foreground">${escapeHtml(record.confirmedAt || '尚未确认')}</div></div><div><span class="text-xs text-muted-foreground">差异授权人</span><div>${escapeHtml(record.returnAuthorizedBy ? `${record.returnAuthorizedBy.authorizerName} / ${record.returnAuthorizationId}` : '无需授权')}</div></div></div><div class="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">数据边界：工厂登记是申报；本页“后道最终确认”才是 PPIC 正式回货及履约节点的唯一数据源。</div></section>
    ${record.status !== '已确认待送检' && record.status !== '已送检' && record.status !== '已完成' ? `<section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">${showSecond ? '第二次点数' : '第一次点数'}</h3><p class="mt-1 text-xs text-muted-foreground">任一 SKU 首次差异率超过 5%才要求二次点数；二次点数仍超过 5%才需要授权。分母始终为工厂登记数量。</p><div class="mt-4 overflow-x-auto"><table class="min-w-[880px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">SKU</th><th class="px-3 py-2">登记数量</th><th class="px-3 py-2">第一次点数</th><th class="px-3 py-2">第二次点数</th><th class="px-3 py-2">最终差异</th></tr></thead><tbody class="divide-y">${record.lines.map((line) => `<tr data-return-count-line="${escapeHtml(line.sku.skuId)}"><td class="px-3 py-3"><div class="flex items-center gap-3">${renderImageButton(record, line)}<div><div class="font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div></div></div></td><td class="px-3 py-3 font-semibold">${line.registeredQty} 件</td><td class="px-3 py-3"><input type="number" min="0" step="1" value="${line.firstCountQty ?? line.registeredQty}" class="h-9 w-24 rounded-md border px-2" data-return-first-count /></td><td class="px-3 py-3"><input type="number" min="0" step="1" value="${line.secondCountQty ?? line.firstCountQty ?? line.registeredQty}" class="h-9 w-24 rounded-md border px-2 ${showSecond ? '' : 'bg-slate-100'}" data-return-second-count ${showSecond ? '' : 'disabled'} /></td><td class="px-3 py-3 text-xs">${line.confirmedQty === undefined ? '系统自动计算' : `${(line.differenceQty || 0) > 0 ? '多' : (line.differenceQty || 0) < 0 ? '少' : '一致'} ${Math.abs(line.differenceQty || 0)} 件 / ${((line.differenceRate || 0) * 100).toFixed(2)}%`}</td></tr>`).join('')}</tbody></table></div>${showAuthorization ? `<div class="mt-4 grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 md:grid-cols-2"><label class="text-sm">差异原因<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2" data-return-difference-reason placeholder="必须填写"></textarea></label><label class="text-sm">录入或粘贴动态授权码<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2 font-mono text-xs" data-return-authorization placeholder="PFAUTH:..."></textarea></label></div>` : ''}<button type="button" class="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-post-finishing-action="full-flow-confirm-return" data-delivery-id="${escapeHtml(record.deliveryId)}">${showSecond ? (showAuthorization ? '授权并确认回货' : '提交第二次点数') : '提交第一次点数'}</button></section>` : ''}
    ${renderConfirmationCorrection(record)}
    ${renderConfirmationVersionHistory(record)}
    <section class="rounded-xl border bg-card p-4"><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">质检参考资料</h3><p class="mt-1 text-xs text-muted-foreground">独立于技术包；买手上传，或 QC 根据飞书资料代上传。</p></div><span class="text-xs text-muted-foreground">${references.length} 份</span></div><div class="mt-3 grid gap-3 lg:grid-cols-2">${references.map((reference) => `<article class="rounded-lg border p-3 text-sm"><div class="font-semibold">${escapeHtml(reference.title)} · v${reference.version}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(reference.referenceType)} / ${escapeHtml(reference.source)} / ${escapeHtml(reference.uploaderName)}</div><p class="mt-2 text-xs">${escapeHtml(reference.description)}</p>${reference.imageUrl ? `<button type="button" class="relative mt-2 flex h-24 w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-md border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(reference.imageUrl)}" data-image-label="${escapeHtml(reference.title)}"><img src="${escapeHtml(reference.imageUrl)}" alt="${escapeHtml(reference.title)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" /><span class="px-2 text-xs text-muted-foreground">图片加载中…</span></button>` : ''}</article>`).join('') || '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">本次未上传质检参考资料，不伪造默认资料。</div>'}</div>${record.status === '已确认待送检' ? `<div class="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-2"><label class="text-sm">资料类型<select class="mt-1 h-9 w-full rounded-md border bg-white px-3" data-qc-reference-type><option>色差参考图</option><option>尺寸判断标准</option></select></label><label class="text-sm">上传来源<select class="mt-1 h-9 w-full rounded-md border bg-white px-3" data-qc-reference-source><option>买手上传</option><option>QC代上传</option></select></label><label class="text-sm">资料名称<input class="mt-1 h-9 w-full rounded-md border bg-white px-3" data-qc-reference-title placeholder="填写本批真实资料名称" /></label><label class="text-sm">实际来源<input class="mt-1 h-9 w-full rounded-md border bg-white px-3" data-qc-reference-source-note placeholder="QC 代上传时填写飞书实际来源" /></label><label class="text-sm md:col-span-2">判断说明<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2" data-qc-reference-description placeholder="填写本批真实判断说明"></textarea></label><label class="text-sm">选择本批参考图片<input type="file" accept="image/*" class="mt-1 block w-full rounded-md border bg-white p-2 text-xs" data-qc-reference-file /></label><label class="text-sm">或填写原型图片地址<input class="mt-1 h-9 w-full rounded-md border bg-white px-3" data-qc-reference-image placeholder="/materials/..." /></label><button type="button" class="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 md:col-span-2" data-post-finishing-action="full-flow-upload-reference" data-delivery-id="${escapeHtml(record.deliveryId)}">上传质检参考资料</button></div>` : ''}</section>
  </div>`
}

export function renderPostFinishingWaitProcessWarehousePage(): string {
  const selected = currentDeliveryId() ? getPostFinishingFactoryReturn(currentDeliveryId()) : undefined
  return `<div class="space-y-4 p-4" data-post-finishing-return-page>${renderPostFinishingPageHeader('后道待加工仓', '工厂登记形成待确认记录 → Web / PDA 确认入仓 → 从仓内送检出库')}${renderMessage()}${selected ? renderConfirmationDetail(selected) : renderWarehouseOverview()}</div>`
}

export function renderPostFinishingWaitHandoverWarehousePage(): string {
  return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('后道交出仓', '出货由复检完成自动生成；现场只扫描 FCK 后道出货单号')}<div class="rounded-xl border bg-card p-6"><h2 class="font-semibold">后道交出已收口到后道出货单</h2><p class="mt-2 text-sm text-muted-foreground">请在“后道出货单”查看待仓库接收记录；内部交接号仅作为后台关联事实，不再作为现场第二个扫码身份。</p><a data-nav="/fcs/craft/post-finishing/outbound-orders" class="mt-4 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">查看后道出货单</a></div></div>`
}

function showImage(url: string, label: string): void {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.innerHTML = `<button type="button" class="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm">关闭</button><div class="flex min-h-40 min-w-64 items-center justify-center rounded-xl bg-white p-3"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="max-h-[82vh] max-w-[86vw] rounded-xl object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败，请核对原图后重试';this.nextElementSibling.hidden=false" /><span class="p-8 text-sm text-slate-500">图片加载中…</span></div>`
  const close = () => {
    overlay.remove()
    document.removeEventListener('keydown', onKeydown)
  }
  const onKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
  overlay.addEventListener('click', close)
  document.addEventListener('keydown', onKeydown)
  document.body.appendChild(overlay)
}

export function handlePostFinishingReturnFlowEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action]')
  const action = actionNode?.dataset.postFinishingAction
  if (!action?.startsWith('full-flow-')) return false
  try {
    if (action === 'full-flow-zoom-image' && actionNode?.dataset.imageUrl) {
      showImage(actionNode.dataset.imageUrl, actionNode.dataset.imageLabel || '产品图片')
      return true
    }
    if (action === 'full-flow-load-demo') {
      loadPostFinishingDemoData()
      pageMessage = '已恢复 3 个生产单 × 5 个 SKU × 5 次回货演示数据。'
      pageMessageTone = 'success'
      refresh('')
      return true
    }
    const deliveryId = actionNode?.dataset.deliveryId || currentDeliveryId()
    if (!deliveryId) throw new Error('缺少送货单。')
    if (action === 'full-flow-confirm-return') {
      const root = document.querySelector<HTMLElement>('[data-return-confirm-root]')
      if (!root) throw new Error('未找到回货确认表单。')
      const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-return-count-line]'))
      const current = getPostFinishingFactoryReturn(deliveryId)
      if (!current) throw new Error('未找到送货单。')
      const firstCounts = lines.map((line) => ({ skuId: line.dataset.returnCountLine || '', actualQty: Number(line.querySelector<HTMLInputElement>('[data-return-first-count]')?.value || 0) }))
      const showSecond = ['待二次点数', '差异待授权'].includes(current.status)
      const secondCounts = showSecond ? lines.map((line) => ({ skuId: line.dataset.returnCountLine || '', actualQty: Number(line.querySelector<HTMLInputElement>('[data-return-second-count]')?.value || 0) })) : undefined
      confirmPostFinishingFactoryReturn({
        deliveryId,
        firstCounts,
        secondCounts,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
        authorization: current.status === '差异待授权' ? {
          scanValue: root.querySelector<HTMLTextAreaElement>('[data-return-authorization]')?.value || '',
          differenceReason: root.querySelector<HTMLTextAreaElement>('[data-return-difference-reason]')?.value || '',
        } : undefined,
      })
      pageMessage = '后道已最终确认回货；当前生效版本已进入 PPIC 回货及 30% / 70% / 100% 节点。'
    }
    if (action === 'full-flow-correct-return') {
      const root = document.querySelector<HTMLElement>('[data-return-confirm-root]')
      if (!root) throw new Error('未找到回货订正表单。')
      const correctedCounts = Array.from(root.querySelectorAll<HTMLElement>('[data-return-correction-line]')).map((line) => ({
        skuId: line.dataset.returnCorrectionLine || '',
        actualQty: Number(line.querySelector<HTMLInputElement>('[data-return-correction-count]')?.value || 0),
      }))
      correctPostFinishingFactoryReturnConfirmation({
        deliveryId,
        correctedCounts,
        correctionReason: root.querySelector<HTMLTextAreaElement>('[data-return-correction-reason]')?.value || '',
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnSupervisor,
      })
      pageMessage = '后道最终确认已由回货主管订正；新版本生效，原版本已保留。'
    }
    if (action === 'full-flow-send-qc') {
      const task = sendPostFinishingFactoryReturnToQc({ deliveryId, actor: POST_FINISHING_ACCEPTANCE_ACTORS.sender })
      pageMessage = `送检成功：${task.qcTaskNo}`
    }
    if (action === 'full-flow-upload-reference') {
      const root = document.querySelector<HTMLElement>('[data-return-confirm-root]')
      if (!root) throw new Error('未找到资料上传表单。')
      const source = root.querySelector<HTMLSelectElement>('[data-qc-reference-source]')?.value as '买手上传' | 'QC代上传'
      uploadPostFinishingDeliveryQcReference({
        deliveryId,
        referenceType: root.querySelector<HTMLSelectElement>('[data-qc-reference-type]')?.value as '色差参考图' | '尺寸判断标准',
        title: root.querySelector<HTMLInputElement>('[data-qc-reference-title]')?.value || '',
        description: root.querySelector<HTMLTextAreaElement>('[data-qc-reference-description]')?.value || '',
        imageUrl: root.querySelector<HTMLInputElement>('[data-qc-reference-file]')?.files?.[0]
          ? URL.createObjectURL(root.querySelector<HTMLInputElement>('[data-qc-reference-file]')!.files![0]!)
          : root.querySelector<HTMLInputElement>('[data-qc-reference-image]')?.value || undefined,
        source,
        sourceNote: root.querySelector<HTMLInputElement>('[data-qc-reference-source-note]')?.value || undefined,
        actor: source === '买手上传' ? POST_FINISHING_ACCEPTANCE_ACTORS.buyer : POST_FINISHING_ACCEPTANCE_ACTORS.qcA,
      })
      pageMessage = '质检参考资料已上传并绑定本次送货。'
    }
    pageMessageTone = 'success'
  } catch (error) {
    pageMessage = error instanceof Error ? error.message : '操作失败，请重新核对。'
    pageMessageTone = 'error'
  }
  refresh(actionNode?.dataset.deliveryId || currentDeliveryId())
  return true
}
