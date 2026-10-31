// Live security + feature test against the real Supabase project, using throwaway accounts.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const U='https://rwodweszrlvjgxgtpvxz.supabase.co', K='sb_publishable_QWCFBPRNjno3sVLe37CuSg_eDXZsJvZ';
const run=Math.random().toString(36).slice(2,7);
const mail=n=>`tallytest-${n}-${run}@example.com`;
const results=[];const check=(n,c)=>results.push([n,!!c]);
async function user(n,signup=true){const c=createClient(U,K,{auth:{persistSession:false}});
  if(signup){const {error}=await c.auth.signUp({email:mail(n),password:'Test-'+run+'-pw!',options:{data:{display_name:n}}});if(error)throw new Error(n+': '+error.message)}
  return c}
const uid=async c=>(await c.auth.getUser()).data.user.id;
const alice=await user('alice'), carol=await user('carol'), dave=await user('dave');
const A=await uid(alice),C=await uid(carol),D=await uid(dave);
check('profile created on sign-up',(await alice.from('profiles').select('*').eq('id',A)).data?.[0]?.display_name==='alice');
// invites
check('alice invites bob (new)',!(await alice.from('invites').insert({inviter_id:A,email:mail('bob')})).error);
check('alice invites carol (existing)',!(await alice.from('invites').insert({inviter_id:A,email:mail('carol')})).error);
check('cannot invite as someone else',!!(await dave.from('invites').insert({inviter_id:A,email:'x@example.com'})).error);
const bob=await user('bob');const B=await uid(bob);
check('bob auto-friended on sign-up',(await bob.from('friendships').select('*')).data.length===1);
const ci=(await carol.from('invites').select('*')).data;
check('carol sees her invite',ci.length===1);
check('carol sees inviter name',(await carol.from('profiles').select('display_name').eq('id',A)).data?.[0]?.display_name==='alice');
check('carol accepts',!(await carol.rpc('respond_to_invite',{invite_id:ci[0].id,accept:true})).error);
// private docs
check('alice saves diary',!(await alice.from('user_docs').upsert({user_id:A,key:'d-2026-10-31',data:{foods:[{name:'Banana'}]}})).error);
check('bob cannot read alice diary',(await bob.from('user_docs').select('*')).data.length===0);
check('dave cannot write into alice docs',!!(await dave.from('user_docs').insert({user_id:A,key:'x',data:{}})).error);
// achievements + stats
const ach=(await alice.from('achievements').insert({user_id:A,kind:'pr',title:'Bench PR'}).select().single()).data;
await alice.from('achievements').insert({user_id:A,kind:'custom',title:'private',visibility:'private'});
await alice.from('shared_stats').upsert({user_id:A,stats:{workouts_week:3}});
check('bob sees friends achievement only',(await bob.from('achievements').select('*')).data.length===1);
check('bob reacts',!(await bob.from('reactions').insert({achievement_id:ach.id,user_id:B,emoji:'🔥'})).error);
check('bob sees stats',(await bob.from('shared_stats').select('*')).data.length===1);
check('dave sees no achievements',(await dave.from('achievements').select('*')).data.length===0);
check('dave cannot react',!!(await dave.from('reactions').insert({achievement_id:ach.id,user_id:D,emoji:'🔥'})).error);
check('dave sees only own profile',(await dave.from('profiles').select('*')).data.length===1);
// chat
const c1=(await alice.rpc('start_conversation',{member_ids:[B],group_title:null})).data;
check('alice starts chat with bob',!!c1);
check('alice sends message',!(await alice.from('messages').insert({conversation_id:c1,sender_id:A,body:'Nice PR?'})).error);
// realtime: bob listens, alice sends
let got=null;await bob.realtime.setAuth((await bob.auth.getSession()).data.session.access_token);
const ch=bob.channel('t').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},p=>{got=p.new}).subscribe();
await new Promise(r=>setTimeout(r,2500));
await alice.from('messages').insert({conversation_id:c1,sender_id:A,body:'realtime ping'});
for(let i=0;i<20&&!got;i++)await new Promise(r=>setTimeout(r,300));
check('bob gets message in real time',got&&got.body==='realtime ping');
bob.removeChannel(ch);
check('bob reads chat',(await bob.from('messages').select('*')).data.length===2);
check('carol cannot read 1:1',(await carol.from('messages').select('*')).data.length===0);
check('dave cannot start chat with alice',!!(await dave.rpc('start_conversation',{member_ids:[A],group_title:null})).error);
const g=(await alice.rpc('start_conversation',{member_ids:[B,C],group_title:'Gym crew'})).data;
check('carol posts in group',!(await carol.from('messages').insert({conversation_id:g,sender_id:C,body:'hey crew'})).error);
check('bob sees carol name via group',(await bob.from('profiles').select('*').eq('id',C)).data.length===1);
// challenges
const cid=(await alice.rpc('create_challenge',{t:'November',m:'workouts',s:'2026-11-01',e:'2026-11-30',invitees:[B]})).data;
check('challenge created',!!cid);
check('bob joins + scores',!(await bob.from('challenge_participants').update({status:'joined',score:4}).eq('challenge_id',cid).eq('user_id',B)).error);
await bob.from('challenge_participants').update({score:999}).eq('challenge_id',cid).eq('user_id',A);
check('bob cannot change alice score',(await alice.from('challenge_participants').select('score').eq('challenge_id',cid).eq('user_id',A)).data[0].score==0);
check('dave cannot see challenge',(await dave.from('challenges').select('*')).data.length===0);
// unfriend
await bob.from('friendships').delete().or(`user_a.eq.${B},user_b.eq.${B}`);
check('after unfriend bob loses feed',(await bob.from('achievements').select('*')).data.length===0);
for(const [n,ok] of results)console.log(ok?'PASS':'FAIL',n);
console.log('failures',results.filter(r=>!r[1]).length);
fs.writeFileSync('/tmp/live_users.json',JSON.stringify({run,emails:['alice','bob','carol','dave'].map(mail),password:'Test-'+run+'-pw!'}));
process.exit(0);
