import React, { useEffect, useRef } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Lighting, Players, RunService, TweenService } from "@rbxts/services";
import { Fonts } from "../Typography";

export interface AnnouncementOverlayComponentProps {
	visible: boolean;
	text: string;
	title?: string;
	duration?: number;
	onFinished?: () => void;
	isGuiObject?: boolean;
}

export function AnnouncementOverlayComponent({
	visible,
	text,
	duration = 5.0,
	onFinished,
}: AnnouncementOverlayComponentProps) {
	const canvasGroupRef = useRef<CanvasGroup>();
	const scaleRef = useRef<UIScale>();

	useEffect(() => {
		if (!visible) return;

		const cg = canvasGroupRef.current;
		const sc = scaleRef.current;
		if (!cg || !sc) return;

		// ─── 1. Inisialisasi State (Transparan & Scaled Down) ───
		cg.GroupTransparency = 1;
		sc.Scale = 0.92;

		// ─── 2. Animasi Masuk: Fade In + Smooth Zoom (0.4 detik) ───
		const enterInfo = new TweenInfo(0.4, Enum.EasingStyle.Quart, Enum.EasingDirection.Out);
		const enterTweenGroup = TweenService.Create(cg, enterInfo, { GroupTransparency: 0 });
		const enterTweenScale = TweenService.Create(sc, enterInfo, { Scale: 1.0 });

		enterTweenGroup.Play();
		enterTweenScale.Play();

		// ─── 3. Animasi Keluar: Fade Out + Smooth Zoom (0.45 detik) setelah durasi ───
		let isCancelled = false;
		const timerThread = task.delay(duration, () => {
			if (isCancelled) return;
			const exitInfo = new TweenInfo(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.In);
			const exitTweenGroup = TweenService.Create(cg, exitInfo, { GroupTransparency: 1 });
			const exitTweenScale = TweenService.Create(sc, exitInfo, { Scale: 1.06 });

			exitTweenGroup.Play();
			exitTweenScale.Play();

			exitTweenGroup.Completed.Connect(() => {
				if (!isCancelled && onFinished) {
					onFinished();
				}
			});
		});

		return () => {
			isCancelled = true;
			task.cancel(timerThread);
			enterTweenGroup.Cancel();
			enterTweenScale.Cancel();
		};
	}, [visible, text, duration]);

	if (!visible) return <></>;

	return (
		<frame
			key="AnnouncementOverlayRoot"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			BorderSizePixel={0}
		>
			{/* Backdrop Dim Semi-Transparan Gelap */}
			<frame
				key="Backdrop"
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundColor3={Color3.fromHex("#000000")}
				BackgroundTransparency={0.45}
				BorderSizePixel={0}
			/>

			{/* Center Text Container: Animasi fade in/out dan scale zoom tanpa kotak/border */}
			<canvasgroup
				key="CenterTextContainer"
				ref={canvasGroupRef}
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				Size={new UDim2(0.85, 0, 0.35, 0)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
			>
				<uiscale ref={scaleRef} Scale={0.92} />
				<uisizeconstraint MaxSize={new Vector2(960, 360)} />

				{/* Teks Pengumuman Bold di Tengah */}
				<textlabel
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundTransparency={1}
					Text={text}
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Bold}
					TextSize={32}
					TextWrapped={true}
					LineHeight={1.25}
					TextXAlignment={Enum.TextXAlignment.Center}
					TextYAlignment={Enum.TextYAlignment.Center}
				>
					<uistroke
						Color={Color3.fromHex("#000000")}
						Thickness={1.5}
						Transparency={0.35}
					/>
				</textlabel>
			</canvasgroup>
		</frame>
	);
}

/**
 * Singleton OOP Class Adapter for AnnouncementOverlayView.
 * Controls full-screen blur and dynamic presentation across all clients.
 */
export class AnnouncementOverlayView {
	private static instance?: AnnouncementOverlayView;
	private root: Root;
	private screenGui?: ScreenGui;
	private isVisible = false;
	private currentText = "";
	private currentDuration = 5.0;
	private blurEffect?: BlurEffect;
	private blurTween?: Tween;

	constructor(targetContainer?: Instance) {
		let container = targetContainer;
		if (!container) {
			const player = Players.LocalPlayer;
			const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

			const existing = playerGui.FindFirstChild("AnnouncementOverlayGui") as ScreenGui | undefined;
			if (existing) {
				existing.Destroy();
			}

			const gui = new Instance("ScreenGui");
			gui.Name = "AnnouncementOverlayGui";
			gui.ResetOnSpawn = false;
			gui.DisplayOrder = 250;
			gui.IgnoreGuiInset = true;
			gui.ScreenInsets = Enum.ScreenInsets.None;
			gui.Parent = playerGui;
			this.screenGui = gui;
			container = gui;
		}

		this.root = ReactRoblox.createRoot(container);
		this.render();
	}

	public static getInstance(): AnnouncementOverlayView {
		if (!AnnouncementOverlayView.instance) {
			AnnouncementOverlayView.instance = new AnnouncementOverlayView();
		}
		return AnnouncementOverlayView.instance;
	}

	private render(): void {
		this.root.render(
			<AnnouncementOverlayComponent
				visible={this.isVisible}
				text={this.currentText}
				duration={this.currentDuration}
				onFinished={() => this.hide()}
			/>,
		);
	}

	private updateBlur(active: boolean): void {
		// Cegah modifikasi Lighting di edit mode atau preview storybook tanpa gameplay
		if (!RunService.IsRunning()) return;

		let blur = Lighting.FindFirstChild("AnnouncementBlur") as BlurEffect | undefined;
		this.blurTween?.Cancel();

		if (active) {
			if (!blur) {
				blur = new Instance("BlurEffect");
				blur.Name = "AnnouncementBlur";
				blur.Size = 0;
				blur.Parent = Lighting;
			}
			blur.Enabled = true;
			this.blurEffect = blur;

			this.blurTween = TweenService.Create(
				blur,
				new TweenInfo(0.4, Enum.EasingStyle.Quart, Enum.EasingDirection.Out),
				{ Size: 24 },
			);
			this.blurTween.Play();
		} else if (blur) {
			this.blurTween = TweenService.Create(
				blur,
				new TweenInfo(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{ Size: 0 },
			);
			this.blurTween.Play();
			this.blurTween.Completed.Connect(() => {
				if (!this.isVisible && blur && blur.Parent) {
					blur.Enabled = false;
				}
			});
		}
	}

	public show(text: string, duration = 5.0): void {
		this.currentText = text;
		this.currentDuration = duration;
		this.isVisible = true;
		this.updateBlur(true);
		this.render();
	}

	public hide(): void {
		if (!this.isVisible) return;
		this.isVisible = false;
		this.updateBlur(false);
		this.render();
	}

	public destroy(): void {
		this.hide();
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
			this.screenGui = undefined;
		}
		if (this.blurEffect) {
			this.blurEffect.Destroy();
			this.blurEffect = undefined;
		}
		if (AnnouncementOverlayView.instance === this) {
			AnnouncementOverlayView.instance = undefined;
		}
	}
}
