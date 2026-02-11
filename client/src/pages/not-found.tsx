import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto" />
        <h1 className="text-4xl font-display font-bold text-foreground">404</h1>
        <p className="text-muted-foreground">Page not found</p>
        <Link href="/">
          <Button>Return Home</Button>
        </Link>
      </div>
    </div>
  );
}
