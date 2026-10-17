# 工艺详情只读依赖修复

依据根文件 `AGENTS.md` 的 SCOPE-02、TRACE-01、STORE-01～STORE-05、LIST-01、EVIDENCE-01、PERF-01 和 RELEASE-01 记录本阶段；本报告不新增治理规则。

## 基本信息与范围

- 日期：2026-10-17；分支：`codex/seam-embroidery-unification`；基准：`d9a3efa2c93e3bfc7976699da347f23274665f07`。
- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：详情共享读取依赖及异步渲染时序，T4；用户授权正式发布叠加 T5。
- 当前阶段：新e300候选实现、完整构建及全量功能通过；原615性能已离线闭环，R1发现的完整来源条件分支已补充20项，635项全部在1000ms内；两轮本地实质审查已通过，报告定稿字节待第二轮最终封口；技术收据、新发布及正式复核另验。
- 验证人：Codex 主代理；代理技术验证不代替真实工厂或用户接受。

继承 SEAM、INIT、COLD、LOAD 的有效要求和最终16类清单。三种退役工艺仅有唯一缝边绣身份；无多工厂切换；历史实际工厂追溯、授权无编码可选工艺成本清理、数量、状态、图片、Web/PDA/打印和存量保护要求不变。父报告及旧失败证据保留原版本。

正式 d9a3efa2 / Actions 39039211148 的版本、885个原始产物、16类全量功能均已通过。但原始详情100项中16项有效耗时超过1000ms，最大1544.1ms；575项已采集、40项按失败停止尚未运行，不称615项通过。四组失败均为两种详情在1366与1024尺寸的首次导航。原始失败不会被诊断或后续重测替换。

一次独立诊断观察到详情及依赖已在导航早期预加载；额外完整执行领域和首屏关系计算仍在关键路径。诊断966ms仅是诊断，不能降低原16项失败等级。新阶段先用静态闭包失败契约明确依赖边界，再用实际相同业务读取与完整运行验证因果收益。

## 实施计划

1. 建立详情不静态加载完整印花/染色执行领域的失败契约，保存原始失败日志。
2. 将关联关系的计算及纯HTML渲染与完整执行读取分离；旧同步接口保持语义与单一读取scope。只机械提取共享水溶来源投影，印花/染色原投影及恢复选择原样保留。只在实际必须读取完整owner时加载它，已加载未保存记录、持久源、恢复需求和读取错误必须保真。
3. 详情准备入口用严格同步HTML回调，由原core在实际来源读取点传入原routeCodes；仅私有sentinel触发一次完整owner加载，之后重新读取任务/工厂约束/PO hint/关系并生成HTML，不跨await返回窄reader。来源读取前有既有cut/毛织内存派生，第二次读取须验证稳定身份与revision，不描述成纯计算重试。真实探测、派生、回调或导入错误原样保留，不用sentinel重试。路由与毛织实收内部重绘均验证当前URL/对象/DOM，加载失败不得伪装空关系或写覆盖。
4. 核依赖产物、实际读取反例、适用全量构建/毛织相邻流程、16类与图片、原生迁移/故障；新冻结版本完整运行原590加生产25共615项，原时钟、家族、有效值和1000ms门槛不变。R1覆盖反证后补充联合69印花+22染色合法保存源，冷首入/已加载owner后SPA×1366/1024各5，共20项；与原615独立保留，总635/127族。
5. 最终完整差异执行两轮实质审查，通过后技术收据、精确提交、FF main、GitHub推送与正式Caddy部署。再核新SHA/run/全部产物、16类全量页面、原615及补充20项，完成最后两轮正式对抗审查，逐条审核后才关闭目标。

## 原子需求矩阵

