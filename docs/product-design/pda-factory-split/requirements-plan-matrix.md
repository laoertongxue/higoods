# 中央工厂 / 三方工厂 PDA 拆分

## 范围、继承与阶段

本记录承接用户的完整拆分目标。初始基准为 main `6169496a675799802faee12b274eda39f196247d`；后续已同步到 `caa7b286bde449c12f226c7434072b1fe8f7221c`，旧证据保留原版本。当前已快进同步到 `fc3283f6286e943e66d2b0c7f91cab88571b85ae`（独立WLS出库更新，135个任务文件字节完全保留，原证据仍绑定各自旧基准）。 本轮进一步快进同步到 `a1000e145cf57371de75f4f334e30e8cd38d91de`（后道QC发货优先级及完整辅料仓场景）；251个当前任务路径已逐字节备份并校验，除main.ts合入原上游新增入口外，其余250个任务路径字节一致。没有新增任务提交、推送或部署；旧证据保留fc3283身份。实施工作树为 `publish-newpda-v34/higoods`，分支 `codex/pda-factory-split`。参考页面为 `https://higood.12lab.cn/newpda/` V34。参考设计已发布不等于本拆分已实施。上轮参考站的图片性能结果保留原身份，不当作新业务页面的性能证据。

目标：红框两组菜单分别改为中央工厂 PDA、三方工厂 PDA。中央工厂重新编写页面与交互，直接调用当前项目的业务读取和命令，不复制旧 PDA 页面或静态稿的示例业务账。三方工厂只支持车缝、车缝+烫包、裁剪+车缝+烫包，包含属于该类的卫星车缝厂，且没有仓管。中央工厂只有接收、执行、仓管；不提供接单、竞价、开工、工厂入驻等动作。

优先级：本次明确要求 > 当前项目有效业务规则 > V34 的业务示例。V34 用于布局、动作组织、小屏、语言及连续作业设计；数量单位、状态、来源去向、前置校验和持久化以对应当前加工单为准。不能把中央工厂的“确认接收”变成“接受任务”。

非范围：真实后端、测试数据库写入、权限平台、离线队列、框架迁移、其他业务模块改版。保留用户记录和未纳入本次的旧资料。无任何数据库连接；SAFE-01 仍适用。

## 当前证据与差距

- 当前 `src/data/app-shell-config.ts` 已将红框相邻两组替换为中央工厂 PDA（三入口）和三方工厂 PDA（登录、入驻、接单、执行、交接、结算），移除三方菜单洗水/仓管。生产真实点击通过；这只关闭菜单归属，不代表全部工序或三方入驻表单已完成。
- `src/pages/pda-shell.ts` 旧框架共用五个底部入口，只按个别工厂类型隐藏仓管；这不足以证明三方端没有仓管路径。
- `src/router/routes-pda.ts` 与主入口还承载全部工序和旧入驻/登录；当前执行列表包含毛织、辅助/特种、后整、染印洗等分支。
- 当前工厂资料以 `factoryTier`、`factoryType` 区分归属；不能用名称包含车缝或一个测试工厂的全能力来推断三方范围。
- 当前特殊工艺加工单已有独立接收、加工、交出、完工及各自单位；应由中央新页面消费这些事实，不另造一套示例数量。

## 工作包与顺序

1. WP1 边界与入口：建立纯范围判定和契约，明确三种车缝组合及拒绝的反例；替换红框菜单，新增中央独立路由、页面模块与事件入口。验证直接路由和菜单归属。
2. WP2 中央共同交互：从零实现账号/工厂、语言、退出、工序选择、接收/执行/仓管、扫码、单内视图和内存续填；核对当前实际图片。先完成实际业务读取与一条写入闭环，逐步补齐而不复制旧 PDA 组件。
3. WP3 中央逐工序：依次核查并接通裁床、毛织、染色、印花、洗水、水溶、捆条、辅助/特种单一工序、辅料四类、后整。每类先读 Web 代码/当前命令与记录，再实现小屏页面，验证正常及边界/恢复、Web 回读和独立实收。
4. WP4 三方闭环：将三方登录、列表、扫码、单据详情、报价/接单、开工/节点、交接、结算严格限制在三种车缝范围；移除仓管的可达路由和事件，查直链、旧链接与跨单绕过。
5. WP5 跨端与交付：核对旧入口消费者、存量记录、输入保留、换人、中文/印尼语、图与单位；执行适用构建、治理、技术收据和逐家族性能；最后审查完整 diff。发布及用户接受分别记录，不预填。

## 数据与责任登记

| 对象 | 当前来源 / 目标 | 新端规则 | 旧项 / 验收 |
|---|---|---|---|
| 工厂、员工及账号 | 当前工厂/账号资料 | 两端分别判定工厂范围，不模拟岗位权限门槛 | 不修改工厂档案归属；换人不继承前人输入 |
| 加工单、收发与库存 | 对应 Web 领域读取和 IndexedDB 命令 | 复用同一业务记录和原子命令；不新增第二事实源 | 当前命令的失败、版本冲突、直接下游回读 |
| 未提交表单 | 页面内存 | 按端/工厂/工序/单据/实物/动作隔离 | 返回可续；清空不生成空草稿；退出处理未提交内容 |
| 语言与工序偏好 | 有界 localStorage 偏好 | 只存语言和选择，合计不超过4KiB；不可用时用默认 | 不存数量、状态、用户业务或业务快照 |
| 图片 | 当前对象正式图片资源 | 名称/编号同块、可放大与关闭 | 不以无关图片占位；缺图登记阻塞 |
| 旧 PDA 地址 | 当前 Web/PDA/待办生成的链接 | 各入口逐项确定新归属和参数映射 | 不以藏菜单代替删除跨端动作；保持存量事实身份 |

## 原子矩阵

状态仅反映当前证据；下表尚未完成的条目不得以菜单或测试通过代替。

| 编号 | 来源 | 原子需求 | 工作包 / 实际位置 | 验证与证据 | 状态 | 确认人/版本 |
|---|---|---|---|---|---|---|
| S01 | 目标及图片 | 红框第一组是中央工厂 PDA | WP1 app-shell-config、pda-split-menu.test.ts | c01-menu-production-clicks及四家族各5条响应，菜单归属限定验证 | 已验证 | Codex技术核验/fc3283+menu-version任务差异 |
| S02 | 目标及图片 | 红框第二组是三方工厂 PDA | WP1 app-shell-config、pda-split-menu.test.ts | c01-menu-production-clicks及四家族各5条响应，菜单归属限定验证 | 已验证 | Codex技术核验/fc3283+menu-version任务差异 |
| S03 | 注意1/3 | 中央 UI 新写，布局/交互对齐V34 | WP2 新中央模块 | 依赖审查、320/360小屏 | 实施中 | Codex/6169496a |
| S04 | 注意3 | 中央没有接单动作 | WP1/2 中央路由/命令入口 | 菜单、页面、直链、事件 | 待实施 | Codex/6169496a |
| S05 | 注意3 | 中央没有竞价动作 | WP1/2 中央路由/命令入口 | 同上 | 待实施 | Codex/6169496a |
| S06 | 注意3 | 中央没有开工动作 | WP2/3 中央逐工序 | 业务动作审查 | 待实施 | Codex/6169496a |
| S07 | 既有确认 | 中央没有工厂入驻 | WP1/2 | UI/旧链接 | 待实施 | Codex/6169496a |
| S08 | 注意2 | 三方允许独立车缝 | WP1/4 范围契约 | 正常/混合反例 | 实施中 | Codex/6169496a |
| S09 | 注意2 | 三方允许车缝+烫包 | WP1/4 范围契约 | 正常/缺车缝反例 | 实施中 | Codex/6169496a |
| S10 | 注意2 | 三方允许裁剪+车缝+烫包 | WP1/4 范围契约 | 完整/缺工序反例 | 实施中 | Codex/6169496a |
| S11 | 注意2 | 三方工厂及卫星车缝范围严谨，拒绝未知/测试全能力 | WP1/4 | 工厂资料及伪造ID反例 | 实施中 | Codex/6169496a |
| S12 | 注意2 | 三方列表/扫码/详情无非车缝单 | WP4 列表、扫码、详情 | 入口及事件契约 | 实施中 | Codex/6169496a |
| S13 | 注意2 | 三方无仓管页面/按钮/命令路径 | WP4 路由及事件 | 直链/返回/伪造操作 | 实施中 | Codex/6169496a |
| C01 | 注意1 | 裁床接收/执行/两仓/交出/实收遵循当前逻辑 | WP3 独立裁床新端及原共同保存/物位边界 | 原两仓读基线、待加工事件接管及v3布局记录已接；当前节点接收新增三组事实与IN事件共同保存，16模式及原Web连续两单通过；新中央裁床接收/物位/当前余量调整已接通并取得小屏局部证据，完整源/历史迁移及执行交出继续 | 实施中 | Codex/fc3283；cutting-source-audit C01.01～18 |
| C02 | 注意1 | 毛织纱线/部位片/交出/实收遵循当前逻辑 | WP3 wool-model/page及独立craft、warehouse适配；原Wool/FactoryReceiving命令 | 毛织业务链、两仓实际移库/默认位调整/公共转回、普通与毛织工艺共同收发记录及连续作业技术核验已完成C02.06；316家族1580次及后续限定候选UI回归均通过，1547单元/原生故障并发通过。共享旧入口X11、全任务图像/最终验收继续，历史慢样本保留 | 已实现待验证 | Codex技术核验/fc3283+各阶段冻结；C02.06 compact限定证据 |
| C03 | 注意1 | 染色批次/加工/交出/实收遵循当前逻辑 | WP3 dye独立页面/原命令、精确历史owner与共同原子账 | 面料/连续辅料/普通辅料/纱线、原卷/称重、六节点分批、出卷标签/运输扫码/独立实收/完单/两仓及连续作业已分项技术核验；1627单元、原生三owner及故障/重试，49家族245样本最大885ms；最后工厂业务代码显示回退单独五次≤410ms。全任务X10/X11/最终整合仍继续 | 已实现待验证 | Codex技术核验/a1000 + c03-final-continuity / c03-final-factory-label，旧证据保留原身份 |
| C04 | 注意1 | 印花加工/交出/实收遵循当前逻辑 | WP3 印花适配 | 当前打印/转印分支；C04.01～12分阶段 | 实施中 | Codex/a1000e14+任务差异 |
| C05 | 注意1 | 洗水逐卷/重包/交出/实收遵循当前逻辑 | WP3 washing-model/page/ui/view/warehouse及独立wash路由 | 原六类来源与真实PCS owner、两次交回实收40/50/合计90、停止恢复、连续换人/按键及生产71家族470样本均通过；当前1435单测/构建通过、19条既有范围外类型错误；局部技术结果待最终整目标审查/收据 | 已实现待验证 | Codex/fc3283+任务差异，c05-washing-continuity-final-freeze及washing-source-audit |
| C06 | 注意1 | 水溶投入/暂停恢复/加工/交出遵循当前逻辑 | WP3 水溶适配 | 余量/关闭/独立实收 | 实施中 | Codex/6169496a |
| C07 | 注意1 | 捆条按规格/原单位收发加工 | WP3 捆条适配 | 原输入/输出均米、按规格比例授权、整单交出 | 实施中 | Codex/6f477+binding-continuity |
| C08 | 注意1/既有确认 | 辅助及特种各单一工序沿用当前四动作规则 | WP3 特殊工艺适配 | 未接收/无可交/当前完工条件/完工后仅允许交出剩余已加工实物 | 实施中 | Codex/6169496a |
| C09 | 注意1/既有确认 | 辅料盘扣/花朵/织带/花边按当前各自逻辑 | WP3 辅料适配 | 各自输入、BOM单位、交接 | 待实施 | Codex/6169496a |
| C10 | 注意1/既有确认 | 后整回货登记到实收查看完整连通 | WP3 后整适配；post-model/view/page、post-sewing-model/page、post-finishing-records、authorization | 公共机车缝回货登记/废弃/退出保护、后道点收、QC（合格/不良/返工/照片/差异）、部分后道+未处理原因、复检数量差异、换标复扫、出库实收差异、两仓库存/移动记录与印尼语已通；物理扫码/断电及两仓手工移库无原命令未验 | 已实现待验证 | Codex/v34-post-new-features版本 |
| X01 | 注意1 | 接收保留上游，交出保留下游 | WP2/3 | 来源编号、交接对象、责任人 | 待实施 | Codex/6169496a |
| X02 | 注意1 | 各端同一事实，接收方独立实收 | WP3/4 | 发出/接收/Web独立读回 | 待实施 | Codex/6169496a |
| X03 | 注意1 | 分批余量按原单位计算且不串批 | WP3/4 | 多批多包交替/已交完重扫 | 待实施 | Codex/6169496a |
| X04 | V34/既有确认 | 仓管逐工序，辅助/特种以库区库位和收发记录为核心 | WP3 仓储适配 | 库区→库位→物，不以单据列表冒充库位 | 待实施 | Codex/6169496a |
| X05 | V34 | 加工/交出/实收在同一单内连续作业 | WP2/3 | 往返、返回续填和底部主按钮 | 待实施 | Codex/6169496a |
| X06 | V34 | 扫错恢复不丢当前单输入 | WP2/3/4 | 错码/重扫/重复码 | 待实施 | Codex/6169496a |
| X07 | V34 | 退出换人不继承草稿 | WP2/4 | 不同员工/账号真实操作 | 待实施 | Codex/6169496a |
| X08 | V34 | 中印切换不改变单位/事实/字段值 | WP2/3/4 | 两种语言、小屏长文案 | 实施中 | Codex/6169496a |
| X09 | 当前代码/STORE | 保存原子、失败留输入、无假成功 | WP3/4 原业务仓库 | 中止/冲突/刷新/下游直达 | 待实施 | Codex/6169496a |
| X10 | IMAGE-01 | 对象真实图片可识别、可放大关闭 | WP2/3/4 | 素材映射与实际页面 | 待实施 | Codex/6169496a |
| X11 | 目标/NAME | 旧链接消费者完整归属，无跨端绕过 | WP1/4 | 路由、Web链接、待办、打印/扫码 | 待实施 | Codex/6169496a |
| V01 | 项目规则 | 本任务契约/构建/治理/收据通过 | WP5 | 当前版本退出值与覆盖范围 | 实施中 | Codex/6169496a |
| V02 | PERF-01 | 适用新入口/动作每家族5样本≤1000ms | WP5 | 实内容与绘制，失败不覆盖 | 待实施 | Codex/6169496a |
| V03 | 目标 | 全部需求逐条完成审计后才关闭目标 | WP5 | 需求→实现→页面/命令证据 | 待实施 | Codex/6169496a |

## 变更与阶段记录

2026-10-20：首次对照当前源码，确认参考稿发布不包含业务拆分实现。开始WP1，未预填实施或验收完成。上一目标回合归类为“进展”：发布参考资产、获得性能证据；但不证明本目标的两端拆分完成。

### WP1/WP2 基础实现进展（不代表整体交付）

- `src/data/fcs/pda-experience-scope.ts`：按工厂归属、冻结工序范围和当前合并任务定义判定三种车缝；拒绝多余工序、缺少工序、冲突元数据、退役合并源及非TASK单据。全能力中央测试工厂仍属于中央，不错误降为三方或从中央抹除。
- `mobile-execution-task-index.ts`、`pda-receive-scope.ts` 已接入已识别三方/卫星车缝厂的接单/执行过滤。17家实际工厂中仍保留现有2笔车缝任务，非空验证。未知/中央账号的最终入口归属尚待后续完整拆分，不把当前过渡实现当作最终规则。
- `main.ts` 在工艺/仓管页面读取前检查已识别三方工厂直链；`pda-runtime.ts` 和 `pda-handlers.ts` 在事件分派前再次检查；`pda-shell.ts` 对三方及卫星车缝移除仓管底栏。车缝裁片点收路径作为交接保留。
- 实际浏览器使用ID-F021现有管理员账号登录，访问warehouse、warehouse/wait-process、washing、wool/pending-receipts均返回exec，底栏仅接单/执行/交接/结算。证据：`output/playwright/pda-factory-split/browser-phase1.json`。
- `src/pages/central-pda/frame.ts` 为新写独立框架，只依赖HTML转义工具；含账号/工厂、切语言/退出、三入口、详情返回与底部主按钮。尚未注册业务路由或接入加工单，不冒称中央业务已连通。
- 独立框架组件预览的320×640、360×640印尼语长工序无横向溢出，按钮≥44px且底部可见。它是组件证据，不是中央业务页面证据。
- 两个菜单替换、中央逐工序实际命令、三方详情/扫码/交接/结算的完整范围、旧链接迁移、完整中印文案和性能均未完成。目标保持active。

### C08持久化及新业务页实施阶段

范围扩展依据：普通辅助/特种加工单命令会共同修改加工单、仓储、交接及幂等结果，原入口部分仅修改内存，不能作为新PDA的保存完成依据。本阶段在既有PCS IndexedDB内新增两组按记录集合，不创建第二数据库或整模块快照；Web及新PDA共同消费。集合为`fcs.special-craft.records.v1`（单据、库存、操作和命令结果）与`fcs.special-craft.ledger-records.v1`（旧共同交接账的按条覆盖）。读取不写种子，只提交本动作改变的记录；同一事务提交后发布内存结果。旧共同账先叠加新事实，已归属记录拒绝绕过命令写入；完整旧数据转换和下游消费者核查仍待完成，不擅自清理旧键。

2026-10-20专项契约已验证普通成衣工艺单分批接收6件、加工4件、交出3件，接收方实收0件；刷新保持6/4/3。真实IndexedDB写入中注入QuotaExceededError后原数量及持久记录保持不变，同一确认号重试未重复交出，旧业务localStorage键未新增。证据：`output/playwright/pda-factory-split/special-records-contract-all-sku.log`。这是命令契约证据，不代表新业务页面、全部工序或完整存量迁移已验证。

新页面采用实际工厂与账号资料、按工序选择、单内接收/加工/交出/实收及只读仓区库位和记录。接收不出现加工或交出按钮，不显示自动分配库位。按SKU一行填写时系统补齐其他SKU本次数量0，沿用当前Web整组校验，无需员工重复录0。数量、完工前置及按钮可用性遵循当前动作元数据和实际领域前置：当前代码允许有加工产出后完工；已完结仍允许交出剩余已加工产出，不能再接收或加工。盘扣须全部投入菲票接收后才能填报产出。上述现状分别由process-web-status-actions和button-loop-craft-flow确认，优先于参考稿的交后完工、完工后全只读示例。新路由在三方守卫之前独立处理，不沿用三方会话/旧页面。

已实现位置：`src/pages/central-pda/{page,frame,special-model,warehouse,ui}.ts`，`src/router/routes-central-pda.ts`，主入口独立处理中央页面和事件；语言、工序及账号选择为≤4KiB的界面偏好，业务填写只在内存并按工厂/账号/工序/单据/动作/实物隔离。账号仅读取现有资料或静态账号，不在普通读取时落盘种子或改写密码。仓管使用实际库区、货架、库位及对应库存，收发记录使用逐次动作和独立交接记录。

当前专项证据：

- `central-special-operations-cache-safety.log`：16个现行单一工序逐类调用实际命令，覆盖片、件、米→条、米→个、票→个；盘扣全票接收前不出现加工；完工后交出1、剩余1、对方实收0，状态保持已完结。接收与加工单位没有混用。它是领域契约，不当作16类页面全部真机验证。
- `central-page-contract-continuity.log`：实际320×640页面，分批接收6、加工4、交出3；换人后再交1，交出记录分别保留管理员账号3和员工账号1，两笔对方实收均0。Web详情独立冷入口回读6/4/4；保存中断保留输入、提交完成后回读失败的重试不重复接收；切语言、返回续填、清空不生成空草稿，输入与底部按钮可见且无横向溢出。
- `special-records-cross-tab-contract.log`：即使暂停页收不到广播，旧版本写入仍被事务拦住；同确认号跨页重试不重复接收，重新读取后下一笔成功，最终实收5且只有2笔记录。
- `central-stage-build-continuity.log`：完整构建通过，1,344项单测通过。之前的两个异步入口测试失败保留；已将准备记录与同步局部渲染分开，保留旧断言并补充准备顺序验证。
- `central-production-performance.log`：continuity版本在本地生产预览48340、320×640、Asia/Jakarta、每样本新浏览器上下文，接收冷页5样本最大910ms、切语言67ms、站内执行页101ms、接收提交含持久回读151ms。仅覆盖上述家族；之后共同账缓存回滚的改动使相关入口/保存性能需追加复测，原值保留，不冒称当前全家族通过。

共同账的缓存回滚复用现有按名注册的print、dye、dye-online、receiving、prerequisite及staged-storage钩子；不捕获无关毛织缓存。保存后以数据库读回发布，不凭本次计算猜测提交结果；记录归属只按实际记录编号判定，生产单引用、账号名或备注不成为写入归属。完整旧资料转换、旧标签写入防护、所有直接下游冷入口及剩余工序仍未完成。当前不替换最终菜单、不发布中间版本、不关闭完整目标。

### 同步最新主分支（2026-10-20）

main新增`caa7b286`，移除原型角色门槛和维护入口，涉及main、PDA交接、后道、洗水、织带和花边等直接相邻消费者。本分支已在保存完整任务备份后快进至该提交，再按明确stash身份恢复工作；35个任务文件中33个字节一致，main和车缝入口测试自动合并后已审查，未缺文件、未产生未解决冲突。备份为`before-main-caa-tracked.patch`、`before-main-caa-untracked.tar.gz`及`before-main-caa-stash.json`，均在本任务output目录。原6169阶段源码/运行资产哈希为`source-hashes-read-boundary-6169496a.json`。

新基准已完成新的构建（1355项单测通过，`central-main-caa-build.log`）及独立浏览器连续作业回归（`central-page-contract-main-caa.log`，仍为6/4/3、换人再交1、Web回读6/4/4，两位交出人分别保留，失败恢复与中印切换均通过）。这是重新执行的证据；旧1345项构建和旧性能保留原版本，不能改标为新基准通过。

下一组从当前染色/印花Web明细、实际来料接收、执行批次、交出和共同记录命令开始审查。已确认`dyeing-material-receipts.ts`停用只填数量的旧接收入口，必须提供FactoryReceiptInput并逐原卷、实收及库位登记；染色事实来源为`getDyeingQuantityFacts`、工厂接收/领用、染色批次和交出记录，区分米/Yard/kg与显式业务换算，不能照搬C08表单。完整染印洗、水溶及其余工序目标保持原范围。

