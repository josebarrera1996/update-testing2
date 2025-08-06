import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-client";

export async function POST(req: NextRequest) {
  const supabase = createClient();

  try {
    const body = await req.json();
    const { message, session_id } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Llamar al webhook de N8N para generar el título
    const n8nResponse = await fetch(
      process.env.NEXT_PUBLIC_N8N_TITLE_WEBHOOK!,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, session_id }),
      }
    );

    if (!n8nResponse.ok) {
      console.error("N8N Response not OK:", await n8nResponse.text());
      throw new Error("Failed to generate title from N8N");
    }

    const data = await n8nResponse.json();

    // Manejar el formato de la respuesta
    const chatName =
      data.chatName ||
      (Array.isArray(data) && data[0]?.output ? data[0].output : null); // No uses fallback, deja el nombre por defecto

    // Actualizar el nombre del chat en Supabase si existe uno generado
    if (chatName) {
      const { error: updateError } = await supabase
        .from("hestia_chats")
        .update({ name: chatName })
        .eq("session_id", session_id);

      if (updateError) {
        console.error("Error updating chat name:", updateError);
      }
    }

    // Devuelve 204: No Content
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error in generate-title:", error);
    // Devuelve 204 aunque haya error, así el frontend nunca muestra fallback
    return new NextResponse(null, { status: 204 });
  }
}