| 编号 | 来源 | 原子要求 / 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / 性能证据或不适用理由 | 状态 | 证据位置 | 确认人 / 版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DETAIL-01 | 正式失败 | 详情静态依赖不带完整印花、染色执行owner | `task-detail.ts`、`process-order-task-detail-read.ts`、`process-order-task-link-core.ts` | 静态闭包失败后通过；实际构建图 | 冷导航另验，不以体积代替时延 | 已验证 | e300：1152构建、实际图、v3全量功能及原生/毛织/新source3专项，详下 | root技术验证 / e300冻结 |
| DETAIL-02 | STORE / 原事实 | 已加载未保存、已保存、需恢复及错误状态均读原事实 | 原PRINT/DYE owner、共享存储键、`design-revision-pcs-storage.ts` 的纯has查询与detail reader | 正常/边界/失败反例 | 不重建或复制独立事实源 | 已验证 | e300：1152构建、实际图、v3全量功能及原生/毛织/新source3专项，详下 | root技术验证 / e300冻结 |
| DETAIL-03 | 原公开接口 | runtime、PO hint、设计改款、空路线及读取scope保持 | `process-order-task-links.ts` 同步facade、core的按reader隔离scope | 原语义差异与缓存隔离契约 | 其他消费者不强制迁移 | 已验证 | e300：1152构建、实际图、v3全量功能及原生/毛织/新source3专项，详下 | root技术验证 / e300冻结 |
| DETAIL-04 | 时序 | 关联准备前不假空；当前对象变化不发布旧结果 | `task-detail.ts` 严格同步HTML回调及实收后URL/原content节点保护、异步薄wrapper | 等待、失效、重复、拒绝反例 | 适用真实UI流程 | 已验证 | e300：1152构建、实际图、v3全量功能及原生/毛织/新source3专项，详下 | root技术验证 / e300冻结 |
| DETAIL-05 | 用户继承 | 16类布局、链接、数量、唯一厂及图片不变 | `task-detail.ts`、`process-order-task-relations-view.ts`、原UI facade | 机械比较与全量功能 | 1366/1280/1024及176图 | 已验证 | e300：1152构建、实际图、v3全量功能及原生/毛织/新source3专项，详下 | root技术验证 / e300冻结 |
| DETAIL-06 | STORE | 加载/读取失败可恢复、不覆盖源、不假成功 | detail reader私有sentinel边界、临时preload错误保留及实收处理器 | 原源保留、显式重试、真实owner失败 | 写入仅独立浏览器原型 | 已验证 | e300：1152构建、实际图、v3全量功能及原生/毛织/新source3专项，详下 | root技术验证 / e300冻结 |
| DETAIL-07 | 用户清洁/全量 | 缝边绣唯一身份、无工厂Tab、成本与毛织存量正确 | 继承SEAM/INIT/LOAD路径 | 全量检查/原生/毛织相邻 | 最终16类逐项和全量 | 已验证 | e300：1152构建、实际图、v3全量功能及原生/毛织/新source3专项，详下 | root技术验证 / e300冻结 |
| DETAIL-08 | PERF | 新冻结原615加合法完整来源20项均有效，每族5次且每值≤1000ms | 原590、生产25及完整来源cold/hot20 | 完整构建、原协议逐份回放、联合91来源真实恢复 | 原失败保留；总635/127族，前后版本无漂移 | 已验证 | 原615及完整来源20分别通过；635/127族，max540.3ms，原协议实际回放，详下 | root技术验证 / e300冻结 |
| DETAIL-09 | 用户审查 | 最终完整产品差异两轮实质对抗审查均通过 | 全部负责路径及矩阵 | 两轮独立结果、主代理整合 | 设计旁审不计最终审查 | 已验证 | R1最终d5291bf；R2实质分析ec220b86，均无未关闭阻断；定稿字节另由最终R2文件封口 | detail_final_review_1 / detail_final_review_2；e300 |
| DETAIL-10 | 用户T5 | 新main/GitHub/Actions/正式版本、全量功能、原615与补20及最后两轮均通过 | 精确发布范围及正式证据 | 收据/五方SHA/正式资源/协议 | 旧d9失败不作新版本通过证据 | 待实施 | 待绑定 | 待新正式版本 |

## 当前证据

- 证据：`output/playwright/seam-embroidery-unification/formal-d9a3efa2/phase-status-after-detail-failure.json` 及对应原始详情、CLI、Node报告保存正式失败和失败停止范围。
- 证据：`output/playwright/seam-embroidery-unification/cold-d9a3-diagnostic/first-dalan-1366-once/result.json` 与原始trace仅作诊断。
- 冻结与最终实现、验证、审查、收据和发布结果将在实际完成后绑定，不预填通过。

## 实现与当前契约证据

- `process-order-task-links.ts` 保留原同步API，计算与唯一scope/cache迁至core；按来源reader identity再按原routeCodes区分缓存，最外层同步finally清理。公开纯builder及类型直接重导出。
- 窄来源只允许原core给出的显式无PRINT/DYE路线、两个真实owner均未注册且相同有效存储均为null的情况；只读共享原水溶投影。任何已加载事实、持久源、未限定路线或PRINT/DYE均只回退一次到原完整reader。真实探测/派生/回调异常原样抛出。
- 原印花source-reference与染色list fallback保持原样；原两owner只迁出各自执行键常量。新键定义不改变存储身份。水溶投影表达式机械原样，共享两个调用方。
- 详情在严格同步callback中重读当前task/工厂约束/PO hint/关系并生成原HTML；完整来源导入后重新执行同一callback，不跨await保存窄reader或旧关系视图。毛织实收保存后等待实际HTML，应用前核捕获URL和原content节点，保存失败不发布旧页面错误。
- 证据：`cold-d9a3-diagnostic/detail-boundary-red.log` 是真实PRINT静态闭包断言失败；首次shell在测试结束后误用zsh只读变量status，后续命令改用task_exit，测试原始失败日志未覆盖。
- 证据：`detail-boundary-first-green.log` 12/12、`detail-original-relations-contract.log` 3/3含全部136逐项比较、`detail-receipt-render-contract.log` 4/4、`detail-read-boundary-test-first.log` 15/15。15项运行实际源码提取并替换明确依赖，不冒称真实浏览器导入失败或真实存量恢复证据。
- 证据：`mechanical-extraction-proof.json` 34项记录，除有意变化的reader缓存项单列非比较外，其余原函数体、HTML、水溶表达式、详情主体及owner仅迁键比较全部通过。公开签名、缓存及异步时序仍须各自契约，不由机械比较代替。
- 证据：`detail-engineering-first.log` 渐进工程检查通过，范围错误0；独立全量TypeScript仍有原19项既有错误，不称全量tsc通过。

