# 生产与履约时效：文案歧义核查与修复清单

日期：2026-10-08。来源为用户本轮“完整、细致核查页面、文档和相关代码，并全部修复”的要求。核查从 main 已发布基线86593df8开始，覆盖全景图、全部20演示场景、8个模块入口、单据摘要/原模块登记详情、跟进、CSV及打印表达。另逐行核查18份模块Markdown、相关矩阵，保留历史原始证据。

共109条位置与语义问题：图示/共享表达29项，管理与来源详情29项，文档51项。同一业务含义在不同页面/历史文件的误导分别登记，不把109视为109种独立业务规则。109项均已修复并完成本地逐项验证，修复后产品接受仍待用户确认。逐项状态见 [文案追踪矩阵](copy-clarity-matrix.csv)。

## 用户指出的例子

准备09-20 09:00开始，要求4自然日，因此09-24 09:00应完成；实际09-25 09:00完成，晚1天。查看时点10-07时已完成，超时不继续增加。新卡片直接显示“已完成·晚1天”及截止/实际时间。与之相对，袖片绣花到10-07仍未完成，超过10-06截止1天，显示“1道未完成·已超时，最长1天”并显示尚未完成600片。这两种情况不能都概括为无当前逾期或阶段逾期。

## 现行表达约定

| 对象 | 已结束 | 未结束 | 资料缺失 |
| --- | --- | --- | --- |
| 准备/加工 | 已完成·按期 / 已完成·晚X | 未完成·截止未到 / 未完成·已超时X | 缺起止/结果/要求，说明无法计算或判断 |
| 物料采购批 | 已入面辅料仓·按期/晚X | 尚未全部入面辅料仓·截止未到/超时X | 未取得实收，不称入仓完成 |
| 合同累计节点 | 已达标·按期/晚X，仅该节点差额0 | 未达标·截止未到/超时X，目标与还差量分列 | 缺分配日期、实领未知或0，节点无法判定 |
| 整张生产单 | 已全部入库·按期/晚X | 未全部入库，整单截止单独判断 | 数量缺失无法判完成；全量已知但最后时间缺失只能判完成 |
| 上下游交接 | 已全部接收及实际用时 | 尚未全部接收及等待用时 | 未确认要求不判正常/超时；差额不直接等于丢失 |
| 工厂样衣 | 已交出；要求日期内/晚于日期 | 未交出；要求日期未到/已过 | 日内截止未确认，不生成精确小时；审核是否通过单列 |

## 图示与共享表达问题

