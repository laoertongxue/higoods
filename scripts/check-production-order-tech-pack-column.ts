import assert from 'node:assert/strict'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { renderProductionOrdersPage } from '../src/pages/production/orders-domain.ts'

const sampleOrder = productionOrders.find((order) => order.techPackSnapshot)
assert(sampleOrder?.techPackSnapshot, '必须存在带技术包快照的生产单样例')

const snapshot = sampleOrder.techPackSnapshot
const html = renderProductionOrdersPage()
const versionCode = snapshot.sourceTechPackVersionCode || '-'
const versionLabel = snapshot.sourceTechPackVersionLabel || '-'
const firstSku = sampleOrder.demandSnapshot.skuLines[0]

assert(!html.includes('<th class="min-w-[180px] px-3 py-3 text-left font-medium">技术包快照版本</th>'), '生产单管理列表必须删除技术包快照版本列')
assert(!html.includes('<th class="min-w-[120px] px-3 py-3 text-left font-medium">总产值</th>'), '生产单管理列表必须删除总产值列')
assert(html.includes('<th class="min-w-[220px] px-3 py-3 text-left font-medium">需求信息</th>'), '生产单管理列表必须新增需求信息列')

assert(
  !html.includes(`>${versionCode}<`),
  '生产单管理列表不得展示内部技术包版本编号',
)
assert(
  html.includes('技术包版本：'),
  '生产单管理 SPU 信息列必须展示技术包版本标签',
)
assert(
  html.includes(`data-prod-action="open-orders-tech-pack-snapshot-dialog"`) && html.includes(`>${versionLabel.replace(/^v/i, 'V')}<`),
  '生产单管理 SPU 信息列必须用可点击版本号打开技术包快照',
)
assert(
  !html.includes(`冻结时间 ${snapshot.snapshotAt}`),
  '生产单管理列表不得展示“冻结时间”文案',
)
assert(
  firstSku && html.includes(`${firstSku.color}&${firstSku.size}：${firstSku.qty.toLocaleString('zh-CN')}件`),
  '生产单管理需求信息列必须按“颜色&尺码：数量”展示',
)
assert(
  firstSku && !html.includes(`${firstSku.skuCode}`),
  '生产单管理需求信息列不得展示 SKU 编码',
)
;['需求快照', '技术包快照', '分配中心', '分配看板'].forEach((label) => {
  assert(!html.includes(`>${label}</button>`), `生产单管理操作栏不得展示：${label}`)
})

console.log('production order tech-pack column check passed')
