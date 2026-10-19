# 工艺冷启动剩余耗时修复（R12，实施记录）

依据 `AGENTS.md` 的 SCOPE-02、TRACE-01、REVIEW-01、PERF-01、EVIDENCE-01、RELEASE-01。本记录区分本地候选实施核验和后续正式发布。最终冻结时的产品审查结论只覆盖精确候选字节的本地结果；最后两轮审查、技术收据、Git/Caddy及正式HTTPS全量后验分别绑定独立原件。正式结果写入R12/final-delivery.json，未通过前整体任务不完成，本记录不预填线上通过或用户接受。

## 基本信息

- 日期：2026-10-19
- 任务 / 需求编号：MARGIN-01～14、COLD-01～16
- 验证人：Codex主代理；产品接受仍由用户确认

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：完整页面业务内容与操作契约保持；共享PDA批读、染色报表重复读取及Vite首屏加载优先级变化影响完整响应耗时，按T4加T5核验。

## 范围与继承

用户要求每个有效观察不超过1000ms，逐类修复和核对、全量核对、最后两轮实质对抗审查，全部通过后合并main、推送GitHub、Caddy正式发布并核对线上全部版本和页面。本轮为T4共享读取/构建提示，叠加T5；继承16个正式工艺、缝边绣单一身份、单工厂、原全部业务事实/图片/操作、保存恢复和失败边界。原18身份合并后的16类清单见下表，不恢复退役身份。

当前基线为已发布 `8bd7d7f15219f2811c92cce9de8c684d0c5eb1ae`、Actions `39144832491`。R11本地和两轮审查通过，但正式主131场景/95样本中打褶1010.3、1099.5ms及橡筋定长切割1040.9ms失败；相关25样本中染色统计1060.3、1194.4ms失败。16详情及reload共32功能观察通过、最高957.7ms。这5个有效慢样本保持原失败，R11没有最终成功交付。R12 `baseline-binding.json`只表示220份旧原件完整，不表示性能通过。最早GitHub监听EOF在页面采样前发生，旧日志与恢复记录仍完整保留。

工作树 `/Users/laoer/.codex/worktrees/dfd6/higoods`，分支 `codex/seam-embroidery-unification`；主checkout `/Users/laoer/Documents/higoods`。不访问原用户IAB/profile/43183，不接测试数据库，不清理用户数据。只用自有43185预览、隔离合成CLI contexts及正式HTTPS。不修改财务规则、工艺状态、保存事务、迁移、附件、框架、依赖或部署配置。

## 证据、设计与计划

R12/P12分别指 `output/verification/craft-cold-final-margin` 和 `output/playwright/craft-cold-final-margin`。真实正式瀑布显示加工单HTML仅28.3～41.5ms，完整必要JS直到704.8～845.7ms才收完；不能把其后236～305ms全部称CPU。染色一次失败TLS比同页成功多510.6ms，另一次基线资源晚421.1ms。不能单独归因favicon或只提高某一个PDA块。

独立hidden sourcemap构建核全部1131资产/274压缩文件与R11逐字节相同、1432模块和541块不变、原dist与源码未变。当前打褶/染色的两个本地CPU诊断使用原install、完整fixture、500us采样，明确只作诊断；v1连接拒绝原件保留，恢复自有预览后的新v2为独立运行，均不纳入性能验收。打褶实际列表渲染约95ms，异议读取中已有单头仍走再次查找；染色实际渲染约110ms，存在重复统计及逐行整表读取。

按次序实施，每一步先最小失败契约，再改局部实现并核对结果：

1. PDA两个已有单头的同步批读取传入该单头；不跨调用缓存，不改变默认/错ID/类型守卫及返回克隆。
2. 染色统计同一次公开render只计算一份统计，两个展示区读取该局部结果；节点耗时和排缸表各自保留原首次读取时序，把循环内整表读取改为局部快照查找。每次重新render重新读取，失败正常传播，不留模块级显示缓存。
3. 加工单27个原完整必需模块仍同次导航全部获取；完整首屏闭包都给高优先级，不再只优先16个恢复模块而把11个必需渲染模块留auto。保留真实依赖集合、求值/恢复顺序、baseline/实图及原112案例边界；79个其他案例链接序列不变，染色统计为明确变更的另1个入口。
4. 染色统计原必需PCS baseline在该精确路由的同次HTML解析内先发现且高优先；没有跨导航预热或删除资源，其余路由提示不变。
5. 当前完整158任务/8事实、染色全部HTML/单位/数量、原读取/控件/恢复/布局/实图/零普通owner写入核对。当前版本逐类各5次，再全131/95/3、相关25及全部16详情/reload。所有有效值保留；不能以平均、重试到绿、缩短终点或减少fixture替代。
6. 主代理完整任务diff正反核对，最后两轮独立实质审查；准确任务路径收据和重建字节一致；main仅ff、GitHub多方SHA一致、Caddy精确SHA/run/raw资产；重新完整正式采集并审计12份部署元数据。存在任一有效超时或未完成项，整体不完成。

