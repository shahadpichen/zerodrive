import { withVaultMetadataCommitLock } from "../../utils/vaultMetadataCommitCoordinator";

describe("vault metadata commit coordinator", () => {
  it("serializes vault-index mutations for the same account", async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });

    const first = withVaultMetadataCommitLock("Owner@Example.com", async () => {
      order.push("first:start");
      markFirstStarted();
      await firstGate;
      order.push("first:end");
    });
    const second = withVaultMetadataCommitLock(
      "owner@example.com",
      async () => {
        order.push("second:start");
        order.push("second:end");
      },
    );

    await firstStarted;
    expect(order).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });

  it("allows different accounts to commit independently", async () => {
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = withVaultMetadataCommitLock("one@example.com", async () => {
      started.push("one");
      await gate;
    });
    const second = withVaultMetadataCommitLock("two@example.com", async () => {
      started.push("two");
    });

    await second;
    expect(started).toEqual(["one", "two"]);
    release();
    await first;
  });
});
