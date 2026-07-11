import assert from 'node:assert/strict'

import { routes } from '../src/router/routes-fcs.ts'
import { handleProcessWaterSolubleOrdersEvent } from '../src/pages/process-water-soluble-orders.ts'
import { handleCraftDyeingWaterSolubleOrdersEvent } from '../src/pages/process-factory/dyeing/water-soluble-orders.ts'
import { assignWaterSolubleFactory, listWaterSolubleWorkOrders, WATER_SOLUBLE_STATUS_LABEL } from '../src/data/fcs/water-soluble-task-domain.ts'

async function renderRoute(path: string): Promise<string> {
  const renderer = routes.exactRoutes[path]
  assert(renderer, `缺少真实路由：${path}`)
  const html = await renderer(path)
  assert(html.trim(), `路由未渲染页面：${path}`)
  return html
}

const fcsHtml = await renderRoute('/fcs/process/water-soluble-orders')
const pfosHtml = await renderRoute('/fcs/craft/dyeing/water-soluble-orders')

assert(fcsHtml.includes('data-testid="water-soluble-orders-page"'), 'FCS 水溶加工单页面未渲染')
assert(fcsHtml.includes('data-testid="water-soluble-pagination"'), 'FCS 水溶加工单缺少分页')
assert(fcsHtml.includes('计划交期') && fcsHtml.includes('未排期'), 'FCS 页面不得伪造计划交期')
assert(fcsHtml.includes('技术包版本') && fcsHtml.includes('分配染厂'), 'FCS 页面缺少管理字段或派厂动作')
assert(!fcsHtml.includes('需先水溶'), 'FCS 独立水溶页不得混入含水溶染色单')
assert(pfosHtml.includes('data-testid="factory-water-soluble-orders-page"'), 'PFOS 水溶加工单页面未渲染')
assert(pfosHtml.includes('data-testid="factory-water-soluble-pagination"'), 'PFOS 水溶加工单缺少分页')
assert(pfosHtml.includes('当前要做什么') && pfosHtml.includes('主管处理'), 'PFOS 页面未突出当前动作或主管兜底')
assert(!pfosHtml.includes('需先水溶'), 'PFOS 独立水溶页不得混入含水溶染色单')

const inertTarget = { closest: () => null } as unknown as HTMLElement
assert.equal(handleProcessWaterSolubleOrdersEvent(inertTarget), false, 'FCS handler 应忽略无关事件')
assert.equal(handleCraftDyeingWaterSolubleOrdersEvent(inertTarget), false, 'PFOS handler 应忽略无关事件')

const pending = listWaterSolubleWorkOrders().find((order) => order.status === 'WAIT_FACTORY_ASSIGNMENT')
assert(pending, '演示数据必须保留待分配染厂场景')
const blocked = assignWaterSolubleFactory(pending.waterOrderId, 'NOT-A-FACTORY')
assert.equal(blocked.ok, false, '分配不存在染厂必须由领域拦截')
assert(blocked.message.includes('未找到工厂'), '领域拦截必须是中文可操作提示')
assert.equal(WATER_SOLUBLE_STATUS_LABEL[pending.status], '待分配染厂')

console.log('water-soluble pages check passed')
