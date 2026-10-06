# 样衣 HG 标签实施与证据

基准 HEAD：55627178d7b3b6bd1742cdd539bbc34064522b83；分支 codex/sample-hg-label；同工作树服务 http://127.0.0.1:4206；管理端 1366×768、1280×720。用户确认：HG 是 SKU 维度样衣编号，条码内容为 HG；日期为 SKU 样衣首次登记日期；纸张尺寸未知。原型序列与默认 60×40mm 为演示/试打配置，不代表线上编号或真实纸张规格。

范围：样衣库存/卡片/详情打印入口、专用标签预览、测款⑤ HG 识别、编号与首次登记日期原子保存。无件级唯一码；无实际硬件打印回执；打印不冒充贴码；不改变 LOS 房间门牌。

存储登记：物理样衣及流转沿用 higood-pcs-sample-management-v1/records；SKU 标签身份用同源 identities 分组；数字序列记录在同一命名空间元数据中。静态 HG 映射随应用读取，不落种子；新到样与编号/日期/台账/测款单同一事务保存。打印设置为页面内存，打印不写业务数据。旧 sampleCode 原值保留为历史引用，用户可见样衣编号读取 HG。无新 localStorage 业务写入。

| 编号 | 来源 | 原子要求 | 工作包/实现 | 自动化证据 | 页面/打印/性能证据 | 状态 | 确认人/版本 |
|---|---|---|---|---|---|---|---|
| HG-001 | 用户 SKU 编号确认/总体设计7.5 | 同 SKU 共用 HG，不同 SKU 分配唯一递增编号 | WP-SAMPLE-LABEL/pcs-sample-management | 本目录 evidence（见下表） | 到样重复/跨标签 | 已验证 | 用户/本轮 |
| HG-002 | 用户日期确认/总体设计7.5 | SKU 首次登记日期保存后不随再次入库、流转、重印改变 | 同上 | 本目录 evidence（见下表） | 刷新和流转 | 已验证 | 用户/本轮 |
| HG-003 | AGENTS2.4/总体设计7.5 | 编号/序列/到样记录/测款单/台账原子保存、并发防重、失败保留原值 | 同上/record runtime | 本目录 evidence（见下表） | 注入失败/并发 | 已验证 | Codex/本轮 |
| HG-004 | 用户条码确认/总体设计7.3 | Code128 编码 HG，扫码映射本单内部 SKU，错码阻断 | testing-order repository/detail | 本目录 evidence（见下表） | ⑤双 SKU 核对 | 已验证 | 用户/本轮 |
| HG-005 | 用户照片/总体设计7.5 | 只打印条码、HG、首次登记日期、完整 SKU；长 SKU 完整换行 | sample label page | 本目录 evidence（见下表） | PDF/截图/扫描解析 | 已验证 | 用户/本轮 |
| HG-006 | 用户尺寸未知/本轮假设 | 宽高可调、份数有界、非法尺寸阻断、预览和打印一致 | sample label page | 本目录 evidence（见下表） | 尺寸/份数/试打 | 已验证 | Codex/本轮 |
| HG-007 | 用户页面层次要求 | 库存/卡片/详情入口进入独立预览，直达/刷新可读 | sample page/routes | 本目录 evidence（见下表） | 命名路由/低分辨率 | 已验证 | 用户/本轮 |
| HG-008 | 总体设计7.5 | 打印/取消不改变样衣位置、类型、贴码及台账 | sample label page | 本目录 evidence（见下表） | 前后存储比对 | 已验证 | 用户/本轮 |
| HG-009 | AGENTS7.2 | 新增及受影响路由、所有修改交互每项5次≤1000ms | browser test | 本目录 evidence（见下表） | 原始耗时 | 已验证 | Codex/本轮 |

实施顺序：资料与序列→到样事务→HG扫码→独立预览/打印→对抗测试→浏览器/PDF→收据。最终状态以实际证据为准；设计不是完成证明。

## 当前验证结果

验证版本为基准 HEAD 加本次工作区差异，源文件 SHA256 见 evidence/source-manifest.json。页面为同工作树 Vite 4206；冷启动与普通操作性能使用最终构建 preview 4207。Chromium 149.0.7827.55，独立浏览器上下文，1366×768 / 1280×720；禁用缓存的冷启动和刷新不预热。未清理用户浏览器。

