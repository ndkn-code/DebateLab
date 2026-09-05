// Real concurrent PostgreSQL sessions; the parent shell provisions a disposable DB.
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const [psql, url] = process.argv.slice(2);
if (!url?.startsWith('postgresql://localhost:55481/')) throw Error('Local harness only');
const manager='00000000-0000-0000-0000-000000000001';
const student1='00000000-0000-0000-0000-000000000002';
const student2='00000000-0000-0000-0000-000000000003';
const classId='20000000-0000-0000-0000-000000000002';
const run = (sql) => execFileSync(psql,[url,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8'}).trim();
const session = (sql) => new Promise((resolve,reject)=>{
  const child=spawn(psql,[url,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql]);
  let output='',error='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>error+=x);
  child.on('exit',code=>code===0?resolve(output.trim()):reject(Error(error)));child.on('error',reject);
});
function prepare(capacity,maxUses){
  run(`delete from public.class_join_invitation_claims; delete from public.class_join_invitations; delete from public.class_memberships where member_role='student'; update public.classes set max_students=${capacity} where id='${classId}';`);
  const result=run(`set request.jwt.claim.sub='${manager}'; select public.manage_class_join_invitation('${classId}','create')->'invitation'->>'code';`);
  assert.match(result,/^[a-f0-9]{32}$/);
  run(`update public.class_join_invitations set max_uses=${maxUses};`);return result;
}
for(const [label,capacity,maxUses,secondUser,loser] of [
  ['use limit',10,1,student2,'exhausted'],
  ['class capacity',1,100,student2,'full'],
  ['duplicate own claim',10,100,student1,'already_joined'],
]){
  const code=prepare(capacity,maxUses);
  // Force overlap: both authenticated sessions queue behind the same class lock.
  const locker=spawn(psql,[url,'-X','-qAt','-v','ON_ERROR_STOP=1']);
  let releaseReady;const ready=new Promise(r=>releaseReady=r);
  locker.stdout.on('data',chunk=>{if(chunk.toString().includes('LOCKED'))releaseReady();});
  locker.stdin.write(`begin; select id from public.classes where id='${classId}' for update; select 'LOCKED';\n`);
  await ready;
  const claim=(user)=>session(`set role authenticated; set request.jwt.claim.sub='${user}'; select public.claim_class_join_invitation('${code}')->>'status';`);
  const a=claim(student1),b=claim(secondUser);
  await new Promise(r=>setTimeout(r,100));
  locker.stdin.end('commit;\n');
  const results=await Promise.all([a,b]);
  assert.deepEqual(results.sort(),['joined',loser].sort(),label);
  assert.equal(run(`select count(*) from public.class_memberships where class_id='${classId}' and member_role='student' and status='active';`),'1');
  assert.equal(run('select use_count from public.class_join_invitations;'),'1');
  assert.equal(run('select count(*) from public.class_join_invitation_claims;'),'1');
  console.log(`${label}: ${results.join(' / ')}; one membership, use, and claim`);
}
const rotationCode=prepare(10,100);
const oldId=run(`select id from public.class_join_invitations where code='${rotationCode}';`);
const rotate=()=>session(`set role authenticated; set request.jwt.claim.sub='${manager}'; select public.manage_class_join_invitation('${classId}','replace','${oldId}')->>'status';`);
assert.deepEqual((await Promise.all([rotate(),rotate()])).sort(),['ready','stale']);
assert.equal(run('select count(*) from public.class_join_invitations where revoked_at is null;'),'1');
console.log('concurrent replacement: ready / stale; one active invitation');
