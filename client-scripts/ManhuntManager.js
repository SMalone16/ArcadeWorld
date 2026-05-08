/* global pc, document, window */

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
  this.message = "Go to Home Base and press M to start Manhunt.";
  this.hasAwardedEndOfRoundPoints = false;
  this.roundId = "";
  this._feedbackText = "";
  this._feedbackTimeRemaining = 0;

  this.networkClient = this._resolveScript(this.networkManagerEntity, "arcadeNetworkClient");
  this.remotePlayerManager = this._resolveScript(this.remotePlayerManagerEntity, "remotePlayerManager");
  this._scratchPosition = new pc.Vec3();
  this._hudRoot = this._createSideHud();
  this._overlayRoot = this._createCenterOverlay();

  this._validateSetup();
  this._bindNetworkEvents();
  this._logPlayerDebug("initialize");
  this._renderUi();
  this.on("destroy", this._onDestroy, this);
};

ManhuntManager.prototype.update = function (dt) {
  this._checkStartInput();

  if (this._feedbackTimeRemaining > 0) {
    this._feedbackTimeRemaining = Math.max(0, this._feedbackTimeRemaining - dt);
    if (this._feedbackTimeRemaining === 0) {
      this._feedbackText = "";
    }
  }

  if (this.state === "lobby") {
    this._renderUi();
    return;
  }

  this.stateTimeRemaining = Math.max(0, this.stateTimeRemaining - dt);

  if (this.state === "hidingPhase") {
    this._holdLocalSeekerAtStart();
  }

  if (this.state === "seekingPhase") {
    this.roundElapsed += dt;
    this._checkLocalSafeZoneEntry();
    this._checkTagInput();
    this._endRoundIfComplete();
  }

  if (this.stateTimeRemaining <= 0) {
    this._advanceStateFromTimer();
  }

  this._renderUi();
};

ManhuntManager.prototype.startRound = function () {
  if (!this._canStartFromCurrentState()) {
    return;
  }

  if (!this._isLocalPlayerInSafeZone()) {
    this.message = "Go to Home Base to start Manhunt.";
    this._showFeedback("Go to Home Base to start Manhunt.", 2.5);
    console.warn("[Manhunt] start blocked: local player is outside Home Base safe zone");
    this._renderUi();
    return;
  }

  var playerIds = this._getPlayerIds();
  if (playerIds.length < 2) {
    this.message = "Need at least 2 players to start Manhunt.";
    this._showFeedback("Need at least 2 players to start Manhunt.", 2.5);
    console.warn("[Manhunt] start blocked: need at least 2 players");
    this._renderUi();
    return;
  }

  playerIds.sort();
  var roundId = (this._getLocalPlayerId() || "local") + "-" + Date.now();
  var payload = {
    type: "startRound",
    roundId: roundId,
    playerIds: playerIds,
    seekerId: playerIds[0],
    starterId: this._getLocalPlayerId()
  };

  if (this._sendManhuntEvent(payload)) {
    console.log("[Manhunt] start requested by " + this._getPlayerDisplayName(payload.starterId) + " for " + playerIds.length + " players");
    return;
  }

  this._startRoundFromPayload(payload);
};

