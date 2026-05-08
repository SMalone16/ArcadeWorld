/* global pc, document */

var ManhuntManager = pc.createScript("manhuntManager");

ManhuntManager.attributes.add("networkManagerEntity", {
  type: "entity",
  title: "Network Manager Entity"
});

ManhuntManager.attributes.add("remotePlayerManagerEntity", {
  type: "entity",
  title: "Remote Player Manager Entity"
});

ManhuntManager.attributes.add("localPlayerEntity", {
  type: "entity",
  title: "Local Player Entity"
});

ManhuntManager.attributes.add("lobbySpawn", {
  type: "entity",
  title: "Lobby Spawn"
});

ManhuntManager.attributes.add("hiderStart", {
  type: "entity",
  title: "Hider Start"
});

ManhuntManager.attributes.add("seekerStart", {
  type: "entity",
  title: "Seeker Start"
});

ManhuntManager.attributes.add("safeZoneEntity", {
  type: "entity",
  title: "Safe Zone Entity"
});

ManhuntManager.attributes.add("safeZoneRadius", {
  type: "number",
  default: 2.6,
  min: 0,
  title: "Safe Zone Radius"
});

ManhuntManager.attributes.add("countdownSeconds", {
  type: "number",
  default: 5,
  min: 0,
  title: "Countdown Seconds"
});

ManhuntManager.attributes.add("hidingPhaseSeconds", {
  type: "number",
  default: 10,
  min: 0,
  title: "Hiding Phase Seconds"
});

ManhuntManager.attributes.add("seekingPhaseSeconds", {
  type: "number",
  default: 90,
  min: 0,
  title: "Seeking Phase Seconds"
});

ManhuntManager.attributes.add("resultsSeconds", {
  type: "number",
  default: 10,
  min: 0,
  title: "Results Seconds"
});

ManhuntManager.attributes.add("tagDistance", {
  type: "number",
  default: 2.2,
  min: 0,
  title: "Tag Distance"
});

ManhuntManager.prototype.initialize = function () {
  this.players = {};
  this.state = "lobby";
  this.stateTimeRemaining = 0;
  this.roundElapsed = 0;
  this.results = [];
  this.message = "Press M to start Manhunt.";
  this.hasAwardedEndOfRoundPoints = false;

  this.networkClient = this._resolveScript(this.networkManagerEntity, "arcadeNetworkClient");
  this.remotePlayerManager = this._resolveScript(this.remotePlayerManagerEntity, "remotePlayerManager");
  this._scratchPosition = new pc.Vec3();
  this._hudRoot = this._createHud();

  this._validateSetup();
  this._renderHud();
  this.on("destroy", this._onDestroy, this);
};

ManhuntManager.prototype.update = function (dt) {
  this._checkStartOrResetInput();

  if (this.state === "lobby") {
    this._renderHud();
    return;
  }

  this.stateTimeRemaining = Math.max(0, this.stateTimeRemaining - dt);

  if (this.state === "seekingPhase") {
    this.roundElapsed += dt;
    this._checkSafeZoneEntries();
    this._checkTagInput();
    this._endRoundIfComplete();
  }

  if (this.stateTimeRemaining <= 0) {
    this._advanceStateFromTimer();
  }

  this._renderHud();
};

ManhuntManager.prototype.startRound = function () {
  if (this.state !== "lobby" && this.state !== "roundOver") {
    console.warn("[Manhunt] start blocked: round already running in state " + this.state);
    return;
  }

  var playerIds = this._getPlayerIds();
  if (playerIds.length < 2) {
    this.message = "Need at least 2 players to start Manhunt.";
    console.warn("[Manhunt] start blocked: need at least 2 players");
    this._renderHud();
    return;
  }

  this.players = {};
  this.results = [];
  this.hasAwardedEndOfRoundPoints = false;

  // Sorting keeps the client-only vertical slice deterministic across each browser.
  playerIds.sort();
  var seekerId = playerIds[0];
  for (var i = 0; i < playerIds.length; i++) {
    var playerId = playerIds[i];
    var team = playerId === seekerId ? "seeker" : "hider";
    this.players[playerId] = {
      playerId: playerId,
      team: team,
      isTagged: false,
      isSafe: false,
      roundPoints: 0
    };
    console.log("[Manhunt] team assignment: " + playerId + " -> " + team);
  }

  this._teleportTeamsToStarts();
  this._setState("countdown", this.countdownSeconds, "Manhunt starts soon! Hiders, get ready.");
};

ManhuntManager.prototype.resetToLobby = function () {
  this._teleportAll(this.lobbySpawn);
  this.players = {};
  this.results = [];
  this.hasAwardedEndOfRoundPoints = false;
  this._setState("lobby", 0, "Press M to start Manhunt.");
};

