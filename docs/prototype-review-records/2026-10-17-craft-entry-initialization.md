# 工艺加工单入口初始化与交互修复

依据：`AGENTS.md` TRACE-01、SCOPE-02、STORE-02、UI-01、PERF-01、EVIDENCE-01、RELEASE-01。继承已实施的缝边绣统一与16类列表需求；本记录覆盖本轮本地T4产品审查；真实技术门禁由固定报告后的收据关闭，正式T5在新SHA部署后另附原始验收。

## 基本信息

- 日期：2026-10-17
- 验证人：Codex 主代理，独立审查另附。
- 任务 / 需求编号：SEAM-14/16，INIT-01～11；类别：T4+T5。
- 分支：codex/seam-embroidery-unification；基准：a01fbe83bd54e840efb3f7c4efb01034457aff76。
- 环境：此工作树的Vite生产预览 http://127.0.0.1:43183；139输入/1198产物，清单SHA256 `f0285071aeb51b7bc2eb2ce74d735da00a8d99960d64c2995538ac7385aeabfc`。提交前收据绑定完整18路径；提交只改变身份时另以对象字节比对关联最终SHA，不修改旧证据版本。

## 范围、需求、设计与实施计划

正式基准 a01fbe83 / Actions39018781830 部署成功且880原始资源清单相符，但5个有效冷样本1826.6～2032ms全部失败。138资源/1.41MB编码体积，图仅22KB且802ms完成；资源1281.5ms收完后仍有467ms近连续长任务。保留这些正式慢值及此前各版本本地575通过记录，不降门槛。

按依赖实施：确认限定入口与既有事实读取 → 为主入口/路由/物料识别建立最小契约 → 复用已有空覆盖读取分支、原渲染器与PCS已准备快照 → 精确预取与既有高压缩配置 → 原生存量/异常恢复核查 → 逐类全量及性能 → 两轮对抗审查与技术收据 → 合并main/推送/正式部署及线上另验。

限定16类工艺列表/详情、毛织阶段列表/详情/待接收及对应PDA读取入口不启动无关采购初始化；后续采购保留原准备。已保存分配产物仍等待原完整恢复，无覆盖采用原静态事实；生产来源、部位票、毛织及完整PCS准备不减少。16类标准路由直接调用同一渲染器；未知/相邻/打印入口仍走原规则。物料识别仅投影同一PCS准备记录的编号与图片，复用原图片规范化，不引入新事实源、种子回退或写入。

真实缺附件检查暴露了消费阶段错误落入通用失败页的问题：仅当限定页面已消费物料owner的同一失败原因时，复用原真实原因与“重新读取”入口；不扩大其他owner语义。原生覆盖、删除标记、附件SHA、失败阻断及补回后按钮重读逐项验证。有冻结BOM图片时沿原规则优先；无冻结图的本次恢复目标使用已恢复SKU附件Blob，实际DOM图片与原生Blob分别核对SHA，不将二者混报。既有跨标签来源快照不保证仅相邻渲染就自动重读；初次直达、刷新和明确重读按原路径恢复。

旧工艺列表页签只按当前菜单有效性清理，沿用原query/hash标准化，不保留旧名称识别表；动态详情、其他模块、业务记录及附件不受该偏好清理影响。

第一轮本地性能另发现首个1366每页20条1396.8ms有效慢值。两次诊断各加载250个事件依赖，均有541ms长任务；追加限定页面直接顺序调用原列表和详情处理器，保留毛织动作、最终收货、异步保存、工厂校验和确认。未知路由继续原处理集合。其余界面字段、数量、状态、权限、确认、存储及真实图片不改。

不引入框架、后端、维护入口或通用状态层；不改部署配置、不删用户业务资料。无编码历史可选工艺成本的授权清理继承父任务已确认规则，本轮只回归其成功、失败保留源、幂等和总额扣减。

## 原子矩阵

矩阵证据位于 `output/playwright/seam-embroidery-unification/` 及 `output/verification/wool-storage/performance/entry-event-local/（原575）及 entry-event-recovery-v3/（新增15）`；自动验证和页面/性能职责分别列明。下列状态只代表当前本地T4技术核验。

