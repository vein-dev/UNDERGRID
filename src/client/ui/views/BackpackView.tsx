import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { GuiService, Lighting, Players, RunService, UserInputService, Workspace } from "@rbxts/services";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";
import { createSpring, Spring, SpringPresets, useSpring } from "../SpringConfig";

export interface BackpackSlotInfo {
	tool?: Tool;
	isSelected: boolean;
	isEquipped?: boolean;
}

export interface SlotIdentifier {
	slotType: "pickup" | "storage";
	index: number;
}

export interface BackpackComponentProps {
	visible: boolean;
	pickupSlots: Map<number, BackpackSlotInfo>;
	storageSlots: Map<number, BackpackSlotInfo>;
	searchQuery: string;
	onSearchChanged: (query: string) => void;
	onPickupClicked: (slotIndex: number) => void;
	onStorageClicked: (slotIndex: number) => void;
	onClose: () => void;
	onAnimationFinished?: () => void;
}

export function InventorySlot({
	slotType,
	index,
	displayNumber,
	info,
	onClick,
	searchState = "none",
}: {
	slotType: "pickup" | "storage";
	index: number;
	displayNumber?: number;
	info?: BackpackSlotInfo;
	onClick: (index: number) => void;
	searchState?: "match" | "dimmed" | "none";
}) {
	const [isHovered, setIsHovered] = useState(false);

	const isSelected = info?.isSelected ?? false;
	const isEquipped = info?.isEquipped ?? false;
	const hasTool = info?.tool !== undefined;

	const targetScale = isSelected ? 1.05 : isHovered ? 1.03 : 1.0;
	const [scaleBinding, scaleSpring] = useSpring(targetScale, SpringPresets.snappy);

	useEffect(() => {
		scaleSpring.setGoal(targetScale);
	}, [targetScale]);

	// Visual theme styling matching Hotbar system
	let bgColor = Color3.fromHex("#201f1f");
	let bgTransparency = 0.15;
	let strokeColor = Color3.fromHex("#2a2a2a");
	let strokeThickness = 1.0;
	let strokeTransparency = 0;
	let numColor = Color3.fromHex("#c4c7cb");
	let iconColor = Color3.fromHex("#c4c7cb");
	let nameColor = Color3.fromHex("#c4c7cb");
	let contentTransparency = 0;
	let iconSize = 20;

	if (searchState === "dimmed") {
		strokeColor = Color3.fromHex("#1e1f21");
		strokeTransparency = 0.5;
		bgColor = Color3.fromHex("#141517");
		bgTransparency = 0.5;
		numColor = Color3.fromHex("#44474e");
		iconColor = Color3.fromHex("#44474e");
		nameColor = Color3.fromHex("#44474e");
		contentTransparency = 0.5;
		iconSize = 20;
	} else if (searchState === "match") {
		strokeColor = Color3.fromHex("#ffffff");
		strokeThickness = 1.5;
		bgColor = Color3.fromHex("#26282c");
		numColor = Color3.fromHex("#ffffff");
		iconColor = Color3.fromHex("#ffffff");
		nameColor = Color3.fromHex("#ffffff");
		iconSize = 22;
	} else if (isSelected) {
		// High-contrast active inverted card (White card with black text/icon, identik dengan hotbar active)
		strokeColor = Color3.fromHex("#ffffff");
		strokeThickness = 1.5;
		bgColor = Color3.fromHex("#ffffff");
		bgTransparency = 0.0;
		numColor = Color3.fromHex("#000000");
		iconColor = Color3.fromHex("#000000");
		nameColor = Color3.fromHex("#000000");
		iconSize = 22;
	} else if (isEquipped) {
		strokeColor = Color3.fromHex("#ffffff");
		strokeThickness = 1.2;
		bgColor = Color3.fromHex("#282a2e");
		numColor = Color3.fromHex("#ffffff");
		iconColor = Color3.fromHex("#ffffff");
		nameColor = Color3.fromHex("#ffffff");
		iconSize = 22;
	} else if (isHovered) {
		bgColor = Color3.fromHex("#2a2a2a");
		bgTransparency = 0.05;
		strokeColor = Color3.fromHex("#444748");
		strokeThickness = 1.2;
		numColor = Color3.fromHex("#ffffff");
		iconColor = Color3.fromHex("#ffffff");
		nameColor = Color3.fromHex("#ffffff");
		iconSize = 22;
	} else if (!hasTool) {
		// Empty slot (Identik dengan hotbar empty)
		bgColor = isHovered ? Color3.fromHex("#1a1a1a") : Color3.fromHex("#141414");
		bgTransparency = 0.45;
		strokeColor = isHovered ? Color3.fromHex("#3a3a3a") : Color3.fromHex("#222222");
		numColor = isHovered ? Color3.fromHex("#888888") : Color3.fromHex("#555555");
		iconColor = Color3.fromHex("#333333");
		nameColor = Color3.fromHex("#333333");
		iconSize = 18;
	}

	// Smart Lucide icon detection matching reference icons (smartphone, radio, lock, etc.)
	let iconName = "box";
	if (info?.tool) {
		const lowerName = info.tool.Name.lower();
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
		<textbutton
			key={`slot_${slotType}_${index}`}
			Size={new UDim2(0, 64, 0, 64)}
			BackgroundColor3={bgColor}
			BackgroundTransparency={bgTransparency}
			AutoButtonColor={false}
			Text=""
			Event={{
				MouseEnter: () => setIsHovered(true),
				MouseLeave: () => setIsHovered(false),
				MouseButton1Click: () => onClick(index),
			}}
		>
			<uiscale Scale={scaleBinding} />
			<uistroke
				Color={strokeColor}
				Thickness={strokeThickness}
				Transparency={strokeTransparency}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>
			<uipadding
				PaddingTop={new UDim(0, 7)}
				PaddingBottom={new UDim(0, 7)}
				PaddingLeft={new UDim(0, 7)}
				PaddingRight={new UDim(0, 7)}
			/>

			{/* Equipped top-right indicator dot */}
			{isEquipped && !isSelected ? (
				<frame
					key="EquippedDot"
					AnchorPoint={new Vector2(1, 0)}
					Position={new UDim2(1, 0, 0, 0)}
					Size={new UDim2(0, 4, 0, 4)}
					BackgroundColor3={Color3.fromHex("#ffffff")}
					BackgroundTransparency={0}
				/>
			) : undefined}

			{/* Slot number badge: 1 digit for hotbar/pickup only, none for storage/inventory */}
			{slotType === "pickup" && displayNumber !== undefined ? (
				<textlabel
					key="SlotNum"
					AnchorPoint={new Vector2(0, 0)}
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(0, 16, 0, 13)}
					BackgroundTransparency={1}
					Text={tostring(displayNumber)}
					TextColor3={numColor}
					TextTransparency={contentTransparency > 0 ? contentTransparency : 0}
					TextScaled={true}
					Font={Fonts.Bold}
					TextXAlignment={Enum.TextXAlignment.Left}
					TextYAlignment={Enum.TextYAlignment.Top}
				>
					<uitextsizeconstraint MaxTextSize={11} MinTextSize={8} />
				</textlabel>
			) : undefined}

			{/* Tool Icon */}
			{info?.tool?.TextureId && info.tool.TextureId !== "" ? (
				<imagelabel
					key="ToolTexture"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.45, 0)}
					Size={new UDim2(0, iconSize, 0, iconSize)}
					BackgroundTransparency={1}
					Image={info.tool.TextureId}
					ImageTransparency={contentTransparency}
					ImageColor3={isSelected ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")}
					ScaleType={Enum.ScaleType.Fit}
				/>
			) : hasTool ? (
				<frame
					key="ToolIconFrame"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.45, 0)}
					Size={new UDim2(0, iconSize, 0, iconSize)}
					BackgroundTransparency={1}
				>
					<LucideIcon
						name={iconName}
						size={new UDim2(1, 0, 1, 0)}
						color={iconColor}
						transparency={contentTransparency}
					/>
				</frame>
			) : undefined}

			{/* Tool Name: bottom label */}
			{hasTool ? (
				<textlabel
					key="SlotLabel"
					AnchorPoint={new Vector2(0.5, 1)}
					Position={new UDim2(0.5, 0, 1, 0)}
					Size={new UDim2(1, 0, 0, 11)}
					BackgroundTransparency={1}
					Text={string.upper(info!.tool!.Name)}
					TextColor3={nameColor}
					TextTransparency={contentTransparency}
					TextScaled={true}
					Font={isSelected || isEquipped ? Fonts.Bold : Fonts.Medium}
					TextTruncate={Enum.TextTruncate.AtEnd}
					TextXAlignment={Enum.TextXAlignment.Center}
				>
					<uitextsizeconstraint MaxTextSize={8} MinTextSize={6} />
				</textlabel>
			) : undefined}
		</textbutton>
	);
}

