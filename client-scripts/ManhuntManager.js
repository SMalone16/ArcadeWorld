/* global pc, document */

var ManhuntManager = pc.createScript("manhuntManager");

ManhuntManager.attributes.add("networkManagerEntity", { type: "entity", title: "Network Manager Entity" });
ManhuntManager.attributes.add("remotePlayerManagerEntity", { type: "entity", title: "Remote Player Manager Entity" });
ManhuntManager.attributes.add("localPlayerEntity", { type: "entity", title: "Local Player Entity" });
ManhuntManager.attributes.add("safeZoneEntity", { type: "entity", title: "Safe Zone Entity" });
ManhuntManager.attributes.add("safeZoneRadius", { type: "number", default: 15, min: 0, title: "Safe Zone Radius" });
ManhuntManager.attributes.add("mainCameraEntity", { type: "entity", title: "Main Camera Entity" });
ManhuntManager.attributes.add("spectatorCameraEntity", { type: "entity", title: "Spectator Camera Entity" });

ManhuntManager.prototype.initialize = function () {
  this.networkClient = this._resolveScript(this.networkManagerEntity, "arcadeNetworkClient");
  this.remotePlayerManager = this._resolveScript(this.remotePlayerManagerEntity, "remotePlayerManager");
  this.state = "lobby";
  this.message = "Go to Home Base and press M to start Manhunt.";
  this._feedbackText = "";
  this._feedbackTimeRemaining = 0;
  this._scoreboardToggled = false;
  this._spectatorActive = false;
  this._hiddenVisuals = [];
  this._lastLoggedPhase = "";
  this._layers = this._createUiLayers();

  if (this.spectatorCameraEntity) this.spectatorCameraEntity.enabled = false;
  this._validateSetup();
  this._bindNetworkEvents();
  this._renderUi();
  this.on("destroy", this._onDestroy, this);
};

ManhuntManager.prototype.update = function (dt) {
  this._checkStartInput();
  this._checkTagInput();
  this._checkScoreboardInput();
  this._checkPositionCaptureInput();

  if (this._feedbackTimeRemaining > 0) {
    this._feedbackTimeRemaining = Math.max(0, this._feedbackTimeRemaining - dt);
    if (this._feedbackTimeRemaining === 0) this._feedbackText = "";
  }

  this._applySpectatorState();
  this._renderUi();
};

ManhuntManager.prototype.startRound = function () {
  var snapshot = this.getSnapshot();
  if (snapshot.state !== "lobby") return;

  if (!this._isLocalPlayerInSafeZone(snapshot)) {
    this._showFeedback("Go to Home Base to start Manhunt.", 2.5);
    console.warn("[Manhunt] start blocked locally: player is outside Home Base safe zone");
    return;
  }

  if (!this.networkClient || !this.networkClient.sendManhuntStartRequest) {
    this._showFeedback("Connect to the server to start Manhunt.", 2.5);
    return;
  }

  console.log("[Manhunt] sending authoritative start request");
  this.networkClient.sendManhuntStartRequest();
};

ManhuntManager.prototype.getSnapshot = function () {
  var serverState = this.networkClient && this.networkClient.getManhuntState ? this.networkClient.getManhuntState() : null;
  var players = serverState && serverState.players ? serverState.players : {};
  var localId = this._getLocalPlayerId();
  var local = players[localId] || null;
  var hiders = this._getPlayersByTeam(players, "hider");

  return {
    state: serverState ? serverState.phase : "lobby",
    timerSeconds: Math.max(0, Math.ceil(serverState ? serverState.timerSeconds : 0)),
    message: serverState && serverState.message ? serverState.message : this.message,
    localPlayer: local,
    players: players,
    hidersActive: this._countHidersByStatus(hiders, "active"),
    hidersSafe: this._countHidersByStatus(hiders, "safe"),
    hidersTagged: this._countHidersByStatus(hiders, "tagged"),
    hiderTotal: hiders.length,
    hiderScore: this._getTeamScore(players, "hider"),
    seekerScore: this._getTeamScore(players, "seeker"),
    safeZoneX: serverState ? serverState.safeZoneX : 0,
    safeZoneY: serverState ? serverState.safeZoneY : 0,
    safeZoneZ: serverState ? serverState.safeZoneZ : 0,
    safeZoneRadius: serverState ? serverState.safeZoneRadius : this.safeZoneRadius,
    results: this._playersToResults(players)
  };
};

