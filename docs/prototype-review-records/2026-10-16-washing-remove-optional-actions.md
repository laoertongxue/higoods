# 洗水详情取消接单等四项操作

依据：[AGENTS.md](../../AGENTS.md) 的 SCOPE-02、TRACE-01、STORE-02、REVIEW-01、PERF-01、EVIDENCE-01。继承本轮五个 Tab 的信息组织，最新用户截图明确取消接单、作废本单、拒单、登记异常；原 Tab 验收按原源码哈希保留历史身份，不能冒称覆盖本次新业务规则。

## 基本信息

- 日期：2026-10-16
- 任务 / 需求编号：WASH-281～WASH-290
- 验证人：Codex 主代理（产品接受由用户确认）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：固定 GTG 承接的洗水单不需要截图中四项操作。除了移除入口，还须处理接单前置对实物交接的影响，并保留历史事实。用户“等等”期间暂停 Git 发布；用户随后明确保留其余实物登记。完成本次修正和验收后，继续此前已授权的提交、合并 main、推送及线上核查；不要求重复授权。

## 范围、计划与原子矩阵

本次属于 T4 共享状态和跨端行为调整，发布叠加 T5。用户已明确确认：逐卷实收、投入洗水、实际产出、交回下游保留。实施顺序：移除四项入口及页面事件分支；新单和显式 GTG 安排使用无需接单的状态，不写接单人、接单时间或接单动作；旧 GTG 待接单记录可直接进入交接但普通读取不修改原字段；同步列表和时间展示、备份校验及专项；完成正常/历史/失败/恢复、各端和固定产物响应后，再按原授权提交发布。

