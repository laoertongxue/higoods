import fs from 'node:fs'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const pcSource = fs.readFileSync('src/pages/process-factory/cutting/pickup-management.ts', 'utf8')
const listPath = 'src/pages/process-factory/cutting/pickup-management-list.ts'
const listSource = fs.existsSync(listPath) ? fs.readFileSync(listPath, 'utf8') : ''
const handlerSource = fs.readFileSync('src/main-handlers/fcs-handlers.ts', 'utf8')
const pdaSource = fs.readFileSync('src/pages/pda-warehouse-wait-process.ts', 'utf8')

assert(listSource.includes('listPickupOrderGroups(kind)'), '三个列表必须按当前列表类型读取生产单分组')
assert(listSource.includes('/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup&pickupNodeId='), 'PC 去领料必须跳转 PDA 并携带节点快照')
assert(listSource.includes('一次领取本节点全部物料'), 'PC 去领料入口必须明确一次领取本节点全部物料')
assert(!pcSource.includes("receiverName: '裁床 李明'"), 'PC 不得硬编码收货人直接确认领料')
assert(!pcSource.includes('本轮全部领取</button>'), 'PC 详情不得直接确认领取')
assert(listSource.includes('currentLocations.map'), '未配齐列表必须逐个展示每项物料全部来源库位')
assert(pcSource.includes('节点版本'), 'PC 详情必须展示节点版本')
assert(listSource.includes('renderStandardListColumnSettings'), 'PC 标准列表必须提供列设置')
assert(listSource.includes('saveListColumnPreferences'), 'PC 列显示、顺序、冻结和每页条数必须持久化')
for (const key of [
  'standard-list:/fcs/craft/cutting/pickup-ready',
  'standard-list:/fcs/craft/cutting/pickup-incomplete',
  'standard-list:/fcs/craft/cutting/pickup-history',
]) {
  assert(listSource.includes(key), `三路由必须有独立偏好键 ${key}`)
}
assert(listSource.includes("action === 'sort-column'"), 'PC 标准列表必须支持三态排序')
assert(listSource.includes("action === 'toggle-column-visibility'"), 'PC 标准列表必须支持列显隐')
assert(listSource.includes("action === 'toggle-column-freeze'"), 'PC 标准列表必须支持普通列冻结')
assert(listSource.includes('data-skip-page-rerender'), 'PC 轻交互必须跳过整页重绘')
assert(listSource.includes('refreshPickupListRegions'), 'PC 轻交互必须局部刷新列表区域')
assert(listSource.includes('setTimeout'), 'PC 搜索输入必须 debounce')
assert(!listSource.includes('.slice(0,'), '物料明细不得只展示前几项')
assert(!listSource.includes('type="checkbox"'), '领料列表不得提供物料复选')
assert(!listSource.includes('type="number"'), '领料列表不得提供领取数量输入')
assert(listSource.includes('required: true') && listSource.includes('freezeable: true'), '生产单和物料明细必须为必需且可冻结列')
assert(listSource.includes('actionColumn: true'), '操作列必须由标准表格固定右侧')
assert(
  (handlerSource.match(/pathname\.startsWith\('\/fcs\/craft\/cutting\/pickup-management'/g) ?? []).length === 1
    && !handlerSource.includes("pathname.startsWith('/fcs/craft/cutting/pickup-')"),
  'FCS handler 只能保留一个旧领料路由 startsWith 前缀，新三路由必须精确匹配',
)

assert(pdaSource.includes('buildPickupUnitSummaries'), 'PDA 总览必须按单位分组')
assert(!pdaSource.includes("formatCuttingWaitProcessQty(totalQty, 'yard')"), 'PDA 不得把混合单位相加并统一标 yard')
assert(pdaSource.includes('const nodeSnapshot = structuredClone(node)'), 'PDA 确认前必须保留节点快照')
assert(pdaSource.includes('for (const item of nodeSnapshot.items)'), 'PDA 必须按物料单位写入非零入库事实')
assert(pdaSource.includes('idempotencyKey,'), 'PDA 确认必须使用稳定幂等键')
assert(pdaSource.includes('data-pda-warehouse-action="retry-cutting-pickup-sync"'), '仓储回写异常必须提供重试入口')
assert(pdaSource.includes('getPickupSessionByNodeId(pickupNodeId)'), 'PDA 重复确认必须先按节点取得既有 Session')
assert(pdaSource.includes('syncCuttingPickupSessionRuntimeFacts(session)'), 'PDA 确认和重试必须共用可恢复的待加工仓流水补写逻辑')
assert(pdaSource.includes('pickupNodeSnapshot'), 'PDA 失败重试必须依赖已保存的节点事实快照')
assert(!pdaSource.includes('暂不领'), '裁床不得出现暂不领操作')

console.log('check:cutting-pickup-ui-closure passed')
