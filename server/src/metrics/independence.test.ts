import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeIndependence, computeIndependenceValue, type SessionForMetrics } from "./independence";

// These functions decide what a nervous language learner is told about their
// own progress, so the tests below are mostly about what must NEVER happen:
// asking for help being scored as failure, the app crediting itself for
// sentences it wrote, and a confident number appearing where there's no data.

type TurnSpec = { speaker: "user" | "agent"; text: string; fromSuggestion?: boolean };

function session(
  turns: TurnSpec[],
  extra: Partial<Omit<SessionForMetrics, "turns">> = {}
): SessionForMetrics {
  return {
    turns: turns.map((t) => ({ ...t, fromSuggestion: t.fromSuggestion ?? false })),
    nonAnswerTurnIndices: extra.nonAnswerTurnIndices ?? [],
    clarificationTurnIndices: extra.clarificationTurnIndices ?? [],
    helpEvents: extra.helpEvents ?? [],
  };
}

const user = (text: string, fromSuggestion = false): TurnSpec => ({
  speaker: "user",
  text,
  fromSuggestion,
});
const agent = (text: string): TurnSpec => ({ speaker: "agent", text });

describe("computeIndependenceValue", () => {
  test("is null with no user turns, rather than zero", () => {
    // A metric with no denominator is absent, not zero. Rendering 0% to
    // someone who has said nothing yet would be a verdict on nothing.
    assert.equal(computeIndependenceValue([]), null);
    assert.equal(computeIndependenceValue([session([agent("Hello?")])]), null);
  });

  test("counts only user turns", () => {
    const s = session([agent("a"), user("b"), agent("c"), user("d")]);
    assert.equal(computeIndependenceValue([s]), 100);
  });

  test("a turn taken from a suggestion is not handled alone", () => {
    const s = session([user("mine"), user("the app wrote this", true)]);
    assert.equal(computeIndependenceValue([s]), 50);
  });

  test("a tagged non-answer is not handled alone", () => {
    const s = session([user("a real answer"), user("okay")], { nonAnswerTurnIndices: [1] });
    assert.equal(computeIndependenceValue([s]), 50);
  });

  test("asking for clarification is never counted against you", () => {
    // The whole premise of the app: asking someone to repeat themselves is
    // the skill being taught, so it has to score as a turn handled alone.
    const s = session([user("could you say that again?")], { clarificationTurnIndices: [0] });
    assert.equal(computeIndependenceValue([s]), 100);
  });

  test("clarification wins even when the phrasing came from a suggestion", () => {
    // Deliberate: the clarification check runs before the fromSuggestion one.
    // Reaching for help to ask someone to repeat themselves is still the
    // behaviour being encouraged, so it must not be scored as leaning on the
    // app. Without this case the rule above passes vacuously, since nothing
    // else in it competes to mark the turn as unaided.
    const s = session([user("Sorry, could you say that again?", true)], {
      clarificationTurnIndices: [0],
    });
    assert.equal(computeIndependenceValue([s]), 100);
  });

  test("clarification wins even if the same turn is also tagged a non-answer", () => {
    // The tagger is instructed never to do this, but "I don't understand"
    // trips both descriptions, so the tie must resolve in the user's favour.
    const s = session([user("I don't understand, can you explain?")], {
      nonAnswerTurnIndices: [0],
      clarificationTurnIndices: [0],
    });
    assert.equal(computeIndependenceValue([s]), 100);
  });

  test("counts turns, not help requests, so it can never go negative", () => {
    // Three lookups before sending one sentence is one turn not managed
    // alone. The old formula subtracted help events and needed clamping.
    const s = session([user("one sentence", true)], {
      helpEvents: [
        { keyPhrase: "a", suggestedText: "a" },
        { keyPhrase: "b", suggestedText: "b" },
        { keyPhrase: "c", suggestedText: "c" },
      ],
    });
    assert.equal(computeIndependenceValue([s]), 0);
  });

  test("aggregates across sessions in the window", () => {
    const clean = session([user("a"), user("b")]);
    const helped = session([user("c", true), user("d", true)]);
    assert.equal(computeIndependenceValue([clean, helped]), 50);
  });
});