业务对象仍由原静态源/IndexedDB owner读取；本轮不变更对象仓库、写入入口、附件、删除/覆盖标记或存量迁移。PDA批读只复用同步迭代中已持有的单头；染色缓存仅为函数内局部变量。源失败、保存失败、原按钮/真实reload恢复和多标签边界必须原样保持。需以完整旧/新结果和真实源回读证明，没有只减查询次数就声称数据保持。

## 原子矩阵

状态为本轮当前真实阶段；后续实施和证据再绑定，Codex技术验证不冒充用户接受。

|编号|来源|原子需求|工作包/实际文件|自动化验证|页面/性能或不适用|状态|证据位置|确认人/版本|
|---|---|---|---|---|---|---|---|---|
|MARGIN-01|正式5慢值/用户|旧失败和精确8bd7版本完整保留|R12旧证据封存|220原件重hash/14Gitblob|原正式131/25/32|已验证|R12/baseline-binding.json|Codex/8bd7|
|MARGIN-02|CPU证据/用户|两个批读复用同同步单头且结果完整|tests/unit/pda-head-batch-read.test.ts；pda-handover-events.ts两个批读|实际函数/默认/错ID/类型/完整值|异议和实收/PDA直读|已验证|R12/task-facts-audit.json；R12/checks-0.log；R12/pda-preload-after.log|Codex/R12|
|MARGIN-03|CPU证据/用户|统计两区共用本轮局部统计|tests/unit/dyeing-report-read-batch.test.ts；renderTopMetrics/renderNodeOverview|真实公开render/读次数/结果|染色统计/原控件|已验证|R12/dyeing-report-read-batch-green-v2.log；R12/actual-page-equivalence.json；R12/functional-controls-audit.json|Codex/R12|
|MARGIN-04|CPU证据/用户|耗时表逐行不重新整表读取|tests/unit/dyeing-report-read-batch.test.ts；renderDurationTable|实际局部函数/完整HTML|31行/数量单位不变|已验证|R12/dyeing-report-read-batch-output-proof-v2.json；R12/actual-page-equivalence.json|Codex/R12|
|MARGIN-05|CPU证据/用户|排缸表逐行不重新整表读取|tests/unit/dyeing-report-read-batch.test.ts；renderVatUtilization|实际局部函数/完整HTML|公式/产能导航保持|已验证|R12/dyeing-report-read-batch-output-proof-v2.json；R12/actual-page-equivalence.json|Codex/R12|
|MARGIN-06|真实必需资源晚到/用户|27原必需资源完整高优先级|vite.config.ts；tests/unit/craft-route-preload.test.ts|真实插件/输出依赖图|16类新context|已验证|R12/gate-priority-contract.json；R12/hint-contract.json；原16类80次逐类body/CLI|Codex/R12|
|MARGIN-07|染色baseline晚到/用户|精确染色路由baseline先发现/高优先|vite.config.ts；tests/unit/craft-route-preload.test.ts|真实HTML提示/相邻guard|相关五页各5次|已验证|R12/hint-contract.json；R12/affected-extra-summary.json（染色5值最高298ms）|Codex/R12|
|MARGIN-08|STORE/原契约|没有省略事实或跨render旧缓存|pda-handover-events.ts；dyeing/reports.ts；vite.config.ts|158任务/8facts/染色HTML新旧全等|存量/恢复/刷新/源回读|已验证|R12/full-local-summary.json；R12/functional-saved-audit.json；R12/functional-controls-audit.json；R12/task-facts-audit.json；R12/actual-page-equivalence.json|Codex/R12|
|MARGIN-09|原门禁|唯一1432模块/完整闭包/压缩保持|vite及原owner|真实构建图/压缩/提示/112案例（79不变+染色定向变更）|不适用:资源契约|已验证|R12/bundle-comparison.json；R12/gate-priority-contract.json；R12/compression-contract.json|Codex/R12|
|MARGIN-10|用户|逐项后全量/布局/图/操作全部达标|当前版本原采集器|131/95/3及相关25|1366/1280/1024|已验证|R12/full-local-summary.json；R12/functional-saved-audit.json；R12/functional-controls-audit.json；R12/task-facts-audit.json；R12/actual-page-equivalence.json|Codex/R12|
|MARGIN-11|用户|16详情直达及reload结果/版本完整|原task-detail入口保持|16/32真实body/零写/源回读|功能观察各<=1000|已验证|R12/functional-details-audit.json（16/32，最高414.4ms）|Codex/R12|
|MARGIN-12|用户|最后两轮实质审查无阻断|最终完整任务diff/原件|两个最终报告SHA|不适用:审查|待实施|R12待绑定|Codex/R12|
|MARGIN-13|用户/T5|收据/main ff/GitHub/Caddy精确发布|明确任务文件/原发布流程|收据/重建字节/多方SHA/CI|正式HTTPS|待实施|R12待绑定|Codex/R12|
|MARGIN-14|用户/T5|正式全部原场景/资源/每有效值达标|原三套正式采集|主95/相关25/详情32/12metadata|全部线上16类|待实施|R12待绑定|Codex/R12|

