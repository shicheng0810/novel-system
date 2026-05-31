# 全栈 Chrome 自动化测试报告

**日期**: 2026-05-10
**工具**: Playwright 1.59 + Chromium 1217（自带，不动用户已开的 Chrome）
**结果**: **231/231 全过** (vitest 202 + playwright e2e 29)
**耗时**: e2e 11.4s, vitest 1.9s

---

## 测试覆盖（5 个 spec / 29 个测试）

### 00-shell.spec.ts (3)
- 主页加载，无 console error
- 顶栏 4 个按钮渲染（⌘K / Codex / 底部面板 / 设置）
- 状态栏显示 provider/model

### 01-navigation.spec.ts (8)
- Activity Bar 6 个 workspace 点击 → URL 切换（W/S/R/D/M/A）
- 键盘快捷键 W/S/R/D/M/A
- URL 深链接刷新保留（reload 后仍在 /atlas）

### 02-workspaces.spec.ts (10)
- Writing：lens form 渲染 + 焦点角色默认值 + zod 校验
- Simulation：run-stage 表单 + auto-run 按钮
- Runtime：daemon 启停按钮
- World：textarea + 应用/预览/重置 + 种子 Markdown 预填
- Memory：4 个 section + 搜索框
- Atlas：树渲染 + 点击文件展示内容（修复后）

### 03-controls.spec.ts (6)
- Codex 右栏：toggle + 三 tab 切换（世界/记忆/图谱）
- Memory tab Codex：点击后展示摘要
- 底部 Simulation panel：toggle 后可见
- ⌘K 命令面板：打开 + 中文搜索 + Enter 跳转 + Esc 关闭
- **设置 dialog（这次修的 bug）**：点击打开 + 显示当前 AI 配置 + Esc 关闭

### 04-runtime-flow.spec.ts (2)
- Daemon API 调用 + Runtime 页面状态显示
- Compose 章节：表单提交 → 按钮进入"生成中…"态（证明 mutation 触发）

---

## 发现并修复的 3 个真 UI bug

### Bug A · StatusBar 字段名错（永远不显示 provider）
**根因**：StatusBar.tsx 读 `data?.ai?.provider/model`，但 server `/api/session` 实际返回的是 `providerName + aiSettings.model + selectedLineId/selectedStageId`。条件分支 `data?.ai &&` 永远 falsy → 状态栏永远空。

**修**：重写 StatusBar 类型 + 读取真实字段；分离 daemon status 调用到 `/api/runtime/status`（session 不含 daemon 状态）；加 `data-testid` 便于测试。

### Bug B · WritingRoute Lens 表单 Label 没绑 htmlFor
**根因**：`FormField` 组件渲染 `<Label>{label}</Label>` 不带 `htmlFor`，子 `<Input>` 也无 `id`。结果 `getByLabel("焦点角色")` 找不到，screen reader 也用不了。

**修**：FormField 用 `useId()` 生成 id，`React.cloneElement` 自动注入到子 Input/Textarea/select；Label 加 `htmlFor`。这是 a11y 修复 + 让自动化测试可达。

### Bug C · SettingsDialog 同样的 Label htmlFor 缺失
**根因**：跟 Bug B 同款，新写的 SettingsDialog 8 个字段都没 htmlFor 绑定。

**修**：每个字段单独 `useId()` + 显式 `<Label htmlFor={id}>` + `<Input id={id}>`。

---

## 6 个测试 selector 问题（非 UI bug，是测试代码缺陷）

| # | 失败位置 | 问题 | 修法 |
|---|---|---|---|
| 1 | 02 Writing renders lens form | `getByText('历史线')` 多匹配 | `.first()` |
| 2 | 02 Atlas tree | `waitForResponse` 时序竞态 | 先 trigger `/api/atlas/compile`，再 navigate |
| 3 | 03 Memory tab Codex | 多匹配 strict mode | `.first()` |
| 4 | 03 ⌘K palette | 测试输入英文 "simulation" 但 cmdk 按 value="go 推演" 过滤 | 改输入 "推演" |
| 5 | 03 Settings dialog | `getByRole("heading")` 找不到 Radix DialogTitle | 改用 `[role="dialog"]` 包裹 |
| 6 | 04 Compose chapter | 等 LLM 响应 60s 超时 | 改成断言按钮进入"生成中…"态（不等响应） |

---

## 已验证工作的功能（截图证据）

存于 `.audit/e2e-final-screenshots/`：

1. `01-writing.png` — Writing workspace（lens form + 历史线 + Codex 右栏）
2. `02-simulation.png` — Simulation workspace（run-stage / auto-run）
3. `03-runtime.png` — Runtime workspace（daemon 启停按钮）
4. `04-world.png` — World workspace（Markdown textarea 预填）
5. `05-memory.png` — Memory workspace（4 section + 搜索）
6. `06-atlas.png` — Atlas workspace（**之前报错的页面，现在正常显示树**）
7. `07-settings-dialog.png` — **设置 Dialog（之前点了无反应的按钮，现在打开完整表单）**
8. `08-command-palette.png` — ⌘K 命令面板
9. `09-atlas-file-open.png` — Atlas 文件点击后右侧显示内容

---

## 工程产物

```
web/
├── playwright.config.ts          ← Playwright 配置
├── e2e/
│   ├── 00-shell.spec.ts          ← 3 测试
│   ├── 01-navigation.spec.ts     ← 8 测试
│   ├── 02-workspaces.spec.ts     ← 10 测试
│   ├── 03-controls.spec.ts       ← 6 测试
│   └── 04-runtime-flow.spec.ts   ← 2 测试
├── .audit/
│   ├── e2e-final-screenshots/    ← 9 张截图
│   ├── playwright-report/        ← HTML 报告（可 open 查看）
│   └── playwright-results/       ← 失败 trace + video
└── src/components/StatusBar.tsx  ← 修了 Bug A
└── src/components/SettingsDialog.tsx ← 修了 Bug C
└── src/workspaces/writing/Route.tsx  ← 修了 Bug B
└── src/workspaces/atlas/Route.tsx    ← 之前修的图谱

vitest.config.ts                  ← 加 web/e2e/ 排除（避免 vitest 误吃 playwright 文件）
```

---

## 怎么再跑

```bash
# 单测（src/）：
cd "/Users/chris0810/Documents/Codex/Novel System"
npm test                              # 202 passing

# E2E（前端 + 后端连通）：
cd web
npm run dev   # 在另一个终端，需要 dev server 先起来
cd ../web && npx playwright test       # 29 passing in ~12s

# 看 HTML 报告：
npx playwright show-report .audit/playwright-report
```

---

## 没测的（已知 + 主动选择）

- **真实 LLM compose 章节文本输出** — 那要 60s+ 真调 DeepSeek，已改为只验证按钮进入 "生成中…" 态
- **真实长 daemon 跑（>5 ticks）** — 不在 e2e 范围；synthesis 后续会做端到端 cron 验证
- **多浏览器** — Playwright 配置只跑 Chromium，要测 Firefox/Safari 加 projects 即可
- **移动断点** — 桌面 only（per 用户指定）

---

**总结**: 你 reported 的 2 个 bug 是 _发现真问题的入口_，全栈 e2e 又额外暴露了 1 个 a11y/StatusBar bug。3 个真 bug 全修，加 29 个 e2e 测试做回归网。后续若 UI 改动，跑 `npx playwright test` 即可保证不出新 regression。
