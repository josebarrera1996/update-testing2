// app/api/auth/register/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Verificar variables de entorno
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY");
}

const ALLOWED_DOMAINS = [
  "@cencosud.com.ar",
  "@garagedeepanalytics.com",
  "@externos-ar.cencosud.com",
];

// Crear cliente de Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Validar dominio
    if (!ALLOWED_DOMAINS.some((domain) => email.endsWith(domain))) {
      return NextResponse.json(
        {
          error:
            "Dominio no autorizado. Por favor usa un email corporativo válido.",
        },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const { data: existingUser } = await supabase
      .from("aria_user_profiles")
      .select("email")
      .eq("email", email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      );
    }

    // Crear el usuario
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: {
          email_confirmed: false,
        },
      },
    });

    if (error) {
      console.error("Error en registro:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data?.user) {
      return NextResponse.json(
        { error: "No se pudo crear el usuario" },
        { status: 400 }
      );
    }

    // Crear el perfil en aria_user_profiles
    const { error: profileError } = await supabase
      .from("aria_user_profiles")
      .insert([
        {
          id: data.user.id,
          email: email,
          domain_validated: true,
          is_approved: false,
          role: "user",
          approval_token: null,
        },
      ]);

    if (profileError) {
      console.error("Error creando perfil:", profileError);
      // Limpiar usuario si falla la creación del perfil
      await supabase.auth.admin.deleteUser(data.user.id);
      return NextResponse.json(
        { error: "Error al crear el perfil de usuario" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Registro exitoso. Por favor verifica tu email.",
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error) {
    console.error("Error general:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
