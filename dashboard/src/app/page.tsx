import { Painel } from "@/components/painel";
import { carregarSnapshot } from "@/lib/dados";

export default function Pagina() {
  return <Painel inicial={carregarSnapshot()} />;
}
