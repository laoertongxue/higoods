# 工艺列表只读依赖与生产草稿入口修复

依据根文件 `AGENTS.md` 的 SCOPE-02、TRACE-01、STORE-01～STORE-05、LIST-01 及适用验收要求记录本次实际结果；本报告不新增治理或产品规则。

## 基本信息

- 日期：2026-10-17
- 任务 / 需求编号：LOAD-01～LOAD-10；继承 SEAM、INIT、COLD 有效要求。T4 本地产品验证与 T5 新提交正式发布分别关闭。
- 验证人：Codex 主代理；独立实质审查在 LOAD-09 绑定。代理技术验证不代替用户、真实工厂、共享后端或用户设备接受。
- 分支：`codex/seam-embroidery-unification`；基准 HEAD：`8872ad55559fb930d08d9f64dc81a81a7e8ed6be`；工作树：`/Users/laoer/.codex/worktrees/dfd6/higoods`。
- 冻结版本：151 个源 / 测试输入、1211 个产物（885 raw），`asset-version.json` SHA256 `185b449fbd79fd8fb5d3e0526106eeef40b17319fb554b9c07597cecff147bf5`；入口 SHA256 `ddfcf0fe97b5d168cb3d3df7e609fbe7d7868d0359e5911a63991a47652a9da0`。报告在运行输入之外独立绑定，最终完整十路径指纹由新技术收据记录。
- 服务：同一工作树 `http://127.0.0.1:43183` 的 Vite 生产预览，PID 51618；功能前与全部性能后分别核对服务 cwd、实际入口正文、151 源和1211产物，无漂移。
- 当前阶段：本地构建、直接与全量功能、615项性能及两轮实质审查均已通过；本报告定稿后核第二轮文档字节封口并真实执行精确技术收据。新提交及正式T5尚未完成。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：共享只读依赖边界及生产单三个操作入口的等待和过期保护变化，影响初始化和动作时序；按 T4 验直接消费者，用户要求发布叠加 T5。

## 范围、继承与设计

继承用户要求的清单、逐项调整核对、全量核对及最后两轮实质审查。三类合并后最终16类，完整清单与逐类实现见 `2026-10-17-seam-embroidery-unification.md`；存量与入口见 `2026-10-17-craft-entry-initialization.md`；详情确认命令见 `2026-10-17-craft-command-load-repair.md`。这些父报告保留原版本，不回写历史结果。本轮继续验证唯一缝边绣身份、每类唯一承接工厂、无工厂切换页签、退役身份清洁、历史实际工厂追溯，以及授权的无编码历史可选工艺成本清理；不保留旧名称映射。

正式基准8872 / Actions39032370345已成功部署且全量功能通过，但五个独立浏览器进程冷启动均是有效失败：1101.9、1006.2、1163.6、1174、1165.2ms。原始 `formal-8872ad55-performance/performance-browser-cold.json` 和原部署证据保持不变，不能关闭任务。本轮未部署，不以本地通过替代正式证据。

只读诊断发现列表沿“仓储 → 物料接收草稿 → 完整配料投影 → 工艺执行”带入完整印花、染色及配料。此前来源标签和两个配料读取叶子的组合曾进入同一次构建但无收益，已撤回；本轮新增断开第三条链后再机械迁出两个叶子。加载优先级诊断未改善整体，未进入产品。诊断观察器、改写HTML及单次值均不是验收样本。

实现只包含八个运行源、一个专项测试和本报告，共十路径：

1. 来源标签移到轻量叶子，原公开模块重导出同一常量对象，交接读取改用叶子。
2. 已存确认配料读取、原明细回退和两位数量舍入机械迁到轻量叶子；原模块重导出同一读取函数，仓储改用叶子。持久键、默认来源、损坏源处理、零值及数量精度保持。
3. 准备、恢复、确认三个同步 API 与私有重建增加必填原投影 reader 参数。唯一页面调用方先加载原 `getMaterialPrepOrderProjection` 再传入；原同步校验、快照、数量、保存及回滚不跨 await。函数签名确有调整，未宣称签名原样。
4. 页面限定 helper 在加载后核 URL、原 DOM 节点、当前抽屉、草稿归属与已创建状态；在途去重，finally释放，失败只在有效当前页面提示原原因。准备完成前不展示新草稿输入。

