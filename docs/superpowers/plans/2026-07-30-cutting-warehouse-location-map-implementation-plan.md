# 裁床待加工仓与待交出仓库位图实现计划

> 面向实现代理：本计划已经按 2026-07-30 代码现状完成第二轮审阅。实施时使用 `superpowers-zh:test-driven-development`，并按实际执行方式使用 `superpowers-zh:executing-plans` 或 `superpowers-zh:subagent-driven-development`。每个任务先补失败检查，再做最小实现。

**目标：** 在现有裁床待加工仓和待交出仓页面内落地库位图、稳定编排、两态占用投影、待加工仓连续多选、待交出仓扫码/可视化单选，并保证 PFOS 与 PDA 基于同一物理事实。

**设计依据：** `docs/superpowers/specs/2026-07-30-cutting-warehouse-location-map-design.md`

**技术边界：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 Mock/运行时事件账；不新增后端、真实权限、React、状态管理、拖拽框架或通用 WMS 抽象。

---

## 1. 代码审阅结论与实施约束

### 1.1 已确认的代码事实

| 代码事实 | 设计影响 | 实施动作 |
| --- | --- | --- |
| `FactoryInternalWarehouse` 已有仓库—库区—货架—库位层级及稳定节点 ID | 不新增“库位组”和第二套主数据 | 读取现有层级，只叠加裁床编排快照 |
| 通用仓库 Store 是内存 Store | 直接改数组不能通过刷新后稳定验收 | 新增版本化本地编排存储 |
| 通用仓库接口被多个工厂模块使用 | 强制增加 `displayOrder` 会扩大影响面 | 不给通用接口增加必填排序字段 |
| 至少有两个裁床工厂 | 页面不能隐式混用第一套数据 | 所有读取以 `factoryId + warehouseKind` 定位 |
| PDA 待加工仓硬编码 `FAB-*`，主数据默认是 `A-01-01` | 当前文本不能直接当稳定库位 | 先做编码迁移/唯一匹配，删除裁床硬编码选项 |
| 待加工库存及运行时事件多为文本库位 | 修改编号后历史可能失联 | 新写入保存完整稳定路径，历史按固定优先级兼容 |
| `菲票装袋` 和 `中转袋入仓` 已是两个动作 | 装袋不应占库位 | 占用只从入仓事实开始 |
| 当前待交出投影从 `菲票装袋` 生成入仓袋 | 现有投影口径错误 | 先修正为读取 `中转袋入仓` |
| PDA 中转袋入仓只更新本地 Mock 台账 | PFOS 和 PDA 不是同一事实 | 确认成功时幂等写入运行时入仓事件 |
| 交出装袋确认会把临时袋换成目标中转袋 | 不能简单释放再新增导致闪烁或双算 | 在同一位置转移占用主体 |
| 特殊工艺回仓在 Web 与 PDA 都可写库区、库位文本 | 回仓也必须进入稳定占用投影 | 两端统一解析并写稳定路径 |
| 现有两个仓库页面用静态“库区库位”表格 | 无需新路由 | 原页签改名“库位图”并替换内容 |

### 1.2 不能破坏的既有边界

- 保留现有路由、侧栏、仓库页签结构和单页弹窗工作台。
- `菲票装袋`、`中转袋入仓`、`交出装袋确认`、`中转袋交出`、`特殊工艺回仓`继续是不同业务动作。
- 不改印花、染色、毛织、辅助工艺或其他工厂的仓库页面。
- 不把库位图声明为标准列表页；只有详情和未定位清单需要分页。
- 不允许手工切换“空闲/占用”。
- 一线 PDA 不显示编排入口。

---

## 2. 文件范围

### 2.1 新建文件

- `src/pages/process-factory/cutting/warehouse-location-layout-store.ts`
  - 定义并持久化裁床编排快照。
  - 本地键必须包含版本、工厂 ID 和仓库类型。
  - 提供读取、保存、校验版本、从当前主数据初始化和损坏回退能力。
