// ============================================================
// ROYAL GEMS - Economy & Monetization UI System
// Renders and controls HUD Top Bar, Lives/Health Popup,
// Shop Modal, Daily Login Modal, and In-Game Bonus Quick Bar.
// ============================================================

import { EconomyManager, BONUS_ITEM_DEFINITIONS, MAX_LIVES, MAX_HEALTH } from '../utils/EconomyManager';
import { BonusItemManager } from '../game/BonusItemManager';
import { AdManager } from '../ads/AdManager';

export class EconomyUI {
    private static initialized = false;
    private static activeGameState: any = null;

    public static setGameState(gs: any): void {
        this.activeGameState = gs;
    }

    public static init(): void {
        if (this.initialized) return;
        this.initialized = true;

        // Subscribe to economy state changes to auto-update HUD
        EconomyManager.subscribe(() => {
            this.updateHUD();
            this.updateShopUI();
            this.updateLivesModalUI();
        });

        // Initial render
        this.updateHUD();
        this.bindEvents();
    }

    private static formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    // ── HUD Top Bar Updating ──
    public static updateHUD(): void {
        // 1. Lives
        const livesEl = document.getElementById('hud-lives-val');
        const livesTimerEl = document.getElementById('hud-lives-timer');
        if (livesEl) livesEl.textContent = `${EconomyManager.getLives()}/${MAX_LIVES}`;
        if (livesTimerEl) {
            const sec = EconomyManager.getTimeToNextLife();
            livesTimerEl.textContent = sec > 0 ? this.formatTime(sec) : 'FULL';
        }

        // 2. Coins
        const coinsEl = document.getElementById('hud-coins-val');
        if (coinsEl) coinsEl.textContent = String(EconomyManager.getCoins());
        const moneyVal = document.getElementById('money-val');
        if (moneyVal) moneyVal.textContent = String(EconomyManager.getCoins());

        // 3. Daily Free Attempts badge
        const freeBadge = document.getElementById('hud-free-attempts');
        if (freeBadge) {
            const count = EconomyManager.getDailyFreeAttempts();
            freeBadge.style.display = count > 0 ? 'inline-block' : 'none';
            freeBadge.textContent = `⚡ 3 FREE (${count} Left)`;
        }

        // 4. Daily Gift indicator badge
        const dailyBtn = document.getElementById('btn-daily-gift');
        if (dailyBtn) {
            const canClaim = EconomyManager.canClaimDailyReward();
            dailyBtn.classList.toggle('pulse-gift', canClaim);
        }

        // 5. Total Booster Count Badge
        const boosterBadge = document.getElementById('booster-total-count');
        if (boosterBadge) {
            let total = 0;
            for (let i = 1; i <= 10; i++) {
                total += EconomyManager.getBonusQty(i);
            }
            boosterBadge.textContent = String(total);
        }
    }

