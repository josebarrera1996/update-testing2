import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb", // Un límite menor ya que no maneja archivos
    },
  },
};

// GET /api/predictive/chats
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  // Verificar autenticación
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: chats, error } = await supabase
      .from("aria_predictive_chats") // Actualizado nombre de la tabla
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ chats: chats || [] });
  } catch (error) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

// POST /api/predictive/chats
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();

    const chat = {
      id: crypto.randomUUID(),
      user_id: session.user.id,
      project_id: body.project_id || crypto.randomUUID(),
      session_id: sessionId,
      version_id: 0,
      name: body.name || `Predicción ${now}`,
      messages: [],
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("aria_predictive_chats")
      .insert(chat)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating chat:", error);
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 }
    );
  }
}
