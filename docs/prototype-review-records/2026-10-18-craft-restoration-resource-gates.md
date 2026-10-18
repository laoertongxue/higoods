# 工艺读取、资源及详情显示边界（R11发布前本地技术记录）

依据 `AGENTS.md` 当前治理基线。任务始于2026-10-18，本轮记录日期2026-10-19。T4共享读取/初始化/显示边界，叠加T5 main/GitHub/Caddy。确认人Codex技术验证，不代表用户业务接受。工作树/Users/laoer/.codex/worktrees/dfd6/higoods，分支codex/seam-embroidery-unification，Git基线752df2eedde28808418ca2b22556164ffea18e12。

## 需求、继承与非范围

用户要求剩余六类先逐一修复/核对，全部16正式工艺各五次、全量、最后两轮实质对抗审查、<=1000ms不降低；全部通过后main仅ff、推送GitHub及Caddy正式发布，最后核对线上精确版本和全部页面。原18身份中三个已合并为缝边绣，保持现16正式身份、单工厂及全部业务事实/图片/操作。未授权的财务规则、PDA代确认、印花业务、框架/依赖/部署配置不改，不接测试站数据库，不触碰原用户IAB/profile/43183。

已发布752/Actions39135930549身份正确，原主95有6个有效慢样本最高1593.9ms、相关25有20个有效慢样本最高1831.9ms，整体未完成。R10本地通过但最后第1轮发现任务比较两空数组缺口，补齐16类158完整任务后关闭；最后第2轮发现按PO缓存没有详情入口reset，真实反例v1更新v2仍读v1，故R10仍未通过、未发布。原失败/各候选/原始CLI/JSON/源与hash全部保留，R11不把旧性能或正式失败改标通过。修复前本审查记录保存在R11/prior-R10-review-record.md及R10的冻结diff和记录原件。

## 设计、计划与实际实现

继承R10的精确四读取页（预结算流水、对账单、扣款分析、染色统计）：不启动无关PMS/宽FCS路由，原PCS（适用）、cutting/production context/part tickets/effects准备顺序和原包装器保持，染色水洗准备及失败重试保持。effects仅null可跳，非null坏值必须原codec阻断；四页显示转义的真实原因及原重新读取按钮，保留资料。事件直接原owner、false草稿与原statement Escape保持。

共享批读取复用同同步批次已持有的交接单头，默认/错ID仍原查找。列表一次渲染按PO复用只读技术包快照，原列表reset不变。R11仅在公开详情入口的原readPrepared callback准备完成后、调用同步详情renderer前reset全部显示上下文，从而下一个直达详情重新读来源，同次渲染仍复用。没有更改原详情业务字段、动作、数据保存或路由。

原16恢复模块根据真实bundle闭包优先，另外11 render模块仍同次导航全部加载；27模块完整数据与图片不省略，baseline/图优先级和求值顺序保持。其它80guard不扩张。1432保留模块各一次，25保护owner集合保持；新详情import依赖边完全不变，只使用同一已导入模块的reset导出。

实施顺序：需求/计划→actual public-entry+cache最小失败契约→局部修复→1177单元/工程类型/构建及图压缩hint→16逐项各五次→原全131/95/3及36布局→相关五页25→12保存/坏记录/真实修复重读与原控件→16真实详情直达/原生刷新→主代理完整diff正反核对→最终两轮独立审查→14文件技术收据及重建字节一致→main ff/GitHub全SHA一致→Actions/Caddy精确版本→正式原全量、相关25和16详情/刷新。有效慢值全部保留，全部通过才生成最终交付。

## 环境、存储与证据边界

R11/P11根为output/verification/craft-detail-render-boundaries和output/playwright/craft-detail-render-boundaries。自有生产预览43185，Chrome155.0.8059.80、1366×768，另1280×720/1024×768布局；zh-CN/AsiaShanghai。Node本地26.8.2/CI24，锁文件不变。每性能样本新合成context，空HTTP缓存、原完整工厂fixture及PCS资料；原NavigationStart、root/真实标题/行、可见实图decode/字体/双RAF/交互终点与关键SHA保持。每家族>=5，每个有效值<=1000，禁止删慢、缩数、平均、预热或重试至绿。

