# Novel System

中文小说「世界模拟器」——**世界一直在跑，章节是模拟的副产品**。
八字 / 奇门作为概率先验，DeepSeek 负责文笔，引擎与题材（内容包）彻底分离，一句话即可开一个新世界。

> 不是「AI 帮你续一段」，而是「一个常驻的世界 actor 自己演化、按节奏自然产出章节」。

---

## ✨ 它能做什么

- **世界自己跑**：角色按八字命格行动、奇门盘推时运吉凶、势力此消彼长，人物会成长 / 陨落 / 复仇 / 复兴 / 世代更替——章节从这些真实发生的事件里长出来。
- **多题材一套引擎**：修仙、现代都市、赛博朋克、末世废土……换一个内容包即可，引擎内核一行不动。
- **一句话造世界**：输入「90 年代重生黑社会，重走正道挣大钱」，自动生成完整世界配置并开跑。
- **网页旁观**：读章节、偷听角色对白、在「议事」里替关键抉择拍板（或超时后交给奇门自动定夺）。

---

## 🚀 如何使用

### 1 · 安装

```bash
git clone https://github.com/shicheng0810/novel-system.git
cd novel-system
npm install
```

需要 Node 18+（依赖 `better-sqlite3` / `lunar-javascript` / `tsx`）。

### 2 · 配置 DeepSeek API Key

不配也能跑（所有 LLM 调用会 fallback 到 `MockLLM` 占位输出），但要生成**真正的小说**需要 key。三选一：

**A. 配置文件**（推荐，长期生效）——新建 `.novel-output/llm-config.json`：

```json
{ "provider": "deepseek", "model": "deepseek-v4-pro", "deepseekKey": "sk-你的key" }
```

**B. 环境变量**：

```bash
export NOVEL_LIVE_LLM=deepseek
export DEEPSEEK_API_KEY=sk-你的key
```

**C. 网页设置面板**——先把世界跑起来（见下一步），在网页里打开设置填 key，会自动写进 `.novel-output/llm-config.json`。

> 优先级：配置文件 > 环境变量 > mock。key 和生成数据都在 `.novel-output/`，已被 `.gitignore` 忽略，**不会进仓库**。

### 3 · 跑你的第一个世界

一个世界 = **一个写者**（`longrun`，把世界往前推 + 写章节）+ **一个网页**（`server`，只读展示）。开两个终端：

```bash
# 终端 1 · 写者：世界一直在跑，每章 ≥3000 字落盘到 .novel-output/saga/
NOVEL_SAGA_DIR=saga npm run longrun

# 终端 2 · 网页：必须带 NOVEL_VIEW=saga，才会去读写者的丰满章节
NOVEL_VIEW=saga NOVEL_SAGA_DIR=saga PORT=8990 npm run serve:core
```

浏览器打开 **http://127.0.0.1:8990** —— 看章节、人物命盘、世界事件、议事决策。

> ⚠️ **server 必须带 `NOVEL_VIEW=saga`**。漏了它，网页会改去跑一个自带的内存 demo（产出几百字的占位短章），而不是读你 `longrun` 写的正文。

### 4 · 换个题材跑（同一引擎，换内容包）

| 题材 | 写者命令 | 网页命令（另开端口） |
|---|---|---|
| 修仙（默认） | `NOVEL_SAGA_DIR=saga npm run longrun` | `NOVEL_VIEW=saga NOVEL_SAGA_DIR=saga PORT=8990 npm run serve:core` |
| 现代都市 | `NOVEL_PACK=modern NOVEL_SAGA_DIR=modern npm run longrun` | `NOVEL_VIEW=saga NOVEL_PACK=modern NOVEL_SAGA_DIR=modern PORT=8991 npm run serve:core` |
| 自定义世界 | `NOVEL_PACK=freeform NOVEL_WORLD_CONFIG=.novel-output/worlds/x.json NOVEL_SAGA_DIR=x npm run longrun` | 同样加上 `NOVEL_VIEW=saga NOVEL_PACK=freeform NOVEL_WORLD_CONFIG=… NOVEL_SAGA_DIR=x PORT=900x` |

八字 / 奇门这套先验在所有题材里**完全一致**；变的只是世界外壳——势力、地点、地位阶梯、十神命格→志向映射、文风、标题风格。

### 5 · 一句话新建世界

**网页里**：点右上角 **✦ 新建世界**，输入一句话描述 → LLM 自动生成完整 `WorldConfig` → 新世界在新端口开跑。

