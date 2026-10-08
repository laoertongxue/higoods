# V7 生产单时效图示接入实施计划

日期：2026-10-08（接入实施日志）。接入基线已发布main 86593df8502d751362cdbab8676510bc233ef0b9并确认Vercel Production成功；接入整体验收仍有独立门禁未关闭，发布不等于产品接受。下文工作包、资源哈希和样本记录各自的历史版本。2026-10-08至09用户授权的文案歧义修复为新的本地增量，状态、109条问题及当前验证版本以[文案实施计划](copy-clarity-plan-20261008.md)、[文案追踪矩阵](copy-clarity-matrix.csv)和[本轮回执](../../prototype-review-records/2026-10-09-production-timing-copy-clarity.md)为准。业务定义以 `v7-integration-design.md` 及用户最新确认为准；原接入门禁继续使用 `v7-integration-matrix.csv`，不得用本轮清单覆盖原始证据。

## 1. 范围与依赖

本轮负责 DDS 生产与履约时效、共享静态单据登记、图示所需原模块详情适配、共享回货日期口径及继续跟进的本地保存。原模块原有列表与全量业务数据未整体接入这些登记记录；不把原详情直达可读表述为原模块全流程已经办理。已有其他模块功能不重构，不接后端、不操作测试数据库、原接入实施时未发布远端；其后用户授权发布已完成，见本文件最新发布记录。

继承 Vite＋Vanilla TypeScript 字符串模板和现有列表组件。事实来源为 `src/data/production-timing/fixtures.json` 和 `source.ts`，图示与原详情共同读取登记记录；只有精确匹配已登记 native 单据 ID 才进入详情适配，其他记录保持原模块处理。

认可基线19场景＝18张生产单＋1条采购待关联。已增加独立交接差额场景，当前实际20场景＝19张生产单＋1条采购待关联，共1,761张登记单据；补充场景不替换或改写原19场景事实。BASE-003要求“除具体单据号外，其他能一样的尽量一样”，最终以信息顺序、图形结构、业务文案、时间、数量、人员、展开和跳转的逐项比对验收。

依赖顺序：基准登记 → 静态单据事实与共享规则 → 图示详情 → 模块入口 → 旧写入收口及继续跟进 → 当前版本完整验收。各工作包只能关闭已经有直接证据的子项；当前证据边界、最新版本与剩余门禁按设计 §8.1、§8.2 和矩阵执行。

## 2. 实施工作包

### WP0 基准和范围登记

- 业务目标：把设计强一致变成逐区域及逐场景可检查的约束。
- 实现位置：本设计、计划、矩阵；认可 `production-timing-business-v7-display-final.html` 及其SHA256；`production-order-diagrams.ts/.css`。
- 已落修改：登记固定基线、原19场景和额外1场景，明确唯一可变的单据／关联ID及必须保持的业务事实；补充BASE-003和SCENE-20。
- 验证证据：`baseline-dom-comparison.json`／`baseline-text-differences.json` 已记录原19场景DOM与文本差异；808／1054 px并非同有效宽度，不算像素通过。同宽截图所需基线resize在用户新授权后仍被自动审批拒绝，原因是 saved user permission setting blocks raw CDP on localhost61122，UI-011保持已阻塞，不换途径绕过。
- 当前状态：基准登记已验证；严格同宽像素门禁已阻塞，工作包尚未关闭。完成条件：基准、范围和所有规范章节可双向追踪，差异均有业务依据。

### WP1 来源 Mock 和单据详情关系

