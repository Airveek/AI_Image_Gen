import type { Metadata } from "next";

import { FashionPlayground } from "@/features/fashion-playground/fashion-playground";
import { getActiveBillingConfiguration } from "@/features/billing/server/settings";
import { getGenerationAccessForUser } from "@/features/creator/server/credits";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { noIndexMetadata } from "@/lib/seo/site";

export const metadata: Metadata = { title: "AI Fashion Photoshoot Playground", ...noIndexMetadata };

export default async function FashionPhotoshootPlaygroundPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [billing, access] = await Promise.all([
    getActiveBillingConfiguration(),
    user ? getGenerationAccessForUser(user.id) : Promise.resolve({ hasPaidAccess: false, granted: 2, used: 0, reserved: 0, remaining: 2 }),
  ]);
  return <FashionPlayground authenticated={Boolean(user)} initialAccess={access} billingMode={billing.mode} />;
}
