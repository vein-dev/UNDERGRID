import { BronxBuildingAttributes, GeneratorModuleDefinition } from "shared/types/ProceduralTypes";

const defaultAttributes: BronxBuildingAttributes = {
	GroundHeight: 15,
	FloorHeight: 13,
	BrickColor: Color3.fromRGB(138, 68, 54),
	TrimColor: Color3.fromRGB(200, 195, 185),
	NeonColor: Color3.fromRGB(255, 38, 48),
	HasWaterTower: true,
	HasRooftopHVAC: true,
	HasSkylight: true,
	HasWindowAC: true,
	HasStripedAwning: true,
	HasProduceCrates: true,
	HasMailbox: true,
	HasCornerEntrance: true,
};

interface PartOptions {
	name?: string;
	size?: Vector3;
	cf?: CFrame;
	color?: Color3;
	material?: Enum.Material;
	transparency?: number;
	reflectance?: number;
	canCollide?: boolean;
	parent: Instance;
}

function createPart(opts: PartOptions): Part {
	const p = new Instance("Part");
	p.Name = opts.name ?? "Part";
	p.Size = opts.size ?? Vector3.one;
	if (opts.cf) {
		p.CFrame = opts.cf;
	}
	p.Color = opts.color ?? Color3.fromRGB(200, 200, 200);
	p.Material = opts.material ?? Enum.Material.SmoothPlastic;
	p.Transparency = opts.transparency ?? 0;
	p.Reflectance = opts.reflectance ?? 0;
	p.Anchored = true;
	p.CanCollide = opts.canCollide !== false;
	p.TopSurface = Enum.SurfaceType.Smooth;
	p.BottomSurface = Enum.SurfaceType.Smooth;
	p.Parent = opts.parent;
	return p;
}

function createWedge(opts: PartOptions): WedgePart {
	const w = new Instance("WedgePart");
	w.Name = opts.name ?? "Wedge";
	w.Size = opts.size ?? Vector3.one;
	if (opts.cf) {
		w.CFrame = opts.cf;
	}
	w.Color = opts.color ?? Color3.fromRGB(200, 200, 200);
	w.Material = opts.material ?? Enum.Material.SmoothPlastic;
	w.Transparency = opts.transparency ?? 0;
	w.Anchored = true;
	w.CanCollide = opts.canCollide !== false;
	w.TopSurface = Enum.SurfaceType.Smooth;
	w.BottomSurface = Enum.SurfaceType.Smooth;
	w.Parent = opts.parent;
	return w;
}

function createCylinder(opts: PartOptions): Part {
	const p = new Instance("Part");
	p.Shape = Enum.PartType.Cylinder;
	p.Name = opts.name ?? "Cylinder";
	p.Size = opts.size ?? Vector3.one;
	if (opts.cf) {
		p.CFrame = opts.cf;
	}
	p.Color = opts.color ?? Color3.fromRGB(200, 200, 200);
	p.Material = opts.material ?? Enum.Material.SmoothPlastic;
	p.Transparency = opts.transparency ?? 0;
	p.Anchored = true;
	p.CanCollide = opts.canCollide !== false;
	p.TopSurface = Enum.SurfaceType.Smooth;
	p.BottomSurface = Enum.SurfaceType.Smooth;
	p.Parent = opts.parent;
	return p;
}

