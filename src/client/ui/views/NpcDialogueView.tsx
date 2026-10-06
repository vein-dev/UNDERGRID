import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, UserInputService, Workspace } from "@rbxts/services";
import { DialogueOption, NpcDialogueTree } from "shared/types";
import { LucideIcon } from "../components/LucideIcon";
import { MonochromeTheme } from "../Theme";
import { Fonts } from "../Typography";

export interface NpcDialogueProps {
	visible: boolean;
	dialogueTree?: NpcDialogueTree;
	currentNodeId?: string;
	onSelectOption?: (option: DialogueOption) => void;
	onClose?: () => void;
}

interface NpcAvatarPortraitProps {
	npcName: string;
	avatarImage?: string;
	size: number;
}

/**
 * Komponen potret avatar NPC:
 * Menampilkan gambar 2D jika avatarImage tersedia, atau secara dinamis
 * me-render tampilan 3D real-time kepala/aksesori NPC menggunakan ViewportFrame.
 */
function NpcAvatarPortrait({ npcName, avatarImage, size }: NpcAvatarPortraitProps) {
	const viewportRef = useRef<ViewportFrame>();

	useEffect(() => {
		const vp = viewportRef.current;
		if (!vp || avatarImage) return;

		vp.ClearAllChildren();

		const npcFolder = Workspace.FindFirstChild("NPC");
		const npcModel = npcFolder?.FindFirstChild(npcName) as Model | undefined;
		if (!npcModel) return;

		const camera = new Instance("Camera");
		camera.FieldOfView = 45;
		camera.Parent = vp;
		vp.CurrentCamera = camera;

		const worldModel = new Instance("WorldModel");
		worldModel.Parent = vp;

		const clone = npcModel.Clone();
		for (const desc of clone.GetDescendants()) {
			if (desc.IsA("BasePart")) {
				desc.Anchored = true;
			} else if (desc.IsA("ProximityPrompt") || desc.IsA("Script") || desc.IsA("LocalScript")) {
				desc.Destroy();
			}
		}
		clone.Parent = worldModel;

		const head = clone.FindFirstChild("Head") as BasePart | undefined;
		if (head) {
			const headPos = head.Position;
			const lookVec = head.CFrame.LookVector;
			const camPos = headPos.add(lookVec.mul(2.2)).add(new Vector3(0, 0.05, 0));
			camera.CFrame = CFrame.lookAt(camPos, headPos.add(new Vector3(0, -0.05, 0)));
			vp.LightDirection = camera.CFrame.LookVector;
		}

		return () => {
			vp.ClearAllChildren();
		};
	}, [npcName, avatarImage]);

	return (
		<frame
			LayoutOrder={1}
			Size={new UDim2(0, size, 0, size)}
			BackgroundColor3={MonochromeTheme.Background.Surface}
			BackgroundTransparency={0.2}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<uistroke
				Color={MonochromeTheme.Border.Medium}
				Thickness={1}
				Transparency={0.3}
			/>

			{avatarImage ? (
				<imagelabel
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundTransparency={1}
					Image={avatarImage}
					ScaleType={Enum.ScaleType.Fit}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
				</imagelabel>
			) : (
				<viewportframe
					ref={viewportRef}
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundTransparency={1}
					Ambient={Color3.fromRGB(255, 255, 255)}
					LightColor={Color3.fromRGB(255, 255, 255)}
					LightDirection={new Vector3(1, 0, 0)}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
				</viewportframe>
			)}
		</frame>
	);
}

