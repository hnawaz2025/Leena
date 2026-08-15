import type {
  ChecklistItemDTO,
  CoverageEvidenceDTO,
  MetricBand,
  MetricDTO,
} from "@leena/shared";

// Of the conversations the user's actually preparing for, how many are they
// ready for? Not "what fraction of every checklist item have you ever
// completed" -- nobody needs to clear every item, they might not have time,
// or what they've already practised might be enough for the real thing. The
// checklist is still useful as "here's what else you could work on," but the
// headline number shouldn't imply completion is the goal.
//
// Windowed by scenario, not by session, unlike Independence and Recovery.
// Those measure something that varies conversation to conversation, so they
// window by session. This measures readiness for a specific upcoming
// conversation, so three attempts at the same doctor's appointment is one
// thing to be ready for, not three -- the caller windows to the 5 most
// recently active scenarios before this ever sees them.

export interface ScenarioForCoverage {
  id: string;
  title: string;
  checklist: ChecklistItemDTO[];
  // Union of coveredIndices across every completed attempt at this scenario.
  coveredIndices: number[];
}

const BAND_LOW = 40;
const BAND_HIGH = 75;

const BAND_LABELS: Record<MetricBand, string> = {
  low: "just started",
  mid: "partly ready",
  high: "ready",
};

const MAX_REMAINING_PER_SCENARIO = 3;

function bandFor(value: number): MetricBand {
  if (value < BAND_LOW) return "low";
  if (value < BAND_HIGH) return "mid";
  return "high";
}

function ratioOf(scenario: ScenarioForCoverage): number {
  if (scenario.checklist.length === 0) return 0;
  return Math.round((scenario.coveredIndices.length / scenario.checklist.length) * 100);
}

// A scenario counts as something you're prepared for once it crosses the same
// "ready" threshold used to label it -- one number, two uses, rather than a
// separate readiness cutoff to keep in sync.
function isReady(scenario: ScenarioForCoverage): boolean {
  return ratioOf(scenario) >= BAND_HIGH;
}

export function computeCoverageValue(scenarios: ScenarioForCoverage[]): number | null {
  if (scenarios.length === 0) return null;
  const readyCount = scenarios.filter(isReady).length;
  return Math.round((readyCount / scenarios.length) * 100);
}

function computeEvidence(scenarios: ScenarioForCoverage[]): CoverageEvidenceDTO {
  return {
    scenarios: scenarios.map((scenario) => {
      const covered = scenario.coveredIndices.length;
      const total = scenario.checklist.length;
      const band = bandFor(ratioOf(scenario));
      const coveredSet = new Set(scenario.coveredIndices);
      const remaining = scenario.checklist
        .map((item, index) => ({ item, index }))
        .filter(({ index }) => !coveredSet.has(index))
        .slice(0, MAX_REMAINING_PER_SCENARIO)
        .map(({ item }) => item.en);

      return {
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        covered,
        total,
        band,
        bandLabel: BAND_LABELS[band],
        remaining,
      };
    }),
  };
}

// The headline is a count, not a single conversation's state, so it needs its
// own wording rather than borrowing BAND_LABELS -- those describe how ready
// ONE scenario is ("just started" / "partly ready" / "ready"), and applying
// that same word to the aggregate is actively misleading: 1 of 4 scenarios
// ready is 25%, and labelling a 25% figure "just started" implies nothing is
// ready yet when something already is.
function headlineLabel(readyCount: number, total: number): string {
  if (readyCount === 0) return "not ready yet";
  if (readyCount === total) return total === 1 ? "ready" : `ready for all ${total}`;
  return `${readyCount} of ${total} ready`;
}

export function computeCoverage(
  current: ScenarioForCoverage[],
  previous: ScenarioForCoverage[]
): MetricDTO<CoverageEvidenceDTO> | null {
  if (current.length === 0) return null;

  const readyCount = current.filter(isReady).length;
  const value = Math.round((readyCount / current.length) * 100);

  return {
    value,
    band: bandFor(value),
    bandLabel: headlineLabel(readyCount, current.length),
    previous: computeCoverageValue(previous),
    evidence: computeEvidence(current),
  };
}
