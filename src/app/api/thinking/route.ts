import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ⭐ USAR CLIENTE DE SERVICIO (no requiere autenticación de usuario)
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⭐ CLAVE DE SERVICIO
);

// Mantener el almacenamiento en memoria como respaldo
const thinkingStore = new Map<
  string,
  {
    content: string;
    isComplete: boolean;
    timestamp: number;
  }
>();

// Limpieza periódica de entradas antiguas
setInterval(() => {
  const now = Date.now();
  thinkingStore.forEach((value, key) => {
    if (now - value.timestamp > 30 * 60 * 1000) {
      thinkingStore.delete(key);
    }
  });
}, 15 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let sessionId,
      versionId,
      thinking,
      isComplete = false;

    // Manejar ambos formatos de datos
    if (body.body) {
      sessionId = body.body.session_id;
      versionId = body.body.version_id;
      thinking = body.body.thinking;
    } else {
      sessionId = body.session_id;
      versionId = body.version_id;
      thinking = body.thinking;
      isComplete = body.is_complete || false;
    }

    if (!sessionId || versionId === undefined || thinking === undefined) {
      console.error("Parámetros faltantes:", { body });
      return NextResponse.json(
        { error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    const key = `${sessionId}:${versionId}`;

    // Almacenar en memoria como respaldo
    thinkingStore.set(key, {
      content: thinking,
      isComplete: isComplete,
      timestamp: Date.now(),
    });

    console.log(
      `📥 Thinking recibido para ${key}:`,
      thinking.substring(0, 100) + "..."
    );

    // ⭐ IMPLEMENTAR REINTENTOS CON DELAYS PARA MANEJAR TIMING
    const findAndUpdateThinking = async (
      attempt = 1,
      maxAttempts = 5
    ): Promise<boolean> => {
      try {
        console.log(
          `🔍 Intento ${attempt}/${maxAttempts} - Buscando thinking en hestia_agent_thinking`
        );

        // ⭐ BUSCAR EN hestia_agent_thinking PRIMERO
        const { data: thinkingData, error: thinkingError } =
          await supabaseServiceRole
            .from("hestia_agent_thinking")
            .select("output_think")
            .eq("session_id", sessionId)
            .eq("version_id", versionId)
            .single();

        if (thinkingError || !thinkingData?.output_think) {
          console.log(
            `❌ Intento ${attempt} - No encontrado en hestia_agent_thinking:`,
            thinkingError?.message || "Sin contenido"
          );

          if (attempt < maxAttempts) {
            const delay = attempt * 2000; // 2s, 4s, 6s, 8s, 10s
            console.log(
              `⏳ Esperando ${delay}ms antes del siguiente intento...`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            return findAndUpdateThinking(attempt + 1, maxAttempts);
          }
          return false;
        }

        console.log(
          `✅ Intento ${attempt} - Thinking encontrado:`,
          thinkingData.output_think.substring(0, 100) + "..."
        );

        // ⭐ ACTUALIZAR EL MENSAJE EN hestia_chats
        const { data: chatData, error: chatError } = await supabaseServiceRole
          .from("hestia_chats")
          .select("messages")
          .eq("session_id", sessionId)
          .single();

        if (chatError || !chatData?.messages) {
          console.error(`❌ Error obteniendo chat:`, chatError);
          return false;
        }

        const messages = chatData.messages as any[];
        console.log(`📊 Chat encontrado con ${messages.length} mensajes`);

        // Buscar y actualizar el mensaje del asistente
        let messageUpdated = false;
        const updatedMessages = messages.map((message) => {
          if (
            message.role === "assistant" &&
            message.session_id === sessionId &&
            message.version_id === versionId &&
            message.thinking === true // ⭐ Solo actualizar si thinking es true (boolean)
          ) {
            messageUpdated = true;
            console.log(`🎯 Mensaje encontrado, actualizando thinking:`, {
              messageId: message.id,
              versionId: message.version_id,
            });

            return {
              ...message,
              thinking: thinkingData.output_think, // ⭐ Reemplazar boolean con string
            };
          }
          return message;
        });

        if (!messageUpdated) {
          console.warn(
            `⚠️ No se encontró mensaje del asistente con thinking=true para actualizar`
          );
          console.log(
            "📋 Mensajes disponibles:",
            messages
              .filter((m) => m.role === "assistant")
              .map((m) => ({
                id: m.id,
                version_id: m.version_id,
                thinking: typeof m.thinking,
                thinkingValue: m.thinking,
              }))
          );
          return false;
        }

        // Guardar mensajes actualizados
        const { error: updateError } = await supabaseServiceRole
          .from("hestia_chats")
          .update({
            messages: updatedMessages,
            updated_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId);

        if (updateError) {
          console.error(`❌ Error actualizando mensajes:`, updateError);
          return false;
        }

        console.log(`🎉 Thinking actualizado exitosamente para ${key}`);
        return true;
      } catch (error) {
        console.error(`❌ Intento ${attempt} - Error:`, error);

        if (attempt < maxAttempts) {
          const delay = attempt * 2000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return findAndUpdateThinking(attempt + 1, maxAttempts);
        }
        return false;
      }
    };

    // ⭐ EJECUTAR LA ACTUALIZACIÓN CON REINTENTOS
    const success = await findAndUpdateThinking();

    if (success) {
      console.log(`🎉 Thinking procesado exitosamente para ${key}`);
    } else {
      console.error(
        `💥 No se pudo procesar thinking para ${key} después de todos los intentos`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Error procesando datos de thinking:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const versionId = searchParams.get("versionId");

  if (!sessionId || !versionId) {
    return NextResponse.json(
      { error: "Faltan parámetros requeridos" },
      { status: 400 }
    );
  }

  const key = `${sessionId}:${versionId}`;
  const thinkingData = thinkingStore.get(key);

  if (!thinkingData) {
    return NextResponse.json({
      content: "",
      isComplete: false,
    });
  }

  return NextResponse.json({
    content: thinkingData.content,
    isComplete: thinkingData.isComplete,
  });
}
