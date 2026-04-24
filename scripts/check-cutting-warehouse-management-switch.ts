import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import { routes } from '../src/router/routes-fcs.ts'
import {
  renderCraftCuttingWarehouseManagementWaitHandoverPage,
  renderCraftCuttingWarehouseManagementWaitProcessPage,
} from '../src/pages/process-factory/cutting/warehouse-hub.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function repoPath(relativePath: string): string {
  return path.resolve(repoRoot, relativePath)
}

function read(relativePath: string): string {
  return fs.readFileSync(repoPath(relativePath), 'utf8')
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function token(...parts: string[]): string {
  return parts.join('')
}

const cuttingGroup = menusBySystem.pfos.find((group) => group.title === '裁床厂管理')
assert(cuttingGroup, 'PFOS 缺少裁床厂管理菜单组')

const itemTitles = cuttingGroup.items.map((item) => item.title)
assert.deepEqual(
  itemTitles,
  ['裁床总览', '裁前准备', '铺布执行', '裁后处理', '裁床仓库管理'],
  '裁床厂管理一级菜单顺序不正确',
)

const warehouseItem = cuttingGroup.items.find((item) => item.title === '裁床仓库管理')
assert(warehouseItem, 'PFOS 缺少裁床仓库管理一级菜单')
assert.deepEqual(
  warehouseItem.children?.map((child) => child.title),
  ['待加工仓', '待交出仓', '样衣仓'],
  '裁床仓库管理 children 必须为待加工仓 / 待交出仓 / 样衣仓',
)
assert.deepEqual(
  warehouseItem.children?.map((child) => child.href),
  [
    '/fcs/craft/cutting/warehouse-management/wait-process',
    '/fcs/craft/cutting/warehouse-management/wait-handover',
    '/fcs/craft/cutting/warehouse-management/sample-warehouse',
  ],
  '裁床仓库管理 children href 不正确',
)
assert(!cuttingGroup.items.some((item) => item.title === '裁片仓交接'), '旧裁片仓交接 item 不应继续存在')

const nonWarehouseChildren = cuttingGroup.items
  .filter((item) => item.key !== 'pfos-cutting-warehouse-management')
  .flatMap((item) => item.children ?? [])
const movedTitles = ['裁床仓', '样衣仓', '特殊工艺发料', '特殊工艺回仓', '裁片发料', '裁片仓']
movedTitles.forEach((title) => {
  assert(!nonWarehouseChildren.some((child) => child.title === title), `旧分散入口仍留在原菜单组：${title}`)
})

const exactRoutes = routes.exactRoutes
assert(exactRoutes['/fcs/craft/cutting/warehouse-management/wait-process'], '缺少待加工仓汇总 route')
assert(exactRoutes['/fcs/craft/cutting/warehouse-management/wait-handover'], '缺少待交出仓汇总 route')
assert(exactRoutes['/fcs/craft/cutting/warehouse-management/sample-warehouse'], '缺少样衣仓兼容 route')

const routesSource = read('src/router/routes-fcs.ts')
const stateStoreSource = read('src/state/store.ts')
assertIncludes(
  routesSource,
  "renderRouteRedirect('/fcs/craft/cutting/warehouse-management/wait-process', '正在跳转到待加工仓')",
  '旧 warehouse alias 必须跳待加工仓',
)
assertIncludes(stateStoreSource, "'/fcs/craft/cutting/warehouse-management/wait-process'", '旧裁床 tab redirect 必须跳待加工仓')
assertIncludes(routesSource, "'/fcs/craft/cutting/warehouse-management/sample-warehouse'", '缺少样衣仓兼容路由')
assertNotIncludes(
  routesSource,
  "renderRouteRedirect('/fcs/craft/cutting/fabric-warehouse', '正在跳转到裁床仓')",
  '旧 alias 不得继续跳裁床仓',
)

assert(fs.existsSync(repoPath('src/pages/process-factory/cutting/warehouse-hub.ts')), '缺少 warehouse-hub.ts')
assert(!fs.existsSync(repoPath('src/pages/process-factory/cutting/warehouse-management.ts')), '不得复活旧 warehouse-management.ts')
assert(!fs.existsSync(repoPath('src/pages/process-factory/cutting/warehouse-management.helpers.ts')), '不得复活旧 warehouse-management.helpers.ts')

const waitProcessHtml = renderCraftCuttingWarehouseManagementWaitProcessPage()
const waitHandoverHtml = renderCraftCuttingWarehouseManagementWaitHandoverPage()
;['进入裁床仓', '进入特殊工艺发料'].forEach((item) => assertIncludes(waitProcessHtml, item, `待加工仓汇总缺少：${item}`))
;['进入裁片仓', '进入特殊工艺回仓', '进入裁片发料'].forEach((item) => assertIncludes(waitHandoverHtml, item, `待交出仓汇总缺少：${item}`))
;['裁片仓', '裁片发料', '特殊工艺回仓'].forEach((item) => assertNotIncludes(waitProcessHtml, item, `待加工仓汇总不得出现：${item}`))
;['裁床仓', '特殊工艺发料'].forEach((item) => assertNotIncludes(waitHandoverHtml, item, `待交出仓汇总不得出现：${item}`))

const hubSource = read('src/pages/process-factory/cutting/warehouse-hub.ts')
;[
  'buildFabricWarehouseProjection',
  'buildCutPieceWarehouseProjection',
  'listCuttingSpecialCraftDispatchViews',
  'listCuttingSpecialCraftReturnViews',
  'getCuttingSewingDispatchSummary',
  'renderCuttingPageHeader',
  'renderCompactKpiCard',
].forEach((item) => assertIncludes(hubSource, item, `hub 页必须复用现有能力：${item}`))
;[
  'renderCraftCuttingFabricWarehousePage',
  'renderCraftCuttingCutPieceWarehousePage',
  'renderCraftCuttingSampleWarehousePage',
  'createSpecialCraftDispatchHandoverFromFeiTickets',
  'receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse',
  'assertSewingDispatchAllowed',
].forEach((item) => assertNotIncludes(hubSource, item, `hub 页不得复制或承接具体业务：${item}`))

;[
  'src/pages/process-factory/cutting/fabric-warehouse.ts',
  'src/pages/process-factory/cutting/cut-piece-warehouse.ts',
  'src/pages/process-factory/cutting/sample-warehouse.ts',
  'src/pages/process-factory/cutting/special-craft-dispatch.ts',
  'src/pages/process-factory/cutting/special-craft-return.ts',
  'src/pages/process-factory/cutting/sewing-dispatch.ts',
].forEach((file) => {
  assert(fs.existsSync(repoPath(file)), `具体业务页必须继续存在：${file}`)
})

const scopeSource = [
  read('src/data/app-shell-config.ts'),
  read('src/router/routes-fcs.ts'),
  read('src/router/route-renderers-fcs.ts'),
  hubSource,
].join('\n')
;[
  token('库存', '三态'),
  token('可用', '库存'),
  token('占用', '库存'),
  token('在途', '库存'),
  token('A', 'PI'),
  token('i', '18n'),
  token('use', 'Translation'),
  token('e', 'charts'),
  token('re', 'charts'),
  token('chart', '.js'),
].forEach((item) => assertNotIncludes(scopeSource, item, `本 step 不得引入越界能力：${item}`))

console.log('[check-cutting-warehouse-management-switch] 裁床仓库管理一级菜单切换通过')
