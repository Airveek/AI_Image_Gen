import "server-only";

import { Readable } from "node:stream";
import { google } from "googleapis";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteVaultSecret, readVaultSecret, setVaultSecret } from "@/features/creator/server/integrations";
import type { AllowedImageMimeType } from "@/features/creator/types";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const ROOT_FOLDER_NAME = "Airveek";

type StorageSettingRow = {
  drive_refresh_token_secret_id: string | null;
  drive_folder_id: string | null;
  drive_account_email: string | null;
  drive_connected_at: string | null;
};

export type DriveConnectionStatus = {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
  folderId: string | null;
};

export function getDriveAuthorizationUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [DRIVE_SCOPE],
    state,
  });
}

export async function connectGoogleDrive(code: string): Promise<DriveConnectionStatus> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error("Google did not return an offline refresh token. Reconnect and approve access again.");
  }

  client.setCredentials(tokens);
  const drive = google.drive({ version: "v3", auth: client });
  const rootFolderId = await findOrCreateRootFolder(drive);
  const about = await drive.about.get({ fields: "user(emailAddress)" });
  const accountEmail = about.data.user?.emailAddress ?? null;
  const secretId = await setVaultSecret("airveek_google_drive_refresh_token", tokens.refresh_token);
  const now = new Date().toISOString();

  const { error } = await createSupabaseAdminClient()
    .from("creator_storage_settings")
    .update({
      drive_refresh_token_secret_id: secretId,
      drive_folder_id: rootFolderId,
      drive_account_email: accountEmail,
      drive_connected_at: now,
      updated_at: now,
    })
    .eq("id", true);

  if (error) {
    throw new Error(error.message);
  }

  return {
    configured: true,
    connected: true,
    accountEmail,
    connectedAt: now,
    folderId: rootFolderId,
  };
}

export async function disconnectGoogleDrive(): Promise<void> {
  const row = await getStorageSettingRow();
  const refreshToken = row.drive_refresh_token_secret_id
    ? await readVaultSecret(row.drive_refresh_token_secret_id)
    : null;

  if (refreshToken) {
    await createOAuthClient().revokeToken(refreshToken);
  }

  const { error } = await createSupabaseAdminClient()
    .from("creator_storage_settings")
    .update({
      drive_refresh_token_secret_id: null,
      drive_folder_id: null,
      drive_account_email: null,
      drive_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    throw new Error(error.message);
  }

  if (row.drive_refresh_token_secret_id) {
    await deleteVaultSecret(row.drive_refresh_token_secret_id);
  }
}

export async function getDriveConnectionStatus(): Promise<DriveConnectionStatus> {
  const configured = Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET);

  try {
    const row = await getStorageSettingRow();
    return {
      configured,
      connected: Boolean(row.drive_refresh_token_secret_id && row.drive_folder_id),
      accountEmail: row.drive_account_email,
      connectedAt: row.drive_connected_at,
      folderId: row.drive_folder_id,
    };
  } catch {
    return { configured, connected: false, accountEmail: null, connectedAt: null, folderId: null };
  }
}

export async function uploadDriveImage(input: {
  userId: string;
  assetId: string;
  bytes: Uint8Array;
  mimeType: AllowedImageMimeType;
}): Promise<string> {
  const { drive, rootFolderId } = await createConnectedDriveClient();
  const userFolderId = await findOrCreateUserFolder(drive, rootFolderId, input.userId);
  const extension = extensionForMimeType(input.mimeType);
  const response = await drive.files.create({
    requestBody: {
      name: `${input.assetId}.${extension}`,
      parents: [userFolderId],
      appProperties: {
        airveekAssetId: input.assetId,
        airveekUserId: input.userId,
      },
    },
    media: {
      mimeType: input.mimeType,
      body: Readable.from(Buffer.from(input.bytes)),
    },
    fields: "id",
  });

  if (!response.data.id) {
    throw new Error("Google Drive did not return a file id.");
  }

  return response.data.id;
}

export async function downloadDriveImage(fileId: string): Promise<Uint8Array> {
  const { drive } = await createConnectedDriveClient();
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );

  if (response.data instanceof ArrayBuffer) {
    return new Uint8Array(response.data);
  }

  if (ArrayBuffer.isView(response.data)) {
    return new Uint8Array(response.data.buffer, response.data.byteOffset, response.data.byteLength);
  }

  throw new Error("Google Drive returned an unsupported file response.");
}

export async function deleteDriveImage(fileId: string): Promise<void> {
  const { drive } = await createConnectedDriveClient();

  try {
    await drive.files.delete({ fileId });
  } catch (error) {
    if (isGoogleNotFound(error)) {
      return;
    }
    throw error;
  }
}

async function createConnectedDriveClient() {
  const row = await getStorageSettingRow();

  if (!row.drive_refresh_token_secret_id || !row.drive_folder_id) {
    throw new Error("Google Drive is not connected. Ask an administrator to open Admin → Integrations.");
  }

  const refreshToken = await readVaultSecret(row.drive_refresh_token_secret_id);
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  return {
    drive: google.drive({ version: "v3", auth: client }),
    rootFolderId: row.drive_folder_id,
  };
}

async function getStorageSettingRow(): Promise<StorageSettingRow> {
  const { data, error } = await createSupabaseAdminClient()
    .from("creator_storage_settings")
    .select("drive_refresh_token_secret_id,drive_folder_id,drive_account_email,drive_connected_at")
    .eq("id", true)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Creator storage settings are unavailable.");
  }

  return data as StorageSettingRow;
}

function createOAuthClient() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google Drive OAuth environment variables are not configured.");
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${siteUrl.replace(/\/$/, "")}/admin/integrations/google-drive/callback`,
  );
}

async function findOrCreateRootFolder(drive: ReturnType<typeof google.drive>): Promise<string> {
  const escapedName = ROOT_FOLDER_NAME.replaceAll("'", "\\'");
  const result = await drive.files.list({
    q: `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    spaces: "drive",
    fields: "files(id,name)",
    pageSize: 10,
  });
  const existingId = result.data.files?.[0]?.id;

  if (existingId) {
    return existingId;
  }

  const created = await drive.files.create({
    requestBody: {
      name: ROOT_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      appProperties: { airveekRoot: "true" },
    },
    fields: "id",
  });

  if (!created.data.id) {
    throw new Error("Could not create the Airveek Drive folder.");
  }

  return created.data.id;
}

async function findOrCreateUserFolder(
  drive: ReturnType<typeof google.drive>,
  rootFolderId: string,
  userId: string,
): Promise<string> {
  const result = await drive.files.list({
    q: `'${rootFolderId}' in parents and appProperties has { key='airveekUserId' and value='${userId}' } and trashed=false`,
    spaces: "drive",
    fields: "files(id)",
    pageSize: 2,
  });
  const existingId = result.data.files?.[0]?.id;

  if (existingId) {
    return existingId;
  }

  const created = await drive.files.create({
    requestBody: {
      name: userId,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
      appProperties: { airveekUserId: userId },
    },
    fields: "id",
  });

  if (!created.data.id) {
    throw new Error("Could not create the user's Drive folder.");
  }

  return created.data.id;
}

function extensionForMimeType(mimeType: AllowedImageMimeType): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function isGoogleNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const record = error as Record<string, unknown>;
  return record.code === 404 || record.status === 404;
}