function CharacterPreview() {
	const viewportRef = useRef<ViewportFrame>();

	useEffect(() => {
		const vp = viewportRef.current;
		if (!vp) return;

		let charModel: Model | undefined;
		const localChar = Players.LocalPlayer?.Character;

		if (localChar) {
			localChar.Archivable = true;
			charModel = localChar.Clone();
			localChar.Archivable = false;
		} else {
			pcall(() => {
				const uid = Players.LocalPlayer ? Players.LocalPlayer.UserId : 1;
				charModel = Players.CreateHumanoidModelFromUserId((uid > 0 ? uid : 1) as never);
			});
		}

		if (!charModel) return;

		if (!charModel.PrimaryPart) {
			const hrp = charModel.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (hrp) {
				charModel.PrimaryPart = hrp;
			}
		}

		// Clean up non-visual components and configure part anchoring for animation
		for (const desc of charModel.GetDescendants()) {
			if (desc.IsA("Script") || desc.IsA("LocalScript") || desc.IsA("Sound")) {
				desc.Destroy();
			} else if (desc.IsA("BasePart")) {
				// Anchor only HumanoidRootPart so animation can move limbs freely
				if (desc.Name === "HumanoidRootPart" || desc === charModel.PrimaryPart) {
					desc.Anchored = true;
				} else {
					desc.Anchored = false;
				}
				desc.CanCollide = false;
			}
		}

		const humanoid = charModel.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
		}

		// Create WorldModel to enable animation stepping inside ViewportFrame
		const worldModel = new Instance("WorldModel");
		worldModel.Parent = vp;
		charModel.Parent = worldModel;

		let activeTrack: AnimationTrack | undefined;
		if (humanoid) {
			let animator = humanoid.FindFirstChildOfClass("Animator");
			if (!animator) {
				animator = new Instance("Animator");
				animator.Parent = humanoid;
			}

			let idleAnimId: string | undefined;

			// 1. Detect currently playing idle animation from local player
			const localHumanoid = localChar?.FindFirstChildOfClass("Humanoid");
			const localAnimator = localHumanoid?.FindFirstChildOfClass("Animator");
			if (localAnimator) {
				for (const trk of localAnimator.GetPlayingAnimationTracks()) {
					if (trk.Animation && trk.Animation.AnimationId !== "") {
						const nameLower = trk.Name.lower();
						if (nameLower.find("idle")[0] !== undefined || trk.Priority === Enum.AnimationPriority.Idle) {
							idleAnimId = trk.Animation.AnimationId;
							break;
						}
					}
				}
			}

			// 2. Detect from Animate script
			if (!idleAnimId && localChar) {
				const animateScript = localChar.FindFirstChild("Animate");
				const idleFolder = animateScript?.FindFirstChild("idle");
				const idleAnimObj = idleFolder?.FindFirstChildOfClass("Animation");
				if (idleAnimObj && idleAnimObj.AnimationId !== "") {
					idleAnimId = idleAnimObj.AnimationId;
				}
			}

			// 3. Fallback idle animation (R6)
			if (!idleAnimId) {
				idleAnimId = "rbxassetid://180435571";
			}

			if (idleAnimId) {
				pcall(() => {
					const anim = new Instance("Animation");
					anim.AnimationId = idleAnimId!;
					activeTrack = animator!.LoadAnimation(anim);
					activeTrack.Priority = Enum.AnimationPriority.Action4;
					activeTrack.Looped = true;
					activeTrack.Play();
				});
			}
		}

		// Parts reference for upper body & head framing
		const head = charModel.FindFirstChild("Head") as BasePart | undefined;
		const torso = (charModel.FindFirstChild("Torso") ??
			charModel.FindFirstChild("HumanoidRootPart")) as BasePart | undefined;
		const root = (charModel.PrimaryPart ?? torso ?? head) as BasePart | undefined;

		const headPos = head ? head.Position : (torso ? torso.Position.add(new Vector3(0, 1.5, 0)) : Vector3.zero);
		const torsoPos = torso ? torso.Position : headPos.sub(new Vector3(0, 1.5, 0));

		// Midpoint adjusted slightly lower so head and hair comfortably reach near the top boundary of the UI
		const focusPos = torsoPos.add(headPos).mul(0.5).sub(new Vector3(0, 0.28, 0));

		// Determine avatar facing forward vector (horizontal, Y = 0)
		let forward = new Vector3(0, 0, 1);
		if (root) {
			const look = root.CFrame.LookVector;
			const horizontalLook = new Vector3(look.X, 0, look.Z);
			if (horizontalLook.Magnitude > 0.1) {
				forward = horizontalLook.Unit;
			}
		}

		// Camera distance tuned to 6.9 studs with FOV 34: character is larger,
		// top of head/hair aligns with top edge of adjacent inventory UI, and waist aligns with bottom edge
		const cameraDistance = 6.9;
		const cameraPos = focusPos.add(forward.mul(cameraDistance)).add(new Vector3(0, 0.1, 0));

		const camera = new Instance("Camera");
		camera.FieldOfView = 34;
		camera.CFrame = CFrame.lookAt(cameraPos, focusPos, Vector3.yAxis);
		camera.Parent = vp;
		vp.CurrentCamera = camera;

		return () => {
			activeTrack?.Stop();
			charModel?.Destroy();
			worldModel.Destroy();
			camera.Destroy();
		};
	}, []);

	return (
		<viewportframe
			key="CharacterViewport"
			ref={viewportRef}
			Size={new UDim2(0, 360, 0, 352)}
			BackgroundTransparency={1}
			Ambient={Color3.fromRGB(180, 180, 180)}
			LightColor={Color3.fromRGB(240, 240, 240)}
			LightDirection={new Vector3(-1, -1, -1)}
			ZIndex={3}
		/>
	);
}

