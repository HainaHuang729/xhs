import { DEFAULT_CONFIG } from "./config.js";

export const state = {
  observer: null,
  scanTimer: null,
  running: false,
  adding: false,
  collected: [],
  existingAlbums: [],
  plan: null,
  apiModule: null,
  profileUserId: "",
  publicAlbum: false,
  granularity: DEFAULT_CONFIG.defaultGranularity,
  assignmentCache: new Map(),
  boardIdMap: new Map(),
  config: { ...DEFAULT_CONFIG }
};

export function resetWorkflowState() {
  state.running = false;
  state.adding = false;
  state.collected = [];
  state.existingAlbums = [];
  state.plan = null;
  state.publicAlbum = false;
  state.assignmentCache = new Map();
  state.boardIdMap = new Map();
}
