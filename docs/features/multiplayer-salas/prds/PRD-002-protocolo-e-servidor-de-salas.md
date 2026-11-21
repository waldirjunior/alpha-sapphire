# PRD-002 — Protocolo e servidor de salas multiplayer

- **Módulo:** [multiplayer-salas](../README.md)
- **Estado:** Implementado
- **Data:** 2026-11-21
- **ADRs relacionados:** [ADR-001](../adrs/ADR-001-estado-autoritativo-em-core.md)

## 1. Objetivo

Transportar o estado autoritativo de `src/core/room.ts` para clientes WebSocket, sem duplicar colisão, movimento ou warps no servidor. O protocolo e o registro de salas permanecem em `src/core/roomProtocol.ts`, sem dependência de Node, browser ou Three.js.

## 2. Protocolo

Cada conexão recebe um ID de jogador gerado pelo servidor. O cliente envia mensagens JSON estritas:

| Cliente → servidor | Campos | Efeito |
| --- | --- | --- |
| `join` | `roomId`, `displayName`, `mapId?` | Entra na sala; `mapId` define o mapa quando a sala é criada. |
| `move` | `direction` (`up`, `down`, `left`, `right`) | Move o jogador pela mesma função `movePlayer` usada pelo modo solo. |
| `leave` | nenhum | Sai da sala atual. |
| `ping` | `nonce?` | Solicita resposta `pong` com o mesmo nonce. |

Respostas do servidor são `joined`, `snapshot`, `player_joined`, `player_moved`, `player_left`, `error` e `pong`. `joined` e `snapshot` vão diretamente para o jogador que entrou; eventos de entrada/saída vão aos demais membros, e cada movimento vai para todos os membros da sala, incluindo quem moveu. `error` inclui `code` e `message`; JSON inválido, campos extras, direções inválidas e mensagens fora de estado são rejeitados.

O servidor aceita WebSocket RFC 6455 em `/`, além de `GET /health` e `GET /rooms` para status e listagem de salas. Não há autenticação ou persistência de sala nesta fase.

## 3. Execução

```sh
npm run server:multiplayer
```

O comando carrega as 536 zonas de `src/data/maps_v2/` e inicia `src/server/multiplayerServer.ts` na porta `3001` (ou `PORT`). O servidor usa `node:http` e implementa o framing WebSocket diretamente, sem dependência npm de transporte. Para testes e hosts próprios, `createMultiplayerServer({ maps })` aceita um registro de mapas, `listen(0)` escolhe uma porta livre e `close()` encerra o serviço.

## 4. Critérios de aceite

- [x] Parser valida todas as mensagens do cliente em runtime e rejeita propriedades desconhecidas.
- [x] Registro imutável mantém várias salas isoladas e limpa salas vazias após saída ou desconexão.
- [x] Movimento autoritativo usa `movePlayer` e publica o estado atualizado aos membros.
- [x] Testes de integração abrem duas conexões WebSocket, movimentam ambos os jogadores, rejeitam entrada inválida e verificam desconexão e encerramento.
- [x] `src/core/` continua sem imports Node/browser/Three.js e os módulos ficam abaixo de 500 linhas.
