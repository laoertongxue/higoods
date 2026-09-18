# 毛织两阶段实施验证索引

## 当前结论

**业务实现与已执行功能证据已登记，总体尚未通过验收。** 需求矩阵 126 条：119 条“已实现待验证”、7 条“实施中”，无提前标记的“已验证”。独立对抗式审查发现的业务缺陷已逐项修复并回放，增量功能审查已通过；加载/逐入口性能和完整受影响范围证据尚未闭合，不能据此宣称任务完成。

开放的加载、交互及场景缺口统一见 [尚未关闭的验收项](./open-acceptance-items.md)。不以独立功能审查通过替代总体门禁。

## 版本与环境

- 工作树：`/Users/laoer/Documents/higoods/.worktrees/work-20260918`；分支 `codex/work-20260918`。
- 基准 HEAD：`4804328a822eec3c77eee1ffa5b10911bb77c9fe`，本次变更尚未提交。[实现清单](./implementation-manifest.json) 记录当前未提交源码摘要及构建 SHA；不得把基准提交单独当作本次实现版本。
- Node 26.8.2；Chromium 149.0.7827.55 / Playwright；macOS 本机。
- 证据记录时开发服务为 `http://192.168.5.2:5186`（PID 36325），生产预览为 `http://192.168.5.2:4186`（PID 55367），均经 `lsof ... -d cwd` 确认本工作树；性能脚本实际 base 为 `http://127.0.0.1:4186`。PID 是该轮记录，不作为持续在线承诺。
- 浏览器使用独立上下文、独立 localStorage；没有清除用户浏览器数据、修改线上数据或发布部署。
- 管理端 1366×768、1280×720；PDA 360×800、400×806。适用主管 1024×768 的全入口覆盖尚待补齐。
- 加载与交互量化结果属于当前冻结构建 `a2055fb5b136a4d37a77effb92b55b08662b9dc4c754bab157f06fb1d34641d7`（`dist/index.html` SHA-256）。已包含工艺仓独立副本复制、PDA 交接冻结读取及阶段待办修复；三份原始性能报告构建 SHA 一致。
- 实施核验：Codex 主代理与限定范围审查子代理；用户已确认业务及授权设计实施，尚未确认产品实现验收人或接受版本。

## 自动化与浏览器证据

