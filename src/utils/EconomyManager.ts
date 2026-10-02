// ============================================================
// ROYAL GEMS - Centralized Economy & Persistence Manager
// Handles Lives, Health, Coins, 10 Bonus Items, Regeneration Timers,
// Daily Login, Win Streaks, Ad Limits, and Anti-Frustration Rules.
// ============================================================

export interface BonusItemDef {
    id: number;
    name: string;
    icon: string; // /icons/Bonus-Gems/x.PNG
    price: number;
    description: string;
}

export const BONUS_ITEM_DEFINITIONS: Record<number, BonusItemDef> = {
    1: { id: 1, name: "Extra Move", icon: "/icons/Bonus-Gems/1.PNG", price: 80, description: "+15s Extra Time" },
    2: { id: 2, name: "Star Boost", icon: "/icons/Bonus-Gems/2.PNG", price: 120, description: "Boosts Score & Star Count" },
    3: { id: 3, name: "Gem Magnet", icon: "/icons/Bonus-Gems/3.PNG", price: 150, description: "Auto-matches 1 Full Color" },
    4: { id: 4, name: "Shuffle", icon: "/icons/Bonus-Gems/4.PNG", price: 200, description: "Reshuffles Entire Board" },
    5: { id: 5, name: "Mystery Box", icon: "/icons/Bonus-Gems/5.PNG", price: 180, description: "Random Coins or Bonus Reward" },
    6: { id: 6, name: "Lightning", icon: "/icons/Bonus-Gems/6.PNG", price: 250, description: "Cross Row & Column Blast" },
    7: { id: 7, name: "Freeze", icon: "/icons/Bonus-Gems/7.PNG", price: 220, description: "+10s Level Time Freeze" },
    8: { id: 8, name: "Hammer", icon: "/icons/Bonus-Gems/8.PNG", price: 300, description: "Smashes Board Obstacles" },
    9: { id: 9, name: "Rainbow", icon: "/icons/Bonus-Gems/9.PNG", price: 400, description: "Clears All Gems of 1 Color" },
    10: { id: 10, name: "Crown", icon: "/icons/Bonus-Gems/10.PNG", price: 500, description: "+1000 Pts & Clears Target" },
};

const STORAGE_KEY = 'snr_royal_gems_economy_v1';

export interface EconomyState {
    lives: number;
    lastLifeRegenTime: number; // timestamp
    health: number;
    lastHealthRegenTime: number; // timestamp
    coins: number;
    bonuses: Record<number, number>; // itemId -> qty (max 5)
    dailyFreeAttempts: number;
    lastFreeAttemptDate: string;
    lastDailyLoginDate: string;
    winStreak: number;
    levelFailures: Record<number, number>; // levelId -> failure count
    adCounts: Record<string, number>; // key -> count for today
}

const LIFE_REGEN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const HEALTH_REGEN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_LIVES = 5;
export const MAX_HEALTH = 10;
export const MIN_HEALTH = 1;
export const MAX_BONUS_QTY = 5;
export const DAILY_FREE_ATTEMPTS = 3;

export class EconomyManager {
    private static state: EconomyState = EconomyManager.loadState();
    private static listeners: Set<() => void> = new Set();
    private static tickerId: ReturnType<typeof setInterval> | null = null;

