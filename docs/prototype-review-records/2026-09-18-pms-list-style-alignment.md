# PMS 列表样式对齐（参照 FCS 染色加工单）原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-18 |
| 相关需求 / 任务 | 全部已迁移 PMS 页面样式参照 FCS「染色加工单」数据列表（`src/pages/process-factory/dyeing/work-orders.ts`）；参照实现 `src/pages/pms/material-reconciliations.ts` |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PMS |
| 涉及页面路径 | 33 条 PMS 路由中的列表页与工作台/看板（明细与弹窗统一按钮组件） |
| 端类型 | 管理端（1366×768 验收，1280×720 兜底） |
| 主要角色与任务 | 全部管理端角色：列表查询、统计阅读、批量与单据动作 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：统计卡组件、筛选卡外观、按钮组件与图标、列表标题计数、表格单元对齐、行选择表头与选择范围控件全部改为与染色加工单一致；`data-*` 动作名、文案与业务行为保持不变。

完整产品审查的当前基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 仅统一组件与视觉，未改变页面结构与任务流 |
| 文案、状态、数量与单位 | 通过 | 按钮文案、统计 label/value、数量单位原样保留 |
| 扫码、真实图片与对象识别 | 通过 | 本次不涉及图片对象 |
| 防错、危险确认与主管兜底 | 通过 | armed 二次确认与禁用逻辑保留；共享按钮仅替换外观 |
| 交接、跨端事实与异常追溯 | 通过 | 动作名/日志不变；选择范围新增 page/all/clear 不改变后端事实 |
| 低分辨率、PDA、弱网与上传恢复 | 部分通过 | 1366 功能验收通过；冷启动性能证据受主机负载阻塞（见 §7） |
| 命名路由、交互、图片大图与打印 | 通过 | 路由与打印能力不变 |

## 4. 问题标签

- `样式不统一`（已处理：25 个列表页统一到染色加工单组件语言）

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 统计卡使用 renderStandardListStats，与参照页 renderProcessOrderStats 不一致 | 样式不统一 | 全部 | 全部列表页/工作台/看板替换为 renderProcessOrderStats | 否 |
| 筛选动作行手写按钮、无图标、筛选卡底色不同 | 样式不统一 | 全部 | 统一 renderPrimaryButton/renderSecondaryButton + lucide 图标，筛选卡 bg-white | 否 |
| 列表标题为静态“XX列表”，参照页为“共 N 条（· 已选 M 条）” | 样式不统一 | 全部 | 统一计数标题并随选择局部同步 | 否 |
| 表格单元未统一顶部对齐 | 样式不统一 | 全部 | 统一注入 `[data-standard-list-scroll] td{vertical-align:top}` | 否 |
| 全选表头为自定义复选框、无选择范围 | 样式不统一 | 批量操作页 | 统一 renderProcessSelectionHeader，新增 page/all/clear 范围处理 | 否 |
| result-list 工厂与 trade-subjects 初次遗漏 | 样式不统一 | 设置/中转/主体 | 补替换并复核 | 否 |
| `save` 图标未注册导致保存类按钮无图标 | 样式不统一 | 全部 | 统一改用已注册的 check-check | 否 |

## 6. 最终结论

结论：通过（样式对齐批次）

说明：

