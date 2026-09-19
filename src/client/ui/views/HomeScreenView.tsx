import React from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { AppId } from "shared/types";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export interface AppIconConfig {
	appId: AppId;
	label: string;
	iconColor: Color3;
	iconName: string;
}

const DOCK_APPS: AppIconConfig[] = [
	{
		appId: AppId.Messages,
		label: "Messages",
		iconColor: Color3.fromHex("#202020"),
		iconName: "message-square",
	},
	{
		appId: AppId.Social,
		label: "Social",
		iconColor: Color3.fromHex("#202020"),
		iconName: "message-square-heart",
	},
	{
		appId: AppId.Music,
		label: "Music",
		iconColor: Color3.fromHex("#202020"),
		iconName: "music",
	},
	{
		appId: AppId.Settings,
		label: "Settings",
		iconColor: Color3.fromHex("#202020"),
		iconName: "settings",
	},
];

const GRID_APPS: AppIconConfig[] = [
	{
		appId: AppId.Events,
		label: "Events",
		iconColor: Color3.fromHex("#202020"),
		iconName: "calendar",
	},
];

export type AppIconClickCallback = (appId: AppId) => void;

export function HomeScreenComponent({
	visible,
	badges,
	onAppClick,
}: {
	visible: boolean;
	badges: Map<AppId, number>;
	onAppClick: (appId: AppId) => void;
}) {
	if (!visible) return <></>;

	return (
		<frame
			key="HomeScreen"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundColor3={Color3.fromHex("#0c0c0c")}
			Active={true}
			ZIndex={5}
		>
			<uicorner CornerRadius={new UDim(0, 46)} />
			<uigradient
				Color={
					new ColorSequence([
						new ColorSequenceKeypoint(0, Color3.fromHex("#181818")),
						new ColorSequenceKeypoint(1, Color3.fromHex("#050505")),
					])
				}
				Rotation={145}
			/>

			{/* App Grid */}
			<frame
				key="AppGrid"
				Position={new UDim2(0, 24, 0, 80)}
				Size={new UDim2(1, -48, 0, 200)}
				BackgroundTransparency={1}
				ZIndex={6}
			>
				<uigridlayout
					CellSize={new UDim2(0, 56, 0, 74)}
					CellPadding={new UDim2(0, 18, 0, 18)}
					HorizontalAlignment={Enum.HorizontalAlignment.Left}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{GRID_APPS.map((app) => (
					<textbutton
						key={`app_${app.appId}`}
						Size={new UDim2(1, 0, 1, 0)}
						BackgroundTransparency={1}
						Text=""
						AutoButtonColor={false}
						ZIndex={7}
						Event={{
							Activated: () => onAppClick(app.appId),
							MouseButton1Click: () => onAppClick(app.appId),
						}}
					>
						<frame
							key="IconWrapper"
							Size={new UDim2(0, 56, 0, 56)}
							BackgroundColor3={Color3.fromHex("#1a1a1a")}
							ZIndex={8}
						>
							<uicorner CornerRadius={new UDim(0, 14)} />
							<uistroke Color={Color3.fromHex("#333333")} Thickness={1} />
							<LucideIcon
								name={app.iconName}
								size={new UDim2(0, 28, 0, 28)}
								anchorPoint={new Vector2(0.5, 0.5)}
								position={new UDim2(0.5, 0, 0.5, 0)}
								color={Color3.fromHex("#ffffff")}
								zIndex={9}
							/>
						</frame>
						<textlabel
							key="Label"
							AnchorPoint={new Vector2(0.5, 1)}
							Position={new UDim2(0.5, 0, 1, 0)}
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text={app.label}
							TextColor3={Color3.fromHex("#d0d0d0")}
							Font={Fonts.Medium}
							TextSize={11}
							ZIndex={8}
						/>
					</textbutton>
				))}
			</frame>

			{/* Dock Area */}
			<frame
				key="DockWrapper"
				AnchorPoint={new Vector2(0.5, 1)}
				Position={new UDim2(0.5, 0, 1, -20)}
				Size={new UDim2(1, -28, 0, 76)}
				BackgroundColor3={Color3.fromHex("#141414")}
				BackgroundTransparency={0.25}
				ZIndex={6}
			>
				<uicorner CornerRadius={new UDim(0, 24)} />
				<uistroke
					Color={Color3.fromHex("#282828")}
					Thickness={1}
					Transparency={0.4}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 14)}
				/>

				{DOCK_APPS.map((app) => {
					const badgeCount = badges.get(app.appId) ?? 0;
					return (
						<textbutton
							key={`dock_${app.appId}`}
							Size={new UDim2(0, 52, 0, 52)}
							BackgroundColor3={Color3.fromHex("#202020")}
							Text=""
							AutoButtonColor={false}
							ZIndex={7}
							Event={{
								Activated: () => onAppClick(app.appId),
								MouseButton1Click: () => onAppClick(app.appId),
							}}
						>
							<uicorner CornerRadius={new UDim(0, 14)} />
							<uistroke Color={Color3.fromHex("#333333")} Thickness={1} />
							<LucideIcon
								name={app.iconName}
								size={new UDim2(0, 24, 0, 24)}
								anchorPoint={new Vector2(0.5, 0.5)}
								position={new UDim2(0.5, 0, 0.5, 0)}
								color={Color3.fromHex("#ffffff")}
								zIndex={8}
							/>

							{/* Badge */}
							{badgeCount > 0 ? (
								<frame
									key="Badge"
									AnchorPoint={new Vector2(1, 0)}
									Position={new UDim2(1, 4, 0, -4)}
									Size={new UDim2(0, 18, 0, 18)}
									BackgroundColor3={Color3.fromHex("#c92222")}
									ZIndex={9}
								>
									<uicorner CornerRadius={new UDim(1, 0)} />
									<textlabel
										key="Count"
										Size={new UDim2(1, 0, 1, 0)}
										BackgroundTransparency={1}
										Text={badgeCount > 99 ? "99+" : tostring(badgeCount)}
										TextColor3={Color3.fromHex("#ffffff")}
										Font={Fonts.Bold}
										TextScaled={true}
										ZIndex={10}
									>
										<uitextsizeconstraint MaxTextSize={10} MinTextSize={7} />
									</textlabel>
								</frame>
							) : undefined}
						</textbutton>
					);
				})}
			</frame>
		</frame>
	);
}

