# 辅料仓流程 Mock 补齐

## 范围、继承和阶段

来源：用户补充“补充 Mock 数据，当前缺少演示数据”。继承本会话已确认的三仓流转、四类后道排除、整单调拨、收货上架合并、车缝实交责任和直接展示要求。T4 跨模块静态事实补充；基准 main 1b0b1697c43c52dd3bcd21826aad2ff9a10fc2f2，保留 main 新增出库/质检/后道改动。按来源盘点 → 静态场景和覆盖读取 → 流程/页面验证 → 审查收据推进。本轮只补本会话辅料流程关联 Mock，不把全站无关模块扩成新任务；不接真实数据库、不发起线上业务操作。

## 问题与目标

原 F01/F02/F03 只有生产需求、冻结 BOM 和初始裁剪工厂；后续页面依赖用户从头操作生成，首次收货、库存、领料和后道缺少可直接展示的场景。保留原样例，新增 H01～H06、M01～M06、C01/C02 共 14 张独立生产单，每单 100 件、2 个 SKU、6 种辅料，均有款式图及物料图。H/M 每仓分别展示待出库、待收货、已收货待建领料、待领料、部分领料及完成；C01 配料中，C02 已配齐但目的仓待定。

H/M 独立车缝任务与档案中的 CV Micro Sewing Jakarta Pusat（ID-F021）关联，冻结 PPIC 陈琳（PPIC-ACTIVE-006）；裁剪仍映射 sea cutting / sea cutting2。不发明自动选厂规则。GTP 只配料；两仓领料、后道调拨；后道只含拉链和纽扣，价格吊牌/品牌吊牌/吊粒/车缝线留在车缝领料。部分领料 40%，调拨始终整单。已完成场景同时具备车缝实交、凭证、扣库、后道收货与库存事实。

## 对象、存储及实施计划

| 业务对象 | 静态源 / 记录源 | 读写与直接关联 | 旧项及验收 |
| --- | --- | --- | --- |
| 需求、生产单、冻结 BOM、初始任务 | accessory-warehouse-upstream-fixtures / demo；原生产来源覆盖 | 原需求/生产单拥有模块采用；原任务生成器身份，不新增平行任务 | F01～03 不变；旧覆盖优先 |
| 配料、调拨、收货、库存 | accessory-warehouse-mock；cutting records 记录覆盖 | 普通读取静态合并；原事务保存实际变更及关联结果 | 新 SKU/ID 隔离，静态不落种子；零余额覆盖不相加 |
| 领料、凭证、实交、后道 | 同一 Mock 基线及原 sewing/post 桥 | 原任务/PPIC/版本，原实交构造器及库存计算 | 下游直达、刷新、重复/超量/错库阻断 |
| 静态删除标记 | 同库原 ID、tombstone collection | 静态删除保存标记；明确写入同 ID 可替换 | 普通读取不复活；事务失败保留旧状态 |

实施不改页面模板/菜单，不新增种子导入、演示角色、模式和本机资料入口，不清理用户数据。静态基线由现有业务纯计算重放固定历史，数量从固定盘点底稿流转；不是按页面需求临时造库存。收货/出库/领料继续原校验与同库事务。

## 原子需求与证据矩阵

