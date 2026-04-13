import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { renderFcsProductionTechPackSnapshotPage } from '../src/pages/fcs-production-tech-pack-snapshot.ts'

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const routeSource = read('src/router/routes-fcs.ts')
const rendererSource = read('src/router/route-renderers-fcs.ts')
const pageSource = read('src/pages/fcs-production-tech-pack-snapshot.ts')

assert.ok(
  routeSource.includes('pattern: /^\\/fcs\\/production\\/orders\\/([^/]+)\\/tech-pack$/'),
  'FCS 必须新增按生产单查看技术包快照的新路由',
)
assert.ok(!routeSource.includes('/fcs/tech-pack/([^/]+)'), 'FCS 必须删除按 spuCode 查看技术包的旧路由')
assert.ok(rendererSource.includes('renderFcsProductionTechPackSnapshotPage'), 'FCS 路由渲染器必须注册新的技术包快照页')

const order = productionOrders.find((item) => item.techPackSnapshot)
assert.ok(order, '测试数据中必须存在已冻结技术包快照的生产单')

const html = renderFcsProductionTechPackSnapshotPage(order!.productionOrderId)
assert.ok(html.includes(`技术包快照 - ${order!.productionOrderNo}`), '快照页标题必须带出生产单号')
assert.ok(html.includes('当前页面为生产单技术包快照查看页，仅供查看，不可编辑。'), '快照页必须明确只读')
assert.ok(html.includes('纸样管理'), '快照页必须保留纸样管理页签')
assert.ok(html.includes('物料清单'), '快照页必须保留物料清单页签')
assert.ok(html.includes('工序工艺'), '快照页必须保留工序工艺页签')
assert.ok(html.includes('放码规则'), '快照页必须保留放码规则页签')
assert.ok(html.includes('质检标准'), '快照页必须保留质检标准页签')
assert.ok(html.includes('款色用料对应'), '快照页必须保留款色用料对应页签')
assert.ok(html.includes('花型设计'), '快照页必须保留花型设计页签')
assert.ok(html.includes('附件'), '快照页必须保留附件页签')

;['保存', '发布', '新增', '删除', '替换', '上传'].forEach((keyword) => {
  assert.ok(!pageSource.includes(keyword), `快照页源码中不应出现可编辑动作：${keyword}`)
})

console.log('fcs-tech-pack-snapshot-entry.spec.ts PASS')
