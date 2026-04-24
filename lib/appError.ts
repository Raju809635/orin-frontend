import { Alert } from "react-native";
import { notify } from "@/utils/notify";

type AppErrorMode = "toast" | "alert" | "silent";

type HandleAppErrorOptions = {
  fallbackMessage?: string;
  mode?: AppErrorMode;
  title?: string;
};

function pickRawErrorMessage(error: any) {
  const details = error?.response?.data?.error || error?.error || null;
  return (
    details?.description ||
    details?.message ||
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.description ||
    error?.message ||
    ""
  );
}

function isAlreadyUserFriendlyMessage(message: string) {
  const raw = String(message || "").trim();
  if (!raw) return false;
  if (raw.length > 160) return false;
  if (/[{}[\]]/.test(raw)) return false;
  if (/e11000|duplicate key|mongodb|axios|stack|exception|bad_request_error|payment_error|validationerror/i.test(raw)) return false;
  if (/^[a-z0-9_]+$/i.test(raw) && raw.includes("_")) return false;
  return true;
}

function isPaymentFailure(rawMessage: string, error: any) {
  const joined = [
    rawMessage,
    error?.response?.data?.error?.code,
    error?.response?.data?.error?.reason,
    error?.response?.data?.error?.step,
    error?.code,
    error?.reason
  ]
    .filter(Boolean)
    .join(" ");

  return /payment|razorpay|payment_error|payment_authentication|bad_request_error/i.test(joined);
}

export function getAppErrorMessage(error: any, fallbackMessage = "Something went wrong. Please try again.") {
  const rawMessage = String(pickRawErrorMessage(error) || "").trim();
  const status = Number(error?.response?.status || 0);
  const code = String(error?.response?.data?.error?.code || error?.code || "").trim();

  if (!error?.response) {
    if (/network|internet|fetch|timeout|timed out|ecconn|socket|unreachable/i.test(rawMessage || code)) {
      return "Check your internet connection.";
    }
    return fallbackMessage;
  }

  if (isPaymentFailure(rawMessage, error)) {
    return "Payment failed. Please try again or use a different method.";
  }

  if (/e11000|duplicate key|already exists|already sent|request already exists/i.test(rawMessage) || status === 409) {
    return "Request already sent.";
  }

  if (status === 401) {
    return "Your session expired. Please log in again.";
  }

  if (status === 403) {
    return "You do not have access to do that.";
  }

  if (status === 404) {
    return isAlreadyUserFriendlyMessage(rawMessage) ? rawMessage : "That item is not available right now.";
  }

  if (status === 429) {
    return "Too many attempts. Please wait and try again.";
  }

  if (status >= 500) {
    return fallbackMessage;
  }

  if (/bad_request_error/i.test(code)) {
    return fallbackMessage;
  }

  if (isAlreadyUserFriendlyMessage(rawMessage)) {
    return rawMessage;
  }

  return fallbackMessage;
}

export function annotateAppError<T = any>(error: T, fallbackMessage?: string) {
  const message = getAppErrorMessage(error, fallbackMessage);
  if (error && typeof error === "object") {
    (error as any).appMessage = message;
    if ((error as any).response?.data && typeof (error as any).response.data === "object") {
      (error as any).response.data.userMessage = message;
      (error as any).response.data.message = message;
    }
    if ((error as any).message !== undefined) {
      (error as any).message = message;
    }
  }
  return error;
}

export function handleAppError(error: any, options: HandleAppErrorOptions = {}) {
  const {
    fallbackMessage = "Something went wrong. Please try again.",
    mode = "toast",
    title = "ORIN"
  } = options;

  const message = getAppErrorMessage(error, fallbackMessage);

  if (mode === "alert") {
    Alert.alert(title, message);
  } else if (mode === "toast") {
    notify(message);
  }

  return message;
}
