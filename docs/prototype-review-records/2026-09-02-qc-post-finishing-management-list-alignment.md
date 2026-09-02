# QC 后道管理列表线上基线对齐原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-02 |
| 相关需求 / 任务 | TASK-001～TASK-006、QC-001～QC-006、POST-001～POST-005、RECHECK-001～RECHECK-004、IMAGE-001、DENSITY-001～DENSITY-002、AUTH-001、PRINT-001、FLOW-001、GOV-001～GOV-002 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS / PFOS |
| 涉及页面路径 | `/fcs/craft/post-finishing/tasks`、`/qc-orders`、`/work-orders`、`/recheck-orders`、`/authorization-code`、`/print` |
| 端类型 | 管理端 / 主管端；关联员工执行 PDA |
| 主要角色与任务 | 管理人员统计、搜索、查看和打印；质检员精确领取；主管释放；后道/复检现场继续 PDA 优先、Web 兜底 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：四张页面的筛选区、统计卡、字段、分页和操作区重排；“质检任务”更名为“质检单”；新增可操作的 SKU 重量弹窗及质检单、质检详情单打印；后道单增加任务流转卡并明确 PDA/Web 分工；本轮进一步移除重复列表标题栏、压缩固定列宽，并把操作入口改为最多三行的双列网格；补齐“我的动态授权码”的钥匙图标渲染。业务字段、动作、状态、数量来源、菜单顺序、路由和生成顺序未变化。

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
| 命名路由、交互、图片大图与打印 | 通过 | 四张命名列表、SKU重量保存、复检详情及三类具体打印页面均已本地打开；动态授权码菜单已实测渲染 `key-round` SVG。 |
| 首屏信息密度 | 通过 | 1366×768、侧栏展开、表格未横向滚动时，四页分别完整显示 5 / 5 / 5 / 6 个数据列及固定操作列；操作区分别为 3 / 2 / 2 / 1 行。 |

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
| 固定列宽和操作列过宽导致首屏字段过少 | 字段过载 | 管理人员 | 四页按内容压缩标识、数量、时间和操作列，操作入口用双列网格换行 | 否 |
| 页面主标题下重复显示“××列表” | 字段过载 | 管理人员 | 标准列表在无二级动作时不再渲染重复标题栏 | 否 |
| “我的动态授权码”菜单配置了图标名但页面不显示 | 组件误用 | 指定授权人 | 将 `KeyRound` 纳入侧栏按需图标包，保留原菜单名称、位置和路由 | 否 |

## 6. 最终结论

结论：有条件通过

说明：

