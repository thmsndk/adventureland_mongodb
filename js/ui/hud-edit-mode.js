/**
 * HUD Edit Mode — WoW-style drag positioning with grid + snap.
 */
(function (global) {
	var ROOT_ID = "alui-hud-edit";
	var active = false;
	var selectedId = null;
	var dragState = null;
	var placeholders = {};
	var keyHandler = null;
	var resizeHandler = null;

	function cfg() {
		return (global.ALUI.config && global.ALUI.config.get("editMode")) || {};
	}

	function editableList() {
		return (global.ALUI.layout && global.ALUI.layout.EDITABLE_FRAMES) || [];
	}

	function findEntry(id) {
		var list = editableList();
		for (var i = 0; i < list.length; i++) {
			if (list[i].id === id) return list[i];
		}
		return null;
	}

	function isEditMode() {
		return active;
	}

	function ensureWidgetVisible(entry) {
		var el = document.querySelector('[data-widget="' + entry.id + '"]');
		if (!el) {
			el = document.createElement("div");
			el.setAttribute("data-widget", entry.id);
			el.className = "alui-edit-placeholder vtopx";
			el.innerHTML = '<div class="alui-edit-placeholder-label">' + entry.label + "</div>";
			document.body.appendChild(el);
			placeholders[entry.id] = el;
			if (global.ALUI.layout) {
				global.ALUI.layout.apply(el, global.ALUI.config.get(entry.layoutPath) || {});
			}
		} else {
			el.removeAttribute("data-alui-config-hidden");
			el.classList.remove("alui-hidden-empty");
			if (el.style.display === "none") {
				el.style.display = el.getAttribute("data-widget") === "party-frame" ? "flex" : "inline-block";
			}
			// Party may be empty — show a ghost header so it is draggable.
			if (entry.id === "party-frame" && !el.querySelector(".party-d-header") && !el.querySelector(".alui-edit-placeholder-label")) {
				var ghost = document.createElement("div");
				ghost.className = "alui-edit-placeholder-label";
				ghost.setAttribute("data-alui-edit-ghost", "1");
				ghost.textContent = entry.label;
				el.appendChild(ghost);
				if (!el.style.width) el.style.width = "200px";
				el.style.display = "flex";
				el.style.flexDirection = "column";
			}
		}
		el.setAttribute("data-alui-editable", "1");
		return el;
	}

	function clearGhosts() {
		var ghosts = document.querySelectorAll("[data-alui-edit-ghost]");
		for (var i = 0; i < ghosts.length; i++) {
			if (ghosts[i].parentNode) ghosts[i].parentNode.removeChild(ghosts[i]);
		}
		var ids = Object.keys(placeholders);
		for (var j = 0; j < ids.length; j++) {
			var node = placeholders[ids[j]];
			if (node && node.parentNode) node.parentNode.removeChild(node);
		}
		placeholders = {};
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
		var list = editableList();
		for (var i = 0; i < list.length; i++) {
			if (list[i].id === exceptId) continue;
			var el = document.querySelector('[data-widget="' + list[i].id + '"]');
			if (!el || !global.ALUI.layout) continue;
			var r = global.ALUI.layout.getViewportRect(el);
			if (r) out.push(r);
		}
		return out;
	}

	function setSelected(id) {
		selectedId = id;
		var nodes = document.querySelectorAll("[data-alui-editable]");
		for (var i = 0; i < nodes.length; i++) {
			nodes[i].classList.toggle("alui-edit-selected", nodes[i].getAttribute("data-widget") === id);
		}
		var label = document.querySelector("#" + ROOT_ID + " .alui-edit-selected-label");
		if (label) {
			var entry = findEntry(id);
			label.textContent = entry ? entry.label : "None";
		}
	}

	function writeLayout(entry, left, top, width, height) {
		var prev = (global.ALUI.config && global.ALUI.config.get(entry.layoutPath)) || {};
		var next = global.ALUI.layout.fromTopLeft(left, top, width, height, prev);
		next.grow = prev.grow === "up" ? "up" : prev.grow === "down" ? "down" : next.grow;
		next.zIndex = typeof prev.zIndex === "number" ? prev.zIndex : next.zIndex;
		global.ALUI.config.set(entry.layoutPath, next);
		var el = document.querySelector('[data-widget="' + entry.id + '"]');
		if (el) global.ALUI.layout.apply(el, next);
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
		var host = t.closest("[data-alui-editable]");
		if (!host) return;
		var id = host.getAttribute("data-widget");
		var entry = findEntry(id);
		if (!entry) return;
		event.preventDefault();
		event.stopPropagation();
		setSelected(id);
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
		writeLayout(entry, rect.left, rect.top, rect.width, rect.height);
		dragState = null;
		if (event) event.preventDefault();
	}

	function nudgeSelected(dx, dy) {
		if (!selectedId) return;
		var entry = findEntry(selectedId);
		var el = document.querySelector('[data-widget="' + selectedId + '"]');
		if (!entry || !el) return;
		var rect = el.getBoundingClientRect();
		var left = rect.left + dx;
		var top = rect.top + dy;
		applyFreePosition(el, left, top);
		writeLayout(entry, left, top, rect.width, rect.height);
	}

	function onKeyDown(event) {
		if (!active) return;
		if (event.key === "Escape") {
			exitEditMode();
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

	function bindEditableHandlers() {
		var list = editableList();
		for (var i = 0; i < list.length; i++) {
			var el = ensureWidgetVisible(list[i]);
			el.classList.add("alui-edit-target");
		}
	}

	function unbindEditableHandlers() {
		var nodes = document.querySelectorAll("[data-alui-editable]");
		for (var i = 0; i < nodes.length; i++) {
			nodes[i].classList.remove("alui-edit-target", "alui-edit-selected", "alui-edit-dragging");
			nodes[i].removeAttribute("data-alui-editable");
		}
		clearGhosts();
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

	function enterEditMode() {
		if (active) return;
		if (!global.ALUI || !global.ALUI.layout || !global.ALUI.config) return;
		if (global.ALUI.closeHudSettings) global.ALUI.closeHudSettings();
		active = true;
		document.body.classList.add("alui-edit-mode");

		var root = document.createElement("div");
		root.id = ROOT_ID;
		root.className = "alui-hud-edit";
		root.innerHTML =
			'<canvas class="alui-edit-grid"></canvas>' +
			'<div class="alui-edit-toolbar">' +
			"<strong>Edit Mode</strong>" +
			'<span class="alui-edit-selected-wrap">Selected: <span class="alui-edit-selected-label">None</span></span>' +
			'<label class="alui-edit-check"><input type="checkbox" data-edit-toggle="showGrid"/> Grid</label>' +
			'<label class="alui-edit-check"><input type="checkbox" data-edit-toggle="snap"/> Snap</label>' +
			'<label class="alui-edit-check"><input type="checkbox" data-edit-toggle="snapElements"/> Snap frames</label>' +
			'<span class="alui-edit-hint">Drag frames · Arrows nudge · Shift+arrows grid step · Ctrl free-move · Esc done</span>' +
			'<button type="button" class="alui-edit-done">Done</button>' +
			"</div>";

		document.body.appendChild(root);
		syncToggles(root);
		refreshGrid();
		bindEditableHandlers();

		root.querySelector(".alui-edit-done").addEventListener("click", exitEditMode);
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

	function exitEditMode() {
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
		unbindEditableHandlers();
		var root = document.getElementById(ROOT_ID);
		if (root && root.parentNode) root.parentNode.removeChild(root);
		if (global.ALUI.layout) global.ALUI.layout.applyAllFromConfig();
		if (global.ALUI.applyConfigVisibility) global.ALUI.applyConfigVisibility();
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.enterEditMode = enterEditMode;
	global.ALUI.exitEditMode = exitEditMode;
	global.ALUI.isEditMode = isEditMode;
})(typeof window !== "undefined" ? window : global);
