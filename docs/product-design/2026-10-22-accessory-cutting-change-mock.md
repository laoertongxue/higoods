# 裁剪改厂 Mock 与流转验收

范围继承当前 `AGENTS.md` 与已确认辅料规则，基于 main a1000e145cf57371de75f4f334e30e8cd38d91de。此记录只覆盖新增改厂样例及其直接上下游，不替换上一轮流转验收记录。阶段：先登记设计与验收，实施后绑定证据；技术验证不代替用户接受。

## 目标与设计

两个方向均覆盖 HILON (sea cutting) 与 Mahameru (sea cutting2) 的三种实物阶段。各阶段有一张待改厂、一张已改厂的静态生产单，共 12 张，直接展示且可继续原业务动作；不新增角色、模式、导入或本机维护入口。每单独立 SKU、冻结 BOM、款图和物料图；历史样例及用户覆盖/删除不改变。

H07/M07 未出 GTP，H08/M08 已出未收，H09/M09 已收，均可在统一分配工作台改派。H10/M10、H11/M11、H12/M12 分别对应已经办理上述改厂、等待后续实物动作的记录。H 表示原目的仓 HILON，M 表示原目的仓 Mahameru。已改厂上游任务采用新工厂；静态仓储历史用原目的仓完成实际已发生的收发，再通过既有改厂规划生成结果，不另造平行事实。

未出 GTP：同一调拨更新目的仓，原待收事项取消并生成新事项，中央仓配料及预占不变。已出未收：原调拨及目的仓保持，记录等待原仓收货，新仓不得先收；原仓整单收货并上架与生成后续仓间调拨共同成功。已收后改厂：原收货历史保持，创建全量仓间调拨，实际出库才扣原仓库存，实际新仓收货才增加新仓库存。两仓收货与上架合并；禁止分批、错仓、重复以及缺来源/操作人。

## 实施计划与存储边界

1. 来源与静态事实：upstream-fixtures / mock 加入 12 单，复用既有纯规划、出入库和改厂联动构造器。对象归属为静态源，不落整包种子。
2. 实际改厂：production-context-actions 核查原事务是否合并静态基线与用户覆盖/删除；仅保存本次任务、配料、调拨、收货及审计差异，同库同事务。普通读取不迁移、不写库。
3. 单元契约核对数量、库存来源及用户覆盖；隔离浏览器通过真实改派、收货、出库动作验证六条路径，回读事务、刷新及下游直达；保存失败保留输入并重试。
4. 固定构建在具名视口检查图片、布局、相关加载和三种改厂/原仓收货生单/仓间出入库性能，每家族至少五样本、全部 <=1000ms。冻结文件后治理与收据，审查完整 diff，保留 main 新改动，合并推送并核验正式站 SHA/Actions/资源。

不涉及真实数据库、附件变更、PDA、打印、新规则配置或自动选厂；这些端不适用，不为 Mock 新建架构。既有正式业务校验保留，尤其已领料或后道已发出不能整包改厂。

## 原子矩阵