- `src/pages/process-factory/cutting/warehouse-location-map-model.ts`
  - 解析稳定库位路径。
  - 迁移历史库位文本。
  - 构造待加工、待交出占用投影。
  - 实现连续区间选择与剩余存放范围调整规则。
- `src/components/ui/warehouse-location-map.ts`
  - 输出通用字符串模板、两态格子、选中效果、详情入口和编排控件。
  - 不读取业务 Store。
- `src/pages/process-factory/cutting/warehouse-location-map.ts`
  - 组合当前工厂、仓库、编排、占用和组件。
  - 接管 PFOS 查看、选择、编排、详情及局部刷新。
- `scripts/check-cutting-warehouse-location-map.ts`
  - 覆盖结构、迁移、布局、投影、生命周期、相邻选择、幂等和页面契约。
- `tests/cutting-warehouse-location-map.spec.ts`
  - 浏览器验收两张图、编排持久化、PDA 选位和异常防错。
- `docs/prototype-review-records/2026-07-30-cutting-warehouse-location-map.md`
  - 按项目模板记录本次所有受管页面、组件、数据和交互改动。

### 2.2 修改文件

- `src/data/fcs/factory-internal-warehouse.ts`
  - 只增加不扩大领域边界的稳定路径查找/节点读取 helper；如非必要不改接口。
  - 不增加必填 `displayOrder`，不增加全局 `unassignedLocationList`。
- `src/data/fcs/cutting/production-material-prep.ts`
  - 领料会话、领料记录和运行时事件写入存放范围及完整稳定路径。
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
  - 在兼容 payload 中允许稳定库位路径和幂等键。
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
  - 修正装袋/入仓投影。
  - 入仓、换袋、交出、特殊工艺交出/回仓形成可折叠的库位生命周期。
- `src/pages/process-factory/cutting/warehouse-hub.ts`
  - 两个 locations 页签接入库位图。
  - PFOS 待加工动作、待交出入仓和特殊工艺回仓使用稳定选位。
- `src/pages/process-factory/cutting/wait-handover-web-actions.ts`
  - 如仍被当前入仓弹窗使用，同步稳定库位引用，避免保留另一条文本写入路径。
- `src/pages/pda-warehouse-wait-process.ts`
  - 删除裁床硬编码库位选项，接入待加工仓连续多选。
- `src/pages/pda-cutting-inbound.ts`
  - 扫码/可视化单选待交出库位，并幂等写入共同运行时事件。
- `src/pages/pda-cutting-handover.ts`
  - 特殊工艺回仓解析稳定库位并写入共同运行时事件。
- `src/pages/pda-warehouse-shared.ts`
  - 增加稳定路径查询 helper；保留其他工艺现有三级选项能力。
- `src/main-handlers/fcs-handlers.ts`
  - 接入 PFOS 库位图局部事件。
- 与上述流程对应的既有检查脚本。
- `package.json`
  - 增加专项检查和专项 Playwright 命令。

### 2.3 明确不修改

- 不新增仓库路由、菜单或 PDA 一级入口。
- 不改通用仓库层级。
- 不批量迁移其他仓库模块。
- 不修改标准列表页基线或治理脚本。
- 不把 Prototype Store 改成真实数据库或接口层。

---

## 3. 统一数据契约

### 3.1 编排快照

```ts
export interface FactoryWarehouseLayoutSnapshot {
  factoryId: string
  warehouseKind: 'WAIT_PROCESS' | 'WAIT_HANDOVER'
  warehouseId: string
  layoutVersion: number
  areaOrder: string[]
  shelfOrderByAreaId: Record<string, string[]>
  locationOrderByShelfId: Record<string, string[]>
  unassignedLocationIds: string[]
  locationLabelOverrides: Record<string, {
    locationNo: string
    locationName: string
  }>
  updatedAt: string
  updatedBy: string
}
```

不变量：

- 顺序数组保存 ID，不保存编号。
- 没有快照时使用当前嵌套数组顺序。
- 主数据新增节点自动追加到所属层级末尾。
- 快照引用已删除节点时忽略该 ID、保留错误提示并回退。
- `unassignedLocationIds` 只承接导入/历史适配产生的临时未编排项，不是新业务层级。
- 保存时传入预期 `layoutVersion`；版本不一致则拒绝覆盖。

