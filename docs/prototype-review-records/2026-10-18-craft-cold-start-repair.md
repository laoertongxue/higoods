# 加工单冷启动剩余六类修复

依据 AGENTS.md SCOPE-02、TRACE-01、PERF-01、EVIDENCE-01、RELEASE-01。本记录继承已部署 a8201d56ee73e91d6c6e3b2ad1900e45d95e0486 的 16 类正式加工单、缝边绣唯一命名和单工厂范围，不重写先前冻结报告。阶段为 T4 构建请求调整；T5 发布及正式验收必须后验登记。技术核验人 Codex，不代填用户接受。

## 基本信息

- 日期：2026-10-18
- 任务 / 需求编号：COLD-01～COLD-12
- 验证人：Codex

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：共享辅助模块的网络分包改变；业务／页面／数据源码不变。按 T4 验构建图、相邻来源和所有具名列表，T5 正式另外验收。

## 需求、边界与事实

用户要求剩余六类逐一修复、逐一核对，再全量核对和两轮实质对抗审查；全部通过后合并 main、推送 GitHub、正式部署，并全量核对线上版本和页面。每个有效样本必须 <=1000ms，不降低标准、不删慢样、不减业务数据、不预热冒充冷态。

原正式失败保存在 `output/playwright/craft-list-baseline-priority/formal-a8201d56/result.json`：烫画 1358ms、布包扣 1046.2000000476837ms、压褶 1074.8999999761581ms、打褶 1098ms、激光开袋 1139.8999999761581ms、特种车缝（花样机）1028.7000000476837ms。原 131 个功能场景通过与这六个性能失败分别成立。本轮新样本不能改写原结果。

实际产物依赖图与 dist 的 577 个生成文件逐字一致。六类首屏同为 60 个 JS 资源、解码约 2.94MB；其中八个辅助叶子文件合计 13239 字节，七个无运行时依赖，列表展示辅助仅依赖已加载的 app-shared。该事实支持缩减小文件请求，不能保证网络完成顺序或预先证明性能通过。

诊断排除了两种未采用方案：最高 Brotli 仅节约约 1.6KB；预加载 60 缩为 18 的候选完成更慢。布局包含实验没有明确收益，亦未写入产品。诊断原件单独保留，不作验收，不替换旧慢样。未接触原用户浏览器、43183、原用户存储或测试站数据库。

本轮只将上述八个已存在、各类列表均使用的辅助模块归入一个 `craft-display-support` 构建产物。模块代码、导出、身份及数据源不变；不合并业务 owner、主入口或初始化闭包。其他消费者最多增加这一个小辅助包的代码，须以实际构建逐入口比较上限和依赖，禁止引入执行域、循环或额外业务初始化。

业务对象登记：加工单、仓库、交接、能力和 PCS 资料继续使用原静态源／IndexedDB 及原读写入口；本次不改来源、数量、状态、保存、附件、迁移或删除，不新增存储。工厂旧资料冲突恢复和普通读取零业务写入仍须通过原生导航回归。真实对象图、滚动、详情及列管理保持；不新增 PDA／打印能力，其业务动作代码不变，复用原版本契约并跑直接相邻检查。

## 执行计划

1. 核对旧失败、构建图及正常／边界诊断，登记本范围；不采用未显示收益的方案。
2. 仅调整八个叶子模块的分包；实际产物比较全部源模块保留、首屏请求减少、main 初始依赖保持、其他入口体积增加有界、没有新增循环。运行相邻契约、适用治理和生产构建。
3. 逐一运行六类，每类五个全新隔离上下文，核对内容／数量／真实可见图／工厂源／错误和每个值 <=1000ms，上一类通过后才进入下一类。共同分包修复不冒称六套重复实现。
4. 全 16 类及总览／工厂资料／刷新，19 性能族各五次，加 36 个布局场景，及工厂编辑取消回读、滚动图片、三种 empty／saved／invalid 原生导航。具名设备 1366×768、1280×720、1024×768。
5. 主代理完整 diff 双向追踪，再由同一时刻最多一位独立审查者分别执行两轮实质对抗审查，处理所有阻断；冻结报告和技术收据后才快进 main／推送。
6. 等待 Caddy Production Actions 成功；核对完整 SHA、run_id、实际全部 raw 资产和前后部署清单。正式运行同一全量套件和原生导航，全部通过才关闭本任务；任何有效超时继续实施，保持原证据。

## 原子矩阵

