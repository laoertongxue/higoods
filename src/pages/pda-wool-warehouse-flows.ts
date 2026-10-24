import { readWoolQuerySnapshot, listWoolFactoryWarehouseFlows, summarizeWoolQuantities } from '../data/fcs/wool-domain/queries.ts'
import { woolWarehouseFlowSignedQty } from '../data/fcs/wool-domain/warehouse-ledger.ts'
import { listFactoryReceipts } from '../data/fcs/factory-receiving.ts'
import { renderWoolObjectImage } from './process-factory/wool/stage-display.ts'
import { renderPdaFrame } from './pda-shell.ts'
import { appStore } from '../state/store.ts'
import { escapeHtml as e } from '../utils.ts'
import { getFactoryMasterRecordById } from '../data/fcs/factory-master-store.ts'
import { OWN_WOOL_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import { pdaPill, pdaSectionTitle, pdaUi } from './pda-mobile-ui.ts'

/** Warehouse reads the same stage ledger; it never performs receipt or processing again. */
export function renderPdaWoolWarehouseFlows(factoryId: string, factoryName: string, direction: 'IN' | 'OUT'): string | null {
  if (factoryId !== OWN_WOOL_FACTORY_ID && getFactoryMasterRecordById(factoryId)?.factoryType !== 'CENTRAL_WOOL') return null
  const store = readWoolQuerySnapshot()
  if (!Object.values(store.workOrders).some(order => order.factoryId === factoryId)) return null
  const rows = listWoolFactoryWarehouseFlows(store, factoryId)
    .filter(flow => direction === 'IN' ? woolWarehouseFlowSignedQty(flow) > 0 : woolWarehouseFlowSignedQty(flow) < 0)
    .sort((a, b) => b.operatedAt.localeCompare(a.operatedAt) || b.flowId.localeCompare(a.flowId))
  const route = `/fcs/pda/warehouse/${direction === 'IN' ? 'inbound' : 'outbound'}-records`
  const query = new URLSearchParams(appStore.getState().pathname.split('?')[1] || '')
  const limit = Math.max(20, Number(query.get('limit')) || 20)
  const receipts = listFactoryReceipts(factoryId)
  const labels = { PIECE_RECEIPT: '外加工片实收', YARN_RECEIPT: '纱线实收', YARN_ISSUE: '领用纱线', YARN_RETURN: '退回纱线', PROCESS_REPORT: '加工填报', HANDOVER: '交出', STOCK_ADJUSTMENT: '库存调整', STOCK_TRANSFER: '库存转移' }
  const cards = rows.slice(0, limit).map(flow => {
    const order = store.workOrders[flow.woolOrderId]
    const receiptLine = receipts.flatMap(receipt => receipt.lines).find(line => line.material.sku === flow.objectSkuCode)
    const yarn = order?.yarnMaterials?.find(line => line.sku === flow.objectSkuCode)
    const piece = order?.externalPieces.find(item => item.pieceKey === flow.objectSkuCode)
    const name = flow.unit === 'kg' ? yarn?.name || receiptLine?.material.name || flow.objectSkuCode : piece?.pieceName || order?.styleName || flow.objectSkuCode
    const image = flow.unit === 'kg' ? yarn?.imageUrl || receiptLine?.material.imageUrl : order?.styleImageUrl
    const stage = order?.stage === 'KNITTING' ? '横机加工单' : '缝盘加工单'
    const automatic = flow.sourceRecordType === 'HANDOVER' && store.handovers.some(item => item.handoverId === flow.sourceRecordId && item.automatic)
    const qty = Math.abs(woolWarehouseFlowSignedQty(flow))
    return `<article class="${pdaUi.card} p-3">
      <div class="flex gap-3">
        ${renderWoolObjectImage(image, name)}
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <h3 class="min-w-0 break-words text-[16px] font-semibold leading-6 text-[#1a293c]">${e(name)}</h3>
            <strong class="shrink-0 text-[18px] leading-6 text-[#1a293c]">${qty} <span class="text-[13px] font-normal text-[#62748a]">${e(flow.unit)}</span></strong>
          </div>
          <p class="mt-1 break-all text-[13px] leading-5 text-[#62748a]">${e(flow.objectSkuCode)}</p>
          <p class="mt-2 break-words text-[14px] font-semibold leading-5 text-[#1a293c]">${e(labels[flow.businessType])}${automatic ? '（横机自动内部衔接）' : ''}</p>
          <p class="mt-1 break-all text-[13px] leading-5 text-[#1a293c]">${order ? `${stage} ${e(order.woolOrderNo)}` : '备料（未关联加工单）'}</p>
          <p class="mt-1 break-words text-[12px] leading-5 text-[#62748a]">${e(flow.operatedAt)} · ${e(flow.operatedBy)}</p>
        </div>
      </div>
      <details class="mt-3 border-t border-[#edf0f4] pt-2">
        <summary class="flex min-h-10 cursor-pointer list-none items-center justify-between text-[13px] font-medium text-[#62748a]"><span>批次、库位与来源</span><span aria-hidden="true">⌄</span></summary>
        <div class="space-y-1 break-all pt-1 text-[12px] leading-5 text-[#62748a]">
          <p>批次 ${e(flow.batchNo || '未分批')} · 库位 ${e(flow.physicalLocationId || flow.defaultLocationId)}</p>
          <p>来源 ${e(flow.sourceRecordId)}</p>
          ${flow.reason ? `<p>${e(flow.reason)}</p>` : ''}
        </div>
      </details>
    </article>`
  }).join('')
  const more = rows.length > limit ? `<a class="${pdaUi.secondaryButton}" data-nav="${route}?limit=${limit + 20}" href="${route}?limit=${limit + 20}">加载更多 · 已显示 ${limit}/${rows.length}</a>` : ''
  const summary = summarizeWoolQuantities(rows.map(flow => ({ ...flow, qty: Math.abs(woolWarehouseFlowSignedQty(flow)) })))
  return renderPdaFrame(`<div class="${pdaUi.page}" data-wool-pda-warehouse-flows>
    <div class="flex items-start justify-between gap-3 px-1">
      <div class="min-w-0">
        <h1 class="text-[26px] font-bold leading-8 text-[#1a293c]">毛织${direction === 'IN' ? '入库' : '出库'}</h1>
        <p class="mt-1 break-words text-[13px] leading-5 text-[#62748a]">${e(factoryName)}</p>
      </div>
      ${pdaPill(`${rows.length} 笔`, 'info')}
    </div>
    <section class="${pdaUi.card} p-3">
      <p class="text-[13px] leading-5 text-[#62748a]">按单位汇总</p>
      <p class="mt-1 break-words text-[18px] font-semibold leading-7 text-[#1a293c]">${e(summary)}</p>
    </section>
    ${pdaSectionTitle('最近记录', `已显示 ${Math.min(limit, rows.length)} / ${rows.length}`)}
    <div class="space-y-2">${cards || '<div class="rounded-xl border border-dashed border-[#ccd8e7] bg-white px-4 py-8 text-center text-sm text-[#62748a]">暂无记录。</div>'}</div>
    ${more}
  </div>`, 'warehouse', { headerTitle: `毛织${direction === 'IN' ? '入库' : '出库'}`, disableTodoAutoOpen: true })
}