不改变业务数量、状态、单位、工厂、身份、附件、布局、保存介质、事务、Vite或发布配置。不新增事实源、投影后备、注册桥或全模块存储迁移。生产接收命令原有 localStorage 介质保持原身份；本次依赖切分不宣称该模块已迁入IndexedDB。所有写入测试均在本任务独立浏览器原型上下文，不写测试数据库或网络后端。

## 计划、变更记录与原子矩阵

先建静态依赖失败契约及实际处理器等待 / 重复 / 失效 / 恢复反例，机械迁出并传入必填reader，再核实际构建图、完整构建、直接生产与毛织动作、全部16类页面、原生恢复和性能；随后最终两轮审查、报告封口、精确技术收据、提交 / FF main / GitHub / Actions / 正式同版验收。

采集适用性变更：实际产物与动作前HTTP记录证明，生产页的 events和drawer均静态依赖同一配料owner，按钮出现前已经加载。七种“按钮已可点但首次GET仍待加载”的浏览器交错不可达，因此不伪造模块、清缓存或暂停页面初始化来冒充。原 `result.json` 的 global passed=false、coverageComplete=false、七项blocked保持；只接受两个可达真实UI用例，七种防错分别由实际源函数契约验证。该适用性判断不豁免业务要求，最终两轮已分别独立核定其当前适用性。

性能覆盖变更：原590不覆盖新生产helper，追加五个可达操作家族各5次，共25；原590的源、时钟、数据、动作、门槛和失败证据均不改。当前总615 / 123。新采集器首个最小预检v4等待了屏幕外lazy图，主代理中止，保留可信起点及null/invalid失败；独立500ms诊断确认18图中仅两张裁剪外lazy图保持decode pending、动画已结束。修正工具的可见几何范围后，独立审查及5项最小预检通过，才运行正式25。预检、诊断和历史失败不混入615，也不重标通过。

| 编号 | 来源 | 原子要求 / 工作包与实际位置 | 自动化证据 | 页面 / 性能 / 边界 | 状态 | 确认人 / 版本 |
| --- | --- | --- | --- | --- | --- | --- |
| LOAD-01 | 正式冷启动失败 | 列表静态闭包无完整印花、染色、配料执行；两叶子、领域/交接/仓储、material-request-drafts | 11专项；实际产物模块图 / closure | task-orders 58 chunks，实际preload JS 3563654→3018097 bytes；体积不等于时延，时延另验 | 已验证 | root / 185b449f |
| LOAD-02 | 原业务 / STORE | 原同步校验、数量、快照、保存、回滚保持；material-request-drafts三入口及rebuild/runMaterialRequestAction | original-body-proof八项；实际同步回滚契约 | 实际UI保存失败保原LS及全部输入并明确重试；演示单不证明新增正式订单刷新持久化 | 已验证 | root / 185b449f |
| LOAD-03 | 操作等待 | 模块准备前不新开输入或执行命令；events限定helper | 实际函数三action延迟反例 | 可达UI打开前零输入、之后唯一正确抽屉；七个browser pending不可达的范围见变更记录 | 已验证 | root / 185b449f；两轮已核定适用性 |
| LOAD-04 | 防错 | 重复去重；URL、节点、抽屉、草稿归属或状态失效不执行 | 实际函数重复/离开/同URL新DOM/切换/易主/已创建反例 | 新生产pending不冒称browser通过；原工艺3个真实开窗反例只证明原task-detail链 | 已验证 | root / 185b449f；源契约与浏览器范围分列 |
| LOAD-05 | 失败恢复 | 加载拒绝保护释放；真实保存失败无假成功，可明确重试 | 实际函数load rejection/retry及同步回滚 | 两真实UI用例及新增25含混合行选择、全部输入保真；Quota与模块加载失败分开 | 已验证 | root / 185b449f |
| LOAD-06 | 公开读取 | 原标签对象/读取函数同一性，键名、舍入、零卷与旧明细回退保持 | 11专项及机械函数体比较 | 原仓储/接收直接消费者及原生读取；普通读取未新增写源 | 已验证 | root / 185b449f |
| LOAD-07 | 用户继承要求 | 16类结构、唯一厂、清洁、图片、成本、毛织及存量保持 | 完整build1121；毛织开发E2E17 | 48列表/158详情/176图片/6分支/原生18/页签4/effects3/原开窗3；清洁0命中 | 已验证 | root / 185b449f |
| LOAD-08 | PERF | 本地完整615 / 123，每族≥5，每值≤1000ms，资源与协议严格绑定 | 原590严格合并+独立25原始报告 | 最大387.5ms；原590和新增25分开；正式要求移交LOAD-10及继承COLD-12，不减少 | 已验证 | root / 185b449f |
| LOAD-09 | 用户两轮审查 | 合并前最终完整差异、正向追踪与逆向反证两轮通过 | read-dependency-review-round-1.json / round-2.json | R1正向与R2逆向分析均通过；最终R2另核定稿字节，设计/工具旁审不计 | 已验证 | release_evidence_audit / contract_audit；185b449f |
| LOAD-10 | 用户 T5 | 新提交main/GitHub/Actions/正式版本及全量功能和性能一致 | 精确十路径收据及新发布 | 新SHA/run、正式前后885raw、全部页面与615、最终审查另验；旧8872性能失败保留 | 待实施 | 新提交正式阶段待执行 |

