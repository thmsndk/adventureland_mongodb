function guide_item_el(itemKey, opts) {
	opts = opts || {};
	var def = G.items[itemKey];
	if (!def) return $("<span>").text(itemKey);
	var actual = { name: itemKey };
	if (opts.q != null) actual.q = opts.q;
	if (opts.level != null) actual.level = opts.level;
	return $("<div>")
		.on("click", function () {
			render_item_info(itemKey);
		})
		.addClass("clickable")
		.css({ display: "inline-block", margin: "2px", verticalAlign: "middle" })
		.append(item_container({ skin: def.skin }, actual));
}

/** Renders G.craft[key].items as [amount, itemKey, level?] icons, then → result. */
function render_craft_recipe(craftKey) {
	var recipe = G.craft && G.craft[craftKey];
	var $wrap = $("<div>").css({ display: "flex", alignItems: "center", flexWrap: "wrap" });
	if (!recipe || !recipe.items) {
		$wrap.append(
			$("<span>")
				.text("Missing craft: " + craftKey)
				.css({ color: "#c44" }),
		);
		return $wrap;
	}
	for (var i = 0; i < recipe.items.length; i++) {
		if (i) $wrap.append($("<span>").text("+").css({ margin: "0 4px", fontSize: "18px", color: "#ddd" }));
		var req = recipe.items[i];
		$wrap.append(guide_item_el(req[1], { q: req[0], level: req[2] }));
	}
	$wrap.append($("<span>").text("→").css({ margin: "0 8px", fontSize: "18px", color: "#c4a035" }));
	$wrap.append(guide_item_el(craftKey, { q: 1 }));
	return $wrap;
}

/** Compact requirement chip — dark, high-contrast, not rainbow. */
function guide_badge_el(text, background) {
	return $("<span>")
		.text(text)
		.css({
			display: "inline-block",
			padding: "3px 10px 4px",
			margin: "0 6px 6px 0",
			borderRadius: "2px",
			color: "#F2F4F7",
			background: background || "#3D4A55",
			fontSize: "24px",
			lineHeight: "1.25",
			verticalAlign: "middle",
			whiteSpace: "nowrap",
		});
}

function guide_meta_bits_el(bits) {
	var $meta = $("<div>").css({
		color: "#1a1a1a",
		fontSize: "24px",
		lineHeight: "1.4",
		marginTop: "6px",
	});
	for (var i = 0; i < bits.length; i++) {
		if (i) $meta.append($("<span>").text(" - ").css({ color: "#5A6570" }));
		$meta.append($("<span>").text(bits[i]));
	}
	return $meta;
}

/**
 * Skill header meta from G.skills[skillKey].
 * Badges = gates only (class / level / weapon). Costs, CD, cast, location = muted line.
 * opts.location — optional free-text location
 */
function guide_skill_badges_el(skillKey, opts) {
	opts = opts || {};
	var skill = G.skills[skillKey];
	var $wrap = $("<div>").css({ marginTop: "4px" });
	if (!skill) {
		$wrap.append(guide_badge_el(skillKey));
		return $wrap;
	}

	var $badges = $("<div>").css({
		display: "flex",
		flexWrap: "wrap",
		alignItems: "center",
	});
	if (skill.class) {
		var classes = is_array(skill.class) ? skill.class : [skill.class];
		for (var c = 0; c < classes.length; c++) {
			$badges.append(guide_badge_el(classes[c].charAt(0).toUpperCase() + classes[c].slice(1), "#3D4A55"));
		}
	}
	if (skill.level) $badges.append(guide_badge_el("Lv " + skill.level + "+", "#1F4D2C"));
	if (skill.wtype) {
		var wtypes = is_array(skill.wtype) ? skill.wtype : [skill.wtype];
		for (var w = 0; w < wtypes.length; w++) {
			var wname = wtypes[w];
			$badges.append(guide_badge_el(wname.charAt(0).toUpperCase() + wname.slice(1), "#3D4A55"));
		}
	}
	if ($badges.children().length) $wrap.append($badges);

	var bits = [];
	if (skill.mp) bits.push(skill.mp + " MP");
	if (skill.reuse_cooldown) bits.push(Math.round(skill.reuse_cooldown / 60000) + "m CD");
	else if (skill.cooldown) bits.push(Math.round(skill.cooldown / 1000) + "s CD");
	if (skill.duration_min && skill.duration_max) bits.push(skill.duration_min / 1000 + "-" + skill.duration_max / 1000 + "s cast");
	else if (skill.duration) bits.push(skill.duration / 1000 + "s");
	if (opts.location) bits.push(opts.location);
	if (bits.length) $wrap.append(guide_meta_bits_el(bits));

	return $wrap;
}

