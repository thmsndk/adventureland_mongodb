/**
 * Promote a user to admin by email marker.
 * Shared by scripts/make_admin.js and ADMIN_EMAIL startup bootstrap.
 *
 * @param {import("mongodb").Db} db
 * @param {string} email
 * @returns {Promise<{ ok: boolean, owner?: string, matchedCount?: number, modifiedCount?: number, reason?: string }>}
 */
async function promote_admin_by_email(db, email) {
	if (!email || typeof email !== "string") {
		return { ok: false, reason: "missing_email" };
	}
	const marker = await db.collection("mark").findOne({ type: "email", phrase: email });
	if (!marker || !marker.owner) {
		return { ok: false, reason: "no_user", email };
	}
	const r = await db.collection("user").updateOne({ _id: marker.owner }, { $set: { admin: true, updated: new Date() } });
	return {
		ok: true,
		owner: marker.owner,
		matchedCount: r.matchedCount,
		modifiedCount: r.modifiedCount,
	};
}

module.exports = { promote_admin_by_email };
