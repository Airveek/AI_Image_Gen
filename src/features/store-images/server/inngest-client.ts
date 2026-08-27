import { Inngest } from "inngest";

// This ID is the persistent production identity already registered in Inngest.
// Changing it requires an explicit app migration and will break queued functions.
export const INNGEST_STORE_APP_ID = "artistly-store-images";

export const inngest = new Inngest({ id: INNGEST_STORE_APP_ID });
