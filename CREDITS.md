# Asset credits

Detailed rigged human base meshes and embedded textures:
- Soldier / Vanguard model, distributed with the three.js examples: https://threejs.org/examples/models/gltf/Soldier.glb
- Michelle character, distributed with the three.js examples: https://threejs.org/examples/models/gltf/Michelle.glb

Both assets are kept locally under models/. The civilian asset retains its full geometry and rig; normals/weights/UVs and embedded images have been optimized for transfer using KHR_mesh_quantization. Clothing overlays, cloaks, rank insignia, VME equipment and tower engagement animation are implemented in people.js. Cloth materials were generated for this project.

Wall layout and half-timber architectural direction follow the creator's supplied references under uploads/image-2.png and uploads/image-3.png. The three enclosing rings remain sealed and collision-enabled; each ring now has four projecting districts.

Conversations are generated on the server using env.AI.chat. Resident intents and speaker/target IDs are validated before reaching the client. No scripted text is presented as an AI-generated conversation.
