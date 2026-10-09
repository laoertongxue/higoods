# 后道阶段折叠与时间展示控制面

日期：2026-10-09。基线：`77da48e02bec888e36bdeb79a2b9247e0d02dad7`，工作树 `d29f/higoods`，分支 `codex/dds-task-business-review`。命名验收页面为 `/dds/supply-chain/production-fulfillment/orders/PO-202610-0101`；用户截图作为问题线索，其实际内容与当前页面在本轮验收时核对。

依据：用户确认红框中的后道质检、加工、复检、交货应合入“后道”阶段，点击阶段才展示具体信息；要求展示时间、时效和逾期信息，并将“具体车缝执行”更名为“车缝执行”。本轮只调整当前生产时效监控的阶段组织和相关表达，保留采购、合同、数量、批次、既有单据、原模块详情路由及计时要求；不补造执行事实、未来单据、负责人或时效标准。

## 1. 阶段组织与名称

主图默认只展示一个“后道”阶段行。后道质检、后道加工、处理后交出复核、交货属于该阶段内部工作，不作为主图常驻的四个平级阶段。点击后道阶段可展开，再次点击可收起；“展开全部阶段”包含相同的后道内容，不产生第二份平级后道行。

展开内容按来源车缝任务和实际批次展示适用工作及单据。无需我方加工时，保留质检直接交货的既有路径，不虚构加工单和处理后交出复核单。一个批次仍只有一张后道加工单，单据内加工项目共用一组数量、状态和时间。处理后交出复核继续核对 SKU 数量和条码，不表达为第二次质量检验。

监控页阶段摘要、主图、展开标题、操作入口及当前活动规范统一使用“车缝执行”。车缝任务分配继续独立展示；三类合同的实际承包范围和合同节点保持。历史截图、原始证据与历史日志保留原样。

## 2. 时间与时效表达

阶段收起时仍能看到实际时间范围、当前工作与已完成工作概况，以及现有要求支持的当前超时、历史逾期完成或待核实结果；具体批次的时间和单据在展开后查看。时间范围只能由对应记录推导，不能用合计时长代替。

展开后的工作及单据展示已有实际开始、实际完成或交出、下游接收时间；正在执行时展示截至查看时点的用时，已完成时展示实际起止用时。缺少记录明确“待核实”，尚未进入与资料缺失分别表达；不将建单时间、前置结束时间或合同分配日期自动当作后道实际开始。交货用时按已确认的交出至下游接收口径展示，加工与交接分别计时。

单据已有明确要求时，同时展示要求、截止与结果，区分“未完成且超时”和“已经完成但晚于截止”。无确认要求时，显示实际用时与“时效要求待确认”；起止事实不足时，保留缺失说明，不能判断按期或超时。后道阶段不自行新增一个总时效要求，不能把不同批次、并行或重叠工作时长累加为阶段用时。既有整单最早采购下单加 28 自然日全部入成衣仓口径保持，不转成某张后道单据的加工标准。

## 3. 实施与存储边界

实施顺序：主图阶段归并及更名 → 展开链路与时间、时效表达 → 专项契约 → 20 个现有 Mock 场景和实际页面 → 三尺寸、交互及性能验收 → 当前任务收据。

负责范围为生产单图示、后道链路、局部样式、相关专项测试及活动文档。数据读取继续为静态 Mock → 现有来源登记 → 监控图和只读单据详情。无新增业务保存、文件存储、迁移或清空动作；既有跟进存储不改。本轮不修改后道工厂原模块的业务办理，不以原型场景代表真实生产事实。

## 4. 原子需求与交付矩阵

当前八项均已验证。依据用户2026-10-09要求，主代理完成实现与当前本地技术验收；效果接受与发布仍由后续用户指令分别确认。

