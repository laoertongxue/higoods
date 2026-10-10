# 指导文件收口与检查器修复：第1轮独立对抗审查

- 审查者：独立只读代理 `/root/guidance_adversarial_review`。
- 范围：实际矩阵全部 **82** 项，五常设文件、九退役入口、工具、记录、scope与收据；初始日志76为计数错误，已通知主线。
- 起始业务 HEAD：`99e25a0b846188176516a882b8c8d30fb915f6ef`，当前未提交治理diff。业务src无改变。
- 方法：阅读五文件及旧来源/已定位工具，真实Git夹具，主动负例、字节核验、专项回归；测试数不代替语义审查。
- 初轮结论：**不通过**。下列首次观察保留；实施中修复不能自动改写首次通过，第2轮对修复后版本重验。

## 实质问题

| 发现 | 级别/关联 | 位置（首次观察） | 复现/影响/修复 |
| --- | --- | --- | --- |
| R1-01 | P1 LIST-003 | list-page-policy.ts:12-17 | 模板 `10 件 → -10 件`、`2 箱 → 2 吨` 比较都true。负号被丢、单位枚举不全，数量事实变化误获文案例外。保留完整数量/单位上下文，不确定含数文本拒绝，加正负对照。 |
| R1-02 | P1 LIST-004/006 | check-list-page-governance.ts:47-64 | 三个本地同名空函数在unused函数内各调用一次，真正页面只返回裸table，contract仍true。名字相同不证明真实组件及有效输出。绑定导入来源/使用链，拒绝同名本地、未使用与丢弃调用。 |
| R1-03 | P1 RULE-002/TOOL-002 | affected-checks.ts 原42-58 | routeAffectedChecks(['AGENTS.md'])返回所有检查数组空。改变治理行为被当普通文档跳过，违SCOPE-02。规则/模板优先走专项，普通业务文档继续不跑业务构建。 |
| R1-04 | P1 RECORD-006 | prototype-review.ts:98-116 | 有效完整记录命令结果改 `通过（本次未运行）` 或 `通过，但实际执行失败`，都ACCEPTED。通过前缀掩盖否定。严格枚举结果或结构化证据后缀，未知/矛盾结果拒绝。 |
| R1-05 | P1 RECORD-005 | prototype-review.ts:34-45、66-77 | 标题正常，把所有字段/表格行缩进四空格仍ACCEPTED。CommonMark代码块被当声明证据。排除/拒绝缩进示例，正常1～3空格兼容。 |
| R1-06 | P1 TOOL-006 | record-workflow-stage.ts:24-47；task-completion-receipt.ts:102-108 | stage入口直接append/write；verify仍接收可选轨迹。非空required-skills只因缺旧标题间接失败。应在任何读取/工具前显式拒绝禁用参数并退役stage写入口，历史JSON只读保留。未执行被禁止stage命令。 |
| R1-07 | P2 SCOPE-006 | check-list-page-governance.ts main | `node --experimental-strip-types scripts/check-list-page-governance.ts --self-test --scope not-a-scope --paths src/pages/not-a-real-file.ts` 返回0。includes提前分派吞非法范围；只允许独立self-test/write-baseline，混合拒绝。 |
| R1-08 | P2 追踪定位 | 交付矩阵多行 | ROLE-01/SAFE-02无定义；应定位真实5.1/SAFE/STORE或真实稳定定义。主线已修，第二轮核对。 |
| R1-09 | P1 SCOPE-004；主线同轮发现 | verificationCheckEnvironment→scope | 收据--base只经GOVERNANCE_BASE_SHA传递，新scope没消费，已提交路径被当不属于HEAD变更。统一受控base、清无base旧env、旧新rename路径一致。主线23/23日志已读，第二轮再独立验。 |
| R1-10 | P2 证据准确性 | documents-audit.json / 记录计数 | 矩阵实际82项（8+27+7+12+9+6+7+6），却记录76。由实际唯一编号计数并同步证据，不少审六项。 |
| R1-11 | P1 LIST-005；主线同轮发现 | list-page-policy.ts correctionRows | 哈希表被HTML注释或缩进代码包裹仍可充当当前声明；与正文parser排除示例策略不一致。统一可见Markdown解析，保留正常声明，拒绝隐藏表。主线已交实现代理修复，独立第2轮复验。 |

