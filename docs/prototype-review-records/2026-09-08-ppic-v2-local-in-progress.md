# PPIC V2 本地实施审查记录（第四轮核查）

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| 记录日期 | 2026-09-08 |
| 相关需求 / 任务 | PPIC完整调整方案V2.0、业务理解V1.9及2026-09-08现场反馈；150条见需求矩阵 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS、PCS、WLS、PDA上下游 |
| 涉及页面路径 | /fcs/dispatch/workbench；/fcs/sewing-outsourcing/各命名页面 |
| 端类型 | 管理端、主管端、员工执行端 |
| 主要角色与任务 | PPIC跟进、仓库交出、工厂执行、批版和后道确认 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：分配三态与门禁、参考齐套、回货主集及计时、批版48小时、移除历史审计入口、新耗时页面与导出、10张连续节点Mock、3列来源明细、同一裁片放行单内多次放行、领料单版本及PDA扫码回写。
- 当前基线：AGENTS.md 第4节、第5节、第7节。未读取历史长文档，未使用Superpowers。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
|---|---|---|
| 角色、任务与页面模式 | 通过 | 普通PPIC固定本人视角；负责人团队视角独立；三类任务名称和一厂一执行任务一致 |
| 文案、状态、数量与单位 | 通过 | 严格齐套、参考应回、最终应回、后道确认回货及片/件单位分层通过正反向验证 |
| 扫码、真实图片与对象识别 | 通过 | 任务页10条款式图均加载；领料单款式/物料图、二维码、旧码失效和当前码识别通过 |
| 防错、危险确认与主管兜底 | 通过 | 缺门禁逐项阻断；PPIC不能代交出仓确认；重复扫码幂等；旧版本禁止登记 |
| 交接、跨端事实与异常追溯 | 通过 | 裁床提交不代替工厂接收/开工；PDA实交写既有裁片/物料事实源并可刷新回看 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768下10个路由首次进入/重开均通过；耗时页10张生产单仍在性能门限内；PDA分批与刷新持久化通过 |
| 命名路由、交互、图片大图与打印 | 通过 | 9个业务入口、耗时来源3列表格、同一裁片放行单的多次放行记录、A4领料单V2、查询/重置/导出与大图均通过；导出后不再追加页面提示 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
|---|---|---|---|---|
| 来源明细从长段卡片改成8列后仍然复杂 | 读不懂 | PPIC | 最终收敛为单据号、开始时间、结束时间3列，并直接标记“取用为节点开始／结束” | 否 |
| 耗时页只有2张生产单且节点数据断层 | 场景不真实 | PPIC | 增加到10张递进生产单，覆盖全部10个节点；自动阻断下游越过未完成前置节点的Mock | 否 |
| 裁片放行Mock把同一张放行单的多次放行错误生成成多个单据号 | 对象关系错误 | PPIC | 对照业务理解§15.3.3、§22.14及裁片放行矩阵版本仓库，固定同一生产单只有一个放行单号；以多行展示V1/V2/V3、本次数量和累计变化，并补充回归测试 | 否 |
| 导出后在表格下方追加蓝色成功文案 | 页面噪音 | PPIC | 删除页面反馈区域及写入逻辑，下载行为保留 | 否 |
| 后道来源任务曾显示“仅车缝” | 状态抽象 | PPIC | 统一使用独立车缝、车缝+烫包、裁剪+车缝+烫包三类名称 | 否 |
| 旧准备预览契约仍把起算周周日计入 | 算不准 | PPIC | 同步为仅跳过起算事件所在自然周周日，并补充全星期起点单元测试 | 否 |

## 6. 最终结论

结论：通过

