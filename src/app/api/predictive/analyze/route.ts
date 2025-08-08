import {
  createRouteHandlerClient,
  type SupabaseClient,
} from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Agent, fetch as undiciFetch } from "undici";
import crypto from "crypto";
import { type S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import jwt from "jsonwebtoken";
import { httpRequestDuration, httpRequestTotal, httpRequestsActive, supabaseOperations, supabaseConnectionsActive, supabaseQueryDuration, n8nWorkflowDuration } from "@/lib/metrics";

import type { Message as OriginalMessage } from "@/components/predictive/PredictiveTypes";

type Message = OriginalMessage & { thinking?: boolean };

export const config = {
  runtime: "nodejs",
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

interface ExtendedRequestInit extends RequestInit {
  dispatcher?: any;
}

type ChatData = {
  project_id: string;
  messages: Message[];
  version_id: number;
};

const agent = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
});

const N8N_TIMEOUT = 800_000;

const N8N_WORKFLOW =
  process.env.N8N_WEBHOOK_URL ||
  "https://aria-studio-k8s.garagedeepanalytics.com/webhook/aria-crew-ds-test";

// JWT Configuration
const JWT_SECRET = process.env.N8N_JWT_SECRET || "your-secret-key";
const JWT_ISSUER = "HestiaAuthenticator";
const JWT_AUDIENCE = "HestiaN8NFlows";
const JWT_EXPIRATION_MINUTES = Number.parseInt(
  process.env.JWT_EXPIRATION_MINUTES || "60"
); // Default: 60 minutos

// Función para generar JWT
function generateN8NJWT(
  userId: string,
  projectId: string,
  userRole: string
): string {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    // Standard Claims
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    sub: userId,
    exp: now + JWT_EXPIRATION_MINUTES * 60, // Configurable
    iat: now,
    jti: crypto.randomUUID(),

    // Custom Claims
    pid: projectId,
    rol: userRole,
  };

  console.log(
    `🔐 JWT generado con expiración de ${JWT_EXPIRATION_MINUTES} minutos`
  );

  return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
}

const fetchWithRetry = async (
  url: string,
  options: ExtendedRequestInit,
  maxRetries = 1
): Promise<Response> => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = (await undiciFetch(url, {
        ...options,
        dispatcher: agent,
        body: options.body as any,
      })) as unknown as Response;
      console.log(`Intento ${attempt + 1}/${maxRetries}:`, {
        status: response.status,
        ok: response.ok,
      });
      return response;
    } catch (error) {
      attempt++;
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
      );
    }
  }
  throw new Error(`Failed after ${maxRetries} attempts`);
};

interface FileData {
  name: string;
  path: string;
  blob: Buffer;
  type: string;
}

async function getUniqueKey(
  s3Client: S3Client,
  bucket: string,
  key: string
): Promise<string> {
  let uniqueKey = key;
  let counter = 0;
  while (true) {
    try {
      await s3Client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: uniqueKey })
      );
      counter++;
      const parts = key.split("/");
      const fileName = parts.pop()!;
      const dir = parts.join("/");
      const dotIndex = fileName.lastIndexOf(".");
      let base = fileName;
      let ext = "";
      if (dotIndex !== -1) {
        base = fileName.substring(0, dotIndex);
        ext = fileName.substring(dotIndex);
      }
      uniqueKey = `${dir}/${base}_${counter}${ext}`;
    } catch (error: any) {
      if (error.$metadata && error.$metadata.httpStatusCode === 404) {
        break;
      } else {
        throw error;
      }
    }
  }
  return uniqueKey;
}

