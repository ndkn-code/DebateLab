// Run as an authorized operator/Cloud Run Job. Credentials enter through a secret
// environment injection, are KMS-encrypted, and never appear in output or arguments.
import {createClient} from '@supabase/supabase-js';
import {createKmsVault,getMetadataAccessToken} from '../src/vault.mjs';
const required=name=>{const value=process.env[name];if(!value)throw new Error(`Missing ${name}`);return value;};
const provider=required('CENTER_PROVIDER');
if(!['zbs','zalopay'].includes(provider))throw new Error('Unsupported provider');
const secret=JSON.parse(required('CENTER_PROVIDER_SECRET_JSON')); delete process.env.CENTER_PROVIDER_SECRET_JSON;
for(const field of provider==='zalopay'?['appId','key1','key2']:['appId','secretKey','oaSecretKey','accessToken','refreshToken','expiresAt']) if(!secret[field])throw new Error(`Missing provider field ${field}`);
const db=createClient(required('SUPABASE_URL'),required('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
const clubId=required('CENTER_CLUB_ID');const actorId=required('CENTER_ACTOR_ID');
const {data:connection,error}=await db.from('center_connections').select('id').eq('club_id',clubId).eq('provider',provider).single();
if(error || !connection)throw new Error('Prepare connection in center settings first');
const vault=createKmsVault({keyName:required('CENTER_KMS_KEY_NAME'),accessToken:()=>process.env.GCP_ACCESS_TOKEN || getMetadataAccessToken()});
const encrypted=await vault.encrypt(JSON.stringify(secret),{purpose:'center-provider-tokens',connectionId:connection.id});
const status=required('CENTER_PROVIDER_STATUS');
const saved=await db.rpc('center_activate_provider',{p_club_id:clubId,p_actor_id:actorId,p_provider:provider,p_external_id:required('CENTER_PROVIDER_ACCOUNT_ID'),p_label:required('CENTER_PROVIDER_LABEL'),p_ciphertext:encrypted.ciphertext,p_key_name:encrypted.keyName,p_status:status});
if(saved.error)throw new Error('Provider activation rejected; verify center administrator and configuration');
process.stdout.write('Provider credentials stored with KMS encryption. Templates and recipient consent require separate activation.\n');
