# 菲票逐片生成与特殊工艺携带

## 业务口径

一片一个菲票，一片裁片实例必须对应一张唯一菲票。裁片实例来自技术包纸样管理中的颜色片数和逐片特殊工艺配置，菲票生成时复制裁片实例 ID、部位、颜色、尺码、片序号，以及该实例上的特殊工艺和左 / 右 / 底 / 面位置。

菲票归属原始裁片单。合并裁剪批次只能作为执行上下文，用于说明现场裁剪批次来源，不得成为菲票归属主体。

## 字段关系

- 裁片实例：`pieceInstanceId`、`sourcePieceId`、`pieceName`、`colorId`、`colorName`、`sequenceNo`。
- 菲票：`feiTicketId`、`feiTicketNo`、`sourcePieceInstanceId`、`originalCutPieceOrderId`、`originalCutPieceOrderNo`、`mergeBatchId`、`qrCodePayload`。
- 特殊工艺：`craftCode`、`craftName`、`craftPosition`、`craftPositionName`、`sourceAssignmentId`。
- 二维码：包含菲票编号、来源裁片实例、原始裁片单、部位、颜色、尺码、片序号和结构化特殊工艺。

## 补打与作废

补打不生成新的业务菲票，只更新原菲票的补打标记和原始菲票 ID。已打印菲票不能静默删除，如需取消必须作废并填写作废原因。

## 后续消费

特殊工艺任务后续可通过菲票上的 `specialCrafts` 判断该片需要哪些工艺，并通过 `relatedFeiTicketIds` 追溯差异记录。当前步骤不生成特殊工艺任务主流程，只提供可追溯的逐片菲票事实源。

## 流程图

技术包纸样生成裁片实例
-> 裁片实例携带特殊工艺
-> 原始裁片单确认生成菲票
-> 每个裁片实例生成唯一菲票
-> 菲票携带特殊工艺和工艺位置
-> 打印菲票和二维码
-> 扫描菲票进入周转口袋或特殊工艺流转

## 状态机

待生成
-> 已生成
-> 已打印
-> 已绑定周转口袋
-> 已交出
-> 已流转到下一工序
-> 已完成

异常状态：

已打印
-> 已补打

已打印
-> 已作废