export function BackpackComponent({
	visible,
	pickupSlots,
	storageSlots,
	searchQuery: initialSearchQuery,
	onSearchChanged,
	onPickupClicked,
	onStorageClicked,
	onClose,
	onAnimationFinished,
}: BackpackComponentProps) {
	const [scale, setScale] = useState(1);
	const [isCompact, setIsCompact] = useState(false);
	const [targetPos, setTargetPos] = useState<UDim2>(new UDim2(0.5, 0, 0.5, 0));
	const [topbarHeight, setTopbarHeight] = useState(54);
	const [shouldRender, setShouldRender] = useState(visible);
	const [searchQuery, setSearchQuery] = useState(initialSearchQuery ?? "");
	const centerWrapperRef = useRef<Frame>();

	const offscreenPos = new UDim2(0.5, 0, 1.4, 0);
	const [posBinding, posSpring] = useSpring(visible ? targetPos : offscreenPos, SpringPresets.gentle);
	const [backdropTransBinding, backdropTransSpring] = useSpring(visible ? 0.35 : 1, SpringPresets.gentle);

	useEffect(() => {
		setSearchQuery(initialSearchQuery ?? "");
	}, [initialSearchQuery]);

	useEffect(() => {
		const updateScale = () => {
			const camera = Workspace.CurrentCamera;
			const vp = camera ? camera.ViewportSize : new Vector2(1280, 720);

			const [topInset, bottomInset] = GuiService.GetGuiInset();
			const topHeight = math.max(topInset.Y, 54);
			setTopbarHeight(topHeight);

			const bottomInsetVal = math.max(bottomInset.Y, 20);
			const availableHeight = math.max(vp.Y - topHeight - bottomInsetVal, 200);
			const availableWidth = math.max(vp.X - math.max(topInset.X, 24) * 2, 280);
			const centerY = topHeight + availableHeight / 2;

			const isPortrait = vp.X < 720 || vp.X < vp.Y;
			setIsCompact(isPortrait);
			setTargetPos(new UDim2(0.5, 0, 0, centerY));

			// AGENTS.md Dynamic Canvas Scaling (3-Pilar Multi-Platform System)
			const baseScale = vp.Y / 760;

			if (isPortrait) {
				// Mobile portrait: single inventory card (384px wide, 352px tall)
				const maxScaleW = availableWidth / 384;
				const maxScaleH = availableHeight / 352;
				const targetScale = math.min(baseScale, maxScaleW, maxScaleH);
				setScale(math.clamp(targetScale, 0.48, 1.15));
			} else {
				// Desktop PC / Landscape: character portrait + inventory card (760px wide, 352px tall)
				// On 1080p desktop (vp.Y = 1080): baseScale is 1.42x, rendering a large, prominent UI
				const maxScaleW = availableWidth / 760;
				const maxScaleH = availableHeight / 352;
				const targetScale = math.min(baseScale, maxScaleW, maxScaleH);
				setScale(math.clamp(targetScale, 0.50, 1.45));
			}
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

	// Smooth reactive spring transitions for modal show/hide
	useEffect(() => {
		if (visible) {
			setShouldRender(true);
			posSpring.setGoal(targetPos);
			backdropTransSpring.setGoal(0.35);
		} else {
			posSpring.setGoal(offscreenPos);
			backdropTransSpring.setGoal(1);
		}
	}, [visible, targetPos]);

	useEffect(() => {
		const unsub = posSpring.onComplete(() => {
			if (!visible) {
				setShouldRender(false);
				onAnimationFinished?.();
			}
		});
		return unsub;
	}, [visible, onAnimationFinished]);

	if (!shouldRender) return <></>;

	const query = searchQuery.lower();
	const isSearching = query !== "";

	// Build pickup slot elements (1 to 5)
	const pickupElements: React.Element[] = [];
	for (let i = 1; i <= BackpackView.PICKUP_SLOT_COUNT; i++) {
		const info = pickupSlots.get(i);
		const toolName = info?.tool?.Name.lower() ?? "";
		const hasTool = info?.tool !== undefined;

		let searchState: "match" | "dimmed" | "none" = "none";
		if (isSearching) {
			if (hasTool && toolName.find(query, 1, true)[0] !== undefined) {
				searchState = "match";
			} else {
				searchState = "dimmed";
			}
		}

		pickupElements.push(
			<InventorySlot
				key={`pickup_${i}`}
				slotType="pickup"
				index={i}
				displayNumber={i}
				info={info}
				searchState={searchState}
				onClick={onPickupClicked}
			/>,
		);
	}

	// Build storage slot elements (1 to 10)
	const storageElements: React.Element[] = [];
	for (let i = 1; i <= BackpackView.STORAGE_SLOT_COUNT; i++) {
		const info = storageSlots.get(i);
		const toolName = info?.tool?.Name.lower() ?? "";
		const hasTool = info?.tool !== undefined;

		let searchState: "match" | "dimmed" | "none" = "none";
		if (isSearching) {
			if (hasTool && toolName.find(query, 1, true)[0] !== undefined) {
				searchState = "match";
			} else {
				searchState = "dimmed";
			}
		}

		storageElements.push(
			<InventorySlot
				key={`storage_${i}`}
				slotType="storage"
				index={i}
				info={info}
				searchState={searchState}
				onClick={onStorageClicked}
			/>,
		);
	}

	return (
		<frame key="BackpackRoot" Size={new UDim2(1, 0, 1, 0)} BackgroundTransparency={1} ZIndex={1}>
			{/* Dark Backdrop */}
			<textbutton
				key="Backdrop"
				Position={new UDim2(0, 0, 0, topbarHeight)}
				Size={new UDim2(1, 0, 1, -topbarHeight)}
				BackgroundColor3={Color3.fromHex("#000000")}
				BackgroundTransparency={backdropTransBinding}
				Text=""
				AutoButtonColor={false}
				ZIndex={1}
				Event={{
					MouseButton1Click: () => {
						const center = centerWrapperRef.current;
						if (center) {
							const mousePos = UserInputService.GetMouseLocation();
							const pos = center.AbsolutePosition;
							const size = center.AbsoluteSize;
							if (
								mousePos.X >= pos.X &&
								mousePos.X <= pos.X + size.X &&
								mousePos.Y >= pos.Y &&
								mousePos.Y <= pos.Y + size.Y
							) {
								return;
							}
						}
						onClose();
					},
				}}
			/>

			{/* Center Split Wrapper: Left = Avatar Viewport, Right = Inventory Storage */}
			<frame
				ref={centerWrapperRef}
				key="CenterWrapper"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={posBinding}
				Size={new UDim2(0, isCompact ? 384 : 760, 0, 352)}
				BackgroundTransparency={1}
				ZIndex={2}
			>
				<uiscale Scale={scale} />
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 16)}
				/>

				{/* Left: 3D Character Viewport (Hidden on compact portrait screens) */}
				{!isCompact && <CharacterPreview />}

				{/* Right: Sleek Dark Inventory & Storage Card */}
				<frame
					key="InventoryPanel"
					Size={new UDim2(0, 384, 0, 352)}
					BackgroundColor3={Color3.fromHex("#0d0e0f")}
					ZIndex={3}
				>
					<uistroke
						Color={Color3.fromHex("#222325")}
						Thickness={1.2}
						ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
					/>
					<uipadding
						PaddingTop={new UDim(0, 20)}
						PaddingBottom={new UDim(0, 20)}
						PaddingLeft={new UDim(0, 20)}
						PaddingRight={new UDim(0, 20)}
					/>

					{/* Top Action Row: Title, Search & Close */}
					<frame
						key="TopRow"
						Size={new UDim2(1, 0, 0, 36)}
						BackgroundTransparency={1}
						ZIndex={4}
					>
						{/* Main Panel Title Image: Inventory Gothic Artwork */}
						<imagelabel
							key="HeaderImageTitle"
							AnchorPoint={new Vector2(0, 0.5)}
							Position={new UDim2(0, 0, 0.5, 0)}
							Size={new UDim2(0, 0, 1, 0)}
							BackgroundTransparency={1}
							Image="rbxassetid://79610305922357"
							ScaleType={Enum.ScaleType.Fit}
							ZIndex={5}
						>
							<uiaspectratioconstraint
								AspectRatio={389 / 108}
								DominantAxis={Enum.DominantAxis.Height}
								AspectType={Enum.AspectType.ScaleWithParentSize}
							/>
						</imagelabel>

						{/* Search Bar */}
						<frame
							key="SearchBar"
							AnchorPoint={new Vector2(1, 0.5)}
							Position={new UDim2(1, -38, 0.5, 0)}
							Size={new UDim2(0, 160, 0, 30)}
							BackgroundColor3={Color3.fromHex("#161719")}
							ZIndex={5}
						>
							<uistroke Color={Color3.fromHex("#2a2b2e")} Thickness={1} />
							<LucideIcon
								name="search"
								size={new UDim2(0, 12, 0, 12)}
								position={new UDim2(0, 8, 0.5, -6)}
								color={Color3.fromHex("#8e9192")}
								zIndex={6}
							/>
							<textbox
								key="SearchInput"
								Position={new UDim2(0, 24, 0, 0)}
								Size={new UDim2(1, -30, 1, 0)}
								BackgroundTransparency={1}
								PlaceholderText="SEARCH..."
								PlaceholderColor3={Color3.fromHex("#606368")}
								Text={searchQuery}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Regular}
								TextSize={10}
								TextXAlignment={Enum.TextXAlignment.Left}
								ClearTextOnFocus={false}
								ZIndex={6}
								Change={{
									Text: (rbx) => {
										setSearchQuery(rbx.Text);
										onSearchChanged?.(rbx.Text);
									},
								}}
							/>
						</frame>

						{/* Close Button */}
						<textbutton
							key="CloseBtn"
							AnchorPoint={new Vector2(1, 0.5)}
							Position={new UDim2(1, 0, 0.5, 0)}
							Size={new UDim2(0, 30, 0, 30)}
							BackgroundColor3={Color3.fromHex("#161719")}
							Text=""
							AutoButtonColor={false}
							ZIndex={5}
							Event={{
								MouseButton1Click: onClose,
							}}
						>
							<uistroke Color={Color3.fromHex("#2a2b2e")} Thickness={1} />
							<LucideIcon
								name="x"
								size={new UDim2(0, 13, 0, 13)}
								anchorPoint={new Vector2(0.5, 0.5)}
								position={new UDim2(0.5, 0, 0.5, 0)}
								color={Color3.fromHex("#aaaaaa")}
								zIndex={6}
							/>
						</textbutton>
					</frame>

					{/* Section 1: Pickup (Hotbar) */}
					<frame
						key="PickupSection"
						Position={new UDim2(0, 0, 0, 52)}
						Size={new UDim2(1, 0, 0, 86)}
						BackgroundTransparency={1}
						ZIndex={4}
					>
						<textlabel
							key="PickupTitle"
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text="HOTBAR"
							TextColor3={Color3.fromHex("#b0b3b8")}
							Font={Fonts.Bold}
							TextSize={11}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={5}
						/>

						{/* 5 Slots Row (1:1 square slots) */}
						<frame
							key="PickupGrid"
							Position={new UDim2(0, 0, 0, 22)}
							Size={new UDim2(1, 0, 0, 64)}
							BackgroundTransparency={1}
							ZIndex={5}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								Padding={new UDim(0, 6)}
							/>
							{pickupElements}
						</frame>
					</frame>

					{/* Section 2: Storage (Inventory) */}
					<frame
						key="StorageSection"
						Position={new UDim2(0, 0, 0, 156)}
						Size={new UDim2(1, 0, 0, 156)}
						BackgroundTransparency={1}
						ZIndex={4}
					>
						<textlabel
							key="StorageTitle"
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text="INVENTORY"
							TextColor3={Color3.fromHex("#b0b3b8")}
							Font={Fonts.Bold}
							TextSize={11}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={5}
						/>

						{/* 5 Columns x 2 Rows Grid (10 slots, 1:1 square ratio) */}
						<frame
							key="StorageGrid"
							Position={new UDim2(0, 0, 0, 22)}
							Size={new UDim2(1, 0, 0, 134)}
							BackgroundTransparency={1}
							ZIndex={5}
						>
							<uigridlayout
								CellSize={new UDim2(0, 64, 0, 64)}
								CellPadding={new UDim2(0, 6, 0, 6)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{storageElements}
						</frame>
					</frame>
				</frame>
			</frame>
		</frame>
	);
}

/**
 * UI View for Backpack & Storage System.
 * Migrated to React TSX declarative renderer while preserving 100% backward compatibility
 * with BackpackController via its public methods.
 */
export class BackpackView {
	public static readonly PICKUP_SLOT_COUNT = 5;
	public static readonly STORAGE_SLOT_COUNT = 10;

	private screenGui?: ScreenGui;
	private hostInstance: Instance;
	private root: Root;
	private isGuiObject: boolean;

	private _isVisible = false;
	private pickupSlots = new Map<number, BackpackSlotInfo>();
	private storageSlots = new Map<number, BackpackSlotInfo>();
	private searchQuery = "";

	private onPickupClickCallback?: (slotIndex: number) => void;
	private onStorageClickCallback?: (slotIndex: number) => void;
	private onSearchChangeCallback?: (query: string) => void;
	private onCloseCallback?: () => void;
	private originalFOV = 70;
	private fovSpring?: Spring<number>;
	private blurSpring?: Spring<number>;

	constructor(parentContainer?: Instance) {
		const isGuiObject = parentContainer && parentContainer.IsA("GuiObject");
		this.isGuiObject = isGuiObject === true;

		if (isGuiObject) {
			this.hostInstance = parentContainer;
		} else {
			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "BackpackSystemGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 200;
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

	private updateBlurEffect(visible: boolean): void {
		// Only manage blur during active gameplay, avoid permanently modifying Lighting in preview
		if (!RunService.IsRunning() && this.isGuiObject) return;

		let blur = Lighting.FindFirstChild("BackpackBlur") as BlurEffect | undefined;
		if (!this.blurSpring) {
			this.blurSpring = createSpring(0, SpringPresets.gentle);
			this.blurSpring.onChange((size: number) => {
				const currentBlur = Lighting.FindFirstChild("BackpackBlur") as BlurEffect | undefined;
				if (currentBlur) {
					currentBlur.Size = size;
				}
			});
			this.blurSpring.onComplete((size: number) => {
				if (!this._isVisible && size <= 0.5) {
					const currentBlur = Lighting.FindFirstChild("BackpackBlur") as BlurEffect | undefined;
					if (currentBlur) {
						currentBlur.Enabled = false;
					}
				}
			});
		}

		if (visible) {
			if (!blur) {
				blur = new Instance("BlurEffect");
				blur.Name = "BackpackBlur";
				blur.Size = 0;
				blur.Parent = Lighting;
			}
			blur.Enabled = true;
			this.blurSpring.setGoal(20);
		} else if (blur) {
			this.blurSpring.setGoal(0);
		}
	}

	private render(): void {
		this.root.render(
			<BackpackComponent
				visible={this._isVisible}
				pickupSlots={this.pickupSlots}
				storageSlots={this.storageSlots}
				searchQuery={this.searchQuery}
				onSearchChanged={(q) => {
					this.searchQuery = q;
					this.onSearchChangeCallback?.(q);
				}}
				onPickupClicked={(idx) => {
					this.onPickupClickCallback?.(idx);
				}}
				onStorageClicked={(idx) => {
					this.onStorageClickCallback?.(idx);
				}}
				onClose={() => {
					this.setVisible(false);
					this.onCloseCallback?.();
				}}
				onAnimationFinished={() => {
					if (!this._isVisible && this.screenGui) {
						this.screenGui.Enabled = false;
					}
				}}
			/>,
		);
	}

	public onPickupClicked(callback: (slotIndex: number) => void): void {
		this.onPickupClickCallback = callback;
	}

	public onStorageClicked(callback: (slotIndex: number) => void): void {
		this.onStorageClickCallback = callback;
	}

	public onDrop(_callback: (from: SlotIdentifier, to: SlotIdentifier) => void): void {
		// Retained for backward compatibility; item swapping is managed via onPickupClicked / onStorageClicked
	}

	public onSearchChanged(callback: (query: string) => void): void {
		this.onSearchChangeCallback = callback;
	}

	public onClose(callback: () => void): void {
		this.onCloseCallback = callback;
	}

	public updatePickupSlots(slots: Map<number, BackpackSlotInfo>): void {
		const newMap = new Map<number, BackpackSlotInfo>();
		slots.forEach((v, k) => newMap.set(k, v));
		this.pickupSlots = newMap;
		this.render();
	}

	public updateStorageSlots(slots: Map<number, BackpackSlotInfo>, filterQuery?: string): void {
		const newMap = new Map<number, BackpackSlotInfo>();
		slots.forEach((v, k) => newMap.set(k, v));
		this.storageSlots = newMap;
		if (filterQuery !== undefined) {
			this.searchQuery = filterQuery;
		}
		this.render();
	}

	private animateFOV(zoomIn: boolean): void {
		if (!RunService.IsRunning() && this.isGuiObject) return;
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		if (!this.fovSpring) {
			this.originalFOV = camera.FieldOfView > 0 ? camera.FieldOfView : 70;
			this.fovSpring = createSpring(camera.FieldOfView, SpringPresets.gentle);
			this.fovSpring.onChange((fov: number) => {
				const currentCam = Workspace.CurrentCamera;
				if (currentCam) {
					currentCam.FieldOfView = fov;
				}
			});
		}

		if (zoomIn) {
			this.originalFOV = camera.FieldOfView > 0 ? camera.FieldOfView : 70;
			const targetFOV = math.max(this.originalFOV - 35, 45); // Zoom-in halus identik dengan smartphone & emote modal
			this.fovSpring.setGoal(targetFOV);
		} else {
			this.fovSpring.setGoal(this.originalFOV);
		}
	}

	public setVisible(visible: boolean, onFinished?: () => void): void {
		this._isVisible = visible;
		if (visible) {
			if (this.screenGui) {
				this.screenGui.Enabled = true;
				this.screenGui.DisplayOrder = 200;
			}
			this.animateFOV(true);
			this.updateBlurEffect(true);
			this.render();
			onFinished?.();
		} else {
			this.animateFOV(false);
			this.updateBlurEffect(false);
			this.render();
			if (onFinished) {
				task.delay(0.28, onFinished);
			}
		}
	}

	public isVisible(): boolean {
		return this._isVisible;
	}

	public destroy(): void {
		this.fovSpring?.destroy();
		this.blurSpring?.destroy();
		const camera = Workspace.CurrentCamera;
		if (camera && this._isVisible) {
			camera.FieldOfView = this.originalFOV;
		}
		this.updateBlurEffect(false);
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		const blur = Lighting.FindFirstChild("BackpackBlur") as BlurEffect | undefined;
		if (blur) {
			blur.Destroy();
		}
	}
}
