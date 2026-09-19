import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { AdminService } from "client/services/AdminService";
import { MusicPlayerService } from "client/services/MusicPlayerService";
import { Fonts } from "client/ui/Typography";
import { DEFAULT_SMARTPHONE_CONFIG, MusicPlayerState, TrackData } from "shared/types";
import { LucideIcon } from "../../components/LucideIcon";

export interface AdminMusicTabProps {
	visible: boolean;
}

function formatTime(seconds: number): string {
	const s = math.floor(seconds);
	const m = math.floor(s / 60);
	const sec = s % 60;
	const secStr = sec < 10 ? `0${sec}` : tostring(sec);
	return `${m}:${secStr}`;
}

export function AdminMusicTabComponent({ visible }: AdminMusicTabProps) {
	const musicService = MusicPlayerService.getInstance();
	const adminService = AdminService.getInstance();

	const [currentTrack, setCurrentTrack] = useState<TrackData | undefined>(() =>
		musicService.getCurrentTrack(),
	);
	const [playerState, setPlayerState] = useState<MusicPlayerState>(() =>
		musicService.getState(),
	);
	const [progress, setProgress] = useState({ position: 0, duration: 0 });
	const [isQueueLocked, setIsQueueLocked] = useState(() => adminService.getState().isQueueLocked);

	useEffect(() => {
		musicService.onTrackChanged((t) => setCurrentTrack(t));
		musicService.onStateChanged((s) => setPlayerState(s));
		musicService.onProgress((pos, dur) => setProgress({ position: pos, duration: dur }));

		const unsubAdmin = adminService.onStateUpdated((state) => {
			setIsQueueLocked(state.isQueueLocked);
		});

		return () => {
			unsubAdmin();
		};
	}, []);

	if (!visible) return <></>;

	const isPlaying = playerState === MusicPlayerState.Playing;
	const ratio = progress.duration > 0 ? math.clamp(progress.position / progress.duration, 0, 1) : 0;
	const playlist = musicService.getDefaultPlaylist() ?? DEFAULT_SMARTPHONE_CONFIG.playlist;

	return (
		<scrollingframe
			key="AdminMusicTab"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			ScrollBarThickness={3}
			ScrollBarImageColor3={Color3.fromHex("#383838")}
			CanvasSize={new UDim2(0, 0, 0, 0)}
			AutomaticCanvasSize={Enum.AutomaticSize.Y}
			ZIndex={10}
		>
			<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 14)} />
			<uipadding
				PaddingTop={new UDim(0, 12)}
				PaddingBottom={new UDim(0, 24)}
				PaddingLeft={new UDim(0, 14)}
				PaddingRight={new UDim(0, 14)}
			/>

			{/* 1. Live Monitor Card */}
			<frame
				key="MonitorCard"
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 130)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

				{/* Header Row */}
				<frame
					key="MonitorHeader"
					Size={new UDim2(1, 0, 0, 20)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<textlabel
						key="Title"
						Size={new UDim2(0.6, 0, 1, 0)}
						BackgroundTransparency={1}
						Text="LIVE GIGS MONITOR"
						TextColor3={Color3.fromHex("#888888")}
						Font={Fonts.Bold}
						TextSize={11}
						TextXAlignment={Enum.TextXAlignment.Left}
						ZIndex={12}
					/>
					<frame
						key="StatusBadgeWrapper"
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, 0, 0.5, 0)}
						Size={new UDim2(0, 72, 0, 20)}
						BackgroundColor3={
							isPlaying
								? Color3.fromHex("#ffffff")
								: playerState === MusicPlayerState.Paused
								? Color3.fromHex("#333333")
								: Color3.fromHex("#1a1a1a")
						}
						ZIndex={12}
					>
						<uicorner CornerRadius={new UDim(0, 6)} />
						<textlabel
							key="StatusBadge"
							Size={new UDim2(1, 0, 1, 0)}
							BackgroundTransparency={1}
							Text={
								isPlaying
									? "PLAYING"
									: playerState === MusicPlayerState.Paused
									? "PAUSED"
									: "IDLE"
							}
							TextColor3={isPlaying ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={10}
							ZIndex={13}
						/>
					</frame>
				</frame>

				{/* Track Title & Artist */}
				<textlabel
					key="TrackTitle"
					Position={new UDim2(0, 0, 0, 30)}
					Size={new UDim2(1, 0, 0, 20)}
					BackgroundTransparency={1}
					Text={currentTrack ? currentTrack.title : "No Track Playing"}
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Bold}
					TextSize={15}
					TextTruncate={Enum.TextTruncate.AtEnd}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>
				<textlabel
					key="TrackArtist"
					Position={new UDim2(0, 0, 0, 52)}
					Size={new UDim2(1, 0, 0, 16)}
					BackgroundTransparency={1}
					Text={currentTrack ? currentTrack.artist : "Playlist is idle"}
					TextColor3={Color3.fromHex("#777777")}
					Font={Fonts.Medium}
					TextSize={12}
					TextTruncate={Enum.TextTruncate.AtEnd}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				{/* Progress & Time */}
				<frame
					key="ProgressRow"
					Position={new UDim2(0, 0, 0, 78)}
					Size={new UDim2(1, 0, 0, 24)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<frame
						key="BarTrack"
						Position={new UDim2(0, 0, 0, 4)}
						Size={new UDim2(1, 0, 0, 4)}
						BackgroundColor3={Color3.fromHex("#262626")}
						ZIndex={13}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<frame
							key="BarFill"
							Size={new UDim2(ratio, 0, 1, 0)}
							BackgroundColor3={Color3.fromHex("#ffffff")}
							ZIndex={14}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
						</frame>
					</frame>
					<textlabel
						key="TimeLabel"
						Position={new UDim2(0, 0, 0, 10)}
						Size={new UDim2(1, 0, 0, 14)}
						BackgroundTransparency={1}
						Text={`${formatTime(progress.position)} / ${formatTime(progress.duration)}`}
						TextColor3={Color3.fromHex("#666666")}
						Font={Fonts.Regular}
						TextSize={10}
						TextXAlignment={Enum.TextXAlignment.Right}
						ZIndex={13}
					/>
				</frame>
			</frame>

			{/* 2. Transport Controls Card */}
			<frame
				key="TransportCard"
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 84)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 10)}
					PaddingBottom={new UDim(0, 10)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

				<textlabel
					key="Title"
					Size={new UDim2(1, 0, 0, 16)}
					BackgroundTransparency={1}
					Text="TRANSPORT CONTROLS"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="Btns"
					AnchorPoint={new Vector2(0.5, 1)}
					Position={new UDim2(0.5, 0, 1, 0)}
					Size={new UDim2(0, 240, 0, 42)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uilistlayout
						SortOrder={Enum.SortOrder.LayoutOrder}
						FillDirection={Enum.FillDirection.Horizontal}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 18)}
					/>

					{/* Prev */}
					<textbutton
						key="PrevBtn"
						LayoutOrder={1}
						Size={new UDim2(0, 36, 0, 36)}
						BackgroundColor3={Color3.fromHex("#202020")}
						Text=""
						AutoButtonColor={false}
						ZIndex={13}
						Event={{
							MouseButton1Click: () => musicService.requestPrevious(),
						}}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<LucideIcon
							name="skip-back"
							size={new UDim2(0, 18, 0, 18)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#ffffff")}
							zIndex={14}
						/>
					</textbutton>

					{/* Play/Pause */}
					<textbutton
						key="PlayBtn"
						LayoutOrder={2}
						Size={new UDim2(0, 42, 0, 42)}
						BackgroundColor3={Color3.fromHex("#ffffff")}
						Text=""
						AutoButtonColor={false}
						ZIndex={13}
						Event={{
							MouseButton1Click: () => musicService.requestPlayPause(),
						}}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<LucideIcon
							name={isPlaying ? "pause" : "play"}
							size={new UDim2(0, 20, 0, 20)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#000000")}
							zIndex={14}
						/>
					</textbutton>

					{/* Next */}
					<textbutton
						key="NextBtn"
						LayoutOrder={3}
						Size={new UDim2(0, 36, 0, 36)}
						BackgroundColor3={Color3.fromHex("#202020")}
						Text=""
						AutoButtonColor={false}
						ZIndex={13}
						Event={{
							MouseButton1Click: () => musicService.requestNext(),
						}}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<LucideIcon
							name="skip-forward"
							size={new UDim2(0, 18, 0, 18)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#ffffff")}
							zIndex={14}
						/>
					</textbutton>
				</frame>
			</frame>

			{/* 3. Queue Guard Card */}
			<frame
				key="QueueGuardCard"
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 80)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 10)}
					PaddingBottom={new UDim(0, 10)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

				<textlabel
					key="Title"
					Size={new UDim2(1, 0, 0, 16)}
					BackgroundTransparency={1}
					Text="QUEUE GUARD (ANTI-SPAM)"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="GuardContent"
					Position={new UDim2(0, 0, 0, 24)}
					Size={new UDim2(1, 0, 1, -24)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<textlabel
						key="QueueStatusLabel"
						Size={new UDim2(0.6, 0, 1, 0)}
						BackgroundTransparency={1}
						Text={
							isQueueLocked
								? "Public requests: BLOCKED"
								: "Public requests: ALLOWED"
						}
						TextColor3={
							isQueueLocked ? Color3.fromHex("#ff4d4d") : Color3.fromHex("#32dc78")
						}
						Font={Fonts.Medium}
						TextSize={12}
						TextXAlignment={Enum.TextXAlignment.Left}
						ZIndex={13}
					/>

					<textbutton
						key="LockToggleBtn"
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, 0, 0.5, 0)}
						Size={new UDim2(0, 120, 0, 32)}
						BackgroundColor3={
							isQueueLocked ? Color3.fromHex("#ffffff") : Color3.fromHex("#202020")
						}
						Text=""
						AutoButtonColor={false}
						ZIndex={13}
						Event={{
							MouseButton1Click: () => {
								adminService.setQueueLocked(!isQueueLocked);
							},
						}}
					>
						<uicorner CornerRadius={new UDim(0, 8)} />
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							HorizontalAlignment={Enum.HorizontalAlignment.Center}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							Padding={new UDim(0, 6)}
						/>
						<LucideIcon
							name={isQueueLocked ? "lock-open" : "lock"}
							size={new UDim2(0, 14, 0, 14)}
							color={
								isQueueLocked ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")
							}
							zIndex={14}
						/>
						<textlabel
							key="BtnText"
							BackgroundTransparency={1}
							AutomaticSize={Enum.AutomaticSize.XY}
							Text={isQueueLocked ? "Unlock Queue" : "Lock Queue"}
							TextColor3={
								isQueueLocked ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")
							}
							Font={Fonts.Bold}
							TextSize={11}
							ZIndex={14}
						/>
					</textbutton>
				</frame>
			</frame>

			{/* 4. Setlist Launcher Card */}
			<frame
				key="SetlistCard"
				LayoutOrder={4}
				Size={new UDim2(1, 0, 0, 240)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 10)}
					PaddingBottom={new UDim(0, 10)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

				<textlabel
					key="Title"
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text="SETLIST LAUNCHER"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<scrollingframe
					key="SetlistScroll"
					Position={new UDim2(0, 0, 0, 24)}
					Size={new UDim2(1, 0, 1, -24)}
					BackgroundTransparency={1}
					ScrollBarThickness={2}
					ScrollBarImageColor3={Color3.fromHex("#383838")}
					CanvasSize={new UDim2(0, 0, 0, 0)}
					AutomaticCanvasSize={Enum.AutomaticSize.Y}
					ZIndex={12}
				>
					<uilistlayout Padding={new UDim(0, 6)} SortOrder={Enum.SortOrder.LayoutOrder} />

					{playlist.map((track, idx) => (
						<frame
							key={`track_${track.id ?? idx}`}
							LayoutOrder={idx}
							Size={new UDim2(1, 0, 0, 44)}
							BackgroundColor3={Color3.fromHex("#1a1a1a")}
							ZIndex={13}
						>
							<uicorner CornerRadius={new UDim(0, 8)} />
							<uipadding
								PaddingLeft={new UDim(0, 10)}
								PaddingRight={new UDim(0, 10)}
							/>

							<textlabel
								key="Title"
								Position={new UDim2(0, 0, 0, 6)}
								Size={new UDim2(1, -70, 0, 16)}
								BackgroundTransparency={1}
								Text={track.title}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={12}
								TextTruncate={Enum.TextTruncate.AtEnd}
								TextXAlignment={Enum.TextXAlignment.Left}
								ZIndex={14}
							/>
							<textlabel
								key="Artist"
								Position={new UDim2(0, 0, 0, 22)}
								Size={new UDim2(1, -70, 0, 14)}
								BackgroundTransparency={1}
								Text={track.artist}
								TextColor3={Color3.fromHex("#777777")}
								Font={Fonts.Regular}
								TextSize={10}
								TextTruncate={Enum.TextTruncate.AtEnd}
								TextXAlignment={Enum.TextXAlignment.Left}
								ZIndex={14}
							/>

							<textbutton
								key="PlayBtn"
								AnchorPoint={new Vector2(1, 0.5)}
								Position={new UDim2(1, 0, 0.5, 0)}
								Size={new UDim2(0, 56, 0, 26)}
								BackgroundColor3={Color3.fromHex("#ffffff")}
								Text="Play"
								TextColor3={Color3.fromHex("#000000")}
								Font={Fonts.Bold}
								TextSize={11}
								AutoButtonColor={false}
								ZIndex={14}
								Event={{
									MouseButton1Click: () => {
										musicService.requestPlaySpecific(track);
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 6)} />
							</textbutton>
						</frame>
					))}
				</scrollingframe>
			</frame>
		</scrollingframe>
	);
}

/**
 * Backward-compatible OOP adapter for AdminMusicTab.
 */
export class AdminMusicTab {
	public readonly container: Frame;
	private root: Root;
	private isVisible = false;

	constructor(parent: Frame) {
		this.container = new Instance("Frame");
		this.container.Name = "AdminMusicTabWrapper";
		this.container.Size = new UDim2(1, 0, 1, 0);
		this.container.BackgroundTransparency = 1;
		this.container.Visible = false;
		this.container.Parent = parent;

		this.root = ReactRoblox.createRoot(this.container);
		this.render();
	}

	private render(): void {
		this.root.render(<AdminMusicTabComponent visible={this.isVisible} />);
	}

	public setVisible(val: boolean): void {
		this.isVisible = val;
		this.container.Visible = val;
		this.render();
	}

	public destroy(): void {
		this.root.unmount();
		this.container.Destroy();
	}
}