| 验证 | 命令/文件 | 结果及边界 |
|---|---|---|
| 两阶段业务聚合 | `node --import tsx scripts/check-wool-fact-workflow.ts`；[日志](./core-contracts.log) | 17 个专项通过，涵盖来源、路线隔离、数量、接收、修正、清旧、仓储、最终下游及跨进程刷新；不是浏览器性能验收 |
| 新对抗反例 | `node --import tsx scripts/check-wool-adversarial-regressions.ts`；[日志](./adversarial-regressions.log) | 7 项通过：两类存储失败及重复失败/恢复、异厂123kg备料、10kg领用+4kg转出、PDA方向展示 |
| 接收上下游回归 | `node --import tsx scripts/check-factory-receiving-integration.ts`；[日志](./receiving-integration.log) | 通过：染色称重净量→毛织实收、刷新防重、批次库位、分配/领退/移库守恒；旧单ID按新模型更新，数量断言按本测试真实批次隔离 |
| 非毛织印花保护 | `node --import tsx scripts/check-printing-factory-demos.ts`；[日志](./printing-regression.log) | 10厂×5场景、原12条保留、来源/实收/库存一致性通过；修正演示初始化误用实际PDA登录厂权限的问题 |
| Web/PDA真实行为 | `tests/wool-management-fact-workflow.spec.ts`、`tests/wool-pda-main-local-rerender.spec.ts`、`tests/wool-stage-actions.spec.ts`、`tests/wool-final-craft-pda.spec.ts`；[最终日志](./browser-regressions.log) | 冻结版31项通过（1.8m）；覆盖两阶段、自动衔接、超量、片工艺、备料、最终成衣工艺接收前后刷新、图片、低分辨率、导出、列偏好、PDA返回、双阶段扫码、完单二次确认、设备关联、数量更正、工艺片CSV身份和实际 PDA 待办资料阻断提示 |
| 构建与工程单元 | `npm run build`；[日志](./build.log)；最后提示修复后 [Vite 再构建](./final-vite-build.log) | 123单元测试与Vite构建通过；不替代业务验收。仓库全量 `tsc --noEmit` 有61条跨域诊断，本次受修改/新增文件0条；[类型诊断原文](./typescript-diagnostics.log)，全量类型检查不通过 |
| PDA 查询与待办增量 | `node --import tsx scripts/check-wool-pda-factory-projection.ts`；[日志](./pda-factory-projection.log) | 7厂隔离、查询副本、实际交出/接收即时刷新、两阶段待办和缺逐片资料提示通过；独立实际 PDA 写入及非毛织保护见来源审查 §8 |
| 标准列表治理 | `npm run check:list-page-governance:static`；[日志](./list-governance.log) | 411页、17历史基线通过；未修改基线规避检查 |
| 原型治理 | `npm run check:prototype-design-governance -- --all`；[最新归档日志](./design-governance.log)；[记录](../../../prototype-review-records/2026-09-18-wool-two-stage-adjustment.md) | 80个受管文件关联记录，格式覆盖通过；较早 prototype-governance.log 的72项不代表本轮覆盖量，产品结论仍不通过 |
| 冷/刷新/站内切换 | `node scripts/check-wool-route-performance.mjs`；[原始结果](./route-performance.json) | 25路由×冷进入/刷新/站内切换×各5次=375样本；198失败，0页面错误，所有25路由至少一项失败；最大1603ms。不通过，未剔除初始化、必要图片或慢样本 |
| 交互五样本 | `node scripts/check-wool-action-performance.mjs`；[原始结果](./action-performance.json) | 71个命名操作×5次=355样本全部通过，最大95.59999999403954ms，0页面错误。仅此命名范围通过；另18项见下一行；仍缺缝盘完单、设备更换、修正拒绝、打印、工艺和PDA通用入口的完整计时，不能关闭 VERIFY-004 |
| 完单/设备/修正补充交互 | `node scripts/check-wool-extra-action-performance.mjs`；[原始结果](./extra-action-performance.json)；[日志](./extra-action-performance.log) | 18个命名操作×5次=90样本全部通过，最大65.69999998807907ms；包括Web/PDA横机完单打开、取消、重开、输入、保存，Web设备关联选择/保存及数量更正。与上一行合计89项、445样本；不代表全部入口通过 |
| 功能截图 | `node scripts/check-wool-stage-browser.mjs`；[结果](./browser-results.json) | 仅功能与图片截图；明确 NOT_ASSESSED_BY_THIS_SCRIPT，不再输出可能误导的性能通过 |
| 既有KOL失败对照 | [未修改HEAD](./kol-baseline-known-failure.log) / [当前工作树](./kol-current-known-failure.log) | `check-kol-goto-special-flow.ts:326` 两边同为预期DYE、实际空数组；基线由 `git archive HEAD` 隔离复现，未把失败冒称通过；本次KOL复用生成结果5单深比较通过，见独立审查 |

## A01—A20 场景追踪

以下是现有覆盖位置，不把“有代码/有Mock”等同于验收通过。除注明外，专项脚本均在 `scripts/`；页面完整性能仍待闭合。

