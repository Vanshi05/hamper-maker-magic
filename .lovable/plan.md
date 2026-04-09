

## Invoice Generator — Fix Airtable Column Name Mismatches

### Problem
Two Airtable field names changed in the Sale table:
- `Sr No` → **`autonum`**
- `Invoice Date` → **`invoice_date`**
- `billing_address` was **deleted** from Sale (already handled — read from Sale_LI)

This breaks both the `invoice-list` and `invoicedata` edge functions.

Additionally, `src/hooks/useInvoice.ts` has a **hardcoded Supabase URL from a different project** (`dpwdnuqvnclbjarowgmv`) instead of using the current project's env vars.

---

### Changes

**1. `supabase/functions/invoice-list/index.ts`**
- Change sort field from `Invoice%20Date` → `invoice_date` (line 26)
- Change `record.fields["Sr No"]` → `record.fields["autonum"]` (line 47)
- Change `record.fields["Invoice Date"]` → `record.fields["invoice_date"]` (line 49)
- Remove `billing_address` / `Billing Address` read from Sale records (line 50) — field was deleted

**2. `supabase/functions/invoicedata/index.ts`**
- Change filter formula from `{Sr No}` → `{autonum}` (line 36)
- Change `saleFields["Sr No"]` → `saleFields["autonum"]` (line 228)
- Change `saleFields["Invoice Date"]` priority to `saleFields["invoice_date"]` first (line 229)

**3. `src/hooks/useInvoice.ts`**
- Replace hardcoded `SUPABASE_URL` and `SUPABASE_ANON_KEY` with `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` — the current values point to a completely different Supabase project

**4. `api/invoice/list.js` and `api/invoice/data.js`** (Vercel serverless — kept in sync)
- Same field name updates: `Sr No` → `autonum`, `Invoice Date` → `invoice_date`

---

### What stays unchanged
- No logic changes, no Airtable API call structure changes
- Sale_LI table references stay the same (no column renames reported there)
- Frontend types, components, and PDF generation — untouched

