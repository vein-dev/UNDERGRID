import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { ContentProvider, Players, ReplicatedStorage, RunService, TweenService } from "@rbxts/services";
import { MonochromeTheme } from "../Theme";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";
import { getRemoteFunction } from "shared/network/Remotes";
import { GraphicsController } from "client/controllers/GraphicsController";

export interface LoadingScreenProps {
	isOpen: boolean;
	onFinished?: () => void;
}

/**
 * Custom Loading Screen Component dengan Animasi Spinner Berputar & Progress Bar Halus.
 * Menampilkan teks status yang informatif di atas latar hitam pekat (#000000).
 */
export function LoadingScreenComponent({ isOpen, onFinished }: LoadingScreenProps) {
	const [statusText, setStatusText] = useState("Menghubungkan ke server...");
	const [detailText, setDetailText] = useState("Menginisialisasi handshake jaringan...");
	const [percent, setPercent] = useState(0);

	const spinnerRef = useRef<Frame>();
	const barRef = useRef<Frame>();

	useEffect(() => {
		if (!isOpen) return;

		let isCancelled = false;

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

		// Pengaman utama: Maksimal 4.5 detik agar pemain tidak pernah stuck di loading screen
		task.delay(4.5, () => {
			finishLoading();
		});

		// 2. PIPELINE PEMUATAN DATA SERVER SECARA NYATA
		task.spawn(async () => {
			// ─── TAHAP 1: Menghubungkan ke Server (0% -> 15%) ───
			setStatusText("Menghubungkan ke server...");
			setDetailText("Mengirim handshake ke server otoritatif...");
			setTargetProgress(0.15, 0.4);
			task.wait(0.4);
			if (isCancelled || completed) return;

			// ─── TAHAP 2: Mengunduh Data Pemain dari Server (15% -> 35%) ───
			setStatusText("Mengunduh data server...");
			setDetailText("Memuat data profil, koin, & konfigurasi akun...");
			setTargetProgress(0.35, 0.4);

			pcall(() => {
				const initialDataFunc = getRemoteFunction("GetInitialPlayerData");
				const serverData = initialDataFunc.InvokeServer();
				print("[LoadingScreen] Server data successfully retrieved:", serverData);
			});

			task.wait(0.4);
			if (isCancelled || completed) return;

			// ─── TAHAP 3: Memuat Aset Game & Tekstur HD (35% -> 70%) ───
			setStatusText("Memuat aset dunia & tekstur HD...");
			setDetailText("Mengunduh material, mesh, dan tekstur resolusi penuh...");
			setTargetProgress(0.5, 0.4);

			const graphicsCtrl = GraphicsController.getInstance();
			await graphicsCtrl.preloadAllGameAssets((ratio, assetName) => {
				if (isCancelled || completed) return;
				const currentProgress = 0.35 + ratio * 0.35; // 35% -> 70%
				setTargetProgress(currentProgress, 0.1);
				setDetailText(`Memuat aset: ${assetName}...`);
			});

			if (isCancelled || completed) return;

			// ─── TAHAP 4: Mengoptimalkan Pencahayaan & Post-Processing HD (70% -> 85%) ───
			setStatusText("Mengoptimalkan grafik & post-processing...");
			setDetailText("Mengkalibrasi DepthOfField & bayangan HD...");
			setTargetProgress(0.85, 0.4);

			graphicsCtrl.optimizeLighting();
			task.wait(0.3);
			if (isCancelled || completed) return;

			// ─── TAHAP 5: Menyiapkan Karakter (85% -> 98%) ───
			setStatusText("Menyiapkan avatar...");
			setTargetProgress(0.95, 0.3);

			const player = Players.LocalPlayer;
			const char = player.Character;
			if (char) {
				graphicsCtrl.optimizeCharacterVisuals(char);
			}

			task.wait(0.3);
			if (isCancelled || completed) return;

			// ─── TAHAP 6: Selesai! (100%) ───
			setTargetProgress(1.0, 0.3);
			setStatusText("Game siap!");
			setDetailText("Selamat bermain!");

			task.wait(0.4);
			finishLoading();
		});

		return () => {
			isCancelled = true;
			spinnerConn?.Disconnect();
		};
	}, [isOpen]);

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
			<frame
				key="CenterContainer"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				Size={new UDim2(0, 420, 0, 260)}
				BackgroundTransparency={1}
				ZIndex={2}
			>
				{/* Animated Rotating Spinner Container */}
				<frame
					ref={spinnerRef}
					key="AnimatedSpinnerContainer"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0, 32)}
					Size={new UDim2(0, 52, 0, 52)}
					BackgroundTransparency={1}
					ZIndex={3}
				>
					<LucideIcon
						name="loader-circle"
						size={UDim2.fromOffset(46, 46)}
						color={MonochromeTheme.Text.Primary}
						anchorPoint={new Vector2(0.5, 0.5)}
						position={new UDim2(0.5, 0, 0.5, 0)}
						zIndex={4}
					/>
				</frame>

				{/* Title */}
				<textlabel
					key="GameTitle"
					Position={new UDim2(0, 0, 0, 74)}
					Size={new UDim2(1, 0, 0, 26)}
					BackgroundTransparency={1}
					Text="SYSTEM EXPERIENCE"
					Font={Fonts.Bold}
					TextSize={20}
					TextColor3={MonochromeTheme.Text.Primary}
					TextXAlignment={Enum.TextXAlignment.Center}
					ZIndex={3}
				/>

				{/* Main Status Text */}
				<textlabel
					key="StatusText"
					Position={new UDim2(0, 0, 0, 106)}
					Size={new UDim2(1, 0, 0, 22)}
					BackgroundTransparency={1}
					Text={statusText}
					Font={Fonts.Medium}
					TextSize={14}
					TextColor3={MonochromeTheme.Text.Primary}
					TextXAlignment={Enum.TextXAlignment.Center}
					ZIndex={3}
				/>

				{/* Detail Subtext */}
				<textlabel
					key="DetailText"
					Position={new UDim2(0, 0, 0, 130)}
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text={detailText}
					Font={Fonts.Regular}
					TextSize={11}
					TextColor3={MonochromeTheme.Text.Secondary}
					TextXAlignment={Enum.TextXAlignment.Center}
					ZIndex={3}
				/>

				{/* Progress Track */}
				<frame
					key="ProgressBarTrack"
					AnchorPoint={new Vector2(0.5, 0)}
					Position={new UDim2(0.5, 0, 0, 162)}
					Size={new UDim2(0, 320, 0, 6)}
					BackgroundColor3={MonochromeTheme.Background.Card}
					BackgroundTransparency={0}
					ZIndex={3}
				>
					<uicorner CornerRadius={new UDim(0, 3)} />

					{/* Animated Progress Fill with ref */}
					<frame
						ref={barRef}
						key="ProgressBarFill"
						Size={new UDim2(0, 0, 1, 0)}
						BackgroundColor3={MonochromeTheme.Text.Primary}
						BackgroundTransparency={0}
						ZIndex={4}
					>
						<uicorner CornerRadius={new UDim(0, 3)} />
					</frame>
				</frame>

				{/* Percentage Text */}
				<textlabel
					key="PercentLabel"
					Position={new UDim2(0, 0, 0, 178)}
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text={`${percent}%`}
					Font={Fonts.Regular}
					TextSize={11}
					TextColor3={MonochromeTheme.Text.Muted}
					TextXAlignment={Enum.TextXAlignment.Center}
					ZIndex={3}
				/>
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
				onFinished={() => {
					for (const cb of this.finishCallbacks) {
						cb();
					}
					this.finishCallbacks = [];
				}}
			/>,
		);
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
