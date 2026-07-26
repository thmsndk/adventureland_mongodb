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

/** Hydrate declarative guide markup: .item-sprite, .craft-recipe, .monster-sprite, .npc-sprite, .gPath */
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