ManhuntManager.prototype._bindNetworkEvents = function () {
  if (!this.networkClient) {
    console.warn("[Manhunt] ArcadeNetworkClient missing; Manhunt requires the server for multiplayer rounds.");
    return;
  }

  if (this.networkClient.onManhuntStateChanged) {
    this.networkClient.onManhuntStateChanged(this._onServerManhuntStateChanged.bind(this));
  }

  if (this.networkClient.onManhuntEvent) {
    this.networkClient.onManhuntEvent(this._onManhuntFeedback.bind(this));
  }
};

ManhuntManager.prototype._onServerManhuntStateChanged = function (state) {
  var phase = state && state.phase ? state.phase : "lobby";
  if (phase !== this._lastLoggedPhase) {
    this._lastLoggedPhase = phase;
    console.log("[Manhunt] authoritative phase -> " + phase, state);
    if (phase === "lobby") this._scoreboardToggled = false;
  }
  this.state = phase;
  this.message = state && state.message ? state.message : this.message;
  this._applySpectatorState();
  this._renderUi();
};

ManhuntManager.prototype._onManhuntFeedback = function (payload) {
  if (payload && payload.type === "feedback" && payload.message) {
    this._showFeedback(payload.message, 2.5);
  }
};

ManhuntManager.prototype._checkStartInput = function () {
  if (this.app.keyboard && this.app.keyboard.wasPressed(pc.KEY_M)) this.startRound();
};

ManhuntManager.prototype._checkTagInput = function () {
  if (!this.app.keyboard || !this.app.keyboard.wasPressed(pc.KEY_E)) return;

  var snapshot = this.getSnapshot();
  if (snapshot.state !== "activeRound" || !snapshot.localPlayer || snapshot.localPlayer.manhuntTeam !== "seeker") return;

  if (!this.networkClient || !this.networkClient.sendManhuntTagRequest) {
    this._showFeedback("Connect to the server to tag hiders.", 1.5);
    return;
  }

  console.log("[Manhunt] sending authoritative tag request");
  this.networkClient.sendManhuntTagRequest();
};

ManhuntManager.prototype._checkScoreboardInput = function () {
  if (!this.app.keyboard || !this.app.keyboard.wasPressed(pc.KEY_F)) return;
  var snapshot = this.getSnapshot();
  if (snapshot.state === "lobby") return;
  this._scoreboardToggled = !this._scoreboardToggled;
};

ManhuntManager.prototype._checkPositionCaptureInput = function () {
  if (!this.app.keyboard || !this.app.keyboard.wasPressed(pc.KEY_P)) return;
  if (!this.networkClient || !this.networkClient.sendPlayerPositionCapture) return;
  var local = this._getLocalPlayerEntity();
  if (!local) return;
  var pos = local.getPosition();
  var profile = this.networkClient.getLocalPlayerProfile ? this.networkClient.getLocalPlayerProfile() : null;
  this.networkClient.sendPlayerPositionCapture({
    position: { x: pos.x, y: pos.y, z: pos.z },
    label: "standing at current position",
    localSessionId: this.networkClient.getLocalPlayerId ? this.networkClient.getLocalPlayerId() : "",
    localDisplayName: profile && profile.name ? profile.name : "Student"
  });
  this._showFeedback("Position captured in server terminal.", 1.5);
};

ManhuntManager.prototype._isLocalPlayerInSafeZone = function (snapshot) {
  var local = this._getLocalPlayerEntity();
  if (!local) return false;
  var pos = local.getPosition();
  var center = this.safeZoneEntity ? this.safeZoneEntity.getPosition() : null;
  var radius = this.safeZoneRadius;
  if (!center && snapshot) {
    center = new pc.Vec3(snapshot.safeZoneX || 0, snapshot.safeZoneY || 0, snapshot.safeZoneZ || 0);
    radius = snapshot.safeZoneRadius || radius;
  }
  if (!center) return true;
  var dx = pos.x - center.x;
  var dz = pos.z - center.z;
  return Math.sqrt(dx * dx + dz * dz) <= radius;
};

