# Novel System · 一个会自己写小说的「活世界」

> 你不用写一个字。你造一个世界，然后看着它自己活成一部小说。

---

## 这是什么？（一句话）

这是一个**会自己运转、自己写小说**的程序。

你给它一个世界设定（比如「修仙门派争斗」或「赛博朋克东京」），里面的人物就会像真人一样**自己活起来**：有人野心勃勃想上位，有人记仇要报复，有人结盟、背叛、突破、陨落……这些事是**真的在世界里发生**的，程序再把它们**写成一章章小说**讲给你听。

所以它不是「AI 帮你接着写一段」，而是 **一个活的世界自己长出一部连载小说**——你是旁观者，偶尔在关键时刻当一下「天意」拍个板。

---

## 它特别在哪？

- 🌍 **人物是「活」的**——每个角色的性格来自他的**生辰八字**（对，就是算命那个）：野心、谨慎、和气还是叛逆，都由命格定。他们自己做决定、结仇结缘、变强变弱、生老病死。
- 📖 **小说是「长」出来的**——章节不是提前写好的剧本，而是从世界里**真实发生过的事**里生成。所以每次都不一样，常有你意想不到的转折。
- ✨ **一句话造一个世界**——输入「九十年代重生，重走正道挣大钱」，它就自动生成一整个世界开跑。也可以贴一份你自己的**故事大纲**当底子。
- 🧠 **越写越好看**——它会自己琢磨怎么把故事讲得更精彩、世界本身怎么演化更有戏。这本事是它**自己练出来的**，你不用管。
- 🎭 **你可以当「天意」**——遇到关键抉择（某人要不要赴这场死局？），它会弹卡片问你「**依准**（顺其自然）」还是「**另议**（逆转走向）」。懒得管？开个「**全自动**」，世界自己定。

---

## 怎么开始玩？

