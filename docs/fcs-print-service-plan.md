# FCS 统一打印服务底座

## 打印服务分层

统一打印服务分为七层：

1. 统一打印路由：承接 `/fcs/print/preview`，旧 `/fcs/print/task-route-card` 和 `/fcs/task-print/route-card/:sourceType/:sourceId` 继续兼容。
2. 统一打印文档模型：用 `PrintDocument` 描述页头字段、图片、二维码、表格、差异区、签字区和打印元信息。
3. 统一模板注册表：按单据类型和来源类型选择模板，当前通过 `printTemplateRegistry` 注册。
4. 统一二维码和条码能力：二维码以打印文档中的 `qrCodes` 渲染，后续条码能力通过 `barcodes` 接入。
5. 统一图片解析能力：先取业务图片，没有图片时只使用紧凑占位，不再打印大块系统占位图。
6. 统一打印样式：A4 纵向、黑白清晰表格线、打印按钮和提示不参与打印。
7. 多业务模板：同一打印壳承载不同单据模板，避免业务页面本身被打印。

## 当前已接入模板

- 通用任务流转卡
- 印花任务流转卡
- 染色任务流转卡
- 特殊工艺任务流转卡
- 后道任务流转卡
- 原始裁片单任务流转卡
- 裁片批次任务流转卡
- 通用任务交货卡
- 印花任务交货卡
- 染色任务交货卡
- 特殊工艺任务交货卡
- 后道任务交货卡
- 裁片任务交货卡
- 车缝任务交货卡
- 裁床配料单
- 工厂领料单
- 仓库发料单
- 补料单
- 生产确认单
- 做货确认单

以上任务流转卡均接入 `TASK_ROUTE_CARD` 单据类型，以上任务交货卡均接入 `TASK_DELIVERY_CARD` 单据类型。两类单据统一通过 `/fcs/print/preview` 预览，旧 `/fcs/print/task-route-card` 和 `/fcs/print/task-delivery-card` 继续兼容。

配料、领料、发料、补料类单据分别接入 `MATERIAL_PREP_SLIP`、`PICKUP_SLIP`、`ISSUE_SLIP`、`SUPPLEMENT_MATERIAL_SLIP` 单据类型，统一走 `/fcs/print/preview`，页面入口只负责传入来源 ID，不再在业务页面内拼接临时打印 HTML。

生产资料确认类单据分别接入 `PRODUCTION_CONFIRMATION` 和 `MAKE_GOODS_CONFIRMATION` 单据类型，复用生产单、生产确认单快照、技术包快照、面辅料、图片资料和工序工艺数据。旧 `/fcs/production/orders/:productionOrderId/confirmation-print` 路由继续保留，但内部渲染统一打印预览壳。

## 本轮任务流转卡接入清单

| 任务流转卡 | 来源类型 | 数据来源 | 适配器 | 关键字段 |
| --- | --- | --- | --- | --- |
| 通用任务流转卡 | `RUNTIME_TASK` | 运行时任务、PDA 任务、交接记录 | `buildRuntimeTaskRouteCardPrintDocument` | 任务编号、生产单、工序、工艺、工厂、计划对象数量 |
| 印花任务流转卡 | `PRINTING_WORK_ORDER` | 印花加工单、印花执行节点 | `buildPrintingWorkOrderRouteCardPrintDocument` | 花型号、面料 SKU、计划印花面料米数、打印、转印、交出、审核 |
| 染色任务流转卡 | `DYEING_WORK_ORDER` | 染色加工单、染色执行节点 | `buildDyeingWorkOrderRouteCardPrintDocument` | 原料面料 SKU、目标颜色、色号、染缸、染色、包装、交出、审核 |
| 特殊工艺任务流转卡 | `SPECIAL_CRAFT_TASK_ORDER` | 特殊工艺任务单、菲票、节点记录 | `buildSpecialCraftTaskOrderRouteCardPrintDocument` | 特殊工艺名称、关联菲票、计划裁片数量、当前裁片数量、差异裁片数量、交出 |
| 后道任务流转卡 | `POST_FINISHING_WORK_ORDER` | 后道单统一事实源 | `buildPostFinishingRouteCardPrintDocument` | 成衣件数和流程口径 |
| 原始裁片单任务流转卡 | `CUTTING_ORIGINAL_ORDER` | 原始裁片单打印源 | `buildCuttingOriginalOrderRouteCardPrintDocument` | 原始裁片单号、面料 SKU、订单成衣件数、计划裁片数量、配料、领料、裁剪、菲票 |
| 裁片批次任务流转卡 | `CUTTING_MERGE_BATCH` | 合并裁剪批次打印源 | `buildCuttingMergeBatchRouteCardPrintDocument` | 合并裁剪批次号、来源生产单数、来源原始裁片单数、计划裁床组、计划裁剪日期 |

