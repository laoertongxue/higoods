# 染色加工单四段时间审查记录

## 1. 基本信息

- 日期：2026-09-14。
- 需求：用户确认的四段时间调整，TIME-001～008，见 `docs/dyeing-time-sections-plan.md`。
- 分支：`codex/dyeing-time-sections`；核查基线 HEAD：`4aca4d146c293ace9604b5a3332df3369cb130f8`。
- 工作树：`/Users/laoer/Documents/higoods`；同树 Vite：`http://192.168.0.17:5188`。
- 角色／端：PFOS 管理端，计划、跟单及工厂主管查看染色加工单全程时间。
- 产品确认：用户 2026-09-14 明确同意方案。当前记录为实现与验证证据，远端发布及产品接受另以实际回执为准。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：时间列改为单据创建、上游接收、加工生产、下游交出四段；详情、筛选及 CSV 使用同一时间事实。修正需求单号映射及三条原始演示场景的时间先后。
- 基线：`AGENTS.md` 第 4、5、7 节。无新的业务事件存储、状态或库存计算；PDA 的共享完成／交出时间读取也不再使用最后更新时间。

## 3. 自查结论

| 项目 | 结论 | 直接证据 |
| --- | --- | --- |
| 角色、任务、页面模式 | 通过 | 保持原标准列表、列位置、分页及操作栏，仅增加时间分组与相应详情 |
| 时间语义与实际发生 | 通过 | 包装完成、交出建单、实际交出、实收各自取对应事实，更新备注不作为完成时间 |
| 分批、零数量、未发生与历史缺失 | 通过 | 正量实收首次／最近／笔数；零收货另列；归档工序编号复用仍逐批保留，缺历史时间不伪造 |
| 图片与对象识别 | 通过 | 原物料／商品对应图片保留，缩略图、放大关闭、失败与恢复验收 |
| 追溯与跨页面一致 | 通过 | 两种详情、编辑只读需求单、三类导出、流转卡实际需求号一致 |
| 低分辨率 | 通过 | 1366×768、1280×720，四段三道横线，宽表容器内滚动，主体无横向溢出 |
| 交互与打印 | 通过 | 逐笔详情为原生 details 展开；输入沿用局部处理；单张与混合来源批量 A4 分别 1、3 页 |

## 4. 问题标签

- 原问题：追溯不足、视觉干扰、时间含义不清。
- 处理后：上述时间展示问题已覆盖；没有遗留实现阻塞。

## 5. 主要问题与处理

| 问题 | 处理与验证 |
| --- | --- |
| 更新时间冒充业务时间 | DWO-007 完工从 17:20 改为实际包装 17:00；DWO-008 交出读取 17:25，实收单独为 18:10 |
| 需求号与关联来源不一致 | DWO-001 对齐 DEM-202603-0086，创建时间 03-13 08:00；生产单为 08:35；染色单仍为 03-28 08:10 |
| 历史出库时间漏读 | 从现有仓库出库事实读取 issuedAt，不以接收时间反推发出时间 |
| 示例时间先后冲突 | DWO-003、009 的原始演示日期移到其六月生产单之后；DWO-009、010 染色结束早于各自包装开始，标识、数量及状态不变 |
| 不同批次复用工序编号 | 以同工序的批次出现顺序区分事件；专项覆盖同编号两批及部分归档时间缺失 |
| 重复与误关联 | 按本单物料行匹配送货；PDA 回写和同一接收记录不重复计数；作废交出不参与汇总 |
| 未收到也登记了 0 | 仅有实际登记记录或时间才显示零收货登记，默认实收 0 不算一次登记 |

正向追踪：计划 §1 的单据、接收、生产、交出、边界、展示和一致性规则分别对应 TIME-001～007；两轮验收对应 TIME-008。反向审查：每个业务差异可回到上述编号，未加入其他工厂、路由或业务数量规则。

## 6. 最终结论

结论：通过

