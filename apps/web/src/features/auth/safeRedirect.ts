/** Only same-app relative paths are allowed as redirect targets (no open redirect). */
export function safeRedirect(target: string | null): string {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/'
}
