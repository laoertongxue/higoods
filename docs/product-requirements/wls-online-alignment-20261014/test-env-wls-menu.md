# 测试环境 WLS 完整菜单（2026-10-14 实测，103 项，按侧栏 DOM 顺序）

来源：http://test_manage.higood.ai 登录态侧栏实链（超级管理员）。PDA 管理组链接不含 /wls/ 未列入本表（2026-10-13 已对齐）。

## 生产配料管理 (6)
| 菜单 | URL |
| --- | --- |
| 染色配料 | /wls/dyeing_ingredient_allocation/index |
| 印花配料 | /wls/printing_ingredient_allocation/index |
| 车缝配料 | /wls/sewing_ingredient_allocation/index |
| 其它配料 | /wls/other_ingredient_allocation/index |
| 毛织配料 | /wls/knitting_ingredient_allocation/index |
| 面料需求看板列表 | /wls/fabric_demand_board/index |

## 基础数据 (5)
| 菜单 | URL |
| --- | --- |
| 仓库管理 | /wls/warehouse_manage/index |
| 库区库位管理 | /wls/zone_manage/index |
| 主体管理 | /wls/subject_manage/index |
| 订单编码管理 | /wls/generate_code_rule_manage/index |
| 集货标签管理 | /wls/collect_container_manage/index |

## 入库管理 (4)
| 菜单 | URL |
| --- | --- |
| 预入库管理 | /wls/inbound_manage/index |
| 入库单列表 | /wls/inbound_manage/receive_list |
| 成衣换码管理 | /wls/change_product_task_manage/index |
| 退货入库列表 | /wls/return_inbound_manage/index |

## 出库管理 (10)
| 菜单 | URL |
| --- | --- |
| 拣货单管理 | /wls/pick_order_manage/index |
| 扫码拣货 | /wls/pick_order_manage/scan_pick |
| 打单揽收统计 | /wls/order_print_preview_manage/index |
| KOL待打单管理 | /wls/kol_outbound_manage/index |
| SKU扫码发货 | /wls/checkout_order_manage/index |
| 按单扫码发货 | /wls/checkout_order_manage/multi_index |
| 出库单管理 | /wls/warehouse_order_manage/index |
| 借出单管理 | /wls/borrow_order_manage/index |
| Shopee订单管理 | /wls/shopee_outbound_manage/index |
| 推广任务单管理 | /wls/fake_outbound_manage/index |

## 库存管理 (21)
| 菜单 | URL |
| --- | --- |
| 中转领料单 | /wls/transfer_requisition_manage/index |
| 中转配料单 | /wls/transfer_ingredients_manage/index |
| 中转出库单 | /wls/transfer_outbound_manage/index |
| 集货预出库管理 | /wls/consolidation_pack_ship_manage/index |
| 集货拣货单管理 | /wls/consolidation_pack_ship_manage/collect_index |
| 集货分拣单管理 | /wls/collect_sort_manage/index |
| 集货箱订单管理 | /wls/collect_box_order_manage/index |
| 集货单扫码发货 | /wls/checkout_order_manage/collect_multi_index |
| 即时库存查询（成衣） | /wls/inventory_inquiry/index |
| 库存流水查询（成衣） | /wls/inventory_inquiry/log |
| 仓位库存查询（成衣） | /wls/inventory_inquiry/warehouse |
| 仓库库存管理 | /wls/inventory_list_manage/index |
| 即时库存查询（中转） | /wls/transfer_inquiry/index |
| 库存流水查询（中转） | /wls/transfer_inquiry/log |
| 仓位库存查询（中转） | /wls/transfer_inquiry/warehouse |
| 成衣移货 | /wls/inventory_internal/index |
| 中转移货 | /wls/transfer_inventory_internal/index |
| 成衣调拨 | /wls/stock_allocate/index |
| 中转调拨 | /wls/transfer_allocate/index |
| 成衣仓盘点 | /wls/garment_stock_take_manage/index |
| 中转仓盘点 | /wls/transfer_stock_take_manage/index |

## KOL移货申请 (1)
| 菜单 | URL |
| --- | --- |
| KOL移货申请 | /wls/kol_transfer_apply/index |

## 产能统计 (6)
| 菜单 | URL |
| --- | --- |
| 回货入库 | /wls/employee_capacity_inbound/index |
| 退货入库 | /wls/employee_capacity_return_inbound/index |
| 成衣上架 | /wls/employee_capacity_garment_shelf/index |
| 库存盘点 | /wls/employee_capacity_stock_take/index |
| 成衣拣货 | /wls/employee_capacity_garment_pick/index |
| 发货扫描 | /wls/employee_capacity_ship_scan/index |

