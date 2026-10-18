# 缝边绣工厂能力存量启动回归修复

依据 `AGENTS.md` 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01；本记录使用 `docs/prototype-review-record-template.md`。

## 基本信息

- 日期：2026-10-18
- 任务 / 需求编号：CAP-START-01～CAP-START-07
- 验证人：Codex 主代理；第 1、2 轮独立审查分别由 detail_final_review_1、detail_final_review_2 完成；技术验证不代替用户接受
- 阶段：T4 发布候选产品审查。CAP-START-07 的 main / GitHub / Caddy 发布后事实由独立 `output/verification/seam-capability-startup-regression/final-delivery.json` 记录，不预填正式发布结果，不让部署回执反复改变提交前收据绑定。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：工厂能力读取归一化在共享模块初始化时误判派生编号冲突，导致应用无法访问；本记录按 T4 验直接影响，正式同步另叠加 T5。

## 范围、事实与继承

基准是 `772fe3b832697c4fa6f3815cad18baf05b437e89`。用户在本地生产预览 `/fcs/craft/workbench/overview` 报能力编号冲突。两个新增失败契约在该产品代码上复现同一错误，其中一个在模块首次导入、`loadFactoryMasterRecords` 调用链中失败。原始失败与旧版发布证据保持原身份。

工厂档案、Mock 和入驻转正式按父工序分组，档案编辑器只读取同父工序第一组并整体替换该组。`ABILITY_<processCode>` 或入驻生成的编号、能力名称及范围是组元数据；迁出工艺与目标父工序原本可以有不同元数据，不能由此判为业务冲突。实际接单权限、产能管理、状态及未知业务属性继续严格核对，不合并相反的设置，不对权限做 OR 放行。

本次仅修正兼容能力合并的派生元数据，不增加多个同父工序有效组，不改变路由、页面结构、工艺唯一身份、工厂归属、数量、毛织事务或其他成本。普通读取仍作私有投影、不写原存量；没有清空浏览器、删除档案或回退 Mock。原工厂档案持久化接口及存储归属没有迁移，本补丁不宣称解决该模块全部既有存储问题。真实业务设置矛盾仍保留原来的明确阻断，不借修复元数据误冲突静默选一方。

浏览器工具的 URL 策略拒绝读取用户当前标签页。采用独立 `43185` 端口和构造测试资料验证，不通过其他浏览器工具绕过读取原标签页或原浏览器资料。因此本记录证明相同报错结构的修复，不冒称读到了用户原始存量或其标签页已刷新成功。

## 需求、计划与原子矩阵

1. 重放完整旧元数据的合并及首次导入失败契约，保留真实失败日志。
2. 保持父工序单行，优先原目标组有效编号，按最终工艺集合生成名称和范围；业务设置继续冲突阻断。
3. 核对普通读零写、显式保存后新模块回读、输入不变与边界编号；当前 9 项专项纳入完整构建单测。
4. 在带完整旧元数据的隔离存量中逐个核总览、档案和 16 类工艺入口，检查具名设备、实际图片与性能；执行两轮独立对抗审查。
5. 固定任务文件并生成收据后，仅暂存本任务 3 个路径；沿已有授权快进 main、推送 GitHub，并独立核对正式 HTTPS 版本和页面。

