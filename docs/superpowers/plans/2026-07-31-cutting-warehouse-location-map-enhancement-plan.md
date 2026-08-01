# 裁床库位图新增结构与占用详情增强实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）跟踪进度。实现前先阅读 `docs/superpowers/specs/2026-07-30-cutting-warehouse-location-map-design.md` 与本计划。

**目标：** 为裁床待加工仓和待交出仓库位图增加普通查看模式下的新增库区/库位弹窗、稳定的本地结构持久化、生产单级占用摘要、真实语义的非空闲演示数据，以及带款式图/物料图/卷明细/菲票明细的库位详情。

**架构：** 继续使用 `warehouse-location-map.ts` 组合仓库与占用投影，使用 `warehouse-location-map-model.ts` 生成稳定的地图投影，使用 `warehouse-location-layout-store.ts` 保存编排和新增结构。新增结构必须进入库位图快照，因为 `factory-internal-warehouse.ts` 当前的仓库 Store 由 `ensureFactoryInternalWarehouseStore()` 保存在内存中，不能单独依赖其运行时变更跨刷新保留。占用详情通过裁床专用 view model 组装，不改变公共 `WarehouseLocationOccupancy` 的通用职责。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、localStorage mock、现有 Node 专项检查和 Playwright。

---

## 1. 文件边界与职责

**需要修改：**

- `src/pages/process-factory/cutting/warehouse-location-layout-store.ts`
  - 扩展快照以保存新增库区、货架、库位的结构定义。
  - 保持版本校验、损坏回退、历史记录和已有编排顺序兼容。
- `src/pages/process-factory/cutting/warehouse-location-map-model.ts`
  - 增加新增节点合并、生产单聚合、占用详情类型和基础校验。
- `src/pages/process-factory/cutting/warehouse-location-map.ts`
  - 普通查看模式输出新增按钮和新增弹窗。
  - 处理新增提交、局部刷新和占用详情数据组装入口。
- `src/components/ui/warehouse-location-map.ts`
  - 增强库位卡片摘要、生产单摘要区和详情抽屉；保持公共组件不读取业务 Store。
- `src/pages/process-factory/cutting/warehouse-hub.ts`
  - 为待加工仓和待交出仓提供完整占用明细所需的生产单、图片、物料卷、菲票数据。
  - 保持现有领料、回收入仓、装袋、入仓和交出事实链路不变。
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
  - 仅在新增的卷明细字段需要进入事件 payload 时扩展兼容字段；不改变既有事件类型语义。
- `src/data/fcs/factory-internal-warehouse.ts`
  - 仅在现有创建 helper 不足以生成稳定节点时补充最小 helper；不修改通用仓库层级契约。
- `scripts/check-cutting-warehouse-location-map.ts`
  - 增加结构新增、占用约束、图片和汇总检查。
- `tests/cutting-warehouse-location-map.spec.ts`
  - 增加两张图的浏览器行为验收。
- `docs/prototype-review-records/2026-07-31-cutting-warehouse-location-map-enhancement.md`
  - 按模板记录本次页面、组件、mock 数据和交互变更。

**不修改：**

- 路由和菜单，不新增页面入口。
- `src/components/ui/warehouse-location-map.ts` 以外的通用仓库 UI 体系。
- 印花、染色、毛织、后道或特殊工艺仓库页面。
- 标准列表页基线、治理脚本和真实后端接口。

## 2. 任务 1：补充失败专项检查与数据契约

**文件：**

- 修改：`scripts/check-cutting-warehouse-location-map.ts`
- 修改：`src/pages/process-factory/cutting/warehouse-location-layout-store.ts`
- 修改：`src/pages/process-factory/cutting/warehouse-location-map-model.ts`

