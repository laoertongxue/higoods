# 设计改款筛选条件连续排列

## 1. 基本信息

PCS 管理端设计改款列表。用户要求展开更多筛选时上一行排满后再换行。main 基线 3a2389d42edd3d19772a4cf16249748950a44f5a，工作树 /Users/laoer/Documents/higoods，当前工作树构建 preview 4734。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：将基础与更多筛选放入同一个响应式网格；更多筛选容器展开时使用 display:contents，使字段顺序填补首行空位。收起仍隐藏额外条件，操作栏保留独立一行。依据 AGENTS.md 第 4、5、7 节。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 页面模式及业务字段 | 通过 | 字段、查询口径、按钮保持一致 |
| 响应式布局、展开收起 | 通过 | 1366 和 1280 宽度验证基码纸样、染印组合接续首行 |
| 图片、数量、交接 | 通过 | 无变更，沿用原页面 |
| 性能与命名页面 | 通过 | 完整列表专项及五轮性能 |

## 4. 问题标签

视觉干扰、布局留白。

## 5. 主要问题与处理

移除更多筛选独立网格及额外上边距，使全部可见字段由同一网格自动换行；展开收起保持局部更新。

## 6. 最终结论

结论：通过。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-independent-sampling.ts`

### 页面路由

- `/pcs/production-preparation/design-revision`

### 验证命令

- `npx vite build`：通过
- `CUTTING_E2E_PORT=4734 CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_TEST_TIMEOUT=150000 npx playwright test tests/pcs-design-revision-list-actions.spec.ts tests/pcs-design-revision-list-performance.spec.ts --workers=1 --reporter=line`：通过

### 例外

- 无。PDA、打印、数据库不适用。

验证结果：4 项浏览器专项通过，83 项场景各测 5 次，共 415 个样本，最大 484.70ms，全部 <500ms。Chromium 149.0.7827.55，24 条 Mock，隔离浏览器冷启动、刷新与交互。原始证据 docs/prototype-review-records/evidence/2026-09-24-filter-flow-performance.json；截图同目录 filter-flow-1366.png、filter-flow-1280.png。
