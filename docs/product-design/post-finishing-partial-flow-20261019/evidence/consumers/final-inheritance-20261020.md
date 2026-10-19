# 后道打印与独立示例证据继承核对（2026-10-20）

本记录是本任务的证据整理旁路。产品源码只读；没有启动浏览器、构建、PDF 生成、PDF 渲染或新一轮视觉检查，没有修改、压缩或删除原始证据。技术核对人为 Codex 子代理，最终整合确认由 Root 负责。

结论：原独立示例的 135 个样本可按其纯页面内存边界沿用，当前 39 个静态源文件及验收脚本与该报告的 SHA256 完全一致。原打印报告中 10 个“DOM 已就绪后生成 PDF”家族共 50 个样本均通过 1000ms 门槛，可在新冷入口确认同一内容、数量、图片／字体就绪和打印几何后继承其生成阶段证据。原冷入口性能不在继承范围。已完成的 22 页与 1109 页电子视觉检查仍只对应各自固定 PDF 字节；本记录不将它们改称整合后新导出的 PDF。

## 1. 核对版本与证据身份

实际产品版本为当前 HEAD `eb1b8c92d9a050e8bbbf0d39fdb9e4092fb57103` 加未提交的本任务实现。HEAD 本身不能代表这些工作树修改。

额外比较源为 `stash@{0}`，对象 `a95b1f43c22889224d9f1e842b70192f30d2d78c`，说明为 `On codex/post-finishing-partial-flow: codex/post-finishing-partial-flow before main integration 20261020`。它保存整合 main 前的完整任务源，用于判断本次 main 整合改动；不能自动认作原正式性能运行时的源快照。原正式报告保存 HEAD、dirty、脚本 SHA 和加载资产 SHA，没有保存所有旧打印 JS 的可逐字节比较副本，因此不声称原 formal 与当前所有渲染函数字节已经一一证明相同。

| 证据 | 实际运行／复制身份 | 本轮只读 SHA256 核对 |
| --- | --- | --- |
| [原正式性能报告](../performance/formal-original-1s-report.json) | 2026-10-19T14:59:52.431Z—15:22:19.560Z；HEAD `4a0ce9ef5a30e8dec4537de1ff59159543902a25`＋当时 dirty；Chromium 149.0.7827.55；本机 Apple M3／arm64／8 逻辑核／16GiB；43198 预览 | `fe2d2beaa24826f2822da79f93cf147d661c08d658e050d396b917d964441667` |
| [原性能执行脚本副本](../performance/history/harness-c53e51a0c47efd0207098d99a8710b5b7e2c8dac8253982842cc974343debf39.mjs) | 上述正式运行绑定脚本；不能以当前已调整脚本替代 | `c53e51a0c47efd0207098d99a8710b5b7e2c8dac8253982842cc974343debf39`（原报告绑定） |
| [独立示例正式报告](../standalone-performance/formal-2026-10-19T15-43-46.448Z/report.json) | 同一旧 HEAD＋dirty；27 家族×5，135 个有效样本；实际 `/newpda/index.html?demo=work&screen=post-batch&size=compact` | `e01d5c0a9a1fbfd04d2f462c207f5c2ad46f7874c417ead19729ac2ad544133c` |
| [22 页 PDF manifest](final-print-20261019-234441/pdf-manifest.json) | 2026-10-19 23:44:45＋08 固定副本；原测试脚本 SHA `fe37b695…683cd`、D1 持久回读 SHA `018e1b3f…c9d260` 同 manifest | `f16be72b7cc85b9a3dc71aad96fb90bcd8a347c7442c8c674c3100ed87f68c7a` |
| [1109 页 PDF manifest](large-print-original-assets-20261019-234841/pdf-manifest.json) | 2026-10-19 23:48:41＋08 固定的原性能试次 1 副本；保留旧资产身份和对应 producer samples | `15493f12657143d0ee31d82692de7110c520f635459ce1f48ce6dea7b2d4a1d4` |

原正式性能报告的整体 `passed=false`，含当时真实冷入口和其他性能失败。仅下文点名的 50 个 PDF 生成样本可讨论继承，不能将原整体报告改为通过，也不能把被用户单独放宽的完整备份恢复门槛外推到打印。