/** Resolve G.drops… path (or bare key) to a drop table array. */
function resolve_guide_drop_table(gPath) {
	var parts = (gPath || "").trim().split(".");
	var table = G.drops;
	var start = 0;
	if (parts[0] === "G" && parts[1] === "drops") start = 2;
	for (var i = start; i < parts.length; i++) {
		if (!table) return null;
		table = table[parts[i]];
	}
	return table;
}

/** Normalize to drops key + display path (G.drops.f1). */
function guide_drops_ref(gPath) {
	var raw = (gPath || "").trim();
	var parts = raw.split(".");
	var key = parts[parts.length - 1];
	if (parts[0] === "G" && parts[1] === "drops") key = parts.slice(2).join(".") || key;
	return { key: key, label: raw.indexOf("G.drops.") === 0 ? raw : "G.drops." + key };
}

/** jlabel-style chip that opens the full drop modal for a G.drops table. */
function guide_drops_badge_el(gPath) {
	var ref = guide_drops_ref(gPath);
	return $("<span>")
		.addClass("jlabel clickable")
		.text(ref.label)
		.css({ margin: "0", verticalAlign: "middle", fontSize: "24px" })
		.on("click", function (event) {
			pcs(event);
			render_exchange_info(ref.key);
		});
}

/** Format a 0–1 chance like render_drop odds text. */
function guide_drop_odds_text(chance) {
	if (chance >= 1) return to_pretty_float(chance) + " / 1";
	if (1 / chance >= 2) return "1 / " + to_pretty_num(round(1 / chance));
	return "1 / " + to_pretty_float(1 / chance);
}

/** Icon + small odds stacked (preview; full odds live in the modal). */
function guide_drop_preview_cell_el(def, mult) {
	var chance = def[0] * (mult || 1);
	var $cell = $("<div>").css({
		display: "inline-flex",
		flexDirection: "column",
		alignItems: "center",
		margin: "0 14px 8px 0",
		minWidth: "52px",
	});
	if (G.items[def[1]]) $cell.append(guide_item_el(def[1], { q: def[2] || 0 }));
	else $cell.append($("<span>").text(def[1]).css({ fontSize: "24px", color: "#5A6570" }));
	$cell.append($("<div>").text(guide_drop_odds_text(chance)).css({ color: "#2a2a2a", fontSize: "24px", lineHeight: "1.2", marginTop: "2px", whiteSpace: "nowrap" }));
	return $cell;
}

/** Pick up to `count` random entries from a drop table (skips nested opens). */
function guide_sample_drops(table, count) {
	var pool = [];
	for (var i = 0; i < (table ? table.length : 0); i++) {
		var d = table[i];
		if (!d || d[1] == "open" || d[1] == "empty") continue;
		if (d[1] == "cx" || d[1] == "cxbundle" || d[1] == "gold" || d[1] == "shells" || G.items[d[1]]) pool.push(d);
	}
	var n = Math.min(count || 4, pool.length);
	for (var j = 0; j < n; j++) {
		var k = j + Math.floor(Math.random() * (pool.length - j));
		var tmp = pool[j];
		pool[j] = pool[k];
		pool[k] = tmp;
	}
	return pool.slice(0, n);
}

