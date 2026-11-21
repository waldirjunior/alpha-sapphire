# Prova do dispatch de áudio nativo e BGM por classe

Probe de `P-008` para os wrappers AMX em `DllField.cro`, o decoder compartilhado de `code.bin`, o BCSAR e as tabelas `trdata`/`trclass`. Os binários ROM e o relatório gerado permanecem locais; este documento versiona apenas offsets, hashes e metadados.

## Reproduzir

Na raiz do repositório, com a ROM extraída localmente e Capstone instalado:

```sh
python3 scripts/inspect_audio_dispatch.py --rom-root /Users/wjunior/projetos/outros/estudos-ia/projeto-testes/v1/alpha-sapphire/rom/extracted --report /tmp/audio-dispatch-report.json
python3 -B -m unittest scripts/test_inspect_audio_dispatch.py
```

O teste sintético roda sem ROM. A checagem de uma instrução ARM só é pulada quando Capstone não está instalado. O relatório completo contém os disassemblies, hashes, metadados de todos os grupos e as referências de cada classe; ele é gravado em `/tmp/audio-dispatch-report.json` e não deve ser versionado.

## Proveniência ROM

| Arquivo | Bytes | SHA-256 |
|---|---:|---|
| `DllField.cro` | 1,323,008 | `9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925` |
| `DllBattle.cro` | 1,089,536 | `0c6e2889079c1db64977784585f6549764f0faf686f59fc7692bdbc259f62bf7` |
| `code.bin` | 5,439,488 | `b7f9ce60361f3709ed0ce879658afe10a712f7db060640fa72bba826301b7c16` |
| `sango_sound.bcsar` | 22,478,432 | `da1adafb9a018399f7e60c594d6799c3e922f04c74bbfe91ada986f705ca2b38` |
| `a/0/3/6` | 41,856 | `424fc3fa67221fc5987879dcbf7d41b6deb030b6970e2e7b8fbbe885c7ba4c28` |
| `a/0/3/7` | 10,144 | `7db13fa7f0dba4caeb1d08685add572794be7bef886e1f8f77eaae49a3ab7e98` |

## Wrapper `SEPlay` e decoder

Os offsets de CRO abaixo são offsets de arquivo no `DllField.cro`; endereços `VA` e offsets de `code.bin` são indicados separadamente.

| Native | Tabela em `DllField.cro` | Wrapper em `DllField.cro` | Helper importado em `code.bin` |
|---|---:|---:|---:|
| `SEPlay` | `0xF75CC` | `0x5CDE0` | thunk `0x328` / patch `0x32C` → VA `0x44FA84`, arquivo `0x34FA84` |
| `MEPlay` | `0xF75EC` | `0x5CDB8` | thunk `0x3128` → VA `0x3C8124`, arquivo `0x2C8124` |
| `BGMStartEvent` | `0xF7614` | `0x52CCC` | thunk `0x2A20` → VA `0x44C364`, arquivo `0x34C364` |
| `BGMStartBattleEvent` | `0xF7634` | `0x58D48` | thunk `0x1970` → VA `0x44D35C`, arquivo `0x34D35C` |
| `_TrainerBGMPlay` | `0xF75C4` | `0x555F4` | thunk `0x1970` → VA `0x44D35C`, arquivo `0x34D35C` |
| `TrainerGetInfo` | `0xF795C` | `0x548D0` | selector 3 → VA `0x4E7A5C`, arquivo `0x3E7A5C` |

`BGMPlay` e `FieldSEPlay` não aparecem como nomes nativos resolvidos em `DllField.cro`. `SEPlay` carrega o argumento AMX de `[r1,#4]` em `r0`, zera `r1` e `r3`, põe `-1` em `r2` e chama o thunk. O helper importado preserva o valor e chama o caminho de áudio em VA `0x44C3D8` (arquivo `0x34C3D8`), que passa o argumento ao decoder em VA `0x115984` (arquivo `0x15984`) antes de entregar o resultado ao player em VA `0x4A52AC` (arquivo `0x3A52AC`).