| 证据 | 实际结果 |
|---|---|
| evidence/unit-scoped-final.log | 4/4：SKU 唯一编号、首次日期、旧入库资料回归、HG 映射、尺寸/份数、只读打印及完整 SKU |
| evidence/browser-final.log、browser.json | HG 专项 1/1 加样衣全流程 5/5；到样→两个 HG 贴码→直播间/家播→工厂/部门/仓库→返回；错误 HG、原 SKU、未到样、输入保留、原子回滚、重复和并发 |
| evidence/legacy-registration-final.log、legacy-registration.json | 旧 SKU 显式生成编号、空间不足保留输入和重试、刷新保留首次日期、日期缺失阻断；5 轮 15 样本，最大 66.90000003576279ms |
| evidence/performance.json | 标签冷启动/刷新、库存/卡片/详情进入预览、返回、全部尺寸/份数输入及边界、重置、1/100份打印生成和取消；34 场景×5=170 样本，最大 281.0999999642372ms |
| evidence/sample-regression-performance.json | 11 条受影响/关联路由、全部原有可操作入口；213 场景 1080 样本，最大 385.80000001192093ms |
| evidence/full-flow-1.json～5.json | 实际业务保存、贴码错误、流转/类型转换和故障恢复；36 场景×5=180 样本，最大 209.69999998807907ms |
| evidence/sample-label-55x35.pdf、pdf-verification.json、verify-pdf.py | 三页独立标签；每页 PDF 页面约55.033×34.883mm（浏览器像素取整）；从实际 PDF 黑条几何独立解析 HG2000002，Code128 校验位有效，文本与标签一致 |
| evidence/photo-example.pdf、photo-example.png、photo-example.json | 用照片示例 HG1761420 / 2026-08-26 / MODXU26081404-blue-m 验证完整内容；30×20、60×40、120×100mm 的内容均未越界。仅排版样例，未写真实样衣数据 |
| evidence/build-final-2.log、sample-scope.log、list-governance-static.log | 工程类型检查＋586 单元测试＋Vite 构建通过；样衣专项通过；573 页面列表治理静态检查通过 |
| evidence/typecheck-final.log | 全量 tsc 仍有3项既有范围外错误：factory-receiving-source-sync:20，tmf-material-purchases:813/824；本次涉及文件无新增错误 |
| evidence/codegraph-status.json | initialized=true、同工作树、pendingChanges=0 |

总计 1445 个实际响应样本，全部≤1000ms。无性能例外。保留失败日志：最初 HMR 造成独立 import 缓存与页面实例不一致，重启同工作树服务后重放通过；首次旧日期单元探针发现到样台账时间可能用贴码时间，修正为实际入库时间；旧资料浏览器首次等待文案“失败”与实际“未保存”不一致，修正断言后重跑。未删除或筛除慢样本。

旧 `tests/pcs-testing-order.spec.ts` 是较早的完整测款契约，独立运行会在 reset→bootstrap 后“种子含进行中单”假设处失败（已保存 testing-scope-aligned.log）。当前 HG 贴码契约由新的单元和浏览器全流程验证，不用该旧日志宣称完整测款模块全部契约通过；本次不扩展修改已退役上架入口或种子重建规则。

## 对抗审查与边界

一名只读审查代理发现两处阻断和一处详情表述冲突：原始内部 SKU 回退通过贴码；旧 SKU 新到样取了当前日期；详情“打标码”仍显示 SKU。主代理修正后，审查代理复核关闭全部问题，并以无落盘内存探针验证仅旧入库台账也能恢复最早日期；主代理检查最终 diff 与实际页面/PDF。详见 adversarial-review.md。

纸张尺寸和线上编号起点仍未由用户提供。可调尺寸和演示递增序列已经实现并通过浏览器/PDF 验证；这两项不推断为正式现场标准。本结论不包括实体打印机、标签纸校准或手持扫码枪验收，不代表生产后端能力。技术收据最终以 output/playwright/sample-hg-label/task-receipt.json 为准；本次未执行合并、推送或远端发布。
