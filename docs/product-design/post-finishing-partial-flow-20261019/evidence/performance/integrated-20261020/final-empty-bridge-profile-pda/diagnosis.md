# 空候选短路后的冷载诊断

本轮只定位一次冷载，不作为正式验收。实际无 Profiler 冷载 **1226.5 ms > 1000 ms**，已保存在相邻 `final-empty-bridge-calibration-pda/report.json`；带 Profiler 冷载 1231.0 ms。固定 D10 和原 F090 均未改，未继续刷新、导航或正式采样，浏览器已关闭。

当次源清单 SHA256 为 `9fd4474610a6dc949502c31ef5b3eba398958d087b1c301404b3c5a1e1155032`，dist index 为 `1dfb3b9bea6ee67b8f1aea7bc4ddf12c96f47abf7cd9b4cdcdc3994ee7a5a5c0`。`binding.json`、源清单副本、脚本副本和 `runtime-assets/` 保留当次原始加载资产，旧诊断不覆盖。

新 profile 证实原 `readSources` 空候选短路已生效，先前的 `ie` 重栈消失。但同一来源图在安装适配器时又被触发：

`accessory prepare J → F.Qo（安装适配器）→ F.Ue（managedLegacyMaterialState）→ adapter.ownedProductionIdentities → accessory sources → material prep → printing/dye → handover`

其中 `ownedProductionIdentities` 包含 CPU 耗时 **214.9 ms**，`J` 包含耗时 216.5 ms。对应实际资产位置为 `post-finishing-full-flow-D_giM7Ur.js` 第一行列 36536 的 `Ue`、列 37046 的 `Qo`，以及 `accessory-warehouse-post-finishing-gNegPWc9.js` 第一行列 8946 的 `ownedProductionIdentities`。完整源片段及调用者在 `qualified-stage-callers.json`。这次证据不支持把该成本归于 readiness、非空 transfers 或后台主 Tab 预载。

当前 PDA 详情实际渲染 316.7 ms，`PROCESS_DOC` link 索引 168.4 ms（其中后道任务投影 130.9 ms），PDA header 待办计数 75.3 ms，均与上一版相近。V8 `timeDeltas` 的包含耗时互相重叠，不能相加，也不能从 CPU 采样推算精确调用次数。

本代理没有修改产品或脚本。最大下一步定位对象是 `managedLegacyMaterialState` 对空材料数组仍先请求完整归属集合的调用顺序；保留非空归属校验的修复由主代理决定和验证。
