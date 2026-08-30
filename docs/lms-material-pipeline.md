# LMS material pipeline

The material pipeline keeps teacher uploads in private storage and never returns
an object path to a browser. Uploads go through a short-lived signed URL to the
`lms-material-ingest` bucket. Finalization verifies object size and MIME type,
copies the object into `lms-material-originals`, removes the ingest object, and
enqueues conversion. Conversion writes a plain-text draft preview into
`lms-material-previews`.

The entire server and presentation surface is fail-closed behind
`SHARED_LMS_MATERIALS_V1` and `NEXT_PUBLIC_SHARED_LMS_MATERIALS_V1`.
Conversion additionally requires `VERCEL_SANDBOX_API_URL` (HTTPS)
and `VERCEL_SANDBOX_TOKEN`; the endpoint must implement `POST
/v1/material-conversions` and return `{ "text": string, "title"?: string }`.
The application sends a short-lived signed source URL, file metadata, and
opaque material/version IDs. It does not send or expose a Supabase storage path.
The deterministic fake adapter is used by local contract tests when Sandbox is
unavailable; it is not selected by production code.

The pipeline expects the LMS migration's `lms_materials`,
`lms_material_versions`, and `lms_material_renditions` tables. Version processing
uses `processing_status`, `idempotency_key`, `ingest_bucket/path`,
`original_bucket/path`, `sha256`, `detected_mime_type`, `size_bytes`,
`processing_attempts`, `lease_expires_at`, `error_code`, and `error_message`.
Renditions reference `version_id` and store `bucket_id`, `storage_path`,
`rendition_kind`, and their own processing status. A conversion emits a
`MaterialDocumentV1` teacher-review draft only; it never pins or publishes a
version.

Preview authorization is a two-step boundary: the session client calls
`can_access_lms_material_preview(placement_id, version_id, rendition_id)`, then
the service-role client resolves the rendition and returns a 120-second signed
URL. Versions/renditions are not directly selected by authenticated clients.
