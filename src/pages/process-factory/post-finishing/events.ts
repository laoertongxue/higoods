import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import {
  confirmPostFinishingWarehouseReceipt,
  deletePostFinishingWarehouseLocation,
  listPostFinishingUpstreamHandovers,
  listPostFinishingWarehouseAreas,
  listPostFinishingWarehouseLocations,
  lookupPostFinishingUpstreamHandover,
  upsertPostFinishingWarehouseArea,
  upsertPostFinishingWarehouseLocation,
  type PostFinishingUpstreamHandover,
  type PostFinishingWarehouseMode,
} from '../../../data/fcs/post-finishing-domain.ts'
import {
  handleProcessWebStatusActionDialogEvent,
  openProcessWebStatusActionDialog,
} from '../shared/web-status-action-dialog.ts'

const POST_FINISHING_WAREHOUSE_FORM_MODAL_ID = 'post-finishing-warehouse-form-modal'
const POST_FINISHING_RECEIPT_MODAL_ID = 'post-finishing-receipt-modal'

function showPostFinishingToast(message: string): void {
  if (typeof document === 'undefined') return
  const root = document.getElementById('post-finishing-page-toast-root') || document.body
  const toast = document.createElement('div')
  toast.className = 'fixed right-4 top-4 z-[180] rounded-md border bg-background px-3 py-2 text-sm shadow-lg'
  toast.textContent = message
  root.appendChild(toast)
  window.setTimeout(() => toast.remove(), 2400)
}

function refreshCurrentPage(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('actionResultAt', String(Date.now()))
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  appStore.navigate(`${url.pathname}${url.search}`)
}

function removePostFinishingWarehouseFormDialog(): void {
  document.getElementById(POST_FINISHING_WAREHOUSE_FORM_MODAL_ID)?.remove()
}

function removePostFinishingReceiptDialog(): void {
  document.getElementById(POST_FINISHING_RECEIPT_MODAL_ID)?.remove()
}

