import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, TweenService, Workspace } from "@rbxts/services";
import { SEAT_CONFIG, SitPoseItem } from "shared/config";
import { Fonts } from "../Typography";

export interface SitPoseHudProps {
	visible: boolean;
	poses?: readonly SitPoseItem[];
	activePoseId?: string;
	onSelectPose?: (poseId: string) => void;
	onStandUp?: () => void;
}

export function SitPoseHudComponent({
	visible,
	poses = SEAT_CONFIG.POSES,
	activePoseId = SEAT_CONFIG.DEFAULT_POSE_ID,
	onSelectPose,
	onStandUp,
}: SitPoseHudProps) {
	const [shouldRender, setShouldRender] = useState(visible);
	const [hoveredPoseId, setHoveredPoseId] = useState<string | undefined>();
	const [isStandHovered, setIsStandHovered] = useState(false);

	const [scale, setScale] = useState(1);
	const [targetPos, setTargetPos] = useState(new UDim2(0, 24, 0.5, 0));
	const [offscreenPos, setOffscreenPos] = useState(new UDim2(0, -260, 0.5, 0));
	const [anchorPoint, setAnchorPoint] = useState(new Vector2(0, 0.5));

	const containerRef = useRef<Frame>();
	const isMountedRef = useRef(false);

	useEffect(() => {
		isMountedRef.current = true;
	}, []);

	// Responsive placement & scaling listener
	useEffect(() => {
		const updateLayout = () => {
			const cam = Workspace.CurrentCamera;
			const vp = cam ? cam.ViewportSize : new Vector2(1280, 720);
			const isPortrait = vp.X < vp.Y || vp.X < 640;

			if (isPortrait) {
				const s = math.clamp(vp.Y / 720, 0.75, 1.0);
				setScale(s);
				setAnchorPoint(new Vector2(0.5, 0.5));
				setTargetPos(new UDim2(0.5, 0, 0.5, 0));
				setOffscreenPos(new UDim2(0.5, 0, 1.4, 0));
			} else {
				const s = math.clamp(vp.Y / 720, 0.75, 1.0);
				setScale(s);
				setAnchorPoint(new Vector2(0, 0.5));
				setTargetPos(new UDim2(0, 24, 0.5, 0));
				setOffscreenPos(new UDim2(0, -260, 0.5, 0));
			}
		};

		updateLayout();
		const cam = Workspace.CurrentCamera;
		const vpConn = cam?.GetPropertyChangedSignal("ViewportSize").Connect(updateLayout);
		const camConn = Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(updateLayout);

		return () => {
			vpConn?.Disconnect();
			camConn.Disconnect();
		};
	}, []);

	// Trigger render mounting when visible becomes true
	useEffect(() => {
		if (visible) {
			setShouldRender(true);
		}
	}, [visible]);

	// Open / Close Tween animation
	useEffect(() => {
		if (!shouldRender) return;

		const container = containerRef.current;
		if (!container) return;

		if (visible) {
			container.Position = offscreenPos;
			container.BackgroundTransparency = 1;

			const tween = TweenService.Create(
				container,
				new TweenInfo(0.35, Enum.EasingStyle.Quart, Enum.EasingDirection.Out),
				{
					Position: targetPos,
					BackgroundTransparency: 0.15,
				},
			);
			tween.Play();
			return () => tween.Cancel();
		} else {
			if (!isMountedRef.current) {
				container.Position = offscreenPos;
				container.BackgroundTransparency = 1;
				setShouldRender(false);
				return;
			}

			const tween = TweenService.Create(
				container,
				new TweenInfo(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{
					Position: offscreenPos,
					BackgroundTransparency: 1,
				},
			);
			const conn = tween.Completed.Connect((status) => {
				conn.Disconnect();
				if (status === Enum.PlaybackState.Completed) {
					setShouldRender(false);
				}
			});
			tween.Play();
			return () => {
				conn.Disconnect();
				tween.Cancel();
			};
		}
	}, [visible, shouldRender, targetPos, offscreenPos]);

	if (!shouldRender) {
		return <></>;
	}

	return (
		<frame
			ref={containerRef}
			AnchorPoint={anchorPoint}
			Position={offscreenPos}
			Size={new UDim2(0, 190, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundColor3={Color3.fromHex("#0e0e14")}
			BackgroundTransparency={0.15}
			ZIndex={50}
		>
			<uiscale Scale={scale} />
			<uicorner CornerRadius={new UDim(0, 14)} />
			<uistroke Color={Color3.fromHex("#2e2e3a")} Thickness={1.2} />
			<uipadding
				PaddingLeft={new UDim(0, 12)}
				PaddingRight={new UDim(0, 12)}
				PaddingTop={new UDim(0, 12)}
				PaddingBottom={new UDim(0, 12)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Vertical}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				Padding={new UDim(0, 8)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>

			{/* Header */}
			<frame
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 22)}
				BackgroundTransparency={1}
				ZIndex={51}
			>
				<textlabel
					AnchorPoint={new Vector2(0, 0.5)}
					Position={new UDim2(0, 0, 0.5, 0)}
					Text="POSE DUDUK"
					Font={Fonts.Bold}
					TextSize={12}
					TextColor3={Color3.fromHex("#ffffff")}
					BackgroundTransparency={1}
					AutomaticSize={Enum.AutomaticSize.XY}
					ZIndex={52}
				/>
				<textlabel
					AnchorPoint={new Vector2(1, 0.5)}
					Position={new UDim2(1, 0, 0.5, 0)}
					Text={`${poses.size()} POSE`}
					Font={Fonts.Medium}
					TextSize={10}
					TextColor3={Color3.fromHex("#8e8e98")}
					BackgroundTransparency={1}
					AutomaticSize={Enum.AutomaticSize.XY}
					ZIndex={52}
				/>
			</frame>

			{/* Separator 1 */}
			<frame
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 1)}
				BackgroundColor3={Color3.fromHex("#262632")}
				BorderSizePixel={0}
				ZIndex={51}
			/>

			{/* Vertical Pose Buttons List */}
			<frame
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
				ZIndex={51}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					Padding={new UDim(0, 6)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{poses.map((pose: SitPoseItem, idx: number) => {
					const isActive = pose.id === activePoseId;
					const isHovered = pose.id === hoveredPoseId;

					return (
						<textbutton
							key={`pose_${pose.id}`}
							LayoutOrder={idx}
							Size={new UDim2(1, 0, 0, 36)}
							BackgroundColor3={
								isActive
									? Color3.fromHex("#ffffff")
									: isHovered
										? Color3.fromHex("#22222c")
										: Color3.fromHex("#16161e")
							}
							BackgroundTransparency={isActive ? 0 : 0.25}
							AutoButtonColor={false}
							Text=""
							ZIndex={52}
							Event={{
								MouseEnter: () => setHoveredPoseId(pose.id),
								MouseLeave: () => setHoveredPoseId(undefined),
								MouseButton1Click: () => onSelectPose?.(pose.id),
							}}
						>
							<uicorner CornerRadius={new UDim(0, 8)} />
							<uistroke
								Color={
									isActive
										? Color3.fromHex("#ffffff")
										: isHovered
											? Color3.fromHex("#444455")
											: Color3.fromHex("#2a2a36")
								}
								Thickness={isActive ? 1.5 : 1}
							/>
							<textlabel
								Size={new UDim2(1, 0, 1, 0)}
								Text={pose.name}
								Font={isActive ? Fonts.Bold : Fonts.Medium}
								TextSize={12}
								TextColor3={isActive ? Color3.fromHex("#000000") : Color3.fromHex("#d0d0d8")}
								TextXAlignment={Enum.TextXAlignment.Center}
								TextYAlignment={Enum.TextYAlignment.Center}
								BackgroundTransparency={1}
								ZIndex={53}
							/>
						</textbutton>
					);
				})}
			</frame>

			{/* Separator 2 */}
			<frame
				LayoutOrder={4}
				Size={new UDim2(1, 0, 0, 1)}
				BackgroundColor3={Color3.fromHex("#262632")}
				BorderSizePixel={0}
				ZIndex={51}
			/>

			{/* Stand Up Button */}
			<textbutton
				key="StandUpBtn"
				LayoutOrder={5}
				Size={new UDim2(1, 0, 0, 36)}
				BackgroundColor3={
					isStandHovered ? Color3.fromHex("#3a1a1d") : Color3.fromHex("#241315")
				}
				BackgroundTransparency={0.2}
				AutoButtonColor={false}
				Text=""
				ZIndex={52}
				Event={{
					MouseEnter: () => setIsStandHovered(true),
					MouseLeave: () => setIsStandHovered(false),
					MouseButton1Click: () => onStandUp?.(),
				}}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				<uistroke
					Color={isStandHovered ? Color3.fromHex("#ff5555") : Color3.fromHex("#772228")}
					Thickness={1}
				/>
				<textlabel
					Size={new UDim2(1, 0, 1, 0)}
					Text="BERDIRI"
					Font={Fonts.Bold}
					TextSize={12}
					TextColor3={Color3.fromHex("#ff453a")}
					TextXAlignment={Enum.TextXAlignment.Center}
					TextYAlignment={Enum.TextYAlignment.Center}
					BackgroundTransparency={1}
					ZIndex={53}
				/>
			</textbutton>
		</frame>
	);
}

/**
 * Class Adapter Pattern for SitPoseHudView.
 * Allows client controllers to cleanly show, hide, and manage sit pose UI state.
 */
export class SitPoseHudView {
	private static instance?: SitPoseHudView;
	private root: Root;
	private screenGui?: ScreenGui;
	private hostInstance: Instance;

	private _visible = false;
	private _poses: readonly SitPoseItem[] = SEAT_CONFIG.POSES;
	private _activePoseId: string = SEAT_CONFIG.DEFAULT_POSE_ID;
	private _onSelectPose?: (poseId: string) => void;
	private _onStandUp?: () => void;

	public constructor(targetContainer?: Instance) {
		if (targetContainer && targetContainer.IsA("GuiObject")) {
			this.hostInstance = targetContainer;
		} else {
			const player = Players.LocalPlayer;
			const playerGui = (player?.FindFirstChild("PlayerGui") ?? player?.WaitForChild("PlayerGui")) as PlayerGui;

			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "SitPoseHudGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 65;
			this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			this.screenGui.Parent = playerGui;
			this.hostInstance = this.screenGui;
		}

		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	public static getInstance(container?: Instance): SitPoseHudView {
		if (!SitPoseHudView.instance) {
			SitPoseHudView.instance = new SitPoseHudView(container);
		}
		return SitPoseHudView.instance;
	}

	public show(
		poses: readonly SitPoseItem[],
		activePoseId: string,
		onSelectPose: (poseId: string) => void,
		onStandUp: () => void,
	): void {
		this._visible = true;
		this._poses = poses;
		this._activePoseId = activePoseId;
		this._onSelectPose = onSelectPose;
		this._onStandUp = onStandUp;
		this.render();
	}

	public hide(): void {
		if (!this._visible) return;
		this._visible = false;
		this.render();
	}

	public setActivePoseId(poseId: string): void {
		this._activePoseId = poseId;
		this.render();
	}

	public isVisible(): boolean {
		return this._visible;
	}

	private render(): void {
		this.root.render(
			<SitPoseHudComponent
				visible={this._visible}
				poses={this._poses}
				activePoseId={this._activePoseId}
				onSelectPose={this._onSelectPose}
				onStandUp={this._onStandUp}
			/>,
		);
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		if (SitPoseHudView.instance === this) {
			SitPoseHudView.instance = undefined;
		}
	}
}
