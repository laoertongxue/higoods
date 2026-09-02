# 后道 Web 兜底与 PDA 数量归类原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-02 |
| 相关需求 / 任务 | PFWF-001～PFWF-023；后道待加工仓扫码收货、Web 应急处理、PDA 完成数量、无前置瑕疵调整、逐原因瑕疵增减、日志详情分层 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS / PFOS |
| 涉及页面路径 | `/fcs/craft/post-finishing/wait-process-warehouse`、`/fcs/craft/post-finishing/work-orders`、`/fcs/craft/post-finishing/work-orders/:id`、`/fcs/pda/post-finishing/execute`、`/fcs/pda/post-finishing/sku-adjustment`、`/fcs/craft/post-finishing/audit-records` |
| 端类型 | 管理端 / 员工执行端 |
| 主要角色与任务 | 后道仓管扫码收货；后道操作员逐 SKU 填写完成数量或直接按原因登记瑕疵/返厂；管理人员在 PDA 故障时通过 Web 接管；追溯人员分层查看业务链、差异和操作记录 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：Web 待加工仓恢复明确的扫码收货兜底入口；后道单列表和详情新增 Web 应急操作；PDA 后道加工以完成数量为主，质检项目只读，独立 SKU 页按原因增减瑕疵并选择返厂接收对象；差异与操作日志详情改为三个互斥层级。共享草稿、完成门禁和接管日志会改变用户看到的进度、按钮状态和完成结果。

审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | PDA 首选填写完成数量，Web 明确标注故障兜底；追溯页采用管理端信息层级。 |
| 文案、状态、数量与单位 | 通过 | 按钮使用“扫码收货”“PDA执行”“Web应急处理”“调整瑕疵数量”等动作词；加工中每张 SKU 卡片始终显示调整入口，未保存完成数量时也可直接登记瑕疵；整批瑕疵显示合格 0 件。 |
| 扫码、真实图片与对象识别 | 通过 | Web 同一输入框支持扫码枪回车和手工完整单号；PDA 后道单和独立调整页保留 SKU 对应图片、颜色、尺码和数量。 |
| 防错、危险确认与主管兜底 | 通过 | 部分登记后仍有未归类数量时界面和领域双重阻断；整批瑕疵不受完成数量前置阻断；逐原因减少不得超余额；Web 接管要求原因并留痕。 |
| 交接、跨端事实与异常追溯 | 通过 | PDA 与 Web 继续同一加工草稿；15 条跨端业务链验证接管后仍生成同一复检、出货和收货事实。 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 360×800、390×844、400×806 本地浏览器小屏已验收；真实 PDA、现场弱网和真实图片上传未在本次执行。 |
| 命名路由、交互、图片大图与打印 | 通过 | 命名路由、独立调整页、图片加载/失败/大图及既有四类打印浏览器场景通过；本轮未修改打印格式。 |

## 4. 问题标签

- `字段过载`
- `协作断裂`
- `追溯不足`
- `视觉干扰`
- `缺扫码识别`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| Web 待加工仓入口未清楚表达扫码收货 | 缺扫码识别 | 后道仓管 | 恢复“扫码收货（Web 兜底）”，扫码枪回车和手工完整单号共用定位逻辑 | 否 |
| 后道现场动作只有 PDA 入口 | 协作断裂 | 后道操作员 / 管理人员 | Web 保留开始、接管、完成数量、SKU 调整和完成的同事实兜底链 | 否 |
| 后道再次要求勾选质检已确定的加工项目 | 字段过载 / 业务重复 | 一线操作员 | 项目改为只读，主页面只填写完成数量 | 否 |
| 瑕疵总数只能归到一个原因 | 数量失真 | 一线操作员 / 追溯人员 | 改为增加/减少模式下逐原因填写数量，总数自动求和 | 否 |
| 调整瑕疵被错误绑定在已填完成数量之后 | 协作断裂 / 数量失真 | 一线操作员 | 取消前置门禁；未填完成数量时按应加工数量校验，整批瑕疵自动形成合格 0 件结果 | 否 |
| 责任方与现场证据占用后道调整页 | 字段过载 / 视觉干扰 | 一线操作员 | Web/PDA后道调整页与提交参数全部删除 | 否 |
| 返厂接收责任为自由文本 | 点错风险 | 一线操作员 | 改为可搜索候选列表，PDA使用大触控候选样式 | 否 |
| 日志详情链路、差异、瑕疵和时间线全部展开 | 追溯不足 / 视觉干扰 | 管理与追溯人员 | 改为链路概览、差异与瑕疵、操作时间线三个互斥层级，时间线按阶段分组 | 否 |

