

## Fix Supabase init error + stale hardcoded URL

### Scope (2 files only)

**1. `src/integrations/supabase/client.ts`** — Add a clear initialization guard so a missing env var produces an actionable error instead of the cryptic `"supabaseUrl is required"` from the SDK. Keep the existing `createClient<Database>(...)` call and auth options exactly as-is.

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing Supabase environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in your .env file and restart the dev server."
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { /* unchanged */ });
```

**2. `src/components/CatalogForm.tsx`** — Replace the stale hardcoded project URL and stale anon key (both pointing to `dpwdnuqvnclbjarowgmv`, the wrong project) at lines 115–118 and 194–197 with the env-var-based versions:

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

The `fetch(...)` URL and headers stay exactly as they are — only the constants change. Both occurrences (single fetch at line 115 and bulk fetch at line 194) get the same fix.

### Verified — no other hardcoded URLs

Searched the whole `src/` tree:
- `dpwdnuqvnclbjarowgmv` → only in `CatalogForm.tsx` (the 2 spots above)
- `supabase.co/functions` → no other matches
- `airtableGenerator.ts` and `useInvoice.ts` already use `import.meta.env.VITE_SUPABASE_URL` correctly

### What stays untouched
- `src/integrations/supabase/types.ts`
- All edge functions (`supabase/functions/*`)
- All hamper generation logic
- All UI, layout, styling
- `package.json` (`@supabase/supabase-js` stays)

### Validation after apply
1. App loads at `/` with no `"supabaseUrl is required"` error
2. `/staff/hamper-designer` — products fetch and hampers generate
3. Catalog Generator — single GHID lookup + bulk lookup hit the correct project (`qlzgtbtqnwrgtlhrqdqd`)
4. Invoice Generator — search, list, PDF all work