R1-01/02/03/04/05/07主动运行确认；R1-06逐行确认入口，未写轨迹；R1-08/10文档核对；R1-09由主线独立交叉发现。实现代理修复声明不等于独立通过。

## 实际验证

- 独立运行 `node --experimental-strip-types --test tests/workflow-governance/governance-scope.test.ts tests/workflow-governance/prototype-review-adversarial.test.ts tests/workflow-governance/affected-checks.test.ts tests/workflow-governance/cutting-documentation.test.ts tests/workflow-governance/instruction-context.test.ts tests/workflow-governance/task-receipt.test.ts`：166/166，exit0。旧回归不覆盖新负例，不能推翻本轮失败。
- 独立核验九个退役文件固定Git原字节/SHA256/bytes/当前删除全部一致；README/architecture/cutting所有相对链接存在；git diff --check通过。
- 已读取主线实际 `/tmp/higoods-standard-list-final.log`：真实Chromium port51939，drop1、DOM稳定、顺序/存储更新、外部文本和取消拖动被忽略，最终检查passed。此次未重复同一运行。
- 已读取主线 `/tmp/higoods-scope-receipt-parity.log`：23/23通过；第二轮仍核对修复后版本。
- 业务页面/PDA/打印/业务性能不适用：本任务未改src。检查器Chromium是工具执行验证，不冒称产品验收。推送与Production不在本次范围。

## 82项逐项初轮结果

通过代表对应原子结果本轮未发现问题；整体仍因以上发现不通过。修复复测留给后续记录，不能把初次失败抹去。