No decoder, as instruções ARM observadas são `lsl r1, r0, #8`, `uxth r0, r0` e `lsr r1, r1, #0x18`: portanto `grupo = (argumento >> 16) & 0xFF` e `idLocal = argumento & 0xFFFF`. Os bits 24–31 não são lidos. O decoder rejeita grupo `>= 0x17`; na tabela de grupos em VA `0x592728` (`code.bin @0x492728`), cada registro tem `count:u32` em `+0` e ponteiro de entradas em `+4`. Só índices locais menores que `count` são carregados; o retorno é o `u32` codificado da entrada. A constante VA da tabela está em `code.bin @0x159D4`.

Os grupos não vazios da tabela (cada entrada é um u32 de dispatch) são:

| Grupo | Entradas | VA das entradas | Offset `code.bin` |
|---:|---:|---:|---:|
| 1 | 211 | `0x5928DC` | `0x4928DC` |
| 2 | 5 | `0x592C28` | `0x492C28` |
| 3 | 4 | `0x592C3C` | `0x492C3C` |
| 4 | 2 | `0x592C4C` | `0x492C4C` |
| 5 | 45 | `0x592C54` | `0x492C54` |
| 6 | 119 | `0x592D08` | `0x492D08` |
| 7 | 116 | `0x592EE4` | `0x492EE4` |
| 8 | 3 | `0x5930B4` | `0x4930B4` |
| 9 | 7 | `0x5930C0` | `0x4930C0` |
| 10 | 389 | `0x5930DC` | `0x4930DC` |
| 11 | 431 | `0x5936F0` | `0x4936F0` |
| 12 | 25 | `0x593DAC` | `0x493DAC` |
| 13 | 617 | `0x593E10` | `0x493E10` |
| 14 | 550 | `0x5947B4` | `0x4947B4` |
| 15 | 1 | `0x59504C` | `0x49504C` |
| 16 | 311 | `0x595050` | `0x495050` |
| 17 | 311 | `0x59552C` | `0x49552C` |
| 18 | 6 | `0x595A08` | `0x495A08` |
| 19 | 12 | `0x595A20` | `0x495A20` |
| 20 | 12 | `0x595A50` | `0x495A50` |
| 21 | 12 | `0x595A80` | `0x495A80` |
| 22 | 1 | `0x595AB0` | `0x495AB0` |

## Corpus `SEPlay` verificado

O scanner de `src/data/zone_scripts/*.json` encontrou 72 argumentos literais distintos. Os 72 resolvem por grupo/índice local para uma entrada tipo `0x01` do BCSAR e um rótulo `STRG`; os números de ocorrência contam chamadas no corpus. O ID codificado é `0x01000000 | soundIndex` para todas as linhas abaixo.