describe("computeIndependence", () => {
  test("returns null when there is nothing to measure", () => {
    assert.equal(computeIndependence([], []), null);
  });

  test("count/total are the real fraction shown in the ring", () => {
    const s = session([user("a"), user("b"), user("c", true), user("d")]);
    const metric = computeIndependence([s], []);
    assert.equal(metric?.count, 3);
    assert.equal(metric?.total, 4);
    assert.equal(metric?.value, 75);
  });

  test("previous is null when the previous window is empty", () => {
    // No trend renders rather than a trend against nothing.
    const metric = computeIndependence([session([user("a")])], []);
    assert.equal(metric?.previous, null);
  });

  test("previous is computed when a previous window exists", () => {
    const now = session([user("a"), user("b")]);
    const before = session([user("c", true), user("d")]);
    assert.equal(computeIndependence([now], [before])?.previous, 50);
  });

  describe("bands", () => {
    // Thresholds are BAND_LOW 40 / BAND_HIGH 70. These pin the boundaries so
    // a threshold change is a deliberate act rather than an accident.
    const withRatio = (handled: number, total: number) => {
      const turns = Array.from({ length: total }, (_, i) => user(`turn ${i}`, i >= handled));
      return computeIndependence([session(turns)], []);
    };

    test("below 40 is low", () => assert.equal(withRatio(3, 10)?.band, "low"));
    test("exactly 40 is mid", () => assert.equal(withRatio(4, 10)?.band, "mid"));
    test("exactly 70 is high", () => assert.equal(withRatio(7, 10)?.band, "high"));
    test("100 is high", () => assert.equal(withRatio(10, 10)?.band, "high"));
  });
});

describe("evidence", () => {
  test("bestUnaidedTurn never quotes a turn that came from a suggestion", () => {
    // The card exists to counter self-underestimation. Showing the app's own
    // sentence back as proof of progress would invert its entire purpose.
    const long = "I would like to try physiotherapy before starting any new medication";
    const metric = computeIndependence([session([user(long, true)])], []);
    assert.equal(metric?.evidence.bestUnaidedTurn, null);
  });

  test("bestUnaidedTurn never quotes a tagged non-answer", () => {
    const dodge = "I do not really know what you mean by any of that honestly";
    const metric = computeIndependence([session([user(dodge)], { nonAnswerTurnIndices: [0] })], []);
    assert.equal(metric?.evidence.bestUnaidedTurn, null);
  });

  test("bestUnaidedTurn ignores turns below the word threshold", () => {
    // "Yes" proves nothing about whether they could manage the sentence.
    const metric = computeIndependence([session([user("Yes, ibuprofen.")])], []);
    assert.equal(metric?.evidence.bestUnaidedTurn, null);
  });

  test("bestUnaidedTurn picks the longest qualifying turn", () => {
    const shorter = "I have had back pain for about two weeks";
    const longer = "The pain is a bit better but it still hurts when I lift things";
    const metric = computeIndependence([session([user(shorter), user(longer)])], []);
    assert.equal(metric?.evidence.bestUnaidedTurn, longer);
  });

  test("struggle phrases are ranked by how often they were needed", () => {
    const s = session([user("x")], {
      helpEvents: [
        { keyPhrase: "rare", suggestedText: "" },
        { keyPhrase: "common", suggestedText: "" },
        { keyPhrase: "common", suggestedText: "" },
      ],
    });
    const phrases = computeIndependence([s], [])?.evidence.strugglePhrases;
    assert.deepEqual(phrases?.[0], { phrase: "common", count: 2 });
  });

  test("a non-answer moment carries the question it dodged", () => {
    const s = session([agent("How bad is the pain?"), user("Okay.")], {
      nonAnswerTurnIndices: [1],
    });
    const moment = computeIndependence([s], [])?.evidence.nonAnswerMoments[0];
    assert.equal(moment?.question, "How bad is the pain?");
    assert.equal(moment?.reply, "Okay.");
  });

  test("'I don't know' is unsure, not unclear", () => {
    // Suggesting "could you say that again?" here would be nonsense: they
    // understood the question, they just had no answer.
    const s = session([agent("Any symptoms?"), user("i don't know")], {
      nonAnswerTurnIndices: [1],
    });
    assert.equal(computeIndependence([s], [])?.evidence.nonAnswerMoments[0]?.kind, "unsure");
  });

  test("a bare acknowledgment is unclear", () => {
    const s = session([agent("Any symptoms?"), user("Mm.")], { nonAnswerTurnIndices: [1] });
    assert.equal(computeIndependence([s], [])?.evidence.nonAnswerMoments[0]?.kind, "unclear");
  });

  test("clarifications are counted so they can be shown as a win", () => {
    const s = session([user("what does that mean?"), user("sorry, again?")], {
      clarificationTurnIndices: [0, 1],
    });
    assert.equal(computeIndependence([s], [])?.evidence.clarificationCount, 2);
  });
});
