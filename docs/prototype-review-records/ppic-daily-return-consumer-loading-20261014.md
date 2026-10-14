# PPIC 直接上下游正式站加载补修记录

依据 [AGENTS.md](../../AGENTS.md) 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01 和 RELEASE-01。本记录继承已确认 PPIC 方案的 R51／R52／R58／R59，接续三条 PPIC 入口补修；仅记录本版本地阶段，正式站整体结果写入外部部署记录。旧版本和超时原始证据保持原身份。

## 基本信息

- 日期：2026-10-14
- 任务 / 需求编号：PPIC 上下游加载 C01～C03，继承 R51／R52／R58／R59
- 验证人：Codex 主代理；独立只读审查代理核对完整差异

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：命名直接消费者的真实页面依赖和合同母版、后道款图在导航内提前抓取。模块执行、数据恢复、数量和保存顺序不变。

## 来源、范围与实施计划

第二版正式站 `93e7c93b` 的完整运行已通过 112 项 Web、21 项 PDA 业务断言，包括实际任务分配生成两节点合同、正式回货及各读取端一致；但首次生产单进度 1180.2ms、合同预览 1471.2ms，后道待加工仓一例 1013.8ms，PDA 后道直达 1231.6～1665.2ms，车缝执行首例 1088.1ms。失败保存在 `loading-final/online-1791992056679/result.json` 和 `online-pda-1791992221060/result.json`，不删慢样本或放宽 1000ms。

| 编号／继承 | 原子结果 | 实际文件／修改 | 验证及完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| C01／R58 | 提前抓取生产单进度、合同、后道待加工仓、PDA 后道确认和 generic 执行的实际静态依赖 | `vite.config.ts`／`preloadStaticFirstScreenRoutes`；原初始化依赖复用 | 生产产物每类至少 5 样本，内容／图片／绘制／持久回读终点 ≤1000ms；正式另验 | 已验证 |
| C02／R51、R52 | 预取资源对应真实页面，不执行保存或改变图片映射，不命中后道／毛织专用执行页及无效地址 | 同函数；精确 Web／后道 PDA 路径；generic 单段非空 ID 且排除 PF-POST、原冒号／%3A 的 KNITTING、LINKING | 独立审查及生成 HTML 脚本直接执行 12 个正反路径；原子回货、直达读回不变 | 已验证 |
| C03／R59 | 新产物冻结后通过适用检查和完整差异审查，按同一 SHA 部署及核验 | 本记录、技术收据及外部部署记录 | 构建、22 浏览器及治理；最终正式版本、资源、业务、性能另记 | 实施中 |

新增精确路径为 `/fcs/progress/production-orders`、`/fcs/contracts/print`、`/fcs/craft/post-finishing/wait-process-warehouse`、`/fcs/pda/post-finishing/return-confirm`。generic 执行 `/fcs/pda/exec/<task>` 因任务 ID 动态按实际 renderer 范围匹配；空 ID、额外子路径、PF-POST 及毛织专用页不匹配。未预加载完整 FCS 路由。

合同的两张 PNG 与实际母版完全相同，未替换或压缩原打印图片。PDA 后道预取的五张夹克色图对应本次验收生产单，页面仍按实际送货单读取图片；预取不改变其他款图或实物对应。无业务模型、存储、迁移、确认动作、身份、截止或分摊变化；没有真实数据库写入。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 实际入口与 modulepreload 不执行 | 通过 | 独立只读审查核对真实 renderer 和静态依赖，不调用保存或迁移 |
| generic 排除真实专用页 | 通过 | 初审 P2 已修复；生成生产 HTML 正反路径 12 项全部通过，含原冒号／大小写编码毛织、空 ID、子路径 |
| 合同和后道款图来源 | 通过 | 合同母版两 PNG 与模板声明一致；五张正式夹克图存在，与本次单据对应；无替换对象映射 |
| 数量、原子保存、身份及直达读取 | 通过 | 本版 22 项浏览器全部通过；后道事务失败不落半套事实、新标签 399→499／原承诺兑现、当前人员变更时拒绝写入 |
| 页面、图片、大图及电子合同 | 通过 | 同批 1366×768、1280×720、1024×768、390×844；真实对应图、大图 Esc、两页两节点合同 |
| 新生产产物性能 | 通过 | 73 类 × 5 共 365 样本全部 ≤1000ms，最大 728.0ms；四份原始 JSON 及汇总 |
| 正式站及真实设备接受 | 不适用 | 本记录仅本地阶段；线上另验，PDA 为 Chromium 小屏，合同为电子预览 |

## 最终结论

结论：通过

本地补修阶段已通过；结论仅支持本地冻结产物。正式部署、业务和性能仍须新版本核验后关闭，不是业务方接受回执。

## 变更覆盖与验证

### 受管文件

- `vite.config.ts`

### 页面证据

- 版本：基准 `fa0a9fe4baf85a001e45e7a8934a0d0ef2f67201` 加单运行文件差异，运行差异 SHA256 `273c2f23f1ffeb9503e277ba069e0d0a5fe35037a97c2d6dfc55b5c4728cf121`、生产 HTML SHA256 `1061e8d0364b30a9d29a474fe4f6ea47cf535d61d4e9ef7b703b87e288872586`；分支 `codex/ppic-daily-return`，工作树 `/Users/laoer/.codex/worktrees/5f34/higoods`；生产预览端口详见各原始报告，适用 1366×768、1280×720、1024×768、390×844。
- 证据：`output/ppic-release-20261014/consumer-loading-final/`；`preload-path-contract.json` 直接执行实际生产 HTML，12 项通过；构建及原始性能日志独立保存；`browser.log` 的 22 项运行和 `output/ppic-adversarial-20261014/browser-1791992774219/` 关联截图。旧正式资源业务通过和性能失败仅作为补修来源，不代替本版验收。

### 性能结论

- 结论：通过
- 依据：本地生产预览，真实时钟、Asia/Jakarta，内容／必要图片／有限动画／两次绘制及适用持久回读；73 类共 365 样本全部 ≤1000ms，最大 728.0ms。`consumer-loading-final/performance-summary.json` 绑定上述 HTML；正式站旧超时有效，新版本须另验，不豁免 1 秒门禁。

### 验证命令

- `npm run build`：通过
- `npx vite build`：通过
- `npx playwright test --config tests/ppic-daily-return.config.ts`：通过
- `node output/ppic-release-20261014/consumer-loading-final/performance.mjs`：通过
- `node output/ppic-release-20261014/consumer-loading-final/consumer-performance.mjs`：通过
- `node output/ppic-release-20261014/consumer-loading-final/receipt-performance.mjs`：通过
- `node output/ppic-release-20261014/consumer-loading-final/identity-save-failure-performance.mjs`：通过

### 例外

- 无。全部适用结果通过后才关闭相应阶段；最终正式站 SHA 和闭环另行验收。