ManhuntManager.prototype.getSnapshot = function () {
  var localPlayer = this.players[this._getLocalPlayerId()];
  var hiders = this._getHiders();
  return {
    state: this.state,
    localPlayer: localPlayer ? this._copyPlayerState(localPlayer) : null,
    timerSeconds: Math.max(0, Math.ceil(this.stateTimeRemaining)),
    hidersSafe: this._countHidersByFlag("isSafe"),
    hidersTagged: this._countHidersByFlag("isTagged"),
    hiderTotal: hiders.length,
    results: this.results.map(this._copyPlayerState),
    message: this.message
  };
};

ManhuntManager.prototype._checkStartOrResetInput = function () {
  if (!this.app.keyboard || !this.app.keyboard.wasPressed(pc.KEY_M)) {
    return;
  }

  if (this.state === "roundOver") {
    this.resetToLobby();
    return;
  }

  if (this.state === "lobby") {
    this.startRound();
  }
};

ManhuntManager.prototype._advanceStateFromTimer = function () {
  if (this.state === "countdown") {
    this.setStateForHidingPhase();
    return;
  }

  if (this.state === "hidingPhase") {
    this.roundElapsed = 0;
    this._setState("seekingPhase", this.seekingPhaseSeconds, "Seekers released! Tag hiders with E.");
    this._releaseSeekers();
    return;
  }

  if (this.state === "seekingPhase") {
    this._finishRound("Time is up!");
  }
};

ManhuntManager.prototype.setStateForHidingPhase = function () {
  this._setState("hidingPhase", this.hidingPhaseSeconds, "Hiders released! Seekers wait for the head start.");
  this._releaseHidersOnly();
};

ManhuntManager.prototype._setState = function (nextState, durationSeconds, message) {
  this.state = nextState;
  this.stateTimeRemaining = durationSeconds;
  this.message = message;
  console.log("[Manhunt] state changed -> " + nextState + " (" + durationSeconds + "s): " + message);
};

ManhuntManager.prototype._teleportTeamsToStarts = function () {
  var ids = Object.keys(this.players);
  for (var i = 0; i < ids.length; i++) {
    var player = this.players[ids[i]];
    var spawn = player.team === "seeker" ? this.seekerStart : this.hiderStart;
    this._teleportPlayer(player.playerId, spawn);
  }
};

ManhuntManager.prototype._releaseHidersOnly = function () {
  var seekers = this._getSeekers();
  for (var i = 0; i < seekers.length; i++) {
    this._teleportPlayer(seekers[i].playerId, this.seekerStart);
  }
};

ManhuntManager.prototype._releaseSeekers = function () {
  var seekers = this._getSeekers();
  for (var i = 0; i < seekers.length; i++) {
    this._teleportPlayer(seekers[i].playerId, this.seekerStart);
  }
};

ManhuntManager.prototype._teleportAll = function (spawnEntity) {
  var ids = this._getPlayerIds();
  for (var i = 0; i < ids.length; i++) {
    this._teleportPlayer(ids[i], spawnEntity, i * 1.5);
  }
};

ManhuntManager.prototype._teleportPlayer = function (playerId, spawnEntity, xOffset) {
  var entity = this._getPlayerEntity(playerId);
  if (!entity || !spawnEntity) {
    return;
  }

  var position = spawnEntity.getPosition().clone();
  position.x += xOffset || 0;
  entity.setPosition(position);
  entity.setEulerAngles(spawnEntity.getEulerAngles());
};

ManhuntManager.prototype._checkSafeZoneEntries = function () {
  if (!this.safeZoneEntity) {
    return;
  }

  var safeZoneCenter = this.safeZoneEntity.getPosition();
  var hiders = this._getHiders();
  for (var i = 0; i < hiders.length; i++) {
    var hider = hiders[i];
    if (hider.isTagged || hider.isSafe) {
      continue;
    }

    var entity = this._getPlayerEntity(hider.playerId);
    if (!entity) {
      continue;
    }

    var distance = entity.getPosition().distance(safeZoneCenter);
    if (distance > this.safeZoneRadius) {
      continue;
    }

    hider.isSafe = true;
    hider.roundPoints += 3;
    console.log("[Manhunt] safe zone entry: " + hider.playerId + " +3");
    console.log("[Manhunt] scoring: " + hider.playerId + " now has " + hider.roundPoints);
  }
};

