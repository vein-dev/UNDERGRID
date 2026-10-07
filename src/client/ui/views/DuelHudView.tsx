import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { DuelActiveData, DuelEndData, DuelIntroData } from "shared/types";
import { MonochromeTheme } from "../Theme";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export interface DuelHudComponentProps {
	mode: "None" | "Intro" | "Countdown" | "Active" | "Ended";
	countdownNumber?: number | string;
	introData?: DuelIntroData;
	activeData?: DuelActiveData;
	endData?: DuelEndData;
	onFinished?: () => void;
}

export function DuelHudComponent({
	mode,
	countdownNumber,
	activeData,
	endData,
}: DuelHudComponentProps) {
	const localPlayer = Players.LocalPlayer;
	const [opponentHealth, setOpponentHealth] = useState(100);
	const [opponentMaxHealth, setOpponentMaxHealth] = useState(100);

	// Poll opponent humanoid health during Active mode
	useEffect(() => {
		if (mode !== "Active" || !activeData) return;

		let running = true;
		const thread = task.spawn(() => {
			while (running) {
				const opponent = Players.GetPlayerByUserId(activeData.opponentUserId);
				const char = opponent?.Character;
				const hum = char?.FindFirstChildOfClass("Humanoid");

				if (hum) {
					setOpponentHealth(hum.Health);
					setOpponentMaxHealth(hum.MaxHealth);
				}
				task.wait(0.15);
			}
		});

		return () => {
			running = false;
			task.cancel(thread);
		};
	}, [mode, activeData]);

	// ─── 0. Intro Mode (Cinematic overlay handled by CinematicOverlayView like spawn animation) ───
	if (mode === "Intro") {
		return <></>;
	}

	// ─── 1. Countdown Mode (3... 2... 1... FIGHT!) ───
	if (mode === "Countdown") {
		const isFight = countdownNumber === "FIGHT!" || countdownNumber === "FIGHT";
		const textColor = isFight ? Color3.fromHex("#ef4444") : Color3.fromHex("#ffffff");
		const scale = isFight ? 1.3 : 1.0;

		return (
			<frame
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.42, 0)}
				Size={new UDim2(0, 300, 0, 100)}
				BackgroundTransparency={1}
				ZIndex={99}
			>
				<uiscale Scale={scale} />
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					VerticalAlignment={Enum.VerticalAlignment.Center}
				/>
				<textlabel
					Text={tostring(countdownNumber ?? "")}
					Font={Fonts.Bold}
					TextSize={54}
					TextColor3={textColor}
					TextStrokeTransparency={0.2}
					TextStrokeColor3={Color3.fromHex("#000000")}
					BackgroundTransparency={1}
					AutomaticSize={Enum.AutomaticSize.XY}
					ZIndex={100}
				/>
			</frame>
		);
	}

	// ─── 2. Ended Mode (Victory / Defeat Banner) ───
	if (mode === "Ended" && endData) {
		const isWinner = localPlayer.UserId === endData.winnerUserId;
		const headerText = isWinner ? "VICTORY" : "DEFEAT";
		const headerColor = isWinner ? Color3.fromHex("#10b981") : Color3.fromHex("#ef4444");
		const subText = isWinner
			? `Kamu mengalahkan ${endData.loserName} (${endData.reason})`
			: `Dikalahkan oleh ${endData.winnerName} (${endData.reason})`;

		return (
			<canvasgroup
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.35, 0)}
				Size={new UDim2(0, 360, 0, 110)}
				BackgroundColor3={MonochromeTheme.Background.DeepCharcoal}
				BackgroundTransparency={0.12}
				ZIndex={99}
			>
				<uicorner CornerRadius={new UDim(0, 16)} />
				<uistroke Color={headerColor} Thickness={1.5} Transparency={0.2} />
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 4)}
				/>
				<LucideIcon
					name={isWinner ? "trophy" : "skull"}
					size={new UDim2(0, 26, 0, 26)}
					color={headerColor}
					zIndex={100}
				/>
				<textlabel
					Text={headerText}
					Font={Fonts.Bold}
					TextSize={22}
					TextColor3={headerColor}
					BackgroundTransparency={1}
					AutomaticSize={Enum.AutomaticSize.XY}
					ZIndex={100}
				/>
				<textlabel
					Text={subText}
					Font={Fonts.Regular}
					TextSize={12}
					TextColor3={MonochromeTheme.Text.Muted}
					BackgroundTransparency={1}
					AutomaticSize={Enum.AutomaticSize.XY}
					ZIndex={100}
				/>
			</canvasgroup>
		);
	}

	// ─── 3. Active Mode (Top Opponent Health Bar & VS Banner) ───
	if (mode === "Active" && activeData) {
		const headshotUri = `rbxthumb://type=AvatarHeadShot&id=${activeData.opponentUserId}&w=150&h=150`;
		const healthPct = math.clamp(
			opponentMaxHealth > 0 ? opponentHealth / opponentMaxHealth : 0,
			0,
			1,
		);

		return (
			<canvasgroup
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 14)}
				Size={new UDim2(0, 360, 0, 48)}
				BackgroundColor3={MonochromeTheme.Background.DeepCharcoal}
				BackgroundTransparency={0.15}
				ZIndex={90}
			>
				<uicorner CornerRadius={new UDim(0, 12)} />
				<uistroke Color={Color3.fromHex("#ef4444")} Thickness={1.2} Transparency={0.4} />
				<uipadding
					PaddingLeft={new UDim(0, 10)}
					PaddingRight={new UDim(0, 10)}
					PaddingTop={new UDim(0, 6)}
					PaddingBottom={new UDim(0, 6)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 10)}
				/>

				{/* Opponent Avatar */}
				<imagelabel
					Size={new UDim2(0, 36, 0, 36)}
					Image={headshotUri}
					BackgroundColor3={MonochromeTheme.Background.Card}
					BackgroundTransparency={0.4}
					ZIndex={91}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uistroke Color={Color3.fromHex("#ef4444")} Thickness={1} Transparency={0.5} />
				</imagelabel>

				{/* Opponent Details & Health Bar */}
				<frame Size={new UDim2(1, -46, 1, 0)} BackgroundTransparency={1} ZIndex={91}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 3)}
					/>
					<frame Size={new UDim2(1, 0, 0, 16)} BackgroundTransparency={1} ZIndex={92}>
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							VerticalAlignment={Enum.VerticalAlignment.Center}
						/>
						<textlabel
							Text={activeData.opponentDisplayName}
							Font={Fonts.Bold}
							TextSize={12}
							TextColor3={MonochromeTheme.Text.Primary}
							TextTruncate={Enum.TextTruncate.AtEnd}
							BackgroundTransparency={1}
							Size={new UDim2(1, -50, 1, 0)}
							ZIndex={93}
						/>
						<textlabel
							Text={`${math.floor(opponentHealth)} HP`}
							Font={Fonts.Medium}
							TextSize={10}
							TextColor3={Color3.fromHex("#ef4444")}
							BackgroundTransparency={1}
							Size={new UDim2(0, 50, 1, 0)}
							TextXAlignment={Enum.TextXAlignment.Right}
							ZIndex={93}
						/>
					</frame>

					{/* Health Bar Track */}
					<frame
						Size={new UDim2(1, 0, 0, 8)}
						BackgroundColor3={MonochromeTheme.Background.Card}
						BackgroundTransparency={0.3}
						ZIndex={92}
					>
						<uicorner CornerRadius={new UDim(0, 4)} />
						<frame
							Size={new UDim2(healthPct, 0, 1, 0)}
							BackgroundColor3={
								healthPct > 0.4 ? Color3.fromHex("#ef4444") : Color3.fromHex("#dc2626")
							}
							BorderSizePixel={0}
							ZIndex={93}
						>
							<uicorner CornerRadius={new UDim(0, 4)} />
						</frame>
					</frame>
				</frame>
			</canvasgroup>
		);
	}

	return <frame BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} />;
}

