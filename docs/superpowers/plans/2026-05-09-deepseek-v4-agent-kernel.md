# DeepSeek V4 Agent Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make `deepseek-v4-pro` with 1M context and `reasoning_effort=max` the default model kernel for writing, simulation, and runtime agent paths.

**Architecture:** Add a DeepSeek model-profile module, extend saved AI settings and provider options, update request construction to send V4 thinking controls, and scale output budgets by workload. Workbench exposes the same fields so the runtime, daemon, simulation, and writing providers all resolve through one configuration path.

**Tech Stack:** TypeScript, Vitest, Node fetch, Vite Workbench, existing DeepSeek chat completions provider.

---

## File Structure

- Create `src/deepseek-profile.ts`: DeepSeek V4 defaults, normalization helpers, model capability checks, and per-workload token budget resolution.
- Modify `src/ai-settings.ts`: persist optional V4 fields and default missing fields safely.
- Modify `src/deepseek.ts`: extend provider options/config, use profile defaults, send `thinking` and `reasoning_effort`, omit sampling controls for thinking mode, and scale max tokens.
- Modify `workbench/src/contracts.ts`: extend `AiSettingsPayload` and `SaveAiSettingsRequest`.
- Modify `workbench/src/server.ts`: pass through and persist new settings for save/validate/session.
- Modify `workbench/src/App.tsx`: expose advanced AI settings fields and use V4 defaults.
- Modify `tests/deepseek.test.ts`: cover V4 defaults, request body controls, and simulation token scaling.
- Modify `tests/workbench-server.test.ts`: cover settings round trip and validation pass-through.

## Task 1: Add DeepSeek V4 Profile Contract

**Files:**
- Create: `src/deepseek-profile.ts`
- Test: `tests/deepseek.test.ts`

- [x] **Step 1: Write failing tests for V4 defaults**

Add a test in `tests/deepseek.test.ts` under `describe("deepseek narrative integration", ...)`:

```ts
test("defaults to DeepSeek V4 Pro max-effort long-context settings", () => {
  const config = resolveDeepSeekConfig({
    apiKey: "test-key",
    fetchImpl: vi.fn<typeof fetch>(),
  });

  expect(config.model).toBe("deepseek-v4-pro");
  expect(config.timeoutMs).toBe(600000);
  expect(config.thinkingMode).toBe("enabled");
  expect(config.reasoningEffort).toBe("max");
  expect(config.contextWindowTokens).toBe(1000000);
  expect(config.maxOutputTokens).toBe(384000);
});
```

- [x] **Step 2: Run test to verify RED**

Run: `npm test -- tests/deepseek.test.ts -t "defaults to DeepSeek V4 Pro"`

Expected: FAIL because `ResolvedDeepSeekConfig` does not yet expose the new fields and default model is still `deepseek-reasoner`.

- [x] **Step 3: Create profile module**

Create `src/deepseek-profile.ts` with:

