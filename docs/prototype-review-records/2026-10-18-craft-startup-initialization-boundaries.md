# 加工单冷启动初始化边界修复（发布前冻结记录）

依据 `AGENTS.md` 当前治理基线。

日期：2026-10-18。确认人：Codex 技术验证；不代表用户业务接受。任务 INIT-01～26，T4共享构建/相邻查询优化，叠加T5 main/GitHub/Caddy发布。此文件冻结本轮候选；两轮审查、技术收据和正式后验在独立输出追加，不改写历史版本。

## 需求、继承和范围

继承用户剩余六类逐一修复/核对，再全量、最后两轮实质对抗审查、不降低1000ms、全部通过后main快进/推送/正式部署及线上全量。原18类中三个已正式合并，现16类；原命名清理和单工厂范围保持，旧业务身份不恢复。已有main直接发布授权，不新增PR。

原正式版本f2a5b4e5b0daea7d2accff8efdd4ec95e860cbda / Actions39129092758的131功能场景及三原生回读正确，但95样本有12有效超时、10类、最大1654.3ms，整体失败。原记录、采集器、样本和收据冻结保留。该事实与此前阶段失败均不被新采样覆盖。

## 设计和决策

完整首屏为原模块、数据、行、状态、图片与交互终点。48个JS请求的等待暴露较长冷启动路径，当前修复按实际初始化依赖分组，不删除业务模块，不减少数据、不延迟实际必要内容。

拒绝的诊断：全包48→4会给297个其他入口提前加载业务初始化；17组48→20扩张保护owner；FEI投影捷径改变打揽/激光状态及交接头。这些隔离试验未进入产品。21请求候选虽16逐项及131/95/3通过，五个受影响页面中对账单五次1457.3～1602.4ms；精确重建f2的1186资产全相同，原版对账单五次1443.5～1462ms同样超时。以上有效失败均保留，不据此豁免1秒。

最终选择10个显式组115个已有源模块，实际首屏48→27请求；1432保留模块各一份，main/craft完整静态模块集不变、无新静态SCC。全部560旧chunk根、332实际entry/dynamic目标和25有可观察初始化模块原owner的保护闭包逐项相同。五个最重相关页面完整模块集保持；其他实际入口新增union52，是此前逐项语义审查65个纯声明/固定默认/空容器模块的子集，未增加存储读取、注册或业务事实初始化。实际产品JS2929983→2909110B，完整首屏实际Brotli567063B，不能把隔离预测当最终文件。

配置同时以源模块实际owner保持恢复资源的preload优先级，实际craft静态闭包预生成Brotli Q11。提示仅建立link，不求值业务模块；正式打包仍核对压缩解码与raw相同。

必要相邻修复仅src/data/fcs/store-domain-statement-source-adapter.ts/listStatementBuildScopes：直接用同一批合格流水的分组、数量、金额、周期和日期汇总，取消汇总不用的完整追溯。详细来源行、资格查询、排序、收入/扣款符号、累加精度、首个非空日期语义不变，无新缓存。最小契约先失败再通过；固定时钟相同演示资料的HTML、二次HTML、汇总及二次汇总、完整来源行、流水、交接状态逐项相同。其余所有src文件字节与f2相同。

## 计划及实施位置

1. 冻结原失败/版本；建立所有初始化、实际入口和图清单，隔离候选并拒绝破坏边界方案。
2. vite.config.ts有界分组/实际owner优先级/压缩；adapter仅汇总投影；三项unit覆盖路由提示、分组边界、汇总数值及每次新读。真实writeBundle对物理文件SHA/字节和所有模块关系核对。
3. 六类先逐一五次，再其余十类逐一五次；随后原全量131场景/95样本/36布局/三原生empty/saved/invalid回读，及五相关页面各五次。无并行heavy，无重试/替换。
4. 主代理完整diff正反审查；最终两轮独立对抗审查记录实际输入SHA，发现阻断则修复重验并重新绑定。
5. 六个任务文件冻结后workflow:verify技术收据；重建全部资产与已验版本逐字相同。本地main仅ff、GitHub main全SHA一致，Actions Caddy成功后检查HTTPS deployment.json/fullSHA/run/raw资产/实际响应体，正式重做全131/95/3及相关25样本。所有正式条件通过才写final-delivery.json。