### 3.2 稳定库位路径

```ts
export interface StableWarehouseLocationRef {
  factoryId: string
  warehouseId: string
  warehouseKind: 'WAIT_PROCESS' | 'WAIT_HANDOVER'
  areaId: string
  areaName: string
  shelfId: string
  shelfNo: string
  locationId: string
  locationNo: string
}
```

新事实保存全部字段。历史解析顺序固定为：

1. `locationId`。
2. 同工厂、同仓库的 `areaName + shelfNo + locationNo`。
3. 同工厂、同仓库唯一的 `areaName + locationNo`。
4. 否则进入未定位清单，不猜测。

扫码同时接受稳定二维码和当前编号；编号匹配不唯一时阻断。

### 3.3 占用和存放范围

```ts
export type WarehouseLocationBusinessStatus = 'EMPTY' | 'OCCUPIED'

export interface WarehouseStorageFootprint {
  footprintId: string
  sourceType: 'PICKUP_SESSION' | 'TEMP_BAG' | 'TRANSFER_BAG' | 'SPECIAL_CRAFT_RETURN'
  sourceId: string
  locationIds: string[]
  totalQty: number
  unit: string
  remainingQty: number
  inboundAt: string
  inboundBy: string
}

export interface WarehouseLocationOccupancy {
  occupancyId: string
  footprintId: string
  locationId: string
  productionOrderNo: string
  objectNo: string
  objectName: string
  qty: number
  unit: string
  inboundAt: string
  inboundBy: string
}
```

规则：

- 多库位物料总量只存在 `footprint` 一次；各格只引用范围，不重复汇总。
- `remainingQty > 0` 时范围内库位均占用。
- 部分领出默认保留原范围；仓管通过“调整剩余存放范围”缩小连续区间。
- `remainingQty = 0` 时释放整个范围。
- 业务状态只输出 `EMPTY`、`OCCUPIED`；选中是临时 UI 属性。
- 主数据 `AVAILABLE/STOPPED` 与业务占用分开；停用节点不入图、不计数。

### 3.4 待交出生命周期折叠

按事件时间和稳定业务身份折叠：

1. `菲票装袋`：建立袋内容，不占库位。
2. `中转袋入仓`：以袋使用 ID + 稳定库位建立占用。
3. `交出装袋确认`：从临时袋转为目标袋，默认继承原物理位置；不得重复计数。
4. `新增交出记录`：目标袋离仓，移除对应占用。
5. `特殊工艺交出`：按菲票、袋和实交数量减少占用。
6. `特殊工艺回仓`：按回仓事件的新稳定库位和实回数量建立占用。

`toLocationCode` 或 `fromLocationCode` 等于袋码时不得作为物理位置。关联优先使用袋使用 ID、事件引用、菲票 ID、稳定库位 ID。

### 3.5 幂等与确认顺序

- 领料存放幂等键：领料会话 ID + 节点版本。
- 中转袋入仓幂等键：袋使用 ID + `INBOUND`。
- 特殊工艺回仓幂等键：回仓记录 ID + 菲票 ID + 特殊工艺 ID。
- 确认前重新读取最新投影并校验所有目标库位。
- 任一库位冲突时整次失败，不部分写入。
- 运行时事件写入成功后才更新 PDA 本地状态并清空表单。
- 写入失败时保留表单和待处理状态。

---

## 4. 实施任务

### 任务 1：建立专项检查、编排快照和历史编码迁移

**文件：**

- 新建 `warehouse-location-layout-store.ts`
- 新建 `warehouse-location-map-model.ts`
- 新建 `scripts/check-cutting-warehouse-location-map.ts`
- 修改 `factory-internal-warehouse.ts`
- 修改 `package.json`

- [x] 1.1 在 `package.json` 增加：

```json
"check:cutting-warehouse-location-map": "tsx scripts/check-cutting-warehouse-location-map.ts",
"check:cutting-warehouse-location-map-e2e": "playwright test tests/cutting-warehouse-location-map.spec.ts"
```