```ts
export type DeepSeekThinkingMode = "enabled" | "disabled";
export type DeepSeekReasoningEffort = "high" | "max";
export type DeepSeekWorkload = "validation" | "structured" | "prose" | "rewrite" | "simulation";

export type DeepSeekModelProfile = {
  model: string;
  baseUrl: string;
  structuredBaseUrl: string;
  timeoutMs: number;
  thinkingMode: DeepSeekThinkingMode;
  reasoningEffort: DeepSeekReasoningEffort;
  contextWindowTokens: number;
  maxOutputTokens: number;
};

export const DEEPSEEK_V4_PRO_PROFILE: DeepSeekModelProfile = {
  model: "deepseek-v4-pro",
  baseUrl: "https://api.deepseek.com",
  structuredBaseUrl: "https://api.deepseek.com/beta",
  timeoutMs: 600_000,
  thinkingMode: "enabled",
  reasoningEffort: "max",
  contextWindowTokens: 1_000_000,
  maxOutputTokens: 384_000,
};

export const DEFAULT_DEEPSEEK_PROFILE = DEEPSEEK_V4_PRO_PROFILE;

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function normalizeThinkingMode(value: unknown, fallback = DEFAULT_DEEPSEEK_PROFILE.thinkingMode): DeepSeekThinkingMode {
  return value === "enabled" || value === "disabled" ? value : fallback;
}

export function normalizeReasoningEffort(
  value: unknown,
  fallback = DEFAULT_DEEPSEEK_PROFILE.reasoningEffort,
): DeepSeekReasoningEffort {
  return value === "high" || value === "max" ? value : fallback;
}

export function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function isDeepSeekV4Model(model: string): boolean {
  return model.trim().toLowerCase().startsWith("deepseek-v4-");
}

export function isLegacyReasonerModel(model: string): boolean {
  return model.trim().toLowerCase() === "deepseek-reasoner";
}

export function shouldSendThinkingControls(model: string): boolean {
  return isDeepSeekV4Model(model);
}

export function shouldOmitSamplingControls(model: string, thinkingMode: DeepSeekThinkingMode): boolean {
  return isLegacyReasonerModel(model) || (isDeepSeekV4Model(model) && thinkingMode === "enabled");
}

const WORKLOAD_OUTPUT_TARGETS: Record<DeepSeekWorkload, number> = {
  validation: 64,
  structured: 16_000,
  prose: 32_000,
  rewrite: 24_000,
  simulation: 64_000,
};

export function resolveWorkloadMaxTokens(input: {
  requestedMaxTokens: number;
  configuredMaxOutputTokens: number;
  contextWindowTokens: number;
  workload: DeepSeekWorkload;
}): number {
  const target = input.contextWindowTokens >= 1_000_000
    ? Math.max(input.requestedMaxTokens, WORKLOAD_OUTPUT_TARGETS[input.workload])
    : input.requestedMaxTokens;
  return Math.min(target, input.configuredMaxOutputTokens);
}
```

- [x] **Step 4: Extend `DeepSeekProviderOptions` and `ResolvedDeepSeekConfig`**

In `src/deepseek.ts`, import the profile helpers and add these fields to both types:

```ts
thinkingMode?: DeepSeekThinkingMode;
reasoningEffort?: DeepSeekReasoningEffort;
contextWindowTokens?: number;
maxOutputTokens?: number;
```

For `ResolvedDeepSeekConfig`, make them required.

- [x] **Step 5: Resolve profile defaults**

Update `resolveDeepSeekConfig()` to read explicit options, saved settings, env vars, and profile defaults for:

```ts
model: options.model ?? stored?.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_DEEPSEEK_PROFILE.model,
baseUrl: trimTrailingSlash(options.baseUrl ?? stored?.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_DEEPSEEK_PROFILE.baseUrl),
structuredBaseUrl: trimTrailingSlash(
  options.structuredBaseUrl ??
    process.env.DEEPSEEK_STRUCTURED_BASE_URL ??
    DEFAULT_DEEPSEEK_PROFILE.structuredBaseUrl,
),
timeoutMs: options.timeoutMs ??
  stored?.timeoutMs ??
  normalizePositiveInteger(process.env.DEEPSEEK_TIMEOUT_MS, DEFAULT_DEEPSEEK_PROFILE.timeoutMs),
thinkingMode: normalizeThinkingMode(options.thinkingMode ?? stored?.thinkingMode ?? process.env.DEEPSEEK_THINKING_MODE),
reasoningEffort: normalizeReasoningEffort(
  options.reasoningEffort ?? stored?.reasoningEffort ?? process.env.DEEPSEEK_REASONING_EFFORT,
),
contextWindowTokens: normalizePositiveInteger(
  options.contextWindowTokens ?? stored?.contextWindowTokens ?? process.env.DEEPSEEK_CONTEXT_WINDOW_TOKENS,
  DEFAULT_DEEPSEEK_PROFILE.contextWindowTokens,
),
maxOutputTokens: normalizePositiveInteger(
  options.maxOutputTokens ?? stored?.maxOutputTokens ?? process.env.DEEPSEEK_MAX_OUTPUT_TOKENS,
  DEFAULT_DEEPSEEK_PROFILE.maxOutputTokens,
),
```

