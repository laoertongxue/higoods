# 92 条换片布需求证据绑定审计（只读核查）

核查时间：2026-09-25。本文件依据现有矩阵、脚本、JSON/文本结果作证据定位；未运行浏览器、构建或重测试，未修改产品代码。路径根为 `output/playwright/hpb/`。矩阵状态及最终发布由主代理维护。本审计不宣称产品整体通过，也不把“未找到直接证据”判成代码缺陷。

## 证据版本与使用规则

- 当前矩阵仍沿用首轮 E01—E14 与 aac68249 描述；应按下列真实产物替换。最新功能/性能分别存在 build7、build8、build9，必须保留原版本及影响审查，不能统一改名为最终版本。
- `acceptance-final/source-build7.json`、`source-build8.json` 与 `acceptance-source-ui-final/manifest-build9.json` 为版本连接点；最后实质修改后的受影响场景需重新验收，无关场景可由主代理明确影响边界后保留。
- 一个浏览器脚本直接调用内部业务函数，属于浏览器业务集成证据，不等于真实按钮/扫码/页面流程证据；下表明确区分。
- `source-late-final.json` 含1条失败；其正确最终回执是 `source-late-final-r2.txt`（8/8）。旧失败保留但不得误绑。
- 审计时 `extra-controls-build8.json` 重置831.6ms、`print-controls-build8-functional.json` 整单528.2ms仍是保留失败。主代理已说明正在build9严格复验，结果产生后应替换本表性能绑定；本审计不自行宣称复验结果。
- `simple-handover-build9-r2.json` 仅第1组Web成功，第2组任务读取超时；后续父任务已完成Web5组并定位PDA输入框缺少 `data-skip-page-rerender=true` 导致重绘清空，已修复并准备build10复验。HAND008/UX001/UX004/PERF002应绑定build10实际新结果，不能以旧1组成功替代Web/PDA各5组。早期dev `two-factories-final.json` 可证明业务行为，但不是最终5样本性能。

## 可直接绑定的证据索引

