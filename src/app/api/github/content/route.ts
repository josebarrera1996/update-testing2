import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validar que sea una URL de GitHub
    if (!url.includes("github.com")) {
      return NextResponse.json(
        { error: "Only GitHub URLs are supported" },
        { status: 400 }
      );
    }

    console.log("🔍 Processing GitHub URL:", url);

    // 🆕 MEJORAR LA CONVERSIÓN DE URL
    // Ejemplo: https://github.com/user/repo/blob/branch/path/to/file.js
    // Debe convertirse a: https://raw.githubusercontent.com/user/repo/branch/path/to/file.js

    let rawUrl: string;

    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");

      // Estructura esperada: /user/repo/blob/branch/path/to/file
      if (pathParts.length < 5 || pathParts[3] !== "blob") {
        throw new Error("Invalid GitHub URL structure");
      }

      // Extraer partes: [empty, user, repo, "blob", branch, ...filePath]
      const user = pathParts[1];
      const repo = pathParts[2];
      const branch = pathParts[4];
      const filePath = pathParts.slice(5).join("/");

      // Construir URL raw
      rawUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${filePath}`;

      console.log("🔄 URL conversion:", {
        original: url,
        raw: rawUrl,
        user,
        repo,
        branch,
        filePath,
      });
    } catch (parseError) {
      console.error("❌ Error parsing URL:", parseError);
      return NextResponse.json(
        { error: "Invalid GitHub URL format" },
        { status: 400 }
      );
    }

    console.log("🔍 Fetching GitHub content from:", rawUrl);

    const response = await fetch(rawUrl, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "User-Agent": "Hestia-Code-Canvas",
        Accept: "application/vnd.github.v3.raw",
      },
    });

    if (!response.ok) {
      console.error("GitHub API Error:", response.status, response.statusText);

      if (response.status === 401) {
        return NextResponse.json(
          { error: "GitHub authentication failed. Check your token." },
          { status: 401 }
        );
      }

      if (response.status === 404) {
        return NextResponse.json(
          {
            error:
              "File not found. Please verify the URL and repository access.",
            details: {
              url: rawUrl,
              status: response.status,
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: `GitHub API error: ${response.status} ${response.statusText}`,
          details: {
            url: rawUrl,
            status: response.status,
          },
        },
        { status: response.status }
      );
    }

    const content = await response.text();

    console.log("✅ Successfully fetched content, length:", content.length);

    return NextResponse.json({
      content,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching GitHub content:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
