/* global pc, window */

var LocalPlayerController = pc.createScript("localPlayerController");

LocalPlayerController.attributes.add("networkManagerEntity", {
  type: "entity",
  title: "Network Manager Entity"
});

LocalPlayerController.attributes.add("cameraEntity", {
  type: "entity",
  title: "Camera Entity"
});

LocalPlayerController.attributes.add("moveSpeed", {
  type: "number",
  default: 12.5,
  title: "Move Speed"
});

LocalPlayerController.attributes.add("minJumpHeight", {
  type: "number",
  default: 0.35,
  title: "Minimum Jump Height"
});

LocalPlayerController.attributes.add("maxJumpHeight", {
  type: "number",
  default: 2,
  title: "Maximum Jump Height"
});

LocalPlayerController.attributes.add("idealJumpHoldTime", {
  type: "number",
  default: 1,
  title: "Ideal Jump Hold Time"
});

LocalPlayerController.attributes.add("maxJumpChargeTime", {
  type: "number",
  default: 2,
  title: "Maximum Jump Charge Time"
});

LocalPlayerController.attributes.add("groundCheckExtraDistance", {
  type: "number",
  default: 0.15,
  title: "Ground Check Extra Distance"
});

LocalPlayerController.attributes.add("mouseSensitivity", {
  type: "number",
  default: 0.15,
  title: "Mouse Sensitivity"
});

LocalPlayerController.attributes.add("eyeHeight", {
  type: "number",
  default: 1.5,
  title: "Eye Height"
});

LocalPlayerController.attributes.add("cameraBackOffset", {
  type: "number",
  default: 0,
  title: "Camera Back Offset"
});

LocalPlayerController.attributes.add("minPitch", {
  type: "number",
  default: -80,
  title: "Min Pitch"
});

LocalPlayerController.attributes.add("maxPitch", {
  type: "number",
  default: 80,
  title: "Max Pitch"
});

LocalPlayerController.attributes.add("playerName", {
  type: "string",
  default: "",
  title: "Player Name"
});

LocalPlayerController.attributes.add("enablePointerLock", {
  type: "boolean",
  default: true,
  title: "Enable Pointer Lock"
});

LocalPlayerController.attributes.add("sendInterval", {
  type: "number",
  default: 0.05,
  title: "Network Send Interval"
});

LocalPlayerController.prototype.initialize = function () {
  this.networkClient = null;
  this.sendTimer = 0;
  this.hasLoggedFirstMovement = false;
  this.isGrounded = false;
  this.isChargingJump = false;
  this.jumpChargeTime = 0;
  this.yawDegrees = this.entity.getEulerAngles().y || 0;
  this.pitchDegrees = 0;

  this._move = new pc.Vec3();
  this._forward = new pc.Vec3();
  this._right = new pc.Vec3();
  this._cameraOffset = new pc.Vec3();
  this._cameraWorldPos = new pc.Vec3();
  this._groundCheckStart = new pc.Vec3();
  this._groundCheckEnd = new pc.Vec3();
  this._localMoveInput = new pc.Vec3();
  this._targetVelocity = new pc.Vec3();
  this._currentVelocity = new pc.Vec3();
  this._yawQuat = new pc.Quat();
  this._lastAppliedYawDegrees = null;
  this._groundRaycastFilterBound = this._isValidGroundHit.bind(this);
  this._yawApplyDeadzoneDegrees = 0.05;

  this._onMouseMoveBound = this._onMouseMove.bind(this);
  this._onMouseDownBound = this._onMouseDown.bind(this);
  this._onStateChangedBound = this._onStateChanged.bind(this);
  this._onProfileReadyBound = this._onProfileReady.bind(this);
  this._onStartGameBound = this._onStartGame.bind(this);

  var cfg = window.ArcadeConfig || {};
  this._playerName = this.playerName || (cfg.PLAYER_NAME_PREFIX || "Student");
  if (!this.playerName && !(cfg.PLAYER_NAME_PREFIX || "")) {
    console.log("[LocalPlayerController] No configured/player profile name yet; using Student fallback until onboarding finishes.");
  }
  this._gameState = this.app.arcadeGameState || window.ArcadeWorldGameState || "onboarding";
  this._onProfileReady(this.app.arcadePlayerProfile || window.ArcadePlayerProfile || null);

  this._resolveNetworkClient();
  this._resolveCameraEntity();
  this._validatePhysicsSetup();

  this._applyBodyYaw();
  this._applyCameraTransform();

  if (this.app.mouse) {
    this.app.mouse.on(pc.EVENT_MOUSEMOVE, this._onMouseMoveBound, this);
    this.app.mouse.on(pc.EVENT_MOUSEDOWN, this._onMouseDownBound, this);
  }
  this.app.on("arcade:stateChanged", this._onStateChangedBound, this);
  this.app.on("arcade:profileReady", this._onProfileReadyBound, this);
  this.app.on("arcade:startGame", this._onStartGameBound, this);

  this.on("enable", this._onEnable, this);
  this.on("disable", this._onDisable, this);
  this.on("destroy", this._onDestroy, this);

  console.log("[LocalPlayerController] Initialized");
  console.log("[LocalPlayerController] Camera mode: first-person");
  console.log("[LocalPlayerController] Initial game state: " + this._gameState);
  this._onEnable();
};

