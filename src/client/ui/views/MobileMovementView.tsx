/**
 * MobileMovementView.tsx
 * Antarmuka kontrol gerak virtual (Jump, Sprint, Crouch, Crawl) khusus perangkat Mobile.
 * Menggunakan format kluster 2x2 responsif berbasis Scale murni (Offset = 0),
 * UIAspectRatioConstraint 1:1, TextScaled, estetika iOS Glassmorphism,
 * serta Class Adapter Pattern untuk komunikasi mulus dengan MobileMovementController.
 */

import React, { useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export interface MobileMovementCallbacks {
	onToggleSprint?: () => void;
	onToggleCrouch?: () => void;
	onToggleCrawl?: () => void;
	onJumpStart?: () => void;
	onJumpEnd?: () => void;
}

export interface MobileMovementProps extends MobileMovementCallbacks {
	visible: boolean;
	isSprinting: boolean;
	isCrouching: boolean;
	isCrawling: boolean;
}

interface MovementButtonProps {
	name: string;
	label: string;
	icon: string;
	size?: UDim2;
	position: UDim2;
	isActive?: boolean;
	onActivated?: () => void;
	onPressDown?: () => void;
	onPressUp?: () => void;
}

function MovementButton({
	name,
	label,
	icon,
	size = new UDim2(0.38, 0, 0.38, 0),
	position,
	isActive = false,
	onActivated,
	onPressDown,
	onPressUp,
}: MovementButtonProps) {
	const [isPressed, setIsPressed] = useState(false);
	const active = isActive || isPressed;

	return (
		<textbutton
			key={name}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={position}
			Size={size}
			BackgroundColor3={active ? Color3.fromHex("#ffffff") : Color3.fromHex("#141416")}
			BackgroundTransparency={active ? 0.08 : 0.35}
			AutoButtonColor={false}
			Active={true}
			Text=""
			ZIndex={66}
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
			<uiaspectratioconstraint
				AspectRatio={1}
				AspectType={Enum.AspectType.ScaleWithParentSize}
				DominantAxis={Enum.DominantAxis.Height}
			/>
			<uistroke
				Color={active ? Color3.fromHex("#ffffff") : Color3.fromHex("#38383a")}
				Thickness={active ? 2.0 : 1.2}
				Transparency={active ? 0.05 : 0.35}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>

			{/* Icon (Identik dengan Style Combat) */}
			<LucideIcon
				name={icon}
				size={new UDim2(0.46, 0, 0.46, 0)}
				anchorPoint={new Vector2(0.5, 0.5)}
				position={new UDim2(0.5, 0, 0.38, 0)}
				color={active ? Color3.fromHex("#0a0a0a") : Color3.fromHex("#f4f4f5")}
				zIndex={67}
			/>

			{/* Label (Identik dengan Style Combat) */}
			<textlabel
				key="ActionLabel"
				AnchorPoint={new Vector2(0.5, 1)}
				Position={new UDim2(0.5, 0, 0.92, 0)}
				Size={new UDim2(0.88, 0, 0.26, 0)}
				BackgroundTransparency={1}
				Text={label}
				TextColor3={active ? Color3.fromHex("#0a0a0a") : Color3.fromHex("#a1a1aa")}
				Font={Fonts.Bold}
				TextScaled={true}
				ZIndex={67}
			>
				<uitextsizeconstraint MaxTextSize={12} MinTextSize={6} />
			</textlabel>
		</textbutton>
	);
}

export function MobileMovementComponent({
	visible,
	isSprinting,
	isCrouching,
	isCrawling,
	onToggleSprint,
	onToggleCrouch,
	onToggleCrawl,
	onJumpStart,
	onJumpEnd,
}: MobileMovementProps) {
	if (!visible) return <></>;

	return (
		<frame
			key="MobileMovementClusterRoot"
			AnchorPoint={new Vector2(1, 1)}
			Position={new UDim2(0.96, 0, 0.94, 0)}
			Size={new UDim2(0.544, 0, 0.40, 0)}
			BackgroundTransparency={1}
			ZIndex={65}
		>
			<uiaspectratioconstraint
				AspectRatio={1.36}
				AspectType={Enum.AspectType.ScaleWithParentSize}
				DominantAxis={Enum.DominantAxis.Height}
			/>

			{/* ============================================================ */}
			{/* KLUSTER GERAK ERGONOMIS (IDENTIK 100% DENGAN COMBAT CONTROLS) */}
			{/* ============================================================ */}

			{/* 1. JUMP BUTTON (Identik 100% dengan letak & ukuran PUNCH di Combat) */}
			<MovementButton
				name="JumpBtn"
				label="JUMP"
				icon="arrow-up"
				size={new UDim2(0.52, 0, 0.52, 0)}
				position={new UDim2(0.81, 0, 0.74, 0)}
				onPressDown={onJumpStart}
				onPressUp={onJumpEnd}
				onActivated={onJumpStart}
			/>

			{/* 2. SPRINT BUTTON (Slot Atas - letak & ukuran identik dengan DASH di Combat) */}
			<MovementButton
				name="SprintBtn"
				label="SPRINT"
				icon="zap"
				size={new UDim2(0.38, 0, 0.38, 0)}
				position={new UDim2(0.85, 0, 0.19, 0)}
				isActive={isSprinting}
				onActivated={onToggleSprint}
			/>

			{/* 3. CROUCH BUTTON (Identik 100% dengan letak & ukuran BLOCK di Combat) */}
			<MovementButton
				name="CrouchBtn"
				label="CROUCH"
				icon="chevron-down"
				size={new UDim2(0.38, 0, 0.38, 0)}
				position={new UDim2(0.51, 0, 0.33, 0)}
				isActive={isCrouching && !isCrawling}
				onActivated={onToggleCrouch}
			/>

			{/* 4. CRAWL BUTTON (Identik 100% dengan letak & ukuran HEAVY di Combat) */}
			<MovementButton
				name="CrawlBtn"
				label="CRAWL"
				icon="chevrons-down"
				size={new UDim2(0.38, 0, 0.38, 0)}
				position={new UDim2(0.41, 0, 0.79, 0)}
				isActive={isCrawling}
				onActivated={onToggleCrawl}
			/>
		</frame>
	);
}

/**
 * Class Adapter Pattern untuk MobileMovementView.
 * Memungkinkan integrasi berorientasi objek yang bersih dengan MobileMovementController.
 */
export class MobileMovementView {
	private static instance?: MobileMovementView;

	private screenGui?: ScreenGui;
	private hostInstance: Instance;
	private root: Root;

	private callbacks: MobileMovementCallbacks = {};
	private state: MobileMovementProps = {
		visible: false,
		isSprinting: false,
		isCrouching: false,
		isCrawling: false,
	};

	constructor(parentContainer?: Instance) {
		const isGuiObject = parentContainer !== undefined && parentContainer.IsA("GuiObject");

		if (isGuiObject) {
			this.hostInstance = parentContainer;
		} else {
			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "MobileMovementGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 45;
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

	public static getInstance(parentContainer?: Instance): MobileMovementView {
		if (!MobileMovementView.instance) {
			MobileMovementView.instance = new MobileMovementView(parentContainer);
		}
		return MobileMovementView.instance;
	}

	private render(): void {
		if (this.screenGui) {
			this.screenGui.Enabled = this.state.visible;
		}
		this.root.render(<MobileMovementComponent {...this.state} {...this.callbacks} />);
	}

	public setCallbacks(callbacks: MobileMovementCallbacks): void {
		this.callbacks = callbacks;
		this.render();
	}

	public setVisible(visible: boolean): void {
		if (this.state.visible === visible) return;
		this.state = { ...this.state, visible };
		this.render();
	}

	public setMovementStates(isSprinting: boolean, isCrouching: boolean, isCrawling: boolean): void {
		if (
			this.state.isSprinting === isSprinting &&
			this.state.isCrouching === isCrouching &&
			this.state.isCrawling === isCrawling
		) {
			return;
		}
		this.state = {
			...this.state,
			isSprinting,
			isCrouching,
			isCrawling,
		};
		this.render();
	}

	public show(): void {
		this.setVisible(true);
	}

	public hide(): void {
		this.setVisible(false);
	}

	public isVisible(): boolean {
		return this.state.visible;
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
			this.screenGui = undefined;
		}
		if (MobileMovementView.instance === this) {
			MobileMovementView.instance = undefined;
		}
	}
}
