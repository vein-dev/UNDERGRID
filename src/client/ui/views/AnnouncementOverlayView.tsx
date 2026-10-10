import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Lighting, Players, RunService } from "@rbxts/services";
import { createSpring, Spring, SpringPresets, useSpring } from "../SpringConfig";
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
	const [displayedText, setDisplayedText] = useState("");
	const [isTyping, setIsTyping] = useState(false);

	const [groupTransBinding, groupTransSpring] = useSpring(1, SpringPresets.gentle);
	const [scaleBinding, scaleSpring] = useSpring(0.92, SpringPresets.snappy);

	// ─── Efek Mesin Ketik (Typewriter Animation) ───
	useEffect(() => {
		if (!visible || text === "") {
			setDisplayedText("");
			setIsTyping(false);
			return;
		}

		let active = true;
		setDisplayedText("");
		setIsTyping(true);

		const typeThread = task.spawn(() => {
			// Jeda singkat 0.12 detik agar transisi fade-in kontainer mulai berjalan
			task.wait(0.12);

			const len = text.size();
			for (let i = 1; i <= len; i++) {
				if (!active) break;
				setDisplayedText(text.sub(1, i));

				// Variasi ritme ketikan natural ala mesin ketik
				const char = text.sub(i, i);
				if (char === "." || char === "!" || char === "?") {
					task.wait(0.06);
				} else if (char === "," || char === ":" || char === ";") {
					task.wait(0.04);
				} else {
					task.wait(0.025);
				}
			}

			if (active) {
				setIsTyping(false);
			}
		});

		return () => {
			active = false;
			task.cancel(typeThread);
		};
	}, [visible, text]);

	// ─── Spring Entrance & Exit Animation ───
	useEffect(() => {
		if (!visible) {
			groupTransSpring.setGoal(1);
			scaleSpring.setGoal(0.92);
			return;
		}

		// 1. Entrance: Fade In + Smooth Zoom
		groupTransSpring.setPosition(1);
		scaleSpring.setPosition(0.92);
		groupTransSpring.setGoal(0);
		scaleSpring.setGoal(1.0);

		// 2. Hitung durasi efektif agar efek mesin ketik selesai diketik dan sempat dibaca
		const effectiveDuration = math.max(duration, 0.2 + text.size() * 0.03 + 2.5);
		let isCancelled = false;

		const timerThread = task.delay(effectiveDuration, () => {
			if (isCancelled) return;
			// 3. Exit: Fade Out + Smooth Zoom
			groupTransSpring.setGoal(1);
			scaleSpring.setGoal(1.06);
		});

		const unsub = groupTransSpring.onComplete((val: number) => {
			if (!isCancelled && val >= 0.95 && onFinished) {
				onFinished();
			}
		});

		return () => {
			isCancelled = true;
			task.cancel(timerThread);
			unsub();
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

			{/* Center Text Container: Animasi fade in/out dan scale zoom dengan spring */}
			<canvasgroup
				key="CenterTextContainer"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				Size={new UDim2(0.85, 0, 0.35, 0)}
				GroupTransparency={groupTransBinding}
				BackgroundTransparency={1}
				BorderSizePixel={0}
			>
				<uiscale Scale={scaleBinding} />
				<uisizeconstraint MaxSize={new Vector2(960, 360)} />

				{/* Teks Pengumuman Bold di Tengah dengan Efek Mesin Ketik */}
				<textlabel
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundTransparency={1}
					Text={isTyping ? `${displayedText}_` : displayedText}
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
 * Controls full-screen blur and dynamic presentation across all clients using spring physics.
 */
export class AnnouncementOverlayView {
	private static instance?: AnnouncementOverlayView;
	private root: Root;
	private screenGui?: ScreenGui;
	private isVisible = false;
	private currentText = "";
	private currentDuration = 5.0;
	private blurEffect?: BlurEffect;
	private blurSpring: Spring<number>;

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

		this.blurSpring = createSpring(0, SpringPresets.gentle);
		this.blurSpring.onChange((blurSize: number) => {
			if (this.blurEffect) {
				this.blurEffect.Size = blurSize;
			}
		});
		this.blurSpring.onComplete((blurSize: number) => {
			if (!this.isVisible && blurSize <= 0.5 && this.blurEffect) {
				this.blurEffect.Enabled = false;
			}
		});

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
		if (active) {
			if (!blur) {
				blur = new Instance("BlurEffect");
				blur.Name = "AnnouncementBlur";
				blur.Size = 0;
				blur.Parent = Lighting;
			}
			blur.Enabled = true;
			this.blurEffect = blur;
			this.blurSpring.setGoal(24);
		} else if (blur) {
			this.blurSpring.setGoal(0);
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
		this.blurSpring.destroy();
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
