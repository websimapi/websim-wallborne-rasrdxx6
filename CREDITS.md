# Asset credits

## Active human characters
KayKit: Adventurers Character Pack 1.0, by **Kay Lousberg** (https://kaylousberg.com/).
Source: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
License: **CC0 1.0 Universal** (public domain), full supplied license in models/KayKit-LICENSE.txt.

Locally hosted models: Knight (city guards), Rogue (townspeople and traders), Mage (robed officials, with wizard hat and magical props hidden). Models are unarmed except for locally added gas-gear fittings on guards. All use their original rigged body, clothing and native idle, walking, running and interaction animations. Unused animation data was removed for smaller downloads. No hotlinked assets.

Human meshes are normalized to 1.65–1.85 metres using a separate non-animated parent, with feet aligned to the ground. Model animation cannot overwrite this size normalization.

## Legacy files
The previously used three.js Soldier/Vanguard and Michelle models remain in models/human.glb and models/civilian.glb for project history, but are no longer loaded or displayed.

## World and behavior
Cloth and architectural textures were generated for this project. Walls and half-timber architecture follow the creator's references under uploads/.

Resident decisions and spoken conversations are generated server-side with env.AI.chat. Movement follows validated destinations with local wall/people avoidance and an immediate civilian safety response to nearby titans. AI requests are batched, limited to nearby residents and rate-limited; an unavailable model leaves residents idle rather than presenting scripted behavior as generated AI. Signed-in conversations retain personal memories using the existing NPC memory store.