| Argumento literal | Chamadas | ID BCSAR codificado | Índice | Rótulo BCSAR |
|---:|---:|---:|---:|---|
| `0x00060000` | 589 | `0x01000105` | 261 | `SEQ_SE_MESSAGE` |
| `0x00060017` | 17 | `0x0100011C` | 284 | `SEQ_SE_SYS_006` |
| `0x00060061` | 1 | `0x01000166` | 358 | `SEQ_SE_SYS_066` |
| `0x000A0000` | 13 | `0x0100017C` | 380 | `SEQ_SE_FLD_001` |
| `0x000A0010` | 8 | `0x0100018C` | 396 | `SEQ_SE_FLD_017` |
| `0x000A001D` | 69 | `0x01000199` | 409 | `SEQ_SE_FLD_KAIDAN` |
| `0x000A0027` | 5 | `0x010001A3` | 419 | `SEQ_SE_FLD_149` |
| `0x000A0030` | 4 | `0x010001AC` | 428 | `SEQ_SE_FLD_153` |
| `0x000A0031` | 2 | `0x010001AD` | 429 | `SEQ_SE_FLD_154` |
| `0x000A0058` | 6 | `0x010001D4` | 468 | `SEQ_SE_FLD_148` |
| `0x000A0082` | 5 | `0x010001FE` | 510 | `SEQ_SE_FLD_075` |
| `0x000A0084` | 2 | `0x01000200` | 512 | `SEQ_SE_FLD_077` |
| `0x000A0087` | 5 | `0x01000203` | 515 | `SEQ_SE_FLD_080` |
| `0x000A0096` | 9 | `0x01000212` | 530 | `SEQ_SE_FLD_309` |
| `0x000A009A` | 9 | `0x01000216` | 534 | `SEQ_SE_FLD_338` |
| `0x000A009C` | 8 | `0x01000218` | 536 | `SEQ_SE_FLD_096` |
| `0x000A00A0` | 1 | `0x0100021C` | 540 | `SEQ_SE_FLD_100` |
| `0x000A00CE` | 4 | `0x0100024A` | 586 | `SEQ_SE_FLD_137` |
| `0x000A00D6` | 1 | `0x01000252` | 594 | `SEQ_SE_FLD_155` |
| `0x000A00D9` | 3 | `0x01000255` | 597 | `SEQ_SE_FLD_158` |
| `0x000A00DA` | 2 | `0x01000256` | 598 | `SEQ_SE_FLD_159` |
| `0x000A00DB` | 1 | `0x01000257` | 599 | `SEQ_SE_FLD_160` |
| `0x000A00DE` | 1 | `0x0100025A` | 602 | `SEQ_SE_FLD_163` |
| `0x000A00E0` | 3 | `0x0100025C` | 604 | `SEQ_SE_FLD_165` |
| `0x000A00E6` | 1 | `0x01000262` | 610 | `SEQ_SE_FLD_171` |
| `0x000A00E7` | 1 | `0x01000263` | 611 | `SEQ_SE_FLD_172` |
| `0x000A00F7` | 1 | `0x01000273` | 627 | `SEQ_SE_FLD_188` |
| `0x000A0100` | 2 | `0x0100027C` | 636 | `SEQ_SE_FLD_197` |
| `0x000A0101` | 5 | `0x0100027D` | 637 | `SEQ_SE_FLD_198` |
| `0x000A0106` | 1 | `0x01000282` | 642 | `SEQ_SE_FLD_340` |
| `0x000A010B` | 2 | `0x01000287` | 647 | `SEQ_SE_FLD_341` |
| `0x000A0116` | 2 | `0x01000292` | 658 | `SEQ_SE_FLD_199` |
| `0x000A011C` | 5 | `0x01000298` | 664 | `SEQ_SE_FLD_205` |
| `0x000A011D` | 6 | `0x01000299` | 665 | `SEQ_SE_FLD_206` |
| `0x000A0121` | 2 | `0x0100029D` | 669 | `SEQ_SE_FLD_210` |
| `0x000A0125` | 2 | `0x010002A1` | 673 | `SEQ_SE_FLD_214` |
| `0x000A012A` | 3 | `0x010002A6` | 678 | `SEQ_SE_FLD_219` |
| `0x000A012B` | 1 | `0x010002A7` | 679 | `SEQ_SE_FLD_220` |
| `0x000A012D` | 4 | `0x010002A9` | 681 | `SEQ_SE_FLD_222` |
| `0x000A012E` | 1 | `0x010002AA` | 682 | `SEQ_SE_FLD_223` |
| `0x000A0130` | 3 | `0x010002AC` | 684 | `SEQ_SE_FLD_225` |
| `0x000A0131` | 1 | `0x010002AD` | 685 | `SEQ_SE_FLD_226` |
| `0x000A0132` | 1 | `0x010002AE` | 686 | `SEQ_SE_FLD_227` |
| `0x000A0134` | 3 | `0x010002B0` | 688 | `SEQ_SE_FLD_229` |
| `0x000A0135` | 2 | `0x010002B1` | 689 | `SEQ_SE_FLD_230` |
| `0x000A0138` | 2 | `0x010002B4` | 692 | `SEQ_SE_FLD_233` |
| `0x000A0139` | 1 | `0x010002B5` | 693 | `SEQ_SE_FLD_234` |
| `0x000A013A` | 2 | `0x010002B6` | 694 | `SEQ_SE_FLD_235` |
| `0x000A0141` | 2 | `0x010002BD` | 701 | `SEQ_SE_FLD_242` |
| `0x000A0143` | 4 | `0x010002BF` | 703 | `SEQ_SE_FLD_244` |
| `0x000A0145` | 4 | `0x010002C1` | 705 | `SEQ_SE_FLD_246` |
| `0x000A014D` | 1 | `0x010002C9` | 713 | `SEQ_SE_FLD_254` |
| `0x000A014E` | 1 | `0x010002CA` | 714 | `SEQ_SE_FLD_255` |
| `0x000A0152` | 2 | `0x010002CE` | 718 | `SEQ_SE_FLD_259` |
| `0x000A0153` | 4 | `0x010002CF` | 719 | `SEQ_SE_FLD_260` |
| `0x000A0154` | 1 | `0x010002D0` | 720 | `SEQ_SE_FLD_261` |
| `0x000A0155` | 2 | `0x010002D1` | 721 | `SEQ_SE_FLD_262` |
| `0x000A0156` | 1 | `0x010002D2` | 722 | `SEQ_SE_FLD_263` |
| `0x000A0157` | 8 | `0x010002D3` | 723 | `SEQ_SE_FLD_264` |
| `0x000A0158` | 1 | `0x010002D4` | 724 | `SEQ_SE_FLD_265` |
| `0x000A015A` | 1 | `0x010002D6` | 726 | `SEQ_SE_FLD_267` |
| `0x000A015C` | 2 | `0x010002D8` | 728 | `SEQ_SE_FLD_269` |
| `0x000A015D` | 1 | `0x010002D9` | 729 | `SEQ_SE_FLD_270` |
| `0x000A015E` | 3 | `0x010002DA` | 730 | `SEQ_SE_FLD_271` |
| `0x000A015F` | 6 | `0x010002DB` | 731 | `SEQ_SE_FLD_272` |
| `0x000A0160` | 7 | `0x010002DC` | 732 | `SEQ_SE_FLD_273` |
| `0x000A017C` | 1 | `0x010002F8` | 760 | `SEQ_SE_FLD_301` |
| `0x000A017D` | 2 | `0x010002F9` | 761 | `SEQ_SE_FLD_302` |
| `0x000A017E` | 1 | `0x010002FA` | 762 | `SEQ_SE_FLD_303` |
| `0x000A017F` | 4 | `0x010002FB` | 763 | `SEQ_SE_FLD_304` |
| `0x000A0180` | 3 | `0x010002FC` | 764 | `SEQ_SE_FLD_305` |
| `0x000A0182` | 1 | `0x010002FE` | 766 | `SEQ_SE_FLD_307` |

