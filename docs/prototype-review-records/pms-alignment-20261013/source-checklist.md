# 采购管理测试现场功能清单

环境：`http://test_manage.higood.ai`。来源为本目录 `inventory/` 的 7 份冻结记录，逐页进入、逐个可用按钮点击后整理。正式环境旧证据不作为当前验收。

本清单包含观察、打开、关闭、正常与失败分支；相同按钮的重复观察合并展示，全部原始编号保留在原子矩阵。806 条来源记录不等于 806 个独立业务按钮。保存、审核、签收、状态写入、导入等最终持久操作在测试站未执行，遵循数据库只读要求；在本地原型另行验收保存及回读。

实施对象：21 个功能页；完整删除对象：面辅料列表、成衣列表、样衣列表、仓库管理、单位管理、BOM/样板管理。

菜单顺序：采购建议 → 商品采购 → 面辅料采购 → 面辅料供应商确认 → 头程物流 → 库存查询 → 采购对账 → KOL样衣申请 → 基础资料。

## 功能点

### 商品采购建议

- 页面进入（来源：`PMS-TEST-CORE-SUG-ENTER`）
- 查看 SKU（来源：`PMS-TEST-CORE-SUG-SKU`）
- 收起 SKU（来源：`PMS-TEST-CORE-SUG-COLLAPSE`）
- 生成商品采购单（来源：`PMS-TEST-CORE-SUG-CREATE`）
- 爆款 (70%)（来源：`PMS-TEST-CORE-SUG-PRESET70`）
- 热销 (60%)（来源：`PMS-TEST-CORE-SUG-PRESET60`）
- 生成单表单重置（来源：`PMS-TEST-CORE-SUG-CREATERESET`）
- 做货区域 CN（来源：`PMS-TEST-CORE-SUG-CN`）
- 设置不需要做货（来源：`PMS-TEST-CORE-SUG-NOMAKE`）
- 检索字段条件候选（来源：`PMS-TEST-CORE-SUG-FILTER0`）
- 商品类型条件候选（来源：`PMS-TEST-CORE-SUG-FILTER1`）
- 首翻单条件候选（来源：`PMS-TEST-CORE-SUG-FILTER2`）
- 是否需要做货条件候选（来源：`PMS-TEST-CORE-SUG-FILTER3`）
- 查询指定 SPU（来源：`PMS-TEST-CORE-SUG-QUERY`）
- 清除查询（来源：`PMS-TEST-CORE-SUG-RESET`）
- 导出sku商品（来源：`PMS-TEST-CORE-SUG-EXPORTSKU`）
- 导出Spu商品（来源：`PMS-TEST-CORE-SUG-EXPORTSPU`）
- 分页跳转确定（可见控件）（来源：`PMS-TEST-CORE-SUG-PAGINATION-LOCAL`）
- 确定（最终提交）（来源：`PMS-TEST-CORE-SUG-NOMAKE-FINAL-1-15e6ff`）
- suggestions-pagination-revisit（来源：`PMS-TEST-ROOT-SUP-74e618e94593`）
- suggestions-page-size10（来源：`PMS-TEST-ROOT-SUP-e8fd71a0bd41`）
- suggestions-jump-first-page（来源：`PMS-TEST-ROOT-SUP-5dece494ce16`）

### KOL采购需求

- 页面进入（来源：`PMS-TEST-CORE-KOL-ENTER`）
- 新增KOL需求（来源：`PMS-TEST-CORE-KOL-NEW`）
- 新增表单空搜索（来源：`PMS-TEST-CORE-KOL-SEARCH-EMPTY`）
- 新增表单搜索SPU（来源：`PMS-TEST-CORE-KOL-SEARCH`）
- 新增表单选择SPU（来源：`PMS-TEST-CORE-KOL-SELECTSPU`）
- 新增表单SKU明细实际载入（来源：`PMS-TEST-CORE-KOL-SKU-READY`）
- 查看KOL需求（来源：`PMS-TEST-CORE-KOL-VIEW`）
- 确认入库（来源：`PMS-TEST-CORE-KOL-RECEIVE`）
- 驳回（来源：`PMS-TEST-CORE-KOL-REJECT`）
- 备注（来源：`PMS-TEST-CORE-KOL-REMARK`）
- 批量审核通过（空选）（来源：`PMS-TEST-CORE-KOL-BULKEMPTY-AUDIT`）
- 批量审核通过（选中）（来源：`PMS-TEST-CORE-KOL-BULK-AUDIT`）
- 批量确认入库（空选）（来源：`PMS-TEST-CORE-KOL-BULKEMPTY-RECEIVE`）
- 批量确认入库（选中）（来源：`PMS-TEST-CORE-KOL-BULK-RECEIVE`）
- 批量驳回（空选）（来源：`PMS-TEST-CORE-KOL-BULKEMPTY-REJECT`）
- 批量驳回（选中）（来源：`PMS-TEST-CORE-KOL-BULK-REJECT`）
- 批量备注（空选）（来源：`PMS-TEST-CORE-KOL-BULKEMPTY-REMARK`）
- 批量备注（选中）（来源：`PMS-TEST-CORE-KOL-BULK-REMARK`）
- 状态条件（来源：`PMS-TEST-CORE-KOL-FILTER-STATE`）
- 店铺条件（来源：`PMS-TEST-CORE-KOL-FILTER-SHOP`）
- 商品定位条件（来源：`PMS-TEST-CORE-KOL-FILTER-POSITION`）
- 查询（来源：`PMS-TEST-CORE-KOL-QUERY`）
- 默认/重置（来源：`PMS-TEST-CORE-KOL-RESET`）
- 导出需求（来源：`PMS-TEST-CORE-KOL-EXPORT`）
- 导出明细（来源：`PMS-TEST-CORE-KOL-EXPORTDETAIL`）
- 申请数量数值链接（来源：`PMS-TEST-CORE-KOL-COUNTDETAIL`）
- 多选筛选弹出层 全选（来源：`PMS-TEST-CORE-KOL-FILTER-SUB-ALL`）
- 多选筛选弹出层 清空（来源：`PMS-TEST-CORE-KOL-FILTER-SUB-CLEAR`）
- 分页跳转确定（可见控件）（来源：`PMS-TEST-CORE-KOL-PAGINATION-LOCAL`）
- 保存草稿（最终提交）（来源：`PMS-TEST-CORE-KOL-NEW-FINAL-1-9315ec`；另有 3 条观察或分支）
- 确定（最终提交）（来源：`PMS-TEST-CORE-KOL-RECEIVE-FINAL-1-6616c9`；另有 4 条观察或分支）
- kol-filter-subactions-list（来源：`PMS-TEST-ROOT-SUP-2b0050a20782`）
- kol-status-popup-subactions（来源：`PMS-TEST-ROOT-SUP-679128d02a63`）
- kol-filter-status-all（来源：`PMS-TEST-ROOT-SUP-a1a338eb58a0`）
- kol-filter-status-clear（来源：`PMS-TEST-ROOT-SUP-4f17d06466a7`）
- kol-filter-shop-all（来源：`PMS-TEST-ROOT-SUP-2bb4944db24d`）
- kol-filter-shop-clear（来源：`PMS-TEST-ROOT-SUP-79d81e7c917a`）
- kol-filter-position-all（来源：`PMS-TEST-ROOT-SUP-579f8ce79a0e`）
- kol-filter-position-clear（来源：`PMS-TEST-ROOT-SUP-1affbef855df`）
- kol-query-page-size10（来源：`PMS-TEST-ROOT-SUP-96dd355e6bb6`）
- kol-jump-first-page（来源：`PMS-TEST-ROOT-SUP-6b64aefd6f92`）

### 商品采购单

