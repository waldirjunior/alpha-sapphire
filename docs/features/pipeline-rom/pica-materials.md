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
records such as `0@BattleField`. A fresh direct GARC read in the section below
measured slot 1 as 231,808 bytes with SHA-256
`f26fe18f2471f12f068fa035dad1919ff1543207d96bf6b57e46c6ab6d1557b4`, rather
than the 236,712-byte/`1e434f...` value in this earlier A-118 snapshot; use the
fresh source and section hashes below to reproduce this catalog.

The evidence chain still stops before runtime binding. The 336 model BCHs
reference `0@DefaultShader` and `LightSetIndex=0`, while the `BM` resource has
no models or `DefaultShader`; the bounded `PseudoLightingListener` callback
at `DllField.cro:0x2ee38` processes eight dynamic light slots, but disassembly
does not identify which resource entries populate them or bind them to a GR
material. Therefore `light_sun` cannot yet be assigned to `LightSetIndex=0`
or to a displayed zone, and no RGB/lightmap change is justified. P-007 stays
open pending the loader/model binding and an emulator or native-renderer
comparison.

## DVLB catalog and static LightSet trace (2026-11-21)

[`inspect_pica_dvlb_lights.py`](../../../scripts/inspect_pica_dvlb_lights.py)
parses DVLB/DVLP/DVLE ranges, symbols, uniforms, source filenames, and hashes;
it scans GARC entries, nested DARC/mini packages, and loose `.shbin` files.
It uses a read-only memory map for large GARC files. Reproduce the inventory
with:

```sh
python3 -B scripts/inspect_pica_dvlb_lights.py \
  --extracted rom/extracted --output /tmp/pica-dvlb-lights.json
```

The scan found 293 DVLB signatures: 291 structurally valid records and two
rejected false signatures. Of the valid records, 287 are under `RomFS/a/`
and four are loose shaders. The scan recorded 23 incomplete GARC-table errors
separately. Counts by source are:

| Source | Valid DVLB records |
| --- | ---: |
| `a/1/0/1` | 159 |
| `a/1/8/0` | 47 |
| `a/1/5/2` | 42 |
| `a/0/0/8` | 24 |
| `a/0/6/4` | 6 |
| `a/0/0/3` | 4 |
| `a/0/6/3` | 2 |
| `a/1/7/5` | 2 |
| `a/1/3/6` | 1 |
| `RomFS/shader/` | 4 |

The checked GARC files `a/0/2/1` (22,538,408 bytes,
SHA-256 `06c21576ecf38180a456180fbe7baa58f529ca5fd57bf89130e90fe67ce230b6`)
and `a/0/3/9` (108,419,976 bytes,
SHA-256 `31a3335c4356b550e407017de9abd51c8b8ec7d71695eec0842d3f5082541109`)
contain no structurally valid DVLB records. The four loose files are
`nwfont_RectDrawerShader.shbin` (964 bytes, SHA-256
`0ca7566cab8f8559a954f1390d02d346deb26309728db5a9f1fec41e037bc1ea`),
`nwfont_TextWriterShader.shbin` (484 bytes, SHA-256
`87e9a661a499dfe18818310d6758855eba5d56892fe266c155b18e3e0f4d881e`),
`nwlyt_ConstColorShader.shbin` (328 bytes, SHA-256
`6e6d5058aa64c8201fbd487e635eec0de3549bb3b5fedd1eaa1aa284ad3ad330`), and
`nwlyt_PaneShader.shbin` (1,060 bytes, SHA-256
`4d41713c0d4cf1b3e89cd4db3da65cea2fd766f2345500ed0866e743ed207fbb`).

### Named H3D shaders in `a/0/0/8`, slot 1

The source GARC `RomFS/a/0/0/8` is 1,070,643,868 bytes,
SHA-256 `45100100d8ca1c220f588771631e03585023b5b29c91180c23507e0325310304`.
Slot 1 decompresses to a 231,808-byte `PC` package, SHA-256
`f26fe18f2471f12f068fa035dad1919ff1543207d96bf6b57e46c6ab6d1557b4`;
section 0 is a 52,608-byte BCH, SHA-256
`e36e76411b11f8008fd2d4671dfea4c4a9f2e3df45c5f3f0d259548071ed9092`.
SPICA parses 13 H3D shader records from this section (no lights, scenes, or
LUTs). [`inspect_pica_materials.cs`](../../../scripts/inspect_pica_materials.cs)
reports each shader name, the exact `Program` byte-array offset, length, and
SHA-256. Exact byte matches identify ten unique named program payloads among
the 14 DVLB records. The offsets below are package-relative: add `0x80` to
the BCH-relative `programOffset` reported by SPICA.