LocalPlayerController.prototype._resolveNetworkClient = function () {
  if (!this.networkManagerEntity) {
    console.warn("[LocalPlayerController] networkManagerEntity is not configured. Local movement will still work.");
    return;
  }

  if (this.networkManagerEntity.script) {
    this.networkClient = this.networkManagerEntity.script.arcadeNetworkClient;
  }

  if (!this.networkClient) {
    console.warn("[LocalPlayerController] ArcadeNetworkClient not found. Local movement will still work.");
    return;
  }

  console.log("[LocalPlayerController] Network client assigned");
};

LocalPlayerController.prototype._resolveCameraEntity = function () {
  if (!this.cameraEntity) {
    this.cameraEntity = this.entity.findByName("Camera");
  }

  if (!this.cameraEntity) {
    this.cameraEntity = this.app.root.findByName("Camera");
  }

  if (!this.cameraEntity) {
    console.warn("[LocalPlayerController] Missing cameraEntity. Assign a camera child or camera entity reference.");
    return;
  }

  console.log("[LocalPlayerController] Camera assigned: " + this.cameraEntity.name);
};

LocalPlayerController.prototype._validatePhysicsSetup = function () {
  if (!this.entity.collision) {
    console.warn("[LocalPlayerController] Missing collision component. Expected a capsule collision for physics movement.");
  }

  if (!this.entity.rigidbody) {
    console.warn("[LocalPlayerController] Missing rigidbody component. Expected a dynamic rigidbody for physics movement.");
    return;
  }

  if (this.entity.rigidbody.type !== pc.BODYTYPE_DYNAMIC) {
    console.warn("[LocalPlayerController] Rigidbody is not dynamic. Set rigidbody type to Dynamic.");
  }

  // Keep a standing FPS capsule from tipping over after collisions.
  this.entity.rigidbody.angularFactor = pc.Vec3.ZERO;
  this.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
};

LocalPlayerController.prototype._onEnable = function () {
  console.log("[LocalPlayerController] Input enabled");
};

LocalPlayerController.prototype._onDisable = function () {};

LocalPlayerController.prototype._onDestroy = function () {
  if (this.app.mouse) {
    this.app.mouse.off(pc.EVENT_MOUSEMOVE, this._onMouseMoveBound, this);
    this.app.mouse.off(pc.EVENT_MOUSEDOWN, this._onMouseDownBound, this);
  }
  this.app.off("arcade:stateChanged", this._onStateChangedBound, this);
  this.app.off("arcade:profileReady", this._onProfileReadyBound, this);
  this.app.off("arcade:startGame", this._onStartGameBound, this);
};

LocalPlayerController.prototype._onStateChanged = function (state) {
  this._gameState = state || "onboarding";
  if (!this._isPlaying()) {
    this._releasePointerLock();
    this._stopMovementVelocity();
  }
  console.log("[LocalPlayerController] Game state -> " + this._gameState);
};

LocalPlayerController.prototype._onProfileReady = function (profile) {
  if (!profile) {
    return;
  }

  var name = typeof profile.name === "string" ? profile.name.trim().slice(0, 24) : "";
  if (!name) {
    console.log("[LocalPlayerController] Empty profile name received; using Student fallback.");
    name = "Student";
  }

  this._playerName = name;
  console.log("[LocalPlayerController] Player name saved for movement sync: " + this._playerName);
};

LocalPlayerController.prototype._onStartGame = function (profile) {
  this._onProfileReady(profile);
};

LocalPlayerController.prototype._isPlaying = function () {
  return this._gameState === "playing" || this.app.arcadeGameState === "playing" || window.ArcadeWorldGameState === "playing";
};

LocalPlayerController.prototype._releasePointerLock = function () {
  if (typeof document !== "undefined" && document.pointerLockElement && document.exitPointerLock) {
    document.exitPointerLock();
    console.log("[LocalPlayerController] Pointer lock released outside gameplay");
  }
};

