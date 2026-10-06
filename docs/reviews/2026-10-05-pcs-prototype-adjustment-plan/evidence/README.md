# R1 当前验证证据（2026-10-06）

本目录保存原始测量，包括失败、诊断和重测。**当前总体状态：未完成。** 文件名中的 `final`、`release` 只是采集批次名称，不代表发布、验收通过或所有动作完成。

## 版本与环境

- 工作树：`/Users/laoer/Documents/higoods`，分支 `main`，基准 HEAD `88324f65506f47c678b17d1b51879f8fd7c2488a` 加本次未提交差异。代码和构建指纹见 `source-manifest.json`。
- 实际预览：`http://127.0.0.1:5178`；日常开发预览 `http://127.0.0.1:5173`，均为同一工作树。
- 浏览器：Codex 内置 Chromium 浏览器，通过受支持的浏览器工具操作。桌面主要验收尺寸为 1280×720；后续保存、物料编辑修复回归和标签为 1366×768。PDA 为 390×844。
- **截图文件名不是尺寸依据。** `routes-release.json`、`scale-release.json`、`wool-print-release.json` 及部分名称含 `1366` 的历史截图，采集时实际为 1280×720。以本说明、原始 viewport 和图片像素为准。
- 普通演示、负载与存储故障使用各自本机测试源。59743 为 31,000 条记录负载；58417 为 100 个下游成本；60097 为真实 IndexedDB 契约。60123–60127 的文件导入复测没有获得文件选择许可，不能列为通过。
- 冷启动通过禁用该验收页网络缓存并导航进入，未清空用户页面或整站存储。刷新与站内切换分别记录；不把重复热切换当作首次加载。

## 当前结果与范围

精确样本数量、最大值、是否低于 500ms、坏图数量见 [测量汇总](measurement-summary.json)。每个原始文件保留全部样本。总样本数量不代表每个业务动作均覆盖。

| 证据 | 已证明的范围 |
|---|---|
| `contracts-final.log` | 248/248 专项测试通过；具体需求按 `../current-requirement-evidence.json` 的精确测试名称关联，不按测试标题编号机械匹配 |
| `build-final.log` | 构建通过；工程检查 573/573。构建不等于全部业务或类型检查通过 |
| `typecheck-final.log` | 独立全项目类型检查失败，3 条错误；详见下文 |
| `typecheck-base-88324f6.log` | 从基准 HEAD 独立导出源码后可重现相同 3 条错误；保留原始日志，不将当前类型检查写成通过 |
| `material-new-use-before-fix.log` / `material-new-use-after-fix.log` | 新选用遗漏主档/投入/目标审核与启用校验的失败及修复；19 项相关检查通过。已有计划、采购草稿快照不被停用改写；浏览器动作仍待补验 |
| `bom-new-use-before-fix.log` / `bom-new-use-after-fix.log` | BOM新行未拦截停用物料、技术BOM既有停用行反而无法编辑的失败及修复；11项BOM检查通过，新增3项覆盖主档/SKU状态和保留原有使用。修复前第一个断言还包含错误文案差异，其余两项直接复现业务问题；不将文案差异单独计为业务缺陷 |
| `governance-final.log` / `diff-check-final.log` | 103个受管文件、2份审查记录的覆盖检查与补丁空白检查；只证明审查结构完整，不代表R1验收通过 |
| `bom-read-before-fix.log` | BOM 已保存的缺损结构被误当成空资料的最小失败；修正后包含在 248 项回归中，读取失败可重试且零写入 |
| `routes-after-reference-fix.json` | 配置引用修复后 30 条 PCS 路由，每条冷启动/刷新各 5 次，共 300 次，最大 229.7ms |
| `routes-release.json` | 30 条命名路由，各冷启动与刷新 5 次，共 300 次，最大 353ms |
| `material-routes-after-save-fix.json` | 已审核物料编辑修复后，12 条受影响路由重测 120 次，最大 174.60000002384186ms |
| `spa-release.json` | 123 次站内切换，最大 96.5999999642372ms；只证明记录中的切换 |
| `tabs-release.json` | 13 页 66 个 Tab，各 5 次，共 330 次，最大 95.70000004768372ms |
| `scale-release.json` | 4 个大数据列表，冷启动/刷新各 5 次；40 次最大 464ms |
| `saves-release.json` | 款式、规格、渠道、店铺、物料各 5 次保存与刷新读回；最大 154ms |
| `config-saves-release.json` / `unit-save-current.json` | 配置、计量单位各 5 次保存，刷新后保留结果 |
| `cost-propagation-100-final.json` | 100 下游成本，预览/保存各 5 次；最大 82ms，刷新读回一致 |
| `idb-browser-cohort256-final.json` | 31 个真实浏览器 IndexedDB 契约结果：只读不落种子、冲突、幂等、事务回滚、容量失败、文件引用与按主对象导入等 |
| `config-source-reconciliation.json` | 343 项旧静态配置逐项按稳定 ID 和名称/保留别名核对，343 项匹配 |
| `list-extra-release.json` | 款式大图开关、列设置开关、前后分页、三态排序各 5 次；最大 193ms |
| `material-label-release.json` | 5 次标签预览，最大 177.5ms；未进行实物打印或设备扫码 |
| `material-review-partial.json` | 缺基础 SKU 提交被阻断 5 次；补齐 SKU 后主档/首批 SKU 提交与同人审核 1 次。不能当成全部审核流程 5 次 |
| `channel-sync-cycles-current.json` | 5 轮更新→部分失败→仅失败项重试→成功回执，共 20 个动作；最大 268.1ms，外部身份保持 |
| `channel-platform-prices-current.json` | 5 次平台规格独立改价，最大 172.6ms；同一内部 SKU 的其他外部规格价格不连带变化，刷新结果一致 |
| `channel-copy-current.json` | 5 次复制，最大 212.3ms；3 个外部规格继续对应 2 个内部 SKU，清空 PID/平台规格身份并保持草稿，刷新一致 |
| `testing-channel-regression-current.json` | 5 轮测款来源校验/正确绑定/返回，另有 2 次发布前置阻断；27 个动作最大 311.8ms。只证明来源衔接及旧提示清除，不是 5 轮完整上架 |
| `testing-channel-flow-partial-current.json` | TO0006 完整发布回写走通 1 次，包含刷新；该次曾发现旧校验文案残留，已由上述回归修复。仍不足以关闭完整上架验收 |
| `wool-print-release.json` / `wool-pda-release.json` | 毛织部位片打印预览和 PDA 的已有业务对象、数量及单位；没有新增 PCS 档案维护入口 |

