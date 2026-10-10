import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, Workspace } from "@rbxts/services";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";
import { SpringPresets, useSpring } from "../SpringConfig";

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

	const targetHeight = isEquipped ? 88 : 70;
	const [heightBinding, heightSpring] = useSpring(targetHeight, SpringPresets.snappy);

	// Smooth reactive spring transition when equipped state changes
	useEffect(() => {
		heightSpring.setGoal(targetHeight);
	}, [targetHeight]);

	// Visual theme styling based on HTML template
	let bgColor = Color3.fromHex("#201f1f");
	let bgTrans = 0.15;
	let strokeColor = Color3.fromHex("#2a2a2a");
	let strokeThickness = 1.0;
	let numColor = Color3.fromHex("#c4c7cb");
	let iconColor = Color3.fromHex("#c4c7cb");
	let nameColor = Color3.fromHex("#c4c7cb");
	let iconSize = 26;

	if (hasTool) {
		if (isEquipped) {
			// Template active slot: solid white, crisp black text/icon, elevated height (88px)
			bgColor = Color3.fromHex("#ffffff");
			bgTrans = 0.0;
			strokeColor = Color3.fromHex("#ffffff");
			strokeThickness = 1.5;
			numColor = Color3.fromHex("#000000");
			iconColor = Color3.fromHex("#000000");
			nameColor = Color3.fromHex("#000000");
			iconSize = 28;
		} else if (isHovered) {
			// Template hover slot: surface-container-high, white text/icon
			bgColor = Color3.fromHex("#2a2a2a");
			bgTrans = 0.05;
			strokeColor = Color3.fromHex("#444748");
			strokeThickness = 1.2;
			numColor = Color3.fromHex("#ffffff");
			iconColor = Color3.fromHex("#ffffff");
			nameColor = Color3.fromHex("#ffffff");
			iconSize = 28;
		} else {
			// Template normal item slot: surface-container (#201f1f)
			bgColor = Color3.fromHex("#201f1f");
			bgTrans = 0.15;
			strokeColor = Color3.fromHex("#2a2a2a");
			strokeThickness = 1.0;
			numColor = Color3.fromHex("#c4c7cb");
			iconColor = Color3.fromHex("#c4c7cb");
			nameColor = Color3.fromHex("#c4c7cb");
			iconSize = 26;
		}
	} else {
		// Empty slot
		bgColor = isHovered ? Color3.fromHex("#1a1a1a") : Color3.fromHex("#141414");
		bgTrans = 0.45;
		strokeColor = isHovered ? Color3.fromHex("#3a3a3a") : Color3.fromHex("#222222");
		strokeThickness = 1.0;
		numColor = isHovered ? Color3.fromHex("#888888") : Color3.fromHex("#555555");
		iconColor = Color3.fromHex("#333333");
		nameColor = Color3.fromHex("#333333");
		iconSize = 24;
	}

	// Smart Lucide icon detection matching reference icons (smartphone, radio, lock, etc.)
	let iconName = "box";
	if (data?.tool) {
		const lowerName = data.tool.Name.lower();
		if (lowerName.find("phone")[0] !== undefined) iconName = "smartphone";
		else if (lowerName.find("radio")[0] !== undefined) iconName = "radio";
		else if (lowerName.find("lock")[0] !== undefined || lowerName.find("shield")[0] !== undefined) iconName = "lock";
		else if (lowerName.find("potion")[0] !== undefined || lowerName.find("flask")[0] !== undefined || lowerName.find("med")[0] !== undefined || lowerName.find("health")[0] !== undefined) iconName = "plus";
		else if (lowerName.find("bolt")[0] !== undefined || lowerName.find("lightning")[0] !== undefined || lowerName.find("plasma")[0] !== undefined) iconName = "zap";
		else if (lowerName.find("camera")[0] !== undefined || lowerName.find("video")[0] !== undefined) iconName = "camera";
		else if (lowerName.find("key")[0] !== undefined) iconName = "key";
		else if (lowerName.find("chip")[0] !== undefined || lowerName.find("core")[0] !== undefined) iconName = "cpu";
		else if (lowerName.find("headphone")[0] !== undefined || lowerName.find("audio")[0] !== undefined) iconName = "headphones";
		else if (lowerName.find("wrench")[0] !== undefined || lowerName.find("tool")[0] !== undefined) iconName = "wrench";
		else if (lowerName.find("blade")[0] !== undefined || lowerName.find("dagger")[0] !== undefined || lowerName.find("sword")[0] !== undefined) iconName = "sword";
	}

	return (
		<imagebutton
			key={`slot_btn_${slotNumber}`}
			LayoutOrder={slotNumber}
			Size={heightBinding.map((h) => new UDim2(0, 68, 0, h))}
			BackgroundColor3={bgColor}
			BackgroundTransparency={bgTrans}
			AutoButtonColor={false}
			Event={{
				MouseEnter: () => setIsHovered(true),
				MouseLeave: () => setIsHovered(false),
				MouseButton1Click: () => onClick(slotNumber),
			}}
		>
			<uistroke
				Color={strokeColor}
				Thickness={strokeThickness}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>
			<uipadding
				PaddingTop={new UDim(0, 7)}
				PaddingBottom={new UDim(0, 7)}
				PaddingLeft={new UDim(0, 7)}
				PaddingRight={new UDim(0, 7)}
			/>

			{/* Slot Number (Top Left) */}
			<textlabel
				key="SlotNum"
				AnchorPoint={new Vector2(0, 0)}
				Position={new UDim2(0, 0, 0, 0)}
				Size={new UDim2(0, 20, 0, 16)}
				BackgroundTransparency={1}
				Text={tostring(slotNumber)}
				TextColor3={numColor}
				TextScaled={true}
				Font={Fonts.Bold}
				TextXAlignment={Enum.TextXAlignment.Left}
				TextYAlignment={Enum.TextYAlignment.Top}
			>
				<uitextsizeconstraint MaxTextSize={14} MinTextSize={9} />
			</textlabel>

			{/* Center Icon */}
			{data?.tool?.TextureId && data.tool.TextureId !== "" ? (
				<imagelabel
					key="ToolTexture"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.46, 0)}
					Size={new UDim2(0, iconSize, 0, iconSize)}
					BackgroundTransparency={1}
					Image={data.tool.TextureId}
					ScaleType={Enum.ScaleType.Fit}
				/>
			) : hasTool ? (
				<frame
					key="ToolIconFrame"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.46, 0)}
					Size={new UDim2(0, iconSize, 0, iconSize)}
					BackgroundTransparency={1}
				>
					<LucideIcon
						name={iconName}
						size={new UDim2(1, 0, 1, 0)}
						color={iconColor}
					/>
				</frame>
			) : undefined}

			{/* Bottom Label (Uppercase, Truncated, Centered) */}
			{hasTool ? (
				<textlabel
					key="SlotLabel"
					AnchorPoint={new Vector2(0.5, 1)}
					Position={new UDim2(0.5, 0, 1, 0)}
					Size={new UDim2(1, 0, 0, 12)}
					BackgroundTransparency={1}
					Text={string.upper(data!.tool!.Name)}
					TextColor3={nameColor}
					TextScaled={true}
					Font={isEquipped ? Fonts.Bold : Fonts.Medium}
					TextTruncate={Enum.TextTruncate.AtEnd}
					TextXAlignment={Enum.TextXAlignment.Center}
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
			const scaleFactor = math.clamp(vp.Y / 760, 0.55, 1.25);
			setScale(scaleFactor);
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
			key="HotbarDockContainer"
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -16)}
			Size={new UDim2(0, 0, 0, 88)}
			AutomaticSize={Enum.AutomaticSize.X}
			BackgroundTransparency={1}
		>
			<uiscale Scale={scale} />
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				VerticalAlignment={Enum.VerticalAlignment.Bottom}
				Padding={new UDim(0, 6)}
				SortOrder={Enum.SortOrder.LayoutOrder}
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
