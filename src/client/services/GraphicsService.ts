import { Lighting } from "@rbxts/services";

export type GraphicsPreset = "Low" | "Medium" | "High" | "Ultra";

/**
 * Client-side Singleton Service responsible for applying graphics presets
 * to Roblox Lighting, post-processing effects, and shadow rendering.
 */
export class GraphicsService {
	private static instance?: GraphicsService;
	private currentPreset: GraphicsPreset = "High";
	private presetChangedCallbacks: Array<(preset: GraphicsPreset) => void> = [];

	private constructor() {
		this.applyPreset(this.currentPreset);
	}

	public static getInstance(): GraphicsService {
		if (!GraphicsService.instance) {
			GraphicsService.instance = new GraphicsService();
		}
		return GraphicsService.instance;
	}

	public getPreset(): GraphicsPreset {
		return this.currentPreset;
	}

	public setPreset(preset: GraphicsPreset): void {
		if (this.currentPreset === preset) return;
		this.currentPreset = preset;
		this.applyPreset(preset);

		for (const cb of this.presetChangedCallbacks) {
			cb(preset);
		}
	}

	public onPresetChanged(callback: (preset: GraphicsPreset) => void): () => void {
		this.presetChangedCallbacks.push(callback);
		return () => {
			this.presetChangedCallbacks = this.presetChangedCallbacks.filter((cb) => cb !== callback);
		};
	}

	private applyPreset(preset: GraphicsPreset): void {
		// 1. Kontrol Bayangan Global (Sangat berpengaruh pada FPS mobile)
		if (preset === "Low") {
			Lighting.GlobalShadows = false;
		} else {
			Lighting.GlobalShadows = true;
		}

		// 2. Kontrol Post-Processing Effects di game.Lighting
		for (const child of Lighting.GetChildren()) {
			if (child.IsA("DepthOfFieldEffect")) {
				child.Enabled = preset === "High" || preset === "Ultra";
			} else if (child.IsA("SunRaysEffect")) {
				child.Enabled = preset !== "Low";
			} else if (child.IsA("BloomEffect")) {
				child.Enabled = true;
				if (preset === "Low") {
					child.Intensity = 0.4;
					child.Size = 12;
				} else if (preset === "Medium") {
					child.Intensity = 0.8;
					child.Size = 18;
				} else if (preset === "High") {
					child.Intensity = 1.0;
					child.Size = 24;
				} else if (preset === "Ultra") {
					child.Intensity = 1.25;
					child.Size = 28;
				}
			} else if (child.IsA("BlurEffect")) {
				// Jangan sentuh blur menu/modal
				if (child.Name !== "MenuBlur" && child.Name !== "ModalBlur") {
					child.Enabled = preset !== "Low";
				}
			}
		}

		print(`[GraphicsService] Graphics Preset applied: ${preset}`);
	}
}
