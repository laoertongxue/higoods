# 印花 QC 单详情布局调整

依据 `AGENTS.md` REVIEW-01、PERF-01、EVIDENCE-01。

## 简要记录

- 记录模式：轻量可见变更
- 用户可见影响：有
- 对象 / 路由：印花 QC 单详情 `/fcs/craft/printing/qc-orders/FQC-PRINTING%253APWO-PRINT-DEMO-01-4`；与染厂 QC 单详情共用同一渲染入口。
- 改动与边界：将摘要卡压缩为“物料 / 来源 / 下游 / 创建”与“已检进度 / 状态 / 登记卷数”两区，三项检查结果改为带分隔的横向汇总；整单手感处理改为标题在左、决定与目标在右的紧凑工作区，删除卡内说明性文案，仅在来源已实际交出时保留例外提示，已记录状态直接显示三项结果；卷质检列表改为全宽表格，标题与卷登记信息在左、查找与状态筛选在右，数量与结果列不再换行，窄屏表内横向滚动且操作列固定在右侧；未选卷时不再渲染空编辑卡，选卷后编辑区在表格下方出现并使用卡片头部。仅调整结构与样式，保留原字段、数量、状态、可用动作、图片、保存与读取流程、路由和分页行为。
- 契约变化：无
- 版本：2026-10-23，分支 `main`，HEAD `4631d25fcb3f9cc68833ccdbd38f44904ad996c5`，源文件 SHA256 `38279d4ca270c5b1732d8baf026c45b372e25137b76fb77b0da6f3161d6f9cac`；同工作树 Vite 开发服务 `http://127.0.0.1:43221`；Chrome 视口 1366×768、1280×720、1024×768。
- 验证人：主代理
- 证据：真实页面从印花 QC 单列表点击“已检 0 / 应检 2 卷”进入详情。1366×768 下摘要、整单手感处理和全宽卷表的表头可见，向下滚动后卷行、分页与编辑区按顺序完整显示；点击“检查本卷”后编辑区出现在表格下方并自动聚焦，参考图、现场照片、三项结果、说明和保存按钮完整；整单判断保存后卡片切换为“处理决定 / 目标要求 / 记录人时间”三列；完成卷显示“已完成质检 · 记录只读”。1280×720 下表宽 926px 与可视区一致，1024×768 下正文宽度等于视口、卷表在卡片内横向滚动且“检查本卷”操作列固定在可视区，三视口均无页面横向溢出。截图、视口宽度和操作列位置见 `output/playwright/factory-qc-layout-20261023/detail-1366.png`、`detail-editor-1366.png`、`detail-decision-recorded-1366.png`、`detail-1280.png`、`detail-1024.png`、`detail-1024-rolls.png` 与 `layout-results.json`；卷草稿保存、完成锁定的真实流程回归见 `output/playwright/factory-qc-layout-20261023/regression/results.json` 和 `qc-completed-readonly-editor.png`。
- 性能：不适用（本次仅调整详情页卡片结构、栅格和表格展示；未改变数据读取、保存命令、事件链、图片资源、分页或路由，不新增网络请求或页面渲染轮次；按 T2 简要记录不强制性能采样）
- 结果：通过

## 受管文件

- `src/pages/process-factory/shared/factory-qc.ts`

## 验证命令

- `node --import tsx --test tests/unit/factory-qc-reported-roll-display.test.ts tests/unit/factory-qc-page-recovery.test.ts tests/unit/factory-qc.test.ts tests/unit/factory-qc-triggers.test.ts`：通过
- `node scripts/verification/factory-qc-browser.mjs --case ui_draft_complete_immutable_cold --base-url http://127.0.0.1:43221 --output output/playwright/factory-qc-layout-20261023/regression`：通过
- `node output/playwright/factory-qc-layout-20261023/layout-check.mjs`：通过
- `npm run typecheck:engineering`：通过
- `git diff --check`：通过
- `npm run check:list-page-governance -- --scope worktree --paths src/pages/process-factory/shared/factory-qc.ts,docs/prototype-review-records/2026-10-23-printing-qc-detail-layout.md`：通过
