from collections import Counter

from scripts.map_matrix import owns_tile


def inside_region(zone_map: dict, pos: dict) -> bool:
    if not (0 <= pos['x'] < zone_map['width'] and 0 <= pos['z'] < zone_map['height']):
        return False
    origin = zone_map['source']['originTile']
    return owns_tile(zone_map['source']['matrix'], zone_map['zone'], pos['x'] + origin['x'], pos['z'] + origin['z'])


def spatial_audit(maps: list[dict]) -> dict:
    indexed = {zone_map['id']: zone_map for zone_map in maps}
    report = {'warpsOutsideRegion': [], 'targetsOutsideRegion': [], 'npcsOutsideRegion': [], 'centeredWorldWarps': 0}
    for zone_map in maps:
        audit_warps(zone_map, indexed, report)
        report['npcsOutsideRegion'].extend({'zone': zone_map['zone'], 'id': npc['id'], 'pos': npc['pos']}
                                          for npc in zone_map['npcs'] if not inside_region(zone_map, npc['pos']))
    return report


def audit_warps(zone_map: dict, indexed: dict, report: dict) -> None:
    for warp in zone_map['warps']:
        report['centeredWorldWarps'] += warp['rom']['x'] % 18 == 9 and warp['rom']['y'] % 18 == 9
        issue = {'zone': zone_map['zone'], 'index': warp['index'], 'pos': warp['from']}
        if not inside_region(zone_map, warp['from']):
            report['warpsOutsideRegion'].append(issue)
        if not inside_region(indexed[warp['targetMapId']], warp['targetPos']):
            report['targetsOutsideRegion'].append({**issue, 'targetMapId': warp['targetMapId'], 'targetPos': warp['targetPos']})


def validation_report(maps: list[dict], matrices: dict, references: list[dict]) -> dict:
    used = {zone_map['source']['matrixId'] for zone_map in maps}
    return {'summary': {'zones': len(maps), 'matrices': len(matrices), 'usedMatrices': len(used),
                        'matrixVersions': dict(Counter(matrix['version'] for matrix in matrices.values())),
                        'matrixRegions': sum(len(matrix['regions']) for matrix in matrices.values()),
                        'tiles': sum(zone_map['width'] * zone_map['height'] for zone_map in maps),
                        'warps': sum(len(zone_map['warps']) for zone_map in maps),
                        'npcs': sum(len(zone_map['npcs']) for zone_map in maps),
                        'encounters': sum(len(zone_map['encounters']) for zone_map in maps)},
            'unusedMatrices': sorted(set(matrices) - used), 'references': references, 'spatial': spatial_audit(maps)}