业务对象边界：工厂档案 → 既有 `fcs_factory_master_store_v1` 存量 / 静态 Mock → `loadFactoryMasterRecords`、`cloneFactory`、公开 list/get/upsert → 工厂档案、能力选择和工艺页初始化。旧项仅为本次输入中的数字工艺身份和能力组元数据；普通读不执行迁移写入或删除；用户明确保存仍走原接口。本次未读取测试站数据库。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / 性能证据或不适用理由 | 状态 | 证据位置 | 确认人和版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CAP-START-01 | 用户报错、范围 | 兼容旧父工序与目标组的派生元数据差异不阻断首次导入 | 合并修复 | factory-master-store.ts / normalizeFactoryProcessAbilities | 旧版 2 个失败契约；修复构建内 9 项专项 | 总览、档案及 16 页实际加载无异常 | 已验证 | red-contract-v2-outcome.json、build.log、local-v5/result.json | Codex，基准 772fe3b8 + 本任务源码哈希 |
| CAP-START-02 | 单父工序模型 | 保持一个目标组、完整工艺集合，优先原目标有效编号并重算名称和范围 | 合并修复 | 同上；seam-factory-capability-migration.test.ts | 正反顺序、自定义 / 缺失编号、无既有目标组、重复投影 | 档案编辑器回显缝边绣、模板工序和普通绣花 | 已验证 | build.log、adversarial-round-1.json、local-v5/result.json | 同上 |
| CAP-START-03 | 实际业务设置 | 相反权限、产能、状态及未知属性仍冲突且不替换原资料 | 冲突保护 | 同上严格字段检查 | 三业务字段保留拒绝；独立 R1 的同 / 异编号、未知属性反例 | 有意冲突仅在隔离 Node 中检验，避免污染页面正常夹具 | 已验证 | build.log、adversarial-round-1.json | 同上 |
| CAP-START-04 | STORE-02 边界 | 普通读零写、输入不变，明确保存后新模块读回稳定 | 存量验证 | cloneFactory / loadFactoryMasterRecords / upsertFactoryMasterRecord | Map Storage 冷 import、显式保存和新 import；原 raw 逐字保留 | 全部页面读取、编辑取消、刷新回读的原生 localStorage 保持原 raw 且源键 0 写 | 已验证 | build.log、local-v5/result.json | 同上 |
| CAP-START-05 | UI-01、PERF-01 | 全部 16 类入口及相邻总览 / 档案可用，设备、图片和具名性能通过 | 页面验证 | 已有消费者，未改页面模板或路由 | 浏览器原生 fixture / 网络资源字节核对 | 18 入口；36 个额外设备场景；19 家族各 5 样本，最大 701.5ms；真实下方图片滚动验证 | 已验证 | local-v5/result.json、截图；asset-version.json | Codex，实际构建 app-shared-BZeBy6VL.js |
| CAP-START-06 | 用户两轮审查要求 | 两轮实质对抗审查通过且主代理整合最终 diff | 审查 | 本任务 3 路径与原始证据 | R1 独立 28 项反例；R2 核版本、采集修正、原样本身份和最终页面证据 | 两轮实质审查通过，0 阻断；当前报告仅将其真实结论写入并由 R2 做最终文档绑定 | 已验证 | adversarial-round-1.json、adversarial-round-2.json | 独立审查人，主代理最终整合 |
| CAP-START-07 | 原发布授权、RELEASE-01 | main / GitHub / 正式 HTTPS 精确版本和全量线上页面相符 | 发布交付 | 本次提交与部署资产 | 发布后逐项登记，提交前不能预填 | 属 T5，独立交付回执关闭；本记录不冒充正式发布成功 | 已实现待验证 | final-delivery.json（发布后生成） | Codex，发布 SHA / run 由独立回执绑定 |

上表证据的缩写目录：自动化、审查及发布在 `output/verification/seam-capability-startup-regression/`；浏览器在 `output/playwright/seam-capability-startup-regression/`。第 7 项是完整任务的后续发布门槛，不属于本记录提交前 T4 产品结论；完整任务只在其独立回执通过后关闭。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 启动及父工序能力组规则 | 通过 | 9 项当前专项随 build 通过；完整旧元数据夹具在实际构建中加载；单组完整选择回显 |
| 权限、产能、状态及未知业务属性 | 通过 | 仅三个派生字段不参与冲突；真冲突保留，独立 R1 核 28 项反例 |
| 保存、读取和存量保护 | 通过 | 普通读源键 0 写且逐字保留；取消、刷新无写；明确保存和新实例回读通过；未声称重做既有存储架构 |
| 页面和设备 | 通过 | 1366×768、1280×720、1024×768；18 个入口共 131 场景结果，包含 95 个性能样本；正文不向页面外横溢出 |
| 图片 | 通过 | 必要首屏图 decode 后才完成；1024 压褶的真实款式图在下方，正常滚动后可见、144×192，原资料不变；未变更图片来源或交互，旧完整图片证据保持原身份 |
| 性能 | 通过 | 有效页面内 19 家族 × 5 样本，每个均 ≤1000ms，最大 701.5ms；初版采集器 1114.3ms 原观察及不确定完成时点保留，见下述采集修正说明 |
| 双轮对抗审查 | 通过 | R1 与 R2 均通过、0 阻断；R2 核 35 项及全部 95 项原样本身份、计时修正、源码 / 资产和实际截图；最终文档增量绑定单独保存 |
| PDA / 打印 / 数量 / 金额 | 不适用 | 本次未改动作、路由、模板、数量或成本；仅能力组元数据读取合并，不以此声明重验全部既有业务闭环 |
| 列表治理 | 不适用 | 本次没有列表文件、骨架、字段、事件、分页或公共列表组件差异；对 16 个现有入口做共享启动回归，未更新历史基线 |

## 最终结论

