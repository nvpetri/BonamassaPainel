# Complemento recebido do aplicativo

O detalhe do pedido agora mostra `address.complement` e a indicação `address.noComplement`, enviados pelo Cliente 0.6.0. O ponto de referência permanece separado. Endereços antigos, sem os novos campos, continuam aparecendo normalmente.

A atualização evita que o complemento digitado pelo cliente seja descartado pela validação dos dados recebidos da API. O agrupamento e a saída conjunta são feitos no aplicativo do entregador; o painel recebe as mudanças de status de cada pedido normalmente.

Atualize a [API #5](https://github.com/nvpetri/APIBonamassa/pull/5) antes de distribuir os novos APKs. Leia o [guia dos fluxos](https://github.com/nvpetri/APIBonamassa/blob/codex/cep-sacola-rotas/docs/CEP-SACOLA-ROTAS.md).

Esta branch também incorpora a preparação de produção já revisada na #7, que havia sido mesclada na branch de horários depois de ela entrar em `main`. Confira as variáveis do [guia de produção](PRODUCAO.md), especialmente a origem HTTPS e o segredo da sessão, antes de aplicar em um serviço com auto-deploy. Nenhuma configuração de nuvem foi alterada nesta tarefa.
