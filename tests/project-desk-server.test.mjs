import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validDeskRequest, makeDeskService } from '../scripts/project-desk-server.mjs';

test('desktop commands require loopback, matching host/origin and a per-run token',()=>{
  const request={socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:5173',origin:'http://127.0.0.1:5173','x-dayris-desk-token':'secret','sec-fetch-site':'same-origin'}};
  assert.equal(validDeskRequest(request,'secret'),true);
  for(const change of [{host:'evil.test:5173'},{origin:'https://ai-trade-journal-ejm8.onrender.com'},{'x-dayris-desk-token':'wrong'},{'sec-fetch-site':'cross-site'}]) assert.equal(validDeskRequest({...request,headers:{...request.headers,...change}},'secret'),false);
  assert.equal(validDeskRequest({...request,socket:{remoteAddress:'192.168.1.2'}},'secret'),false);
});
test('publication builds before stage and only stages reviewed files; push failure preserves commit',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'dayris-desk-test-'));
  try {
    await fs.writeFile(path.join(root,'Header.jsx'),'safe source');
    const commands=[];let staged=false,committed=false,failPush=false,hasUserStaged=false,branch='main';
    const run=async(bin,args,options)=>{
      commands.push([bin,...args]); const key=args.join(' ');
      if(bin!=='git'){if(args.includes('npm run build')||args.join(' ')==='run build')assert.equal(options.env.NODE_ENV,'production');return 'built';}
      if(key==='branch --show-current')return branch;
      if(key==='rev-parse HEAD')return committed?'new-head':'old-head';
      if(key==='remote get-url origin')return 'https://github.com/zalexei79/CalendarScreen.git';
      if(key==='diff --name-only -z --diff-filter=ACM')return 'Header.jsx\0';
      if(key==='ls-files --others --exclude-standard -z')return '';
      if(key==='diff --cached --name-only -z')return hasUserStaged?'other.jsx\0':staged?'Header.jsx\0':'';
      if(args[0]==='add'){staged=true;return '';}
      if(args[0]==='commit'){committed=true;staged=false;return 'commit';}
      if(args[0]==='push' && failPush)throw new Error('network unavailable');
      return '';
    };
    const service=makeDeskService({root,run});
    const state=await service.status();
    const input={files:['Header.jsx'],head:state.head,hashes:Object.fromEntries(state.files.map(file=>[file.path,file.hash])),message:'Update button'};
    service.start('publish',input);await service.wait();
    assert.equal(service.snapshot().state,'success');
    assert.equal(commands.findIndex(c=>c[0]!=='git')<commands.findIndex(c=>c[1]==='add'),true);
    assert.deepEqual(commands.find(c=>c[1]==='add'),['git','add','--','Header.jsx']);
    assert.deepEqual(commands.find(c=>c[1]==='push'),['git','push','origin','main']);
    committed=false;failPush=true;commands.length=0;
    service.start('publish',input);await service.wait();
    assert.equal(service.snapshot().state,'failed');assert.equal(service.snapshot().commit,'new-head');
    assert.match(service.snapshot().phase,/повторный commit/);
    committed=false;failPush=false;hasUserStaged=true;commands.length=0;
    service.start('publish',input);await service.wait();
    assert.equal(commands.some(c=>c[1]==='add'),false);
    assert.match(service.snapshot().phase,/staging/);
    hasUserStaged=false;branch='other';commands.length=0;
    service.start('publish',input);await service.wait();
    assert.equal(commands.some(c=>c[1]==='add'),false);
    branch='main';commands.length=0;
    service.start('publish',{...input,hashes:{'Header.jsx':'old hash'}});await service.wait();
    assert.equal(commands.some(c=>c[0]!=='git'),false,'stale contents fail before build');
    const failedBuild=makeDeskService({root,run:async(bin,args,options)=>{if(bin!=='git')throw new Error('build failure');return run(bin,args,options);}});
    commands.length=0;failedBuild.start('publish',input);await failedBuild.wait();
    assert.equal(failedBuild.snapshot().state,'failed');assert.equal(commands.some(c=>c[1]==='add'),false,'failed build cannot stage or push');
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
