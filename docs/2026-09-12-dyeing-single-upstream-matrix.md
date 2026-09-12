# 单一投入与上游交付矩阵

来源均为 [设计](2026-09-12-dyeing-single-upstream-design.md) 第 1 节同编号条款，实施工作包见第 3 节。产品规则确认人为本任务用户；实现验证人为 Codex；产品界面接受尚未声明。

| 编号 | 原子需求 | 工作包 | 实现 | 自动化证据 | 页面证据 | 状态 | 确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SU-001 | 一单一种投入、一个上游 | W1 | demo-details、receiving-mock | check-dyeing-single-upstream | 染色加工单 | 已验证 | codex/dyeing-single-upstream |
| SU-002 | 保留同上游分批来源及实收 | W2/W3 | receiving、work-orders | check-dyeing-single-upstream | 染色加工单及待接收 | 已验证 | codex/dyeing-single-upstream |
| SU-003 | 拒绝其他物料及其他上游关联 | W2 | receiving、receiving-links | check-dyeing-single-upstream | 备料关联 | 已验证 | codex/dyeing-single-upstream |
| SU-004 | 修复未操作旧演示并保留已操作历史 | W1 | receiving read | check-dyeing-single-upstream | 旧演示存储刷新 | 已验证 | codex/dyeing-single-upstream |
| SU-005 | 列表、查看、导出及下一批一致 | W3 | online-view、work-orders、overlays、detail | list-sections、single-upstream | 列表与查看 | 已验证 | codex/dyeing-single-upstream |
| SU-006 | 毛织及单据多行范围保持 | W2/W4 | 毛织分支不修改 | receiving-integration、material-receiving | 不适用：毛织页面无变更，按接收与库存契约回归 | 已验证 | codex/dyeing-single-upstream |

证据：`/private/tmp/dye-single-upstream-acceptance/browser-results.json`、同目录截图及最终 `task-receipt.json`；脚本路径均为 `scripts/` 对应 `.ts` 文件。完整路由、命令、历史例外及验证人见 [审查记录](prototype-review-records/2026-09-12-dyeing-single-upstream.md)。

正向追踪：设计第 1 节六条规则逐条对应 SU-001..006，第 2 节正常/阻断/旧演示场景由上述专项及浏览器覆盖，第 3 节 W1..W4 均有实现与证据。反向追踪：每个受管文件分别属于 W1、W2 或 W3；没有新增毛织规则、列或路由。
