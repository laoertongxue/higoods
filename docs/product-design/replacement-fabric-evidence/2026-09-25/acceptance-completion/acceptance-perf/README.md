# 待交出仓冷启动性能定位与修复

版本：HEAD 3a3d16481156a8858155f992aab492cd2cf6bfde + source-manifest.json 的三个源码改动；分支 codex/replacement-fabric-acceptance-20260925，工作树 /private/tmp/higoods-replacement-fabric-release-20260925。

基线 publication 的 504.9/500.4/502ms 失败保留在原证据，本目录另保存同版本轮 before.txt（15样本 max470.4ms）。不能把随机本轮通过当修复。第一轮等价优化 after.txt max482.7ms，未形成稳定收益，亦保留。

CPU profile 冷启动发现 generated-fei-tickets→spreading-differences→material-ledger 为取得真实BOM对应裁片单ID，展开了全量配料投影及无关印花/染色初始化，约100ms。修复在 production-material-prep 复用同一冻结BOM、替料、单位与唯一裁片单匹配，提供只读ID清单；material-ledger不再为ID展开配料全量明细。111条物料账事件和33生产单配料投影逐字段JSON前后相同。runtime-cut-ids.txt 记录默认数据该集合为空；不能据此声称非空自建单已单独验收。

页面另减少无毛织票时的整链可用票计算、实际事件存在时的备用投影构造、同次页面事件集合重复读取，保留原事件分组及顺序。配料只为已拆解单读取相关首加工节点引用。

最终 preview after-ledger.txt：冷启动384.3–393.2ms、刷新234.5–236.4ms、站内切换131.7–132.8ms，各5次，15/15 <500ms。复用原 publication 测量逻辑，导航开始至内容/必要图片完成及双RAF；全新隔离浏览器配置，未预热。dev CPU profiling仅定位，不作为导航性能验收。

最终专项见 contracts-final.log：Web中转袋动作PASS，待交出袋流266/266，单位汇总消费者PASS，正式替料/下游印花替料/历史交接保持PASS。build-ledger.log通过。

material-contract.log 另保留既有 check:material-prep-pickup-management 失败：静态字符串约束不匹配 pickup-management-runtime.ts。pickup-baseline-source.txt 已以 git show HEAD 证实该字符串基线即不存在；本子任务未改该文件及脚本，不能声称该专项通过。

父任务集成存储改造后必须重新构建测量；本目录数据仅覆盖待交出默认页三个加载场景，不代表全部路由及所有交互验收闭环。CodeGraph最终同步由父任务统一进行。

类型检查 typecheck.txt 仍为已知6处外部文件错误（dye-work-order-online-view 2、factory-receiving-source-sync 1、tmf-material-purchases 3）；本次3个源文件无类型报错。三文件 git diff --check 通过。