## 老中转仓 Hilon (12)
| 菜单 | URL |
| --- | --- |
| 裁片配料单 | /wls/cutting_ingredient_allocation/index |
| 预入库管理 | /wls/deploy_inbound_manage/index |
| 收货单管理 | /wls/deploy_received_manage/index |
| 上架单管理 | /wls/deploy_putaway_manage/index |
| 中转仓库存 | /wls/deploy_inventory_manage/index |
| 中转仓库位 | /wls/deploy_location_manage/index |
| 生产单校验 | /wls/deploy_production_check_snapshot_manage/index |
| 配料单管理 | /wls/deploy_ingredients_manage/index |
| 出库单管理 | /wls/deploy_outbound_manage/index |
| 作业单管理 | /wls/deploy_work_putaway_manage/index |
| 裁剪厂分配 | /wls/deploy_cutting_task_allocation_manage/index |
| 裁片配料单All | /wls/cutting_ingredient_allocation_all/index |

## 新中转仓 Mahameru (12)
| 菜单 | URL |
| --- | --- |
| 裁片配料单 | /wls/cutting_ingredient_allocation_new/index |
| 预入库管理 | /wls/deploy_transfer_wh_new/inbound |
| 收货单管理 | /wls/deploy_transfer_wh_new/received |
| 上架单管理 | /wls/deploy_transfer_wh_new/putaway |
| 中转仓库存 | /wls/deploy_transfer_wh_new/inventory |
| 中转仓库位 | /wls/deploy_transfer_wh_new/location |
| 生产单校验 | /wls/deploy_transfer_wh_new/production_check |
| 配料单管理 | /wls/deploy_transfer_wh_new/ingredients |
| 出库单管理 | /wls/deploy_transfer_wh_new/outbound |
| 作业单管理 | /wls/deploy_transfer_wh_new/work_putaway |
| 裁剪厂分配 | /wls/deploy_transfer_wh_new/cutting_task_allocation |
| （无 裁片配料单All） | — |

## 成衣管理 (3)
| 菜单 | URL |
| --- | --- |
| 入库管理 | /wls/inbound_manage/index（与入库管理组同页） |
| 预出库管理 | /wls/outbound_manage/index |
| 库存管理 | /wls/inventory/index（面料库存总览） |

## 原料管理 (24)
| 菜单 | URL |
| --- | --- |
| 织带到货列表 | /wls/material_inbound_manage/index_webbing |
| 织带半成品到货列表 | /wls/material_inbound_manage/index_webbing_base |
| 采购到货列表 | /wls/material_inbound_manage/index_purchase |
| 染色到货列表 | /wls/material_inbound_manage/index_dyeing |
| 印花到货列表 | /wls/material_inbound_manage/index_printing |
| 手动入库单 | /wls/material_inbound_manage/index_allocate |
| 绣花到货列表 | /wls/material_inbound_manage/index_embroidery |
| 所有调拨单 | /wls/material_transfer_apply/all |
| 等待调拨 | /wls/material_transfer_apply/wait_transfer |
| 调拨待交出列表 | /wls/material_transfer_apply/wait_handover（后端方法不存在，跳控制面板） |
| 调拨交出单据 | /wls/material_transfer_apply/handover（后端方法不存在，跳控制面板） |
| 等待入库 | /wls/material_transfer_apply/wait_inbound |
| 待上架列表 | /wls/barcode_print/pending |
| 原料条码列表 | /wls/barcode_print/index |
| 手动出库列表 | /wls/material_outbound_manage/index_allocate |
| 领料出库列表 | /wls/material_outbound_manage/index_requisition |
| 耗材出库列表 | /wls/material_outbound_manage/index_consumable |
| 原料移货 | /wls/material_move/index |
| 库存查询列表 | /wls/material_inquiry/index |
| 库存流水列表 | /wls/material_inquiry/log |
| 仓位库存列表 | /wls/material_inquiry/warehouse |
| 库存盘点列表 | /wls/stock_take_manage/index |
| 面料条码异常 | /wls/material_barcode_abnormal/index |
| 备货面料库存监控 | /wls/material_preparation/index |

## 备注
- 调拨待交出列表 / 调拨交出单据：菜单存在但后端返回「方法不存在: wait_handover / handover」并跳转控制面板。原型侧按同模块兄弟页（所有调拨单 / 等待调拨 / 等待入库）模式实现列表页。
- 新中转仓无「裁片配料单All」；老中转仓有。原型菜单若在 Mahameru 组存在「裁片配料单All」则为多出项，需按 NAME-01 处理（拟删除多余菜单项）。
