import { createHash, randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { createOAuthService } from './oauth.mjs';
import { createGoogleProvider } from './providers/google.mjs';
import { createZaloPayProvider } from './providers/zalopay.mjs';
import { createGoogleSync } from './google-sync.mjs';
import { getMetadataAccessToken } from './vault.mjs';
import { createCenterCalendar } from './calendar.mjs';
import { createCenterNotifications } from './notifications.mjs';
import { verifyZbsWebhook } from './zbs-webhook.mjs';
import { createZbsTokens } from './zbs-tokens.mjs';
import { createZbsProvider } from './providers/zbs.mjs';
import { createGoogleStore } from './google-store.mjs';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
async function one(query) { const { data, error } = await query; if (error) throw new Error(error.message); if (!data) throw new Error('Resource not found'); return data; }
async function many(query) { const { data, error } = await query; if (error) throw new Error(error.message); return data ?? []; }
function safeOrigin(value) { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('HTTPS origin required'); return url.origin; }

export function createRuntime({ db, vault, config, fetchFn = fetch }) {
  const appOrigin = safeOrigin(config.appOrigin);
  const callbackOrigin = safeOrigin(config.callbackOrigin);
  const rpc = async (name, args) => { const { data, error } = await db.rpc(name, args); if (error) throw new Error(error.message); return data; };
  const oauth = createOAuthService({ rpc, encrypt: vault.encrypt, decrypt: vault.decrypt, googleConfig: config.google, fetchFn });
  const authenticate = async token => {
    if (typeof token !== 'string' || !token) throw new Error('Unauthorized');
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) throw new Error('Unauthorized');
    return { id: data.user.id };
  };
  async function googleContext(clubId, actorId) {
    return rpc('center_google_connection_context', { p_club_id: clubId, p_actor_id: actorId });
  }
  async function googleFor(connectionId) {
    return createGoogleProvider({ accessToken: await oauth.getGoogleAccessToken(connectionId), fetchFn });
  }
  async function providerConnection(clubId, provider) {
    return one(db.from('center_connections').select('*').eq('club_id', clubId).eq('provider', provider).in('status', ['connected', 'sandbox']).single());
  }
  async function paymentProvider(connection) {
    const row = await rpc('center_load_credentials', { p_connection_id: connection.id });
    if (row.clubId !== connection.club_id || row.provider !== 'zalopay') throw new Error('Merchant ownership mismatch');
    const secret = JSON.parse(await vault.decrypt(row, { purpose: 'center-provider-tokens', connectionId: connection.id }));
    return createZaloPayProvider({ appId: String(secret.appId), key1: secret.key1, key2: secret.key2, environment: connection.status === 'sandbox' ? 'sandbox' : 'production', callbackUrl: `${callbackOrigin}/callbacks/zalopay/${connection.id}`, fetchFn });
  }
  const calendar = createCenterCalendar({ db, rpc, googleFor });
  const zbsToken = createZbsTokens({rpc,vault,fetchFn});
  const notifications = createCenterNotifications({db,appOrigin,loadProvider:async connectionId => createZbsProvider({accessToken:await zbsToken(connectionId),fetchFn})});
  async function enqueueSync(binding) {
    const pending = await many(db.from('center_events').select('id').eq('club_id', binding.club_id).eq('kind', 'resource.sync_requested').eq('subject_id', binding.id).in('status', ['pending', 'processing']).limit(1));
    if (!pending.length) await one(db.from('center_events').insert({ club_id: binding.club_id, kind: 'resource.sync_requested', subject_id: binding.id }).select('id').single());
  }
  async function loadBinding(event) {
    const binding = await one(db.from('center_resource_bindings').select('*').eq('id', event.subjectId).eq('club_id', event.clubId).eq('state', 'active').single());
    const connection = await one(db.from('center_connections').select('*').eq('id', binding.connection_id).eq('club_id', event.clubId).eq('provider', 'google').eq('status', 'connected').single());
    return { binding, connection };
  }
  async function syncBinding(event) {
    const { binding, connection } = await loadBinding(event);
    const provider = await googleFor(connection.id);
    const store = createGoogleStore({ db, binding, actorId: connection.connected_by });
    const sync = createGoogleSync({ provider, store });
    if (binding.kind === 'calendar') {
      await sync.syncCalendar(binding);
      await calendar.sync({binding,connection});
      const watch = binding.metadata?.watch;
      if (!watch?.expiration || Number(watch.expiration) < Date.now() + 86400000) {
        const token = randomBytes(32).toString('base64url');
        const id = randomUUID();
        const channel = await provider.watchEvents(binding.external_id, { id, token, address: `${callbackOrigin}/callbacks/google`, expiration: String(Date.now() + 604800000) });
        await many(db.from('center_resource_bindings').update({ metadata: { ...binding.metadata, watch: { id, resourceId: channel.resourceId, tokenHash: hash(token), expiration: channel.expiration } } }).eq('id', binding.id).eq('club_id', event.clubId));
      }
    } else if (binding.kind === 'sheet') await sync.syncSheet(binding);
    else if (binding.kind === 'drive_file') await sync.ingestFile(binding);
  }
  async function createCheckout(event) {
    const invoice = await one(db.from('center_invoices').select('*').eq('id', event.subjectId).eq('club_id', event.clubId).single());
    const connection = await providerConnection(event.clubId, 'zalopay');
    const provider = await paymentProvider(connection);
    const instant = new Date();
    const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: '2-digit', month: '2-digit', day: '2-digit' }).format(instant).split('/').reverse().join('');
    const suffix = randomUUID().replaceAll('-', '').slice(0, 24);
    const attempt = await rpc('center_prepare_payment', { p_invoice_id: invoice.id, p_connection_id: connection.id, p_order_id: `${date}_${suffix}` });
    const stored = await one(db.from('center_payment_attempts').select('*').eq('id', attempt.attemptId).eq('club_id', event.clubId).single());
    if (stored.checkout_url) return;
    // A previous timed-out creation may have succeeded. Query before repeating it.
    if (attempt.reused) {
      const queried = await provider.queryOrder(attempt.providerOrderId);
      if (queried.return_code === 1 && queried.zp_trans_id) {
        await rpc('center_apply_verified_payment', { p_connection_id: connection.id, p_order_id: attempt.providerOrderId, p_transaction_id: String(queried.zp_trans_id), p_amount: queried.amount });
        return;
      }
      throw new Error('Checkout creation needs reconciliation; no duplicate order was created');
    }
    const result = await provider.createOrder({ orderId: attempt.providerOrderId.slice(7), payerId: invoice.id, amount: Number(attempt.amount), returnUrl: `${appOrigin}/vi/dashboard/teacher/center?organization=${event.clubId}`, now: instant, description: 'Thinkfy center tuition' });
    if (result.return_code !== 1 || !result.order_url) {
      await many(db.from('center_payment_attempts').update({status:'failed',error_code:'provider_rejected'}).eq('id',attempt.attemptId).eq('club_id',event.clubId).eq('status','pending'));
      throw new Error('ZaloPay did not create a checkout');
    }
    await rpc('center_attach_checkout', { p_attempt_id: attempt.attemptId, p_checkout_url: result.order_url, p_expires_at: new Date(instant.getTime() + 900000).toISOString() });
  }
  async function processEvent(eventId = null) {
    const event = await rpc('center_claim_event', { p_event_id: eventId });
    if (!event) return { status: 'idle' };
    try {
      if (event.kind === 'resource.sync_requested') await syncBinding(event);
      else if (event.kind === 'invoice.checkout_requested') await createCheckout(event);
      else if(event.kind === 'material.processing_requested') {
        const version = await one(db.from('lms_material_versions').select('id,material_id,idempotency_key,lms_materials!inner(club_id)').eq('id',event.subjectId).eq('lms_materials.club_id',event.clubId).single());
        if(!config.projectId || !config.materialTopic) throw new Error('Material processing topic is not configured');
        const response=await fetchFn(`https://pubsub.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/topics/${encodeURIComponent(config.materialTopic)}:publish`,{method:'POST',headers:{authorization:`Bearer ${await getMetadataAccessToken()}`,'content-type':'application/json'},body:JSON.stringify({messages:[{data:Buffer.from(JSON.stringify({materialId:version.material_id,versionId:version.id,idempotencyKey:version.idempotency_key})).toString('base64')}]}),signal:AbortSignal.timeout(10000)});
        if(!response.ok) throw new Error('Material queue unavailable');
      }
      else if (event.kind === 'schedule.reschedule_requested') await calendar.reschedule(event);
      else if (['trial.booked','trial.cancelled'].includes(event.kind)) await calendar.trial(event);
      else if (['message.requested','trial.reminder','renewal.reminder'].includes(event.kind)) {
        const result = await notifications.deliver(event);
        if (result.status === 'deferred') {
          await many(db.from('center_events').update({status:'pending',lease_token:null,lease_until:null,attempts:Math.max(0,event.attempts-1)}).eq('id',event.id).eq('lease_token',event.leaseToken));
          return result;
        }
      }
      else {
        await rpc('center_finish_event', { p_event_id: event.id, p_lease_token: event.leaseToken, p_status: 'skipped', p_error: 'No external effect registered for this event' });
        return { status: 'skipped' };
      }
      await rpc('center_finish_event', { p_event_id: event.id, p_lease_token: event.leaseToken, p_status: 'completed' });
      return { status: 'completed' };
    } catch (error) {
      await rpc('center_finish_event', { p_event_id: event.id, p_lease_token: event.leaseToken, p_status: error.conflict ? 'skipped' : 'failed', p_error: String(error.message).slice(0, 250) });
      throw error;
    }
  }
  async function reconcile() {
    await notifications.schedule();
    const bindings = await many(db.from('center_resource_bindings').select('*').eq('state', 'active').order('last_sync_at', {ascending:true,nullsFirst:true}).limit(100));
    let failures=0;
    for (const binding of bindings) {try {await enqueueSync(binding);} catch {failures++;}}
    const attempts = await many(db.from('center_payment_attempts').select('*').eq('status', 'pending').order('updated_at',{ascending:true}).limit(100));
    let payments = 0;
    for (const attempt of attempts) {
      try {
      const connection = await one(db.from('center_connections').select('*').eq('id', attempt.connection_id).eq('club_id', attempt.club_id).single());
      if (!['sandbox', 'connected'].includes(connection.status)) continue;
      const provider = await paymentProvider(connection);
      const result = await provider.queryOrder(attempt.provider_order_id);
      if (result.return_code === 1 && result.zp_trans_id) {
        await rpc('center_apply_verified_payment', { p_connection_id: connection.id, p_order_id: attempt.provider_order_id, p_transaction_id: String(result.zp_trans_id), p_amount: result.amount });
        payments++;
      } else if (!result.is_processing && attempt.expires_at && Date.parse(attempt.expires_at) < Date.now()) {
        await many(db.from('center_payment_attempts').update({ status: 'expired' }).eq('id', attempt.id).eq('club_id', attempt.club_id).eq('status', 'pending'));
      }
      } catch { failures++; await db.from('center_payment_attempts').update({updated_at:new Date().toISOString(),error_code:'reconciliation_retry'}).eq('id',attempt.id).eq('club_id',attempt.club_id).eq('status','pending'); }
    }
    let processed = 0;
    for (let i = 0; i < 20; i++) {
      try { const result = await processEvent(); if (result.status === 'idle') break; processed++; } catch { /* The lease RPC scheduled bounded retry. */ }
    }
    return { processed, payments, bindings: bindings.length, failures };
  }
  return {
    appOrigin, authenticate, oauth, processEvent, reconcile,
    resources: {
      async list({ clubId, actorId }) {
        const context = await googleContext(clubId, actorId);
        let calendars = context.bindings.filter(b => b.kind === 'calendar').map(b => ({ id: b.external_id, summary: b.label }));
        if (context.connection?.scopes?.includes('https://www.googleapis.com/auth/calendar.calendarlist.readonly')) calendars = (await (await googleFor(context.connection.id)).listCalendars()).items?.filter(c => ['owner','writer'].includes(c.accessRole)) ?? [];
        return { calendars, bindings: context.bindings };
      },
      async sync({clubId,actorId,input}) {
        const context = await googleContext(clubId,actorId);
        const binding = context.bindings.find(b => b.id===input.bindingId && b.club_id===clubId);
        if(!binding || binding.state==='revoked') throw new Error('Resource unavailable');
        if(binding.state==='conflict') await many(db.from('center_resource_bindings').update({state:'active'}).eq('id',binding.id).eq('club_id',clubId));
        await enqueueSync(binding); return {queued:true};
      },
      async picker({ clubId, actorId }) {
        const { connection } = await googleContext(clubId, actorId);
        if (!connection.scopes.includes(DRIVE_SCOPE)) throw new Error('Reconnect Google to grant selected-file access');
        if (!config.googlePickerAppId || !config.googlePickerKey) throw new Error('Google Picker is not configured');
        return { accessToken: await oauth.getGoogleAccessToken(connection.id), appId: config.googlePickerAppId, developerKey: config.googlePickerKey };
      },
      async bind({ clubId, actorId, input }) {
        const { connection, bindings } = await googleContext(clubId, actorId);
        if (!['calendar', 'sheet', 'drive_file'].includes(input.kind) || typeof input.externalId !== 'string' || !input.label || input.label.length > 240) throw new Error('Invalid resource selection');
        if (input.classId && !uuid(input.classId)) throw new Error('Invalid class');
        if (['calendar','drive_file'].includes(input.kind) && !input.classId) throw new Error('A class is required');
        if (input.classId) await one(db.from('classes').select('id').eq('id',input.classId).eq('club_id',clubId).single());
        if (input.kind==='calendar' && bindings.some((binding)=>binding.class_id===input.classId && binding.kind==='calendar' && binding.state==='active')) throw new Error('This class already has a connected calendar');
        const provider = await googleFor(connection.id);
        let externalId = input.externalId;
        if (input.kind === 'calendar') {
          if (!input.classId) throw new Error('A class is required');
          await one(db.from('classes').select('id').eq('id', input.classId).eq('club_id', clubId).single());
          if (externalId === 'create') {
            const created = await provider.createCalendar({ summary: input.label, timeZone: 'Asia/Ho_Chi_Minh' }); externalId = created.id;
          } else await provider.listEvents(externalId, {});
        } else {
          if (!connection.scopes.includes(DRIVE_SCOPE)) throw new Error('Selected-file consent is required');
          const file = await provider.getFile(externalId);
          if (file.trashed || file.mimeType === 'application/vnd.google-apps.folder') throw new Error('Choose an accessible file');
          if (input.kind === 'sheet' && file.mimeType !== 'application/vnd.google-apps.spreadsheet') throw new Error('Choose a Google Sheet');
          if (input.kind === 'sheet' && (typeof input.range !== 'string' || input.range.length > 200 || !/^[^!]+![A-Z]+\d+:[A-Z]+\d+$/.test(input.range))) throw new Error('Choose a bounded sheet range');
        }
        return rpc('center_bind_google_resource', { p_club_id: clubId, p_actor_id: actorId, p_kind: input.kind, p_external_id: externalId, p_label: input.label, p_class_id: input.classId ?? null, p_metadata: input.kind === 'sheet' ? { range: input.range } : {} });
      },
    },
    callbacks: {
      async zalopay({ connectionId, body }) {
        const connection = await one(db.from('center_connections').select('*').eq('id', connectionId).eq('provider', 'zalopay').single());
        const provider = await paymentProvider(connection);
        let data; try { data = provider.verifyCallback(body); } catch { return { return_code: 2, return_message: 'Invalid' }; }
        await rpc('center_apply_verified_payment', { p_connection_id: connection.id, p_order_id: data.app_trans_id, p_transaction_id: String(data.zp_trans_id), p_amount: data.amount });
        return { return_code: 1, return_message: 'Success' };
      },
      async google(headers) {
        const id = headers['x-goog-channel-id']; const token = headers['x-goog-channel-token'];
        if (!uuid(id) || typeof token !== 'string') throw new Error('Invalid watch channel');
        const binding = await one(db.from('center_resource_bindings').select('*').eq('metadata->watch->>id', id).eq('state', 'active').single());
        const watch = binding.metadata.watch;
        const actual = Buffer.from(hash(token)); const expected = Buffer.from(watch.tokenHash ?? '');
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || watch.resourceId !== headers['x-goog-resource-id'] || Number(watch.expiration) < Date.now()) throw new Error('Invalid watch channel');
        await enqueueSync(binding);
      },
      async zbs({connectionId,body,rawBody,headers}) {
        const row=await rpc('center_load_credentials',{p_connection_id:connectionId});
        if(row.provider!=='zbs') throw new Error('Invalid OA connection');
        const secret=JSON.parse(await vault.decrypt(row,{purpose:'center-provider-tokens',connectionId}));
        const receipt=verifyZbsWebhook({rawBody,body,signature:headers['x-zevent-signature'],appId:secret.appId,oaId:row.externalAccountId,oaSecretKey:secret.oaSecretKey});
        const result=await db.from('center_events').insert({club_id:row.clubId,kind:'provider.zbs_receipt',subject_id:connectionId,origin:'zbs',status:'completed',payload:{...receipt,providerEventKey:receipt.eventKey}});
        if(result.error && result.error.code!=='23505') throw new Error('Could not record webhook');
        return {ok:true};
      },
    },
  };
}
