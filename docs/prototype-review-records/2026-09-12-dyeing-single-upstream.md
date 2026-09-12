# 染色加工单单一投入与上游审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-12 |
| 相关需求 | SU-001..006，见单一上游设计及追踪矩阵 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS 染厂管理 |
| 端类型 | 管理端、主管端 Web |
| 角色与任务 | 跟单查看染色投入来源；仓管接收与备料关联 |
| 验证版本 | codex/dyeing-single-upstream，基于 7a1fd0d8；同目录运行 5188 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：删除 DWO-002 额外投入规格，解除未操作 RCV-SRC-003 的错误染色关联。同一上游多单据仅显示一次组织资料。备料分配增加同上游约束，详情不再要求手填其他投入 SKU。
- 基线：AGENTS.md 第 4、5、7 节。仅原型演示，不操作真实工厂数据。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 保持标准管理列表与接收步骤 |
| 文案、状态、数量与单位 | 通过 | 22 行单一 SKU/上游；分批来源单号、发出量、状态保留 |
| 扫码、真实图片与对象识别 | 通过 | 原物料图片保留，来货条码不改 |
| 防错、危险确认与主管兜底 | 通过 | 其他 SKU/上游不能关联；无匹配时库存保留备料 |
| 交接、跨端事实与异常追溯 | 通过 | 两次 100 Yard 实收，刷新累计 200 Yard；未修改已操作历史 |
| 低分辨率与输入 | 通过 | 1366×768、1280×720 无主体横向溢出；数量填写并提交正常 |
| 命名路由、交互、图片大图 | 通过 | 列表、查看、接收及备料关联实测；关闭、遮罩、Esc 与失败状态通过 |

## 4. 问题标签

- 选不对
- 字段过载

## 5. 主要问题与处理

| 问题 | 处理 | 剩余影响 |
| --- | --- | --- |
| 不同上游错误绑定同一染色单 | 错绑未操作演示改为备料；新关联校验上游 | 已操作旧历史保留，冲突时阻止继续混入来货 |
| 同仓多单重复组织资料 | 组织资料去重，来源单据逐笔保留 | 无 |
| 旧多投入测试允许混料 | 按用户最新规则改为错误 SKU 拒绝 | 毛织多纱线保持原规则 |

## 6. 最终结论

结论：通过

已完成本次原型代码与页面两轮验收，不代表生产接收业务已执行或用户已接受版本。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/dye-work-order-demo-details.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/factory-receiving-links.ts`
- `src/data/fcs/factory-receiving-mock.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/pages/process-factory/dyeing/pending-receipts.ts`
- `src/pages/process-factory/dyeing/work-order-detail.ts`
- `src/pages/process-factory/dyeing/work-order-overlays.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`

### 页面路由

- `/fcs/craft/dyeing/work-orders`
- `/fcs/craft/dyeing/pending-receipts`
- `/fcs/craft/dyeing/work-orders/DWO-007`

### 验证命令

- `node --import tsx scripts/check-dyeing-single-upstream.ts`：通过
- `node --import tsx scripts/check-dyeing-list-sections.ts`：通过
- `node --import tsx scripts/check-dyeing-quantity-reconciliation.ts`：通过
- `node --import tsx scripts/check-factory-material-receiving.ts`：通过
- `node --import tsx scripts/check-factory-receiving-integration.ts`：通过
- `node --import tsx scripts/check-dyeing-audit-closure.ts`：通过
- `node /private/tmp/dye-single-upstream-acceptance/browser.mjs`：通过
- `npm run typecheck:engineering`：通过
- `npm run check:prototype-design-governance`：通过
- `npm run workflow:verify -- --output /private/tmp/dye-single-upstream-acceptance/task-receipt.json --task-boundary "SU-001..006 染色单单一物料与上游"`：通过（verified，无阻断；CodeGraph 同步成功、待同步文件为 0）

第一轮：新演示 22 行、来源与关联拒绝契约、原数量及毛织回归。第二轮：当前浏览器验证旧演示刷新、实际分批接收、备料关联限制及刷新数量。证据目录 `/private/tmp/dye-single-upstream-acceptance/`，浏览器结果 `browser-results.json`。

### 真实图片验证

- 沿用 `public/materials/fei-ticket/`、`public/materials/process-orders/` 对应物料图片，蓝白花棉布与棉氨针织布名称、SKU、规格同块展示。
- 22 行资源存在性通过；可见列表缩略图全部加载成功；1280 下大图关闭按钮、遮罩、Esc 均通过；拦截图片加载显示“图片加载失败”，恢复后重新正常显示。
- 截图：`single-upstream-1366.png`、`single-upstream-1280.png`、`single-upstream-detail.png`、`material-enlarged.png`、`image-failure.png`、`wrong-origin-reserve.png`、`split-receipts-reload.png`、`next-batch-single-input.png`。

### 例外

- 已送货或实收的旧错误关联不静默覆盖，历史与数量继续保留；只有完全未操作且内容匹配旧演示的记录会自动修正。后续错误关联接收会明确阻断。
- PDA、打印、毛织页面未修改，不重复页面验收；毛织接收、净重库存、刷新与重试由原专项回归验证。
