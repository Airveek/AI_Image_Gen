import { serve } from "inngest/next";

import { inngest } from "@/features/store-images/server/inngest-client";
import { storeImageFunctions } from "@/features/store-images/server/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: storeImageFunctions,
});
