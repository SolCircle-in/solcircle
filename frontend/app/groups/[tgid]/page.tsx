"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Script from "next/script";
import api from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Users,
  Coins,
  Shield,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Copy,
  CheckCircle,
  XCircle,
  Activity,
} from "lucide-react";
import { GL } from "@/components/gl";
import Link from "next/link";

interface TelegramInfo {
  title: string;
  description?: string;
  username?: string;
  memberCount?: number;
  type?: string;
}

interface GroupDetail {
  tgid: string;
  relay_account: string;
  encrypted_key: string;
  pool_pda: string;
  owner: string;
  admin: string[];
  cooldown_period: number;
  min_stake: number;
  status: string;
  created_at: string;
  subscription_model?: boolean;
  fee_percentage?: number;
  total_members?: number;
  profit_loss?: number;
  total_pool?: number;
  telegram?: TelegramInfo;
  wallet_balance_sol?: string;
  wallet_balance_lamports?: number;
}

interface Order {
  order_id: number;
  proposal_id: number;
  transaction_hash: string;
  token_symbol: string;
  total_amount_spent: number;
  token_amount: number;
  fees: number;
  executed_by: string;
  status: string;
  created_at: string;
  tgid: string;
  participant_count: number;
}

interface TokenOrderSummary {
  order_id: string;
  tokens: number;
  invested: number;
  bought_at_price: number;
  date: string;
}

interface TokenHolding {
  token_symbol: string;
  total_tokens: number;
  total_invested: number;
  order_count: number;
  orders: TokenOrderSummary[];
}

interface Statistics {
  total_sol_invested: number;
  total_active_orders: number;
  total_sold_orders: number;
  unique_tokens: number;
}

