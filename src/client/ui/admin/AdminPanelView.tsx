import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, Workspace } from "@rbxts/services";
import { Fonts } from "client/ui/Typography";
import { AdminTab } from "shared/types";
import { LucideIcon } from "../components/LucideIcon";
import { AdminMusicTabComponent } from "./tabs/AdminMusicTab";
import { AdminPlayerTabComponent } from "./tabs/AdminPlayerTab";
import { AdminStageFxTabComponent } from "./tabs/AdminStageFxTab";

export interface AdminPanelProps {
	visible: boolean;
	onClose: () => void;
	activeTab: AdminTab;
	onSelectTab: (tab: AdminTab) => void;
}

export function AdminPanelComponent({
	visible,
	onClose,
	activeTab,
	onSelectTab,
}: AdminPanelProps) {
	const [scale, setScale] = useState(1);

	useEffect(() => {
		const updateScale = () => {
			const camera = Workspace.CurrentCamera;
			const vp = camera ? camera.ViewportSize : new Vector2(1280, 720);
			const scaleY = (vp.Y * 0.9) / 560;
			const scaleX = (vp.X * 0.9) / 480;
			setScale(math.clamp(math.min(scaleY, scaleX), 0.5, 1.0));
		};

		updateScale();
		const conn = Workspace.CurrentCamera?.GetPropertyChangedSignal("ViewportSize").Connect(updateScale);
		return () => {
			conn?.Disconnect();
		};
	}, []);

	if (!visible) return <></>;

	const tabs: Array<{ id: AdminTab; label: string }> = [
		{ id: AdminTab.MusicMaster, label: "Audio Hub" },
		{ id: AdminTab.StageFx, label: "Stage & FX" },
		{ id: AdminTab.PlayerManagement, label: "Players" },
	];

	return (
		<frame
			key="AdminPanelRoot"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			ZIndex={1}
		>
			{/* Dim Backdrop */}
			<textbutton
				key="DimOverlay"
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundColor3={Color3.fromHex("#000000")}
				BackgroundTransparency={0.45}
				Text=""
				AutoButtonColor={false}
				ZIndex={2}
				Event={{
					MouseButton1Click: onClose,
				}}
			/>

			{/* Modal Frame */}
			<frame
				key="AdminModalFrame"
				Active={true}
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				Size={new UDim2(0, 480, 0, 560)}
				BackgroundColor3={Color3.fromHex("#121212")}
				BackgroundTransparency={0.08}
				ZIndex={5}
			>
				<uiscale Scale={scale} />
				<uicorner CornerRadius={new UDim(0, 20)} />
				<uistroke
					Color={Color3.fromHex("#282828")}
					Transparency={0.4}
					Thickness={1.3}
				/>

				{/* Header */}
				<frame
					key="Header"
					Size={new UDim2(1, 0, 0, 52)}
					BackgroundTransparency={1}
					ZIndex={6}
				>
					<frame
						key="TitleContainer"
						Position={new UDim2(0, 18, 0.5, -12)}
						Size={new UDim2(0.7, 0, 0, 24)}
						BackgroundTransparency={1}
						ZIndex={7}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							Padding={new UDim(0, 8)}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>
						<LucideIcon
							name="shield"
							size={new UDim2(0, 18, 0, 18)}
							color={Color3.fromHex("#ffffff")}
							zIndex={7}
							layoutOrder={1}
						/>
						<textlabel
							key="Title"
							Size={new UDim2(1, -26, 1, 0)}
							BackgroundTransparency={1}
							Text="ADMIN CONTROLLER"
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={15}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={7}
							LayoutOrder={2}
						/>
					</frame>

					{/* Close Button */}
					<textbutton
						key="CloseButton"
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, -16, 0.5, 0)}
						Size={new UDim2(0, 32, 0, 32)}
						BackgroundColor3={Color3.fromHex("#202020")}
						Text=""
						AutoButtonColor={false}
						ZIndex={7}
						Event={{
							MouseButton1Click: onClose,
						}}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<LucideIcon
							name="x"
							size={new UDim2(0, 16, 0, 16)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#ffffff")}
							zIndex={8}
						/>
					</textbutton>

					<frame
						key="Divider"
						Size={new UDim2(1, 0, 0, 1)}
						Position={new UDim2(0, 0, 1, -1)}
						BackgroundColor3={Color3.fromHex("#242424")}
						BackgroundTransparency={0.5}
						ZIndex={6}
					/>
				</frame>

				{/* Tab Switcher Bar */}
				<frame
					key="TabBar"
					Position={new UDim2(0, 14, 0, 60)}
					Size={new UDim2(1, -28, 0, 36)}
					BackgroundColor3={Color3.fromHex("#161616")}
					ZIndex={6}
				>
					<uicorner CornerRadius={new UDim(0, 10)} />
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 4)}
					/>
					<uipadding
						PaddingTop={new UDim(0, 3)}
						PaddingBottom={new UDim(0, 3)}
						PaddingLeft={new UDim(0, 4)}
						PaddingRight={new UDim(0, 4)}
					/>

					{tabs.map((tab) => {
						const isSelected = activeTab === tab.id;
						return (
							<textbutton
								key={`TabBtn_${tab.id}`}
								Size={new UDim2(0.32, 0, 1, 0)}
								BackgroundColor3={Color3.fromHex(isSelected ? "#2c2c2c" : "#242424")}
								BackgroundTransparency={isSelected ? 0 : 1}
								Text={tab.label}
								TextColor3={Color3.fromHex(isSelected ? "#ffffff" : "#888888")}
								Font={Fonts.Bold}
								TextSize={12}
								AutoButtonColor={false}
								ZIndex={7}
								Event={{
									MouseButton1Click: () => onSelectTab(tab.id),
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
							</textbutton>
						);
					})}
				</frame>

				{/* Content Area */}
				<frame
					key="ContentArea"
					Position={new UDim2(0, 0, 0, 104)}
					Size={new UDim2(1, 0, 1, -104)}
					BackgroundTransparency={1}
					ZIndex={8}
				>
					<AdminMusicTabComponent visible={activeTab === AdminTab.MusicMaster} />
					<AdminStageFxTabComponent visible={activeTab === AdminTab.StageFx} />
					<AdminPlayerTabComponent visible={activeTab === AdminTab.PlayerManagement} />
				</frame>
			</frame>
		</frame>
	);
}

