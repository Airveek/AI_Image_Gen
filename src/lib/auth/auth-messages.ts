import { isAuthApiError } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export type AuthAction = "login" | "register" | "logout";

export const duplicateEmailMessage = "This email already exists. Please log in.";
export const registrationPendingMessage = "Check your email to confirm your account.";

export function isObfuscatedSignupUser(user: User | null): boolean {
  return Boolean(user && user.identities?.length === 0);
}

export function getAuthCallbackMessage(errorCode?: string): string | null {
  if (errorCode === "confirmation_failed") {
    return "That confirmation link is invalid or has expired. Please register again.";
  }

  if (errorCode === "missing_code") {
    return "The confirmation link is incomplete. Please use the link from your email.";
  }

  return null;
}

export function getAuthErrorMessage(
  error: unknown,
  action: AuthAction,
): string {
  if (isAuthApiError(error)) {
    switch (error.code) {
      case "email_exists":
      case "user_already_exists":
        return duplicateEmailMessage;
      case "email_not_confirmed":
        return "Please confirm your email address before logging in.";
      case "invalid_credentials":
        return "The email or password is incorrect.";
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return "Too many attempts. Please wait a moment and try again.";
      case "weak_password":
        return "Choose a stronger password and try again.";
      case "email_address_invalid":
      case "validation_failed":
        return "Please check your details and try again.";
      case "email_provider_disabled":
      case "signup_disabled":
        return "New account registration is currently unavailable.";
      case "request_timeout":
        return "The request took too long. Please try again.";
      default:
        break;
    }
  }

  if (error instanceof TypeError || error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("fetch") || message.includes("network")) {
      return "We could not reach the service. Check your connection and try again.";
    }
  }

  if (action === "logout") {
    return "We could not log you out. Please try again.";
  }

  return "Something went wrong. Please check your details and try again.";
}