### C03补充：接收与分批加工阶段（caa7b286及本任务差异）

本表继承C03，不将一个正常面料场景扩大成全部染色材料、仓储与交出完成。实现文件和证据详见`dye-print-source-audit.md`；确认人为Codex技术验证，不代表现场接受。

| 编号 | 单独完成条件 | 实际位置 | 当前证据或未完成范围 | 状态 |
|---|---|---|---|---|
| C03.01 | 普通面料调拨来货按实际中央工厂、加工单、来源行和原卷接收 | dye-model、dye-page | native接收契约及实际小屏001/002交替 | 已验证 |
| C03.02 | 原卷重复接收和外厂库位拒绝 | 同上/prepareFactoryReceipt | 接收命令及小屏重扫；拒绝未写入 | 已验证 |
| C03.03 | Yard接收与订单米数保持现行显式换算 | 同上/getDyeingQuantityFacts | 12.5 Yard→11.43m，25 Yard→22.86m | 已验证 |
| C03.04 | 切语言、扫错、返回不丢当前来源/原卷/库位 | dye-page/session/dye-ui | actual320×640接收契约 | 已验证 |
| C03.05 | 换人不承接上一员工草稿 | session/dye-page | 退出取消保留、退出确认清理、不同账号重登 | 已验证 |
| C03.06 | 六个加工步骤遵循当前实际节点前置 | dye-model/executeDyePdaProcessing | 实际命令及小屏六步骤，测试前置用既有Web命令分别准备 | 已验证 |
| C03.07 | 分批投入不重复扣料、上一批归档不被覆盖 | 同上 | 第一批投入10/包装8，第二批投入2，累计12、余10.86、历史1 | 已验证 |
| C03.08 | 不同开始/完成人分别保留责任 | dyeing-task-domain新可选字段 | admin开始、operator完成，持久回读不变 | 已验证 |
| C03.09 | 当前单加工和实收查看往返保留输入 | dye-page | actual320×640，实收视图没有加工保存按钮 | 已验证 |
| C03.10 | 原生写失败不推进加工，提交后读回失败可恢复且无隐藏空草稿 | shared records/dye-page | 两类故障注入及重新读取恢复 | 已验证 |
| C03.11 | 普通染色Web冷入口读取同一接收事实 | main/central-execution-record-bridge | actual Web详情等到业务区域后读取同一两笔FRP记录 | 已验证 |
| C03.12 | 纱线毛重/去皮、普通辅料称重与业务量、连续辅料米数各自完成 | dye-page/prepareFactoryReceipt | 已写独立表单分支；尚缺各材料实际来源正常/边界页面回放 | 已实现待验证 |
| C03.13 | 水溶暂停/恢复后按真实水溶剩余投入染色 | dye-model及C06 | 代码前置保留，完整水溶新PDA与回放未完成 | 实施中 |
| C03.14 | 原卷/分卷产出、标签打印完整 | dye-output-model/view/label及原outputRolls | 普通面料逐卷、打印结果及内容变化保护已接并验证；完整材料/原owner仍见C03.12/19 | 实施中 |
| C03.15 | 逐卷/合单扫码与司机/车型/车牌交出 | dye-output-model/view、dye-page及原dispatchDocuments | 普通染色同厂多单、扫码、运输、具名责任已接并验证；原owner合并及下游正向实收尚未完整 | 实施中 |
| C03.16 | 纱线整单称重交出遵循原额度 | dye-yarn-model/view、submitDyeHandover | 普通纱线分批、克级额度、标签和独立实收闭环已接并验证；原owner/错误历史仍见C03.19 | 已实现待验证 |
| C03.17 | 下游独立实收正向回写、分批和整单查看 | 原交接事实/dye-page | 只读视图已接；需C03.15/16完成后正向闭环 | 实施中 |
| C03.18 | 两仓实际物位、当前库存与收发记录完整 | dye-page仓管 | 已接待加工物位/实收与原单位，待交出卷和各材料钻取未完成 | 实施中 |
| C03.19 | 原有设计变更/洗水写入归属无重复或跨库写入 | runCentralDyeCommand | 原有owner分支保留；本轮只验证普通染色owner | 已实现待验证 |
| C03.20 | 适用动作家族各五样本≤1000ms | 生产预览48340 | 染色7家族35样本通过；出卷/打印/交出等未实施家族仍待验 | 实施中 |

构建`central-dye-receive-processing-build-labels.log`退出0，1358项单测通过、Vite构建通过；初次2项入口stub不完整的构建失败保留原日志，未删改原业务断言。源码/资产绑定`source-hashes-dye-receive-processing-labels.json`。普通染色7家族最大值：接收冷页450ms、执行冷页426ms、仓管冷页417ms、切语言117ms、接收保存含原生持久回读424ms、包装完成含持久回读380ms、同单实收切换131ms。每家族5样本、320×640、Asia/Jakarta、每次全新上下文与空HTTP缓存。仅覆盖上述真实场景，不代表全部中央工序性能通过。

### 本轮最终核验补充（physical-stage，本目标仍active）

- 库位选择与数值草稿均按当前工厂/账号/加工单/来源行/原卷分别保存于内存；不按整单共用库位。同单两卷分别填写12.5 Yard/A-01-01、3.5 Yard/A-01-02，往返各自恢复；换人后全部清理。`central-dye-physical-resume-contract.log`通过。
- 页面的事件处理按当前可见工序分派；异步路由在改变账号/工厂前检查是否仍是当前请求。`central-family-back-race-contract-native-readback.log`延迟首次染色模块加载后按浏览器返回，原FLOWER页仍可实际接收1件，原生记录归属FAC-FLOWER/FAC-FLOWER_admin，页面无错误。早期脚本等待资源性能条目超时、直接导入另一个Vite会话模块读到空对象的失败保留；最终证据改为当前页面操作及原生业务记录回读。
- 数量超余量和格式错误在输入框下显示当前语言提示，底部按钮阻断；不添加数量不符/原因/异常处理面板。辅料、连续长度及纱线的零接收按现有prepare规则保留，普通辅料的业务数量不擅加三位小数限制；对应材料端到端仍是C03.12待验证。
- `central-dye-stage-physical-build.log`：1358项单测及Vite构建通过。`central-dye-physical-resume-typecheck.log`：本次新中央范围0错误，全量既有19项范围外错误未冒称消除。`central-dye-stage-physical-governance.log`：6个变化页面静态列表门禁通过。
- `central-dye-processing-physical-stage.log`再次通过六节点、故障恢复、实收往返、下一批和隐含已提交草稿退役。`central-dye-production-performance-physical.log`七家族各5样本，最大：接收冷页442ms、执行冷页440ms、仓管冷页428ms、语言102ms、接收保存423ms、包装完成373ms、实收切换130ms；样本均满足1000ms。来源与资产为`source-hashes-dye-physical-stage.json`，仅工作差异及本地生产预览，不是发布回执。
- C03还需新增原卷/重分卷产出、标签打印、实际逐卷及纱线交出、运输信息、下游正向实收和全部实收后的人工完成单据。完整两仓、原归属、其他材料和其余中央工序继续待实施/验证。最终菜单、旧路由迁移及三方全部组合未完成；未提交main、未发布本业务中间版，不关闭目标。

补充未完成原子项：C03.21全部实收后的人工完单；C03.22上游HANDOUT来源的独立实际接收回写及其原子保存；C03.23各材料/批次下两仓钻取与照片交互完整验证，均为待实施/验证，不能由普通面料TRANSFER案例替代。最后C08实际全流程回归`central-page-contract-physical-stage.log`通过6/4/3、换人再交1、不同责任人及Web回读6/4/4。当前C08四家族性能`central-production-performance-physical.log`各5样本通过，最大接收冷页408ms、语言67ms、站内执行117ms、接收保存184ms。最终记录与资产哈希为`source-hashes-dye-physical-stage-final-record.json`，运行源码及1266个构建资产在最后记录补充期间保持相同。


### 普通染色产出卷与交出阶段（output-stage）

承接完整C03.14/15/17/18/19/20，不代替纱线、原归属合单、完整两仓和下游正向实收。本阶段新增四个染色output文件，dye-page内局部切换加工/产出卷/实收，沿用现行出卷与交出命令。当前基准仍caa7b286，新增main fc3283f6仅成衣出库范围，最终整合前复核。

| 编号 | 单独判定结果 | 实际位置 | 证据（output/playwright/pda-factory-split） | 状态 |
|---|---|---|---|---|
| C03.24 | 普通面料逐卷保存原单位数量、实称重量及尺寸，不手填条码；占用拒绝修改/删除 | dye-output-model/view、saveDyeOutputRolls | output-model-revision及output-guards-contract；12.5 Yard/2.123kg，同确认号返回同一卷 | 已验证 |
| C03.25 | 预览/取消不登记打印；标签内容改变后不能使用旧预览确认打印 | dye-output-label/model及dye-page | output-ui-contract、output-guards-contract；真实Code128/对应产出图，旧内容打印确认与旧值修改均拒绝 | 已验证 |
| C03.26 | 移到待出库区只记录备交位置和操作人，不代记收方入库 | stageCentralDyeRoll/markDyeOutputRolls | output-production-performance逐次原生读回stagedByUserId、inboundStatus仍未入库 | 已验证 |
| C03.27 | 同厂多原单扫码合入同一草稿；选卷不伪造扫码、错扫/重复不追加 | addCentralDyeDispatchRoll及原create/scan | output-guards-contract、output-ui-contract；两原单各自Yard与接收方，跨厂拒绝 | 已验证 |
| C03.28 | 本页填写司机/车型/车牌后一次明确交出；原生失败和同确认号重试不重复扣量 | confirmCentralDyeDispatch/原finish | output-model-revision-contract、output-ui-contract；交10余350，接收方0 | 已验证 |
| C03.29 | 建单人、扫码人和实际交出人分别保留，页面/正式交接及下游来源使用实际发方 | process-output-types、dye-domain、dye-page、dispatch-print | output-actor-ui-contract；admin建单，operator扫码/交出，具名原生记录及实收页回读 | 已验证 |
| C03.30 | 多单/多卷/工序视图续填分离，切语言不改数字；清空和换人不产生空草稿或遗留旧值 | outputEditors/Transports、session/dye-page | output-ui-contract、output-readback-ui-contract；提交后读回失败只恢复原卷，未知结果期间不能另建重复卷 | 已验证 |
| C03.31 | 保存过程中实体返回到另一工序，完成回调不覆盖新页或改记新账号 | dye-page/page捕获账号、路径与按family更新 | central-output-save-back-race-contract-output-final、central-special-save-back-race-native-record；实际具名动作/原生记录，不使用临时诊断源码作为通过证据 | 已验证 |
| C03.32 | 产出图失败阻断、重试读取对应产出图；已打印但数量不可交不标可交 | dye-page/output-view | central-dye-output-photo-status-contract-output-final；500 Yard已打印而库存360 Yard时发起交出不可见，界面显示已打印 | 已验证 |

以上确认人为Codex技术验证，设备为320×640浏览器/Asia-Jakarta；真实PDA硬件、扫码枪和物理打印质量未现场验证。打印测试使用浏览器打印调用替身，只验证真实标签内容、预览/取消及人工结果登记流程，不能宣称物理标签已成功印出。

本阶段接收方0是独立接收未办理的事实，不代表C03.17/22正向接收闭环已完成。两仓完整查询、纱线整单称重、原design-revision/washing归属、全部实收后人工完单及其余中央工序继续待实施/验证。最终菜单与三方全部组合、旧路由、完整存量迁移、main交付和发布均未完成，完整目标仍active。


output-stage最终检查：`central-dye-output-final-build.log`1358项单测及Vite通过；`central-dye-output-final-current-typecheck.log`范围0错误/全量范围外19项；静态门禁6个变化页通过。最终生产预览22家族×5样本共110个全部≤1000ms，最大750ms（确认交出含原生回读）。新11家族、原染色7家族、C08四家族原始采样分别保存，不与旧版本混标。C08当前完整页面再回放6/4/3及换人再交1、Web冷页6/4/4通过；最后观察以原生持久及实际页面为准，保留直接导入不同Vite实例读到旧内存0的失败。完整原子清单仍未关闭，尤其旧dispatch验收脚本在main同样失败，继续作为C03.17/19/22相关未决项；不冒称全量契约通过。


### 纱线整单交出与逐次实收阶段（yarn-stage）

继承C03.16/17/19/20/22。普通染色纱线使用原单固定条码和现行按克去皮/净重规则，页面只填毛重和三管型，pcs自动汇总；未用管型无需手填0。称重、标签与实收在当前单内切换，不引入毛重代替净重或面料逐卷字段。基准仍caa7b286及本任务未提交差异。

| 编号 | 单独判定结果 | 实际位置 | 原始证据（output/playwright/pda-factory-split） | 状态 |
|---|---|---|---|---|
| C03.33 | 普通纱线两次交出分别生成实际来源和独立交接记录，原操作人不被下一笔覆盖 | submitDyeHandover、dye-yarn-model | central-dye-yarn-model-contract-yarn-stage.log；两个15kg/10宝塔管，各净13.79kg、两位账号、独立originalRecordId | 已验证 |
| C03.34 | 纸/锥/宝塔管62/80/121g，毛重阈值9.999/10/10.001kg、净重库存和0/小数管数边界不变 | calculateYarnWeight/assertYarnShipment及适配 | 同上；29.997kg和20.002kg额度精确用完，余量按原克精度归0，原生配额失败不生成半笔 | 已验证 |
| C03.35 | 多单续填、条码识别、加工/实收往返、切语言和换人保留或清理各自输入，底部净重明确 | dye-page、yarnStates、dye-yarn-view | central-dye-yarn-ui-contract-yarn-stage.log；15,001↔15.001、13.791/13.789、输入319～377/底部559～640，无溢出 | 已验证 |
| C03.36 | 保存后回读失败只恢复原交出，不允许未知结果期间再改数提交重复笔 | commitOutput及原子命令 | 同上；已提交后恢复、两次实际交出与两份记录，清空/切语言/退出无空草稿 | 已验证 |
| C03.37 | 累计版本在同时间/原生按ID恢复后仍稳定；最新标签内容变化时先拦旧打印 | getDyeYarnShipmentSources、Web/yarn-shipment与新PDA标签 | model-contract-yarn-stage同时间逆序ID；central-dye-yarn-label-stale-contract.log；版本1=13.79kg，跨页新增后版本2=14.728kg | 已验证 |
| C03.38 | 下游独立实收12.79/13.79kg分别回写本笔，重试不重复入库；界面具名、单位和时间无中印混排 | 既有Web runDesignRevisionFcsCommand/confirmFactoryMaterialReceipt、centralDyeReceiver与纱线视图 | central-dye-yarn-recipient-ui-contract-jakarta.log；两个origin记录、实际接收账号，发12:30/31、收12:40/41，kg不变 | 已验证 |
| C03.39 | 伙伴名无拉丁显示时优先真实工厂业务代码，不把内部OWN_WOOL_FACTORY当作厂名 | dyePartnerLabel | central-pda-dye-input单测及实际页面；显示WOOL-OWN-001，持久/扫码身份不变 | 已验证 |

以上是普通owner现有演示/本地记录的技术验证，不代表新毛织PDA已完成，也不关闭其他材料HANDOUT回写、原design-revision/washing归属、错误历史迁移、人工完单及完整两仓。已修正新纱线来源错误关联首批的逻辑，存量错误来源未静默重写，仍归C03.19。新接收与纱线交出时间沿用现行Web本地日期格式；拒绝以ISO串替代要求YYYY-MM-DD HH:mm:ss的独立实收回写。

构建`central-dye-yarn-recipient-build.log`1359项单测及Vite通过，范围类型0错误（全量范围外19项保留），静态门禁7个变化页通过。当前本地生产预览31家族×5样本共155个均≤1000ms：纱线9家族最大724ms、面料11家族818ms、原染色7家族946ms、C08四家族895ms。详见central-dye-yarn-production-performance-raf.log和yarn-adjacent-performance-suite.log。原纱线cold两样本1072/1096ms、profiling中DOM427～624ms/selector返回1007～1104ms全部保留；逐帧观察同一可见控制/图片/两帧消除了自动化等待回退，阈值、功能条件和样本数未降低，不抹去旧失败。所有计时为本机生产预览，未宣称现场硬件网络性能。

源码与1266个构建资产绑定source-hashes-dye-yarn-stage.json；任务源文件压缩归档dye-yarn-stage-task-sources.tar.gz可与基准caa7b286恢复当前实现。完整目标保持active、不通过，尚未提交main/发布中间业务版。

### 续接 C03.21 与 C03.18/23：染色人工完单和两仓（实施记录，尚待本阶段验证关闭）

本轮不改变完整拆分范围。Web人工完单需逐笔独立具名实收相等且全部批次包装产出等于累计实收；getDyeDocumentCompletion与原completeDyeWorkOrderDocument共用这一判定，新PDA不用自己的“交出过就可完工”规则。Web线上状态由原主单/节点派生，不新增商业开工。待交出仓原代码为按加工单汇总，不给它虚构物理库位；下架暂存不等于下游入库。

| 编号 | 来源 | 原子需求 | 工作包 / 实际位置 | 验证与页面证据 | 状态 | 证据位置 / 确认 |
|---|---|---|---|---|---|---|
| C03.40 | C03.21 / 当前Web | 仅全部批次产出逐笔等量实收后可人工完单 | dyeing-task-domain getDyeDocumentCompletion/completeDyeWorkOrderDocument；dye-completion-model | 普通染色无交出/部分/未收/完整、少收/0产出、异厂/旧页及2批PACK汇总通过；completion-contract/short/small-screen-contract日志 | 已验证 | 当前工作树；代理技术核查，非用户接受 |
| C03.41 | C03.21 / STORE-02 | 完单保存实际具名账号/时间；写失败无半笔、同号重试不重复 | dye-completion-model、dye-page同单最终确认与恢复 | 原生失败无半笔，同号重试、已提交回读恢复、冷页具名完单及Web状态通过；completion-ui-contract-final/contract日志 | 已验证 | 同上 |
| C03.42 | C03.18/23 / Web两仓 | 待加工库存沿原卷/实际物位/原单位扣用；不混入洗水等工序 | dye-warehouse-model / view；原getDyeingWarehouseView | 普通面料两卷两位、两批扣用、Yard/m、历史汇总及图片通过；其他材料/混合owner和早期投影差异根因仍待C03.19/23覆盖 | 已实现待验证 | 同上 |
| C03.43 | C03.18/23 / Web两仓 | 待交出保留按加工单包装汇总和独立实收；不将汇总分配假库位 | 同上；dye-page warehouse-order复用同单产出页 | 普通两批10m产出、注册物位、独立实收视图、同原单钻取通过；全材料范围随C03.23继续 | 已实现待验证 | 同上 |
| C03.44 | X08 / 一线连续作业 | 新仓管记录按操作时间展示，实际操作者、印尼语及照片可识别 | dye-warehouse-view、dye-page receiveHistory | 当前用料最新先、实际节点账号、320×640/印尼语、照片/选位余量可见及75性能样本通过；small-screen-contract/performance日志 | 已验证 | 同上 |

C03.18/23整体仍实施中，未以普通面料两卷案例替代纱线/其他材料的全部仓管与原owner兼容。本轮完成后仍须继续水溶、新毛织/裁床/印花/洗水/后道/辅料各工序、三方全部组合、最终菜单/旧路由及迁移；未合并main、未发布业务中间版。

本阶段最后结果绑定：source-hashes-dye-completion-warehouse-small-screen-stage.json（55运行/测试文件、1265资产）及追加记录后的final-record清单；15家族75样本全≤1000ms。C03.40/41/44为本轮普通染色技术验证，非整体交付/用户接受；C03.18/19/23、全部材料/旧owner及其他工序继续实施。

### C03.13/C06 前置水溶与独立水溶的拆分审查

当前Web存在两个对象。染色主单requiresWaterSoluble的前置节点属于同一染厂加工，不产生水溶中间交出；使用染色主单/水溶节点/完成批次与原接收账，继续沿本任务共同IndexedDB命令保存。独立WaterSolubleWorkOrder则有自身原料接收、累计产出、逐卷/标签/扫码/运输交出、收方批次及完单，并仍存在独立localStorage旧账；必须另行迁移/原子保存和新页面，不能用前置节点替代C06完整交付。

本轮先补齐前置节点：开始前要求来源实收、样衣/色样、投入接收及染缸准备已完成；本批实际投入由接收减已水溶投入推导。完成填本批累计数，前批累加后不能回退、不能超过本批实际投入，累计与水溶计划不一致时必须沿现行Web条件填写说明。缺量自动暂停；补做保留完成数，按实际转染色限制后续投入，返工重置当前完成数。三个决定显示具体下一步及数量后果，不新增旧框架岗位切换或权限提示，记录实际活跃账号及工厂，不伪造登录身份。先前已删除的通用异常/数量不符面板不恢复；必需说明仅在现行规则触发时出现。

本阶段实现及源核对详见 [dye-water-source-audit.md](dye-water-source-audit.md)。仅本表前置水溶范围进入本轮技术验证；完整 C03/C06 和最终拆分仍未关闭。下表证据基址为 `output/playwright/pda-factory-split/`，确认版本为工作树基准 `caa7b286` 加 `source-hashes-dye-water-runtime-stage.json`，确认人为 Codex 主代理，未获用户产品接受。

