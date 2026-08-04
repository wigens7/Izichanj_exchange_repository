import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Copy, Check, Eye, EyeOff, RefreshCw, Webhook, KeyRound, Store, BookOpen, AlertTriangle, ExternalLink, Wallet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

const PAYOUT_METHODS = [
  { value: "moncash", label: "MonCash", colorName: "Red", hex: "#EF4444" },
  { value: "natcash", label: "NatCash", colorName: "Lemon Yellow (Citron)", hex: "#E3FF00" },
  { value: "zelle", label: "Zelle", colorName: "Navy Blue", hex: "#1A237E" },
  { value: "cashapp", label: "CashApp", colorName: "Green", hex: "#22C55E" },
] as const;
type PayoutMethod = typeof PAYOUT_METHODS[number]["value"];
type PayoutReq = {
  id: number; amount: string; method: PayoutMethod;
  details: any; status: "pending" | "approved" | "rejected";
  adminNote: string | null; createdAt: string; processedAt: string | null;
};

type Merchant = {
  id: number;
  businessName: string;
  webhookUrl: string | null;
  apiPublicKey: string;
  apiSecretKey: string;
  isVerified: boolean;
  balance: string;
  createdAt: string;
};
type Txn = {
  id: number;
  paymentId: string;
  orderId: string;
