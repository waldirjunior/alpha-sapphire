import {
  HOENN_LOCATIONS,
  HOENN_MAP_CONNECTIONS,
  HOENN_MAP_VIEWBOX,
  resolveHoennLocation,
} from '../core/hoennMap';

interface AreaNavHost {
  getPlayerMap(): { mapId: string; zoneName?: string };
  getSelectedMapLocationId(): string | null;
  setSelectedMapLocationId(locationId: string): void;
}

const LAND_OUTLINE = 'M178 72 261 50 352 67 406 89 451 119 470 169 530 194 589 177 641 194 718 177 772 204 757 256 786 305 760 358 727 391 690 427 621 448 552 444 500 426 440 448 380 446 321 428 265 443 218 415 181 369 202 323 219 277 247 226 230 177 181 128Z';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const AREANAV_ICON_PATHS = [
  'M3 5h18v14H3z M8 5v14 M8 11h13',
  'M4 4h16v4H4z M4 10h16v4H4z M4 16h16v4H4z',
  'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5',
  'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M5 21c0-4 3-7 7-7s7 3 7 7',
] as const;

type HoennLocation = (typeof HOENN_LOCATIONS)[number];

export function renderAreaNavTab(host: AreaNavHost, panel: HTMLElement): void {
  const playerMap = host.getPlayerMap();
  const playerLocation = resolveHoennLocation(playerMap.mapId, playerMap.zoneName);
  const selected = HOENN_LOCATIONS.find(({ id }) => id === host.getSelectedMapLocationId()) ?? playerLocation;
  const layout = createAreaNavLayout();
  const label = createLocationLabel(selected);
  const details = createMapDetails(selected ?? undefined);
  const svg = createHoennSvg(playerLocation, selected?.id ?? null, (id) => {
    const location = HOENN_LOCATIONS.find((entry) => entry.id === id);
    if (!location) return;
    host.setSelectedMapLocationId(id);
    updateMapSelection(svg, label, details, location);
  });
  const frame = document.createElement('div');
  frame.className = 'areanav-map-frame';
  frame.append(svg, label);
  layout.append(createAreaNavTitle(), frame, details, createAreaNavIconRow());
  panel.appendChild(layout);
}

function createAreaNavLayout(): HTMLElement {
  const layout = document.createElement('section');
  layout.className = 'oras-hoenn-map';
  layout.setAttribute('aria-label', 'AreaNav');
  return layout;
}

function createAreaNavTitle(): HTMLHeadingElement {
  const title = document.createElement('h2');
  title.className = 'areanav-title';
  title.textContent = 'AreaNav';
  return title;
}

function createLocationLabel(location: HoennLocation | null): HTMLElement {
  const label = document.createElement('span');
  label.className = 'areanav-current-location';
  label.setAttribute('aria-live', 'polite');
  label.textContent = location?.name ?? 'Posição atual';
  return label;
}

function createAreaNavIconRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'areanav-icon-row';
  row.setAttribute('aria-hidden', 'true');
  AREANAV_ICON_PATHS.forEach((pathData) => row.appendChild(createAreaNavIcon(pathData)));
  return row;
}

function createAreaNavIcon(pathData: string): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'areanav-icon';
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  icon.appendChild(svg);
  return icon;
}

function createHoennSvg(
  playerLocation: HoennLocation | null,
  selectedId: string | null,
  selectLocation: (id: string) => void,
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('class', 'hoenn-map-svg');
  svg.setAttribute('viewBox', `0 0 ${HOENN_MAP_VIEWBOX.width} ${HOENN_MAP_VIEWBOX.height}`);
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Mapa interativo da região de Hoenn');
  addMapBackdrop(svg);
  for (const [from, to] of HOENN_MAP_CONNECTIONS) addMapConnection(svg, from, to);
  for (const location of HOENN_LOCATIONS) addMapLocation(svg, location, selectedId, selectLocation);
  if (playerLocation) addPlayerMarker(svg, playerLocation);
  return svg;
}

function addMapBackdrop(svg: SVGSVGElement): void {
  const defs = document.createElementNS(SVG_NAMESPACE, 'defs');
  const texture = document.createElementNS(SVG_NAMESPACE, 'pattern');
  texture.setAttribute('id', 'areanav-land-texture');
  texture.setAttribute('patternUnits', 'userSpaceOnUse');
  texture.setAttribute('width', '16');
  texture.setAttribute('height', '16');
  texture.append(createTextureBase(), createTextureTile(0, 0), createTextureTile(8, 8));
  defs.appendChild(texture);
  svg.appendChild(defs);
  const land = document.createElementNS(SVG_NAMESPACE, 'path');
  land.setAttribute('class', 'hoenn-map-land');
  land.setAttribute('d', LAND_OUTLINE);
  svg.appendChild(land);
}