## 真实模块、检查器与边界补充

- 证据：独立Node真实模块集成在 `detail-read-native-integration-first.log` 与 `detail-read-native-integration-boundary-identities.log` 分别完成。原owner有69条印花、22条染色未存来源，真实owner hooks为true、生成registrars仍为false，原无初始化reader与完整来源记录一致。合法打揽任务fresh窄读取仅一次callback、未加载两owner，随后完整来源View与1510字符HTML完全一致。
- 证据：真实缺生产单hint的空路线边界触发source前派生；新增118个来源task，初始化28个毛织订单，并读取46个裁片、158工艺单、175入库及38接收投影。sentinel前后完整快照相等，再完整读取后仍相等，ID及revision稳定。当前无“已存在且零路线的生产单”夹具，因此明确使用未知PO hint；新runtime毛织订单新增数0，不冒称覆盖该不存在的生成分支。真实已有PO零路线的routeCodes语义另由实际core源码契约验证。
- 集成首跑在要求不存在的现实夹具处失败，保留 `detail-read-native-integration-first.log`；随后实际稳定快照已过但测试误用任务引用代替入库记录ID，保留 `detail-read-native-integration-boundary.log`；仅修正测试适用边界和真实ID断言后重跑受影响项通过。未修改产品来迁就夹具，不混同正式性能样本。
- 新增负责路径 `scripts/check-process-order-task-relations.ts`，总任务差异19路径。附加专项检查发现其原毛织统一旧地址、旧投入产出及旧字段断言落后于原产品阶段模型。独立git archive的d9原src/scripts/package/tsconfig快照复现首个同样失败，`detail-relations-d9-baseline.json` 绑定版本、归档和原始日志。未改毛织产品；原stage页字节同d9的证明见 `detail-checker-contract-adjustment.json`。只更新检查器现行阶段、sourceTaskId/demoSource和本轮新详情reader的静态绑定；原关系数据断言保留。
- 一次尝试把详情整页导入该native Node checker因现有JSON无import attribute报错，原 `detail-relations-check-current-contract.log` 保留；已撤回该导入，不改产品JSON、package命令或构建配置。随后旧wool源码字段断言失败保留 `detail-relations-check-final.log`。最终 `detail-relations-check-stage-confirmed.log` 专项通过，核237条显式关系。
- `detail-full-stage-check.log` 只证明54项现行承载/删除/检查登记完整，不能代表54项实际业务全验；`detail-lace-chain-check.log` 正式花边链3条fixture关系通过，5张当前演示单保持未关联。
- 本段basename均位于 `output/playwright/seam-embroidery-unification/cold-d9a3-diagnostic/`。完整构建、冻结、页面及性能仍按后续实际产物记录。

## 新构建与实际依赖图

- 证据：`cold-d9a3-diagnostic/detail-read-full-build.log` 实际 `npm run build` exit0，1144/1144单元通过，Vite成功。冻结 `asset-version.json` SHA256 `0de9a2ae335609b30fd0f1981060757523631a1a2dd047c9b6bbcd3620a831dd`，162个源/测试/检查输入、1220产物（888 raw、332压缩），入口SHA256 `549339ddc0bad5fdc62c77dcead583e2bf5e6d90352d54f039732b68bdd0d312`。报告不进入运行冻结，最终字节另由收据绑定。
- 证据：`cold-d9a3-diagnostic/detail-candidate-bundle-modules.json` SHA256 `7d75ffd4e4e741a2e2c75d74581cdbf91f381e77a9ada5746e90005f1b66d968`；逐chunk证明 `detail-candidate-bundle-proof.json` SHA256 `9347aa89524de291fc534e4a129db0ef3c609e659199f5f9ef6536acc5caa54c`。Vite write:false的最终返回输出572 chunks全部逐字节等于冻结dist，所有162输入与1220产物前后未变。列表静态闭包58，详情61，无完整印花/染色owner；相对列表新增chunk共113993bytes，旧d9同分析529342bytes。这是实际依赖证据，不是耗时验收。
- 图采集首轮普通generateBundle钩子在Vite最后依赖改写前比对到不一致并停止，原脚本/日志保留。改为读取全部钩子结束后的最终RollupOutput，才完成上述逐字节证明；产品源码、构建配置和冻结产物未改。原失败没有重标通过。
- 功能首个 `command-detail-read-final-local` 在严格service-before预检发现旧PID51618已退出、43183无监听即停止，未启动浏览器或采样；原outcome/log保留。重新启动本工作树preview PID75145（session44752）、同端口43183后，采用新namespace `command-detail-read-final-local-v2`。实际before核服务cwd、入口正文及全部冻结输入/产物；最终after须完成全量功能和性能后再补，不预填。