ManhuntManager.prototype._checkTagInput = function () {
  if (!this.app.keyboard || !this.app.keyboard.wasPressed(pc.KEY_E)) {
    return;
  }

  var localState = this.players[this._getLocalPlayerId()];
  if (!localState || localState.team !== "seeker") {
    return;
  }

  var seekerEntity = this._getPlayerEntity(localState.playerId);
  if (!seekerEntity) {
    return;
  }

  var seekerPosition = seekerEntity.getPosition();
  var closest = null;
  var hiders = this._getHiders();
  for (var i = 0; i < hiders.length; i++) {
    var hider = hiders[i];
    if (hider.isTagged || hider.isSafe) {
      continue;
    }

    var hiderEntity = this._getPlayerEntity(hider.playerId);
    if (!hiderEntity) {
      continue;
    }

    var distance = seekerPosition.distance(hiderEntity.getPosition());
    if (distance <= this.tagDistance && (!closest || distance < closest.distance)) {
      closest = { hider: hider, distance: distance };
    }
  }

  if (!closest) {
    return;
  }

  closest.hider.isTagged = true;
  localState.roundPoints += 3;
  console.log("[Manhunt] tag: " + localState.playerId + " tagged " + closest.hider.playerId);
  console.log("[Manhunt] scoring: " + localState.playerId + " +3 = " + localState.roundPoints);
};

ManhuntManager.prototype._endRoundIfComplete = function () {
  var hiders = this._getHiders();
  for (var i = 0; i < hiders.length; i++) {
    if (!hiders[i].isTagged && !hiders[i].isSafe) {
      return;
    }
  }

  this._finishRound("All hiders are safe or tagged!");
};

ManhuntManager.prototype._finishRound = function (reason) {
  if (this.state === "roundOver") {
    return;
  }

  if (!this.hasAwardedEndOfRoundPoints) {
    this._awardEndOfRoundPoints();
  }

  this.results = this._allPlayerStates().map(this._copyPlayerState);
  this._teleportAll(this.lobbySpawn);
  this._setState("roundOver", this.resultsSeconds, reason + " Results shown below. Press M to reset.");
};

ManhuntManager.prototype._awardEndOfRoundPoints = function () {
  var hiders = this._getHiders();
  var failedHiderCount = 0;
  for (var i = 0; i < hiders.length; i++) {
    if (!hiders[i].isSafe) {
      failedHiderCount += 1;
    }
  }

  for (var h = 0; h < hiders.length; h++) {
    if (!hiders[h].isTagged && !hiders[h].isSafe) {
      hiders[h].roundPoints += 1;
      console.log("[Manhunt] scoring: " + hiders[h].playerId + " survived +1");
    }
  }

  var seekers = this._getSeekers();
  for (var s = 0; s < seekers.length; s++) {
    var points = failedHiderCount;
    seekers[s].roundPoints += points;
    console.log("[Manhunt] scoring: " + seekers[s].playerId + " failed hiders " + failedHiderCount + " +" + points);
  }

  this.hasAwardedEndOfRoundPoints = true;
};

ManhuntManager.prototype._getPlayerIds = function () {
  var players = this._getAllPlayerEntities();
  return Object.keys(players).filter(function (playerId) {
    return !!players[playerId];
  });
};

ManhuntManager.prototype._getLocalPlayerId = function () {
  if (this.networkClient && this.networkClient.getLocalPlayerId) {
    return this.networkClient.getLocalPlayerId();
  }

  return this.networkClient && this.networkClient.sessionId ? this.networkClient.sessionId : "";
};

ManhuntManager.prototype._getPlayerEntity = function (playerId) {
  if (!playerId) {
    return null;
  }

  if (this.networkClient && this.networkClient.getLocalPlayerId && playerId === this.networkClient.getLocalPlayerId()) {
    return this.networkClient.getLocalPlayerEntity ? this.networkClient.getLocalPlayerEntity() : this.localPlayerEntity;
  }

  var remotes = this._getRemotePlayerEntities();
  return remotes[playerId] || null;
};

ManhuntManager.prototype._getAllPlayerEntities = function () {
  var players = {};
  var localId = this._getLocalPlayerId();
  if (localId) {
    players[localId] = this._getLocalPlayerEntity();
  }

  var remotes = this._getRemotePlayerEntities();
  for (var remoteId in remotes) {
    if (Object.prototype.hasOwnProperty.call(remotes, remoteId)) {
      players[remoteId] = remotes[remoteId];
    }
  }

  return players;
};

ManhuntManager.prototype._getLocalPlayerEntity = function () {
  if (this.networkClient && this.networkClient.getLocalPlayerEntity) {
    return this.networkClient.getLocalPlayerEntity();
  }

  return this.localPlayerEntity || null;
};

ManhuntManager.prototype._getRemotePlayerEntities = function () {
  if (this.remotePlayerManager && this.remotePlayerManager.getRemotePlayerEntities) {
    return this.remotePlayerManager.getRemotePlayerEntities();
  }

  return this.remotePlayerManager && this.remotePlayerManager.remoteEntities ? this.remotePlayerManager.remoteEntities : {};
};

ManhuntManager.prototype._getHiders = function () {
  return this._allPlayerStates().filter(function (player) {
    return player.team === "hider";
  });
};

