import { listPmsKolDemands, listPmsSuggestionViews } from './purchase-suggestions.ts'
import { listPmsProductPurchaseOrders } from './product-purchase-orders.ts'
import { listPmsMaterialRequirements } from './material-requirements.ts'

export interface PmsWorkbenchStat {
  key: string
  label: string
  value: number
}

export interface PmsWorkbenchRisk {
  key: string
  tone: 'yellow' | 'red' | 'blue'
  title: string
  detail: string
  href: string
  actionLabel: string
}

export interface PmsWorkbenchOverview {
  stats: PmsWorkbenchStat[]
  risks: PmsWorkbenchRisk[]
  purchaseOrderCount: number
  materialRequirementCount: number
  suggestionStyleCount: number
  kolDemandCount: number
}

export function getPmsWorkbenchOverview(): PmsWorkbenchOverview {
  const suggestions = listPmsSuggestionViews()
  const orders = listPmsProductPurchaseOrders()
  const kolDemands = listPmsKolDemands()
  const requirements = listPmsMaterialRequirements()

  const pendingSuggestionStyles = suggestions.filter((row) => row.totalAvailableQty > 0).length
  const pendingPurchaseOrders = orders.filter((order) => order.status === '待采购' || order.status === '待确认').length
  const pendingKolDemands = kolDemands.filter((demand) => demand.status === '待入库' || demand.status === '部分入库').length
  const pendingMaterialLines = requirements.reduce((sum, requirement) => sum + requirement.lines.filter((line) => line.pushStatus === '待下推').length, 0)
  const blockedBomOrders = orders.filter(
    (order) => order.status !== '已关闭' && order.status !== '已完成' && order.lines.some((line) => line.needBom && !line.bomMatched),
  ).length
  const pendingRequirementOrders = orders.filter(
    (order) => order.status !== '草稿' && order.status !== '已关闭' && order.purchaseType === '做货' && order.lines.some((line) => line.needBom && line.bomMatched && line.materialStatus === '未生成'),
  ).length

  const stats: PmsWorkbenchStat[] = [
    { key: 'suggestion', label: '待生成采购单款式', value: pendingSuggestionStyles },
    { key: 'purchase-order', label: '商品采购单待处理', value: pendingPurchaseOrders },
    { key: 'material-requirement', label: '待生成面辅料需求单', value: pendingRequirementOrders },
    { key: 'kol', label: 'KOL 需求待入库', value: pendingKolDemands },
    { key: 'material-line', label: '面辅料待下推行', value: pendingMaterialLines },
    { key: 'blocked', label: 'BOM 未匹配阻断', value: blockedBomOrders },
  ]

  const risks: PmsWorkbenchRisk[] = []
  if (pendingSuggestionStyles > 0) {
    risks.push({
      key: 'suggestion',
      tone: 'yellow',
      title: `${pendingSuggestionStyles} 个款式存在采购缺口`,
      detail: '按“待发货 + KOL 申请 − 采购中 − 库存”计算后仍有建议采购量，需要生成商品采购单。',
      href: '/pms/purchase-suggestions',
      actionLabel: '去生成采购单',
    })
  }
  if (blockedBomOrders > 0) {
    risks.push({
      key: 'bom',
      tone: 'red',
      title: `${blockedBomOrders} 张采购单 BOM 未匹配`,
      detail: '做货 SKU 的 BOM 未匹配时不能生成面辅料需求，请先完成 BOM/样板维护。',
      href: '/pms/product-purchase-orders?bomMatched=未匹配',
      actionLabel: '查看阻断采购单',
    })
  }
  if (pendingKolDemands > 0) {
    risks.push({
      key: 'kol',
      tone: 'blue',
      title: `${pendingKolDemands} 张 KOL 需求待入库`,
      detail: 'KOL 申请计入采购建议缺口，入库进度会影响后续建议采购量。',
      href: '/pms/kol-demands?status=待处理',
      actionLabel: '处理 KOL 入库',
    })
  }
  if (pendingMaterialLines > 0) {
    risks.push({
      key: 'material',
      tone: 'yellow',
      title: `${pendingMaterialLines} 条面辅料需求待下推`,
      detail: '已生成的面辅料需求需要确认实际采购数量并下推为面辅料采购单。',
      href: '/pms/product-purchase-orders',
      actionLabel: '查看需求来源单',
    })
  }

  return {
    stats,
    risks,
    purchaseOrderCount: orders.filter((order) => order.status !== '已关闭').length,
    materialRequirementCount: requirements.length,
    suggestionStyleCount: suggestions.length,
    kolDemandCount: kolDemands.length,
  }
}
