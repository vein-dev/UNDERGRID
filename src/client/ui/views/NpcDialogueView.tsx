import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, TweenService, Workspace } from "@rbxts/services";
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

export function NpcDialogueComponent({
	visible,
	dialogueTree,
	currentNodeId,
	onSelectOption,
	onClose,
}: NpcDialogueProps) {
	const [hoveredOptionId, setHoveredOptionId] = useState<string | undefined>();
	const [scale, setScale] = useState(1);

	// Responsivitas skala layar
	useEffect(() => {
		const updateScale = () => {
			const cam = Workspace.CurrentCamera;
			const vp = cam ? cam.ViewportSize : new Vector2(1280, 720);
			const s = math.clamp(vp.Y / 800, 0.8, 1.05);
			setScale(s);
		};

		updateScale();
		const cam = Workspace.CurrentCamera;
		const vpConn = cam?.GetPropertyChangedSignal("ViewportSize").Connect(updateScale);
		return () => vpConn?.Disconnect();
	}, []);

	if (!visible || !dialogueTree || !currentNodeId) {
		return <></>;
	}

	const currentNode = dialogueTree.nodes[currentNodeId];
	if (!currentNode) {
		return <></>;
	}

	return (
		<frame
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			ZIndex={95}
		>
			<uiscale Scale={scale} />

			{/* Main Dialogue Card */}
			<frame
				AnchorPoint={new Vector2(0.5, 1)}
				Position={new UDim2(0.5, 0, 1, -28)}
				Size={new UDim2(0, 560, 0, 190)}
				BackgroundColor3={MonochromeTheme.Background.DeepCharcoal}
				BackgroundTransparency={0.08}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke
					Color={MonochromeTheme.Border.Subtle}
					Thickness={1.2}
					Transparency={0.2}
				/>
				<uipadding
					PaddingTop={new UDim(0, 16)}
					PaddingBottom={new UDim(0, 16)}
					PaddingLeft={new UDim(0, 20)}
					PaddingRight={new UDim(0, 20)}
				/>
				<uisizeconstraint
					MinSize={new Vector2(320, 160)}
					MaxSize={new Vector2(640, 220)}
				/>

				{/* Header: Speaker Badge + Close Button */}
				<frame
					Size={new UDim2(1, 0, 0, 26)}
					BackgroundTransparency={1}
				>
					{/* Speaker Pill Badge */}
					<frame
						Size={new UDim2(0, 130, 1, 0)}
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
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							HorizontalAlignment={Enum.HorizontalAlignment.Left}
							Padding={new UDim(0, 6)}
						/>
						<uipadding
							PaddingLeft={new UDim(0, 8)}
							PaddingRight={new UDim(0, 8)}
						/>

						<LucideIcon
							name="message-square"
							size={new UDim2(0, 14, 0, 14)}
							color={MonochromeTheme.Text.Primary}
						/>
						<textlabel
							Size={new UDim2(1, -20, 1, 0)}
							BackgroundTransparency={1}
							Font={Fonts.Bold}
							Text={currentNode.speakerName}
							TextColor3={MonochromeTheme.Text.Primary}
							TextSize={13}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
					</frame>

					{/* Close Button */}
					<textbutton
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, 0, 0.5, 0)}
						Size={new UDim2(0, 26, 0, 26)}
						BackgroundColor3={MonochromeTheme.Background.Surface}
						BackgroundTransparency={0.3}
						Text=""
						BorderSizePixel={0}
						Event={{
							Activated: () => onClose?.(),
						}}
					>
						<uicorner CornerRadius={new UDim(0, 13)} />
						<uistroke
							Color={MonochromeTheme.Border.Subtle}
							Thickness={1}
						/>
						<LucideIcon
							name="x"
							size={new UDim2(0, 14, 0, 14)}
							color={MonochromeTheme.Text.Secondary}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
						/>
					</textbutton>
				</frame>

				{/* Dialogue Message */}
				<textlabel
					Position={new UDim2(0, 0, 0, 36)}
					Size={new UDim2(1, 0, 0, 56)}
					BackgroundTransparency={1}
					Font={Fonts.Regular}
					Text={currentNode.message}
					TextColor3={MonochromeTheme.Text.Primary}
					TextSize={14}
					TextWrapped={true}
					TextXAlignment={Enum.TextXAlignment.Left}
					TextYAlignment={Enum.TextYAlignment.Top}
					LineHeight={1.25}
				/>

				{/* Options List */}
				<frame
					AnchorPoint={new Vector2(0, 1)}
					Position={new UDim2(0, 0, 1, 0)}
					Size={new UDim2(1, 0, 0, 56)}
					BackgroundTransparency={1}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						HorizontalAlignment={Enum.HorizontalAlignment.Right}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 10)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{currentNode.options.map((option, index) => {
						const isHovered = hoveredOptionId === option.id;
						const isPrimary = option.action === "claim_skateboard" || index === 0;

						return (
							<textbutton
								key={option.id}
								LayoutOrder={index}
								Size={new UDim2(0, 0, 0, 38)}
								AutomaticSize={Enum.AutomaticSize.X}
								BackgroundColor3={
									isHovered
										? MonochromeTheme.Background.CardHover
										: isPrimary
											? MonochromeTheme.Background.Surface
											: MonochromeTheme.Background.Card
								}
								BackgroundTransparency={0.1}
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
								<uicorner CornerRadius={new UDim(0, 8)} />
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
								<uipadding
									PaddingLeft={new UDim(0, 14)}
									PaddingRight={new UDim(0, 14)}
									PaddingTop={new UDim(0, 8)}
									PaddingBottom={new UDim(0, 8)}
								/>
								<uilistlayout
									FillDirection={Enum.FillDirection.Horizontal}
									VerticalAlignment={Enum.VerticalAlignment.Center}
									Padding={new UDim(0, 8)}
								/>

								<textlabel
									AutomaticSize={Enum.AutomaticSize.XY}
									BackgroundTransparency={1}
									Font={Fonts.Medium}
									Text={option.label}
									TextColor3={
										isHovered
											? MonochromeTheme.Text.Primary
											: MonochromeTheme.Text.Secondary
									}
									TextSize={13}
								/>

								<LucideIcon
									name={option.action === "claim_skateboard" ? "check" : "arrow-right"}
									size={new UDim2(0, 14, 0, 14)}
									color={
										isHovered
											? MonochromeTheme.Text.Primary
											: MonochromeTheme.Text.Muted
									}
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
