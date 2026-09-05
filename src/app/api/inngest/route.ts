import { serve } from "inngest/next";

import { inngest } from "@/features/store-images/server/inngest-client";
import { storeImageFunctions } from "@/features/store-images/server/functions";
import { seoFunctions } from "@/features/seo/server/jobs";
import { metaDeliveryFunctions } from "@/features/analytics/server/meta-delivery";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...storeImageFunctions, ...seoFunctions, ...metaDeliveryFunctions],
});
