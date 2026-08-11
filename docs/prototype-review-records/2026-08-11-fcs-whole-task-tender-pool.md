# FCS 整任务竞价、工厂池与 PDA 报价闭环原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-11 |
| 相关需求 / 任务 | 业务任务整任务竞价、冻结候选工厂池、PDA 邀请/报价、定标、取消重发及关联 Mock 数据清洁 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/dispatch/workbench`、`/fcs/pda/notify`、`/fcs/pda/task-receive`、`/fcs/dispatch/tenders` |
| 端类型 | 管理端、员工执行端 PDA |
| 主要角色与任务 | 生产计划员发起整任务竞价；候选工厂 PDA 管理员报价；平台定标员定标或取消 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：任务分配的竞价弹窗由 SKU 选择调整为完整任务只读范围，新增全部/手动候选工厂池；PDA 新增由共享招标事实投影的待报价待办和整任务报价；招标管理移除本地新建入口，新增共享报价定标、价格二次确认、取消二次确认和历史状态。补充清洁会改变 PDA 演示中可见的烫包截止标签和固定车缝已中标任务身份。直接派单与改派仅做回归，没有改变其既有可见规则。

审查使用当前项目基线：`AGENTS.md` 第 4、5、7 节。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端负责发起/定标/取消；PDA 只负责本工厂查看和报价；每端主动作明确 |
| 文案、状态、数量与单位 | 通过 | 明确“整个任务”、SKU 数、件数、IDR/件、五种招标状态；没有向现场暴露技术状态码 |
| 扫码、真实图片与对象识别 | 通过 | 本次竞价和 PDA 报价不新增款式/物料图片结构；任务号、招标单号、生产单号、工厂身份足以防止选错；不适用扫码 |
| 防错、危险确认与主管兜底 | 通过 | 非池工厂、重复/越界/过期报价、未报价定标、价格篡改均阻断；定标和取消都有二次确认 |
| 交接、跨端事实与异常追溯 | 通过 | Web 发起、PDA 待办/报价和 Web 定标读取同一招标记录；取消、报价和定标均保留事实 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 1366×768 管理端和现有 PDA 页面通过；本仓库为原型，不实现真实弱网队列，失败以即时错误提示和重试操作处理 |
| 命名路由、交互、图片大图与打印 | 通过 | 四个命名路由已回放；合同模板未修改，打印沿用既有专项 |

## 4. 问题标签

- 无。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 竞价沿用直接派单 SKU 勾选，范围含糊 | 选不对 | 生产计划员、工厂 | 改为完整任务只读快照，不渲染 SKU 勾选 | 否 |
| 没有明确工厂池和池外权限 | 协作断裂 | 生产计划员、工厂 | 新增完整资格集合与手动筛选，发起后冻结，PDA/报价双重校验成员 | 否 |
| Web 招标与 PDA 报价可能读取不同事实 | 追溯不足 | 工厂、定标员 | 统一为共享招标记录，由 PDA 待办、报价、管理列表共同投影 | 否 |
| 取消后旧记录会被覆盖且任务不能重发 | 追溯不足 | 定标员、生产计划员 | 按招标单号保存历史，任务回待分配，新竞价生成唯一编号 | 否 |
| 烫包演示使用不存在的工序键，缺少“即将逾期”样例 | 看不懂 | 工厂 PDA 用户 | 使用真实 `IRON_PACK` 业务键生成烫包待接单截止 | 否 |
| 固定车缝已中标演示引用特殊工艺源任务 | 对不上 | 工厂 PDA 用户、测试人员 | 改为按生产单、整任务和独立车缝语义选源 | 否 |

## 6. 最终结论

结论：通过

说明：整任务竞价、候选工厂池、PDA 报价、定标、取消重发、合同/回货衔接和直接派单回归均有当前版本专项或命名页面证据；治理、构建、CodeGraph 和任务收据均通过，任务收据状态为 `verified`、阻塞项为 0。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/runtime-task-tenders.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/pda-task-mock-factory.ts`
- `src/data/fcs/factory-mobile-todos.ts`
- `src/data/fcs/factory-mobile-todo-routes.ts`
- `src/data/fcs/pda-mobile-mock.ts`
- `src/data/fcs/pda-receive-scope.ts`
- `src/data/fcs/process-tasks.ts`
- `src/pages/unified-dispatch-workbench.ts`
- `src/pages/pda-notify.ts`
- `src/pages/pda-notify-due-soon.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/dispatch-tenders.ts`
- `src/pages/progress-board/context.ts`