- 商品采购单页面进入（来源：`PMS-TEST-CORE-PPO-ENTER`）
- 通用新增（来源：`PMS-TEST-CORE-PPO-NEW-GENERAL`）
- 该新增入口内部SPU搜索与SKU载入（来源：`PMS-TEST-CORE-PPO-NEW-GENERAL-SPU`；另有 5 条观察或分支）
- 添加样衣采购（来源：`PMS-TEST-CORE-PPO-NEW-SAMPLE`）
- 达人寄样采购（来源：`PMS-TEST-CORE-PPO-NEW-KOL`）
- 做货采购（来源：`PMS-TEST-CORE-PPO-NEW-MAKE`）
- 烫画采购（来源：`PMS-TEST-CORE-PPO-NEW-PRINT`）
- 成衣采购（来源：`PMS-TEST-CORE-PPO-NEW-GARMENT`）
- 批量审核采购（空选）（来源：`PMS-TEST-CORE-PPO-BULKEMPTY-AUDIT`）
- 批量驳回（空选）（来源：`PMS-TEST-CORE-PPO-BULKEMPTY-REJECT`）
- 合并采购单（空选）（来源：`PMS-TEST-CORE-PPO-BULKEMPTY-MERGE`）
- 创建组合生产采购单（空选）（来源：`PMS-TEST-CORE-PPO-BULKEMPTY-COMBINE`）
- 批量设置采购员（空选）（来源：`PMS-TEST-CORE-PPO-BULKEMPTY-BUYER`）
- 批量设置合作商（空选）（来源：`PMS-TEST-CORE-PPO-BULKEMPTY-PARTNER`）
- 批量更改采购类型（空选）（来源：`PMS-TEST-CORE-PPO-BULKEMPTY-TYPE`）
- 批量一键下单（空选）（来源：`PMS-TEST-CORE-PPO-BULKEMPTY-ONECLICK`）
- 批量确认模板（空选）（来源：`PMS-TEST-CORE-PPO-BULKEMPTY-TEMPLATE`）
- 批量面辅料签收表（空选）（来源：`PMS-TEST-CORE-PPO-BULKEMPTY-SIGN`）
- 批量发起售后（空选）（来源：`PMS-TEST-CORE-PPO-BULKEMPTY-AFTERSALES`）
- 运单批量入库（来源：`PMS-TEST-CORE-PPO-SCAN`）
- 编辑售卖类型（来源：`PMS-TEST-CORE-PPO-ROW-SELLTYPE`）
- 设置采购员（来源：`PMS-TEST-CORE-PPO-ROW-BUYER`）
- 设置合作商（来源：`PMS-TEST-CORE-PPO-ROW-PARTNER`）
- 查看详情（来源：`PMS-TEST-CORE-PPO-ROW-DETAIL`）
- 快递信息（来源：`PMS-TEST-CORE-PPO-ROW-EXPRESS`）
- 采购中驳回（来源：`PMS-TEST-CORE-PPO-ROW-PURCHASE-REJECT`）
- 驳回（来源：`PMS-TEST-CORE-PPO-ROW-REJECT`）
- 发起售后（来源：`PMS-TEST-CORE-PPO-ROW-AFTERSALES`）
- 采购备注（来源：`PMS-TEST-CORE-PPO-ROW-REMARK`）
- 日志记录（来源：`PMS-TEST-CORE-PPO-ROW-LOG`）
- 出货记录（来源：`PMS-TEST-CORE-PPO-ROW-OUTLOG`）
- 拆分采购单（来源：`PMS-TEST-CORE-PPO-ROW-SPLIT`）
- 打印条码列表（来源：`PMS-TEST-CORE-PPO-ROW-BARCODE`）
- 查看面辅料需求（来源：`PMS-TEST-CORE-PPO-ROW-MRQVIEW`）
- 生成面辅料需求分析（来源：`PMS-TEST-CORE-PPO-ROW-MRQNEW`）
- 一键下单（来源：`PMS-TEST-CORE-PPO-ROW-ONECLICK`）
- 面辅料样衣（来源：`PMS-TEST-CORE-PPO-ROW-MATSAMPLE`）
- 设置尾部烫包质检合作商（来源：`PMS-TEST-CORE-PPO-ROW-TAILPARTNER`）
- 复制采购单（来源：`PMS-TEST-CORE-PPO-ROW-COPY`）
- 审核采购（来源：`PMS-TEST-CORE-PPO-ROW-AUDIT`）
- 完整编辑采购单（来源：`PMS-TEST-CORE-PPO-ROW-EDIT`）
- 编辑采购数量重新分配（来源：`PMS-TEST-CORE-PPO-ROW-EDIT-REDISTRIBUTE`）
- 开启入库（来源：`PMS-TEST-CORE-PPO-ROW-REOPEN`）
- 手动出库（来源：`PMS-TEST-CORE-PPO-ROW-OUTBOUND`）
- 创建工单（来源：`PMS-TEST-CORE-PPO-ROW-WORKORDER`）
- 样衣质检（来源：`PMS-TEST-CORE-PPO-ROW-QC`）
- 现货采购（来源：`PMS-TEST-CORE-PPO-ROW-CONVERTGARMENT`）
- 样衣转做货采购（来源：`PMS-TEST-CORE-PPO-ROW-CONVERTMAKE`）
- 批量审核采购（选中）（来源：`PMS-TEST-CORE-PPO-BULK-AUDIT`）
- 批量驳回（选中）（来源：`PMS-TEST-CORE-PPO-BULK-REJECT`）
- 批量设置采购员（选中）（来源：`PMS-TEST-CORE-PPO-BULK-BUYER`）
- 批量设置合作商（选中）（来源：`PMS-TEST-CORE-PPO-BULK-PARTNER`）
- 批量更改采购类型（选中）（来源：`PMS-TEST-CORE-PPO-BULK-TYPE`）
- 批量发起售后（选中）（来源：`PMS-TEST-CORE-PPO-BULK-AFTERSALES`）
- 合并采购单（选中）（来源：`PMS-TEST-CORE-PPO-BULK-MERGE`）
- 详情内面辅料需求分析→查看（来源：`PMS-TEST-CORE-PPO-DETAIL-MRQ`）
- 条码弹窗行打印条码（来源：`PMS-TEST-CORE-PPO-BARCODE-ONE`）
- 条码弹窗底部打印（来源：`PMS-TEST-CORE-PPO-BARCODE-BULK`）
- 条码弹窗重置（来源：`PMS-TEST-CORE-PPO-BARCODE-RESET`）
- 面料采购（来源：`PMS-TEST-CORE-PPO-ROW-MATERIAL`）
- 采购数量数值链接（来源：`PMS-TEST-CORE-PPO-ROW-QTYDETAIL`）
- 查看售后（来源：`PMS-TEST-CORE-PPO-ROW-VIEWAFTER`）
- 商品链接（来源：`PMS-TEST-CORE-PPO-EXTERNAL-LINK`）
- 入库人多选候选（来源：`PMS-TEST-CORE-PPO-MULTI0`）
- 做货区域多选候选（来源：`PMS-TEST-CORE-PPO-MULTI1`）
- 收件人多选候选（来源：`PMS-TEST-CORE-PPO-MULTI2`）
- 售卖类型多选候选（来源：`PMS-TEST-CORE-PPO-MULTI3`）
- 售后状态多选候选（来源：`PMS-TEST-CORE-PPO-MULTI4`）
- 区域多选候选（来源：`PMS-TEST-CORE-PPO-REGION`）
- 状态筛选 6（来源：`PMS-TEST-CORE-PPO-STATE6`）
- 状态筛选 1（来源：`PMS-TEST-CORE-PPO-STATE1`）
- 状态筛选 4（来源：`PMS-TEST-CORE-PPO-STATE4`）
- 状态筛选 5（来源：`PMS-TEST-CORE-PPO-STATE5`）
- 状态筛选 11（来源：`PMS-TEST-CORE-PPO-STATE11`）
- 状态筛选 12（来源：`PMS-TEST-CORE-PPO-STATE12`）
- 状态筛选 13（来源：`PMS-TEST-CORE-PPO-STATE13`）
- 状态筛选 14（来源：`PMS-TEST-CORE-PPO-STATE14`）
- 状态筛选 2（来源：`PMS-TEST-CORE-PPO-STATE2`）
- 状态筛选 7（来源：`PMS-TEST-CORE-PPO-STATE7`）
- 状态筛选 8（来源：`PMS-TEST-CORE-PPO-STATE8`）
- 状态筛选 15（来源：`PMS-TEST-CORE-PPO-STATE15`）
- 状态筛选 21（来源：`PMS-TEST-CORE-PPO-STATE21`）
- 状态筛选 22（来源：`PMS-TEST-CORE-PPO-STATE22`）
- 默认/重置查询（来源：`PMS-TEST-CORE-PPO-RESET`）
- 第二页（来源：`PMS-TEST-CORE-PPO-PAGE2`）
- 导出采购单（来源：`PMS-TEST-CORE-PPO-EXPORT`）
- 导出商品（来源：`PMS-TEST-CORE-PPO-EXPORTSKU`）
- 通用新增空SPU搜索（来源：`PMS-TEST-CORE-PPO-GAP-EMPTYSPU`）
- 通用新增按总量11重新分配（来源：`PMS-TEST-CORE-PPO-GAP-REALLOCATE`）
- 全选当前页（来源：`PMS-TEST-CORE-PPO-GAP-SELECTALL`）
- 取消全选（来源：`PMS-TEST-CORE-PPO-GAP-DESELECTALL`）
- 按已观察查看售后href直接进入（来源：`PMS-TEST-CORE-PPO-VIEWAFTER-DIRECT`）
- 采购单详情图片点击（来源：`PMS-TEST-CORE-PPO-DETAIL-IMAGE`）
- 多选筛选弹出层 全选（来源：`PMS-TEST-CORE-PPO-FILTER-SUB-ALL`）
- 多选筛选弹出层 清空（来源：`PMS-TEST-CORE-PPO-FILTER-SUB-CLEAR`）
- 分页跳转确定/每页条数（可见控件）（来源：`PMS-TEST-CORE-PPO-PAGINATION-LOCAL`）
- 查询（随状态和检索条件）（来源：`PMS-TEST-CORE-PPO-QUERY`）
- 保存草稿（最终提交）（来源：`PMS-TEST-CORE-PPO-GENERAL-FINAL-1-c0b198`；另有 7 条观察或分支）
- 保存并提交（最终提交）（来源：`PMS-TEST-CORE-PPO-GENERAL-FINAL-2-c0b198`；另有 7 条观察或分支）
- 确定（最终提交）（来源：`PMS-TEST-CORE-PPO-SELLTYPE-FINAL-1-38dec4`；另有 9 条观察或分支）
- 保存（最终提交）（来源：`PMS-TEST-CORE-PPO-EXPRESS-FINAL-1-893997`；另有 3 条观察或分支）
- 确认拆分（最终提交）（来源：`PMS-TEST-CORE-PPO-SPLIT-FINAL-1-9cd309`）
- product-order-filter-subactions-list（来源：`PMS-TEST-ROOT-SUP-cd9daa1ad273`）
- product-order-filter-warehouse-user-all（来源：`PMS-TEST-ROOT-SUP-6eb014cfe1f4`）
- product-order-filter-warehouse-user-clear（来源：`PMS-TEST-ROOT-SUP-ae85ef0ea7d8`）
- product-order-filter-made-region-all（来源：`PMS-TEST-ROOT-SUP-326bce791d85`）
- product-order-filter-made-region-clear（来源：`PMS-TEST-ROOT-SUP-c1119a405d3f`）
- product-order-filter-recipient-all（来源：`PMS-TEST-ROOT-SUP-3fb9b7a70509`）
- product-order-filter-recipient-clear（来源：`PMS-TEST-ROOT-SUP-defab1b6012d`）
- product-order-filter-sale-type-all（来源：`PMS-TEST-ROOT-SUP-418ac1973360`）
- product-order-filter-sale-type-clear（来源：`PMS-TEST-ROOT-SUP-8b17c2844ed9`）
- product-order-filter-aftersales-status-all（来源：`PMS-TEST-ROOT-SUP-4a9398c9678b`）
- product-order-filter-aftersales-status-clear（来源：`PMS-TEST-ROOT-SUP-1569ce00ad2a`）
- product-order-query-page-size10（来源：`PMS-TEST-ROOT-SUP-e82f126ad0be`）
- product-order-jump-first-page（来源：`PMS-TEST-ROOT-SUP-4ab6e7499194`）
- product-order-page-size10-settled（来源：`PMS-TEST-ROOT-SUP-da0a0d1e773c`）

