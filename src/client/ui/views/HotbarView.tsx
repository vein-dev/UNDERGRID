import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, Workspace } from "@rbxts/services";
import { Fonts } from "../Typography";

export interface SlotData {
	tool?: Tool;
	isEquipped: boolean;
}

export interface HotbarComponentProps {
	slots: Map<number, SlotData>;
	onSlotClicked: (slotNumber: number) => void;
	visible: boolean;
}

export function HotbarSlot({
	slotNumber,
	data,
	onClick,
}: {
	slotNumber: number;
	data?: SlotData;
	onClick: (slot: number) => void;
}) {
	const [isHovered, setIsHovered] = useState(false);
	const isEquipped = data?.isEquipped ?? false;
	const hasTool = data?.tool !== undefined;

	let strokeColor = Color3.fromHex("#262626");
	let strokeThickness = 1.2;
	let bgColor = Color3.fromHex("#121212");
	let bgTrans = 0.45;
	let numColor = Color3.fromHex("#666666");
	let nameColor = Color3.fromHex("#d0d0d0");

	if (hasTool) {
		if (isEquipped) {
			strokeColor = Color3.fromHex("#ffffff");
			strokeThickness = 2.0;
			bgColor = Color3.fromHex("#2c2c2c");
			bgTrans = 0.1;
			numColor = Color3.fromHex("#ffffff");
			nameColor = Color3.fromHex("#ffffff");
		} else {
			strokeColor = isHovered ? Color3.fromHex("#555555") : Color3.fromHex("#3a3a3a");
			strokeThickness = 1.5;
			bgColor = Color3.fromHex("#181818");
			bgTrans = 0.25;
			numColor = Color3.fromHex("#888888");
			nameColor = Color3.fromHex("#d0d0d0");
		}
	} else if (isHovered) {
		strokeColor = Color3.fromHex("#555555");
		strokeThickness = 1.5;
	}

	return (
		<imagebutton
			key={`slot_btn_${slotNumber}`}
			LayoutOrder={slotNumber}
			Size={new UDim2(0, 58, 0, 58)}
			BackgroundColor3={bgColor}
			BackgroundTransparency={bgTrans}
			AutoButtonColor={false}
			Event={{
				MouseEnter: () => setIsHovered(true),
				MouseLeave: () => setIsHovered(false),
				MouseButton1Click: () => onClick(slotNumber),
			}}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<uistroke
				Color={strokeColor}
				Thickness={strokeThickness}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>
			<textlabel
				key="NumberLabel"
				Size={new UDim2(0, 16, 0, 14)}
				Position={new UDim2(0, 6, 0, 4)}
				BackgroundTransparency={1}
				Text={tostring(slotNumber)}
				TextColor3={numColor}
				TextScaled={true}
				Font={Fonts.Bold}
				TextXAlignment={Enum.TextXAlignment.Left}
			>
				<uitextsizeconstraint MaxTextSize={11} MinTextSize={7} />
			</textlabel>
			{data?.tool?.TextureId && data.tool.TextureId !== "" ? (
				<imagelabel
					key="ToolIcon"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.42, 0)}
					Size={new UDim2(0, 32, 0, 32)}
					BackgroundTransparency={1}
					Image={data.tool.TextureId}
				/>
			) : undefined}
			{data?.tool ? (
				<textlabel
					key="ToolName"
					AnchorPoint={new Vector2(0.5, 1)}
					Position={new UDim2(0.5, 0, 1, -4)}
					Size={new UDim2(1, -8, 0, 12)}
					BackgroundTransparency={1}
					Text={data.tool.Name}
					TextColor3={nameColor}
					TextScaled={true}
					Font={Fonts.Medium}
					TextTruncate={Enum.TextTruncate.AtEnd}
				>
					<uitextsizeconstraint MaxTextSize={9} MinTextSize={6} />
				</textlabel>
			) : undefined}
		</imagebutton>
	);
}

export function HotbarComponent({
	slots,
	onSlotClicked,
	visible,
}: HotbarComponentProps) {
	const [scale, setScale] = useState(1);

	useEffect(() => {
		const updateScale = () => {
			const camera = Workspace.CurrentCamera;
			const vp = camera ? camera.ViewportSize : new Vector2(1280, 720);
			const scaleY = (vp.Y * 0.18) / 62;
			const scaleX = (vp.X * 0.85) / 340;
			setScale(math.clamp(math.min(scaleY, scaleX), 0.55, 1.0));
		};

		updateScale();

		const cam = Workspace.CurrentCamera;
		const conn = cam?.GetPropertyChangedSignal("ViewportSize").Connect(updateScale);
		const camConn = Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(updateScale);

		return () => {
			conn?.Disconnect();
			camConn.Disconnect();
		};
	}, []);

	if (!visible) return <></>;

	const slotElements: React.Element[] = [];
	for (let i = 1; i <= HotbarView.MAX_SLOTS; i++) {
		slotElements.push(
			<HotbarSlot
				key={`slot_${i}`}
				slotNumber={i}
				data={slots.get(i)}
				onClick={onSlotClicked}
			/>,
		);
	}

	return (
		<frame
			key="HotbarContainer"
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -16)}
			Size={new UDim2(0, 0, 0, 62)}
			AutomaticSize={Enum.AutomaticSize.X}
			BackgroundTransparency={1}
		>
			<uiscale Scale={scale} />
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Padding={new UDim(0, 6)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<uipadding
				PaddingLeft={new UDim(0, 4)}
				PaddingRight={new UDim(0, 4)}
			/>
			{slotElements}
		</frame>
	);
}

/**
 * Visual View representing the standard 5-slot Hotbar UI.
 * Migrated to React TSX declarative renderer while preserving 100% backward compatibility
 * with HotbarController via its public methods.
 */
export class HotbarView {
	public static readonly MAX_SLOTS = 5;

	private screenGui?: ScreenGui;
	private hostInstance: Instance;
	private root: Root;
	private slots = new Map<number, SlotData>();
	private visible = true;
	private onSlotClickCallback?: (slotNumber: number) => void;

	constructor(parentContainer?: Instance) {
		const isGuiObject = parentContainer && parentContainer.IsA("GuiObject");

		if (isGuiObject) {
			this.hostInstance = parentContainer;
		} else {
			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "StandardHotbarGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 10;
			this.screenGui.ScreenInsets = Enum.ScreenInsets.None;
			this.screenGui.IgnoreGuiInset = true;
			this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;

			const localPlayer = Players.LocalPlayer;
			const playerGui = (parentContainer as PlayerGui) ?? (localPlayer ? localPlayer.FindFirstChild("PlayerGui") as PlayerGui ?? localPlayer.WaitForChild("PlayerGui") as PlayerGui : undefined);
			if (playerGui) {
				this.screenGui.Parent = playerGui;
			}
			this.hostInstance = this.screenGui;
		}

		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	private render(): void {
		this.root.render(
			<HotbarComponent
				slots={this.slots}
				onSlotClicked={(slotNumber) => {
					this.onSlotClickCallback?.(slotNumber);
				}}
				visible={this.visible}
			/>,
		);
	}

	public onSlotClicked(callback: (slotNumber: number) => void): void {
		this.onSlotClickCallback = callback;
	}

	public updateSlots(slots: Map<number, SlotData>): void {
		const newMap = new Map<number, SlotData>();
		slots.forEach((val, key) => newMap.set(key, val));
		this.slots = newMap;
		this.render();
	}

	public setVisible(visible: boolean): void {
		this.visible = visible;
		if (this.screenGui) {
			this.screenGui.Enabled = visible;
		}
		this.render();
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
	}
}