Este resultado prova a conversão numérica entre literal e BCSAR no corpus, não a semântica de jogo de cada efeito. O host removeu associações literais anteriores sem suporte; a evidência confirmou `0x00060000 → 261 SEQ_SE_MESSAGE`, mas não confirma que outros IDs sejam “selecionar”, “porta”, “warp” ou “hit”. O wrapper `MEPlay` e os caminhos `BGMStart*` também foram localizados e disassemblados; `MEPlay` chega ao decoder compartilhado via helper/tail branch, mas não faz parte do corpus `SEPlay` e não é usado para inferir os mapeamentos acima.

## `trdata` / `trclass` e BGM por classe

`RomFS/a/0/3/6` contém 950 slots e 949 registros ativos; os 949 IDs/classes ativos conferem com `src/data/battle/trainers.json` (divergências: 0). `trdata` armazena `classId:u16 @0x02`; seu `u32 @0x0C` é zero em todos os registros ativos. `RomFS/a/0/3/7` contém 280 classes de `0x10` bytes; o argumento BGM está em `u32 @0x0C` do registro de classe.

Em `DllField.cro`, `TrainerGetInfo` (wrapper `0x548D0`) seleciona o getter de classe com selector 3. O loader em `code.bin @0x3540C4` lê o recurso GARC/archive `0x25` e copia o registro para o objeto em `+4`; o getter em `code.bin @0x3E7A5C` retorna o campo do objeto `+0x10`, correspondente ao registro `trclass @0x0C`. `_TrainerBGMPlay` (wrapper `DllField.cro @0x555F4`) recebe um argumento e o encaminha ao helper em `code.bin @0x34D35C`, que passa esse valor à configuração em VA `0x44EA28`. O helper em `code.bin @0x34D35C` também chama o decoder em `@0x34D394` com o literal `0x00090004` carregado de `@0x34D3B4`; o disassembly não mostra o campo de classe chegando inalterado a esse decoder. A tabela abaixo cruza os valores armazenados em `trclass @0x0C` com o dispatch genérico comprovado, demonstrando o ID BCSAR correspondente para cada registro. O percurso dos contextos de batalha até `_TrainerBGMPlay` não foi provado; por isso `battleAudio.ts` continua usando classificação contextual, sem substituí-la por `classId`.