## 首候选拒收与原始错误保留修复

- `0de9a2ae` 候选完整功能16类/48尺寸/158详情/176图、毛织E2E17项及两项可达生产UI通过，分别保存在 `command-detail-read-final-local-v2/` 与 `read-dependency-production-actions/command-detail-read-final-local-v2/`；后者原全局passed=false、coverageComplete=false及7个浏览器待测阻塞如实保留。未执行该候选615项性能。
- 新增真实full-owner浏览器三场景时，等待后完成、等待中离开再返回通过；第三场景仅中止一次实际owner GET，真实Vite全局处理preventDefault后import可能fulfilled undefined，旧详情解构又抛TypeError并覆盖原始动态导入错误。原collector严格捕获，因此该候选拒收。原失败 `detail-read-source-browser/detail-read-local-0de9a2ae/result.json` SHA256 `25c0779c80d9bd32f02bec6c23bbcfdc40813886d6cc4c1668926ce91a1dfd55` 与 driver日志、全部上下文关闭结果保留。归档 `candidate-d9a3efa2-0de9a2ae-archive/` 保存全部162输入与1220产物；完整性通过不代表产品接受。
- 仅在实际完整owner导入期间注册临时vite:preloadError监听；若namespace或目标函数缺失，优先抛原payload/detail/event，缺失事件才抛中文加载提示；原生reject与真实回调错误保持原身份，finally移除本次监听。未修改全局恢复处理、采集器白名单或失败判定。新8项实际helper源码契约覆盖payload身份、undefined/缺export、原生拒绝、回调失败、当前对象重读、显式重入及并发独立清理；旧源码RED与新GREEN均保留。
- `cold-d9a3-diagnostic/detail-read-error-preserved-full-build.log` 实际完整构建exit0，1152/1152单元通过、Vite成功。新冻结 `asset-version.json` SHA256 `e3005b4b8c67cb859080e3a5a38a57163c7b1d18c6e3354e5695174ace639774`，162输入/1220产物，入口SHA256 `53d9b03c8280d3564fa67799a87d8913cceb29ecd1e793149077c5476138f692`。此时新浏览器、615性能及最终审查仍待实际执行，不复用0de的通过结论。


## e300候选专项复核

- 新实际图 `cold-d9a3-diagnostic/detail-error-preserved-bundle-modules.json` SHA256 `682963c76aa23b5f17b501ca96708eab914beead7b9a9602e325819f1a1ef6c9`；proof SHA256 `484ddeec94bace5dad7fb3e451e1402549957b1fc011b5ec6df1ae9997d7df25`。572chunks与全部冻结字节吻合，无完整PRINT/DYE静态依赖。
- 原始f3ba736d collector及ba31b498 prepare未改，`detail-read-source-browser/detail-read-local-e3005b4b/result.json` SHA256 `bb71c7ce89bb278a1a38d7ee8d59c70c688f5b0d9557b3f8607cdc8df8a1b4c8`：三场景全部通过、最终关系HTML一致、资源身份正确、无业务写入，三上下文及主浏览器均实际关闭。一次真实owner请求失败仍如实保留在其负向场景；没有二次TypeError，也没有扩大console白名单。正式环境仍须在新发布后另验。
- `cold-d9a3-diagnostic/detail-error-preserved-tsc-comparison.json` 确认独立tsc原19项错误与d9归档基准日志逐字节一致，新错误0；不能称全量tsc通过。完整工程构建仍为1152/1152通过。
- `command-detail-read-final-local-v3/wool-e2e-dev.log` 独立43233开发服务毛织17/17通过（46.0s）；与43183冻结生产预览及最终性能证据分开。
- `command-detail-read-final-local-v3/cleanliness-final.json` 当前7131受版本管理或任务新路径、6009文本源码、593文本产物，无退役名称/英文别名/路径命中。主代理实际查看全部16类1366原截图拼图及缝边绣/特种车缝1024原截图，布局、单厂维度与图片可见；记录 `root-visual-review.json`，不替代48尺寸功能或离屏表格检查。


