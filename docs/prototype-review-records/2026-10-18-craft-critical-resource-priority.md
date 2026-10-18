# 加工单冷启动资源修复第二阶段

## 基本信息

- 日期：2026-10-18
- 任务 / 需求编号：CRIT-01～CRIT-24
- 验证人：Codex

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：T4 构建资源提示和候选小模块分包；T5 后验发布。继承用户剩余六类、逐一核对、全量与两轮实质对抗审查、正式部署后全量要求。技术验证不代替用户接受。

## 需求、事实与范围

用户要求不降低 <=1000ms 标准，所有有效超时保留失败。基准是正式 06488e802f16e77fae85e35fb49324ed533903bb / Actions 39125440935。上一阶段本地通过、两轮审查通过及部署成功，与正式性能失败分别成立。正式 131 场景中功能通过，95 样本有20个有效超时，涉及11类、最大2215.2000000476837ms；原件 output/playwright/craft-cold-start-repair/formal-06488e80-full/result.json 与冻结报告不覆盖。

独立时序审计确认：首屏53个JS、压缩592007B；PDA在HTML完成后2.2～20.1ms已发起，17/20失败中它是末尾JS，不属于晚发现。一次连接本身1197.2ms仍为有效失败，页面优化无法挽回该既有样本。优先级30次配对诊断收益混合，因此不采用PDA优先级改动。

缺失首屏图是真实边界：布包扣的accessory-elastic-band、打褶的tee-red由DOM后才发现；橡筋定长切割也实际显示前者。原全部列表统一预载8图，多数首屏只需1图。候选仅按16路由已验证真实首屏图提示，图片元素、来源、分页、总数、滚动、解码终点和加载逻辑不变。非首屏图照常由原页面加载，不删数据或图片。其他路由仍用原提示。

旁路仅读实际构建图评估小辅助模块合包；只有main闭包不变、其他入口体积增加有界、无新循环、模块顶层无业务初始化且实际构建成立才采用。未采用方案与诊断保留，不能当验收。页面与业务源码、业务owner、存储、迁移、保存、附件、PDA/打印动作均不改。工厂单一范围、缝边绣唯一命名继承现行实现，不新增工厂Tab。不得接触原用户资料、43183或测试站数据库；本地仅同工作树生产预览43185，新合成上下文。

## 执行计划

1. 冻结正式20失败及30+6诊断，登记图片映射、实际资源图和基准；诊断不替换失败。
2. 修改vite.config.ts仅资源发现/分包；先验证真实图片提示与全入口不越界、完整模块保留/无新增循环/数据源码不变，运行适用构建和相邻契约。
3. 原六类顺序各五次，通过一个才下一个；再逐一核对其余10类，全部16类列表核对图片、标题、总数、行数、源数据不变、无多工厂Tab/运行错误及每值<=1000ms。
4. 全量131场景、19族95性能样本、36布局和三原生empty/saved/invalid导航回读。1366×768、1280×720、1024×768；保留编辑取消、刷新和滚动图片。
5. 主代理完整差异正反核对，再分别两轮独立实质对抗审查，修复全部阻断；冻结任务文档/源码后生成收据。
6. 本地main快进、GitHubmain精确SHA一致，Actions Caddy成功、HTTPS deployment.json SHA/run及全部raw资产匹配，正式全量同终点重验。任何有效失败继续实施，不生成通过交付附录。

## 原子矩阵

