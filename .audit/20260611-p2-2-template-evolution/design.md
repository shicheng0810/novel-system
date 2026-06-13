# P2-2 模板层进化 · 设计与首轮实施(2026-06-11 用户「启动模板层」)

## 论据
参数轴 8 旋钮 × 8 轮 trial 全 null(蓝图字面死刑未签[R2 极端可检但方向有害]·实质=守门有余改进无门)。
本周全部有效文本改变均为模板层操作(裁撤已写账→章长-30% / EXP-1 关轮盘→重复消失 / PENMANSHIP→盲测AI味降档)。
P2-2 = 把"人肉评测驱动模板修复"升级为"变体→对照→证据→人签"自动循环。

## 机制(全复用既有器官)
- **槽位外置**(longrun.ts): `TPL_DEFAULT{槽名:字面量}` + `NOVEL_TPL_FILE` 变体JSON覆盖; 缺省=逐字节同(golden 37/37 不变=零行为)。
- **白名单纪律**: 检测器/canon硬约束/标题闸/voiceCard结构/fitness 永不外置——进化之手摸不到裁判。
- **变体生成**: 一次只动一个槽(可归因); 措辞无鲜亮可搬运意象(防 D10 回声); 长度≤现任(注意力预算)。
- **试验**: exp-runner 老流程·全臂同基因(隔离模板变量)·fork 基底复用·正常栈(部署净效)。
- **转正**: 双门(主指标显著+守门) + 人签 → 变体文本写回 TPL_DEFAULT(代码变更) + golden 同步 + registry 立户。

## 验证记录(2026-06-11)
- esbuild ✓ tsc ✓ golden 默认 37/37 ✓
- 负对照: NOVEL_TPL_FILE 注入 → golden 在 sec[3](末) 逐字节失配·差异恰在 endGentle 位 = 注入机制端到端实证
- 教训: longrun 是脚本型模块(import 即跑 main)——任何"导入测试"必须走 golden 的 scratch 模式; 本次误 import 拉起 4 个野写者(写 .novel-output/saga 默认目录)·已杀·残锁已清

## 首轮 trial9-template-v14
- 槽: endGentle(章末余味收束句·现任≈150字·settleRatio/similePerK 直接可测)
- 臂: tpl-incumbent / tpl-motion(动势收束) / tpl-voice(人语收束) / tpl-minimal(极简·测"少即是多")
- primary=settleRatio+similePerK · guards 全套 · 8章 · decision 双门+人签
- spec=.novel-output/exp/specs/trial9-template.json · 变体=.novel-output/exp/tpl/endgentle-v*.json

## 后续槽位候选(每轮一槽·按证据排队)
1. 宁短勿堆条款(段预算句) — 章长/密度直接杠杆
2. 疏密相间指令(M1) — microPerK
3. PENMANSHIP 克制句变体 — restraint 族
4. 节拍全景措辞(结构句·谨慎·最后)