| 编号 | 来源 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / 性能证据 | 状态 | 证据位置 | 确认人 / 版本 |
|---|---|---|---|---|---|---|---|---|---|
| C03.45 | C03.13 / 现Web | 开始/完成沿实际前置、本批投入和原单位 | WP3-C03 | dye-water-model/view；executeCentralDyeWaterSoluble | 3项输入单测、model-contract-v3-water-final；原子配额失败及上下限 | 320×640原单；水溶/失败/新批37家族185样本≤1000ms | 已验证 | water-source-audit；water-stage-evidence；水溶四份production-performance日志 | Codex / water-runtime-stage |
| C03.46 | C03.13 / X05/07/08 | 暂停补做保留已完成数并可恢复同单填写 | WP3-C03 | dye-page waterContext/submitWater；原节点函数 | recovery-visible-ui-contract：8.6→补做9、返回/清空/中印/退出 | 同上；返回/语言/最低量/补做保存单独5样本 | 已验证 | central-dye-water-recovery-visible-ui-contract.log；history-production-performance | Codex / water-runtime-stage |
| C03.47 | C03.13 / 当前路线 | 按实际转染色后仅使用真实水溶产出并走最终交出 | WP3-C03 | saveCentralDyeWater；原六节点和产出/交出命令 | 9.5限额阻断10；六步骤和实际卷9.5交出；未操作收方仍0 | 同单加工/产出/实收往返；实际发出人F090_operator；Web execution冷入口读9.5 | 已验证 | recovery-visible-ui-contract.log；processing-page-contract-water-final.log | Codex / water-runtime-stage |
| C03.48 | STORE / X07/09 | 暂停决定、返工和恢复不丢失原数量责任或产生半笔 | WP3-C03 | resolveDyeWaterSolublePause；recordDyeWaterOperator；既有同库命令 | 取消无写、异厂拒绝、配额失败、提交后读回/同号去重、换人；Web/中央交替；同阶段新增实收拒绝旧修订 | 一次最终确认；返工显示清零后果；错误及唯一恢复主按钮可见；分别保存实际开始/完成人 | 已验证 | cross-surface-contract.log；model-contract-v3-water-final.log；recovery-visible-ui-contract.log；same-phase-conflict-contract.log | Codex / water-runtime-stage |
| C03.49 | C03.13 / 当前批次 | 新增来料与已水溶未染余量分别继续且不串量 | WP3-C03 | centralDyeWater；原completedWaterSolubleBatches和实际领用账 | 两10米接收/不同原来源单；实际用量5+3+7=15，逐接收不超用；当前数量/保存家族通过 | 原water-runtime-stage已验证；最新共同保存后冷入口2样本1054/1008ms，超过1000ms；当前不按旧通过结论关闭 | 已实现待验证 | 原multiple-sources/optional-batch/next-batch证据保留；当前central-dye-water-next-batch-row-overlay.log | Codex / c06-row-overlay-final-build，性能未通过 |
| C03.50 | STORE-01/02 / 原Web兼容 | 首次只改一单不把未改静态资料持久化，行级回读保留合法引用与原校验 | WP3-C03/C06 | currentDyeExecutionSnapshot；special-craft-records初始化/回滚顺序；restoreFormalDyeExecution；rebuildWashingLedger | 早期109行失败保留；当前染色建卷至交出仅本原单5行，12.5 Yard；六节点/失败恢复通过；未采用旧资料不走行级引用分支 | 320×640原生回读；1369单测/类型0范围内；当前48家族240样本有上述冷入口2超限，不能整体关闭 | 已实现待验证 | c06-dye-baseline-diagnostic/row-overlay；c06-row-overlay-final-build；c06-row-overlay-performance-summary | Codex / c06-row-overlay-final-build |
| C06.01 | 当前独立水溶Web | 独立对象、旧账迁移和逐卷完整新UI | WP3-C06 | water-soluble-task-domain/output/records；新water-model/output-model/page/view/ui/label及独立路由已接，正式验证进行中 | 同库单条/失败/冷读回及原Web部分全链初验；静态基线/相邻染色修复后继续正式复验 | 新独立UI已接并完成主线初验；不能沿用前置节点证据关闭 | 实施中 | standalone-water-source-audit及C06.02～14 | Codex / C06原Web消费者阶段，非完整交付 |

本轮本地生产预览37家族185样本最大892ms，原始值和采集无效日志保留。全量1362单测及Vite构建通过；范围类型0错误，全量另有19项既有范围外错误。新共享恢复提示亦用普通染色产出/六节点失败场景复核，未把局部通过写成全项目通过。运行/测试58文件、1265构建资产已冻结，最终文档记录另列清单；最终完整技术收据、主菜单、其他工序和main发布继续实施。

### C06 独立水溶实施前分解

继承 C06.01，代码源核对及具体顺序见 [standalone-water-source-audit.md](standalone-water-source-audit.md)。分解建立时只有源码和隔离只读基线，7单均为米、读取无本地写入。后续C06.02～04按下表进展，其他条目仍待实施；只读基线不替代新实现验收。全表确认人为 Codex 主代理（范围分解），实现版本/证据待完成，不冒充用户确认。计划位置在实际实现后补充具体符号与当前验证。

| 编号 | 来源 / 原子需求 | 工作包 | 负责文件 / 接口（计划） | 自动化验证计划 | 页面 / 性能证据计划 | 状态 | 证据位置 / 确认版本 |
|---|---|---|---|---|---|---|---|
| C06.02 | STORE / 旧水溶普通读取不再写业务旧账或复制静态演示 | WP3-C06 | water-soluble-task-domain；central-execution-record-bridge、现FCS门面 | 新共同命令仅改1条/旧key不写，首次/冷读通过；全部消费者继续核查 | 新页面及适用冷性能待完成 | 实施中 | standalone-water-source-audit保存基座段；persistence-cold-replay-contract.log |
| C06.03 | STORE-04 / 旧源向按记录新源迁移不丢身份与历史 | WP3-C06 | water旧key、PCS现有集合、water缓存owner | 已采用行旧直接写拦住；显式全旧源转换/冲突/续转/回读/退出继续实施 | 旧卷/单/扫码/实收仍须完整追溯 | 实施中 | 同上，未声明迁移完成 |
| C06.04 | STORE-02 / 原单与必要收发和命令结果一事务保存 | WP3-C06 | water-soluble-records；原water mutation/output transaction；special-craft-records；Web分厂/加工/卷码/output-documents及旧PDA事件 | 原保存基座成功/失败/冷读/同号去重；Web分厂/1000米正常分批/卷65米与两单120/90米交出、独立实收初验；相邻染色身份和静态基线修复继续复验 | 新中央页面与全收发/旧源退出待验 | 实施中 | standalone-water-source-audit原Web消费者阶段；c06-web-consumers-verified.log；c06-web-dispatch-recipient-final.log；当前基线修复尚未正式关闭 |
| C06.05 | 当前Web / 接收和实际投入沿真实来源/物位/单位 | WP3-C06 | factory-receiving；water-model/page/view | 不用已禁用receive捷径、分次/错单/无效物位、不重复扣用 | 接收Tab、源/库区库位、实际余量及照片 | 已实现待验证 | standalone-water-source-audit新中央水溶页面阶段；正式构建/性能待收口 |
| C06.06 | 当前Web / 全单累计完成遵守独立单公式 | WP3-C06 | completeWaterSoluble；water-ui/page/view | 非负/不回退/不超投入，正数部分无说明可交出，0/超计划说明 | 中文/印尼语和米不改义；保存/校验五样本 | 已实现待验证 | standalone-water-source-audit新中央水溶页面阶段；正式构建/性能待收口 |
| C06.07 | 当前Web / 真暂停后可按原三决定继续 | WP3-C06 | resolveWaterSolublePause；具名责任 | 保留/按实际/重置及既有卷/交接影响；取消不写、真实人 | 单次确认、后果、返回续填和换人不串草稿 | 已实现待验证 | standalone-water-source-audit新中央水溶页面阶段；正式构建/性能待收口 |
| C06.08 | 当前Web / 卷码维护和打印保留实际身份 | WP3-C06 | water-soluble-output；新water卷/标签视图 | 自动码、2位/0.01、占用不可改、改数撤打印、打印结果 | 对应图/Code128、预览/取消/重试 | 已实现待验证 | standalone-water-source-audit新中央水溶页面阶段；正式构建/性能待收口 |
| C06.09 | 当前Web / 同厂合单各行保留原单/下游 | WP3-C06 | createWaterDispatchDocument及新同单界面 | 同厂多单合入/跨厂拒绝、占用及作废释放、逐行单位 | 多单/多卷交替、无串批及旧内容；适用性能 | 已实现待验证 | standalone-water-source-audit新中央水溶页面阶段；正式构建/性能待收口 |
| C06.10 | 当前Web / 正式交出保留每卷扫描和实际发方 | WP3-C06 | scan/saveTransport/finishWaterDispatchDocument | 错扫/重复、三运输项、临确认重校、实际创建/扫码/发出人 | 连扫/返回/换人、最终按钮数量；保存五样本 | 已实现待验证 | standalone-water-source-audit新中央水溶页面阶段；正式构建/性能待收口 |
| C06.11 | 当前Web / 对方实收与本批/整单查看相互一致 | WP3-C06 | 原交接/receiving回写；独立water详情 | 分次/多批独立实收、发方不代收、冷回读及冲突 | 明确实际收方、时间和未收余量 | 已实现待验证 | standalone-water-source-audit新中央水溶页面阶段；正式构建/性能待收口 |
| C06.12 | 当前Web / 真实完单条件满足后原单只读 | WP3-C06 | completeWaterSolubleWorkOrder；原仓储投影 | 未收/未交/未确认差异阻断；当前允许的已确认差异保留 | 完单取消无写、DONE只查看；物位/收发记录真实 | 已实现待验证 | standalone-water-source-audit新中央水溶页面阶段；正式构建/性能待收口 |
| C06.13 | V34/X05～08 / 真实账号下连续填写不串单 | WP3-C06 | water-page/entry/routes-central-pda、共用frame/session | 320×640、Enter、语言/扫码/返回/清空/退出、无空草稿 | 输入/主按钮可见、印尼语清晰、原单位保留 | 已实现待验证 | standalone-water-source-audit新中央水溶页面阶段；正式构建/性能待收口 |
| C06.14 | PERF/EVIDENCE / 新独立流程完成正式技术验证 | WP5-C06 | C06直接文件、契约及审查 | 相关构建/治理和共同账染色/C08回归 | 每适用家族五样本≤1000ms、源/资产绑定 | 实施中 | standalone-water-source-audit新中央水溶页面阶段；正式构建/性能待收口 |
| C06.15 | STORE-02 / 多窗口不能重复占用同一原单实物 | WP3-C06 | water-soluble-records / special-craft-records / central-execution-record-bridge | 原生两窗口同一卷竞争已复现双保存；采用现有PCS同事务的按原单版本标记，不复制业务快照 | 首笔成功、后笔冲突，无半笔、输入保留；稳定重试及相关回归/性能 | 已实现待验证 | 原失败保留；guarded原生及双页面reload功能已通过，主线22家族重验通过；并发专门性能仍待补 |
| C06.16 | 当前Web仓储/STORE-01/IMAGE-01 | 水溶仓管只读投影真实物位与收发记录 | WP3-C06 | 新water-warehouse-model/view；water-page | 无交出记录只显示一次空态；分配来源不漏不重、当前配额余量和历史物位、逐行原单/下游/责任；无默认产出库位 | 320×640中文/印尼语、照片、库位查看/记录/分页/语言；仓管详情不出现加工动作 | 已实现待验证 | 当前warehouseContent源证据及本轮仓储核查，实施后补实测 |
| C06.17 | V34/PDA按键连续作业/交接责任 | 输入法确认不得触发交出，F1聚焦当前扫码任务 | WP3-C06 | water-page键盘事件 | 当前运输字段composition Enter实际误交120米已复现；仅实际数量/扫码/登录按已知上下文执行，运输字段Enter前进/聚焦主按钮 | 扫卷F1不中断本单；中印/返回/输入法/底部按钮真实事件与持久记录 | 已实现待验证 | c06-water-keyboard-ime-gap.log为失败，修复和验证继续 |


### C06.16 冷入口失败及共同入口加载整改

当前冻结 `c06-water-warehouse-continuity-assets-build` 的12家族60样本：11家族55样本均≤509ms，冷仓管5样本1152/742/779/1188/635ms，两项有效超过1000ms，C06.16继续实施中。源码及资产清单保持原版本，不重复采样掩盖失败。

| 需求编号 | 来源 | 原子需求 | 工作包及实际文件 | 验证与完成条件 | 状态 | 证据与确认版本 |
|---|---|---|---|---|---|---|
| S03.01 | 中央独立入口 / PERF-01 | 进入水溶或染色不先加载辅助特种页面模块，各自进入实际工序时再加载 | WP2 / src/pages/central-pda/entry.ts | 实际三个工序直达/站内切换及旧页面功能回归；冷入口各5样本并核对模块资源，原冷失败保留 | 已实现待验证 | 当前静态special页面依赖及cold-diagnostic-current资源流，主代理 / continuity版本 |

CPU诊断未找到独占长任务，不盲目新增结果缓存；结构及网络证据确认水溶先加载Central entry及辅助页面，再串行加载water页面。改为与现有染色/水溶一致的按页惰性加载，保持路由序列取消保护、事件/弹层分派及全部真实业务命令不变。不得因只减少模块加载就预填性能通过。


| 需求编号 | 来源 | 原子需求 | 工作包及实际文件 | 验证与完成条件 | 状态 | 证据与确认版本 |
|---|---|---|---|---|---|---|
| C06.18 | C06.07 / 分批守恒及真实交接责任 | 已部分交出后暂停，再选继续加工，累计交出及独立实收历史不能归零或重新变为可交 | WP3-C06 / resolveWaterSolublePause | 已交/实收100米、累计完成1034米，继续前后可交均934米；普通未交恢复/按实际/未交返工保持原语义；原生冷回读、重复保存、相关性能 | 已实现待验证 | c06-water-continue-after-sent-contract.log 实际失败：handed100→0，可交934→1034；Codex/惰性入口运行版本 |

C06.18 修复范围限定CONTINUE_PROCESSING保留已经发生的累计交出量，不动交接记录、已交卷、实收及其责任，不改现有独立水溶的全单累计完成语义。RETURN_FOR_REWORK仍有既有卷/已交历史的独立边界待核查，不将继续加工修复当作重新加工已验证，也不悄悄删除旧卷/旧交接来通过。


| 需求编号 | 来源 | 原子需求 | 工作包及实际文件 | 验证与完成条件 | 状态 | 证据与确认版本 |
|---|---|---|---|---|---|---|
| C06.19 | C06.18 / 现有产出卷合计上限及PDA少点一次 | 卷长输入即核对当前未分卷余量，编辑时排除被编辑卷，已交卷不重复扣减；保留保存时原域最终校验 | WP3-C06 / water-page primary卷表单 | 934.01超过934时当前语言提示/保存不可点；934可保存，既有未交卷参与合计；不新增数量上限或单位换算 | 已实现待验证 | c06-water-pause-continuation-performance.log 实际输入后未提前阻断，原域提交仍有合计上限；主代理 / pause-continuation版本 |

该输入走查超时来自脚本等待尚不存在的表单即时提示，原样保留；没有实际超额保存，不把该timeout写成数量已越界。前置同一现有域上限的提示，减少填写明显超量后再点保存的一次操作。

本轮局部功能及当前适用性能记录：C06.16仓管实际物位/公共分配/17笔接收/逐行交出与独立30米实收通过；C06.17按键/旧提示/保存后回读恢复通过；S03.01实际资源确认三个工序页各自加载。当前浏览器实际绘制时间及CLI完整观测双保留，原慢值不删除。上述三项详见standalone-water-source-audit及原始performance-summary。

C06.18原失败934→1034可交的情况已修复：正式交/实收100后继续加工仍可交934，独立新页面冷读相同。C06.19同一原域卷长上限前置提示，编辑时排除原卷、已交卷不重复扣用；当前生产构建7家族35样本均≤335ms（resume335、restart217、累计249、余量阻断55、934米卷保存311、正式交出250、实收查看117ms），独立实收100保持、后续934待对方收，页面错误0。原RETURN_FOR_REWORK历史边界没有由本项代替。

矩阵保留已实现待验证的原因：局部实现/原生页面/适用性能已通过，但完整目标审查仍明确不通过，治理器拒绝基础阶段保留的失败与未完成项；不能生成整体通过收据。C06.03显式迁移、C06.07已维护卷或已交历史下重新加工、C06.15专门竞争性能、C06其余暂停/完单动作家族，以及其他中央工序、三方完整范围、最终菜单/旧路由和正式发布均未关闭。


C06.19追加当前正式性能 `c06-water-roll-edit-remaining-performance.log` / summary：原两卷80/80米，改第一卷80.01立即阻断、无效Enter原生记录不变、切语言保持上限、恢复80可保存且退出无空草稿，5家族25样本均≤167ms，页面错误0。与C06.18七家族35样本合计12家族60样本，实际分批/既有卷/独立实收事实均保留；不替代其余工序或完整迁移验证。

### C04 印花逐项实施（继承C04，不替代其余中央/三方工作）

源审查与依赖计划见printing-source-audit.md。首轮只读69单/29个实际中央单；现已进入新接收/加工UI及原生保存验证。卷标签、交出、洗水及完单仍未接完，不代表印花或完整拆分目标已交付。

| 需求编号 | 来源 | 原子需求 | 实际文件/工作包 | 验证与完成条件 | 状态 | 证据/确认 |
|---|---|---|---|---|---|---|
| C04.01 | 目标/当前工厂主数据 | 只展示实际中央工厂的印花单及现有真实账号，保留原身份 | WP3-C04 / print-model、printing-task-domain | 当前69/29非空及外厂/伪造账号拒绝，正常读取不落静态种子 | 已实现待验证 | c04-print-baseline.log、c04-print-production-direct-references.log；当前新页验证进行中 / Codex |
| C04.02 | STORE-01/02 | 普通印花本动作变化行与直接收发/幂等同事务，首次不采用未改静态单 | WP3-C04 / special-craft-records、printing-task-domain、print-model | 原生成功/中止/读回失败/冷页与同号去重；设计改款/洗水owner不双写 | 实施中 | c04-print-production-direct-references.log；普通单原生成功/中止/冷回读/稳定重试通过，其他owner与Web命令接入待补 |
| C04.03 | 当前Web | 接收使用实际来源/SKU/上游/原卷和实际物位，原单位不改 | WP3-C04 / print-model/view/page、factory-receiving | 多来源原卷、重复/错扫、Yard/米/其他材料、库位/账号边界 | 实施中 | 见printing-source-audit；当前UI验证进行中，尚未全分支/性能闭环 |
| C04.04 | 当前Web | 按当前需求版本依序核对花型/试样、实际领料、印制及适用转印 | WP3-C04 / 现有recordPrintingProductionStage/startPrintingProduction、新生产适配 | 正常与前置/不倒退/不超量/版本变化/实际不同操作人，领用一次 | 实施中 | 见printing-source-audit；当前UI验证进行中，尚未全分支/性能闭环 |
| C04.05 | 当前Web | 填本次新增产出/卷数，由系统合成原累计并保留损耗/在制校验 | WP3-C04 / completePrintingWorkOrder、新印花执行页 | 转印/直印、当前批与整单、原单位/设备、保存恢复不重复生成卷 | 实施中 | 见printing-source-audit；当前UI验证进行中，尚未全分支/性能闭环 |
| C04.06 | 当前Web/IMAGE | 原卷实测、有效规格、实际对应图和真实标签/打印语义 | WP3-C04 / print-output-model、print-roll-ui、print-output-view、print-label、print-page及printing-task-domain | 所有实际单位/物位/固定SKU/打印失效与被占用不可改 | 实施中 | 原生失效/打印人红绿复现；UI多卷、恢复、100×60、实际米/BOM历史及完工边界、占用/批量改规格已核；37响应家族五轮通过；直接交出闭环仍随C04.07继续 / Codex |
| C04.07 | 当前Web/交接责任 | 合单严格同厂/同下游仓/同单位、逐卷核对、实际创建/扫描/交出人 | WP3-C04 / print-dispatch-model/view、print-page/output、printing-task-domain、central-printing-actor、pda-handover-events、printing-records、printing-joint-records、fabric-washing-repository/bridge、design-revision-pcs-storage、pcs-record-runtime、printing-factories、routes-fcs | 多单多卷、冲突/错扫/作废释放、独立实收/冷回读 | 实施中 | 原6+2和普通/洗水58证据保留；当前真实PCS设计8＋普通50＋洗水补料50一次交108、四类quota/已提交读失败恢复/稳定重试、三笔Web实收和冷读通过；另一页改设计卷7阻断旧合单，唯一原owner；Design下游工厂来源接收冷读8/58；20类小屏与相邻36类五轮通过，人工完单仍待，详见printing-source-audit / Codex，非用户接受 |
| C04.08 | 当前Web | 现场手感判断/洗水流向沿实际卷及原门禁 | WP3-C04 / print-washing-model/view/page、fabric-washing/repository、central-execution-record-bridge | 不需洗/需洗/洗后回卷，原卷和物位与实际交接追溯 | 实施中 | 原无需洗水归属证据保留；当前需洗水SEND联合原子保存、失败/并发/冷读、GTG原生生命周期至洗后交出通过；同单判断/送洗及Web实收回读已接UI，当前正式构建/性能及后续洗后返回继续，见printing-source-audit / Codex |
| C04.09 | 当前Web | 全实收无未决差异后人工完成，完成后原单只读 | WP3-C04 / getPrintingDocumentCompletion、completePrintWorkOrderDocument、print-completion-model/view、print-page/ui/view/output-view；part-ticket-records同输入只读合并 | 独立收方分次、多批、本批/整单、取消不写、完成后禁止数量动作 | 已验证 | Codex / read-sharing-build 1409单元；原生三归属/多HDR/异议/失败/冷页/中印ENT和真实另一页先签署；硬件Back另一单3,5保留五次≤215.9ms，4工序入口/语言8家族40样本≤466.1ms，无页面错误。全类型19条范围外失败保留，详见printing-source-audit和completion-freeze；非用户接受 |
| C04.10 | 当前Web仓储 | 本工序实际库区库位、源卷余量/领用及产出卷、收发记录真实 | WP3-C04 / printing-warehouse-view及新只读PDA视图 | 分配不重复、原单位/停止库位/未知量、跨单和实收 | 实施中 | 见printing-source-audit；当前UI验证进行中，尚未全分支/性能闭环 |
| C04.11 | V34/X05～08 | 印尼语小屏、按键/语言/连续原卷/返回/清空/换人不串单 | WP3-C04 / print-page/ui及共同会话/entry | 320×640真实事件，当前主按钮/无空草稿/无技术解释卡 | 实施中 | 见printing-source-audit；当前UI验证进行中，尚未全分支/性能闭环 |
| C04.12 | PERF/EVIDENCE | 全适用功能、直接Web/相邻PDA回归与每家族5次响应 | WP5-C04 / 当前构建/源码/记录 | 证据与原始失败保留，完整目标审查及收据不由局部冒充 | 实施中 | 见printing-source-audit；当前UI验证进行中，尚未全分支/性能闭环 |


