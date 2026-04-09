/**
 * LLM Key Vault
 *
 * Secure storage for LLM API keys with support for local, encrypted,
 * and session storage modes. Uses Web Crypto API for AES-GCM encryption.
 *
 * @module services/llmKeyVault
 */

import type { LLMConfig } from "./llmConfigStore";

/**
 * Vault storage mode.
 *
 * - "local": Plain text in localStorage (default)
 * - "encrypted": AES-256-GCM encrypted with user passphrase
 * - "session": In-memory only, cleared on idle/visibility change
 */
export type VaultMode = "local" | "encrypted" | "session";

/**
 * Vault preferences stored in localStorage.
 */
interface VaultPreferences {
  /** Current storage mode */
  mode: VaultMode;
  /** Last update timestamp */
  updatedAt?: string;
  /** Whether passphrase is set (encrypted mode) */
  hasPassphrase?: boolean;
}

/**
 * Encrypted payload structure.
 */
interface EncryptedPayload {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded IV */
  iv: string;
  /** Encryption timestamp */
  updatedAt: string;
}

const PREF_KEY = "impetus.llmVault.pref";
const ENCRYPTED_KEY = "impetus.llmVault.encrypted";
const SALT_KEY = "impetus.llmVault.salt";
const LOCAL_KEY = "impetus.llmConfig";
const SESSION_IDLE_MS = Number(import.meta.env.VITE_SESSION_IDLE_MS ?? 5 * 60 * 1000);

/** In-memory cache for current config */
let cache: LLMConfig | null = null;
/** Derived encryption key */
let encryptionKey: CryptoKey | null = null;
/** Whether vault is locked (awaiting passphrase) */
let pendingUnlock = false;
/** Session idle timer */
let sessionTimer: number | undefined;
/** State change subscribers */
const subscribers = new Set<() => void>();

/**
 * Notify all subscribers of state change.
 *
 * Iterates through all registered listeners and invokes them.
 * Called whenever vault state changes (config loaded, saved, cleared, locked).
 */
function notify(): void {
  subscribers.forEach((fn) => fn());
}

/**
 * Read vault preferences from localStorage.
 *
 * Safely parses stored preferences, returning defaults on error.
 *
 * @returns Vault preferences object with current mode and metadata
 */
function readPreferences(): VaultPreferences {
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (raw) return JSON.parse(raw) as VaultPreferences;
  } catch {
    // ignore
  }
  return { mode: "local" };
}

/**
 * Write vault preferences to localStorage.
 *
 * Persists vault configuration including mode, timestamps, and passphrase status.
 *
 * @param pref - Preferences object to persist
 */
function writePreferences(pref: VaultPreferences): void {
  window.localStorage.setItem(PREF_KEY, JSON.stringify(pref));
}

/**
 * Get current vault storage mode.
 *
 * @returns Current mode (defaults to "local")
 */
export function getVaultMode(): VaultMode {
  return readPreferences().mode ?? "local";
}

/**
 * Get vault metadata/preferences.
 *
 * @returns Current vault preferences
 */
export function getVaultMetadata(): VaultPreferences {
  return readPreferences();
}

/**
 * Subscribe to vault state changes.
 *
 * @param listener - Callback function on state change
 * @returns Unsubscribe function
 *
 * @example
 * ```ts
 * const unsubscribe = subscribeVault(() => {
 *   console.log('Vault state changed');
 * });
 * // Later: unsubscribe();
 * ```
 */
export function subscribeVault(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

/**
 * Get cached vault config.
 *
 * @returns Cached config or null
 */
export function getVaultCache(): LLMConfig | null {
  return cache;
}

/**
 * Check if encrypted vault is locked.
 *
 * @returns True if vault is locked and awaiting passphrase
 */
export function isVaultLocked(): boolean {
  return pendingUnlock;
}

/**
 * Encode ArrayBuffer/Uint8Array to base64.
 *
 * Converts binary data to base64 string for JSON-safe storage.
 *
 * @param buffer - Binary buffer to encode (ArrayBuffer or Uint8Array)
 * @returns Base64-encoded string
 */
function encode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  return window.btoa(String.fromCharCode(...bytes));
}

/**
 * Decode base64 to Uint8Array.
 *
 * Converts base64 string back to binary data for decryption operations.
 *
 * @param value - Base64-encoded string
 * @returns Decoded Uint8Array bytes
 */
function decode(value: string): Uint8Array {
  return Uint8Array.from(window.atob(value), (c) => c.charCodeAt(0));
}

/**
 * Get or create salt for key derivation.
 *
 * Retrieves existing salt from storage or generates a new cryptographically
 * secure random salt for PBKDF2 key derivation.
 *
 * @returns 16-byte salt as Uint8Array
 */
function ensureSalt(): Uint8Array {
  const raw = window.localStorage.getItem(SALT_KEY);
  if (raw) return decode(raw);
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  window.localStorage.setItem(SALT_KEY, encode(salt));
  return salt;
}