| Argumento `trclass @0x0C` | ID BCSAR | Índice / faixa | `classId` (nome em `trainers.json`) |
|---:|---:|---|---|
| `0x00010014` | `0x01000047` | 71 `STRM_BGM_EYE_01` | 127 Pokémon Trainer, 128 Pokémon Trainer, 129 Youngster, 130 Bug Catcher, 135 Schoolkid, 155 The Winstrates’, 192 Pokémon Trainer, 200 Leader, 201 Leader, 202 Leader, 203 Leader, 204 Leader, 205 Leader, 206 Leaders, 207 Leader, 209 The Winstrates’, 212 The Winstrates’, 213 The Winstrates’, 221 Lorekeeper, 235 Fare Prince, 238 Secret Base Trainer, 267 Pokémon Trainer, 268 Sootopolitan, 278 Pokémon Trainer, 279 Pokémon Trainer |
| `0x00010015` | `0x01000048` | 72 `STRM_BGM_EYE_02` | 131 Lass, 153 Pokémon Breeder, 210 Teammates, 252 Secret Base Trainer, 263 Secret Base Trainer, 264 Secret Base Trainer, 265 Secret Base Trainer |
| `0x00010016` | `0x01000049` | 73 `STRM_BGM_EYE_03` | 133 Twins, 241 Secret Base Trainer, 256 Secret Base Trainer |
| `0x00010017` | `0x0100004A` | 74 `STRM_BGM_EYE_04` | 136 Schoolkid, 142 Tuber, 176 Tuber, 253 Secret Base Trainer |
| `0x0001002A` | `0x0100004B` | 75 `STRM_BGM_EYE_05` | 134 Fisherman, 141 Sailor, 156 Hiker, 157 Camper, 158 Picnicker, 159 Kindler, 208 Ruin Maniac, 222 Backpacker, 237 Secret Base Trainer, 251 Secret Base Trainer, 266 Secret Base Trainer |
| `0x0001002B` | `0x0100004C` | 76 `STRM_BGM_EYE_06` | 140 Guitarist, 146 Black Belt, 147 Battle Girl, 168 Dragon Tamer, 169 Psychic, 170 Psychic, 217 Proprietor, 223 Brains & Brawn, 239 Secret Base Trainer, 249 Secret Base Trainer, 254 Secret Base Trainer |
| `0x00010049` | `0x0100004D` | 77 `STRM_BGM_EYE_07` | 145 Collector, 160 Poké Maniac, 164 Bug Maniac, 167 Ninja Boy, 177 Hex Maniac, 220 Fairy Tale Girl, 226 Mysterious Sisters, 240 Secret Base Trainer, 248 Secret Base Trainer, 255 Secret Base Trainer, 269 Secret Base Trainer |
| `0x0001004A` | `0x0100004E` | 78 `STRM_BGM_EYE_08` | 150 Lady, 151 Rich Boy, 185 Gentleman, 247 Secret Base Trainer, 262 Secret Base Trainer |
| `0x0001004B` | `0x0100004F` | 79 `STRM_BGM_EYE_09` | 132 Aroma Lady, 139 Swimmer ♀, 154 Beauty, 184 Parasol Lady, 193 Sis & Bro |
| `0x0001004C` | `0x01000050` | 80 `STRM_BGM_EYE_10` | 148 Ace Trainer, 149 Ace Trainer, 161 Expert, 163 Bird Keeper, 165 Pokémon Ranger, 166 Pokémon Ranger, 189 Expert, 211 Old Couple, 218 Rotation Girl, 229 Ace Trainer, 230 Ace Trainer, 231 Ace Duo, 236 Secret Base Expert, 242 Secret Base Trainer, 244 Secret Base Trainer, 246 Secret Base Trainer, 257 Secret Base Trainer, 259 Secret Base Trainer, 261 Secret Base Trainer |
| `0x0001004D` | `0x01000051` | 81 `STRM_BGM_EYE_11` | 188 Young Couple, 199 Poké Fan, 214 Poké Fan |
| `0x0001004E` | `0x01000052` | 82 `STRM_BGM_EYE_12` | 138 Swimmer ♂, 143 Triathlete, 144 —, 152 Pokémon Breeder, 171 Triathlete, 172 —, 190 Triathlete, 191 —, 243 Secret Base Trainer, 250 Secret Base Trainer |
| `0x0001004F` | `0x01000053` | 83 `STRM_BGM_EYE_13` | 227 Street Thug, 228 Delinquent, 245 Secret Base Trainer, 260 Secret Base Trainer |
| `0x00010050` | `0x01000054` | 84 `STRM_BGM_EYE_14` | 224 Scuba Diver, 225 Free Diver |
| `0x00010091` | `0x01000056` | 86 `STRM_BGM_EYE_AQUA` | 137 Team Aqua, 174 Aqua Leader, 175 Aqua Admin, 181 Team Aqua, 186 Aqua Admin, 215 Team Aqua |
| `0x00010090` | `0x01000055` | 85 `STRM_BGM_EYE_MAGMA` | 178 Magma Leader, 179 Team Magma, 180 Magma Admin, 182 Magma Admin, 183 Team Magma, 187 Magma Admin, 216 Team Magma |
| `0x00010025` | `0x01000087` | 135 `STRM_BGM_E_03` | 173 Interviewers |
| `0x0001006C` | `0x0100008D` | 141 `STRM_BGM_E_09` | 272 Pokémon Trainer |
| `0x00010068` | `0x0100009D` | 157 `STRM_BGM_E_CHAMP` | 198 Champion, 219 Pokémon Trainer, 277 Champion |
| `0x000100BE` | `0x0100009C` | 156 `STRM_BGM_E_SHITENNO` | 194 Elite Four, 195 Elite Four, 196 Elite Four, 197 Elite Four, 273 Elite Four, 274 Elite Four, 275 Elite Four, 276 Elite Four |

