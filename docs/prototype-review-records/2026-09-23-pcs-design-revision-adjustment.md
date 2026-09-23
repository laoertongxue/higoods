# PCS 设计改款任务调整原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-23 |
| 相关需求 / 任务 | [总体设计](../product-design/PCS设计改款任务产品调整方案-2026-09-23.md)；[32 条原子需求矩阵](../product-design/PCS设计改款任务需求追踪矩阵-2026-09-23.md) |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS、FCS、仓库、中央车缝工厂 |
| 涉及页面路径 | `/pcs/production-preparation/design-revision`、`/pcs/production-preparation/design-revision/:id`、`/pcs/production-preparation/plate-making/:id`、`/pcs/production-preparation/display-sample/:id`、染色/印花加工单与待接收页 |
| 端类型 | 管理端、工厂执行端 |
| 主要角色与任务 | 买手创建并选目标 SKU；版师完成基码；仓库发料；染厂/印厂加工交接；goto_global 接收并提交销售展示样衣 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：创建页、BOM SKU 选择、花型/潘通展示、列表全链路列、状态与数量、批量复制、参考纸样与物料带入、染厂待收料发料动作均改变。加工单 Mock、共享保存/恢复和任务完成口径也改变可见结果。
- 审查基线：`AGENTS.md` §4、§5、§7。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 有条件通过 | 列表、创建、专业任务按角色区分；需复核工厂实际操作身份。 |
| 文案、状态、数量与单位 | 有条件通过 | 浏览器任务 ES-DR-001 输入 2 米/件 × 2 件后显示 4.3745 Yard，正式单量按显示精度为 4.37 Yard；同一批面料经仓库、染厂、印厂、中央工厂按卷交接，四处实发/实收均为 4.37 Yard；20/18/17 Yard 短少差异有专项检查。同一 BOM 混合 Yard/PCS 的买手页面计算已验，工厂多行实物流转仍待验。 |
| 扫码、真实图片与对象识别 | 不通过 | 设计改款列表目标款式图缩略图可放大，Esc 可关闭；隔离浏览器阻断该图片加载后显示“图片加载失败”，恢复加载后图片正常。所有受影响工厂页、PDA、打印的对象对应及失败态未逐页验收。 |
| 防错、危险确认与主管兜底 | 有条件通过 | 缺 SKU 元数据阻断、超量发料与空发料阻断已有专项证据；主管差异处理待验。 |
| 交接、跨端事实与异常追溯 | 有条件通过 | 隔离浏览器 Mock 任务 ES-DR-001 已实际操作仓库发料→染厂实收/加工→印厂实收/加工→goto_global 实收→版师交纸样→样衣提交→父任务完成；专项检查补核项目关联与自动归档。多行差异仍未完整验收。 |
| 低分辨率、PDA、弱网与上传恢复 | 不通过 | 尚无当前最终版本的全入口尺寸、PDA 和弱网原始证据。 |
| 命名路由、交互、图片大图与打印 | 不通过 | 设计改款列表与详情已浏览器操作；加工、接收及打印未逐页验收。 |

## 4. 问题标签

`协作断裂`、`追溯不足`、`算不准`、`缺扫码识别`。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 创建后刷新丢失设计改款来源的染/印单 | 协作断裂 | 买手、工厂 | 补来源快照持久化、恢复校验、写入与回滚；任务 ES-DR-027 已在隔离浏览器重放刷新。 | 完整工厂交接仍待验 |
| 旧印花单列表显示“待花型” | 状态抽象 | 买手 | 设计改款列表改从专用状态投影读取待分厂/待染后交接。 | 加工单自身详情文案待验 |
| 同一行染印重复仓库发料风险 | 算不准 | 仓库、染厂、印厂 | 染单发仓库首段 Q，印单承接染后实物，不另发仓库 Q。 | 实物短少/PDA/打印待验 |
| 印花单接收身份仍为仓库；染后实发未反映到列表 | 交接错误 | 印尼印花厂、中央工厂、买手 | 将设计改款印花单接收身份设为工厂；第二段调拨投影读取实际染后交出原单。专项测试检验计划 20 Yard、交出 18 Yard。 | 同一 PCS 任务的印花至中央厂专项链路已过；页面操作待验 |
| 样衣提交后父任务虽完成但归档链缺少核对 | 追溯不足 | 买手、档案员 | 专项测试核对父任务完成后的项目关联状态、自动收集的设计改款记录和样衣图片文件。 | 实际项目档案页面及印染后场景待验 |
| 染色列表把设计改款任务号标作生产单 | 追溯不足 | 买手、染厂 | 任务号与生产单号分开投影；列表、详情、导出及交出打印按“设计改款任务”展示。印花列表也按任务来源展示。 | 工厂各详情及打印的完整页面验收待补 |
| `goto_global` 被当作印花厂而非中央车缝工厂 | 交接错误 | 印花厂、中央工厂 | 统一既有组织编号的中央车缝工厂档案，移出印花厂候选，并提供中央工厂待加工收货库位；专项测试检查身份、库位和印花末道实际收料。 | 完整页面验收待补 |
| 染单原坯投入 SKU 被染后中间品覆盖 | 算不准 | 染色厂、印花厂 | 绑定染色产出时保留原坯投入 SKU，染后 SKU 只写产出物料；专项测试真实领料 20 Yard 后交印厂。 | 多行与非 Yard 单位工厂实收待验 |
| 染色交出的中间品把 SKU 内部 ID 当作编码 | 算不准 | 染色厂、印花厂 | 染色产出与交接物料统一写档案 SKU 编码；同一 PCS 任务专项测试核对原坯、染后中间品与最终印花品三段编码。 | 多 BOM 行页面验收待补 |
| 目标 SKU 花型图未进入印花执行记录 | 缺真实图片 | 印花厂 | 印花单的花型确认和产出图片读取目标 SKU 图，避免把选定的花型再次作为线上设计任务。 | 页面失败态和大图待验 |
| 印花交出后中央工厂没有待接收原单 | 协作断裂 | 印花厂、中央工厂 | 实际印花交出生成关联原交接记录的工厂来货原单；中央厂逐卷实收后回写该交接，具名完成印花单。 | 两段合一及页面操作待验 |
| 辅料加工单来源仓误用面料仓或将计划量视作已发 | 算不准 | 辅料仓、染厂 | 专项检查 6 PCS 辅料染色单创建时建立辅料中央仓计划，分厂自动生成收货原单，但实发仍为 0。 | 辅料仓页面及实际发料交接待验 |
| 上游已给整单总量仍按件数再次相乘 | 算不准 | 买手、仓库、加工厂 | BOM 行新增单件用量/整单总量语义；成本与染/印加工单计划量共用该口径。专项场景验证 3 件样衣、整单 6 Yard 时两张加工单均计划 6 Yard。 | Yard/PCS 多 BOM 专项已过；完整浏览器页面验收待补 |
| 输入的 BOM 单位被目标 SKU 计价单位覆盖、计划量需切换页面才刷新 | 算不准 | 买手、仓库、加工厂 | 保留买手输入单位，用档案换算或标准米/Yard 换算计算 Q，BOM 用量与样衣件数变化时局部刷新计划用量；浏览器 2 米/件 × 2 件显示 4.3745 Yard。 | 保存后加工单量和全入口性能仍待完整页面验收 |
| 未分厂时第二段调拨两端都显示“待分配工厂” | 交接错误 | 买手、染厂、印厂 | 依据前序单与当前单的工艺分别显示“待分配染色厂”“待分配印花厂”；提交并刷新后的列表明确显示“面料中央仓 → 待分配染色厂 → 待分配印花厂”。 | 分厂后的全链路页面操作仍待验 |
| 设计改款来源的染/印详情仍显示生产需求单、生产单创建时间 | 追溯不足 | 买手、染厂、印厂 | 设计改款来源只展示实际加工单创建时间；普通生产等其他来源继续沿用原时间组。专项测试和两张加工单当前页面已核对。 | 其他来源页面逐项回归待验 |
| 列表按任务号倒序后“本页全选”误选未排序的记录 | 防错 | 买手 | 改为读取当前表格实际可见的任务勾选框；浏览器测试验证排序后本页十条和跨页第十一条的身份。 | 全入口性能待验 |
| 批量复制继承创建后维护的 BOM、样衣要求和替换后的设计稿 | 数据边界 | 买手 | 保存建单时的设计稿 ID，复制时仅使用创建输入；缺失原始设计稿逐条失败，结果逐条列出原任务和新草稿号，失败项保留勾选。 | 历史记录只能保守识别首张建单设计稿；旧数据批量复制需抽查 |

