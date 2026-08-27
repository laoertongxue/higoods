# 成衣 SPU 与 SKU 整色替换完整验收清单

> 验收状态：本次需求已完成本地实现与两遍核验
> 验收日期：2026-08-28
> 验收分支：`codex/garment-spu-replacement-20260827`
> 基线提交：`814fe172f30cb65aaab5fdb4f6f1388f2183a6df`
> 对应方案：`docs/product-design/成衣SPU与SKU整色替换完整调整方案.md`
> 全流程记录：`docs/product-design/成衣SPU与SKU整色替换全流程测试记录.md`
> 验收范围：当前原型仓库，不代表生产后端、真实库存数据库或线上部署已经完成

---

## 1. 验收结论

本次按“生产单 + 源颜色”完成了成衣 SPU 与 SKU 整色替换原型闭环。方案原有 45 条原子需求与本轮新增的 5 条页面可用性需求均已绑定实现位置，并完成专项契约、真实页面全流程、打印或反向范围审查；当前统计为：

- 原子需求：50 条。
- 已验证：50 条。
- 已实现待验证：0 条。
- 待实施：0 条。
- 已阻塞：0 条。
- 明确非范围：E／R 数量、销售退回、审批、回滚、多级替换、通用异常平台，均未引入。

完成的核心结果：

1. 已完成销售出库的历史数量保留原身份；成衣仓未售成衣、后道工厂未入仓成衣和生产单剩余待回货同步换为目标 SPU 与唯一目标 SKU。
2. 成衣仓未售成衣形成唯一成衣仓换码任务，以原入库批次完成旧 SKU 替换出库和新 SKU 替换入库。
3. 后道工厂未入仓成衣完成新条码、新吊牌打印和换码前不能交出；完成后后道对象使用目标 SKU。
4. 生产单剩余待回货使用目标 SKU，同时映射回原 SKU 匹配原车缝工厂分配。
5. 既有 QC／复检瑕疵和后续瑕疵统一归到目标 SKU，数量、原因、责任和扣款不变，原身份可追溯。
6. 生产单原需求、原工厂分配和冻结价格不变；实际构成可同时展示原 SPU 与目标 SPU。
7. 生产单列表、替换详情、成衣仓换码任务均覆盖条码和吊牌打印；发生替换后统一读取目标 SKU。
8. 截图非必填；上传后记录文件名、原图、上传人和上传时间，详情可点击查看原图。
9. 三个菜单均显示可识别图标；默认数据同时演示待处理、处理中、已完成三种场景。
10. 发起整色替换时，生产单和目标 SPU 均可搜索；源颜色只来自所选生产单，目标颜色只来自所选目标 SPU。

---

## 2. 验收证据索引

### 2.1 自动化证据

| 证据编号 | 命令／文件 | 覆盖范围 | 结果 |
|---|---|---|---|
| AUTO-01 | `npm run check:garment-spu-replacement:core` | 四类业务数量、整色唯一映射、范围防重、当前身份、仓库双流水、销售阻断、结算不变、截图可选与追溯字段 | 通过 |
| AUTO-02 | `npm run check:garment-spu-replacement:integration` | 后道交出门禁、既有／新增 QC 与复检瑕疵、剩余待回货双身份、原分配匹配、生产单／仓库双打印、真实 Code 128 | 通过 |
| AUTO-03 | `npm run check:garment-spu-replacement:surface` | 三个有效菜单图标、可搜索联动选择、三类 Mock、业务数量名称、路由、事件入口、双打印与范围反查 | 通过 |
| AUTO-04 | `npm run check:garment-spu-replacement:full-flow` | 从后道发起、上传截图、瑕疵迁移、后道换码、仓库旧出新入、双打印、生产单构成到最终完成的浏览器全流程 | 通过；1 个完整用例 |
| AUTO-05 | `npm run check:garment-spu-replacement` | AUTO-01～04 聚合重放，浏览器全流程为聚合验收必经项 | 通过 |
| AUTO-06 | `npm run build` | TypeScript 与 Vite 生产构建 | 通过；仅保留既有 chunk size 警告 |
| AUTO-07 | `npm run check:menu-routes` | 菜单 href 与命名路由可达性 | 通过 |
| AUTO-08 | `npm run check:list-page-governance:static` | 两个新增标准列表的页面模式与静态治理 | 通过 |
| AUTO-09 | `npm run check:standard-list-page-template` | 标准列表组件使用约束 | 通过 |
| AUTO-10 | 临时任务索引 + `npm run check:prototype-design-governance` | 只纳入本次 4 个用户可见受管文件与完整原型审查记录，不吸收并行任务改动 | 通过；4 个用户可见文件、1 份关联记录 |
| AUTO-11 | `git diff --check` | 空白符与补丁完整性 | 通过 |
| AUTO-12 | `codegraph sync` + `codegraph status` | 最终代码结构索引同步与健康状态 | 通过；无待同步文件 |

