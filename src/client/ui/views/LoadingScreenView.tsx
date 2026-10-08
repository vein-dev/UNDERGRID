import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { ContentProvider, Players, RunService, TweenService } from "@rbxts/services";
import { GraphicsController } from "client/controllers/GraphicsController";
import { getRemoteFunction } from "shared/network/Remotes";

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
	const [percent, setPercent] = useState(0);

	const logoRef = useRef<ImageLabel>();
	const scaleRef = useRef<UIScale>();
	const barRef = useRef<Frame>();
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

		// Helper untuk animasi pergerakan bar yang mulus menggunakan TweenService
		const setTargetProgress = (target: number, duration: number = 0.3) => {
			const clamped = math.clamp(target, 0, 1);
			setPercent(clamped);
			const bar = barRef.current;
			if (bar) {
				TweenService.Create(bar, new TweenInfo(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
					Size: new UDim2(clamped, 0, 1, 0),
				}).Play();
			}
		};

		// Jika dalam mode manual (misalnya di UI-Labs storybook), jangan jalankan pipeline real engine
		if (manualProgress !== undefined) {
			setTargetProgress(manualProgress, 0.2);
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

		// Pengaman timeout 240 detik
		task.delay(240, () => {
			finishLoading();
		});

		// 3. PIPELINE PEMUATAN DATA GAME OTORITATIF & REAL PRELOAD
		task.spawn(async () => {
			const graphicsCtrl = GraphicsController.getInstance();

			// ─── TAHAP 1: Replikasi Game (0% -> 10%) ───
			if (!game.IsLoaded()) {
				game.Loaded.Wait();
			}
			setTargetProgress(0.1, 0.4);
			task.wait(0.2);
			if (isCancelled || completed) return;

			// ─── TAHAP 2: Streaming Map Sekitar Player (10% -> 20%) ───
			await graphicsCtrl.requestMapStreamAroundPlayer();

			pcall(() => {
				const initialDataFunc = getRemoteFunction("GetInitialPlayerData");
				const serverData = initialDataFunc.InvokeServer();
				print("[LoadingScreen] Server data successfully retrieved:", serverData);
			});

			setTargetProgress(0.2, 0.3);
			task.wait(0.2);
			if (isCancelled || completed) return;

			// ─── TAHAP 3: Preload Objek & Mesh Map (20% -> 85%) ───
			await graphicsCtrl.preloadAllGameAssets((ratio) => {
				if (isCancelled || completed) return;
				const currentProgress = 0.2 + ratio * 0.65;
				setTargetProgress(currentProgress, 0.05);
			});

			if (isCancelled || completed) return;

			// ─── TAHAP 4: Tekstur HD & GPU Buffer Queue (85% -> 94%) ───
			const startQueue = math.max(ContentProvider.RequestQueueSize, 1);
			await graphicsCtrl.waitForTextureAndMeshQueue((remaining) => {
				if (isCancelled || completed) return;
				const queueRatio = math.clamp(1 - remaining / startQueue, 0, 1);
				setTargetProgress(0.85 + queueRatio * 0.09, 0.1);
			});

			setTargetProgress(0.94, 0.3);
			if (isCancelled || completed) return;

			// ─── TAHAP 5: Optimasi Pencahayaan & Visual (94% -> 98%) ───
			graphicsCtrl.optimizeLighting();

			const player = Players.LocalPlayer;
			const char = player?.Character;
			if (char) {
				graphicsCtrl.optimizeCharacterVisuals(char);
			}

			setTargetProgress(0.98, 0.2);
			task.wait(0.3);
			if (isCancelled || completed) return;

			// ─── TAHAP 6: Selesai 100%! ───
			setTargetProgress(1.0, 0.3);
			task.wait(0.5);
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
							ref={barRef}
							key="LoadingBarFill"
							Position={new UDim2(0, 0, 0, 0)}
							Size={new UDim2(manualProgress ?? percent, 0, 1, 0)}
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