| 编号 | 来源 | 原子需求 | 工作包 / 实际位置 | 自动化验证 | 页面 / 性能证据 | 状态 | 证据位置 | 确认人 / 版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CRIT-01 | 诊断/图片 | 16列表只提示其真实首屏图，补齐缺失图，其余入口提示保持 | vite.config.ts / preloadStaticFirstScreenRoutes | 实际构建HTML逐路由提示契约 | 不删DOM/数据/图片解码条件 | 已验证 | output/verification/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-02 | 共享构建 | 安全小模块合包有实际请求收益、main闭包不变、其他增量有界、无新循环 | vite.config.ts / manualChunks | 实际全模块/所有旧chunk闭包比较 | 相关原生导航 | 已验证 | 同上 | 同上 |
| CRIT-03 | 用户逐项核对 | 盘扣（aux-op-button-loop）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-04 | 用户逐项核对 | 布包扣（aux-op-covered-button-making）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-05 | 用户逐项核对 | 打揽（aux-op-dalan）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-06 | 用户逐项核对 | 直喷（aux-op-direct-print）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-07 | 用户逐项核对 | 绣花（aux-op-embroidery）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-08 | 用户逐项核对 | 花朵（aux-op-flower-making）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-09 | 用户逐项核对 | 打褶（aux-op-gathering）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-10 | 用户逐项核对 | 烫画（aux-op-heat-transfer）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-11 | 用户逐项核对 | 烫钻（aux-op-hotfix-rhinestone）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-12 | 用户逐项核对 | 压褶（aux-op-pleating）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-13 | 用户逐项核对 | 缝边绣（aux-op-seam-embroidery）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-14 | 用户逐项核对 | 打条（aux-op-strip）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-15 | 用户逐项核对 | 橡筋定长切割（spc-op-elastic-fixed-length-cutting）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-16 | 用户逐项核对 | 激光开袋（spc-op-laser-pocket）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-17 | 用户逐项核对 | 特种车缝（花样机）（spc-op-pattern-machine-sewing）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-18 | 用户逐项核对 | 模板工序（spc-op-template-process）五次冷启动及页面内容均通过 | 原列表 / vite.config.ts 资源提示 | 每个有效值 <=1000ms，原终点 | 1366×768，新隔离上下文 | 已验证 | output/playwright/craft-critical-resource-priority | Codex，06488+任务差异 |
| CRIT-19 | 用户全量 | 全131场景、95性能及36布局通过 | 原完整套件 | 19族各五样本 | 三种具名设备/真实图片 | 已验证 | 同上 | 同上 |
| CRIT-20 | STORE/异常 | empty/saved/invalid原生导航、持久原源保留、无新增业务写 | 原三个导航用例 | 原生回读/预期异常 | 实际入口/刷新/详情/编辑取消 | 已验证 | 同上 | 同上 |
| CRIT-21 | 用户审查 | 第一轮实质对抗审查无阻断 | 最终完整任务差异 | 独立审查原件 | 不适用新业务动作 | 待实施 | output/verification/craft-critical-resource-priority/adversarial-final-round-1.json | 同上 |
| CRIT-22 | 用户审查 | 第二轮实质对抗审查无阻断 | 同上 | 独立审查原件 | 同上 | 待实施 | 同目录/adversarial-final-round-2.json | 同上 |
| CRIT-23 | 收据/发布 | 冻结文件、技术收据、main/GitHub/Actions/正式资产精确一致 | 后验交付工具 | 完整SHA/run/raw哈希 | HTTPS正式域名 | 待实施 | 同目录/final-delivery.json | 同上 |
| CRIT-24 | 用户正式全量 | 正式全量页面、95性能及三原生用例均通过 | 同一不可变采集器 | <=1000ms每有效样本 | 正式HTTPS具名设备 | 待实施 | 同目录/final-delivery.json | 同上 |

## 验收终点及证据

沿用不可变a820采集器install、ready、sample函数并逐字哈希核对：NavigationStart为0，真实标题/root/当前页min(总数,10)行、初始可见图片snapshot解码、字体、有限动画与双RAF后可交互。每次新隔离上下文、不预热。全量选项及全部16单类选项只决定覆盖，不改阈值/终点/数据。首次新目录且拒绝覆盖/复用样本；正式必填完整SHA与run，前后独立元数据及实际资源体哈希一致。

当前阶段：CRIT-01～20本地验证通过；CRIT-21～24等待两轮实质审查、冻结收据及正式T5证据。整体任务尚未完成，旧阶段失败保持原版本身份。

## 实施范围与初次失败

实际任务文件为 vite.config.ts、tests/unit/craft-route-preload.test.ts、本记录。四组共20个原模块完整移动：既有craft-display-support八个模块加fcs-route-links及PCS成本pricing/optional-cleanup；task-generation-boundaries/cutting-task-routing/machine-associations；mobile/task-handover-domain；sewing-delivery-sla与原sewing-return-policy-shared三模块。它们顶层只有声明、静态常量、纯里程碑计算及空Map/WeakMap，不执行业务读取/清理/安装回调。状态模块仍唯一，实际构建须证明不复制、不丢失、不增加循环。预测53→48不是验收结果。

初次npm test保留在unit.log：1160通过/1失败。失败是原图片测试要求打揽预载全部8图，与已确认当前仅自身首屏图的目标冲突。更新同一测试核对打揽1图、布包扣/橡筋2图、打褶红图、全部16类1～2图有实文件且无重复，并保留详情8图、不可求值/访问存储与未知路由隔离断言。未删除测试或降低性能阈值；修正后另存unit-v2.log。

## 本地逐项与全量结果（非正式）

类型检查通过。修正旧图片断言后1161项单测全部通过，build-v2-status.json通过。实际构建2833源模块节点图完全相同、1432个JS输出模块各一次，565个最终旧JS chunk根及动态消费者全部比较，无丢失/新增业务模块或新增SCC。main静态模块集不变；列表静态闭包51→46，加相同两个实际恢复入口后JS53→48。其他入口最终写盘口径最坏增加14,087B decoded，低于20KiB预算。四组20模块均保留原函数/状态身份。

92个实际构建HTML提示场景通过，含16类列表各两种尾斜杠地址，共32个列表变体；其他详情/毛织/旧入口图片与基线提示保持，原基线fetch提示保持。只新增必要首屏图/减少跨工艺提示，不改页面图片DOM或加载函数。

