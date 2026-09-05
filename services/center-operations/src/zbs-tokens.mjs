// OA v4 refresh tokens are single-use. A durable lease serializes refreshes across instances.
export function createZbsTokens({rpc,vault,fetchFn=fetch,now=Date.now}) {
 return async function accessToken(connectionId) {
  const row=await rpc('center_load_credentials',{p_connection_id:connectionId});
  if(row.provider!=='zbs' || row.status!=='connected') throw new Error('OA is not connected');
  const context={purpose:'center-provider-tokens',connectionId};
  const secret=JSON.parse(await vault.decrypt(row,context));
  if(Number(secret.expiresAt)>now()+300000) return secret.accessToken;
  const lease=await rpc('center_claim_token_refresh',{p_connection_id:connectionId,p_expected_updated_at:row.updatedAt});
  if(!lease) throw new Error('OA token refresh pending; retry shortly');
  try {
   const response=await fetchFn('https://oauth.zaloapp.com/v4/oa/access_token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',secret_key:secret.secretKey},body:new URLSearchParams({app_id:secret.appId,refresh_token:secret.refreshToken,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});
   const body=await response.json();
   if(!response.ok || !body.access_token || !body.refresh_token) throw new Error('OA refresh rejected');
   const encrypted=await vault.encrypt(JSON.stringify({...secret,accessToken:body.access_token,refreshToken:body.refresh_token,expiresAt:now()+Number(body.expires_in || 90000)*1000}),context);
   await rpc('center_finish_token_refresh',{p_connection_id:connectionId,p_token:lease,p_ciphertext:encrypted.ciphertext,p_key_name:encrypted.keyName});
   return body.access_token;
  } catch {
   await rpc('center_mark_reconnect',{p_connection_id:connectionId});
   throw new Error('Reconnect Zalo OA; the token refresh could not be confirmed');
  }
 };
}
