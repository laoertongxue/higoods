# 后道逐项与多次下游验收覆盖及证据

本文件由独立测试旁路整理，只把72个原子结果、A01–A30和实际测试/已有证据对齐。它不修改原子矩阵状态，不替代主代理完整差异审查，不把已写断言当成已运行结果。本轮24个唯一功能用例已按下表分批执行通过；入口失败修复后的受影响分支另行校准，正常分支按明确日志复用。性能、原full/cross收据及最终矩阵状态由主代理结合各自实际证据确认。

本地核读HEAD为 `4a0ce9ef5a30e8dec4537de1ff59159543902a25`；实现为未提交工作树，HEAD不等于运行资产。没有连接测试站数据库，没有实体扫码枪、实体PDA或实体打印机/纸张验收。D1/D5临时计划为隔离来源输入，均经公开回货→确认→送检→QC，不灌内部下游状态；迁移测试明确使用隔离旧格式夹具。

## 最终功能组合（第32节）及打印采集校正（第33节）

当前最终源码清单SHA47dfd8b4e0420435572ba3eae427da2d003b729e3f5b50188bf1372d0368536a，71源码/验证文件；1222dist，index c36aad4a374b8509c1dec6d4a2e01551d4fce3b89c4c64186b7bec4a628400c1。原full22＋cross1（15条全链）为23个唯一用例，新增partial6＋consumer3＋migration7＋role8＋main I1–I4为28个，合计51；三批6/22/23连续实际全部通过，0失败/0跳过/0重试。原始JSON日志、D1持久JSON、源码版本绑定、真实页面截图及cross15链均在`final-current-browser/`，汇总为`summary.json`。本轮不继承旧功能时间或把重复运行计成更多唯一测试。

最新B6开发D1单SKU的五完整保存82.0–90.6ms、五完整可见详情刷新611.5–633.2ms，全部有原生逐条一致读回、图片字体和最终可见性，两帧后冻结。只证明开发预热D1，不代替D10生产预览。最终构建1335/1335（本任务六文件38唯一unit），main范围类型0；全量保留19范围外旧错误。第32节修复前的21通过/1失败及第30/31节其他真实失败均保留，不能追改为本版本通过。

第33节只修验收采集器的媒体恢复与CSS纸张优先，最终源码清单为42371a41432433e33860a71a8401b5c3bcf7ec0782aa1337d7ccd041e9dd80ac；其余70源/验证文件及1222dist均与第32节相同，51功能保留47df原身份。核心原470非PDF与新50实际PDF均已通过；旧50屏幕PDF剔除，最终按final-performance-acceptance.json逐家族清点。相邻25与extra3最终四页PDF已通过；适用治理已实际通过，技术收据仍待冻结后执行。当前17代表PDF/1245页新鲜质量记录在final-print-quality，未继承旧视觉。以下索引与分阶段记录保留各原版本身份；其“本轮24”“旧最终”等不是本最终51的计数或版本。UP1–UP9原九契约另加普通QC不读未变辅料/受管旧入口拒写两例，当前progress文件11；UR7；身份8；席位5；SC只读1；摘要6，合计38。

## 证据和场景索引

| 别名 | 实际位置/场景 | 已发生结果及边界 |
| --- | --- | --- |
| UP1–UP9 | `tests/unit/post-finishing-process-progress.test.ts` 九例，按文件顺序：15组合；D1；两项/单项；逐SKU；非法量；D5多人；旧写拒绝；订正；角色反例 | 最新与UR合计16/16通过，日志 `partial-flow-e2e/post-finishing-unit-gap-closure.log`。UP6已从旧20+30改冻结200+300。Node内存契约不证明IndexedDB/页面。 |
| UR1–UR6；UR7 | `tests/unit/post-finishing-multiple-recheck.test.ts` 原六例为直达/零量、D1、占用/扫码、差异授权、补占用、部分0；UR7指新增A29例（实际插在D1之后） | 最新16/16通过；UR4/UR5使用应交100的0/99/101及过期/无效授权、有无剩余。日志同上。 |
| B1–B6 | `tests/post-finishing-partial-flow.spec.ts`：QC/列表/键盘；D1实际Web/PDA；配额；中止；两标签竞争；五次开发保存/五次热刷新 | 最新六例全部通过（27.1秒），日志 `retained-checks/final-functional-browsers/post-finishing-final-partial.log`。含空白输入保留、Tab/ShiftTab、图片Enter/还焦点、真实Web代登/主管订正空原因重试、精确900截图、D1三次闭环及保存故障。B6仅开发D1采样。 |
| M1–M7 | `tests/post-finishing-migration.spec.ts`：H400承接；schema2标记；H600/N400；备份无损及UI重试；schema1中断Blob/共用；Web双标签升级/重新读取；PDA同路径升级/恢复 | 现为M1–M7共七个唯一例，M6为Web双标签升级，M7为同夹具PDA实际execute入口。全部实际通过，分别绑定本页末尾分批日志；M4错误夹具、M6原产品失败和PDA错误路由夹具均保留，不把重复校准增加计数。 |
| C1/C2/C3 | `tests/post-finishing-consumers.spec.ts`：第N子单/两入口打印/实际统计卡；直接读/视口/图片；伪造恢复拒绝 | 最新三例全部通过，日志 `retained-checks/final-functional-browsers/post-finishing-final-consumer-migration-role.log` 的首三例；含800真实DOM标签、父卡0/0/1000、分页PDF导出、统计七卡与恢复身份六变体。电子PDF实际生成不代替主代理逐页视觉审查；实体打印未验。 |
| S1–S8 | package中的current-read-model、full-flow、outbound-and-online-print、full-flow-surface、web-pda-fallback、return-source-generalization、sewing-self-return、qc-colors | 八项真实通过，原前后16份日志及旧→新映射保留；主代理最新复验八项及统计第九专项均exit0，见 `retained-checks/final-*`。 |
| E1–E7/E8/E旧… | 原full-flow首轮7个有效场景及PDA校准；原full/cross/role套件保留的回货/QC/辅料/授权/扫码/打印检查 | 原7有效通过及单例校准保留其版本身份；原full/cross整套最终由receipt强制执行。本轮PDA角色八例另计R1–R8，不能以局部或角色通过关闭full/cross。 |
| R1–R8 | `tests/post-finishing-pda-role-boundary.spec.ts`八例：执行职责、交接回货、回货SKU、辅料整单、001覆盖、已交出SKU、返回工作台、自助回货管理 | 本轮八例全部通过（29.5秒），见 `retained-checks/final-functional-browsers/post-finishing-final-pda-role-boundary.log`。保留390/400/480小屏及无横溢出、材料IDB单记录覆盖等有效检查。 |
| ST | `standalone/post-flow-v9-boundary-verification.json`、`post-flow-v9-recheck-verification.json`及同目录截图 | 已发生两项/单项/直达/零量、空白、超量、失败保留、错码/重贴、退领占用/差异授权观察，errors为空。只证明独立页面内存演示。 |
| PERF | `performance/report.json`、`performance/history/`及独立准备资料 | 本期生产性能由性能旁路单独给出实际家族/样本/日志，本文不预判通过。当前会话用户仅对冻结D10完整备份恢复（27548条、约36MB）允许≤10000ms；其余动作/加载/导出/迁移仍≤1000ms，原子/失败/完整回读不放宽。B6开发采样不替代本项。 |

