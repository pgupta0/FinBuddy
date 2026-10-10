import { learnerProfileSchema, LEARNER_RETENTION_MS, type LearnerProfile } from "./learner-profile";
const PREFIX = "finbuddy-learning-";
export function loadLearnerProfile(id: string): LearnerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + id);
    if (!raw) return null;
    const parsed = learnerProfileSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || !parsed.data.rememberOnDevice || Date.now() - Date.parse(parsed.data.updatedAt) >= LEARNER_RETENTION_MS || Date.parse(parsed.data.updatedAt) > Date.now() + 60000) {
      localStorage.removeItem(PREFIX + id); return null;
    }
    return parsed.data;
  } catch { return null; }
}
export function saveLearnerProfile(id: string, profile: LearnerProfile): boolean {
  if (typeof window === "undefined") return false;
  try {
    const valid = learnerProfileSchema.parse(profile);
    if (valid.rememberOnDevice) localStorage.setItem(PREFIX + id, JSON.stringify(valid));
    else localStorage.removeItem(PREFIX + id);
    return true;
  } catch { return false; }
}
export function deleteLearnerProfile(id: string): void {
  try { if (typeof window !== "undefined") localStorage.removeItem(PREFIX + id); } catch { /* Storage may be disabled. */ }
}
