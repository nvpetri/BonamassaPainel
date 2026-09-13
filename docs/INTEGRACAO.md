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