## 2. 当前打印源与 main 整合影响

以下各文件已逐一用 `git diff stash@{0} -- <file>` 和 SHA256 比较。除通用预览文件外，它们与整合前 stash 全文件字节相同；这比只比较函数名或文件路径更强，但仍不替代上节缺少的“原 formal 全源码快照”。

| 当前文件 | 与整合前 stash | 当前 SHA256 |
| --- | --- | --- |
| `src/pages/process-factory/post-finishing/full-flow-print.ts` | 相同；`page`、`skuLabel`、`outboundLabelSheet`、`outboundDocumentPage`、QC 转接及 `renderPostFinishingFullFlowPrintPage` 全部保留 | `810d534f66d2c9341f24505d45251ad155725e93f1f1e49773acbf4ed9b95c5f` |
| `src/pages/print/templates/post-finishing-outbound-template.ts` | 相同；两 builder、图文单据 renderer、SKU 条码 renderer 保留 | `a29e2b0841a7cdb2ef27dfc1b2ca27ac4a4cb32cf7cc93aa100663295d18b50f` |
| `src/pages/print/templates/post-finishing-route-card-template.ts` | 相同；分项累计、多张复检／出货／待交出和实收汇总、流转卡 renderer 保留 | `aa4ce2d1d2581aa7a56145ed46d29eb357c526584237fa5643df6eb294f3e21d` |
| `src/pages/print/templates/post-finishing-qc-print-template.ts` | 相同；专用／通用 QC master、detail 相关版式保留 | `48838ce66660a6768f4fb5d629ef7a6a58009c59707efd1fecb9bfd532f2f5d7` |
| `src/pages/print/templates/garment-sku-label-template.ts` | 相同；通用条码 markup、尺寸及逐张分页保留 | `c5dfb21f25b42ffcb81f6a684fb2dc8d96a819b0e344670eb2c33deb7b1f9dc9` |
| `src/pages/print/print-styles.ts` | 相同；通用打印样式、表格／图片区和分页声明保留 | `468ebd3cbd6f904934d18b82beb74341d060195fe535fd1e222599199c6bf25b` |
| `src/data/fcs/print-template-registry.ts` | 相同；POST_FINISHING 注册到对应 builder／renderer 的映射保留 | `b1470020f277d82014db2fe906d35d2131368aa378bd1e5afdc23424bc07de9d` |
| `src/data/fcs/post-finishing-print-progress.ts` | 相同；加工项进度字段与历史含义保留 | `614b1c64919cba47ae799b2c395e0032a21f27f0e62ebd3e25e1c9f43dd38758` |
| `src/data/fcs/task-print-cards.ts` | 相同；打印图片与任务字段来源保留 | `4ee8f92d4dac0df031d51c2cd1cf6c2d0ec69d7dcc743e5e76f56e90b05caeb1` |
| `src/data/fcs/post-finishing-current-read-model.ts` | 相同；当前任务读模型保留 | `194ef84356b1a2d8a6ace260e22001cf9d041c8df03c3155c689772cca5fbaea` |
| `src/components/real-barcode.ts` | 相同；CODE128 绘制保留 | `73c3ac790427c5a8cd1ba759c49bec8f8c89fa36eeacf9fa03a7efbfcdabf5eb` |
| `src/components/real-qr.ts` | 相同；二维码占位／挂载保留 | `70157ca58a5dfa4072383dc50f1dc437ea5d3db8d7909c444f5e4c8cd6c1356e` |
| `src/styles.css` | 相同，且与旧 HEAD `4a0ce9ef…` 也相同 | `7192e2e73440d7e9d1afb58df0c7fd80b3158b5ee248ae4537e9beebb0da53c1` |
| `src/pages/print/print-preview.ts` | 有 main 的 PICKUP_SLIP 条件分支差异，见下文 | 当前 `7fb4dd07eafe895ad1d538145402ca86cf083e909cd1472ae129723b700abe91`；stash `8169beafa56dfc25e65ad947cebad508982ad3d6eacb2650def067fd44bbd0d3` |

`git diff 4a0ce9ef… eb1b8c92… -- <上述文件>` 也只在通用 `print-preview.ts` 出现 main 差异。没有把新辅料单模板误认成后道出货模板。