## 72个原子结果的候选对应

每行均受上表版本限制。本轮B1–B6、C1–C3、M1–M7、R1–R8共24个唯一功能例已通过；unit和专项脚本另见实际日志。含原full/cross的覆盖仍由最终receipt补全，PDF视觉与性能按各自证据核对；不据此自动修改矩阵状态。

| 编号 | 原子结果 | 实际场景/证据候选 | 限制与待最终核验 |
| --- | --- | --- | --- |
| PFN-001 | QC实际项目为开扣眼、装扣子、熨烫、包装四项独立选择 | UP1；B1；S2/S8 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-002 | 实际加工链按固定相对顺序过滤未选项 | UP1/UP3；B1；ST | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-003 | 仅车缝等来源责任不覆盖QC实际选择 | UP1；S2；E2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-004 | QC提交后的加工链对已有执行事实固定 | UP7 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-005 | 合格大于0且无项目时保留QC直达出货 | UR1；S2；ST | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-006 | 合格量为0不生成空下游业务单 | UR1；S8；ST | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-007 | 新增记录保持原加工单与回货/QC来源身份 | UR2；B2；C1 | UR2逐个核对父加工单/来源回货ID；本轮B2重生D1最终持久JSON，C1再消费该版本并核对第N子单来源。 |
| PFN-008 | 不出现新加工批次号、工序单据或拆并批操作 | S4/S5；B1/B2；E8 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-009 | 加工输入表示本次完成增量而非覆盖累计 | UP2/UP6；B2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-010 | 同项可多次登记且前次事实保留 | UP6；B2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-011 | 数量约束逐SKU，不跨尺码/颜色抵扣 | UP4；S5；ST | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-012 | 首项本次量不大于Q减首项累计 | UP4 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-013 | 后项本次量不大于前一适用项累计减本项累计 | UP3/UP4 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-014 | 数量输入和SKU结构非法时阻断本次保存 | UP5；B1新增空白；ST | UP5已验空数组/全0/小数/负数/NaN/无限/重复和未知SKU/未选项/局部0；本轮B1主应用空白拒绝且保留输入通过。 |
| PFN-015 | 正常后道余量保留为待加工，不强制异常结案 | UP2；B2；E8 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-016 | 全部后道完成供给取最后适用项，单项链也可交复检 | UP2/UP3 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-017 | 每条正式加工记录保留本次责任人 | UP6/UP9；B2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-018 | 同项不同责任人数量不归给最后一人 | UP6；B2 | D5已改为精确200+300=500且unit通过；不能再以旧20+30日志冒充冻结数据。 |
| PFN-019 | 录入人及时间与加工责任另行保留 | UP6；B2持久回读 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-020 | 整单开始人不锁死其他加工项的合法登记 | UP6/UP9；S5；B2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-021 | 加工项状态依据该项完成量独立表达 | UP2；B2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-022 | 整加工单仅在全部需处理量完成后标后道完成 | UP2；UR2/UR7；B2新增900 | UR7及本轮B2均验证精确100实收/1000加工/900可交；B2加工页和父回货弹窗分别截图，后续仍按100/800交复检。 |
| PFN-023 | 加工单列表直接可见每个加工项数量 | B1/B2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-024 | 已选0与未选不涉及明确区分 | B1 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-025 | 加工单列表维持一加工单一行 | B1/B2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-026 | 筛选后的列表/统计/总数范围一致 | B1；C2；性能列表家族候选 | B1单行查询/空结果/重置与总数已通过；多页真实翻页及统计范围须结合性能旁路实际D10列表家族，不以单行冒充分页。 |
| PFN-027 | Web提供按加工项与SKU的本次数量登记 | B1/B2/B3/B4 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-028 | 交复检是对可用完成量的独立显式动作 | UR2；B2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-029 | 复检创建成功即按SKU占用本次数量 | UR2/UR5；B2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-030 | 全部有效复检状态均约束再次交复检量 | UR3；B2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-031 | 释放复检领取不释放其数量占用 | UR2/UR3；S5 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-032 | 同一交复检提交意图重试不多建记录 | UR2；B3/B4 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-033 | 不同真实复检及其出货的ID互不碰撞 | UR2；B2；C1 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-034 | 新子单序号不被旧编号归一或迁移重写 | UR2；M1/M5；C1 | M1保留旧-FJ；新三位序号在UR2与B2回读核对，存量不重写。 |
| PFN-035 | 每次复检保留实际独立创建信息 | UR2 | UR2实际createdAt三值及createdBy均断言，非QC时间代替。 |
| PFN-036 | 每张复检按既有条码规则独立核对和重贴复扫 | UR3；B2；E旧复检；ST | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-037 | 差异授权失败不正式提交本次复检数量与出货 | UR4新增过期；S2；E旧授权 | UR4最新补实际应交100/实交99的过期授权原子拒绝并unit通过；S2另有授权服务30秒窗口和复用限制。 |
| PFN-038 | 复检差异的补占用/余量去向遵循冻结口径 | UR4/UR5/UR6；S2；ST | UR4/UR5已用应交100的实际0/99/101，有剩余/无剩余和过期授权；UR6多SKU部分0，仅正数入出货/库存。 |
| PFN-039 | 一加工单可保留多张独立出货单 | UR2；B2；C1 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-040 | 每张有效完成复检只生成对应的一张出货单 | UR2/UR4/UR6；B2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-041 | 各出货单由成衣仓角色独立实收 | UR2；B2；E角色 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-042 | 同一出货单重复收货不重复增加实收或库存 | UR2；S2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-043 | 父回货/总览不能因任一出货实收而全部完成 | UR2/UR7；B2新增900 | 本轮B2已取得精确100已仓收、加工1000、可交900及父未闭环两张截图；旧800截图保留为另一时点，不改标900。 |
| PFN-044 | 待交出库存包含全部有效子单且不重复 | UR2/UR6；S2；C2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-045 | 同库位多次来源记录不相互覆盖 | UR2；S2；C2 | C2已实际核对同一SKU/库位三次100/100/800出货和三仓储来源ID、1000/0/1000及抽屉各来源可用/已交出；原日志保留在retained-checks/final-c2-locations，最终当前组合另产结果。 |
| PFN-046 | 指定第N子单的详情/追溯准确显示该单 | UR2；C1 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-047 | 操作历史关联真实项目/本次数量/子单 | UP6；S5；B2；C1 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-048 | 统计分清分项工作量、成衣量和单据张数 | S1/S2；C1；B2 | 本轮C1核对D1唯一父单与三个真实出货ID，并实际统计页验证F/复核/已生成/仓收均1000、待接收0、实收完成3/待收0；平台D1结果另见main-integration-review/platform-d1-integrated及第16–18节F/V等价链；最终组合按当前源重放。 |
| PFN-049 | 既有父单流转卡显示分项与多次后续记录 | C1；E旧打印；电子PDF | 本轮C1父卡分项和全部多次后续记录断言通过，分页等待夹具已纠正且PDF全部重出；逐页电子视觉由主代理另绑定。 |
| PFN-050 | 出货打印/条码/吊牌按具体出货SKU和数量一致 | UR6；S3；C1；电子PDF | 本轮C1真实800 DOM标签、100份条码边界和分页PDF导出已通过；电子视觉由主代理另绑定，实体打印未验。 |
| PFN-051 | PDA可按同一事实分项登记并多次交复检 | B2；E8；ST | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-052 | 旧新单整单归类入口和通用完成旁路不再可写 | UP7；S4/S5；E旧深链接 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-053 | 共同成功的完成/占用/子单/日志同事务保存 | B3/B4；E旧出货故障；M5 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-054 | 保存失败保留原数据及可恢复输入，不假成功 | B3/B4；M4新增UI重试；E旧QC故障 | 本轮B3/B4无假成功、原量不变及可恢复输入重试通过；M4实际同一file input错误格式后合法恢复、原input断开、错误清除和目标行出现均通过。 |
| PFN-055 | 多标签竞争经版本和余量检查不重复占用 | B5；E旧QC冲突 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-056 | 普通读取不迁移/写种子或全模块业务快照 | E旧QC首次不落种；M2/M6/M7；S1 | M2显式标记不伪造记录；M6/Web与M7/PDA真实升级恢复后各自读回后道命名空间0，不复制静态种子。 |
| PFN-057 | 列表/详情/下游直达独立读取持久事实 | B2/B6；C2 | 实际结果以索引及本轮分批日志为准；相关B/C/M/R正常或受影响分支已复验，原full/cross最终receipt及主代理版本确认仍独立保留。 |
| PFN-058 | 历史合并完成结果不伪造为四项实际登记 | M1/M3；电子PDF历史字段候选 | 本轮M1 H400/N600/Ci200/100及M3 H600/N400均通过；承接不产生虚构四项完成record。 |
| PFN-059 | 旧在制未知分项经受控核对才承接新写 | M1；M3 | 本轮M1实际Web主管承接及M3 H600场景通过；未知历史显示历史未分项，未伪造责任/录入人或完成记录。 |
| PFN-060 | 旧未处理余量不丢失、不自动结案或再释放已占用量 | M1/M3/M5 | H与N/旧占用边界由M1/M3核；主代理按方案第10节及实际F/R复核：当前后道记录未定义正式有效处置E，旧未处理原因不等于E，本期承接E=0。未知外来字段经M5归档保留；不虚构一个正式处置样例，也不以未处理说明自动核销。 |
| PFN-061 | 显式迁移可中断续跑且先停旧写再切换 | M2/M5/M6/M7 | 本轮M5中断/续跑/旧写阻断通过；M6/Web和M7/PDA两真实标签blocked/versionchange、原因提示、关闭旧连接后实际重新读取及v2/common7/no seed全部通过。 |
| PFN-062 | 迁移保留共用PPIC及附件引用不误删 | M5；S2/S6/S7 | 本轮M5实际验证pcs-common数量7、Blob去重/字节、旧源清理及完整恢复；S2/S7保留正式回货/PPIC相邻依据，full/cross最终由receipt。 |
| PFN-063 | 备份恢复覆盖新记录且错误恢复不损原数据 | M4/M5；C3 | 本轮M4无损错误恢复和UI失败后重试、C3原四变体加责任/录入人各空名/空白名/QC角色六变体均通过；M5归档Blob完整恢复通过。 |
| PFN-064 | Mock含正常、选择链、多次及主要失败分支 | ST；B1/B2；S2 | ST仅独立页面内存样例，不能代替主应用事务或持久化证据。 |
| PFN-065 | 命名管理/Web/PDA视口可完成新增主要任务 | B1/B2；C2；R1–R8；M7 | 本轮B1/B2/C2/R1–R8覆盖1366/1280/1024及PDA390/400/480模拟视口；M7真实失败恢复也按390×844。无实体PDA型号或现场用户试用证据。 |
| PFN-066 | 实物识别图片保持对应及适用预览/失败恢复 | B1/B2；C2；E旧图片；电子PDF | 本轮C2图片对应/比例/失败重试/关闭/遮罩/Esc与B1键盘Enter关闭/还焦点已通过；电子PDF视觉须由主代理绑定。 |
| PFN-067 | 适用完整响应≤1000ms；冻结D10完整备份恢复单一例外≤10000ms | B6仅开发样本；PERF最终家族 | B6本轮开发D1五保存/五热刷新通过；正式生产性能独立取证。仅冻结D10完整备份恢复27548条/约36MB≤10000ms，其余≤1000ms，不以平均或旧快样本遮超时。 |
| PFN-068 | 上游回货/QC、辅料整单、PPIC正式依据与有效权限保持 | S1–S8；UP9；E1–E7；E角色 | 本轮角色八例R1–R8通过；专项S1–S8及UP9通过，原full/cross最终由receipt执行，保留原回货/QC/辅料/PPIC职责检查。 |
| PFN-069 | 实现保持本地轻量原型及既有页面体系边界 | 最终完整diff/范围治理（主代理） | 需要最终完整任务diff/依赖/事实源与越界审查；脚本通过不能代替语义判断。 |
| PFN-070 | 最终逐条绑定实际实现与有效证据，不预填通过 | 本候选映射；最终矩阵与收据（主代理） | 本文只做候选覆盖，不改矩阵状态，不宣告72条已验证；最终确认人和版本由主代理核实。 |
| PFN-071 | 正式误录按冻结范围订正且不破坏下游约束 | UP8/UP9；B1实际Web主管订正/空原因重试 | UP8保护后序/占用及signed订正通过；本轮B1实际代登2后主管订正1，空原因失败保留后重试成功，核对原记录/责任及signed差量。 |
| PFN-072 | 代登记权限及责任人来源遵循冻结范围 | UP6/UP9；B2；B1实际Web责任选择代登记 | UP6/UP9和本轮B1/B2均通过：实际责任选择代登分别保留responsible/recordedBy，Web与PDA实际录入身份不被最后操作人覆盖。 |

