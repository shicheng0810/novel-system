// app/arc-select.ts — C方案: 在预演化轨迹上挑"最有戏的弧线" + 定 in-medias-res 起笔 tick。
//   研究 .audit/20260604-arc-selection-research/: story-sifting 模式匹配(siftStories, 已含 rarity/quality)+ 排序启发式。
//   排序 = quality(完整度×跨度×罕见度, sim-fitness 现成) × Reagan 情感弧形状先验 × 可空降性。
//   起笔 = 弧线 inciting incident(≈ 峰值 atTick − 跨度 span); **绝不取峰值**(那是高潮、会跳过铺垫、矛盾没来由)——峰值是开篇要"建向"的目标。
//   可空降性: 压掉"占满全程的整生弧"(其 inciting 退化为创世) 与"起笔太靠创世/太靠末尾"。试算验证: mystory 选「宿敌易主」tick28、归档saga 选「复仇闭环」tick110, 起笔点合理。app/ 叶子, core/ 不涉。
import { siftStories, type StoryChain } from "./sim-fitness";
import type { WorldEventRecord } from "../core/domain/events";

// Reagan 六情感弧(EPJ Data Science 2016): 含"跌"的复杂弧读者参与度更高 → 加权; 单调上升(逆袭登顶)压权。
const REAGAN: Record<string, number> = { 复仇闭环: 1.2, 崛起陨落: 1.2, 覆灭复兴: 1.15, 巨变连锁: 1.1, 宿敌易主: 1.1, 派系覆灭: 1.05, 逆袭登顶: 0.85 };

export interface ArcStart { tick: number; arc: StoryChain; score: number }

// 在预演化事件轨迹上挑最佳弧线 + 定 in-medias-res 起笔 tick。无可用弧线返回 null(调用方兜底)。
export function pickArcStart(events: WorldEventRecord[]): ArcStart | null {
  const maxTick = events.reduce((m, e) => Math.max(m, e.tick ?? 0), 1);
  const chains = siftStories(events);
  if (!chains.length) return null;
  const ranked = chains
    .map((c) => {
      // dangling(悬仇/半成形)弧的 atTick 即 inciting 事件本身(如死亡); resolved 弧的 atTick 是高潮 → 起笔退回 atTick−span(即触发事件)。
      const incite = c.dangling ? c.atTick : Math.max(0, c.atTick - c.span);
      const frac = incite / maxTick, spanFrac = c.span / maxTick;
      const spanPen = spanFrac > 0.55 ? 0.35 : spanFrac > 0.35 ? 0.7 : 1; // 占满全程的整生弧压权(其 inciting 退化为创世)
      const incitePen = frac < 0.12 ? 0.25 : frac > 0.6 ? 0.5 : 1;        // 起笔太靠创世(无前情张力)/太靠末尾(前情太多读者跟不上)压权
      const score = c.quality * (REAGAN[c.pattern] ?? 1) * spanPen * incitePen;
      return { c, incite, score };
    })
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  return top && top.score > 0 ? { tick: top.incite, arc: top.c, score: +top.score.toFixed(3) } : null;
}