通用预览的实际变化及 POST_FINISHING 分支结论：

- `loadPrintAdapter(documentType, sourceId?)` 新增的 `sourceId` 只在 `documentType === 'PICKUP_SLIP'` 分支读取。后道出货单、后道出货 SKU 条码、后道流转卡继续走原 registry；`POST_FINISHING_QC_ORDER` 原提前加载分支也保留。POST_FINISHING 的来源解码和 builder 输入没有换成领料版本源。
- `renderUnifiedPrintPreviewPage` 先计算 `documentHtml`。新增 wrapper、横向滚动提示、`data-pickup-slip-preview` 和相应 style 均以 `pickupSlipPreview` 为条件；POST_FINISHING 时为 false，不插入领料 wrapper 或 CSS，不改变其原 `documentHtml` 放置位置。这里不把空白字符串／赋值顺序的变化说成整个文件字节相同。
- `handleUnifiedPrintPreviewEvent` 新的 `preparePickupSlipPrint` 仅由 `PICKUP_SLIP` 进入；后道打印按钮仍走原处理分支。它不参与后道 PDF 的 DOM 已就绪后 `page.pdf()` 计时。
- `src/main.ts:1180` 的早入口同样严格判断 `/fcs/print/preview` 且 `documentType === 'PICKUP_SLIP'`。它不会将 `POST_FINISHING_OUTBOUND_ORDER`、`POST_FINISHING_OUTBOUND_BARCODE`、`POST_FINISHING_ROUTE_CARD` 或专用 `/fcs/craft/post-finishing/print` 转到领料单。
- 后道通用预览仍在 `src/pages/print/print-preview.ts:406` 对 `sourceType.startsWith('POST_FINISHING_')` 独立确保持久资料可读，再构建单据。当前路由 wrapper／必要辅料准备及 R/F 读取实现与旧运行有依赖变化（`src/router/route-renderers-fcs.ts:39/70`、`src/router/route-renderers.ts:38/59`）；这些影响冷入口，不能以 renderer 未变省略新冷入口验证。

尺寸／数量规则核读结果：专用条码按当前这张 `outbound.lines[].outboundQty` 逐件展开，40×30mm、2mm padding、条纹 9mm，避免标签内部拆页；专用吊牌同一展开源，50×90mm、3mm padding、30mm 图片、每 SKU 独立序号。通用条码同样按该张出货数量展开，优先冻结的 `line.sku.barcode`，再使用档案／兜底条码；40×30mm 内容框、7.5mm 条纹、逐标签分页及最后一张取消强制分页的声明未变。通用出货单为 A4 portrait、10mm margin、190mm 主体、固定表格；专用出货单为 210mm 最大宽度、12mm padding。父卡的全部子单汇总和 40 行跨页检查不是这 10 个生成家族的数量缩减替代品。

### CSS／构建资产限制

原正式报告加载的全局 CSS 为 `index-lj0Y4NPX.css`，SHA256 `813c4ec0c25ba7584b5e57a6e4ccabcda0611e2bca7a468c69c5f3e80bfc8134`。本轮只读时本地 dist 的 CSS 为 `index-CNv8zuRi.css`，SHA256 `f453901a0b85e41a955415834944eb3dda0500571b730c6c42d485c87aabdc0e`；二者不相同。本地 dist 是盘点对象，本轮没有再次请求服务验证其运行身份。

`print-styles-BjQBw8jj.js` 在本地 dist 仍存在，SHA256 `2222d0c366d459d919b2ea15f0f395f0c7ecb5ba15bd53a93d7df3cd46977f34` 与原报告一致；这只证明该内联打印样式 chunk，不证明全局 CSS 或其余 JS chunk 相同。Tailwind 扫描新增模板可改变生成 CSS 集合；共享源码 `src/styles.css` 不变也不能推出生成 CSS 字节相同。继承依据必须是点名渲染依赖的变动核对，加新版本实际 DOM、print media 几何与内容等价证据。

## 3. 允许继承的 10 个 PDF 生成家族／50 样本

