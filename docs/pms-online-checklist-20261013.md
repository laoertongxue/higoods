# 采购管理线上核查当前清单

文本证据冻结范围：2026-10-13T07:12:47.501Z ～ 2026-10-13T07:30:10.562Z（北京时间至15:30:10.562）；另补已保存并视读的15:33:20.611采购备注原生截图。

现有 125 份证据（103 TXT、20 DOM摘要JSON、1 PNG、1浏览器恢复阻塞JSON），完整菜单27项，进入6页但均未完整核查；另21页尚未进入。条目 130，稳定编号继承seed并追加。

**当前没有实施。本文不是实施后清单，也不代表功能已经补齐。** 最后新增、保存、审核、入库、出库、复制、拆分等线上写入均未提交。

浏览器阻塞：Chrome request-header policy；原生截图读取可用，但操作noWindowsAvailable。四个面辅料表单在循环超时前已落盘，不能因后续工具阻塞将其记为未点击。恢复阻塞JSON不算新的业务按钮点击。

## 完整菜单与页面进入状态

| 顺序 | 菜单组 | 叶子菜单 | 线上路由 | 原型路由 / icon | 核查状态 |
|---|---|---|---|---|---|
| 1.1 | 采购建议 | 商品采购建议 | https://manage.higood.ai/pms/product_suggest_purchase/index | `/pms/purchase-suggestions` / Lightbulb | 部分进入 |
| 1.2 | 采购建议 | KOL采购需求 | https://manage.higood.ai/pms/kol_purchase_demand/index | `/pms/kol-demands` / Megaphone | 部分进入 |
| 2.1 | 商品采购 | 商品采购单 | https://manage.higood.ai/pms/product_purchase_order/index | `/pms/product-purchase-orders` / ClipboardList | 部分进入 |
| 2.2 | 商品采购 | 备货列表 | https://manage.higood.ai/pms/reorder/index | `/pms/reorder` / PackageOpen | 部分进入 |
| 2.3 | 商品采购 | 商品采购售后 | https://manage.higood.ai/pms/product_purchase_order_aftersales/index | `/pms/product-purchase-order-aftersales` / LifeBuoy | 部分进入 |
| 3.1 | 面辅料采购 | 面辅料需求分析 | https://manage.higood.ai/pms/material_purchase_demand/index | `/pms/material-requirements` / Puzzle | 部分进入 |
| 3.2 | 面辅料采购 | 面辅料采购单 | https://manage.higood.ai/pms/material_purchase_order/index | `/pms/material-purchase-orders` / PackageSearch | 尚未进入 |
| 3.3 | 面辅料采购 | 面辅料采购跟踪 | https://manage.higood.ai/pms/material_purchase_track/index | `/pms/material-purchase-tracking` / Truck | 尚未进入 |
| 3.4 | 面辅料采购 | 面辅料采购时效 | https://manage.higood.ai/pms/fitting_timeliness/index | `/pms/fitting-timeliness` / Hourglass | 尚未进入 |
| 4.1 | 面辅料供应商确认 | 面辅料供应商确认单 | https://manage.higood.ai/pms/material_supplier_confirm/index | `/pms/material-supplier-confirmations` / ClipboardCheck | 尚未进入 |
| 5.1 | 头程物流 | 头程物流 | https://manage.higood.ai/pms/head_logistics/index | `/pms/first-leg-shipments` / Ship | 尚未进入 |
| 6.1 | 库存查询 | 原料仓库存查询 | https://manage.higood.ai/pms/material_inquiry/index | `/pms/material-inventory` / Radar | 尚未进入 |
| 7.1 | 采购对账 | 面辅料采购请款 | https://manage.higood.ai/pms/material_payment_request/index | `/pms/material-payment-requests` / Banknote | 尚未进入 |
| 7.2 | 采购对账 | 物流费用请款 | https://manage.higood.ai/pms/logistics_payment_request/index | `/pms/logistics-payment-requests` / Wallet | 尚未进入 |
| 8.1 | KOL样衣申请 | KOL库存 | https://manage.higood.ai/pms/kol_sample_stock/index | `/pms/kol-sample-stock` / Package | 尚未进入 |
| 8.2 | KOL样衣申请 | 手动寄样申请 | https://manage.higood.ai/pms/kol_sample_apply/index | `/pms/kol-sample-apply` / ClipboardList | 尚未进入 |
| 8.3 | KOL样衣申请 | 对外样品池链接 | https://manage.higood.ai/pms/kol_sample_link/index | `/pms/kol-sample-link` / Link | 尚未进入 |
| 8.4 | KOL样衣申请 | 锁定操作记录 | https://manage.higood.ai/pms/kol_sample_stock/lock_log | `/pms/kol-sample-stock/lock-log` / History | 尚未进入 |
| 9.1 | 基础资料 | 商品供应商管理 | https://manage.higood.ai/pms/supplier_manage/index | `/pms/suppliers` / Building2 | 尚未进入 |
| 9.2 | 基础资料 | 供应商供货档案 | https://manage.higood.ai/pms/supplier_supply_archive/index | `/pms/supplier-supply-archives` / Handshake | 尚未进入 |
| 9.3 | 基础资料 | 头程物流商管理 | https://manage.higood.ai/pms/first_leg_logistics_provider/index | `/pms/first-leg-carriers` / Building2 | 尚未进入 |
| 9.4 | 基础资料 | 面辅料列表 | https://manage.higood.ai/pms/material_manage/index | `/pms/material-archives` / Layers | 尚未进入 |
| 9.5 | 基础资料 | 成衣列表 | https://manage.higood.ai/pms/garment_manage/index | `/pms/garment-skus` / Shirt | 尚未进入 |
| 9.6 | 基础资料 | 样衣列表 | https://manage.higood.ai/pms/sample_manage/index | `/pms/sample-skus` / Scissors | 尚未进入 |
| 9.7 | 基础资料 | 仓库管理 | https://manage.higood.ai/pms/warehouse_manage/index | `/pms/warehouses` / Warehouse | 尚未进入 |
| 9.8 | 基础资料 | 单位管理 | https://manage.higood.ai/pms/unit_manage/index | `/pms/units` / Ruler | 尚未进入 |
| 9.9 | 基础资料 | BOM/样板管理 | https://manage.higood.ai/admin/bom_manage/index | `/pms/bom-templates` / Boxes | 尚未进入 |

菜单证据：[001-suggestion-sku-expanded.txt](/tmp/higoods-pms-online-20261013/001-suggestion-sku-expanded.txt)。线上DOM每项均有``图标标记；原型所有组/叶子均有icon配置，但组顺序不同。

## 页面统计

| 页面 | 条目 | 状态计数 | 实施 |
|---|---:|---|---|
| 商品采购建议 | 8 | opened=3；query_result=1；blocked_by_client=2；page_result=1；observed_only=1 | 未开始 |
| KOL采购需求 | 14 | opened=5；empty_selection_guard=4；observed_only=5 | 未开始 |
| 商品采购单 | 50 | opened=30；online_placeholder=6；empty_selection_guard=8；observed_only=5；query_result=1 | 未开始 |
| 备货列表 | 10 | opened=6；observed_only=4 | 未开始 |
| 商品采购售后 | 15 | opened=7；empty_selection_guard=3；observed_only=5 | 未开始 |
| 面辅料需求分析 | 33 | opened=5；opened_native_screenshot=1；observed_only=27 | 未开始 |

`observed_only`仅证明按钮可见；`empty_selection_guard`仅证明空选择门禁；`opened`证明已开表单/详情；`online_placeholder`为线上待对接；`blocked_by_client`为真实下载失败。关闭/取消没有独立证据时只写未独立取证，不断言实际没有点击。

## 商品采购建议

线上：https://manage.higood.ai/pms/product_suggest_purchase/index；原型：`/pms/purchase-suggestions`。

查询字段：检索字段（Spu）；SPU / SKU / 商品名称；类型；采购建议数量最小/最大；首翻单；是否需要做货。

统计：SPU数；SKU数；COD与非COD已支付件数；总KOL申请；总采购中；总实时库存；总采购建议数量。

列表列：商品图片；SPU / 款号；商品名称；SKU数量；COD与非COD 已支付件数；SPU 待发货数量；SPU KOL 申请数量；SPU 实时库存总数；采购中数量；SPU 采购建议数量；更新时间；操作；采购下单中 数量；采购头程 运输中数量；SKU；颜色；尺码；待发货 数量；KOL申请 数量；实时库存 数量；SKU 采购建议数量。

| 编号 | 功能按钮 | 点击状态 / 结果 | 原型映射 | 写入边界 |
|---|---|---|---|---|
| PMS-SUG-001 | 查看SKU / 收起SKU | opened；ASY25001 的99个SKU已在行下展开 | partial；原型为查看明细抽屉，未展示线上全部指标；收起动作无单独回读证据 | not_applicable_read_only |
| PMS-SUG-002 | 生成商品采购单 | opened；异步加载后打开生成表单；提交前必须选择爆款或热销；切换仅刷新本次采购数量，折后建议数量不变 | partial；原型有转单表单，但缺线上采购类型切换、区域售价、采购地址、加急/首单、试卖店铺等字段与规则 | not_submitted |
| PMS-SUG-003 | 设置不需要做货 | opened；确认弹窗：确认将该SPU设置为不需要做货？ | missing；现有原型无该操作 | not_submitted |
| PMS-SUG-004 | 查询 | query_result；ASY25001关键词查询返回1条，统计及总数随查询变化 | partial；原型筛选只有关键词/建议状态/采购类型，与线上不同 | not_applicable_read_only |
| PMS-SUG-005 | 导出sku商品 | blocked_by_client；URL is_export=1，Chrome ERR_BLOCKED_BY_CLIENT；未获得导出文件 | partial；原型只有统一CSV导出，缺SPU/SKU两种结果粒度 | not_applicable_read_only |
| PMS-SUG-006 | 导出Spu商品 | blocked_by_client；URL is_export=2，Chrome ERR_BLOCKED_BY_CLIENT；未获得导出文件 | partial；同上 | not_applicable_read_only |
| PMS-SUG-007 | 第2页 / 下一页 | page_result；第2页已显示，当前每页20条 | same_kind_exists；Mock需按用户要求提供两页 | not_applicable_read_only |
| PMS-SUG-008 | 清除 / 每页条数 / 页码跳转确定 | observed_only；按钮/控件存在，但本集合无单独点击回读 | same_kind_exists；需要单独核查线上重置与分页参数 | not_executed_observed_only |

### PMS-SUG-001 查看SKU / 收起SKU

字段：商品图片；SKU；商品名称；颜色；尺码；COD与非COD已支付件数；待发货数量；KOL申请数量；实时库存数量；采购下单中数量；采购头程运输中数量；SKU采购建议数量。

子动作：收起SKU（visible_no_independent_click_evidence）。

待补：收起动作回读；图片大图行为。