LocalPlayerController.prototype._stopMovementVelocity = function () {
  this._localMoveInput.set(0, 0, 0);
  this._move.set(0, 0, 0);
  if (!this.entity.rigidbody || this.entity.rigidbody.type !== pc.BODYTYPE_DYNAMIC) {
    return;
  }

  this._currentVelocity.copy(this.entity.rigidbody.linearVelocity);
  this._currentVelocity.x = 0;
  this._currentVelocity.z = 0;
  this.entity.rigidbody.linearVelocity = this._currentVelocity;
};

LocalPlayerController.prototype._onMouseDown = function (event) {
  if (!this._isPlaying() || !this._isGameplayMouseEvent(event)) {
    return;
  }

  if (!this.enablePointerLock || !this.app.mouse || pc.Mouse.isPointerLocked()) {
    return;
  }

  this.app.mouse.enablePointerLock();
  console.log("[LocalPlayerController] Pointer lock requested");
};

LocalPlayerController.prototype._isGameplayMouseEvent = function (event) {
  if (!event || !event.event || !this.app.graphicsDevice) {
    return true;
  }

  return event.event.target === this.app.graphicsDevice.canvas;
};

LocalPlayerController.prototype._onMouseMove = function (event) {
  if (!this.enabled || !this._isPlaying()) return;
  if (this.enablePointerLock && !pc.Mouse.isPointerLocked()) return;

  this.yawDegrees -= event.dx * this.mouseSensitivity;
  this.pitchDegrees -= event.dy * this.mouseSensitivity;
  this.pitchDegrees = pc.math.clamp(this.pitchDegrees, this.minPitch, this.maxPitch);
};

LocalPlayerController.prototype.update = function (dt) {
  var pointerLockedNow = this.app.mouse && pc.Mouse.isPointerLocked ? pc.Mouse.isPointerLocked() : false;
  if (pointerLockedNow !== this._pointerLockLastState) {
    this._pointerLockLastState = pointerLockedNow;
    console.log("[LocalPlayerController] Pointer " + (pointerLockedNow ? "locked" : "unlocked"));
  }

  if (!this._isPlaying()) {
    if (pointerLockedNow) {
      this._releasePointerLock();
    }
    this._stopMovementVelocity();
    return;
  }

  this._applyBodyYaw();

  this._updateGroundedState();
  this._updateMovementVelocity(dt);
  if (this.shouldLockMovementForManhunt()) {
    this._cancelJumpCharge();
  } else {
    this._updateJumpCharge(dt);
  }
  this._applyCameraTransform();

  this.sendTimer += dt;
  if (this.sendTimer >= this.sendInterval) {
    this.sendTimer = 0;
    this._sendMoveState();
  }
};

LocalPlayerController.prototype._updateGroundedState = function () {
  var rigidbodySystem = this.app && this.app.systems ? this.app.systems.rigidbody : null;
  if (!rigidbodySystem || !rigidbodySystem.raycastFirst) {
    if (!this._hasWarnedMissingRaycast) {
      this._hasWarnedMissingRaycast = true;
      console.warn("[LocalPlayerController] Rigidbody system raycast is unavailable. Ground checks and jumping are disabled.");
    }
    this.isGrounded = false;
    this._cancelJumpCharge();
    return;
  }

  this._groundCheckStart.copy(this.entity.getPosition());
  this._groundCheckEnd.copy(this._groundCheckStart);
  this._groundCheckEnd.y -= this._getGroundCheckDistance();

  var hit = rigidbodySystem.raycastFirst(this._groundCheckStart, this._groundCheckEnd, {
    filterCallback: this._groundRaycastFilterBound
  });

  this.isGrounded = !!hit;

  if (!this.isGrounded && this.isChargingJump) {
    this._cancelJumpCharge();
  }
};

LocalPlayerController.prototype._getGroundCheckDistance = function () {
  var extraDistance = Math.max(this.groundCheckExtraDistance || 0, 0);

  if (!this.entity.collision) {
    if (!this._hasWarnedMissingGroundCollision) {
      this._hasWarnedMissingGroundCollision = true;
      console.warn("[LocalPlayerController] Missing collision component. Using fallback ground check distance.");
    }
    return 1 + extraDistance;
  }

  if (typeof this.entity.collision.height === "number") {
    return Math.max(this.entity.collision.height * 0.5 + extraDistance, extraDistance);
  }

  if (typeof this.entity.collision.radius === "number") {
    return this.entity.collision.radius + extraDistance;
  }

  return 1 + extraDistance;
};

