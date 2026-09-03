# 后道生产任务、后道加工单与关联记录需求追踪矩阵

确认版本：当前工作树（2026-09-02）  
产品确认人：待用户确认

| 需求编号 | 来源 | 原子需求 | 工作包 | 实现文件／符号 | 自动化验证 | 页面／PDA／打印验证 | 状态 | 证据位置 | 确认人／版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PFTASK-001 | 用户要求 1 | 一个生产单级全流程总对象必须统一称为“后道生产任务” | WP-1 | `app-shell-config.ts`；`tasks.ts`；`production/detail-domain.ts`；`pda-exec-detail.ts` | 管理列表、全流程表面、菜单专项 | `/fcs/craft/post-finishing/tasks`、生产单详情、PDA 聚合详情 | 已验证 | 命名页面 11/11；13 张截图 | 待用户确认／当前工作树 |
| PFTASK-002 | 用户要求 1 | 一次质检后需要执行实际工序的对象必须统一称为“后道加工单” | WP-1 | `work-orders.ts`、`work-order-detail.ts`、`post-finishing-full-flow.ts` | Web/PDA、工厂详情、打印专项 | 加工单列表／详情、PDA 精确扫描、流转卡 | 已验证 | 定向 Playwright 10/10；两轮全链各 12 张加工单 | 待用户确认／当前工作树 |
| PFTASK-003 | 用户要求 1 | 菜单、页面标题、字段、按钮、空状态、生产详情、PDA、打印和下游关联字段不得混用旧名称 | WP-1 | `src/data/app-shell-config.ts`；后道 Web/PDA/打印相关页面 | `rg` 旧用户可见词审计；相关专项检查 | Web、PDA、打印命名页面 | 已验证 | `src` 旧孤立名称为 0；`scripts` 仅 2 个禁止旧词的负向断言 | 待用户确认／当前工作树 |
| PFTASK-004 | 用户要求 2 | 一个后道生产任务允许关联多次回货，列表操作必须显示回货记录数量 | WP-2 | `tasks.ts` / `renderActions`、`openRelatedRecordsDialog` | 管理列表专项、3×5×5 契约 | “回货记录（5）”按钮 | 已验证 | `post-production-task-return-dialog.png` | 待用户确认／当前工作树 |
| PFTASK-005 | 用户要求 2 | 回货记录弹窗必须展示该任务全部回货的批次、送货单、工厂、数量差异、状态、时间与详情入口 | WP-2 | `tasks.ts` / `renderRelatedRecordsDialog` | 管理列表专项 | 第一生产任务 5 行回货记录 | 已验证 | 命名 UI 读取 5/5 行并关闭返回原列表 | 待用户确认／当前工作树 |
| PFTASK-006 | 用户要求 2 | 一个后道生产任务允许关联多张质检单，列表操作必须显示质检单数量 | WP-2 | `tasks.ts` / `renderActions`、`openRelatedRecordsDialog` | 管理列表专项 | “质检单（4）”按钮 | 已验证 | 默认中间态 5 次回货／4 张已生成质检单，另 1 次尚未最终确认 | 待用户确认／当前工作树 |
| PFTASK-007 | 用户要求 2 | 质检单弹窗必须展示该任务全部质检单及其回货、数量、质检人、状态、生成时间、查看和打印入口 | WP-2 | `tasks.ts` / `renderRelatedRecordsDialog` | 管理列表专项 | 第一生产任务 4 行质检单，含“待送检”状态 | 已验证 | `2026-09-03-auto-qc-named-ui-final/post-production-task-qc-dialog.png`；读取 4/4 行 | 待用户确认／当前工作树 |
| PFTASK-008 | 用户要求 2 | 每次最终确认回货必须自动生成且最多生成一张“待送检”质检单，不能从生产任务列表手工建单；待加工仓送检只激活同一单 | WP-3 | `confirmPostFinishingFactoryReturn`、`getOrCreateQcTaskForConfirmedDelivery`、`sendPostFinishingFactoryReturnToQc`；`qc-orders.ts` | 全流程、默认 Mock、管理列表与跨端证据专项 | 回货确认反馈、待加工仓“确认送检出库”、质检单送检前不可领取 | 已验证 | 两轮各 15 次确认均留下“确认时已生成、状态待送检、无送检时间”阶段；送检前后任务数及单号不变 | 待用户确认／当前工作树 |
| PFTASK-009 | 用户要求 2 | 质检单号必须严格为 `<生产单号>-<正整数>` | WP-3 | `post-finishing-document-numbering.ts` / `readStrictQcSequence` | 全流程编号断言 | 弹窗展示 `PO-QC-202608-001-1..3` | 已验证 | 两遍 3×5×5 均为每生产单 `-1..-5` | 待用户确认／当前工作树 |
| PFTASK-010 | 用户要求 2 | 新质检单序号必须取同生产单已有最大序号加一，调用方不可人工指定或修改 | WP-3 | `issuePostFinishingDocumentNumber`；送检调用传入 `existingDocumentNos` | 账本 1／4 → 5、账本丢失恢复、人工 sequence 无效 | 弹窗说明“最大序号 + 1／不允许人工修改” | 已验证 | 两遍全流程专项和编号恢复断言通过 | 待用户确认／当前工作树 |
| PFTASK-011 | 用户要求 2 | 同一回货重复确认或重复送检必须幂等，不得产生第二张质检单或重复编号 | WP-3 | 编号服务 idempotency；确认建单与送检状态门禁 | 全流程确认后任务数、送检前后同号及重复送检断言 | 不适用：重复动作由状态门禁阻断，页面不提供重复创建入口 | 已验证 | 两遍全流程专项通过 | 待用户确认／当前工作树 |
| PFTASK-012 | 一单到底既有确认 | 回货、质检、可选加工、复检、出货必须保留生产任务和本次回货的链式关系 | WP-4 | `post-finishing-full-flow.ts`；仓库、质检、加工、复检、出货、审计页面 | 全流程、表面、结果桶专项 | Web 各列表／详情、PDA、打印 | 已验证 | 两轮各 15/15 条连续跨端链 | 待用户确认／当前工作树 |
| PFTASK-013 | 线上基线确认 | 后道待加工仓和后道待交出仓必须保留现有管理页结构，只补链路身份与入口 | WP-4 | `warehouse.ts`；PDA 仓库页面 | 管理列表、全流程表面 | 两仓命名页面 | 已验证 | 两轮各含两仓关键截图；每仓 15 条记录／30 条流水 | 待用户确认／当前工作树 |
| PFTASK-014 | UI 交互门禁 | 两个关联弹窗必须局部打开／关闭，不能因页面级点击处理器重绘而立即消失 | WP-2 | `tasks.ts` / `data-skip-page-rerender` | Playwright 打开、读取、关闭 | 1366×768 两弹窗 | 已验证 | 命名页面 11/11，两个弹窗截图均落地 | 待用户确认／当前工作树 |
| PFTASK-015 | 打印验收 | 后道加工单流转卡必须使用独立打印预览，不显示 Web 顶部导航和左侧菜单 | WP-4 | `components/shell.ts` / `isStandalonePrintPath` | 打印专项脚本 | 专用及旧兼容打印路由 | 已验证 | 打印定向 Playwright 6/6；专用路由无系统壳 | 待用户确认／当前工作树 |
| PFTASK-016 | 用户既有验收口径 | Mock 和契约必须覆盖 3 个生产单、每单 5 个 SKU、每单 5 次回货及正常／差异／跳过加工等场景 | WP-5 | `check-post-finishing-full-flow.ts`；默认 Mock；Playwright | 3×5×5 全流程 | Web 默认数据、PDA、打印 | 已验证 | 两遍领域规则 + 两遍全量跨端 UI；每遍 49 张截图 | 待用户确认／当前工作树 |
| PFTASK-017 | 项目治理 | 最终变更必须通过构建、列表治理、原型治理和 CodeGraph 状态检查；证据必须在最后实质修改后生成 | WP-5 | 本轮受管文件及文档 | build／governance／CodeGraph／task receipt | 命名页面当前截图 | 已验证 | 构建 2,394 模块；378 页治理；CodeGraph 1,577 文件；`2026-09-03-auto-qc-task-receipt.json`为`verified` | 待用户确认／当前工作树 |

