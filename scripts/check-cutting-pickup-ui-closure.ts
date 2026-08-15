import fs from 'node:fs'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const listPath = 'src/pages/process-factory/cutting/pickup-management-list.ts'
const listSource = fs.existsSync(listPath) ? fs.readFileSync(listPath, 'utf8') : ''
const handlerSource = fs.readFileSync('src/main-handlers/fcs-handlers.ts', 'utf8')
const mainSource = fs.readFileSync('src/main.ts', 'utf8')
const pdaSource = fs.readFileSync('src/pages/pda-warehouse-wait-process.ts', 'utf8')
const runtimeSource = fs.readFileSync('src/runtime/fcs/cutting/pickup-management-runtime.ts', 'utf8')
const warehouseSource = fs.readFileSync('src/pages/process-factory/cutting/warehouse-location-map.ts', 'utf8')

const mainPickupBranch = mainSource.match(
  /if \(pathname\.startsWith\('\/fcs\/craft\/cutting\/pickup-management'\)\) \{[\s\S]*?\n  \}/,
)?.[0] ?? ''
assert(
  mainPickupBranch.includes('getFcsHandlersModule()')
    && mainPickupBranch.includes('dispatchFcsPageEvent(eventTarget, event)')
    && !mainPickupBranch.includes("import('./pages/process-factory/cutting/pickup-management')"),
  'main.ts 真实入口必须把三个列表和旧详情统一交给 FCS 精确分派，不得被旧页面处理器提前截获',
)
for (const eventType of ['click', 'input', 'change']) {
  const listenerSource = mainSource.match(
    new RegExp(`root\\.addEventListener\\('${eventType}'[\\s\\S]*?(?=root\\.addEventListener\\('|$)`),
  )?.[0] ?? ''
  assert(listenerSource.includes('dispatchPageEvent(target, event)'), `${eventType} 事件必须进入统一页面分派`)
}
assert(
  mainSource.includes("root.addEventListener('dragstart', dispatchListColumnDragEvent)")
    && mainSource.includes('void dispatchPageEvent(target, internalEvent)'),
  '列拖拽事件必须进入统一页面分派',
)