## 6. 最终结论

结论：不通过。

说明：同一 Mock 任务的双工艺实物链、版师纸样、样衣提交和父任务完成已有浏览器证据；专项检查核对项目关联与自动归档。设计改款来源染单流程卡、印花信息单及确认单已单点生成 PDF 并核对来源和图片，但其他打印入口、全量图片对象对应和按具名例外区分的全入口五次性能原始样本未形成。用户已明确不要求目标款式名称与款式图一一对应，并允许 Mock 演示以概念效果图提交样衣；页面现明确标注演示属性，不作为实物样衣照片。本记录不能作为完整交付或线上业务能力证明。

## 7. 变更覆盖与验证

### 受管文件

- `src/main.ts`

- `src/data/fcs/pda-task-mock-factory.ts`

- `src/pages/pda-handover.ts`
- `src/components/ui/process-order-list-controller.ts`
- `src/data/fcs/process-warehouse-domain.ts`
- `src/data/fcs/pda-cutting-execution-source.ts`
- `src/data/fcs/pda-start-link.ts`
- `src/data/fcs/mobile-execution-task-index.ts`
- `src/data/fcs/special-craft-pda-scope.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/factory-mobile-todos.ts`
- `src/data/fcs/process-output-view.ts`
- `src/pages/process-factory/dyeing/output-documents.ts`

- `src/data/fcs/printing-warehouse-view.ts`
- `src/data/fcs/kol-goto-pda-domain.ts`
- `src/pages/process-factory/dyeing/warehouse.ts`

- `src/data/fcs/process-order-three-axis-view.ts`

