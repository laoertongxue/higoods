# 洗水执行按操作弹窗办理

依据：[AGENTS.md](../../AGENTS.md) 的 SCOPE-02、REVIEW-01、STORE-02、PERF-01、EVIDENCE-01。

## 基本信息

- 日期：2026-10-16
- 任务 / 需求编号：WASH-291～WASH-302
- 验证人：Codex 主代理；用户产品接受另行确认

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：T3，洗水详情的执行表单改为按操作打开弹窗。继承五个 Tab、固定 GTG、原下游、无接单等四项操作以及现有数量/实物/保存规则；本次不发布。

## 需求、计划与直接影响

加工执行页只展示实物、数量汇总、状态和当前可用操作。逐卷实收、投入洗水、实际产出、交回原下游分别打开独立操作弹窗；为移除整块常驻输入，印花交出和下游实收也按相同方式办理。实收只填写所选卷的实际数量和当前接收方实际库位；投入只选择已实收的卷；产出填写所选卷实际数量、可选重包卷码；交出类核对所选实物卷码，去向只读。数量差异确认仅在确有变化时出现。弹窗保存失败保留填写并允许真实重试；取消不保存，已填写时明确放弃后才丢弃。保存中禁止修改及关闭，键盘、焦点与小屏可用。

沿用同源 IndexedDB 的原洗水动作与关联事务，不新增记录、附件、存储键、迁移或领域规则。直接上游是印花交出事实，直接下游是 GTG 实收/用料、产出以及原接收方实收；日志、打印与五个 Tab 继续读取这些保存事实。只改变输入采集与操作提交方式。旧验证中依赖常驻表单的选择器需随新交互调整；未变更的领域、备份、迁移和打印映射证据保留其版本，不全套重采。

实施顺序：收拢操作可用卷与按需字段 → 局部挂载原生对话框 → 提交原命令并原子回读 → 更新直接 UI 契约 → 固定构建后完成浏览器/持久化/性能验收 → 冻结记录并生成技术收据。负责文件为 work-orders.ts 和 execution-dialog.ts，专项脚本与测试只验证本次直接行为。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / PDA / 打印 / 性能证据或不适用理由 | 状态 | 证据位置 | 确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WASH-291 | 用户本轮 | 执行页无常驻选择、数量、库位或扫码输入 | 页面 | work-orders.ts/detailContent | 专项浏览器 | Web/PDA | 已验证 | ../verification-evidence/2026-10-16-washing-execution-dialogs/final-report.json | Codex；565dee4d + c8e41ecd6d8d |
| WASH-292 | 用户本轮 | 实收弹窗只提供可实收卷、实际数量及 GTG 库位 | 实收 | execution-dialog.ts | 专项 | Web/PDA | 已验证 | 同上 | 同上 |
| WASH-293 | 用户本轮 | 投入弹窗只选择已实收未投入的卷 | 投入 | execution-dialog.ts | 专项 | Web/PDA | 已验证 | 同上 | 同上 |
| WASH-294 | 用户本轮 | 产出弹窗只提供实际数量与可选重包卷码 | 产出 | execution-dialog.ts | 专项 | Web/PDA | 已验证 | 同上 | 同上 |
| WASH-295 | 用户本轮 | 交回弹窗只核对可交出卷码及原接收方 | 交回 | execution-dialog.ts | 专项 | Web/PDA | 已验证 | 同上 | 同上 |
| WASH-296 | 常驻输入移除 | 印花交出和下游实收分别按需办理 | 相邻操作 | execution-dialog.ts/work-orders.ts | 专项 | 原工厂与中央仓 | 已验证 | 同上 | 同上 |
| WASH-297 | 保留规则 | 各动作只包含当前可操作卷，保留差异与唯一卷码校验 | 规则 | washingExecutionRolls/washingExecutionCommand | 单测/浏览器 | 混合阶段、部分卷 | 已验证 | 同上 | 同上 |
| WASH-298 | STORE-02 | 取消不保存，失败保留输入，重试不重复写入 | 保存 | openWashingExecutionDialog/save | 原生回读/中止 | 不更改事务归属 | 已验证 | 同上 | 同上 |
| WASH-299 | UI-01 | 弹窗局部更新，键盘关闭/焦点和小屏滚动可用 | 交互 | openWashingExecutionDialog | 浏览器 | 三种 Web/PDA | 已验证 | 同上 | 同上 |
| WASH-300 | 直接影响 | 保存后的状态、日志、交接、打印和上下游一致 | 相邻消费 | work-orders.ts/refresh | 浏览器回读 | 打印 renderer 未变 | 已验证 | 同上 | 同上 |
| WASH-301 | PERF-01 | 所有受影响响应家族完整响应不超过 1 秒 | 性能 | scripts/check-washing-detail-tabs.mjs/measure | 五次/家族 | 固定产物 | 已验证 | 同上 | 同上 |
| WASH-302 | 交付 | 复核最终任务差异并登记技术收据输出位置 | 验证 | 记录及收据 | 治理/构建 | 不提交不发布 | 已验证 | 同上 | 同上 |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 按操作输入、状态和数量 | 通过 | 六个动作独立表单、6 卷范围及部分卷操作、差异和唯一卷码校验通过；新增 4 项单测通过，formal 报告 29 项通过。 |
| Web/PDA、图片和打印 | 通过 | Web 1366×768、1280×720、1024×768 和 PDA 390×844；图片大图/关闭、键盘、焦点、滚动和固定页脚可用。打印及上下游的 47 个诊断样本回放通过。 |
| 持久回读和恢复 | 通过 | 原生 IndexedDB 回读确认取消不写、事务中止无半套、失败表单保留、真实重试仅一次；双标签冲突不覆盖对方，重开读取最新可操作卷。 |
| 性能 | 通过 | 37 个受影响响应家族各 5 次，共 185 样本，最大 397ms，超时 0、页面异常 0。 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/dyeing/washing/work-orders.ts`
- `src/pages/process-factory/dyeing/washing/execution-dialog.ts`

### 页面证据

- 版本：codex/post-print-fabric-washing，HEAD 565dee4dcd6772b8054b0fd1757ee757360a5c24；工作树 /Users/laoer/.codex/worktrees/a266/higoods；固定预览 http://127.0.0.1:43161；运行产物 output/washing-execution-dialogs/dist；16 个运行依赖及验证文件组合摘要 c8e41ecd6d8dd1ebae9a25af01feed084896735b2d426c21cbacda4bcc1a71b7，见 source-manifest.json。本轮不提交或发布。
- 证据：[本轮证据目录](../verification-evidence/2026-10-16-washing-execution-dialogs/)，final-report.json、raw-samples.jsonl、direct-upstream-downstream-report.json；5 张人工 Web 截图和 4 张 PDA 实际界面截图。路由为 /fcs/craft/dyeing/washing/work-orders/:id 和 /fcs/pda/washing/:id。页面图片为原洗水来源面料 FAB-P200-BLUE-FLORAL 的正式对应图；物料、原去向和卷码由同一保存记录读回。

### 性能结论

- 结论：通过
- 依据：final-report.json；37 个家族各 5 个完整响应样本，共 185 个，最大 397ms。六卷订单共 300 Yard；Web 与 PDA 打开/保存分别采样，原中央仓接收单列。取消、放弃填写、继续、字段变化、错码、业务拒绝、事务中止、重试与并发冲突分别有适用家族。起点为真实原生输入事件/导航；终点包含正确界面、必要图片、字体、两帧绘制，保存还包含持久回读。环境、资源快照、源码和 1179 个固定产物哈希由报告保存。

### 验证命令

- `node --import tsx --test tests/unit/washing-execution-dialog.test.ts`：通过
- `npm exec vite -- build --outDir output/washing-execution-dialogs/dist`：通过
- `WASH_TAB_RUNS=5 WASH_TAB_FORMAL=1 WASH_TAB_OUT=output/playwright/washing-execution-dialogs/formal WASH_RUNTIME_ASSETS=output/washing-execution-dialogs/runtime-assets.json WASH_BASE_URL=http://127.0.0.1:43161 node scripts/check-washing-detail-tabs.mjs`：通过
- `WASH_UI_RUNS=1 WASH_UI_SECTION=main WASH_UI_OUT=output/playwright/washing-execution-dialogs/direct-upstream-downstream WASH_RUNTIME_ASSETS=output/washing-execution-dialogs/runtime-assets.json WASH_BASE_URL=http://127.0.0.1:43161 node scripts/check-washing-gtg-ui.mjs`：通过
- `git diff --check`：通过

