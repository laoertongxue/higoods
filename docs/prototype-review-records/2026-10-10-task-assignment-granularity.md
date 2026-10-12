# 任务分配粒度统一修复审查记录

本记录依据当前工作树的 [AGENTS.md](../../AGENTS.md)，按 T4 共享行为及旧逻辑删除范围核验。

## 基本信息

- 日期：2026-10-10
- 任务 / 需求编号：任务分配粒度统一修复；AG-001～AG-012
- 验证人：Codex（技术验证；用户产品接受未发生）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：车缝＋烫包合并任务支持完整 SKU 派单；两种允许任务支持完整 SKU 竞价；其余任务在页面、分区、竞价快照和有效分配记录写入都限制整单。删除旧明细分组写入和预拆代码。PDA 报价等待原子保存完成，刷新可读；报价输入局部更新；最新招标按创建事实读取，取消重发不会误读旧单；定标记录有效 PPIC 身份。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 允许任务类别 | 通过 | AG-001～003；策略单测及工作台两类任务的派单 / 竞价浏览器场景 |
| 其余任务整单门禁 | 通过 | AG-004；非允许任务分区拒绝、局部竞价快照拒绝、派单及定标的局部分配记录拒绝；页面整单只读范围 |
| 数量与分区 | 通过 | AG-005～006；完整 SKU、空 / 重复 / 未知 / 部分数量契约；2500件分为500件与2000件，剩余待分配 |
| 竞价范围及价格冻结 | 通过 | AG-007；所选500件进入竞价快照，管理端定标与合同保持500件 |
| 保存与恢复 | 通过 | AG-008；竞价及PDA报价事务中止保留输入，无半套结果，重试及刷新回读；取消重发的最新招标不依赖记录恢复顺序，契约覆盖相同创建时间的两个单号 |
| 旧写入清理与历史读取 | 通过 | AG-009；删除旧模块 / 写入导出 / 预拆函数；历史明细键计划读取单测。旧工作台及产能测试引用的页面 / 模块已退役，有效分配断言迁至当前工作台测试 |
| PDA范围与报价持久化 | 通过 | AG-010；390×844显示1个SKU、500件；刷新仍有报价，定标只使用该范围 |
| 打印范围与二维码 | 通过 | AG-010；任务单只含SKU-005-S-GRY和500件，真实二维码SVG指向子任务；合并工序及来源保留 |
| 适用设备与布局 | 通过 | AG-011；1366×768、1280×720、1024×768管理端和390×844 PDA可操作，无主体横向溢出 |
| 识别图片与预览 | 通过 | 沿用SPU-005冻结技术包款式图、Grey对应SKU信息及原物料图片；相邻测试验证4张物料图加载、高清预览与Esc关闭。现有失败态源码断言仍执行，未替换素材 |
| 弹窗局部更新 | 通过 | AG-012；打开 / 勾选 / 确认时列表DOM节点仍连接，更新限定分配弹窗；PDA报价输入与提交可用状态局部更新 |
| 完整响应性能 | 通过 | 最终生产预览20场景、17家族125个样本全部≤1000ms，最大982.8ms；所有早期失败记录保留，未降低阈值或数据量 |
| 附件、迁移与外部数据库 | 不适用 | 本次未改附件、迁移、备份或数据库连接；只操作隔离浏览器的现有原型存储 |

## 最终结论

结论：通过

本任务的业务、底层写入限制、历史读取、直接下游、持久回读、页面及命名环境性能已通过技术验证。需求AG-001～AG-012逐条绑定当前实现和证据，完整任务diff已作语义审查。技术收据另由实际JSON绑定版本与检查结果；用户产品接受尚未发生。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/effective-task-assignments.ts`
- `src/data/fcs/merged-production-task.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/runtime-task-tenders.ts`
- `src/data/fcs/task-fulfillment-policy.ts`
- `src/data/fcs/task-split-dispatch.ts`
- `src/pages/dispatch-tenders.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/unified-dispatch-workbench.ts`

### 页面证据

- 版本：工作树 `/Users/laoer/.codex/worktrees/e291/higoods`，分支 `codex/dispatch-assignment-granularity`，HEAD `1a2df088fa8e39863b59290cde9e7e86cd84d431` 加未提交修改。运行代码差异SHA256 `11d933635585b8ab43ecd2edf8d9c60a1bead7830e628bbaeed7dde6e059387d`；逐文件哈希见 `output/playwright/dispatch-assignment-granularity-20261010/source-version.json`，985项生产资产哈希见同目录 `production-assets.json`。
- 证据：当前源服务 `http://127.0.0.1:43234` 用于契约夹具及功能诊断，生产预览 `http://127.0.0.1:43233` 用于生产资产实页及性能，均属于本工作树；Chromium 149.0.7827.55、Asia/Shanghai、本机回环网络。管理视口1366×768 / 1280×720 / 1024×768，PDA390×844；隔离浏览器上下文，无用户数据。初始完整演示列表；目标任务4个SKU/2500件，分配后1个SKU/500件和3个SKU/2000件。夹具经当前业务保存动作生成，生产预览复制隔离测试记录后从持久数据读取，未加载开发源码模块。记录数量、缓存条件及原始计时见同目录环境及性能JSON。

