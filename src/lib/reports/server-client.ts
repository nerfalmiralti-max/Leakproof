import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ReportServiceError } from "./server-errors";

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new ReportServiceError(
      503,
      "Reports are not configured. Contact the operator.",
    );
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
