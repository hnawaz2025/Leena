import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeCoverage, computeCoverageValue, type ScenarioForCoverage } from "./coverage";

// Coverage answers "how many of the conversations I'm preparing for am I
// ready for" -- a count of scenarios, not of checklist items. Most of the
// value in these tests is holding that distinction still, plus the wording
// rule that a nonzero count must never be described as nothing.

function scenario(
  id: string,
  totalItems: number,
  coveredIndices: number[],
  title = `scenario ${id}`
): ScenarioForCoverage {
  return {
    id,
    title,
    checklist: Array.from({ length: totalItems }, (_, i) => ({
      en: `item ${i}`,
      native: `elemento ${i}`,
    })),
    coveredIndices,
  };
}

/** Ready is >= 75%: 3 of 4 items. */
const ready = (id: string) => scenario(id, 4, [0, 1, 2]);
/** Half done, so not ready. */
const notReady = (id: string) => scenario(id, 4, [0, 1]);

describe("computeCoverageValue", () => {
  test("is null with no scenarios, rather than zero", () => {
    assert.equal(computeCoverageValue([]), null);
  });

  test("is the share of scenarios that are ready, not of items covered", () => {
    // 1 of 2 scenarios ready = 50, even though 5 of 8 items are covered.
    assert.equal(computeCoverageValue([ready("a"), notReady("b")]), 50);
  });

  test("a scenario at exactly the threshold counts as ready", () => {
    assert.equal(computeCoverageValue([scenario("a", 4, [0, 1, 2])]), 100);
  });

  test("a scenario just below the threshold does not", () => {
    assert.equal(computeCoverageValue([scenario("a", 3, [0, 1])]), 0); // 67%
  });

  test("an empty checklist is not silently counted as ready", () => {
    assert.equal(computeCoverageValue([scenario("a", 0, [])]), 0);
  });
});

describe("computeCoverage", () => {
  test("returns null when there is nothing to measure", () => {
    assert.equal(computeCoverage([], []), null);
  });

  test("count/total are scenarios ready out of scenarios tracked", () => {
    const metric = computeCoverage([ready("a"), notReady("b"), notReady("c")], []);
    assert.equal(metric?.count, 1);
    assert.equal(metric?.total, 3);
  });

  test("previous is null without a previous window", () => {
    assert.equal(computeCoverage([ready("a")], [])?.previous, null);
  });

  test("previous is computed when one exists", () => {
    assert.equal(computeCoverage([ready("a")], [notReady("b")])?.previous, 0);
  });

  test("the headline never calls a nonzero count 'just started'", () => {
    // Regression: "1 of 4 ready" was once labelled "just started", which
    // claims nothing is ready when something already is. The aggregate uses
    // its own wording for exactly this reason.
    const metric = computeCoverage([ready("a"), notReady("b"), notReady("c"), notReady("d")], []);
    assert.equal(metric?.count, 1);
    assert.equal(metric?.band, "low");
    assert.notEqual(metric?.bandLabel, "just started");
    assert.equal(metric?.bandLabel, "still preparing");
  });

  test("a single scenario still uses per-scenario wording in its evidence", () => {
    // The per-scenario label is allowed to say "just started", because there
    // it describes one conversation accurately.
    const metric = computeCoverage([scenario("a", 8, [0])], []);
    assert.equal(metric?.evidence.scenarios[0]?.bandLabel, "just started");
  });
});

describe("evidence", () => {
  test("lists every scenario in the window, including finished ones", () => {
    // A fully-covered conversation must not vanish from the list just because
    // it has nothing left to practise.
    const metric = computeCoverage([scenario("a", 2, [0, 1]), notReady("b")], []);
    assert.equal(metric?.evidence.scenarios.length, 2);
  });

  test("remaining lists what is actually left, in checklist order", () => {
    const metric = computeCoverage([scenario("a", 4, [1])], []);
    assert.deepEqual(metric?.evidence.scenarios[0]?.remaining, ["item 0", "item 2", "item 3"]);
  });

  test("remaining is capped so the card stays scannable", () => {
    const metric = computeCoverage([scenario("a", 20, [])], []);
    assert.equal(metric?.evidence.scenarios[0]?.remaining.length, 3);
  });

  test("a finished scenario has nothing remaining", () => {
    const metric = computeCoverage([scenario("a", 3, [0, 1, 2])], []);
    assert.deepEqual(metric?.evidence.scenarios[0]?.remaining, []);
  });

  test("carries the scenario id so the card can navigate to it", () => {
    const metric = computeCoverage([scenario("abc-123", 4, [0], "Talking to my landlord")], []);
    assert.equal(metric?.evidence.scenarios[0]?.scenarioId, "abc-123");
    assert.equal(metric?.evidence.scenarios[0]?.scenarioTitle, "Talking to my landlord");
  });
});