- [x] 1.2 先写失败检查，覆盖：
  - 两个裁床工厂各有待加工仓、待交出仓。
  - 无快照时沿用当前数组顺序。
  - 移动后保存、重读和刷新模拟仍保持顺序。
  - 编号修改不改变 ID 和顺序。
  - 旧版本保存被拒绝。
  - 损坏快照回退且产生可见提示。
  - 不同工厂、不同仓库类型互不污染。
- [x] 1.3 实现版本化本地键，例如：

```text
higood:cutting-warehouse-layout:v1:{factoryId}:{warehouseKind}
```

- [x] 1.4 实现 `buildInitialLayoutSnapshot`、`readLayoutSnapshot`、`saveLayoutSnapshot`、`applyLayoutSnapshot`。
- [x] 1.5 实现历史位置迁移报告：
  - `MATCHED`：唯一匹配并补稳定路径。
  - `NEEDS_CONFIRMATION`：存在多个候选。
  - `UNRESOLVED`：没有候选。
- [x] 1.6 将 `FAB-*`、`CUT-*`、`SP-RETURN-*` 静态示例纳入检查，禁止静默生成第二套库位。
- [x] 1.7 运行：

```bash
npm run check:cutting-warehouse-location-map
npm run check:factory-internal-warehouse-model
```

### 任务 2：建立待加工仓占用投影和连续存放范围

**文件：**

- 修改 `warehouse-location-map-model.ts`
- 修改 `production-material-prep.ts`
- 修改 `cutting-runtime-event-ledger.ts`
- 修改专项检查

- [x] 2.1 先写失败检查：
  - 有剩余量才占用。
  - 一个库位多条物料只计一个占用格。
  - 一批物料关联 3 个库位时总量只计算一次。
  - 同货架连续允许；跨区、跨架、间隔或穿过占用格阻断。
  - 编号不连续、布局顺序连续时允许。
  - 点击两端可扩展/收缩；点击中间格阻断；清空可重选。
  - 部分领出保守保持原范围。
  - 调整剩余存放范围后释放被移除的端部库位。
  - 剩余量为零后释放全部范围。
- [x] 2.2 为领料会话和运行时事件增加 `storageFootprint` 与稳定路径快照；保留原文本字段兼容既有表格。
- [x] 2.3 确认领料前重新读取投影，整组校验后一次写入。
- [x] 2.4 增加“调整剩余存放范围”领域函数；只允许当前范围的连续子区间或重新选择的连续空闲范围。
- [x] 2.5 运行：

```bash
npm run check:cutting-warehouse-location-map
npm run check:material-prep-pickup-management
npm run check:cutting-pickup-ui-closure
npm run check:cutting-warehouse-writeback-chain
```

### 任务 3：修正待交出仓事实投影和完整袋生命周期

**文件：**

- 修改 `wait-handover-runtime.ts`
- 修改 `cutting-runtime-event-ledger.ts`
- 修改专项检查

- [x] 3.1 先建立回归检查，明确：
  - 只有 `菲票装袋` 时占用数为 0。
  - `中转袋入仓` 后对应库位占用。
  - 投影函数不得从 `菲票装袋` 生成 `inboundTempBags`。
  - 交出装袋确认后同一库位只保留目标袋一次。
  - 新增交出记录后释放目标袋。
  - 同库位还有其他袋时继续占用。
  - 特殊工艺交出减少对应对象，特殊工艺回仓按新位置恢复。
  - 部分回仓保留实回数量。
  - 袋码不被解析成物理库位。
- [x] 3.2 将 `buildRuntimeInboundTempBagsFromWaitHandoverEvents` 改为以 `中转袋入仓` 为起点，并关联此前装袋内容。
- [x] 3.3 入仓、交出装袋确认、最终交出、特殊工艺交出/回仓事件补稳定路径和幂等键。
- [x] 3.4 实现按事件顺序折叠的当前占用投影，取消事件和已离仓历史不参与当前占用。
- [x] 3.5 保留现有 Web/PDA 业务动作边界，不合并弹窗，不新增页面。
- [x] 3.6 运行：