## e300最终逐项功能清单

本地冻结生产预览43183，`command-detail-read-final-local-v3/functional-driver-outcome.json` 11阶段全部exit0、主浏览器实际关闭。逐类列表在1366×768、1280×720、1024×768通过；1366逐页遍历完整身份，其他两尺寸验证布局/图片与适用操作，不冒称三次全遍历。158详情逐项检查；以下数量仅为固定演示验收，不代表用户实时资料。

| 类型 | 列表记录 | 详情逐项 | 结果 |
| --- | --- | --- | --- |
| 打揽加工单 | 9 | 9 | 已验证 |
| 打条加工单 | 9 | 9 | 已验证 |
| 烫画加工单 | 9 | 9 | 已验证 |
| 直喷加工单 | 9 | 9 | 已验证 |
| 布包扣加工单 | 9 | 9 | 已验证 |
| 绣花加工单 | 18 | 18 | 已验证 |
| 压褶加工单 | 9 | 9 | 已验证 |
| 缝边绣加工单 | 22 | 22 | 已验证 |
| 盘扣加工单 | 1 | 1 | 已验证 |
| 花朵加工单 | 9 | 9 | 已验证 |
| 打褶加工单 | 9 | 9 | 已验证 |
| 烫钻加工单 | 9 | 9 | 已验证 |
| 模板工序加工单 | 9 | 9 | 已验证 |
| 激光开袋加工单 | 9 | 9 | 已验证 |
| 特种车缝（花样机）加工单 | 9 | 9 | 已验证 |
| 橡筋定长切割加工单 | 9 | 9 | 已验证 |

原生身份18场景、历史Tab4、普通读取副作用3、原命令加载保护3及六组业务分支均通过；生产入口2项可达UI也通过，7项静态前置导致不可达的pending场景保持原阻塞，不把它们算作浏览器通过。原函数时序契约与真实full-owner三场景分别补证。原615与合法完整来源补20分开完成，实际证据见下；不复用此前候选或旧正式版本的通过结论。


## R1覆盖反证与原615汇总修正

- 独立第一轮审查发现 `DETAIL-R1-01`：原615的普通详情只覆盖无已存PRINT/DYE源的窄reader；source3用空key及人为hold/abort验证错误恢复，明确不作性能样本。真实合法保存源时首次加载原完整owner、以及已有owner后SPA详情，是适用差异分支，不能据原615称其已测。此为验收覆盖缺口，并未预判代码错误或超时；发现时阻断最终通过，现已补充下面20项原始证据，待独立审查核定关闭。
- 实际新图证明PRINT/DYE/full-domain同一个完整owner chunk，但PRINT与DYE恢复投影不同。补充使用联合69条印花和22条染色的真实原结构、state/tasks/codec快照；先在另一独立原模块进程恢复，两现有updatedAt合法时间覆盖标记均读回、完整来源投影一致、原key未变、普通读取零持久写入。fixture是显式隔离验收资料，不是用户或测试站数据库；捕获及独立恢复证据位于 `detail-full-owner-performance/`。
- 补充计划为正常保存源冷首入与已有owner后真实列表可信点击详情，两种1366/1024尺寸，各5次，即4族20项；原时钟及图片、字体、动画、两帧终点复用原详情collector，原Node资源及固定close/5s协议不改。先校准，再正式补20；不人为hold/abort，不预热冷态，不把fixture准备时间伪装业务操作耗时。正式新发布后同样补20。原615与新20分别登记，总635/127族，不覆盖或重新分类原失败。
- 原615所有实际采集阶段含freeze/service after均exit0，615有效值全部≤1000ms。原新harness在末尾误用裸family Counter，遗漏CLI既有slug/viewport维度，合法不同家族被合并而停止；原stopped/outcome及脚本、日志均保留。纯离线补充 `command-detail-read-final-local-v3-performance-closure/closure.json` SHA256 `bffd9280570bdfce4d870c202ed7000aa4434428ea7afe72be9bbf15ad16b3e3` 对全部原始值、原复合家族、四份实际JSONL、122次固定间隔、118个Node上下文、原浏览器关闭与资源/冻结重新核验通过：615/123族、max419.2999999523163ms、slow/invalid/error=0。未启动浏览器或重采样，原停止状态没有改写；该closure明确overallPerformanceGatePassed=false、完整来源缺口仍开，不能替代补20或最终审查。


## 合法存量补20与当前本地性能