| 编号 | 来源 | 可独立判定结果 | 工作包／实际位置 | 自动化验证 | 页面／性能证据 | 状态 | 证据位置 | 确认人／版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COLD-01 | 诊断／范围 | 八个叶子模块合为单请求，完整来源和初始化保持 | vite.config.ts / manualChunks | 实际构建图、源字节及相邻契约 | 未改变业务动作，不新增读写 | 已验证 | output/verification/craft-cold-start-repair | Codex，a820+本任务差异 |
| COLD-02 | 共享影响 | main 不增业务图、其他消费者新增有界且无新循环 | 同上 | 全入口静态闭包差异与体积 | 相邻入口原生导航 | 已验证 | 同上 | 同上 |
| COLD-03 | 用户 | 烫画五个冷样本及页面全部通过 | 原列表 owner，构建修复 | 单类套件 | 1366×768，<=1000ms | 已验证 | output/playwright/craft-cold-start-repair | 同上 |
| COLD-04 | 用户 | 布包扣五个冷样本及页面全部通过 | 同上 | 单类套件 | 同上 | 已验证 | 同上 | 同上 |
| COLD-05 | 用户 | 压褶五个冷样本及页面全部通过 | 同上 | 单类套件 | 同上 | 已验证 | 同上 | 同上 |
| COLD-06 | 用户 | 打褶五个冷样本及页面全部通过 | 同上 | 单类套件 | 同上 | 已验证 | 同上 | 同上 |
| COLD-07 | 用户 | 激光开袋五个冷样本及页面全部通过 | 同上 | 单类套件 | 同上 | 已验证 | 同上 | 同上 |
| COLD-08 | 用户 | 特种车缝（花样机）五个冷样本及页面全部通过 | 同上 | 单类套件 | 同上 | 已验证 | 同上 | 同上 |
| COLD-09 | 全量／UI-01 | 全 16 类及相邻 131 场景、95 性能样本通过 | 全量套件 | 19族五样本，36布局 | 具名三种设备，真实对象图 | 已验证 | 同上 | 同上 |
| COLD-10 | STORE／异常 | 原生 empty／saved／invalid 导航、取消／刷新、来源不变及读取失败恢复 | 原 owner／三原生用例 | 原逻辑不变契约 | 实际总览→侧栏→列表→详情／刷新 | 已验证 | 同上 | 同上 |
| COLD-11 | 用户 | 两轮实质审查及封印／收据通过 | 最终完整差异与证据 | 分轮记录，不用脚本代替语义审查 | 不适用新业务动作 | 已实现待验证 | output/verification/craft-cold-start-repair | 同上 |
| COLD-12 | 用户／RELEASE | main／GitHub／Production 同版，正式全量页面和性能全部通过 | 后续 T5 | SHA／run／raw资产及全部套件 | 正式 HTTPS 全量及原生回读 | 待实施 | 后验 final-delivery.json | 同上 |

## 验收终点与证据

沿用原 v5 可执行 `install`、`ready`、`sample` 函数原文并校验哈希：NavigationStart 为 0；应用前 MutationObserver 检查真实 root、标题、总数、实际当前页 min(总数,10) 行，初始可见图片 snapshot 解码、字体、有限动画和双 RAF 后可交互。没有采用 locator 轮询作为终点。所有失败原样保留，重复修复使用新目录，不覆盖旧样本。原完整采集器及本轮生成器、runner 和结果均在证据目录；local 明确非正式，formal 必填本次完整 SHA／run 并前后核验。

当前结论：本地产品阶段与两轮实质审查通过，0阻断。COLD-01～10已验证；COLD-11最终文档增量封印及冻结收据，以及COLD-12正式T5仍由独立交付附录后验关闭。整体任务尚未完成，此前有效慢样仍保持失败。



## 全量对象清单与本地核对

以下为合并后的全部 16 类，不再使用原合并前数量作为当前对象数量。此表是本地 43185 的结果，不冒称正式 HTTPS 达标；正式须使用本次 SHA 重新执行全量。每类实际总数／当页行数、对象图、单工厂范围、来源不变、无运行错误均已核对。