| 索引 | 现有最新路径（均相对证据根） | 精确覆盖与边界 |
|---|---|---|
| U1 | `acceptance-final/core-final-7.log`；`tests/unit/replacement-fabric-fei-tickets.test.ts` | 核心84/84中的票身份、5Yard、改派、并集、任务/工厂、空集；不代替UI。tests路径从仓库根起。 |
| U2 | 同上；`tests/unit/replacement-fabric-source-and-history.test.ts` | SKU需料、朴、同名身份、颜色映射、历史数量与回执。 |
| U3 | `acceptance-final/binding-strip-final.txt`、`fei-assembly-final.txt`；`tests/unit/replacement-fabric-mixed-label.test.ts` | 捆条/部位契约和混装标签；非物理打印。 |
| D1 | `acceptance-source-ui-final/actions-build7.json`；`check-actions-final.js`；`cutting-scope-in.png`、`cutting-scope-out.png` | 真分配→3初始票→增票→真改派→移出/历史失效，5组。 |
| D2 | `acceptance-final/roles-build7.json`；`check-role-boundary.js` | 实际Web/PDA角色禁用与说明。 |
| D3 | `acceptance-final/two-factories-final.json`；`check-two-factories.js` | UI交出700片+1票、200片+0票、另任务另厂720片+第2票；前置/后续裁剪用显式Mock，dev单轮功能。 |
| D4 | `acceptance-final/simple-disabled-final.json`；`acceptance-integration/check-simple-disabled.js`；`acceptance-final/check-simple-handover-five.js`及最新build9-r2结果 | 禁LS直接交出功能；最新最终5组脚本仍未全过。 |
| D5 | `acceptance-final/mixed-backup-final.json`；`check-mixed-backup.js` | 多袋缺项/并集是内部业务函数集成调用；Web/PDA三类型详情是真实页面；不是完整待交出按钮验收。 |
| D6 | `acceptance-part-tickets/performance-build7.json`、`pda-stages-build7.json`、`fei-detail-build7.json`、`README.md` | 155/155，FEI/打印/铺布/PDA依赖；6独立事件、2卷、200米/6900量、失败重试；不替代HPB特定业务边界。 |
| D7 | `acceptance-source-ui-final/generation-build8.json`、`breakdown-build8.json`、`contract-transfer-build8.json`、`actions-build7.json`、`start-build7.json`、`pda-accept-build9.json` | 真实来源生成/拆解/分配/定标/合同/样衣/责任/接单/开工；每项前置与失败保留见脚本。 |
| D8 | `acceptance-final/history-print-build8-functional-r2.json`；`check-history-print.js`；`history-reprint.png` | 已交票补打、禁LS、receipt不变、票数不变。未实施改派、回收或再次交出。 |
| L1 | `acceptance-final/list-actions-build8.json`；`check-list-actions.js` | 135通过样本，查询/重置/导出/分页/跨页/列设置及尺寸。 |
| L2 | `acceptance-final/extra-controls-build8.json` | 55样本含1重置慢样本；冻结/拖拽/50条/图失败恢复等功能结果仍可单独使用。 |
| L3 | `acceptance-final/data-tools-build8-functional.json` | 20通过样本：检查/确认清理/迁移前确认/显式迁移空源。 |
| P1 | `acceptance-final/print-images-build8-functional.json` | 新增5次、大图5次；6票首打1张、补打保持票数/2打印记录、部分打印。 |
| P2 | `acceptance-final/print-controls-build8-functional.json` | 50样本，取消/未打印阻断/成功票选择/首打补打/整单，含1整单预览慢样本。 |
| P3 | `acceptance-final/label-qr-decode.json`、`label-render-1.png`、`label-render-2.png`、`labels.txt` | 正常与1001边界QR软件识别；不代表纸面扫描。 |
| P4 | `acceptance-final/lan-build8-functional.json` | 5次局域网HTTP非secureContext身份、增票、打印。 |
| B1 | `acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json` | 20通过样本，实际HPB003打印、扫描、装袋、详情刷新。 |
| B2 | `acceptance-bag-lifecycle/lifecycle-five-samples-build7.json` | 80通过样本，三类重装、占用库位失败/重试、回收/报废、逐票守恒。 |
| B3 | `acceptance-bag-lifecycle/web-detail-five-samples-build7.json`；`evidence-manifest.json` | 65通过样本，Web详情/刷新/11Tab与图片。历史Tab不等同历史打印。 |
| B4 | `acceptance-legacy-bags/preview-five-samples-build8.json`；`README.md` | 45通过样本；首读0旧写、失败0实体/输入保留、保存仅自身两实体、刷新。 |
| S1 | `acceptance-final/source-core-final.json`、`source-late-final-r2.txt`、`source-reload-final.json`、`source-actions-final.json` | 7+8+4核心与5动作：迁移/CAS/command/complete/失败/附件/禁LS。 |
| S2 | `acceptance-part-tickets/browser-eight-sources-final.txt`、`unit-results-final.txt`；`acceptance-final/storage-extra-final.json` | 8键记录迁移/校验/失败/禁LS；24unit，HPB核心容量/CAS。 |
| S3 | `acceptance-final/migration-final.json`、`retired-history-final.json` | 共用裁后键/历史迁移，101/202条批量、中断/冲突/源变化/清理重试。 |
| S4 | `acceptance-final/upgrade-blocked-final.txt` | 真实IDB blocked，注入下一schema=2、产品schema=1；关闭旧连接重试/原记录保留。 |
| S5 | `acceptance-final/backup-build8-functional.json`、`mixed-backup-final.json`、`files-final.json` | 新context完整恢复范围、格式/引用损坏拒绝；混装备份与Blob。 |
| S6 | `acceptance-final/files-final.json`；`acceptance-integration/check-file-lifecycle.js` | 9项Blob/引用/命令保护/并发/损坏备份/原子失败。 |
| R1 | `acceptance-final/core-final-7.log`、`retired-history-final.json`、`binding-strip-final.txt` | 类型与历史回归专项；不能代替未执行的毛织/特殊工艺页面。 |
| R2 | `acceptance-final/routes-build8.json` | HPB/等待交出/袋等8路由120通过样本。 |
| R3 | `acceptance-source-ui-final/perf-build9.json` | 来源9路由135通过样本；修复build8 PDA接单613.1ms后的结果。 |

## 92 条逐项绑定建议

