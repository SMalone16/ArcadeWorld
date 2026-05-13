/* global pc, document */

var ManhuntManager = pc.createScript("manhuntManager");

ManhuntManager.attributes.add("networkManagerEntity", { type: "entity", title: "Network Manager Entity" });
ManhuntManager.attributes.add("remotePlayerManagerEntity", { type: "entity", title: "Remote Player Manager Entity" });
ManhuntManager.attributes.add("localPlayerEntity", { type: "entity", title: "Local Player Entity" });
ManhuntManager.attributes.add("safeZoneEntity", { type: "entity", title: "Safe Zone Entity" });
ManhuntManager.attributes.add("safeZoneRadius", { type: "number", default: 2.6, min: 0, title: "Safe Zone Radius" });

ManhuntManager.prototype.initialize = function () {
  this.networkClient = this._resolveScript(this.networkManagerEntity, "arcadeNetworkClient");
  this.remotePlayerManager = this._resolveScript(this.remotePlayerManagerEntity, "remotePlayerManager");
  this.state = "lobby";
  this.message = "Go to Home Base and press M to start Manhunt.";
  this._feedbackText = "";
  this._feedbackTimeRemaining = 0;
  this._lastOverlayKey = "";
  this._lastLoggedPhase = "";
  this._hudRoot = this._createSideHud();
  this._overlayRoot = this._createCenterOverlay();

  this._validateSetup();
  this._bindNetworkEvents();
  this._renderUi();
  this.on("destroy", this._onDestroy, this);
};

ManhuntManager.prototype.update = function (dt) {
  this._checkStartInput();
  this._checkTagInput();
  this._checkPositionCaptureInput();

  if (this._feedbackTimeRemaining > 0) {
    this._feedbackTimeRemaining = Math.max(0, this._feedbackTimeRemaining - dt);
    if (this._feedbackTimeRemaining === 0) {
      this._feedbackText = "";
    }
  }

  this._renderUi();
};

ManhuntManager.prototype.startRound = function () {
  var snapshot = this.getSnapshot();
  if (snapshot.state !== "lobby" && snapshot.state !== "roundOver") {
    return;
  }

  if (!this._isLocalPlayerInSafeZone(snapshot)) {
    this._showFeedback("Go to Home Base to start Manhunt.", 2.5);
    console.warn("[Manhunt] start blocked locally: player is outside Home Base safe zone");
    return;
  }

  if (!this.networkClient || !this.networkClient.sendManhuntStartRequest) {
    this._showFeedback("Connect to the server to start Manhunt.", 2.5);
    console.warn("[Manhunt] start blocked: authoritative server unavailable");
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
    hidersSafe: this._countHidersByStatus(hiders, "safe"),
    hidersTagged: this._countHidersByStatus(hiders, "tagged"),
    hiderTotal: hiders.length,
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
  }
  this.state = phase;
  this.message = state && state.message ? state.message : this.message;
  this._renderUi();
};

ManhuntManager.prototype._onManhuntFeedback = function (payload) {
  if (payload && payload.type === "feedback" && payload.message) {
    this._showFeedback(payload.message, 2.5);
  }
};

ManhuntManager.prototype._checkStartInput = function () {
  if (this.app.keyboard && this.app.keyboard.wasPressed(pc.KEY_M)) {
    this.startRound();
  }
};

ManhuntManager.prototype._checkTagInput = function () {
  if (!this.app.keyboard || !this.app.keyboard.wasPressed(pc.KEY_E)) {
    return;
  }

  var snapshot = this.getSnapshot();
  if (snapshot.state !== "seekingPhase" || !snapshot.localPlayer || snapshot.localPlayer.manhuntTeam !== "seeker") {
    return;
  }

  if (!this.networkClient || !this.networkClient.sendManhuntTagRequest) {
    this._showFeedback("Connect to the server to tag hiders.", 1.5);
    return;
  }

  console.log("[Manhunt] sending authoritative tag request");
  this.networkClient.sendManhuntTagRequest();
};

