# 裁床仓库层级库位任务 10 最终审计

## 1. 审计边界与结论状态

本审计逐条核对以下对象，不以构建成功替代业务核查：

- 已确认设计：`docs/superpowers/specs/2026-08-01-cutting-warehouse-location-layer-coding-design.md` 第 3–14 节。
- 实施计划：`docs/superpowers/plans/2026-08-01-cutting-warehouse-location-layer-coding-implementation.md` 任务 1–10。
- 任务 1–9 的全部提交、代码、Mock、专项脚本、Playwright 和两份原型审查记录。
- PFOS Web、PDA、运行时事件账、布局本地快照、依赖安全与工作流治理。

当前状态：任务 10 实施产物和本地门禁已闭环，等待独立规格审查、独立代码质量审查和最后一次机器收据；在双审与收据完成前仍只表述为 `implemented`，不得表述为 `verified`。

## 2. 决策口径校正

审计发现设计第 5 节和计划任务 2 仍保留早期 `01–99` 固定范围，而任务 6 后续已按用户“不设置固定上限”的明确决策，实现并审查了动态资源预算、分批生成、分页预览和取消。最终口径如下：

1. 货架序号、层号、层内位置号是有限正整数，不设置固定业务上限。
2. 编号中的 `R`、`L`、`P` 数字至少补足两位；超过两位保留完整十进制数。
3. 设备能力不是业务上限。批量生成按浏览器实时存储与可用堆做动态预检，资源不足时保留表单并建议拆分货架或减少单次生成。
4. “结构序号无固定业务上限”与“单次多选库位数量无固定上限”是两项独立规则，分别由维护检查和选择模型检查覆盖。

已增加文档一致性门禁，防止规格和计划再次回退到固定 `99`。首次 fresh 验证同时发现
`check:factory-internal-warehouse-model` 仍把 `100` 当作非法结构序号；已先保留失败证据，再把该陈旧断言改为
`R100/L101/P102` 正例，并继续拒绝零、负数、小数和无穷值。生产编号函数无需修改。

## 3. 规格—实现—证据终审矩阵

