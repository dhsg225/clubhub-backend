/// <reference types="vite/client" />

// Extends Vite's generated ImportMetaEnv with ClubHub-specific variables.
// TypeScript will enforce these are accessed via import.meta.env.VITE_*
// and will flag any typos in env var names at compile time.
interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
