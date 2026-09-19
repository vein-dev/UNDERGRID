--!strict
-- Animate.client.luau
-- Script Animate terstandarisasi untuk StarterCharacterScripts.
-- Keberadaan script ini mencegah Roblox Engine menyuntikkan script Animate kuno yang menyebabkan batas 64 tracks terlampaui.
-- Seluruh animasi locomotion (idle, walk, run, jump, fall, climb) dikelola secara terpusat dan ter-cache oleh MovementController.

local character = script.Parent
if not character then return end
