# PPIC每日回货两轮对抗审查与当前登录身份修复

依据 [AGENTS.md](../../AGENTS.md)，继承 [原方案R01～R73](../product-design/PPIC每日回货跟进与两节点履约调整具体方案-2026-10-14.md)及其仍有效的数量、角色、时间、两节点和存储规则。阶段：本地原型技术验收完成，业务方接受待登记；此前审查、收据和原始证据保持原版本身份。

## 范围与计划

用户于2026-10-14要求再做两轮对抗性审查，重点核对PPIC每日回货业务与上下游，发现问题直接修复；移除演示身份，当前登录人是谁就是谁。

本轮属于T4行为/共享身份修复。以当前工作树HEAD `3e6412f25bd389985ca1a2045280eff2220f622b`和既有未提交实现为起点。主代理实施；1名只读代理完成先后两轮独立审查，不并行写入、不派下级。

1. 从车缝模块现有当前PPIC来源读取操作人，移除填报/汇总和工作台改变身份的入口，团队页面不能自动获得组长权限；验证成员、组长、停用及跨路由场景。
2. 第一轮审查数量来源、任务归属、承诺/补回、日确认、后道确认/更正与两节点；问题先建最小失败契约，再修复并复验直接上下游。
3. 修复版本稳定后第二轮反向审查，验证第一轮问题关闭及新增差异未破坏数量守恒、角色和历史事实。
4. 对实质变化的依赖补充浏览器、持久回读和每类至少5样本的1秒性能验收；未变证据按原版本复用。冻结文件后生成新的技术收据。

现有管理端没有独立真实登录服务，本轮复用 `factory-onboarding-ppic.ts` 的车缝当前PPIC上下文，不新增后端或鉴权框架。身份和权限夹具只在隔离测试中设置，不提供生产身份切换或测试专用setter。普通读取不写种子，不迁移或删除用户记录；外部数据库不访问。

## 追加原子矩阵

|需求编号|来源|原子需求|工作包|实际文件/符号|自动化验证|页面/性能证据|状态|证据位置|确认人和版本|
|---|---|---|---|---|---|---|---|---|---|
|R74|本轮用户|每日填报和汇总不提供演示身份选择|身份|ppic-daily-return-records / daily-return-report / daily-return-summary|当前身份与页面契约|生产预览及浏览器见下文|已验证|output/ppic-adversarial-20261014|用户2026-10-14需求；Codex技术验证2026-10-14，接受未登记|
|R75|本轮用户|操作人直接读取车缝当前PPIC，停用/无效身份不可操作|身份|factory-onboarding-ppic / getCurrentPpicDailyActor|上下文及停用契约|生产预览及浏览器见下文|已验证|output/ppic-adversarial-20261014|Codex技术验证2026-10-14，用户接受未登记|
|R76|本轮用户及R17/R60|工作台路由或管理筛选不能改变当前人或获得组长权限|身份|workbench|跨路由/角色契约|生产预览及浏览器见下文|已验证|output/ppic-adversarial-20261014|Codex技术验证2026-10-14，用户接受未登记|
|R77|第一轮发现及R08/R15|数量依据含毫秒业务时刻按Jakarta解析，宿主时区不影响有效交出|时序|ppic-return-quantity-basis instant|跨时区等价契约|生产预览及浏览器见下文|已验证|output/ppic-adversarial-20261014|Codex技术验证2026-10-14，用户接受未登记|
|R79|第二轮发现及R75|异步保存开始后的当前人变化须拒绝写入，不能将原动作记到后来人名下|身份|ppic-daily-return-records save|真实IDB异步身份变化契约|生产预览及浏览器见下文|已验证|output/ppic-adversarial-20261014|Codex技术验证2026-10-14，用户接受未登记|
|R78|本轮用户|两轮审查分别记录覆盖、发现、修复和复测|审查|本记录与完整任务diff|两轮独立审查结果|两轮独立审查见下文|已验证|output/ppic-adversarial-20261014|Codex技术验证2026-10-14，用户接受未登记|