### 页面路由

- `/fcs/dispatch/workbench`
- `/fcs/pda/notify`
- `/fcs/pda/task-receive`
- `/fcs/dispatch/tenders`

### 验证命令

- `npm run check:fcs-whole-task-tender-pool`：通过。
- `npm run check:fcs-sewing-preparation-return-preview`：通过。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43315 npx playwright test tests/pda-receive-mock-deadline-status.spec.ts tests/pda-task-receive-pending-accept.spec.ts tests/fcs-unified-dispatch-preparation-return-preview.spec.ts --workers=1 --reporter=line`：通过（5/5），且无 Node 26 `module.register()` 提示。
- `npm run build`：通过，2,338 个模块；无 `caniuse-lite` 数据过期和 Node 26 `module.register()` 提示。
- `npm run check:fcs-unified-assignment-foundation`：通过。
- `npm run check:fcs-dispatch-bagging`：通过。
- `npm run check:production-contract-template-fidelity`：通过。
- `npm run check:pda-task-receive-scope`：通过。
- `npm run check:pda-receive-mock-deadline-status`：通过；车缝为“正常”，烫包为“即将逾期”。
- `npm run check:sewing-awarded-pda-seed`：通过；固定演示来自独立车缝整任务并完成 PDA 接单写回。
- `npm run check:sewing-reassignment-cold-start`：通过。
- `npm run check:prototype-design-governance -- --all`：通过（14 个用户可见受管文件、1 份完整审查记录）。
- `npm run check:list-page-governance`：通过（扫描 355 个列表页，Chromium 列拖拽场景通过）。
- `codegraph sync`：通过（索引已经是最新，无待同步文件）。
- `npm run workflow:verify -- --output /private/tmp/higoods-fcs-whole-task-tender-receipt.json --task-boundary \"FCS 整任务竞价闭环、构建工具链与 Mock 数据清洁\"`：通过（状态 `verified`，阻塞项 0）。

### 命名页面证据

- `/private/tmp/higoods-fcs-prep-return-evidence/whole-task-tender-factory-pool.png`
- `/private/tmp/higoods-fcs-prep-return-evidence/whole-task-tender-pda-todo.png`
- `/private/tmp/higoods-fcs-prep-return-evidence/whole-task-tender-pda-quote.png`
- `/private/tmp/higoods-fcs-prep-return-evidence/tender-award-second-confirm.png`
- `/private/tmp/higoods-fcs-prep-return-evidence/whole-task-tender-cancel-second-confirm.png`
- `/private/tmp/higoods-fcs-prep-return-evidence/direct-second-confirm.png`
- `/private/tmp/higoods-fcs-prep-return-evidence/reassignment-readonly-scope.png`

### 真实图片验证

- 本次新增的竞价工厂池、PDA 报价、定标和取消页面不展示款式或物料图片，不适用新增图片门禁。
- 相邻直接派单回归继续验证生产单车缝辅料 4 张对应物料图、高清大图和 `Esc` 关闭，证据属于同一 Playwright 命名测试第 1 场景。

### 例外

- 原型范围不实现真实后端推送、弱网离线队列或自动重试；PDA 待办由同一页面运行时共享事实投影。该例外不改变工厂池权限、整任务范围和一次报价业务规则。

### 补充清洁结论

- 按仓库锁文件恢复 Vite、Tailwind、tsx 和浏览器数据依赖后，生产构建不再输出两项目标警告；另将 Playwright 由 1.58.2 升级到 1.61.1，清除 Node 26 命名页面测试中的 `module.register()` 提示。`package.json` 与 `package-lock.json` 只保留该测试工具版本升级的预期差异。
- 烫包截止演示和固定车缝中标演示均已修正，并由各自专项契约直接验证。
