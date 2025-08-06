import { NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface PresignedRequestBody {
  fileName: string;
  fileType: string;
  sessionId: string;
  userId?: string;
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
      if (error.$metadata?.httpStatusCode === 404) break;
      else throw error;
    }
  }
  return uniqueKey;
}

export async function POST(req: Request) {
  try {
    const body: PresignedRequestBody = await req.json();
    const { fileName, fileType, sessionId, userId } = body;

    // Se agrega validación para userId, ya que es requerido para la nueva estructura de carpetas.
    if (!fileName || !fileType || !sessionId || !userId) {
      console.error("Faltan parámetros:", {
        fileName,
        fileType,
        sessionId,
        userId,
      });
      return NextResponse.json(
        {
          error:
            "Missing parameters, fileName, fileType, sessionId and userId are required.",
        },
        { status: 400 }
      );
    }

    const cleanFileName = sanitizeFileName(fileName);
    // Se ajusta la clave del archivo para que coincida con la estructura: {userId}/{sessionId}/{fileName}
    let fileKey = `${userId}/${sessionId}/${cleanFileName}`;

    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const bucketName = process.env.S3_BUCKET_NAME!;

    fileKey = await getUniqueKey(s3Client, bucketName, fileKey);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      ContentType: fileType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 900,
    });

    console.log("✔️ Presigned URL generado", { presignedUrl, fileKey });

    return NextResponse.json({ presignedUrl, fileKey });
  } catch (error) {
    console.error("❌ Error generando presigned URL:", error);
    return NextResponse.json(
      {
        error: "Error generating presigned URL",
        details: (error as any)?.message || error,
      },
      { status: 500 }
    );
  }
}
