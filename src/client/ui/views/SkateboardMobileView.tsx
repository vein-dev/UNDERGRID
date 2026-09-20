/**
 * SkateboardMobileView.tsx
 * Antarmuka kontrol sentuh (Mobile Touch Controls) untuk skateboard R6.
 * Menggunakan React TSX, Lucide Icons, estetika iOS Glassmorphism,
 * serta Class Adapter Pattern untuk komunikasi mulus dengan SkateboardController.
 */

import React, { useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, UserInputService } from "@rbxts/services";
import { SkateboardTrickName } from "shared/types";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export interface SkateboardMobileCallbacks {
	onPushDown?: () => void;
	onPushUp?: () => void;
	onBrakeDown?: () => void;
	onBrakeUp?: () => void;
	onOllieDown?: () => void;
	onOllieUp?: () => void;
	onSteerLeftDown?: () => void;
	onSteerLeftUp?: () => void;
	onSteerRightDown?: () => void;
	onSteerRightUp?: () => void;
	onTrick?: (trickName: SkateboardTrickName) => void;
	onDismount?: () => void;
}

export interface SkateboardMobileProps extends SkateboardMobileCallbacks {
	visible: boolean;
	currentState?: string;
	isChargingOllie?: boolean;
	isPushing?: boolean;
	isBraking?: boolean;
	steerDirection?: number;
}

interface SkateButtonProps {
	name: string;
	label: string;
	icon: string;
	size: number;
	position: UDim2;
	iconSize?: number;
	accentColor?: Color3;
	isActive?: boolean;
	onActivated?: () => void;
	onPressDown?: () => void;
	onPressUp?: () => void;
}

function SkateRoundButton({
	name,
	label,
	icon,
	size,
	position,
	iconSize = 22,
	accentColor = Color3.fromHex("#ffffff"),
	isActive = false,
	onActivated,
	onPressDown,
	onPressUp,
}: SkateButtonProps) {
	const [isPressed, setIsPressed] = useState(false);
	const active = isActive || isPressed;

	return (
		<textbutton
			key={name}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={position}
			Size={new UDim2(0, size, 0, size)}
			BackgroundColor3={active ? Color3.fromHex("#ffffff") : Color3.fromHex("#141416")}
			BackgroundTransparency={active ? 0.08 : 0.35}
			AutoButtonColor={false}
			Active={true}
			Text=""
			ZIndex={55}
			Event={{
				Activated: () => onActivated?.(),
				InputBegan: (_, input) => {
					if (
						input.UserInputType === Enum.UserInputType.Touch ||
						input.UserInputType === Enum.UserInputType.MouseButton1
					) {
						setIsPressed(true);
						onPressDown?.();
					}
				},
				InputEnded: (_, input) => {
					if (
						input.UserInputType === Enum.UserInputType.Touch ||
						input.UserInputType === Enum.UserInputType.MouseButton1
					) {
						setIsPressed(false);
						onPressUp?.();
					}
				},
				MouseLeave: () => {
					if (isPressed) {
						setIsPressed(false);
						onPressUp?.();
					}
				},
			}}
		>
			<uicorner CornerRadius={new UDim(1, 0)} />
			<uistroke
				Color={active ? Color3.fromHex("#ffffff") : Color3.fromHex("#38383a")}
				Thickness={active ? 2 : 1.2}
				Transparency={active ? 0.05 : 0.35}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>

			{/* Icon */}
			<LucideIcon
				name={icon}
				size={new UDim2(0, iconSize, 0, iconSize)}
				anchorPoint={new Vector2(0.5, 0.5)}
				position={new UDim2(0.5, 0, 0.38, 0)}
				color={active ? Color3.fromHex("#0a0a0a") : Color3.fromHex("#f4f4f5")}
				zIndex={56}
			/>

			{/* Action Label */}
			<textlabel
				key="ButtonLabel"
				AnchorPoint={new Vector2(0.5, 1)}
				Position={new UDim2(0.5, 0, 1, -5)}
				Size={new UDim2(1, -4, 0, 11)}
				BackgroundTransparency={1}
				Text={label}
				TextColor3={active ? Color3.fromHex("#0a0a0a") : Color3.fromHex("#a1a1aa")}
				Font={Fonts.Bold}
				TextScaled={true}
				ZIndex={56}
			>
				<uitextsizeconstraint MaxTextSize={9} MinTextSize={7} />
			</textlabel>
		</textbutton>
	);
}