## 基本信息

- 日期：2026-10-14
- 任务 / 需求编号：PPIC每日回货R01～R73的两轮对抗复核及追加R74～R79
- 验证人：Codex主代理；独立只读审查代理 `/root/adversarial_ppic`。业务方接受未登记。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：移除业务页面自选身份及路由自动切换组长；当前人统一来自车缝现有上下文；修复应回来源时刻和异步保存作者归属。T4。没有提交、推送或部署。

## 自查结论

|检查项|结论|证据 / 问题及处理|
|---|---|---|
|数量与业务时序|通过|R01～R15、R77：三种数量、任务/工厂隔离、缺来源null、两节点与历史分母复核；Shanghai宿主下含毫秒Jakarta时刻与UTC等价。修复前最小失败保留。|
|承诺/补回/实际回货闭环|通过|两轮覆盖Q-R-U、原截止、原准时量、多分支补回、迟录解除、后道实际/登记时刻、更正与版本冲突；21项浏览器和本轮生产实收性能35样本。|
|当前人及操作权限|通过|R74～R76、R79：页面不存在身份选择或setter；成员访问团队/移交阻断，组长个人页不降为固定成员，筛选不改当前人；异步期间换人或停用拒绝写入。|
|原子保存/恢复|通过|真实IDB验证保存失败保留输入、重复重试唯一、全部PCS事实共同提交及回滚；身份变化前后全部内存和持久记录JSON一致。|
|历史资料与存储边界|通过|未改变8类PPIC记录的键、集合和业务身份，历史原作者不重写；不清空或迁移用户数据；身份夹具仅在隔离验收浏览器，产品无测试身份setter。|
|管理/员工Web|通过|1366×768、1280×720、1024×768下填报、汇总、成员/组长及局部更新核验；无主体横向溢出。默认现有当前人页面亦在5483生产预览核验。|
|PDA|通过|21项回放包括Chrome模拟390×844后道直接确认、双时间、保存/回读及交接不代替正式回货。未把小屏模拟当实机接受。|
|真实图片/合同|通过|本轮重放款式真实图、大图/Esc/失败态及后道5 SKU映射；新合同真实分配生成两页、35%/100%两行及规则页；历史原件保持原身份。实体打印机不适用。|
|性能|通过|当前生产资产下73家族各5样本，共365样本，全部≤1000ms，最大760.2ms；初始超时及采集失败均保留，缓存校准说明见下文。|
|两轮独立审查|通过|第一轮1项P1、第二轮1项P2均由独立代理重放原反例关闭；范围内无未关闭P1/P2。|
|治理和检查消费者|通过|323治理契约通过；工作台、信息架构、列表3个相邻检查已按当前人夹具和异步渲染修正并实际通过，不删业务断言；新增浏览器夹具已明确登记执行。|
|外部数据库/真实登录/工厂接受|不适用|管理端既有免登录原型，当前车缝上下文预设陈琳；本轮未新增真实登录、后端鉴权或消息，不访问外部数据库，不宣称真实工厂接受。|

## 第一轮审查

独立代理覆盖三种应回来源、件/片、去重及跨任务/工厂、共享放行不明阻断、原承诺容量及分摊、补回不加分母、日确认、后道实收及更正、责任历史、两节点和合同。正确入口的4份专项51项通过；首次未加载tsx导致模块解析失败属于运行方式错误，不作为产品问题。

P1：`ppic-return-quantity-basis.ts:110` 仅为无毫秒墙钟补+07:00。Shanghai设备上交出02:30Z，查询10:00:00得到Q100，10:00:00.500得到Qnull待交出。先建立跨TZ失败契约，修复后独立重放三个等价时点均Q100 READY。原失败见[修复前契约](../../output/ppic-adversarial-20261014/before-fixes-contracts.log)。

## 第二轮审查

在第一轮修复版上反向核对getter目录角色、停用/不存在账号、成员进团队/责任移交阻断、组长个人页面保持、人员筛选不改身份、数量/历史依据/两节点相邻消费者；38项专项通过。

