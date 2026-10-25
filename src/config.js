export const APP_ID = "tabbit-xhs-album-builder";
export const CLEANUP_KEY = "__tabbitXhsAlbumBuilderCleanup";

export const DEFAULT_CONFIG = {
  maxScrollRounds: 180,
  scrollStepRatio: 0.82,
  scrollDelay: 720,
  stableRoundsToStop: 5,
  maxTitlesForPrompt: 500,
  classificationBatchSize: 100,
  maxClassificationContextCategories: 20,
  llmBatchTimeoutMs: 45_000,
  apiRequestTimeoutMs: 12_000,
  apiRetryCount: 2,
  apiRetryDelay: 520,
  apiAddDelay: 120,
  apiEnsureCollectBeforeMove: false,
  defaultGranularity: "coarse"
};

const integerKeys = {
  maxScrollRounds: [1, 1000],
  stableRoundsToStop: [1, 20],
  maxTitlesForPrompt: [1, 20_000],
  classificationBatchSize: [20, 500],
  maxClassificationContextCategories: [1, 200],
  llmBatchTimeoutMs: [5_000, 180_000],
  apiRequestTimeoutMs: [3_000, 60_000],
  apiRetryCount: [0, 10],
  apiRetryDelay: [100, 10_000],
  apiAddDelay: [0, 10_000]
};

export function getConfig() {
  const overrides = window.__tabbitXhsAlbumBuilderConfig || {};
  return normalizeConfig({ ...DEFAULT_CONFIG, ...overrides });
}

export function normalizeConfig(input) {
  const config = { ...input };
  // Ignore category caps left in configuration from older versions.
  delete config.maxCategories;
  for (const [key, [min, max]] of Object.entries(integerKeys)) {
    const value = Math.floor(Number(config[key]));
    config[key] = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : DEFAULT_CONFIG[key];
  }

  const ratio = Number(config.scrollStepRatio);
  config.scrollStepRatio = Number.isFinite(ratio) ? Math.max(0.25, Math.min(1.5, ratio)) : DEFAULT_CONFIG.scrollStepRatio;

  config.apiEnsureCollectBeforeMove = config.apiEnsureCollectBeforeMove === true;
  config.defaultGranularity = config.defaultGranularity === "fine" ? "fine" : "coarse";
  return config;
}
