# QC 后道管理列表线上基线对齐原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-02 |
| 相关需求 / 任务 | TASK-001～GOV-002；四张 QC 后道管理列表按线上基线对齐 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS / PFOS |
| 涉及页面路径 | `/fcs/craft/post-finishing/tasks`、`/qc-orders`、`/work-orders`、`/recheck-orders`、`/print` |
| 端类型 | 管理端 / 主管端；关联员工执行 PDA |
| 主要角色与任务 | 管理人员统计、搜索、查看和打印；质检员精确领取；主管释放；后道/复检现场继续 PDA 优先、Web 兜底 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：四张页面的筛选区、统计卡、字段、分页和操作区重排；“质检任务”更名为“质检单”；新增可操作的 SKU 重量弹窗及质检单、质检详情单打印；后道单增加任务流转卡并明确 PDA/Web 分工。业务状态、数量来源和生成顺序未变化。

审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、标准列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 四页为管理端标准列表；质检员仍精确领取，后道/复检现场仍 PDA 优先。 |
| 文案、状态、数量与单位 | 通过 | 用户可见“质检单”统一；数量均带“件”，重量带“kg/件”；状态来自既有事实。 |
| 扫码、真实图片与对象识别 | 通过 | 列表图片与 SPU/SKU、颜色尺码同块；PDA/扫码路径未删除。 |
| 防错、危险确认与主管兜底 | 通过 | 不提供手工创建质检单；质检/复检主管释放保留；后道 Web 接管仍走既有门禁。 |
| 交接、跨端事实与异常追溯 | 通过 | 四页继续读取共享业务链；后道列表保留查看全流程，打印不推进状态。 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 本轮以 1366×768 桌面列表验收；未改 PDA 输入、弱网或上传能力，真实设备仍需现场验证。 |
| 命名路由、交互、图片大图与打印 | 通过 | 四张命名列表、SKU重量保存、复检详情及三类具体打印页面均已本地打开。 |

## 4. 问题标签

- `字段过载`
- `协作断裂`
- `组件误用`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 原型列表与线上字段、筛选和统计差距大 | 字段过载 / 组件误用 | 管理人员 | 四页使用标准列表组件并按线上字段分组 | 否 |
| 后道任务丢失 SKU 重量与质检查看/打印 | 协作断裂 | 管理人员 | 恢复重量弹窗、查看及两类打印入口 | 否 |
| “质检任务”与线上“质检单”命名不一致 | 读不懂 | 质检员 / 管理人员 | 菜单、页面和相关用户文案统一为质检单 | 否 |
| 直接照搬创建按钮可能绕过送检流程 | 点错风险 | 管理人员 | 不实现手工创建；“生成质检单”回到待加工仓送检 | 否 |
| 后道单只有 PDA 或只有 Web 都无法兜底 | 协作断裂 | 后道操作员 / 管理人员 | 列表同时保留 PDA 优先、Web 详情、打印和追溯 | 否 |

## 6. 最终结论

结论：有条件通过

说明：

