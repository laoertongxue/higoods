# DDS 生产与履约时效 V4 持续整改记录

## 1. 基本信息

|项目|内容|
|---|---|
|日期|2026-09-18|
|需求|dependency-revision-v4.md 的 V4-GRAPH/BLOCK/DOC/UI/PERF/REVIEW；当前规则映射、源单据责任拆分|
|记录模式|完整产品审查|
|系统/角色|DDS 管理 Web；跟单、采购、仓储、工厂主管|
|分支/HEAD|codex/dds-production-fulfillment / 4804328a822eec3c77eee1ffa5b10911bb77c9fe，未提交工作树|
|工作树|/Users/laoer/Documents/higoods|
|运行地址|http://192.168.0.10:4179；final5 同工作树构建，64文件哈希见 technical/source-manifest.json|
|设备|隔离 Chromium；管理 1366×768/1280×720，主管 1024×768|

## 2. 影响判定

- 用户可见影响：有
- 判定依据：全程默认依赖图、明确卡点及影响、居中单据简要信息、当前来源单据拓展、来源规则映射及责任拆分。
- 当前基线：AGENTS.md 第4/5/7节；已应用 higood-indonesia-factory-design 技能。用户 AGENTS.md 修改未编辑或吸收。
- 共用技术包读取性能修改不更改业务记录；子集克隆保持调用隔离，已有专项比对。后道初始化合并重复持久化，裁片同单确认缩小回滚快照，中文排序复用排序器，结果与失败恢复保持不变。DDS 只写自己的关联、规则草稿/版本、跟进、数据事项及预测，不向线上或 PCS/FCS 写业务动作。

## 3. 自查结论

|检查项|当前判定|说明|
|---|---|---|
|角色与层级|本轮页面检查通过|final5 已测依赖/甘特/准备/工艺互斥视图；单据先摘要，再分时效/依赖/来源；不代表全部业务接入|
|卡点与责任|本轮逻辑与页面检查通过|逐个具体卡点点击5次；本项异常、上游等待、数据缺口分开；已有失败检验不因缺建立时间而隐藏|
|来源身份与数量|部分实现，未闭环|精确单号/任务/来源行关联已测；抽检/实收不代替整单合格与实发。完整需求供给分配及客户实发行仍缺来源|
|图片与对象识别|不通过|当前源按品类回填的通用样例图已排除；DEM-0005描述灰色卫衣但源图为棕色皮夹克。专属图保留，缺图明确待补；不跨款借图。素材未齐备|
|防错与变更|本轮边界检查通过|显式映射、空规则阻断、旧截止保留已测；正式规则值及完整计划范围仍待落实|
|交接与追溯|部分实现，未闭环|生产建单、工序交接、质检、调拨/运输/接收按来源事件展示；独立承运交付确认尚缺|
|低分辨率与交互|本轮页面检查通过|final5覆盖1366/1280/1024及485类控件；来源数据与图片未齐，不等于业务验收通过|
|性能|本轮已测响应通过|final5 DDS7235＋来源15＝7250个原始样本均低于200ms，DDS最大171.29999999701977ms；24个访问组合缺图，完整素材门禁仍失败。历史慢样本另存，不覆盖|
|PDA/扫码/上传/生产鉴权|不适用|本轮未新增这些入口|

## 4. 问题标签

- 追溯不足、协作断裂、状态抽象、字段过载、性能。

## 5. 主要问题与处理