|编号|来源|原子需求|工作包/实际对象|自动化验证|页面/性能|状态|证据位置|确认人/版本|
|---|---|---|---|---|---|---|---|---|
|COLD-01|用户/PERF|打揽加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-DALAN|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-02|用户/PERF|打条加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-STRIP|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-03|用户/PERF|烫画加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-HEAT-TRANSFER|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-04|用户/PERF|直喷加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-DIRECT-PRINT|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-05|用户/PERF|打褶加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-GATHERING|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-06|用户/PERF|激光开袋加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/SPC-OP-LASER-POCKET|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-07|用户/PERF|布包扣加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-COVERED-BUTTON-MAKING|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-08|用户/PERF|压褶加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-PLEATING|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-09|用户/PERF|特种车缝（花样机）加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/SPC-OP-PATTERN-MACHINE-SEWING|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-10|用户/PERF|绣花加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-EMBROIDERY|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-11|用户/PERF|缝边绣加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-SEAM-EMBROIDERY|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-12|用户/PERF|盘扣加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-BUTTON-LOOP|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-13|用户/PERF|花朵加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-FLOWER-MAKING|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-14|用户/PERF|烫钻加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/AUX-OP-HOTFIX-RHINESTONE|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-15|用户/PERF|模板工序加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/SPC-OP-TEMPLATE-PROCESS|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|
|COLD-16|用户/PERF|橡筋定长切割加工单每有效值<=1000ms；旧失败保留|原task-orders.ts/SPC-OP-ELASTIC-FIXED-LENGTH-CUTTING|原CLI/JSON/实际资源/源回读|逐类5次后全量及正式|已实现待验证|R12/individual-local-status.json（各5次）；R12/full-local-summary.json（全量通过）；正式后验未完成|Codex/R12|

## 当前实现与验证进度

本轮实际修改范围为3个运行/构建文件、3个测试文件及本记录，共7条任务路径。完整单元测试1190项通过。首次候选引入2个可选工艺ID类型错误，已保留首次21错误原始日志及可恢复源码；修正Map键为实际可选类型后，全量类型检查回到原有19个PCS错误，任务新增错误为0。全量类型检查本身仍未通过，不用局部门禁代称全量通过。修正类型前后1131个实际运行资产逐字节一致；当前资产绑定1386个源码及8个任务测试，共1394项。

实际静态业务核对覆盖16类158个非空任务、8个完整事实分区及199个真实导入源；只替换PDA为精确8bd7源码比较，其他198源与旧版相同，全部字段一致。此证明不包含染色reports源。另在真实浏览器使用同一完整合成资料和固定时钟，分别读取原版与候选打褶列表、染色统计的完整main HTML及文字，4次读取均全等；未删除或归一化业务/加载字段，156份实际响应体全部核对。该项仅观察工厂源零写入，不能代称全部普通owner零写入或冷启动验收。

资源工具首次实际执行在新增的“25个受保护模块应分为25独立文件”断言失败。原版与新候选均为相同16组归属，该断言为工具假设错误；原失败日志保留，修复门禁必须逐组核对完整成员和静态依赖，不能只改计数。此时没有本轮冷启动样本，工具修复不能改写旧性能结果。逐类16×5已通过，最高406.5ms；全量v1主采集只完成91场景，前90个冷启动最高327.9ms，刷新1的正文取证失败，native3中已有/异常资料也有前页正文不可用。原因是新增正文校验错误地在导航后读取旧响应，并把合法304缓存校验当成错误。该轮全量明确不通过，原91值和3原生场景全部由R12/collector-invalid-attempt-1.json封存；不降低缓存、起终点、1秒标准。旁路修复新采集工具，不改已被80次逐类计划绑定的原28工具；新的完整全量使用独立namespace，仍保留全部旧观察。相关25冷启动、12恢复场景、65控件操作和16详情/32读取已分别通过；新full131/95/native3已在P12/local-v3-full完整通过，最高300.4ms；正式验证待执行。真实304能力诊断v3证实同context先前实读200、单一If-None-Match与Vary请求输入相等的校验链；304响应确无ETag且body不可读，保持原status及缺失字段，不伪造正文。诊断v1哈希API不可用、v2过严要求响应ETag的失败原件均保留，诊断不列为性能采样。

