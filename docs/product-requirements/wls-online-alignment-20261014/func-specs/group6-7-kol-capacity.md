# Group 6 KOL移货申请 + Group 7 产能统计 — 测试环境实点汇总 (2026-10-14)

## KOL移货申请 `/wls/kol_transfer_apply/index`
- 无页头说明
- 筛选：关键词、状态（全部/待处理/已生成移货单/已驳回/已完成）、申请时间—、每页显示、搜索/重置
- 主操作：发起移货申请、发起退还申请（两个入口）
- 表列：ID、申请信息、商品信息、申请数量、状态、备注、操作

## 产能统计 6 页共性模板
- URL 默认带业务日范围参数（如 receive_date_start=… + 7 天，limit=15）
- 筛选：日期范围（~）、全部仓库（F&M WH/A&C WH）、全部账号、搜索/重置筛选
- 统计三卡：SKU种类总数（当前筛选范围内去重）、总产能（某数量合计口径）、涉及账号（有记录的账号数）
- 表列：仓库、时间、账号、岗位、产能
- 业务日定义统一：当日 08:00 至次日 07:59，凌晨计入前一天

| 页面 | URL | 时间列名 | 页头统计口径 | 产能口径 |
| --- | --- | --- | --- | --- |
| 回货入库 | /wls/employee_capacity_inbound | 收货时间 | SKU 收货数量合计 | 入库单收货人 |
| 退货入库 | /wls/employee_capacity_return_inbound | 上架时间 | SKU 上架数量合计 | 退货入库单上架人 |
| 成衣上架 | /wls/employee_capacity_garment_shelf | 上架时间 | 目标库位入库数量合计 | 库位库存日志 type=10（拣货区上货架） |
| 库存盘点 | /wls/employee_capacity_stock_take | 盘点时间 | 实际盘点数量合计 | 盘点单 take_id / take_time / actual_sku_qty |
| 成衣拣货 | /wls/employee_capacity_garment_pick | 拣货时间 | 拣货移出数量合计 | 库位库存日志 type=11（拣货单完成） |
| 发货扫描 | /wls/employee_capacity_ship_scan | 发货时间 | 出库扣减数量合计 | 库位库存日志 type=2（订单打单出库） |
