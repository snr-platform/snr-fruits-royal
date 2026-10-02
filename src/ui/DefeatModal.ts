export interface DefeatEvents {
    onRetry: () => void;
    onWatchAdExtraMoves: () => void;
    onMenu: () => void;
}

export class DefeatModal {
    private container: HTMLElement;
    private events: DefeatEvents;

    constructor(container: HTMLElement, events: DefeatEvents) {
        this.container = container;
        this.events = events;
    }

    public show(): void {
        this.container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-card" style="border-color:#ef4444;">
        <div style="font-size:3.5rem; margin-bottom:8px;">⏳</div>
        <h2 class="modal-title" style="color:#ef4444;">OUT OF MOVES!</h2>
        <p class="modal-subtitle">Don't give up! Claim extra moves or try again.</p>

        <div class="modal-actions">
          <button id="defeat-btn-ad" class="btn btn-primary btn-ad btn-glow">🎬 Watch Ad for +5 Extra Moves</button>
          <button id="defeat-btn-retry" class="btn btn-secondary">↺ Retry Level</button>
          <button id="defeat-btn-menu" class="btn btn-text">Select Level</button>
        </div>
      </div>
    `;

        document.getElementById('defeat-btn-ad')?.addEventListener('click', () => {
            this.events.onWatchAdExtraMoves();
        });

        document.getElementById('defeat-btn-retry')?.addEventListener('click', () => {
            this.hide();
            this.events.onRetry();
        });

        document.getElementById('defeat-btn-menu')?.addEventListener('click', () => {
            this.hide();
            this.events.onMenu();
        });

        this.container.classList.remove('hidden');
    }

    public hide(): void {
        this.container.classList.add('hidden');
    }
}
