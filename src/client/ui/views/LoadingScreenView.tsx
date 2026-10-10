import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { ContentProvider, Players, RunService } from "@rbxts/services";
import { GraphicsController } from "client/controllers/GraphicsController";
import { GameConfig } from "shared/config";
import { getRemoteFunction } from "shared/network/Remotes";
import { SpringPresets, useSpring } from "../SpringConfig";

export const DEFAULT_LOADING_LOGO = "rbxassetid://79461853534630";

export interface LoadingScreenProps {
	isOpen: boolean;
	onFinished?: () => void;
	logoAssetId?: string;
	manualProgress?: number;
}

/**
 * Minimalist Cinematic Loading Screen (Under Grid Subculture).
 * Strictly mirrors the 16:9 widescreen layout with pitch black (#000000) backdrop,
 * centered pulsing game logo, and sharp slim progress bar (#2a2a2a / #ffffff).
 */
export function LoadingScreenComponent({
	isOpen,
	onFinished,
	logoAssetId = DEFAULT_LOADING_LOGO,
	manualProgress,
}: LoadingScreenProps) {
	const initialVal = manualProgress ?? 0;
	const [targetPercent, setTargetPercent] = useState(initialVal);
	const [progressBinding, progressSpring] = useSpring(initialVal, SpringPresets.snappy);

	useEffect(() => {
		if (manualProgress !== undefined) {
			setTargetPercent(manualProgress);
			progressSpring.setGoal(manualProgress);
		}
	}, [manualProgress]);

	useEffect(() => {
		progressSpring.setGoal(targetPercent);
	}, [targetPercent]);

	const logoRef = useRef<ImageLabel>();
	const scaleRef = useRef<UIScale>();
	const finishLoadingRef = useRef<() => void>();

	useEffect(() => {
		if (!isOpen) return;

		let isCancelled = false;

		// 1. PRELOAD ASSET LOGO
		task.spawn(() => {
			pcall(() => {
				ContentProvider.PreloadAsync([logoAssetId]);
			});
		});

		// 2. ANIMASI BREATHING / PULSE LOGO (Ultra-smooth 2.8s continuous sinusoidal wave)
		const scaleInstance = scaleRef.current;
		const logoImage = logoRef.current;
		const startTime = os.clock();
		const cycleDuration = 2.8;

		const pulseConn = RunService.RenderStepped.Connect(() => {
			const elapsed = os.clock() - startTime;
			// Gelombang sinus mulus tanpa patahan boundary jerk
			const rawSine = (math.sin(elapsed * ((math.pi * 2) / cycleDuration) - math.pi / 2) + 1) / 2;
			// Smoothstep interpolation (Hermite curve) untuk transisi super halus dan organik
			const smooth = rawSine * rawSine * (3 - 2 * rawSine);

			if (scaleInstance) {
				// Skala berdenyut lembut dari 1.0 ke 1.045
				scaleInstance.Scale = 1.0 + smooth * 0.045;
			}
			if (logoImage) {
				// Transparansi bernapas lembut dari 0.10 ke 0.0 (opacity 0.90 -> 1.0)
				logoImage.ImageTransparency = 0.1 * (1 - smooth);
			}
		});

		// Helper untuk animasi pergerakan bar yang mulus menggunakan Spring physics
		const setTargetProgress = (target: number, _duration?: number) => {
			const clamped = math.clamp(target, 0, 1);
			setTargetPercent(clamped);
		};

		// Jika dalam mode manual (misalnya di UI-Labs storybook), jangan jalankan pipeline real engine
		if (manualProgress !== undefined) {
			setTargetProgress(manualProgress);
			return () => {
				pulseConn.Disconnect();
			};
		}

		let completed = false;
		const finishLoading = () => {
			if (completed || isCancelled) return;
			completed = true;
			pulseConn.Disconnect();
			onFinished?.();
		};
		finishLoadingRef.current = finishLoading;

		const targetDuration = GameConfig.LOADING_SCREEN.TARGET_DURATION; // 15 detik
		const fallbackTimeout = GameConfig.LOADING_SCREEN.FALLBACK_TIMEOUT; // 17 detik

		// Pengaman timeout darurat jika terjadi gangguan jaringan ekstrem
		task.delay(fallbackTimeout, () => {
			finishLoading();
		});

		// 3. PIPELINE PEMUATAN DATA GAME OTORITATIF & REAL PRELOAD (Pacing 15 Detik)
		task.spawn(async () => {
			const pipelineStart = os.clock();
			const graphicsCtrl = GraphicsController.getInstance();

			// ─── TAHAP 1: Replikasi Game & Profil Server (0.0s -> 2.0s, 0% -> 15%) ───
			if (!game.IsLoaded()) {
				const isLoadedStart = os.clock();
				while (!game.IsLoaded() && os.clock() - isLoadedStart < 2.0) {
					task.wait(0.1);
				}
			}
			setTargetProgress(0.1, 0.4);

			// Panggilan data server secara asynchronous & aman
			task.spawn(() => {
				pcall(() => {
					const initialDataFunc = getRemoteFunction("GetInitialPlayerData");
					const serverData = initialDataFunc.InvokeServer();
					print("[LoadingScreen] Server data successfully retrieved:", serverData);
				});
			});

			await graphicsCtrl.requestMapStreamAroundPlayer();
			setTargetProgress(0.15, 0.3);

			// Jaga ritme fase 1 agar genap 2.0 detik
			while (os.clock() - pipelineStart < 2.0 && !isCancelled && !completed) {
				task.wait(0.1);
			}
			if (isCancelled || completed) return;

			// ─── TAHAP 2: Smart Hybrid Preload Aset (2.0s -> 12.5s, 15% -> 88%) ───
			// Alokasikan batas waktu 10.0 detik untuk memuat aset visual & prioritas
			let currentAssetRatio = 0;
			const preloadPromise = graphicsCtrl.preloadAllGameAssets((ratio) => {
				if (isCancelled || completed) return;
				currentAssetRatio = ratio;
			}, 10.0);

			// Interpolasi bar secara kontinu & mulus selama durasi 10.5 detik
			const phase2Start = os.clock();
			const phase2Duration = 10.5;
			while (os.clock() - phase2Start < phase2Duration && !isCancelled && !completed) {
				const timeRatio = math.clamp((os.clock() - phase2Start) / phase2Duration, 0, 1);
				// Kombinasikan waktu dan rasio aset aktual untuk pergerakan bar yang paling alami
				const blendedRatio = math.max(timeRatio, currentAssetRatio);
				const targetP = 0.15 + blendedRatio * 0.73;
				setTargetProgress(targetP, 0.15);
				task.wait(0.08);
			}
			await preloadPromise;
			if (isCancelled || completed) return;

			// ─── TAHAP 3: Buffer Queue & Optimasi Visual (12.5s -> 14.0s, 88% -> 96%) ───
			await graphicsCtrl.waitForTextureAndMeshQueue();

			graphicsCtrl.optimizeLighting();
			const player = Players.LocalPlayer;
			const char = player?.Character;
			if (char) {
				graphicsCtrl.optimizeCharacterVisuals(char);
			}

			setTargetProgress(0.96, 0.4);
			while (os.clock() - pipelineStart < 14.0 && !isCancelled && !completed) {
				task.wait(0.1);
			}
			if (isCancelled || completed) return;

			// ─── TAHAP 4: Selesai 100% Sinematik (14.0s -> 15.0s, 96% -> 100%) ───
			setTargetProgress(1.0, 0.4);

			// Tunggu hingga genap target durasi 15 detik
			while (os.clock() - pipelineStart < targetDuration && !isCancelled && !completed) {
				task.wait(0.05);
			}

			finishLoading();
		});

		return () => {
			isCancelled = true;
			pulseConn.Disconnect();
		};
	}, [isOpen, logoAssetId, manualProgress]);

	if (!isOpen) {
		return <></>;
	}

	return (
		<frame
			key="LoadingScreenContainer"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundColor3={Color3.fromRGB(0, 0, 0)}
			BackgroundTransparency={0}
			BorderSizePixel={0}
			Active={true}
			ZIndex={1}
		>
			{/* Main 16:9 cinematic widescreen frame mimicking game engine viewport */}
			<frame
				key="CinematicViewport16x9"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ZIndex={2}
			>
				<uiaspectratioconstraint
					AspectRatio={16 / 9}
					AspectType={Enum.AspectType.FitWithinMaxSize}
					DominantAxis={Enum.DominantAxis.Width}
				/>

				{/* Center Brand Section: Centered high-contrast game title/logo with subtle breathing pulse */}
				<frame
					key="CenterBrandSection"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(0.35, 0, 0.32, 0)}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					ZIndex={10}
				>
					<uisizeconstraint
						MinSize={new Vector2(280, 120)}
						MaxSize={new Vector2(360, 200)}
					/>
					<frame
						key="LogoPulseContainer"
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={new UDim2(0.5, 0, 0.5, 0)}
						Size={new UDim2(1, 0, 1, 0)}
						BackgroundTransparency={1}
						BorderSizePixel={0}
					>
						<uiscale ref={scaleRef} Scale={1} />
						<imagelabel
							ref={logoRef}
							key="UnderGridLogo"
							AnchorPoint={new Vector2(0.5, 0.5)}
							Position={new UDim2(0.5, 0, 0.5, 0)}
							Size={new UDim2(1, 0, 1, 0)}
							Image={logoAssetId}
							ScaleType={Enum.ScaleType.Fit}
							BackgroundTransparency={1}
							BorderSizePixel={0}
							ZIndex={11}
						/>
					</frame>
				</frame>

				{/* Bottom Interface Section: Lower viewport section holding minimalist progress bar */}
				<frame
					key="BottomInterfaceSection"
					AnchorPoint={new Vector2(0.5, 1)}
					Position={new UDim2(0.5, 0, 0.925, 0)}
					Size={new UDim2(1, 0, 0, 24)}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					ZIndex={10}
				>
					{/* Horizontal Slim Loading Progress Bar */}
					<frame
						key="LoadingProgressBar"
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={new UDim2(0.5, 0, 0.5, 0)}
						Size={new UDim2(0.38, 0, 0, 5)}
						BackgroundColor3={Color3.fromHex("#2a2a2a")}
						BackgroundTransparency={0}
						BorderSizePixel={0}
						ClipsDescendants={true}
						ZIndex={11}
					>
						<uisizeconstraint
							MinSize={new Vector2(340, 5)}
							MaxSize={new Vector2(440, 6)}
						/>
						{/* Active fill matching pure white indicator */}
						<frame
							key="LoadingBarFill"
							Position={new UDim2(0, 0, 0, 0)}
							Size={progressBinding.map((p) => new UDim2(p, 0, 1, 0))}
							BackgroundColor3={Color3.fromRGB(255, 255, 255)}
							BackgroundTransparency={0}
							BorderSizePixel={0}
							ZIndex={12}
						/>
					</frame>
				</frame>
			</frame>
		</frame>
	);
}