export function SkateboardMobileComponent({
	visible,
	currentState = "Idle",
	isChargingOllie = false,
	isPushing = false,
	isBraking = false,
	steerDirection = 0,
	onPushDown,
	onPushUp,
	onBrakeDown,
	onBrakeUp,
	onOllieDown,
	onOllieUp,
	onSteerLeftDown,
	onSteerLeftUp,
	onSteerRightDown,
	onSteerRightUp,
	onTrick,
	onDismount,
}: SkateboardMobileProps) {
	if (!visible) return <></>;

	return (
		<frame
			key="SkateboardMobileHudRoot"
			Position={new UDim2(0, 0, 0, 0)}
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			ZIndex={50}
		>
			{/* ============================================================ */}
			{/* SISI KIRI: STEERING CLUSTER (LEFT / RIGHT) */}
			{/* ============================================================ */}
			<frame
				key="SteerCluster"
				AnchorPoint={new Vector2(0, 1)}
				Position={new UDim2(0, 20, 1, -25)}
				Size={new UDim2(0, 140, 0, 80)}
				BackgroundTransparency={1}
				ZIndex={51}
			>
				{/* Tombol Turn Left */}
				<SkateRoundButton
					name="SteerLeftBtn"
					label="LEFT"
					icon="chevron-left"
					size={54}
					iconSize={26}
					position={new UDim2(0, 30, 0, 46)}
					accentColor={Color3.fromHex("#ffffff")}
					isActive={steerDirection === -1}
					onPressDown={onSteerLeftDown}
					onPressUp={onSteerLeftUp}
				/>

				{/* Tombol Turn Right */}
				<SkateRoundButton
					name="SteerRightBtn"
					label="RIGHT"
					icon="chevron-right"
					size={54}
					iconSize={26}
					position={new UDim2(0, 95, 0, 46)}
					accentColor={Color3.fromHex("#ffffff")}
					isActive={steerDirection === 1}
					onPressDown={onSteerRightDown}
					onPressUp={onSteerRightUp}
				/>
			</frame>

			{/* ============================================================ */}
			{/* SISI KANAN ATAS: TOMBOL DISMOUNT */}
			{/* ============================================================ */}
			<textbutton
				key="DismountBtn"
				AnchorPoint={new Vector2(1, 0)}
				Position={new UDim2(1, -20, 0, 65)}
				Size={new UDim2(0, 100, 0, 36)}
				BackgroundColor3={Color3.fromHex("#141416")}
				BackgroundTransparency={0.35}
				AutoButtonColor={false}
				Text=""
				ZIndex={55}
				Event={{
					Activated: () => onDismount?.(),
				}}
			>
				<uicorner CornerRadius={new UDim(1, 0)} />
				<uistroke Color={Color3.fromHex("#38383a")} Thickness={1.2} Transparency={0.35} />

				<frame key="DismountContent" Size={new UDim2(1, 0, 1, 0)} BackgroundTransparency={1} ZIndex={56}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 6)}
					/>
					<LucideIcon
						name="log-out"
						size={new UDim2(0, 16, 0, 16)}
						color={Color3.fromHex("#f4f4f5")}
						zIndex={57}
					/>
					<textlabel
						key="DismountText"
						BackgroundTransparency={1}
						AutomaticSize={Enum.AutomaticSize.XY}
						Text="DISMOUNT"
						TextColor3={Color3.fromHex("#f4f4f5")}
						Font={Fonts.Bold}
						TextSize={10}
						ZIndex={57}
					/>
				</frame>
			</textbutton>

			{/* ============================================================ */}
			{/* SISI KANAN BAWAH: ACTION & TRICK PAD */}
			{/* ============================================================ */}
			<frame
				key="ActionPadCluster"
				AnchorPoint={new Vector2(1, 1)}
				Position={new UDim2(1, 0, 1, 0)}
				Size={new UDim2(0, 260, 0, 260)}
				BackgroundTransparency={1}
				ZIndex={51}
			>
				{/* 1. PUSH / MAJU (TOMBOL UTAMA PALING BESAR) */}
				<SkateRoundButton
					name="PushBtn"
					label="PUSH"
					icon="chevrons-up"
					size={74}
					iconSize={32}
					position={new UDim2(1, -55, 1, -55)}
					accentColor={Color3.fromHex("#ffffff")}
					isActive={isPushing}
					onPressDown={onPushDown}
					onPressUp={onPushUp}
				/>

				{/* 2. OLLIE / LOMPAT */}
				<SkateRoundButton
					name="OllieBtn"
					label="OLLIE"
					icon="arrow-up"
					size={58}
					iconSize={26}
					position={new UDim2(1, -55, 1, -140)}
					accentColor={Color3.fromHex("#ffffff")}
					isActive={isChargingOllie}
					onPressDown={onOllieDown}
					onPressUp={onOllieUp}
				/>

				{/* 3. BRAKE / MUNDUR */}
				<SkateRoundButton
					name="BrakeBtn"
					label="BRAKE"
					icon="chevron-down"
					size={54}
					iconSize={24}
					position={new UDim2(1, -135, 1, -55)}
					accentColor={Color3.fromHex("#ffffff")}
					isActive={isBraking}
					onPressDown={onBrakeDown}
					onPressUp={onBrakeUp}
				/>

				{/* 4. TRICK 1: KICKFLIP */}
				<SkateRoundButton
					name="KickflipBtn"
					label="KICK"
					icon="refresh-cw"
					size={46}
					iconSize={20}
					position={new UDim2(1, -135, 1, -135)}
					accentColor={Color3.fromHex("#ffffff")}
					onActivated={() => onTrick?.("Kickflip")}
				/>

				{/* 5. TRICK 2: HEELFLIP */}
				<SkateRoundButton
					name="HeelflipBtn"
					label="HEEL"
					icon="refresh-ccw"
					size={46}
					iconSize={20}
					position={new UDim2(1, -195, 1, -115)}
					accentColor={Color3.fromHex("#ffffff")}
					onActivated={() => onTrick?.("Heelflip")}
				/>

				{/* 6. TRICK 3: 360 FLIP (TREFLIP) */}
				<SkateRoundButton
					name="TreflipBtn"
					label="360"
					icon="sparkles"
					size={46}
					iconSize={20}
					position={new UDim2(1, -135, 1, -200)}
					accentColor={Color3.fromHex("#ffffff")}
					onActivated={() => onTrick?.("Treflip")}
				/>

				{/* 7. TRICK 4: POP SHUVIT */}
				<SkateRoundButton
					name="ShuvBtn"
					label="SHUV"
					icon="zap"
					size={46}
					iconSize={20}
					position={new UDim2(1, -195, 1, -180)}
					accentColor={Color3.fromHex("#ffffff")}
					onActivated={() => onTrick?.("Shuv")}
				/>
			</frame>
		</frame>
	);
}

