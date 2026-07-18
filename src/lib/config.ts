// Instance configuration, read from the environment. Forkers change these
// without touching code.

export const appConfig = {
  societyName: process.env.SOCIETY_NAME || "Orchid Breeding Program",
  aiEnabled:
    process.env.AI_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY,
  aiModel: process.env.AI_MODEL || "claude-opus-4-8",
  sessionSecret: process.env.SESSION_SECRET || "insecure-dev-secret-change-me",
};
