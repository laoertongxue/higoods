import { readWoolQuerySnapshot, listWoolFactoryWarehouseFlows, summarizeWoolQuantities } from '../data/fcs/wool-domain/queries.ts'
import { woolWarehouseFlowSignedQty } from '../data/fcs/wool-domain/warehouse-ledger.ts'
import { listFactoryReceipts } from '../data/fcs/factory-receiving.ts'
import { renderWoolObjectImage } from './process-factory/wool/stage-display.ts'
import { renderPdaFrame } from './pda-shell.ts'
import { appStore } from '../state/store.ts'
import { escapeHtml as e } from '../utils.ts'
import { getFactoryMasterRecordById } from '../data/fcs/factory-master-store.ts'
import { OWN_WOOL_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'

/** Warehouse reads the same stage ledger; it never performs receipt or processing again. */
export function renderPdaWoolWarehouseFlows(factoryId: string, factoryName: string, direction: 'IN' | 'OUT'): string | null {
  if (factoryId !== OWN_WOOL_FACTORY_ID && getFactoryMasterRecordById(factoryId)?.factoryType !== 'CENTRAL_WOOL') return null
  const store = readWoolQuerySnapshot()
  if (!Object.values(store.workOrders).some(order => order.factoryId === factoryId)) return null
  const rows = listWoolFactoryWarehouseFlows(store, factoryId)
    .filter(flow => direction === 'IN' ? woolWarehouseFlowSignedQty(flow) > 0 : woolWarehouseFlowSignedQty(flow) < 0)
    .sort((a, b) => b.operatedAt.localeCompare(a.operatedAt) || b.flowId.localeCompare(a.flowId))
  const route = `/fcs/pda/warehouse/${direction === 'IN' ? 'inbound' : 'outbound'}-records`
  const pages = Math.max(1, Math.ceil(rows.length / 10))
  const query = new URLSearchParams(appStore.getState().pathname.split('?')[1] || '')
  const page = Math.min(pages, Math.max(1, Number(query.get('page')) || 1))
  const receipts = listFactoryReceipts(factoryId)
  const labels = { PIECE_RECEIPT: '外加工片实收', YARN_RECEIPT: '纱线实收', YARN_ISSUE: '领用纱线', YARN_RETURN: '退回纱线', PROCESS_REPORT: '加工填报', HANDOVER: '交出', STOCK_ADJUSTMENT: '库存调整', STOCK_TRANSFER: '库存转移' }
  const cards = rows.slice((page - 1) * 10, page * 10).map(flow => {
    const order = store.workOrders[flow.woolOrderId]
    const receiptLine = receipts.flatMap(receipt => receipt.lines).find(line => line.material.sku === flow.objectSkuCode)
    const yarn = order?.yarnMaterials?.find(line => line.sku === flow.objectSkuCode)
    const piece = order?.externalPieces.find(item => item.pieceKey === flow.objectSkuCode)
    const name = flow.unit === 'kg' ? yarn?.name || receiptLine?.material.name || flow.objectSkuCode : piece?.pieceName || order?.styleName || flow.objectSkuCode
    const image = flow.unit === 'kg' ? yarn?.imageUrl || receiptLine?.material.imageUrl : order?.styleImageUrl
    const stage = order?.stage === 'KNITTING' ? '横机加工单' : '缝盘加工单'
    const automatic = flow.sourceRecordType === 'HANDOVER' && store.handovers.some(item => item.handoverId === flow.sourceRecordId && item.automatic)
    return `<article class="space-y-2 rounded-xl border bg-white p-3 text-sm"><div class="flex gap-3">${renderWoolObjectImage(image, name)}<div class="min-w-0 break-all"><strong>${e(name)}</strong><p>${e(flow.objectSkuCode)}</p>${flow.unit !== 'kg' ? '<p class="text-xs text-muted-foreground">款式参考图</p>' : ''}</div></div><p>${e(labels[flow.businessType])}${automatic ? '（横机自动内部衔接）' : ''}：<strong>${Math.abs(woolWarehouseFlowSignedQty(flow))} ${e(flow.unit)}</strong></p><p class="break-all">${order ? `${stage} ${e(order.woolOrderNo)}` : '备料（未关联加工单）'}</p><p>${e(flow.operatedAt)} · ${e(flow.operatedBy)}</p><p class="break-all text-xs">批次 ${e(flow.batchNo || '未分批')} · 库位 ${e(flow.physicalLocationId || flow.defaultLocationId)}</p><details class="break-all text-xs"><summary>查看来源</summary><p>${e(flow.sourceRecordId)}</p><p>${e(flow.reason || '')}</p></details></article>`
  }).join('')
  const nav = (n: number, label: string) => `<button class="rounded border px-3 py-2" data-nav="${route}?page=${n}" ${n < 1 || n > pages ? 'disabled' : ''}>${label}</button>`
  return renderPdaFrame(`<div class="space-y-3 p-3" data-wool-pda-warehouse-flows><header><h1 class="text-lg font-semibold">毛织${direction === 'IN' ? '入库' : '出库'}记录</h1><p>${e(factoryName)}</p><p class="text-sm">按单位汇总：${e(summarizeWoolQuantities(rows.map(flow => ({ ...flow, qty: Math.abs(woolWarehouseFlowSignedQty(flow)) }))))}</p></header>${cards || '<p>暂无记录。</p>'}<footer class="flex flex-wrap items-center justify-between gap-2 text-sm">${nav(page - 1, '上一页')}<span>${page} / ${pages} 页，共 ${rows.length} 条</span>${nav(page + 1, '下一页')}</footer></div>`, 'warehouse', { headerTitle: `毛织${direction === 'IN' ? '入库' : '出库'}`, disableTodoAutoOpen: true })
}
