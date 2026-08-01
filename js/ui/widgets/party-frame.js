/**
 * Party frame (variant D) — left HUD; replaces #newparty when enabled.
 */
(function (global) {
	var defineWidget = global.ALUI.defineWidget;
	var subscribe = global.ALUI.subscribe;

	var CLASS_COLORS = {
		warrior: "#f07f2f",
		paladin: "#a3b4b9",
		mage: "#3e6eed",
		priest: "#eb4d82",
		rogue: "#44b75c",
		ranger: "#8a512b",
		merchant: "#7f7f7f",
	};

	function classAbbrev(type) {
		if (!type) return "???";
		return String(type).slice(0, 3);
	}

	function findEntityByName(name) {
		if (!name) return null;
		if (global.character && global.character.name === name) return global.character;
		if (!global.entities) return null;
		for (var id in global.entities) {
			if (!Object.prototype.hasOwnProperty.call(global.entities, id)) continue;
			var e = global.entities[id];
			if (e && e.type === "character" && e.name === name) return e;
		}
		return null;
	}

	function resolveTargetEntity(entity) {
		if (!entity || entity.target == null || entity.target === "") return null;
		var me = global.character;
		if (me && (me.id == entity.target || me.name == entity.target)) return me;
		if (global.entities && global.entities[entity.target]) return global.entities[entity.target];
		if (global.entities) {
			for (var id in global.entities) {
				if (!Object.prototype.hasOwnProperty.call(global.entities, id)) continue;
				var e = global.entities[id];
				if (e && (e.id == entity.target || e.name == entity.target)) return e;
			}
		}
		return null;
	}

	function buildMemberTargetSlice(memberName) {
		var entity = findEntityByName(memberName);
		if (!entity) return null;
		var target = resolveTargetEntity(entity);
		if (!target || typeof global.ALUI.buildTargetFrame !== "function") return null;
		return global.ALUI.buildTargetFrame(target);
	}

	function buildPartyFrame() {
		var list = global.party_list || [];
		var partyMap = global.party || {};
		var me = global.character;
		var cfg = (global.ALUI.config && global.ALUI.config.get("frames.party-frame")) || {};
		var omitSelf = cfg.omitSelf !== false;
		var showMemberTarget = !!(cfg.memberTarget && cfg.memberTarget.enabled !== false);
		var members = [];
		var focusName = global.xtarget && global.xtarget.name;

		for (var i = 0; i < list.length; i++) {
			var name = list[i];
			if (omitSelf && me && name === me.name) continue;
			var info = partyMap[name] || {};
			var nearby = findEntityByName(name);
			var rip = !!(info.rip || (nearby && nearby.rip));
			var far = !nearby;
			var healthPercent = 0;
			var manaPercent = 0;
			if (nearby && nearby.max_hp) {
				healthPercent = rip ? 0 : Math.round((nearby.hp / nearby.max_hp) * 100);
				manaPercent = Math.round(((nearby.mp || 0) / (nearby.max_mp || 1)) * 100);
			} else if (rip) {
				healthPercent = 0;
			}
			var row = {
				name: name,
				level: info.level || (nearby && nearby.level) || 0,
				type: info.type || (nearby && nearby.ctype) || "",
				rip: rip,
				far: far,
				leader: i === 0,
				isFocus: !!(focusName && focusName === name),
				map: info.map || "",
				share: typeof info.share === "number" ? Math.round(info.share * 100) : null,
				healthPercent: healthPercent,
				manaPercent: manaPercent,
				canKick: !!(me && list.indexOf(me.name) < i),
				memberTarget: showMemberTarget ? buildMemberTargetSlice(name) : null,
			};
			members.push(row);
		}

		return {
			count: members.length,
			members: members,
			width: cfg.width || 200,
			showInvite: cfg.showInvite !== false,
			showLeave: cfg.showLeave !== false,
			showMemberTarget: showMemberTarget,
		};
	}

	function escapeAttr(value) {
		return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
	}

	function renderMemberTarget(slice, parentName) {
		if (!slice) return "";
		return (
			'<div class="party-lock-frames">' +
			'<div class="lock-target">' +
			'<div class="unitframe-role">' +
			escapeAttr(parentName) +
			"’s Target</div>" +
			'<div class="unitframe unitframe--compact">' +
			'<div class="unitframe-name">' +
			'<span class="unitframe-name-text">' +
			escapeAttr(slice.name || "") +
			"</span>" +
			'<span class="unitframe-level">' +
			(slice.level != null ? slice.level : "") +
			"</span>" +
			"</div>" +
			'<div class="unitframe-bar unitframe-health"><div class="unitframe-fill" style="width:' +
			(slice.healthPercent || 0) +
			'%"></div><div class="unitframe-text">' +
			(slice.healthPercent || 0) +
			"%</div></div>" +
			'<div class="unitframe-bar unitframe-mana"><div class="unitframe-fill" style="width:' +
			(slice.manaPercent || 0) +
			'%"></div><div class="unitframe-text">' +
			(slice.manaPercent || 0) +
			"%</div></div>" +
			"</div></div></div>"
		);
	}

	function renderRow(member) {
		var color = CLASS_COLORS[member.type] || "#cfcfcf";
		var classes = "party-d-row";
		if (member.rip) classes += " dead";
		if (member.far) classes += " far";
		if (member.isFocus) classes += " is-focus";
		var loc = member.far ? member.map || "far" : "nearby";
		var share = member.share != null ? member.share + "%" : "";
		var hpText = member.rip ? "RIP" : member.healthPercent + "%";
		var html =
			'<div class="party-slot' +
			(member.memberTarget ? " has-locks" : "") +
			'" data-party-name="' +
			escapeAttr(member.name) +
			'">' +
			'<div class="' +
			classes +
			'">' +
			'<div class="party-d-portrait ctype-' +
			escapeAttr(member.type || "") +
			'"><span class="cls">' +
			escapeAttr(classAbbrev(member.type)) +
			'</span><span class="skull">☠</span></div>' +
			'<div class="party-d-body">' +
			'<div class="party-d-name">' +
			'<button type="button" class="party-d-btn inspect" title="Inspect" data-act="inspect">{}</button>' +
			'<span class="name" style="color:' +
			color +
			'">' +
			escapeAttr(member.name) +
			"</span>" +
			(member.leader ? '<span class="lead" title="Party leader">★</span>' : "") +
			'<button type="button" class="party-d-btn travel" title="Travel" data-act="travel">➤</button>' +
			'<span class="lvl">Lv.' +
			(member.level || "?") +
			"</span>" +
			"</div>" +
			'<div class="unitframe-bar unitframe-health"><div class="unitframe-fill" style="width:' +
			(member.rip ? 0 : member.healthPercent) +
			'%"></div><div class="unitframe-text">' +
			hpText +
			"</div></div>" +
			'<div class="unitframe-bar unitframe-mana"><div class="unitframe-fill" style="width:' +
			(member.rip ? 0 : member.manaPercent) +
			'%"></div>' +
			(member.far || member.rip ? "" : '<div class="unitframe-text">' + member.manaPercent + "%</div>") +
			"</div>" +
			'<div class="party-d-foot"><span class="loc">' +
			escapeAttr(loc) +
			'</span><span class="share">' +
			escapeAttr(share) +
			"</span></div>" +
			"</div></div>";
		if (member.memberTarget) {
			html += '<div class="anchor-link" aria-hidden="true"></div>' + renderMemberTarget(member.memberTarget, member.name);
		}
		html += "</div>";
		return html;
	}

	function closeCtx() {
		var existing = document.querySelector(".party-ctx");
		if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
	}

	function openCtx(slot, member, event) {
		closeCtx();
		var menu = document.createElement("div");
		menu.className = "party-ctx";
		menu.innerHTML =
			'<div class="party-ctx-title">' +
			escapeAttr(member.name) +
			"</div>" +
			'<button type="button" data-act="travel">Travel <span class="hint">➤</span></button>' +
			'<button type="button" data-act="inspect">Inspect <span class="hint">{}</span></button>' +
			'<button type="button" data-act="message">Message</button>' +
			(member.canKick ? '<button type="button" class="danger" data-act="kick">Kick</button>' : "");
		menu.style.left = Math.max(8, event.offsetX || 52) + "px";
		menu.style.top = Math.max(8, event.offsetY || 28) + "px";
		slot.appendChild(menu);
		menu.addEventListener("click", function (ev) {
			var btn = ev.target.closest("button");
			if (!btn) return;
			ev.preventDefault();
			ev.stopPropagation();
			var act = btn.getAttribute("data-act");
			if (act === "travel" && typeof travel_p === "function") travel_p(member.name);
			else if (act === "inspect") {
				var ent = findEntityByName(member.name);
				if (ent && typeof ui_inspect === "function") ui_inspect(ent);
			} else if (act === "message" && typeof private_say === "function") {
				/* focus chat whisper if available */
				if (typeof add_chat === "function") add_chat("", "/w " + member.name + " ");
			} else if (act === "kick" && global.socket) {
				global.socket.emit("party", { event: "kick", name: member.name });
			}
			closeCtx();
		});
	}

	defineWidget("party-frame", function () {
		var root, unsubscribe;

		function render(slice) {
			if (!root) return;
			if (!slice || !slice.members || !slice.members.length) {
				root.style.display = "none";
				root.innerHTML = "";
				return;
			}
			root.style.display = "block";
			root.style.width = (slice.width || 200) + "px";
			var html = '<div class="party-d-header"><div class="unitframe-role">Party · ' + slice.count + '</div><div class="party-d-actions">';
			if (slice.showInvite) {
				html += '<button type="button" class="party-d-iconbtn invite" title="Invite" data-act="invite">+</button>';
			}
			if (slice.showLeave) {
				html += '<button type="button" class="party-d-iconbtn leave" title="Leave" data-act="leave">✕</button>';
			}
			html += "</div></div>";
			for (var i = 0; i < slice.members.length; i++) {
				html += renderRow(slice.members[i]);
			}
			root.innerHTML = html;
		}

		function onRootClick(event) {
			var actBtn = event.target.closest("[data-act]");
			var slot = event.target.closest(".party-slot");
			var name = slot && slot.getAttribute("data-party-name");
			if (actBtn) {
				var act = actBtn.getAttribute("data-act");
				event.preventDefault();
				event.stopPropagation();
				if (act === "invite") {
					var target = global.xtarget || global.ctarget;
					if (target && !target.me && target.type === "character" && global.socket) {
						global.socket.emit("party", { event: "invite", id: target.id });
						if (typeof push_deferred === "function") push_deferred("party");
					} else if (typeof add_chat === "function") {
						add_chat("", "Target a player to invite");
					}
					return;
				}
				if (act === "leave" && global.socket) {
					global.socket.emit("party", { event: "leave" });
					if (typeof push_deferred === "function") push_deferred("party");
					return;
				}
				if (!name) return;
				if (act === "travel" && typeof travel_p === "function") travel_p(name);
				if (act === "inspect") {
					var ent = findEntityByName(name);
					if (ent && typeof ui_inspect === "function") ui_inspect(ent);
				}
				return;
			}
			if (name && typeof party_click === "function") {
				if (typeof pcs === "function") pcs(event);
				party_click(name);
			}
		}

		function onRootContext(event) {
			var slot = event.target.closest(".party-slot");
			if (!slot || event.target.closest(".party-lock-frames")) return;
			event.preventDefault();
			var name = slot.getAttribute("data-party-name");
			var slice = buildPartyFrame();
			var member = null;
			if (slice && slice.members) {
				for (var i = 0; i < slice.members.length; i++) {
					if (slice.members[i].name === name) member = slice.members[i];
				}
			}
			if (!member) return;
			openCtx(slot, member, event);
		}

		return {
			init: function (target, initial) {
				if (!target) {
					var existing = document.querySelector('[data-widget="party-frame"]');
					if (existing) {
						root = existing;
					} else {
						root = document.createElement("div");
						root.setAttribute("data-widget", "party-frame");
						root.className = "party-d enableclicks";
						root.style.cssText = "position: fixed; top: 36px; left: 16px; z-index: 200;";
						document.body.appendChild(root);
					}
				} else {
					root = target;
				}
				render(initial || null);
				unsubscribe = subscribe("party-frame", render);
				root.addEventListener("click", onRootClick);
				root.addEventListener("contextmenu", onRootContext);
				document.addEventListener("click", closeCtx);
			},
			update: render,
			dispose: function () {
				if (unsubscribe) unsubscribe();
				if (root) {
					root.removeEventListener("click", onRootClick);
					root.removeEventListener("contextmenu", onRootContext);
					root.innerHTML = "";
				}
				document.removeEventListener("click", closeCtx);
			},
		};
	});

	function registerPartyConfig() {
		if (!global.ALUI.config) return;
		global.ALUI.config.registerDefaults({
			frames: {
				"party-frame": {
					enabled: true,
					variant: "D",
					width: 200,
					omitSelf: true,
					showInvite: true,
					showLeave: true,
					highlightFocus: true,
					memberTarget: { enabled: true, size: "compact", anchor: "row" },
				},
			},
		});
		global.ALUI.config.registerSetting({ path: "frames.party-frame.enabled", label: "Party", type: "boolean" });
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.memberTarget.enabled",
			label: "Party → member Target",
			type: "boolean",
		});
	}

	function registerPartyPublisher() {
		if (typeof global.ALUI.registerPublisher !== "function") return;
		global.ALUI.registerPublisher("party-frame", buildPartyFrame, { groups: ["frames"] });
	}

	function hookRenderParty() {
		if (typeof global.render_party !== "function") return;
		if (global.render_party._aluiPartyHooked) return;
		var original = global.render_party;
		global.render_party = function () {
			var enabled = global.ALUI && global.ALUI.config && global.ALUI.config.isEnabled("party-frame");
			if (enabled) {
				var np = document.getElementById("newparty");
				if (np) np.style.display = "none";
				if (typeof global.ALUI.publish === "function") {
					global.ALUI.publish("party-frame", buildPartyFrame());
				}
				return;
			}
			return original.apply(this, arguments);
		};
		global.render_party._aluiPartyHooked = true;
	}

	registerPartyConfig();
	registerPartyPublisher();

	global.ALUI = global.ALUI || {};
	global.ALUI.buildPartyFrame = buildPartyFrame;
	global.ALUI.onWidgetsMounted = global.ALUI.onWidgetsMounted || [];
	global.ALUI.onWidgetsMounted.push(function () {
		hookRenderParty();
		if (typeof global.render_party === "function") global.render_party();
	});
	hookRenderParty();
})(typeof window !== "undefined" ? window : global);
