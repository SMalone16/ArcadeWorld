/* global pc, window, document */

var ArcadeCabinetGameLauncher = pc.createScript("arcadeCabinetGameLauncher");

ArcadeCabinetGameLauncher.attributes.add("networkManagerEntity", { type: "entity", title: "Network Manager Entity" });
ArcadeCabinetGameLauncher.attributes.add("localPlayerEntity", { type: "entity", title: "Local Player Entity" });
ArcadeCabinetGameLauncher.attributes.add("cabinetEntity", { type: "entity", title: "Cabinet Entity (optional)" });
ArcadeCabinetGameLauncher.attributes.add("interactionRadius", { type: "number", default: 2.5, min: 0, title: "Interaction Radius" });
ArcadeCabinetGameLauncher.attributes.add("promptText", { type: "string", default: "Press E to Play", title: "Prompt Text" });

ArcadeCabinetGameLauncher.prototype.initialize = function () {
  this.networkClient = this._resolveScript(this.networkManagerEntity, "arcadeNetworkClient");
  this.promptKey = "arcade-cabinet-play-" + this.entity.getGuid();
  this.prompt = window.ArcadeInteractionPrompt || null;
  this.currentGame = null;
  this._wasInRange = false;
  this.on("destroy", this._onDestroy, this);
};

ArcadeCabinetGameLauncher.prototype.update = function () {
  if (!this.prompt) this.prompt = window.ArcadeInteractionPrompt || null;
  var canPrompt = this._canInteract();
  if (canPrompt && this.prompt) {
    this.prompt.show(this.promptKey, this.promptText || "Press E to Play", 10);
  } else if (this.prompt) {
    this.prompt.hide(this.promptKey);
  }

  if (canPrompt && this._wasEPressed() && this.prompt && this.prompt.consumeAction(this.promptKey)) {
    this._openTicketSnake();
  }
  this._wasInRange = canPrompt;
};

ArcadeCabinetGameLauncher.prototype._canInteract = function () {
  if (window.ArcadeMiniGameActive === true) return false;
  if (window.ArcadeWorldGameState === "onboarding" || window.ArcadeWorldGameState === "pregame") return false;
  if (!this.localPlayerEntity) return false;
  var cabinet = this.cabinetEntity || this.entity;
  var playerPos = this.localPlayerEntity.getPosition();
  var cabinetPos = cabinet.getPosition();
  var dx = playerPos.x - cabinetPos.x;
  var dz = playerPos.z - cabinetPos.z;
  return Math.sqrt(dx * dx + dz * dz) <= Math.max(this.interactionRadius || 0, 0);
};

ArcadeCabinetGameLauncher.prototype._wasEPressed = function () {
  if (window.ArcadeDomInput && window.ArcadeDomInput.isTyping && window.ArcadeDomInput.isTyping()) return false;
  return this.app.keyboard && this.app.keyboard.wasPressed && this.app.keyboard.wasPressed(pc.KEY_E);
};

ArcadeCabinetGameLauncher.prototype._openTicketSnake = function () {
  if (!window.TicketSnakeGame) {
    console.warn("[ArcadeCabinetGameLauncher] TicketSnakeGame.js is not loaded.");
    return;
  }
  if (this.currentGame && this.currentGame.state !== "closed") return;
  if (this.prompt) this.prompt.hide(this.promptKey);
  this._setLocalMovementPaused(true);
  this.currentGame = new window.TicketSnakeGame({
    networkClient: this.networkClient,
    onClose: function () {
      this._setLocalMovementPaused(false);
      this.currentGame = null;
    }.bind(this)
  });
  this.currentGame.open();
};

ArcadeCabinetGameLauncher.prototype._setLocalMovementPaused = function (paused) {
  window.ArcadeMiniGameActive = paused === true;
  var controller = this.localPlayerEntity && this.localPlayerEntity.script ? this.localPlayerEntity.script.localPlayerController : null;
  if (controller && controller.setMiniGameInputPaused) controller.setMiniGameInputPaused(paused === true);
  if (paused && document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
};

ArcadeCabinetGameLauncher.prototype._resolveScript = function (entity, scriptName) {
  if (!entity || !entity.script) return null;
  return entity.script[scriptName] || null;
};

ArcadeCabinetGameLauncher.prototype._onDestroy = function () {
  if (this.prompt) this.prompt.hide(this.promptKey);
  if (this.currentGame && this.currentGame.close) this.currentGame.close();
};