- `detail-full-owner-performance/joint-valid-execution-fixture.json` SHA256 `eb44157305d418976d80db43350567b2629c67a652ab4952c529e7ad09404960`；独立实际原owner恢复证明SHA256 `197af1813978cff1d21c11b56e4cbcbaf39e37c4c79d761f9eb0fe20710b02aa`。69印花与22染色两份原生记录以实际state/tasks/codec建立，仅原有updatedAt使用合法固定时间标记用于证明恢复；两原raw键在普通读取后逐字节不变。热入口原印花UI当前派生显示77行，与保存69条分开，未冒称77条被持久化。
- 正常冷首入和真实热点击校准各1项，`local-e300-calibration/driver-outcome.json` SHA256 `659f5265bafc6507bb5a2e8a6060c18a49f7b97ea8be3e6e99bcd7f85178fb56`，冷639.4ms/热63.2ms，通过但不计20或635。准备工具调试的错误选择器及超时日志按原件保留，均未作为性能样本；最终选择器来自实际可见菜单和行控件。
- `detail-full-owner-performance/local-e300-final/result.json` SHA256 `9171dc1409d34f42a7901b262955c11226e4d03d549eb52244de4f8e73e9ab9a`，driver SHA256 `22da0846eac57bf5467fbfb3cce4b53d50aec9b1cf83c0312cd618d5281410a6`，实际exit0。四族各5次：合法保存源冷首入1366最大540.2999999523163ms、1024最大522.1999999284744ms；已加载完整owner后真实同文档可信点击详情1366最大64.29999995231628ms、1024最大64.20000004768372ms。全部20有效，slow/invalid/error=0；原时钟源码、字体/图片/动画/两帧终点没有调整，不以平均值替代单值门槛。
- 完整1502字符关系HTML与原完整reader相同，原两份raw键初始及结束精确一致、无业务写入，真实当前身份和192像素商品图正确。冷态首个app导航从navigationStart=0开始，实际403592字节owner GET及其resource timing在结束前；热态由实际PRINT列表/菜单/打揽行点击进入，同文档且点击后不再请求owner。Node原资源helper逐唯一script/stylesheet/image实际响应正文与冻结比对；不冒称字体正文、每次重复响应或全部888资源均被下载。
- 20个实际context及最后browser均关闭，21次实际固定5000ms idle；校准单列2个context/1browser/3次idle。两份原始JSONL和verifier回放原件均保留，最终门禁再次独立回放。原615保留123族，新20单列4族，合计635/127族，每族5次，全体最大540.3ms。旧615 harness的聚合失败与其overall=false关闭记录保持原字节，不重写为总门禁通过。
- 本报告为新提交前T4阶段快照。DETAIL-10的main/GitHub/Actions、新正式SHA/run、全量线上页面、原615与补20及最后两轮，将在新提交部署后另建正式证据附录；当前本地通过不代表T5完成或真实工厂接受。

- 总门禁独立新记录 `output/playwright/seam-embroidery-unification/detail-local-635-closure.json` SHA256 `70b07c596362b18a0a4aa48d62930f942d389b2662720f2f60ea4d43c499312a` 已实际纯离线执行通过：原615绑定证据全部不变，补20与校准2分别重新执行原JSONL verifier，全部162输入/1220产物现字节无漂移。635/127、单族5次、最大540.3ms；未重采样、未覆盖原停止或旧范围记录。主代理静态复核发现新发布工具误读fixture事件不存在的matched字段；首版工具已归档，严格改用实际initialLengthsMatched并独立检查initialExactMatched，保留冷/热原时钟与owner时序、实际close/idle断言后才使用。产品、采集器与raw未改；工具准备不计任何一轮最终审查。

- R1继续发现工具契约反例 `DETAIL-R1-02`：原installCollector连续两次performance.now分别保存ms与completed，v2门禁额外等式可能误拒合法正式值。原100中已有7个ms小于completed-start的合法例子，原件保留；未发生产品失败或新超时。v2工具及其70b07闭环原件保留，v3只把等式改为原单调语义ms≤completed-start，原始ms及全部originalTimingResult逐字段镜像、有限非负、顺序、1000ms门槛不变，未重采样。新门禁SHA256 `ac6cee49fba44fba14a667ccfa77532df15a7889756fcc09cc1a31be41c9494e`；实际新纯离线 `detail-local-635-closure-v3.json` SHA256 `cdccf50f890f05a3b33c2497bd1cca6427ff62a7b4e5bd34e6be4ca300ffc4d4` 通过，重复核原raw、原verifier、162/1220冻结均未变，635/127族与max540.3ms相同。最终发布使用v3，v2记录仅保留其历史工具范围，不冒充当前完整门禁。


## 两轮本地实质审查与正式移交

