// app/api/auth/register/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { httpRequestDuration, httpRequestTotal, httpRequestsActive, supabaseOperations, supabaseConnectionsActive, supabaseQueryDuration } from "@/lib/metrics";

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
  const endTimer = httpRequestDuration.startTimer({ method: 'POST', route: '/api/auth/register' });
  
  httpRequestsActive.inc({ method: 'POST', route: '/api/auth/register' });
  supabaseConnectionsActive.inc();
  
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
    const queryTimer = supabaseQueryDuration.startTimer({ operation: 'select', table: 'aria_user_profiles' });
    const { data: existingUser } = await supabase
      .from("aria_user_profiles")
      .select("email")
      .eq("email", email)
      .single();
    queryTimer();

    supabaseOperations.inc({ operation: 'select', table: 'aria_user_profiles', status: 'success' });

    if (existingUser) {
      httpRequestTotal.inc({ method: 'POST', route: '/api/auth/register', status_code: '400' });
      endTimer({ status_code: '400' });
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
      supabaseOperations.inc({ operation: 'signUp', table: 'auth', status: 'error' });
      httpRequestTotal.inc({ method: 'POST', route: '/api/auth/register', status_code: '400' });
      endTimer({ status_code: '400' });
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
      supabaseOperations.inc({ operation: 'insert', table: 'aria_user_profiles', status: 'error' });
      // Limpiar usuario si falla la creación del perfil
      await supabase.auth.admin.deleteUser(data.user.id);
      httpRequestTotal.inc({ method: 'POST', route: '/api/auth/register', status_code: '400' });
      endTimer({ status_code: '400' });
      return NextResponse.json(
        { error: "Error al crear el perfil de usuario" },
        { status: 400 }
      );
    } else {
      supabaseOperations.inc({ operation: 'insert', table: 'aria_user_profiles', status: 'success' });
    }

    httpRequestTotal.inc({ method: 'POST', route: '/api/auth/register', status_code: '200' });
    endTimer({ status_code: '200' });

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
    httpRequestTotal.inc({ method: 'POST', route: '/api/auth/register', status_code: '500' });
    endTimer({ status_code: '500' });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  } finally {
    httpRequestsActive.dec({ method: 'POST', route: '/api/auth/register' });
    supabaseConnectionsActive.dec();
  }
}