数据边界：沿用同源 IndexedDB 的洗水单与动作记录，不清空用户资料，不伪造染厂人员接单事件；历史接单、拒单、作废和异常事实保留可追溯身份。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / PDA / 打印 / 性能证据或不适用理由 | 状态 | 证据位置 | 确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WASH-281 | 用户最新截图 | 洗水详情不再提供接单操作。 | 入口 | work-orders.ts / detailContent、handleFabricWashingEvent | 本轮专项 | Web/PDA | 已验证 | ../verification-evidence/2026-10-16-washing-remove-optional-actions/final-report.json | Codex；15ba48c6 + 0f7731735932 |
| WASH-282 | 用户最新截图 | 洗水详情不再提供作废本单操作。 | 入口 | work-orders.ts / detailContent、handleFabricWashingEvent | 本轮专项 | Web/PDA | 已验证 | ../verification-evidence/2026-10-16-washing-remove-optional-actions/final-report.json | Codex；15ba48c6 + 0f7731735932 |
| WASH-283 | 用户最新截图 | 洗水详情不再提供拒单操作。 | 入口 | work-orders.ts / detailContent、handleFabricWashingEvent | 本轮专项 | Web/PDA | 已验证 | ../verification-evidence/2026-10-16-washing-remove-optional-actions/final-report.json | Codex；15ba48c6 + 0f7731735932 |
| WASH-284 | 用户最新截图 | 洗水详情不再提供登记异常操作。 | 入口 | work-orders.ts / detailContent、handleFabricWashingEvent | 本轮专项 | Web/PDA | 已验证 | ../verification-evidence/2026-10-16-washing-remove-optional-actions/final-report.json | Codex；15ba48c6 + 0f7731735932 |
| WASH-285 | 接单依赖 | 移除接单后，按确认范围保持真实实物流转可执行，不伪造接单。 | 流程 | fabric-washing-model.ts / washingCanExecute、applyWashingCommand；fabric-washing-views.ts / washingOrderStatus | 领域与浏览器专项 | 用户已明确确认保留实物执行登记；新单无需接单即可交出 | 已验证 | ../verification-evidence/2026-10-16-washing-remove-optional-actions/final-report.json | Codex；15ba48c6 + 0f7731735932 |
| WASH-286 | 历史保护 | 已有接单、拒单、作废、异常及实物事实不被普通读取重写。 | 兼容 | fabric-washing-model.ts / washingCanExecute、applyWashingCommand；fabric-washing-views.ts / washingOrderStatus | 旧记录只读比较 | 原单、日志、打印 | 已验证 | ../verification-evidence/2026-10-16-washing-remove-optional-actions/final-report.json | Codex；15ba48c6 + 0f7731735932 |
| WASH-287 | 状态一致 | 列表、详情、时间、进度及 PDA 不再把接单显示为必需待办。 | 状态 | fabric-washing-model.ts / washingCanExecute、applyWashingCommand；fabric-washing-views.ts / washingOrderStatus | 状态及双端专项 | 新单与历史待接单 | 已验证 | ../verification-evidence/2026-10-16-washing-remove-optional-actions/final-report.json | Codex；15ba48c6 + 0f7731735932 |
| WASH-288 | Tab 继承 | 保留五个视图及适用输入、日志和打印交互。 | 集成 | detail-views.ts；work-orders.ts | 更新 Tab 专项 | 输入保留与两个预览 | 已验证 | ../verification-evidence/2026-10-16-washing-remove-optional-actions/final-report.json | Codex；15ba48c6 + 0f7731735932 |
| WASH-289 | STORE-02 | 新规则保存、刷新和下游直达一致，失败不产生半套事实。 | 持久化 | fabric-washing-model.ts / washingCanExecute、applyWashingCommand；fabric-washing-views.ts / washingOrderStatus | 原生 IndexedDB 回读 | 普通读取不落盘迁移 | 已验证 | ../verification-evidence/2026-10-16-washing-remove-optional-actions/final-report.json | Codex；15ba48c6 + 0f7731735932 |
| WASH-290 | PERF-01 | 按受影响家族采集完整响应，复核直接上下游与最终差异。 | 验证 | 本轮专项 | 固定产物及技术门禁 | 每个受影响性能家族至少五次 | 已验证 | ../verification-evidence/2026-10-16-washing-remove-optional-actions/final-report.json | Codex；15ba48c6 + 0f7731735932 |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 四项操作移除及接单依赖 | 通过 | 6 类历史状态、Web/PDA 四项入口均不存在；新单直接交出，没有 acceptedAt 或 ACCEPT 动作。源单与原去向保留。见 final-report.json、detail-without-four-actions-1366.jpg。 |
| Web/PDA、持久化与历史兼容 | 通过 | 本轮定向单测 38 项通过；实物流转、原生回读、备份恢复、重复/冲突和事务中止重试等 15 项浏览器契约通过。旧状态、历史阻断及普通读取前后内容相同；36 旧 PENDING 只读列表通过。见 persistence-contracts.json、early-match-recheck.json 和 final-report.json。 |
| 页面、图片、打印与性能 | 通过 | 三种 Web 尺寸和 PDA 390×844；图片大图/关闭、两个打印预览及卷标、五个 Tab 输入保留通过。20 个响应家族各 5 次，共 100 个样本，最大 527.10009765625ms，无超时、页面异常或无效值。 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/dyeing/washing/work-orders.ts`
- `src/pages/process-factory/dyeing/washing/detail-views.ts`
- `src/pages/process-factory/dyeing/washing/order-presentation.ts`
- `src/data/fcs/fabric-washing-model.ts`
- `src/data/fcs/fabric-washing-views.ts`
- `src/data/fcs/fabric-washing-maintenance.ts`

### 页面证据

- 版本：codex/post-print-fabric-washing；HEAD 15ba48c625157d58fec75f340466bd83938e99ed；工作树 /Users/laoer/.codex/worktrees/a266/higoods；固定产物预览 http://127.0.0.1:43159；14 个运行/验证文件组合摘要 0f7731735932d4de74f4f855b2d0b2a755d9816f882624c665ef4f0edf5a7841，见 source-manifest.json；最终收据与发布另行绑定 Git 版本。
- 证据：[本轮证据目录](../verification-evidence/2026-10-16-washing-remove-optional-actions/)；原用户红框为 user-request-remove-four-actions.png，实际 1366×768 页面为 detail-without-four-actions-1366.jpg。/fcs/craft/dyeing/washing/work-orders/:id 与 /fcs/pda/washing/:id 双端、三种 Web 视口和 PDA 390×844 均覆盖；旧 Tab 报告保留原身份，本轮数据、运行产物、浏览器版本、时区和全量原始样本由 final-report.json 记录。

### 性能结论

- 结论：通过
- 依据：[本轮正式报告](../verification-evidence/2026-10-16-washing-remove-optional-actions/final-report.json)；20 个家族各 5 次，共 100 个样本，最大 527.10009765625ms。6 卷同单用于详情/Tab/各类实物保存，36 张历史 PENDING 用于冷列表兼容；原生事务完成后读回才结束保存采样，可见内容、图片、字体和两帧绘制齐备才结束响应；PDA 登录后直达单列，不冒称浏览器冷启动。旧的包含接单的采样不作本轮通过依据。

### 验证命令

- `node --import tsx --test tests/unit/fabric-washing.test.ts tests/unit/fabric-washing-maintenance.test.ts tests/unit/fabric-washing-views.test.ts tests/unit/washing-factory-warehouse-overview.test.ts`：通过
- `WASH_TAB_RUNS=5 WASH_TAB_FORMAL=1 WASH_TAB_OUT=output/washing-no-optional-actions WASH_RUNTIME_ASSETS=output/washing-no-optional-actions/runtime-assets.json WASH_LEGACY_FIXTURE=output/washing-gtg-v1.3/benchmark-36-orders.json WASH_BASE_URL=http://127.0.0.1:43159 node scripts/check-washing-detail-tabs.mjs`：通过
- `WASH_UI_RUNS=1 WASH_UI_SECTION=main WASH_UI_OUT=output/washing-no-optional-actions/upstream-downstream WASH_RUNTIME_ASSETS=output/washing-no-optional-actions/runtime-assets.json WASH_BASE_URL=http://127.0.0.1:43159 node scripts/check-washing-gtg-ui.mjs`：通过
- `WASH_BASE_URL=http://127.0.0.1:43160 WASH_OUT_DIR=output/washing-no-optional-actions/contracts WASH_STOP_ON_FAIL=1 node scripts/check-post-print-fabric-washing.mjs`：通过
- `WASH_BASE_URL=http://127.0.0.1:43160 WASH_OUT_DIR=output/washing-no-optional-actions/edges WASH_EDGE_FILTER=CT-11 node scripts/check-post-print-fabric-washing-edges.mjs`：通过
- `npm exec vite -- build`：通过
- `git diff --check`：通过

