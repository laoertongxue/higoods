# 测试环境采购业务9页逐按钮核查清单

核查环境：`http://test_manage.higood.ai`，日期：2026-10-13。9页，136条功能清单，124次观察，120份原始证据。

所有业务最终写入、上传、同步及未证实无写入的打印入口均未执行。`opened` 只证明表单或详情已实际显示；`observed` 只证明可见能力；`query` 证明只读查询；没有模拟业务完成。

测试站已确认限制：KOL四页均0条；供应商确认单1条未确认；头程2条均待交货。供应商确认导出出现 `Call to undefined method think\response\File::delete()`。其余导出点击未获下载回执。

| 编号 | 页面 | 功能 | 实际结果/边界 | 状态 | 证据 |
|---|---|---|---|---|---|
| PMS-OPS-001 | 面辅料供应商确认单 | 查询 | 默认条件查询后共1条 | query | [1791881855616-supplier-confirmations-查询.txt](/tmp/higoods-pms-test-ops-20261013/1791881855616-supplier-confirmations-查询.txt) |
| PMS-OPS-002 | 面辅料供应商确认单 | 重置 | 恢复默认标签状态未生成、每页100条 | query | [1791881856506-supplier-confirmations-重置.txt](/tmp/higoods-pms-test-ops-20261013/1791881856506-supplier-confirmations-重置.txt) |
| PMS-OPS-003 | 面辅料供应商确认单 | 查看确认单 | 确认单详情 | opened | [1791881740255-supplier-confirmations-查看.txt](/tmp/higoods-pms-test-ops-20261013/1791881740255-supplier-confirmations-查看.txt) |
| PMS-OPS-004 | 面辅料供应商确认单 | 编辑确认单 | 实际发货数量/包装数量必填；箱数、重量、体积、发货日期、发货备注、采购备注、内部备注；卷号与箱规表；取消、保存草稿、保存并确认、供应商确认、生成卷号、打印标签。后六个可能写入未执行。 | opened | [1791881800895-supplier-confirmations-编辑再次.txt](/tmp/higoods-pms-test-ops-20261013/1791881800895-supplier-confirmations-编辑再次.txt) |
| PMS-OPS-005 | 面辅料供应商确认单 | 操作日志 | 同步来源、时间、操作人、类型、内容、备注 | opened | [1791881819345-supplier-confirmations-操作日志.txt](/tmp/higoods-pms-test-ops-20261013/1791881819345-supplier-confirmations-操作日志.txt) |
| PMS-OPS-006 | 面辅料供应商确认单 | 导出 | 导出报 Call to undefined method think\response\File::delete()，无下载 | site_error | [1791881859590-supplier-confirmations-导出.txt](/tmp/higoods-pms-test-ops-20261013/1791881859590-supplier-confirmations-导出.txt) |
| PMS-OPS-007 | 面辅料供应商确认单 | 批量打印标签空选 | 未选确认单的校验提示 | empty_guard | [1791881842685-supplier-confirmations-批量打印标签空选.txt](/tmp/higoods-pms-test-ops-20261013/1791881842685-supplier-confirmations-批量打印标签空选.txt) |
| PMS-OPS-008 | 面辅料供应商确认单 | 每页条数 | 切换10条 | query | [1791882863392-supplier-confirmations-每页10.txt](/tmp/higoods-pms-test-ops-20261013/1791882863392-supplier-confirmations-每页10.txt) |
| PMS-OPS-009 | 面辅料供应商确认单 | 跳转页码 | 输入第1页并跳转 | query | [1791882864104-supplier-confirmations-跳转1.txt](/tmp/higoods-pms-test-ops-20261013/1791882864104-supplier-confirmations-跳转1.txt) |
| PMS-OPS-010 | 面辅料供应商确认单 | 同步采购单 | 可能同步/生成卷号标签/更新数量或确认状态，最终写入及未证明无写入的打印入口未执行 | not_executed_readonly | [1791881800895-supplier-confirmations-编辑再次.txt](/tmp/higoods-pms-test-ops-20261013/1791881800895-supplier-confirmations-编辑再次.txt) |
| PMS-OPS-011 | 面辅料供应商确认单 | 生成卷号 | 可能同步/生成卷号标签/更新数量或确认状态，最终写入及未证明无写入的打印入口未执行 | not_executed_readonly | [1791881800895-supplier-confirmations-编辑再次.txt](/tmp/higoods-pms-test-ops-20261013/1791881800895-supplier-confirmations-编辑再次.txt) |
| PMS-OPS-012 | 面辅料供应商确认单 | 保存草稿 | 可能同步/生成卷号标签/更新数量或确认状态，最终写入及未证明无写入的打印入口未执行 | not_executed_readonly | [1791881800895-supplier-confirmations-编辑再次.txt](/tmp/higoods-pms-test-ops-20261013/1791881800895-supplier-confirmations-编辑再次.txt) |
| PMS-OPS-013 | 面辅料供应商确认单 | 保存并确认 | 可能同步/生成卷号标签/更新数量或确认状态，最终写入及未证明无写入的打印入口未执行 | not_executed_readonly | [1791881800895-supplier-confirmations-编辑再次.txt](/tmp/higoods-pms-test-ops-20261013/1791881800895-supplier-confirmations-编辑再次.txt) |
| PMS-OPS-014 | 面辅料供应商确认单 | 供应商确认 | 可能同步/生成卷号标签/更新数量或确认状态，最终写入及未证明无写入的打印入口未执行 | not_executed_readonly | [1791881800895-supplier-confirmations-编辑再次.txt](/tmp/higoods-pms-test-ops-20261013/1791881800895-supplier-confirmations-编辑再次.txt) |
| PMS-OPS-015 | 面辅料供应商确认单 | 单条打印标签 | 可能同步/生成卷号标签/更新数量或确认状态，最终写入及未证明无写入的打印入口未执行 | not_executed_readonly | [1791881800895-supplier-confirmations-编辑再次.txt](/tmp/higoods-pms-test-ops-20261013/1791881800895-supplier-confirmations-编辑再次.txt) |
| PMS-OPS-016 | 面辅料供应商确认单 | 已选批量打印标签 | 可能同步/生成卷号标签/更新数量或确认状态，最终写入及未证明无写入的打印入口未执行 | not_executed_readonly | [1791881800895-supplier-confirmations-编辑再次.txt](/tmp/higoods-pms-test-ops-20261013/1791881800895-supplier-confirmations-编辑再次.txt) |
| PMS-OPS-017 | 头程物流 | 添加货运批次 | 头程货运批次新增字段 | opened | [1791881890233-supplier-confirmations-添加.txt](/tmp/higoods-pms-test-ops-20261013/1791881890233-supplier-confirmations-添加.txt) |
| PMS-OPS-018 | 头程物流 | 货运类型选择 | 货运类型可选项 | opened | [1791881897139-supplier-confirmations-添加货运类型.txt](/tmp/higoods-pms-test-ops-20261013/1791881897139-supplier-confirmations-添加货运类型.txt) |
| PMS-OPS-019 | 头程物流 | 预计送达日期编辑 | 时间与备注编辑 | opened | [1791881905948-supplier-confirmations-预计送达时间编辑载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881905948-supplier-confirmations-预计送达时间编辑载入.txt) |
| PMS-OPS-020 | 头程物流 | 编辑物流费用 | 费用币种与金额表单 | opened | [1791881918624-supplier-confirmations-编辑费用.txt](/tmp/higoods-pms-test-ops-20261013/1791881918624-supplier-confirmations-编辑费用.txt) |
| PMS-OPS-021 | 头程物流 | 费用重置 | 费用表单重置不提交 | opened | [1791881926763-supplier-confirmations-费用重置.txt](/tmp/higoods-pms-test-ops-20261013/1791881926763-supplier-confirmations-费用重置.txt) |
| PMS-OPS-022 | 头程物流 | 修改空批次 | 既有空批次修改 | opened | [1791881927526-supplier-confirmations-修改.txt](/tmp/higoods-pms-test-ops-20261013/1791881927526-supplier-confirmations-修改.txt) |
| PMS-OPS-023 | 头程物流 | 交货表单 | 交货确认，终止于确认之前 | opened | [1791881934910-supplier-confirmations-交货.txt](/tmp/higoods-pms-test-ops-20261013/1791881934910-supplier-confirmations-交货.txt) |
| PMS-OPS-024 | 头程物流 | 详情 | 批次、货箱、货箱物料、物流明细及详情操作 | opened | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-025 | 头程物流 | 新增货箱 | 箱号、重量、尺寸、备注 | opened | [1791881996087-first-leg-logistics-新增货箱加载.txt](/tmp/higoods-pms-test-ops-20261013/1791881996087-first-leg-logistics-新增货箱加载.txt) |
| PMS-OPS-026 | 头程物流 | 货箱类型选择 | 货物类型下拉 | opened | [1791882005758-first-leg-logistics-货箱货物类型.txt](/tmp/higoods-pms-test-ops-20261013/1791882005758-first-leg-logistics-货箱货物类型.txt) |
| PMS-OPS-027 | 头程物流 | 换箱号 | 货箱编号修改确认 | opened | [1791882007501-first-leg-logistics-换箱号.txt](/tmp/higoods-pms-test-ops-20261013/1791882007501-first-leg-logistics-换箱号.txt) |
| PMS-OPS-028 | 头程物流 | 换批次 | 批次选择 | opened | [1791882020607-first-leg-logistics-换批次.txt](/tmp/higoods-pms-test-ops-20261013/1791882020607-first-leg-logistics-换批次.txt) |
| PMS-OPS-029 | 头程物流 | 一键编辑长宽高 | 行内长宽高3个文本框，一键提交长宽高与取消 | opened | [1791882064461-first-leg-logistics-尺寸行内编辑.txt](/tmp/higoods-pms-test-ops-20261013/1791882064461-first-leg-logistics-尺寸行内编辑.txt) |
| PMS-OPS-030 | 头程物流 | 货箱编辑 | 既有货箱、类别、尺寸、重量、商品行编辑 | opened | [1791882076075-first-leg-logistics-货箱编辑.txt](/tmp/higoods-pms-test-ops-20261013/1791882076075-first-leg-logistics-货箱编辑.txt) |
| PMS-OPS-031 | 头程物流 | 物料换箱 | 换箱链接点击后货箱展开/收起切换，未出现表单 | no_effect | [1791882113376-first-leg-logistics-展开后物料换箱.txt](/tmp/higoods-pms-test-ops-20261013/1791882113376-first-leg-logistics-展开后物料换箱.txt) |
| PMS-OPS-032 | 头程物流 | 展开全部 | 全部货箱明细展开 | opened | [1791882127202-first-leg-logistics-展开全部.txt](/tmp/higoods-pms-test-ops-20261013/1791882127202-first-leg-logistics-展开全部.txt) |
| PMS-OPS-033 | 头程物流 | 标识关键字添加 | 关键字、备注 | opened | [1791882138986-first-leg-logistics-关键字实际表单.txt](/tmp/higoods-pms-test-ops-20261013/1791882138986-first-leg-logistics-关键字实际表单.txt) |
| PMS-OPS-034 | 头程物流 | 导入面辅料 | 点击导入后未见页面表单，DOM存在单文件输入，未上传 | filechooser_unverified | [1791882165891-first-leg-logistics-导入面辅料载入.txt](/tmp/higoods-pms-test-ops-20261013/1791882165891-first-leg-logistics-导入面辅料载入.txt) |
| PMS-OPS-035 | 头程物流 | 货箱条码 | 点击货箱条码后仍为批次详情，无条码预览或新标签 | no_effect | [1791882178210-first-leg-logistics-货箱条码.txt](/tmp/higoods-pms-test-ops-20261013/1791882178210-first-leg-logistics-货箱条码.txt) |
| PMS-OPS-036 | 头程物流 | 导出明细 | 点击后的当前可见结果，未获下载 | no_download | [1791882227961-first-leg-logistics-导出-导出明细.txt](/tmp/higoods-pms-test-ops-20261013/1791882227961-first-leg-logistics-导出-导出明细.txt) |
| PMS-OPS-037 | 头程物流 | 导出装箱单 | 点击后的当前可见结果，未获下载 | no_download | [1791882231044-first-leg-logistics-导出-导出装箱单$.txt](/tmp/higoods-pms-test-ops-20261013/1791882231044-first-leg-logistics-导出-导出装箱单$.txt) |
| PMS-OPS-038 | 头程物流 | 导出装箱单明细 | 点击后的当前可见结果，未获下载 | no_download | [1791882234311-first-leg-logistics-导出-导出装箱单明细.txt](/tmp/higoods-pms-test-ops-20261013/1791882234311-first-leg-logistics-导出-导出装箱单明细.txt) |
| PMS-OPS-039 | 头程物流 | 本土做货数量确认导出 | 点击后的当前可见结果，未获下载 | no_download | [1791882247900-first-leg-logistics-导出-本土做货数量确认.txt](/tmp/higoods-pms-test-ops-20261013/1791882247900-first-leg-logistics-导出-本土做货数量确认.txt) |
| PMS-OPS-040 | 头程物流 | 成衣商品明细导出 | 点击后的当前可见结果，未获下载 | no_download | [1791882250988-first-leg-logistics-导出-成衣商品明细.txt](/tmp/higoods-pms-test-ops-20261013/1791882250988-first-leg-logistics-导出-成衣商品明细.txt) |
| PMS-OPS-041 | 头程物流 | 导入测款确认 | 点击导入测款，未上传文件 | observed | [1791882251725-first-leg-logistics-导入测款.txt](/tmp/higoods-pms-test-ops-20261013/1791882251725-first-leg-logistics-导入测款.txt) |
| PMS-OPS-042 | 头程物流 | 封箱确认 | 封箱确认 | opened | [1791882260655-first-leg-logistics-封箱.txt](/tmp/higoods-pms-test-ops-20261013/1791882260655-first-leg-logistics-封箱.txt) |
| PMS-OPS-043 | 头程物流 | 删除货箱确认 | 删除确认 | opened | [1791882269261-first-leg-logistics-删除货箱.txt](/tmp/higoods-pms-test-ops-20261013/1791882269261-first-leg-logistics-删除货箱.txt) |
| PMS-OPS-044 | 头程物流 | 搜索 | 头程查询 | query | [1791882295945-first-leg-logistics-搜索.txt](/tmp/higoods-pms-test-ops-20261013/1791882295945-first-leg-logistics-搜索.txt) |
| PMS-OPS-045 | 头程物流 | 重置 | 头程重置后2条 | query | [1791882315058-first-leg-logistics-重置完成.txt](/tmp/higoods-pms-test-ops-20261013/1791882315058-first-leg-logistics-重置完成.txt) |
| PMS-OPS-046 | 头程物流 | 每页条数 | 切换10条 | query | [1791882865238-first-leg-logistics-每页10.txt](/tmp/higoods-pms-test-ops-20261013/1791882865238-first-leg-logistics-每页10.txt) |
| PMS-OPS-047 | 头程物流 | 跳转页码 | 输入第1页并跳转 | query | [1791882865914-first-leg-logistics-跳转1.txt](/tmp/higoods-pms-test-ops-20261013/1791882865914-first-leg-logistics-跳转1.txt) |
| PMS-OPS-048 | 头程物流 | 重量双击编辑 | 货箱重量双击编辑 | opened | [1791882926448-first-leg-logistics-重量双击编辑.txt](/tmp/higoods-pms-test-ops-20261013/1791882926448-first-leg-logistics-重量双击编辑.txt) |
| PMS-OPS-049 | 头程物流 | 更新汇总 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-050 | 头程物流 | 同步货箱 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-051 | 头程物流 | 保存备注 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-052 | 头程物流 | 确认交货 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-053 | 头程物流 | 立即提交货箱 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-054 | 头程物流 | 一键提交长宽高 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-055 | 头程物流 | 确定重量 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-056 | 头程物流 | 确定关键字 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-057 | 头程物流 | 确认封箱 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-058 | 头程物流 | 确认删除货箱 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-059 | 头程物流 | 确认导入测款 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-060 | 头程物流 | 上传面辅料文件 | 最终写入未执行 | not_executed_readonly | [1791881978992-first-leg-logistics-详情实际载入.txt](/tmp/higoods-pms-test-ops-20261013/1791881978992-first-leg-logistics-详情实际载入.txt) |
| PMS-OPS-061 | 头程物流 | 已交货/发运/到港/入库状态分支 | 列表仅两条待交货，其他状态无样本，不能确认后续操作 | no_sample | [1791881874220-supplier-confirmations-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791881874220-supplier-confirmations-列表.txt) |
| PMS-OPS-062 | 原料仓库存查询 | SKU搜索 | 指定SKU筛选 | query | [1791882360866-material-inventory-SKU搜索.txt](/tmp/higoods-pms-test-ops-20261013/1791882360866-material-inventory-SKU搜索.txt) |
| PMS-OPS-063 | 原料仓库存查询 | 清除 | 清除库存查询条件并跳转仓储库存页 | query | [1791882388941-material-inventory-清除.txt](/tmp/higoods-pms-test-ops-20261013/1791882388941-material-inventory-清除.txt) |
| PMS-OPS-064 | 原料仓库存查询 | 第二页 | 列表第二页 | query | [1791882359345-material-inventory-第二页.txt](/tmp/higoods-pms-test-ops-20261013/1791882359345-material-inventory-第二页.txt) |
| PMS-OPS-065 | 原料仓库存查询 | 每页条数 | 切换10条 | query | [1791882874371-material-inventory-每页10.txt](/tmp/higoods-pms-test-ops-20261013/1791882874371-material-inventory-每页10.txt) |
| PMS-OPS-066 | 原料仓库存查询 | 跳转页码 | 输入第1页并跳转 | query | [1791882875589-material-inventory-跳转1.txt](/tmp/higoods-pms-test-ops-20261013/1791882875589-material-inventory-跳转1.txt) |
| PMS-OPS-067 | 原料仓库存查询 | 日志明细 | 库存流水与来源 | opened | [1791882331561-material-inventory-日志明细.txt](/tmp/higoods-pms-test-ops-20261013/1791882331561-material-inventory-日志明细.txt) |
| PMS-OPS-068 | 原料仓库存查询 | 在仓数量条码明细 | 库存数量链接对应原料条码列表，属仓储跨入口 | opened | [1791882357900-material-inventory-库存条码明细实际.txt](/tmp/higoods-pms-test-ops-20261013/1791882357900-material-inventory-库存条码明细实际.txt) |
| PMS-OPS-069 | 原料仓库存查询 | 最新盘点单 | 库存链接到已完成盘点单，盘前盘后差异可追溯 | opened | [1791882387697-material-inventory-最新盘点详情.txt](/tmp/higoods-pms-test-ops-20261013/1791882387697-material-inventory-最新盘点详情.txt) |
| PMS-OPS-070 | 原料仓库存查询 | 原料图片放大 | 原料大图交互 | opened | [1791882368833-material-inventory-原料图片.txt](/tmp/higoods-pms-test-ops-20261013/1791882368833-material-inventory-原料图片.txt) |
| PMS-OPS-071 | 原料仓库存查询 | 排序与仓库筛选选项 | 名称/SPU-SKU、仓库属性、仓库、库存高低排序；筛选范围统计分在仓/在途/锁定/可用；可用=在仓-锁定；辅料重量计算有明示。下拉选项已观察，各组合未逐一查询 | observed | [1791882316920-material-inventory-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882316920-material-inventory-列表.txt) |
| PMS-OPS-072 | 面辅料采购请款 | 新增请款单 | 新增来源选择 | opened | [1791882400677-material-payments-新增请款单.txt](/tmp/higoods-pms-test-ops-20261013/1791882400677-material-payments-新增请款单.txt) |
| PMS-OPS-073 | 面辅料采购请款 | 查看 | 采购请款详情与金额进度 | opened | [1791882414351-material-payments-查看.txt](/tmp/higoods-pms-test-ops-20261013/1791882414351-material-payments-查看.txt) |
| PMS-OPS-074 | 面辅料采购请款 | 编辑已申请请款 | 既有请款单编辑 | opened | [1791882439913-material-payments-编辑.txt](/tmp/higoods-pms-test-ops-20261013/1791882439913-material-payments-编辑.txt) |
| PMS-OPS-075 | 面辅料采购请款 | 申请付款 | 剩余金额、本次金额、性质、付款日期、备注、附件 | opened | [1791882453333-material-payments-申请付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882453333-material-payments-申请付款.txt) |
| PMS-OPS-076 | 面辅料采购请款 | 部分付款选择 | 部分付款金额可填写，币种CNY/USD/IDR | opened | [1791882462372-material-payments-部分付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882462372-material-payments-部分付款.txt) |
| PMS-OPS-077 | 面辅料采购请款 | 付款记录 | 已付款记录与凭证 | opened | [1791882465902-material-payments-付款记录.txt](/tmp/higoods-pms-test-ops-20261013/1791882465902-material-payments-付款记录.txt) |
| PMS-OPS-078 | 面辅料采购请款 | 请款记录 | 申请审核及财务备注 | opened | [1791882477592-material-payments-请款记录.txt](/tmp/higoods-pms-test-ops-20261013/1791882477592-material-payments-请款记录.txt) |
| PMS-OPS-079 | 面辅料采购请款 | 操作日志 | 请款单操作日志 | opened | [1791882481154-material-payments-操作日志.txt](/tmp/higoods-pms-test-ops-20261013/1791882481154-material-payments-操作日志.txt) |
| PMS-OPS-080 | 面辅料采购请款 | 无结果查询 | 无匹配结果 | query | [1791882529711-material-payments-无结果查询.txt](/tmp/higoods-pms-test-ops-20261013/1791882529711-material-payments-无结果查询.txt) |
| PMS-OPS-081 | 面辅料采购请款 | 重置 | 恢复2条请款单 | query | [1791882554287-material-payments-重置.txt](/tmp/higoods-pms-test-ops-20261013/1791882554287-material-payments-重置.txt) |
| PMS-OPS-082 | 面辅料采购请款 | 导出 | 导出未获下载 | no_download | [1791882557397-material-payments-导出.txt](/tmp/higoods-pms-test-ops-20261013/1791882557397-material-payments-导出.txt) |
| PMS-OPS-083 | 面辅料采购请款 | 每页条数 | 切换10条 | query | [1791882876950-material-payments-每页10.txt](/tmp/higoods-pms-test-ops-20261013/1791882876950-material-payments-每页10.txt) |
| PMS-OPS-084 | 面辅料采购请款 | 跳转页码 | 输入第1页并跳转 | query | [1791882877572-material-payments-跳转1.txt](/tmp/higoods-pms-test-ops-20261013/1791882877572-material-payments-跳转1.txt) |
| PMS-OPS-085 | 面辅料采购请款 | 已完成申请付款 | 已完成付款单禁止再次申请 | disabled_no_effect | [1791882494097-material-payments-已完成申请付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882494097-material-payments-已完成申请付款.txt) |
| PMS-OPS-086 | 面辅料采购请款 | 附件预览 | 打开 PDF 新标签，DOM空白，附件内容未验证 | preview_unverified | [1791882436304-material-payments-附件预览实际.txt](/tmp/higoods-pms-test-ops-20261013/1791882436304-material-payments-附件预览实际.txt) |
| PMS-OPS-087 | 面辅料采购请款 | 确认创建请款单 | 业务写入或上传未执行 | not_executed_readonly | [1791882453333-material-payments-申请付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882453333-material-payments-申请付款.txt) |
| PMS-OPS-088 | 面辅料采购请款 | 保存编辑 | 业务写入或上传未执行 | not_executed_readonly | [1791882453333-material-payments-申请付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882453333-material-payments-申请付款.txt) |
| PMS-OPS-089 | 面辅料采购请款 | 确认申请付款 | 业务写入或上传未执行 | not_executed_readonly | [1791882453333-material-payments-申请付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882453333-material-payments-申请付款.txt) |
| PMS-OPS-090 | 面辅料采购请款 | 继续上传附件 | 业务写入或上传未执行 | not_executed_readonly | [1791882453333-material-payments-申请付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882453333-material-payments-申请付款.txt) |
| PMS-OPS-091 | 物流费用请款 | 新建请款单 | 物流来源及费用类型选择 | opened | [1791882579569-logistics-payments-新建请款单.txt](/tmp/higoods-pms-test-ops-20261013/1791882579569-logistics-payments-新建请款单.txt) |
| PMS-OPS-092 | 物流费用请款 | 查看 | 物流部分付款详情 | opened | [1791882609848-logistics-payments-查看实际.txt](/tmp/higoods-pms-test-ops-20261013/1791882609848-logistics-payments-查看实际.txt) |
| PMS-OPS-093 | 物流费用请款 | 编辑未请款 | 未请款编辑字段 | opened | [1791882629576-logistics-payments-未请款编辑.txt](/tmp/higoods-pms-test-ops-20261013/1791882629576-logistics-payments-未请款编辑.txt) |
| PMS-OPS-094 | 物流费用请款 | 编辑已申请请款 | 已申请核心金额账户锁定，仅联系人和说明备注 | opened | [1791882641433-logistics-payments-部分请款编辑.txt](/tmp/higoods-pms-test-ops-20261013/1791882641433-logistics-payments-部分请款编辑.txt) |
| PMS-OPS-095 | 物流费用请款 | 申请付款 | 剩余可申请与支付余额分离 | opened | [1791882645113-logistics-payments-申请付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882645113-logistics-payments-申请付款.txt) |
| PMS-OPS-096 | 物流费用请款 | 部分付款选择 | 部分金额输入 | opened | [1791882664636-logistics-payments-部分付款选项.txt](/tmp/higoods-pms-test-ops-20261013/1791882664636-logistics-payments-部分付款选项.txt) |
| PMS-OPS-097 | 物流费用请款 | 付款记录 | 部分付款记录 | opened | [1791882668270-logistics-payments-付款记录.txt](/tmp/higoods-pms-test-ops-20261013/1791882668270-logistics-payments-付款记录.txt) |
| PMS-OPS-098 | 物流费用请款 | 请款记录 | 物流历史请款记录 | opened | [1791882671921-logistics-payments-请款记录.txt](/tmp/higoods-pms-test-ops-20261013/1791882671921-logistics-payments-请款记录.txt) |
| PMS-OPS-099 | 物流费用请款 | 操作日志 | 暂无操作日志，关闭 | opened | [1791882694354-logistics-payments-操作日志内容.txt](/tmp/higoods-pms-test-ops-20261013/1791882694354-logistics-payments-操作日志内容.txt) |
| PMS-OPS-100 | 物流费用请款 | 状态查询 | 未请款筛选1条 | query | [1791882708339-logistics-payments-状态筛选.txt](/tmp/higoods-pms-test-ops-20261013/1791882708339-logistics-payments-状态筛选.txt) |
| PMS-OPS-101 | 物流费用请款 | 重置 | 恢复4条物流请款 | query | [1791882708997-logistics-payments-重置.txt](/tmp/higoods-pms-test-ops-20261013/1791882708997-logistics-payments-重置.txt) |
| PMS-OPS-102 | 物流费用请款 | 导出 | 未获下载回执 | no_download | [1791882712170-logistics-payments-导出.txt](/tmp/higoods-pms-test-ops-20261013/1791882712170-logistics-payments-导出.txt) |
| PMS-OPS-103 | 物流费用请款 | 每页条数 | 切换10条 | query | [1791882878768-logistics-payments-每页10.txt](/tmp/higoods-pms-test-ops-20261013/1791882878768-logistics-payments-每页10.txt) |
| PMS-OPS-104 | 物流费用请款 | 跳转页码 | 输入第1页并跳转 | query | [1791882879421-logistics-payments-跳转1.txt](/tmp/higoods-pms-test-ops-20261013/1791882879421-logistics-payments-跳转1.txt) |
| PMS-OPS-105 | 物流费用请款 | 确认创建请款单 | 业务写入或上传未执行 | not_executed_readonly | [1791882645113-logistics-payments-申请付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882645113-logistics-payments-申请付款.txt) |
| PMS-OPS-106 | 物流费用请款 | 保存编辑 | 业务写入或上传未执行 | not_executed_readonly | [1791882645113-logistics-payments-申请付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882645113-logistics-payments-申请付款.txt) |
| PMS-OPS-107 | 物流费用请款 | 确认申请付款 | 业务写入或上传未执行 | not_executed_readonly | [1791882645113-logistics-payments-申请付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882645113-logistics-payments-申请付款.txt) |
| PMS-OPS-108 | 物流费用请款 | 继续上传附件 | 业务写入或上传未执行 | not_executed_readonly | [1791882645113-logistics-payments-申请付款.txt](/tmp/higoods-pms-test-ops-20261013/1791882645113-logistics-payments-申请付款.txt) |
| PMS-OPS-109 | KOL库存 | 批量锁定表单 | 独立批量锁定表单；最终值不能低于占用也不能高于KOL库存；查询最多300；按比例填充勾选项/勾选清零/确认锁定 | opened | [1791882725221-kol-stock-批量锁定空选.txt](/tmp/higoods-pms-test-ops-20261013/1791882725221-kol-stock-批量锁定空选.txt) |
| PMS-OPS-110 | KOL库存 | 锁定查询SKU | 空条件只读查询结果 | opened | [1791882743704-kol-stock-锁定查询SKU.txt](/tmp/higoods-pms-test-ops-20261013/1791882743704-kol-stock-锁定查询SKU.txt) |
| PMS-OPS-111 | KOL库存 | 按比例填充 | 无勾选的本地填充校验 | empty_guard | [1791882744065-kol-stock-比例填充空勾选.txt](/tmp/higoods-pms-test-ops-20261013/1791882744065-kol-stock-比例填充空勾选.txt) |
| PMS-OPS-112 | KOL库存 | 勾选项清零 | 0条0勾选，未改变业务数据；截图仍有先前比例填充提示 | opened | [1791882744444-kol-stock-勾选清零.txt](/tmp/higoods-pms-test-ops-20261013/1791882744444-kol-stock-勾选清零.txt) |
| PMS-OPS-113 | KOL库存 | 批量释放空选 | 请勾选有锁定未占用的SKU | empty_guard | [1791882751957-kol-stock-批量释放锁定实际.txt](/tmp/higoods-pms-test-ops-20261013/1791882751957-kol-stock-批量释放锁定实际.txt) |
| PMS-OPS-114 | KOL库存 | 生成链接空选 | 请先勾选需要放入链接的SKU | empty_guard | [1791882757867-kol-stock-生成样品池实际.txt](/tmp/higoods-pms-test-ops-20261013/1791882757867-kol-stock-生成样品池实际.txt) |
| PMS-OPS-115 | KOL库存 | 查询 | 默认KOL库存仍0条 | query | [1791882767671-kol-stock-查询.txt](/tmp/higoods-pms-test-ops-20261013/1791882767671-kol-stock-查询.txt) |
| PMS-OPS-116 | KOL库存 | 重置 | 重置全部SKU结果0条 | query | [1791882768541-kol-stock-重置.txt](/tmp/higoods-pms-test-ops-20261013/1791882768541-kol-stock-重置.txt) |
| PMS-OPS-117 | KOL库存 | 单条锁定修改 | 库存与查询SKU均0条，无法核查有选分支；最终写入未执行 | no_sample_readonly | [1791882712973-kol-stock-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882712973-kol-stock-列表.txt) |
| PMS-OPS-118 | KOL库存 | 确认锁定 | 库存与查询SKU均0条，无法核查有选分支；最终写入未执行 | no_sample_readonly | [1791882712973-kol-stock-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882712973-kol-stock-列表.txt) |
| PMS-OPS-119 | KOL库存 | 已选释放 | 库存与查询SKU均0条，无法核查有选分支；最终写入未执行 | no_sample_readonly | [1791882712973-kol-stock-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882712973-kol-stock-列表.txt) |
| PMS-OPS-120 | KOL库存 | 已选生成链接 | 库存与查询SKU均0条，无法核查有选分支；最终写入未执行 | no_sample_readonly | [1791882712973-kol-stock-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882712973-kol-stock-列表.txt) |
| PMS-OPS-121 | 手动寄样申请 | 状态查询 | 待审核0条，无行操作样本 | query | [1791882783346-kol-applications-待审核查询.txt](/tmp/higoods-pms-test-ops-20261013/1791882783346-kol-applications-待审核查询.txt) |
| PMS-OPS-122 | 手动寄样申请 | 重置 | 全部0条 | query | [1791882783931-kol-applications-重置.txt](/tmp/higoods-pms-test-ops-20261013/1791882783931-kol-applications-重置.txt) |
| PMS-OPS-123 | 手动寄样申请 | 查看申请 | 测试列表0条，没有实际行控件；页面说明通过生成借出单及达人标签，未证实实际写入 | no_sample_readonly | [1791882769215-kol-applications-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882769215-kol-applications-列表.txt) |
| PMS-OPS-124 | 手动寄样申请 | 通过审核 | 测试列表0条，没有实际行控件；页面说明通过生成借出单及达人标签，未证实实际写入 | no_sample_readonly | [1791882769215-kol-applications-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882769215-kol-applications-列表.txt) |
| PMS-OPS-125 | 手动寄样申请 | 驳回 | 测试列表0条，没有实际行控件；页面说明通过生成借出单及达人标签，未证实实际写入 | no_sample_readonly | [1791882769215-kol-applications-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882769215-kol-applications-列表.txt) |
| PMS-OPS-126 | 手动寄样申请 | 关联借出单 | 测试列表0条，没有实际行控件；页面说明通过生成借出单及达人标签，未证实实际写入 | no_sample_readonly | [1791882769215-kol-applications-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882769215-kol-applications-列表.txt) |
| PMS-OPS-127 | 对外样品池链接 | 状态查询 | 待提交链接0条 | query | [1791882803146-kol-links-待提交查询.txt](/tmp/higoods-pms-test-ops-20261013/1791882803146-kol-links-待提交查询.txt) |
| PMS-OPS-128 | 对外样品池链接 | 重置 | 全部链接0条 | query | [1791882804247-kol-links-重置.txt](/tmp/higoods-pms-test-ops-20261013/1791882804247-kol-links-重置.txt) |
| PMS-OPS-129 | 对外样品池链接 | 外部链接访问 | 测试列表0条，没有实际行控件；外部访问可能记计数故未执行 | no_sample_readonly | [1791882784515-kol-links-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882784515-kol-links-列表.txt) |
| PMS-OPS-130 | 对外样品池链接 | 复制链接 | 测试列表0条，没有实际行控件；外部访问可能记计数故未执行 | no_sample_readonly | [1791882784515-kol-links-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882784515-kol-links-列表.txt) |
| PMS-OPS-131 | 对外样品池链接 | 修改链接 | 测试列表0条，没有实际行控件；外部访问可能记计数故未执行 | no_sample_readonly | [1791882784515-kol-links-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882784515-kol-links-列表.txt) |
| PMS-OPS-132 | 对外样品池链接 | 作废链接 | 测试列表0条，没有实际行控件；外部访问可能记计数故未执行 | no_sample_readonly | [1791882784515-kol-links-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882784515-kol-links-列表.txt) |
| PMS-OPS-133 | 对外样品池链接 | 关联申请 | 测试列表0条，没有实际行控件；外部访问可能记计数故未执行 | no_sample_readonly | [1791882784515-kol-links-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882784515-kol-links-列表.txt) |
| PMS-OPS-134 | 锁定操作记录 | 查询 | 锁定日志默认0条 | query | [1791882838197-kol-lock-logs-查询.txt](/tmp/higoods-pms-test-ops-20261013/1791882838197-kol-lock-logs-查询.txt) |
| PMS-OPS-135 | 锁定操作记录 | 重置 | 恢复日志筛选 | query | [1791882838743-kol-lock-logs-重置.txt](/tmp/higoods-pms-test-ops-20261013/1791882838743-kol-lock-logs-重置.txt) |
| PMS-OPS-136 | 锁定操作记录 | 操作类型及关联申请查询 | 手动锁定、手动释放、申请单自动占用、驳回释放占用、跨日占用归零；SKU/SPU/操作人、日期、申请号筛选；前后池/占用/未占用数量；0条无日志样本 | observed | [1791882804840-kol-lock-logs-列表.txt](/tmp/higoods-pms-test-ops-20261013/1791882804840-kol-lock-logs-列表.txt) |

