import Link from "next/link";
export default function NotFound() {
  return (
    <main className="startup">
      <h1>Página não encontrada</h1>
      <p>Volte ao painel para acompanhar a operação.</p>
      <Link href="/pedidos" className="button primary">
        Ir para pedidos
      </Link>
    </main>
  );
}
