export type HoennLocationKind = 'city' | 'town' | 'route' | 'landmark';

export interface HoennLocation {
  id: string;
  name: string;
  kind: HoennLocationKind;
  x: number;
  y: number;
  description: string;
}

export const HOENN_MAP_VIEWBOX = { width: 800, height: 460 } as const;

export const HOENN_LOCATIONS: readonly HoennLocation[] = [
  { id: 'littleroot-town', name: 'Littleroot Town', kind: 'town', x: 395, y: 418, description: 'Uma pequena cidade no sul de Hoenn e o lar da sua aventura.' },
  { id: 'oldale-town', name: 'Oldale Town', kind: 'town', x: 385, y: 358, description: 'Uma cidade tranquila entre Littleroot e as rotas do centro de Hoenn.' },
  { id: 'petalburg-city', name: 'Petalburg City', kind: 'city', x: 245, y: 322, description: 'Cidade costeira a oeste, conhecida pelo Ginásio de Petalburg.' },
  { id: 'rustboro-city', name: 'Rustboro City', kind: 'city', x: 325, y: 230, description: 'Cidade do noroeste onde fica a Devon Corporation.' },
  { id: 'dewford-town', name: 'Dewford Town', kind: 'town', x: 265, y: 420, description: 'Pequena cidade insular a sudoeste de Hoenn.' },
  { id: 'slateport-city', name: 'Slateport City', kind: 'city', x: 455, y: 360, description: 'Cidade portuária movimentada na costa sul.' },
  { id: 'mauville-city', name: 'Mauville City', kind: 'city', x: 475, y: 270, description: 'Cidade central de Hoenn, no cruzamento de várias rotas.' },
  { id: 'verdanturf-town', name: 'Verdanturf Town', kind: 'town', x: 385, y: 267, description: 'Cidade do interior conhecida pelo ar limpo e pelo Rusturf Tunnel.' },
  { id: 'fallarbor-town', name: 'Fallarbor Town', kind: 'town', x: 170, y: 82, description: 'Pequena cidade rural no noroeste da região.' },
  { id: 'lavaridge-town', name: 'Lavaridge Town', kind: 'town', x: 480, y: 182, description: 'Cidade termal nas encostas do Mt. Chimney.' },
  { id: 'fortree-city', name: 'Fortree City', kind: 'city', x: 585, y: 213, description: 'Cidade construída entre as árvores no leste de Hoenn.' },
  { id: 'lilycove-city', name: 'Lilycove City', kind: 'city', x: 685, y: 235, description: 'Grande cidade costeira no extremo leste do continente.' },
  { id: 'mossdeep-city', name: 'Mossdeep City', kind: 'city', x: 730, y: 190, description: 'Cidade insular que abriga o Centro Espacial de Hoenn.' },
  { id: 'sootopolis-city', name: 'Sootopolis City', kind: 'city', x: 595, y: 375, description: 'Cidade dentro de uma caldeira vulcânica, acessível pelo mar.' },
  { id: 'pacifidlog-town', name: 'Pacifidlog Town', kind: 'town', x: 490, y: 410, description: 'Cidade flutuante sobre as correntes do sul.' },
  { id: 'ever-grande-city', name: 'Ever Grande City', kind: 'city', x: 745, y: 355, description: 'Cidade no extremo sudeste e porta de entrada para a Liga Pokémon.' },
  { id: 'pokemon-league', name: 'Pokémon League', kind: 'landmark', x: 754, y: 323, description: 'O destino final dos treinadores que desafiam a Liga de Hoenn.' },
  { id: 'route-101', name: 'Route 101', kind: 'route', x: 395, y: 387, description: 'Rota curta que liga Littleroot Town a Oldale Town.' },
  { id: 'route-102', name: 'Route 102', kind: 'route', x: 315, y: 342, description: 'Rota a oeste de Oldale Town, no caminho para Petalburg City.' },
  { id: 'route-103', name: 'Route 103', kind: 'route', x: 410, y: 304, description: 'Rota ao norte de Oldale Town, junto à costa leste.' },
  { id: 'route-104', name: 'Route 104', kind: 'route', x: 285, y: 275, description: 'Rota costeira entre Petalburg Woods e Rustboro City.' },
  { id: 'route-105', name: 'Route 105', kind: 'route', x: 205, y: 395, description: 'Rota marítima a oeste de Dewford Town.' },
  { id: 'route-106', name: 'Route 106', kind: 'route', x: 228, y: 365, description: 'Trecho marítimo ao norte de Dewford Town.' },
  { id: 'route-107', name: 'Route 107', kind: 'route', x: 305, y: 438, description: 'Rota marítima que segue a leste de Dewford Town.' },
  { id: 'route-108', name: 'Route 108', kind: 'route', x: 365, y: 425, description: 'Rota marítima entre Dewford e Slateport.' },
  { id: 'route-109', name: 'Route 109', kind: 'route', x: 430, y: 405, description: 'Rota costeira ao sul de Slateport City.' },
  { id: 'route-110', name: 'Route 110', kind: 'route', x: 465, y: 318, description: 'Rota entre Slateport City e Mauville City.' },
  { id: 'route-111', name: 'Route 111', kind: 'route', x: 440, y: 232, description: 'Rota que atravessa o centro-norte de Hoenn.' },
  { id: 'route-112', name: 'Route 112', kind: 'route', x: 475, y: 213, description: 'Rota que contorna o Mt. Chimney e leva a Lavaridge.' },
  { id: 'route-113', name: 'Route 113', kind: 'route', x: 285, y: 105, description: 'Rota de cinzas vulcânicas a leste de Fallarbor Town.' },
  { id: 'route-114', name: 'Route 114', kind: 'route', x: 220, y: 150, description: 'Rota no vale do rio entre Fallarbor e Meteor Falls.' },
  { id: 'route-115', name: 'Route 115', kind: 'route', x: 275, y: 180, description: 'Rota costeira ao norte de Rustboro City.' },
  { id: 'route-116', name: 'Route 116', kind: 'route', x: 345, y: 242, description: 'Rota a leste de Rustboro, junto ao Rusturf Tunnel.' },
  { id: 'route-117', name: 'Route 117', kind: 'route', x: 430, y: 270, description: 'Rota que liga Mauville City a Verdanturf Town.' },
  { id: 'route-118', name: 'Route 118', kind: 'route', x: 525, y: 280, description: 'Rota costeira a leste de Mauville City.' },
  { id: 'route-119', name: 'Route 119', kind: 'route', x: 555, y: 242, description: 'Rota longa e chuvosa que atravessa a região central.' },
  { id: 'route-120', name: 'Route 120', kind: 'route', x: 615, y: 258, description: 'Rota de pontes e lagoas a oeste de Lilycove City.' },
  { id: 'route-121', name: 'Route 121', kind: 'route', x: 650, y: 267, description: 'Rota que conduz a Lilycove City e à Safari Zone.' },
  { id: 'route-122', name: 'Route 122', kind: 'route', x: 645, y: 310, description: 'Rota marítima ao redor do Mt. Pyre.' },
  { id: 'route-123', name: 'Route 123', kind: 'route', x: 555, y: 330, description: 'Rota costeira ao sul de Fortree e Lilycove.' },
  { id: 'route-124', name: 'Route 124', kind: 'route', x: 690, y: 278, description: 'Rota marítima que liga Lilycove a Mossdeep.' },
  { id: 'route-125', name: 'Route 125', kind: 'route', x: 755, y: 220, description: 'Rota marítima ao norte de Mossdeep, perto da Shoal Cave.' },
  { id: 'route-126', name: 'Route 126', kind: 'route', x: 620, y: 355, description: 'Rota marítima que contorna Sootopolis City.' },
  { id: 'route-127', name: 'Route 127', kind: 'route', x: 680, y: 390, description: 'Rota marítima ao sul de Mossdeep.' },
  { id: 'route-128', name: 'Route 128', kind: 'route', x: 730, y: 405, description: 'Rota marítima a nordeste de Ever Grande City.' },
  { id: 'route-129', name: 'Route 129', kind: 'route', x: 680, y: 435, description: 'Trecho oceânico no limite sul da região.' },
  { id: 'route-130', name: 'Route 130', kind: 'route', x: 615, y: 438, description: 'Trecho oceânico a oeste da Route 129.' },
  { id: 'route-131', name: 'Route 131', kind: 'route', x: 545, y: 438, description: 'Rota marítima que segue em direção a Pacifidlog Town.' },
  { id: 'route-132', name: 'Route 132', kind: 'route', x: 455, y: 438, description: 'Corrente marítima a oeste de Pacifidlog Town.' },
  { id: 'route-133', name: 'Route 133', kind: 'route', x: 390, y: 450, description: 'Rota marítima entre Pacifidlog e Slateport.' },
  { id: 'route-134', name: 'Route 134', kind: 'route', x: 355, y: 390, description: 'Rota marítima e correnteza a oeste de Slateport.' },
  { id: 'meteor-falls', name: 'Meteor Falls', kind: 'landmark', x: 205, y: 122, description: 'Cavernas e quedas d’água entre Rustboro e Fallarbor.' },
  { id: 'petalburg-woods', name: 'Petalburg Woods', kind: 'landmark', x: 265, y: 294, description: 'Floresta densa na Route 104, a norte de Petalburg.' },
  { id: 'rusturf-tunnel', name: 'Rusturf Tunnel', kind: 'landmark', x: 365, y: 250, description: 'Túnel que atravessa a serra entre Rustboro e Verdanturf.' },
  { id: 'granite-cave', name: 'Granite Cave', kind: 'landmark', x: 245, y: 390, description: 'Caverna na ilha de Dewford, conhecida pelas suas profundezas.' },
  { id: 'mt-chimney', name: 'Mt. Chimney', kind: 'landmark', x: 455, y: 150, description: 'Vulcão no centro-norte de Hoenn, acessível pelo bondinho.' },
  { id: 'jagged-pass', name: 'Jagged Pass', kind: 'landmark', x: 475, y: 165, description: 'Trilha íngreme que desce do Mt. Chimney até Lavaridge.' },
  { id: 'fiery-path', name: 'Fiery Path', kind: 'landmark', x: 500, y: 195, description: 'Túnel vulcânico que atravessa a montanha.' },
  { id: 'desert-ruins', name: 'Desert Ruins', kind: 'landmark', x: 410, y: 195, description: 'Ruínas antigas no deserto da Route 111.' },
  { id: 'shoal-cave', name: 'Shoal Cave', kind: 'landmark', x: 760, y: 202, description: 'Caverna costeira ao norte de Mossdeep.' },
  { id: 'mt-pyre', name: 'Mt. Pyre', kind: 'landmark', x: 665, y: 315, description: 'Montanha sagrada na Route 122, junto ao mar.' },
  { id: 'safari-zone', name: 'Safari Zone', kind: 'landmark', x: 670, y: 250, description: 'Reserva natural acessível pela Route 121.' },
  { id: 'seafloor-cavern', name: 'Seafloor Cavern', kind: 'landmark', x: 665, y: 365, description: 'Caverna submarina escondida nas rotas marítimas.' },
  { id: 'cave-of-origin', name: 'Cave of Origin', kind: 'landmark', x: 585, y: 390, description: 'Caverna sagrada sob Sootopolis City.' },
  { id: 'sky-pillar', name: 'Sky Pillar', kind: 'landmark', x: 520, y: 390, description: 'Torre antiga que se ergue sobre o oceano.' },
  { id: 'victory-road', name: 'Victory Road', kind: 'landmark', x: 750, y: 340, description: 'Caverna que atravessa a passagem para a Liga Pokémon.' },
  { id: 'battle-resort', name: 'Battle Resort', kind: 'landmark', x: 755, y: 438, description: 'Ilha de batalha no extremo sudeste de Hoenn.' },
  { id: 'sea-mauville', name: 'Sea Mauville', kind: 'landmark', x: 405, y: 412, description: 'Estrutura abandonada que flutua no mar ao sul de Slateport.' },
  { id: 'southern-island', name: 'Southern Island', kind: 'landmark', x: 320, y: 410, description: 'Ilha remota ao sul de Hoenn.' },
  { id: 'island-cave', name: 'Island Cave', kind: 'landmark', x: 185, y: 365, description: 'Caverna insular nas águas a oeste de Hoenn.' },
  { id: 'sealed-chamber', name: 'Sealed Chamber', kind: 'landmark', x: 335, y: 380, description: 'Câmara submersa no leito marinho da Route 134.' },
  { id: 'new-mauville', name: 'New Mauville', kind: 'landmark', x: 505, y: 300, description: 'Instalação elétrica subterrânea acessada pelas águas a leste de Mauville.' },
  { id: 'ancient-tomb', name: 'Ancient Tomb', kind: 'landmark', x: 405, y: 207, description: 'Tumba antiga no deserto da Route 111.' },
  { id: 'scorched-slab', name: 'Scorched Slab', kind: 'landmark', x: 620, y: 250, description: 'Caverna escondida na Route 120.' },
  { id: 'team-aqua-hideout', name: 'Team Aqua Hideout', kind: 'landmark', x: 705, y: 250, description: 'Esconderijo da Team Aqua na costa de Lilycove.' },
  { id: 'team-magma-hideout', name: 'Team Magma Hideout', kind: 'landmark', x: 435, y: 145, description: 'Esconderijo da Team Magma nas encostas do Mt. Chimney.' },
  { id: 'secret-islet', name: 'Secret Islet', kind: 'landmark', x: 160, y: 420, description: 'Pequena ilha escondida nas águas a sudoeste de Hoenn.' },
  { id: 'secret-shore', name: 'Secret Shore', kind: 'landmark', x: 470, y: 445, description: 'Costa isolada acessível pelas rotas marítimas do sul.' },
  { id: 'mirage-forest', name: 'Mirage Forest', kind: 'landmark', x: 630, y: 230, description: 'Floresta que aparece em uma ilha miragem de Hoenn.' },
  { id: 'mirage-cave', name: 'Mirage Cave', kind: 'landmark', x: 650, y: 295, description: 'Caverna em uma ilha miragem que surge sobre o oceano.' },
  { id: 'mirage-island', name: 'Mirage Island', kind: 'landmark', x: 415, y: 445, description: 'Ilha miragem que pode surgir nas águas ao sul da região.' },
  { id: 'mirage-mountain', name: 'Mirage Mountain', kind: 'landmark', x: 675, y: 185, description: 'Montanha isolada em uma ilha miragem de Hoenn.' },
  { id: 'ss-tidal', name: 'S.S. Tidal', kind: 'landmark', x: 450, y: 385, description: 'Navio de passageiros que viaja entre os portos de Hoenn.' },
  { id: 'crescent-isle', name: 'Crescent Isle', kind: 'landmark', x: 775, y: 245, description: 'Ilha em forma de crescente nas águas a leste de Hoenn.' },
  { id: 'trackless-forest', name: 'Trackless Forest', kind: 'landmark', x: 610, y: 205, description: 'Floresta isolada em uma ilha miragem.' },
  { id: 'pathless-plain', name: 'Pathless Plain', kind: 'landmark', x: 430, y: 455, description: 'Planície remota que aparece sobre as rotas marítimas.' },
  { id: 'nameless-cavern', name: 'Nameless Cavern', kind: 'landmark', x: 645, y: 325, description: 'Caverna sem nome em uma ilha afastada da costa.' },
  { id: 'fabled-cave', name: 'Fabled Cave', kind: 'landmark', x: 640, y: 220, description: 'Caverna que surge em uma ilha miragem de Hoenn.' },
  { id: 'gnarled-den', name: 'Gnarled Den', kind: 'landmark', x: 535, y: 265, description: 'Gruta escondida entre as ilhas miragem.' },
  { id: 'secret-meadow', name: 'Secret Meadow', kind: 'landmark', x: 620, y: 235, description: 'Prado escondido em uma ilha miragem.' },
];

