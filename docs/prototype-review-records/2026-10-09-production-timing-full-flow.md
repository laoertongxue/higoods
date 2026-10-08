# 生产单车缝与后道全程时效补齐审查记录

> 版本补充：本文件记录前一轮全程补齐版本。2026-10-09后续两轮审查修正文案及PO-0101主裁床1000/承包500范围冲突，并删除虚假的500放行单；当前需求与验收见[两轮审查控制面](../product-design/production-fulfillment-timeliness/two-round-copy-audit-20261009.md)。历史证据保留原版本，不冒充本轮结果。

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 日期 / 时区 | 2026-10-09 / Asia/Shanghai |
| 需求 / 任务 | 全部20个Mock补齐车缝分配、实际执行及后道；用户纠正后道加工只有一张单据，必须按当前原型核查 |
| 记录模式 | 完整产品审查 |
| 系统 / 角色 / 端 | DDS管理端，同屏供一线业务、主管和高管查看；关联FCS/PFOS/WLS只读来源详情 |
| 分支 / 工作树 | codex/dds-task-business-review / /Users/laoer/.codex/worktrees/d29f/higoods |
| 基线 HEAD | 8a7407989fd06753e57527306e9b06d74ec98fac |
| 服务 / 最终资源 | 同一工作树4179预览 / assets/index-imm39fIJ.js |
| 数据版本 | fixtures SHA256 7208489948a66e32899c852541df71f9c13a519b64000a3d44b7b338d46facaf |
| 产品接受 / 发布 | 业务口径已确认；本次效果待用户接受；本次未提交、合并或推送 |

控制面：[设计](../product-design/production-fulfillment-timeliness/full-flow-completion-design-20261009.md)、[计划](../product-design/production-fulfillment-timeliness/full-flow-completion-plan-20261009.md)、[33条矩阵](../product-design/production-fulfillment-timeliness/full-flow-completion-matrix.csv)。既有准备、供给、辅助工艺和整单28自然日口径保留。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：全程图补车缝分配、具体执行、后道质检、唯一加工单、数量条码复检、交货及成衣仓接收，阶段摘要共六项。合并合同明确承包裁剪/车缝/工厂烫包的适用范围。普通读取静态fixtures→source→图/弹窗/原模块详情，同一事实不建第二份业务来源。

无新增IndexedDB、localStorage业务写入、种子落盘、保存、迁移、附件、清空或真实数据库操作。既有跟进IndexedDB未改。原后道工厂办理代码仅核查，没有修改其执行流程。未改全局外壳、依赖和部署配置。

依据 AGENTS.md 当前治理基线的第2、3、4、5、7、8节逐项审查。

## 3. 自查结论

| 检查项 | 结论 | 直接证据 |
| --- | --- | --- |
| 三角色、任务与图示模式 | 通过 | 六摘要；车缝和后道图内展开，20场景三尺寸实页；原同屏顺序保留 |
| 对象、状态与数量 | 通过 | 20场景/53批；每批只计一个位置；项目不拆单不分数量；95项相关契约 |
| 三合同、分配与执行 | 通过 | fullContract0101；合同从业务分配日起算，执行单按实际开始；承包烫包和后道工作分开 |
| 当前超时、历史晚完成与未知 | 通过 | 自己的末事件结束时钟；当前交出待收继续计时，已接收缺时间不增加当前等待 |
| 后道对象、生成顺序、复检 | 通过 | 当前后道源码核查；37张POST的30完成/6进行中/1待后道；30复检只核对SKU数量和条码；13批质检直接交仓 |
| 摘要、单据与新标签 | 通过 | 9类原模块单据45次真实新标签；最终构建再核9类冷开/刷新及3个定点分支；旧1761单据地址不变 |
| 图片及打印 | 通过 | 沿用款式实图及诚实缺图，三尺寸无破图；大图5次；最终9页PDF，第7页一张加工单三项目，实际渲染可读 |
| 低分辨率及命名路由 | 通过 | 1366×768、1280×720、1024×768，无页面横向溢出；最终构建再次核20场景×3尺寸 |
| 加载及交互性能 | 通过 | 主图完整4865样本；末次原模块改动后187有效样本另存，冷开/刷新等每项5次；全部≤1000ms；原始值保留 |