|问题|处理|剩余约束|
|---|---|---|
|甘特缺预算就看不出依赖|默认关系图按拓扑布局，箭头固定显示；甘特未知日期不画D0假边|缺来源关系仍待补，不能自行猜串并行|
|不知道哪个具体工作卡住|卡点清单、原因/责任/影响、图中高亮和定位|整体截止未知时不能编造总延期|
|点击只见泛化时效|源单据摘要，最大12核心字段；详情来源链接和独立Tab|源系统未提供字段明确显示未提供|
|技术包来源任务错作准备单|准备单ID与技术确认任务ID双键验证，再核对正式版本|无明确准备关联不自动同款匹配|
|运输、接收归责混合|分别识别调出、运输和实收；送货登记不冒充交付|当前来源无独立物流交付确认时间|
|规则只能作用于旧演算数据|任务规则映射承接当前节点、事件及类型；单项发布且不移动既有基线|正式预算值需配置，缺全程事实不能生成基线|
|需求摘要拼造不存在的详情地址|改为已注册需求列表，标明“前往生产需求列表”；其他入口标“查看来源页面”|实际来源页面跳转与目标身份另外验证|
|连续保存同一预测导致刷新重复计算|仅恢复时合并相邻同任务/工作/时间记录，保留存储与跟进历史；不同工作/日期按原顺序恢复|原始逐条重放与优化后结果完全等价测试；5次保存后的整页返回重新测量|
|普通详情展开出现秒级卡顿|DDS原生展开和列拖拽不再落入其他系统处理器；保留原生动作与本地业务事件|最终浏览器网络及5次操作回归|
|大图失败无法点击关闭|错误提示从覆盖整个弹窗改为内容区反馈|最终模拟失败、关闭和重开恢复验证|
|事项筛选按钮混排|三个等宽条件；重置及刷新按钮独立位于条件下方|1366/1280/1024同版本验证|
|前轮不通过仍收尾|历史结论保留，当前矩阵不继承通过，继续修复并按最终版本验收|未通过门槛前不宣布整体完成|

## 6. 最终结论

结论：不通过

本节为本轮核查结论，不是整个模块的结项声明。

