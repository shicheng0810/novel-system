# DeepSeek V4 Agent Kernel Design

## Goal

Make DeepSeek V4 Pro the default high-capability model kernel for the novel agent system, with 1M context, long-output support, thinking mode, and `reasoning_effort=max` available to every model-backed path that needs world-scale reasoning.

## Confirmed Model Target

Official DeepSeek API docs describe `deepseek-v4-pro` as the high-accuracy model with a 1M context window, 384K max output, thinking and non-thinking modes, and `reasoning_effort` values including `high` and `max`.

The system should therefore move away from `deepseek-reasoner` as the default. Legacy names can remain compatible, but the first-class default profile is:

- `model`: `deepseek-v4-pro`
- `baseUrl`: `https://api.deepseek.com`
- `structuredBaseUrl`: `https://api.deepseek.com/beta`
- `thinkingMode`: `enabled`
- `reasoningEffort`: `max`
- `contextWindowTokens`: `1000000`
- `maxOutputTokens`: `384000`
- `timeoutMs`: `600000`

## Design Decision

Use a model capability profile instead of scattering V4 constants through request code. The profile becomes the contract between the AI settings UI, persisted local settings, provider construction, and task-level request planning.

This matters because the novel system has different model workloads:

- Short probes only need small output.
- Planner, scene-card, reviewer, and rewrite calls need reliable structured output.
- Composer calls need longer prose output, but should not default to 384K unless explicitly configured.
- `WorldDaemon`, `SimulationRun`, and `CanonGate` are agentic reasoning paths and should receive the largest default budgets.

## Architecture

Add a small DeepSeek profile module that owns defaults, normalization, and capability checks. `src/deepseek.ts` resolves a `ResolvedDeepSeekConfig` from explicit options, saved AI settings, environment variables, and the selected profile.

The request builder sends V4-specific controls only when the selected model supports them:

- For `deepseek-v4-*`, include `thinking: { type: "enabled" | "disabled" }`.
- When thinking is enabled, include `reasoning_effort: "high" | "max"`.
- When thinking is enabled or the legacy model is `deepseek-reasoner`, omit sampling controls such as `temperature`.
- Continue using `/beta/chat/completions` for strict tool calls.

## Agent-System Utilization

The runtime should not merely send bigger numbers. It should route model budgets by workload:

- `validation`: keep tiny output, fast timeout behavior.
- `structured`: use a larger V4 budget for planner, scene-card, reviewer, and JSON fallback.
- `prose`: allow longer chapter output than the old fixed 4200-token cap.
- `rewrite`: allow enough output for full scene replacement.
- `simulation`: use the largest default budget because this is the world-agent path.

For the first implementation pass, the provider will expose and honor the long-context profile, send max-effort thinking controls, and scale per-task output budgets. The next runtime pass is specified separately in `docs/superpowers/specs/2026-05-09-ds4-inspired-novel-runtime-kernel-design.md`: it adds the ds4-inspired session, context cache, worker, and trace layer needed before long-context prompt packing becomes reliable.

## DS4 Runtime Kernel Follow-Up

The DeepSeek profile is only the model capability layer. The novel system also needs a runtime layer that decides what long context to send, how to reuse stable context, and how to keep world-state mutation serial and auditable.

The ds4 project is the useful reference here because it keeps a narrow public API, one mutable session timeline, disk-backed reusable checkpoints, one worker that owns live state, and traceable cache decisions. The novel-system equivalent is not a C inference engine. It is:

- `NarrativeSession`: the mutable long-novel context timeline.
- `ContextPack`: the canonical, hashable bundle of canon, atlas, memory, reading artifacts, run history, metaphysics frame, directive, and model profile.
- `ContextCache`: a disk-backed cache for stable context packs and reusable prefixes.
- `NovelRuntimeWorker`: a serial queue that owns mutation of `WorldDaemon`, `SimulationRun`, and context/session state.
- `RuntimeTrace`: per-run observability for context sync, cache hits/misses, CanonGate decisions, and DeepSeek workload routing.

This keeps the model profile from becoming a pile of larger token limits. The V4 Pro 1M profile becomes useful only when the runtime can construct, compare, cache, and explain the long context it is sending.

## Settings And Compatibility

Workbench AI settings should persist the new fields while remaining compatible with old `studio-config.json` files that only contain `apiKey`, `baseUrl`, `model`, and `timeoutMs`.

Environment variables should also work for headless usage:

- `DEEPSEEK_MODEL`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_STRUCTURED_BASE_URL`
- `DEEPSEEK_TIMEOUT_MS`
- `DEEPSEEK_THINKING_MODE`
- `DEEPSEEK_REASONING_EFFORT`
- `DEEPSEEK_CONTEXT_WINDOW_TOKENS`
- `DEEPSEEK_MAX_OUTPUT_TOKENS`

## Error Handling

Invalid optional numeric settings should fall back to profile defaults. Invalid `thinkingMode` and `reasoningEffort` values should normalize to profile defaults instead of making the Studio unusable.

Strict tool failures keep the existing JSON fallback behavior. Token truncation on plain prose still fails fast, but the larger V4 budget should reduce false truncation.

## Tests

Add unit coverage for:

- Default config resolves to `deepseek-v4-pro`, 1M context, 384K output, thinking enabled, and max effort.
- V4 requests include `thinking` and `reasoning_effort`.
- Thinking requests omit `temperature`.
- Non-thinking V4 requests may include `temperature`.
- Simulation requests receive a larger V4 output budget.
- Workbench save/read/validate round-trips the new settings.
- Old saved AI settings still resolve with V4-compatible defaults for missing fields.

## Constraints

The repository was reinitialized after the corrupted `HEAD` was moved aside, but the working tree currently has no baseline commit and all project files appear untracked. Design and plan files can be edited safely, but implementation commits should wait until the project owner decides how to create the initial baseline.
