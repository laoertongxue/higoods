# 采购管理列表工具栏：改前只读布局盘点

检查环境：本机旧生产预览 `http://127.0.0.1:43965`，隔离Chrome会话 `pmscompact-before`，现已关闭。实际加载75份JS/CSS，SHA256全部与冻结dist一致；完整版本及脚本哈希见environment.json和loaded-assets.json。当前dev修改未混入这批改前证据。

从routes-pms.ts仅提取21个route字符串，未探索源码结构。21页面在1366×768、1280×720分别实际渲染并截图，共42个主页面样本。另只读打开18个详情/日志/渠道入口，两视口共36个截图。按钮、记录数、列设置的判断来自实际矩形、可见性和截图；关闭details里的隐藏批量按钮已剔除，没有把隐藏标签当换行。

## 主列表问题

面辅料采购单的独立列表卡片表头在两个视口均为189px高。所有按钮36px高、宽90～174px，可见操作控件占三行；记录数在上方，列设置在第三行，未处于同一行。1366下表头宽1044px，1280下宽958px。原始截图：material-purchase-orders-1366.png、material-purchase-orders-1280.png。

其余20个主列表在两个视口均为61px表头、可见操作控件一行，记录数与列设置同一行。通常按钮36px高；是否统一压缩由主代理按本次要求决定。所有42个主页面以及36个只读详情样本均无document主体横向溢出。

## 逐页清单

| 页面 | 路径 | 1366表头高/控件行数/同一行 | 1280表头高/控件行数/同一行 | 原始截图 |
|---|---|---|---|---|
| 商品采购建议 | /pms/purchase-suggestions | 61px / 1行 / 是 | 61px / 1行 / 是 | purchase-suggestions-1366.png、purchase-suggestions-1280.png |
| KOL 采购需求 | /pms/kol-demands | 61px / 1行 / 是 | 61px / 1行 / 是 | kol-demands-1366.png、kol-demands-1280.png |
| 商品采购单 | /pms/product-purchase-orders | 61px / 1行 / 是 | 61px / 1行 / 是 | product-purchase-orders-1366.png、product-purchase-orders-1280.png |
| 备货列表 | /pms/reorder | 61px / 1行 / 是 | 61px / 1行 / 是 | reorder-1366.png、reorder-1280.png |
| 商品采购售后 | /pms/product-purchase-order-aftersales | 61px / 1行 / 是 | 61px / 1行 / 是 | product-purchase-order-aftersales-1366.png、product-purchase-order-aftersales-1280.png |
| 面辅料需求分析 | /pms/material-requirements | 61px / 1行 / 是 | 61px / 1行 / 是 | material-requirements-1366.png、material-requirements-1280.png |
| 面辅料采购单 | /pms/material-purchase-orders | 189px / 3行 / 否 | 189px / 3行 / 否 | material-purchase-orders-1366.png、material-purchase-orders-1280.png |
| 面辅料采购跟踪 | /pms/material-purchase-tracking | 61px / 1行 / 是 | 61px / 1行 / 是 | material-purchase-tracking-1366.png、material-purchase-tracking-1280.png |
| 面辅料采购时效 | /pms/fitting-timeliness | 61px / 1行 / 是 | 61px / 1行 / 是 | fitting-timeliness-1366.png、fitting-timeliness-1280.png |
| 面辅料供应商确认单 | /pms/material-supplier-confirmations | 61px / 1行 / 是 | 61px / 1行 / 是 | material-supplier-confirmations-1366.png、material-supplier-confirmations-1280.png |
| 头程物流 | /pms/first-leg-shipments | 61px / 1行 / 是 | 61px / 1行 / 是 | first-leg-shipments-1366.png、first-leg-shipments-1280.png |
| 头程物流商管理 | /pms/first-leg-carriers | 61px / 1行 / 是 | 61px / 1行 / 是 | first-leg-carriers-1366.png、first-leg-carriers-1280.png |
| KOL 库存 | /pms/kol-sample-stock | 61px / 1行 / 是 | 61px / 1行 / 是 | kol-sample-stock-1366.png、kol-sample-stock-1280.png |
| 锁定操作记录 | /pms/kol-sample-stock/lock-log | 61px / 1行 / 是 | 61px / 1行 / 是 | kol-sample-stock--lock-log-1366.png、kol-sample-stock--lock-log-1280.png |
| 手动寄样申请 | /pms/kol-sample-apply | 61px / 1行 / 是 | 61px / 1行 / 是 | kol-sample-apply-1366.png、kol-sample-apply-1280.png |
| 对外样品池链接 | /pms/kol-sample-link | 61px / 1行 / 是 | 61px / 1行 / 是 | kol-sample-link-1366.png、kol-sample-link-1280.png |
| 商品供应商管理 | /pms/suppliers | 61px / 1行 / 是 | 61px / 1行 / 是 | suppliers-1366.png、suppliers-1280.png |
| 供应商供货档案 | /pms/supplier-supply-archives | 61px / 1行 / 是 | 61px / 1行 / 是 | supplier-supply-archives-1366.png、supplier-supply-archives-1280.png |
| 面辅料采购请款 | /pms/material-payment-requests | 61px / 1行 / 是 | 61px / 1行 / 是 | material-payment-requests-1366.png、material-payment-requests-1280.png |
| 物流费用请款 | /pms/logistics-payment-requests | 61px / 1行 / 是 | 61px / 1行 / 是 | logistics-payment-requests-1366.png、logistics-payment-requests-1280.png |
| 原料仓库存查询 | /pms/material-inventory | 61px / 1行 / 是 | 61px / 1行 / 是 | material-inventory-1366.png、material-inventory-1280.png |