- [ ] **步骤 1：先增加失败检查，锁定新增结构持久化契约。**

  检查以下行为：

  - `WAIT_PROCESS` 和 `WAIT_HANDOVER` 均可新增库区。
  - 新增库区包含至少一个货架和一个库位。
  - 新增库位可指定已有库区和货架。
  - 新增库区/库位具有稳定唯一 ID。
  - 新增结构写入快照后，重新读取并应用快照仍可出现在 `projection.areas`。
  - `WAIT_PROCESS` 的新增结构不出现在 `WAIT_HANDOVER`。
  - 不同工厂的新增结构互不污染。
  - 旧快照没有新增字段时仍能正常加载。

  示例断言形态：

  ```ts
  const created = appendWarehouseArea(snapshot, {
    areaId: 'AREA-ADDED-1',
    areaName: '主身扩展区',
    shelfList: [{
      shelfId: 'SHELF-ADDED-1',
      shelfNo: '主身扩展区-01',
      shelfName: '主身扩展区-01',
      locationList: [{
        locationId: 'LOC-ADDED-1',
        locationNo: '主身扩展区-01-01',
        locationName: '主身扩展区-01-01',
        status: 'AVAILABLE',
        remark: '',
      }],
      status: 'AVAILABLE',
      remark: '',
    }],
    status: 'AVAILABLE',
    remark: '',
  })
  const result = applyWarehouseLayoutSnapshot(warehouse, created)
  assert.equal(result.warehouse.areaList.some((area) => area.areaId === 'AREA-ADDED-1'), true)
  ```

- [ ] **步骤 2：运行专项检查，确认新增检查先失败。**

  运行：

  ```bash
  npm run check:cutting-warehouse-location-map
  ```

  预期：新增结构相关断言失败，既有库位图基础检查保持通过。

- [ ] **步骤 3：扩展快照类型，保存新增结构定义。**

  在 `FactoryWarehouseLayoutSnapshot` 增加以下字段，使用可选字段兼容旧 localStorage：

  ```ts
  addedAreaList?: FactoryWarehouseArea[]
  addedLocationListByShelfId?: Record<string, FactoryWarehouseLocation[]>
  ```

  约束：

  - 新增库区完整保存嵌套货架和库位定义。
  - 新增到已有货架的库位保存到 `addedLocationListByShelfId[shelfId]`。
  - 新增库位只能存在于一个货架，不能同时出现在新增库区嵌套结构和新增库位列表中。
  - `areaOrder`、`shelfOrderByAreaId`、`locationOrderByShelfId` 仍只保存 ID 顺序。
  - `areaLabelOverrides`、`shelfLabelOverrides`、`locationLabelOverrides` 继续只负责显示名称。

- [ ] **步骤 4：实现新增结构合并和快照兼容。**

  在 `applyWarehouseLayoutSnapshot()` 前先将 `addedAreaList` 合并到仓库副本，再将 `addedLocationListByShelfId` 合并到对应货架，最后走现有 `orderByIds()`、`applyArea()` 和名称覆盖流程。实现要求：

  - 复制输入，禁止修改原始主数据对象。
  - 新增库区/货架/库位 ID 重复时产生 warning，不重复渲染。
  - 快照损坏或新增结构不完整时回退到可用主数据，并保留可见 warning。
  - 新增节点自动补齐对应的顺序数组，避免每次刷新被当成“新增库位按主数据顺序追加”。

- [ ] **步骤 5：实现新增节点操作函数。**

  在 `warehouse-location-layout-store.ts` 增加明确的纯函数，至少包括：

  ```ts
  export function appendWarehouseArea(
    snapshot: FactoryWarehouseLayoutSnapshot,
    area: FactoryWarehouseArea,
  ): FactoryWarehouseLayoutSnapshot

  export function appendWarehouseLocation(
    snapshot: FactoryWarehouseLayoutSnapshot,
    areaId: string,
    shelfId: string,
    location: FactoryWarehouseLocation,
  ): FactoryWarehouseLayoutSnapshot
  ```

  函数必须：

  - 检查父库区/货架存在。
  - 拒绝重复 ID。
  - 追加顺序到末尾。
  - 新增到主数据货架时写入 `addedLocationListByShelfId`；新增到新增库区货架时写入对应的嵌套 `locationList`。
  - 不改变既有占用引用。

- [ ] **步骤 6：运行专项检查确认数据契约通过。**

  运行：

  ```bash
  npm run check:cutting-warehouse-location-map
  ```

  预期：新增结构、版本隔离、旧快照兼容和既有地图检查全部通过。

## 3. 任务 2：实现普通查看模式的新增库区/库位弹窗

**文件：**

- 修改：`src/pages/process-factory/cutting/warehouse-location-map.ts`
- 修改：`src/components/ui/warehouse-location-map.ts`
- 修改：`src/main-handlers/fcs-handlers.ts`，仅在现有 selector 不覆盖新增弹窗时调整分发

