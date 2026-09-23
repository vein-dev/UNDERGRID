import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { CreateGenericStory, Slider, Choose } from "@rbxts/ui-labs";
import { BACKDROP_GIF_PRESETS } from "shared/config";

interface StoryProps {
	preset: string;
	fps: number;
	brightness: number;
}

function BackdropGifPreview({ preset, fps, brightness }: StoryProps) {
	const selectedPreset = BACKDROP_GIF_PRESETS.find((p) => p.name === preset) ?? BACKDROP_GIF_PRESETS[0];
	const [frame, setFrame] = useState(0);

	useEffect(() => {
		let current = 0;
		const interval = 1 / math.max(1, fps);
		let running = true;

		task.spawn(() => {
			while (running) {
				task.wait(interval);
				if (!running) break;
				current = (current + 1) % selectedPreset.totalFrames;
				setFrame(current);
			}
		});

		return () => {
			running = false;
		};
	}, [selectedPreset, fps]);

	const col = frame % selectedPreset.columns;
	const row = math.floor(frame / selectedPreset.columns);
	const frameWidth = math.floor(1024 / selectedPreset.columns);
	const frameHeight = math.floor(1024 / selectedPreset.rows);

	return (
		<frame
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundColor3={Color3.fromRGB(10, 10, 15)}
			BorderSizePixel={0}
		>
			{/* Aspect Ratio Constraint for Standard 16:9 Stage Backdrop */}
			<uiaspectratioconstraint AspectRatio={16 / 9} />

			{/* Screen Bezel Frame */}
			<frame
				Size={new UDim2(0.92, 0, 0.92, 0)}
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				BackgroundColor3={Color3.fromRGB(0, 0, 0)}
				BorderSizePixel={0}
				ClipsDescendants={true}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				<uistroke
					Color={selectedPreset.accentColor ?? Color3.fromRGB(0, 229, 255)}
					Transparency={math.clamp(1 - brightness / 3, 0.1, 0.8)}
					Thickness={2}
				/>

				{/* Animated GIF Frame */}
				<imagelabel
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundTransparency={1}
					Image={selectedPreset.assetId}
					ImageRectOffset={new Vector2(col * frameWidth, row * frameHeight)}
					ImageRectSize={new Vector2(frameWidth, frameHeight)}
					ScaleType={Enum.ScaleType.Stretch}
					ResampleMode={Enum.ResamplerMode.Pixelated}
				/>
			</frame>
		</frame>
	);
}

const story = CreateGenericStory(
	{
		name: "Stage Backdrop GIF Player",
		summary: "Preview animated GIF / sprite sheet player on the stage LED screen with preset switcher and FPS slider",
		controls: {
			preset: Choose(
				BACKDROP_GIF_PRESETS.map((p) => p.name),
				1,
			),
			fps: Slider(15, 1, 30, 1),
			brightness: Slider(2.0, 0.5, 4.0, 0.1),
		},
	},
	(props) => {
		const root = ReactRoblox.createRoot(props.target);
		root.render(
			<BackdropGifPreview
				preset={props.controls.preset}
				fps={props.controls.fps}
				brightness={props.controls.brightness}
			/>,
		);

		const unsub = props.subscribe((controls) => {
			root.render(
				<BackdropGifPreview
					preset={controls.preset}
					fps={controls.fps}
					brightness={controls.brightness}
				/>,
			);
		});

		return () => {
			unsub();
			root.unmount();
		};
	},
);

export = story;
