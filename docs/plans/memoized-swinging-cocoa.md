# Plan · 终结 UX 碎片化：让"日常写作"真的能闭环

## Context

用户在多轮迭代后说"整个项目的逻辑很不对完全没法用"。两轮澄清结果：

1. **痛点位置**：UX 流程 — **不知道每天怎么用**（不是技术 bug、不是质量/速度、不是架构方向错）
2. **research 期望**：**在现有 synthesis.md 上深挖**（不是 90° 转向）

### 真正的根因

不是缺功能，也不是架构错。**是上一次 audit 的 load-bearing 建议（C0.2 工作台合并）做了一半就停了。**

具体诊断（基于 `web/src/components/AppShell.tsx` + 6 个 route 文件实际代码）：

| 上次 audit 给的方子 | 实际落地 |
|---|---|
| **Writing 是主画布**，World/Memory/Atlas 是右侧 Codex Rail 的 tabs，Simulation 是底部 panel，Runtime 是状态栏 pill | ❌ **6 个独立 route**，每个 route 是一整页。点 `/simulation` 把 `/writing` 整页替换掉。CodexRail 和 BottomPanel 是空架子，没绑当前场景。 |
| URL state 单一 workbench，`mode` 控制默认挂哪些 view | ❌ 6 个独立 path，等于把 6 个 useState 换成了 6 个 URL，**碎片化没解决** |
| Codex 跟随选中实体自动切换（Figma 模型） | ❌ Codex Rail 不响应主画布的选中 |
| Cmd+K → 召唤 AI / 切换场景 / 添加角色 | ✅ 命令面板有了（但没把 World/Memory/Atlas 动作收进来） |
| 日常进入 = 落在 prose canvas，typewriter 滚动 | ❌ 进入 `/writing` 落在一个填表单，prose canvas 在表单下面，要先填 lens、点"生成章节"、再等 LLM 1-3 分钟 |