专项契约文件：

- `scripts/check-garment-spu-replacement.ts`
- `scripts/check-garment-spu-replacement-integration.ts`
- `scripts/check-garment-spu-replacement-surface.ts`
- `tests/garment-spu-replacement-full-flow.spec.ts`

### 2.2 页面与打印证据

| 证据编号 | 证据文件 | 验证内容 |
|---|---|---|
| PAGE-01 | `output/playwright/garment-spu-replacement-full-flow-01-mock-list.png` | 默认待处理、处理中、已完成三类 Mock，菜单图标与业务数量名称 |
| PAGE-02 | `output/playwright/garment-spu-replacement-full-flow-02-search-linked-create.png` | 生产单和目标 SPU 可搜索、源颜色和目标颜色按上级选择联动、可选截图 |
| PAGE-03 | `output/playwright/garment-spu-replacement-full-flow-03-created-detail.png` | 新建记录详情、四类业务数量、目标 SKU、双打印、瑕疵迁移与审计 |
| PAGE-04 | 浏览器打印预览断言 | 目标 SKU 新条码预览、HG 出货条码、日期、源 SKU 追溯 |
| PAGE-05 | 浏览器打印预览断言 | 目标 SKU 新吊牌预览、商品中心商品信息、HG 与零售两个真实条码 |
| PAGE-06 | `output/playwright/garment-spu-replacement-full-flow-04-warehouse-task-pending.png` | 成衣仓换码前任务、4 个尺码／来源批次、旧 SKU 销售出库阻断 |
| PAGE-07 | `output/playwright/garment-spu-replacement-full-flow-05-warehouse-task-completed.png` | 成衣仓换码完成后 8 条成对库存流水、来源批次保持、阻断解除 |
| PAGE-08 | `output/playwright/garment-spu-replacement-full-flow-06-production-order-ledger.png` | 生产单原需求与当前构成、列表“打印条码”“打印吊牌” |

浏览器控制台错误数为 0；图片原图预览完成后使用 `Esc` 只关闭图片层，不误关替换详情；在 1280×720 逐页复核后，后道替换、仓储替换、成衣仓换码任务和生产单台账均为 `document.scrollWidth = document.clientWidth = 1280`，宽表只在自身容器内滚动。

---

## 3. 50 条原子需求逐项验收

### 3.1 范围与商品中心

