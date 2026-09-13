"use client";

import { useState } from "react";
import { Package, Pizza, Plus, Wine } from "lucide-react";
import { brl, type Product } from "@/domain/model";
import {
  pizzaGroupLabels,
  priceItems,
  productUnavailableReason,
  sizeLabels,
  type ItemDraft,
  type PizzaDraft,
  type BasicItemDraft,
} from "@/domain/catalog";
import { Button, Field } from "./ui";
import { ItemComponents } from "./order-components";

export function PizzaFields({
  products,
  value,
  onChange,
  halfRequired = false,
  chooseMode = false,
}: {
  products: Product[];
  value: Pick<PizzaDraft, "flavorIds" | "size" | "crust">;
  onChange(value: Pick<PizzaDraft, "flavorIds" | "size" | "crust">): void;
  halfRequired?: boolean;
  chooseMode?: boolean;
}) {
  const [first = "", second = ""] = value.flavorIds;
  const half = halfRequired || value.flavorIds.length === 2;
  const options = (exclude?: string) =>
    Object.entries(pizzaGroupLabels).map(([group, label]) => (
      <optgroup label={label} key={group}>
        {products
          .filter(
            (p) =>
              p.category === "PIZZA" &&
              (p.pizzaGroup ?? "TRADITIONAL") === group &&
              p.id !== exclude,
          )
          .map((p) => (
            <option key={p.id} value={p.id} disabled={!p.enabled}>
              {p.name}
              {!p.enabled ? " · indisponível" : ""}
            </option>
          ))}
      </optgroup>
    ));
  return (
    <>
      {chooseMode && (
        <div
          className="segmented pizza-mode"
          role="group"
          aria-label="Formato da pizza"
        >
          <button
            type="button"
            aria-pressed={!half}
            className={!half ? "selected" : ""}
            onClick={() => onChange({ ...value, flavorIds: [first] })}
          >
            Pizza inteira <small>1 sabor</small>
          </button>
          <button
            type="button"
            aria-pressed={half}
            className={half ? "selected" : ""}
            onClick={() => onChange({ ...value, flavorIds: [first, second] })}
          >
            Meio a meio <small>2 sabores</small>
          </button>
        </div>
      )}
      <div className="form-row">
        <Field label="Sabor principal">
          <select
            value={first}
            onChange={(e) =>
              onChange({
                ...value,
                flavorIds:
                  (chooseMode && half) || halfRequired
                    ? [e.target.value, second !== e.target.value ? second : ""]
                    : second && second !== e.target.value
                      ? [e.target.value, second]
                      : [e.target.value],
              })
            }
          >
            <option value="" disabled>
              Selecione
            </option>
            {options()}
          </select>
        </Field>
        {(!chooseMode || half) && (
          <Field label="Segundo sabor">
            <select
              value={second}
              onChange={(e) =>
                onChange({
                  ...value,
                  flavorIds:
                    e.target.value || chooseMode || halfRequired
                      ? [first, e.target.value]
                      : [first],
                })
              }
            >
              <option value="" disabled={halfRequired || chooseMode}>
                {halfRequired || chooseMode
                  ? "Escolha a outra metade"
                  : "Pizza inteira"}
              </option>
              {options(first)}
            </select>
          </Field>
        )}
      </div>
      <div className="form-row">
        <Field label="Tamanho">
          <select
            value={value.size}
            onChange={(e) =>
              onChange({ ...value, size: e.target.value as PizzaDraft["size"] })
            }
          >
            {Object.entries(sizeLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Borda">
          <select
            value={value.crust}
            onChange={(e) => onChange({ ...value, crust: e.target.value })}
          >
            <option value="NONE">Sem borda recheada</option>
            {products
              .filter((p) => p.category === "CRUST")
              .map((p) => (
                <option key={p.id} value={p.id} disabled={!p.enabled}>
                  {p.name} + {brl(p.prices.MEDIUM)}
                  {!p.enabled ? " · indisponível" : ""}
                </option>
              ))}
          </select>
        </Field>
      </div>
    </>
  );
}

export function ItemBuilder({
  products,
  onAdd,
  allowCombos = false,
  disabled = false,
  initialItem,
  choosePizzaMode = false,
  onCancel,
}: {
  products: Product[];
  onAdd(item: ItemDraft): void;
  allowCombos?: boolean;
  disabled?: boolean;
  initialItem?: BasicItemDraft;
  choosePizzaMode?: boolean;
  onCancel?(): void;
}) {
  const [kind, setKind] = useState<ItemDraft["kind"]>(
    initialItem?.kind ?? "PIZZA",
  );
  const [pizza, setPizza] = useState<
    Pick<PizzaDraft, "flavorIds" | "size" | "crust">
  >(
    initialItem?.kind === "PIZZA"
      ? {
          flavorIds: initialItem.flavorIds,
          size: initialItem.size,
          crust: initialItem.crust,
        }
      : {
          flavorIds: [
            products.find((p) => p.category === "PIZZA" && p.enabled)?.id ?? "",
          ],
          size: "LARGE",
          crust: "NONE",
        },
  );
  const [drink, setDrink] = useState(
    initialItem?.kind === "DRINK"
      ? initialItem.productId
      : (products.find((p) => p.category === "DRINK" && p.enabled)?.id ?? ""),
  );
  const [combo, setCombo] = useState(
    products.find(
      (p) => p.category === "COMBO" && !productUnavailableReason(products, p),
    )?.id ?? "",
  );
  const [quantity, setQuantity] = useState(initialItem?.quantity ?? 1);
  const [note, setNote] = useState(
    initialItem?.kind === "PIZZA" ? initialItem.note : "",
  );
  const item: ItemDraft =
    kind === "PIZZA"
      ? { kind, ...pizza, quantity, note }
      : kind === "DRINK"
        ? { kind, productId: drink, quantity }
        : { kind, productId: combo, quantity, note };
  let price = null;
  let error = "";
  try {
    price = priceItems(products, [item])[0];
  } catch (reason) {
    error =
      reason instanceof Error && reason.name !== "ZodError"
        ? reason.message
        : "Escolha um produto e uma quantidade de 1 a 20.";
  }
  const choices =
    kind === "PIZZA" ? [] : products.filter((p) => p.category === kind);
  return (
    <div className="item-builder">
      <div className="segmented builder-kind">
        {(
          [
            { id: "PIZZA", label: "Pizza", icon: Pizza },
            { id: "DRINK", label: "Bebida", icon: Wine },
            ...(allowCombos
              ? [{ id: "COMBO", label: "Combo", icon: Package }]
              : []),
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={kind === id ? "selected" : ""}
            aria-pressed={kind === id}
            onClick={() => {
              setKind(id as ItemDraft["kind"]);
              setNote("");
            }}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {kind === "PIZZA" ? (
        <PizzaFields
          products={products}
          value={pizza}
          onChange={setPizza}
          chooseMode={choosePizzaMode}
        />
      ) : (
        <Field label={kind === "DRINK" ? "Bebida" : "Combo"}>
          <select
            value={kind === "DRINK" ? drink : combo}
            onChange={(e) =>
              kind === "DRINK"
                ? setDrink(e.target.value)
                : setCombo(e.target.value)
            }
          >
            <option value="" disabled>
              {choices.length ? "Selecione" : "Nenhum produto cadastrado"}
            </option>
            {choices.map((p) => (
              <option
                key={p.id}
                value={p.id}
                disabled={!!productUnavailableReason(products, p)}
              >
                {p.name} · {brl(p.prices.MEDIUM)}
                {productUnavailableReason(products, p) ? " · indisponível" : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      {kind !== "DRINK" && (
        <Field
          label={
            kind === "PIZZA" ? "Observação da pizza" : "Observação do combo"
          }
        >
          <input
            value={note}
            maxLength={240}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: sem cebola, bem assada"
          />
        </Field>
      )}
      {kind === "PIZZA" && (
        <p className="field-hint">
          Meio a meio: preço do sabor mais caro, mais uma borda por pizza.
        </p>
      )}
      {kind === "COMBO" && (
        <p className="field-hint">
          Composição fixa e preço próprio. Promoções avulsas de pizza não se
          acumulam com o combo.
        </p>
      )}
      {price?.components && (
        <ItemComponents components={price.components} multiplier={quantity} />
      )}
      <div className="builder-footer">
        <Field label="Quantidade">
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </Field>
        <Button
          disabled={disabled || !price}
          onClick={() => {
            if (!price) return;
            onAdd(item);
            setQuantity(1);
            setNote("");
          }}
        >
          <Plus size={16} /> {initialItem ? "Atualizar item" : "Adicionar item"}
        </Button>
      </div>
      {onCancel && (
        <Button className="full cancel-item-edit" onClick={onCancel}>
          Cancelar edição do item
        </Button>
      )}
      {price ? (
        <p className="builder-price">
          Total do item <strong>{brl(price.unitPrice * price.quantity)}</strong>
        </p>
      ) : (
        <p className="field-hint" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
