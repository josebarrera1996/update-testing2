import {
  createRouteHandlerClient,
  type SupabaseClient,
} from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Agent, fetch as undiciFetch } from "undici";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { httpRequestDuration, httpRequestTotal, httpRequestsActive, supabaseOperations, supabaseConnectionsActive, supabaseQueryDuration, n8nWorkflowDuration } from "@/lib/metrics";

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

const agent = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
});

const N8N_TIMEOUT = 50_000;

const N8N_WORKFLOW =
  process.env.N8N_WEBHOOK_URL ||
  "https://aria-studio-k8s.garagedeepanalytics.com/webhook/aria-crew-ds-test";

const JWT_SECRET = process.env.N8N_JWT_SECRET || "your-secret-key";
const JWT_ISSUER = "HestiaAuthenticator";
const JWT_AUDIENCE = "HestiaN8NFlows";
const JWT_EXPIRATION_MINUTES = Number.parseInt(
  process.env.JWT_EXPIRATION_MINUTES || "60"
);

function generateN8NJWT(
  userId: string,
  projectId: string,
  userRole: string
): string {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    sub: userId,
    exp: now + JWT_EXPIRATION_MINUTES * 60,
    iat: now,
    jti: crypto.randomUUID(),
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

function calculateNextVersion(messages: any[]): number {
  if (!messages || messages.length === 0) return 0;
  const validPairs: any[] = [];
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

export async function POST(req: Request) {
  const endTimer = httpRequestDuration.startTimer({ method: 'POST', route: '/api/predictive/analyze' });
  
  httpRequestsActive.inc({ method: 'POST', route: '/api/predictive/analyze' });
  supabaseConnectionsActive.inc();
  
  let supabase: SupabaseClient | undefined = undefined;
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
      httpRequestTotal.inc({ method: 'POST', route: '/api/predictive/analyze', status_code: '401' });
      endTimer({ status_code: '401' });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userRole = "Default";

    const queryTimer1 = supabaseQueryDuration.startTimer({ operation: 'select', table: 'hestia_user_profiles_new' });
    const { data: userProfileData, error: profileError } = await supabase
      .from("hestia_user_profiles_new")
      .select("role")
      .eq("id", session.user.id)
      .single();
    queryTimer1();

    if (profileError || !userProfileData) {
      console.warn("Error obteniendo rol de usuario:", profileError);
      supabaseOperations.inc({ operation: 'select', table: 'hestia_user_profiles_new', status: 'error' });
      userRole = "Default";
    } else {
      supabaseOperations.inc({ operation: 'select', table: 'hestia_user_profiles_new', status: 'success' });
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
    const userMessageTimestamp = formData.get("userMessageTimestamp") as string;

    console.log("🕐 Timestamp del usuario recibido:", userMessageTimestamp);

    let chatData: any = null;
    try {
      const queryTimer2 = supabaseQueryDuration.startTimer({ operation: 'select', table: 'hestia_chats' });
      const { data, error } = await supabase
        .from("hestia_chats")
        .select("project_id, messages, version_id")
        .eq("session_id", sessionId)
        .eq("user_id", session.user.id)
        .single();
      queryTimer2();

      if (error) {
        console.warn("Error al buscar chat:", error);
        supabaseOperations.inc({ operation: 'select', table: 'hestia_chats', status: 'error' });
        if (error.code === "PGRST116") {
          const queryTimer3 = supabaseQueryDuration.startTimer({ operation: 'select', table: 'hestia_chats' });
          const { data: multipleChats, error: multipleError } = await supabase
            .from("hestia_chats")
            .select("project_id, messages, version_id")
            .eq("session_id", sessionId)
            .eq("user_id", session.user.id);
          queryTimer3();

          if (multipleChats && multipleChats.length > 0) {
            chatData = multipleChats[0];
            supabaseOperations.inc({ operation: 'select', table: 'hestia_chats', status: 'success' });
          } else {
            supabaseOperations.inc({ operation: 'select', table: 'hestia_chats', status: 'error' });
          }
        }
      } else {
        chatData = data;
        supabaseOperations.inc({ operation: 'select', table: 'hestia_chats', status: 'success' });
      }
    } catch (searchError) {
      console.error("Error en búsqueda de chat:", searchError);
      supabaseOperations.inc({ operation: 'select', table: 'hestia_chats', status: 'error' });
    }

    if (!chatData) {
      const newProjectId = crypto.randomUUID();
      const chatName = `Proyecto ${await getNextChatNumber(
        supabase,
        session.user.id
      )}`;

      const queryTimer4 = supabaseQueryDuration.startTimer({ operation: 'insert', table: 'hestia_chats' });
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
      queryTimer4();

      if (newChatError) {
        console.error("Error creando chat automáticamente:", newChatError);
        supabaseOperations.inc({ operation: 'insert', table: 'hestia_chats', status: 'error' });
        httpRequestTotal.inc({ method: 'POST', route: '/api/predictive/analyze', status_code: '500' });
        endTimer({ status_code: '500' });
        return NextResponse.json(
          { error: "No se pudo crear un nuevo chat", details: newChatError },
          { status: 500 }
        );
      }

      if (!newChatData) {
        supabaseOperations.inc({ operation: 'insert', table: 'hestia_chats', status: 'error' });
        httpRequestTotal.inc({ method: 'POST', route: '/api/predictive/analyze', status_code: '500' });
        endTimer({ status_code: '500' });
        return NextResponse.json(
          { error: "No se pudo crear un nuevo chat" },
          { status: 500 }
        );
      }

      supabaseOperations.inc({ operation: 'insert', table: 'hestia_chats', status: 'success' });

      chatData = {
        project_id: newChatData.project_id,
        messages: newChatData.messages || [],
        version_id: 0,
      };
    }

    const currentMessages = chatData.messages || [];
    const nextVersion = calculateNextVersion(currentMessages);

    let attachmentsToStore: any = null;
    let fileKeysForN8N: string | null = null;

    if (attachmentMetadata) {
      try {
        const metadatas = JSON.parse(attachmentMetadata as string);
        if (Array.isArray(metadatas) && metadatas.length > 0) {
          attachmentsToStore = metadatas;
          const allFileKeys = metadatas
            .map((metadata) => metadata.fileKey)
            .filter((key) => key);

          if (allFileKeys.length > 0) {
            fileKeysForN8N = allFileKeys.join(",");
          }

          console.log(
            "📎 Attachments procesados para almacenar:",
            attachmentsToStore
          );
          console.log("🔑 FileKeys generados para N8N:", fileKeysForN8N);
        } else if (metadatas && typeof metadatas === "object") {
          attachmentsToStore = [metadatas];
          if (metadatas.fileKey) {
            fileKeysForN8N = metadatas.fileKey;
          }
          console.log(
            "📎 Attachment individual procesado para almacenar:",
            attachmentsToStore
          );
        }
      } catch (error) {
        console.error("Error parsing attachmentMetadata:", error);
      }
    }

    const queryTimer5 = supabaseQueryDuration.startTimer({ operation: 'upsert', table: 'hestia_states' });
    await supabase.from("hestia_states").upsert(
      {
        session_id: sessionId,
        is_loading: true,
        updated_at: new Date().toISOString(),
        request_id: requestId,
        pending_attachments: attachmentsToStore,
      },
      { onConflict: "session_id" }
    );
    queryTimer5();
    supabaseOperations.inc({ operation: 'upsert', table: 'hestia_states', status: 'success' });

    console.log(
      "🔄 is_loading activado y attachments guardados para session:",
      sessionId,
      "request:",
      requestId
    );

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
    n8nFormData.append("user_message_timestamp", userMessageTimestamp);

    if (fileKey) {
      n8nFormData.append("fileKey", fileKey);
    }

    if (fileKeysForN8N) {
      n8nFormData.append("fileKeys", fileKeysForN8N);
      console.log("🔑 fileKeys enviado a N8N:", fileKeysForN8N);
    }

    console.log("🔍 FormData preparado para N8N:", {
      message: formData.get("message"),
      sessionId: formData.get("sessionId"),
      thinking: formData.get("thinking"),
      agentic: formData.get("agentic"),
      requestId: requestId,
      hasFileKey: !!fileKey,
      hasFileKeys: !!fileKeysForN8N,
      attachmentsStored: !!attachmentsToStore,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT);
      const n8nStartTime = Date.now();

      let n8nResponse: Response;
      try {
        const jsonPayload = Object.fromEntries(n8nFormData.entries());

        n8nResponse = await fetchWithRetry(N8N_WORKFLOW, {
          method: "POST",
          body: JSON.stringify(jsonPayload),
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwtToken}`,
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const n8nDuration = (Date.now() - n8nStartTime) / 1000;
      n8nWorkflowDuration.observe(n8nDuration);
      console.log(`N8N call completed in ${Date.now() - n8nStartTime}ms`);

      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        console.error("N8N Error Response:", errorText);
        throw new Error(`N8N Error: ${errorText}`);
      }

      console.log("✅ N8N webhook triggered successfully");

      const isFirstMessageInChat =
        !currentMessages || currentMessages.length === 0;
      if (isFirstMessageInChat) {
        try {
          await fetch("/api/generate-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: message,
              session_id: sessionId,
            }),
          });
        } catch (e) {
          console.error("Error llamando a generate-title:", e);
        }
      }

      httpRequestTotal.inc({ method: 'POST', route: '/api/predictive/analyze', status_code: '200' });
      endTimer({ status_code: '200' });

      return NextResponse.json({
        success: true,
        message:
          "Procesamiento iniciado. La respuesta llegará de forma asíncrona.",
        session_id: sessionId,
        request_id: requestId,
        attachments_stored: !!attachmentsToStore,
        fileKeys_sent: !!fileKeysForN8N,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        httpRequestTotal.inc({ method: 'POST', route: '/api/predictive/analyze', status_code: '408' });
        endTimer({ status_code: '408' });
        return NextResponse.json(
          {
            error: "Timeout en la llamada a N8N",
            details: "La operación excedió el límite de tiempo",
          },
          {
            status: 408,
            headers: { "Retry-After": "60", Connection: "close" },
          }
        );
      }
      console.error("Error en llamada a N8N:", error);
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
        const queryTimer6 = supabaseQueryDuration.startTimer({ operation: 'select', table: 'hestia_states' });
        const { data: currentState } = await supabase
          .from("hestia_states")
          .select("request_id")
          .eq("session_id", sessionId)
          .single();
        queryTimer6();

        if (currentState?.request_id === requestId) {
          const queryTimer7 = supabaseQueryDuration.startTimer({ operation: 'upsert', table: 'hestia_states' });
          await supabase.from("hestia_states").upsert(
            {
              session_id: sessionId,
              is_loading: false,
              pending_messages: null,
              pending_attachments: null,
              updated_at: new Date().toISOString(),
              request_id: null,
            },
            { onConflict: "session_id" }
          );
          queryTimer7();
          supabaseOperations.inc({ operation: 'upsert', table: 'hestia_states', status: 'success' });
          console.log(
            "🛑 hestia_states limpiado por error para session:",
            sessionId,
            "request:",
            requestId
          );
        }
      }
    } catch (cleanupError) {
      console.error("Error limpiando is_loading:", cleanupError);
      supabaseOperations.inc({ operation: 'upsert', table: 'hestia_states', status: 'error' });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process prediction",
        details: error,
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
  const queryTimer = supabaseQueryDuration.startTimer({ operation: 'select', table: 'hestia_chats' });
  const { count, error } = await supabase
    .from("hestia_chats")
    .select("id", { count: "exact" })
    .eq("user_id", userId);
  queryTimer();

  if (error) {
    console.error("Error contando chats:", error);
    supabaseOperations.inc({ operation: 'select', table: 'hestia_chats', status: 'error' });
    return 1;
  }

  supabaseOperations.inc({ operation: 'select', table: 'hestia_chats', status: 'success' });
  return ((count as number) || 0) + 1;
}
