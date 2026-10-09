# HiGood 公共左侧菜单组 UI 审查

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 日期 | 2026-10-09 |
| 需求 | 全项目左侧菜单组更醒目；MENU-001～MENU-006 |
| 模式 | 完整产品审查 |
| 系统 | PCS / PMS / FCS / PFOS / WLS / LOS / OMS / BFIS / DDS |
| 端类型 | 管理端、主管端 Web 与小屏菜单抽屉 |
| 版本 | HEAD 9dc534ba8a2d82b13015833e00b68f90599d580b + 本次差异，初始为 detached HEAD |
| 运行工作树 | /Users/laoer/.codex/worktrees/9ec5/higoods |
| 任务范围 | 只修改公共组标题、组内层级及对应无障碍属性 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：组标题从浅灰无底改为深色粗体、浅色底与边框，图标继承标题色；子菜单增加缩进与引导线；当前组仍用蓝色。菜单对象、路由与业务数据不变；将组折叠默认值与默认展开渲染对齐，第一次点击即可收起。

治理依据：`AGENTS.md` 第 4、5、7 节。需求与计划、原子矩阵见 `docs/sidebar-menu-group-ui-2026-10-09.md`。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 公共导航层级更清楚，沿用现有后台样式 |
| 文案、状态、数量与单位 | 通过 | 菜单文案与业务数据未变化；新增展开状态语义 |
| 命名路由与交互 | 通过 | 九个默认路由和 35 组折叠已实际执行，组折叠保留页面主体 |
| 低分辨率与小屏 | 通过 | 1366、1280、1024、390 宽度无标题溢出，组名与箭头完整；小屏开关实测通过 |

扫码、图片、交接、业务危险确认、弱网上传与打印不适用：菜单不渲染或修改相关业务对象。

## 4. 问题标签

- 视觉干扰

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 父级组标题比下级菜单浅，层级难以辨认 | 视觉干扰 | 使用公共侧栏的管理与主管人员 | 强化标题色、字重、背景、边界和子级缩进 | 视觉与操作验证通过，整体受 WLS 页面性能阻塞 |

## 6. 最终结论

结论：不通过

菜单样式和默认折叠修正已经存在，视觉和菜单操作专项通过。全项目性能门禁未通过，整体未完成：WLS 需求看板冷进入最大 1132.3ms、首次系统切换 2298.2ms，超过 1000ms。原始样本没有删除或平均化；产品接受待用户查看效果。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/shell.ts`
- `src/state/store.ts`（界面状态文件，不属于受管目录）

### 页面路由

- `/pcs/products/styles`
- `/pms/workbench/overview`
- `/fcs/workbench/overview`
- `/fcs/craft/workbench/overview`
- `/wls/fabric-demand-board`
- `/los/live-schedule`
- `/oms/order-list`
- `/bfis/financial-report`
- `/dds/dashboard`

### 验证命令

- `npm run check:menu-routes`：通过，219 地址无缺失与重复
- `npm run check:prototype-design-governance -- --all`：通过，1 个可见变更文件已关联记录
- `/Users/laoer/.codex/skills/playwright/scripts/playwright_cli.sh --session sidebar-perf run-code --filename=output/playwright/sidebar-groups/measure.js`：失败，原始 485 样本保留，WLS 两个样本超过 1000ms，尾部脚本选择错误另以补充脚本复核

- `npm run build`：通过，635 项单元检查通过，类型检查与 Vite 构建通过；默认展开修正后重新执行。

- `playwright-cli --session sidebar-perf run-code --filename=output/playwright/sidebar-groups/measure-transition.js`：通过，10 个整侧栏操作样本最大 49.1ms
- `playwright-cli --session sidebar-perf run-code --filename=output/playwright/sidebar-groups/measure-tail.js`：通过，四种宽度的组标题几何通过，10 个小屏操作样本最大 48.7ms
- `codegraph sync`：通过，同工作树无待同步文件

### 证据位置

- `output/playwright/sidebar-groups/before.png`、`after.png`：同工作树 PFOS 页面前后截图。
- 原始性能 JSON、脚本、检查日志与技术任务收据位置均在同目录；技术收据结果以 JSON 为准，不代替页面性能。详见需求文档“当前验收证据与未关闭项”。

### 存储链路

本次只改变样式及展开状态属性。继续读取现有菜单配置与展开状态，保留原有菜单偏好读写入口；未触及业务记录或附件存储，未新增 localStorage 键，不启动业务迁移。

### 例外

- 无；WLS 页面超时是未通过项，不构成豁免，不声明整体已验证。