- [x] **Step 6: Run test to verify GREEN**

Run: `npm test -- tests/deepseek.test.ts -t "defaults to DeepSeek V4 Pro"`

Expected: PASS.

## Task 2: Send V4 Thinking And Max-Effort Controls

**Files:**
- Modify: `src/deepseek.ts`
- Test: `tests/deepseek.test.ts`

- [x] **Step 1: Write failing request-body test**

Add:

```ts
test("sends DeepSeek V4 thinking controls and omits temperature for max-effort thinking", async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(textResponse("pong"));

  await validateDeepSeekConnection({
    apiKey: "test-key",
    fetchImpl,
    model: "deepseek-v4-pro",
    thinkingMode: "enabled",
    reasoningEffort: "max",
  });

  const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}")) as Record<string, unknown>;
  expect(request.model).toBe("deepseek-v4-pro");
  expect(request.thinking).toEqual({ type: "enabled" });
  expect(request.reasoning_effort).toBe("max");
  expect(request.temperature).toBeUndefined();
});
```

Also import `validateDeepSeekConnection` from `../src/index`.

- [x] **Step 2: Run test to verify RED**

Run: `npm test -- tests/deepseek.test.ts -t "sends DeepSeek V4 thinking controls"`

Expected: FAIL because request body does not include `thinking` or `reasoning_effort`.

- [x] **Step 3: Update request body construction**

In `executeRequest()`:

```ts
const requestBody: Record<string, unknown> = {
  model: config.model,
  messages: input.messages,
  stream: false,
  max_tokens: resolveWorkloadMaxTokens({
    requestedMaxTokens: input.maxTokens,
    configuredMaxOutputTokens: config.maxOutputTokens,
    contextWindowTokens: config.contextWindowTokens,
    workload: input.workload,
  }),
};

if (shouldSendThinkingControls(config.model)) {
  requestBody.thinking = { type: config.thinkingMode };
  if (config.thinkingMode === "enabled") {
    requestBody.reasoning_effort = config.reasoningEffort;
  }
}

if (!shouldOmitSamplingControls(config.model, config.thinkingMode)) {
  requestBody.temperature = config.temperature;
}
```

- [x] **Step 4: Add workload to request inputs**

Extend the `executeRequest()` input type with:

```ts
workload: DeepSeekWorkload;
```

Pass workload values:

```ts
requestJsonFallback: "structured"
requestStructuredTool: options.workload
requestPlainText: options.workload
validation prompt: "validation"
planner/scene/reviewer: "structured"
composer: "prose"
rewrite: "rewrite"
simulation: "simulation"
```

Add `workload: DeepSeekWorkload` to `PromptOptions`.

- [x] **Step 5: Run targeted test**

Run: `npm test -- tests/deepseek.test.ts -t "sends DeepSeek V4 thinking controls"`

Expected: PASS.

## Task 3: Scale Agentic Output Budgets

**Files:**
- Modify: `src/deepseek.ts`
- Test: `tests/deepseek.test.ts`

- [x] **Step 1: Write failing simulation budget test**

Add:

```ts
test("uses a larger long-context output budget for simulation requests", async () => {
  const { engine, stageResult } = createFixture();
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
    structuredToolResponse("emit_simulation_stage", {
      canon: {
        event: {
          id: "ai-stage",
          title: "AI 正史推进",
          summary: "世界推演继续推进。",
          stageLabel: "外门试炼",
          involvedCharacters: ["林焰"],
          location: "外门山城",
          qimenContext: stageResult.canonStage.event.qimenContext,
        },
        characterUpdates: [],
        relationshipUpdates: [],
      },
      branches: [],
    }),
  );

  await simulateStageWithDeepSeek(
    {
      parsed: engine.getParsedWorld(),
      canonLine: engine.getLine("canon"),
      directive: {
        stageLabel: "外门试炼",
        focusCharacterIds: ["林焰"],
      },
    },
    {
      apiKey: "test-key",
      fetchImpl,
      maxRetries: 0,
    },
  );

  const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}")) as Record<string, unknown>;
  expect(request.max_tokens).toBe(64000);
});
```