### 备货列表

- 备货列表进入（来源：`PMS-TEST-CORE-REO-ENTER`）
- 新增备货SPU（来源：`PMS-TEST-CORE-REO-NEW`）
- 备注（来源：`PMS-TEST-CORE-REO-REMARK`）
- 取消标记（来源：`PMS-TEST-CORE-REO-UNMARK`）
- 设置常备数量（来源：`PMS-TEST-CORE-REO-DEFAULTQTY`）
- 备货（来源：`PMS-TEST-CORE-REO-STOCK`）
- 分配数量（来源：`PMS-TEST-CORE-REO-ALLOCATE`）
- 取消分配备货表单（来源：`PMS-TEST-CORE-REO-ALLOCATECANCEL`）
- 销量曲线图（来源：`PMS-TEST-CORE-REO-CHART`）
- 销量分析搜索（来源：`PMS-TEST-CORE-REO-CHARTSEARCH`）
- 查询（来源：`PMS-TEST-CORE-REO-QUERY`）
- 重置（来源：`PMS-TEST-CORE-REO-RESET`）
- 第二页（来源：`PMS-TEST-CORE-REO-PAGE2`）
- 是否备货款条件（来源：`PMS-TEST-CORE-REO-STOCKFLAG`）
- 排序条件（来源：`PMS-TEST-CORE-REO-SORT`）
- 标记开始日期选择器（来源：`PMS-TEST-CORE-REO-DATESTART`）
- 标记结束日期选择器（来源：`PMS-TEST-CORE-REO-DATEEND`）
- 商品备注条件（来源：`PMS-TEST-CORE-REO-NOTEFILTER`）
- 首行商品图片（来源：`PMS-TEST-CORE-REO-IMAGE`）
- 新增SPU内部查找/选择（来源：`PMS-TEST-CORE-REO-NEW-SPU`）
- 分页跳转确定（可见控件）（来源：`PMS-TEST-CORE-REO-PAGINATION-LOCAL`）
- 确定（最终提交）（来源：`PMS-TEST-CORE-REO-REMARK-FINAL-1-0ce01c`；另有 4 条观察或分支）
- reorder-pagination-revisit（来源：`PMS-TEST-ROOT-SUP-4d894cdd006a`）
- reorder-page-size10（来源：`PMS-TEST-ROOT-SUP-5503751c274b`）
- reorder-jump-first-page（来源：`PMS-TEST-ROOT-SUP-dd4d1700189f`）
- reorder-unmarked-state-query（来源：`PMS-TEST-ROOT-SUP-7b223b88cf4c`）
- reorder-real-image-mapping-list50（来源：`PMS-TEST-ROOT-SUP-463a13b6fe14`）
- reorder-image-spu-query-result（来源：`PMS-TEST-ROOT-SUP-a6ff4f5ae307`）
- reorder-clear-image-query-stock-flag（来源：`PMS-TEST-ROOT-SUP-0e43b4ea9d97`）
- reorder-image-spu-all-flags（来源：`PMS-TEST-ROOT-SUP-8fc1cedf2a2b`）
- 标记备货（来源：`PMS-TEST-ROOT-SUP-REO-MARK`）

### 商品采购售后

- 商品采购售后进入（来源：`PMS-TEST-CORE-AFS-ENTER`）
- 批量开始售后（空选）（来源：`PMS-TEST-CORE-AFS-BULKEMPTY-START`）
- 批量开始售后（选中）（来源：`PMS-TEST-CORE-AFS-BULK-START`）
- 批量同意退货（空选）（来源：`PMS-TEST-CORE-AFS-BULKEMPTY-RETURN`）
- 批量同意退货（选中）（来源：`PMS-TEST-CORE-AFS-BULK-RETURN`）
- 批量更新状态（空选）（来源：`PMS-TEST-CORE-AFS-BULKEMPTY-UPDATE`）
- 批量更新状态（选中）（来源：`PMS-TEST-CORE-AFS-BULK-UPDATE`）
- 开始售后（来源：`PMS-TEST-CORE-AFS-ROW-START`）
- 驳回（来源：`PMS-TEST-CORE-AFS-ROW-REJECT`）
- 备注（来源：`PMS-TEST-CORE-AFS-ROW-REMARK`）
- 检索字段（来源：`PMS-TEST-CORE-AFS-FILTER-SEARCHFIELD`）
- 状态候选（来源：`PMS-TEST-CORE-AFS-FILTER-STATUS`）
- 收件人多选（来源：`PMS-TEST-CORE-AFS-FILTER-RECIPIENT`）
- 买手多选（来源：`PMS-TEST-CORE-AFS-FILTER-BUYER`）
- 查询（来源：`PMS-TEST-CORE-AFS-QUERY`）
- 默认/重置（来源：`PMS-TEST-CORE-AFS-RESET`）
- 导出商品采购售后（来源：`PMS-TEST-CORE-AFS-EXPORT`）
- 来源采购单 GP2026-0004 链接（来源：`PMS-TEST-CORE-AFS-SOURCEORDER`）
- 同意退货/完善退货信息/完成售后等条件操作（来源：`PMS-TEST-CORE-AFS-CONDITIONAL`）
- 多选筛选弹出层 全选（来源：`PMS-TEST-CORE-AFS-FILTER-SUB-ALL`）
- 多选筛选弹出层 清空（来源：`PMS-TEST-CORE-AFS-FILTER-SUB-CLEAR`）
- 分页跳转确定（可见控件）（来源：`PMS-TEST-CORE-AFS-PAGINATION-LOCAL`）
- 确定（最终提交）（来源：`PMS-TEST-CORE-AFS-START-FINAL-1-32cf35`；另有 3 条观察或分支）
- aftersales-subaction-resume-state（来源：`PMS-TEST-ROOT-SUP-b37fef51d59b`）
- aftersales-filter-recipient-all（来源：`PMS-TEST-ROOT-SUP-686264d086e0`）
- aftersales-filter-recipient-clear（来源：`PMS-TEST-ROOT-SUP-6825cd5f8fa7`）
- aftersales-filter-buyer-all（来源：`PMS-TEST-ROOT-SUP-e99012964924`）
- aftersales-filter-buyer-clear（来源：`PMS-TEST-ROOT-SUP-68c2ddfecf46`）
- aftersales-page-size10-settled（来源：`PMS-TEST-ROOT-SUP-dc9fe4daebce`）
- aftersales-jump-first-page（来源：`PMS-TEST-ROOT-SUP-540f2a4093b7`）

### 商品供应商管理

- 页面进入（来源：`PMS-TEST-BASIC-SUP-ENTER`）
- 查询（来源：`PMS-TEST-BASIC-SUP-QUERY`）
- 清除/重置/清空查询（来源：`PMS-TEST-BASIC-SUP-RESET`）
- 每页条数（来源：`PMS-TEST-BASIC-SUP-SIZE`）
- 输入页码并确定跳转（来源：`PMS-TEST-BASIC-SUP-JUMP`）
- 新增供应商（来源：`PMS-TEST-BASIC-SUP-NEW`）
- 新增表单取消（来源：`PMS-TEST-BASIC-SUP-NEW-CANCEL`）
- 保存草稿（来源：`PMS-TEST-BASIC-SUP-DRAFT`）
- 保存并启用（来源：`PMS-TEST-BASIC-SUP-NEW-ENABLE`）
- 查看（来源：`PMS-TEST-BASIC-SUP-VIEW`）
- 详情关闭按钮（来源：`PMS-TEST-BASIC-SUP-VIEW-CLOSE`）
- 详情外层关闭图标（来源：`PMS-TEST-BASIC-SUP-VIEW-CLOSE-ICON`）
- 编辑（来源：`PMS-TEST-BASIC-SUP-EDIT`）
- 编辑保存（来源：`PMS-TEST-BASIC-SUP-EDIT-SAVE`）
- 编辑外层关闭图标（来源：`PMS-TEST-BASIC-SUP-EDIT-CLOSE`）
- 停用（来源：`PMS-TEST-BASIC-SUP-DISABLE`）
- 审核/启用/驳回等条件分支（来源：`PMS-TEST-BASIC-SUP-STATE-SAMPLES`）

