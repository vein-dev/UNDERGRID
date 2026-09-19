import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { MovementController } from "client/controllers/MovementController";
import { LucideIcon } from "../components/LucideIcon";
import { Fonts } from "../Typography";

export interface SettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
	onAnimationFinished?: () => void;
}

interface ToggleRowProps {
	title: string;
	description: string;
	iconName: string;
	isOn: boolean;
	onToggle: (newState: boolean) => void;
}

function ToggleRow({ title, description, iconName, isOn, onToggle }: ToggleRowProps) {
	const [isHovered, setIsHovered] = useState(false);

	return (
		<textbutton
			Size={new UDim2(1, 0, 0, 68)}
			BackgroundColor3={isHovered ? Color3.fromHex("#1c1c20") : Color3.fromHex("#161618")}
			BackgroundTransparency={0.1}
			AutoButtonColor={false}
			Active={true}
			Text=""
			ZIndex={3}
			Event={{
				MouseEnter: () => setIsHovered(true),
				MouseLeave: () => setIsHovered(false),
				Activated: () => onToggle(!isOn),
			}}
		>
			<uicorner CornerRadius={new UDim(0, 12)} />
			<uistroke Color={isHovered ? Color3.fromHex("#3a3a40") : Color3.fromHex("#26262a")} Thickness={1} />
			<uipadding
				PaddingLeft={new UDim(0, 14)}
				PaddingRight={new UDim(0, 14)}
				PaddingTop={new UDim(0, 12)}
				PaddingBottom={new UDim(0, 12)}
			/>

			{/* Icon container */}
			<frame
				Position={new UDim2(0, 0, 0.5, -18)}
				Size={new UDim2(0, 36, 0, 36)}
				BackgroundColor3={isOn ? Color3.fromHex("#1c2e22") : Color3.fromHex("#222226")}
				ZIndex={4}
			>
				<uicorner CornerRadius={new UDim(0, 10)} />
				<LucideIcon
					name={iconName}
					size={new UDim2(0, 18, 0, 18)}
					anchorPoint={new Vector2(0.5, 0.5)}
					position={new UDim2(0.5, 0, 0.5, 0)}
					color={isOn ? Color3.fromHex("#34c759") : Color3.fromHex("#888888")}
					zIndex={5}
				/>
			</frame>

			{/* Texts */}
			<frame
				Position={new UDim2(0, 48, 0, 0)}
				Size={new UDim2(1, -108, 1, 0)}
				BackgroundTransparency={1}
				ZIndex={4}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 2)}
				/>
				<textlabel
					Text={title}
					Font={Fonts.Bold}
					TextSize={13}
					TextColor3={Color3.fromHex("#ffffff")}
					TextXAlignment={Enum.TextXAlignment.Left}
					BackgroundTransparency={1}
					AutomaticSize={Enum.AutomaticSize.XY}
					ZIndex={5}
				/>
				<textlabel
					Text={description}
					Font={Fonts.Regular}
					TextSize={10}
					TextColor3={Color3.fromHex("#8e8e93")}
					TextXAlignment={Enum.TextXAlignment.Left}
					TextWrapped={true}
					BackgroundTransparency={1}
					Size={new UDim2(1, 0, 0, 24)}
					ZIndex={5}
				/>
			</frame>

			{/* iOS Switch Toggle Button */}
			<frame
				AnchorPoint={new Vector2(1, 0.5)}
				Position={new UDim2(1, 0, 0.5, 0)}
				Size={new UDim2(0, 48, 0, 28)}
				BackgroundColor3={isOn ? Color3.fromHex("#34c759") : Color3.fromHex("#2c2c2e")}
				ZIndex={4}
			>
				<uicorner CornerRadius={new UDim(1, 0)} />
				<uistroke Color={isOn ? Color3.fromHex("#30b351") : Color3.fromHex("#3a3a3c")} Thickness={1} />

				{/* Knob circle */}
				<frame
					AnchorPoint={new Vector2(0, 0.5)}
					Position={isOn ? new UDim2(1, -24, 0.5, 0) : new UDim2(0, 4, 0.5, 0)}
					Size={new UDim2(0, 20, 0, 20)}
					BackgroundColor3={Color3.fromHex("#ffffff")}
					ZIndex={5}
				>
					<uicorner CornerRadius={new UDim(1, 0)} />
				</frame>
			</frame>
		</textbutton>
	);
}