竞品扫描（[Sudowrite vs Novelcrafter 2026](https://www.sidekickwriter.com/blog/sudowrite-vs-novelcrafter-vs-sidekickwriter-2026)、[eesel 5 best](https://www.eesel.ai/blog/ai-novel-writing-software)）双重印证：

- Sudowrite 的胜势 = "写一段，AI 帮一段" 的**就地协作**；不让作者切窗口
- Novelcrafter 的胜势 = Codex 在生成时**自动注入**到 prompt
- 双方共同失败模式 = "story bible 装不下、prose 跑超前、copy-paste 在 tab 之间"
- 2026 设计趋势：**"integration beats isolation — 需要在 tab 之间复制粘贴的 AI 工具正在死亡"**

我们现在的系统正卡在这个死亡象限。**修一下，不用重写。**

---

## 目标日常流程（"今天打开是什么样"）

**0 秒**：打开 `/` → 落在 prose canvas 的当前章节，光标在上次写到的位置。Codex Rail 默认显示当前场景里的角色卡片 + 当前阶段的 qimen / bazi 小卡。底部 panel 折叠成一行 "推演 · 已跑到第 7 个 tick · ★ 1 个推荐分叉"。

**写 2 行**，输入 `/` → 弹出 inline 菜单："让 AI 续 1 段 / 抓取角色记忆 / 调出本场地图 / 触发一次推演 tick"。

**遇到卡顿**，按 `Cmd+K` → "苏雪 在本场之前最近一次哭是什么时候" / "推演下一 tick 看会发生什么" / "切到第 3 章场景 2"。

**写完一段** → 状态栏角落看到 "Critic 已默默复核 · 0 处问题"。Critic 不再是单独工作流，是 prose canvas 旁的细灰 margin note。

**想看世界的全貌** → 点 Activity Bar 的 "世界" — 现在不是跳到新页，而是**右 Codex Rail 切到"全景模式"**（characters / places / factions / lore 树），主画布**仍然显示当前场景**。

**想跑长推演** → 点底部 panel 上的 "▶ 自动推 5 tick"，写作不停，tick 在 panel 里流。

这是 Sudowrite × Novelcrafter × VS Code 的混合体，不是 6 个 SaaS 拼装。

---

## 改造方案：完成 C0.2 合并 + 加日常入口

### Phase A · 路由 → 视图合并（核心 2 天）

**关键文件**：

| 文件 | 现状 | 改造 |
|---|---|---|
| `web/src/components/AppShell.tsx` (195 行) | Activity Bar 6 条都是 `<NavLink to=...>` 全屏跳路由 | Activity Bar 改成**模式切换器**：选中 mode 改 `useUIStore` 里的 `activeMode`，不改 URL。URL 只编 `bookId/chapterId/sceneId`。当前 Outlet 改成永远渲染 `WritingShell` |
| `web/src/router.tsx`（结构） | 6 个 sibling routes | 一条主 route `/:bookId?/:chapterId?/:sceneId?`，外加 deeplink alias `/sim`, `/world/:entityId` 等仅用于跳模式 |
| `web/src/workspaces/writing/Route.tsx` (410 行) | 整页 = lens 表单 + 章节预览 | 拆成：① `WritingCanvas` 主画布（光标 + prose + inline `/` 命令）② `LensDrawer` 可折叠抽屉（顶部"参数"按钮打开），默认折叠 |
| `web/src/components/CodexRail.tsx`（需要扩） | 当前空架 | 实装 4 tab：**Now**（当前场景关联角色/地点/记忆，自动）、**世界**（全景树）、**记忆**（FTS5 搜索 + 时间线）、**图谱**（local atlas + 全局 atlas 切换） |
| `web/src/components/BottomPanel.tsx`（需要扩） | 空架 | 装 Simulation control + tick log + 4 viz mini（节奏/分支/关系/qimen 各缩成 240px 卡） |
| `web/src/components/StatusBar.tsx` | 已有 provider/model 显示 | 加 **Runtime pill**：`Background ▢ 0/0` ↔ `Background ▶ 3/10 ticks · 5s ago`；点击展开右下角 drawer |
| `web/src/workspaces/{world,runtime,memory,atlas,simulation}/Route.tsx` | 各自整页 | **拆**：每个 Route 的核心组件（如 `SimulationPanel`, world list, memory FTS5 view）保留并改 props 化，被 CodexRail / BottomPanel mount 进来。Route 文件本身降级为薄壳（保留 deeplink alias） |

### Phase B · 日常入口（半天）

- **`/` 路由**：检测 `lastOpenedSceneId`（写到 localStorage / session），自动 redirect 到该场景。没有任何场景时 → "新建你的第一章" 引导 wizard（3 步：世界设定 → 角色 → 第 1 个场景目标）。
- **WritingCanvas 顶 dock bar**：当前章节标题（可改） · 字数 · "▶ 续写 1 段"（Sudowrite 风格）· "/ 命令"提示 · "📐 调参"（展开 LensDrawer）
- **inline `/` 命令**（用 `@tiptap/extension-mention` 或自写 portal）：续写 / 角色记忆 / 触发 1 个 tick / 跳场景 / 召唤 critic / 切换 typewriter

### Phase C · 焦点模式 + 引导（半天）

- `Cmd+\` 折叠 Codex Rail；`Cmd+Shift+\` 折叠 Activity Bar；`F11` 全屏；`Cmd+.` typewriter — 全部独立 toggle（Ulysses 模型）
- 首次打开：onboarding tooltips 走 4 步：写画布 → Codex Rail → 底部推演 → ⌘K
- 空状态文案改成"教学性"：每个空 pane 给一句"这里会显示什么" + 一个 CTA

---

## 不做的事（明确不改）

1. **不动后端** — `src/engine.ts`, `src/world-daemon.ts`, `src/character-agent.ts`, DeepSeek provider, memory + FTS5 + 向量、Director、Anti-slop verifier — 全部保留。技术问题之前已经修透。
2. **不重写架构** — world simulator + 6 阶段 pipeline 路线不动。这次澄清已经明确：技术 OK，UX 没闭环。
3. **不加新功能模块** — 不加多用户、不加 mobile、不加云同步、不加 i18n。
4. **不再做 100+ source deep research** — 已有的 IA research（`.audit/20260510-frontend-audit/research_ia_patterns.md`, 232 行）+ 这次竞品扫描 + 实际代码诊断 = 已经够。再 research 是逃避执行。
5. **不重新 W1-W4 跑一遍** — 上次 W4 路线就是这里说的"半成品 C0.2"。这次直接完成它的剩余 50%。

---

## 验证

| 检查 | 期望 |
|---|---|
| `npm run test`（vitest）| 231/231 仍过（前端 vitest 不依赖路由，应无影响） |
| `npm run e2e`（playwright）| 现有 5 个 sibling route 的 spec 需要重写为"模式切换 + 视图挂载"语义；新增 spec：① 打开 `/` 自动落到上次场景；② 在画布输入 `/` 弹菜单；③ Activity Bar 点"世界"右 rail 切到 world tab，主画布不变；④ 底部 panel 跑 tick，画布字数不变 |
| 手动 — 把所有动作压在一个屏幕上 | 不需要离开 prose canvas 就能：写、续写、查角色、触发推演、调参、复核 |
| 时长测试 | "从打开到光标在 prose canvas 准备写"≤ 2 秒（之前是：打开 → 选 workspace → 等 session → 填 lens → 滚动找画布 ≈ 30 秒） |

---

## 关键文件清单（按改动顺序）

1. `web/src/lib/store.ts` — 加 `activeMode`, `codexRailTab`, `bottomPanelTab`, `lastOpenedSceneId`
2. `web/src/router.tsx` — 收缩到 1 主 route + alias
3. `web/src/components/AppShell.tsx` — Activity Bar 改 mode 切换器，删除 NavLink 跳转语义
4. `web/src/components/CodexRail.tsx` — 实装 4 tab（Now / 世界 / 记忆 / 图谱），从现有 World/Memory/Atlas Route 抽组件
5. `web/src/components/BottomPanel.tsx` — 实装 Simulation control + tick log + viz minis
6. `web/src/components/StatusBar.tsx` — Runtime pill + click 展开 drawer
7. `web/src/workspaces/writing/Route.tsx` → 拆成 `WritingCanvas` + `LensDrawer`，光标驻留 prose
8. `web/src/workspaces/writing/InlineSlashMenu.tsx` — **新文件**，inline `/` 命令面板
9. `web/src/workspaces/writing/OnboardingTour.tsx` — **新文件**，首次进入 4 步引导
10. 5 个 sibling Route 文件薄化（保留 alias，组件 props 化下沉）
11. 更新 `web/e2e/02-workspaces.spec.ts` 等 spec 适配单 shell 模型

---

## 估时 + 回滚

- Phase A：2 天（核心 IA 重构）
- Phase B：0.5 天（日常入口 + slash 菜单）
- Phase C：0.5 天（焦点模式 + 引导）
- 测试更新 + e2e 调整：0.5 天
- **合计 ≈ 3.5 天**

每个 Phase 一个 PR。Phase A 出问题 → 旧 6 route 文件 git revert。CodexRail / BottomPanel 是从空架填充 —— 叠加而非删除，回滚安全。

---

## Memory promotion

完成后写一条 project memory：`novel_system_daily_loop_state.md` —— 记录"6 → 1 shell consolidation 真正完成，日常入口为 prose canvas + inline `/` 命令"。不写 Hermes（个人项目，不通用）。