export const HOENN_MAP_CONNECTIONS: readonly (readonly [string, string])[] = [
  ['littleroot-town', 'route-101'], ['route-101', 'oldale-town'],
  ['oldale-town', 'route-102'], ['route-102', 'petalburg-city'],
  ['oldale-town', 'route-103'], ['route-103', 'route-110'],
  ['petalburg-city', 'route-104'], ['route-104', 'rustboro-city'],
  ['route-104', 'petalburg-woods'], ['rustboro-city', 'route-115'], ['route-115', 'meteor-falls'],
  ['rustboro-city', 'route-116'], ['route-116', 'rusturf-tunnel'], ['rusturf-tunnel', 'verdanturf-town'],
  ['route-114', 'fallarbor-town'], ['route-114', 'meteor-falls'], ['fallarbor-town', 'route-113'],
  ['route-113', 'mt-chimney'], ['mt-chimney', 'jagged-pass'], ['jagged-pass', 'lavaridge-town'],
  ['mt-chimney', 'route-112'], ['route-112', 'fiery-path'], ['route-112', 'route-111'],
  ['mauville-city', 'route-111'], ['route-111', 'desert-ruins'], ['mauville-city', 'route-117'],
  ['route-117', 'verdanturf-town'], ['mauville-city', 'route-110'], ['route-110', 'slateport-city'],
  ['mauville-city', 'route-118'], ['route-118', 'route-119'], ['route-119', 'fortree-city'],
  ['fortree-city', 'route-120'], ['route-120', 'route-121'], ['route-121', 'lilycove-city'],
  ['route-121', 'safari-zone'], ['route-121', 'route-122'], ['route-122', 'mt-pyre'],
  ['route-121', 'route-123'], ['route-123', 'route-118'], ['lilycove-city', 'route-124'],
  ['route-124', 'mossdeep-city'], ['route-124', 'route-125'], ['route-125', 'shoal-cave'],
  ['route-124', 'route-126'], ['route-126', 'sootopolis-city'], ['route-126', 'route-127'],
  ['route-127', 'route-128'], ['route-128', 'ever-grande-city'], ['route-128', 'route-129'],
  ['route-129', 'route-130'], ['route-130', 'route-131'], ['route-131', 'pacifidlog-town'],
  ['pacifidlog-town', 'route-132'], ['route-132', 'route-133'], ['route-133', 'route-134'],
  ['route-134', 'slateport-city'], ['route-105', 'route-106'], ['route-106', 'dewford-town'],
  ['dewford-town', 'route-107'], ['route-107', 'route-108'], ['route-108', 'slateport-city'],
  ['route-105', 'granite-cave'], ['route-127', 'seafloor-cavern'], ['sootopolis-city', 'cave-of-origin'],
  ['route-131', 'sky-pillar'], ['ever-grande-city', 'victory-road'], ['route-130', 'battle-resort'],
  ['route-109', 'slateport-city'], ['route-109', 'sea-mauville'], ['route-105', 'island-cave'],
  ['route-134', 'sealed-chamber'], ['route-129', 'southern-island'],
  ['mauville-city', 'new-mauville'], ['route-111', 'ancient-tomb'], ['route-120', 'scorched-slab'],
  ['lilycove-city', 'team-aqua-hideout'], ['mt-chimney', 'team-magma-hideout'],
  ['route-105', 'secret-islet'], ['route-131', 'secret-shore'], ['route-119', 'mirage-forest'],
  ['route-120', 'mirage-cave'], ['route-130', 'mirage-island'], ['route-124', 'mirage-mountain'],
  ['slateport-city', 'ss-tidal'], ['route-125', 'crescent-isle'], ['route-119', 'trackless-forest'],
  ['route-132', 'pathless-plain'], ['route-126', 'nameless-cavern'], ['route-119', 'fabled-cave'],
  ['route-118', 'gnarled-den'], ['route-120', 'secret-meadow'],
];