- 业务目标：19张生产单及1条待关联采购的图、弹窗和原模块详情读取同一记录。
- 实现位置：`src/data/production-timing/fixtures.json`、`source.ts` 的 `findTimingCase`、`getTimingBranch`、`findTimingDocument`、`timingDocumentHref`；`source-document-detail.ts` 的 `resolveTimingSourceDetail` 与分类单据详情；`src/main.ts` 的登记详情接入。
- 已落修改：唯一ID登记采购、准备、物料来源批次、加工、交出／接收／质检、合同、实领、后道实收及入库；保留未知资料；加入SCENE-20袖片交出3000片、实收2400片、差额600片待确认。
- 详情边界：登记路径采用PCS／PMS／FCS／WLS原模块地址；适配页包含对应对象明细、时间、数量、责任及关联记录。此接入不把记录整体追加到各原模块既有列表，也不新增完整业务办理流程。未登记ID不能借同款、同厂或示例详情冒充。
- 已补：仅SCENE-20 A01纽扣9,000粒登记中转接收／人工配料／裁床领料三单，09-20 16:00实收、16:20—16:40配料、16:50交出／17:00实领；调拨单同步接收人为中转仓林芳，并关联WLS receive-manage／allocation-manage／outbound-manage。原19无证据仍待核实，不倒推单据。
- 素材：`src/data/production-timing/material-images.ts`、`public/images/production-timing/material-effect-sources.json`；款式实图、F01 PCS原料示意、F02及A01—A03原型效果图明确来源与Mock边界，图／摘要／详情对应识别。正常预览与F02失败态已有专项页面证据，见本工作包验证记录。
- 验证证据：`tests/unit/production-timing-scenarios.test.ts`、`production-timing-source-detail.test.ts`；C5版本 `native-pcs-pms-browser.json`（11页）、`native-wls-browser.json#stableBuild`（7家族）、`native-fcs-browser.json#finalSummary`（22家族25代表）已绑定同源字段、冷刷各5及真实关联新标签；历史失败保留。最新加工剩余量5代表各刷新5已通过，见native-fcs-browser.json#affectedFinalRefreshes。
- 当前状态：已验证的登记关系及中转三单按矩阵关闭；源详情差额与F02图片失败态均有专项页面证据。完成条件：关联、未知及图片门禁满足，静态读取无种子落盘，无假关联或无关详情。

### WP2 生产单读取及业务计算

- 业务目标：整单、局部时效和资料完整性结果独立且跨页面一致。
- 实现位置：`source.ts` 的 `getTimingFacts`、`timingReceiptTotal`；`production-order-diagrams.ts` 的准备／采购／辅助工艺时钟、合同节点、样衣及影响结果；FCS `sewing-return-calendar.ts`、`sewing-delivery-sla.ts`、`sewing-outsourcing-return-tracking.ts`、`runtime-process-tasks.ts` 和 `pages/sewing-outsourcing/returns.ts`。
- 已落修改：最早采购＋28自然日、原应完成量、仓库完成与最终时间分离、数量位置守恒及未知；合同日历含星期日，业务分配日为第1天。实际接单时间仍保存原事实，缺业务分配日期不回退接单时间；历史快照不静默重写，当前投影明确待核实。
- 规则：准备4/5天、物料采购8天、辅助每道3天；合同4/8/9、5/9/10、6/9/12，分母任务工厂实领、分子归属该任务后道实收；产前样衣日期要求与回货独立；无标准不判逾期，无可靠预计依据不推整单必晚。
- 验证证据：场景及来源详情专项；`sewing-return-business-start.test.ts`、`ppic-counting-calendar.test.ts`、`ppic-duration.test.ts`、`ppic-reference-quantity.test.ts`，相关分配／回货专项；当前原始构建日志 `docs/prototype-review-records/production-timing-v7-evidence/final-build.log` 为532 tests／532 pass／0 fail，含合同自然日、业务分配起点、旧快照及PDA／进度看板缺日期防假完成专项。C5原合同详情三类型日期／数量均已比对；旧回货/看板已知日期各5通过，最终PDA25样本最大884.2ms；CONTRACT-005当前已实际原生PDA及看板验证，85完整样本见missing-date-acceptance-final.json；旧交接Mock不代替正式后道实收。
- 当前状态：按矩阵已验证；当前CONTRACT-005完成，旧数据事实源边界单列。完成条件：直接业务断言及受影响入口一致，读取不修改源事实。

### WP3 图示详情正式接入

- 业务目标：应用外壳内复现认可V7，一线、主管和高管同屏读图。
- 实现位置：`production-order-diagrams.ts/.css`，`index.ts` 的 `renderProductionFulfillmentPage`、阶段展开、摘要、全屏及打印；`events.ts` 的局部事件入口。
- 已落修改：九个信息区、数量位置图、阶段摘要、准备／物料／裁片展开链、合同菱形及实际达成历史区间、工厂样衣、影响图和跟进清单；具体单据本页摘要，查看详情新建浏览器标签；Base64款式图转静态资源。
- 已落审查修正：当前采购逾期与历史卡分别着色、场景身份说明完整、未知对象数按源数据表达、交接读取实际交出／实收／差额，不固定差异0。必要业务纠错须与基准差异单列。
- 待验收：同有效宽度对照仍已阻塞；补充场景沿用图示规范。图示阶段、定位、单据摘要／关闭／Esc、款式预览和全屏进出已有每项5次以上动作；滚动及展开保留、三屏任务、素材失败态与打印已有对应证据，按设计§8.1引用，不用动作计时代替。
- 验证证据：场景渲染／字段契约通过；`graph-loads-final.json` 最新VIsb9cR6 20场景冷加载／刷新各5共200样本，最大233 ms、图片失败/溢出0；`browser-performance.json` C5冷加载／刷新／SPA最大145.6／89.2／37.3 ms保留，`browser-actions.json` 172原始动作及源详情专项按设计§8.1绑定。
- 当前状态：图示、命名轻交互与正常图片预览按原子证据登记，严格像素一致和剩余视觉门禁未关闭。完成条件：结构、事实和交互忠实基准，无iframe、全文替代或角色分页。