当前记录为持续整改中的回执，未结束整个模块。final5已完成27组功能检查、485类控件覆盖，7250个DDS及来源点击样本均低于200ms，覆盖无遗漏。但本次访问仍有24个款号/名称组合缺对应图片，77类候选动作尚无逐类完整事件接入证据，准备/物料分配/物流交付/客户实发等业务关联仍有缺口。当前报告 completePass=false；不能标记整个模块已验证。final3、final4等历史失败完整保留，final5通过只适用于当前已测实现与范围。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/material-decision/events-bridge.ts`
- `src/pages/material-decision/index.ts`
- `src/pages/qc-records/detail-domain.ts`
- `src/pages/production-fulfillment/boundary-evidence.ts`
- `src/pages/production-fulfillment/calculations.ts`
- `src/pages/production-fulfillment/catalog.ts`
- `src/pages/production-fulfillment/common.ts`
- `src/pages/production-fulfillment/config-model.ts`
- `src/pages/production-fulfillment/configuration.ts`
- `src/pages/production-fulfillment/dashboards.ts`
- `src/pages/production-fulfillment/dependency-graph.ts`
- `src/pages/production-fulfillment/data-issues.ts`
- `src/pages/production-fulfillment/events.ts`
- `src/pages/production-fulfillment/evidence.ts`
- `src/pages/production-fulfillment/examples.ts`
- `src/pages/production-fulfillment/fixtures.ts`
- `src/pages/production-fulfillment/index.ts`
- `src/pages/production-fulfillment/model.ts`
- `src/pages/production-fulfillment/mock-data.json`
- `src/pages/production-fulfillment/rule-recalculation.ts`
- `src/pages/production-fulfillment/scenarios.ts`
- `src/pages/production-fulfillment/source-document-facts.ts`
- `src/pages/production-fulfillment/source-tasks.ts`
- `src/pages/production-fulfillment/source-views.css`
- `src/pages/production-fulfillment/source-views.ts`
- `src/pages/production-fulfillment/styles.css`
- `src/pages/production-fulfillment/task-detail.ts`
- `src/pages/production-fulfillment/tasks.ts`
- `src/pages/production-fulfillment/timeline.ts`
- `src/pages/production-fulfillment/ui-state.ts`
- `src/data/fcs/production-order-tech-pack-runtime.ts`
- `src/data/fcs/process-order-task-links.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/production-artifact-generation.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-operation-log.ts`
- `src/data/fcs/cut-piece-release.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/process-craft-dict.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-project-domain-contract.ts`
- `src/data/app-shell-config.ts`
- `src/main.ts`
- `src/router/routes.ts`
- `src/state/store.ts`

### 页面路由

`/dds/supply-chain/production-fulfillment/` 下 overview、tasks、follow-up、work-items、teams、fulfillment、configuration，当前来源任务详情及团队详情。精确对象见最终浏览器报告。

### 验证命令

- `node --import tsx --test tests/unit/production-fulfillment-*.test.ts tests/unit/production-order-tech-pack-runtime.test.ts tests/unit/production-artifact-source-selection.test.ts`：通过，126/126；含数据事项恢复/重开、已暂停/受阻不放行、通用图不得冒充款图、增加图片地址不得自动确认款色对应；原始输出 /tmp/dds-v4-unit-final3.log。
- `PF_CHECK_URL=http://192.168.0.10:4189 node scripts/check-dds-production-fulfillment.mjs --v4`：失败，候选1446原始样本，overview首次冷240.9ms/tasks首次冷202.6ms；跟进保存和映射试算发现源码错误，菜单与弹窗另有脚本选择器失配；output/playwright/v4-candidate保留原始记录。不得当作最终4179通过证据。
- `node scripts/check-typescript-scope.mjs src/pages/production-fulfillment/ src/data/fcs/production-order-tech-pack-runtime.ts src/data/fcs/production-tech-pack-snapshot-builder.ts src/data/fcs/production-artifact-generation.ts src/data/fcs/post-finishing-full-flow.ts src/data/fcs/cut-piece-release.ts src/data/fcs/process-craft-dict.ts src/data/pcs-technical-data-version-repository.ts`：通过，范围内0错误；范围外61既有错误；原始输出 /tmp/dds-v4-type-final3.log；本轮范围额外包含后道操作日志、裁床物料准备和 main.ts。
- `npx vite build --outDir /tmp/higoods-dds-pf-build --emptyOutDir`：通过，最终3构建9.07秒；4179局域网返回200，入口 index-DE_TjAgD.js，production-timeliness-BdD1CL7Z.js；/tmp/dds-v4-build-final3.log。
- `npm run check:prototype-design-governance`：通过，但默认仅查暂存区，当前没有暂存文件；另调用同一 validatePrototypeReviewCoverage，明确范围内38个受管源文件均有审查记录。此结果只证明记录格式与覆盖，不证明业务验收通过。

### 例外

- 未改变线上单据；当前资料仍属已有原型事实，不当作线上业务已接入。
- 来源暂无独立物流交付确认、需求供给分配与客户实发行归属时，保留明确未判定。缺失值不能由演示算例补造。
- 系统物理打印不是本次用户修改范围；只检验打印摘要预览与取消，不声称物理分页已验收。
- 工作区 AGENTS.md 为用户原有差异，不纳入本次修改。

### 真实图片验证

款式取对应生产需求 imageUrl；物料取正式技术包或工厂接收单资料。默认视图、弹窗、大图、失败反馈及关闭须在最终源码构建上验收。未知物料素材不得用其他图片补齐；完整覆盖以最终对象清单为准。

### V4 第一完整轮保留证据

`output/playwright/v4-before-final-fixes/verification.json`：22组功能通过、6874原始样本、6类入口不足5次。超限包括3个总览加载/刷新、2个原生展开误加载其他系统、1个团队空查询脚本错误就绪条件。大图失败提示遮住关闭为真实缺陷。应用缺陷修正、就绪条件校正、覆盖补足分别记录；不删除或复用该轮为新通过证据。新最终目录为 `output/playwright/dds-pf-v4-final/`。

