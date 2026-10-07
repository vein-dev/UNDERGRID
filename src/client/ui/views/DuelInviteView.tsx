import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, TweenService } from "@rbxts/services";
import { DuelInviteData } from "shared/types";
import { MonochromeTheme } from "../Theme";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export interface DuelInviteComponentProps {
	visible: boolean;
	data?: DuelInviteData;
	onAccept?: () => void;
	onDecline?: () => void;
}

export function DuelInviteComponent({
	visible,
	data,
	onAccept,
	onDecline,
}: DuelInviteComponentProps) {
	const canvasGroupRef = useRef<CanvasGroup>();
	const [timeLeft, setTimeLeft] = useState(data ? data.durationSeconds : 15);
	const totalDuration = data ? data.durationSeconds : 15;

	// Timer Countdown
	useEffect(() => {
		if (!visible || !data) return;

		setTimeLeft(totalDuration);
		let remaining = totalDuration;

		const thread = task.spawn(() => {
			while (remaining > 0 && visible) {
				task.wait(1);
				remaining -= 1;
				setTimeLeft(remaining);
			}
			if (remaining <= 0 && visible) {
				onDecline?.();
			}
		});

		return () => {
			task.cancel(thread);
		};
	}, [visible, data]);

	// Fade & Pop Animation
	useEffect(() => {
		const canvas = canvasGroupRef.current;
		if (!canvas) return;

		if (visible) {
			canvas.GroupTransparency = 1;
			const tween = TweenService.Create(
				canvas,
				new TweenInfo(0.3, Enum.EasingStyle.Quart, Enum.EasingDirection.Out),
				{ GroupTransparency: 0 },
			);
			tween.Play();
		} else {
			const tween = TweenService.Create(
				canvas,
				new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{ GroupTransparency: 1 },
			);
			tween.Play();
		}
	}, [visible]);

	if (!visible || !data) {
		return <frame BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} />;
	}

	const headshotUri = `rbxthumb://type=AvatarHeadShot&id=${data.challengerUserId}&w=150&h=150`;
	const progress = math.clamp(timeLeft / totalDuration, 0, 1);

	return (
		<canvasgroup
			ref={canvasGroupRef}
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 0, 75)}
			Size={new UDim2(0, 320, 0, 160)}
			BackgroundColor3={MonochromeTheme.Background.DeepCharcoal}
			BackgroundTransparency={0.12}
			ZIndex={95}
		>
			<uicorner CornerRadius={new UDim(0, 14)} />
			<uistroke Color={Color3.fromHex("#ef4444")} Thickness={1.5} Transparency={0.3} />
			<uilistlayout
				FillDirection={Enum.FillDirection.Vertical}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				Padding={new UDim(0, 0)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>

			{/* ─── Header ─── */}
			<frame
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 36)}
				BackgroundColor3={MonochromeTheme.Background.Surface}
				BackgroundTransparency={0.3}
				ZIndex={96}
			>
				<uipadding
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
					PaddingTop={new UDim(0, 6)}
					PaddingBottom={new UDim(0, 6)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 8)}
				/>
				<LucideIcon
					name="swords"
					size={new UDim2(0, 16, 0, 16)}
					color={Color3.fromHex("#ef4444")}
					zIndex={97}
				/>
				<textlabel
					Text="DUEL CHALLENGE"
					Font={Fonts.Bold}
					TextSize={12}
					TextColor3={MonochromeTheme.Text.Primary}
					BackgroundTransparency={1}
					AutomaticSize={Enum.AutomaticSize.XY}
					ZIndex={97}
				/>
			</frame>

			{/* ─── Player Info Body ─── */}
			<frame
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 70)}
				BackgroundTransparency={1}
				ZIndex={96}
			>
				<uipadding
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
					PaddingTop={new UDim(0, 10)}
					PaddingBottom={new UDim(0, 6)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 12)}
				/>

				{/* Avatar Thumbnail */}
				<imagelabel
					Size={new UDim2(0, 48, 0, 48)}
					Image={headshotUri}
					BackgroundColor3={MonochromeTheme.Background.Card}
					BackgroundTransparency={0.4}
					ZIndex={97}
				>
					<uicorner CornerRadius={new UDim(0, 10)} />
					<uistroke Color={Color3.fromHex("#ef4444")} Thickness={1} Transparency={0.5} />
				</imagelabel>

				{/* Identity */}
				<frame Size={new UDim2(1, -64, 1, 0)} BackgroundTransparency={1} ZIndex={97}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 2)}
					/>
					<textlabel
						Text={data.challengerDisplayName}
						Font={Fonts.Bold}
						TextSize={14}
						TextColor3={MonochromeTheme.Text.Primary}
						TextTruncate={Enum.TextTruncate.AtEnd}
						BackgroundTransparency={1}
						AutomaticSize={Enum.AutomaticSize.X}
						Size={new UDim2(1, 0, 0, 18)}
						ZIndex={98}
					/>
					<textlabel
						Text={`menantangmu duel 1v1! (${timeLeft}s)`}
						Font={Fonts.Regular}
						TextSize={11}
						TextColor3={MonochromeTheme.Text.Muted}
						BackgroundTransparency={1}
						AutomaticSize={Enum.AutomaticSize.X}
						Size={new UDim2(1, 0, 0, 14)}
						ZIndex={98}
					/>
				</frame>
			</frame>

			{/* ─── Actions (Accept / Decline) ─── */}
			<frame
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 50)}
				BackgroundTransparency={1}
				ZIndex={96}
			>
				<uipadding
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
					PaddingTop={new UDim(0, 6)}
					PaddingBottom={new UDim(0, 10)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					Padding={new UDim(0, 10)}
				/>

				{/* Decline Button */}
				<textbutton
					Size={new UDim2(0.5, -5, 0, 34)}
					BackgroundColor3={MonochromeTheme.Background.Card}
					BackgroundTransparency={0.2}
					AutoButtonColor={true}
					Text=""
					ZIndex={97}
					Event={{
						MouseButton1Click: onDecline,
					}}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uistroke Color={MonochromeTheme.Border.Subtle} Thickness={1} />
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 6)}
					/>
					<LucideIcon
						name="x"
						size={new UDim2(0, 14, 0, 14)}
						color={MonochromeTheme.Text.Muted}
						zIndex={98}
					/>
					<textlabel
						Text="Decline"
						Font={Fonts.Medium}
						TextSize={12}
						TextColor3={MonochromeTheme.Text.Muted}
						BackgroundTransparency={1}
						AutomaticSize={Enum.AutomaticSize.XY}
						ZIndex={98}
					/>
				</textbutton>

				{/* Accept Button */}
				<textbutton
					Size={new UDim2(0.5, -5, 0, 34)}
					BackgroundColor3={Color3.fromHex("#10b981")}
					BackgroundTransparency={0.2}
					AutoButtonColor={true}
					Text=""
					ZIndex={97}
					Event={{
						MouseButton1Click: onAccept,
					}}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uistroke Color={Color3.fromHex("#34d399")} Thickness={1} />
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 6)}
					/>
					<LucideIcon
						name="check"
						size={new UDim2(0, 14, 0, 14)}
						color={Color3.fromHex("#ffffff")}
						zIndex={98}
					/>
					<textlabel
						Text="Accept"
						Font={Fonts.Bold}
						TextSize={12}
						TextColor3={Color3.fromHex("#ffffff")}
						BackgroundTransparency={1}
						AutomaticSize={Enum.AutomaticSize.XY}
						ZIndex={98}
					/>
				</textbutton>
			</frame>

			{/* ─── Bottom Timer Progress Bar ─── */}
			<frame
				LayoutOrder={4}
				Size={new UDim2(1, 0, 0, 3)}
				BackgroundColor3={MonochromeTheme.Border.Subtle}
				BorderSizePixel={0}
				ZIndex={96}
			>
				<frame
					Size={new UDim2(progress, 0, 1, 0)}
					BackgroundColor3={Color3.fromHex("#ef4444")}
					BorderSizePixel={0}
					ZIndex={97}
				/>
			</frame>
		</canvasgroup>
	);
}

