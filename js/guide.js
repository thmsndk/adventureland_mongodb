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

/** Compact colored badge for guide skill/req chips. */
function guide_badge_el(text, background) {
	return $("<span>")
		.text(text)
		.css({
			display: "inline-block",
			padding: "2px 8px 3px",
			margin: "0 6px 6px 0",
			borderRadius: "2px",
			color: "#fff",
			background: background || "#888888",
			fontSize: "18px",
			lineHeight: "1.25",
			verticalAlign: "middle",
			whiteSpace: "nowrap",
		});
}

/**
 * Badge row from G.skills[skillKey].
 * opts.location — optional free-text location badge
 */
function guide_skill_badges_el(skillKey, opts) {
	opts = opts || {};
	var skill = G.skills[skillKey];
	var $wrap = $("<div>").css({
		display: "flex",
		flexWrap: "wrap",
		alignItems: "center",
		marginTop: "6px",
	});
	if (!skill) {
		$wrap.append(guide_badge_el(skillKey, "#888888"));
		return $wrap;
	}
	if (skill.class) {
		var classes = is_array(skill.class) ? skill.class : [skill.class];
		for (var c = 0; c < classes.length; c++) {
			$wrap.append(guide_badge_el(classes[c].charAt(0).toUpperCase() + classes[c].slice(1), "#5a7a8c"));
		}
	}
	if (skill.level) $wrap.append(guide_badge_el("Lv " + skill.level + "+", "#49BD74"));
	if (skill.wtype) {
		var wtypes = is_array(skill.wtype) ? skill.wtype : [skill.wtype];
		for (var w = 0; w < wtypes.length; w++) {
			var wname = wtypes[w];
			$wrap.append(guide_badge_el(wname.charAt(0).toUpperCase() + wname.slice(1), "#77A6C3"));
		}
	}
	if (skill.mp) $wrap.append(guide_badge_el(skill.mp + " MP", "#3C9BC4"));
	if (skill.reuse_cooldown) {
		var mins = Math.round(skill.reuse_cooldown / 60000);
		$wrap.append(guide_badge_el(mins + "m CD", "#E5680D"));
	} else if (skill.cooldown) {
		var secs = Math.round(skill.cooldown / 1000);
		$wrap.append(guide_badge_el(secs + "s CD", "#E5680D"));
	}
	if (skill.duration_min && skill.duration_max) {
		$wrap.append(guide_badge_el(skill.duration_min / 1000 + "–" + skill.duration_max / 1000 + "s cast", "#B9AB63"));
	} else if (skill.duration) {
		$wrap.append(guide_badge_el(skill.duration / 1000 + "s", "#B9AB63"));
	}
	if (opts.location) $wrap.append(guide_badge_el(opts.location, "#8b7355"));
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

/** Render a G.drops table with existing render_drop odds + item icons. */
function guide_drop_table_el(gPath) {
	var table = resolve_guide_drop_table(gPath);
	var $wrap = $("<div>").css({
		display: "flex",
		flexWrap: "wrap",
		alignItems: "center",
		gap: "4px 16px",
	});
	if (!table || !table.length) {
		$wrap.append(
			$("<span>")
				.text(gPath || "missing drop table")
				.css({ color: "#888" }),
		);
		return $wrap;
	}
	for (var i = 0; i < table.length; i++) {
		$wrap.append($(render_drop(table[i], 1, "#858B8E")));
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
		guide_replace_el(element, guide_drop_table_el(gPath));
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
