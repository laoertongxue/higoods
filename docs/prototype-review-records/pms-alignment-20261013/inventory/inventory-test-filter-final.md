# 三组安全筛选最后补充 · 追加冻结记录

测试域 http://test_manage.higood.ai，独立标签944169373已经关闭。仅库存仓库、库存排序、锁定日志操作类型；每组实际打开候选、选择一项、查询与重置。无业务写入、上传、样本新增、源码修改。

3组/12个实际子动作，14份raw、2张截图，manifest18项；证据上限 2026-10-13T12:09:27.909Z。

此追加补齐coverage21冻结建议中的具名observed筛选证据不足，不修改原清单状态或SHA，不改变无样本和最终业务未提交边界。

| 稳定编号 | 原observed编号 | 控件 | 选择/查询/重置结果 | 证据 |
|---|---|---|---|---|
| PMS-TEST-FILTER-FINAL-INV-WAREHOUSE | PMS-OPS-071 | 库存仓库 | 选择后URL warehouse_code=WH-HAOCAI-001，17条/2页，15条当前页均所属耗材中央仓；清除恢复全部仓库与9265条/618页。 | [1791893287742-inventory-warehouse-open-options.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893287742-inventory-warehouse-open-options.txt) / [1791893302764-inventory-warehouse-selected.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893302764-inventory-warehouse-selected.txt) / [1791893303848-inventory-warehouse-query.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893303848-inventory-warehouse-query.txt) / [1791893321142-inventory-warehouse-reset.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893321142-inventory-warehouse-reset.txt) |
| PMS-TEST-FILTER-FINAL-INV-SORT | PMS-OPS-071 | 库存排序 | 选择后URL rsort=stock_num_desc，选中项保留，9265条；首行FLSZ24116-black在仓1552241.00PCS，随后1271027.00M等。只确认源排序响应，不推导跨单位业务比较；清除恢复默认选项与原首行。 | [1791893321491-inventory-sort-open-options.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893321491-inventory-sort-open-options.txt) / [1791893321543-inventory-sort-selected.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893321543-inventory-sort-selected.txt) / [1791893331403-inventory-sort-query.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893331403-inventory-sort-query.txt) / [1791893332885-inventory-sort-reset.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893332885-inventory-sort-reset.txt) |
| PMS-TEST-FILTER-FINAL-KLG-ACTION | PMS-OPS-136 | 操作类型 | 选择后URL action=1且手动锁定选中，查询暂无数据；重置移除参数，恢复全部，仍暂无数据。没有新增日志或库存。 | [1791893346320-kol-log-action-open-options.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893346320-kol-log-action-open-options.txt) / [1791893346373-kol-log-action-selected.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893346373-kol-log-action-selected.txt) / [1791893346990-kol-log-action-query.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893346990-kol-log-action-query.txt) / [1791893367965-kol-log-action-reset.txt](/tmp/higoods-pms-test-filter-final-20261013/1791893367965-kol-log-action-reset.txt) |

仓库共有全部仓库+13个实际候选；排序为默认、库存由高到底、库存由低到高；日志操作为全部、手动锁定、手动释放、申请单自动占用、驳回释放占用、跨日占用归零。全部候选文本及selected、查询URL、表格结果保留于JSON。

旧core/tail/root supplement/coverage21/ops JSON全部SHA核对未变；18项来源均存在、非空，SHA基于实际文件计算。未遍历全部查询组合，也未对跨单位库存排序作业务正确性推断。
