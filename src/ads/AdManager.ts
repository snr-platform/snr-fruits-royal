import { AdMob, AdMobRewardItem, BannerAdPosition, BannerAdSize, RewardAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export class AdManager {
    private static isInitialized = false;
    private static isNative = Capacitor.isNativePlatform();

    // Real Android Ad Unit IDs provided by Google AdMob
    private static readonly BANNER_ID = 'ca-app-pub-9010633656184987/3312904449';
    private static readonly INTERSTITIAL_ID = 'ca-app-pub-9010633656184987/5222908604';
    private static readonly REWARDED_ID = 'ca-app-pub-9010633656184987/8838272876';

    static async initialize(): Promise<void> {
        if (this.isInitialized) return;

        if (this.isNative) {
            try {
                await AdMob.initialize({
                    testingDevices: [],
                    initializeForTesting: false,
                });
                if (Capacitor.getPlatform() === 'ios') {
                    await AdMob.requestTrackingAuthorization();
                }
                console.log('[AdMob] Initialized successfully');
            } catch (err) {
                console.warn('[AdMob] Initialization warning:', err);
            }
        } else {
            console.log('[AdMob] Running in Browser Mode. Simulated ads enabled.');
        }

        this.isInitialized = true;
    }

    // 1. Show Bottom Banner Ad
    static async showBanner(): Promise<void> {
        await this.initialize();
        if (this.isNative) {
            try {
                await AdMob.showBanner({
                    adId: this.BANNER_ID,
                    adSize: BannerAdSize.BANNER,
                    position: BannerAdPosition.BOTTOM_CENTER,
                    margin: 0
                });
            } catch (err) {
                console.warn('[AdMob] Show Banner Error:', err);
            }
        } else {
            const bannerEl = document.getElementById('banner-ad-container');
            if (bannerEl) bannerEl.style.display = 'flex';
        }
    }

    static async hideBanner(): Promise<void> {
        if (this.isNative) {
            try {
                await AdMob.hideBanner();
            } catch (err) {
                console.warn('[AdMob] Hide Banner Error:', err);
            }
        } else {
            const bannerEl = document.getElementById('banner-ad-container');
            if (bannerEl) bannerEl.style.display = 'none';
        }
    }

    // 2. Show Interstitial Ad
    static async showInterstitial(): Promise<boolean> {
        await this.initialize();
        if (this.isNative) {
            try {
                await AdMob.prepareInterstitial({ adId: this.INTERSTITIAL_ID });
                await AdMob.showInterstitial();
                return true;
            } catch (err) {
                console.warn('[AdMob] Interstitial Error:', err);
                return false;
            }
        } else {
            return this.showSimulatedAdModal('Interstitial Ad', 'Watching video ad...');
        }
    }

    // 3. Show Rewarded Ad (Returns true if reward earned)
    static async showRewardedAd(rewardName: string = 'Extra Moves'): Promise<boolean> {
        await this.initialize();
        if (this.isNative) {
            return new Promise<boolean>(async (resolve) => {
                let rewardEarned = false;
                try {
                    await AdMob.prepareRewardVideoAd({ adId: this.REWARDED_ID });

                    const listener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: AdMobRewardItem) => {
                        console.log('[AdMob] Reward Earned:', reward);
                        rewardEarned = true;
                    });

                    await AdMob.showRewardVideoAd();
                    listener.remove();
                    resolve(rewardEarned);
                } catch (err) {
                    console.warn('[AdMob] Rewarded Ad Error:', err);
                    const simulated = await this.showSimulatedAdModal('Rewarded Ad', `Watch to receive ${rewardName}!`);
                    resolve(simulated);
                }
            });
        } else {
            return this.showSimulatedAdModal('Rewarded Ad', `Watch video to get ${rewardName}!`);
        }
    }

    // Browser Simulated Ad Overlay
    private static showSimulatedAdModal(title: string, message: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.zIndex = '99999';
            modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-card" style="background:#0f172a; border: 2px solid #f59e0b;">
          <div style="font-size:2.8rem; margin-bottom:8px;">🎬</div>
          <h3 style="color:#fcd34d; font-size:1.4rem; font-weight:800; font-family:'Cinzel', serif;">${title}</h3>
          <p style="color:#94a3b8; font-size:0.9rem; margin:10px 0 20px 0;">${message}</p>
          <div style="background:#1e293b; height:10px; border-radius:5px; overflow:hidden; margin-bottom:20px;">
            <div id="simulated-ad-progress" style="width:0%; height:100%; background:linear-gradient(90deg, #f59e0b, #ef4444); transition: width 0.1s linear;"></div>
          </div>
          <button id="simulated-ad-close" class="btn btn-primary" style="display:none;">Claim Royal Reward</button>
        </div>
      `;
            document.body.appendChild(modal);

            const progressBar = modal.querySelector('#simulated-ad-progress') as HTMLElement;
            const closeBtn = modal.querySelector('#simulated-ad-close') as HTMLElement;

            let progress = 0;
            const interval = setInterval(() => {
                progress += 5;
                if (progressBar) progressBar.style.width = `${progress}%`;

                if (progress >= 100) {
                    clearInterval(interval);
                    if (closeBtn) {
                        closeBtn.style.display = 'block';
                        closeBtn.onclick = () => {
                            document.body.removeChild(modal);
                            resolve(true);
                        };
                    }
                }
            }, 100);
        });
    }
}