- `src/components/ui/engineering-file-upload.ts`
- `src/data/pcs-material-archive-types.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/data/pcs-product-archive-fixtures.ts`
- `src/data/pcs-design-revision-material-sku.ts`
- `src/data/pcs-engineering-bom-types.ts`
- `src/data/pcs-engineering-bom-material-resolver.ts`
- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-design-revision-process-work-order-port.ts`
- `src/data/fcs/design-revision-process-work-order-adapter.ts`
- `src/data/fcs/design-revision-material-transfer.ts`
- `src/data/fcs/factory-mock-data.ts`
- `src/data/fcs/factory-master-store.ts`
- `src/data/fcs/factory-internal-warehouse-locations.ts`
- `src/data/fcs/printing-factories.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/dye-work-order-demo-details.ts`
- `src/data/fcs/dye-work-order-times.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/production-demand-early-process-work-orders.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/process-work-order-generation-key.ts`
- `src/data/fcs/process-quantity-labels.ts`
- `src/data/fcs/store-domain-pda.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/pages/pcs-independent-sampling.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/process-dye-orders.ts`
- `src/pages/process-print-orders.ts`
- `src/pages/process-factory/dyeing/pending-receipts.ts`
- `src/pages/process-factory/dyeing/work-order-overlays.ts`
- `src/pages/process-factory/dyeing/dispatch-print.ts`
- `src/pages/print/templates/dye-work-order-flow-card-template.ts`
- `src/pages/print/templates/printing-sheet-template.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/printing/presentation.ts`
- `src/pages/process-factory/printing/dialogs.ts`
- `src/pages/process-factory/printing/work-order-times.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/process-factory/printing/dispatch.ts`
- `src/pages/process-factory/shared/web-status-action-dialog.ts`
- `src/pages/process-work-orders/order-list-columns.ts`

- `src/pages/pda-task-receive.ts`
- `src/pages/pda-task-receive-detail.ts`
- `src/pages/pda-exec.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/factory-receiving-source-sync.ts`
- `src/data/fcs/process-mobile-task-binding.ts`

### 页面路由

- `/pcs/production-preparation/design-revision`：已操作搜索、批量复制、创建；任务 ES-DR-027 刷新后两单仍可读。
- 当前工作树最终代码在隔离 Chromium、1366×768 再次打开该列表：24 条记录、首屏 10 行，表头含基码、染单、印单、销售展示样衣及勾选列；页面文档宽度为 1366px，主体未横向溢出。这是列表单点检查，不覆盖全入口性能门禁。
- 同一列表在 1280×720 下文档宽度为 1280px；两个宽表容器分别在内部以 `947→1449px`、`958→3276px` 横向滚动，页面主体不横向溢出。
- 列表 `ES-DR-001` 目标款式正式图片可打开高清大图并用 Esc 关闭；模拟图片请求失败时缩略图明确显示“图片加载失败”，恢复请求后实图重新加载成功；失败注入仅发生在隔离验收浏览器。
- `/pcs/production-preparation/design-revision/ES-ID-DR-027`：目标 SKU 染色/印花快照及两单链接已检查。
- `/pcs/production-preparation/design-revision/ES-ID-DR-028`：已选择已有 `.prj` 纸样，创建后带入参照款一行 BOM；提交后有 1 张样衣任务、0 张印染单。
- `/pcs/production-preparation/display-sample/ES-ID-DR-028-DISPLAY_SAMPLE`：中央工厂提交 1 件样衣照片和纸样版本后，刷新父任务显示“已完成”。
- `/pcs/production-preparation/design-revision/ES-ID-DR-027?step=buyer`：BOM 行显示目标 SKU 印染属性和“计划用量 2.0000 Yard；1 Yard/件 × 2 件”。
- `/pcs/production-preparation/design-revision/ES-ID-DR-001?step=buyer`：草稿 BOM 行输入 2 米、样衣 3 件时，单件口径显示计划 6 米；切换整单口径显示计划 2 米。
- 同一草稿改选 `dr_cotton_dye_print` 后输入 2 米/件、样衣 2 件：原输入单位保留“米”，成本区局部更新为“计划用量 4.3745 Yard；2 米/件 × 2 件 × 换算 1.093613”。
- 该草稿保存并刷新后，目标 SKU、2 米/件、2 件样衣与 4.3745 Yard 均保留；正式提交生成基码、`DY-20260923-000008`、`PH-20260923-000009`，列表两张加工单各显示计划 4.37 Yard，且首段/第二段分别显示“面料中央仓 → 待分配染色厂”“待分配染色厂 → 待分配印花厂”。这是隔离浏览器中的 Mock 任务，不代表实际工厂单据。
- `/fcs/craft/dyeing/work-orders`：按 `DY-20260923-000001` 查询，显示“需求来源：设计改款任务”“设计改款任务：ES-DR-027”，且不将该编号标成生产单。
- `/fcs/craft/printing/work-orders`：按 `PH-20260923-000001` 查询，显示同一任务来源及计划投入/产出各 2 Yard。
- `/fcs/craft/dyeing/work-orders?dyeOrderId=DWO-AUTO-000008` 与 `/fcs/craft/printing/work-orders/PWO-PRINT-AUTO-000009`：当前隔离浏览器的 ES-DR-001 双单详情均显示设计改款任务来源；“单据创建”时间组只显示各自加工单创建时间，不再显示虚构的生产需求单或生产单生成时间。
- `/fcs/craft/dyeing/work-orders?dyeOrderId=DWO-AUTO-000008`：ES-DR-001 染单分厂后自动生成仓库发料原单；当前隔离浏览器按卷实发 4.37 Yard、仓库审核、染厂按卷接收 4.37 Yard，原单与接收记录可追溯。这是染色前段单场景，尚未覆盖染后交印花厂。
- `/fcs/craft/printing/work-orders/PWO-PRINT-AUTO-000009`：设计改款印花单显示目标 SKU 花型图和“待接收物料”，不再显示“待确认花型”；列表不再显示线上花型任务或虚构生产单。当前浏览器任务由旧版演示数据创建，原料成分仍待用本轮新档案种子重建验证。
- `/fcs/craft/dyeing/work-orders?dyeOrderId=DWO-AUTO-000008`：修正染色详情的来源原坯图片映射后，白坯正式图片加载成功；点击可见高清大图，按 Esc 关闭。印花输入/产出图片、其他款式/物料及失败态仍需逐项验收。
- 隔离浏览器 Mock `ES-DR-001`：仓库按 4.37 Yard 发原坯，染厂按卷接收/加工并交印厂，印厂按卷接收/印花并交 `goto_global`，中央工厂 PDA 按卷接收 4.37 Yard；版师上传纸样、制作团队提交 2 件样衣后，父任务和四个相关工作项均显示完成。样衣附件为概念效果图，纸样 `.prj` 为演示夹具，不代表真实生产成果。
- 完成后刷新 PCS 列表：染单、印单显示单号、下单/加工完成时间和数量，基码与样衣工作项状态已完成。染单单据未人工点“完结”，但实物交出并由印厂足量确认接收；父任务按实物事实完成。浏览器中旧印花单在改动前已开工且未接单，新建单现要求印花厂接单后开工。旧浏览器记录的 PCS 任务时间由先前 UTC 字符串生成，出现样衣提交 12:46 早于印花完成 20:32 的表象；新建记录已统一写本地时间，旧记录因缺失时区信息不自动改写。
- `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=<本次生成染单>`：当前隔离浏览器核对来源为“设计改款任务”，显示 `ES-DR-001` 任务号，生产单号显示“不适用（设计改款）”；商品和投入物料图片均实际解码，打印媒体下生成 A4 PDF。其他打印入口及纸面人工审阅仍待验。
- `/fcs/print/preview?documentType=PRINTING_INFO_SHEET|PRINTING_CONFIRMATION&sourceType=PRINTING_WORK_ORDER&sourceId=<本次生成印单>`：两类单据均显示 `ES-DR-001` 设计改款任务号，没有空采购/需求单号；信息单展示档案款图，确认单直接展示目标 SKU 的 `DR-BLUE-FLOWER-001` 花型图并说明花型随 SKU 确定，不再显示在线编辑确认栏。未交出时显示计划接收方 `goto_global`，不把它误写成已确认的个人收货人。图片实际解码，打印媒体下各生成 A4 PDF；确认单 PDF 已转图片人工检查，目标蓝花图可见且单页无裁切。其他打印入口仍待验。
- 其他仓库/工厂待接收、PDA 及相关打印入口：尚待完整当前版本验收。

### 验证命令

- `npm test`：通过（作为 `npm run build` 的一环执行），420/420，日志 `/tmp/design-revision-build-final-delivery.log`；覆盖四种目标 SKU 组合、无加工直接提交、Yard/PCS 混合 BOM、仅染/仅印建单、双工艺唯一首道发料，以及同一 PCS Mock 任务的染后交印、印花交中央厂、样衣自动完成和项目归档。
- `npm run build`：通过，Vite 构建完成，日志 `/tmp/design-revision-build-final-delivery.log`。
- `npx tsc --noEmit --pretty false`：失败；本次涉及文件无报错，其余 5 条位于 `production-process-snapshot-derivation`、`tmf-process-continuation`、`tmf-material-purchases`、`simple-cut-piece-handover-ui`，原始输出 `/tmp/design-revision-tsc-review.log`。
- `npm run check:list-page-governance`：通过；本轮审查中补齐受管文件和验证结果后重跑，静态列表、标准列表模板及原型治理全部通过；日志 `/tmp/design-revision-governance-review3.log`。
- `npm run check:prototype-design-governance -- --all`：通过；37 个用户可见受管文件均关联本记录。
- `npm run check:pcs-engineering-master`：通过（2026-09-24 当前工作树 22/22），日志 `/tmp/design-revision-pcs-master-gate-final.log`。复跑时发现生产准备 Mock 在密集创建下偶发丢失 `EM-002` BOM 草稿；根因为 BOM 编号按现存行数回退后复用。改为按已有最大版本号递增并检查 ID 冲突，固定毫秒回归和独立重复运行 10/10 通过。
- `node --import tsx tests/pcs-design-revision-color-team.spec.ts` 与 `node --import tsx tests/pcs-design-revision-result-storage-and-binding.spec.ts`：通过；旧在线调色/花型任务断言已改为目标 SKU 属性、纸样成果文件与存储失败原子性。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4732 CUTTING_E2E_PORT=4732 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-work-preview.spec.ts --workers=1 --reporter=line`：通过（当前生产构建），四种目标 SKU 切换时染印属性、潘通号、花型图和先染后印提示即时更新，工作预览不生成在线花型/调色任务。
- `node --import tsx --test tests/unit/pcs-design-revision-current-flow.test.ts`：通过（5/5），新增复制白名单检查，覆盖多张建单设计稿、后续换稿、BOM 和样衣要求排除。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4731 CUTTING_E2E_PORT=4731 npx playwright test tests/pcs-design-revision-list-actions.spec.ts --workers=1 --reporter=line`：通过（2/2），覆盖筛选、导出全部匹配项、排序后本页全选、跨页复制及逐条结果。
- `node --import tsx --test tests/unit/production-demand-early-process-work-orders.test.ts tests/unit/early-process-management-migration.test.ts tests/unit/early-process-persistence.test.ts tests/unit/process-order-read-performance.test.ts`：通过（22/22）；普通生产提前加工单保持原有来源。
- `node --import tsx tests/fcs-demand-to-order-current-tech-pack.spec.ts`：通过，普通生产需求转正式生产单未被改成设计改款口径。
- `npm run check:list-page-governance`：失败，静态列表和模板检查通过；原型治理要求本次新增受管文件列入本记录，清单已补齐。
- `npm run check:prototype-design-governance -- --all`：通过（40 个用户可见受管文件、1 份关联审查记录）；本记录的验证命令格式已按检查器要求修正。
- `npm run build`：通过（当前改动后单测 421/421，Vite 构建完成），日志 `/tmp/design-revision-build-latest.log`。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4732 CUTTING_E2E_PORT=4732 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-list-actions.spec.ts tests/pcs-design-revision-work-preview.spec.ts tests/pcs-design-revision-create-upload-ui.spec.ts --workers=1 --reporter=line`：通过（当前生产预览 4/4），覆盖建单上传、目标 SKU 预览、列表筛选/导出/排序/跨页复制。
- `npm run build`：通过（款式图修复后 421/421 单测与 Vite 构建），日志 `/tmp/design-revision-build-image-fix.log`。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4732 CUTTING_E2E_PORT=4732 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-work-preview.spec.ts tests/pcs-design-revision-list-actions.spec.ts tests/pcs-design-revision-create-upload-ui.spec.ts --workers=1 --reporter=line`：通过（当前生产预览 5/5），新增从设计改款任务建双工艺单后打开染/印单，核对款式及花型图片实际解码、染单款式大图使用本地正式档案图片。`STYLE-PRJ-202603-012` 款图按用户确认口径无需与款名一一对应。
- `npm run check:list-page-governance`：通过（当前 41 个用户可见受管文件均关联本记录），日志 `/tmp/design-revision-list-governance-current.log`。
- `npm run check:list-page-governance`：通过（当前受管文件清单补齐后，静态列表、列设置模板及原型治理全部通过）。
- `npm run build`：通过（2026-09-24 当前工作树 420/420 单测与 Vite 构建），日志 `/tmp/design-revision-build-20260924.log`。
- `npm run check:prototype-design-governance`：通过，但当前未暂存受管文件，默认仅报告无受管差异；本任务有效覆盖由上面的 `-- --all` 结果提供，日志 `/tmp/design-revision-prototype-governance-final29.log`。
- `node --import tsx tests/pcs-design-revision-production-preparation-five-flows.spec.ts`：通过，五个当前设计改款业务场景 5/5，收据 `/tmp/pcs-design-revision-production-preparation-five-flows.json`。旧入口已改为调用当前专项契约，覆盖无印染、仅染或仅印、混合单位、先染后印交中央工厂及印花接单门禁。该入口只验证设计改款范围，不声称旧版线上花型、调色、返工或正式技术包生产准备流程仍有效。
- `npm run build`：通过（染单打印来源修复后，421/421 单测及 Vite 构建），日志 `/tmp/design-revision-build-print-card.log`。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4732 CUTTING_E2E_PORT=4732 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-work-preview.spec.ts tests/pcs-design-revision-list-actions.spec.ts tests/pcs-design-revision-create-upload-ui.spec.ts --workers=1 --reporter=line`：通过（当前生产预览 5/5），染单流程卡核对任务号、非生产单口径、两张正式图片实际解码和 A4 PDF 生成，日志 `/tmp/design-revision-browser-print-card.log`。
- `npm run check:list-page-governance`：通过（当前 42 个用户可见受管文件关联本记录），日志 `/tmp/design-revision-governance-print-card.log`。
- `npm run build`：通过（计划接收方口径修复后 421/421 单测及 Vite 构建），日志 `/tmp/design-revision-build-receiver.log`。
- 生产预览专项浏览器用例 7/7 通过：设计改款目标 SKU、建单上传、列表批量复制、染印图片与三类打印、普通生产来源印花信息单均通过；完整命令另加历史印花页面套件时为 7/10，后者三个旧用例使用已变更的列表标题、12 段详情和旧交出弹窗断言，详见 `/tmp/design-revision-browser-receiver.log`。此 7/10 不能表述为整套通过；这些旧用例需按当前普通生产页面另行更新并重放。
- `npm run check:list-page-governance`：通过（当前 43 个用户可见受管文件和 1 份审查记录），日志 `/tmp/design-revision-governance-print-pattern.log`；这是计划接收方口径修复之前的结果，最终文件变更后须重跑。
- `npm run build`：通过（最终当前工作树 421/421 单测及 Vite 构建），日志 `/tmp/design-revision-build-final-current.log`。
- 当前生产预览专项浏览器 7/7 通过，包含设计改款建单/目标 SKU/批量复制、染印图、三类打印及普通生产打印来源，日志 `/tmp/design-revision-browser-final-current.log`。历史印花页面套件另有 3 条旧页面结构断言失败，不能把这 7 条外推成全部印花页面通过。
- `npm run check:list-page-governance`：通过（43 个用户可见受管文件、1 份关联记录），日志 `/tmp/design-revision-governance-final-current.log`；`git diff --check` 通过。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4732 CUTTING_E2E_PORT=4732 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-work-preview.spec.ts --workers=1 --reporter=line`：通过（当前生产预览 4/4）；新增浏览器实操把同一 BOM 的辅料 3 PCS/件和面料 2 Yard/件按 2 件样衣分别计算为 6 PCS、4 Yard，确认两行均保留且任务可提交。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4731 CUTTING_E2E_PORT=4731 npx playwright test tests/printing-work-order-input-output.spec.ts --workers=1 --reporter=line`：通过（本工作树 Vite 开发服务 4/4）。旧页面断言已按现行列表、详情和“待接收列表／待交出列表”入口更新；核对了筛选、列设置、全局图片大图、直接数量换料后产出 SKU 不变、无下游组织和目标仓库时不能建交出单，以及信息单/确认单/卷条码打印预览。审查时发现无已选卷仍可点“批量生成交出单／合入已有草稿”，已改为未选择时禁用，并随勾选即时更新。此结果仍需在最后一次构建后用生产预览重放。
- `npm run build`：通过；2026-09-24 用户确认的 Mock 图片和性能口径、印花待交出按钮防错修改后，421/421 单测、类型入口检查与 Vite 构建通过；原始日志 `/tmp/design-revision-build-final-post-approval.log`。
- `npm run check:list-page-governance`：通过；静态列表、标准列表模板和原型治理通过；44 个用户可见受管文件与本记录关联，日志 `/tmp/design-revision-governance-final-post-approval.log`。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4732 CUTTING_E2E_PORT=4732 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-work-preview.spec.ts tests/pcs-design-revision-list-actions.spec.ts tests/pcs-design-revision-create-upload-ui.spec.ts tests/printing-work-order-input-output.spec.ts --workers=1 --reporter=line`：通过；当前生产预览 11/11，含设计改款建单、目标 SKU、BOM、批量复制、染印款图和普通生产印花回归；印花待交出无可选卷时阻断建单、列表大图和四类打印预览均经浏览器重放。该套件是具名路径专项，不能代替尚缺的全入口性能、PDA、全部打印和图片证据。
- `npm run build`：通过；Mock 样衣逐条图片说明与本地预览修复后，421/421 单测和 Vite 构建通过，日志 `/tmp/design-revision-build-local-sample-preview.log`。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4732 CUTTING_E2E_PORT=4732 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-work-preview.spec.ts tests/pcs-design-revision-list-actions.spec.ts tests/pcs-design-revision-create-upload-ui.spec.ts tests/printing-work-order-input-output.spec.ts --workers=1`：通过；当前生产预览 12/12，新增已完成 Mock 样衣成果的逐条说明、本地档案大图实际解码和 Esc 关闭，日志 `/tmp/design-revision-preview-final-suite.log`。
- `npm run check:list-page-governance`：通过；44 个用户可见受管文件与本记录关联，日志 `/tmp/design-revision-governance-sample-preview.log`。`git diff --check`：通过。