## 当前结论

实施中，未完成。R11四个既有专项脚本失败和19个全量PCS类型错误仍按原Git复现范围披露，不能改标通过；本轮新的真实UI/行为、工程类型和必需FCS门禁照常执行。旧诊断、旧正式有效失败及本轮所有尝试保留，不把功能详情、CPU诊断或资料完整性封存冒充冷启动/正式验收。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 原5个正式有效慢样本完整保留 | 通过 | R12/baseline-binding.json；不把完整性通过改称性能通过 |
| PDA两个实际批读完整字段 | 通过 | 1190单测与R12/task-facts-audit.json的158任务/8事实/199实际源 |
| 染色报表数量、单位、重复及缺失ID | 通过 | 9项真实AST契约、9对完整HTML、实际完整main DOM对照；失败/下一次调用重新读取 |
| 资源闭包及加载提示边界 | 通过 | R12/bundle-comparison.json；112路由案例、27模块完整高优先、79其他入口不变、染色定向变更、274压缩文件解码一致 |
| 每类独立5次冷启动 | 通过 | 原16类80样本最高406.5ms，原28工具和所有绑定保持 |
| 完整131场景及95性能样本 | 通过 | R12/full-local-summary.json；新local-v3-full共131/95/native3，最高300.4ms；4264实际200正文与5真实304分别核对，原生187实际200/7真实304及3精确setup文档 |
| 相关5页冷启动 | 通过 | R12/affected-extra-summary.json；25次最高356ms，970份实际正文 |
| 保存及异常恢复 | 通过 | 12个功能场景/86检查点/1880正文；直接原页覆盖只证明预结算，另3页保留关系受限证明，不夸称全部直接覆盖 |
| 原控件真实操作 | 通过 | 13家族各5次，共65次，最高566.1ms；取消/关闭不写入，实际差异提示及跳转通过 |
| 16类正常详情与刷新 | 通过 | R12/functional-details-audit.json；32次最高414.4ms、1510份实际正文、源及owner回读一致；不覆盖毛织片提前返回分支 |
| 逐类单一工厂归属 | 通过 | R12/single-factory-facts-audit.json；完整158条记录中每个工艺只有1个实际工厂，非空指派一致；22个毛织来源未分配字段原样保留，不伪造指派 |
| 本轮新增打印、上传、真实数据库写入 | 不适用 | 本轮未改变这些动作；不接测试库，未扩大数据操作范围 |
| 当前全量类型基线限制 | 通过 | 实际full tsc仍失败19项；原错误文件与Git8bd7逐字相同，本轮新增错误为0，未称全量类型通过 |

## 最终结论

结论：通过