| 编号 | 来源 | 原子需求 | 工作包 / 实际文件符号 | 自动验证 | 页面/性能或不适用 | 状态 | 证据 | 确认人 / 版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-01 | 本轮请求 | 12 张两方向三阶段待改/已改静态单直接可见 | src/data/wls/accessory-warehouse-upstream-fixtures.ts / ACCESSORY_CUTTING_CHANGE_SCENES | 唯一身份与图片契约 | 中央仓/工作台/两仓 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-02 | 未出 GTP | 改厂仅改目的仓并替换收货事项 | src/data/wls/accessory-warehouse-factory-link.ts / buildAccessoryFactoryLinkChange | 预占及数量不变 | 真实工作台→GTP→新仓 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-03 | 已出未收 | 原目的仓责任保留，新仓不得越过原仓接收 | src/data/wls/accessory-warehouse-mock.ts / buildAccessoryWorkflowMockRecords | 原调拨及收货不变 | 两方向原仓先收 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-04 | 已出未收 | 原仓收货与创建全量后续调拨共同成功 | src/data/wls/accessory-warehouse-commands.ts / buildAccessoryReceiveChange (复用) | 单事务、故障无半套 | 原仓收货→仓间调拨 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-05 | 已收货 | 改厂生成全量仓间调拨且历史不变 | src/data/wls/accessory-warehouse-factory-link.ts / buildAccessoryFactoryLinkChange | 六物料原量/来源位置 | 原仓出库→新仓收货 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-06 | 库存 | 每步实物库存与在途守恒 | src/data/wls/accessory-warehouse-stock.ts / 既有收发契约 (复用) | 全路径来源和余额 | 无提前新仓库存 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-07 | STORE-02 | 改厂同事务读取静态及用户覆盖 | src/data/fcs/production-context-actions.ts / saveProductionSourceAction | 空持久库仍正确改厂 | 改厂直接操作、刷新回读 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-08 | 业务校验 | 已释放辅料仍阻断整包改厂 | src/data/wls/accessory-warehouse-factory-link.ts / releasedQtyByLine (复用) | H05真实改派拒绝、任务回滚 | 页面错误原因 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-09 | STORE-01/04 | 已保存覆盖、零余额、删除优先 | src/data/wls/accessory-warehouse-records.ts / mergeAccessoryMockRecords | 原覆盖回归 | 不新增维护 UI | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-10 | UI-01 | 命名页面三视口内部滚动可用 | src/pages/wls/accessory-warehouses/ 与 src/pages/sewing-outsourcing/tasks.ts | 布局与实际点击 | 1366×768/1280×720/1024×768 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-11 | PERF-01 | 受影响加载与操作每家族五样本 <=1秒 | scripts/check-accessory-workflow-mock-performance.mjs | 原始值/真实事件/持久回读 | 冷/刷新/站内及不同保存分支 | 已验证 | performance-accepted/results.json | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-12 | 发布要求 | 本地 main 与 GitHub main 同 SHA | Git main / origin/main / GitHub main | 收据及完整 diff 审查 | 不适用：Git操作无PDA/打印 | 已实现待验证 | delivery.json 的 releaseAtomicResults（发布后补证） | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-13 | 不允许分批 | 少收/缺行不写任何实收或新调拨 | src/data/wls/accessory-warehouse-commands.ts / buildAccessoryReceiveChange (复用) | 单元契约与99/100页面校验 | 保留收货输入 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-14 | 仓库归属 | 错仓或非启用本仓库位不得收货 | src/data/wls/accessory-warehouse-flow.ts / receiveAccessoryTransfer (复用) | 原专项契约 | 相同收货处理器，无新增端 | 已验证 | unit-final.log / browser-accepted.log | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-15 | 重复防错 | 重复收货不重复增加库存或建单 | src/data/wls/accessory-warehouse-commands.ts / 版本及状态守卫 (复用) | 重复收货契约/刷新 | 刷新新窗口回读 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-16 | STORE-02 | 原仓收货建单保存失败保留输入并可重试 | src/data/wls/accessory-warehouse-commands.ts / 原仓收货事务 (复用) | Quota注入、输入仍在、真实重试 | 不出现任务或库存半套 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-17 | STORE-01 | 仅本次变更逐记录保存，不复制静态整包 | src/data/wls/accessory-warehouse-records.ts / loadAccessoryMockRecordSources | 其他订单未落盘，首次空库 | 直达页面只读 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-18 | IMAGE-01 | 新样例款图及六物料图片齐全可识别 | src/data/wls/accessory-warehouse-upstream-fixtures.ts / 固定图片复用 | 解码及文件存在 | 三视口，不新增图片交互 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-19 | RELEASE-01 | 正式站 SHA/run_id/资源匹配且页面正确 | Actions / deployment.json / production/probe.mjs | HTTPS manifest与资源哈希 | 正式站只读 | 已实现待验证 | delivery.json 的 releaseAtomicResults（发布后补证） | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-20 | 本轮性能失败 | 同步列表渲染复用归属来源且退出立即释放 | src/data/wls/accessory-warehouse-sources.ts / listAccessoryPreparations、withAccessoryPreparationIdentityReadSnapshot；src/data/wls/accessory-warehouse-sewing.ts / scopeForPickup；src/pages/sewing-outsourcing/tasks.ts | 身份等价、返回值隔离、异常finally、下次源变更生效 | 不跨动作缓存，不省库存/来源校验 | 已验证 | narrow-preparation.log / unit-final.log / browser-accepted.log | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-21 | STORE-02 | 改厂保存失败保留价格/原因并可真实重试 | src/data/fcs/production-context-actions.ts / saveProductionSourceAction | Quota注入、任务及辅料事务回滚 | 工作台二次确认 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-22 | STORE-05 | 新改厂审计满足原备份身份校验 | src/data/wls/accessory-warehouse-factory-link.ts / audit | 原备份导出恢复完整验证 | 外部工具，不增加业务入口 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |
| AC-23 | STORE-04/05 | 已有缺id审计仅在显式导出副本按原changeId兼容 | src/data/wls/accessory-warehouse-migration.ts / exportAccessoryWarehouseBackup | 原持久值不变，冲突仍阻断 | 正常读取不修写、不迁移 | 已验证 | browser-accepted.log / browser-accepted / browser-accepted-regression | Codex 技术验证；用户未接受 / source-manifest.json、最终收据 |