### 性能抽样

在隔离 Playwright Chromium、1366×768、同一 Vite 服务和已有浏览器缓存下，导航至标题可见并等待首张图片加载及一帧绘制，列表 5 次为 `133/167/150/124/126ms`。`ES-DR-027` 详情原 5 次为 `617/584/600/567/600ms`；将该页已有正式款式图副本改走本地资源后，同法复测为 `435/414/409/388/384ms`，首图地址为 `/materials/archive/c74d884c23376156c8dc13a5ff39d3fa.jpg`。先前 BOM 计划用量展示改动后，在 `?step=buyer` 页面复测 5 次为 `382/267/366/185/165ms`。本轮 BOM 用量输入从事件触发到新计划用量出现在 DOM，5 次为 `86/19/35/35/29ms`，页面 2 米/件 × 2 件显示 4.3745 Yard，输入单位仍为“米”；列表目标款式本地大图点击至图片就绪并绘制 5 次为 `47/52/61/69/53ms`。这些只覆盖已有缓存的导航及两个交互；冷启动、站内切换和所有交互仍未覆盖，依 AGENTS.md §7.2 不得标完成。

当前生产构建另在隔离 Chromium、1366×768、每次新建空浏览器上下文测量冷进入。计时从导航发出，到页面标题、首屏可见图片解码及两帧绘制结束。PCS 设计改款列表 5 次为 `333/324/326/339/323ms`，任务详情 `328/325/325/324/323ms`，基码纸样页 `314/308/307/319/323ms`，样衣任务页 `340/324/307/307/304ms`；列表首屏 5 张可见图片全部加载。染色加工单列表 `671/674/674/689/656ms`，印花加工单列表 `659/672/674/660/674ms`，仍违反默认 `<500ms` 门禁。CPU 采样定位到首次演示数据初始化；已将提前加工单夹具按工艺批量初始化，并去除印花列表对非首屏关联单据的提前渲染，但仍需继续优化或取得 AGENTS.md §7.2 允许的具名页面 `≤1s` 例外。首次操作、站内切换和全入口五次样本尚未覆盖。