C04当前文件/证据补充（阶段仍实施中）：print-model.centralPrintFact/centralPrintIncoming使用原生定向当前单，不缓存数量；print-ui.printProductionInput保留当前版本累计、原生单位和本次损耗；print-page.refreshFooter/handleCentralPrintEvent绑定当前显示动作与实物，异步读取不自动代确认下一工序。新增central-pda-print-detail-read.test与原生29单/来料投影对照。普通印花接收/加工及恢复、Web旧按钮和直接16条持久行重放均通过；标准构建当前1390全单元通过。仓管只读首版和未测量卷展示不代表C04.06～10全部完成；跨owner合单与所有材料操作分支仍待补。性能原始失败保留，优化后五轮按独立证据判定，整任务不改为完成。

C04当前接收/加工性能证据：c04-print-production-scoped-read-performance（实际事件到保存/内容/图片及两帧、导航各自timeOrigin）18响应家族各5通过，无pageerror，冷页385.5ms、执行316.8ms、保存最多241.8ms。只关闭该版本这些已存在动作的性能问题，不关闭尚未实现的C04.06～10或全目标PERF/验收；旧>1000ms样本保留。


C04.06当前交付版本记录：新增print-output-model、print-roll-ui、print-output-view、print-label及central-pda-print-roll-input.test；原卷更新/批量规格改动使旧打印失效，markPrintingRollBarcodesPrinted记录实际中央UID并清除Web未知UID残留。完整标准构建1395项通过；当前生产预览37响应家族185样本通过（最高411.3ms），见c04-print-roll-final-production-performance-summary.json，冻结c04-print-roll-final-runtime-manifest.json。全范围tsc19既存错误、整目标治理失败及其原始证据不删除。此状态只描述当前卷/标签阶段，不关闭C04.07～12、其他工序、第三方、迁移或发布。


C04.08当前进展（2026-10-21）：见printing-source-audit当前实现节。原生联合SEND与独立GTG实收/用料/洗后交出、当前同单触摸/送洗/原码核对、真实读回锁定恢复、原Web实收→PDA冷查看、多实际批次及补卷明确归属、空加工草稿连续追加已定向验证；C04.06/08/11/12仍为实施中，不冒称跨owner交出和整个洗水端闭环。当前1400单元/生产构建通过，全tsc19既存失败未清除；正式响应及冻结另绑定c04-print-washing-continuation文件身份。

C04.08当前生产预览性能：59家族/295样本均≤1000ms、最大364ms，五轮原单位/账号/22.5收11用9产8交0GTG收一致。c04-print-washing-continuation-production-performance-summary及runtime-manifest/freeze为本阶段证据；未关联旧卷补批次专用性能与跨owner/最终洗水端等仍未关闭，C04.06～12及整目标继续实施中。


### C05 洗水独立新端开始

当前逐项源核查与实施前原子表见washing-source-audit.md的C05.01～10，继承C05全范围。已确认GTG默认无需接单、逐卷一次实收/投入/产出/交回、唯一最终接收方独立实收后才完单；洗水产出数量无自设不超过投入上限，重包不改原卷身份。接收/差异变化使用原明确确认，不恢复通用数量不符或异常表单；工厂账号不冒充仓库责任人。本节实施开始时仅完成代码核查；当前新UI主流程已接通并完成正式30家族195样本，但打印、仓管、并发/恢复及完整账号连续作业仍未关闭，详见washing-source-audit当前阶段。

C05连续作业专项已收口本项技术结果，71家族470样本均≤442.5ms；C05.01～09直接证据、正常/边界与原事实归属详见washing-source-audit末节。C05总项不冒充整体拆分verified，最终审查/收据、中央其余工序、三方与菜单迁移和发布仍未完成。确认人为Codex主代理/continuity-final-build，非用户产品接受。

### C01 裁床源码与原页面基线阶段

继承C01，不替代其他工序。cutting-source-audit.md登记当前两仓不同对象/动作、正式来源、原自动接收责任、单位及保存边界，并拆分C01.01～18；目前只有源核查及原Web只读展示。已见物位load时localStorage写初始布局/清理旧key，以及待加工三动作不在当前managed event范围，不能直接套用裁后同库通过结论。接下来先完成必要读写/旧数据边界，再写独立新页；未报告新PDA已接通或现有业务已验证。C05当前冻结保持原版本，仅文档接续，不重新解释其原资产或通过状态。

C01.03起步新增readWarehouseLayoutSnapshot纯读入口及四项契约，已有v3/旧资料/历史/坏与外厂资料均不写不删；尚未接入新页面，旧load及待加工旧账整改仍未完成。实际位置/红绿/类型检查见cutting-source-audit末节，保持实施中，不预填新PDA页面通过。

C01.04事件接管接续：central-v3与历史v2区分，待加工五类事实/原Web三动作已沿共同事件保存；101条迁移中断/清理失败续转、冲突保留、同号新命令不重复、Web12.5/2.5/1.25 yard冷读已取得。完整1443单元及构建通过，19条既有范围外类型消息不变。C01.04a仍实施中，命名响应、实际配料接收会话共同保存(C01.04c)、布局迁移(C01.04b)、旧入口适配及新PDA尚未完成，不能由事件基础结果关闭接收整体。详见cutting-source-audit末节。


C01.04b接续：当前v3配置/逐条历史已接入同库，读不落盘，旧原生写入停止；原Web真实维护、失败保留/取消、双页竞争、第三页冷读、显式迁移/中断和v2保留已取得直接证据。新增4契约先红后绿，完整1447单元及生产构建通过，原19条范围外类型消息不变。旧v1/v2准确映射、损坏布局显式恢复适配和本阶段正式性能仍未关闭，本子项保持实施中；C01.04c八组实际配料资料及原节点全部实物接收边界已进一步核查，未把通用数量框或全快照保存作为实现。详情见cutting-source-audit末两节；整个拆分范围及未发布状态不变。


C01.04b后续命名响应：原待加工库位图首次最大1080ms不通过；已保留原30样本，修复未选Tab的多余HTML生成，25组输出等价、实际收发/维护回归通过，重建1447单元/Vite23.67s。新30样本六类各5个：待加工首次/编辑/保存最大967/114/143ms，待交出479/83/146ms，均≤1000ms；数量为原23/34位置，页面错误0。此补充替代“完全尚无采样”的阶段描述，但仅验证六个命名家族，不能关闭旧版准确迁移、损坏恢复、其他动作性能和完整C01/拆分。新版本及失败/修复证据见cutting-source-audit最后节，旧归档未改。


### C01.04c 当前节点接收局部推进（2026-10-21）

按cutting-source-audit末节接续：活动节点读不写，原节点新增pickupRecords/pickupSessions/pickupNodeSnapshots及入仓事件共同保存，原Web异步接收可失败保留后重试。16原生模式、9种损坏备份拒绝、双窗口竞争/同号重试/第三页回读、实际Web连续180与1386 yard及具名接收人、相邻12.5/2.5/1.25 yard三动作、真实PCS8 Yard洗水owner回归均取得证据。原损坏前置未拦截的失败保留，已定位为原reader吞错并在进入前预读校验，定向及完整复验通过。新完整1451单元/Vite23.29s，全量类型仍19条既有范围外错误；不称全量typecheck通过。

版本c01-pickup-receipt-version.json，当前只读/保存实际范围及未完成项详见cutting-source-audit。C01.04c保持实施中：不是八组旧配料源/历史/旧日志完整迁移，亦不是新中央裁床页面或全部多物料/印花转裁剪来源验收。C01.04b旧布局及坏配置恢复待办、其他裁床链及整个目标保持未完成；正式响应另列当前采样。确认人Codex技术核验，不代表用户或现场接受，未提交或发布本阶段业务代码。


C01.04c接收响应补充：固定生产预览48340/1280×720/Jakarta/原1386 yard节点。原控制端1131/1032/1020ms及失败保留；观察器诊断同时记录浏览器约901～911ms完成、控制端约1025～1121ms回报。未改产品，修正为真实导航/按下起点、必要图片/字体/绘制及持久回读端点后，新7家族35样本最大929.4ms，各家族5条，控制端耗时也另存且当轮≤1000ms。脚本c01-pickup-production-paint-samples、原采样及诊断均保留，不能当作源码优化、全部裁床或整个拆分性能通过。c.1～c.3限定当前新记录/原Web路径的技术证据已取得，c.4的多物料/PRINT→CUT和c.5旧源历史继续实施，C01整体不关闭。


### C01.04c.5a 存放范围局部推进（2026-10-21）

新增cutting-pickup-footprint-command并适配原组件await，接收会话/明细位置及逐原单位ADJUST同事务，lastStorageAdjustmentId追溯，接收人/原数量不改，调整人单独具名带ID。原helper的0～原总量规则及有余量须保留位置不变，不新增未被实际页面调用的配料退回流程。九模式/七种备份破坏拒绝、双窗口竞争/同号重试/第三页冷读、原接收16模式取得直接证据；清零后再次零量丢仓的红记录已保留并按原IN范围修复。详细文件/证据/边界见cutting-source-audit末节。

完整1454/Vite23.53s通过，全量类型仍19条范围外既有错误；c01-footprint-version绑定当前源和资产。新构建原Web接收相邻7家族35样本最大985.3ms，控制端1038ms另存；不称新调整页性能已验。C01.04c.5a已实现待验证，c.5整体及C01继续实施：新中央界面/实际工厂任务来源唯一性/实际账号接收绑定、多物料/PRINT→CUT、旧源历史/日志/附件迁移和旧布局待办均未关闭。原非车缝旧PDA路由未为测试而解禁，不把组件接线冒充新中央实际小屏验收。整个目标未完成、未提交发布。


### C01 新中央接收/仓管的连续作业接续（2026-10-21）

C01.01/02/05当前独立来料来源及新页已实施，整节点原量/原单位、正式裁片分配、真实账号ID与物料图片共同保存；实际Web原分配任务派至OWN-CUTTING-001后在新页连续接收180 yard，再由原配料/拣货/暂存/确认新增10 yard接续，未把F090辅助仓当裁床仓。初次来源180→190但节点仍version1的真实边界被快照守卫阻断。两仓当前仓位/接收/交出记录沿明确本厂仓事实，不猜未归属历史。

本轮原生5模式/6种来源备份破坏拒绝、小屏双尺寸各22项、下一笔/清空退出/冲突读回/当前实物图9项、已提交但读失败4项、F1/Enter/图片失败重载均有实际日志。新增同秒位置调整ID及原时序比较器修复，既不覆盖前一调整，也不把库位14当最新12.5。13专项及完整1459通过；最终全量类型仍原19条范围外错误；生产18类追加采样以c01-central-key-production-samples为准，继承前17类及原Web相邻证据但不混资产版本。

C01整体继续实施中，完整执行/回收/交出/实收、多物料和PRINT→CUT实际来源、旧八组/日志/历史/附件、旧布局/损坏恢复仍未关闭；没有最终两菜单切换、提交或发布。代码当前新功能不是静态V34发布回执。阶段冻结输出为output/playwright/pda-factory-split/c01-central-receiving-warehouse-freeze.json，待整理证据后生成；它只保存当前进展，不替代完整workflow或目标接受。

### C01.06～08 实际加工接续（局部，2026-10-21）

继承C01，保持实施中。C01.06当前已连接正式确认方案自动按床投影的真实PB、本厂实际入仓来源和加工领用/关联回收共同事件；源单位不改标，yard/metre明确换算。独立小屏表单正在验领用/回收/扫码接续，不冒称铺布/裁剪执行已完成。cutting-source-audit末节登记当前实现、前置夹具错误、专项及开发页面证据；正式构建/命名响应后补，未发布。C01.07～08台位/实际原卷/耗用/完成铺布/裁剪，后续交出实收、旧资料与其他模块仍待实施，不用局部保存结果关闭总条目。

C01.06局部最终补充：新领用/回仓保存及真实多批、两位去重、回收再领、原单位/责任、五种坏备份实际恢复拒绝已获证据；最终1468单元/Vite27.50s，原19条范围外类型身份不变，新保存链七家族35样本均≤1000ms（最大766.8）。原Web首次1068.4ms仍未通过，实际铺布/裁剪/耗用/原卷/后续交接等未接全，C01总项及本子阶段继续实施中，不标整体已验证。证据和本轮冻结c01-process-material-freeze见cutting-source-audit末节；未提交发布。

### C01.07～08 实际逐卷铺布与裁剪接续（2026-10-21，局部实施）

继承C01，状态保持实施中。责任文件新增spreading-material-allocation/consumption/records、cutting-spreading-command、central-pda/cutting-spreading-model/view；原marker-spreading-model保留实产、具名完成及作废事实，原part-ticket共同保存增加用卷关系校验。source-audit本轮节绑定十/十二/十一项开发回放、四种实际恢复拒绝、13专项与1481全量、35.23s新构建及19条既有类型身份；原生产循环初始化空白失败和修复后的boot检查分别保留。数量单位、层段交接、逐卷内存草稿与失败不落盘局部已获证据，不替代全部C01/总目标通过。

原生正常/差异分组下游、当前生产动作响应与相邻原Web、两种交出/最终实收、其他床模式和多物料、旧源/历史/布局以及后续工序/三方仍需完成。确认人仅Codex技术核验，用户和实机接受未取得，未发布。本轮阶段冻结待最终证据整理，不能预填完整交付或最终workflow回执。

C01.07～08最终补充：当前生产21家族105样本均≤1000ms，最大914.5；正常PB生成16票、四个部位实例各20片，差异18件保留原值且原Web守卫不出票。当前原Web7家族35样本功能正确但首次1429.4/打开1015/历史导航1037.2ms不通过，原1068.4失败未覆盖。当前版本/原始样本/源资产清单绑定spreading-boot-fixed前缀。提交后回读前的另端改卷与其他待填草稿重绑需新增交错回放；已有提交前冲突不可代替。所有这些未关闭项和原有C01/其他模块待办保持实施中，未发布。

### C01.07～08 接续：交错改卷与原 Web 慢路径（实施范围，2026-10-21）

继承本轮完整目标，上一冻结34f366f6保留。双页面已复现：本端B事务complete后、返回读回前，另一实际账号正常修改A，原草稿A随后被自动重绑而可覆盖对方测量；需要只允许基于本次确切提交结果自动续填，不跨另端变化。比较信息只放本次页面内存，不增加业务快照或持久键；原稳定命令回放仍不得重复保存。表单需保留旧输入并展示当前已报事实，重新读取是员工明确核对动作，正常连续多卷不加步骤。

CPU剖析定位原Web首次部分开销来自PMS静态需求初始化→当前技术版本查询→款式产品配置全量解析，仅为读取款式主记录的currentTechPackVersionId。不改全局技术版本解析行为；新增同一原款式记录的轻量指针读取，只供PMS该入口使用，已发布状态/BOM/物料守卫不变。另在接收列表同步渲染/事件里复用现有生成裁片单读帧，并把本次已核对节点传给同次弹窗渲染，避免重复重建。读帧不跨事件/异步，不用旧源长缓存，不改布局或管理动作。涉及PMS启动直接读链，须前后发布物料输出等价和当前节点保存/后续冷读验证，不能只以性能变快作证。

| 编号 | 原子结果 | 工作包/实际文件 | 自动化/页面证据 | 状态 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- |
| C01.07c.1 | 提交后另端改卷不能使旧草稿静默获得覆盖新资料资格 | cutting-spreading-model、cutting-page | postcommit-peer-red/fixed/review及id-diagnostic；peer-read资产21家族105条 | 已验证 | Codex技术核验，本轮源 |
| C01.07c.2 | 冲突输入保留、已报事实可见、显式重读后可继续；正常多卷不加步骤 | cutting-page、cutting-spreading-view | postcommit-peer-review、multiroll-after-peer-guard、id-diagnostic；实际已报提示仍可能需向上滚动 | 已验证 | Codex技术核验，本轮源 |
| C01.LOAD.1 | PMS当前版本指针仍只取同一款式正式主记录，发布/BOM/物料结果不变 | pcs-style-archive-repository、pms/canonical-purchase-references | 2项指针契约，54款式15组46行结果SHA一致；原Web接收功能与新PDA相邻通过，性能单列 | 已验证 | Codex技术核验/peer-read-version |
| C01.LOAD.2 | 接收列表同次读帧与弹窗已核对节点复用，后续动作仍读取新来源 | pickup-management-list | 原Web七类功能正确，首次1304.9/历史1029.6ms仍失败；新PDA105条通过 | 已实现待验证 | Codex技术核验/peer-read-version |

### S01/S02 菜单接线及并发恢复进展（2026-10-21）

当前相邻两个FCS菜单按用户原图位置接到独立中央三入口和三方六入口；菜单key与路由独立，中央不引入登录/入驻商业动作，三方菜单不再出现洗水/仓管。`c01-menu-production-clicks`六项功能通过，截图`c01-new-pda-menus-production.png`已目视核对。`c01-menu-production-samples`四个入口各五条，最大接收181.4、执行314、仓管210.1、三方执行到实际密码登录114.2ms；每入口新隔离上下文，仪表盘加载为前置，真实pointerdown到目标内容/可见图/字体及两次绘制。末段误在首批未返回时启动另一隔离来源诊断，两个CLI命令时段有交叠；保留原始值和负载条件，不冒称独占机器。没有出现超时或借预热中央入口缩短时间。

最终当前源/资产绑定`c01-menu-version.json`：1484单测、Vite33.75s，类型仍原19条无新增。相对peer-read仅菜单配置及菜单测试两文件变化；peer-read的105条业务响应保留旧资产身份，不重标为menu资产证据。提交后/读回前真实另端改卷的冲突保护已验证，正常多卷仍自动续填；源指针结果等价且列表同事件复用已实现，原Web首次1304.9与历史1029.6ms仍未通过。完整T4原型治理、旧专项静态断言、19条类型问题及整个逐工序/三方目标保持未完成。

继续C01.12：实际20件裁剪的16票尚未完成正式首次打印和放行/任务分配前置，未预填简易交出成功。旧源打印命令的初次动态导入撞到Vite时间戳双实例，`c01-simple-real-printed-release-inspection`只记采集无效，下一次用同一静态模块入口，不改业务保存守卫。

### C01.12a 正式首次打印与放行来源接续（实施前范围）

实际原Web首次打印命令成功并落part-ticket:records/jobs后，generated-fei的实际输出仍是WAIT_PRINT，listReleaseSourceTickets未叠加正式打印状态；初始生产单因此被generated-cut-release的现场激活规则排除。本次只将与当前实际票的生产单、裁片单、PB、产出、SKU/部位实例、票号及数量完全一致的正式打印状态叠到放行来源；未打印、错票/跨单/旧数量不激活，作废不复活。装袋贡献、工艺回仓、风险放行和任务分配原规则不变；不把20件实际裁剪等同3500件任务完成。没有新存储或普通读取写入。

| 编号 | 单独完成条件 | 实际位置 | 验证计划 | 状态 | 确认人/版本 |
|---|---|---|---|---|---|
| C01.12a.1 | 身份一致的正式首次打印可被放行源读取，错单/旧票/旧数量不激活，作废不复活 | 新纯打印状态投影、cut-piece-release-facts | 三项契约、原有效装袋脚本、真实16票/80片与刷新回读通过；带打印源首次1034ms及正式交出前置未关闭 | 已实现待验证 | Codex技术核验/c01-release-print-version |

补充红回放：实际16票/80片进入原首打命令后仅14票/68片落正式打印记录；另2张L码前/后片被显示投影生成的演示打印项误当成已首打。C01.12a.2限定修正原recordActualFeiTicketFirstPrintFromPreview：判断本次实际票是否已打印只认正式part-ticket:records，显示用演示项不能抵扣真实首打数量，保留其他票/原历史和打印作业；正常16票、同意图重试与刷新独立回读为验收。不改打印样式或制造物理打印已发生的证据，隔离原型仅验证记录行为。状态实施中。

### 当前打印接续最终核验（仍是完整目标的进展）

C01.12a.2已实现待验证：原首打只认本次实际票的正式记录。真实16票/80片保存、刷新独立回读和读取零写入通过；稳定确认号重试仍返回原16票结果，新确认再次首打为0，原票/打印作业/用卷及物量不变。`c01-simple-real-print-readback-fixed`十一项、`c01-simple-real-print-repeat`三项通过；当前三项打印状态契约及原有效装袋脚本通过。

`c01-release-print-build.log`完整1487单元和Vite24.81s通过，源189文件/资产1302绑定`c01-release-print-version.json`；全量tsc仍19条与menu版完全一致，无新增，但并非通过。CodeGraph本轮7文件同步完成。新共享打印状态改变放行事实的读取，当前47条原生记录/16正式票/80片、320×480/Jakarta/印尼语的冷进/刷新各五条：冷进1034、1012、1010.6、984.7、987.9ms，失败；刷新774.5、755、756.5、755.1、755ms，通过。CPU诊断单列，仅用于定位，不用较快的904.9ms替代正式失败；开销分布在原运行任务、共同交接初始化、配置读取/clone，未据此猜测打印解析就是根因或盲加缓存。采样资源来自任务记录的实际共享机器，不停止用户进程。

原fei-tickets列表静态门禁本次退出1：该历史页面未完整使用现行标准列表骨架/表格/分页；此次真实首打行为变更不适用纯文字历史例外。原材料专项字面断言、总体原型治理与19条类型问题仍保留未通过；不改基线、断言或整体结论刷绿，最终全目标门禁须继续。当前没有最终workflow回执、Git提交/推送或部署。本轮可恢复进展冻结至`c01-peer-menu-print-freeze.json`，不代表全部裁床或两套PDA交付。下一项按真实来源建立可合法派出的完整SKU/新小生产单，再核对简易裁片/整袋交出；其他中央工序、三方和历史迁移继续原范围。

### C01.12b 中央执行中的任务单裁片交出（实施前范围与接续证据）

本阶段独立新写model/view接当前simple-cut-piece-handover，不复用旧PDA UI、权限面板、分页表格、重复确认。执行入口扫码当前正式任务单（不拿裁片号猜下游），本页显示原款图、任务/生产单、下游工厂/PPIC、整票片数、当前可交与原交出/仓管确认接收结果；按原流程一次明确确认。未形成可交整票不出现确认动作。接收及仓管不新增交出按钮。任务/账号/工厂隔离，识别失败保留原单但不能误交原单；下一单清本笔读状态与请求，不留空业务草稿。失败保留稳定请求号，提交后读回失败只重试同命令；角色按真实账号资料映射，保持原工厂/身份校验，不在页面显示权限卡。