| 规格条款 | 实现事实 | 自动检查／浏览器证据 | 结论 |
| --- | --- | --- | --- |
| 第 3、4 节：仓库—库区—货架—库位；层由库位字段分组 | `FactoryWarehouseArea`、`FactoryWarehouseShelf`、`FactoryWarehouseLocation` 增加兼容字段；`WarehouseLocationMapShelf.levels` 直接消费分层结果，无独立层主数据 | `check:factory-internal-warehouse-model`；`check:cutting-warehouse-location-map`；源码无 flat `WarehouseLocationMapShelf.locations` 兼容 getter | 已覆盖 |
| 第 3、5 节：A/B/C 库区编码与完整编号 | `buildCuttingWarehouseLocationNo()` 校验单个大写字母和有限正整数，使用 `padStart(2)` 形成至少两位编码；编号变化不改变稳定 ID | 编号纯函数、唯一性、R100/L100/P100、稳定 ID 和编号重算断言；文档一致性门禁 | 已覆盖 |
| 第 6 节：Mock 直接重写、双仓隔离 | `buildCuttingWarehouseAreaList('WAIT_PROCESS' | 'WAIT_HANDOVER')` 生成稳定且不同前缀的库区、货架、层位；中央裁床才切换专属 Mock | 两仓多区、多架、一层一位／多位、不同层数量、ID 不交叉断言 | 已覆盖 |
| 第 6、7 节：空闲／占用和真实占用对象 | `buildWarehouseLocationMapProjection()` 只投影 `EMPTY/OCCUPIED`；库区、货架、库位启停只参与可选性；占用抽屉按物料／袋／菲票显示 | 共享地图 HTML 断言、占用详情局部 handler、Task 9 真实 WAIT_PROCESS 占用抽屉 | 已覆盖 |
| 第 7 节：L 高层在上、P 从左到右、完整编号常显 | 投影按 `levelNo` 降序、`positionNo` 升序；共享组件每格输出位置、中文状态、完整编号 | 专项 HTML 顺序断言；1366×768 真实页面验收 | 已覆盖 |
| 第 7、13 节：宽货架内部滚动、页面无横溢 | `renderWarehouseLocationMap()` 使用货架有界视窗和内部横滚；层 8 行、位置 12 列分页，不一次铺满不可见 DOM | 1280×720、1366×768、1024×768、390×844 适配用例；大投影视窗末页可达 | 已覆盖 |
| 第 8.1 节：单一维护入口、新增空库区 | `renderCuttingWarehouseLocationMapSection()` 查看态仅渲染“维护库位图”；`createWarehouseArea()` 保存空 `shelfList` | 查看／维护 HTML 门禁；真实页面新增库区 E2E | 已覆盖 |
| 第 8.2、8.3 节：新增货架、批量生成、逐层不同数量 | `renderCreateShelfDialog()`、`renderLevelPositionEditor()`、`renderLocationNumberChangePreview()`；`createWarehouseShelfInBatches()`；`adjustWarehouseLevelPositionCount()` | 完整预览、分页、分批、取消、资源预检、从右端增减、占用阻断专项与浏览器用例 | 已覆盖 |
| 第 8.4、8.5 节：正式编辑、启停、撤销和占用保护 | `updateWarehouseArea()`、`updateWarehouseShelf()`、`updateWarehouseLocation()`、`setWarehouseLocationEnabled()`、`revokeNewWarehouseNode()`；全部使用 `renderFormDialog()` | 原编号→新编号、重复、断层、稳定 ID、占用只许备注、未使用新节点才可撤销断言 | 已覆盖 |
| 第 9 节：不相邻、不连续、跨区／架／层、任意取消、无选位上限 | `validateWarehouseLocationSelection()` 只校验存在、当前仓、节点启用、当前空闲；`toggleWarehouseLocationSelection()` 保持点击顺序并允许任意取消 | 超过 10 个库位选择、跨区／架／层、非连续、任意取消、无 `selectionLimit` 断言；Web/PDA 浏览器用例 | 已覆盖 |
| 第 9、10 节：提交前最新投影原子复核 | Web/PDA 提交前调用 `revalidateWarehouseLocationSelection()`；任一冲突整组失败并保留其余仍可用选择 | WAIT_PROCESS 并发占用真实 handler E2E；Web、PDA 专项冲突编号断言 | 已覆盖 |
| 第 9 节：多格占用、业务数量只汇总一次 | `WarehouseStorageFootprint` 和待交出占用状态按稳定 footprint／袋／菲票去重；每个位置仍单独投影 | 同对象占 3 格仍只累计一次；不同单位不相加；WAIT_HANDOVER 袋／票／数量断言 | 已覆盖 |
| 第 10 节：当前仓库和三层启停防错 | `classifyWarehouseLocationSelectability()` 同时校验 factory、warehouse、kind、area/shelf/location status 和业务占用 | 缺失、跨仓、库区停用、货架停用、库位停用、占用扫码中文阻断专项 | 已覆盖 |
| 第 11 节：Web 可维护、PDA 只执行 | PFOS 页面提供维护；PDA 页面只有扫码、点选、取消、清空、确认，不渲染维护入口 | 页面源码门禁、PDA E2E 和两份原型审查记录 | 已覆盖 |
| 第 11 节：PDA 动作优先与多批次防错 | PDA 使用 `selectedLocationIds` 和完整 `warehouseLocations`；多个待加工入仓批次必须显式选择“本次领料批次”，单批次自动绑定 | `check:pda-cutting-inbound-workflow`、真实 render/handler 浏览器用例 | 已覆盖 |
| 第 7、9、11 节：Web/PDA 写入完整稳定引用 | WAIT_PROCESS、WAIT_HANDOVER、特殊工艺回仓新动作统一写 `warehouseLocations`；历史单值只读兼容，不双写 | 新事件无 `locationRef` 双写门禁；Web/PDA/特殊工艺专项 | 已覆盖 |
| 第 9、11 节：全部位置释放与运行周期隔离 | WAIT_PROCESS 以 `pickupSessionId/sourceInboundEventIds` 绑定入仓事实；WAIT_HANDOVER 以 `usageCycleId/sourceUsageCycleId` 和精确菲票集合迁移／释放 | 加工领料、整袋交出、特殊工艺、同袋同票 C1/C2 浏览器及专项断言 | 已覆盖 |
| 第 10、13 节：局部刷新和 200 ms | 地图点击、占用抽屉、摘要、维护保存局部替换；保留页面壳和滚动；图标只 hydrate 新节点 | 弹窗／预览／首次保存反馈／首次选位低于 200 ms；滚动与 DOM 身份 E2E | 已覆盖 |
| 第 12 节：v3 完整快照、旧缓存直接失效 | `FactoryWarehouseLayoutSnapshot.schemaVersion = 3`；非 v3 不迁移，恢复当前 Mock；保留版本冲突与变更历史 | v1/v2/损坏缓存、只读存储、原子布局+历史写入、失败回滚断言 | 已覆盖 |
| 第 12.2、13.5 节：依赖安全 | Vite/PostCSS/tsx 在当前主版本安全升级；esbuild/picomatch 由依赖树安全解析；未使用强制修复或忽略 | `npm audit --audit-level=low` 为 0 项漏洞；依赖树检查和生产构建退出码均为 0 | 已覆盖 |
| 第 13.4 节：双分辨率与真实浏览器 | Task 9 套件使用隔离端口、`workers=1`，真实路由视觉与真实 handler 行为分开陈述；Task 10 对 PDA 差异输入做局部反馈修复，并修正生产单总览事实详情路由 | Task 10 fresh 运行库位图专项 19/19、裁床全量 107/107，退出码均为 0 | 已覆盖 |
| 第 14 节：范围和治理 | 改动限于依赖、裁床库位层、相关 Web/PDA、专项、浏览器和审查记录；未改路由总结构、列表公共基线或真实后端 | 原型设计治理、列表页治理、CodeGraph 和 `git diff --check` 均通过 | 已覆盖 |