原脚本在实际冷入口完成后，等待对应 DOM、数量、可见图片等就绪，再以浏览器单调时钟包围 Chromium `page.pdf({format:'A4',printBackground:true})` 及本地返回。下表的 5 个值均直接来自原报告 `kind='pdf-generation'` 的样本；为便于阅读保留一位小数，原始精度仍在 JSON。没有把此时段解释为导航到可操作，也没有实体打印耗时。

| 家族 | 5 个实际样本（ms） | 最大值（ms） | 原生成阶段结果／当前承接条件 |
| --- | --- | ---: | --- |
| `print:OUTBOUND:100:pdf` | 81.1 / 67.6 / 65.2 / 64.4 / 67.8 | 81.1 | 原 5/5 通过；新对应 100 件冷入口的单据内容、图及 print 几何等价 |
| `print:OUTBOUND:1000:pdf` | 65.5 / 66.4 / 66.1 / 66.8 / 65.8 | 66.8 | 原 5/5 通过；新 5SKU各200 的 1000 件单据等价 |
| `print:OUTBOUND_BARCODE:100:pdf` | 48.8 / 47.9 / 48.5 / 47.4 / 48.9 | 48.9 | 原 5/5 通过；新逐件标签数100、冻结条码及40×30几何等价 |
| `print:OUTBOUND_BARCODE:1000:pdf` | 351.7 / 358.2 / 350.7 / 347.1 / 350.7 | 358.2 | 原 5/5 通过；新逐件标签数1000、5SKU各200及几何等价 |
| `print:OUTBOUND_HANGTAG:100:pdf` | 52.9 / 52.6 / 52.2 / 53.0 / 53.5 | 53.5 | 原 5/5 通过；新100份图／SKU／价／序号及50×90几何等价 |
| `print:OUTBOUND_HANGTAG:1000:pdf` | 431.1 / 423.1 / 426.2 / 429.7 / 424.5 | 431.1 | 原 5/5 通过；新1000份、5SKU图／序号及几何等价 |
| `print:GENERIC_OUTBOUND:100:pdf` | 104.6 / 101.5 / 99.9 / 100.1 / 101.4 | 104.6 | 原 5/5 通过；新通用入口仍取本张100，工厂／实收／源单一致 |
| `print:GENERIC_OUTBOUND:1000:pdf` | 99.0 / 98.3 / 100.0 / 98.4 / 101.3 | 101.3 | 原 5/5 通过；新通用入口5SKU各200、本张实收和A4几何一致 |
| `print:GENERIC_BARCODE:100:pdf` | 43.3 / 41.7 / 43.5 / 42.3 / 41.5 | 43.5 | 原 5/5 通过；新 `.online-sku-barcode` 数100、冻结值、字体及逐张分页等价 |
| `print:GENERIC_BARCODE:1000:pdf` | 624.5 / 600.7 / 617.3 / 629.5 / 620.7 | 629.5 | 原 5/5 通过；新数1000、5SKU各200、40×30内容框和分页等价 |

五个直接模板路径是 `type=OUTBOUND/OUTBOUND_BARCODE/OUTBOUND_HANGTAG` 的专用入口，以及 `documentType=POST_FINISHING_OUTBOUND_ORDER/POST_FINISHING_OUTBOUND_BARCODE`、`sourceType=POST_FINISHING_OUTBOUND_ORDER` 的通用入口。每个数量的 `id/sourceId` 必须指向夹具中该张实际出货，不可从第一张子单、当前 SKU 档案或任意缩小样本代换。

## 4. 需要新冷入口补查的 13 个家族

本轮没有运行下表。原报告已有的冷入口样本不作为当前整合版通过证据；新版本结果由主性能执行方提供。10 个数量／模板组合加 `POST_ORDER/QC_ORDER/QC_DETAIL` 为 13 个家族，按本期正式规则各 5 样本；不能只补 5 个模板的 1000 件入口而漏掉 100 件或三个父／QC入口。