原静态/IndexedDB owner负责业务记录，未改读写事务、迁移、附件、保存后备。普通owner无业务写入，工厂raw不变；PDA角色/用户演示种子不纳入零写声明。功能采集仅在自有context用CDP关闭缓存以取真实200和每个消费body，属于功能/版本回读，不冒充冷启动样本；其已观测耗时若>1000仍失败。invalid后的修复是合成fixture管理事务，等complete再点原按钮，不描述为产品自动修复。

158任务/8事实证明保持原R10身份，R11逐项核199实际导入源与新build输入一致；被修详情没有参加原199源证明，另以actual公开入口+真实cache契约和16真实详情页面验证。公开入口契约的私有renderer消费者是测试stub，不能声称完整DOM变更已由该契约直接证明。预结算可直接展示保存overlay字段，另三相关页只保留受限关联导航证明，不夸大直接字段覆盖。

## 原子矩阵

以下状态关闭本轮具名本地技术范围；最终审查、发布和正式验收不预填。独立追加结果保留源版本身份。

|编号|来源|原子结果|工作包/实际文件|自动化|页面/性能或不适用|状态|证据位置|确认人/版本|
|---|---|---|---|---|---|---|---|---|
|READ-01|用户/原规则|四精确入口保持原读取且不启动无关PMS|main.ts/craft-read-entry.ts|actual入口/初始化单元|新相关五页与控件|已验证|R11/functional-controls-audit.json|Codex/R11，正式待验|
|READ-02|用户/原规则|原PCS及FCS准备顺序保持|main.preparePageRouteEntry|actual准备顺序单元|1177及真实页面|已验证|R11/technical-checks.json|Codex/R11，正式待验|
|READ-03|用户/原规则|保存effects完整恢复|原production context owner|实际codec/分支|12新功能场景|已验证|R11/functional-saved-audit.json|Codex/R11，正式待验|
|READ-04|用户/原规则|坏资料真实原因/保留/原按钮恢复|main错误边界|最小失败/转义单元|真实修复后原reload|已验证|R11/functional-saved-audit.json|Codex/R11，正式待验|
|READ-05|用户/原规则|exact4原wrapper及相邻路由边界保持|router/routes.ts|actualresolve函数|四正常页/相邻测试|已验证|R11/technical-checks.json|Codex/R11，正式待验|
|READ-06|用户/原规则|染色原水洗准备/失败重试保持|原route-renderers-fcs未改|wrapper与源核对|真实染色读取/原owner导航|已验证|R11/functional-controls-audit.json|Codex/R11，正式待验|
|READ-07|用户/原规则|原owner false/Escape/控件保持|main.dispatchPageEvent|实际dispatcher单元|65次原操作|已验证|R11/functional-controls-audit.json|Codex/R11，正式待验|
|READ-08|用户/原规则|精确完整资源仅导航内提示|vite.config.ts|真实插件/112case|16high/27完整|已验证|R11/hint-contract.json|Codex/R11，正式待验|
|READ-09|用户/原规则|共享批读取与显示事实完整|warehouse/PDA/order-display|批读取/reset单元|16类158任务/8facts全等源连续|已验证|R11/task-facts-proof-continuity.json|Codex/R11，正式待验|
|READ-10|用户/原规则|16类逐一五次<=1000|原task-orders及采集器|全部80值|下表逐类|已验证|R11/individual-local-status.json|Codex/R11，正式待验|
|READ-11|用户/原规则|全131/95/3及图/布局/取消刷新|原冻结采集器|真实CLI与JSON|同版全量36布局|已验证|R11/full-local-summary.json|Codex/R11，正式待验|
|READ-12|用户/原规则|完整diff和最后两轮实质对抗审查无阻断|最终14文件/证据|root+两个新round|不适用:审查|待实施|R11/独立结果待追加|Codex/R11，正式待验|
|READ-13|用户/原规则|main/origin/remote/GitHub全SHA一致|显式14路径/ff/push|多方SHA|不适用:Git|待实施|R11/git-publish.json待产出|Codex/R11，正式待验|
|READ-14|用户/原规则|精确Caddy正式版本发布|原Actions|fullSHA/run/rawmap/body|正式HTTPS|待实施|R11/Actions/正式证据待产出|Codex/R11，正式待验|
|READ-15|用户/原规则|正式原全量/相关25/16详情全部达标|新正式采集器|全部有效值<=1000/精确版本|正式131/95/3+25+32详情观察|待实施|R11/final-delivery.json只全过才生成|Codex/R11，正式待验|
|GATE-01|用户/PERF/STORE|原16恢复闭包优先且27模块完整|vite/原owner|实际源/构建/CLI核验|新版本具名证据|已验证|R11/gate-priority-contract.json|Codex/R11|
|GATE-02|用户/PERF/STORE|原数据/图/初始化求值保持|vite/原owner|实际源/构建/CLI核验|新版本具名证据|已验证|R11/bundle-comparison.json|Codex/R11|
|GATE-03|用户/PERF/STORE|其它80guard优先级不变|vite/原owner|实际源/构建/CLI核验|新版本具名证据|已验证|R11/gate-priority-contract.json|Codex/R11|
|GATE-04|用户/PERF/STORE|1432模块唯一和25保护owner保持|vite/原owner|实际源/构建/CLI核验|新版本具名证据|已验证|R11/bundle-comparison.json|Codex/R11|
|GATE-05|用户/PERF/STORE|逐项/全量/相关25均新版本达标|vite/原owner|实际源/构建/CLI核验|新版本具名证据|已验证|R11/full-local-summary.json|Codex/R11|
|GATE-06|用户/PERF/STORE|最后两轮/收据/发布/正式全部通过|vite/原owner|实际源/构建/CLI核验|新版本具名证据|待实施|R11/独立后验待产出|Codex/R11|
|GATE-07|用户/PERF/STORE|真实错误恢复不覆盖资料|vite/原owner|实际源/构建/CLI核验|新版本具名证据|已验证|R11/functional-saved-audit.json|Codex/R11|
|DETAIL-01|R10-R2-B01/用户|准备完成后、同步详情渲染前reset|task-detail.ts原公开入口+batch-read测试|actualAST/原件审计|不适用:入口契约另真实页面|已验证|R11/detail-render-freshness-audit.json|Codex/R11|
|DETAIL-02|R10-R2-B01/用户|同PO不同任务读当前v2/v3/v4|task-detail.ts原公开入口+batch-read测试|actualAST/原件审计|不适用:入口契约另真实页面|已验证|R11/detail-render-freshness-audit.json|Codex/R11|
|DETAIL-03|R10-R2-B01/用户|准备失败传播、恢复后新读|task-detail.ts原公开入口+batch-read测试|actualAST/原件审计|不适用:入口契约另真实页面|已验证|R11/detail-render-freshness-audit.json|Codex/R11|
|DETAIL-04|R10-R2-B01/用户|同一次渲染仍每PO一次|task-detail.ts原公开入口+batch-read测试|actualAST/原件审计|不适用:入口契约另真实页面|已验证|R11/detail-render-freshness-audit.json|Codex/R11|
|DETAIL-05|R10-R2-B01/用户|16非wool真实详情直达和reload一致|task-detail.ts原公开入口+batch-read测试|actualAST/原件审计|16真实详情32功能观察|已验证|R11/functional-details-audit.json|Codex/R11|
|DETAIL-06|R10-R2-B01/用户|正式16详情和reload精确版本与逐次<=1000|task-detail.ts原公开入口+batch-read测试|actualAST/原件审计|16真实详情32功能观察|待实施|R11/正式details后验待产出|Codex/R11|

