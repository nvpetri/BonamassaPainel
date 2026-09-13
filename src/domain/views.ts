export const views = [
  "pedidos",
  "cozinha",
  "entregas",
  "cardapio",
  "promocoes",
  "historico",
  "configuracoes",
] as const;
export type View = (typeof views)[number];
export const viewInfo: Record<
  View,
  { title: string; subtitle: string; section: string }
> = {
  pedidos: {
    title: "Pedidos",
    subtitle: "Acompanhe cada pedido, do recebimento à entrega.",
    section: "Operação",
  },
  cozinha: {
    title: "Cozinha",
    subtitle: "O pedido certo, no ponto certo. Organize a produção.",
    section: "Operação",
  },
  entregas: {
    title: "Entregas",
    subtitle: "Da expedição até o cliente, tudo no seu lugar.",
    section: "Operação",
  },
  cardapio: {
    title: "Cardápio",
    subtitle: "Seus sabores, preços e disponibilidade em um só lugar.",
    section: "Gestão",
  },
  promocoes: {
    title: "Promoções",
    subtitle: "Descontos com prazo, quantidade e acompanhamento.",
    section: "Gestão",
  },
  historico: {
    title: "Histórico",
    subtitle: "Consulte os pedidos encerrados e seus acontecimentos.",
    section: "Gestão",
  },
  configuracoes: {
    title: "Configurações",
    subtitle: "Ajuste a operação para o ritmo da pizzaria.",
    section: "Gestão",
  },
};