assert(listSource.includes('listPickupOrderGroups(kind)'), '三个列表必须按当前列表类型读取生产单分组')
assert(listSource.includes('data-pickup-list-action="open-web-receipt"'), 'PC 接收必须直接打开 Web 接收弹窗')
assert(listSource.includes("action === 'confirm-web-receipt'") && listSource.includes("eventSource: 'WEB'"), 'PC 必须可在 Web 端确认接收并标记 WEB 来源')
assert(!listSource.includes('/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup&pickupNodeId='), 'PC 主接收入口不得继续仅跳转 PDA')
assert(listSource.includes('data-pickup-receipt-readonly-items'), 'Web 接收必须展示当前节点全部只读物料')
assert(listSource.includes('请选择待加工仓') && listSource.includes('selectedLocationIds'), 'Web 接收必须明确选择待加工仓与库位')
assert(listSource.includes('currentLocations.map'), '未配齐列表必须逐个展示每项物料全部来源库位')
assert(listSource.includes('节点 V'), 'PC 接收记录必须展示节点版本')
assert(listSource.includes('renderStandardListColumnSettings'), 'PC 标准列表必须提供列设置')
assert(listSource.includes('saveListColumnPreferences'), 'PC 列显示、顺序、冻结和每页条数必须持久化')
for (const key of [
  'standard-list:/fcs/craft/cutting/pickup-management/ready',
  'standard-list:/fcs/craft/cutting/pickup-management/incomplete',
  'standard-list:/fcs/craft/cutting/pickup-management/history',
]) {
  assert(listSource.includes(key), `三路由必须有独立偏好键 ${key}`)
}
assert(listSource.includes("action === 'sort-column'"), 'PC 标准列表必须支持三态排序')
assert(listSource.includes("action === 'toggle-column-visibility'"), 'PC 标准列表必须支持列显隐')
assert(listSource.includes("action === 'toggle-column-freeze'"), 'PC 标准列表必须支持普通列冻结')
assert(listSource.includes('data-skip-page-rerender'), 'PC 轻交互必须跳过整页重绘')
assert(listSource.includes('refreshPickupListRegions'), 'PC 轻交互必须局部刷新列表区域')
assert(listSource.includes('setTimeout'), 'PC 搜索输入必须 debounce')
assert(listSource.includes('new Map<string, ReturnType<typeof setTimeout>>()'), '两个筛选必须使用独立 debounce timer Map')
assert(
  listSource.includes('pickupListFilterDebounceKey(kind, filterField)')
    && listSource.includes('`${kind}:${field}`'),
  '筛选 debounce 必须按列表类型和字段隔离',
)
assert(!listSource.includes('.slice(0,'), '物料明细不得只展示前几项')
assert(!listSource.includes('type="checkbox"'), '接收列表不得提供物料复选')
assert(!listSource.includes('type="number"'), '接收列表不得提供领取数量输入')
assert(listSource.includes('required: true') && listSource.includes('freezeable: true'), '物料身份和位置必须为必需且可冻结列')
assert(listSource.includes('renderCardActions(kind, card)'), '生产单操作必须固定在不随物料横向滚动的紧凑卡头')
assert(
  (handlerSource.match(/pathname\.startsWith\('\/fcs\/craft\/cutting\/pickup-management'/g) ?? []).length === 1
    && handlerSource.includes('CUTTING_PICKUP_LIST_PATHS.has(pathname)')
    && handlerSource.indexOf('CUTTING_PICKUP_LIST_PATHS.has(pathname)')
      > handlerSource.indexOf("pathname.startsWith('/fcs/craft/cutting/pickup-management')"),
  'FCS handler 必须在唯一 pickup-management startsWith 分支内精确分派三个列表',
)
const historyMaterialsSource = listSource.match(/function materialColumnsFor[\s\S]*?\n}\n/)?.[0] ?? ''
for (const field of [
  "key: 'material'",
  "key: 'source'",
  "key: 'location'",
  '应配',
  '当前配料',
  '累计接收',
  '剩余',
  '本轮可接收',
]) {
  assert(historyMaterialsSource.includes(field), `共享物料明细缺少核心字段：${field}`)
}
for (const removed of ['加工状态', '加工可供', '已到仓', '超配异常']) {
  assert(!historyMaterialsSource.includes(removed), `共享物料明细必须删除：${removed}`)
}
assert(historyMaterialsSource.includes("title: '位置 / 载体', width: 180"), '位置 / 载体必须收窄为 180px')
for (const label of [
  '未配齐先领',
  '已配齐后接收',
  '全部接收',
  '尚未全部接收',
  '新增补料待领',
]) {
  assert(listSource.includes(label), `HISTORY 必须使用严格文案：${label}`)
}

assert(pdaSource.includes('buildPickupUnitSummaries'), 'PDA 总览必须按单位分组')
assert(!pdaSource.includes("formatCuttingWaitProcessQty(totalQty, 'yard')"), 'PDA 不得把混合单位相加并统一标 yard')
assert(pdaSource.includes('confirmPickupNodeReceiptRuntime({') && pdaSource.includes("eventSource: 'PDA'"), 'PDA 必须调用 Web/PDA 共用接收确认入口')
assert(runtimeSource.includes('nodeSnapshot.items.forEach') && runtimeSource.includes('normalizePickupRuntimeQtyUnit'), '共用接收入口必须按物料原单位写入非零入库事实')
assert(runtimeSource.includes('cutting-pickup:${input.pickupNodeId}:v${input.pickupNodeVersion}'), 'Web/PDA 必须使用跨端一致稳定幂等键')
assert(runtimeSource.includes('appendCuttingRuntimeEventIdempotent'), '每条待加工仓入库事件必须幂等')
assert(pdaSource.includes('data-pda-warehouse-action="retry-cutting-pickup-sync"'), '仓储回写异常必须提供重试入口')
assert(runtimeSource.includes('getPickupSessionByNodeId(input.pickupNodeId, storage)'), '共用入口重复确认必须先按节点取得既有 Session')
assert(pdaSource.includes('syncCuttingPickupSessionWarehouseFactsRuntime(session)'), 'PDA 异常重试必须复用共用待加工仓流水写入')
assert(runtimeSource.includes('pickupNodeSnapshot'), '失败重试必须依赖已保存的节点事实快照')
assert(warehouseSource.includes('buildCuttingWarehouseMapProjectionForWarehouse'), 'Web 接收必须按明确仓库构建库位投影')
assert(!pdaSource.includes('暂不领'), '裁床不得出现暂不领操作')

console.log('check:cutting-pickup-ui-closure passed')
