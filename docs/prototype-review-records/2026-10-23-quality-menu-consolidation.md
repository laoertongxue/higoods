# 质检记录菜单合并与扣款记录归入对账与结算

依据：[AGENTS.md](../../AGENTS.md) 当前项目规则；本次仅调整 FCS 菜单、质检记录页签和隐藏工作台标题。

## 基本信息

- 日期：2026-10-23
- 任务 / 需求编号：质检记录菜单合并（质检记录并入质检记录汇总；扣款记录移入对账与结算）
- 验证人：Codex主代理

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：FCS 侧边栏移除“质量与扣款”一级菜单及其“质检记录”二级菜单；“扣款记录”移入“对账与结算”；“质检记录汇总”增加与平台质检工作台互切的页签。旧 `/fcs/quality/qc-records` 路由保留为隐藏工作台和详情入口，原审核、扣款依据和详情动作继续可用。
- 契约变化：菜单结构、页签导航和隐藏工作台标题变化；质检/扣款数据、数量、状态、保存、查询、打印和权限契约未变化。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| FCS 侧边栏不再出现“质量与扣款” | 通过 | `menu-1366.png`；Playwright 断言该按钮数量为 0 |
| “质检记录”二级菜单不再出现，“质检记录汇总”保留 | 通过 | `menu-1366.png`；质检管理组下仅保留质检记录汇总入口 |
| “附加质检标准”菜单图标正常显示 | 通过 | `menu-1366.png`；Playwright 断言该菜单项图标容器内存在已渲染 SVG |
| “扣款记录”归入“对账与结算” | 通过 | `menu-settlement-1366.png`；展开后依次为对账单、预结算流水、车缝接收对账、扣款记录、预付款批次 |
| 质检记录汇总页存在“质检记录汇总 / 平台质检工作台”页签 | 通过 | `records-summary-1366.png`、`records-summary-1024.png` |
| 平台质检工作台页签可打开原质检审核工作台 | 通过 | `records-platform-1366.png`、`records-platform-1024.png`；URL `/fcs/quality/qc-records`，标题与页签均为平台质检工作台 |
| 旧质检记录详情、扣款依据、审核动作和既有链接保留 | 通过 | `/fcs/quality/qc-records/:id` 路由未删除；`check:menu-routes` 通过；旧 `?view=WAIT_PLATFORM_REVIEW` 重定向仍指向该工作台 |
| 扣款记录路由和页面不变 | 通过 | `/fcs/quality/deduction-analysis` 路由未变；页面标题仍为扣款记录 |
| 质检中心三类记录、稽查和统计口径不变 | 通过 | 本次未改 `quality-management-read-model.ts`、质检记录投影或统计计算；只改列表页签、标题和菜单 |
| 平台质检工作台列表、详情和动作不变 | 通过 | 只改页面标题、说明和顶部页签；原过滤器、表格、详情链接和事件处理器未改 |
| 1366×768 与 1024×768 可读、页签可见 | 通过 | 两种视口截图；1024 下页面无横向溢出断言通过 |
| 图片对象对应和失败态 | 不适用 | 本次未改图片、图片组件或打印版式 |
| 保存、持久化、迁移和权限 | 不适用 | 本次未改存储、事务、数量、状态、权限或迁移代码 |
| 性能 | 不适用 | 仅增加菜单/页签静态 DOM 和隐藏路由标题；未改数据读取、查询、保存、打印或事件链，页面仍加载原模块 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/state/store.ts`
- `src/pages/quality-management/index.ts`
- `src/pages/qc-records/list-domain.ts`
- `src/router/routes-fcs.ts`
- `src/icons/shell-icons.ts`
- `tests/quality-menu-consolidation.spec.ts`

### 页面证据

- 版本：当前分支 `main`，验证基线 HEAD `eb634b6f` 加本次未提交差异；本地 Vite 服务通过 Playwright 隔离启动；Chrome，1366×768 与 1024×768。
- 证据：`output/quality-menu-consolidation-20261023/menu-1366.png`、`menu-settlement-1366.png`、`records-summary-1366.png`、`records-summary-1024.png`、`records-platform-1366.png`、`records-platform-1024.png`；`tests/quality-menu-consolidation.spec.ts` 覆盖菜单、两个页签、旧路由标题、扣款记录页面和 1024 无横向溢出。

### 性能结论

- 结论：不适用
- 依据：本次只改菜单、页签静态结构、页面标题和隐藏路由标题；未改页面数据读取、查询、保存、打印或事件链，未改变初始化或布局成本，复用原页面性能证据。

### 验证命令

- `npm run typecheck:engineering`：通过
- `npm run check:menu-routes`：通过
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43644 npx playwright test tests/quality-menu-consolidation.spec.ts --workers=1 --reporter=line`：通过
- `npm run check:list-page-governance -- --scope worktree --paths src/data/app-shell-config.ts,src/state/store.ts,src/pages/quality-management/index.ts,src/pages/qc-records/list-domain.ts,src/router/routes-fcs.ts,src/icons/shell-icons.ts,tests/quality-menu-consolidation.spec.ts,docs/prototype-review-records/2026-10-23-quality-menu-consolidation.md`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths src/data/app-shell-config.ts,src/state/store.ts,src/pages/quality-management/index.ts,src/pages/qc-records/list-domain.ts,src/router/routes-fcs.ts,src/icons/shell-icons.ts,tests/quality-menu-consolidation.spec.ts,docs/prototype-review-records/2026-10-23-quality-menu-consolidation.md`：通过

### 例外

- 运行 `check:quality-deduction-analysis`、`check:qc-records-facts-only`、`check:factory-settlement-qc-boundary` 时发现与本任务无关的既有失败，分别涉及工厂筛选种子、后道质检样例和 `qc-orders.ts` 既有文案；本次未改这些数据/页面，失败未作为本次通过证据，原输出保留在会话日志中。
