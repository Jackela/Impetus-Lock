/* Client-side cryptographic utilities. */

/** AES-GCM encryption helper for client-side secrets. */
export class CryptoService {
  private static readonly ALGORITHM = "AES-GCM";

  /**
   * Import a raw key string as an AES-GCM CryptoKey.
   *
   * @param key - Raw key material
   * @returns CryptoKey usable for encryption and decryption
   */
  static async importKey(key: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    return crypto.subtle.importKey("raw", encoder.encode(key), { name: this.ALGORITHM }, false, [
      "encrypt",
      "decrypt",
    ]);
  }

  /**
   * Encrypt data with AES-GCM, returning base64(iv + ciphertext).
   *
   * @param data - Plaintext to encrypt
   * @param key - Raw key material
   * @returns Base64-encoded IV and ciphertext
   */
  static async encrypt(data: string, key: string): Promise<string> {
    const cryptoKey = await this.importKey(key);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    const ciphertext = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv },
      cryptoKey,
      encoder.encode(data)
    );

    const combined = new Uint8Array([...iv, ...new Uint8Array(ciphertext)]);
    return btoa(String.fromCharCode(...combined));
  }
}
