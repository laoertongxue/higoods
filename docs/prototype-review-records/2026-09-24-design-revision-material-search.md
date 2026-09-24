# 设计改款物料搜索与每行加工互斥

## 1. 基本信息

基线 main / aa2a2afe6e1b5fc64347063743ec85eeadcaca06；工作树 /Users/laoer/Documents/higoods；本地同工作树 production preview 4734、4736；Chromium 1366×768、1280×768。需求 DR-MAT-001～004，用户已确认不同物料可分别染色、印花。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：AGENTS.md 第 4、5、7 节；修改物料选择交互、排版和新加工单生成规则。

## 3. 自查结论

| 项目 | 结论 | 说明 |
| --- | --- | --- |
| 角色与任务 | 管理端买手 | 同一页维护物料、费用和样衣要求 |
| 排版与导航 | 已检查 | 物料图片左对齐，选择器及加工信息上下排列；表格内部滚动，主体不溢出 |
| 搜索 | 通过 | 粘贴、名称匹配、无结果、清空、Esc、外部关闭；搜索不改已选值 |
| 加工规则 | 单元通过 | 双属性仅印花；纯染、纯印、无加工；不同物料独立生成单据 |
| 历史事实 | 保留 | 不删除既有加工单及交接，新提交按新规则；档案全局属性保持 |
| 数量与交接 | 单元通过 | 仓库直接发印厂；数量不重复，下游中央工厂实收后完成样衣归档 |
| 图片 | 通过 | 复用现有实物素材 white-poplin.png、blue-white-print-cotton.png；同物料格展示，大图沿用原组件 |
| 错误和恢复 | 单页回归通过 | 必填阻断保留草稿，保存刷新恢复；缺资料 SKU 阻止提交 |
| PDA / 打印 | 原页面未改 | 底层数量和新直接发料路径由实物流单元契约覆盖；历史链专项保留 |

## 4. 实施与验证

- W1：pcs-independent-sampling.ts 复用现有搜索处理器，物料下拉在单元格内展开，避免被表格 overflow 裁切。局部输入过滤/选择刷新，无整页重绘。
- W2：pcs-design-revision-material-sku.ts 按每行印花优先；pcs-engineering-master-sampling.ts 加工生成和原料入口同步。
- W3：current-flow 单元含混合三行和数量守恒；result-readiness 覆盖印厂直收至样衣归档；material-search 与 single-page 浏览器验证。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-independent-sampling.ts`
- `src/data/pcs-design-revision-material-sku.ts`
- `src/data/pcs-engineering-master-sampling.ts`

### 页面路由

- `/pcs/production-preparation/design-revision/new`
- `/pcs/production-preparation/design-revision/:id`
- `/pcs/production-preparation/design-revision`

### 验证命令

- `npm run build`：通过，445 项单元测试；新增混合物料契约后 current-flow 7/7 通过。
- `CUTTING_E2E_PORT=4734 CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_TEST_TIMEOUT=180000 npx playwright test tests/pcs-design-revision-single-page.spec.ts --workers=1 --reporter=line`：通过，组合运行中执行五轮。
- 搜索、容量与预览专项：8 项通过（首次 7/8，修正旧测试仍假定初始仅一条物料后，失败项重跑通过）。
- 首次测试失败记录：/tmp/dr-build.log（旧断言未调整为直接仓库调拨）、/tmp/dr-browser.log（脚本缺少必填目标）、/tmp/dr-browser2.log（图片按钮选择器错误）；修正后重新验证，未删除慢样本。

## 6. 最终结论

结论：通过。搜索 45 个样本最高 115.4ms，单页加载和操作 145 个样本最高 278.6ms，均小于 500ms；五条业务场景 5/5。最终 diff 已检查，无无关工作区文件纳入。未提交、未推送。

### 持久化证据

- `evidence/2026-09-24-material-search-performance.json`
- `evidence/2026-09-24-material-single-page-performance.json`
- `evidence/2026-09-24-material-layout.png`
- `evidence/2026-09-24-material-search-open.png`
- `/tmp/dr-browser3.log`、`/tmp/dr-browser4.log`：搜索、混合生成、容量、图片、普通来源不变、Mock 结果和失败恢复。
- `/tmp/dr-five.log`：无加工、仅染/印、混合单位、双属性直达印厂、完单归档。
- `/tmp/dr-mixed2.log`：每行独立数量，三行仅生成两张且无前序关系。

例外：无性能例外。已有历史双工艺加工单不自动撤销，继续按其已记录的事实追溯。

### 例外

- 无。