最新生产构建 `fdce306` 基础上的当前未提交任务差异重测，隔离 Chromium、1366×768，每次空浏览器上下文，导航起至标准列表可见、首张可见图片解码及两帧绘制：PCS 设计改款列表 `321/315/316/316/317ms`；染色列表 `884/881/882/882/885ms`；印花列表 `779/780/784/782/782ms`。染印列表虽均低于 1s，但当前**没有**用户授权例外，仍按 `<500ms` 判失败。染色页同上下文刷新约 `450–466ms`，印花页约 `500–533ms`；这不能替代冷进入结果。后续修改及其他页面/操作仍需按 §7.2 各测五次。

款式图修复后的生产构建再次以空 Chromium 上下文、1366×768 测量，导航起至列表可见、首张可见图片解码及两帧绘制：PCS 列表 `333/316/315/315/315ms`，染色列表 `888/907/895/898/886ms`，印花列表 `810/782/782/782/782ms`。染印仍不满足默认 `<500ms`。CPU 采样映射到源码后，染色列表的 `pda-handover-events.ts` 交接记录克隆与投影占明显时间；这是通用 FCS 共享读取，不能靠隐藏实际内容或只看热态判通过。当前也没有全入口五次原始样本。

授权前最后一次构建的生产预览在隔离 Chromium、1366×768、每次新建空上下文重测：染色列表 `929/875/865/884/886ms`，印花列表 `762/766/750/748/750ms`。每次从导航发出计到列表有记录、首屏可见图片解码及两帧绘制。两页仍超过默认 `<500ms`，且尚无用户授权的具名例外。曾尝试复用同步后的染色单快照，专项数量契约通过，但冷进入仍为 `871/863/883/883/866ms`，未解决门禁，已撤回这项共享读取改动。首次操作、站内切换及其他入口还需逐项五次验证。

最终来源与图片修改后的生产预览再次抽样：每次创建空 Chromium 上下文，1366×768，从导航开始，等目标记录可见、该区域首屏图片完成加载及两帧绘制。设计改款列表 `305/299/300/297/317ms`，买手详情 `299/300/300/300/300ms`，染色列表 `884/884/888/881/887ms`，印花列表 `771/781/781/782/779ms`，普通生产来源印花详情 `365/367/367/367/367ms`，印花信息单预览 `332/317/319/318/318ms`。按 2026-09-24 具名授权复核，染印列表冷进入这五次都 `≤1000ms`；其余受影响页面、刷新、站内切换和首次操作的完整五次证据仍待补齐。本抽样仅用于定位性能风险，不作为总体性能通过结论。

2026-09-24 用户授权后的判定：上述染色、印花列表冷进入样本均在具名 `≤1000ms` 上限内；这不豁免刷新、站内切换、首次操作及其他可交互入口，未测项仍不得标记 PERF-001 已验证。

在生产预览染色/印花列表已完成首屏后，采用页面内 MutationObserver 观察列表记录更新并等待两帧绘制，1366×768 同上下文刷新各五次：染色 `449/416/415/417/416ms`，印花 `483/466/465/465/466ms`，均 `<500ms`。印花普通详情返回列表的站内切换五次为 `432/45/42/41/40ms`。这三组样本只覆盖具名动作，其余入口和首次操作仍待逐项测量。

### 真实图片验证

目标 SKU 演示图使用物料档案对应的 `/materials/fei-ticket/white-poplin.png` 与 `/materials/fei-ticket/blue-white-print-cotton.png`；买手设计稿由浏览器本地 `tshirt-sample.jpg` 上传。列表设计稿与目标款式缩略图已展示。用户已明确不要求 `STYLE-PRJ-202603-012` 的款式名称与款式图一一对应；目标款图只核对档案对象 ID 的引用及可用性。浏览器提交的蓝花 Polo 图片是概念效果图，不是实拍样衣；用户于 2026-09-24 允许它用于 Mock 演示，页面已标明“仅供 Mock 演示，不代表实物样衣照片”。工厂页、打印、PDA 也未完成逐项图片验收。

最新生产预览中，从 `ES-DR-001` 草稿选双工艺目标 SKU 后生成染、印加工单，染色单详情和印花单上的 `STYLE-PRJ-202603-012` 档案款图改由仓库内正式图片副本 `/materials/archive/c74d884c23376156c8dc13a5ff39d3fa.jpg` 加载；染单缩略图、大图和印单缩略图均完成解码，印花花型图也完成解码。其他受影响对象、PDA 和打印图片及销售展示样衣实际成果图仍待验。

已完成的种子样衣成果附件 `es-id-dr-002-display_sample-1-1.jpg` 是 Mock 演示图片，成果卡逐条标注“未核验为本次实际制作样衣的实拍照片”。原预览请求远端档案地址持续未得到图片；现针对已有档案图片池使用同一对象的本地副本 `/materials/archive/4b45b816574f99080d0b06f30c9464af.jpg`，生产预览 1024×768 下大图实际解码并可用 Esc 关闭。它只证明原型展示可用，不能证明该样衣已实物制作。

## 8. 两轮审查与 Mock 闭环

### 业务专家视角

1. 核对一个 BOM 行 2 米/件 × 2 件的用量、米/Yard 换算和加工单显示精度；两张加工单各计划 4.37 Yard，仓库只发一批原坯，染后整批进入印厂，印后整批进入中央工厂。无印染辅料不生成多余调拨。
2. 纸样制作与首道染色并行；同一面料的染色、印花按实物流向串行。销售展示样衣在纸样、加工产出及中央工厂确认接收齐备后填报，提交即完成父任务。浏览器 Mock 已走通这条路径；专项测试核对完成后的项目关联与自动归档。
3. 加工完成时间以实际产出时间展示；当实物已足量交接，下游确认是任务放行事实，不额外等待加工单的管理端手工完结。此处曾阻断样衣提交，现已修正并检查未接收前仍阻断。

### 对抗式视角

1. 未分厂、未实发、超量、重复首道发料、印花厂未接收染后物料、中央工厂未接收印后物料、交出 18 实收 17 Yard：均不得显示足量完成或放行样衣；相关专项检查已覆盖关键数量边界。
2. 曾可在印花厂尚未接单时直接登记领料开工，造成加工状态与接单状态冲突。现对设计改款来源单增加接单前置检查，专项测试确认先阻断、接单后可继续；既有浏览器 Mock 历史操作不能反推新建单无需接单。
3. 刷新后来源单据和接收记录仍可追溯；旧的线上花型设计/调色/返工五流程断言已从同名入口退役，当前入口改为五个设计改款专项场景并 5/5 通过。它不覆盖正式技术包生产准备下游流程。
4. Mock 样衣概念图仅可用于演示提交和状态流转，页面必须标明不代表实物照片；目标款式名称与图片无需一一对应。全入口性能及适用的 PDA/打印图片验收仍未满足项目交付门禁。

