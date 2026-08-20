# 盘扣及新增辅助工艺需求追踪与交付矩阵

## 1. 使用说明

- 权威需求：`docs/product-requirements/2026-08-20-button-loop-and-new-auxiliary-crafts-design.md`。
- 实施依据：`docs/implementation-plans/2026-08-20-button-loop-and-new-auxiliary-crafts-implementation.md`。
- 当前分支：`codex/aux-crafts-binding-strip`；基线 HEAD：`4c4de1f6`。
- 当前阶段：实现与两遍验证均已完成；原子需求全部达到“已验证”，正式任务收据为 `verified` 且无 blocker。
- 产品确认人／版本：用户在本任务对话中确认，确认日期 `2026-08-20`；当前交付载体为 `codex/aux-crafts-binding-strip` 工作树，基线 HEAD `4c4de1f6`，尚未提交或推送。

## 2. 原子需求与交付证据

| 需求编号 | 来源文档和章节 | 原子需求 | 实施工作包 | 实现文件／符号 | 自动化验证 | 页面／PDA／打印验证 | 当前状态 | 证据位置 | 产品确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MASTER-001 | 总体设计 2.1 | 工序工艺字典新增盘扣、花朵、打褶、烫钻四种独立辅助工艺 | WP-01 | `src/data/fcs/process-craft-dict.ts`、`src/data/fcs/special-craft-operations.ts` | `check:button-loop-auxiliary-crafts`、工艺分类回归 | `/fcs/production/craft-dict` 展示四项 | 已验证 | Playwright 第 1 场景、截图 01 前置页面 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| MASTER-002 | 总体设计 2.1 | 盘扣加工对象只能为捆条；花朵、打褶、烫钻加工对象为裁片部位 | WP-01、WP-02 | `process-craft-dict.ts`、`src/pages/tech-pack/pattern-domain.ts` | 综合领域契约、目标对象版本检查 | 字典页与技术包纸样详情 | 已验证 | Playwright 第 1 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| MASTER-003 | 总体设计 2.1 | 打褶与压褶保留为两种不同工艺，不做别名归一 | WP-01 | `process-craft-dict.ts`、`special-craft-operations.ts` | 工艺分类回归 | 字典页分别可见 | 已验证 | `check-special-craft-business-taxonomy.ts` | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| FACTORY-001 | 总体设计 2.1 | 创建 FLOWER、APF - 辅助工艺、SPF - 特种工艺三份工厂档案 | WP-01 | `src/data/fcs/factory-master-store.ts`、`special-craft-dedicated-factories.ts` | 综合领域契约、工厂仓检查 | 盘扣任务展示 APF - 辅助工艺 | 已验证 | Playwright 截图 02、03 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| FACTORY-002 | 总体设计 2.1 | 烫画、直喷分配 FLOWER；其他辅助工艺分配 APF；特种工艺分配 SPF | WP-01 | `special-craft-dedicated-factories.ts`、`special-craft-task-orders.ts` | 综合领域契约、工艺分类回归 | 盘扣任务与菲票显示 APF | 已验证 | Playwright 截图 02、03 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| FACTORY-003 | 总体设计 2.1、2.8 | 菜单组名称继续使用“辅助工艺工厂管理”“特种工艺工厂管理”，不改成 APF／SPF | WP-01、WP-07 | `special-craft-operations.ts`、`special-processes-model.ts` | `check:special-craft-operation-menus`、综合领域契约 | 盘扣加工单位于辅助工艺工厂管理 | 已验证 | 路由 `/fcs/process-factory/special-craft/aux-op-button-loop/tasks` | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| TECH-001 | 总体设计 2.2 | 一个纸样包允许维护多条捆条 | WP-02 | `src/data/pcs-technical-data-version-types.ts`、`repository.ts`、`src/pages/tech-pack/context.ts` | 纸样解析、纸样详情专项检查 | 技术包显示“捆条 2 条” | 已验证 | Playwright 截图 01 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| TECH-002 | 总体设计 2.2 | 每条捆条独立选择是否做盘扣，普通捆条不被连带标记 | WP-02 | `src/pages/tech-pack/events.ts`、`pattern-domain.ts`、`context.ts` | 纸样详情、目标对象版本检查 | 在可编辑技术包先新增并确认盘扣路线，再新增两条捆条并逐个切换，互不串值；已发布详情只有一条显示“盘扣 · 黄色菲票” | 已验证 | Playwright 截图 01、01b | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| TECH-003 | 总体设计 2.2 | 花朵、打褶、烫钻仍只能在裁片部位选择 | WP-02 | `pattern-domain.ts`、`pcs-technical-data-version-types.ts` | 目标对象版本检查 | 字典与纸样详情对象文案 | 已验证 | Playwright 第 1 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| TECH-004 | 总体设计 2.2、3 | 捆条盘扣选择进入技术包版本、评审差异和生产快照；旧数据缺字段按空数组 | WP-03、WP-11 | `pcs-tech-pack-review-diff.ts`、`pcs-technical-data-version-bootstrap.ts`、`production-tech-pack-snapshot-builder.ts` | 技术包目标对象／版本、纸样解析回归 | 技术包刷新后仍显示两条捆条及选择 | 已验证 | 专项脚本与 Playwright 截图 01 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| TASK-001 | 总体设计 2.3 | 同一生产单所有需盘扣捆条生成一张盘扣加工单 | WP-04 | `src/data/fcs/special-craft-task-orders.ts` | 综合领域契约 | 盘扣加工单列表仅一张对应任务 | 已验证 | Playwright 第 1 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| TASK-002 | 总体设计 2.3 | 盘扣加工单保留多条捆条明细，每条明细关联自身菲票 | WP-04 | `special-craft-task-orders.ts` 的 `buttonLoopInputLines` | 综合领域契约 | 详情弹窗逐张核对全部投入菲票 | 已验证 | Playwright 截图 02 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| TASK-003 | 总体设计 2.3 | 未选择盘扣的捆条不进入盘扣加工单 | WP-04 | `special-craft-task-orders.ts` | 综合领域契约 | 普通捆条只进入白票分组 | 已验证 | Playwright 第 1 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| QTY-001 | 总体设计 2.4 | 盘扣投入数量按菲票张数记录并逐张确认 | WP-04、WP-05 | `src/data/fcs/button-loop-craft-flow.ts`、`process-action-writeback-service.ts` | 综合领域契约 | Web 接收弹窗显示“投入单位为张”及逐票勾选 | 已验证 | Playwright 截图 02 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| QTY-002 | 总体设计 2.4 | 捆条长度以米保留追溯，但不参与盘扣产出计算 | WP-04 | `button-loop-craft-flow.ts`、`special-craft-task-orders.ts` | 综合领域契约 | Web/PDA 展示追溯米数，不要求公式 | 已验证 | 领域契约、PDA 截图 05 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| QTY-003 | 总体设计 2.4 | 盘扣产出、交出、中央辅料仓收货单位均为个 | WP-04、WP-05、WP-10 | `button-loop-craft-flow.ts`、`button-loop-accessory-receipts.ts` | 综合领域契约 | PDA 填报／交出 24 个，WLS 收货 24 个 | 已验证 | Playwright 截图 05～08 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| QTY-004 | 总体设计 2.4 | 系统不配置或计算每件衣服需要多少个盘扣 | WP-04 | `button-loop-craft-flow.ts`、`task-detail.ts` | 综合领域契约检查无服装件数公式 | 页面只要求本次实际产出个数 | 已验证 | Playwright 第 2 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| FLOW-001 | 总体设计 2.5 | 确认接收必须核对并接收投入捆条菲票 | WP-05、WP-08 | `process-action-writeback-service.ts`、`pda-exec-detail.ts` | 综合领域契约 | Web 与 PDA 均完成确认接收 | 已验证 | Playwright 第 1、2 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| FLOW-002 | 总体设计 2.5 | 加工填报只接受正整数盘扣产出个数并累计产出 | WP-05、WP-08 | `button-loop-craft-flow.ts`、`pda-exec-detail.ts` | 综合领域契约 | PDA 填报 24 个后显示累计产出 24 个 | 已验证 | Playwright 截图 05 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| FLOW-003 | 总体设计 2.5 | 发起交出只允许交出不超过待交出量的盘扣个数 | WP-05、WP-08 | `button-loop-craft-flow.ts`、`process-action-writeback-service.ts` | 综合领域契约覆盖超量阻断 | PDA 交出 24 个并显示 24／0 个 | 已验证 | Playwright 截图 06 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| FLOW-004 | 总体设计 2.5 | 完成加工单前必须已接收、已产出且待交出为零 | WP-05、WP-08 | `button-loop-craft-flow.ts` | 综合领域契约覆盖完成门禁 | PDA 交出后才出现完成按钮并完成 | 已验证 | Playwright 截图 07 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| FLOW-005 | 总体设计 2.5 | PDA“交接”只放确认接收／发起交出，“执行”只放加工填报／完成加工单 | WP-08 | `src/pages/pda-exec-detail.ts` | 综合领域契约 | 两个 PDA surface 分别断言按钮不存在／存在 | 已验证 | Playwright 第 2 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| FLOW-006 | 总体设计 2.4、2.5 | 盘扣允许分次交出；首次交出后必须保留剩余待交出量，全部交出后剩余量归零并标记已交出 | WP-05、WP-08 | `special-craft-task-orders.ts`、`process-action-writeback-service.ts` | 综合领域契约覆盖 10 个＋14 个分次交出及仓储状态 | PDA 首次显示 10／14，第二次显示 24／0 | 已验证 | Playwright 截图 06、07 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| DEST-001 | 总体设计 2.4、2.7 | 盘扣成品交出去向固定为中央辅料仓 | WP-05、WP-10 | `button-loop-craft-flow.ts`、`button-loop-accessory-receipts.ts` | 综合领域契约 | Web/PDA/打印均显示中央辅料仓 | 已验证 | Playwright 截图 02、03、07、08 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| PRINT-001 | 总体设计 2.6 | 所有捆条菲票版式为 100mm × 100mm | WP-09 | `src/pages/print/templates/label-print-template.ts` | 综合领域契约 | 浏览器实际边界约 378px × 378px（96dpi 的 100mm） | 已验证 | Playwright 截图 03 与尺寸断言 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| PRINT-002 | 总体设计 2.6 | 需要盘扣的捆条菲票使用黄色热敏纸并显著标注盘扣 | WP-09 | `src/pages/process-factory/cutting/fei-tickets.ts`、`label-print-template.ts` | 综合领域契约 | 黄色预览显示“特殊工艺菲票——盘扣（捆条）” | 已验证 | Playwright 截图 03 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| PRINT-003 | 总体设计 2.6 | 不做盘扣的普通捆条菲票保持白色 | WP-09 | `fei-tickets.ts`、`binding-strip-orders.ts` | 综合领域契约 | 打印工作台同时显示普通白票入口 | 已验证 | Playwright 第 1 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| PRINT-004 | 总体设计 2.6 | 黄票与白票分批打印，混色选择必须阻断 | WP-09 | `binding-strip-orders.ts`、`src/main-handlers/fcs-handlers.ts` | 综合领域契约覆盖混色拒绝 | 打印工作台按纸色拆分入口 | 已验证 | Playwright 第 1 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| PRINT-005 | 总体设计 2.6 | 白色与黄色捆条菲票改为单张 100mm × 100mm 后仍保留标题、SPU、生产单、裁片单及原切割追溯字段 | WP-09、WP-11 | `src/pages/print/templates/label-print-template.ts` | 既有捆条流转专项、综合领域契约 | 黄票截图显示标题、SPU、生产单、裁片单和切割字段；白票由既有专项逐字段回归 | 已验证 | Playwright 截图 03、`check-cutting-binding-strip-flow.ts` | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| WARE-001 | 总体设计 2.7 | 四个新增工艺均建立待加工仓、待交出仓及默认库区库位 | WP-06 | `src/data/fcs/factory-internal-warehouse-locations.ts` | 工厂仓模型、领交仓基础回归 | 管理端任务读取对应工艺仓 | 已验证 | 专项脚本 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| WARE-002 | 总体设计 2.7 | 盘扣确认接收投影到“盘扣-捆条库区”，数量单位为张 | WP-05、WP-06 | `button-loop-craft-flow.ts`、`process-warehouse-linkage-service.ts` | 综合领域契约 | PDA 确认接收后进入加工填报 | 已验证 | 领域契约、Playwright 第 2 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| WARE-003 | 总体设计 2.7 | 盘扣加工填报投影到待交出仓“盘扣-捆条库区”，数量单位为个 | WP-05、WP-06 | `button-loop-craft-flow.ts`、`process-warehouse-linkage-service.ts` | 综合领域契约 | PDA 显示累计产出 24 个 | 已验证 | 领域契约、截图 05 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| WARE-004 | 总体设计 3 | 盘扣专用仓储投影排除通用裁片投影，避免重复记录 | WP-05、WP-11 | `src/data/fcs/process-warehouse-linkage-service.ts` | 综合领域契约检查记录数 | 页面无重复盘扣库存／收货行 | 已验证 | Playwright 第 2 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| WARE-005 | 总体设计 2.1、2.7 | FLOWER 同时保留烫画／直喷在成衣和裁片对象下的四组默认库区 | WP-01、WP-06、WP-11 | `src/data/fcs/factory-internal-warehouse-locations.ts` | 综合领域契约精确断言四个库区名称 | 不适用：本次浏览器页面聚焦新增工艺，既有 FLOWER 对象组合由领域契约回归 | 已验证 | `check:button-loop-auxiliary-crafts` | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| MENU-001 | 总体设计 2.8 | 盘扣、花朵、打褶、烫钻各有独立加工单菜单 | WP-07 | `special-craft-operations.ts`、`special-processes-model.ts` | `check:special-craft-operation-menus` | 盘扣命名路由可进入，其他三项由菜单契约核查 | 已验证 | 专项脚本、盘扣截图 02 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| WEB-001 | 总体设计 2.8 | Web 盘扣详情同时展示投入菲票、追溯米数、产出／交出个数、APF 和中央辅料仓 | WP-07 | `task-detail.ts`、`shared.ts` | 综合领域契约 | 盘扣加工单详情 | 已验证 | Playwright 截图 02 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| PDA-001 | 总体设计 2.8 | PDA 显示盘扣专属投入张、追溯米、产出／交出个，不套用裁片通用进度 | WP-08 | `src/pages/pda-exec-detail.ts` | 综合领域契约、Playwright 无通用进度断言 | PDA 执行与交接页面 | 已验证 | Playwright 截图 05～07 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| PDA-002 | 总体设计 2.8 | APF 现场账号能查询并操作盘扣加工单，非承接工厂仍按原作用域 | WP-08 | `src/data/fcs/special-craft-pda-scope.ts`、`store-domain-pda.ts` | 综合领域契约 | APF PDA 会话完成四动作 | 已验证 | Playwright 第 2 场景 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| WLS-001 | 总体设计 2.7、2.8 | 中央辅料仓单列盘扣成品收货，并按个确认全部收货 | WP-10 | `src/data/fcs/button-loop-accessory-receipts.ts`、`src/pages/wls-accessory-receipts.ts` | 综合领域契约 | 24 个由待收货变为已收货 | 已验证 | Playwright 截图 04、08 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| WLS-002 | 总体设计 2.7、2.8 | 同一盘扣加工单分批交出、分批收货时累计已收数量不被覆盖，只追加新增待收数量 | WP-10 | `button-loop-accessory-receipts.ts`、`wls-accessory-receipts.ts` | 综合领域契约覆盖先收 10 个、再待收 14 个、最终累计 24 个 | WLS 显示“已收货 10 个／待收货 14 个”，再次确认后变为已收货 24 个 | 已验证 | Playwright 截图 06、08 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| MIG-001 | 总体设计 3 | 旧辅助／特种工艺工厂标识迁移到 FLOWER、APF、SPF，不再生成旧工厂档案 | WP-11 | `factory-master-store.ts`、`store-domain-pda.ts` | 综合领域契约、工厂仓检查 | 新页面只显示 APF／FLOWER／SPF 事实 | 已验证 | 专项脚本与反向搜索 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| REG-001 | 总体设计 3 | 既有烫画／直喷仍由 FLOWER 承接，既有特种工艺仍由 SPF 承接 | WP-01、WP-11 | `special-craft-dedicated-factories.ts`、`special-craft-task-orders.ts` | 工艺分类与综合领域契约 | 不适用：本次页面验收聚焦新增工艺，归属由领域契约证明 | 已验证 | 专项脚本 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| REG-002 | 总体设计 3 | 旧技术包或旧捆条需求明细缺少 `specialCrafts` 时按空数组读取，既不生成盘扣单，也不破坏原捆条加工与打印 | WP-02、WP-09、WP-11 | `binding-strip-orders.ts`、技术包 repository/bootstrap | 既有捆条全流程专项和综合领域契约 | 不适用：历史无字段输入由领域回归构造并验证 | 已验证 | `check-cutting-binding-strip-flow.ts`、正式任务收据 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| TEST-001 | 总体设计 4 | 使用领域契约覆盖字典、工厂、任务、数量、状态、仓储、打印、中央仓完整规则 | WP-12 | `scripts/check-button-loop-auxiliary-crafts.ts` | `npm run check:button-loop-auxiliary-crafts` | 不适用：自动化领域证据 | 已验证 | 两遍验证日志 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| TEST-002 | 总体设计 4 | 使用真实浏览器覆盖 Web、PDA、打印和 WLS 命名路由 | WP-12 | `tests/button-loop-auxiliary-crafts.spec.ts` | Playwright 两个场景 | 9 张当前工作树截图（含可编辑技术包多捆条操作） | 已验证 | `test-results/playwright/button-loop-auxiliary-crafts-*` | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |
| TEST-003 | 总体设计 4 | 最后一次实质修改后执行正向与反向两遍验证并查漏补缺 | WP-12 | 本矩阵、完整原型审查记录 | 第一遍按需求；第二遍按 diff／入口／旧事实反查 | 两遍均重放浏览器命名场景 | 已验证 | 最终验收记录与任务收据 | 用户／2026-08-20，codex/aux-crafts-binding-strip 工作树（基线 4c4de1f6） |