裁片批次只是执行上下文，菲票归属仍回落原始裁片单，不把合并裁剪批次作为菲票归属主体。

## 本轮任务交货卡接入清单

| 任务交货卡 | 交出来源 | 数据来源 | 适配器 | 关键字段 |
| --- | --- | --- | --- | --- |
| 通用任务交货卡 | 运行任务交出记录 | PDA 交出记录、统一交出兼容适配 | `buildRuntimeTaskDeliveryCardPrintDocument` | 交出方、接收方、本次交出对象数量、实收对象数量、差异对象数量 |
| 印花任务交货卡 | 印花待交出仓 | `ProcessHandoverRecord`、统一差异记录、统一审核记录 | `buildPrintingDeliveryCardPrintDocument` | 印花加工单号、印花厂、交出面料米数、实收面料米数、差异面料米数 |
| 染色任务交货卡 | 染色待交出仓 | `ProcessHandoverRecord`、统一差异记录、统一审核记录 | `buildDyeingDeliveryCardPrintDocument` | 染色加工单号、染厂、原料面料 SKU、交出面料米数、实收面料米数、差异面料米数 |
| 特殊工艺任务交货卡 | 特殊工艺待交出仓 | `ProcessHandoverRecord`、菲票关联、统一差异记录 | `buildSpecialCraftDeliveryCardPrintDocument` | 特殊工艺单号、关联菲票、交出裁片数量、实收裁片数量、差异裁片数量 |
| 后道任务交货卡 | 后道交出仓 | 复检完成后的后道交出仓、`ProcessHandoverRecord`、统一差异记录 | `buildPostFinishingDeliveryCardPrintDocument` | 后道单号、后道工厂、复检确认成衣件数、交出成衣件数、实收成衣件数 |
| 裁片任务交货卡 | 裁片交出记录 | 裁片交出记录、原始裁片单、菲票关联 | `buildCuttingDeliveryCardPrintDocument` | 原始裁片单、菲票号、交出裁片数量、实收裁片数量、差异裁片数量 |
| 车缝任务交货卡 | 车缝交出记录 | 车缝交出记录、车缝任务、后道流向信息 | `buildSewingDeliveryCardPrintDocument` | 车缝任务号、车缝工厂、交出成衣件数、实收成衣件数、本厂后道流向 |

任务交货卡统一读取交出记录，按交出工艺类型注入业务字段。后道交货卡只承接复检完成后的后道交出仓记录；车缝厂完成后道后不能直接生成后道交货卡，只能交给后道工厂接收、质检、复检后再交出。裁片交货卡中菲票永远回落原始裁片单，合并裁剪批次只作为执行上下文。

## 本轮配料 / 领料 / 发料 / 补料单接入清单

| 单据 | 文档类型 | 来源类型 | 数据来源 | 适配器 | 关键字段 |
| --- | --- | --- | --- | --- | --- |
| 裁床配料单 | `MATERIAL_PREP_SLIP` | `MATERIAL_PREP_RECORD` | 仓库配料领料投影、原始裁片单、生产单、面料 SKU、裁片单二维码 | `buildMaterialPrepSlipPrintDocument` | 配料单号、来源生产单、原始裁片单、应配面料米数、已配面料米数、缺口面料米数、配置卷数 |
| 工厂领料单 | `PICKUP_SLIP` | `PICKUP_SLIP_RECORD` | pickup 领域领料单、打印版本、扫码记录、工厂端移动应用领料任务 | `buildPickupSlipPrintDocument` | 领料单号、领料工厂、发料仓库、应领对象数量、实领对象数量、差异对象数量、打印版本 |
| 仓库发料单 | `ISSUE_SLIP` | `ISSUE_SLIP_RECORD` | 裁片发车缝发料单、发料批次、中转袋和菲票摘要 | `buildIssueSlipPrintDocument` | 发料单号、发料仓库、接收工厂、应发对象数量、实发对象数量、差异对象数量 |
| 补料单 | `SUPPLEMENT_MATERIAL_SLIP` | `SUPPLEMENT_MATERIAL_RECORD` | 补料建议、补料审核、补料待配和补料发料记录 | `buildSupplementMaterialSlipPrintDocument` | 补料单号、补料原因、原需求对象数量、缺口对象数量、申请补料对象数量、审核通过对象数量、实发补料对象数量 |

