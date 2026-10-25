import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
const rl=createInterface({input,output});const pass=await rl.question('Enter a NEW unique admin passphrase (minimum 14 characters): ');rl.close();
if(pass.length<14||pass==='12345678'||/^(.)\1{13,}$/.test(pass)){console.error('Password is too weak. Use a long unique passphrase.');process.exit(1)}
const salt=randomBytes(16),iterations=150000;const hash=pbkdf2Sync(pass,salt,iterations,32,'sha256');const url=b=>b.toString('base64url');console.log(`pbkdf2_sha256$${iterations}$${url(salt)}$${url(hash)}`);console.log('Copy this hash to the Cloudflare secret ADMIN_PASSWORD_HASH; never store your plain password in Git.');