AC-20 的范围细化：源级 CPU 证据 sewing-cpu-profile-current.json 表明，领料可打印性六次通过 scopeForPickup 重建全量配料，累计约 394ms，触发重复印染来源读取。现同步绘制作用域同时复用完整展示结果，返回防修改副本，仍首次执行全部来源/库存/旧资料门禁；read-snapshot-complete.log 验证与完整结果一致、调用方修改不污染、异常后释放及下次失效技术包立即生效。实际动作不在此作用域缓存。

仅复用完整结果后 SPA 校准仍有 1051.4ms，故继续修复而不关闭门禁。当前任务在没有旧资料/迁移记录时，复用原投影接口的 productionOrderIds 范围读取；仍核对该生产单完整来源和全部保存库存。已有旧资料/迁移时回到原完整检查。全列表默认参数和结果不变，按单读取只更新该单问题，不清除其他单问题；narrow-preparation.log 的 23 例证明与完整投影筛选相等、全局库存损坏仍阻断、完整列表读取不变。scopeForPickup 与 preparationForOrder 采用此入口，不减少样例或关闭动作。

证据根目录：`output/verification/accessory-cutting-change-mock/`。实施后更新实际测试、版本和结论，不预填通过。

## 实施中发现与范围修订

真实 H07 改派复现：原生产来源动作只读取持久辅料记录，未合并静态基线，任务改厂而目的仓未更新。现已复用原静态加载器，与该事务的持久快照合并，覆盖/删除优先；未增加第二份持久读取或整包落种。失败日志保留 calibration-before-fix.log。

首轮正式性能出现车缝列表冷启动 1048.6ms；该数据规模必须保留。CPU诊断显示归属读取反复复制库存及运行任务。新增 AC-20：仅同一次同步列表渲染复用完整性已检查的来源，finally 释放；实际业务动作、下一次渲染及刷新均重新读取。性能首轮另有工作台规范化地址与脚本预期不符，属于采集错误，已修正为实际规范地址；原结果保留，不记通过。原 14 场景与新增 12 场景均不删减。

第二轮性能出现多入口同时变慢，现场记录了其他工作树的 Node/Vite/Playwright 重任务，主动停止继续批量采样；performance-r2 原始超时及 resource-contention、interruption 均保留。没有停止其他任务或将慢样本判为通过。

扩充改厂后备份回归发现：原 factory-link 审计 value 遗漏 id，导致严格身份校验拒绝导出。新增 AC-22/23：新写入补齐原 changeId；旧审计仅在明确导出动作的副本中、且封套身份与原 changeId 完全对应时补齐，不改原持久记录，不放宽冲突或其他损坏校验。旧外部备份回归已验证恢复 33 调拨及原 6 领料，零余额和删除保留。初期测试把缺 value.id 的旧记录交给按 value.id 查找的接口，改为只读封套回读后通过；采集错误保留。

## 最终本地验收及发布关单

最终浏览器 browser-accepted.log：12/12 通过，包含六条真实改派、六张已改固定样例的后续实物办理、三视口共18张专用筛选截图及16入口×3视口原回归、故障重试、覆盖/删除与完整备份恢复。固定构建正式性能66家族×5=330样本，最大966.9ms，全部<=1000ms。当前专项23例与渐进类型检查通过；全量构建由最终收据在冻结HEAD再次运行。

AC-12/19 保持发布前“已实现待验证”的真实状态；完成合并推送及正式站只读核验后，在不参与收据绑定的 delivery.json / releaseAtomicResults 中逐项补齐最终SHA、Actions、页面/资源及已验证状态，作为此矩阵的发布关单补充。其他本地条目已按实际证据关闭；用户接受不由代理填写。
