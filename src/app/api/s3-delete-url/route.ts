import { NextResponse } from "next/server";

interface S3DeleteRequestBody {
  fileKey: string;
  sessionId: string;
}

const N8N_DELETE_WEBHOOK = process.env.N8N_DELETE_WEBHOOK_URL!;

export async function POST(req: Request) {
  try {
    const { fileKey, sessionId } = (await req.json()) as S3DeleteRequestBody;

    if (!fileKey || !sessionId) {
      return NextResponse.json(
        { error: "Missing fileKey or sessionId" },
        { status: 400 }
      );
    }

    // Forward the data to N8N
    const n8nRes = await fetch(N8N_DELETE_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileKey, sessionId }),
    });

    if (!n8nRes.ok) {
      const text = await n8nRes.text();
      return NextResponse.json(
        { error: "N8N delete error", details: text },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal error", details: (err as any)?.message || err },
      { status: 500 }
    );
  }
}