| 编号 | 验收结果 | 实现位置／符号 | 自动化证据 | 页面／打印证据 | 状态 |
|---|---|---|---|---|---|
| SCOPE-001 | 替换唯一范围固定为“生产单 + 源颜色”，同范围重复创建被阻断 | `garment-spu-replacement.ts`：`scopeKey`、`createGarmentSpuReplacement()`、`getActiveGarmentReplacement()` | AUTO-01、AUTO-03 | PAGE-01 | 已验证 |
| SCOPE-002 | 源颜色按实际需替换尺码整体生成映射和执行行，不开放尺码／批次勾选排除 | `buildGarmentReplacementPreview()`、`GarmentSpuReplacementLine.replacementRequired` | AUTO-01、AUTO-03 | PAGE-03 | 已验证 |
| MASTER-001 | 目标 SPU/SKU 只从商品中心现有启用档案读取，页面没有现场创建入口 | `listSkuArchives()`、`resolveTargetSku()`、`renderCreateDialog()` | AUTO-01、AUTO-03 | PAGE-01 | 已验证 |
| MASTER-002 | 只对实际需要替换且数量大于 0 的尺码要求目标颜色存在唯一目标 SKU；仅有销售历史的尺码不设目标门禁 | `buildGarmentReplacementPreview()`、`resolveTargetSku()` | AUTO-01 | PAGE-03 | 已验证 |
| MASTER-003 | 未增加图片、条码、洗涤方式、执行标准、安全类别或其他商品资料齐全门禁 | `resolveTargetSku()` 的唯一性校验；surface 非法门禁扫描 | AUTO-03 | PAGE-01、PAGE-03 | 已验证 |
| FORM-001 | 生产单使用可输入搜索的下拉列表，只能提交当前生产单数据中的有效项 | `renderCreateDialog()`、`data-searchable-select="production-order"`、datalist 精确匹配 | AUTO-03、AUTO-04 | PAGE-02 | 已验证 |
| FORM-002 | 源颜色下拉仅展示已选生产单下的颜色；更换生产单后源颜色立即重新联动 | `getProductionOrderColorOptions()`、`change` 事件局部重绘 | AUTO-03、AUTO-04 | PAGE-02 | 已验证 |
| FORM-003 | 目标 SPU 使用可输入搜索的下拉列表；目标颜色仅展示该 SPU 下已启用的商品中心颜色 | `getTargetSpuOptions()`、`getTargetColorOptions()`、datalist 精确匹配 | AUTO-03、AUTO-04 | PAGE-02 | 已验证 |

### 3.2 四类业务数量

| 编号 | 验收结果 | 实现位置／符号 | 自动化证据 | 页面证据 | 状态 |
|---|---|---|---|---|---|
| QTY-001 | 已完成销售出库的历史数量保持源 SPU/SKU | `GarmentReplacementQuantitySplit.soldHistoryQty`、`resolveEffectiveGarmentIdentity()` | AUTO-01 | PAGE-03、PAGE-08 | 已验证 |
| QTY-002 | 成衣仓未售成衣按尺码和来源入库批次计算 | `finishedWarehouseQty`、`GarmentWarehouseInventoryBatch` | AUTO-01 | PAGE-06 | 已验证 |
| QTY-003 | 后道工厂未入仓成衣按当前在手数量计算，不重复计入成衣仓库存 | `postFactoryQty`、`POST_FACTORY` 身份阶段 | AUTO-01、AUTO-02 | PAGE-03 | 已验证 |
| QTY-004 | 生产单剩余待回货数量进入 `FUTURE_RETURN` 当前身份 | `remainingReturnQty`、`resolveEffectiveGarmentIdentity()` | AUTO-01、AUTO-02 | PAGE-03、PAGE-08 | 已验证 |
| QTY-005 | 每个尺码及合计均验证四类业务数量之和等于原颜色生产数量，差异时阻断创建 | `sumLine()`、`buildGarmentReplacementPreview()` | AUTO-01 | PAGE-03 | 已验证 |
| QTY-006 | 已完成销售出库历史保留源身份，其余当前及未来未售成衣全部替换；示例合计依次为 1,250、1,150、700、1,900 件，总量 5,000 件 | `resolveEffectiveGarmentIdentity()`、创建快照 | AUTO-01 | PAGE-03、PAGE-08 | 已验证 |

### 3.3 后道与瑕疵迁移