款图人工核对：`production-demands.ts` 的 `resolveDemandImageUrl` 使用品类通用图；不是逐款素材证明。DDS排除其六个通用回退图和placeholder，不修改上游、不因缺图缩减需求或工作数。专属原图仍按正常图片就绪计时；无对应素材的对象记为图片门禁未通过。

### V4 最终2保留证据与最终3范围

`output/playwright/dds-pf-v4-final/verification.json`：26组功能通过、7055原始样本、0功能错误，但有1个完整加载275.4ms（连续5次保存预测后返回工作项列表）、5个入口覆盖缺口，以及遇到的24个款号/名称缺图组合。未删除失败或按平均值判定。

最终3只进一步修正需求来源入口与准确文案、连续重复预测恢复。126项专项通过，其中“恢复预测保留不同工作和日期的顺序，只合并连续相同计算且不改写历史”逐值对照原顺序重放；“需求摘要指向已存在的需求列表，入口不冒称独立详情”验证入口边界。最终源码构建于4179，完整页面重测及有效执行任务/QC来源实际点击已执行，合并证据为 `output/playwright/dds-pf-v4-final3/combined-verification.json`；不能沿用前轮截图代替最后版本。

静态列表规范检查通过（430页、17项既有基线）；显式治理覆盖38个本任务受管源文件，`/tmp/dds-v4-governance-final3.log`。该检查只证明记录存在与范围对应，不证明业务或性能通过。

## 8. 仍需补齐的业务证据（不能以页面完成关闭）

|对应问题|当前缺口|可以关闭该项的直接证据|
|---|---|---|
|F03/F08/F09 准备与工艺|部分需求缺明确准备单、正式路线和前置关系；77种候选动作不等于已接77类有效事件|具体生产需求号与准备单号、确认的专业工作/复用结果、正式技术包版本及工序前置关系|
|F04 交出与到厂|送货登记、运输交付、工厂接收时刻不等同；来源缺独立承运交付确认|来源行与目标工厂明确关联的实际交出、物流交付、工厂实收时刻和数量|
|F07 物料齐套|源单数量不能分摊给每个需求；本需求供给份额与物料版本未齐备|需求SKU/BOM版本、现货或采购来源明细、分配数量/单位及目标SKU合格可用数量|
|F05/F10 单项与整体标准|尚未配置或确认必要工作范围与正式预算时不能生成全程要求|覆盖当前路线的工作定义/起止事件/类型条件/自然日预算；完整计划终点与串并行关系|
|F06/F15 订单实发|源中未提供本需求归属的客户实发行，不把无记录当零发货|实发行号→客户订单行→生产批次/需求的明确归属与数量、订单下单/实发时刻、正式取消及减量事实|
|V4-SOURCE-002 对应图片|通用类别样图不是当前款色实图；本次已遇到24个缺图组合，非全库穷尽|按具体款号/款色对应的实拍、效果或正式图片及确认来源；仅添加任意URL不能通过|

这些来源须由明确业务记录提供，不能由同款猜配或独立算例填满；本轮仅修改本地原型与核查记录，未向线上写入或自动创建采购、调拨和发货事实。

## 9. 最终3实测失败与继续整改

- 完整回归7172样本、图片及折叠事项补测160样本、实际来源链接15样本，共7347样本；485类控件覆盖完整。团队图片补测修正的是“需要协调”队列的脚本前提，原失败未删除。
- DDS总览首次冷导航239.6ms；独立图片补测的团队首次导航232.8ms。后者原helper标为refresh，实际是新隔离context首次导航，按冷启动失败记录。
- FCS执行详情 `TASKGEN-202603-0002-001__ORDER` 实际点击五次：1638.7、1665、1600.1、1597.5、1624.5ms，全部失败。
- FCS质检详情 `QC-RIB-202603-0002` 实际点击五次：1481.8、482.2、515.4、465.2、497.4ms，全部失败。两个来源入口均到达对应单据并展示核心信息，但“能打开”不能当作性能通过。
- 需求列表入口五次：124.1、118.8、119.2、121.3、121.4ms；重复预测恢复的原275.4ms场景，最终3五次为113.5、102.3、104.2、100.9、103ms。上述通过仅针对这些测量项。
- 来源页图片附加核对：现有FCS质检页使用 `placehold.co/96x96?text=SKU`，图片加载成功不证明与SKU对应；需求列表品类通用图也不能据此通过款图门禁。DDS已排除已知通用回退图，未改写这些来源页。
- 原始与补测证据：`output/playwright/dds-pf-v4-final3/verification.json`、`output/playwright/dds-pf-v4-final3-image-supplement/verification.json`、`output/playwright/dds-pf-v4-final3-source-entry/verification.json`。源码、脚本、日志清单在最终3目录的technical子目录。

