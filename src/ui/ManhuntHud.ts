import type { ManhuntRoundSnapshot } from '../events/ManhuntRoundManager';

export class ManhuntHud {
  private readonly root: HTMLDivElement;
  private readonly stateLine: HTMLDivElement;
  private readonly teamLine: HTMLDivElement;
  private readonly timerLine: HTMLDivElement;
  private readonly countsLine: HTMLDivElement;
  private readonly messageLine: HTMLDivElement;
  private readonly resultsLine: HTMLDivElement;

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

    this.root.append(this.stateLine, this.teamLine, this.timerLine, this.countsLine, this.messageLine, this.resultsLine);
    container.appendChild(this.root);
  }

  public update(snapshot: ManhuntRoundSnapshot): void {
    this.stateLine.textContent = `State: ${snapshot.state}`;
    this.teamLine.textContent = `Team: ${snapshot.localPlayer?.team ?? 'unassigned'}${snapshot.localPlayer ? ` (${snapshot.localPlayer.roundPoints} pts)` : ''}`;
    this.timerLine.textContent = `Timer: ${snapshot.timerSeconds}s`;
    this.countsLine.textContent = `Hiders: ${snapshot.hidersSafe}/${snapshot.hiderTotal} safe · ${snapshot.hidersTagged}/${snapshot.hiderTotal} tagged`;
    this.messageLine.textContent = snapshot.message;

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

  private createLine(): HTMLDivElement {
    const line = document.createElement('div');
    line.style.marginTop = '2px';
    return line;
  }
}
