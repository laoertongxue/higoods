# 来源动作旁路最终结果（build9）

本旁路负责的当前适用验证全部通过；完整产品矩阵、其它旁路与最终发布由 root 汇总。当前生产 preview 为 build9，构建标识及证据复用边界见 `manifest-build9.json`。

9 个入口 cold / refresh / navigation 各 5 次，共 **135/135** 个样本小于 500 ms，console/page error 均为空。

| 入口 | 15 样本最大 ms |
| --- | ---: |
| dispatch | 399.4 |
| tenders | 213.1 |
| sample | 255 |
| responsibility | 190.2 |
| contracts | 193.5 |
| progress | 241.8 |
| pda-receive | 369.1 |
| pda-exec | 469.2 |
| pda-handover | 294.5 |

PDA 接单 cold 五样本：369.1 / 339.2 / 343.6 / 343.3 / 339.9 ms。实际 Web 分配 3391 片到 OWN-CUTTING-001 → PDA 接单 → 执行卡 → 刷新，共 5 个完整场景、10 个动作计时，最大 227.8 ms；任务身份、数量及已接单状态一致。

| 动作证据 | 构建 | 计时样本 | 最大 ms |
| --- | ---: | ---: | ---: |
| actions-build7.txt | 7 | 25 | 139.3 |
| pda-accept-build9.txt | 9 | 10 | 227.8 |
| contract-transfer-build8.txt | 8 | 10 | 98.1 |
| completion-build7.txt | 7 | 10 | 221.9 |
| start-build7.txt | 7 | 5 | 224.4 |
| generation-build8.txt | 8 | 20 | 236.7 |
| breakdown-build8.txt | 8 | 10 | 148.1 |

来源动作合计 **90/90** 个有效计时样本小于 500 ms。未受改动影响的 build7 与 build8 证据沿用边界由 root 明确指定；没有把旧版本结果伪标为 build9。

旧 build8 接单 cold 613.1 ms、旧合同慢样本、拆解旧键写、范围等价测试初次序号失败均保留。build9 是修复后实际重放，不删除或挑选原慢样本。

具体工厂范围实现与等价证明见 `PDA-RECEIVE-SCOPE.md`。本次接单页面启用范围读取，当前工厂无印染加工单时跳过该域执行初始化；有记录时仍使用原全域同步。全部有任务工厂完整对象及待接单/中标专项通过。

合同、责任、结束加工与开工测试使用明确 Mock 前置，被测动作由真实页面执行。合同只验证浏览器打印调用及打印事实，不声称物理打印。用户主动清理浏览器导致本地数据丢失仍属于原型边界。

`check-simple-handover-five.js` 已交 root 执行；本子代理没有替 root 声称该脚本已通过。
