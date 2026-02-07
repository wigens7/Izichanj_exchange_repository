import { useAdminData, useAdminApproveDeposit, useAdminUpdateBalance } from "@/hooks/use-transactions";
import { useUser } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AdminPage() {
  const { data: currentUser } = useUser();
  const { data: users, isLoading } = useAdminData();
  const { mutate: updateBalance } = useAdminUpdateBalance();
  // Simplified for brevity, typically we'd fetch pending deposits/withdrawals separately

  if (!currentUser || currentUser.role !== "admin") {
    return <div className="p-10 text-center text-destructive">Access Denied</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h1 className="text-3xl font-display font-bold">Admin Panel</h1>
      
      <Card>
        <CardHeader>
            <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div>Loading...</div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Balance</TableHead>
                            <TableHead>KYC</TableHead>
                            <TableHead>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users?.map((user: any) => (
                            <UserRow key={user.id} user={user} onUpdateBalance={updateBalance} />
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
      
      {/* Additional admin sections for Deposits/Withdrawals would go here */}
    </div>
  );
}

function UserRow({ user, onUpdateBalance }: { user: any, onUpdateBalance: any }) {
    const [balance, setBalance] = useState(user.balance);
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = () => {
        onUpdateBalance({ id: user.id, balance: Number(balance) });
        setIsEditing(false);
    };

    return (
        <TableRow>
            <TableCell className="font-medium">{user.fullName}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <Input 
                            type="number" 
                            value={balance} 
                            onChange={(e) => setBalance(e.target.value)} 
                            className="w-24 h-8"
                        />
                        <Button size="sm" onClick={handleSave}>Save</Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        {user.balance} HTG
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditing(true)}>
                            Edit
                        </Button>
                    </div>
                )}
            </TableCell>
            <TableCell>
                <StatusBadge status={user.kycStatus} />
            </TableCell>
            <TableCell>
                <Button variant="outline" size="sm">View Details</Button>
            </TableCell>
        </TableRow>
    );
}
