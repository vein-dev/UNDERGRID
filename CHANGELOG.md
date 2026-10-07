# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-10-07

### Added
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