/**
 * Class Adapter Pattern for DuelHudView.
 */
export class DuelHudView {
	private static instance?: DuelHudView;
	private root: Root;
	private screenGui?: ScreenGui;

	private currentMode: "None" | "Intro" | "Countdown" | "Active" | "Ended" = "None";
	private countdownNumber?: number | string;
	private introData?: DuelIntroData;
	private activeData?: DuelActiveData;
	private endData?: DuelEndData;

	private constructor(targetContainer?: Instance) {
		let container = targetContainer;
		if (!container) {
			const playerGui = Players.LocalPlayer?.WaitForChild("PlayerGui") as PlayerGui | undefined;
			if (playerGui) {
				const gui = new Instance("ScreenGui");
				gui.Name = "DuelHudGui";
				gui.ResetOnSpawn = false;
				gui.DisplayOrder = 90;
				gui.Parent = playerGui;
				this.screenGui = gui;
				container = gui;
			}
		}

		if (!container) {
			container = new Instance("Folder");
		}

		this.root = ReactRoblox.createRoot(container);
	}

	public static getInstance(targetContainer?: Instance): DuelHudView {
		if (!DuelHudView.instance) {
			DuelHudView.instance = new DuelHudView(targetContainer);
		}
		return DuelHudView.instance;
	}

	public showIntro(data: DuelIntroData): void {
		this.currentMode = "Intro";
		this.introData = data;
		this.render();
	}

	public startCountdown(duration = 3, onFinished?: () => void): void {
		this.currentMode = "Countdown";
		let current = duration;

		const thread = task.spawn(() => {
			while (current > 0) {
				this.countdownNumber = current;
				this.render();
				task.wait(1);
				current -= 1;
			}

			// Show FIGHT!
			this.countdownNumber = "FIGHT!";
			this.render();
			task.wait(0.8);

			this.countdownNumber = undefined;
			this.render();
			onFinished?.();
		});
	}

	public showActive(data: DuelActiveData): void {
		this.currentMode = "Active";
		this.activeData = data;
		this.render();
	}

	public showEnded(data: DuelEndData, onDismiss?: () => void): void {
		this.currentMode = "Ended";
		this.endData = data;
		this.render();

		task.delay(4, () => {
			if (this.currentMode === "Ended") {
				this.hide();
				onDismiss?.();
			}
		});
	}

	public hide(): void {
		this.currentMode = "None";
		this.countdownNumber = undefined;
		this.introData = undefined;
		this.activeData = undefined;
		this.endData = undefined;
		this.render();
	}

	public destroy(): void {
		this.hide();
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
			this.screenGui = undefined;
		}
		if (DuelHudView.instance === this) {
			DuelHudView.instance = undefined;
		}
	}

	private render(): void {
		this.root.render(
			<DuelHudComponent
				mode={this.currentMode}
				countdownNumber={this.countdownNumber}
				introData={this.introData}
				activeData={this.activeData}
				endData={this.endData}
			/>,
		);
	}
}