## 自查结论

| 检查项 | 结论 | 证据 / 边界 |
| --- | --- | --- |
| 完整范围与依赖 | 通过 | 实际十路径；八项机械函数体比较；构建图真实闭包58，不以源码断言替代产物 |
| 配置内工程检查、单元与构建 | 通过 | read-dependency-full-build.log：工程检查及1121/1121，Vite成功；专项11/11 |
| 当前全部列表、详情和图片 | 通过 | core-functional-summary及逐类JSON；root-visual-review实际截图检查；三个设备尺寸 |
| 毛织Web/PDA/打印相邻动作 | 通过 | 原开发测试17/17、40.4s，生产包核验分别记录，不混服务 |
| 原生事实、附件、页签与初始化 | 通过 | 原生18、页签4、effects3，原工艺开窗3；严格资源绑定 |
| 生产可达UI与失败输入保真 | 通过 | 原2UI及新增10个场景记录，混合选择、接收方式、全部行/数量/备注、失败原源及明确重试 |
| 生产pending浏览器暂停 | 不适用 | 同一owner在页面可用前已静态加载；真实图/HTTP与实际函数契约分别证明。原七blocked/globalfalse保留，不称浏览器通过 |
| 退役身份与工程清洁 | 通过 | 当前6001文本源、590文本产物及7123路径扫描0命中；旧名称和别名仅在ignored取证中识别，未进入产品 |
| 本地完整性能 | 通过 | all-615-summary：615 / 123，最大387.5ms，当前最终样本0slow/invalid/error；所有旧慢值和预检失败另按原件保留 |
| 最终两轮实质审查 | 通过 | 当前R1与R2分析均无findings/openIssues，53条逐项覆盖；R2最终文件另含本报告字节封口 |

独立全仓诊断 `npx tsc --noEmit` 在候选和Git8872基准均退出2、各19错误，日志字节完全相同，SHA c2dbec823d48dabe7bd7edb541a33a214d7747f42cdb769c5806ca4a73aaeac2；新增/消除均0。此诊断是继承失败，未改成通过。本轮配置内工程门禁与真实完整build通过分别报告，不扩修无关19项。

## 两轮实质审查结果

第一轮由 release_evidence_audit 正向追踪需求及独立复算原件，`read-dependency-review-round-1.json` SHA256 `d7f405f49ae99519f28404d87cc73319c8f40345e73043e13b5e3803839d8b43`，passed=true、findings和openIssues均为空，覆盖53条要求。第二轮由 contract_audit 逆向反证，`read-dependency-review-round-2-analysis.json` SHA256 `b1e56bacb9473e6116094cbf115582ee19e0f337b4e5e650edeccec19ecba745`，同样通过、无开放问题。两轮均是本候选的完整产品审查，工具旁审没有计入。

本次报告定稿只更新已发生的审查状态及视口取证口径，八个产品源、测试及全部运行资产未变。第二轮最终文件 `read-dependency-review-round-2.json` 以 documentClosure 绑定本报告最终SHA、第一轮原件SHA和第二轮分析SHA；该字节封口不另算第三轮产品审查。技术收据及正式T5保持各自实际阶段，不将本地通过或旧部署替代新正式验收。

