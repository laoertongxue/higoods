# 设计改款列表：勾选首列与筛选区对齐

## 1. 基本信息

- 日期：2026-09-24
- 记录模式：完整产品审查
- 系统：PCS；端类型：管理端；角色：买手、管理人员。
- 页面：`/pcs/production-preparation/design-revision`
- 需求：勾选固定第一列；筛选样式和展开交互参照染色加工单。
- 验证工作树：`/Users/laoer/Documents/higoods`；分支 `codex/design-revision-list-layout`；基线 `8fe5a40082e5502fe3a4f6a128dbea1e98f34e2f`。
- 服务：当前工作树生产构建 `http://127.0.0.1:4734`。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：调整勾选列位置、筛选字段排版、操作按钮样式及更多筛选展开方式；不修改业务数据、筛选规则或工作流。
- 基线：AGENTS.md 第 4、5、7 节。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 保留标准管理列表结构，保留设计改款业务字段 |
| 文案、状态、数量与单位 | 通过 | 查询、统计、总数同步；导出当前筛选结果；未改变数量口径 |
| 对象识别与图片 | 通过 | 沿用现有图片与同列标识；图片预览和关闭回归通过 |
| 防错 | 通过 | 日期倒置保持阻断；旧列偏好与冻结任务号不能挤走勾选首列 |
| 低分辨率 | 通过 | 1366×768、1280×768 无页面横向溢出；表格内部滚动 |
| 交互 | 通过 | 更多筛选／收起更多局部更新，保留表格节点及勾选状态 |
| PDA、打印、弱网和上传 | 不适用 | 本次仅桌面列表布局，不变更这些入口 |

## 4. 问题标签

- 组件误用
- 视觉干扰

## 5. 主要问题与处理

| 问题 | 处理 | 剩余风险 |
| --- | --- | --- |
| 冻结任务号挤到勾选前 | 使用已有 leadingControlColumn 能力，固定勾选为首列且不可拖动 | 无已知问题 |
| 筛选字段标签同行、操作右对齐、details 展开 | 参照染色加工单的 grid、标签上置、控件高度、左侧按钮行，复用按钮与筛选展开组件 | 无已知问题 |
| 查询后高级条件自动收起 | 与染色单一致：存在高级筛选值时显示展开面板，重置后收起 | 无已知问题 |

## 6. 最终结论

结论：通过。当前代码满足本次两项调整。Mock 演示验证不代表真实业务已发生。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-independent-sampling.ts`

### 页面路由

- `/pcs/production-preparation/design-revision`

### 验证命令

- `npm run build`：通过（436 个单元测试及类型检查、生产构建）。
- `CUTTING_E2E_PORT=4734 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-list-actions.spec.ts tests/pcs-design-revision-list-performance.spec.ts --workers=1 --reporter=line`：通过（4 项）。
- 性能：Chromium 149、1366×768、24 条初始 Mock、5 个新浏览器上下文。53 场景各 5 次，共 265 样本，最大 353.4ms，全部 <500ms。包括冷进入、刷新、筛选展开收起、各筛选项、查询、重置、导出、分页排序、列设置与拖动、图片预览、跨页导航和复制。
- 原始性能证据：`evidence/2026-09-24-design-revision-list-layout-performance.json`，含构建 index SHA256。
- 页面截图：`test-results/design-revision-filters-1366.png`、`test-results/design-revision-filters-1280.png`。

- `npm run check:prototype-design-governance`：通过（已暂存的 1 个受管文件由审查记录覆盖）。
- `npm run check:list-page-governance:static`：通过（558 页面）。

### 真实图片验证

沿用当前本地款式资源和已标注的 Mock 概念图；图片数据、对应关系、失败态组件未修改。款式缩略图正常加载，预览及关闭各五次通过。

### 例外

- 无。未使用染色／印花加工单的 1 秒性能例外。