**命令行里**：

```bash
NOVEL_WORLD_PROMPT="赛博朋克东京，黑客、义体改造与巨型企业的暗战" \
NOVEL_WORLD_OUT=.novel-output/worlds/tokyo.json \
npx tsx app/gen-world.ts

# 生成后开跑：
NOVEL_PACK=freeform NOVEL_WORLD_CONFIG=.novel-output/worlds/tokyo.json NOVEL_SAGA_DIR=tokyo npm run longrun
```

---

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

---

## 🌐 同时跑多个世界

每个世界用独立的 `NOVEL_SAGA_DIR` + `PORT`，互不干扰。例如四个世界并行：

| 世界 | 数据目录 | 端口 | pack |
|---|---|---|---|
| 修仙 | `saga` | 8990 | （默认） |
| 现代 | `modern` | 8991 | `modern` |
| 东京 | `tokyo` | 9000 | `freeform` |
| 重生九零 | `90year` | 9001 | `freeform` |

**单写者锁**：每个世界目录只允许一个 `longrun` 写（`.novel-output/<dir>/longrun.lock`）。误开第二个会自动退出，避免两个写者赛跑、写串同一章。

**重启写者**（例如改了引擎代码后）：

```bash
# 按脚本名杀——tsx 以 node-loader 形式启动，进程命令里 "tsx" 与 "app/longrun" 不相邻，
# 用 "tsx app/longrun" 匹配不到真正的 node 工作进程。
pkill -9 -f "app/longrun.ts"
rm -f .novel-output/*/longrun.lock     # 清 -9 留下的过期锁
# 再重新 npm run longrun（会从已写章节处续写，不会从头来）
```

---

## 🧱 架构：引擎 ↔ 内容包分离

```
core/domain      genre-neutral 类型与事件契约（WorldEvent 是唯一真相）
core/services    SQLite store、LLM 抽象、内容包注册
core/runtime     单写者 world actor + 调度器（单 tick 循环）
core/actors      character / director / compose actors
packs/           可插拔内容包：先验、进阶阶梯、文风、标题风格、动态登场、剧情事件
app/             composition roots：longrun（写者）、server（网页）、gen-world、sandbox
tests/core       架构守卫 + actor/runtime/content-pack 测试
```

- **单 tick 循环**：「推世界」和「写章节」不是两条流水线，而是同一 tick 的 phase 序列；Director 决定本 tick 要不要落一章。
- **先验即内容包**：八字 / 奇门通过 `ContentPack.priorSystem` 输出概率先验，引擎只认 `PriorFrame` 与 `scoreCandidate` 形状，不内嵌任何具体题材。
- **机器强制的分离**：`core/` 里不允许出现 `bazi/qimen/cultivation/境界` 等字面量，也不允许 `import packs/`。由 `tests/core/architecture.test.ts` 强制——这是「换题材引擎不动」的根基。

---

## 📦 常用命令

| 命令 | 作用 |
|---|---|
| `npm run longrun` | 长篇长跑生成（写者），输出到 `.novel-output/<NOVEL_SAGA_DIR>/` |
| `npm run serve:core` | 启动网页（读者），配 `NOVEL_VIEW=saga` 看 longrun 章节 |
| `npx tsx app/gen-world.ts` | 一句话生成世界配置 JSON |
| `npm run sandbox:core` | mock LLM 下跑 30 tick 冒烟，零成本验证引擎 |
| `npm run check:core` | actor core strict 类型检查 |
| `npm run test:core` | actor core 测试（含架构守卫） |
| `npx tsx app/retitle.ts` | 维护工具：按当前标题风格重写【已存章节】标题（运行前先停该世界 longrun） |

---

## 📁 目录与文档

| 路径 | 内容 |
|---|---|
| `core/` | genre-neutral actor core |
| `packs/` | 可插拔内容包（`xianxia-bazi` 旗舰；`modern-city` / `scifi-station` / `freeform` 证明引擎不绑题材） |
| `app/` | composition roots、server、longrun、gen-world |
| `.novel-output/` | 长跑数据、世界配置、LLM key —— **忽略不提交** |
| `src/` + `workbench/` | 早期 v3 分层运行时 + React workbench（保留可运行，非主线） |

- 架构设计：[`docs/architecture.md`](./docs/architecture.md)
- 设计决策：[`docs/decisions.md`](./docs/decisions.md)
- 运行手册：[`USAGE.md`](./USAGE.md)
- 环境变量模板：[`.env.example`](./.env.example)
