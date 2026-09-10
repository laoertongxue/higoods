# 染色、印花加工单上下游整合审查

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 日期 | 2026-09-09 |
| 记录模式 | 完整产品审查 |
| 相关需求 | 用户确认的18节调整方案；`docs/染色印花加工单调整实施与验收.md`及89项原子矩阵 |
| 系统 | PFOS |
| 端类型 | 管理端、主管端桌面 |
| 角色任务 | 管理、跟单和主管核对投入、加工、交出及上下游接收 |
| 工作树 | `.worktrees/process-route-full-stage-incremental` |
| 基准 | `8d8f8ffd43d1000d9c852a1cffbb4c73e16bee12` 加本次声明范围改动 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：列表七列重组、投入来源及产出去向合并、筛选收拢、数量与字段纠错、详情交接说明和动作归组。
- 设计基线：AGENTS.md 第4、5、7节。未修改技术包、其他工艺或PDA业务。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理列表 |
| 文案、状态、数量与单位 | 通过 | 三状态独立、已收不等于已用、未知不填零 |
| 扫码、真实图片与对象识别 | 不通过 | 交互通过；正式色样、部分实际投入图、正式花型和产出图缺失，列为阻塞 |
| 防错、危险确认与主管兜底 | 通过 | 保留原编辑约束与打印对象检查 |
| 交接、跨端事实与异常追溯 | 通过 | 上下游复用现有原型交接关系，不新增替代账 |
| 低分辨率 | 通过 | 1366×768与1280×720；PDA、弱网上传本次不新增 |
| 命名路由、交互、图片大图与打印 | 通过 | 浏览器和既有打印预览 |

## 4. 问题标签

- 字段过载
- 算不准
- 追溯不足
- 视觉干扰

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 染色已收当已用、差值当损耗 | 算不准 | 主管、跟单 | 按实际加工记录及未知量区分 | 专项通过 |
| 上下游分散且列重复 | 字段过载 | 管理、主管 | 七列统一，投入／上游、产出／下游 | 浏览器通过 |
| 技术编号或演示图片冒充业务资料 | 追溯不足 | 工艺、主管 | 准确取值或明确缺失 | 缺失素材须单列 |

## 6. 最终结论

结论：不通过完整验收。89项原子需求中84项已验证、5项因正式业务资料缺失已阻塞；页面功能已调整，但不得宣称全部验收通过。详见逐项矩阵及结果清单。

## 7. 变更覆盖与验证

### 受管文件

- `src/main.ts`

- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/dyeing/work-order-overlays.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/dye-work-order-online-domain.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/process-order-three-axis-view.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/process-factory/printing/work-order-detail.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/pages/process-factory/printing/relations.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/pages/print/templates/dye-work-order-flow-card-template.ts`
- `src/pages/print/templates/printing-work-order-template.ts`

### 页面路由

- `/fcs/craft/dyeing/work-orders`
- `/fcs/craft/printing/work-orders`
- 上述列表可达的详情、图片和打印预览。

### 验证命令

- `npx --offline tsc --noEmit --pretty false`：通过。
- `npm run build`：通过。
- `node --import tsx scripts/check-dye-list-unified.ts`：通过。
- `node --import tsx scripts/check-dye-work-order-online-alignment.ts`：通过。
- `node --import tsx scripts/check-dye-material-receipts.ts`：通过。
- `node --import tsx scripts/check-dye-list-reentry.ts`：通过。
- `node --import tsx scripts/check-printing-two-end-list.ts`：通过。
- `node --import tsx scripts/check-printing-output-documents.ts`：通过。
- `node --import tsx scripts/check-printing-partial-batches.ts`：通过。
- `node --import tsx scripts/check-printing-legacy-view-projection.ts`：通过。
- `node --import tsx scripts/check-preparation-real-receipt-chain.ts`：通过。
- `node --import tsx scripts/check-process-order-three-axis-flow.ts`：通过。
- `node --import tsx scripts/check-printing-work-order-redesign.ts`：失败。PH-20260328-003实际投入缺少对应图片；保留图片完整性门禁，未修改为宽松通过。
- `git diff --check`（本次声明文件）：通过。
- `codegraph sync` 与 `codegraph status`：通过，当前工作树索引最新。
- 证据目录：`output/playwright/process-order-review/`。
- 存在工作区其他改动，任务验证只声明本次文件范围。

- `node --import tsx scripts/check-dye-list-snapshot.ts`：通过，路由重入重读已变更接收事实。
- `node --import tsx scripts/check-printing-list-snapshot.ts`：通过，业务保存刷新新事实。
- 浏览器查询计时：通过，染色47.3ms、印花47.4ms；根节点不重建。

### 治理检查补充

- `npm run check:prototype-design-governance`：通过；默认仅检查暂存区，本次未暂存。
- `npm run check:list-page-governance`：通过；命令链自带全工作区治理，381页静态检查和标准列表拖动检查通过。这是治理结果，不表示其他67个可见变更全部属于本任务或业务验收通过。
- `validatePrototypeReviewCoverage`（仅task-files.json声明的本次文件）：通过，证据为task-governance-coverage.log。

### 真实图片验证

- 已有物料图来源包括本地物料档案、`public/materials/sources.json`和加工单图片映射。
- 16组浏览器断言通过：两页各两个尺寸、筛选与选择、详情、分页、末行操作、图片放大/Esc，以及列偏好/冻结和网络失败提示。大图保持比例。四类打印预览已检查：染色流程卡、印花信息单、批量确认单、实际卷标签；未连接实体打印机。
- 当前图片按对象同块展示。计划图片不能替代历史实际投入图，样衣图不能替代正式花型；未核验产出图明确为参考。缺项见 `output/playwright/process-order-review/*-missing-assets.json` 和 `printing-actual-material-gaps.json`。
- 缺失正式色样、花型或产出图片不得使用无关图片补齐。

### 例外

- 工作区存在既有无关差异；完整workflow:verify会绑定全部差异，故未运行，避免将他人改动纳入本次收据。只保存本次文件指纹、专项和页面证据。
- 需求UP-01、DOWN-01、DYE-01、PRINT-01、DET-02因业务资料缺失阻塞，不能以Mock参考素材宣称通过。
- 未发布远端；本次为本地原型实现与验收，不代表工厂实际业务发生。

### 性能修正边界

`src/main.ts`只在两个命名路由且事件对象属于对应列表根节点时直接调用已有页面处理器。未改变其他路由分发或新增业务权限。列表只缓存本页事实快照，路由进入/业务保存后重读；输入控件显式局部更新标记防止旧控件脱离DOM后的异步重绘。