export function SettingsModalComponent({ isOpen, onClose, onAnimationFinished }: SettingsModalProps) {
	const movementController = MovementController.getInstance();
	const [leanActive, setLeanActive] = useState(movementController.isLeanActive());
	const [bobbingActive, setBobbingActive] = useState(movementController.isCameraBobbingActive());

	const [scale, setScale] = useState(1);
	const [shouldRender, setShouldRender] = useState(isOpen);

	const [isCloseHovered, setIsCloseHovered] = useState(false);

	const panelRef = useRef<Frame>();
	const backdropRef = useRef<TextButton>();
	const isMountedRef = useRef(false);

	useEffect(() => {
		const updateScale = () => {
			const camera = Workspace.CurrentCamera;
			const vp = camera ? camera.ViewportSize : new Vector2(1280, 720);
			const scaleY = (vp.Y * 0.82) / 440;
			const scaleX = (vp.X * 0.45) / 360;
			setScale(math.clamp(math.min(scaleY, scaleX), 0.5, 1.05));
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
		if (isOpen) {
			setShouldRender(true);
			setLeanActive(movementController.isLeanActive());
			setBobbingActive(movementController.isCameraBobbingActive());
		}
	}, [isOpen, movementController]);

	useEffect(() => {
		if (!shouldRender) return;

		const panel = panelRef.current;
		const backdrop = backdropRef.current;
		if (!panel || !backdrop) return;

		const TOP_OFFSCREEN = new UDim2(0.5, 0, 0, -420);
		const CENTER_ONSCREEN = new UDim2(0.5, 0, 0.5, 0);

		if (isOpen) {
			// Slide-in dari atas layar (0.38s Quart Out, identik dengan EmoteModal)
			panel.Position = TOP_OFFSCREEN;
			backdrop.BackgroundTransparency = 1;

			const openPanelTween = TweenService.Create(
				panel,
				new TweenInfo(0.38, Enum.EasingStyle.Quart, Enum.EasingDirection.Out),
				{
					Position: CENTER_ONSCREEN,
					BackgroundTransparency: 0.1,
				},
			);
			const openBackdropTween = TweenService.Create(
				backdrop,
				new TweenInfo(0.38, Enum.EasingStyle.Quart, Enum.EasingDirection.Out),
				{
					BackgroundTransparency: 0.55,
				},
			);

			openPanelTween.Play();
			openBackdropTween.Play();

			return () => {
				openPanelTween.Cancel();
				openBackdropTween.Cancel();
			};
		} else {
			// Slide-out kembali ke atas layar (0.28s Quad In, identik dengan EmoteModal)
			if (!isMountedRef.current) {
				panel.Position = TOP_OFFSCREEN;
				backdrop.BackgroundTransparency = 1;
				setShouldRender(false);
				return;
			}

			const closePanelTween = TweenService.Create(
				panel,
				new TweenInfo(0.28, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{
					Position: TOP_OFFSCREEN,
				},
			);
			const closeBackdropTween = TweenService.Create(
				backdrop,
				new TweenInfo(0.28, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{
					BackgroundTransparency: 1,
				},
			);

			const conn = closePanelTween.Completed.Connect((status) => {
				conn.Disconnect();
				if (status === Enum.PlaybackState.Completed) {
					setShouldRender(false);
					onAnimationFinished?.();
				}
			});

			closePanelTween.Play();
			closeBackdropTween.Play();

			return () => {
				conn.Disconnect();
				closePanelTween.Cancel();
				closeBackdropTween.Cancel();
			};
		}
	}, [isOpen, shouldRender]);

	useEffect(() => {
		isMountedRef.current = true;
	}, []);

	if (!shouldRender) {
		return <></>;
	}

	return (
		<frame Size={new UDim2(1, 0, 1, 0)} BackgroundTransparency={1} ZIndex={100}>
			{/* Backdrop click to close */}
			<textbutton
				ref={backdropRef}
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundColor3={Color3.fromHex("#000000")}
				BackgroundTransparency={0.55}
				Text=""
				AutoButtonColor={false}
				Active={true}
				ZIndex={1}
				Event={{
					Activated: () => {
						// Pastikan klik benar-benar berada di LUAR area Settings Modal Card
						const panel = panelRef.current;
						if (panel) {
							const mousePos = UserInputService.GetMouseLocation();
							const pos = panel.AbsolutePosition;
							const size = panel.AbsoluteSize;
							if (
								mousePos.X >= pos.X &&
								mousePos.X <= pos.X + size.X &&
								mousePos.Y >= pos.Y &&
								mousePos.Y <= pos.Y + size.Y
							) {
								return; // Klik di dalam area modal pengaturan, jangan tutup!
							}
						}
						onClose();
					},
				}}
			/>

			{/* Main Settings Modal Card */}
			<frame
				ref={panelRef}
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0, -420)}
				Size={new UDim2(0, 360, 0, 390)}
				BackgroundColor3={Color3.fromHex("#0e0e10")}
				BackgroundTransparency={0.1}
				Active={true}
				ZIndex={10}
			>
				<uiscale Scale={scale} />
				<uicorner CornerRadius={new UDim(0, 20)} />
				<uistroke Color={Color3.fromHex("#2e2e32")} Thickness={1.5} />

				{/* Header */}
				<frame
					Size={new UDim2(1, 0, 0, 60)}
					BackgroundColor3={Color3.fromHex("#141418")}
					BackgroundTransparency={0.2}
					ZIndex={11}
				>
					<uicorner CornerRadius={new UDim(0, 20)} />
					<uistroke Color={Color3.fromHex("#26262a")} Thickness={1} />
					<uipadding PaddingLeft={new UDim(0, 18)} PaddingRight={new UDim(0, 14)} />

					{/* Title and Icon */}
					<frame
						Position={new UDim2(0, 0, 0.5, -16)}
						Size={new UDim2(0, 32, 0, 32)}
						BackgroundColor3={Color3.fromHex("#222228")}
						ZIndex={12}
					>
						<uicorner CornerRadius={new UDim(0, 8)} />
						<LucideIcon
							name="settings"
							size={new UDim2(0, 16, 0, 16)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#ffffff")}
							zIndex={13}
						/>
					</frame>

					<frame
						Position={new UDim2(0, 42, 0.5, -16)}
						Size={new UDim2(1, -88, 0, 32)}
						BackgroundTransparency={1}
						ZIndex={12}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Vertical}
							VerticalAlignment={Enum.VerticalAlignment.Center}
						/>
						<textlabel
							Text="Settings"
							Font={Fonts.Bold}
							TextSize={15}
							TextColor3={Color3.fromHex("#ffffff")}
							TextXAlignment={Enum.TextXAlignment.Left}
							BackgroundTransparency={1}
							AutomaticSize={Enum.AutomaticSize.XY}
							ZIndex={13}
						/>
						<textlabel
							Text="Atur kenyamanan pergerakan & kamera"
							Font={Fonts.Regular}
							TextSize={10}
							TextColor3={Color3.fromHex("#8e8e93")}
							TextXAlignment={Enum.TextXAlignment.Left}
							BackgroundTransparency={1}
							AutomaticSize={Enum.AutomaticSize.XY}
							ZIndex={13}
						/>
					</frame>

					{/* Close Button */}
					<textbutton
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, 0, 0.5, 0)}
						Size={new UDim2(0, 32, 0, 32)}
						BackgroundColor3={isCloseHovered ? Color3.fromHex("#32323a") : Color3.fromHex("#222226")}
						AutoButtonColor={false}
						Active={true}
						Text=""
						ZIndex={12}
						Event={{
							MouseEnter: () => setIsCloseHovered(true),
							MouseLeave: () => setIsCloseHovered(false),
							Activated: onClose,
						}}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<LucideIcon
							name="x"
							size={new UDim2(0, 16, 0, 16)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={isCloseHovered ? Color3.fromHex("#ffffff") : Color3.fromHex("#b0b0b5")}
							zIndex={13}
						/>
					</textbutton>
				</frame>

				{/* Settings Content List */}
				<scrollingframe
					Position={new UDim2(0, 0, 0, 68)}
					Size={new UDim2(1, 0, 1, -76)}
					BackgroundTransparency={1}
					ScrollBarThickness={3}
					ScrollBarImageColor3={Color3.fromHex("#444444")}
					CanvasSize={new UDim2(0, 0, 0, 0)}
					AutomaticCanvasSize={Enum.AutomaticSize.Y}
					ZIndex={11}
				>
					<uipadding
						PaddingLeft={new UDim(0, 16)}
						PaddingRight={new UDim(0, 16)}
						PaddingTop={new UDim(0, 6)}
						PaddingBottom={new UDim(0, 16)}
					/>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						Padding={new UDim(0, 10)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{/* Section Header: Camera & Motion */}
					<textlabel
						LayoutOrder={1}
						Text="KAMERA & GERAKAN"
						Font={Fonts.Bold}
						TextSize={11}
						TextColor3={Color3.fromHex("#8e8e93")}
						TextXAlignment={Enum.TextXAlignment.Left}
						BackgroundTransparency={1}
						Size={new UDim2(1, 0, 0, 18)}
						ZIndex={12}
					/>

					{/* Row 1: Body Lean */}
					<frame LayoutOrder={2} Size={new UDim2(1, 0, 0, 68)} BackgroundTransparency={1} ZIndex={12}>
						<ToggleRow
							title="Body Lean"
							description="Kemiringan dinamis badan karakter saat lari dan berbelok."
							iconName="activity"
							isOn={leanActive}
							onToggle={(val) => {
								setLeanActive(val);
								movementController.setLeanEnabled(val);
							}}
						/>
					</frame>

					{/* Row 2: Camera Bobbing */}
					<frame LayoutOrder={3} Size={new UDim2(1, 0, 0, 68)} BackgroundTransparency={1} ZIndex={12}>
						<ToggleRow
							title="Camera Bobbing"
							description="Guncangan dinamis kamera saat melangkah (matikan bila pusing)."
							iconName="eye"
							isOn={bobbingActive}
							onToggle={(val) => {
								setBobbingActive(val);
								movementController.setCameraBobbingEnabled(val);
							}}
						/>
					</frame>

					{/* Information Footer */}
					<frame
						LayoutOrder={4}
						Size={new UDim2(1, 0, 0, 48)}
						BackgroundColor3={Color3.fromHex("#141418")}
						BackgroundTransparency={0.4}
						ZIndex={12}
					>
						<uicorner CornerRadius={new UDim(0, 10)} />
						<uipadding PaddingLeft={new UDim(0, 12)} PaddingRight={new UDim(0, 12)} />
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							Padding={new UDim(0, 8)}
						/>
						<LucideIcon
							name="info"
							size={new UDim2(0, 14, 0, 14)}
							color={Color3.fromHex("#8e8e93")}
							zIndex={13}
						/>
						<textlabel
							Text="Pengaturan ini tersimpan otomatis selama sesi bermain."
							Font={Fonts.Regular}
							TextSize={10}
							TextColor3={Color3.fromHex("#8e8e93")}
							TextXAlignment={Enum.TextXAlignment.Left}
							BackgroundTransparency={1}
							AutomaticSize={Enum.AutomaticSize.XY}
							ZIndex={13}
						/>
					</frame>
				</scrollingframe>
			</frame>
		</frame>
	);
}

/**
 * Class Adapter Pattern for SettingsModalView.
 * Allows TopbarController and other systems to seamlessly show/hide/toggle the modal.
 */
export class SettingsModalView {
	private static instance?: SettingsModalView;
	private root: Root;
	private screenGui?: ScreenGui;
	private _isOpen = false;
	private toggleCallbacks: ((isOpen: boolean) => void)[] = [];

	public constructor(targetContainer?: Instance) {
		let container: Instance;

		if (targetContainer) {
			container = targetContainer;
		} else {
			const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "GameSettingsGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 95;
			this.screenGui.IgnoreGuiInset = true;
			this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			this.screenGui.Enabled = false;
			this.screenGui.Parent = playerGui;
			container = this.screenGui;
		}

		this.root = ReactRoblox.createRoot(container);
		this.render();
	}

	public static getInstance(): SettingsModalView {
		if (!SettingsModalView.instance) {
			SettingsModalView.instance = new SettingsModalView();
		}
		return SettingsModalView.instance;
	}

	private render(): void {
		this.root.render(
			<SettingsModalComponent
				isOpen={this._isOpen}
				onClose={() => this.toggle(false)}
				onAnimationFinished={() => {
					if (!this._isOpen && this.screenGui) {
						this.screenGui.Enabled = false;
					}
				}}
			/>,
		);
	}

	public toggle(visible?: boolean): void {
		const target = visible !== undefined ? visible : !this._isOpen;
		if (this._isOpen === target) return;
		this._isOpen = target;
		if (target && this.screenGui) {
			this.screenGui.Enabled = true;
		}
		this.render();

		for (const cb of this.toggleCallbacks) {
			cb(this._isOpen);
		}
	}

	public show(): void {
		this.toggle(true);
	}

	public hide(): void {
		this.toggle(false);
	}

	public isVisible(): boolean {
		return this._isOpen;
	}

	public onToggle(callback: (isOpen: boolean) => void): () => void {
		this.toggleCallbacks.push(callback);
		return () => {
			this.toggleCallbacks = this.toggleCallbacks.filter((cb) => cb !== callback);
		};
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		if (SettingsModalView.instance === this) {
			SettingsModalView.instance = undefined;
		}
	}
}
