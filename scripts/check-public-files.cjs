const {execFileSync}=require('node:child_process');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:20*1024*1024});
const retired=['docs/media/single-notification.png','docs/media/multiple-notifications.png','docs/media/snail-walking.gif','docs/media/snail-walking.mp4'];
const files=git('ls-files','-z').split('\0').filter(Boolean);
const unsafe=files.filter(p=>/(^|\/)(\.env(?:\..*)?|credential\.bin|state\.json|Local State|id_rsa|id_ed25519)$|\.(pfx|p12|pem)$/i.test(p)||retired.includes(p));
if(unsafe.length){console.error('Blocked: private profile or retired media is tracked.');process.exit(1);}
if(git('rev-list','--objects','--branches','--tags','--',...retired).trim()){
 console.error('Blocked: a branch or tag contains retired media history. Do not merge an old clone.');process.exit(1);
}
console.log('Public file/history guard passed. Image contents still require visual review.');