“可绑定”仅指此条事实有合适证据，不自动改变 `已实现待验证` 状态。每条还须满足最终版本、全部适用入口和性能门禁。

| 编号 | 原子需求 | 建议证据 | 已有事实及仍需补充 |
|---|---|---|---|
| SCOPE-001 | 三方自行裁剪任务不进入本流程 | U1；D1 | 只有 inScope=false 逻辑契约；未找到真实三方“裁剪＋车缝＋烫包”任务入口排除证据，见补测 A。 |
| SCOPE-002 | 不开放独立换片布交出 | U1；D4 | cutPieceQty=0 逻辑阻断已测；真实只带换片布而没有裁片的确认入口未测。 |
| SCOPE-003 | 保持现有裁片缺口政策 | D3；U1 | 已有700/200片交出成功，但未独立对照原裁片缺口允许/阻断政策的两个状态。 |
| SCOPE-004 | 无权限角色不能确认仓管交出 | D2 | 实际Web/PDA不同角色确认禁用；可绑定，仍须关联当前构建影响说明。 |
| ORDER-001 | 有效分配到裁床即出现订单行 | D1 | 真实分配后3种面料初始3票、增票、改派离开后列表移出；5组通过。 |
| ORDER-002 | 同生产单只出现一条主列表行 | D1；L1 | 列表按单显示有现场旁证；缺同一生产单多个有效裁片任务仍恰好一行的显式断言。 |
| ORDER-003 | 每种合格面料仅生成一张初始票 | D1 | 真实分配后3种面料初始3票、增票、改派离开后列表移出；5组通过。 |
| ORDER-004 | 资料缺失保留待核对行 | U2 | 资料缺失解析有unit，未找到待核对行、不可打印提示的真实页面结果；见补测 A。 |
| ORDER-005 | 改派移出后原裁床待办消失 | D1 | 真实分配后3种面料初始3票、增票、改派离开后列表移出；5组通过。 |
| ORDER-006 | 改派后旧页面不能继续提交 | S1；D1 | 来源CAS/旧源变化阻断有核心证据，改派后历史失效有UI；两标签旧预览实际确认未测，见补测 B。 |
| ORDER-007 | 已交出历史不因改派被抹除 | U1；D8 | unit保留已交历史；D8只验证已交补打不改回执，没有实施改派，见补测 B。 |
| MAT-001 | 清单包含整单实际合格面料 | U2；D1 | 真实3种面料与初始票；SKU去重/名称含朴的精确条件由unit支持，UI夹具未显式断言朴被排除。 |
| MAT-002 | 任务需料由分配 SKU 推导 | U2；D3 | 按SKU不同需料的逻辑已测；两工厂实测共用一种面料，不能代替SKU1仅A、SKU2为A+B的差异需料入口，见补测 C。 |
| MAT-003 | 相同面料不因部位／尺码重复 | U2；D1 | 真实3种面料与初始票；SKU去重/名称含朴的精确条件由unit支持，UI夹具未显式断言朴被排除。 |
| MAT-004 | 同名不同身份材料不得互认 | U1；U2 | 同名不同编码/颜色保留不同身份为unit；未实际扫A票尝试满足同名B缺项，见补测 C。 |
| MAT-005 | 按物料名称识别排除朴 | U2；D1 | 真实3种面料与初始票；SKU去重/名称含朴的精确条件由unit支持，UI夹具未显式断言朴被排除。 |
| MAT-006 | 资料完整的空集合标为无需换片布 | U2 | 全朴且资料完整为空集合为unit；未见列表“无需换片布”及有裁片可交出的真实页面，见补测 A。 |
| TKT-001 | 每张固定 5 Yard 不可修改 | D1；P1；L1 | 真实新增固定5 Yard、无长度编辑入口与新增后数量有直接证据。 |
| TKT-002 | 无车缝分配时仍可按生产单出票 | D1 | 裁片任务分配后直接出票有旁证；建议显式记录该单无任何车缝有效分配，避免用隐含前置代替断言。 |
| TKT-003 | 同面料能新增多张独立票 | D1；P1；L1 | 真实新增固定5 Yard、无长度编辑入口与新增后数量有直接证据。 |
| TKT-004 | 同一新增请求重试不重复建票 | U1；S1；S2 | 同命令幂等/异内容拒绝和真实IDB回滚已测；逻辑/核心可绑定，新增按钮网络/事务重试UI仍须对应实际选择保留证据。 |
| TKT-005 | 换片布票号不与任何类型重复 | U1；P1；P4；D1 | 身份前缀、解析、递增及新增3号有直接/契约证据；改派回原厂同日不复用范围由reassignment unit补强。 |
| TKT-006 | 序号按生产单＋面料递增不重用 | U1；P1；P4；D1 | 身份前缀、解析、递增及新增3号有直接/契约证据；改派回原厂同日不复用范围由reassignment unit补强。 |
| TKT-007 | 补打保持原身份和数量 | P1；D8 | 部分首打/补打保持身份与票数，历史已交补打回执不变，有直接证据。 |
| TKT-008 | 已交出票补打不恢复交出资格 | D8；U1 | 补打不改receipt/票数已实际证明；补打后再次扫码交出的拒绝入口未执行，见补测 D。 |
| PAGE-001 | 菜单位于捆条菲票打印之后 | L1；D1 | 命名页面与菜单、单元格多面料直接DOM/截图旁证；建议矩阵链接具体截图而不是仅写E05。 |
| PAGE-002 | 面料单元格一行一种面料 | L1；D1 | 命名页面与菜单、单元格多面料直接DOM/截图旁证；建议矩阵链接具体截图而不是仅写E05。 |
| PAGE-003 | 查询同时刷新列表统计与条数 | L1 | 135样本覆盖查询、匹配导出、跨页选择；脚本与结果可直接绑定。 |
| PAGE-004 | 重置清空全部条件 | L1；L2 | 基础重置/列设置通过；扩展重置build8有831.6ms，父任务正在build9复验，当前不可将L2全表标性能通过。 |
| PAGE-005 | 导出全量匹配且无操作列 | L1 | 135样本覆盖查询、匹配导出、跨页选择；脚本与结果可直接绑定。 |
| PAGE-006 | 标准列表分页及列设置可用 | L1；L2 | 基础重置/列设置通过；扩展重置build8有831.6ms，父任务正在build9复验，当前不可将L2全表标性能通过。 |
| PAGE-007 | 打印汇总准确表达部分已打印 | P1 | 6票只确认1票且刷新部分打印有直接证据。 |
| PAGE-008 | 整单打印覆盖全部有效票 | P2 | 功能有整单预览断言；build8单个528.2ms未通过，父任务安排build9严格复验。 |
| PAGE-009 | 单票及跨页多票选择准确 | L1 | 135样本覆盖查询、匹配导出、跨页选择；脚本与结果可直接绑定。 |
| PAGE-010 | 缺项及失败给出可行动提示 | L1；D2；D4；S2 | 空结果、权限、缺票、保存失败等多个可见提示有证据；资料错误提示仍随ORDER004补测。 |
| PRINT-001 | 票面清楚识别单、料、第几张 | P3；P4；B1 | 标准/长字段/1001号标签，软件QR识别及实际扫码入袋；物理打印不在已有证据内。 |
| PRINT-002 | 黑白票面能区分三种菲票 | P3；P4；B1 | 标准/长字段/1001号标签，软件QR识别及实际扫码入袋；物理打印不在已有证据内。 |
| PRINT-003 | 扫码指向唯一换片布票 | P3；P4；B1 | 标准/长字段/1001号标签，软件QR识别及实际扫码入袋；物理打印不在已有证据内。 |
| PRINT-004 | 取消预览／未完成不误标已打印 | P1；P2 | 取消不标记、未调用打印不能确认、部分选择确认已测；P2性能仍须最新补测。 |
| PRINT-005 | 部分出纸仅确认成功票 | P1；P2 | 取消不标记、未调用打印不能确认、部分选择确认已测；P2性能仍须最新补测。 |
| BAG-001 | 换片布可扫码装入现有袋 | B1 | 真实新增HPB003→软件打印确认→PDA扫描→装袋→详情刷新，5组通过。 |
| BAG-002 | 同票重复扫描不增加数量 | U1；U3；B1 | 普通成功装袋不等于重复扫/跨有效袋/跨单阻断。未找到最终脚本实际三种反例，见补测 D。 |
| BAG-003 | 同票不能同时占用两只有效袋 | U1；U3；B1 | 普通成功装袋不等于重复扫/跨有效袋/跨单阻断。未找到最终脚本实际三种反例，见补测 D。 |
| BAG-004 | 三类混装不放开跨生产单 | U1；U3；B1 | 普通成功装袋不等于重复扫/跨有效袋/跨单阻断。未找到最终脚本实际三种反例，见补测 D。 |
| BAG-005 | 袋详情同时展示三类货物 | B1；B2；D5 | Web/PDA三类明细与按张/片/米/Yard分项有直接结果。 |
| BAG-006 | 混装数量按类型单位分别汇总 | B1；B2；D5 | Web/PDA三类明细与按张/片/米/Yard分项有直接结果。 |
| BAG-007 | 移出／重装保持票身份数量守恒 | B2 | 重装失败输入保留、成功后逐票ID/号/数量单位守恒与7→10事件有直接证据。 |
| BAG-008 | 换片布票不支持拆分长度 | U1；B2 | 5 Yard校验unit、重装保持5 Yard已测；无拆长度入口可通过UI静态核对说明不适用拆分动作。 |
| BAG-009 | 回收袋不恢复旧票交出资格 | B2；U1 | 回收/报废成功有UI；未在回收后重新扫描旧已交HPB并验证拒绝，见补测 D。 |
| BAG-010 | 货物标识和清单包含新增类型 | U3；B3 | 标签契约支持新增类型；袋清单/货物标识实际三类打印应链接相应结果，只有详情Tab不等价打印输出。 |
| BAG-011 | 历史打印读取原周期快照 | B3 | 历史周期Tab可达；未找到变更当前周期后打印原周期、核对原票快照的直接结果。D8是票补打，不是袋原周期打印。 |
| HAND-001 | 历史已交与本次随交共同满足需料 | D3；D4 | 700片+5 Yard、再200片+0换片布，2次交出仅1回执直接通过；“历史A+本次B”的混合并集还需补测 C。 |
| HAND-002 | 任一需料缺失阻断本次确认 | D3；D4；D5 | 缺票提示且未增交出记录；可绑定，简单交出完整5组Web/PDA最终性能仍待父任务修脚本复验。 |
| HAND-003 | 不同任务不能共用同一已交票 | D3；U1 | 另一任务另一工厂扫旧已交票被拒绝，再用独立第2票成功；同厂不同任务纯边界由unit支持。 |
| HAND-004 | 多袋同次检查并集且顺序无关 | U1；D5 | 多袋并集与顺序无关unit；D5业务函数在浏览器中提交，非真实逐袋UI。需袋前/裁片前两种真实选择顺序，见补测 E。 |
| HAND-005 | 未选入本次的袋不能满足缺项 | U1；D5 | 核心不选换片布袋阻断已测，但D5内部提交；缺真实待交出页面漏选对应袋反例，见补测 E。 |
| HAND-006 | 裁片与换片布同次成功或失败 | D4；D5；B2；S2 | 实际同次成功与原子故障已有核心/重装证据；纯简易交出confirm阶段IDB abort仍应直接绑定或补UI。 |
| HAND-007 | 重试确认不重复交出 | S1；S2；U1 | 核心命令幂等通过；简易交出连续点击/同确认重试不重复事件的真实入口直接断言未找到。 |
| HAND-008 | 简易交出支持不经袋直接随交 | D3；D4 | Web真实直接随交及PDA最新脚本有覆盖设计；当前build9-r2只完成首组Web，不能当10组全过。 |
| HAND-009 | 直接交出不取用已装袋票 | B1；U1 | 已装袋来源读取真实；未见简易交出扫码这张已装袋HPB并明确拒绝的实际结果，见补测 D。 |
| HAND-010 | 同任务后续批次不重复要求已交面料 | D3；D4 | 700片+5 Yard、再200片+0换片布，2次交出仅1回执直接通过；“历史A+本次B”的混合并集还需补测 C。 |
| HAND-011 | 新增需料只补新增缺项 | U1 | 仅evaluateCoverage新增C逻辑断言；未找到同任务已交A后实际新增SKU/B并只补B的入口，见补测 C。 |
| HAND-012 | 换工厂不继承旧工厂实收 | D3；U1 | 不同任务/不同工厂证据存在，但不是“同一任务改派工厂”；需保留任务ID只换厂后缺项，见补测 C。 |
| HAND-013 | 历史缺证据不自动伪造已交 | U1；D4 | 空回执缺票阻断已测；历史裁片已有交出但没有HPB证据的明确夹具与UI未见，见补测 C。 |
| HAND-014 | 回执能回查每票任务工厂人时 | D3；D4 | 直接回执含交出单/票、任务/工厂/人/时，工厂接收详情可直达；链接具体head/proof字段。 |
| FACT-001 | 打印装袋交出状态分别推导 | U1；P1；B1；D3 | 打印、装袋、已交分别有不同阶段事实证据，不能仅引用单张列表截图。 |
| FACT-002 | 换片布不污染裁片接收和齐套数量 | U2；D3；B2 | 20片+5Yard+8米不混计，以及700/200/720片回执等明确数量证据。 |
| FACT-003 | 保留原捆条毛织等类型行为 | U3；B2；R1 | 捆条混装与原专项通过；毛织真票/特殊工艺实际动作不是普通票绕过初始化能证明，矩阵须单列相应既有专项范围。 |
| FACT-004 | 未识别历史类型不猜测迁移 | S3；R1 | 旧裁片历史按类型保留、未知集合/错误格式拒绝；未知ticketKind不猜测三类的单独业务UI/迁移反例仍需核对专项。 |
| UX-001 | PDA 可完成扫描核对确认主流程 | B1；B2；D4 | PDA装袋/重装实际流程有5样本；简易交出最终Web/PDA全量结果尚缺。 |
| UX-002 | 每个款式面料具备对应真实图 | L1；P1；B3 | 可见图片加载/零损坏有技术证据；“对应真实图”的语义对应须主代理视觉核对，不能仅naturalWidth>0推定。 |
| UX-003 | 图片失败及大图关闭行为可用 | L2；P1 | 图片故障恢复、大图Esc关闭有结果；L2重置慢样本与图片功能分别判定。 |
| UX-004 | 保存失败保留选择且可幂等重试 | S2；B2；B4；D6 | 各真实保存失败输入保留/重试有证据；简易交出选择保留若尚无结果，不能由手工票/PDA铺布替代。 |
| UX-005 | 指定低分辨率无主体溢出 | L1；D5；B1；B2 | 列表1366/1280/1024与混装Web1366/PDA360或390实测；逐页面对应设备，不声称所有页面都测过全部尺寸。 |
| PERF-001 | 各路由加载场景逐样本小于 500ms | R2；R3；B1—B4；D6 | 有效通过样本分属build7/8/9；最终需hash/影响审查确定仍有效，不能把所有文件改称build9。 |
| PERF-002 | 全部适用交互逐样本小于 500ms | L1；L2；P1；P2；B1—B4；D6；D7 | 多数完成；L2/P2已知慢样本及简易交出5组缺口仍开放，父任务正在复验。 |
| STORE-001 | 业务按记录保存到 IndexedDB | S1；S2；S3；B4；D6；D7 | 按记录/普通读不落种子有核心与真实入口证据；仅登记范围，唛架未迁移库存/旧提前加工只读边界明确。 |
| STORE-002 | 普通读取不落盘种子或建票 | S1；S2；S3；B4；D6；D7 | 按记录/普通读不落种子有核心与真实入口证据；仅登记范围，唛架未迁移库存/旧提前加工只读边界明确。 |
| STORE-003 | 同动作事务完成后才显示成功 | S1；S2；D6；D7；B4 | 事务complete前不发布、CAS/失败不回退有直接浏览器IDB注入及实际UI结果。 |
| STORE-004 | 多标签版本冲突不静默覆盖 | S1；S2；D6；D7；B4 | 事务complete前不发布、CAS/失败不回退有直接浏览器IDB注入及实际UI结果。 |
| STORE-005 | 下游直达独立读持久记录 | S1；S2；D4；D8；D6 | 禁LS重开、票打印、直接交出及历史补打已测；唛架页仅禁迁移15键，不能引用它为全LS业务通过。 |
| STORE-006 | localStorage 失败不影响已迁移业务 | S1；S2；D4；D8；D6 | 禁LS重开、票打印、直接交出及历史补打已测；唛架页仅禁迁移15键，不能引用它为全LS业务通过。 |
| STORE-007 | IndexedDB 失败不回退旧业务存储 | S1；S2；D6；D7；B4 | 事务complete前不发布、CAS/失败不回退有直接浏览器IDB注入及实际UI结果。 |
| STORE-008 | 迁移中断恢复不重复不丢失 | S1；S2；S3 | 迁移中断/冲突/清理重试/共享键保留有明确最终结果。source-late-final需绑定r2.txt，不绑定含1失败的JSON。 |
| STORE-009 | 仅清理已读回验证的源项 | S1；S2；S3 | 迁移中断/冲突/清理重试/共享键保留有明确最终结果。source-late-final需绑定r2.txt，不绑定含1失败的JSON。 |
| STORE-010 | 共用旧键保留其他模块记录 | S1；S2；S3 | 迁移中断/冲突/清理重试/共享键保留有明确最终结果。source-late-final需绑定r2.txt，不绑定含1失败的JSON。 |
| STORE-011 | 旧连接升级冲突有可恢复提示 | S4 | 真实blocked由测试下一版本2触发，当前产品版本1；关闭旧连接重试且原记录保留。应保留这一模拟升级前提。 |
| STORE-012 | 完整备份可校验后恢复 | S5 | 新context恢复、损坏文件不影响原记录、Blob引用校验均有证据；只能称登记模块完整备份。 |
| STORE-013 | 附件保存原始 Blob 及引用 | S6；D7；L3 | 真实样衣/合同Blob与引用保护；清理可见确认/5样本以及并发新增引用阻断，按三个证据联合绑定。 |
| STORE-014 | 无引用清理不误删有效附件 | S6；D7；L3 | 真实样衣/合同Blob与引用保护；清理可见确认/5样本以及并发新增引用阻断，按三个证据联合绑定。 |
| DATA-001 | Mock 覆盖多角色多任务正常边界 | D1；D3；B2；各fixture-provenance/README | 已覆盖正常/错误/角色/数量等，但本表列出的原子边界仍缺真实UI；不能以fixture数量替代覆盖。 |
| VERIFY-001 | 每条需求有当前实现与证据对应 | 本审计；矩阵原文；source-build7/8与manifest-build9 | 本表只登记证据与空缺，不改变矩阵状态，不作产品接受或发布确认。 |