Import `simulateStageWithDeepSeek` from `../src/index`.

- [x] **Step 2: Run test to verify RED**

Run: `npm test -- tests/deepseek.test.ts -t "larger long-context output budget"`

Expected: FAIL because simulation still sends `3200`.

- [x] **Step 3: Assign workload values to every prompt**

Update each prompt factory:

```ts
plannerPrompt -> workload: "structured"
sceneCardPrompt -> workload: "structured"
composerPrompt -> workload: "prose"
reviewerPrompt -> workload: "structured"
rewritePrompt -> workload: "rewrite"
simulationPrompt -> workload: "simulation"
validateDeepSeekConnection inline prompt -> workload: "validation"
```

- [x] **Step 4: Run targeted test**

Run: `npm test -- tests/deepseek.test.ts -t "larger long-context output budget"`

Expected: PASS.

## Task 4: Persist V4 Settings

**Files:**
- Modify: `src/ai-settings.ts`
- Modify: `workbench/src/contracts.ts`
- Modify: `workbench/src/server.ts`
- Test: `tests/deepseek.test.ts`
- Test: `tests/workbench-server.test.ts`

- [x] **Step 1: Write failing persistence tests**

In `tests/deepseek.test.ts`, extend the existing persisted-settings test save call:

```ts
thinkingMode: "enabled",
reasoningEffort: "max",
contextWindowTokens: 1000000,
maxOutputTokens: 384000,
```

Then assert the resolved config has the same values.

In `tests/workbench-server.test.ts`, update the save request in `can save, read, and clear persisted ai settings...` with the same fields and assert:

```ts
expect(fetched.settings.thinkingMode).toBe("enabled");
expect(fetched.settings.reasoningEffort).toBe("max");
expect(fetched.settings.contextWindowTokens).toBe(1000000);
expect(fetched.settings.maxOutputTokens).toBe(384000);
```

