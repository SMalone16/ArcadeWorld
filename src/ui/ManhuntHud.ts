import type { ManhuntRoundSnapshot } from '../events/ManhuntRoundManager';

export class ManhuntHud {
  private readonly root: HTMLDivElement;
  private readonly stateLine: HTMLDivElement;
  private readonly teamLine: HTMLDivElement;
  private readonly timerLine: HTMLDivElement;
  private readonly countsLine: HTMLDivElement;
  private readonly messageLine: HTMLDivElement;
  private readonly resultsLine: HTMLDivElement;
  private readonly debugSection: HTMLDivElement;

  public constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.position = 'fixed';
    this.root.style.left = '16px';
    this.root.style.top = '16px';
    this.root.style.padding = '12px 14px';
    this.root.style.minWidth = '260px';
    this.root.style.maxWidth = '360px';
    this.root.style.borderRadius = '14px';
    this.root.style.background = 'rgba(10, 14, 22, 0.72)';
    this.root.style.color = '#f8fbff';
    this.root.style.fontSize = '14px';
    this.root.style.lineHeight = '1.45';
    this.root.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.25)';
    this.root.style.pointerEvents = 'none';

    const title = document.createElement('div');
    title.textContent = 'Manhunt Event';
    title.style.fontWeight = '800';
    title.style.fontSize = '16px';
    title.style.marginBottom = '6px';
    this.root.appendChild(title);

    this.stateLine = this.createLine();
    this.teamLine = this.createLine();
    this.timerLine = this.createLine();
    this.countsLine = this.createLine();
    this.messageLine = this.createLine();
    this.resultsLine = this.createLine();
    this.resultsLine.style.whiteSpace = 'pre-line';
    this.resultsLine.style.marginTop = '8px';
    this.debugSection = this.createLine();
    this.debugSection.style.whiteSpace = 'pre-line';
    this.debugSection.style.marginTop = '10px';
    this.debugSection.style.paddingTop = '8px';
    this.debugSection.style.borderTop = '1px solid rgba(255, 255, 255, 0.22)';
    this.debugSection.style.fontFamily = 'ui-monospace, SFMono-Regular, Consolas, monospace';
    this.debugSection.style.fontSize = '12px';

    this.root.append(this.stateLine, this.teamLine, this.timerLine, this.countsLine, this.messageLine, this.resultsLine, this.debugSection);
    container.appendChild(this.root);
  }

  public update(snapshot: ManhuntRoundSnapshot): void {
    this.stateLine.textContent = `State: ${snapshot.state}`;
    this.teamLine.textContent = `Team: ${snapshot.localPlayer?.team ?? 'unassigned'}${snapshot.localPlayer ? ` (${snapshot.localPlayer.roundPoints} pts)` : ''}`;
    this.timerLine.textContent = `Timer: ${snapshot.timerSeconds}s`;
    this.countsLine.textContent = `Hiders: ${snapshot.hidersSafe}/${snapshot.hiderTotal} safe · ${snapshot.hidersTagged}/${snapshot.hiderTotal} tagged`;
    this.messageLine.textContent = snapshot.message;

    this.updateDebugSection(snapshot);

    if (snapshot.state === 'roundOver' && snapshot.results.length > 0) {
      const lines = snapshot.results
        .slice()
        .sort((a, b) => b.roundPoints - a.roundPoints)
        .map((player) => `${player.playerId}: ${player.team}, ${player.roundPoints} pts${player.isSafe ? ' (safe)' : ''}${player.isTagged ? ' (tagged)' : ''}`);
      this.resultsLine.textContent = `Results:\n${lines.join('\n')}`;
    } else {
      this.resultsLine.textContent = 'Controls: M start/reset · E tag/interact · Shift sprint · Space jump';
    }
  }


  private updateDebugSection(snapshot: ManhuntRoundSnapshot): void {
    const debug = snapshot.debug;
    this.debugSection.style.display = debug.showDebugInfo ? 'block' : 'none';
    if (!debug.showDebugInfo) {
      this.debugSection.textContent = '';
      return;
    }

    this.debugSection.textContent = [
      '[ManhuntDebug] TEMP start validation',
      `LocalPlayer: ${this.formatVector(debug.localPlayerPosition)}`,
      `SafeZone entity: ${this.formatVector(debug.safeZonePosition)}`,
      `Client distanceXZ: ${this.formatNumber(debug.clientDistanceXZ)}`,
      `Client safeZoneRadius: ${this.formatNumber(debug.clientSafeZoneRadius)}`,
      `Server Home Base: ${this.formatHomeBase(debug.serverHomeBase)}`,
      `Server local player: ${this.formatVector(debug.serverKnownLocalPlayer)}`,
      `Local - server diff: ${this.formatVector(debug.localVsServerDelta)}`,
      `Last server feedback: ${debug.lastServerFeedbackMessage || '(none)'}`
    ].join('\n');
  }

  private formatVector(vector: { x: number; y: number; z: number } | null): string {
    if (!vector) {
      return '(unavailable)';
    }

    return `x=${this.formatNumber(vector.x)} y=${this.formatNumber(vector.y)} z=${this.formatNumber(vector.z)}`;
  }

  private formatHomeBase(homeBase: { x: number; y: number; z: number; radius: number } | null): string {
    if (!homeBase) {
      return '(unavailable)';
    }

    return `${this.formatVector(homeBase)} r=${this.formatNumber(homeBase.radius)}`;
  }

  private formatNumber(value: number | null): string {
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '(unavailable)';
  }

  private createLine(): HTMLDivElement {
    const line = document.createElement('div');
    line.style.marginTop = '2px';
    return line;
  }
}