ManhuntManager.prototype.resetToLobby = function () {
  this._teleportAll(this.lobbySpawn);
  this.players = {};
  this.results = [];
  this.hasAwardedEndOfRoundPoints = false;
  this.roundId = "";
  this._setState("lobby", 0, "Go to Home Base and press M to start Manhunt.");
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

ManhuntManager.prototype._bindNetworkEvents = function () {
  if (!this.networkClient || !this.networkClient.onManhuntEvent) {
    console.warn("[Manhunt] ArcadeNetworkClient manhunt events unavailable; only this browser will run the round.");
    return;
  }

  this.networkClient.onManhuntEvent(this._onManhuntEvent.bind(this));
};

ManhuntManager.prototype._onManhuntEvent = function (payload) {
  if (!payload || !payload.type) {
    return;
  }

  if (payload.type === "startRound") {
    this._startRoundFromPayload(payload);
    return;
  }

  if (payload.roundId && this.roundId && payload.roundId !== this.roundId) {
    console.warn("[Manhunt] ignored stale event for round " + payload.roundId + " while in " + this.roundId);
    return;
  }

  if (payload.type === "hiderSafe") {
    this._markHiderSafe(payload.hiderId, true);
    return;
  }

  if (payload.type === "tagHider") {
    this._markHiderTagged(payload.hiderId, payload.seekerId, true);
  }
};

ManhuntManager.prototype._sendManhuntEvent = function (payload) {
  if (!this.networkClient || !this.networkClient.sendManhuntEvent) {
    return false;
  }

  return this.networkClient.sendManhuntEvent(payload);
};

ManhuntManager.prototype._canStartFromCurrentState = function () {
  if (this.state !== "lobby") {
    console.warn("[Manhunt] start blocked: round already running in state " + this.state);
    return false;
  }

  return true;
};

ManhuntManager.prototype._startRoundFromPayload = function (payload) {
  if (!payload || !payload.roundId || !payload.playerIds || payload.playerIds.length < 2) {
    console.warn("[Manhunt] ignored invalid start payload", payload);
    return;
  }

  if (this.roundId === payload.roundId) {
    return;
  }

  if (this.state !== "lobby") {
    console.warn("[Manhunt] ignored start event while in state " + this.state);
    return;
  }

  this.players = {};
  this.results = [];
  this.hasAwardedEndOfRoundPoints = false;
  this.roundElapsed = 0;
  this.roundId = payload.roundId;

  var playerIds = payload.playerIds.slice(0).sort();
  var seekerId = payload.seekerId || playerIds[0];
  console.log("[Manhunt] players seen: " + playerIds.map(this._getPlayerDisplayName.bind(this)).join(", "));
  console.log("[Manhunt] local player: " + this._getLocalPlayerDisplayName() + " (" + this._shortId(this._getLocalPlayerId()) + ")");
  console.log("[Manhunt] remote count: " + this._getRemotePlayerCount());

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
    console.log("[Manhunt] team assignment: " + this._getPlayerDisplayName(playerId) + " -> " + team);
  }

  this._teleportTeamsToStarts();
  this._setState("countdown", this.countdownSeconds, "Round starts in " + Math.ceil(this.countdownSeconds) + ".");
};

