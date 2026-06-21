import { loadPredictionQualityScenarios } from "@/lib/api/ielts/prediction-quality-repository";
import { buildPredictionQualityView } from "@/lib/ielts/prediction-quality/aggregate";
import { PredictionQualityDashboard } from "@/components/admin/ielts/prediction-quality/PredictionQualityDashboard";

export const metadata = { title: "Admin — Prediction Quality" };

// Cross-learner, service-role aggregation — always read fresh, never prerender.
export const dynamic = "force-dynamic";

export default async function PredictionQualityPage() {
  const { scenarios, scenariosConsidered, unavailable } =
    await loadPredictionQualityScenarios();
  const view = buildPredictionQualityView({ scenarios, scenariosConsidered });

  return <PredictionQualityDashboard view={view} unavailable={unavailable} />;
}
