# 来源动作 build7 实际验收记录

同工作树、同一 production preview `43236`。性能窗口独占，所有慢样本和原失败保留。

| 证据 | 场景数 | 有效计时数 | 最慢 ms | 功能异常数 | ≥500ms | 存储判定 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| [perf-build7.txt](perf-build7.txt) | 135 | 135 | 478.9 | 0 | 0 | scope_assertions_passed |
| [actions-build7.txt](actions-build7.txt) | 15 | 25 | 139.3 | 0 | 0 | scope_assertions_passed |
| [pda-accept-build7.txt](pda-accept-build7.txt) | 5 | 10 | 168.9 | 0 | 0 | scope_assertions_passed |
| [contract-transfer-build7-r2.txt](contract-transfer-build7-r2.txt) | 5 | 10 | 758.7 | 0 | 5 | scope_assertions_passed |
| [completion-build7.txt](completion-build7.txt) | 10 | 10 | 221.9 | 0 | 0 | scope_assertions_passed |
| [start-build7.txt](start-build7.txt) | 5 | 5 | 224.4 | 0 | 0 | scope_assertions_passed |
| [generation-build7-r2.txt](generation-build7-r2.txt) | 15 | 20 | 204.6 | 0 | 0 | scope_assertions_passed |
| [breakdown-build7.txt](breakdown-build7.txt) | 5 | 10 | 168.1 | 0 | 0 | FAIL_LEGACY_WRITES |

这份记录不能标整体通过。合同首次打印的真实慢样本需修复并重测；拆解任务仍发现旧业务键写入，需定位并复验。

普通生成与 KOL 生成各 5 次；失败恢复 5 次中 IndexedDB 与动作前完全一致、确认弹窗和版本输入保留、重试后只有一张生产单。KOL 每轮保持 `TASK-KOL-202603-0103`、2100 件。

分配验收为真实独立裁剪任务分配到 HiGood 裁床厂→出现默认换片布票→新增独立票→整单改派其他厂→待办移除、已保存票的历史状态保留且不再允许操作。全部为实际 UI。

合同、责任、工厂结束、合并任务开始使用明确类型完整 Mock 前置；前置不预写被测动作结果。合同/开工通过同源 dev 构建备份再由 preview 恢复 UI 导入。打印测试观察真实按钮最终调用 window.print 与 PRINTED 审计，不表示物理打印机验收。

附带页面/动作细节、完整浏览器正文和错误数组在各 JSON/TXT。最终发布与产品接受状态由主代理的总体矩阵控制。