| 编号 | 验收结果 | 实现位置／符号 | 自动化证据 | 页面／打印证据 | 状态 |
|---|---|---|---|---|---|
| POST-001 | 后道工厂未入仓成衣在替换详情可打印目标 SKU 新条码 | `listGarmentPrintRows()`、`GARMENT_SKU_BARCODE_V1` | AUTO-02、AUTO-03、AUTO-04 | PAGE-03、PAGE-04 | 已验证 |
| POST-002 | 后道工厂未入仓成衣在替换详情可打印目标 SKU 新吊牌 | `listGarmentPrintRows()`、`GARMENT_HANGTAG_V1` | AUTO-02、AUTO-03、AUTO-04 | PAGE-03、PAGE-05 | 已验证 |
| POST-003 | 后道换码未完成时，待交出数量被投影为 0；完成后恢复可交出 | `isPostFactoryRelabelPending()`、`listPostFinishingAvailableHandoverLines()` | AUTO-02、AUTO-04 | PAGE-03 | 已验证 |
| POST-004 | 后道换码完成后，当前 SKU 行、待交出对象和后续对象统一读取目标身份 | `completePostFactoryRelabel()`、`projectSkuLineIdentity()` | AUTO-01、AUTO-02、AUTO-04 | PAGE-03 | 已验证 |
| DEFECT-001 | 替换前已有 QC 瑕疵展示为目标 SKU | `projectQcSkuResultIdentity()`、迁移候选和审计 | AUTO-02 | PAGE-01 | 已验证 |
| DEFECT-002 | 替换前已有复检瑕疵展示为目标 SKU | `projectRecheckSkuResultIdentity()`、迁移候选和审计 | AUTO-02 | PAGE-01 | 已验证 |
| DEFECT-003 | 替换后新建 QC／复检瑕疵直接写入目标 SKU | 后道 QC／复检创建路径调用当前有效身份投影 | AUTO-02 | PAGE-01 | 已验证 |
| DEFECT-004 | 瑕疵数量、原因、责任工厂、返工、扣款字段在迁移前后逐字段相等 | `PostFinishingQcSkuResult`、`PostFinishingRecheckSkuResult` 身份投影仅替换身份字段 | AUTO-02 | PAGE-01 | 已验证 |
| DEFECT-005 | 每条迁移记录保留原 SPU/SKU、当前 SPU/SKU、对象 ID、原因、时间 | `GarmentIdentityMigrationAudit`、`appendGarmentIdentityMigrationAudits()` | AUTO-01、AUTO-02 | PAGE-01 | 已验证 |

### 3.4 成衣仓换码

| 编号 | 验收结果 | 实现位置／符号 | 自动化证据 | 页面／打印证据 | 状态 |
|---|---|---|---|---|---|
| WMS-001 | 成衣仓未售成衣数量大于 0 时自动生成一条唯一换码任务，同替换范围重复提交不重复建任务 | `GarmentWarehouseRelabelTask`、`createGarmentSpuReplacement()` | AUTO-01、AUTO-04 | PAGE-06 | 已验证 |
| WMS-002 | 后道和仓储两个入口读取同一替换 store；后道发起的换码任务进入仓库统一任务列表 | `listGarmentSpuReplacements()`、`listGarmentWarehouseRelabelTasks()` | AUTO-03、AUTO-04 | PAGE-03、PAGE-06、PAGE-07 | 已验证 |
| WMS-003 | 每个成衣仓未售成衣来源批次完成一条旧 SKU 替换出库流水 | `completeGarmentWarehouseRelabelTask()`、`OLD_SKU_OUTBOUND` | AUTO-01、AUTO-02、AUTO-04 | PAGE-07 | 已验证 |
| WMS-004 | 每个成衣仓未售成衣来源批次完成一条目标 SKU 替换入库流水 | `completeGarmentWarehouseRelabelTask()`、`NEW_SKU_INBOUND` | AUTO-01、AUTO-02、AUTO-04 | PAGE-07 | 已验证 |
| WMS-005 | 出入库成对流水和换码后批次均保留 `sourceInboundBatchId` | `GarmentWarehouseMovement`、`GarmentWarehouseInventoryBatch` | AUTO-01、AUTO-04 | PAGE-06、PAGE-07 | 已验证 |
| WMS-006 | 换码任务完成前，相关旧 SKU 的销售出库完成动作被阻断；完成后解除 | `getGarmentSalesOutboundGuard()`、`assertGarmentSalesOutboundAllowed()` | AUTO-01、AUTO-02、AUTO-04 | PAGE-06、PAGE-07 | 已验证 |
| WMS-007 | 成衣仓换码任务支持打印新条码并读取目标 SKU | WLS 任务事件、`GARMENT_WAREHOUSE_RELABEL_TASK` 打印来源 | AUTO-02、AUTO-03、AUTO-04 | PAGE-06、PAGE-04 | 已验证 |
| WMS-008 | 成衣仓换码任务支持打印新吊牌并读取目标 SKU | WLS 任务事件、`GARMENT_HANGTAG` | AUTO-02、AUTO-03、AUTO-04 | PAGE-06、PAGE-05 | 已验证 |

