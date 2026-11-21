# Slots de arenas em `a/1/3/6`

Inventário dos 158 slots extraídos do GARC `RomFS/a/1/3/6`. `BCH direto`
indica modelo sem pacote intermediário; `BG` lista cada entrada BCH indexada e
seu tag de raiz. O inventário omite tags `btl_s*` de submalhas/recursos para
focar na identidade dos modelos.

## Conclusões da auditoria

- Os campos `F` de grama e água são os slots 11 (`btl_F_kusa`) e 12
  (`btl_F_mizu`). As plataformas correspondentes são `O` nos slots 150
  (`btl_O_kusa_m`) e 139 (`btl_O_mizu_m`).
- A família `btl_G_c_*`, slots 44–65, é Contest. O slot 44, anteriormente
  atribuído a `cave`, contém `btl_G_c_a1`; a captura revisada mostra banners
  quadriculados com laço. A textura exportada do BCH também tem o acabamento
  vermelho/amarelo de palco Contest.
- A família de masmorra é `btl_G_do_*`, slots 70–75 (`do_0`, `do_i`, `do_m`,
  `do_s`, `do_t`, `do_y`). O slot 70 (`btl_G_do_0`) exporta paredes de rocha e
  estalactites; corresponde à plataforma `btl_O_do_0_m`, slot 118. O extrator
  agora usa esse par no bioma `cave`. Os nomes provam a família genérica de
  caverna, sem identificar qual caverna do mapa usa cada variante.
- Grama e água mantêm os campos `F` 11/12 e plataformas `O` 150/139. Os nomes
  são correspondências diretas; outras variantes `F` (`mori`, `town`, `yama`,
  entre outras) e cenas `G` existem, mas não foi estabelecido vínculo com a
  seleção genérica de batalha. Não substituí os slots sem esse vínculo.
- O ginásio tem variantes específicas: `G` 78–85 (`btl_G_gym1..gym8`) e `O`
  125–132 (`btl_O_gym1..gym8_m`). O par atual 78/125 corresponde ao ginásio
  `gym1` (Rustboro); o engine ainda não escolhe um par por ginásio. O interior
  genérico usa `O` 136 (`btl_O_heya_m`); existem modelos `O` nomeados para
  outras cenas, mas a associação por zona não foi verificada.
- Os quatro modelos `O` 118/125/139/150 são camadas de arena explícitas. Não
  confirmei camadas extras além delas: o BCH secundário `G` 70/e1 e o modelo
  `O` 150/e2 (`btl_O_kusa_ms`) retornaram `Models=0` no SpicaExport.
- A confirmação foi feita por tags/estrutura do GARC e texturas BCH convertidas
  com SpicaExport. O Azahar não foi aberto; iluminação, câmera e paridade final
  continuam pendentes em P-014.

## Inventário por slot