## 只读子页清单

18个入口的可见详情没有额外的标准列表批量工具栏；父列表表头与弹窗内容已经区分。渠道管理子表是信息表加单个新增渠道入口，没有同类多行批量区；未点击新增。详情内可能包含执行/处理按钮，只打开详情而未操作。

| 父页面 | 只读入口 | 实际弹窗 | 子表数 | 1366截图 |
|---|---|---|---|---|
| /pms/purchase-suggestions | 查看SKU | 采购建议明细 | 1 | detail-purchase-suggestions-0-1366.png |
| /pms/kol-demands | 明细 | KOL 需求明细 | 2 | detail-kol-demands-1-1366.png |
| /pms/product-purchase-orders | 详情 | 采购单详情 | 1 | detail-product-purchase-orders-2-1366.png |
| /pms/product-purchase-order-aftersales | 日志 | 售后日志 | 1 | detail-product-purchase-order-aftersales-3-1366.png |
| /pms/material-requirements | 查看明细 | 面辅料需求明细 | 1 | detail-material-requirements-4-1366.png |
| /pms/material-purchase-orders | 查看详情 | 面辅料采购单详情 | 2 | detail-material-purchase-orders-5-1366.png |
| /pms/material-supplier-confirmations | 查看 | 包装与标签 | 3 | detail-material-supplier-confirmations-6-1366.png |
| /pms/material-supplier-confirmations | 操作日志 | 确认单操作日志 | 0 | detail-material-supplier-confirmations-0-1366.png |
| /pms/first-leg-shipments | 详情与推进 | 头程单详情 | 1 | detail-first-leg-shipments-1-1366.png |
| /pms/first-leg-carriers | 渠道管理 | 渠道管理 | 1 | detail-first-leg-carriers-2-1366.png |
| /pms/first-leg-carriers | 查看 | 查看详情 | 0 | detail-first-leg-carriers-3-1366.png |
| /pms/kol-sample-apply | 详情 | 手动寄样申请详情 | 0 | detail-kol-sample-apply-4-1366.png |
| /pms/suppliers | 详情 | 供应商详情 | 0 | detail-suppliers-5-1366.png |
| /pms/supplier-supply-archives | 换算与快照 | 供货档案详情 | 1 | detail-supplier-supply-archives-6-1366.png |
| /pms/material-payment-requests | 详情与处理 | 请款单详情 | 3 | detail-material-payment-requests-0-1366.png |
| /pms/logistics-payment-requests | 详情与处理 | 请款单详情 | 3 | detail-logistics-payment-requests-1-1366.png |
| /pms/material-inventory | 查看盘点记录 | FAB-2026-001-BLK 盘点记录 | 0 | detail-material-inventory-2-1366.png |
| /pms/material-inventory | 日志明细 | FAB-2026-001-BLK 库存流水 | 0 | detail-material-inventory-3-1366.png |

## 边界与保留证据

- 条码明细额外尝试命中了隐藏同名菜单项，未取得其布局。失败日志保留为barcode-ledger-invisible-menu.log；未强制点击，也不据此判定产品功能故障。该子页不在18个成功入口之内。
- 未展开更多筛选、列设置或批量操作菜单，未执行业务编辑、保存、新增、打印、导入、删除、签收或推进。
- 初次批量DOM测量把关闭details里的子按钮计入；已按实际可见规则修正并重采全部42个主页面。主清单使用重采结果，截图与实际几何一致。
- inventory.json为摘要；main-pages.json、readonly-details.json与各batch JSON保留实际DOM/几何/可见控件、弹窗HTML和截图文件名。environment.json、loaded-assets.json保留版本身份。
