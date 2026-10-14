# root 共享基础独立审查

审查时间 `2026-10-13T14:49:21.457974+00:00`。只读8个root文件；没有以core源码作独立证明，没有访问外部站点/真实浏览器存储，没有下派。

发现3条共享输入/失败边界。完整任务尚待root修复与最终验收；Node夹具不替代Chrome。

## P1 ROOT-FOUNDATION-001 — 事务已成功但可选跨标签通知抛错使保存Promise拒绝

IndexedDB事务已complete，但BroadcastChannel构造或postMessage抛错。隔离重放以构造SecurityError模拟通知能力不可用。

调用Promise拒绝SecurityError；pmsGet读到REVIEW-BC已保存、_pmsBaseVersion=1。runtime调用方可能跳过publish并把真实保存显示为未保存。

可选跨标签提示不可用不能反转已经完成的业务提交结果；IDB事务失败仍拒绝。

将BroadcastChannel创建与postMessage作为best-effort提示，捕获通知错误而保留成功commit；必要时另提示同步能力不可用，不提示该记录未保存。

Node隔离夹具证明共享API结果语义；未在最终Chrome模拟BC策略，也未写真实浏览器记录。

## P2 ROOT-FOUNDATION-002 — 旧pmsPutWithVersion忽略旧表单版本，已知版本覆盖后旧值可覆盖新值

同浏览器两个副本均来自v1；A保存成v2后，B仍带v1提交旧字段。

baseVersion取pmsKnownVersions的v2，未比较B的v1；B保存为v3并覆盖A。隔离重放显示staleRejected=false、final supplierName=stale_draft_B、version3。

传入表单版本不得被会话最新版本自动替代。旧副本应明确重新读取；同key排队不能赋予旧草稿写权限。

先核对本任务active调用方；对仍使用此legacy入口的表单保留捕获版本，强制按明确expected version检查或迁到pmsCommitRecords。pmsCommitRecords本次同场景正确拒绝，不能把此发现扩大成所有21页都无版本保护。

只审查root导出的共享legacy API；未读取其他owner调用方，active页面影响需root确认。

## P2 ROOT-FOUNDATION-003 — 同owner重复attachmentReferences可产生已落盘无引用Blob

同业务owner在attachmentReferences出现两项，各引用A/B，新附件A/B同时提交。

入口suppliedReferences把A/B都判为已关联；写reference同key最后B覆盖A；两Blob都存在，最终仅B有引用，A成孤儿。

同owner重复引用项需事务前拒绝或规范化合并；新Blob必须有最终实际有效引用。

事务前校验attachmentReferences owner唯一；保持共同保存owner校验，不能只靠所有输入refs集合判断已关联。增加重复owner失败且业务/Blob都不落盘的边界。

已确认共享输入边界；未证明正常UI会生成此重复输入，不能宣称现有某页已经有孤儿。

## 通过依据

- **ROOT-PASS-TX-COMPLETE**：pmsTx在callback前绑定complete/error/abort；callback失败abort且等待失败，complete前不返回成功。 当前源码
- **ROOT-PASS-CANDIDATE-VERSION**：pmsCommitRecords结构clone候选、同事务检查每条snapshot expected version；日志/主子记录共同写。旧version被拒绝。 源码及FOUNDATION-COMMIT-VERSION-GUARD独立重放
- **ROOT-PASS-BLOB-SIGNATURE**：附件字节SHA-256在事务前完成，签名包含key、规范化input、动作、附件digest、引用与删除；同字节replay，等名等size改字节冲突。 源码及FOUNDATION-BLOB-BYTES独立重放
- **ROOT-PASS-ORDINARY-READS**：pmsGet/pmsAll及runtime日志hydrate走readonly读取，没有初始化种子持久化或flush pending写；读失败抛错。main PMS普通入口仅直接页自身hydrate和公共日志读取。 只确认这些root入口；未读取所有业务hydration callee，非全站读写声明
- **ROOT-PASS-LOG-PUBLISH**：createPmsOperationLog只构候选；appendPmsLog await保存后publish，hydrate不重写日志；publish幂等按id。 源码
- **ROOT-PASS-UPGRADE**：v3创建缺失store但不删已有库，versionchange关闭旧连接，blocked/open失败明示且dbPromise可重新尝试。 源码，最终Chrome旧库升级/blocked由root实际验
- **ROOT-PASS-BACKUP**：备份所有登记active store在同readonly事务一致快照，Blob原始字节随后封装；恢复验证格式/版本/key/duplicate/references，冲突abort整批，不调用清库。 源码；本次未重做root已有实际浏览器备份恢复证明
- **ROOT-PASS-LOCAL-DISPATCH**：dispatcher await handler(target,event)，handled标target；main同route handled局部返回，input/change使用renderAfterHandledPageEvent保护；native checkbox/radio和actionless summary默认行为保留。 当前源码；不读取core页面做独立证明
- **ROOT-PASS-HANDLER-COVERAGE-CORRECTION**：完整当前spec20项（付款2路由共享1spec）含material-inventory/fitting-timeliness；前截断输出造成的未登记初步推断已撤回，不是问题。 完整文件literal解析
- **ROOT-PASS-IMAGES**：公共图片按src/alt渲染加载/失败及retry，图片/背景/按钮/Esc局部关闭；hydrate只处理区域内图片与icons。 源码；对象对应与视觉适配须owner/root实际页面验
- **ROOT-PASS-STORAGE-PANEL**：本地资料panel开关局部DOM，文件选择先header及128MB校验，恢复由用户明确点击，catch错误保留文件，关闭回焦点、Esc/Tab本地处理。 源码；未新访问浏览器
- **ROOT-PASS-SHELL-ICONS**：shell对group/item/child都输出icon容器；registry已导入且导出本次新增图标，hydrate根据注册symbol替换svg，不将配置存在当已注册。 源码；完整menu config由root另行核验

可复现脚本：[/tmp/pms-root-foundation-repro.mts](/tmp/pms-root-foundation-repro.mts)，输出：[/tmp/pms-root-foundation-repro.json](/tmp/pms-root-foundation-repro.json)。完整source SHA与审查时副本见JSON。

初步dispatcher缺口推断已撤回：完整文件确认时效/原料库存均已登记，不列为缺陷。
