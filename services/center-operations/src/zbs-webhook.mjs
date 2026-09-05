import {createHash,timingSafeEqual} from 'node:crypto';
export function verifyZbsWebhook({rawBody,body,signature,appId,oaId,oaSecretKey,now=Date.now()}) {
 if(typeof rawBody!=='string' || !oaSecretKey || String(body?.app_id)!==String(appId) || ![body?.sender?.id,body?.recipient?.id].some(id=>String(id)===String(oaId))) throw new Error('Invalid OA webhook');
 const timestamp=Number(body.timestamp);
 if(!Number.isFinite(timestamp) || Math.abs(now-timestamp)>86400000) throw new Error('Expired OA webhook');
 const supplied=String(signature ?? '').replace(/^mac=/,'');
 if(!/^[a-f0-9]{64}$/i.test(supplied)) throw new Error('Invalid OA signature');
 const digest=createHash('sha256').update(String(appId)+rawBody+String(body.timestamp)+oaSecretKey).digest();
 if(!timingSafeEqual(Buffer.from(supplied,'hex'),digest)) throw new Error('Invalid OA signature');
 return {eventName:String(body.event_name ?? '').slice(0,100),messageId:String(body.message?.msg_id ?? body.message?.message_id ?? '').slice(0,200),eventKey:createHash('sha256').update(rawBody).digest('hex')};
}
