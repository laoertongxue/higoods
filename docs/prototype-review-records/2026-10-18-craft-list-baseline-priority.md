# 工艺加工单必要基线请求优先级调整

依据AGENTS.md的SCOPE-02、TRACE-01、REVIEW-01、PERF-01、EVIDENCE-01和RELEASE-01；使用docs/prototype-review-record-template.md。

## 基本信息

- 日期：2026-10-18
- 任务 / 需求编号：CAP-PRIO-01～CAP-PRIO-06
- 验证人：Codex；技术验证不代填用户接受
- 阶段：T4预加载顺序调整；T5正式发布和全量验收由独立交付附录后验登记。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：16类列表所需数据的网络请求优先级与顺序改变；初始化求值及业务契约保持。

## 范围、事实与计划

本记录属于既有辅助/特种加工单正式交付的后续性能修复，基准为163c6354cc704cbef12a71200086f1194fbb82ff。原能力编号误冲突已修复并发布；此阶段只调整16类标准加工单列表HTML预加载的必要PCS基线请求顺序和优先级，不改变页面、初始化求值、业务来源、保存、数量、动作、权限或详情。原测试站数据库与用户浏览器资料均不触及。

正式163版本的直喷第1次冷入口为1189.2999999523163ms，页面/图片/内容/工厂来源和运行错误检查均通过，但性能失败；原件保存在output/playwright/craft-list-owner-isolation/formal-163c6354/result.json。该样本必要JS直到约907～972ms接收完成，PCS基线约982ms才接收完成。这里只确认请求晚完成，不能据此断言具体网络、丢包或优先级根因。已有构建将必要基线fetch排在全部模块与图片预加载之后，且该基线没有高优先级；本阶段做受限的加载顺序调整并用同一完成终点验证实际效果，不以该假设直接声称达标。

1. 对实际Vite函数生成的脚本建立失败契约：16类列表各含/不含尾斜线，必要基线第1个请求链接且high，唯一；详情/毛织/相邻保持原链接输出。
2. 仅16类LIST启用必要基线提前及high。模块静态闭包、图片、基线字节、anonymous CORS和缺基线行为保留。预加载不求值模块、不访问业务存储。
3. 跑相邻初始化/能力/路由/预加载契约、构建；本地同版本页面、原生存量和适用性能验证。正式旧有效失败全部保留。
4. 两轮实质对抗审查、文档冻结及技术收据后，按既有授权快进main并推送部署，核对完整SHA/run/运行资产和全部正式页面、同终点性能。技术验证不代替用户接受。

## 原子矩阵

| 需求编号 | 来源 | 原子需求 | 工作包 | 实际文件/符号 | 自动化验证 | 页面/性能证据 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CAP-PRIO-01 | 原正式慢样及源码 | 16类LIST必要基线第1个请求链接且high，仅一次 | 预加载 | vite.config.ts / preloadStaticFirstScreenRoutes | 实际生成脚本契约 | 必要数据不减量、同终点采样 | 已验证 | output/verification/craft-list-baseline-priority | Codex，163+本任务差异 |
| CAP-PRIO-02 | 范围与数据保护 | 模块/图片/字节/初始化与业务读写不改变 | 边界 | 同上及原owner/guard/main | 原相邻契约、副作用反例 | 原生存量真实导航、回读 | 已验证 | 同上 | 同上 |
| CAP-PRIO-03 | 范围 | 详情/毛织/未知/嵌套/相邻入口链接输出和顺序保持 | 边界 | 同上 | 正反例及旧实际脚本输出比较 | 不适用业务动作变更 | 已验证 | 同上 | 同上 |
| CAP-PRIO-04 | UI-01/PERF-01 | 本地具名设备、页面及每家族5有效样本通过 | 验证 | 16列表及相邻入口 | 版本与真实资源核对 | 同原v5终点，不删慢样 | 已验证 | output/playwright/craft-list-baseline-priority | 同上 |
| CAP-PRIO-05 | 用户两轮要求 | 两轮审查、文档冻结和技术收据通过 | 审查 | 本次3路径 | 完整diff/证据/反例 | 后验登记，不预填 | 已实现待验证 | output/verification/craft-list-baseline-priority | 同上 |
| CAP-PRIO-06 | 用户发布要求 | main/GitHub/Caddy同版及正式全量核对通过 | T5 | 后续发布 | SHA/run/资产字节 | 全16类与适用性能 | 待实施 | final-delivery.json后验登记 | 同上 |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 限定预加载差异 | 通过 | red1失败/6通过，green27通过；32LIST仅前移+high，57其他路由所有链接和顺序相同 |
| 来源及异常恢复 | 通过 | navigation-local/result.json三种原生存量真实总览→侧栏列表→刷新；普通owner0写、factoryraw保持；invalid拦截且原生修复后reload恢复 |
| 页面/图片/布局 | 通过 | local/result.json131场景，36个1280/1024布局；真实可见图decode、工厂单维度、数量和图片滚动通过；主代理查看1366/1024列表及工厂编辑器截图 |
| 取消与持久回读 | 通过 | 工厂编辑器缝边绣/模板/普通能力选中；取消不写、刷新源不变 |
| 本地适用性能 | 通过 | 19家族各5原样本共95，最大312.39999997615814ms；无删慢样、预热或终点变化 |
| 数量/金额/PDA/打印动作 | 不适用 | 运行差异仅HTML预加载，无owner/事件/业务源/动作变更；必要初始化和原handler保持 |
| 两轮实质审查 | 通过 | R1/R2均通过0未关闭，R2独立核46件原件；最后文档封印/冻结收据独立后验 |

## 最终结论

结论：通过