## 环境、终点和存储边界

工作树/分支：/Users/laoer/.codex/worktrees/dfd6/higoods，codex/seam-embroidery-unification；候选基线f2a5，实际源/资产SHA见asset-version.json。本地同树生产预览43185；Chrome155.0.8059.80，Asia/Shanghai，zh-CN，1366×768，布局另1280×720和1024×768。Node本地26.8.2、CI24，锁文件/依赖不变；正式由精确资产映射与实际浏览器再验，不凭本地推断。

每次新合成context，空HTTP缓存，同一完整工厂fixture及原PCS数据，不动原用户IAB/profile/43183，不接测试站数据库。原NavigationStart0、真实root/标题/min(总数,10)行、首屏真实图片snapshot解码、字体、有限动画、双RAF和可交互终点逐字关键块SHA保持。原生导航三例为功能回读，不冒充性能家族。每家族至少5次，每个有效值<=1000ms；不平均、删慢、改终点、减少数据、预热或重试至绿。

业务对象仍由原静态源/IndexedDB及原读写入口负责。未更改持久化/迁移/附件/动作；完整来源查询保留，汇总每次重新读合格流水，失败不落种子、不加保存后备。ordinary owner写和工厂raw均未变；既有PDA角色/用户演示种子不纳入零写声明。未改变财务业务流程或页面布局。

## 原子矩阵

下列证据路径以output/verification/craft-first-screen-preserved-boundary（R8）及output/playwright/craft-first-screen-preserved-boundary（P8）为根。状态是发布前冻结时实际状态；正式完成状态由R8/final-delivery.json逐编号追加。INIT-22～24没有预填通过。

