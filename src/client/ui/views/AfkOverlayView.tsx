import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, RunService } from "@rbxts/services";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export interface AfkOverlayProps {
	visible: boolean;
	startTime?: number;
	onResume?: () => void;
}

function formatDuration(seconds: number): string {
	const sec = math.max(0, math.floor(seconds));
	const mins = math.floor(sec / 60);
	const remSecs = sec % 60;
	if (mins >= 60) {
		const hours = math.floor(mins / 60);
		const remMins = mins % 60;
		return string.format("%02d:%02d:%02d", hours, remMins, remSecs);
	}
	return string.format("%02d:%02d", mins, remSecs);
}

export function AfkOverlayComponent({ visible, startTime = os.time(), onResume }: AfkOverlayProps) {
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		if (!visible) return;

		const interval = task.spawn(() => {
			while (true) {
				const now = os.time();
				setElapsed(math.max(0, now - startTime));
				task.wait(1);
			}
		});

		return () => {
			task.cancel(interval);
		};
	}, [visible, startTime]);

	if (!visible) return <></>;

	return (
		<frame
			key="AfkOverlayRoot"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			BorderSizePixel={0}
			ZIndex={5}
		>
			{/* Top/Center Floating AFK Banner */}
			<frame
				key="AfkBanner"
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 56)}
				Size={new UDim2(0, 310, 0, 48)}
				BackgroundColor3={Color3.fromHex("#0c0c0c")}
				BackgroundTransparency={0.25}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke
					Color={Color3.fromHex("#ffffff")}
					Transparency={0.8}
					Thickness={1}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				<uipadding
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 10)}
					PaddingTop={new UDim(0, 6)}
					PaddingBottom={new UDim(0, 6)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 10)}
				/>

				{/* Sleep Icon */}
				<LucideIcon
					name="moon"
					size={new UDim2(0, 20, 0, 20)}
					color={Color3.fromHex("#60a5fa")}
				/>

				{/* AFK Text & Timer Info */}
				<frame Size={new UDim2(1, -125, 1, 0)} BackgroundTransparency={1}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 2)}
					/>
					<textlabel
						Size={new UDim2(1, 0, 0, 14)}
						BackgroundTransparency={1}
						Text="MODE AFK AKTIF"
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Bold}
						TextSize={11}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<textlabel
						Size={new UDim2(1, 0, 0, 14)}
						BackgroundTransparency={1}
						Text={`Durasi: ${formatDuration(elapsed)}`}
						TextColor3={Color3.fromHex("#94a3b8")}
						Font={Fonts.Medium}
						TextSize={11}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
				</frame>

				{/* Resume CTA Button */}
				<textbutton
					Size={new UDim2(0, 85, 0, 32)}
					BackgroundColor3={Color3.fromHex("#2563eb")}
					BackgroundTransparency={0.1}
					Text="RESUME"
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Bold}
					TextSize={11}
					AutoButtonColor={false}
					Event={{
						MouseButton1Click: onResume,
					}}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
				</textbutton>
			</frame>
		</frame>
	);
}

/**
 * Singleton OOP Class Adapter for AfkOverlayView.
 */
export class AfkOverlayView {
	private static instance?: AfkOverlayView;
	private root: Root;
	private screenGui?: ScreenGui;
	private isVisible = false;
	private startTime = os.time();
	private onResumeCallback?: () => void;

	constructor(targetContainer?: Instance) {
		let container = targetContainer;
		if (!container) {
			const player = Players.LocalPlayer;
			const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

			const existing = playerGui.FindFirstChild("AfkOverlayGui") as ScreenGui | undefined;
			if (existing) {
				existing.Destroy();
			}

			const gui = new Instance("ScreenGui");
			gui.Name = "AfkOverlayGui";
			gui.ResetOnSpawn = false;
			gui.DisplayOrder = 10;
			gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			gui.Parent = playerGui;
			this.screenGui = gui;
			container = gui;
		}

		this.root = ReactRoblox.createRoot(container);
		this.render();
	}

	public static getInstance(): AfkOverlayView {
		if (!AfkOverlayView.instance) {
			AfkOverlayView.instance = new AfkOverlayView();
		}
		return AfkOverlayView.instance;
	}

	public show(startTime: number = os.time()): void {
		this.isVisible = true;
		this.startTime = startTime;
		this.render();
	}

	public hide(): void {
		this.isVisible = false;
		this.render();
	}

	public setOnResume(cb: () => void): void {
		this.onResumeCallback = cb;
		this.render();
	}

	public getIsVisible(): boolean {
		return this.isVisible;
	}

	private render(): void {
		this.root.render(
			<AfkOverlayComponent
				visible={this.isVisible}
				startTime={this.startTime}
				onResume={() => {
					if (this.onResumeCallback) {
						this.onResumeCallback();
					} else {
						this.hide();
					}
				}}
			/>,
		);
	}

	public destroy(): void {
		if (AfkOverlayView.instance === this) {
			AfkOverlayView.instance = undefined;
		}
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
			this.screenGui = undefined;
		}
	}
}