ManhuntManager.prototype._createUiLayers = function () {
  return {
    centerOverlay: this._createLayer("Manhunt center message", "center"),
    bottomRoleBadge: this._createLayer("Manhunt role badge", "bottom"),
    topRightTaskPanel: this._createLayer("Manhunt task", "topRight"),
    topCenterTimer: this._createLayer("Manhunt timer", "topCenter"),
    scoreboardOverlay: this._createLayer("Manhunt scoreboard", "scoreboard"),
    spectatorOverlay: this._createLayer("Manhunt spectator message", "spectator")
  };
};

ManhuntManager.prototype._createLayer = function (label, position) {
  var root = document.createElement("div");
  root.setAttribute("aria-label", label);
  root.style.position = "fixed";
  root.style.zIndex = position === "scoreboard" ? "9300" : "9100";
  root.style.pointerEvents = "none";
  root.style.color = "#ffffff";
  root.style.font = "800 16px/1.35 Arial, sans-serif";
  root.style.textShadow = "0 2px 4px rgba(0,0,0,0.85)";
  root.style.display = "none";

  if (position === "center") {
    root.style.left = "50%"; root.style.top = "50%"; root.style.transform = "translate(-50%, -50%)";
    root.style.maxWidth = "min(740px, calc(100vw - 48px))"; root.style.padding = "26px 30px";
    root.style.borderRadius = "24px"; root.style.background = "rgba(5, 12, 24, 0.94)";
    root.style.border = "3px solid #ffd166"; root.style.textAlign = "center";
  } else if (position === "bottom") {
    root.style.left = "50%"; root.style.bottom = "28px"; root.style.transform = "translateX(-50%)";
    root.style.padding = "10px 22px"; root.style.borderRadius = "999px"; root.style.background = "rgba(5,12,24,0.88)";
    root.style.border = "2px solid #7ad3ff"; root.style.fontSize = "20px";
  } else if (position === "topRight") {
    root.style.right = "18px"; root.style.top = "18px"; root.style.width = "330px";
    root.style.padding = "14px 16px"; root.style.borderRadius = "18px"; root.style.background = "rgba(8,16,30,0.90)";
    root.style.border = "2px solid rgba(122, 211, 255, 0.9)";
  } else if (position === "topCenter") {
    root.style.left = "50%"; root.style.top = "18px"; root.style.transform = "translateX(-50%)";
    root.style.padding = "10px 22px"; root.style.borderRadius = "16px"; root.style.background = "rgba(5,12,24,0.88)";
    root.style.border = "2px solid #ffd166"; root.style.fontSize = "34px";
  } else if (position === "scoreboard") {
    root.style.left = "50%"; root.style.top = "50%"; root.style.transform = "translate(-50%, -50%)";
    root.style.width = "min(860px, calc(100vw - 48px))"; root.style.maxHeight = "calc(100vh - 64px)";
    root.style.overflow = "auto"; root.style.padding = "24px"; root.style.borderRadius = "24px";
    root.style.background = "rgba(5, 12, 24, 0.96)"; root.style.border = "3px solid #ffd166";
  } else if (position === "spectator") {
    root.style.left = "50%"; root.style.bottom = "84px"; root.style.transform = "translateX(-50%)";
    root.style.padding = "10px 18px"; root.style.borderRadius = "14px"; root.style.background = "rgba(5,12,24,0.86)";
    root.style.border = "2px solid #bdb2ff";
  }

  document.body.appendChild(root);
  return root;
};

ManhuntManager.prototype._renderUi = function () {
  var snapshot = this.getSnapshot();
  this._renderCenterOverlay(snapshot);
  this._renderRoleBadge(snapshot);
  this._renderTaskPanel(snapshot);
  this._renderTimer(snapshot);
  this._renderScoreboard(snapshot);
  this._renderSpectatorOverlay(snapshot);
};

ManhuntManager.prototype._setLayerHtml = function (layer, html) {
  if (!layer) return;
  layer.style.display = html ? "block" : "none";
  layer.innerHTML = html || "";
};