证据：[001-suggestion-sku-expanded.txt](/tmp/higoods-pms-online-20261013/001-suggestion-sku-expanded.txt)。

### PMS-SUG-002 生成商品采购单

字段：商品信息（SPU/名称/选品人/参考成本价/SKU数/折后建议总数）；供应商；采购地址；区域ID/CN；区域售价；采购专员；预计到货日期；是否加急；是否首单；采购类型（爆款70%/热销60%）；SKU选择/全选；本次采购数量；价格；金额；建议试卖店铺。

子动作：爆款 (70%)（visible_no_independent_click_evidence）；热销 (60%)（visible_no_independent_click_evidence）；重置（visible_no_independent_click_evidence）；取消（visible_no_independent_click_evidence）；确认生成商品采购单（visible_final_not_submitted）。

待补：爆款/热销/重置子动作未有单独点击证据；实际供应商选择/试卖店铺规则；最终生成未提交。

证据：[002-suggestion-generate-order.txt](/tmp/higoods-pms-online-20261013/002-suggestion-generate-order.txt)、[003-suggestion-generate-ready.txt](/tmp/higoods-pms-online-20261013/003-suggestion-generate-ready.txt)、[003-suggestion-generate-ready.json](/tmp/higoods-pms-online-20261013/003-suggestion-generate-ready.json)。

### PMS-SUG-003 设置不需要做货

字段：无已开表单/未获字段。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：设置后状态/建议量影响；恢复为需要做货的入口；最终确定未提交。

证据：[004-suggestion-no-production-confirm.txt](/tmp/higoods-pms-online-20261013/004-suggestion-no-production-confirm.txt)、[004-suggestion-no-production-confirm.json](/tmp/higoods-pms-online-20261013/004-suggestion-no-production-confirm.json)。

### PMS-SUG-004 查询

字段：检索字段（Spu）；SPU / SKU / 商品名称；类型；采购建议数量最小/最大；首翻单；是否需要做货。

子动作：无。

待补：其他筛选组合与边界。

证据：[004-suggestion-query.txt](/tmp/higoods-pms-online-20261013/004-suggestion-query.txt)、[004-suggestion-query.json](/tmp/higoods-pms-online-20261013/004-suggestion-query.json)。

### PMS-SUG-005 导出sku商品

字段：无已开表单/未获字段。

子动作：无。

待补：文件列/格式/筛选全量范围未获证据。

证据：[005-suggestion-sku-export-blocked.txt](/tmp/higoods-pms-online-20261013/005-suggestion-sku-export-blocked.txt)、[005-suggestion-sku-export-blocked.json](/tmp/higoods-pms-online-20261013/005-suggestion-sku-export-blocked.json)。

### PMS-SUG-006 导出Spu商品

字段：无已开表单/未获字段。

子动作：无。

待补：文件列/格式/筛选全量范围未获证据。

证据：[006-suggestion-spu-export.txt](/tmp/higoods-pms-online-20261013/006-suggestion-spu-export.txt)、[006-suggestion-spu-export.json](/tmp/higoods-pms-online-20261013/006-suggestion-spu-export.json)。

### PMS-SUG-007 第2页 / 下一页

字段：无已开表单/未获字段。

子动作：无。

待补：每页条数切换；页码跳转确定；上一页点击。

证据：[007-suggestion-page-two.txt](/tmp/higoods-pms-online-20261013/007-suggestion-page-two.txt)、[007-suggestion-page-two.json](/tmp/higoods-pms-online-20261013/007-suggestion-page-two.json)。

### PMS-SUG-008 清除 / 每页条数 / 页码跳转确定

字段：无已开表单/未获字段。

子动作：无。

待补：待实际点击。

证据：[004-suggestion-query.txt](/tmp/higoods-pms-online-20261013/004-suggestion-query.txt)、[004-suggestion-query.json](/tmp/higoods-pms-online-20261013/004-suggestion-query.json)、[007-suggestion-page-two.txt](/tmp/higoods-pms-online-20261013/007-suggestion-page-two.txt)、[007-suggestion-page-two.json](/tmp/higoods-pms-online-20261013/007-suggestion-page-two.json)。

## KOL采购需求

线上：https://manage.higood.ai/pms/kol_purchase_demand/index；原型：`/pms/kol-demands`。

查询字段：检索字段/关键词；模式；状态（多选）；店铺（多选）；商品定位（多选）；申请时间起/止；入库时间起/止。

统计：需求单数；KOL申请数量；已入库数量；待入库数量；涉及SPU数；涉及SKU数；可驳回数量。

列表列：KOL申请信息；KOL关联商品信息；KOL申请数量；KOL入库数量；入库差；状态；实际可用次数；KOL入库次数；最后一次实际可用；是否可继续驳回；操作。

| 编号 | 功能按钮 | 点击状态 / 结果 | 原型映射 | 写入边界 |
|---|---|---|---|---|
| PMS-KOL-001 | 新增KOL采购需求 | opened；已打开新增表单；空SPU点击搜索提示请输入SPU | missing；原型KOL需求页没有新增/草稿/提交申请入口 | not_submitted |
| PMS-KOL-002 | 查看 | opened；打开 KOL-202610130005 详情，模式仓库调货、状态待入库 | same_kind_exists；需补齐线上模式及全部详情字段 | not_applicable_read_only |
| PMS-KOL-003 | 确认入库 | opened；已打开入库表单，没有点击最终确定 | partial；原型入库操作与线上SKU表单范围需对齐 | not_submitted |
| PMS-KOL-004 | 驳回 | opened；打开原因输入确认框 | partial；原型已有驳回但原因要求需核对有效业务规则 | not_submitted |
| PMS-KOL-005 | 备注 | opened；打开备注iframe表单 | same_kind_exists； | not_submitted |
| PMS-KOL-006 | 批量审核通过 | empty_selection_guard；请勾选待审核的数据 | missing； | not_submitted |
| PMS-KOL-007 | 批量确认入库 | empty_selection_guard；请勾选可确认入库的数据 | same_kind_exists； | not_submitted |
| PMS-KOL-008 | 批量驳回 | empty_selection_guard；请勾选可驳回的数据 | same_kind_exists； | not_submitted |
| PMS-KOL-009 | 批量备注 | empty_selection_guard；请勾选需要备注的数据 | missing； | not_submitted |
| PMS-KOL-010 | 导出需求 | observed_only；只在初始列表可见，未有单独点击证据 | partial；原型存在同类基础能力，线上具体筛选/两种导出粒度需补齐 | not_executed_observed_only |
| PMS-KOL-011 | 导出明细 | observed_only；只在初始列表可见，未有单独点击证据 | partial；原型存在同类基础能力，线上具体筛选/两种导出粒度需补齐 | not_executed_observed_only |
| PMS-KOL-012 | 查询 / 默认 | observed_only；只在初始列表可见，未有单独点击证据 | partial；原型存在同类基础能力，线上具体筛选/两种导出粒度需补齐 | not_executed_observed_only |
| PMS-KOL-013 | 状态/店铺/商品定位多选 | observed_only；只在初始列表可见，未有单独点击证据 | partial；原型存在同类基础能力，线上具体筛选/两种导出粒度需补齐 | not_executed_observed_only |
| PMS-KOL-014 | 分页 / 每页条数 / 页码跳转 | observed_only；只在初始列表可见，未有单独点击证据 | partial；原型存在同类基础能力，线上具体筛选/两种导出粒度需补齐 | not_executed_observed_only |

### PMS-KOL-001 新增KOL采购需求

字段：申请人（必填）；店铺（必填）；是否可售爆款；申请时间（必填）；SPU搜索；SKU明细/选择/申请数量；申请说明。

子动作：搜索（clicked_validation_blocked）；取消（visible_no_independent_click_evidence）；保存草稿（visible_final_not_submitted）；提交申请（visible_final_not_submitted）。

待补：选择SPU后SKU表格字段；最终保存草稿/提交未点击。

证据：[009-kol-demand-new.txt](/tmp/higoods-pms-online-20261013/009-kol-demand-new.txt)、[009-kol-demand-new.json](/tmp/higoods-pms-online-20261013/009-kol-demand-new.json)、[010-kol-demand-new-search-empty.txt](/tmp/higoods-pms-online-20261013/010-kol-demand-new-search-empty.txt)、[010-kol-demand-new-search-empty.json](/tmp/higoods-pms-online-20261013/010-kol-demand-new-search-empty.json)。

### PMS-KOL-002 查看

字段：申请单号/申请人/店铺/是否可售爆款/申请时间/状态/模式/申请总数；SPU/商品名称；SKU图片/名称/颜色/尺码/申请数量/已入库数量/备注；备注说明。

子动作：关闭（visible_no_independent_click_evidence）。

待补：图片大图交互。

证据：[011-kol-demand-view.txt](/tmp/higoods-pms-online-20261013/011-kol-demand-view.txt)、[011-kol-demand-view.json](/tmp/higoods-pms-online-20261013/011-kol-demand-view.json)。

### PMS-KOL-003 确认入库

字段：SPU/申请单号（只读）；SKU选择；图片；SKU编码；KOL预留仓库存；已入库数量；申请数量；本次入库数量。

子动作：确定（visible_final_not_submitted）。

待补：库存/申请量/可重复入库门禁；最终入库未提交。

证据：[012-kol-demand-receive.txt](/tmp/higoods-pms-online-20261013/012-kol-demand-receive.txt)、[012-kol-demand-receive.json](/tmp/higoods-pms-online-20261013/012-kol-demand-receive.json)。

### PMS-KOL-004 驳回

字段：驳回原因（选填）。

子动作：确定（visible_final_not_submitted）；取消（visible_no_independent_click_evidence）。

待补：驳回后影响/恢复规则；最终确定未提交。

证据：[1791875778452-kol-demand-reject.txt](/tmp/higoods-pms-online-20261013/1791875778452-kol-demand-reject.txt)、[1791875778452-kol-demand-reject.json](/tmp/higoods-pms-online-20261013/1791875778452-kol-demand-reject.json)。

### PMS-KOL-005 备注

字段：SPU（只读）；备注。

子动作：确定（visible_final_not_submitted）。

待补：最终确定未提交。

证据：[1791875793768-kol-demand-remark.txt](/tmp/higoods-pms-online-20261013/1791875793768-kol-demand-remark.txt)、[1791875793768-kol-demand-remark.json](/tmp/higoods-pms-online-20261013/1791875793768-kol-demand-remark.json)。

### PMS-KOL-006 批量审核通过

字段：无已开表单/未获字段。

子动作：无。

待补：有选择后的表单与字段未核查；最终批量写入未提交。

证据：[1791875806681-kol-demand-批量审核通过-no-selection.txt](/tmp/higoods-pms-online-20261013/1791875806681-kol-demand-批量审核通过-no-selection.txt)、[1791875806681-kol-demand-批量审核通过-no-selection.json](/tmp/higoods-pms-online-20261013/1791875806681-kol-demand-批量审核通过-no-selection.json)。

