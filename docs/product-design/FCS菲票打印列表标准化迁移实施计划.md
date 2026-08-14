# FCS 菲票打印列表标准化迁移实施计划

## 1. 目标与完成条件

在不改变任何菲票业务逻辑的前提下，将部位菲票打印列表和捆条菲票打印列表迁移到统一列表骨架、标准表格、标准分页和共享列表控制器。完成条件以《FCS 菲票打印列表标准化迁移需求追踪与交付矩阵》全部适用需求达到“已验证”为准，并要求全仓裁剪检查与任务收据不再被本次纳入范围的四项缺口阻塞。

## 2. 执行基线

- 工作区：`/Users/laoer/Documents/higoods`
- 分支：`main`
- 开工 HEAD：`1decb915f0edcf6c87dc08da2f04c244f31d4a36`
- 路由：`/fcs/craft/cutting/fei-tickets`、`/fcs/craft/cutting/binding-fei-tickets`
- 设备：桌面管理／主管端，1366×768，最低 1280×720
- 运行服务：当前工作区 Vite，验收使用独立测试端口，避免复用陈旧服务

## 3. 工作包

### WP-1 需求与失败契约

- 业务目标：把全部范围、非范围、业务保护项和可观察结果拆成原子需求。
- 文件：总体设计、实施计划、需求追踪矩阵、`tests/cutting-fei-ticket-standard-lists.spec.ts`。
- 修改：建立双向追踪；先编写标准骨架、分页、列设置、偏好隔离和业务回归失败断言。
- 验证证据：专项测试在实现前因缺少标准列表契约而失败。
- 完成条件：所有原子需求有稳定编号和至少一项预期证据。

### WP-2 部位菲票标准列表

- 业务目标：部位菲票仍按铺布单／手动批次展示，但接入标准列表能力。
- 文件／符号：`src/pages/process-factory/cutting/fei-tickets.ts`；列表状态、部位列定义、`renderListPage`。
- 修改：增加页面模式声明、标准列表 imports、部位列表状态和控制器；将原手写表格单元格等价迁移为七个标准列。
- 验证证据：字段、行数、筛选、状态、全部打印和菲票明细地址与迁移前一致。
- 完成条件：部位路由具备骨架、表格、分页、排序、冻结、列设置和偏好保存。

### WP-3 捆条菲票标准列表

- 业务目标：捆条菲票仍按捆条加工单展示，一个宽度对应一张票。
- 文件／符号：同一页面文件；捆条列定义、捆条列表状态和控制器。
- 修改：将原手写表格单元格等价迁移为八个标准列；由 `renderBindingMaterialCell` 保留既有 `materialImageUrl` 与物料身份，并补齐缩略图、大图、关闭和失败态交互。
- 验证证据：物料／纸样、捆条明细、应打／已打／缺口、打印状态和操作地址一致。
- 完成条件：捆条路由具备完整标准列表能力且偏好与部位路由隔离。

### WP-4 局部交互与路由状态

- 业务目标：列表轻交互在 200ms 内反馈，不整页重绘。
- 文件／符号：列表局部刷新函数、`handleCraftCuttingFeiTicketsEvent`。
- 修改：分页、排序、列设置、筛选和清空筛选只刷新表格、分页、统计或列设置层；手动建票、打印和详情仍走原事件分支。
- 验证证据：DOM 根节点和表格区外壳保持稳定；输入焦点、横向滚动位置和菜单保持。
- 完成条件：两个路由的全部列表轻交互满足局部更新门禁。

### WP-5 治理与历史基线收口

- 业务目标：该页面不再依赖历史未迁移豁免。
- 文件：`scripts/standard-list-page-baseline.json`、完整原型审查记录。
- 修改：只删除 `fei-tickets.ts` 对应基线项；不修改检查脚本或其它哈希。
- 验证证据：列表治理和原型治理通过。
- 完成条件：页面声明 `@page-pattern: list` 且公共契约检查通过。

### WP-6 验收与交付证据

