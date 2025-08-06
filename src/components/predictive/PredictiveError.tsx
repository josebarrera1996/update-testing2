"use client";

import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PredictiveErrorProps {
  errorMessage: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function PredictiveError({
  errorMessage,
  onRetry,
  onDismiss,
}: PredictiveErrorProps) {
  return (
    <Alert
      variant="destructive"
      className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="flex-1 pr-4">
          <p className="font-medium text-red-800 dark:text-red-200 mb-1">
            Error al enviar mensaje
          </p>
          <p className="text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20 bg-transparent"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reintentar
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/20 p-1"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