## 逐类清单

|编号|来源|原子结果|工作包/实际对象|自动化|页面/性能|状态|证据位置|确认人/版本|
|---|---|---|---|---|---|---|---|---|
|COLD-01|用户/PERF|打揽完整冷启动<=1000ms|原task-orders.ts/AUX-OP-DALAN|逐项原始CLI/JSON audit|5次最高291.000ms|已验证|P11/local-v1-aux-op-dalan|Codex/R11本地，正式待验|
|COLD-02|用户/PERF|打条完整冷启动<=1000ms|原task-orders.ts/AUX-OP-STRIP|逐项原始CLI/JSON audit|5次最高360.100ms|已验证|P11/local-v1-aux-op-strip|Codex/R11本地，正式待验|
|COLD-03|用户/PERF|烫画完整冷启动<=1000ms|原task-orders.ts/AUX-OP-HEAT-TRANSFER|逐项原始CLI/JSON audit|5次最高241.900ms|已验证|P11/local-v1-aux-op-heat-transfer|Codex/R11本地，正式待验|
|COLD-04|用户/PERF|直喷完整冷启动<=1000ms|原task-orders.ts/AUX-OP-DIRECT-PRINT|逐项原始CLI/JSON audit|5次最高233.400ms|已验证|P11/local-v1-aux-op-direct-print|Codex/R11本地，正式待验|
|COLD-05|用户/PERF|打褶完整冷启动<=1000ms|原task-orders.ts/AUX-OP-GATHERING|逐项原始CLI/JSON audit|5次最高289.600ms|已验证|P11/local-v1-aux-op-gathering|Codex/R11本地，正式待验|
|COLD-06|用户/PERF|激光开袋完整冷启动<=1000ms|原task-orders.ts/SPC-OP-LASER-POCKET|逐项原始CLI/JSON audit|5次最高275.600ms|已验证|P11/local-v1-spc-op-laser-pocket|Codex/R11本地，正式待验|
|COLD-07|用户/PERF|布包扣完整冷启动<=1000ms|原task-orders.ts/AUX-OP-COVERED-BUTTON-MAKING|逐项原始CLI/JSON audit|5次最高270.500ms|已验证|P11/local-v1-aux-op-covered-button-making|Codex/R11本地，正式待验|
|COLD-08|用户/PERF|压褶完整冷启动<=1000ms|原task-orders.ts/AUX-OP-PLEATING|逐项原始CLI/JSON audit|5次最高264.800ms|已验证|P11/local-v1-aux-op-pleating|Codex/R11本地，正式待验|
|COLD-09|用户/PERF|特种车缝（花样机）完整冷启动<=1000ms|原task-orders.ts/SPC-OP-PATTERN-MACHINE-SEWING|逐项原始CLI/JSON audit|5次最高266.800ms|已验证|P11/local-v1-spc-op-pattern-machine-sewing|Codex/R11本地，正式待验|
|COLD-10|用户/PERF|绣花完整冷启动<=1000ms|原task-orders.ts/AUX-OP-EMBROIDERY|逐项原始CLI/JSON audit|5次最高273.900ms|已验证|P11/local-v1-aux-op-embroidery|Codex/R11本地，正式待验|
|COLD-11|用户/PERF|缝边绣完整冷启动<=1000ms|原task-orders.ts/AUX-OP-SEAM-EMBROIDERY|逐项原始CLI/JSON audit|5次最高269.100ms|已验证|P11/local-v1-aux-op-seam-embroidery|Codex/R11本地，正式待验|
|COLD-12|用户/PERF|盘扣完整冷启动<=1000ms|原task-orders.ts/AUX-OP-BUTTON-LOOP|逐项原始CLI/JSON audit|5次最高231.500ms|已验证|P11/local-v1-aux-op-button-loop|Codex/R11本地，正式待验|
|COLD-13|用户/PERF|花朵完整冷启动<=1000ms|原task-orders.ts/AUX-OP-FLOWER-MAKING|逐项原始CLI/JSON audit|5次最高313.100ms|已验证|P11/local-v1-aux-op-flower-making|Codex/R11本地，正式待验|
|COLD-14|用户/PERF|烫钻完整冷启动<=1000ms|原task-orders.ts/AUX-OP-HOTFIX-RHINESTONE|逐项原始CLI/JSON audit|5次最高276.000ms|已验证|P11/local-v1-aux-op-hotfix-rhinestone|Codex/R11本地，正式待验|
|COLD-15|用户/PERF|模板工序完整冷启动<=1000ms|原task-orders.ts/SPC-OP-TEMPLATE-PROCESS|逐项原始CLI/JSON audit|5次最高290.000ms|已验证|P11/local-v1-spc-op-template-process|Codex/R11本地，正式待验|
|COLD-16|用户/PERF|橡筋定长切割完整冷启动<=1000ms|原task-orders.ts/SPC-OP-ELASTIC-FIXED-LENGTH-CUTTING|逐项原始CLI/JSON audit|5次最高257.700ms|已验证|P11/local-v1-spc-op-elastic-fixed-length-cutting|Codex/R11本地，正式待验|