```bash
npm run check:cutting-warehouse-location-map
npm run check:pda-cutting-wait-handover-route-integration
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
npm run check:web-cutting-transfer-bag-actions
npm run check:cutting-special-craft-dispatch-return
```

### 任务 4：实现共享库位图组件

**文件：**

- 新建 `src/components/ui/warehouse-location-map.ts`
- 修改专项检查

- [x] 4.1 先断言组件契约：
  - 标题、当前工厂、当前仓库、总数、空闲数、占用数。
  - 只有“空闲”“占用”两种业务状态文字。
  - 每个格有 `data-location-id`、中文状态和可访问名称。
  - 选中格仍标记业务状态“空闲”，另有勾选和边框。
  - 库位按钮最小 44×44 像素。
  - 占用详情和未定位清单具有分页。
  - 只有货架行使用横向滚动。
- [x] 4.2 组件支持 `VIEW`、`SELECT`、`LAYOUT` 三种模式，输出 `data-*` 事件契约，不读 Store。
- [x] 4.3 状态使用文字、图标、边框和颜色共同表达；Web 支持 Enter/Space。
- [x] 4.4 1366×768、1280×720 使用多列或单列自适应；1024×768 强制单列库区卡片。
- [x] 4.5 禁止大段业务逻辑直接堆在页面模板内；业务详情由独立渲染函数输出。

### 任务 5：接入 PFOS 两张库位图与编排

**文件：**

- 新建 `warehouse-location-map.ts`
- 修改 `warehouse-hub.ts`
- 修改 `fcs-handlers.ts`
- 修改 `check-cutting-warehouse-management-switch.ts`
- 修改专项检查

- [x] 5.1 把两个现有页签标签从“库区库位”改为“库位图”，路由保持不变。
- [x] 5.2 库位图顶部增加当前裁床工厂选择器，并把选择写入 `factoryId` 查询参数或既有页面状态。
- [x] 5.3 替换静态库位行，保留其他页签、筛选、列表、弹窗和工作台。
- [x] 5.4 编排模式支持：
  - 库区前移/后移。
  - 货架上移/下移。
  - 库位左移/右移。
  - 临时未编排项归入货架。
  - 修改库位编号和名称显示覆盖。
  - 保存前版本校验。
- [x] 5.5 待加工 PFOS 领料/回收入仓动作使用同一库位解析；需要多个库位时复用连续选择。
- [x] 5.6 待交出 PFOS“中转袋入仓”和“特殊工艺回仓”使用稳定库位选择；“菲票装袋”继续不展示库位输入。
- [x] 5.7 点击库位、切换详情、调整顺序仅刷新 `[data-warehouse-map-root]` 或详情容器；不得整页 `root.innerHTML`。
- [x] 5.8 局部插入后只 hydrate 新区域图标。
- [x] 5.9 运行：

```bash
npm run check:cutting-warehouse-management-switch
npm run check:web-cutting-transfer-bag-actions
npm run check:cutting-warehouse-location-map
```

### 任务 6：接入 PDA 待加工仓连续多选

**文件：**

- 修改 `pda-warehouse-wait-process.ts`
- 修改 `pda-warehouse-shared.ts`
- 修改专项及现有领料检查

- [x] 6.1 删除裁床专用 `CUTTING_RECEIVE_LOCATIONS` 硬编码来源，改为按当前 `factoryId` 读取待加工仓。
- [x] 6.2 保持 PDA 首屏顺序：
  1. 当前领料节点。
  2. 本次全部物料。
  3. 选择存放库位。
  4. 唯一主按钮“确认全部领料”。
- [x] 6.3 实现端点扩展/缩短、清空重选、不可选提示和已选范围摘要。
- [x] 6.4 确认前重新投影；冲突时列出具体库位并保留其他有效选择。
- [x] 6.5 新写入会话保存完整稳定路径和一次性存放范围，兼容文本取第一库位摘要。
- [x] 6.6 领料后提供“调整剩余存放范围”入口，只修改位置关联，不手工改业务状态。
- [x] 6.7 输入和库位点击只局部更新，目标响应不超过 200ms。
- [x] 6.8 运行：

