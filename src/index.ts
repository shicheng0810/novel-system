// Novel System v3 · public API barrel.
// See src/README.md for architecture layers and design notes.

// Layer 1 · domain (pure types + helpers)
export * from "./domain";
export { parseWorldMarkdown } from "./domain/parse-world";

// Layer 2 · services
export { EventBus, type EventListener, type Unsubscribe, nowEvent } from "./services/event-bus";
export { WorldStore } from "./services/world-store";
export { MemoryService, type WriteMemoryInput } from "./services/memory-service";
export { AtlasService, type AtlasFile, type AtlasTreeNode } from "./services/atlas-service";
export type { LLMProvider, LlmCompleteRequest, LlmCompleteResult, LlmStructuredRequest, LlmStructuredResult, LlmMessage, LlmRole } from "./services/llm/types";
export { MockLLMProvider } from "./services/llm/mock";
export { DeepSeekProvider, DEFAULT_DEEPSEEK_PROFILE, type DeepSeekProfile, type DeepSeekProviderOptions } from "./services/llm/deepseek";
export type { EmbeddingProvider } from "./services/embedding/types";
export { MockEmbeddingProvider } from "./services/embedding/mock";
export { HttpEmbeddingProvider, type HttpEmbeddingOptions } from "./services/embedding/http";
export { AiSettingsStore, maskApiKey, type AiSettings } from "./services/ai-settings-store";

// Data plane
export { openDb, migrate, schemaVersion, type Db } from "./data/db";

// Metaphysics layer
export { computeBazi, fateFromBazi, parsePillars, type BirthInput } from "./metaphysics/bazi";
export { buildQimenBoard, buildQimenModifier, defaultQimenContext, type QimenBoard, type QimenPalace } from "./metaphysics/qimen";
export { deriveBaguaSituation } from "./metaphysics/bagua";
export { buildFrame, type BuildFrameInput } from "./metaphysics/frame";
export { scoreCandidate, scoreCandidates, normalizeWeights, type CandidateAction, type ScoredCandidate, type ScoreBreakdown } from "./metaphysics/prior";

// Verifiers
export { sanitizeProse, type SlopReport, type SlopIssue, type SlopCategory } from "./verify/slop";
export { verifyXianxia, type XianxiaReport, type XianxiaViolation, type XianxiaInput } from "./verify/xianxia";

// Director + agents
export { Director, type DirectorContext, type DirectorOptions, type TickPlan, type ArcPhase } from "./director/director";
export { CharacterAgent, type AgentInput, type Reflection, type CharacterAgentOptions } from "./agents/character";
export { AgentRegistry, type RegistryOptions } from "./agents/registry";

// Engine + daemon
export { runTick, type EngineDeps } from "./engine/tick";
export type { TickRequest, TickResult, TickContext, TickPhaseId } from "./engine/types";
export { Daemon, type DaemonStartRequest, type DaemonStatus } from "./daemon/daemon";

// HTTP/SSE surface
export { createServer, type CreateServerOptions, type ServerHandle } from "./server";