    private static getTodayDateString(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    private static getDefaultState(): EconomyState {
        const now = Date.now();
        return {
            lives: MAX_LIVES,
            lastLifeRegenTime: now,
            health: MAX_HEALTH,
            lastHealthRegenTime: now,
            coins: 100, // starting coins
            bonuses: { 1: 2, 2: 2, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1 },
            dailyFreeAttempts: DAILY_FREE_ATTEMPTS,
            lastFreeAttemptDate: EconomyManager.getTodayDateString(),
            lastDailyLoginDate: '',
            winStreak: 0,
            levelFailures: {},
            adCounts: {}
        };
    }

    private static loadState(): EconomyState {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                const defaults = EconomyManager.getDefaultState();
                const merged: EconomyState = { ...defaults, ...parsed };
                // ensure bonuses dict has 1..10
                for (let i = 1; i <= 10; i++) {
                    if (merged.bonuses[i] === undefined) merged.bonuses[i] = 1;
                }
                return merged;
            }
        } catch (e) {
            console.warn('[EconomyManager] Error loading state, reset to default:', e);
        }
        return EconomyManager.getDefaultState();
    }

    public static saveState(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
            this.notifyListeners();
        } catch (e) {
            console.warn('[EconomyManager] Error saving state:', e);
        }
    }

    public static init(): void {
        this.updateRegenTimers();
        this.checkDailyReset();
        if (this.tickerId === null) {
            this.tickerId = setInterval(() => {
                this.updateRegenTimers();
            }, 1000);
        }
    }

    public static subscribe(callback: () => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private static notifyListeners(): void {
        this.listeners.forEach(cb => cb());
    }

    private static checkDailyReset(): void {
        const today = this.getTodayDateString();
        if (this.state.lastFreeAttemptDate !== today) {
            this.state.dailyFreeAttempts = DAILY_FREE_ATTEMPTS;
            this.state.lastFreeAttemptDate = today;
            // Clear daily ad counts for new day
            this.state.adCounts = {};
            this.saveState();
        }
    }

    public static updateRegenTimers(): void {
        const now = Date.now();
        let changed = false;

        // 1. Lives Regen (1 life every 15 min)
        if (this.state.lives < MAX_LIVES) {
            const elapsed = now - this.state.lastLifeRegenTime;
            if (elapsed >= LIFE_REGEN_INTERVAL_MS) {
                const livesToAdd = Math.floor(elapsed / LIFE_REGEN_INTERVAL_MS);
                this.state.lives = Math.min(MAX_LIVES, this.state.lives + livesToAdd);
                this.state.lastLifeRegenTime = now - (elapsed % LIFE_REGEN_INTERVAL_MS);
                changed = true;
            }
        } else {
            this.state.lastLifeRegenTime = now;
        }

        // 2. Health Regen (1 health every 10 min)
        if (this.state.health < MAX_HEALTH) {
            const elapsed = now - this.state.lastHealthRegenTime;
            if (elapsed >= HEALTH_REGEN_INTERVAL_MS) {
                const healthToAdd = Math.floor(elapsed / HEALTH_REGEN_INTERVAL_MS);
                this.state.health = Math.min(MAX_HEALTH, this.state.health + healthToAdd);
                this.state.lastHealthRegenTime = now - (elapsed % HEALTH_REGEN_INTERVAL_MS);
                changed = true;
            }
        } else {
            this.state.lastHealthRegenTime = now;
        }

        if (changed) this.saveState();
        else this.notifyListeners();
    }

    // ── Getters ──
    public static getLives(): number { return this.state.lives; }
    public static getHealth(): number { return this.state.health; }
    public static getCoins(): number { return this.state.coins; }
    public static getDailyFreeAttempts(): number { return this.state.dailyFreeAttempts; }
    public static getWinStreak(): number { return this.state.winStreak; }
    public static getBonusQty(id: number): number { return this.state.bonuses[id] ?? 0; }

    public static getTimeToNextLife(): number { // seconds
        if (this.state.lives >= MAX_LIVES) return 0;
        const elapsed = Date.now() - this.state.lastLifeRegenTime;
        const remaining = Math.max(0, LIFE_REGEN_INTERVAL_MS - elapsed);
        return Math.ceil(remaining / 1000);
    }

    public static getTimeToNextHealth(): number { // seconds
        if (this.state.health >= MAX_HEALTH) return 0;
        const elapsed = Date.now() - this.state.lastHealthRegenTime;
        const remaining = Math.max(0, HEALTH_REGEN_INTERVAL_MS - elapsed);
        return Math.ceil(remaining / 1000);
    }

    // ── Level Attempt Management ──
    public static canStartLevel(): boolean {
        this.checkDailyReset();
        if (this.state.dailyFreeAttempts > 0) return true;
        return this.state.lives > 0;
    }

    public static consumeLevelAttempt(): boolean {
        this.checkDailyReset();
        if (this.state.dailyFreeAttempts > 0) {
            this.state.dailyFreeAttempts--;
            this.saveState();
            return true;
        }
        if (this.state.lives > 0) {
            if (this.state.lives === MAX_LIVES) {
                this.state.lastLifeRegenTime = Date.now();
            }
            this.state.lives--;
            this.saveState();
            return true;
        }
        return false;
    }

    public static handleLevelWin(levelId: number, stars: number, isFirstTimeWin: boolean = false): {
        coinsEarned: number;
        livesEarned: number;
        streakBonus: boolean;
    } {
        let coinsEarned = 25; // base win coins
        let livesEarned = 0;

        if (isFirstTimeWin) coinsEarned += 10;
        if (stars === 3) {
            coinsEarned += 50; // 3-star bonus
            livesEarned += 1;  // 3-star win = +1 Life
        }

        // Win streak tracking
        this.state.winStreak++;
        let streakBonus = false;

        if (this.state.winStreak === 3) {
            livesEarned += 1; // 3 win streak = +1 life
            streakBonus = true;
        } else if (this.state.winStreak >= 5) {
            coinsEarned += 100; // 5+ win streak = 100 coins
            streakBonus = true;
        }

        // World completion (Level 20, 40, 60, 80, 100)
        if (levelId % 20 === 0 && isFirstTimeWin) {
            coinsEarned += 200;
            livesEarned += 2;
        }

        // Apply lives & coins
        if (livesEarned > 0) this.addLives(livesEarned);
        this.addCoins(coinsEarned);

        // Reset level failure count
        delete this.state.levelFailures[levelId];
        this.saveState();

        return { coinsEarned, livesEarned, streakBonus };
    }

    public static handleLevelDefeat(levelId: number): void {
        // Reset win streak
        this.state.winStreak = 0;

        // Failure count tracking for hints / pity
        this.state.levelFailures[levelId] = (this.state.levelFailures[levelId] || 0) + 1;
        this.saveState();
    }

    public static getLevelFailures(levelId: number): number {
        return this.state.levelFailures[levelId] || 0;
    }

    // ── Coin & Inventory Operations ──
    public static addCoins(amt: number): void {
        if (amt <= 0) return;
        this.state.coins += amt;
        // Sync with legacy MONEY_KEY for backward compatibility
        localStorage.setItem('royal_gems_money', String(this.state.coins));
        this.saveState();
    }

    public static spendCoins(amt: number): boolean {
        if (this.state.coins < amt) return false;
        this.state.coins -= amt;
        localStorage.setItem('royal_gems_money', String(this.state.coins));
        this.saveState();
        return true;
    }

    public static addLives(amt: number): void {
        this.state.lives = Math.min(MAX_LIVES, this.state.lives + amt);
        this.saveState();
    }

    public static addHealth(amt: number): void {
        this.state.health = Math.min(MAX_HEALTH, this.state.health + amt);
        this.saveState();
    }

    public static addBonusItem(id: number, qty: number = 1): boolean {
        const current = this.state.bonuses[id] ?? 0;
        if (current >= MAX_BONUS_QTY) return false;
        this.state.bonuses[id] = Math.min(MAX_BONUS_QTY, current + qty);
        this.saveState();
        return true;
    }

    public static consumeBonusItem(id: number): boolean {
        const current = this.state.bonuses[id] ?? 0;
        if (current <= 0) return false;
        this.state.bonuses[id] = current - 1;
        this.saveState();
        return true;
    }

    public static buyBonusItem(id: number): { success: boolean; reason?: string } {
        const def = BONUS_ITEM_DEFINITIONS[id];
        if (!def) return { success: false, reason: "Invalid item" };
        if (this.getBonusQty(id) >= MAX_BONUS_QTY) {
            return { success: false, reason: "Max limit reached (5/5)" };
        }
        if (!this.spendCoins(def.price)) {
            return { success: false, reason: "Not enough coins!" };
        }
        this.addBonusItem(id, 1);
        return { success: true };
    }

    public static buyLife(): { success: boolean; reason?: string } {
        if (this.state.lives >= MAX_LIVES) return { success: false, reason: "Lives already full!" };
        if (!this.spendCoins(100)) return { success: false, reason: "Need 100 coins!" };
        this.addLives(1);
        return { success: true };
    }

    public static buyHealth(): { success: boolean; reason?: string } {
        if (this.state.health >= MAX_HEALTH) return { success: false, reason: "Health already full!" };
        if (!this.spendCoins(50)) return { success: false, reason: "Need 50 coins!" };
        this.addHealth(2);
        return { success: true };
    }

    // ── Daily Login Rewards ──
    public static canClaimDailyReward(): boolean {
        const today = this.getTodayDateString();
        return this.state.lastDailyLoginDate !== today;
    }

    public static claimDailyReward(): { coins: number; bonusId: number; lives: number } | null {
        if (!this.canClaimDailyReward()) return null;
        const today = this.getTodayDateString();
        this.state.lastDailyLoginDate = today;

        const coins = 50;
        const lives = 1;
        const bonusId = Math.floor(Math.random() * 10) + 1; // 1 to 10

        this.addCoins(coins);
        this.addLives(lives);
        this.addBonusItem(bonusId, 1);
        this.saveState();

        return { coins, bonusId, lives };
    }

    // ── Ad Usage Counters ──
    public static getAdCount(type: string): number {
        const key = `${type}_${this.getTodayDateString()}`;
        return this.state.adCounts[key] || 0;
    }

    public static incrementAdCount(type: string): void {
        const key = `${type}_${this.getTodayDateString()}`;
        this.state.adCounts[key] = (this.state.adCounts[key] || 0) + 1;
        this.saveState();
    }
}

// Auto init on import
EconomyManager.init();