ManhuntManager.prototype._checkPositionCaptureInput = function () {
  if (!this.app.keyboard || !this.app.keyboard.wasPressed(pc.KEY_P)) {
    return;
  }

  if (!this.networkClient || !this.networkClient.sendPlayerPositionCapture) {
    this._showFeedback("Connect to the server to capture position.", 1.5);
    return;
  }

  var local = this._getLocalPlayerEntity();
  if (!local) {
    this._showFeedback("Local player missing; position not captured.", 1.5);
    return;
  }

  var pos = local.getPosition();
  var profile = this.networkClient.getLocalPlayerProfile ? this.networkClient.getLocalPlayerProfile() : null;
  var payload = {
    position: { x: pos.x, y: pos.y, z: pos.z },
    label: "standing at current position",
    localSessionId: this.networkClient.getLocalPlayerId ? this.networkClient.getLocalPlayerId() : "",
    localDisplayName: profile && profile.name ? profile.name : "Student"
  };

  console.log("[ManhuntDebug] sending position capture", payload);
  this.networkClient.sendPlayerPositionCapture(payload);
  this._showFeedback("Position captured in server terminal.", 1.5);
};

ManhuntManager.prototype._isLocalPlayerInSafeZone = function (snapshot) {
  var local = this._getLocalPlayerEntity();
  if (!local) {
    return false;
  }

  var pos = local.getPosition();
  var center = this.safeZoneEntity ? this.safeZoneEntity.getPosition() : null;
  var radius = this.safeZoneRadius;
  if (!center && snapshot) {
    center = new pc.Vec3(snapshot.safeZoneX || 0, snapshot.safeZoneY || 0, snapshot.safeZoneZ || 0);
    radius = snapshot.safeZoneRadius || radius;
  }

  if (!center) {
    console.warn("[Manhunt] safeZoneEntity missing; server will make final start decision.");
    return true;
  }

  return pos.distance(center) <= radius;
};

ManhuntManager.prototype._createSideHud = function () {
  var root = document.createElement("div");
  root.setAttribute("aria-label", "Manhunt status");
  root.style.position = "fixed";
  root.style.right = "18px";
  root.style.top = "18px";
  root.style.left = "unset";
  root.style.width = "310px";
  root.style.zIndex = "9050";
  root.style.padding = "14px 16px";
  root.style.borderRadius = "18px";
  root.style.background = "rgba(8, 16, 30, 0.88)";
  root.style.border = "2px solid rgba(122, 211, 255, 0.9)";
  root.style.color = "#ffffff";
  root.style.font = "700 14px/1.35 Arial, sans-serif";
  root.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.35)";
  root.style.pointerEvents = "none";
  document.body.appendChild(root);
  return root;
};

ManhuntManager.prototype._createCenterOverlay = function () {
  var root = document.createElement("div");
  root.setAttribute("aria-live", "polite");
  root.style.position = "fixed";
  root.style.left = "50%";
  root.style.top = "50%";
  root.style.transform = "translate(-50%, -50%)";
  root.style.zIndex = "9100";
  root.style.maxWidth = "min(720px, calc(100vw - 48px))";
  root.style.padding = "26px 30px";
  root.style.borderRadius = "24px";
  root.style.background = "rgba(5, 12, 24, 0.93)";
  root.style.border = "3px solid #ffd166";
  root.style.boxShadow = "0 18px 60px rgba(0, 0, 0, 0.55)";
  root.style.color = "#ffffff";
  root.style.font = "800 22px/1.3 Arial, sans-serif";
  root.style.textAlign = "center";
  root.style.textShadow = "0 2px 4px rgba(0, 0, 0, 0.85)";
  root.style.pointerEvents = "none";
  root.style.display = "none";
  document.body.appendChild(root);
  return root;
};

ManhuntManager.prototype._renderUi = function () {
  this._renderSideHud();
  this._renderCenterOverlay();
};

