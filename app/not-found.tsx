import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="space-y-3 py-16 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground">Essa rota não existe no ClimaBR.</p>
      <Button asChild>
        <Link href="/">Voltar para a Home</Link>
      </Button>
    </div>
  );
}