| 编号 | 原子结果 | 文件/工作包 | 验收 | 状态 | 确认人/版本 |
|---|---|---|---|---|---|
| C01.12b.1 | 执行下可扫正式任务单并显示真实下游/整票当前量 | 新cutting-handover-model/view及cutting-page | 原任务单/错误码/零可交/图片/320×480中印 | 已实现待验证 | Codex；本节及cutting-source-audit接续证据，未代表整个C01完成 |
| C01.12b.2 | 一次确认沿原命令共同保存且只记实际交出人/原仓管确认接收责任 | 同上及原confirmSimple可选当前源校验 | 正常、旧源、重复/失败/读回恢复、实收查看 | 已实现待验证 | Codex；本节及cutting-source-audit接续证据，未代表整个C01完成 |
| C01.12b.3 | 多任务扫码/语言/返回/下一笔/清空/换人不串单，不留空草稿 | cutting-page现有内存与frame | 按键/错误重扫、当前按钮及切换实收视图 | 已实现待验证 | Codex；本节及cutting-source-audit接续证据，未代表整个C01完成 |
| C01.12b.4 | 按原任务面料带齐已打印换片布，5 Yard与裁片片数分别保存/显示，同任务后批不重复要求 | cutting-handover-model/view、原replacement-fabric校验及同库命令 | native第一批700片+5Yard、第二批200片；已交/未打印/重复/账号/最终来源变更与原子回退 | 已实现待验证 | Codex；已接线并有开发回放，最终资产验收及整个C01仍须分别判断 |

本轮新隔离20件输入已通过原当前技术包建单、正常任务拆解/裁剪派单；当前正式版本实际含3物料、染印洗及多项特殊工艺，不能为测试删掉前置或把大单3500改成20。该来源仅为合法输入/任务生成证据，完整交出正向仍须准备其真实依赖或完整的其他现有来源。原物料/库存来源只读核查继续；不擅改生产建单/版本选择的业务规则。

C01.12b接线后的实际红回放：沿当前Web固定来源可读700片/应交900片，原Node集成及43项实收投影通过；但新中央实际IndexedDB提交被共同换片布校验拦住，因为该校验无条件读取旧PDA全局会话。不能通过写旧会话或把PDA事件改标Web规避。新增最小的显式PDA动作人引用：仅简易裁片事件按其原warehouseFactoryId、事件实际账号/姓名匹配当前正式账号及原角色操作许可；旧调用未提供该引用时保留原检查，整袋暂不改变。身份信息只来自新中央当前登录资料，不新增鉴权平台、权限提示或另一会话。正常、伪造发方/账号、无旧PDA会话及native失败恢复必须分别验证。

C01.12b.4补充当前Web强制换片布随交：native红回放在独立身份核对通过后被原换片布覆盖校验拦住。新页必须同一扫码框加入当前生产单已正式打印的HPB票，按实际任务所需面料覆盖，每票5 Yard；之前已随该任务交过的面料不重复要求。片数与Yard分开显示/确认/实收，不增加PDA建票或打印步骤。错单、错料、未打印、已交、他袋占用及重复扫码沿原函数拒绝；请求/选择按账号+任务隔离，返回续填、移出票与清空不串单。必须验证700片+5Yard第一批、200片第二批不再交5Yard，及事务失败/冲突/换人。此项实施中，不能以旧Node脚本未覆盖native换片布校验而称全部已通过。

本轮实际小屏红回放还复现“扫码已加入、底部按钮一直灰；切语言后旧扫码内容回来”：替换仍聚焦的输入框时同步触发focusout，原全局入口按input补存，导致已清空的扫码值回写。本轮只在中央裁床局部DOM替换期间屏蔽这类重入输入事件；真实用户输入与Enter/F1仍照常处理，跨路由旧DOM用可见路径核对，避免保存到新任务。校准前失败及诊断保留，修复后320×480印尼语七项通过，无旧PDA会话。

原runCuttingEventAction对非pickup动作在事务complete后的读回失败会抛普通错误，PDA无法区分已保存与未保存。现在所有该仓库动作的后提交读回错误均带现有committed标志，稳定命令结果与保存流程不改；原Web消费者的提示及直接相邻应一并核对，不能把未读回当未保存或重新发起。此为C01.12b.2/STORE-02必要恢复修复，最终native故障回放待执行。

C01.12b本轮接续：新中央任务交出已接原确认命令、明确下游工厂/PPIC、整票片数、换片布与原仓管确认接收，不创建另一份收方接收。数据对象为原cutting-events、replacement-tickets/prints/receipts及稳定commands，继续同库同事务；新增页面草稿只在按账号+任务隔离的内存中，不新增业务localStorage、旧PDA会话、附件或后端。四类执行结果仍沿当前原型，整袋交出与自然新生产单来源未借此关闭。

连续作业红回放补充：下一单旧DOM仍可输入、Enter被可见路径保护丢弃，现同一交出页内立即更新内容和焦点；跨页期间禁用旧控件，待新页可操作后继续，未增加确认。已明确清空某任务的换片布后必须重新扫码，不能用测试假定“仍保留”而改产品。追加第二批也会让未交L码从560片变720片，旧测试560预期已按真实来源纠正。

保存最后边界红回放：早期两个同步校验通过后未把可选assertCurrent传入最终IndexedDB事务，native故障断言实际保存1笔交出/1笔换片布。已接到最终提交前校验，同样故障下两个集合均0；稳定已提交命令仍先回放原结果。原Web共享窗口也去掉“已保存”前错误叠加的“交出未保存”，native组件真实按键重试只留下原700片和1张换片布。不能把组件回放写成整个Web列表验收。

加载范围：交出模式只读取本页任务/实物/换片布，不计算无关接收、铺布和仓管列表；仅进入交出时加载其业务模块。旧资产交出首开1153.2ms、聚焦读取后相邻铺布首开1088.7ms/刷新1164ms均保留原身份；不能用单轮校准或新快值覆盖这些失败。最终版本/家族和新样本以cutting-source-audit及审查补充为准。

C01.12b最终本轮证据为c01-handout-lazy-version及三组正式样本；60家族300样本功能/持久回读正确，但4类加载仍有5个>1000ms样本，当前C01.12b.1～4保持已实现待验证，完整C01及目标均未完成。完整1491单元及构建通过，tsc同19项既有诊断；详细源/资产哈希、各类最大值、原始失败与继承边界见cutting-source-audit末节和本阶段审查。

### C02 毛织独立新端开始（继承完整目标，非裁床问题关闭）

C02的实际Web两阶段、纱线去皮与按批领退、横机对应件数/外发片数、内部自动衔接及外加工真实回货、完单和机器关联已定位；详见wool-source-audit的C02.01～08。先实现独立当前源/原实收命令适配并以原生正向和边界核对，再接新页面/路由及执行/仓管，不复制旧Web/PDA的UI或会话。C02主项保持实施中，其他未完范围和裁床4类加载失败仍保留。

### C02 纱线接收阶段进展（2026-10-21，整体仍未完成）

实际中央账号独立接收已实现；旧三方会话干扰、同源追加并发超收、首次读取失败停在骨架已逐一复现并修正。业务依据、同库保护标记、受影响原Web入口、精确件/片/kg界限、源码清单及全部证据见wool-source-audit.md接收阶段。当前构建120条有效响应覆盖24个指定接收动作家族，均各5条≤1000ms；不覆盖其余毛织动作或其他工序。1497项单元通过，完整tsc仍19条原问题。执行和仓管目前分别是只读阶段单与接收记录，C02.03～05待实施；完整C02、裁床旧慢样本/整袋、其余中央/三方、迁移/最终收据和发布继续未关闭。目标active，不发布中间业务版。


### C02加工填报阶段进展（未关闭C02）

2026-10-21：当前原子范围和实际边界见wool-source-audit。毛织按实际横机/缝盘阶段、逐SKU对应成衣件数填报；原自动交接/实收/缝盘不重复人工操作，原Web与PDA共读实际数量和责任。原生双窗口保护按实际staged写入涉及的单据，未把查询投影误当保存。已修复聚焦保存按钮按Escape误保存、新笔残留旧“已保存”、字段名被滚出小屏三处问题；只限毛织，不能升级其他模块的X07状态。

当前source-manifest 7acab60b1a0c3f252aace81b4c784eb502a3734e8c39134dbff21794e5ff29a8，asset-manifest 8f7bd4bdfe3be6dfa072c94eb05d1387828ae38146d770e3094a7b5237c0ba17。最终15相关契约及Vite31.22s通过；1503全量单测对未改的模型/存储依赖复用，完整tsc仍与父接收版同19错误，退出2。当前400有效生产样本/80家族中功能核验均通过，79家族响应通过；原Web横机加工单cold第4样本1067ms，超过1000ms，C02.08/V02未完成。先前诊断、按键误保存失败和旧版采样原样保留，不以快值覆盖。

下一步仍需实际外发片/缝盘成品交出、交出单URL扫码与真实下游独立实收、两仓/领纱退纱/分配、机器/完单、其余并发与历史写入边界及该冷加载问题。裁床上一冻结的慢样本和其他所有未闭合条目继续有效；不提交、推送或发布中间业务版本。当前技术进展冻结位置output/playwright/pda-factory-split/c02-wool-report-progress-freeze.json；不等同最终workflow收据或用户接受。


### C02.03a 手动交出阶段接续（完整目标不缩减）

本阶段12文件差异、当前版本、785样本与原失败保留详见wool-source-audit末节。下列均为局部实现与技术证据，尚须随完整C02/中央及三方目标最终审查；不关闭C02、X02或X11。

| 编号 | 来源 | 原子结果 / 实际文件 | 自动化及页面证据 | 状态 | 确认人 / 版本 |
|---|---|---|---|---|---|
| C02.03a.1 | C02/X01 | 横机按原SKU/部位的可交片数和首节点，缝盘按件和原下游交出；wool-handover-model/view | handover单测、native-chain-linking-fixed、production-linking及production-pieces前缀 | 已实现待验证 | Codex / handover-actor-fixed-version |
| C02.03a.2 | X02/STORE-02 | 原交出和收方来源原子成功、稳定重试、同额度并发只成功一次；原addWoolHandover/runWoolRecordCommand | native abort/race、最后23契约；无新库存事实或后端 | 已实现待验证 | 同上 |
| C02.03a.3 | C02/X02 | 仅实际收方确认显示实收，保留未知/明确0/分批余量及真实责任；wool-handover-model/view | 实际原Web2片实收、production-pieces-tail五轮、错厂错部位账号关联契约 | 已实现待验证 | 同上 |
| C02.03a.4 | C02/X11 | 原交出单URI逐段解码一次并核对单/阶段/笔/本厂，扫码只读本笔/全部；handover-code及wool-page | URI单测、production-web-qr真实SVG/款图、115条成品交出样本；未执行物理打印 | 已实现待验证 | 同上 |
| C02.03a.5 | C02/X07 | 加工/部位交出草稿隔离，返回/清空/语言/换人不串笔，不把旧部位自动换另一部位；wool-page | pieces-actor-fixed23检查、当前生产分片与400相邻回归；320×480截图 | 已实现待验证 | 同上 |
| C02.03a.6 | STORE-02/X07 | 已提交连续读失败维持锁定、重读不重交，已提交输入退出不伪报未保存；wool-page三保存路径 | 生产read-recovery20组/115样本均一次native提交；原红证据保留 | 已实现待验证 | 同上 |
| C02.03a.7 | C02/当前Web | 缝盘沿全部必需部位实际回货容量，不重复要求横机纱线；wool-model及execution-view | native两部位各回3片→可报3件→交2件余1；仅一部位回货仍拦截 | 已实现待验证 | 同上 |

紧接本阶段须显式接通工艺厂中央PDA的毛织片来源批次接收/原工艺加工及回交；special-model当前排除woolPieceKey/woolFinalInputOrderIds，不能删过滤后套普通接收。毛织两仓/分配领退纱、机器/完单与其他原范围继续，历史性能失败和最终治理/收据没有关闭。目标保持active，未发布中间业务版。


### C02.03b 毛织外工艺片显式接线（继承完整拆分，2026-10-21）

本段只把原毛织片工艺节点接到独立中央PDA。普通special-model仍排除woolPieceKey/woolFinalInputOrderIds；实际工序入口通过“毛织片/Potongan rajut”进入wool-craft命名页面，不套普通累计确认接收。原命令/同库事务及原Web完工条件继续作为事实源；不新增业务存储、独立库存或发方代实收。所有条目须与完整C02/C08及X02/X07/X10/X11最终验收，当前不关闭主项。

证据根目录output/playwright/pda-factory-split；技术核验人Codex，不是用户接受。源码为本任务工作树差异；本段先绑定已实现的对象和实际开发证据，最终构建/命名性能证据已在wool-source-audit补充，未把局部通过当主项关闭。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / PDA / 性能证据或边界 | 状态 | 证据位置 | 确认人和版本 |
|---|---|---|---|---|---|---|---|---|---|
| C02.03b.01 | C02/C08/X02 | 毛织片只经其原工艺单分支，不走普通辅助工艺累计接收命令 | WP3 | wool-craft-model/page；special-model、page、entry、routes-central-pda | central-pda-wool-craft；原入口实际点击 | ui-entry；login-fixed-production-flow入口/操作组5轮 | 已实现待验证 | c02-wool-craft-ui-entry.json | Codex / 当前工作树 |
| C02.03b.02 | C02.02/X02 | 接收按原实际交出来源和行逐批确认，保留各批独立剩余 | WP3 | centralWoolCraftContexts/ReceiptRequest | 原生两批3+2，分别实收；改变来源阻断 | native-model、new-source-ready；实际界面不自动换旧批草稿 | 已实现待验证 | c02-wool-craft-native-model.json | 同上 |
| C02.03b.03 | X01/X02 | 工艺片保持原片/potong正整数，默认物位不在接收页选择或展示 | WP3 | wool-craft-model/page | 新7契约含单位及默认库位 | 接收无加工/交出按钮或库位；仓管仍可读实际库位 | 已实现待验证 | c02-wool-craft-ui-entry.json | 同上 |
| C02.03b.04 | C02.03/当前Web | 加工不得超过实际实收未加工片数 | WP3 | saveCentralWoolCraftAction → executeWoolCraftAction | 余量/来源变化/错厂/闭单/整数契约 | 实际3片接收→加工2片余1片 | 已实现待验证 | native-model、ui-entry | 同上 |
| C02.03b.05 | C02.03/X02 | 交出不得超过实际加工未交片数，并原子生成真实下一节点来源 | WP3 | 原Wool工艺HANDOVER/同库命令 | Quota同时回滚；稳定重试 | 实际交1片、原来源与责任冷读；不写其他工厂假实收 | 已实现待验证 | c02-wool-craft-native-model.json | 同上 |
| C02.03b.06 | X02/X11 | 实收由真实直接下游独立确认，查看时重新读取该笔实际数量与人 | WP3 | centralWoolCraftOutgoing；refreshFacts | 实际毛织方接收，未收与明确0区分 | mode/scan/warehouse记录点击读取最新事实 | 已实现待验证 | c02-wool-craft-ui-completion-fresh-receipt.json | 同上 |
| C02.03b.07 | 当前Web/C02.05 | 完工严格沿原计划及直接下游收齐门禁，不把150%填报上限当计划 | WP3 | centralWoolCraftCanFinish；原COMPLETE | 原计划100与上限150只读核对；原命令再验 | 原100片全链，真实收方100片后才能完工；未回另一个必需部位仍阻断缝盘 | 已实现待验证 | c02-wool-craft-plan-baseline、completion-fresh-receipt | 同上 |
| C02.03b.08 | 用户四按钮规则 | 完工后只保留详情和记录，无再次接收、加工、交出或完工 | WP3 | wool-craft-page completed分支 | 新闭单契约 | 实际完工及刷新后的只读界面 | 已实现待验证 | login-fixed-production-complete原100片5轮只读刷新 | 同上 |
| C02.03b.09 | X07 | 草稿按工厂/账号/单/来源批/动作隔离，返回续填、清空和换人不串笔 | WP3 | 页面内存drafts/modes/batches | 原生保存与实际键盘回放 | ui-entry、各动作草稿、清空退出新账号，无业务localStorage | 已实现待验证 | c02-wool-craft-ui-entry.json | 同上 |
| C02.03b.10 | X07/X11 | 扫错保留当前输入并阻断，重扫精确来源或新到批次后恢复 | WP3 | identify/refreshFacts | old source变更契约 | 原来源URI校验；页面打开后新增真实批次仍可读到 | 已实现待验证 | c02-wool-craft-ui-new-source-ready.json | 同上 |
| C02.03b.11 | UI-01/X07 | 小屏字段与主按钮持续可见，数量输入更新不破坏一次原生点击 | WP3 | update稳定文字节点；F1/Enter/Escape | 实际pointer事件诊断与全计划交出 | 320×480/Jakarta/印尼语，无横向溢出；非物理驱动验收 | 已实现待验证 | completion-click-diagnostic、ui-entry | 同上 |
| C02.03b.12 | STORE-02 | 提交后反复读失败仍保持已保存锁定，重读不再提交原数量 | WP3 | submit/pending/committed | 四分支原生一次提交恢复 | 首次、重复失败及语言/恢复、新账号，实际native次数1 | 已实现待验证 | c02-wool-craft-ui-read-recovery-login.json | 同上 |
| C02.03b.13 | X07/STORE-02 | 首次读取失败可重读；明确退出后能换人，不被旧读取错误挡住 | WP3 | primary/content/login error与signedOut分支 | cold-read红/修复；saved-logout红/修复 | 首次读取恢复与已保存后退出必须分别核验，不能相互替代 | 已实现待验证 | cold-read-ready、ui-read-recovery-login | 同上 |
| C02.03b.14 | C02.04/UI-01 | 仓管实际库位与收发记录可完整查看，首屏有界且能继续显示后续记录 | WP3 | warehouseRecords/outgoingRecord；warehouse实际taskId与SKU映射 | 实际16接收/16交出，33条任务历史 | 原固定演示记录仍保留；按时间全局排序并继续，无仓管接收/交出操作 | 已实现待验证 | warehouse-records-red、records-ready | 同上 |
| C02.03b.15 | STORE-02/C02.07 | 原Web和新PDA争用同一实际3片额度只成功一笔2片，余1片 | WP3 | 原runWoolRecordCommand/owner guard；新适配 | 双方原生orders意图屏障同时释放 | 护栏版本只加1，原native记录一次；非内存互斥冒充 | 已实现待验证 | c02-wool-craft-native-owner-race.json | 同上 |

毛织本厂两仓/备料分配/领纱退纱/机器/完单、旧源/共享库存并发、当前批/整单实收的整体一致体验、其他中央/三方工序、历史性能失败、图片对应与最终治理/收据仍按原范围继续；不因本段局部测试缩减目标。

### C02.04 本厂纱线仓管接续范围（实施前登记）

继承 C02.03b 冻结版本，不缩减完整拆分目标。以当前 Web wool/warehouse、stock-allocations、原 issueWoolYarn / returnWoolYarn / allocateReceivedMaterialToOrder 为依据。独立 PDA 仅适配已有动作，复用同库原子保存，不复制旧 PDA 页面，不写测试站数据库。领用/退回保持 kg 有限正数；接收称重的三位小数限制不自动变成领退纱的新业务限制。库存按原单、纱线、批次和具体物位区分；退回上限按原单/SKU/批次累计领用减退回，零库存但有未退领用的行仍能退回。备料分配只改归属，不重复接收或增加总库存。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / PDA / 性能证据或不适用理由 | 状态 | 证据位置 | 确认人和版本 |
|---|---|---|---|---|---|---|---|---|---|
| C02.04.01 | C02/X04 | 本厂待加工纱线按真实库区/库位/SKU/批次和所属单显示，待交出片/成衣保持原单位 | WP3 | wool-warehouse-model/page，entry/frame 显式接线 | 7契约含只读、有效交出量、同批两物位、原跨物位退回累计上限；native-model | 320×480真实库位/空库位、两仓原件/片；location-fixed-production-flow/pieces | 已实现待验证 | c02-wool-stock-model-boundaries-unit.log、ui-local-flow.json | Codex / location-fixed版本（技术核验，非用户接受） |
| C02.04.02 | C02/当前 Web | 领用不超过该实际库存行；退回不超过同单/SKU/批次未退领用，保留原动作事实与经手人 | WP3 | 原 issueWoolYarn/returnWoolYarn；独立适配 | 7契约及native-model：超量/零库存可退/错账号/闭单/稳定重试/Quota回滚 | 真实UI分配/领用/退回及故障后续填；location-fixed-production-flow/recovery | 已实现待验证 | output/playwright/pda-factory-split/c02-wool-stock-* | 同上 |
| C02.04.03 | C02/STORE-02 | 已收未关联纱线仅分配给本厂有效同 SKU 横机单，不重增库存 | WP3 | 原 ReceivingAllocation / projectFactoryReceiptsIntoWool；新适配 | native-model分配不重增库存、目标与来源校验、失败重试 | 真实原实收笔/目标横机单，单次明确确认后原生冷读 | 已实现待验证 | output/playwright/pda-factory-split/c02-wool-stock-* | 同上 |
| C02.04.04 | X02/X07 | 独立 Central 账号不受旧 PDA 登录串扰；并发分配同笔备料不能超分 | WP3 | factory-receiving-links 可选实际actor；wool-domain/store 原事务共享明细guard | native-identity-transaction真实15kg超分失败；allocation-guard修复余2kg；missed-notification旧快照拒绝/刷新后余9kg可分 | 原生共享明细ID集合/版本同事务；无内存互斥冒充；保留失败 | 已实现待验证 | output/playwright/pda-factory-split/c02-wool-stock-* | 同上 |
| C02.04.05 | X07/X11 | 库存行/动作/目标/账号隔离草稿；重扫、返回、语言和换人不串单 | WP3 | wool-warehouse-page Draft/target/root selection内存；原Central session及丢弃代次 | ui-local-flow、ui-local-read-recovery；pending-discard-red及修复，旧请求不恢复已放弃草稿 | 本仓管按真实Back/换人/迟到失败已验；其他工艺页异步离页风险仍未关闭；本页location-fixed-production-flow/recovery | 已实现待验证 | output/playwright/pda-factory-split/c02-wool-stock-* | 同上 |