### PMS-KOL-007 批量确认入库

字段：无已开表单/未获字段。

子动作：无。

待补：有选择后的表单与字段未核查；最终批量写入未提交。

证据：[1791875807366-kol-demand-批量确认入库-no-selection.txt](/tmp/higoods-pms-online-20261013/1791875807366-kol-demand-批量确认入库-no-selection.txt)、[1791875807366-kol-demand-批量确认入库-no-selection.json](/tmp/higoods-pms-online-20261013/1791875807366-kol-demand-批量确认入库-no-selection.json)。

### PMS-KOL-008 批量驳回

字段：无已开表单/未获字段。

子动作：无。

待补：有选择后的表单与字段未核查；最终批量写入未提交。

证据：[1791875808036-kol-demand-批量驳回-no-selection.txt](/tmp/higoods-pms-online-20261013/1791875808036-kol-demand-批量驳回-no-selection.txt)、[1791875808036-kol-demand-批量驳回-no-selection.json](/tmp/higoods-pms-online-20261013/1791875808036-kol-demand-批量驳回-no-selection.json)。

### PMS-KOL-009 批量备注

字段：无已开表单/未获字段。

子动作：无。

待补：有选择后的表单与字段未核查；最终批量写入未提交。

证据：[1791875808703-kol-demand-批量备注-no-selection.txt](/tmp/higoods-pms-online-20261013/1791875808703-kol-demand-批量备注-no-selection.txt)、[1791875808703-kol-demand-批量备注-no-selection.json](/tmp/higoods-pms-online-20261013/1791875808703-kol-demand-批量备注-no-selection.json)。

### PMS-KOL-010 导出需求

字段：无已开表单/未获字段。

子动作：无。

待补：待实际点击。

证据：[008-kol-demand-list.txt](/tmp/higoods-pms-online-20261013/008-kol-demand-list.txt)、[008-kol-demand-list.json](/tmp/higoods-pms-online-20261013/008-kol-demand-list.json)。

### PMS-KOL-011 导出明细

字段：无已开表单/未获字段。

子动作：无。

待补：待实际点击。

证据：[008-kol-demand-list.txt](/tmp/higoods-pms-online-20261013/008-kol-demand-list.txt)、[008-kol-demand-list.json](/tmp/higoods-pms-online-20261013/008-kol-demand-list.json)。

### PMS-KOL-012 查询 / 默认

字段：无已开表单/未获字段。

子动作：无。

待补：待实际点击。

证据：[008-kol-demand-list.txt](/tmp/higoods-pms-online-20261013/008-kol-demand-list.txt)、[008-kol-demand-list.json](/tmp/higoods-pms-online-20261013/008-kol-demand-list.json)。

### PMS-KOL-013 状态/店铺/商品定位多选

字段：无已开表单/未获字段。

子动作：无。

待补：待实际点击。

证据：[008-kol-demand-list.txt](/tmp/higoods-pms-online-20261013/008-kol-demand-list.txt)、[008-kol-demand-list.json](/tmp/higoods-pms-online-20261013/008-kol-demand-list.json)。

### PMS-KOL-014 分页 / 每页条数 / 页码跳转

字段：无已开表单/未获字段。

子动作：无。

待补：待实际点击。

证据：[008-kol-demand-list.txt](/tmp/higoods-pms-online-20261013/008-kol-demand-list.txt)、[008-kol-demand-list.json](/tmp/higoods-pms-online-20261013/008-kol-demand-list.json)。

## 商品采购单

线上：https://manage.higood.ai/pms/product_purchase_order/index；原型：`/pms/product-purchase-orders`。

查询字段：检索类型（采购单号/SPU/SKU/商品识别码/选品人/采购人/入库人/申请人/物流单号/供应商商品ID/供应商名称/合作商名称/订单号）；检索关键词；颜色；创建时间起/止；商品数量最小/最大；到货时间起/止；入库人；状态；区域；是否转运；是否有转运记录；是否首单；是否超量；最晚到仓时间起/止；采购单类型；供应商类型；是否加急；采购时间起/止；做货区域；发货时间起/止；收件人；售卖类型；是否组合采购单；审核时间起/止；是否有物流信息；快递签收时间起/止；是否插单；已生成辅料；售后状态；完善退货地址时间起/止；退货时间起/止。

统计：计划采购商品数；计划采购商品金额；到货商品数；已出货商品数；等待出货商品数；商品总值；已选数量。

列表列：商品图片；商品信息；供应商信息；采购类型；状态；时间；库存流转；物流信息；备注；采购备注；操作。

| 编号 | 功能按钮 | 点击状态 / 结果 | 原型映射 | 写入边界 |
|---|---|---|---|---|
| PMS-PPO-001 | + 新增 | opened；打开新增表单 | partial；原型已有新建但需补草稿/提交区别、加急/首单、专员等字段 | not_submitted |
| PMS-PPO-002 | + 添加样衣采购 | opened；表单默认样衣，增加收件人 | partial；原型缺快捷样衣入口和收件人契约 | not_submitted |
| PMS-PPO-003 | + 达人寄样采购 | opened；已打开对应快捷采购分支 | partial；原型只有统一新建，快捷分支/类型与字段不全 | not_submitted |
| PMS-PPO-004 | + 做货采购 | opened；已打开对应快捷采购分支 | partial；原型只有统一新建，快捷分支/类型与字段不全 | not_submitted |
| PMS-PPO-005 | + 烫画采购 | opened；已打开对应快捷采购分支 | partial；原型只有统一新建，快捷分支/类型与字段不全 | not_submitted |
| PMS-PPO-006 | + 成衣采购 | opened；已打开对应快捷采购分支 | partial；原型只有统一新建，快捷分支/类型与字段不全 | not_submitted |
| PMS-PPO-007 | 查看详情 | opened；打开采购单360309详情；数量链接同样打开采购详情，晚到样本为做货采购单 | same_kind_exists；原型有详情，全部字段及图片对应需核对 | not_applicable_read_only |
| PMS-PPO-008 | 编辑（售卖类型） | opened；点击行内编辑打开修改售卖类型，而非采购单整体编辑 | missing；原型只有采购单编辑，没有售卖类型专门动作 | not_submitted |
| PMS-PPO-009 | 设置采购员 | opened；等待后打开批量设置采购员表单，单行也复用该表单 | missing； | not_submitted |
| PMS-PPO-010 | 编辑商品采购单 | opened；编辑360309样衣采购单，2个SKU、2件、59.60金额 | partial；原型有编辑，但字段及数量重分配子流程不足 | not_submitted |
| PMS-PPO-011 | 重新分配采购数量 | opened；编辑表单中的数量重分配弹窗已打开 | missing； | not_submitted |
| PMS-PPO-012 | 快递信息 | opened；打开完善快递信息表单 | missing；原型商品采购单无快递信息编辑表单 | not_submitted |
| PMS-PPO-013 | 驳回 / 采购中驳回 | opened；两种状态分支都打开驳回采购表单 | missing； | not_submitted |
| PMS-PPO-014 | 发起售后 | opened；已打开售后发起表单 | missing；原型有独立售后列表，但采购单页无发起售后关联动作/真实附件 | not_submitted |
| PMS-PPO-015 | 采购备注 | opened；已打开备注表单 | partial；原型只有编辑内备注，缺独立行按钮 | not_submitted |
| PMS-PPO-016 | 日志记录 | opened；日志iframe已打开 | partial；原型日志在详情内，缺独立行按钮 | not_applicable_read_only |
| PMS-PPO-017 | 出货记录 | opened；打开标题为库存记录的窗口，当前表格无记录 | missing； | not_applicable_read_only |
| PMS-PPO-018 | 一键下单 / 批量一键下单 | online_placeholder；两条入口均提示店小秘一键下单待对接 | missing； | not_applicable_read_only |
| PMS-PPO-019 | 复制采购单 | opened；确认：确定复制采购单吗 | missing； | not_submitted |
| PMS-PPO-020 | 样衣质检 | opened；已打开样衣质检；配饰和分批入库规则明确显示 | missing； | not_submitted |
| PMS-PPO-021 | 批量审核采购 | empty_selection_guard；请勾选需要审核的数据 | missing； | not_submitted |
| PMS-PPO-022 | 批量驳回 | empty_selection_guard；请勾选需要驳回的数据 | missing； | not_submitted |
| PMS-PPO-023 | 合并采购单 | empty_selection_guard；请至少勾选两条可合并的采购单 | missing； | not_submitted |
| PMS-PPO-024 | 创建组合生产采购单 | online_placeholder；组合生产采购单能力待对接 | missing； | not_applicable_read_only |
| PMS-PPO-025 | 批量设置采购员 | empty_selection_guard；请勾选需要设置的数据 | missing； | not_submitted |
| PMS-PPO-026 | 批量设置合作商 | empty_selection_guard；请勾选需要设置的数据 | missing； | not_submitted |
| PMS-PPO-027 | 批量更改采购类型 | empty_selection_guard；请勾选数据 | missing； | not_submitted |
| PMS-PPO-028 | 运单批量入库 | opened；打开批量入库窗口，初始提示请输入SPU | missing； | not_submitted |
| PMS-PPO-029 | 批量确认模板 | empty_selection_guard；请勾选需要打印的数据 | missing； | not_submitted |
| PMS-PPO-030 | 批量面辅料签收表 | online_placeholder；批量面辅料签收表待对接（请先生成面辅料需求分析） | missing； | not_applicable_read_only |
| PMS-PPO-031 | 批量发起售后 | empty_selection_guard；勾选需要售后的采购单 | missing； | not_submitted |
| PMS-PPO-032 | 打印条码 | opened；打开批量打印货品条码窗口 | missing； | not_applicable_read_only |
| PMS-PPO-033 | 手动出库 | opened；打开采购单159699手动出库表单 | missing； | not_submitted |
| PMS-PPO-034 | 创建工单 | online_placeholder；创建工单待对接 | missing； | not_applicable_read_only |
| PMS-PPO-035 | 拆分采购单 | opened；规则：原单至少保留一条；已有到货/入库/出库记录的明细不能拆分 | missing； | not_submitted |
| PMS-PPO-036 | 面辅料样衣 | online_placeholder；面辅料样衣待对接 | missing； | not_applicable_read_only |
| PMS-PPO-037 | 设置合作商 | opened；等待后打开批量设置合作商表单，样本采购单360288；此前无可观察结果的snapshot仍保留为早期观察 | missing； | not_submitted |
| PMS-PPO-038 | 设置尾部烫包质检合作商 | online_placeholder；另一可用状态样本提示“尾部烫包质检合作商待对接”；早期样本则提示均不可设置合作商 | missing； | not_applicable_read_only |
| PMS-PPO-039 | 开启入库 | opened；确认：确定开启入库吗？ | missing； | not_submitted |
| PMS-PPO-040 | 审核采购 | opened；确认：确定审核通过该采购单吗 | missing； | not_submitted |
| PMS-PPO-041 | 查看面辅料需求 | opened；查看面辅料需求已打开；BOM已匹配，现有多个分析单，显示不允许再次生成 | partial； | not_applicable_read_only |
| PMS-PPO-042 | 终止入库 | opened；确认：终止后采购单关闭，未入库部分不再继续入库 | missing； | not_submitted |
| PMS-PPO-043 | 大货入库 | opened；打开SKU手工入库，样本采购单36304，计划100、已入库0 | missing； | not_submitted |
| PMS-PPO-044 | 面料采购 | observed_only；仅在列表/状态筛选返回的UI中可见；不能认定操作按钮已点击 | missing； | not_executed_observed_only |
| PMS-PPO-045 | 商品链接 | observed_only；仅在列表/状态筛选返回的UI中可见；不能认定操作按钮已点击 | missing； | not_executed_observed_only |
| PMS-PPO-046 | 导出采购单 / 导出商品 | observed_only；仅在列表/状态筛选返回的UI中可见；不能认定操作按钮已点击 | partial； | not_executed_observed_only |
| PMS-PPO-047 | 查询 / 默认 / 多选过滤 | observed_only；仅在列表/状态筛选返回的UI中可见；不能认定操作按钮已点击 | partial； | not_executed_observed_only |
| PMS-PPO-048 | 全选当前页 / 每页条数 / 翻页 / 页码确定 | observed_only；仅在列表/状态筛选返回的UI中可见；不能认定操作按钮已点击 | partial； | not_executed_observed_only |
| PMS-PPO-049 | 生成面辅料需求分析 | opened；BOM已匹配且允许生成，打开生成明细预览；确认后按BOM适用颜色匹配成衣SKU数量、合并相同面辅料SPU并拆成多条需求分析；明确本操作不创建面辅料采购单 | partial；原型已有生成需求，需要核对按BOM适用颜色匹配SKU并按面辅料SPU合并拆单 | not_submitted |
| PMS-PPO-050 | 状态筛选查询（7个分支） | query_result；待审核、采购中、全部入库、部分入库、采购中+部分入库、待发货、待装箱列表已返回；各状态行按钮仅表示可见 | partial；原型状态枚举及对应可用按钮少于线上 | not_applicable_read_only |

