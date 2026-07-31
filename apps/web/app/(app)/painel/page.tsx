import { Header } from "@/components/shared/header";
import { PainelContent } from "./painel-content";

export const metadata = {
  title: "Painel do Sócio — Tutela",
};

export default function PainelPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Painel do Sócio" />
      <main className="flex-1 overflow-y-auto p-6 bg-[#FCFBF8]">
        <PainelContent />
      </main>
    </div>
  );
}
