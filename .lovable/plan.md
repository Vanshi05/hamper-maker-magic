
Audit only — no code changes.

What renders `/staff/hamper-designer`
- There is no `src/pages/staff/HamperDesigner.tsx`.
- The route is defined in `src/App.tsx`:
  - `import HamperDesigner from "./pages/HamperDesigner";`
  - `<Route path="/staff/hamper-designer" element={<HamperDesigner />} />`

Full import audit in `src/`

1) `src/integrations/supabase/client.ts`
- Exact import line:
  - `import { createClient } from '@supabase/supabase-js';`
- Is it in the `/staff/hamper-designer` import graph?
  - Not as a static top-level import from the page tree.
  - It is reached indirectly at runtime from `src/components/hamper/airtableGenerator.ts` via a dynamic import when `fetchProducts()` runs.

2) `src/lib/supabaseClient.ts`
- Exact import line:
  - `import { supabase as _supabase } from "@/integrations/supabase/client";`
- Is it in the `/staff/hamper-designer` import graph?
  - No.
  - I found no imports of `@/lib/supabaseClient` anywhere in `src/`.

3) `src/components/hamper/airtableGenerator.ts`
- Relevant import expression found:
  - `const { supabase } = await import("@/integrations/supabase/client");`
- Is it in the `/staff/hamper-designer` import graph?
  - Yes, directly.
  - `src/pages/HamperDesigner.tsx` imports:
    - `import { generateHampersFromAirtable, fetchProducts } from "@/components/hamper/airtableGenerator";`
  - `fetchProducts()` is called in a `useEffect` on page mount, so this dynamic import runs as soon as the hamper designer page loads.

No matches found
- No `from "@/lib/supabaseClient"` imports anywhere in `src/`.

Import graph for the hamper designer route
```text
src/App.tsx
  -> src/pages/HamperDesigner.tsx
     -> src/components/hamper/airtableGenerator.ts
        -> dynamic runtime import("@/integrations/supabase/client")
```

Separate unused path currently present
```text
src/lib/supabaseClient.ts
  -> src/integrations/supabase/client.ts
```
- But `src/lib/supabaseClient.ts` currently has no incoming imports, so it is not part of the hamper designer route path.

Does `src/lib/supabaseClient.ts` still exist?
- Yes.

Full contents of `src/lib/supabaseClient.ts`
```ts
import { supabase as _supabase } from "@/integrations/supabase/client";

let initialized = false;

export function getSupabaseClient() {
  if (!initialized) {
    initialized = true;
  }
  return _supabase;
}
```

Bottom-line from the audit
- In the current `src/` tree, I do not see any other static top-level import path from the hamper designer page into `@/integrations/supabase/client`.
- The active hamper designer path currently reaches the client through `src/components/hamper/airtableGenerator.ts`, and that happens via dynamic import inside `fetchProducts()`, which is invoked immediately on page mount.
- `src/lib/supabaseClient.ts` still exists, but it appears unused.
