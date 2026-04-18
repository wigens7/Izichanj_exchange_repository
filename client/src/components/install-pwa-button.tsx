import { Download, Smartphone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/pwa";
import { useToast } from "@/hooks/use-toast";

/** A button that triggers PWA install when available. */
export function InstallPwaButton({ className }: { className?: string }) {
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const { toast } = useToast();

  if (installed) {
    return (
      <Button variant="outline" disabled className={className} data-testid="button-pwa-installed">
        <CheckCircle2 className="w-4 h-4 mr-2" /> App installed
      </Button>
    );
  }

  if (!canInstall) {
    return (
      <Button
        variant="outline"
        className={className}
        onClick={() =>
          toast({
            title: "Install from your browser menu",
            description:
              'On Chrome/Edge: open the menu and tap "Install app". On iPhone Safari: tap Share, then "Add to Home Screen".',
          })
        }
        data-testid="button-pwa-install-help"
      >
        <Smartphone className="w-4 h-4 mr-2" /> Add to Home Screen
      </Button>
    );
  }

  return (
    <Button
      className={className}
      onClick={async () => {
        const ok = await promptInstall();
        if (ok) toast({ title: "Installing Izichanj...", description: "The app will open from your home screen." });
      }}
      data-testid="button-pwa-install"
    >
      <Download className="w-4 h-4 mr-2" /> Install Izichanj
    </Button>
  );
}
