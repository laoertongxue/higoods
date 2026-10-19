# 电子打印证据核读记录

2026-10-19，核读当前任务 `evidence/consumers` 既有6份PDF及全部18页渲染。HEAD为 `4a0ce9ef5a30e8dec4537de1ff59159543902a25`，业务实现为未提交工作区；以下SHA256绑定被核读PDF，不以HEAD冒充当前运行资产版本。复用现有PNG；补渲染吊牌第3—8页为 `hangtag-inspection-3.png` 至 `hangtag-inspection-8.png`。未启动浏览器、未修改业务源码。

**结论：页面主体无整页空白、表格/图片重叠或跨页切断，但本轮电子打印验收尚未通过。** 专用40×30条码的底部文字与条纹贴合/重叠并有裁切；通用父卡的待办/实收数及两个出货入口工厂字段不一致，须修复后重出受影响证据。

| 被核读PDF | 页数 | 视觉范围 | SHA256 |
| --- | ---: | --- | --- |
| [parent-generic.pdf](parent-generic.pdf) | 3 | 第1—3页均逐页目视 | `60785292b339afae7825448c6b29c34df2bcd72c3b9a6ee301074055a79eaaf1` |
| [parent-specialized.pdf](parent-specialized.pdf) | 1 | 第1—1页均逐页目视 | `f5ae3a4f75cda0ddc99772c3c23ea9e161001ab6c9aa1b14fb851c83320e33db` |
| [third-outbound-generic.pdf](third-outbound-generic.pdf) | 1 | 第1—1页均逐页目视 | `451dcef56bf22c518f8d4f49739849c8769d26c690addd421ee8a9b506e18366` |
| [third-outbound-specialized.pdf](third-outbound-specialized.pdf) | 1 | 第1—1页均逐页目视 | `f9420031099af7803d7c1d4855c37ecad4ea61062755556542257c05ff908361` |
| [second-outbound_barcode.pdf](second-outbound_barcode.pdf) | 3 | 第1—3页均逐页目视 | `d029ac03827689665cfb61219cd0ee30349720de3abe1ee2550a164d0cc2a5d1` |
| [second-outbound_hangtag.pdf](second-outbound_hangtag.pdf) | 9 | 第1—9页均逐页目视 | `d13621dc5d1b65ef2362a492728d4fe880a1d2492f84ba2d811b33c149979163` |

## 来源、数量与图片

依据 `tests/post-finishing-consumers.spec.ts`：消费端恢复的是 `../partial-flow-e2e/d1-final-persistent-readback.json` 的实际公共命令+Web/PDA办理结果，不是自行构造下游事实。父加工单为 `PO-QC-202608-001-1-ZJ-HD`，三次复检/出货分别为100、100、800件；三个出货实收分别100、100、800件，均已接收入库。

- 第3张出货 `…-FJ-003-CH`：通用与专用PDF均为800件，均显示实收800，SKU为 `SPU-QC-001-01`、黑色/S，图片对应持久记录 `/materials/pcs-reviewed/shirt-black.jpg`。单号未串到第1/2张。
- 第2张出货 `…-FJ-002-CH`：脚本对条码与吊牌均断言100个 `[data-outbound-unit-label]`。PDF文本辅助核对序号连续1—100：条码3页为45+45+10；吊牌9页为12×7+8+8。全部页均目视，吊牌图为正确黑色/S衬衫，条码值为本单冻结的 `SKU-101-202608`。末页剩余白纸为正常余页，不是空白页。
- 父卡两入口都含四项1000/1000及3张复检/出货身份；通用父卡第3页为签字和底部信息，有实际内容，不是空白页。

## 实际失败与证据缺口

1. **条码底部文字裁切/重叠：** `second-outbound_barcode-page-1.png`至第3页，每张40×30标签底部SKU串压向条纹底沿并有底边裁切；源码该标签的 `-mt-1` 与固定56px条码/30mm溢出隐藏组合相符。吊牌页未见同类问题。应局部调整高度与间距后重新生成条码PDF并复看。
2. **通用父卡数量映射错误：** `parent-generic-page-1.png`显示待质检1000、待处理后复核1000、待交出1000；第2页交出区为“待交出1000、已交出1000、实收0”。这与持久结果三次均实收、无待办余量不符。应使用实际待办余量与全部本单实收事实，不能以累计通过/复检量替代待办。
3. **同张出货工厂字段不一致：** 第3张通用出货PDF为“HiGood 后道工厂”，专用PDF为“PT Prima Printing Center”。数量、单号、SKU与图片一致，工厂映射仍需按本单实际来源统一。
4. **通用800标签的DOM份数证据无效：** `generic-label-content.json`中count=0来自脚本`.garment-label`选择器，模板实际使用`.online-sku-barcode-label`。builder的`totalCopies=800`及冻结条码断言可证明文档模型800份，不能替代页面实际渲染份数。现有6份PDF不含通用800标签PDF，须用正确选择器补DOM份数断言；不把采集0当业务生成0。

原代码审查第6项的仓引用源码现已使用 `trace.waitHandoverRecords`全集及对应出货号；结合consumer脚本第N子单查询/详情/Tab链断言，原7项源码修复可关闭。上述实际打印失败是电子输出验收的结果，仍须修复复验。

本记录仅为PDF电子预览、页面证据及脚本映射核读。没有实体打印机、纸张尺寸测量、实体扫码枪或工厂实际试用证据，不代表实体打印/扫码或现场验收通过。