- [ ] **步骤 1：补充页面结构检查。**

  在专项检查中断言：

  - `VIEW` 模式显示 `新增库区` 和 `新增库位`。
  - `LAYOUT` 模式不显示两个新增按钮。
  - 两个按钮携带当前 `warehouseKind` 和当前 `warehouseId`。
  - 新增弹窗使用独立 `data-cutting-warehouse-modal` 标识，不与待加工/待交出业务动作弹窗混用。

- [ ] **步骤 2：运行专项检查确认页面检查先失败。**

  运行：

  ```bash
  npm run check:cutting-warehouse-location-map
  ```

  预期：VIEW/LAYOUT 新增按钮断言失败。

- [ ] **步骤 3：在库位图工具条加入按钮。**

  修改 `renderCuttingWarehouseLocationMapSection()`：

  - `VIEW` 模式输出两个新增按钮和现有 `编排库位图`。
  - `LAYOUT` 模式只输出 `完成编排`。
  - 保留工厂选择器、版本信息和当前 warning。

- [ ] **步骤 4：实现新增库区弹窗。**

  弹窗字段：

  - 库区名称，必填。
  - 备注，可选。

  提交时：

  - 读取当前仓库和当前快照。
  - 生成稳定 ID：`AREA-${warehouseId}-CUSTOM-${timestamp}`。
  - 同时生成一个货架和一个初始库位，编号用经过清理的库区名称加序号；名称重复时追加序号。
  - 通过 `appendWarehouseArea()` 更新快照。
  - 使用现有 `saveWarehouseLayoutSnapshot()` 做版本校验和历史记录。
  - 成功后关闭弹窗并只替换 `[data-cutting-warehouse-map-section]`。

- [ ] **步骤 5：实现新增库位弹窗。**

  弹窗字段：

  - 目标库区，默认当前第一个可用库区。
  - 目标货架，随库区联动；只有一个货架时自动选中。
  - 库位编号，可选；为空时按目标货架现有数量自动生成。
  - 库位备注，可选。

  提交时：

  - 重新读取最新投影，确认父库区和货架仍存在且可用。
  - 生成稳定 location ID，不复用编号作为 ID。
  - 检查当前仓库内编号唯一，重复时阻断并保留表单。
  - 通过 `appendWarehouseLocation()` 写入快照。
  - 成功后关闭弹窗并局部刷新地图。

- [ ] **步骤 6：实现新增弹窗局部事件处理。**

  在 `handleCuttingWarehouseLocationMapEvent()` 增加：

  - `open-add-area`
  - `open-add-location`
  - `close-add-dialog`
  - `submit-add-area`
  - `submit-add-location`

  处理规则：

  - 事件只在当前库位图 section 内生效。
  - 不触发 root 级 `innerHTML` 重绘。
  - 保存冲突时显示当前错误，保留弹窗和用户输入。
  - 保存成功后刷新地图 section，不刷新整个仓库页。

- [ ] **步骤 7：运行专项检查和 TypeScript 构建。**

  运行：

  ```bash
  npm run check:cutting-warehouse-location-map
  npm run build
  ```

  预期：新增弹窗结构、版本冲突、重复编号、局部刷新和构建全部通过。

## 4. 任务 3：建立裁床占用详情 view model

**文件：**

- 修改：`src/pages/process-factory/cutting/warehouse-location-map-model.ts`
- 修改：`src/pages/process-factory/cutting/warehouse-location-map.ts`
- 修改：`src/pages/process-factory/cutting/warehouse-hub.ts`
- 参考：`src/data/fcs/production-order-tech-pack-runtime.ts`
- 参考：`src/data/fcs/production-tech-pack-snapshot-types.ts`

- [ ] **步骤 1：补充失败检查，锁定两种占用详情。**

  检查：

  - 待加工仓详情包含生产单号、款式图、物料图、卷号、卷长、Yard、米。
  - 待交出仓详情包含生产单号、款式图、中转袋号、已装菲票、菲票号、部位、尺码、片数。
  - 同一生产单跨多个库位时，详情范围包含多个库位，但总量只计一次。
  - 同一库位不得出现两个生产单占用。

- [ ] **步骤 2：运行检查确认详情断言先失败。**

  运行：

  ```bash
  npm run check:cutting-warehouse-location-map
  ```

