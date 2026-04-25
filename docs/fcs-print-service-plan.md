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

以上任务流转卡均接入 `TASK_ROUTE_CARD` 单据类型，统一通过 `/fcs/print/preview` 预览，旧 `/fcs/print/task-route-card` 继续兼容。

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

## 后续待接入模板

- 任务交货卡
- 配料单
- 领料单
- 菲票
- 中转袋二维码
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
