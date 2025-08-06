import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar que el session_id esté presente
    if (!body.session_id) {
      return NextResponse.json(
        { error: "Falta el session_id requerido" },
        { status: 400 }
      );
    }

    // Enviar la solicitud al webhook de N8N
    const response = await fetch(
      "https://aria-studio.garagedeepanalytics.com/webhook/delete-conversation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    // Intentar parsear la respuesta como JSON
    let result;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      result = await response.json();
    } else {
      result = { success: true, message: await response.text() };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error al eliminar conversación:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