确认人初始为用户（本轮补充）；技术验证由 Codex，用户业务接受不代填。证据根目录 output/verification/accessory-workflow-mock/，最终收据 task-receipt.json。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / PDA / 打印 / 性能 | 状态 | 证据位置 | 确认人 | 确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AM-01 | 用户/来源 | 原三单保留，14新增单与原生产单/BOM/任务身份一致 | 来源 | upstream-fixtures / demo / runtime-process-tasks | 身份、SKU合计、原三单不变 | GTP、车缝任务 | 已验证 | unit-final.log / pages.json | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-02 | 用户/配料 | 配料中与目的仓待定的中央仓场景直接可操作 | GTP | mock / sources | 半配与预留、配齐自动建调拨 | GTP 首次/筛选/完成 | 已验证 | unit-final.log / performance/results.json | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-03 | 用户/收货 | 两仓待收及已上架场景按原整单动作继续办理 | 收货 | mock / commands 原动作 | 正常、少收、错库、重复、空操作人 | 两仓收货及刷新 | 已验证 | browser-accepted.log / flow.json | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-04 | 用户/库存 | 库存余额由固定盘点与来源事件守恒推导 | 库存 | mock / stock / stock-sources | 物理身份、预留归属、出入库守恒 | 三仓库存及物料图 | 已验证 | unit-final.log / pages.json | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-05 | 用户/领料 | 两仓待建/待领/部分/完成与原车缝实交同源 | 领料 | mock / sewing / task-scope 原动作 | 任务/PPIC/凭证/累计一致、超领阻断 | 两仓领料、车缝任务 | 已验证 | browser-accepted.log / flow.json | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-06 | 用户/后道 | 两仓后道场景在DLN同源读取并收货 | 后道 | mock / post-finishing / isManagedAccessoryPostTransfer | 四类排除、正式号和内部ID等价、扣库收货 | 后道调拨及收货 | 已验证 | unit-final.log / browser-accepted.log / performance/results.json | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-07 | UI-02/STORE-01 | 首次及普通读取不复制Mock入库，不要求模式或导入 | 读取 | records / ensureAccessoryWarehouseRecords | 新浏览器业务记录0，16入口直接读 | 首读、刷新、站内 | 已验证 | browser-accepted.log / pages.json | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-08 | UI-01/IMAGE/PERF | 必要图片、命名视口及完整响应满足现行要求 | 页面验收 | 既有页面不改布局；性能脚本 | 图片decode、主体无溢出、五样本 | 1366×768、1280×720、1024×768 | 已验证 | pages.json / performance/results.json | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-09 | STORE-02 | 用户修改和零余额完整覆盖同ID静态记录 | 覆盖 | records / mergeAccessoryMockRecords | 零余额与新版本不相加、不覆盖 | 库存刷新 | 已验证 | unit-final.log / browser-accepted.log | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-10 | STORE-02 | 静态删除保存标记且重开不复活 | 删除 | records / saveAccessoryWarehouseAction | 删除标记原ID、刷新/新页仍删除 | 同源新窗口 | 已验证 | browser-accepted.log | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-11 | STORE-05 | 既有外部备份包含静态来源和用户覆盖/删除 | 备份 | migration / exportAccessoryWarehouseBackup / validateAccessoryWarehouseBackup | 新来源关联完整、删除标记格式校验 | 无新增业务入口；外部工具核验 | 已验证 | browser-accepted.log | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-12 | STORE-05 | 空隔离环境恢复覆盖和删除结果一致 | 恢复 | migration / restoreAccessoryWarehouseBackup | 零余额、删除标记、调拨/领料回读 | 外部工具核验，无新增UI | 已验证 | browser-accepted.log | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-13 | STORE-02 | 保存结果在刷新及同源直达独立读取 | 持久 | records / 原事务库 | 下游不依赖先打开上游 | 刷新/新窗口 | 已验证 | browser-accepted.log / flow.json | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-14 | STORE-02 | 保存失败不发布领料/库存/实交的半套状态 | 失败 | 原 sewing / saveAccessoryWarehouseAction | 原生Quota注入与原状态回读 | 领料失败 | 已验证 | browser-accepted.log | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |
| AM-15 | STORE-02 | 失败保留输入，恢复后可用真实动作重试 | 恢复输入 | 原 pickups 页面保存动作 | 60未丢失、解除故障后保存成功 | 领料重试 | 已验证 | browser-accepted.log / flow.json | Codex 技术验证；用户接受未确认 | main 1b0b1697 后本轮实际文件哈希 |

## 验收方案

隔离浏览器的新上下文直接进入每个命名页面，不注入测试种子；先只读核对记录、图片和空业务库，再通过页面完成待收货/领料/后道的相邻动作，回读原库关联结果，刷新/新窗口一致。正常与超量、少收、错库、空操作人、重复、失效版本及保存失败分别检查；已有用户记录/零余额和删除标记不得被 Mock 复活。固定构建测受影响首次/刷新/切换及操作家族，每家族至少五有效样本，<=1000ms；保留失败。图片仅继承用户已确认的款图错配允许例外，物料图仍按实际对象对应。技术验证与用户接受分开记录。

## 最终实现与证据补充

实现使用新 SKU 和ID隔离旧资料，固定基线版本 AW-WORKFLOW-20261022-V1；普通读取合并，只有实际动作逐记录保存覆盖。备份显式包含静态来源，删除用同库标记保留；原附件能力不变，没有新增Blob。后道归属先核内部ID，仅正式HD单号需读取来源；车缝owned复用既有 listAccessoryPreparationProductionIdentities 单生产单投影，实际动作仍调用完整来源/任务/库存校验。改进不减少记录量或跳过校验。

固定构建 performance/results.json 共53家族、265有效样本、最大957.5ms，全部<=1000ms。初始后道和车缝超时分别保留 performance-initial、performance-r3-partial；错误跨系统Tab/未等查询完成属于采集失败，保留原结果，不计为通过。三种命名视口和实际页面、覆盖/删除、故障及备份恢复已通过（browser-accepted.log，12例；unit-final.log，113例）。矩阵已按具名结果关闭；最终收据仅证明其绑定技术检查，不代填用户接受。
