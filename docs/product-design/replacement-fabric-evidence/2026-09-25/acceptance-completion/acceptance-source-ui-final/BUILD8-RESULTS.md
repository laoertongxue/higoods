# 来源动作最终旁路结果（build8）

本旁路仍有一项性能失败，未宣称整体验收完成。root负责最后优化、全链验收与发布。

| 证据 | 使用构建 | 计时样本 | 最慢 ms | ≥500ms | 功能异常 |
| --- | ---: | ---: | ---: | ---: | ---: |
| [perf-build8.txt](perf-build8.txt) | 8 | 135 | 613.1 | 1 | 0 |
| [actions-build7.txt](actions-build7.txt) | 7 | 25 | 139.3 | 0 | 0 |
| [pda-accept-build7.txt](pda-accept-build7.txt) | 7 | 10 | 168.9 | 0 | 0 |
| [contract-transfer-build8.txt](contract-transfer-build8.txt) | 8 | 10 | 98.1 | 0 | 0 |
| [completion-build7.txt](completion-build7.txt) | 7 | 10 | 221.9 | 0 | 0 |
| [start-build7.txt](start-build7.txt) | 7 | 5 | 224.4 | 0 | 0 |
| [generation-build8.txt](generation-build8.txt) | 8 | 20 | 236.7 | 0 | 0 |
| [breakdown-build8.txt](breakdown-build8.txt) | 8 | 10 | 148.1 | 0 | 0 |

唯一剩余：`/fcs/pda/task-receive` cold sample3 **613.1ms**，console/pageerror均空。9入口共135样本，134通过；全部90个来源动作计时均小于500ms。旧失败样本全部保留。

已消除的真实问题：合同首次打印从709–758ms降到本轮不足100ms；打开拆解预览不再触发印花演示执行整包旧源落盘。确认拆解失败时records/commands不变、预览保留；实际按钮重试后两任务2400件并刷新保持。

功能专项：`breakdown-source-unit-3.txt` 原生Node13/13；`breakdown-stage-stacks-fixed-2.txt` 阶段零业务写；`breakdown-abort-fixed-dev.txt` 真实UI失败回滚/重试。上游core/开工/样衣先前专项见README。

脚本 `check-simple-handover-five.js` 是root追加要求的独立交出验收脚本（Web/PDA各5，预期75事件样本），仅完成静态编写，未运行；交出结果没有预写。

合同、责任、开工等前置明确标注Mock。实际保存、打印确认、扫码/接单/开工、转交与结束均由页面按钮执行。数据仅限当前浏览器原型，不代表真实工厂动作。