- [ ] **步骤 3：定义专用详情类型。**

  在裁床地图模型中增加类似以下类型：

  ```ts
  export interface CuttingWaitProcessOccupancyDetail {
    productionOrderNo: string
    styleName: string
    styleImageUrl?: string
    materialSku: string
    materialName: string
    materialColor?: string
    materialImageUrl?: string
    rolls: Array<{
      rollNo: string
      yard: number
      meter: number
      locationNo: string
    }>
    totalYard: number
    totalMeter: number
    locationNos: string[]
  }

  export interface CuttingWaitHandoverOccupancyDetail {
    productionOrderNo: string
    styleName: string
    styleImageUrl?: string
    bagCode: string
    packed: boolean
    ticketCount: number
    totalPieceQty: number
    tickets: Array<{
      feiTicketNo: string
      partName: string
      size: string
      pieceQty: number
      specialCraftText?: string
    }>
    locationNos: string[]
  }
  ```

- [ ] **步骤 4：实现图片来源解析。**

  对生产单调用 `getProductionOrderTechPackSnapshot(productionOrderId)`，图片优先级固定为：

  - 款式图：`productImages[0]`、`styleImages[0]`、`sampleImages[0]`。
  - 物料图：生产单快照 `materialImages[0]`、`patternImages[0]`，再使用占用对象已有物料图片字段。
  - 没有图片时使用现有项目占位图，不输出空白图片容器。

- [ ] **步骤 5：实现待加工仓卷详情。**

  当前 `FactoryWaitProcessStockItem` 和 `CuttingRuntimeEvent` 并不稳定提供完整卷明细，因此按以下顺序解析：

  - 优先读取事件 payload 中的 `rollNos`、`rollDetails` 或等价结构化卷数据。
  - 没有完整卷明细时，使用当前 `rollCount` 和总 Yard 构造明确标记为演示数据的卷行。
  - 米数使用统一换算：`meter = yard * 0.9144`，展示时保留两位小数。
  - 总 Yard 和总米数由卷行求和，不能按每个占用库位重复累加。

- [ ] **步骤 6：实现待交出仓袋内菲票详情。**

  根据 `WaitHandoverLocationOccupancyState.feiTicketIds` 查找生成菲票快照和当前袋快照：

  - 只把有 `菲票装袋` 快照的袋标记为 `已装菲票`。
  - `中转袋入仓` 才形成当前库位占用。
  - `交出装袋确认` 发生换袋时，详情展示当前目标袋码，不能保留旧临时袋作为当前占用主体。
  - `新增交出记录` 后不再出现在占用图和详情中。

- [ ] **步骤 7：运行专项检查。**

  运行：

  ```bash
  npm run check:cutting-warehouse-location-map
  ```

  预期：两种详情 view model、图片来源、单位换算和生命周期断言通过。

## 5. 任务 4：增加生产单级占用汇总和地图卡片摘要

**文件：**

- 修改：`src/pages/process-factory/cutting/warehouse-location-map-model.ts`
- 修改：`src/components/ui/warehouse-location-map.ts`
- 修改：`src/pages/process-factory/cutting/warehouse-location-map.ts`

- [ ] **步骤 1：补充汇总失败检查。**

  断言：

  - 待加工仓按生产单聚合卷数、Yard、米和库位数。
  - 待交出仓按生产单聚合中转袋数、菲票数、片数和库位数。
  - 一个生产单跨多个库位时生产单数只算 1。
  - 多库位占用总量不重复计算。
  - 空闲数、占用数、总数仍由地图格子数量计算。

- [ ] **步骤 2：实现 `buildCuttingWarehouseProductionOrderSummary()`。**

  该函数输入当前 `WarehouseLocationMapProjection` 和裁床详情数据，输出：

  ```ts
  interface CuttingWarehouseProductionOrderSummary {
    productionOrderNo: string
    styleName: string
    styleImageUrl?: string
    occupiedLocationCount: number
    rollCount?: number
    totalYard?: number
    totalMeter?: number
    bagCount?: number
    ticketCount?: number
    totalPieceQty?: number
  }
  ```

