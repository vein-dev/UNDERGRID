import React, { useEffect, useRef, useState } from "@rbxts/react";
import { Players, UserInputService } from "@rbxts/services";
import { useInterval } from "client/ui/hooks/useInterval";
import { getPlayerPerformerStatus } from "shared/utils";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";
import {
	StageCameraController,
	StageCameraMode,
	StageCameraShake,
	StageCameraState,
} from "client/controllers/StageCameraController";

export function StageCameraTab() {
	const cameraController = StageCameraController.getInstance();
	const [camState, setCamState] = useState<StageCameraState>(() => cameraController.getState());
	const [playersList, setPlayersList] = useState<Player[]>(() => Players.GetPlayers());
	const [isDistanceDragging, setIsDistanceDragging] = useState(false);
	const [, setRefreshTick] = useState(0);
	const distanceTrackRef = useRef<Frame>();

	// Sinkronisasi status instrumen musik pemain secara berkala
	useInterval(() => {
		setRefreshTick((prev) => prev + 1);
	}, 0.8);

	// Listen to Camera State updates
	useEffect(() => {
		const cleanup = cameraController.onStateChanged((newState) => {
			setCamState(newState);
		});
		return cleanup;
	}, []);

	// Keep Players list updated
	useEffect(() => {
		const addedConn = Players.PlayerAdded.Connect(() => {
			setPlayersList(Players.GetPlayers());
		});
		const removedConn = Players.PlayerRemoving.Connect(() => {
			setPlayersList(Players.GetPlayers());
		});
		return () => {
			addedConn.Disconnect();
			removedConn.Disconnect();
		};
	}, []);

	// Distance slider input handling
	const updateDistance = (inputX: number) => {
		const track = distanceTrackRef.current;
		if (!track) return;
		const trackX = track.AbsolutePosition.X;
		const trackWidth = track.AbsoluteSize.X;
		if (trackWidth <= 0) return;

		const ratio = math.clamp((inputX - trackX) / trackWidth, 0, 1);
		// Range: 2.0 to 8.0 studs
		const dist = math.floor((2.0 + ratio * 6.0) * 10 + 0.5) / 10;
		cameraController.setFaceDistance(dist);
	};

	useEffect(() => {
		if (!isDistanceDragging) return;

		const moveConn = UserInputService.InputChanged.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseMovement ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				updateDistance(input.Position.X);
			}
		});

		const endConn = UserInputService.InputEnded.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseButton1 ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				setIsDistanceDragging(false);
				updateDistance(input.Position.X);
			}
		});

		return () => {
			moveConn.Disconnect();
			endConn.Disconnect();
		};
	}, [isDistanceDragging]);

	// Urutkan pemain: Penampil (Gitaris & Drummer) di atas, lalu LocalPlayer, lalu penonton lainnya
	const sortedPlayersList = [...playersList].sort((a, b) => {
		const statusA = getPlayerPerformerStatus(a);
		const statusB = getPlayerPerformerStatus(b);
		if (statusA.isPerforming !== statusB.isPerforming) {
			return statusA.isPerforming;
		}
		if (a === Players.LocalPlayer) return true;
		if (b === Players.LocalPlayer) return false;
		return a.DisplayName.lower() < b.DisplayName.lower();
	});

	const currentTargetPlayer = camState.targetUserId !== undefined
		? Players.GetPlayerByUserId(camState.targetUserId)
		: undefined;

	const targetLabel = currentTargetPlayer
		? `${currentTargetPlayer.DisplayName} (@${currentTargetPlayer.Name})`
		: "Diri Sendiri (LocalPlayer)";

	const distanceRatio = math.clamp((camState.faceDistance - 2.0) / 6.0, 0, 1);

	return (
		<>
			{/* ───────── 1. STATUS CARD & BROADCAST INDICATOR ───────── */}
			<frame
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 76)}
				BackgroundColor3={Color3.fromHex("#111827")}
				BackgroundTransparency={0.3}
			>
				<uicorner CornerRadius={new UDim(0, 10)} />
				<uistroke Color={Color3.fromHex("#3b82f6")} Transparency={0.7} Thickness={1} />
				<uipadding
					PaddingLeft={new UDim(0, 12)}
					PaddingRight={new UDim(0, 12)}
					PaddingTop={new UDim(0, 7)}
					PaddingBottom={new UDim(0, 7)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					SortOrder={Enum.SortOrder.LayoutOrder}
					Padding={new UDim(0, 4)}
				/>
				<frame Size={new UDim2(1, 0, 0, 16)} BackgroundTransparency={1}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						SortOrder={Enum.SortOrder.LayoutOrder}
						Padding={new UDim(0, 6)}
					/>
					<frame
						Size={new UDim2(0, 8, 0, 8)}
						BackgroundColor3={camState.mode !== "default" ? Color3.fromHex("#10b981") : Color3.fromHex("#6b7280")}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
					</frame>
					<textlabel
						Size={new UDim2(1, -20, 1, 0)}
						BackgroundTransparency={1}
						Text={`MODE: ${camState.mode.upper()}  •  SHAKE: ${camState.shake.upper()}`}
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Bold}
						TextSize={10}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
				</frame>
				<textlabel
					Size={new UDim2(1, 0, 0, 15)}
					BackgroundTransparency={1}
					Text={
						camState.mode === "fixed_cam"
							? `Panggung: CamStage (CAM ${camState.fixedCamIndex ?? 1})  •  FOV: ${camState.fov}°`
							: `Target: ${targetLabel}  •  FOV: ${camState.fov}°`
					}
					TextColor3={Color3.fromHex("#cbd5e1")}
					Font={Fonts.Medium}
					TextSize={10}
					TextXAlignment={Enum.TextXAlignment.Left}
					TextTruncate={Enum.TextTruncate.AtEnd}
				/>
				{/* Broadcast to all clients toggle */}
				<textbutton
					Size={new UDim2(1, 0, 0, 26)}
					BackgroundColor3={camState.broadcastEnabled ? Color3.fromHex("#065f46") : Color3.fromHex("#374151")}
					BackgroundTransparency={0.2}
					Text=""
					AutoButtonColor={true}
					Event={{
						MouseButton1Click: () => {
							cameraController.setBroadcastEnabled(!camState.broadcastEnabled);
						},
					}}
				>
					<uicorner CornerRadius={new UDim(0, 6)} />
					<uistroke
						Color={camState.broadcastEnabled ? Color3.fromHex("#34d399") : Color3.fromHex("#6b7280")}
						Transparency={0.4}
						Thickness={1.2}
					/>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 6)}
					/>
					<LucideIcon
						name="radio"
						size={UDim2.fromOffset(12, 12)}
						color={camState.broadcastEnabled ? Color3.fromHex("#34d399") : Color3.fromHex("#9ca3af")}
					/>
					<textlabel
						Size={new UDim2(0, 220, 1, 0)}
						BackgroundTransparency={1}
						Text={camState.broadcastEnabled ? "SIARKAN KE SEMUA CLIENT (LIVE)" : "SIARAN DIMATIKAN (HANYA SAYA)"}
						TextColor3={camState.broadcastEnabled ? Color3.fromHex("#ecfdf5") : Color3.fromHex("#f3f4f6")}
						Font={Fonts.Bold}
						TextSize={10}
					/>
				</textbutton>
			</frame>

			{/* ───────── 2. FOKUS PEMAIN & VIEW DEPAN MUKA ───────── */}
			<frame LayoutOrder={2} Size={new UDim2(1, 0, 0, 18)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 6)}
				/>
				<LucideIcon name="users" size={UDim2.fromOffset(14, 14)} color={Color3.fromHex("#94a3b8")} />
				<textlabel
					Size={new UDim2(1, -20, 1, 0)}
					BackgroundTransparency={1}
					Text="SOROT PEMAIN (STAGE FOCUS)"
					TextColor3={Color3.fromHex("#e2e8f0")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
			</frame>

			{/* Player Selection 2-Column Grid with Vertical Scroll */}
			<scrollingframe
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 114)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ScrollBarThickness={2.5}
				ScrollBarImageColor3={Color3.fromHex("#4b5563")}
				CanvasSize={new UDim2(0, 0, 0, 0)}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
			>
				<uigridlayout
					CellSize={new UDim2(0.5, -4, 0, 46)}
					CellPadding={new UDim2(0, 8, 0, 6)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{sortedPlayersList.map((player, idx) => {
					const isTarget = camState.targetUserId === player.UserId;
					const isMe = player === Players.LocalPlayer;
					const status = getPlayerPerformerStatus(player);

					return (
						<textbutton
							key={`player_${player.UserId}`}
							LayoutOrder={idx}
							BackgroundColor3={
								isTarget
									? Color3.fromHex("#2563eb")
									: status.isPerforming
									? Color3.fromHex(status.bgColor)
									: Color3.fromHex("#1f2937")
							}
							BackgroundTransparency={isTarget ? 0.15 : status.isPerforming ? 0.25 : 0.45}
							Text=""
							AutoButtonColor={true}
							Event={{
								MouseButton1Click: () => {
									cameraController.setTargetPlayer(player.UserId);
								},
							}}
						>
							<uicorner CornerRadius={new UDim(0, 8)} />
							<uistroke
								Color={
									isTarget
										? Color3.fromHex("#60a5fa")
										: status.isPerforming
										? Color3.fromHex(status.strokeColor)
										: Color3.fromHex("#374151")
								}
								Transparency={isTarget ? 0.2 : status.isPerforming ? 0.25 : 0.6}
								Thickness={isTarget ? 1.5 : status.isPerforming ? 1.4 : 1}
							/>
							<uipadding
								PaddingLeft={new UDim(0, 7)}
								PaddingRight={new UDim(0, 7)}
								PaddingTop={new UDim(0, 4)}
								PaddingBottom={new UDim(0, 4)}
							/>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 7)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>

							{/* Icon or Performer Badge Icon */}
							<frame
								LayoutOrder={1}
								Size={new UDim2(0, 24, 0, 24)}
								BackgroundColor3={
									status.isPerforming
										? Color3.fromHex(status.badgeColor)
										: Color3.fromHex("#374151")
								}
								BackgroundTransparency={status.isPerforming ? 0.2 : 0.5}
							>
								<uicorner CornerRadius={new UDim(0, 6)} />
								<LucideIcon
									name={status.isPerforming ? status.iconName : "user"}
									size={UDim2.fromOffset(13, 13)}
									color={
										status.isPerforming
											? Color3.fromRGB(255, 255, 255)
											: Color3.fromHex("#94a3b8")
									}
								/>
							</frame>

							{/* Player Info (Name & Subtext/Role) */}
							<frame LayoutOrder={2} Size={new UDim2(1, -31, 1, 0)} BackgroundTransparency={1}>
								<uilistlayout
									FillDirection={Enum.FillDirection.Vertical}
									VerticalAlignment={Enum.VerticalAlignment.Center}
									SortOrder={Enum.SortOrder.LayoutOrder}
								/>
								<textlabel
									LayoutOrder={1}
									Size={new UDim2(1, 0, 0, 15)}
									BackgroundTransparency={1}
									Text={`${player.DisplayName}${isMe ? " (You)" : ""}`}
									TextColor3={Color3.fromHex("#ffffff")}
									Font={Fonts.Bold}
									TextSize={10}
									TextXAlignment={Enum.TextXAlignment.Left}
									TextTruncate={Enum.TextTruncate.AtEnd}
								/>
								{status.isPerforming ? (
									<frame LayoutOrder={2} Size={new UDim2(1, 0, 0, 13)} BackgroundTransparency={1}>
										<uilistlayout
											FillDirection={Enum.FillDirection.Horizontal}
											VerticalAlignment={Enum.VerticalAlignment.Center}
											Padding={new UDim(0, 4)}
										/>
										<textlabel
											Size={new UDim2(1, 0, 1, 0)}
											BackgroundTransparency={1}
											Text={status.role === "guitarist" ? "★ GUITARIST" : "★ DRUMMER"}
											TextColor3={Color3.fromHex(status.badgeColor)}
											Font={Fonts.Bold}
											TextSize={8.5}
											TextXAlignment={Enum.TextXAlignment.Left}
											TextTruncate={Enum.TextTruncate.AtEnd}
										/>
									</frame>
								) : (
									<textlabel
										LayoutOrder={2}
										Size={new UDim2(1, 0, 0, 13)}
										BackgroundTransparency={1}
										Text={`@${player.Name}`}
										TextColor3={Color3.fromHex("#94a3b8")}
										Font={Fonts.Regular}
										TextSize={9}
										TextXAlignment={Enum.TextXAlignment.Left}
										TextTruncate={Enum.TextTruncate.AtEnd}
									/>
								)}
							</frame>
						</textbutton>
					);
				})}
			</scrollingframe>

			{/* Action: Focus Front Face View Button */}
			<frame LayoutOrder={4} Size={new UDim2(1, 0, 0, 38)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					SortOrder={Enum.SortOrder.LayoutOrder}
					Padding={new UDim(0, 8)}
				/>
				<textbutton
					LayoutOrder={1}
					Size={new UDim2(0.68, -4, 1, 0)}
					BackgroundColor3={camState.mode === "face" ? Color3.fromHex("#059669") : Color3.fromHex("#1f2937")}
					BackgroundTransparency={camState.mode === "face" ? 0.15 : 0.4}
					Text=""
					AutoButtonColor={true}
					Event={{
						MouseButton1Click: () => {
							if (camState.mode === "face") {
								cameraController.setMode("default");
							} else {
								cameraController.setMode("face");
							}
						},
					}}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uistroke
						Color={camState.mode === "face" ? Color3.fromHex("#34d399") : Color3.fromHex("#374151")}
						Transparency={camState.mode === "face" ? 0.3 : 0.7}
						Thickness={1}
					/>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 6)}
					/>
					<LucideIcon
						name="camera"
						size={UDim2.fromOffset(14, 14)}
						color={camState.mode === "face" ? Color3.fromHex("#ffffff") : Color3.fromHex("#10b981")}
					/>
					<textlabel
						Size={new UDim2(0, 130, 1, 0)}
						BackgroundTransparency={1}
						Text={camState.mode === "face" ? "DEPAN MUKA: AKTIF" : "SOROT DEPAN MUKA"}
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Bold}
						TextSize={10}
					/>
				</textbutton>

				<textbutton
					LayoutOrder={2}
					Size={new UDim2(0.32, -4, 1, 0)}
					BackgroundColor3={Color3.fromHex("#1f2937")}
					BackgroundTransparency={0.4}
					Text=""
					AutoButtonColor={true}
					Event={{
						MouseButton1Click: () => {
							cameraController.setTargetPlayer(Players.LocalPlayer.UserId);
						},
					}}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uistroke Color={Color3.fromHex("#374151")} Transparency={0.7} Thickness={1} />
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 4)}
					/>
					<LucideIcon name="user" size={UDim2.fromOffset(12, 12)} color={Color3.fromHex("#94a3b8")} />
					<textlabel
						Size={new UDim2(0, 50, 1, 0)}
						BackgroundTransparency={1}
						Text="Diri Sendiri"
						TextColor3={Color3.fromHex("#d1d5db")}
						Font={Fonts.Medium}
						TextSize={9}
					/>
				</textbutton>
			</frame>

			{/* Distance Slider for Face View */}
			<frame
				LayoutOrder={5}
				Size={new UDim2(1, 0, 0, 46)}
				BackgroundColor3={Color3.fromHex("#111827")}
				BackgroundTransparency={0.5}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				<uipadding
					PaddingLeft={new UDim(0, 10)}
					PaddingRight={new UDim(0, 10)}
					PaddingTop={new UDim(0, 6)}
					PaddingBottom={new UDim(0, 6)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					SortOrder={Enum.SortOrder.LayoutOrder}
					Padding={new UDim(0, 4)}
				/>
				<frame Size={new UDim2(1, 0, 0, 14)} BackgroundTransparency={1}>
					<uilistlayout FillDirection={Enum.FillDirection.Horizontal} VerticalAlignment={Enum.VerticalAlignment.Center} />
					<textlabel
						Size={new UDim2(1, -60, 1, 0)}
						BackgroundTransparency={1}
						Text="JARAK DEPAN WAJAH"
						TextColor3={Color3.fromHex("#94a3b8")}
						Font={Fonts.Bold}
						TextSize={9}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<textlabel
						Size={new UDim2(0, 60, 1, 0)}
						BackgroundTransparency={1}
						Text={`${camState.faceDistance} stud`}
						TextColor3={Color3.fromHex("#60a5fa")}
						Font={Fonts.Bold}
						TextSize={9}
						TextXAlignment={Enum.TextXAlignment.Right}
					/>
				</frame>

				{/* Distance Track */}
				<frame
					ref={distanceTrackRef}
					Size={new UDim2(1, 0, 0, 12)}
					BackgroundColor3={Color3.fromHex("#1f2937")}
					BackgroundTransparency={0.3}
				>
					<uicorner CornerRadius={new UDim(1, 0)} />
					<frame
						Size={new UDim2(distanceRatio, 0, 1, 0)}
						BackgroundColor3={Color3.fromHex("#3b82f6")}
						BorderSizePixel={0}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
					</frame>
					<textbutton
						Position={new UDim2(distanceRatio, -7, 0.5, -7)}
						Size={new UDim2(0, 14, 0, 14)}
						BackgroundColor3={Color3.fromHex("#ffffff")}
						BorderSizePixel={0}
						Text=""
						AutoButtonColor={false}
						ZIndex={3}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
					</textbutton>
					<textbutton
						Size={new UDim2(1, 0, 1, 0)}
						BackgroundTransparency={1}
						Text=""
						ZIndex={5}
						Event={{
							InputBegan: (_, input) => {
								if (
									input.UserInputType === Enum.UserInputType.MouseButton1 ||
									input.UserInputType === Enum.UserInputType.Touch
								) {
									setIsDistanceDragging(true);
									updateDistance(input.Position.X);
								}
							},
						}}
					/>
				</frame>
			</frame>

			{/* ───────── 3. STAGECAM RIG (CAM 1 - 7) ───────── */}
			<frame LayoutOrder={6} Size={new UDim2(1, 0, 0, 18)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 6)}
				/>
				<LucideIcon name="video" size={UDim2.fromOffset(14, 14)} color={Color3.fromHex("#60a5fa")} />
				<textlabel
					Size={new UDim2(1, -20, 1, 0)}
					BackgroundTransparency={1}
					Text="STAGECAM"
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
			</frame>

			{/* Grid of CAM 1 - 7 Buttons */}
			<frame LayoutOrder={7} Size={new UDim2(1, 0, 0, 72)} BackgroundTransparency={1}>
				<uigridlayout
					CellSize={new UDim2(0.25, -6, 0, 32)}
					CellPadding={new UDim2(0, 8, 0, 8)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{[1, 2, 3, 4, 5, 6, 7].map((num) => {
					const isActive = camState.mode === "fixed_cam" && camState.fixedCamIndex === num;
					return (
						<textbutton
							key={`stagecam_${num}`}
							LayoutOrder={num}
							BackgroundColor3={isActive ? Color3.fromHex("#2563eb") : Color3.fromHex("#1f2937")}
							BackgroundTransparency={isActive ? 0.15 : 0.3}
							Text=""
							AutoButtonColor={true}
							Event={{
								MouseButton1Click: () => {
									if (isActive) {
										cameraController.setMode("default");
									} else {
										cameraController.setFixedCam(num);
									}
								},
							}}
						>
							<uicorner CornerRadius={new UDim(0, 8)} />
							<uistroke
								Color={isActive ? Color3.fromHex("#60a5fa") : Color3.fromHex("#374151")}
								Transparency={isActive ? 0.2 : 0.6}
								Thickness={1.2}
							/>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								Padding={new UDim(0, 4)}
							/>
							<frame
								Size={new UDim2(0, 6, 0, 6)}
								BackgroundColor3={isActive ? Color3.fromHex("#60a5fa") : Color3.fromHex("#64748b")}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
							</frame>
							<textlabel
								Size={new UDim2(0, 44, 1, 0)}
								BackgroundTransparency={1}
								Text={`Cam ${num}`}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={isActive ? Fonts.Bold : Fonts.Medium}
								TextSize={10.5}
							/>
						</textbutton>
					);
				})}
				{/* 8th cell: Off button */}
				<textbutton
					LayoutOrder={8}
					BackgroundColor3={camState.mode === "fixed_cam" ? Color3.fromHex("#991b1b") : Color3.fromHex("#1f2937")}
					BackgroundTransparency={camState.mode === "fixed_cam" ? 0.2 : 0.5}
					Text=""
					AutoButtonColor={true}
					Event={{
						MouseButton1Click: () => {
							if (camState.mode === "fixed_cam") {
								cameraController.setMode("default");
							}
						},
					}}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uistroke
						Color={camState.mode === "fixed_cam" ? Color3.fromHex("#f87171") : Color3.fromHex("#374151")}
						Transparency={0.6}
						Thickness={1.2}
					/>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 4)}
					/>
					<textlabel
						Size={new UDim2(1, 0, 1, 0)}
						BackgroundTransparency={1}
						Text="Off"
						TextColor3={camState.mode === "fixed_cam" ? Color3.fromHex("#ffffff") : Color3.fromHex("#94a3b8")}
						Font={Fonts.Bold}
						TextSize={10.5}
					/>
				</textbutton>
			</frame>

			{/* ───────── 4. GERAKAN KAMERA SINEMATIK ───────── */}
			<frame LayoutOrder={8} Size={new UDim2(1, 0, 0, 18)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 6)}
				/>
				<LucideIcon name="film" size={UDim2.fromOffset(14, 14)} color={Color3.fromHex("#94a3b8")} />
				<textlabel
					Size={new UDim2(1, -20, 1, 0)}
					BackgroundTransparency={1}
					Text="GERAKAN SINEMATIK (CINEMATIC MOTION)"
					TextColor3={Color3.fromHex("#e2e8f0")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
			</frame>

			{/* Motion Preset Buttons */}
			<frame LayoutOrder={9} Size={new UDim2(1, 0, 0, 72)} BackgroundTransparency={1}>
				<uigridlayout
					CellSize={new UDim2(0.5, -4, 0, 32)}
					CellPadding={new UDim2(0, 8, 0, 8)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{(
					[
						{ id: "orbit", label: "360° Orbit Spin", icon: "rotate-cw" },
						{ id: "drone", label: "Drone / Crane", icon: "move" },
						{ id: "low_angle", label: "Low Stage Angle", icon: "arrow-up-right" },
						{ id: "default", label: "Normal / Static", icon: "square" },
					] as Array<{ id: StageCameraMode; label: string; icon: string }>
				).map((item, idx) => {
					const isActive = camState.mode === item.id;
					return (
						<textbutton
							key={`motion_${item.id}`}
							LayoutOrder={idx}
							BackgroundColor3={isActive ? Color3.fromHex("#7c3aed") : Color3.fromHex("#1f2937")}
							BackgroundTransparency={isActive ? 0.2 : 0.4}
							Text=""
							AutoButtonColor={true}
							Event={{
								MouseButton1Click: () => {
									cameraController.setMode(item.id);
								},
							}}
						>
							<uicorner CornerRadius={new UDim(0, 8)} />
							<uistroke
								Color={isActive ? Color3.fromHex("#a78bfa") : Color3.fromHex("#374151")}
								Transparency={isActive ? 0.3 : 0.7}
								Thickness={1}
							/>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 6)}
							/>
							<uipadding PaddingLeft={new UDim(0, 8)} PaddingRight={new UDim(0, 8)} />
							<LucideIcon
								name={item.icon}
								size={UDim2.fromOffset(13, 13)}
								color={isActive ? Color3.fromHex("#ffffff") : Color3.fromHex("#c4b5fd")}
							/>
							<textlabel
								Size={new UDim2(1, -22, 1, 0)}
								BackgroundTransparency={1}
								Text={item.label}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={isActive ? Fonts.Bold : Fonts.Medium}
								TextSize={10}
								TextXAlignment={Enum.TextXAlignment.Left}
								TextTruncate={Enum.TextTruncate.AtEnd}
							/>
						</textbutton>
					);
				})}
			</frame>

			{/* Orbit Speed Controls (only if mode === "orbit") */}
			{camState.mode === "orbit" && (
				<frame
					LayoutOrder={10}
					Size={new UDim2(1, 0, 0, 32)}
					BackgroundColor3={Color3.fromHex("#111827")}
					BackgroundTransparency={0.5}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uipadding
						PaddingLeft={new UDim(0, 10)}
						PaddingRight={new UDim(0, 10)}
						PaddingTop={new UDim(0, 4)}
						PaddingBottom={new UDim(0, 4)}
					/>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						SortOrder={Enum.SortOrder.LayoutOrder}
						Padding={new UDim(0, 6)}
					/>
					<textlabel
						Size={new UDim2(0, 75, 1, 0)}
						BackgroundTransparency={1}
						Text="Orbit Speed:"
						TextColor3={Color3.fromHex("#94a3b8")}
						Font={Fonts.Medium}
						TextSize={9}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					{[
						{ label: "Slow", speed: 0.3 },
						{ label: "Normal", speed: 0.6 },
						{ label: "Fast", speed: 1.2 },
					].map((spd, sIdx) => {
						const isSel = math.abs(camState.orbitSpeed - spd.speed) < 0.1;
						return (
							<textbutton
								key={`spd_${sIdx}`}
								LayoutOrder={sIdx}
								Size={new UDim2(0, 52, 0, 22)}
								BackgroundColor3={isSel ? Color3.fromHex("#7c3aed") : Color3.fromHex("#1f2937")}
								BackgroundTransparency={isSel ? 0.2 : 0.5}
								Text={spd.label}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={isSel ? Fonts.Bold : Fonts.Regular}
								TextSize={9}
								Event={{
									MouseButton1Click: () => cameraController.setOrbitSpeed(spd.speed),
								}}
							>
								<uicorner CornerRadius={new UDim(0, 6)} />
							</textbutton>
						);
					})}
				</frame>
			)}

			{/* ───────── 5. EFEK GLOBAL (CAMERA FX) ───────── */}
			<frame LayoutOrder={11} Size={new UDim2(1, 0, 0, 18)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 6)}
				/>
				<LucideIcon name="activity" size={UDim2.fromOffset(14, 14)} color={Color3.fromHex("#94a3b8")} />
				<textlabel
					Size={new UDim2(1, -20, 1, 0)}
					BackgroundTransparency={1}
					Text="EFEK GLOBAL (CAMERA FX)"
					TextColor3={Color3.fromHex("#e2e8f0")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
			</frame>

			<frame LayoutOrder={12} Size={new UDim2(1, 0, 0, 68)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					SortOrder={Enum.SortOrder.LayoutOrder}
					Padding={new UDim(0, 6)}
				/>
				{/* Row 1: Off, Handheld, Heartbeat */}
				<frame LayoutOrder={1} Size={new UDim2(1, 0, 0, 31)} BackgroundTransparency={1}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						SortOrder={Enum.SortOrder.LayoutOrder}
						Padding={new UDim(0, 6)}
					/>
					{(
						[
							{ id: "none", label: "Off" },
							{ id: "subtle", label: "Handheld" },
							{ id: "heartbeat", label: "Heartbeat" },
						] as Array<{ id: StageCameraShake; label: string }>
					).map((shk, sIdx) => {
						const isSel = camState.shake === shk.id;
						return (
							<textbutton
								key={`shake_${shk.id}`}
								LayoutOrder={sIdx}
								Size={new UDim2(0.333, -4, 1, 0)}
								BackgroundColor3={isSel ? Color3.fromHex("#ea580c") : Color3.fromHex("#1f2937")}
								BackgroundTransparency={isSel ? 0.2 : 0.4}
								Text={shk.label}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={isSel ? Fonts.Bold : Fonts.Medium}
								TextSize={10}
								Event={{
									MouseButton1Click: () => cameraController.setShake(shk.id),
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
								<uistroke
									Color={isSel ? Color3.fromHex("#fb923c") : Color3.fromHex("#374151")}
									Transparency={isSel ? 0.3 : 0.7}
									Thickness={1}
								/>
							</textbutton>
						);
					})}
				</frame>

				{/* Row 2: Mabuk / High, Beat Bump, Bass Drop */}
				<frame LayoutOrder={2} Size={new UDim2(1, 0, 0, 31)} BackgroundTransparency={1}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						SortOrder={Enum.SortOrder.LayoutOrder}
						Padding={new UDim(0, 6)}
					/>
					{(
						[
							{ id: "drunk", label: "Mabuk / High" },
							{ id: "beat", label: "Beat Bump" },
							{ id: "heavy", label: "Bass Drop" },
						] as Array<{ id: StageCameraShake; label: string }>
					).map((shk, sIdx) => {
						const isSel = camState.shake === shk.id;
						return (
							<textbutton
								key={`shake_${shk.id}`}
								LayoutOrder={sIdx}
								Size={new UDim2(0.333, -4, 1, 0)}
								BackgroundColor3={isSel ? Color3.fromHex("#ea580c") : Color3.fromHex("#1f2937")}
								BackgroundTransparency={isSel ? 0.2 : 0.4}
								Text={shk.label}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={isSel ? Fonts.Bold : Fonts.Medium}
								TextSize={10}
								Event={{
									MouseButton1Click: () => cameraController.setShake(shk.id),
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
								<uistroke
									Color={isSel ? Color3.fromHex("#fb923c") : Color3.fromHex("#374151")}
									Transparency={isSel ? 0.3 : 0.7}
									Thickness={1}
								/>
							</textbutton>
						);
					})}
				</frame>
			</frame>

			{/* ───────── 6. LENSA FOV PRESETS ───────── */}
			<frame LayoutOrder={13} Size={new UDim2(1, 0, 0, 18)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 6)}
				/>
				<LucideIcon name="maximize" size={UDim2.fromOffset(14, 14)} color={Color3.fromHex("#94a3b8")} />
				<textlabel
					Size={new UDim2(1, -20, 1, 0)}
					BackgroundTransparency={1}
					Text="LENSA SINEMATIK (FOV)"
					TextColor3={Color3.fromHex("#e2e8f0")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
			</frame>

			<frame LayoutOrder={14} Size={new UDim2(1, 0, 0, 30)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					SortOrder={Enum.SortOrder.LayoutOrder}
					Padding={new UDim(0, 6)}
				/>
				{[
					{ label: "Wide 85°", fov: 85 },
					{ label: "Normal 70°", fov: 70 },
					{ label: "Portrait 45°", fov: 45 },
					{ label: "Zoom 30°", fov: 30 },
				].map((fItem, fIdx) => {
					const isSel = math.abs(camState.fov - fItem.fov) < 2;
					return (
						<textbutton
							key={`fov_${fIdx}`}
							LayoutOrder={fIdx}
							Size={new UDim2(0.25, -5, 1, 0)}
							BackgroundColor3={isSel ? Color3.fromHex("#0284c7") : Color3.fromHex("#1f2937")}
							BackgroundTransparency={isSel ? 0.2 : 0.4}
							Text={fItem.label}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={isSel ? Fonts.Bold : Fonts.Medium}
							TextSize={10}
							Event={{
								MouseButton1Click: () => cameraController.setFov(fItem.fov),
							}}
						>
							<uicorner CornerRadius={new UDim(0, 8)} />
							<uistroke
								Color={isSel ? Color3.fromHex("#38bdf8") : Color3.fromHex("#374151")}
								Transparency={isSel ? 0.3 : 0.7}
								Thickness={1}
							/>
						</textbutton>
					);
				})}
			</frame>

			{/* ───────── 7. RESET TOTAL BUTTON ───────── */}
			<textbutton
				LayoutOrder={15}
				Size={new UDim2(1, 0, 0, 36)}
				BackgroundColor3={Color3.fromHex("#991b1b")}
				BackgroundTransparency={0.3}
				Text=""
				AutoButtonColor={true}
				Event={{
					MouseButton1Click: () => {
						cameraController.resetCamera();
					},
				}}
			>
				<uicorner CornerRadius={new UDim(0, 10)} />
				<uistroke Color={Color3.fromHex("#ef4444")} Transparency={0.5} Thickness={1} />
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					Padding={new UDim(0, 8)}
				/>
				<LucideIcon name="rotate-ccw" size={UDim2.fromOffset(14, 14)} color={Color3.fromHex("#ffffff")} />
				<textlabel
					Size={new UDim2(0, 190, 1, 0)}
					BackgroundTransparency={1}
					Text="RESET KAMERA DEFAULT ROBLOX"
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Bold}
					TextSize={10.5}
				/>
			</textbutton>
		</>
	);
}