- 33 条路由全部完成参照对齐：筛选卡 grid 结构 + 更多筛选折叠、统计卡、列表头计数与批量主操作位、行内操作链接化、选择表头/范围、表格单元对齐、页内标题与参照页一致隐藏（标题由外壳页签承担）。
- 视觉证据：`docs/verification-evidence/2026-09-18-style-alignment/`（35 路由 ×2 视图），参照页与全部 PMS 页面逐页截图比对通过。
- 冷启动性能证据按测量环境要求复测后回填（见 §7）。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pms/` 下全部列表页与工作台/看板（33 条路由对应模块）、`src/pages/pms/result-list.ts`、`src/pages/pms/bom-detail.ts`
- `tests/pms-cold-load.spec.ts`（新增冷启动专项，纳入收据链路）

### 页面路由

- 33 条 PMS 路由全部；重点：`/pms/material-reconciliations`、`/pms/product-purchase-orders`、`/pms/material-purchase-tracking`、`/pms/bom-templates`、`/pms/settings/*`、`/pms/transit/*`、`/pms/workbench/overview`

### 验证命令

- `npm run build`：通过
- `npx tsx --test tests/unit/pms-*.test.ts`：通过（68 项）
- `CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pms-purchase-chain.spec.ts tests/pms-material-flow.spec.ts tests/pms-master-data.spec.ts tests/pms-settlement-flow.spec.ts tests/pms-peripheral.spec.ts --workers=1`：通过（44 项，交互性能断言 <200ms）
- `npm run check:pms-purchase-chain`、`npm run check:list-page-governance`、`npm run check:prototype-design-governance -- --all`、`npm run test:workflow-governance`：通过
- 冷启动专项（`tests/pms-cold-load.spec.ts`）：测量前等待主机静默（loadavg<3，最多 90s）、样本间 300ms、独立浏览器与页内计时；最终收据链路复跑通过（`pmsColdLoadPerf`，含 hostLoad1 记录）。

### 性能证据（生产预览，Chromium，1366×768）

- 交互/切换样本：settlement 套件 routeSwitch 7–77ms、subjects 4–30ms、对账 25–38ms、请款 26–36ms；均在 <200ms。
- 冷启动：最终收据链路通过（测量前等待主机静默，34 路由 ×5 样本全部 <200ms；有效窗口观测最大 163–189ms）。
- 视觉证据：`docs/verification-evidence/2026-09-18-style-alignment/`（35 路由 ×2 视图，含 FCS 参照页）。

### 真实图片验证

- 本次不新增对象；既有缩略图/大图能力未变。

### 例外

- 表格行内操作改为参照页的文本链接样式；明细/弹窗内部表格的微操作按钮保持既有紧凑样式。
- 页内标题与参照页一致隐藏（`showHeader:false`），标题由外壳页签承担；此为按用户指令对齐、优先于 AGENTS §5.2 的页内标题表述，如需恢复可全局一行回退。

## 11. 全量可点击交互点击审计与查漏补缺（2026-09-18 深夜）

### 11.1 审计方式

- 工具：`tests/pms-interaction-audit.spec.ts`；对 33 条 PMS 路由逐页枚举页面内容区所有可见可点击控件（按钮、选择框、复选/单选），逐一点击/切换并对比点击前后 URL、弹窗数量、表格、统计卡与文本长度；打印/下载类按副作用动作放行。
- 规模与结果：**816 次点击，0 条控制台/页面错误**；报告 `docs/verification-evidence/2026-09-18-style-alignment/interaction-audit.json`。
- 复核方式：对被标记项用独立探针逐一定性（分页翻页行数 10→3 且页码 1-10→11-13、供应商编辑按钮按状态禁用且可编辑行正常打开表单、空筛选“重置”无可见变化属预期）；未发现真实失效交互。

### 11.2 查漏补缺（真实缺口）

| 缺口 | 处理 |
| --- | --- |
| 约 50 处残留手写按钮（覆盖层小节动作、行内微操作、页头关闭、看板 CTA、分类芯片、危险确认）不符合参照页三种合法形态 | 分批统一：页面/覆盖层动作用共享按钮+图标；行内微操作用参照 mini-link；分类芯片用参照 hover:bg-blue-50 形态；危险动作 `renderDangerButton` |
| `first-leg-carriers` 新增渠道按钮为最后 1 处页面级手写按钮 | 转共享 `renderPrimaryButton`，静态扫描残留归零 |
| 审计工具自身缺陷（select 未选值、按索引点击错位、仅长度对比测不到排序、点击重绘导致误判“无法点击”） | 迭代为按 data-action 定位、控件按状态判定、分段文本对比与等待静默，并保留探针定性 |

### 11.3 视觉与回归证据

- 截图证据在按钮形态收口后重新生成：`docs/verification-evidence/2026-09-18-style-alignment/`（35 路由 ×2 视图）。
- 回归：单测 68 项、功能 spec 44 项通过；`npm run check:pms-purchase-chain`、列表/菜单/原型治理、workflow 治理通过。
- 收据：`/private/tmp/pms-style-alignment-task-receipt.json`（`state=verified`，无阻塞；含冷启动 34 路由 ×5）。