四类单据共用统一 A4 打印壳、二维码规则和签字区。配料单强调仓库应配、已配、缺口和卷号；领料单强调工厂应领、实领和差异；发料单强调仓库发出、接收工厂和签收；补料单强调补料原因、缺口、审核通过和实发补料对象数量。

## 本轮菲票与标签类接入清单

| 标签 | 文档类型 | 来源类型 | 数据来源 | 适配器 | 标签纸规格 | 关键字段 |
| --- | --- | --- | --- | --- | --- | --- |
| 菲票标签 | `FEI_TICKET_LABEL` | `FEI_TICKET_RECORD` | 菲票投影、生成菲票、原始裁片单、生产单、特殊工艺菲票流 | `buildFeiTicketLabelPrintDocument` | `LABEL_80_50` / `A4_LABEL_GRID` | 菲票号、原始裁片单、生产单、裁片部位、裁片数量、菲票归属原始裁片单 |
| 菲票补打标签 | `FEI_TICKET_REPRINT_LABEL` | `FEI_TICKET_RECORD` | 原菲票、补打原因、补打版本、打印记录 | `buildFeiTicketReprintLabelPrintDocument` | `LABEL_80_50` | 原菲票号、原始裁片单、补打版本、补打原因、补打人、补打时间 |
| 菲票作废标识 | `FEI_TICKET_VOID_LABEL` | `FEI_TICKET_RECORD` | 菲票作废记录、原始裁片单、生产单 | `buildFeiTicketVoidLabelPrintDocument` | `LABEL_80_50` | 已作废、不可流转、作废原因、作废人、作废时间 |
| 中转袋 / 周转口袋 / 周转箱二维码 | `TRANSFER_BAG_LABEL` | `TRANSFER_BAG_RECORD` | 载具周期、菲票绑定关系、车缝任务、回仓记录 | `buildTransferBagLabelPrintDocument` | `LABEL_100_60` | 载具编码、当前使用周期、绑定菲票数量、绑定裁片数量、当前状态 |
| 裁片单二维码 | `CUTTING_ORDER_QR_LABEL` | `CUTTING_ORDER_RECORD` | 原始裁片单、配料领料状态、当前执行批次 | `buildCuttingOrderQrLabelPrintDocument` | `LABEL_100_60` / `A4_LABEL_GRID` | 原始裁片单号、生产单、面料 SKU、计划裁片数量、配料状态、领料状态 |
| 交出记录二维码 | `HANDOVER_QR_LABEL` | `HANDOVER_RECORD` | 统一交出记录、统一回写和差异记录 | `buildHandoverQrLabelPrintDocument` | `LABEL_100_60` | 交出记录号、交出方、接收方、交出对象数量、实收对象数量、差异对象数量 |

标签类打印共用 `buildPrintQrPayload` 和 `buildPrintBarcodePayload`，二维码 payload 包含单据类型、来源类型、来源 ID、业务编号、目标路由、打印版本、补打状态和作废状态。菲票永远回落原始裁片单，合并裁剪批次只作为执行上下文；补打不改变菲票归属，也不覆盖原打印记录；作废标识只能进入作废记录或菲票详情，不能作为有效流转凭证。

支持的标签纸规格：

- `LABEL_80_50`
- `LABEL_100_60`
- `LABEL_60_40`
- `A4_LABEL_GRID`

## 本轮生产确认单 / 做货确认单接入清单

| 单据 | 文档类型 | 来源类型 | 数据来源 | 适配器 | 关键字段 |
| --- | --- | --- | --- | --- | --- |
| 生产确认单 | `PRODUCTION_CONFIRMATION` | `PRODUCTION_ORDER` | 生产单、生产需求、生产确认快照、技术包快照、面辅料、图片资料、工序工艺 | `buildProductionConfirmationPrintDocument` | 生产确认单号、生产单号、来源需求单号、款号、SPU、SKU / 颜色 / 尺码数量矩阵、面辅料信息、工序工艺、质检标准、签字确认区 |
| 做货确认单 | `MAKE_GOODS_CONFIRMATION` | `PRODUCTION_ORDER` | 同一生产单和生产资料快照，按工厂现场做货口径重排 | `buildMakeGoodsConfirmationPrintDocument` | 商品主图、款式图、面料、辅料、工艺要求、做货数量、工厂确认区 |

