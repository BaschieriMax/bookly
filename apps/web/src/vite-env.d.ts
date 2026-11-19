/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sentry DSN for frontend error tracking; empty = disabled (DEC-031). */
  readonly VITE_SENTRY_DSN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