### 例外

- 用户于 2026-09-24 授权仅染色、印花加工单列表冷进入 `≤1000ms`；这两页的刷新、站内切换和所有交互，以及其他受影响页面和操作，仍严格 `<500ms`，每项至少五次。

## 9. 2026-09-24 用户确认后的修复与增量复核

本轮继续使用工作树 `design-revision-implementation/higoods`、分支 `codex/design-revision-implementation`、HEAD `fdce30661c1683b0212025c45dc5155cff4c314d` 及其未提交任务差异，验收生产预览 `http://127.0.0.1:4732`。最终构建的 `dist/index.html` SHA256 为 `8c11491f34b9ed0ab910bb9b6b23968f451fa1b6908ea41fcf1411bb8c084168`。

- 用户确认 Mock 样衣可以用概念效果图，页面和大图均明确标注不代表实物照片。已有种子演示附件也逐条说明未核验为实际制作照片。
- 已有档案样衣附件的大图和下载使用同一图片的本地副本，修复远端图片持续无法加载；增加可见加载中和失败提示。1024×768 下大图保持比例，关闭按钮、遮罩、Esc 均可关闭。
- 对抗式复核新增发现：样衣提交的项目关联持续保存失败时，原回滚先保存关联，二次异常会跳过父任务回滚。已改为先恢复样衣和父任务，再恢复关联内存；失败提示明确未提交。专项检查与浏览器均验证失败后保留填写内容、父任务未完成、成果未落库；恢复存储后重试仅生成一份成果，刷新后父任务完成。
- `npm run build`：通过，421/421 单测及 Vite 构建，日志 `/tmp/design-revision-build-rollback.log`。
- 17 项当前规则专项检查：通过，日志 `/tmp/design-revision-core-rollback.log`。
- 文件上传及样衣提交存储原子性专项：通过，日志 `/tmp/design-revision-storage-rollback-after.log`；原失败复现 `/tmp/design-revision-storage-rollback-before.log`。
- 最终构建浏览器回归 14/14：创建上传、目标 SKU、混合单位、列表查询/复制/列设置、样衣图片、提交失败恢复、染印打印与普通印单回归；日志 `/tmp/design-revision-rollback-browser.log`。

样衣图片页性能测量：Chromium 149.0.7827.55，1024×768，每次冷进入使用独立空上下文，刷新和操作保持该上下文。计时包含必要图片就绪及两帧绘制；导航从 navigation start、操作从 event.timeStamp 开始。原始小数在日志 JSON 保留，以下便于阅读的数值没有用于替代断言：

| 项目 | 五次原始样本（ms，展示到小数一位） |
| --- | --- |
| 冷进入 | 339.1 / 342.0 / 330.4 / 341.2 / 337.0 |
| 刷新 | 170.4 / 176.9 / 170.4 / 177.0 / 175.5 |
| 首次大图 | 82.5 / 81.7 / 81.8 / 81.7 / 81.8 |
| 关闭按钮 | 47.4 / 48.6 / 48.7 / 48.7 / 49.0 |
| 再开大图（遮罩场景） | 48.5 / 48.6 / 48.5 / 48.6 / 48.5 |
| 遮罩关闭 | 46.7 / 48.4 / 48.5 / 48.3 / 48.5 |
| 再开大图（Esc 场景） | 48.5 / 48.4 / 48.4 / 48.4 / 48.5 |
| Esc 关闭 | 44.5 / 44.5 / 44.8 / 44.8 / 44.6 |

该页上述入口各五次均严格低于 500ms。它不覆盖样衣提交、其他专业任务或全部工厂/PDA 页面。两张加工单列表的冷进入例外仍仅限用户具名范围，不能用于放宽刷新或其他交互。

设计改款列表 1366×768 增量性能：空上下文冷进入、刷新、关键词输入、查询、重置、更多筛选、纸样筛选、空结果查询、上下页、全选、清空选择、打开列设置、隐藏列、恢复列、关闭列设置、复制草稿，共 17 项各测五次，均 `<500ms`。冷进入最大 353.7ms，复制草稿最大 180.6ms，其余已测操作最大 96.8ms。该检查从事件开始直到业务结果断言、可见图片解码与两帧绘制结束，保留断言开销，属于保守上界。排序、导出、其他筛选、列顺序/冻结、站内切换和其他路由尚未形成完整五次样本，不能据此关闭 PERF-001。

原始未舍入收据已保存至仓库：

- [样衣图片性能](evidence/2026-09-24-design-revision/sample-preview-performance.json)
- [设计改款列表性能](evidence/2026-09-24-design-revision/list-performance.json)

当前业务五流程在回滚修复后再次 5/5 通过，日志 `/tmp/design-revision-five-flows-rollback.log`。治理默认命令只检查暂存区，本轮无暂存变更，该空检查不作为通过依据；另在本任务独立工作树以 `--all` 检查本次全部受管差异。

列表第二批补测已通过：在同一构建上加入导出文件内容核对、三态排序、10/20 每页条数、新建弹窗开关、款图大图开关、任务号列冻结/取消冻结，共 29 类入口各五次，最大冷进入 369.8ms、刷新 185.2ms、业务交互 180.6ms。完整原始收据：[列表扩展性能](evidence/2026-09-24-design-revision/list-performance-expanded.json)，日志 `/tmp/design-revision-list-performance-expanded.log`。仍未覆盖其他筛选、列拖动、全部跨页导航及工厂/PDA 全入口；这些缺口不因本次通过而关闭。

`npm run check:prototype-design-governance -- --all` 与 `npm run check:list-page-governance` 均通过，本次独立工作树 45 个用户可见受管文件由一份完整记录覆盖。日志 `/tmp/design-revision-governance-all-rollback.log`、`/tmp/design-revision-list-governance-rollback.log`。本节为增量验证，不替代 §6 的总体未通过结论。


## 2026-09-24 工厂与 PDA 补验（进行中）

- 验收工作树：`/Users/laoer/.codex/worktrees/design-revision-implementation/higoods`，分支 `codex/design-revision-implementation`，基准 HEAD `fdce30661c1683b0212025c45dc5155cff4c314d`，有本任务未提交修改；同工作树 preview `http://127.0.0.1:4732`。
- 新发现并修正：设计改款 PDA 接收与执行卡的来源编号；移除印花花型测试、染色打样；目标工艺不要求转印时隐藏转印步骤；设计改款印花动作使用实际领料和加工记录；补充产出登记及完单入口；完成任务阻断再次新增交出。交出头使用对应工艺任务的完成事实，避免仍显示“已部分交出”。
- 新增领域回归：同一 BOM 染后按卷交印花、印花按卷交中央工厂并完单后，交出头必须为 `DONE / WRITTEN_BACK`。7 项专项检查全部通过，日志 `/tmp/dr-pda-domain-check3.log`；仍需最终构建后浏览器动作验证。
- 390×844、Chromium、两个工厂身份、完整已交接 Mock 数据，分别测冷进入和刷新各 5 次。原始文件保留于 `output/playwright/design-revision-gap/pda-performance-*.json`，包含构建 SHA、浏览器、全部样本、错误、可见动作和图片失败。
- 第一轮样本不通过：染厂任务接收冷进入最大 649.2ms、任务详情 1002.5ms、执行列表 1122.2ms、执行详情 1141.4ms、交出列表 1244.6ms、来货接收 870.1ms；印厂对应任务接收 528.8ms、详情 977.8ms、执行列表 661.1ms、执行详情 1103.9ms、来货接收 862.7ms。原始小数以 JSON 为准。这些页面不适用 1 秒例外。
- 印厂空交出列表的第一轮探针错误要求页面文本至少 100 字，产生超时，未形成有效性能样本；已改为实际页面根节点就绪并等待首屏图片及绘制，必须重新测量，不按通过处理。
- 列拖动计时起点改为 `dragstart`，包含真实拖动到落位过程；旧 `drop` 起点的结果不能证明完整拖动性能。
- 当前结论仍为不通过：性能超时及尚未验收入口继续修复；脚本存在、截图存在或构建通过均不代替全入口完成。


