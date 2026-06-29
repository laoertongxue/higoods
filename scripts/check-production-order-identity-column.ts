import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  PRODUCTION_SALE_TYPES,
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  getProductionOrderIdentity,
  renderProductionOrderIdentityCell,
} from '../src/data/fcs/production-order-identity.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

const expectedSaleTypes = [
  '预售',
  '备货',
  'shopee备货',
  'KOL样衣',
  '虾皮样品',
  '基础款',
  'JKT复购',
  'SZ复购',
  '国内做货',
  '预售备货',
  'KOL样品小单',
]

assert(
  JSON.stringify(PRODUCTION_SALE_TYPES) === JSON.stringify(expectedSaleTypes),
  '售卖类型枚举必须与需求完全一致',
)

const sampleOrder = productionOrders.find((order) => order.sourceDemandIds.length > 0) ?? productionOrders[0]
assert(sampleOrder, '必须存在生产单样例')

const identity = getProductionOrderIdentity(sampleOrder.productionOrderId)
assert(identity.productionOrderNo === sampleOrder.productionOrderNo, '身份数据必须包含生产单号')
assert(identity.demandNos.length > 0, '身份数据必须包含需求单号')
assert(expectedSaleTypes.includes(identity.saleType), '身份数据必须包含受控售卖类型')

const cellHtml = renderProductionOrderIdentityCell(sampleOrder.productionOrderId)
assert(PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE === '生产单号 / 需求单号 / 售卖类型', '合并列标题必须与需求一致')
assert(cellHtml.includes('生产单号'), '展示块必须显示生产单号标签')
assert(cellHtml.includes('需求单号'), '展示块必须显示需求单号标签')
assert(cellHtml.includes('售卖类型'), '展示块必须显示售卖类型标签')
assert(cellHtml.includes(identity.productionOrderNo), '展示块必须显示生产单号')
assert(cellHtml.includes(identity.demandNos[0]), '展示块必须显示需求单号')
assert(cellHtml.includes(identity.saleType), '展示块必须显示售卖类型')

const productionOrdersPage = readFileSync(
  resolve('src/pages/production/orders-domain.ts'),
  'utf8',
)
const productionDemandPage = readFileSync(
  resolve('src/pages/production/demand-domain.ts'),
  'utf8',
)
const productionContext = readFileSync(
  resolve('src/pages/production/context.ts'),
  'utf8',
)
assert(
  productionOrdersPage.includes('PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE'),
  '生产单管理列表必须使用合并列标题',
)
assert(
  productionOrdersPage.includes('renderProductionOrderIdentityCell'),
  '生产单管理列表必须使用统一身份展示 helper',
)
assert(
  productionDemandPage.includes('需求单号 / ID商品采购单单号 / 售卖类型'),
  '生产需求单列表必须使用需求单号、ID商品采购单单号、售卖类型合并列标题',
)
assert(
  productionDemandPage.includes('renderProductionDemandIdentityCell'),
  '生产需求单列表必须使用合并身份展示 helper',
)
assert(
  productionContext.includes('demand.saleType.toLowerCase().includes(keyword)'),
  '生产需求单关键词搜索必须支持售卖类型',
)
assert(
  productionContext.includes('order.demandSnapshot.saleType.toLowerCase().includes(keyword)'),
  '生产单管理关键词搜索必须支持售卖类型',
)
assert(
  productionContext.includes('order.demandSnapshot.demandId.toLowerCase().includes(keyword)'),
  '生产单管理关键词搜索必须支持需求单号',
)

console.log('production order identity column check passed')