| 编号 | 来源 | 原子需求 | 工作包/实际文件或符号 | 自动化验证 | 页面/性能证据或不适用理由 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INIT-01 | 用户/PERF/相邻影响 | 业务/图片/状态事实保留，既有有效失败不可覆盖 | vite.config.ts；adapter仅等价汇总 | R8/statement-fixture-equivalence.json、prior-stage-binding.json | 源/图片/状态不减；完整页面验收 | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-02 | 用户/PERF/相邻影响 | 不提前加载25个可观察初始化模块，main集合不变 | craftStartupChunkGroups | R8/final-bundle-comparison.json | 560根/332实际/25原owner；构建项无新动作 | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-03 | 用户/PERF/相邻影响 | 保留模块唯一/无新循环、实际文件与提示正确 | manualChunks/preload/compressedPreviewAssets | R8/final-bundle-comparison.json、final-hint-contract.json | 92提示场景、实际raw/br；图片提示不变 | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-04 | 用户/PERF/相邻影响 | 烫画五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-HEAT-TRANSFER | R8/individual-local-status.json | P8/local-v1-aux-op-heat-transfer；最高309.000ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-05 | 用户/PERF/相邻影响 | 布包扣五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-COVERED-BUTTON-MAKING | R8/individual-local-status.json | P8/local-v1-aux-op-covered-button-making；最高270.100ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-06 | 用户/PERF/相邻影响 | 压褶五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-PLEATING | R8/individual-local-status.json | P8/local-v1-aux-op-pleating；最高282.600ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-07 | 用户/PERF/相邻影响 | 打褶五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-GATHERING | R8/individual-local-status.json | P8/local-v1-aux-op-gathering；最高281.000ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-08 | 用户/PERF/相邻影响 | 激光开袋五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/SPC-OP-LASER-POCKET | R8/individual-local-status.json | P8/local-v1-spc-op-laser-pocket；最高288.800ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-09 | 用户/PERF/相邻影响 | 特种车缝（花样机）五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/SPC-OP-PATTERN-MACHINE-SEWING | R8/individual-local-status.json | P8/local-v1-spc-op-pattern-machine-sewing；最高284.000ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-10 | 用户/PERF/相邻影响 | 打揽五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-DALAN | R8/individual-local-status.json | P8/local-v1-aux-op-dalan；最高271.700ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-11 | 用户/PERF/相邻影响 | 打条五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-STRIP | R8/individual-local-status.json | P8/local-v1-aux-op-strip；最高286.400ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-12 | 用户/PERF/相邻影响 | 直喷五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-DIRECT-PRINT | R8/individual-local-status.json | P8/local-v1-aux-op-direct-print；最高259.100ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-13 | 用户/PERF/相邻影响 | 绣花五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-EMBROIDERY | R8/individual-local-status.json | P8/local-v1-aux-op-embroidery；最高286.600ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-14 | 用户/PERF/相邻影响 | 缝边绣五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-SEAM-EMBROIDERY | R8/individual-local-status.json | P8/local-v1-aux-op-seam-embroidery；最高273.300ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-15 | 用户/PERF/相邻影响 | 盘扣五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-BUTTON-LOOP | R8/individual-local-status.json | P8/local-v1-aux-op-button-loop；最高232.400ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-16 | 用户/PERF/相邻影响 | 花朵五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-FLOWER-MAKING | R8/individual-local-status.json | P8/local-v1-aux-op-flower-making；最高276.000ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-17 | 用户/PERF/相邻影响 | 烫钻五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/AUX-OP-HOTFIX-RHINESTONE | R8/individual-local-status.json | P8/local-v1-aux-op-hotfix-rhinestone；最高278.000ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-18 | 用户/PERF/相邻影响 | 模板工序五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/SPC-OP-TEMPLATE-PROCESS | R8/individual-local-status.json | P8/local-v1-spc-op-template-process；最高272.900ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-19 | 用户/PERF/相邻影响 | 橡筋定长切割五次冷启动逐一核对<=1000ms | 原special-craft/task-orders.ts/SPC-OP-ELASTIC-FIXED-LENGTH-CUTTING | R8/individual-local-status.json | P8/local-v1-spc-op-elastic-fixed-length-cutting；最高264.400ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-20 | 用户/PERF/相邻影响 | 全量131场景/95样本/36布局、编辑取消/刷新/滚动图正确 | 原采集器install/ready/sample | R8/full-local-summary.json | P8/local-v1-full；最高280.000ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-21 | 用户/PERF/相邻影响 | empty/saved/invalid原生回读、原资料保留 | 原navigation采集器 | R8/full-local-summary.json | P8/local-v1-full/navigation；普通owner零写 | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-22 | 用户/PERF/相邻影响 | 完整diff正反核对及最后两轮实质独立对抗审查无阻断 | 最终六文件/证据 | R8/root-semantic-review-final.json；两最终round文件待产出 | 独立审查不冒充新页面样本 | 已实现待验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-23 | 用户/PERF/相邻影响 | 冻结收据/main快进/GitHub SHA/Actions Caddy正式发布 | 六文件/发布器 | R8/task-receipt.json、git-publish.json、actions-run.json待产出 | 发布后证据独立追加 | 待实施 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-24 | 用户/PERF/相邻影响 | 正式HTTPS版本/全部raw/实际body/全131/95/3通过 | 正式全量采集器 | R8/formal-evidence-audit.json、final-delivery.json待产出 | P8/formal-<sha>-full；未执行前不声称通过 | 待实施 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-25 | 用户/PERF/相邻影响 | 对账单分组/金额/数量/日期/排序/每次新读等价，详细追溯不变 | adapter/listStatementBuildScopes | R8/statement-scope-green.log、statement-fixture-equivalence.json | 原失败保留；新对账单五次最高575.6ms | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |
| INIT-26 | 用户/PERF/相邻影响 | 五个相关页模块集保持、真实行/统计/图/错误及各五次<=1000ms | 五相关页/27请求分组 | R8/affected-extra-summary.json | P8/affected-extra-local-v1；25样本最高723.1ms；正式仍须25 | 已验证 | R8及具名P8目录，SHA见各binding | Codex/f2a5候选实际资产 |

## 本轮已得结果和后续门禁

11专项、1165全单元、工程类型检查、真实构建、主代理完整diff、实际依赖图与92提示契约通过。16逐项80样本最高309ms；全量95样本最高280ms、131场景/36布局/三原生通过；五相关25样本最高723.1ms，实际响应体含重复均校验，工厂源未变。

两轮最终审查、技术收据、main/GitHub/正式部署和线上全量尚须依顺序执行。任何有效正式超时仍为未完成，不以本地或收据替代。用户业务接受仍未取得。