interface GroupDetailsResponse {
  success: boolean;
  data: {
    group: GroupDetail;
    statistics: Statistics;
    token_holdings: TokenHolding[];
    orders: Order[];
    network: string;
  };
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tgid = params.tgid as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [tokenHoldings, setTokenHoldings] = useState<TokenHolding[]>([]);
  const [network, setNetwork] = useState<string>("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (tgid) {
      fetchGroupDetails();
    }
  }, [tgid]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      // Single API call to get everything
      const response = await api.get(`/api/groups/${tgid}/details`);

      const data: GroupDetailsResponse = response.data;

      if (data.success) {
        setGroup(data.data.group);
        setStatistics(data.data.statistics);
        setTokenHoldings(data.data.token_holdings);
        setOrders(data.data.orders);
        setNetwork(data.data.network);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "An error occurred";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCooldown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const truncateAddress = (address: string, chars = 6) => {
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
  };

  const handleJoin = async () => {
    try {
      setJoining(true);
      const response = await api.post(
        `/api/groups/${encodeURIComponent(tgid)}/invite`,
        { joinRequest: true }
      );
      const data = response.data;
      if (!data?.success || !data?.invite_link) {
        throw new Error(data?.error || "Failed to create invite link");
      }
      window.location.href = data.invite_link as string;
    } catch (err: any) {
      console.error("Join error:", err);
      const msg = err.response?.data?.error || err.message || "Failed to create invite link";
      alert(msg);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <>
        <GL hovering={false} />
        <div className="relative z-10 container mx-auto px-4 py-8 pt-24 md:pt-32">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-purple-500/20 backdrop-blur-md">
                <CardContent className="pt-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (error || !group) {
    return (
      <>
        <GL hovering={false} />
        <div className="relative z-10 container mx-auto px-4 py-8 pt-24 md:pt-32">
          <Card className="border-red-500/20 bg-red-950/10 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-red-400">
                Error Loading Group
              </CardTitle>
              <CardDescription className="text-red-300">
                {error || "Group not found"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/groups">
                <Button className="border-red-500/50">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Groups
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const profitLoss = Number(group.profit_loss || 0);
  const isProfit = profitLoss >= 0;

  return (
    <>
      <GL hovering={false} />
      <div className="relative z-10 container mx-auto px-4 py-8 pt-24 md:pt-32 min-h-screen">
        {/* Back Button */}
        <Link href="/groups">
          <Button className="mb-6 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Groups
          </Button>
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              {group.telegram?.title || `Group ${tgid.slice(-6)}`}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-foreground/60 text-sm font-mono">{tgid}</p>
              {group.telegram?.username && (
                <span className="text-blue-400 text-sm">
                  @{group.telegram.username}
                </span>
              )}
            </div>
            {group.telegram?.description && (
              <p className="text-foreground/70 text-sm mt-2 max-w-2xl">
                {group.telegram.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Badge
              className={
                group.status === "active"
                  ? "bg-green-500/20 text-green-400 border-green-500/30 text-lg px-4 py-2"
                  : "bg-gray-500/20 text-gray-400 border-gray-500/30 text-lg px-4 py-2"
              }
            >
              {group.status}
            </Badge>
            <Button
              onClick={handleJoin}
              disabled={joining}
              className="bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300"
            >
              {joining ? "Joining…" : "Join Group"}
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60 mb-1">P/L</p>
                  {group.profit_loss !== undefined ? (
                    <div
                      className={`text-2xl font-bold flex items-center gap-2 ${
                        isProfit ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {isProfit ? (
                        <TrendingUp className="w-6 h-6" />
                      ) : (
                        <TrendingDown className="w-6 h-6" />
                      )}
                      {isProfit ? "+" : ""}
                      {profitLoss}%
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-foreground/40">N/A</p>
                  )}
                </div>
                <Activity className="w-8 h-8 text-purple-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60 mb-1">Total Pool</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {group.total_pool !== undefined
                      ? `${group.total_pool} SOL`
                      : "N/A"}
                  </p>
                </div>
                <Coins className="w-8 h-8 text-blue-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60 mb-1">
                    Total Members
                  </p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {group.telegram?.memberCount || "N/A"}
                  </p>
                </div>
                <Users className="w-8 h-8 text-cyan-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60 mb-1">Fee</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {group.fee_percentage !== undefined
                      ? `${group.fee_percentage}%`
                      : "N/A"}
                  </p>
                </div>
                <Shield className="w-8 h-8 text-yellow-400/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Group Details */}
        <Card className="border-purple-500/20 backdrop-blur-md bg-gradient-to-br from-purple-950/10 to-transparent mb-8">
          <CardHeader>
            <CardTitle className="text-2xl text-purple-300">
              Group Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pool PDA */}
              <div>
                <label className="text-sm text-foreground/60 mb-2 block">
                  Pool PDA
                </label>
                <div className="flex items-center gap-2 bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                  <span className="flex-1 font-mono text-sm break-all text-foreground/90">
                    {group.pool_pda}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(group.pool_pda, "pool_pda")}
                    className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30"
                  >
                    {copiedField === "pool_pda" ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Subscription Model */}
              <div>
                <label className="text-sm text-foreground/60 mb-2 block">
                  Subscription Model
                </label>
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                  {group.subscription_model !== undefined ? (
                    <Badge
                      className={
                        group.subscription_model
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }
                    >
                      {group.subscription_model ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" /> Yes
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-1" /> No
                        </>
                      )}
                    </Badge>
                  ) : (
                    <span className="text-foreground/40">N/A</span>
                  )}
                </div>
              </div>

              {/* Created Date */}
              <div>
                <label className="text-sm text-foreground/60 mb-2 block">
                  Created Date
                </label>
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-400" />
                    <span className="font-semibold text-foreground">
                      {formatDate(group.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin Names */}
              <div className="md:col-span-2">
                <label className="text-sm text-foreground/60 mb-2 block">
                  Admins ({group.admin.length})
                </label>
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex flex-wrap gap-2">
                    {group.admin.map((adminId, index) => (
                      <Badge
                        key={index}
                        className="bg-purple-600/20 text-purple-300 border-purple-500/30"
                      >
                        {adminId}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60 mb-1">
                    Wallet Balance
                  </p>
                  <p className="text-2xl font-bold text-green-400">
                    {group.wallet_balance_sol
                      ? `${Number(group.wallet_balance_sol).toFixed(4)} SOL`
                      : "N/A"}
                  </p>
                </div>
                <Coins className="w-8 h-8 text-green-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60 mb-1">
                    Total Orders
                  </p>
                  <p className="text-2xl font-bold text-blue-400">
                    {orders.length}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-blue-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60 mb-1">
                    Completed Orders
                  </p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {orders.filter((o) => o.status === "completed").length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-cyan-400/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Holdings Overview */}
        <Card className="border-purple-500/20 backdrop-blur-md bg-gradient-to-br from-purple-950/10 to-transparent mb-8">
          <CardHeader>
            <CardTitle className="text-2xl text-purple-300">
              Holdings Overview{" "}
              {network && (
                <span className="text-sm text-foreground/50">({network})</span>
              )}
            </CardTitle>
            <CardDescription className="text-foreground/60">
              Aggregated balances and activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-4">
                <p className="text-sm text-foreground/60 mb-1">Wallet (SOL)</p>
                <p className="text-2xl font-bold text-foreground">
                  {group.wallet_balance_sol
                    ? Number(group.wallet_balance_sol).toFixed(4)
                    : "N/A"}
                </p>
              </div>
              <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-4">
                <p className="text-sm text-foreground/60 mb-1">
                  Invested (SOL)
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {statistics?.total_sol_invested !== undefined
                    ? statistics.total_sol_invested.toFixed(2)
                    : "N/A"}
                </p>
              </div>
              <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-4">
                <p className="text-sm text-foreground/60 mb-1">
                  Active / Sold Orders
                </p>
                {statistics ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {statistics.total_active_orders} active
                    </Badge>
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      {statistics.total_sold_orders} sold
                    </Badge>
                  </div>
                ) : (
                  <span className="text-foreground/40">N/A</span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-purple-500/20">
                    <TableHead className="text-purple-300">Token</TableHead>
                    <TableHead className="text-purple-300">
                      Total Tokens
                    </TableHead>
                    <TableHead className="text-purple-300">
                      Invested (SOL)
                    </TableHead>
                    <TableHead className="text-purple-300">Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!tokenHoldings || tokenHoldings.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-6 text-foreground/60"
                      >
                        No token holdings available
                      </TableCell>
                    </TableRow>
                  ) : (
                    tokenHoldings.map((t, idx) => (
                      <TableRow
                        key={`${t.token_symbol}-${idx}`}
                        className="border-purple-500/10"
                      >
                        <TableCell>
                          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/30">
                            {t.token_symbol}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {Number(t.total_tokens ?? 0).toFixed(4)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {Number(t.total_invested ?? 0).toFixed(4)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-400" />
                            <span className="font-semibold text-blue-400">
                              {Number(t.order_count ?? 0)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Trading History */}
        <Card className="border-purple-500/20 backdrop-blur-md bg-gradient-to-br from-purple-950/10 to-transparent">
          <CardHeader>
            <CardTitle className="text-xl text-purple-300">
              Order History ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-purple-500/20">
                    <TableHead className="text-purple-300">Order ID</TableHead>
                    <TableHead className="text-purple-300">
                      Proposal ID
                    </TableHead>
                    <TableHead className="text-purple-300">Token</TableHead>
                    <TableHead className="text-purple-300">
                      Amount Spent
                    </TableHead>
                    <TableHead className="text-purple-300">
                      Token Amount
                    </TableHead>
                    <TableHead className="text-purple-300">Fees</TableHead>
                    <TableHead className="text-purple-300">
                      Executed By
                    </TableHead>
                    <TableHead className="text-purple-300">
                      Transaction
                    </TableHead>
                    <TableHead className="text-purple-300">Status</TableHead>
                    <TableHead className="text-purple-300">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="text-center py-8 text-foreground/60"
                      >
                        No orders found for this group
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow
                        key={order.order_id}
                        className="border-purple-500/10"
                      >
                        <TableCell className="font-mono text-sm">
                          #{order.order_id}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/30">
                            #{order.proposal_id}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/30">
                            {order.token_symbol}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {typeof order.total_amount_spent === "number"
                            ? order.total_amount_spent.toFixed(2)
                            : Number(order.total_amount_spent || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {typeof order.token_amount === "number"
                            ? order.token_amount.toFixed(2)
                            : Number(order.token_amount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-foreground/60">
                          {typeof order.fees === "number"
                            ? order.fees.toFixed(4)
                            : Number(order.fees || 0).toFixed(4)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {order.executed_by}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">
                              {truncateAddress(order.transaction_hash, 4)}
                            </span>
                            <Button
                              size="sm"
                              onClick={() =>
                                copyToClipboard(
                                  order.transaction_hash,
                                  `tx_${order.order_id}`
                                )
                              }
                              className="h-6 w-6 p-0 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30"
                            >
                              {copiedField === `tx_${order.order_id}` ? (
                                <CheckCircle className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              order.status === "completed"
                                ? "bg-green-500/20 text-green-400 border-green-500/30"
                                : order.status === "pending"
                                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                : "bg-red-500/20 text-red-400 border-red-500/30"
                            }
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(order.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* GraphComment Section */}
        <Card className="border-purple-500/20 backdrop-blur-md bg-gradient-to-br from-purple-950/10 to-transparent mt-8">
          <CardHeader>
            <CardTitle className="text-2xl font-sentient font-bold text-white">
              Community Reputation Depends on You
            </CardTitle>
            <CardDescription className="text-foreground/60">
              Share your thoughts about this group with the community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div id="graphcomment"></div>
          </CardContent>
        </Card>
      </div>

      {/* GraphComment Scripts */}
      <Script id="graphcomment-config" strategy="afterInteractive">
        {`
          window.__semio__params = {
            graphcommentId: "solcircle",
            behaviour: {
              uid: "${tgid}", // unique identifier for each group's comments thread
            },
          };

          function __semio__onload() {
            __semio__gc_graphlogin(__semio__params);
          }
        `}
      </Script>
      <Script
        src={`https://integration.graphcomment.com/gc_graphlogin.js?${Date.now()}`}
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof window !== "undefined" && (window as any).__semio__onload) {
            (window as any).__semio__onload();
          }
        }}
      />
    </>
  );
}
