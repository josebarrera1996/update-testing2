import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { registeredUsersTotal, activeSessionsTotal } from "./metrics";

export async function updateUserMetrics() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { count: userCount, error: userError } = await supabase
      .from("aria_user_profiles")
      .select("*", { count: "exact", head: true });
    
    if (!userError && userCount !== null) {
      registeredUsersTotal.set(userCount);
    }
    
    const { count: sessionCount, error: sessionError } = await supabase
      .from("aria_user_profiles")
      .select("*", { count: "exact", head: true })
      .not("last_sign_in_at", "is", null);
    
    if (!sessionError && sessionCount !== null) {
      activeSessionsTotal.set(sessionCount || 0);
    }
    
  } catch (error) {
    console.error("Error updating user metrics:", error);
  }
}