## 最终结论

结论：通过

本地T4产品功能、完整615性能与两轮实质审查通过。第二轮最终记录核定本报告定稿字节后，真实执行当前技术收据及精确发布；正式T5仍须新提交同版本独立核验，本报告不冒称整个用户任务已交付。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/material-prep-record-read.ts`
- `src/data/fcs/material-request-drafts.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/process-work-order-source-labels.ts`
- `src/data/fcs/warehouse-material-execution.ts`
- `src/pages/production/events.ts`
- `tests/unit/craft-list-source-boundary.test.ts`
- `docs/prototype-review-records/2026-10-17-craft-list-read-dependency-repair.md`

### 页面证据

以下路径相对 `output/playwright/seam-embroidery-unification/`，Node175位于 `output/verification/wool-storage/performance/command-read-dependency-final-local/`。

- 版本：上述分支/HEAD+151源完整哈希及1211资产冻结；`command-read-dependency-final-local/local-service-before.json` / `local-service-after.json` 首尾核对相同实际服务和入口。页面与完整性能后无源或产物变化，报告独立由收据封口。
- 证据：列表路由`/fcs/process-factory/special-craft/<operation>/work-orders`，全部16类各1366×768、1280×720、1024×768；完整分页集合在1366采集，另外32场景为布局和图片等分支，不宣称三个视口分别重遍全部记录；`online-01～16.json`和截图。158详情/176图片、六分支、字典/能力、列设置/拖拽/冻结/恢复及成本清理分别见 `command-read-dependency-final-local/` 的原JSON和core-functional-summary。
- 图片：继承对象对应的真实素材与原网址；原全量图片预览及关闭/失败交互、17E2E打印/QR分别保留，不因本轮依赖调整虚构新来源。根视觉检查见同目录 `root-visual-review.json`。
- 原生与恢复：同目录entry-idb-identity-result18、entry-stored-tabs-result4、entry-effects-result3、craft-dialog-open-guard-functional3；实际唯一资源集90/73/79/118。三项旧开窗证明原工艺链，不代替新生产helper的源码反例。
- 直接生产：`read-dependency-production-actions/local-185b449f-prepared/result.json` 两可达UI通过、116唯一首200正文、347响应、资源身份通过。`root-scope-acceptance.json`明确保留globalfalse/七blocked。真实初始演示PO-202603-0004按原代码不持久保存demo修改；此次当前DOM和操作日志、保存失败回滚不冒充正式新单刷新持久化或全模块迁移。
- 相邻毛织：同目录wool-e2e-dev.log，开发服务43233，原17用例全部通过；生产预览与源码导入夹具分别命名。
- 原重叠功能批次因主代理曾误并行同CLI而整体作废，`command-read-dependency-local/functional-overlap-invalid-batch.json`保留；正式证据来自清洁串行 `command-read-dependency-final-local/functional-driver-outcome.json`，未借用作废结果。
- 技术：`cold-8872-diagnostic/original-body-proof.json`八项、source-boundary-full-green.log十一项、read-dependency-full-build.log；实际模块图及closure、emitted-preload-comparison分别保留，不把静态58chunks和preload数量混为一谈。独立tsc失败见typecheck-comparison及两原日志。

### 性能结论

- 结论：通过
- 依据：`command-read-dependency-final-local-performance/all-615-summary.json` 严格绑定原590和新增25原件，615 / 123，最大387.5ms，每家族5次，当前最终样本0slow/invalid/error。

原CLI415条件不变，包括5个独立浏览器进程冷启动。Node175的原collector、计时、点击、数据、持久回读、图片/字体/绘制、每族5和1秒门槛不变；固定非忙等5秒只在原context.close成功后及最终browser.close施加，不加在同context动作或失败重试之间。实际协议覆盖1/10/102/5个上下文、122个间隔和3个跨job边界。仅证明采集器五秒内不主动发起应用请求，不称服务器/网络排空，不把所有收益归因于代码。

新增25分别为打开、恢复建议、确认成功、原存储Quota失败、明确重试。实际可信click capture performance.now起点，正确当前业务DOM、失败原LS/全部输入核对、实际可见图片按viewport及全部overflow祖先裁剪求交后decode、字体、有限动画、两帧及最终读取为终点；准备导航/填写/测试观察时间不计。Quota到重试同context连续，真实混合勾选，接收方式和全部行值/勾选保持；每样本含图像eligible/excluded几何与阶段，错误保真实elapsed或明确null/invalid。10秒采集期限只会失败，绝不豁免1000ms。

新增25原件位于 `production-action-performance/command-read-dependency-final-local-v5/`，最大284.80000001192093ms，116唯一资源集；source8832ce858d86a06acd19bb00b3002f35629c8e20c168947b84376d60689c693a。prepared工具独立审查见production-action-performance-tool-v5-review.json；5项预检独立在-v5-preflight，不计615。v4中止原件、两次图像诊断与v4-preflight-root-cause.json均保留。旧正式和旧候选所有有效慢值、错误和失败审查维持原身份；新结果不将其重标无效。

身份核验是每个唯一静态路径首次实际200正文SHA，后续200/304记录状态及关联；不宣称重复请求或每context缓存正文都逐一hash。独立前后入口和全量本地冻结另核；正式阶段还须完整SHA/run和885raw元数据、实际解压正文核对。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/craft-list-source-boundary.test.ts`：通过
- `CUTTING_E2E_PORT=43233 CUTTING_E2E_USE_PREVIEW=false PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/wool-management-fact-workflow.spec.ts --workers=1 --reporter=line --output=output/playwright/seam-embroidery-unification/command-read-dependency-final-local/wool-e2e-artifacts`：通过
- `python3 output/playwright/seam-embroidery-unification/run-read-dependency-functional.py`：通过
- `WOOL_BOUND_PERF_IDLE=1 python3 -u output/playwright/seam-embroidery-unification/run-command-cli-performance.py http://127.0.0.1:43183 command-read-dependency-final-local`：通过
- `WOOL_PERF_URL=http://127.0.0.1:43183 WOOL_PERF_LABEL=command-read-dependency-final-local WOOL_PERF_IDLE=1 WOOL_DETAIL_LIST_EVIDENCE_DIR=output/playwright/seam-embroidery-unification/command-read-dependency-final-local node output/verification/wool-storage/run-command-load-node-performance.mjs --run`：通过
- `python3 output/playwright/seam-embroidery-unification/combine-entry-performance.py command-read-dependency-final-local-performance command-read-dependency-final-local`：通过
- `python3 -u output/playwright/seam-embroidery-unification/run-production-action-performance.py command-read-dependency-final-local-v5`：通过
- `python3 output/playwright/seam-embroidery-unification/verify-local-service.py command-read-dependency-final-local after`：通过
- `python3 output/playwright/seam-embroidery-unification/verify-freeze.py`：通过
- `python3 output/playwright/seam-embroidery-unification/scan-entry-cleanliness-read-dependency.py`：通过