### PMS-PPO-001 + 新增

字段：采购类型；采购专员（可留空由列表分配）；预计到货时间；是否加急；是否首单；做货区域（国内/印尼）；供应商（可留空）；采购备注；SPU搜索/商品选择；SKU选择/单价/采购数量；金额与数量汇总。

子动作：搜索（visible_no_independent_click_evidence）；取消（visible_no_independent_click_evidence）；保存草稿（visible_final_not_submitted）；保存并提交（visible_final_not_submitted）。

待补：选款搜索和SKU选择子动作；最后保存均未点击。

证据：[1791875855800-product-order-new.txt](/tmp/higoods-pms-online-20261013/1791875855800-product-order-new.txt)、[1791875855800-product-order-new.json](/tmp/higoods-pms-online-20261013/1791875855800-product-order-new.json)。

### PMS-PPO-002 + 添加样衣采购

字段：采购类型；采购专员（可留空由列表分配）；预计到货时间；是否加急；是否首单；做货区域（国内/印尼）；供应商（可留空）；采购备注；SPU搜索/商品选择；SKU选择/单价/采购数量；金额与数量汇总；收件人（默认朝群）。

子动作：搜索（visible_no_independent_click_evidence）；取消（visible_no_independent_click_evidence）；保存草稿（visible_final_not_submitted）；保存并提交（visible_final_not_submitted）。

待补：最终保存均未点击。

证据：[1791875866246-product-order-new-sample.txt](/tmp/higoods-pms-online-20261013/1791875866246-product-order-new-sample.txt)、[1791875866246-product-order-new-sample.json](/tmp/higoods-pms-online-20261013/1791875866246-product-order-new-sample.json)。

### PMS-PPO-003 + 达人寄样采购

字段：采购类型；采购专员（可留空由列表分配）；预计到货时间；是否加急；是否首单；做货区域（国内/印尼）；供应商（可留空）；采购备注；SPU搜索/商品选择；SKU选择/单价/采购数量；金额与数量汇总；收件人。

子动作：搜索（visible_no_independent_click_evidence）；取消（visible_no_independent_click_evidence）；保存草稿（visible_final_not_submitted）；保存并提交（visible_final_not_submitted）。

待补：预选类型需以原始selected选项核对；最终保存均未点击。

证据：[1791875895283-product-order-+ 达人寄样采购.txt](/tmp/higoods-pms-online-20261013/1791875895283-product-order-+ 达人寄样采购.txt)。

### PMS-PPO-004 + 做货采购

字段：采购类型；采购专员（可留空由列表分配）；预计到货时间；是否加急；是否首单；做货区域（国内/印尼）；供应商（可留空）；采购备注；SPU搜索/商品选择；SKU选择/单价/采购数量；金额与数量汇总；售卖类型（预售/备货/shopee备货/KOL样衣/虾皮样品/基础款/JKT复购/SZ复购/国内做货/预售备货/kol样品小单）。

子动作：搜索（visible_no_independent_click_evidence）；取消（visible_no_independent_click_evidence）；保存草稿（visible_final_not_submitted）；保存并提交（visible_final_not_submitted）。

待补：预选类型需以原始selected选项核对；最终保存均未点击。

证据：[1791875899592-product-order-+ 做货采购.txt](/tmp/higoods-pms-online-20261013/1791875899592-product-order-+ 做货采购.txt)。

### PMS-PPO-005 + 烫画采购

字段：采购类型；采购专员（可留空由列表分配）；预计到货时间；是否加急；是否首单；做货区域（国内/印尼）；供应商（可留空）；采购备注；SPU搜索/商品选择；SKU选择/单价/采购数量；金额与数量汇总；售卖类型（同做货分支）。

子动作：搜索（visible_no_independent_click_evidence）；取消（visible_no_independent_click_evidence）；保存草稿（visible_final_not_submitted）；保存并提交（visible_final_not_submitted）。

待补：预选类型需以原始selected选项核对；最终保存均未点击。

证据：[1791875903873-product-order-+ 烫画采购.txt](/tmp/higoods-pms-online-20261013/1791875903873-product-order-+ 烫画采购.txt)。

### PMS-PPO-006 + 成衣采购

字段：采购类型；采购专员（可留空由列表分配）；预计到货时间；是否加急；是否首单；做货区域（国内/印尼）；供应商（可留空）；采购备注；SPU搜索/商品选择；SKU选择/单价/采购数量；金额与数量汇总。

子动作：搜索（visible_no_independent_click_evidence）；取消（visible_no_independent_click_evidence）；保存草稿（visible_final_not_submitted）；保存并提交（visible_final_not_submitted）。

待补：预选类型需以原始selected选项核对；最终保存均未点击。

证据：[1791875908144-product-order-+ 成衣采购.txt](/tmp/higoods-pms-online-20261013/1791875908144-product-order-+ 成衣采购.txt)。

### PMS-PPO-007 查看详情

字段：图片；采购单号/采购类型/SPU/商品名称/供应商/采购金额；面辅料状态/关联分析单；SKU图片/名称/颜色/尺码/标准采购价/实际采购价/实际采购数量/采购金额/是否需BOM/BOM编号。

子动作：关闭（visible_no_independent_click_evidence）。

待补：图片大图未有点击证据。

证据：[1791875927029-product-order-detail.txt](/tmp/higoods-pms-online-20261013/1791875927029-product-order-detail.txt)、[1791876395116-product-order-quantity.txt](/tmp/higoods-pms-online-20261013/1791876395116-product-order-quantity.txt)。

### PMS-PPO-008 编辑（售卖类型）

字段：采购单/SPU/原售卖类型（只读）；售卖类型单选（11项，同做货分支）。

子动作：关闭（visible_no_independent_click_evidence）；确定（visible_final_not_submitted）。

待补：可变更状态范围；最终确定未提交。

证据：[1791875936576-product-order-edit.txt](/tmp/higoods-pms-online-20261013/1791875936576-product-order-edit.txt)。

### PMS-PPO-009 设置采购员

字段：采购单/SPU（只读）；人员单选列表。

子动作：取消（visible_no_independent_click_evidence）；确定（visible_final_not_submitted）。

待补：最终确定未提交。

证据：[1791875943542-product-order-set-buyer.txt](/tmp/higoods-pms-online-20261013/1791875943542-product-order-set-buyer.txt)、[1791875964295-product-order-set-buyer-ready.txt](/tmp/higoods-pms-online-20261013/1791875964295-product-order-set-buyer-ready.txt)。

### PMS-PPO-010 编辑商品采购单

字段：采购类型；采购专员（可留空由列表分配）；预计到货时间；是否加急；是否首单；做货区域（国内/印尼）；供应商（可留空）；采购备注；SPU搜索/商品选择；SKU选择/单价/采购数量；金额与数量汇总；收件人；SKU颜色/尺码/单价/数量；重新分配采购数量。

子动作：搜索（visible_no_independent_click_evidence）；取消（visible_no_independent_click_evidence）；保存草稿（visible_final_not_submitted）；保存并提交（visible_final_not_submitted）；重新分配采购数量（visible_no_independent_click_evidence）。

待补：最后保存均未提交。

证据：[1791875984951-product-order-edit-order.txt](/tmp/higoods-pms-online-20261013/1791875984951-product-order-edit-order.txt)。

### PMS-PPO-011 重新分配采购数量

字段：颜色单选；总采购数量。

子动作：确定（visible_no_independent_click_evidence）；取消（visible_no_independent_click_evidence）。

待补：分配公式/尺码配比；确定子动作可能修改未保存表单，当前未点击。

证据：[1791875992272-product-order-redistribute.txt](/tmp/higoods-pms-online-20261013/1791875992272-product-order-redistribute.txt)。

### PMS-PPO-012 快递信息

字段：采购单（只读）；快递公司；物流单号；发货时间；备注。

子动作：取消（visible_no_independent_click_evidence）；保存（visible_final_not_submitted）。

待补：最后保存未提交。

证据：[1791875996526-product-order-express.txt](/tmp/higoods-pms-online-20261013/1791875996526-product-order-express.txt)。

### PMS-PPO-013 驳回 / 采购中驳回

字段：采购单（只读）；拒绝理由。

子动作：取消（visible_no_independent_click_evidence）；确认拒绝（visible_final_not_submitted）。

待补：采购中驳回的库存/在途责任处理；最后拒绝未提交。

证据：[1791876012400-product-order-reject.txt](/tmp/higoods-pms-online-20261013/1791876012400-product-order-reject.txt)、[1791876075035-product-order-in-purchase-reject.txt](/tmp/higoods-pms-online-20261013/1791876075035-product-order-in-purchase-reject.txt)。

### PMS-PPO-014 发起售后

