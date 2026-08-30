# LMS material pipeline

The material pipeline keeps teacher uploads in private storage and never returns
an object path to a browser. Uploads go through a short-lived signed URL to the
`lms-material-ingest` bucket. Finalization verifies object size and MIME type,
copies the object into `lms-material-originals`, removes the ingest object, and
enqueues conversion. Conversion writes a plain-text draft preview into
`lms-material-previews`.

This first converter is a text-extraction MVP. PPTX and PDF files do not yet
retain slide/page layout, images, tables, or animations. The teacher must
explicitly approve each converted version before it can be published. A
future visual-fidelity converter should emit sanitized page-image/PDF
renditions without changing the learner authorization boundary.

The entire server and presentation surface is fail-closed behind
`SHARED_LMS_MATERIALS_V1` and `NEXT_PUBLIC_SHARED_LMS_MATERIALS_V1`.
Conversion runs in the private `services/lms-material-worker` Cloud Run service.
Vercel publishes opaque material/version IDs to Pub/Sub using short-lived OIDC
credentials; no Google service-account key is stored in Vercel. The worker uses
the Supabase service role to claim a lease, creates its own short-lived source
URL, and extracts text from TXT, PDF, DOCX, or PPTX. Legacy binary Office files,
image OCR, and audio transcription are rejected explicitly until dedicated
converters are added.

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
