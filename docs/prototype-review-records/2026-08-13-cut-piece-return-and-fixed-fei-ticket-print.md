# 裁片退仓处理与菲票固定打印原型审查记录

> **历史收据提示（2026-08-15）**：本文记录 2026-08-13 当时版本，不是当前退仓实现证据。菲票打印证据继续保留；退仓内重新齐套和再交出已经由 2026-08-15 简化方案替代，当前证据见 `2026-08-15-cut-piece-return-supplement-source.md`。

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-13 |
| 相关需求 / 任务 | 普通与特殊工艺部位菲票统一 100mm × 100mm；面料 / 颜色、唛架编号 / 铺布单号分行；新增三方车缝工厂裁片退仓完整闭环 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS（裁床厂管理）/ FCS 共享打印与补料事实 |
| 涉及页面路径 | `/fcs/craft/cutting/cut-piece-return-processing`、`/fcs/craft/cutting/warehouse-management/wait-handover`、`/fcs/craft/cutting/fei-tickets`、`/fcs/craft/cutting/fei-tickets/print` |
| 端类型 | 管理 / 主管端桌面 Web、打印预览 |
| 主要角色与任务 | 裁床退仓员接收清点与打大菲票；主管报废和补料；齐套员重新装袋；交出仓管正式再交出；菲票打印员打印普通 / 特殊工艺部位菲票 |
| 开工分支 / 版本 | `codex/fcs-fei-ticket-standard-lists@1decb915f0edcf6c87dc08da2f04c244f31d4a36` |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：部位菲票物理预览尺寸和两个业务单元格排版发生变化；裁后处理新增菜单、标准列表、详情、接收清点、报废、补料、齐套、退裁片大菲票和正式交出动作；裁床待交出仓新增退裁片库区与重新齐套待交出区域；列表新增款式 / 物料缩略图和大图。

边界说明：

- 既有菲票生成、普通 / 特殊工艺分类、白 / 黄纸分流、特殊工艺承接工厂门禁、手动新增、首次打印和补打逻辑不在本轮改写。
- 退仓闭环只适用于三方车缝工厂把裁片退回裁床，不替代车缝自退、特殊工艺回仓或普通中转袋退回。
- 责任按件计算，部位库存按片计算；齐套进入待交出仓不增加责任，正式交出才增加。
- 本轮不新增 PDA 页面、真实接口、数据库或打印机驱动。

当前审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、标准列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端标准列表和退仓员、主管、齐套员、交出仓管动作均已在当前工作树命名页面复验。 |
| 文案、状态、数量与单位 | 通过 | “件”用于责任和完整齐套，“片”用于部位清点、库存、报废和补料；200 → 188 → 188 → 203 专项契约已通过。 |
| 扫码、真实图片与对象识别 | 通过 | 款式图和 Black / Charcoal 物料图均为对象对应正式图片；同列缩略图、大图、Esc、关闭和强制失败态已在浏览器复验。 |
| 防错、危险确认与主管兜底 | 通过 | 超责任、超库存报废、补料未完成、齐套件数不一致均阻断；报废和正式交出二次确认。 |
| 交接、跨端事实与异常追溯 | 通过 | 来源交出事实冻结；补料登记到统一补料事实；退裁片库区、待交出仓和正式交出分离；九类动作均有追溯。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 / 不适用 | 1366×768、1280×720 均无页面主体横向溢出；本轮不新增 PDA、上传或弱网流程，对应新增能力不适用。 |
| 命名路由、交互、图片大图与打印 | 通过 | 菜单、列表、详情、待交出仓、普通 / 特殊 / 退裁片大菲票三类当前页面证据均已生成。 |

## 4. 问题标签

