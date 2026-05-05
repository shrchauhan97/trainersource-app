import { loadTrainerOnboardingState } from '../_lib/state';
import { TrainingScreen } from './TrainingScreen';

// Step 2 — Training. Loads server state then hands off to the client wrapper
// so the SubTabs (Videos / Quiz) can manage local UI state.
export default async function OnboardingTrainingPage() {
  const state = await loadTrainerOnboardingState();
  return <TrainingScreen state={state} />;
}