ManhuntManager.prototype._renderSideHud = function () {
  if (!this._hudRoot) return;

  var snapshot = this.getSnapshot();
  var local = snapshot.localPlayer;
  var team = local ? this._formatTeam(local.manhuntTeam) : "Unassigned";
  var points = local ? local.manhuntPoints || 0 : 0;
  var objective = this._getObjectiveText(snapshot.state, local);
  var badgeColor = local && local.manhuntTeam === "seeker" ? "#ff7a7a" : "#7cff8a";
  var timerLabel = snapshot.state === "lobby" ? "--" : snapshot.timerSeconds + "s";

  this._hudRoot.innerHTML = "" +
    "<div style='font-size:22px;margin-bottom:8px;color:#7ad3ff;'>Manhunt</div>" +
    "<div>Phase: " + ManhuntManager.escapeHtml(this._formatPhase(snapshot.state)) + "</div>" +
    "<div style='margin:10px 0 6px;padding:8px;border-radius:12px;background:rgba(255,255,255,0.08);font-size:26px;color:" + badgeColor + ";text-align:center;'>" + ManhuntManager.escapeHtml(team.toUpperCase()) + "</div>" +
    "<div>Timer: " + ManhuntManager.escapeHtml(timerLabel) + "</div>" +
    "<div>Hiders safe/tagged: " + snapshot.hidersSafe + "/" + snapshot.hidersTagged + " of " + snapshot.hiderTotal + "</div>" +
    "<div>Points: " + points + "</div>" +
    "<div style='margin-top:8px;color:#ffd166;'>Objective</div>" +
    "<div style='font-weight:800;'>" + ManhuntManager.escapeHtml(objective) + "</div>" +
    "<div style='margin-top:8px;font-weight:700;'>" + ManhuntManager.escapeHtml(snapshot.message) + "</div>";
};

ManhuntManager.prototype._renderCenterOverlay = function () {
  if (!this._overlayRoot) return;

  var html = this._getCenterOverlayHtml();
  if (!html) {
    this._overlayRoot.style.display = "none";
    this._overlayRoot.innerHTML = "";
    return;
  }

  this._overlayRoot.style.display = "block";
  this._overlayRoot.innerHTML = html;
};

ManhuntManager.prototype._getCenterOverlayHtml = function () {
  if (this._feedbackText) {
    return "<div style='font-size:44px;color:#ffd166;'>" + ManhuntManager.escapeHtml(this._feedbackText) + "</div>";
  }

  var snapshot = this.getSnapshot();
  var local = snapshot.localPlayer;
  if ((snapshot.state === "countdown" || snapshot.state === "hidingPhase" || snapshot.state === "seekingPhase") && local) {
    var isHider = local.manhuntTeam === "hider";
    var title = isHider ? "YOU ARE A HIDER" : "YOU ARE THE SEEKER";
    var instruction = this._getObjectiveText(snapshot.state, local);
    var phaseLine = "";
    if (snapshot.state === "countdown") phaseLine = "Round starts in " + Math.max(1, snapshot.timerSeconds);
    if (snapshot.state === "hidingPhase") phaseLine = isHider ? "STAY HIDDEN" : "WAIT FOR RELEASE";
    if (snapshot.state === "seekingPhase") phaseLine = isHider ? "SNEAK HOME" : "SEEKERS RELEASED!";

    return "" +
      "<div style='font-size:48px;color:" + (isHider ? "#7CFF8A" : "#FF7A7A") + ";letter-spacing:1px;'>" + title + "</div>" +
      "<div style='font-size:24px;margin-top:10px;'>" + ManhuntManager.escapeHtml(instruction) + "</div>" +
      "<div style='font-size:36px;margin-top:20px;color:#ffd166;'>" + ManhuntManager.escapeHtml(phaseLine) + "</div>";
  }

  if (snapshot.state === "roundOver") {
    return this._getResultsHtml(snapshot);
  }

  return "";
};

ManhuntManager.prototype._getResultsHtml = function (snapshot) {
  var rows = snapshot.results.map(function (player) {
    var status = player.manhuntTeam === "hider" ? (player.manhuntStatus === "safe" ? "Safe" : (player.manhuntStatus === "tagged" ? "Tagged" : "Survived")) : "Seeker";
    return "<tr>" +
      "<td style='text-align:left;padding:5px 10px;'>" + ManhuntManager.escapeHtml(this._getPlayerDisplayName(player.sessionId)) + "</td>" +
      "<td style='padding:5px 10px;'>" + ManhuntManager.escapeHtml(this._formatTeam(player.manhuntTeam)) + "</td>" +
      "<td style='padding:5px 10px;'>" + ManhuntManager.escapeHtml(status) + "</td>" +
      "<td style='padding:5px 10px;'>" + (player.manhuntPoints || 0) + " pts</td>" +
    "</tr>";
  }, this).join("");

  return "" +
    "<div style='font-size:48px;color:#ffd166;'>ROUND OVER</div>" +
    "<div style='font-size:20px;margin:6px 0 16px;'>" + ManhuntManager.escapeHtml(snapshot.message) + "</div>" +
    "<table style='width:100%;border-collapse:collapse;font-size:18px;'>" + rows + "</table>" +
    "<div style='font-size:18px;margin-top:16px;'>Returning to free roam in " + Math.max(1, snapshot.timerSeconds) + "...</div>";
};