你只需要准备**一样东西**：一个 **DeepSeek 的 API Key**——它负责把世界里发生的事写成文字。去 [DeepSeek 官网](https://platform.deepseek.com) 注册就能拿到，按字数付费、很便宜。

然后三步：

**① 装程序**（电脑需要先装好 [Node.js](https://nodejs.org) 18 以上）

```bash
git clone https://github.com/shicheng0810/novel-system.git
cd novel-system && npm install
```

**② 启动**（两行命令，复制粘贴就行）

```bash
# 第一行：让世界开始运转、自己写章节
NOVEL_SAGA_DIR=saga npm run longrun

# 第二行（另开一个终端窗口）：打开观看页面
NOVEL_VIEW=saga NOVEL_SAGA_DIR=saga PORT=8990 npm run serve:core
```

**③ 看小说**——浏览器打开 **http://127.0.0.1:8990**

> 💡 **第一次进会有新手引导一步步带你走**（包括把上面那个 API Key 填进去）。填好就坐等小说一章章自然长出来。想随时再看引导，点页面右上角的 **?**。

**想换题材 / 造自己的世界？** 打开页面点右上角 **✦**，写一句话（或贴一份成品大纲），一个全新世界就开跑了——各自独立、互不打扰。

---

## 在页面上你能做什么

| 你想做的 | 怎么做 |
|---|---|
| 📖 **读小说** | 点顶栏「**手稿**」，左边章目、右边正文 |
| 👁 **看世界** | 默认就是世界地图：谁在哪、谁和谁结盟/结仇、谁心里在想啥（**鼠标悬停**看角色心声，**点两个人**偷听他们当场对话） |
| 🎭 **当天意** | 遇到关键抉择会弹卡片请你拍板；不想被打扰就勾「**全自动裁决**」，往后世界自己定、不再弹 |
| ✦ **造新世界** | 点右上角 ✦，一句话或一份大纲 → 新世界开跑 |
| ⏸ **掌控** | 顶栏可随时 暂停 / 继续 / 停止 / 删除本世界 |

---

## 常见疑问

**要会写代码吗？** 不用。启动时在电脑上敲两行命令（复制粘贴即可），之后全在网页上点。

**要花钱吗？** 程序本身免费开源。只有 DeepSeek 写字按量收费、很便宜。不填 key 也能跑，但只会吐占位的废话文，看不到真小说。

**它会一直跑吗？** 会。世界一直往前演化、章节自然产出，直到你暂停、或它写满 1000 章。关掉电脑也没事，下次启动会**从上次写到的地方接着来**。

**我的数据安全吗？** 你的 key 和所有世界数据都只存在你自己电脑的 `.novel-output/` 文件夹里，**不会上传、不会进代码仓库**。

**生成的人名会乱吗？** 不会。每个角色都有独一无二的名字（早期版本偶尔会带个内部编号后缀，已修）。

---
---

# 给开发者 · 技术细节

> 下面是实现层面的细节，普通使用者可以跳过。

中文小说「世界模拟器」——**世界一直在跑，章节是模拟的副产品**。八字 / 奇门作为概率先验，DeepSeek 负责文笔，引擎与题材（内容包）彻底分离，一句话即可开一个新世界。核心是「一个常驻的世界 actor 自己演化、按节奏自然产出章节」。

## ⚙️ 配置 DeepSeek Key 的三种方式

不配也能跑（LLM 调用会 fallback 到 `MockLLM` 占位输出），但要真正的小说需要 key：

- **A. 配置文件**（推荐）——`.novel-output/llm-config.json`：`{ "provider": "deepseek", "model": "deepseek-v4-pro", "deepseekKey": "sk-…" }`
- **B. 环境变量**：`export NOVEL_LIVE_LLM=deepseek` + `export DEEPSEEK_API_KEY=sk-…`
- **C. 网页设置面板 / 新手引导**——填进去会自动写入 `.novel-output/llm-config.json`

优先级：配置文件 > 环境变量 > mock。key 和数据都在 `.novel-output/`（已 gitignore，不进仓库）。

## ⚙️ 环境变量速查

| 变量 | 作用 | 默认 |
|---|---|---|
| `NOVEL_VIEW` | server 设 `saga` 才读 longrun 章节；否则跑内存 demo | （空） |
| `NOVEL_SAGA_DIR` | 该世界的数据目录 `.novel-output/<它>/` | `saga` |
| `NOVEL_PACK` | 内容包：`modern` / `freeform` / 不设=修仙 | （修仙） |
| `NOVEL_WORLD_CONFIG` | freeform 世界的配置 JSON 路径 | — |
| `PORT` | 网页端口 | `8990` |
| `NOVEL_TARGET` | 目标章数 | `1000` |
| `NOVEL_MINLEN` | 每章最少字数 | `3000` |
| `NOVEL_SECTIONS` | 每章分几段写 | `4` |
| `DEEPSEEK_API_KEY` | 环境变量方式的 key | — |

> ⚠️ **server 必须带 `NOVEL_VIEW=saga`**，否则网页会改去跑一个自带的内存 demo（产出几百字占位短章），而不是读 `longrun` 写的正文。

## 🌐 同时跑多个世界

每个世界用独立的 `NOVEL_SAGA_DIR` + `PORT`，互不干扰：

| 题材 | 写者命令 | 网页命令（另开端口） |
|---|---|---|
| 修仙（默认） | `NOVEL_SAGA_DIR=saga npm run longrun` | `NOVEL_VIEW=saga NOVEL_SAGA_DIR=saga PORT=8990 npm run serve:core` |
| 现代都市 | `NOVEL_PACK=modern NOVEL_SAGA_DIR=modern npm run longrun` | `NOVEL_VIEW=saga NOVEL_PACK=modern NOVEL_SAGA_DIR=modern PORT=8991 npm run serve:core` |
| 自定义 | `NOVEL_PACK=freeform NOVEL_WORLD_CONFIG=… NOVEL_SAGA_DIR=x npm run longrun` | 同样加 `NOVEL_VIEW=saga NOVEL_PACK=freeform NOVEL_WORLD_CONFIG=… NOVEL_SAGA_DIR=x PORT=900x` |

八字 / 奇门这套先验在所有题材里**完全一致**；变的只是世界外壳——势力、地点、地位阶梯、十神命格→志向映射、文风、标题风格。

**单写者锁**：每个世界目录只允许一个 `longrun` 写（`longrun.lock`）。误开第二个会自动退出，避免两个写者赛跑串台。

**重启写者**（改了引擎代码后）：

```bash
pkill -9 -f "app/longrun.ts"            # tsx 以 node-loader 启动，需按脚本名 -9 杀
rm -f .novel-output/*/longrun.lock      # 清 -9 留下的过期锁
# 再 npm run longrun（从已写章节处续写，不从头来）
```

## 🧬 自进化（越写越进步）

**两层自进化**，都默认开（`NOVEL_EVOLVE`），学的是「经验」不是模型权重，数据落各世界目录、重启不丢。引擎核心 `core/` 不内嵌任何进化逻辑（只读通用 `props.tuning` 数值）。

**作者层 · 怎么把模拟「写成章节」**（每 8 章自动进化一次）：

- **质量-多样性存档（MAP-Elites / QDAIF）**：按「语气 × 节奏」风格网格，每格只留该风格下评分最高的精英基因 → 结构性防「千章一面」。
- **混合评估**：LLM 评委 rubric（新鲜度/节奏/对白/钩子/连贯/人物）+ 确定性客观指标（重复率/对白占比/词汇多样性）。客观指标只用于打分、不进生成提示（防刷分）。
- **进化记忆**：避雷表（套话，带年龄衰减）/ 发扬表（有效写法）/ 重点修正，注入下一卷。
- **全局传承层**（`global-evolution.json`）：把所有世界进化出的避雷 + 最优基因汇成全局池，自动播种每个新世界——越多世界进化过，新世界起跑线越高。

**模拟层 · 世界本身「怎么演化」**：

- **可验证的「有戏」度量（sim-fitness）**：① **story-sifting** 从事件流筛「成链的好故事」（复仇闭环/崛起陨落/逆袭登顶/覆灭复兴）× 惊喜质量；② **派系冲突图张力**（势均/交锋/化解）；③ **历史新颖度**（抗停滞）。全是可验证符号指标、抗刷分。
- **可进化的模拟旋钮**：资源稀缺/冲突增益/大事频率/人物代谢/生态位分工/派系结构生长——MAP-Elites 用 sim-fitness 进化它们。
- **涌现底座**（core，genre 中立）：资源零和竞争 → 资源分层/生态位分化；社交感知 → 派系职能分工；结构生长 → 派系内部叛离自立新派系（`FactionSplit`）；群像人口稳态（防坍塌）。
- **混沌边缘控制器 + 戏剧导演**：监控兴亡密度，太冷加注/太热护盘；张力低时顺势推进半成形故事链。
- **模拟器自创机制**：LLM 提议全新世界机制 → 静态自洽闸 + 新颖闸 + 沙箱影子模拟闸（空跑不崩/人口不坍才准入）→ 注入活世界。

`GET /api/evolution` 返回作者层 + 模拟层数据；网页右栏「世界演化·模拟层」面板实时展示。

## 🧱 架构：引擎 ↔ 内容包分离

```
core/domain      genre-neutral 类型与事件契约（WorldEvent 是唯一真相）
core/services    SQLite store、LLM 抽象、内容包注册
core/runtime     单写者 world actor + 调度器（单 tick 循环）
core/actors      character / director / compose actors
packs/           可插拔内容包：先验、进阶阶梯、文风、动态登场、剧情事件
app/             composition roots：longrun（写者）、server（网页）、gen-world
                 自进化：evolve / sim-fitness / drama / sim-rules / canon / constraints
tests/           架构守卫 + actor/runtime/content-pack 测试
```

- **单 tick 循环**：「推世界」和「写章节」是同一 tick 的 phase 序列；Director 决定本 tick 要不要落一章。
- **先验即内容包**：八字 / 奇门通过 `ContentPack.priorSystem` 输出概率先验，引擎只认 `PriorFrame` 形状。
- **机器强制的分离**：`core/` 里不允许出现 `bazi/qimen/cultivation/境界` 等字面量，也不允许 `import packs/`（由 `tests/core/architecture.test.ts` 强制）——这是「换题材引擎不动」的根基。

## 📦 常用命令

| 命令 | 作用 |
|---|---|
| `npm run longrun` | 长篇长跑生成（写者），输出到 `.novel-output/<NOVEL_SAGA_DIR>/` |
| `npm run serve:core` | 启动网页（读者），配 `NOVEL_VIEW=saga` 看 longrun 章节 |
| `npx tsx app/gen-world.ts` | 一句话生成世界配置 JSON |
| `npm run sandbox:core` | mock LLM 下跑 30 tick 冒烟，零成本验证引擎 |
| `npm run check` | strict 类型检查 |
| `npm run test` | 全部测试（含架构守卫） |

## 📁 目录与文档

| 路径 | 内容 |
|---|---|
| `core/` | genre-neutral actor core |
| `packs/` | 可插拔内容包（`xianxia-bazi` 旗舰；`modern-city` / `freeform`） |
| `app/` | composition roots、server、longrun、gen-world |
| `.novel-output/` | 长跑数据、世界配置、LLM key —— **忽略不提交** |

- 架构设计：[`docs/architecture.md`](./docs/architecture.md) · 设计决策：[`docs/decisions.md`](./docs/decisions.md) · 运行手册：[`USAGE.md`](./USAGE.md)
