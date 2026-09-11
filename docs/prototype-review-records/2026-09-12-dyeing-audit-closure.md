# 染厂 24 项业务问题最终修复审查

## 1. 基本信息
- 日期：2026-09-12；任务：完成剩余问题并合并、推送 main。
- 记录模式：完整产品审查。系统：FCS/PFOS；管理端、染厂操作员/仓管、接收方和 PDA。
- 本次覆盖本线程累积的旧模块清理、染色待交出/交出单据，以及本次 24 项逻辑修复；无无关工作区变更。
- 验证工作树：/Users/laoer/Documents/higoods；分支 codex/dyeing-dispatch-pages；起始 HEAD 75f85bad068276f60fe968f7186aa30e74368574。最终文件版本和检查由 /private/tmp/dye-final-acceptance/task-receipt.json 绑定。
- 运行：当前工作树 Vite 5188，局域网 192.168.5.6；桌面 1366×768、1280×720，PDA 390×844。

## 2. 影响判定
- 用户可见影响：有
- 判定依据：待接收来源、实收、实际用料、仓库余额、交出与下游实收、条码重量、纱线边界样例及统计口径修正；原型页面结构保持现有样式。
- 基线：AGENTS.md 第 4、5、7 节。按已确认业务保留少收、超收、零收、分次接收和未关联备料，不增设差异结案要求。

## 3. 自查结论
|检查项|结论|证据与边界|
|---|---|---|
|角色、任务与页面模式|通过|接收方填实收；操作员明确开始加工再扣库；发送方不代填下游收齐。水溶补收后 Web/PDA 都有投入动作|
|文案、状态、数量与单位|通过|实收不等于使用，交出不等于下游实收；米、Yard、kg 分组，辅料实际 kg/g 和原单单位分别保存，纱线库存按净重|
|扫码、图片与识别|通过|保留原卷码；按扫码明细建交出单，错卷重复卷阻断；图片使用原有物料与款式资产，不添加无关占位图|
|防错与恢复|通过|重复保存、超用、错厂/错SKU、修改已使用投入、交出超净重/毛重上限阻断；保存失败回滚本次事实，不伪造成功|
|交接与追溯|通过|原交出记录回传现场实际数量；新接收按选择的库位入库；已接收原单可追加后续发货但不能覆盖已有身份和数量|
|设备和交互|通过|桌面两种尺寸宽表内部滚动，筛选/列设置局部更新；PDA 主动作可完成，补收后显式投入并刷新核对库存|
|页面、大图、打印|通过|条码实称保存重开和打印一致；流程卡预览、库存物料大图及失败提示完成命名页面复核|

## 4. 问题标签
算不准、协作断裂、追溯不足、选不对；对应问题均列入 AUD-001～AUD-024，不新增无关业务。

## 5. 主要问题与处理
|问题|处理|边界|
|---|---|---|
|库存与使用脱节|按实收行/原卷扣实际用料，关联备料只分配、不再入库；下一批不依赖下游是否已收|历史原记录汇总保留，不补造不存在的历史卷码|
|上游来源遗漏|导入当前审核仓单和实际水溶交出；仓库已审核未登记卷码也能出现待接收，补齐原码后才能实物接收|不把计划数量当作送货数量，不生成虚构卷码|
|独立水溶旁路|统一实收与入库，明确开工扣库；补收、追加投入、PDA 角色和刷新后余额验证|辅料按称重与现场原单单位录入，不用理论重量换算|
|交出与接收混淆|唯一原交出回执，不以交出量假设收齐，支持零/少/超实收|无真实后台，均是本机演示数据|
|纱线与新单依赖固定样例|从当前物料和接收组织识别，三种边界可全部出清；旧未操作样例定向迁移|实际操作记录不覆盖|
|条码改长度覆盖实称|卷长/米数相互换算，实称独立输入，理论值只读|实称保留三位小数|

## 6. 最终结论
结论：通过（染厂本次原型修复范围）。
- 第一轮：业务契约、边界、重复/非法操作、数量守恒和冷启动。
- 第二轮：当前服务桌面、PDA、真实图片及打印操作回放；最终实质修改后重放受影响检查。
- 技术验收由 Codex 执行，发布后产品接受仍由用户确认。该记录不代表真实工厂已经发生收发。