### 3.5 回货、生产单与结算

| 编号 | 验收结果 | 实现位置／符号 | 自动化证据 | 页面证据 | 状态 |
|---|---|---|---|---|---|
| RETURN-001 | 第三批、第四批等生产单剩余待回货均使用目标 SKU | `resolveEffectiveGarmentIdentity(...FUTURE_RETURN)`、`createReturnInboundBatchRecord()` | AUTO-01、AUTO-02 | PAGE-08 | 已验证 |
| RETURN-002 | 目标 SKU 先映射为原始 SKU，再沿用原生产单、工厂和冻结价格匹配原分配 | `resolveOriginalSkuForReturnedSku()`、`resolveReturnReceiptAssignment()` | AUTO-02 | 不适用：领域匹配由契约直接验证 | 已验证 |
| RETURN-003 | 回货批次 SKU 行同时记录 `originalSkuCode` 和当前 `skuCode` | `ReturnInboundSkuLine`、`ReturnInboundBatch.skuLines` | AUTO-02 | PAGE-08 | 已验证 |
| PO-001 | 替换前后 `ProductionOrder.demandSnapshot` 深相等，原生产需求未改写 | 生产单只读取 `getProductionOrderGarmentComposition()`，不写 `demandSnapshot` | AUTO-02 | PAGE-08 | 已验证 |
| PO-002 | 生产单关联替换原因、映射、四类业务数量、截图及迁移审计 | `GarmentSpuReplacementRecord`、替换详情 | AUTO-01、AUTO-03、AUTO-04 | PAGE-03 | 已验证 |
| PO-003 | 生产单列表并列显示原 SPU 历史数量和目标 SPU 当前／未来数量 | `getProductionOrderGarmentComposition()`、`orders-domain.ts` 构成块 | AUTO-01、AUTO-03、AUTO-04 | PAGE-08 | 已验证 |
| SETTLE-001 | 换码不写回工厂分配和冻结价格 | 目标回货只做目标→原 SKU 匹配；结算输入保持原分配 | AUTO-01、AUTO-02 | PAGE-08 | 已验证 |
| SETTLE-002 | 专项构造 SPUA 800 + SPUB 200，结算结果与原 1,000 件完全一致 | `scripts/check-garment-spu-replacement.ts` 的 settlementBefore／settlementAfter 深相等断言 | AUTO-01 | 不适用：金额与数量由领域契约验证 | 已验证 |

### 3.6 打印、菜单、截图和简单性

