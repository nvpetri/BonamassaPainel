# Integração proposta do painel

Este documento é um contrato de trabalho para a próxima etapa. **Os endpoints abaixo ainda não existem.** O painel atual usa somente `demoRepository`; os apps Android não leem seu IndexedDB.

## Separação dos projetos

O painel permanece no repositório BonamassaPainel. A API NestJS e o banco PostgreSQL devem ficar no projeto próprio da API. Os apps cliente e entregador continuam nos respectivos repositórios.

O servidor será responsável por estabelecimento, sessão, perfil, preços, disponibilidade, numeração e estado canônico dos pedidos. Valores, pagamento antecipado, autorização e total enviados pelo frontend não constituem prova de cobrança ou permissão.

## Operações sugeridas

| Método / rota                             | Uso                                            | Perfil mínimo sugerido                                       |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `POST /sessions`                          | Autenticar funcionário                         | Público com limitação de tentativas                          |
| `DELETE /sessions/current`                | Encerrar sessão                                | Autenticado                                                  |
| `GET /staff/orders?status=...&cursor=...` | Listar pedidos paginados                       | Atendimento, cozinha ou gestor; DTO filtrado por perfil      |
| `GET /staff/orders/{id}`                  | Detalhar pedido autorizado                     | Atendimento/gestor; cozinha recebe somente dados de produção |
| `POST /staff/orders`                      | Registrar pedido manual                        | Atendimento/gestor                                           |
| `POST /staff/orders/{id}/accept`          | Aceitar                                        | Atendimento/gestor                                           |
| `POST /staff/orders/{id}/prepare`         | Iniciar preparo                                | Cozinha/gestor                                               |
| `POST /staff/orders/{id}/ready`           | Marcar pronto                                  | Cozinha/gestor                                               |
| `POST /staff/orders/{id}/cancel`          | Cancelar com motivo                            | Gestor ou permissão explícita                                |
| `POST /staff/orders/{id}/assign`          | Atribuir/reassociar entregador antes da coleta | Expedição/gestor                                             |
| `POST /staff/orders/{id}/pickup-complete` | Confirmar retirada no balcão                   | Atendimento/gestor                                           |
| `GET /staff/drivers`                      | Listar disponibilidade e cargas                | Expedição/gestor                                             |
| `PATCH /staff/drivers/{id}/availability`  | Administrar novas coletas                      | Gestor                                                       |
| `GET /catalog`                            | Cardápio e regras publicáveis                  | Conforme contexto do app                                     |
| `PATCH /staff/products/{id}`              | Editar preço/disponibilidade                   | Gestor                                                       |
| `GET /staff/promotions`                   | Listar promoções, vigência e consumo           | Atendimento/gestor                                           |
| `POST /staff/promotions`                  | Criar desconto e limites                       | Gestor                                                       |
| `PATCH /staff/promotions/{id}`            | Editar ou pausar com versão esperada           | Gestor                                                       |
| `POST /orders/quote`                      | Cotar itens e promoção no servidor             | Cliente/atendimento conforme estabelecimento                 |
| `PATCH /staff/store`                      | Abrir/pausar loja e preferências               | Gestor                                                       |

Retirada pelo entregador, início da rota, entrega e tentativa/devolução passam pelos comandos autenticados do app de entregas (`/driver/deliveries/{id}/collect`, `/start`, `/complete`, `/issue`, `/return`) propostos no repositório do entregador. Os botões “Simular” deste painel não devem virar comandos irrestritos em produção.

## Pedido e entrega são estados diferentes

| Pedido do painel   | Entrega                               | Significado                                          |
| ------------------ | ------------------------------------- | ---------------------------------------------------- |
| `NEW`              | Nenhuma                               | Aguardando aceite da pizzaria                        |
| `CONFIRMED`        | Nenhuma                               | Fila da cozinha                                      |
| `PREPARING`        | Nenhuma                               | Em produção                                          |
| `READY`            | Nenhuma                               | Pronto; ainda sem motoboy ou retirada no balcão      |
| `READY`            | `ASSIGNED`                            | Motoboy atribuído, ainda sem coleta                  |
| `READY`            | `COLLECTED`                           | Coletado; aguardando início da rota                  |
| `OUT_FOR_DELIVERY` | `ON_ROUTE`                            | Saiu para o cliente                                  |
| `RETURNING`        | `RETURNING`                           | Tentativa sem sucesso; carga ainda com o motoboy     |
| `DELIVERED`        | `DELIVERED`, ou nenhuma para retirada | Recebimento concluído                                |
| `RETURNED`         | `RETURNED`                            | Devolvido à pizzaria; não conta como venda concluída |
| `CANCELLED`        | Sem atribuição ativa                  | Cancelado antes da coleta                            |