```bash
npm run check:cutting-warehouse-location-map
npm run check:cutting-pickup-ui-closure
npm run check:material-prep-pickup-management
npm run check:cutting-pickup-important-regressions
```

### 任务 7：接入 PDA 中转袋入仓和特殊工艺回仓

**文件：**

- 修改 `pda-cutting-inbound.ts`
- 修改 `pda-cutting-handover.ts`
- 修改 `wait-handover-runtime.ts`
- 修改专项及现有 PDA 检查

- [x] 7.1 中转袋入仓表单增加 `selectedLocationId`、稳定路径和幂等键。
- [x] 7.2 扫码优先，库位图作为确认/兜底；只允许单选当前待交出仓空闲库位。
- [x] 7.3 扫码结果不存在、歧义、停用、未编排、非当前工厂或已占用时分别阻断。
- [x] 7.4 确认顺序固定为：
  1. 校验袋为待入仓。
  2. 校验最新库位投影。
  3. 幂等写入 `中转袋入仓` 事件。
  4. 成功后更新 PDA 本地袋状态。
  5. 清空表单并局部刷新。
- [x] 7.5 写入失败时保留表单、袋状态和选择，显示可重试提示。
- [x] 7.6 特殊工艺回仓在现有 PDA handover 页面继续执行，扫描稳定库位并把 `locationId` 写入回仓事件。
- [x] 7.7 PFOS 与 PDA 对同一幂等键重复提交时只保留一条有效事实。
- [x] 7.8 运行：

```bash
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-wait-handover-route-integration
npm run check:pda-cutting-transfer-bag-handover
npm run check:special-craft-pda-warehouse-actions
npm run check:cutting-special-craft-dispatch-return
npm run check:cutting-warehouse-location-map
```

### 任务 8：浏览器验收和原型审查

**文件：**

- 新建 `tests/cutting-warehouse-location-map.spec.ts`
- 新建原型审查记录
- 修改专项检查

- [x] 8.1 PFOS 待加工仓验证：
  - 正确工厂、仓库、统计和两态图例。
  - 占用详情显示生产单、物料、数量、责任人、时间和存放范围。
  - 多库位总量不重复。
  - 未定位清单可分页。
- [x] 8.2 PFOS 待交出仓验证：
  - 装袋不占用，入仓后占用。
  - 换成目标袋后同格只显示目标袋一次。
  - 最终交出释放，其他袋仍在时不释放。
  - 特殊工艺回仓按新位置恢复。
- [x] 8.3 编排验证：
  - 移动库位、修改编号、保存、切换路由、刷新浏览器。
  - 顺序仍在、`data-location-id` 不变。
  - 不同工厂和仓库互不影响。
  - 旧版本保存被阻断。
- [x] 8.4 PDA 验证：
  - 连续端点多选、跨架阻断、中间取消阻断、清空重选。
  - 扫码唯一匹配、歧义、停用、占用和同步失败。
  - 重试不重复入仓。
- [x] 8.5 分辨率验证：
  - 1366×768 页面主体无横向溢出。
  - 1280×720 可查看、编排和选位。
  - 1024×768 库区单列，货架内部滚动。
  - PDA 小屏主按钮和错误提示无需横向滚动。
- [x] 8.6 性能验证：
  - 详情、选位、编排、分页不整页闪烁，不丢滚动位置。
  - 单次按钮响应不超过 200ms。
  - 输入不触发整页重绘。
- [x] 8.7 原型审查记录覆盖角色、设备、协作、页面模式、中文文案、状态、数量、防错、异常、性能及全部受管文件。

---

## 5. 验证矩阵

### 5.1 专项和直接回归

```bash
npm run check:cutting-warehouse-location-map
npm run check:factory-internal-warehouse-model
npm run check:cutting-warehouse-management-switch
npm run check:material-prep-pickup-management
npm run check:cutting-pickup-ui-closure
npm run check:cutting-pickup-important-regressions
npm run check:cutting-warehouse-writeback-chain
npm run check:pda-cutting-wait-handover-route-integration
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
npm run check:web-cutting-transfer-bag-actions
npm run check:special-craft-pda-warehouse-actions
npm run check:cutting-special-craft-dispatch-return
```

