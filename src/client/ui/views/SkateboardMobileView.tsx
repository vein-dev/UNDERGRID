/**
 * SkateboardMobileView.tsx
 * Antarmuka kontrol sentuh (Mobile Touch Controls) untuk skateboard R6.
 * Menggunakan React TSX, Lucide Icons, estetika iOS Glassmorphism,
 * 100% responsif berbasis Scale (Offset = 0), UIAspectRatioConstraint,
 * serta Class Adapter Pattern untuk komunikasi mulus dengan SkateboardController.
 */

import React, { useEffect, useRef, useState } from "@rbxts/react";
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
	size?: UDim2;
	position?: UDim2;
	layoutOrder?: number;
	accentColor?: Color3;
	isActive?: boolean;
	dimmed?: boolean;
	onActivated?: () => void;
	onPressDown?: (input: InputObject) => void;
	onPressUp?: (input: InputObject) => void;
}

function SkateRoundButton({
	name,
	label,
	icon,
	size = new UDim2(0.26, 0, 0.26, 0),
	position,
	layoutOrder,
	accentColor = Color3.fromHex("#ffffff"),
	isActive = false,
	dimmed = false,
	onActivated,
	onPressDown,
	onPressUp,
}: SkateButtonProps) {
	const [isPressed, setIsPressed] = useState(false);
	const active = isActive || isPressed;

	let bgTransparency = 0.35;
	let strokeTransparency = 0.35;
	let strokeColor = Color3.fromHex("#38383a");
	let strokeThickness = 1.2;
	let contentColor = Color3.fromHex("#f4f4f5");
	let labelColor = Color3.fromHex("#a1a1aa");

	if (active) {
		bgTransparency = 0.08;
		strokeTransparency = 0.05;
		strokeColor = Color3.fromHex("#ffffff");
		strokeThickness = 2;
		contentColor = Color3.fromHex("#0a0a0a");
		labelColor = Color3.fromHex("#0a0a0a");
	} else if (dimmed) {
		bgTransparency = 0.65;
		strokeTransparency = 0.7;
		strokeColor = Color3.fromHex("#27272a");
		strokeThickness = 1;
		contentColor = Color3.fromHex("#71717a");
		labelColor = Color3.fromHex("#52525b");
	}

	return (
		<textbutton
			key={name}
			LayoutOrder={layoutOrder}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={position}
			Size={size}
			BackgroundColor3={active ? Color3.fromHex("#ffffff") : Color3.fromHex("#141416")}
			BackgroundTransparency={bgTransparency}
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
						onPressDown?.(input);
					}
				},
				InputEnded: (_, input) => {
					if (
						input.UserInputType === Enum.UserInputType.Touch ||
						input.UserInputType === Enum.UserInputType.MouseButton1
					) {
						setIsPressed(false);
						onPressUp?.(input);
					}
				},
				MouseLeave: () => {
					if (isPressed) {
						setIsPressed(false);
						onPressUp?.(undefined as unknown as InputObject);
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
				Color={strokeColor}
				Thickness={strokeThickness}
				Transparency={strokeTransparency}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>

			{/* Icon */}
			<LucideIcon
				name={icon}
				size={new UDim2(0.46, 0, 0.46, 0)}
				anchorPoint={new Vector2(0.5, 0.5)}
				position={new UDim2(0.5, 0, 0.38, 0)}
				color={contentColor}
				zIndex={56}
			/>

			{/* Action Label */}
			<textlabel
				key="ButtonLabel"
				AnchorPoint={new Vector2(0.5, 1)}
				Position={new UDim2(0.5, 0, 0.92, 0)}
				Size={new UDim2(0.88, 0, 0.26, 0)}
				BackgroundTransparency={1}
				Text={label}
				TextColor3={labelColor}
				Font={Fonts.Bold}
				TextScaled={true}
				ZIndex={56}
			>
				<uitextsizeconstraint MaxTextSize={12} MinTextSize={6} />
			</textlabel>
		</textbutton>
	);
}

interface TrickSatelliteConfig {
	name: string;
	trick: SkateboardTrickName;
	label: string;
	icon: string;
	position: UDim2;
}