/**
 * Class Adapter Pattern untuk mengontrol LoadingScreenView.
 */
export class LoadingScreenView {
	private static instance?: LoadingScreenView;
	private root: Root;
	private screenGui?: ScreenGui;
	private _isOpen = false;
	private finishCallbacks: Array<() => void> = [];
	private logoAssetId: string = DEFAULT_LOADING_LOGO;
	private manualProgress?: number;

	public constructor(targetParent?: Instance) {
		const isGuiObject = targetParent && targetParent.IsA("GuiObject");
		const container =
			targetParent ?? (RunService.IsRunning() ? Players.LocalPlayer?.WaitForChild("PlayerGui") : undefined);

		if (!isGuiObject && container) {
			const gui = new Instance("ScreenGui");
			gui.Name = "CustomLoadingGui";
			gui.ResetOnSpawn = false;
			gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			gui.DisplayOrder = 999;
			gui.IgnoreGuiInset = true;
			gui.ScreenInsets = Enum.ScreenInsets.None;
			gui.Enabled = false;
			gui.Parent = container;
			this.screenGui = gui;
			this.root = ReactRoblox.createRoot(gui);
		} else if (container) {
			this.root = ReactRoblox.createRoot(container);
		} else {
			const folder = new Instance("Folder");
			this.root = ReactRoblox.createRoot(folder);
		}

		this.render();
	}