150条矩阵中142条达到已验证，8条范围边界明确为不适用。当前状态为本地 `verified`；未提交、未推送、未发布，不表述为 `delivered` 或 `accepted`。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/effective-task-assignments.ts`
- `src/data/fcs/production-return-fulfillment.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/runtime-task-read-bridge.ts`
- `src/data/fcs/sewing-assignment-readiness.ts`
- `src/data/fcs/sewing-cut-piece-responsibility.ts`
- `src/data/fcs/sewing-cut-piece-return-workflow.ts`
- `src/data/fcs/sewing-delivery-sla.ts`
- `src/data/fcs/sewing-material-handover.ts`
- `src/data/fcs/sewing-outsourcing-demo.ts`
- `src/data/fcs/sewing-outsourcing-migration-audit.ts`
- `src/data/fcs/sewing-outsourcing-return-tracking.ts`
- `src/data/fcs/sewing-outsourcing-workbench.ts`
- `src/data/fcs/sewing-pickup-slips.ts`
- `src/data/fcs/sewing-production-order-duration.ts`
- `src/data/fcs/sewing-return-calendar.ts`
- `src/data/fcs/sewing-sample-approval-suggestion.ts`
- `src/data/fcs/task-fulfillment-policy.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/pages/pda-handover.ts`
- `src/pages/print/templates/material-slip-template.ts`
- `src/pages/sewing-outsourcing/cut-piece-handover.ts`
- `src/pages/sewing-outsourcing/cut-piece-returns.ts`
- `src/pages/sewing-outsourcing/migration-audit.ts`
- `src/pages/sewing-outsourcing/production-order-duration.ts`
- `src/pages/sewing-outsourcing/returns.ts`
- `src/pages/sewing-outsourcing/sample-approval-suggestions.ts`
- `src/pages/sewing-outsourcing/tasks.ts`
- `src/pages/unified-dispatch-workbench.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes.ts`

### 页面路由

- `/fcs/dispatch/workbench`
- `/fcs/sewing-outsourcing/tasks`
- `/fcs/sewing-outsourcing/cut-piece-handover`
- `/fcs/sewing-outsourcing/sample-approval-suggestions`
- `/fcs/sewing-outsourcing/returns`
- `/fcs/sewing-outsourcing/cut-piece-returns`
- `/fcs/sewing-outsourcing/production-order-duration`

### 验证命令

- `npm run build`：通过（最终实质修改后重跑完成）。
- `npm run test:unit`：通过（22项，含Mock节点连续性、时间顺序及“一张放行单内多次放行”约束）。
- `VERIFICATION_DIRECTION=forward/reverse node --import tsx scripts/check-sewing-outsourcing-verification-pass.ts`：通过；正向28项、反向28项全部通过。
- `node --import tsx scripts/check-sewing-outsourcing-full-flow-data.ts`：通过，12步。
- `node --import tsx scripts/check-sewing-cut-piece-responsibility.ts`：通过。
- `node --import tsx scripts/check-sewing-cut-piece-handover-page.ts`：通过。
- `node --import tsx scripts/check-sewing-outsourcing-migration-audit.ts`：通过；业务入口移除，开发审计保留历史未匹配记录。
- `npm run check:list-page-governance:static`：通过。
- `npm run check:prototype-design-governance`：通过（默认暂存区无受管变化）。
- `npm run check:list-page-governance`：通过；含全工作区原型治理，覆盖34个用户可见文件和1份审查记录。
- `npx playwright test tests/sewing-outsourcing-production-performance.spec.ts --workers=1 --reporter=line`：通过；10个可见路由均完成首次进入和重开，耗时页770ms/708ms。
- `codegraph sync`：通过；最终同步已执行，status无待同步文件。
- `npm run workflow:verify -- --output /private/tmp/ppic-v2-fourth-review/task-receipt.json --task-boundary "PPIC V2第四轮核查：裁片放行一单多次放行、耗时来源明细及Mock连续性"`：通过。
- 浏览器：通过。耗时页显示10张连续节点生产单；完整场景从面辅料采购至100%回货无断层；来源明细仅保留单据号、开始时间、结束时间，并分别标记节点取用的起止来源；`PO-202609-0102`的裁片放行只显示一个单据号`REL-0102`，以V1/V2/V3三行展示400、300、300件及累计0→400→700→1000件，第一次放行取节点开始，第三次首次达标取节点结束；页面不存在导出成功提示。工作树服务5175，基线HEAD 8d8f8ffd43d1000d9c852a1cffbb4c73e16bee12，分支codex/ppic-adjustment-20260908。

### 真实图片验证

- 图片来自技术包、后道SKU与现有业务资料，不补通用占位图。
- 任务页当前10条款式图及耗时页10条款式图均完成加载；耗时页复用对应款式的正式图片，缩略图与对象同单元格，大图入口保留。
- 领料单打印包含对应款式图；面/辅料明细使用技术包正式物料图，缺图时在打印前明确阻断。

### 例外

- 无。