字段：商品信息/SPU/选品人/成本价/采购单/类型/数量（只读）；理由描述；上传图片（最多10个jpg/jpeg/png）。

子动作：重置（visible_no_independent_click_evidence）；添加（visible_final_not_submitted）。

待补：文件未上传；重置未单独核查；最后添加未提交。

证据：[1791876026318-product-order-after-sales.txt](/tmp/higoods-pms-online-20261013/1791876026318-product-order-after-sales.txt)。

### PMS-PPO-015 采购备注

字段：采购单（只读）；采购备注。

子动作：取消（visible_no_independent_click_evidence）；保存（visible_final_not_submitted）。

待补：最后保存未提交。

证据：[1791876041627-product-order-采购备注.txt](/tmp/higoods-pms-online-20261013/1791876041627-product-order-采购备注.txt)。

### PMS-PPO-016 日志记录

字段：日志表格（创建SKU数量/采购类型/目标仓库/区域/加急/首单/提交状态等记录）。

子动作：无。

待补：当前无额外待补。

证据：[1791876045887-product-order-日志记录.txt](/tmp/higoods-pms-online-20261013/1791876045887-product-order-日志记录.txt)。

### PMS-PPO-017 出货记录

字段：采购单/SPU（只读）；库存记录表格。

子动作：无。

待补：有记录样本与列定义。

证据：[1791876050106-product-order-出货记录.txt](/tmp/higoods-pms-online-20261013/1791876050106-product-order-出货记录.txt)。

### PMS-PPO-018 一键下单 / 批量一键下单

字段：无已开表单/未获字段。

子动作：无。

待补：这不是已实现的线上采购功能；是否原型应保留提示须确定。

证据：[1791876051544-product-order-one-click-order.txt](/tmp/higoods-pms-online-20261013/1791876051544-product-order-one-click-order.txt)、[1791876145325-product-order-批量一键下单-empty.txt](/tmp/higoods-pms-online-20261013/1791876145325-product-order-批量一键下单-empty.txt)。

### PMS-PPO-019 复制采购单

字段：无已开表单/未获字段。

子动作：确定（visible_final_not_submitted）；取消（visible_no_independent_click_evidence）。

待补：复制内容/新单初始状态/附件引用；最后确定未提交。

证据：[1791876063618-product-order-copy.txt](/tmp/higoods-pms-online-20261013/1791876063618-product-order-copy.txt)。

### PMS-PPO-020 样衣质检

字段：采购单/SPU（只读）；样衣审核（质检通过/审核驳回并售后）；配饰（10项，通过必须勾选1种）；样品重量kg；SKU本次入库数量（未到货0，可再次质检）；上传图片（最多10个jpg/jpeg/png）。

子动作：关闭（visible_no_independent_click_evidence）；确定（visible_final_not_submitted）。

待补：审核失败需图片/理由等门禁；文件未上传；最后确定未提交。

证据：[1791876079390-product-order-sample-qc.txt](/tmp/higoods-pms-online-20261013/1791876079390-product-order-sample-qc.txt)。

### PMS-PPO-021 批量审核采购

字段：无已开表单/未获字段。

子动作：无。

待补：有符合条件的选择后表单尚未核查；最终批量写入未提交。

证据：[1791876140077-product-order-批量审核采购-empty.txt](/tmp/higoods-pms-online-20261013/1791876140077-product-order-批量审核采购-empty.txt)。

### PMS-PPO-022 批量驳回

字段：无已开表单/未获字段。

子动作：无。

待补：有符合条件的选择后表单尚未核查；最终批量写入未提交。

证据：[1791876140767-product-order-批量驳回-empty.txt](/tmp/higoods-pms-online-20261013/1791876140767-product-order-批量驳回-empty.txt)。

### PMS-PPO-023 合并采购单

字段：无已开表单/未获字段。

子动作：无。

待补：有符合条件的选择后表单尚未核查；最终批量写入未提交。

证据：[1791876141557-product-order-合并采购单-empty.txt](/tmp/higoods-pms-online-20261013/1791876141557-product-order-合并采购单-empty.txt)。

### PMS-PPO-024 创建组合生产采购单

字段：无已开表单/未获字段。

子动作：无。

待补：线上尚为占位，目标行为需要明确。

证据：[1791876142293-product-order-创建组合生产采购单-empty.txt](/tmp/higoods-pms-online-20261013/1791876142293-product-order-创建组合生产采购单-empty.txt)。

### PMS-PPO-025 批量设置采购员

字段：无已开表单/未获字段。

子动作：无。

待补：有符合条件的选择后表单尚未核查；最终批量写入未提交。

证据：[1791876143052-product-order-批量设置采购员-empty.txt](/tmp/higoods-pms-online-20261013/1791876143052-product-order-批量设置采购员-empty.txt)。

### PMS-PPO-026 批量设置合作商

字段：无已开表单/未获字段。

子动作：无。

待补：有符合条件的选择后表单尚未核查；最终批量写入未提交。

证据：[1791876143806-product-order-批量设置合作商-empty.txt](/tmp/higoods-pms-online-20261013/1791876143806-product-order-批量设置合作商-empty.txt)。

### PMS-PPO-027 批量更改采购类型

字段：无已开表单/未获字段。

子动作：无。

待补：有符合条件的选择后表单尚未核查；最终批量写入未提交。

证据：[1791876144579-product-order-批量更改采购类型-empty.txt](/tmp/higoods-pms-online-20261013/1791876144579-product-order-批量更改采购类型-empty.txt)。

### PMS-PPO-028 运单批量入库

字段：SKU/马帮编码/SPU输入（按回车查询）。

子动作：无。

待补：有值查询后表格/门禁/提交动作；最终入库未提交。

证据：[1791876148871-product-order-运单批量入库-empty.txt](/tmp/higoods-pms-online-20261013/1791876148871-product-order-运单批量入库-empty.txt)。

### PMS-PPO-029 批量确认模板

字段：无已开表单/未获字段。

子动作：无。

待补：有符合条件的选择后表单尚未核查；最终批量写入未提交。

证据：[1791876150300-product-order-批量确认模板-empty.txt](/tmp/higoods-pms-online-20261013/1791876150300-product-order-批量确认模板-empty.txt)。

### PMS-PPO-030 批量面辅料签收表

字段：无已开表单/未获字段。

子动作：无。

待补：线上尚为占位，目标行为需要明确。

证据：[1791876151044-product-order-批量面辅料签收表-empty.txt](/tmp/higoods-pms-online-20261013/1791876151044-product-order-批量面辅料签收表-empty.txt)。

### PMS-PPO-031 批量发起售后

字段：无已开表单/未获字段。

子动作：无。

待补：有符合条件的选择后表单尚未核查；最终批量写入未提交。

证据：[1791876152040-product-order-批量发起售后-empty.txt](/tmp/higoods-pms-online-20261013/1791876152040-product-order-批量发起售后-empty.txt)。

### PMS-PPO-032 打印条码

字段：SKU选择；SKU编码/出货条码/采购价格/采购数量/已到货数/区域/区域采购数量/区域到货数量；本次入库数量输入。

子动作：打印条码（visible_no_independent_click_evidence）；打印（visible_no_independent_click_evidence）；重置（visible_no_independent_click_evidence）。

待补：行打印/整体打印/重置未单独点击；实际电子/纸面输出未核查。

证据：[1791876177452-product-order-print-barcode.txt](/tmp/higoods-pms-online-20261013/1791876177452-product-order-print-barcode.txt)。

### PMS-PPO-033 手动出库

字段：采购单/SPU（只读）；SKU行本次出库数量。

子动作：取消（visible_no_independent_click_evidence）；确认出库（visible_final_not_submitted）。

待补：库存/单位/合法上限及去向；最后确认出库未提交。

证据：[1791876245629-product-order-手动出库.txt](/tmp/higoods-pms-online-20261013/1791876245629-product-order-手动出库.txt)。

### PMS-PPO-034 创建工单

字段：无已开表单/未获字段。

子动作：无。

待补：线上尚为占位，目标行为需要明确。

证据：[1791876247029-product-order-创建工单.txt](/tmp/higoods-pms-online-20261013/1791876247029-product-order-创建工单.txt)。

### PMS-PPO-035 拆分采购单

字段：原采购单/SPU/类型/状态（只读）；SKU选择/颜色/尺码/区域/采购数量/单价。

子动作：取消（visible_no_independent_click_evidence）；确认拆分（visible_final_not_submitted）。

待补：符合条件明细选择后目标单规则；最后确认拆分未提交。

证据：[1791876250602-product-order-拆分采购单.txt](/tmp/higoods-pms-online-20261013/1791876250602-product-order-拆分采购单.txt)。

### PMS-PPO-036 面辅料样衣

字段：无已开表单/未获字段。

子动作：无。

待补：线上尚为占位，目标行为需要明确。

证据：[1791876252065-product-order-面辅料样衣.txt](/tmp/higoods-pms-online-20261013/1791876252065-product-order-面辅料样衣.txt)。

### PMS-PPO-037 设置合作商

字段：采购单/SPU（只读）；合作商单选列表。

子动作：取消（visible_no_independent_click_evidence）；确定（visible_final_not_submitted）。

待补：候选合作商资格和关联生产事实；最终确定未提交。

证据：[1791876264659-product-order-设置合作商.txt](/tmp/higoods-pms-online-20261013/1791876264659-product-order-设置合作商.txt)、[1791876397941-product-order-partner-ready.txt](/tmp/higoods-pms-online-20261013/1791876397941-product-order-partner-ready.txt)、[1791876408509-product-order-partner-form.txt](/tmp/higoods-pms-online-20261013/1791876408509-product-order-partner-form.txt)。

### PMS-PPO-038 设置尾部烫包质检合作商

字段：无已开表单/未获字段。

子动作：无。

待补：线上仍为待对接提示；不得宣称合作商设置能力已实现。

证据：[1791876265445-product-order-设置尾部烫包质检合作商.txt](/tmp/higoods-pms-online-20261013/1791876265445-product-order-设置尾部烫包质检合作商.txt)、[1791876418623-product-order-finishing-partner.txt](/tmp/higoods-pms-online-20261013/1791876418623-product-order-finishing-partner.txt)。

### PMS-PPO-039 开启入库

字段：无已开表单/未获字段。

子动作：确定（visible_final_not_submitted）；取消（visible_no_independent_click_evidence）。

待补：状态前置/重开后的数量及库存处理；最后确定未提交。

证据：[1791876266235-product-order-开启入库.txt](/tmp/higoods-pms-online-20261013/1791876266235-product-order-开启入库.txt)。

### PMS-PPO-040 审核采购

字段：无已开表单/未获字段。

子动作：确定（visible_final_not_submitted）；取消（visible_no_independent_click_evidence）。

待补：审核后的状态/权限/数量规则；最终确定未提交。