结论范围为CAP-PRIO-01～04与05双轮实质审查构成的T4产品阶段，本地完整验证和两轮审查均已通过。CAP-PRIO-05剩余最终文档封印/冻结技术收据，以及CAP-PRIO-06新正式T5发布与全量性能，均由独立final-delivery.json按实际后验关闭；本记录不提前声明这些结果或完整交付。旧163正式仍有12有效慢样/最大1588.9ms，保持失败；新正式未通过时原全量任务仍未完成。

## 变更覆盖与验证

### 受管文件

- `vite.config.ts`
- `tests/unit/craft-route-preload.test.ts`
- `docs/prototype-review-records/2026-10-18-craft-list-baseline-priority.md`

### 页面证据

- 版本：codex/seam-embroidery-unification，HEAD163c6354cc704cbef12a71200086f1194fbb82ff加本次3路径差异；同工作树生产预览http://127.0.0.1:43185，Node26.8.2、Chromium155.0.8059.80、Asia/Shanghai、zh-CN，无CPU/网络降速。asset-version.json绑定1386源/1220产物，index.html SHA256为b33155f1b5ca83637a9e9c17f06c2f4022189cde8261ea3027379f1e4cefbed7；相对原163仅index.html不同，其余1219产物字节一致。
- 证据：output/playwright/craft-list-baseline-priority/local/result.json及collector.log实际131场景、95样本、84真实response.body资源哈希全部通过；16列表标题/总数/当页行数、单工厂、可见图decode、可交互和布局无溢出，页面/请求/控制台错误均0。工厂编辑器既有三类能力保留、取消无工厂源写、刷新回读一致。1024压褶滚动后真实对象图可见解码成功。
- 原生数据：navigation-local/result.json三案例通过；实际总览→现有侧栏进入列表，empty/saved/invalid以及reload恢复。保存标记INIT-EFFECTS-READ-001由原owner读取；没有手动import恢复状态。ordinary owner0写、factoryraw均不变；既有PDA角色/用户种子保持，不能扩张为全部localStorage零写。异常夹具修复仅在自造setup文档进行，再真实reload；原页没有重读按钮，未虚构该动作。
- 本阶段只改变请求提示；真实图片来源、放大交互、内容/动作代码与163逐字一致，原大图交互证据保持原版本；新版本首屏/滚动真实图片decode和布局实际重验，不宣称重测未变图片动作。无用户原浏览器或测试站数据库读取/写入。

### 性能结论

- 结论：通过
- 依据：本地19家族各5有效值，共95，最大312.39999997615814ms；完整值在local/result.json。冷入口16类分别家族，总览/档案冷入口和总览刷新分开；36布局不冒充性能重复。新正式由独立T5附录后验，原163的131场景/95值中12慢样保持原false。
- 终点：复用已核读原v5可执行后缀，只更新config/manifest/路径。导航起点0；应用前安装页面MutationObserver，真实标题/root/数量、必要可见图片decode、fonts.ready、有限动画、两帧绘制且可交互完成。无locator轮询代替，无减数据、预热、平均或删慢样。新正式预备模板沿用已审exact-performance-only继续逻辑以完成所有功能覆盖，1000门槛、raw失败、families/final判断保留，任何其他错误仍停止；新配置禁止复用任何旧样本，必须新SHA/run/实际资源及前后manifest同版。

### 验证命令

- `node --import tsx --test tests/unit/craft-direct-route.test.ts tests/unit/craft-route-preload.test.ts tests/unit/craft-entry-initialization.test.ts tests/unit/seam-factory-capability-migration.test.ts`：通过
- `node --import tsx output/verification/craft-list-baseline-priority/compare-preload-outputs.ts`：通过
- `npm run build`：通过
- `git diff --check`：通过
- `playwright-cli -s=craft-prio-local run-code --filename output/playwright/craft-list-baseline-priority/collector-local.js`：通过
- `playwright-cli -s=craft-prio-local run-code --filename output/playwright/craft-list-baseline-priority/navigation-local.js`：通过

red-contract.log实际1失败/6通过；green-contract.log27通过，build.log1161通过0失败、Vite21.14s。preload-output-parity.json与compare工具分别绑定旧163实际Vite函数和当前输出，32列表仅baseline前移+high、57其他全字段/顺序相同。asset-version固定完整构建；provenance记录采集器config以外后缀原样、不复用样本。初次准备误读COLLECTOR_CONFIG占位模板在写采集器前报JSON解析错误，已改用原已运行实际collector配置，未执行无效采样或覆写证据。

第一轮adversarial-round-1.json通过0未关闭，SHA e4bcc02bf4f4f3c3ee442304aa39281e774e8b643902587328230dded7fb9857。审查范围为3路径代码与计划报告当时快照，机械逆改三处可还原整个旧Vite文件，11必要数据/路由/owner/handler与163字节一致；未替代新页面或第二轮。第二轮adversarial-round-2.json已通过0阻断，SHA 7e2b32e04ae9499520c6dc321976dcc1a33f126aa1988d1185254e69a38459bf，独立绑定46件原件及本报告审查快照；确认真实131/95/84body/3原生导航、全部1386源/1220产物及旧失败保持。新正式模板也经本轮审查，首位只是生成链接顺序，不保证网络完成次序。最终文档增量封印adversarial-round-2-document-seal.json及workflow:verify实际后验，尚未运行时不预填通过。冻结报告后结果写独立output/verification/craft-list-baseline-priority/final-delivery.json，不回写已绑定文档。

### 例外

- 无性能豁免；原163的12有效慢样和更早1158.1/1257.1ms仍保留原身份。新正式未通过时不宣称完成；独立测试环境只使用自造资料，原43183用户标签未访问。
