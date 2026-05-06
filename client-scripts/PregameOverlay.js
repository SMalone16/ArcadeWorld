/* global pc, localStorage */

var PregameOverlay = pc.createScript("pregameOverlay");

PregameOverlay.attributes.add("networkClientEntity", {
  type: "entity",
  title: "Network Client Entity"
});

PregameOverlay.prototype.initialize = function () {
  this._storageKey = "arcadeWorld.playerProfile";
  this._hatIds = ["No Hat", "Top Hat", "Western"];
  this._colorChoices = ["#44aaff", "#ffcc66", "#88dd77", "#ff88bb", "#aa99ff"];
  this._profile = this._loadProfile();
  this._root = this._createRootElement();
  this._render();
  this.on("destroy", this._onDestroy, this);
};

PregameOverlay.prototype._loadProfile = function () {
  var fallback = {
    name: "Player",
    color: "#44aaff",
    hatId: "No Hat"
  };

  var raw = localStorage.getItem(this._storageKey);
  if (!raw) {
    return fallback;
  }

  var parsed = JSON.parse(raw);
  return this._sanitizeProfile(parsed || fallback);
};

PregameOverlay.prototype._saveProfile = function (profile) {
  localStorage.setItem(this._storageKey, JSON.stringify(profile));
};

PregameOverlay.prototype._createRootElement = function () {
  var root = document.createElement("div");
  root.setAttribute("aria-label", "Arcade player setup");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "9999";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.padding = "24px";
  root.style.background = "linear-gradient(135deg, rgba(7, 18, 32, 0.94), rgba(32, 22, 60, 0.92))";
  root.style.color = "#f6fbff";
  root.style.font = "16px/1.4 Arial, sans-serif";

  document.body.appendChild(root);
  return root;
};

PregameOverlay.prototype._render = function () {
  this._root.innerHTML = "";

  var panel = document.createElement("div");
  panel.style.width = "min(440px, 100%)";
  panel.style.padding = "24px";
  panel.style.background = "rgba(12, 24, 38, 0.94)";
  panel.style.border = "2px solid rgba(120, 220, 255, 0.75)";
  panel.style.borderRadius = "14px";
  panel.style.boxShadow = "0 18px 40px rgba(0, 0, 0, 0.45)";

  var title = document.createElement("h1");
  title.textContent = "Join Arcade World";
  title.style.margin = "0 0 8px";
  title.style.fontSize = "28px";
  panel.appendChild(title);

  var hint = document.createElement("p");
  hint.textContent = "Choose a friendly name, color, and hat before entering the multiplayer lobby.";
  hint.style.margin = "0 0 18px";
  hint.style.color = "#ccecff";
  panel.appendChild(hint);

  var nameLabel = this._createLabel("Display name");
  this._nameInput = document.createElement("input");
  this._nameInput.type = "text";
  this._nameInput.maxLength = 24;
  this._nameInput.value = this._profile.name;
  this._styleInput(this._nameInput);
  panel.appendChild(nameLabel);
  panel.appendChild(this._nameInput);

  panel.appendChild(this._createLabel("Body color"));
  var colorRow = document.createElement("div");
  colorRow.style.display = "flex";
  colorRow.style.gap = "8px";
  colorRow.style.flexWrap = "wrap";
  colorRow.style.margin = "8px 0 16px";
  for (var i = 0; i < this._colorChoices.length; i++) {
    colorRow.appendChild(this._createColorButton(this._colorChoices[i]));
  }
  this._colorInput = document.createElement("input");
  this._colorInput.type = "color";
  this._colorInput.value = this._profile.color;
  this._colorInput.title = "Custom color";
  this._colorInput.style.width = "44px";
  this._colorInput.style.height = "38px";
  this._colorInput.style.border = "1px solid rgba(255, 255, 255, 0.35)";
  this._colorInput.style.borderRadius = "8px";
  this._colorInput.style.background = "transparent";
  colorRow.appendChild(this._colorInput);
  panel.appendChild(colorRow);

  panel.appendChild(this._createLabel("Hat"));
  this._hatSelect = document.createElement("select");
  this._styleInput(this._hatSelect);
  for (var j = 0; j < this._hatIds.length; j++) {
    var option = document.createElement("option");
    option.value = this._hatIds[j];
    option.textContent = this._hatIds[j];
    this._hatSelect.appendChild(option);
  }
  this._hatSelect.value = this._profile.hatId;
  panel.appendChild(this._hatSelect);

  this._error = document.createElement("div");
  this._error.style.minHeight = "22px";
  this._error.style.margin = "10px 0";
  this._error.style.color = "#ffcc66";
  this._error.style.fontWeight = "700";
  panel.appendChild(this._error);

  var playButton = document.createElement("button");
  playButton.textContent = "Play";
  playButton.style.width = "100%";
  playButton.style.padding = "12px 14px";
  playButton.style.border = "0";
  playButton.style.borderRadius = "10px";
  playButton.style.color = "#072033";
  playButton.style.background = "#8ee6ff";
  playButton.style.font = "700 18px Arial, sans-serif";
  playButton.style.cursor = "pointer";
  playButton.addEventListener("click", this._onPlay.bind(this));
  panel.appendChild(playButton);

  this._root.appendChild(panel);
};

