import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { ContentProvider, Players, ReplicatedStorage, RunService, TweenService } from "@rbxts/services";
import { MonochromeTheme } from "../Theme";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";
import { getRemoteFunction } from "shared/network/Remotes";
import { GraphicsController } from "client/controllers/GraphicsController";
import { GameConfig } from "shared/config/GameConfig";

export interface LoadingScreenProps {
	isOpen: boolean;
	onFinished?: () => void;
	backgroundImage?: string;
	overlayTransparency?: number;
}

/**
 * Custom Loading Screen Component dengan Animasi Spinner Berputar & Progress Bar Halus.
 * Menampilkan teks status yang informatif di atas latar hitam pekat (#000000).
 */
export function LoadingScreenComponent({
	isOpen,
	onFinished,
	backgroundImage,
	overlayTransparency,
}: LoadingScreenProps) {
	const [statusText, setStatusText] = useState("Menghubungkan ke server...");
	const [detailText, setDetailText] = useState("Menginisialisasi handshake jaringan...");
	const [percent, setPercent] = useState(0);

	const spinnerRef = useRef<Frame>();
	const barRef = useRef<Frame>();
	const finishLoadingRef = useRef<() => void>();

	const effectiveBgImage = backgroundImage ?? GameConfig.LOADING_SCREEN.BACKGROUND_IMAGE;
	const effectiveOverlayAlpha = overlayTransparency ?? GameConfig.LOADING_SCREEN.OVERLAY_TRANSPARENCY;
	const hasValidBg = effectiveBgImage !== "" && effectiveBgImage !== "rbxassetid://0";

	useEffect(() => {
		if (!isOpen) return;

		let isCancelled = false;

		// Preload background image jika disetel
		if (hasValidBg) {
			task.spawn(() => {
				pcall(() => {
					ContentProvider.PreloadAsync([effectiveBgImage]);
				});
			});
		}

		// 1. ANIMASI SPINNER BERPUTAR TERUS MENERUS (Infinite 360° Rotation)
		const spinner = spinnerRef.current;
		let spinnerConn: RBXScriptConnection | undefined;
		if (spinner) {
			let currentAngle = 0;
			spinnerConn = RunService.RenderStepped.Connect((dt) => {
				currentAngle = (currentAngle + dt * 280) % 360;
				spinner.Rotation = currentAngle;
			});
		}

		// Helper untuk animasi pergerakan bar yang mulus menggunakan TweenService
		const setTargetProgress = (target: number, duration: number = 0.4) => {
			setPercent(math.floor(target * 100));
			const bar = barRef.current;
			if (bar) {
				TweenService.Create(bar, new TweenInfo(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
					Size: new UDim2(math.clamp(target, 0, 1), 0, 1, 0),
				}).Play();
			}
		};

		let completed = false;
		const finishLoading = () => {
			if (completed || isCancelled) return;
			completed = true;
			spinnerConn?.Disconnect();
			onFinished?.();
		};
		finishLoadingRef.current = finishLoading;

		// Pengaman utama: Maksimal 240 detik agar jika koneksi Roblox lag parah tidak freeze selamanya
		task.delay(240, () => {
			finishLoading();
		});

		// 2. PIPELINE PEMUATAN DATA SERVER SECARA NYATA
		task.spawn(async () => {
			const graphicsCtrl = GraphicsController.getInstance();

			// ─── TAHAP 1: Menunggu Replikasi Game Lengkap dari Roblox (0% -> 10%) ───
			if (!game.IsLoaded()) {
				setStatusText("Menghubungkan ke server...");
				setDetailText("Mengunduh replikasi map awal dari server...");
				game.Loaded.Wait();
			}
			setTargetProgress(0.1, 0.4);
			task.wait(0.3);
			if (isCancelled || completed) return;

			// ─── TAHAP 2: Mengunduh Data Profil & Streaming Map Sekitar Spawn (10% -> 20%) ───
			setStatusText("Streaming geometri map...");
			setDetailText("Meminta server streaming area map sekitar spawn...");
			await graphicsCtrl.requestMapStreamAroundPlayer();

			pcall(() => {
				const initialDataFunc = getRemoteFunction("GetInitialPlayerData");
				const serverData = initialDataFunc.InvokeServer();
				print("[LoadingScreen] Server data successfully retrieved:", serverData);
			});

			setTargetProgress(0.2, 0.4);
			task.wait(0.3);
			if (isCancelled || completed) return;

			// ─── TAHAP 3: Memuat Seluruh Objek & Mesh Map (20% -> 85%) ───
			// Tombol SKIP akan otomatis muncul ketika progress melewati 50% di tahap ini
			setStatusText("Memuat objek & mesh map...");
			setDetailText("Mengunduh model dan geometri map...");
			setTargetProgress(0.2, 0.3);

			await graphicsCtrl.preloadAllGameAssets((ratio, assetName, loaded, total) => {
				if (isCancelled || completed) return;
				const currentProgress = 0.2 + ratio * 0.65; // 20% -> 85%
				setTargetProgress(currentProgress, 0.05);
				if (loaded !== undefined && total !== undefined && total > 0) {
					setDetailText(`Memuat map: ${assetName} (${loaded}/${total})`);
				} else {
					setDetailText(`Memuat map: ${assetName}...`);
				}
			});

			if (isCancelled || completed) return;

			// ─── TAHAP 4: Mengunduh Seluruh Tekstur HD & Shader GPU (85% -> 94%) ───
			setStatusText("Mengunduh tekstur HD & shader...");
			setDetailText("Menyelesaikan buffer render GPU...");
			const startQueue = math.max(ContentProvider.RequestQueueSize, 1);

			await graphicsCtrl.waitForTextureAndMeshQueue((remaining) => {
				if (isCancelled || completed) return;
				const queueRatio = math.clamp(1 - remaining / startQueue, 0, 1);
				setTargetProgress(0.85 + queueRatio * 0.09, 0.1);
				setDetailText(`Mengunduh tekstur HD (Sisa antrean: ${remaining})...`);
			});

			setTargetProgress(0.94, 0.3);
			if (isCancelled || completed) return;

			// ─── TAHAP 5: Mengoptimalkan Pencahayaan & Karakter (94% -> 98%) ───
			setStatusText("Mengoptimalkan pencahayaan & grafik...");
			setDetailText("Mengkalibrasi DepthOfField & bayangan HD...");
			setTargetProgress(0.96, 0.3);

			graphicsCtrl.optimizeLighting();

			const player = Players.LocalPlayer;
			const char = player.Character;
			if (char) {
				graphicsCtrl.optimizeCharacterVisuals(char);
			}

			setTargetProgress(0.98, 0.2);
			task.wait(0.3);
			if (isCancelled || completed) return;

			// ─── TAHAP 6: Selesai 100%! ───
			setTargetProgress(1.0, 0.3);
			setStatusText("Map 100% Siap!");
			setDetailText("Selamat bermain!");

			task.wait(0.6);
			finishLoading();
		});

		return () => {
			isCancelled = true;
			spinnerConn?.Disconnect();
		};
	}, [isOpen]);

	const handleSkip = () => {
		finishLoadingRef.current?.();
	};

	if (!isOpen) {
		return <></>;
	}

	return (
		<frame
			key="CustomLoadingScreen"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundColor3={MonochromeTheme.Background.PureBlack}
			BackgroundTransparency={0}
			BorderSizePixel={0}
			Active={true}
			ZIndex={1}
		>
			{/* Background Image Wallpaper */}
			{hasValidBg && (
				<imagelabel
					key="BackgroundImage"
					Size={new UDim2(1, 0, 1, 0)}
					Position={new UDim2(0, 0, 0, 0)}
					Image={effectiveBgImage}
					ScaleType={Enum.ScaleType.Crop}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					ZIndex={1}
				/>
			)}

			{/* Dark Dim Overlay (agar teks status & progress bar tetap kontras dan mudah dibaca) */}
			{hasValidBg && effectiveOverlayAlpha < 1 && (
				<frame
					key="DarkDimOverlay"
					Size={new UDim2(1, 0, 1, 0)}
					Position={new UDim2(0, 0, 0, 0)}
					BackgroundColor3={Color3.fromRGB(0, 0, 0)}
					BackgroundTransparency={effectiveOverlayAlpha}
					BorderSizePixel={0}
					ZIndex={2}
				/>
			)}

			{/* Edge-to-Edge Minimalist Bottom Loading Bar & Info Row */}
			<frame
				key="EdgeToEdgeBottomContainer"
				Position={new UDim2(0, 0, 1, -38)}
				Size={new UDim2(1, 0, 0, 38)}
				BackgroundTransparency={1}
				ZIndex={3}
			>
				{/* Baris Informasi: Circle Animation | Loading Assets [Percentage] (Tanpa Stroke) */}
				<frame
					key="InfoRow"
					Position={new UDim2(0, 24, 0, 6)}
					Size={percent >= 50 ? new UDim2(1, -110, 0, 18) : new UDim2(1, -48, 0, 18)}
					BackgroundTransparency={1}
					ZIndex={4}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						HorizontalAlignment={Enum.HorizontalAlignment.Left}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{/* Circle Animation Rotating Spinner */}
					<frame
						ref={spinnerRef}
						key="AnimatedSpinnerContainer"
						LayoutOrder={1}
						Size={new UDim2(0, 14, 0, 14)}
						BackgroundTransparency={1}
						ZIndex={5}
					>
						<LucideIcon
							name="loader-circle"
							size={UDim2.fromOffset(14, 14)}
							color={Color3.fromRGB(255, 255, 255)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							zIndex={6}
						/>
					</frame>

					{/* Loading Assets & Percentage Text (Murni Putih Tanpa Stroke) */}
					<textlabel
						key="LoadingAssetsText"
						LayoutOrder={2}
						Size={new UDim2(1, -22, 1, 0)}
						BackgroundTransparency={1}
						Text={`${detailText !== "" ? detailText : statusText} [${percent}%]`}
						Font={Fonts.Medium}
						TextSize={12}
						TextColor3={Color3.fromRGB(255, 255, 255)}
						TextXAlignment={Enum.TextXAlignment.Left}
						TextTruncate={Enum.TextTruncate.AtEnd}
						ZIndex={5}
					/>
				</frame>

				{/* Tombol Skip di Kanan Bawah Di Atas Bar Loading (Muncul Saat Loading >= 50%) */}
				{percent >= 50 && (
					<textbutton
						key="SkipButton"
						AnchorPoint={new Vector2(1, 1)}
						Position={new UDim2(1, -24, 1, -8)}
						Size={new UDim2(0, 64, 0, 22)}
						BackgroundColor3={Color3.fromRGB(255, 255, 255)}
						BorderSizePixel={0}
						Text="SKIP"
						Font={Fonts.Bold}
						TextSize={11}
						TextColor3={Color3.fromRGB(0, 0, 0)}
						AutoButtonColor={true}
						ZIndex={6}
						Event={{
							Activated: handleSkip,
						}}
					>
						<uicorner CornerRadius={new UDim(0, 4)} />
					</textbutton>
				)}

				{/* Bar Loading Rectangle Memanjang Penuh dari Ujung Kiri ke Kanan Layar (Tanpa Stroke & Tanpa Corner) */}
				<frame
					key="ProgressBarTrack"
					Position={new UDim2(0, 0, 1, -4)}
					Size={new UDim2(1, 0, 0, 4)}
					BackgroundColor3={Color3.fromRGB(0, 0, 0)}
					BackgroundTransparency={0.5}
					BorderSizePixel={0}
					ZIndex={4}
				>
					{/* Animated Progress Fill (Rectangle Murni Putih) */}
					<frame
						ref={barRef}
						key="ProgressBarFill"
						Size={new UDim2(0, 0, 1, 0)}
						BackgroundColor3={Color3.fromRGB(255, 255, 255)}
						BackgroundTransparency={0}
						BorderSizePixel={0}
						ZIndex={5}
					/>
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
	private backgroundImage?: string;
	private overlayTransparency?: number;

	public constructor(targetParent?: Instance) {
		const isGuiObject = targetParent && targetParent.IsA("GuiObject");
		const container =
			targetParent ?? (RunService.IsRunning() ? Players.LocalPlayer?.WaitForChild("PlayerGui") : undefined);

		if (!isGuiObject && container) {
			const gui = new Instance("ScreenGui");
			gui.Name = "CustomLoadingGui";
			gui.ResetOnSpawn = false;
			gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling; // Pastikan hierarki ZIndex sibling aktif
			gui.DisplayOrder = 999; // Prioritas absolut paling depan di atas segalanya
			gui.IgnoreGuiInset = true;
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
				backgroundImage={this.backgroundImage}
				overlayTransparency={this.overlayTransparency}
				onFinished={() => {
					for (const cb of this.finishCallbacks) {
						cb();
					}
					this.finishCallbacks = [];
				}}
			/>,
		);
	}

	/**
	 * Mengatur background image secara dinamis untuk loading screen.
	 */
	public setBackgroundImage(imageUri: string, overlayTransparency?: number): void {
		this.backgroundImage = imageUri;
		if (overlayTransparency !== undefined) {
			this.overlayTransparency = overlayTransparency;
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
