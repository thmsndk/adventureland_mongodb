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
	var recipe = G.craft[craftKey];
	var $wrap = $("<div>").css({ display: "flex", alignItems: "center", flexWrap: "wrap" });
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

/** Hydrate declarative guide markup: .item-sprite, .craft-recipe, .monster-sprite, .npc-sprite, .skill-meta, .gPath */
function hydrate_guide(root) {
	var $root = root ? $(root) : $(document);

	$root.find(".item-sprite").each(function (i, element) {
		var gPath = $(element).html().trim();
		var itemKey = gPath.split(".").pop();
		var opts = { q: 0 };
		var q = $(element).attr("data-q");
		var level = $(element).attr("data-level");
		if (q != null) opts.q = Number(q);
		if (level != null) opts.level = Number(level);
		$(element).html(guide_item_el(itemKey, opts));
	});

	$root.find(".craft-recipe").each(function (i, element) {
		var craftKey = $(element).html().trim().split(".").pop();
		$(element).html(render_craft_recipe(craftKey));
	});

	$root.find(".monster-sprite").each(function (i, element) {
		var monsterKey = $(element).html().trim().split(".").pop();
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
		$(element).html($div);
	});

	$root.find(".npc-sprite").each(function (i, element) {
		var skin = $(element).html().trim();
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
		$(element).html($div);
	});

	$root.find(".skill-meta").each(function (i, element) {
		var gPath = $(element).html().trim();
		var skillKey = gPath.split(".").pop();
		var location = $(element).attr("data-location");
		$(element).html(guide_skill_badges_el(skillKey, { location: location }));
	});

	$root.find(".gPath").each(function (i, element) {
		var gPath = $(element).html();
		$(element).html(eval(gPath));
	});
}

/** Bind tab UI used by multi-panel guides (.tabs / .tab / .tab-panel). */
function bind_guide_tabs(root) {
	var $scope = root ? $(root) : $(document);
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