ManhuntManager.prototype._getSeekers = function () {
  return this._allPlayerStates().filter(function (player) {
    return player.team === "seeker";
  });
};

ManhuntManager.prototype._allPlayerStates = function () {
  var ids = Object.keys(this.players);
  var states = [];
  for (var i = 0; i < ids.length; i++) {
    states.push(this.players[ids[i]]);
  }
  return states;
};

ManhuntManager.prototype._countHidersByFlag = function (flagName) {
  var count = 0;
  var hiders = this._getHiders();
  for (var i = 0; i < hiders.length; i++) {
    if (hiders[i][flagName]) {
      count += 1;
    }
  }
  return count;
};

ManhuntManager.prototype._copyPlayerState = function (player) {
  return {
    playerId: player.playerId,
    team: player.team,
    isTagged: player.isTagged,
    isSafe: player.isSafe,
    roundPoints: player.roundPoints
  };
};

ManhuntManager.prototype._resolveScript = function (entity, scriptName) {
  if (!entity || !entity.script || !entity.script[scriptName]) {
    return null;
  }

  return entity.script[scriptName];
};

ManhuntManager.prototype._validateSetup = function () {
  if (!this.networkClient) {
    console.warn("[Manhunt] networkManagerEntity is missing ArcadeNetworkClient.");
  }
  if (!this.remotePlayerManager) {
    console.warn("[Manhunt] remotePlayerManagerEntity is missing RemotePlayerManager; remoteEntities will be unavailable.");
  }
  if (!this.localPlayerEntity && !this._getLocalPlayerEntity()) {
    console.warn("[Manhunt] localPlayerEntity is not configured.");
  }
  if (!this.lobbySpawn || !this.hiderStart || !this.seekerStart) {
    console.warn("[Manhunt] one or more spawn entities are not configured.");
  }
  if (!this.safeZoneEntity) {
    console.warn("[Manhunt] safeZoneEntity is not configured; safe scoring disabled.");
  }
};

ManhuntManager.prototype._createHud = function () {
  var root = document.createElement("div");
  root.setAttribute("aria-label", "Manhunt HUD");
  root.style.position = "fixed";
  root.style.left = "18px";
  root.style.top = "18px";
  root.style.zIndex = "9100";
  root.style.minWidth = "250px";
  root.style.maxWidth = "340px";
  root.style.padding = "12px 14px";
  root.style.borderRadius = "16px";
  root.style.background = "rgba(8, 18, 32, 0.84)";
  root.style.border = "2px solid rgba(122, 211, 255, 0.9)";
  root.style.color = "#ffffff";
  root.style.font = "700 14px/1.35 Arial, sans-serif";
  root.style.textShadow = "0 1px 2px rgba(0, 0, 0, 0.85)";
  root.style.pointerEvents = "none";
  document.body.appendChild(root);
  return root;
};

ManhuntManager.prototype._renderHud = function () {
  if (!this._hudRoot) {
    return;
  }

  var snapshot = this.getSnapshot();
  var team = snapshot.localPlayer ? snapshot.localPlayer.team : "unassigned";
  var resultRows = "";
  if (snapshot.results.length > 0) {
    resultRows = snapshot.results.map(function (player) {
      var status = player.team === "hider" ? (player.isSafe ? "safe" : (player.isTagged ? "tagged" : "survived")) : "seeker";
      return "<li>" + ManhuntManager.escapeHtml(player.playerId) + " - " + player.team + " - " + status + " - " + player.roundPoints + " pts</li>";
    }).join("");
  }

  this._hudRoot.innerHTML = "" +
    "<div style='font-size:18px;margin-bottom:6px;'>Manhunt</div>" +
    "<div>State: " + ManhuntManager.escapeHtml(snapshot.state) + "</div>" +
    "<div>Timer: " + snapshot.timerSeconds + "s</div>" +
    "<div>Your team: " + ManhuntManager.escapeHtml(team) + "</div>" +
    "<div>Hiders safe/tagged: " + snapshot.hidersSafe + "/" + snapshot.hidersTagged + " of " + snapshot.hiderTotal + "</div>" +
    "<div style='margin-top:6px;font-weight:600;'>" + ManhuntManager.escapeHtml(snapshot.message) + "</div>" +
    (resultRows ? "<ol style='margin:8px 0 0 18px;padding:0;font-weight:600;'>" + resultRows + "</ol>" : "");
};

ManhuntManager.prototype._onDestroy = function () {
  if (this._hudRoot && this._hudRoot.parentNode) {
    this._hudRoot.parentNode.removeChild(this._hudRoot);
  }
};

ManhuntManager.escapeHtml = function (value) {
  return String(value).replace(/[&<>'"]/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      "\"": "&quot;"
    }[character];
  });
};