P2：保存先await来源，recipe才取当前人。独立新浏览器复现“凌云开始、上下文变婕哥、保存作者变婕哥”。修复为等待前捕获当前人、同步业务动作前核对身份，变化拒绝保存；独立重放A→B与A→停用，PPIC内存及PCS全部记录JSON逐字未变。本轮[真实IDB契约](../../output/ppic-adversarial-20261014/browser-async-identity-guard.log)亦通过。[两轮结论与原反例](../../output/ppic-adversarial-20261014/review-rounds.json)记录独立执行者、覆盖与闭环。

保存守卫的最初Node验证因没有浏览器IDB而无法到达身份守卫，日志按环境无效保留；改用真实浏览器，不降低断言或把缺库错误冒充产品回归。

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/factory-onboarding-ppic.ts`
- `src/data/fcs/ppic-daily-return-records.ts`
- `src/data/fcs/ppic-return-quantity-basis.ts`
- `src/pages/sewing-outsourcing/daily-return-report.ts`
- `src/pages/sewing-outsourcing/daily-return-summary.ts`
- `src/pages/sewing-outsourcing/responsibility-transfers.ts`
- `src/pages/sewing-outsourcing/workbench.ts`

### 页面证据

- 版本：当前工作树 `/Users/laoer/.codex/worktrees/5f34/higoods`；HEAD `3e6412f25bd389985ca1a2045280eff2220f622b`及未提交任务差异；本轮41个产品源码集合SHA256 `1233bf7e3b788c671249ed4ee9d0d66d2d257ae913ab56f6680a5a91fb77933f`，算法与逐文件哈希见[源码清单](../../output/ppic-adversarial-20261014/final-source-manifest.json)。资产index SHA256 `2c77875f3e3409c2d00cfccc59eb73d76b15fd0b068c43f22c0c3d87a73cf434`，四份最终性能结果均相同。
- 证据：[21项完整浏览器回放](../../output/ppic-adversarial-20261014/browser-final.log)，独立Vite dev5482、Jakarta固定时刻业务边界；截图/trace每次运行独立目录，当前完整回放目录 `output/ppic-adversarial-20261014/browser-1791983459993/`。生产预览5483默认当前人[页面截图](../../output/ppic-adversarial-20261014/current-default-report-1366.png)和[结构/无溢出/无选择器核对](../../output/ppic-adversarial-20261014/current-default-preview.json)。
- 路由：`/fcs/sewing-outsourcing/daily-return-report`、`daily-return-summary`、`workbench`、`team-workbench`、`responsibility-transfers`及回货/分配/看板/生产单进度/耗时/合同/PDA直接消费者。设备：管理1366×768及1280×720、员工Web1024×768、Chrome模拟PDA390×844。
- 初始浏览器四项失败属于身份夹具刷新后未等页面读取完成、以及仍断言原演示成员名称；修正为实际账号和可核对页面就绪，不移除根节点稳定、持久回读或权限断言；原失败[日志](../../output/ppic-adversarial-20261014/browser-identity.log)与`browser-first-artifacts/`保留。

### 性能结论

- 结论：通过
- 依据：本工作树冻结生产预览，73家族各5样本，365个样本全部≤1000ms，最大760.2ms；原始数据、资产身份与缓存校准见本节，失败批次完整保留。
- 范围：40填报/汇总家族、7后道家族、25直接消费者及角色入口、1异步身份失败家族，各5样本，共365，最大760.2ms。与原版相比删除身份切换家族，追加成员/组长工作台及移交分支和身份变化保存失败；95～100原承诺、5补回、30成员及95条导出，未降低规模或门槛。
- 环境：本工作树冻结production preview，Chrome149、回环网络无节流、Asia/Jakarta；管理1366×768/员工1024功能、PDA390×844；真实performance.now，未冻结时钟。起点导航或实际控制事件，终点包含正确内容、必要图片/动画结束/两次绘制；保存和失败含持久回读、失败输入保留。人工填写等待不计，原生确认即时应答开销计入。
- 当前人夹具：仅在隔离浏览器HTML入口先设置现有上下文，所有生产JS/CSS资产字节不变；不向产品增加可切换身份或测试setter。冷资源、刷新、站内切换、浏览器进程冷启动/空数据初始化分别命名，不以热态代替冷态。
- 原始[填报汇总200样本](../../output/ppic-adversarial-20261014/performance.json)、[后道35样本](../../output/ppic-adversarial-20261014/receipt-performance.json)、[消费者125样本](../../output/ppic-adversarial-20261014/consumer-performance.json)、[身份失败5样本](../../output/ppic-adversarial-20261014/identity-failure-performance.json)及对应mjs/日志均在同目录。
- 初始消费者批次3家族最高1019.6ms，[原失败数据](../../output/ppic-adversarial-20261014/consumer-performance-route-cache-disabled.json)和原日志不覆盖。隔离身份夹具使用Page.route使HTTP缓存关闭，与声明的自然缓存环境不符；改为仅Document的CDP拦截，不触碰资源请求。独立[缓存校准](../../output/ppic-adversarial-20261014/cache-calibration.json)确认第二次看板访问旧夹具0个304、新夹具46个304；校准的h1终点仅作网络诊断，不能当完整性能通过样本。修正夹具后同资产25家族完整重采通过，[实际日志](../../output/ppic-adversarial-20261014/consumer-performance-cache-corrected.log)保留全部值。40/7两批已通过，其真实夹具条件为HTTP缓存关闭，按原身份保留这项更严格资源条件，不谎称它们使用自然缓存。统一门槛仍≤1000ms，无例外。
- 新身份失败采集最初把变化安排在浏览器监听器之间，实际在保存开始前就变了身份，未触发目标分支并超时；无数值样本，不填0ms。修正为业务处理器首次读取身份后再微任务变化；5次实际点击均出现拒绝保存、保留草稿、数据库未变；原采集失败文件保留。

### 验证命令

- `npm run build`：通过
- `npx playwright test --config tests/ppic-daily-return.config.ts`：通过
- `npm run test:workflow-governance`：通过
- `node --import tsx scripts/check-sewing-outsourcing-workbench.ts`：通过
- `node --import tsx scripts/check-sewing-outsourcing-information-architecture.ts`：通过
- `node --import tsx scripts/check-sewing-outsourcing-list-page-consistency.ts`：通过
- `node output/ppic-adversarial-20261014/performance.mjs`：通过
- `node output/ppic-adversarial-20261014/receipt-performance.mjs`：通过
- `node output/ppic-adversarial-20261014/consumer-performance.mjs`：通过
- `node output/ppic-adversarial-20261014/identity-save-failure-performance.mjs`：通过
- `git diff --check`：通过

命令结果和说明分别登记：[构建923项](../../output/ppic-adversarial-20261014/build.log)、[浏览器21项](../../output/ppic-adversarial-20261014/browser-final.log)、[治理323项](../../output/ppic-adversarial-20261014/workflow-contracts.log)。三个相邻检查的日志见上文，未删除业务断言；四份性能结果及原失败见性能结论。

同范围原型/列表治理在本记录定稿后执行，原始结果放在`output/ppic-adversarial-20261014/governance.log`；最后冻结后[技术收据](../../output/ppic-adversarial-20261014/task-receipt.json)绑定完整任务差异，生成后不修改本记录伪造新鲜度。聚合收据会按工具现有路由重复部分已验证检查，不能以此冒充第二次业务接受。初次记录把来源说明混入“通过”枚举导致格式检查拒绝，原失败保留；仅修正记录格式，不放宽检查器。

### 例外

- 无

无性能例外。前序全库TypeScript的13项PCS/技术包既有诊断及两条历史百分号文档链接问题仍按原记录身份保留，未变相关源码，不把它们改成已通过。本轮真实生产登录/权限后端、实机PDA、实体打印机、外部系统和真实工厂接受未执行，不能由本地技术结论代填。