/**
 * Class Adapter Pattern for DuelInviteView.
 */
export class DuelInviteView {
	private static instance?: DuelInviteView;
	private root: Root;
	private screenGui?: ScreenGui;
	private isVisible = false;
	private currentData?: DuelInviteData;
	private onAcceptCb?: () => void;
	private onDeclineCb?: () => void;

	private constructor(targetContainer?: Instance) {
		let container = targetContainer;
		if (!container) {
			const playerGui = Players.LocalPlayer?.WaitForChild("PlayerGui") as PlayerGui | undefined;
			if (playerGui) {
				const gui = new Instance("ScreenGui");
				gui.Name = "DuelInviteGui";
				gui.ResetOnSpawn = false;
				gui.DisplayOrder = 95;
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

	public static getInstance(targetContainer?: Instance): DuelInviteView {
		if (!DuelInviteView.instance) {
			DuelInviteView.instance = new DuelInviteView(targetContainer);
		}
		return DuelInviteView.instance;
	}

	public show(data: DuelInviteData, onAccept?: () => void, onDecline?: () => void): void {
		this.currentData = data;
		this.onAcceptCb = onAccept;
		this.onDeclineCb = onDecline;
		this.isVisible = true;
		this.render();
	}

	public hide(): void {
		if (!this.isVisible) return;
		this.isVisible = false;
		this.currentData = undefined;
		this.render();
	}

	public destroy(): void {
		this.hide();
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
			this.screenGui = undefined;
		}
		if (DuelInviteView.instance === this) {
			DuelInviteView.instance = undefined;
		}
	}

	private render(): void {
		this.root.render(
			<DuelInviteComponent
				visible={this.isVisible}
				data={this.currentData}
				onAccept={() => {
					this.hide();
					this.onAcceptCb?.();
				}}
				onDecline={() => {
					this.hide();
					this.onDeclineCb?.();
				}}
			/>,
		);
	}
}
