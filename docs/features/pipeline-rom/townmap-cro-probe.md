# DllTownmap CRO, map UI, and PICA resource probe

Roadmap #4 probe, 2026-11-21. Inputs were read from the local extraction at
`/Users/wjunior/projetos/outros/estudos-ia/projeto-testes/v1/alpha-sapphire/rom/extracted/`.
The probe does not run ROM code or start Azahar. Its reader is
[`scripts/inspect_townmap_cro.py`](../../../scripts/inspect_townmap_cro.py),
with synthetic fixtures in
[`scripts/test_inspect_townmap_cro.py`](../../../scripts/test_inspect_townmap_cro.py).

## CRO facts

`RomFS/DllTownmap.cro` is 81,920 bytes, module name `DllTownmap`, SHA-256
`123177f22f326d5c13508303200df26715a726ff4b51b25259074309b1418a5c`.
The CRO header points to segments at `0xC8`, its module-name record at
`0xC0`, named exports at `0xD0`, import modules at `0xF0`, external
relocations at `0xF8`, and internal relocations at `0x128`. It has two named
exports: `nnroControlObject_` (`0xD1CC0`) and
`_ZN9xy_system2bg6System13SetIsCallDrawEb` (`0xC1E40`). Its only import
module is `|static|`, with 292 symbols. No printable `a/x/x/x` path occurs in
the CRO, so this pass did not establish a direct Townmap-to-GARC ID binding.

Capstone resolved 25 virtual-method entries from four in-module RTTI
vtables: `MainSystem` at `0xF168`, `NaviLayout` at `0xF194`,
`TB_CursorView` at `0xF31C`, and `MapView` at `0xF4F4` (CRO file offsets).
Useful disassembly entry points are `NaviLayout` slots 0/1 at `0x1BAC` and
`0x1B44`, `MapView` slots 0/6 at `0x9BDC` and `0x9AC4`, and
`TB_CursorView` slot 6 at `0xC374`. The MapView slot-0 thunk adjusts `this`
and enters code at `0x9BE4`; the MapView routines call helpers at
`0x930`, `0x3F8`, `0x400`, `0x948`, and `0x9F54`. RTTI strings also name
`MapViewListener` and `TownmapUIListener`, but this CRO's relocation graph
did not yield their vtables. These methods identify layout/controller paths,
but they did not expose numeric tap rectangles or a stable bottom-bar hit
region. That coordinate-to-callback link remains open.

## Map UI resources

The asset names provide strong candidates for the Town Map and PokéNav. The
relationship to a specific CRO load call is not proven because the CRO has no
archive-path literals.

| Archive and entry | Nested container | Resource | Evidence |
| --- | --- | --- | --- |
| `RomFS/a/0/6/7`, GARC slot 0, LZ11 payload | DARC at `0x5900`; `map_lower.bclyt` entry 7 at `0x788` | CLYT layout; entries `map_city_icon01/02/03.bclim` at `0x12F80`, `0x13800`, `0x14880` | Icons are 32×32, 64×32, 32×32; `map_hide_r114.bclim` is 31×43. |
| same archive/slot/container | `poke_navi_map.bclim`, DARC entry 17 at `0x16180`, 131,112 bytes | CLIM footer at member offset `0x20000` | 380×270, format 10 (ETC1); its decoded sample shows the Hoenn outline over the ocean grid. |
| `RomFS/a/2/5/5`, GARC slot 0, LZ11 payload | DARC at `0x580`; `map.bclim` entry 9 at `0x1C80`, 262,184 bytes | CLIM footer | 320×240, format 5 (RGB565); decoded sample contains the full Hoenn map artwork. |
| `RomFS/a/2/7/6`, GARC slot 0, LZ11 payload | DARC at `0x200`; entries 3–7 at `0x180`, `0x2200`, `0x4280`, `0x6300`, `0x8380` | `map_navi01` through `map_navi05.bclim` | Each is 55×30, format 9 (RGBA8888); `map_navi01` visibly contains the Japanese “Map” bottom-bar icon. The same group repeats in subslots 0–6. |
| `RomFS/a/2/4/4`, GARC slot 0, LZ11 payload | DARC at `0x300`; `map_navi_l.bclim` entry 3 at `0x280`, `map_navi_s.bclim` entry 4 at `0x2300` | CLIM footers | 124×29 format 8 and 46×12 format 3; these are navigation labels, repeated in subslots 0–6. |
| `RomFS/a/1/5/0`, GARC slot 0, LZ11 payload | DARC at `0x200`; `finger_icon.bclim` entry 8 at `0x600` | CLIM footer | 60×60 format 9; likely touch-pointer art, but not a hit region. |

The footer reader handles the `CLIM`/`FLIM` signature at `data[-0x28:-0x24]`.
Texture extraction supports the tiled pixel data needed for the samples,
including ETC1. Samples were decoded only under `/tmp/townmap-probe/`:
`0_6_7_s0000_poke_navi_map.bclim.png`,
`2_5_5_s0000_map.bclim.png`,
`2_7_6_s0000_map_navi01.bclim.png`, and
`1_5_0_s0000_finger_icon.bclim.png`. No images or ROM-derived binaries are
in the worktree.

## PICA shaders and light upload boundary

Scanning all `RomFS/a/` files found 298 GARC files, 51,043 yielded slots,
413 CLYT, 9,974 CLIM/FLIM, 3,324 CGFX, 65,438 BCH, and 289 DVLB signatures.
The scanner also found 11 payloads whose LZ11 stream could not be fully
decoded and 23 GARC tables that stopped at an incomplete/invalid table entry;
counts therefore describe decoded evidence, not a guarantee that every
damaged tail was inspected.