| C02.04.06 | X02/X11 / 实际漏项 | 仓管交出记录读取有效交出量、真实实收/待收、原收方及时间；不由发方代确认 | WP3 | centralWoolWarehouseHandovers / records；原receipt actor只读关联 | 新有效数量投影契约及真实3片交出/2片实收账号断言；最终1525单元 | location-fixed-production-pieces：原Web收2，仓管剩1/原实际收方，可继续查看超过15条 | 已实现待验证 | wool-source-audit对应失败/修正；同名前缀JSON | Codex / location-fixed版本 |
| C02.04.07 | X04 / 当前Web | 原纱线/裁片/成衣默认库位分别显示；实际物位身份不变 | WP3 | positionLabel / stockLocations | 原Web warehouse三种默认位置原字典核对，未改存储 | location-fixed-production-pieces：分别打开原40件成衣及4片部位位置 | 已实现待验证 | 同前；校准误点成衣位置的失败保留 | 同上 |
| C02.04.08 | UI-01 / X11 | 印尼语保留部位Q/R与原片序，不把同SKU不同片显示为同一实物 | WP3 | stockName / woolPieceName；记录及库存卡 | 原部位事实与中印只读展示，不改SKU/二维码/身份 | location-fixed-production-pieces：独立部位余额、两语言、实际图片/原单位 | 已实现待验证 | 同前；最终320图及JSON | 同上 |

不在本小阶段新增库存调整、通用盘点或权限提示。Web 已有移库/调整仍作为后续 C02.04 范围登记，尚未适配不声称两仓完整；机器/本厂完单及全部其他主项继续。实施→专项→真实页面/持久回读→生产构建及命名性能→记录后冻结；本阶段不提交、推送、部署，不覆盖父版证据。


C02.04 接续核查变更：当前待交出记录在真实3片交出、下游分批实收2片的路径中仅显示数量，漏显示原实收人及待收余1片；历史演示经手人未翻译，且当前记录直接读原交出初值而非原数量变更后的有效值。新增 C02.04.06：仓管只读记录逐笔保留当前有效交出量、原收方实收及待收余量、实际收方姓名/可核对的原账号与时间；未知实收不写成0；正式批次身份保留，不新增接收/交出操作。责任文件 wool-warehouse-page/model、原 wool-handover-model 参数范围及直接契约；先保留失败，再以原Web真实分批接收、当前PDA仓管及原生记录回读核验。当前状态已实现待验证，最终location-fixed源/资产与新性能单独绑定，不改标已取得的前版835条样本。

C02.04.07/08 同轮实物识别补充：原Web分别定义纱线/裁片/成衣默认库位，新仓管不可把后两者都显示为同一“原默认库位”；印尼语库存片名称复用原 woolPieceName，保留 Q/R 与片序号，不退化为相同SKU。先前误点首个成衣库位的校准失败保留，后续按实际裁片默认位置选择核验。


C02.04.01～08本轮技术证据接续：location-fixed版本最终1525全单元、engineering、Vite27.72s；完整tsc仍同19原错误，未通过。原生分配并发、漏通知旧快照、Quota回滚、稳定重试和实际原记录回读已核。最终1040有效样本/208家族各5条、最大679ms，六组覆盖接收/填报/部位片交出与原Web实收/后续工艺/本仓分配领退/30故障恢复场景；聚合、源/资产清单、逐组JSON及9文件语义差异见wool-source-audit。local版835保留旧身份，校准中的有效1050ms刷新及父版1067/C01加载失败不关闭。本阶段条目仍已实现待验证：完整任务与治理/最终收据未通过，本厂移库/调整/机器/完单、其余工序/三方/旧入口/图对应继续，不声称整套PDA完成。


### C02.05 原完单与设备关联的接续核查

继承 stock-progress-freeze 4164f367…，详细源核查、正常/边界基线及 C02.05.01～05 计划见 wool-control-source-audit.md。当前只完成原Web/原命令核查：横机完单核首工艺实收，不等外工艺回货/缝盘完单；整组设备保存/解除与占用转移确认分别保留；维修停用不选。原stock-machine脚本退出0，同一原生WM-003双单真实意图竞争仅一次成功且冷读一条关联/日志。原生版本已覆盖该场景，不据此预建通用锁或宣称全部并发已完成。独立PDA完单/机器界面与适配仍待实施；本附录不在上一冻结包内，运行源码仍为已验location-fixed。其他主项与全目标未关闭。


### C02.05 当前独立完单/整组机器实现与证据（2026-10-22）

继承stock冻结4164f367…，当前生产源码/资产与六个实际变更文件绑定c02-wool-control-current-version、source-review-map，详细正常/边界/失败原始回放见wool-control-source-audit。以下只对应毛织本阶段；C02整体、其他中央工序、三方、旧入口整改和最终收据仍实施中。1529项单元/工程类型/Vite通过，完整类型仍原19条不通过；治理历史失败保留。没有发布、现场或用户接受。

| 需求编号 | 来源章节 | 原子需求 | 工作包 / 实际文件符号 | 自动化验证 | 页面 / 持久 / 性能证据 | 状态 | 证据位置 / 确认人和版本 |
|---|---|---|---|---|---|---|---|
| C02.05.01 | 当前Web/用户完单 | 整单满足原每SKU计划、直接下游有效交出及实际收齐后才能完单，实际登录员工负责 | WP3 / wool-control-model.centralWoolCompletionRequest，原completeWoolWorkOrder，wool-page | central-pda-wool-control4项及原stock-machine；完整1529 | 未知/99/100实收三分支、原实际账号/冷读；production-flow | 已实现待验证 | c02-wool-control-ui-linking-receiver-resolved、current-source-review-map / Codex技术核验，current-version；全目标门禁未关闭 |
| C02.05.02 | 当前Web/STORE02 | 完单和横机整组解除共同保存，成功后只读，缝盘不解除机器 | WP3 / 同上，原runWoolRecordCommand | 原完成快照/档案保留/稳定重试契约 | native-completion-quota-records、completion-machine-race、production-completion-recovery；原生行回退/冷读 | 已实现待验证 | 同前缀当前证据 / Codex；不是实物完单 |
| C02.05.03 | 当前Web/整组 | 未完横机沿原前置保留、增减或整组解除，记录当前实际员工 | WP3 / wool-control-model.centralWoolMachineRequest，原replaceWoolMachineAssociations，wool-control-view | 维修停用/错账号/闭单/缝盘拒绝，稳定请求与改载荷拒绝 | ui-transfer-source-checked；同面板增减/全部解除/新账号原日志；production-flow | 已实现待验证 | 同上及native-transfer-recovery / Codex，current-version |
| C02.05.04 | 当前Web/交接责任 | 占用机器显示原单、生产单、款号、时间及当前目标，明确确认转移，改变选择撤销确认 | WP3 / wool-control-view，wool-page.controlRequest/saveControl，原expectedAssociationSnapshot | 原生竞争、转移稳定重试不抢回、维修变更拒绝 | ui-stale-machine、ui-transfer-source-checked；原组其他机器保留；production-flow | 已实现待验证 | 当前530样本/106家族局部范围，不推广所有共享机器历史写入 / Codex |
| C02.05.05 | V34/按键/语言 | 返回续填、扫描异常恢复、切语言与退出换人不串单不复活旧操作 | WP3 / wool-page控制草稿及原Central session | 实际浏览器Back/原生屏障/晚到Quota | ui-keys-back13项、ui-pending-discard、production-flow及直接接收/加工/分批交出回归 | 已实现待验证 | current-production-summary：106家族530样本各5，最大640ms；320×480，仅原型技术核验 |
| C02.05.06 | 当前确认事实 | 确认必须对应员工当前屏幕的数量和整组/来源，后台合法新事实不能暗中替员工确认 | WP3 / wool-page.paintControl/controlRequest、model.expectedSource | stale-completion先红后绿、stale-machine变化 | UI旧100→原新101拒绝；原来源解除/维修拒绝；原生保存再校验 | 已实现待验证 | 详细原始红绿/边界见wool-control-source-audit / Codex |
| C02.05.07 | STORE02/连续作业 | 已保存但未回读时面板、关闭、切语言、返回均只恢复原请求，不暴露旧修改 | WP3 / wool-page.lockedControl/primary/content、原稳定命令 | ui-read-recovery红绿；原生一次保存 | production-completion-recovery4家族20样本，machines分支production-flow；关闭后root锁定/重读后恢复/退出无空草稿 | 已实现待验证 | 当前版本；最终全入口/整项目门禁仍未闭合 / Codex |

实际查看320×480机器转移与完单截图，主动作/返回在屏内，印尼长按钮换行、pcs与mesin不同单位；没有中印混排或横向溢出。首节开工“尚未实现”是当时状态，不覆盖此处实际实现和证据；旧失败/慢样本保留原版本身份，不回填伪通过。C02.05当前局部功能通过仍不把整个C02标为已验证。


### WP4 三方直接交接/任务范围接续（实施前，2026-10-22）

继承毛织控制冻结fee8f945…，先修复已实际暴露的三方跨厂非车缝交接详情，再接续完整三方。真实ID-F021_admin直达F090水溶1134/1512米及裁床180片页面出现业务按钮，见third-party-source-audit及ready-red完整body；最初仅taskNo断言是采集器错误，不当作无泄漏通过。

| 编号 | 来源 | 原子需求 | 工作包 / 负责位置 | 验收 | 状态 | 证据 / 确认版本 |
|---|---|---|---|---|---|---|
| S12.01 | 注意2/S12 | 三方交接头本厂归属且关联三种实际车缝任务，直接详情/事件/列表一致 | WP4 / pda-experience-scope及最小读取适配、pda-handover/detail | 真实外厂水溶/裁剪直链与伪造动作拒绝；本厂正常裁片/交出保留 | 实施中 | third-party-source-audit，尚未实现验收 / Codex |
| S12.02 | 注意2/S12 | 三方执行直接详情/事件在非车缝工艺分派前拦截 | WP4 / pda-exec-detail及同范围适配 | 三种任务/未知/额外工序/退役，页面及原生写入前保护 | 实施中 | 同上；完整执行/节点/结算仍另验 |
| S12.03 | 注意2/S13 | 三方交接无毛织/辅助/捆条/洗水操作分支，不删真实车缝领料及上游信息 | WP4 / pda-handover参数/区域/事件 | 旧查询参数、换厂、直链与真实车缝领料；无仓管入口 | 实施中 | 同上，未预填页面/性能通过 |

S13.01（新增边界）：真实KOL-GOTO当前也是三方车缝，原特例不得优先放出仓管底栏。负责pda-shell.getVisibleMobileAppTabs，真实KOL管理员登录菜单和直链、普通三方/卫星与原非三方相邻核验；s13-third-party-kol-warehouse-red已复现，状态实施中，尚未绑定修复结果。Web KOL整单和定价不在本变更。

S12.04（生产失败，实施前）：三方详情返回/交出Tab的重复只读来源准备不能互相抢保存锁；无快照/同一快照只合并正在进行的读，不同显式快照/保存/迁移仍阻断，同读失败一致且可恢复。负责production-context-records.hydrateProductionContextRecords及专项，实际栈与首轮缺失采样见third-party-source-audit；状态实施中，不删除生产失败，不以开发页通过替代。

S12.05：三方禁止仅支持辅助/捆条的exec/:sourceType/:id，三种车缝继续使用原exec/:taskId。负责pda-experience-paths与专项；保留路径读取前/事件分派前原守卫，不改中央/Web对应入口。原源码已确认，状态实施中，实际回退/五样本后补。

S12.06：冷拒绝直链重定向后，过期渲染须在加载PDA处理器前退出；新目标仍等原记录准备。负责main.render及实际AST测试。read-fixed生产冷入口未初始化错误保留，状态实施中，不能因隐藏非车缝内容就把空骨架当可用执行页。


### S12/S13 当前实现绑定（cold-fixed，整目标继续实施中）

前述实施前记录保留原时点；当前绑定以下实际文件/证据，不把首个骨架或采集器错误判成通过。确认人为Codex技术核验，版本s12-third-party-cold-fixed-version；非用户/现场接受。

| 编号 | 来源 | 原子需求 / 结果 | 实际文件 / 工作包 | 自动化 / 页面证据 | 当前性能及边界 | 状态 |
|---|---|---|---|---|---|---|
| S12.01 | 注意2/S12 | 交接归属及原三种冻结任务一致，异厂或工艺不能直接办理 | pda-experience-scope.isThirdPartyPdaHandoverScope；pda-third-party-scope；pda-handover/detail，WP4 | 新纯范围、real-login-event-guard原生未写、scope-fixed三外厂头、本厂真实交接 | 普通12家族60样本；完整三种生命周期仍未闭合 | 已实现待验证 |
| S12.02 | 注意2/S12 | 通用任务分派及事件前核对原三种范围和本厂原可见性 | pda-exec-detail；pda-third-party-scope，WP4 | real-login-tabs/event-guard保留原两状态任务、拒绝水溶执行；全1537 | 生产正常/异厂均通过；后道包装路由及其他旧入口待穿透 | 已实现待验证 |
| S12.03 | 注意2/S13 | 交接无毛织/捆条/辅助/洗水操作，旧工艺参数不进入，真实车缝上游信息保留 | pda-handover列表、参数与事件，WP4 | real-login-tabs、production-ordinary | 当前旧参数及区域通过，不能推广到全部接单/结算/历史入口 | 已实现待验证 |
| S12.04 | STORE02/实际生产失败 | 同一进行中只读请求共用；保存/迁移/不同显式快照仍锁定，失败同错可恢复 | production-context-records.hydrateProductionContextRecords；production-context-read-concurrency，WP4 | 三红绿契约、native-read-coalescing实际1读/同错/0写/原行一致 | 当前详情返回和Tab五次通过；GTP/HILON4家族20次≤387ms，原始生产失败保留 | 已实现待验证 |
| S12.05 | 三方范围 | 工艺专用双段exec在加载/事件前拒绝；三种车缝单段保留 | pda-experience-paths；third-party-pda-handover-scope，WP4 | typed-route先红后绿，普通cold-fixed实际5次回退 | 当前5次≤581ms；其余专用包装入口仍另核 | 已实现待验证 |
| S12.06 | 冷回退/连续作业 | 过期渲染不抢先加载处理器；目标先读完原资料再进入 | main.render；pda-sewing-detail-canonical-task，WP4 | 实际AST红绿及原正常门禁；普通/卫星/KOL真实冷回退均通过 | 当前三账号冷回退均≤1000ms，旧部位票未读错误保留 | 已实现待验证 |
| S13.01 | 注意2/S13 | 三方优先于KOL特例移除仓管，结算原角色条件保留 | pda-shell.getVisibleMobileAppTabs，WP4 | 真实三账号frame契约、KOL原红、当前生产三账号菜单/直链 | 菜单功能正确，KOL登录1060/1048ms未达标；不关闭S13整体 | 已实现待验证 |

cold-fixed 当前50家族250样本功能通过，49家族响应通过；KOL登录1家族未通过，详见production-summary和third-party-source-audit。当前全类型19条、治理历史失败、以前有效慢样本和其余主项均保留，不以1537单元或构建替代最终通过。毛织本阶段控制接入仍由其准确冻结fee8f945…及当前26家族130样本相邻回归分别证明，不篡改旧资产身份。


### C02.06 毛织仓管剩余操作与整体收口（2026-10-22，实施前）

继承 s12-third-party-progress-freeze `c4423c305b70e4d6e18bd1dd9995bef18ea61f230b732ef71b94dee50bf62a39`，不覆盖既有原始失败和局部证据。用户要求先收口毛织，再继续中央其他工序与三方；禁止中间发布。本阶段先对齐当前 Web warehouse/commands：实际物位只允许本厂启用待加工物位移库；默认物位允许库存调整及公共位置转出/原位置余额转回。仓储操作与加工单完单不同，当前 Web 对完单库存仍允许调整/转移，不能为追求统一只读额外改变现行规则。调整/转移保留当前命令必填原因与实际账号，不恢复已取消的通用异常面板。

| 编号 | 来源 | 原子结果 | 文件/验证计划 | 状态 | 确认人/版本 |
|---|---|---|---|---|---|
| C02.06.01 | 当前Web仓管 | 本厂实际纱线物位移库同单/SKU/批次，来源出与目标入原子保存，总量不变 | 新stock-operation-model；原transferWoolWarehouseStock；正常/错厂/停用/同位/超量/原生故障/并发/冷读 | 实施中 | Codex；尚未验证 |
| C02.06.02 | 当前Web仓管 | 默认物位调整按原kg/片/件，允许0、禁止负值及相同值，必填原因和实际操作者 | 同上；原adjustWoolWarehouseStock；默认与实际物位区分/整数/来源变化/失败重试 | 实施中 | 同上 |
| C02.06.03 | 当前Web仓管 | 默认转出到启用公共位置，按实际端点余额转回，不把同批另一端点当余额 | 同上；原transfer命令/逐端点投影；多笔/往返/部分转回/停用/重试 | 实施中 | 同上 |
| C02.06.04 | V34/连续作业 | 操作与实物隔离草稿，选位/原因/数字切语言续填，返回及换人不串单，已提交只恢复原笔 | wool-warehouse-page及独立短表单；320×480中印/按键/故障/迟到请求 | 实施中 | 同上 |
| C02.06.05 | 当前Web/X02 | 库管显示本厂原收发/加工入仓/调整/转移原事实，正确端点/单位/责任，不新增收方代确认 | wool-warehouse-model/page；原Web对照/零写读取/各记录分页及原冷读 | 实施中 | 同上 |
| C02.06.06 | 全部C02 | 重放接收→领退→报告/部位→外工艺→交出→独立实收→完单/机器及旧入口，当前同版证据核验 | 原源码/现有专项+补充直接上下游/中印/按键/性能；最后完整diff审查 | 待实施 | 同上；不得由前五项局部关闭C02 |

非范围：不新建仓库、不新增实物调整权限或审批、不改真实后端、不删除历史数据、不发布。共享命令存在源数量错误时先最小复现再按原业务含义修正，并核原Web直接调用方。已有效慢样本继续保留，不把后来快值当作根因已解决。

C02.06.07（实际原命令缺陷，实施前）：原Web给部位片库存提供调整/转移，但requireStockObject只认outputSku，store的片流水分支也拒绝仓储动作。原生红用例C02-PIECE-ADJUST已复现。将已有按钮实际对应命令补足为同单真实pieceKey、片数整数、待交出裁片默认位，仍由原追加账本校验库存守恒与端点；加工报告与原交接不变。责任commands.requireStockObject及store.validateWoolStore片分支，专项/原Web/新PDA相邻核验；状态实施中。另核默认物位调整不能把同批实际位置的量算作默认库存，先红后修。

C02.06.05接续范围：原通用仓管位置已同时含普通工艺与毛织片，但收发记录只读普通工艺账；毛织专页又只读毛织片。当前将同厂/同工序两类原事实只读合并，接收按逐次实际factory-receiving记录，交出按原Wool craft记录及独立收方实收，不新增日志、不去重掉分批，不把未知收货写为0。责任special-warehouse-history、warehouse与wool-craft-page，需一普通单+一毛织片分批收发/独立冷读/错工序/中印/分页核验。尚未验证。

C02.06验收补充：公共位置余额转回为0后，当前页不再给无效数量输入，主按钮为“下一笔”返回原转出库存视图。原Web局部交互夹具曾直接reset和用任意接收人写数据，被当前存储/账号保护拒绝；夹具改为原prepare、runWoolRecordCommand、真实启用账号及原生records只读快照，保留原批次隔离/转义/分页/移库守恒断言。产品保存保护不放宽。此项是C02.06.06直接Web验收的一部分，原失败记录保留。

C02.06.06原Web相邻实际竞态：夹具改用原生保存后，退纱保存尚未完成时打开移库，旧保存回调会关闭新移库弹窗。新增原Web仓管本页保存中控件阻断与提交值快照，保持原命令和操作人；防重复/新弹窗被旧回调覆盖/离页读取其他表单。局部检查保留原<200ms派发断言，但后续业务断言等原生保存/回读完成，不能再以同步内存修改当成功。需真实意图暂停下的按钮/字段保护、原生一次保存及后续移库回放。状态实施中。

C02.06.08（现场识别补充，待实施/验证）：同一SKU命中多个加工单、部位或物位时，原扫码候选仅有文本且一次展示全部。候选应保留原单号/部位/SKU/批次/实际物位与原单位当前数量，并按原对象展示真实缩略图；复用现有15条分批和继续查看。F1在该候选中应回到可见扫码框重扫，不能把焦点放到遮罩后的输入框。只改wool-warehouse-page，不改匹配身份、保存校验或业务事实；需实际SKU歧义/图片/分批/F1/返回续填/无写读取验证。


### C02.06 最终实现与技术证据绑定（stocktime → candidate-bounded → compact）

原实施前表与失败记录保留。此表只关闭本工作包的业务/技术结果；C02主项等待共享X10/X11、整目标最终验收及现场接受，不把阶段完成写成全部PDA完成。

| 需求 | 实际位置 | 技术验证与证据 | 状态 | 确认人/版本 |
|---|---|---|---|---|
| C02.06.01 | stock-operation-model / 原commands/store | 当前native/native-race、原子配对/4kg守恒/超领并发一胜一拒、物位/批次不串、原生失败无半套 | 已验证 | Codex技术；compact；非现场接受 |
| C02.06.02 | 原adjust命令、stock-operation-model / warehouse-page | 0/负数/相同值/片件整数、实际位不直接调、4kg实际位+1kg默认位分开、0库存返回再调、原原因/实际账号 | 已验证 | 同上 |
| C02.06.03 | 原transfer命令与逐端点publicBalances | 公共两端点分开、部分转回与原余额、全部转回主按钮下一笔、停用/超量/稳定确认号重试 | 已验证 | 同上 |
| C02.06.04 | wool-warehouse-page | 320×480中印/F1/Tab/Enter/Back，目标第一次点选、错扫与重扫，原草稿/来源/目标不串，换人清理；三类写后读失败锁根页后原笔恢复 | 已验证 | 同上 |
| C02.06.05 | wool-warehouse-model / special-warehouse-history / common warehouse | 原旧纱线与片接收、投入/领退/加工/移库/调整/交出原事实；普通+毛织实际员工UI五轮一致，未知实收不写0，单位/责任/混合时间正确 | 已验证 | 同上 |
| C02.06.06 | 原毛织领域 + 独立接收/执行/工艺/仓储/控制 | stocktime 316家族1580样本全部通过最大915ms，完单/机器/跨工序部位片/独立分批实收与原Web正向闭环；后续仅候选UI页改变，candidate-bounded 85家族425次及compact9家族45次通过；源差异准确保留，不改名旧采样 | 已验证 | Codex技术；三版独立manifest，不是全部旧路由退役/真机接受 |
| C02.06.07 | 原Web wool warehouse、原工艺仓同步模板及专项夹具 | 原生异步保存前固定快照、防重/不关闭下一单；原HTML/排序分页契约仅增加非视觉保存标记。全事实专项通过；两个Web页面静态列表检查通过，1547单元通过；全类型同19条原错误，整治理仍不关闭 | 已验证 | 同上 |
| C02.06.08 | wool-warehouse-page showStockChoices | 41纯文字候选先红，15/30真图候选、实际单号/SKU/部位/批次/库位/原单位；大图返回/中印/F1/续填/清空/退出无原生写，当前9家族各5次最大100ms；两张小屏图已查看 | 已验证 | Codex技术；compact |