function createTextureBase(): SVGRectElement {
  const base = document.createElementNS(SVG_NAMESPACE, 'rect');
  base.setAttribute('width', '16');
  base.setAttribute('height', '16');
  base.setAttribute('fill', '#309c49');
  return base;
}

function createTextureTile(x: number, y: number): SVGRectElement {
  const tile = document.createElementNS(SVG_NAMESPACE, 'rect');
  tile.setAttribute('x', String(x));
  tile.setAttribute('y', String(y));
  tile.setAttribute('width', '7');
  tile.setAttribute('height', '7');
  tile.setAttribute('rx', '2');
  tile.setAttribute('fill', '#72c45f');
  tile.setAttribute('opacity', '0.75');
  return tile;
}

function addMapConnection(svg: SVGSVGElement, fromId: string, toId: string): void {
  const from = HOENN_LOCATIONS.find(({ id }) => id === fromId);
  const to = HOENN_LOCATIONS.find(({ id }) => id === toId);
  if (!from || !to) return;
  const line = document.createElementNS(SVG_NAMESPACE, 'line');
  line.setAttribute('class', `hoenn-map-route${from.kind === 'route' || to.kind === 'route' ? ' road' : ''}`);
  line.setAttribute('x1', String(from.x));
  line.setAttribute('y1', String(from.y));
  line.setAttribute('x2', String(to.x));
  line.setAttribute('y2', String(to.y));
  svg.appendChild(line);
}

function addMapLocation(
  svg: SVGSVGElement,
  location: HoennLocation,
  selectedId: string | null,
  selectLocation: (id: string) => void,
): void {
  const group = document.createElementNS(SVG_NAMESPACE, 'g');
  group.setAttribute('class', `hoenn-map-location ${location.kind}${location.id === selectedId ? ' selected' : ''}`);
  group.setAttribute('data-location-id', location.id);
  group.setAttribute('role', 'button');
  group.setAttribute('tabindex', '0');
  group.setAttribute('aria-label', `${location.name}. ${location.description}`);
  group.setAttribute('aria-pressed', String(location.id === selectedId));
  group.appendChild(createLocationTitle(location));
  group.appendChild(createLocationDot(location));
  group.addEventListener('click', () => selectLocation(location.id));
  group.addEventListener('keydown', (event) => {
    if (event instanceof KeyboardEvent) activateMapLocation(event, location.id, selectLocation);
  });
  group.setAttribute('transform', `translate(${location.x} ${location.y})`);
  svg.appendChild(group);
}

function createLocationTitle(location: HoennLocation): SVGTitleElement {
  const title = document.createElementNS(SVG_NAMESPACE, 'title');
  title.textContent = `${location.name}: ${location.description}`;
  return title;
}

function createLocationDot(location: HoennLocation): SVGCircleElement {
  const dot = document.createElementNS(SVG_NAMESPACE, 'circle');
  dot.setAttribute('r', location.kind === 'route' ? '5' : '8');
  return dot;
}

function activateMapLocation(event: KeyboardEvent, id: string, selectLocation: (id: string) => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  selectLocation(id);
}

function addPlayerMarker(svg: SVGSVGElement, location: HoennLocation): void {
  const marker = document.createElementNS(SVG_NAMESPACE, 'g');
  marker.setAttribute('class', 'hoenn-player-marker');
  marker.setAttribute('transform', `translate(${location.x} ${location.y})`);
  marker.setAttribute('aria-label', `Sua posição: ${location.name}`);
  const ring = document.createElementNS(SVG_NAMESPACE, 'circle');
  ring.setAttribute('r', '13');
  marker.appendChild(ring);
  svg.appendChild(marker);
}

function createMapDetails(location: HoennLocation | undefined): HTMLElement {
  const details = document.createElement('section');
  details.className = 'hoenn-map-details';
  details.setAttribute('aria-live', 'polite');
  updateMapDetails(details, location);
  return details;
}

function updateMapSelection(
  svg: SVGSVGElement,
  label: HTMLElement,
  details: HTMLElement,
  location: HoennLocation,
): void {
  svg.querySelectorAll<SVGGElement>('.hoenn-map-location').forEach((marker) => {
    const selected = marker.dataset.locationId === location.id;
    marker.classList.toggle('selected', selected);
    marker.setAttribute('aria-pressed', String(selected));
  });
  label.textContent = location.name;
  updateMapDetails(details, location);
}

function updateMapDetails(details: HTMLElement, location: HoennLocation | undefined): void {
  const name = document.createElement('strong');
  name.textContent = location?.name ?? 'Posição atual';
  const description = document.createElement('span');
  description.textContent = location?.description ?? 'Esta zona ainda não está associada a um ponto do mapa de Hoenn.';
  details.replaceChildren(name, description);
}