证据：[1791875832626-product-order-list.txt](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.txt)、[1791875832626-product-order-list.json](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.json)、[1791876202468-product-order-status-6.txt](/tmp/higoods-pms-online-20261013/1791876202468-product-order-status-6.txt)、[1791876203981-product-order-status-3.txt](/tmp/higoods-pms-online-20261013/1791876203981-product-order-status-3.txt)、[1791876205625-product-order-status-4.txt](/tmp/higoods-pms-online-20261013/1791876205625-product-order-status-4.txt)、[1791876207276-product-order-status-5.txt](/tmp/higoods-pms-online-20261013/1791876207276-product-order-status-5.txt)、[1791876208739-product-order-status-11.txt](/tmp/higoods-pms-online-20261013/1791876208739-product-order-status-11.txt)、[1791876210046-product-order-status-12.txt](/tmp/higoods-pms-online-20261013/1791876210046-product-order-status-12.txt)、[1791876211742-product-order-status-13.txt](/tmp/higoods-pms-online-20261013/1791876211742-product-order-status-13.txt)、[1791876373690-product-order-review.txt](/tmp/higoods-pms-online-20261013/1791876373690-product-order-review.txt)。

### PMS-PPO-041 查看面辅料需求

字段：来源商品采购单号/类型/SPU/商品名称/SKU数/采购总量/供应商/目标仓库/预计到货时间；SKU颜色/尺码/采购数量/BOM编号；BOM匹配状态/物料种类/是否允许生成；分析单号/需求总数/库存总数/建议采购总数；物料编码/名称/分类/使用部位/来源SKU/BOM需求/库存/采购中/建议采购/单位/建议供应商。

子动作：关闭（visible_no_independent_click_evidence）。

待补：存在分析单时禁重复生成；需求总数与口径需后续对齐。

证据：[1791875832626-product-order-list.txt](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.txt)、[1791875832626-product-order-list.json](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.json)、[1791876202468-product-order-status-6.txt](/tmp/higoods-pms-online-20261013/1791876202468-product-order-status-6.txt)、[1791876203981-product-order-status-3.txt](/tmp/higoods-pms-online-20261013/1791876203981-product-order-status-3.txt)、[1791876205625-product-order-status-4.txt](/tmp/higoods-pms-online-20261013/1791876205625-product-order-status-4.txt)、[1791876207276-product-order-status-5.txt](/tmp/higoods-pms-online-20261013/1791876207276-product-order-status-5.txt)、[1791876208739-product-order-status-11.txt](/tmp/higoods-pms-online-20261013/1791876208739-product-order-status-11.txt)、[1791876210046-product-order-status-12.txt](/tmp/higoods-pms-online-20261013/1791876210046-product-order-status-12.txt)、[1791876211742-product-order-status-13.txt](/tmp/higoods-pms-online-20261013/1791876211742-product-order-status-13.txt)、[1791876422237-product-order-material-demand.txt](/tmp/higoods-pms-online-20261013/1791876422237-product-order-material-demand.txt)、[1791876428498-product-order-material-demand-detail.txt](/tmp/higoods-pms-online-20261013/1791876428498-product-order-material-demand-detail.txt)。

### PMS-PPO-042 终止入库

字段：无已开表单/未获字段。

子动作：确定（visible_final_not_submitted）；取消（visible_no_independent_click_evidence）。

待补：关闭后的采购在途/库存/财务处理；最终确定未提交。

证据：[1791875832626-product-order-list.txt](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.txt)、[1791875832626-product-order-list.json](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.json)、[1791876202468-product-order-status-6.txt](/tmp/higoods-pms-online-20261013/1791876202468-product-order-status-6.txt)、[1791876203981-product-order-status-3.txt](/tmp/higoods-pms-online-20261013/1791876203981-product-order-status-3.txt)、[1791876205625-product-order-status-4.txt](/tmp/higoods-pms-online-20261013/1791876205625-product-order-status-4.txt)、[1791876207276-product-order-status-5.txt](/tmp/higoods-pms-online-20261013/1791876207276-product-order-status-5.txt)、[1791876208739-product-order-status-11.txt](/tmp/higoods-pms-online-20261013/1791876208739-product-order-status-11.txt)、[1791876210046-product-order-status-12.txt](/tmp/higoods-pms-online-20261013/1791876210046-product-order-status-12.txt)、[1791876211742-product-order-status-13.txt](/tmp/higoods-pms-online-20261013/1791876211742-product-order-status-13.txt)、[1791876371127-product-order-stop-inbound.txt](/tmp/higoods-pms-online-20261013/1791876371127-product-order-stop-inbound.txt)。

### PMS-PPO-043 大货入库

字段：采购单/SPU/商品/状态/计划/已入库（只读）；SKU图片/编码/条码/颜色/尺码/区域/计划/已入库/待入库；SKU本次入库数量。

子动作：取消（visible_no_independent_click_evidence）；确定入库（visible_final_not_submitted）。

待补：待入库合法上限/库存目标；最终确定入库未提交。

证据：[1791875832626-product-order-list.txt](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.txt)、[1791875832626-product-order-list.json](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.json)、[1791876202468-product-order-status-6.txt](/tmp/higoods-pms-online-20261013/1791876202468-product-order-status-6.txt)、[1791876203981-product-order-status-3.txt](/tmp/higoods-pms-online-20261013/1791876203981-product-order-status-3.txt)、[1791876205625-product-order-status-4.txt](/tmp/higoods-pms-online-20261013/1791876205625-product-order-status-4.txt)、[1791876207276-product-order-status-5.txt](/tmp/higoods-pms-online-20261013/1791876207276-product-order-status-5.txt)、[1791876208739-product-order-status-11.txt](/tmp/higoods-pms-online-20261013/1791876208739-product-order-status-11.txt)、[1791876210046-product-order-status-12.txt](/tmp/higoods-pms-online-20261013/1791876210046-product-order-status-12.txt)、[1791876211742-product-order-status-13.txt](/tmp/higoods-pms-online-20261013/1791876211742-product-order-status-13.txt)、[1791876359804-product-order-bulk-inbound.txt](/tmp/higoods-pms-online-20261013/1791876359804-product-order-bulk-inbound.txt)。

### PMS-PPO-044 面料采购

字段：无已开表单/未获字段。

子动作：无。

待补：待安全实际点击/打开；直接写入按钮须停在确认前或明确不执行。

证据：[1791875832626-product-order-list.txt](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.txt)、[1791875832626-product-order-list.json](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.json)、[1791876202468-product-order-status-6.txt](/tmp/higoods-pms-online-20261013/1791876202468-product-order-status-6.txt)、[1791876203981-product-order-status-3.txt](/tmp/higoods-pms-online-20261013/1791876203981-product-order-status-3.txt)、[1791876205625-product-order-status-4.txt](/tmp/higoods-pms-online-20261013/1791876205625-product-order-status-4.txt)、[1791876207276-product-order-status-5.txt](/tmp/higoods-pms-online-20261013/1791876207276-product-order-status-5.txt)、[1791876208739-product-order-status-11.txt](/tmp/higoods-pms-online-20261013/1791876208739-product-order-status-11.txt)、[1791876210046-product-order-status-12.txt](/tmp/higoods-pms-online-20261013/1791876210046-product-order-status-12.txt)、[1791876211742-product-order-status-13.txt](/tmp/higoods-pms-online-20261013/1791876211742-product-order-status-13.txt)。

### PMS-PPO-045 商品链接

字段：无已开表单/未获字段。

子动作：无。

待补：待安全实际点击/打开；直接写入按钮须停在确认前或明确不执行。

证据：[1791875832626-product-order-list.txt](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.txt)、[1791875832626-product-order-list.json](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.json)。

### PMS-PPO-046 导出采购单 / 导出商品

字段：无已开表单/未获字段。

子动作：无。

待补：待安全实际点击/打开；直接写入按钮须停在确认前或明确不执行。

证据：[1791875832626-product-order-list.txt](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.txt)、[1791875832626-product-order-list.json](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.json)。

### PMS-PPO-047 查询 / 默认 / 多选过滤

字段：无已开表单/未获字段。

子动作：无。

待补：待安全实际点击/打开；直接写入按钮须停在确认前或明确不执行。

证据：[1791875832626-product-order-list.txt](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.txt)、[1791875832626-product-order-list.json](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.json)。

### PMS-PPO-048 全选当前页 / 每页条数 / 翻页 / 页码确定

字段：无已开表单/未获字段。

子动作：无。

待补：待安全实际点击/打开；直接写入按钮须停在确认前或明确不执行。

证据：[1791875832626-product-order-list.txt](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.txt)、[1791875832626-product-order-list.json](/tmp/higoods-pms-online-20261013/1791875832626-product-order-list.json)。

### PMS-PPO-049 生成面辅料需求分析

字段：来源商品采购单号/类型/SPU/商品名称/SKU数/采购总量/供应商/目标仓库/预计到货时间；SKU颜色/尺码/采购数量/BOM编号；BOM匹配状态/物料种类/是否允许生成；分析单号/需求总数/库存总数/建议采购总数；物料编码/名称/分类/使用部位/来源SKU/BOM需求/库存/采购中/建议采购/单位/建议供应商。

子动作：取消（visible_no_independent_click_evidence）；确认生成（visible_final_not_submitted）。

待补：最终确认生成未提交；合并/拆分与数量口径需原型契约验证。

证据：[1791876432778-product-order-generate-material-demand.txt](/tmp/higoods-pms-online-20261013/1791876432778-product-order-generate-material-demand.txt)。

### PMS-PPO-050 状态筛选查询（7个分支）

字段：无已开表单/未获字段。

子动作：无。

待补：其他筛选、默认、每页条数/翻页仍无独立点击证据。

证据：[1791876202468-product-order-status-6.txt](/tmp/higoods-pms-online-20261013/1791876202468-product-order-status-6.txt)、[1791876203981-product-order-status-3.txt](/tmp/higoods-pms-online-20261013/1791876203981-product-order-status-3.txt)、[1791876205625-product-order-status-4.txt](/tmp/higoods-pms-online-20261013/1791876205625-product-order-status-4.txt)、[1791876207276-product-order-status-5.txt](/tmp/higoods-pms-online-20261013/1791876207276-product-order-status-5.txt)、[1791876208739-product-order-status-11.txt](/tmp/higoods-pms-online-20261013/1791876208739-product-order-status-11.txt)、[1791876210046-product-order-status-12.txt](/tmp/higoods-pms-online-20261013/1791876210046-product-order-status-12.txt)、[1791876211742-product-order-status-13.txt](/tmp/higoods-pms-online-20261013/1791876211742-product-order-status-13.txt)。

## 备货列表

线上：https://manage.higood.ai/pms/reorder/index；原型：`/pms/reorder`。

查询字段：SPU；是否备货款；标记时间起/止；商品备注；近3天销量大于；近5天销量大于；库存数量小于；排序；每页条数。

统计：总备货数量。

