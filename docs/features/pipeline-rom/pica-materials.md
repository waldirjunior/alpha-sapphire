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
buffer colors; `GetVertices` alone does not apply fixed colors. Three range
differences remain: MM0180/MM0181 body and MM0319 head (A-071). They require
per-vertex/skin investigation in the exporter, not automatic RGB replacement.
Matching ranges do not prove shader equivalence.

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