## 最小补测方案（只提出方案，未执行）

### A. 一组资料边界夹具，覆盖 ORDER-004、MAT-004/005/006、SCOPE-001/002 与部分 TKT-002

复用 `acceptance-source-ui-final/ui-fixture.ts` / `source-ui-fixture.higcut` 的显式Mock前置和 `check-actions-final.js` 的分配入口，新增独立生产单，而不是把打印/交出结果预写进去。准备：①缺颜色映射或物料名称；②资料完整但全部物料名含朴；③同名但不同SKU编码/颜色的A/B；④明确三方自行裁剪合并任务。实际进入HPB列表逐单查询，断言缺资料单仍一行待核对且不可打印、全朴单“无需换片布”且0票、自裁任务不进入流程、同名不同身份显示两个对象。保存前置时必须满足生产快照合法性；不要仅删除技术包让导入校验先失败，也不要把资料错误当空集合。全朴有正裁片时允许同次确认；只有HPB没有裁片则阻断。每个确实出现的动作独立取5性能样本。

### B. 两标签并发与已交后改派，覆盖 ORDER-002/006/007、TKT-006/008

延用 `check-actions-final.js` 实际分配/改派逻辑，同一context开两页。A保持旧HPB详情或打印预览，B实际改派离开；A直接确认旧票必须可见拒绝，票/打印/receipt记录不变。另在D3已完成交出状态先导出备份，实际改派后再次进入历史票及原回执，比较票号、面料、工厂、人时快照完全相同；该票补打后再尝试扫码交出仍拒绝。改派回原厂且回填同日，新增票序号不得重用。ORDER002增加同生产单两裁片任务有效分配并断言主列表一行，避免只测一任务。

