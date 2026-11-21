# PICA200 materials: atlas orientation and the alpha subset

P-007, A-069–A-071; base `5880bf1`, worktree `pica-materials`.
A-066–A-068 were already occupied in main during this investigation.

## Observations and derivations

The diagnostic reproduces foliage cards, facade texels on roofs, and
incorrect ground edges in GR0004/0005/0006. GR0006 foliage already has
`MASK`, a native cutoff, and an RGBA image with varying alpha. Adding a
generic `alphaTest` cannot fix sampling the wrong part of the atlas.

`inspect_pica_materials.cs` reads BCH from GR section 1 and MM section 0.
For AD archives, it visits every BCH section: AD0008 section 0 is not BCH.
It records hashes, `TextureSources`, transforms, samplers, six
`TexEnvStages`, constants, blend, alpha test, depth, bump, and LUT fields.
The local `DAEExporter.cs` preserves these fields in `extra/pica_material`;
a generic importer does not automatically reproduce the original shader.

The GLB RGBA image matches a same-named native texture in the selected
archive. Position-and-UV correspondence establishes `V_glb=1−V_bch`.
This can remain true with a symmetric UV bounding box: a bounding box alone
does not establish orientation. The comparison tolerates 0.001 native unit
in position and 0.000002 in UV for float32/DAE serialization. It does not
substitute a different UV stream.

Observed GR RGB paths include `Texture0 × PrimaryColor` and multiplication
by `FragmentPrimaryColor`. Projected materials also consume `Texture1`,
`Texture0`, constants, and `PreviousBuffer`; actors use interpolation and
reflection LUTs. All 4,328 audited materials have bump mode `NotUsed`.
These observations do **not** establish Texture1 as a lightmap or justify
unlit rendering, invented LUTs, or removal of vertex colors.

## Implemented rules

- Restore V only for diffuse UV0 with matching image identity, native UV0
  origin, an identity base transform, and proven position/UV correspondence.
- Clone the selected accessor. Preserve the original BIN prefix, existing
  accessors, other attributes, geometry, skin, nodes, and animations. There
  is no global flip or actor UV change in this task.
- Reduce only recognized static alpha paths: `Replace` and `Modulate`, the
  base texture, `Previous`, exported vertex alpha, and unit constants.
  Unknown operands, sources, operations, and scales remain unsupported.
- Preserve alpha test **and** blending, which are independent states.
  `Greater` uses `(ref+1)/255`, `Gequal` uses `ref/255`, and `Always` does not
  discard. Other tests receive no approximation. RGB keeps the existing
  renderer shader.
- Map only `One/Zero` and `SourceAlpha/OneMinusSourceAlpha` blend pairs with
  Add equations and explicit alpha factors through `CustomBlending`.
  Three.js defaults do not silently replace the native alpha factors.
  Preserve the observed `DepthWrite` value.
- Publish self-contained GLBs by hash under `public/assets/native/materials/`
  without overwriting inputs. `src/data/picaMaterials.json` resolves known
  URLs at composite/continuous terrain, map, and character loading sites.
  Unmapped URLs, including legacy assets outside this inventory, pass through
  unchanged. The actor's expression catalog key does not change.

The alpha profile describes the available static path. It does not recover
the original vertex shader, runtime constant mutation, scheduler, or lights.
RGB, exposure, and tone mapping receive no appearance-driven adjustment.

## Coverage and preservation

The [audit](pica-material-coverage.json) covers 322 staged GLBs: 223 GRs and
99 characters, with 4,328 materials. It deduplicates 232 native states while
preserving texture names and source identity per material/model.

- 315 new URLs: 216 GRs and 99 characters.
- 206 GRs / 3,625 materials with proven V restoration.
- 3,971 materials with supported alpha profiles, including 709 with blending.
- Seven unchanged GRs: 0535, 0720, 0723, 0724, 0727, 0728, and 0731.
- Missing UV0, unproven images, nonidentity transforms, missing vertex/UV
  correspondence, and unknown alpha paths remain explicit per material.
  They do not receive generic fallbacks.

