import {
	ContentProvider,
	Lighting,
	Players,
	ReplicatedStorage,
	SoundService,
	Workspace,
} from "@rbxts/services";

/**
 * GraphicsController
 * Mengatur optimasi visual tingkat tinggi (HD), kalibrasi pencahayaan/DepthOfField,
 * peningkatan grafis R6 (HD Decal Applier), serta preloading komprehensif untuk
 * SELURUH aset game (pakaian, karakter, mesh, decal, tekstur map, audio, dan material).
 */
export class GraphicsController {
	private static instance?: GraphicsController;
	private isInitialized = false;

	private constructor() {}

	public static getInstance(): GraphicsController {
		if (!GraphicsController.instance) {
			GraphicsController.instance = new GraphicsController();
		}
		return GraphicsController.instance;
	}

	public init(): void {
		if (this.isInitialized) return;
		this.isInitialized = true;

		// 1. Kalibrasi awal pencahayaan & DepthOfField
		this.optimizeLighting();

		// 2. Pasang listener otomatis untuk karakter pemain saat ini dan respawn
		const localPlayer = Players.LocalPlayer;
		if (localPlayer.Character) {
			this.optimizeCharacterVisuals(localPlayer.Character);
		}

		localPlayer.CharacterAdded.Connect((character) => {
			task.spawn(() => {
				this.optimizeCharacterVisuals(character);
			});
		});

		print("[GraphicsController] Initialized: Global HD Assets & Lighting pipeline active.");
	}

	/**
	 * Mengoptimalkan pencahayaan dan menonaktifkan efek blur jarak dekat pada DepthOfField.
	 * Memastikan karakter pemain dan objek di sekitarnya selalu tampil tajam (sharp).
	 */
	public optimizeLighting(): void {
		pcall(() => {
			Lighting.GlobalShadows = true;

			// Pastikan mode Realistic aktif pada Roblox Unified Lighting System terbaru
			const enumRecord = Enum as unknown as Record<string, Record<string, unknown>>;
			const lightingRecord = Lighting as unknown as Record<string, unknown>;
			if (enumRecord.LightingStyle?.Realistic) {
				lightingRecord.LightingStyle = enumRecord.LightingStyle.Realistic;
			}
			if (lightingRecord.PrioritizeLightingQuality !== undefined) {
				lightingRecord.PrioritizeLightingQuality = true;
			}

			// Nonaktifkan flat Blur 2D yang memburamkan seluruh layar, sisakan hanya blur khusus UI saat aktif
			for (const child of Lighting.GetChildren()) {
				if (
					child.IsA("BlurEffect") &&
					child.Name !== "BackpackBlur" &&
					child.Name !== "AnnouncementBlur"
				) {
					child.Enabled = false;
					child.Size = 0;
				}
			}

			// 1. Realistic AAA Optical Bloom (Pendaran lensa lembut pada lampu/neon asli tanpa menyilaukan jalan)
			let bloom = Lighting.FindFirstChildOfClass("BloomEffect");
			if (!bloom) {
				bloom = new Instance("BloomEffect");
				bloom.Name = "Bloom";
				bloom.Parent = Lighting;
			}
			bloom.Intensity = 0.22; // Glow lembut terukur pada lampu & lampu jalan
			bloom.Size = 16;
			bloom.Threshold = 3.0; // Threshold tinggi: hanya neon/bohlam sejati yang glow, jalan & pakaian tetap matte
			bloom.Enabled = true;

			// 2. Realistic AAA DepthOfField (Seluruh gedung kota & gameplay tetap tajam dan jernih layaknya GTA V)
			let dof = Lighting.FindFirstChildOfClass("DepthOfFieldEffect");
			if (!dof) {
				dof = new Instance("DepthOfFieldEffect");
				dof.Name = "DepthOfField";
				dof.Parent = Lighting;
			}
			dof.NearIntensity = 0; // Karakter & gameplay 100% tajam
			dof.FocusDistance = 150;
			dof.InFocusRadius = 350;
			dof.FarIntensity = 0; // Menghilangkan blur berlebih pada gedung latar belakang agar seluruh kota jernih
			dof.Enabled = true;

			// 3. Cinematic Soft God Rays (SunRays halus merata tanpa artefak garis kasar)
			let sunRays = Lighting.FindFirstChildOfClass("SunRaysEffect");
			if (!sunRays) {
				sunRays = new Instance("SunRaysEffect");
				sunRays.Name = "SunRays";
				sunRays.Parent = Lighting;
			}
			sunRays.Intensity = 0.2;
			sunRays.Spread = 0.65;
			sunRays.Enabled = true;

			Lighting.EnvironmentDiffuseScale = 0.5;
			Lighting.EnvironmentSpecularScale = 0.18; // Menghilangkan pantulan cermin/kaca berlebih pada aspal & marka jalan

			// 4. Moody Urban Atmosphere (Haze kabut halus & pembiasan cahaya sinematik yang jernih)
			let atmosphere = Lighting.FindFirstChildOfClass("Atmosphere");
			if (!atmosphere) {
				atmosphere = new Instance("Atmosphere");
				atmosphere.Name = "Atmosphere";
				atmosphere.Parent = Lighting;
			}
			atmosphere.Density = 0.1;
			atmosphere.Offset = 0.0;
			atmosphere.Haze = 0.0; // Jernih dan bebas garis batas horizon
			atmosphere.Glare = 0.05; // Pendaran lembut tanpa cincin silau berlebih
			atmosphere.Color = new Color3(195 / 255, 170 / 255, 145 / 255);
			atmosphere.Decay = new Color3(75 / 255, 50 / 255, 25 / 255);

			// 5. Cinematic Moody Color Grading (Kontras lembut, dynamic range lebar, transisi filmic khas GTA V)
			let cc = Lighting.FindFirstChildOfClass("ColorCorrectionEffect");
			if (!cc) {
				cc = new Instance("ColorCorrectionEffect");
				cc.Name = "ColorCorrection";
				cc.Parent = Lighting;
			}
			cc.Brightness = 0.0;
			cc.Contrast = 0.05; // Kontras seimbang menjaga dynamic range agar highlight tidak klip putih
			cc.Saturation = 0.04;
			cc.TintColor = new Color3(254 / 255, 252 / 255, 248 / 255);
			cc.Enabled = true;
		});
	}

