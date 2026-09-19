import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { UserInputService } from "@rbxts/services";
import { MusicPlayerService } from "client/services/MusicPlayerService";
import { GlobalNotificationService } from "client/services/GlobalNotificationService";
import { Fonts } from "../Typography";
import { DEFAULT_SMARTPHONE_CONFIG, MusicPlayerState, MusicQueueItem, TrackData } from "shared/types";
import { LucideIcon } from "../components/LucideIcon";

export interface MusicComponentProps {
	visible: boolean;
	onBack: () => void;
}

function formatTime(seconds: number): string {
	const s = math.floor(seconds);
	const m = math.floor(s / 60);
	const sec = s % 60;
	const secStr = sec < 10 ? `0${sec}` : tostring(sec);
	return `${m}:${secStr}`;
}

export function MusicComponent({ visible, onBack }: MusicComponentProps) {
	const musicService = MusicPlayerService.getInstance();

	const [currentTrack, setCurrentTrack] = useState<TrackData | undefined>(() => musicService.getCurrentTrack());
	const [playerState, setPlayerState] = useState<MusicPlayerState>(() => musicService.getState());
	const [progress, setProgress] = useState({ position: 0, duration: 0 });
	const [queue, setQueue] = useState<MusicQueueItem[]>(() => musicService.getQueue());
	const [showQueue, setShowQueue] = useState(false);
	const [queueTab, setQueueTab] = useState<"queue" | "request">("queue");
	const [customSoundId, setCustomSoundId] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const isSubmittingRef = useRef(false);
	const isActionProcessingRef = useRef(false);
	const [isAdmin] = useState(() => musicService.isAdmin());
	const [volumeValue, setVolumeValue] = useState(() => {
		const v = musicService.getVolume();
		return math.clamp(math.round(v * 100), 1, 100);
	});
	const [isDraggingVolume, setIsDraggingVolume] = useState(false);
	const volumeTrackRef = useRef<Frame>();

	const playlist = musicService.getDefaultPlaylist() ?? DEFAULT_SMARTPHONE_CONFIG.playlist;
	const filteredPlaylist = playlist.filter((track) => {
		if (searchQuery === "") return true;
		const q = searchQuery.lower();
		return track.title.lower().find(q)[0] !== undefined || track.artist.lower().find(q)[0] !== undefined;
	});

	useEffect(() => {
		musicService.onTrackChanged((t) => setCurrentTrack(t));
		musicService.onStateChanged((s) => setPlayerState(s));
		musicService.onProgress((pos, dur) => setProgress({ position: pos, duration: dur }));
		musicService.onQueueUpdated((q) => setQueue([...q]));
		musicService.onVolumeChanged((vol) => {
			setVolumeValue(math.clamp(math.round(vol * 100), 1, 100));
		});
	}, []);

	const updateVolumeFromInput = (inputX: number) => {
		const track = volumeTrackRef.current;
		if (!track) return;
		const trackX = track.AbsolutePosition.X;
		const trackWidth = track.AbsoluteSize.X;
		if (trackWidth <= 0) return;

		const relativeX = inputX - trackX;
		const r = math.clamp(relativeX / trackWidth, 0, 1);
		const newVol = math.clamp(math.round(r * 100), 1, 100);
		setVolumeValue(newVol);
		musicService.setVolume(newVol / 100);
	};

	useEffect(() => {
		if (!isDraggingVolume) return;

		const moveConn = UserInputService.InputChanged.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseMovement ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				updateVolumeFromInput(input.Position.X);
			}
		});

		const endConn = UserInputService.InputEnded.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseButton1 ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				setIsDraggingVolume(false);
			}
		});

		return () => {
			moveConn.Disconnect();
			endConn.Disconnect();
		};
	}, [isDraggingVolume]);

	if (!visible) return <></>;

	const isPlaying = playerState === MusicPlayerState.Playing;
	const ratio = progress.duration > 0 ? math.clamp(progress.position / progress.duration, 0, 1) : 0;
	const volumeIconName = volumeValue <= 1 ? "volume-x" : volumeValue <= 50 ? "volume-1" : "volume-2";

	const handleRequestTrack = async (track: TrackData) => {
		if (isSubmittingRef.current) return;
		isSubmittingRef.current = true;
		setIsSubmitting(true);
		try {
			const res = await musicService.requestQueueSong(track);
			if (res.success) {
				setQueueTab("queue");
			} else {
				GlobalNotificationService.getInstance().show({
					title: "Gagal Request",
					message: res.message,
					badgeIcon: "music",
					badgeColor: Color3.fromHex("#e04545"),
					soundId: false,
				});
			}
		} catch (err) {
			GlobalNotificationService.getInstance().show({
				title: "Error Request",
				message: tostring(err),
				badgeIcon: "music",
				badgeColor: Color3.fromHex("#e04545"),
				soundId: false,
			});
		} finally {
			isSubmittingRef.current = false;
			setIsSubmitting(false);
		}
	};

	const handleRequestCustomSong = async () => {
		if (isSubmittingRef.current) return;
		const cleanDigits = customSoundId.gsub("%D", "")[0];
		if (!cleanDigits || cleanDigits.size() === 0) {
			GlobalNotificationService.getInstance().show({
				title: "Sound ID Tidak Valid",
				message: "Masukkan ID angka audio Roblox yang valid.",
				badgeIcon: "music",
				badgeColor: Color3.fromHex("#e04545"),
				soundId: false,
			});
			return;
		}

		isSubmittingRef.current = true;
		setIsSubmitting(true);
		try {
			const soundAssetId = `rbxassetid://${cleanDigits}`;
			const res = await musicService.requestQueueSong({
				soundId: soundAssetId,
				title: `Sound #${cleanDigits}`,
				artist: "Custom Audio",
			});
			if (res.success) {
				setCustomSoundId("");
				setQueueTab("queue");
			} else {
				GlobalNotificationService.getInstance().show({
					title: "Gagal Request",
					message: res.message,
					badgeIcon: "music",
					badgeColor: Color3.fromHex("#e04545"),
					soundId: false,
				});
			}
		} catch (err) {
			GlobalNotificationService.getInstance().show({
				title: "Error Request",
				message: tostring(err),
				badgeIcon: "music",
				badgeColor: Color3.fromHex("#e04545"),
				soundId: false,
			});
		} finally {
			isSubmittingRef.current = false;
			setIsSubmitting(false);
		}
	};

	const handleVoteSkip = async (idx: number) => {
		if (isActionProcessingRef.current) return;
		isActionProcessingRef.current = true;
		try {
			const res = await musicService.requestVoteSkip(idx);
			GlobalNotificationService.getInstance().show({
				title: "Vote Skip",
				message: res.message,
				badgeIcon: "skip-forward",
				badgeColor: res.success ? Color3.fromHex("#1db954") : Color3.fromHex("#f5a623"),
				soundId: false,
			});
		} catch (err) {
			GlobalNotificationService.getInstance().show({
				title: "Vote Skip Gagal",
				message: tostring(err),
				badgeIcon: "skip-forward",
				badgeColor: Color3.fromHex("#e04545"),
				soundId: false,
			});
		} finally {
			isActionProcessingRef.current = false;
		}
	};

	const handleRemoveQueue = async (idx: number) => {
		if (isActionProcessingRef.current) return;
		isActionProcessingRef.current = true;
		try {
			const res = await musicService.requestRemoveQueue(idx);
			GlobalNotificationService.getInstance().show({
				title: "Delete",
				message: res.message,
				badgeIcon: "trash-2",
				badgeColor: res.success ? Color3.fromHex("#1db954") : Color3.fromHex("#e04545"),
				soundId: false,
			});
		} catch (err) {
			GlobalNotificationService.getInstance().show({
				title: "Gagal Hapus",
				message: tostring(err),
				badgeIcon: "trash-2",
				badgeColor: Color3.fromHex("#e04545"),
				soundId: false,
			});
		} finally {
			isActionProcessingRef.current = false;
		}
	};

	const handleHeaderBack = () => {
		if (showQueue) {
			setShowQueue(false);
		} else {
			onBack();
		}
	};

	return (
		<frame key="MusicApp" Size={new UDim2(1, 0, 1, 0)} BackgroundColor3={Color3.fromHex("#0c0c0c")} ZIndex={8}>
			{/* Top Header */}
			<frame
				key="Header"
				Size={new UDim2(1, 0, 0, 52)}
				BackgroundColor3={Color3.fromHex("#101010")}
				BackgroundTransparency={0.2}
				ZIndex={9}
			>
				<uistroke Color={Color3.fromHex("#222222")} Thickness={1} />
				<textbutton
					key="BackButton"
					AnchorPoint={new Vector2(0, 0.5)}
					Position={new UDim2(0, 12, 0.5, 0)}
					Size={new UDim2(0, 36, 0, 36)}
					BackgroundTransparency={1}
					Text=""
					AutoButtonColor={false}
					ZIndex={10}
					Event={{
						Activated: handleHeaderBack,
					}}
				>
					<LucideIcon
						name="chevron-left"
						size={new UDim2(0, 18, 0, 18)}
						anchorPoint={new Vector2(0.5, 0.5)}
						position={new UDim2(0.5, 0, 0.5, 0)}
						color={Color3.fromHex("#ffffff")}
						zIndex={10}
					/>
				</textbutton>

				<textlabel
					key="Title"
					Position={new UDim2(0, 48, 0, 0)}
					Size={new UDim2(1, -96, 1, 0)}
					BackgroundTransparency={1}
					Text={showQueue ? (queueTab === "queue" ? "Queue" : "Request") : "Now Playing"}
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Bold}
					TextSize={14}
					ZIndex={10}
				/>
			</frame>

			{/* Main Player Screen */}
			{!showQueue ? (
				<frame
					key="PlayerBody"
					Position={new UDim2(0, 0, 0, 52)}
					Size={new UDim2(1, 0, 1, -52)}
					BackgroundTransparency={1}
					ZIndex={9}
				>
					{/* Album Artwork */}
					<frame
						key="CoverWrapper"
						AnchorPoint={new Vector2(0.5, 0)}
						Position={new UDim2(0.5, 0, 0, 24)}
						Size={new UDim2(0, 220, 0, 220)}
						BackgroundColor3={currentTrack ? currentTrack.coverColor : Color3.fromHex("#1f1f1f")}
						ZIndex={10}
					>
						<uicorner CornerRadius={new UDim(0, 20)} />
						<uistroke Color={Color3.fromHex("#333333")} Thickness={1.5} />
						<LucideIcon
							name="disc-3"
							size={new UDim2(0, 80, 0, 80)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#ffffff")}
							zIndex={11}
						/>
					</frame>

					{/* Track Info */}
					<textlabel
						key="SongTitle"
						AnchorPoint={new Vector2(0.5, 0)}
						Position={new UDim2(0.5, 0, 0, 264)}
						Size={new UDim2(1, -48, 0, 24)}
						BackgroundTransparency={1}
						Text={currentTrack ? currentTrack.title : "Tidak Ada Lagu"}
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Bold}
						TextSize={18}
						TextTruncate={Enum.TextTruncate.AtEnd}
						ZIndex={10}
					/>

					<textlabel
						key="Artist"
						AnchorPoint={new Vector2(0.5, 0)}
						Position={new UDim2(0.5, 0, 0, 292)}
						Size={new UDim2(1, -48, 0, 18)}
						BackgroundTransparency={1}
						Text={currentTrack ? currentTrack.artist : "Pilih lagu"}
						TextColor3={Color3.fromHex("#888888")}
						Font={Fonts.Medium}
						TextSize={13}
						TextTruncate={Enum.TextTruncate.AtEnd}
						ZIndex={10}
					/>

					{/* Seekbar */}
					<frame
						key="SeekbarContainer"
						Position={new UDim2(0, 28, 0, 330)}
						Size={new UDim2(1, -56, 0, 24)}
						BackgroundTransparency={1}
						ZIndex={10}
					>
						<frame
							key="Track"
							Position={new UDim2(0, 0, 0, 4)}
							Size={new UDim2(1, 0, 0, 4)}
							BackgroundColor3={Color3.fromHex("#262626")}
							ZIndex={11}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
							<frame
								key="Fill"
								Size={new UDim2(ratio, 0, 1, 0)}
								BackgroundColor3={Color3.fromHex("#ffffff")}
								ZIndex={12}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
							</frame>
						</frame>

						<textlabel
							key="CurrentTime"
							Position={new UDim2(0, 0, 0, 12)}
							Size={new UDim2(0.5, 0, 0, 14)}
							BackgroundTransparency={1}
							Text={formatTime(progress.position)}
							TextColor3={Color3.fromHex("#666666")}
							Font={Fonts.Regular}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={11}
						/>

						<textlabel
							key="Duration"
							AnchorPoint={new Vector2(1, 0)}
							Position={new UDim2(1, 0, 0, 12)}
							Size={new UDim2(0.5, 0, 0, 14)}
							BackgroundTransparency={1}
							Text={formatTime(progress.duration)}
							TextColor3={Color3.fromHex("#666666")}
							Font={Fonts.Regular}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Right}
							ZIndex={11}
						/>
					</frame>

					{/* Volume Slider Row (Right under Track Timeline) */}
					<frame
						key="VolumeWrapper"
						Position={new UDim2(0, 28, 0, 362)}
						Size={new UDim2(1, -56, 0, 24)}
						BackgroundTransparency={1}
						ZIndex={10}
					>
						<LucideIcon
							name={volumeIconName}
							size={new UDim2(0, 14, 0, 14)}
							position={new UDim2(0, 0, 0.5, -7)}
							color={Color3.fromHex("#888888")}
							zIndex={11}
						/>

						{/* Track */}
						<frame
							key="VolumeTrack"
							ref={volumeTrackRef}
							Position={new UDim2(0, 22, 0.5, -2)}
							Size={new UDim2(1, -58, 0, 4)}
							BackgroundColor3={Color3.fromHex("#262626")}
							ZIndex={11}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
							<frame
								key="VolumeFill"
								Size={new UDim2(volumeValue / 100, 0, 1, 0)}
								BackgroundColor3={Color3.fromHex("#ffffff")}
								ZIndex={12}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
							</frame>
							<frame
								key="VolumeThumb"
								AnchorPoint={new Vector2(0.5, 0.5)}
								Position={new UDim2(volumeValue / 100, 0, 0.5, 0)}
								Size={new UDim2(0, 12, 0, 12)}
								BackgroundColor3={Color3.fromHex("#ffffff")}
								ZIndex={13}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
								<uistroke Color={Color3.fromHex("#141414")} Thickness={1.5} />
							</frame>
						</frame>

						{/* Numeric Value 1-100 */}
						<textlabel
							key="VolumeValue"
							AnchorPoint={new Vector2(1, 0.5)}
							Position={new UDim2(1, 0, 0.5, 0)}
							Size={new UDim2(0, 30, 0, 14)}
							BackgroundTransparency={1}
							Text={`${volumeValue}`}
							TextColor3={Color3.fromHex("#888888")}
							Font={Fonts.Bold}
							TextSize={11}
							TextXAlignment={Enum.TextXAlignment.Right}
							ZIndex={11}
						/>

						{/* Hitbox for Dragging / Clicking */}
						<textbutton
							key="VolumeHitbox"
							Position={new UDim2(0, 18, 0, -3)}
							Size={new UDim2(1, -50, 1, 6)}
							BackgroundTransparency={1}
							Text=""
							AutoButtonColor={false}
							ZIndex={14}
							Event={{
								InputBegan: (_, input) => {
									if (
										input.UserInputType === Enum.UserInputType.MouseButton1 ||
										input.UserInputType === Enum.UserInputType.Touch
									) {
										setIsDraggingVolume(true);
										updateVolumeFromInput(input.Position.X);
									}
								},
							}}
						/>
					</frame>

					{/* Controls / Actions (Request & Queue) */}
					<frame
						key="RequestActionContainer"
						AnchorPoint={new Vector2(0.5, 0)}
						Position={new UDim2(0.5, 0, 0, 400)}
						Size={new UDim2(1, -48, 0, 48)}
						BackgroundTransparency={1}
						ZIndex={10}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							HorizontalAlignment={Enum.HorizontalAlignment.Center}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							Padding={new UDim(0, 10)}
						/>

						{/* Primary: Request Lagu */}
						<textbutton
							key="RequestSongBtn"
							Size={new UDim2(0.62, -5, 1, 0)}
							BackgroundColor3={Color3.fromHex("#ffffff")}
							Text=""
							AutoButtonColor={false}
							ZIndex={11}
							Event={{
								Activated: () => {
									setShowQueue(true);
									setQueueTab("request");
								},
							}}
						>
							<uicorner CornerRadius={new UDim(0, 12)} />
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 6)}
							/>
							<LucideIcon
								name="plus"
								size={new UDim2(0, 16, 0, 16)}
								color={Color3.fromHex("#000000")}
								zIndex={12}
							/>
							<textlabel
								key="BtnText"
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text="Request"
								TextColor3={Color3.fromHex("#000000")}
								Font={Fonts.Bold}
								TextSize={13}
								ZIndex={12}
							/>
						</textbutton>

						{/* Secondary: Antrean */}
						<textbutton
							key="ViewQueueBtn"
							Size={new UDim2(0.38, -5, 1, 0)}
							BackgroundColor3={Color3.fromHex("#1c1c1c")}
							Text=""
							AutoButtonColor={false}
							ZIndex={11}
							Event={{
								Activated: () => {
									setShowQueue(true);
									setQueueTab("queue");
								},
							}}
						>
							<uicorner CornerRadius={new UDim(0, 12)} />
							<uistroke Color={Color3.fromHex("#2e2e2e")} Thickness={1} />
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 4)}
							/>
							<LucideIcon
								name="list-music"
								size={new UDim2(0, 14, 0, 14)}
								color={Color3.fromHex("#cccccc")}
								zIndex={12}
							/>
							<textlabel
								key="BtnText"
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text={queue.size() > 0 ? `Queued (${queue.size()})` : "Queued"}
								TextColor3={Color3.fromHex("#cccccc")}
								Font={Fonts.Medium}
								TextSize={11}
								ZIndex={12}
							/>
						</textbutton>
					</frame>
				</frame>
			) : (
				/* Queue & Song Request Screen */
				<frame
					key="QueueContainer"
					Position={new UDim2(0, 0, 0, 52)}
					Size={new UDim2(1, 0, 1, -52)}
					BackgroundTransparency={1}
					ZIndex={9}
				>
					{/* iOS Segmented Control Tabs */}
					<frame
						key="SegmentedControl"
						Position={new UDim2(0, 14, 0, 10)}
						Size={new UDim2(1, -28, 0, 36)}
						BackgroundColor3={Color3.fromHex("#141414")}
						ZIndex={10}
					>
						<uicorner CornerRadius={new UDim(0, 9)} />
						<uistroke Color={Color3.fromHex("#242424")} Thickness={1} />
						<uipadding
							PaddingTop={new UDim(0, 3)}
							PaddingBottom={new UDim(0, 3)}
							PaddingLeft={new UDim(0, 3)}
							PaddingRight={new UDim(0, 3)}
						/>

						{/* Tab 1: Antrean */}
						<textbutton
							key="TabQueue"
							Position={new UDim2(0, 0, 0, 0)}
							Size={new UDim2(0.5, -2, 1, 0)}
							BackgroundColor3={
								queueTab === "queue" ? Color3.fromHex("#ffffff") : Color3.fromHex("#141414")
							}
							BackgroundTransparency={queueTab === "queue" ? 0 : 1}
							Text=""
							AutoButtonColor={false}
							ZIndex={11}
							Event={{
								Activated: () => setQueueTab("queue"),
							}}
						>
							<uicorner CornerRadius={new UDim(0, 7)} />
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 6)}
							/>
							<LucideIcon
								name="list-music"
								size={new UDim2(0, 13, 0, 13)}
								color={queueTab === "queue" ? Color3.fromHex("#000000") : Color3.fromHex("#888888")}
								zIndex={12}
							/>
							<textlabel
								key="Label"
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text={`Queued (${queue.size()})`}
								TextColor3={
									queueTab === "queue" ? Color3.fromHex("#000000") : Color3.fromHex("#888888")
								}
								Font={queueTab === "queue" ? Fonts.Bold : Fonts.Medium}
								TextSize={11}
								ZIndex={12}
							/>
						</textbutton>

						{/* Tab 2: Request Lagu */}
						<textbutton
							key="TabRequest"
							AnchorPoint={new Vector2(1, 0)}
							Position={new UDim2(1, 0, 0, 0)}
							Size={new UDim2(0.5, -2, 1, 0)}
							BackgroundColor3={
								queueTab === "request" ? Color3.fromHex("#ffffff") : Color3.fromHex("#141414")
							}
							BackgroundTransparency={queueTab === "request" ? 0 : 1}
							Text=""
							AutoButtonColor={false}
							ZIndex={11}
							Event={{
								Activated: () => setQueueTab("request"),
							}}
						>
							<uicorner CornerRadius={new UDim(0, 7)} />
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 6)}
							/>
							<LucideIcon
								name="plus"
								size={new UDim2(0, 13, 0, 13)}
								color={queueTab === "request" ? Color3.fromHex("#000000") : Color3.fromHex("#888888")}
								zIndex={12}
							/>
							<textlabel
								key="Label"
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text="Request"
								TextColor3={
									queueTab === "request" ? Color3.fromHex("#000000") : Color3.fromHex("#888888")
								}
								Font={queueTab === "request" ? Fonts.Bold : Fonts.Medium}
								TextSize={11}
								ZIndex={12}
							/>
						</textbutton>
					</frame>

					{/* Tab Content Area */}
					{queueTab === "queue" ? (
						/* Tab 1 Content: Queue List & Empty State */
						<scrollingframe
							key="QueueScroll"
							Position={new UDim2(0, 0, 0, 52)}
							Size={new UDim2(1, 0, 1, -52)}
							BackgroundTransparency={1}
							ScrollBarThickness={2}
							ScrollBarImageColor3={Color3.fromHex("#333333")}
							CanvasSize={new UDim2(0, 0, 0, 0)}
							AutomaticCanvasSize={Enum.AutomaticSize.Y}
							ZIndex={10}
						>
							<uilistlayout Padding={new UDim(0, 8)} SortOrder={Enum.SortOrder.LayoutOrder} />
							<uipadding
								PaddingTop={new UDim(0, 8)}
								PaddingBottom={new UDim(0, 20)}
								PaddingLeft={new UDim(0, 14)}
								PaddingRight={new UDim(0, 14)}
							/>

							{queue.size() === 0 ? (
								/* Empty State */
								<frame
									key="EmptyState"
									Size={new UDim2(1, 0, 0, 260)}
									BackgroundTransparency={1}
									ZIndex={11}
								>
									<uilistlayout
										HorizontalAlignment={Enum.HorizontalAlignment.Center}
										VerticalAlignment={Enum.VerticalAlignment.Center}
										Padding={new UDim(0, 10)}
									/>
									<frame
										key="IconWrapper"
										Size={new UDim2(0, 54, 0, 54)}
										BackgroundColor3={Color3.fromHex("#181818")}
										ZIndex={12}
									>
										<uicorner CornerRadius={new UDim(1, 0)} />
										<uistroke Color={Color3.fromHex("#282828")} Thickness={1} />
										<LucideIcon
											name="list-music"
											size={new UDim2(0, 26, 0, 26)}
											anchorPoint={new Vector2(0.5, 0.5)}
											position={new UDim2(0.5, 0, 0.5, 0)}
											color={Color3.fromHex("#555555")}
											zIndex={13}
										/>
									</frame>

									<textlabel
										key="EmptyTitle"
										BackgroundTransparency={1}
										AutomaticSize={Enum.AutomaticSize.XY}
										Text="Queue is Empty"
										TextColor3={Color3.fromHex("#ffffff")}
										Font={Fonts.Bold}
										TextSize={14}
										ZIndex={12}
									/>

									<textlabel
										key="EmptySubtitle"
										Size={new UDim2(0.85, 0, 0, 32)}
										BackgroundTransparency={1}
										Text="Choose a song from the catalog or enter a Sound ID"
										TextColor3={Color3.fromHex("#777777")}
										Font={Fonts.Regular}
										TextSize={11}
										TextWrapped={true}
										ZIndex={12}
									/>

									<textbutton
										key="AddRequestCTA"
										Size={new UDim2(0, 136, 0, 36)}
										BackgroundColor3={Color3.fromHex("#ffffff")}
										Text=""
										AutoButtonColor={false}
										ZIndex={12}
										Event={{
											Activated: () => setQueueTab("request"),
										}}
									>
										<uicorner CornerRadius={new UDim(0, 18)} />
										<uilistlayout
											FillDirection={Enum.FillDirection.Horizontal}
											HorizontalAlignment={Enum.HorizontalAlignment.Center}
											VerticalAlignment={Enum.VerticalAlignment.Center}
											Padding={new UDim(0, 6)}
										/>
										<LucideIcon
											name="plus"
											size={new UDim2(0, 14, 0, 14)}
											color={Color3.fromHex("#000000")}
											zIndex={13}
										/>
										<textlabel
											key="CTAText"
											BackgroundTransparency={1}
											AutomaticSize={Enum.AutomaticSize.XY}
											Text="Request"
											TextColor3={Color3.fromHex("#000000")}
											Font={Fonts.Bold}
											TextSize={12}
											ZIndex={13}
										/>
									</textbutton>
								</frame>
							) : (
								/* Queue Active List */
								<>
									<textlabel
										key="QueueSectionHeader"
										LayoutOrder={0}
										Size={new UDim2(1, 0, 0, 20)}
										BackgroundTransparency={1}
										Text={`LAGU MENDATANG (${queue.size()})`}
										TextColor3={Color3.fromHex("#888888")}
										Font={Fonts.Bold}
										TextSize={11}
										TextXAlignment={Enum.TextXAlignment.Left}
										ZIndex={11}
									/>
									{queue.map((item, idx) => (
										<frame
											key={`queue_${item.track.id ?? idx}`}
											LayoutOrder={idx + 1}
											Size={new UDim2(1, 0, 0, 52)}
											BackgroundColor3={Color3.fromHex("#141414")}
											ZIndex={11}
										>
											<uicorner CornerRadius={new UDim(0, 8)} />
											<uistroke Color={Color3.fromHex("#222222")} Thickness={1} />
											<textlabel
												key="Num"
												Position={new UDim2(0, 10, 0.5, -8)}
												Size={new UDim2(0, 18, 0, 16)}
												BackgroundTransparency={1}
												Text={tostring(idx + 1)}
												TextColor3={Color3.fromHex("#666666")}
												Font={Fonts.Bold}
												TextSize={12}
												ZIndex={12}
											/>
											<frame
												key="Thumb"
												Position={new UDim2(0, 32, 0.5, -16)}
												Size={new UDim2(0, 32, 0, 32)}
												BackgroundColor3={item.track.coverColor ?? Color3.fromHex("#1f1f1f")}
												ZIndex={12}
											>
												<uicorner CornerRadius={new UDim(0, 6)} />
												<LucideIcon
													name="disc-3"
													size={new UDim2(0, 16, 0, 16)}
													anchorPoint={new Vector2(0.5, 0.5)}
													position={new UDim2(0.5, 0, 0.5, 0)}
													color={Color3.fromHex("#ffffff")}
													zIndex={13}
												/>
											</frame>
											<textlabel
												key="Title"
												Position={new UDim2(0, 72, 0, 9)}
												Size={new UDim2(1, -150, 0, 16)}
												BackgroundTransparency={1}
												Text={item.track.title}
												TextColor3={Color3.fromHex("#ffffff")}
												Font={Fonts.Bold}
												TextSize={12}
												TextTruncate={Enum.TextTruncate.AtEnd}
												TextXAlignment={Enum.TextXAlignment.Left}
												ZIndex={12}
											/>
											<textlabel
												key="Subtext"
												Position={new UDim2(0, 72, 0, 27)}
												Size={new UDim2(1, -150, 0, 14)}
												BackgroundTransparency={1}
												Text={`${item.track.artist} • @${item.requestedBy}`}
												TextColor3={Color3.fromHex("#777777")}
												Font={Fonts.Regular}
												TextSize={10}
												TextTruncate={Enum.TextTruncate.AtEnd}
												TextXAlignment={Enum.TextXAlignment.Left}
												ZIndex={12}
											/>

											{/* Admin: Remove Queue Item | Player: Vote Skip */}
											{isAdmin ? (
												<textbutton
													key="RemoveQueueBtn"
													AnchorPoint={new Vector2(1, 0.5)}
													Position={new UDim2(1, -8, 0.5, 0)}
													Size={new UDim2(0, 68, 0, 28)}
													BackgroundColor3={Color3.fromHex("#261212")}
													Text=""
													AutoButtonColor={false}
													ZIndex={12}
													Event={{
														Activated: () => handleRemoveQueue(idx),
													}}
												>
													<uicorner CornerRadius={new UDim(0, 6)} />
													<uistroke Color={Color3.fromHex("#451a1a")} Thickness={1} />
													<uilistlayout
														FillDirection={Enum.FillDirection.Horizontal}
														HorizontalAlignment={Enum.HorizontalAlignment.Center}
														VerticalAlignment={Enum.VerticalAlignment.Center}
														Padding={new UDim(0, 4)}
													/>
													<LucideIcon
														name="trash-2"
														size={new UDim2(0, 11, 0, 11)}
														color={Color3.fromHex("#e04545")}
														zIndex={13}
													/>
													<textlabel
														key="RemoveLabel"
														BackgroundTransparency={1}
														AutomaticSize={Enum.AutomaticSize.XY}
														Text="Hapus"
														TextColor3={Color3.fromHex("#e04545")}
														Font={Fonts.Bold}
														TextSize={10}
														ZIndex={13}
													/>
												</textbutton>
											) : (
												<textbutton
													key="VoteSkipBtn"
													AnchorPoint={new Vector2(1, 0.5)}
													Position={new UDim2(1, -8, 0.5, 0)}
													Size={new UDim2(0, 64, 0, 28)}
													BackgroundColor3={Color3.fromHex("#202020")}
													Text=""
													AutoButtonColor={false}
													ZIndex={12}
													Event={{
														Activated: () => handleVoteSkip(idx),
													}}
												>
													<uicorner CornerRadius={new UDim(0, 6)} />
													<uistroke Color={Color3.fromHex("#303030")} Thickness={1} />
													<uilistlayout
														FillDirection={Enum.FillDirection.Horizontal}
														HorizontalAlignment={Enum.HorizontalAlignment.Center}
														VerticalAlignment={Enum.VerticalAlignment.Center}
														Padding={new UDim(0, 4)}
													/>
													<LucideIcon
														name="skip-forward"
														size={new UDim2(0, 11, 0, 11)}
														color={Color3.fromHex("#aaaaaa")}
														zIndex={13}
													/>
													<textlabel
														key="SkipLabel"
														BackgroundTransparency={1}
														AutomaticSize={Enum.AutomaticSize.XY}
														Text={
															item.voteSkipUserIds.size() > 0
																? `Skip (${item.voteSkipUserIds.size()})`
																: "Skip"
														}
														TextColor3={Color3.fromHex("#cccccc")}
														Font={Fonts.Bold}
														TextSize={10}
														ZIndex={13}
													/>
												</textbutton>
											)}
										</frame>
									))}
								</>
							)}
						</scrollingframe>
					) : (
						/* Tab 2 Content: Request Song Form & Catalog */
						<scrollingframe
							key="RequestScroll"
							Position={new UDim2(0, 0, 0, 52)}
							Size={new UDim2(1, 0, 1, -52)}
							BackgroundTransparency={1}
							ScrollBarThickness={2}
							ScrollBarImageColor3={Color3.fromHex("#333333")}
							CanvasSize={new UDim2(0, 0, 0, 0)}
							AutomaticCanvasSize={Enum.AutomaticSize.Y}
							ZIndex={10}
						>
							<uilistlayout Padding={new UDim(0, 10)} SortOrder={Enum.SortOrder.LayoutOrder} />
							<uipadding
								PaddingTop={new UDim(0, 8)}
								PaddingBottom={new UDim(0, 20)}
								PaddingLeft={new UDim(0, 14)}
								PaddingRight={new UDim(0, 14)}
							/>

							{/* Custom Sound ID Input Card */}
							<frame
								key="CustomIdSection"
								LayoutOrder={1}
								Size={new UDim2(1, 0, 0, 72)}
								BackgroundColor3={Color3.fromHex("#141414")}
								ZIndex={11}
							>
								<uicorner CornerRadius={new UDim(0, 10)} />
								<uistroke Color={Color3.fromHex("#242424")} Thickness={1} />
								<uipadding
									PaddingTop={new UDim(0, 8)}
									PaddingBottom={new UDim(0, 8)}
									PaddingLeft={new UDim(0, 10)}
									PaddingRight={new UDim(0, 10)}
								/>

								<textlabel
									key="CustomTitle"
									Position={new UDim2(0, 0, 0, 0)}
									Size={new UDim2(1, 0, 0, 16)}
									BackgroundTransparency={1}
									Text="REQUEST CUSTOM ROBLOX SOUND ID"
									TextColor3={Color3.fromHex("#888888")}
									Font={Fonts.Bold}
									TextSize={10}
									TextXAlignment={Enum.TextXAlignment.Left}
									ZIndex={12}
								/>

								{/* Input Field Row */}
								<frame
									key="InputRow"
									Position={new UDim2(0, 0, 0, 22)}
									Size={new UDim2(1, 0, 0, 34)}
									BackgroundColor3={Color3.fromHex("#1e1e1e")}
									ZIndex={12}
								>
									<uicorner CornerRadius={new UDim(0, 7)} />
									<uistroke Color={Color3.fromHex("#2e2e2e")} Thickness={1} />

									<textbox
										key="SoundInput"
										Position={new UDim2(0, 10, 0, 0)}
										Size={new UDim2(1, -78, 1, 0)}
										BackgroundTransparency={1}
										PlaceholderText="e.g: 84728418466129"
										PlaceholderColor3={Color3.fromHex("#555555")}
										Text={customSoundId}
										TextColor3={Color3.fromHex("#ffffff")}
										Font={Fonts.Medium}
										TextSize={12}
										ClearTextOnFocus={false}
										TextXAlignment={Enum.TextXAlignment.Left}
										ZIndex={13}
										Event={{
											FocusLost: (rbx) => setCustomSoundId(rbx.Text),
										}}
									/>

									<textbutton
										key="SubmitBtn"
										AnchorPoint={new Vector2(1, 0.5)}
										Position={new UDim2(1, -4, 0.5, 0)}
										Size={new UDim2(0, 60, 0, 26)}
										BackgroundColor3={
											customSoundId.size() > 0
												? Color3.fromHex("#ffffff")
												: Color3.fromHex("#2a2a2a")
										}
										Text=""
										AutoButtonColor={false}
										ZIndex={13}
										Active={!isSubmitting}
										Event={{
											Activated: handleRequestCustomSong,
										}}
									>
										<uicorner CornerRadius={new UDim(0, 5)} />
										<textlabel
											key="BtnLabel"
											BackgroundTransparency={1}
											Size={new UDim2(1, 0, 1, 0)}
											Text={isSubmitting ? "..." : "Submit"}
											TextColor3={
												customSoundId.size() > 0
													? Color3.fromHex("#000000")
													: Color3.fromHex("#666666")
											}
											Font={Fonts.Bold}
											TextSize={11}
											ZIndex={14}
										/>
									</textbutton>
								</frame>
							</frame>

							{/* Recommended Catalog Section */}
							<textlabel
								key="CatalogHeader"
								LayoutOrder={2}
								Size={new UDim2(1, 0, 0, 18)}
								BackgroundTransparency={1}
								Text={searchQuery !== "" ? `Songs List (${filteredPlaylist.size()})` : "Songs List"}
								TextColor3={Color3.fromHex("#888888")}
								Font={Fonts.Bold}
								TextSize={11}
								TextXAlignment={Enum.TextXAlignment.Left}
								ZIndex={11}
							/>

							{/* Search Bar */}
							<frame
								key="SearchWrapper"
								LayoutOrder={3}
								Size={new UDim2(1, 0, 0, 36)}
								BackgroundColor3={Color3.fromHex("#161616")}
								ZIndex={11}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
								<uistroke Color={Color3.fromHex("#262626")} Thickness={1} />
								<LucideIcon
									name="search"
									size={new UDim2(0, 14, 0, 14)}
									position={new UDim2(0, 10, 0.5, -7)}
									color={Color3.fromHex("#666666")}
									zIndex={12}
								/>
								<textbox
									key="SearchInput"
									Position={new UDim2(0, 32, 0, 0)}
									Size={new UDim2(1, -64, 1, 0)}
									BackgroundTransparency={1}
									PlaceholderText="Search song or artist..."
									PlaceholderColor3={Color3.fromHex("#555555")}
									Text={searchQuery}
									TextColor3={Color3.fromHex("#ffffff")}
									Font={Fonts.Regular}
									TextSize={12}
									ClearTextOnFocus={false}
									TextXAlignment={Enum.TextXAlignment.Left}
									ZIndex={12}
									Change={{
										Text: (rbx) => setSearchQuery(rbx.Text),
									}}
								/>
								{searchQuery.size() > 0 && (
									<textbutton
										key="ClearSearchBtn"
										AnchorPoint={new Vector2(1, 0.5)}
										Position={new UDim2(1, -8, 0.5, 0)}
										Size={new UDim2(0, 20, 0, 20)}
										BackgroundTransparency={1}
										Text=""
										ZIndex={13}
										Event={{
											Activated: () => setSearchQuery(""),
										}}
									>
										<LucideIcon
											name="x"
											size={new UDim2(0, 14, 0, 14)}
											anchorPoint={new Vector2(0.5, 0.5)}
											position={new UDim2(0.5, 0, 0.5, 0)}
											color={Color3.fromHex("#888888")}
											zIndex={14}
										/>
									</textbutton>
								)}
							</frame>

							{filteredPlaylist.size() === 0 ? (
								<frame
									key="NoSongsFound"
									LayoutOrder={4}
									Size={new UDim2(1, 0, 0, 70)}
									BackgroundTransparency={1}
									ZIndex={11}
								>
									<uilistlayout
										HorizontalAlignment={Enum.HorizontalAlignment.Center}
										VerticalAlignment={Enum.VerticalAlignment.Center}
										Padding={new UDim(0, 4)}
									/>
									<textlabel
										key="NoFoundTitle"
										BackgroundTransparency={1}
										AutomaticSize={Enum.AutomaticSize.XY}
										Text="No songs found"
										TextColor3={Color3.fromHex("#777777")}
										Font={Fonts.Medium}
										TextSize={12}
										ZIndex={12}
									/>
									<textlabel
										key="NoFoundSub"
										BackgroundTransparency={1}
										AutomaticSize={Enum.AutomaticSize.XY}
										Text="Try searching another title or artist"
										TextColor3={Color3.fromHex("#555555")}
										Font={Fonts.Regular}
										TextSize={10}
										ZIndex={12}
									/>
								</frame>
							) : (
								filteredPlaylist.map((track, idx) => (
									<frame
										key={`catalog_${track.id ?? idx}`}
										LayoutOrder={idx + 4}
										Size={new UDim2(1, 0, 0, 50)}
										BackgroundColor3={Color3.fromHex("#141414")}
										ZIndex={11}
									>
									<uicorner CornerRadius={new UDim(0, 8)} />
									<uistroke Color={Color3.fromHex("#222222")} Thickness={1} />
									<frame
										key="Thumb"
										Position={new UDim2(0, 10, 0.5, -16)}
										Size={new UDim2(0, 32, 0, 32)}
										BackgroundColor3={track.coverColor ?? Color3.fromHex("#1f1f1f")}
										ZIndex={12}
									>
										<uicorner CornerRadius={new UDim(0, 6)} />
										<LucideIcon
											name="disc-3"
											size={new UDim2(0, 16, 0, 16)}
											anchorPoint={new Vector2(0.5, 0.5)}
											position={new UDim2(0.5, 0, 0.5, 0)}
											color={Color3.fromHex("#ffffff")}
											zIndex={13}
										/>
									</frame>

									<textlabel
										key="Title"
										Position={new UDim2(0, 50, 0, 8)}
										Size={new UDim2(1, -135, 0, 16)}
										BackgroundTransparency={1}
										Text={track.title}
										TextColor3={Color3.fromHex("#ffffff")}
										Font={Fonts.Bold}
										TextSize={12}
										TextTruncate={Enum.TextTruncate.AtEnd}
										TextXAlignment={Enum.TextXAlignment.Left}
										ZIndex={12}
									/>

									<textlabel
										key="Artist"
										Position={new UDim2(0, 50, 0, 26)}
										Size={new UDim2(1, -135, 0, 14)}
										BackgroundTransparency={1}
										Text={track.artist}
										TextColor3={Color3.fromHex("#777777")}
										Font={Fonts.Regular}
										TextSize={10}
										TextTruncate={Enum.TextTruncate.AtEnd}
										TextXAlignment={Enum.TextXAlignment.Left}
										ZIndex={12}
									/>

									{/* Request Button */}
									<textbutton
										key="RequestBtn"
										AnchorPoint={new Vector2(1, 0.5)}
										Position={new UDim2(1, -8, 0.5, 0)}
										Size={new UDim2(0, 72, 0, 28)}
										BackgroundColor3={Color3.fromHex("#222222")}
										Text=""
										AutoButtonColor={false}
										ZIndex={12}
										Active={!isSubmitting}
										Event={{
											Activated: () => handleRequestTrack(track),
										}}
									>
										<uicorner CornerRadius={new UDim(0, 6)} />
										<uistroke Color={Color3.fromHex("#333333")} Thickness={1} />
										<uilistlayout
											FillDirection={Enum.FillDirection.Horizontal}
											HorizontalAlignment={Enum.HorizontalAlignment.Center}
											VerticalAlignment={Enum.VerticalAlignment.Center}
											Padding={new UDim(0, 4)}
										/>
										<LucideIcon
											name="plus"
											size={new UDim2(0, 12, 0, 12)}
											color={Color3.fromHex("#ffffff")}
											zIndex={13}
										/>
										<textlabel
											key="RequestLabel"
											BackgroundTransparency={1}
											AutomaticSize={Enum.AutomaticSize.XY}
											Text="Request"
											TextColor3={Color3.fromHex("#ffffff")}
											Font={Fonts.Bold}
											TextSize={11}
											ZIndex={13}
										/>
									</textbutton>
								</frame>
							)))}
						</scrollingframe>
					)}
				</frame>
			)}
		</frame>
	);
}

/**
 * iOS-styled Music Player App.
 * Migrated to React TSX declarative renderer.
 */
export class MusicApp {
	private hostInstance: GuiObject;
	private root: Root;
	private visible = false;
	private onBackCallbacks: Array<() => void> = [];

	constructor(parent: GuiObject) {
		this.hostInstance = parent;
		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	private render(): void {
		this.root.render(
			<MusicComponent
				visible={this.visible}
				onBack={() => {
					for (const cb of this.onBackCallbacks) cb();
				}}
			/>,
		);
	}

	public onBack(cb: () => void): void {
		this.onBackCallbacks.push(cb);
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
