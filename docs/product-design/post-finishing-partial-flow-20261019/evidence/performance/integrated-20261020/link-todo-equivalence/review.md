# 关联目录和专用后道工厂待办等价审查

日期：2026-10-20。独立静态审查与轻量 Node 内存契约；没有浏览器、构建或持久用户数据读写，不将此结果当作页面或性能通过。

`before-overview-head.ts.txt` 为当前 HEAD 原实现，脚本只把其相对依赖转成当前工作树绝对文件 URL，在独立模块中比较。`before-pda-detail-reconstructed.ts.txt` 为当前完整任务详情页逆向撤销本轮 perf guard 的重建基线，并非 HEAD/历史原文件：仅移除 runtime import、FULL 常量 import，并还原无条件 `listDyeWorkOrders()` 与原注释。该身份和生成方式明确记录，避免冒称直接捕获。

静态核读：后道 QC 目录原来只返回 QC_ORDER / RECHECK_ORDER / QC_MASTER_ORDER / fixture PROCESS_DOC，不返回 PRODUCTION_ORDER。PRODUCTION_ORDER 只保留生产单与同类 P1 的结果、顺序。PROCESS_DOC 的 fixture 行本来不依赖 QC 分组内容，专门分支只跳过不会返回的 QC/复检数据读取与映射。全局搜索调用保留原默认全目录构建。

实际 Node 结果：四个阶段（静态、两项部分完成、100/100/800 三个复检子单首100实收、QC直达）两个类型的全部行与字段及顺序 deepEqual，4748 个编号/主号/次号/生产上下文请求解析 deepEqual，所有类型的全局搜索完整 deepEqual。角色快照和报告见 JSON 与 run.log。

专用工厂实际常量为 PF-DEDICATED-001；九个既有/兼容角色的待办内容及计数在染色初始化前后完全一致。空 runtime、未知工厂和其他工厂仍调用染色初始化。实际 D10 的 ID-F090 不是专用常量，因此合法保留旧初始化；不根据此语义检查宣称其性能已达标。

此处没有修改权限过滤或待办公式。完整业务源、基线、脚本、结果日志的 SHA256 见 manifest.json。
