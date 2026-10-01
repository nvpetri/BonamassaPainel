# Histórico do painel

## 0.5.1 - 2026-10-01

Atualiza Next.js e eslint-config-next para 16.3.8, corrigindo o bloqueio do audit de produção ([aviso do mantenedor](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)). Ajusta o teste de validação das faixas para consultar o alerta dentro do diálogo.

## 0.5.0 - 2026-10-01

O gerente configura endereço físico e cinco faixas de km/valor em Configurações → Editar operação. Frete por trajeto é calculado pela API, revisado no pedido manual e preservado nos pedidos confirmados. Testes integrados usam API 0.13.1 com PostgreSQL e provedor de mapas descartável.
