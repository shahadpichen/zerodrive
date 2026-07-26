import { CAPSULE_MAGIC } from "@zerodrivehq/capsule";
import { encryptFile } from "../../utils/encryptFile";
import {
  clearMnemonic,
  setMnemonic,
} from "../../utils/mnemonicManager";
import { generateVaultRecoveryPhrase } from "../../utils/capsuleAdapter";

describe("encryptFile with Capsule v1", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setMnemonic(generateVaultRecoveryPhrase());
  });

  afterEach(() => {
    clearMnemonic();
  });

  it.each([
    ["text", new File(["private text"], "notes.txt", { type: "text/plain" })],
    [
      "binary",
      new File(
        [new Uint8Array([0, 255, 128, 64, 1])],
        "private-content.bin",
        { type: "application/octet-stream" },
      ),
    ],
    ["empty", new File([], "empty.txt", { type: "text/plain" })],
    [
      "Unicode",
      new File(["Hello 世界 🌍 Привет مرحبا"], "世界.txt", {
        type: "text/plain",
      }),
    ],
  ])("writes %s files as Capsule v1", async (_label, file) => {
    const encrypted = await encryptFile(file);
    const prefix = new TextDecoder().decode(
      new Uint8Array(await encrypted.arrayBuffer()).slice(0, 4),
    );

    expect(encrypted.type).toBe("application/octet-stream");
    expect(prefix).toBe(CAPSULE_MAGIC);
    expect(encrypted.size).toBeGreaterThan(file.size);
  });

  it("uses fresh authenticated encryption for repeated writes", async () => {
    const file = new File(["same content"], "same.txt", {
      type: "text/plain",
    });
    const [first, second] = await Promise.all([
      encryptFile(file),
      encryptFile(file),
    ]);

    expect(new Uint8Array(await first.arrayBuffer())).not.toEqual(
      new Uint8Array(await second.arrayBuffer()),
    );
  });

  it("requires the in-memory recovery phrase", async () => {
    clearMnemonic();

    await expect(
      encryptFile(new File(["content"], "test.txt")),
    ).rejects.toThrow("Open Recovery & Access");
  });
});
