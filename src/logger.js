export function errorMessage(error) {
  if (!error) return "未知错误";
  return String(
    error.message ||
      error.msg ||
      error.response?.message ||
      error.response?.msg ||
      error.data?.message ||
      error.data?.msg ||
      error
  ).replace(/\s+/g, " ").trim();
}

export function errorDetail(error) {
  if (!error || typeof error !== "object") return {};
  return {
    name: String(error.name || "").trim(),
    message: errorMessage(error),
    code: error.code ?? error.response?.code ?? error.data?.code,
    status: error.status ?? error.response?.status,
    stack: String(error.stack || "").split(" at ").slice(0, 3).join(" at ")
  };
}

export const logger = {
  debug(label, detail = undefined) {
    if (detail === undefined) console.debug(`[Tabbit XHS] ${label}`);
    else console.debug(`[Tabbit XHS] ${label}`, detail);
  },
  warn(label, detail = undefined) {
    if (detail === undefined) console.warn(`[Tabbit XHS] ${label}`);
    else console.warn(`[Tabbit XHS] ${label}`, detail);
  },
  error(label, error) {
    console.error(`[Tabbit XHS] ${label}`, {
      error: errorMessage(error),
      detail: errorDetail(error)
    });
  }
};