页面动作：`/fcs/dispatch/workbench` 派单及竞价选择、精确二次确认、保存和刷新；`/fcs/pda/task-receive` 报价与失败重试；`/fcs/dispatch/tenders` 刷新后报价、定标及合同；`/fcs/print/preview` 的 `DISPATCH_TASK_SHEET` 只含所选SKU、500件和真实二维码。截图位于上述目录的 `production-*-confirmed.png`、`production-pda-quote.png`、`*-selected-task-sheet.png`。自动断言与写后回读见两个粒度专项浏览器脚本及相邻准备 / 回货测试。冻结服务后的源实页25场景全部通过；全量780单测、其中8个粒度 / 回读契约通过，TypeScript及生产构建通过。源实页日志`output/playwright/dispatch-assignment-granularity-20261010/source-stable.log`，构建日志同目录`build-final.log`。

### 性能结论

- 结论：通过
- 依据：最终生产预览20场景全部通过，17个性能家族、125个有效样本全部≤1000ms，最大982.8ms。原始文件：`output/playwright/dispatch-assignment-granularity-20261010/production-performance-2026-10-10T06-54-41-336Z.json`；环境见`production-preview-environment.json`和`production-resource-state-before-final.json`；源码和985项运行资产由`source-version.json`及`production-assets.json`固定。最终生产日志：同目录`production-isolated.log`。

导航从真实导航起点到必要图片加载、IndexedDB只读回读及两帧绘制；点击从真实click到目标DOM / 状态、必要图片及绘制，保存还含独立只读回读。输入从真实input到字段 / 提交可用状态和绘制。派单与竞价分别测；SKU选择代表同样4个SKU、同一弹窗更新路径（含相关输入）的最重选择动作。PDA两类任务功能分别验证，报价性能以源服务诊断较重的ID-F001原型场景代表共用报价保存与字段路径。报价中止 / 成功、竞价中止 / 中止后重试各自成家族。每家族至少5个有效样本，首次访问、已有记录导航、刷新分开；每例新浏览器上下文，未冒称浏览器进程冷启动。

历史失败与诊断保持原身份：修复前的100样本、开发服务CPU剖析、热更新导致模块双实例的失败日志均保留。当前源版本曾在另一工作树浏览器验收并行时出现9个性能失败（首屏最大1631.6ms、刷新1107.5ms、报价保存1097.4ms）；原始69个样本及`production-concurrent-load-failed.log`、`navigation-concurrent-load-profile.json`保留。该外部浏览器验收自然结束后，按事先记录的资源状态追加当前20场景完整复测，未干预其他任务，未改源码、阈值、数据规模或缓存条件。未删除慢样本、取最快值或用平均值覆盖失败；本次性能通过结论限定上述本地生产预览、单验收worker及已记录资源条件。

收据独立服务复测又遇到同机另一工作树的新一轮浏览器验收：源服务25场景通过，生产预览11场景通过、9个性能失败，因此收据如实保持implemented。`task-receipt-concurrent-load.json`、`receipt-concurrent-load-failed.log`、`receipt-concurrent-resource-state.json`与各失败worker的原始JSON / trace保留；仅核查进程身份与工作目录，未干预其他任务。首次资源检查只确认无界面浏览器子进程退出，判断范围不完整；该工作树随后仍有有界面浏览器验收。由此产生的新轮次首屏最大3341ms，11场景通过、9个性能失败，依赖的25个源服务场景未运行，收据仍保持implemented；`task-receipt-headed-concurrent-load.json`、`receipt-headed-concurrent-load-failed.log`与原始计时 / trace保留。

