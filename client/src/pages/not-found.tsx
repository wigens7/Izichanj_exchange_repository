import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <AlertCircle className="w-20 h-20 text-muted-foreground mx-auto" />
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <p className="text-gray-500">Page not found</p>
        <Link href="/">
          <Button>Return Home</Button>
        </Link>
      </div>
    </div>
  );
}
