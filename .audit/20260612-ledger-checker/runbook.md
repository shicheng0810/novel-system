# 验证世界 runbook · v2(2026-06-12·已按 Opus 交接修正)

> ⚠ **本文件 v1 的开法是错的, 已废**。v1 让你开 `NOVEL_FULLCTX=1` 并杀掉 gen3 重开——两个错:
> ① **FULLCTX 已在本会话被证伪搁置**: GENTLE 下传全量已写正文→全文变"短语库"→ d1c 套语爆炸(实测 16–37 对 vs 基线 p95=12)→已回退。治得了漂移, 但请回"套语泛滥"老 bug。
> ② **gen3(dukou·:8998·lock 当前在跑·ch120+)是唯一在跑的活世界**。杀它去赌 FULLCTX = 既可能报废 120+ 章健康世界, 又可能重炸套语。
> 正确做法: **不碰 gen3**, 用并行舰队先验证 FULLCTX 的副作用, 再决定世界命运。

## 前提
- 只能在你 Mac 上跑(sandbox 无 deepseek egress·DNS 解不出 api.deepseek.com)。key 在 `.novel-output/llm-config.json`, 世界配置在 `.novel-output/worlds/dukou.json`。
- 动 longrun 模块级代码前必跑产线 env canary(见末尾)。本轮 D20 没动 longrun, 但记住这条。

## 安全验证: 并行 A/B 舰队(不动 gen3)
新建两个全新 saga 目录冷启(WARMUP=100·ch1 起), 各写 8 章 ~40 分钟。**别动 dukou**。

```bash
cd "<repo>"

# 臂A = 两开关(待测): FULLCTX + SEG_LEDGER
NOVEL_FULLCTX=1 NOVEL_SEG_LEDGER=1 \
NOVEL_STYLE=温润 NOVEL_PACK=freeform NOVEL_WORLD_CONFIG=.novel-output/worlds/dukou.json \
NOVEL_SAGA_DIR=verify-armA NOVEL_WARMUP=100 NOVEL_TARGET=8 NOVEL_SECTIONS=4 \
NOVEL_FIT_DRAFT=1 NOVEL_WCLEAN=1 NOVEL_STAGNATION_SRC=clean \
npx tsx app/longrun.ts > /tmp/armA.log 2>&1 &

# 臂B = 对照(现栈·两开关都关)
NOVEL_STYLE=温润 NOVEL_PACK=freeform NOVEL_WORLD_CONFIG=.novel-output/worlds/dukou.json \
NOVEL_SAGA_DIR=verify-armB NOVEL_WARMUP=100 NOVEL_TARGET=8 NOVEL_SECTIONS=4 \
NOVEL_FIT_DRAFT=1 NOVEL_WCLEAN=1 NOVEL_STAGNATION_SRC=clean \
npx tsx app/longrun.ts > /tmp/armB.log 2>&1 &
```

## 判读(8 章写完后)
```bash
# 1) 容器漂移分诊(我这轮的 CLI·人工核候选)
npx tsx app/ledger-scan.ts .novel-output/verify-armA/chapters
npx tsx app/ledger-scan.ts .novel-output/verify-armB/chapters
# 2) 套语爆炸看门(FULLCTX 的已知副作用·最关键的一关): 看每章 d1c 对数
#    落章日志已打印 seam 度量行; 或离线对 chapters 跑 lintSeams 读 metrics.d1cPairs
```
- **臂A 若 d1c ≥16(套语爆炸复现)→ FULLCTX 不采纳**, 拦住老 bug, gen3 保持现状。
- 臂A 若 d1c 干净(≤12) 且 容器漂移/D13/D19 较臂B 明显降 → 才考虑用它起 gen4(仍不直接覆盖 gen3, 另开新世界)。
- 跑完清理: `rm -rf .novel-output/verify-armA .novel-output/verify-armB`(确认无写者持锁后)。

## 更值得做的方向(替代 FULLCTX·真空地带)
与其开会引爆套语的全文上下文, 不如把 **SEG_LEDGER 精化成只跨段喂"物件清单+其材质"**(窄带跨段一致性, 不喂全文→不会变短语库)。这条没人试过, 直接打容器漂移根而不伤套语层。建议作下一轮主攻, 优先于 FULLCTX。

## 动 longrun 前的产线 env canary(铁律·macOS 无 timeout)
```bash
rm -rf .novel-output/tpl-canary
NOVEL_SAGA_DIR=tpl-canary NOVEL_STYLE=温润 NOVEL_PACK=freeform \
  NOVEL_WORLD_CONFIG=.novel-output/worlds/dukou.json npx tsx app/longrun.ts > /tmp/c.log 2>&1 &
CPID=$!; sleep 10
kill -0 $CPID 2>/dev/null && echo "✓加载过" || { echo "✗崩"; grep Error /tmp/c.log; }
kill $CPID 2>/dev/null; sleep 1; kill -9 $CPID 2>/dev/null
for pid in $(pgrep -f app/longrun.ts); do ps eww $pid|grep -q tpl-canary && kill -9 $pid; done
rm -rf .novel-output/tpl-canary
```
