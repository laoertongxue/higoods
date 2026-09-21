import { escapeHtml as e } from '../../../utils.ts'
import { renderButton } from '../../../components/ui/button.ts'
import { appStore } from '../../../state/store.ts'
import { readTmfOutputReceiptScan, readTmfPdaReceiptState } from '../../../data/fcs/tmf-pda-output-receipts.ts'
import { receiveTmfOutputPackage, type TmfPurchaseActor } from '../../../data/pms/tmf-material-purchases.ts'

const prefix = 'tmf-pda-receipt'
const actor: TmfPurchaseActor = { id: 'TMF-DEMO-WAREHOUSE-CLERK', name: '辅料仓管（演示）', role: '仓管' }
type Receipt = ReturnType<typeof readTmfOutputReceiptScan>
const root = () => document.querySelector<HTMLElement>('[data-tmf-pda-receipt-root]')
const button = (action: string, label: string, primary = false) => renderButton({ label, variant: primary ? 'primary' : 'secondary', size: 'lg', className: 'w-full mt-3', action: { prefix, action, skipPageRerender: true } })
const input = (name: string, label: string, value = '', type = 'text', locked = false) => `<label class="block mt-3 text-sm">${e(label)}<input name="${name}" type="${type}" value="${e(value)}" ${locked ? 'readonly' : ''} ${type === 'number' ? 'min="1" step="1" inputmode="numeric"' : ''} class="mt-1 w-full min-w-0 rounded border p-3" data-skip-page-rerender="true"></label>`
const endText = (end: Receipt['pkg']['endA']) => ({ NONE: '不打头', METAL: '金属头', PLASTIC_WRAP: '塑料包头', SILICONE_DIP: '硅胶浸头' }[end.method]) + (end.specification ? ` · ${end.specification}` : '') + (end.coverageMm ? ` · 覆盖 ${end.coverageMm}mm` : '')