### 例外

- 无。本轮结果不得沿用上一轮常驻表单的页面/性能通过标识。

最终技术收据在文件冻结后输出到 `output/washing-execution-dialogs/task-receipt.json`。


## 最终差异复核及证据复用

主代理正向核对六个操作的字段、可操作卷和提交命令：投入无数量/库位/扫码；两类实收只提供当前接收方库位；交出只核对对应原卷或重包卷码，去向只读。反向复核没有常驻旧字段、全局扫码集合或旧执行提交分支。弹窗通过局部槽位挂载，原生 dialog 负责焦点封闭，滚动仅在内容区；复用现有按钮和物料图片，不扩大公共 Dialog 组件接口。保存失败保留输入及操作标识；保存中按钮/输入禁用；预先读取的单据版本失效时明确不保存，不覆盖他人结果。

浏览器首次校准暴露的是采集器的事件时序和异步提示等待问题：捕获阶段微任务先于目标处理器，无法据此观察保存中状态；改用目标对话框 aria-busy 变更观察；唯一卷码拒绝也需等实际持久读取返回后再断言。校准语法问题及原始日志保留，未据此改写业务规则。正式批次在最小校准通过、最终产物固定之后运行，当前 185 个样本没有有效超时。

直接上下游回放通过：印花操作栏创建三张单、两种手感分单、固定 GTG、来源日志/新窗口、技术包及生产快照的实际路线、原接收工厂和中央仓两条 50→49→49 Yard 闭环、人工完单及两种打印预览。该一次功能回放的 47 个诊断样本不冒充每家族五次的正式性能门禁。

领域、事务归属、备份/迁移及打印渲染器未改；复用上一已发布版本 565dee4d 的相应原始契约证据，保留其历史身份。本轮重新验证改变的输入采集/保存链、原生持久回读、失败/冲突以及直接消费者。完整工程技术门禁由冻结后收据执行，实际状态写入 output/washing-execution-dialogs/delivery.json，不回写本绑定记录。