| 编号 | 验收结果 | 实现位置／符号 | 自动化证据 | 页面／打印证据 | 状态 |
|---|---|---|---|---|---|
| PRINT-001 | 生产单列表行操作提供“打印条码” | `orders-domain.ts`、`GARMENT_SKU_BARCODE` | AUTO-02、AUTO-03、AUTO-04 | PAGE-08、PAGE-04 | 已验证 |
| PRINT-002 | 生产单列表行操作提供“打印吊牌” | `orders-domain.ts`、`GARMENT_HANGTAG` | AUTO-02、AUTO-03、AUTO-04 | PAGE-08、PAGE-05 | 已验证 |
| PRINT-003 | 生产单、后道详情、仓库任务两种打印统一使用 `listGarmentPrintRows()` 当前有效身份 | 打印注册表与 `buildGarmentSkuLabelPrintDocument()` | AUTO-02、AUTO-04 | PAGE-04、PAGE-05 | 已验证 |
| PRINT-004 | HG 出货条码和零售条码均复用真实 Code 128 SVG 渲染，不使用 CSS 竖线模拟 | `renderGarmentSkuLabelTemplate()`、`renderRealBarcode()` | AUTO-02、AUTO-04 | PAGE-04、PAGE-05 | 已验证 |
| MENU-001 | 后道工厂管理“成衣 SPU 替换”进入真实页面 | `app-shell-config.ts`、`routes-fcs.ts` | AUTO-03、AUTO-04、AUTO-07 | PAGE-01 | 已验证 |
| MENU-002 | 仓储管理“成衣 SPU 替换”与后道读取同一数据 | `app-shell-config.ts`、`routes.ts` | AUTO-03、AUTO-04、AUTO-07 | PAGE-03、PAGE-06 | 已验证 |
| MENU-003 | 仓储管理“成衣仓换码任务”进入真实任务列表 | `app-shell-config.ts`、`routes.ts` | AUTO-03、AUTO-04、AUTO-07 | PAGE-06、PAGE-07 | 已验证 |
| MENU-004 | 后道“成衣 SPU 替换”、仓储“成衣 SPU 替换”和“成衣仓换码任务”均显示有效 SVG 图标 | `app-shell-config.ts`：`RefreshCw`、`Tags`；`icon-map.ts` | AUTO-03、AUTO-04 | PAGE-01、PAGE-06 | 已验证 |
| DATA-001 | 默认 Mock 同时提供待处理、处理中、已完成三种整色替换及对应仓库任务，且刷新可重复演示 | `createDefaultGarmentSpuReplacementSnapshot()`、`QUANTITY_SPLITS_BY_SCOPE` | AUTO-03、AUTO-04 | PAGE-01、PAGE-07 | 已验证 |
| EVIDENCE-001 | 截图不上传可提交；上传时用 `FileReader` 保存原图数据、文件名、上传人和时间，详情可查看原图 | `createReplacementFromForm()`、`GarmentReplacementEvidence`、`renderEvidenceSection()` | AUTO-01、AUTO-03、AUTO-04 | PAGE-02、PAGE-03 | 已验证 |
| SIMPLE-001 | 未新增审批、回滚、多级替换、通用异常平台、E／R 数量或销售退回；没有新 store／API／领域分层 | surface 排除词扫描与最终 diff 反向审查 | AUTO-03、AUTO-11 | PAGE-01、PAGE-06 | 已验证 |

---

## 4. 17 个关键场景逐项验收

| 场景 | 操作与预期 | 证据 | 结果 |
|---|---|---|---|
| 1. 多批回货的四类数量 | 第一批当时未发现但当前仍未售的成衣继续换码；已完成销售出库历史保留；其余当前和未来未售成衣全换 | AUTO-01；PAGE-03 | 通过 |
| 2. 原 SPU 800 + 目标 SPU 200 | 原需求仍为 1,000；实际构成可混合；结算仍为原 1,000 | AUTO-01、AUTO-02；PAGE-08 | 通过 |
| 3. 目标颜色缺尺码 | 实际需要替换的尺码缺少唯一目标 SKU 时阻断，且无副作用 | AUTO-01 | 通过 |
| 4. 目标颜色同尺码重复 SKU | 唯一性不成立时阻断；页面无现场输入新 SKU 入口 | AUTO-01、AUTO-03 | 通过 |
| 5. 已生成未交出 | 归后道工厂未入仓成衣；换码前不可交，换码后目标 SKU 可交 | AUTO-02、AUTO-04；PAGE-03 | 通过 |
| 6. 已交出未接收 | 仍归后道工厂未入仓成衣；当前身份迁移到目标 SKU，不额外形成成衣仓库存 | AUTO-02 | 通过 |
| 7. 已入成衣仓未销售 | 归成衣仓未售成衣；旧出新入、双打印、来源批次保持 | AUTO-01、AUTO-02、AUTO-04；PAGE-06、PAGE-07 | 通过 |
| 8. 销售出库未完成 | 仍归成衣仓未售成衣；旧 SKU 销售出库完成被阻断 | AUTO-01、AUTO-02；PAGE-06 | 通过 |
| 9. 销售出库已完成 | 保留为历史数量；不换码、不生成仓库任务，历史仍是源 SKU | AUTO-01；PAGE-03 | 通过 |
| 10. 既有与新增瑕疵 | QC、复检及后续瑕疵归目标 SKU，业务字段不变、原身份可查 | AUTO-02、AUTO-04；PAGE-03 | 通过 |
| 11. 生产单列表打印 | 同一行同时有条码和吊牌；替换色使用目标 SKU | AUTO-02、AUTO-03、AUTO-04；PAGE-04、PAGE-05、PAGE-08 | 通过 |
| 12. 后道／仓储双入口 | 两处读取同一替换记录；同一替换只生成一个仓库任务 | AUTO-01、AUTO-03、AUTO-04；PAGE-03、PAGE-06、PAGE-07 | 通过 |
| 13. 可选截图 | 无截图提交成功；上传后展示缩略图、上传信息和原图 | AUTO-01、AUTO-03、AUTO-04；PAGE-02、PAGE-03 | 通过 |
| 14. 重复点击与幂等 | 同范围记录、任务、瑕疵迁移和仓库流水均不重复 | AUTO-01、AUTO-02 | 通过 |
| 15. 搜索与颜色联动 | 生产单和目标 SPU 可输入搜索；源颜色和目标颜色只能从各自上级对象选择 | AUTO-03、AUTO-04；PAGE-02 | 通过 |
| 16. 菜单图标 | 三个业务菜单均渲染有效 SVG 图标，不再出现空图标位 | AUTO-03、AUTO-04；PAGE-01、PAGE-06 | 通过 |
| 17. 默认 Mock | 待处理、处理中、已完成三种状态均有可辨识业务记录和仓库任务 | AUTO-03、AUTO-04；PAGE-01、PAGE-07 | 通过 |

