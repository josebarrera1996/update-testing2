import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers"; // Tu Provider de Redux
import { AuthProvider } from "../context/AuthContext";
import Footer from "@/components/ui/footer";
import { ThemeProvider } from "@/context/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "HestIA %s",
    default: "HestIA",
  },
  description:
    "Plataforma de desarrollo y automatización de Garage Deep Analytics",
  icons: {
    icon: [
      {
        url: "/images/logo-mini-light.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/favicon.ico",
        sizes: "any",
      },
    ],
    shortcut: ["/images/logo-mini-light.png"],
    apple: [
      {
        url: "/images/logo-mini-light.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#ffffff"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#000000"
        />

        {/* Script para prevenir flash de tema */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Verificar si hay un tema temporal de recarga
                  var reloadTheme = localStorage.getItem("hestia-current-theme");
                  // Si hay un tema de recarga, usarlo
                  if (reloadTheme) {
                    document.documentElement.classList.add(reloadTheme);
                    // Si es tema oscuro, aplicar fondo negro inmediatamente
                    if (reloadTheme === "dark") {
                      document.documentElement.style.backgroundColor = "#000000";
                      document.body.style.backgroundColor = "#000000";
                    }
                  } else {
                    // Si no hay tema de recarga, usar el tema guardado
                    var savedTheme = localStorage.getItem("theme");
                    if (savedTheme) {
                      document.documentElement.classList.add(savedTheme);
                      // Si es tema oscuro, aplicar fondo negro inmediatamente
                      if (savedTheme === "dark") {
                        document.documentElement.style.backgroundColor = "#000000";
                        document.body.style.backgroundColor = "#000000";
                      }
                    } else {
                      // Si no hay tema guardado, usar preferencia del sistema
                      var systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                      if (systemPrefersDark) {
                        document.documentElement.classList.add("dark");
                        document.documentElement.style.backgroundColor = "#000000";
                        document.body.style.backgroundColor = "#000000";
                      } else {
                        document.documentElement.classList.add("light");
                      }
                    }
                  }
                } catch (e) {
                  console.log("Error al aplicar tema inicial:", e);
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <Providers>
            <AuthProvider>
              <main className="pb-12">{children}</main>
              <Footer />
            </AuthProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