| 序号 | 加工单 | 当前总数 | 首屏行数 | 全量五次冷启动最大值 ms | 状态 |
| --- | --- | --- | --- | --- | --- |
| 1 | 打揽 | 9 | 9 | 285.10000002384186 | 已验证（本地） |
| 2 | 打条 | 9 | 9 | 269.5 | 已验证（本地） |
| 3 | 烫画 | 9 | 9 | 248.29999995231628 | 已验证（本地） |
| 4 | 直喷 | 9 | 9 | 247.60000002384186 | 已验证（本地） |
| 5 | 布包扣 | 9 | 9 | 269 | 已验证（本地） |
| 6 | 绣花 | 18 | 10 | 285.7999999523163 | 已验证（本地） |
| 7 | 压褶 | 9 | 9 | 266.2999999523163 | 已验证（本地） |
| 8 | 缝边绣 | 22 | 10 | 299.60000002384186 | 已验证（本地） |
| 9 | 盘扣 | 1 | 1 | 238.5 | 已验证（本地） |
| 10 | 花朵 | 9 | 9 | 283.7000000476837 | 已验证（本地） |
| 11 | 打褶 | 9 | 9 | 304.6999999284744 | 已验证（本地） |
| 12 | 烫钻 | 9 | 9 | 269.89999997615814 | 已验证（本地） |
| 13 | 模板工序 | 9 | 9 | 273.60000002384186 | 已验证（本地） |
| 14 | 激光开袋 | 9 | 9 | 289.09999990463257 | 已验证（本地） |
| 15 | 特种车缝（花样机） | 9 | 9 | 279.09999990463257 | 已验证（本地） |
| 16 | 橡筋定长切割 | 9 | 9 | 253.60000002384186 | 已验证（本地） |

六类专项按烫画→布包扣→压褶→打褶→激光开袋→特种车缝逐类执行、逐类读取结果后才进入下一类；每类五个有效冷样本，共 30，最大 310.6999999284744ms，全部 <=1000ms。`six-local-status.json` 绑定六份原件和起止时间。随后全量单独新采 95 个性能样本，最大 304.6999999284744ms；131 个主场景加三条原生路径均通过，没有复用六类样本凑数。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 完整数据与模块来源 | 通过 | bundle-comparison.json：2833源模块图完全相同，573旧chunk逐个比较，无丢失；列表静态模块集合完全相同 |
| 首屏请求与相邻负担 | 通过 | 实际列表JS60→53；pack13348字节／br4678；主入口静态模块不变，其他入口最大增加12532解码字节，pack仅依赖原主入口闭包，无新增循环 |
| 数量／状态／权限／保存 | 通过 | 1386源输入仅vite配置不同；原owner、初始化、数量、事件与存储源码字节保持；1161单测通过，原生回读通过 |
| 逐类冷启动 | 通过 | six-local-status.json，六类按顺序30个独立有效样本，原始值全部保留 |
| 全量页面／布局 | 通过 | local-support-v1-full/result.json，131场景；36个1280／1024布局，1366首屏，无文档溢出，单工厂、数量和实际资源一致 |
| 图片／取消／刷新 | 通过 | 对应商品／物料真实图decode，1024压褶滚动图可见；工厂编辑三类能力保留、取消不写、刷新回读 |
| 异常与存量来源 | 通过 | navigation/result.json，empty／saved／invalid三条实际总览→侧栏→列表→详情／刷新；原owner读取保存标记，失败保留原件、夹具修复后reload恢复 |
| 本地完整性能 | 通过 | 19族各5原值，95值全部<=1000；不同冷／刷新与36布局分开，无平均或舍弃慢样 |
| PDA／打印新动作 | 不适用 | 本阶段只有既有叶子辅助分包，无动作、数量、状态、图片或打印模板变化，源文件保持，直接相邻单测与原生页面回归；不声称新增跨端能力 |
| 两轮实质审查 | 通过 | R1绑定65份、R2独立绑定89份原件，均0阻断；最后文档增量封印／冻结技术收据独立后验 |

## 最终结论

结论：通过

结论范围仅为COLD-01～10与COLD-11两轮实质审查构成的本地产品阶段。COLD-11剩余文档增量封印／冻结收据，以及COLD-12正式发布和全量HTTPS验收，由独立output/verification/craft-cold-start-repair/final-delivery.json按实际后验关闭；本报告不提前声明整体交付。新正式未通过时任务仍未完成，原a820六个有效慢样保持失败。

## 变更覆盖与验证

### 受管文件

- `vite.config.ts`
- `docs/prototype-review-records/2026-10-18-craft-cold-start-repair.md`

### 页面证据

