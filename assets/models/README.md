# Local models

All animal and equipment models are downloaded locally from Poly Pizza.

- `deer.glb` — Quaternius Deer, animated
- `stag.glb` — Quaternius Stag, animated
- `antlers.glb` — Poly by Google Antlers, used for the 3x3 deer rack
- `elk.glb` — Poly by Google Elk, static model without embedded animation
- `horse.glb` — Quaternius Horse, animated (restored previous model)
- `cow.glb` — Quaternius Cow, animated
- `bull.glb` — Quaternius Bull, animated
- `dog-generic.glb` — Poly by Google Dog, used for the Labrador retriever and Australian shepherd kennel choices
- `dog-shepherd.glb` — Quaternius German Shepard, used for the German shepherd choice
- `dog-beagle.glb` — Poly by Google Beagle, used as the closest available hound model for the Bloodhound choice
- `rifle.glb` — Quaternius Sniper Rifle from Poly Pizza model `i65hEldsw6`, licensed CC0
- `cowboy.glb` — mastjie Cowboy, static single mesh, no skeleton or animation
- `saddle.glb` — Poly by Google Western saddle with stirrups
- `trees-quaternius.glb` — Quaternius Trees, instanced woodland tree
- `tree-google.glb` — Poly by Google Tree, instanced woodland tree
- `pine-trees-quaternius.glb` — Quaternius Pine Trees, instanced conifers
- `birch-trees.glb` — Quaternius Birch Trees, instanced in outer woodland
- `spruce-tree.glb` — Poly by Google Spruce, instanced in the conifer belt
- `fir-tree.glb` — Poly by Google Fir, instanced in the conifer belt
- `oak-tree.glb` — Poly by Google Oak, instanced in outer woodland
- `poplar-tree.glb` — Poly by Google Poplar, used as an Aspen-like broadleaf
- `low-poly-landscape.glb` — sirkitree's actual stylized terrain mesh, used as the central 3D terrain and sampled for player, horse, wildlife, and scenery ground heights

The Quaternius models and Cowboy are CC0 1.0. The Poly by Google Dog, Beagle,
elk, saddle, tree, Spruce, Fir, Oak, Poplar, sirkitree landscape, and Quaternius
German Shepard are CC BY 3.0; their required attributions and all source URLs
are recorded in `ASSET_LICENSES.txt`.

The elk asset has no animation clips. Its death response is a simple procedural
fall, not an embedded or skeletal animation. Stags use their source model's
`Death` clip. The models are recognizable low-poly game assets, not
photorealistic scans. The previous Quaternius horse model has been restored.
Keep the GLBs beside this README; update the paths in `game.js` if any file is renamed.

The kennel companion is a locally loaded Poly Pizza GLB. The companion follows
the player after being called with E, stays terrain-grounded outdoors, and
changes to the active cabin scene during cabin transitions. A small patch of
nearby tall grass is lowered beneath the terrain around the outdoor companion
so its body is visible without lifting its feet off the ground. Only the
German Shepard source is an exact match for a selected kennel label; the
generic Dog and Beagle assets are honest approximations for the other available
breed choices. These companion assets are stylized and are not breed-accurate
photorealistic models. Their looping idle clips include repetitive head tilts,
so dogs now hold the source model's neutral standing pose while stopped and
play a walk/run clip only while following.

The deer body remains the animated Quaternius GLB. Deer rack chances are
1x1: 1 in 5, 2x2: 1 in 10, 3x3: 1 in 25, 4x4: 1 in 40, and 5x5: 1 in 70;
unassigned rolls are antlerless. The 3x3 rack uses `antlers.glb`. The other
point counts use low-poly antler geometry built in `game.js`, since Poly Pizza
does not provide separate one-through-five-point rack assets in this project.
All racks are attached under the animated deer head bone so they follow the
eating, looking, and other head animations as part of the animal hierarchy. The
existing two stag locations each roll a 1-in-999 spawn chance.

The rider source is a static, unrigged mesh. Its seated posture and motion are
approximated by mesh deformation and procedural movement; it has no authentic
skeletal riding animation. The horse source contains walk and gallop clips, but
no separate trot or canter clips.

