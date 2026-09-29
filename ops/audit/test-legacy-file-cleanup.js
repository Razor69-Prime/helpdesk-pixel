const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'../..');
for(const rel of ['supabase.js','public/config.js']){
  if(fs.existsSync(path.join(root,rel))) throw new Error('Legacy runtime file masih ada: '+rel);
}
const config=fs.readFileSync(path.join(root,'config.js'),'utf8');
if(config.includes('https://supabase.com')) throw new Error('Komentar setup Supabase lama masih ada di config.js');
console.log('PASS PXL-URG-0107G');
