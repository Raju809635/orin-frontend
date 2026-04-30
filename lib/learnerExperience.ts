export type LearnerStage = "kid" | "highschool" | "after12";

export function normalizeLearnerStage(value: unknown): LearnerStage {
  const stage = String(value || "").trim().toLowerCase();
  if (stage === "kid" || stage === "highschool" || stage === "after12") {
    return stage;
  }
  return "after12";
}

export function isKidStage(stage: LearnerStage) {
  return stage === "kid";
}

export function isSchoolStage(stage: LearnerStage) {
  return stage === "kid" || stage === "highschool";
}

export function learnerStageLabel(stage: LearnerStage) {
  switch (stage) {
    case "kid":
      return "Kids";
    case "highschool":
      return "High School";
    default:
      return "After 12";
  }
}