## 3. 双向覆盖检查

### 3.1 正向追踪

- 总体设计 2.1 → `MASTER-*`、`FACTORY-*`。
- 总体设计 2.2 → `TECH-*`。
- 总体设计 2.3 → `TASK-*`。
- 总体设计 2.4 → `QTY-*`、`DEST-001`。
- 总体设计 2.5 → `FLOW-*`。
- 总体设计 2.6 → `PRINT-*`。
- 总体设计 2.7 → `WARE-*`、`WLS-001`。
- 总体设计 2.8 → `FACTORY-003`、`MENU-001`、`WEB-001`、`PDA-*`、`WLS-001`。
- 总体设计 3 → `TECH-004`、`WARE-004`、`MIG-001`、`REG-*`。
- 总体设计 4 → `TEST-*`。

### 3.2 反向追踪

第二遍从本任务的代码、路由、Mock、打印模板、菜单、旧数据和既有裁床检查反查需求编号，发现并修复：纸样池丢捆条、未注册打印模板、PDA 套用裁片进度、FLOWER 对象库区缺项、部分交出清零、分批收货覆盖、旧捆条缺字段报错、单张菲票丢标题／SPU。最终 diff 中没有无法回到需求编号的业务改动。

## 4. 最终验证结果

- 第一遍正向追踪：按 `MASTER` 至 `TEST` 编号逐项核对字典、工厂、技术包、任务、数量、状态、仓储、Web、PDA、打印和中央辅料仓；任务专项和浏览器命名场景通过。
- 第二遍反向追踪：从最终 diff、旧工厂／旧技术包／旧捆条输入、FLOWER 既有对象组合、分批交接与收货、白黄菲票和既有裁床全链路反查；上述八项缺口修复后全部重跑通过。
- 最后一次实质修改后：盘扣综合契约通过；Playwright 2/2 通过；既有捆条流程通过；`check:cutting:all`、列表治理、原型治理和构建通过；CodeGraph 无待同步；任务收据 `/private/tmp/higoods-button-loop-task-receipt.json` 为 `verified`、blocker 为空。
