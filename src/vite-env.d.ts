/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AIRTABLE_BASE_ID: string
  readonly VITE_AIRTABLE_API_KEY: string
  readonly VITE_AIRTABLE_SALE_BASE_ID: string
  readonly VITE_AIRTABLE_SALE_TOKEN: string
  readonly VITE_VERCEL_OIDC_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
