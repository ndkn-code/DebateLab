# LMS material worker

Private Cloud Run service that consumes authenticated Pub/Sub push deliveries
for `lms-material-processing`. It claims the existing Supabase processing lease,
extracts normalized text, stores the preview, and marks the material version
ready. TXT, PDF, DOCX and PPTX are supported by the initial converter. Legacy
binary Office files, image OCR and audio transcription fail explicitly.

Required runtime variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service must not allow unauthenticated invocation. Pub/Sub uses a dedicated
push service account with only `roles/run.invoker` on this service.
