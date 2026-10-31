// Generates VAPID keys for web push notifications. Usage: npm run vapid
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("Add these to your environment (.env / hosting provider):\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
console.log('VAPID_SUBJECT="mailto:you@yourcompany.com"');