状态仍为不通过。每个后续修复必须附新版本与受影响项复测；不能删掉慢样本、忽略首次操作，或把源业务与素材缺失填成演示事实后结项。

## 10. 入口加载整改（最终4不通过，保留证据）

final3首次冷加载profile还原出主入口在生产时效路由静态初始化物料监控与决策的8组页面及数据。最小整改为主入口只引用同步事件委托，物料决策路由加载时原顺序注册click/input/change/keyboard及原role/stale守卫；不删除业务数据、不改变源操作、也不把当前DDS首屏延后显示。涉及main.ts、material-decision/index.ts及events-bridge.ts，归属V4-PERF-001。修复后需同工作树最终4构建、DDS冷/刷新/站内加载与交互、物料决策首次进入和原守卫的回归。当前仍不通过，final3证据不自动升级为最终4通过。

来源跳转的只读profile在 `output/playwright/dds-pf-v4-final3-source-profile/`：执行详情的关系查询为寻找单据先初始化全部印花/染色演示进度；QC等待外部占位图。profile带测量开销，只用于定位原因，不能代替原15次来源验收。此处尚未修改FCS专业工厂初始化或质检来源页面，源页面失败继续保留。

最终4构建曾运行于同工作树4179（http://192.168.0.10:4179，HTTP200），入口index-Ba2d7CYP.js、DDS production-timeliness-Cb-RVR_7.js、shared app-shared-CNb0BgIn.js。130/130单测通过（新增4项事件委托注册/原顺序/原守卫测试）；本轮类型范围0错误、全库61既有错误；构建13.39秒。日志及56文件哈希见 `output/playwright/dds-pf-v4-final4/technical/`。

最终4完整报告 `output/playwright/dds-pf-v4-final4/combined-verification.json`：27组功能、485类控件无覆盖缺口，DDS及实际来源点击共7230个原始样本；13个性能失败。DDS为229.9、310.5、228.3ms；执行来源5次1589.7–1629.7ms、QC来源5次416.2–466.8ms。24个已访问款号/名称组合仍缺对应图片，整体不通过。物料事件委托另有200原始样本、34组、40次冷导航，全部低于200ms，原始证据 `output/playwright/dds-pf-v4-final4-material-bridge/verification.json`。这些通过不抵消前述失败。

## 11. 候选工作与事件识别不能混为实现

逐条审阅77条ACT发现：原子要求是起止/完成事件识别，原绑定却全部只是catalog.ts/configuration.ts与同一目录字段检查。77条均已从“已实现待验证”纠正为“实施中”，逐条列出具体缺口并关联F03/F10和相应V3-SOURCE；已有通用与部分源投影只证明其实际覆盖范围。没有删改原需求以获得通过。矩阵327条当前180已实现待验证、144实施中、3不适用；整个模块仍不通过，不以目录或算例收尾。

## 12. 最终5修复范围与当前证据（整体仍不通过）

