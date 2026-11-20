import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";

describe("Yjs document updates", () => {
  const documents: Y.Doc[] = [];
  const createDocument = () => {
    const document = new Y.Doc();
    documents.push(document);
    return document;
  };

  afterEach(() => {
    for (const document of documents.splice(0)) document.destroy();
  });

  it("converges after concurrent text insertions are exchanged", () => {
    const alice = createDocument();
    const bob = createDocument();
    alice.getText("content").insert(0, "Alice");
    bob.getText("content").insert(0, "Bob");

    const aliceUpdate = Y.encodeStateAsUpdate(alice);
    const bobUpdate = Y.encodeStateAsUpdate(bob);
    Y.applyUpdate(alice, bobUpdate);
    Y.applyUpdate(bob, aliceUpdate);

    expect(alice.getText("content").toString()).toBe(
      bob.getText("content").toString(),
    );
    expect(alice.getText("content").toString()).toContain("Alice");
    expect(alice.getText("content").toString()).toContain("Bob");
  });

  it("persists a binary state update and safely reapplies it", () => {
    const source = createDocument();
    source.getText("content").insert(0, "durable");
    const persisted = Buffer.from(Y.encodeStateAsUpdate(source));
    const restored = createDocument();
    Y.applyUpdate(restored, new Uint8Array(persisted));
    Y.applyUpdate(restored, new Uint8Array(persisted));

    expect(restored.getText("content").toString()).toBe("durable");
  });
});