function guide_drop_section_label_el(text) {
	return $("<div>").text(text).css({
		color: "#1a1a1a",
		fontSize: "24px",
		margin: "0 0 6px 0",
	});
}

/**
 * Structured guide drop preview:
 * header badge → usual icon grid → rare sample blocks with nested badges.
 */
function guide_drop_table_el(gPath, opts) {
	opts = opts || {};
	var sampleN = opts.sample != null ? Number(opts.sample) : 4;
	var table = resolve_guide_drop_table(gPath);
	var $wrap = $("<div>").css({
		background: "rgba(255,255,255,0.35)",
		border: "2px solid rgba(58,143,191,0.35)",
		padding: "10px 12px",
		fontSize: "24px",
	});

	var $head = $("<div>").css({
		display: "flex",
		flexWrap: "wrap",
		alignItems: "center",
		gap: "8px",
		marginBottom: "10px",
	});
	$head.append(guide_drops_badge_el(gPath));
	$wrap.append($head);

	if (!table || !table.length) {
		$wrap.append($("<span>").text("missing drop table").css({ color: "#888" }));
		return $wrap;
	}

	var total = 0;
	for (var t = 0; t < table.length; t++) total += table[t][0];
	var mult = total ? 1 / total : 1;

	var directs = [];
	var opens = [];
	for (var i = 0; i < table.length; i++) {
		if (table[i][1] == "open") opens.push(table[i]);
		else directs.push(table[i]);
	}

	if (directs.length) {
		var $usual = $("<div>").css({ marginBottom: opens.length ? "12px" : "0" });
		$usual.append(guide_drop_section_label_el(opens.length ? "Usual" : "Drops"));
		var $grid = $("<div>").css({ display: "flex", flexWrap: "wrap", alignItems: "flex-start" });
		for (var d = 0; d < directs.length; d++) $grid.append(guide_drop_preview_cell_el(directs[d], mult));
		$usual.append($grid);
		$wrap.append($usual);
	}

	for (var o = 0; o < opens.length; o++) {
		var def = opens[o];
		var nestedKey = def[2];
		var nested = (G.drops && G.drops[nestedKey]) || [];
		var chance = def[0] * mult;

		var $rare = $("<div>").css({
			borderTop: "2px dotted rgba(58,143,191,0.45)",
			paddingTop: "10px",
			marginTop: o ? "10px" : "0",
		});
		var $rareHead = $("<div>").css({
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "8px",
			marginBottom: "6px",
		});
		$rareHead.append(guide_drop_section_label_el("Rare").css({ margin: "0" }));
		$rareHead.append(guide_drops_badge_el("G.drops." + nestedKey));
		$rareHead.append($("<span>").text(guide_drop_odds_text(chance)).css({ color: "#2a2a2a", fontSize: "24px" }));
		$rare.append($rareHead);

		var $samples = $("<div>").css({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px" });
		var samples = guide_sample_drops(nested, sampleN);
		for (var s = 0; s < samples.length; s++) {
			var sample = samples[s];
			if (G.items[sample[1]]) $samples.append(guide_item_el(sample[1], { q: sample[2] || 0 }));
		}
		if (nested.length > samples.length) {
			$samples.append(
				$("<span>")
					.text("+" + (nested.length - samples.length))
					.css({ color: "#5A6570", fontSize: "24px", marginLeft: "4px" }),
			);
		}
		$rare.append($samples);
		$wrap.append($rare);
	}

	return $wrap;
}

/** Read a declarative G-path from an element; ignore already-rendered HTML. */
function guide_element_path(element, opts) {
	opts = opts || {};
	var $el = $(element);
	var raw = ($el.attr("data-path") || $el.text() || "").trim();
	if (!raw || raw.indexOf("<") !== -1) return "";
	// G.items.rod / bare npc skins — reject rendered junk like "png' draggable=..."
	if (opts.gOnly) {
		if (!/^G\.[A-Za-z0-9_.]+$/.test(raw)) return "";
	} else if (!/^(G\.[A-Za-z0-9_.]+|[A-Za-z0-9_]+)$/.test(raw)) {
		return "";
	}
	return raw;
}

function guide_path_key(gPath) {
	if (!gPath) return "";
	return gPath.split(".").pop();
}

function guide_replace_el(element, $content) {
	$(element).empty().append($content);
}

/** Hydrate declarative guide markup: .item-sprite, .craft-recipe, .monster-sprite, .npc-sprite, .skill-meta, .drop-table, .gPath */
function hydrate_guide(root) {
	var $root = root ? $(root) : $(document);
	if ($root.data("guideHydrated")) return;
	$root.data("guideHydrated", true);

	$root.find(".item-sprite").each(function (i, element) {
		var itemKey = guide_path_key(guide_element_path(element));
		if (!itemKey) return;
		var opts = { q: 0 };
		var q = $(element).attr("data-q");
		var level = $(element).attr("data-level");
		if (q != null) opts.q = Number(q);
		if (level != null) opts.level = Number(level);
		guide_replace_el(element, guide_item_el(itemKey, opts));
	});

	$root.find(".craft-recipe").each(function (i, element) {
		var craftKey = guide_path_key(guide_element_path(element));
		if (!craftKey) return;
		guide_replace_el(element, render_craft_recipe(craftKey));
	});

	$root.find(".monster-sprite").each(function (i, element) {
		var monsterKey = guide_path_key(guide_element_path(element));
		if (!monsterKey) return;
		var $div = $("<div>")
			.on("click", function () {
				render_monster_info(monsterKey);
			})
			.addClass("clickable")
			.css({
				"background-color": "#575983",
				border: "2px solid #9f9fb0",
				position: "relative",
				display: "inline-block",
				margin: "2px",
			})
			.append(sprite(monsterKey, { full: true }));
		guide_replace_el(element, $div);
	});

	$root.find(".npc-sprite").each(function (i, element) {
		var skin = guide_element_path(element);
		if (!skin) return;
		var $div = $("<div>")
			.css({
				"background-color": "#575983",
				border: "2px solid #9f9fb0",
				position: "relative",
				display: "inline-block",
				margin: "2px",
				overflow: "hidden",
			})
			.append(sprite(skin, { full: true }));
		guide_replace_el(element, $div);
	});

	$root.find(".skill-meta").each(function (i, element) {
		var skillKey = guide_path_key(guide_element_path(element));
		if (!skillKey) return;
		var location = $(element).attr("data-location");
		guide_replace_el(element, guide_skill_badges_el(skillKey, { location: location }));
	});

	$root.find(".drop-table").each(function (i, element) {
		var gPath = guide_element_path(element);
		if (!gPath) return;
		var sample = $(element).attr("data-sample");
		guide_replace_el(element, guide_drop_table_el(gPath, sample != null ? { sample: sample } : {}));
	});

	$root.find(".gPath").each(function (i, element) {
		var gPath = guide_element_path(element, { gOnly: true });
		if (!gPath) return;
		$(element).text(eval(gPath));
	});
}

/** Bind tab UI used by multi-panel guides (.tabs / .tab / .tab-panel). */
function bind_guide_tabs(root) {
	var $scope = root ? $(root) : $(document);
	if ($scope.data("guideTabsBound")) return;
	$scope.data("guideTabsBound", true);
	$scope.find(".tabs").each(function () {
		var $tabs = $(this);
		$tabs.on("click", ".tab", function () {
			var key = $(this).attr("data-tab");
			$tabs.find(".tab").removeClass("active");
			$(this).addClass("active");
			$tabs.find(".tab-panel").removeClass("active");
			var $panel = $tabs.find('.tab-panel[data-tab="' + key + '"]').addClass("active");
			$panel.find(".CodeMirror").each(function () {
				if (this.CodeMirror) this.CodeMirror.refresh();
			});
		});
	});
}
