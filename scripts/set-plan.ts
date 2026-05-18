/**
 * Usage: npx ts-node scripts/set-plan.ts <email> <plan>
 * Example: npx ts-node scripts/set-plan.ts fidel.roman@outlook.com pro
 */
import * as admin from 'firebase-admin';

const [, , email, plan] = process.argv;

if (!email || !['free', 'pro', 'business'].includes(plan)) {
  console.error('Usage: npx ts-node scripts/set-plan.ts <email> <plan>');
  console.error('Plans: free | pro | business');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

async function run() {
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  const docRef = snap.docs[0].ref;
  await docRef.update({
    plan,
    subscriptionStatus: plan === 'free' ? null : 'active',
  });
  console.log(`✓ ${email} → plan: ${plan}`);
}

run().catch(console.error).finally(() => process.exit(0));