PDA、扫码、上传、库存更改、危险操作和存储写入故障门禁不适用：本轮只读DDS图示及静态来源，不修改员工执行动作。上述结论不替代原V7其他独立未关闭门禁。

## 4. 问题标签

读不懂、状态抽象、追溯不足、协作断裂、算不准。

## 5. 主要问题与处理

| 问题 | 影响 | 处理与证据 |
| --- | --- | --- |
| 准备场景省略车缝/后道，首屏仍仅三摘要 | 三角色不能判断全程 | 全程保留灰色骨架，补六摘要和对应展开；20场景实页 |
| 分配、合同累计回货、具体加工混合 | 误解起算或重复烫包 | 分配和执行分开，三合同适用范围按任务展开；合同/执行原模块详情 |
| 将后道加工项目拆成多张单及多时钟 | 曲解现有后道对象 | 唯一POST内列开扣眼/装扣子/烫包；同一套数量、开始、完成；删除无事实的未来单据 |
| 缺待后道但未开始场景 | 缺失状态被说成时间缺失 | normal0090/150件已生成POST但未开始，未生成复检、交货 |
| 复检误说成二次质量检验 | 业务动作不符 | 使用应交出/复核交出/数量差异及条码核对；复检完成才生成交货 |
| 尚未入仓误说资料缺失或前置未完成 | 已交出的批次被误解 | 待仓收显示明确等待及150件；未知仍未知；未到环节显示前置未完成 |
| 新数量字段覆盖旧10张加工单 | 已完成150件被说待核实 | 原单保留应加工/实际完成；新模型结果只读其自身字段；专项及最终实际详情5次冷开/5次刷新 |
| 将交出当成接收完成或已接收缺时间继续计时 | 当前等待被夸大 | 图、摘要和原模块复用时钟自己的末事件；历史停止增长，未知不造事实 |

两轮领域对抗审查：第一轮3个P2，第二轮逐项关闭；最终增量只读审查另发现上述旧数量和待仓收文案2个P2，均修正并定点复核关闭，开放P1/P2为0。[记录](production-timing-full-flow-evidence/single-post-adversarial-two-rounds.json)。主代理另核实际页面、完整diff和正反追踪，未新增未确认SLA或拆单规则。

## 6. 最终结论

结论：通过（本地增量实现及适用页面验收）。

33条矩阵已绑定实际实现、自动化和适用页面证据。相关95/95、完整608/608通过；最终Vite11.42s。主图完整性能覆盖形成于BjcNohft构建，之后只有source-document-detail.ts的两个原模块展示修正，数据、主图、样式和事件未改；最终imm39fIJ构建重新验全部20场景三尺寸、9类原模块、两个纠正分支及三项目POST，另生成当前打印。性能证据按组件范围使用，没有以旧原模块结果代替最后修正的验收。

机器治理/CodeGraph状态以本记录所关联的最终任务收据实际结果为准，文档不代替收据。产品效果仍由用户确认，本地验证不构成GitHub发布或Vercel部署。

## 7. 变更覆盖与验证

负责源文件：fixtures.json、source.ts、production-fulfillment/index.ts、production-order-diagrams.ts/.css、full-flow-diagrams.ts、source-document-detail.ts；三个full-flow专项和既有scenarios测试；本任务设计、计划、矩阵、审查记录与V7增量指针。

实际命名页面覆盖全部20个生产单/采购待关联场景。重点：0097早期定位印；0086质检/加工/复检各50件和A-03待仓收；0090待后道150件；0101三合同与一张POST三项目60件；0091质检直接交仓1000件；0092历史晚入库；0093末次入库时间未知。所有9类对应原模块链接均验证。图片与对象沿用原来源，未伪称缺图为实图。