两轮验收分别为时间事实专项／相关契约，以及当前工作树浏览器／CSV／打印验收。最后一次批次去重修复后重新运行时间专项和浏览器验收。提交前仍须任务收据返回 `verified`；远端结果以最终 GitHub SHA 回执为准，不把本地验收表述为线上真实业务。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/dye-work-order-times.ts`：TIME-001～005，染色专用时间投影。
- `src/data/fcs/dye-work-order-online-view.ts`：TIME-001、002、004、007，来源数据、过滤和导出。
- `src/data/fcs/dye-work-order-online-domain.ts`：TIME-003、004，共享实际完成／交出时间。
- `src/data/fcs/dyeing-task-domain.ts`：TIME-001、003，原始演示时间。
- `src/data/fcs/process-order-input-transfer-fixtures.ts`：TIME-001、002，关联演示出库时间。
- `src/pages/process-factory/dyeing/work-order-times.ts`：TIME-005、006，四段及逐笔明细。
- `src/pages/process-factory/dyeing/work-orders.ts`：TIME-006、007，时间列与筛选。
- `src/pages/process-factory/dyeing/work-order-overlays.ts`：TIME-001、006、007，详情及只读来源。
- `src/pages/process-factory/dyeing/work-order-detail.ts`：TIME-005、006，独立详情时间。

### 页面路由

- `/fcs/craft/dyeing/work-orders`：四段时间、日期筛选、查看、编辑及三类导出。
- `/fcs/craft/dyeing/work-orders/DWO-007`：独立详情四段及逐笔记录。
- `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001`。
- `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001,DWO-013,DWO-002`。

### 验证命令

- `node --import tsx scripts/check-dyeing-time-sections.ts`：通过；`/private/tmp/dye-time-acceptance/time.log`。
- `node --import tsx scripts/check-dyeing-list-sections.ts`：通过；`/private/tmp/dye-time-acceptance/list.log`。
- `node --import tsx scripts/check-dye-work-order-online-alignment.ts`：通过；`/private/tmp/dye-time-acceptance/alignment.log`。
- `node --import tsx scripts/check-dyeing-demand-source.ts`：通过；`/private/tmp/dye-time-acceptance/demand-source.log`。
- `node --import tsx scripts/check-dyeing-online-gap.ts`：通过；`/private/tmp/dye-time-acceptance/dispatch.log`。
- `node --import tsx scripts/check-factory-receiving-integration.ts`：通过；`/private/tmp/dye-time-acceptance/receiving.log`。
- `node /private/tmp/dye-time-acceptance/browser.mjs`：通过；`/private/tmp/dye-time-acceptance/browser-results.json`。

验收产物目录：`/private/tmp/dye-time-acceptance/`。时间列截图 `time-1366.png`、`time-1280.png`、`completed-time.png`；边界截图 `zero-receipt.png`、`multi-receipt.png`；详情 `detail-times.png`；三份 `export*.csv`；实际 PDF `single.pdf`、`batch.pdf` 及预览截图。最终项目检查、CodeGraph 同步与版本绑定统一以同目录 `task-receipt.json` 为准。

### 真实图片验证

复用当前 `getDyeOrderImageManifest` 及 `DYE_DEMO_DETAILS` 中与商品、投入及产出物料对应的原图片，没有新增素材或占位图。缩略图仍与名称、SKU 同块。浏览器验证实际图片加载、点击大图、Esc 关闭、拦截图片后的可见失败提示与恢复；流转卡每页物料图正常加载。

### 例外

- 原型只在隔离浏览器会话中执行验收来货；未操作线上工厂数据。
- 历史记录确实缺少建单／发出时间时明确显示“历史时间未记录”；未以当前时间补齐。备货的需求／生产单创建时间明确不适用。
- 数量和库存规则没有改变；相关接收、交出契约作为直接回归。无需新增 PDA 界面、扫码、上传或弱网实现。
