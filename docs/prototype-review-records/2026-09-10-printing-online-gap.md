# 印花线上功能补齐审查

## 1. 基本信息

- 日期：2026-09-10
- 系统及端：PFOS 管理端桌面
- 角色：印花跟单员、交出员、仓管
- 需求：用户提供的线上印花管理五组页面及条码弹窗；要求当前原型增量补齐、保留页面结构。
- 分支：codex/process-route-full-stage-incremental
- 工作树：.worktrees/process-route-full-stage-incremental
- HEAD：8d8f8ffd43d1000d9c852a1cffbb4c73e16bee12，加本次任务差异，详见 version.json。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：在现有印花列表增加待交出、交出单据入口和编辑/日志；扩充原条码弹窗；仓库原四区接上查询、分页、列设置、导出与投入卷标签。
- 保留加工单原有筛选、六项摘要、七类业务列、选择列、直接行操作、详情六区；仓库保留标题、筛选、指标、四个原有页签及原列信息。
- 依据：AGENTS.md第4、5、7节；本次用户要求结构保留优先，不复制线上密集布局。

## 3. 自查结论

|检查项|结论|证据及说明|
|---|---|---|
|角色与任务|通过|跟单编辑，条码维护，交出员按实际卷组单；操作均为本地原型|
|状态及数量|通过|草稿不产生交出；确认交出不产生下游接收；数量按卷汇总；跨厂/接收人/接收仓/单位阻断|
|危险操作|通过|删除、作废、实物交出与下架二次确认；已有交出/入库卷不能删改，草稿占用卷不能改|
|原记录一致性|通过|新交出单组合原单卷引用，确认使用原handover命令，外层事务回滚；作废保留原卷快照|
|列表与低分辨率|通过|1366×768、1280×720页面主体无横向溢出；宽表内部滚动|
|局部更新|通过|筛选、列设置、条码和交出弹窗局部更新；仓库事件加入现有印花快捷分派|
|打印|通过|交出单内容和产出卷标签预览；未进行真实打印机出纸验收|
|真实图片与对象识别|有条件通过|商品图片复用当前对应素材；实际物料/正式产出素材缺口继续显示，不借用其他对象图|
|仓库手工新增/改数量|待确认|已向用户询问，暂沿用接收、用料、盘点来源方式；未新造库存来源或手工调数量|
|刷新保存|有条件通过|预置演示单为原有内存数据，刷新重置；正式生成单沿用现有保存逻辑，本次未扩充持久化范围|

## 4. 问题标签

- 功能入口缺失
- 条码维护门禁误用
- 交接事实混淆风险
- 静态查询控件

## 5. 主要问题与处理

- 仅有可打印卷才允许开条码弹窗：解除维护入口门禁，打印有效性继续校验。
- 缺失批量建单、合单：新交出管理弹窗分别展示待建卷与单据；同卷不重复占用。
- 补打倒退已交出状态：只把草稿更新为已打印，已有交接/入库状态不变。
- 仓库查询为静态文字：接已有查询投影，保留原页签和字段，用现有标准列表控制器分页和列设置。
- 初期浏览器断言等待不足、交出弹窗挂在应用事件根之外、列设置未刷新overlay：均已修复并在最终版本重跑。
- 初期刷新验证误把旧单存在当作新单保存：已撤回该结论，明确演示数据刷新限制；没有以宽松断言标记持久化通过。

## 6. 最终结论

结论：有条件通过

本次重点功能可在当前原型演示；不声明线上模块全量等价、不声明真实业务操作或远端交付。正式素材、历史交接信息、手工库存调整范围仍有待补齐/确认项。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/printing-task-domain.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/process-factory/printing/dialogs.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/pages/process-factory/printing/dispatch.ts`
- `src/pages/process-factory/printing/warehouse.ts`

另含 `src/main.ts` 一处印花局部事件分派范围扩展，以及 `scripts/check-printing-online-gap.ts` 专项检查。

### 页面路由

- `/fcs/craft/printing/work-orders`
- `/fcs/craft/printing/wait-process-warehouse`
- `/fcs/craft/printing/wait-handover-warehouse`
- `/fcs/print/preview?documentType=PRINTING_ROLL_LABEL&sourceType=PRINTING_ROLL_RECORD&sourceId=PWO-PRINT-005%3AROLL-PH-20260328-005-0001`
- 交出单据、待交出列表、条码管理沿用当前页弹窗入口。

### 验证命令

- `npx tsc --noEmit`：通过。
- `node --import tsx scripts/check-printing-online-gap.ts`：通过。
- `node --import tsx scripts/check-printing-two-end-list.ts`：通过。
- `node --import tsx scripts/check-printing-partial-batches.ts`：通过。
- `npm run build`：通过。
- `npm run check:list-page-governance:static`：通过。
- `npm run check:standard-list-page-template`：通过。
- `npm run check:prototype-design-governance`：通过。
- CodeGraph sync/status；最终实际结果见对应日志。
- 浏览器：browser.js、warehouse.js、print-and-edit.js；各对应log记录实际通过项。


### 真实图片验证

复用原有商品图片、同SKU投入图片并保持同单元格显示、大图入口和加载失败提示；产出缺正式实物图、部分投入物料缺对应图明确标识。已知素材缺口不标成完整图片验收通过。

### 例外

- 用户要求保留当前页面结构：沿用原印花两段摘要及仓库五项指标卡，仓库保留原四页签。
- 新交出管理是当前页业务弹窗，不新增导航页；卷码详情为带分页宽表弹窗。
- 预置演示数据刷新重置；本次不实现后端或新的保存基础设施。
- 手工库存调整范围等待用户选择，未按默认值当作授权修改库存口径。
- 工作区含其他已有改动，不运行会吸收整个工作区差异的 workflow:verify；本次以 task.diff、version.json 和专项证据限定范围，未暂存或提交。
- 证据目录：`output/playwright/printing-online-gap/`。
