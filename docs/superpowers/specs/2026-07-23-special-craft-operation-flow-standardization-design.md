# 特殊工艺域操作流程与展示规范化设计

## 日期

2026-07-23

## 背景

当前特殊工艺域（13个工艺，辅助工艺厂 + 特种工艺厂）存在以下不一致：

- 成衣与裁片第一个操作动作不同（"成衣仓出库" vs "确认接收裁片"），且"开始加工"是独立的第三个动作——实际操作中收货即意味着开始加工准备
- 完工和交出的确认对话框只要求一个总数，不按明细维度（SKU/菲票）确认
- 列表页加工对象列显示文本拼接，成衣场景无意义地展示"菲票 0 张"
- 仓库库区没有按工艺+加工对象拆分
- 裁片完工后只在菲票绑定记录上追加 `completedOperationNames`（字符串数组），没有生成可打印的完工菲票

## 现状代码分析

### 数据层

**操作动作定义**：`src/pages/process-factory/special-craft/shared.ts:207` 的 `getFastSpecialCraftWebActions()` 定义了 7 个动作，通过 `fromStatuses` 和 `objectType`（成衣/裁片）筛选。`SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND` 仅在成衣下出现且带有特殊 SKU 级 `window.prompt` 处理（`task-detail.ts:457-498`）。

**需求明细行**：`SpecialCraftTaskDemandLine`（`special-craft-task-orders.ts:83`）包含 `skuCode`、`colorName`、`sizeCode`、`planPieceQty` 等字段。成衣的明细行通过 `buildSpecialCraftTaskDemandLinesFromProductionOrder` 的"成衣 fallback 块"（`special-craft-task-generation.ts` 末尾约 100 行）从 BOM 的 `applicableSkuCodes` 匹配生产单 SKU 行生成。裁片的明细行通过纸样 `pieceRow.specialCrafts` 匹配生成。

**菲票绑定**：`CuttingSpecialCraftFeiTicketBinding`（`cutting/special-craft-fei-ticket-flow.ts:65`）有 50+ 字段，其中 `completedOperationNames: string[]`（行 89）是当前记录"已完成工艺"的字段——是纯字符串数组，不携带数量。`specialCraftFlowStatus`（行 57）约 11 种状态。菲票与加工单的绑定在 `buildSpecialCraftFeiTicketBindingsFromGeneratedFeiTickets()`（行 838）中通过 `productionOrderId + partName + skuColor` 匹配。

**仓库**：`FactoryInternalWarehouse`（`factory-internal-warehouse.ts:79`）有 `warehouseName`、`areaList`（A区~F区、异常区、待确认区）。`ensureSpecialTypeUnifiedWarehouseArtifacts`（`special-craft-task-orders.ts:1446`）为每个 `SPECIAL_CRAFT_FACTORY` 域的任务单按状态创建入/出库记录和库存项。当前仓库命名模式为 `{工厂名} · {待加工仓/待交出仓}`。

**工艺字典**：`process-craft-dict.ts` 中 13 个特殊工艺各自有 `craftCode`、`craftName`、`targetObject`（成衣或裁片部位）、`specialCraftType`（`AUXILIARY` 或 `SPECIAL_TYPE`）。

### 页面层

**列表页**：`task-orders.ts` 使用 `renderStandardListPage` 标准列表组件。每行代表一个 `SpecialCraftTaskOrder`（任务单），不拆分。操作列渲染最多 2 个快捷动作按钮（`data-special-craft-web-action` 模式）。

**详情页**：`task-detail.ts` 左侧 Tab 结构（概览/任务明细/仓库流转/差异异常/节点记录），右侧操作面板。操作面板通过 `renderWebActionPanel`（`shared.ts:299`）渲染。

### 图片资源

**SPU 缩略图**：当前代码中有 `spuImageByCode` 映射表（`production-material-prep.ts:602`），将 SPU 编码映射到静态图片路径如 `/tshirt-sample.jpg`。没有直接关联到 `SpecialCraftTaskOrder`。生产单的 `demandSnapshot.spuCode` 和菲票的 `sourceTechPackSpuCode` 可用于查找图片。

## 方案

### 一、统一操作流程

#### 1.1 动作精简与统一

将 7 个动作精简为 4 个核心动作 + 1 个异常动作：