ManhuntManager.prototype._checkStartInput = function () {
  if (!this.app.keyboard || !this.app.keyboard.wasPressed(pc.KEY_M)) {
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
    return;
  }

  if (this.state === "roundOver") {
    this.resetToLobby();
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

ManhuntManager.prototype._holdLocalSeekerAtStart = function () {
  var localState = this.players[this._getLocalPlayerId()];
  if (localState && localState.team === "seeker") {
    this._teleportPlayer(localState.playerId, this.seekerStart);
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

  if (playerId === this._getLocalPlayerId()) {
    this._sendLocalMoveNow();
  }
};

ManhuntManager.prototype._sendLocalMoveNow = function () {
  var entity = this._getLocalPlayerEntity();
  if (!entity || !this.networkClient || !this.networkClient.sendMove) {
    return;
  }

  this.networkClient.sendMove(entity.getPosition(), entity.getEulerAngles().y, this._getLocalPlayerDisplayName());
};

ManhuntManager.prototype._checkLocalSafeZoneEntry = function () {
  var localId = this._getLocalPlayerId();
  var hider = this.players[localId];
  if (!hider || hider.team !== "hider" || hider.isTagged || hider.isSafe) {
    return;
  }

  if (!this._isPlayerInSafeZone(localId)) {
    return;
  }

  if (!this._sendManhuntEvent({ type: "hiderSafe", roundId: this.roundId, hiderId: localId })) {
    this._markHiderSafe(localId, false);
  }
};

ManhuntManager.prototype._markHiderSafe = function (hiderId, fromNetwork) {
  var hider = this.players[hiderId];
  if (!hider || hider.team !== "hider" || hider.isTagged || hider.isSafe) {
    return;
  }

  hider.isSafe = true;
  hider.roundPoints += 3;
  var name = this._getPlayerDisplayName(hiderId);
  console.log("[Manhunt] safe zone entry: " + name + " +3" + (fromNetwork ? " (network)" : ""));
  console.log("[Manhunt] scoring: " + name + " now has " + hider.roundPoints);

  if (hiderId === this._getLocalPlayerId()) {
    this._showFeedback("You made it home! +3", 3);
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
    this._showFeedback("No active hider is close enough to tag.", 1.5);
    return;
  }

  if (!this._sendManhuntEvent({
    type: "tagHider",
    roundId: this.roundId,
    seekerId: localState.playerId,
    hiderId: closest.hider.playerId
  })) {
    this._markHiderTagged(closest.hider.playerId, localState.playerId, false);
  }
};

ManhuntManager.prototype._markHiderTagged = function (hiderId, seekerId, fromNetwork) {
  var hider = this.players[hiderId];
  var seeker = this.players[seekerId];
  if (!hider || !seeker || hider.team !== "hider" || seeker.team !== "seeker" || hider.isTagged || hider.isSafe) {
    return;
  }

  hider.isTagged = true;
  seeker.roundPoints += 3;
  console.log("[Manhunt] tag: " + this._getPlayerDisplayName(seekerId) + " tagged " + this._getPlayerDisplayName(hiderId) + (fromNetwork ? " (network)" : ""));
  console.log("[Manhunt] scoring: " + this._getPlayerDisplayName(seekerId) + " +3 = " + seeker.roundPoints);

  if (seekerId === this._getLocalPlayerId()) {
    this._showFeedback("Tagged " + this._getPlayerDisplayName(hiderId) + "! +3", 3);
  } else if (hiderId === this._getLocalPlayerId()) {
    this._showFeedback("You were tagged!", 3);
  }
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
  this._setState("roundOver", this.resultsSeconds, reason);
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
      console.log("[Manhunt] scoring: " + this._getPlayerDisplayName(hiders[h].playerId) + " survived +1");
    }
  }

  var seekers = this._getSeekers();
  for (var s = 0; s < seekers.length; s++) {
    var points = failedHiderCount;
    seekers[s].roundPoints += points;
    console.log("[Manhunt] scoring: " + this._getPlayerDisplayName(seekers[s].playerId) + " failed hiders " + failedHiderCount + " +" + points);
  }

  this.hasAwardedEndOfRoundPoints = true;
};

ManhuntManager.prototype._isLocalPlayerInSafeZone = function () {
  if (!this.safeZoneEntity) {
    console.warn("[Manhunt] safeZoneEntity missing; allowing start for debugging only.");
    return true;
  }

  return this._isPlayerInSafeZone(this._getLocalPlayerId());
};

ManhuntManager.prototype._isPlayerInSafeZone = function (playerId) {
  if (!this.safeZoneEntity) {
    return false;
  }

  var entity = this._getPlayerEntity(playerId);
  if (!entity) {
    return false;
  }

  return entity.getPosition().distance(this.safeZoneEntity.getPosition()) <= this.safeZoneRadius;
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

ManhuntManager.prototype._getRemotePlayerCount = function () {
  if (this.remotePlayerManager && this.remotePlayerManager.getVisibleRemoteCount) {
    return this.remotePlayerManager.getVisibleRemoteCount();
  }

  if (this.networkClient && this.networkClient.getRemotePlayerCount) {
    return this.networkClient.getRemotePlayerCount();
  }

  return Object.keys(this._getRemotePlayerEntities()).length;
};

ManhuntManager.prototype._getPlayerDisplayName = function (playerId) {
  if (!playerId) {
    return "Student";
  }

  if (playerId === this._getLocalPlayerId()) {
    return this._getLocalPlayerDisplayName();
  }

  var profile = this.remotePlayerManager && this.remotePlayerManager.remoteProfiles ? this.remotePlayerManager.remoteProfiles[playerId] : null;
  if (profile && profile.name) {
    return profile.name;
  }

  var entity = this._getPlayerEntity(playerId);
  if (entity && entity.name && entity.name.indexOf("Remote_") !== 0) {
    return entity.name;
  }

  return "Player " + this._shortId(playerId);
};

ManhuntManager.prototype._getLocalPlayerDisplayName = function () {
  var profile = null;
  if (this.networkClient && this.networkClient.getLocalPlayerProfile) {
    profile = this.networkClient.getLocalPlayerProfile();
  } else if (this.networkClient && this.networkClient.selectedProfile) {
    profile = this.networkClient.selectedProfile;
  } else if (this.app && this.app.arcadePlayerProfile) {
    profile = this.app.arcadePlayerProfile;
  } else if (typeof window !== "undefined" && window.ArcadePlayerProfile) {
    profile = window.ArcadePlayerProfile;
  }

  return profile && profile.name ? profile.name : "You";
};

ManhuntManager.prototype._shortId = function (playerId) {
  return String(playerId || "????").slice(0, 4);
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
    console.warn("[Manhunt] safeZoneEntity is not configured; start gating falls back to debug-only allow and safe scoring is disabled.");
  }
};

ManhuntManager.prototype._createSideHud = function () {
  var root = document.createElement("div");
  root.setAttribute("aria-label", "Manhunt status HUD");
  root.style.position = "fixed";
  root.style.right = "18px";
  root.style.top = "18px";
  root.style.zIndex = "9100";
  root.style.minWidth = "270px";
  root.style.maxWidth = "360px";
  root.style.padding = "14px 16px";
  root.style.borderRadius = "18px";
  root.style.background = "rgba(8, 18, 32, 0.88)";
  root.style.border = "2px solid rgba(122, 211, 255, 0.9)";
  root.style.boxShadow = "0 12px 32px rgba(0, 0, 0, 0.35)";
  root.style.color = "#ffffff";
  root.style.font = "700 14px/1.35 Arial, sans-serif";
  root.style.textShadow = "0 1px 2px rgba(0, 0, 0, 0.85)";
  root.style.pointerEvents = "none";
  document.body.appendChild(root);
  return root;
};

ManhuntManager.prototype._createCenterOverlay = function () {
  var root = document.createElement("div");
  root.setAttribute("aria-label", "Manhunt major message");
  root.style.position = "fixed";
  root.style.left = "50%";
  root.style.top = "50%";
  root.style.transform = "translate(-50%, -50%)";
  root.style.zIndex = "9300";
  root.style.width = "min(720px, calc(100vw - 48px))";
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
  if (!this._hudRoot) {
    return;
  }

  var snapshot = this.getSnapshot();
  var local = snapshot.localPlayer;
  var team = local ? this._formatTeam(local.team) : "Gathering players";
  var objective = this._getObjectiveText(local);
  var phase = this._formatPhase(snapshot.state);
  var timerLabel = snapshot.state === "lobby" ? "--" : snapshot.timerSeconds + "s";

  this._hudRoot.innerHTML = "" +
    "<div style='font-size:22px;margin-bottom:8px;color:#7ad3ff;'>Manhunt</div>" +
    "<div>Phase: " + ManhuntManager.escapeHtml(phase) + "</div>" +
    "<div>Team: " + ManhuntManager.escapeHtml(team) + "</div>" +
    "<div>Timer: " + ManhuntManager.escapeHtml(timerLabel) + "</div>" +
    "<div>Hiders safe/tagged: " + snapshot.hidersSafe + "/" + snapshot.hidersTagged + " of " + snapshot.hiderTotal + "</div>" +
    "<div style='margin-top:8px;color:#ffd166;'>Objective</div>" +
    "<div style='font-weight:800;'>" + ManhuntManager.escapeHtml(objective) + "</div>" +
    "<div style='margin-top:8px;font-weight:700;'>" + ManhuntManager.escapeHtml(snapshot.message) + "</div>";
};

ManhuntManager.prototype._renderCenterOverlay = function () {
  if (!this._overlayRoot) {
    return;
  }

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

  var local = this.players[this._getLocalPlayerId()];
  if (this.state === "countdown" && local) {
    var isHider = local.team === "hider";
    var title = isHider ? "YOU ARE A HIDER" : "YOU ARE THE SEEKER";
    var instruction = isHider ? "Run to Home Base without getting tagged." : "Wait for the head start, then tag hiders with E.";
    return "" +
      "<div style='font-size:48px;color:" + (isHider ? "#7CFF8A" : "#FF7A7A") + ";letter-spacing:1px;'>" + title + "</div>" +
      "<div style='font-size:24px;margin-top:10px;'>" + ManhuntManager.escapeHtml(instruction) + "</div>" +
      "<div style='font-size:36px;margin-top:20px;color:#ffd166;'>Round starts in " + Math.max(1, Math.ceil(this.stateTimeRemaining)) + "</div>";
  }

  if (this.state === "roundOver") {
    return this._getResultsHtml();
  }

  return "";
};

ManhuntManager.prototype._getResultsHtml = function () {
  var rows = this.results.map(function (player) {
    var status = player.team === "hider" ? (player.isSafe ? "Safe" : (player.isTagged ? "Tagged" : "Survived")) : "Seeker";
    return "<tr>" +
      "<td style='text-align:left;padding:5px 10px;'>" + ManhuntManager.escapeHtml(this._getPlayerDisplayName(player.playerId)) + "</td>" +
      "<td style='padding:5px 10px;'>" + ManhuntManager.escapeHtml(this._formatTeam(player.team)) + "</td>" +
      "<td style='padding:5px 10px;'>" + ManhuntManager.escapeHtml(status) + "</td>" +
      "<td style='padding:5px 10px;'>" + player.roundPoints + " pts</td>" +
    "</tr>";
  }, this).join("");

  return "" +
    "<div style='font-size:48px;color:#ffd166;'>Round Over</div>" +
    "<div style='font-size:20px;margin:6px 0 16px;'>" + ManhuntManager.escapeHtml(this.message) + "</div>" +
    "<table style='width:100%;border-collapse:collapse;font-size:18px;'>" + rows + "</table>" +
    "<div style='font-size:18px;margin-top:16px;'>Returning to free roam in " + Math.max(1, Math.ceil(this.stateTimeRemaining)) + "...</div>";
};

ManhuntManager.prototype._getObjectiveText = function (local) {
  if (this.state === "lobby") {
    return "Go to Home Base and press M to start Manhunt.";
  }

  if (!local) {
    return "Wait for teams.";
  }

  if (this.state === "countdown") {
    return local.team === "hider" ? "Get ready to run home." : "Get ready to wait for release.";
  }

  if (this.state === "hidingPhase") {
    return local.team === "hider" ? "Run to Home Base!" : "Wait for release.";
  }

  if (this.state === "seekingPhase") {
    if (local.team === "hider") {
      if (local.isSafe) return "You are safe at Home Base.";
      if (local.isTagged) return "You were tagged. Cheer on the others!";
      return "Reach Home Base without getting tagged.";
    }
    return "Tag hiders with E.";
  }

  return "Read the results, then get ready for the next round.";
};

ManhuntManager.prototype._formatPhase = function (state) {
  return {
    lobby: "Free Roam",
    countdown: "Team Reveal",
    hidingPhase: "Hider Head Start",
    seekingPhase: "Seekers Released",
    roundOver: "Round Over"
  }[state] || state;
};

ManhuntManager.prototype._formatTeam = function (team) {
  if (team === "hider") return "Hider";
  if (team === "seeker") return "Seeker";
  return team || "Unassigned";
};

ManhuntManager.prototype._showFeedback = function (text, seconds) {
  this._feedbackText = text;
  this._feedbackTimeRemaining = seconds || 2;
  this._renderUi();
};

ManhuntManager.prototype._logPlayerDebug = function (reason) {
  console.log("[Manhunt] debug " + reason + ": local=" + this._getLocalPlayerDisplayName() + " (" + this._shortId(this._getLocalPlayerId()) + "), remotes=" + this._getRemotePlayerCount());
};

ManhuntManager.prototype._onDestroy = function () {
  if (this._hudRoot && this._hudRoot.parentNode) {
    this._hudRoot.parentNode.removeChild(this._hudRoot);
  }
  if (this._overlayRoot && this._overlayRoot.parentNode) {
    this._overlayRoot.parentNode.removeChild(this._overlayRoot);
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