## 基本信息

- 日期：2026-10-19
- 任务 / 需求编号：READ-01～15、GATE-01～07、DETAIL-01～06、COLD-01～16
- 验证人：Codex技术验证

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：共享读取和资源继承、详情显示缓存边界修复。当前本地技术闭合不代替最后审查及正式交付。

## 自查结论

|检查项|结论|证据及说明|
|---|---|---|
|代码与失败契约|通过|actual public-entry先v1/v2断言失败后3契约通过；1177单元/工程类型/构建通过；初始stub依赖错误原件保留不当产品反例|
|完整任务与事实|通过|task-facts-proof-continuity.json核原16非空158完整任务/8facts/199actualsrc与R11 build inputs一致；原空数组缺口明确保留|
|正常列表与布局/图片|通过|全131场景/36布局/取消刷新/滚动图及三原生通过；源/完整行数/实图未减|
|本地性能|通过|16逐项80最高360.100ms；全95最高325.500ms；相关25最高372.900ms；每有效值<=1000|
|保存与原控件|通过|functional-saved/controls-audit.json为当前新v5，12保存/恢复及65原动作，普通owner零写、每重复actual200body校验|
|真实详情|通过|functional-details-audit.json当前16独立context真实直达+reload，32次功能观察；与入口契约分开，未伪称DOM变更或cold家族|
|实际资源图与压缩|通过|bundle-comparison/compression/hint/gate-priority四契约；1432唯一/25owner/完整27资源及其它80guard保持|

