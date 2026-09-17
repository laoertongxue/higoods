# 印花加工单列表按钮位置调整

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-17 |
| 相关需求 / 任务 | 用户截图：删除顶部两个交出快捷按钮；批量打印移至列表头部、列设置左侧 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS |
| 涉及页面路径 | /fcs/craft/printing/work-orders |
| 端类型 | 管理端 / 主管端桌面 |
| 主要角色与任务 | 印花主管选择加工单，批量打印印花确认单 |
| 版本与服务 | codex/move-early-process-orders-to-fcs；HEAD c56c80fb；同工作树 Vite 4176 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：仅调整印花加工单列表的操作区，删除顶部“待交出列表”“交出单据”按钮及空操作行，把原批量打印按钮原样迁入列表表头，紧邻列设置左侧。

依据 AGENTS.md 第 4、5、7 节执行。延续上一轮染色印花管理迁移，本轮仅修改下面一个页面文件，不重述此前功能交付。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 批量操作与列表选择范围放在同一表头，右侧末位仍为列设置。 |
| 文案、状态、数量与单位 | 通过 | 保留“批量打印印花确认单（数量）”；未选为 0，选择一单后为 1。 |
| 扫码、真实图片与对象识别 | 通过 | 当前截图中的款式和物料真实缩略图与名称/编码同列；图片渲染未变。扫码不涉及。 |
| 防错、危险确认与主管兜底 | 通过 | 未勾选时禁用，选择后生成对应订单的确认单预览链接。未新增危险动作。 |
| 交接、跨端事实与异常追溯 | 通过 | 仅删除该列表顶部的两个快捷按钮，交出事实、详情与菜单入口不变。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768、1280×720 均同行排列；PDA、上传和弱网不涉及。 |
| 命名路由、交互、图片大图与打印 | 通过 | 实际命名路由验收；勾选后根节点保持。预览参数仍为 PRINTING_CONFIRMATION / PRINTING_WORK_ORDER 与所选 ID；打印内容及图片大图处理未变，不重复验证。 |

## 4. 问题标签

- 视觉干扰

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 批量打印远离列表选择区，顶部有多余交出快捷按钮 | 视觉干扰 | 印花主管 | 删除两个按钮与空操作行；复用原批量打印渲染，在表头列设置左侧展示 | 否 |

## 6. 最终结论

结论：通过

页面布局、禁用状态、选择计数与预览链接已验收；本地源码和文档差异的最终技术验证绑定任务收据，未提交或推送。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/printing/work-orders.ts`

### 页面路由

- `/fcs/craft/printing/work-orders`

### 验证命令

- `git diff --check`：通过。
- `npx --offline --package @playwright/cli playwright-cli -s=early-migration run-code --filename=/private/tmp/printing-list-actions-check.js`：通过，按钮缺席、两种分辨率位置、选择计数、禁用、打印链接及 DOM 根节点检查通过。

最终任务收据由 `npm run workflow:verify` 生成，保存于 `/private/tmp/printing-list-actions/task-receipt.json`。收据绑定本分支既有迁移及本轮按钮调整的全部未提交差异，并提供原型治理、列表治理、构建与 CodeGraph 同步的实际退出结果。

### 真实图片验证

本次不修改图片或物料/商品事实；当前浏览器截图可见原有物料与款式缩略图。此前同工作树的大图关闭与失败反馈验证仍适用于未变更的图片组件，见上一轮迁移审查记录。

### 例外

- 未新增单元测试：本次是可逆的按钮布局调整，使用实际页面的直接断言验证。
- 全仓既有类型错误属于此前记录的范围外问题，本次不扩展修改。

### 证据位置

- `output/playwright/printing-list-actions/verification.json`
- `output/playwright/printing-list-actions/header-1366.png`
- `output/playwright/printing-list-actions/header-1280.png`
- `output/playwright/printing-list-actions/selected-batch-print.png`
- `/private/tmp/printing-list-actions/task-receipt.json`
