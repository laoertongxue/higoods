# TMF 规范场景独立执行收据（2026-09-21）

当前分支：codex/tmf-webbing-management；HEAD：ed9daa9c1c75fccadd8eb0901ec1876bbee41928

结果：29/29 场景通过；失败 0。

每一行均同时包含独立 Mock 副本收据和独立浏览器子进程收据。全量运行器只负责逐个启动脚本；通过条件还要求脚本退出码为 0、脚本自己的证据 JSON 存在且含可观察断言、无错误，并满足当前严格性能门禁。

|场景|类型|Mock|浏览器脚本|可观察断言|性能|状态|
|---|---|---:|---|---:|---|---|
|N01|normal|6/6|2026-09-20-native-dye-browser.mjs|2|<500ms（325样本，最大385.29ms）|已验证|
|N02|normal|6/6|2026-09-20-tip-dispatch-ui-browser.mjs|15|<500ms（325样本，最大385.29ms）|已验证|
|N03|normal|6/6|2026-09-20-tip-dispatch-ui-browser.mjs|15|<500ms（325样本，最大385.29ms）|已验证|
|N04|normal|6/6|2026-09-20-tip-dispatch-ui-browser.mjs|15|<500ms（325样本，最大385.29ms）|已验证|
|N05|normal|6/6|2026-09-20-merged-N05-browser.mjs|4|<500ms（325样本，最大385.29ms）|已验证|
|B01|boundary|4/4|2026-09-20-b05-recovery-browser.mjs|3|<500ms（325样本，最大385.29ms）|已验证|
|B02|boundary|4/4|2026-09-20-b06-recovery-browser.mjs|2|<500ms（325样本，最大385.29ms）|已验证|
|B03|boundary|4/4|2026-09-20-tmf-cancel-browser.mjs|2|<500ms（325样本，最大385.29ms）|已验证|
|B04|boundary|4/4|2026-09-20-b05-recovery-browser.mjs|3|<500ms（325样本，最大385.29ms）|已验证|
|B05|boundary|4/4|2026-09-20-b05-recovery-browser.mjs|3|<500ms（325样本，最大385.29ms）|已验证|
|B06|boundary|4/4|2026-09-20-b06-recovery-browser.mjs|2|<500ms（325样本，最大385.29ms）|已验证|
|B07|boundary|4/4|2026-09-20-tip-dispatch-ui-browser.mjs|15|<500ms（325样本，最大385.29ms）|已验证|
|B08|boundary|4/4|2026-09-20-tip-dispatch-ui-browser.mjs|15|<500ms（325样本，最大385.29ms）|已验证|
|B09|boundary|4/4|2026-09-20-b09-recovery-browser.mjs|3|<500ms（325样本，最大385.29ms）|已验证|
|B10|boundary|4/4|2026-09-20-output-receipts-browser.mjs|8|<500ms（325样本，最大385.29ms）|已验证|
|B11|boundary|4/4|2026-09-20-pda-output-receipt-browser.mjs|23|<500ms（325样本，最大385.29ms）|已验证|
|B12|boundary|4/4|2026-09-20-package-stock-browser.mjs|17|<500ms（325样本，最大385.29ms）|已验证|
|B13|boundary|4/4|2026-09-20-processed-return-reuse-browser.mjs|2|<500ms（325样本，最大385.29ms）|已验证|
|B14|boundary|4/4|2026-09-20-frozen-replan-browser.mjs|3|<500ms（325样本，最大385.29ms）|已验证|
|B15|boundary|4/4|2026-09-20-tmf-cancel-browser.mjs|2|<500ms（325样本，最大385.29ms）|已验证|
|B16|boundary|4/4|2026-09-20-pda-output-receipt-browser.mjs|23|<500ms（325样本，最大385.29ms）|已验证|
|B17|boundary|4/4|2026-09-20-merged-N05-browser.mjs|4|<500ms（325样本，最大385.29ms）|已验证|
|B18|boundary|4/4|2026-09-20-tip-dispatch-ui-browser.mjs|15|<500ms（325样本，最大385.29ms）|已验证|
|B19|boundary|4/4|2026-09-20-upstream-issue-browser.mjs|3|<500ms（325样本，最大385.29ms）|已验证|
|B20|boundary|4/4|2026-09-20-package-stock-browser.mjs|17|<500ms（325样本，最大385.29ms）|已验证|
|B21|boundary|4/4|2026-09-20-purchase-durability-browser.mjs|4|<500ms（325样本，最大385.29ms）|已验证|
|B22|boundary|4/4|2026-09-20-material-reference-browser.mjs|4|<500ms（325样本，最大385.29ms）|已验证|
|B23|boundary|4/4|2026-09-20-b23-revision-browser.mjs|4|<500ms（325样本，最大385.29ms）|已验证|
|B24|boundary|4/4|2026-09-20-b24-return-browser.mjs|3|<500ms（325样本，最大385.29ms）|已验证|

机器可读收据：[2026-09-21-scenario-execution-receipts-current.json](2026-09-21-scenario-execution-receipts-current.json)。严格性能：[2026-09-21-tmf-strict-performance-current.json](2026-09-21-tmf-strict-performance-current.json)。页面/PDA/打印：[2026-09-21-page-pda-print-acceptance-current.json](2026-09-21-page-pda-print-acceptance-current.json)。