## A01–A30用例对应

| 用例 | 实际自动化场景 | 真实覆盖与待补边界 |
| --- | --- | --- |
| A01 | UP1；B1；S2/S8 | UP1和本轮B1均通过；15种非空组合、3来源轮换与实际QC四项勾选有各自证据。 |
| A02 | UP3；B1；ST | UP3与B1通过；ST只证明两项/熨烫单项内存演示，主应用供给公式由unit验证。 |
| A03 | UR1；S2/S8；ST | UR1及S2已通过；无项目100直达、合格0不建下游；原浏览器full/cross最终receipt。 |
| A04 | UP2；B2 | 本轮B2严格1000来源，最初500/300/200/100及F100、最终100/100/800闭环全部通过。 |
| A05 | UP4；S5 | UP4逐SKU前后序/跨SKU拒绝且无新增记录已通过。 |
| A06 | UP5；B1新增；ST | UP5非法边界通过；本轮B1实际空白保存阻断、原输入保留并重试通过。 |
| A07 | UP6；B2 | UP6精确200+300=500、两个责任/录入人、同意图去重通过；本轮B1/B2实际Web代登与PDA历史通过。 |
| A08 | UR2/UR3；B2 | UR2/UR3及本轮B2创建占用、待领取/退领/错码不释放已通过。 |
| A09 | UR2；B2；C1 | 本轮B2严格100/100/800三序次并重生持久JSON，C1逐个下游来源/身份读取通过。 |
| A10 | UR3；B2；E旧复检 | 本轮B2第2张PDA错码→重贴未复扫阻断→正确复扫与Web首/三张均通过。 |
| A11 | UR2；S2 | UR2/S2同复检完成重试仅一出货/一待交出事实通过。 |
| A12 | UR2；B2；S2 | 本轮B2第一100实收不代收第二、第三先收不提前父完成通过；UR2重复同单幂等/错误角色拒收通过。 |
| A13 | UR2；B2 | 本轮B2最终四项1000/三次仓收1000/占用1000/可交0通过，C1七统计卡再次核对。 |
| A14 | UR4/UR5/UR6；S2 | 最新16unit通过：应交100、实际0/99/100/101、过期/无效授权、有无余量与部分SKU0。B3/B4失败输入及旧复检故障保留；full/cross最终receipt。 |
| A15 | UR2；C1 | 本轮C1完整通过第2复检/第3出货详情、搜索、兄弟追溯及保持所选身份，全部PDF重出。 |
| A16 | UR2/UR6；S2；C2 | UR2/UR6/S2及本轮C2直接消费者通过；同库位聚合/流水由S2/消费者实际结果绑定。 |
| A17 | B1；D10列表场景候选 | 本轮B1四列0/不涉及、空结果/重置/总数通过；多页真实翻页须引用性能旁路实际D10家族。 |
| A18 | B2/B5/B6；C2 | 本轮B2/B5/B6及C2通过刷新、独立新上下文、下游直达、Web/PDA交替和持久读回。 |
| A19 | B3/B4/B5；M6/M7；E旧QC/出货；PCS共享测试 | 本轮B3/B4/B5配额/Abort/revision与输入保留通过；M6/M7入口真实blocked失败及恢复同样通过，不以共享engine测试替代后道UI。 |
| A20 | M2/M5/M6/M7 | 本轮M2/M5/M6/M7全通过：schema2显式升级、schema1中断/续跑/旧写阻断、双标签blocked/versionchange、Web/PDA真实恢复。 |
| A21 | M1/M3/M5 | 本轮M1/M3/M5通过历史H/新N、未分项、归档；主代理按方案第10节确认当前无正式E事实，本期按E=0承接，未知字段保留归档。正式处置条件无当前对象可运行，不制造假样例，原余量及占用验收仍适用。 |
| A22 | M4/M5；C3 | 本轮M4/M5/C3全部通过，含同file input错误→合法恢复、Blob完整回读及责任/录入人六种姓名/角色异常拒绝。 |
| A23 | S3；C1；电子PDF核读 | S3及本轮C1模型/DOM/PDF导出通过；分页已重出。逐页电子视觉由主代理绑定；无实体打印机证据。 |
| A24 | S1/S2；C1；B2；R6 | 本轮C1实际七卡及D1唯一来源核对通过；R6实际PDA已交出入口通过；平台由主代理最终集成绑定。 |
| A25 | S1–S8；E1–E7；R1–R8 | S1–S8、UP9及本轮R1–R8有效覆盖通过；原full/cross保留检查由最终receipt执行。 |
| A26 | B1/B2；C2；R1–R8；E图片 | 本轮B1/B2/C2/R1–R8视口、图片、键盘Tab/ShiftTab保留输入、Enter打开/关闭/还焦点均通过；没有新增图片modal Tab陷阱要求。 |
| A27 | UP7；S4/S5；E旧深链接 | UP7/S4/S5旧setter拒写及整单旁路退出已通过；旧深链接由原full/cross最终receipt。 |
| A28 | ST；B1–B5 | ST内存正常/失败/两项/单项/直达/零量/差异样例已有独立JSON，主应用事实另由本轮B/M证明。 |
| A29 | UR7；B2新增精确900 | UR7与本轮B2精确100已仓收/1000加工/余900通过；两张真实加工页/父回货状态截图已落盘，之后仍按100/800交复检。 |
| A30 | M1/M3 | 本轮M1 H400/N600/C装扣子200/包装100→F500/可交100和M3 H600/N400→F1000/可再交400/无虚构完成record均通过。 |

