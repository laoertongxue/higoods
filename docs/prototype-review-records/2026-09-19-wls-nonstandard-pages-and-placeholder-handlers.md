# WLS 非标准列表页与占位处理器补全（2026-09-19）

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-19 |
| 相关需求 / 任务 | 承接 2026-09-19-wls-list-page-interaction-fixes.md，补齐其例外中列出的遗留项 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | WLS |
| 涉及页面路径 | 9 个非标准列表页 + 8 个占位处理器列表页 + 3 个配置页 |
| 端类型 | 管理端 / 员工执行端（PDA） |
| 主要角色与任务 | 仓管与作业员在首页/总览进入目标单据、PDA 扫码作业、列表页查看详情与推进状态 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：
  1. 5 个页面（`finished/dashboard`、`finished/pda`、`finished/pda-ship-scan`、`transit/pda`、`raw/pda`）将交互逻辑写在返回 HTML 的 `<script>` 里。页面经 `root.innerHTML` 注入，浏览器不执行内嵌脚本，且脚本调用的 `window.navigateToMenu`、`window.__wlsPdaShipScan` 全仓库未定义，因此首页 34 个入口与 PDA 扫码、退出、刷新等全部无响应。现改为 `data-*-action` + 页面事件处理器。
  2. 8 个列表页的 `view-detail`、`start-receive`、`generate-pick`、`putaway`、`submit-qc`、`confirm-ship`、`create` 等分支只执行 `console.log`，点击无任何可见结果。现补齐真实行为。
  3. 3 个配置页（标签配置、格口配置、分拣机配置）的“新增”按钮无行为；按 AGENTS.md 第 6 节字典/配置页不开放新增，移除该按钮。
  4. `raw/dashboard` 的两个卡片链接指向未注册路由 `/wls/raw/allocation-list`、`/wls/raw/inventory`，点击落到“页面开发中”。现改指向 `/wls/raw/issue-list`、`/wls/raw/stock/realtime`，并统一加 `data-nav` 走站内导航。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 首页/总览为管理端汇总入口；PDA 为员工执行端单任务页 |
| 文案、状态、数量与单位 | 通过 | 反馈带单号、数量与单位，如“已创建移货任务：SKU-TEST-777 12 件，A01-01 → B02-03” |
| 扫码、真实图片与对象识别 | 通过 | PDA 扫码后回显识别结果并写入作业记录；本轮未新增款式/物料图片位 |
| 防错、危险确认与主管兜底 | 通过 | 空扫码、未选作业类型、重复运单、快递公司不匹配、必填缺失均阻断并说明原因；多件打包出库需二次确认 |
| 交接、跨端事实与异常追溯 | 通过 | 出库释放篮子、盘点开始、质检提交均写入操作人与时间 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | PDA 页保持 470px 单列与底部固定扫码条；弹窗内部滚动 |
| 命名路由、交互、图片大图与打印 | 通过 | 见第 7 节实测路由；打印使用浏览器打印 |

## 4. 问题标签

- `组件误用`
- `点错风险`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 内嵌 `<script>` 在 innerHTML 注入下永不执行 | 组件误用 | 全部 WLS 角色 | 迁移到页面事件处理器与共享分发 | 否 |
| 占位 `console.log` 分支让按钮看似可点实则无反馈 | 点错风险 | 仓管、作业员 | 详情弹窗、状态推进、新建表单、浏览器打印 | 否 |
| 配置页提供未实现的新增按钮 | 组件误用 | 系统管理员 | 按第 6 节移除 | 否 |
| 首页卡片指向未注册路由 | 组件误用 | 原料仓角色 | 改指向已注册路由并走站内导航 | 否 |

## 6. 最终结论

结论：有条件通过

说明：