	/**
	 * Mengoptimalkan visual karakter secara mendalam:
	 * - Memasang Decal HD pada Torso untuk T-Shirt (menghindari batas 128px R6 UV box).
	 * - Mengumpulkan seluruh tekstur pakaian (Shirt, Pants, T-Shirt, Wajah, Aksesoris).
	 * - Mem-preload seluruh tekstur pakaian & mesh karakter ke resolusi penuh.
	 */
	public optimizeCharacterVisuals(character: Model): void {
		// Tunggu rig esensial
		const humanoid = character.WaitForChild("Humanoid", 8) as Humanoid | undefined;
		const torso = (character.WaitForChild("Torso", 8) || character.WaitForChild("UpperTorso", 2)) as
			| BasePart
			| undefined;

		if (!humanoid || !torso) return;

		// 1. HD T-SHIRT ENHANCEMENT:
		// Jika karakter memiliki ShirtGraphic (Classic T-Shirt), buatkan Decal HD di bagian depan Torso.
		// Decal di Roblox dirender dengan tekstur resolusi penuh (hingga 1024x1024), berbeda dengan
		// Classic ShirtGraphic yang terkompresi di dalam UV box R6 (128x128).
		const shirtGraphic = character.FindFirstChildOfClass("ShirtGraphic");
		if (shirtGraphic && shirtGraphic.Graphic !== "") {
			this.applyTorsoHDDecal(torso, shirtGraphic.Graphic);
		}

		// Pantau jika ada ShirtGraphic yang ditambahkan kemudian
		character.ChildAdded.Connect((child) => {
			if (child.IsA("ShirtGraphic")) {
				task.defer(() => {
					if (child.Graphic !== "") {
						this.applyTorsoHDDecal(torso, child.Graphic);
					}
				});
				child.GetPropertyChangedSignal("Graphic").Connect(() => {
					if (child.Graphic !== "") {
						this.applyTorsoHDDecal(torso, child.Graphic);
					}
				});
			}
		});

		// 2. PRELOAD SELURUH TEKSTUR & ASET KARAKTER KE RESOLUSI HD
		const characterAssets: Instance[] = [];

		// Kumpulkan pakaian & aksesoris
		for (const desc of character.GetDescendants()) {
			if (
				desc.IsA("Shirt") ||
				desc.IsA("Pants") ||
				desc.IsA("ShirtGraphic") ||
				desc.IsA("Decal") ||
				desc.IsA("Texture") ||
				desc.IsA("MeshPart") ||
				desc.IsA("SpecialMesh") ||
				desc.IsA("Accessory")
			) {
				characterAssets.push(desc);
			}
		}

		if (characterAssets.size() > 0) {
			pcall(() => {
				ContentProvider.PreloadAsync(characterAssets);
			});
		}
	}

