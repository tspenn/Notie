import { localDb } from '@/lib/localDb';
import type { NotieStore } from '@/lib/types';

const PASSPHRASE = 'notie-skyland-2026-backup';
const SALT = 'notie-backup-salt-v1';
const MAGIC = [0x4e, 0x4f, 0x54, 0x49]; // "NOTI"

export type NotieBackupPayload = {
  _notie_backup: true;
  version: 1;
  app: 'Notie';
  exported_at: string;
  store: NotieStore;
};

async function deriveKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(PASSPHRASE),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptBackup(payload: object): Promise<Blob> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const out = new Uint8Array(4 + 12 + encrypted.byteLength);
  out.set(new Uint8Array(MAGIC), 0);
  out.set(iv, 4);
  out.set(new Uint8Array(encrypted), 16);
  return new Blob([out], { type: 'application/octet-stream' });
}

async function decryptBackup(buffer: ArrayBuffer): Promise<NotieBackupPayload> {
  const bytes = new Uint8Array(buffer);
  if (Array.from(bytes.slice(0, 4)).join(',') !== MAGIC.join(',')) {
    throw new Error('Not a valid Notie backup file (.notiebak).');
  }
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(4, 16) },
    await deriveKey(),
    bytes.slice(16),
  );
  const parsed = JSON.parse(new TextDecoder().decode(decrypted)) as NotieBackupPayload;
  if (!parsed?._notie_backup || !parsed.store) {
    throw new Error('Not a valid Notie backup file.');
  }
  return parsed;
}

/** Download an encrypted full-library backup for the current device store. */
export async function downloadNotieBackup(): Promise<void> {
  const store = localDb.getStore();
  const payload: NotieBackupPayload = {
    _notie_backup: true,
    version: 1,
    app: 'Notie',
    exported_at: new Date().toISOString(),
    store,
  };
  const blob = await encryptBackup(payload);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notie-backup-${new Date().toISOString().slice(0, 10)}.notiebak`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Restore a .notiebak file into local storage.
 * Reassigns library rows to currentUserId when provided (signed-in account).
 */
export async function restoreNotieBackup(
  file: File,
  currentUserId?: string | null,
): Promise<{ notebooks: number; entries: number }> {
  const buffer = await file.arrayBuffer();
  const parsed = await decryptBackup(buffer);
  const store = parsed.store;
  if (store.version !== 2) {
    throw new Error('Unsupported backup version.');
  }

  localDb.replaceStore(store);

  if (currentUserId) {
    const prior = localDb.getProfile()?.id;
    if (prior && prior !== currentUserId) {
      localDb.reassignUserId(prior, currentUserId);
    } else {
      localDb.ensureProfileForCloudUser(
        currentUserId,
        localDb.getProfile()?.plan ?? 'trial',
      );
    }
  }

  const after = localDb.getStore();
  return {
    notebooks: after.notebooks.length,
    entries: after.entries.length,
  };
}