## 4. 任务 1–9 提交与产物核查

| 任务 | 提交范围 | 逐项结论 |
| --- | --- | --- |
| 1 依赖安全 | `43d52e73` | 直接依赖在当前主版本升级，锁文件解析消除四项漏洞；未发现 Vite 7、强制修复或忽略规则。 |
| 2 层级结构与 Mock | `d5bd998f` | 共享类型仅兼容扩展；中央裁床双仓使用专属 Mock；其他工厂仓库未被强制迁移。 |
| 3 v3 布局动作 | `74a1ff6d` 至 `8d436b9e` | 完整快照、不可变动作、占用保护、只读存储、历史原子性和旧缓存失效均有专项证据。 |
| 4 分层投影与自由多选 | `d44a929c` 至 `e2d41e4e` | 删除 flat/未编排/连续范围事实；只保留当前仓库空闲可用校验，汇总去重。 |
| 5 共享分层矩阵 | `41b86e9f` 至 `9d7fd7d4` | 共享 Web/PDA 消费 `levels`；占用详情包含停用占用格；轻交互走局部事件链。 |
| 6 PFOS 维护 | `9d49ee09` 至 `48ace7be` | 单一入口、正式表单、逐层预览、编辑启停、动态资源预算、分页、取消隔离和视窗闭环。 |
| 7 Web 写回 | `7df873b7` 至 `cf740b16` | 双仓多库位数组、原子冲突、footprint 去重、整组释放、特殊工艺范围隔离和历史碎片恢复。 |
| 8 PDA 写回 | `21fe4956` 至 `1021b57e` | PDA 多选／扫码／取消、三层启停、完整稳定引用、领料批次绑定和会话级扣减闭环。 |
| 9 浏览器验收 | `d1c337d9` 至 `810ceb23` | 真实 WAIT_PROCESS、WAIT_HANDOVER、PDA、双分辨率、性能、滚动、使用周期和真实 handler 收口；记录为 19/19。 |

## 5. 字面残留与边界核查

- 正式共享地图 API 不含 `selectionLimit`，页面不展示相邻、连续或起止范围规则。
- `locationRef`／`locationRefs` 仅存在于历史运行事实读取、旧夹具或内部逐格投影状态；新 Web/PDA 入仓和回仓动作只写 `warehouseLocations`。
- 旧 `areaOrder`、`shelfOrder`、`locationOrder`、`unassigned`、`overrides`、`addedAreaList`、`addedLocationListByShelfId` 不属于 v3 正式布局结构。
- PFOS 查看态仅有一个“维护库位图”；PDA 无新增、编辑、停用入口。
- 页面只展示中文“空闲／占用”；启用／停用只作为维护可用性与不可选原因。
- 待加工仓与待交出仓使用不同 warehouse kind、warehouse ID、稳定库位 ID、布局 key、运行占用和释放范围。
- 没有新增路由；现有 Web 页签和 PDA 仓库入口继续承接同一业务对象。

### 5.1 全量裁床回归发现与修复