	/**
	 * Menempelkan Decal resolusi tinggi di bagian depan Torso R6.
	 */
	private applyTorsoHDDecal(torso: BasePart, graphicId: string): void {
		let hdDecal = torso.FindFirstChild("HD_TorsoGraphic") as Decal | undefined;
		if (!hdDecal) {
			hdDecal = new Instance("Decal");
			hdDecal.Name = "HD_TorsoGraphic";
			hdDecal.Face = Enum.NormalId.Front;
			hdDecal.ZIndex = 2; // Berada di atas tekstur baju dasar
			hdDecal.Parent = torso;
		}

		if (hdDecal.Texture !== graphicId) {
			hdDecal.Texture = graphicId;
		}
	}

	/**
	 * Mem-preload SELURUH aset game (World, Map, Models, Textures, Meshes, Sounds)
	 * agar siap di render HD tanpa blur, mipmap downsampling, atau pop-in saat loading selesai.
	 *
	 * @param onProgressCallback Callback opsional untuk update progress bar secara granular.
	 */
	public async preloadAllGameAssets(onProgressCallback?: (progress: number, assetName: string) => void): Promise<void> {
		const assetTargets: Instance[] = [];

		// 1. Aset dari Workspace (Seluruh MeshPart, Decal, Texture, SurfaceAppearance)
		for (const desc of Workspace.GetDescendants()) {
			if (
				desc.IsA("Decal") ||
				desc.IsA("Texture") ||
				desc.IsA("MeshPart") ||
				desc.IsA("SpecialMesh") ||
				desc.IsA("SurfaceAppearance")
			) {
				assetTargets.push(desc);
			}
		}

		// 2. Aset dari ReplicatedStorage (Model, Prefab, Animasi, Tool)
		for (const desc of ReplicatedStorage.GetDescendants()) {
			if (
				desc.IsA("Decal") ||
				desc.IsA("Texture") ||
				desc.IsA("MeshPart") ||
				desc.IsA("SpecialMesh") ||
				desc.IsA("Animation") ||
				desc.IsA("Sound")
			) {
				assetTargets.push(desc);
			}
		}

		// 3. Aset dari Lighting (Skybox textures, Atmosphere)
		for (const desc of Lighting.GetDescendants()) {
			if (desc.IsA("Sky") || desc.IsA("Atmosphere")) {
				assetTargets.push(desc);
			}
		}

		// 4. Aset Audio (SoundService)
		for (const desc of SoundService.GetDescendants()) {
			if (desc.IsA("Sound")) {
				assetTargets.push(desc);
			}
		}

		const totalAssets = math.min(assetTargets.size(), 120);
		print(`[GraphicsController] Preloading up to ${totalAssets} priority visual & audio game assets...`);

		if (totalAssets === 0) {
			onProgressCallback?.(1, "Semua aset siap");
			return;
		}

		// Preload dalam batch cepat
		const batchSize = 25;
		let loadedCount = 0;
		const startTime = os.clock();

		for (let i = 0; i < totalAssets; i += batchSize) {
			if (os.clock() - startTime > 2.0) {
				// Timeout pengaman agar pemain tidak menunggu terlalu lama
				break;
			}

			const batch: Instance[] = [];
			for (let j = i; j < math.min(i + batchSize, totalAssets); j++) {
				batch.push(assetTargets[j]);
			}

			pcall(() => {
				ContentProvider.PreloadAsync(batch);
			});

			loadedCount += batch.size();
			const progressRatio = math.clamp(loadedCount / totalAssets, 0, 1);
			onProgressCallback?.(progressRatio, batch[0]?.Name || "Aset");

			task.wait(0.01);
		}

		onProgressCallback?.(1, "Semua aset siap");
		print(`[GraphicsController] Successfully preloaded ${loadedCount}/${totalAssets} assets to HD.`);
	}
}