/**
 * Main Admin Panel Modal View.
 * Migrated to React TSX declarative renderer.
 */
export class AdminPanelView {
	private static instance?: AdminPanelView;

	private screenGui: ScreenGui;
	private root: Root;
	private isVisible = false;
	private activeTab: AdminTab = AdminTab.MusicMaster;
	private onToggleCallbacks: Array<(isOpen: boolean) => void> = [];

	constructor(parentContainer?: Instance) {
		const isGuiObject = parentContainer && parentContainer.IsA("GuiObject");

		this.screenGui = new Instance("ScreenGui");
		this.screenGui.Name = "AdminPanelGui";
		this.screenGui.ResetOnSpawn = false;
		this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		this.screenGui.DisplayOrder = 120;
		this.screenGui.ScreenInsets = Enum.ScreenInsets.None;
		this.screenGui.IgnoreGuiInset = true;
		this.screenGui.Enabled = false;

		const rootParent = isGuiObject ? parentContainer : this.screenGui;

		if (!isGuiObject) {
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
		}

		this.root = ReactRoblox.createRoot(rootParent);
		this.render();
	}

	public static getInstance(): AdminPanelView {
		if (!AdminPanelView.instance) {
			AdminPanelView.instance = new AdminPanelView();
		}
		return AdminPanelView.instance;
	}

	private render(): void {
		this.root.render(
			<AdminPanelComponent
				visible={this.isVisible}
				onClose={() => this.hide()}
				activeTab={this.activeTab}
				onSelectTab={(tab) => this.switchTab(tab)}
			/>,
		);
	}

	public switchTab(tab: AdminTab): void {
		this.activeTab = tab;
		this.render();
	}

	public show(): void {
		this.isVisible = true;
		this.screenGui.Enabled = true;
		this.render();
		for (const cb of this.onToggleCallbacks) cb(true);
	}

	public hide(): void {
		this.isVisible = false;
		this.screenGui.Enabled = false;
		this.render();
		for (const cb of this.onToggleCallbacks) cb(false);
	}

	public toggle(forceState?: boolean): void {
		const targetState = forceState !== undefined ? forceState : !this.isVisible;
		if (targetState) {
			this.show();
		} else {
			this.hide();
		}
	}

	public onToggle(cb: (isOpen: boolean) => void): void {
		this.onToggleCallbacks.push(cb);
	}

	public getIsOpen(): boolean {
		return this.isVisible;
	}

	public destroy(): void {
		this.root.unmount();
		this.screenGui.Destroy();
		AdminPanelView.instance = undefined;
	}
}