### 供应商供货档案

- 页面进入（来源：`PMS-TEST-BASIC-SSA-ENTER`）
- 查询（来源：`PMS-TEST-BASIC-SSA-QUERY`）
- 清除/重置/清空查询（来源：`PMS-TEST-BASIC-SSA-RESET`）
- 每页条数（来源：`PMS-TEST-BASIC-SSA-SIZE`）
- 输入页码并确定跳转（来源：`PMS-TEST-BASIC-SSA-JUMP`）
- 新增供货档案（来源：`PMS-TEST-BASIC-SSA-NEW`）
- 查看供货档案（来源：`PMS-TEST-BASIC-SSA-VIEW`）
- 供应商名称链接（来源：`PMS-TEST-BASIC-SSA-SUPPLIER-LINK`）
- 编辑供货档案（来源：`PMS-TEST-BASIC-SSA-EDIT`）
- 新增选择头程物流商（来源：`PMS-TEST-BASIC-SSA-NEW-PROVIDER`）
- SPU/SKU字段命名（来源：`PMS-TEST-BASIC-SSA-SPU-SKU-LABEL`）
- 外层关闭图标（来源：`PMS-TEST-BASIC-SSA-NEW-CLOSE`；另有 3 条观察或分支）
- 保存（来源：`PMS-TEST-BASIC-SSA-NEW-SAVE`；另有 1 条观察或分支）
- 复制（来源：`PMS-TEST-BASIC-SSA-COPY`）
- 停用（来源：`PMS-TEST-BASIC-SSA-DISABLE`）
- 导入（来源：`PMS-TEST-BASIC-SSA-IMPORT`）
- 下载导入模板（来源：`PMS-TEST-BASIC-SSA-IMPORT-TEMPLATE`）
- 上传xls/xlsx（来源：`PMS-TEST-BASIC-SSA-IMPORT-UPLOAD`）
- 清空导入预览（来源：`PMS-TEST-BASIC-SSA-IMPORT-CLEAR`）
- 确认导入（来源：`PMS-TEST-BASIC-SSA-IMPORT-COMMIT`）
- 导出（来源：`PMS-TEST-BASIC-SSA-EXPORT`）

### 头程物流商管理

- 页面进入（来源：`PMS-TEST-BASIC-FLP-ENTER`）
- 查询（来源：`PMS-TEST-BASIC-FLP-QUERY`）
- 清除/重置/清空查询（来源：`PMS-TEST-BASIC-FLP-RESET`）
- 新增物流商（主按钮）（来源：`PMS-TEST-BASIC-FLP-NEW-PROVIDER`）
- 新增物流商（侧栏+新增）（来源：`PMS-TEST-BASIC-FLP-NEW-PROVIDER-SIDEBAR`）
- 查看物流商（来源：`PMS-TEST-BASIC-FLP-VIEW-PROVIDER`）
- 编辑物流商（来源：`PMS-TEST-BASIC-FLP-EDIT-PROVIDER`）
- 新建渠道（来源：`PMS-TEST-BASIC-FLP-NEW-CHANNEL`）
- 完整查看渠道（来源：`PMS-TEST-BASIC-FLP-VIEW-CHANNEL`）
- 编辑渠道（来源：`PMS-TEST-BASIC-FLP-EDIT-CHANNEL`）
- 物流商保存（来源：`PMS-TEST-BASIC-FLP-PROVIDER-SAVE`）
- 渠道保存（来源：`PMS-TEST-BASIC-FLP-CHANNEL-SAVE`）
- 新建渠道取消（来源：`PMS-TEST-BASIC-FLP-CHANNEL-CANCEL`）
- 详情/编辑/新增外层关闭图标（来源：`PMS-TEST-BASIC-FLP-CLOSE-ICONS`）
- 切换物流商卡片（来源：`PMS-TEST-BASIC-FLP-PROVIDER-SELECT`）
- 选择渠道卡片（来源：`PMS-TEST-BASIC-FLP-CHANNEL-SELECT`）
- 渠道运输方式候选（来源：`PMS-TEST-BASIC-FLP-MODE-OPTIONS`）
- 现有时效区间（来源：`PMS-TEST-BASIC-FLP-DATA-RANGE`）
- 物流商停用（来源：`PMS-TEST-BASIC-FLP-PROVIDER-DISABLE`）
- 渠道停用（来源：`PMS-TEST-BASIC-FLP-CHANNEL-DISABLE`）

### 面辅料供应商确认单

- 查询（来源：`PMS-OPS-001`）
- 重置（来源：`PMS-OPS-002`）
- 查看确认单（来源：`PMS-OPS-003`）
- 编辑确认单（来源：`PMS-OPS-004`）
- 操作日志（来源：`PMS-OPS-005`）
- 导出（来源：`PMS-OPS-006`）
- 批量打印标签空选（来源：`PMS-OPS-007`）
- 每页条数（来源：`PMS-OPS-008`）
- 跳转页码（来源：`PMS-OPS-009`）
- 同步采购单（来源：`PMS-OPS-010`）
- 生成卷号（来源：`PMS-OPS-011`）
- 保存草稿（来源：`PMS-OPS-012`）
- 保存并确认（来源：`PMS-OPS-013`）
- 供应商确认（来源：`PMS-OPS-014`）
- 单条打印标签（来源：`PMS-OPS-015`）
- 已选批量打印标签（来源：`PMS-OPS-016`）

### 头程物流

- 添加货运批次（来源：`PMS-OPS-017`）
- 货运类型选择（来源：`PMS-OPS-018`）
- 预计送达日期编辑（来源：`PMS-OPS-019`）
- 编辑物流费用（来源：`PMS-OPS-020`）
- 费用重置（来源：`PMS-OPS-021`）
- 修改空批次（来源：`PMS-OPS-022`）
- 交货表单（来源：`PMS-OPS-023`）
- 详情（来源：`PMS-OPS-024`）
- 新增货箱（来源：`PMS-OPS-025`）
- 货箱类型选择（来源：`PMS-OPS-026`）
- 换箱号（来源：`PMS-OPS-027`）
- 换批次（来源：`PMS-OPS-028`）
- 一键编辑长宽高（来源：`PMS-OPS-029`）
- 货箱编辑（来源：`PMS-OPS-030`）
- 物料换箱（来源：`PMS-OPS-031`）
- 展开全部（来源：`PMS-OPS-032`）
- 标识关键字添加（来源：`PMS-OPS-033`）
- 导入面辅料（来源：`PMS-OPS-034`）
- 货箱条码（来源：`PMS-OPS-035`）
- 导出明细（来源：`PMS-OPS-036`）
- 导出装箱单（来源：`PMS-OPS-037`）
- 导出装箱单明细（来源：`PMS-OPS-038`）
- 本土做货数量确认导出（来源：`PMS-OPS-039`）
- 成衣商品明细导出（来源：`PMS-OPS-040`）
- 导入测款确认（来源：`PMS-OPS-041`）
- 封箱确认（来源：`PMS-OPS-042`）
- 删除货箱确认（来源：`PMS-OPS-043`）
- 搜索（来源：`PMS-OPS-044`）
- 重置（来源：`PMS-OPS-045`）
- 每页条数（来源：`PMS-OPS-046`）
- 跳转页码（来源：`PMS-OPS-047`）
- 重量双击编辑（来源：`PMS-OPS-048`）
- 更新汇总（来源：`PMS-OPS-049`）
- 同步货箱（来源：`PMS-OPS-050`）
- 保存备注（来源：`PMS-OPS-051`）
- 确认交货（来源：`PMS-OPS-052`）
- 立即提交货箱（来源：`PMS-OPS-053`）
- 一键提交长宽高（来源：`PMS-OPS-054`）
- 确定重量（来源：`PMS-OPS-055`）
- 确定关键字（来源：`PMS-OPS-056`）
- 确认封箱（来源：`PMS-OPS-057`）
- 确认删除货箱（来源：`PMS-OPS-058`）
- 确认导入测款（来源：`PMS-OPS-059`）
- 上传面辅料文件（来源：`PMS-OPS-060`）
- 已交货/发运/到港/入库状态分支（来源：`PMS-OPS-061`）

### 原料仓库存查询

- SKU搜索（来源：`PMS-OPS-062`）
- 清除（来源：`PMS-OPS-063`）
- 第二页（来源：`PMS-OPS-064`）
- 每页条数（来源：`PMS-OPS-065`）
- 跳转页码（来源：`PMS-OPS-066`）
- 日志明细（来源：`PMS-OPS-067`）
- 在仓数量条码明细（来源：`PMS-OPS-068`）
- 最新盘点单（来源：`PMS-OPS-069`）
- 原料图片放大（来源：`PMS-OPS-070`）
- 排序与仓库筛选选项（来源：`PMS-OPS-071`）
- 独立打开候选（来源：`PMS-TEST-FILTER-FINAL-INV-WAREHOUSE-OPEN`；另有 1 条观察或分支）
- 选择候选（来源：`PMS-TEST-FILTER-FINAL-INV-WAREHOUSE-SELECT`；另有 1 条观察或分支）
- 执行只读查询（来源：`PMS-TEST-FILTER-FINAL-INV-WAREHOUSE-QUERY`；另有 1 条观察或分支）
- 重置查询（来源：`PMS-TEST-FILTER-FINAL-INV-WAREHOUSE-RESET`；另有 1 条观察或分支）

### 面辅料采购请款