/**
 * Class Adapter Pattern untuk SkateboardMobileView.
 * Memungkinkan integrasi berorientasi objek yang bersih dengan SkateboardController.
 */
export class SkateboardMobileView {
	private static instance?: SkateboardMobileView;

	private screenGui?: ScreenGui;
	private hostInstance: Instance;
	private root: Root;

	private callbacks: SkateboardMobileCallbacks = {};

	private state: SkateboardMobileProps = {
		visible: false,
		currentState: "Idle",
		isChargingOllie: false,
		isPushing: false,
		isBraking: false,
		steerDirection: 0,
	};

	constructor(parentContainer?: Instance) {
		const isGuiObject = parentContainer !== undefined && parentContainer.IsA("GuiObject");

		if (isGuiObject) {
			this.hostInstance = parentContainer;
		} else {
			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "SkateboardMobileGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 50;
			this.screenGui.ScreenInsets = Enum.ScreenInsets.None;
			this.screenGui.IgnoreGuiInset = true;
			this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;

			const localPlayer = Players.LocalPlayer;
			const playerGui =
				(parentContainer as PlayerGui) ??
				(localPlayer
					? ((localPlayer.FindFirstChild("PlayerGui") as PlayerGui) ??
						(localPlayer.WaitForChild("PlayerGui") as PlayerGui))
					: undefined);

			if (playerGui) {
				this.screenGui.Parent = playerGui;
			}
			this.hostInstance = this.screenGui;
		}

		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	public static getInstance(parentContainer?: Instance): SkateboardMobileView {
		if (!SkateboardMobileView.instance) {
			SkateboardMobileView.instance = new SkateboardMobileView(parentContainer);
		}
		return SkateboardMobileView.instance;
	}

	private render(): void {
		if (this.screenGui) {
			this.screenGui.Enabled = this.state.visible;
		}
		this.root.render(<SkateboardMobileComponent {...this.state} {...this.callbacks} />);
	}

	public setCallbacks(callbacks: SkateboardMobileCallbacks): void {
		this.callbacks = callbacks;
		this.render();
	}

	public setVisible(visible: boolean): void {
		if (this.state.visible === visible) return;
		this.state = { ...this.state, visible };
		this.render();
	}

	public show(): void {
		this.setVisible(true);
	}

	public hide(): void {
		this.setVisible(false);
	}

	public setChargingOllie(charging: boolean): void {
		if (this.state.isChargingOllie === charging) return;
		this.state = { ...this.state, isChargingOllie: charging };
		this.render();
	}

	public setPushing(pushing: boolean): void {
		if (this.state.isPushing === pushing) return;
		this.state = { ...this.state, isPushing: pushing };
		this.render();
	}

	public setBraking(braking: boolean): void {
		if (this.state.isBraking === braking) return;
		this.state = { ...this.state, isBraking: braking };
		this.render();
	}

	public setSteerDirection(dir: number): void {
		if (this.state.steerDirection === dir) return;
		this.state = { ...this.state, steerDirection: dir };
		this.render();
	}

	public setCurrentState(currentState: string): void {
		if (this.state.currentState === currentState) return;
		this.state = { ...this.state, currentState };
		this.render();
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
			this.screenGui = undefined;
		}
		if (SkateboardMobileView.instance === this) {
			SkateboardMobileView.instance = undefined;
		}
	}
}