| 编号 | 来源 | 原子需求 | 工作包与实现位置 | 自动化验证 | 页面与性能验证 | 状态 | 证据位置 | 确认人和版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST-FOLD-001 | 用户截图与请求；§1 | 主图后道默认一行，四类内部工作点击展开，单阶段与全部展开入口内容一致 | WP-1 production-order-diagrams.ts / postFlowRows、postWorkRows、row | post-stage、full-flow-diagrams、full-flow-fixtures、copy、scenarios、source-detail、full-flow-source-detail共140项通过；全量635项通过 | 20场景；1366、1280、1024实际视口；单据摘要、新标签详情、完整打印；适用动作各5次≤1000ms；已知后道SLA仅合成契约，无标准Mock不编造 | 已验证 | docs/prototype-review-records/2026-10-09-production-timing-post-stage.md；production-timing-post-stage-evidence/acceptance-summary.json及原始样本 | 用户要求2026-10-09；主代理本地验收；HEAD77da48e0工作差异，index-QXnvFeEk；效果待用户确认 |
| POST-FOLD-002 | §1 | 展开后按任务、批次展示适用工作与对应单据，保留唯一加工单和无需加工路径 | WP-2 full-flow-diagrams.ts / renderFullFlowBranch、postBatchChain；production-order-diagrams.ts / renderTimingNodeDetail | post-stage、full-flow-diagrams、full-flow-fixtures、copy、scenarios、source-detail、full-flow-source-detail共140项通过；全量635项通过 | 20场景；1366、1280、1024实际视口；单据摘要、新标签详情、完整打印；适用动作各5次≤1000ms；已知后道SLA仅合成契约，无标准Mock不编造 | 已验证 | docs/prototype-review-records/2026-10-09-production-timing-post-stage.md；production-timing-post-stage-evidence/acceptance-summary.json及原始样本 | 用户要求2026-10-09；主代理本地验收；HEAD77da48e0工作差异，index-QXnvFeEk；效果待用户确认 |
| POST-FOLD-003 | 用户时间要求；§2 | 实际起止、正在执行用时、完成用时和缺失状态由对应事实支持，阶段收起时保留时间概况 | WP-2 full-flow-diagrams.ts / fullFlowTimeSummary、fullFlowRail | post-stage、full-flow-diagrams、full-flow-fixtures、copy、scenarios、source-detail、full-flow-source-detail共140项通过；全量635项通过 | 20场景；1366、1280、1024实际视口；单据摘要、新标签详情、完整打印；适用动作各5次≤1000ms；已知后道SLA仅合成契约，无标准Mock不编造 | 已验证 | docs/prototype-review-records/2026-10-09-production-timing-post-stage.md；production-timing-post-stage-evidence/acceptance-summary.json及原始样本 | 用户要求2026-10-09；主代理本地验收；HEAD77da48e0工作差异，index-QXnvFeEk；效果待用户确认 |
| POST-FOLD-004 | 既有业务确认；§2 | 加工与交出至下游接收分别计时 | WP-2 fullFlowTimeSummary与既有clock/handoverClock | post-stage、full-flow-diagrams、full-flow-fixtures、copy、scenarios、source-detail、full-flow-source-detail共140项通过；全量635项通过 | 20场景；1366、1280、1024实际视口；单据摘要、新标签详情、完整打印；适用动作各5次≤1000ms；已知后道SLA仅合成契约，无标准Mock不编造 | 已验证 | docs/prototype-review-records/2026-10-09-production-timing-post-stage.md；production-timing-post-stage-evidence/acceptance-summary.json及原始样本 | 用户要求2026-10-09；主代理本地验收；HEAD77da48e0工作差异，index-QXnvFeEk；效果待用户确认 |
| POST-FOLD-005 | 用户时效、逾期要求；§2 | 明确要求支持的当前超时与历史逾期完成分开展示，无要求或事实不足不编造超时 | WP-2 fullFlowTimeSummary（sla/days与实际起止） | post-stage、full-flow-diagrams、full-flow-fixtures、copy、scenarios、source-detail、full-flow-source-detail共140项通过；全量635项通过 | 20场景；1366、1280、1024实际视口；单据摘要、新标签详情、完整打印；适用动作各5次≤1000ms；已知后道SLA仅合成契约，无标准Mock不编造 | 已验证 | docs/prototype-review-records/2026-10-09-production-timing-post-stage.md；production-timing-post-stage-evidence/acceptance-summary.json及原始样本 | 用户要求2026-10-09；主代理本地验收；HEAD77da48e0工作差异，index-QXnvFeEk；效果待用户确认 |
| POST-FOLD-006 | §2 | 阶段汇总不累加不同批次、并行和重叠工作时长，不新增后道总时效要求 | WP-2 fullFlowTimeSummary / longest own clock、fullFlowRail / recorded interval | post-stage、full-flow-diagrams、full-flow-fixtures、copy、scenarios、source-detail、full-flow-source-detail共140项通过；全量635项通过 | 20场景；1366、1280、1024实际视口；单据摘要、新标签详情、完整打印；适用动作各5次≤1000ms；已知后道SLA仅合成契约，无标准Mock不编造 | 已验证 | docs/prototype-review-records/2026-10-09-production-timing-post-stage.md；production-timing-post-stage-evidence/acceptance-summary.json及原始样本 | 用户要求2026-10-09；主代理本地验收；HEAD77da48e0工作差异，index-QXnvFeEk；效果待用户确认 |
| POST-FOLD-007 | 用户更名要求；§1 | 监控页活动入口与规范统一使用“车缝执行”，保留独立任务分配及三类合同范围 | WP-1 production-order-diagrams.ts、full-flow-diagrams.ts、fixtures.json、full-flow-completion-design-20261009.md | post-stage、full-flow-diagrams、full-flow-fixtures、copy、scenarios、source-detail、full-flow-source-detail共140项通过；全量635项通过 | 20场景；1366、1280、1024实际视口；单据摘要、新标签详情、完整打印；适用动作各5次≤1000ms；已知后道SLA仅合成契约，无标准Mock不编造 | 已验证 | docs/prototype-review-records/2026-10-09-production-timing-post-stage.md；production-timing-post-stage-evidence/acceptance-summary.json及原始样本 | 用户要求2026-10-09；主代理本地验收；HEAD77da48e0工作差异，index-QXnvFeEk；效果待用户确认 |
| POST-FOLD-008 | §3/5 | 全部20个现有场景在三尺寸保持可读且受影响加载与交互达到1秒门禁 | WP-3 post-stage.test.ts；局部CSS屏幕与打印规则 | post-stage、full-flow-diagrams、full-flow-fixtures、copy、scenarios、source-detail、full-flow-source-detail共140项通过；全量635项通过 | 20场景；1366、1280、1024实际视口；单据摘要、新标签详情、完整打印；适用动作各5次≤1000ms；已知后道SLA仅合成契约，无标准Mock不编造 | 已验证 | docs/prototype-review-records/2026-10-09-production-timing-post-stage.md；production-timing-post-stage-evidence/acceptance-summary.json及原始样本 | 用户要求2026-10-09；主代理本地验收；HEAD77da48e0工作差异，index-QXnvFeEk；效果待用户确认 |

## 5. 验收证据与关闭条件

当前命名验收页面、全部 20 个现有场景和正常、当前超时、历史延误、未知要求、缺失事实、尚未进入等适用分支逐项核验；场景无确认后道 SLA 时，不为造出红色逾期而新增标准。图片、单据弹窗、原模块新标签和打印等受影响入口按当前版本复验。三尺寸无页面横向溢出；受影响加载与交互每项至少五次，真实内容及适用图片就绪不超过 1000 毫秒，保留失败及成功原始样本。

主代理验收记录目标为 `docs/prototype-review-records/2026-10-09-production-timing-post-stage.md`，证据目录目标为 `docs/prototype-review-records/production-timing-post-stage-evidence/`；当前证据已生成并逐条绑定。实际实现、专项与命名页面证据、资源版本和确认人已绑定。最后实质修改后重跑受影响检查与页面验证，八项均有充分当前证据后才标记“已验证”；发布仍按用户另行要求执行。
