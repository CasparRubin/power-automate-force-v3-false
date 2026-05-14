const PREFIX = "[power-automate-editor-version-enforcer] [popup]";

/** DEV-only structured logs for preference save / tab reload debugging. */
export function policyPopupLog(message: string, extra?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) {
    return;
  }
  console.log(PREFIX, message, ...(extra !== undefined ? [extra] : []));
}
