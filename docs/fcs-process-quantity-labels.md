# FCS 加工对象与数量单位收口

## 目标

第 7 步将印花、染色、裁片、特殊工艺中的数量字段统一为“加工对象 + 数量单位”的中文表达，避免页面、移动端、平台侧、打印和操作记录继续只写“数量”。

## 中文流程图

```text
读取工艺类型
-> 读取加工对象类型
-> 读取数量用途
-> 判断单位
-> 生成对象化数量文案
-> 页面和打印统一展示
```

## 中文状态机

```text
待识别
-> 已识别工艺类型
-> 已识别加工对象
-> 已识别数量用途
-> 已生成数量文案
-> 已完成展示
```

异常流转：

```text
已识别工艺类型
-> 缺少加工对象
-> 使用默认对象规则
-> 输出需要补齐对象类型
```

## 统一规则

- 印花分为面料印花和裁片印花：面料印花使用“面料米数 / 卷数”，裁片印花使用“裁片数量”。
- 染色默认加工对象为面料，核心展示为“面料米数”和“卷数”。
- 裁片执行口径使用“裁片数量”；生产单和 SKU 计划可以展示“成衣件数”，但不得替代裁片执行数量。
- 特殊工艺执行口径使用“裁片数量”，菲票绑定和差异使用“菲票数量”。
- 页面、弹窗、移动端、打印、统计、操作记录不得只写“数量”；必须展示“计划印花面料米数”“转印完成裁片数量”“染色交出卷数”“绑定菲票数量”等对象化文案。
- 写回 payload 不得只传 `qty`，必须包含 `objectType`、`objectQty`、`qtyUnit`，并可携带或派生 `qtyLabel`。

## 实现入口

- 统一数量文案模块：`src/data/fcs/process-quantity-labels.ts`
- Web / 移动端统一写回：`src/data/fcs/process-action-writeback-service.ts`
- 印花列表与详情：`src/pages/process-factory/printing/work-orders.ts`、`src/pages/process-factory/printing/work-order-detail.ts`
- 移动端执行列表与详情：`src/pages/pda-exec.ts`、`src/pages/pda-exec-detail.ts`
- 平台侧印花 / 染色：`src/pages/process-print-orders.ts`、`src/pages/process-dye-orders.ts`
- 打印卡片：`src/data/fcs/task-print-cards.ts`、`src/pages/print/task-card-shared.ts`

## 前置能力保持

- F090 全能力测试工厂口径不变。
- 加工单与移动端任务绑定校验不变。
- 移动端执行列表与直达详情一致不变。
- 平台聚合状态仍由统一状态映射派生。
- Web 端与移动端状态操作仍共用统一写回服务。
