# Wild Country

**Play the public game:** [timely-sprite-472306.netlify.app](https://timely-sprite-472306.netlify.app/)

Wild Country is an evolving browser-based 3D wilderness game built with
Three.js. Its current playable slice has a 3.2 km by 3.2 km landscape built
around the downloaded Poly Pizza terrain mesh and height-aware terrain
blending, horseback travel, wildlife with local GLB models, a ranch pasture,
observation, a field map, hunting interactions, and browser-local save/load.

## Run locally

The Three.js modules load from jsDelivr, so an internet connection is required.
Animal and equipment GLBs are local.

1. Open this folder in VS Code and start **Live Server**, or run
   `python3 -m http.server 8000` from this folder.
2. Visit `http://localhost:8000`.
3. Select a rider, horse coat, saddle colorway, and cabin finish in the main
   menu; then choose **Enter the World** or press **Enter**. If pointer lock is
   not available, movement and keyboard looking still work.

## Publish with Netlify

This is a static site and needs no build step. The included `netlify.toml`
publishes the project root, including the local model assets. To make it
public, sign in to Netlify, open [Netlify Drop](https://app.netlify.com/drop),
and drop this project folder onto the page. Netlify will provide a public
`*.netlify.app` URL. Keep `index.html`, `game.js`, `style.css`, and the `assets`
folder together when deploying.

The current public production deploy is hosted at the link above. To publish
future changes, open the existing `timely-sprite-472306` project in Netlify and
drop the updated project folder there.

Alternatively, import the project from a Git repository in Netlify and select
the repository root as the publish directory with no build command.

## Publish with GitHub Pages

The GitHub Actions workflow in `.github/workflows/deploy-pages.yml` publishes
the game to GitHub Pages whenever changes are pushed to `main`.

1. Create a **public** GitHub repository named `wild-country` in your account.
2. Add and push this project to its `main` branch.
3. In the repository, open **Settings → Pages** and select **GitHub Actions**
   as the build and deployment source.
4. Open **Actions** and wait for **Deploy Wild Country to GitHub Pages** to
   complete. The public game URL will be
   `https://<your-github-username>.github.io/wild-country/`.

The project is a static site; the deploy workflow copies the game entry files
and local model assets into the Pages artifact. Three.js itself loads from
jsDelivr, so visitors need an internet connection.

## Controls

| Action | Control |
|---|---|
| Walk / ride | WASD |
| Sprint / gallop | Shift |
| Jump (on foot) | Space |
| Look / turn | Arrow keys |
| Look with mouse / trackpad | Drag / two-finger scroll |
| Enter / leave the separate cabin interior | E at the cabin doorway |
| Cabin safe / gun locker / bunk / cooktop | E beside the object |
| Ranch gate / mount / dismount / cabin ammo box | E near the gate, horse, or ammo box |
| Ride a bull | E near the ranch bull |
| Stay on during a bull buck | Press the opposite arrow key shown in the field prompt |
| Dismount a bull | E |
| Call the horse / change scope magnification | Q; when scope is lowered, whistles for the horse |
| Hide / show the control list | 1 |
| Observe with binoculars | B |
| Open / close map | M |
| Shoot | Left mouse |
| Reload / light cabin fire | R; lights the fire when beside the fireplace |
| Inspect cabin fridge | W while beside the fridge |
| Toggle rifle scope | Double right-click |
| Change scope magnification | Q while scoped |
| Harvest a nearby downed animal | H |
| Save / load | F5 / F9 |
| Pause / resume | Escape / Enter |
| Open the kennel | E beside the doghouse near the cabin |
| Call the selected dog | E when no nearby interaction takes priority |

The main menu offers three rider colorways, three horse-coat colorways,
three saddle/blanket colorways, and three cabin finishes. The same menu is
available while paused; use its save/load buttons to manage the expedition.
Appearance choices are applied to the existing rider, horse, tack, and cabin
materials, and persist in both customization preferences and expedition saves.
The kennel is interactive and stores a selected breed in the roster. Its
selected companion appears beside the player if chosen in the cabin, or waits
beside the ranch kennel if chosen outdoors. Press E when no nearby interaction
takes priority to call the dog; it then follows the player across the world and
into/out of the cabin. Nearby cabin, ranch, mount, and kennel interactions keep
their existing E-key priority; the fridge remains inspectable with W.
Companion models are local Poly Pizza GLBs:
German shepherd uses the German Shepard model, Bloodhound uses a Beagle model
as the closest available hound, and Labrador retriever/Australian shepherd
currently use the generic Dog model. These are stylized low-poly assets, not
photorealistic or exact breed-specific models.

The binocular view records the first field note for each observed species.
The map shows the trail, ranch, horse, wildlife, and player. Save data is kept
in the browser's local storage for this origin.
Downed deer sell for $125, elk for $500, and stags for $290, or any of them can
be mounted as a trophy outside the ranch cabin. Cash and harvested/mounted
wildlife are included in expedition saves.

Downed cows and bulls can be harvested with H; their beef is stored in the
cabin fridge. Stand by it and press W to view the raw/cooked meat count. Stand
by the fireplace and press R to light it; press E once to cook raw beef and
again to eat a cooked portion. The cooktop beside the kitchen table can also be
switched on and off with E; while it is on, E cooks raw beef or consumes a
cooked portion. The bunk advances the day to morning. The cabin safe displays
the same cash balance shown in the HUD, and the gun locker stores or retrieves
the existing hunting rifle without discarding its ammunition. Storing the rifle
also prevents firing and hides its first-person model; the game currently has
one rifle and one in-game ammunition loadout. These interactions and the
cooktop/meat state are included in the existing browser-local save. Opening
the ranch gate with E sends the cattle
toward the gap at a run. Close it before they pass through to keep them in the
pasture. Movement collision covers trees, rocks, brush, logs, livestock,
fences, cabin walls and furnishings, and the animated ranch gate; ground cover
remains passable. The player eye height is 1.83 m (about six feet) and the
cabin wall height is 2.45 m (about eight feet). The cabin footprint is enlarged
by 30%; its taller exterior walls rise to about 4.9 m, with a matching higher
roof. The entry door is 2.45 m tall and the windows have been raised to suit
the taller walls; porch furnishings retain natural scale.
An ammunition crate sits inside the cabin. Press E beside it to refill the
magazine and bring reserve ammunition up to at least 15 rounds; the ammo box
interaction does not reduce a larger saved reserve.
Its isolated interior has a much taller ceiling (about 4.9 m at the walls)
while furniture and the entry door keep their normal scale. Press E at the
entrance for a brief fade-and-teleport into the isolated, furnished cabin
interior; press E near its
door to return to the same ranch location. The exterior ranch and wildlife are
hidden while inside, and the outdoor simulation pauses. A new expedition now
starts in the cabin; E by the interior door returns to the ranch. Cabin position
and return point are included in saves. The existing WILD COUNTRY title is styled
as the start-screen logo; no separate image asset is required.

Any direct rifle hit kills the animal and starts its death animation; misses do
not damage wildlife. A missed shot startles nearby deer into a very fast bolt.
Stags use their embedded `Death` clip; the static elk has a procedural falling
death pose.
Animal deaths also trigger distinct synthesized vocal calls for deer, elk, stag,
cow, and bull. These are generated game sounds, not recorded animal samples.

Each of the seven existing deer spawn slots rolls one mutually exclusive rack:
1x1 (1 in 5), 2x2 (1 in 10), 3x3 (1 in 25), 4x4 (1 in 40), or 5x5 (1 in 70).
The remaining probability produces an antlerless deer. Each of the two existing
stag locations independently has a 1-in-999 chance to spawn a stag. Deer rack
classes are shown in binocular field notes and harvest details, and are saved
with the expedition. The 3x3 rack uses the downloaded Poly Pizza antlers model;
the other point-count silhouettes are generated from matching low-poly
geometry because Poly Pizza has a single antler-pair asset rather than five
separate rack variants.
Deer spawn in the area in front of the cabin entrance; elk spawn in the
woodland behind the cabin. A dedicated cow elk model is not currently included.
Animal deaths also trigger distinct synthesized vocal calls for deer, elk, stag,
cow, and bull. These are generated game sounds, not recorded animal samples.

## Models and credits

The following actual Poly Pizza GLBs are stored in `assets/models/` and loaded
by `game.js`: Quaternius deer, stag, horse, cow, bull, rifle, trees, and birch;
Poly by Google elk, saddle, tree, spruce, fir, oak, and poplar; and mastjie's
Cowboy rider. The Poplar is used as an Aspen-like species; it is not a model
identified as Aspen by its source. Quaternius and Cowboy are CC0. The Google
assets and sirkitree low-poly landscape are CC BY 3.0 and require attribution.
Source URLs, licenses, and required credit are listed in
[`assets/models/ASSET_LICENSES.txt`](assets/models/ASSET_LICENSES.txt).
The world layout proceeds from the central valley through two mountain belts
with a mixed pine, spruce, and fir forest between them, then outer woodlands
with birch, oak, poplar, and the original broadleaf trees. The map shows these
regions. Before placement filters, the forest targets 900 pine, 180 spruce,
180 fir, 1,100 of each original outer woodland model, 5,200 additional birch
trees scattered across the playable map, another 300 birch targeted around
the central valley, 240 each of the biome birch and oak, 180 poplar, and up to
roughly 360 central trees. This makes the supplied
Quaternius Birch Trees pack the common tree throughout the world while
preserving clearings around the cabin, ranch, trails, water, and rocks. Trees
use instancing in larger terrain-aligned cells with distance-based density LOD
and view-frustum culling. Distant tree density is reduced, tree meshes skip
per-tree shadow rendering, the canvas resolution is capped for performance,
and a subtle vertex shader bends the canopies. The trees use sampled ground
heights, slope limits, and the existing
tree/rock collision grid to avoid water, trails, cabin clearance, and overlap
with other placements. Per-tree height, width, and color variation reduce
copy-paste repetition; compatible bark materials receive subtle procedural
groove relief, and individual tree instances sway gently out of phase. The near
LOD covers a wider area; lighter medium/far tiers remain active out to the map
edge. Tree bases and fallen logs use the rendered ground mesh surface, avoiding
height-sampler mismatches that could leave trees floating. Bushes remain visible
near trees while avoiding trunk overlap, and terrain-aligned fallen logs add
forest-floor deadwood. The tree source meshes
have authored textures and distinct silhouettes, but remain stylized low-poly
game assets rather than photorealistic scans. The downloaded sirkitree landscape GLB supplies the central terrain
heights over approximately 2,480 m square. Its boundary and geometry gaps are
filled with matching procedural relief, and subtle rolling variation is added
to the source terrain. A dense aligned ground mesh renders the sampled height
field instead of the source's visibly faceted land surfaces. The source GLB is
kept hidden as a height source, while its separate water patch remains visible
as a reduced pond. The imported height sampler keeps player, horse, wildlife,
and scenery grounded.
Missing height samples are filled from their nearest terrain samples and the
height field is smoothed before gameplay uses it. Its edges blend continuously
into the procedural terrain. The visible ground follows that same height
surface instead of being offset far below the imported mesh, and player/horse
movement rejects abrupt terrain steps while following hills with gradual
vertical motion.
Terrain materials use procedural world-space color breakup, grass blades and
tree canopies sway with lightweight vertex shaders, and the pond surface
receives small animated ripples. These effects add variation but do not change
the supplied assets' stylized low-poly appearance.
The ground shader blends a generated, tileable atlas of grass, dirt, mud,
gravel, rock, sand, and snow using slope, elevation, trail distance, and
shoreline proximity, replacing the source landscape's original checker
texture. The main ground mesh also uses a repeating bump map, and the forest
belts receive instanced leaf and pine-needle litter. These are procedural
materials and details rather than scanned photorealistic textures.

The elk GLB has no embedded animation clips. Its procedural fall is not
presented as skeletal animation.
Failed or missing model loads are reported in the browser console and do not
silently replace animals with primitive meshes.

Animal models are normalized to approximate adult sizes in meters (full model
height: deer 1.45, stag 2.10, elk 2.30, cow 1.60, bull 1.75, horse 2.35).
These measurements include ears and antlers where present, rather than
representing shoulder height. Individual wildlife sizes vary slightly.

## Current scope and known limitations

This is an early playable browser slice, not a finished large-scale or
photorealistic production. The supplied animal models are low-poly game assets,
not realistic scans. The player view is first-person (there is no third-person
character model), the world is a single fixed-size procedural map rather than
a streamed seamless world, and animal populations are small. The elk has no
animation; animal behaviors and wind are lightweight game simulation rather
than a full ecological model.

The rider asset is a static, unrigged mesh, so seated pose, slight body motion,
turning lean, and reins are procedurally approximated rather than driven by a
character rig. The horse has walk and gallop clips only; trot and canter do not
have dedicated animations. The saddle is a downloaded model; the saddle blanket,
bridle, and reins are currently procedural. These assets are stylized game
models, not photorealistic scans.

The project does not yet include multiple polished biomes, terrain streaming,
a full inventory/objective/settings system, ranch errands, a complete tracking
and footprint system, realistic weather or water, production-quality character
and horse animations, or a full soundscape. These are future development work,
not features the current build claims to provide.

## Environment

The winding trail, grass and bushes, trees, rocks, lighting, fog, and
day/night cycle are generated locally around the integrated landscape. At a
new expedition's start, the player begins beside the cabin entrance and sees a
brief “You have awoken” note. The cabin has a furnished wooden interior, two
glazed windows, and a porch. A new expedition starts in its isolated interior
scene; press E inside by the entrance to return outside. The doorway blocks
physical passage because travel is handled as a teleport. Its fridge stores
harvested beef, and its fireplace
supports lighting, cooking, and eating. The ranch pasture has an E-operated
gate that cattle will run through if it remains open. Elk
now inhabit the far outer woodland, beyond the mountain ranges. The
terrain surface is sampled from the imported GLB triangles for movement and
ground alignment. Grass now uses rooted multi-blade clumps instead of tall
cones, with a higher concentration near the starting valley. Ground-cover
placement is checked against terrain grade, the trail, the barn, water geometry,
and tree/rock collision data, then rechecked when the imported landscape
finishes loading. Clumps align to terrain and filtered instances retain their
original scale so they can be restored correctly.
The ground and green landscape materials use a lightweight procedural shader
for color variation, while grass and the small pond receive subtle animated
wind and ripple effects.
The mounted third-person view hides the first-person reticle; the static rider
mesh is shaped toward a more forward, lower rein-holding arm pose.

The code remains organized into focused world, model-loading, input, wildlife,
and HUD sections within the current entry module; larger production work should
split these systems into modules and add automated tests. Fishing, a shared
inventory, a combined journal, fully enterable buildings beyond the cabin, and
a complete lake system
are not implemented yet.