function readWarehouseFormField(modal: HTMLElement, field: string): string {
  return modal.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-post-warehouse-form-field="${field}"]`)?.value.trim() || ''
}

function openPostFinishingWarehouseAreaDialog(input: {
  warehouseMode: PostFinishingWarehouseMode
  areaId?: string
  areaCode?: string
  areaName?: string
  managerName?: string
  remark?: string
}): void {
  removePostFinishingWarehouseFormDialog()
  const isEdit = Boolean(input.areaId)
  document.body.insertAdjacentHTML('beforeend', `
    <div id="${POST_FINISHING_WAREHOUSE_FORM_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="w-full max-w-2xl rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 class="text-base font-semibold">${isEdit ? '编辑库区' : '新增库区'}</h2>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-post-warehouse-form-action="close">关闭</button>
        </header>
        <div class="grid gap-3 p-4 md:grid-cols-2">
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">库区编号 *</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.areaCode || '')}" placeholder="${input.warehouseMode === 'wait-process' ? 'PFP-C' : 'PFH-C'}" data-post-warehouse-form-field="areaCode" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">库区名称 *</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.areaName || '')}" placeholder="${input.warehouseMode === 'wait-process' ? '后道待加工仓 C 区' : '后道待交出仓 C 区'}" data-post-warehouse-form-field="areaName" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">负责人</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.managerName || '后道仓管员')}" data-post-warehouse-form-field="managerName" />
          </label>
          <label class="text-sm md:col-span-2">
            <span class="text-xs text-muted-foreground">备注</span>
            <textarea class="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" data-post-warehouse-form-field="remark">${escapeHtml(input.remark || '')}</textarea>
          </label>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-post-warehouse-form-action="close">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-post-warehouse-form-action="submit-area">保存库区</button>
        </footer>
      </section>
    </div>
  `)

  const modal = document.getElementById(POST_FINISHING_WAREHOUSE_FORM_MODAL_ID)
  if (!modal) return
  modal.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-post-warehouse-form-action]')?.dataset.postWarehouseFormAction
    if (!action) return
    if (action === 'close') {
      removePostFinishingWarehouseFormDialog()
      return
    }
    if (action === 'submit-area') {
      const areaCode = readWarehouseFormField(modal, 'areaCode')
      const areaName = readWarehouseFormField(modal, 'areaName')
      if (!areaCode || !areaName) {
        window.alert('请填写库区编号和库区名称。')
        return
      }
      upsertPostFinishingWarehouseArea({
        areaId: input.areaId,
        warehouseMode: input.warehouseMode,
        areaCode,
        areaName,
        managerName: readWarehouseFormField(modal, 'managerName') || '后道仓管员',
        remark: readWarehouseFormField(modal, 'remark'),
      })
      removePostFinishingWarehouseFormDialog()
      refreshCurrentPage()
    }
  })
}

function openPostFinishingWarehouseLocationDialog(input: {
  warehouseMode: PostFinishingWarehouseMode
  locationId?: string
  areaId?: string
  areaName?: string
  locationCode?: string
  managerName?: string
  remark?: string
}): void {
  removePostFinishingWarehouseFormDialog()
  const isEdit = Boolean(input.locationId)
  const areas = listPostFinishingWarehouseAreas(input.warehouseMode)
  const selectedAreaId = input.areaId || areas.find((area) => area.areaName === input.areaName)?.areaId || areas[0]?.areaId || ''
  const areaOptions = areas
    .map((area) => `
      <option value="${escapeHtml(area.areaId)}" ${area.areaId === selectedAreaId ? 'selected' : ''}>
        ${escapeHtml(area.areaName)} / ${escapeHtml(area.areaCode)}
      </option>
    `)
    .join('')

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${POST_FINISHING_WAREHOUSE_FORM_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="w-full max-w-2xl rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 class="text-base font-semibold">${isEdit ? '编辑库位' : '新增库位'}</h2>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-post-warehouse-form-action="close">关闭</button>
        </header>
        <div class="grid gap-3 p-4 md:grid-cols-2">
          <label class="text-sm md:col-span-2">
            <span class="text-xs text-muted-foreground">所属库区 *</span>
            <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-post-warehouse-form-field="areaId">
              ${areaOptions}
            </select>
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">库位编号 *</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.locationCode || '')}" placeholder="${input.warehouseMode === 'wait-process' ? 'PFP-A-03' : 'PFH-A-03'}" data-post-warehouse-form-field="locationCode" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">负责人</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.managerName || '后道仓管员')}" data-post-warehouse-form-field="managerName" />
          </label>
          <label class="text-sm md:col-span-2">
            <span class="text-xs text-muted-foreground">备注</span>
            <textarea class="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" data-post-warehouse-form-field="remark">${escapeHtml(input.remark || '')}</textarea>
          </label>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-post-warehouse-form-action="close">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-post-warehouse-form-action="submit-location">保存库位</button>
        </footer>
      </section>
    </div>
  `)

  const modal = document.getElementById(POST_FINISHING_WAREHOUSE_FORM_MODAL_ID)
  if (!modal) return
  modal.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-post-warehouse-form-action]')?.dataset.postWarehouseFormAction
    if (!action) return
    if (action === 'close') {
      removePostFinishingWarehouseFormDialog()
      return
    }
    if (action === 'submit-location') {
      const areaId = readWarehouseFormField(modal, 'areaId')
      const locationCode = readWarehouseFormField(modal, 'locationCode')
      if (!areaId || !locationCode) {
        window.alert('请选择所属库区并填写库位编号。')
        return
      }
      upsertPostFinishingWarehouseLocation({
        locationId: input.locationId,
        warehouseMode: input.warehouseMode,
        areaId,
        locationCode,
        managerName: readWarehouseFormField(modal, 'managerName') || '后道仓管员',
        remark: readWarehouseFormField(modal, 'remark'),
      })
      removePostFinishingWarehouseFormDialog()
      refreshCurrentPage()
    }
  })
}

function renderReceiptAreaOptions(selectedAreaId = ''): string {
  const areas = listPostFinishingWarehouseAreas('wait-process')
  return areas
    .map((area) => `<option value="${escapeHtml(area.areaId)}" ${area.areaId === selectedAreaId ? 'selected' : ''}>${escapeHtml(area.areaName)} / ${escapeHtml(area.areaCode)}</option>`)
    .join('')
}

