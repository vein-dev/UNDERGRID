import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, StarterGui, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { FreecamController, FreecamState } from "client/controllers/FreecamController";
import { EmoteModalView } from "./EmoteModalView";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export interface FreecamHudProps {
	visible: boolean;
	onClose?: () => void;
}

const ZOOM_PRESETS = [
	{ label: "0.5x", fov: 95 },
	{ label: "1x", fov: 70 },
	{ label: "2x", fov: 45 },
	{ label: "5x", fov: 25 },
];

const SPEED_PRESETS = [0.5, 1.0, 2.5];

export function FreecamHudComponent({ visible, onClose }: FreecamHudProps) {
	const controller = FreecamController.getInstance();
	const [state, setState] = useState<FreecamState>(() => controller.getState());


	// Virtual Thumbstick state
	const [isJoystickDragging, setIsJoystickDragging] = useState(false);
	const [joystickThumbOffset, setJoystickThumbOffset] = useState<Vector2>(Vector2.zero);
	const joystickCenterRef = useRef<Vector2>(new Vector2(100, 500));
	const joystickTouchIdRef = useRef<InputObject | undefined>(undefined);

	// Touch Pan Drag state
	const panTouchIdRef = useRef<InputObject | undefined>(undefined);
	const lastPanPosRef = useRef<Vector2>(Vector2.zero);

	// Shutter flash & Video record states
	const [isFlashActive, setIsFlashActive] = useState(false);
	const [isShutterPressed, setIsShutterPressed] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [recordDuration, setRecordDuration] = useState(0);
	const [isGridEnabled, setIsGridEnabled] = useState(true);
	const [isEmoteModalOpen, setIsEmoteModalOpen] = useState(() => {
		return EmoteModalView.getInstance().isVisible();
	});

	const JOYSTICK_RADIUS = 48;

	// Listen to controller state updates
	useEffect(() => {
		const cleanup = controller.onStateChanged((newState) => {
			setState(newState);
		});
		return cleanup;
	}, []);

	// Listen to Emote modal toggle updates
	useEffect(() => {
		const unsub = EmoteModalView.getInstance().onToggle((open) => {
			setIsEmoteModalOpen(open);
		});
		return unsub;
	}, []);

	// Timer for Video Recording Duration
	useEffect(() => {
		if (!isRecording) {
			setRecordDuration(0);
			return;
		}
		const startTime = os.clock();
		let running = true;
		const thread = task.spawn(() => {
			while (running) {
				task.wait(1);
				if (!running) break;
				setRecordDuration(math.floor(os.clock() - startTime));
			}
		});
		return () => {
			running = false;
			task.cancel(thread);
		};
	}, [isRecording]);

	// Update moveVector in controller whenever thumbstick offset changes
	useEffect(() => {
		const currentMove = new Vector3(
			joystickThumbOffset.X / JOYSTICK_RADIUS,
			0,
			joystickThumbOffset.Y / JOYSTICK_RADIUS,
		);
		controller.setMoveVector(currentMove);
	}, [joystickThumbOffset]);

	// Global Touch Listeners for Thumbstick & Look Pan
	useEffect(() => {
		if (!visible) return;

		const inputBeganConn = UserInputService.InputBegan.Connect((input) => {
			if (input.UserInputType !== Enum.UserInputType.Touch) return;

			const pos = input.Position;
			const camera = Workspace.CurrentCamera;
			const screenWidth = camera?.ViewportSize.X ?? 800;

			// Left 42% of screen (excluding left controls bar area) = Dynamic Virtual Thumbstick
			if (pos.X > 75 && pos.X < screenWidth * 0.42 && !joystickTouchIdRef.current) {
				joystickTouchIdRef.current = input;
				joystickCenterRef.current = new Vector2(pos.X, pos.Y);
				setJoystickThumbOffset(Vector2.zero);
				setIsJoystickDragging(true);
			}
			// Middle to Right side (excluding right edge camera cluster area) = Pan Look
			else if (pos.X >= screenWidth * 0.42 && pos.X <= screenWidth * 0.82 && !panTouchIdRef.current) {
				panTouchIdRef.current = input;
				lastPanPosRef.current = new Vector2(pos.X, pos.Y);
			}
		});

		const inputChangedConn = UserInputService.InputChanged.Connect((input) => {
			if (input.UserInputType !== Enum.UserInputType.Touch) return;

			if (input === joystickTouchIdRef.current) {
				const currentPos = new Vector2(input.Position.X, input.Position.Y);
				const delta = currentPos.sub(joystickCenterRef.current);
				const mag = delta.Magnitude;

				if (mag > JOYSTICK_RADIUS) {
					const clamped = delta.Unit.mul(JOYSTICK_RADIUS);
					setJoystickThumbOffset(clamped);
				} else {
					setJoystickThumbOffset(delta);
				}
			} else if (input === panTouchIdRef.current) {
				const currentPos = new Vector2(input.Position.X, input.Position.Y);
				const delta = currentPos.sub(lastPanPosRef.current);
				lastPanPosRef.current = currentPos;
				controller.addLookDelta(delta);
			}
		});

		const handleInputEnded = (input: InputObject) => {
			if (input === joystickTouchIdRef.current) {
				joystickTouchIdRef.current = undefined;
				setIsJoystickDragging(false);
				setJoystickThumbOffset(Vector2.zero);
			} else if (input === panTouchIdRef.current) {
				panTouchIdRef.current = undefined;
			}
		};

		const inputEndedConn = UserInputService.InputEnded.Connect(handleInputEnded);

		return () => {
			inputBeganConn.Disconnect();
			inputChangedConn.Disconnect();
			inputEndedConn.Disconnect();
			joystickTouchIdRef.current = undefined;
			panTouchIdRef.current = undefined;
			setIsJoystickDragging(false);
			setJoystickThumbOffset(Vector2.zero);
		};
	}, [visible]);

	const isCapturingRef = useRef(false);

	/**
	 * Play authentic camera shutter sound.
	 */
	const playShutterSound = () => {
		pcall(() => {
			const sound = new Instance("Sound");
			sound.SoundId = "rbxassetid://17208361335"; // iOS Chime / Click audio
			sound.Volume = 0.85;
			sound.PlayOnRemove = true;
			sound.Parent = Workspace;
			sound.Destroy();
		});
	};

	/**
	 * Tangkapan Shutter Bersih:
	 * Menggunakan CaptureService dengan UICaptureMode.None agar Roblox otomatis mengecualikan seluruh 2D UI,
	 * memainkan suara snap shutter, flash putih, menampilkan notifikasi,
	 * lalu memunculkan prompt resmi Roblox untuk menyimpan foto ke Galeri Captures.
	 */
	const triggerShutter = () => {
		if (isCapturingRef.current) return;
		isCapturingRef.current = true;

		// 1. Audio & Visual Feedback Instant
		playShutterSound();
		setIsShutterPressed(true);
		setIsFlashActive(true);

		task.delay(0.2, () => {
			setIsShutterPressed(false);
			setIsFlashActive(false);
		});

		interface CaptureServiceApi extends Instance {
			TakeScreenshotCaptureAsync(
				onCaptureReady: (result: unknown, capture?: unknown) => void,
				captureParams?: { UICaptureMode: unknown },
			): void;
			StartVideoCaptureAsync(
				onCaptureReady: (result: unknown, capture?: unknown) => void,
				captureParams?: { UICaptureMode: unknown },
			): void;
			StopVideoCapture(): void;
			PromptSaveCapturesToGallery(
				captures: unknown[],
				resultCallback: (results: unknown) => void,
			): void;
			CaptureScreenshot(onCaptured?: (contentId: string) => void): void;
		}

		const captureService = game.GetService("CaptureService") as unknown as CaptureServiceApi;

		const handleResult = (success: boolean, captureObj: unknown) => {
			isCapturingRef.current = false;
			if (success) {
				if (captureObj !== undefined) {
					pcall(() => {
						captureService.PromptSaveCapturesToGallery([captureObj], (results) => {
							print("[Freecam] Screenshot save prompt finished:", results);
						});
					});
				}
			} else {
				print("[Freecam] Screenshot capture failed or cancelled.");
			}
		};

		const [ok] = pcall(() => {
			captureService.TakeScreenshotCaptureAsync(
				(result: unknown, screenshotCapture: unknown) => {
					const isSuccess =
						result === Enum.ScreenshotCaptureResult.Success ||
						result === (0 as unknown) ||
						screenshotCapture !== undefined;
					handleResult(isSuccess, screenshotCapture);
				},
				{ UICaptureMode: Enum.UICaptureMode.None },
			);
		});

		if (!ok) {
			isCapturingRef.current = false;
		}
	};

	const isVideoBusyRef = useRef(false);

	/**
	 * Toggle Perekaman Video Kamera:
	 * Menggunakan CaptureService.StartVideoCaptureAsync / StopVideoCapture dengan UICaptureMode.None
	 */
	const toggleVideoRecord = () => {
		if (isVideoBusyRef.current) return;
		isVideoBusyRef.current = true;
		playShutterSound();

		interface CaptureServiceApi extends Instance {
			StartVideoCaptureAsync(
				onCaptureReady: (result: unknown, capture?: unknown) => void,
				captureParams?: { UICaptureMode: unknown },
			): void;
			StopVideoCapture(): void;
			PromptSaveCapturesToGallery(
				captures: unknown[],
				resultCallback: (results: unknown) => void,
			): void;
		}

		const captureService = game.GetService("CaptureService") as unknown as CaptureServiceApi;

		if (!isRecording) {
			setIsRecording(true);
			pcall(() => {
				captureService.StartVideoCaptureAsync(
					(result: unknown, videoCapture: unknown) => {
						setIsRecording(false);
						isVideoBusyRef.current = false;
						const isSuccess =
							result === Enum.VideoCaptureResult.Success ||
							result === (0 as unknown) ||
							videoCapture !== undefined;
						if (isSuccess && videoCapture !== undefined) {
							pcall(() => {
								captureService.PromptSaveCapturesToGallery([videoCapture], (results) => {
									print("[Freecam] Video save prompt finished:", results);
								});
							});
						}
					},
					{ UICaptureMode: Enum.UICaptureMode.None },
				);
			});
			task.delay(0.5, () => {
				isVideoBusyRef.current = false;
			});
		} else {
			setIsRecording(false);
			pcall(() => {
				captureService.StopVideoCapture();
			});
			task.delay(0.5, () => {
				isVideoBusyRef.current = false;
			});
		}
	};

	const cycleSpeed = () => {
		const current = state.speedMultiplier;
		let nextIdx = 0;
		for (let i = 0; i < SPEED_PRESETS.size(); i++) {
			if (math.abs(SPEED_PRESETS[i] - current) < 0.1) {
				nextIdx = (i + 1) % SPEED_PRESETS.size();
				break;
			}
		}
		controller.setSpeedMultiplier(SPEED_PRESETS[nextIdx]);
	};

	const cycleZoom = () => {
		const currentFov = state.fov;
		let nextIdx = 0;
		for (let i = 0; i < ZOOM_PRESETS.size(); i++) {
			if (math.abs(ZOOM_PRESETS[i].fov - currentFov) < 5) {
				nextIdx = (i + 1) % ZOOM_PRESETS.size();
				break;
			}
		}
		controller.setFov(ZOOM_PRESETS[nextIdx].fov);
	};

	const lastEmoteToggleTimeRef = useRef(0);
	const toggleEmoteModal = () => {
		const now = os.clock();
		if (now - lastEmoteToggleTimeRef.current < 0.25) return;
		lastEmoteToggleTimeRef.current = now;
		EmoteModalView.getInstance().toggle();
	};

	const exitFreecam = () => {
		if (isRecording) {
			pcall(() => {
				const cs = game.GetService("CaptureService") as unknown as { StopVideoCapture(): void };
				cs.StopVideoCapture();
			});
		}
		if (EmoteModalView.getInstance().isVisible()) {
			EmoteModalView.getInstance().toggle(false);
		}
		controller.stopFreecam();
		if (onClose) onClose();
	};

	const currentSpeedLabel =
		state.speedMultiplier <= 0.6 ? "0.5x" : state.speedMultiplier <= 1.2 ? "1.0x" : "2.5x";

	let currentZoomLabel = "1x";
	for (const preset of ZOOM_PRESETS) {
		if (math.abs(state.fov - preset.fov) < 5) {
			currentZoomLabel = preset.label;
			break;
		}
	}

	if (!visible) return <></>;

	return (
		<frame
			key="FreecamHudRoot"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			ClipsDescendants={true}
			ZIndex={180}
		>
			{/* White Camera Shutter Flash */}
			{isFlashActive && (
				<frame
					key="ShutterFlash"
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={Color3.fromRGB(255, 255, 255)}
					BackgroundTransparency={0.2}
					ZIndex={250}
				/>
			)}

			{/* Freecam Interactive HUD Elements (Toggled via 'H' key / controller) */}
			{state.isHudVisible && (
				<>
					{/* Rule of Thirds 3x3 Grid Overlay */}
					{isGridEnabled && (
						<frame
							key="RuleOfThirdsGrid"
							Size={new UDim2(1, 0, 1, 0)}
							BackgroundTransparency={1}
							ZIndex={181}
						>
							{/* Vertical Lines */}
							<frame
								Position={new UDim2(0.333, 0, 0, 0)}
								Size={new UDim2(0, 1, 1, 0)}
								BackgroundColor3={Color3.fromRGB(255, 255, 255)}
								BackgroundTransparency={0.82}
							/>
							<frame
								Position={new UDim2(0.666, 0, 0, 0)}
								Size={new UDim2(0, 1, 1, 0)}
								BackgroundColor3={Color3.fromRGB(255, 255, 255)}
								BackgroundTransparency={0.82}
							/>
							{/* Horizontal Lines */}
							<frame
								Position={new UDim2(0, 0, 0.333, 0)}
								Size={new UDim2(1, 0, 0, 1)}
								BackgroundColor3={Color3.fromRGB(255, 255, 255)}
								BackgroundTransparency={0.82}
							/>
							<frame
								Position={new UDim2(0, 0, 0.666, 0)}
								Size={new UDim2(1, 0, 0, 1)}
								BackgroundColor3={Color3.fromRGB(255, 255, 255)}
								BackgroundTransparency={0.82}
							/>
						</frame>
					)}

					{/* Center Autofocus Reticle [ + ] */}
					<frame
						key="AutofocusReticle"
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={new UDim2(0.5, 0, 0.5, 0)}
						Size={new UDim2(0, 48, 0, 48)}
						BackgroundTransparency={1}
						ZIndex={182}
					>
						<uistroke
							Color={Color3.fromHex("#facc15")}
							Transparency={0.4}
							Thickness={1.5}
						/>
						<uicorner CornerRadius={new UDim(0, 8)} />
						<frame
							AnchorPoint={new Vector2(0.5, 0.5)}
							Position={new UDim2(0.5, 0, 0.5, 0)}
							Size={new UDim2(0, 6, 0, 6)}
							BackgroundColor3={Color3.fromHex("#facc15")}
							BackgroundTransparency={0.3}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
						</frame>
					</frame>

					{/* Minimalist Virtual Thumbstick (Left Side) */}
					{isJoystickDragging && (
						<frame
							key="VirtualThumbstick"
							AnchorPoint={new Vector2(0.5, 0.5)}
							Position={
								new UDim2(
									0,
									joystickCenterRef.current.X,
									0,
									joystickCenterRef.current.Y,
								)
							}
							Size={new UDim2(0, JOYSTICK_RADIUS * 2, 0, JOYSTICK_RADIUS * 2)}
							BackgroundColor3={Color3.fromRGB(255, 255, 255)}
							BackgroundTransparency={0.88}
							ZIndex={185}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
							<uistroke
								Color={Color3.fromRGB(255, 255, 255)}
								Transparency={0.7}
								Thickness={1.5}
							/>

							{/* Joystick Thumb Knub */}
							<frame
								AnchorPoint={new Vector2(0.5, 0.5)}
								Position={
									new UDim2(
										0.5,
										joystickThumbOffset.X,
										0.5,
										joystickThumbOffset.Y,
									)
								}
								Size={new UDim2(0, 40, 0, 40)}
								BackgroundColor3={Color3.fromRGB(255, 255, 255)}
								BackgroundTransparency={0.45}
								ZIndex={186}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
							</frame>
						</frame>
					)}

					{/* LEFT CONTROLS BAR: Vertical (Close, Grid, Emotes, Speed) */}
					<frame
						key="LeftControlsBar"
						AnchorPoint={new Vector2(0, 0.5)}
						Position={new UDim2(0, 24, 0.5, 0)}
						Size={new UDim2(0, 42, 0, 210)}
						BackgroundTransparency={1}
						ZIndex={190}
					>
						<uilistlayout
							SortOrder={Enum.SortOrder.LayoutOrder}
							FillDirection={Enum.FillDirection.Vertical}
							HorizontalAlignment={Enum.HorizontalAlignment.Center}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							Padding={new UDim(0, 10)}
						/>

						{/* 1. Exit Freecam Button */}
						<textbutton
							key="1_ExitButton"
							LayoutOrder={1}
							Size={new UDim2(0, 38, 0, 38)}
							BackgroundColor3={Color3.fromHex("#000000")}
							BackgroundTransparency={0.5}
							Text=""
							Active={true}
							AutoButtonColor={true}
							ZIndex={195}
							Event={{
								Activated: exitFreecam,
								MouseButton1Click: exitFreecam,
							}}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
							<uistroke Color={Color3.fromRGB(255, 255, 255)} Transparency={0.8} Thickness={1} />
							<LucideIcon
								name="x"
								size={new UDim2(0, 18, 0, 18)}
								color={Color3.fromRGB(255, 255, 255)}
								anchorPoint={new Vector2(0.5, 0.5)}
								position={new UDim2(0.5, 0, 0.5, 0)}
							/>
						</textbutton>

						{/* 2. 3x3 Grid Toggle */}
						<textbutton
							key="2_GridButton"
							LayoutOrder={2}
							Size={new UDim2(0, 38, 0, 38)}
							BackgroundColor3={Color3.fromHex("#000000")}
							BackgroundTransparency={0.5}
							Text=""
							Active={true}
							AutoButtonColor={true}
							ZIndex={195}
							Event={{
								Activated: () => setIsGridEnabled(!isGridEnabled),
								MouseButton1Click: () => setIsGridEnabled(!isGridEnabled),
							}}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
							<uistroke
								Color={isGridEnabled ? Color3.fromHex("#facc15") : Color3.fromRGB(255, 255, 255)}
								Transparency={isGridEnabled ? 0.3 : 0.8}
								Thickness={1}
							/>
							<LucideIcon
								name="grid-3x3"
								size={new UDim2(0, 18, 0, 18)}
								color={isGridEnabled ? Color3.fromHex("#facc15") : Color3.fromRGB(255, 255, 255)}
								anchorPoint={new Vector2(0.5, 0.5)}
								position={new UDim2(0.5, 0, 0.5, 0)}
							/>
						</textbutton>

						{/* 3. Emotes & Reactions Modal Toggle */}
						<textbutton
							key="3_EmoteButton"
							LayoutOrder={3}
							Size={new UDim2(0, 38, 0, 38)}
							BackgroundColor3={Color3.fromHex("#000000")}
							BackgroundTransparency={0.5}
							Text=""
							Active={true}
							AutoButtonColor={true}
							ZIndex={195}
							Event={{
								Activated: toggleEmoteModal,
								MouseButton1Click: toggleEmoteModal,
							}}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
							<uistroke
								Color={isEmoteModalOpen ? Color3.fromHex("#facc15") : Color3.fromRGB(255, 255, 255)}
								Transparency={isEmoteModalOpen ? 0.3 : 0.8}
								Thickness={1}
							/>
							<LucideIcon
								name="sparkles"
								size={new UDim2(0, 18, 0, 18)}
								color={isEmoteModalOpen ? Color3.fromHex("#facc15") : Color3.fromRGB(255, 255, 255)}
								anchorPoint={new Vector2(0.5, 0.5)}
								position={new UDim2(0.5, 0, 0.5, 0)}
							/>
						</textbutton>

						{/* 4. Flight Speed Vertical Pill */}
						<textbutton
							key="4_SpeedButton"
							LayoutOrder={4}
							Size={new UDim2(0, 40, 0, 48)}
							BackgroundColor3={Color3.fromHex("#000000")}
							BackgroundTransparency={0.5}
							Text=""
							Active={true}
							AutoButtonColor={true}
							ZIndex={195}
							Event={{
								Activated: cycleSpeed,
								MouseButton1Click: cycleSpeed,
							}}
						>
							<uicorner CornerRadius={new UDim(0, 20)} />
							<uistroke Color={Color3.fromRGB(255, 255, 255)} Transparency={0.8} Thickness={1} />
							<frame
								Size={new UDim2(1, 0, 1, 0)}
								BackgroundTransparency={1}
							>
								<uilistlayout
									SortOrder={Enum.SortOrder.LayoutOrder}
									FillDirection={Enum.FillDirection.Vertical}
									HorizontalAlignment={Enum.HorizontalAlignment.Center}
									VerticalAlignment={Enum.VerticalAlignment.Center}
									Padding={new UDim(0, 2)}
								/>
								<LucideIcon
									name="gauge"
									size={new UDim2(0, 14, 0, 14)}
									color={Color3.fromHex("#38bdf8")}
								/>
								<textlabel
									Text={currentSpeedLabel}
									TextColor3={Color3.fromRGB(255, 255, 255)}
									Font={Fonts.Bold}
									TextSize={10}
									Size={new UDim2(1, 0, 0, 14)}
									BackgroundTransparency={1}
								/>
							</frame>
						</textbutton>
					</frame>

					{/* Top Center: Recording Duration Badge */}
					{isRecording && (
						<frame
							key="RecordingHeaderBadge"
							AnchorPoint={new Vector2(0.5, 0)}
							Position={new UDim2(0.5, 0, 0, 24)}
							Size={new UDim2(0, 96, 0, 32)}
							BackgroundColor3={Color3.fromHex("#000000")}
							BackgroundTransparency={0.4}
							ZIndex={200}
						>
							<uicorner CornerRadius={new UDim(0, 16)} />
							<uistroke Color={Color3.fromHex("#ef4444")} Transparency={0.3} Thickness={1.5} />
							<uilistlayout
								SortOrder={Enum.SortOrder.LayoutOrder}
								FillDirection={Enum.FillDirection.Horizontal}
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 8)}
							/>
							{/* Blinking Red Dot */}
							<frame
								Size={new UDim2(0, 8, 0, 8)}
								BackgroundColor3={Color3.fromHex("#ef4444")}
								BackgroundTransparency={0}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
							</frame>
							<textlabel
								Text={string.format("%02d:%02d", math.floor(recordDuration / 60), recordDuration % 60)}
								TextColor3={Color3.fromRGB(255, 255, 255)}
								Font={Fonts.Bold}
								TextSize={12}
								Size={new UDim2(0, 48, 1, 0)}
								BackgroundTransparency={1}
							/>
						</frame>
					)}

					{/* Right Side Camera Controls: Shutter Centered vertically, Zoom aligned with Shutter, Record on top */}
					<frame
						key="RightCameraCluster"
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, -20, 0.5, 0)}
						Size={new UDim2(0, 134, 0, 72)}
						BackgroundTransparency={1}
						ZIndex={190}
					>
						<uilistlayout
							SortOrder={Enum.SortOrder.LayoutOrder}
							FillDirection={Enum.FillDirection.Horizontal}
							HorizontalAlignment={Enum.HorizontalAlignment.Right}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							Padding={new UDim(0, 14)}
						/>

						{/* 1. Compact 1-Button Zoom Cycler (Horizontally aligned with Shutter Center) */}
						<textbutton
							key="1_CompactZoomButton"
							LayoutOrder={1}
							Size={new UDim2(0, 42, 0, 42)}
							BackgroundColor3={Color3.fromHex("#000000")}
							BackgroundTransparency={0.5}
							Text=""
							AutoButtonColor={false}
							Event={{
								Activated: cycleZoom,
							}}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
							<uistroke
								Color={Color3.fromRGB(255, 255, 255)}
								Transparency={0.75}
								Thickness={1.2}
							/>
							<textlabel
								Text={currentZoomLabel}
								TextColor3={Color3.fromHex("#facc15")}
								Font={Fonts.Bold}
								TextSize={12}
								Size={new UDim2(1, 0, 1, 0)}
								BackgroundTransparency={1}
							/>
						</textbutton>

						{/* 2. Shutter & Record Container (Shutter centered at Y = 0.5, Record placed directly above) */}
						<frame
							key="2_ShutterContainer"
							LayoutOrder={2}
							Size={new UDim2(0, 72, 0, 72)}
							BackgroundTransparency={1}
							ZIndex={195}
						>
							{/* Video Record Button (Positioned directly above Shutter) */}
							<textbutton
								key="RecordButton"
								AnchorPoint={new Vector2(0.5, 1)}
								Position={new UDim2(0.5, 0, 0, -12)}
								Size={new UDim2(0, 44, 0, 44)}
								BackgroundColor3={Color3.fromRGB(0, 0, 0)}
								BackgroundTransparency={0.55}
								Text=""
								Active={true}
								AutoButtonColor={false}
								ZIndex={200}
								Event={{
									Activated: toggleVideoRecord,
									MouseButton1Click: toggleVideoRecord,
								}}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
								<uistroke
									Color={isRecording ? Color3.fromHex("#ef4444") : Color3.fromRGB(255, 255, 255)}
									Transparency={isRecording ? 0.2 : 0.75}
									Thickness={isRecording ? 2 : 1.2}
								/>

								{/* Red Record Indicator Icon: Dot when idle, Square when active */}
								<frame
									AnchorPoint={new Vector2(0.5, 0.5)}
									Position={new UDim2(0.5, 0, 0.5, 0)}
									Size={isRecording ? new UDim2(0, 16, 0, 16) : new UDim2(0, 20, 0, 20)}
									BackgroundColor3={Color3.fromHex("#ef4444")}
									BackgroundTransparency={0}
								>
									<uicorner CornerRadius={isRecording ? new UDim(0, 4) : new UDim(1, 0)} />
								</frame>
							</textbutton>

							{/* iOS Photo Shutter Button (Centered in container & screen Y = 0.5) */}
							<textbutton
								key="ShutterButton"
								AnchorPoint={new Vector2(0.5, 0.5)}
								Position={new UDim2(0.5, 0, 0.5, 0)}
								Size={new UDim2(0, 72, 0, 72)}
								BackgroundColor3={Color3.fromRGB(0, 0, 0)}
								BackgroundTransparency={0.6}
								Text=""
								Active={true}
								AutoButtonColor={false}
								ZIndex={196}
								Event={{
									Activated: triggerShutter,
									MouseButton1Click: triggerShutter,
								}}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
								<uistroke
									Color={Color3.fromRGB(255, 255, 255)}
									Transparency={0}
									Thickness={3.5}
								/>

								{/* Inner Solid White Shutter Button */}
								<frame
									AnchorPoint={new Vector2(0.5, 0.5)}
									Position={new UDim2(0.5, 0, 0.5, 0)}
									Size={isShutterPressed ? new UDim2(0, 50, 0, 50) : new UDim2(0, 58, 0, 58)}
									BackgroundColor3={Color3.fromRGB(255, 255, 255)}
									BackgroundTransparency={0}
									ZIndex={197}
								>
									<uicorner CornerRadius={new UDim(1, 0)} />
								</frame>
							</textbutton>
						</frame>
					</frame>
				</>
			)}
		</frame>
	);
}

