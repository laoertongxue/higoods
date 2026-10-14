# 基础资料测试现场清单 · 删除范围修订 4

用户已明确六项需完整删除对象代码，不得遗留。当前 **商品供应商管理、供应商供货档案、头程物流商管理** 三页、62 条继续功能对齐。面辅料、成衣、样衣、仓库、单位、BOM/样板六项状态为 **removal_required**，历史 44 条现场记录保留用于追踪，停止补查/补齐；实施与验收需全量清理菜单、路由、页面、处理器、专属数据/Mock、存储入口、测试及相关消费者。

工程代码删除不授权清空浏览器用户记录；旧持久数据仍按 STORE-04 登记、迁移和回读，不直接删库。

本次仅更正范围身份，没有源码删除或实施验收。原修订 3 保存 frozen-v3。下方为原版本历史，不代表六页仅隐藏/免验收即可完成。

# 基础资料测试现场清单 · 范围修订 3

当前有效范围仅 **商品供应商管理、供应商供货档案、头程物流商管理**，共 3 页、62 条动作/观察。面辅料、成衣、样衣、仓库、单位、BOM/样板 6 页及 44 条记录退出本次对齐；下文历史结果保留，不用于本次验收。没有新的浏览器点击、业务写入或源码修改。六页是否移除菜单/独立页面由主代理依用户确认处理；本清单不授权数据删除。

版本 2 已完整保留于 frozen-v2。历史图片对应记录来自已排除页，仅保留来源事实。

# 采购基础资料测试环境逐按钮核查清单

环境：**test**，唯一业务域 `http://test_manage.higood.ai`。9个菜单都实际进入：7页正常加载（其中面辅料空表），单位与BOM均为nginx404。正式环境资料只留历史参考，没有参与本次测试验收。

本次保存 136 次主页面DOM捕获、4份原图目标DOM、7张截图及2个通过pageAssets导出的对象缩略图。最后主页面记录 2026-10-13T09:27:48.406Z。没有实施，没有最终业务写入、上传、删除或状态提交。

## 覆盖与原型位置

| 菜单顺序 | 页面 | 测试结果 | 原型路由 / 静态Mock | 按钮项 |
|---|---|---|---|---|
| 1 |  商品供应商管理 | loaded | /pms/suppliers：13行 / 每页10 / 2页 | 17 |
| 2 |  供应商供货档案 | loaded | /pms/supplier-supply-archives：12行 / 每页10 / 2页 | 25 |
| 3 |  头程物流商管理 | loaded | /pms/first-leg-carriers：5行 / 每页10 / 1页 | 20 |
| 4 |  面辅料列表 | loaded_empty_list | /pms/material-archives：14行 / 每页10 / 2页 | 5 |
| 5 |  成衣列表 | loaded | /pms/garment-skus：7行 / 每页10 / 1页 | 10 |
| 6 |  样衣列表 | loaded | /pms/sample-skus：2行 / 每页10 / 1页 | 14 |
| 7 |  仓库管理 | loaded | /pms/warehouses：12行 / 每页10 / 2页 | 13 |
| 8 |  单位管理 | route_404 | /pms/units：25行 / 每页10 / 3页 | 1 |
| 9 |  BOM/样板管理 | route_404 | /pms/bom-templates：8行 / 每页10 / 1页 | 1 |

已有原型9个页面均存在。页面/数据文件与此前静态统计版本SHA一致；这是代码事实，没有把正式环境页面当测试事实。成衣与样衣原型现有主列表为SPU粒度，测试列表为SKU行，实施时须明确列表粒度和Mock计数口径。

## 商品供应商管理

