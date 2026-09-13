import type { AnalysisResult, DemoScenario } from "@/domain/analysis";

export interface DemoScenarioDescription {
  value: DemoScenario;
  label: string;
  description: string;
}

export const DEMO_SCENARIOS: DemoScenarioDescription[] = [
  {
    value: "NO_WATER",
    label: "No water visible",
    description: "Demonstrates the early water-detection gate.",
  },
  {
    value: "UNCERTAIN",
    label: "Uncertain recording",
    description: "Demonstrates a clip that needs to be recorded again.",
  },
  {
    value: "LOW",
    label: "Low risk",
    description: "Demonstrates a small, contained water observation.",
  },
  {
    value: "MEDIUM",
    label: "Medium risk",
    description: "Demonstrates ongoing flow that warrants inspection.",
  },
  {
    value: "HIGH",
    label: "High risk",
    description:
      "Demonstrates persistent, spreading flow needing prompt attention.",
  },
];

const RESULTS: Record<DemoScenario, AnalysisResult> = {
  NO_WATER: {
    waterDetected: false,
    waterConfidence: 0.04,
    activeFlowProbability: null,
    persistentSource: null,
    spreadingDetected: null,
    leakRisk: "NO_WATER",
    explanation:
      "This demo outcome does not identify visible water, so no leak signals are inferred.",
    recommendation: "Try another angle if water is present outside the frame.",
    provider: "demo",
    scenario: "NO_WATER",
  },
  UNCERTAIN: {
    waterDetected: false,
    waterConfidence: 0.43,
    activeFlowProbability: null,
    persistentSource: null,
    spreadingDetected: null,
    leakRisk: "UNCERTAIN",
    explanation:
      "The recording is unclear or insufficient to support a water-leak assessment.",
    recommendation:
      "Record another 5–10 second video in steady light with the suspected source visible.",
    provider: "demo",
    scenario: "UNCERTAIN",
  },
  LOW: {
    waterDetected: true,
    waterConfidence: 0.88,
    activeFlowProbability: 0.24,
    persistentSource: false,
    spreadingDetected: false,
    leakRisk: "LOW",
    explanation:
      "This demo outcome represents visible water that appears contained without a persistent source.",
    recommendation:
      "Submit the observation for routine review and monitor whether the wet area grows.",
    provider: "demo",
    scenario: "LOW",
  },
  MEDIUM: {
    waterDetected: true,
    waterConfidence: 0.93,
    activeFlowProbability: 0.66,
    persistentSource: true,
    spreadingDetected: false,
    leakRisk: "MEDIUM",
    explanation:
      "This demo outcome represents likely active flow from a persistent source with limited spread.",
    recommendation:
      "Report the location for inspection and keep clear of the affected surface.",
    provider: "demo",
    scenario: "MEDIUM",
  },
  HIGH: {
    waterDetected: true,
    waterConfidence: 0.98,
    activeFlowProbability: 0.91,
    persistentSource: true,
    spreadingDetected: true,
    leakRisk: "HIGH",
    explanation:
      "This demo outcome represents persistent active flow spreading beyond the apparent source.",
    recommendation:
      "Report promptly for inspection and avoid entering flooded or undermined areas.",
    provider: "demo",
    scenario: "HIGH",
  },
};

export function createDemoResult(scenario: DemoScenario): AnalysisResult {
  return { ...RESULTS[scenario] };
}
