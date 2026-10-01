import { CollectionService, Workspace } from "@rbxts/services";
import { BACKDROP_GIF_PRESETS, BackdropGifPreset, DEFAULT_BACKDROP_PRESET_ID } from "shared/config";

/**
 * StageBackdropGifComponent
 * Mengelola pemutaran animasi GIF / Sprite Sheet pada part Backdrop panggung (game.Workspace["3dModel"].Backdrop)
 * dan BackdropDJ (game.Workspace["3dModel"].BackdropDJ)
 * menggunakan SurfaceGui emisi LED tinggi (LightInfluence = 0, Brightness = 2.0+).
 */
export class StageBackdropGifComponent {
	public readonly part: BasePart;
	public readonly isDjBackdrop: boolean;

	private surfaceGui?: SurfaceGui;
	private imageLabel?: ImageLabel;
	private scanlineFrame?: Frame;

	// State animasi
	private currentPresetId = DEFAULT_BACKDROP_PRESET_ID;
	private activePreset?: BackdropGifPreset;
	private currentFrame = 0;
	private frameTimer = 0;
	private isScreenOn = true;

	// Konfigurasi resolusi & grid
	private columns = 5;
	private rows = 5;
	private totalFrames = 25;
	private fps = 15;
	private textureWidth = 1024;
	private textureHeight = 1024;
	private brightness = 2.0;

	// Event connections
	private attrConn?: RBXScriptConnection;
	private lightingAttrConn?: RBXScriptConnection;

	constructor(part: BasePart) {
		this.part = part;
		this.isDjBackdrop =
			this.part.Name === "BackdropDJ" ||
			this.part.GetAttribute("Stage") === "dj" ||
			CollectionService.HasTag(this.part, "DjBackdrop") ||
			this.part.Position.Y > 100;

		this.setupSurfaceGui();
		this.refreshConfig();
		this.bindAttributeListeners();
	}

	private setupSurfaceGui(): void {
		// Bersihkan gui lama jika ada
		const existing = this.part.FindFirstChild("BackdropScreenGui");
		if (existing) {
			existing.Destroy();
		}

		// Hitung aspect ratio part untuk CanvasSize ideal (~2.17:1)
		const partSize = this.part.Size;
		const canvasWidth = 1920;
		const canvasHeight = math.floor((partSize.Y / partSize.X) * canvasWidth + 0.5);

		const gui = new Instance("SurfaceGui");
		gui.Name = "BackdropScreenGui";
		gui.Face = Enum.NormalId.Back; // Menghadap ke depan panggung & penonton
		gui.LightInfluence = 0; // Penuh emisi LED (tidak terpengaruh bayangan gelap)
		gui.Brightness = this.brightness;
		gui.CanvasSize = new Vector2(canvasWidth, canvasHeight > 0 ? canvasHeight : 884);
		gui.SizingMode = Enum.SurfaceGuiSizingMode.FixedSize;
		gui.AlwaysOnTop = false;
		gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		gui.Parent = this.part;
		this.surfaceGui = gui;

		// Container Layar Hitam
		const rootFrame = new Instance("Frame");
		rootFrame.Name = "ScreenRoot";
		rootFrame.Size = new UDim2(1, 0, 1, 0);
		rootFrame.Position = new UDim2(0, 0, 0, 0);
		rootFrame.BackgroundColor3 = Color3.fromRGB(5, 5, 8);
		rootFrame.BorderSizePixel = 0;
		rootFrame.ClipsDescendants = true;
		rootFrame.Parent = gui;

		// ImageLabel untuk Animasi GIF Sprite Sheet
		const img = new Instance("ImageLabel");
		img.Name = "GifDisplay";
		img.Size = new UDim2(1, 0, 1, 0);
		img.Position = new UDim2(0, 0, 0, 0);
		img.BackgroundTransparency = 1;
		img.ScaleType = Enum.ScaleType.Stretch;
		img.ResampleMode = Enum.ResamplerMode.Default;
		img.Parent = rootFrame;
		this.imageLabel = img;

		// Frame Garis Scanlines subtle (efek layar LED panggung autentik)
		const scanline = new Instance("Frame");
		scanline.Name = "ScanlineOverlay";
		scanline.Size = new UDim2(1, 0, 1, 0);
		scanline.BackgroundTransparency = 1;
		scanline.BorderSizePixel = 0;
		scanline.Parent = rootFrame;

		this.scanlineFrame = scanline;
	}