PregameOverlay.prototype._createLabel = function (text) {
  var label = document.createElement("label");
  label.textContent = text;
  label.style.display = "block";
  label.style.margin = "14px 0 6px";
  label.style.fontWeight = "700";
  return label;
};

PregameOverlay.prototype._styleInput = function (input) {
  input.style.boxSizing = "border-box";
  input.style.width = "100%";
  input.style.padding = "10px 12px";
  input.style.border = "1px solid rgba(255, 255, 255, 0.35)";
  input.style.borderRadius = "8px";
  input.style.color = "#f6fbff";
  input.style.background = "rgba(255, 255, 255, 0.08)";
  input.style.font = "16px Arial, sans-serif";
};

PregameOverlay.prototype._createColorButton = function (color) {
  var button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Choose color " + color);
  button.style.width = "38px";
  button.style.height = "38px";
  button.style.border = color === this._profile.color ? "3px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.45)";
  button.style.borderRadius = "999px";
  button.style.background = color;
  button.style.cursor = "pointer";
  button.addEventListener("click", function () {
    this._profile.color = color;
    if (this._colorInput) {
      this._colorInput.value = color;
    }
    this._render();
  }.bind(this));
  return button;
};

PregameOverlay.prototype._onPlay = async function () {
  var networkClient = this._getNetworkClient();
  if (!networkClient || !networkClient.connectWithProfile) {
    this._showError("ArcadeNetworkClient is missing. Assign networkClientEntity to NetworkManager.");
    return;
  }

  var profile = this._sanitizeProfile({
    name: this._nameInput.value,
    color: this._colorInput.value,
    hatId: this._hatSelect.value
  });

  this._saveProfile(profile);
  this._profile = profile;
  this._showError("Connecting...");
  await networkClient.connectWithProfile(profile);
  this._hide();
};

PregameOverlay.prototype._getNetworkClient = function () {
  if (!this.networkClientEntity || !this.networkClientEntity.script) {
    return null;
  }

  return this.networkClientEntity.script.arcadeNetworkClient || null;
};

PregameOverlay.prototype._sanitizeProfile = function (profile) {
  var safe = profile || {};
  var name = typeof safe.name === "string" ? safe.name.trim().slice(0, 24) : "";
  var color = typeof safe.color === "string" && /^#[0-9a-fA-F]{6}$/.test(safe.color) ? safe.color : "#44aaff";
  var hatId = this._hatIds.indexOf(safe.hatId) !== -1 ? safe.hatId : "No Hat";

  return {
    name: name || "Player",
    color: color,
    hatId: hatId
  };
};

PregameOverlay.prototype._showError = function (message) {
  if (this._error) {
    this._error.textContent = message;
  }
};

PregameOverlay.prototype._hide = function () {
  if (this._root) {
    this._root.style.display = "none";
  }
};

PregameOverlay.prototype._onDestroy = function () {
  if (this._root && this._root.parentNode) {
    this._root.parentNode.removeChild(this._root);
  }
};
