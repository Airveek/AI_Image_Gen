import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getWhopAccountId,
  getWhopCheckoutRedirectUrl,
  getWhopClient,
  getWhopPlanId,
} from "@/lib/whop/client";
import { isCheckoutRequest } from "@/lib/whop/checkout";

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please log in before checkout." }, { status: 401 });
  }

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose a valid plan." }, { status: 400 });
  }

  if (!isCheckoutRequest(requestBody)) {
    return NextResponse.json({ error: "Choose a valid plan." }, { status: 400 });
  }

  try {
    const checkout = await getWhopClient().checkoutConfigurations.create({
      account_id: getWhopAccountId(),
      metadata: {
        supabase_user_id: user.id,
      },
      mode: "payment",
      plan_id: getWhopPlanId(requestBody.plan),
      redirect_url: getWhopCheckoutRedirectUrl(),
    });

    if (!checkout.purchase_url) {
      throw new Error("Whop did not return a checkout URL.");
    }

    return NextResponse.json({ purchaseUrl: checkout.purchase_url });
  } catch (error: unknown) {
    console.error("Unable to create Whop checkout session.", error);
    return NextResponse.json(
      { error: "We could not start checkout. Please try again." },
      { status: 502 },
    );
  }
}