Vertex-color records include presence, component type, normalization, and
RGBA minimum/maximum values. COLOR_0 exists in 4,290 materials, with no
unknown encoding. The inspector handles fixed float24 colors as well as
buffer colors; `GetVertices` alone does not apply fixed colors. The initial
three differences (A-071) are resolved by the guarded DAE correspondence
below. Matching ranges alone still do not prove shader equivalence.

All outputs pass structural preservation and idempotence checks. The audit
was repeated against existing published URLs without collisions. No Pokémon,
feet geometry, script, collision data, or core rule changes in this task.

## Boundary of the CRO evidence

`DllField.cro`, SHA-256
`9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925`:

- `WeatherEffectAlphaSet`: registration `0xf7fdc`, wrapper `0x5a684`. It
  reads two values, converts the second from uint to float, and follows
  global state `+0xc/+0x2c` to import `0x3008`.
- `ControlMotionBlurColor`: registration `0xf7fa4`, wrapper `0x5ae50`. It
  converts three integers to float and follows another global-state chain
  to `0x3050`.

This does not establish a connection to GR material combiners. The bounded
name/relocation search and these wrappers do not recover lighting,
projection, or LUT dispatch. RTTI strings containing “Lighting” are not
classified as AMX natives or shader evidence. Craft Anything discovery and
CLI remain unavailable; static analysis uses local readers and Capstone
5.0.3 without executing ROM code.

## COLOR_0 follow-up: source values, not a lighting approximation

The extended staged inventory contains 336 GLBs (237 GRs and 99 characters),
4,547 materials, and 248 deduplicated states. It publishes 329 immutable
URLs, restores V in 216 GRs / 3,817 materials, and maps 4,158 static-alpha
profiles. The additional maps were already staged locally; no geometry,
collision, actor mapping, or Pokémon catalog entry was introduced here.

`pica_vertex_colors.py` restores only uniquely identified source RGB values:

- Regenerate DAE from the matching MM pack with the existing SpicaExport.
  Record native-pack, exporter/assembly, original DAE, and semantic-reference
  SHA-256 values. The embedded proof hashes parsed geometry, not DAE creation
  timestamps, so identical inputs produce identical published GLBs.
- Match every target vertex by position (tolerance 0.001 native units) and
  UV0 (0.000002), accepting the already evidenced original/mirrored V forms
  without modifying either. Conflicting candidates do not authorize a guess.