| 动作 | 原对应动作 | fromStatus | toStatus | 成衣执行逻辑 | 裁片执行逻辑 |
|------|-----------|------------|----------|-------------|-------------|
| **确认接收** | 合并 成衣仓出库 + 确认接收裁片 + 开始加工 | `待领料` | `加工中` | 从 `demandLines` 解析 SKU（`colorName × sizeCode`），逐行 `window.prompt` 确认实收件数 | 从 `demandLines.feiTicketNos` 获取关联菲票列表，按菲票确认接收数量（默认=菲票 `qty`） |
| **完成加工** | 原 完成加工 | `加工中` | `待交出` | 逐 SKU 确认完工数量（默认=已收件数，可修改） | 逐菲票确认完工数量（默认=已收，可修改）；完工后更新 `CuttingSpecialCraftFeiTicketBinding.completedOperationNames` 追加工艺名 + 记录完工数量 |
| **发起交出** | 原 发起交出 | `待交出` | `已交出` | 逐 SKU 确认交出数量 | 逐菲票确认交出数量 |
| **上报差异** | 原 上报差异 | `加工中`、`待交出` | `差异` | 不变 | 不变 |
| **差异后重交** | 原 差异后重交 | `差异`、`异议中`、`异常` | `待交出` | 不变 | 不变 |

**删除的动作代码**：`SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND`、`SPECIAL_CRAFT_RECEIVE_CUT_PIECES`、`SPECIAL_CRAFT_START_PROCESS`。

**新增的动作代码**：`SPECIAL_CRAFT_CONFIRM_RECEIVE`（统一确认接收）。

#### 1.2 确认接收对话框设计

不再使用通用的 `openProcessWebStatusActionDialog` 单个数量输入框，改为自定义对话框：

**成衣版对话框**：渲染一个表单表格，列出所有 SKU 行：
```
颜色    尺码    计划件数    实收件数
白色    M       100        [input]
白色    L       200        [input]
黑色    M       150        [input]
```
数据源：从 `taskOrder.demandLines` 中提取去重的 `colorName × sizeCode` 组合，`planPieceQty` 为对应需求行的 `planPieceQty`。

**裁片版对话框**：渲染一个表单表格，列出关联菲票：
```
菲票号      部位    颜色    尺码    计划数量    接收数量
FT-xxx-01   前片    白色    M      50         [input]
FT-xxx-02   后片    白色    L      60         [input]
```
数据源：从 `taskOrder.demandLines` 中按 `feiTicketNos` 聚合。

#### 1.3 完成加工对话框设计

**成衣版**：按 SKU 维度，格式同"确认接收"，完工数量默认=已收件数。

**裁片版**：按菲票维度，完工数量默认=菲票已收数量。完工后：
1. 调用 `recomputeSequenceGate()` 更新该菲票在工序链中的位置
2. 在 `CuttingSpecialCraftFeiTicketBinding.completedOperationNames` 中追加 `"{craftName}"`（已是字符串数组，追加即可）
3. 记录 `SpecialCraftFeiTicketFlowEvent`，`eventType: '完工'`

#### 1.4 菲票完工标记字段扩展

`CuttingSpecialCraftFeiTicketBinding` 中已有 `completedOperationNames: string[]`（`special-craft-fei-ticket-flow.ts:89`）。完工时追加工艺名。如果需要在打印菲票时展示完工数量和完工时间，可在 binding 上扩展：

```typescript
// 在 CuttingSpecialCraftFeiTicketBinding 中新增
completedCraftDetails: Array<{
  craftName: string
  completedQty: number
  completedAt: string
}>
```

为保持兼容，当前可先用 `completedOperationNames` 追加字符串记录工艺名，扩展字段作为后续优化。

### 二、列表页展示变更

#### 2.1 当前问题

列表页 `task-orders.ts` 目前一个 `SpecialCraftTaskOrder` 一行。成衣场景下，`targetObject` 列展示 `"成衣 / 成衣 / 白色 / M"`（重复且无意义），`"菲票 0 张"` 对成衣无意义。

#### 2.2 拆行方案

不改数据模型，在渲染时按 `demandLines` 拆行：

**成衣**：一个 `SpecialCraftTaskOrder` 如果有 3 条 `demandLines`（白色/M、白色/L、黑色/M），列表渲染 3 行。每行显示该 SKU 的信息——`colorName / sizeCode`，`planPieceQty`。加工单号和工厂列跨行合并（`rowspan`），或每行重复显示。

**裁片**：一个 `SpecialCraftTaskOrder` 如果有 2 个菲票，列表渲染 2 行。点击菲票号唤醒打印预览（复用 `buildFeiTicketPrintLink` 或打印组件）。

`renderStandardListTable` 的 `StandardListColumn.render(row)` 接收 `SpecialCraftTaskOrder`，不支持拆行。需要修改渲染逻辑：
- 在 `renderStandardListPage` 调用前，将 `taskOrders` 按 `demandLines` 展开为 `rowItems: ExpandedTaskOrderRow[]`
- 合并行通过 rowspan CSS（在列 render 中判断是否是合并行的第一行）

#### 2.3 SPU 缩略图

**数据源**：生产单 `demandSnapshot.spuCode`。在 `SpecialCraftTaskOrder` 中已有 `productionOrderNo`，可通过 `productionOrders` 反查获取 `spuCode`。然后通过 `spuImageByCode` 映射或 fallback 到示例图片。

