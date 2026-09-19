import React from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, UserInputService } from "@rbxts/services";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export interface CombatCallbacks {
	onM1?: () => void;
	onHeavy?: () => void;
	onBlockStart?: () => void;
	onBlockEnd?: () => void;
	onDash?: () => void;
	onSprintToggle?: () => void;
	onClashMash?: () => void;
}

export interface CombatHudProps extends CombatCallbacks {
	visible: boolean;
	health: number;
	maxHealth: number;
	stamina: number;
	maxStamina: number;
	clashVisible: boolean;
	clashTitle: string;
	clashResultColor?: Color3;
	yourPresses: number;
	enemyPresses: number;
	isMobile?: boolean;
	isSprinting?: boolean;
	isBlocking?: boolean;
}

interface MobileActionButtonProps {
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

function MobileActionButton({
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
}: MobileActionButtonProps) {
	return (
		<textbutton
			key={name}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={position}
			Size={new UDim2(0, size, 0, size)}
			BackgroundColor3={isActive ? Color3.fromHex("#2563eb") : Color3.fromHex("#14161c")}
			BackgroundTransparency={isActive ? 0.15 : 0.3}
			AutoButtonColor={false}
			Text=""
			ZIndex={65}
			Event={{
				Activated: () => onActivated?.(),
				InputBegan: (_, input) => {
					if (
						input.UserInputType === Enum.UserInputType.Touch ||
						input.UserInputType === Enum.UserInputType.MouseButton1
					) {
						onPressDown?.();
					}
				},
				InputEnded: (_, input) => {
					if (
						input.UserInputType === Enum.UserInputType.Touch ||
						input.UserInputType === Enum.UserInputType.MouseButton1
					) {
						onPressUp?.();
					}
				},
			}}
		>
			<uicorner CornerRadius={new UDim(1, 0)} />
			<uistroke
				Color={isActive ? Color3.fromHex("#60a5fa") : Color3.fromHex("#3a4055")}
				Thickness={1.5}
				Transparency={0.2}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>

			{/* Icon */}
			<LucideIcon
				name={icon}
				size={new UDim2(0, iconSize, 0, iconSize)}
				anchorPoint={new Vector2(0.5, 0.5)}
				position={new UDim2(0.5, 0, 0.4, 0)}
				color={accentColor}
				zIndex={66}
			/>

			{/* Label */}
			<textlabel
				key="ActionLabel"
				AnchorPoint={new Vector2(0.5, 1)}
				Position={new UDim2(0.5, 0, 1, -6)}
				Size={new UDim2(1, -6, 0, 12)}
				BackgroundTransparency={1}
				Text={label}
				TextColor3={isActive ? Color3.fromHex("#ffffff") : Color3.fromHex("#cbd5e1")}
				Font={Fonts.Bold}
				TextScaled={true}
				ZIndex={66}
			>
				<uitextsizeconstraint MaxTextSize={9} MinTextSize={7} />
			</textlabel>
		</textbutton>
	);
}

function getStatColor(ratio: number): Color3 {
	if (ratio <= 0.2) {
		return Color3.fromHex("#ff3232"); // Critical Red
	} else if (ratio <= 0.5) {
		return Color3.fromHex("#ffa500"); // Warning Orange
	}
	return Color3.fromHex("#32dc78"); // Healthy Green
}

export function CombatHudComponent({
	visible,
	health,
	maxHealth,
	stamina,
	maxStamina,
	clashVisible,
	clashTitle,
	clashResultColor,
	yourPresses,
	enemyPresses,
	isMobile = false,
	isSprinting = false,
	isBlocking = false,
	onM1,
	onHeavy,
	onBlockStart,
	onBlockEnd,
	onDash,
	onSprintToggle,
	onClashMash,
}: CombatHudProps) {
	const healthRatio = maxHealth > 0 ? math.clamp(health / maxHealth, 0, 1) : 0;
	const staminaRatio = maxStamina > 0 ? math.clamp(stamina / maxStamina, 0, 1) : 0;

	const healthColor = getStatColor(healthRatio);
	const staminaColor = getStatColor(staminaRatio);

	const totalClash = yourPresses + enemyPresses;
	const yourRatio = totalClash > 0 ? math.clamp(yourPresses / totalClash, 0.05, 0.95) : 0.5;
	const enemyRatio = 1 - yourRatio;

	let clashColor = Color3.fromHex("#ffffff");
	if (clashResultColor) {
		clashColor = clashResultColor;
	} else if (yourPresses > enemyPresses) {
		clashColor = Color3.fromHex("#38bdf8");
	} else if (enemyPresses > yourPresses) {
		clashColor = Color3.fromHex("#f43f5e");
	}

	return (
		<>
			{/* Stats Stack: Pada Mobile di Pojok Kanan Atas, pada PC/Desktop di Pojok Kanan Bawah */}
			{visible && (
				<frame
					key="CombatStatsWrapper"
					AnchorPoint={new Vector2(1, isMobile ? 0 : 1)}
					Position={isMobile ? new UDim2(1, -20, 0, 55) : new UDim2(1, -25, 1, -25)}
					Size={new UDim2(0, 230, 0, 0)}
					AutomaticSize={Enum.AutomaticSize.Y}
					BackgroundTransparency={1}
					ZIndex={50}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						HorizontalAlignment={Enum.HorizontalAlignment.Right}
						VerticalAlignment={Enum.VerticalAlignment.Bottom}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{/* 1. Health Bar HUD */}
					<frame
						key="HealthHUD"
						Size={new UDim2(1, 0, 0, 26)}
						BackgroundColor3={Color3.fromHex("#14161c")}
						BackgroundTransparency={0.25}
						LayoutOrder={1}
						ZIndex={50}
					>
						<uicorner CornerRadius={new UDim(0, 6)} />
						<uistroke
							Color={Color3.fromHex("#3a4055")}
							Thickness={1}
							Transparency={0.3}
							ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
						/>

						{/* Fill */}
						<frame
							key="HealthFill"
							Size={new UDim2(healthRatio, 0, 1, 0)}
							BackgroundColor3={healthColor}
							BackgroundTransparency={0.2}
							ZIndex={51}
						>
							<uicorner CornerRadius={new UDim(0, 6)} />
						</frame>

						{/* Icon (Heart) */}
						<LucideIcon
							name="heart"
							size={new UDim2(0, 14, 0, 14)}
							position={new UDim2(0, 8, 0.5, -7)}
							color={Color3.fromHex("#ffffff")}
							zIndex={52}
						/>

						{/* Text */}
						<textlabel
							key="HealthText"
							Position={new UDim2(0, 26, 0, 0)}
							Size={new UDim2(1, -32, 1, 0)}
							BackgroundTransparency={1}
							Text={`${math.floor(health)} / ${maxHealth}`}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextScaled={true}
							TextXAlignment={Enum.TextXAlignment.Right}
							ZIndex={52}
						>
							<uitextsizeconstraint MaxTextSize={12} MinTextSize={9} />
						</textlabel>
					</frame>

					{/* 2. Stamina Bar HUD */}
					<frame
						key="StaminaHUD"
						Size={new UDim2(1, 0, 0, 22)}
						BackgroundColor3={Color3.fromHex("#14161c")}
						BackgroundTransparency={0.25}
						LayoutOrder={2}
						ZIndex={50}
					>
						<uicorner CornerRadius={new UDim(0, 6)} />
						<uistroke
							Color={Color3.fromHex("#3a4055")}
							Thickness={1}
							Transparency={0.3}
							ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
						/>

						{/* Fill */}
						<frame
							key="StaminaFill"
							Size={new UDim2(staminaRatio, 0, 1, 0)}
							BackgroundColor3={staminaColor}
							BackgroundTransparency={0.2}
							ZIndex={51}
						>
							<uicorner CornerRadius={new UDim(0, 6)} />
						</frame>

						{/* Icon (Zap) */}
						<LucideIcon
							name="zap"
							size={new UDim2(0, 12, 0, 12)}
							position={new UDim2(0, 8, 0.5, -6)}
							color={Color3.fromHex("#ffffff")}
							zIndex={52}
						/>

						{/* Text */}
						<textlabel
							key="StaminaText"
							Position={new UDim2(0, 26, 0, 0)}
							Size={new UDim2(1, -32, 1, 0)}
							BackgroundTransparency={1}
							Text={`${math.floor(stamina)} / ${maxStamina}`}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextScaled={true}
							TextXAlignment={Enum.TextXAlignment.Right}
							ZIndex={52}
						>
							<uitextsizeconstraint MaxTextSize={11} MinTextSize={8} />
						</textlabel>
					</frame>
				</frame>
			)}

			{/* Clash Duel Minigame Overlay (Clean & Fresh Glassmorphism) */}
			{clashVisible && (
				<frame
					key="ClashDuelContainer"
					AnchorPoint={new Vector2(0.5, 1)}
					Position={new UDim2(0.5, 0, 1, -120)}
					Size={new UDim2(0, 330, 0, 68)}
					BackgroundColor3={Color3.fromHex("#14161c")}
					BackgroundTransparency={0.25}
					ZIndex={60}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uistroke
						Color={Color3.fromHex("#3a4055")}
						Thickness={1}
						Transparency={0.3}
						ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
					/>

					{/* Title Header */}
					<frame
						key="ClashHeader"
						Position={new UDim2(0, 12, 0, 8)}
						Size={new UDim2(1, -24, 0, 18)}
						BackgroundTransparency={1}
						ZIndex={61}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							HorizontalAlignment={Enum.HorizontalAlignment.Center}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							Padding={new UDim(0, 6)}
						/>
						<LucideIcon
							name="swords"
							size={new UDim2(0, 13, 0, 13)}
							color={clashColor}
							zIndex={62}
						/>
						<textlabel
							key="ClashTitleLabel"
							BackgroundTransparency={1}
							AutomaticSize={Enum.AutomaticSize.XY}
							Text={clashTitle}
							TextColor3={clashColor}
							Font={Fonts.Bold}
							TextSize={12}
							ZIndex={62}
						/>
					</frame>

					{/* Dual Clash Progress Bar Track */}
					<frame
						key="DualClashTrack"
						Position={new UDim2(0, 12, 0, 32)}
						Size={new UDim2(1, -24, 0, 24)}
						BackgroundColor3={Color3.fromHex("#0c0e14")}
						BackgroundTransparency={0.3}
						ZIndex={61}
						ClipsDescendants={true}
					>
						<uicorner CornerRadius={new UDim(0, 6)} />
						<uistroke
							Color={Color3.fromHex("#3a4055")}
							Thickness={1}
							Transparency={0.4}
							ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
						/>

						{/* Your Bar (Fresh Cyan / Sky) */}
						<frame
							key="YourBar"
							Size={new UDim2(yourRatio, 0, 1, 0)}
							Position={new UDim2(0, 0, 0, 0)}
							BackgroundColor3={Color3.fromHex("#38bdf8")}
							BackgroundTransparency={0.2}
							ZIndex={62}
						>
							<uicorner CornerRadius={new UDim(0, 6)} />
						</frame>

						{/* Enemy Bar (Fresh Rose / Coral) */}
						<frame
							key="EnemyBar"
							Size={new UDim2(enemyRatio, 0, 1, 0)}
							Position={new UDim2(yourRatio, 0, 0, 0)}
							BackgroundColor3={Color3.fromHex("#f43f5e")}
							BackgroundTransparency={0.2}
							ZIndex={62}
						>
							<uicorner CornerRadius={new UDim(0, 6)} />
						</frame>

						{/* Frontline Divider */}
						<frame
							key="ClashDivider"
							Position={new UDim2(yourRatio, -1, 0, 0)}
							Size={new UDim2(0, 2, 1, 0)}
							BackgroundColor3={Color3.fromHex("#ffffff")}
							BackgroundTransparency={0.3}
							ZIndex={63}
						/>

						{/* Labels Inside Track */}
						<frame
							key="YourInfo"
							Position={new UDim2(0, 8, 0, 0)}
							Size={new UDim2(0.5, -8, 1, 0)}
							BackgroundTransparency={1}
							ZIndex={65}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								HorizontalAlignment={Enum.HorizontalAlignment.Left}
								Padding={new UDim(0, 4)}
							/>
							<textlabel
								key="YourText"
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text={`YOU (${yourPresses})`}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={11}
								ZIndex={65}
							>
								<uistroke
									Color={Color3.fromHex("#000000")}
									Thickness={1}
									Transparency={0.6}
								/>
							</textlabel>
						</frame>

						<frame
							key="EnemyInfo"
							AnchorPoint={new Vector2(1, 0)}
							Position={new UDim2(1, -8, 0, 0)}
							Size={new UDim2(0.5, -8, 1, 0)}
							BackgroundTransparency={1}
							ZIndex={65}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								HorizontalAlignment={Enum.HorizontalAlignment.Right}
								Padding={new UDim(0, 4)}
							/>
							<textlabel
								key="EnemyText"
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text={`ENEMY (${enemyPresses})`}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={11}
								ZIndex={65}
							>
								<uistroke
									Color={Color3.fromHex("#000000")}
									Thickness={1}
									Transparency={0.6}
								/>
							</textlabel>
						</frame>
					</frame>

					{/* Mobile Big Clash Mash Button */}
					{isMobile && (
						<textbutton
							key="MobileClashMashButton"
							AnchorPoint={new Vector2(0.5, 0)}
							Position={new UDim2(0.5, 0, 1, 10)}
							Size={new UDim2(0, 260, 0, 44)}
							BackgroundColor3={Color3.fromHex("#ef4444")}
							BackgroundTransparency={0.15}
							Text="MASH TAP!"
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={14}
							AutoButtonColor={false}
							ZIndex={65}
							Event={{
								Activated: () => onClashMash?.(),
								MouseButton1Click: () => onClashMash?.(),
							}}
						>
							<uicorner CornerRadius={new UDim(0, 10)} />
							<uistroke Color={Color3.fromHex("#fca5a5")} Thickness={1.5} />
						</textbutton>
					)}
				</frame>
			)}

			{/* Mobile Virtual Buttons Cluster (Khusus Perangkat Mobile Saat Mode Fight Aktif) */}
			{visible && isMobile && (
				<frame
					key="MobileCombatCluster"
					AnchorPoint={new Vector2(1, 1)}
					Position={new UDim2(1, -15, 1, -15)}
					Size={new UDim2(0, 240, 0, 210)}
					BackgroundTransparency={1}
					ZIndex={64}
				>
					{/* PUNCH / M1 */}
					<MobileActionButton
						name="PunchBtn"
						label="PUNCH"
						icon="sword"
						size={68}
						iconSize={26}
						position={new UDim2(0, 195, 0, 165)}
						accentColor={Color3.fromHex("#ffffff")}
						onActivated={onM1}
					/>

					{/* HEAVY / PUSH */}
					<MobileActionButton
						name="HeavyBtn"
						label="HEAVY"
						icon="zap"
						size={52}
						iconSize={22}
						position={new UDim2(0, 125, 0, 175)}
						accentColor={Color3.fromHex("#fbbf24")}
						onActivated={onHeavy}
					/>

					{/* BLOCK (HOLD TO GUARD) */}
					<MobileActionButton
						name="BlockBtn"
						label="BLOCK"
						icon="shield"
						size={52}
						iconSize={22}
						position={new UDim2(0, 125, 0, 110)}
						accentColor={isBlocking ? Color3.fromHex("#ffffff") : Color3.fromHex("#60a5fa")}
						isActive={isBlocking}
						onPressDown={onBlockStart}
						onPressUp={onBlockEnd}
					/>

					{/* DASH / EVADE */}
					<MobileActionButton
						name="DashBtn"
						label="DASH"
						icon="wind"
						size={52}
						iconSize={22}
						position={new UDim2(0, 195, 0, 95)}
						accentColor={Color3.fromHex("#38bdf8")}
						onActivated={onDash}
					/>

					{/* SPRINT TOGGLE */}
					<MobileActionButton
						name="SprintBtn"
						label="SPRINT"
						icon="flame"
						size={46}
						iconSize={20}
						position={new UDim2(0, 55, 0, 145)}
						accentColor={isSprinting ? Color3.fromHex("#ffffff") : Color3.fromHex("#f97316")}
						isActive={isSprinting}
						onActivated={onSprintToggle}
					/>
				</frame>
			)}
		</>
	);
}

/**
 * Visual View representing the Fight Mode UI.
 * Migrated to React TSX declarative renderer while preserving 100% backward compatibility
 * with CombatController via its public methods.
 */
export class CombatHudView {
	private static instance?: CombatHudView;