- 第一轮最终 `output/playwright/seam-embroidery-unification/detail-read-review-round-1.json` SHA256 `d5291bf209dc0b4deffd92b696c41b3654e5b63c411c1bba03de1ddbc4ef095c` 实际通过；DETAIL-R1-01完整来源覆盖与DETAIL-R1-02离线工具时钟契约均已关闭，未关闭阻断0。报告中此前“待核定”文字描述该取证阶段，不覆盖本段最终本地结论。
- 第二轮独立实质分析 `detail-read-review-round-2-analysis.json` SHA256 `ec220b8651bf9b05373b52bc3f6ce91b5a8497a75cf2abe14de0cf094b0cf86a` 实际通过，新增发现0、阻断0。两轮均实际核全部19负责路径和SEAM17/INIT11/COLD15/LOAD10/DETAIL10共63需求行，按现行继承判定撤回实验及未来T5要求，不将旧正式失败重标通过。
- R2独立重计10份原始性能报告635/127，每族5、最大540.3ms；1467绑定字节、162输入/1220产物及888raw、572真实chunk哈希、58/61静态闭包和六份实际close/固定idle JSONL均一致；当前16类/48尺寸/158详情/176图片及原生/成本/Tab/来源/分支证据均按适用范围核查。主代理已逐项实读两轮分析、完整最终任务差异和关键原件并接受实质结论。
- 定稿字节由 `detail-read-review-round-2.json` 实际读取本报告与R1原件后绑定 `documentClosure.reportSha256`、`sealed`、`round1Sha256`；该封口是发布必需门禁，不以本段预填其哈希或状态。技术收据必须绑定完整19路径和本报告现字节，生成后才可执行精确暂存、FF main、GitHub直接main推送及五方完整SHA核对；当前本报告不冒称这些尚未发生。
- 本地冻结构建Node26.8.2；正式既有流水线为Ubuntu24.04/Node24、npm ci锁文件与npm run build。新提交须以实际新Actions成功和HTTPS deployment.json完整SHA/run、888raw逐路径哈希及适用真实响应证明环境产物一致，不以本地构建替代CI。
- 新正式证据附录将在新SHA发布后记录DETAIL-10及有效继承T5条目的关闭：16类三尺寸、全部详情/图片、适用操作/负向/持久回读、原615与补20、资源/版本前后及最后两轮正式审查。附录与新SHA绑定；本报告保留提交前T4阶段身份，不在提交后改字节制造部署循环。无真实工厂或用户接受结论。


## 基本信息

- 日期：2026-10-18
- 任务 / 需求编号：DETAIL-01～DETAIL-09，本地T4完整产品审查；DETAIL-10为新提交后正式T5移交
- 验证人：Codex主代理，detail_final_review_1，detail_final_review_2；技术验证

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：辅助及特种工艺详情从静态重型执行依赖拆为同步原事实读取与必要完整来源准备；影响首次进入的完整响应及异步实收重绘，原数量、状态、工厂、来源与保存事实保持既定业务契约。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 详情来源完整性 | 通过 | DETAIL-01～03；完整实际owner与窄分支、69/22真实源恢复和1502字符关系HTML相同，source3与合法存量20分开。 |
| 当前对象和异步页面时序 | 通过 | DETAIL-04；四项实际处理器源码契约及三项真实完整owner浏览器场景，URL、原DOM节点和回调重读均验证。 |
| 数量与明细 | 通过 | 136张普通加工单深比较原完整关系，158详情遍历；当前实现未新增数量公式或独立事实源。 |
| 状态与错误恢复 | 通过 | 私有sentinel只回退必要来源；真实读取和导入错误保留，单次真实请求失败与显式重载原始记录分列。 |
| 保存与存量保护 | 通过 | 原生18、历史Tab4、读取副作用3、成本2及毛织E2E17；业务原raw前后不变、原子事务及失败/重试按现有命令验证，本轮未新建存储。 |
| 管理和主管列表设备 | 通过 | 16类1366×768、1280×720、1024×768共48场景，宽表容器内滚动、主体无横向溢出，主代理与两轮审查实际查看截图。 |
| PDA直接关联 | 通过 | 继承原毛织原生/Web/PDA关联和当前E2E证据；本轮未改变PDA命令或事件事实，原入口保持原对象追溯。 |
| 打印直接关联 | 通过 | 继承原16类打印/预览与消费者证据；本轮纯关系HTML机械比较相同，未修改打印模板、生成命令或图片映射。 |
| 实物图片及大图交互 | 通过 | 158详情176处图片逐项、对应真实缩略图和高清原图；现有大图关闭/Esc/遮罩/失败态及图片标识在全量功能证据中核对。 |
| 命名清洁与固定工厂 | 通过 | 当前7131路径/6009文本及593文本产物零退役名称/别名；16类无工厂Tab，原实际工厂追溯与明确承接工厂约束保持。 |
| 完整性能与资源 | 通过 | 当前v3独立总闭环635/127，每族5，全部原值≤1000ms、最大540.3ms，1467绑定和全部162输入/1220产物相同；校准2不计数。 |
| 两轮本地实质反证 | 通过 | 原R1 d5291bf与R2 b0145b73两轮均通过，两个R1问题实际关闭；下面的文档登记补正还须两轮增量封口，不复用旧报告SHA。 |

