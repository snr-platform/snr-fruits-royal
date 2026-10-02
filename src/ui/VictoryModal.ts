export interface VictoryEvents {
    onNextLevel: () => void;
    onWatchAdExtraMoves: () => void;
    onMenu: () => void;
}

export class VictoryModal {
    private container: HTMLElement;
    private events: VictoryEvents;

    constructor(container: HTMLElement, events: VictoryEvents) {
        this.container = container;
        this.events = events;
    }

    public show(levelNum: number, score: number, stars: number, promptAd: boolean): void {
        this.container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-card">
        <div style="font-size:3.5rem; margin-bottom:8px;">🏆</div>
        <h2 class="modal-title">ROYAL VICTORY!</h2>
        <p class="modal-subtitle">Level ${levelNum} Completed Successfully</p>

        <div class="stars-display">
          <span class="star-item ${stars >= 1 ? 'active' : ''}">★</span>
          <span class="star-item ${stars >= 2 ? 'active' : ''}">★</span>
          <span class="star-item ${stars >= 3 ? 'active' : ''}">★</span>
        </div>

        <div style="background:rgba(15,23,42,0.6); padding:12px; border-radius:16px; margin-bottom:20px;">
          <span style="color:#94a3b8; font-size:0.8rem;">FINAL SCORE</span>
          <div style="color:#fcd34d; font-size:1.6rem; font-weight:900;">${score}</div>
        </div>

        <div class="modal-actions">
          <button id="victory-btn-next" class="btn btn-primary btn-glow">NEXT LEVEL ➔</button>
          ${promptAd ? `<button id="victory-btn-ad" class="btn btn-secondary btn-ad">🎬 Watch Ad for +5 Bonus Moves</button>` : ''}
          <button id="victory-btn-menu" class="btn btn-text">Select Level</button>
        </div>
      </div>
    `;

        document.getElementById('victory-btn-next')?.addEventListener('click', () => {
            this.hide();
            this.events.onNextLevel();
        });

        document.getElementById('victory-btn-ad')?.addEventListener('click', () => {
            this.events.onWatchAdExtraMoves();
        });

        document.getElementById('victory-btn-menu')?.addEventListener('click', () => {
            this.hide();
            this.events.onMenu();
        });

        this.container.classList.remove('hidden');
    }

    public hide(): void {
        this.container.classList.add('hidden');
    }
}