    // ── In-Game Booster Drawer Update ──
    public static updateInGameBoosterDrawer(): void {
        const gridContainer = document.getElementById('in-game-booster-grid');
        if (!gridContainer) return;

        const isUsed = BonusItemManager.isActivatedThisAttempt();
        let html = '';

        for (let i = 1; i <= 10; i++) {
            const def = BONUS_ITEM_DEFINITIONS[i];
            const qty = EconomyManager.getBonusQty(i);
            const canUse = !isUsed && qty > 0;

            html += `
                <div class="shop-item-card">
                    <img class="shop-item-icon" src="${def.icon}" alt="${def.name}">
                    <div class="shop-item-info">
                        <div class="shop-item-title">${def.name} <span class="shop-qty">(${qty}/5)</span></div>
                        <div class="shop-item-desc">${def.description}</div>
                    </div>
                    ${canUse ? `
                        <button class="modal-btn btn-gold btn-use-booster" data-booster-id="${i}">
                            ⚡ USE
                        </button>
                    ` : qty > 0 ? `
                        <button class="modal-btn btn-ghost" disabled>
                            USED
                        </button>
                    ` : `
                        <button class="btn-buy-item btn-buy-booster-direct" data-buy-bonus-id="${i}">
                            💰 ${def.price}
                        </button>
                    `}
                </div>
            `;
        }

        gridContainer.innerHTML = html;

        // Bind "USE" buttons
        gridContainer.querySelectorAll('.btn-use-booster').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-booster-id') || '0', 10);
                if (id > 0 && this.activeGameState) {
                    const result = await BonusItemManager.activateBonus(id, this.activeGameState);
                    this.showToast(result.message);
                    this.updateHUD();
                    this.hideModal('booster-drawer-modal');
                }
            });
        });

        // Bind direct "BUY" buttons inside drawer
        gridContainer.querySelectorAll('.btn-buy-booster-direct').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-buy-bonus-id') || '0', 10);
                const res = EconomyManager.buyBonusItem(id);
                if (res.success) {
                    this.showToast(`✅ Bought 1x ${BONUS_ITEM_DEFINITIONS[id].name}!`);
                    this.updateInGameBoosterDrawer();
                    this.updateHUD();
                } else {
                    this.showToast(`❌ ${res.reason}`);
                }
            });
        });
    }

    public static updateInGameBonusBar(): void {
        this.updateHUD();
    }

    // ── Shop Modal ──
    public static updateShopUI(): void {
        const shopContainer = document.getElementById('shop-items-grid');
        if (!shopContainer) return;

        let html = '';
        for (let i = 1; i <= 10; i++) {
            const def = BONUS_ITEM_DEFINITIONS[i];
            const qty = EconomyManager.getBonusQty(i);

            html += `
                <div class="shop-item-card">
                    <img class="shop-item-icon" src="${def.icon}" alt="${def.name}">
                    <div class="shop-item-info">
                        <div class="shop-item-title">${def.name} <span class="shop-qty">(${qty}/5)</span></div>
                        <div class="shop-item-desc">${def.description}</div>
                    </div>
                    <button class="btn-buy-item" data-buy-bonus-id="${i}">
                        💰 ${def.price}
                    </button>
                </div>
            `;
        }

        shopContainer.innerHTML = html;

        shopContainer.querySelectorAll('.btn-buy-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-buy-bonus-id') || '0', 10);
                const res = EconomyManager.buyBonusItem(id);
                if (res.success) {
                    this.showToast(`✅ Bought 1x ${BONUS_ITEM_DEFINITIONS[id].name}!`);
                } else {
                    this.showToast(`❌ ${res.reason}`);
                }
            });
        });
    }

    // ── Lives Modal ──
    public static updateLivesModalUI(): void {
        const livesVal = document.getElementById('modal-lives-val');
        const livesTimer = document.getElementById('modal-lives-timer');

        if (livesVal) livesVal.textContent = `${EconomyManager.getLives()}/${MAX_LIVES}`;
        if (livesTimer) {
            const sec = EconomyManager.getTimeToNextLife();
            livesTimer.textContent = sec > 0 ? `Next life in: ${this.formatTime(sec)}` : 'Lives Full!';
        }

        const adLivesCount = EconomyManager.getAdCount('rewarded_lives');
        const btnAdLife = document.getElementById('btn-ad-life');
        if (btnAdLife) btnAdLife.textContent = `🎬 Watch Ad (+1 Life) [${adLivesCount}/3]`;
    }

    // ── Modal Bindings ──
    private static bindEvents(): void {
        // Open Lives Modal when clicking Lives on HUD
        document.getElementById('hud-lives-box')?.addEventListener('click', () => this.showModal('lives-modal'));

        // Open In-Game Booster Drawer
        document.getElementById('btn-open-booster-drawer')?.addEventListener('click', () => {
            this.updateInGameBoosterDrawer();
            this.showModal('booster-drawer-modal');
        });

        // Open Shop Modal (Top bar or In-Game HUD)
        const openShop = () => {
            this.updateShopUI();
            this.showModal('shop-modal');
        };
        document.getElementById('btn-open-shop')?.addEventListener('click', openShop);
        document.getElementById('btn-in-game-shop')?.addEventListener('click', openShop);

        // Open Daily Login Modal
        document.getElementById('btn-daily-gift')?.addEventListener('click', () => {
            this.renderDailyLoginUI();
            this.showModal('daily-modal');
        });

        // Close buttons for modals
        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = (e.currentTarget as HTMLElement).getAttribute('data-close-modal');
                if (targetId) this.hideModal(targetId);
            });
        });

        // Lives Modal actions
        document.getElementById('btn-buy-life')?.addEventListener('click', () => {
            const res = EconomyManager.buyLife();
            if (res.success) this.showToast('❤️ +1 Life purchased!');
            else this.showToast(`❌ ${res.reason}`);
        });

        document.getElementById('btn-ad-life')?.addEventListener('click', async () => {
            if (EconomyManager.getAdCount('rewarded_lives') >= 3) {
                this.showToast('⚠️ Daily ad limit reached (3/3)!');
                return;
            }
            const rewarded = await AdManager.showRewardedAd('+1 Life');
            if (rewarded) {
                EconomyManager.addLives(1);
                EconomyManager.incrementAdCount('rewarded_lives');
                this.showToast('🎉 Reward Claimed: +1 Life!');
            }
        });

        // Shop Modal: Watch Ad for Coins
        document.getElementById('btn-shop-ad-coins')?.addEventListener('click', async () => {
            const rewarded = await AdManager.showRewardedAd('+100 Coins');
            if (rewarded) {
                EconomyManager.addCoins(100);
                EconomyManager.incrementAdCount('rewarded_coins');
                this.showToast('💰 +100 Coins Claimed!');
            }
        });
    }

    private static renderDailyLoginUI(): void {
        const canClaim = EconomyManager.canClaimDailyReward();
        const claimBtn = document.getElementById('btn-claim-daily');
        const statusText = document.getElementById('daily-status-text');

        if (claimBtn) {
            (claimBtn as HTMLButtonElement).disabled = !canClaim;
            claimBtn.textContent = canClaim ? 'CLAIM DAILY GIFT 🎁' : 'ALREADY CLAIMED TODAY ✅';
        }

        if (statusText) {
            statusText.textContent = canClaim
                ? 'Claim your free daily gift: 💰 +50 Coins, ❤️ +1 Life, 🎁 +1 Bonus Gem!'
                : 'Come back tomorrow for your next daily reward!';
        }

        if (claimBtn && canClaim) {
            claimBtn.onclick = () => {
                const res = EconomyManager.claimDailyReward();
                if (res) {
                    const bDef = BONUS_ITEM_DEFINITIONS[res.bonusId];
                    this.showToast(`🎁 Claimed: 💰+50, ❤️+1, 🎁1x ${bDef.name}!`);
                    this.renderDailyLoginUI();
                    this.updateHUD();
                }
            };
        }
    }

    public static showModal(id: string): void {
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
    }

    public static hideModal(id: string): void {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    }

    public static showToast(msg: string): void {
        const t = document.getElementById('toast');
        if (t) {
            t.textContent = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 2800);
        }
    }
}
