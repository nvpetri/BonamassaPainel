"use client";

import { brl } from "@/domain/model";
import {
  comboPriceComparison,
  moneySchema,
  type BasicItemDraft,
  type Product,
} from "@/domain/catalog";
import { Button, Field, MoneyInput, moneyText, parseMoney } from "./ui";

const percentage = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(value);

export function ComboPriceEditor({
  products,
  items,
  value,
  onChange,
  disabled,
}: {
  products: Product[];
  items: BasicItemDraft[];
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}) {
  const comparison = comboPriceComparison(products, items, parseMoney(value));
  const { individualTotal, difference, discountRate } = comparison;
  return (
    <section className="combo-pricing" aria-label="Preço e desconto do combo">
      <h3>Defina o preço do conjunto</h3>
      <div className="combo-reference">
        <span>Itens vendidos separadamente</span>
        <strong>{brl(individualTotal)}</strong>
      </div>
      <Field
        label="Preço do combo"
        hint="Informe o valor final que será cobrado pelo conjunto completo."
      >
        <MoneyInput
          required
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      </Field>
      <div
        className={`combo-savings ${difference !== null && difference > 0 ? "discounted" : ""}`}
        aria-live="polite"
      >
        {difference === null ? (
          <span>
            {items.length
              ? "Informe um preço válido para calcular o desconto."
              : "Adicione os itens para comparar os valores."}
          </span>
        ) : difference >= 0 ? (
          <>
            <span>Desconto do combo</span>
            <strong>
              {brl(difference)} <small>({percentage(discountRate)})</small>
            </strong>
          </>
        ) : (
          <>
            <span>Acima dos preços individuais</span>
            <strong>{brl(-difference)}</strong>
          </>
        )}
      </div>
      <Button
        className="full"
        disabled={
          disabled || !moneySchema.positive().safeParse(individualTotal).success
        }
        onClick={() => onChange(moneyText(individualTotal))}
      >
        Usar preço dos itens separados
      </Button>
      <p className="field-hint">
        A comparação considera tamanho, borda e quantidade. No meio a meio, vale
        o sabor mais caro. Alterar os itens atualiza a comparação; o preço final
        só muda quando você o editar.
      </p>
    </section>
  );
}

export function ComboPriceSummary({
  comparison,
}: {
  comparison: ReturnType<typeof comboPriceComparison>;
}) {
  if (comparison.difference === null || comparison.difference <= 0) return null;
  return (
    <div className="combo-price-summary">
      <span>Itens separados: {brl(comparison.individualTotal)}</span>
      <strong>
        Economia de {brl(comparison.difference)} (
        {percentage(comparison.discountRate)})
      </strong>
    </div>
  );
}