- [x] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/deepseek.test.ts tests/workbench-server.test.ts -t "persisted ai settings|can save"`

Expected: FAIL because settings types and payloads do not expose the new fields.

- [x] **Step 3: Extend settings types and save**

In `src/ai-settings.ts`, import profile types/helpers and extend `AiSettings`:

```ts
thinkingMode?: DeepSeekThinkingMode;
reasoningEffort?: DeepSeekReasoningEffort;
contextWindowTokens?: number;
maxOutputTokens?: number;
```

In `save()`, normalize:

```ts
thinkingMode: normalizeThinkingMode(input.thinkingMode),
reasoningEffort: normalizeReasoningEffort(input.reasoningEffort),
contextWindowTokens: normalizePositiveInteger(input.contextWindowTokens, DEFAULT_DEEPSEEK_PROFILE.contextWindowTokens),
maxOutputTokens: normalizePositiveInteger(input.maxOutputTokens, DEFAULT_DEEPSEEK_PROFILE.maxOutputTokens),
```

- [x] **Step 4: Extend Workbench contracts**

Add the same optional fields to `AiSettingsPayload` and required fields to `SaveAiSettingsRequest`.

- [x] **Step 5: Extend server handler payloads**

Update `toAiSettingsPayload()`, `validateAiSettings()`, `saveAiSettings()`, and the POST body mapping to pass the new fields through.

- [x] **Step 6: Run targeted tests**

Run: `npm test -- tests/deepseek.test.ts tests/workbench-server.test.ts -t "persisted ai settings|can save"`

Expected: PASS.

## Task 5: Expose Advanced V4 Settings In Workbench

**Files:**
- Modify: `workbench/src/App.tsx`
- Test: `npm --prefix workbench run build`

- [x] **Step 1: Extend form state**

Add fields to `AiSettingsFormState`:

```ts
thinkingMode: "enabled" | "disabled";
reasoningEffort: "high" | "max";
contextWindowTokens: string;
maxOutputTokens: string;
```

- [x] **Step 2: Use V4 defaults**

Update `aiSettingsToForm()` defaults:

```ts
model: settings?.model ?? "deepseek-v4-pro",
timeoutMs: String(settings?.timeoutMs ?? 600000),
thinkingMode: settings?.thinkingMode ?? "enabled",
reasoningEffort: settings?.reasoningEffort ?? "max",
contextWindowTokens: String(settings?.contextWindowTokens ?? 1000000),
maxOutputTokens: String(settings?.maxOutputTokens ?? 384000),
```

- [x] **Step 3: Send advanced settings**

Update `buildAiSettingsRequest()`:

```ts
model: form.model.trim() || "deepseek-v4-pro",
timeoutMs: Number(form.timeoutMs) || 600000,
thinkingMode: form.thinkingMode,
reasoningEffort: form.reasoningEffort,
contextWindowTokens: Number(form.contextWindowTokens) || 1000000,
maxOutputTokens: Number(form.maxOutputTokens) || 384000,
```

- [x] **Step 4: Render controls**

Add select/input controls under Model and Timeout:

```tsx
<label>
  Thinking
  <select
    value={aiSettingsForm.thinkingMode}
    onChange={(event) =>
      setAiSettingsForm((current) => ({ ...current, thinkingMode: event.target.value as "enabled" | "disabled" }))
    }
  >
    <option value="enabled">enabled</option>
    <option value="disabled">disabled</option>
  </select>
</label>
<label>
  Effort
  <select
    value={aiSettingsForm.reasoningEffort}
    onChange={(event) =>
      setAiSettingsForm((current) => ({ ...current, reasoningEffort: event.target.value as "high" | "max" }))
    }
  >
    <option value="max">max</option>
    <option value="high">high</option>
  </select>
</label>
<label>
  Context tokens
  <input
    value={aiSettingsForm.contextWindowTokens}
    onChange={(event) => setAiSettingsForm((current) => ({ ...current, contextWindowTokens: event.target.value }))}
  />
</label>
<label>
  Max output tokens
  <input
    value={aiSettingsForm.maxOutputTokens}
    onChange={(event) => setAiSettingsForm((current) => ({ ...current, maxOutputTokens: event.target.value }))}
  />
</label>
```

- [x] **Step 5: Build Workbench**

Run: `npm --prefix workbench run build`

Expected: PASS.

## Task 6: Full Verification

**Files:**
- No new source files.

- [x] **Step 1: Run DeepSeek tests**

Run: `npm test -- tests/deepseek.test.ts`

Expected: PASS.

- [x] **Step 2: Run Workbench server tests**

Run: `npm test -- tests/workbench-server.test.ts`

Expected: PASS.

- [x] **Step 3: Run full suite**

Run: `npm test`

Expected: PASS.

- [x] **Step 4: Run TypeScript check**

Run: `npm run check`

Expected: PASS.

- [x] **Step 5: Run Workbench build**

Run: `npm --prefix workbench run build`

Expected: PASS.

## Self-Review

- Spec coverage: default V4 Pro profile, max effort, 1M context, 384K output, request body controls, Workbench persistence, old settings compatibility, and agentic simulation budget are all covered.
- Placeholder scan: no unresolved placeholders remain.
- Type consistency: `thinkingMode`, `reasoningEffort`, `contextWindowTokens`, and `maxOutputTokens` use the same names across provider options, resolved config, AI settings, Workbench contracts, and tests.
- Known constraint: plan omits git commit steps because the repository currently reports corrupted `HEAD`; commit after git metadata is repaired.