本地精确候选的产品核验通过；整体任务仍未完成。最后两轮对抗性审查、技术收据、main/GitHub/Caddy和正式全量后验尚待独立执行，全部通过后仅由R12/final-delivery.json关闭相应30项。该本地结论不代正式发布、线上性能或用户接受。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/pda-handover-events.ts`
- `src/pages/process-factory/dyeing/reports.ts`
- `vite.config.ts`
- `tests/unit/pda-head-batch-read.test.ts`
- `tests/unit/dyeing-report-read-batch.test.ts`
- `tests/unit/craft-route-preload.test.ts`

### 页面证据

- 版本：codex/seam-embroidery-unification，HEAD 8bd7d7f15219f2811c92cce9de8c684d0c5eb1ae加本轮7路径未提交差异；工作树/自有43185同源生产预览，Chrome155、zh-CN/Asia-Shanghai，1366×768及适用1280×720/1024×768；实际1131资产及1394源码/测试输入见R12/asset-version.json。不读取用户IAB或43183。
- 证据：P12逐类16份CLI原件，R12/task-facts-audit.json、actual-page-equivalence.json、affected-extra-summary.json、functional-saved-audit.json、functional-controls-audit.json、functional-details-audit.json；真实打揽/打条详情截图由主代理读像素核对，图片对应、当前状态和确认接收动作可见，文档主体无横向溢出。新local-v3-full已完整核对1366/1280/1024、36布局场景、编辑器取消/刷新及压褶滚动实图；不拿缺失场景的旧v1冒称本轮证据。

### 性能结论

- 结论：通过
- 依据：原install/ready及有效慢值继续循环逐字保持，完整fixture、缓存策略、导航起点与完整就绪终点不变。原16类80次各5次最高406.5ms；新local-v3-full的18冷入口/19家族共95次最高300.4ms，含独立5次原生刷新；36布局及3原生资料场景通过。相关25最高356ms；65控件观察最高566.1ms；16详情/32功能观察最高414.4ms，后两项明确不当冷家族。新sample只在原ready(false)后、原reload前增加1个非测量正文检查点，剥离后严格恢复原f4390a599d95ec6721700d08f0dedc2aad1e36f5d8af54301b5a56933ff2a6a4；原生7处取证patch逆变换严格恢复原流程。200真实正文和304同context此前200的精确URL/hash/ETag/真实请求validator/Vary链分别核对，未禁用缓存、补fetch或伪造本次正文。所有历史失败保留，正式HTTPS全量尚未执行。

### 验证命令

- `node --import tsx --test tests/unit/*.test.ts`：通过
- `python3 output/verification/craft-cold-final-margin/check-task-types.py`：通过
- `node output/verification/craft-cold-final-margin/build-candidate.mjs`：通过
- `python3 output/verification/craft-cold-final-margin/compare-bundle.py`：通过
- `node output/verification/craft-cold-final-margin/check-hints.mjs`：通过
- `node output/verification/craft-cold-final-margin/check-gate-priority.mjs`：通过
- `node output/verification/craft-cold-final-margin/check-compression.mjs`：通过
- `python3 output/verification/craft-cold-final-margin/collector-v3/prepare.py`：通过
- `python3 output/verification/craft-cold-final-margin/collector-v3/run.py`：通过
- `python3 output/verification/craft-cold-final-margin/collector-v3/audit.py --summary output/verification/craft-cold-final-margin/full-local-summary.json`：通过
- `python3 output/verification/craft-cold-final-margin/run-remaining-local.py`：通过
- `npm run check:fcs-end-to-end`：通过
- `npm run check:menu-routes`：通过
- `npm run check:standard-list-page-template`：通过

### 例外

- 全量PCS类型仍有19项既有错误，本轮只证明零新增，不将其豁免成全量通过；R11四个既有领域检查问题保留原版本和复现范围，未调整断言绕过。
- 原80逐类和当前相关/恢复/详情观察以实际源码、资产及工具SHA绑定；新v2取证修复仅允许导航后就绪、离开前保存真实正文及合法304校验链，不允许改变测量/缓存策略或清资料。
- 正式发布和12份部署元数据属于后续独立T5阶段，全部通过前不生成最终成功清单，也不代用户接受。

## 历史失败尝试及本阶段冻结

R12/run-local-sequence.py的原逐类80次均通过，但该命令随后full-v1在第91刷新和native正文取证失败，命令整体仍失败；原件见collector-invalid-attempt-1.json，未改标。工具首版错误25owner假设见tool-core-attempt-1。collector-v2首次实际run在任何browser步骤前因Path排序与字符串排序差异中止，steps=[]、0样本；原5源/计划/失败原件不改。主代理在独立collector-v3统一清单两侧字符串排序，完整保留成员/哈希门禁；先实际核当前1394/1131输入，再用缺项、多项、错哈希3个反例核拒绝后才采集。4264+187份实际200、5+7份304与3个精确setup文档在新full原件全部逐条对账。

原R12/mandatory-checks.json中FCS/menu/template三个实际结果通过；两项文档治理因本记录当时缺少规范字段失败，原日志完整保留。本记录已补完整模式与真实本地证据，最终两项治理在本记录冻结后实际执行，结果单独写R12/mandatory-checks-v2.json；只有真实通过才进入最终审查。先前失败不列为本阶段当前通过命令。

本记录冻结阶段是本地候选实施核验，后续不可回填正式通过。最后两轮结果分别写adversarial-final-round-1/2.json；收据task-receipt.json，Git/CI/正式各套原件及最终final-delivery.json均在R12独立输出。30项矩阵中最后审查/发布及正式性能仍未关闭，代理不代用户接受。

实现及测试6文件逐SHA的规范JSON摘要：`f7814290476205fd6048c0062a9ab5e5f2960e602bccff08432cce694a708b77`；具体6文件SHA纳入R12/frozen-task-files.json，实际运行资产继续绑定R12/asset-version.json。