Animal GLBs are normalized to approximate adult full-model heights in meters:
mule deer 1.45, red deer stag 2.10, elk 2.30, cow 1.60, bull 1.75, and horse
2.35. These are whole-model bounds, including ears or antlers where present;
they are not shoulder-height values. Individual wildlife vary by up to 4% so a
herd is not made of exact-size duplicates. The source assets are stylized, and
their proportions cannot be corrected through scale alone.

The world is 3,200 m by 3,200 m. It has a central valley, a first mountain
belt, a mixed pine/spruce/fir forest beyond that range, a second traversable
mountain belt, and outer woodland containing the elk habitat. Birch, oak, and
poplar (an Aspen-like relative, not a model labeled Aspen) join the existing
broadleaf assets; Quaternius trees remain scattered in the central area.
There are up to 900 pine, 180 spruce, 180 fir, 1,100 instances of each
original outer woodland tree asset, 5,200 additional birch placements spread
across the playable map, up to 300 additional birch around the central valley,
240 each of oak and biome-specific birch, 180 poplar, and roughly 360 central
placements before terrain/spacing filters reject invalid locations. The
requested Quaternius Birch Trees model is the common world-wide forest species.
Placements follow the sampled terrain and filter steep slopes,
trails, the cabin, water, rocks, and existing trees. Instanced meshes are
partitioned into larger terrain-aligned cells with near/medium/far density LOD
and view-frustum culling; tree height, width, and color vary by instance,
compatible bark materials receive subtle procedural groove relief, and trees
sway gently out of phase. Understory bushes stay visible near trees while
avoiding trunk overlap; instanced fallen logs follow the terrain and add
forest-floor deadwood. Tree roots and logs are positioned against the rendered
ground mesh rather than a separate height approximation. Tree instances skip
per-tree shadow rendering for Mac
performance. Trees and collisions use the same local placement data. The
renderer caps its pixel ratio to reduce GPU load. The
low-poly landscape's mesh provides central terrain heights where it has
geometry; gaps and its outer edge are filled by matching procedural relief,
with procedural terrain extending to the 3.2 km world boundary. A dense ground
mesh renders this aligned, sampled height field instead of the source's
faceted land surfaces. The source GLB stays hidden as a height source, while
its separate water patch remains visible as a reduced pond. Player movement,
horse travel, wildlife, trails, vegetation, and rocks follow the resulting
terrain heights. Deer spawn in front of the cabin
entrance, while elk spawn in woodland behind it. The project does not include
a cow elk model, so cow elk are not currently spawned. The cabin beside the ranch pasture
has taller exterior walls and roof, plus an interior, bunk bed, windows, and
porch. Its E-key door teleports the player between the ranch and an isolated,
taller-ceiling interior scene while keeping the furniture and door at normal
scale. The player starts inside the cabin. Trees and rocks block movement
through the existing local collision grids. Grass is
rendered as rooted multi-blade clumps and bushes are aligned to sampled terrain.
Both are filtered against steep slopes, the trail, the cabin, water geometry,
and static tree/rock clearances after the landscape finishes loading. The ground and green landscape materials receive subtle
procedural color variation; grass bends gently in the wind and the small pond
has a restrained animated ripple. Tree
placements also avoid steep locations, the trail, and the cabin, and enforce
separation from trees and any rocks already registered when a tree is placed.
Missing mesh height samples are nearest-filled and the sampled height field is
smoothed before use. Ground rendering follows that same continuous height
field, and player and ridden horse movement avoid abrupt vertical steps.
Wildlife ground height samples four points around each animal's footprint on
the rendered ground mesh and uses the highest nearby surface value with a
small clearance, reducing hoof
clipping on uneven slopes.
The terrain surface uses a generated, tileable atlas of grass, dirt, mud,
gravel, rock, sand, and snow. World-space shader masks blend these surfaces by
slope, elevation, trail proximity, and mapped shorelines, replacing the source
landscape's original checker texture; a repeating bump map adds subtle ground
relief. Forest belts receive instanced leaf and pine-needle litter, with
terrain-aware placement and no per-instance shadow rendering.