| 编号 | 页面/触发 | 原文 | 歧义 | 修复结果 | 实现 |
| --- | --- | --- | --- | --- | --- |
| COPY-GRAPH-001 | 阶段摘要 | 已知时效项无当前逾期 ＋ 1项逾期完成 | 当前是否仍需办理和完成时是否晚混淆 | 已完成 · 晚1天，要求09-24 09:00，实际09-25 09:00 | `src/pages/production-fulfillment/production-order-diagrams.ts:39` phaseTiming |
| COPY-GRAPH-002 | 阶段摘要 | 1项/最长X | 项可指物料、工序或整个阶段 | 准备整体；采购批；每道辅助工艺分别计数 | `src/pages/production-fulfillment/production-order-diagrams.ts:39` phaseTiming |
| COPY-GRAPH-003 | 阶段摘要 | 物料供给无当前逾期 | 采购已入仓被误读为后续加工交接全完成 | 仅采购下单→面辅料仓入库8天；后续加工/交接另看 | `src/pages/production-fulfillment/production-order-diagrams.ts:39` phaseTiming |
| COPY-GRAPH-004 | 阶段资料缺口 | 适用执行记录待取得/无当前逾期 | 无需补采与没有取得记录混淆 | 无采购计时项与未取得物料单据分别表达 | `src/pages/production-fulfillment/production-order-diagrams.ts:39` phaseTiming |
| COPY-GRAPH-005 | 开始时间缺失 | 起点待取得，尚未计时 | 缺时间被当作业务尚未开始 | 开始时间未取得，无法计算用时 | `src/pages/production-fulfillment/production-order-diagrams.ts:60` clockLabel |
| COPY-GRAPH-006 | 制作和交接 | 制作开始→接收待取得 | 制作未完成被说成待接收 | 制作：完成时间待取得；交接：全部接收时间待取得 | `src/pages/production-fulfillment/production-order-diagrams.ts:206` twoClocks |
| COPY-GRAPH-007 | 时效要求缺失 | 标准待配置 | 暗示监控页可配置；无要求被当正常 | 未确认时效要求，无法判定是否超时 | `src/pages/production-fulfillment/production-order-diagrams.ts:60` clockLabel |
| COPY-GRAPH-008 | 准备完成图示 | 实际关闭 | 可能理解为作废或停止 | 准备完成，原单状态解释已关闭=准备完成 | `src/pages/production-fulfillment/production-order-diagrams.ts:156` chart |
| COPY-GRAPH-009 | 合同节点已达标 | 晚12小时 · 当前欠0件 | 易把某节点差额0当成任务全回齐 | 该节点差额0件；本任务尚未回数量另列 | `src/pages/production-fulfillment/production-order-diagrams.ts:132` taskRow |
| COPY-GRAPH-010 | 合同资料缺失 | 缺分配日期/实领时尚未到期 | 空值产生假0目标或无效截止 | 缺分配日期/缺实领/实领0，节点无法判定 | `src/pages/production-fulfillment/production-order-diagrams.ts:23` nodeInfo |
| COPY-GRAPH-011 | 合同节点动作 | 查看未来节点 | 全节点已达标仍提示未来动作 | 全节点已达标则查看已达标记录；否则后续未到期节点 | `src/pages/production-fulfillment/production-order-diagrams.ts:132` taskRow |
| COPY-GRAPH-012 | 样衣时效 | 按期交出/逾期交出 | 日期要求误读为已确认精确时刻 | 在要求日期内交出/晚于要求日期；尚未交出独立说明 | `src/pages/production-fulfillment/production-order-diagrams.ts:207` sampleTimingLabel |
| COPY-GRAPH-013 | 未知完成事实 | 没有结束时间=未完成 | 未取得结果误说未完成且计时持续 | 完成事实待取得；至查看时点不代表实际完成耗时 | `src/pages/production-fulfillment/production-order-diagrams.ts:301` timingBase |
| COPY-GRAPH-014 | 物料库存来源 | 库存采用600米 | 计划采用库存被当作已调出或实收 | 计划采用库存；具体单据记录实出与下游实收 | `src/pages/production-fulfillment/production-order-diagrams.ts:296` supplyDiagramBase |
| COPY-GRAPH-015 | 物料汇合 | 接收方已实收/待核实 | 标题先断言已收到，数值又未知 | 接收确认；已知600米与其余900米待核实分别显示 | `src/pages/production-fulfillment/production-order-diagrams.ts:296` supplyDiagramBase |
| COPY-GRAPH-016 | 整单完成 | 已按期完成/入库完成情况待核实 | 完成对象不明且数量缺失和时间缺失混在一起 | 已全部入库·按期/晚X/是否按期待核实；数量未知无法判定 | `src/pages/production-fulfillment/production-order-diagrams.ts:140` summary |
| COPY-GRAPH-017 | 整单预测 | 整单按期把握待核实 | 像系统已预测风险但没有依据 | 预计全量入仓时间未取得，不形成整单必然超时结论 | `src/pages/production-fulfillment/production-order-diagrams.ts:140` summary |
| COPY-GRAPH-018 | 数量位置 | 工厂尚未回 | 实领减后道实收不足以证明仍在工厂 | 工厂实领、后道尚未实收；具体位置另核对 | `src/pages/production-fulfillment/production-order-diagrams.ts:141` quantityGraph |
| COPY-GRAPH-019 | 后道数量 | 全部未下发车缝1500但后道加工待取得 | 已知尚未进入后道仍显示数量未知 | 未下发车缝且全量待分配时后道0；真正位置缺失保留待核实 | `src/pages/production-fulfillment/production-order-diagrams.ts:141` quantityGraph |
| COPY-GRAPH-020 | 跟进事项消失 | 该事项已结束 | 找不到ID不能证明已结束 | 未找到该事项记录，返回当前清单核对 | `src/pages/production-fulfillment/production-order-diagrams.ts:179` details |
| COPY-GRAPH-021 | 跟进清单为空 | 没有当前未完成事项 | 未登记待办不等于所有业务完成 | 清单未登记待跟进事项；实际进度以各单据为准 | `src/pages/production-fulfillment/production-order-diagrams.ts:177` queueStrip |
| COPY-GRAPH-022 | 影响图已完成工序 | 已经交接 · 保留历史影响 | 加工已完成不能自动证明交接已完成 | 加工已完成，交接结果另看对应单据 | `src/pages/production-fulfillment/production-order-diagrams.ts:210` impactGraph |
| COPY-GRAPH-023 | 影响范围数量 | 未完成=缺字段默认0 | 缺完成数据被填0，片数易当成衣数 | 未知待核实，保留米/片/件，不能整单皆受阻 | `src/pages/production-fulfillment/production-order-diagrams.ts:210` impactGraph |
| COPY-GRAPH-024 | 单据数量未知 | null米/null件 | 未知被当成文字数量 | 数量待核实，与已核实0分开 | `src/pages/production-fulfillment/production-order-diagrams.ts:62` docNode |
| COPY-GRAPH-025 | 准备单状态 | 已关闭/关闭 | 未说关闭代表准备已完成 | 准备已完成（单据已关闭）；准备完成/单据关闭 | `src/pages/production-fulfillment/production-order-diagrams.ts:62` docNode |
| COPY-GRAPH-026 | 读屏合同标签 | 逾期达成/已逾期 | 读屏标签和可见结果不一致 | 已达标·晚/未达标·超时，截止和目标数量同时说明 | `src/pages/production-fulfillment/production-order-diagrams.ts:132` taskRow |
| COPY-GRAPH-027 | 未启用准备记录 | 不形成当前欠项 | 欠项像欠货或责任遗漏 | 不计作当前未完成工作，保留原单据 | `src/pages/production-fulfillment/production-order-diagrams.ts:69` prepDiagram |
| COPY-GRAPH-028 | 配置入口 | 时效口径与配置 | 暗示可编辑设置 | 时效口径（只读）统一菜单、标签页、页标题 | `src/pages/production-fulfillment/index.ts:25` renderProductionFulfillmentPage |
| COPY-GRAPH-029 | 跟进填写和保存 | 业务人员预计时间/事务完成/读回 | 预计什么不明；保存成功被误当业务完成 | 预计对应工作完成、交出或接收时间并说明事件；跟进记录已保存并核对 | `src/pages/production-fulfillment/timing-followups.ts:101` renderTimingFollowups |

## 管理入口与来源详情问题

