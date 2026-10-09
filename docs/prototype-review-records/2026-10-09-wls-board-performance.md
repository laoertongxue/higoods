# WLS 看板性能实现替换记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-10-09 |
| 相关需求 / 任务 | WLS 看板冷启动优化；WLS-PERF-001～004 |
| 记录模式 | 无用户可见影响声明 |
| 涉及系统 | WLS |
| 涉及页面路径 | `/wls/fabric-demand-board` |
| 端类型 | 管理端 Web |
| 版本与工作树 | `fcdc3869298bbc8c578d876071eebce12b9b6a7a` 加本次差异；`/Users/laoer/.codex/worktrees/9ec5/higoods` |

## 2. 影响判定

- 用户可见影响：无
- 判定依据：仅替换图片交付来源与首次事件加载顺序。6 条记录、业务数量、仓库库存、异常规则、文案、页面结构、图片内容与分辨率、列表行为、路由和存储链路保持不变。原外部 URL 与已发布图片逐条比对，数量/仓库/规则以基准代码和当前代码的 JSON 深比较证明不变；响应时间改善属于 AGENTS.md 第 5 节列出的性能实现替换。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/wls/fabric-demand-board.ts`：图片同源发布，增加显式 1200px 大图引用。
- `src/pages/wls-fabric-demand-board.ts`：使用大图引用，保留原大图和失败态入口。
- `src/main.ts`：只调整看板专属处理器与通用 WLS 处理器的顺序。
- `scripts/check-wls-fabric-demand-board.ts`：补充图片发布契约。
- `public/materials/wls/fabric-demand/`：5 组缩略图/大图及来源、字节数和哈希。

页面路由影响判定：用户可见行为不变。实际性能验收路径为 `/wls/fabric-demand-board`；相邻通用分发核对 `/wls/raw/fabric-score`。

### 验证命令

- `npm run build`：通过；类型检查、635 项单元检查及生产构建通过。
- `node --import tsx scripts/check-wls-fabric-demand-board.ts`：通过；保留现有业务、筛选和渲染契约，实际 JPEG 资源存在，大图不复用缩略图。
- 基准与当前数据深比较：通过；全部 6 条记录非图片字段和所有异常规则一致。
- 图片来源与清单哈希、实际解码尺寸：通过；120px 缩略图和 1200px 大图，同源、同来源、同参数。
- `npm run check:menu-routes`：通过，219 个菜单地址契约保持。
- 同工作树生产构建的 Chromium 浏览器性能：通过；1366×768、1280×720、1024×768 各自冷进入/刷新/首次切换每项 5 次，45 个样本全部不超过 1000ms。跨尺寸最大分别 247.9ms、189.8ms、65.8ms。
- 64 类看板操作共 410 个样本：通过；每项至少 5 次，含全新上下文首次筛选、5 个独立来源大图冷加载、全部记录预览、按钮/背景/Escape 关闭、全部筛选、空结果、分页边界、3 种页大小、7 列 3 态排序、5 列显隐、冻结、拖拽、恢复和列面板关闭。最大 66.3ms，稳定主体节点保留，无未捕获错误；首次筛选未请求通用 WLS/PDA 模块。
- 三种尺寸整页无横向溢出；宽表仅容器内横向滚动。
- 图片失败态和相邻通用分发：通过；缩略图/大图失败各 5 次，最大 269.6ms/65.7ms，提示出现且可继续关闭操作；相邻面料评分列面板通过通用 WLS 处理器打开。
- `npm run check:prototype-design-governance -- --all`：通过，两个受管文件按无用户可见影响关联本记录。
- `codegraph sync`、`codegraph status`：通过，同工作树已同步且无 pending 文件。

### 任务收据

执行 `npm run workflow:verify -- --output output/playwright/wls-performance/task-receipt.json --task-boundary "WLS 看板冷启动图片与首次事件加载优化；WLS-PERF-001 至 004"`；最终技术结果以收据 JSON 为准。初次收据因本记录在“验证命令”节的收据命令未注明明确结果而触发治理格式校验，构建和端到端检查通过；将收据说明移至独立节后重新执行，原始日志与收据保存在 `workflow-verify-initial.log`、`task-receipt-initial.json`。收据绑定最终差异，不替代以上浏览器性能证据。

### 证据

需求、实施与原子追踪见 `docs/wls-board-performance-2026-10-09.md`；全部原始日志、脚本和 JSON 在 `output/playwright/wls-performance/`。有效当前页面截图为 `width-1366.png`、`width-1280.png`、`width-1024.png` 与 `large-preview.png`。

保留 `interactions-initial.log/json`：测量在第 1 轮列面板关闭处因选择器匹配两个按钮中断，133 个已采样操作最大 211.5ms；未将脚本选择错误视为应用问题，修正选择器后重新执行全部 410 个样本。未删除慢样本。

本次未改变业务或文件存储。图片属于随应用发布的静态演示资源，不初始化 IndexedDB、不新增 localStorage 键或业务快照；原列偏好机制保持。无 PDA、业务提交、打印或数据迁移变化。
