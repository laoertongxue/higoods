# 采购测试核查冻结建议 · 21功能页 + 6对象完整删除

测试业务域：http://test_manage.higood.ai。原型引用版本 `ee14949905b08b260e9c6309eebc59bfa5b32764`，源码尚未实施。实际进入21个有效菜单页；6个对象按用户要求完整删除，历史证据保留，删除尚未实施。工程代码删除不授权清空浏览器用户数据。

现场业务证据上限 2026-10-13T10:56:39.996Z；素材对应metadata上限 2026-10-13T10:56:40.000Z；独立需求/MPO尾查上限 2026-10-13T10:48:54.916Z。正式环境记录只作production_history，误切PCS的dashboard不计采购核查。

可以冻结当前可用入口证据供实施。最终写入及潜在直接写入、无样本、源错误/占位和仅观察候选分开保留，不能称全部业务功能验证成功，也不能用页面进入代替逐项原型实施验收。

| 顺序 | 页面 | 现场覆盖与边界 | 原型路由 / 静态主行 | 对应清单 |
|---|---|---|---|---|
| 1 | 商品采购建议 | SPU/SKU展开收起、采购生成完整表单、是否做货确认、筛选/两类导出/每页10/跳1已有记录。<br>最终建采购单及是否做货确认未提交；导出客户端拦截或保存未完成，不能称成功。 | `/pms/purchase-suggestions` / 8条，1页 | [inventory-test-core.json](/tmp/higoods-pms-test-20261013/inventory-test-core.json) / [inventory-test-root-supplement.json](/tmp/higoods-pms-test-20261013/inventory-test-root-supplement.json) |
| 2 | KOL采购需求 | 新增SPU搜索校验与候选、需求编辑/入库/关联等实际表单与门禁；3组筛选全选/清空、每页10/跳1补充完成。<br>最终新增/保存/入库等未提交。两类导出进入已脱敏ThinkPHP错误页；申请数量30点击无可见层/新标签。 | `/pms/kol-demands` / 6条，1页 | [inventory-test-core.json](/tmp/higoods-pms-test-20261013/inventory-test-core.json) / [inventory-test-root-supplement.json](/tmp/higoods-pms-test-20261013/inventory-test-root-supplement.json) |
| 3 | 商品采购单 | 通用及5类新增SPU候选→10SKU载入、重新分配11草稿、完整编辑/售卖类型独立分支、详情与关联、批量空选/有选、筛选5组全选/清空及真实10条分页。<br>最终保存、审核、出入库、打印等未执行；状态21/22为已脱敏PDOException错误。候选合作商为空/个别待对接、无可见结果分别保留。 | `/pms/product-purchase-orders` / 12条，2页 | [inventory-test-core.json](/tmp/higoods-pms-test-20261013/inventory-test-core.json) / [inventory-test-root-supplement.json](/tmp/higoods-pms-test-20261013/inventory-test-root-supplement.json) |
| 4 | 备货列表 | 商品/SKU/销量双线图、分配10最终两SKU各5后取消、条件/统计/每页10/跳1、未标记493结果。<br>生成采购单最终未提交；标记备货潜在直写未点。原图片点击无大图/新标签；12款11有真实URL匹配，FADUU26070826未匹配。 | `/pms/reorder` / 12条，2页 | [inventory-test-core.json](/tmp/higoods-pms-test-20261013/inventory-test-core.json) / [inventory-test-root-supplement.json](/tmp/higoods-pms-test-20261013/inventory-test-root-supplement.json) |
| 5 | 商品采购售后 | 待处理1条的详情/编辑/处理、收件人及买手多选全选清空、两种关联查询方向分别记录、10条分页及跳1。<br>最终售后保存/处理未提交；其他状态无样本。GP4采购单关键字0条与order_id=4售后1条是不同查询方向。 | `/pms/product-purchase-order-aftersales` / 11条，2页 | [inventory-test-core.json](/tmp/higoods-pms-test-20261013/inventory-test-core.json) / [inventory-test-root-supplement.json](/tmp/higoods-pms-test-20261013/inventory-test-root-supplement.json) |
| 6 | 面辅料需求分析 | 原82条检查点含生成/关联/批量与物料展开；尾查补检索候选/区域多选/四日期/已知及无匹配查询/默认重置。<br>刷新需求、已选直接确认采购价等不能证明提交前边界，未执行；全部最终业务提交/上传未执行。3条是采购单分组，非3个需求明细。 | `/pms/material-requirements` / 3条，1页 | [material-checkpoint-recovery.json](/tmp/higoods-pms-test-ops-20261013/material/material-checkpoint-recovery.json) / [inventory-test-material-tail.json](/tmp/higoods-pms-test-material-tail-20261013/inventory-test-material-tail.json) |
| 7 | 面辅料采购单 | 原61条检查点及晚到表单保留；4导出/查询候选/日期/页大小10与跳页/入库数量→采购详情/辅料快递预添加/条码明细/SPU引用尾查完成。<br>4导出均ERR_BLOCKED_BY_CLIENT。7822打印明细为0条码列表，不能称PDF预览；最终条码写入/打印未执行。PCS引用CNIDML076目标空，跨模块未对接；清空及页大小早期失效与settled成功分别保留。 | `/pms/material-purchase-orders` / 8条，1页 | [material-checkpoint-recovery.json](/tmp/higoods-pms-test-ops-20261013/material/material-checkpoint-recovery.json) / [inventory-test-material-tail.json](/tmp/higoods-pms-test-material-tail-20261013/inventory-test-material-tail.json) |
| 8 | 面辅料采购跟踪 | 完整条件/渠道多选搜索全选清空、3状态、分页2/跳1、批量空选与有选、签收日期、原箱转运/目标批次/重置及采购7807/批次2关联详情。<br>最终签收/转运确定未提交。关联目标是详情引用，不增加菜单页数。 | `/pms/material-purchase-tracking` / 6条，1页 | [inventory-test-root-supplement.json](/tmp/higoods-pms-test-20261013/inventory-test-root-supplement.json) |
| 9 | 面辅料采购时效 | 首单/翻单两个Tab、状态/区域/日期/查询/重置及两次导出点击均取证，root已视读空表截图。<br>两个Tab均无数据，行时间编辑没有样本；5秒观察无下载回执，无属于该导出的SaveAs窗，不称导出成功。 | `/pms/fitting-timeliness` / 13条，2页 | [inventory-test-root-supplement.json](/tmp/higoods-pms-test-20261013/inventory-test-root-supplement.json) |
| 10 | 面辅料供应商确认单 | 1条未确认样本查看/完整编辑/操作日志、查询重置、空选打印门禁及10条/跳1。<br>同步采购单、生成卷号、最终保存/供应商确认、已选/单条打印可能写入，未执行。导出think\response\File::delete()错误。 | `/pms/material-supplier-confirmations` / 4条，1页 | [inventory-test-ops.json](/tmp/higoods-pms-test-ops-20261013/inventory-test-ops.json) |
| 11 | 头程物流 | 两条待交货、批次/交货/费用/日期/箱号/换批次/尺寸/重量/关键字/货箱/封箱删除确认/导入入口与五导出。<br>最终箱/批次/费用/交货/删除/上传未提交；其他交货后状态无样本。五导出无下载回执；换箱和货箱条码点击无可见目标。 | `/pms/first-leg-shipments` / 3条，1页 | [inventory-test-ops.json](/tmp/higoods-pms-test-ops-20261013/inventory-test-ops.json) |
| 12 | 原料仓库存查询 | SKU查询/清除跨仓储入口/页2/每页10/跳1，库存日志/在仓条码/盘点单和原料大图已有记录。<br>排序及仓库候选仅observed级证据，不证明每个筛选控件独立点击或所有组合；仓储引用详情不能扩大本次对象清理范围。 | `/pms/material-inventory` / 5条，1页 | [inventory-test-ops.json](/tmp/higoods-pms-test-ops-20261013/inventory-test-ops.json) |
| 13 | 面辅料采购请款 | 新增来源/查看/编辑/申请付款/部分付款币种/记录日志/已完成禁止再申请、无结果重置/10条跳1。<br>最终创建保存申请/附件上传未执行；导出无回执；附件PDF新标签DOM空白，内容未验证。 | `/pms/material-payment-requests` / 5条，1页 | [inventory-test-ops.json](/tmp/higoods-pms-test-ops-20261013/inventory-test-ops.json) |
| 14 | 物流费用请款 | 新建物流来源费用类型、未请款与已申请不同可编辑字段、付款及记录、状态查询重置/每页10/跳1。<br>最终创建保存申请/上传未执行；导出无下载回执；操作日志无记录。 | `/pms/logistics-payment-requests` / 2条，1页 | [inventory-test-ops.json](/tmp/higoods-pms-test-ops-20261013/inventory-test-ops.json) |
| 15 | KOL库存 | 空列表查询重置、独立批量锁定完整表单/查询、无选比例填充及清零、释放/生成链接空选门禁。<br>0条数据；单条/有选锁定释放/链接分支无样本，最终锁定及生成均未执行。 | `/pms/kol-sample-stock` / 20条，2页 | [inventory-test-ops.json](/tmp/higoods-pms-test-ops-20261013/inventory-test-ops.json) |
| 16 | 手动寄样申请 | 状态查询及全部重置，0条申请。<br>没有行控件样本，查看/通过/驳回/关联借出单不能现场确认；不执行通过所述业务生成。 | `/pms/kol-sample-apply` / 4条，1页 | [inventory-test-ops.json](/tmp/higoods-pms-test-ops-20261013/inventory-test-ops.json) |
| 17 | 对外样品池链接 | 状态查询及全部重置，0条链接。<br>没有行控件样本，复制修改作废关联未验证；外部访问可能计数，未执行。 | `/pms/kol-sample-link` / 5条，1页 | [inventory-test-ops.json](/tmp/higoods-pms-test-ops-20261013/inventory-test-ops.json) |
| 18 | 锁定操作记录 | 默认查询/重置均0条；操作类型、申请号、日期候选与列内容已观察。<br>无日志样本；候选仅observed级证据，不证明每个控件独立点击或所有组合。 | `/pms/kol-sample-stock/lock-log` / 14条，2页 | [inventory-test-ops.json](/tmp/higoods-pms-test-ops-20261013/inventory-test-ops.json) |
| 19 | 商品供应商管理 | 4条供应商，新建/查看/编辑完整表单、启用/停用状态候选、待审核空结果、重置/10条/跳2回1。<br>最终存草稿/保存启用未执行；停用可能直接写入未点。详情内部关闭无效后外层关闭，真实取消证据保留。 | `/pms/suppliers` / 13条，2页 | [basic-test-inventory.json](/tmp/higoods-pms-test-basic-20261013/basic-test-inventory.json) |
| 20 | 供应商供货档案 | 1条供货档案完整6区表单、新增/详情/编辑/导入入口与模板/导出、单位箱规供应商价格物流及关联。<br>复制/停用可能直接写入未点，最终保存上传导入未执行。导出服务器错误，模板下载缺回执；选星舰无渠道候选、SPU/SKU名称不一致。 | `/pms/supplier-supply-archives` / 12条，2页 | [basic-test-inventory.json](/tmp/higoods-pms-test-basic-20261013/basic-test-inventory.json) |
| 21 | 头程物流商管理 | 两商及渠道列表、新增/编辑/详情、7运输方式/选择切换/空查询及清空。<br>最终商/渠道保存未提交、停用潜在直写未点；换商后渠道区域先旧值，点击渠道才更新；7–3天源数据异常如实保留。 | `/pms/first-leg-carriers` / 5条，1页 | [basic-test-inventory.json](/tmp/higoods-pms-test-basic-20261013/basic-test-inventory.json) |