- 新增请款单（来源：`PMS-OPS-072`）
- 查看（来源：`PMS-OPS-073`）
- 编辑已申请请款（来源：`PMS-OPS-074`）
- 申请付款（来源：`PMS-OPS-075`）
- 部分付款选择（来源：`PMS-OPS-076`）
- 付款记录（来源：`PMS-OPS-077`）
- 请款记录（来源：`PMS-OPS-078`）
- 操作日志（来源：`PMS-OPS-079`）
- 无结果查询（来源：`PMS-OPS-080`）
- 重置（来源：`PMS-OPS-081`）
- 导出（来源：`PMS-OPS-082`）
- 每页条数（来源：`PMS-OPS-083`）
- 跳转页码（来源：`PMS-OPS-084`）
- 已完成申请付款（来源：`PMS-OPS-085`）
- 附件预览（来源：`PMS-OPS-086`）
- 确认创建请款单（来源：`PMS-OPS-087`）
- 保存编辑（来源：`PMS-OPS-088`）
- 确认申请付款（来源：`PMS-OPS-089`）
- 继续上传附件（来源：`PMS-OPS-090`）

### 物流费用请款

- 新建请款单（来源：`PMS-OPS-091`）
- 查看（来源：`PMS-OPS-092`）
- 编辑未请款（来源：`PMS-OPS-093`）
- 编辑已申请请款（来源：`PMS-OPS-094`）
- 申请付款（来源：`PMS-OPS-095`）
- 部分付款选择（来源：`PMS-OPS-096`）
- 付款记录（来源：`PMS-OPS-097`）
- 请款记录（来源：`PMS-OPS-098`）
- 操作日志（来源：`PMS-OPS-099`）
- 状态查询（来源：`PMS-OPS-100`）
- 重置（来源：`PMS-OPS-101`）
- 导出（来源：`PMS-OPS-102`）
- 每页条数（来源：`PMS-OPS-103`）
- 跳转页码（来源：`PMS-OPS-104`）
- 确认创建请款单（来源：`PMS-OPS-105`）
- 保存编辑（来源：`PMS-OPS-106`）
- 确认申请付款（来源：`PMS-OPS-107`）
- 继续上传附件（来源：`PMS-OPS-108`）

### KOL库存

- 批量锁定表单（来源：`PMS-OPS-109`）
- 锁定查询SKU（来源：`PMS-OPS-110`）
- 按比例填充（来源：`PMS-OPS-111`）
- 勾选项清零（来源：`PMS-OPS-112`）
- 批量释放空选（来源：`PMS-OPS-113`）
- 生成链接空选（来源：`PMS-OPS-114`）
- 查询（来源：`PMS-OPS-115`）
- 重置（来源：`PMS-OPS-116`）
- 单条锁定修改（来源：`PMS-OPS-117`）
- 确认锁定（来源：`PMS-OPS-118`）
- 已选释放（来源：`PMS-OPS-119`）
- 已选生成链接（来源：`PMS-OPS-120`）

### 手动寄样申请

- 状态查询（来源：`PMS-OPS-121`）
- 重置（来源：`PMS-OPS-122`）
- 查看申请（来源：`PMS-OPS-123`）
- 通过审核（来源：`PMS-OPS-124`）
- 驳回（来源：`PMS-OPS-125`）
- 关联借出单（来源：`PMS-OPS-126`）

### 对外样品池链接

- 状态查询（来源：`PMS-OPS-127`）
- 重置（来源：`PMS-OPS-128`）
- 外部链接访问（来源：`PMS-OPS-129`）
- 复制链接（来源：`PMS-OPS-130`）
- 修改链接（来源：`PMS-OPS-131`）
- 作废链接（来源：`PMS-OPS-132`）
- 关联申请（来源：`PMS-OPS-133`）

### 锁定操作记录

- 查询（来源：`PMS-OPS-134`）
- 重置（来源：`PMS-OPS-135`）
- 操作类型及关联申请查询（来源：`PMS-OPS-136`）
- 独立打开候选（来源：`PMS-TEST-FILTER-FINAL-KLG-ACTION-OPEN`）
- 选择候选（来源：`PMS-TEST-FILTER-FINAL-KLG-ACTION-SELECT`）
- 执行只读查询（来源：`PMS-TEST-FILTER-FINAL-KLG-ACTION-QUERY`）
- 重置查询（来源：`PMS-TEST-FILTER-FINAL-KLG-ACTION-RESET`）

### 面辅料需求分析

- 列表（来源：`PMS-TEST-OPS-MATERIAL-REC-0001`）
- 查看详情（来源：`PMS-TEST-OPS-MATERIAL-REC-0002`）
- 编辑（来源：`PMS-TEST-OPS-MATERIAL-REC-0003`）
- 需求数量点击后（来源：`PMS-TEST-OPS-MATERIAL-REC-0004`）
- 设置采购员（来源：`PMS-TEST-OPS-MATERIAL-REC-0005`）
- 1个SKU（来源：`PMS-TEST-OPS-MATERIAL-REC-0006`）
- 替换面辅料（来源：`PMS-TEST-OPS-MATERIAL-REC-0007`）
- 设置印花染色（来源：`PMS-TEST-OPS-MATERIAL-REC-0008`）
- 印染工艺选项（来源：`PMS-TEST-OPS-MATERIAL-REC-0009`）
- 印染工厂选项（来源：`PMS-TEST-OPS-MATERIAL-REC-0010`）
- 创建面辅料采购单（来源：`PMS-TEST-OPS-MATERIAL-REC-0011`）
- 创建采购区域CN（来源：`PMS-TEST-OPS-MATERIAL-REC-0012`）
- 创建采购重置（来源：`PMS-TEST-OPS-MATERIAL-REC-0013`）
- 采购备注（来源：`PMS-TEST-OPS-MATERIAL-REC-0014`）
- 关联面辅料采购单（来源：`PMS-TEST-OPS-MATERIAL-REC-0015`）
- 驳回（来源：`PMS-TEST-OPS-MATERIAL-REC-0016`）
- 设置面料供应商（来源：`PMS-TEST-OPS-MATERIAL-REC-0017`）
- 批量设置采购员空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0018`）
- 批量驳回空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0019`）
- 批量备注空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0020`）
- 批量确认实际采购价空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0021`）
- 批量创建面辅料采购单空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0022`）
- 批量关联面辅料采购单空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0023`）
- 单需求选中（来源：`PMS-TEST-OPS-MATERIAL-REC-0024`）
- 批量设置采购员（来源：`PMS-TEST-OPS-MATERIAL-REC-0025`）
- 批量备注（来源：`PMS-TEST-OPS-MATERIAL-REC-0026`）
- 批量关联面辅料采购单（来源：`PMS-TEST-OPS-MATERIAL-REC-0027`）
- 批量创建选中实际（来源：`PMS-TEST-OPS-MATERIAL-REC-0028`）
- 批量驳回（来源：`PMS-TEST-OPS-MATERIAL-REC-0029`）
- 面料采购内容（来源：`PMS-TEST-OPS-MATERIAL-REC-0030`）
- 面料SPU查询（来源：`PMS-TEST-OPS-MATERIAL-REC-0031`）
- 面料查询当前（来源：`PMS-TEST-OPS-MATERIAL-REC-0032`）
- 原料采购（来源：`PMS-TEST-OPS-MATERIAL-REC-0033`；另有 1 条观察或分支）
- 原料采购实际（来源：`PMS-TEST-OPS-MATERIAL-REC-0034`）
- 物料采购（来源：`PMS-TEST-OPS-MATERIAL-REC-0035`；另有 1 条观察或分支）
- 物料采购实际（来源：`PMS-TEST-OPS-MATERIAL-REC-0036`）
- 辅料采购（来源：`PMS-TEST-OPS-MATERIAL-REC-0037`）
- 辅料采购实际（来源：`PMS-TEST-OPS-MATERIAL-REC-0038`）
- 辅料查款结果（来源：`PMS-TEST-OPS-MATERIAL-REC-0039`）
- 辅料FLSZ24547查询（来源：`PMS-TEST-OPS-MATERIAL-REC-0040`）
- 辅料完整表单（来源：`PMS-TEST-OPS-MATERIAL-REC-0041`）
- 辅料补采使用类型（来源：`PMS-TEST-OPS-MATERIAL-REC-0042`）
- 辅料备货使用类型（来源：`PMS-TEST-OPS-MATERIAL-REC-0043`）
- 辅料表单重置（来源：`PMS-TEST-OPS-MATERIAL-REC-0044`）
- 面料采购（来源：`PMS-TEST-OPS-MATERIAL-REC-0045`）
- 面料完整表单（来源：`PMS-TEST-OPS-MATERIAL-REC-0046`）
- 面料补采分支（来源：`PMS-TEST-OPS-MATERIAL-REC-0047`）
- 原料查款请求（来源：`PMS-TEST-OPS-MATERIAL-REC-0049`）
- 原料查款响应（来源：`PMS-TEST-OPS-MATERIAL-REC-0050`）
- 物料完整表单（来源：`PMS-TEST-OPS-MATERIAL-REC-0052`）
- 运单批量入库实际（来源：`PMS-TEST-OPS-MATERIAL-REC-0053`）
- 运单入库查款（来源：`PMS-TEST-OPS-MATERIAL-REC-0054`）
- 运单查询响应（来源：`PMS-TEST-OPS-MATERIAL-REC-0055`）
- 批量填写物流单号（来源：`PMS-TEST-OPS-MATERIAL-REC-0056`；另有 1 条观察或分支）
- 批量设置印花染色（来源：`PMS-TEST-OPS-MATERIAL-REC-0057`；另有 1 条观察或分支）
- 批量物流选中实际（来源：`PMS-TEST-OPS-MATERIAL-REC-0058`）
- 已关联批量物流（来源：`PMS-TEST-OPS-MATERIAL-REC-0060`）
- 上传入库文件选择（来源：`PMS-TEST-OPS-MATERIAL-REC-0062`）
- 实际采购数量上传文件选择（来源：`PMS-TEST-OPS-MATERIAL-REC-0063`）
- 导出采购单（来源：`PMS-TEST-OPS-MATERIAL-REC-0064`）
- 状态-等待采购（来源：`PMS-TEST-OPS-MATERIAL-REC-0065`）
- 状态-采购驳回（来源：`PMS-TEST-OPS-MATERIAL-REC-0066`）
- 状态-采购中（来源：`PMS-TEST-OPS-MATERIAL-REC-0067`）
- 状态-全部入库（来源：`PMS-TEST-OPS-MATERIAL-REC-0068`）
- 状态-部分入库（来源：`PMS-TEST-OPS-MATERIAL-REC-0069`）
- 状态-待审核（来源：`PMS-TEST-OPS-MATERIAL-REC-0070`）
- 状态-审核驳回（来源：`PMS-TEST-OPS-MATERIAL-REC-0071`）
- 状态-合并已删除（来源：`PMS-TEST-OPS-MATERIAL-REC-0072`）
- 默认重置（来源：`PMS-TEST-OPS-MATERIAL-REC-0073`）
- 每页条数20（来源：`PMS-TEST-OPS-MATERIAL-REC-0074`）
- 跳转第1页（来源：`PMS-TEST-OPS-MATERIAL-REC-0075`）
- 物料图片放大（来源：`PMS-TEST-OPS-MATERIAL-REC-0076`）
- 图片放大缩放（来源：`PMS-TEST-OPS-MATERIAL-REC-0077`）
- 图片Esc关闭（来源：`PMS-TEST-OPS-MATERIAL-REC-0078`）
- 图片键盘Esc（来源：`PMS-TEST-OPS-MATERIAL-REC-0079`）
- 关联采购单链接（来源：`PMS-TEST-OPS-MATERIAL-REC-0080`）
- 关联MPO列表实际（来源：`PMS-TEST-OPS-MATERIAL-REC-0081`）
- 刷新需求/已选确认实际价/所有最终确定或添加（来源：`PMS-TEST-OPS-MATERIAL-REC-0082`）
- demand-gap-entry（来源：`PMS-TEST-TAIL-MRQ-5b91563dd5`）
- demand-native-filter-0-检索字段（来源：`PMS-TEST-TAIL-MRQ-b84f47317b`）
- demand-native-filter-2-商品类型（来源：`PMS-TEST-TAIL-MRQ-3e4df6b625`）
- demand-native-filter-3-是否有ID面辅料采购单（来源：`PMS-TEST-TAIL-MRQ-8c94faf0ef`）
- demand-native-filter-4-是否KOL样品小单（来源：`PMS-TEST-TAIL-MRQ-a425a87bd1`）
- demand-native-filter-5-是否首单（来源：`PMS-TEST-TAIL-MRQ-daa75254db`）
- demand-region-ID-selected（来源：`PMS-TEST-TAIL-MRQ-0d93146c4f`）
- demand-region-ID-CN-selected（来源：`PMS-TEST-TAIL-MRQ-9875f0c69c`）
- demand-region-CN-selected（来源：`PMS-TEST-TAIL-MRQ-757bdce040`）
- demand-region-cleared（来源：`PMS-TEST-TAIL-MRQ-2399e5a32a`）
- demand-date-dateStart（来源：`PMS-TEST-TAIL-MRQ-61bbe365a6`）
- demand-date-dateEnd（来源：`PMS-TEST-TAIL-MRQ-c0e7f7556a`）
- demand-date-purchaseStart（来源：`PMS-TEST-TAIL-MRQ-db23d08468`）
- demand-date-purchaseEnd（来源：`PMS-TEST-TAIL-MRQ-9084ff3c35`）
- demand-date-all-cleared（来源：`PMS-TEST-TAIL-MRQ-d4baa809a4`）
- demand-query-known-spu（来源：`PMS-TEST-TAIL-MRQ-00f1033c67`）
- demand-query-no-match（来源：`PMS-TEST-TAIL-MRQ-5335b06912`）
- demand-default-reset-result（来源：`PMS-TEST-TAIL-MRQ-3101a0dbf3`）