### C. 同任务SKU与工厂变化，覆盖 MAT-002/004、HAND-001/011/012/013

复用 `check-two-factories.js` 的实际任务读取/扫码/确认流程及 `acceptance-final/simple-prerequisite.higcut` 的备份导入入口，但必须保持“同一taskId”来证明HAND012。初始SKU1需A，第一批实际交A；随后采用现有真实任务SKU调整入口增加SKU2需B（若无用户可达入口，明确记录为导入合法资料变化前置，不称UI修改），重新读取后缺项仅B，历史A保留，扫B同次交裁片成功。B名称可与A相同但编码不同，先扫A必须不能抵扣B。再将同一任务实际改派新厂，旧厂A/B receipts均不满足新厂需料。另准备历史已有裁片交出、无任何HPB receipt的明确旧资料，确认不能自动补造“已交”。D3不同任务不同厂只作为相邻回归，不能替代这一同任务反例。

### D. 扫码占用与旧票恢复反例，覆盖 BAG-002/003/004/009、HAND-009、TKT-008

复用 `acceptance-bag-lifecycle/hpb-scan-five-samples.js` 与 `lifecycle-five-samples.js`。同一HPB连续扫两次，确认明细/持久绑定仍1张；再扫另一有效袋拒绝，跨生产单拒绝。已装袋HPB到简易交出扫码必须拒绝；已交HPB所在袋回收后、历史补打后分别再扫码，不能恢复可交资格。每次失败直接比较全记录、票ID/数量及当前输入，不能只检查toast。已有B2回收成功不是旧票恢复反例。

