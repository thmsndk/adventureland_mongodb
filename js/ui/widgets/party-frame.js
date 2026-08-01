/**
 * Party frame (variant D) — extends shared unit-frame core (chrome:false).
 * One outer bevel per row; ToT sidecar keeps a standalone compact unitframe.
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

	function entityToUnitSlice(entity) {
		if (!entity) return null;
		if (entity === global.character && typeof global.ALUI.buildPlayerFrame === "function") {
			return global.ALUI.buildPlayerFrame(entity);
		}
		if (typeof global.ALUI.buildTargetFrame === "function") {
			return global.ALUI.buildTargetFrame(entity);
		}
		return null;
	}

	function buildMemberTargetSlice(memberName) {
		var entity = findEntityByName(memberName);
		if (!entity) return null;
		var target = resolveTargetEntity(entity);
		var slice = entityToUnitSlice(target);
		if (!slice || !slice.name) return null;
		return slice;
	}

	/**
	 * Party row vitals come from the same builders as player/target frames.
	 * Far members have no client vitals — mark vitalsUnknown instead of fake 0%.
	 */
	function buildMemberUnitSlice(name, info, nearby) {
		var rip = !!(info.rip || (nearby && nearby.rip));
		if (nearby) {
			var slice = entityToUnitSlice(nearby);
			if (slice) {
				slice.far = false;
				slice.vitalsUnknown = false;
				if (rip) {
					slice.dead = true;
					slice.healthPercent = 0;
					slice.hp = 0;
				}
				return slice;
			}
		}
		return {
			name: name,
			level: info.level || 0,
			dead: rip,
			far: true,
			vitalsUnknown: !rip,
			skin: info.skin || "",
			cx: info.cx || {},
			healthPercent: 0,
			manaPercent: 0,
			hp: 0,
			maxHp: 0,
			mp: 0,
			maxMp: 0,
			effects: [],
			effectsKey: "",
		};
	}

	function memberTargetSig(mt) {
		if (!mt || !mt.name) return "";
		return [mt.id, mt.name, mt.level, mt.healthPercent, mt.manaPercent, mt.dead ? 1 : 0, mt.vitalsUnknown ? 1 : 0].join(":");
	}

	function portraitKey(member) {
		if (typeof global.ALUI.unitFrameAvatarKey === "function") return global.ALUI.unitFrameAvatarKey(member);
		var cx = "";
		try {
			cx = JSON.stringify(member.cx || {});
		} catch (e) {
			cx = "";
		}
		return [member.skin || "", member.rip ? 1 : 0, cx].join("|");
	}

	function renderPortraitInner(member) {
		if (typeof global.ALUI.renderUnitAvatarHtml === "function") {
			return global.ALUI.renderUnitAvatarHtml({ skin: member.skin, cx: member.cx, dead: member.rip, rip: member.rip, type: member.type }, { compact: true, fallbackClass: true });
		}
		if (member.rip) return '<span class="skull">☠</span>';
		return '<span class="cls">' + escapeAttr(classAbbrev(member.type)) + "</span>";
	}

	function fillPortrait(portrait, member) {
		if (!portrait) return;
		if (typeof global.ALUI.applyUnitAvatar === "function") {
			global.ALUI.applyUnitAvatar(
				portrait,
				{
					skin: member.skin,
					cx: member.cx,
					dead: !!member.rip,
					rip: !!member.rip,
					type: member.type,
					entityType: "character",
				},
				{ compact: true, fallbackClass: true },
			);
			return;
		}
		var key = portraitKey(member);
		if (portrait.getAttribute("data-portrait-key") === key) return;
		portrait.setAttribute("data-portrait-key", key);
		var avatar = portrait.querySelector(".party-d-avatar");
		if (!avatar) return;
		avatar.innerHTML = renderPortraitInner(member);
	}

	function partyFrameSignature(payload) {
		if (!payload) return "\0";
		if (!payload.inParty) return "\0";
		var parts = [
			payload.inParty ? 1 : 0,
			payload.partySize,
			payload.count,
			payload.width,
			payload.omitSelf ? 1 : 0,
			payload.showInvite ? 1 : 0,
			payload.showLeave ? 1 : 0,
			payload.showMemberTarget ? 1 : 0,
			payload.highlightFocus ? 1 : 0,
		];
		var members = payload.members || [];
		for (var i = 0; i < members.length; i++) {
			var m = members[i];
			var u = m.unit || {};
			parts.push(
				[
					m.name,
					m.level,
					m.type,
					m.rip ? 1 : 0,
					m.far ? 1 : 0,
					m.leader ? 1 : 0,
					m.isFocus ? 1 : 0,
					m.map,
					m.share,
					portraitKey(m),
					u.healthPercent,
					u.manaPercent,
					u.hp,
					u.mp,
					u.vitalsUnknown ? 1 : 0,
					u.effectsKey || "",
					memberTargetSig(m.memberTarget),
				].join("\x1e"),
			);
		}
		return parts.join("\x1f");
	}

	function rosterKey(members) {
		var names = [];
		for (var i = 0; i < (members || []).length; i++) names.push(members[i].name);
		return names.join("\x1f");
	}

	function buildPartyFrame() {
		var list = global.party_list || [];
		var partyMap = global.party || {};
		var me = global.character;
		var cfg = (global.ALUI.config && global.ALUI.config.get("frames.party-frame")) || {};
		var omitSelf = cfg.omitSelf !== false;
		var showMemberTarget = !!(cfg.memberTarget && cfg.memberTarget.enabled !== false);
		var highlightFocus = cfg.highlightFocus !== false;
		var members = [];
		var focusName = global.xtarget && global.xtarget.name;
		var inParty = list.length > 0 || !!(me && me.party);
		var leaderName = list.length ? list[0] : null;

		for (var i = 0; i < list.length; i++) {
			var name = list[i];
			if (!name || typeof name !== "string") continue;
			if (omitSelf && me && name === me.name) continue;
			var info = partyMap[name] || {};
			var nearby = findEntityByName(name);
			var rip = !!(info.rip || (nearby && nearby.rip));
			var unit = buildMemberUnitSlice(name, info, nearby);
			unit.nameColor = CLASS_COLORS[info.type || (nearby && nearby.ctype) || ""] || "#cfcfcf";
			var row = {
				name: name,
				level: info.level || (nearby && nearby.level) || unit.level || 0,
				type: info.type || (nearby && nearby.ctype) || "",
				rip: rip,
				far: !nearby,
				leader: !!(leaderName && name === leaderName),
				isFocus: !!(highlightFocus && focusName && focusName === name),
				map: info.map || "",
				share: typeof info.share === "number" ? Math.round(info.share * 100) : null,
				skin: info.skin || (nearby && nearby.skin) || "",
				cx: info.cx || (nearby && nearby.cx) || {},
				canKick: !!(me && list.indexOf(me.name) < i),
				unit: unit,
				memberTarget: showMemberTarget ? buildMemberTargetSlice(name) : null,
			};
			members.push(row);
		}

		return {
			inParty: inParty,
			partySize: list.length || (inParty ? 1 : 0),
			count: members.length,
			omitSelf: omitSelf,
			highlightFocus: highlightFocus,
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
			} else if (act === "message") {
				if (typeof add_chat === "function") add_chat("", "/w " + member.name + " ");
			} else if (act === "kick" && global.socket) {
				global.socket.emit("party", { event: "kick", name: member.name });
			}
			closeCtx();
		});
	}

	var EFFECTS_PATH = "frames.party-frame.effects";
	var PARTY_SIDECAR_EXTRA = 28;
	var SIDECAR_ATTR = "data-alui-effects-sidecar";

	function partyNameExtraHtml(member) {
		return (member.leader ? '<span class="lead" title="Party leader">★</span>' : "") + '<button type="button" class="party-d-btn travel" title="Travel" data-act="travel">➤</button>';
	}

	function partyEffectsLayout() {
		var cfg = (global.ALUI.config && global.ALUI.config.get(EFFECTS_PATH)) || {};
		if (typeof global.ALUI.normalizeEffectsLayout === "function") {
			return global.ALUI.normalizeEffectsLayout(cfg);
		}
		return {
			enabled: cfg.enabled !== false,
			side: cfg.side || "right",
			anchor: cfg.anchor || "top",
			direction: cfg.direction || "down",
			gap: 4,
		};
	}

	function applyMemberTargetOffset(slot, effectsLayout) {
		var lock = slot.querySelector(".party-lock-frames");
		var link = slot.querySelector(".anchor-link");
		var extra = 0;
		if (effectsLayout && effectsLayout.enabled !== false && effectsLayout.side === "right") {
			extra = PARTY_SIDECAR_EXTRA;
		}
		var gap = 12 + extra;
		if (lock) {
			lock.style.position = "absolute";
			lock.style.left = "100%";
			lock.style.top = "0";
			lock.style.marginLeft = gap + "px";
		}
		if (link) {
			link.style.position = "absolute";
			link.style.left = "100%";
			link.style.top = "36px";
			link.style.width = gap + "px";
			link.style.height = "2px";
		}
	}

	/** Declarative sidecar refresh — registered into applyAllEffectsFromConfig. */
	function applyPartySidecarsFromConfig() {
		var slots = document.querySelectorAll("[" + SIDECAR_ATTR + '="' + EFFECTS_PATH + '"]');
		var layout = partyEffectsLayout();
		for (var i = 0; i < slots.length; i++) {
			applyMemberTargetOffset(slots[i], layout);
		}
	}

	function renderRowShellHtml(member) {
		return (
			'<div class="party-slot' +
			(member.memberTarget ? " has-locks" : "") +
			'" data-party-name="' +
			escapeAttr(member.name) +
			'" ' +
			SIDECAR_ATTR +
			'="' +
			EFFECTS_PATH +
			'">' +
			'<div class="party-d-row">' +
			'<div class="party-d-portrait ctype-' +
			escapeAttr(member.type || "") +
			'" data-portrait-key="' +
			escapeAttr(portraitKey(member)) +
			'"><div class="party-d-avatar">' +
			renderPortraitInner(member) +
			"</div></div>" +
			'<div class="party-d-body">' +
			'<div class="party-uf-host"></div>' +
			'<div class="party-d-foot"><span class="loc"></span><span class="share"></span></div>' +
			"</div></div>" +
			'<div class="anchor-link" aria-hidden="true"></div>' +
			'<div class="party-lock-frames"><div class="party-lock-uf"></div></div>' +
			"</div>"
		);
	}

	function mountPartyRowViews(slot, member, opts) {
		opts = opts || {};
		var ufHost = slot.querySelector(".party-uf-host");
		var lockHost = slot.querySelector(".party-lock-uf");
		var row = slot.querySelector(".party-d-row");
		if (!ufHost || typeof global.ALUI.mountUnitFrame !== "function") return null;
		var effectsLayout = partyEffectsLayout();
		var memberView = global.ALUI.mountUnitFrame(ufHost, {
			chrome: false,
			showAvatar: false,
			compact: true,
			textMode: "percent",
			hideSkull: true,
			hideInspect: !!opts.hideInspect,
			frameId: (opts.frameIdPrefix || "party-") + member.name,
			frameClass: "unitframe--party",
			nameExtraHtml: partyNameExtraHtml(member),
			effectsHost: row,
			effectsConfigPath: EFFECTS_PATH,
			effectsLayout: effectsLayout,
		});
		var targetView = null;
		if (lockHost) {
			targetView = global.ALUI.mountUnitFrame(lockHost, {
				compact: true,
				showAvatar: true,
				textMode: "percent",
				hideEffects: true,
				hideInspect: true,
				roleLabel: member.name + "’s Target",
				frameId: (opts.frameIdPrefix || "party-tot-") + member.name,
				emptyName: "",
			});
		}
		applyMemberTargetOffset(slot, effectsLayout);
		return { member: memberView, target: targetView };
	}

	function findSlotByName(rootEl, name) {
		if (!rootEl) return null;
		var slots = rootEl.querySelectorAll(".party-slot");
		for (var s = 0; s < slots.length; s++) {
			if (slots[s].getAttribute("data-party-name") === name) return slots[s];
		}
		return null;
	}

	defineWidget(
		"party-frame",
		function () {
			var root, unsubscribe;
			var lastRoster = "";
			var rowViews = {};

			function destroyRowViews() {
				var keys = Object.keys(rowViews);
				for (var i = 0; i < keys.length; i++) {
					var v = rowViews[keys[i]];
					if (v.member && v.member.destroy) v.member.destroy();
					if (v.target && v.target.destroy) v.target.destroy();
				}
				rowViews = {};
			}

			function patchChrome(slot, member) {
				var row = slot.querySelector(".party-d-row");
				if (!row) return;
				var classes = "party-d-row";
				if (member.rip) classes += " dead";
				if (member.far) classes += " far";
				if (member.isFocus) classes += " is-focus";
				if (row.className !== classes) row.className = classes;

				fillPortrait(slot.querySelector(".party-d-portrait"), member);

				var extra = slot.querySelector(".unitframe-name-extra");
				if (extra) {
					var nextExtra = partyNameExtraHtml(member);
					if (extra.innerHTML !== nextExtra) extra.innerHTML = nextExtra;
				}

				var loc = slot.querySelector(".party-d-foot .loc");
				var locText = member.far ? member.map || "far" : "nearby";
				if (loc && loc.textContent !== locText) loc.textContent = locText;
				var share = slot.querySelector(".party-d-foot .share");
				var shareText = member.share != null ? member.share + "%" : "";
				if (share && share.textContent !== shareText) share.textContent = shareText;

				if (member.memberTarget) slot.classList.add("has-locks");
				else slot.classList.remove("has-locks");
				var lockWrap = slot.querySelector(".party-lock-frames");
				if (lockWrap) lockWrap.style.display = member.memberTarget ? "" : "none";
			}

			function renderHeader(slice) {
				var header = root.querySelector(".party-d-header");
				if (!header) return;
				var role = header.querySelector(".unitframe-role");
				var label = "Party · " + (slice.partySize || slice.count || 0);
				if (role && role.textContent !== label) role.textContent = label;
			}

			function rebuild(slice) {
				destroyRowViews();
				var html = '<div class="party-d-header"><div class="unitframe-role">Party · ' + (slice.partySize || slice.count || 0) + '</div><div class="party-d-actions">';
				if (slice.showInvite) {
					html += '<button type="button" class="party-d-iconbtn invite" title="Invite" data-act="invite">+</button>';
				}
				if (slice.showLeave) {
					html += '<button type="button" class="party-d-iconbtn leave" title="Leave" data-act="leave">✕</button>';
				}
				html += "</div></div>";
				for (var i = 0; i < slice.members.length; i++) {
					html += renderRowShellHtml(slice.members[i]);
				}
				root.innerHTML = html;
				lastRoster = rosterKey(slice.members);
				for (var j = 0; j < slice.members.length; j++) {
					var member = slice.members[j];
					var slot = findSlotByName(root, member.name);
					if (!slot) continue;
					rowViews[member.name] = mountPartyRowViews(slot, member);
					patchChrome(slot, member);
					if (rowViews[member.name] && rowViews[member.name].member) {
						rowViews[member.name].member.render(member.unit);
					}
					if (rowViews[member.name] && rowViews[member.name].target) {
						rowViews[member.name].target.render(member.memberTarget || null);
					}
				}
			}

			function render(slice) {
				if (!root) return;
				// Hide only when not in a party. Owner with omitSelf still sees header (+ invite/leave).
				if (!slice || !slice.inParty) {
					root.style.display = "none";
					if (root.innerHTML !== "") {
						destroyRowViews();
						root.innerHTML = "";
					}
					lastRoster = "";
					return;
				}
				root.style.display = "flex";
				root.style.width = (slice.width || 200) + "px";
				var nextRoster = rosterKey(slice.members);
				if (nextRoster !== lastRoster || !root.querySelector(".party-d-header")) {
					rebuild(slice);
					return;
				}
				renderHeader(slice);
				for (var i = 0; i < slice.members.length; i++) {
					var member = slice.members[i];
					var slot = findSlotByName(root, member.name);
					if (!slot || !rowViews[member.name]) {
						rebuild(slice);
						return;
					}
					patchChrome(slot, member);
					rowViews[member.name].member.render(member.unit);
					if (rowViews[member.name].target) {
						rowViews[member.name].target.render(member.memberTarget || null);
					}
				}
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
					return;
				}
				if (event.target.closest && event.target.closest(".unitframe-inspect")) {
					if (!name) return;
					event.preventDefault();
					event.stopPropagation();
					var ent = findEntityByName(name);
					if (ent && typeof ui_inspect === "function") ui_inspect(ent);
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
							document.body.appendChild(root);
						}
					} else {
						root = target;
					}
					root.className = "party-d enableclicks";
					root.setAttribute("data-alui-edit-hide", "1");
					root.setAttribute("data-alui-layout-path", "frames.party-frame.layout");
					var cfgLayout = (global.ALUI.config && global.ALUI.config.get("frames.party-frame.layout")) || {};
					global.ALUI.layout.apply(root, cfgLayout);
					render(initial || null);
					unsubscribe = subscribe("party-frame", render);
					root.addEventListener("click", onRootClick);
					root.addEventListener("contextmenu", onRootContext);
					document.addEventListener("click", closeCtx);
				},
				update: render,
				dispose: function () {
					if (unsubscribe) unsubscribe();
					destroyRowViews();
					if (root) {
						root.removeEventListener("click", onRootClick);
						root.removeEventListener("contextmenu", onRootContext);
						root.innerHTML = "";
					}
					document.removeEventListener("click", closeCtx);
				},
			};
		},
		{
			edit: {
				label: "Party",
				kind: "party",
				layoutPath: "frames.party-frame.layout",
				draggable: true,
				order: 10,
			},
		},
	);

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
					layout: {
						anchorX: "left",
						anchorY: "center",
						offsetX: 0,
						offsetY: 0,
						grow: "down",
						zIndex: 200,
					},
					memberTarget: { enabled: true, size: "compact", anchor: "row" },
					effects: {
						enabled: true,
						side: "right",
						anchor: "top",
						direction: "down",
						gap: 4,
					},
				},
			},
		});
		global.ALUI.config.registerSetting({ path: "frames.party-frame.enabled", label: "Enabled", type: "boolean", group: "Party" });
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.omitSelf",
			label: "Hide yourself",
			type: "boolean",
			group: "Party",
		});
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.showInvite",
			label: "Show invite",
			type: "boolean",
			group: "Party",
		});
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.showLeave",
			label: "Show leave",
			type: "boolean",
			group: "Party",
		});
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.highlightFocus",
			label: "Highlight focus",
			type: "boolean",
			group: "Party",
		});
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.width",
			label: "Width",
			type: "number",
			group: "Party",
			min: 120,
			max: 480,
			step: 1,
		});
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.memberTarget.enabled",
			label: "Member target",
			type: "boolean",
			group: "Party",
		});
		global.ALUI.config.registerLayoutSettings("party-frame", "Party", { includeGrow: true });
		global.ALUI.config.registerEffectsSettings("party-frame", "Party");
	}

	function registerPartyPublisher() {
		if (typeof global.ALUI.registerPublisher !== "function") return;
		global.ALUI.registerPublisher("party-frame", buildPartyFrame, {
			on: ["update_overlays", "render_party"],
			signature: partyFrameSignature,
		});
	}

	function hideLegacyParty() {
		var np = document.getElementById("newparty");
		if (np) {
			np.style.display = "none";
			np.innerHTML = "";
		}
		var pl = document.getElementById("partylist");
		if (pl) pl.style.display = "none";
	}

	/**
	 * When party-frame is enabled, suppress legacy #newparty / #partylist.
	 */
	function hookRenderParty() {
		if (typeof global.render_party !== "function") return;
		if (global.render_party._aluiPartyHooked) return;
		var original = global.render_party;
		global.render_party = function () {
			var enabled = global.ALUI && global.ALUI.config && global.ALUI.config.isEnabled("party-frame");
			if (enabled) {
				hideLegacyParty();
				return;
			}
			return original.apply(this, arguments);
		};
		global.render_party._aluiPartyHooked = true;
	}

	/**
	 * Edit Mode preview — live row shell + mount path (no forked HTML).
	 */
	function mountPartyPreview(host, opts) {
		opts = opts || {};
		if (!host) return null;
		var width = opts.width || 200;
		if (!opts.width && global.ALUI && global.ALUI.config) {
			var w = global.ALUI.config.get("frames.party-frame.width");
			if (typeof w === "number") width = w;
		}
		var me = global.character;
		var names = opts.names || [(me && me.name) || "Player", "Ally"];
		var dummy =
			typeof global.ALUI.editDummySlice === "function"
				? global.ALUI.editDummySlice
				: function (name, level) {
						return { name: name, level: level || 40, healthPercent: 75, manaPercent: 84, effects: [], effectsKey: "" };
					};

		host.style.width = width + "px";
		host.style.display = "flex";
		host.style.flexDirection = "column";
		host.style.gap = "5px";
		host.className = "party-d";

		var html = '<div class="party-d-header"><div class="unitframe-role">Party · ' + names.length + '</div><div class="party-d-actions"></div></div>';
		var members = [];
		for (var i = 0; i < names.length; i++) {
			var unit = dummy(names[i], 40 + i);
			var member = {
				name: names[i],
				level: unit.level,
				type: "mage",
				rip: false,
				far: false,
				leader: i === 0,
				isFocus: false,
				map: "",
				share: 25,
				skin: unit.skin || "",
				cx: unit.cx || {},
				unit: unit,
				memberTarget: i === 0 ? dummy("Mob", 20) : null,
			};
			members.push(member);
			html += renderRowShellHtml(member);
		}
		host.innerHTML = html;

		for (var j = 0; j < members.length; j++) {
			var m = members[j];
			var slot = findSlotByName(host, m.name);
			if (!slot) continue;
			var views = mountPartyRowViews(slot, m, { hideInspect: true, frameIdPrefix: "edit-party-" });
			if (views && views.member) views.member.render(m.unit);
			if (views && views.target) views.target.render(m.memberTarget || null);
			var loc = slot.querySelector(".party-d-foot .loc");
			if (loc) loc.textContent = "nearby";
			var share = slot.querySelector(".party-d-foot .share");
			if (share) share.textContent = "25%";
		}
		return host;
	}

	registerPartyConfig();
	registerPartyPublisher();

	if (typeof global.ALUI.registerEffectsApplier === "function") {
		global.ALUI.registerEffectsApplier(applyPartySidecarsFromConfig);
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.buildPartyFrame = buildPartyFrame;
	global.ALUI.mountPartyPreview = mountPartyPreview;
	global.ALUI.onWidgetsMounted = global.ALUI.onWidgetsMounted || [];
	global.ALUI.onWidgetsMounted.push(function () {
		hookRenderParty();
		if (global.ALUI.config && global.ALUI.config.isEnabled("party-frame")) hideLegacyParty();
		if (typeof global.render_party === "function") global.render_party();
	});
	hookRenderParty();
})(typeof window !== "undefined" ? window : global);