- 页面结构和交互已按线上基线完成本地验收，流程仍由待加工仓送检生成质检单。
- 条件仅指真实管理账号权限、生产数据、现场 PDA、打印机、扫码枪和弱网未由本地 Mock 验收替代。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/pages/process-factory/post-finishing/tasks.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/process-factory/post-finishing/work-orders.ts`
- `src/pages/process-factory/post-finishing/recheck-orders.ts`
- `src/pages/process-factory/post-finishing/full-flow-print.ts`
- `src/pages/process-factory/post-finishing/qc-workbench.ts`
- `src/pages/process-factory/post-finishing/warehouse.ts`
- `src/pages/process-factory/post-finishing/work-order-detail.ts`
- `src/pages/process-factory/post-finishing/audit-records.ts`
- `src/pages/process-factory/post-finishing/outbound-orders.ts`
- `src/pages/process-factory/post-finishing/statistics.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-quality.ts`
- `src/pages/print/templates/post-finishing-qc-print-template.ts`

### 页面路由

- `/fcs/craft/post-finishing/tasks`
- `/fcs/craft/post-finishing/qc-orders`
- `/fcs/craft/post-finishing/work-orders`
- `/fcs/craft/post-finishing/recheck-orders`
- `/fcs/craft/post-finishing/recheck-orders?id=PF-RC-PF-ACCEPT-PO-2-5`
- `/fcs/craft/post-finishing/print?type=QC_ORDER&id=PF-QC-PF-ACCEPT-PO-1-5`
- `/fcs/craft/post-finishing/print?type=QC_DETAIL&id=PF-QC-PF-ACCEPT-PO-1-5`
- `/fcs/craft/post-finishing/print?type=POST_ORDER&id=PF-POST-PF-ACCEPT-PO-1-5`

### 验证命令

- `npm run check:post-finishing-management-list-alignment`：通过
- `npm run check:post-finishing-web-pda-fallback`：通过
- `node --import tsx scripts/check-post-finishing-qc-result-buckets.ts`：通过
- `node --import tsx scripts/check-post-finishing-factory-detail-actions.ts`：通过
- `node --import tsx scripts/check-post-finishing-full-flow-surface.ts`：通过
- `npm run check:list-page-governance`：通过（378 张页面、17 个历史基线；Chromium 列拖拽与原型治理子项通过）
- `npm run check:prototype-design-governance -- --all`：通过（21 个用户可见文件，0 个仅技术文件，2 份关联记录）
- `npm run check:post-finishing-full-flow`：通过（3 个生产单 × 5 个 SKU × 5 次回货，共 15 条业务链）
- `npm run check:post-finishing-default-demo`：通过（3 个生产单、15 次回货、75 条 SKU 明细）
- `npm run check:process-factory-tabs-and-post-finishing`：通过
- `npm run build`：通过（2394 个模块）
- `codegraph sync && codegraph status`：通过（1577 个文件、48487 个节点、168919 条边，无待同步文件）
- `npm run workflow:verify -- --output /private/tmp/qc-post-finishing-management-list-alignment-task-receipt.json --task-boundary <scope>`：通过，状态 `verified`，无阻断项

### 浏览器证据

- 后道任务及重量保存：`.playwright-cli/page-2026-09-02T06-59-36-300Z.yml`；截图 `.playwright-cli/page-2026-09-02T07-00-06-499Z.png`。
- 质检单：`.playwright-cli/page-2026-09-02T07-00-26-954Z.yml`；截图 `.playwright-cli/page-2026-09-02T07-00-35-042Z.png`。
- 后道单：`.playwright-cli/page-2026-09-02T07-00-56-720Z.yml`；截图 `.playwright-cli/page-2026-09-02T07-01-02-992Z.png`。
- 复检单：`.playwright-cli/page-2026-09-02T07-01-38-209Z.png`；详情 `.playwright-cli/page-2026-09-02T07-02-43-178Z.yml`。
- 质检单打印：`.playwright-cli/page-2026-09-02T07-03-03-666Z.yml`；截图 `.playwright-cli/page-2026-09-02T07-03-13-378Z.png`。
- 质检详情单：`.playwright-cli/page-2026-09-02T07-03-28-384Z.yml`。
- 后道任务流转卡：`.playwright-cli/page-2026-09-02T07-04-12-526Z.yml` 后的同会话显式快照；标题、编号、加工项目和二维码已确认。
- 页面控制台：仅 React 开发提示，无 error/warning。

### 真实图片验证

- 图片来源：现有 QC 后道 3 个生产单 × 5 个 SKU 的稳定 Mock 图片资源，本轮不以占位图替换。
- 对象对应：四张列表、详情和打印按具体 SKU 读取同一 `image` 字段，图片与 SKU / 颜色 / 尺码同块展示。
- 缩略图和大图：列表缩略图可点击，继续复用全局大图弹窗及 `Esc` 关闭能力。
- 加载与失败：继续使用既有 `data-image-loading`、`data-image-error` 状态；本轮未删除。

### 例外

- 真实管理账号权限、线上生产数据、实体打印机、现场 PDA、扫码枪和弱网未运行，不能把本记录表述为线上或现场验收回执。
