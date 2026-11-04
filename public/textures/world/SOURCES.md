# World textures

Imported from the user-provided Supply Line Assets folder. Resized to at most 1024 pixels and JPEG encoded for runtime use. Original assets remain unchanged.

- `sand.jpg`: `ForestVision/Materials/Grounds/Textures/gnd_rockySand_diffuse.png`
- `grass.jpg`: `ForestVision/Materials/Grounds/Textures/gnd_FieldGrass_Base_Color.png`
- `rock.jpg`: `ForestVision/Materials/Grounds/Textures/gnd_LichenRock_Base_Color.png`
- `bark.jpg`: `ALP_Assets/Big Oak Tree FREE/Models/Textures/barkOak001.png`
- `asphalt.jpg`: `Single_detailed_truck/ExampleSceneAssets/asphalt_0001.png`
- `concrete.jpg`: `Versatile Studio Assets/Demo City By Versatile Studio/Textures/highway_wall.png`
- `wood.jpg`: `ALP_Assets/Big Oak Tree FREE/Models/Textures/barkOak001.png`

Concrete uses the plain concrete strip cropped from the highway wall atlas; wood reuses bark grain to avoid mapping a branch atlas onto crates.

Runtime materials use shared, repeating images projected in world space, including instanced props. This avoids stretching on large buildings and keeps adjacent terrain tiles aligned. Surface luminance supplies subtle bump relief and roughness variation; terrain blends grass by its biome tint and rock by slope. Detail fades between 90 and 650 metres to suppress distant repetition. The drivable El Cajon materials remain intact. Stationary vehicle collision bounds are sized to the new decorative silhouettes.


Brick surfaces imported from the user-provided `C:/Users/chris/Desktop/assets/CGT_Facades.zip`:

- `brick-red.jpg`: `CGT_Facades/01_maps/bricks-universal_02.jpg` (weathered tan masonry).
- `brick-1.jpg`: `CGT_Facades/01_maps/bricks-universal_02b.jpg` (dark masonry).
- `brick-2.jpg`: `CGT_Facades/01_maps/Bricks012_2K_Color.jpg` (red brick).

Brick repeats preserve horizontal courses on both X and Z walls, with approximately life-sized brick courses and luminance-derived mortar relief. Tires use shaped open-bead geometry and a procedural tread/sidewall shader. The five decorative vehicle models are built in code from the user's photographic references and share the El Cajon's rust shader, with additional rain streaks and oxidation. No vehicle photographs are embedded as textures.
