import type { LLMConfig } from "./llmConfigStore";

export type VaultMode = "local" | "encrypted" | "session";

interface VaultPreferences {
  mode: VaultMode;
  updatedAt?: string;
  hasPassphrase?: boolean;
}

interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  updatedAt: string;
}

const PREF_KEY = "impetus.llmVault.pref";
const ENCRYPTED_KEY = "impetus.llmVault.encrypted";
const SALT_KEY = "impetus.llmVault.salt";
const LOCAL_KEY = "impetus.llmConfig";
const SESSION_IDLE_MS = Number(import.meta.env.VITE_SESSION_IDLE_MS ?? 5 * 60 * 1000);

let cache: LLMConfig | null = null;
let encryptionKey: CryptoKey | null = null;
let pendingUnlock = false;
let sessionTimer: number | undefined;
const subscribers = new Set<() => void>();

function notify(): void {
  subscribers.forEach((fn) => fn());
}

function readPreferences(): VaultPreferences {
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (raw) return JSON.parse(raw) as VaultPreferences;
  } catch {
    // ignore
  }
  return { mode: "local" };
}

function writePreferences(pref: VaultPreferences): void {
  window.localStorage.setItem(PREF_KEY, JSON.stringify(pref));
}

export function getVaultMode(): VaultMode {
  return readPreferences().mode ?? "local";
}

export function getVaultMetadata(): VaultPreferences {
  return readPreferences();
}

export function subscribeVault(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function getVaultCache(): LLMConfig | null {
  return cache;
}

export function isVaultLocked(): boolean {
  return pendingUnlock;
}

function encode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  return window.btoa(String.fromCharCode(...bytes));
}

function decode(value: string): Uint8Array {
  return Uint8Array.from(window.atob(value), (c) => c.charCodeAt(0));
}

function ensureSalt(): Uint8Array {
  const raw = window.localStorage.getItem(SALT_KEY);
  if (raw) return decode(raw);
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  window.localStorage.setItem(SALT_KEY, encode(salt));
  return salt;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 200_000,
      hash: "SHA-256",
    },
    passKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function setVaultPassphrase(passphrase: string): Promise<void> {
  const salt = ensureSalt();
  const newKey = await deriveKey(passphrase, salt);
  const pref = { ...readPreferences(), hasPassphrase: true };
  const hasEncryptedPayload = Boolean(window.localStorage.getItem(ENCRYPTED_KEY));
  const wasLocked = pendingUnlock && hasEncryptedPayload;

  if (wasLocked) {
    encryptionKey = newKey;
    pendingUnlock = false;
    writePreferences(pref);
    await loadVaultConfig();
    notify();
    return;
  }

  const currentConfig = cache;
  encryptionKey = newKey;
  pendingUnlock = false;
  writePreferences(pref);

  if (currentConfig) {
    await saveVaultConfig(currentConfig);
    return;
  }

  notify();
}

function resetSessionTimer(): void {
  if (sessionTimer) {
    window.clearTimeout(sessionTimer);
    sessionTimer = undefined;
  }
  if (getVaultMode() !== "session") {
    return;
  }
  sessionTimer = window.setTimeout(() => {
    cache = null;
    notify();
  }, SESSION_IDLE_MS);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && getVaultMode() === "session") {
      cache = null;
      notify();
    }
  });

  ["mousemove", "keydown", "mousedown", "touchstart"].forEach((event) => {
    document.addEventListener(event, resetSessionTimer);
  });
}

export async function setVaultMode(mode: VaultMode): Promise<void> {
  const pref = readPreferences();
  if (pref.mode === mode) {
    return;
  }

  const nextPref: VaultPreferences = { ...pref, mode };
  if (mode === "encrypted") {
    nextPref.hasPassphrase = Boolean(window.localStorage.getItem(ENCRYPTED_KEY));
    encryptionKey = null;
    pendingUnlock = Boolean(nextPref.hasPassphrase);
  } else {
    delete nextPref.hasPassphrase;
    pendingUnlock = false;
    encryptionKey = null;
  }

  if (mode !== "session") {
    cache = null;
  }

  writePreferences(nextPref);
  notify();
}

export async function loadVaultConfig(): Promise<LLMConfig | null> {
  const mode = getVaultMode();
  if (mode === "session") {
    resetSessionTimer();
    return cache;
  }
  if (mode === "local") {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (!raw) {
        cache = null;
        return null;
      }
      cache = JSON.parse(raw) as LLMConfig;
      return cache;
    } catch {
      cache = null;
      return null;
    }
  }
  const payloadRaw = window.localStorage.getItem(ENCRYPTED_KEY);
  if (!payloadRaw) {
    cache = null;
    pendingUnlock = false;
    return null;
  }
  if (!encryptionKey) {
    cache = null;
    pendingUnlock = true;
    return null;
  }
  try {
    const payload = JSON.parse(payloadRaw) as EncryptedPayload;
    const iv = decode(payload.iv);
    const ciphertext = decode(payload.ciphertext);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      encryptionKey,
      ciphertext
    );
    const decoded = new TextDecoder().decode(decrypted);
    cache = JSON.parse(decoded) as LLMConfig;
    pendingUnlock = false;
    return cache;
  } catch {
    cache = null;
    pendingUnlock = true;
    throw new Error("Unable to decrypt BYOK config");
  }
}

export async function saveVaultConfig(config: LLMConfig): Promise<void> {
  const mode = getVaultMode();
  const updatedAt = new Date().toISOString();
  const pref = { ...readPreferences(), updatedAt };
  if (mode === "session") {
    cache = config;
    resetSessionTimer();
  } else if (mode === "local") {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(config));
    cache = config;
  } else {
    if (!encryptionKey) {
      throw new Error("Passphrase required for encrypted storage");
    }
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(config));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      encryptionKey,
      encoded
    );
    const payload: EncryptedPayload = {
      ciphertext: encode(ciphertext),
      iv: encode(iv),
      updatedAt,
    };
    window.localStorage.setItem(ENCRYPTED_KEY, JSON.stringify(payload));
    cache = config;
  }
  writePreferences(pref);
  notify();
}

export async function clearVault(): Promise<void> {
  window.localStorage.removeItem(LOCAL_KEY);
  window.localStorage.removeItem(ENCRYPTED_KEY);
  cache = null;
  const pref = readPreferences();
  delete pref.updatedAt;
  if (getVaultMode() === "encrypted") {
    pref.hasPassphrase = false;
    encryptionKey = null;
  }
  writePreferences(pref);
  pendingUnlock = false;
  notify();
}

export function resetEncryptedVault(): void {
  window.localStorage.removeItem(SALT_KEY);
  window.localStorage.removeItem(ENCRYPTED_KEY);
  cache = null;
  encryptionKey = null;
  pendingUnlock = true;
  const pref = readPreferences();
  pref.hasPassphrase = false;
  delete pref.updatedAt;
  writePreferences(pref);
  notify();
}

export function lockVault(): void {
  if (getVaultMode() === "session") {
    cache = null;
  }
  encryptionKey = null;
  pendingUnlock = getVaultMode() === "encrypted";
  notify();
}

export type VaultMetadata = VaultPreferences;
