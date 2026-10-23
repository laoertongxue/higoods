# 本次产品审查

依据 `AGENTS.md` REVIEW-01。

## 基本信息
- 日期：2026-10-23
- 任务 / 需求编号：车缝外发协同「每日回货填报」与「每日回货汇总」合并为全量列表
- 验证人：Qoder（代理执行），用户待接受

## 影响判定
- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：两个页面合并为一个标准列表页；全量展示所有 PPIC 的车缝任务并按 PPIC 下拉筛选；写操作按任务当前负责 PPIC 记录；日确认按所选 PPIC 覆盖其全部当前任务；截止设置不再由组长身份阻断；旧汇总菜单、页面和地址退役。

## 自查结论
| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 标准列表与查询重置 | 通过 | `tests/ppic-daily-return-pages.spec.ts` 7/7；1280×720、1024×768 无文档横向溢出；查询、重置、分页、列设置、导出和图片均局部更新 |
| 全量展示与 PPIC 下拉 | 通过 | 数据契约 `getPpicDailyWorklistView` 不读取当前登录或组长身份；单元测试验证成员/组长读取的行集合一致，PPIC 筛选按任务当前负责人过滤 |
| 承诺、补回、改约归属 | 通过 | 页面把任务当前 PPIC 作为显式 actor 保存；承诺失败保留输入且同一操作重试唯一；补回“其他”原因必填；旧测试的 2026-10-22 实收会先兑现承诺，用例已改用实收之后的承诺时点 |
| 日确认 | 通过 | 确认弹窗按所选 PPIC 读取 `getPpicDailyReturnView({ actorId })`，覆盖其全部当前任务；有安排的旧无安排原因在重新确认时清除；确认后统计显示已提交 |
| 历史业务日 | 通过 | 非当前业务日显示“历史业务日只读”，新增承诺和日确认入口不可用 |
| 详情与图片 | 通过 | 回货明细保留应回明细、两节点、缺裁片、责任历史、承诺/补回链；大图 Esc 关闭、失败态可辨认 |
| 截止设置 | 通过 | 截止设置保留生效日和提交快照；成员登录可保存（移除原组长硬门槛，记录实际操作人） |
| 路由与菜单退役 | 通过 | `npm run check:sewing-outsourcing-information-architecture` 通过；汇总菜单、路由、渲染器、Vite 预加载入口和页面均无残留，工作台入口改为每日回货填报 |
| 后道实收共享契约 | 不适用 | 本任务未改变后道实收与分摊算法；`ppic-daily-return-receipts` 的 3 项失败在 HEAD `95003b31` 临时工作树复跑同样失败，未计入本次结论 |
| 类型检查 | 不适用 | 本任务文件无新增类型错误；全量 `npx tsc --noEmit` 仍被本任务未触碰的 PCS 技术包等既有错误阻断 |
| 生产构建 | 通过 | `npx vite build --outDir dist-ppic-perf` 成功 |
| 性能 | 通过 | 后续统计页任务已重新采样；两页各 5 个冷加载、5 个隔离上下文加载和 5 次查询，最大加载 357.6ms、最大查询 25.9ms，见 `output/ppic-daily-final-perf-20261023.json` |
| 审查记录覆盖 | 通过 | 本记录列出本任务全部受管文件 |

## 最终结论
结论：通过

## 受管文件
- `src/data/app-shell-config.ts`
- `src/data/fcs/ppic-daily-return-records.ts`
- `src/data/fcs/ppic-daily-return.ts`
- `src/main.ts`
- `src/pages/sewing-outsourcing/daily-return-report.ts`
- `src/pages/sewing-outsourcing/daily-return-summary.ts`
- `src/pages/sewing-outsourcing/workbench.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes.ts`
- `vite.config.ts`
- `architecture.md`
- `scripts/check-sewing-outsourcing-information-architecture.ts`
- `tests/fixtures/ppic-current-login.ts`
- `tests/ppic-daily-return-pages.spec.ts`
- `tests/unit/craft-route-preload.test.ts`
- `tests/unit/ppic-daily-return.test.ts`
- `tests/unit/ppic-daily-return-worklist.test.ts`

## 页面证据
- 版本：2026-10-23，分支 `main`，HEAD `4ad6cb4db85162f896fcd94df6b26193443299ec`，工作树含本任务改动及未触碰的无关差异；Vite 开发服务和 `vite build --outDir dist-ppic-perf` 预览均使用同一工作树。
- 证据：1366/1280/1024 列表截图、回货明细弹窗、Playwright 用例截图和实际操作记录如下。
  - 1366×768 标准列表：`output/ppic-daily-merged-1366.png`
  - 1280×720 标准列表：`output/ppic-daily-merged-1280.png`
  - 1024×768 员工 Web：`output/ppic-daily-merged-1024.png`
  - 回货明细弹窗：`output/ppic-daily-detail-1366.png`
  - Playwright 页面用例截图：`test-results/ppic-daily-report-1024.png`
  - 实际操作：PPIC 下拉筛选后列表收敛到该 PPIC 任务；日确认后 PPIC 状态变为已提交；新增承诺、修改安排、补回和图片大图均可操作；历史日期只读。

## 性能结论
- 结论：通过
- 依据：后续统计页任务重新采样；生产预览 1366×768 两页各 5 个冷加载、5 个隔离上下文加载和 5 次查询，最大加载 357.6ms、最大查询 25.9ms；原始样本见 `output/ppic-daily-final-perf-20261023.json`。合并页在统计页任务后仍保持同一 1366×768 列表布局。

## 验证命令
- `node --import tsx --test tests/unit/ppic-daily-return.test.ts tests/unit/ppic-daily-return-summary.test.ts tests/unit/ppic-daily-return-worklist.test.ts`：通过
- `npx playwright test tests/ppic-daily-return-pages.spec.ts --config tests/ppic-daily-return.config.ts --workers=1 --reporter=line`：通过
- `node --import tsx --test tests/unit/craft-route-preload.test.ts`：通过
- `npm run check:sewing-outsourcing-information-architecture`：通过
- `npm run check:menu-routes`：通过
- `npx vite build --outDir dist-ppic-perf`：通过
- `npx tsc --noEmit`：不适用（全量检查存在与本任务无关的 PCS 技术包既有错误；本任务文件无新增类型错误）
- `npx playwright test tests/ppic-daily-return-receipts.spec.ts --config tests/ppic-daily-return.config.ts --workers=1 --reporter=line --grep "主管订正|补录后仅订正数量|PDA后道确认冷开"`：不适用（3 项失败在 HEAD `95003b31` 临时工作树同样复现，属既有后道实收数据差异）

## 例外
- `ppic-daily-return-receipts.spec.ts` 的主管订正、毫秒订正和 PDA 冷开 3 项在 HEAD `95003b31` 基线同样失败，属既有后道实收/数据差异，未作为本次交付通过证据。
- `npx tsc --noEmit` 的全量失败集中在本任务未触碰的 PCS 技术包等文件；本任务修改的文件未新增类型错误。
- 会话期间外部提交 `e3b7205b`、`4ad6cb4d` 已落地，工作区还包含其他任务的无关改动；本任务只修改上述受管文件，未清理或回退无关差异。