---

## 5. 第一遍核验：正向追踪

核验方法：从方案章节和 50 个需求编号出发，逐项走到工作包、实现文件／符号、专项自动化和页面／打印证据。

| 正向核验域 | 核验结果 | 直接证据 |
|---|---|---|
| 范围与唯一性 | 生产单 + 源颜色唯一；整色覆盖全部当前及未来未售成衣；无现场创建 | SCOPE-001～002、MASTER-001～003；AUTO-01、03 |
| 发起表单 | 生产单与目标 SPU 可搜索，源／目标颜色按上级选择联动 | FORM-001～003；AUTO-03、04；PAGE-02 |
| 数量 | 四类业务数量按尺码及总量守恒；当前及未来未售成衣全部替换 | QTY-001～006；AUTO-01、04；PAGE-03 |
| 后道 | 后道工厂未入仓成衣换码、双打印、交出门禁、完成后当前身份 | POST-001～004；AUTO-02、04；PAGE-03～05 |
| 瑕疵 | QC／复检既有与新增迁移、质量／扣款不变、原身份审计 | DEFECT-001～005；AUTO-02、04；PAGE-03 |
| 仓储 | 唯一任务、旧出新入、来源批次、销售阻断、双打印 | WMS-001～008；AUTO-01、02、04；PAGE-06、07 |
| 回货 | 生产单剩余待回货使用目标 SKU，原分配匹配，批次双身份 | RETURN-001～003；AUTO-02 |
| 生产与结算 | 原需求不改、实际混合构成、800+200 结算不变 | PO-001～003、SETTLE-001～002；AUTO-01、02、04；PAGE-08 |
| 页面与证据 | 三个菜单／路由及图标、三类 Mock、生产单双打印、截图可选与原图 | PRINT-001～004、MENU-001～004、DATA-001、EVIDENCE-001；AUTO-03、04；PAGE-01～08 |
| 范围收口 | 无 E/R、销售退回、审批、回滚、多级链或通用异常平台 | SIMPLE-001；AUTO-03、11 |

正向追踪结论：50/50 条需求均可从方案回到实现和至少一组直接证据，没有无证据条目。

---

## 6. 第二遍核验：反向追踪

核验方法：从最终代码、菜单、路由、Mock、事件、打印模板和测试反向追到需求编号，检查遗漏、越界和“只改展示未改事实”的情况。