ManhuntManager.prototype._renderCenterOverlay = function (snapshot) {
  var local = snapshot.localPlayer;
  var html = "";
  if (this._feedbackText) {
    html = "<div style='font-size:42px;color:#ffd166;'>" + ManhuntManager.escapeHtml(this._feedbackText) + "</div>";
  } else if (snapshot.state === "teamReveal" && local) {
    var isHider = local.manhuntTeam === "hider";
    html = "<div style='font-size:48px;color:" + (isHider ? "#7CFF8A" : "#FF7A7A") + ";letter-spacing:1px;'>" +
      (isHider ? "YOU ARE A HIDER" : "YOU ARE A SEEKER") + "</div>" +
      "<div style='font-size:24px;margin-top:12px;'>" + ManhuntManager.escapeHtml(this._getRoleInstruction(local)) + "</div>";
  } else if (snapshot.state === "spawnCountdown") {
    html = "<div style='font-size:46px;color:#ffd166;'>Round starts in " + Math.max(1, snapshot.timerSeconds) + "</div>";
  } else if (snapshot.state === "roundOver") {
    html = this._getResultsHtml(snapshot, true);
  }
  this._setLayerHtml(this._layers.centerOverlay, html);
};

ManhuntManager.prototype._renderRoleBadge = function (snapshot) {
  var local = snapshot.localPlayer;
  if (!local || (snapshot.state !== "spawnCountdown" && snapshot.state !== "activeRound")) {
    this._setLayerHtml(this._layers.bottomRoleBadge, "");
    return;
  }
  var color = local.manhuntTeam === "seeker" ? "#ff7a7a" : "#7cff8a";
  this._layers.bottomRoleBadge.style.borderColor = color;
  this._setLayerHtml(this._layers.bottomRoleBadge, ManhuntManager.escapeHtml(this._formatTeam(local.manhuntTeam)));
};

ManhuntManager.prototype._renderTaskPanel = function (snapshot) {
  var local = snapshot.localPlayer;
  if (!local || (snapshot.state !== "spawnCountdown" && snapshot.state !== "activeRound")) {
    this._setLayerHtml(this._layers.topRightTaskPanel, "");
    return;
  }
  this._setLayerHtml(this._layers.topRightTaskPanel, "<div style='font-size:22px;color:#7ad3ff;margin-bottom:6px;'>Manhunt</div><div>" + ManhuntManager.escapeHtml(this._getTaskText(local)) + "</div><div style='margin-top:8px;color:#ffd166;'>Press F for scoreboard</div>");
};

ManhuntManager.prototype._renderTimer = function (snapshot) {
  this._setLayerHtml(this._layers.topCenterTimer, snapshot.state === "activeRound" ? ManhuntManager.escapeHtml(this._formatTimer(snapshot.timerSeconds)) : "");
};

ManhuntManager.prototype._renderScoreboard = function (snapshot) {
  var show = snapshot.state !== "roundOver" && this._scoreboardToggled;
  this._setLayerHtml(this._layers.scoreboardOverlay, show ? this._getResultsHtml(snapshot, false) : "");
};

ManhuntManager.prototype._renderSpectatorOverlay = function (snapshot) {
  var local = snapshot.localPlayer;
  var text = "";
  if (local && local.manhuntStatus === "tagged") text = "You were tagged. Spectating until the round ends.";
  if (local && local.manhuntStatus === "safe") text = "You made it to Home Base. Spectating until the round ends.";
  if (snapshot.state === "roundOver") text = "Round over. Spectating Home Base until free roam resumes.";
  this._setLayerHtml(this._layers.spectatorOverlay, text ? ManhuntManager.escapeHtml(text) : "");
};