### WP4 本模块各入口统一

- 业务目标：总览、列表、跟单、工作、工厂及入库分析进入同一生产单图示。
- 实现位置：`order-pages.ts/.css` 的 `renderOrderModulePage`、`workRows`、`orderRows`、`matchingCases`、`exportCsv` 和列表事件；`index.ts/events.ts`、`app-shell-config.ts`、`router/routes.ts`、`main.ts`。
- 已落入口：生产单列表／详情 `/dds/supply-chain/production-fulfillment/orders[/<id>]`；采购待关联 `/pending-purchases[/<id>]`；入库分析 `/inbound-analysis`；保留总览、我的跟单、工作项、团队与工厂和只读口径页的职责。旧DDS `/tasks`、`/fulfillment` 注册不保留兼容别名，FCS过渡需求保留。
- 已落修改：按生产单去重，19张生产单与1条待关联分区；当前、历史和资料结果分开；筛选、列表、图表和导出共用查询范围。来源绑定与规则修改能力本轮排除，口径页只读显示已确认规则。
- 验证证据：新旧入口扫描及源码断言；`module-loads-final.json` VIsb9cR6八入口冷加载／刷新各5共80条，最大495.9 ms、无图片失败及溢出；`module-list-recovered-actions.json` 210动作最大126.8 ms。查询语义与列顺序拖动已核对；最新CSV40次实际下载全部结果最大367ms，文件内容逐份通过，PAGE-009已验证。
- 当前状态：按V7矩阵已验证。完成条件：入口语义和图示事实闭环，无旧发货域调用和隐藏写入。

### WP5 继续跟进与旧写入收口

- 业务目标：静态读取不造业务事实，继续跟进可保存，原浏览器资料受保护。
- 实现位置：`index.ts/events.ts` 和 `order-pages.ts` 的只读口径、已排除动作；`src/pages/production-fulfillment/timing-followups.ts` 的 `renderTimingFollowups`、`handleTimingFollowupClick`、`handleTimingFollowupField`，复用 `followup-storage.ts` 的 `loadFollowups`／`saveFollowup`。
- 已落边界：排除来源绑定和规则修改，当前入口停止旧写入；旧来源绑定、配置、资料事项和旧跟进原记录不删除、不迁移、不清空。旧需求主键无法证明唯一归属时不猜映射、不分发到多单。
- 已落实现：以生产单归属按记录写IndexedDB，事务complete后再读回确认；未保存草稿与业务实际登记时间单独标识，预计时间仅为反馈。稳定操作ID避免重复，版本冲突要求重新读取，保存失败保留输入，不回退业务localStorage。
- 验证证据：7项 `production-timing-followups.test.ts` 已在532通过日志内；`followup-browser-normal.json` 普通保存5次读回确认，`followup-browser-refresh.json` 5次刷新读历史且空输入未保存，`followup-browser-final.json` 修复后关闭重开／连续保存5组通过，`followup-browser-newtab.json` 独立读出15条记录。浏览器故障注入曾被自动审批拒绝（user declined），用户重新授权后临时注入重放仍被saved user permission setting拒绝，STORE-005现仍已阻塞；不将单元失败契约当浏览器故障已通过。5次普通读取不写、旧键与现有库哈希不变已有记录；当前旧库为空，不能证明非空旧资料迁移。
- 当前状态：普通跟进保存与读回按STORE-003已验证；浏览器故障/冲突依STORE-005仍阻塞。旧资料保留证据仅说明未清理，不能证明非空旧资料迁移。本轮不执行旧源清理或迁移，不能将保留原资料标成迁移完成。
- 完成条件：当前范围不写业务localStorage、不长期双写；跟进确实持久并可恢复，原数据保留，无PCS资料维护工具新增。

### WP6 最终验收、审查与交付记录

