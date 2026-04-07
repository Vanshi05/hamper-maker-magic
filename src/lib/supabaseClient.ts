import { supabase as _supabase } from "@/integrations/supabase/client";

let initialized = false;

export function getSupabaseClient() {
  if (!initialized) {
    initialized = true;
  }
  return _supabase;
}
