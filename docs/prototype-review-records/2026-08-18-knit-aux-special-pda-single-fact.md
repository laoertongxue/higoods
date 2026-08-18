# 毛织、辅助工艺、特种工艺 PDA 单一加工单事实原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-18 |
| 相关需求 / 任务 | `FACT-001`～`VERIFY-001` |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/pda/handover`、`/fcs/pda/exec`、`/fcs/pda/exec/:taskId`、`/fcs/pda/warehouse`、两个旧仓管兼容路由 |
| 端类型 | 员工执行端 |
| 主要角色与任务 | 交接员确认接收 / 发起交出；操作员加工填报 / 完成加工单，毛织操作员关联横机设备 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：毛织、辅助工艺、特种工艺的确认接收 / 发起交出迁入 `交接`，加工填报 / 完成及毛织横机操作收口到 `执行`；新增生产单 / 加工单扫码识别、候选图片和聚焦操作页；仓管删除三类工艺专属入口，旧 URL 改为职责跳转。
- 当前治理基线：`AGENTS.md` 第 4 节员工执行端设计、第 5 节 UI / 真实图片门禁和第 7 节验证原则。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 交接两动作、执行两动作加毛织专属横机；首屏聚焦当前加工单和动作。 |
| 文案、状态、数量与单位 | 通过 | 页面使用当前动作语言；数量沿用 kg / 件等原领域单位，不展示技术状态码。 |
| 扫码、真实图片与对象识别 | 通过 | 三类工艺均支持生产单 / 加工单精确识别；候选同块展示真实款式图、加工单、生产单和款号。 |
| 防错、危险确认与主管兜底 | 通过 | 多加工单不猜测，跨厂 / 状态 / 错误 Tab 动作阻断；完成和交出继续使用原领域确认门禁。 |
| 交接、跨端事实与异常追溯 | 通过 | PDA 操作复用原加工单写入口；旧仓管不再生成第二套加工事实。 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 400×806、360×800 无横向溢出；本次原型不新增真实弱网、上传或离线能力。 |
| 命名路由、交互、图片大图与打印 | 通过 | 三类执行 / 交接、旧 URL、图片大图与 `Esc` 已验收；本次无打印页面。 |

## 4. 问题标签

- `点错风险`
- `缺扫码识别`
- `协作断裂`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 确认接收、发起交出错误出现在执行 Tab | `点错风险` | 交接员、操作员 | 拆分 Tab 动作白名单，并在事件执行层再次校验 | 否 |
| 三个高频动作不能优先扫生产单 / 加工单 | `缺扫码识别` | 交接员、操作员 | 新增精确解析、回车识别和多候选选择 | 否 |
| 仓管保留第二套加工单写逻辑 | `协作断裂` | 仓管、交接员、操作员 | 删除专属菜单、页面、状态、处理器、动作文件和旧专项，旧 URL 只跳交接 | 否 |

## 6. 最终结论

结论：有条件通过。

说明：页面、核心专项、构建、原型治理、控制台和局域网访问均已形成当前工作树直接证据。隔离工作树没有初始化 CodeGraph，因此 CodeGraph 同步和依赖它的任务收据未闭环，本次状态只能标记为 `implemented`，不能标记为 `verified`。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/ui/pda-image-preview.ts`
- `src/data/fcs/factory-mobile-todo-routes.ts`
- `src/data/fcs/factory-mobile-todos.ts`
- `src/data/fcs/special-craft-pda-scan.ts`
- `src/data/fcs/special-craft-pda-warehouse-actions.ts`（删除）
- `src/data/fcs/wool-pda-scan.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-exec.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-warehouse-wait-handover.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/pda-warehouse.ts`
- `src/pages/pda-wool-fact-execution.ts`

### 页面路由

- `/fcs/pda/handover?tab=pickup`
- `/fcs/pda/handover?tab=handout`
- `/fcs/pda/exec`
- `/fcs/pda/exec/:taskId`
- `/fcs/pda/warehouse`
- `/fcs/pda/warehouse/wait-process?action=receive`
- `/fcs/pda/warehouse/wait-handover?action=handover-confirm`

### 验证命令

- `npm run check:knit-aux-special-pda-single-fact`：通过。
- `npm run build`：通过；仅有既有大 chunk 提示。
- `git diff --check`：通过。
- `npm run check:prototype-design-governance -- --all`：通过，13 个用户可见文件关联 1 份审查记录。
- 生产代码旧标识残留扫描：无结果。
- `npm run workflow:verify -- --output /private/tmp/higoods-pda-task-receipt.json --task-boundary "毛织、辅助工艺、特种工艺 PDA 单一事实、Tab 分工、扫码与旧仓管旁路删除"`：失败；CodeGraph 状态缺少 `pendingChanges`。
- CodeGraph status：失败；隔离工作树未初始化 CodeGraph。

### 页面与设备证据

- 400×806 辅助工艺确认接收：`output/playwright/pda-aux-handover-receive-400x806.png`
- 400×806 辅助工艺生产单多候选：`output/playwright/pda-aux-receive-production-multiple-400x806.png`
- 400×806 辅助工艺聚焦执行：`output/playwright/pda-aux-execution-focused-400x806.png`
- 400×806 款式大图：`output/playwright/pda-aux-style-image-preview-400x806.png`
- 360×800 辅助工艺发起交出：`output/playwright/pda-aux-handover-handout-360x800.png`
- 360×800 特种工艺确认接收：`output/playwright/pda-special-handover-receive-360x800.png`
- 360×800 特种工艺聚焦执行：`output/playwright/pda-special-execution-360x800.png`
- 400×806 毛织执行扫码：`output/playwright/wool-pda-exec-scan-400x806.png`
- 360×800 毛织确认接收：`output/playwright/wool-pda-handover-receive-360x800.png`
- 360×800 毛织发起交出：`output/playwright/wool-pda-handover-handout-selected-360x800.png`
- 360×800 毛织款式大图：`output/playwright/wool-pda-image-preview-360x800.png`
- 浏览器控制台最终结果：0 error、0 warning。
- 当前隔离工作树服务：`0.0.0.0:4318`；`http://127.0.0.1:4318/fcs/pda/handover?tab=pickup` 与 `http://192.168.1.124:4318/fcs/pda/handover?tab=pickup` 均返回 200。

### 真实图片验证

- 图片来源：现有款式 / 加工单 Mock 的正式图片 URL，不新增通用占位图。
- 对象对应：扫描解析返回当前加工单的款式图，缩略图与加工单、生产单、款号和加工对象处于同一信息块。
- 大图：点击辅助工艺款式图打开大图，保持比例且未溢出 400×806；`Esc` 可关闭。
- 失败态：共享 PDA 图片组件监听加载失败并显示“图片加载失败”，保留文字标识供人工核对。

### 例外

- 隔离工作树没有 `.codegraph`，未经用户确认未初始化；最终不能将 CodeGraph 同步状态标记为通过。
- `check:wool-warehouse-unified-model` 的模型段在既有浏览器持久化断言 `legalPersistedStore` 失败；其本地交互段单独运行通过。本次 diff 未修改该持久化实现。
- 两个历史仓储统一模型专项在到达本次新增断言后，分别因既有 Mock 缺少“辅助工艺交出记录”和“成衣交出待交出库存投影”失败；本次不修改无关 Mock / 基线。