列表列：商品图片；SPU；翻单次数；是否备货款；采购中数量；待审核数量；库存；待发货+待打单；备货数量；建议数量；总销量；近3/5/7天销量；备注；操作。

| 编号 | 功能按钮 | 点击状态 / 结果 | 原型映射 | 写入边界 |
|---|---|---|---|---|
| PMS-REO-001 | 新增备货SPU | opened；打开添加备货商品；初始仅见请输入SPU输入，未见提交控件 | missing；原型该按钮只提示交给线上后台，无新增表单或真实建单 | not_submitted |
| PMS-REO-002 | 销量曲线图 | opened；打开ASYZZ26072909销售趋势窗口，日期与搜索按钮可见 | missing；原型缺销量曲线图 | not_applicable_read_only |
| PMS-REO-003 | 备注 | opened；备注表单已打开 | same_kind_exists；原型备注只内存，需补持久保存 | not_submitted |
| PMS-REO-004 | 取消标记 | opened；确认：确定要取消标识吗 | partial；原型有标记切换但需维持二次确认和操作事实 | not_submitted |
| PMS-REO-005 | 设置常备数量 | opened；设置常备库存表单已打开 | same_kind_exists；原型此数量只内存 | not_submitted |
| PMS-REO-006 | 备货 | opened；打开备货表单和SKU数量明细 | missing；原型备货只留痕，不生成采购单，缺类型/数量分配表单 | not_submitted |
| PMS-REO-007 | 查询 | observed_only；在列表可见，但本集合没有独立动作返回证据 | partial；原型缺标记日期与商品备注筛选 | not_executed_observed_only |
| PMS-REO-008 | 重置 | observed_only；在列表可见，但本集合没有独立动作返回证据 | partial；需核对完整默认结果 | not_executed_observed_only |
| PMS-REO-009 | 排序 | observed_only；在列表可见，但本集合没有独立动作返回证据 | partial；原型排序维度需核对 | not_executed_observed_only |
| PMS-REO-010 | 分页 / 每页条数 / 页码跳转 | observed_only；在列表可见，但本集合没有独立动作返回证据 | partial；两页Mock及翻页验收 | not_executed_observed_only |

### PMS-REO-001 新增备货SPU

字段：SPU输入。

子动作：无。

待补：输入SPU后的查询/校验/保存路径；没有提交新增。

证据：[1791876461098-reorder-add.txt](/tmp/higoods-pms-online-20261013/1791876461098-reorder-add.txt)。

### PMS-REO-002 销量曲线图

字段：开始日期；结束日期。

子动作：搜索（visible_no_independent_click_evidence）；关闭（visible_no_independent_click_evidence）。

待补：搜索子动作无独立证据；曲线渲染与指标粒度。

证据：[1791876478582-reorder-销量曲线图.txt](/tmp/higoods-pms-online-20261013/1791876478582-reorder-销量曲线图.txt)。

### PMS-REO-003 备注

字段：SPU（只读）；备注。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：最后确定未提交。

证据：[1791876482706-reorder-备注.txt](/tmp/higoods-pms-online-20261013/1791876482706-reorder-备注.txt)。

### PMS-REO-004 取消标记

字段：无已开表单/未获字段。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：标记另一状态样本未单独核查；最后确定未提交。

证据：[1791876484084-reorder-取消标记.txt](/tmp/higoods-pms-online-20261013/1791876484084-reorder-取消标记.txt)。

### PMS-REO-005 设置常备数量

字段：SPU（只读）；常备数量。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：数量影响建议量的口径；最后确定未提交。

证据：[1791876488209-reorder-设置常备数量.txt](/tmp/higoods-pms-online-20261013/1791876488209-reorder-设置常备数量.txt)。

### PMS-REO-006 备货

字段：SPU（只读）；售卖类型（预售/备货/shopee备货）；采购单类型（现货/做货）；备货数量；SKU图片/编码/采购数量；备注。

子动作：分配数量（visible_no_independent_click_evidence）；确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：分配数量子动作与计算规则；最后确定未提交。

证据：[1791876492330-reorder-备货.txt](/tmp/higoods-pms-online-20261013/1791876492330-reorder-备货.txt)。

### PMS-REO-007 查询

字段：无已开表单/未获字段。

子动作：无。

待补：待安全点击验证。

证据：[1791876446686-reorder-list.txt](/tmp/higoods-pms-online-20261013/1791876446686-reorder-list.txt)。

### PMS-REO-008 重置

字段：无已开表单/未获字段。

子动作：无。

待补：待安全点击验证。

证据：[1791876446686-reorder-list.txt](/tmp/higoods-pms-online-20261013/1791876446686-reorder-list.txt)。

### PMS-REO-009 排序

字段：无已开表单/未获字段。

子动作：无。

待补：待安全点击验证。

证据：[1791876446686-reorder-list.txt](/tmp/higoods-pms-online-20261013/1791876446686-reorder-list.txt)。

### PMS-REO-010 分页 / 每页条数 / 页码跳转

字段：无已开表单/未获字段。

子动作：无。

待补：待安全点击验证。

证据：[1791876446686-reorder-list.txt](/tmp/higoods-pms-online-20261013/1791876446686-reorder-list.txt)。

## 商品采购售后

线上：https://manage.higood.ai/pms/product_purchase_order_aftersales/index；原型：`/pms/product-purchase-order-aftersales`。

查询字段：检索字段/批量关键词（空格或英文逗号）；商品识别码；创建时间起/止；退货时间起/止；采购签收时间起/止；售后状态；是否预填单号；采购类型；供应商类型；收件人；买手；每页条数。

统计：。

列表列：序号；商品信息；关联采购单；售后状态；售后原因；图片证据；收货快递信息；退货地址；退货快递信息；时间；售后申请人；备注；操作。

| 编号 | 功能按钮 | 点击状态 / 结果 | 原型映射 | 写入边界 |
|---|---|---|---|---|
| PMS-AFS-001 | 开始售后 | opened；确认窗：确定开始售后吗？ | same_kind_exists；原型有同类状态动作但仅内存，确认/异常等效性需对齐 | not_submitted |
| PMS-AFS-002 | 驳回 | opened；确认窗：确定驳回吗 | same_kind_exists；原型有同类状态动作但仅内存，确认/异常等效性需对齐 | not_submitted |
| PMS-AFS-003 | 备注 | opened；备注信息表单已打开 | same_kind_exists；原型仅内存保存 | not_submitted |
| PMS-AFS-004 | 完善信息 | opened；完善售后信息表单已打开 | partial；原型有退货地址表单，需补快捷地址解析和字段一致性 | not_submitted |
| PMS-AFS-005 | 同意退货 | opened；确认窗：确定直接同意退货？ | same_kind_exists；原型有同类状态动作但仅内存，确认/异常等效性需对齐 | not_submitted |
| PMS-AFS-006 | 更新状态 | opened；确认窗：该售后没有售后地址，没有物流信息，确定要操作吗 | same_kind_exists；原型有同类状态动作但仅内存，确认/异常等效性需对齐 | not_submitted |
| PMS-AFS-007 | 快递信息 | opened；维护快递信息表单已打开 | partial；原型有快递维护，但预填单号/运费需核对补齐 | not_submitted |
| PMS-AFS-008 | 批量开始售后 | empty_selection_guard；请勾选需要设置的数据 | same_kind_exists；原型已同类批量动作，需核对有选择后的规则 | not_submitted |
| PMS-AFS-009 | 批量同意退货 | empty_selection_guard；请勾选需要设置的数据 | same_kind_exists；原型已同类批量动作，需核对有选择后的规则 | not_submitted |
| PMS-AFS-010 | 批量更新状态 | empty_selection_guard；请勾选需要设置的数据 | same_kind_exists；原型已同类批量动作，需核对有选择后的规则 | not_submitted |
| PMS-AFS-011 | 查询 | observed_only；列表可见，无独立动作返回证据 | partial；原型查询字段和列表来源/链接需对齐，导出文件未获证据 | not_executed_observed_only |
| PMS-AFS-012 | 重置 | observed_only；列表可见，无独立动作返回证据 | partial；原型查询字段和列表来源/链接需对齐，导出文件未获证据 | not_executed_observed_only |
| PMS-AFS-013 | 导出售后 | observed_only；列表可见，无独立动作返回证据 | partial；原型查询字段和列表来源/链接需对齐，导出文件未获证据 | not_executed_observed_only |
| PMS-AFS-014 | 分页 / 每页条数 / 页码确定 | observed_only；列表可见，无独立动作返回证据 | partial；原型查询字段和列表来源/链接需对齐，导出文件未获证据 | not_executed_observed_only |
| PMS-AFS-015 | 关联商品采购单链接 | observed_only；列表可见，无独立动作返回证据 | partial；原型查询字段和列表来源/链接需对齐，导出文件未获证据 | not_executed_observed_only |

### PMS-AFS-001 开始售后

字段：无已开表单/未获字段。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：后续状态/异常恢复规则；最终确定未提交。

证据：[1791876518148-after-sales-开始售后.txt](/tmp/higoods-pms-online-20261013/1791876518148-after-sales-开始售后.txt)。

### PMS-AFS-002 驳回

字段：无已开表单/未获字段。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：后续状态/异常恢复规则；最终确定未提交。

证据：[1791876519541-after-sales-驳回.txt](/tmp/higoods-pms-online-20261013/1791876519541-after-sales-驳回.txt)。

### PMS-AFS-003 备注

字段：售后序号/采购单号（只读）；备注。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：最终确定未提交。

证据：[1791876523679-after-sales-备注.txt](/tmp/higoods-pms-online-20261013/1791876523679-after-sales-备注.txt)。

### PMS-AFS-004 完善信息

字段：快捷框（姓名/手机号/地址，或1688逗号格式）；联系人；手机号；收货地址。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：快捷框解析未单独点击/填写核验；最终确定未提交。

证据：[1791876527819-after-sales-完善信息.txt](/tmp/higoods-pms-online-20261013/1791876527819-after-sales-完善信息.txt)。

### PMS-AFS-005 同意退货

字段：无已开表单/未获字段。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：后续状态/异常恢复规则；最终确定未提交。

证据：[1791876529195-after-sales-同意退货.txt](/tmp/higoods-pms-online-20261013/1791876529195-after-sales-同意退货.txt)。

### PMS-AFS-006 更新状态

字段：无已开表单/未获字段。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：后续状态/异常恢复规则；最终确定未提交。

证据：[1791876530559-after-sales-更新状态.txt](/tmp/higoods-pms-online-20261013/1791876530559-after-sales-更新状态.txt)。

### PMS-AFS-007 快递信息

字段：快递公司；快递单号；预填单号；运费。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：预填下拉与历史选择规则；最终确定未提交。

证据：[1791876534742-after-sales-快递信息.txt](/tmp/higoods-pms-online-20261013/1791876534742-after-sales-快递信息.txt)。

### PMS-AFS-008 批量开始售后

字段：无已开表单/未获字段。

子动作：无。