| 新冷入口家族 | 实际内容核对 | 必要排版／就绪补查 |
| --- | --- | --- |
| `OUTBOUND:100`、`OUTBOUND:1000` | 本张出货号、对应复检／QC、实际工厂；100／1000数量与逐SKU应交／实收；图片路径与源SKU一致 | 专用A4主体、表格列／行及图片框；可见图已decode、字体就绪，print media无新溢出 |
| `OUTBOUND_BARCODE:100`、`OUTBOUND_BARCODE:1000` | `[data-outbound-unit-label]`100／1000；冻结条码值；1000时5SKU各200；每SKU序号连续 | 40×30mm内容框、9mm条纹、人读文字在框内且不与条纹重叠；print布局避免内部拆分 |
| `OUTBOUND_HANGTAG:100`、`OUTBOUND_HANGTAG:1000` | 份数100／1000、图／SKU／颜色／尺码／冻结条码／价格、每SKU序号；1000时五种图各200 | 50×90mm框、30mm图片区、字体／条码及末项在框内；所有可见图已decode |
| `GENERIC_OUTBOUND:100`、`GENERIC_OUTBOUND:1000` | 通用builder确实读取该 `sourceId` 的冻结出货明细；工厂、数量及本张实收与专用入口相同 | `.post-outbound-print`宽度、A4表格／图片和换行；不出现领料wrapper；print几何与固定视觉样本一致 |
| `GENERIC_BARCODE:100`、`GENERIC_BARCODE:1000` | `.online-sku-barcode`100／1000；builder `totalCopies`一致；条码等于各出货冻结SKU值，1000时各200 | 40×30内容框、7.5mm条纹、完整人读内容／字体；逐张分页、最后一张无额外强制分页，不把大量A4留白误作漏页 |
| `POST_ORDER:cold` | 父加工单实际选项链、各项累计、整套完成／可交复检；全部复检／出货子单与真实来源一致，不退回单子单字段 | 父卡元数据与明细无挤压；图片、二维码、字体和主表几何；不以静态演示旧量代替持久读回 |
| `QC_ORDER:cold` | 实际QC主单、选项及各SKU任务／数量与冻结来源对应 | QC master当前图片／表格／二维码和字体就绪；既有打印版面没有被全局CSS覆盖 |
| `QC_DETAIL:cold` | 同一实际QC明细、尺码／物料／数量及图片对应 | QC detail当前表格和图片区几何、分页相关声明／字体和图已就绪 |

计时终点仍需真实结果可交互、图片及字体就绪、两帧稳定；几何和来源断言应在计时完成条件对应的同一实际页面读取并留证。仅 `.print-preview-root` 出现或仅标签计数相同，不足以证明字体、图片和冻结源正确。打印几何应包含 print media 的实际 computed style／边界，而非只读 screen CSS 字符串。

如这些新冷入口全部证明内容和几何等价，现有静态差异没有指向必须重渲染的特定 POST_FINISHING 模板，本轮不建议无差异重跑 1131 页。若出现实际差异，补验应点名对象：专用标签的框／条纹／底部文本变化补 `OUTBOUND_BARCODE`；图框／末项变化补 `OUTBOUND_HANGTAG`；通用逐张分页或40×30框变化补 `GENERIC_BARCODE`；通用主表宽度／换行变化补 `GENERIC_OUTBOUND`；父卡或QC表格变化补对应父卡／QC模板。若新DOM工作量或分页实际改变，也应重新量取该受影响的 PDF 生成家族，不能沿用旧毫秒值。当前没有观察到这类新差异，本轮也没有提前宣称新冷入口、几何或新的 PDF 通过。

## 5. 两批视觉证据的完整状态

本轮重新计算12份固定PDF的SHA，全部与各自manifest一致。以下“通过”引用已经实际完成的原电子视觉检查，不是本轮重跑结果。