阶段不发布、不提交、不推送、不生成最终完成收据；继续C03及其余中央/三方工作包。


### C03.33～36 染色剩余归属与物料分支（实施前）

继承C02.06稳定冻结54934a4d…；先审当前Web getDyeDocumentCompletion / completeDyeWorkOrderDocument / getDyeingQuantityFacts 与原三类归属写入。普通产出/逐卷/纱线/完单旧证据继续保留原版本，不重做为当前通过。代码已确认runCentralDyeCommand的设计改款分支没有传递operationId/intent；洗水关联分支未创建可恢复的中央确认结果。现阶段先用原生成/派厂/仓发与接收建立真实本地演示来源，重试/写后读失败/并发/跨端及来源重复必须原生复现，不先修改共享保存逻辑。

| 编号 | 目标与边界 | 负责位置/核验 | 状态 |
|---|---|---|---|
| C03.33 | 普通、PCS设计改款、洗水关联的染色操作各自保留原唯一行/集合/版本、相同确认号恢复同一结果，异内容拒绝 | runCentralDyeCommand / 原PCS、washing、special writer；正常/原生中止/已提交后读取失败/并发/冷读；不新建后端或双写源 | 实施中 |
| C03.34 | 面料原卷、纱线称重、连续及普通辅料按各自原单位接收/投入/产出/交出与独立实收 | 原prepareFactoryReceipt、DYE六节点/output/handover及各材料PDA表单；实际单一物料分支逐项验证 | 待实施 |
| C03.35 | 原归属未知或重复时停止保存、保留原资料；必要的直接来源记录与实收不丢失且普通读取零写 | 原owner projection/guard及共享收货/用料；不把单普通演示单当完整迁移验收，不静默清理用户旧源 | 待实施 |
| C03.36 | 每个受影响归属/材料在320×480中印、扫码、分批/续填/换人/底部按钮与当前Web相邻闭合 | 新限定源/资产manifest、原生回读、5样本动作与实际图像；继承原有效失败 | 待实施 |

C03.37（本轮实际小屏红例，实施前）：原设计改款染色已原子保存、随后读失败时，原UI只显示临时错误文字；切换语言将其清掉，露出下一加工节点，原开始草稿还留在内存。需复用当前同单稳定确认恢复，将接收/加工纳入该页已有恢复入口；切语言/返回/视图切换后仍仅允许取回原确认结果，恢复后才可继续。中止未保存仍保留填写可重试；换人不继承旧输入或改写原责任。scope限定dye-page与原稳定writer，保留原数量/节点/审批条件。状态待实施。

C03.38（进入/返回的真实读取失败，实施前）：同单已保存恢复中继续返回，外层central路由提前读取PCS抛错，染色页的本页读取失败兜底尚未执行，URL变化却残留旧内容并出现未捕获异常。染色与毛织一样由本页准备及处理失败；失败页保留实际账号/工厂和当前Tab，一个底部重新读取，恢复后回到实际请求地址。实际320×480持续读失败→返回→恢复读取→重开原单→原确认恢复，验证无新写/无丢原草稿或责任；不扩散到其他工序路由。状态实施中。

C03.39（物料页实际红例，实施前）：原设计改款创建/仓库审核来源的普通辅料，320×480印尼语接收页仍显示“件”；待收列表对非面料仍写未收卷0，且读取产出图/名称而非实际来料。修正限定染色单位显示与接收卡片，保留原单位字段与原生称重/业务数量。底部原有context用于显示本次实际确认量（普通辅料保留重量+原单数量，纱线注明净重），加工主按钮保留原节点和本批量，避免滚动报错后只剩动作名。校验、数量换算、事务与责任仍由原领域执行；需原单位回读、小屏输入/按钮同屏、中印及分两笔接收/返回恢复实测，不新增确认层。

C03.39连续作业红例补充：新增主按钮数量行后，实测第二笔辅料点击保存没有发生，下一页仍只累计12件。原数字输入blur重复change又刷新按钮，把鼠标按下的数量span替换掉，导致第一次点击丢失；并且第一次输入有效量后按钮增高，当前输入被裁出可视区。修复本页相同字段值不重复改草稿、主按钮同文案/数量不换DOM，底栏增高时保持当前输入可见。不得用重复点击或采集器滚动掩盖；需在320×480不主动滚动的真实fill/单次点击下两笔接收及加工验证。

C03.40（已定位的提前加工单读回红例，实施前）：原生成器建立PRODUCTION_DEMAND染色、原仓库审核、PDA两次实收后，开始染色5米的workOrders=DYEING、DYE节点5及实际用料5已共同持久化；读回却仍沿用WAIT_VAT_PLAN/0用量的内存。原恢复函数允许首次恢复这类早期单，但已在当前内存的同单不属于formal/initial集合，被后续hydrate跳过。source当前写入集合本已包含全部已知PRODUCTION_DEMAND/DESIGN_REVISION；恢复应使用同一已知单集合，保留原task/sourceKey/不可变来源/单位/节点/责任全部校验，不扩大未知原单资格、不补建正式生产单。原生正向/中止/读后恢复、两种早期来源、原Web独立读取及余量需回放。时间前后与单模块资源诊断均排除，未把HMR或造数时间当根因；首次无实际生产父单的直接PRODUCTION_ORDER注册夹具无效，不据此放宽生产来源。

C03.41（图片身份核查，实施前）：当前数量事实的imageUrl/materialName来自产出物料，而新PDA执行页配了rawSku，出现蓝色产出图搭白坯SKU。以当前Web原料SKU/产出物料分开的信息为准：图片和名称旁展示同一产出SKU；加工视图标明目标产出并保留不同的投入SKU作引用，接收卡片则继续展示真实来料。只更正识别信息，不改原单、图片来源、数量、工艺或保存动作；实际UI需按原生单据的outputMaterial逐一核对，不能只验图片能加载。

C03.42（PDA按键续查，代码已确认，实施前）：染色数字输入Enter原来直接跳到保存，纱线毛重后的管型仍须逐个点；同一分支也拦截select的Enter，库位change再整块替换后焦点回到扫码。限定为当前可见字段顺序前进，保留select原生按键，库位仅更新当前选择和按钮；原有图片/选择弹层Tab留在弹层内，F1回到可见扫码或原笔恢复按钮，不让焦点落在遮罩后的控件。数量/节点/角色/保存规则不变。需实际320×480键盘、两笔接收、原单继续加工、原生回读和切语言验证，不以浏览器键盘回放冒称真机扫码枪验收。


C03.43（连续批次标题，实施前核实）：当前原Web在下一批DYE开始时才把上一批六加工节点归档，因此首批PACK已完成、准备下一批时expectedBatch仍为0。三个真实材料分支页面均显示“Lot saat ini 1”，但所填将用于第二批。只按当前未归档PACK完成事实将准备下一批的显示编号加1；不改变命令expectedBatch、稳定确认号、原节点归档、可投入余量或任何完单条件。保留三项原失败页面证据，修正后对当前原生两批/四次交出及实收和小屏标题回放。


C03.44（交出响应，实测问题）：当前完成构建五次confirmDispatch为1060/1056/942/1060/893ms，前三个超限样本保留（实际超限为第1、2、4次）。CPU诊断只用于定位、不当作性能验收：按钮刷新约640ms，mount中每张已缓存图的同步loaded再次刷新约258ms，重复计算同一已保存数量。限定合并同一次挂载的已完成图状态更新，在挂载末尾一次核验按钮；异步图片首次成功/失败仍更新并重新核验，原图片未加载/失败阻断保留。业务命令、写入、读回、版本与确认规则不变。需原超限交出家族及图片失败恢复/连续输入回放后再判断。


C03.45（当前Web混合归属交出审查，实施/验证前）：原染色createDyeDispatchDocument明确同发送工厂，逐行保留实际单位和下游；不能复制印花“同下游同单位”合单门禁。对原PCS设计改款、普通共同账和历史洗水归属三单同厂真实出卷/逐卷扫码/一单确认分别验证四处原生中止、已提交后读失败及同意图重试；每行原owner、下游、原交出/接收来源保持，不因合单改写其他owner。这里只核查原Web已支持路径，不增加合单按钮或新流向。


C03.46（原记录回读核验，根因已证实，实施前）：历史染色行在原洗水记录owner保存后，原Web再生成不相关Design染色单，会因saveFormalDyeExecution逐字比较整个JSON失败。诊断c03-dye-foreign-owner-generation-diagnostic捕获前后110行：4条历史行从原数组位置移至末尾，身份及各字段完全相同，106→110是原owner叠加而非丢行。限定核验已命名的顶层记录集合按各自稳定ID比较，所有实际行值、内部有序数组、数量/责任、元数据、缺项/重复仍严格拒绝；不绕过任何保存或身份校验、不改原owner或存量记录。先补最小等价/数量变化/重复/节点次序失败契约，再重放原Web生成及三owner原生交出/中止/已提交恢复。第一次在普通账已拥有历史行后再手工adopt的fixture被重复owner护栏正确拒绝，保留，不据此允许重复owner。


C03.47 / C04.13（连续历史归属命令，原生失败定位）：第一笔历史染色动作把稳定结果保存到共同命令集合，第二笔原适配以该命令target误认原加工单已归属共同账，于是把原洗水owner的state.workOrders/nodeRecords另写一份。c03-dye-mixed-owner-duplicates-diagnostic的before/after列出了两条真实重复身份，三owner护栏正确拒绝继续。修复仅按原订单账本键+state.workOrders+准确ID选择实际owner；命令结果、名称、ID子串不授予owner。相同结构的印花适配同时核对；已有重复/删除owner明确拒绝，不自动搬数据或删记录。需历史完整加工连续动作、三owner原子交出/故障/重试，及印花真实原owner相邻回归。


C03.48（空任务工厂的实际账号，原生产页面失败）：已有中央OWN_WOOL_FACTORY进入染色空队列时，renderCentralDyePage只允许有染色单的工厂，自动退到ID-F003并改选其管理员。c03-empty-factory-red证实URL/偏好中的真实工厂与顶部责任账号被替换。限定通过当前主数据的active/CENTRAL判定保留请求/当前/偏好工厂，空染色队列显示为空；顶部直接读取当前工厂资料。真实登录同样按工厂主数据核验，不用有无染色单作为登录资格；非中央/停用仍拒绝。不增角色授权或工厂资料，不自动接受任何单据，不影响原保存账号/厂一致性门禁。需320×480中印切换、退出后真实另一账号登录、空两仓只读及新旧其他工厂相邻验证。


C04.14（真实逐卷物位，已实现待验证）：原Web待加工行聚合接收明细，但rolls明细及原FactoryReceipt各卷另有实际warehouseId/locationId。PDA按实物库位查看时必须逐卷用原实收-原实际领用余量，不能把同一接收行的多个库位都放在父行位置，也不能只比库区/库位漏掉货架。同名库位跨货架、空/停用库位及原待交出包装无确切库位时须分别可辨；不更改任何原库存事实。

C04.15（连续扫码修正，已实现待验证）：当前print-page identify对来料卷码使用rows.find，多个来源重复码可能选第一条、旧已收来源可能阻断真实下一来源。按原来源资格/剩余量核查，歧义不得自动换单或清掉本笔输入；c04-next-source-scan-red已通过原生登记有效下一来料复现旧已收来源误挡；改为实际未收来源优先，多来源同码显示原来源/批次选择，选后重新校验；3项独立扫码契约及两仓/输入相邻11项通过。实际扫码、歧义选择、返回续填/换人仍待走查。

C04.16（入口/按键连续作业，已实现待验证）：原print路由在独立页面前读PCS/PartTicket，初次读取失败尚无本页恢复；照片弹层Tab/F1和实际320×480字段顺序继续核查。实际原主数据中央资格必须保留，不能因新增原注册空库位显示让三方偏好绕入中央仓管；空页、照片Tab和三方旧偏好已分别复现，当前生产构建c04-print-cold-entry-production、c04-dye-cold-entry-adjacent、c04-photo-keyboard-production、c04-third-preference-fixed、c04-empty-central-registry-ui通过。c04-ambiguous-source-continuity-exact通过同码两来源/往返续填/清空/语言/换人/扫错重扫，均0业务put。初次continuity脚本泛role=alert命中业务扫码提示及缺库位校验两处而失败，保留；修正为扫码反馈区域后重放，未改变产品校验。后续接收保存/标签及整体验收继续，不新建权限/后端。

C04.17（待整理产出及原投入卷码，已实现待验证）：当前原Web实际产出减已确认包装的待整理量必须按原单/原单位可见，与已测量实物卷分开；原投入卷打印沿100×70mm、真实CODE128/原接收及在仓量，不写领用/实收/产出，也不标记产出标签已打印。先复现再补齐真实PDA操作和写入0/失败图片/原码可识别验证。

C04.18（来源单/批次扫码身份，已实现待验证）：连续扫码进一步核查source.id/documentNo/batchNo的识别，目前identify非卷码分支只把原来源映射为orderId；同单多来源时可能停留在上一来源。先用当前原生有效多来源复现，再保证实际来源身份与原单身份分别处理，不能因同一加工单合并来源草稿，不能把已收来源码自动替换成另一来料。


### 接收确认与当前Web原入口复核（C04.19 / C03.49，实施前）

来源：当前Web印花/染色共用pending-receipts的save调用confirmFactoryMaterialReceipt；中央染色/印花此前只用prepare/savePrepared。c04-print-receipt-anchor-red已证明原Web缺上游交出锚点拒绝0写、中央印花却保存，现按原有效规则纠正，未新增审批或身份提示。旧C03冻结仍是原范围的版本证据，不能覆盖这次新增发现的跨工序接收缺口。

| 编号 | 原子结果 | 范围/实际文件 | 验证/证据 | 状态 | 确认人/版本 |
|---|---|---|---|---|---|
| C04.19a | 印花接收复用当前Web确认，缺失原交出引用拒绝且0业务写 | print-model / factory-receiving-links | 原生Web/PDA同输入反例及重放 | 实施中 | Codex/a1000任务差异 |
| C04.19b | 印花接收人必须是当前工厂实际有效UID及原姓名，保留本单投入SKU/状态绑定 | 同上 | 实际/伪造/外厂/关闭单原生检查 | 实施中 | 同上 |
| C04.19c | 印花实收与上游原交出实际数量/人/时间同事务，保留原单位及独立收方责任 | 原接收/交接及原owner | 合法上游/分批/失败回滚/冷读/重复确认 | 实施中 | 同上 |
| C03.49a | 染色同样复用当前Web确认，不接受伪造接收人或缺失原交出 | dye-model / factory-receiving-links | 对应原生正常/边界/失败重放 | 实施中 | 同上 |
| C03.49b | 染色实收与上游交出实际数同事务，米/Yard/kg及原业务单位不改变 | 原接收/交接及原owner | 跨工序/分批/失败/冷读 | 实施中 | 同上 |

存储仍沿原PCS、共同账、洗水归属和原源交出记录；涉及源与收方的原行必须原子提交，不复制归属、不写localStorage后备。优先原确认API及已存在的原事务适配；如原事务不足先原生复现再扩直接参与行，不建通用新基础设施。仓管原码打印和接收无额外重复确认。完整中央/三方拆分仍未完成、不发布中间版本。

### C04.20 印花备料关联（实施前）

当前Web pending-receipts/stock按实际接收明细分配现有备料，使用实收单位与remainingReceivingAllocationQty；目标严格沿listReceivingAllocationTargets的本厂、同SKU、同上游、未关闭条件，不覆盖原纱线优先毛织规则。中央仓管在待加工仓提供备料入口，选原明细后只选加工单和本次数量；与接收、投入区分，不重复入库。范围print-preparation-model/view及print-page，沿runPrintingRecordCommand与原allocateReceivedMaterialToOrder，不引入新存储。保存/中止/已保存后读失败/稳定确认重试/跨页冲突/冷读需原生验证；320×480中文/印尼语/返回续填/切语言/清空/换人需实测。C04.20a原规则与原单位、C04.20b原子持久与恢复、C04.20c小屏连续作业均实施中。未关联来料接收另行核查，不以此入口冒称已覆盖。

C04.21（实施前补充）：当前Web允许未绑定加工单的PRINT原来料先实收为备料。接收Tab按原source/line/roll扫码与上游展示，原卷/Yard、纱线/kg及原业务单位沿prepare/confirm；随后仓管可关联，不能用“加工接收”重复入仓。保存限定原来料身份，沿既有固定印花同库适配扩展无单源的直接引用和source版本标记；不迁移owner、不复制静态全集、不创建后台。C04.21a入口/单位及原来料、C04.21b保存原子/中止/冷读/并发、C04.21c小屏/语言/下一卷/换人，均实施中。另C04.22原接收完成回调必须使用捕获的原单UI，不得在用户返回后给另一单创建带上一库位的空草稿；需真实返回时序验证。

C04.22实测反例c04-next-source-bin-red：同一原加工单OTHER来源10 Yard接收完成，NEXT新来源未选库位却继承OTHER的FIW-F090-WAIT_PROCESS/LOC-A-01-01。限定完成回调按原scope/source/roll写下一真实未收卷草稿，只沿用本来源库位；其他来源不改已有输入，不调用当前路由的receiptDraft来搬运库位。相同来源下一卷继续原位，完成来源不制造空草稿。另C04.20c已发现首屏Footer遮数量及两处返回，修正后当前320×480通过；语言按钮拿到焦点后截图仍可能看不到原数量，按当前scope记最后填写字段并在切语言后回到原字段继续填写，不保存偏好或业务快照。新原生/页面证据待补。

### C04.19～22 局部技术结果（continuity版本；完整目标不关闭）

| 编号 | 当前实际实现与直接证据 | 状态 | 实际确认/版本 |
|---|---|---|---|
| C04.19a | print-model原confirm；anchor-confirm原Web/PDA缺引用同拒绝0写 | 已验证 | Codex技术/a1000+continuity，非现场接受 |
| C04.19b | 原actor/SKU/关闭校验保留；原生有效F090接收、发方代收/伪造人拒绝；1637原契约全过 | 已验证 | 同上 |
| C04.19c | original-port-receipt-observed-atomic-cold：DYE四次2米交出，PRINT八次1米独立收；五集合一事务/逐项中止/同号恢复/冷读均8米 | 已验证 | 同上；只覆盖命名原生PCS链路，不扩成全部任意来源 |
| C03.49a | 染色原confirm及当前真实actor已接；原生伪造Dye人拒绝；缺原交出边界直接对照仍待补 | 已实现待验证 | 同上 |
| C03.49b | 原三物料两批原确认相邻通过，未收材料/原单位不改；当前静态染色3来源无HANDOUT或原交出锚点，不制造假正向闭环 | 已实现待验证 | 同上；source-inventory只证明当前固定演示资料 |
| C04.20a | 原Web备料目标/单位/配额沿用；8 Yard分2.5/5.5，原接收数不变 | 已验证 | 同上，original-preparation-allocation-exact |
| C04.20b | 原接收/分配owner、原生中止/保存后读失败/稳定确认/旧来源拒绝/冷读通过 | 已验证 | 同上及stock-receipt-fault-cold-native |
| C04.20c | 320×480目标/数量续填、语言保值且数量可见、底部数量/单位、清空/实际换人/零假草稿；17家族各5次≤520ms | 已验证 | 同上，continuity-preparation-ui/continuous-stock-five-performance；截图已查看 |
| C04.21a | 接收Tab独立PRINT备料来源/原卷/上游，两个4 Yard原卷实收不绑定假加工单；主按钮原单位 | 已验证 | 同上，continuity-next-roll-ui/native |
| C04.21b | 三实际集合逐项中止/已保存读失败恢复；两页同原卷竞争1胜1冲突，冷页只1笔8 Yard/实际F090_admin | 已验证 | 同上，stock-same-roll-race/stock-committed-recovery-small-ui |
| C04.21c | 下一原卷空数量保留本来源库位，已收码重扫拒绝、切语言无中印混排、清空/退出无空草稿 | 已验证 | 同上，continuity-next-roll-ui |
| C04.22 | next-source-bin-red真实串库位已复现，fixed不同来源不继承；同来源下一卷继续原位；原生complete时浏览器返回后仍正确续填 | 已验证 | 同上，stock-back-at-commit-small-ui |

当前仓管相邻11家族55次全部≤490ms，0业务put/0页面错误，无横溢，c04-continuity-warehouse-five-performance。原普通/PCS/洗水归属和其他材料分支、旧源迁移、跨端完整总验仍各按原矩阵继续，不以本表关闭C04主项或全目标；没有提交/推送/发布。

### C06.20 已交后重新加工不得抹除累计交出（实施前）

原生c06-rework-after-sent-red沿原Web真实卷维护/打印/逐卷交出/独立实收100米，再暂停并RETURN_FOR_REWORK，冷页completed0/handed0/received100，但原交接仍100/100。按已确认“保留业务校验和交接责任”修正直接域边界：重新加工清空完成数量只用于尚无实际交出的单；已有交出或历史实际批次时拒绝清空，保留原完成/交出/实收/卷码及责任；可使用既有继续加工/按实际交出，不另建退回或主管流程。历史已经清零但仍有实际交出批次也不能再清，不能悄悄改写既有错误历史。无交出时原三种选择的语义保持。原Web/PDA共用校验，PDA不显示不能执行的重加工按钮；旧选项/直接调用仍被域拒绝。新最小契约先红，随后原生中止/0写/冷读、继续加工正常路径及320×480中印/按键/相关5样本验证。状态实施中；范围water-soluble-task-domain、water-model/view/page/ui及本专项测试，不扩大到未确认返货业务。

