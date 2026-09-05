import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyZbsWebhook} from './zbs-webhook.mjs';
test('OA verification binds raw bytes, app, OA, and timestamp',()=>{
 const body={app_id:'app',recipient:{id:'oa'},timestamp:'1700000000000',event_name:'user_send_text',message:{msg_id:'m'}};
 const rawBody=JSON.stringify(body); const signature=createHash('sha256').update('app'+rawBody+body.timestamp+'secret').digest('hex');
 const args={rawBody,body,signature,appId:'app',oaId:'oa',oaSecretKey:'secret',now:Number(body.timestamp)};
 assert.equal(verifyZbsWebhook(args).messageId,'m');
 assert.throws(()=>verifyZbsWebhook({...args,rawBody:rawBody+' '}));
 assert.throws(()=>verifyZbsWebhook({...args,oaId:'other'}));
 assert.throws(()=>verifyZbsWebhook({...args,now:args.now+86400001}));
});
