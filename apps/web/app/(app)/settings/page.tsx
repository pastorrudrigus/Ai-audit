import { Header } from "@/components/shared/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Configurações" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader><CardTitle>Organização</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Configure o nome, slug e configurações da organização.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Providers de IA</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Gerencie as chaves de API dos providers (OpenAI, Anthropic, Google).</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Notificações</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Configure alertas por email e webhooks.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