### 5.2 页面、治理和构建

```bash
npm run check:cutting-warehouse-location-map-e2e
npm run check:list-page-governance
npm run check:prototype-design-governance
npm run build
```

库位图不是列表页，不加 `// @page-pattern: list`；如果新增/修改的占用明细采用标准列表页骨架，则对应源文件必须遵守列表页门禁。

### 5.3 CodeGraph 和任务收据

最后一次实质改动后：

```bash
codegraph sync
codegraph status

warehouse_map_receipt_dir=$(mktemp -d)
npm run workflow:verify -- \
  --output "$warehouse_map_receipt_dir/task-receipt.json" \
  --task-boundary "裁床待加工仓与待交出仓库位图、稳定编排、编码迁移、两态占用、完整袋生命周期、PDA相邻选位与幂等入仓" \
  --stage-trace /tmp/higoods-cutting-warehouse-location-map-stage-trace.json \
  --required-skills superpowers-zh:test-driven-development,superpowers-zh:executing-plans
```

如果实际使用子代理驱动，将 `executing-plans` 替换为 `subagent-driven-development`，并按项目规则补两阶段审查和 `--require-two-stage-review`。

只有收据状态为 `verified` 才能表述为本地验证闭环；没有 GitHub API 回执不得表述为远端已交付。

---

## 6. 提交边界与检查点

建议提交顺序：

1. `feat(裁床仓库): 建立库位编排快照与编码迁移`
2. `feat(裁床仓库): 建立待加工仓存放范围投影`
3. `fix(裁床仓库): 统一待交出仓入仓占用事实`
4. `feat(裁床仓库): 实现共享库位图组件`
5. `feat(裁床仓库): 接入PFOS库位图与编排`
6. `feat(裁床仓库): 接入PDA库位选位`
7. `test(裁床仓库): 补齐库位图验收与审查`
8. 必要时 `chore(裁床仓库): 收口库位图验证`

每个检查点只暂存本任务文件，禁止 `git add .` 或 `git add -A`。

关键停点：

- 任务 1 后确认没有给通用仓库接口增加强制排序字段。
- 任务 2 后确认多库位数量不重复、部分领出有明确规则。
- 任务 3 后确认装袋不占用、入仓才占用、换袋不双算。
- 任务 5 后人工审查现有 PFOS 单页工作台没有被拆散。
- 任务 7 后确认 PFOS/PDA 同事实、失败可重试且幂等。
- 最后一次修改后必须重新执行完整验证，旧收据失效。

实施时必须保留用户现有无关工作区改动，不覆盖、不暂存、不提交。

---

## 7. 完成定义

以下条件全部满足，才算本功能达到 `verified`：

- [x] 页面只使用仓库—库区—货架—库位，不出现“库位组”。
- [x] 编排快照刷新后稳定，编号变化不改变 ID、位置和相邻关系。
- [x] 多工厂、多仓库严格隔离。
- [x] 历史库位迁移有唯一匹配、待确认、无法匹配结果，不猜测。
- [x] 日常图只有空闲、占用，停用是独立主数据维度。
- [x] 待加工多库位数量不重复，部分领出和范围调整规则通过。
- [x] 装袋不占库位，入仓才占用，换袋不双算，交出正确释放。
- [x] 特殊工艺交出/回仓正确影响占用。
- [x] Web/PDA 使用同一事实和稳定库位路径。
- [x] 确认前重校验、写入幂等、失败保留现场输入。
- [x] 占用详情与未定位清单分页。
- [x] 1024×768 及以上 Web 可用，PDA 小屏可完成主动作。
- [x] 局部交互无整页重绘，目标响应不超过 200ms。
- [x] 专项检查、全部直接回归、浏览器验收、治理检查和构建通过。
- [x] 原型审查记录完整，无未说明例外。
- [x] CodeGraph 已同步且任务收据状态为 `verified`。