`final-actions.json` 含 200 条测量和 1 条错误记录；首次发布待核实只取得 1 次、100 行导入预览只取得 1 次。不能把文件名或累计次数当作这两个动作已经五轮通过。`final-config-actions.json` 主要是分组切换，实际保存使用单独的 5 次证据。

## 性能仪器及重放方法

`browser-meter-current.js` 是这次使用的局部仪器副本，仅用于本机验收页。它不写业务存储，不提前加载页面、不替换渲染、不忽略慢样本。源代码不含此仪器；最近一次构建后的 `dist/index.html` 已不含仪器注入。后续单页调试通过浏览器开发接口临时注入，刷新后失效。

1. 重新从上述工作树构建，保存 source manifest；在独立本机验收源启动预览。
2. 用浏览器工具按 `routes-release.json` 中的 `url`，设置对应 viewport。每路由禁用缓存导航 5 次、正常整页刷新 5 次。
3. 路由导航从 navigation start 计时。操作调用 `__r1Arm(label, predicate, eventType)` 后，由浏览器工具真实点击/输入；事件捕获时记开始。
4. predicate 必须对应目标内容或结果，不只检测 loading/toast。仪器等待可见必要图片 decode 和三帧绘制。保存还需对照详情的最终值，并独立刷新读回。
5. 测量读取 `__r1Metrics`，保存每条原始值、场景、模式和轮次。任何样本不满 5 次、错误、图片失败或达到 500ms 的项目不能通过。

大图首轮曾把 `img.complete` 作为仪器启动条件，图片加载不触发 MutationObserver，导致计时没有结束；该次记录为无效仪器结果，未冒充性能通过。之后以图片元素出现启动，仍等待 decode。排序首轮恢复按钮定位名称错误，没有触发操作；以实际页面名称修正后重放，见原始 notes。

## 保留的失败与未闭环

- `scale-current.json`、`scale-archive-chunk.json`、`scale-handler-boundary.json` 等保留优化前超过 500ms 的原始样本。后续只读范围、静态源并行读取和路由依赖收口后，当前 40 次大列表结果见 `scale-release.json`。不得删除旧失败或将它们混入当前通过统计。
- `import-projection-validation.json` 的大批量预览/保存曾超过 500ms。其后出现的单次约 473ms 结果不构成五轮验收，文件选择许可受限后也未补齐。这一项仍未完成。
- 原生确认窗口在 IAB 当前接口无法读取或处理；启用/停用/归档确认后的完整结果未得到五轮证据。没有自动跳过确认。
- 剩余连续流程、边界、下载及跨域页面操作见 [未闭环验收清单](../remaining-validation.md)。没有把未测动作从门禁中移除。
- 全项目 `typecheck` 的 3 条错误位于本次未改动的 `src/data/fcs/factory-receiving-source-sync.ts:20` 与 `src/data/pms/tmf-material-purchases.ts:813/824`。已经在基准 HEAD 独立导出的源码中复现相同错误，证据为 `typecheck-base-88324f6.log`；当前类型检查仍按失败保留。
- 真实渠道 API、数据库写入、多人服务、实物扫码/打印均没有执行。模拟同步不是平台已接入。

未完整运行任务收据：当前工作区含此前的文档/维护工具移除等差异，尚未隔离绑定整个收据，且性能仍有缺口。结构检查通过也不代表整体业务验收通过。
