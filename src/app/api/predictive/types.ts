import { Message } from "@/components/predictive/PredictiveTypes";

export interface ApiSuccessResponse {
  success: true;
  messages: Message[];
}

export interface ApiErrorResponse {
  error: string;
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