| 场景 | 数据/触发条件 | 直接证据 | 尚缺边界 |
|---|---|---|---|
| A01 | 整件003累计100件；无外加工 | `check-wool-two-stage-flow.ts` 整件100四事实；浏览器无外加工填报一次 | 全动作5样本性能 |
| A02 | 部位002/004，无逐片维护 | `check-wool-piece-source.ts`；two-stage自动衔接 | 全页面性能 |
| A03 | 多厂010/011，外发片80与100，不外发对应100 | two-stage最短板；浏览器混合量81阻断/50保存 | 全动作5样本性能 |
| A04 | 已缝盘50，再填31 | two-stage A03/04/06明确阻断 | PDA同场景页面全覆盖 |
| A05 | 008/009 两片首厂不同 | two-stage分批；handover-printing；浏览器横机首厂交出/打印 | 全页打印分页及性能 |
| A06 | 009多工艺逐节点交接 | craft-warehouse；浏览器第一厂加工交出、第二厂实收前0 | 完整工艺页各动作性能 |
| A07 | 013同名工艺多节点；多纱线同片 | piece-source 12项；craft-generation-boundary | 真实页面全节点链路 |
| A08 | 一批多次实际接收 | two-stage分批；stage-receiving；浏览器最终片分批刷新 | 完整逐笔PDA页面与性能 |
| A09 | 014缺首厂；路线环/歧义 | route-isolation；piece-source；two-stage阻断；factory-projection及stage-actions真实PDA待办资料缺失提示 | 其余路线环/歧义等阻断的真实页面 |
| A10 | 不同SKU路线与数量隔离 | route-isolation；piece-source；stage-rules | PDA多SKU选择回归 |
| A11 | 重试冲突及保存失败 | stage-boundaries；adversarial-regressions；final-downstream变更确认号 | 弱网式页面恢复提示完整证据 |
| A12 | 未交出可修正、最终交出后不可回写 | two-stage；stage-boundaries；stage-actions真实35件同步/下游消费后阻断 | 数量修正弹窗逐入口计时 |
| A13 | 横机150%；合法实交超过计划 | two-stage横机150%阻断；stage-receiving工艺片计划10/实交40，分批收15+25、超余量26阻断；final-downstream另覆盖整件成衣工艺计划10/实交12 | 领域反例分别覆盖片和件；多工艺超计划的真实页面完整链及性能仍待补 |
| A14 | 阶段加工达计划，交接未闭合/独立完单 | two-stage；stage-stock-machine；stage-ui；stage-actions Web及两尺寸PDA完单、取消、阻断、刷新 | 完单逐入口性能 |
| A15 | 绑定技术包快照深复制及冻结 | piece-source；production快照代码 | 当前默认版本变化的页面对照 |
| A16 | 单据/待接收/PDA读取共享事实 | stage-receiving；stock-allocations；receiving-integration；浏览器PDA接收 | 各角色全入口五样本 |
| A17 | 部位指定裁厂、整件指定后道/后续工艺 | final-downstream的FLOW005核对指定裁厂来源及错厂排除；final-refresh两进程；整件后续成衣工艺Web/PDA两尺寸实际批次、刷新及错厂通过 | 部位裁厂和指定后道完整页面证据仍待补；成衣工艺PDA不能证明部位裁厂路径；全部整链逐入口性能仍缺 |
| A18 | 旧身份清空、设备保留、新有效任务新身份生成 | legacy-reset 7项；stage-ui旧路由/文件不存在 | 所有遗留访问路径浏览器复核 |
| A19 | 八列时间/数量、图片与打印 | stage-ui；stock-allocations时间；浏览器真实图片关闭/失败态/打印QR/列偏好/导出 | 1024适用页、所有打印分页及逐入口性能 |
| A20 | 阶段扫码、多候选、错厂、仅横机设备 | pda-single-execution；stage-stock-machine；stage-ui | stage-actions已覆盖实际扫码、双候选、错厂、横机关联；仍缺全部设备动作/扫码性能 |

## 对抗式审查

- [页面与查询审查](./ui-adversarial-review.md)：备料缺入口、分配接收筛选/时间、PDA身份、阶段错误路由等已修复。
- [主入口与共享数据独立审查](./root-changes-adversarial-review.md)：2项P1、4项P2，初始化半提交、异厂备料串量、PDA返回、出库符号、无效测量导航和误导性能结论已修复回放。
- [来源与最终下游审查](./source-downstream-adversarial-review.md)：重复工艺生成、局部路线阻断、清旧边界、指定裁厂、最终工艺真实批次/库存、底层超量与刷新恢复。
- [性能改动增量审查](./performance-changes-adversarial-review.md)：冻结快照、工厂投影、二维码及初始化边界；补充工艺片CSV身份P2已修复并在冻结版第30用例回放通过。该受检功能范围收口通过，性能没有获豁免。
- [来源审查 §8](./source-downstream-adversarial-review.md)补充通过防御副本、PDA 冻结读取与待办资料阻断 P2 修复。
- 主审收口：没有以专项通过替代完整交付。性能超时、尚缺页面/操作证据，以及A01—A20表最后一列均为开放项；不作“审查整体通过”或“完整完成”的结论。

## 继续收口所需工作

1. 修复生产预览实测仍超过200ms的依赖初始化/页面计算成本；每次实质修改重测对应样本。
2. 覆盖全部受影响页面、打印及每一交互入口至少5次（含首次、正常和边界），保留原始数据，不能用平均值代替最大值。
3. 补上表逐场景尚缺页面证据，继续补未覆盖的多SKU/阻断/1024尺寸/打印分页场景；最终工艺PDA、扫码、设备关联、修正及完单已补功能证据，仍需其全部性能入口。
4. 再做最终完整diff与需求矩阵正反向审查，在全部门禁满足后才逐条标记已验证并提交产品接受。

## 本次文档校正记录

最新[矩阵及文档校验](./matrix-document-validation.json)核对126个唯一编号、10个必填字段、121个实现/脚本文件摘要、三个性能报告的构建一致性及本目录 Markdown 本地链接；它只证明元数据一致，不替代语义或产品验收。

只核对既有代码、脚本及归档文件，未重跑测试。矩阵共126个唯一编号、10个必填字段；状态保留119条已实现待验证、7条实施中、0条已验证。工艺片数量与共享接收规则改绑直接命令，六状态改绑阶段列表，部位裁厂与整件成衣工艺分别对应证据，待接收及备料导出/列偏好更新到已归档31条回放。产品实现接受仍未发生。