### 例外

- 无。本次以用户最新要求为准，不豁免历史事实保护或性能门禁。


## 调整边界及审查

新写入规则：洗水单固定 GTG，承接确认不再是业务步骤；新增 `NOT_REQUIRED` 只表达无需接单，不生成 `acceptedAt` 或 ACCEPT 动作，不把系统安排冒充染厂人员接单。旧版 PENDING/ACCEPTED/REJECTED/UNASSIGNED 仍可读取；旧 GTG PENDING 通过只读规则提供直接交接，旧拒单、作废、异常和已发生实物事实不被刷新重写。备份格式保留原版本并接受新增状态，旧状态、附件和关联校验仍保留。不新增迁移、快照或存储键，事务归属不变。

四项页面动作及其事件入口在 Web/PDA 同时移除，历史动作名称保留用于追溯；已有异常单的实物核对恢复入口继续承担旧事实恢复，不新增“登记异常”。其他系统的接单功能不在本次范围。零产出仍阻断，提示不再引导到已移除的登记异常入口。

第一轮审查正向核对四项需求与接单前置：SEND 和页面共用同一可执行规则；新单实际交出前没有接单事实，旧待接单单据不会卡住或被隐式迁移，原接收方、卷码和数量校验仍生效。新状态同步进入备份恢复校验，避免新单无法恢复。

第二轮反向核对直接消费者与验证：列表统计、详情状态、时间、PDA、打印和源单路径均覆盖；原印花下游、技术包实际路线和生产快照继续使用同一洗水事实。专项中修正了旧检查器的零产出提示文本、实物交出后纠正提示、基本信息/打印 Tab 定位以及 PDA 洗水根容器范围；未据此误改产品。最初采样的 36 单源夹具被领域检查器按新规则再生成，后续明确在隔离上下文内转换为历史 PENDING 并重新采样，防止把新单列表误标为旧单兼容证据。原日志、报告及有效样本全部保留。


直接上下游回放：从印花操作栏创建三张洗水单，同一印花来源两种手感分单；GTG 下游筛选/导出、日志、新窗口、对应技术版本及生产快照、原工厂和中央仓两条 50→49→49 Yard 闭环与人工完单、打印均通过。原 6 项边界通过证据保留；CT-11 因生产单链接转入基本信息 Tab 而修正定位并单独复验通过，没有重复运行未受影响的 6 项。

最终技术收据在本记录、矩阵和证据冻结后生成，输出为 `output/washing-no-optional-actions/task-receipt.json`。该工具仍要求完整构建与全量单测；记录通过后的实际收据状态、提交 SHA、main 一致性、Actions、deployment.json 和线上流程放入独立发布结果，避免改写绑定文件或预填部署结果。产品接受仍由用户确认。
