-- AutoCleanProceduralPlugin.server.luau
-- Plugin Roblox Studio otomatis untuk melenyapkan starter template HelloWorldGenerator
-- seketika saat membuat atau menyisipkan ProceduralModel baru.

local function cleanModel(pm: Instance)
	if not pm:IsA("ProceduralModel") then return end

	task.defer(function()
		if not pm or not pm.Parent then return end

		local hw = pm:FindFirstChild("HelloWorldGenerator")
		if hw and hw:IsA("ModuleScript") then
			local gen = (pm :: any).Generator
			if gen == hw or (gen and gen.Name == "HelloWorldGenerator") then
				(pm :: any).Generator = nil
			end
			hw:Destroy()
			print("[AutoCleanProceduralPlugin] Berhasil menghapus starter template HelloWorldGenerator dari:", pm.Name)
		end
	end)
end

-- 1. Pantau setiap instance baru yang dimasukkan ke Workspace
workspace.DescendantAdded:Connect(function(descendant: Instance)
	if descendant:IsA("ProceduralModel") then
		cleanModel(descendant)
		descendant.ChildAdded:Connect(function(child)
			if child.Name == "HelloWorldGenerator" then
				cleanModel(descendant)
			end
		end)
	elseif descendant.Name == "HelloWorldGenerator" and descendant:IsA("ModuleScript") then
		local parent = descendant.Parent
		if parent and parent:IsA("ProceduralModel") then
			cleanModel(parent)
		end
	end
end)

-- 2. Bersihkan instance yang sudah ada saat plugin aktif
for _, desc in ipairs(workspace:GetDescendants()) do
	if desc:IsA("ProceduralModel") then
		cleanModel(desc)
	end
end

print("[AutoCleanProceduralPlugin] Aktif! Starter template HelloWorldGenerator akan otomatis dilenyapkan saat ProceduralModel dibuat.")
