"use client";

import { randomId } from "@/data/api-client";

import { useState, type FormEvent } from "react";
import {
  Circle,
  Package,
  Pencil,
  Pizza,
  Plus,
  Save,
  Search,
  Trash2,
  Wine,
} from "lucide-react";
import { brl, type Product } from "@/domain/model";
import {
  CATALOG_LIMIT,
  categoryLabels,
  pizzaGroupLabels,
  productUnavailableReason,
  priceItems,
  recipeComponents,
  comboPriceComparison,
  type BasicItemDraft,
  type PizzaDraft,
} from "@/domain/catalog";
import { usePanel } from "./panel-provider";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  MoneyInput,
  moneyText,
  parseMoney,
} from "./ui";
import { PhotoField, ProductPhoto } from "./product-photo";
import { ItemBuilder, PizzaFields } from "./item-builder";
import { ItemComponents } from "./order-components";
import { NewOrder } from "./new-order";
import { ComboPriceEditor, ComboPriceSummary } from "./combo-price";

const icons = { PIZZA: Pizza, CRUST: Circle, DRINK: Wine, COMBO: Package };
const createLabels = {
  PIZZA: "Novo sabor",
  CRUST: "Nova borda",
  DRINK: "Nova bebida",
  COMBO: "Novo combo",
};
const saveLabels = {
  PIZZA: "Cadastrar sabor",
  CRUST: "Cadastrar borda",
  DRINK: "Cadastrar bebida",
  COMBO: "Cadastrar combo",
};

