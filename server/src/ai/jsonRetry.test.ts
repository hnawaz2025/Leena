import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { assertNoUnexpectedScript, callForJson } from "./jsonRetry";

const schema = z.object({ x: z.string() });
const ok = JSON.stringify({ x: "fine" });

describe("assertNoUnexpectedScript", () => {
  const rejects = (text: string, language: string) =>
    assert.throws(() => assertNoUnexpectedScript(text, language));
  const accepts = (text: string, language: string) =>
    assert.doesNotThrow(() => assertNoUnexpectedScript(text, language));

  test("catches a script the target language does not use", () => {
    rejects("Please book an 预约 appointment", "English");
    rejects("Explicaste bien tu пункт principal", "Spanish");
  });

  test("catches Devanagari, which the original guard missed entirely", () => {
    // Hindi is a supported language and this case went unchecked for the
    // whole life of the previous implementation.
    rejects("Your आपका appointment is confirmed", "English");
    rejects("你的अपॉइंटमेंट已确认", "Mandarin");
  });

  test("catches leaks into non-Latin target languages too", () => {
    rejects("आपका 预约 तय हो गया", "Hindi");
  });

  test("accepts clean output in each supported language", () => {
    accepts("You got your main point across clearly.", "English");
    accepts("Explicaste bien tu punto principal.", "Spanish");
    accepts("आपने अपनी मुख्य बात स्पष्ट रूप से समझाई।", "Hindi");
    accepts("你清楚地表达了你的主要意思。", "Mandarin");
  });

  test("never flags Latin inside a non-Latin language", () => {
    // Proper nouns and borrowed terms are normal here. Rejecting them would
    // fail far more good output than bad.
    accepts("आपने Dr. Priya Shah से बात की।", "Hindi");
    accepts("你和City Eye Clinic预约了。", "Mandarin");
  });
});

describe("callForJson", () => {
  test("extracts JSON wrapped in prose or code fences", () => {
    return callForJson(schema, async () => `Sure!\n\`\`\`json\n${ok}\n\`\`\``).then((r) =>
      assert.deepEqual(r, { x: "fine" })
    );
  });

  test("retries a malformed response and feeds back what was wrong", async () => {
    const notes: (string | undefined)[] = [];
    const result = await callForJson(schema, async (note) => {
      notes.push(note);
      return notes.length === 1 ? "not json at all" : ok;
    });

    assert.deepEqual(result, { x: "fine" });
    assert.equal(notes.length, 2);
    assert.equal(notes[0], undefined);
    // A bare "that was wrong" retry reliably reproduced the same mistake, so
    // the note has to carry the actual failure.
    assert.match(String(notes[1]), /previous response had this problem/i);
  });

  test("retries a schema violation", async () => {
    let calls = 0;
    await callForJson(schema, async () => {
      calls += 1;
      return calls === 1 ? JSON.stringify({ x: 42 }) : ok;
    });
    assert.equal(calls, 2);
  });

  test("gives up after one retry and preserves the cause", async () => {
    await assert.rejects(
      () => callForJson(schema, async () => "still not json"),
      (err: Error) => {
        assert.match(err.message, /did not match the expected shape/);
        assert.ok(err.cause, "cause must survive for error classification");
        return true;
      }
    );
  });

  describe("does not retry what a reworded prompt cannot fix", () => {
    const failsOnce = async (error: unknown) => {
      let calls = 0;
      await callForJson(schema, async () => {
        calls += 1;
        throw error;
      }).catch(() => {});
      return calls;
    };

    test("provider auth failure", async () => {
      assert.equal(await failsOnce(Object.assign(new Error("401"), { status: 401 })), 1);
    });

    test("provider at capacity", async () => {
      // The SDK has already retried this one with backoff by now.
      assert.equal(await failsOnce(Object.assign(new Error("503"), { status: 503 })), 1);
    });

    test("connection failure", async () => {
      assert.equal(
        await failsOnce(Object.assign(new Error("Connection error."), { name: "APIConnectionError" })),
        1
      );
    });
  });

  test("hard validate fails the call", async () => {
    await assert.rejects(() =>
      callForJson(
        schema,
        async () => ok,
        () => {
          throw new Error("structurally wrong");
        }
      )
    );
  });

  test("soft validate retries, then accepts rather than losing the response", async () => {
    // Losing a whole feedback report over a few stray characters in one
    // sentence is the worse outcome, so the last attempt is accepted.
    let calls = 0;
    const result = await callForJson(
      schema,
      async () => {
        calls += 1;
        return ok;
      },
      undefined,
      () => {
        throw new Error("a few odd characters");
      }
    );

    assert.deepEqual(result, { x: "fine" });
    assert.equal(calls, 2);
  });
});