/**
 * OOP Class Adapter for FreecamHudView.
 */
export class FreecamHudView {
	private static instance?: FreecamHudView;
	private root: Root;
	private screenGui?: ScreenGui;
	private isVisibleState = false;

	constructor(targetContainer?: Instance) {
		let container = targetContainer;
		if (!container) {
			const player = Players.LocalPlayer;
			const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

			const existing = playerGui.FindFirstChild("FreecamHudGui") as ScreenGui | undefined;
			if (existing) {
				existing.Destroy();
			}

			const gui = new Instance("ScreenGui");
			gui.Name = "FreecamHudGui";
			gui.ResetOnSpawn = false;
			gui.DisplayOrder = 180;
			gui.IgnoreGuiInset = true;
			gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			gui.Parent = playerGui;
			this.screenGui = gui;
			container = gui;
		}

		this.root = ReactRoblox.createRoot(container);
		this.render();

		if (!targetContainer) {
			FreecamController.getInstance().onStateChanged((state) => {
				if (state.isActive && !this.isVisibleState) {
					this.show();
				} else if (!state.isActive && this.isVisibleState) {
					this.hide();
				}
			});
		}
	}

	public static getInstance(): FreecamHudView {
		if (!FreecamHudView.instance) {
			FreecamHudView.instance = new FreecamHudView();
		}
		return FreecamHudView.instance;
	}

	private render(): void {
		this.root.render(
			<FreecamHudComponent
				visible={this.isVisibleState}
				onClose={() => this.hide()}
			/>,
		);
	}

	public show(): void {
		if (this.isVisibleState) return;
		this.isVisibleState = true;
		if (this.screenGui) {
			this.screenGui.Enabled = true;
		}
		this.render();
	}

	public hide(): void {
		if (!this.isVisibleState) return;
		this.isVisibleState = false;
		if (this.screenGui) {
			this.screenGui.Enabled = false;
		}
		this.render();
	}

	public toggle(force?: boolean): void {
		const target = force !== undefined ? force : !this.isVisibleState;
		if (target) {
			this.show();
		} else {
			this.hide();
		}
	}

	public isVisible(): boolean {
		return this.isVisibleState;
	}

	public destroy(): void {
		this.isVisibleState = false;
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
			this.screenGui = undefined;
		}
		if (FreecamHudView.instance === this) {
			FreecamHudView.instance = undefined;
		}
	}
}