## 本轮功能复验的实际运行绑定

共24个唯一例：partial6、consumer3、migration7（M6/Web＋M7/PDA分别独立上下文）、role8。M4校准和M6重复运行不额外计数。全部浏览器已关闭，窗口已通知主代理释放。源版本为本任务未提交工作树；日志SHA256及main/后道失败提示/四个测试文件SHA256见 `retained-checks/final-functional-browsers/run-manifest.json`。

| 实际批次日志（均位于retained-checks/final-functional-browsers/） | 有效通过的唯一例 | 原失败与复用边界 |
| --- | --- | --- |
| `post-finishing-final-partial.log` | B1–B6，6 passed（27.1秒） | 在本轮入口异常修复前冻结源上通过；该异常修复未改变正常分项/后续事实，按主代理确认复用正常分支。B2先重生本版本D1持久JSON。 |
| `post-finishing-final-consumer-migration-role.log` | C1–C3、M1–M3，共6 passed | 该批随后M4因测试把备份input错误放在work-orders而失败，10未跑；保留日志，不称整批通过。 |
| `post-finishing-final-migration-backup-ui-calibration.log` | M4，1 passed（3.3秒） | 夹具改为实际audit-records备份input，错误→合法同input重试/重绘/持久数量断言全部保留。 |
| `post-finishing-final-migration-role-remaining.log` | M5，1 passed | 该批M6发现产品启动阻塞只给通用失败页，8角色未跑；保留产品失败原trace和诊断，修复后M6另单跑。 |
| `post-finishing-final-blocked-upgrade-web-calibration.log` | M6/Web，1 passed（2.4秒） | 新后道限定入口恢复页，适配实际data-pcs-storage-retry，原数量/升级断言不降低。 |
| `post-finishing-final-blocked-upgrade-pda-calibration.log` | M7/PDA，1 passed（2.6秒） | 实际execute路由、真实登录态、同样v1→v2/公共7/no post seed/pageErrors[]。首次/post错误路由夹具失败另留，不计产品失败。 |
| `post-finishing-final-pda-role-boundary.log` | R1–R8，8 passed（29.5秒） | 在修复后的源上完整运行八例；原职责、回货、SKU/图片、辅料整单与001覆盖、自助回货管理均保留。 |

