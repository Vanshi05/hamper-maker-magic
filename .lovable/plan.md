
Fix scope: only `src/components/hamper/airtableGenerator.ts`.

What broke
- The last change replaced the previously working product fetch with a direct `fetch()` that hard-requires `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- In the current preview/runtime, those values are coming through as missing in this path, so `fetchProducts()` throws immediately.
- That is why product prefetch fails and the hamper flow breaks before generation. The new optimizer itself is not the primary problem.

Plan
1. Restore `fetchProducts()` to a resilient implementation in `src/components/hamper/airtableGenerator.ts`.
   - Keep the current direct edge-function fetch as the first path when env vars are available.
   - Add a fallback to the previously working integrated client-based function call if those env vars are missing.
   - Keep the returned shape exactly the same: `Promise<AirtableProduct[]>`.

2. Normalize error handling inside `fetchProducts()`.
   - Return the same success/error behavior regardless of which path is used.
   - Preserve clear error messages so future regressions are easier to identify.

3. Do not touch anything else.
   - No UI changes.
   - No optimizer/scoring/selection changes.
   - No backend or Airtable changes.
   - No edits outside `src/components/hamper/airtableGenerator.ts`.

Technical details
- Root cause is the hard failure at the top of `fetchProducts()`:
  - `if (!supabaseUrl || !supabaseKey) throw new Error(...)`
- The safest recovery is a single-file compatibility fix:
  - env-based direct fetch when available
  - fallback invocation through the existing generated client when not
- This preserves the hamper optimization work while removing the runtime fragility introduced by the last prompt.

Validation after implementation
- Open `/staff/hamper-designer`
- Confirm the “Missing Supabase configuration” toast is gone
- Confirm products prefetch succeeds
- Generate hampers successfully from the questionnaire
- Click Edit / Regenerate and confirm the flow still works end-to-end