### 面辅料采购单

- 设置重量（来源：`PMS-TEST-OPS-MATERIAL-REC-0083`）
- 设置重量实际（来源：`PMS-TEST-OPS-MATERIAL-REC-0084`）
- 编辑体积实际（来源：`PMS-TEST-OPS-MATERIAL-REC-0085`）
- 编辑（来源：`PMS-TEST-OPS-MATERIAL-REC-0086`；另有 1 条观察或分支）
- CN（来源：`PMS-TEST-OPS-MATERIAL-REC-0088`）
- 采购数量链接实际（来源：`PMS-TEST-OPS-MATERIAL-REC-0089`）
- 详情添加快递（来源：`PMS-TEST-OPS-MATERIAL-REC-0090`）
- 详情快递实际表单（来源：`PMS-TEST-OPS-MATERIAL-REC-0091`）
- 设置采购员（来源：`PMS-TEST-OPS-MATERIAL-REC-0092`）
- 设置面料供应商（来源：`PMS-TEST-OPS-MATERIAL-REC-0093`）
- 设置裁片工厂（来源：`PMS-TEST-OPS-MATERIAL-REC-0094`）
- 设置印花工厂（来源：`PMS-TEST-OPS-MATERIAL-REC-0095`）
- 已下单（来源：`PMS-TEST-OPS-MATERIAL-REC-0096`）
- 未确认（来源：`PMS-TEST-OPS-MATERIAL-REC-0097`）
- 部分商家到货（来源：`PMS-TEST-OPS-MATERIAL-REC-0098`）
- 补采原因（来源：`PMS-TEST-OPS-MATERIAL-REC-0099`）
- 修改实际采购价（来源：`PMS-TEST-OPS-MATERIAL-REC-0100`）
- 设置染色费用（来源：`PMS-TEST-OPS-MATERIAL-REC-0101`）
- 采购备注（来源：`PMS-TEST-OPS-MATERIAL-REC-0102`）
- 日志记录（来源：`PMS-TEST-OPS-MATERIAL-REC-0103`）
- 确认实际价实际（来源：`PMS-TEST-OPS-MATERIAL-REC-0104`）
- 复制采购单（来源：`PMS-TEST-OPS-MATERIAL-REC-0105`）
- 转原料（来源：`PMS-TEST-OPS-MATERIAL-REC-0106`）
- 打印条码（来源：`PMS-TEST-OPS-MATERIAL-REC-0107`）
- 导入细码（来源：`PMS-TEST-OPS-MATERIAL-REC-0108`）
- 上传物流凭证（来源：`PMS-TEST-OPS-MATERIAL-REC-0109`）
- 采购单抽检（来源：`PMS-TEST-OPS-MATERIAL-REC-0110`）
- 抽检-部分合格（来源：`PMS-TEST-OPS-MATERIAL-REC-0111`）
- 瑕疵布料处理（来源：`PMS-TEST-OPS-MATERIAL-REC-0112`）
- 瑕疵布料处理-入瑕疵品仓（来源：`PMS-TEST-OPS-MATERIAL-REC-0113`）
- 查看详情（来源：`PMS-TEST-OPS-MATERIAL-REC-0114`）
- 驳回（来源：`PMS-TEST-OPS-MATERIAL-REC-0115`）
- 面辅料（来源：`PMS-TEST-OPS-MATERIAL-REC-0116`）
- 物流渠道-展开（来源：`PMS-TEST-OPS-MATERIAL-REC-0117`）
- 面料添加快递信息（来源：`PMS-TEST-OPS-MATERIAL-REC-0118`）
- 物流渠道-收起（来源：`PMS-TEST-OPS-MATERIAL-REC-0119`）
- 批量设置采购员-空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0120`）
- 批量驳回-空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0121`）
- 批量添加快递-空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0122`）
- 批量补录快递-空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0123`）
- 批量确认实际采购价-空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0124`）
- 批量采购备注-空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0125`）
- 批量设置采购区域-空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0126`）
- 批量设置为已下单-空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0127`）
- 批量设置面辅料供应商-空选（来源：`PMS-TEST-OPS-MATERIAL-REC-0128`）
- 勾选采购单7822（来源：`PMS-TEST-OPS-MATERIAL-REC-0129`）
- 批量设置采购员（来源：`PMS-TEST-OPS-MATERIAL-REC-0130`）
- 批量设置采购员-真实表单（来源：`PMS-TEST-OPS-MATERIAL-REC-0131`）
- 批量驳回（来源：`PMS-TEST-OPS-MATERIAL-REC-0132`）
- 批量添加快递（来源：`PMS-TEST-OPS-MATERIAL-REC-0133`）
- 批量补录快递（来源：`PMS-TEST-OPS-MATERIAL-REC-0134`）
- 批量确认实际采购价（来源：`PMS-TEST-OPS-MATERIAL-REC-0135`）
- 批量采购备注（来源：`PMS-TEST-OPS-MATERIAL-REC-0136`）
- 批量设置采购区域（来源：`PMS-TEST-OPS-MATERIAL-REC-0137`）
- 批量设置为已下单（来源：`PMS-TEST-OPS-MATERIAL-REC-0138`）
- 批量设置面辅料供应商（来源：`PMS-TEST-OPS-MATERIAL-REC-0139`）
- 运单批量入库（来源：`PMS-TEST-OPS-MATERIAL-REC-0140`）
- 修改物流信息（来源：`PMS-TEST-OPS-MATERIAL-REC-0141`）
- 导入快递信息（来源：`PMS-TEST-OPS-MATERIAL-REC-0142`）
- 取消勾选（来源：`PMS-TEST-OPS-MATERIAL-REC-0143`）
- material-orders-列表.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-d551a4084d`）
- material-orders-导入快递信息.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-6f6e0bf849`；另有 1 条观察或分支）
- material-orders-下载快递信息导入模板.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-3475377cc1`）
- material-orders-快递导入-清空.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-509b33d2bf`）
- material-orders-快递导入-选择文件.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-2bb0879af3`）
- material-orders- 面料采购.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-f06e397d41`）
- material-orders- 面料采购-有效SPU.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-6bfc5f6313`）
- material-orders- 物料采购.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-d3d6e6c752`）
- material-orders- 物料采购-有效SPU.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-a30e564b1a`）
- material-orders- 辅料采购.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-889220040b`）
- material-orders- 辅料采购-有效SPU.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-24357d2ddb`）
- material-orders-打印采购详情-入口.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-a1b58bd8ba`）
- download-import-template-native.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-f8ea2d2320`）
- print-purchase-7822-native.txt（来源：`PMS-TEST-OPS-MATERIAL-LATE-f34b89c228`）
- mpo-gap-start（来源：`PMS-TEST-TAIL-MPO-fa4ec3e329`）
- mpo-filter-purchase-type（来源：`PMS-TEST-TAIL-MPO-8d1947f4f7`）
- mpo-filter-type-select-all（来源：`PMS-TEST-TAIL-MPO-870257fd0c`）
- mpo-filter-type-clear-all（来源：`PMS-TEST-TAIL-MPO-6a6419e4f3`）
- mpo-filter-status-options（来源：`PMS-TEST-TAIL-MPO-f0ff4aff47`）
- mpo-filter-status-pending-selected（来源：`PMS-TEST-TAIL-MPO-c488b0c22c`）
- mpo-filter-usage-options（来源：`PMS-TEST-TAIL-MPO-bb6d4eefc7`）
- mpo-filter-usage-selected（来源：`PMS-TEST-TAIL-MPO-f199a419c0`）
- mpo-filter-multi-closed（来源：`PMS-TEST-TAIL-MPO-91c95c1632`）
- mpo-native-filter-0-检索字段（来源：`PMS-TEST-TAIL-MPO-3daf24e2e2`）
- mpo-native-filter-1-采购地区（来源：`PMS-TEST-TAIL-MPO-19bc6da3fa`）
- mpo-native-filter-2-是否有物流单号（来源：`PMS-TEST-TAIL-MPO-d95b2a0173`）
- mpo-native-filter-3-是否备货生产（来源：`PMS-TEST-TAIL-MPO-f4dfe2bf45`）
- mpo-native-filter-4-商家到货状态（来源：`PMS-TEST-TAIL-MPO-c1528124a6`）
- mpo-native-filter-5-下单状态（来源：`PMS-TEST-TAIL-MPO-3717a1c474`）
- mpo-native-filter-6-是否已确定成本价（来源：`PMS-TEST-TAIL-MPO-97e52f319e`）
- mpo-native-filter-7-排序（来源：`PMS-TEST-TAIL-MPO-f3c62ded0a`）
- mpo-filter-supplier-options（来源：`PMS-TEST-TAIL-MPO-cdce2bdf09`）
- mpo-filter-supplier-selected（来源：`PMS-TEST-TAIL-MPO-d3f8796b0c`）
- mpo-filter-buyer-options（来源：`PMS-TEST-TAIL-MPO-dc8e153691`）
- mpo-filter-buyer-none-selected（来源：`PMS-TEST-TAIL-MPO-1ec68d9960`）
- mpo-date-create-from（来源：`PMS-TEST-TAIL-MPO-a1c8e9719e`）
- mpo-date-create-now（来源：`PMS-TEST-TAIL-MPO-03564a1c64`）
- mpo-date-create-confirm（来源：`PMS-TEST-TAIL-MPO-3fb5c1cb28`）
- mpo-date-create-clear（来源：`PMS-TEST-TAIL-MPO-71af612cbc`）
- mpo-date-createTo（来源：`PMS-TEST-TAIL-MPO-9cf26d6a92`）
- mpo-date-inboundFrom（来源：`PMS-TEST-TAIL-MPO-6e852594c4`）
- mpo-date-inboundTo（来源：`PMS-TEST-TAIL-MPO-0a7530f4d3`）
- mpo-date-sellerPlaceOrderFrom（来源：`PMS-TEST-TAIL-MPO-3704db5727`）
- mpo-date-sellerPlaceOrderTo（来源：`PMS-TEST-TAIL-MPO-3ac0abc89d`）
- mpo-date-signFrom（来源：`PMS-TEST-TAIL-MPO-b575ff9af3`）
- mpo-date-signTo（来源：`PMS-TEST-TAIL-MPO-eb379d8daa`）
- mpo-date-sellerShipFrom（来源：`PMS-TEST-TAIL-MPO-20eabeb51e`）
- mpo-date-sellerShipTo（来源：`PMS-TEST-TAIL-MPO-5fde7335bc`）
- mpo-date-transferFrom（来源：`PMS-TEST-TAIL-MPO-0db13b69dc`）
- mpo-date-transferTo（来源：`PMS-TEST-TAIL-MPO-639f4381e5`）
- mpo-date-warehouseFrom（来源：`PMS-TEST-TAIL-MPO-c2aaa3e3e7`）
- mpo-date-warehouseTo（来源：`PMS-TEST-TAIL-MPO-f4c1df0fae`）
- mpo-date-all-cleared（来源：`PMS-TEST-TAIL-MPO-d83d1cbc49`）
- mpo-query-7822-candidate-filters（来源：`PMS-TEST-TAIL-MPO-0bf57f246b`）
- mpo-inbound-quantity-7822-initial（来源：`PMS-TEST-TAIL-MPO-2b711f5086`）
- mpo-inbound-quantity-7822-ready（来源：`PMS-TEST-TAIL-MPO-43767a7df7`）
- mpo-inbound-detail-closed（来源：`PMS-TEST-TAIL-MPO-4ff47e8fc9`）
- mpo-spu-CNIDML076-click（来源：`PMS-TEST-TAIL-MPO-f032a55bf2`）
- mpo-spu-CNIDML076-direct-target（来源：`PMS-TEST-TAIL-MPO-81a41ccfdb`）
- mpo-export-order-details-click（来源：`PMS-TEST-TAIL-MPO-3250e839ef`）
- mpo-return-after-export-details（来源：`PMS-TEST-TAIL-MPO-42055794aa`）
- mpo-export-order-click（来源：`PMS-TEST-TAIL-MPO-557956d162`）
- mpo-export-settlement-click（来源：`PMS-TEST-TAIL-MPO-b83c5e8ae9`）
- mpo-export-raw-inbound-click（来源：`PMS-TEST-TAIL-MPO-45611171e6`）
- mpo-export-cycle-returned（来源：`PMS-TEST-TAIL-MPO-d2ef904505`）
- 打印明细→条码列表（来源：`PMS-TEST-TAIL-MPO-978eaec986`）
- mpo-print-details-readonly-query（来源：`PMS-TEST-TAIL-MPO-4cf8ca8296`）
- mpo-print-details-reset（来源：`PMS-TEST-TAIL-MPO-2b01498f61`）
- 打印明细→每页条数候选（来源：`PMS-TEST-TAIL-MPO-703e6841ea`）
- mpo-print-details-page-size-40（来源：`PMS-TEST-TAIL-MPO-7d6f437226`）
- mpo-print-details-create-date-from（来源：`PMS-TEST-TAIL-MPO-349762f782`）
- mpo-print-details-create-date-to（来源：`PMS-TEST-TAIL-MPO-519190d92c`）
- mpo-print-details-close-label-unavailable（来源：`PMS-TEST-TAIL-MPO-139d8bddeb`）
- mpo-print-details-closed（来源：`PMS-TEST-TAIL-MPO-8220b64057`）
- mpo-default-after-wait-timeout（来源：`PMS-TEST-TAIL-MPO-606c17ddda`）
- mpo-default-href-direct-result（来源：`PMS-TEST-TAIL-MPO-867d79087c`）
- 辅料预添加快递信息（来源：`PMS-TEST-TAIL-MPO-3b8ba12cd1`）
- mpo-accessory-pre-express-cancel（来源：`PMS-TEST-TAIL-MPO-57e6cadf7f`）
- mpo-pagination-size-10-result（来源：`PMS-TEST-TAIL-MPO-382534b0d4`）
- mpo-pagination-after-navigation-timeout（来源：`PMS-TEST-TAIL-MPO-499324d7f6`）
- mpo-pagination-size-10-normal-immediate（来源：`PMS-TEST-TAIL-MPO-80f051c007`）
- mpo-pagination-size-10-normal-settled（来源：`PMS-TEST-TAIL-MPO-f5c496fde0`）
- mpo-pagination-jump-2-result（来源：`PMS-TEST-TAIL-MPO-bce001c188`）
- mpo-pagination-previous-1（来源：`PMS-TEST-TAIL-MPO-55137d0e9b`）
- mpo-pagination-numeric-2（来源：`PMS-TEST-TAIL-MPO-2a0a89c00c`）
- mpo-pagination-numeric-1（来源：`PMS-TEST-TAIL-MPO-598aa4be8a`）
- 入库数量入口采购详情最终确定（来源：`PMS-TEST-TAIL-MPO-PLAN-SUBMIT`）
- 辅料预添加快递最终确定（来源：`PMS-TEST-TAIL-MPO-EXPRESS-SUBMIT`）
- 条码批量修改（来源：`PMS-TEST-TAIL-MPO-BARCODE-MODIFY`）
- 条码批量打印（来源：`PMS-TEST-TAIL-MPO-BARCODE-PRINT`）
- 补充条码（来源：`PMS-TEST-TAIL-MPO-BARCODE-SUPPLEMENT`）
- 批量删除（来源：`PMS-TEST-TAIL-MPO-BARCODE-DELETE`）
- 条码导入细码（来源：`PMS-TEST-TAIL-MPO-BARCODE-IMPORT`）
- 批量下架到待出库区（来源：`PMS-TEST-TAIL-MPO-BARCODE-OFFSHELF`）

### 面辅料采购跟踪

- material-tracking-list（来源：`PMS-TEST-ROOT-SUP-d30353397876`）
- material-tracking-批量签收-empty（来源：`PMS-TEST-ROOT-SUP-6417e72a13df`）
- material-tracking-批量转运-empty（来源：`PMS-TEST-ROOT-SUP-b820d9c0a10d`）
- material-tracking-copy-logistics-code（来源：`PMS-TEST-ROOT-SUP-48510352d616`）
- material-tracking-row-receive-initial（来源：`PMS-TEST-ROOT-SUP-a78ceb9cc46d`）
- material-tracking-row-receive-ready（来源：`PMS-TEST-ROOT-SUP-333ef66455fc`）
- material-tracking-receive-date-picker（来源：`PMS-TEST-ROOT-SUP-1baef435d1bf`）
- material-tracking-row-transfer-initial（来源：`PMS-TEST-ROOT-SUP-ef7faba002d0`）
- material-tracking-row-transfer-ready（来源：`PMS-TEST-ROOT-SUP-aaae749ce5b9`）
- material-tracking-transfer-batch-options（来源：`PMS-TEST-ROOT-SUP-fc5559e86f26`）
- material-tracking-original-box-mode（来源：`PMS-TEST-ROOT-SUP-f0e7a7334a4d`）
- material-tracking-transfer-reset（来源：`PMS-TEST-ROOT-SUP-31c5fe56d10a`）
- material-tracking-bulk-receive-selected-initial（来源：`PMS-TEST-ROOT-SUP-34aaeefe2c20`）
- material-tracking-bulk-receive-selected-ready（来源：`PMS-TEST-ROOT-SUP-caa25659b9b6`）
- material-tracking-bulk-transfer-selected-initial（来源：`PMS-TEST-ROOT-SUP-15079082d921`）
- material-tracking-bulk-transfer-selected-ready（来源：`PMS-TEST-ROOT-SUP-5325efb5fdea`）
- material-tracking-bulk-cancelled（来源：`PMS-TEST-ROOT-SUP-7b918ececec0`）
- material-tracking-channel-options（来源：`PMS-TEST-ROOT-SUP-ef428d6c8e0a`）
- material-tracking-date-start（来源：`PMS-TEST-ROOT-SUP-21813b2d95e7`）
- material-tracking-date-end（来源：`PMS-TEST-ROOT-SUP-4ac974239331`）
- material-tracking-query-limit10（来源：`PMS-TEST-ROOT-SUP-ad6273757790`）
- material-tracking-page2（来源：`PMS-TEST-ROOT-SUP-d80e66ce553a`）
- material-tracking-channel-popover-detail（来源：`PMS-TEST-ROOT-SUP-7731529186e8`）
- material-tracking-channel-search（来源：`PMS-TEST-ROOT-SUP-8299c154c3f2`）
- material-tracking-channel-selected（来源：`PMS-TEST-ROOT-SUP-c96fe3dcf544`）
- material-tracking-channel-search-clear（来源：`PMS-TEST-ROOT-SUP-865cf10ef5b1`）
- material-tracking-channel-select-all（来源：`PMS-TEST-ROOT-SUP-1a9c25250a73`）
- material-tracking-jump-page1（来源：`PMS-TEST-ROOT-SUP-b58d9a3d03b5`）
- material-tracking-status-pending-transfer（来源：`PMS-TEST-ROOT-SUP-bc8977907c87`）
- material-tracking-status-待签收（来源：`PMS-TEST-ROOT-SUP-627a14c0b307`）
- material-tracking-status-已转运（来源：`PMS-TEST-ROOT-SUP-ea57a0182750`）
- material-tracking-default-target-read（来源：`PMS-TEST-ROOT-SUP-7a5c86710334`）
- material-tracking-cleared-status-query（来源：`PMS-TEST-ROOT-SUP-cc70b08356c9`）
- material-tracking-source-order-link-click（来源：`PMS-TEST-ROOT-SUP-f53130b8ac8c`）
- material-tracking-linked-batch-click（来源：`PMS-TEST-ROOT-SUP-9301b86609b4`）
- 最终签收（来源：`PMS-TEST-ROOT-SUP-MTR-RECEIVE`）
- 最终转运（来源：`PMS-TEST-ROOT-SUP-MTR-TRANSFER`）

### 面辅料采购时效

- material-timeliness-list（来源：`PMS-TEST-ROOT-SUP-2e237766ccef`）
- material-timeliness-repeat-tab（来源：`PMS-TEST-ROOT-SUP-82c5b129cbb0`）
- material-timeliness-position-options（来源：`PMS-TEST-ROOT-SUP-e44abf522e6f`）
- material-timeliness-status-options（来源：`PMS-TEST-ROOT-SUP-3a2a67cbe1c7`）
- material-timeliness-date-start（来源：`PMS-TEST-ROOT-SUP-1299ef5cc117`）
- material-timeliness-date-end（来源：`PMS-TEST-ROOT-SUP-3c2c2a840b63`）
- material-timeliness-query-repeat（来源：`PMS-TEST-ROOT-SUP-11aa70d2cfb4`）
- material-timeliness-reset-repeat（来源：`PMS-TEST-ROOT-SUP-336ee3eabd04`）
- material-timeliness-first-tab（来源：`PMS-TEST-ROOT-SUP-63a5301e22bb`）
- material-timeliness-export-result（来源：`PMS-TEST-ROOT-SUP-6f09111033d4`）
- material-timeliness-export-readback（来源：`PMS-TEST-ROOT-SUP-66749bde25b9`）
- 行时间编辑（来源：`PMS-TEST-ROOT-SUP-MTI-TIMEEDIT`）

### 面辅料列表

- 面辅料列表完整移除菜单、路由、页面、处理器、对象、Mock、存储入口及当前工程消费者（来源：`PMS-RM-01`）

### 成衣列表

- 成衣列表完整移除菜单、路由、页面、处理器、对象、Mock、存储入口及当前工程消费者（来源：`PMS-RM-02`）

### 样衣列表

- 样衣列表完整移除菜单、路由、页面、处理器、对象、Mock、存储入口及当前工程消费者（来源：`PMS-RM-03`）

### 仓库管理

- 仓库管理完整移除菜单、路由、页面、处理器、对象、Mock、存储入口及当前工程消费者（来源：`PMS-RM-04`）

### 单位管理

- 单位管理完整移除菜单、路由、页面、处理器、对象、Mock、存储入口及当前工程消费者（来源：`PMS-RM-05`）

### BOM/样板管理

- BOM/样板管理完整移除菜单、路由、页面、处理器、对象、Mock、存储入口及当前工程消费者（来源：`PMS-RM-06`）

## 原始记录与逐项追踪

- [原子需求矩阵](requirements-matrix.json)
- [实施计划](implementation-plan.md)
- [inventory-test-core.json](inventory/inventory-test-core.json) · SHA256 `ccbe87bef69051d5b25a9d86f9d8abae0e0e214b7b75f1fb93deefc41b8eb359`
- [basic-test-inventory.json](inventory/basic-test-inventory.json) · SHA256 `7b6405974bb5c881a9343e8a078ae06035d3104e2d3fc88223d58c21f482eca7`
- [inventory-test-ops.json](inventory/inventory-test-ops.json) · SHA256 `7318c6215aea7b8df876a7e993c63a76e86d66677d5ac1ed539a9bb4f9bae0ca`
- [material-checkpoint-recovery.json](inventory/material-checkpoint-recovery.json) · SHA256 `02c294438a1ac51eb50855f8bd9fbf8e8905c2ae3bb97236186da36b52a1b935`
- [inventory-test-material-tail.json](inventory/inventory-test-material-tail.json) · SHA256 `1180c6b4ccb46ee71c03902046d935747aca2f37d60a26c29a6c556d38a32053`
- [inventory-test-root-supplement.json](inventory/inventory-test-root-supplement.json) · SHA256 `74738834005b872455afe07991241abc491ee5e604a4b53c46c95f3aae96b394`
- [inventory-test-filter-final.json](inventory/inventory-test-filter-final.json) · SHA256 `094b472982f0572bb5ab2e7a8c6ae78a98a958d69869ef68b2899430c6893062`