- 上述用户可见缺陷已修复并实测。
- 遗留：`wave-manage` 的“删除波次”本轮尝试实现后未能让二次确认弹窗渲染，已完整回退到实现前状态（该按钮与勾选列已移除，不留静默失败入口）；后续如需该功能应单独实现。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/ui/list-feedback.ts`
- `src/components/ui/list-table.ts`
- `src/main-handlers/wls-page-handlers.ts`
- `src/pages/wls/finished/basic-label-config.ts`
- `src/pages/wls/finished/collection-orders.ts`
- `src/pages/wls/finished/dashboard.ts`
- `src/pages/wls/finished/inventory-count.ts`
- `src/pages/wls/finished/multi-item-packing.ts`
- `src/pages/wls/finished/outbound-orders.ts`
- `src/pages/wls/finished/pda-ship-scan.ts`
- `src/pages/wls/finished/pda.ts`
- `src/pages/wls/finished/pre-inbound.ts`
- `src/pages/wls/finished/pre-outbound.ts`
- `src/pages/wls/finished/putaway.ts`
- `src/pages/wls/finished/return-inbound.ts`
- `src/pages/wls/finished/return-orders.ts`
- `src/pages/wls/finished/return-quality.ts`
- `src/pages/wls/finished/ship-scan.ts`
- `src/pages/wls/finished/sorter-gate-config.ts`
- `src/pages/wls/finished/sorter-machine-config.ts`
- `src/pages/wls/finished/stock-transfer.ts`
- `src/pages/wls/finished/wave-manage.ts`
- `src/pages/wls/raw/dashboard.ts`
- `src/pages/wls/raw/pda.ts`
- `src/pages/wls/transit/dashboard.ts`
- `src/pages/wls/transit/overview.ts`
- `src/pages/wls/transit/pda.ts`
- `src/pages/wls/transit/warehouse-transfer.ts`

### 页面路由

- `/wls/finished/dashboard`：35 个控件接入；空数据模式使指标归零并清空异常表；切换仓库刷新页头；卡片跳转到 `/wls/finished/pre-inbound`
- `/wls/raw/pda`：6 个作业入口 + 扫码；未选作业、空扫码均阻断；扫码后写入最近任务
- `/wls/finished/pda`：11 个控件；识别回显、空扫码报错
- `/wls/finished/pda-ship-scan`：4 条校验路径（成功入列并计数、重复阻断、未知前缀、快递公司不匹配）
- `/wls/transit/overview`：时间范围切换使期间指标重算（今天 5 单 / 近 30 天 78 单），重置生效
- `/wls/finished/multi-item-packing`：未开始打包时阻断打印与出库；出库二次确认后按钮禁用并释放篮子
- `/wls/finished/return-orders`：DOM 反读详情弹窗 11 字段
- `/wls/finished/stock/transfer`：新增移货任务表单，必填校验 + 创建成功
- `/wls/transit/warehouse-transfer`：新增调拨单表单 3 字段并生成草稿
- `/wls/finished/ship-scan`：新建扫码批次使列表 5 → 6 行
- `/wls/raw/dashboard`：8 个卡片链接全部指向已注册路由

### 验证命令

- `npx tsc --noEmit`（WLS、共享组件、main-handlers）：通过，0 错误
- `npm run build`（含类型检查、全部单测、打包）：通过
- 动作审计脚本（正则同时覆盖字面属性与按钮助手）：通过，未处理动作 0、console.log 占位 0、内嵌 `<script>` 0
- `npm run check:prototype-design-governance -- --all`：通过（补齐本记录后）

### 性能验证（AGENTS.md 第 7.2 节）

测量环境：`npm run build` 产物 + `npm run preview`（http://localhost:5193），Chromium 无节流，MutationObserver 判定内容就绪，不使用平均值、不剔除慢样本。

- 全部 84 条 `/wls/*` 路由站内切换：最大 35.4ms，最小 0ms，无样本为负（超时）或达到 500ms。
- 35 条含非标准动作的路由，动作响应最大 4.5ms。
- 冷加载内容就绪抽样：`/wls/transit/allocation-manage` 63.9ms、`/wls/finished/collection/orders` 129.6ms、`/wls/raw/issue-list` 344.5ms。
- 结论：**站内切换与交互在全量 84 路由上通过 < 500ms 硬门禁**；冷加载为抽样 3 条通过，其余 81 条未逐条出具刷新样本。

### 例外

- `wave-manage` 删除波次：实现后二次确认弹窗未能渲染，已回退并移除该按钮与勾选列，避免留下静默失败入口。
- 冷加载性能证据为抽样 3 条，未覆盖全部 84 条路由的刷新场景。
