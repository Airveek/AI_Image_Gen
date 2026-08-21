"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  duplicateEmailMessage,
  getAuthCallbackMessage,
  getAuthErrorMessage,
  isObfuscatedSignupUser,
  registrationPendingMessage,
} from "@/lib/auth/auth-messages";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "register";
type FieldName = "email" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<FieldName, string>>;

type AuthFormProps = {
  mode: AuthMode;
  initialError?: string;
};

export function AuthForm({ mode, initialError }: AuthFormProps) {
  const isRegister = mode === "register";
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const initialErrorShown = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fieldRefs: Record<FieldName, RefObject<HTMLInputElement | null>> = {
    email: emailRef,
    password: passwordRef,
    confirmPassword: confirmPasswordRef,
  };

  useEffect(() => {
    if (!initialError || initialErrorShown.current) {
      return;
    }

    initialErrorShown.current = true;
    const message = getAuthCallbackMessage(initialError);

    if (message) {
      requestAnimationFrame(() => toast.error(message));
    }

    router.replace("/login");
  }, [initialError, router]);

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      errors.email = "Enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      errors.email = "Enter a valid email address.";
    }

    if (!password) {
      errors.password = "Enter your password.";
    } else if (isRegister && password.length < 8) {
      errors.password = "Use at least 8 characters.";
    }

    if (isRegister && password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(errors);
    return errors;
  };

  const showValidationError = (errors: FieldErrors) => {
    const fieldOrder: FieldName[] = isRegister
      ? ["email", "password", "confirmPassword"]
      : ["email", "password"];
    const firstInvalidField = fieldOrder.find((field) => errors[field]);

    if (firstInvalidField) {
      toast.error(errors[firstInvalidField] ?? "Please check the highlighted fields.");
      requestAnimationFrame(() => fieldRefs[firstInvalidField].current?.focus());
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      showValidationError(errors);
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          toast.error(getAuthErrorMessage(error, "register"));
          return;
        }

        if (!data.session) {
          setPassword("");
          setConfirmPassword("");
          if (isObfuscatedSignupUser(data.user)) {
            toast.error(duplicateEmailMessage);
          } else {
            toast.info(registrationPendingMessage);
          }
          return;
        }

        toast.success("Your account is ready. Welcome to Airveek.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          toast.error(getAuthErrorMessage(error, "login"));
          return;
        }
      }

      router.replace("/dashboard");
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error, mode));
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isRegister ? "Create your account" : "Welcome back";
  const description = isRegister
    ? "Start creating bold, polished visuals with Airveek."
    : "Sign in to continue creating with Airveek.";

  return (
    <main className="brand-glow flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-8 block w-fit rounded-lg" aria-label="Airveek home">
          <Image
            src="/images/airveek/logo.png"
            alt="Airveek"
            width={1881}
            height={358}
            className="h-auto w-[190px] sm:w-[220px]"
            priority
          />
        </Link>

        <section className="rounded-3xl border border-[#83ff00]/20 bg-[#0b120b]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8" aria-labelledby="auth-title">
          <div className="mb-7">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-[#83ff00]">Airveek account</p>
            <h1 id="auth-title" className="font-display text-3xl font-extrabold text-[#fdfdfd] sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-[#a4b19e]">{description}</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#fdfdfd]" htmlFor="email">Email address</label>
              <input
                ref={emailRef}
                className="min-h-12 w-full rounded-xl border border-white/15 bg-[#040404] px-4 text-[#fdfdfd] outline-none transition placeholder:text-[#6f6f6f] focus:border-[#83ff00]"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError("email");
                }}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby="email-guidance"
                required
              />
              <span className="sr-only" id="email-guidance">Use a valid email address.</span>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#fdfdfd]" htmlFor="password">Password</label>
              <input
                ref={passwordRef}
                className="min-h-12 w-full rounded-xl border border-white/15 bg-[#040404] px-4 text-[#fdfdfd] outline-none transition placeholder:text-[#6f6f6f] focus:border-[#83ff00]"
                id="password"
                name="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearFieldError("password");
                }}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={isRegister ? "password-guidance" : undefined}
                required
              />
              {isRegister ? (
                <span className="mt-2 block text-xs text-[#a4b19e]" id="password-guidance">Use at least 8 characters.</span>
              ) : null}
            </div>

            {isRegister ? (
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#fdfdfd]" htmlFor="confirm-password">Confirm password</label>
                <input
                  ref={confirmPasswordRef}
                  className="min-h-12 w-full rounded-xl border border-white/15 bg-[#040404] px-4 text-[#fdfdfd] outline-none transition placeholder:text-[#6f6f6f] focus:border-[#83ff00]"
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    clearFieldError("confirmPassword");
                  }}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby="confirm-password-guidance"
                  required
                />
                <span className="sr-only" id="confirm-password-guidance">Re-enter your password.</span>
              </div>
            ) : null}

            <button
              className="cta-primary flex min-h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#2ac414] via-[#83ff00] to-[#2ac414] px-6 py-3 text-sm font-bold shadow-[0_16px_40px_rgba(131,255,0,0.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Please wait..." : isRegister ? "Create account" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#a4b19e]">
            {isRegister ? "Already have an account?" : "New to Airveek?"}{" "}
            <Link className="font-bold text-[#83ff00] underline-offset-4 hover:underline" href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Log in" : "Create an account"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