export function NpcDialogueComponent({
	visible,
	dialogueTree,
	currentNodeId,
	onSelectOption,
	onClose,
}: NpcDialogueProps) {
	const [hoveredOptionId, setHoveredOptionId] = useState<string | undefined>();
	const [viewport, setViewport] = useState(() => {
		const cam = Workspace.CurrentCamera;
		return cam ? cam.ViewportSize : new Vector2(1280, 720);
	});
	const [isTouch, setIsTouch] = useState(() => UserInputService.TouchEnabled);

	// Sinkronisasi ukuran layar dan mode input (PC vs Mobile)
	useEffect(() => {
		const updateViewport = () => {
			const cam = Workspace.CurrentCamera;
			if (cam) {
				setViewport(cam.ViewportSize);
			}
			setIsTouch(UserInputService.TouchEnabled);
		};

		updateViewport();
		const cam = Workspace.CurrentCamera;
		const vpConn = cam?.GetPropertyChangedSignal("ViewportSize").Connect(updateViewport);
		const inputConn = UserInputService.LastInputTypeChanged.Connect(() => {
			setIsTouch(UserInputService.TouchEnabled);
		});

		return () => {
			vpConn?.Disconnect();
			inputConn.Disconnect();
		};
	}, []);

	if (!visible || !dialogueTree || !currentNodeId) {
		return <></>;
	}

	const currentNode = dialogueTree.nodes[currentNodeId];
	if (!currentNode) {
		return <></>;
	}

	// Deteksi mobile berdasarkan touch device atau tinggi/lebar viewport
	const isMobile = isTouch || viewport.Y < 520 || viewport.X < 850;

	// Posisi Y berada di atas Hotbar:
	// Hotbar di posisi UDim2(0.5, 0, 1, -16) dengan tinggi ~62px.
	const bottomOffset = isMobile ? -84 : -94;

	// Lebar responsif: Pada mobile pas di tengah antara joystick kiri dan tombol aksi kanan
	const cardWidth = isMobile
		? math.clamp(viewport.X - 160, 290, 450)
		: 520;

	// Ukuran avatar foto
	const avatarSize = isMobile ? 52 : 62;
	const contentGap = isMobile ? 10 : 14;

	return (
		<frame
			key="NpcDialogueOverlay"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			ZIndex={95}
		>
			{/* Main Dialogue Card */}
			<frame
				key="DialogueCard"
				AnchorPoint={new Vector2(0.5, 1)}
				Position={new UDim2(0.5, 0, 1, bottomOffset)}
				Size={new UDim2(0, cardWidth, 0, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundColor3={MonochromeTheme.Background.DeepCharcoal}
				BackgroundTransparency={0.08}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, isMobile ? 12 : 14)} />
				<uistroke
					Color={MonochromeTheme.Border.Subtle}
					Thickness={1.2}
					Transparency={0.2}
				/>
				<uipadding
					PaddingTop={new UDim(0, isMobile ? 10 : 14)}
					PaddingBottom={new UDim(0, isMobile ? 10 : 14)}
					PaddingLeft={new UDim(0, isMobile ? 14 : 18)}
					PaddingRight={new UDim(0, isMobile ? 14 : 18)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					SortOrder={Enum.SortOrder.LayoutOrder}
					Padding={new UDim(0, isMobile ? 8 : 10)}
				/>
				<uisizeconstraint
					MinSize={new Vector2(isMobile ? 260 : 360, 80)}
					MaxSize={new Vector2(isMobile ? 470 : 570, 600)}
				/>

				{/* 1. Header Row: Speaker Badge + Close Button */}
				<frame
					key="HeaderRow"
					LayoutOrder={1}
					Size={new UDim2(1, 0, 0, isMobile ? 22 : 26)}
					BackgroundTransparency={1}
				>
					{/* Speaker Pill Badge (Tanpa Icon Pesan) */}
					<frame
						Size={new UDim2(0, 0, 1, 0)}
						AutomaticSize={Enum.AutomaticSize.X}
						BackgroundColor3={MonochromeTheme.Background.Surface}
						BackgroundTransparency={0.2}
						BorderSizePixel={0}
					>
						<uicorner CornerRadius={new UDim(0, 6)} />
						<uistroke
							Color={MonochromeTheme.Border.Medium}
							Thickness={1}
							Transparency={0.3}
						/>
						<uipadding
							PaddingLeft={new UDim(0, 9)}
							PaddingRight={new UDim(0, 9)}
						/>

						<textlabel
							AutomaticSize={Enum.AutomaticSize.XY}
							Size={new UDim2(0, 0, 1, 0)}
							BackgroundTransparency={1}
							Font={Fonts.Bold}
							Text={currentNode.speakerName}
							TextColor3={MonochromeTheme.Text.Primary}
							TextSize={isMobile ? 11 : 13}
							TextXAlignment={Enum.TextXAlignment.Center}
							TextYAlignment={Enum.TextYAlignment.Center}
						/>
					</frame>

					{/* Close Button */}
					<textbutton
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, 0, 0.5, 0)}
						Size={new UDim2(0, isMobile ? 22 : 26, 0, isMobile ? 22 : 26)}
						BackgroundColor3={MonochromeTheme.Background.Surface}
						BackgroundTransparency={0.3}
						Text=""
						BorderSizePixel={0}
						Event={{
							Activated: () => onClose?.(),
						}}
					>
						<uicorner CornerRadius={new UDim(0, isMobile ? 11 : 13)} />
						<uistroke
							Color={MonochromeTheme.Border.Subtle}
							Thickness={1}
						/>
						<LucideIcon
							name="x"
							size={new UDim2(0, isMobile ? 12 : 14, 0, isMobile ? 12 : 14)}
							color={MonochromeTheme.Text.Secondary}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
						/>
					</textbutton>
				</frame>

				{/* 2. Middle Row: Foto Avatar | Dialog Message Text */}
				<frame
					key="ContentRow"
					LayoutOrder={2}
					Size={new UDim2(1, 0, 0, 0)}
					AutomaticSize={Enum.AutomaticSize.Y}
					BackgroundTransparency={1}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Left}
						Padding={new UDim(0, contentGap)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{/* Foto Avatar NPC */}
					<NpcAvatarPortrait
						npcName={dialogueTree.npcId}
						avatarImage={dialogueTree.avatarImage}
						size={avatarSize}
					/>

					{/* Dialogue Message Text */}
					<textlabel
						key="MessageText"
						LayoutOrder={2}
						Size={new UDim2(1, -(avatarSize + contentGap), 0, 0)}
						AutomaticSize={Enum.AutomaticSize.Y}
						BackgroundTransparency={1}
						Font={Fonts.Regular}
						Text={currentNode.message}
						TextColor3={MonochromeTheme.Text.Primary}
						TextSize={isMobile ? 12 : 14}
						TextWrapped={true}
						TextXAlignment={Enum.TextXAlignment.Left}
						TextYAlignment={Enum.TextYAlignment.Center}
						LineHeight={1.22}
					/>
				</frame>

				{/* 3. Bottom Row: Pilihan Jawaban (Susunan Vertikal Rapi, Pas di Dalam Card, Tanpa Icon Arrow) */}
				<frame
					key="OptionsContainer"
					LayoutOrder={3}
					Size={new UDim2(1, 0, 0, 0)}
					AutomaticSize={Enum.AutomaticSize.Y}
					BackgroundTransparency={1}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						VerticalAlignment={Enum.VerticalAlignment.Top}
						Padding={new UDim(0, isMobile ? 5 : 6)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{currentNode.options.map((option, index) => {
						const isHovered = hoveredOptionId === option.id;
						const isPrimary = option.action === "claim_skateboard" || index === 0;

						return (
							<textbutton
								key={option.id}
								LayoutOrder={index}
								Size={new UDim2(1, 0, 0, 0)}
								AutomaticSize={Enum.AutomaticSize.Y}
								BackgroundColor3={
									isHovered
										? MonochromeTheme.Background.CardHover
										: isPrimary
											? MonochromeTheme.Background.Surface
											: MonochromeTheme.Background.Card
								}
								BackgroundTransparency={0.15}
								Text=""
								BorderSizePixel={0}
								Event={{
									MouseEnter: () => setHoveredOptionId(option.id),
									MouseLeave: () => {
										if (hoveredOptionId === option.id) {
											setHoveredOptionId(undefined);
										}
									},
									Activated: () => onSelectOption?.(option),
								}}
							>
								<uicorner CornerRadius={new UDim(0, isMobile ? 7 : 8)} />
								<uistroke
									Color={
										isHovered
											? MonochromeTheme.Border.Strong
											: isPrimary
												? MonochromeTheme.Border.Medium
												: MonochromeTheme.Border.Subtle
									}
									Thickness={1}
								/>
								<uisizeconstraint MinSize={new Vector2(0, isMobile ? 30 : 34)} />
								<uipadding
									PaddingLeft={new UDim(0, isMobile ? 12 : 14)}
									PaddingRight={new UDim(0, isMobile ? 12 : 14)}
									PaddingTop={new UDim(0, isMobile ? 6 : 8)}
									PaddingBottom={new UDim(0, isMobile ? 6 : 8)}
								/>

								<textlabel
									Size={new UDim2(1, 0, 0, 0)}
									AutomaticSize={Enum.AutomaticSize.Y}
									BackgroundTransparency={1}
									Font={Fonts.Medium}
									Text={option.label}
									TextColor3={
										isHovered
											? MonochromeTheme.Text.Primary
											: MonochromeTheme.Text.Secondary
									}
									TextSize={isMobile ? 11 : 13}
									TextWrapped={true}
									TextXAlignment={Enum.TextXAlignment.Left}
									TextYAlignment={Enum.TextYAlignment.Center}
								/>
							</textbutton>
						);
					})}
				</frame>
			</frame>
		</frame>
	);
}

