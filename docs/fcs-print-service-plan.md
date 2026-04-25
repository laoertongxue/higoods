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

以上任务流转卡均接入 `TASK_ROUTE_CARD` 单据类型，以上任务交货卡均接入 `TASK_DELIVERY_CARD` 单据类型。两类单据统一通过 `/fcs/print/preview` 预览，旧 `/fcs/print/task-route-card` 和 `/fcs/print/task-delivery-card` 继续兼容。

配料、领料、发料、补料类单据分别接入 `MATERIAL_PREP_SLIP`、`PICKUP_SLIP`、`ISSUE_SLIP`、`SUPPLEMENT_MATERIAL_SLIP` 单据类型，统一走 `/fcs/print/preview`，页面入口只负责传入来源 ID，不再在业务页面内拼接临时打印 HTML。

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

## 后续待接入模板

- 菲票
- 中转袋二维码
- 裁片单二维码标签
- 交出记录二维码标签
- 生产确认单
- 结算信息变更申请单

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