**列结构新增**：在加工单号列之前或之中增加缩略图列：
```
[48px 缩略图] 加工单号 | 生产单 | 加工对象 | 承接工厂 | 数量进度 | 状态 | 操作
```

点击缩略图弹窗展示大图（复用 `renderDialog` 或 `renderFormDialog`，渲染 `<img>` 标签）。

缩略图实现：
- 在 `shared.ts` 中添加 `resolveSpuImageUrl(taskOrder: SpecialCraftTaskOrder): string` 
- 逻辑：`spuImageByCode[taskOrder.productionOrder?.demandSnapshot?.spuCode]` → fallback 到 `/tshirt-sample.jpg`
- 在列表页新增一列为缩略图渲染

### 三、仓库默认库区

#### 3.1 工厂模型

当前工厂通过 `special-craft-dedicated-factories.ts` 管理，每个工艺一个 `factoryId`（如 `FAC-AUX-HEAT-TRANSFER`）。根据需求，改为两个工厂：

- **辅助工艺厂**：`FAC-AUX-CRAFT`，管理所有 `specialCraftType === 'AUXILIARY'` 的工艺
- **特种工艺厂**：`FAC-SPC-CRAFT`，管理所有 `specialCraftType === 'SPECIAL_TYPE'` 的工艺

但已有工厂 ID 被大量引用（`factory-internal-warehouse.ts`、`special-craft-dedicated-factories.ts`、mock 数据等）。改动路径：在 `special-craft-dedicated-factories.ts` 中将每个工艺的 `factoryId` 统一指向两个工厂的 ID（保留现有 ID 作为别名），仓库系统按新工厂 ID 建库区。

#### 3.2 库区命名规则

`FactoryInternalWarehouse.areaList` 中新增命名区域：

```
辅助工艺厂 · 待加工仓
  ├── 绣花-成衣库区 (A区)
  ├── 烫画-成衣库区 (B区)
  ├── 直喷-成衣库区 (C区)
  ├── 绣花-裁片库区 (D区)
  ├── 抽条-裁片库区 (E区)
  └── ...

特种工艺厂 · 待加工仓
  ├── 模板工艺-裁片库区 (A区)
  ├── 激光袋-裁片库区 (B区)
  └── ...
```

实现方式：
1. 在 `buildDefaultFactoryInternalWarehouses()` 中，为两个工厂创建仓库时，`areaList` 按工艺+加工对象枚举生成命名区域
2. 每种"工艺+加工对象"组合生成一个 area（A区、B区...），area 名称 = `{craftName}-{成衣/裁片物件}库区`
3. `ensureSpecialTypeUnifiedWarehouseArtifacts` 中入库时，根据 `taskOrder.craftName` + `taskOrder.targetObject` 选择对应 area

#### 3.3 自动入库

确认接收后：
1. 构建 `FactoryWarehouseInboundRecord` 时，计算 `targetAreaName = '{craftName}-{targetObjectLabel}库区'`
2. 在 `upsertFactoryWarehouseInboundRecord()` 中按 areaName 写入对应区域
3. `upsertFactoryWaitProcessStockItem()` 的 `areaName`、`shelfNo`、`locationNo` 自动从对应 area 下选取

### 四、菲票完工打印

裁片完工后可在菲票上展示"已完成 XX 工艺"标记。当前菲票打印通过 `buildFeiTicketPrintLink` 生成打印 URL（`/fcs/print/fei-ticket?...`）。

完工时：
1. 更新 `CuttingSpecialCraftFeiTicketBinding.completedOperationNames` 追加工艺名
2. 记录 `SpecialCraftFeiTicketFlowEvent`，`eventType: '完工'`
3. 菲票打印页面（`fei-ticket-print-projection.ts`）读取 `completedOperationNames` 展示"已完成工艺：绣花"标记

不新建菲票模型，完工菲票和原始菲票是同一个 ID——只是 `completedOperationNames` 从空变为有值。打印时如果该字段非空，在打印页追加已完成工艺信息。

## 不变项

- 特殊工艺域 13 个工艺定义（`process-craft-dict.ts`）不变
- 生产单 → 任务单自动生成逻辑（`special-craft-task-generation.ts`）不变
- `SpecialCraftTaskDemandLine` 接口结构不变
- `CuttingSpecialCraftFeiTicketBinding` 核心结构不变（仅扩展字段）
- 菲票绑定生成逻辑（`buildSpecialCraftFeiTicketBindingsFromGeneratedFeiTickets`）不变
- 上报差异、差异后重交的动作逻辑不变
- 菜单和路由结构不变
- 标准列表页组件（`renderStandardListPage` 等）不变

## 验证

- `npm run build` 通过
- `npm run check:list-page-governance` 通过
- `npm run check:prototype-design-governance -- --all` 通过
- 烫画（成衣-确认接收/完工/交出按 SKU）和绣花（裁片-确认接收/完工/交出按菲票）两种加工对象流程可走通