产品原失败的真实传播、事件探针与最终frame提取在 `retained-checks/blocked-upgrade-diagnosis/README.md`；原产品trace在 `retained-checks/two-tab-blocked-upgrade-failure/`；PDA错误路由夹具原证据在 `retained-checks/two-tab-pda-wrong-route-fixture-failure/`。M4错误备份页面的失败仍在原批次日志，并已单根因纠正及实际UI校准。

四套今后完整复跑仍须先partial六例，再启动consumer/迁移/角色；不能一次四文件按字母加载后读取旧D1快照。以下是可复现顺序，不冒充本轮实际整批零失败命令：

```bash
PLAYWRIGHT_REUSE_EXISTING_SERVER=true CUTTING_E2E_PORT=43197 npx playwright test tests/post-finishing-partial-flow.spec.ts --workers=1 --reporter=line
PLAYWRIGHT_REUSE_EXISTING_SERVER=true CUTTING_E2E_PORT=43197 npx playwright test tests/post-finishing-consumers.spec.ts tests/post-finishing-migration.spec.ts tests/post-finishing-pda-role-boundary.spec.ts --workers=1 --reporter=line
```

待主代理最终关闭的独立项为：原full/cross收据、PDF逐页视觉与任务实际打印边界、平台及旧有效处置样例的完整范围核对、生产性能全家族和多页查询/分页直接证据、最终完整diff/72矩阵确认。本候选表不将这些内容推定为通过。

