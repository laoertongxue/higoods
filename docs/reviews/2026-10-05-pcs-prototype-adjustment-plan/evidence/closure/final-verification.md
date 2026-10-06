# 最终源码绑定与现场证据

验收基准 main / 9bb4561e0241438d2de15a9b40913c747e92aaed，加本轮差异；全部源码和构建资源 SHA-256 见 [最终指纹](source-manifest-final.json)。最终构建后未再修改应用源码。5173 与 5178 都读取同一工作树 dist；验收尺寸 1366×768。

最终专项契约 267/267，构建内单元与工程检查 582/582，Vite 构建成功；[专项原始日志](final-contracts.log)、[构建原始日志](final-build.log)。全项目类型检查仍有3个无关既有错误，本范围0错误，未声称全项目类型检查通过。

## 本轮最终计时

冷进入从 about:blank 导航开始计时，禁用 HTTP 缓存但保留实际 IndexedDB 数据。刷新另行记录；没有清空浏览器资料或减少数据。计时终点包括可见内容、必要图片解码、三帧稳定绘制；人员保存等待原子命令完成后的行重新渲染，二维码等待八个实际 SVG 均生成。下表保留每个样本完整精度的原始 JSON，不以平均值代替最大值。此前修复版本的慢样本保留在 release-cold-navigation.json 等原文件中，不改成通过。

| 原始证据文件 | 样本数 | 最大值 ms | 最后版本结果 |
|---|---|---|---|
| technical-list-release-cold.json | 5 | 402.699999988079 | 通过 |
| technical-detail-release-cold.json | 5 | 851.1000000238419 | 通过 |
| technical-process-final-five.json | 5 | 111.89999997615814 | 通过 |
| technical-people-final-five.json | 10 | 190.5999999642372 | 通过 |
| technical-logs-final-five.json | 10 | 79.19999998807907 | 通过 |
| technical-review-filter-final-five.json | 15 | 57.39999997615814 | 通过 |
| material-cold-final.json | 5 | 901.4000000357628 | 通过 |
| material-navigation-object-read.json | 5 | 986.100000023842 | 通过 |
| material-tabs-final-five.json | 15 | 63.30000001192093 | 通过 |
| material-qr-final-five.json | 5 | 196.39999997615817 | 通过 |

## 实际业务结果与范围

- 原5173浏览器 [26条读回](technical-pack-existing-browser-final.json) 与 [截图](technical-pack-existing-browser-final.png)：20个正式全部100%，6个草稿，无“资料待补齐”。没有重置旧资料。5178 [26行登记](technical-pack-26-final.json) 同样显示1..26稳定数字ID。
- [审核状态筛选](technical-review-filter-final-five.json)：未提交3条、第一阶段并行审核3条，各五次；全量分页显示26条。完整资料和是否发布是独立事实。
- [工艺详情截图](technical-process-final.png)：三款面料各染色→印花→洗水，五个裁片各绣花→压褶。全20正式包的内容、原文件与工艺图另由专项断言逐个覆盖；现场详情样本为包1，未声称逐页打开20个详情。
- 人员保存最终各五次及刷新读回；已有 [写入失败/重试/恢复](technical-person-failure-recovery.json) 保留原人员与日志，最终契约再次覆盖原子保存、失败回滚、并发版本与附件完整性。
- [买手款式修改回读](technical-buyer-source-five.json)、[生产单实际导航五次](technical-production-navigation-final.json) 是本轮该功能最后修改后的直接证据；买手只读来源于款式，生产单有实际目标页。
- 物料完整数据保留15506个主档、15522个SKU，冷热读取均不复制静态种子；详情Tab与真实二维码重新验收。普通读快照去掉JSON往返，仍完整核验附件引用、成本图与缺失错误，不跳过校验。

此前点名的连续加工、审核启停、测款回传、附件及批量导入场景见 remaining-validation.md 和 ui-snapshots.json / ui-measurements.json。本次正式包样本、回执、采购、加工均为本地产品原型，不代表真实工厂业务已发生。完整R1的158项矩阵仍独立追踪，不因这组验证整体勾选为已验收。

## 集成检查边界

原型审查覆盖与列表治理通过。统一收据中的菜单检查仍报告main上已有的5个织带路由缺口：handover-records、pending-receipts、purchase-demands、semi-finished-orders、work-orders。本次没有修改菜单或routes-fcs注册，既有主分支发布也登记同一问题。统一收据保留implemented及该真实失败，不改成通过；技术包专项行为与当前页面性能证据单独成立，不声称全项目检查全绿。

高风险diff审查：物料只读分支先按集合校验，规范化仅复制会修改的顶层/SKU规格；公开读和命令草稿保持深复制。附件引用/原始Blob/CAS/事务complete未移除。静态投影只匹配登记摘要、版本和完整内容，真实用户编辑/删除不恢复。人员与日志使用同一命令；新建编号不依赖列表排序；详情关联单据精确版本。二维码字符串结构不变，只有加载时机分离。没有引入线上写接口、供应商/库存主档字段或浏览器维护面板。