配置内build含1121单元和工程检查；专项原先失败及夹具补全前日志保持，补齐原回滚会恢复的五个可选字段后11项通过，未借该测试夹具修正改产品。当前精确十路径技术收据将使用 `read-dependency-receipt-and-release.py --phase receipt --run`，目标 `read-dependency-receipt-verified.json`，必须报告封口后真实执行，当前未声称已verified。该工具如强制重复完整build，据实际日志记录，不改门禁跳过。

首轮技术收据的专项、工程检查与完整1121构建通过，两项治理因本节漏写工具约定的“证据”字段标签失败；实际页面证据原文已存在。补齐标签后的轻量检查另指出缺少根规范的显式引用，现已在报告头补齐。本次只完善这两项文档格式与失败记录，不改变页面证据内容；失败收据与日志保存在`read-dependency-receipt-current/`，该次不计通过。最终报告重新字节封口后真实重跑全部路由检查。

### 例外

- 无性能门槛例外，无测试数据库写入。生产pending浏览器暂停的具体不可达理由、实际源函数替代验证及原始blocked状态已列明，最终两轮已独立核定当前适用性。
- 不宣称初始演示编辑刷新持久化、整生产模块存储迁移、每次重复HTTP正文验证或真实工厂接受；本地T4与正式T5分阶段独立关闭。
