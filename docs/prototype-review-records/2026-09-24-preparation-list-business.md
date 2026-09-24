# 生产准备单列表业务信息与染色加工单对齐

## 1. 基本信息

- 日期：2026-09-24；PCS 管理端，跟单。
- 需求：PREP-LIST-001～010；来源 `docs/product-design/生产准备单列表业务信息与染色列表对齐-2026-09-24.md`。
- 分支：codex/preparation-list-business；基线 aac68249a0d32dcd71807811684ebf94dbf7cc79。
- 记录模式：完整产品审查。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：筛选卡片、六个统计卡片、业务分组列、查询/重置/导出、当前任务和来源链接改变。
- 基线：AGENTS.md 第 4、5、7 节。参照 `/fcs/craft/dyeing/work-orders`，复用其统计卡片组件和标准列表、按钮、列设置及分页组件。
- 不引入工厂 Tab、染色字段、批量业务操作或新的业务持久化。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色与页面模式 | 通过 | 跟单直接看到当前事项、责任、计划和前置 |
| 文案、状态、数量 | 通过 | 任务数有“项”；BOM 有“个版本”；关闭单无执行待办 |
| 跨端事实与来源 | 通过 | 只读现有主单、任务、档案、测款；最近测款不冒充创建依据 |
| 防错 | 通过 | 日期倒置阻断查询；无记录阻断导出；原创建资格未改变 |
| 图片、设备、性能 | 通过 | 1366/1280，真实图、大图/失败态、每项5次性能均通过 |

## 4. 问题标签

- 字段过载：采用按业务分组列与事项展开，避免简单加宽字段堆积。
- 协作断裂：增加团队/责任人/计划与未完成前置。

## 5. 主要问题与处理

旧列表仅有单号、状态和总进度；旧筛选输入直接刷新列表、统计仍取全量。现使用待查询与已查询两个页面内存条件集，查询后列表/统计/总数/导出一致；无业务状态写入。当前事项只读任务字段，不新增未经确认的超时规则。

## 6. 最终结论

结论：通过

本轮已实现并验证；产品已确认方向，最终页面待用户确认。未合并 main 或发布线上。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-engineering-master-list.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/data/pcs-engineering-master-list-query.ts`

### 页面路由

- `/pcs/production-preparation/orders`

### 验证命令

- `node --import tsx --test tests/unit/pcs-preparation-list-business.test.ts tests/unit/pcs-preparation-testing-eligibility.test.ts`：通过，4 项专项。
- `npm run build`：通过，453 项单元测试通过。
- `npm run check:prototype-design-governance -- --all`：通过（干净工作树仅本任务变更）。
- `npm run check:list-page-governance`：通过，包含标准表格真实拖动检查。

### 真实图片验证

- 来源：款式档案图片，未替换原资源；图片和 SPU 在“准备单／款式”同列。
- 缺失显示缺少款式图片；缩略图有加载中及加载失败状态；复用原图弹窗与 Escape 关闭。
- 最终浏览器证据：`output/playwright/preparation-list-business-browser.json`、截图与原始测量脚本。

### 例外

- 用户明确指定染色页统计样式，本轮复用其 72px 高六卡组件，不修改公共统计组件；其余按标准列表规则。
- 本次仅展示/查询/导出，无业务持久化变更，按 2.4.2 不迁移整个旧主单仓库。旧演示初始化及创建/执行的 localStorage 依赖登记在需求文档，未宣称已完成迁移。
- 列偏好键 `/pcs/production-preparation/orders:list-preferences-v2`，仅六列顺序/显隐/冻结和每页数量，规范化后固定键集合小于1KiB，默认10条、不冻结；读写失败默认。业务附件无变更。PDA/打印不适用。

### 当前版本浏览器证据

- 预览 `http://192.168.5.10:4192/pcs/production-preparation/orders`，独立工作树 `/tmp/higoods-preparation-list-business`；Chromium 154.0.8037.58。
- `output/playwright/preparation-list-business-browser.json`：231 个样本，最大 284.3ms，无失败；21 条验收场景（同一 SPU 的20张已关闭历史单和1张进行中单），仅存在隔离验收浏览器。查询/日期边界/重置/无匹配/导出/分页/每页条数/排序/列设置/隐藏/冻结/恢复/事项展开收起/图预览/创建弹窗等每项5次。未更改创建与保存逻辑。
- `output/playwright/preparation-list-extra.json`：5个全新浏览器上下文首次进入，原始 453.9、436.3、433.0、434.5、436.4ms；来源/详情路由复核、Esc关闭、图片加载失败态通过。
- `output/playwright/preparation-export-0.csv` 至 `preparation-export-4.csv`：逐份读取确认含20条匹配记录（界面每页10条），无操作列。
- `output/playwright/preparation-list-business-21-fixture-1366.png`、`preparation-list-business-21-fixture-1280.png`：分组业务行、低分辨率主体无横向溢出，宽表在容器内滚动。
- 测量脚本 `output/playwright/preparation-list-performance.js`、`preparation-list-extra.js`；源文件哈希 `preparation-list-version.json`。
- 初次脚本仅派发change未派发select的input事件，断言失败，保留 `preparation-list-business-browser-initial-selector-failure.txt`；已改为浏览器正常input+change序列重新测量，未通过改页面规避问题。

- `output/playwright/preparation-list-final-check.json`：专业任务入口与列拖动各5次；对应脚本 `preparation-list-final-check.js`。关闭列设置时初次脚本选择器命中多个关闭入口，已限定关闭按钮并重测，原始失败记录保留。

### 2026-09-25 后续版本

本文件此前截图和测量保留为上一阶段证据。准备单最新增加内部明细进度，并排除因需求变更结束的等待项；当前实现、父单页面复验、源码版本和七类专业列表的联查证据以 `2026-09-25-professional-task-business-lists.md` 为准。