## 6. 最终结论

结论：有条件通过

说明：

- 后道加工项目只读展示质检确认结果；每个 SKU 填写完成数量或将整批全部归入瑕疵/返厂后允许完成。
- 瑕疵调整已按原因分别增减，责任方与现场证据图片已从后道调整删除；返厂接收对象已在 360px 浏览器中完成搜索与选择。
- 最后一次纠偏后命名浏览器回归 3/3 通过：PDA 调整入口与整批瑕疵 2/2，Web 未填完成数量直接调整 1/1；此前同分支 15 条跨端业务链 1/1 通过（8.9 分钟），覆盖 PDA 保存首个 SKU 后 Web 应急接管继续。
- 条件仅指真实 PDA 设备、现场扫码枪、弱网、现场照片与生产数据未在本次执行；这些证据不能由本地自动化替代，也不计作现场通过。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/post-finishing-full-flow.ts`
- `src/pages/pda-post-finishing-flow.ts`
- `src/pages/process-factory/post-finishing/audit-records.ts`
- `src/pages/process-factory/post-finishing/events.ts`
- `src/pages/process-factory/post-finishing/warehouse.ts`
- `src/pages/process-factory/post-finishing/work-order-detail.ts`
- `src/pages/process-factory/post-finishing/work-orders.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pda.ts`
- `src/main-handlers/pda-handlers.ts`

附加交互分发文件：

- `src/main.ts`

### 页面路由

- `/fcs/craft/post-finishing/wait-process-warehouse`
- `/fcs/craft/post-finishing/work-orders`
- `/fcs/craft/post-finishing/work-orders/PF-POST-PF-ACCEPT-PO-1-1`
- `/fcs/pda/post-finishing/execute?id=HD-POQC202608001-05`
- `/fcs/pda/post-finishing/sku-adjustment?id=HD-POQC202608001-05&skuId=SPU-QC-001-S`
- `/fcs/craft/post-finishing/audit-records?deliveryId=PF-DEL-PF-ACCEPT-PO-1-5`

### 验证命令

- `npm run check:post-finishing-web-pda-fallback`：通过
- `npm run check:post-finishing-full-flow-surface`：通过
- `npm run check:post-finishing-factory-detail-actions`：通过
- `npm run check:post-finishing-full-flow`：通过
- `npm run check:post-finishing-cross-terminal-ui`：通过
- `node --import tsx scripts/check-post-finishing-web-mobile-action-dialog.ts`：通过
- `npx playwright test tests/post-finishing-full-flow.spec.ts --workers=1 --grep 'PDA 后道'`：通过（2/2，含未填完成数量直接调整及整批瑕疵合格 0 件）
- `npx playwright test tests/post-finishing-full-flow.spec.ts --workers=1 --grep 'Web 后道未填完成数量'`：通过（1/1，含 Web 接管后直接调整）
- `npx playwright test ... --grep 'PDA 后道扫码先核对'`：通过（1/1，覆盖移动端返厂接收对象搜索与选择）
- `npx playwright test tests/post-finishing-full-flow-cross-terminal.spec.ts --workers=1`：通过（1/1，15 条跨端业务链，8.9 分钟）
- `npm run build`：通过
- `npm run check:prototype-design-governance -- --all`：通过（10 个用户可见受管文件、1 份关联审查记录）
- `npm run check:list-page-governance`：通过（378 个页面静态检查、标准列表模板 Chromium 拖拽、全部原型治理）
- `npm run workflow:verify -- --output /private/tmp/post-finishing-defect-before-completion-task-receipt.json --task-boundary "后道加工未填完成数量即可按原因调整瑕疵，整批瑕疵按零合格完成，PDA与Web共用数量归类"`：通过（`status=verified`，`blockers=[]`）

### 真实图片验证

- 图片来源：既有后道验收 Mock 中与 3 个生产单、5 个 SKU 一一对应的仓库稳定资源；本轮未替换素材。
- 对象对应：Web/PDA 后道卡片和独立 SKU 调整页同时展示图片、SPU/SKU、颜色和尺码。
- 缩略图位置：对象标识同一信息块，不与 SKU 分离。
- 加载与失败：命名浏览器场景验证图片加载；打印场景主动替换为缺失地址并验证“图片加载失败”。
- 大图：PDA SKU 缩略图点击打开大图，`Esc` 关闭通过。

### 例外

- 真实 PDA、现场扫码枪、现场弱网、真实照片上传和生产数据未运行；必须在部署到目标版本后另行验收，不得把本记录表述为现场验收回执。
