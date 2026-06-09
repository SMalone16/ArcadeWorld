/* global window, document */

(function () {
  function calculateTicketReward(score) {
    if (score <= 0) return 1;
    if (score <= 2) return 2;
    if (score <= 4) return 4;
    if (score <= 7) return 6;
    if (score <= 11) return 8;
    return 10;
  }

  function clampTickets(value) {
    return Math.max(1, Math.min(10, Math.floor(value || 0)));
  }

  function TicketSnakeGame(options) {
    this.options = options || {};
    this.networkClient = this.options.networkClient || null;
    this.onClose = this.options.onClose || null;
    this.state = "closed";
    this.gridSize = 18;
    this.cellSize = 24;
    this.score = 0;
    this.ticketsEarned = 1;
    this.snake = [];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this.food = { x: 10, y: 9 };
    this.stepMs = 170;
    this.stepTimer = 0;
    this.lastTime = 0;
    this.awardSent = false;
    this._rafId = 0;
    this._onKeyDownBound = this._onKeyDown.bind(this);
    this._tickBound = this._tick.bind(this);
  }

  TicketSnakeGame.calculateTicketReward = function (score) {
    return clampTickets(calculateTicketReward(Math.floor(score || 0)));
  };

  TicketSnakeGame.prototype.open = function () {
    if (this.state !== "closed") return;
    this._buildDom();
    this.state = "title";
    window.ArcadeMiniGameActive = true;
    if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
    document.addEventListener("keydown", this._onKeyDownBound, true);
    this.lastTime = performance.now();
    this._rafId = window.requestAnimationFrame(this._tickBound);
    this._render();
  };

  TicketSnakeGame.prototype.close = function () {
    if (this.state === "closed") return;
    this.state = "closed";
    window.ArcadeMiniGameActive = false;
    document.removeEventListener("keydown", this._onKeyDownBound, true);
    if (this._rafId) window.cancelAnimationFrame(this._rafId);
    this._rafId = 0;
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
    if (this.onClose) this.onClose({ score: this.score, tickets: this.ticketsEarned });
  };

  TicketSnakeGame.prototype._buildDom = function () {
    var root = document.createElement("div");
    root.setAttribute("data-ticket-snake-overlay", "true");
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.background = "rgba(3, 8, 18, 0.72)";
    root.style.display = "flex";
    root.style.alignItems = "center";
    root.style.justifyContent = "center";
    root.style.zIndex = "10000";
    root.style.fontFamily = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    root.style.color = "#fff";

    var panel = document.createElement("div");
    panel.style.width = "min(92vw, 620px)";
    panel.style.borderRadius = "22px";
    panel.style.padding = "22px";
    panel.style.background = "rgba(10, 16, 30, 0.94)";
    panel.style.boxShadow = "0 24px 80px rgba(0,0,0,0.55)";
    panel.style.textAlign = "center";
    panel.style.border = "1px solid rgba(255,255,255,0.16)";

    this.titleEl = document.createElement("div");
    this.titleEl.style.fontSize = "38px";
    this.titleEl.style.fontWeight = "900";
    this.titleEl.style.marginBottom = "10px";

    this.infoEl = document.createElement("div");
    this.infoEl.style.fontSize = "18px";
    this.infoEl.style.lineHeight = "1.5";
    this.infoEl.style.color = "#d9f2ff";
    this.infoEl.style.marginBottom = "16px";

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.gridSize * this.cellSize;
    this.canvas.height = this.gridSize * this.cellSize;
    this.canvas.style.width = "min(78vw, " + this.canvas.width + "px)";
    this.canvas.style.height = "min(78vw, " + this.canvas.height + "px)";
    this.canvas.style.background = "#07111f";
    this.canvas.style.borderRadius = "12px";
    this.canvas.style.border = "3px solid rgba(255,255,255,0.22)";
    this.canvas.style.imageRendering = "pixelated";
    this.ctx = this.canvas.getContext("2d");

    this.footerEl = document.createElement("div");
    this.footerEl.style.marginTop = "14px";
    this.footerEl.style.fontSize = "16px";
    this.footerEl.style.color = "#aee7ff";

    panel.appendChild(this.titleEl);
    panel.appendChild(this.infoEl);
    panel.appendChild(this.canvas);
    panel.appendChild(this.footerEl);
    root.appendChild(panel);
    document.body.appendChild(root);
    this.root = root;
  };

  TicketSnakeGame.prototype._startPlaying = function () {
    var mid = Math.floor(this.gridSize / 2);
    this.snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this.score = 0;
    this.ticketsEarned = 1;
    this.stepMs = 170;
    this.stepTimer = 0;
    this.awardSent = false;
    this._spawnFood();
    this.state = "playing";
  };

  TicketSnakeGame.prototype._onKeyDown = function (event) {
    if (this.state === "closed") return;
    var key = event.key || "";
    var handled = false;

    if (this.state === "title" && (key === " " || key === "Spacebar" || event.code === "Space")) {
      this._startPlaying();
      handled = true;
    } else if (this.state === "gameOver" && (key === "e" || key === "E" || event.code === "KeyE")) {
      this.close();
      handled = true;
    } else if (this.state === "playing") {
      handled = this._setDirectionForKey(key, event.code);
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  TicketSnakeGame.prototype._setDirectionForKey = function (key, code) {
    var next = null;
    if (key === "ArrowUp" || key === "w" || key === "W" || code === "KeyW") next = { x: 0, y: -1 };
    if (key === "ArrowDown" || key === "s" || key === "S" || code === "KeyS") next = { x: 0, y: 1 };
    if (key === "ArrowLeft" || key === "a" || key === "A" || code === "KeyA") next = { x: -1, y: 0 };
    if (key === "ArrowRight" || key === "d" || key === "D" || code === "KeyD") next = { x: 1, y: 0 };
    if (!next) return false;
    if (next.x + this.direction.x === 0 && next.y + this.direction.y === 0) return true;
    this.nextDirection = next;
    return true;
  };

  TicketSnakeGame.prototype._tick = function (now) {
    var dt = now - this.lastTime;
    this.lastTime = now;
    if (this.state === "playing") {
      this.stepTimer += dt;
      while (this.stepTimer >= this.stepMs) {
        this.stepTimer -= this.stepMs;
        this._stepSnake();
      }
    }
    this._render();
    if (this.state !== "closed") this._rafId = window.requestAnimationFrame(this._tickBound);
  };

  TicketSnakeGame.prototype._stepSnake = function () {
    this.direction = { x: this.nextDirection.x, y: this.nextDirection.y };
    var head = this.snake[0];
    var nextHead = { x: head.x + this.direction.x, y: head.y + this.direction.y };
    if (this._isWall(nextHead) || this._isSnakeCell(nextHead)) {
      this._gameOver();
      return;
    }
    this.snake.unshift(nextHead);
    if (nextHead.x === this.food.x && nextHead.y === this.food.y) {
      this.score += 1;
      if (this.score % 3 === 0) this.stepMs = Math.max(95, this.stepMs - 12);
      this._spawnFood();
    } else {
      this.snake.pop();
    }
  };

  TicketSnakeGame.prototype._gameOver = function () {
    this.ticketsEarned = TicketSnakeGame.calculateTicketReward(this.score);
    this.state = "gameOver";
    if (!this.awardSent && this.networkClient && this.networkClient.sendMiniGameTicketAward) {
      this.awardSent = true;
      this.networkClient.sendMiniGameTicketAward("ticket-snake", this.score, this.ticketsEarned);
    }
  };

  TicketSnakeGame.prototype._spawnFood = function () {
    var empty = [];
    for (var y = 0; y < this.gridSize; y++) {
      for (var x = 0; x < this.gridSize; x++) {
        if (!this._isSnakeCell({ x: x, y: y })) empty.push({ x: x, y: y });
      }
    }
    this.food = empty[Math.floor(Math.random() * empty.length)] || { x: 0, y: 0 };
  };

  TicketSnakeGame.prototype._isWall = function (cell) {
    return cell.x < 0 || cell.y < 0 || cell.x >= this.gridSize || cell.y >= this.gridSize;
  };

  TicketSnakeGame.prototype._isSnakeCell = function (cell) {
    for (var i = 0; i < this.snake.length; i++) {
      if (this.snake[i].x === cell.x && this.snake[i].y === cell.y) return true;
    }
    return false;
  };

  TicketSnakeGame.prototype._render = function () {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#07111f";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawGrid();
    if (this.state !== "title") this._drawGamePieces();

    if (this.state === "title") {
      this.titleEl.textContent = "Ticket Snake";
      this.infoEl.innerHTML = "Collect tickets. Don't crash.<br>WASD / Arrow Keys to move.<br>Press Space to Start.";
      this.footerEl.textContent = "Earn 1–10 tickets based on your score.";
    } else if (this.state === "playing") {
      this.titleEl.textContent = "Ticket Snake";
      this.infoEl.textContent = "Score: " + this.score;
      this.footerEl.textContent = "WASD / Arrow Keys to move.";
    } else if (this.state === "gameOver") {
      this.titleEl.textContent = "Game Over";
      this.infoEl.innerHTML = "Score: " + this.score + "<br>Tickets earned: " + this.ticketsEarned + "<br>Press E to Return";
      this.footerEl.textContent = this.awardSent ? "Tickets sent to the server." : "Offline: tickets shown locally only.";
    }
  };

  TicketSnakeGame.prototype._drawGrid = function () {
    this.ctx.strokeStyle = "rgba(255,255,255,0.05)";
    this.ctx.lineWidth = 1;
    for (var i = 0; i <= this.gridSize; i++) {
      var p = i * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(p, 0);
      this.ctx.lineTo(p, this.canvas.height);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0, p);
      this.ctx.lineTo(this.canvas.width, p);
      this.ctx.stroke();
    }
  };

  TicketSnakeGame.prototype._drawGamePieces = function () {
    this.ctx.fillStyle = "#ffd166";
    this._fillCell(this.food.x, this.food.y, 5);
    for (var i = this.snake.length - 1; i >= 0; i--) {
      this.ctx.fillStyle = i === 0 ? "#80ffdb" : "#48cae4";
      this._fillCell(this.snake[i].x, this.snake[i].y, 4);
    }
  };

  TicketSnakeGame.prototype._fillCell = function (x, y, inset) {
    this.ctx.fillRect(x * this.cellSize + inset, y * this.cellSize + inset, this.cellSize - inset * 2, this.cellSize - inset * 2);
  };

  window.TicketSnakeGame = TicketSnakeGame;
})();