/**
 * Home Screen view with an iOS-style app grid and Dock.
 * Migrated to React TSX declarative renderer.
 */
export class HomeScreenView {
	private hostInstance: GuiObject;
	private root: Root;

	private visible = false;
	private badges = new Map<AppId, number>();
	private appIconClickCallbacks: AppIconClickCallback[] = [];

	constructor(parent: GuiObject) {
		this.hostInstance = parent;
		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	private render(): void {
		this.root.render(
			<HomeScreenComponent
				visible={this.visible}
				badges={this.badges}
				onAppClick={(appId) => {
					for (const cb of this.appIconClickCallbacks) cb(appId);
				}}
			/>,
		);
	}

	public setBadge(appId: AppId, count: number): void {
		this.setAppBadge(appId, count);
	}

	public setAppBadge(appId: AppId, count: number): void {
		const newMap = new Map<AppId, number>();
		this.badges.forEach((v, k) => newMap.set(k, v));
		newMap.set(appId, count);
		this.badges = newMap;
		this.render();
	}

	public onAppIconClicked(cb: AppIconClickCallback): void {
		this.appIconClickCallbacks.push(cb);
	}

	public show(): void {
		this.visible = true;
		this.render();
	}

	public hide(): void {
		this.visible = false;
		this.render();
	}

	public destroy(): void {
		this.root.unmount();
	}
}