export function Catalog() {
  const { state, busy, execute } = usePanel();
  const [tab, setTab] = useState<"all" | Product["category"]>("all");
  const [pizzaGroup, setPizzaGroup] = useState<
    "all" | "TRADITIONAL" | "SPECIAL" | "HALF"
  >("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [orderPizza, setOrderPizza] = useState<PizzaDraft | null>(null);
  const products = state!.products;
  const category = tab === "all" ? "PIZZA" : tab;
  const half = tab === "PIZZA" && pizzaGroup === "HALF";
  const visible = products.filter(
    (p) =>
      (tab === "all" || p.category === tab) &&
      (tab !== "PIZZA" ||
        pizzaGroup === "all" ||
        (p.pizzaGroup ?? "TRADITIONAL") === pizzaGroup) &&
      `${p.name} ${p.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <>
      <div className="catalog-callout">
        <span className="callout-icon">
          <Pizza size={23} />
        </span>
        <div>
          <strong>Cada produto no seu lugar</strong>
          <p>
            Organize os sabores, cadastre acompanhamentos e monte combos com
            preço próprio.
          </p>
        </div>
        <Badge tone="gold">Cardápio Bonamassa</Badge>
      </div>
      <div className="section-heading compact catalog-heading">
        <div>
          <h2>
            Seu cardápio <span>{products.length}</span>
          </h2>
          <p>Fotos, preços e disponibilidade por categoria.</p>
        </div>
        <Button
          tone="primary"
          disabled={busy || products.length >= CATALOG_LIMIT}
          onClick={() => setEditing(null)}
        >
          <Plus size={17} /> {createLabels[category]}
        </Button>
      </div>
      <nav className="catalog-categories" aria-label="Categorias do cardápio">
        <button
          className={tab === "all" ? "selected" : ""}
          aria-pressed={tab === "all"}
          onClick={() => setTab("all")}
        >
          <span>Todos os produtos</span>
          <b>{products.length}</b>
        </button>
        {(Object.keys(categoryLabels) as Product["category"][]).map((id) => {
          const Icon = icons[id];
          return (
            <button
              key={id}
              className={tab === id ? "selected" : ""}
              aria-pressed={tab === id}
              onClick={() => {
                setTab(id);
                setPizzaGroup("all");
              }}
            >
              <Icon size={20} />
              <span>{categoryLabels[id]}</span>
              <b>{products.filter((p) => p.category === id).length}</b>
            </button>
          );
        })}
      </nav>
      {products.length >= CATALOG_LIMIT && (
        <p className="field-hint">
          Você atingiu o limite de {CATALOG_LIMIT} produtos.
        </p>
      )}
      <div className="board-toolbar catalog-toolbar">
        {tab === "PIZZA" ? (
          <div className="tabs" role="group" aria-label="Tipos de pizza">
            {(
              [
                ["all", "Todos os sabores"],
                ["TRADITIONAL", "Tradicionais"],
                ["SPECIAL", "Especiais"],
                ["HALF", "Meio a meio"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={pizzaGroup === id ? "selected" : ""}
                aria-pressed={pizzaGroup === id}
                onClick={() => setPizzaGroup(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="catalog-context">
            {tab === "CRUST"
              ? "O valor da borda é somado uma vez por pizza, em qualquer tamanho."
              : tab === "COMBO"
                ? "Composição fixa, com sabores, tamanhos, bordas e bebidas definidos por você."
                : tab === "DRINK"
                  ? "Cadastre a apresentação da bebida no nome: lata, garrafa ou volume."
                  : "Escolha uma categoria para organizar seu cardápio."}
          </p>
        )}
        {!half && (
          <label className="search">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto"
              aria-label="Buscar produto"
            />
          </label>
        )}
      </div>
      {half ? (
        <HalfPizza products={products} onOrder={setOrderPizza} />
      ) : (
        <>
          <div className="catalog-grid">
            {visible.map((product, index) => {
              const Icon = icons[product.category];
              const unavailable = productUnavailableReason(products, product);
              const parts = product.combo
                ? recipeComponents(products, product.combo)
                : null;
              return (
                <article
                  key={product.id}
                  className={`product-card ${unavailable ? "unavailable" : ""}`}
                >
                  <div
                    className={`product-art art-${index % 4} ${product.photo ? "has-photo" : ""}`}
                  >
                    {product.photo ? (
                      <ProductPhoto
                        src={product.photo}
                        alt={`Foto de ${product.name}`}
                      />
                    ) : (
                      <div className="product-plate">
                        <Icon size={50} strokeWidth={1.2} />
                      </div>
                    )}
                    <Badge tone={unavailable ? "neutral" : "green"}>
                      {unavailable
                        ? product.enabled
                          ? "Item indisponível"
                          : "Pausado"
                        : "Disponível"}
                    </Badge>
                    {!product.photo && (
                      <span className="art-caption">
                        {product.category === "PIZZA"
                          ? "FEITA PARA COMPARTILHAR"
                          : product.category === "COMBO"
                            ? "COMBINAÇÃO DA CASA"
                            : "PARA ACOMPANHAR"}
                      </span>
                    )}
                  </div>
                  <div className="product-body">
                    <div className="product-category">
                      {product.category === "PIZZA"
                        ? `PIZZAS · ${pizzaGroupLabels[product.pizzaGroup ?? "TRADITIONAL"]}`
                        : categoryLabels[product.category]}
                    </div>
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    {parts && (
                      <details className="combo-recipe">
                        <summary>
                          Ver composição ·{" "}
                          {parts.reduce((sum, p) => sum + p.quantity, 0)} itens
                        </summary>
                        <ItemComponents components={parts} />
                      </details>
                    )}
                    {product.enabled && unavailable && (
                      <p className="catalog-unavailable">{unavailable}</p>
                    )}
                    <div className="product-prices">
                      {(product.category === "PIZZA"
                        ? (["SMALL", "MEDIUM", "LARGE"] as const)
                        : (["MEDIUM"] as const)
                      ).map((size) => (
                        <div key={size}>
                          <span>
                            {product.category === "PIZZA"
                              ? {
                                  SMALL: "Pequena",
                                  MEDIUM: "Média",
                                  LARGE: "Grande",
                                }[size]
                              : product.category === "CRUST"
                                ? "Por pizza"
                                : product.category === "COMBO"
                                  ? "Combo completo"
                                  : "Unidade"}
                          </span>
                          <b>{brl(product.prices[size])}</b>
                        </div>
                      ))}
                    </div>
                    {product.combo && (
                      <ComboPriceSummary
                        comparison={comboPriceComparison(
                          products,
                          product.combo,
                          product.prices.MEDIUM,
                        )}
                      />
                    )}
                    <div className="product-actions">
                      <Button
                        tone="ghost"
                        onClick={() => setEditing(product)}
                        aria-label={`Editar ${product.name}`}
                      >
                        <Pencil size={14} /> Editar
                      </Button>
                      <button
                        role="switch"
                        aria-checked={product.enabled}
                        disabled={busy}
                        aria-label={`Disponibilidade de ${product.name}`}
                        className={`product-toggle ${product.enabled ? "on" : ""}`}
                        onClick={() =>
                          void execute(
                            {
                              type: "PRODUCT",
                              previous: product,
                              product: {
                                ...product,
                                enabled: !product.enabled,
                              },
                            },
                            product.enabled
                              ? `${product.name} pausado para novos pedidos.`
                              : product.category === "COMBO"
                                ? `${product.name} ativado. A disponibilidade também depende dos itens do combo.`
                                : `${product.name} disponível.`,
                          )
                        }
                      >
                        <span>{product.enabled ? "Ativo" : "Pausado"}</span>
                        <span className="toggle-track">
                          <span />
                        </span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!visible.length && (
            <Empty
              title="Nenhum produto encontrado"
              description="Cadastre um produto nesta categoria ou tente outra busca."
            />
          )}
        </>
      )}
      {editing !== undefined && (
        <EditProduct
          key={editing?.id ?? "new-product"}
          product={editing}
          initialCategory={category}
          initialGroup={pizzaGroup === "SPECIAL" ? "SPECIAL" : "TRADITIONAL"}
          onClose={() => setEditing(undefined)}
          onCreated={(saved) => {
            setQuery("");
            setTab(saved.category);
            setPizzaGroup(
              saved.category === "PIZZA"
                ? (saved.pizzaGroup ?? "TRADITIONAL")
                : "all",
            );
          }}
        />
      )}
      {orderPizza && (
        <NewOrder
          initialItem={orderPizza}
          onClose={() => setOrderPizza(null)}
        />
      )}
    </>
  );
}

function HalfPizza({
  products,
  onOrder,
}: {
  products: Product[];
  onOrder(item: PizzaDraft): void;
}) {
  const { state } = usePanel();
  const [value, setValue] = useState<
    Pick<PizzaDraft, "flavorIds" | "size" | "crust">
  >({
    flavorIds: products
      .filter((p) => p.category === "PIZZA" && p.enabled)
      .slice(0, 2)
      .map((p) => p.id),
    size: "LARGE",
    crust: "NONE",
  });
  const item: PizzaDraft = { kind: "PIZZA", ...value, quantity: 1, note: "" };
  let priced = null;
  try {
    if (item.flavorIds.length === 2) priced = priceItems(products, [item])[0];
  } catch {
    /* Availability is rechecked when creating the order. */
  }
  return (
    <section className="half-pizza">
      <div className="half-pizza-intro">
        <Pizza size={38} />
        <Badge tone="gold">Duas metades, uma pizza</Badge>
        <h2>Meio a meio</h2>
        <p>
          Combine sabores tradicionais e especiais. O preço é o do sabor mais
          caro no tamanho escolhido, mais a borda.
        </p>
        <p>
          Os sabores vêm do seu cadastro e respeitam a disponibilidade do
          cardápio.
        </p>
      </div>
      <div className="half-pizza-builder">
        <PizzaFields
          products={products}
          value={value}
          onChange={setValue}
          halfRequired
        />
        <div className="half-pizza-price" aria-live="polite">
          <span>
            {priced ? priced.name : "Selecione dois sabores disponíveis"}
          </span>
          <strong>{priced ? brl(priced.unitPrice) : "—"}</strong>
          <small>Valor de uma pizza, sem taxa de entrega.</small>
        </div>
        <Button
          className="full"
          tone="primary"
          disabled={!priced || !state!.storeOpen}
          onClick={() => onOrder(item)}
        >
          Montar pedido com esta pizza
        </Button>
        {!state!.storeOpen && (
          <p className="field-hint">Abra a loja para criar novos pedidos.</p>
        )}
      </div>
    </section>
  );
}

function EditProduct({
  product,
  initialCategory,
  initialGroup,
  onClose,
  onCreated,
}: {
  product: Product | null;
  initialCategory: Product["category"];
  initialGroup: "TRADITIONAL" | "SPECIAL";
  onClose(): void;
  onCreated(product: Product): void;
}) {
  const { state, execute, busy, notify } = usePanel();
  const [category, setCategory] = useState(
    product?.category ?? initialCategory,
  );
  const [pizzaGroup, setPizzaGroup] = useState(
    product?.pizzaGroup ?? initialGroup,
  );
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [photo, setPhoto] = useState(product?.photo ?? null);
  const [photoPending, setPhotoPending] = useState(false);
  const [enabled, setEnabled] = useState(product?.enabled ?? true);
  const [combo, setCombo] = useState<BasicItemDraft[]>(product?.combo ?? []);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [prices, setPrices] = useState({
    SMALL: product ? moneyText(product.prices.SMALL) : "",
    MEDIUM: product ? moneyText(product.prices.MEDIUM) : "",
    LARGE: product ? moneyText(product.prices.LARGE) : "",
  });
  const parts = comboPriceComparison(
    state!.products,
    combo,
    parseMoney(prices.MEDIUM),
  ).lines;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || photoPending || editingItem !== null) return;
    if (!name.trim()) {
      notify("Informe o nome do produto.", true);
      return;
    }
    const parsed = Object.fromEntries(
      Object.entries(prices).map(([key, value]) => [key, parseMoney(value)]),
    ) as Product["prices"];
    if (category !== "PIZZA") parsed.SMALL = parsed.LARGE = parsed.MEDIUM;
    if (Object.values(parsed).some((p) => !Number.isFinite(p) || p <= 0)) {
      notify("Informe preços maiores que zero.", true);
      return;
    }
    if (category === "COMBO" && combo.length < 2) {
      notify("Adicione pelo menos dois itens à composição do combo.", true);
      return;
    }
    const saved: Product = {
      id: product?.id ?? randomId(),
      category,
      enabled,
      name: name.trim(),
      description: description.trim(),
      prices: parsed,
      photo,
      ...(category === "PIZZA" ? { pizzaGroup } : {}),
      ...(category === "COMBO" ? { combo } : {}),
    };
    if (
      await execute(
        product
          ? { type: "PRODUCT", previous: product, product: saved }
          : { type: "ADD_PRODUCT", product: saved },
        product
          ? "Produto atualizado. Pedidos existentes mantêm sua composição e preços."
          : "Produto cadastrado no cardápio.",
      )
    ) {
      if (!product) onCreated(saved);
      onClose();
    }
  };
  return (
    <Modal
      title={product ? "Editar produto" : createLabels[category]}
      subtitle="Alterações valem para novos pedidos."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-content product-form">
          <div className="form-row">
            <Field label="Categoria">
              <select
                value={category}
                disabled={!!product}
                onChange={(e) => {
                  setCategory(e.target.value as Product["category"]);
                  setEditingItem(null);
                }}
              >
                {Object.entries(categoryLabels).map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {category === "PIZZA" && (
              <Field label="Grupo da pizza">
                <select
                  value={pizzaGroup}
                  onChange={(e) =>
                    setPizzaGroup(e.target.value as typeof pizzaGroup)
                  }
                >
                  {Object.entries(pizzaGroupLabels).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <Field label="Nome">
            <input
              required
              autoFocus
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <PhotoField
            value={photo}
            onChange={setPhoto}
            pending={photoPending}
            onPending={setPhotoPending}
            disabled={busy}
          />
          <Field label="Descrição">
            <textarea
              maxLength={240}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          {category !== "COMBO" && (
            <div className="form-row">
              {(category === "PIZZA"
                ? (["SMALL", "MEDIUM", "LARGE"] as const)
                : (["MEDIUM"] as const)
              ).map((size) => (
                <Field
                  key={size}
                  label={
                    category === "PIZZA"
                      ? { SMALL: "Pequena", MEDIUM: "Média", LARGE: "Grande" }[
                          size
                        ]
                      : category === "CRUST"
                        ? "Preço da borda por pizza"
                        : "Preço por unidade"
                  }
                >
                  <MoneyInput
                    value={prices[size]}
                    onChange={(value) =>
                      setPrices({ ...prices, [size]: value })
                    }
                    required
                  />
                </Field>
              ))}
            </div>
          )}
          {category === "COMBO" && (
            <section className="combo-editor">
              <h3>
                Composição do combo <span>{combo.length}/6</span>
              </h3>
              <p className="field-hint">
                Adicione de 2 a 6 itens. Escolha pizza inteira ou meio a meio,
                tamanho e borda. O combo fica indisponível se algum componente
                for pausado.
              </p>
              {parts.map((part, index) => (
                <div className="combo-editor-line" key={index}>
                  <div>
                    <strong>
                      {part.quantity}× {part.name}
                    </strong>
                    {combo[index].kind === "PIZZA" && (
                      <small className="combo-pizza-format">
                        {combo[index].flavorIds.length === 2
                          ? "Meio a meio"
                          : "Pizza inteira"}
                      </small>
                    )}
                    <small>{part.detail}</small>
                    {part.note && <small>{part.note}</small>}
                    <small>Preço individual: {brl(part.total)}</small>
                  </div>
                  <Button
                    tone="ghost"
                    disabled={busy || editingItem !== null}
                    aria-label={`Editar item ${index + 1} do combo`}
                    onClick={() => setEditingItem(index)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    tone="ghost"
                    disabled={busy || editingItem !== null}
                    aria-label={`Remover item ${index + 1} do combo`}
                    onClick={() => {
                      setCombo(combo.filter((_, i) => i !== index));
                      setEditingItem(null);
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              <ItemBuilder
                key={
                  editingItem === null ? "new-item" : `edit-item-${editingItem}`
                }
                initialItem={
                  editingItem === null ? undefined : combo[editingItem]
                }
                choosePizzaMode
                products={state!.products}
                disabled={busy || (editingItem === null && combo.length >= 6)}
                onCancel={
                  editingItem === null ? undefined : () => setEditingItem(null)
                }
                onAdd={(item) => {
                  if (item.kind === "COMBO") return;
                  if (editingItem === null) setCombo([...combo, item]);
                  else {
                    setCombo(
                      combo.map((current, i) =>
                        i === editingItem ? item : current,
                      ),
                    );
                    setEditingItem(null);
                  }
                }}
              />
              {editingItem !== null && (
                <p className="field-hint" role="status">
                  Atualize ou cancele a edição do item antes de salvar o combo.
                </p>
              )}
              <ComboPriceEditor
                products={state!.products}
                items={combo}
                value={prices.MEDIUM}
                onChange={(value) => setPrices({ ...prices, MEDIUM: value })}
                disabled={busy || editingItem !== null}
              />
              <p className="field-hint">
                Preço fechado. A composição fica registrada no pedido, sem
                acumular promoções de pizzas avulsas.
              </p>
            </section>
          )}
          {category === "CRUST" && (
            <p className="field-hint">
              A borda é um adicional da pizza. Este preço vale para todos os
              tamanhos.
            </p>
          )}
          {category === "PIZZA" && (
            <p className="field-hint">
              Este sabor também pode compor uma pizza meio a meio.
            </p>
          )}
          <label className="check-field">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{" "}
            Disponível para novos pedidos
          </label>
        </div>
        <footer className="modal-footer">
          <Button onClick={onClose}>Voltar</Button>
          <Button
            tone="primary"
            type="submit"
            disabled={busy || photoPending || editingItem !== null}
          >
            <Save size={16} />
            {photoPending
              ? "Preparando foto…"
              : product
                ? "Salvar produto"
                : saveLabels[category]}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
