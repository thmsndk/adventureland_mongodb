/**
 * HUD Edit Mode — drag shells over a grid; live widgets stay unaware.
 * Shells render frame-looking dummies (WoW/FFXIV-style force-show while editing).
 */
(function (global) {
	var ROOT_ID = "alui-hud-edit";
	var SHELL_ATTR = "data-alui-shell-for";

	var active = false;
	var selectedId = null;
	var dragState = null;
	var shells = {};
	var keyHandler = null;
	var resizeHandler = null;
	var pendingLayouts = {};

	function cfg() {
		return (global.ALUI.config && global.ALUI.config.get("editMode")) || {};
	}

	/** Single catalog: defineWidget(..., { edit }) via ALUI.listEditableFrames. */
	function editableFrames() {
		if (global.ALUI && typeof global.ALUI.listEditableFrames === "function") {
			return global.ALUI.listEditableFrames();
		}
		return [];
	}

	function findEntry(id) {
		var frames = editableFrames();
		for (var i = 0; i < frames.length; i++) {
			if (frames[i].id === id) return frames[i];
		}
		return null;
	}

	function isEditMode() {
		return active;
	}

	function meName() {
		return (global.character && global.character.name) || "Player";
	}

	function dummySlice(name, level) {
		if (typeof global.ALUI.editDummySlice === "function") {
			return global.ALUI.editDummySlice(name, level);
		}
		return {
			id: "alui-edit-dummy",
			name: name,
			level: level || 42,
			hp: 750,
			maxHp: 1000,
			healthPercent: 75,
			mp: 420,
			maxMp: 500,
			manaPercent: 84,
			dead: false,
			effects: [],
			effectsKey: "",
		};
	}

	function fillUnitDummy(host, entry) {
		if (!global.ALUI || typeof global.ALUI.mountUnitFrame !== "function") {
			host.innerHTML = '<div class="alui-edit-placeholder-label">' + entry.label + "</div>";
			return;
		}
		var opts = {};
		var src = entry.unitOpts || {};
		var keys = Object.keys(src);
		for (var i = 0; i < keys.length; i++) opts[keys[i]] = src[keys[i]];
		opts.hideInspect = true;
		opts.frameId = "edit-" + entry.id;
		var view = global.ALUI.mountUnitFrame(host, opts);
		if (!view) return;
		var name = entry.id === "player-frame" ? meName() : entry.label;
		view.render(dummySlice(name, entry.id === "player-frame" ? global.character && global.character.level : 50));
	}

	function fillPartyDummy(host) {
		if (typeof global.ALUI.mountPartyPreview === "function") {
			global.ALUI.mountPartyPreview(host, { names: [meName(), "Ally"] });
			return;
		}
		host.innerHTML = '<div class="alui-edit-placeholder-label">Party</div>';
	}

	function measureLiveOrDefault(entry) {
		var live = document.querySelector('[data-widget="' + entry.id + '"]');
		if (live && global.ALUI.layout) {
			var rect = global.ALUI.layout.getViewportRect(live);
			if (rect && rect.width > 8 && rect.height > 8 && !live.classList.contains("alui-hidden-empty")) {
				return rect;
			}
		}
		if (entry.kind === "party") return { left: 8, top: 200, width: 200, height: 140 };
		if (entry.unitOpts && entry.unitOpts.compact) return { left: 40, top: 120, width: 220, height: 72 };
		return { left: 40, top: 120, width: 290, height: 90 };
	}

	function resolveShellPosition(entry, width, height) {
		if (entry.draggable && entry.layoutPath && global.ALUI.config) {
			var layout = global.ALUI.config.get(entry.layoutPath) || {};
			return global.ALUI.layout.topLeftFromLayout(layout, width, height);
		}
		var dp = entry.defaultPos || {};
		if (dp.near && shells[dp.near]) {
			var base = shells[dp.near].getBoundingClientRect();
			return {
				left: Math.round(base.left + (dp.dx || 0)),
				top: Math.round(base.top + (dp.dy || 0)),
			};
		}
		var probe = measureLiveOrDefault(entry);
		return { left: Math.round(probe.left), top: Math.round(probe.top) };
	}

	function createShell(entry) {
		var shell = document.createElement("div");
		shell.className = "alui-edit-shell" + (entry.draggable ? " alui-edit-target" : " alui-edit-shell--locked");
		shell.setAttribute(SHELL_ATTR, entry.id);
		if (entry.draggable) shell.setAttribute("data-alui-editable", "1");

		var badge = document.createElement("div");
		badge.className = "alui-edit-shell-badge";
		badge.textContent = entry.draggable ? entry.label : entry.label + " (preview)";
		shell.appendChild(badge);

		var body = document.createElement("div");
		body.className = "alui-edit-shell-body";
		shell.appendChild(body);

		if (entry.kind === "party") fillPartyDummy(body);
		else fillUnitDummy(body, entry);

		document.body.appendChild(shell);

		var width = Math.max(shell.offsetWidth, 160);
		var height = Math.max(shell.offsetHeight, 48);
		var L = entry.layoutPath && global.ALUI.config ? global.ALUI.layout.normalize(global.ALUI.config.get(entry.layoutPath) || {}) : { zIndex: 3950 };
		var pos = resolveShellPosition(entry, width, height);

		shell.style.position = "fixed";
		shell.style.left = pos.left + "px";
		shell.style.top = pos.top + "px";
		shell.style.right = "auto";
		shell.style.bottom = "auto";
		shell.style.zIndex = String((L && L.zIndex) || 3950);
		shell.style.width = "auto";
		shell.style.minWidth = "";
		shell.style.minHeight = "";

		shells[entry.id] = shell;
		return shell;
	}

	function clearShells() {
		var ids = Object.keys(shells);
		for (var i = 0; i < ids.length; i++) {
			var node = shells[ids[i]];
			if (node && node.parentNode) node.parentNode.removeChild(node);
		}
		shells = {};
	}

	function paintGrid(canvas, gridSize) {
		var ctx = canvas.getContext("2d");
		var w = (canvas.width = window.innerWidth);
		var h = (canvas.height = window.innerHeight);
		ctx.clearRect(0, 0, w, h);
		ctx.strokeStyle = "rgba(180, 200, 255, 0.12)";
		ctx.lineWidth = 1;
		for (var x = 0; x <= w; x += gridSize) {
			ctx.beginPath();
			ctx.moveTo(x + 0.5, 0);
			ctx.lineTo(x + 0.5, h);
			ctx.stroke();
		}
		for (var y = 0; y <= h; y += gridSize) {
			ctx.beginPath();
			ctx.moveTo(0, y + 0.5);
			ctx.lineTo(w, y + 0.5);
			ctx.stroke();
		}
		ctx.strokeStyle = "rgba(200, 120, 255, 0.35)";
		ctx.beginPath();
		ctx.moveTo(Math.floor(w / 2) + 0.5, 0);
		ctx.lineTo(Math.floor(w / 2) + 0.5, h);
		ctx.moveTo(0, Math.floor(h / 2) + 0.5);
		ctx.lineTo(w, Math.floor(h / 2) + 0.5);
		ctx.stroke();
	}

	function refreshGrid() {
		var root = document.getElementById(ROOT_ID);
		if (!root) return;
		var canvas = root.querySelector(".alui-edit-grid");
		var em = cfg();
		if (!canvas) return;
		if (em.showGrid === false) {
			canvas.style.display = "none";
			return;
		}
		canvas.style.display = "block";
		paintGrid(canvas, em.gridSize || 20);
	}

	function otherRects(exceptId) {
		var out = [];
		var frames = editableFrames();
		for (var i = 0; i < frames.length; i++) {
			var id = frames[i].id;
			if (id === exceptId) continue;
			var el = shells[id];
			if (!el || !global.ALUI.layout) continue;
			var r = global.ALUI.layout.getViewportRect(el);
			if (r) out.push(r);
		}
		return out;
	}

	function setSelected(id) {
		selectedId = id;
		var nodes = document.querySelectorAll("[" + SHELL_ATTR + "]");
		for (var i = 0; i < nodes.length; i++) {
			nodes[i].classList.toggle("alui-edit-selected", nodes[i].getAttribute(SHELL_ATTR) === id);
		}
		var label = document.querySelector("#" + ROOT_ID + " .alui-edit-selected-label");
		if (label) {
			var entry = findEntry(id);
			label.textContent = entry ? entry.label : "None";
		}
	}

	function stageLayout(entry, left, top, width, height) {
		if (!entry.draggable || !entry.layoutPath) return;
		var prev = (global.ALUI.config && global.ALUI.config.get(entry.layoutPath)) || {};
		var next = global.ALUI.layout.fromTopLeft(left, top, width, height, prev);
		next.grow = prev.grow === "up" ? "up" : prev.grow === "down" ? "down" : next.grow;
		next.zIndex = typeof prev.zIndex === "number" ? prev.zIndex : next.zIndex;
		pendingLayouts[entry.layoutPath] = next;
	}

	function commitPendingLayouts() {
		var paths = Object.keys(pendingLayouts);
		var entries = [];
		for (var i = 0; i < paths.length; i++) {
			entries.push({ path: paths[i], value: pendingLayouts[paths[i]] });
		}
		pendingLayouts = {};
		if (!entries.length) return;
		global.ALUI.config.setMany(entries);
	}

	function applyFreePosition(el, left, top) {
		el.style.left = Math.round(left) + "px";
		el.style.top = Math.round(top) + "px";
		el.style.right = "auto";
		el.style.bottom = "auto";
		el.style.transform = "";
	}

	function onPointerDown(event) {
		if (!active) return;
		var t = event.target;
		if (!t || !t.closest) return;
		if (t.closest("#" + ROOT_ID)) return;
		var host = t.closest("[" + SHELL_ATTR + "]");
		if (!host) return;
		var id = host.getAttribute(SHELL_ATTR);
		var entry = findEntry(id);
		if (!entry) return;
		setSelected(id);
		if (!entry.draggable) return;
		event.preventDefault();
		event.stopPropagation();
		var rect = host.getBoundingClientRect();
		dragState = {
			id: id,
			entry: entry,
			el: host,
			startX: event.clientX,
			startY: event.clientY,
			origLeft: rect.left,
			origTop: rect.top,
			width: rect.width,
			height: rect.height,
		};
		host.classList.add("alui-edit-dragging");
	}

	function onPointerMove(event) {
		if (!dragState) return;
		event.preventDefault();
		var dx = event.clientX - dragState.startX;
		var dy = event.clientY - dragState.startY;
		var left = dragState.origLeft + dx;
		var top = dragState.origTop + dy;
		var em = cfg();
		var free = !!(event.ctrlKey || event.metaKey) || em.snap === false;
		if (!free && global.ALUI.layout) {
			var snapped = global.ALUI.layout.snapTopLeft(left, top, {
				width: dragState.width,
				height: dragState.height,
				gridSize: em.gridSize || 20,
				snapGrid: true,
				snapCenter: true,
				snapElements: em.snapElements !== false,
				threshold: typeof em.snapThreshold === "number" ? em.snapThreshold : 8,
				others: otherRects(dragState.id),
			});
			left = snapped.left;
			top = snapped.top;
		}
		applyFreePosition(dragState.el, left, top);
	}

	function onPointerUp(event) {
		if (!dragState) return;
		var el = dragState.el;
		var entry = dragState.entry;
		var rect = el.getBoundingClientRect();
		el.classList.remove("alui-edit-dragging");
		stageLayout(entry, rect.left, rect.top, rect.width, rect.height);
		dragState = null;
		if (event) event.preventDefault();
	}

	function nudgeSelected(dx, dy) {
		if (!selectedId) return;
		var entry = findEntry(selectedId);
		var el = shells[selectedId];
		if (!entry || !el || !entry.draggable) return;
		var rect = el.getBoundingClientRect();
		var left = rect.left + dx;
		var top = rect.top + dy;
		applyFreePosition(el, left, top);
		stageLayout(entry, left, top, rect.width, rect.height);
	}

	function onKeyDown(event) {
		if (!active) return;
		if (event.key === "Escape") {
			exitEditMode(true);
			return;
		}
		var step = event.shiftKey ? cfg().gridSize || 20 : 1;
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			nudgeSelected(-step, 0);
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			nudgeSelected(step, 0);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			nudgeSelected(0, -step);
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			nudgeSelected(0, step);
		}
	}

	function syncToggles(root) {
		var em = cfg();
		var gridToggle = root.querySelector('[data-edit-toggle="showGrid"]');
		var snapToggle = root.querySelector('[data-edit-toggle="snap"]');
		var snapElToggle = root.querySelector('[data-edit-toggle="snapElements"]');
		if (gridToggle) gridToggle.checked = em.showGrid !== false;
		if (snapToggle) snapToggle.checked = em.snap !== false;
		if (snapElToggle) snapElToggle.checked = em.snapElements !== false;
	}

	/** Defaults only — toggles live on the Edit Mode toolbar, not /hud. */
	function registerEditModeSettings() {
		if (!global.ALUI.config) return;
		global.ALUI.config.registerDefaults({
			editMode: {
				showGrid: true,
				snap: true,
				snapElements: true,
				gridSize: 20,
				snapThreshold: 8,
			},
		});
	}

	function enterEditMode() {
		if (active) return;
		if (!global.ALUI || !global.ALUI.layout || !global.ALUI.config) return;
		if (global.ALUI.closeHudSettings) global.ALUI.closeHudSettings();
		active = true;
		pendingLayouts = {};
		global.ALUI.layout.suspend();
		document.body.classList.add("alui-edit-mode");

		var root = document.createElement("div");
		root.id = ROOT_ID;
		root.className = "alui-hud-edit-overlay";
		root.innerHTML =
			'<canvas class="alui-edit-grid"></canvas>' +
			'<div class="alui-edit-toolbar">' +
			"<strong>Edit Mode</strong>" +
			'<span class="alui-edit-selected-wrap">Selected: <span class="alui-edit-selected-label">None</span></span>' +
			'<label class="alui-edit-check"><input type="checkbox" data-edit-toggle="showGrid"/> Grid</label>' +
			'<label class="alui-edit-check"><input type="checkbox" data-edit-toggle="snap"/> Snap</label>' +
			'<label class="alui-edit-check"><input type="checkbox" data-edit-toggle="snapElements"/> Snap frames</label>' +
			'<span class="alui-edit-hint">Drag frames · Arrows nudge · Shift+arrows grid · Ctrl free-move · Esc done</span>' +
			'<button type="button" class="alui-edit-done">Done</button>' +
			"</div>";

		document.body.appendChild(root);
		syncToggles(root);
		refreshGrid();

		// Draggable first so locked previews can anchor near them.
		var frames = editableFrames();
		for (var i = 0; i < frames.length; i++) {
			if (frames[i].draggable) createShell(frames[i]);
		}
		for (var j = 0; j < frames.length; j++) {
			if (!frames[j].draggable) createShell(frames[j]);
		}

		root.querySelector(".alui-edit-done").addEventListener("click", function () {
			exitEditMode(true);
		});
		root.querySelector('[data-edit-toggle="showGrid"]').addEventListener("change", function (e) {
			global.ALUI.config.set("editMode.showGrid", !!e.target.checked);
			refreshGrid();
		});
		root.querySelector('[data-edit-toggle="snap"]').addEventListener("change", function (e) {
			global.ALUI.config.set("editMode.snap", !!e.target.checked);
		});
		root.querySelector('[data-edit-toggle="snapElements"]').addEventListener("change", function (e) {
			global.ALUI.config.set("editMode.snapElements", !!e.target.checked);
		});

		document.addEventListener("mousedown", onPointerDown, true);
		document.addEventListener("mousemove", onPointerMove, true);
		document.addEventListener("mouseup", onPointerUp, true);
		keyHandler = onKeyDown;
		document.addEventListener("keydown", keyHandler, true);
		resizeHandler = refreshGrid;
		window.addEventListener("resize", resizeHandler);
	}

	function exitEditMode(commit) {
		if (!active) return;
		active = false;
		dragState = null;
		selectedId = null;
		document.body.classList.remove("alui-edit-mode");
		document.removeEventListener("mousedown", onPointerDown, true);
		document.removeEventListener("mousemove", onPointerMove, true);
		document.removeEventListener("mouseup", onPointerUp, true);
		if (keyHandler) document.removeEventListener("keydown", keyHandler, true);
		if (resizeHandler) window.removeEventListener("resize", resizeHandler);
		keyHandler = null;
		resizeHandler = null;
		clearShells();
		var root = document.getElementById(ROOT_ID);
		if (root && root.parentNode) root.parentNode.removeChild(root);

		if (commit) commitPendingLayouts();
		else pendingLayouts = {};

		// Layout was suspended during edit; commit notify skips apply while suspended.
		// One layout restamp after resume — no content republish (layout-only change).
		global.ALUI.layout.resume();
		global.ALUI.layout.applyAllFromConfig();
	}

	registerEditModeSettings();

	global.ALUI = global.ALUI || {};
	global.ALUI.enterEditMode = enterEditMode;
	global.ALUI.exitEditMode = function () {
		exitEditMode(true);
	};
	global.ALUI.isEditMode = isEditMode;
})(typeof window !== "undefined" ? window : global);
