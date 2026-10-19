# 候选身份优化后的实际分支诊断

无 Profiler 的有效冷载 **1323.5 ms > 1000 ms**，stop-first 后停止，证据在相邻 `final-candidate-identity-calibration-pda/report.json`。本目录的一次 cold CPU 诊断为 1260.6 ms，不作为正式验收，也不覆盖原失败；没有运行 refresh、navigation 或其他家族。浏览器已关闭。

同一固定 D10、原 F090、harness `6d4b40df…`，当次 source manifest `4f531844…`、dist index `e262682…`。当次源清单、原脚本、131 份加载资产原始字节与 SHA256 保存在 `binding.json` 及其指向文件。

实际重栈依然是：

`adapter prepare J → F.Qo → F.Ue → adapter.ownedProductionIdentities → full accessory sources → production material prep → printing/dye → handover`

`ownedProductionIdentities` 包含 CPU 耗时 **213.6 ms**。新 bundle 确实包含新候选判定 `e => e && !pe(e) ? new Set : new Set(b().flatMap(...))`，实际采样进入后半 `b()`，不是读取了旧资产。`qualified-stage-callers.json` 保留完整栈、位置与源码片段。因此下一步需要核对 `Ue` 传入的候选身份及 `pe` 为什么判定可能属于新材料；固定主备份没有活跃材料行，这一事实不能直接证明恢复后内存中的静态原材料候选也是空集。

当前详情渲染仍为 312.8 ms，`PROCESS_DOC` link 索引 167.6 ms（后道任务投影 129.2 ms），与上一版近似，未观察到候选优化让该次冷载整体达标。CPU 包含耗时重叠，不能相加；采样不能给出精确调用次数或函数参数值。

本次未修改产品或采集器，也未降低数据规模、门槛或更换工厂。主代理继续核具体候选与归属 guard，性能正式包尚未开始。
