import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  console.log("🔍 GET /api/hestia-states/pending called");

  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      console.log("❌ Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const session_id = searchParams.get("session_id");

    console.log("🔍 Looking for pending message for session:", session_id);

    if (!session_id) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 }
      );
    }

    // Obtener el pending message de hestia_states
    const { data, error } = await supabase
      .from("hestia_states")
      .select("pending_messages")
      .eq("session_id", session_id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching pending message:", error);
      return NextResponse.json(
        { error: "Failed to fetch pending message", details: error },
        { status: 500 }
      );
    }

    console.log(
      "✅ Pending message result:",
      data?.pending_messages ? "Found" : "Not found"
    );
    return NextResponse.json({
      pending_messages: data?.pending_messages || null,
    });
  } catch (error) {
    console.error("Error in GET /api/hestia-states/pending:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log("🔍 POST /api/hestia-states/pending called");

  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { session_id, pending_message } = body;

    console.log("🔍 Setting pending message for session:", session_id);

    if (!session_id || !pending_message) {
      return NextResponse.json(
        { error: "session_id and pending_message are required" },
        { status: 400 }
      );
    }

    // Upsert el pending message en hestia_states
    const { error } = await supabase.from("hestia_states").upsert(
      {
        session_id,
        pending_messages: pending_message,
        is_loading: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

    if (error) {
      console.error("Error setting pending message:", error);
      return NextResponse.json(
        { error: "Failed to set pending message", details: error },
        { status: 500 }
      );
    }

    console.log("✅ Pending message set for session:", session_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/hestia-states/pending:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  console.log("🔍 DELETE /api/hestia-states/pending called");

  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { session_id } = body;

    console.log("🔍 Clearing pending message for session:", session_id);

    if (!session_id) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 }
      );
    }

    // Limpiar el pending message en hestia_states
    const { error } = await supabase.from("hestia_states").upsert(
      {
        session_id,
        pending_messages: null,
        is_loading: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

    if (error) {
      console.error("Error clearing pending message:", error);
      return NextResponse.json(
        { error: "Failed to clear pending message", details: error },
        { status: 500 }
      );
    }

    console.log("✅ Pending message cleared for session:", session_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/hestia-states/pending:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}
