# 裁片放行矩阵详情布局调整

## 基本信息

- 日期：2026-10-10
- 任务 / 需求编号：统一裁片放行矩阵详情与相邻详情页样式
- 验证人：主代理

## 影响判定

- 记录模式：轻量可见变更
- 用户可见影响：有
- 判定依据：仅修改详情容器与标题的 CSS 类。移除 1440px 居中限宽，采用相邻裁片单详情的 16px 页内边距、20px 标题；矩阵卡片填满可用内容区。
- 契约变化：无

## 轻量变更

- 对象 / 路由：裁片放行矩阵详情，`/fcs/craft/cutting/cut-piece-release?productionOrderId=po-14671&productionOrderNo=PO14671`。
- 改了什么：详情容器从 `mx-auto max-w-[1440px] space-y-4 p-6` 改为 `min-w-0 w-full space-y-4 p-4`；详情标题从 `text-2xl` 改为 `text-xl`。
- 保留什么：页面结构、矩阵颜色与尺码轴、图片、数量计算、数据来源、持久化、事件、按钮及路由均保留；列表使用原标准组件。
- 如何验证：同工作树的生产预览，四种视口检查内容宽度、标题与卡片对齐、图片就绪、表格内部滚动、正文无横向溢出；重放侧栏、更新历史、返回、新窗口与刷新；逐项检查最终两处样式 diff。
- 结果：通过

## 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/cutting/cut-piece-release.ts`

### 页面证据

- 版本：分支 `codex/sidebar-menu-group-ui`，HEAD `1a2df088fa8e39863b59290cde9e7e86cd84d431` 加本次两处样式差异。源码 SHA256 `eda130addae05d0a9e095ede6032f494d33ba7b73ff58a7609ac39faff85ee9c`。工作树 `/Users/laoer/.codex/worktrees/9ec5/higoods`；`http://127.0.0.1:4190` 同工作树 Vite 生产预览，已重新构建；隔离 Chrome 会话，Asia/Shanghai，视口 1920×1080、1366×768、1280×720、1024×768。运行资产及完整原始数据见 [布局结果](../verification-evidence/2026-10-10-cut-release-detail-layout/layout-results.json)。
- 证据：四种视口均无正文与外壳横向溢出；小屏矩阵在自身容器滚动。四组物料矩阵、目标与确认矩阵四个颜色行、款式与物料图片保持完整。1920px 卡片宽度由 1392px 增至 1600px。裁片详情、更新历史、返回列表、新窗口和刷新通过，无页面异常。截图见 `output/playwright/release-detail-layout/verified-1920.png`、`verified-1366.png`、`verified-1280.png`、`verified-1024.png`、`drawer-1024.png`；同目录保存调整前截图与验证脚本。首次探针误用旧按钮的精确名称而超时，原始日志保留为 `layout-check-first-attempt.log`，按当前实际可访问名称修正探针并完整重放通过，未为探针更改产品行为。

### 性能结论

- 结论：通过
- 依据：本次影响为内容宽度与静态排版，不改变初始化、数据读写或事件实现。每种视口各 5 个实际 resize 样本，从调整前记录起点到目标尺寸排版完成及两个独立绘制帧；裁片详情打开另测 5 次，从实际点击前到内容可见及绘制完成。全部原始值及最大值见布局结果，所有有效样本均不超过 1000ms。本次没有冷启动速度结论，不复用开发环境测量冒充生产预览。

### 验证命令

- `npm run typecheck`：通过
- `npm run build`：通过
- `Playwright CLI run-code output/playwright/release-detail-layout/layout-check.js`：通过
- `git diff --check`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths src/pages/process-factory/cutting/cut-piece-release.ts,docs/prototype-review-records/2026-10-10-cut-release-detail-layout.md`：通过
- `npm run check:list-page-governance -- --scope worktree --paths src/pages/process-factory/cutting/cut-piece-release.ts,docs/prototype-review-records/2026-10-10-cut-release-detail-layout.md`：通过

生产构建执行了 772 项单元测试，全部通过。构建与类型检查原始输出保存在 `output/playwright/release-detail-layout/`。本次为 T2 样式修正，使用直接页面证据，无需技术收据或新的测试文件。