- [ ] **步骤 3：在地图顶部增加生产单摘要区。**

  展示：

  - 占用生产单数。
  - 占用库位数。
  - 当前仓类型对应的数量摘要。
  - 每个生产单号和简短对象摘要。

  摘要区是管理/仓管查看信息，不在选择模式中增加复杂操作。

- [ ] **步骤 4：增强占用库位卡片。**

  待加工仓显示：生产单号、物料 SKU、卷数、总 Yard / 米。

  待交出仓显示：生产单号、袋码、菲票数、片数、已装菲票。

  保持卡片最小高度 44px 和当前颜色语义；图片只出现在详情抽屉，不塞进密集地图格子。

- [ ] **步骤 5：运行专项检查。**

  运行：

  ```bash
  npm run check:cutting-warehouse-location-map
  ```

## 6. 任务 5：增强详情抽屉和交互性能

**文件：**

- 修改：`src/components/ui/warehouse-location-map.ts`
- 修改：`src/pages/process-factory/cutting/warehouse-location-map.ts`

- [ ] **步骤 1：补充详情抽屉页面契约检查。**

  断言：

  - 点击占用库位才打开详情。
  - 空闲库位不打开详情。
  - 待加工仓详情出现款式图和物料图。
  - 待交出仓详情出现款式图和菲票明细。
  - 详情数量带单位。
  - 长列表仍按当前每页 10 条分页。

- [ ] **步骤 2：扩展 `renderOccupancyDrawer()`。**

  将通用抽屉拆为：

  - 生产单摘要头部。
  - 图片识别区。
  - 当前库位路径。
  - 业务对象摘要。
  - 物料卷或袋内菲票明细。
  - 操作人、入仓时间和来源信息。

  继续使用当前 `locationId`、`occupancyPage` 查询参数和关闭遮罩，不引入新路由。

- [ ] **步骤 3：处理缺图、缺明细和未定位数据。**

  - 缺图时显示文本占位，不显示破图。
  - 缺卷明细时显示“卷明细待补充”，同时保留总量。
  - 未定位占用继续进入当前“待确认历史库位”区域，不伪造到某个库位。
  - 多占用详情按当前分页规则展示，生产单和对象摘要不重复计算。

- [ ] **步骤 4：验证局部更新。**

  浏览器测试保存：

  - `data-cutting-warehouse-map-section` 的 DOM 引用。
  - 点击库位前后的 root 节点引用。
  - 打开/关闭详情不替换页面 root。
  - 新增保存只替换当前地图 section。

  运行：

  ```bash
  npm run check:cutting-warehouse-location-map-e2e
  ```

## 7. 任务 6：补充稳定非空闲演示数据

**文件：**

