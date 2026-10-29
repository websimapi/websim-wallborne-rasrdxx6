# Dense city implementation

Reference: the creator's attached aerial image (uploads/image.png).
Research consulted:
- https://en.wikipedia.org/wiki/Urban_block — irregular pre-industrial street blocks, street-facing entrances and perimeter-block courtyards.
- https://en.wikipedia.org/wiki/Urban_morphology — coherent street, plot and building patterns; variation within a shared neighborhood grain.

Application:
- 47,444 deterministic plots replace the sparse 145 m grid.
- Curved blocks follow the concentric walls. Broad cardinal avenues connect the sealed gates; radial connectors and gaps in the perimeter rows supply secondary routes and courtyards.
- Building widths, depths, elevations, roof pitches, orientations, bay wings, cross-gables and dormers vary. Wealth remains organized by district rather than random material assignment.
- Detailed, furnished, hollow buildings stream around the visitor and along grapple rays. Distant buildings use matching instanced shells. This avoids drawing every interior in the entire city each frame.
- Repeating generated textures have been converted into periodic images, use world-meter UVs, mipmaps and anisotropic filtering.

Destruction:
- Titan footfalls, ground strikes and corpse falls are checked server-side against shared plot footprints, not trusted visitor damage requests.
- Damage events and seeds are relayed to all visitors, with damage history replayed on join for the lifetime of the room.
- Struck modules fracture into material-colored rigid blocks, splinters and thin roof sections. Lost supports trigger delayed upper-wall and roof collapse.
- Cannon-es simulates structural-fragment gravity, rotation, ground contact, nearby standing-wall contact and inter-fragment contact. Small nonstructural trim uses cheaper ballistic motion and ground settling. Sleeping fragments remain rendered and gain grapple/player collision at their settled transforms.
- Active rigid-body debris is budgeted to 220 pieces; queued fragments are released as previous ones settle. Remote impacts initially use a low-detail ruin silhouette and reconstruct their seeded detailed damage when approached. This is a chunk-based real-time approximation, not finite-element simulation or one independent body for every brick in all 47,444 buildings.
- Damage is room-session state, not permanent database state. Settled fragment trajectories are simulated locally, so exact debris positions can differ slightly across clients.