### E. 真正多袋选择与提交原子性，覆盖 HAND-004/005/006/007 与 UX-004

复用 `acceptance-final/mixed.higcut` 前置、`check-mixed-backup.js` 的两袋业务对象。将内部 `submitWaitHandoverTaskBatch` 改为实际待交出页面选袋/扫码并确认的测试动作：只选裁片袋时缺HPB；同时选两袋时通过；新context逆序选袋结果相同。另留有未选HPB袋，不能被自动借用。对实际confirm写入注入abort，确认所有裁片/HPB/事件记录不变且选择保留；同输入重试仅一套交出，重复点击不会多建。没有真实可达多袋入口时应如实登记产品入口缺口，不能挂内部函数结果冒充UI。

### F. 袋原周期打印与类型回归，覆盖 BAG-010/011、FACT-003/004

复用B3详情历史周期。保存当前含三类票的周期快照，回收进入新周期并装入不同票，再从历史周期实际打印，输出应仍为原周期票/单位。先核对当前真正可达的打印入口：旧`print-manifest`仅在无调用者历史渲染函数中，不可注入假按钮。若产品现有需求要求但无入口，标产品待实现/需修复；不能把D8的单张HPB历史补打当袋历史清单。毛织与特殊工艺应绑定原专项及实际有真票的最小流程，普通票跳过无关初始化不证明真票场景；未知ticketKind应明确拒绝/原样保留而非归为裁片。

