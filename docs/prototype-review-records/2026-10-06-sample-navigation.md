# 样衣管理删除重复页内导航

## 1. 基本信息

- 日期：2026-10-06；需求：用户要求样衣各页面取消与左侧菜单重复的顶部 Tab。
- 记录模式：完整产品审查；PCS 管理端；样衣管理人员。
- 工作树：/Users/laoer/Documents/higoods；分支 codex/sample-menu-navigation；基准23549cf9cebacad6571a66ea0cfa9e9c9c8b21c5加本次差异。
- 实际服务：4206 同工作树开发页面，4207 同工作树最终构建预览；设备1366×768、1280×720。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：删除样衣统一页头中的七项模块导航、导航常量、渲染函数与仅用于选中项的参数。标题、说明和业务操作继续显示；左侧菜单承担模块切换。
- 基线：AGENTS.md 第4、5、7节。只调整页面结构，不修改样衣记录、IndexedDB、读写动作、HG、打印布局或共享应用外壳。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
|---|---|---|
| 角色、任务与页面模式 | 通过 | 取消重复导航，管理端通过左侧菜单进入各页面 |
| 文案、状态、数量与单位 | 通过 | 业务内容和统计不变 |
| 低分辨率与布局 | 通过 | 1366×768、1280×720实际截图 |
| 命名路由、图片和操作 | 通过 | 七页与详情；筛选、抽屉、卡片/表格、原图片大图及打印入口 |
| 统一性能 | 通过 | 冷启动、刷新、站内切换与原有操作，每项至少五次、全部≤1000ms |

## 4. 问题标签

- 视觉干扰、组件误用。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
|---|---|---|---|---|
| 顶部模块Tab重复左侧菜单 | 视觉干扰 | 样衣管理人员 | 从统一页头删除导航及专用代码 | 否 |

## 6. 最终结论

结论：通过。浏览器、构建与技术收据均通过。结论仅限本次本地页面调整。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-sample-management.ts`

### 页面路由

- `/pcs/samples/inventory`
- `/pcs/samples/application`
- `/pcs/samples/transfer`
- `/pcs/samples/return`
- `/pcs/samples/ledger`
- `/pcs/samples/ledger/stocktake`
- `/pcs/samples/view`
- `/pcs/samples/detail/smp-001`
- 相邻入口：`/pcs/samples/label/smp-001`

### 验证命令

- `npm run build`：通过，工程类型检查、586单元测试、Vite构建。
- `SAMPLE_PERF_URL=http://127.0.0.1:4207 node --import tsx --test tests/browser-contracts/pcs-sample-performance.test.ts`：通过；213场景1080次测量，全部≤1000ms，最大367.39999997615814ms；浏览器错误0。
- `npm run workflow:verify`：通过；相关治理、构建与CodeGraph同步通过，blockers为空；收据见下。

### 真实图片验证

- 原有同源样衣缩略图与大图来源不变；本次重跑各页面图片等待、抽屉图片、大图打开与关闭，均通过。

### 例外

- 无。未修改持久化入口，本次不执行迁移、删除或重置用户存储。

### 当前证据

- `output/playwright/sample-navigation/build.log`、`performance-run.log`、`performance.json`：当前构建与完整交互原始测量。
- `output/playwright/sample-navigation/check-navigation.js`、`navigation.json`、`navigation-after-restart.log`：真实左侧菜单七页各五次切换，35次，最终重新启动同工作树开发服务后最大49.19999998807907ms；页头nav及data-nav为0；详情→标签→详情通过。
- `output/playwright/sample-navigation/after-1366.png`、`after-1280.png`：页面布局。
- 只调整页头模板，无存储读写变化；不适用数据迁移和写失败专项重测。

- `output/playwright/sample-navigation/task-receipt.json`：最终差异验证收据；`workflow-verify-final.log`：最终完整检查。
- 自动化首轮在返回详情时未重新展开收起的左侧菜单而超时；修正脚本按实际菜单状态展开后完成七页五轮，原失败记录保留，不修改业务代码。