function sanitizeFileName(fileName: string): string {
  const ext = fileName.split(".").pop();
  const name = fileName
    .split(".")
    .slice(0, -1)
    .join(".")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${name}.${ext}`;
}

function calculateNextVersion(messages: Message[]): number {
  if (!messages || messages.length === 0) return 0;
  const validPairs = [];
  let i = 0;
  while (i < messages.length) {
    const userMessage = messages[i];
    if (
      userMessage.role === "user" &&
      !userMessage.error &&
      i + 1 < messages.length &&
      messages[i + 1].role === "assistant"
    ) {
      validPairs.push({ userMessage, assistantMessage: messages[i + 1] });
      i += 2;
    } else {
      i++;
    }
  }
  return validPairs.length;
}

async function checkAndGetGeneratedCode(
  supabase: SupabaseClient,
  sessionId: string
): Promise<string[] | null> {
  try {
    console.log("🔍 Verificando si se generó código para session:", sessionId);

    const { data: stateData, error: stateError } = await supabase
      .from("hestia_states")
      .select("has_code, code")
      .eq("session_id", sessionId)
      .single();

    if (stateError) {
      console.log("⚠️ No se encontró estado para la sesión:", stateError);
      return null;
    }

    if (!stateData?.has_code) {
      console.log("📝 No se generó código en esta iteración");
      return null;
    }

    if (!stateData.code) {
      console.log("⚠️ has_code es true pero no hay URLs de código");
      return null;
    }

    let codeUrls: string[] = [];

    try {
      if (typeof stateData.code === "string") {
        try {
          const parsed = JSON.parse(stateData.code);
          if (Array.isArray(parsed)) {
            codeUrls = parsed.filter(
              (url) => typeof url === "string" && url.trim() !== ""
            );
          } else if (typeof parsed === "string") {
            codeUrls = [parsed];
          }
        } catch {
          codeUrls = [stateData.code];
        }
      } else if (Array.isArray(stateData.code)) {
        codeUrls = stateData.code.filter(
          (url) => typeof url === "string" && url.trim() !== ""
        );
      }
    } catch (error) {
      console.error("❌ Error parseando URLs de código:", error);
      return null;
    }

    if (codeUrls.length === 0) {
      console.log("⚠️ No se encontraron URLs válidas de código");
      return null;
    }

    console.log("✅ Código encontrado:", codeUrls);
    return codeUrls;
  } catch (error) {
    console.error("❌ Error verificando código generado:", error);
    return null;
  }
}

async function cleanupCodeState(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  try {
    console.log("🧹 Limpiando estado de código para session:", sessionId);

    const { error: cleanupError } = await supabase
      .from("hestia_states")
      .update({
        has_code: false,
        code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    if (cleanupError) {
      console.error("❌ Error limpiando estado de código:", cleanupError);
    } else {
      console.log("✅ Estado de código limpiado exitosamente");
    }
  } catch (error) {
    console.error("❌ Error en cleanup de código:", error);
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const endTimer = httpRequestDuration.startTimer({ method: 'POST', route: '/api/predictive/analyze' });
  
  httpRequestsActive.inc({ method: 'POST', route: '/api/predictive/analyze' });
  supabaseConnectionsActive.inc();
  
  let n8nResponse: Response;
  let supabase: SupabaseClient | undefined = undefined;
  const session: any = undefined;
  let sessionId: string | undefined = undefined;
  const requestId = crypto.randomUUID();

  try {
    supabase = createRouteHandlerClient({
      cookies: () => Promise.resolve(cookies()),
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userRole = "Default";

    const { data: userProfileData, error: profileError } = await supabase
      .from("hestia_user_profiles_new")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError || !userProfileData) {
      console.warn("Error obteniendo rol de usuario:", profileError);
      userRole = "Default";
    } else {
      userRole = userProfileData.role || "Default";
    }

    const formData = await req.formData();
    const message = formData.get("message") as string;
    sessionId = formData.get("sessionId") as string;
    const fileKey = formData.get("fileKey") as string | null;
    const attachmentMetadata = formData.get("attachmentMetadata");
    const thinking = (formData.get("thinking") as string) || "false";
    const search = (formData.get("search") as string) || "false";
    const document = (formData.get("document") as string) || "false";
    const agentic = (formData.get("agentic") as string) || "false";

    // Obtener el timestamp del usuario enviado desde el frontend
    const userMessageTimestamp = formData.get("userMessageTimestamp") as string;
    console.log("🕐 Timestamp del usuario recibido:", userMessageTimestamp);

    let chatData: ChatData | null = null;
    try {
      const queryTimer = supabaseQueryDuration.startTimer({ operation: 'select', table: 'hestia_chats' });
      const { data, error } = await supabase
        .from("hestia_chats")
        .select("project_id, messages, version_id")
        .eq("session_id", sessionId)
        .eq("user_id", session.user.id)
        .single();
      queryTimer();

      if (error) {
        console.warn("Error al buscar chat:", error);
        if (error.code === "PGRST116") {
          const { data: multipleChats, error: multipleError } = await supabase
            .from("hestia_chats")
            .select("project_id, messages, version_id")
            .eq("session_id", sessionId)
            .eq("user_id", session.user.id);

          if (multipleChats && multipleChats.length > 0) {
            chatData = multipleChats[0] as ChatData;
          }
        }
      } else {
        chatData = data as ChatData;
      }
    } catch (searchError) {
      console.error("Error en búsqueda de chat:", searchError);
    }

    if (!chatData) {
      const newProjectId = crypto.randomUUID();
      const chatName = `Proyecto ${await getNextChatNumber(
        supabase,
        session.user.id
      )}`;

      const { data: newChatData, error: newChatError } = await supabase
        .from("hestia_chats")
        .insert({
          id: sessionId,
          session_id: sessionId,
          name: chatName,
          user_id: session.user.id,
          messages: [],
          project_id: newProjectId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      await supabase.from("hestia_states").upsert(
        {
          session_id: sessionId,
          is_loading: true,
          pending_messages: null,
          updated_at: new Date().toISOString(),
          request_id: requestId,
        },
        { onConflict: "session_id" }
      );

      if (newChatError) {
        console.error("Error creando chat automáticamente:", newChatError);
        return NextResponse.json(
          { error: "No se pudo crear un nuevo chat", details: newChatError },
          { status: 500 }
        );
      }

      if (!newChatData) {
        return NextResponse.json(
          { error: "No se pudo crear un nuevo chat" },
          { status: 500 }
        );
      }

      chatData = {
        project_id: newChatData.project_id,
        messages: newChatData.messages || [],
        version_id: 0,
      };
    } else {
      await supabase.from("hestia_states").upsert(
        {
          session_id: sessionId,
          is_loading: true,
          updated_at: new Date().toISOString(),
          request_id: requestId,
        },
        { onConflict: "session_id" }
      );
    }

    const currentMessages = chatData.messages || [];
    const nextVersion = calculateNextVersion(currentMessages);

    console.log(
      "🔄 is_loading activado para session:",
      sessionId,
      "request:",
      requestId
    );

    // 🔐 GENERAR JWT PARA N8N
    const jwtToken = generateN8NJWT(
      session.user.id,
      chatData.project_id,
      userRole
    );
    console.log("🔐 JWT generado para N8N");

    const n8nFormData = new FormData();
    n8nFormData.append("id", crypto.randomUUID());
    n8nFormData.append("chat_id", sessionId);
    n8nFormData.append("user_id", session.user.id);
    n8nFormData.append("project_id", chatData.project_id);
    n8nFormData.append("session_id", sessionId);
    n8nFormData.append("version_id", nextVersion.toString());
    n8nFormData.append("message", message);
    n8nFormData.append("created_at", new Date().toISOString());
    n8nFormData.append("user_role", userRole);
    n8nFormData.append("thinking", thinking);
    n8nFormData.append("search", search);
    n8nFormData.append("document", document);
    n8nFormData.append("agentic", agentic);
    n8nFormData.append("request_id", requestId);

    if (fileKey) {
      n8nFormData.append("fileKey", fileKey);
    }

    if (attachmentMetadata) {
      try {
        const metadatas = JSON.parse(attachmentMetadata as string);

        if (Array.isArray(metadatas)) {
          const allFileKeys = metadatas
            .map((metadata) => metadata.fileKey)
            .filter((key) => key);

          if (allFileKeys.length > 0) {
            n8nFormData.append("fileKeys", allFileKeys.join(","));
          }

          if (metadatas[0]?.fileKey) {
            n8nFormData.append("fileKey", metadatas[0].fileKey);
          }

          n8nFormData.append("attachmentMetadata", JSON.stringify(metadatas));
        } else {
          if (metadatas.fileKey) {
            n8nFormData.append("fileKey", metadatas.fileKey);
            n8nFormData.append("attachmentMetadata", JSON.stringify(metadatas));
          }
        }
      } catch (error) {
        console.error("Error parsing attachmentMetadata:", error);
        n8nFormData.append("attachmentMetadata", attachmentMetadata as string);
      }
    }

    console.log("🔍 FormData recibido:", {
      message: formData.get("message"),
      sessionId: formData.get("sessionId"),
      thinking: formData.get("thinking"),
      agentic: formData.get("agentic"),
      requestId: requestId,
    });

    console.log(
      "Datos enviados a N8N:",
      Object.fromEntries(n8nFormData.entries())
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT);
      const n8nStartTime = Date.now();

      try {
        const jsonPayload = Object.fromEntries(n8nFormData.entries());

        // 🔐 ENVIAR PETICIÓN CON JWT EN HEADER AUTHORIZATION
        n8nResponse = await fetchWithRetry(N8N_WORKFLOW, {
          method: "POST",
          body: JSON.stringify(jsonPayload),
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwtToken}`, // 🔐 JWT en header
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const duration = Date.now() - n8nStartTime;
      const n8nDuration = duration / 1000;
      n8nWorkflowDuration.observe(n8nDuration);
      console.log(`N8N call completed in ${duration}ms`);

      if (duration > 20000) {
        console.warn("Long running n8n call detected", {
          duration,
          sessionId,
          userId: session.user.id,
        });
      }

      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        console.error("N8N Error Response:", errorText);

        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(`N8N Error: ${errorJson.message || errorText}`);
        } catch {
          throw new Error(`N8N Error: ${errorText}`);
        }
      }

      const n8nData = await n8nResponse.json();
      const responseData = Array.isArray(n8nData) ? n8nData[0] : n8nData;

      let finalOutput = "No hay respuesta disponible";

      if (typeof responseData.output === "string") {
        finalOutput = responseData.output;
      } else if (Array.isArray(responseData.output)) {
        const textObject = responseData.output.find(
          (item: any) => item.type === "text" && item.text
        );

        if (textObject?.text) {
          finalOutput = textObject.text;
        } else {
          const combined = responseData.output
            .map((item: any) => {
              if (item.type === "text" && item.text) {
                return item.text;
              }
              return "";
            })
            .filter(Boolean)
            .join("\n\n")
            .trim();

          if (combined) finalOutput = combined;
        }
      }

      let attachments = [];
      if (attachmentMetadata) {
        try {
          const parsedMetadata = JSON.parse(attachmentMetadata as string);
          attachments = Array.isArray(parsedMetadata)
            ? parsedMetadata
            : [parsedMetadata];
        } catch (error) {
          console.error("Error parsing attachments for userMessage:", error);
        }
      }

      const userMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        timestamp: userMessageTimestamp || new Date().toISOString(), // 🕐 USAR EL TIMESTAMP DEL FRONTEND
        attachments: attachments.length > 0 ? attachments : undefined,
        project_id: chatData.project_id,
        session_id: sessionId,
        version_id: nextVersion,
      };

      const generatedCodeUrls = await checkAndGetGeneratedCode(
        supabase,
        sessionId
      );

      const assistantMessage: any = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `### \n${finalOutput}`,
        timestamp: new Date().toISOString(),
        prediction: {
          confidence: 1,
          data: { output: responseData.output },
          metrics: { accuracy: 1, precision: 1, recall: 1 },
        },
        project_id: chatData.project_id,
        session_id: sessionId,
        version_id: nextVersion,
        thinking: thinking === "true",
      };

      if (generatedCodeUrls && generatedCodeUrls.length > 0) {
        assistantMessage.code = generatedCodeUrls;
        console.log(
          "✅ Código añadido al mensaje del asistente:",
          generatedCodeUrls
        );
      }

      console.log(
        `✅ Mensajes guardados exitosamente. Thinking flag: ${assistantMessage.thinking}`
      );

      const updatedMessages = [
        ...currentMessages,
        userMessage,
        assistantMessage,
      ];

      updatedMessages.forEach((msg, index) => {
        msg.version_id = Math.floor(index / 2);
      });

      console.log(
        "🔍 DEBUG - Verificando thinking en updatedMessages:",
        updatedMessages
          .filter((msg) => msg.role === "assistant")
          .map((msg) => ({
            id: msg.id,
            thinking: (msg as any).thinking,
            thinkingType: typeof (msg as any).thinking,
          }))
      );

      const { error: updateError } = await supabase
        .from("hestia_chats")
        .update({
          messages: updatedMessages,
          version_id: nextVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("user_id", session.user.id);

      if (updateError) {
        console.error("❌ Error actualizando chat:", updateError);
        supabaseOperations.inc({ operation: 'update', table: 'hestia_chats', status: 'error' });
        throw updateError;
      } else {
        supabaseOperations.inc({ operation: 'update', table: 'hestia_chats', status: 'success' });
      }

      if (generatedCodeUrls && generatedCodeUrls.length > 0) {
        await cleanupCodeState(supabase, sessionId);
      }

      const { data: currentState } = await supabase
        .from("hestia_states")
        .select("request_id")
        .eq("session_id", sessionId)
        .single();

      if (currentState?.request_id === requestId) {
        console.log("🧹 Limpiando hestia_states para request:", requestId);
        const { error: cleanupError } = await supabase
          .from("hestia_states")
          .upsert(
            {
              session_id: sessionId,
              is_loading: false,
              pending_messages: null,
              updated_at: new Date().toISOString(),
              request_id: null,
            },
            { onConflict: "session_id" }
          );

        if (cleanupError) {
          console.error("⚠️ Error limpiando hestia_states:", cleanupError);
        } else {
          console.log(
            "✅ hestia_states limpiado completamente para session:",
            sessionId,
            "request:",
            requestId
          );
        }
      } else {
        console.log(
          "⚠️ No se limpia hestia_states porque el requestId no coincide:",
          {
            currentRequestId: currentState?.request_id,
            thisRequestId: requestId,
          }
        );
      }

      console.log(
        `✅ Mensajes guardados exitosamente. Thinking flag: ${assistantMessage.thinking}`
      );

      httpRequestTotal.inc({ method: 'POST', route: '/api/predictive/analyze', status_code: '200' });
      endTimer({ status_code: '200' });

      return NextResponse.json({
        success: true,
        response: assistantMessage.content,
        prediction: assistantMessage.prediction,
        ...(generatedCodeUrls &&
          generatedCodeUrls.length > 0 && {
            code: generatedCodeUrls,
          }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json(
          {
            error: "Timeout en la llamada a n8n",
            details: "La operación excedió el límite de tiempo de 800s",
          },
          {
            status: 408,
            headers: { "Retry-After": "60", Connection: "close" },
          }
        );
      }
      console.error("Error en llamada a n8n:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error completo:", error);
    
    httpRequestTotal.inc({ method: 'POST', route: '/api/predictive/analyze', status_code: '500' });
    endTimer({ status_code: '500' });

    try {
      if (!supabase) {
        supabase = createRouteHandlerClient({
          cookies: () => Promise.resolve(cookies()),
        });
      }
      if (supabase && sessionId) {
        const { data: currentState } = await supabase
          .from("hestia_states")
          .select("request_id")
          .eq("session_id", sessionId)
          .single();

        if (currentState?.request_id === requestId) {
          await supabase.from("hestia_states").upsert(
            {
              session_id: sessionId,
              is_loading: false,
              pending_messages: null,
              updated_at: new Date().toISOString(),
              request_id: null,
            },
            { onConflict: "session_id" }
          );
          console.log(
            "🛑 hestia_states limpiado por error para session:",
            sessionId,
            "request:",
            requestId
          );
        } else {
          console.log(
            "⚠️ No se limpia hestia_states por error porque el requestId no coincide:",
            {
              currentRequestId: currentState?.request_id,
              thisRequestId: requestId,
            }
          );
        }
      }
    } catch (cleanupError) {
      console.error("Error limpiando is_loading:", cleanupError);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process prediction",
        details: error,
        response: "No se pudo generar una predicción",
      },
      { status: (error as any)?.status || 500 }
    );
  } finally {
    httpRequestsActive.dec({ method: 'POST', route: '/api/predictive/analyze' });
    supabaseConnectionsActive.dec();
  }
}

async function getNextChatNumber(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("hestia_chats")
    .select("id", { count: "exact" })
    .eq("user_id", userId);

  if (error) {
    console.error("Error contando chats:", error);
    return 1;
  }

  return ((count as number) || 0) + 1;
}
