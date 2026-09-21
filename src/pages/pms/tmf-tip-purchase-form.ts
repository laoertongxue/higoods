import { renderDialog } from '../../components/ui/dialog.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { getTmfPurchaseState } from '../../data/pms/tmf-material-purchases.ts'
import { escapeHtml as e } from '../../utils.ts'

const prefix = 'pms-mpo'
function sources() {
  const state = getTmfPurchaseState()
  return state.demands.filter(demand => demand.specification.tippingRequired
    && !state.productionControls.some(control => control.productionOrderId === demand.productionOrderId && control.status !== 'ACTIVE'))
    .flatMap(demand => (demand.tipMaterialSources ?? []).map(material => ({ demand, material, key: JSON.stringify([demand.id, material.bomItemId]) })))
}
export function renderTmfTipPurchaseForm(): string {
  const choices = sources()
  const field = (name: string, label: string, type = 'text') => `<label class="block text-sm">${label}<input name="${name}" type="${type}" class="mt-1 w-full rounded border p-2" ${type === 'number' ? 'min="0" step="0.001"' : ''} data-skip-page-rerender="true"></label>`
  const body = `<div data-pms-tip-purchase-form class="max-h-[65vh] overflow-y-auto space-y-3 p-1"><p class="text-xs text-muted-foreground">采购员（演示）；物料取自生产单已采用的技术包。创建后仍需下达采购，仓库按实际到货实收。</p><label class="block text-sm">生产需求与端头辅材<select name="source" data-pms-mpo-field="tip-purchase-source" data-skip-page-rerender="true" class="mt-1 w-full min-w-0 rounded border p-2"><option value="">请选择</option>${choices.map(({demand, material, key}) => `<option value="${e(key)}">${e(demand.productionOrderNo)} · ${e(demand.garmentSize)} / ${e(demand.specification.usage)} · ${e(material.materialName)} / ${e(material.materialSkuId)} · ${e(material.unit)}</option>`).join('')}</select></label>${choices.length ? '' : '<p class="text-amber-700 text-sm">暂无可采购来源。请先生成带有明确端头BOM的生产加工需求。</p>'}<div data-pms-tip-purchase-source class="rounded border p-3 text-sm">选择后显示采用版本、辅材和工艺要求。</div><div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${field('quantity','采购数量（按来源单位）','number')}${field('unitPrice','单价（RMB / 来源单位）','number')}${field('supplier','已确认的供应方')}${field('warehouse','实际目标仓名称')}${field('date','预计到货日期','date')}</div><label class="block text-sm">采购依据（含备损或额外数量说明）<textarea name="reason" class="mt-1 w-full rounded border p-2" data-skip-page-rerender="true"></textarea></label><label class="flex gap-2 text-sm"><input name="confirmed" type="checkbox" data-skip-page-rerender="true">已核对物料、数量、供应方、目标仓及交期</label><p data-pms-tip-purchase-error role="alert" class="text-sm text-red-700"></p></div>`
  return renderDialog({ title: '从端头辅材需求创建采购', width: 'lg', closeAction: { prefix, action: 'close-overlay', skipPageRerender: true } }, body,
    renderSecondaryButton('取消', { prefix, action: 'close-overlay' }) + renderPrimaryButton('创建待采购单', { prefix, action: 'submit-tip-purchase' }))
}
export function updateTmfTipPurchaseSource(surface: Element): void {
  const choice = sources().find(item => item.key === surface.querySelector<HTMLSelectElement>('[name="source"]')?.value)
  const target = surface.querySelector('[data-pms-tip-purchase-source]')
  if (!target) return
  if (!choice) { target.textContent = '请选择当前可用的端头辅材来源。'; return }
  const { demand, material } = choice
  target.innerHTML = `<p><strong>${e(material.materialName)}</strong> · ${e(material.materialSkuId)} · ${e(material.unit)}</p><p class="text-amber-700">辅材实物图待补</p><p class="mt-2">生产单 ${e(demand.productionOrderNo)}；采用版本 ${e(demand.techPackVersionId)}</p><p>用途 ${e(demand.specification.usage)} / ${e(demand.garmentSize)}；加工需求 ${demand.requiredPieces} 条／根</p>${[demand.specification.endA,demand.specification.endB].map((end,index) => `<p>${index ? 'B' : 'A'}端：${e(end.specification || '不打头')}${end.coverageMm ? `；覆盖 ${end.coverageMm} mm` : ''}</p>`).join('')}<p class="mt-2 text-xs">采购数量须由采购员核对。加工条数不直接等于端头个数；硅胶按实际重量采购，不自动换算。</p>`
}
export function readTmfTipPurchaseForm(surface: Element) {
  const value = (name: string) => surface.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`)!.value.trim()
  const choice = sources().find(item => item.key === value('source'))
  if (!choice) throw new Error('请选择当前可用的生产需求及端头辅材。')
  if (!surface.querySelector<HTMLInputElement>('[name="confirmed"]')?.checked) throw new Error('请核对采购信息后确认。')
  if (!value('quantity') || !value('unitPrice')) throw new Error('请明确填写数量和单价，空白不等同0。')
  return { demandId: choice.demand.id, materialBomItemId: choice.material.bomItemId, quantity: Number(value('quantity')), unitPrice: Number(value('unitPrice')), supplierName: value('supplier'), warehouse: value('warehouse'), expectedArrivalDate: value('date'), reason: value('reason') }
}