图片解析规则：

- 商品主图：优先取生产确认单快照和生产单关联商品图。
- 款式图：优先取技术包快照款式图。
- 样衣图：优先取技术包样衣图。
- 面料图：优先取技术包或 BOM 面料图片。
- 辅料图：优先取技术包或 BOM 辅料图片。
- 纸样图：优先取技术包纸样图片。
- 唛架图：优先取技术包唛架图。
- 花型图：优先取技术包花型图或印花图案图。
- 图片缺失时只显示紧凑“暂无图片”，不显示大块系统占位图。

A4 多页打印规则：

- 生产确认单默认 A4 纵向。
- 做货确认单默认 A4 纵向。
- 表格行使用 `break-inside` 和 `page-break-inside` 避免被切断。
- 图片区限制高度，不能撑破 A4 页面。
- 页脚显示生产单号、打印时间和“第 1 页 / 共 N 页”预览页码提示。
- 打印按钮、下载按钮和提示文案设置为非打印区域。

## 后续待接入模板

- 结算信息变更申请单
- 差异处理申请单
- 扣款确认单

## 中文流程图

打印任务流转卡
-> 统一打印预览
-> 读取文档类型
-> 读取来源类型
-> 调用对应业务适配器
-> 生成统一打印文档
-> 渲染任务流转卡模板
-> 用户打印或下载

打印任务交货卡
-> 统一打印预览
-> 读取交出记录
-> 判断交出工艺类型
-> 调用对应业务适配器
-> 生成统一打印文档
-> 渲染任务交货卡模板
-> 用户打印或下载

打印配料领料类单据
-> 统一打印预览
-> 读取单据类型
-> 读取来源业务数据
-> 调用对应业务适配器
-> 生成统一打印文档
-> 渲染对应单据模板
-> 用户打印或下载

打印标签类单据
-> 统一打印预览
-> 读取标签类型
-> 读取来源业务数据
-> 调用对应标签适配器
-> 生成统一打印文档
-> 渲染标签模板
-> 记录打印批次或打印版本
-> 用户打印

打印生产资料确认类单据
-> 统一打印预览
-> 读取单据类型
-> 读取生产单与生产确认数据
-> 解析商品图和物料图
-> 调用生产资料确认适配器
-> 生成统一打印文档
-> 渲染 A4 多页模板
-> 用户打印或下载

## 中文状态机

待生成
-> 预览中
-> 数据完整
-> 可打印
-> 已打印

异常流转：

预览中
-> 数据缺失
-> 使用紧凑占位或提示缺失字段
-> 可打印

任务交货卡异常流转：

预览中
-> 交出记录缺失
-> 显示缺失字段提示
-> 返回来源页面或继续打印可用字段

配料领料类单据异常流转：

预览中
-> 来源数据缺失
-> 显示缺失字段提示
-> 返回来源页面或继续打印可用字段

标签类补打流转：

原菲票
-> 发起补打
-> 生成补打版本
-> 统一打印预览
-> 已补打

标签类作废流转：

有效菲票
-> 发起作废
-> 记录作废原因
-> 生成作废标识
-> 已作废

生产资料确认类异常流转：

预览中
-> 图片或资料缺失
-> 使用紧凑占位
-> 可打印

## 后道任务流转卡流程口径

专门后道工厂完整流程：

接收领料
-> 质检
-> 后道
-> 复检
-> 交出

车缝厂已做后道后的后道工厂流程：

接收领料
-> 质检
-> 复检
-> 交出

后道已由车缝厂完成时，打印单只展示说明和车缝任务信息，不展示后道工厂再次执行后道节点。

## 第 7 步：业务申请单与打印治理收口

已接入业务申请单类打印模板：