## 独立语义审查后的直接受影响补验

主代理修复恢复候选的同链关系、源Q、冻结SKU和订正一致性后，本旁路再次验证C3及M1–M5；没有重复计为新唯一用例，当前仍24个唯一功能例。C3扩展为原4＋actor6＋关系15共25种负例，其中十五关系变体逐一真实UI错误/所选文件保留/DB不变，并增加合法B1实际订正备份UI完整恢复控制；D1合法备份仍在入口恢复。M4增加旧schema2五行（400＋四个0）和缺历史WH/receipt的正向保留/再次backup控制。

有效日志为 `semantic-review/restore-relations-green/c3-and-m1-pass-before-m2-fixture-failure.log` 中2 passed（C3/M1），以及 `semantic-review/restore-relations-green/legal-migration-final.log` 中4 passed（M2–M5，7.8秒）。M2原输入缺其非静态QC来源，修正为真实公开上游来源的marker/post/QC/delivery四条必要overlay，不再冒称两条；无seed复制/无完成record断言保留。原失败、HMR双实例探针和最终源码/测试hash独立保留，详情见 `final-semantic-review.md` 与 `semantic-review/review-manifest.json`。原 `final-functional-browsers/run-manifest.json` 仍为前一批24例原始版本身份，不静默改成新版本。

PFN-007/012/017/019/033/036/038/040/044/050/053/054/058–063/071涉及本次修复，实际补验按上述文件绑定；未改原子矩阵状态，最终receipt/build/performance等仍由主代理完成。


## 2026-10-20 main整合后的补充证据

基线已快进至eb1b8c92，当前产品源以最终source-manifest为准。上文24个唯一用例保留合入main前的实际运行身份；下列4个新交叉用例不重复计入旧24。主代理最终收据会用独立输出路径重新执行适用五套补充浏览器契约，不能把该未来命令预填通过。

| 范围 | 已发生结果 | 对应原子编号 |
| --- | --- | --- |
| I1a加工先转，含旧inline图片 | 同一旧包实际原子失败/重试、转换Blob、raw和源指纹只读保存、后辅料归档7/10不重复、H400+新100后F500、再交100复检 | PFN-053/054/058–063/068 |
| I1b辅料先归档，含既有PCS原材料及文件 | 原行和文件保留、后加工可显式转换并承接H/N，LS→archive保持同来源，不重复库存 | 同上 |
| I2实际审计file input恢复 | 错误格式后同入口重试、受管材料只读archive+Blob、既有辅料余额及调拨不变、同内容幂等/不同内容冲突且DB不变、后续加工和复检可保存 | PFN-053/054/057/062/063/068 |
| I3实际managed PDA | 当前真实原型用户和正式单路由；OP只读/旧API拒绝；ADMIN故障恢复及390/480；HANDOVER/DISPATCH各实际收10/20；ID-F004错厂拒绝 | PFN-054/065/068 |
| 原main纯材料guard单节点 | 归档前后纯材料旧包转换仍拒绝，原LS/PCS保留，无退休事实回写；未称整个main文件全部运行 | PFN-052/061/068 |
| 平台公开D1 | 工序和1100时平台F100；全四项1000后F1000、首100实收留900；三次100/100/800后复检累计1000 | PFN-048/043 |
| bulk与原逐条材料判定 | 非空5调拨/4库存输入，接管2来源后两实现全部对象相同；下一次归属变空恢复5/4，证明未跨调用缓存 | PFN-056/068；PERF修复正确性 |

有效结果、实际源SHA、全部产品失败与helper/夹具校准身份见main-integration-review/integration-closure.md及manifest；20份最终JSON/截图/日志在main-integration-browser/accepted-20261020。原20个fresh Node进程误查ID-F090，已撤回实际F090等价结论；仅保留错误输入的原始结果，不作为真实F090、D10非空或性能证明。身份纠正见main-integration-review/f090-todo-equivalence/review.md；实际F090染色初始化未删除。

最终整合构建及9专项均exit0，单元1309/1309；任务实际31个源码/脚本类型范围0错误，全量仍有19项范围外既有错误。日志与独立manifest在retained-checks/final-integrated-20261020。原full/cross、最终100个家族520新样本及治理/收据仍须按各自实际输出关闭。独立内存示例39个源及脚本SHA全部与原135样本相同；打印新cold与新PDF性能不能继承旧毫秒值，视觉继承边界见consumers/final-inheritance-20261020.md。

