/* global pc */
(function () {
  "use strict";

  function isTypingTarget(target) {
    if (typeof window !== "undefined" && window.ArcadeDomInput && window.ArcadeDomInput.isTyping) {
      return window.ArcadeDomInput.isTyping();
    }

    if (!target) {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    var tagName = target.tagName ? String(target.tagName).toLowerCase() : "";
    return tagName === "input" || tagName === "textarea" || tagName === "select";
  }

  function isSuppressedByGameState() {
    if (typeof window === "undefined") {
      return false;
    }

    return window.ArcadeWorldGameState === "onboarding" ||
      window.ArcadeWorldGameState === "pregame" ||
      window.ArcadeMiniGameActive === true;
  }

  function createDebugUiService() {
    var listeners = [];
    var enabled = false;

    function notify() {
      for (var i = listeners.length - 1; i >= 0; i--) {
        try {
          listeners[i](enabled);
        } catch (err) {
          console.warn("[ArcadeDebugUi] onChange listener failed", err);
        }
      }
    }

    function setEnabled(value) {
      var next = value === true;
      if (enabled === next) {
        return enabled;
      }

      enabled = next;
      notify();
      console.log("[ArcadeDebugUi] Debug overlays " + (enabled ? "enabled" : "disabled"));
      return enabled;
    }

    function onKeyDown(evt) {
      if (!evt || evt.repeat || isTypingTarget(evt.target)) {
        return;
      }

      var isDigit2 = evt.key === "2" || evt.code === "Digit2";
      var isF8 = evt.key === "F8" || evt.code === "F8";
      if (!isDigit2 && !isF8) {
        return;
      }

      setEnabled(!enabled);
    }

    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("keydown", onKeyDown);
    }

    return {
      isEnabled: function () {
        return enabled;
      },
      isSuppressed: isSuppressedByGameState,
      shouldShow: function () {
        return enabled && !isSuppressedByGameState();
      },
      setEnabled: setEnabled,
      toggle: function () {
        return setEnabled(!enabled);
      },
      onChange: function (callback) {
        if (typeof callback !== "function") {
          return function () {};
        }

        listeners.push(callback);
        return function () {
          var index = listeners.indexOf(callback);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
        };
      }
    };
  }

  if (typeof window !== "undefined") {
    window.ArcadeDebugUi = window.ArcadeDebugUi || createDebugUiService();
  }
}());

var DebugUiToggle = pc.createScript("debugUiToggle");

DebugUiToggle.prototype.initialize = function () {
  // The shared service is installed when this attached PlayCanvas script asset loads.
};
