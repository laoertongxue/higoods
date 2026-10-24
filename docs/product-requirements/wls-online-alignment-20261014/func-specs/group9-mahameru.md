# Group 9 新中转仓 Mahameru — 测试环境实点汇总 (2026-10-14)

## 与 Hilon 的结构关系
Mahameru 全部 11 个可访问页面与 Hilon 同名页面**同模板**（页头说明、筛选、表列、状态 Tab、行操作一致），仅数据范围/仓库上下文不同。唯一差异：**无「裁片配料单All」菜单**（Hilon 有）。当前测试环境 Mahameru 业务数据多为 0（裁片配料 2 条、其余空）。

## 逐页确认（与 Hilon 对应页一致）
| 菜单 | URL | 与 Hilon 差异 |
| --- | --- | --- |
| 裁片配料单 | /wls/cutting_ingredient_allocation_new/index | 同筛选/列/动作；表头多「物料类型」列；数据 2 条 |
| 预入库管理 | /wls/deploy_transfer_wh_new/inbound | 同 |
| 收货单管理 | /wls/deploy_transfer_wh_new/received | 同（当前空） |
| 上架单管理 | /wls/deploy_transfer_wh_new/putaway | 同（当前空） |
| 中转仓库存 | /wls/deploy_transfer_wh_new/inventory | 同（当前空） |
| 中转仓库位 | /wls/deploy_transfer_wh_new/location | 同（当前空） |
| 生产单校验 | /wls/deploy_transfer_wh_new/production_check | 同（当前空） |
| 配料单管理 | /wls/deploy_transfer_wh_new/ingredients | 同（当前空） |
| 出库单管理 | /wls/deploy_transfer_wh_new/outbound | 同（当前空） |
| 作业单管理 | /wls/deploy_transfer_wh_new/work_putaway | 同（当前空）；页头仍写 WH-XNKC-001 |
| 裁剪厂分配 | /wls/deploy_transfer_wh_new/cutting_task_allocation | 同筛选/列/动作；页头承接工厂为 **sea cutting 与 sea2-PPIC**（Hilon 为 sea cutting 与 sea-PPIC） |

## 原型对齐要点
1. Mahameru 组不应有「裁片配料单All」菜单项（NAME-01：多出项按用户口径处理）
2. 裁片配料（新中转仓）表头含物料类型列（Hilon 版无）
3. 裁剪厂分配承接工厂文案：Hilon=sea-PPIC，Mahameru=sea2-PPIC
