import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface GetFileRequestBody {
  fileKey: string;
}

export async function POST(req: Request) {
  try {
    const body: GetFileRequestBody = await req.json();
    const { fileKey } = body;

    if (!fileKey) {
      console.error("Falta parámetro fileKey");
      return NextResponse.json(
        { error: "Missing fileKey parameter" },
        { status: 400 }
      );
    }

    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const bucketName = process.env.S3_BUCKET_NAME!;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });

    // Generar URL firmada con tiempo de expiración (1 hora)
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    console.log("✔️ URL de acceso generada", { presignedUrl });

    return NextResponse.json({ presignedUrl });
  } catch (error) {
    console.error("❌ Error generando URL de acceso:", error);
    return NextResponse.json(
      {
        error: "Error generating access URL",
        details: (error as any)?.message || error,
      },
      { status: 500 }
    );
  }
}