- 业务目标：以最终项目版本证明强一致与20场景覆盖，区分实现、验证、接受和发布。
- 实现位置：`production-timing-scenarios.test.ts`、`production-timing-source-detail.test.ts`、回货日历及业务分配起点专项；主代理原型审查记录、浏览器证据、素材清单和矩阵。
- 未关闭证据：同宽像素、真实浏览器故障；现有PDA车缝任务执行页缺日期实际场景当前已闭环；其它最终增量及历史适用证据见设计§8.1。已取得的计数、原始单元／构建日志、20场景、各native家族、新标签、图片及动作样本按矩阵直接引用，不能重复用旧版本假通过。
- 性能门禁：冷加载、刷新、站内切换及全部适用交互每项至少5次，任何原始样本<=1000ms；计到数据、计算、图片和渲染完成，不复用独立V7性能样本。
- 项目门禁：共享事实、菜单、路由总入口已改变，最后修改后补受影响专项、构建和任务边界检查；CodeGraph状态及索引同步结果按现场记录，不凭开工状态宣称最终通过。
- 当前状态：实施中。完成条件：所有负责原子需求有当前实现、自动化及命名页面证据，无漏场景、假链接、缺图、错误日期／数量和性能缺口；产品接受与发布另有回执。

## 3. 当前回执与剩余条件

20场景、19生产单＋1采购待关联、1,761单据；原19业务语义、图示和CSS本轮未改。当前 `index-DSPY5QtO.js`、HTML SHA256 `f1c7dc5e8b80e9e9415042bfb39da3132c7b922dfb37bdac703ca1ed8d19a898`，532单元及构建通过，真实服务工作树一致。

原生缺日期800件任务复用既有 TASKGEN-202603-0007-002__ORDER，静态登记而不首访落盘。DSPY5QtO 最后源码变更后，PDA冷5/刷5/列表进入5、已知日期PDA冷5/刷5，两任务看板列表/详情各冷5/刷5、进度Tab各5、列表进详情各5，合计85完整原始样本全部≤1000ms，最大842.9ms。缺日期显示待核实，不以空节点判完成，不把分配量当实领或计划单当已交出；已知日期仍为07-04/08/09截止。详见 missing-date-acceptance-final.json 及6份原始JSON。

本轮修复包括：PLANNED回货单不生成已准备/已交出数量；缺业务分配日期显示待核实；TASKGEN实际独立车缝采用同runtime单任务读取及原详情渲染器，不构建无关全域清单。必需PCS/FCS读取、处理器、认证、工厂权限与query解释保持。专项先验证全域枚举失败，再修复并核对完整清单逐字段等价；旧慢样本、CPU和选择器/样本写入诊断全部保留。

矩阵106条：101已验证、5已阻塞，无已实现待验证行。BASE-003/UI-011同宽像素和STORE-005真实浏览器存储故障仍为两个独立未关闭条件；VERIFY-001/002依赖完整证据，仍阻塞。CSV此前已实际通过。WP2缺日期边界已验证，WP0与WP5仍未关闭，WP6总体未完成。

用户报告设置已解除限制且CDP开启后，两动作实际重试仍被拒绝。只读核查确认全局 full_cdp_access_enabled=true，而当前会话 full_cdp.denied 仍包含 localhost:61122 和 127.0.0.1:4179；会话拒绝优先于全局允许。当前安装版本没有找到核实有效的会话重置UI，不能承诺重启可解决。不修改权限文件、不换origin/浏览器/复制基准绕过，故障钩子未安装。具体原始拒绝与诊断见 permission-after-user-settings.json、permission-conversation-diagnosis.json。

原生已知日期任务的420件现有PDA车缝任务执行页交接Mock不构成正式后道实收确认；本轮正常分支验证限定为日期和合同节点，不伪造正式回货、不扩张全旧数量迁移。临时只读计时探针、缓存及viewport覆盖已撤销，未提交实际业务动作。最后冻结后技术收据覆盖全部明确任务文件；技术检查通过也不抵销两个浏览器门禁。未提交、合并、推送或发布。


## 4. 此后发布与文案修订记录（当前状态优先读此节）

2026-10-08 用户授权的 main 合并与推送已完成：本地/远端/GitHub main 为 `86593df8502d751362cdbab8676510bc233ef0b9`，精确SHA对应 Vercel Production 成功，部署ID 6938991820。接入前记录中的“未提交/未发布”仅指其记录时点；不把发布成功等同于两项浏览器门禁关闭或产品接受。

本轮新增全部歧义修复由 [文案实施计划](copy-clarity-plan-20261008.md) 与 [文案追踪矩阵](copy-clarity-matrix.csv) 独立追踪；现行文案按该清单执行。既有缺分配日期已闭环；未关闭门禁只有同宽像素和实际存储故障及依赖总体项。本轮本地增量尚未发布。