	public static getInstance(target?: Instance): LoadingScreenView {
		if (!LoadingScreenView.instance) {
			LoadingScreenView.instance = new LoadingScreenView(target);
		}
		return LoadingScreenView.instance;
	}

	private render(): void {
		this.root.render(
			<LoadingScreenComponent
				isOpen={this._isOpen}
				logoAssetId={this.logoAssetId}
				manualProgress={this.manualProgress}
				onFinished={() => {
					for (const cb of this.finishCallbacks) {
						cb();
					}
					this.finishCallbacks = [];
				}}
			/>,
		);
	}

	public setLogoAssetId(logoAssetId: string): void {
		this.logoAssetId = logoAssetId;
		this.render();
	}

	public setManualProgress(progress?: number): void {
		this.manualProgress = progress;
		this.render();
	}

	/**
	 * Backward compatibility method.
	 */
	public setBackgroundImage(imageUri: string, _overlayTransparency?: number): void {
		// Minimalist cinematic loading screen enforces solid black backdrop
		if (imageUri !== "") {
			this.logoAssetId = imageUri;
		}
		this.render();
	}

	public show(): void {
		if (this._isOpen) return;
		this._isOpen = true;
		if (this.screenGui) {
			this.screenGui.Enabled = true;
		}
		this.render();
	}

	public hide(): void {
		if (!this._isOpen) return;
		this._isOpen = false;
		if (this.screenGui) {
			this.screenGui.Enabled = false;
		}
		this.render();
	}

	public onFinished(callback: () => void): () => void {
		this.finishCallbacks.push(callback);
		return () => {
			this.finishCallbacks = this.finishCallbacks.filter((cb) => cb !== callback);
		};
	}

	public isVisible(): boolean {
		return this._isOpen;
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		if (LoadingScreenView.instance === this) {
			LoadingScreenView.instance = undefined;
		}
	}
}
