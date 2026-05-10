import { DEFAULT_DEEPSEEK_PROFILE } from "./deepseek-profile";

const configured = Boolean(process.env.DEEPSEEK_API_KEY);

console.log(
  [
    `DeepSeek model: ${DEFAULT_DEEPSEEK_PROFILE.model}`,
    `Context window: ${DEFAULT_DEEPSEEK_PROFILE.contextWindowTokens}`,
    `Reasoning effort: ${DEFAULT_DEEPSEEK_PROFILE.reasoningEffort}`,
    configured
      ? "DEEPSEEK_API_KEY is configured. Use the workbench or provider APIs for live generation."
      : "DEEPSEEK_API_KEY is not set. Set it before running live DeepSeek generation.",
  ].join("\n"),
);