ManhuntManager.prototype._getResultsHtml = function (snapshot, includeTitle) {
  var rows = snapshot.results.map(function (player) {
    return "<tr>" +
      "<td style='text-align:left;padding:6px 10px;'>" + ManhuntManager.escapeHtml(player.name) + "</td>" +
      "<td style='padding:6px 10px;'>" + ManhuntManager.escapeHtml(this._formatTeam(player.manhuntTeam)) + "</td>" +
      "<td style='padding:6px 10px;'>" + ManhuntManager.escapeHtml(this._formatStatus(player)) + "</td>" +
      "<td style='padding:6px 10px;text-align:right;'>" + (player.manhuntPoints || 0) + "</td>" +
      "<td style='padding:6px 10px;text-align:right;'>" + (player.totalPoints || 0) + "</td>" +
    "</tr>";
  }, this).join("");

  var title = this._getWinnerTitle(snapshot);
  return "" +
    (includeTitle ? "<div style='font-size:48px;color:#ffd166;text-align:center;'>" + ManhuntManager.escapeHtml(title) + "</div>" : "<div style='font-size:30px;color:#ffd166;'>Scoreboard</div>") +
    "<div style='font-size:18px;margin:8px 0 14px;text-align:center;'>" + ManhuntManager.escapeHtml(snapshot.message) + "</div>" +
    "<div style='display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;'>" +
      this._statPill("Hiders Remaining", snapshot.hidersActive) + this._statPill("Hiders Tagged", snapshot.hidersTagged) + this._statPill("Hiders Safe", snapshot.hidersSafe) +
      this._statPill("Hider Score", snapshot.hiderScore) + this._statPill("Seeker Score", snapshot.seekerScore) +
    "</div>" +
    "<table style='width:100%;border-collapse:collapse;font-size:16px;'><thead><tr style='color:#7ad3ff;'><th style='text-align:left;padding:6px 10px;'>Name</th><th>Team</th><th>Status</th><th style='text-align:right;'>Round</th><th style='text-align:right;'>Total</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    (snapshot.state === "roundOver" ? "<div style='text-align:center;font-size:18px;margin-top:16px;'>Free roam resumes in " + Math.max(1, snapshot.timerSeconds) + "...</div>" : "");
};

ManhuntManager.prototype._statPill = function (label, value) {
  return "<div style='flex:1 1 130px;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,0.08);text-align:center;'><div style='color:#bde0fe;font-size:12px;'>" + ManhuntManager.escapeHtml(label) + "</div><div style='font-size:24px;'>" + value + "</div></div>";
};

ManhuntManager.prototype._getWinnerTitle = function (snapshot) {
  if (snapshot.hiderScore > snapshot.seekerScore) return "HIDERS WIN";
  if (snapshot.seekerScore > snapshot.hiderScore) return "SEEKERS WIN";
  return "TIE ROUND";
};

ManhuntManager.prototype._getRoleInstruction = function (local) {
  return local.manhuntTeam === "seeker" ? "Protect Home Base. Find hiders and tag them with E." : "Stay hidden. Sneak back to Home Base without getting tagged.";
};

ManhuntManager.prototype._getTaskText = function (local) {
  return local.manhuntTeam === "seeker" ? "Task: Find and tag other players by pressing E next to them!" : "Task: Stay hidden, or return to base without being tagged!";
};

ManhuntManager.prototype._applySpectatorState = function () {
  var snapshot = this.getSnapshot();
  var local = snapshot.localPlayer;
  var shouldSpectate = snapshot.state === "roundOver" || (local && (local.manhuntStatus === "tagged" || local.manhuntStatus === "safe"));
  if (shouldSpectate === this._spectatorActive) return;
  this._spectatorActive = shouldSpectate;

  if (this.spectatorCameraEntity) this.spectatorCameraEntity.enabled = shouldSpectate;
  if (this.mainCameraEntity) this.mainCameraEntity.enabled = !shouldSpectate;
  this._setLocalMovementEnabled(!shouldSpectate);
  this._setLocalAvatarVisible(!shouldSpectate);
};

ManhuntManager.prototype._setLocalMovementEnabled = function (enabled) {
  var local = this._getLocalPlayerEntity();
  if (local && local.script && local.script.localPlayerController) {
    local.script.localPlayerController.enabled = enabled;
    if (!enabled && local.script.localPlayerController._stopMovementVelocity) local.script.localPlayerController._stopMovementVelocity();
  }
};

ManhuntManager.prototype._setLocalAvatarVisible = function (visible) {
  var local = this._getLocalPlayerEntity();
  if (!local) return;
  if (!visible) {
    this._hiddenVisuals = [];
    this._collectAndSetVisuals(local, false);
  } else {
    for (var i = 0; i < this._hiddenVisuals.length; i++) {
      this._hiddenVisuals[i].component.enabled = this._hiddenVisuals[i].wasEnabled;
    }
    this._hiddenVisuals = [];
  }
};

ManhuntManager.prototype._collectAndSetVisuals = function (entity, visible) {
  if (!entity) return;
  var components = [entity.model, entity.render];
  for (var i = 0; i < components.length; i++) {
    if (components[i]) {
      this._hiddenVisuals.push({ component: components[i], wasEnabled: components[i].enabled });
      components[i].enabled = visible;
    }
  }
  var children = entity.children || [];
  for (var j = 0; j < children.length; j++) {
    if (children[j] !== this.mainCameraEntity && children[j] !== this.spectatorCameraEntity) this._collectAndSetVisuals(children[j], visible);
  }
};