Essas 146 classes ativas se agrupam em 20 faixas: `STRM_BGM_EYE_01..14`, `STRM_BGM_EYE_AQUA`, `STRM_BGM_EYE_MAGMA`, `STRM_BGM_E_03`, `STRM_BGM_E_09`, `STRM_BGM_E_CHAMP` e `STRM_BGM_E_SHITENNO`. São valores distintos das faixas contextuais `VS_NORAPOKE`, `VS_TRAINER`, `VS_RIVAL`, `VS_GYMLEADER`, `VS_SHITENNO`, `VS_CHAMP` e `VS_LEGEND` registradas em `src/core/battleAudio.ts`; isso mostra que o campo de classe não basta para substituir a seleção contextual atual.

### Temas de vitória

Os rótulos BCSAR e os IDs de som estão resolvidos pelo mapa genérico de BGM em `code.bin @0x4928DC`, mas a escolha de `WIN1/2/3` por tipo/resultado de batalha não foi encontrada em `DllBattle.cro`, `trclass` ou `trdata`:

| Rótulo | Índice BCSAR | ID codificado | Ocorrência alinhada em `code.bin` |
|---|---:|---:|---:|
| `STRM_BGM_WIN1` | 125 | `0x0100007D` | `0x492948` |
| `STRM_BGM_WIN2` | 126 | `0x0100007E` | `0x49294C` |
| `STRM_BGM_WIN3` | 127 | `0x0100007F` | `0x492950` |

Não há referências alinhadas a esses IDs em `DllBattle.cro`, e nenhuma classe `trclass` aponta a eles. Logo a associação atual de `VICTORY_TRACKS` em `battleAudio.ts` continua sendo uma regra do host sem comprovação nessa inspeção; não foi alterada.

## Limites e atualização do core

`src/core/battleAudio.ts` agora implementa a extração pura de grupo/índice local. Os antigos aliases para `0x00060061` e `0x000A001D` foram removidos porque o dispatch os resolve para outros rótulos BCSAR do que se havia suposto; `0x000A0240` não aparece no corpus atual, então também não sustenta o alias anterior. Há testes sintéticos para o decoder e seus limites. A fórmula do decoder nativo está provada; a seleção semântica de todos os efeitos, a rota de reprodução das sequências completas e os mapeamentos por resultado da batalha permanecem fora da evidência desta probe.