## 第一遍双向追踪

- 正向：用户两项明确要求已拆为 PFTASK-001～011；一单到底、两仓基线、局部交互、打印及严格 3×5×5 验收已拆为 PFTASK-012～017。
- 反向：菜单、任务列表、两个弹窗、编号服务、送检入口、Web/PDA/打印、仓库、复检、出货、审计、测试和 Mock 均能回到至少一个需求编号。
- 当前发现并修正：关联弹窗曾被页面级点击处理器立即重绘移除；后道专用打印预览曾保留系统壳；两者均已补直接 UI 回归。

## 第二遍双向追踪

- 正向复核：PFTASK-001～017 全部能从用户要求／既有一单到底与线上两仓基线，走到明确实现位置、专项契约和 Web／PDA／打印证据；17/17 均为“已验证”。
- 反向复核：从菜单、受管文件、12 个命名路由、14 个必经跨端阶段、默认 Mock、两类关联弹窗和打印入口反查，均能回到 PFTASK-001～017；未发现越界创建入口或遗留用户可见旧名称。
- 旧词专项：`src` 中孤立“后道任务／后道单”为 0；`scripts` 中仅保留 2 个明确禁止旧词出现的负向断言。
- 完整闭环：既有 QC 后道总矩阵再次确认 141/141 条原子需求、33/33 个原文段落、23/23 项用户确认和 141/141 个证据映射；正向／反向 JSON 分别位于`output/verification/post-finishing-full-flow/2026-09-03-auto-qc-traceability-forward.json`和`2026-09-03-auto-qc-traceability-reverse.json`。
- 两轮证据：`2026-09-03-auto-qc-final-pass-1/`与`2026-09-03-auto-qc-final-pass-2/`均为独立空状态，各 15/15 链、75/75 SKU、15 个“回货确认自动生成质检单”阶段、49 张截图和 1 份完整 trace；命名页面`2026-09-03-auto-qc-named-ui-final/`另有 11/11 场景、13 张截图。
