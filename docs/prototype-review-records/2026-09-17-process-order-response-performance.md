# 染色印花加工单响应性能整改审查

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-17 |
| 相关需求 / 任务 | PERF-001 至 PERF-006，染色和印花加工单点击及加载低于 200ms |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS / PFOS |
| 涉及页面路径 | /fcs/process/dye-orders、/fcs/process/print-orders、/fcs/craft/dyeing/work-orders、/fcs/craft/printing/work-orders |
| 端类型 | 管理端 / 主管端桌面 |
| 主要角色与任务 | 计划人员提前建单，主管查看加工单、筛选和分页 |
| 版本与运行 | codex/move-early-process-orders-to-fcs；HEAD c56c80fb；/Users/laoer/Documents/higoods；Vite 0.0.0.0:4176 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：消除点击长时间等待；字段聚焦与 select 输入不重复渲染，Esc 就地关闭浮层；接收、任务、关系与仓库事实仍来源于原数据，只减少重复读取。

依据 AGENTS.md 第 4、5、7 节。前两轮迁移和印花按钮改动在各自同日审查记录中覆盖，本记录仅描述性能修改。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | FCS 保持提前准备，PFOS 保持工厂执行；页面结构和七列展示保持。 |
| 文案、状态、数量与单位 | 通过 | 接收范围筛选后克隆、仓库文档复用及批量关系读取与独立读相同；三维状态、数量、唯一接收方专项通过。 |
| 扫码、真实图片与对象识别 | 通过 | 沿用本地对应物料/款式图、同列名称编码；两页缩略图可打开大图并由 Esc 关闭。扫码不涉及。 |
| 防错、危险确认与主管兜底 | 通过 | 工厂未选禁止创建且保留输入；取消仍要求确认，浏览器测试模拟确认并恢复原函数；作用于测试浏览器 Mock。 |
| 交接、跨端事实与异常追溯 | 通过 | 直接收货/分配收货、接收数量、交出排序和任务身份一致；217 条加工关系专项通过，无长期缓存或第二套事实。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768、1280×720 未出现主体横向溢出；PDA 读取默认行为保持；上传与弱网不涉及。 |
| 命名路由、交互、图片大图与打印 | 有条件通过 | 四列表 106 次操作 17.7–169.6ms，四次站内切页 60.7–122.3ms，根节点保持；完整文档加载仍大于 200ms。打印内容与参数未改变。 |

## 4. 问题标签

- 组件误用

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 首次点击加载无关事件模块、列表逐行全库复制 | 组件误用 | 计划/主管 | 当前页直接事件分发，按单过滤后克隆，同步读作用域批量复用 | 已测操作全部小于 200ms；不保证其他设备与未覆盖动作 |
| 完整冷启动仍依赖多个共享业务初始化 | 组件误用 | 全部 | 独立测试开发与构建预览，保留 PERF-006 未达标记录 | 是，尚未达到完整加载 200ms |

## 6. 最终结论

结论：有条件通过

已修复并验收本次可复现的点击卡顿；用户“任一加载低于 200ms”的总体要求尚未完成，不以技术收据或交互采样通过代替总体性能验收。开发服务完整文档加载染色 1452.9ms、印花 1159ms；同代码构建预览新端口首次染色 4005.8ms，随后整页加载 1339.1–1429.4ms。没有远端发布。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/dye-work-order-online-domain.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/dyeing-material-receipts.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/factory-receiving-warehouse.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/pda-task-mock-factory.ts`
- `src/data/fcs/preparation-material-receipt-sources.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/process-order-task-links.ts`
- `src/data/fcs/process-order-three-axis-view.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/pages/process-dye-orders.ts`
- `src/pages/process-print-orders.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/main.ts`

新增契约测试 `tests/unit/process-order-read-performance.test.ts`；前轮迁移修改覆盖见对应记录。

### 页面路由

- `/fcs/process/dye-orders`
- `/fcs/process/print-orders`
- `/fcs/craft/dyeing/work-orders`
- `/fcs/craft/printing/work-orders`

### 验证命令

- `git diff --check`：通过。
- `node scripts/check-typescript-scope.mjs <本次实际修改文件>`：通过，范围内 0 错误；完整命令对应日志 `output/playwright/process-performance/typecheck.log`。
- `node --import tsx --test tests/unit/process-order-read-performance.test.ts`：通过，5 项业务一致性契约。
- `npm run check:process-order-task-relations`：通过，217 条显式关系。
- `npm run check:process-order-three-axis-flow`：通过，状态、数量与唯一接收方契约。
- `npx --offline --package @playwright/cli playwright-cli -s=early-migration run-code --filename=/private/tmp/process-ui-perf2.js`：通过，62 次操作及 4 次站内切页低于 200ms，无页面错误；另行记录整页加载未达标。
- `npx --offline --package @playwright/cli playwright-cli -s=early-migration run-code --filename=/private/tmp/process-ui-extra.js`：通过，44 次分页/排序/列设置/图片/导出等操作低于 200ms，两个分辨率无溢出。
- `npx --offline --package @playwright/cli playwright-cli -s=early-migration run-code --filename=/private/tmp/process-load-preview.js`：失败，完整加载 200ms 性能目标不满足；脚本正常结束并保存实际数据。

最终技术收据由 workflow:verify 生成，位置 `/private/tmp/process-performance/task-receipt.json`。收据覆盖当前同一任务的提前建单迁移、印花按钮调整及性能修复差异；构建、治理、CodeGraph 同步状态以其实际退出结果为准。收据不代表完整加载性能通过。

### 真实图片验证

使用原本地 `public/materials/` 图片与业务记录映射，缩略图和物料/款式名称编码同列；本次未更换素材。FCS 两页在当前最终版本打开大图、Esc 关闭通过，原图片组件的加载失败反馈未修改，前轮迁移已有故障注入证据，不重复改变资源。截图位于 `output/playwright/process-performance/`。

### 例外

- PERF-006 未达标且未关闭：整页加载涉及公共模块装载与初始化，当前不能承诺所有加载低于 200ms。
- 性能测量是当前机器本地 Chromium、无 CPU/网络降速；图片已加载后的点击、确认框排除用户思考时间。106 次采样不是任意设备时延保证。
- 本次未修改打印模板、PDA 页面、图片组件或其他系统布局，未新增相应重复验收。
- 全仓 61 个范围外既有类型错误保持原有治理范围。

### 证据位置

- `output/playwright/process-performance/verification.json`
- `output/playwright/process-performance/process-ui-perf2.js`
- `output/playwright/process-performance/process-ui-extra.js`
- `output/playwright/process-performance/process-load-preview.js`
- `output/playwright/process-performance/fcs-dye-1366.png`
- `output/playwright/process-performance/fcs-print-1366.png`
- `output/playwright/process-performance/fcs-dye-1280.png`
- `output/playwright/process-performance/fcs-print-1280.png`
- `output/playwright/process-performance/pfos-dyeing.png`
- `output/playwright/process-performance/pfos-printing.png`
