# 面辅料四页检查点恢复 · 只读草稿

测试域 http://test_manage.higood.ai；原检查点 143 条（需求82、采购单61）；恢复 157 份raw，补纳 15 份未映射raw，共 160 项SHA来源。在ops保存集合内只进入2页；跟踪/时效无ops原始记录。root后续新证据在别的目录，不能将此检查点状态冒称全任务当前进度。截止原始证据 2026-10-13T09:56:09.638Z。未实施，未操作浏览器。

opened 是旧代理声明，不能代替真正表单载入；JSON保留实际标题/字段/候选/门禁/确认与旧声明。所有最终业务写入未执行。

## 原清单之后/未映射的内容

| 原始证据 | 实际弹窗/结果 | 已见子动作 |
|---|---|---|
| [1791884355092-material-orders-列表.txt](/tmp/higoods-pms-test-ops-20261013/material/1791884355092-material-orders-列表.txt) | list_query_or_dropdown |  |
| [1791885166242-material-orders-导入快递信息.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885166242-material-orders-导入快递信息.txt) | 导入快递信息 | 下载快递信息导入模板, 上传 xls / xlsx, 清空, 确认导入 |
| [1791885179539-material-orders-下载快递信息导入模板.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885179539-material-orders-下载快递信息导入模板.txt) | 导入快递信息 | 下载快递信息导入模板, 上传 xls / xlsx, 清空, 确认导入 |
| [1791885180462-material-orders-快递导入-清空.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885180462-material-orders-快递导入-清空.txt) | 导入快递信息 | 下载快递信息导入模板, 上传 xls / xlsx, 清空, 确认导入 |
| [1791885193745-material-orders-导入快递信息.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885193745-material-orders-导入快递信息.txt) | 导入快递信息 | 下载快递信息导入模板, 上传 xls / xlsx, 清空, 确认导入 |
| [1791885194499-material-orders-快递导入-选择文件.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885194499-material-orders-快递导入-选择文件.txt) | 导入快递信息 | 下载快递信息导入模板, 上传 xls / xlsx, 清空, 确认导入 |
| [1791885204342-material-orders- 面料采购.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885204342-material-orders- 面料采购.txt) | 面料采购 |  |
| [1791885205984-material-orders- 面料采购-有效SPU.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885205984-material-orders- 面料采购-有效SPU.txt) | 面料采购 | 添加, 重置 |
| [1791885208368-material-orders- 物料采购.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885208368-material-orders- 物料采购.txt) | 物料采购 |  |
| [1791885209871-material-orders- 物料采购-有效SPU.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885209871-material-orders- 物料采购-有效SPU.txt) | 物料采购 | 添加, 重置 |
| [1791885212362-material-orders- 辅料采购.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885212362-material-orders- 辅料采购.txt) | 辅料采购 |  |
| [1791885213851-material-orders- 辅料采购-有效SPU.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885213851-material-orders- 辅料采购-有效SPU.txt) | 辅料采购 | 添加, 重置 |
| [1791885228573-material-orders-打印采购详情-入口.txt](/tmp/higoods-pms-test-ops-20261013/material/1791885228573-material-orders-打印采购详情-入口.txt) | list_query_or_dropdown |  |
| [download-import-template-native.txt](/tmp/higoods-pms-test-ops-20261013/material/download-import-template-native.txt) | native_local_save_dialog_reported_not_saved |  |
| [print-purchase-7822-native.txt](/tmp/higoods-pms-test-ops-20261013/material/print-purchase-7822-native.txt) | native_tree_unchanged_only_focus_save |  |

打印PNG已视读：Chrome1页打印预览，单号7822、CNIDML076、四面弹120g S98、计划11,111、实际/入库0；图片与明细已排版。上层模板另存窗未保存，不能算PDF完成。

![7822打印预览证据](/tmp/higoods-pms-test-ops-20261013/material/print-purchase-7822-native.png)

## 主代理接续顺序

### 面辅料需求分析

http://test_manage.higood.ai/pms/material_purchase_demand/index — partially_checked

- 检索条件/多选/起止日期选择器候选、查询结果（状态8类及重置/每页20/跳1已取证）
- 边界：刷新需求及选中批量确认实际采购价可能直接写入，禁止尝试
- 边界：所有最终添加/确定/上传/入库/关联/驳回/印染/物流提交未执行

### 面辅料采购单

http://test_manage.higood.ai/pms/material_purchase_order/index — partially_checked

- 导出采购单明细
- 导出采购单
- 面辅料结算导出
- 导出原料入库明细
- 查询/默认与各筛选候选
- 分页/每页/页码跳转
- 行打印明细（需先确认纯预览）
- 辅料预添加快递信息
- SPU与入库数量链接（先确认仅打开明细）
- 边界：转辅料/复制/删除与已点转原料/复制采购单不是相同标签；未证明提交前确认则不执行可能直写
- 边界：主面料/物料/辅料采购已有效SPU载入，添加未执行；重置尚无独立raw
- 边界：快递导入上传只打开文件选择；不上传，不确认导入

### 面辅料采购跟踪

http://test_manage.higood.ai/pms/material_purchase_track/index — not_entered

- 整页首次进入后逐按钮核查；无raw，不能用菜单文字证明页面已检查

### 面辅料采购时效

http://test_manage.higood.ai/pms/fitting_timeliness/index — not_entered

- 整页首次进入后逐按钮核查；无raw，不能用菜单文字证明页面已检查

完整fields/options/原始状态/晚到内容/SHA manifest见JSON；此草稿仅辅助接续，不声称所有功能核查完成。
