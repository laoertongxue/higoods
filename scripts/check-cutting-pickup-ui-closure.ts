import fs from 'node:fs'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const pcSource = fs.readFileSync('src/pages/process-factory/cutting/pickup-management.ts', 'utf8')
const pdaSource = fs.readFileSync('src/pages/pda-warehouse-wait-process.ts', 'utf8')

assert(pcSource.includes('buildPickupWorkbenchRows'), 'PC 四个页签必须从各自业务事实构建列表行')
assert(pcSource.includes('data-pickup-row-kind'), 'PC 列表必须区分活动节点、领料主记录和订单状态')
assert(pcSource.includes('/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup&pickupNodeId='), 'PC 办理领料必须跳转 PDA 并携带节点快照')
assert(!pcSource.includes("receiverName: '裁床 李明'"), 'PC 不得硬编码收货人直接确认领料')
assert(!pcSource.includes('本轮全部领取</button>'), 'PC 详情不得直接确认领取')
assert(pcSource.includes('sourceLocations.map'), 'PC 详情必须逐个展示全部来源货位')
assert(pcSource.includes('节点版本'), 'PC 详情必须展示节点版本')
assert(pcSource.includes('renderStandardListColumnSettings'), 'PC 标准列表必须提供列设置')
assert(pcSource.includes('saveListColumnPreferences'), 'PC 列显示、顺序、冻结和每页条数必须持久化')
assert(pcSource.includes("action === 'sort-column'"), 'PC 标准列表必须支持三态排序')
assert(pcSource.includes("action === 'toggle-column-visibility'"), 'PC 标准列表必须支持列显隐')
assert(pcSource.includes("action === 'toggle-column-freeze'"), 'PC 标准列表必须支持普通列冻结')
assert(pcSource.includes('data-skip-page-rerender'), 'PC 轻交互必须跳过整页重绘')
assert(pcSource.includes('refreshPickupRegions'), 'PC 轻交互必须局部刷新列表区域')

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