## 2026-09-24 补齐工厂、PDA 与交接打印（持续验证）

工作树 `/Users/laoer/.codex/worktrees/design-revision-implementation/higoods`，分支 `codex/design-revision-implementation`，基础 HEAD `fdce30661c1683b0212025c45dc5155cff4c314d`；当前为未提交修改。验收服务 `http://127.0.0.1:4732`。测试浏览器隔离 localStorage，不操作线上管理系统。

- build17：421 项单元测试通过；PDA 印花领料→打印→产出、完单后禁止新增交出记录、仓库调拨送货单共 3 项浏览器测试通过。送货单五次打印 63.6、65.1、62.8、65.1、66.8ms。原始结果和 PDF 位于 `evidence/2026-09-24-design-revision/build17/`。
- build16：染色交出单和印花交出单各五次打印已通过；最慢分别 98.7ms、100ms。PDF 已检查来源任务、原卷、20 Yard、接收厂及签字区。其后有实质修改，待最终版本重放后作为交付证据。
- 修复打印模板远程图片失败：使用同一官方图片在仓库内的本地副本，保持对象和图片身份。曾出现图片解码失败和超过 1 秒的样本，原始失败结果保留。
- build18 染色加工单列表新增 44 类操作各五次：筛选、查询、重置、列设置、拖动、恢复、排序、前后分页；最慢 199.2ms。其他列表的首轮拖动断言选中了冻结列，待对非冻结列重新验证，未标记通过。
- PDA 仍有加载性能失败：build17 染色详情冷进入最慢 970.6ms、刷新 798.8ms；不适用 1 秒例外。进一步拆出染色状态计算，减少状态卡读取无关生产路线；待新构建复测。
- 完单后印花任务卡的“发起交出”按钮新增终态禁用与处理器防错；回归增加该入口验证。

本节记录为过程证据，不改变总体“不通过”的结论。工厂/PDA 全入口、跨页导航、最终版本打印及五次性能仍按逐项原始证据关闭。


## 2026-09-24 补证第 20–24 轮（进行中）

- 工作树：`/Users/laoer/.codex/worktrees/design-revision-implementation/higoods`；分支 `codex/design-revision-implementation`；基础 HEAD `fdce30661c1683b0212025c45dc5155cff4c314d`，包含本任务未提交改动。预览 `http://127.0.0.1:4732`，验收为隔离 Chromium，Web 1366×768、PDA 390×844。每份 JSON 保存构建产物指纹。
- 工厂列表：第 20 轮覆盖 12 条路由的下拉筛选、查询、重置、列拖动、恢复、排序和适用分页，原始证据见 `evidence/2026-09-24-design-revision/build20/factory-entry-performance.json`。新增文本筛选后单独复测，不能把此轮当作全部入口已通过。
- 印花仓库查询原本按每条库存重复同步全部加工单；单单读取改为只同步该加工单。第 21 轮两个印花仓库的所有已测入口各 5 次通过，最慢 116.1ms。
- 染色仓库筛选原本继续冒泡加载无关全局处理器，现由局部捕获处理；第 23 轮待加工仓库各入口通过、待交出仓库仍有关闭列设置 1610.4ms 慢样本。进一步发现列拖动仍走全局派发，已在共用列表控制器仅对 `locallyManagedEvents` 页面收口，待第 24 轮复测。原始慢样本保留于 build23。
- PDA 染色已接单且收齐原料的任务仍处于待开工，旧页面误禁用排缸。第 23 轮浏览器明确失败，修复为设计改款已接单任务允许进入实际加工。第 24 轮 `pcs-design-revision-pda-dye-execution.spec.ts`：排缸、染色及五个后处理节点，共 13 类动作各 5 次通过；6 个加工节点均持久保存 20 Yard。证据 `evidence/2026-09-24-design-revision/build24/dye-execution/performance.json`。
- 第 20 轮原卷接收测试：仓库→染色、染色→印花、印花→中央工厂，三个阶段各 5 次，覆盖扫码、选原卷、实收、预览编辑、保存、刷新与重复扫码阻断，原始条码和 20 Yard 保留。证据 build20/receiving。
- 第 21 轮实际调拨打印、染色交出打印、印花交出打印完成浏览器预览/PDF检查，各 5 次；染印交出最慢分别 97.2ms、82.4ms。此为原型打印预览，不代表实体打印机验收。证据 build21。
- PDA 冷启动仍在收口：移除无关入口提前生成 KOL 领交记录及特殊工艺飞票的行为，KOL 首次进入本模块仍生成同一演示场景；交接页复用同一次当前数据读取。`kol-pda-lazy-seed.test.ts` 验证完成、部分交出及重复初始化一致。需最终 PDA/KOL 页面回归。
- 本轮补充受管文件：`src/pages/pda-handover.ts`、`src/components/ui/process-order-list-controller.ts`。前者保持各标签同一数据来源与动作；后者仅隔离本地列拖动事件，远端派发页面不变。范围为 PERF-001 的冷进入与局部交互修复。
- 第 24 轮类型检查、422 项单元测试、生产构建通过；总体状态仍为 **不通过**，等待全入口、最终版本冷进入/刷新/站内切换及打印补证。不得用局部成功替代总体完成。

## 2026-09-24 补证第 26–29 轮（进行中）

- PERF-001：交接记录查找修正为按实际新增记录数组查找，并先查非毛织事实；工艺仓库演示数据改为首次实际访问时初始化，公共读写入口仍加载完整原数据。第 26 轮 12 组 PDA 路由中的 10 组冷进入与刷新各五次达标；全能力工厂接单列表 546.6ms、执行列表 830.2ms 仍不通过。所有原始慢样本保留，后续更快结果不能删除这些历史结果。
- PERF-001：PDA 执行列表裁片卡读取列表摘要，避免加载详情专用唛架编辑目标。新增摘要与详情字段一致性契约；列表任务按工厂提前投影，新增六种工厂身份的可见任务、状态、数量与归属一致性契约。接单列表在一次同步渲染内复用同一任务快照，退出渲染立即清空，操作处理器继续读取当前事实。
- 新增 PDA 底部跨页导航、接单/执行状态切换及搜索/清空五次用例。当前在跑实测，脚本建立不代表门禁通过。
- 第 29 轮构建与单元检查结果需结合本轮日志，最终浏览器与治理检查待补齐。总体仍保持未通过。

## 2026-09-24 补证第 33–41 轮