- `算不准`：退仓、补料和再次交出并存时，车缝工厂应回数量缺少明确责任公式，现已建立事件口径。
- `协作断裂`：退回裁片、补料裁片、退裁片库区、待交出仓和正式交出此前没有完整交接链，现已接通。
- `缺扫码识别`：旧实物菲票缺失时无法快速确认部位，现已补充扫码 / 输入 / 直接选择 / 全选。
- `字段过载`：菲票面料与颜色、唛架与铺布单原挤在同一行，现已分两行。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 普通与特殊工艺菲票物理尺寸不一致 | `视觉干扰` | 菲票打印员 / 车缝现场 | 两类部位菲票统一 100mm × 100mm，保留纸色差异 | 否；两类实测均为 377.9375px 正方形（CSS 100mm） |
| 关键信息挤在同一行 | `字段过载` | 菲票识别人员 | 面料 / 颜色、唛架 / 铺布分别采用两行业务单元格 | 否；普通与特殊工艺打印预览均已复验 |
| 退回后又补齐时应回责任易重复扣减或增加 | `算不准` | 裁床主管 / 跟单 | 冻结责任基数，只有确认退件扣减、正式再交出增加 | 否 |
| 退回裁片可能混入普通待交出库存 | `协作断裂` | 退仓员 / 交出仓管 | 裁床待交出仓内建立独立退裁片库区，齐套装新袋后才转普通待交出 | 否；退裁片在库与 BAG-RETURN-001 齐套待交出分区已复验 |
| 补裁数量被误解为退回数量副本 | `算不准` | 裁床主管 | 部位补裁片数不设清点量上限，最终补齐件数另存 | 否 |
| 旧实物菲票缺失时无法重新打票 | `缺扫码识别` | 裁床退仓员 | 按退仓单已知部位识别并打印 100mm × 100mm 大菲票 | 否；TR-812001-01 大菲票和二维码已复验 |

## 6. 最终结论

结论：通过

说明：

- 领域数量、补料关联、菜单路由、待交出仓主链、固定打印布局、标准列表和相邻裁床主线均已通过最后一次代码修改后的专项与浏览器验证。
- 查漏发现并修复退仓补料进入共享事实后，裁剪结果核查缺少中转袋袋况集合导致空白的问题；修复后真实浏览器 0 控制台错误，完整阶段 8 为 22 / 22 通过。
- CodeGraph 已同步且状态为最新；构建、差异检查和完整原型治理通过。最终任务收据状态为 `verified`、阻塞 0。
- 本记录最终结论只表示当前本地工作树的产品与技术验证结果，不等同于已经提交、远端交付或产品正式接受。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/cutting/cut-piece-return-domain.ts`
- `src/main.ts`
- `src/pages/print/print-styles.ts`
- `src/pages/print/templates/label-print-template.ts`
- `src/pages/process-factory/cutting/cut-piece-return-processing.ts`
- `src/pages/process-factory/cutting/fei-ticket-print-projection.ts`
- `src/pages/process-factory/cutting/fei-tickets.ts`
- `src/pages/process-factory/cutting/meta.ts`
- `src/pages/process-factory/cutting/transfer-bag-return-model.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`

### 页面路由

- `/fcs/craft/cutting/cut-piece-return-processing`
- `/fcs/craft/cutting/cut-piece-return-processing?caseId=cut-return-001`
- `/fcs/craft/cutting/warehouse-management/wait-handover`
- `/fcs/craft/cutting/fei-tickets`
- `/fcs/craft/cutting/fei-tickets/print`

### 验证命令

- `npm run check:cut-piece-return-processing`：通过（责任、接收、报废、补料、齐套、交出、大菲票、菜单 / 路由 / 待交出仓集成）。
- `npm run check:cutting-fei-ticket-fixed-print-layout`：通过（普通 / 特殊同为 100mm × 100mm、两行字段、纸色与承接工厂门禁）。
- `npm run check:menu-routes`：通过（161 个唯一菜单路由，0 缺失、0 重复）。
- `npm run check:cutting-warehouse-management-switch`：通过。
- `npm run check:cutting-wait-handover-transfer-bag-flow`：通过（266 项，0 失败）。
- `npm run check:cutting-fei-ticket-paper-routing`：通过（6 / 6，白 / 黄纸分流、混打与承接工厂门禁）。
- `npm run check:cutting-fei-ticket-standard-lists`：通过（10 / 10，两个列表、偏好隔离、图片、PDA 入口与两档分辨率）。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43198 npx playwright test tests/cutting-stage8-regression.spec.ts --workers=1 --reporter=line`：通过（22 / 22）。
- `npm run check:cutting:all`：通过（裁片主线、待交出仓、中转袋和 PDA 相邻链路全绿）。
- `npm run check:standard-list-page-template`：通过（真实 Chromium 拖拽 1 次，主体、统计、分页 DOM 稳定）。
- `npm run check:list-page-governance:static`：通过（扫描 356 页，历史基线 17）。
- `npm run check:prototype-design-governance -- --all`：通过（当前工作树全部受管文件均有完整或既存有效审查记录）。
- `npm run build`：通过（Vite 2343 个模块完成构建）。
- `git diff --check`：通过。
- `codegraph sync`、`codegraph status`：通过；索引 1501 个文件、46190 个节点、163399 条边，状态为最新。
- `npm run workflow:verify -- --output /private/tmp/cut-piece-return-task-receipt.json --task-boundary "裁片退仓处理与菲票固定打印完整闭环"`：通过，收据状态 `verified`、阻塞 0；收据内裁床全链、菜单、原型治理、列表治理和构建退出码均为 0。首次沙箱内运行因系统禁止 `tsx` IPC 与 Chromium Mach 端口被拦截，同一命令获准在沙箱外运行后全部通过，不属于代码失败。

