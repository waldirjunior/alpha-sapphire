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
        return [struct.unpack_from('<III', self.blob, offset + i * stride) for i in range(count)]

    def segment_address(self, segment, offset):
        if segment >= len(self.segments) or offset > self.segments[segment][1]:
            raise ValueError(f'Endereço CRO fora do segmento: {segment}/{offset:#x}')
        return self.segments[segment][0] + offset

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
    args = parser.parse_args()
    blob = args.cro.read_bytes()
    image = CroImage(blob)
    print(f'SHA256 {hashlib.sha256(blob).hexdigest()}')
    from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
    disassembler = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    for name in args.names:
        table, wrapper = image.native(name)
        print(f'{name}: tabela={table:#x}, wrapper={wrapper:#x}')
        for row in disassembler.disasm(image.relocated()[wrapper:wrapper + args.bytes], wrapper):
            print(f'{row.address:08x} {row.mnemonic:10} {row.op_str}')


if __name__ == '__main__':
    main()