- 页面结构和交互已按线上基线完成本地验收，流程仍由待加工仓送检生成质检单。
- 条件仅指真实管理账号权限、生产数据、现场 PDA、打印机、扫码枪和弱网未由本地 Mock 验收替代。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/ui/list-page.ts`
- `src/data/app-shell-config.ts`
- `src/icons/shell-icons.ts`
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
- `/fcs/craft/post-finishing/authorization-code`
- `/fcs/craft/post-finishing/recheck-orders?id=PF-RC-PF-ACCEPT-PO-2-5`
- `/fcs/craft/post-finishing/print?type=QC_ORDER&id=PF-QC-PF-ACCEPT-PO-1-5`
- `/fcs/craft/post-finishing/print?type=QC_DETAIL&id=PF-QC-PF-ACCEPT-PO-1-5`
- `/fcs/craft/post-finishing/print?type=POST_ORDER&id=PF-POST-PF-ACCEPT-PO-1-5`

### 验证命令

- `npm run check:post-finishing-management-list-alignment`：通过
- `node --import tsx --input-type=module -e <KeyRound 图标包专项断言>`：通过
- `npm run check:post-finishing-web-pda-fallback`：通过
- `node --import tsx scripts/check-post-finishing-qc-result-buckets.ts`：通过
- `node --import tsx scripts/check-post-finishing-factory-detail-actions.ts`：通过
- `node --import tsx scripts/check-post-finishing-full-flow-surface.ts`：通过
- `npm run check:list-page-governance`：通过（378 张页面、17 个历史基线；Chromium 列拖拽、标准模板与全量原型治理子项通过）
- `npm run check:prototype-design-governance -- --all`：通过（本次独立发布差异涉及 5 个用户可见文件、0 个仅技术文件、1 份关联记录）
- `npm run check:post-finishing-full-flow`：通过（3 个生产单 × 5 个 SKU × 5 次回货，共 15 条业务链）
- `npm run check:post-finishing-default-demo`：通过（3 个生产单、15 次回货、75 条 SKU 明细）
- `npm run check:process-factory-tabs-and-post-finishing`：通过
- `npm run build`：通过（当前版本）
- `codegraph sync && codegraph status`：通过（独立发布工作树；1577 个文件、48490 个节点、189166 条边，无待同步文件）
- `npm run workflow:verify -- --output /private/tmp/higoods-main-publish-4JTE6l/qc-post-finishing-management-density-icon-task-receipt.json --task-boundary "QC后道四张管理列表首屏密度优化与我的动态授权码图标补齐"`：通过，状态 `verified`，无阻断项

### 浏览器证据

- 后道任务及重量保存：`.playwright-cli/page-2026-09-02T06-59-36-300Z.yml`；截图 `.playwright-cli/page-2026-09-02T07-00-06-499Z.png`。
- 质检单：`.playwright-cli/page-2026-09-02T07-00-26-954Z.yml`；截图 `.playwright-cli/page-2026-09-02T07-00-35-042Z.png`。
- 后道单：`.playwright-cli/page-2026-09-02T07-00-56-720Z.yml`；截图 `.playwright-cli/page-2026-09-02T07-01-02-992Z.png`。
- 复检单：`.playwright-cli/page-2026-09-02T07-01-38-209Z.png`；详情 `.playwright-cli/page-2026-09-02T07-02-43-178Z.yml`。
- 质检单打印：`.playwright-cli/page-2026-09-02T07-03-03-666Z.yml`；截图 `.playwright-cli/page-2026-09-02T07-03-13-378Z.png`。
- 质检详情单：`.playwright-cli/page-2026-09-02T07-03-28-384Z.yml`。
- 后道任务流转卡：`.playwright-cli/page-2026-09-02T07-04-12-526Z.yml` 后的同会话显式快照；标题、编号、加工项目和二维码已确认。
- 页面控制台：仅 React 开发提示，无 error/warning。

本轮首屏密度的当前发布工作树证据：

- 后道任务：`output/playwright/release-tasks-1366x768.png`、`.playwright-cli/page-2026-09-02T09-31-59-294Z.yml`；未横向滚动时完整显示 8 个数据列及固定操作列，6 个动作分 3 行。
- 质检单：`output/playwright/release-qc-orders-1366x768.png`、`.playwright-cli/page-2026-09-02T09-31-19-975Z.yml`；完整显示 7 个数据列及固定操作列，4 个动作分 2 行。
- 后道单：`.playwright-cli/page-2026-09-02T09-34-55-749Z.yml`；完整显示 7 个数据列及固定操作列，4 个动作分 2 行。
- 复检单：`.playwright-cli/page-2026-09-02T09-36-32-451Z.yml`；完整显示 7 个数据列及固定操作列，当前首行 1 个动作占 1 行。
- 四页均为 1366×768、侧栏展开、表格 `scrollLeft=0`；重复列表标题栏不存在，页面主体无横向溢出，控制台累计 0 error、0 warning。
- 后道单与复检单已完成 DOM、列边界、操作行数和控制台验证，但 Playwright 截图导出分别在 5 秒与 30 秒超时；因此本轮保留两页结构化快照，不把未生成的图片列为证据。

本轮动态授权码菜单图标的当前证据：

- 浏览器 DOM：1366×768 下“我的动态授权码”菜单行存在 `svg[data-lucide="key-round"]`，尺寸 24×24；页面控制台 0 error、0 warning。

### 真实图片验证

- 图片来源：现有 QC 后道 3 个生产单 × 5 个 SKU 的稳定 Mock 图片资源，本轮不以占位图替换。
- 对象对应：四张列表、详情和打印按具体 SKU 读取同一 `image` 字段，图片与 SKU / 颜色 / 尺码同块展示。
- 缩略图和大图：列表缩略图可点击，继续复用全局大图弹窗及 `Esc` 关闭能力。
- 加载与失败：继续使用既有 `data-image-loading`、`data-image-error` 状态；本轮未删除。

### 例外

- 真实管理账号权限、线上生产数据、实体打印机、现场 PDA、扫码枪和弱网未运行，不能把本记录表述为线上或现场验收回执。
