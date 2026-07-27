#!/usr/bin/env node
/**
 * Operator checklist for Community soft open (Phase C4 / G1).
 * Run before inviting players: node scripts/soft_open_checklist.js
 */
var steps = [
	"Email hello@adventure.land (LICENSE notification) if not done yet",
	"Replace community-prod secrets (SERVER_MASTER, SDK password, etc.) — not docker defaults",
	"Set COMMUNITY_OPERATOR_EMAIL in prod options / .env",
	"Deploy: docker compose -f docker-compose.community.prod.yml up -d --build",
	"TLS on play.* and gs.*; COMMUNITY_GS_PUBLIC matches what browsers use",
	"Run: node scripts/smoke_community_prod.js https://play.your.domain",
	"Create admin: docker compose -f docker-compose.community.prod.yml exec backend node scripts/make_admin.js you@example.com",
	"Invite small group (3–5); share /community blurb link",
	"Watch 3–7 days: mail cross-league, PM cross-league, bank lock, claim tabs, PTR isolation",
	"Record pain in plan → Phase D notes before starting seasons",
];

console.log("Community soft open checklist (C4 / G1)\n");
for (var i = 0; i < steps.length; i++) {
	console.log(String(i + 1) + ". " + steps[i]);
}
console.log("\nSmoke: node scripts/smoke_community_prod.js <baseUrl>");