LocalPlayerController.prototype._isValidGroundHit = function (entity) {
  if (!entity) return false;
  if (entity === this.entity) return false;

  var parent = entity.parent;
  while (parent) {
    if (parent === this.entity) return false;
    parent = parent.parent;
  }

  return true;
};

LocalPlayerController.prototype._updateJumpCharge = function (dt) {
  if (!this.app.keyboard) {
    if (this.isChargingJump) {
      this._cancelJumpCharge();
    }
    return;
  }

  var isSpaceDown = this.app.keyboard.isPressed(pc.KEY_SPACE);
  var wasSpacePressed = this.app.keyboard.wasPressed ? this.app.keyboard.wasPressed(pc.KEY_SPACE) : false;
  var wasSpaceReleased = this.app.keyboard.wasReleased ? this.app.keyboard.wasReleased(pc.KEY_SPACE) : false;

  if (!this.isGrounded) {
    if (this.isChargingJump) {
      this._cancelJumpCharge();
    }
    return;
  }

  if (!this.isChargingJump && wasSpacePressed) {
    this.isChargingJump = true;
    this.jumpChargeTime = 0;
  }

  if (!this.isChargingJump) {
    return;
  }

  if (isSpaceDown) {
    var safeMaxChargeTime = Math.max(this.maxJumpChargeTime || 0, 0);
    this.jumpChargeTime = Math.min(this.jumpChargeTime + dt, safeMaxChargeTime);
  }

  if (wasSpaceReleased || !isSpaceDown) {
    this._jumpFromCharge();
  }
};

LocalPlayerController.prototype._jumpFromCharge = function () {
  if (!this.isGrounded) {
    this._cancelJumpCharge();
    return;
  }

  if (!this.entity.rigidbody || this.entity.rigidbody.type !== pc.BODYTYPE_DYNAMIC) {
    if (!this._hasWarnedMissingJumpRigidbody) {
      this._hasWarnedMissingJumpRigidbody = true;
      console.warn("[LocalPlayerController] Missing dynamic rigidbody. Charged jump cannot be applied.");
    }
    this._cancelJumpCharge();
    return;
  }

  var jumpHeight = this._getChargedJumpHeight(this.jumpChargeTime);
  var jumpSpeed = this._getJumpSpeedForHeight(jumpHeight);

  this._currentVelocity.copy(this.entity.rigidbody.linearVelocity);
  this._currentVelocity.y = jumpSpeed;
  this.entity.rigidbody.linearVelocity = this._currentVelocity;

  this.isGrounded = false;
  this._cancelJumpCharge();
};

LocalPlayerController.prototype._getChargedJumpHeight = function (holdTime) {
  var safeMinHeight = Math.max(this.minJumpHeight, 0);
  var safeMaxHeight = Math.max(this.maxJumpHeight, safeMinHeight);
  var safeIdealTime = Math.max(this.idealJumpHoldTime, 0.001);
  var clampedHoldTime = Math.max(holdTime || 0, 0);
  var normalizedDistanceFromIdeal = (clampedHoldTime - safeIdealTime) / safeIdealTime;
  var curveAmount = 1 - normalizedDistanceFromIdeal * normalizedDistanceFromIdeal;
  curveAmount = pc.math.clamp(curveAmount, 0, 1);

  return safeMinHeight + (safeMaxHeight - safeMinHeight) * curveAmount;
};

LocalPlayerController.prototype._getJumpSpeedForHeight = function (height) {
  var rigidbodySystem = this.app && this.app.systems ? this.app.systems.rigidbody : null;
  var gravity = rigidbodySystem && rigidbodySystem.gravity ? Math.abs(rigidbodySystem.gravity.y) : 9.81;
  gravity = Math.max(gravity, 0.001);

  return Math.sqrt(2 * gravity * Math.max(height, 0));
};

LocalPlayerController.prototype._cancelJumpCharge = function () {
  this.isChargingJump = false;
  this.jumpChargeTime = 0;
};

LocalPlayerController.prototype._updateMovementVelocity = function (_dt) {
  this._readMovementInput();
  this._buildYawRelativeMove();

  this._targetVelocity.copy(this._move).scale(this.moveSpeed);

  if (!this.entity.rigidbody || this.entity.rigidbody.type !== pc.BODYTYPE_DYNAMIC) {
    return;
  }

  this._currentVelocity.copy(this.entity.rigidbody.linearVelocity);
  this._currentVelocity.x = this._targetVelocity.x;
  this._currentVelocity.z = this._targetVelocity.z;
  this.entity.rigidbody.linearVelocity = this._currentVelocity;

  if (!this.hasLoggedFirstMovement && this._targetVelocity.lengthSq() > 0) {
    this.hasLoggedFirstMovement = true;
    console.log("[LocalPlayerController] First movement detected");
    this._sendMoveState();
  }
};

