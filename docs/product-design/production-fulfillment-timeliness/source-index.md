# 设计事实来源索引

代码版本：main @ 4804328a822eec3c77eee1ffa5b10911bb77c9fe。以下链接是设计核查入口，不代表新增能力已实现。

|主题|直接依据|
|---|---|
|DDS现有菜单结构|[app-shell-config.ts](/Users/laoer/Documents/higoods/src/data/app-shell-config.ts:634)|
|DDS现有路由接入方式|[routes.ts](/Users/laoer/Documents/higoods/src/router/routes.ts:235)|
|DDS现有页面与事件入口|[material-decision/index.ts](/Users/laoer/Documents/higoods/src/pages/material-decision/index.ts:1)、[main.ts](/Users/laoer/Documents/higoods/src/main.ts:1555)|
|生产需求源头字段|[production-demands.ts](/Users/laoer/Documents/higoods/src/data/fcs/production-demands.ts:47)|
|生产单多需求来源|[production-orders.ts](/Users/laoer/Documents/higoods/src/data/fcs/production-orders.ts:221)|
|准备单与任务数据模型|[pcs-engineering-master-types.ts](/Users/laoer/Documents/higoods/src/data/pcs-engineering-master-types.ts:180)|
|准备创建／资料复用|[pcs-engineering-master-repository.ts](/Users/laoer/Documents/higoods/src/data/pcs-engineering-master-repository.ts:304)|
|专业任务与依赖适用判断|[pcs-engineering-dependency-policy.ts](/Users/laoer/Documents/higoods/src/data/pcs-engineering-dependency-policy.ts:170)|
|准备投影尚无需求／生产单号|[pcs-engineering-preparation-projection.ts](/Users/laoer/Documents/higoods/src/data/pcs-engineering-preparation-projection.ts:398)|
|采购下单覆盖联动|[pcs-engineering-purchase-linkage.ts](/Users/laoer/Documents/higoods/src/data/pcs-engineering-purchase-linkage.ts:125)|
|提前染色／印花候选及匹配|[production-demand-early-process-work-orders.ts](/Users/laoer/Documents/higoods/src/data/fcs/production-demand-early-process-work-orders.ts:1)|
|技术工艺路线|[tech-pack-process-route.ts](/Users/laoer/Documents/higoods/src/data/tech-pack-process-route.ts)|
|车缝时效含演示数据|[sewing-production-order-duration.ts](/Users/laoer/Documents/higoods/src/data/fcs/sewing-production-order-duration.ts:222)|
|旧车缝计时存在周日例外|[sewing-return-calendar.ts](/Users/laoer/Documents/higoods/src/data/fcs/sewing-return-calendar.ts:1)|
|明确款式图来源|[production-demands.ts](/Users/laoer/Documents/higoods/src/data/fcs/production-demands.ts:466)|
|标准列表／分页复用|[list-page.ts](/Users/laoer/Documents/higoods/src/components/ui/list-page.ts)、[pagination.ts](/Users/laoer/Documents/higoods/src/components/ui/pagination.ts)|
|会议原件|[会议纪要](</Users/laoer/Desktop/智能纪要：服装生产全链路时效管控会议 2026年9月16日.docx>)|
|旧业务方案|[业务方案V1.0](/Users/laoer/Downloads/higoods_生产任务全流程时效管理与监控_业务方案_V1.0.md)|

用户本轮确认的“实发时才确认客户订单”“缺料采购到仓后继续调拨、库存够也需调拨”“商品采购单与需求单1:1”“全部自然日”，来自当前对话，优先于旧资料。线上截图确认页面存在的字段和状态，不据此声称已取得后端数据模型或接口。

本设计未访问或修改线上采购、仓储、订单、发货数据；所有演示采购号、订单号和工厂人员均带Mock说明。
