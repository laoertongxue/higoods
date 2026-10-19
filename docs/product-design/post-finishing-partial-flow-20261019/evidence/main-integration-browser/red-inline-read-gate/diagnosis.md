# I1真实失败：旧inline材料阻断显式转换入口

2026-10-20，clean dev43197，首例尚未到故障注入/迁移。旧LS材料使用对应public/materials/accessory-zipper.jpg的真实图片inline表示；属于历史迁移输入，不是新业务写入。

postScope准备Accessory → readSources → 对sourceRows的pcsFileReferences严格新存储校验，在旧dataURL上直接throw。main降级，storage-migrate不可达。控制台保存真实错误PCS附件必须以原始Blob保存、不能保存Base64文件与完整栈。不是缺selector或允许force操作的问题，不能删除历史inline覆盖让测试绿。

同family暂停并通知主代理；未继续后续3例，不把未执行覆盖标通过。由主代理修读取历史源边界并重启后校准。
