import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedProjectPath, editableProjectPath, validateProjectRoot, readProjectFile, saveProjectFile } from '../src/features/admin/projectFiles.js';

function memoryRoot() {
  const files = new Map([['package.json','{"name":"ai-trade-journal"}'], ['src/main.jsx','export const start = 1;'], ['Header.jsx','original'], ['config.json','{}']]);
  let failBackup = false;
  const directory = (prefix = '') => ({
    name:'ai-trade-journal',
    async getDirectoryHandle(name) { return directory(prefix + name + '/'); },
    async getFileHandle(name, options) {
      const key = prefix + name;
      if (!files.has(key) && !options?.create) throw new Error('not found');
      return {
        async getFile() { const text = files.get(key) || ''; return { size:new Blob([text]).size,lastModified:1,text:async()=>text }; },
        async createWritable() {
          if (key.startsWith('.dayris-project-backups/') && failBackup) throw new Error('backup denied');
          let next; return {write:async text=>{next=text;},close:async()=>{files.set(key,next);},abort:async()=>{}};
        },
      };
    },
  });
  return {root:directory(),files,fail:()=>{failBackup=true;}};
}
test('project paths exclude traversal, secrets, SDK/tooling and generated edits',()=>{
  for (const path of ['../Header.jsx','/etc/passwd','C:/file','src/../file','src\\file','src//file','.env','.env.example','android/android.keystore','android/local.properties','src/secrets.json','src/credentials.json','node_modules/a.js','Git/etc/a.txt','src/.hidden/a.js','dist/a.js']) assert.equal(allowedProjectPath(path),false,path);
  assert.equal(editableProjectPath('Header.jsx'),true);
  assert.equal(editableProjectPath('package-lock.json'),false);
  assert.equal(editableProjectPath('src/features/admin/projectCatalog.generated.json'),false);
  assert.equal(editableProjectPath('public/icon.png'),false);
});
test('local file save backs up exact original, validates JSON and detects external edits',async()=>{
  const {root,files}=memoryRoot();
  await validateProjectRoot(root);
  const original=await readProjectFile(root,'Header.jsx');
  const result=await saveProjectFile(root,'Header.jsx',original,'updated');
  assert.equal(files.get(result.backup),'original'); assert.equal(files.get('Header.jsx'),'updated');
  files.set('Header.jsx','changed externally');
  await assert.rejects(saveProjectFile(root,'Header.jsx',result.snapshot,'overwrite'),/другом редакторе/);
  assert.equal(files.get('Header.jsx'),'changed externally');
  await assert.rejects(saveProjectFile(root,'config.json',await readProjectFile(root,'config.json'),'{bad'),/JSON/);
  assert.equal(files.get('config.json'),'{}');
});
test('backup failure prevents source write, size guards work and local workspace must match',async()=>{
  const {root,files,fail}=memoryRoot(); fail();
  await assert.rejects(saveProjectFile(root,'Header.jsx',await readProjectFile(root,'Header.jsx'),'overwrite'),/backup denied/);
  assert.equal(files.get('Header.jsx'),'original');
  files.set('Header.jsx','x'.repeat(1024*1024+1));
  await assert.rejects(readProjectFile(root,'Header.jsx'),/1 МБ/);
  await assert.rejects(validateProjectRoot(root,'workspace-1'),/другая копия/);
  files.set('.dayris-project-desk.json','{"workspace":"workspace-1"}');
  await validateProjectRoot(root,'workspace-1');
});