- 具名范围：染色/印花工厂各六条列表路由（加工单、待接收、待交出、交出单据、待加工仓、待交出仓）；两个加工厂身份的 PDA 接单/接单详情/执行/执行详情/交接/来货接收；中央工厂最终来货接收；仓库调拨送货单与染色/印花交出单打印预览。
- 版本：同一工作树和基础 HEAD，未提交修改；预览 PID 58217 的 cwd 已再次核对为本工作树，`127.0.0.1:4732` 读取本工作树 `dist`。Web 1366×768、PDA 390×844，独立 Chromium 上下文使用完整演示快照，不清理用户数据。
- 第 33 轮：12 组 PDA 冷进入/刷新各五次通过；加工、三段原卷接收、状态标签/搜索/底部导航及调拨打印共 10 项浏览器测试通过。后续最终版本重放结果单独归档。
- 第 36 轮：染色/印花交出草稿扫码防错、确认交出与持久化，PDA 两类加工单接单，以及详情图片/交出单导航，共 6 项浏览器测试通过，每类性能入口五次。证据 `evidence/2026-09-24-design-revision/build36/new-entries/`。
- 第 38 轮：12 条工厂路由累计 395 类列表操作、1975 个原始样本，覆盖下拉/文本/日期查询、空结果、重置、适用导出、列拖动、列显隐/冻结、恢复、分页和每页条数。染色待交出仓列拖动包含自动化手势等待，原始 1550ms 样本完整保留。后续分别记录完整手势耗时、`drop` 到列顺序可用的响应时间；不能删除前一轮结果。
- 第 34–40 轮染色待交出列表冷进入仍有 500ms 以上样本，未按两张加工单列表的一秒例外放宽。CPU 采样定位到不展示的接收资格、详情时间轴与路线关系读取。交出列表现按已保存的接收方及实际加工/交接事实投影，未指定接收方时仍读取原路线规则；一次渲染内复用卷码读取，动作完成后重新读取。
- 新契约 `tests/unit/dye-output-list-facts.test.ts` 比较交出列表与完整加工单读取的所有实际展示字段：来源、单号、图片、接收方、物料、数量、时间与交接记录，均一致。第 41 轮类型检查、426 项单元检查和生产构建通过。
- 第 41 轮染色待交出列表：冷进入五次最高 340.5ms、刷新最高 236.9ms、切出最高 266ms、切回最高 64.9ms，全部通过。其他最终重放、打印与治理收据在总证据索引记录；本过程段不单独替代总体结论。

## 2026-09-24 第42轮：交出入口防错及最终补证

- 需求编号：TRF-003、TRF-004、PROC-003、PAGE-004、IMG-001、PERF-001；继续使用本记录既有 W3/W6 实施范围。
- 对抗审查发现：设计改款印花 PDA 旧的“发起交出”可以仅填总量进入通用交接方法，没有原卷选择/扫码事实。修复 `submitPrintHandover` 对设计改款来源拒绝该路径；正式逐卷 `confirmPrintingDispatch` 路径继续执行。染色已有同类领域阻断。PDA 对两种设计改款工艺关闭该旧按钮，显示管理端逐卷办理位置，保留查看交出单及下游接收入口。未新增线上花型、调色或返工。
- 同一染→印→中央工厂专项链路增加旧印花交出方法拒绝断言，随后继续通过实际建单、扫码、交出、实收和样衣提交。当前构建42的类型检查、426项单测及 Vite 构建通过。构建日志：`evidence/2026-09-24-design-revision/build42/build.log`。
- 第41轮浏览器 28 项中 27 项通过，印花卷选择用例失败已保留原始 trace。定位问题包括错误读取不存在的 `businessView.printOrderNo`、目标单未在首屏，以及未打印草稿卷排在正式产出卷之前。测试改为使用正式单号、实际页面查询及只选择可建单卷；未删除未打印卷、禁用判断或放宽数量规则。修正后的用例必须重新执行后才可通过。
- 全部性能测量使用隔离浏览器上下文、完整 Mock 存储，工厂管理页1366×768，PDA390×844；默认每项5次、每次严格低于500ms。只允许染/印加工单列表冷进入不超过1000ms。拖动同时保存完整手势时长和松手后更新时长，后者用于响应门禁，避免把模拟鼠标移动时间当作页面计算耗时。
- 本节执行中的数据不替代最终收据；完成结果统一索引见本次 evidence 目录。历史失败、旧构建和受实质修改影响的过期收据继续保留。

## 2026-09-24 第43轮：印花 Esc 阻塞修复与最终重放

- PERF-001：CPU 采样确认印花大图 Esc 会经全局 FCS 关闭入口加载裁片退回、裁片仓储、打印预览等无关模块，约 1.2 秒主线程阻塞发生在下一次大图操作。不是图片解码失败或允许的冷进入例外。`src/main.ts::closeDialogsOnEscape` 对 `/fcs/craft/printing/` 交由原有局部弹窗/大图监听器处理，不加载聚合 FCS 关闭模块。
- 原始采样、慢样本和失败测试保存在 `evidence/2026-09-24-design-revision/build42/overlay-profiler/`。第43轮染色44类、印花33类弹窗动作各五次通过，最高分别165.3ms和182.5ms；增加未加载无关裁片模块的浏览器断言。印花可编辑场景使用真实链路的“已接收待加工”快照；已结束单据仍维持禁止变更要求。
- 第43轮类型检查、426项单元检查和构建通过；构建日志与弹窗收据保存在 `evidence/2026-09-24-design-revision/build43/`。其余具名入口继续串行重放，最终结论以证据索引为准。

## build43 最终补证收据（2026-09-24）

本次用户点名的剩余工厂/PDA入口、调拨/交接打印、筛选/列拖动/跨页导航已补齐。完整范围、逐样本数据、原始失败、最终重试、PDF及版本指纹见 [build43 证据索引](evidence/2026-09-24-design-revision/build43/README.md)。32 个不同浏览器用例在同构建分批通过；426 单元测试及构建通过。12 工厂页面 1280×720 无页面溢出，主验收1366×768，PDA390×844，样衣1024×768。三类新增PDF已栅格化目视，无裁切，来源/数量/交接对象一致。样衣最后一次失败为测试在已完成状态等待不存在的编辑行，修正等待成果记录后已通过，未修改业务代码。

业务审查：保持同批先染后印、逐卷实际接收、最终中央工厂、来源设计改款任务、样衣提交完成父任务。对抗审查：阻断旧汇总交出绕过、重复扫码及终态操作，验证持久化失败回滚与重试；定位并修复印花 Esc 异步聚合初始化阻塞。原始失败不删除。此次结论仅针对补证批次，不把Mock、PDF或本地构建表述为实际生产、实体打印、Git发布或产品负责人最终接受。

## 合并 main 发布复验（2026-09-24）

用户明确要求本地合并 main 并推送 GitHub main。发布工作树 `/Users/laoer/.codex/worktrees/design-revision-main-release/higoods`，分支 `codex/design-revision-main-release-20260924`，基线 `838266c2`；生产预览端口4733。保留 main 的后整理来源过滤、严格 sourceKey 校验、TMF 染印互斥防错和已审核图片迁移；设计改款目标 SKU、逐卷交出、原型标注和 Esc 局部关闭合并。6处冲突逐项审查，未覆盖其他模块的新版本。测试 helper 接受 PLAYWRIGHT_BASE_URL，以便验证发布工作树的独立服务。历史日志仅清理行尾空格，失败样本/时间/数值不变。

本次负责需求为本方案 W1–W6 全部32条原子需求及 GAP-FCS-001、GAP-PDA-001、GAP-TRF-001、GAP-PERF-001、GAP-IMG-001、GAP-SAFE-001 的已实现变更；发布不将原矩阵未完成验收项自动升级为用户接受。合并版构建及433项单元测试通过；浏览器与治理最终结果见 release-main 证据目录。原开发工作树和历史证据保留，不删除其他工作树。
