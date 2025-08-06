import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { token, userId } = await request.json();
  const supabase = createRouteHandlerClient({ cookies });

  const { data, error } = await supabase
    .from("aria_user_profiles") // Actualizado
    .update({ is_approved: true })
    .match({ id: userId, approval_token: token })
    .select();

  if (error || !data?.length) {
    return NextResponse.json(
      { error: "Invalid approval token" },
      { status: 400 }
    );
  }

  return NextResponse.json({ message: "User approved successfully" });
}
