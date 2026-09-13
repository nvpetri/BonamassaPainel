import type { PricedItem } from "@/domain/catalog";

export function ItemComponents({
  components,
  multiplier = 1,
}: {
  components: NonNullable<PricedItem["components"]>;
  multiplier?: number;
}) {
  return (
    <ul className="combo-components" aria-label="Itens do combo">
      {components.map((part, index) => (
        <li key={index}>
          <strong>
            {part.quantity * multiplier}× {part.name}
          </strong>
          <span>{part.detail}</span>
          {part.note && <em>{part.note}</em>}
        </li>
      ))}
    </ul>
  );
}