| Slot | Conteúdo após descompactar | Tags de modelo raiz |
| ---: | --- | --- |
| 000 | BCH direto — sem tag raiz btl_F/G/O/B/V |
| 001 | BCH direto — sem tag raiz btl_F/G/O/B/V |
| 002 | BCH direto — sem tag raiz btl_F/G/O/B/V |
| 003 | BCH direto — btl_F_akai, btl_F_akai_fa2, btl_F_kusa_fa2 |
| 004 | BCH direto — btl_F_as_c |
| 005 | BCH direto — btl_F_asas |
| 006 | BCH direto — btl_F_city |
| 007 | BCH direto — btl_F_hai |
| 008 | BCH direto — btl_F_hama |
| 009 | BCH direto — btl_F_hm_c |
| 010 | BCH direto — btl_F_kaza |
| 011 | BCH direto — btl_F_kusa, btl_F_kusa_fa1 |
| 012 | BCH direto — btl_F_mizu |
| 013 | BCH direto — btl_F_kusa_fa2, btl_F_mori, btl_F_mori_fa1 |
| 014 | BCH direto — btl_F_saba, btl_F_saba_ALL |
| 015 | BCH direto — btl_F_sea |
| 016 | BCH direto — btl_F_kusa_fa1, btl_F_town |
| 017 | BCH direto — btl_F_kusa_fa1, btl_F_kusa_fa2, btl_F_yama |
| 018 | BCH direto — btl_B_kusa, btl_B_kusa_iw1, btl_B_kusa_iw2 |
| 019 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 020 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 021 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 022 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 023 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 024 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 025 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 026 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 027 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 028 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 029 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 030 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 031 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 032 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 033 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 034 | CGFX — sem tag raiz btl_F/G/O/B/V |
| 035 | BG (4 entradas) — e0: btl_G_4aku, btl_G_do_0_mu, btl_G_do_0_mu_t; e1: btl_G_4aku |
| 036 | BG (4 entradas) — e0: btl_G_4dor, btl_G_4dor_01, btl_G_4ice_moya, btl_G_4ice_moya1; e1: btl_G_4dor, btl_G_4ice_moya, btl_G_4ice_moya1 |
| 037 | BG (4 entradas) — e0: btl_G_4gst, btl_G_4gst_02, btl_G_do_0_mu, btl_G_do_0_mu_t; e1: btl_G_4gst |
| 038 | BG (4 entradas) — e0: btl_G_4ice, btl_G_4ice_02, btl_G_do_0_mu, btl_G_do_0_mu_t; e1: btl_G_4ice |
| 039 | BG (4 entradas) — e0: btl_G_as_c; e1: btl_G_as_c |
| 040 | BG (4 entradas) — e0: btl_G_asas; e1: btl_G_asas |
| 041 | BG (4 entradas) — e0: btl_G_b_aq; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 042 | BG (4 entradas) — e0: btl_G_b_mg; e1: btl_G_b_mg |
| 043 | BG (4 entradas) — e0: btl_G_bike; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 044 | BG (4 entradas) — e0: btl_G_c_a1; e1: btl_G_c_a1 |
| 045 | BG (4 entradas) — e0: btl_G_c_a2; e1: btl_G_c_a2 |
| 046 | BG (4 entradas) — e0: btl_G_c_a3; e1: btl_G_c_a3 |
| 047 | BG (4 entradas) — e0: btl_G_c_a4; e1: btl_G_c_a4 |
| 048 | BG (4 entradas) — e0: btl_G_c_a5; e1: btl_G_c_a5 |
| 049 | BG (4 entradas) — e0: btl_G_c_b1; e1: btl_G_c_b1 |
| 050 | BG (4 entradas) — e0: btl_G_c_b2; e1: btl_G_c_b2 |
| 051 | BG (4 entradas) — e0: btl_G_c_b3; e1: btl_G_c_b3 |
| 052 | BG (4 entradas) — e0: btl_G_c_b4; e1: btl_G_c_b4 |
| 053 | BG (4 entradas) — e0: btl_G_c_b5; e1: btl_G_c_b5 |
| 054 | BG (4 entradas) — e0: btl_G_c_c1; e1: btl_G_c_c1 |
| 055 | BG (4 entradas) — e0: btl_G_c_c2; e1: btl_G_c_c2 |
| 056 | BG (4 entradas) — e0: btl_G_c_c3; e1: btl_G_c_c3 |
| 057 | BG (4 entradas) — e0: btl_G_c_c4; e1: btl_G_c_c4 |
| 058 | BG (4 entradas) — e0: btl_G_c_c5; e1: btl_G_c_c5 |
| 059 | BG (4 entradas) — e0: btl_G_c_d1; e1: btl_G_c_d1 |
| 060 | BG (4 entradas) — e0: btl_G_c_d2; e1: btl_G_c_d2 |
| 061 | BG (4 entradas) — e0: btl_G_c_d3; e1: btl_G_c_d3 |
| 062 | BG (4 entradas) — e0: btl_G_c_d4; e1: btl_G_c_d4 |
| 063 | BG (4 entradas) — e0: btl_G_c_d5; e1: btl_G_c_d5 |
| 064 | BG (4 entradas) — e0: btl_G_c_ed; e1: btl_G_c_ed |
| 065 | BG (4 entradas) — e0: btl_G_c_op; e1: btl_G_c_op |
| 066 | BG (4 entradas) — e0: btl_G_ch_m; e1: btl_G_ch_m |
| 067 | BG (4 entradas) — e0: btl_G_cham; e1: btl_G_cham |
| 068 | BG (4 entradas) — e0: btl_G_city; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 069 | BG (4 entradas) — e0: btl_G_deo; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 070 | BG (4 entradas) — e0: btl_G_do_0; e1: btl_G_do_0 |
| 071 | BG (4 entradas) — e0: btl_G_do_i; e1: btl_G_do_i |
| 072 | BG (4 entradas) — e0: btl_G_do_m; e1: btl_G_do_m |
| 073 | BG (4 entradas) — e0: btl_G_do_s; e1: btl_G_do_s |
| 074 | BG (4 entradas) — e0: btl_G_do_t; e1: btl_G_do_t |
| 075 | BG (4 entradas) — e0: btl_G_do_y; e1: btl_G_do_y |
| 076 | BG (4 entradas) — e0: btl_G_fact; e1: btl_G_fact |
| 077 | BG (4 entradas) — e0: btl_B_yama_iw2, btl_G_do_k_Comb18, btl_G_gura; e1: btl_G_gura |
| 078 | BG (4 entradas) — e0: btl_G_gym1, btl_G_gym2_ga1; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 079 | BG (4 entradas) — e0: btl_G_gym2, btl_G_gym2_ga1; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 080 | BG (4 entradas) — e0: btl_G_gym2_ga1, btl_G_gym3; e1: btl_G_gym3 |
| 081 | BG (4 entradas) — e0: btl_G_gym4; e1: btl_G_gym4 |
| 082 | BG (4 entradas) — e0: btl_G_gym5, btl_G_gym5_bg0, btl_G_gym5_hk1, btl_G_gym5_ki1, btl_G_gym5_md1, btl_G_gym5_wk1; e1: btl_G_gym5 |
| 083 | BG (4 entradas) — e0: btl_G_gym2_ga1, btl_G_gym6; e1: btl_G_gym6 |
| 084 | BG (4 entradas) — e0: btl_G_gym7; e1: btl_G_gym7 |
| 085 | BG (4 entradas) — e0: btl_G_gym2_ga1, btl_G_gym8, btl_G_gym8_jm1, btl_G_gym8_mz1, btl_G_heya_hk0; e1: btl_G_gym8, btl_G_gym8_mz1 |
| 086 | BG (4 entradas) — e0: btl_G_hai; e1: btl_G_hai |
| 087 | BG (4 entradas) — e0: btl_G_haka, btl_G_haka1; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 088 | BG (4 entradas) — e0: btl_G_hama; e1: btl_G_hama |
| 089 | BG (4 entradas) — e0: btl_G_heya, btl_G_heya_hk0, btl_G_heya_ji1, btl_G_heya_ji2, btl_G_heya_ji3, btl_G_heya_w1, btl_G_heya_wt1, btl_G_kusa_ji2; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 090 | BG (4 entradas) — e0: btl_G_hm_c; e1: btl_G_hm_c |
| 091 | BG (4 entradas) — e0: btl_G_kaio; e1: btl_G_kaio |
| 092 | BG (4 entradas) — e0: btl_G_kaza; e1: btl_G_kaza |
| 093 | BG (4 entradas) — e0: btl_G_heya_ji2, btl_G_heya_w1, btl_G_heya_wt1, btl_G_kura, btl_G_kura_ji1, btl_G_kura_ji3, btl_G_kusa_ji2; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 094 | BG (4 entradas) — e0: btl_G_kusa, btl_G_kusa_ef1, btl_G_kusa_ef2, btl_G_kusa_ji1, btl_G_kusa_ji2, btl_G_kusa_ki1; e1: btl_G_kusa, btl_G_kusa_ef1 |
| 095 | BG (4 entradas) — e0: btl_G_lege; e1: btl_G_lege |
| 096 | BG (4 entradas) — e0: btl_G_mizu; e1: btl_G_mizu |
| 097 | BG (4 entradas) — e0: btl_G_kusa_ji1, btl_G_kusa_ji2, btl_G_mori, btl_G_mori_ef2, btl_G_mori_ha1, btl_G_mori_ji1, btl_G_mori_ji2, btl_G_mori_kg1, btl_G_mori_ki1, btl_G_mori_ki2, btl_G_mori_ki3, btl_G_mori_ki4, btl_G_mori_km1, btl_G_mori_km2, btl_G_mori_km3, btl_G_mori_kmr; e1: btl_G_mori |
| 098 | BG (4 entradas) — e0: btl_G_kusa_ji2, btl_G_pala, btl_G_pala_cp1, btl_G_pala_e1, btl_G_pala_ji1, btl_G_pala_kb1, btl_G_pala_kb2, btl_G_pala_lp1, btl_G_pala_lp2, btl_G_pala_tn1; e1: btl_G_pala |
| 099 | BG (4 entradas) — e0: btl_G_reku, btl_G_reku1; e1: btl_G_reku |
| 100 | BG (4 entradas) — e0: btl_G_saba, btl_G_saba_fa1; e1: btl_G_saba |
| 101 | BG (4 entradas) — e0: btl_G_sea; e1: btl_G_sea |
| 102 | BG (4 entradas) — e0: btl_G_roji_lht, btl_G_roji_lht_t, btl_G_roji_lht_t1, btl_G_ship; e1: btl_G_ship |
| 103 | BG (4 entradas) — e0: btl_G_sk_h; e1: btl_G_sk_h |
| 104 | BG (4 entradas) — e0: btl_G_sk_t; e1: btl_G_sk_t |
| 105 | BG (4 entradas) — e0: btl_G_sky1, btl_G_sky2; e1: btl_G_sky1 |
| 106 | BG (4 entradas) — e0: btl_G_soko; e1: btl_G_soko |
| 107 | BG (4 entradas) — e0: btl_G_kusa_ef2, btl_G_kusa_ji1, btl_G_kusa_ji2, btl_G_kusa_ki1, btl_G_town; e1: btl_G_town |
| 108 | BG (4 entradas) — e0: btl_G_volc; e1: btl_G_volc |
| 109 | BG (4 entradas) — e0: btl_G_vs1, btl_G_vs1_04_tv; e1: btl_G_vs1, btl_G_vs1_04_tv |
| 110 | BG (4 entradas) — e0: btl_G_vs1, btl_G_vs2, btl_G_vs2_02_tik_Comb19, btl_G_vs2_ligh2, btl_G_vs2_ligh3; e1: btl_G_vs1, btl_G_vs2, btl_G_vs2_02_tik_Comb19 |
| 111 | BG (4 entradas) — e0: btl_G_vs3; e1: btl_G_vs3 |
| 112 | BG (4 entradas) — e0: btl_G_yama; e1: btl_G_yama |
| 113 | BG (4 entradas) — e0: btl_F_kusa_fa1, btl_G_kusa_ef1, btl_G_kusa_ef2, btl_G_kusa_ji1, btl_G_kusa_ji2, btl_G_kusa_ki1, btl_G_last, btl_G_last_s1, btl_G_last_s2, btl_G_last_s3; e1: btl_G_kusa_ef1, btl_G_last |
| 114 | BG (5 entradas) — e0: btl_V_iwa1, btl_V_iwa1_1, btl_V_iwa1_e, btl_V_iwa1_e2; e1: btl_V_iwa1, btl_V_iwa1_e2; e2: btl_V_iwa1_conv |
| 115 | BG (3 entradas) — e0: btl_O_asas_m, btl_O_asas_sea, btl_O_sea_ami, btl_O_sea_amiB, btl_O_sea_line; e1: btl_O_asas_m |
| 116 | BG (3 entradas) — e0: btl_O_ch_m_m, btl_O_kusa_bon, btl_O_kusa_ku1, btl_O_kusa_line; e1: btl_O_ch_m_m, btl_O_kusa_ku1 |
| 117 | BG (3 entradas) — e0: btl_O_city_bon, btl_O_city_line, btl_O_city_m; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 118 | BG (3 entradas) — e0: btl_O_do_0_bon, btl_O_do_0_iwa, btl_O_do_0_line, btl_O_do_0_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 119 | BG (3 entradas) — e0: btl_O_do_i_bon, btl_O_do_i_iwa, btl_O_do_i_line, btl_O_do_i_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 120 | BG (3 entradas) — e0: btl_O_do_m_bon, btl_O_do_m_iwa, btl_O_do_m_line, btl_O_do_m_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 121 | BG (3 entradas) — e0: btl_O_do_s_bon, btl_O_do_s_iwa, btl_O_do_s_line, btl_O_do_s_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 122 | BG (3 entradas) — e0: btl_O_do_t_bon, btl_O_do_t_iwa, btl_O_do_t_line, btl_O_do_t_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 123 | BG (3 entradas) — e0: btl_O_do_y_bon, btl_O_do_y_line, btl_O_do_y_m, btl_O_do_y_tg, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 124 | BG (3 entradas) — e0: btl_O_city_bon, btl_O_city_line, btl_O_city_m_test02_obon_anim, btl_O_city_m_test02_obon_city_m, btl_O_fact_m; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 125 | BG (3 entradas) — e0: btl_O_gym1_bon, btl_O_gym1_line, btl_O_gym1_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 126 | BG (3 entradas) — e0: btl_O_gym2_bon, btl_O_gym2_line, btl_O_gym2_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 127 | BG (3 entradas) — e0: btl_O_gym3_bon, btl_O_gym3_line, btl_O_gym3_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 128 | BG (3 entradas) — e0: btl_O_gym4_bon, btl_O_gym4_line, btl_O_gym4_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 129 | BG (3 entradas) — e0: btl_O_gym5_bon, btl_O_gym5_line, btl_O_gym5_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 130 | BG (3 entradas) — e0: btl_O_gym6_bon, btl_O_gym6_line, btl_O_gym6_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 131 | BG (3 entradas) — e0: btl_O_gym7_bon, btl_O_gym7_line, btl_O_gym7_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 132 | BG (3 entradas) — e0: btl_O_gym8_bon, btl_O_gym8_line, btl_O_gym8_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 133 | BG (3 entradas) — e0: btl_O_hai_m, btl_O_kusa_bon, btl_O_kusa_ku1, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 134 | BG (3 entradas) — e0: btl_O_city_bon, btl_O_city_line, btl_O_city_m_test02_obon_anim, btl_O_city_m_test02_obon_city_m, btl_O_haka_m; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 135 | BG (3 entradas) — e0: btl_O_hama_bon, btl_O_hama_line, btl_O_hama_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 136 | BG (3 entradas) — e0: btl_O_heya_bon, btl_O_heya_line, btl_O_heya_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 137 | BG (3 entradas) — e0: btl_O_kaza_bon, btl_O_kaza_iwa, btl_O_kaza_line, btl_O_kaza_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 138 | BG (3 entradas) — e0: btl_O_kura_bon, btl_O_kura_line, btl_O_kura_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 139 | BG (3 entradas) — e0: btl_O_mizu_bon, btl_O_mizu_line, btl_O_mizu_m, btl_O_sea_ami, btl_O_sea_amiB; e1: btl_O_mizu_m |
| 140 | BG (3 entradas) — e0: btl_O_kusa_bon, btl_O_kusa_line, btl_O_pala_bon, btl_O_pala_line, btl_O_pala_m; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 141 | BG (3 entradas) — e0: btl_O_kusa_bon, btl_O_kusa_line, btl_O_saba_bon, btl_O_saba_line, btl_O_saba_m; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 142 | BG (3 entradas) — e0: btl_O_sea_ami, btl_O_sea_amiB, btl_O_sea_line, btl_O_sea_m, btl_O_sea_sea; e1: btl_O_sea_m |
| 143 | BG (3 entradas) — e0: btl_O_kusa_bon, btl_O_kusa_line, btl_O_sk_h_m; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 144 | BG (3 entradas) — e0: btl_O_sky1_bon_t, btl_O_sky1_line_t, btl_O_sky1_m; e1: btl_O_sky1_bon_t, btl_O_sky1_m |
| 145 | BG (3 entradas) — e0: btl_O_kusa_bon, btl_O_kusa_line, btl_O_soko_bon, btl_O_soko_line, btl_O_soko_m, btl_O_soko_tg; e1: btl_O_soko_m |
| 146 | BG (3 entradas) — e0: btl_O_kusa_bon, btl_O_kusa_ku1, btl_O_kusa_line, btl_O_town_bon, btl_O_town_ku1, btl_O_town_line, btl_O_town_m; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 147 | BG (3 entradas) — e0: btl_O_kusa_bon, btl_O_kusa_line, btl_O_volc_m; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 148 | BG (3 entradas) — e0: btl_O_kusa_bon, btl_O_kusa_line, btl_O_vs1_bon, btl_O_vs1_line, btl_O_vs1_m; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 149 | BG (3 entradas) — e0: btl_O_kusa_bon, btl_O_kusa_line, btl_O_yama_bon, btl_O_yama_iwa, btl_O_yama_line, btl_O_yama_m; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 150 | BG (6 entradas) — e0: btl_O_kusa_bon, btl_O_kusa_line, btl_O_kusa_m; e1: BCH sem tag raiz btl_F/G/O/B/V; e2: btl_O_kusa_ms |
| 151 | BG (6 entradas) — e0: btl_O_kusa_bon, btl_O_kusa_line, btl_O_mori_com, btl_O_mori_line, btl_O_mori_m; e1: btl_O_mori_m; e2: btl_O_mori_ms |
| 152 | BG (6 entradas) — e0: btl_O_hai2_m, btl_O_kusa_bon, btl_O_kusa_line; e1: BCH sem tag raiz btl_F/G/O/B/V; e2: btl_O_hai2_ms |
| 153 | BG (4 entradas) — e0: BCH sem tag raiz btl_F/G/O/B/V; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 154 | BG (4 entradas) — e0: BCH sem tag raiz btl_F/G/O/B/V; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 155 | BG (4 entradas) — e0: btl_G_vs1_bn1, btl_G_vs1_hto, btl_G_vs1_kb1, btl_G_vs1_moj, btl_G_vs1_sq1, btl_G_vs1_sq2, btl_G_vs1_tv; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 156 | BG (4 entradas) — e0: btl_G_vs1_bn1, btl_G_vs1_hto, btl_G_vs1_kb1, btl_G_vs1_moj, btl_G_vs1_sq1, btl_G_vs1_sq2, btl_G_vs1_tv; e1: BCH sem tag raiz btl_F/G/O/B/V |
| 157 | BG (4 entradas) — e0: BCH sem tag raiz btl_F/G/O/B/V; e1: BCH sem tag raiz btl_F/G/O/B/V |
