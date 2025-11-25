import { describe, it, expect, beforeEach } from "vitest";
import {
  saveVaultConfig,
  setVaultMode,
  getVaultCache,
  getVaultMode,
  loadVaultConfig,
} from "./llmKeyVault";

const LOCAL_KEY = "impetus.llmConfig";
const ENCRYPTED_KEY = "impetus.llmVault.encrypted";

describe("setVaultMode", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await setVaultMode("local");
  });

  it("clears persisted payloads and cache when switching to session", async () => {
    await saveVaultConfig({ provider: "openai", model: "gpt-4o-mini", apiKey: "sk-test" });
    window.localStorage.setItem(ENCRYPTED_KEY, "ciphertext");

    expect(window.localStorage.getItem(LOCAL_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(ENCRYPTED_KEY)).not.toBeNull();

    await setVaultMode("session");

    expect(getVaultMode()).toBe("session");
    expect(window.localStorage.getItem(LOCAL_KEY)).toBeNull();
    expect(window.localStorage.getItem(ENCRYPTED_KEY)).toBeNull();
    expect(getVaultCache()).toBeNull();

    const loaded = await loadVaultConfig();
    expect(loaded).toBeNull();
  });
});