- 修改：`src/data/fcs/factory-internal-warehouse.ts`，补充待加工仓库存种子中的卷号、长度、图片引用和跨库位生产单样例。
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`，补充无用户运行时事件时使用的确定性“装袋 -> 入仓”演示事件，并通过现有 `buildWaitHandoverLocationOccupancyStates()` 进入地图。
- 修改：`src/data/fcs/cutting/cutting-runtime-event-ledger.ts`，若待交出 demo 事件需要扩展 payload，补充对应字段的规范化。
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] **步骤 1：先确定 demo 数据不绕过真实投影。**

  demo 数据必须通过当前占用投影进入地图，不在公共组件里硬编码占用格。优先补到现有库存/运行时事件种子：

  - 待加工仓使用生产单物料入仓事实。
  - 待交出仓使用已装菲票后再入仓的中转袋事实。

- [ ] **步骤 2：补待加工仓 demo。**

  至少包含：

  - 一个生产单跨两个连续库位。
  - 三个以上唯一卷号。
  - 每卷 Yard 和米数。
  - 款式图和物料图可解析。
  - 其他库位保持空闲，能同时看到空闲和占用两态。

- [ ] **步骤 3：补待交出仓 demo。**

  至少包含：

  - 一个生产单的已装菲票中转袋跨两个库位，或一个生产单存在多个袋并分布于多个库位。
  - 袋内至少三张菲票。
  - `productionOrderNo`、`feiTicketIds` 和片数一致。
  - 仅 `中转袋入仓` 后占用，只有装袋而未入仓的袋不占用。

- [ ] **步骤 4：增加数据约束检查。**

  检查：

  - 每个地图库位最多绑定一个生产单。
  - 同一生产单可以绑定多个库位。
  - 待交出占用的袋一定有菲票快照。
  - 交出后占用消失。
  - 两仓和多工厂数据不串仓。

- [ ] **步骤 5：运行数据专项检查。**

  ```bash
  npm run check:cutting-warehouse-location-map
  npm run check:factory-internal-warehouse-model
  ```

## 8. 任务 7：浏览器验收与治理记录

**文件：**

- 修改：`tests/cutting-warehouse-location-map.spec.ts`
- 新建：`docs/prototype-review-records/2026-07-31-cutting-warehouse-location-map-enhancement.md`

- [ ] **步骤 1：增加 PFOS 两仓浏览器测试。**

  覆盖：

  - 待加工仓 `?tab=locations` 显示新增按钮、生产单摘要和非空闲格。
  - 待交出仓 `?tab=locations` 显示新增按钮、生产单摘要和非空闲格。
  - 普通模式显示新增，编排模式隐藏新增。
  - 新增库区弹窗提交后地图增加库区、初始货架和初始库位。
  - 新增库位弹窗提交后地图增加库位。
  - 刷新后新结构仍存在。
  - 点击待加工占用格看到款式图、物料图、卷号、Yard、米。
  - 点击待交出占用格看到款式图、中转袋和菲票明细。

- [ ] **步骤 2：增加边界测试。**

  - 重复库位编号阻断。
  - 空库区名称阻断。
  - 保存版本冲突保留弹窗输入。
  - 关闭弹窗不改变结构。
  - 空闲库位点击不打开占用详情。
  - 1366×768、1280×720、1024×768 和 390px 宽度不产生页面级横向溢出。

- [ ] **步骤 3：填写原型审查记录。**

  记录至少覆盖：

  - 角色：裁床仓管、主管、办公室文员。
  - 页面模式：PFOS 仓储查看/主管编排，不是 PDA 一线执行页。
  - 图片识别、数量单位、生产单汇总、库位防错。
  - 新增结构的现场含义和异常提示。
  - 缺图、缺卷明细、历史未定位和版本冲突。
  - 局部刷新和低分辨率验收。

- [ ] **步骤 4：运行浏览器验收。**

  ```bash
  npm run check:cutting-warehouse-location-map-e2e
  ```

## 9. 任务 8：最终验证和交付收口

- [ ] **步骤 1：运行专项检查。**

  ```bash
  npm run check:cutting-warehouse-location-map
  npm run check:factory-internal-warehouse-model
  ```

- [ ] **步骤 2：运行原型治理检查。**

  ```bash
  npm run check:prototype-design-governance -- --all
  ```

  预期：新增页面、组件、数据和审查记录均被识别，治理检查通过。

- [ ] **步骤 3：运行生产构建。**

  ```bash
  npm run build
  ```

- [ ] **步骤 4：同步 CodeGraph。**

  ```bash
  codegraph sync
  codegraph status
  ```

  预期：索引最新，待同步文件为 0。

- [ ] **步骤 5：生成任务收据。**

  ```bash
  mkdir -p /var/folders/p5/sm3z8lc52y7gycyy2dg4y6380000gn/T/higood-location-map-enhancement
  npm run workflow:verify -- \
    --output /var/folders/p5/sm3z8lc52y7gycyy2dg4y6380000gn/T/higood-location-map-enhancement/task-receipt.json \
    --task-boundary "裁床待加工仓与待交出仓库位图新增库区、新增库位、非空闲演示数据、生产单摘要和图文详情"
  ```

  只有最终修改、专项检查、治理检查、构建、CodeGraph 和收据全部绑定后，才能将状态描述为 `verified`。

## 10. 计划自检结论

- 已覆盖新增库区、库位入口、表单、稳定 ID、快照持久化和版本冲突。
- 已覆盖待加工仓生产单物料、卷号、Yard/米、款式图和物料图。
- 已覆盖待交出仓生产单、中转袋、已装菲票、菲票明细和款式图。
- 已覆盖生产单级汇总、多库位不重复计量和单库位单生产单约束。
- 已覆盖现有待交出生命周期：装袋不占位、入仓占位、换袋继承、交出释放、特殊工艺回仓。
- 已覆盖局部刷新、分页、低分辨率、中文状态和原型治理记录。
- 没有把本次需求扩展为通用 WMS、真实后端或 React 重构。