- V4-BLOCK-001：先以专项用例复现“不合格已有检验结果但缺建立时间，前置未完时卡点被隐藏”；等待条件增加结束事件检查。已发生的失败检验不归为尚未开始，不放行后继；来源投影与原质量事实不变。
- V4-PERF-001：物料模块所用5个公共UI及其静态依赖归共享包，避免为了按钮/表格加载全部DDS。只调整打包归属，物料业务不变。
- 冷加载profile `output/playwright/dds-pf-v4-final4-cold-profile/` 显示逐项查项目专业定义时重复克隆全14项。改为相同复制逻辑仅复制选中的定义；14项与修改前JSON逐值一致（`/tmp/dds-v4-project-definitions-equivalence.log`），未知ID与可编辑数组隔离由专项测试覆盖。未改变专业任务定义或减少验收数据。
- 新浏览器脚本对图中每个具体卡点分别点击5次，校验其本身的单号、核心字段及影响说明，不只点击最容易取得的需求起点。
- 来源执行详情通过既有运行时读取器找到原始任务及生产单；原始任务引用关联到实际运行实例，范围筛选保留跨单明确引用。不存在对应印染工序、未初始化且无持久化事实时不生成无关专业演示进度；已有事实/保存记录继续按原路径读取。需以专项比对及真实点击证明不漏关系，不以少显示数据换性能。
- 来源质检详情移除外部占位图回退；没有对应素材时显示“对应实图待补”，不修改原数量、SKU或检验结果。该修改不代表素材门禁通过。

最终5构建已切换到同工作树4179，LAN返回200。入口index-B3HAJ7hS.js，DDS production-timeliness-B2M8M2wi.js，shared app-shared-BfYVGEHJ.js；构建8.12秒，64文件哈希与技术日志见 `output/playwright/dds-pf-v4-final5/technical/`。140项本轮专项、5项既有关系读取回归、217条显式关系检查及QC事实检查通过；范围类型0错误、全库61项既有错误。静态列表检查431页通过，治理显式覆盖46个受管文件。物料构建依赖闭包不再包含DDS，直接产物校验通过。

final5完整浏览器报告 `output/playwright/dds-pf-v4-final5/verification.json`：Chromium 149.0.7827.55；27组功能检查通过，7235个DDS原始样本。发现485类控件，其中484类适用入口均至少5次；1类系统物理打印确认按既定范围不适用，预览与取消已测。456个测量场景组均至少5次。无功能错误、无未执行组、无超限样本，最大171.29999999701977ms。依赖箭头、两个具体卡点各自的源单号/摘要/影响、定位、准备与路线Tab、筛选底行及低分辨率、配置校验/保存/发布、跟进与预测、数据事项持久化、专属大图及失败恢复均在当前产物执行。

实际来源跳转另15次，证据 `output/playwright/dds-pf-v4-final5-source-entry/verification.json`：执行详情149.6/138.5/140.6/139.8/140.5ms，QC详情85.5/99.3/99.4/85.2/99.2ms，需求列表96.1/131.5/123.1/118.4/133.1ms。展示值取0.1ms，判定使用原始精度。合并报告 `output/playwright/dds-pf-v4-final5/combined-verification.json` 共7250样本；不将物料模块的独立回归混入该数量。

图片完整性仍失败：已访问的24个款号/名称组合缺对应实图，QC来源也明确待补；该数量不是全库穷尽清单，图片加载成功也不等于款色对应已经确认。完整回归退出1是素材门禁失败，不能隐藏为全通过。第8节业务缺口及第11节77条ACT实施状态继续保留。

缺图去重口径：24个款号/名称组合包含23个不同编码；QC来源把生产单号显示在SKU标签，缺可靠款式身份，单独记录该质检上下文，不能强行合并或宣称共有25个独立缺图对象。

受共享加载归属影响的物料模块独立回归：`output/playwright/dds-pf-v4-final5-material-bridge/verification.json` 及 summary.json，200原始样本、34组、40次冷导航均通过；冷导航最大84.30000001192093ms，交互最大46.900000005960464ms。40次冷导航均未加载DDS专用模块。测量脚本和依赖脚本分别归档并核验哈希，不混入DDS的7250样本。最终64文件清单已复核无源码漂移，证据 technical/source-manifest-recheck.json。