## ecc 最新功能与身份校验版本补充

当前整合基线ecc8af013b5f9d67f5fef14fe5b692483aada61d，最新构建1321/1321（本任务24条unit＝11加工进度＋7多次复检＋6辅料候选身份），Vite23.00s。原31个任务源码范围0错误，新增/后改4个源码范围0错误，全量保留19项范围外既有错误。旧表和旧日志保留实际历史身份，不改标当前资产。

- UI02：A01实际取消假身份切换、默认后道录入与QC当前人分离；主管订正/历史核对默认空，必选实际主管+原因。占用后减量拒绝、原责任不变。M1及I1–I3本次责任确认实际通过。
- E完整功能覆盖：一例cross完成15完整链及汇总，原full22的前13＋QC39专项及后8例均有分批有效结果。两处旧lazy断言按初始4a已有PPIC恢复事实修正为“必要来源读取＋全部IDB业务写为0”，四个管理列表重置完整表内容与初始一致。最后收据仍强制完整23，不把分批计为一轮23通过。实际日志见retained-checks/final-ecc-functional-20261020及各校准red目录。
- C2/PFN045/A16：本期真实D1同一SKU/库位三次100/100/800，实际locations/库存DOM逐一核三出货与三仓储记录，1000/0/1000及每来源可用/已交出量完整，原实际输出已保留retained-checks/final-c2-locations/run.json.log，最终收据另产当前版本新结果。
- I1a/I1b/I2/I3：先加工/先辅料归档、inline/既有PCS文件、实际audit恢复与PDA权限/实收四个唯一集成例，在本次保守候选源上47251.363ms测试总耗时全部通过；非性能数据。main原首次无种子/投影及纯材料保护两个独立契约通过。当前原始结果为retained-checks/candidate-ownership-green；与旧4例属于复验，不新增唯一用例计数。
- UI主功能仍24个唯一B/C/M/R例，另4个唯一I例；6候选身份Node契约不是页面证据。其实际完整输出21准备单/42生产身份不漏，savedNo合法别名保留、删除及正式来源变化下次可见，损坏/失读不转空。只补既有Node请求设施缺的接口，不据此声明真实IDB事务通过。
- PFN052/068：原materials guard没有放宽；完整原材料完全未变的服装命令不额外读来源，修改材料仍实时核对。候选身份超集含静态、正式及保存别名；可能归属仍走原完整投影，源失读和sticky错误优先拒绝。未删除实际F090染色/PPIC/待办。
- PFN048/A24的平台D1实际结果已由main-integration-review/platform-d1-integrated核对：四项工作量1100时成衣F100，100/100/800各子单及仓收准确。该平台原证据保留原身份；第16–18节F/V随后已改变读取实现，不能再用字节未变作继承理由。其11阶段完整任务/加工单/点查/进度的原新1929647字节deepEqual见retained-checks/task-projection-equivalence与task-child-projection-equivalence，字段及下游计算逐项复核见root-final-review第16/18节；最终组合仍须按当前资产执行。

正式性能、当前打印媒体几何/冻结内容等价、最终完整组合与治理/技术收据仍按实际输出关闭；此处不代填其结果。独立standalone39个源/脚本字节与原135样本相同，保留原版本边界。

## 第19节当前实现和验收待闭环

当前源清单3d1ba8f2451b2ef5140e199a0c3be5c96bf452b1e8cf29b7af6ea5d51505f2a1绑定69源/1221生产资产。构建1335/1335，任务6个unit文件38唯一例：progress11、multiple-recheck7、identity8、summary6、SC1、seat5；旧表内9/6/24/16等计数保留其历史批次，不作为当前总数。第16/18节完整F/V原新等价、第18节R实际C3的25负例及合法控制、第17节SC退役红绿12fresh和seat5148750字节完整输出等价、第19节列表102父单2生产单8完整HTML1237587字节等价，均保留各自脚本/源/输出/manifest，不能相加成一轮浏览器验收。

PFN-056/068：SC专用来源仅延后原四仓展示投影，普通入口补齐；实际F090染色待办必要性反例保留；seat精确ID/code primitive查询不改评级规则。PFN-063：R稳定分组与内部明细只读优化未放宽恢复校验，grouped-hydration-browser的25负例原数据不变，合法订正控制通过。PFN-067：当前正式100家族520样本仍待执行，第18节PDA三个单次校准通过不能关闭。PFN-069/070：以上新文件/符号须进入矩阵和最终diff/收据，当前72条均保持已实现待验证。

最终必须取得同版23原full/cross＋28本期功能组合、正式100/520、打印内容/媒体几何与原视觉继承边界、全部适用治理和技术收据，再逐行关闭。用户已授权全部通过后本地main快进及GitHub main推送，精确SHA的Caddy Actions和HTTPS deployment.json/页面资源仍独立验，不预填发布成功或用户业务接受。

第20节当前冻结清单为6fa0d3c6480b4e4ef162e07db7e53a4493cf25b054d6cb0cd000f3539c596f07（69源/1222生产资产），第19节3d1ba8清单保留其原身份。print-preview两个出货类型直接引用原registry的四函数；22个完整PrintDocument/HTML共11865166字节原新deepEqual、12错误来源及2缺失来源拒绝见retained-checks/generic-print-adapter-equivalence。原GENERIC_OUTBOUND1000冷1568.9ms有效失败完整保留；新资产实际冷载/几何/PDF与正式100/520仍待采集，不由Node等价或1335单测代替。