const TRICK_CONFIGS: Array<TrickSatelliteConfig> = [
	{
		name: "KickflipBtn",
		trick: "Kickflip",
		label: "KICK",
		icon: "refresh-cw",
		position: new UDim2(0.72, 0, 0.17, 0),
	},
	{
		name: "HeelflipBtn",
		trick: "Heelflip",
		label: "HEEL",
		icon: "refresh-ccw",
		position: new UDim2(0.52, 0, 0.03, 0),
	},
	{
		name: "TreflipBtn",
		trick: "Treflip",
		label: "360",
		icon: "sparkles",
		position: new UDim2(0.33, 0, 0.12, 0),
	},
	{
		name: "ShuvBtn",
		trick: "Shuv",
		label: "SHUV",
		icon: "zap",
		position: new UDim2(0.25, 0, 0.37, 0),
	},
];

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

	const [isHoldingOllie, setIsHoldingOllie] = useState(false);
	const [hoveredTrick, setHoveredTrick] = useState<SkateboardTrickName | undefined>(undefined);

	const isWheelActive = isHoldingOllie || isChargingOllie;

	const activeInputRef = useRef<InputObject | undefined>(undefined);
	const hoveredTrickRef = useRef<SkateboardTrickName | undefined>(undefined);
	const clusterRef = useRef<Frame>();

	// Tangani gesture hold-and-swipe secara responsif dengan orbit radial konsentris
	useEffect(() => {
		if (!isHoldingOllie) return;

		const updateHovered = (screenX: number, screenY: number) => {
			const cluster = clusterRef.current;
			if (cluster && cluster.AbsoluteSize.X > 0 && cluster.AbsoluteSize.Y > 0) {
				const cPos = cluster.AbsolutePosition;
				const cSize = cluster.AbsoluteSize;

				// Koordinat relatif di dalam cluster (0 sampai 1)
				const u = (screenX - cPos.X) / cSize.X;
				const v = (screenY - cPos.Y) / cSize.Y;

				// Jarak dari pusat tombol Ollie di slot Crouch (0.51, 0.37) dengan koreksi AspectRatio 1.36
				const dOllie = math.sqrt(math.pow((u - 0.51) * 1.36, 2) + math.pow(v - 0.37, 2));

				// Jika jari masih berada di dalam radius Ollie, tidak ada trick yang dipilih (normal Ollie)
				if (dOllie < 0.18) {
					hoveredTrickRef.current = undefined;
					setHoveredTrick(undefined);
				} else {
					// Cari trick satelit terdekat
					let closest: SkateboardTrickName | undefined = undefined;
					let minD = 0.22; // Radius deteksi kedekatan

					for (const cfg of TRICK_CONFIGS) {
						const d = math.sqrt(
							math.pow((u - cfg.position.X.Scale) * 1.36, 2) + math.pow(v - cfg.position.Y.Scale, 2),
						);
						if (d < minD) {
							minD = d;
							closest = cfg.trick;
						}
					}

					hoveredTrickRef.current = closest;
					setHoveredTrick(closest);
				}
			}
		};

		const moveConn = UserInputService.InputChanged.Connect((input) => {
			if (
				input === activeInputRef.current ||
				input.UserInputType === Enum.UserInputType.MouseMovement ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				if (
					!activeInputRef.current ||
					input.UserInputType !== Enum.UserInputType.Touch ||
					input === activeInputRef.current
				) {
					updateHovered(input.Position.X, input.Position.Y);
				}
			}
		});

		const endConn = UserInputService.InputEnded.Connect((input) => {
			if (
				input === activeInputRef.current ||
				input.UserInputType === Enum.UserInputType.MouseButton1 ||
				(input.UserInputType === Enum.UserInputType.Touch &&
					(!activeInputRef.current || input === activeInputRef.current))
			) {
				activeInputRef.current = undefined;
				const selectedTrick = hoveredTrickRef.current;
				if (selectedTrick) {
					onTrick?.(selectedTrick);
				}
				onOllieUp?.();
				setIsHoldingOllie(false);
				setHoveredTrick(undefined);
				hoveredTrickRef.current = undefined;
			}
		});

		return () => {
			moveConn.Disconnect();
			endConn.Disconnect();
		};
	}, [isHoldingOllie, onTrick, onOllieUp]);

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
				Position={new UDim2(0.04, 0, 0.94, 0)}
				Size={new UDim2(0.24, 0, 0.14, 0)}
				BackgroundTransparency={1}
				ZIndex={51}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					HorizontalAlignment={Enum.HorizontalAlignment.Left}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0.08, 0)}
				/>

				{/* Tombol Turn Left */}
				<SkateRoundButton
					name="SteerLeftBtn"
					label="L"
					icon="chevron-left"
					size={new UDim2(0.46, 0, 1, 0)}
					layoutOrder={1}
					accentColor={Color3.fromHex("#ffffff")}
					isActive={steerDirection === -1}
					onPressDown={onSteerLeftDown}
					onPressUp={onSteerLeftUp}
				/>

				{/* Tombol Turn Right */}
				<SkateRoundButton
					name="SteerRightBtn"
					label="R"
					icon="chevron-right"
					size={new UDim2(0.46, 0, 1, 0)}
					layoutOrder={2}
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
				Position={new UDim2(0.97, 0, 0.08, 0)}
				Size={new UDim2(0.12, 0, 0.06, 0)}
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
				<uiaspectratioconstraint
					AspectRatio={3}
					AspectType={Enum.AspectType.FitWithinMaxSize}
					DominantAxis={Enum.DominantAxis.Width}
				/>
				<uistroke Color={Color3.fromHex("#38383a")} Thickness={1.2} Transparency={0.35} />

				<frame key="DismountContent" Size={new UDim2(1, 0, 1, 0)} BackgroundTransparency={1} ZIndex={56}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0.06, 0)}
					/>
					<LucideIcon
						name="log-out"
						size={new UDim2(0.35, 0, 0.55, 0)}
						color={Color3.fromHex("#f4f4f5")}
						zIndex={57}
					/>
					<textlabel
						key="DismountText"
						Size={new UDim2(0.55, 0, 0.55, 0)}
						BackgroundTransparency={1}
						Text="DISMOUNT"
						TextColor3={Color3.fromHex("#f4f4f5")}
						Font={Fonts.Bold}
						TextScaled={true}
						ZIndex={57}
					>
						<uitextsizeconstraint MaxTextSize={12} MinTextSize={6} />
					</textlabel>
				</frame>
			</textbutton>

			{/* ============================================================ */}
			{/* SISI KANAN BAWAH: ACTION & TRICK PAD */}
			{/* Menggunakan Scale murni dan proporsi responsif */}
			{/* ============================================================ */}
			<frame
				ref={clusterRef}
				key="ActionPadCluster"
				AnchorPoint={new Vector2(1, 1)}
				Position={new UDim2(0.96, 0, 0.94, 0)}
				Size={new UDim2(0.544, 0, 0.4, 0)}
				BackgroundTransparency={1}
				ZIndex={51}
			>
				<uiaspectratioconstraint
					AspectRatio={1.36}
					AspectType={Enum.AspectType.ScaleWithParentSize}
					DominantAxis={Enum.DominantAxis.Height}
				/>

				{/* 1. PUSH / MAJU (TOMBOL UTAMA PALING BESAR - IDENTIK 1:1 DENGAN JUMP & PUNCH) */}
				<SkateRoundButton
					name="PushBtn"
					label="PUSH"
					icon="chevrons-up"
					size={new UDim2(0.52, 0, 0.52, 0)}
					position={new UDim2(0.81, 0, 0.74, 0)}
					accentColor={Color3.fromHex("#ffffff")}
					isActive={isPushing}
					dimmed={isWheelActive}
					onPressDown={onPushDown}
					onPressUp={onPushUp}
				/>

				{/* 2. OLLIE / LOMPAT (SLOT CROUCH DI TENGAH - PUSAT RADIAL WHEEL) */}
				<SkateRoundButton
					name="OllieBtn"
					label="OLLIE"
					icon="arrow-up"
					size={new UDim2(0.35, 0, 0.35, 0)}
					position={new UDim2(0.51, 0, 0.37, 0)}
					accentColor={Color3.fromHex("#ffffff")}
					isActive={isHoldingOllie || isChargingOllie}
					onPressDown={(input) => {
						activeInputRef.current = input;
						setIsHoldingOllie(true);
						setHoveredTrick(undefined);
						hoveredTrickRef.current = undefined;
						onOllieDown?.();
					}}
				/>

				{/* 3. BRAKE / MUNDUR (SLOT CRAWL DI BAWAH KIRI) */}
				<SkateRoundButton
					name="BrakeBtn"
					label="BRAKE"
					icon="chevron-down"
					size={new UDim2(0.38, 0, 0.38, 0)}
					position={new UDim2(0.38, 0, 0.8, 0)}
					accentColor={Color3.fromHex("#ffffff")}
					isActive={isBraking}
					dimmed={isWheelActive}
					onPressDown={onBrakeDown}
					onPressUp={onBrakeUp}
				/>

				{/* ============================================================ */}
				{/* 4. RADIAL SATELLITE TRICK BUTTONS (MUNCUL MENGITARI OLLIE) */}
				{/* ============================================================ */}
				{isWheelActive &&
					TRICK_CONFIGS.map((trickCfg) => {
						const isHovered = hoveredTrick === trickCfg.trick;
						return (
							<SkateRoundButton
								key={trickCfg.name}
								name={trickCfg.name}
								label={trickCfg.label}
								icon={trickCfg.icon}
								size={new UDim2(0.2, 0, 0.2, 0)}
								position={trickCfg.position}
								accentColor={Color3.fromHex("#ffffff")}
								isActive={isHovered}
								onActivated={() => {
									onTrick?.(trickCfg.trick);
								}}
							/>
						);
					})}
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
		if (this.state.visible !== visible) {
			this.state = { ...this.state, visible };
			this.render();
		}
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

	public setChargingOllie(isCharging: boolean): void {
		if (this.state.isChargingOllie !== isCharging) {
			this.state = { ...this.state, isChargingOllie: isCharging };
			this.render();
		}
	}

	public setPushing(isPushing: boolean): void {
		if (this.state.isPushing !== isPushing) {
			this.state = { ...this.state, isPushing };
			this.render();
		}
	}

	public setBraking(isBraking: boolean): void {
		if (this.state.isBraking !== isBraking) {
			this.state = { ...this.state, isBraking };
			this.render();
		}
	}

	public setSteerDirection(steerDirection: number): void {
		if (this.state.steerDirection !== steerDirection) {
			this.state = { ...this.state, steerDirection };
			this.render();
		}
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
