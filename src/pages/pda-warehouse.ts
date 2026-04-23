import { renderPdaFrame } from './pda-shell'
import {
  getMobileWarehouseRuntimeContext,
  renderMobileWarehouseLoginRedirect,
  renderWarehouseActionCards,
  renderWarehouseSummaryHeader,
} from './pda-warehouse-shared'

export function renderPdaWarehousePage(): string {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return renderMobileWarehouseLoginRedirect()

  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderWarehouseSummaryHeader('仓管', '待加工仓 / 待交出仓 / 入库记录 / 出库记录 / 盘点', runtime.overview)}
      ${renderWarehouseActionCards(runtime.cards)}
    </div>
  `

  return renderPdaFrame(content, 'warehouse', { headerTitle: '仓管' })
}

export function handlePdaWarehouseEvent(_target: HTMLElement): boolean {
  return false
}
