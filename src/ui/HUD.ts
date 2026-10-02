import { LevelGoal } from '../utils/GameConstants';
import { Storage } from '../utils/Storage';

export interface HUDEvents {
  onRestart: () => void;
  onMenu: () => void;
  onToggleSound: () => boolean;
}

export class HUD {
  private container: HTMLElement;
  private events: HUDEvents;

  constructor(container: HTMLElement, events: HUDEvents) {
    this.container = container;
    this.events = events;
  }

  public render(levelNum: number, moves: number, maxMoves: number, score: number, goals: LevelGoal[]): void {
    const soundMuted = !Storage.isSoundEnabled();

    this.container.innerHTML = `
      <div class="hud-left">
        <button id="hud-btn-menu" class="icon-btn" title="Main Menu">☰</button>
        <div class="counter-box">
          <span class="label">MOVES</span>
          <span class="value">${maxMoves - moves}</span>
        </div>
      </div>

      <div class="hud-center">
        <span class="royal-badge">LEVEL ${levelNum}</span>
        <div class="goals-bar">
          ${goals
        .map(
          (g) => `
            <div class="goal-item">
              <span>${this.getGemIcon(g.targetType)}</span>
              <span>${g.currentCount}/${g.requiredCount}</span>
            </div>
          `
        )
        .join('')}
        </div>
      </div>

      <div class="hud-right">
        <div class="counter-box">
          <span class="label">SCORE</span>
          <span class="value">${score}</span>
        </div>
        <button id="hud-btn-restart" class="icon-btn" title="Restart">↺</button>
        <button id="hud-btn-sound" class="icon-btn" title="Sound">${soundMuted ? '🔇' : '🔊'}</button>
      </div>
    `;

    document.getElementById('hud-btn-menu')?.addEventListener('click', () => this.events.onMenu());
    document.getElementById('hud-btn-restart')?.addEventListener('click', () => this.events.onRestart());
    document.getElementById('hud-btn-sound')?.addEventListener('click', () => {
      const isMuted = !this.events.onToggleSound();
      const soundBtn = document.getElementById('hud-btn-sound');
      if (soundBtn) soundBtn.textContent = isMuted ? '🔇' : '🔊';
    });
  }

  private getGemIcon(type: string): string {
    switch (type) {
      case 'ruby': return '💎';
      case 'sapphire': return '🔷';
      case 'emerald': return '🟢';
      case 'topaz': return '⭐';
      case 'amethyst': return '💜';
      case 'crown': return '👑';
      default: return '💎';
    }
  }

  public show(): void {
    this.container.classList.remove('hidden');
  }

  public hide(): void {
    this.container.classList.add('hidden');
  }
}
