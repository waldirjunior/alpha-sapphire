import argparse
import hashlib
import struct
from pathlib import Path


class CroImage:
    def __init__(self, blob):
        if blob[0x80:0x84] != b'CRO0':
            raise ValueError('Esperado CRO0 em 0x80')
        self.blob = blob
        self.segments = self.table(0xC8, 12)
        self.relocations = self.table(0x128, 12)
        self.external_relocations = self.table(0xF8, 12)
        self.references = {}
        for patch, info, offset in self.relocations:
            if info & 255 == 2:
                destination = self.segment_address(patch & 15, patch >> 4)
                target = self.segment_address(info >> 8, offset)
                self.references[destination] = target

    def table(self, header, stride):
        offset, count = struct.unpack_from('<II', self.blob, header)
        if offset + count * stride > len(self.blob):
            raise ValueError(f'Tabela CRO fora do arquivo: {offset:#x}/{count}')
        return [struct.unpack_from('<' + 'I' * (stride // 4), self.blob, offset + i * stride) for i in range(count)]

    def segment_address(self, segment, offset):
        if segment >= len(self.segments) or offset > self.segments[segment][1]:
            raise ValueError(f'Endereço CRO fora do segmento: {segment}/{offset:#x}')
        return self.segments[segment][0] + offset

    def anonymous_imports(self):
        offset, count = struct.unpack_from('<II', self.blob, 0xF0)
        for index in range(count):
            name, _, _, table, entries = struct.unpack_from('<IIIII', self.blob, offset + index * 20)
            module = self.blob[name:self.blob.index(0, name)].decode('ascii')
            for entry in range(entries):
                symbol, head = struct.unpack_from('<II', self.blob, table + entry * 8)
                yield module, symbol, head

    def import_patch_addresses(self, head):
        for offset in range(head, len(self.blob) - 11, 12):
            patch, info, _ = struct.unpack_from('<III', self.blob, offset)
            yield self.segment_address(patch & 15, patch >> 4)
            if info & 0xFF00:
                return
        raise ValueError(f'Lista de patches CRO sem terminador: {head:#x}')

    def anonymous_import_at(self, address):
        for module, symbol, head in self.anonymous_imports():
            if address in self.import_patch_addresses(head):
                return module, symbol & 15, symbol >> 4
        raise ValueError(f'Import anônimo CRO não encontrado: {address:#x}')

    def native(self, name):
        needle = name.encode('ascii') + b'\0'
        matches = [(patch, self.references[patch + 4]) for patch, target in self.references.items()
                   if self.blob[target:target + len(needle)] == needle and patch + 4 in self.references]
        if len(matches) != 1:
            raise ValueError(f'Nativa {name}: esperada referência única, obtidas {len(matches)}')
        return matches[0]

    def message_files(self):
        _, wrapper = self.native('MsgLoad')
        branch = next((pos for pos in range(wrapper, min(wrapper + 0x400, len(self.blob) - 4), 4)
                       if struct.unpack_from('<I', self.blob, pos)[0] == 0x379FF107), None)
        if branch is None:
            raise ValueError('MsgLoad sem jump table ARM reconhecida')
        count = next((struct.unpack_from('<I', self.blob, pos)[0] & 255
                      for pos in range(branch - 4, max(wrapper - 1, branch - 36), -4)
                      if struct.unpack_from('<I', self.blob, pos)[0] & 0xFFFFFF00 == 0xE3570000), None)
        if count is None:
            raise ValueError('MsgLoad sem limite CMP r7 imediato')
        return [self.message_file(self.references[branch + 8 + i * 4]) for i in range(count)]

    def message_file(self, target):
        word = struct.unpack_from('<I', self.blob, target)[0]
        if word & 0xFFFFF000 == 0xE3A07000:
            rotation = ((word >> 8) & 15) * 2
            value = word & 255
            return ((value >> rotation) | (value << ((32 - rotation) % 32))) & 0xFFFFFFFF
        if word & 0xFFFFF000 == 0xE59F7000:
            return struct.unpack_from('<I', self.blob, target + 8 + (word & 4095))[0]
        return None

    def static_imports(self, crs):
        targets = {}
        for name, _, _, anonymous, count in self.table(0xF0, 20):
            if self.blob[name:name + 9] != b'|static|\0':
                continue
            if anonymous + count * 8 > len(self.blob):
                raise ValueError('Tabela de imports anônimos fora do CRO')
            for index in range(count):
                target, batch = struct.unpack_from('<II', self.blob, anonymous + index * 8)
                targets.update(self.static_import_batch(crs, target, batch))
        return targets

    def static_import_batch(self, crs, target, batch):
        relocations = self.external_relocations
        start = struct.unpack_from('<I', self.blob, 0xF8)[0]
        if batch < start or batch >= start + len(relocations) * 12 or (batch - start) % 12:
            raise ValueError(f'Import batch fora da tabela de relocations: {batch:#x}')
        targets = {}
        for patch, info, addend in relocations[(batch - start) // 12:]:
            if info & 255 == 2:
                address = self.segment_address(patch & 15, patch >> 4)
                targets[address] = (crs.segment_address(target & 15, target >> 4) + addend) & 0xFFFFFFFF
            if info & 0xFF00:
                return targets
        raise ValueError(f'Import batch sem terminador: {batch:#x}')

    def relocated(self):
        result = bytearray(self.blob)
        for patch, target in self.references.items():
            if patch + 4 <= len(result):
                struct.pack_into('<I', result, patch, target)
        return bytes(result)


def main():
    parser = argparse.ArgumentParser(description='Resolve wrappers AMX por relocations internas CRO, sem executar código')
    parser.add_argument('cro', type=Path)
    parser.add_argument('names', nargs='+')
    parser.add_argument('--bytes', type=lambda value: int(value, 0), default=96)
    parser.add_argument('--static-crs', type=Path)
    args = parser.parse_args()
    blob = args.cro.read_bytes()
    image = CroImage(blob)
    print(f'SHA256 {hashlib.sha256(blob).hexdigest()}')
    imports = {}
    if args.static_crs:
        static_blob = args.static_crs.read_bytes()
        print(f'CRS SHA256 {hashlib.sha256(static_blob).hexdigest()}')
        imports = image.static_imports(CroImage(static_blob))
    from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
    disassembler = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    for name in args.names:
        table, wrapper = image.native(name)
        print(f'{name}: tabela={table:#x}, wrapper={wrapper:#x}')
        for row in disassembler.disasm(image.relocated()[wrapper:wrapper + args.bytes], wrapper):
            target = imports.get(int(row.op_str[1:], 0) + 4) if row.mnemonic in ('b', 'bl') and row.op_str.startswith('#') else None
            suffix = f' -> static {target:#x}' if target is not None else ''
            print(f'{row.address:08x} {row.mnemonic:10} {row.op_str}{suffix}')


if __name__ == '__main__':
    main()