- 业务目标：证明列表迁移未改变菲票业务。
- 文件：专项测试、追踪矩阵、原型审查记录、任务收据。
- 修改：回填实际实现位置、自动化结果、页面／图片／打印证据和最终状态。
- 验证证据：专项测试、既有菲票与捆条回归、构建、治理、CodeGraph、1366×768、1280×720、打印预览截图。
- 完成条件：矩阵不存在待实施、实施中、已实现待验证或已阻塞条目，任务收据达到 `verified`。

### WP-7 对象对应真实物料图

- 业务目标：解除 IMAGE-001，两个菲票列表读取的全部物料均为对象对应实拍图、效果图或正式物料图。
- 文件／符号：`public/materials/fei-ticket/`、`resolveProductionMaterialImageUrl`、`enrichBomItemsWithMaterialAssets`、`resolveMaterialImageUrl`。
- 修改：为黑／炭灰斜纹、黑／炭灰／藏青／卡其拼接、灰、本白、藏青、雾霾灰卫衣绒、红色裙装、蓝白印花和卡其帆布补齐正式面料效果图；按物料 SKU／名称／颜色建立显式映射，并在技术包快照和裁片单物料身份处优先解析当前对象的正式素材。未知颜色保持缺图门禁，不用其它颜色素材冒充；裁单稳定 ID、菲票生成数量和既有聚合规则不变。
- 验证证据：全部捆条行 URL 均为仓库内存在的 PNG/JPG，均非 `data:image/svg+xml`；缩略图、大图、失败态、关闭和低分辨率复验通过。
- 完成条件：IMAGE-001 标记已验证且审查记录列出素材来源和对象对应关系。

### WP-8 特殊工艺缺工厂交出门禁场景

- 业务目标：现有“承接工厂待补充不得正式交出”规则在当前 Mock 数据中可观察并可回归。
- 文件／符号：`src/data/pcs-technical-data-version-bootstrap.ts` 的部位特殊工艺种子、`listSpecialCraftHandoverCandidates` 既有投影。
- 修改：增加一个未配置专用承接工厂的稳定特殊工艺部位样本；不修改承接工厂识别和交出门禁算法。
- 验证证据：候选集中同时存在可交出项和含“承接工厂待补充”原因的不可交出项；`check:cutting-clean-mainline` 通过。
- 完成条件：HANDOVER-001 已验证且可交出场景未被破坏。

### WP-9 PDA 菲票打编号入口

- 业务目标：PDA 待交出仓能直接进入现有菲票打编号页面。
- 文件／符号：`src/pages/pda-cutting-wait-handover-actions.ts`。
- 修改：扩展动作 key 联合类型并增加 `fei-ticket-numbering` 动作卡，路由指向既有 `/fcs/pda/cutting/fei-ticket-numbering`。
- 验证证据：编号专项检查、PDA 待交出仓入口点击和目标页扫描区验证通过。
- 完成条件：PDA-001 已验证，装袋编号门禁和捆条免打编号规则不变。

### WP-10 稳定首次打印样本

- 业务目标：首次打印路由始终有一个未打印可打印单元用于回归，且不影响已打印／需补打样本。
- 文件／符号：`buildCompletedSpreadingSeedStore`、`buildSystemSeedFeiTicketLedger`、`ensureTraceabilityTicketRecords`。
- 修改：补入一个裁剪已完成、显式标记“待打印菲票”的稳定铺布样本；打印种子分别保留完整首打、需补打和无打印记录对象；兼容追踪补数只跳过该显式待打印样本，避免把它反向伪造成已打印。`derivePrintableUnitStatus`、首次打印处理和打印模板不修改。
- 验证证据：投影同时包含 `WAITING_PRINT`、`PRINTED`、`NEED_REPRINT`，首次打印 Playwright 用例通过。
- 完成条件：PRINT-001 已验证，既有打印和补打回归通过。

## 4. 依赖顺序

`WP-1 → WP-2 / WP-3 → WP-4 → WP-5 → WP-7 / WP-8 / WP-9 / WP-10 → WP-6`

部位和捆条列定义可在同一页面内独立实现，但共用的局部刷新和事件入口必须在两者列定义完成后统一接入。

## 5. 预计变更文件