结论：通过

CAP-START-01～06 的 T4 产品阶段通过。两轮实质审查均无未关闭阻断；最终文档绑定及治理收据须继续通过才允许提交。CAP-START-07 的 T5 发布另由独立交付回执判定；完整任务不在本记录中提前关闭，也不代填用户接受。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/factory-master-store.ts`
- `tests/unit/seam-factory-capability-migration.test.ts`
- `docs/prototype-review-records/2026-10-18-seam-capability-startup-repair.md`

### 页面证据

- 版本：分支 `codex/seam-embroidery-unification`；HEAD `772fe3b832697c4fa6f3815cad18baf05b437e89` 加当前任务差异；运行源码及全部 1220 个资源哈希在 `output/verification/seam-capability-startup-regression/asset-version.json`。产品文件 SHA256 为 `06ad8521be38342b6a8b4e7d60c6993f5862edca1f576d4e3ad52933be134b42`，测试为 `53d79e7d2c5bb88c7e9db91af22f435f914e20d5e4d8fc0274967000656a220c`。新 shared 为 `app-shared-BZeBy6VL.js`；未覆盖旧版资源清单或发布证据。
- 环境：本工作树 `vite preview`，`http://127.0.0.1:43185`；Chromium 155.0.8059.80，独立 context、`Asia/Shanghai`、`zh-CN`，无 CPU / 网络限速；每个新 context 在首次导航前用原生 storageState 装入构造存量，未读取用户浏览器。
- 证据：`output/playwright/seam-capability-startup-regression/local-v5/result.json` 及其中引用的 V2 / V3 / V4 原样本。通过 18 个入口的冷加载与 36 个最低 / 员工设备场景，16 类列表总数按逐类固定演示记录核对，不出现多工厂切换。档案编辑器准确回显三项工艺，取消零写，刷新后仍可读。实际首批 157 个静态资源响应字节与新构建一致；这不是全部 1220 个资源逐次浏览器下载的声明。
- 截图：`local-v3/list-1366-cold.png`、`local-v5/list-1280-layout.png`、`local-v4/list-1024-layout.png`、`local-v5/profile-editor-merged.png`、`local-v5/pleating-1024-scrolled-image.png`。主代理已查看具名设备截图，必要内容可通过表格内滚动及页面正常滚动访问。

### 性能结论

- 结论：通过
- 依据：`local-v5/result.json` 的 19 家族、95 个有效原值全部 ≤1000ms，最大 701.5ms；每家族 5 个样本，含 18 个首次入口及工作台刷新。起点是实际导航 `navigationStart=0`，app 代码前安装页内 MutationObserver，等待正确标题 / 列表总数及可见分页行、必要首屏实际图片 decode、字体、有限动画、两帧绘制，直接在该回调记录完成时刻；自动化只取回结果，不把 locator 等待算进业务完成点。
- 采集修正：初版在两个远程 locator 等待后才注入终点，原失败观察 `1114.2999999523163ms` 完整保留在 `local-result.json`，不回填或改写成通过；它没有捕获该导航最早真实完成值，不能确定原页面实际就绪耗时。独立同导航诊断的页内完成为 `582.2999999523163ms`、自动化等待返回 `669.1999999284744ms`，只证明两种时钟终点不等，不反推原导航。V2 的分页超时无完成 ms；V3 的首屏图集合断言和 V4 的普通工艺歧义定位也留原失败，不当作慢值或产品事实。V3/V4/V5 只补缺项，95 个已完成页面内样本保持原字节身份，未通过重跑筛选更快值。修正说明在 `collector-corrections.json`，R2 独立核其分类。
- 边界：本节为本地生产预览的具名采样，不把原版本 635 个样本或尚未发生的正式环境采样改标为本次结果。

### 验证命令

- `npm run build`：通过
- `git diff --check`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths src/data/fcs/factory-master-store.ts,tests/unit/seam-factory-capability-migration.test.ts,docs/prototype-review-records/2026-10-18-seam-capability-startup-repair.md`：通过

完整构建含工程入口 / 领域 / UI / 状态类型检查、1156 项单测（含当前 9 项能力迁移专项）以及 Vite 构建。治理预检已通过；最终收据将在该产品记录及 R2 封口后冻结运行，并再次核对治理及必需检查，结果在独立交付回执登记，避免收据绑定自我变化。治理工具不替代本报告的真实产品证据。

### 例外

- 无。未降低 1000ms 门槛，未清理用户资料，未修改旧发布证据或测试站数据库。用户原标签页因工具策略不可读的边界如实保留。
