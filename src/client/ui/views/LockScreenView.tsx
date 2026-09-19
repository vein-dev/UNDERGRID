import React, { useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { getGMT7TimeInfo } from "shared/utils";
import { Fonts } from "../Typography";
import { useInterval } from "../hooks";

export interface LockScreenProps {
	visible: boolean;
	onUnlock: () => void;
}

export function LockScreenComponent({ visible, onUnlock }: LockScreenProps) {
	const [timeInfo, setTimeInfo] = useState(() => getGMT7TimeInfo());

	useInterval(() => {
		setTimeInfo(getGMT7TimeInfo());
	}, 1);

	if (!visible) return <></>;

	return (
		<frame
			key="LockScreen"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundColor3={Color3.fromHex("#000000")}
			ZIndex={80}
		>
			<uicorner CornerRadius={new UDim(0, 46)} />

			{/* Date (Above Clock) */}
			<textlabel
				key="Date"
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 104)}
				Size={new UDim2(0.9, 0, 0, 22)}
				BackgroundTransparency={1}
				Text={timeInfo.dateString}
				TextColor3={Color3.fromHex("#b8b8b8")}
				Font={Fonts.Medium}
				TextSize={14}
				TextXAlignment={Enum.TextXAlignment.Center}
				ZIndex={81}
			/>

			{/* Large Bold Clock */}
			<textlabel
				key="Clock"
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 126)}
				Size={new UDim2(0.9, 0, 0, 78)}
				BackgroundTransparency={1}
				Text={timeInfo.timeString}
				TextColor3={Color3.fromHex("#ffffff")}
				Font={Fonts.Bold}
				TextScaled={true}
				TextXAlignment={Enum.TextXAlignment.Center}
				ZIndex={81}
			>
				<uitextsizeconstraint MaxTextSize={72} MinTextSize={32} />
			</textlabel>

			{/* Tap up to unlock hint */}
			<textlabel
				key="UnlockHint"
				AnchorPoint={new Vector2(0.5, 1)}
				Position={new UDim2(0.5, 0, 1, -50)}
				Size={new UDim2(0.8, 0, 0, 18)}
				BackgroundTransparency={1}
				Text="Tap up to unlock"
				TextColor3={Color3.fromHex("#777777")}
				Font={Fonts.Medium}
				TextSize={12}
				TextXAlignment={Enum.TextXAlignment.Center}
				ZIndex={82}
			/>

			{/* Invisible tap surface */}
			<textbutton
				key="UnlockButton"
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundTransparency={1}
				Text=""
				ZIndex={83}
				AutoButtonColor={false}
				Event={{
					Activated: onUnlock,
					MouseButton1Click: onUnlock,
				}}
			/>
		</frame>
	);
}

/**
 * Lock Screen layer of the Smartphone UI.
 * Migrated to React TSX declarative renderer.
 */
export class LockScreenView {
	private hostInstance: GuiObject;
	private root: Root;
	private visible = false;
	private unlockCallbacks: Array<() => void> = [];

	constructor(parent: GuiObject) {
		this.hostInstance = parent;
		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	private render(): void {
		this.root.render(
			<LockScreenComponent
				visible={this.visible}
				onUnlock={() => {
					for (const cb of this.unlockCallbacks) cb();
				}}
			/>,
		);
	}

	public show(): void {
		this.visible = true;
		this.render();
	}

	public hide(): void {
		this.visible = false;
		this.render();
	}

	public onUnlock(cb: () => void): void {
		this.unlockCallbacks.push(cb);
	}

	public updateClock(): void {
		this.render();
	}

	public destroy(): void {
		this.root.unmount();
	}
}