| DVLB offset | H3D `Shader.Name` | Program bytes | Program SHA-256 |
| ---: | --- | ---: | --- |
| `0x30c` | `0@BattleChar` | 4,424 | `4c936cd13e03d51e6fd54922727658ae8cd8d20c18dee21b216d08e04fac9684` |
| `0x1484` | `0@MegaYamiramiShader` | 4,528 | `cf670ed0e2fc44a7972f22ef3065f4f0e17bee5729cf799b9a126e005eee775b` |
| `0x2664` | `0@PokePack`, `1@PokePack`, `2@PokePack` | 7,300 | `b0266cd6400748bdf0727132ff0a50d1fccecd68123c0de84b8b64fff168cd96` |
| `0x4378` | `0@PressShadowTextureAlpha` | 2,584 | `4e4543ca7e091c019ee6b7ac2cc8feff7249d191a7bce5c0ccc1574c4af42f11` |
| `0x4dc0` | `0@PokeFire` | 2,984 | `eb7a978a8b14b77bf68ebfc3f84a62fa32df94189d62d7337ce41f11ed35d2fa` |
| `0x5998` | `0@PokeFireShadow` | 2,500 | `cd82d88aa0e3fbce90110e840312f35a560931c454a546cb2f6a1d817aedaf54` |
| `0x638c` | `0@RareEffect` | 2,796 | `cdf80979d6b0b4c4a8113d1f7e6113932da8703bf0e62d890dec6939cf4401cd` |
| `0x6ea8` | `0@MegaGangar`, `1@MegaGangar` | 5,852 | `6ba13807b0839b81f2c7ce4f98295f97e2874f3980540bfccc311bcfbbef8890` |
| `0x85e4` | `0@PressShadow` | 4,740 | `956b70c5b9fbf6c44df9805ff962603428ec6bd9eb74a0096482562fb34cc1d6` |
| `0x9898` | `0@RefrectShader` | 4,572 | `d8e4e8b4a2bed3c34570f4e67b0c27261291175df0cd44aa9340529fe02197fe` |

`0@DefaultShader` is absent from these H3D shader records. The other four
DVLB records in slot 1 have source-symbol names such as `gfx_UserShader.vsh`;
those symbols do not provide an H3D `Shader.Name` or a material binding.
`0@BattleChar` declares DVLE uniforms at register identifiers `MatAmbi=0x24`,
`MatDiff=0x25`, `LightPowScale=0x26`, `DirLightVec=0x27`,
`DirLightColor=0x28`, `PointLightPos=0x65`, and `LightCt=0x70`. `0@PokePack`
also declares `InverseLightEnable=0x7d` and `LightingEnable=0x7e`. These are
uniform/register identifiers from the shader metadata, not uploaded values or
the PICA lighting-register range `0x0140..0x01bf`.

### BM shader bytes

`RomFS/a/0/0/3` is 1,147,800 bytes, SHA-256
`1ca59c28a648293c7b34483d7a7d0544fc29bb55d71af26f482881dba962fa5f`. Slot
138 is a 691,072-byte `BM` package, SHA-256
`ae9175a8b3a028f0b4fb77d9d6fd242d8671d39fc03749fbbec3d483f3e751ff`. The
H3D scene data has 16 lights, one scene, one LUT, no models, and no H3D shader
records. Three nested DVLB records occur in sections 2, 5, and 11:

| Package offset | Record bytes | DVLB record SHA-256 |
| ---: | ---: | --- |
| `0x2fbc` | 4,162 | `bcd7b8e677466dd67039e339e1b5d9c75dc4fdf6468c07ba5bd2c723ab7abcfa` |
| `0xf930` | 2,646 | `592c21cde44f5bd0a0d065157a1f2d0d65b4aa0cdecadd5d204e1a50a2198676` |
| `0xa7890` | 4,162 | `bcd7b8e677466dd67039e339e1b5d9c75dc4fdf6468c07ba5bd2c723ab7abcfa` |

Their DVLE symbols include lighting-related interface names (`MatAmbi`,
`MatDiff`, `LightCt`, and `HslSDir`), but no material or `LightSetIndex`
selects these records. The resource's named light data therefore does not
identify which entry reaches a model.

### ExeFS table and class references