六项删除范围：

| 稳定编号 | 对象 | 原型路由 | 状态 |
|---|---|---|---|
| PMS-RM-01 | 面辅料列表 | `/pms/material-archives` | removal_required，尚未实施 |
| PMS-RM-02 | 成衣列表 | `/pms/garment-skus` | removal_required，尚未实施 |
| PMS-RM-03 | 样衣列表 | `/pms/sample-skus` | removal_required，尚未实施 |
| PMS-RM-04 | 仓库管理 | `/pms/warehouses` | removal_required，尚未实施 |
| PMS-RM-05 | 单位管理 | `/pms/units` | removal_required，尚未实施 |
| PMS-RM-06 | BOM/样板管理 | `/pms/bom-templates` | removal_required，尚未实施 |

六项删除覆盖菜单、路由、页面、处理器、专属对象/Mock、存储入口与工程测试消费者。采购仍需的真实共享引用先核对直接来源，保留有效引用；旧用户数据按STORE-04迁移与回读，不直接清库。

21个有效列表当前静态主行共171条，默认每页10条。8页列表已有两页、13页不足两页，最少补79个列表主行才能各有第二页；这些主行可能复用同一业务来源，不代表同数唯一新对象。页面标题/状态过滤后不足两页不自动新增假记录。

剩余证据边界：

