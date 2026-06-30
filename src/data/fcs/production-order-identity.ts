import { escapeHtml } from '../../utils.ts'
import {
  PRODUCTION_SALE_TYPES,
  productionDemands,
  type ProductionSaleType,
} from './production-demands.ts'
import { productionOrders, type ProductionOrder } from './production-orders.ts'

export { PRODUCTION_SALE_TYPES, type ProductionSaleType }

export interface ProductionOrderIdentity {
  productionOrderNo: string
  demandNos: string[]
  saleType: ProductionSaleType
}

export const PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE = '生产单号 / 需求单号 / 售卖类型'

export interface ProductionOrderIdentityInput {
  productionOrderId?: string | null
  productionOrderNo?: string | null
  demandNo?: string | null
  demandNos?: Array<string | null | undefined>
  saleType?: ProductionSaleType | string | null
}

export type ProductionObjectCodeType = 'PRODUCTION_ORDER' | 'DEMAND' | 'MATERIAL' | 'WAREHOUSE_DOC' | 'PROCESS_DOC'

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => (value ?? '').trim()).filter(Boolean)))
}

function isProductionSaleType(value: string | null | undefined): value is ProductionSaleType {
  return Boolean(value && PRODUCTION_SALE_TYPES.includes(value as ProductionSaleType))
}

function getDefaultSaleType(productionOrderNo: string, demandNos: string[]): ProductionSaleType {
  const source = demandNos[0] || productionOrderNo
  const matched = source.match(/(\d+)$/)
  const numeric = matched ? Number(matched[1]) : 1
  return PRODUCTION_SALE_TYPES[(Math.max(1, numeric) - 1) % PRODUCTION_SALE_TYPES.length]
}

function findProductionOrder(input: ProductionOrderIdentityInput | string): ProductionOrder | null {
  const value = typeof input === 'string' ? input : input.productionOrderId || input.productionOrderNo || ''
  if (!value) return null
  return productionOrders.find((order) => order.productionOrderId === value || order.productionOrderNo === value) ?? null
}

function resolveDemandSaleType(demandNos: string[], fallback?: string | null): ProductionSaleType | null {
  if (isProductionSaleType(fallback)) return fallback
  for (const demandNo of demandNos) {
    const demand = productionDemands.find((item) => item.demandId === demandNo)
    if (demand?.saleType) return demand.saleType
  }
  return null
}

export function renderProductionObjectCodeButton({
  objectType,
  objectId,
  label,
  className = 'font-mono text-blue-600 hover:underline',
}: {
  objectType: ProductionObjectCodeType
  objectId?: string | null
  label?: string | null
  className?: string
}): string {
  const displayText = (label || objectId || '-').trim()
  const targetId = (objectId || '').trim()
  if (!targetId || displayText === '-') return escapeHtml(displayText || '-')
  return `
    <button
      type="button"
      class="${className}"
      data-production-object-action="open"
      data-object-type="${objectType}"
      data-object-id="${escapeHtml(targetId)}"
      data-skip-page-rerender="true"
    >${escapeHtml(displayText)}</button>
  `
}

function renderIdentityObjectButton(objectType: 'PRODUCTION_ORDER' | 'DEMAND', objectId: string, className: string): string {
  return renderProductionObjectCodeButton({ objectType, objectId, className })
}

export function getProductionOrderIdentity(input: ProductionOrderIdentityInput | string): ProductionOrderIdentity {
  const order = findProductionOrder(input)
  const explicit = typeof input === 'string' ? {} : input
  const rawProductionOrderNo = typeof input === 'string' ? input : null
  const productionOrderNo = (
    explicit.productionOrderNo ||
    explicit.productionOrderId ||
    order?.productionOrderNo ||
    order?.productionOrderId ||
    rawProductionOrderNo ||
    '-'
  ).trim()
  const demandNos = uniqueNonEmpty([
    ...(explicit.demandNos ?? []),
    explicit.demandNo,
    ...(order?.sourceDemandIds ?? []),
    order?.demandSnapshot.demandId,
    order?.demandId,
  ])
  const saleType = (
    resolveDemandSaleType(demandNos, explicit.saleType) ||
    order?.demandSnapshot.saleType ||
    getDefaultSaleType(productionOrderNo, demandNos)
  )

  return {
    productionOrderNo,
    demandNos: demandNos.length > 0 ? demandNos : ['-'],
    saleType,
  }
}

export function renderProductionOrderIdentityCell(input: ProductionOrderIdentityInput | string): string {
  const identity = getProductionOrderIdentity(input)
  return `
    <div class="min-w-[12rem] space-y-1 text-sm leading-5">
      <div><span class="text-xs text-muted-foreground">生产单号</span><div class="font-mono font-medium">${renderIdentityObjectButton('PRODUCTION_ORDER', identity.productionOrderNo, 'text-left text-blue-600 hover:underline')}</div></div>
      <div><span class="text-xs text-muted-foreground">需求单号</span><div class="flex flex-wrap gap-x-1 font-mono text-xs">${identity.demandNos.map((demandNo) => renderIdentityObjectButton('DEMAND', demandNo, 'text-left text-blue-600 hover:underline')).join('<span class="text-muted-foreground">、</span>')}</div></div>
      <div><span class="text-xs text-muted-foreground">售卖类型</span><div class="text-xs text-foreground">${escapeHtml(identity.saleType)}</div></div>
    </div>
  `
}