ManhuntManager.prototype._playersToResults = function (players) {
  var results = [];
  for (var sessionId in players) {
    if (Object.prototype.hasOwnProperty.call(players, sessionId)) {
      var player = players[sessionId];
      results.push({
        sessionId: sessionId,
        name: player.name || this._getPlayerDisplayName(sessionId),
        manhuntTeam: player.manhuntTeam || "none",
        manhuntStatus: player.manhuntStatus || "none",
        manhuntPoints: player.manhuntPoints || 0,
        totalPoints: player.totalPoints || 0
      });
    }
  }
  results.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return results;
};

ManhuntManager.prototype._getPlayersByTeam = function (players, team) {
  var list = [];
  for (var sessionId in players) {
    if (Object.prototype.hasOwnProperty.call(players, sessionId) && players[sessionId].manhuntTeam === team) list.push(players[sessionId]);
  }
  return list;
};

ManhuntManager.prototype._countHidersByStatus = function (hiders, status) {
  var count = 0;
  for (var i = 0; i < hiders.length; i++) if (hiders[i].manhuntStatus === status) count += 1;
  return count;
};

ManhuntManager.prototype._getTeamScore = function (players, team) {
  var score = 0;
  for (var sessionId in players) {
    if (Object.prototype.hasOwnProperty.call(players, sessionId) && players[sessionId].manhuntTeam === team) score += players[sessionId].manhuntPoints || 0;
  }
  return score;
};

ManhuntManager.prototype._formatTimer = function (seconds) {
  var safe = Math.max(0, Math.ceil(seconds || 0));
  return Math.floor(safe / 60) + ":" + String(safe % 60).padStart(2, "0");
};

ManhuntManager.prototype._formatTeam = function (team) {
  if (team === "hider") return "Hider";
  if (team === "seeker") return "Seeker";
  return "Unassigned";
};

ManhuntManager.prototype._formatStatus = function (player) {
  if (!player || player.manhuntStatus === "none") return "Free Roam";
  if (player.manhuntStatus === "safe") return "Safe";
  if (player.manhuntStatus === "tagged") return "Tagged";
  return player.manhuntTeam === "hider" ? "Active Hider" : "Active Seeker";
};

ManhuntManager.prototype._showFeedback = function (text, seconds) {
  this._feedbackText = text;
  this._feedbackTimeRemaining = seconds || 2;
  this._renderUi();
};

ManhuntManager.prototype._getLocalPlayerId = function () {
  return this.networkClient && this.networkClient.getLocalPlayerId ? this.networkClient.getLocalPlayerId() : "";
};

ManhuntManager.prototype._getLocalPlayerEntity = function () {
  if (this.networkClient && this.networkClient.getLocalPlayerEntity) return this.networkClient.getLocalPlayerEntity();
  return this.localPlayerEntity || null;
};

ManhuntManager.prototype._getPlayerDisplayName = function (sessionId) {
  if (this.networkClient && this.networkClient.getPlayerDisplayName) return this.networkClient.getPlayerDisplayName(sessionId);
  return sessionId ? "Player " + String(sessionId).slice(0, 4) : "Student";
};

ManhuntManager.prototype._resolveScript = function (entity, scriptName) {
  return entity && entity.script && entity.script[scriptName] ? entity.script[scriptName] : null;
};

ManhuntManager.prototype._validateSetup = function () {
  if (!this.networkClient) console.warn("[Manhunt] networkManagerEntity is missing ArcadeNetworkClient.");
  if (!this.safeZoneEntity) console.warn("[Manhunt] safeZoneEntity is missing; client-side start check will defer to server.");
  if (!this.spectatorCameraEntity) console.warn("[Manhunt] spectatorCameraEntity is missing; spectator mode will use UI/control locking only.");
};

ManhuntManager.prototype._onDestroy = function () {
  for (var key in this._layers) {
    if (Object.prototype.hasOwnProperty.call(this._layers, key) && this._layers[key] && this._layers[key].parentNode) {
      this._layers[key].parentNode.removeChild(this._layers[key]);
    }
  }
};

ManhuntManager.escapeHtml = function (value) {
  return String(value).replace(/[&<>'"]/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[character];
  });
};
