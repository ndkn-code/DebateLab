#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-thinkfy-debatelab-prod}"
REGION="${REGION:-asia-southeast1}"
AR_REPOSITORY="${AR_REPOSITORY:-thinkfy-services}"
WEBHOOK_SERVICE="grafana-bug-webhook"
WORKER_SERVICE="grafana-clickup-worker"
TOPIC="grafana-bug-events"
DLQ_TOPIC="grafana-bug-events-dead-letter"
DLQ_SUBSCRIPTION="grafana-bug-events-dead-letter-inspect"
SUBSCRIPTION="grafana-bug-events-clickup"
WEBHOOK_SA="grafana-webhook"
WORKER_SA="grafana-clickup-worker"
PUSH_SA="grafana-pubsub-push"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPOSITORY}/grafana-bug-router"

required_secrets=(grafana-webhook-secret supabase-url supabase-service-role-key clickup-api-token clickup-list-id)
for secret_name in "${required_secrets[@]}"; do
  gcloud secrets describe "${secret_name}" --project "${PROJECT_ID}" >/dev/null || {
    echo "Missing Secret Manager secret: ${secret_name}" >&2
    exit 1
  }
done

otlp_enabled=false
if [[ -n "${GRAFANA_OTLP_TRACES_ENDPOINT:-}" ]]; then
  case "${GRAFANA_OTLP_TRACES_ENDPOINT}" in
    https://*/v1/traces) ;;
    *)
      echo "GRAFANA_OTLP_TRACES_ENDPOINT must be an HTTPS URL ending in /v1/traces" >&2
      exit 1
      ;;
  esac
  gcloud secrets describe "grafana-otlp-auth-header" --project "${PROJECT_ID}" >/dev/null || {
    echo "Missing Secret Manager secret: grafana-otlp-auth-header (required when OTLP is enabled)" >&2
    exit 1
  }
  otlp_enabled=true
fi

gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  --project "${PROJECT_ID}"

gcloud artifacts repositories describe "${AR_REPOSITORY}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "${AR_REPOSITORY}" --repository-format docker --location "${REGION}" --project "${PROJECT_ID}"

for sa_name in "${WEBHOOK_SA}" "${WORKER_SA}" "${PUSH_SA}"; do
  gcloud iam service-accounts describe "${sa_name}@${PROJECT_ID}.iam.gserviceaccount.com" --project "${PROJECT_ID}" >/dev/null 2>&1 || \
    gcloud iam service-accounts create "${sa_name}" --project "${PROJECT_ID}" --display-name "${sa_name}"
done

gcloud pubsub topics describe "${TOPIC}" --project "${PROJECT_ID}" >/dev/null 2>&1 || \
  gcloud pubsub topics create "${TOPIC}" --project "${PROJECT_ID}"
gcloud pubsub topics describe "${DLQ_TOPIC}" --project "${PROJECT_ID}" >/dev/null 2>&1 || \
  gcloud pubsub topics create "${DLQ_TOPIC}" --project "${PROJECT_ID}"
gcloud pubsub subscriptions describe "${DLQ_SUBSCRIPTION}" --project "${PROJECT_ID}" >/dev/null 2>&1 || \
  gcloud pubsub subscriptions create "${DLQ_SUBSCRIPTION}" \
    --project "${PROJECT_ID}" --topic "${DLQ_TOPIC}" --message-retention-duration 7d

gcloud pubsub topics add-iam-policy-binding "${TOPIC}" \
  --project "${PROJECT_ID}" \
  --member "serviceAccount:${WEBHOOK_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role roles/pubsub.publisher >/dev/null

secret_bindings=("grafana-webhook-secret:${WEBHOOK_SA}" \
  "supabase-url:${WORKER_SA}" \
  "supabase-service-role-key:${WORKER_SA}" \
  "clickup-api-token:${WORKER_SA}" \
  "clickup-list-id:${WORKER_SA}")
if [[ "${otlp_enabled}" == true ]]; then
  secret_bindings+=("grafana-otlp-auth-header:${WEBHOOK_SA}" "grafana-otlp-auth-header:${WORKER_SA}")
fi
for binding in "${secret_bindings[@]}"; do
  secret_name="${binding%%:*}"
  service_account="${binding##*:}"
  gcloud secrets add-iam-policy-binding "${secret_name}" \
    --project "${PROJECT_ID}" \
    --member "serviceAccount:${service_account}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role roles/secretmanager.secretAccessor >/dev/null
done