## 基本信息

- 日期：2026-10-18
- 任务 / 需求编号：INIT-01～26 加工单冷启动初始化边界
- 验证人：Codex

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：共享分包改变冷启动请求和解析开销；相邻对账单汇总取消无关追溯，业务结果逐项等价。此治理记录的最终结论仅覆盖本轮已执行的候选产品技术验收，不关闭尚待审查/收据/发布/正式后验的整体任务。

依据：[AGENTS.md](../../AGENTS.md) 的 SCOPE-02、TRACE-01、PERF-01、EVIDENCE-01、RECEIPT-01、RELEASE-01。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 加工单状态和数量 | 通过 | R8/full-local-summary.json，原131场景及工厂范围一致 |
| 对账单数量与金额精度 | 通过 | R8/statement-fixture-equivalence.json，收入/扣款/日期/排序/再次读取及完整来源行一致 |
| 持久化读取和失败回读 | 通过 | 三原生empty/saved/invalid，工厂原资料及ordinary owner写观察；未新增保存/迁移 |
| 具名设备布局 | 通过 | P8/local-v1-full，1366×768、1280×720、1024×768 |
| 实际对象图片和对应 | 通过 | 原14首屏图提示/实际解码/滚动图，final-hint-contract.json及full-local-summary.json；源图片不变 |
| 图片失败态及大图交互 | 不适用 | 本轮不改图片组件、图片来源或事件，原完整可见图片终点保留；不是新增实物识别流程 |
| PDA原生导航与回读 | 通过 | P8/local-v1-full/navigation 三例，未新增PDA动作；既有角色/用户种子单列边界 |
| 打印结果 | 不适用 | 本轮不改打印源码/映射/数据/打印入口；提示契约覆盖打印路由无新增craft提示 |
| 初始化事实边界 | 通过 | R8/final-bundle-comparison.json，560/332/25保护、main/craft集合及SCC保持 |
| 冷启动性能 | 通过 | 16逐项80、全量95、旁路25样本，每个有效值<=1000ms；所有原失败保留 |

## 最终结论

结论：通过

此结论仅为上述候选产品技术验收，不代表两轮最终审查、T5正式线上后验或用户接受。整体完成须R8/final-delivery.json满足全部门禁。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/store-domain-statement-source-adapter.ts`
- `vite.config.ts`
- `tests/unit/craft-route-preload.test.ts`
- `tests/unit/craft-startup-chunks.test.ts`
- `tests/unit/statement-scope-projection.test.ts`

### 页面证据

- 版本：codex/seam-embroidery-unification / HEAD f2a5b4e5b0daea7d2accff8efdd4ec95e860cbda 加冻结六文件差异，R8/frozen-task-files.json及asset-version.json；同树生产预览43185、Chrome155、Asia/Shanghai、1366×768及1280×720/1024×768。
- 证据：P8各local-v1-工艺ID五冷样本；P8/local-v1-full实际页面/图片/布局/编辑取消/刷新及navigation三例；P8/affected-extra-local-v1五相关页真实行/统计及全部实际body。R8/local-audit.log、extra-local-audit.log绑定原CLI与JSON一致性。

### 性能结论

- 结论：通过
- 依据：原install/ready/sample完成条件关键块逐字哈希不变，所有新合成冷context，每家族五次、每有效值<=1000ms；逐项最高309ms，全量280ms，相关页723.1ms。版本、原值和设备见R8/individual-local-status.json、full-local-summary.json、affected-extra-summary.json。正式性能未执行前无正式通过声明。

### 验证命令

- `npm run typecheck:engineering`：通过
- `npm test`：通过
- `node output/verification/craft-first-screen-preserved-boundary/build-candidate.mjs`：通过
- `python3 output/verification/craft-first-screen-preserved-boundary/compare-final-bundles.py`：通过
- `node output/verification/craft-first-screen-preserved-boundary/check-final-hints.mjs`：通过
- `python3 output/verification/craft-first-screen-preserved-boundary/audit-local.py`：通过
- `python3 output/verification/craft-first-screen-preserved-boundary/audit-extra.py output/playwright/craft-first-screen-preserved-boundary/affected-extra-local-v1`：通过
- `git diff --check`：通过

### 例外

- 无