O app cliente precisa de uma projeção própria desses estados. Antes da integração, alinhar seus enums existentes e a comunicação para cancelamento, retorno, estorno e reentrega. Não converter `RETURNED` silenciosamente em `DELIVERED` nem confundir `CONFIRMED` com confirmação de pagamento.

## Exemplo de comando de preparo

```http
POST /staff/orders/{id}/prepare
Content-Type: application/json
Idempotency-Key: <identificador único da tentativa lógica>

{"expectedVersion":3}
```

O servidor deve, em uma transação, validar a sessão e o estabelecimento, conferir perfil e versão, aplicar a transição, gravar o evento e retornar o pedido atualizado. Repetir a mesma chave não deve duplicar a ação. Versão desatualizada deve retornar conflito (`409`) com indicação do estado atual para reconciliação.

Itens de criação carregam referências de produto/sabor, tamanho, borda e quantidade. O servidor consulta o catálogo e calcula totais em centavos; os itens do pedido preservam o preço e a descrição contratados. Mudanças no catálogo não reprecificam pedidos já aceitos.

## Promoções e reservas no servidor

A demo usa schema 2 e migra o schema 1 sem recalcular os pedidos antigos. `src/domain/promotions.ts` define desconto percentual/valor fixo, vigência, cota e snapshot do desconto; `quoteOrder` calcula o desconto por pizza, excluindo borda, bebidas e entrega. A proposta atual é selecionar uma única promoção por pedido, válida para todos os sabores/tamanhos. Confirmar essa política com a pizzaria antes da integração.

Cada pedido guarda `discount` em centavos e um snapshot `promotion`: identidade, versão, nome, regra, horário de aplicação, quantidade e alocação por item. A versão local deriva o consumo dos pedidos: concluídos são vendidos; em andamento são reservados; cancelados/devolvidos não ocupam cota. Uma tentativa em retorno continua reservada até a devolução ser confirmada. Mudanças da campanha nunca recalculam snapshots históricos.

Na API, consultar preços, conferir vigência com relógio do servidor, reservar a cota e criar o pedido na **mesma transação PostgreSQL**. Usar bloqueio/atualização condicional para impedir que pedidos do painel e dos Android consumam simultaneamente a última unidade. No cancelamento/devolução, liberar a reserva exatamente uma vez; na conclusão, convertê-la em venda sem liberar capacidade. Usar chaves de idempotência e restrições de integridade. Uma cotação não reserva estoque promocional por si só.

O cliente envia referências de itens e promoção, nunca um desconto confiável. O servidor recalcula valores e compara com uma cotação versionada, devolvendo conflito se o valor ou a distribuição da cota tiver mudado, para revisão explícita. A `signature` local não é assinatura criptográfica, autenticação ou garantia de preço. Não transportá-la como prova de cobrança. Se houver carrinhos reservados ou pagamentos pendentes, definir duração e expiração da reserva no servidor; isso ainda não existe na demo.

Publicar `promotion.updated` e `promotion.usage.changed` após confirmar as transações, restritos por estabelecimento. Somar também pedidos arquivados no consumo vitalício da campanha. Registrar histórico de edições e quem concedeu/alterou a oferta; somente gestores devem administrar promoções.

## Eventos e reconexão

Publicar eventos autenticados como `order.created`, `order.updated`, `delivery.updated`, `driver.availability.changed` e `catalog.updated`, restritos por loja e perfil. WebSocket pode avisar a mudança; a consulta REST e o histórico versionado devem permitir recuperar estado após reconexão ou eventos perdidos. Não compartilhar endereços/pagamentos em um canal de cozinha.

`BroadcastChannel` atual só notifica abas da mesma origem. IndexedDB serializa as operações locais e `version` evita comandos de pedido baseados em uma versão antiga. Isso não implementa idempotência, fila offline nem sincronização distribuída de produção. O campo `demoId` identifica um reinício local, não um tenant ou autorização.

Ao trocar a persistência, manter `PanelRepository` como fronteira e usar DTOs validados. Implementar estados explícitos de envio, erro, conflito e confirmação do servidor. Não armazenar senhas ou tokens de longa duração no snapshot da demo.

## Decisões a fechar com a pizzaria

- Cardápio real, tamanhos, número de sabores e regra de meia pizza; bordas e adicionais além dos exemplos.
- Aceite manual/automático, prazo/meta e critérios de prioridade da cozinha.
- Taxa por bairro/distância, comissão do motoboy e limites de carga.
- Política de cancelamento depois da coleta, ausência do cliente e reentrega.
- Pagamentos, comprovantes, troco, estornos e conciliação com a maquininha/gateway.
- Perfis de acesso, dispositivos, impressão térmica e conexão da loja.

Referências de implementação: [OpenAPI no NestJS](https://docs.nestjs.com/openapi/introduction), [autorização no NestJS](https://docs.nestjs.com/security/authorization), [Next.js App Router](https://nextjs.org/docs/app).