`ExeFS/code.bin` is 5,439,488 bytes, SHA-256
`b7f9ce60361f3709ed0ce879658afe10a712f7db060640fa72bba826301b7c16`, with
analysis base VA `0x100000`. The seven-entry shader path table begins at file
offset `0x517460` (runtime VA `0x617460`):

| Entry | Path |
| ---: | --- |
| 0 | `rom:/g3d_common/gfl_DefaultShader.bcsdr` |
| 1 | `rom:/g3d_common/gfl_DefaultShader.bchsdr` |
| 2 | `rom:/g3d_common/nwgfx_ParticleDefaultShader.bcsdr` |
| 3 | `rom:/g3d_common/nwgfx_DefaultShader.bcsdr` |
| 4 | `rom:/kawada/shadow_resource/ShadowModel.bcmdl` |
| 5 | `rom:/g3d_common/bloom_filter_high_luminance_board.bcres` |
| 6 | `rom:/g3d_common/bloom_filter_bloom_board.bcres` |

The path strings are at file offsets `0x4e3905`, `0x4e3989`, and `0x4e392d`
for the GFL shader, GFL geometry shader, and NWGX shader respectively. The
ARM literal-pool/PC-relative scan found no reference to the table's seven
entries, and the Thumb literal-pool scan found none. It did find eight ARM
literal loads into storage after the table: instructions at file offsets
`0x282eb4/0x282ed0` target file offset `0x517490`; `0x282eec/0x282f08`
target `0x51748c`; `0x282f24/0x282f3c` target `0x517488`; and
`0x282f58/0x282f70` target `0x517484`. The table ends at `0x51747c`, so these
loads do not point to a shader path entry. Other string references are not
table references.

The RTTI and vtable scan reports these file offsets and leading method targets:

| Class | RTTI string | Vtable group | Leading method file offsets |
| --- | ---: | ---: | --- |
| `H3dLightSet` | `0x4cff60` | `0x4ddf14` | `0x39bcec`, `0x39bc94`, `0x39b930`, `0x39b968` |
| `H3dModel` | `0x4cff48` | `0x4dde08` | `0x39b8f4`, `0x39b8b8`, `0x39b478`, `0x399ff8` |
| `H3dResShader` | `0x4cfa3e` | `0x4dd85c` | `0x375884`, `0x375838`, `0x372708` |
| `H3dEnvironment` | `0x4cfb4a` | `0x4dd9cc` | `0x37d41c`, `0x37d3f8` |
| `SceneSystem` | `0x4cfa22` | `0x4dd84c` | `0x37565c`, `0x375568` |

There is no `H3dMaterial` or `LightSetIndex` string in `code.bin`. The scan
does find separate `nn::nw::gfx::Material` and `nn::nw::lyt::Material`
vtable groups at `0x4dbafc` and `0x4dbf7c`; neither is evidence for the
missing GFL material binding. Function VA `0x4ddf40` calls `0x19c368` at
`0x4ddf5c`, `0x19c5d8` at `0x4ddf68`, `0x19c470` at `0x4ddf78`, and
`0x19c5d8` again at `0x4ddf84`. The direct-call scan found no callers of
`0x4ddf40` and no direct callers of the candidate class methods.

### `PseudoLightingListener` boundary

`DllField.cro` is 1,323,008 bytes, SHA-256
`9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925`.
`PseudoLightingListener` has name offset `0x1003db`, typeinfo `0xfdee8`,
vtable `0x1077e8`, and callback `0x2ee38`. Relocations point from vtable
entry `0x1077f4` to the callback. The constructor candidate at `0x2f460`
loads the address-point pointer `0x1077ec` from its literal at `0x2f47c` and
stores it at `[r0]`; no direct caller of that constructor was found.

The callback loops over eight records (counter `0..7`, active byte at
`[record+0x164]`) and dispatches through vtable slots `+0x54` and `+0x50`.
The four indirect calls are at CRO offsets `0x2f3b4`, `0x2f3d0`, `0x2f414`,
and `0x2f430`. No static caller or call target ties those records to BM
entries, a material's `LightSetIndex`, or PICA writes at `0x0140..0x01bf`.

If runtime observation becomes necessary, set the first breakpoint at the
loaded `DllField.cro` base plus `0x2ee38`; inspect the call arguments and
the selected record at `base+0x2f3b4` and `base+0x2f414`. The loaded module
base is runtime-dependent. This work did not open Azahar. The evidence still
does not map material indices 0/1 to `light_sun`, `light_night`, a zone, or a
time of day, and it does not justify changing `zoneEnvironment.ts`.

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