- `src/pages/process-factory/cutting/fei-tickets.ts`
- `src/pages/pda-cutting-wait-handover-actions.ts`
- `src/pages/process-factory/cutting/fei-tickets-model.ts`
- `src/pages/process-factory/cutting/traceability-projection-helpers.ts`
- `src/data/fcs/cutting/generated-cut-orders.ts`
- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/production-material-image-assets.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `public/materials/fei-ticket/*.png`、`public/materials/fei-ticket/sources.json`
- `scripts/check-cutting-wait-handover-transfer-bag-flow.ts`
- `scripts/check-cutting-warehouse-management-switch.ts`
- `scripts/check-factory-mobile-app-redesign.ts`
- `scripts/check-pda-cutting-wait-handover-entry-routing.ts`
- `scripts/standard-list-page-baseline.json`
- `package.json`
- `tests/cutting-fei-ticket-manual-paper-routing.spec.ts`
- `tests/cutting-fei-ticket-print-route.spec.ts`
- `tests/cutting-fei-ticket-standard-lists.spec.ts`
- `docs/product-design/裁床待交出仓与中转袋全流程产品需求说明文档.md`
- `docs/product-design/FCS菲票打印列表标准化迁移总体设计.md`
- `docs/product-design/FCS菲票打印列表标准化迁移实施计划.md`
- `docs/product-design/FCS菲票打印列表标准化迁移需求追踪与交付矩阵.md`
- `docs/prototype-review-records/2026-08-12-fcs-fei-ticket-standard-lists.md`

除非发现已确认的公共组件缺陷，否则不修改 `src/components/ui/`。不修改 `src/router/`、`src/main-handlers/`、打印模板、菲票状态推导、纸张分流、生成数量或交出门禁算法；数据和兼容追踪文件只修改 WP-7、WP-8、WP-10 声明的对象素材、稳定样本及与显式待打印事实冲突的自动补数行为。

## 6. 验证命令与页面证据

- 新增 `npm run check:cutting-fei-ticket-standard-lists`。
- 运行 `npm run check:cutting-fei-ticket-assembly`。
- 运行 `npm run check:cutting-fei-ticket-paper-routing`。
- 运行 `npm run check:cutting-binding-strip-flow`。
- 运行 `npm run check:cutting-fei-ticket-numbering`。
- 运行 `npx playwright test tests/cutting-fei-ticket-print-route.spec.ts --workers=1`。
- 运行 `npm run check:cutting-clean-mainline` 和 `npm run check:cutting:all`。
- 运行 `npm run check:list-page-governance`。
- 运行 `npm run check:prototype-design-governance -- --all`。
- 运行 `npm run build` 和 `git diff --check`。
- 修改完成后执行 CodeGraph 同步和状态检查。
- 在独立 Vite 端口以 1366×768 和 1280×720验收两个命名路由。
- 保存部位列表、捆条列表、列设置、捆条物料大图和普通／特殊工艺打印预览证据。
- 在所有最终修改后重新运行受影响验证并生成任务收据。

## 7. 风险与控制

| 风险 | 控制措施 |
| --- | --- |
| 标准排序覆盖原有默认顺序 | `sort = null` 时直接使用现有过滤函数返回顺序 |
| 两个路由共享状态导致偏好串页 | 两套独立 controller、state、event prefix 和 preference key |
| 局部刷新吞掉手动建票或打印事件 | 只给列表控件和筛选控件增加跳过整页重绘标识 |
| 列迁移遗漏内容 | 单元格按原表逐列等价抽取，并以内容和地址契约比对 |
| 标准表格破坏物料图片 | `renderBindingMaterialCell` 继续读取既有 `materialImageUrl`，并验收图片与物料同列、缩略图、大图和失败态 |
| 上游 `materialImageUrl` 是生成色板而非真实物料图 | 生成并人工检查对象对应正式效果图，保留来源清单；上游 BOM 明确绑定，不使用通用占位图 |
| 为修复门禁测试而改动交出算法 | 只补未配置专用工厂的真实边界样本，不改 `isMissingReceiverFactory` 和 `canCreateHandover` |
| 首次打印样本被兼容追踪补数再次标为已打印 | 仅对显式“待打印菲票”生命周期样本停止生成兼容打印记录，并断言核心三态推导和三个状态同时存在 |
| 低分辨率页面溢出 | 表格内部滚动、首列和操作列冻结，检查 document 横向溢出为 0 |