原六类先各5次通过，随后其余10类各5次通过，共80有效冷样本、最大305ms，逐类CLI原件和时间证明相邻串行。再独立全量131场景：19族各五次共95样本、最大385ms、全部通过；另含36布局、工厂编辑取消/刷新和滚动实图。三类empty/saved/invalid原生导航均通过，普通业务owner零写/工厂源不变；原有PDA角色/用户种子不属于零写声明。invalid预期受控提示不冒充意外运行异常。

主代理视觉检查新list-1024-layout.png与profile-editor-merged.png：单工厂展示/无工厂切换Tab、列表查询/统计/表格层次及编辑器布局可读，功能/图片由完整执行原件共同证明。

| 加工单 | 总数 / 首屏行 | 逐项五次最大 ms | 全量五次最大 ms | 结论 |
| --- | --- | --- | --- | --- |
| 烫画 | 9 / 9 | 300.7000000476837 | 247.5 | 本地已验证 |
| 布包扣 | 9 / 9 | 293.39999997615814 | 264.39999997615814 | 本地已验证 |
| 压褶 | 9 / 9 | 288.3000000715256 | 281.60000002384186 | 本地已验证 |
| 打褶 | 9 / 9 | 287.5 | 282.10000002384186 | 本地已验证 |
| 激光开袋 | 9 / 9 | 285.10000002384186 | 273.59999990463257 | 本地已验证 |
| 特种车缝（花样机） | 9 / 9 | 300.60000002384186 | 290.60000002384186 | 本地已验证 |
| 打揽 | 9 / 9 | 282.09999990463257 | 280.89999997615814 | 本地已验证 |
| 打条 | 9 / 9 | 304.60000002384186 | 283.10000002384186 | 本地已验证 |
| 直喷 | 9 / 9 | 243.09999990463257 | 248.20000004768372 | 本地已验证 |
| 绣花 | 18 / 10 | 288.10000002384186 | 280.2999999523163 | 本地已验证 |
| 缝边绣 | 22 / 10 | 305 | 284 | 本地已验证 |
| 盘扣 | 1 / 1 | 251.59999990463257 | 239.10000002384186 | 本地已验证 |
| 花朵 | 9 / 9 | 301 | 288.60000002384186 | 本地已验证 |
| 烫钻 | 9 / 9 | 284.7000000476837 | 298.39999997615814 | 本地已验证 |
| 模板工序 | 9 / 9 | 301.7999999523163 | 385 | 本地已验证 |
| 橡筋定长切割 | 9 / 9 | 270.2999999523163 | 264.60000002384186 | 本地已验证 |

原始证据：output/verification/craft-critical-resource-priority/full-local-summary.json 绑定全量CLI与JSON；individual-local-status.json绑定16个逐项原件；final-hint-contract.json及final-bundle-comparison.json为最终写盘实际构建，coalescing-candidates.json仅为预测。最后两轮实质审查、收据、Git/正式部署及正式全量后验记入独立final-delivery.json；本记录不预填成功。

## 对抗审查发现的构建图证据修正

第二轮初审发现generateBundle采集早于Vite最后的preload/CSS改写，不能把其中size/sha称为最终落盘。原candidate-bundle-graph.json、bundle-comparison.json、root-semantic-review.json及首轮adversarial-round-1.json原样保留，17,116B/1435/566仅代表中间阶段；其“最终字节”措辞由本节更正，不再作为最终交付证明。

修正仅涉及证据工具和本报告，不改产品代码。capture-final-graphs.mjs使用writeBundle最终fileName/code，逐文件与真实写盘sha/size核对。基准06488原Vite配置从Git精确blob单独重建到baseline-dist，全部1201资产与原记录完全相同；候选全部1186资产与已有浏览器验证版本完全相同。对应baseline/candidate-rebuilt-asset-parity.json均通过，因此原175个有效本地样本仍属于完全相同运行字节，无需伪造重测或改写旧样本。

final-bundle-comparison.json逐565个最终旧JS根重算：1432个唯一JS模块完整，2833源模块节点图相同，main静态模块集相同，原PCS双chunk循环保持/无新增循环。列表静态闭包51→46；最终JS解码字节2,909,494→2,905,380，实际浏览器48个JS。最坏跨入口新增14,087B，小于20KiB。1435与1432之差是Vite最终删除1B空JS stub中的3个CSS模块，CSS实物完整保留，不是丢业务模块。final-hint-contract.json再次验证92场景通过。

为让最后两轮都基于修正后的最终证据，重新登记为adversarial-final-round-1.json及adversarial-final-round-2.json；旧首轮保留其历史身份、不替换或冒称仍绑定本次修正文档。产品/页面字节无变，最后两轮均须检查最终图、全部现有样本与新版文档/发布门禁，全部通过才生成冻结收据及执行T5。