## 最终结论

结论：通过

本结论限定上述本地T4产品对象和现有真实证据。技术收据、精确提交和新正式T5仍按其各自阶段门禁核定；不是正式部署、真实工厂或用户接受结论。

## 变更覆盖与验证

### 受管文件

- `docs/prototype-review-records/2026-10-17-craft-detail-read-dependency-repair.md`
- `scripts/check-process-order-task-relations.ts`
- `src/data/fcs/design-revision-pcs-storage.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/process-execution-storage-keys.ts`
- `src/data/fcs/process-order-task-detail-read.ts`
- `src/data/fcs/process-order-task-link-core.ts`
- `src/data/fcs/process-order-task-links.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/water-soluble-relation-sources.ts`
- `src/pages/process-factory/special-craft/task-detail.ts`
- `src/pages/process-factory/special-craft/work-order-detail.ts`
- `src/pages/process-order-task-relations-view.ts`
- `src/pages/process-order-task-relations.ts`
- `tests/unit/craft-detail-read-boundary.test.ts`
- `tests/unit/craft-detail-receipt-render.test.ts`
- `tests/unit/craft-list-source-boundary.test.ts`
- `tests/unit/special-craft-scoped-relations.test.ts`

### 页面证据

- 版本：分支codex/seam-embroidery-unification，基准HEAD d9a3efa2c93e3bfc7976699da347f23274665f07，运行工作树/Users/laoer/.codex/worktrees/dfd6/higoods，冻结e3005b4b8c67cb859080e3a5a38a57163c7b1d18c6e3354e5695174ace639774，生产预览http://127.0.0.1:43183；未提交19路径具体文件字节由独立审查、最终diff和后续技术收据分别绑定。
- 证据：output/playwright/seam-embroidery-unification/command-detail-read-final-local-v3/保留16类、48尺寸、158详情/176图片、操作及边界；detail-read-source-browser/detail-read-local-e3005b4b/保留三场景，detail-full-owner-performance/local-e300-final/保留合法存量冷/热20；各具体哈希、实际服务和截图见前述对应章节，不以截图代替保存和回读。

### 性能结论

- 结论：通过
- 依据：原615及合法完整来源补20按原独立家族/时钟保留，共635/127、每族5、原值全≤1000ms，最大540.2999999523163ms；detail-local-635-closure-v3.json SHA cdccf50f890f05a3b33c2497bd1cca6427ff62a7b4e5bd34e6be4ca300ffc4d4，原资源字节和六份实际close/固定idle日志均核对。旧d9正式16慢值、0de功能失败及工具聚合/等式问题原件全部保留，当前通过不替代新正式环境验收。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/craft-detail-read-boundary.test.ts`：通过
- `node --import tsx --test tests/unit/craft-detail-receipt-render.test.ts`：通过
- `python3 output/playwright/seam-embroidery-unification/close-detail-local-635-v3.py --gate-sha ac6cee49fba44fba14a667ccfa77532df15a7889756fcc09cc1a31be41c9494e`：通过
- `git diff --check`：通过

### 例外

- 无

## 技术收据首轮停止与文档登记补正

首轮真实技术收据在完整构建1152项通过后仍为implemented：两个治理入口均因本报告没有按当前模板单列受管文件而停止。原失败receipt `detail-read-receipt-verified.json`、审计目录 `detail-read-receipt-e300-v3/` 和当时报表56e72字节快照原样保留；没有修改失败收据为verified。本段补齐当前模板要求的基本信息、影响判定、原子自查、完整路径、页面/性能、实际命令与例外登记，所有产品、测试、采集器和原始证据未改。新技术收据必须使用不同-v2输出、新报告版本和两轮增量审查文件；旧审查原件保留历史身份，不改标新报告SHA。

补正文档后，两条治理命令以全部19精确路径实际执行均exit0：prototype覆盖13个受管运行文件，列表检查2个改动页面，排除路径0；实际记录 `detail-governance-report-v2-checks/outcome.json` SHA256 `faedefad6fd90d99dc77aeaac5f8d39a4fe4806a791a1b20f05760a8118a9d34`。首轮receipt中的完整build及1152项通过保持真实身份，构建后verify-freeze再次确认原162输入/1220产物未变；新receipt仍须以新报告实际运行验证，不将首份implemented伪装verified。
