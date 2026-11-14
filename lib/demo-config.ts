// ============================================================
// Demo-hint switch.
//
// The welcome page and the login screen show demo credentials
// so you can try the app quickly. When you no longer want them
// (e.g. before a presentation or real use), add this line to
// `.env.local`:
//
//     NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false
//
// Then rebuild (`npm run build`) — `NEXT_PUBLIC_*` values are baked
// in at build time. Set it back to `true` (or remove the line) to
// show the hints again.
// ============================================================

export const SHOW_DEMO_ACCOUNTS = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== "false";