- MM0180/MM0181 contain coincident position/UV/**normal** vertices with
  different colors. Match complete source triangles and require one color
  assignment consistent across every incident face of each exported vertex.
  A merged vertex needing two colors is unsupported; no topology is invented.
- Require unchanged alpha. Clamp only float rounding within 0.000001 of the
  glTF [0,1] limits. Append float32 COLOR_0 accessors instead of rewriting
  shared/original accessors or BIN data. Keep other attributes, indices,
  nodes, skins, animations, materials, and the existing alpha profiles intact.
- Restore 12 body vertices in MM0180, 11 in MM0181, and 15 head vertices in
  MM0319: 38 vertices in three new immutable files. No comparable range
  differences remain. This is source-data restoration, not RGB shader parity.

Seven synthetic GLB/DAE regressions cover a color seam, conflicting colors,
separate DAE indices, missing correspondence, alpha preservation, shared
accessors, SHA guards, original/mirrored V, and idempotence. Unknown color
paths remain unchanged; range equality never authorizes a replacement.

## RGB/lighting boundary after the follow-up

**Observed:** all 336 inspected model BCH containers have zero lights,
scenes, and embedded shaders; some actor packs contain LUT resources.
`LightSetIndex=0` and `0@DefaultShader` are references, not definitions of
light directions, ambient values, shader uniforms, or scene exposure.
GR0006 ground/wood/roof fixed upward normals survive in the staged GLB;
missing fixed normals are not the demonstrated cause of its dark shading.

The frequent native RGB chain is Texture0 × PrimaryColor followed by
Previous × FragmentPrimaryColor. SPICA's fragment generator computes the
latter from emission, material/scene ambient, and actual lights; reflection
LUTs contribute to other actor paths. A plain texture, a second vertex-color
multiply, unlit output, or a lightmap is not an equivalent replacement.
The current Three.js PBR/tone-mapping path remains approximate and unchanged.
A role for LUTs does not establish a toon shader or its runtime parameters.

The bounded DllField relocation/disassembly follow-up identifies RTTI
`PseudoLightingListener` (name 0x1003db, typeinfo 0xfdee8, vtable 0x1077e8,
callback 0x2ee38) and `mmodel::EffectCycleLight` (name 0x100ec0, typeinfo
0xfe2b8, vtable 0x10822c; methods include 0xde718/0xde388). These are not AMX
native registrations. Their presence and callback arithmetic do not recover
the GR light-set contents or DefaultShader dispatch. No ROM code was run.

**Unknown/next evidence:** verify whether the `DefaultShader` path literals
found in `ExeFS/code.bin` are active, locate the matching program, and trace
the loader/binding for the recovered light resource. Follow selected values
through the callback and model binding, then compare fragment inputs with an
emulator or native renderer. Projection, Texture1/Texture2,
PreviousBuffer, runtime constant mutation, fog, and LUT dispatch remain
explicit P-007 gaps. No brightness, saturation, color-space, unlit, or
generic multi-texture fix was applied based on appearance.

## External light data and shader library follow-up (A-118)

The zero-resource count above applies to the 336 staged model BCHs; it does
not mean the ROM has no external light or shader data. GARC `a/0/0/3`, slot
138, is a 691,072-byte `BM` container (12 sections; SHA-256
`ae9175a8b3a028f0b4fb77d9d6fd242d8671d39fc03749fbbec3d483f3e751ff`). Its
H3D section parses to 16 lights, one scene, one LUT, no models, and no shader
programs. For example, `light_sun` is an enabled `FragmentDir` light with
ambient `(199,208,226)`, diffuse `(79,104,98)`, direction
`(0,-0.99681526,0.07974522)`, and transform translation `(100,100,-100)`;
`light_night` has different ambient/diffuse colors. This proves the ROM
contains named light definitions and values, not which scene or model selects
them.

GARC `a/0/0/8`, slot 1, is a 236,712-byte `PC` container (SHA-256
`1e434f4ecc563bb8ded6c77b7a595e20c13304b8cfff05b8f207dac1e2720fe2`). Its
embedded H3D section parses to 13 named shader records, including
`0@BattleChar`, `0@PokePack`, `0@PokeFire`, and `0@RefrectShader`; none is
`0@DefaultShader`. The `BattleChar` program exposes uniforms such as
`MatAmbi`, `MatDiff`, `LightPowScale`, `DirLightVec`, `DirLightColor`, and
`PointLightPos`, but the binary does not provide the runtime values uploaded
to them. Other shader binaries in the scanned GARCs are also specialized
records such as `0@BattleField`.

The evidence chain still stops before runtime binding. The 336 model BCHs
reference `0@DefaultShader` and `LightSetIndex=0`, while the `BM` resource has
no models or `DefaultShader`; the bounded `PseudoLightingListener` callback
at `DllField.cro:0x2ee38` processes eight dynamic light slots, but disassembly
does not identify which resource entries populate them or bind them to a GR
material. Therefore `light_sun` cannot yet be assigned to `LightSetIndex=0`
or to a displayed zone, and no RGB/lightmap change is justified. P-007 stays
open pending the loader/model binding and an emulator or native-renderer
comparison.

## ExeFS loader-name triage (A-123)

The extracted `ExeFS/code.bin` (SHA-256
`b7f9ce60361f3709ed0ce879658afe10a712f7db060640fa72bba826301b7c16`)
contains RTTI names for `nn::nw::gfx::LightSet`,
`gfl::grp::g3d::H3dLightSet`, `H3dModel`, `H3dResShader`, `H3dEnvironment`,
and `SceneSystem`. It also contains the literals
`rom:/g3d_common/gfl_DefaultShader.bcsdr`,
`rom:/g3d_common/nwgfx_DefaultShader.bcsdr`, and
`rom:/g3d_common/gfl_DefaultShader.bchsdr` (file offsets `0x4e3905`,
`0x4e392d`, and `0x4e3989`, respectively). The `H3dLightSet` vtable group
at file offset `0x4ddf14` points to methods at `0x39bcec`, `0x39bc94`,
`0x39b930`, and `0x39b968`; those methods expose lifecycle and a resource
wrapper, but do not identify a model's selected set. The `H3dModel` vtable
group begins at `0x4dde08`.

These names and paths identify candidate renderer code, not a completed
load/bind chain. A direct pointer scan finds the shader path pointers in a
table at `0x517460`, but no callsite that connects that table to a model's
`LightSetIndex` or shader-uniform upload. This scan does not rule out computed
addresses or indirect dispatch. The next step is to follow a concrete loader
callsite from the BM/H3D light records through the model's material index to
the shader upload, or observe those objects at runtime in Azahar. No rendering
change follows from these strings alone.

Validation on 2026-11-20: `python3 scripts/test_pokemon_glb_materials.py`
passed 5 tests. The initial `npm run verify` passed 642 Vitest tests, the build,
and 256 Python tests; its two skips were missing public map assets and the
shared Azahar RPC port being occupied. After the port was released, the final
`npm run verify` passed with the same counts and only the expected asset skip;
a verbose Python rerun confirmed the reason. The requested battle and visual
Playwright specs passed 31/31; their captures were inspected, and no baseline
was approved.

## Reproduction

With local, ignored extracted assets, run from the worktree:

```bash
python3 scripts/audit_pica_materials.py \
  --root "$CHECKOUT" \
  --catalog src/data/nativeAssets.json \
  --spica-dll "$SPICA_DLL" \
  --output docs/features/pipeline-rom/pica-material-coverage.json \
  --runtime-catalog src/data/picaMaterials.json
```

The verified environment uses .NET 8.0.428 at
`/Users/wjunior/.dotnet/dotnet`, the existing SPICA assembly at
`_tools/SpicaExport/bin/Release/net8.0/SPICA.dll`, and installed Pillow.
The audit records the combined inspector/assembly hash. Its local cache
under `rom/pica-material-validation/` validates input and tool hashes.
This normalization does not require another Blender/assimp conversion.

## LightSetIndex and DefaultShader static XREF scan (2026-11-21)

`scripts/inspect_pica_lightset.py` performs a reproducible ExeFS pointer-table
inspection and Capstone ARM-mode scan with `skipdata=True`, and disassembles
the candidate `H3dModel`/`H3dLightSet` methods and `DllField.cro` callback. On
the extracted `ExeFS/code.bin` (SHA-256
`b7f9ce60361f3709ed0ce879658afe10a712f7db060640fa72bba826301b7c16`; base VA
`0x100000`), the table at file offset `0x517460` has seven pointers. Its first,
second, and fourth entries are respectively
`gfl_DefaultShader.bcsdr`, `gfl_DefaultShader.bchsdr`, and
`nwgfx_DefaultShader.bcsdr`; the other entries name a particle shader, a
shadow model, and two bloom boards. The three requested shader string pointers
occur in that table, but no raw pointer or Capstone ARM candidate targets the
table's seven entries or those shader path strings. The full-file linear scan
reported 121 ARM candidates overall (96 other `rom:/` path literals, 17
class-vtable region references, and eight references into zero-filled adjacent
storage); those candidates are not proof of reachable code because the scan
also decodes data as ARM instructions.

The `H3dLightSet` vtable group at `0x4ddf14` and `H3dModel` group at `0x4dde08`
resolve method addresses and nearby class RTTI, but no discovered reference
connects a model `LightSetIndex` to the shader table. In `DllField.cro`
(SHA-256
`9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925`),
`PseudoLightingListener` has name string `0x1003db`, typeinfo `0xfdee8`,
vtable `0x1077e8`, and candidate callback `0x2ee38`. The callback loops over
eight slots and makes indirect virtual calls through offsets `+0x50` and
`+0x54`; this does not identify the records, uniforms, or selected light set.
The extracted `RomFS/g3d_common/` directory is absent, so none of the three
shader files could be checked against the ROM filesystem. The binding chain
remains unresolved; no renderer change is justified by this scan.

Four synthetic unit tests cover pointer-table discovery, vtable address
decoding, ARM literal loads, and ARM PC-relative address calculations. The two
disassembly tests skip when the optional Python Capstone package is absent; the
ROM scan itself requires Capstone. This run used Capstone 5.0.3. Run the tests
without ROM assets with:

```bash
python3 -m unittest scripts.test_inspect_pica_lightset -v
```

With local extracted assets, reproduce the report with:

```bash
# If needed, install the script's optional disassembler dependency first.
python3 -m pip install capstone==5.0.3

python3 scripts/inspect_pica_lightset.py \
  --code-bin "$ROM_EXTRACTED/ExeFS/code.bin" \
  --dll-field "$ROM_EXTRACTED/RomFS/DllField.cro" \
  --output /tmp/pica-lightset.json
```

## Visual validation and remaining work

Visible Chromium, isolated Vite port 5195, worktree code, and main public
assets: `/tmp/playwright-test-pica-materials.js` captures published files
before/after with fixed cameras and lighting. All 12 images were inspected:
GR0006 town/foliage/houses/ground and GR0004/0005 town views. There are zero
page errors, console errors/warnings, HTTP responses >=400, or failed
requests. Evidence remains ignored in the main checkout under
`rom/pica-material-validation/browser/`.

The comparison shows restored foliage cutouts, coherent roofs/facades, and
oriented ground atlases without browser-side UV mutation. It is a static
synthetic scenario using the real material configurator, not a natural walk
or emulator comparison. Chunk edges, approximate shadows/lights,
projection, nonidentity transforms, LUTs/toon, multi-texture materials, and
actor RGB fidelity remain open in P-007. Missing feet were not invented.

Verification: 328 Vitest tests in 49 files, build, and 168 Python tests pass
without skips. Python uses `GLB_MAPS_DIR` from the main public assets.
The inherited chunk-size warning and explicit AMX camera non-parity
message remain. No proprietary binary or screenshot is committed.

Follow-up on port 5196: six additional fixed-pose COLOR_0 A/B images of
MM0180/MM0181/MM0319 were inspected, using the previous and new published
files with identical camera, native standing clip, pose time zero, and
lighting. The pixel differences are localized and subtle; this is not a
claim that actor RGB fidelity or the source exporter's historic failure
has been fully explained. Browser page/console/network/HTTP checks are clean.

A second visible scenario drives the actual game with keyboard input:
32 identical steps per phase in Littleroot, from an explicitly initialized
post-intro save at (20,14), through (27,15)/(14,16), back to (20,14). All eight
captures were inspected. The before phase disables the P-007 catalog; the
after phase uses current immutable aliases. Houses, signs, foliage cutouts,
and atlas borders improve during traversal. This validates the accumulated
V/alpha corrections, **not** a new lighting/RGB correction or natural story
progression. The roof still occludes the avatar at (14,16); camera/height and
emulator parity remain open. No runtime position, flag, collision, or camera
was patched while walking. There are zero page/console errors, HTTP failures,
or failed requests before teardown. The existing P-013
`BuildMdlEventAnimeSetEnd(6553770,0)` warning appears three times per phase,
without blocking movement; it is not silently classified as parity.

Evidence and both reports remain local under
`rom/pica-rgb-validation/{browser,walk}/` in the main checkout. The scripts
are `/tmp/playwright-test-pica-rgb.js` and
`/tmp/playwright-test-pica-walk.js`. Current verification: 333 Vitest tests
in 50 files,
build, and 175 Python tests without skips (`GLB_MAPS_DIR` points to main).
No engine shader, lighting, Pokémon, or proprietary tracked binary changed.