## 表单字段与选项

逐次观察的 JSON `controls` 包含字段、邻近标签和下拉选项，原始 TXT 包含完整表单层、只读详情、数量与按钮。以下是实施应保留的业务能力。

- 确认单：来源采购、供应商、基础/包装单位、发货数量与包装数量、箱数、重量/体积、日期、备注、卷号、箱规、标签数量/状态/打印次数、操作日志。
- 头程：货源/目的地区、仓库、海/空运、物流商/渠道、待交货至部分入库、预计送达日期；11项费用及币种；货箱类别、特殊货品、材质、尺寸/体积/重量、源款与物料、SKU库存/数量/价格、机器标记、备注、换箱/批次、交货及封箱确认。
- 库存：仓库属性与具体仓库、在仓/在途/锁定/可用、最新盘点、数量到条码、日志流水、实物大图；可用与重量公式显示明确。
- 采购请款：来源对账/采购/商品单、供应商/物料/单位与采购入库数量、采购单价/货款/调整/最终金额、收款账户、付款类型/主体/方式/性质、汇率和大写、说明、附件、请款/付款记录与日志。已申请核心金额和账户锁定。
- 物流请款：内陆运费/头程运费/清关费、CNY/USD、来源对账与物流单、收款人/主体/账户、总额/申请/已付/余额、部分金额申请、付款日期、说明、财务备注。余额650和可再申请625分开。
- KOL：当日池、占用、未占用；最终锁定值不能小于已占用或大于KOL库存；最多300SKU、按比例填充与勾选清零；链接最大可选/有效期/一次提交，申请通过生成待借出借出单和达人标签（仅页面说明）；日志5类型与前后数量。

## 未验证项

- Final business writes, upload, generation, synchronization and unproven print log entry points were not executed under SAFE-01.
- KOL four lists have zero rows; selected and status branches are unverified.
- Supplier confirmation only one unconfirmed record; first-leg only two pending-delivery batches.
- Five logistics exports plus both payment exports clicked, no download acknowledgement; no claim they work.
- Raw intermediate captures are preserved with corrected statuses; source-tab details or title-only frames are not opened proof.
- Header-level filtering/sorting option inspection is not proof of every query combination.