| 验证 | 结果 / 证据 |
| --- | --- |
| 相关专项 | [related-tests.log](production-timing-full-flow-evidence/related-tests.log)，95通过/0失败 |
| 完整build | [final-build.log](production-timing-full-flow-evidence/final-build.log)，工程入口/范围检查、608通过、Vite构建通过 |
| 原单据地址 | [original-native-paths.json](production-timing-full-flow-evidence/original-native-paths.json)，1761张changed=[] |
| 主图完整样本 | [raw-browser-before-legacy-compat.jsonl](production-timing-full-flow-evidence/raw-browser-before-legacy-compat.jsonl)，4865条，最大957.613ms（含5次打印） |
| 最终原模块与整单复核 | [raw-browser-native-closeout.jsonl](production-timing-full-flow-evidence/raw-browser-native-closeout.jsonl)，187有效样本，最大775.209ms（当前打印）；60条仪器漏读无效测量明确排除并重放 |
| 测量汇总及边界 | [performance-summary.json](production-timing-full-flow-evidence/performance-summary.json)、[validation-notes.json](production-timing-full-flow-evidence/validation-notes.json)；原始样本、版本、缓存模式、尺寸、数值及无效原因保留 |
| 当前图/弹窗 | [single-post-order-1366.png](production-timing-full-flow-evidence/single-post-order-1366.png)、[single-post-modal-1366.png](production-timing-full-flow-evidence/single-post-modal-1366.png) |
| 当前边界分支 | [pending-post-order-1366.png](production-timing-full-flow-evidence/pending-post-order-1366.png)、[direct-quality-to-warehouse-1366.png](production-timing-full-flow-evidence/direct-quality-to-warehouse-1366.png) |
| 当前单据及纠正分支 | single-post-current-native-current.png、legacy-post-native-current.png、warehouse-awaiting-native-current.png，均位于同一证据目录 |
| 当前打印 | [single-post-print.pdf](production-timing-full-flow-evidence/single-post-print.pdf)、[print-proof.json](production-timing-full-flow-evidence/print-proof.json)、[实际第7页](production-timing-full-flow-evidence/single-post-print-page.png) |
| 最终治理与CodeGraph | workflow:verify最终实际机器输出为/tmp/single-post-final-task-receipt.json及/tmp/single-post-workflow-final.log；收据state、blockers为准 |

计时从导航开始或对应UI点击开始，到目标内容、必要图片和两帧绘制就绪；原模块使用其timingNavigationMs实际完成值。冷缓存/正常刷新/站内切换分开记录。主图阶段/全部展开、摘要点击与关闭、节点弹窗、图片、详情新标签和打印每项至少5次；不靠平均值掩盖单样本超时。工具长批超时和标签异步库存属于执行失败，未返回或漏字段样本未算验收通过；重放及保留见validation-notes。

最终来源为20场景、53批、2049张静态单据（原1761+新增288），37张新POST、30张处理后复核。原采购、合同、实领/实收、成衣仓数量事实保留。普通读取无新增业务存储写入，无存储迁移/附件门禁；真实生产事实不由Mock证明。历史错误拆单模型的证据单独保留，不用作当前业务验收。

### 受管文件

- `src/data/production-timing/fixtures.json`
- `src/data/production-timing/source.ts`
- `src/pages/production-fulfillment/index.ts`
- `src/pages/production-fulfillment/production-order-diagrams.ts`
- `src/pages/production-fulfillment/production-order-diagrams.css`
- `src/pages/production-fulfillment/full-flow-diagrams.ts`
- `src/pages/production-fulfillment/source-document-detail.ts`

### 验证命令

- `npm run build`：通过，完整608测试及工程入口/范围检查和构建。
- `node --import tsx --test tests/unit/production-timing-full-flow-fixtures.test.ts tests/unit/production-timing-full-flow-diagrams.test.ts tests/unit/production-timing-full-flow-source-detail.test.ts tests/unit/production-timing-scenarios.test.ts`：通过，95项相关契约。
- `git diff --check`：通过，负责代码与文档；原始日志独立保留。

### 例外

- 无性能例外；末次改动仅原模块详情，主图未变的完整证据继续有效，当前构建20场景三尺寸和原模块已重验。
- 原V7其他独立未关闭门禁不由本增量关闭；纯静态读取未触及存储写入门禁。
