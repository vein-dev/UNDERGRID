import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Lighting, Players, RunService, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

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
	displayNumber: number;
	info?: BackpackSlotInfo;
	onClick: (index: number) => void;
	searchState?: "match" | "dimmed" | "none";
}) {
	const [isHovered, setIsHovered] = useState(false);

	const isSelected = info?.isSelected ?? false;
	const isEquipped = info?.isEquipped ?? false;

	let strokeColor = Color3.fromHex("#2e313d");
	let strokeThickness = 1.0;
	let strokeTransparency = 0;
	let bgColor = Color3.fromHex("#22242b");
	let bgTransparency = 0;
	let labelColor = Color3.fromHex("#6b6f80");
	let nameColor = Color3.fromHex("#cccccc");
	let contentTransparency = 0;

	if (searchState === "dimmed") {
		strokeColor = Color3.fromHex("#1f212a");
		strokeThickness = 1.0;
		strokeTransparency = 0.5;
		bgColor = Color3.fromHex("#16171e");
		bgTransparency = 0.5;
		labelColor = Color3.fromHex("#3a3c48");
		nameColor = Color3.fromHex("#555866");
		contentTransparency = 0.75;
	} else if (searchState === "match") {
		strokeColor = Color3.fromHex("#38bdf8"); // Sky Blue highlight border
		strokeThickness = 1.8;
		strokeTransparency = 0;
		bgColor = Color3.fromHex("#192438"); // Modern glassmorphic accent tint
		labelColor = Color3.fromHex("#38bdf8");
		nameColor = Color3.fromHex("#ffffff");
		contentTransparency = 0;
	}

	if (isSelected) {
		strokeColor = Color3.fromHex("#ffffff");
		strokeThickness = 2.0;
		strokeTransparency = 0;
		bgColor = Color3.fromHex("#333642");
		bgTransparency = 0;
		labelColor = Color3.fromHex("#ffffff");
		nameColor = Color3.fromHex("#ffffff");
		contentTransparency = 0;
	} else if (isEquipped) {
		strokeColor = Color3.fromHex("#32dc78");
		strokeThickness = 1.5;
		strokeTransparency = searchState === "dimmed" ? 0.4 : 0;
		bgColor = Color3.fromHex("#262a33");
		labelColor = Color3.fromHex("#32dc78");
	} else if (isHovered) {
		if (searchState === "match") {
			strokeColor = Color3.fromHex("#7dd3fc");
			bgColor = Color3.fromHex("#223250");
		} else if (searchState === "dimmed") {
			strokeColor = Color3.fromHex("#323544");
			strokeTransparency = 0.3;
			bgColor = Color3.fromHex("#1e202a");
			bgTransparency = 0.3;
			contentTransparency = 0.4;
		} else {
			strokeColor = Color3.fromHex("#454959");
			strokeThickness = 1.2;
			bgColor = Color3.fromHex("#292b34");
		}
	}

	return (
		<textbutton
			key={`slot_${slotType}_${index}`}
			Size={new UDim2(0, 56, 0, 56)}
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
			<uicorner CornerRadius={new UDim(0, 8)} />
			<uistroke
				Color={strokeColor}
				Thickness={strokeThickness}
				Transparency={strokeTransparency}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>

			{/* Slot number badge (1-5 for Pickup, 6-25 for Storage) */}
			<textlabel
				key="SlotNum"
				Size={new UDim2(0, 20, 0, 14)}
				Position={new UDim2(0, 5, 0, 4)}
				BackgroundTransparency={1}
				Text={tostring(displayNumber)}
				TextColor3={labelColor}
				TextTransparency={contentTransparency > 0 ? 0.5 : 0}
				Font={Fonts.Bold}
				TextSize={10}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>

			{/* Tool Icon */}
			{info?.tool?.TextureId && info.tool.TextureId !== "" ? (
				<imagelabel
					key="Icon"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.45, 0)}
					Size={new UDim2(0, 28, 0, 28)}
					BackgroundTransparency={1}
					Image={info.tool.TextureId}
					ImageTransparency={contentTransparency}
				/>
			) : undefined}

			{/* Tool Name */}
			{info?.tool ? (
				<textlabel
					key="Name"
					AnchorPoint={new Vector2(0.5, 1)}
					Position={new UDim2(0.5, 0, 1, -4)}
					Size={new UDim2(1, -6, 0, 12)}
					BackgroundTransparency={1}
					Text={info.tool.Name}
					TextColor3={isSelected ? Color3.fromHex("#ffffff") : nameColor}
					TextTransparency={contentTransparency}
					Font={Fonts.Medium}
					TextSize={8}
					TextTruncate={Enum.TextTruncate.AtEnd}
				/>
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
			Size={new UDim2(0, 360, 0, 470)}
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
	const [shouldRender, setShouldRender] = useState(visible);
	const [searchQuery, setSearchQuery] = useState(initialSearchQuery ?? "");
	const centerWrapperRef = useRef<Frame>();
	const backdropRef = useRef<TextButton>();
	const isMountedRef = useRef(false);

	useEffect(() => {
		setSearchQuery(initialSearchQuery ?? "");
	}, [initialSearchQuery]);

	useEffect(() => {
		const updateScale = () => {
			const camera = Workspace.CurrentCamera;
			const vp = camera ? camera.ViewportSize : new Vector2(1280, 720);
			const scaleY = (vp.Y * 0.9) / 500;
			const scaleX = (vp.X * 0.9) / 750;
			setScale(math.clamp(math.min(scaleY, scaleX), 0.45, 1.05));
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

	useEffect(() => {
		if (visible) {
			setShouldRender(true);
		}
	}, [visible]);

	useEffect(() => {
		if (!shouldRender) return;

		const center = centerWrapperRef.current;
		const backdrop = backdropRef.current;
		if (!center || !backdrop) return;

		if (visible) {
			// Animasi slide-in dari sisi bawah layar (seperti smartphone: 0.38s Quart Out)
			center.Position = new UDim2(0.5, 0, 1.5, 0);
			backdrop.BackgroundTransparency = 1;

			const openCenterTween = TweenService.Create(
				center,
				new TweenInfo(0.38, Enum.EasingStyle.Quart, Enum.EasingDirection.Out),
				{ Position: new UDim2(0.5, 0, 0.5, 0) },
			);
			const openBackdropTween = TweenService.Create(
				backdrop,
				new TweenInfo(0.38, Enum.EasingStyle.Quart, Enum.EasingDirection.Out),
				{ BackgroundTransparency: 0.55 },
			);

			openCenterTween.Play();
			openBackdropTween.Play();

			return () => {
				openCenterTween.Cancel();
				openBackdropTween.Cancel();
			};
		} else {
			// Animasi slide-out ke sisi bawah layar (seperti smartphone: 0.28s Quad In)
			if (!isMountedRef.current) {
				center.Position = new UDim2(0.5, 0, 1.5, 0);
				backdrop.BackgroundTransparency = 1;
				setShouldRender(false);
				return;
			}

			const closeCenterTween = TweenService.Create(
				center,
				new TweenInfo(0.28, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{ Position: new UDim2(0.5, 0, 1.5, 0) },
			);
			const closeBackdropTween = TweenService.Create(
				backdrop,
				new TweenInfo(0.28, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{ BackgroundTransparency: 1.0 },
			);

			const conn = closeCenterTween.Completed.Connect((status) => {
				conn.Disconnect();
				if (status === Enum.PlaybackState.Completed) {
					setShouldRender(false);
					onAnimationFinished?.();
				}
			});

			closeCenterTween.Play();
			closeBackdropTween.Play();

			return () => {
				conn.Disconnect();
				closeCenterTween.Cancel();
				closeBackdropTween.Cancel();
			};
		}
	}, [visible, shouldRender]);

	useEffect(() => {
		isMountedRef.current = true;
	}, []);

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

	// Build storage slot elements (1 to 20, displayed as 6 to 25)
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
				displayNumber={i + 5}
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
				ref={backdropRef}
				key="Backdrop"
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundColor3={Color3.fromHex("#000000")}
				BackgroundTransparency={1}
				Text=""
				AutoButtonColor={false}
				ZIndex={1}
				Event={{
					MouseButton1Click: () => {
						// Pastikan klik benar-benar berada di LUAR area Inventory/Backpack
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
								return; // Klik di dalam area Backpack, jangan tutup!
							}
						}
						onClose();
					},
				}}
			/>

			{/* Center Split Wrapper: Left = Character Viewport, Right = Inventory Storage */}
			<frame
				ref={centerWrapperRef}
				key="CenterWrapper"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 1.5, 0)}
				Size={new UDim2(0, 736, 0, 470)}
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

				{/* Left: 3D Character Viewport */}
				<CharacterPreview />

				{/* Right: Sleek Dark Inventory & Storage Card */}
				<frame
					key="InventoryPanel"
					Size={new UDim2(0, 360, 0, 470)}
					BackgroundColor3={Color3.fromHex("#131418")}
					ZIndex={3}
				>
					<uicorner CornerRadius={new UDim(0, 16)} />
					<uistroke
						Color={Color3.fromHex("#262833")}
						Thickness={1.2}
						Transparency={0.2}
						ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
					/>
					<uipadding
						PaddingTop={new UDim(0, 18)}
						PaddingBottom={new UDim(0, 18)}
						PaddingLeft={new UDim(0, 24)}
						PaddingRight={new UDim(0, 24)}
					/>

					{/* Top Action Row: Search & Close */}
					<frame
						key="TopRow"
						Size={new UDim2(1, 0, 0, 28)}
						BackgroundTransparency={1}
						ZIndex={4}
					>
						{/* Search Bar */}
						<frame
							key="SearchBar"
							AnchorPoint={new Vector2(1, 0.5)}
							Position={new UDim2(1, -34, 0.5, 0)}
							Size={new UDim2(0, 140, 0, 28)}
							BackgroundColor3={Color3.fromHex("#1e2026")}
							ZIndex={5}
						>
							<uicorner CornerRadius={new UDim(0, 6)} />
							<uistroke Color={Color3.fromHex("#2e313d")} Thickness={1} />
							<LucideIcon
								name="search"
								size={new UDim2(0, 12, 0, 12)}
								position={new UDim2(0, 8, 0.5, -6)}
								color={Color3.fromHex("#6c7082")}
								zIndex={6}
							/>
							<textbox
								key="SearchInput"
								Position={new UDim2(0, 24, 0, 0)}
								Size={new UDim2(1, -30, 1, 0)}
								BackgroundTransparency={1}
								PlaceholderText="Search..."
								PlaceholderColor3={Color3.fromHex("#6c7082")}
								Text={searchQuery}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Regular}
								TextSize={11}
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
							Size={new UDim2(0, 26, 0, 26)}
							BackgroundColor3={Color3.fromHex("#1e2026")}
							Text=""
							AutoButtonColor={false}
							ZIndex={5}
							Event={{
								MouseButton1Click: onClose,
							}}
						>
							<uicorner CornerRadius={new UDim(0, 6)} />
							<uistroke Color={Color3.fromHex("#2e313d")} Thickness={1} />
							<LucideIcon
								name="x"
								size={new UDim2(0, 12, 0, 12)}
								anchorPoint={new Vector2(0.5, 0.5)}
								position={new UDim2(0.5, 0, 0.5, 0)}
								color={Color3.fromHex("#aaaaaa")}
								zIndex={6}
							/>
						</textbutton>
					</frame>

					{/* Section 1: Pickup (1 to 5) */}
					<frame
						key="PickupSection"
						Position={new UDim2(0, 0, 0, 36)}
						Size={new UDim2(1, 0, 0, 80)}
						BackgroundTransparency={1}
						ZIndex={4}
					>
						<textlabel
							key="PickupTitle"
							Size={new UDim2(1, 0, 0, 18)}
							BackgroundTransparency={1}
							Text="Hotbar"
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={13}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={5}
						/>

						{/* 5 Slots Row */}
						<frame
							key="PickupGrid"
							Position={new UDim2(0, 0, 0, 22)}
							Size={new UDim2(1, 0, 0, 56)}
							BackgroundTransparency={1}
							ZIndex={5}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								Padding={new UDim(0, 8)}
							/>
							{pickupElements}
						</frame>
					</frame>

					{/* Section 2: Storage (6 to 25) */}
					<frame
						key="StorageSection"
						Position={new UDim2(0, 0, 0, 126)}
						Size={new UDim2(1, 0, 0, 280)}
						BackgroundTransparency={1}
						ZIndex={4}
					>
						<textlabel
							key="StorageTitle"
							Size={new UDim2(1, 0, 0, 18)}
							BackgroundTransparency={1}
							Text="Inventory"
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={13}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={5}
						/>

						{/* 5 Columns x 4 Rows Grid (20 slots) */}
						<frame
							key="StorageGrid"
							Position={new UDim2(0, 0, 0, 22)}
							Size={new UDim2(1, 0, 0, 248)}
							BackgroundTransparency={1}
							ZIndex={5}
						>
							<uigridlayout
								CellSize={new UDim2(0, 56, 0, 56)}
								CellPadding={new UDim2(0, 8, 0, 8)}
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
	public static readonly STORAGE_SLOT_COUNT = 20;

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
	private fovTween?: Tween;

	constructor(parentContainer?: Instance) {
		const isGuiObject = parentContainer && parentContainer.IsA("GuiObject");
		this.isGuiObject = isGuiObject === true;

		if (isGuiObject) {
			this.hostInstance = parentContainer;
		} else {
			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "BackpackSystemGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 30;
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
		if (visible) {
			if (!blur) {
				blur = new Instance("BlurEffect");
				blur.Name = "BackpackBlur";
				blur.Size = 0;
				blur.Parent = Lighting;
			}
			blur.Enabled = true;
			TweenService.Create(blur, new TweenInfo(0.38, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
				Size: 20,
			}).Play();
		} else if (blur) {
			const tween = TweenService.Create(blur, new TweenInfo(0.28, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
				Size: 0,
			});
			tween.Play();
			const conn = tween.Completed.Connect(() => {
				conn.Disconnect();
				if (!this._isVisible && blur && blur.Parent) {
					blur.Enabled = false;
				}
			});
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

		this.fovTween?.Cancel();

		if (zoomIn) {
			this.originalFOV = camera.FieldOfView > 0 ? camera.FieldOfView : 70;
			const targetFOV = math.max(this.originalFOV - 35, 45); // Zoom-in halus identik dengan smartphone & emote modal
			this.fovTween = TweenService.Create(
				camera,
				new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ FieldOfView: targetFOV },
			);
		} else {
			this.fovTween = TweenService.Create(
				camera,
				new TweenInfo(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ FieldOfView: this.originalFOV },
			);
		}

		this.fovTween.Play();
	}

	public setVisible(visible: boolean, onFinished?: () => void): void {
		this._isVisible = visible;
		if (visible) {
			if (this.screenGui) {
				this.screenGui.Enabled = true;
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
		this.fovTween?.Cancel();
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
