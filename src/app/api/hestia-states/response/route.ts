import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const session_id = searchParams.get("session_id");

    if (!session_id) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 }
      );
    }

    // Obtener el pending response de hestia_states
    const { data, error } = await supabase
      .from("hestia_states")
      .select("pending_response, is_loading")
      .eq("session_id", session_id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching pending response:", error);
      return NextResponse.json(
        { error: "Failed to fetch pending response", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      pending_response: data?.pending_response || null,
      is_loading: data?.is_loading || false,
    });
  } catch (error) {
    console.error("Error in GET /api/hestia-states/response:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { session_id, pending_response } = body;

    if (!session_id || !pending_response) {
      return NextResponse.json(
        { error: "session_id and pending_response are required" },
        { status: 400 }
      );
    }

    // Upsert el pending response en hestia_states
    const { error } = await supabase.from("hestia_states").upsert(
      {
        session_id,
        pending_response,
        is_loading: false, // Cuando hay respuesta, ya no está loading
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

    if (error) {
      console.error("Error setting pending response:", error);
      return NextResponse.json(
        { error: "Failed to set pending response", details: error },
        { status: 500 }
      );
    }

    console.log("✅ Pending response set for session:", session_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/hestia-states/response:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    if (!session_id) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 }
      );
    }

    // Limpiar el pending response
    const { error } = await supabase.from("hestia_states").upsert(
      {
        session_id,
        pending_response: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

    if (error) {
      console.error("Error clearing pending response:", error);
      return NextResponse.json(
        { error: "Failed to clear pending response", details: error },
        { status: 500 }
      );
    }

    console.log("✅ Pending response cleared for session:", session_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/hestia-states/response:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}
