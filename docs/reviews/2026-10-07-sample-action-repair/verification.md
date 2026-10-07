# 样衣申请及同类操作验证报告

当前本地原型业务验收通过：SAMPLE-FIX-01～13 的页面和规则均有本轮验证证据。

## 版本、范围与环境

分支 `codex/sample-action-repair`，基线 HEAD `450ab94193f549d73061247ac8f0881ad62d3aea`，工作树 `/Users/laoer/Documents/higoods`。实际运行 Vite PID 61689、地址 http://127.0.0.1:4206，浏览器 Chromium 149.0.7827.55，macOS，管理端 1366×768、最低 1280×720。原型为静态演示+按记录 IndexedDB；无真实后台或 WMS 调账。冷启动清 HTTP 缓存并禁用缓存；刷新恢复缓存；SPA 从不同路由真实点击进入。每轮使用隔离浏览器，未清除用户工作数据。

六个受管源文件的最终 SHA256 及每轮结果见 [manifest](evidence/manifest.json)。测试数据：静态样衣/申请与14条额外已贴码样衣记录，用于跨页选择与两条样衣完整申请。服务与测试脚本均读取本工作树，不引用其他版本页面。

## 完整业务与故障验收

- 新建、必填阻断、真实字段、两视图、搜索、空结果、分页、勾选/取消、保存草稿、编辑、直达详情与刷新。
- 草稿不预占；提交预占；审批→实际领用→发起归还→验收入库；两条样衣位置、占用、流转和台账一起更新且刷新一致。
- 驳回/取消释放自身预占；房间停用阻断审批，但不会阻断取消释放；通用流转不能绕过有效申请/案件。
- 保存空间不足保留输入和原记录，重试可保存；两个标签页拒绝陈旧保存，重新读取采用新版本。
- 退货新建/审批/执行；处置驳回恢复原状、执行变为不可申请；重复执行阻断。
- 盘点开始核查、结论与关闭可刷新读回，不修改样衣库存；不能跳过核查冒充调账。
- 七页刷新、搜索/筛选/重置、抽屉、大图、视图切换；未保存内容退出确认；读取故障提示、重试及记录不变；编辑页在已选样衣时读取失败保留原表单与输入，暂停依赖读取的操作，重试时经明确确认才重新初始化。
- 原有测款到样/全SKU贴码、直播/家播/工厂/部门/归仓、营销与生产类型互转重新执行五轮；中途事务失败无半套单据。
- HG仍按SKU共享，首次样衣登记日期不被打印/更新替代。打印55×35mm三联结果及无业务副作用、非法尺寸/份数、历史登记、并发发号回归通过；[打印PDF](evidence/sample-label-55x35.pdf)。

## 统一性能门禁

全部 1550 个原始有效样本均 <=1000ms；最大 410.39999997615814ms，不设例外、不剔除慢样本。

| 证据 | 五轮/次数 | 样本数 | 最大值 ms |
| --- | --- | --- | --- |
| browser-1～5.json：12条路由冷启动/刷新/真实SPA及申请、案件、盘点、所有列表操作 | 5 | 970 | 410.39999997615814 |
| boundaries-1～5.json：未保存保护、处置分支、展开及读取故障恢复 | 5 | 230 | 332.599853515625 |
| wp05-1～5.json：既有到样/贴码/流转/类型互转 | 5 | 180 | 182.69999998807907 |
| hg-performance.json：标签入口、尺寸、份数、生成1/100张及打印取消 | 每项5 | 170 | 383 |

点击/输入从事件开始，导航从浏览器开始；完成标准为内容及必要图片就绪、可继续操作并完成两帧绘制，保存成功后读回实际持久结果。读取重试触发整页reload的场景使用测试专用时间戳跨页面计时。每个测量名称至少五个原始样本。失败态图片也要求明确的失败提示完成；恢复后必须真实图片可读。

首次调试失败及原因保留在 [失败尝试说明](evidence/attempt-notes.md)，这些没有算作最终通过。最终脚本为 `tests/browser-contracts/pcs-sample-actions.test.ts`、`pcs-sample-action-boundaries.test.ts`、既有 wp05、hg-label、hg-performance 测试。

## 实际执行命令与证据

| 命令 | 结果 / 证据 |
| --- | --- |
| node --import tsx --test tests/browser-contracts/pcs-sample-actions.test.ts | 5/5通过；evidence/test.log |
| node --import tsx --test tests/browser-contracts/pcs-sample-action-boundaries.test.ts | 5/5通过；evidence/boundaries.log |
| node --import tsx --test tests/browser-contracts/pcs-sample-wp05.test.ts | 5/5通过；evidence/wp05.log |
| node --import tsx --test tests/browser-contracts/pcs-sample-hg-label.test.ts | 2/2通过；evidence/hg-label.log |
| SAMPLE_PERF_URL=http://127.0.0.1:4206 node --import tsx --test tests/browser-contracts/pcs-sample-hg-performance.test.ts | 通过；evidence/hg-performance.log |
| node --import tsx --test tests/browser-contracts/pcs-record-db.test.ts | 通过；evidence/record-db.log |
| node --import tsx --test tests/unit/pcs-sample-actions.test.ts tests/unit/pcs-sample-wp05.test.ts tests/unit/pcs-sample-hg-label.test.ts | 7/7通过；evidence/unit.log |
| node scripts/check-typescript-scope.mjs 六个受管源文件 | 范围0错误；全量既有3个范围外错误未修改；evidence/types.log |

最终工程检查（菜单路由、原型治理、列表治理、构建与CodeGraph）采用 `npm run workflow:verify -- --output /tmp/sample-action-repair/task-receipt.json --task-boundary "SAMPLE-FIX-01～13：样衣申请及同类操作修复"`。真实退出码、完整版本散列及收据状态以 [/tmp/sample-action-repair/task-receipt.json](/tmp/sample-action-repair/task-receipt.json) 和 [执行日志](/tmp/sample-action-repair/workflow.log) 为准；未获得 verified 不能宣布最终工程验证完成。

## 原型审查和交付边界

[完整审查记录](../../prototype-review-records/2026-10-07-sample-action-repair.md)、[逐项问题矩阵](plan-and-issues.md)。本轮主代理逐项正向/反向及对抗式审查通过；页面、规则、故障与性能验证均针对最终源文件。

本次没有新的合并或推送请求，成果保留在当前本地分支，不将其表述为已部署到GitHub/Vercel。