- 版本：codex/seam-embroidery-unification，HEAD a8201d56ee73e91d6c6e3b2ad1900e45d95e0486 加本任务13行构建差异；工作树 /Users/laoer/.codex/worktrees/dfd6/higoods，自有生产预览 http://127.0.0.1:43185。Node26.8.2、Chromium155.0.8059.80，Asia/Shanghai、zh-CN，无CPU／网络降速。asset-version.json绑定1386源输入／1201产物，index.html SHA887dbabc596ffde19e91ed6c6bcbdc304a823fd0f65bf5627f4237514c3bea16。
- 证据：output/playwright/craft-cold-start-repair/local-support-v1-<六类>/result.json 和 local-support-v1-full/{result.json,navigation/result.json}，各原CLI日志、脚本、不可覆盖plan／runner-status。全量77个实际response.body字节均匹配构建；工厂能力取消刷新和滚动真实图通过。原生ordinary owner0写／factoryraw保持，既有PDA角色／用户种子保持，不能扩张为全部localStorage零写。
- 真实图来源、放大交互与原owner完全相同；旧交互证据保留原版本，不冒称在新版本重复了未变动作。本轮实际验证首屏／滚动图片decode和全部具名列表布局；未触及测试站数据库或原用户浏览器。

### 性能结论

- 结论：通过
- 依据：仅本地T4：专项30及随后独立全量95全部有效值<=1000ms，起点／终点与原v5逐字相同。前述原正式六个慢样保留失败；本地正常值不证明正式HTTPS通过，新正式另验。没有数据删减、先预热、挑选新值替换旧值或布局占位变更。

### 验证命令

- `npm run typecheck:engineering`：通过
- `npm test`：通过
- `node output/verification/craft-cold-start-repair/build-candidate.mjs`：通过
- `python3 output/verification/craft-cold-start-repair/compare-bundles.py`：通过
- `python3 output/verification/craft-cold-start-repair/run-verification.py --out output/playwright/craft-cold-start-repair/local-support-v1-heat-transfer`：通过
- `python3 output/verification/craft-cold-start-repair/run-verification.py --out output/playwright/craft-cold-start-repair/local-support-v1-covered-button`：通过
- `python3 output/verification/craft-cold-start-repair/run-verification.py --out output/playwright/craft-cold-start-repair/local-support-v1-pleating`：通过
- `python3 output/verification/craft-cold-start-repair/run-verification.py --out output/playwright/craft-cold-start-repair/local-support-v1-gathering`：通过
- `python3 output/verification/craft-cold-start-repair/run-verification.py --out output/playwright/craft-cold-start-repair/local-support-v1-laser-pocket`：通过
- `python3 output/verification/craft-cold-start-repair/run-verification.py --out output/playwright/craft-cold-start-repair/local-support-v1-pattern-machine`：通过
- `python3 output/verification/craft-cold-start-repair/run-verification.py --out output/playwright/craft-cold-start-repair/local-support-v1-full`：通过
- `git diff --check`：通过

构建命令在typecheck和1161单测通过后使用Vite真实配置write:true，仅追加generateBundle只读观察器记录图，没有改bundle／输出或跳过插件。后续正式冻结收据的npm run build必须再次逐字核对产物，不以观察器构建替代CI。独立旁路只生成验证工具，不修改产品源码、不运行采样；主代理审查了新工具与原install／ready／sample块逐字一致及无复用样本。所有诊断取舍和首次CSS实验嵌入旧payload的无效准备均在diagnostic-disposition.json登记，未用于验收。

### 例外

- 无性能豁免。任何新正式有效超时均保留并继续修复，不能因先前发布成功或本地通过称完成。

第一轮独立实质审查：`adversarial-round-1.json`，SHA256 47704554b7ddf8d85a5f15a71c3c3a0623543e7d2a2183b9548debe7e75d842f，0阻断，通过。审查了13行产品差异、8源码、65原件、全模块不重不丢、单例／新增循环／邻页负担、所有原CLI深度同一和旧失败保留；此段保留第一轮原审查身份；不据此提前声明正式通过。

第二轮独立实质审查：`adversarial-round-2.json`，SHA256 534907e0f42c9a6a28a64d6132fa19fc1320db89e4a1bec6c6b6db6dc12d9c4f，0阻断，通过。独立绑定89份原件，重算所有CLI／结果／plan及1386源／1201产物、两实际图、125本地性能样本、131主场景／native3、旧正式六慢样及终点保持；审查最终交付闸门但未执行。最终仅文档结果段增量封印与冻结技术收据后验，不回写已冻结本报告。
