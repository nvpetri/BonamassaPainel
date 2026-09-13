"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type ReactElement,
} from "react";
import {
  ArrowUpRight,
  Check,
  Clock3,
  PackageCheck,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  brl,
  minutesWaiting,
  statusLabels,
  type Order,
  type Status,
} from "@/domain/model";
import { usePanel } from "./panel-provider";

export function Button({
  children,
  className = "",
  tone = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger" | "gold" | "ghost";
}) {
  return (
    <button type="button" {...props} className={`button ${tone} ${className}`}>
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export const statusTone = (status: Status) =>
  ({
    NEW: "red",
    CONFIRMED: "gold",
    PREPARING: "gold",
    READY: "green",
    OUT_FOR_DELIVERY: "blue",
    RETURNING: "orange",
    DELIVERED: "green",
    RETURNED: "neutral",
    CANCELLED: "red",
  })[status];
export function StatusBadge({ order }: { order: Order }) {
  return (
    <Badge tone={statusTone(order.status)}>
      <span className="dot" />
      {order.deliveryStatus === "COLLECTED"
        ? "Retirado pelo motoboy"
        : order.deliveryStatus === "ASSIGNED"
          ? "Entregador atribuído"
          : statusLabels[order.status]}
    </Badge>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <PackageCheck size={27} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  drawer = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose(): void;
  wide?: boolean;
  drawer?: boolean;
}) {
  const { toast } = usePanel();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? "wide" : ""} ${drawer ? "drawer" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
            {toast && (
              <div
                className={`modal-message ${toast.error ? "error" : ""}`}
                role={toast.error ? "alert" : "status"}
              >
                {toast.message}
              </div>
            )}
          </div>
          <Button
            tone="ghost"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar janela"
          >
            <X size={21} />
          </Button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <label className={`field ${className}`} htmlFor={id}>
      <span id={`${id}-label`}>{label}</span>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            id,
            "aria-labelledby": `${id}-label`,
            "aria-describedby": hint ? `${id}-hint` : undefined,
          })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}
export function MoneyInput({
  value,
  onChange,
  ...props
}: {
  value: string;
  onChange(value: string): void;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  id?: string;
}) {
  return (
    <div className="money-input">
      <span>R$</span>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="0,00"
        pattern="[0-9]+([,.][0-9]{1,2})?"
        maxLength={9}
      />
    </div>
  );
}
export function parseMoney(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+([,.]\d{1,2})?$/.test(trimmed)) return NaN;
  const [whole, fraction = ""] = trimmed.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export const moneyText = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");

export function OrderCard({
  order,
  now,
  target,
  onOpen,
  children,
  kitchen = false,
}: {
  order: Order;
  now: number;
  target: number;
  onOpen(): void;
  children?: ReactNode;
  kitchen?: boolean;
}) {
  const minutes = minutesWaiting(order, now);
  const late = minutes >= target;
  return (
    <article
      className={`order-card ${late ? "late" : ""} ${kitchen ? "kitchen-card" : ""}`}
      data-testid={`order-${order.number}`}
    >
      <div className="card-heading">
        <button
          className="order-number"
          onClick={onOpen}
          aria-label={`Ver pedido ${order.number}`}
        >
          <span className="hash">#</span>
          {order.number}
          <ArrowUpRight size={15} />
        </button>
        <span className={`elapsed ${late ? "late" : ""}`}>
          <Clock3 size={12} />
          {minutes} min
        </span>
      </div>
      <div className="card-customer">{order.customer}</div>
      <div className="order-meta">
        <span>
          {order.mode === "DELIVERY" ? (
            <>
              <span className="delivery-dot" /> Entrega
            </>
          ) : (
            <>
              <ShoppingBag size={12} /> Retirada
            </>
          )}
        </span>
        <StatusBadge order={order} />
      </div>
      <div className="card-items">
        {order.items.map((item) => (
          <div className="card-item" key={item.id}>
            <span className="quantity">{item.quantity}×</span>
            <div>
              <strong>{item.name}</strong>
              <small>{item.detail}</small>
              {item.note && <span className="item-note">{item.note}</span>}
            </div>
          </div>
        ))}
      </div>
      {order.note && (
        <div className="order-note">
          <span>OBS.</span>
          {order.note}
        </div>
      )}
      {!kitchen && order.promotion && (
        <div className="card-promotion">
          <span>{order.promotion.name}</span>
          <b>− {brl(order.discount)}</b>
        </div>
      )}
      {!kitchen && (
        <div className="card-total">
          <span>
            {order.total === 0 ? (
              "Sem valor a cobrar"
            ) : order.payment === "PREPAID" ? (
              <>
                <Check size={12} /> Pago · demo
              </>
            ) : order.payment === "CASH" ? (
              order.mode === "DELIVERY" ? (
                "Dinheiro na entrega"
              ) : (
                "Dinheiro na retirada"
              )
            ) : (
              "Cartão na maquininha"
            )}
          </span>
          <strong>{brl(order.total)}</strong>
        </div>
      )}
      {children && <div className="card-action">{children}</div>}
    </article>
  );
}
