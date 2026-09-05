import { createClient } from '@supabase/supabase-js';
import { createCenterServer } from './server.mjs';
import { createRuntime } from './runtime.mjs';
import { createKmsVault, getMetadataAccessToken } from './vault.mjs';

function required(name) { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; }
const db = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
const vault = createKmsVault({ keyName: required('CENTER_KMS_KEY_NAME'), accessToken: () => getMetadataAccessToken() });
const dependencies = createRuntime({ db, vault, config: {
  appOrigin: required('THINKFY_APP_ORIGIN'), callbackOrigin: required('CENTER_CALLBACK_ORIGIN'),
  google: { clientId: required('GOOGLE_CLIENT_ID'), clientSecret: required('GOOGLE_CLIENT_SECRET'), redirectUri: `${required('CENTER_CALLBACK_ORIGIN')}/oauth/google/callback` },
  projectId: process.env.GCP_PROJECT_ID, materialTopic: process.env.GCP_PUBSUB_TOPIC || "lms-material-processing",
  googlePickerAppId: process.env.GOOGLE_PICKER_APP_ID, googlePickerKey: process.env.GOOGLE_PICKER_API_KEY,
} });
const server = createCenterServer(dependencies);
server.listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