const LOCATION_BY_ID = new Map(HOENN_LOCATIONS.map((location) => [location.id, location]));
const MAP_ID_ALIASES: Readonly<Record<string, string>> = {
  brendan_house: 'littleroot-town', may_house: 'littleroot-town', birch_lab: 'littleroot-town',
  oldale_mart: 'oldale-town', oldale_pokecenter: 'oldale-town',
  zone_0006: 'littleroot-town', zone_0007: 'oldale-town', zone_0008: 'dewford-town',
  zone_0009: 'lavaridge-town', zone_0010: 'fallarbor-town', zone_0011: 'verdanturf-town',
  zone_0012: 'pacifidlog-town', zone_0013: 'petalburg-city', zone_0014: 'slateport-city',
  zone_0015: 'mauville-city', zone_0016: 'rustboro-city', zone_0017: 'fortree-city',
  zone_0018: 'lilycove-city', zone_0019: 'mossdeep-city', zone_0020: 'sootopolis-city',
  zone_0021: 'ever-grande-city', zone_0022: 'pokemon-league',
};

function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
}

function findByName(value: string): HoennLocation | undefined {
  const name = normalizeName(value);
  return HOENN_LOCATIONS.find((location) => normalizeName(location.name) === name || normalizeName(location.id) === name);
}

export function resolveHoennLocation(mapId: string, zoneName?: string): HoennLocation | null {
  if (zoneName) {
    const byName = findByName(zoneName);
    if (byName) return byName;
  }
  const mapKey = mapId.toLowerCase();
  const alias = MAP_ID_ALIASES[mapKey];
  if (alias) return LOCATION_BY_ID.get(alias) ?? null;
  return findByName(mapId) ?? null;
}