## 应直接更新的矩阵旧文案

1. 部位票来源清单已是8键；“6旧键”遗漏 `cuttingTransferBagLedger`、`cuttingMarkerPlanLedger`。
2. STORE006“全禁LS未通过”不再能概括全部现状：已迁移核心、HPB打印/交出与历史补打存在通过证据；唛架完整库存仍有明确未迁移边界，分条写。
3. STORE011“blocked缺失”已有S4直接证据，应记录注入下一版本的准确方式。
4. 部位assembly旧字符串误报已修正为真实输出契约并通过；不应继续当未关闭的同一基线问题。
5. PERF不能沿用首轮120或185样本作为全量最终口径；按上表各版本各负责路径绑定，并保留L2/P2及简易交出尚在复验的缺口。
6. 产品确认人、确认版本、最终远端SHA和物理纸张/扫描尚不能由本审计代签。软件QR识别通过应与实物验收分开。

本次逐项审计覆盖92/92个编号，未增加或删除原子需求；没有修改原矩阵状态。

补记：主代理通知 build10 仅修正 `simple-cut-piece-handover-ui.ts` 的换片布输入框跳过全页重绘属性；此前Web5组已通过，PDA最终结果尚待生成。此事实来自主代理现场通知，本审计未自行运行验证，也不把“已修复”写成“已验收”。