/**
 * Class Adapter Pattern untuk NpcDialogueView
 * Mematuhi AGENTS.md rule 8 (interaksi mulus antara Controller dan React Layer).
 */
export class NpcDialogueView {
	private static instance?: NpcDialogueView;

	private root: Root;
	private hostInstance: Instance;
	private screenGui?: ScreenGui;

	private _visible = false;
	private _dialogueTree?: NpcDialogueTree;
	private _currentNodeId?: string;

	private _onSelectOption?: (option: DialogueOption) => void;
	private _onClose?: () => void;

	public constructor(container?: Instance) {
		if (container) {
			this.hostInstance = container;
		} else {
			const player = Players.LocalPlayer;
			const playerGui =
				(player.FindFirstChild("PlayerGui") as PlayerGui | undefined) ??
				(player.WaitForChild("PlayerGui", 5) as PlayerGui);

			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "NpcDialogueGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 75;
			this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			this.screenGui.Parent = playerGui;
			this.hostInstance = this.screenGui;
		}

		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	public static getInstance(container?: Instance): NpcDialogueView {
		if (!NpcDialogueView.instance) {
			NpcDialogueView.instance = new NpcDialogueView(container);
		}
		return NpcDialogueView.instance;
	}

	public show(dialogueTree: NpcDialogueTree, startNodeId: string): void {
		this._visible = true;
		this._dialogueTree = dialogueTree;
		this._currentNodeId = startNodeId;
		this.render();
	}

	public setCurrentNode(nodeId: string): void {
		this._currentNodeId = nodeId;
		this.render();
	}

	public hide(): void {
		if (!this._visible) return;
		this._visible = false;
		this.render();
	}

	public isVisible(): boolean {
		return this._visible;
	}

	public setCallbacks(callbacks: {
		onSelectOption?: (option: DialogueOption) => void;
		onClose?: () => void;
	}): void {
		this._onSelectOption = callbacks.onSelectOption;
		this._onClose = callbacks.onClose;
		this.render();
	}

	private render(): void {
		this.root.render(
			<NpcDialogueComponent
				visible={this._visible}
				dialogueTree={this._dialogueTree}
				currentNodeId={this._currentNodeId}
				onSelectOption={this._onSelectOption}
				onClose={() => {
					this._onClose?.();
					this.hide();
				}}
			/>,
		);
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		if (NpcDialogueView.instance === this) {
			NpcDialogueView.instance = undefined;
		}
	}
}
