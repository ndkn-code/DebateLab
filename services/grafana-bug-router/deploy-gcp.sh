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

for binding in \
  "grafana-webhook-secret:${WEBHOOK_SA}" \
  "supabase-url:${WORKER_SA}" \
  "supabase-service-role-key:${WORKER_SA}" \
  "clickup-api-token:${WORKER_SA}" \
  "clickup-list-id:${WORKER_SA}"; do
  secret_name="${binding%%:*}"
  service_account="${binding##*:}"
  gcloud secrets add-iam-policy-binding "${secret_name}" \
    --project "${PROJECT_ID}" \
    --member "serviceAccount:${service_account}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role roles/secretmanager.secretAccessor >/dev/null
done

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
  --set-env-vars "APP_MODULE=app.ingress:app,PUBSUB_PROJECT_ID=${PROJECT_ID},PUBSUB_TOPIC=${TOPIC},WEBHOOK_MAX_CLOCK_SKEW_SECONDS=300" \
  --set-secrets "GRAFANA_WEBHOOK_SECRET=grafana-webhook-secret:latest"

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
  --set-env-vars "APP_MODULE=app.worker:app,CLICKUP_NEW_STATUS=New,CLICKUP_READY_STATUS=Ready for Agent" \
  --set-secrets "SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,CLICKUP_API_TOKEN=clickup-api-token:latest,CLICKUP_LIST_ID=clickup-list-id:latest"

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