LocalPlayerController.prototype._readMovementInput = function () {
  this._localMoveInput.set(0, 0, 0);

  if (this.shouldLockMovementForManhunt()) return;

  if (!this.app.keyboard) return;

  if (this.app.keyboard.isPressed(pc.KEY_A)) this._localMoveInput.x -= 1;
  if (this.app.keyboard.isPressed(pc.KEY_D)) this._localMoveInput.x += 1;
  if (this.app.keyboard.isPressed(pc.KEY_W)) this._localMoveInput.z -= 1;
  if (this.app.keyboard.isPressed(pc.KEY_S)) this._localMoveInput.z += 1;

  if (this._localMoveInput.lengthSq() > 1) {
    this._localMoveInput.normalize();
  }
};

LocalPlayerController.prototype._buildYawRelativeMove = function () {
  this._move.set(0, 0, 0);

  if (this._localMoveInput.lengthSq() === 0) return;

  // Movement is based on body yaw only. Pitch stays on the camera child, so
  // looking up/down never makes the capsule climb or dive.
  var yawRadians = this.yawDegrees * pc.math.DEG_TO_RAD;
  var sinYaw = Math.sin(yawRadians);
  var cosYaw = Math.cos(yawRadians);

  // At yaw 0: W = world -Z, S = world +Z, D = world +X, A = world -X.
  this._forward.set(-sinYaw, 0, -cosYaw);
  this._right.set(cosYaw, 0, -sinYaw);

  this._move.copy(this._forward).scale(-this._localMoveInput.z);
  this._move.add(this._right.scale(this._localMoveInput.x));

  if (this._move.lengthSq() > 1) {
    this._move.normalize();
  }
};

LocalPlayerController.prototype._applyBodyYaw = function () {
  if (this._lastAppliedYawDegrees !== null && Math.abs(this._lastAppliedYawDegrees - this.yawDegrees) < this._yawApplyDeadzoneDegrees) {
    return;
  }

  this._lastAppliedYawDegrees = this.yawDegrees;
  // Avoid using rigidbody.teleport for normal mouse-look yaw updates. The capsule
  // has angularFactor locked, so direct entity rotation is enough for movement
  // direction/camera alignment and avoids physics correction jitter.
  this.entity.setEulerAngles(0, this.yawDegrees, 0);
  if (this.entity.rigidbody && this.entity.rigidbody.type === pc.BODYTYPE_DYNAMIC) {
    this.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
  }
};

LocalPlayerController.prototype.shouldLockMovementForManhunt = function () {
  if (!this.networkClient || !this.networkClient.getManhuntState) {
    return false;
  }

  var state = this.networkClient.getManhuntState();
  var phase = state ? state.phase : "lobby";
  var status = this.networkClient.getLocalManhuntStatus ? this.networkClient.getLocalManhuntStatus() : "none";

  return phase === "teamReveal" ||
    phase === "spawnCountdown" ||
    phase === "roundOver" ||
    status === "tagged" ||
    status === "safe";
};

LocalPlayerController.prototype._applyCameraTransform = function () {
  if (!this.cameraEntity) return;

  // Place camera at the player's eye height.
  this._cameraWorldPos.copy(this.entity.getPosition());
  this._cameraWorldPos.y += this.eyeHeight;

  this.cameraEntity.setPosition(this._cameraWorldPos);

  // Drive the camera's full world rotation directly:
  // yaw = left/right from parent body
  // pitch = up/down from mouse Y
  this.cameraEntity.setEulerAngles(this.pitchDegrees, this.yawDegrees, 0);
};

LocalPlayerController.prototype._sendMoveState = function () {
  if (!this.networkClient) return;

  var pos = this.entity.getPosition();
  var profile = this.app.arcadePlayerProfile || window.ArcadePlayerProfile || null;
  var name = profile && typeof profile.name === "string" && profile.name.trim() ? profile.name.trim().slice(0, 24) : this._playerName;
  if (!name) {
    console.log("[LocalPlayerController] Empty movement name; using Student fallback.");
    name = "Student";
  }
  if (this._lastLoggedMoveName !== name) {
    this._lastLoggedMoveName = name;
    console.log("[LocalPlayerController] Sending movement name: " + name);
  }
  this.networkClient.sendMove(pos, this.yawDegrees, name);
};
