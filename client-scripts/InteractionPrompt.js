/* global pc, window, document */

var InteractionPrompt = pc.createScript("interactionPrompt");

InteractionPrompt.attributes.add("defaultZIndex", {
  type: "number",
  default: 9000,
  title: "Prompt Z-Index"
});

InteractionPrompt.prototype.initialize = function () {
  window.ArcadeInteractionPrompt = window.ArcadeInteractionPrompt || this._createPromptService(this.defaultZIndex);
  this.prompt = window.ArcadeInteractionPrompt;
  this.on("destroy", this._onDestroy, this);
};

InteractionPrompt.prototype.update = function () {
  if (this.prompt && this.prompt.update) {
    this.prompt.update();
  }
};

InteractionPrompt.prototype._onDestroy = function () {
  if (window.ArcadeInteractionPrompt && window.ArcadeInteractionPrompt.destroy) {
    window.ArcadeInteractionPrompt.destroy();
  }
  window.ArcadeInteractionPrompt = null;
};

InteractionPrompt.prototype._createPromptService = function (zIndex) {
  var el = document.createElement("div");
  el.setAttribute("data-arcade-interaction-prompt", "true");
  el.style.position = "fixed";
  el.style.left = "50%";
  el.style.top = "63%";
  el.style.transform = "translate(-50%, -50%)";
  el.style.padding = "14px 22px";
  el.style.borderRadius = "16px";
  el.style.background = "rgba(12, 18, 32, 0.82)";
  el.style.color = "#ffffff";
  el.style.fontFamily = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  el.style.fontSize = "24px";
  el.style.fontWeight = "800";
  el.style.letterSpacing = "0.02em";
  el.style.textShadow = "0 2px 4px rgba(0,0,0,0.45)";
  el.style.boxShadow = "0 12px 34px rgba(0,0,0,0.35)";
  el.style.pointerEvents = "none";
  el.style.zIndex = String(zIndex || 9000);
  el.style.display = "none";
  document.body.appendChild(el);

  var requests = {};
  var currentKey = "";
  var consumedUntil = 0;

  var isUiBlocked = function () {
    return window.ArcadeWorldGameState === "onboarding" || window.ArcadeWorldGameState === "pregame" || window.ArcadeMiniGameActive === true;
  };

  var service = {
    show: function (key, message, priority) {
      if (!key) return;
      requests[key] = {
        key: key,
        message: message || "Press E",
        priority: typeof priority === "number" ? priority : 0,
        updatedAt: Date.now()
      };
      this.update();
    },
    hide: function (key) {
      if (key && requests[key]) delete requests[key];
      this.update();
    },
    clear: function () {
      requests = {};
      this.update();
    },
    getCurrentKey: function () {
      this.update();
      return currentKey;
    },
    isCurrent: function (key) {
      return this.getCurrentKey() === key;
    },
    consumeAction: function (key) {
      this.update();
      if (currentKey !== key || Date.now() < consumedUntil) return false;
      consumedUntil = Date.now() + 120;
      return true;
    },
    update: function () {
      var now = Date.now();
      var best = null;
      for (var key in requests) {
        if (!Object.prototype.hasOwnProperty.call(requests, key)) continue;
        var request = requests[key];
        if (now - request.updatedAt > 250) {
          delete requests[key];
          continue;
        }
        if (!best || request.priority > best.priority || (request.priority === best.priority && request.updatedAt > best.updatedAt)) {
          best = request;
        }
      }

      if (!best || isUiBlocked()) {
        currentKey = "";
        el.style.display = "none";
        return;
      }

      currentKey = best.key;
      el.textContent = best.message;
      el.style.display = "block";
    },
    destroy: function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      requests = {};
      currentKey = "";
    }
  };

  return service;
};

window.ArcadeDomInput = window.ArcadeDomInput || {
  isTyping: function () {
    var active = document.activeElement;
    if (!active) return false;
    var tag = active.tagName ? active.tagName.toLowerCase() : "";
    return tag === "input" || tag === "textarea" || tag === "select" || active.isContentEditable === true;
  }
};