DVLB data is present inside GARC resources: for example,
`RomFS/a/0/0/8`, slot 1, contains an uncompressed 231,808-byte `PC` package;
14 DVLB signatures occur in its section 0, from offset `0x30C` through
`0x376B0`. This confirms shader binaries under `RomFS/a/`, without identifying
which program Townmap loads. Loose files also exist, but under `RomFS/shader/`
rather than `RomFS/g3d_common/`: four `.shbin` files each begin with DVLB.
The extracted `RomFS/g3d_common/` directory is absent. The loose records are
`nwlyt_PaneShader.shbin`, `nwfont_RectDrawerShader.shbin`,
`nwfont_TextWriterShader.shbin`, and `nwlyt_ConstColorShader.shbin`.

`RomFS/a/0/0/3`, slot 138, is an uncompressed 691,072-byte `BM` package.
The existing H3D audit in [pica-materials.md](pica-materials.md) identifies
its H3D section as 16 lights, one scene, and one LUT, with no models or
embedded shader programs. This places light definitions in a GARC. It does
not show that `DllTownmap` selects that resource or prove a runtime upload.

`DllField.cro` is 1,323,008 bytes, SHA-256
`9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925`.
`PseudoLightingListener` RTTI is at name `0x1003DB`, typeinfo `0xFDEE8`,
vtable `0x1077E8`; callback `0x2EE38` is the third method pointer at
`0x1077F4`. Capstone disassembles the callback's setup, floating-point data
work, and helper calls, but does not name the uploaded light-set handle or a
shader program. The callback is not sufficient to bind the BM resource to a
model.

`ExeFS/code.bin` is 5,439,488 bytes, SHA-256
`b7f9ce60361f3709ed0ce879658afe10a712f7db060640fa72bba826301b7c16`.
The requested points `0x4DDF14` and `0x4DDE08` map, under base `0x100000`,
to file offsets `0x3DDF14` and `0x3DDE08`. `0x4DDF14` begins with a function
epilogue followed by literal-pool-looking words; a clear next prologue occurs
at `0x4DDF40` and calls `0x19C368`, `0x19C5D8`, and `0x19C470`.
`0x4DDE08` is inside a floating-point sequence and its next 0x100 bytes
contain no direct call. The ARM and Thumb immediate-call scan found no direct
call to either requested address. Function boundaries and indirect/vtable
callers remain unresolved; these offsets alone do not prove a `H3dLightSet`
or `H3dModel` upload path.

## Hashes of scanned inputs

| Local extracted input | Bytes | SHA-256 |
| --- | ---: | --- |
| `RomFS/a/0/6/7` | 38,384 | `527550e5dbfd3f0453843c5fc8932ff83ac9c9f4a8424941e12573df913cf4d7` |
| `RomFS/a/2/5/5` | 96,532 | `d7cd378815836d09c574c9ad5d39f90a381bf88b1c20c5fcea0696ba5523d5d0` |
| `RomFS/a/2/4/4` | 152,768 | `e9cc271f8efc3ea741f233f8cbb06a08c2046c018df74f64669f8e99d149b9e7` |
| `RomFS/a/2/7/6` | 107,832 | `70ae7f76613ce9e84071be9f2b1bd05379e84c17d4aeab0ebcbe5a050e35b158` |
| `RomFS/a/1/5/0` | 2,144 | `2c3208eee3bacb7b33e28c0c3f53a65f727e766f4ea9c6e8f5bbdbf1b569858b` |
| `RomFS/a/0/0/3` | 1,147,800 | `1ca59c28a648293c7b34483d7a7d0544fc29bb55d71af26f482881dba962fa5f` |
| `RomFS/a/0/0/8` | 1,070,643,868 | `45100100d8ca1c220f588771631e03585023b5b29c91180c23507e0325310304` |
| `RomFS/shader/nwlyt_PaneShader.shbin` | 1,060 | `4d41713c0d4cf1b3e89cd4db3da65cea2fd766f2345500ed0866e743ed207fbb` |
| `RomFS/shader/nwfont_RectDrawerShader.shbin` | 964 | `0ca7566cab8f8559a954f1390d02d346deb26309728db5a9f1fec41e037bc1ea` |
| `RomFS/shader/nwfont_TextWriterShader.shbin` | 484 | `87e9a661a499dfe18818310d6758855eba5d56892fe266c155b18e3e0f4d881e` |
| `RomFS/shader/nwlyt_ConstColorShader.shbin` | 328 | `6e6d5058aa64c8201fbd487e635eec0de3549bb3b5fedd1eaa1aa284ad3ad330` |

## Reproduction and remaining evidence

```sh
ROM_ROOT=/Users/wjunior/projetos/outros/estudos-ia/projeto-testes/v1/alpha-sapphire/rom/extracted
python3 -B scripts/inspect_townmap_cro.py --extracted "$ROM_ROOT" --disassemble \
  --json /tmp/townmap-probe/report.json --extract-to /tmp/townmap-probe
npm run test:py
npm run verify
```

The new unit suite uses synthetic CRO/GARC/DARC/mini-package and BCLIM data;
it needs no ROM assets. Remaining work for Roadmap #4 is to trace the Townmap
resource load and touch callback into their callsites, decode the relevant
CLYT pane bounds, and connect the light listener to the selected shader and
light set. No input rectangles or runtime upload values are claimed here.