完整浏览器负载退出、确认没有其他工作树的浏览器验收负载后，再按事先记录的资源条件追加完整轮次。生产预览先执行以缩短资源确认到计时的间隔，之后执行相同25个源服务场景；运行代码、1秒阈值、数据规模和缓存条件不变。最终收据JSON另绑定本轮真实结果，不以先前通过结果替代本轮失败。

用户已明确授权向「梳理后道工厂管理需求」发送协调消息，请其在当前浏览器操作安全完成后预留约10分钟验收时段；不终止他人进程、不影响未保存动作，结束后通知释放时段。授权与消息目标见`browser-coordination-authorization.json`，最终资源状态、独立服务结果及完整差异以收据JSON为准。

| 家族 | 有效样本 | 最大值(ms) |
| --- | --- | --- |
| 首次访问，空用户存储 | 10 | 962.8 |
| 已存记录筛选导航 | 10 | 917.1 |
| 打开派单 | 5 | 134.3 |
| SKU选择 | 30 | 404.2 |
| 派单二次确认 | 5 | 70.3 |
| 派单保存及回读 | 5 | 396.8 |
| 持久结果刷新 | 10 | 794.3 |
| 打开竞价 | 5 | 197.6 |
| 竞价二次确认 | 5 | 151.6 |
| 竞价保存及回读 | 5 | 459.6 |
| PDA报价金额输入 | 5 | 89.5 |
| PDA交付天数输入 | 5 | 98.6 |
| PDA报价备注输入 | 5 | 70.8 |
| PDA报价事务中止及回读 | 5 | 929.4 |
| PDA报价成功及回读 | 5 | 982.8 |
| 竞价事务中止及回读 | 5 | 713.6 |
| 竞价中止后重试及回读 | 5 | 551.7 |

### 验证命令

- `node --import tsx --test tests/unit/dispatch-assignment-granularity.test.ts`：通过
- `npm run check:sewing-outsourcing-task-boundary`：通过
- `npm run check:fcs-unified-assignment-foundation`：通过
- `npm run check:fcs-whole-task-tender-pool`：通过
- `npm run check:fcs-auto-dispatch`：通过
- `npm run check:fcs-sewing-preparation-return-preview`：通过
- `npm run check:fcs-dispatch-list-filters`：通过
- `npm run check:prototype-design-governance -- --scope worktree`：通过
- `npm run check:list-page-governance -- --scope worktree`：通过
- `node --experimental-strip-types --test tests/workflow-governance/affected-checks.test.ts`：通过
- `npm run build`：通过
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=true CUTTING_E2E_PORT=43234 npx playwright test tests/dispatch-assignment-granularity.spec.ts tests/fcs-unified-dispatch-preparation-return-preview.spec.ts --workers=1 --reporter=line --output=test-results/dispatch-source-stable`：通过
- `CUTTING_E2E_USE_PREVIEW=true PLAYWRIGHT_REUSE_EXISTING_SERVER=true CUTTING_E2E_PORT=43233 npx playwright test tests/dispatch-assignment-granularity-preview.spec.ts --workers=1 --reporter=line --output=test-results/dispatch-production-isolated`：通过

### 例外

- 无。三工序合并演示任务配料不足，页面验证实际阻断，底层整单规则以契约核验；未绕过该前置条件。保留历史计划读取不保留旧写入入口，也不删除历史用户记录。

## 范围外资料观察

所选范围的任务单正确展示款式、面料图片、SKU与500件以及子任务二维码。冻结技术资料里既有纸样图片缺项和个别面料单位未维护仍如实显示；本次未改打印资料、单位转换或素材来源，仅验证本次分配范围和关联资料未串入其他SKU，不宣称整张技术资料已经补齐。

完整原型治理与列表治理按本工作树全部任务路径检查，无排除路径；列表静态检查覆盖3个受影响页面。首次技术收据中的工程检查全部通过，但五个浏览器路径未匹配运行器，因此如实停在implemented；原JSON及日志保留。新增独立双服务配置、对应运行器路由与退役文件不存在门禁后，共24个任务路径；路由契约通过，最终技术收据由 `workflow:verify` 另存JSON，绑定全部差异、指令、工程检查和45个实际浏览器场景，以该收据的实际状态为准。