	/**
	 * Memperbarui konfigurasi berdasarkan Preset ID, Attributes part, atau folder Lighting
	 */
	public refreshConfig(): void {
		// 1. Cek nilai dari Attribute part atau Lighting folder
		const lightingFolder = Workspace.FindFirstChild("Lighting");
		const presetAttrKey = this.isDjBackdrop
			? "DjStageLightingBackdropPreset"
			: "StageLightingBackdropPreset";
		const brightnessAttrKey = this.isDjBackdrop
			? "DjStageLightingBackdropBrightness"
			: "StageLightingBackdropBrightness";

		const serverPreset = lightingFolder?.GetAttribute(presetAttrKey) as string | undefined;
		const serverBrightness = lightingFolder?.GetAttribute(brightnessAttrKey) as number | undefined;

		const partPreset = this.part.GetAttribute("Preset") as string | undefined;
		const partBrightness = this.part.GetAttribute("Brightness") as number | undefined;

		const activePresetId = partPreset ?? serverPreset ?? this.currentPresetId;
		this.currentPresetId = activePresetId;

		this.brightness = partBrightness ?? serverBrightness ?? 2.0;
		if (this.surfaceGui) {
			this.surfaceGui.Brightness = this.brightness;
		}

		// 2. Evaluasi apakah mode Off / Blackout
		if (activePresetId === "off") {
			this.isScreenOn = false;
			if (this.imageLabel) {
				this.imageLabel.Visible = false;
			}
			return;
		}

		this.isScreenOn = true;
		if (this.imageLabel) {
			this.imageLabel.Visible = true;
		}

		// 3. Cek apakah ada Custom ImageId di Attributes part (No-code mode)
		const customImageId = this.part.GetAttribute("ImageId") as string | number | undefined;
		const customColumns = this.part.GetAttribute("Columns") as number | undefined;
		const customRows = this.part.GetAttribute("Rows") as number | undefined;
		const customTotalFrames = this.part.GetAttribute("TotalFrames") as number | undefined;
		const customFps = this.part.GetAttribute("FPS") as number | undefined;
		const customTexWidth = this.part.GetAttribute("TextureWidth") as number | undefined;
		const customTexHeight = this.part.GetAttribute("TextureHeight") as number | undefined;

		if (customImageId !== undefined) {
			// Mode Custom langsung dari Attribute
			const formattedAsset = typeIs(customImageId, "number")
				? `rbxassetid://${customImageId}`
				: customImageId.sub(1, 13) === "rbxassetid://"
				? customImageId
				: `rbxassetid://${customImageId}`;

			this.columns = customColumns ?? 5;
			this.rows = customRows ?? 5;
			this.totalFrames = customTotalFrames ?? this.columns * this.rows;
			this.fps = customFps ?? 15;
			this.textureWidth = customTexWidth ?? 1024;
			this.textureHeight = customTexHeight ?? 1024;

			if (this.imageLabel) {
				this.imageLabel.Image = formattedAsset;
			}
			return;
		}

		// 4. Mode Preset dari StageBackdropConfig
		const foundPreset = BACKDROP_GIF_PRESETS.find((p) => p.id === activePresetId) ?? BACKDROP_GIF_PRESETS[0];
		this.activePreset = foundPreset;

		this.columns = customColumns ?? foundPreset.columns;
		this.rows = customRows ?? foundPreset.rows;
		this.totalFrames = customTotalFrames ?? foundPreset.totalFrames;
		this.textureWidth = customTexWidth ?? foundPreset.textureWidth ?? 1024;
		this.textureHeight = customTexHeight ?? foundPreset.textureHeight ?? 1024;

		if (this.imageLabel) {
			this.imageLabel.Image = foundPreset.assetId;
		}
	}

	private bindAttributeListeners(): void {
		// Listen attribute di part Backdrop
		this.attrConn = this.part.AttributeChanged.Connect(() => {
			this.refreshConfig();
		});

		// Listen attribute di Lighting folder
		const lightingFolder = Workspace.FindFirstChild("Lighting");
		if (lightingFolder) {
			const presetAttrKey = this.isDjBackdrop
				? "DjStageLightingBackdropPreset"
				: "StageLightingBackdropPreset";
			const brightnessAttrKey = this.isDjBackdrop
				? "DjStageLightingBackdropBrightness"
				: "StageLightingBackdropBrightness";

			this.lightingAttrConn = lightingFolder.AttributeChanged.Connect((attrName) => {
				if (attrName === presetAttrKey || attrName === brightnessAttrKey) {
					this.refreshConfig();
				}
			});
		}
	}

	/**
	 * Dipanggil per frame oleh ClientBackdropController (RenderStepped)
	 */
	public update(dt: number, now: number): void {
		if (!this.isScreenOn || !this.imageLabel || this.totalFrames <= 0) return;

		this.frameTimer += dt;
		const frameDuration = 1 / math.max(1, this.fps);

		if (this.frameTimer >= frameDuration) {
			const steps = math.floor(this.frameTimer / frameDuration);
			this.frameTimer -= steps * frameDuration;
			this.currentFrame = (this.currentFrame + steps) % this.totalFrames;

			const col = this.currentFrame % this.columns;
			const row = math.floor(this.currentFrame / this.columns);

			const frameWidth = this.textureWidth / this.columns;
			const frameHeight = this.textureHeight / this.rows;

			this.imageLabel.ImageRectOffset = new Vector2(
				math.floor(col * frameWidth + 0.5),
				math.floor(row * frameHeight + 0.5),
			);
			this.imageLabel.ImageRectSize = new Vector2(
				math.floor(frameWidth + 0.5),
				math.floor(frameHeight + 0.5),
			);
		}
	}

	/**
	 * Mengganti preset secara programatik
	 */
	public setPreset(presetId: string): void {
		this.currentPresetId = presetId;
		this.part.SetAttribute("Preset", presetId);
		this.refreshConfig();
	}

	public destroy(): void {
		if (this.attrConn) {
			this.attrConn.Disconnect();
			this.attrConn = undefined;
		}
		if (this.lightingAttrConn) {
			this.lightingAttrConn.Disconnect();
			this.lightingAttrConn = undefined;
		}
		if (this.surfaceGui) {
			this.surfaceGui.Destroy();
			this.surfaceGui = undefined;
		}
	}
}