| 固定 PDF | 页数 | 原完整视觉结果／范围 | 本轮完整性 |
| --- | ---: | --- | --- |
| `final-print-20261019-234441/parent-generic.pdf` | 3 | 全3页通过；四项1000、三张100／100／800子单、待复检0／待交出0／实收1000 | SHA与manifest一致 |
| 同目录 `parent-specialized.pdf` | 1 | 全页通过；父单及全部子单 | 同上 |
| 同目录 `third-outbound-generic.pdf` | 1 | 全页通过；第3张实际800／800和实际工厂 | 同上 |
| 同目录 `third-outbound-specialized.pdf` | 1 | 全页通过；与通用入口同一来源800／800 | 同上 |
| 同目录 `second-outbound_barcode.pdf` | 3 | 全3页通过；第2张100份、底部条码文本完整，1—100各一次 | 同上 |
| 同目录 `second-outbound_hangtag.pdf` | 9 | 全9页通过；单SKU100份，末页97—100，图对应 | 同上 |
| 同目录 `multi-sku-pagination-layout-only.pdf` | 4 | 全4页通过；40行打印DOM布局，复制既有行只验分页，未保存新业务 | 同上 |
| `large-print-original-assets-20261019-234841/print-OUTBOUND-1000-1.pdf` | 1 | 全页通过；5SKU各200、本张实收0 | SHA与manifest一致 |
| 同目录 `print-OUTBOUND_BARCODE-1000-1.pdf` | 23 | 全1—23页通过；1000份、5SKU各200、尾页10份 | 同上 |
| 同目录 `print-OUTBOUND_HANGTAG-1000-1.pdf` | 84 | 全1—84页通过；1000份、五种图对应、尾页4份 | 同上 |
| 同目录 `print-GENERIC_OUTBOUND-1000-1.pdf` | 1 | 全页通过；同一张1000件源单与实际工厂 | 同上 |
| 同目录 `print-GENERIC_BARCODE-1000-1.pdf` | 1000 | 全1—1000页完整A4渲染并逐页可读核读；每页一张小标签，A4横向留白，非热敏页验收 | 同上 |

22页由6份业务PDF18页及4页布局样本组成；不能称其覆盖1000份标签全部版式。1109页是另批5SKU各200的五模板原性能输出，仅选同格式试次1全页核读，没有冒称五个性能重复样本都逐页渲染五遍。原消费者800通用标签只保留实际DOM／模型count800证据，没有800份该模板PDF视觉结论。

完整导航：[22页检查报告](final-print-20261019-234441/print-inspection.md)、[逐页状态](final-print-20261019-234441/visual-inspection.json)、[100份序号／条码文本核对](final-print-20261019-234441/label-text-counts.json)；[1109页检查报告](large-print-original-assets-20261019-234841/print-inspection.md)、[完整页渲染／状态](large-print-original-assets-20261019-234841/render-inspection.json)、[74张可读拼图及页码](large-print-original-assets-20261019-234841/readable-sheets.json)、[数量／几何辅助](large-print-original-assets-20261019-234841/text-geometry-counts.json)。两批PDF SHA的完整值由各manifest提供，原PDF、PNG、文字和辅助脚本均在原目录。

早期固定名称PDF曾被后续测试重新导出，旧失败报告 [print-inspection.md](print-inspection.md) 与失败PNG保留，但不能证明全部最早失败PDF字节都另存过。本轮未把旧失败报告改为通过。现有22页报告开头“1109待补”的段落是当时边界，末尾已有追加完成链接；最终实际状态按1109目录的固定完成记录理解，不删除这段时间顺序。

以上均为电子预览／PDF布局的代理技术验证，没有实体打印机边距／缩放、热敏纸适配、实体条码扫描或工厂人员接受证据。

## 6. 独立示例135样本的沿用边界

已逐一重算正式报告 `sourceHashes` 的39个 `public/newpda` 文件；全部相同。当前 `scripts/verification/post-finishing-standalone-performance.mjs` SHA256 为 `2b0d7141f9ba8656f32d1b198fecfda298fecb580190d1cc7412c6bd60041bc1`，与原报告 `scriptSha256` 相同。

关键实际资源仍为：

| 资源／实际query | 当前＝原实跑SHA256 |
| --- | --- |
| `index.html` | `8ac621606dfa0d2bda1273da2565209d544fb6a47819daf910c0321ca4b3245d` |
| `post-flow.js?v=b778cce65b` | `b778cce65b0c89110c1d242274a2f4ae11d431b9bcec4c4f267d0750b806b581` |
| `post-flow.css?v=89abf3965f` | `89abf3965fdbb2dcecf93ba156daca7f59515496f9a5ef1a85dcbb56eaeeb2fe` |
| `handoff-context.js?v=8872cecb1b` | `8872cecb1bbd4631cad310a7b8e883cca32e81e90e9e4e753d47b0637db26955` |

