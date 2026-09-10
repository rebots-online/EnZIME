import {verify} from 'node:crypto';
export function purchaseLink(env=process.env){
 if(!env.REVENUECAT_PURCHASE_URL)return null;
 const u=new URL(env.REVENUECAT_PURCHASE_URL);
 if(u.protocol!=='https:'||u.hostname!=='pay.rev.cat'||u.username||u.password||u.port||u.pathname==='/'||u.hash)throw Error('Use a dashboard-generated RevenueCat hosted purchase link');
 if(env.REVENUECAT_REDEMPTION_ENABLED!=='true')throw Error('Anonymous landing checkout requires RevenueCat redemption links');
 return u.href;
}
export function verifyGrant(envelope,{publicKey,subject,now=Date.now()}){
 try {if(!envelope||typeof envelope.payload!=='string'||typeof envelope.signature!=='string')return null;
 const bytes=Buffer.from(envelope.payload,'base64url');if(!verify(null,bytes,publicKey,Buffer.from(envelope.signature,'base64url')))return null;
 const p=JSON.parse(bytes);if(p.v!==1||p.aud!=='mba.robin.enzime'||p.sub!==subject||!Number.isSafeInteger(p.exp)||p.exp*1000<=now||!Array.isArray(p.capabilities)||!p.capabilities.every(x=>typeof x==='string'))return null;return p;
 }catch{return null;}
}