- 结算信息变更申请单：读取 `settlement-change-requests`，使用 `buildSettlementChangeRequestPrintDocument`，关键字段包括申请单号、工厂名称、变更前信息、变更后信息、附件、签字区。
- 差异处理申请单：读取 `ProcessHandoverDifferenceRecord`、交出记录和回写记录，使用 `buildHandoverDifferenceRequestPrintDocument`，关键字段包括来源交出记录号、差异类型、应收对象数量、实收对象数量、差异对象数量、平台处理区。
- 质量扣款确认单：读取待确认质量扣款记录、质检记录和证据，使用 `buildQualityDeductionConfirmationPrintDocument`，关键字段包括待确认质量扣款记录号、建议扣款金额、币种、计价单位、工厂确认区。
- 质量异议处理单：读取质量异议单、待确认质量扣款记录、质检记录和平台裁决结果，使用 `buildQualityDisputeProcessingPrintDocument`，关键字段包括异议原因、工厂证据、平台裁决、后续处理区。
- 资料变更申请单：读取资料变更申请 mock adapter，使用 `buildMasterDataChangeRequestPrintDocument`，关键字段包括变更前后对比、附件区、审核区、签字区。

统一打印记录模型：

- 模型文件：`src/data/fcs/print-record-domain.ts`
- 统一对象：`PrintRecord`
- 记录字段：打印记录号、打印批次号、单据类型、来源类型、来源 ID、业务编号、模板编码、模板名称、纸张规格、打印模式、打印版本、打印人、打印时间、份数、页数、条目数、二维码摘要、打印状态、备注。
- 记录函数：`createPrintRecord`、`listPrintRecords`、`getPrintRecordById`、`getPrintRecordsBySource`、`markPrintRecordPrinted`、`createReprintRecord`。
- 当前前端原型无法监听浏览器真实打印完成，统一打印预览生成 `已预览` 记录；点击打印按钮执行浏览器打印。

模板注册表治理规则：

- 所有已接入 `documentType` 必须集中注册在 `printTemplateRegistry`。
- 每个模板必须具备中文模板名称、来源类型、文档构建函数和渲染函数。
- `validatePrintTemplateRegistry` 负责检查模板缺失、中文名称缺失、来源类型缺失、构建函数缺失和渲染函数缺失。
- 禁止存在未注册却可点击的打印入口。

散点打印治理规则：

- 统一打印预览页是唯一允许调用 `window.print` 的位置。
- 业务页面不得直接 `window.print` 打印业务单据。
- 业务页面不得使用 `window.open`、`printWindow.document.write` 或临时 HTML 打印本轮范围内单据。
- 历史未纳入本轮范围的散点打印必须在检查脚本中列入治理清单，不能默默新增。

全部已接入 documentType 清单：

- `TASK_ROUTE_CARD`
- `TASK_DELIVERY_CARD`
- `MATERIAL_PREP_SLIP`
- `PICKUP_SLIP`
- `ISSUE_SLIP`
- `SUPPLEMENT_MATERIAL_SLIP`
- `FEI_TICKET_LABEL`
- `FEI_TICKET_REPRINT_LABEL`
- `FEI_TICKET_VOID_LABEL`
- `TRANSFER_BAG_LABEL`
- `CUTTING_ORDER_QR_LABEL`
- `HANDOVER_QR_LABEL`
- `PRODUCTION_CONFIRMATION`
- `MAKE_GOODS_CONFIRMATION`
- `SETTLEMENT_CHANGE_REQUEST`
- `HANDOVER_DIFFERENCE_REQUEST`
- `QUALITY_DEDUCTION_CONFIRMATION`
- `QUALITY_DISPUTE_PROCESSING`
- `MASTER_DATA_CHANGE_REQUEST`

打印业务申请单
-> 统一打印预览
-> 读取申请单类型
-> 读取来源业务数据
-> 调用业务申请单适配器
-> 生成统一打印文档
-> 渲染业务申请单模板
-> 写入打印记录
-> 用户打印或下载

统一打印治理
-> 扫描打印入口
-> 校验模板注册
-> 校验文档构建函数
-> 校验打印样式
-> 校验打印记录
-> 校验 Playwright 覆盖
-> 输出治理结果

业务申请单打印状态机：

待预览
-> 已预览
-> 已打印

补打流转：

已打印
-> 发起补打
-> 已补打

异常流转：

待预览
-> 打印异常
-> 修复数据或模板
-> 已预览

质量扣款冻结口径：

- 质检记录不是质量异议单。
- 待确认质量扣款记录不是正式质量扣款流水。
- 质量扣款确认单打印时不生成质量扣款流水。
- 质量异议处理单打印时不触发结算。
- 异议中记录不进入对账单。