原正式135/135有效且通过，最大534ms，覆盖四项增量登记各5次、显式交复检、复检及条码、单张成衣仓实收、页面家族、数量上限和保存失败保留输入。D1为M600／L400共1000件，四项20条完成记录、5张复检、5张出货、5次仓收；保存终点含既有450ms冷却和两帧稳定。完整家族与原始样本见正式JSON及 [inspection.md](../standalone-performance/inspection.md)。

该示例是 `/newpda` 静态资源的纯页面内存演示，未消费主应用 main/Vite bundle、POST_FINISHING IDB引擎或当前全局CSS。main的PICKUP_SLIP与路由wrapper改动不进入该示例。故源字节未变足以保留这组已有演示性能结果；不能用它证明主应用持久化动作。原报告明确记录刷新后登记／复检／出货／仓收重置为0，本轮不改该边界，也不宣称当前线上部署或其他设备已复测。

## 7. evidence体积与单文件风险（只读盘点）

盘点时间为2026-10-20T00:49＋08附近，范围是本任务 `docs/product-design/post-finishing-partial-flow-20261019/evidence/`。当时2926个文件，共534,876,588字节（510.10MiB，约0.498GiB）。Root／其他验收代理仍可能追加证据，数字是本次盘点点位，不是永久上限。本报告是随后新增的小文件，不包含在该点位计数内。

| 对象 | 字节／MiB | Git当前状态／风险 |
| --- | ---: | --- |
| `performance/d10-fixture.json` | 72,734,722／69.37MiB | 未跟踪且未ignore；最大单文件。超过50MiB级大文件体积，低于本次检查的100,000,000字节与100MiB两条线；没有据此判定100MB单文件阻断 |
| `performance/restore-input.json`、`download-1.json`至`download-5.json`、`integrated-20261020/calibration-storage/restore-input.json`及`download-1.json` | 每个36,178,108／34.50MiB，共8份 | 都未跟踪且未ignore；SHA均为 `78adb8de3cac155fd32499707c4d7d703f0f7f9e48e8bad72d0642f12bb1d586`，确认为相同字节，原运行各自来源仍有证据身份 |
| 最大若干trace／快照 | 单个约5—6MiB | 是失败与等价性原始证据；不是≥100MB文件 |
| `consumers/` | 63,432,808字节，约60.49MiB，2437文件 | 主要为完整PDF、逐页PNG、文字与拼图；总目录大不等于单文件超限 |
| `performance/` | 424,116,478字节，约404.47MiB，226文件 | 主要体积来源；需在最终提交／归档时明确保留方式 |

本次任务evidence中≥50MiB文件1个；≥100,000,000字节和≥100MiB文件均0个。`d10-fixture.json`原字节SHA256为 `20fb87f28a78a7381603d0dd626850fe12b15f2ed756285e7105fc9fb9d0b84a`。没有压缩、改写、移动或删除它。

建议：当前没有单文件100MB阻断，不因体积直接改写原JSON。主代理在提交前先确定原始证据的长期存放和可访问方式；若以后使用独立artifact／归档，应保留版本、原路径、SHA、来源、获取位置及原失败身份，确认读取得到原字节后再另行决定Git纳入范围。八份同SHA备份可在以后通过manifest说明相同内容，但本轮不删副本、不把可重跑当作可重建当时证据，也不改ignore或引入LFS。当前报告仅盘点本任务evidence，不声称全仓Git历史／远端配额已审计。

## 8. Root整合时的关闭条件

1. 用最终构建资产身份补齐13个新冷入口的实际结果、冻结源／数量／图片／字体／print几何；明确失败与修复后的版本，不复用旧cold毫秒值。
2. 对照本记录点名的模板条件判断新DOM是否等价，再仅将50个旧DOM已就绪生成样本与两批固定字节视觉结果列为可继承证据；若存在某一模板实际差异，按该模板补生成或视觉，不能宽泛预填通过。
3. 独立示例135样本保持纯页面内存范围；主应用持久化、冷入口和实体打印分别引用自己的证据。
4. 原PDF、原失败报告、PNG、JSON和69.37MiB夹具继续保留其真实版本身份。此记录不代替Root的最终功能／性能／矩阵接受结论。
