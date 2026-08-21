"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getAuthErrorMessage } from "@/lib/auth/auth-messages";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    const { error: signOutError } = await createClient().auth.signOut({ scope: "local" });

    if (signOutError) {
      toast.error(getAuthErrorMessage(signOutError, "logout"));
      setIsLoggingOut(false);
      return;
    }

    toast.success("You have been logged out.");
    router.replace("/login");
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        className="min-h-11 rounded-full border border-[#83ff00]/35 bg-white/[0.04] px-5 py-2 text-sm font-bold text-[#fdfdfd] transition hover:border-[#83ff00] hover:bg-[#83ff00]/10 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? "Logging out..." : "Log out"}
      </button>
    </div>
  );
}