## 7. 变更覆盖与验证
### 受管文件
- `src/data/app-shell-config.ts`
- `src/data/fcs/combined-dyeing-deep-link.ts`
- `src/data/fcs/combined-dyeing-domain.ts`
- `src/data/fcs/dye-work-order-combined-dyeing-view.ts`
- `src/data/fcs/dye-work-order-demo-details.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/dyeing-quantity-facts.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/dyeing-warehouse-view.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/factory-receiving-links.ts`
- `src/data/fcs/factory-receiving-source-sync.ts`
- `src/data/fcs/factory-receiving-types.ts`
- `src/data/fcs/factory-receiving-warehouse.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/process-action-writeback-service.ts`
- `src/data/fcs/process-execution-writeback.ts`
- `src/data/fcs/process-order-image-manifest.ts`
- `src/data/fcs/process-order-input-transfer-fixtures.ts`
- `src/data/fcs/process-statistics-domain.ts`
- `src/data/fcs/process-warehouse-linkage-service.ts`
- `src/data/fcs/process-web-status-actions.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/process-work-order-stock.ts`
- `src/data/fcs/production-process-work-order-service.ts`
- `src/data/fcs/warehouse-material-execution.ts`
- `src/data/fcs/water-soluble-material-receipts.ts`
- `src/data/fcs/water-soluble-task-domain.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/process-factory/dyeing/barcode-dialog.ts`
- `src/pages/process-factory/dyeing/combined-dyeing.ts`
- `src/pages/process-factory/dyeing/dispatch-print.ts`
- `src/pages/process-factory/dyeing/events.ts`
- `src/pages/process-factory/dyeing/output-documents.ts`
- `src/pages/process-factory/dyeing/pending-receipts.ts`
- `src/pages/process-factory/dyeing/reports.ts`
- `src/pages/process-factory/dyeing/warehouse.ts`
- `src/pages/process-factory/dyeing/water-soluble-orders.ts`
- `src/pages/process-factory/dyeing/work-order-detail.ts`
- `src/pages/process-factory/dyeing/yarn-shipments.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`

### 页面路由
- /fcs/craft/dyeing/pending-receipts
- /fcs/craft/dyeing/work-orders
- /fcs/craft/dyeing/wait-process-warehouse
- /fcs/craft/dyeing/wait-handover-warehouse
- /fcs/craft/dyeing/pending-handover
- /fcs/craft/dyeing/handover-documents
- /fcs/craft/dyeing/yarn-shipments
- /fcs/craft/dyeing/water-soluble-orders
- /fcs/craft/dyeing/reports
- /fcs/craft/dyeing/work-orders/DYE-DISPATCH-DEMO-1?tab=statistics
- /fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001
- /fcs/pda/exec/<对应水溶任务ID>

### 验证命令
- 13 项业务专项：通过，结果 /private/tmp/dye-final-acceptance/results.json；每个 check 对应 scripts/check-<name>.ts，使用 node --import tsx 运行。
- 桌面/PDA回放：node /private/tmp/dye-audit-browser.mjs；数量/打印回放：node /private/tmp/dye-quantity-browser.mjs；条码回放：node scripts/check-dye-barcode-weight.mjs。最终回放通过，截图分别位于 output/playwright/dye-audit-closure、dye-quantity-reconciliation、dye-barcode-weight。
- `npm run check:fcs-end-to-end`：通过，/private/tmp/dye-final-fcs.log。
- `npx tsc --noEmit`：通过，/private/tmp/dye-final-types.log。
- 最终 `workflow:verify` 的逐条结果以 /private/tmp/dye-final-acceptance/task-receipt.json 为准，绑定本次任务范围、文件差异、受影响检查与 CodeGraph；此文档不替代收据。
- `npm run build`：通过，/private/tmp/dye-final-verify.log；保留既有大块体积提示。
- `npm run check:list-page-governance`：通过，/private/tmp/dye-final-list.log；含 Chromium 列拖动及局部 DOM 验证。
- `npm run check:prototype-design-governance -- --all`：通过，/private/tmp/dye-final-governance-all.log。
- `git diff --check`：通过。
- 源码、文档、脚本、测试、dist 中旧模块禁止文案：0 命中。
- 审核待卷码页面：通过，output/playwright/dye-audit-closure/approved-before-rolls.json。
- 汇总证据和源文件哈希：2026-09-12-dyeing-audit-evidence.json。
- 最终完整 diff 按接收→使用→包装→交出→下游实收→统计作反向追踪；修改均对应本线程已授权要求，未改造原型技术栈。

### 真实图片验证
- 图片来自现有 /materials/process-orders 实物图、DYE_DEMO_DETAILS 与 process-order-image-manifest；水溶白色花边、针织布、纱线各自对应。
- 名称/SKU/图片同列；material-preview.png、image-failure.png 验证放大和失败提示；图片保持比例，Esc 可关闭。
- 纱线与条码截图验证图片加载；交出打印复用真实物料缩略图。未新增素材上传或弱网功能，这两项不适用。

### 例外
- 全模块旧 check-process-work-order-unification.ts 在未修改的印花详情“需求来源”旧静态断言失败；染色章节及生产变更、生成专项通过，不修改印花页面来迁就旧断言。
- 全模块旧 check-statistics-dashboard-real-data.ts 在未修改的印花静态断言 getPrintingExecutionStatistics 失败；不谎报通过。染厂统计用实际业务守恒与页面数值回放覆盖，无染厂未解决失败。
- 历史记录没有原卷码/精确库位时明确按历史汇总展示，不补造现场信息。仓库来源尚未登记原卷码时显示补齐提示并阻止伪造卷码接收；演示接收明细均有具体物料和数量。
- 旧数量修复审查中因任务范围未合并而跳过收据的说明只适用于上一阶段。本次用户明确授权所有染厂剩余问题合并发布，使用本次统一任务收据覆盖全部已授权差异。