- 唛架、铺布、菲票、PDA 任务详情和生产进度的部分旧 E2E 仍断言已下线的按钮、页签或 CSS 结构。逐项对照当前 canonical 路由、页面真实可达入口和当前业务对象后，已把测试契约更新为真实点击与业务结果断言，没有为通过旧测试恢复已下线 UI。
- PDA 领料差异照片与数量／备注输入存在异步整页重绘竞争，文件控件会脱离 DOM，导致照片名偶发丢失。修复后这些高频输入跳过整页重绘，照片名只在当前领料节点局部更新；完整领料节点 E2E fresh 复跑 7/7 通过，照片选择反馈为 133.1 ms。
- 生产单总览的款式图片可能落到占位 SVG。投影现在只选择非占位图片候选，无有效候选时使用仓库既有样衣图，并在图片加载失败时使用同一兜底图。
- 生产单状态入口原以 `overview row id === productionOrderId` 推断是否具有裁床详情，导致真实裁床事实可能错误回到生产单台账，或无裁床事实进入“未找到详情”。现改为查询裁床进度投影：存在真实详情行时进入该行对应的 8 页签详情；不存在时明确回到生产单台账，不补假 Mock。
- 源码仍保留旧铺布弹窗和旧生产进度抽屉的不可达渲染函数，属于后续可清理的技术债；本任务不恢复旧入口，也不在最终验收中把不可达模板当作业务覆盖。

## 6. 工作流治理适配

桌面 Codex 的真实 provider session 将工具调用记录为：

- `response_item/custom_tool_call`，名称为 `exec`；
- 输入是精确 `tools.exec_command(...)` JavaScript 包装；
- 结果是同一 `call_id` 的 `custom_tool_call_output`，成功头为 `Script completed`。

旧校验器只接受 `function_call/exec_command`，会错误拒绝真实技能读取。任务 10 以红—绿测试增加最小兼容：

1. session 仍必须位于受信任 provider 根。
2. 只接受精确 `const r = await tools.exec_command({...}); text(r.output);` 包装。
3. 参数对象只允许 JSON 字面量和值域白名单，不执行或求值任意 JavaScript。
4. 必须匹配成功输出、同一 `call_id`、受信任 SKILL.md 根、技能目录名和精确 `sed`／`wc` 读取命令。
5. 回显命令、失败输出、错误 `call_id`、任意文本或仅在请求中出现技能名仍被拒绝。

本次真实技能证据引用受信任 session 中实际读取 `subagent-driven-development/SKILL.md` 的事件，不复制对话或隐藏推理。

## 7. 最终验证清单

最后一次源代码和测试实质修改后已 fresh 运行并记录退出码：

- `npm audit --audit-level=low`
- `npm ls vite postcss tsx esbuild picomatch --all`
- `npm run build`
- `npm run check:factory-internal-warehouse-model`
- `npm run check:cutting-warehouse-location-map`
- `npm run check:cutting:all`
- `npm run test:cutting:all:e2e`
- `npm run check:prototype-design-governance -- --all`
- `npm run check:list-page-governance`
- `node --experimental-strip-types --test tests/workflow-governance/stage-trace.test.ts`
- `git diff --check`
- `codegraph sync && codegraph status`

执行结果：上述命令退出码均为 0；`npm audit` 报告 0 项漏洞；库位图专项为 19/19，裁床全量为 107/107；原型设计治理覆盖 6 个受管文件和 1 份完整审查记录；列表页治理扫描 330 个页面并通过 Chromium 列拖拽检查；工作流阶段轨迹测试为 11/11；CodeGraph 索引为最新。生产构建仅保留仓库既有的 chunk size 和 Browserslist 提示，不影响退出码。

库位图专项完整 E2E 的正式口径为 `cutting-warehouse-location-map.spec.ts` 18 项，加 `cutting-wait-handover-web-modal.spec.ts` 1 项，共 19 项；本次 19/19 是任务 10 在生产代码和 Playwright 增强后的 fresh 结果，不沿用任务 9 的历史证据。

## 8. 交付状态边界

- `implemented`：任务 10 产物或修复已存在，但独立双审或最终验证未闭环。
- `verified`：当前提交、工作区指纹、两阶段审查、检查结果和 CodeGraph 均由最终 `workflow:verify` 收据确认。
- 本地任务 10 不执行 main 合并和推送，不能宣称 `delivered` 或 `accepted`。
