// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { setLoading } from "@/store/slices/authSlice";

export default function Home() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user, isLoading, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );

  useEffect(() => {
    //console.log("Estado actual:", { user, isLoading, isAuthenticated });

    // Si después de 2 segundos todavía está cargando, forzar el cambio a false
    const timer = setTimeout(() => {
      if (isLoading) {
        console.log("Forzando fin de carga después de timeout");
        dispatch(setLoading(false));
      }
    }, 2000);

    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/studio");
      } else {
        console.log("Usuario no autenticado, redirigiendo a login");
        router.push("/login");
      }
    }

    return () => clearTimeout(timer);
  }, [user, isLoading, isAuthenticated, router, dispatch]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <p className="text-xl mb-4">Redirigiendo...</p>
      {isLoading && (
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      )}
    </div>
  );
}