ManhuntManager.prototype._getObjectiveText = function (state, local) {
  if (state === "lobby") return "Go to Home Base and press M to start Manhunt.";
  if (!local || local.manhuntTeam === "none") return "Wait for teams.";
  if (state === "countdown") return local.manhuntTeam === "hider" ? "Get ready. Stay hidden, use cover, and sneak back to Home Base." : "Get ready. Watch for movement and prepare to hunt.";
  if (state === "hidingPhase") return local.manhuntTeam === "hider" ? "Stay out of sight. Sneak back to Home Base." : "Wait for release. Hiders are hiding and moving toward Home Base.";
  if (state === "seekingPhase") {
    if (local.manhuntTeam === "hider") {
      if (local.manhuntStatus === "safe") return "You made it Home. Stay safe and cheer on the others.";
      if (local.manhuntStatus === "tagged") return "You were tagged. Cheer on the others.";
      return "Avoid the seeker. Reach Home Base without getting tagged.";
    }
    return "Find hiders and press E to tag them.";
  }
  return "Read the results, then get ready for the next round.";
};

ManhuntManager.prototype._playersToResults = function (players) {
  var results = [];
  for (var sessionId in players) {
    if (Object.prototype.hasOwnProperty.call(players, sessionId)) {
      var player = players[sessionId];
      if (player.manhuntTeam && player.manhuntTeam !== "none") {
        results.push(player);
      }
    }
  }
  results.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
  return results;
};

ManhuntManager.prototype._getPlayersByTeam = function (players, team) {
  var list = [];
  for (var sessionId in players) {
    if (Object.prototype.hasOwnProperty.call(players, sessionId) && players[sessionId].manhuntTeam === team) {
      list.push(players[sessionId]);
    }
  }
  return list;
};

ManhuntManager.prototype._countHidersByStatus = function (hiders, status) {
  var count = 0;
  for (var i = 0; i < hiders.length; i++) {
    if (hiders[i].manhuntStatus === status) count += 1;
  }
  return count;
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

ManhuntManager.prototype._formatPhase = function (state) {
  return { lobby: "Free Roam", countdown: "Team Reveal", hidingPhase: "Hider Head Start", seekingPhase: "Seekers Released", roundOver: "Round Over" }[state] || state;
};

ManhuntManager.prototype._formatTeam = function (team) {
  if (team === "hider") return "Hider";
  if (team === "seeker") return "Seeker";
  return "Unassigned";
};

ManhuntManager.prototype._showFeedback = function (text, seconds) {
  this._feedbackText = text;
  this._feedbackTimeRemaining = seconds || 2;
  this._renderUi();
};

ManhuntManager.prototype._resolveScript = function (entity, scriptName) {
  return entity && entity.script && entity.script[scriptName] ? entity.script[scriptName] : null;
};

ManhuntManager.prototype._validateSetup = function () {
  if (!this.networkClient) console.warn("[Manhunt] networkManagerEntity is missing ArcadeNetworkClient.");
  if (!this.safeZoneEntity) console.warn("[Manhunt] safeZoneEntity is missing; client-side start check will defer to server.");
};

ManhuntManager.prototype._onDestroy = function () {
  if (this._hudRoot && this._hudRoot.parentNode) this._hudRoot.parentNode.removeChild(this._hudRoot);
  if (this._overlayRoot && this._overlayRoot.parentNode) this._overlayRoot.parentNode.removeChild(this._overlayRoot);
};

ManhuntManager.escapeHtml = function (value) {
  return String(value).replace(/[&<>'"]/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[character];
  });
};