原4条额外历史专项脚本失败保留，未声称通过：旧扣款fixture/已废筛选文案、未改PDA提示及未改印花统计token。R9/legacy-check-scope-audit.json给不变源和原版复现，仅证明既有失败范围；本任务新的UI/owner/冷启动和必需FCS检查照常执行，不因此改无关业务或放宽门禁。全量typecheck原19个PCS错误单列，工程类型无新增错误。

## 最终结论

结论：通过

仅关闭本轮具名本地技术候选。最后两轮审查、收据、main/GitHub/Caddy和正式全量仍待独立门禁，整体任务未完成；旧正式有效失败保持。全部通过后才生成R11/final-delivery.json，用户业务接受未取得。

## 变更覆盖与验证

### 受管文件

- `src/main.ts`
- `src/main-infrastructure/craft-read-entry.ts`
- `src/router/routes.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/pages/process-factory/special-craft/order-display.ts`
- `src/pages/process-factory/special-craft/task-detail.ts`
- `vite.config.ts`
- `tests/unit/craft-direct-route.test.ts`
- `tests/unit/craft-entry-initialization.test.ts`
- `tests/unit/craft-read-entry.test.ts`
- `tests/unit/craft-route-preload.test.ts`
- `tests/unit/craft-batch-read.test.ts`

### 页面证据

- 版本：基线752加当前14任务文件，R11/asset-version.json绑定源/测试与全部1131实际资产；生产预览43185/Chrome155/1366×768，布局另1280及1024。
- 证据：P11各local-v1-op、local-v1-full/native；affected-extra-local-v1；extra-saved-recovery-v5；extra-controls-v5；extra-detail-functional-v1全部独立CLI/JSON/binding/截图原件，R11各audit可重核，不把旧R10样本冒名新版本。

### 性能结论

- 结论：通过
- 依据：上述R11具名80/95/25新样本每有效值<=1000；功能详情32观察另标functional而不加入cold家族，观测>1000同样不能过。正式部署后原全部cold及相关25、16详情仍需精确版本新核，当前不声明正式通过。

### 验证命令

- `node --import tsx --test tests/unit/*.test.ts`：通过
- `npm run typecheck:engineering`：通过
- `node output/verification/craft-detail-render-boundaries/build-candidate.mjs`：通过
- `python3 output/verification/craft-detail-render-boundaries/compare-bundle.py`：通过
- `node output/verification/craft-detail-render-boundaries/check-compression.mjs`：通过
- `node output/verification/craft-detail-render-boundaries/check-hints.mjs`：通过
- `node output/verification/craft-detail-render-boundaries/check-gate-priority.mjs`：通过
- `python3 output/verification/craft-detail-render-boundaries/audit-local.py`：通过
- `python3 output/verification/craft-detail-render-boundaries/seal-detail-freshness.py`：通过
- `python3 output/verification/craft-detail-render-boundaries/seal-task-facts-continuity.py`：通过

### 例外

- 本地候选通过与用户要求整体交付分开；最后两轮、正式版本和全部有效值不预填通过，不以旧正式故障为豁免、不清用户数据、不减少完整资料和图片。