/**
 * Derive encryption key from passphrase using PBKDF2.
 *
 * Uses PBKDF2 with 200,000 iterations and SHA-256 to derive a 256-bit
 * AES-GCM key from the user's passphrase and stored salt.
 *
 * @param passphrase - User-provided passphrase
 * @param salt - 16-byte salt for key derivation
 * @returns Derived AES-GCM CryptoKey for encryption/decryption
 */
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

/**
 * Set passphrase for encrypted vault mode.
 *
 * Unlocks vault if passphrase is correct, or re-encrypts with new passphrase.
 *
 * @param passphrase - User passphrase
 *
 * @example
 * ```ts
 * await setVaultPassphrase('my-secret-passphrase');
 * ```
 */
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

/**
 * Reset session idle timer.
 *
 * Clears existing timer and sets new timeout to clear cache after
 * inactivity in session mode. Resets on user activity (mouse, keyboard).
 *
 * @see SESSION_IDLE_MS - Default idle timeout (5 minutes)
 */
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

/**
 * Event handlers for session mode lifecycle management.
 *
 * Manages cache clearing on visibility change and activity tracking
 * for automatic session expiration.
 */
const sessionEventHandlers = {
  /**
   * Clear cache when document becomes hidden in session mode.
   */
  visibilityChange: () => {
    if (document.visibilityState === "hidden" && getVaultMode() === "session") {
      cache = null;
      notify();
    }
  },
  resetSessionTimer,
};

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", sessionEventHandlers.visibilityChange);
  ["mousemove", "keydown", "mousedown", "touchstart"].forEach((event) => {
    document.addEventListener(event, sessionEventHandlers.resetSessionTimer);
  });
}

/**
 * Clean up session mode event listeners.
 *
 * Removes all document-level event listeners for session management.
 * Should be called on component unmount or app shutdown.
 */
export function cleanupSessionListeners(): void {
  if (typeof document === "undefined") return;
  document.removeEventListener("visibilitychange", sessionEventHandlers.visibilityChange);
  ["mousemove", "keydown", "mousedown", "touchstart"].forEach((event) => {
    document.removeEventListener(event, sessionEventHandlers.resetSessionTimer);
  });
}

/**
 * Set vault storage mode.
 *
 * Switches between local, encrypted, and session modes.
 * Clears existing data when switching to session mode.
 *
 * @param mode - New vault mode
 *
 * @example
 * ```ts
 * await setVaultMode('encrypted'); // Enable BYOK mode
 * ```
 */
export async function setVaultMode(mode: VaultMode): Promise<void> {
  const pref = readPreferences();
  if (pref.mode === mode) {
    return;
  }

  const nextPref: VaultPreferences = { ...pref, mode };
  if (mode === "session") {
    // Session mode must not retain persisted secrets
    window.localStorage.removeItem(LOCAL_KEY);
    window.localStorage.removeItem(ENCRYPTED_KEY);
    delete nextPref.updatedAt;
    nextPref.hasPassphrase = false;
  }
  if (mode === "encrypted") {
    nextPref.hasPassphrase = Boolean(window.localStorage.getItem(ENCRYPTED_KEY));
    encryptionKey = null;
    pendingUnlock = Boolean(nextPref.hasPassphrase);
  } else {
    delete nextPref.hasPassphrase;
    pendingUnlock = false;
    encryptionKey = null;
  }

  cache = null;

  writePreferences(nextPref);
  notify();
}

/**
 * Load LLM config from vault.
 *
 * Handles all three storage modes. Returns null if vault is locked.
 *
 * @returns Loaded config or null
 * @throws {Error} If decryption fails in encrypted mode
 *
 * @example
 * ```ts
 * const config = await loadVaultConfig();
 * if (config) {
 *   console.log('Loaded:', config.provider);
 * } else {
 *   console.log('Vault is empty or locked');
 * }
 * ```
 */
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

/**
 * Save LLM config to vault.
 *
 * Encrypts data in encrypted mode, uses plain localStorage in local mode.
 *
 * @param config - Config to save
 * @throws {Error} If passphrase not set in encrypted mode
 *
 * @example
 * ```ts
 * await saveVaultConfig({
 *   provider: 'openai',
 *   model: 'gpt-4o-mini',
 *   apiKey: 'sk-...'
 * });
 * ```
 */
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

/**
 * Clear all vault data.
 *
 * Removes stored config and resets metadata.
 *
 * @example
 * ```ts
 * await clearVault(); // Wipe all data
 * ```
 */
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

/**
 * Reset encrypted vault.
 *
 * Removes salt and encrypted data, forcing user to set new passphrase.
 *
 * @example
 * ```ts
 * resetEncryptedVault(); // Reset BYOK vault
 * ```
 */
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

/**
 * Lock the vault.
 *
 * Clears encryption key from memory. In session mode, also clears cache.
 *
 * @example
 * ```ts
 * lockVault(); // Lock vault (requires passphrase to unlock)
 * ```
 */
export function lockVault(): void {
  if (getVaultMode() === "session") {
    cache = null;
  }
  encryptionKey = null;
  pendingUnlock = getVaultMode() === "encrypted";
  notify();
}

/** Vault metadata type alias. */
export type VaultMetadata = VaultPreferences;
