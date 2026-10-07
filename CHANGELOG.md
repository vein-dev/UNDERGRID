# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-10-08

### Added
- **Mobile Map & Graphics Performance Optimization**:
  - **Massive Workspace Cleanup (-70% Descendants)**:
    - Archived 51,225 raw editor animation/pose instances from `Workspace` into `ServerStorage/WorkspaceBackupAnimations`, freeing significant mobile RAM and replication overhead.
  - **Dynamic Lighting & Shadow Pass Relief**:
    - Disabled shadows across 66 dynamic stage/room lights to eliminate crippling multi-pass shadow render bottlenecks on mobile GPUs.
    - Disabled `CastShadow` on 9,131 small decorative parts and props (<= 4 studs), drastically cutting shadow geometry draw calls.
  - **Automatic LOD Mesh Scaling**:
    - Upgraded 1,310 `MeshPart`s from fixed `Precise` rendering to `RenderFidelity.Automatic`, enabling engine Level-of-Detail geometry culling at distance.
  - **Physics & Raycast Query Optimization**:
    - Disabled `CanTouch` and `CanQuery` on 4,600+ static decorative props and set `CollisionFidelity` to `Box`/`Hull`, streamlining mobile physics step times.
  - **Transparency Overdraw & Decal Deduplication**:
    - Eliminated 820 duplicate and 100% invisible decals across fence props, removing severe alpha overdraw layers on mobile GPUs.
  - **Adaptive Mobile Client Shaders ([GraphicsController.ts](file:///c:/Users/jordi/OneDrive/Desktop/Roblox/UNDERGRID/src/client/controllers/GraphicsController.ts))**:
    - Automatically detects touch/mobile platforms to disable GPU-heavy `DepthOfFieldEffect`, providing razor-sharp, crystal-clear mobile visuals with lower temps.
    - Sets `PrioritizeLightingQuality = false` on mobile devices to prevent forced high-end desktop compute passes, while maintaining full Ultra visuals on PC.

- **Pre-Round 1v1 Duel Cinematic Intro**:
  - Implemented an immersive cinematic camera sequence highlighting both combatants before the match begins:
    - **Authentic Cinema Letterbox**: Features seamless edge-to-edge widescreen cinema bars identical to the spawn intro sequence, which glide away smoothly as the round begins.
    - **Three-Quarter Side Profile Showcase**: Dramatic low-angle camera angles framing each fighter from a 3/4 side profile, extending sequence duration for a measured, high-tension pre-fight presentation.
    - **Synchronized Stride & Fists Equip Animation**: Fighters stride forward with measured confidence before setting their hands into a ready combat fist stance.
    - **Buttery-Smooth Combat Transition**: Instead of abrupt camera cuts, the perspective glides seamlessly from the intro showcase directly into the over-the-shoulder view, perfectly oriented toward the opponent as the round countdown begins.

- **Smooth Get-Up Recovery Transition from Ragdoll**:
  - Eliminated stiff and instant standing snaps after ragdoll knockdown:
    - Replaced hard vertical teleportation with a smooth, physics-guided ground elevation tween from prone to upright position.
    - Added a 0.65-second recovery window with motion locking so characters naturally play their getting-up sequence before resuming sprint or attacks.
    - Included temporary wake-up invulnerability frames (iframes) preventing players from being endlessly combo-locked while rising from the floor.
    - Blended smooth getting-up animation track from the ground into combat idle with natural fade transitions.

- **Dynamic Physics Ragdoll for Clash Defeat & Knockouts**:
  - Implemented physical ragdoll reactions for decisive combat climax moments:
    - **Clash Duel Defeat**: The defeated fighter is propelled through the air in a dramatic 1.4-second ragdoll flight.
    - **Duel Knockout (K.O.)**: Reaching fatal health threshold cleanly sends the defeated fighter into a 2.5-second limp knockdown before recovery.
  - Standard combat moves (M1 combo punches, Heavy Push, and Guard Break) maintain upright posture and dedicated animation hit-reactions to keep pacing competitive.
  - Automated getting-up recovery transition with raycast clearance preventing characters from clipping into floor geometry.

- **Clash Duel (Mash Space) Pacing & Precision Rebalance**:
  - Transformed clash duels into rare, cinematic climaxes rather than frequent disruptions during standard exchanges.
  - Added an 18-second cooldown per fighter after a clash to guarantee smooth combo flows, blocking, and dodging without immediate QTE interruptions.
  - Tightened physical contact distance from 10.5 studs to 5.0 studs, ensuring clashes only occur at realistic fist-strike distance.
  - Enforced mutual facing direction checks so attacks from behind or flank angles never unintentionally trigger a clash.
  - Sharpened the collision detection timing from 0.15s to 0.08s for authentic punch-against-punch collision precision.

- **Clean Combat & Duel Interface**:
  - The hotbar now automatically hides during active combat (equipping fists) and throughout 1v1 duel matches (including the pre-fight countdown), ensuring an immersive and unobstructed view.
  - Number hotkey item switching is temporarily suppressed while the hotbar is hidden to prevent accidental weapon swapping during fast-paced exchanges.
  - The hotbar and item switching are instantly restored when exiting combat or when the duel ends.

- **Directional Dash Movement (Front, Back, Left, Right)**:
  - 4 dynamic directional dodge animations:
    - **Front Dash**: Lunge forward when moving forward or while idle.
    - **Back Dash**: Quick retreat leap when moving backward.
    - **Left Dash**: Agile side-step dodge when strafing left.
    - **Right Dash**: Agile side-step dodge when strafing right.
  - High-precision direction calculation based on character movement relative to facing orientation.
  - Directional impulse synchronization to ensure instantaneous motion with zero perceived network lag.
  - Clean animation layering with smooth procedural joint tilt fallback.

- **Combat Stamina & Cooldown Balancing**:
  - Balanced stamina economy for more fluid and engaging fights:
    - Dash stamina cost reduced from 18 to 12.
    - Heavy punch stamina cost reduced from 35 to 22.
    - Light punch (M1) combo cost reduced from 12 to 8.
    - Block stamina drain significantly reduced for both light and heavy attacks.
  - Accelerated recovery:
    - Stamina regeneration speed increased from 15/s to 28/s (almost 2x faster).
    - Recovery delay shortened from 1.2s to 0.75s after combat actions.
    - Minimum stamina threshold lowered from 15 to 8, keeping fighters responsive in critical moments.
  - Faster action flow:
    - Dash cooldown shortened from 1.5s to 0.65s for agile combat maneuvers.
    - Light attack recovery window refined to 0.60s for full swing follow-through.
    - Heavy attack cooldown and recovery optimized for better pacing.

- **Attack & Dash Motion Flow Polish**:
  - Eliminated premature attack animation cutting: punch swings and pushes now play their full natural arcs and smoothly transition into combat idle without snapping.
  - Fixed dash-cancel exploit: players must now completely finish their dash animation before executing a punch or guard, preventing overlapping animations and glitchy movement.
  - Instant attack cancels remain available when chaining consecutive combo hits, taking hits, or suffering a guard break.

- **Target Lock-On Camera System**:
  - Hybrid combat camera with full player toggle control:
    - **T Key (PC)** & **Touch LOCK Button (Mobile)**: Freely toggle target locking on or off at any moment.
    - **When Lock is Active**: Camera automatically centers on your opponent, body smoothly faces the target, horizontal movements become circular strafes, and a neon red crosshair indicator appears above the locked target.
    - **When Lock is Inactive**: Free camera rotation with natural directional character orientation.
  - Intelligent auto-unlock when an opponent is defeated or moves outside combat range.
  - Dedicated virtual lock button on mobile devices with real-time active status highlighting.

- **1v1 PvP Duel System via Avatar Context Menu**:
  - Interactive 1v1 duel challenges initiated by clicking player avatars in the 3D world with the "Fight" option.
  - Full anti-griefing protection and combat isolation: non-participating players cannot be damaged or interrupted.
  - Modern modal invitation card with challenger avatar preview, accept/decline buttons, and automatic countdown timer.
  - Dramatic 3... 2... 1... FIGHT! countdown overlay with dynamic scaling effects.
  - Real-time duel status bar on the HUD displaying VS indicator, opponent avatar thumbnail, and live health sync.
  - Safe knockout resolution: upon reaching fatal health threshold, the duel cleanly concludes, full health is restored, and the winner is declared without waiting for respawn.

- **Spatial Voice Chat Zone System**:
  - Authoritative spatial microphone control in designated social areas.
  - Automatic microphone management: players are muted outside zones and unmuted within designated rooftop and garage lounges.
  - Dynamic music ducking: background music volume smoothly reduces to 50% within voice zones for clear conversations and restores to 100% on exit.
  - Vertical height tolerance so jumping or standing on elevated props does not disrupt voice chat.
  - Real-time visual status alerts on the notification island when entering and leaving active voice zones.

- **NPC Realistic Head Follow System**:
  - Client-side head tracking controller utilizing smooth interpolation.
  - Universal support for all map NPCs with automatic detection.
  - Compatible with both R6 and R15 character rigs.
  - Natural horizontal and vertical angle clamping to prevent unnatural neck rotation.

### Changed
- **NPC Physics & Accessory Sanitation**:
  - Automated unanchoring of NPC limbs and accessories during server startup, securing only the root part to prevent falling or unwanted displacement.
  - Cleared corrupt weld connections to ensure accessories follow head motion accurately.
- **Natural Neck Reset Transitions**:
  - Replaced translation-based reset detection with visual orientation vector checks.
  - Eliminated abrupt neck snapping when players walk away, replaced with a relaxed, smooth transition.
- **Dialogue Text Animation**:
  - Progressive typewriter text effect for NPC dialogue with instant skip support on click or key press.

---