| 反向检查对象 | 反查问题 | 结果 |
|---|---|---|
| 核心 store | 是否覆盖范围、防重、四类业务数量、双身份、批次、任务、流水、打印和审计 | 全部可回到 SCOPE、QTY、WMS、PRINT、EVIDENCE；通过 |
| 发起表单 | 是否仍为自由文本，或颜色能够脱离所选生产单／目标 SPU 随意输入 | 两个可搜索下拉与两个联动颜色下拉均有精确匹配门禁；通过 |
| 后道领域 | 是否遗漏 QC、复检、待交出、后续新增对象，或只改 SPU 未改 SKU | 当前投影同时更新 SPU/SKU 并保留 original；通过 |
| 回货领域 | 目标 SKU 是否失去原工厂分配，批次是否无法表达混合 SKU | 目标→原 SKU 匹配与回货 SKU 双身份均已接通；通过 |
| 生产单 | 是否覆盖原需求、实际构成、条码和吊牌两个动作 | 四项均存在；通过 |
| 仓储 | 是否只有后道入口、没有统一任务，或只有入库没有出库 | WLS 两个页面和成对流水均存在；通过 |
| 打印注册表 | 是否只加条码漏吊牌，是否任一来源仍读源 SKU | 两个 documentType、两个 sourceType、统一当前身份；通过 |
| 菜单与路由 | 是否出现空图标、占位页、菜单无路由或事件未分发 | 三个菜单均有有效 SVG 图标，命名路由均进入真实页面并有事件入口；通过 |
| Mock 数据 | 是否只有空列表或单一状态，无法演示真实流程 | 待处理、处理中、已完成三类记录及仓库任务均可见；通过 |
| 图片与截图 | 是否只有文件名没有原图、图片层是否无法独立关闭 | 原图数据、缩略图、大图和 `Esc` 层级关闭均通过 |
| 额外门禁 | 是否误加目标图片、条码、洗涤、执行标准、安全类别校验 | 未引入；通过 |
| 非范围 | 是否引入 E/R、退货、审批、回滚、多级替换或通用异常平台 | surface 与 diff 反查无命中；通过 |

反向追踪结论：最终变更均能回到本清单需求编号，未发现孤立业务能力或未确认扩展；条码与吊牌两条链路均未遗漏。

---

## 7. 回归范围说明

本次验收覆盖成衣 SPU/SKU 整色替换的核心契约、跨模块契约、反向表面审查、20 步真实浏览器全流程、生产构建、菜单路由、标准列表和原型治理。未运行与本业务无关的全部历史 Playwright 套件，也没有为制造全仓绿灯而修改无关模块或旧测试期待。

因此本清单结论严格限定为：**成衣 SPU/SKU 整色替换本次范围已完成两遍验证；不据此宣称整个仓库所有历史业务回归均已执行。**

---

## 8. 原型边界与未执行项

- 当前实现使用本地内存／`localStorage` Mock 事实，不是生产数据库事务、真实库存服务或销售出库服务。
- 已验证真实 Code 128 SVG、条码值、打印 DOM 和浏览器预览；未连接实体扫码枪逐张实扫，也未在实体热敏／吊牌打印机上出纸。
- 已在当前分支同一工作树完成页面验收；未部署到线上，也没有 GitHub 远端交付回执。
- 没有运行完整任务收据：验证期间工作区存在其他任务的并行改动，无法让收据只绑定本任务差异。所有本次命令、矩阵、截图和结论均按明确的成衣替换文件边界记录，未修改、暂存或吸收无关差异。

---

## 9. 最终签收状态

| 项目 | 状态 |
|---|---|
| 方案范围实现 | 已实现 |
| 50 条原子需求 | 50/50 已验证 |
| 17 个关键场景 | 17/17 通过 |
| 第一遍正向核验 | 通过 |
| 第二遍反向核验 | 通过 |
| 当前分支本地状态 | verified |
| 远端提交／部署 | 未执行，不能声明 delivered |
| 产品确认人 | 待用户确认 |
| 产品确认版本 | 当前工作树，尚未提交 |