- safe01_final_or_potential_direct_write：已見最终保存/审核/入库/签收/转运/删除/上传/打印可能留业务痕迹；不点击，不算安全漏点。
- no_eligible_sample：KOL四页均0条，时效首单翻单均空、其他部分状态无样本；行入口及后续状态不能现场证明。
- observed_filter_control_evidence_only：旧ops仅记录仓库/排序及操作类型等候选为observed，独立控件点击证据不足；查询/重置已点击。不能把observed升级clicked，不要求机械遍历所有组合。
- source_error_or_blocked_or_no_download：服务器错误只保留前两heading；客户端拦截、保存未完成、无download回执各有原始记录，不当导出成功。
- image_correspondence_and_preview：备货11款图URL对应成立但不证明原图预览；FADUU26070826缺真实对应需素材处理或调整为已有真实来源对象，禁止通用图冒充。其他图片失败/无预览按各清单保留。
- prototype_implementation：源码未实施；数据存储、附件、页面布局、路由/对象删除、两页Mock及命名设备性能与页面验收均属于下一阶段，不拿测试站现象当本地实现证据。

前5页冻结v1保留原SHA与编号；追加6项筛选全选/清空及5页分页证据在root supplement指向旧ID。原需求/MPO82+61检查点不重跑，独立尾查补其安全缺口。旧material恢复清单中未进入跟踪/时效仅描述旧集合，现已由root补充到达。

此文件是核查覆盖建议，不是实施后清单。下一阶段由主代理把每个按钮契约绑定当前源码和原型页面、存储/附件读回、适用设备/性能与6对象全量清理结果。

关联JSON保留稳定编号索引、每页状态统计、原型函数/参数/Mock口径及来源SHA。各清单复用证据，禁止简单相加当唯一按钮总数。