| 编号 | 结果 | 依据/反例 |
| --- | --- | --- |
| DOC-001 | 通过 | 五文件存在，README 与 DOC-01 职责一致；任务报告明确不是第六份常设文件。 |
| DOC-002 | 通过 | 实核九文件当前删除；git show 固定版本的字节、SHA256、bytes 全部与清单一致。 |
| DOC-003 | 通过 | 历史 prototype-review-records 与 verification-evidence 无 diff；新规则不让旧证据升级冒充当前。 |
| DOC-004 | 通过 | README 分类覆盖需求、设计、计划、矩阵、审查、证据、治理；相对链接逐项存在。 |
| DOC-005 | 通过 | 九个 sourceCommit:path 均可读取，未把未跟踪文件假定已经保存。 |
| DOC-006 | 通过 | 原始证据未改；DOC-01 明确可重跑不等于可重建当时证据。 |
| DOC-007 | 通过 | 未预填完成；初读追踪 ROLE-01/SAFE-02 悬空，见 R1-08，主线已修真实位置。 |
| DOC-008 | 通过 | architecture 有日期和源码SHA；本记录有实施阶段/未发布，不冒充动态总览。 |
| RULE-001 | 通过 | SCOPE-01 分开有效需求和可复现现状，只对明确失效部分降级历史资料。 |
| RULE-002 | 不通过 | SCOPE-02 文义正确，但规则单改在 affected 被完全跳过，见 R1-03。 |
| RULE-003 | 通过 | TRACE-01 允许只读覆盖表，不强迫 T0 审查建实施矩阵。 |
| RULE-004 | 通过 | 四种职责可合在任务记录，未新增独立常设指导。 |
| RULE-005 | 通过 | 用户授权的数据/UI可同任务；冻结具对象、范围与期限。 |
| RULE-006 | 通过 | 兼容只读/映射限定消费者和退出；不长期双写。 |
| RULE-007 | 通过 | 显示、内部、正式迁移区分，正式迁移保留旧历史身份映射。 |
| RULE-008 | 通过 | 1.1允许必要数量/状态/保存，禁止未确认大型基础设施，边界相容。 |
| RULE-009 | 通过 | 区分计划/齐套/实物上限，风险放行按确认需求，不被超量笼统推翻。 |
| RULE-010 | 通过 | 3～5仅建议；不拉长单步扫码，不省必要交接。 |
| RULE-011 | 通过 | 第5节要求实际角色/培训/设备资料，不以国籍推断能力。 |
| RULE-012 | 通过 | 四个问题明确只是设计自查，不要求四块常驻说明。 |
| RULE-013 | 通过 | 不虚构SLA、工作台任务、主管处理或恢复入口。 |
| RULE-014 | 通过 | 状态、可用动作、保存结果分别表达，未保存不能写等同步。 |
| RULE-015 | 通过 | 同一事实同词；接单/接收/收货/入仓不得强行合并。 |
| RULE-016 | 通过 | 实收由现场动作登记，差额系统算；矩阵统一表头单位，不混片/件。 |
| RULE-017 | 通过 | 扫码优先；码坏/无设备仅提供真实已实现兜底。 |
| RULE-018 | 通过 | Mock按任务；少量固定字典不造交接、统计或导出。 |
| RULE-019 | 通过 | 状态语义色与实物色分开，关键文字不由图标替代。 |
| RULE-020 | 通过 | 命名设备可读/可点、键盘/焦点/名称可核验，UI-01集中设备规则。 |
| RULE-021 | 通过 | 三秒目标需观察方法；Mock、代理判断不当现场接受。 |
| RULE-022 | 通过 | 未知原因不编造，失败不隐藏，处理建议须能执行。 |
| RULE-023 | 通过 | 必要二次确认保留；明确最终确认不叠加同义第三层。 |
| RULE-024 | 通过 | 按实物识别任务要求图片；日志/明确上下文/纸面按适用性。 |
| RULE-025 | 通过 | PERF预登记环境规模起止，保留慢样本、不预热冒冷态、不择最快环境。 |
| RULE-026 | 通过 | 技术收据、产品接受、Git远端与Production分别记录。 |
| RULE-027 | 通过 | 只读库、用户授权、原子complete、失败输入保护、引用完整、迁移先读回后删源均保留。 |
| LIST-001 | 通过 | LIST-01允许按任务选择查询统计导出分页，不为模板制造功能。 |
| LIST-002 | 通过 | 已接入源码比较、当前轻量记录与双哈希；局部文字可保留原结构。 |
| LIST-003 | 不通过 | 负号和未枚举单位被误判为非结构修正，见 R1-01。 |
| LIST-004 | 不通过 | 新增/改哈希被拒绝；但删除基线依赖的迁移证明可用伪调用骗过，见 R1-02。 |
| LIST-005 | 不通过 | 双SHA校验本身正确；哈希声明的注释/缩进示例绕过见主线同轮R1-11，待修复复验。 |
| LIST-006 | 不通过 | 本地同名空函数/未使用函数内调用仍返回合规，见 R1-02。 |
| LIST-007 | 通过 | const入口和前后页特征均纳入，不能只改导出名或删除list声明躲过。 |
| RECORD-001 | 通过 | 缺模式、模式与可见性冲突实测拒绝，无旧式默认降级。 |
| RECORD-002 | 通过 | 历史API只给metadata和historicalOnly，不给当前覆盖通过结果。 |
| RECORD-003 | 通过 | 水平空白匹配，空日期/版本不吞后行，反例通过。 |
| RECORD-004 | 通过 | 模板值待填写，不预置通过/契约无，复制空模板不能交付。 |
| RECORD-005 | 不通过 | 围栏/注释排除但四空格代码块仍被当证据，见 R1-05。 |
| RECORD-006 | 不通过 | 最终NA/条件通过/未填行已拒绝；命令通过前缀仍可藏未运行，见 R1-04。 |
| RECORD-007 | 通过 | 重复节/字段/命令/文件、不同记录模式/可见性冲突均拒绝。 |
| RECORD-008 | 通过 | 编号与无编号标题等价，实测通过。 |
| RECORD-009 | 通过 | 技术证据两字段及直接检查必需，单靠治理或格式命令不行。 |
| RECORD-010 | 通过 | 模板逐行独立结论，无固定标签数；适用性完整性明确人工核对。 |
| RECORD-011 | 通过 | 日期含闰日、任务、验证人必填唯一；空、重复、假日期反例通过。 |
| RECORD-012 | 通过 | 精确根AGENTS引用，仅模板头/规范节；伪路径、外链、同名子文件不行。 |
| SCOPE-001 | 通过 | 全部src/index.html含main/domain/state/CSS被统一覆盖。 |
| SCOPE-002 | 通过 | 真实Git夹具确认index OID固定；后续重新add不污染原scope。 |
| SCOPE-003 | 通过 | 直接branch固定共同祖先和HEAD，不读dirty；收据桥接另见R1-09。 |
| SCOPE-004 | 不通过 | suite同scope与任务paths正确；收据--base环境桥接遗漏，见R1-09。 |
| SCOPE-005 | 通过 | 零受管变化明确not product acceptance，不冒称产品验收。 |
| SCOPE-006 | 不通过 | scope parser严格，但CLI混合self-test可绕过非法参数，见R1-07。 |
| SCOPE-007 | 通过 | 真/悬空/父目录链接与index子模块拒绝，真实删除仍允许。 |
| SCOPE-008 | 通过 | shellQuote保留引号/空格/命令替换字面值，逗号不可表达时报错。 |
| SCOPE-009 | 通过 | NUL+no-renames保留旧新两端及中文；主线另补收据路径parity 23/23。 |
| TOOL-001 | 通过 | 同快照聚合不混组件运行；真实Chromium单列工作区来源，日志已读。 |
| TOOL-002 | 不通过 | cutting治理路径不走全业务；AGENTS/模板跳过治理专项问题见R1-03。 |
| TOOL-003 | 通过 | 假CI/prebuild旧说明退役，bootstrap死入口删，命令合同测试通过。 |
| TOOL-004 | 通过 | 核心规则用稳定ID；矩阵悬空ID见R1-08，主线已修。 |
| TOOL-005 | 通过 | AGENTS原字节摘要与绑定入收据；内容改动拒绝旧回执，历史可解析但不可当前验证。 |
| TOOL-006 | 不通过 | 可选轨迹仍读/验且stage可写入口未禁，见R1-06。 |
| ARCH-001 | 通过 | 相对链接均存在，无旧checkout绝对入口。 |
| ARCH-002 | 通过 | 依赖版本链接package/lock，不固定易过期数量，核对基准明确。 |
| ARCH-003 | 通过 | 逐项核对systems九入口和defaultPage；PDA是shell特殊终端。 |
| ARCH-004 | 通过 | routes精确/延迟注册/兜底及main→shell相符，不再称SSR或三注册表。 |
| ARCH-005 | 通过 | 核对renderSidebarOnly和renderPageContentOnly；整体/局部图分开且不保证全站完成。 |
| ARCH-006 | 通过 | 静态/内存/IDB/遗留适配共存如实表述，不称全迁移或无CSS。 |
| ARCH-007 | 通过 | 引用解析不冒充仓库；没有最完整/零配置/测试完整保证。 |
| E2E-001 | 通过 | globalSetup由Playwright加载导出函数，未假定改父shell或修端口。 |
| E2E-002 | 通过 | 调试用npm exec -- playwright test --debug，非不存在脚本。 |
| E2E-003 | 通过 | package全裁片先build再dev43177；config默认4173；preview需目标资产，说明吻合。 |
| E2E-004 | 通过 | 核对cwd/URL/HEAD/dirty/运行资产，不以端口可达证明版本。 |
| E2E-005 | 通过 | 聚合断言/spec前缀边界与发布证据区分，不强迫每任务裁片全量。 |
| E2E-006 | 通过 | 隔离context/profile，不触用户日常资料；STORE/PERF保护一致。 |

## 反向范围审查

未发现src业务改动、数据库操作、依赖升级、用户浏览器清理、未经要求发布或改写历史证据。任务交付记录不成为常设第六文件。治理脚本和测试映射WP-02～05；旧stage写入口按R1-06闭环。最终源摘要与真实收据需在完成前绑定，再逐项执行第二轮。

## 移交时状态

本报告合计11项发现：独立审查9项，主线同轮交叉补充2项（R1-09、R1-11）；涉及11个初轮不通过原子项。主线已修82计数、悬空定位、规则路由及部分入口等；本报告不覆盖其后修改，所有修复统一待最终整合后独立第2轮复验。主线告知禁用CLI45关联测试通过、构建765单测通过；本代理尚未读取这两个新增日志，因此不把告知当作本轮直接证据。
