import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Message, Attachment } from "@/components/predictive/PredictiveTypes";
import { ApiSuccessResponse } from "../../../types";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb", // Un límite menor ya que no maneja archivos
    },
  },
};

export async function PUT(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Verificar autenticación
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extraer sessionId de la URL
    const sessionId = request.url.split("/").filter(Boolean).pop();
    if (!sessionId) {
      return NextResponse.json(
        { error: "Invalid session ID" },
        { status: 400 }
      );
    }

    const { messages } = (await request.json()) as { messages: Message[] };

    const cleanMessages: Message[] = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      project_id: msg.project_id,
      session_id: msg.session_id,
      version_id:
        typeof msg.version_id === "string"
          ? parseInt(msg.version_id)
          : msg.version_id || 0,
      attachments:
        msg.attachments?.map((att: Attachment) => ({
          name: att.name,
          url: att.url,
          type: att.type,
        })) || [],
      prediction: msg.prediction
        ? {
            confidence: msg.prediction.confidence,
            data: msg.prediction.data,
            metrics: msg.prediction.metrics,
          }
        : undefined,
      thinking: msg.thinking || false, // Asegurar que thinking sea booleano
      isFirstMessage: msg.isFirstMessage ?? false, // Asegurar que isFirstMessage esté presente
    }));

    const { error } = await supabase
      .from("aria_predictive_chats")
      .update({
        messages: cleanMessages,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .eq("user_id", session.user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      messages: cleanMessages,
    } as ApiSuccessResponse);
  } catch (error) {
    console.error("Error updating messages:", error);
    return NextResponse.json(
      { error: "Failed to update messages" },
      { status: 500 }
    );
  }
}