测试地址：[http://test_manage.higood.ai/pms/supplier_manage/index](http://test_manage.higood.ai/pms/supplier_manage/index)。原型：[suppliers.ts](/Users/laoer/.codex/worktrees/7eaf/higoods/src/pages/pms/suppliers.ts)。

列表字段：供应商编码；供应商名称；供应商简称；供应商类型；国家/地区；省市；联系人；联系电话；付款方式；币种；供应商等级；状态；创建人；创建时间；操作。

分页原始摘要：- generic: 共 4 条，第 1 页 / 共 1 页。

| 编号 | 按钮 / 功能 | 状态 | 实际结果与边界 |
|---|---|---|---|
| PMS-TEST-BASIC-SUP-ENTER | 页面进入 | entered_list | 页面已实际到达；导航初始捕获与真实URL不一致者只依实际URL归属。  |
| PMS-TEST-BASIC-SUP-QUERY | 查询 | clicked_query | 已执行默认查询及保存的筛选边界；选项仅记录实际DOM，不推断组合结果。  |
| PMS-TEST-BASIC-SUP-RESET | 清除/重置/清空查询 | clicked_reset | 恢复约定默认条件与列表；供货档案/样衣用重置，物流商用清空，其余用清除。  |
| PMS-TEST-BASIC-SUP-SIZE | 每页条数 | clicked_query | 实际选择10条；仅分页偏好/查询操作。  |
| PMS-TEST-BASIC-SUP-JUMP | 输入页码并确定跳转 | clicked_query | 实际请求第2页：供应商/供货档案/成衣/样衣只有1页时落回第1页，仓库可到第2页；以每份URL及统计为准。  |
| PMS-TEST-BASIC-SUP-NEW | 新增供应商 | clicked_opened | 完整新增表单已打开。  |
| PMS-TEST-BASIC-SUP-NEW-CANCEL | 新增表单取消 | clicked_cancelled | 实际关闭新增表单；无业务保存。  |
| PMS-TEST-BASIC-SUP-DRAFT | 保存草稿 | visible_not_submitted | 按钮已见，未执行。 SAFE-01最终业务写入禁止提交 |
| PMS-TEST-BASIC-SUP-NEW-ENABLE | 保存并启用 | visible_not_submitted | 按钮已见，未执行。 SAFE-01最终业务写入禁止提交 |
| PMS-TEST-BASIC-SUP-VIEW | 查看 | clicked_opened | 早期未捕获新界面，重试后完整查看供应商只读表单已打开。  |
| PMS-TEST-BASIC-SUP-VIEW-CLOSE | 详情关闭按钮 | clicked_not_closed | 按钮调用后弹窗仍在；不能仅因工具click成功说已关闭。实际外层关闭图标关闭。 控制/页面原因未判定，不冒称已确认源码缺陷 |
| PMS-TEST-BASIC-SUP-VIEW-CLOSE-ICON | 详情外层关闭图标 | clicked_cancelled | 实际返回列表。  |
| PMS-TEST-BASIC-SUP-EDIT | 编辑 | clicked_opened | 完整编辑表单已打开。  |
| PMS-TEST-BASIC-SUP-EDIT-SAVE | 编辑保存 | visible_not_submitted | 只见保存按钮，未执行。 未检验保存校验、状态写入或持久回读 |
| PMS-TEST-BASIC-SUP-EDIT-CLOSE | 编辑外层关闭图标 | clicked_cancelled | 关闭未保存编辑表单。  |
| PMS-TEST-BASIC-SUP-DISABLE | 停用 | not_clicked_may_write_directly | 按钮DOM为toggleStatus(4,disable)，未获提交前确认的证明，未试业务写入。 SAFE-01；不把可能直写动作当安全弹窗试点 |
| PMS-TEST-BASIC-SUP-STATE-SAMPLES | 审核/启用/驳回等条件分支 | no_sample_branch | 当前4条均已启用；待审核筛选无数据，这些行按钮未取得样本，不能从筛选状态选项推断操作流程。  |

表单字段与实际选项：

- **PMS-TEST-BASIC-SUP-NEW 新增供应商**：供应商编码/状态（已有资料）；供应商名称/简称/类型；国家地区/省市/等级；联系人/联系电话/邮箱/微信；付款方式/币种/开票信息/银行账户；默认交货方式；备注。选项：请选择（已选）、面料供应商、辅料供应商、纱线供应商、耗材供应商、包材供应商、成衣工厂、样衣工厂、综合供应商、中国、印尼、越南、其他、A级、B级、C级、临时供应商、月结、对账后付款、到货后付款、预付、RMB、USD、IDR、供应商直发海外仓、发国内仓、自提。
- **PMS-TEST-BASIC-SUP-DRAFT 保存草稿**：供应商编码/状态（已有资料）；供应商名称/简称/类型；国家地区/省市/等级；联系人/联系电话/邮箱/微信；付款方式/币种/开票信息/银行账户；默认交货方式；备注。选项：请选择（已选）、面料供应商、辅料供应商、纱线供应商、耗材供应商、包材供应商、成衣工厂、样衣工厂、综合供应商、中国、印尼、越南、其他、A级、B级、C级、临时供应商、月结、对账后付款、到货后付款、预付、RMB、USD、IDR、供应商直发海外仓、发国内仓、自提。
- **PMS-TEST-BASIC-SUP-NEW-ENABLE 保存并启用**：供应商编码/状态（已有资料）；供应商名称/简称/类型；国家地区/省市/等级；联系人/联系电话/邮箱/微信；付款方式/币种/开票信息/银行账户；默认交货方式；备注。选项：请选择（已选）、面料供应商、辅料供应商、纱线供应商、耗材供应商、包材供应商、成衣工厂、样衣工厂、综合供应商、中国、印尼、越南、其他、A级、B级、C级、临时供应商、月结、对账后付款、到货后付款、预付、RMB、USD、IDR、供应商直发海外仓、发国内仓、自提。
- **PMS-TEST-BASIC-SUP-VIEW 查看**：供应商编码/状态（已有资料）；供应商名称/简称/类型；国家地区/省市/等级；联系人/联系电话/邮箱/微信；付款方式/币种/开票信息/银行账户；默认交货方式；备注。选项：只读或未获取可展开选项。
- **PMS-TEST-BASIC-SUP-VIEW-CLOSE 详情关闭按钮**：见JSON的实际DOM控件。选项：只读或未获取可展开选项。
- **PMS-TEST-BASIC-SUP-EDIT 编辑**：供应商编码/状态（已有资料）；供应商名称/简称/类型；国家地区/省市/等级；联系人/联系电话/邮箱/微信；付款方式/币种/开票信息/银行账户；默认交货方式；备注。选项：请选择、面料供应商、辅料供应商（已选）、纱线供应商、耗材供应商、包材供应商、成衣工厂、样衣工厂、综合供应商、中国、印尼（已选）、越南、其他、A级（已选）、B级、C级、临时供应商、月结（已选）、对账后付款、到货后付款、预付、RMB（已选）、USD、IDR、供应商直发海外仓、发国内仓（已选）、自提。
- **PMS-TEST-BASIC-SUP-EDIT-SAVE 编辑保存**：供应商编码/状态（已有资料）；供应商名称/简称/类型；国家地区/省市/等级；联系人/联系电话/邮箱/微信；付款方式/币种/开票信息/银行账户；默认交货方式；备注。选项：请选择、面料供应商、辅料供应商（已选）、纱线供应商、耗材供应商、包材供应商、成衣工厂、样衣工厂、综合供应商、中国、印尼（已选）、越南、其他、A级（已选）、B级、C级、临时供应商、月结（已选）、对账后付款、到货后付款、预付、RMB（已选）、USD、IDR、供应商直发海外仓、发国内仓（已选）、自提。

点击 / 结果证据：

- PMS-TEST-BASIC-SUP-ENTER：[1791881776482-supplier-list-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791881776482-supplier-list-initial.txt)。
- PMS-TEST-BASIC-SUP-QUERY：[1791881790146-supplier-query-default.txt](/tmp/higoods-pms-test-basic-20261013/1791881790146-supplier-query-default.txt)、[1791881981617-supplier-query-pending-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791881981617-supplier-query-pending-empty.txt)。
- PMS-TEST-BASIC-SUP-RESET：[1791881790734-supplier-reset.txt](/tmp/higoods-pms-test-basic-20261013/1791881790734-supplier-reset.txt)、[1791882016045-supplier-reset-after-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791882016045-supplier-reset-after-empty.txt)。
- PMS-TEST-BASIC-SUP-SIZE：[1791882016683-supplier-page-size-10.txt](/tmp/higoods-pms-test-basic-20261013/1791882016683-supplier-page-size-10.txt)。
- PMS-TEST-BASIC-SUP-JUMP：[1791882016731-supplier-page-jump-enter-2.txt](/tmp/higoods-pms-test-basic-20261013/1791882016731-supplier-page-jump-enter-2.txt)、[1791882017369-supplier-page-jump-submit-2.txt](/tmp/higoods-pms-test-basic-20261013/1791882017369-supplier-page-jump-submit-2.txt)。
- PMS-TEST-BASIC-SUP-NEW：[1791881792383-supplier-new-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791881792383-supplier-new-initial.txt)。
- PMS-TEST-BASIC-SUP-NEW-CANCEL：[1791881809328-supplier-new-cancel.txt](/tmp/higoods-pms-test-basic-20261013/1791881809328-supplier-new-cancel.txt)。
- PMS-TEST-BASIC-SUP-DRAFT：[1791881792383-supplier-new-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791881792383-supplier-new-initial.txt)。
- PMS-TEST-BASIC-SUP-NEW-ENABLE：[1791881792383-supplier-new-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791881792383-supplier-new-initial.txt)。
- PMS-TEST-BASIC-SUP-VIEW：[1791881809666-supplier-view-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791881809666-supplier-view-initial.txt)、[1791881818546-supplier-view-ready.txt](/tmp/higoods-pms-test-basic-20261013/1791881818546-supplier-view-ready.txt)、[1791881846025-supplier-view-retry.txt](/tmp/higoods-pms-test-basic-20261013/1791881846025-supplier-view-retry.txt)。
- PMS-TEST-BASIC-SUP-VIEW-CLOSE：[1791881869705-supplier-view-close.txt](/tmp/higoods-pms-test-basic-20261013/1791881869705-supplier-view-close.txt)、[1791881885610-supplier-view-close-still-open.txt](/tmp/higoods-pms-test-basic-20261013/1791881885610-supplier-view-close-still-open.txt)。
- PMS-TEST-BASIC-SUP-VIEW-CLOSE-ICON：[1791881908892-supplier-view-close-icon.txt](/tmp/higoods-pms-test-basic-20261013/1791881908892-supplier-view-close-icon.txt)。
- PMS-TEST-BASIC-SUP-EDIT：[1791881938701-supplier-edit.txt](/tmp/higoods-pms-test-basic-20261013/1791881938701-supplier-edit.txt)。
- PMS-TEST-BASIC-SUP-EDIT-SAVE：[1791881938701-supplier-edit.txt](/tmp/higoods-pms-test-basic-20261013/1791881938701-supplier-edit.txt)。
- PMS-TEST-BASIC-SUP-EDIT-CLOSE：[1791881981005-supplier-edit-close-icon.txt](/tmp/higoods-pms-test-basic-20261013/1791881981005-supplier-edit-close-icon.txt)。
- PMS-TEST-BASIC-SUP-DISABLE：[1791881776482-supplier-list-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791881776482-supplier-list-initial.txt)。
- PMS-TEST-BASIC-SUP-STATE-SAMPLES：[1791881776482-supplier-list-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791881776482-supplier-list-initial.txt)、[1791881981617-supplier-query-pending-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791881981617-supplier-query-pending-empty.txt)。

## 供应商供货档案

测试地址：[http://test_manage.higood.ai/pms/supplier_supply_archive/index](http://test_manage.higood.ai/pms/supplier_supply_archive/index)。原型：[supplier-supply-archives.ts](/Users/laoer/.codex/worktrees/7eaf/higoods/src/pages/pms/supplier-supply-archives.ts)。

列表字段：供应商；商品/物料SKU；商品/物料名称；分类；基础单位；采购单位；包装单位；默认采购价；MOQ；交期天数；包装规则；每箱基础数量；单箱重量；单箱体积；默认物流；默认头程渠道；默认供应商；状态；更新时间；操作。

分页原始摘要：- generic: 共 1 条，第 1 页 / 共 1 页。

| 编号 | 按钮 / 功能 | 状态 | 实际结果与边界 |
|---|---|---|---|
| PMS-TEST-BASIC-SSA-ENTER | 页面进入 | entered_list | 页面已实际到达；导航初始捕获与真实URL不一致者只依实际URL归属。  |
| PMS-TEST-BASIC-SSA-QUERY | 查询 | clicked_query | 已执行默认查询及保存的筛选边界；选项仅记录实际DOM，不推断组合结果。  |
| PMS-TEST-BASIC-SSA-RESET | 清除/重置/清空查询 | clicked_reset | 恢复约定默认条件与列表；供货档案/样衣用重置，物流商用清空，其余用清除。  |
| PMS-TEST-BASIC-SSA-SIZE | 每页条数 | clicked_query | 实际选择10条；仅分页偏好/查询操作。  |
| PMS-TEST-BASIC-SSA-JUMP | 输入页码并确定跳转 | clicked_query | 实际请求第2页：供应商/供货档案/成衣/样衣只有1页时落回第1页，仓库可到第2页；以每份URL及统计为准。  |
| PMS-TEST-BASIC-SSA-NEW | 新增供货档案 | clicked_opened | 完整表单/详情已加载。  |
| PMS-TEST-BASIC-SSA-VIEW | 查看供货档案 | clicked_opened | 完整表单/详情已加载。  |
| PMS-TEST-BASIC-SSA-SUPPLIER-LINK | 供应商名称链接 | clicked_opened | 完整表单/详情已加载；供应商名称链接实际打开供货档案详情，不能称已打开供应商主体详情。  |
| PMS-TEST-BASIC-SSA-EDIT | 编辑供货档案 | clicked_opened | 完整表单/详情已加载。  |
| PMS-TEST-BASIC-SSA-NEW-PROVIDER | 新增选择头程物流商 | clicked_local_form_change | 已选择广州星舰；渠道下拉仍仅请选择，后续渠道候选没有获得。 表单内未保存变化，不是业务数据提交 |
| PMS-TEST-BASIC-SSA-SPU-SKU-LABEL | SPU/SKU字段命名 | observed_label_inconsistency | 表单同时有商品/物料SPU与SPU，列表为商品/物料SKU；样本主编码12312312、另一个SPU12312，标签与对象身份需专项对齐，不能照搬混用。  |
| PMS-TEST-BASIC-SSA-NEW-CLOSE | 外层关闭图标 | clicked_cancelled | 关闭对应未提交表单或只读详情。  |
| PMS-TEST-BASIC-SSA-VIEW-CLOSE | 外层关闭图标 | clicked_cancelled | 关闭对应未提交表单或只读详情。  |
| PMS-TEST-BASIC-SSA-EDIT-CLOSE | 外层关闭图标 | clicked_cancelled | 关闭对应未提交表单或只读详情。  |
| PMS-TEST-BASIC-SSA-IMPORT-CLOSE | 外层关闭图标 | clicked_cancelled | 关闭对应未提交表单或只读详情。  |
| PMS-TEST-BASIC-SSA-NEW-SAVE | 保存 | visible_not_submitted | 只见保存按钮，未执行。 SAFE-01最终写入禁止，新增/编辑各独立保留 |
| PMS-TEST-BASIC-SSA-EDIT-SAVE | 保存 | visible_not_submitted | 只见保存按钮，未执行。 SAFE-01最终写入禁止，新增/编辑各独立保留 |
| PMS-TEST-BASIC-SSA-COPY | 复制 | not_clicked_may_write_directly | DOM分别为doCopy(1)、toggleStatus(1,disable)，未证实存在最终提交前确认，不试写入。 当前仅启用样本，停用后的启用分支未取得 |
| PMS-TEST-BASIC-SSA-DISABLE | 停用 | not_clicked_may_write_directly | DOM分别为doCopy(1)、toggleStatus(1,disable)，未证实存在最终提交前确认，不试写入。 当前仅启用样本，停用后的启用分支未取得 |
| PMS-TEST-BASIC-SSA-IMPORT | 导入 | clicked_opened | 完整导入预览页已加载。  |
| PMS-TEST-BASIC-SSA-IMPORT-TEMPLATE | 下载导入模板 | clicked_download_not_proven | 按钮active，表单未变；download事件未观测。不能称下载成功，也不能确认服务器失败。  |
| PMS-TEST-BASIC-SSA-IMPORT-UPLOAD | 上传xls/xlsx | visible_not_executed | 按钮可见，未选择或上传文件。 父任务明确禁止上传，不试服务器解析或临时文件写入 |
| PMS-TEST-BASIC-SSA-IMPORT-CLEAR | 清空导入预览 | clicked_local_form_change | 空预览清空后仍0条/通过0/错误0，无业务提交。  |
| PMS-TEST-BASIC-SSA-IMPORT-COMMIT | 确认导入 | visible_not_submitted | 最终确认未执行。 未检验实际解析、去重、持久建档结果 |
| PMS-TEST-BASIC-SSA-EXPORT | 导出 | clicked_server_error | 真实错误：SupplierSupplyArchiveImportService.php line111，Call to undefined method think\response\File::delete()。证据只保存前两条heading，未保存堆栈/配置/环境/会话。  |

表单字段与实际选项：

- **PMS-TEST-BASIC-SSA-NEW 新增供货档案**：供应商/商品物料SPU必填/商品名称/分类/另一个SPU字段/采购区域/默认供应商/状态；基础单位/采购单位/包装单位/箱单位；采购价/币种/MOQ/交期/质检/采购员；包装方式/每包装基础量/每箱包装数/每箱基础量/包装与箱重量体积/箱规/不规则包装/备注；默认国内物流/发货方式地址/收货仓/海外直发/头程物流商/头程渠道。选项：请选择（已选）、供应商测试1、供应商测试2、测试、莎莎、面料、辅料、纱线、包材、耗材、成衣、样衣、中国（已选）、印尼、越南、其他、否（已选）、是、启用（已选）、停用、米、码、公斤、KG、个、件、卷、箱、包、打、RMB（已选）、USD、IDR、请选择、广州星舰供应链有限公司（星舰）（已选）、美森（MS）。
- **PMS-TEST-BASIC-SSA-VIEW 查看供货档案**：供应商/商品物料SPU必填/商品名称/分类/另一个SPU字段/采购区域/默认供应商/状态；基础单位/采购单位/包装单位/箱单位；采购价/币种/MOQ/交期/质检/采购员；包装方式/每包装基础量/每箱包装数/每箱基础量/包装与箱重量体积/箱规/不规则包装/备注；默认国内物流/发货方式地址/收货仓/海外直发/头程物流商/头程渠道。选项：只读或未获取可展开选项。
- **PMS-TEST-BASIC-SSA-SUPPLIER-LINK 供应商名称链接**：供应商/商品物料SPU必填/商品名称/分类/另一个SPU字段/采购区域/默认供应商/状态；基础单位/采购单位/包装单位/箱单位；采购价/币种/MOQ/交期/质检/采购员；包装方式/每包装基础量/每箱包装数/每箱基础量/包装与箱重量体积/箱规/不规则包装/备注；默认国内物流/发货方式地址/收货仓/海外直发/头程物流商/头程渠道。选项：只读或未获取可展开选项。
- **PMS-TEST-BASIC-SSA-EDIT 编辑供货档案**：供应商/商品物料SPU必填/商品名称/分类/另一个SPU字段/采购区域/默认供应商/状态；基础单位/采购单位/包装单位/箱单位；采购价/币种/MOQ/交期/质检/采购员；包装方式/每包装基础量/每箱包装数/每箱基础量/包装与箱重量体积/箱规/不规则包装/备注；默认国内物流/发货方式地址/收货仓/海外直发/头程物流商/头程渠道。选项：请选择、供应商测试1（已选）、供应商测试2、测试、莎莎、面料（已选）、辅料、纱线、包材、耗材、成衣、样衣、中国（已选）、印尼、越南、其他、否、是（已选）、启用（已选）、停用、米（已选）、码、公斤、KG、个、件、卷、箱、包、打、米、卷（已选）、箱（已选）、RMB（已选）、USD、IDR、否（已选）、是、请选择（已选）、广州星舰供应链有限公司（星舰）、美森（MS）。
- **PMS-TEST-BASIC-SSA-NEW-PROVIDER 新增选择头程物流商**：见JSON的实际DOM控件。选项：请选择（已选）、供应商测试1、供应商测试2、测试、莎莎、面料、辅料、纱线、包材、耗材、成衣、样衣、中国（已选）、印尼、越南、其他、否（已选）、是、启用（已选）、停用、米、码、公斤、KG、个、件、卷、箱、包、打、RMB（已选）、USD、IDR、请选择、广州星舰供应链有限公司（星舰）（已选）、美森（MS）。
- **PMS-TEST-BASIC-SSA-NEW-SAVE 保存**：供应商/商品物料SPU必填/商品名称/分类/另一个SPU字段/采购区域/默认供应商/状态；基础单位/采购单位/包装单位/箱单位；采购价/币种/MOQ/交期/质检/采购员；包装方式/每包装基础量/每箱包装数/每箱基础量/包装与箱重量体积/箱规/不规则包装/备注；默认国内物流/发货方式地址/收货仓/海外直发/头程物流商/头程渠道。选项：请选择（已选）、供应商测试1、供应商测试2、测试、莎莎、面料、辅料、纱线、包材、耗材、成衣、样衣、中国（已选）、印尼、越南、其他、否（已选）、是、启用（已选）、停用、米、码、公斤、KG、个、件、卷、箱、包、打、RMB（已选）、USD、IDR、广州星舰供应链有限公司（星舰）、美森（MS）。
- **PMS-TEST-BASIC-SSA-EDIT-SAVE 保存**：供应商/商品物料SPU必填/商品名称/分类/另一个SPU字段/采购区域/默认供应商/状态；基础单位/采购单位/包装单位/箱单位；采购价/币种/MOQ/交期/质检/采购员；包装方式/每包装基础量/每箱包装数/每箱基础量/包装与箱重量体积/箱规/不规则包装/备注；默认国内物流/发货方式地址/收货仓/海外直发/头程物流商/头程渠道。选项：请选择、供应商测试1（已选）、供应商测试2、测试、莎莎、面料（已选）、辅料、纱线、包材、耗材、成衣、样衣、中国（已选）、印尼、越南、其他、否、是（已选）、启用（已选）、停用、米（已选）、码、公斤、KG、个、件、卷、箱、包、打、米、卷（已选）、箱（已选）、RMB（已选）、USD、IDR、否（已选）、是、请选择（已选）、广州星舰供应链有限公司（星舰）、美森（MS）。
- **PMS-TEST-BASIC-SSA-IMPORT 导入**：供应商编码/名称与物料SKU必填；同一供应商+SKU不可重复；xls/xlsx文件；解析预览表/总数/通过/错误。选项：只读或未获取可展开选项。

点击 / 结果证据：

- PMS-TEST-BASIC-SSA-ENTER：[1791882018079-supplier-list-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791882018079-supplier-list-initial.txt)、[1791882315748-supplier_supply_archive-list-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791882315748-supplier_supply_archive-list-initial.txt)、[1791882331360-supplier_supply_archive-list-ready.txt](/tmp/higoods-pms-test-basic-20261013/1791882331360-supplier_supply_archive-list-ready.txt)。
- PMS-TEST-BASIC-SSA-QUERY：[1791882064748-supplier_supply_archive-query-default.txt](/tmp/higoods-pms-test-basic-20261013/1791882064748-supplier_supply_archive-query-default.txt)、[1791883342958-supplier_supply_archive-query-disabled-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791883342958-supplier_supply_archive-query-disabled-empty.txt)。
- PMS-TEST-BASIC-SSA-RESET：[1791882065389-supplier_supply_archive-reset.txt](/tmp/higoods-pms-test-basic-20261013/1791882065389-supplier_supply_archive-reset.txt)、[1791883343536-supplier_supply_archive-reset-after-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791883343536-supplier_supply_archive-reset-after-empty.txt)。
- PMS-TEST-BASIC-SSA-SIZE：[1791883344055-supplier_supply_archive-page-size-10.txt](/tmp/higoods-pms-test-basic-20261013/1791883344055-supplier_supply_archive-page-size-10.txt)。
- PMS-TEST-BASIC-SSA-JUMP：[1791883344093-supplier_supply_archive-page-jump-enter-2.txt](/tmp/higoods-pms-test-basic-20261013/1791883344093-supplier_supply_archive-page-jump-enter-2.txt)、[1791883344741-supplier_supply_archive-page-jump-submit-2.txt](/tmp/higoods-pms-test-basic-20261013/1791883344741-supplier_supply_archive-page-jump-submit-2.txt)。
- PMS-TEST-BASIC-SSA-NEW：[1791882068537-supplier_supply_archive-new.txt](/tmp/higoods-pms-test-basic-20261013/1791882068537-supplier_supply_archive-new.txt)、[1791882089366-supplier_supply_archive-new-provider-channel-options.txt](/tmp/higoods-pms-test-basic-20261013/1791882089366-supplier_supply_archive-new-provider-channel-options.txt)。
- PMS-TEST-BASIC-SSA-VIEW：[1791882092881-supplier_supply_archive-view.txt](/tmp/higoods-pms-test-basic-20261013/1791882092881-supplier_supply_archive-view.txt)。
- PMS-TEST-BASIC-SSA-SUPPLIER-LINK：[1791882302960-supplier_supply_archive-supplier-link-detail.txt](/tmp/higoods-pms-test-basic-20261013/1791882302960-supplier_supply_archive-supplier-link-detail.txt)。
- PMS-TEST-BASIC-SSA-EDIT：[1791882111136-supplier_supply_archive-edit.txt](/tmp/higoods-pms-test-basic-20261013/1791882111136-supplier_supply_archive-edit.txt)、[1791882132343-supplier_supply_archive-edit-retry.txt](/tmp/higoods-pms-test-basic-20261013/1791882132343-supplier_supply_archive-edit-retry.txt)。
- PMS-TEST-BASIC-SSA-NEW-PROVIDER：[1791882089366-supplier_supply_archive-new-provider-channel-options.txt](/tmp/higoods-pms-test-basic-20261013/1791882089366-supplier_supply_archive-new-provider-channel-options.txt)。
- PMS-TEST-BASIC-SSA-SPU-SKU-LABEL：[1791882068537-supplier_supply_archive-new.txt](/tmp/higoods-pms-test-basic-20261013/1791882068537-supplier_supply_archive-new.txt)、[1791882092881-supplier_supply_archive-view.txt](/tmp/higoods-pms-test-basic-20261013/1791882092881-supplier_supply_archive-view.txt)。
- PMS-TEST-BASIC-SSA-NEW-CLOSE：[1791882089715-supplier_supply_archive-new-close-icon.txt](/tmp/higoods-pms-test-basic-20261013/1791882089715-supplier_supply_archive-new-close-icon.txt)。
- PMS-TEST-BASIC-SSA-VIEW-CLOSE：[1791882110779-supplier_supply_archive-view-close-icon.txt](/tmp/higoods-pms-test-basic-20261013/1791882110779-supplier_supply_archive-view-close-icon.txt)、[1791882315408-supplier_supply_archive-supplier-link-close-icon.txt](/tmp/higoods-pms-test-basic-20261013/1791882315408-supplier_supply_archive-supplier-link-close-icon.txt)。
- PMS-TEST-BASIC-SSA-EDIT-CLOSE：[1791882157944-supplier_supply_archive-edit-close-icon.txt](/tmp/higoods-pms-test-basic-20261013/1791882157944-supplier_supply_archive-edit-close-icon.txt)。
- PMS-TEST-BASIC-SSA-IMPORT-CLOSE：[1791882252528-supplier_supply_archive-import-close-icon.txt](/tmp/higoods-pms-test-basic-20261013/1791882252528-supplier_supply_archive-import-close-icon.txt)。
- PMS-TEST-BASIC-SSA-NEW-SAVE：[1791882068537-supplier_supply_archive-new.txt](/tmp/higoods-pms-test-basic-20261013/1791882068537-supplier_supply_archive-new.txt)。
- PMS-TEST-BASIC-SSA-EDIT-SAVE：[1791882132343-supplier_supply_archive-edit-retry.txt](/tmp/higoods-pms-test-basic-20261013/1791882132343-supplier_supply_archive-edit-retry.txt)。
- PMS-TEST-BASIC-SSA-COPY：[1791882018079-supplier-list-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791882018079-supplier-list-initial.txt)、[1791882315748-supplier_supply_archive-list-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791882315748-supplier_supply_archive-list-initial.txt)、[1791883342257-supplier_supply_archive-pagination-revisit-list.txt](/tmp/higoods-pms-test-basic-20261013/1791883342257-supplier_supply_archive-pagination-revisit-list.txt)。
- PMS-TEST-BASIC-SSA-DISABLE：[1791882018079-supplier-list-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791882018079-supplier-list-initial.txt)、[1791882315748-supplier_supply_archive-list-initial.txt](/tmp/higoods-pms-test-basic-20261013/1791882315748-supplier_supply_archive-list-initial.txt)、[1791883342257-supplier_supply_archive-pagination-revisit-list.txt](/tmp/higoods-pms-test-basic-20261013/1791883342257-supplier_supply_archive-pagination-revisit-list.txt)。
- PMS-TEST-BASIC-SSA-IMPORT：[1791882192035-supplier_supply_archive-import.txt](/tmp/higoods-pms-test-basic-20261013/1791882192035-supplier_supply_archive-import.txt)。
- PMS-TEST-BASIC-SSA-IMPORT-TEMPLATE：[1791882213341-supplier_supply_archive-import-template-download.txt](/tmp/higoods-pms-test-basic-20261013/1791882213341-supplier_supply_archive-import-template-download.txt)。
- PMS-TEST-BASIC-SSA-IMPORT-UPLOAD：[1791882192035-supplier_supply_archive-import.txt](/tmp/higoods-pms-test-basic-20261013/1791882192035-supplier_supply_archive-import.txt)。
- PMS-TEST-BASIC-SSA-IMPORT-CLEAR：[1791882221330-supplier_supply_archive-import-clear.txt](/tmp/higoods-pms-test-basic-20261013/1791882221330-supplier_supply_archive-import-clear.txt)。
- PMS-TEST-BASIC-SSA-IMPORT-COMMIT：[1791882192035-supplier_supply_archive-import.txt](/tmp/higoods-pms-test-basic-20261013/1791882192035-supplier_supply_archive-import.txt)。
- PMS-TEST-BASIC-SSA-EXPORT：[1791882264677-supplier_supply_archive-export.txt](/tmp/higoods-pms-test-basic-20261013/1791882264677-supplier_supply_archive-export.txt)。

## 头程物流商管理

测试地址：[http://test_manage.higood.ai/pms/first_leg_logistics_provider/index](http://test_manage.higood.ai/pms/first_leg_logistics_provider/index)。原型：[first-leg-carriers.ts](/Users/laoer/.codex/worktrees/7eaf/higoods/src/pages/pms/first-leg-carriers.ts)。

列表字段：页面404，未取得字段。

分页原始摘要：无分页摘要或页面未加载。

| 编号 | 按钮 / 功能 | 状态 | 实际结果与边界 |
|---|---|---|---|
| PMS-TEST-BASIC-FLP-ENTER | 页面进入 | entered_list | 页面已实际到达；导航初始捕获与真实URL不一致者只依实际URL归属。  |
| PMS-TEST-BASIC-FLP-QUERY | 查询 | clicked_query | 已执行默认查询及保存的筛选边界；选项仅记录实际DOM，不推断组合结果。  |
| PMS-TEST-BASIC-FLP-RESET | 清除/重置/清空查询 | clicked_reset | 恢复约定默认条件与列表；供货档案/样衣用重置，物流商用清空，其余用清除。  |
| PMS-TEST-BASIC-FLP-NEW-PROVIDER | 新增物流商（主按钮） | clicked_opened | 完整表单/详情已加载。  |
| PMS-TEST-BASIC-FLP-NEW-PROVIDER-SIDEBAR | 新增物流商（侧栏+新增） | clicked_opened | 完整表单/详情已加载。  |
| PMS-TEST-BASIC-FLP-VIEW-PROVIDER | 查看物流商 | clicked_opened | 完整表单/详情已加载。  |
| PMS-TEST-BASIC-FLP-EDIT-PROVIDER | 编辑物流商 | clicked_opened | 完整表单/详情已加载。  |
| PMS-TEST-BASIC-FLP-NEW-CHANNEL | 新建渠道 | clicked_opened | 完整表单/详情已加载。  |
| PMS-TEST-BASIC-FLP-VIEW-CHANNEL | 完整查看渠道 | clicked_opened | 完整表单/详情已加载。  |
| PMS-TEST-BASIC-FLP-EDIT-CHANNEL | 编辑渠道 | clicked_opened | 完整表单/详情已加载。  |
| PMS-TEST-BASIC-FLP-PROVIDER-SAVE | 物流商保存 | visible_not_submitted | 保存未执行。 SAFE-01 |
| PMS-TEST-BASIC-FLP-CHANNEL-SAVE | 渠道保存 | visible_not_submitted | 保存未执行。 SAFE-01 |
| PMS-TEST-BASIC-FLP-CHANNEL-CANCEL | 新建渠道取消 | clicked_cancelled | 两个物流商新增表单取消均返回列表。  |
| PMS-TEST-BASIC-FLP-CLOSE-ICONS | 详情/编辑/新增外层关闭图标 | clicked_cancelled | 对应表单或详情已关闭；不替代最后保存。  |
| PMS-TEST-BASIC-FLP-PROVIDER-SELECT | 切换物流商卡片 | clicked_list_updated | 切到美森后列表为MS/美森快船，右侧保留先前星舰渠道详情；保留对象错配现场。  |
| PMS-TEST-BASIC-FLP-CHANNEL-SELECT | 选择渠道卡片 | clicked_detail_updated | 点击美森快船后加载完成，右侧变为CH-2026-0001美森；此前pending旧详情不能当完成。  |
| PMS-TEST-BASIC-FLP-MODE-OPTIONS | 渠道运输方式候选 | observed_options | 星舰新增仅海卡/空卡，美森新增显示全部7种；候选依据实际表单，不推断规则来源。  |
| PMS-TEST-BASIC-FLP-DATA-RANGE | 现有时效区间 | observed_data_inconsistency | 美森详情显示7-3天，保留异常，不修改数据。  |
| PMS-TEST-BASIC-FLP-PROVIDER-DISABLE | 物流商停用 | not_clicked_may_write_directly | toggleProviderStatus/toggleChannelStatus未证实先确认后写入；未执行。 当前无停用样本，启用分支未验证 |
| PMS-TEST-BASIC-FLP-CHANNEL-DISABLE | 渠道停用 | not_clicked_may_write_directly | toggleProviderStatus/toggleChannelStatus未证实先确认后写入；未执行。 当前无停用样本，启用分支未验证 |

表单字段与实际选项：

- **PMS-TEST-BASIC-FLP-NEW-PROVIDER 新增物流商（主按钮）**：编码/名称/简称/国家地区/城市/等级/状态；联系人/电话/邮箱/微信/地址；结算币种/付款方式/账期/开票/银行/收款人；支持运输方式/目的地/报税清关派送/派送方式/备注。选项：中国（已选）、印尼、越南、美国、其他、A级、B级（已选）、C级、临时供应商、启用（已选）、停用、RMB（已选）、USD、IDR、月结（已选）、现结、预付、否（已选）、是。
- **PMS-TEST-BASIC-FLP-NEW-PROVIDER-SIDEBAR 新增物流商（侧栏+新增）**：编码/名称/简称/国家地区/城市/等级/状态；联系人/电话/邮箱/微信/地址；结算币种/付款方式/账期/开票/银行/收款人；支持运输方式/目的地/报税清关派送/派送方式/备注。选项：中国（已选）、印尼、越南、美国、其他、A级、B级（已选）、C级、临时供应商、启用（已选）、停用、RMB（已选）、USD、IDR、月结（已选）、现结、预付、否（已选）、是。
- **PMS-TEST-BASIC-FLP-VIEW-PROVIDER 查看物流商**：编码/名称/简称/国家地区/城市/等级/状态；联系人/电话/邮箱/微信/地址；结算币种/付款方式/账期/开票/银行/收款人；支持运输方式/目的地/报税清关派送/派送方式/备注。选项：只读或未获取可展开选项。
- **PMS-TEST-BASIC-FLP-EDIT-PROVIDER 编辑物流商**：编码/名称/简称/国家地区/城市/等级/状态；联系人/电话/邮箱/微信/地址；结算币种/付款方式/账期/开票/银行/收款人；支持运输方式/目的地/报税清关派送/派送方式/备注。选项：中国（已选）、印尼、越南、美国、其他、A级、B级（已选）、C级、临时供应商、启用（已选）、停用、RMB（已选）、USD、IDR、月结（已选）、现结、预付、否（已选）、是、否、是（已选）。
- **PMS-TEST-BASIC-FLP-NEW-CHANNEL 新建渠道**：所属物流商/编码/名称/运输方式/计费方式/状态；预计/最短/最长运输天数/截单时间/频率；计费重系数/体积重除数/最低KG/单价/币种；交税方式/含税/清关/派送/报税说明；起运地/目的国家地区/适用区域/转运中心；带电液体粉末磁性/单箱重量体积上限/备注。选项：请选择（已选）、海卡、海派、空卡、空派、铁路、快递、卡航、请选择、计费重（已选）、实重、体积、整柜、启用（已选）、停用、RMB（已选）、USD、IDR、报税、不报税、否（已选）、是。
- **PMS-TEST-BASIC-FLP-VIEW-CHANNEL 完整查看渠道**：所属物流商/编码/名称/运输方式/计费方式/状态；预计/最短/最长运输天数/截单时间/频率；计费重系数/体积重除数/最低KG/单价/币种；交税方式/含税/清关/派送/报税说明；起运地/目的国家地区/适用区域/转运中心；带电液体粉末磁性/单箱重量体积上限/备注。选项：请选择、海卡、空卡（已选）、计费重（已选）、实重、体积、整柜、启用（已选）、停用、RMB（已选）、USD、IDR、报税、不报税（已选）、否（已选）、是、否、是（已选）。
- **PMS-TEST-BASIC-FLP-EDIT-CHANNEL 编辑渠道**：所属物流商/编码/名称/运输方式/计费方式/状态；预计/最短/最长运输天数/截单时间/频率；计费重系数/体积重除数/最低KG/单价/币种；交税方式/含税/清关/派送/报税说明；起运地/目的国家地区/适用区域/转运中心；带电液体粉末磁性/单箱重量体积上限/备注。选项：请选择、海卡、空卡（已选）、计费重（已选）、实重、体积、整柜、启用（已选）、停用、RMB（已选）、USD、IDR、报税、不报税（已选）、否（已选）、是、否、是（已选）。
- **PMS-TEST-BASIC-FLP-PROVIDER-SAVE 物流商保存**：编码/名称/简称/国家地区/城市/等级/状态；联系人/电话/邮箱/微信/地址；结算币种/付款方式/账期/开票/银行/收款人；支持运输方式/目的地/报税清关派送/派送方式/备注。选项：中国（已选）、印尼、越南、美国、其他、A级、B级（已选）、C级、临时供应商、启用（已选）、停用、RMB（已选）、USD、IDR、月结（已选）、现结、预付、否（已选）、是。
- **PMS-TEST-BASIC-FLP-CHANNEL-SAVE 渠道保存**：所属物流商/编码/名称/运输方式/计费方式/状态；预计/最短/最长运输天数/截单时间/频率；计费重系数/体积重除数/最低KG/单价/币种；交税方式/含税/清关/派送/报税说明；起运地/目的国家地区/适用区域/转运中心；带电液体粉末磁性/单箱重量体积上限/备注。选项：请选择（已选）、海卡、海派、空卡、空派、铁路、快递、卡航、请选择、计费重（已选）、实重、体积、整柜、启用（已选）、停用、RMB（已选）、USD、IDR、报税、不报税、否（已选）、是。
- **PMS-TEST-BASIC-FLP-MODE-OPTIONS 渠道运输方式候选**：见JSON的实际DOM控件。选项：请选择（已选）、海卡、海派、空卡、空派、铁路、快递、卡航、请选择、计费重（已选）、实重、体积、整柜、启用（已选）、停用、RMB（已选）、USD、IDR、报税、不报税、否（已选）、是。

点击 / 结果证据：

- PMS-TEST-BASIC-FLP-ENTER：[1791882342746-first_leg_logistics_provider-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882342746-first_leg_logistics_provider-list-loaded.txt)。
- PMS-TEST-BASIC-FLP-QUERY：[1791882358872-first_leg_logistics_provider-query-default.txt](/tmp/higoods-pms-test-basic-20261013/1791882358872-first_leg_logistics_provider-query-default.txt)。
- PMS-TEST-BASIC-FLP-RESET：[1791882359991-first_leg_logistics_provider-reset.txt](/tmp/higoods-pms-test-basic-20261013/1791882359991-first_leg_logistics_provider-reset.txt)。
- PMS-TEST-BASIC-FLP-NEW-PROVIDER：[1791882363143-first_leg_logistics_provider-new-provider.txt](/tmp/higoods-pms-test-basic-20261013/1791882363143-first_leg_logistics_provider-new-provider.txt)。
- PMS-TEST-BASIC-FLP-NEW-PROVIDER-SIDEBAR：[1791882473240-first_leg_logistics_provider-new-provider-sidebar.txt](/tmp/higoods-pms-test-basic-20261013/1791882473240-first_leg_logistics_provider-new-provider-sidebar.txt)。
- PMS-TEST-BASIC-FLP-VIEW-PROVIDER：[1791882430046-first_leg_logistics_provider-view-provider.txt](/tmp/higoods-pms-test-basic-20261013/1791882430046-first_leg_logistics_provider-view-provider.txt)。
- PMS-TEST-BASIC-FLP-EDIT-PROVIDER：[1791882433663-first_leg_logistics_provider-edit-provider.txt](/tmp/higoods-pms-test-basic-20261013/1791882433663-first_leg_logistics_provider-edit-provider.txt)。
- PMS-TEST-BASIC-FLP-NEW-CHANNEL：[1791882392172-first_leg_logistics_provider-new-channel.txt](/tmp/higoods-pms-test-basic-20261013/1791882392172-first_leg_logistics_provider-new-channel.txt)、[1791883617294-first_leg_logistics_provider-new-channel-meisen.txt](/tmp/higoods-pms-test-basic-20261013/1791883617294-first_leg_logistics_provider-new-channel-meisen.txt)。
- PMS-TEST-BASIC-FLP-VIEW-CHANNEL：[1791882445265-first_leg_logistics_provider-view-channel.txt](/tmp/higoods-pms-test-basic-20261013/1791882445265-first_leg_logistics_provider-view-channel.txt)。
- PMS-TEST-BASIC-FLP-EDIT-CHANNEL：[1791882448900-first_leg_logistics_provider-edit-channel.txt](/tmp/higoods-pms-test-basic-20261013/1791882448900-first_leg_logistics_provider-edit-channel.txt)。
- PMS-TEST-BASIC-FLP-PROVIDER-SAVE：[1791882363143-first_leg_logistics_provider-new-provider.txt](/tmp/higoods-pms-test-basic-20261013/1791882363143-first_leg_logistics_provider-new-provider.txt)、[1791882433663-first_leg_logistics_provider-edit-provider.txt](/tmp/higoods-pms-test-basic-20261013/1791882433663-first_leg_logistics_provider-edit-provider.txt)、[1791882473240-first_leg_logistics_provider-new-provider-sidebar.txt](/tmp/higoods-pms-test-basic-20261013/1791882473240-first_leg_logistics_provider-new-provider-sidebar.txt)。
- PMS-TEST-BASIC-FLP-CHANNEL-SAVE：[1791882392172-first_leg_logistics_provider-new-channel.txt](/tmp/higoods-pms-test-basic-20261013/1791882392172-first_leg_logistics_provider-new-channel.txt)、[1791882448900-first_leg_logistics_provider-edit-channel.txt](/tmp/higoods-pms-test-basic-20261013/1791882448900-first_leg_logistics_provider-edit-channel.txt)、[1791883617294-first_leg_logistics_provider-new-channel-meisen.txt](/tmp/higoods-pms-test-basic-20261013/1791883617294-first_leg_logistics_provider-new-channel-meisen.txt)。
- PMS-TEST-BASIC-FLP-CHANNEL-CANCEL：[1791882410838-first_leg_logistics_provider-new-channel-cancel.txt](/tmp/higoods-pms-test-basic-20261013/1791882410838-first_leg_logistics_provider-new-channel-cancel.txt)、[1791883668407-first_leg_logistics_provider-new-channel-meisen-cancel.txt](/tmp/higoods-pms-test-basic-20261013/1791883668407-first_leg_logistics_provider-new-channel-meisen-cancel.txt)。
- PMS-TEST-BASIC-FLP-CLOSE-ICONS：[1791882430368-first_leg_logistics_provider-view-provider-close.txt](/tmp/higoods-pms-test-basic-20261013/1791882430368-first_leg_logistics_provider-view-provider-close.txt)、[1791882441958-first_leg_logistics_provider-edit-provider-close.txt](/tmp/higoods-pms-test-basic-20261013/1791882441958-first_leg_logistics_provider-edit-provider-close.txt)、[1791882445610-first_leg_logistics_provider-view-channel-close.txt](/tmp/higoods-pms-test-basic-20261013/1791882445610-first_leg_logistics_provider-view-channel-close.txt)、[1791882469927-first_leg_logistics_provider-edit-channel-close.txt](/tmp/higoods-pms-test-basic-20261013/1791882469927-first_leg_logistics_provider-edit-channel-close.txt)、[1791882473596-first_leg_logistics_provider-new-provider-sidebar-close.txt](/tmp/higoods-pms-test-basic-20261013/1791882473596-first_leg_logistics_provider-new-provider-sidebar-close.txt)。
- PMS-TEST-BASIC-FLP-PROVIDER-SELECT：[1791882474076-first_leg_logistics_provider-provider-select-meisen.txt](/tmp/higoods-pms-test-basic-20261013/1791882474076-first_leg_logistics_provider-provider-select-meisen.txt)、[1791882494626-first_leg_logistics_provider-provider-select-meisen-ready.txt](/tmp/higoods-pms-test-basic-20261013/1791882494626-first_leg_logistics_provider-provider-select-meisen-ready.txt)、[1791883600044-first_leg_logistics_provider-cascade-provider-select-pending.txt](/tmp/higoods-pms-test-basic-20261013/1791883600044-first_leg_logistics_provider-cascade-provider-select-pending.txt)、[1791883600365-first_leg_logistics_provider-cascade-provider-select-ready.txt](/tmp/higoods-pms-test-basic-20261013/1791883600365-first_leg_logistics_provider-cascade-provider-select-ready.txt)。
- PMS-TEST-BASIC-FLP-CHANNEL-SELECT：[1791883600690-first_leg_logistics_provider-cascade-channel-select.txt](/tmp/higoods-pms-test-basic-20261013/1791883600690-first_leg_logistics_provider-cascade-channel-select.txt)、[1791883614154-first_leg_logistics_provider-cascade-channel-select-ready.txt](/tmp/higoods-pms-test-basic-20261013/1791883614154-first_leg_logistics_provider-cascade-channel-select-ready.txt)。
- PMS-TEST-BASIC-FLP-MODE-OPTIONS：[1791882392172-first_leg_logistics_provider-new-channel.txt](/tmp/higoods-pms-test-basic-20261013/1791882392172-first_leg_logistics_provider-new-channel.txt)、[1791883617294-first_leg_logistics_provider-new-channel-meisen.txt](/tmp/higoods-pms-test-basic-20261013/1791883617294-first_leg_logistics_provider-new-channel-meisen.txt)。
- PMS-TEST-BASIC-FLP-DATA-RANGE：[1791883614154-first_leg_logistics_provider-cascade-channel-select-ready.txt](/tmp/higoods-pms-test-basic-20261013/1791883614154-first_leg_logistics_provider-cascade-channel-select-ready.txt)。
- PMS-TEST-BASIC-FLP-PROVIDER-DISABLE：[1791882342746-first_leg_logistics_provider-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882342746-first_leg_logistics_provider-list-loaded.txt)。
- PMS-TEST-BASIC-FLP-CHANNEL-DISABLE：[1791882342746-first_leg_logistics_provider-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882342746-first_leg_logistics_provider-list-loaded.txt)。

## 面辅料列表

测试地址：[http://test_manage.higood.ai/pms/material_manage/index](http://test_manage.higood.ai/pms/material_manage/index)。原型：[material-archives.ts](/Users/laoer/.codex/worktrees/7eaf/higoods/src/pages/pms/material-archives.ts)。

列表字段：SPU；SKU；物料名称；物料分类；规格型号；颜色/色号；单位；采购单位；库存单位；默认供应商；是否需质检；状态；创建人；创建时间；操作。

分页原始摘要：无分页摘要或页面未加载。

| 编号 | 按钮 / 功能 | 状态 | 实际结果与边界 |
|---|---|---|---|
| PMS-TEST-BASIC-MAT-ENTER | 页面进入 | entered_empty_list | 页面已实际到达；导航初始捕获与真实URL不一致者只依实际URL归属。  |
| PMS-TEST-BASIC-MAT-QUERY | 查询 | clicked_query | 已执行默认查询及保存的筛选边界；选项仅记录实际DOM，不推断组合结果。  |
| PMS-TEST-BASIC-MAT-RESET | 清除/重置/清空查询 | clicked_reset | 恢复约定默认条件与列表；供货档案/样衣用重置，物流商用清空，其余用清除。  |
| PMS-TEST-BASIC-MAT-CLASS-FILTER | 选择面料分类 | clicked_local_query_change | 全量和面料分类结果均暂无数据。  |
| PMS-TEST-BASIC-MAT-ROWS | 行查看/编辑/图片/分页 | no_sample_branch | 测试无物料样本，无法进入行操作或图片。当前只见查询/清除，没有新增、导出或同步入口。  |

表单字段与实际选项：


点击 / 结果证据：

- PMS-TEST-BASIC-MAT-ENTER：[1791882495479-material_manage-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882495479-material_manage-list-loaded.txt)。
- PMS-TEST-BASIC-MAT-QUERY：[1791882519092-material_manage-query-default-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791882519092-material_manage-query-default-empty.txt)、[1791882519955-material_manage-query-fabric-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791882519955-material_manage-query-fabric-empty.txt)。
- PMS-TEST-BASIC-MAT-RESET：[1791882521042-material_manage-reset-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791882521042-material_manage-reset-empty.txt)。
- PMS-TEST-BASIC-MAT-CLASS-FILTER：[1791882519132-material_manage-filter-fabric.txt](/tmp/higoods-pms-test-basic-20261013/1791882519132-material_manage-filter-fabric.txt)、[1791882519955-material_manage-query-fabric-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791882519955-material_manage-query-fabric-empty.txt)。
- PMS-TEST-BASIC-MAT-ROWS：[1791882495479-material_manage-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882495479-material_manage-list-loaded.txt)、[1791882519955-material_manage-query-fabric-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791882519955-material_manage-query-fabric-empty.txt)、[1791882521042-material_manage-reset-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791882521042-material_manage-reset-empty.txt)。

## 成衣列表

测试地址：[http://test_manage.higood.ai/pms/garment_manage/index](http://test_manage.higood.ai/pms/garment_manage/index)。原型：[product-skus.ts](/Users/laoer/.codex/worktrees/7eaf/higoods/src/pages/pms/product-skus.ts)。

列表字段：图片；SPU；SKU；物料名称；规格型号；颜色/色号；单位；采购单位；状态；创建人；创建时间；操作。

分页原始摘要：- generic: 共 2 条，第 1 页 / 共 1 页。

| 编号 | 按钮 / 功能 | 状态 | 实际结果与边界 |
|---|---|---|---|
| PMS-TEST-BASIC-GAR-ENTER | 页面进入 | entered_list | 页面已实际到达；导航初始捕获与真实URL不一致者只依实际URL归属。  |
| PMS-TEST-BASIC-GAR-QUERY | 查询 | clicked_query | 已执行默认查询及保存的筛选边界；选项仅记录实际DOM，不推断组合结果。  |
| PMS-TEST-BASIC-GAR-RESET | 清除/重置/清空查询 | clicked_reset | 恢复约定默认条件与列表；供货档案/样衣用重置，物流商用清空，其余用清除。  |
| PMS-TEST-BASIC-GAR-SIZE | 每页条数 | clicked_query | 实际选择10条；仅分页偏好/查询操作。  |
| PMS-TEST-BASIC-GAR-JUMP | 输入页码并确定跳转 | clicked_query | 实际请求第2页：供应商/供货档案/成衣/样衣只有1页时落回第1页，仓库可到第2页；以每份URL及统计为准。  |
| PMS-TEST-BASIC-GAR-VIEW | 查看成衣 | clicked_opened | White/M详情只读已打开。  |
| PMS-TEST-BASIC-GAR-VIEW-CLOSE | 详情关闭 | clicked_cancelled | 详情关闭后回列表。  |
| PMS-TEST-BASIC-GAR-IMAGE-LIST | 列表图片原图 | clicked_asset_new_tab_opened_closed | 实际打开已观察官方CDN原图新tab并关闭，白色SKU对应白色花边长裙。 在线为新浏览器tab预览；无网页遮罩/关闭，Esc工具未成功派发，不能称已验证；原型须依AGENTS做弹窗/Esc |
| PMS-TEST-BASIC-GAR-IMAGE-DETAIL | 详情图片原图 | clicked_asset_new_tab_opened_closed | 详情也实际打开同一白色原图并关闭；不是只见链接。  |
| PMS-TEST-BASIC-GAR-READONLY | 新增/编辑/同步等入口 | not_present_in_observed_page | 当前仅查看成衣资料，列表无新增、编辑、导出或同步按钮；不据此证明后台能力不存在。  |

表单字段与实际选项：

- **PMS-TEST-BASIC-GAR-VIEW 查看成衣**：图片/SPU/SKU/名称/规格/颜色色号/单位/采购单位/状态/创建人时间/款式名称。选项：只读或未获取可展开选项。

点击 / 结果证据：

- PMS-TEST-BASIC-GAR-ENTER：[1791882521741-garment_manage-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882521741-garment_manage-list-loaded.txt)。
- PMS-TEST-BASIC-GAR-QUERY：[1791882583799-garment_manage-query-default.txt](/tmp/higoods-pms-test-basic-20261013/1791882583799-garment_manage-query-default.txt)、[1791882643056-garment_manage-query-enabled-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791882643056-garment_manage-query-enabled-empty.txt)。
- PMS-TEST-BASIC-GAR-RESET：[1791882584616-garment_manage-reset.txt](/tmp/higoods-pms-test-basic-20261013/1791882584616-garment_manage-reset.txt)、[1791882643632-garment_manage-reset-after-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791882643632-garment_manage-reset-after-empty.txt)。
- PMS-TEST-BASIC-GAR-SIZE：[1791882644311-garment_manage-page-size-10.txt](/tmp/higoods-pms-test-basic-20261013/1791882644311-garment_manage-page-size-10.txt)。
- PMS-TEST-BASIC-GAR-JUMP：[1791882644352-garment_manage-page-jump-enter-2.txt](/tmp/higoods-pms-test-basic-20261013/1791882644352-garment_manage-page-jump-enter-2.txt)、[1791882645007-garment_manage-page-jump-submit-2.txt](/tmp/higoods-pms-test-basic-20261013/1791882645007-garment_manage-page-jump-submit-2.txt)。
- PMS-TEST-BASIC-GAR-VIEW：[1791882587750-garment_manage-view.txt](/tmp/higoods-pms-test-basic-20261013/1791882587750-garment_manage-view.txt)、[1791883184401-garment_manage-image-revisit-detail.txt](/tmp/higoods-pms-test-basic-20261013/1791883184401-garment_manage-image-revisit-detail.txt)。
- PMS-TEST-BASIC-GAR-VIEW-CLOSE：[1791882642256-garment_manage-view-close.txt](/tmp/higoods-pms-test-basic-20261013/1791882642256-garment_manage-view-close.txt)、[1791883243532-garment_manage-detail-image-revisit-close.txt](/tmp/higoods-pms-test-basic-20261013/1791883243532-garment_manage-detail-image-revisit-close.txt)。
- PMS-TEST-BASIC-GAR-IMAGE-LIST：[1791883147584-garment_manage-list-image-white-open.txt](/tmp/higoods-pms-test-basic-20261013/1791883147584-garment_manage-list-image-white-open.txt)、[1791883181274-garment_manage-list-image-white-close-tab.txt](/tmp/higoods-pms-test-basic-20261013/1791883181274-garment_manage-list-image-white-close-tab.txt)。
- PMS-TEST-BASIC-GAR-IMAGE-DETAIL：[1791883184818-garment_manage-detail-image-white-open.txt](/tmp/higoods-pms-test-basic-20261013/1791883184818-garment_manage-detail-image-white-open.txt)、[1791883243217-garment_manage-detail-image-white-close-tab.txt](/tmp/higoods-pms-test-basic-20261013/1791883243217-garment_manage-detail-image-white-close-tab.txt)。
- PMS-TEST-BASIC-GAR-READONLY：[1791882521741-garment_manage-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882521741-garment_manage-list-loaded.txt)、[1791882587750-garment_manage-view.txt](/tmp/higoods-pms-test-basic-20261013/1791882587750-garment_manage-view.txt)。

## 样衣列表

测试地址：[http://test_manage.higood.ai/pms/sample_manage/index](http://test_manage.higood.ai/pms/sample_manage/index)。原型：[product-skus.ts](/Users/laoer/.codex/worktrees/7eaf/higoods/src/pages/pms/product-skus.ts)。

列表字段：商品图片；SPU；样衣SKU；商品名称；颜色；尺码；基础单位；默认采购单位；默认供应商；标准采购价；状态；创建时间；更新时间；操作。

分页原始摘要：- generic: 共 2 条，第 1 页 / 共 1 页。

| 编号 | 按钮 / 功能 | 状态 | 实际结果与边界 |
|---|---|---|---|
| PMS-TEST-BASIC-SAM-ENTER | 页面进入 | entered_list | 页面已实际到达；导航初始捕获与真实URL不一致者只依实际URL归属。  |
| PMS-TEST-BASIC-SAM-QUERY | 查询 | clicked_query | 已执行默认查询及保存的筛选边界；选项仅记录实际DOM，不推断组合结果。  |
| PMS-TEST-BASIC-SAM-RESET | 清除/重置/清空查询 | clicked_reset | 恢复约定默认条件与列表；供货档案/样衣用重置，物流商用清空，其余用清除。  |
| PMS-TEST-BASIC-SAM-SIZE | 每页条数 | clicked_query | 实际选择10条；仅分页偏好/查询操作。  |
| PMS-TEST-BASIC-SAM-JUMP | 输入页码并确定跳转 | clicked_query | 实际请求第2页：供应商/供货档案/成衣/样衣只有1页时落回第1页，仓库可到第2页；以每份URL及统计为准。  |
| PMS-TEST-BASIC-SAM-VIEW | 查看样衣 | clicked_opened | White/M样衣详情只读已打开。  |
| PMS-TEST-BASIC-SAM-VIEW-CLOSE | 外层关闭图标 | clicked_cancelled | 未修改样衣数据。  |
| PMS-TEST-BASIC-SAM-IMAGE-DETAIL | 详情白色原图 | clicked_asset_new_tab_opened_closed | 白色原图1440x1920已视读并关闭。 Esc尝试工具未成功，保持未验证；原图页资产能力未发现原图可bundleID |
| PMS-TEST-BASIC-SAM-IMAGE-LIST | 列表黑色原图 | clicked_asset_new_tab_opened_closed | 黑色同款原图294x507已视读并关闭，不冒称高清。  |
| PMS-TEST-BASIC-SAM-DATE-OPEN | 开始日期选择器 | clicked_opened | 实际日历已展开，10月2026年、当前日期13日。  |
| PMS-TEST-BASIC-SAM-DATE-CONFIRM | 日期确定 | clicked_local_query_change | 确认当前所选日期；仅查询输入未保存业务数据。  |
| PMS-TEST-BASIC-SAM-DATE-CLEAR | 日期清空 | clicked_local_query_change | 实际清空日期。  |
| PMS-TEST-BASIC-SAM-END-DATE | 结束日期选择器 | observed_only | 输入控件已见，未单独打开结束日期或逐个日历导航按钮；仍列待核查。  |
| PMS-TEST-BASIC-SAM-EXPORT | 导出 | clicked_csv_response_rendered | 导航后浏览器返回CSV文本，表头及2个当前SKU均可读；不称本地文件已下载保存。  |

表单字段与实际选项：

- **PMS-TEST-BASIC-SAM-VIEW 查看样衣**：图片/SPU/样衣SKU/名称/分类/颜色尺码/状态；基础单位/采购单位/供应商/采购价币种/采购区域；包装单位/每箱件数/单箱重量体积/箱规；来源系统/创建更新时间/同步时间。选项：只读或未获取可展开选项。

点击 / 结果证据：

- PMS-TEST-BASIC-SAM-ENTER：[1791882645675-sample_manage-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882645675-sample_manage-list-loaded.txt)。
- PMS-TEST-BASIC-SAM-QUERY：[1791882671412-sample_manage-query-default.txt](/tmp/higoods-pms-test-basic-20261013/1791882671412-sample_manage-query-default.txt)、[1791882900986-sample_manage-query-enabled-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791882900986-sample_manage-query-enabled-empty.txt)。
- PMS-TEST-BASIC-SAM-RESET：[1791882672499-sample_manage-reset.txt](/tmp/higoods-pms-test-basic-20261013/1791882672499-sample_manage-reset.txt)、[1791882901711-sample_manage-reset-after-empty.txt](/tmp/higoods-pms-test-basic-20261013/1791882901711-sample_manage-reset-after-empty.txt)。
- PMS-TEST-BASIC-SAM-SIZE：[1791882902621-sample_manage-page-size-10.txt](/tmp/higoods-pms-test-basic-20261013/1791882902621-sample_manage-page-size-10.txt)。
- PMS-TEST-BASIC-SAM-JUMP：[1791882902667-sample_manage-page-jump-enter-2.txt](/tmp/higoods-pms-test-basic-20261013/1791882902667-sample_manage-page-jump-enter-2.txt)、[1791882903304-sample_manage-page-jump-submit-2.txt](/tmp/higoods-pms-test-basic-20261013/1791882903304-sample_manage-page-jump-submit-2.txt)。
- PMS-TEST-BASIC-SAM-VIEW：[1791882675696-sample_manage-view.txt](/tmp/higoods-pms-test-basic-20261013/1791882675696-sample_manage-view.txt)。
- PMS-TEST-BASIC-SAM-VIEW-CLOSE：[1791882793285-sample_manage-view-close-icon.txt](/tmp/higoods-pms-test-basic-20261013/1791882793285-sample_manage-view-close-icon.txt)。
- PMS-TEST-BASIC-SAM-IMAGE-DETAIL：[1791882724184-sample_manage-view-image-open.txt](/tmp/higoods-pms-test-basic-20261013/1791882724184-sample_manage-view-image-open.txt)、[1791882792927-sample_manage-view-image-close-tab.txt](/tmp/higoods-pms-test-basic-20261013/1791882792927-sample_manage-view-image-close-tab.txt)。
- PMS-TEST-BASIC-SAM-IMAGE-LIST：[1791882806471-sample_manage-black-image-open.txt](/tmp/higoods-pms-test-basic-20261013/1791882806471-sample_manage-black-image-open.txt)、[1791882816467-sample_manage-black-image-close-tab.txt](/tmp/higoods-pms-test-basic-20261013/1791882816467-sample_manage-black-image-close-tab.txt)。
- PMS-TEST-BASIC-SAM-DATE-OPEN：[1791882869591-sample_manage-start-date-picker.txt](/tmp/higoods-pms-test-basic-20261013/1791882869591-sample_manage-start-date-picker.txt)、[1791882899963-sample_manage-start-date-reopen.txt](/tmp/higoods-pms-test-basic-20261013/1791882899963-sample_manage-start-date-reopen.txt)。
- PMS-TEST-BASIC-SAM-DATE-CONFIRM：[1791882899603-sample_manage-start-date-confirm.txt](/tmp/higoods-pms-test-basic-20261013/1791882899603-sample_manage-start-date-confirm.txt)。
- PMS-TEST-BASIC-SAM-DATE-CLEAR：[1791882900318-sample_manage-start-date-clear.txt](/tmp/higoods-pms-test-basic-20261013/1791882900318-sample_manage-start-date-clear.txt)。
- PMS-TEST-BASIC-SAM-END-DATE：[1791882645675-sample_manage-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882645675-sample_manage-list-loaded.txt)。
- PMS-TEST-BASIC-SAM-EXPORT：[1791882842019-sample_manage-export.txt](/tmp/higoods-pms-test-basic-20261013/1791882842019-sample_manage-export.txt)。

## 仓库管理

测试地址：[http://test_manage.higood.ai/pms/warehouse_manage/index](http://test_manage.higood.ai/pms/warehouse_manage/index)。原型：[warehouses.ts](/Users/laoer/.codex/worktrees/7eaf/higoods/src/pages/pms/warehouses.ts)。

列表字段：仓库编码；仓库名称；仓库类型；仓库属性；主体；国家；时区；城市；仓库负责人；联系电话；收货地址；是否启用；来源系统；最后同步时间；操作。

分页原始摘要：- generic: 共 17 条，第 1 页 / 共 2 页。

| 编号 | 按钮 / 功能 | 状态 | 实际结果与边界 |
|---|---|---|---|
| PMS-TEST-BASIC-WH-ENTER | 页面进入 | entered_list | 页面已实际到达；导航初始捕获与真实URL不一致者只依实际URL归属。  |
| PMS-TEST-BASIC-WH-QUERY | 查询 | clicked_query | 已执行默认查询及保存的筛选边界；选项仅记录实际DOM，不推断组合结果。  |
| PMS-TEST-BASIC-WH-RESET | 清除/重置/清空查询 | clicked_reset | 恢复约定默认条件与列表；供货档案/样衣用重置，物流商用清空，其余用清除。  |
| PMS-TEST-BASIC-WH-SIZE | 每页条数 | clicked_query | 实际选择10条；仅分页偏好/查询操作。  |
| PMS-TEST-BASIC-WH-JUMP | 输入页码并确定跳转 | clicked_query | 实际请求第2页：供应商/供货档案/成衣/样衣只有1页时落回第1页，仓库可到第2页；以每份URL及统计为准。  |
| PMS-TEST-BASIC-WH-VIEW | 查看仓库 | clicked_opened | 完整只读仓库详情已打开。  |
| PMS-TEST-BASIC-WH-CODE-LINK | 仓库编码链接 | clicked_opened | 编码链接也打开仓库详情。  |
| PMS-TEST-BASIC-WH-VIEW-CLOSE | 详情外层关闭图标 | clicked_cancelled | 实际回列表。  |
| PMS-TEST-BASIC-WH-NEXT | 下一页 | clicked_query | 17条真实两页已验证目标页结果。  |
| PMS-TEST-BASIC-WH-PREV | 上一页 | clicked_query | 17条真实两页已验证目标页结果。  |
| PMS-TEST-BASIC-WH-PAGE2 | 数字页码2 | clicked_query | 17条真实两页已验证目标页结果。  |
| PMS-TEST-BASIC-WH-PAGE1 | 数字页码1 | clicked_query | 17条真实两页已验证目标页结果。  |
| PMS-TEST-BASIC-WH-READONLY | 仓库维护入口 | not_present_in_observed_page | 页面只读引用WMS资料，无新增、编辑、启停或同步提交入口。  |

表单字段与实际选项：

- **PMS-TEST-BASIC-WH-VIEW 查看仓库**：仓库编码/名称/类型/属性/主体/状态/来源与同步时间；国家/时区/城市/邮编/收货地址；负责人/电话/邮箱；采购申请与采购单与发货目标仓可引用/关联订单量/最近引用；来源仓库编码/同步状态与备注。选项：只读或未获取可展开选项。
- **PMS-TEST-BASIC-WH-CODE-LINK 仓库编码链接**：仓库编码/名称/类型/属性/主体/状态/来源与同步时间；国家/时区/城市/邮编/收货地址；负责人/电话/邮箱；采购申请与采购单与发货目标仓可引用/关联订单量/最近引用；来源仓库编码/同步状态与备注。选项：只读或未获取可展开选项。

点击 / 结果证据：

- PMS-TEST-BASIC-WH-ENTER：[1791882903997-warehouse_manage-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882903997-warehouse_manage-list-loaded.txt)。
- PMS-TEST-BASIC-WH-QUERY：[1791882928239-warehouse_manage-query-default.txt](/tmp/higoods-pms-test-basic-20261013/1791882928239-warehouse_manage-query-default.txt)。
- PMS-TEST-BASIC-WH-RESET：[1791882928906-warehouse_manage-reset.txt](/tmp/higoods-pms-test-basic-20261013/1791882928906-warehouse_manage-reset.txt)。
- PMS-TEST-BASIC-WH-SIZE：[1791882976364-warehouse_manage-page-size-10.txt](/tmp/higoods-pms-test-basic-20261013/1791882976364-warehouse_manage-page-size-10.txt)。
- PMS-TEST-BASIC-WH-JUMP：[1791882976417-warehouse_manage-page-jump-enter-2.txt](/tmp/higoods-pms-test-basic-20261013/1791882976417-warehouse_manage-page-jump-enter-2.txt)、[1791882976952-warehouse_manage-page-jump-submit-2.txt](/tmp/higoods-pms-test-basic-20261013/1791882976952-warehouse_manage-page-jump-submit-2.txt)。
- PMS-TEST-BASIC-WH-VIEW：[1791882929752-warehouse_manage-view.txt](/tmp/higoods-pms-test-basic-20261013/1791882929752-warehouse_manage-view.txt)。
- PMS-TEST-BASIC-WH-CODE-LINK：[1791882933429-warehouse_manage-code-link-view.txt](/tmp/higoods-pms-test-basic-20261013/1791882933429-warehouse_manage-code-link-view.txt)。
- PMS-TEST-BASIC-WH-VIEW-CLOSE：[1791882930103-warehouse_manage-view-close-icon.txt](/tmp/higoods-pms-test-basic-20261013/1791882930103-warehouse_manage-view-close-icon.txt)、[1791882933784-warehouse_manage-code-link-close-icon.txt](/tmp/higoods-pms-test-basic-20261013/1791882933784-warehouse_manage-code-link-close-icon.txt)。
- PMS-TEST-BASIC-WH-NEXT：[1791882934555-warehouse_manage-next-page.txt](/tmp/higoods-pms-test-basic-20261013/1791882934555-warehouse_manage-next-page.txt)、[1791882943409-warehouse_manage-next-page-ready.txt](/tmp/higoods-pms-test-basic-20261013/1791882943409-warehouse_manage-next-page-ready.txt)。
- PMS-TEST-BASIC-WH-PREV：[1791882973229-warehouse_manage-previous-page.txt](/tmp/higoods-pms-test-basic-20261013/1791882973229-warehouse_manage-previous-page.txt)。
- PMS-TEST-BASIC-WH-PAGE2：[1791882975027-warehouse_manage-numeric-page-2.txt](/tmp/higoods-pms-test-basic-20261013/1791882975027-warehouse_manage-numeric-page-2.txt)。
- PMS-TEST-BASIC-WH-PAGE1：[1791882975745-warehouse_manage-numeric-page-1.txt](/tmp/higoods-pms-test-basic-20261013/1791882975745-warehouse_manage-numeric-page-1.txt)。
- PMS-TEST-BASIC-WH-READONLY：[1791882903997-warehouse_manage-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882903997-warehouse_manage-list-loaded.txt)、[1791882929752-warehouse_manage-view.txt](/tmp/higoods-pms-test-basic-20261013/1791882929752-warehouse_manage-view.txt)。

## 单位管理

测试地址：[http://test_manage.higood.ai/pms/unit_manage/index](http://test_manage.higood.ai/pms/unit_manage/index)。原型：[units.ts](/Users/laoer/.codex/worktrees/7eaf/higoods/src/pages/pms/units.ts)。

列表字段：页面404，未取得字段。

分页原始摘要：无分页摘要或页面未加载。

| 编号 | 按钮 / 功能 | 状态 | 实际结果与边界 |
|---|---|---|---|
| PMS-TEST-BASIC-UNT-ENTER | 菜单进入 | route_404 | 已观察测试菜单URL实际返回nginx404，页面未加载。 无法核查列表、表单、页签、图片或打印；不猜URL，不用正式环境替代 |

表单字段与实际选项：


点击 / 结果证据：

- PMS-TEST-BASIC-UNT-ENTER：[1791882977650-unit_manage-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791882977650-unit_manage-list-loaded.txt)、[1791882985565-unit_manage-list-ready.txt](/tmp/higoods-pms-test-basic-20261013/1791882985565-unit_manage-list-ready.txt)。

## BOM/样板管理

测试地址：[http://test_manage.higood.ai/admin/bom_manage/index](http://test_manage.higood.ai/admin/bom_manage/index)。原型：[bom-templates.ts](/Users/laoer/.codex/worktrees/7eaf/higoods/src/pages/pms/bom-templates.ts)。

列表字段：页面404，未取得字段。

分页原始摘要：无分页摘要或页面未加载。

| 编号 | 按钮 / 功能 | 状态 | 实际结果与边界 |
|---|---|---|---|
| PMS-TEST-BASIC-BOM-ENTER | 菜单进入 | route_404 | 已观察测试菜单URL实际返回nginx404，页面未加载。 无法核查列表、表单、页签、图片或打印；不猜URL，不用正式环境替代 |

表单字段与实际选项：


点击 / 结果证据：

- PMS-TEST-BASIC-BOM-ENTER：[1791883023406-bom_manage-list-loaded.txt](/tmp/higoods-pms-test-basic-20261013/1791883023406-bom_manage-list-loaded.txt)。

## 图片对象对应

[独立图片来源与截图记录](/tmp/higoods-pms-test-basic-20261013/image-object-map.md)，机器可读表位于 [image-object-map.json](/tmp/higoods-pms-test-basic-20261013/image-object-map.json)。白色1440×1920、黑色294×507原图都实际打开并视读后关闭。当前本地素材只有原页面观察到的缩略图；原图资产能力没有提供可bundleID。

## 尚未覆盖与实施边界

- 单位管理/BOM测试404，未取得功能清单；需目标测试页面可用后继续。
- 面辅料无样本，行详情/编辑/图片/分页分支未核查。
- 若需核查停用/复制/审核等，先有明确提交前确认的安全入口或只读业务说明；当前未点直写风险按钮。
- 供货档案模板下载结果不足、导出服务器报错；未验证上传解析/最终导入。
- 部分条件状态/结束日期/日历导航/文件保存与写后回读未核查。
- 原图页素材能力不提供原图，当前只有明确对象缩略图落地；原图Esc未验证。
- 原型逐动作一致性与实施验收待主代理后续完成，本文件不冒称已实现。

JSON保存每一次捕获的实际URL、时间、modal名称、控件、选项及SHA；出现filename与URL不同的旧/延迟捕获以实际内容归属。初始可见不等于点击，已开表单不等于最后提交，更不等于已实施。所有文件的完整SHA manifest见JSON sourceManifest。