function bind(): void {
  const el = root()
  if (!el || el.dataset.bound) return
  el.dataset.bound = 'true'
  let warehouse = '', receipt: Receipt | undefined, operationId = '', step = 'scan'
  const host = el.querySelector<HTMLElement>('[data-tmf-pda-receipt-content]')!
  const value = (name: string) => host.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value.trim() ?? ''
  const error = (message: string) => { el.querySelector<HTMLElement>('[role="alert"]')!.textContent = message }
  function scanPage() {
    step = 'scan'; receipt = undefined; operationId = ''
    const data = readTmfPdaReceiptState()
    const warehouses = [...new Set(data.outputHandovers.filter(h => h.receivedPieces < h.dispatchedPieces).map(h => h.warehouseId))]
    host.innerHTML = `<p class="font-medium">1 / 3 选择本仓并扫码</p><label class="block mt-3 text-sm">本次收货仓<select name="warehouse" class="mt-1 w-full rounded border p-3" data-skip-page-rerender="true"><option value="">请选择</option>${warehouses.map(id => `<option value="${e(id)}" ${id === warehouse ? 'selected' : ''}>${e(id)}</option>`).join('')}</select></label>${warehouses.length ? '' : '<p class="mt-3 text-amber-700">暂无待收产出包，请核对工厂是否已交出。</p>'}${input('scan', '扫描包号或交出单二维码')}${button('scan', '识别产出包', true)}${button('exit', '返回原料仓 PDA')}`
    host.querySelector<HTMLInputElement>('[name="scan"]')?.focus()
  }
  function summary(r: Receipt) {
    return `<div class="mt-3 space-y-2 break-words text-sm"><p>包号：${e(r.pkg.id)}</p><p>生产单：${e(r.demand.productionOrderNo)}</p><p>${e(r.demand.specification.usage)} · ${e(r.demand.garmentColor)} · ${e(r.demand.garmentSize)}</p><p>半成品：${e(r.pkg.materialSkuId)}</p><p class="text-lg font-semibold">成品 ${r.pkg.actualFinishedLengthMm}mm · 待收 ${r.remaining} ${r.pkg.unit}</p><p>实际下料 ${r.pkg.actualCutLengthMm}mm</p><p>A 端：${e(endText(r.pkg.endA))}</p><p>B 端：${e(endText(r.pkg.endB))}</p><p>交出 ${r.handover.dispatchedPieces} / 已收 ${r.handover.receivedPieces} ${r.pkg.unit}</p><p>技术包 ${e(r.demand.techPackVersionId)}</p><p class="text-amber-700">加工实物图待补，请核对现场实物。</p>${r.restricted ? '<p class="text-amber-700">生产单受限：本包仍需如实收货，收后不可发料。</p>' : ''}</div>`
  }
  function confirmPage() {
    step = 'verify'
    host.innerHTML = `<p class="font-medium">2 / 3 核对实物</p>${summary(receipt!)}${input('production', '扫描或输入生产单号')}<label class="flex gap-3 mt-4 text-sm"><input name="checked" type="checkbox" class="h-5 w-5 shrink-0">已核对长度、两端方式和合格状态与实物一致</label>${button('verified', '核对无误，登记数量', true)}${button('restart', '重新扫描')}`
  }
  function quantityPage() {
    step = 'quantity'
    host.innerHTML = `<p class="font-medium">3 / 3 登记实收</p>${summary(receipt!)}${input('pieces', `本次实际收到（${receipt!.pkg.unit}）`, '', 'number')}${input('location', receipt!.pkg.location ? '原收货库位（补收不能改库位）' : '实际库位', receipt!.pkg.location ?? '', 'text', !!receipt!.pkg.location)}${button('save', '确认实收', true)}${button('restart', '重新扫描')}`
  }
  function act(action: string) {
    error('')
    try {
      if (action === 'exit') { appStore.navigate('/wls/raw/pda'); return }
      if (action === 'restart') { scanPage(); return }
      if (action === 'scan' && step === 'scan') {
        warehouse = value('warehouse')
        receipt = readTmfOutputReceiptScan(value('scan'), warehouse)
        operationId = `tmf-pda-receipt:${crypto.randomUUID()}`
        confirmPage()
      } else if (action === 'verified' && step === 'verify') {
        if (value('production') !== receipt!.demand.productionOrderNo) throw new Error('生产单号不符，请扫描本包所属生产单。')
        if (!host.querySelector<HTMLInputElement>('[name="checked"]')?.checked) throw new Error('请先核对实物长度、两端方式及合格状态。')
        quantityPage()
      } else if (action === 'save' && step === 'quantity') {
        const pieces = Number(value('pieces')), location = value('location'), r = receipt!
        if (!Number.isSafeInteger(pieces) || pieces <= 0 || pieces > r.remaining) throw new Error(`本次实收须为 1～${r.remaining} ${r.pkg.unit}的整数。`)
        if (!location) throw new Error('请扫描或填写实际库位。')
        receiveTmfOutputPackage({ handoverId: r.handover.id, packageId: r.pkg.id, warehouseId: warehouse, demandId: r.demand.id, location, receivedPieces: pieces, expectedReceivedPieces: r.handover.receivedPieces }, actor, operationId)
        step = 'done'
        host.innerHTML = `<p class="text-lg font-semibold text-green-700">已登记实收 ${pieces} ${r.pkg.unit}</p><p class="mt-3 break-words">${e(r.pkg.id)}</p><p class="mt-2">累计实收 ${r.handover.receivedPieces + pieces}，待收 ${r.remaining - pieces} ${r.pkg.unit}</p><p class="mt-2">库位 ${e(location)}</p>${button('restart', '扫描下一包', true)}${button('exit', '返回原料仓 PDA')}`
      }
    } catch (err) { error(err instanceof Error ? err.message : '未能确认保存结果，请重试或联系主管核对。') }
  }
  el.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`)
    if (!target) return
    event.stopPropagation(); act(target.getAttribute(`data-${prefix}-action`)!)
  })
  el.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return
    event.preventDefault(); event.stopPropagation()
    if (event.target.name === 'scan') act('scan')
    else if (event.target.name === 'production') host.querySelector<HTMLInputElement>('[name="checked"]')?.focus()
  })
  try { scanPage() } catch (err) { error(err instanceof Error ? err.message : '读取收货资料失败，请联系主管。') }
}

export function renderTmfPdaOutputReceipts(): string {
  requestAnimationFrame(bind)
  return `<div data-tmf-pda-receipt-root data-skip-page-rerender="true" class="mx-auto min-h-screen max-w-md bg-slate-100 p-4"><header class="mb-4"><h1 class="text-lg font-semibold">织带产出收货</h1><p class="text-xs text-slate-500">辅料仓管（演示）</p></header><div data-tmf-pda-receipt-content class="rounded-lg bg-white p-4"></div><p role="alert" class="mt-3 break-words text-sm text-red-700"></p></div>`
}
