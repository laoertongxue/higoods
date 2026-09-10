# PPIC V2 与 main 兼容修复双轮审查

## 1. 基本信息
- 日期：2026-09-10；分支：codex/ppic-adjustment-20260908；基线：590bd07a690ada7b96f4e958f57d76fe5894f43e。
- 需求：用户授权修复兼容问题，双轮验收后合并 main 并推送；COMP-001～006。
- 系统：FCS/PPIC/PDA；管理端、主管端、仓管员工端。
- 当前工作树 /Users/laoer/Documents/higoods，实际服务 http://127.0.0.1:5196，局域网 http://192.168.0.21:5196。
- 记录模式：完整产品审查。原55文件的逐项范围见 2026-09-08-ppic-v2-local-in-progress.md 及 PPIC V2 150条矩阵；本记录补齐与最新main组合的最终验收。

## 2. 影响判定
- 用户可见影响：有
- 受管文件：`src/data/fcs/process-tasks.ts`、`src/data/fcs/production-orders.ts`；其余PPIC原改动由上述原记录逐项覆盖。
- 判定依据：保留专属车缝/裁片/毛织/后道任务身份、完整数量及全部工艺依赖；普通印染加工仍按实际接收方拆单。
- 派单可选工厂主档与生产单承接登记一致，新增主档工厂可保存；不存在的工厂仍阻断。
- 页面结构保持，修复业务数据关联。基线为AGENTS.md第4、5、7节。

## 3. 自查结论
| 检查项 | 结论 | 证据 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 10个PPIC命名列表，两轮分别1366×768、1280×768 |
| 文案、状态、数量与单位 | 通过 | 真实点击派单保存完整4SKU/2500件，责任历史2版本 |
| 扫码、真实图片与对象识别 | 通过 | 复用技术包正式款式/物料图片，同格缩略图可开大图；可见图片complete/naturalWidth检查；打印款式图 |
| 防错、危险确认与主管兜底 | 通过 | 放行不足阻断派单，足额后价格二次确认，未知工厂阻断，旧领料二维码失效 |
| 交接、跨端事实与追溯 | 通过 | PDA实交刷新后保留，责任移交新旧版本可查；不把交出当接收或开工 |
| 低分辨率及PDA | 通过 | 1280×768主体无横向溢出，PDA390×844；弱网/上传不属本次改动 |
| 命名路由、交互与打印 | 通过 | 筛选/重置/导出、来源详情、图片大图Esc、打印预览及PDF |

## 4. 问题标签
已修复：任务关联丢失、数量误拆、工厂登记来源不一致。

## 5. 页面验收
- `/fcs/dispatch/workbench`：不足放行阻断；模拟裁床足额放行后人工派单，2500件落入有效分配。
- `/fcs/sewing-outsourcing/` 下 `workbench`、`team-workbench`、`tasks`、`cut-piece-handover`、`sample-approval-suggestions`、`returns`、`supplements`、`cut-piece-returns`、`responsibility-transfers`、`production-order-duration`。
- `/fcs/print/preview`：裁片领料单预览、真实款式图、A4 PDF。
- `/fcs/pda/handover`：实交保存与刷新、补打后旧二维码阻断。
- 两轮证据：`output/ppic-main-release/round1/`、`output/ppic-main-release/round2/`。包含28项正向/反向检查收据、12步全流程收据、页面截图、领料PDF和耗时导出。

## 7. 验证证据
- 最终代码：两轮各28项通过；新增3项兼容单元检查通过；npm run build通过；普通工艺接收方拆单的three-axis专项通过。
- CodeGraph已sync，status无待同步文件；最终项目收据见 `output/ppic-main-release/task-receipt.json`。
- 既有例外：`check-process-work-order-unification.ts:493`用旧源代码字符串检查工厂端染色“查看”按钮，当前分支和干净main 590bd07a均同样失败。不是本次引入；未修改无关脚本绕过检查。当前印染页面另做浏览器回归。
- 无真实扫码枪/纸张打印，证据是浏览器二维码路由与PDF；无真实后端业务写入。图片未新建或替换；未涉及图片加载失败处理变更。

## 6. 最终结论
结论：通过。兼容修复和PPIC业务双轮验收通过；验收人为Codex，产品负责人已授权范围及通过后发布，尚不把本地验收视作产品正式接受。远端发布版本以GitHub main回执为准。

### 受管文件
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/production-orders.ts`

### 验证命令
- `npm run build`：通过。
- `node --import tsx --test tests/unit/ppic-route-compatibility.test.ts`：通过，3项。
- `node --import tsx scripts/check-sewing-outsourcing-verification-pass.ts`：通过，两轮各28项。
- `node --import tsx scripts/check-process-order-three-axis-flow.ts`：通过。

### 例外
- 既有印染源字符串检查在干净main同样失败，详见第7节；不属于本次引入。无真实打印机和扫码枪，使用PDF和二维码页面入口验收。