| 编号 | 页面/触发 | 原文 | 歧义 | 修复结果 | 实现 |
| --- | --- | --- | --- | --- | --- |
| MGMT-COPY-001 | 时效总览 / 生产单监控 / 我的跟单：已结束但晚完成，或仍有未完成工作 | 已知时效项无当前逾期 / 在制·无当前已确认逾期 | 容易把当前无需催办理解为从未延误或整单正常 | 已知工作暂无未完成超时；整单尚未全部入成衣仓；有历史延误时明示已结束但晚 | `src/pages/production-fulfillment/order-pages.ts:94` |
| MGMT-COPY-002 | 总览状态图 / 监控列表 / 筛选：整单已入仓但晚入库；或数量/时间未知 | 全部入库·历史逾期 / 入库资料待核实 / 当前工作逾期 | 逾期对象可能是整单或局部工作，未说明资料缺失影响什么 | 全部已入成衣仓·晚入库 / 入库数量未知·完成结果无法判定 / 有未完成超时工作 | `src/pages/production-fulfillment/order-pages.ts:94` |
| MGMT-COPY-003 | 时效总览状态图：部分时效待核实的生产单 | 固定6类状态图未列资料待核实生产单 | 图中类别数量可能不能覆盖列表范围 | 状态图由本范围实际health类别生成，包含资料缺失类 | `src/pages/production-fulfillment/order-pages.ts:152` |
| MGMT-COPY-004 | 监控列表 / CSV：一个任务有多个历史晚达标合同节点 | 当前工作超时N·历史晚完成N | 无法知道N是生产单、工作、阶段还是节点数 | 未完成超时工作N项·已结束但晚的计时项N项；CSV注明含合同节点 | `src/pages/production-fulfillment/order-pages.ts:130` |
| MGMT-COPY-005 | 监控列表 / 入库分析：整单已全量入仓 | 全程 下单至查看时点的自然日 | 已完成单的生产耗时仍随查看时间增长 | 下单至全量入仓；若最后时间缺失则实际全程耗时待核实 | `src/pages/production-fulfillment/order-pages.ts:132` |
| MGMT-COPY-006 | 监控列表：成衣仓已核实入库0件 | 最后入库时间待核实 | 0件且无入库记录看起来像遗漏了已发生的入库日期 | 尚无已记录入仓数量；有入库数量却缺最后时间时明确按期结果待核实；部分入仓最近时间与全量完成时间分别命名 | `src/pages/production-fulfillment/order-pages.ts:134` |
| MGMT-COPY-007 | 监控列表数量进度：工厂实领量未被后道收齐，或既有未分配也有工厂未回量 | 工厂未回 / 等待量与工厂未回量二选一显示 | 实领减实收不证明货仍在工厂；二选一掩盖并存数量 | 工厂实领、后道尚未实收；未下发车缝、后道加工、后道交出成衣仓待收分别表达 | `src/pages/production-fulfillment/order-pages.ts:135` |
| MGMT-COPY-008 | 工作项监控：已完成晚1天和未完成超时1天并存 | 逾期完成 / 当前逾期 / 按期完成 / 无超时 | 结束与未结束需业务人员自行翻译，未说明超时还是否在增加 | 已完成·晚X / 未完成·已超时X / 已完成·按期 / 未完成·截止未到 | `src/pages/production-fulfillment/order-pages.ts:57` |
| MGMT-COPY-009 | 工作项监控 / 来源详情：交接仅部分实收或采购到仓未全量接收 | 已完成 / 当前逾期（交接与采购同泛称） | 完成对象不清，部分接收易误解为完全未接收 | 已全部接收 / 尚未全部接收；已入面辅料仓 / 尚未全部入面辅料仓 | `src/pages/production-fulfillment/order-pages.ts:54` |
| MGMT-COPY-010 | 工作项监控 / 来源详情：执行结果待取得但下单时间与要求已知 | 未完成·截止未到（旧分支为尚未到期） | 缺执行事实被当成已确认未完成，至查看时点被当实际工作耗时 | 完成事实待取得·截止未到/截止已过是否超时待核实；实际完成耗时待核实 | `src/pages/production-fulfillment/order-pages.ts:57` |
| MGMT-COPY-011 | 工作项监控：开始时间缺失或标准未配置 | 实际开始待取得 / 标准待配置 / 不自行判逾期 | 没有说明缺哪项、无法判断什么，容易理解为暂时不监控 | 具体计时对象开始时间缺失·无法判定；标准未配置·仅显示耗时；列明判断依据不足 | `src/pages/production-fulfillment/order-pages.ts:157` |
| MGMT-COPY-012 | 工作项监控 / 团队与工厂 / 来源合同详情：工厂实领为空或业务分配日期缺失 | null被乘成0目标、NaN截止却显示尚未到期/达标 | 缺依据被错误当成已确认目标或正常状态 | 业务分配日期/工厂实领量缺失·合同节点无法判定 | `src/pages/production-fulfillment/order-pages.ts:57` |
| MGMT-COPY-013 | 工作项监控 / 团队与工厂 / 来源合同详情：工厂实领已核实为0件 | 0分母产生0目标，0或后续实收被认定节点达成 | 0是已知事实，不能标缺实领或零目标已达标 | 工厂实领为0，节点目标尚不能计算 | `src/pages/production-fulfillment/order-pages.ts:57` |
| MGMT-COPY-014 | 工作项监控 / 团队与工厂 / 来源合同详情：30%节点已经晚达标；70%节点尚未到期 | 逾期达成 / 当前欠0 / 当前欠 / 目标已达成 | 已结束节点看似仍欠货，未来目标被称为逾期欠量 | 已达标·晚X / 本节点已达标；未达标·截止未到·距本节点目标还差X件 | `src/pages/production-fulfillment/order-pages.ts:57` |
| MGMT-COPY-015 | 团队与工厂：部分任务实领未知、同厂任务数量汇总 | 实收/实领、项当前合同逾期 | 实收是哪方、实领是否全范围已知、是否厂级合同均不明 | 后道累计实收/已知工厂实领；项合同未达标且超时；部分实领待核实 | `src/pages/production-fulfillment/order-pages.ts:178` |
| MGMT-COPY-016 | 入库时效分析：已完成但最后入仓时间缺失、未完成单并存 | 整单按期入库率 | 易当成范围全部生产单按期完成率 | 已完成生产单按期入仓率（可判定）；分母为全量入仓且有最后时间的单 | `src/pages/production-fulfillment/order-pages.ts:192` |
| MGMT-COPY-017 | 入库时效分析：部分生产单入库量未知 | 成衣仓已知实收/应完成 | 读者可能用已知部分入库量得出全范围实际完成率 | 已知成衣仓入库量/全部采购应完成量；此合计不代表全范围实际入仓率 | `src/pages/production-fulfillment/order-pages.ts:192` |
| MGMT-COPY-018 | 采购待关联列表 / 来源商品采购详情：只有采购关联未取得，不知道是否已生产 | 没有有效生产单关联 / 待建单 | 缺关联被当成未建单或未生产 | 生产单关联尚未取得；是否已建单生产及入仓待核实，不表示未生产或未建单 | `src/pages/production-fulfillment/order-pages.ts:139` |
| MGMT-COPY-019 | 时效口径页：只读口径，没有可编辑设置 | 时效口径与配置 / 本轮确认口径 | 暗示可配置或修改已确认合同/阶段要求 | 时效口径（只读），本页不提供规则编辑，列明合同第N自然日当日23:59截止 | `src/pages/production-fulfillment/order-pages.ts:196` |
| MGMT-COPY-020 | CSV导出 / 下载提示：导出文件列名与状态栏 | 时效/业务状态/当前工作超时项/历史晚完成项/数量无单位；已导出 | 对象、计数范围和单位不清；发起浏览器下载被承诺已落文件 | 本工作时效结果/单据状态；件和项单位；已结束但晚的计时项含合同节点；已发起下载 | `src/pages/production-fulfillment/order-pages.ts:229` |
| MGMT-COPY-021 | 生产准备单详情 / 管理工作项：生产准备按单据已关闭结束 | 已关闭 / 关闭时间 | 可能被理解为作废或停止 | 准备已完成（单据已关闭）；准备完成/单据关闭时间 | `src/pages/production-fulfillment/source-document-detail.ts:98` |
| MGMT-COPY-022 | 各类来源单据详情：有开始/完成/标准但需要理解为何晚 | 时效结果只有逾期完成/当前逾期，没有应截止列 | 无法从实际开始结束一眼核对哪个要求被超过 | 列明应完成/接收截止，并显示已完成·晚X或未完成·已超时X；要求未确认显示黄色核实提示 | `src/pages/production-fulfillment/source-document-detail.ts:132` |
| MGMT-COPY-023 | 来源车缝任务分配合同详情：业务分配记录包含09:00时刻 | 截止=分配时刻+第N天-1ms | 比已确认分配日第1天的日末多1天且时刻混入，与图示不一致 | 复用calculateSewingReturnDeadlineDate，以第N自然日23:59:59.999为截止 | `src/pages/production-fulfillment/source-document-detail.ts:206` |
| MGMT-COPY-024 | 工厂产前版样衣来源详情 / 工作项监控：样衣晚交但审核未通过，或未交出 | 样衣结果（并排时效与审批混为同项）/尚未到期/按期交出 | 无法分清是否交出、是否晚交、是否通过；日期级要求误当精确小时 | 交样时效结果与样衣审核结果两列；已交出晚于要求日期/未交出已过要求日期 | `src/pages/production-fulfillment/source-document-detail.ts:231` |
| MGMT-COPY-025 | 物料采购/调拨/入库来源详情：本单使用600米库存、补采900米 | 本单库存采用 / 补采 | 容易把计划采用库存当已调出或下游实收 | 本单计划采用库存量 / 本单缺口补采量；计划量不等于实物接收进度 | `src/pages/production-fulfillment/source-document-detail.ts:175` |
| MGMT-COPY-026 | 上下游交接来源详情：数量差异字段或接收时间未取得 | 数量差异 / 待核实 | 差异方向未给依据，实收时间缺失可能仍被视为接收完成 | 已记录数量差异（原单口径）；实收数或接收时间缺失不能据此认定接收完成 | `src/pages/production-fulfillment/source-document-detail.ts:194` |
| MGMT-COPY-027 | 生产准备详情：未启用或需求变更结束的任务 | 不计当前欠项的准备记录 | 欠项可能被理解为欠货、责任遗漏或豁免时间 | 不纳入当前准备要求的记录；不计作当前未完成工作 | `src/pages/production-fulfillment/source-document-detail.ts:159` |
| MGMT-COPY-028 | 加工/裁剪单据详情：片数、米数及实完成量并存 | 应加工/数量；已完成；未完成 | 单据量和本项应加工量混用，易折算成成衣完成量 | 本项应加工/应裁量；实际完成量；尚未完成量；现场单位保留 | `src/pages/production-fulfillment/source-document-detail.ts:183` |
| MGMT-COPY-029 | 来源单据详情关联区：从监控点击单据 vs 从完整详情点关联单据 | 点击单据进入所在模块详情 | 与监控先摘要弹窗再新标签详情的动作容易混淆 | 本页为完整单据详情；监控图单据先摘要弹窗，查看详情才新建标签页 | `src/pages/production-fulfillment/source-document-detail.ts:264` |