function renderReceiptLocationOptions(areaId: string, selectedLocationId = ''): string {
  const locations = listPostFinishingWarehouseLocations('wait-process').filter((location) => location.areaId === areaId)
  if (locations.length === 0) return '<option value="">仅库区</option>'
  return [
    '<option value="">仅库区</option>',
    ...locations.map((location) => `<option value="${escapeHtml(location.locationId)}" ${location.locationId === selectedLocationId ? 'selected' : ''}>${escapeHtml(location.locationCode)}</option>`),
  ].join('')
}

function renderReceiptDetails(handover: PostFinishingUpstreamHandover | undefined): string {
  if (!handover) {
    return `
      <div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        请输入车缝任务或针织任务的交出记录编号，也可以扫码二维码后读取明细。
      </div>
    `
  }
  const areas = listPostFinishingWarehouseAreas('wait-process')
  const defaultAreaId = areas[0]?.areaId || ''
  const rows = handover.skuLines.map((line) => `
    <tr class="align-top" data-post-receipt-line-id="${escapeHtml(line.handoverLineId)}">
      <td class="px-3 py-3">
        <div class="font-mono text-xs">${escapeHtml(line.skuCode)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.colorName)} / ${escapeHtml(line.sizeName)}</div>
      </td>
      <td class="px-3 py-3 text-sm">${escapeHtml(String(line.plannedQty))} ${escapeHtml(line.qtyUnit)}</td>
      <td class="px-3 py-3">
        <input class="h-9 w-28 rounded-md border bg-background px-3 text-sm" type="number" min="0" value="${escapeHtml(String(line.plannedQty))}" data-post-receipt-field="actualQty" />
      </td>
      <td class="px-3 py-3">
        <select class="h-9 min-w-52 rounded-md border bg-background px-3 text-sm" data-post-receipt-field="areaId">
          ${renderReceiptAreaOptions(defaultAreaId)}
        </select>
      </td>
      <td class="px-3 py-3">
        <select class="h-9 min-w-36 rounded-md border bg-background px-3 text-sm" data-post-receipt-field="locationId">
          ${renderReceiptLocationOptions(defaultAreaId)}
        </select>
      </td>
    </tr>
  `).join('')
  return `
    <div class="space-y-3">
      <div class="grid gap-3 rounded-lg border bg-slate-50 p-3 text-sm md:grid-cols-4">
        <div><span class="text-xs text-muted-foreground">交出记录</span><div class="mt-1 font-mono">${escapeHtml(handover.handoverRecordNo)}</div></div>
        <div><span class="text-xs text-muted-foreground">上游任务</span><div class="mt-1">${escapeHtml(handover.sourceFactoryType)} / ${escapeHtml(handover.sourceTaskNo)}</div></div>
        <div><span class="text-xs text-muted-foreground">上游工厂</span><div class="mt-1">${escapeHtml(handover.sourceFactoryName)}</div></div>
        <div><span class="text-xs text-muted-foreground">生产单 / 款式</span><div class="mt-1">${escapeHtml(handover.productionOrderNo)} / ${escapeHtml(handover.spuName)}</div></div>
      </div>
      <div class="overflow-x-auto rounded-lg border">
        <table class="min-w-[980px] w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">交出明细</th>
              <th class="px-3 py-2 font-medium">交出数量</th>
              <th class="px-3 py-2 font-medium">实收数量</th>
              <th class="px-3 py-2 font-medium">库区</th>
              <th class="px-3 py-2 font-medium">库位</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `
}

function loadReceiptDetails(modal: HTMLElement): void {
  const keyword = modal.querySelector<HTMLInputElement>('[data-post-receipt-field="handoverNo"]')?.value.trim() || ''
  const details = modal.querySelector<HTMLElement>('[data-post-receipt-details]')
  if (!details) return
  const handover = lookupPostFinishingUpstreamHandover(keyword)
  details.innerHTML = renderReceiptDetails(handover)
  if (!handover) showPostFinishingToast('未找到该交出记录，请核对编号或二维码。')
}

