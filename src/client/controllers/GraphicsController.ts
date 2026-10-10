import {
	ContentProvider,
	Lighting,
	Players,
	ReplicatedStorage,
	RunService,
	SoundService,
	UserInputService,
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

		// 3. Pasang Dynamic Focus Tracking agar kamera selalu fokus tajam ke karakter pemain
		this.startDynamicDepthOfFieldTracking();

		print("[GraphicsController] Initialized: Global HD Assets & Lighting pipeline active.");
	}

	/**
	 * Mengoptimalkan pencahayaan dan mengkalibrasi efek DepthOfField bergaya DSLR Bokeh.
	 * Memastikan karakter pemain selalu 100% tajam dan detail, sementara latar belakang blur sinematik.
	 */
	public optimizeLighting(): void {
		pcall(() => {
			const isMobile = UserInputService.TouchEnabled && !UserInputService.KeyboardEnabled;
			Lighting.GlobalShadows = true;

			// Pastikan mode Realistic aktif pada Roblox Unified Lighting System terbaru
			const enumRecord = Enum as unknown as Record<string, Record<string, unknown>>;
			const lightingRecord = Lighting as unknown as Record<string, unknown>;
			if (enumRecord.LightingStyle?.Realistic) {
				lightingRecord.LightingStyle = enumRecord.LightingStyle.Realistic;
			}
			if (lightingRecord.PrioritizeLightingQuality !== undefined) {
				lightingRecord.PrioritizeLightingQuality = !isMobile;
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
			bloom.Intensity = isMobile ? 0.16 : 0.22; // Glow lembut terukur
			bloom.Size = isMobile ? 12 : 16;
			bloom.Threshold = 3.0; // Threshold tinggi: hanya neon/bohlam sejati yang glow, jalan & pakaian tetap matte
			bloom.Enabled = true;

			// 2. Realistic DSLR Bokeh DepthOfField (Karakter utama tajam & fokus, latar belakang blur sinematik)
			let dof = Lighting.FindFirstChildOfClass("DepthOfFieldEffect");
			if (!dof) {
				dof = new Instance("DepthOfFieldEffect");
				dof.Name = "DepthOfField";
				dof.Parent = Lighting;
			}
			dof.NearIntensity = 0; // Karakter, tangan, dan pakaian 100% selalu tajam (tanpa blur depan)
			dof.FocusDistance = 15; // Jarak fokus dasar ke karakter (diperbarui dinamis per frame)
			dof.InFocusRadius = 20; // Zona tajam di sekitar karakter (pijakan kaki & lawan dekat tetap tajam)
			dof.FarIntensity = 0.75; // Efek bokeh/blur creamy pada latar belakang gedung/pohon persis foto referensi
			dof.Enabled = true;

			// 3. Cinematic Soft God Rays (SunRays halus merata tanpa artefak garis kasar)
			let sunRays = Lighting.FindFirstChildOfClass("SunRaysEffect");
			if (!sunRays) {
				sunRays = new Instance("SunRaysEffect");
				sunRays.Name = "SunRays";
				sunRays.Parent = Lighting;
			}
			sunRays.Intensity = isMobile ? 0.1 : 0.2;
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
	 * Mem-preload aset visual dan audio game secara cerdas (Smart Hybrid Preloading).
	 * Aset prioritas (Lighting, Sky, Audio, dan visual utama) dimuat dalam batas waktu loading screen (~10.5 detik),
	 * sedangkan sisa aset seisi map dilanjutkan di latar belakang (background) secara non-blocking
	 * agar tidak memicu lag dan tidak pernah menahan layar pemain terlalu lama.
	 *
	 * @param onProgressCallback Callback opsional untuk update progress bar secara granular.
	 * @param timeBudgetSec Alokasi waktu maksimal pemuatan sinkron (default: 10.5 detik).
	 */
	public async preloadAllGameAssets(
		onProgressCallback?: (progress: number, assetName: string, loadedCount?: number, totalCount?: number) => void,
		timeBudgetSec: number = 10.5,
	): Promise<void> {
		const priorityTargets: Instance[] = [];
		const mapTargets: Instance[] = [];

		// 1. Aset Prioritas Utama: Lighting (Skybox, Atmosphere) & Audio (SoundService)
		for (const desc of Lighting.GetDescendants()) {
			if (desc.IsA("Sky") || desc.IsA("Atmosphere")) {
				priorityTargets.push(desc);
			}
		}
		for (const desc of SoundService.GetDescendants()) {
			if (desc.IsA("Sound")) {
				priorityTargets.push(desc);
			}
		}

		// 2. Aset ReplicatedStorage (Prefab, Tool, Animasi, Model)
		for (const desc of ReplicatedStorage.GetDescendants()) {
			if (
				desc.IsA("Decal") ||
				desc.IsA("Texture") ||
				desc.IsA("MeshPart") ||
				desc.IsA("SpecialMesh") ||
				desc.IsA("SurfaceAppearance") ||
				desc.IsA("Animation") ||
				desc.IsA("Sound")
			) {
				priorityTargets.push(desc);
			}
		}

		// 3. Aset dari Workspace (Geometri & Dekorasi Map)
		for (const desc of Workspace.GetDescendants()) {
			if (
				desc.IsA("Decal") ||
				desc.IsA("Texture") ||
				desc.IsA("MeshPart") ||
				desc.IsA("SpecialMesh") ||
				desc.IsA("SurfaceAppearance")
			) {
				mapTargets.push(desc);
			}
		}

		// Gabungkan dengan prioritas visual utama di depan
		const combinedTargets = [...priorityTargets, ...mapTargets];
		const totalAssets = combinedTargets.size();

		print(`[GraphicsController] Starting Smart Hybrid Preload: ${totalAssets} total assets (Priority: ${priorityTargets.size()}, Map: ${mapTargets.size()}).`);

		if (totalAssets === 0) {
			onProgressCallback?.(1, "Semua aset siap", 0, 0);
			return;
		}

		const batchSize = 60;
		let loadedCount = 0;
		const startTime = os.clock();
		let remainingBatchIndex = 0;

		// Fase Sinkron: Muat aset sebanyak mungkin dalam rentang waktu terukur
		for (let i = 0; i < totalAssets; i += batchSize) {
			if (os.clock() - startTime >= timeBudgetSec) {
				remainingBatchIndex = i;
				break;
			}

			const batch: Instance[] = [];
			for (let j = i; j < math.min(i + batchSize, totalAssets); j++) {
				batch.push(combinedTargets[j]);
			}

			pcall(() => {
				ContentProvider.PreloadAsync(batch);
			});

			loadedCount += batch.size();
			const progressRatio = math.clamp(loadedCount / totalAssets, 0, 1);
			const currentName = batch[0]?.Name || "Aset";
			onProgressCallback?.(progressRatio, currentName, loadedCount, totalAssets);

			task.wait(0.01);
		}

		// Berikan sinyal bahwa fase loading screen telah selesai memuat aset prioritas
		onProgressCallback?.(1, "Aset prioritas siap", loadedCount, totalAssets);
		print(
			`[GraphicsController] Synchronous preload completed: ${loadedCount}/${totalAssets} assets in ${string.format("%.2f", os.clock() - startTime)}s.`,
		);

		// Fase Background: Jika masih ada sisa aset map, lanjutkan di background secara non-blocking
		if (remainingBatchIndex > 0 && remainingBatchIndex < totalAssets) {
			task.spawn(() => {
				const backgroundStart = os.clock();
				for (let i = remainingBatchIndex; i < totalAssets; i += batchSize) {
					const batch: Instance[] = [];
					for (let j = i; j < math.min(i + batchSize, totalAssets); j++) {
						batch.push(combinedTargets[j]);
					}

					pcall(() => {
						ContentProvider.PreloadAsync(batch);
					});

					loadedCount += batch.size();
					task.wait(0.05); // Throttle agar CPU dan memori tetap santai saat pemain mulai bermain
				}
				print(
					`[GraphicsController] Background preload completed: all ${totalAssets} assets cached in ${string.format("%.2f", os.clock() - backgroundStart)}s.`,
				);
			});
		}
	}

	/**
	 * Memaksa server Roblox streaming geometri map di sekitar spawn lokasi pemain.
	 * Dilengkapi batas waktu aman (maks 2.5s) agar pemain dengan jaringan lambat tidak hang.
	 */
	public async requestMapStreamAroundPlayer(): Promise<void> {
		const player = Players.LocalPlayer;
		let char = player.Character;

		// Cek langsung jika root part sudah ada
		let rootPart = char?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

		if (!rootPart) {
			// Tunggu dengan batas pengaman maksimal 2.5 detik
			const waitStart = os.clock();
			while (!rootPart && os.clock() - waitStart < 2.5) {
				char = player.Character;
				if (char) {
					rootPart = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
				}
				if (rootPart) break;
				task.wait(0.1);
			}
		}

		if (rootPart) {
			pcall(() => {
				player.RequestStreamAroundAsync(rootPart.Position);
			});
			task.wait(0.2);
		}
	}

	/**
	 * Memantau antrean unduhan internal Roblox (ContentProvider.RequestQueueSize)
	 * dengan batas toleransi ketat (maksimal 1.0s) agar tidak menahan pemain.
	 */
	public async waitForTextureAndMeshQueue(onQueueUpdate?: (remaining: number) => void): Promise<void> {
		const maxWait = 1.0; // Maksimal 1.0 detik toleransi antrean
		const startTime = os.clock();

		while (ContentProvider.RequestQueueSize > 0) {
			if (os.clock() - startTime >= maxWait) {
				break;
			}
			const remaining = ContentProvider.RequestQueueSize;
			onQueueUpdate?.(remaining);
			task.wait(0.1);
		}
	}

	/**
	 * Melacak jarak kamera ke karakter pemain secara dinamis setiap frame.
	 * Menjamin karakter pemain selalu berada di titik fokus tertajam (FocusDistance),
	 * sementara latar belakang di kejauhan otomatis mendapatkan efek blur bokeh DSLR yang halus seperti foto referensi.
	 */
	private startDynamicDepthOfFieldTracking(): void {
		const localPlayer = Players.LocalPlayer;
		const dof = Lighting.FindFirstChildOfClass("DepthOfFieldEffect");
		if (!dof) return;

		RunService.RenderStepped.Connect(() => {
			const camera = Workspace.CurrentCamera;
			const character = localPlayer.Character;
			if (!camera || !character) return;

			const rootPart = (character.FindFirstChild("HumanoidRootPart") ??
				character.FindFirstChild("Head")) as BasePart | undefined;
			if (!rootPart) return;

			const distance = camera.CFrame.Position.sub(rootPart.Position).Magnitude;
			dof.FocusDistance = math.clamp(distance, 4, 100);
		});
	}
}