### 真实图片验证

| 图片 | 对象对应 | 文件事实 | 浏览器验收 |
| --- | --- | --- | --- |
| `public/pants-sample.jpg` | `SPU-2024-010` 弹力斜纹束脚裤款式 | 1024×1024 JPEG，已人工查看为裤装实物 / 效果图 | 通过：同列缩略图、大图、Esc / 遮罩 / 按钮关闭 |
| `public/materials/fei-ticket/black-stretch-twill.png` | Black 弹力斜纹主面料 | 1448×1086 PNG，已人工查看为黑色有纹理裁边面料图 | 通过：同列缩略图、大图和失败态 |
| `public/materials/fei-ticket/charcoal-stretch-twill.png` | Charcoal 弹力斜纹主面料 | 1448×1086 PNG，已人工查看为炭灰色有纹理裁边面料图 | 通过：同列缩略图、大图和失败态 |

页面已提供并在当前工作树验证加载中、失败提示、同列缩略图、遮罩、关闭按钮、Esc 关闭和保持比例的大图层。

### 浏览器与打印证据

证据目录：`output/playwright/cut-piece-return-20260813/`

- `01-list-1366x768.png`、`12-list-1280x720.png`：标准列表与两档分辨率。
- `02-style-image-preview.png`、`03-material-image-preview.png`、`04-image-failure-state.png`：真实图片、大图与失败态。
- `05-receive-detail-188.png`：确认退回 12 件、34 片，责任由 200 件降至 188 件。
- `06-large-ticket-100mm.png`：退裁片大菲票 TR-812001-01，100mm × 100mm。
- `07-supplement-manual-quantities.png`：最终补齐 15 件；袖片补 17 片，大于此前清点 12 片。
- `08-rekit-mixed-source-bag.png`、`09-wait-handover-responsibility-188.png`：退回片和补料片共同装入 BAG-RETURN-001，进入待交出仓后责任仍为 188 件。
- `10-wait-handover-return-zone-fixed.png`：退裁片库区与重新齐套待交出分区。
- `11-formal-handover-responsibility-203.png`：正式再交出 15 件后责任更新为 203 件。
- `13-ordinary-fei-ticket-100mm.png`、`14-special-fei-ticket-100mm.png`：普通 / 特殊工艺部位菲票同为 100mm × 100mm，业务字段分行。

### 例外

- 本轮不新增 PDA、上传、弱网队列或真实打印机驱动；对应项不适用。
- 用户工作区中既有的 PCS 专项变更不属于本任务，不吸收、不覆盖，也不作为本任务验收证据。
- 任务收据工具会绑定当前完整工作区差异，因此收据清单中可见用户既有 PCS 路径；本任务结论只引用上文退仓 / 菲票专项证据和受管文件，不将这些 PCS 路径归为本任务实现。