待补：有选择后的确认/表单未核查；最终批量写入未提交。

证据：[1791876552973-after-sales-批量开始售后-empty.txt](/tmp/higoods-pms-online-20261013/1791876552973-after-sales-批量开始售后-empty.txt)。

### PMS-AFS-009 批量同意退货

字段：无已开表单/未获字段。

子动作：无。

待补：有选择后的确认/表单未核查；最终批量写入未提交。

证据：[1791876553717-after-sales-批量同意退货-empty.txt](/tmp/higoods-pms-online-20261013/1791876553717-after-sales-批量同意退货-empty.txt)。

### PMS-AFS-010 批量更新状态

字段：无已开表单/未获字段。

子动作：无。

待补：有选择后的确认/表单未核查；最终批量写入未提交。

证据：[1791876554444-after-sales-批量更新状态-empty.txt](/tmp/higoods-pms-online-20261013/1791876554444-after-sales-批量更新状态-empty.txt)。

### PMS-AFS-011 查询

字段：无已开表单/未获字段。

子动作：无。

待补：待安全点击验证。

证据：[1791876510609-after-sales-list.txt](/tmp/higoods-pms-online-20261013/1791876510609-after-sales-list.txt)。

### PMS-AFS-012 重置

字段：无已开表单/未获字段。

子动作：无。

待补：待安全点击验证。

证据：[1791876510609-after-sales-list.txt](/tmp/higoods-pms-online-20261013/1791876510609-after-sales-list.txt)。

### PMS-AFS-013 导出售后

字段：无已开表单/未获字段。

子动作：无。

待补：待安全点击验证。

证据：[1791876510609-after-sales-list.txt](/tmp/higoods-pms-online-20261013/1791876510609-after-sales-list.txt)。

### PMS-AFS-014 分页 / 每页条数 / 页码确定

字段：无已开表单/未获字段。

子动作：无。

待补：待安全点击验证。

证据：[1791876510609-after-sales-list.txt](/tmp/higoods-pms-online-20261013/1791876510609-after-sales-list.txt)。

### PMS-AFS-015 关联商品采购单链接

字段：无已开表单/未获字段。

子动作：无。

待补：待安全点击验证。

证据：[1791876510609-after-sales-list.txt](/tmp/higoods-pms-online-20261013/1791876510609-after-sales-list.txt)。

## 面辅料需求分析

线上：https://manage.higood.ai/pms/material_purchase_demand/index；原型：`/pms/material-requirements`。

查询字段：采购单号/检索类型/关键词；申请人；辅料SKU；创建时间起/止；商品数量最小/最大；状态；采购区域ID/CN；采购来源；采购时间起/止；商品类型；是否有ID面辅料采购单；是否KOL样品小单；是否首单；每页条数。

统计：计划采购商品数；到货商品数；已出货商品数；等待出货商品数。

列表列：需求单号；面辅料信息；供应商信息；采购类型；状态；时间；数量汇总；物流信息；备注；操作。

| 编号 | 功能按钮 | 点击状态 / 结果 | 原型映射 | 写入边界 |
|---|---|---|---|---|
| PMS-MRQ-001 | 查看详情 | opened；打开MRA-2026-26850相关采购详情，BOM V1.0/已启用/快照 | partial；原型有需求详情，需补来源+BOM快照字段和线上全部数量结构 | not_applicable_read_only |
| PMS-MRQ-002 | 编辑（采购区域） | opened；已保存raw表单：编辑采购区域 | missing；原型需求页没有采购区域编辑动作 | not_submitted |
| PMS-MRQ-003 | 替换面辅料 | opened；已保存raw表单：替换面辅料 | missing；原型需求页没有替换面辅料及下游追溯动作 | not_submitted |
| PMS-MRQ-004 | 设置印花染色 | opened；已保存raw表单：设置印花染色；当前返回字段展示染色分支 | missing；原型需求页没有工艺及工厂关联动作；不能重复维护已有技术包工艺 | not_submitted |
| PMS-MRQ-005 | 创建面辅料采购单 | opened；已保存raw表单：创建面辅料采购单；默认SKU选中，区域规则可见 | partial；原型有下推采购，需要核对线上区域/历史库存/实采数量来源与一致性 | not_submitted |
| PMS-MRQ-006 | 采购备注 | opened_native_screenshot；已核对非空PNG并视读：采购备注窗口可见；浏览器policy阻塞后原生操作不可用 | missing；原型需求页没有独立采购备注动作 | not_submitted |
| PMS-MRQ-007 | 批量设置采购员 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-008 | 批量驳回 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-009 | 批量备注 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-010 | 批量确认实际采购价 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-011 | 批量创建面辅料采购单 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | partial；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-012 | 批量关联面辅料采购单 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-013 | 面料采购 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-014 | 原料采购 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-015 | 物料采购 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-016 | 辅料采购 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-017 | 导出采购单 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | partial；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-018 | 运单批量入库 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-019 | 批量填写物流单号 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-020 | 上传入库 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-021 | 面辅料实际采购数量上传 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-022 | 批量设置印花染色 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-023 | 刷新面辅料采购需求 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-024 | 设置采购员 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-025 | 设置面料供应商 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-026 | 关联面辅料采购单 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-027 | 驳回 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-028 | 商品链接 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | missing；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-029 | SKU数/数量/关联采购单链接 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | partial；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-030 | 查询 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | partial；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-031 | 默认 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | partial；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-032 | 全选当前页 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | same_kind_exists；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |
| PMS-MRQ-033 | 分页 / 每页条数 / 页码确定 | observed_only；列表出现按钮/链接，本集合无实际点击后视图；直接写入或同步按钮尚未执行 | same_kind_exists；仅完成列表观察；原型入口/字段/关联契约须按实际目标补齐 | not_executed_observed_only |

### PMS-MRQ-001 查看详情

字段：来源采购单图片/单号/类型/做货供应商/SPU/SKU数/目标仓库/商品名/采购总量/预计到货时间；BOM编号/版本/状态/使用时间/是否快照/物料种类；SKU颜色/尺码/采购数量/BOM编号/版本/状态；物料图片/编码/名称/分类/使用部位/来源SKU/SKU采购量/单件用量/损耗率/BOM需求/库存/采购中/建议采购。

子动作：关闭（visible_no_independent_click_evidence）。

待补：图片大图未单独取证。

证据：[1791876575845-material-demand-detail.txt](/tmp/higoods-pms-online-20261013/1791876575845-material-demand-detail.txt)。

### PMS-MRQ-002 编辑（采购区域）

字段：需求单号/SPU（只读）；采购区域ID/CN单选。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：区域影响采购候选/现有关联单；最终确定未提交。

证据：[1791876593373-material-demand-编辑.txt](/tmp/higoods-pms-online-20261013/1791876593373-material-demand-编辑.txt)。

### PMS-MRQ-003 替换面辅料

字段：需求分析/源采购单/SPU（只读）；全选/明细选择；原SKU/名称/建议采购；新SKU编码。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：新物料选择/校验/库存与旧单处理；最终确定未提交。

证据：[1791876600220-material-demand-替换面辅料.txt](/tmp/higoods-pms-online-20261013/1791876600220-material-demand-替换面辅料.txt)。

### PMS-MRQ-004 设置印花染色

字段：需求分析/源采购单/SPU（只读）；物料SKU选择/名称/建议采购；染色工艺（必填）；染色工厂（必填）；计划完成时间（必填）；来源说明；备注。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：工艺/工厂选择子动作；印花分支未确认；最终确定未提交。

证据：[1791876606824-material-demand-设置印花染色.txt](/tmp/higoods-pms-online-20261013/1791876606824-material-demand-设置印花染色.txt)。

### PMS-MRQ-005 创建面辅料采购单

字段：采购单/需求分析单（只读）；采购区域ID/CN（FL开头默认CN，含ID默认ID）；SKU选择/全选/图片/编码；计划采购量/历史面辅料库存/ID历史库存/实际采购量；备注。

子动作：确定（visible_final_not_submitted）；重置（visible_no_independent_click_evidence）。

待补：实际采购数量的合法上限/历史库存含义；重置未独立取证；最终确定未提交。

证据：[1791876610560-material-demand-创建面辅料采购单.txt](/tmp/higoods-pms-online-20261013/1791876610560-material-demand-创建面辅料采购单.txt)。

### PMS-MRQ-006 采购备注

字段：需求单号MRA-2026-26850（只读）；采购备注文本域。

子动作：确定（visible_final_not_submitted）；关闭（visible_no_independent_click_evidence）。

待补：取消/关闭尚未独立取证，不断言未点击；最后确定未提交；原生操作失败不等于表单没打开。

证据：[1791876800611-material-demand-remark-native.png](/tmp/higoods-pms-online-20261013/1791876800611-material-demand-remark-native.png)。

### PMS-MRQ-007 批量设置采购员

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-008 批量驳回

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-009 批量备注

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-010 批量确认实际采购价

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-011 批量创建面辅料采购单

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-012 批量关联面辅料采购单

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-013 面料采购

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-014 原料采购

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-015 物料采购

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-016 辅料采购

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-017 导出采购单

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-018 运单批量入库

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-019 批量填写物流单号

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-020 上传入库

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-021 面辅料实际采购数量上传

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-022 批量设置印花染色

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-023 刷新面辅料采购需求

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-024 设置采购员

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-025 设置面料供应商

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-026 关联面辅料采购单

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-027 驳回

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-028 商品链接

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-029 SKU数/数量/关联采购单链接

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-030 查询

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-031 默认

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-032 全选当前页

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

### PMS-MRQ-033 分页 / 每页条数 / 页码确定

字段：无已开表单/未获字段。

子动作：无。

待补：待安全打开；可能直接写入的操作不试提交；需要表单/确认/取消与资格边界证据。

证据：[1791876560724-material-demand-list.txt](/tmp/higoods-pms-online-20261013/1791876560724-material-demand-list.txt)。

## 仍需完成

尚未进入的21页：面辅料采购单；面辅料采购跟踪；面辅料采购时效；面辅料供应商确认单；头程物流；原料仓库存查询；面辅料采购请款；物流费用请款；KOL库存；手动寄样申请；对外样品池链接；锁定操作记录；商品供应商管理；供应商供货档案；头程物流商管理；面辅料列表；成衣列表；样衣列表；仓库管理；单位管理；BOM/样板管理。

进入的6页仍待补：其余21个菜单页面尚未进入；6页内observed_only按钮、选中状态后的批量表单、下拉/搜索/数量分配子动作；图片大图、打印结果、附件实体、导出文件口径；页面字段/数量/状态的正常与边界，以及失败/取消/恢复；当前原型补齐尚未开始，未执行本地功能/持久化/设备/性能验收；最终线上业务写入未提交，线上真实事务结果不在核查证据内。

所有原始证据SHA256和来源时间在inventory-current.json的sourceManifest中；本轮未改源码，没有产品接受或发布证据。
