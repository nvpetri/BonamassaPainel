# Bonamassa Painel

Painel web da pizzaria, com **recebimento de pedidos, cozinha (KDS) e expedição**. Interface em português, com a identidade preta, vermelha e dourada dos aplicativos Bonamassa.

**Versão 0.1.0-demo:** funcional com dados locais de demonstração. Ainda não há API central, autenticação ou conexão com os aplicativos Android. Nenhum pedido, pagamento ou mensagem real é enviado.

![Painel de pedidos](docs/pedidos.png)

## Abrir no computador

Instale o **Node.js 24**, incluindo o npm. Este projeto abre no navegador; use VS Code ou outro editor para trabalhar no código.

Na primeira vez:

```bash
git clone https://github.com/nvpetri/BonamassaPainel.git
cd BonamassaPainel
npm ci
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Não precisa configurar banco, chave de API ou arquivo `.env` nesta demonstração.

Se você já clonou o repositório, entre na pasta do painel e atualize:

```bash
git pull --ff-only origin main
npm ci
npm run dev
```

No Windows, se o PowerShell bloquear `npm.ps1`, execute pelo **Prompt de Comando**, ou use `npm.cmd ci` e `npm.cmd run dev`. Não é necessário alterar a política de execução do computador.

Para usar a compilação otimizada:

```bash
npm run build
npm start
```

O terminal precisa continuar aberto enquanto o servidor estiver sendo usado. Encerre com `Ctrl+C`. Para outra porta: `npm run dev -- --port 3001`.

## Telas disponíveis

| Caminho          | O que funciona                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/pedidos`       | Colunas/lista, busca, filtros, novo pedido, aceite, andamento, detalhes e pausa de novos pedidos                  |
| `/cozinha`       | A preparar, em preparo e prontos; observações, tempo de espera e tela cheia                                       |
| `/entregas`      | Disponibilidade, atribuição e troca de motoboy antes da coleta; simulação de retirada, saída, entrega e devolução |
| `/cardapio`      | Busca, disponibilidade, edição de nomes, descrição e preços por tamanho                                           |
| `/historico`     | Concluídos, cancelados e devolvidos; busca, eventos e exportação CSV                                              |
| `/configuracoes` | Meta de tempo, taxa padrão, exportação JSON e reinício confirmado da demo                                         |

Os pedidos aceitam até dois sabores, três tamanhos, bordas, bebidas, quantidade e observações. O maior preço entre os sabores determina a pizza; a borda é somada uma vez por unidade. Valores são calculados em centavos. Essa regra, os sabores e todos os preços precisam ser aprovados pela pizzaria.

Pagamentos são **registros simulados**: antecipado, dinheiro com troco ou cartão na maquininha. A conclusão exige recebedor e, no dinheiro/cartão, confirmação do recebimento. A taxa de entrega exibida é cobrada do cliente; não representa automaticamente a remuneração do motoboy.

## Roteiro para mostrar ao dono

1. Abra `/pedidos` e clique em **Novo pedido**. Monte uma grande de meia Calabresa/meia Frango, borda de requeijão e um refrigerante. Com taxa de R$ 7,00, o exemplo soma **R$ 94,00**. Selecione dinheiro e troco para R$ 100,00: o troco será **R$ 6,00**.
2. Aceite o pedido. Em outra aba do **mesmo navegador e endereço**, abra `/cozinha`.
3. Inicie o preparo e marque como pronto. As duas abas recebem a atualização.
4. Em `/entregas`, abra o pedido e atribua um entregador disponível. Simule retirada e saída.
5. Simule a conclusão, informe quem recebeu e confirme o pagamento. Consulte o resultado em `/historico`.
6. Para um pedido de retirada, a conclusão acontece no balcão e não exige entregador.

Também é possível simular uma chegada com um clique, registrar tentativa sem sucesso e retorno à pizzaria, imprimir uma comanda pelo navegador ou abrir o endereço de exemplo no Google Maps. O som de novos pedidos é ativado pelo botão do alto da tela e funciona enquanto a aba permite áudio.

![Tela da cozinha](docs/cozinha.png)

## Como os dados funcionam

- IndexedDB guarda o estado entre recarregamentos. Operações são gravadas em transações, com validação dos dados e versões dos pedidos.
- BroadcastChannel avisa as outras abas do mesmo navegador/origem. Ao voltar à aba, o painel também consulta o estado salvo.
- `localhost:3000`, `127.0.0.1:3000`, outra porta, outro navegador ou outro dispositivo **têm dados separados**. Abrir a cozinha em um tablet não a conecta ao computador nesta versão.
- O snapshot tem schema e identificador da demonstração. Dados inválidos geram uma tela de recuperação; não são apagados automaticamente.
- Há um limite de 500 pedidos na demo. O CSV exporta os pedidos do histórico conforme os filtros. O JSON exporta a cópia completa para consulta; importação ainda não implementada.
- A hora exibida usa `America/Sao_Paulo`; os tempos são calculados a partir do relógio do dispositivo. Os dados fictícios iniciais são ancorados na primeira abertura, sem reinício diário automático.
- Não há Service Worker nem instalação PWA: após carregar, as ações locais não dependem de internet, mas recarregar ainda depende do servidor do painel.

## Desenvolvimento e verificação

Stack: Next.js 16.3.5, React 19.3, TypeScript, CSS próprio, Zod e IndexedDB. Fontes e logo são servidos pelo projeto; não há dependência de imagens remotas. As versões exatas estão no `package-lock.json`.

| Pasta            | Responsabilidade                                                          |
| ---------------- | ------------------------------------------------------------------------- |
| `src/app`        | Rotas, layout e estilos responsivos                                       |
| `src/components` | Telas, formulários, detalhes e contexto do painel                         |
| `src/domain`     | Regras, cálculo dos itens, schema, fixtures e testes de domínio           |
| `src/data`       | Interface de repositório e persistência da demonstração                   |
| `tests`          | Fluxos reais de navegador com Playwright e verificações de acessibilidade |
| `docs`           | Integração proposta, roteiro de validação e capturas das telas            |

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

No Linux, o instalador pode precisar de `npx playwright install --with-deps chromium`. O Playwright inicia e encerra o servidor de testes. Há workflow de CI para repetir a validação em pushes e pull requests.

[Resultados e limites da verificação](docs/VERIFICACAO.md) · [Contrato proposto para a API central](docs/INTEGRACAO.md)

## Próxima etapa

Construir a API central, autenticação/perfis e banco PostgreSQL; então substituir `demoRepository` por chamadas autenticadas e conectar o painel aos Android. A interface `PanelRepository` separa o acesso aos dados, mas não constitui uma API de produção.

Os projetos seguem independentes:

- [App do cliente](https://github.com/nvpetri/BonamassaAndroid)
- [App do entregador](https://github.com/nvpetri/BonamassaEntregador)
- [Este painel](https://github.com/nvpetri/BonamassaPainel)

PIX, WhatsApp, rastreamento GPS, permissões reais, emissão fiscal e implantação operacional são etapas posteriores. O logo foi reutilizado do app Bonamassa Entregas fornecido neste projeto; os direitos da marca permanecem com seus titulares.
