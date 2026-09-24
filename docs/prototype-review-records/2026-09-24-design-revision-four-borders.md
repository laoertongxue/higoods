# 新建设计改款四个分区边框

## 1. 基本信息

PCS 管理端买手；完整产品审查。用户要求按截图为四个业务区域加线框。分支 main，基线 5089030c60ed2afa156039e7e8561d626c3c31b2，工作树 /Users/laoer/Documents/higoods。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：仅为基本信息与设计稿、物料与加工要求、费用与综合成本、销售展示样衣制作安排四个外层容器增加 1px 浅灰色边框。保留既有圆角和间距，不改变字段、数据、交互。依据 AGENTS.md 第 4、5、7 节和本次用户截图。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 页面模式、文案与数量 | 通过 | 只修改四个容器 class |
| 图片与对象识别 | 通过 | 图片与预览沿用原实现 |
| 命名路由、低分辨率和性能 | 通过 | 新建、保存、提交及五轮浏览器回归 |

## 4. 问题标签

视觉分组不清晰。

## 5. 主要问题与处理

按用户红框位置增加浅灰边框，红色仅为截图标注色。每区一层，不增加总外框或多层嵌套。

## 6. 最终结论

结论：通过。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-independent-sampling.ts`

### 页面路由

- `/pcs/production-preparation/design-revision/new`
- `/pcs/production-preparation/design-revision/:samplingTaskId`

### 验证命令

- `npx vite build`：通过
- `CUTTING_E2E_PORT=4734 CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_TEST_TIMEOUT=150000 npx playwright test tests/pcs-design-revision-single-page.spec.ts --workers=1 --reporter=line`：通过

### 例外

- 无；不适用 PDA、打印、数据库和实际业务修改。

浏览器验证：同工作树 preview 4734，1366×768 与 1280×768；29 项各五次，共 145 个样本，最大 299.70ms，全部 <500ms。新建、上传、物料／费用编辑、保存与提交回归通过。证据位于 docs/prototype-review-records/evidence/2026-09-24-four-borders-performance.json 及同名前缀 top、bottom 截图。
