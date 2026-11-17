"""Fatos do conjunto Pawn/AMX v10, conforme referências em script-disassembly.md."""

NAMES = '''none load.pri load.alt load.s.pri load.s.alt lref.pri lref.alt lref.s.pri
lref.s.alt load.i lodb.i const.pri const.alt addr.pri addr.alt stor.pri
stor.alt stor.s.pri stor.s.alt sref.pri sref.alt sref.s.pri sref.s.alt stor.i
strb.i lidx lidx.b idxaddr idxaddr.b align.pri align.alt lctrl
sctrl move.pri move.alt xchg push.pri push.alt pick push.c
push push.s pop.pri pop.alt stack heap proc ret
retn call call.pri jump jrel jzer jnz jeq
jneq jless jleq jgrtr jgeq jsless jsleq jsgrtr
jsgeq shl shr sshr shl.c.pri shl.c.alt shr.c.pri shr.c.alt
smul sdiv sdiv.alt umul udiv udiv.alt add sub
sub.alt and or xor not neg invert add.c
smul.c zero.pri zero.alt zero zero.s sign.pri sign.alt eq
neq less leq grtr geq sless sleq sgrtr
sgeq eq.c.pri eq.c.alt inc.pri inc.alt inc inc.s inc.i
dec.pri dec.alt dec dec.s dec.i movs cmps fill
halt bounds sysreq.pri sysreq.c file line symbol srange
jump.pri switch casetbl swap.pri swap.alt push.adr nop sysreq.n
symtag break push2.c push2 push2.s push2.adr push3.c push3
push3.s push3.adr push4.c push4 push4.s push4.adr push5.c push5
push5.s push5.adr load.both load.s.both const const.s icall iretn
iswitch icasetbl load.p.pri load.p.alt load.p.s.pri load.p.s.alt lref.p.pri lref.p.alt
lref.p.s.pri lref.p.s.alt lodb.p.i const.p.pri const.p.alt addr.p.pri addr.p.alt stor.p.pri
stor.p.alt stor.p.s.pri stor.p.s.alt sref.p.pri sref.p.alt sref.p.s.pri sref.p.s.alt strb.p.i
lidx.p.b idxaddr.p.b align.p.pri align.p.alt push.p.c push.p push.p.s stack.p
heap.p shl.p.c.pri shl.p.c.alt shr.p.c.pri shr.p.c.alt add.p.c smul.p.c zero.p
zero.p.s eq.p.c.pri eq.p.c.alt inc.p inc.p.s dec.p dec.p.s movs.p
cmps.p fill.p halt.p bounds.p push.p.adr sysreq.d sysreq.nd'''.split()

ONE_OPERAND = set(range(1, 9)) | {
    10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28, 29, 30,
    31, 32, 38, 39, 40, 41, 44, 45, 49, 51, 52, 53, 54, 55, 56, 57, 58, 59,
    60, 61, 62, 63, 64, 68, 69, 70, 71, 87, 88, 91, 92, 105, 106, 109, 110,
    114, 115, 117, 118, 119, 120, 121, 123, 129, 133, 136, 158, 160, 213,
}
OPERAND_COUNTS = {opcode: 1 for opcode in ONE_OPERAND}
OPERAND_COUNTS.update({opcode: 2 for opcode in (125, 127, 135, 138, 139, 140, 141,
                                               154, 155, 156, 157, 214)})
OPERAND_COUNTS.update({opcode: 3 for opcode in (124, 142, 143, 144, 145)})
OPERAND_COUNTS.update({opcode: 4 for opcode in (126, 146, 147, 148, 149)})
OPERAND_COUNTS.update({opcode: 5 for opcode in (150, 151, 152, 153)})
RELATIVE_BRANCHES = {49, *range(51, 65), 129}
UNSUPPORTED = {0, 124, 125, 126, 127, 128, 136, 158, 159, 160, 161, 213, 214}


def signed(value: int, bits: int = 32) -> int:
    return value - (1 << bits) if value & (1 << (bits - 1)) else value