| 编号 | 原子结果及实际位置 | 状态 | 证据与确认 |
| --- | --- | --- | --- |
| C06.20a | 原域waterSolubleReworkBlockReason/resolveWaterSolublePause拒绝清空已交批次，Web/PDA同校验且0写 | 已验证 | c06-rework-guard-cold-native-ready；原最小失败与11直接测试；Codex技术核验/a1000+rework-guard |
| C06.20b | water-model/view/page/ui仅展示可执行选择，印尼语及320×480换人、返回、切语言、数量/按钮保持 | 已验证 | c06-rework-guard-resume-small-ui与已查看截图；paused-five-performance25样本≤639ms；Codex同版本 |
| C06.20c | 恢复后100/934两批交出与分别实收、原完单条件及责任、稳定重试、独立冷读 | 已验证 | c06-rework-recovery-actual-two-batch-native；adjacent-five-performance110样本≤920ms；Codex同版本 |

本节局部结果不关闭C06迁移、所有来源/仓储、专门并发性能或整体拆分；全部阶段证据保持其源码和资产身份，不挪用旧结果冒充当前全部通过。

### C06.21 接收沿原Web确认入口（实施前）

`c06-receipt-missing-anchor-red` 使用真实水溶分厂及现有来源结构构造不存在的originalRecordId边界：Web原confirm拒绝、记录不变；中央PDA原savePrepared绕过原交出定位，实际入仓5米。此夹具只证明缺失引用边界，不冒充真实上游已发货。目标继承原Web既有确认，不新增规则：water-model保留原账号/本单/来源预备校验，在原runWaterSolubleRecordCommand里调用confirmFactoryMaterialReceipt(input,actor)，保持原子原单/入仓/实收/责任/稳定重试。验证缺失引用0写、正常无引用受控来源分批接收及五样本、小屏/语言/库位相邻回归、原生事务失败与冷读。真实跨工序正向接收另用原Web来源生成链证明；不能用手造引用代替。状态实施中；仅直接水溶接收包装/关联测试与记录。

### C06.22 同次水溶渲染重复原单读取（实施前）

C06.21正式首开五样本仍有超时，完整原始失败不豁免。CPU诊断c06-receipt-cold-cpu-diagnostic取样1018ms，初始化多模块且有大量idle，不把采样冒充单一根因。直接当前water-page的frame→ui/scope/incoming/receiveDraft/primary等反复route()，每次重新构造全工厂水溶事实；同次同步渲染只需要同一路由/工厂/账号事实。限定增加frame同步调用范围的route读取复用，finally释放，不跨事件/await/保存/账号/工厂复用，不新增业务缓存库、状态引擎或数量投影。动作保存仍原域/事务重新读取；每次新渲染仍读取当前事实。验证冷首开及连续全链五样本、原生跨页竞争/重读、切语言/换人/返回、接收失败输入及提示可见，性能未达标时保持实施中，不反复刷样本掩盖失败。


### C06.21 / C06.22 当前接收与连续作业结果（2026-10-22）

水溶接收现沿原Web `confirmFactoryMaterialReceipt` 确认，原本单/账号预校验和共同事务保持；缺失原交出引用时Web/PDA同拒绝、0写，不以受控来源冒充真实跨工序正向链。原确认模块在事务前异步加载，事务内仍同步执行。`c06-receipt-lazy-confirm-cold-actors`证明受控10米来源4/6分批、实际两员工、三参与集合逐一事务失败后字节不变、稳定重试0写、独立冷读10米接收及10米投入。旧collector误以冷读记录顺序代表业务顺序的失败保留，按实际UID/数量核验，未修改产品规则。

接收错误原先在小屏上方不可见；现在只在失败时滚动到真实提示，数量/库位保留。`c06-frame-read-error-small-ui`、`c06-frame-read-alert-visibility`在320×480验证印尼语、返回/切语言续填、退出换人空表；错误y138高98，底部主按钮y412高56，0写。没有弹出额外确认层。

同一次同步frame内复用原单读取，finally即释放；不跨事件、await、保存、账号或工厂缓存。`c06-frame-read-multitab-ui-guard-reload`原生两页竞争同一卷只有1次占用成功，失败页保留扫码，重新读取后仍拒绝已占用卷。正常22家族110样本`c06-frame-read-five-performance`最大970ms，0页面错误，涵盖4.125/5.875米分批、投入、卷/标签、打印请求及确认、交出、错码、事务失败/重试、实收视图、退出真实换人。印尼语不改变原单位或独立收方责任。

此前static-confirm、lazy-confirm、visible-confirm的真实超时和CPU诊断全部保留，不追认原版本通过；当前结果绑定`c06-frame-read-source-manifest.json`及asset-manifest。C06.21/22局部技术验证不关闭显式旧源迁移、全部原上游接收来源、其他工序和最终治理收口，不发布中间版本。


### C06.23 水溶旧源显式迁移与停止旧写（实施前）

范围仅原`higoods.formal-water-execution.v1`，迁到现有central执行逐单ledger集合，不新建业务快照库。旧卷/交出/日志嵌入对应原水溶单，保留原身份及原Web冻结来源校验。共同接收/交接旧源属于跨工序资料，本步骤不清理它们，也不宣称它们已迁移。正常读不迁移；存在旧水溶源时拒绝新动作并进入已有显式恢复入口，用户确认已关闭其他旧页面后才运行。停止当前浏览器未经过共同命令的水溶旧写；Node显式测试storage保持。

先验证整份旧水溶JSON与当前冻结原单；按每50单分批复制到现有逐记录集合，源在每次提交前后保持原字节。已有目标完全一致才复用，不同或删除标记则拒绝覆盖。原生目标读回逐条核对后写核对回执，再次确认旧源未变，仅清理该水溶键；删除失败或中断保留可重入回执和原源。回执后出现不同旧字节拒绝，不能覆盖新数据；普通读仍0写。不建立自动迁移、离线队列、后台重试或权限提示。验证正常/空/损坏/目标冲突、事务配额/分批中断/清理中断可续、旧页重写拒绝、新单独冷读及正常新动作，随后核对小屏恢复入口和相邻代码。状态实施中，不预填通过。


C06.23实际页面前置失败：`c06-legacy-migration-recovery-small-ui`等待显式入口超时；随后源码定位main中央快捷分支直接return异步render Promise，外层try/catch没有await，因此无法捕获实际异步读取恢复错误。只给该分支增加await，使原有恢复分支处理真正读取错误；不吞错或伪装空数据。原失败保留；先重放同一小屏入口，再补正常入口性能及直接相邻失败恢复。


### C07 当前Web源接续（2026-10-22，实施准备）

已核对binding-strip-orders、binding-strip-order-types及binding-process-warehouse-linkage-service、Web special-processes。具体原单/规格/数量/四动作与保存缺口见binding-source-audit.md：输入输出均为米，比例授权按规格；原交出为整单，不能擅造逐规格交出。Web原单当前仅内存而两仓同步联动，须先收束到原子逐记录保存并接通原消费者，再实现中央独立页；不能只加页面或挪用special订单。C07未标实现。


C06.23当前实现绑定water-soluble-legacy-source、legacy-migration、原domain decoder、special-records读守卫、central-execution旧写拒绝、production-context-recovery中印入口与main await。原生8路径/独立冷读和320×480实际入口均通过；23直接/1647完整单元通过，工程范围0/原19既有保留，正常110样本≤910ms。源码/资产c06-legacy-final清单，待恢复专门性能及阶段记录后登记局部状态；完整C06/拆分目标仍实施中。同步main6f477的19个上游文件不重贴旧证据，262原任务路径逐字节保留见main-6f477-pda-work-preservation.json。


| 编号 | 局部原子结果 | 实际位置 | 技术证据/版本 | 状态 |
| --- | --- | --- | --- | --- |
| C06.23a | 旧水溶单按原冻结身份及原单位核对，逐单复制/读回；只清理已核对的水溶键 | water-soluble-legacy-migration/domain | 8路径原生故障/冷读，6f477+legacy-final | 已验证 |
| C06.23b | 正常读取不迁移，绕过共同动作旧写阻断；冲突/配额/中断保留原源 | legacy-source/special-records/central-execution-bridge | 同上、23直接契约；共同其他工序旧账未清理 | 已验证 |
| C06.23c | 实际320×480印尼语恢复入口，未确认不清理，成功重载；异步错误进入既有恢复分支 | main/production-context-recovery | legacy-final-recovery-small-ui及已查看截图；3家族15样本≤465ms/0错误 | 已验证 |

上述由Codex在6f477+legacy-final执行本机隔离技术核验，不是工厂现场接受。普通22家族110样本≤910ms，当前合计25家族125样本；不把旧版本性能累加到本版本。C06主项及全部PDA目标继续实施，不发布中间版本。


### C07.01～06 捆条共同事实接管（实施前）

`c07-original-web-cold-read-red`原生确认1米、当前页1、原生0行、独立刷新0，已实际复现。先接管直接原单/两仓/交接共同保存，后接新PDA；原公式和动作条件不变。复用现有PCS数据库与special共同事务集合，增加明确binding owner逐原单行，只在捆条入口加载该域。其他水溶/辅助页面不提前引入binding页面或复制该事实。原Web和旧PDA实际保存消费者一并改为await同一原子入口，稳定操作号保留；实际PDA用户UID/工厂/名字与时间写入原动作和交接。没有绑定用户身份的平台Web保留其现有操作人事实，不伪造UID。

| 编号 | 原子目标 | 计划实际位置/工作包 | 验证/完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| C07.01 | 原捆条单和两仓/交接共同原子保存，读不落种子 | binding-process-records / special-craft-records明确binding捕获，WP3 | 接收/加工/交出原生读回、配额各参与集合无半套、冷读与稳定重试 | 实施中 |
| C07.02 | 静态单/已有单并发防重，失败恢复原输入和原事实 | 同上/原命令版本，WP3 | 两页同单1成功1冲突、不同单不冲突；原生guard/行版本 | 待实施 |
| C07.03 | 原Web及旧PDA不继续仅内存保存 | cutting/special-processes、routes-fcs、pda-exec-detail/入口准备，WP3 | Web实际按钮成功后独立冷读、失败不关闭输入；旧三方不得接入独立捆条 | 待实施 |
| C07.04 | 实际PDA操作人UID/名字/工厂和交接责任 | 原binding action/input类型及warehouse联动，WP3 | 真实两账号、异厂/假账号拒绝、发方不代实收 | 待实施 |
| C07.05 | 不改变按规格比例授权、整单交出及原完工条件 | 原binding域/中央binding-model，WP3 | 原多规格/越界/短裁/完工后剩余可交有效规则 | 待实施 |
| C07.06 | 独立中央接收/执行/仓管、小屏ID与连续作业 | binding-model/view/page、entry/router，WP3 | 真实图片/扫码/多规格续填/语言/换人/实收及适用5样本 | 待实施 |

主C07仍未完成；后续记录须绑定实际修改和证据，不以本计划或原公式函数通过代替实施。


### C07 / C08 当前字节接续（2026-10-22）

C07.01～05已实现待最终验证：具体原子事务、两类并发、Web失败留表/冷读、PDA两账号和独立收方、原米数/比例授权及完单规则证据绑定binding-source-audit文末。C07.06仍实施中，当前320×480正常/错误/续填/换人及16条接收记录继续查看通过，生产正式性能与最终源码/资产绑定待完成。原待实施小表保留原准备版本身份，不能覆盖此追加的实际状态。整体C07及X11未关闭。

| 编号 | 原子需求 / 来源 | 实际文件 / 工作包 | 验证与完成条件 | 当前状态 / 确认版本 |
|---|---|---|---|---|
| C08.21 | 逐单一工序识别Web原加工单纸码、原任务码、菲票/SKU，不跨工厂/工序且保留多匹配选择 | special-model、page、原task-qr，WP3 | 全部当前原单单测；320×480实际扫码及错误恢复/返回/语言 | 已实现待验证 / Codex 6f477+qr |
| C08.22 | 换人登录中央无该工序单据的有效工厂时，不擅切另一工厂或另一管理员 | special-model/page/session，WP3 | 实际账号空工序/返回/换人/当前工厂头部一致，原账号身份不改变 | 待实施 / Codex 6f477 |
| C08.23 | 逐工序重新核对当前原Web四动作、数量模式和实际上下游，所有直接冷读一致 | 原special-craft-actions/原仓库/page/warehouse，WP3 | 普通片/件/米，盘扣票→个，制作辅料BOM输入→个，各分支实际来源/交接；不将同名工序套通用 | 实施中 / Codex 6f477 |

C08当前源核查：原getAvailableSpecialCraftWebActions允许已加工后完工，并允许已完结单交出剩余产出；PDA不能改回旧设计“交后完工/完工后一律只读”。盘扣须全部原菲票收到才能填报，以张接票、个报产；花朵当前Web实际仍按裁片片数回裁床，显示归类与原业务身份区分。原dict将盘扣/花朵列辅助身份，PDA不得为显示归类擅改原工艺ID、二维码或数量模式。完整C09另外按当前实际原单展开。

| C08.24 | 已保存但回读失败时不允许改数、清空或重复提交；重新读取核对同操作号后直接恢复下一笔 | central-pda/page及原共同guard，WP3 | c08-committed-input-red实际原生故障已复现，输入仍可编辑为问题；补只读/稳定恢复、返回和语言/换人不串旧值 | 实施中 / Codex 6f477 |


C08.21/22/24当前已实现待验证，实际代码/原生失败反例/恢复与16工序纸码小屏证据见special-current-source-audit.md；C08.23仍实施中，原Web数据域及现有实际来源已核对，全部独立实收/历史迁移/额外配置对象仍未关闭。补硬键盘登录和数量焦点属于C08.21/22连续作业，数量Enter/F1只聚焦、不自动确认数量。正式生产资产及五样本仍待资源空闲后补，未伪造已验证状态。

### C09 织带/花边当前源接续（实施前，2026-10-22）

详见 accessory-current-source-audit.md。C09 不复用普通辅助单表单；花边接收为任务确认，织带为逐原批实收，两者责任不同。当前优先花边逐记录共同事实，再接其中央页；织带米/mm/条根/包和重量独立账逐项实施。

| 编号 | 来源 / 原子结果 | 工作包与负责位置 | 验证及完成条件 | 状态 / 确认 |
| --- | --- | --- | --- | --- |
| C09.01 | 当前Web；花边原单及填报/交出/收方/日志逐实体原子保存，不落整包种子 | WP3 lace-factory-domain、lace-factory-records、直接Web/WLS/PMS/打印 | 原生冷读、配额无半套、同单版本/操作号去重、独立收方 | 已实现待验证 / Codex c09-lace-harness版本 |
| C09.02 | 当前Web；花边确认任务接收，默认投入完整校验，原单原单位 | WP3 中央lace-model/view/page | 待接收/缺投入/异厂，米与Yard分别，扫码原单/采购来源 | 已实现待验证 / Codex c09-lace-harness版本 |
| C09.03 | 当前Web；花边填报/1.5倍确认/完工/完工剩余可交，发方不代收 | WP3 同上/原命令 | 正常/缺产出/数量越界/分批/独立实收；返回/语言/换人 | 已实现待验证 / Codex c09-lace-harness版本 |
| C09.04 | 当前Web；织带直接来料及染色/印花回料逐原批实收共用事实，不重复领收 | WP3 tmf-material-purchases/原域接续/中央webbing | 直接来料逐原批实收、原生失败/同号重试、Web双向冷读已通；染色/印花回料分支已接原确认，尚无实际来源回放 | 实施中 / Codex c09-webbing-receive版本 |
| C09.05 | 当前Web；织带截断/打头按本批余额、公差、mm、米、条根、辅材原单位 | WP3 原纯命令/中央webbing-model/page | 非打头截断；金属/塑料端头各耗20个、硅胶0.5kg；错长700 vs 600整批不良；原生3条打头、1条不良均验 | 已实现待验证 / Codex c09-webbing-tip-variants版本 |
| C09.06 | 当前Web；按实际规格合格量装包并交原仓，子包不可重复/跨批，独立收方 | WP3 原pack/dispatch/receipts与中央webbing | 装包40、整包交出40、原生行已验；仓管独立实收待回放 | 实施中 / Codex c09-webbing-execution版本 |
| C09.07 | 当前Web；半成品基础原料生产、余料/辅材退回保持独立重量/米数账 | WP3 tmf原领用/生产/退回与中央webbing | 连续余料5+2.5米、端头辅材退回5个、半成品原料kg/在库/耗用/报废/退回只读账已验；PDA原料生产/领用/耗用操作仍由原Web半成品页办理 | 实施中 / Codex c09-webbing-base-ledger版本 |
| C09.08 | 用户分类；辅料厂仅盘扣/花朵/织带/花边显示类，原身份及数量不变 | WP3 中央工序选择与显示 | 工序选择已分「辅料/其他工序」，织带/花边归类；盘扣/花朵按实际可得工序显示，未改QR/字典ID；中印/小屏截图已留 | 实施中 / Codex c09-webbing-tip-return版本 |

C07本轮固定构建正式38家族190样本全部≤466ms、0页面错误，绑定 `c07-binding-current-progress-freeze.json`。C07.01/02/04/05及独立新页本轮正常/故障/并发/续填/换人/记录继续加载已完成本机技术验证；原Web/打印/独立收方冷读证据沿用原文件身份。C07.03的全部旧消费者最终删除仍在X11，不以局部通过关闭全部拆分。不是现场接受，不提交/推送/发布。

C08本轮150正式样本功能/数量/身份均正确，但emptyFactoryRefresh有效1033/1017ms超时保留，当前该性能不通过。定点诊断显示工厂菜单首次151.9ms；构造菜单时不必要地建立所有毛织来片接收投影，无该工序单的工厂也先读全部来片来源。C08.25仅改菜单读任务归属，实际来片接收仍读完整投影；没有匹配任务先返回空，不改变可收条件或实收来源。直接对照轻量归属与原完整contexts的所有实际taskID/工厂，并重放空工厂及有毛织来片入口；对应受影响家族补5样本，不重跑其他已通过且依赖未变的数量/事务契约。状态实施中。

| 编号 | 来源 / 原子结果 | 实际位置 / 工作包 | 技术证据及剩余完成条件 | 状态 / 确认 |
| --- | --- | --- | --- | --- |
| C08.25 | 当前空工序工厂刷新及菜单只读取必要归属，不省实际接收来源校验 | special-model/wool-craft-model，WP3 | 原1033/1017ms失败保留；原任务归属一致性及scope0，固定构建后按受影响帧家族复验 | 实施中 / Codex 6f477+assignment |

C09.01已开始实施：新增lace-factory-records逐原实体、静态覆盖、Map/Set逐项及独立编号记录；使用现有PCS事务，原命令同步校验后立即还原，事务complete后才发布。原生c09-lace-native-record-static-graph通过，Yard填报20/交8/独立实收7/余12、22逐实体行、配额回滚和冷读。此前rowsOf缺return已修；动态import与Vite热更新同域出现两实例的诊断保留，静态harness统一原域图后同场景通过；不能把旧失败伪造删除。

### C09.01～03 当前实现绑定（2026-10-22，局部；织带仍待实施）

继承C09表，本段只绑定花边逐实体保存、中央四动作页与直接Web/WLS消费者。C09.04～08织带、后道C10、旧入口X11与完整目标均未关闭；确认人为Codex技术核验，非用户/现场接受。

| 编号 | 当前实际实现 | 直接证据（output/playwright/pda-factory-split） | 状态 |
|---|---|---|---|
| C09.01 | lace-factory-records逐实体行（原单/填报/交出/收方/日志/采购查看版本/操作号/编号）、命令结果同一PCS事务；静态基线只读、正常读取不落种子；运行失败回滚内存不发布 | c09-lace-native-record-atomic-harness-fixed：配额失败后原单仍待接收、0行、稳定重试不重复执行；20/8/12/7、独立收方、冷读一致、无数组快照、22原生行。c09-lace-native-record-static-graph。原双实例harness失败保留 | 已实现待验证 |
| C09.02 | 中央花边页沿原Web四动作：确认接收生产任务不填实物数量、加工/交出/完工状态条件、原单Yard单位、扫码识别原单/采购号/SKU、实际账号与工厂核对 | c09-central-lace-small-continuity-visible-rerun：真实320×480印尼语，扫错恢复、接收无加工按钮、4,5 Yard加工、3 Yard交出余1,5、实收只读、动作草稿隔离、清空不复活、底部按钮可见、换人后空草稿、原生数量与责任人一致 | 已实现待验证 |
| C09.03 | 原Web工作单页/收方页改用saveWebLaceRecord同事务保存；填报配额失败保留输入、重试不重复；完工剩余可交、发方不代收 | c09-lace-original-web-record-ui-rerun：真实Web按钮接收落原生行、配额失败输入保留、重试1笔3 Yard、冷页读取同一事实；wls-accessory-receipts独立收方沿用原确认 | 已实现待验证 |
| 启动壳层 | 花边路由改为惰性加载（lace-records-loader），主入口静态图不再拉入PCS记录核心与花边域 | c09-lace-build：1667单元全通过、Vite构建通过；craft-startup-chunks静态依赖通过；范围类型0错误 | 技术核验 |

原“页面与原消费者未接通”描述已被本段实现替代，保留原时点记录；本段不改变花边业务规则、原二维码/身份、单位与收方责任。织带C09.04～08按accessory-current-source-audit继续实施，不因花边局部通过关闭C09或完整目标。

### C09.04 织带接收与逐记录存储（2026-10-22，局部）

织带 PMS 存储由四个 singleton section 改为逐记录行 `pmsTmfRecords`（旧 section 只读基线、旧标签写入拒绝、同事务操作号；按新 STORE-04，这些旧演示 section 可在版本切换时定向清空重建，不再要求迁移或兼容），中央新增织带接收页。直接米料和端头辅材接收已验证；原 Web 接收 2 米与中央 5 米双向冷读一致，退出未提交草稿及换人已验。染色/印花回料已按原交出路由但无实际来源回放，C09.04保持实施中。C09.05～08（截断/打头、装包/交出、退回/半成品账、分类显示）仍未实施。性能3家族各5样本最大409/151/100ms。证据和边界见 accessory-current-source-audit.md 织带当前阶段；V01 治理仍因基础阶段历史失败命令不通过，未改写历史。
