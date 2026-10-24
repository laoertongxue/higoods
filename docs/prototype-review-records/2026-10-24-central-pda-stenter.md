# 中央 PDA 定型机手感接入（首版）

依据 `AGENTS.md` 的 SCOPE-02、TRACE-01、REVIEW-01、PERF-01、EVIDENCE-01。

## 基本信息

- 日期：2026-10-24
- 任务 / 需求编号：PDA-CENTRAL-STENTER-20261024
- 任务：中央工厂 PDA 接入当前 Web 的定型机手感（洗水退役后的替代工序）
- 验证人：代理技术核验；用户接受未代填
- 工作树 / 分支：`publish-newpda-v34/higoods` / `codex/pda-factory-split`，基线 main `fa2e82324`

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：新增 `/fcs/pda/central/stenter/{receive|execute|warehouse}` 路由、中央框架页面、工序菜单入口；复用当前 Web/PDA 定型机手感命令、弹窗、打印和 GTG 权限。
- 契约变化：有（新增中央路由/页面和菜单入口；复用现有定型机手感命令、数量与状态规则，未改业务命令契约）

## 自查结论

| 检查项 | 结论 | 证据 / 边界 |
| --- | --- | --- |
| 中央路由、接收/执行/仓管 Tab、工序菜单入口 | 通过 | 真实浏览器 320×640；`/fcs/pda/central/stenter/receive` 显示中央框架、账号/工厂、三个 Tab；从中央“选择工序”可进入定型机手感。 |
| 当前 Web 数据与 GTG 范围 | 通过 | 隔离浏览器上下文用现有印花 QC 记录创建 1 张 GTG 手感单，来源交出后接收 Tab 显示“待GTG实收”卡片。 |
| 接收动作与保存回读 | 通过 | 逐卷核对 44/54 Yard、选择 GTG 待加工仓位，提交显示“已保存：GTG实际接收”；接收 Tab 清空，执行 Tab 出现“待投入 · 2 卷 / 投入手感加工”。 |
| 320×640 小屏与弹窗 | 通过 | 页宽 320、列表无横向溢出；接收/投入弹窗宽 304、底边 604，底部操作在可视区内，无控件越界。 |
| PDA 移动布局 | 通过 | 单行扫码/搜索、卡片列表、全宽主按钮；无 Web 筛选面板、列设置和分页；空态无分页；详情嵌入中央框架。首版曾复用 Web 筛选/分页，经用户指出后已改为移动端。 |
| Web/PDA 定型机手感回归 | 通过 | `stenter-handfeel`、`stenter-pda-render-boundary` 及新增中央契约共 27 项通过。 |
| 完整单测 / 类型 / 构建 | 通过 | 1902/1902 单测；`typecheck:engineering` 范围 0；全量 tsc 19 项与 main 基线一致；`vite build` 通过。 |

## 边界与未关闭项

- 印尼语内容：中央框架和 Tab 可切印尼语；定型机手感列表、筛选、弹窗文案仍为中文。按用户确认首版保留中文，登记为后续本地化缺口。
- 全动作链：已验证创建→来源交出→GTG 接收→执行待投入；投入加工、产出、交出、下游实收、完单、打印未在本轮浏览器完整走通，沿用原命令/单测边界。
- 性能 / 打印 / 物理设备：未做 5 样本性能门禁；打印、扫码枪、现场母语和用户接受未验证。

### 性能结论

- 结论：不适用
- 依据：本轮未做正式 5 样本性能采样；页面复用现有定型机手感页，中央入口只增加 PCS 准备、框架和三 Tab；已完成 320×640 功能核验，性能门禁另行执行。

### 页面证据

- 版本：worktree `publish-newpda-v34/higoods`，基线 main `fa2e82324`；Vite dev `127.0.0.1:4185`，隔离上下文 `pda-stenter-check`，320×640 设备模拟。
- 证据：中央框架与接收/执行/仓管三 Tab；工序菜单可进入；印花 QC 决定→来源交出→GTG 逐卷接收→执行待投入；接收弹窗 304×568、无控件越界；修正后列表为单行扫码/搜索 + 卡片 + 全宽主按钮，无筛选面板、列设置和分页；详情无内层重复返回头；控制台仅表单字段 id/name 提示。首版曾复用 Web 筛选/分页，按用户反馈修正后重新核验。

### 技术证据

- 对象与结果：中央路由/框架/菜单、GTG 接收保存回读、执行 Tab 卡片与 320 小屏布局。
- 证据：`tests/unit/central-pda-stenter.test.ts`、`stenter-handfeel.test.ts`、`stenter-pda-render-boundary.test.ts` 共 27 项通过；移动布局契约覆盖扫码、卡片和无分页；接收提交显示“已保存：GTG实际接收”，执行 Tab 出现“投入手感加工”。

## 最终结论

首版接入实现并通过本机边界与页面核验；印尼语内容、全动作链、性能和现场验收未关闭，用户接受未代填。

结论：通过

### 受管文件

- `src/pages/central-pda/stenter-page.ts`
- `src/pages/central-pda/entry.ts`
- `src/pages/central-pda/frame.ts`
- `src/pages/central-pda/dye-page.ts`
- `src/pages/central-pda/water-page.ts`
- `src/pages/central-pda/print-page.ts`
- `src/pages/central-pda/page.ts`
- `src/pages/central-pda/binding-page.ts`
- `src/pages/process-factory/dyeing/stenter-handfeel/work-orders.ts`
- `src/router/routes-central-pda.ts`
- `tests/unit/central-pda-stenter.test.ts`
- `docs/prototype-review-records/2026-10-24-central-pda-stenter.md`

## 验证命令

- `node --import tsx --test tests/unit/central-pda-stenter.test.ts tests/unit/stenter-handfeel.test.ts tests/unit/stenter-pda-render-boundary.test.ts`：通过
- `npm test`：通过
- `npx tsc --noEmit`：通过
- `npx vite build`：通过

浏览器：Vite `127.0.0.1:4185`，隔离上下文 `pda-stenter-check`，320×640 设备模拟；完整单测 1901 项，全量 tsc 19 项与 main 基线逐条一致；无页面错误，控制台仅表单字段 id/name 可访问性提示。

## 例外

- 无