## 文档逐项问题与历史冲突

历史16份文件在标题下加入明确历史范围与现行链接，保留原始规则、失败样本、截图和收据；不会把旧文本删掉或假装从未存在。当前V7更新现行规则与此后发布/本轮修订记录，原始版本日志按日期解释。本节逐条给出原位置和与现行规则的冲突。

| 编号 | 原文件/行 | 原文 | 误导/冲突 | 当前表达或处置 |
| --- | --- | --- | --- | --- |
| DOC-COPY-001 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:3` | 原PDA缺分配日期边界尚无存量对应场景；尚未产品接受或远端发布 | 与118/195/204已验证85样本和已发布main事实冲突，误判当前覆盖与发布状态 | 现有PDA车缝任务页及进度看板缺业务分配日期场景已验证；V7已发布main86593df8及Production；图示同宽比对和浏览器存储故障两项门禁仍阻塞。产品接受独立记录。（revise-current） |
| DOC-COPY-002 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:207` | 本次未提交/合并/推送Git或发布Vercel | 把已发布原型表述为仍未发布 | 2026-10-08已按用户授权合并main并推送GitHub，提交86593df8502d751362cdbab8676510bc233ef0b9；Production成功。发布回执不替代两个未关闭验收门禁。（revise-current） |
| DOC-COPY-003 | `docs/product-design/production-fulfillment-timeliness/v7-integration-plan.md:3,7,95` | 本地接入可评审；不发布远端；未提交、合并、推送或发布 | 实施计划头尾与已发布事实不一致 | V7项目接入版已发布；本文实施阶段的范围与原始验收结果保持历史，后续发布以回执为准，尚未关闭门禁仍保留。（revise-current） |
| DOC-COPY-004 | `docs/product-design/production-fulfillment-timeliness/v7-integration-plan.md:32,34` | 失败态待专项重放；源详情差额与F02图片失败态均有专项页面证据 | 同一工作包同一验收既待测又通过 | F02摘要及原详情图片失败态各5次已验证，按UI-012引用实际证据；未知采购缺图仍按真实边界显示。（revise-current） |
| DOC-COPY-005 | `docs/product-design/production-fulfillment-timeliness/v7-integration-plan.md:51,53` | 滚动及展开保留、三屏完整任务、素材失败态与打印仍待对应结果证据；剩余视觉门禁未关闭 | 与design186三屏、193打印、165失败态已验证冲突 | 三设备、展开及滚动恢复、F02图片失败态、25个PDF生成验证已有证据；严格同有效宽度像素比对仍阻塞。不能用PDF生成代替纸质打印。（revise-current） |
| DOC-COPY-006 | `docs/product-design/production-fulfillment-timeliness/v7-integration-plan.md:62,91` | WP4当前状态：已实现待验证；无已实现待验证行 | 工作包与106条矩阵显示不同交付状态 | WP4入口与筛选/图表/导出按对应PAGE行已验证；整体强一致与存储故障门禁仍由WP0/WP5/WP6负责。（revise-current） |
| DOC-COPY-007 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:42` | 列表专项按矩阵区分已采样与待验证 | 尚无待验证矩阵行却暗示列表仍待验 | 页面职责与最终原子验收以v7-integration-matrix.csv为准；本轮已验证项及两类阻塞明确分列。（revise-current） |
| DOC-COPY-008 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:204,200` | 未关闭门禁 下列CONTRACT-005：已验证 | 已验证项列在未关闭门禁会被读者当成仍阻塞 | 将CONTRACT-005放入已关闭门禁/已完成浏览器验证；未关闭门禁只保留BASE003/UI011、STORE005及依赖VERIFY001/002。（revise-current） |
| DOC-COPY-009 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:179,189,191,195` | 当前index-DSPY5QtO、原PDA、缺日期看板分支未实际遇到 | 历史版本记录被当成最新发布版本和当前未覆盖结论 | §8.1标注为集成阶段冻结证据，保留原bundle/样本；补已发布main版本及合并后证据链接。191说明该历史批次未覆盖，195为后续已闭环证据。（revise-current） |
| DOC-COPY-010 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:211,231,235` | 420件旧PDA交接Mock；原PDA；本轮未发布 | 用户已明确不理解“旧PDA”，暗示废弃系统；变更记录没有明确与当前状态区别 | 当前叙述统一“现有PDA车缝任务执行页”；420件明确为既有演示交出记录，不是正式后道实收；231/235属于发布前历史记录，头部指向最新发布状态，不重写历史证据。（revise-current） |
| DOC-COPY-011 | `docs/product-design/production-fulfillment-timeliness/v7-integration-plan.md:71,91` | 浏览器失败／冲突及旧资料保留证据独立待验证 | 已知实际失败/冲突被拒绝却仍含糊待验证；旧资料保留和迁移混为验收 | 普通保存已验证；实际浏览器写入失败/冲突验证已阻塞；本轮旧资料只保留，不执行迁移或清理；空旧库证据不能推定非空迁移完成。（revise-current） |
| DOC-COPY-012 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:67,78,134` | 当前超时和历史逾期；逾期完成为历史延误；准备历史晚1天 | 缺直接业务文案示例，容易复用成“无当前逾期+逾期完成”视觉冲突 | 明确分成“仍未完成，已超时X”“已完成，晚X”；阶段已完成但晚时优先显示完成事实及实际时间；禁止无范围的绿色“无当前逾期”与红色历史标签并列。（revise-current） |
| DOC-COPY-013 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:78,141` | 合同节点逾期达成；当前欠量为0 | 未说明已达成节点仍可晚达成，不代表未来节点均达标 | “30%节点已达成，晚12小时；要求X时，实际Y时；该节点当前差额0件”。未来节点分别显示未到期/到期未达成。（revise-current） |
| DOC-COPY-014 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:94,135` | 无当前合同逾期；回货正常／无当前合同逾期 | 读者把局部合同当前状态理解成整单及未来一定按期 | “已到期合同节点均达标，后续节点未到期”；有历史晚达成须同时写具体节点已达成晚X；整单截止、入仓结果及预测另列，不使用全局“正常”。（revise-current） |
| DOC-COPY-015 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:92,94,138` | 已全部入库／按期结果待核实；整单按期把握待核实 | 已完成的按期结果缺时间与未完成的预计按期把握不是一个待核实 | 数量已全入库且最后时间未知：“已全部入成衣仓，最后入库时间待核实，按期结果暂不能判断”；尚未完成且无可靠预计：“尚未全量入库，预计全部入库时间待核实”。（revise-current） |
| DOC-COPY-016 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:136,137` | 全部按期入库；全部入库／历史逾期 | “全部按期”易解释为全部工序无延误；“历史逾期”未说明整单还是单项 | “全量入成衣仓，整单按期完成”；“全量入成衣仓，整单晚1天6小时”。各单项历史晚完成仍保留；整单结论不覆盖单项。（revise-current） |
| DOC-COPY-017 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:108,110` | 真实历时及标准待配置；制作/交接未发生不启动 | 配置一词让只读口径页的用户以为能自行配置；未发生和缺记录同样显示空值 | “已用X，时效要求待确认，暂不能判断是否超时”；明确已知尚未开始/尚未交出与开始或交出时间未记录，不能互相替代。交接已接收与全部应交数量收齐另列。（revise-current） |
| DOC-COPY-018 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:51,108,149` | 采购下单→面辅料仓入库8天；面辅料供给 | 阶段名可能把采购8天误读为所有调拨加工合计8天 | “每笔补采：本笔物料采购下单→面料仓/辅料仓入库，8自然日”；库存调拨、后续加工、工厂交接各按自身事实和已确认要求显示，不套8天。（revise-current） |
| DOC-COPY-019 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:100,147,148` | 物料需求＝本单库存采用＋本单补采；确认可用600 | 本单库存采用可被看成已调拨或已实收；采购已下单可被看成已可用 | 把需求/采用/补采承诺与实际入库/调拨交出/下游实收分开，库存采用600米并不直接等于工厂已实收600米；“本环节实收600米，补采900米尚未入仓”。（revise-current） |
| DOC-COPY-020 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:98,102,149` | 工厂尚未回；后道实收量 | 未回可能误作分配量减回货，实收又可能误作成衣仓已入库 | 图例明确工厂尚未回＝实际领料且尚未被后道正式实收的任务数量；后道实收≠成衣仓入库；分配未领另列；分母分子都带本任务范围。（revise-current） |
| DOC-COPY-021 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:120,144` | 领料第3天要求；样衣未通过不阻断 | 未区分样衣交出/接收/审核；无时分秒要求却显示小时超时可能误判 | 样衣标“要求交出日期”“实际交出”“下游接收”“审核结果”；晚交按已确认日期口径表达，未确认小时截止不判小时超时；审核未通过不改变合同回货节点。（revise-current） |
| DOC-COPY-022 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:124,153` | 超时影响范围；差额600片待确认 | 已完成历史晚被当成现在仍阻塞；差额可能当物流丢失或折算成成衣缺数 | 当前仍未完成超时→已明确关联的下游对象；已完成晚→历史影响追溯；交出3000片/实收2400片/剩余600片接收或差异待核实，不擅自判运输损失，不折为600件。（revise-current） |
| DOC-COPY-023 | `docs/product-design/production-fulfillment-timeliness/product-design.md:3,5,7,11,17,82,84,262,305,454,458,504,539,631,637,675,715,758,805` | V4当前状态/通用业务规则继续有效/下单到实发/每来源独立T0/所有规则连续24小时/可编辑发布/200ms | 历史综合V1—V4产品设计，含当时来源与失败证据；不能再作为现行业务规范 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-024 | `docs/product-design/production-fulfillment-timeliness/implementation-plan.md:3,5,11,33,63,82,83,101,120` | 当前权威来源为product-design第21节与dependency-v4/实发未接通/配置发布/200ms/当前没有获得产品接受不提交部署 | 历史V4计划及当时验收，不是V7当前实施计划 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-025 | `docs/product-design/production-fulfillment-timeliness/source-alignment-v3.md:3,5,9,24,25,34,37,47,88,95,109` | 本文件是当前版本增量/当前任务用电脑读取时点/需求粒度/来源关联保存/保留多层Tab/200ms | 历史V3增量规范，不能继续覆盖V7固定场景时点与同屏图示 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-026 | `docs/product-design/production-fulfillment-timeliness/dependency-revision-v4.md:3,7,12,14,16,17,18,36,73` | 当前实施中/默认依赖图/查看来源页面与需求列表/独立运输计时/可发布规则/200ms/final5当前 | 历史V4整改规范及阶段结果，不能据此恢复被撤销菜单/写入入口 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-027 | `docs/product-design/production-fulfillment-timeliness/information-architecture-v2.md:3,9,10,11,12,15,21,22,23` | 任务详情六个页签/工作抽屉多个Tab/独立规则验证示例 | 历史V2信息架构，V7用户明确一页三角色同屏图示，不恢复旧详情拆分 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-028 | `docs/product-design/production-fulfillment-timeliness/business-review-v1.md:3,7,11,27,28,43,45` | DEM任务详情/需求下达已用/有效生产需求与实发/保留现有路由/本版用于本地看效果 | 历史2026-10-07业务第一版及发布过程；不是本轮生产单监控主时钟和菜单 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-029 | `docs/product-design/production-fulfillment-timeliness/mock-scenarios.md:1,3,7,19,51,53,55,59,67,94,110,115` | 冻结Mock完整任务实例/24天/整批等待/发货后订单/曾逾期1天 | 历史V1/V2算例，不是V7 20场景数据集；历史术语和数量保持原字节 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-030 | `docs/product-design/production-fulfillment-timeliness/work-item-catalog.md:1,3,5,14,18,30,32,41,43,60,63,70,71,80,85,91,95` | 77候选动作/运输考核/准备候选5天/辅助候选3天/90%/组计时/成衣入库不是实发终点 | 历史V1/V2目录；不能把候选时长/默认系统齐套/运输/发货作为V7现行要求 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-031 | `docs/product-design/production-fulfillment-timeliness/requirements-index.md:1,3,5,16` | 259条适用项已验证/CSV为正式追踪表 | 历史V1索引，259条全部通过已在V2撤回，不是现行327更不是V7106条 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-032 | `docs/product-design/production-fulfillment-timeliness/source-index.md:3,12,15,20,26` | 设计事实来源main4804328/工程准备文件/旧周日例外/用户本轮实发关联订单 | 历史2026-09-17源码/资料引用索引。文件名属于当时技术证据，不表示当前PCS业务仍叫工程 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-033 | `docs/product-design/production-fulfillment-timeliness/design-review.md:3,9,14,19,49,53,56,57` | 本次设计核验/实发D24/客户订单/未来200ms/全部260待实施 | 历史2026-09-17设计核验回执。原始测试和接受状态须保留，不当作当前待做清单 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-034 | `docs/product-design/production-fulfillment-timeliness/implementation-review.md:1,38,47,59` | V1历史当前状态见V2/当前未提交/259已验证 | 历史V1验收回执，首段已撤回，但当前链接只指V2仍易误读，应改指现行V7并保留原259历史声明 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-035 | `docs/product-design/production-fulfillment-timeliness/implementation-review-v2.md:3,7,10,14,15,21,23,43,45,49` | 当前信息结构/未发布/实发订单/配置发布/当前274矩阵 | 历史V2页面重整回执，版本与失败/通过范围保持原样 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-036 | `docs/product-design/production-fulfillment-timeliness/review-v2-findings.md:3,9,19,31,43,59,141,143,144,145,150` | 用户最新业务修正/本次不应破坏规则/实发与取消/运输独立 | 历史V2审阅意见，针对当时规范；现行已排除的能力不是本次待修缺项 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-037 | `docs/product-design/production-fulfillment-timeliness/review-v2-resolution.md:5,35,50,62,70,72,76` | 最新核查为final5/V4当前业务核查/当前327/当前运行服务 | 历史V2—V4处置回执，不能把其源缺口/版本作为V7当前状态 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-038 | `docs/product-design/production-fulfillment-timeliness/main-publication-20260918.md:3,8,15,31,33` | 本次当前DDS原型发布/当前327/本次发布性能失败 | 明确历史2026-09-18发布回执；原始性能失败不能被新版本覆盖，也不能误判2026-10-08发布仍失败 | 在标题下加入明确历史声明：本文记录对应日期的V1—V4需求/设计/验证，文中“当前/本轮/最新”均指当时；现行业务以[v7-integration-design.md]为准、实施以[v7-integration-plan.md]和[v7-integration-matrix.csv]为准。冲突条款仅供追溯，原证据、失败样本及冻结算例保持原文。（history-banner-and-current-link） |
| DOC-COPY-039 | `docs/product-design/production-fulfillment-timeliness/product-design.md:17,33,35,91,113,150,183,305,316,398,408,458,471,487,502,546,607,637,643,688` | 从下单到实发/全部实发终点/订单及时率/订单履约分析 | 现行监控终点只到全量入成衣仓；消费者发货与订单取消不纳入本模块 | 最早商品采购下单+28自然日→全部应完成数量入成衣仓；菜单为入库时效分析。（history-conflict-map） |
| DOC-COPY-040 | `docs/product-design/production-fulfillment-timeliness/product-design.md:82,84,93,739` | 生产任务＝每个采购/需求1:1；合并保留每来源各自截止 | 现行以生产单唯一对象取最早商品采购单，不是需求分行计数 | 一张生产单一行，可关联多采购；取最早下单统一截止，采购不允许拆分到多生产单。（history-conflict-map） |
| DOC-COPY-041 | `docs/product-design/production-fulfillment-timeliness/product-design.md:120,132,174,175,181,243,247,248,250,256,389,419,627,690` | 运输/转运/审版等待/返工单独监控/取消减量 | 用户明确运输、审版、返工暂不跟踪；交接仅上游交出到下游接收；消费者取消不调分母 | 仅显示制作/加工与交接独立时钟及源质检结果；不新增运输/审版/返工考核。原商品采购应完成量作为基准。（history-conflict-map） |
| DOC-COPY-042 | `docs/product-design/production-fulfillment-timeliness/product-design.md:262,281,283,291,758,759` | 所有自然日连续24小时；准备5天待确认；印染候选3/5天 | 整单/阶段连续加天和合同按业务日期第1天不是统一一个算法；不能重开已确认选择 | 整单下单时刻+28天；准备无定位印4/有定位印5；物料本笔采购下单至面辅料仓入库8；辅助每道3；合同分配日第1天三类型不同节点。（history-conflict-map） |
| DOC-COPY-043 | `docs/product-design/production-fulfillment-timeliness/product-design.md:145,155,163,164,320,363,623` | 齐套满足自动可执行/规则自动分批放行 | 人工裁片放行事实不能由系统决定；已知库存批可先行不必须整单等待 | 是否放行读取裁片放行管理人工事实；现货批/采购批分别展示实际单据和进度。（history-conflict-map） |
| DOC-COPY-044 | `docs/product-design/production-fulfillment-timeliness/product-design.md:181,454,516,650` | 正常、完成但曾逾期；主状态优先级；绿色完成叠红历史 | 未完成当前超时与已完成晚混合，正是本次用户困惑 | 在现行V7明确两轴：是否完成+是否按期；已完成晚X配实际完成时间；仍未完成超时X配应完成时间和剩余量，不使用无范围正常结论。（history-conflict-map） |
| DOC-COPY-045 | `docs/product-design/production-fulfillment-timeliness/product-design.md:491,504,505,529,548,550` | 切换依赖辅助视图/六组详情Tab/规则验证示例 | 与已认可同屏图示和删除旧路由冲突 | 现行一页固定信息顺序＋阶段原位展开＋单据本页摘要＋详情新标签；历史Tab和/tasks兼容不恢复。（history-conflict-map） |
| DOC-COPY-046 | `docs/product-design/production-fulfillment-timeliness/product-design.md:615,619,621,623,625,631,696,699,817` | 时效规则、映射、责任可编辑发布/当前用户明确要求能力 | 现行只读口径页，不允许新增保存来源关联或规则发布 | 时效口径与配置只读显示已确认口径/适用合同；排除本轮修改保存，旧浏览器资料保留。（history-conflict-map） |
| DOC-COPY-047 | `docs/product-design/production-fulfillment-timeliness/product-design.md:675,719` | 电脑当前读取时点驱动asOf；冻结快照只在旧算例 | V7当前20场景固定2026-10-07 09:00，不能刷新把同一Mock变成新超时 | 演示核实时点固定；浏览器读取时点另标，登记跟进真实时间不修改演示时钟。（history-conflict-map） |
| DOC-COPY-048 | `docs/product-design/production-fulfillment-timeliness/product-design.md:715,742,754,798,859,867` | 当前全部<200ms才通过/当前33需求或327矩阵/最新final5 | 历史门槛/状态不能当作当前V7<=1000ms及106矩阵 | 历史技术结果留原样；现行门槛/覆盖/未关闭门禁按V7矩阵和最近发布证据，不能把旧技术失败消为通过。（history-conflict-map） |
| DOC-COPY-049 | `docs/product-design/production-fulfillment-timeliness/requirements-index.md:3` | 259条适用项已验证 | 这一总体结论已经V2明确撤回，历史声明若不讲撤回仍误导 | 明确“V1当时索引曾声称259已验证，该总体结论已于V2撤回；本表仅保留历史编号和章节关系，现行106条V7矩阵独立追踪”。（history-banner-and-current-link） |
| DOC-COPY-050 | `docs/product-design/production-fulfillment-timeliness/source-index.md:12,13,15,26` | 生产准备工程代码名称/本轮实发确认客户订单 | 旧技术文件名不应继续成为业务名或现行行为规范 | 历史代码标识保持原引用；业务统一生产准备单，当前来源为V7静态登记及适配详情；发货关联客户订单属于旧范围且已排除。（history-banner-and-current-link） |
| DOC-COPY-051 | `docs/product-design/production-fulfillment-timeliness/v7-integration-design.md:13,215,235` | 业务文案不得自行改写/原19业务语义未改 | 用户现在明确授权全部歧义文案修复，应登记为允许的必要业务纠错，而不是强一致违规 | 本轮仅修表达歧义，单号以外的时间、数量、人员、对象关系、合同和图形结构保持；文案差异登记到新问题清单，已认可原图作为修复前基线，不改原证据。（revise-current） |


## 验证与交付边界

逐项完整证据由矩阵及 [本轮原型审查回执](../../prototype-review-records/2026-10-09-production-timing-copy-clarity.md) 定位。场景静态字段只改文案，ID/类型/数量/时间/关联/人员未变，详见fixture-copy-only.json。图示结构、样式、路由及交互保持；源合同截止显示修正为已经确认的分配日第1天日末规则，未知依据不再制造假正常。

本轮不保存跟进、不写测试库、不清空浏览器资料、不迁移任何模块。原V7的同宽像素比对和实际存储故障仍为独立未关闭门禁；本轮文案修复不宣称原V7已完整验收或产品已接受。当前本地增量尚未推送发布。