const Generator: GeneratorModuleDefinition<BronxBuildingAttributes> = {
	Attributes: defaultAttributes,

	OnGenerate: (parameters, targetContainer) => {
		const size = parameters.Size;
		const attrs = parameters.Attributes;
		const half = size.div(2);

		const groundH = attrs.GroundHeight;
		const f2H = math.max(10, size.Y - groundH);
		const wallThickness = 1.6;

		const darkMetal = Color3.fromRGB(48, 50, 54);
		const glassColor = Color3.fromRGB(150, 190, 210);
		const woodCedar = Color3.fromRGB(92, 65, 48);
		const hvacMetal = Color3.fromRGB(170, 175, 180);
		const awningBlue = Color3.fromRGB(32, 85, 180);
		const awningWhite = Color3.fromRGB(245, 245, 245);
		const signBlack = Color3.fromRGB(20, 20, 22);

		// Ground Y reference: bottom of ProceduralModel is -half.Y
		const baseY = -half.Y;

		// ------------------------------------------------------------------------
		// 1. FOUNDATION & SIDEWALK
		// ------------------------------------------------------------------------
		createPart({
			name: "SidewalkSlab",
			size: new Vector3(size.X + 8, 1, size.Z + 12),
			cf: new CFrame(0, baseY + 0.5, 4),
			color: Color3.fromRGB(180, 178, 175),
			material: Enum.Material.Concrete,
			parent: targetContainer,
		});

		createPart({
			name: "SidewalkCurb",
			size: new Vector3(size.X + 8, 1.2, 1),
			cf: new CFrame(0, baseY + 0.6, half.Z + 10),
			color: Color3.fromRGB(120, 118, 115),
			material: Enum.Material.Concrete,
			parent: targetContainer,
		});

		parameters.Pause();

		// ------------------------------------------------------------------------
		// 2. MAIN STOREFRONT & BRICK WALLS
		// ------------------------------------------------------------------------
		// Back Wall
		createPart({
			name: "BackWall",
			size: new Vector3(size.X, size.Y, wallThickness),
			cf: new CFrame(0, 0, -half.Z + wallThickness / 2),
			color: attrs.BrickColor,
			material: Enum.Material.Brick,
			parent: targetContainer,
		});

		// Right Wall (Full depth)
		createPart({
			name: "RightWall",
			size: new Vector3(wallThickness, size.Y, size.Z),
			cf: new CFrame(half.X - wallThickness / 2, 0, 0),
			color: attrs.BrickColor,
			material: Enum.Material.Brick,
			parent: targetContainer,
		});

		// Left Wall (Depth up to chamfer)
		const chamferDepth = math.min(10, size.Z * 0.35);
		const leftWallDepth = size.Z - chamferDepth;
		createPart({
			name: "LeftWall",
			size: new Vector3(wallThickness, size.Y, leftWallDepth),
			cf: new CFrame(-half.X + wallThickness / 2, 0, -half.Z + leftWallDepth / 2),
			color: attrs.BrickColor,
			material: Enum.Material.Brick,
			parent: targetContainer,
		});

		// 45-Degree Chamfer Corner on Front-Left
		const chamferW = math.sqrt(2 * chamferDepth * chamferDepth);
		const chamferCenter = new Vector3(-half.X + chamferDepth / 2, 0, half.Z - chamferDepth / 2);
		const chamferRot = CFrame.Angles(0, math.rad(-45), 0);

		if (attrs.HasCornerEntrance) {
			// Upper floor chamfer brick wall
			createPart({
				name: "ChamferUpperWall",
				size: new Vector3(chamferW, f2H, wallThickness),
				cf: new CFrame(chamferCenter.X, baseY + groundH + f2H / 2, chamferCenter.Z).mul(chamferRot),
				color: attrs.BrickColor,
				material: Enum.Material.Brick,
				parent: targetContainer,
			});

			// Ground floor corner entrance frame & door
			createPart({
				name: "CornerDoorFrame",
				size: new Vector3(chamferW - 0.4, groundH - 3, 1),
				cf: new CFrame(chamferCenter.X, baseY + (groundH - 3) / 2 + 1, chamferCenter.Z).mul(chamferRot),
				color: darkMetal,
				material: Enum.Material.Metal,
				parent: targetContainer,
			});

			createPart({
				name: "CornerGlassDoor",
				size: new Vector3(chamferW - 1.6, groundH - 4.5, 0.3),
				cf: new CFrame(chamferCenter.X, baseY + (groundH - 4.5) / 2 + 1, chamferCenter.Z + 0.2).mul(chamferRot),
				color: glassColor,
				material: Enum.Material.Glass,
				transparency: 0.35,
				parent: targetContainer,
			});

			// Rollup shutter housing
			createPart({
				name: "CornerRollupBox",
				size: new Vector3(chamferW, 1.4, 1.4),
				cf: new CFrame(chamferCenter.X, baseY + groundH - 1.5, chamferCenter.Z + 0.3).mul(chamferRot),
				color: Color3.fromRGB(75, 75, 80),
				material: Enum.Material.Metal,
				parent: targetContainer,
			});

			// Mini red awning
			createPart({
				name: "CornerMiniAwning",
				size: new Vector3(chamferW + 0.5, 0.4, 3.2),
				cf: new CFrame(chamferCenter.X, baseY + groundH - 0.5, chamferCenter.Z + 1.2)
					.mul(chamferRot)
					.mul(CFrame.Angles(math.rad(-22), 0, 0)),
				color: Color3.fromRGB(165, 45, 45),
				material: Enum.Material.Fabric,
				parent: targetContainer,
			});

			// Corner Neon Sign
			const cSignCF = new CFrame(chamferCenter.X, baseY + groundH + 1.2, chamferCenter.Z + 0.8).mul(chamferRot);
			const cSignBoard = createPart({
				name: "CornerSignBoard",
				size: new Vector3(chamferW, 3.2, 0.5),
				cf: cSignCF,
				color: signBlack,
				material: Enum.Material.SmoothPlastic,
				parent: targetContainer,
			});

			createPart({
				name: "CornerSignNeonBorder",
				size: new Vector3(chamferW - 0.2, 3.0, 0.2),
				cf: cSignCF.mul(new CFrame(0, 0, 0.3)),
				color: attrs.NeonColor,
				material: Enum.Material.Neon,
				parent: targetContainer,
			});

			const cSGui = new Instance("SurfaceGui");
			cSGui.Name = "CornerNeonTextGui";
			cSGui.Face = Enum.NormalId.Back;
			cSGui.CanvasSize = new Vector2(400, 160);
			cSGui.LightInfluence = 0;
			cSGui.Parent = cSignBoard;

			const cLabel1 = new Instance("TextLabel");
			cLabel1.Size = new UDim2(1, 0, 0.5, 0);
			cLabel1.Position = new UDim2(0, 0, 0.05, 0);
			cLabel1.BackgroundTransparency = 1;
			cLabel1.Font = Enum.Font.GothamBold;
			cLabel1.Text = "SL BRONX";
			cLabel1.TextColor3 = attrs.NeonColor;
			cLabel1.TextScaled = true;
			cLabel1.Parent = cSGui;

			const cLabel2 = new Instance("TextLabel");
			cLabel2.Size = new UDim2(1, 0, 0.4, 0);
			cLabel2.Position = new UDim2(0, 0, 0.55, 0);
			cLabel2.BackgroundTransparency = 1;
			cLabel2.Font = Enum.Font.GothamBold;
			cLabel2.Text = "DELI & GROCERY";
			cLabel2.TextColor3 = attrs.NeonColor;
			cLabel2.TextScaled = true;
			cLabel2.Parent = cSGui;

			const cLight = new Instance("PointLight");
			cLight.Color = attrs.NeonColor;
			cLight.Range = 20;
			cLight.Brightness = 3.0;
			cLight.Parent = cSignBoard;
		}

		parameters.Pause();

		// ------------------------------------------------------------------------
		// 3. STOREFRONT FAÇADE (GROUND FLOOR CENTER & RIGHT)
		// ------------------------------------------------------------------------
		const frontLeftX = -half.X + chamferDepth;
		const frontRightX = half.X;
		const frontW = frontRightX - frontLeftX;
		const centerWindowW = frontW * 0.55;
		const rightDoorW = frontW - centerWindowW;

		const centerWindowX = frontLeftX + centerWindowW / 2;
		const rightDoorX = frontRightX - rightDoorW / 2;
		const storefrontZ = half.Z;

		// Storefront Overhang Cornice
		createPart({
			name: "StorefrontCorniceStone",
			size: new Vector3(frontW + 1, 1, 2.5),
			cf: new CFrame(frontLeftX + frontW / 2, baseY + groundH + 0.5, storefrontZ - 0.2),
			color: attrs.TrimColor,
			material: Enum.Material.Concrete,
			parent: targetContainer,
		});

		// Center Bodega Window Base & Frame
		createPart({
			name: "StorefrontWindowBase",
			size: new Vector3(centerWindowW, 2.2, 1.4),
			cf: new CFrame(centerWindowX, baseY + 1.1, storefrontZ - 0.7),
			color: attrs.BrickColor,
			material: Enum.Material.Brick,
			parent: targetContainer,
		});

		createPart({
			name: "BodegaWindowFrame",
			size: new Vector3(centerWindowW, groundH - 4.5, 0.8),
			cf: new CFrame(centerWindowX, baseY + 2.2 + (groundH - 4.5) / 2, storefrontZ - 0.4),
			color: darkMetal,
			material: Enum.Material.Metal,
			parent: targetContainer,
		});

		const windowGlass = createPart({
			name: "BodegaWindowGlass",
			size: new Vector3(centerWindowW - 0.4, groundH - 5, 0.2),
			cf: new CFrame(centerWindowX, baseY + 2.2 + (groundH - 4.5) / 2, storefrontZ - 0.3),
			color: glassColor,
			material: Enum.Material.Glass,
			transparency: 0.45,
			parent: targetContainer,
		});

		const storeInteriorLight = new Instance("PointLight");
		storeInteriorLight.Color = Color3.fromRGB(255, 240, 215);
		storeInteriorLight.Range = 22;
		storeInteriorLight.Brightness = 2.5;
		storeInteriorLight.Parent = windowGlass;

		// Produce Crates outside bodega window
		if (attrs.HasProduceCrates) {
			const crateColors = [
				Color3.fromRGB(245, 130, 30),
				Color3.fromRGB(210, 35, 40),
				Color3.fromRGB(60, 165, 50),
				Color3.fromRGB(240, 210, 45),
			];
			const numCrates = math.min(5, math.floor(centerWindowW / 4));
			for (let c = 0; c < numCrates; c++) {
				const cx = centerWindowX - (numCrates * 3.6) / 2 + c * 3.6 + 1.8;
				createPart({
					name: `ProduceCrate_${c}`,
					size: new Vector3(3.2, 1.4, 2.2),
					cf: new CFrame(cx, baseY + 1.4, storefrontZ + 1.6),
					color: Color3.fromRGB(160, 115, 75),
					material: Enum.Material.WoodPlanks,
					parent: targetContainer,
				});
				createPart({
					name: `ProduceFruit_${c}`,
					size: new Vector3(2.8, 0.6, 1.8),
					cf: new CFrame(cx, baseY + 2.1, storefrontZ + 1.6),
					color: crateColors[c % crateColors.size()],
					material: Enum.Material.SmoothPlastic,
					parent: targetContainer,
				});
			}
		}

		// Main Neon Signboard above center window
		const signW = centerWindowW + 2;
		const signH = 4.8;
		const signCF = new CFrame(centerWindowX, baseY + groundH - signH / 2 - 0.4, storefrontZ + 0.6);

		const mainSignBoard = createPart({
			name: "MainSignBackboard",
			size: new Vector3(signW, signH, 0.8),
			cf: signCF,
			color: signBlack,
			material: Enum.Material.SmoothPlastic,
			parent: targetContainer,
		});

		// Neon Border Frame
		createPart({
			name: "NeonBorderTop",
			size: new Vector3(signW - 0.4, 0.25, 0.25),
			cf: signCF.mul(new CFrame(0, signH / 2 - 0.2, 0.45)),
			color: attrs.NeonColor,
			material: Enum.Material.Neon,
			parent: targetContainer,
		});
		createPart({
			name: "NeonBorderBottom",
			size: new Vector3(signW - 0.4, 0.25, 0.25),
			cf: signCF.mul(new CFrame(0, -signH / 2 + 0.2, 0.45)),
			color: attrs.NeonColor,
			material: Enum.Material.Neon,
			parent: targetContainer,
		});
		createPart({
			name: "NeonBorderLeft",
			size: new Vector3(0.25, signH - 0.4, 0.25),
			cf: signCF.mul(new CFrame(-signW / 2 + 0.2, 0, 0.45)),
			color: attrs.NeonColor,
			material: Enum.Material.Neon,
			parent: targetContainer,
		});
		createPart({
			name: "NeonBorderRight",
			size: new Vector3(0.25, signH - 0.4, 0.25),
			cf: signCF.mul(new CFrame(signW / 2 - 0.2, 0, 0.45)),
			color: attrs.NeonColor,
			material: Enum.Material.Neon,
			parent: targetContainer,
		});

		const mainSGui = new Instance("SurfaceGui");
		mainSGui.Name = "MainNeonTextGui";
		mainSGui.Face = Enum.NormalId.Back;
		mainSGui.CanvasSize = new Vector2(960, 200);
		mainSGui.LightInfluence = 0;
		mainSGui.Parent = mainSignBoard;

		const mainLabel1 = new Instance("TextLabel");
		mainLabel1.Size = new UDim2(1, 0, 0.52, 0);
		mainLabel1.Position = new UDim2(0, 0, 0.04, 0);
		mainLabel1.BackgroundTransparency = 1;
		mainLabel1.Font = Enum.Font.GothamBold;
		mainLabel1.Text = "SL BRONX";
		mainLabel1.TextColor3 = attrs.NeonColor;
		mainLabel1.TextScaled = true;
		mainLabel1.Parent = mainSGui;

		const mainLabel2 = new Instance("TextLabel");
		mainLabel2.Size = new UDim2(1, 0, 0.42, 0);
		mainLabel2.Position = new UDim2(0, 0, 0.52, 0);
		mainLabel2.BackgroundTransparency = 1;
		mainLabel2.Font = Enum.Font.GothamBold;
		mainLabel2.Text = "DELI & GROCERY";
		mainLabel2.TextColor3 = attrs.NeonColor;
		mainLabel2.TextScaled = true;
		mainLabel2.Parent = mainSGui;

		const mainSignLight = new Instance("PointLight");
		mainSignLight.Color = attrs.NeonColor;
		mainSignLight.Range = 28;
		mainSignLight.Brightness = 3.5;
		mainSignLight.Parent = mainSignBoard;

		// Right Entrance: Glass Doors & Striped Awning
		createPart({
			name: "RightStoreWallUpper",
			size: new Vector3(rightDoorW, 3.5, wallThickness),
			cf: new CFrame(rightDoorX, baseY + groundH - 1.75, storefrontZ - wallThickness / 2),
			color: attrs.BrickColor,
			material: Enum.Material.Brick,
			parent: targetContainer,
		});

		createPart({
			name: "RightDoorFrame",
			size: new Vector3(rightDoorW, groundH - 4.5, 1),
			cf: new CFrame(rightDoorX, baseY + (groundH - 4.5) / 2 + 1, storefrontZ - 0.5),
			color: darkMetal,
			material: Enum.Material.Metal,
			parent: targetContainer,
		});

		// Closed left leaf
		createPart({
			name: "RightDoorLeafClosed",
			size: new Vector3(rightDoorW * 0.45, groundH - 5.5, 0.25),
			cf: new CFrame(rightDoorX - rightDoorW * 0.22, baseY + (groundH - 5.5) / 2 + 1, storefrontZ - 0.4),
			color: glassColor,
			material: Enum.Material.Glass,
			transparency: 0.35,
			parent: targetContainer,
		});

		// Open right leaf (swung outward ~25 degrees)
		const doorPivot = new Vector3(rightDoorX + rightDoorW * 0.45, baseY + (groundH - 5.5) / 2 + 1, storefrontZ - 0.4);
		const openDoorCF = new CFrame(doorPivot)
			.mul(CFrame.Angles(0, math.rad(28), 0))
			.mul(new CFrame(-rightDoorW * 0.22, 0, 0));

		createPart({
			name: "RightDoorLeafOpen",
			size: new Vector3(rightDoorW * 0.45, groundH - 5.5, 0.25),
			cf: openDoorCF,
			color: glassColor,
			material: Enum.Material.Glass,
			transparency: 0.35,
			parent: targetContainer,
		});

		// Blue & White Striped Fabric Awning
		if (attrs.HasStripedAwning) {
			const numStripes = 12;
			const stripeW = rightDoorW / numStripes;
			const awningY = baseY + groundH - 2.8;
			const awningZ = storefrontZ + 2.2;

			for (let s = 0; s < numStripes; s++) {
				const sx = rightDoorX - rightDoorW / 2 + s * stripeW + stripeW / 2;
				const sColor = s % 2 === 0 ? awningBlue : awningWhite;

				createPart({
					name: `AwningStripe_${s}`,
					size: new Vector3(stripeW, 0.25, 4.6),
					cf: new CFrame(sx, awningY, awningZ).mul(CFrame.Angles(math.rad(-22), 0, 0)),
					color: sColor,
					material: Enum.Material.Fabric,
					parent: targetContainer,
				});

				createPart({
					name: `AwningValance_${s}`,
					size: new Vector3(stripeW, 1.2, 0.25),
					cf: new CFrame(sx, awningY - 1.45, awningZ + 2.1),
					color: sColor,
					material: Enum.Material.Fabric,
					parent: targetContainer,
				});
			}
		}

		parameters.Pause();

		// ------------------------------------------------------------------------
		// 4. SECOND FLOOR FAÇADE & 7 WINDOWS (SETBACK)
		// ------------------------------------------------------------------------
		const f2Z = storefrontZ - 2.4; // 2.4 studs setback from ground storefront!
		const f2CenterY = baseY + groundH + f2H / 2;
		const numWindows = 7;
		const winColW = frontW / numWindows;
		const winW = math.min(3.4, winColW * 0.65);
		const winH = math.min(6.8, f2H * 0.55);

		// Lower solid wall
		createPart({
			name: "F2_LowerWall",
			size: new Vector3(frontW, 3.2, wallThickness),
			cf: new CFrame(frontLeftX + frontW / 2, baseY + groundH + 1.6, f2Z),
			color: attrs.BrickColor,
			material: Enum.Material.Brick,
			parent: targetContainer,
		});

		// Upper solid wall
		createPart({
			name: "F2_UpperWall",
			size: new Vector3(frontW, 2.8, wallThickness),
			cf: new CFrame(frontLeftX + frontW / 2, baseY + groundH + f2H - 1.4, f2Z),
			color: attrs.BrickColor,
			material: Enum.Material.Brick,
			parent: targetContainer,
		});

		// Generate 7 Windows with Stone Lintels & Sills
		for (let i = 0; i < numWindows; i++) {
			const wx = frontLeftX + i * winColW + winColW / 2;

			// Stone Sill (bottom)
			createPart({
				name: `StoneSill_${i}`,
				size: new Vector3(winW + 0.6, 0.6, 1.8),
				cf: new CFrame(wx, baseY + groundH + 3.4, f2Z + 0.2),
				color: attrs.TrimColor,
				material: Enum.Material.Concrete,
				parent: targetContainer,
			});

			// Stone Lintel (top ornate beam)
			createPart({
				name: `StoneLintel_${i}`,
				size: new Vector3(winW + 0.6, 0.9, 1.8),
				cf: new CFrame(wx, baseY + groundH + 3.4 + winH + 0.5, f2Z + 0.2),
				color: attrs.TrimColor,
				material: Enum.Material.Concrete,
				parent: targetContainer,
			});

			// Window Frame & Glass
			createPart({
				name: `WindowFrame_${i}`,
				size: new Vector3(winW, winH, 0.6),
				cf: new CFrame(wx, baseY + groundH + 3.4 + winH / 2, f2Z),
				color: darkMetal,
				material: Enum.Material.Metal,
				parent: targetContainer,
			});

			createPart({
				name: `WindowGlass_${i}`,
				size: new Vector3(winW - 0.4, winH - 0.4, 0.2),
				cf: new CFrame(wx, baseY + groundH + 3.4 + winH / 2, f2Z + 0.1),
				color: glassColor,
				material: Enum.Material.Glass,
				transparency: 0.45,
				parent: targetContainer,
			});

			// Window 2 has the Window Air Conditioner (AC Unit)!
			if (i === 1 && attrs.HasWindowAC) {
				createPart({
					name: "Window_AC_Body",
					size: new Vector3(winW * 0.75, 1.8, 2.4),
					cf: new CFrame(wx, baseY + groundH + 4.5, f2Z + 1.0),
					color: Color3.fromRGB(225, 225, 220),
					material: Enum.Material.SmoothPlastic,
					parent: targetContainer,
				});
				createPart({
					name: "Window_AC_Grill",
					size: new Vector3(winW * 0.7, 1.4, 0.2),
					cf: new CFrame(wx, baseY + groundH + 4.5, f2Z + 2.25),
					color: Color3.fromRGB(75, 75, 80),
					material: Enum.Material.Metal,
					parent: targetContainer,
				});
			}

			// Brick pier between windows
			if (i < numWindows - 1) {
				const pierX = wx + winColW / 2;
				const pierW = winColW - winW;
				createPart({
					name: `F2_Pier_${i}`,
					size: new Vector3(pierW, winH + 1.4, wallThickness),
					cf: new CFrame(pierX, baseY + groundH + 3.4 + winH / 2, f2Z),
					color: attrs.BrickColor,
					material: Enum.Material.Brick,
					parent: targetContainer,
				});
			}
		}

		parameters.Pause();

		// ------------------------------------------------------------------------
		// 5. ROOFTOP & DETAILED PROPS
		// ------------------------------------------------------------------------
		const roofY = half.Y;

		// Roof Parapets with Stone Copings
		const parapetH = 3.5;
		const parapetCFrameY = roofY + parapetH / 2;

		createPart({
			name: "ParapetFront",
			size: new Vector3(size.X, parapetH, wallThickness),
			cf: new CFrame(0, parapetCFrameY, half.Z - wallThickness / 2),
			color: attrs.BrickColor,
			material: Enum.Material.Brick,
			parent: targetContainer,
		});
		createPart({
			name: "ParapetBack",
			size: new Vector3(size.X, parapetH, wallThickness),
			cf: new CFrame(0, parapetCFrameY, -half.Z + wallThickness / 2),
			color: attrs.BrickColor,
			material: Enum.Material.Brick,
			parent: targetContainer,
		});
		createPart({
			name: "ParapetLeft",
			size: new Vector3(wallThickness, parapetH, size.Z),
			cf: new CFrame(-half.X + wallThickness / 2, parapetCFrameY, 0),
			color: attrs.BrickColor,
			material: Enum.Material.Brick,
			parent: targetContainer,
		});
		createPart({
			name: "ParapetRight",
			size: new Vector3(wallThickness, parapetH, size.Z),
			cf: new CFrame(half.X - wallThickness / 2, parapetCFrameY, 0),
			color: attrs.BrickColor,
			material: Enum.Material.Brick,
			parent: targetContainer,
		});

		// Stone Copings
		createPart({
			name: "CopingFront",
			size: new Vector3(size.X + 0.4, 0.6, wallThickness + 0.6),
			cf: new CFrame(0, roofY + parapetH + 0.3, half.Z - wallThickness / 2),
			color: attrs.TrimColor,
			material: Enum.Material.Concrete,
			parent: targetContainer,
		});
		createPart({
			name: "CopingBack",
			size: new Vector3(size.X + 0.4, 0.6, wallThickness + 0.6),
			cf: new CFrame(0, roofY + parapetH + 0.3, -half.Z + wallThickness / 2),
			color: attrs.TrimColor,
			material: Enum.Material.Concrete,
			parent: targetContainer,
		});

		// Raised Central Roof Bulkhead Pad
		const padW = size.X * 0.7;
		const padD = size.Z * 0.65;
		createPart({
			name: "RooftopBulkheadPad",
			size: new Vector3(padW, 2.4, padD),
			cf: new CFrame(0, roofY + 1.2, 0),
			color: Color3.fromRGB(120, 118, 115),
			material: Enum.Material.Concrete,
			parent: targetContainer,
		});

		// A. NYC Wooden Water Tower (Right Corner of Roof)
		if (attrs.HasWaterTower) {
			const wtX = half.X - 10;
			const wtZ = 0;
			const wtBaseY = roofY + 2.4;
			const legH = 8.5;
			const legSpread = 3.2;

			const legOffsets = [
				new Vector3(-legSpread, 0, -legSpread),
				new Vector3(legSpread, 0, -legSpread),
				new Vector3(-legSpread, 0, legSpread),
				new Vector3(legSpread, 0, legSpread),
			];

			for (let l = 0; l < legOffsets.size(); l++) {
				const off = legOffsets[l];
				createPart({
					name: `WaterTowerLeg_${l}`,
					size: new Vector3(0.8, legH, 0.8),
					cf: new CFrame(wtX + off.X, wtBaseY + legH / 2, wtZ + off.Z),
					color: woodCedar,
					material: Enum.Material.WoodPlanks,
					parent: targetContainer,
				});
			}

			// Platform deck
			const deckY = wtBaseY + legH;
			createPart({
				name: "WaterTowerPlatform",
				size: new Vector3(8.5, 0.6, 8.5),
				cf: new CFrame(wtX, deckY, wtZ),
				color: woodCedar,
				material: Enum.Material.WoodPlanks,
				parent: targetContainer,
			});

			// Cylindrical Barrel
			const tankH = 7.5;
			const tankR = 3.6;
			const tankCenterY = deckY + tankH / 2 + 0.3;

			createCylinder({
				name: "WaterTankBarrel",
				size: new Vector3(tankH, tankR * 2, tankR * 2),
				cf: new CFrame(wtX, tankCenterY, wtZ).mul(CFrame.Angles(0, 0, math.rad(90))),
				color: woodCedar,
				material: Enum.Material.WoodPlanks,
				parent: targetContainer,
			});

			// Metal Hoops
			for (const hoopOff of [-2.5, 0, 2.5]) {
				createCylinder({
					name: "WaterTankHoop",
					size: new Vector3(0.3, tankR * 2 + 0.15, tankR * 2 + 0.15),
					cf: new CFrame(wtX, tankCenterY + hoopOff, wtZ).mul(CFrame.Angles(0, 0, math.rad(90))),
					color: darkMetal,
					material: Enum.Material.Metal,
					parent: targetContainer,
				});
			}

			// Conical Roof
			const coneBaseY = tankCenterY + tankH / 2;
			const coneH = 3.2;
			const coneSpan = tankR + 0.3;

			createWedge({
				name: "RoofWedgeN",
				size: new Vector3(coneSpan * 2, coneH, coneSpan),
				cf: new CFrame(wtX, coneBaseY + coneH / 2, wtZ - coneSpan / 2),
				color: Color3.fromRGB(80, 58, 42),
				material: Enum.Material.WoodPlanks,
				parent: targetContainer,
			});
			createWedge({
				name: "RoofWedgeS",
				size: new Vector3(coneSpan * 2, coneH, coneSpan),
				cf: new CFrame(wtX, coneBaseY + coneH / 2, wtZ + coneSpan / 2).mul(CFrame.Angles(0, math.rad(180), 0)),
				color: Color3.fromRGB(80, 58, 42),
				material: Enum.Material.WoodPlanks,
				parent: targetContainer,
			});
			createPart({
				name: "WaterTowerFinial",
				size: new Vector3(0.5, 1.4, 0.5),
				cf: new CFrame(wtX, coneBaseY + coneH + 0.7, wtZ),
				color: darkMetal,
				material: Enum.Material.Metal,
				parent: targetContainer,
			});
		}

		// B. Glass Pyramid Skylight (Center of Roof)
		if (attrs.HasSkylight) {
			const slX = 0;
			const slZ = 0;
			const slBaseY = roofY + 2.4;
			const slW = 9;
			const slD = 6.5;
			const slH = 2.6;

			createPart({
				name: "SkylightCurb",
				size: new Vector3(slW + 0.6, 0.6, slD + 0.6),
				cf: new CFrame(slX, slBaseY + 0.3, slZ),
				color: darkMetal,
				material: Enum.Material.Metal,
				parent: targetContainer,
			});

			createWedge({
				name: "SkylightGlassN",
				size: new Vector3(slW, slH, slD / 2),
				cf: new CFrame(slX, slBaseY + 0.6 + slH / 2, slZ - slD / 4),
				color: glassColor,
				material: Enum.Material.Glass,
				transparency: 0.4,
				reflectance: 0.3,
				parent: targetContainer,
			});
			createWedge({
				name: "SkylightGlassS",
				size: new Vector3(slW, slH, slD / 2),
				cf: new CFrame(slX, slBaseY + 0.6 + slH / 2, slZ + slD / 4).mul(CFrame.Angles(0, math.rad(180), 0)),
				color: glassColor,
				material: Enum.Material.Glass,
				transparency: 0.4,
				reflectance: 0.3,
				parent: targetContainer,
			});
		}

		// C. Industrial Rooftop HVAC Units & Metal Ducting
		if (attrs.HasRooftopHVAC) {
			const hvacBaseY = roofY + 2.4;
			const hvacX = -half.X + 10;

			createPart({
				name: "HVAC_MainCabinet",
				size: new Vector3(4.5, 3.2, 4.5),
				cf: new CFrame(hvacX, hvacBaseY + 1.6, 0),
				color: hvacMetal,
				material: Enum.Material.Metal,
				parent: targetContainer,
			});

			createCylinder({
				name: "HVAC_TopFanGrill",
				size: new Vector3(0.3, 3.4, 3.4),
				cf: new CFrame(hvacX, hvacBaseY + 3.3, 0).mul(CFrame.Angles(0, 0, math.rad(90))),
				color: Color3.fromRGB(55, 58, 62),
				material: Enum.Material.Metal,
				parent: targetContainer,
			});

			createPart({
				name: "SheetMetalDuct",
				size: new Vector3(8, 1.8, 2.2),
				cf: new CFrame(hvacX + 6, hvacBaseY + 0.9, 0),
				color: hvacMetal,
				material: Enum.Material.Metal,
				parent: targetContainer,
			});
		}

		// D. Street Props: USPS Blue Mailbox on Sidewalk
		if (attrs.HasMailbox) {
			const mbX = centerWindowX + 2;
			const mbZ = storefrontZ + 8;
			const mbBaseY = baseY + 1;

			createPart({
				name: "MailboxBody",
				size: new Vector3(2.2, 2.4, 1.8),
				cf: new CFrame(mbX, mbBaseY + 1.8, mbZ),
				color: Color3.fromRGB(16, 70, 165),
				material: Enum.Material.SmoothPlastic,
				parent: targetContainer,
			});

			createCylinder({
				name: "MailboxCurvedTop",
				size: new Vector3(1.8, 2.2, 2.2),
				cf: new CFrame(mbX, mbBaseY + 3.0, mbZ).mul(CFrame.Angles(math.rad(90), 0, 0)),
				color: Color3.fromRGB(16, 70, 165),
				material: Enum.Material.SmoothPlastic,
				parent: targetContainer,
			});
		}
	},
};

export = Generator;
