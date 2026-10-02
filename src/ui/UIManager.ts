import { Storage } from '../utils/Storage';
import { DefeatModal } from './DefeatModal';
import { HUD } from './HUD';
import { VictoryModal } from './VictoryModal';

export interface UIManagerEvents {
    onSelectLevel: (levelNum: number) => void;
    onRestartLevel: () => void;
    onNextLevel: () => void;
    onWatchAd: (rewardType: string) => Promise<boolean>;
    onToggleSound: () => boolean;
}

export class UIManager {
    private uiLayer: HTMLElement;
    private events: UIManagerEvents;

    public hud!: HUD;
    public victoryModal!: VictoryModal;
    public defeatModal!: DefeatModal;

    private hudEl!: HTMLElement;
    private menuEl!: HTMLElement;
    private modalEl!: HTMLElement;

    constructor(uiLayer: HTMLElement, events: UIManagerEvents) {
        this.uiLayer = uiLayer;
        this.events = events;
        this.setupDOM();
        this.initComponents();
    }

    private setupDOM(): void {
        this.uiLayer.innerHTML = `
      <div id="hud-container" class="hidden"></div>
      
      <div id="menu-screen">
        <div class="brand-header">
          <h1 class="game-title">ROYAL PUZZLE <span class="accent-crown">3D</span></h1>
          <p class="subtitle">Match 3D Jewels & Rule the Kingdom</p>
        </div>
        <div id="level-select-grid" class="grid-container"></div>
      </div>

      <div id="modal-container" class="modal hidden"></div>
      <div id="toast-container"></div>
      <div id="banner-ad-container" class="admob-banner-placeholder" style="display:none;">
        <div class="ad-banner-mock">
          <span class="ad-badge">AD</span>
          <span class="ad-title">Royal Kingdom Special Offer - Download Now!</span>
        </div>
      </div>
    `;

        this.hudEl = document.getElementById('hud-container') as HTMLElement;
        this.menuEl = document.getElementById('menu-screen') as HTMLElement;
        this.modalEl = document.getElementById('modal-container') as HTMLElement;
    }

    private initComponents(): void {
        this.hud = new HUD(this.hudEl, {
            onRestart: () => this.events.onRestartLevel(),
            onMenu: () => this.showMenuScreen(),
            onToggleSound: () => this.events.onToggleSound()
        });

        this.victoryModal = new VictoryModal(this.modalEl, {
            onNextLevel: () => this.events.onNextLevel(),
            onWatchAdExtraMoves: async () => {
                const success = await this.events.onWatchAd('extra_moves_win');
                if (success) this.showToast('🎉 Reward Claimed: +5 Bonus Moves!');
            },
            onMenu: () => this.showMenuScreen()
        });

        this.defeatModal = new DefeatModal(this.modalEl, {
            onRetry: () => this.events.onRestartLevel(),
            onWatchAdExtraMoves: async () => {
                const success = await this.events.onWatchAd('extra_moves_defeat');
                if (success) {
                    this.defeatModal.hide();
                    this.showToast('💪 +5 Extra Moves Added!');
                }
            },
            onMenu: () => this.showMenuScreen()
        });
    }

    public renderLevelSelectGrid(): void {
        const gridContainer = document.getElementById('level-select-grid');
        if (!gridContainer) return;

        const highestUnlocked = Storage.getHighestUnlockedLevel();

        let html = '';
        for (let l = 1; l <= 60; l++) {
            const isUnlocked = l <= highestUnlocked;
            const stars = Storage.getLevelStars(l);

            html += `
        <button class="level-btn ${isUnlocked ? 'unlocked' : 'locked'}" data-level="${l}" ${!isUnlocked ? 'disabled' : ''}>
          <span class="level-num">${l}</span>
          ${isUnlocked ? `<span class="level-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>` : '🔒'}
        </button>
      `;
        }

        gridContainer.innerHTML = html;

        gridContainer.querySelectorAll('.level-btn.unlocked').forEach((btn) => {
            btn.addEventListener('click', () => {
                const lvl = parseInt(btn.getAttribute('data-level') || '1', 10);
                this.hideMenuScreen();
                this.events.onSelectLevel(lvl);
            });
        });
    }

    public showMenuScreen(): void {
        this.renderLevelSelectGrid();
        this.hud.hide();
        this.modalEl.classList.add('hidden');
        this.menuEl.classList.remove('hidden');
    }

    public hideMenuScreen(): void {
        this.menuEl.classList.add('hidden');
    }

    public showToast(msg: string): void {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }
}