第21节交接selector的11公开状态/187工厂/1914完整head及F090待办结果7333894字节等价见retained-checks/handover-selector-equivalence；新build仍1335/1335，H类型0。实际PDA944.8/759.3/381.9，delta/fullactions全部校准通过，五种1000打印冷/PDF/内容/媒体几何通过；extra父卡唯一factory断言误套失败被保留。第22节只按原父卡无工厂栏的契约修该collector条件，出货/QC工厂核对仍保持，其他字段/几何/起止/阈值不改。最新manifest6c8c5cdb374f604a98eba6cc5ea23f81b042be262efb7878929d8d5a2def6c2c，harnessc67a0ec98ca13b7af61fcf59a0b70f14a1cc1fe24709af6c68448a50ec92d714；产品dist仍stage21 index9a31c351f6213bd09e7d8ff7dbcd83b8b9c3744fffbec2afdd6bbe480b7083b4。校准不计为正式五次。

## 第25阶段当前绑定与正式失败

第24阶段最终collector b943的正式批次final-extra-qc-dom-formal前381样本通过，第382个GENERIC_BARCODE100 cold trial4=1008.4ms有效失败后停止；45页面225和18动作110全部通过，但未完成全100/520。第25阶段只将print-preview的三个FEI导入延迟到原消费分支，实际当前源/asset由source-manifest.json a7a3acf563ff95d76dba086c27da4dc6acb2ecaf6892ec01f0d25c47fcf44abf固定，dist index0ef0ec4c961cc0206f025b24a039b9634a9c0f373c1284c20659dd4a60cc17fa。69源/1223dist，canonicalcollector b943保持。22完整文档/HTML及错误来源等价、独立静态review、1335unit/build、scope type0在retained-checks/print-fei-entry-equivalence；当前真实相邻功能/完整23+28及正式性能未执行前仍不关闭矩阵。

第26阶段继承关系：上段第25阶段FEI延迟已全部撤回，非最终实现，历史日志及失败不删除。main两个postFinishingEntry遗漏新出货/条码类型是CDP实际确认根因；本节只补两种精确类型，保存过effects仍原条件恢复。新源码/运行资产、完整打印及正式五次以第26节最终source-manifest与新报告绑定，不将a7a3旧manifest改名为新版本。

## 最终A01–A30技术结果（第33节）

以下30组均由当前51功能、38任务单元、相关专项及逐条原子绑定覆盖；功能实际源47df与当前42371仅采集器两点不同、产品/测试/运行资产字节一致。原始业务/持久/迁移/图片证据保留原身份；性能读取final-performance-acceptance.json，打印质量读取final-print-quality。上文候选与旧批次中的待补说明保留历史身份，不代表本节仍未验证。治理/收据及main发布另行记录，不借本表宣告尚未发生的结果。

| 用例 | 技术结果 | 对应实际场景 | 最终证据绑定 |
| --- | --- | --- | --- |
| A01 | 已验证（Codex技术核验） | UP1；B1；S2/S8 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A02 | 已验证（Codex技术核验） | UP3；B1；ST | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A03 | 已验证（Codex技术核验） | UR1；S2/S8；ST | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A04 | 已验证（Codex技术核验） | UP2；B2 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A05 | 已验证（Codex技术核验） | UP4；S5 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A06 | 已验证（Codex技术核验） | UP5；B1新增；ST | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A07 | 已验证（Codex技术核验） | UP6；B2 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A08 | 已验证（Codex技术核验） | UR2/UR3；B2 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A09 | 已验证（Codex技术核验） | UR2；B2；C1 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A10 | 已验证（Codex技术核验） | UR3；B2；E旧复检 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A11 | 已验证（Codex技术核验） | UR2；S2 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A12 | 已验证（Codex技术核验） | UR2；B2；S2 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A13 | 已验证（Codex技术核验） | UR2；B2 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A14 | 已验证（Codex技术核验） | UR4/UR5/UR6；S2 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A15 | 已验证（Codex技术核验） | UR2；C1 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A16 | 已验证（Codex技术核验） | UR2/UR6；S2；C2 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A17 | 已验证（Codex技术核验） | B1；D10列表场景候选 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子；final-performance-acceptance.json |
| A18 | 已验证（Codex技术核验） | B2/B5/B6；C2 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子；final-performance-acceptance.json |
| A19 | 已验证（Codex技术核验） | B3/B4/B5；M6/M7；E旧QC/出货；PCS共享测试 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子；final-performance-acceptance.json |
| A20 | 已验证（Codex技术核验） | M2/M5/M6/M7 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子；final-performance-acceptance.json |
| A21 | 已验证（Codex技术核验） | M1/M3/M5 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A22 | 已验证（Codex技术核验） | M4/M5；C3 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A23 | 已验证（Codex技术核验） | S3；C1；电子PDF核读 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子；final-print-quality |
| A24 | 已验证（Codex技术核验） | S1/S2；C1；B2；R6 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子；main-integration与独立相邻25 |
| A25 | 已验证（Codex技术核验） | S1–S8；E1–E7；R1–R8 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子；main-integration与独立相邻25 |
| A26 | 已验证（Codex技术核验） | B1/B2；C2；R1–R8；E图片 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子；final-print-quality |
| A27 | 已验证（Codex技术核验） | UP7；S4/S5；E旧深链接 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A28 | 已验证（Codex技术核验） | ST；B1–B5 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A29 | 已验证（Codex技术核验） | UR7；B2新增精确900 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |
| A30 | 已验证（Codex技术核验） | M1/M3 | final-current-browser/summary.json；38unit及retained专项；矩阵对应原子 |

最终范围治理已实际通过：完整worktree prototype/list均exit0，未排除任务路径，日志retained-checks/final-governance。72原子及A01–A30均由Codex技术核验关闭；最终技术收据与main发布仍按冻结后独立交付记录登记，不将本段当作尚未运行的收据或部署回执。
