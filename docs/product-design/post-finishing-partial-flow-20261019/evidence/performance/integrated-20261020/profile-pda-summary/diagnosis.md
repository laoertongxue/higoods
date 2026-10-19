# PDA 共享摘要版剩余耗时诊断

2026-10-20；原 F090 session 与 D10 100/4,000/1,000/1,000/900 保持，不更换实际命名工厂规避性能。原始未经 Profiler 的校准为 cold 1,321.0ms / refresh 1,093.9ms / navigation 499.2ms，三项采集均有效。目录 `calibration-pda-summary` 保存该轮实际资源身份和失败值。

本目录 CPU 诊断得到 cold 1,351.4ms / refresh 1,167.9ms / navigation 517.3ms；Profiler 总持续分别 1,422.933ms / 1,262.469ms，诊断额外开销不作为验收。原始 `.cpuprofile`、`-top.json` 与加权、带源码限定的 `weighted-qualified-diagnosis.json` 保留。

| 项目 | cold | refresh |
| --- | ---: | ---: |
| PDA 后道详情入口 inclusive CPU | 558.1ms | 527.9ms |
| 主体 render inclusive CPU | 292.9ms | 291.2ms |
| 编号 link-index inclusive CPU | 179.2ms | 178.9ms |
| 其中后道 process facts 构造 inclusive CPU | 131.6ms | 129.6ms |
| F JSON clone self CPU | 203.5ms | 204.8ms |
| F 模块总 self CPU | 277.9ms | 264.9ms |
| 公共 handover 模块总 self CPU | 220.0ms | 213.5ms |
| ensure inclusive CPU | 103.1ms | 90.7ms |
| ensure 内 recordValidator 回调 inclusive CPU | 48.5ms | 45.2ms |

与上一版入口 808/819ms inclusive 相比，共享出货摘要减少约 250–290ms。剩余确定性栈主要为染色初始化链中全待交出库存的 JSON clone/handout 重建，以及 PROCESS 关联编号目录构造。单个普通后道大集 readonly 事务仍只有一次；没有重复 ensure/验证整包的证据，不能把 source-validator 当作主要根因。CPU 采样不证明精确函数调用次数；根代理决定不再增加 precise coverage，直接对确定的 clone 与目录范围做最小修复。

导航准备从固定 50ms 等待改为实际授权页 marker、处理器/事务空闲和 DOM 稳定后，再插入目标导航锚点。该等待只用于准备上一站，不计目标导航；计时仍从下一真实 click 开始。上一轮锚点 detach 是采集无效，不能当业务性能失败，仍保留原报告。该轮导航已有效得到 499.2ms。

根代理随后进入代码修改窗口：只取 handover head 所需 primitive 汇总；PROCESS 目录按实际 fixture 来源生产单范围构造，保留无参原行为。修改前后版本身份分开，等待新资产后再校准，不把诊断值宣称正式通过。