	private screenGui?: ScreenGui;
	private hostInstance: Instance;
	private root: Root;

	private callbacks: CombatCallbacks = {};

	private state: CombatHudProps = {
		visible: false,
		health: 100,
		maxHealth: 100,
		stamina: 100,
		maxStamina: 100,
		clashVisible: false,
		clashTitle: "MASH SPACE!",
		yourPresses: 1,
		enemyPresses: 1,
		isMobile: false,
		isSprinting: false,
		isBlocking: false,
	};

	constructor(parentContainer?: Instance) {
		this.state.isMobile = UserInputService.TouchEnabled;

		const isGuiObject = parentContainer !== undefined && parentContainer.IsA("GuiObject");

		if (isGuiObject) {
			this.hostInstance = parentContainer;
		} else {
			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "CombatHudGui";
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

	private render(): void {
		if (this.screenGui) {
			this.screenGui.Enabled = this.state.visible || this.state.clashVisible;
		}
		this.root.render(<CombatHudComponent {...this.state} />);
	}

	public static getInstance(): CombatHudView {
		if (!CombatHudView.instance) {
			CombatHudView.instance = new CombatHudView();
		}
		return CombatHudView.instance;
	}

	public setCallbacks(callbacks: CombatCallbacks): void {
		this.callbacks = callbacks;
		this.state = {
			...this.state,
			...callbacks,
		};
		this.render();
	}

	public setCombatStates(isBlocking: boolean, isSprinting: boolean): void {
		this.state = {
			...this.state,
			isBlocking,
			isSprinting,
		};
		this.render();
	}

	public setMobile(isMobile: boolean): void {
		this.state = {
			...this.state,
			isMobile,
		};
		this.render();
	}

	public setVisible(visible: boolean): void {
		this.state = { ...this.state, visible };
		this.render();
	}

	public setHealth(current: number, maxHealth?: number): void {
		const newMax = maxHealth ?? this.state.maxHealth;
		const clamped = math.clamp(current, 0, newMax);
		this.state = { ...this.state, health: clamped, maxHealth: newMax };
		this.render();
	}

	public setStamina(current: number, maxStamina?: number): void {
		const newMax = maxStamina ?? this.state.maxStamina;
		const clamped = math.clamp(current, 0, newMax);
		this.state = { ...this.state, stamina: clamped, maxStamina: newMax };
		this.render();
	}

	public showClash(): void {
		this.state = {
			...this.state,
			clashVisible: true,
			clashTitle: "MASH SPACE!",
			clashResultColor: undefined,
			yourPresses: 1,
			enemyPresses: 1,
		};
		this.render();
	}

	public setClashResult(result: "win" | "lose" | "tie"): void {
		let title = "TIE!";
		let color = Color3.fromHex("#ffffff");
		if (result === "win") {
			title = "VICTORY!";
			color = Color3.fromHex("#32dc78");
		} else if (result === "lose") {
			title = "DEFEAT!";
			color = Color3.fromHex("#f43f5e");
		}

		this.state = {
			...this.state,
			clashTitle: title,
			clashResultColor: color,
		};
		this.render();
	}

	public updateClash(yourPresses: number, oppPresses: number): void {
		this.state = {
			...this.state,
			yourPresses,
			enemyPresses: oppPresses,
			clashResultColor: undefined,
		};
		this.render();
	}

	public hideClash(): void {
		this.state = { ...this.state, clashVisible: false };
		this.render();
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		if (CombatHudView.instance === this) {
			CombatHudView.instance = undefined;
		}
	}
}