webhook_env_vars="APP_MODULE=app.ingress:app,PUBSUB_PROJECT_ID=${PROJECT_ID},PUBSUB_TOPIC=${TOPIC},WEBHOOK_MAX_CLOCK_SKEW_SECONDS=300"
webhook_secret_refs="GRAFANA_WEBHOOK_SECRET=grafana-webhook-secret:latest"
worker_env_vars="APP_MODULE=app.worker:app,CLICKUP_NEW_STATUS=New,CLICKUP_READY_STATUS=Ready for Agent"
worker_secret_refs="SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,CLICKUP_API_TOKEN=clickup-api-token:latest,CLICKUP_LIST_ID=clickup-list-id:latest"
if [[ "${otlp_enabled}" == true ]]; then
  webhook_env_vars+=",GRAFANA_OTLP_TRACES_ENDPOINT=${GRAFANA_OTLP_TRACES_ENDPOINT}"
  webhook_secret_refs+=",GRAFANA_OTLP_AUTH_HEADER=grafana-otlp-auth-header:latest"
  worker_env_vars+=",GRAFANA_OTLP_TRACES_ENDPOINT=${GRAFANA_OTLP_TRACES_ENDPOINT}"
  worker_secret_refs+=",GRAFANA_OTLP_AUTH_HEADER=grafana-otlp-auth-header:latest"
else
  echo "Grafana OTLP export disabled; deploying router without trace export credentials."
fi

gcloud builds submit --project "${PROJECT_ID}" --tag "${IMAGE}" .

gcloud run deploy "${WEBHOOK_SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --service-account "${WEBHOOK_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --allow-unauthenticated \
  --max-instances 2 \
  --min-instances 0 \
  --memory 256Mi \
  --cpu 1 \
  --concurrency 20 \
  --timeout 30s \
  --set-env-vars "${webhook_env_vars}" \
  --set-secrets "${webhook_secret_refs}"

gcloud run deploy "${WORKER_SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --service-account "${WORKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --no-allow-unauthenticated \
  --max-instances 2 \
  --min-instances 0 \
  --memory 256Mi \
  --cpu 1 \
  --concurrency 10 \
  --timeout 60s \
  --set-env-vars "${worker_env_vars}" \
  --set-secrets "${worker_secret_refs}"

gcloud run services add-iam-policy-binding "${WORKER_SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --member "serviceAccount:${PUSH_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role roles/run.invoker >/dev/null

worker_url="$(gcloud run services describe "${WORKER_SERVICE}" --project "${PROJECT_ID}" --region "${REGION}" --format 'value(status.url)')"
project_number="$(gcloud projects describe "${PROJECT_ID}" --format 'value(projectNumber)')"
pubsub_agent="service-${project_number}@gcp-sa-pubsub.iam.gserviceaccount.com"

gcloud iam service-accounts add-iam-policy-binding "${PUSH_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project "${PROJECT_ID}" \
  --member "serviceAccount:${pubsub_agent}" \
  --role roles/iam.serviceAccountTokenCreator >/dev/null

gcloud pubsub topics add-iam-policy-binding "${DLQ_TOPIC}" \
  --project "${PROJECT_ID}" --member "serviceAccount:${pubsub_agent}" --role roles/pubsub.publisher >/dev/null

if gcloud pubsub subscriptions describe "${SUBSCRIPTION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud pubsub subscriptions update "${SUBSCRIPTION}" \
    --project "${PROJECT_ID}" \
    --push-endpoint "${worker_url}/pubsub/grafana-bug-events" \
    --push-auth-service-account "${PUSH_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --dead-letter-topic "${DLQ_TOPIC}" \
    --max-delivery-attempts 10 \
    --ack-deadline 90 \
    --min-retry-delay 120s \
    --max-retry-delay 600s
else
  gcloud pubsub subscriptions create "${SUBSCRIPTION}" \
    --project "${PROJECT_ID}" \
    --topic "${TOPIC}" \
    --push-endpoint "${worker_url}/pubsub/grafana-bug-events" \
    --push-auth-service-account "${PUSH_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --dead-letter-topic "${DLQ_TOPIC}" \
    --max-delivery-attempts 10 \
    --ack-deadline 90 \
    --min-retry-delay 120s \
    --max-retry-delay 600s
fi

gcloud pubsub subscriptions add-iam-policy-binding "${SUBSCRIPTION}" \
  --project "${PROJECT_ID}" --member "serviceAccount:${pubsub_agent}" --role roles/pubsub.subscriber >/dev/null

webhook_url="$(gcloud run services describe "${WEBHOOK_SERVICE}" --project "${PROJECT_ID}" --region "${REGION}" --format 'value(status.url)')"
echo "Grafana webhook URL: ${webhook_url}/webhooks/grafana"
echo "Configure HMAC timestamp header: X-Grafana-Alerting-Signature-Timestamp"
