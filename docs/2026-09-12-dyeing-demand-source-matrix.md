# 需求来源交付矩阵

来源：[需求与计划](2026-09-12-dyeing-demand-source.md) 第 1 节同编号条款；第 2 节为工作包。业务确认：本任务用户；实现验证：Codex；不声明产品接受。

| 编号 | 原子需求 | 工作包 | 实现位置 | 自动化 | 页面/打印证据 | 状态 | 确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DS-001 | 第一部分工厂下方突出来源 | W1 | work-orders renderOrderProduct | check-dyeing-demand-source | 1366/1280 列表 | 已验证 | codex/dyeing-demand-source |
| DS-002 | 查看和独立详情同源 | W1 | overlays renderView、detail renderSourceFields | 同上 | 查看/详情 | 已验证 | 同上 |
| DS-003 | 编辑只读来源且保存保留 | W1 | overlays renderEdit | 同上 | 编辑保存刷新 | 已验证 | 同上 |
| DS-004 | 单张/批量流程卡来源且每单一页 | W2 | flow-card buildSingle/renderSingle | 同上 | A4 单张/批量 PDF | 已验证 | 同上 |
| DS-005 | 查询和三种导出有来源，无 Mock 空值 | W3 | online-view keywordValue/buildDyeWorkOrderCsv | 同上、list-sections | 搜索/导出 | 已验证 | 同上 |

所有条目均由 Codex 在当前分支、同工作树 5188 验证；业务确认人为本任务用户，未声明产品接受回执。验证基线 HEAD 996fae8d，最终实现差异由任务收据绑定。

自动化：`scripts/check-dyeing-demand-source.ts`（22 行）、`scripts/check-dyeing-list-sections.ts`、`scripts/check-dyeing-single-upstream.ts` 通过。页面与打印证据详见 [审查记录](prototype-review-records/2026-09-12-dyeing-demand-source.md)，浏览器报告 `/private/tmp/dye-demand-source-acceptance/browser-results.json`。正向核对 DS-001..005 均有实现及证据；反向核对仅来源展示、查询、导出和打印改动，无新增生成规则或跨模块业务变更。