| 编号 | 来源 | 原子要求 | 实际文件/符号（工作包） | 自动化/页面/持久化/性能证据 | 状态 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- |
| INIT-01 | PERF-01/正式诊断 | 限定工艺读取入口不启动无关采购初始化，后续采购仍正常准备 | src/main.ts；src/main-infrastructure/craft-read-entry.ts | 实际主入口/全部定义及负例契约；三种effects分支与全量列表 | 已验证 | Codex / f0285071aeb5 |
| INIT-02 | STORE-02/PERF-01 | 无持久分配产物时读取原静态事实，不加载整套保存集合 | src/main.ts hydrateProductionSourceEffectsForEntry | 空覆盖原生分支、数量/状态/关系、首次实际资源 | 已验证 | Codex / f0285071aeb5 |
| INIT-03 | STORE-02 | 已保存分配产物完整恢复后呈现，异常阻断且保留源，修复后可重读 | src/main.ts；原production-context-actions | entry-effects-event-final.json 3/3；原生事务读回 | 已验证 | Codex / f0285071aeb5 |
| INIT-04 | PERF-01 | 仅预取实际必要读取模块，不执行额外业务初始化 | vite.config.ts | craft-route-preload契约；实际加载资源绑定 | 已验证 | Codex / f0285071aeb5 |
| INIT-05 | 用户逐项/全量要求 | 本地16类/158详情/动作及适用性能全部通过；正式另验 | 当前冻结构建及原全部页面 | entry-event-final全量；590/118性能；正式不由本地替代 | 已验证 | Codex / f0285071aeb5 |
| INIT-06 | STORE-02/IMAGE-01 | 物料识别从同一已准备PCS记录读取，保存覆盖/删除/附件语义保留 | src/data/pcs-material-sku-identity.ts；src/pages/process-factory/special-craft/order-display.ts | 49发布SKU等价及覆盖/缓存契约；原生18项 | 已验证 | Codex / f0285071aeb5 |
| INIT-07 | 用户全量/路由 | 16类标准地址复用原渲染器与工厂校验，未知/相邻地址保留原注册表 | src/router/routes.ts | canonical列表/详情与负例契约；48列表/158详情/跨厂拒绝 | 已验证 | Codex / f0285071aeb5 |
| INIT-08 | PERF-01/版本 | 关键静态预压缩使用既有高压缩配置，原始字节严格一致 | vite.config.ts compressedPreviewAssets | 生产构建；实际响应原始SHA与冻结清单一致 | 已验证 | Codex / f0285071aeb5 |
| INIT-09 | STORE-02/真实缺附件失败 | 限定工艺页消费失败物料记录时展示真实原因与原重读入口 | src/main.ts renderCurrentPageContent | 最小失败契约；18项原生恢复；15恢复性能 | 已验证 | Codex / f0285071aeb5 |
| INIT-10 | 用户全系统退役要求 | 删除已无当前菜单的单工艺列表页签偏好，保留有效/动态/其他页签和业务记录 | src/state/store.ts pruneRemovedPfosTabs | 实际getStoredTabs红→绿；entry-stored-tabs-event-final.json 4/4、零业务写 | 已验证 | Codex / f0285071aeb5 |
| INIT-11 | PERF-01/首个20条慢值 | 限定页面事件沿原顺序调用现有列表/详情处理器，未知地址保留原事件集合 | src/main.ts dispatchPageEvent | 实际函数红5/6→绿6/6；全量行为/动作保存与590性能 | 已验证 | Codex / f0285071aeb5 |

正式发布、完整SHA/run、线上16类页面/158详情及正式590样本在本地T4关闭时尚待新版本完成，不能用本表替代。需求未减少；原18类在三类正式合并后为16类。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：共享主入口、路由、静态依赖、物料识别读取、异常恢复及页签偏好影响限定工艺页面，按T4核直接上下游，T5另叠加。

## 自查结论

| 检查项 | 结论 | 证据/边界 |
| --- | --- | --- |
| 需求与范围 | 通过 | INIT-01～11正反向核，完整18路径；继承父记录及原16类清单 |
| 工程与契约 | 通过 | 完整构建，1102单元通过；最小失败原日志保留 |
| 列表与详情 | 通过 | 16×3=48列表，158详情/176真实图；六组交互/消费方/退役入口/成本路径 |
| 存量与恢复 | 通过 | effects3、物料18、页签4均实际原生读回，资源身份通过；业务普通读取无改写 |
| 性能 | 通过 | 590样本/118家族，每家族5样本，最大705.1ms，全部≤1000ms |
| 两轮审查 | 通过 | init-review-round-1-final.json / init-review-round-2-final.json，分别正向追踪与反向反证，均无开放实质问题 |

## 最终结论

结论：通过