function syncReceiptLocationSelect(row: HTMLElement): void {
  const areaId = row.querySelector<HTMLSelectElement>('[data-post-receipt-field="areaId"]')?.value || ''
  const locationSelect = row.querySelector<HTMLSelectElement>('[data-post-receipt-field="locationId"]')
  if (!locationSelect) return
  locationSelect.innerHTML = renderReceiptLocationOptions(areaId)
}

function openPostFinishingReceiptDialog(): void {
  removePostFinishingReceiptDialog()
  const handovers = listPostFinishingUpstreamHandovers()
  const examples = handovers.slice(0, 3).map((handover) => `
    <button type="button" class="rounded-full border px-2 py-1 text-xs hover:bg-muted" data-post-receipt-action="fill-handover" data-handover-no="${escapeHtml(handover.handoverRecordNo)}">
      ${escapeHtml(handover.sourceFactoryType)} ${escapeHtml(handover.handoverRecordNo)}
    </button>
  `).join('')

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${POST_FINISHING_RECEIPT_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">扫码收货</h2>
            <div class="mt-1 text-xs text-muted-foreground">读取车缝任务或针织任务的交出明细后，逐行确认实收数量和存放库区库位。</div>
          </div>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-post-receipt-action="close">关闭</button>
        </header>
        <div class="space-y-4 overflow-y-auto p-4">
          <div class="grid gap-3 md:grid-cols-[1fr_auto]">
            <label class="text-sm">
              <span class="text-xs text-muted-foreground">车缝任务/针织任务交出记录编号或二维码 *</span>
              <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="例如 SEW-HO-202605-001 或 QR-SEW-HO-202605-001" data-post-receipt-field="handoverNo" />
            </label>
            <div class="flex items-end gap-2">
              <button type="button" class="h-10 rounded-md border px-3 text-sm hover:bg-muted" data-post-receipt-action="load">获取明细</button>
              <button type="button" class="h-10 rounded-md border px-3 text-sm hover:bg-muted" data-post-receipt-action="scan-demo">扫码识别</button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">${examples}</div>
          <div data-post-receipt-details>${renderReceiptDetails(undefined)}</div>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-post-receipt-action="close">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-post-receipt-action="submit">收货确认</button>
        </footer>
      </section>
    </div>
  `)

  const modal = document.getElementById(POST_FINISHING_RECEIPT_MODAL_ID)
  if (!modal) return
  modal.addEventListener('change', (event) => {
    const field = (event.target as HTMLElement).closest<HTMLElement>('[data-post-receipt-field]')?.dataset.postReceiptField
    if (field !== 'areaId') return
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-post-receipt-line-id]')
    if (row) syncReceiptLocationSelect(row)
  })
  modal.addEventListener('click', (event) => {
    const actionNode = (event.target as HTMLElement).closest<HTMLElement>('[data-post-receipt-action]')
    const action = actionNode?.dataset.postReceiptAction
    if (!action) return
    if (action === 'close') {
      removePostFinishingReceiptDialog()
      return
    }
    if (action === 'fill-handover') {
      const input = modal.querySelector<HTMLInputElement>('[data-post-receipt-field="handoverNo"]')
      if (input) input.value = actionNode.dataset.handoverNo || ''
      loadReceiptDetails(modal)
      return
    }
    if (action === 'scan-demo') {
      const input = modal.querySelector<HTMLInputElement>('[data-post-receipt-field="handoverNo"]')
      if (input) input.value = handovers[0]?.qrCode || ''
      loadReceiptDetails(modal)
      return
    }
    if (action === 'load') {
      loadReceiptDetails(modal)
      return
    }
    if (action === 'submit') {
      if (actionNode instanceof HTMLButtonElement) actionNode.disabled = true
      const handoverNo = modal.querySelector<HTMLInputElement>('[data-post-receipt-field="handoverNo"]')?.value.trim() || ''
      const rows = Array.from(modal.querySelectorAll<HTMLElement>('[data-post-receipt-line-id]'))
      const lines = rows.map((row) => ({
        handoverLineId: row.dataset.postReceiptLineId || '',
        actualQty: Number(row.querySelector<HTMLInputElement>('[data-post-receipt-field="actualQty"]')?.value || 0),
        areaId: row.querySelector<HTMLSelectElement>('[data-post-receipt-field="areaId"]')?.value || '',
        locationId: row.querySelector<HTMLSelectElement>('[data-post-receipt-field="locationId"]')?.value || '',
      }))
      try {
        const created = confirmPostFinishingWarehouseReceipt({
          handoverRecordNo: handoverNo,
          receiverName: '后道收货员',
          lines,
        })
        window.setTimeout(() => {
          removePostFinishingReceiptDialog()
          showPostFinishingToast(`已生成 ${created.length} 条收货入库流水。`)
          const url = new URL(window.location.href)
          url.searchParams.set('tab', 'flow')
          url.searchParams.set('keyword', handoverNo.replace(/^QR-/, ''))
          url.searchParams.set('page', '1')
          appStore.navigate(`${url.pathname}${url.search}`)
        }, 0)
      } catch (error) {
        if (actionNode instanceof HTMLButtonElement) actionNode.disabled = false
        window.alert(error instanceof Error ? error.message : '收货确认失败。')
      }
    }
  })
}

export function handlePostFinishingEvent(target: HTMLElement): boolean {
  const dialogResult = handleProcessWebStatusActionDialogEvent(target, {
    toast: showPostFinishingToast,
    refresh: refreshCurrentPage,
  })
  if (dialogResult !== null) return dialogResult

  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.postFinishingAction
  if (action === 'open-web-status-action-dialog') {
    openProcessWebStatusActionDialog({
      actionNode,
      sourceType: 'POST_FINISHING_WORK_ORDER',
    })
    return false
  }

  if (action === 'open-receipt-dialog') {
    openPostFinishingReceiptDialog()
    return true
  }

  if (action === 'add-area') {
    const warehouseMode = actionNode.dataset.warehouseMode as PostFinishingWarehouseMode | undefined
    if (!warehouseMode) return true
    openPostFinishingWarehouseAreaDialog({
      warehouseMode,
      areaCode: warehouseMode === 'wait-process' ? 'PFP-C' : 'PFH-C',
      areaName: warehouseMode === 'wait-process' ? '后道待加工仓 C 区' : '后道待交出仓 C 区',
      managerName: '后道仓管员',
      remark: 'Web新增库区',
    })
    return true
  }

  if (action === 'edit-area') {
    const warehouseMode = actionNode.dataset.warehouseMode as PostFinishingWarehouseMode | undefined
    const areaId = actionNode.dataset.areaId
    if (!warehouseMode || !areaId) return true
    openPostFinishingWarehouseAreaDialog({
      areaId,
      warehouseMode,
      areaCode: actionNode.dataset.areaCode || '',
      areaName: actionNode.dataset.areaName || '',
      managerName: actionNode.dataset.managerName || '后道仓管员',
      remark: actionNode.dataset.remark || '',
    })
    return true
  }

  if (action === 'add-location') {
    const warehouseMode = actionNode.dataset.warehouseMode as PostFinishingWarehouseMode | undefined
    if (!warehouseMode) return true
    openPostFinishingWarehouseLocationDialog({
      warehouseMode,
      locationCode: warehouseMode === 'wait-process' ? 'PFP-A-03' : 'PFH-A-03',
      managerName: '后道仓管员',
      remark: 'Web新增库位',
    })
    return true
  }

  if (action === 'edit-location') {
    const warehouseMode = actionNode.dataset.warehouseMode as PostFinishingWarehouseMode | undefined
    const locationId = actionNode.dataset.locationId
    if (!warehouseMode || !locationId) return true
    openPostFinishingWarehouseLocationDialog({
      locationId,
      warehouseMode,
      areaId: actionNode.dataset.areaId || '',
      areaName: actionNode.dataset.areaName || '',
      locationCode: actionNode.dataset.locationCode || '',
      managerName: actionNode.dataset.managerName || '后道仓管员',
      remark: actionNode.dataset.remark || '',
    })
    return true
  }

  if (action === 'delete-location' && actionNode.dataset.locationId) {
    if (window.confirm('确认删除该库区库位？')) {
      deletePostFinishingWarehouseLocation(actionNode.dataset.locationId)
      refreshCurrentPage()
    }
    return true
  }

  return false
}
