import { createClient } from "@/lib/supabase-client";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { session_id } = await request.json();

    if (!session_id) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Limpiar el estado de error
    const { error } = await supabase.from("hestia_states").upsert(
      {
        session_id,
        has_error: false,
        error_message: null,
        failed_message: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

    if (error) {
      console.error("Error clearing error state:", error);
      return NextResponse.json(
        { error: "Failed to clear error state" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in clear-error endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
