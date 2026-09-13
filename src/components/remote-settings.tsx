"use client";

import { useRef, useState, type FormEvent } from "react";
import { Plus, Save, Users } from "lucide-react";
import { randomId } from "@/data/api-client";
import { type ApiStore } from "@/data/api-contract";
import { usePanel } from "./panel-provider";
import {
  Badge,
  Button,
  Field,
  Modal,
  MoneyInput,
  moneyText,
  parseMoney,
} from "./ui";

export const roleLabels: Record<string, string> = {
  MANAGER: "Gerente",
  ATTENDANT: "Atendimento",
  KITCHEN: "Cozinha",
  DRIVER: "Entregador",
};
export function RemoteSettings() {
  const { api, busy } = usePanel();
  const [editing, setEditing] = useState<ApiStore | null>(null);
  const [creating, setCreating] = useState(false);
  const store = api!.catalog!.store;
  return (
    <>
      <div className="settings-grid">
        <section className="settings-card">
          <h2>Operação da pizzaria</h2>
          <p>{store.name}</p>
          <p>Taxa de entrega: R$ {moneyText(store.deliveryFee)}</p>
          <p>Repasse por entrega: R$ {moneyText(store.driverFee)}</p>
          <Badge tone={store.open ? "green" : "red"}>
            {store.open ? "Recebendo pedidos" : "Novos pedidos pausados"}
          </Badge>
          <p className="field-hint">
            Alterações de preço valem para os próximos pedidos. O alerta visual
            da cozinha usa uma referência de 45 minutos.
          </p>
          <Button onClick={() => setEditing(store)} disabled={busy}>
            Editar operação
          </Button>
        </section>
        <section className="settings-card">
          <h2>Conexão</h2>
          <Badge tone="green">API Bonamassa</Badge>
          <p>Pedidos, catálogo, promoções e equipe são salvos na pizzaria.</p>
          <p className="field-hint">
            As telas consultam atualizações a cada 5 segundos enquanto estão
            abertas. O histórico carrega 100 pedidos por vez.
          </p>
        </section>
      </div>
      <div className="section-heading">
        <div>
          <h2>
            <Users size={22} /> Equipe
          </h2>
          <p>
            Cadastre os acessos para testar o atendimento, a cozinha e as
            entregas.
          </p>
        </div>
        <Button
          tone="primary"
          disabled={busy || api!.users.length >= 100}
          onClick={() => setCreating(true)}
        >
          <Plus size={17} /> Nova conta
        </Button>
      </div>
      <div className="remote-team">
        {api!.users.map((user) => (
          <article key={user.id} className="settings-card">
            <div className="section-heading compact">
              <h3>{user.name}</h3>
              <Badge tone={user.enabled ? "green" : "red"}>
                {user.enabled ? "Ativo" : "Desativado"}
              </Badge>
            </div>
            <p>{user.email}</p>
            <p>{roleLabels[user.role]}</p>
            {user.id === api!.user!.id ? (
              <small>Seu acesso</small>
            ) : (
              <Button
                disabled={busy}
                tone={user.enabled ? "danger" : "success"}
                onClick={() =>
                  void api!.run(
                    `staff/users/${user.id}`,
                    { expectedVersion: user.version, enabled: !user.enabled },
                    user.enabled ? "Acesso desativado." : "Acesso ativado.",
                    "PATCH",
                  )
                }
              >
                {user.enabled ? "Desativar acesso" : "Ativar acesso"}
              </Button>
            )}
          </article>
        ))}
      </div>
      {editing && (
        <StoreEditor initial={editing} onClose={() => setEditing(null)} />
      )}
      {creating && <UserEditor onClose={() => setCreating(false)} />}
    </>
  );
}
function StoreEditor({
  initial,
  onClose,
}: {
  initial: ApiStore;
  onClose(): void;
}) {
  const { api, busy, notify } = usePanel();
  const [name, setName] = useState(initial.name),
    [fee, setFee] = useState(moneyText(initial.deliveryFee)),
    [driverFee, setDriverFee] = useState(moneyText(initial.driverFee));
  const [open, setOpen] = useState(initial.open);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const deliveryFee = parseMoney(fee),
      repass = parseMoney(driverFee);
    if (
      !Number.isFinite(deliveryFee) ||
      !Number.isFinite(repass) ||
      deliveryFee > 10000 ||
      repass > 100000
    ) {
      notify("Confira as taxas. Informe valores válidos em reais.", true);
      return;
    }
    if (
      (
        await api!.run(
          "staff/store",
          {
            expectedVersion: initial.version,
            name,
            open,
            deliveryFee,
            driverFee: repass,
          },
          "Operação atualizada.",
          "PATCH",
        )
      ).ok
    )
      onClose();
  };
  return (
    <Modal title="Editar operação" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-content">
          <Field label="Nome da pizzaria">
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="form-row">
            <Field label="Taxa de entrega">
              <MoneyInput required value={fee} onChange={setFee} />
            </Field>
            <Field label="Repasse ao entregador">
              <MoneyInput required value={driverFee} onChange={setDriverFee} />
            </Field>
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              checked={open}
              onChange={(e) => setOpen(e.target.checked)}
            />{" "}
            Receber novos pedidos
          </label>
        </div>
        <footer className="modal-footer">
          <Button onClick={onClose}>Voltar</Button>
          <Button tone="primary" type="submit" disabled={busy}>
            <Save size={17} /> Salvar operação
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
function UserEditor({ onClose }: { onClose(): void }) {
  const { api, busy } = usePanel();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "KITCHEN",
  });
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const exists = api!.users.some(
    (user) => user.email.toLowerCase() === form.email.trim().toLowerCase(),
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = {
      ...form,
      email: form.email.trim(),
      name: form.name.trim(),
      phone: form.phone.replace(/[()\s-]/g, ""),
    };
    const encoded = JSON.stringify(body);
    if (attempt.current?.body !== encoded)
      attempt.current = { body: encoded, key: randomId() };
    if (await api!.createUser(body, attempt.current!.key)) {
      setForm({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "KITCHEN",
      });
      attempt.current = null;
      onClose();
    }
  };
  return (
    <Modal
      title="Nova conta da equipe"
      subtitle="Cada pessoa usa seu próprio acesso."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-content">
          <Field label="Nome">
            <input
              required
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              required
              maxLength={160}
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Telefone com DDD">
            <input
              type="tel"
              required
              maxLength={20}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Função">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {Object.entries(roleLabels).map(([role, label]) => (
                <option key={role} value={role}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Senha inicial" hint="Pelo menos 12 caracteres.">
            <input
              required
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          {exists && (
            <p role="status">
              Já existe uma conta com este e-mail. Confira a lista da equipe
              antes de cadastrar novamente.
            </p>
          )}
        </div>
        <footer className="modal-footer">
          <Button onClick={onClose}>Voltar</Button>
          <Button type="submit" tone="primary" disabled={busy || exists}>
            Criar conta
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