本地产品的功能、存量恢复、性能及两轮实质审查通过。技术门禁在本报告固定后真实执行，结果与18路径指纹以 entry-event-receipt-verified.json 为准，不预填机器状态；完整交付还须正式T5新SHA部署和独立线上验收。技术核验不代填用户对真实业务的接受。

## 变更覆盖与验证

### 受管文件

- `src/main.ts`
- `src/main-infrastructure/craft-read-entry.ts`
- `src/data/pcs-material-sku-identity.ts`
- `src/pages/process-factory/special-craft/order-display.ts`
- `src/router/routes.ts`
- `src/state/store.ts`
- `vite.config.ts`

### 页面证据

- 版本：上述冻结清单；源/产物、实际预览PID/cwd与入口SHA由 `entry-event-final/local-service-before.json`、`local-service-after.json` 独立核对。before实际是在早期列表阶段采集，清单本身在列表前冻结；不将它冒称第一页面前的请求观测。
- 证据：`entry-event-final/online-01.json`～`online-16.json`、`all-details.json`、六分支JSON与对应三视口截图。列表/详情原始JSON记录资源URL，未内嵌逐批实际正文绑定；独立版本回执和严格资源组另列，不宣称每请求体已验证。
- 原生：`entry-effects-event-final.json` 3/3、`entry-idb-identity-event-final.json` 18/18、`entry-stored-tabs-event-final.json` 4/4，三个实际响应集合均严格绑定当前冻结清单。
- 图片：全部158详情/176图的实际解码/身份/无溢出检查；继承父记录的原图、缩略图、高清同源比例和来源SHA。管理1366×768、1280×720及执行1024×768，PDA及毛织保存按独立家族验证。

### 性能结论

- 结论：通过
- 依据：`entry-event-performance/combined-summary.json`，590/118，最大705.1ms，全部有效样本≤1000ms；列表415/83，毛织45/9、详情100/20、成本15/3、缺附件恢复15/3。导航从零点、动作从真实事件起，含必要读取/实际图片解码/字体/动画/持久回读和绘制。
- 资源绑定：列表原采集器不改，schema2对唯一静态路径的实际首个200响应正文SHA严格核对；重复200/304只有引用，304明确无正文，不声称每请求或每context缓存字节已验证。首个失败、未知路径、异常状态、哈希/标识冲突阻断。其余175样本同样绑定冻结入口、实际资源与存量结果；没有以独立GET填补采集缺口。
- 历史失败保留：a01正式5冷慢样本；`entry-recovery-performance/performance-extra.json` 的首个20条1396.8ms；原18项缺附件12过/6败及修复后版本；采集器纠正前原日志均保留。此前没有严格绑定的观察和额外1MiB/s/25ms网络诊断不作验收通过。
- 未采用尝试：PCS集合缩减的3个网络诊断1317/1295.2/1275.3ms未证明足够收益，已恢复完整准备；不改变事实覆盖换性能。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/craft-entry-initialization.test.ts`：通过
- `CUTTING_E2E_PORT=43233 PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/wool-management-fact-workflow.spec.ts --workers=1 --reporter=line`：通过
- `git diff --check`：通过
- `python3 output/playwright/seam-embroidery-unification/verify-freeze.py`：通过

完整构建1102单元通过，原始日志为 entry-event-final-build.log 及最终收据日志。17毛织E2E通过43.6s，见 entry-event-wool-e2e.log。页签、主入口/路由/预取/49SKU身份、全量页面与590性能的实际命令和结果由原日志、矩阵和最终收据分别绑定。

技术收据在本报告固定后按完整18路径真实执行，机器状态和退出值以 entry-event-receipt-verified.json 为准。首次收据的报告字段格式失败以及当时完整doc/日志/收据原件保存在 entry-event-first-receipt-failed；产品运行输入不变。正式T5仍须新SHA完成后单独核验，未在本地自查表冒填通过。

### 例外

- 无性能例外；正式站验收另列。隔离原型验证不代表真实工厂业务已发生或设备/人员已接受。

新增15项工具修正记录：v1错误地假定本次目标有冻结BOM图，另将Blob当作dist路径；v2修正实际Blob验证后，误用Browser Fetch Response.status方法导致证明字段生成失败。两个原始失败结果/采集器均保留，无效样本不改成通过。v3仅将该证明字段改为属性并更正版本身份；新15有效/0无效，最大428.3ms，5组实际DOM图片字节SHA/大小/类型在计时终点前匹配原生附件。未重标原575。
