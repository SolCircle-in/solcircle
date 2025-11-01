"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Activity
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
}

interface Participant {
  utgid: string;
  tgid: string;
  role: string;
  joined_at: string;
  left_at: string | null;
  custodial_pkey: string;
  main_pkey: string;
  user_status: string;
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

// Holdings types (from /api/groups/:tgid/holdings)
interface TokenOrderSummary {
  order_id: string;
  tokens: number;
  invested: number;
  bought_at_price: number;
  participants: number;
  date: string;
}

interface TokenHolding {
  token_symbol?: string;
  symbol?: string;
  token?: string;
  mint?: string;
  total_tokens: number;
  total_invested: number;
  order_count: number;
  orders: TokenOrderSummary[];
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tgid = params.tgid as string;
  
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  // Holdings state
  const [walletBalanceSol, setWalletBalanceSol] = useState<number | undefined>(undefined);
  const [walletBalanceLamports, setWalletBalanceLamports] = useState<number | undefined>(undefined);
  const [statsInvestedSol, setStatsInvestedSol] = useState<number | undefined>(undefined);
  const [statsActiveOrders, setStatsActiveOrders] = useState<number | undefined>(undefined);
  const [statsSoldOrders, setStatsSoldOrders] = useState<number | undefined>(undefined);
  const [statsParticipants, setStatsParticipants] = useState<number | undefined>(undefined);
  const [statsUniqueTokens, setStatsUniqueTokens] = useState<number | undefined>(undefined);
  const [tokenHoldings, setTokenHoldings] = useState<TokenHolding[] | undefined>(undefined);
  const [network, setNetwork] = useState<string | undefined>(undefined);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (tgid) {
      fetchGroupDetails();
      fetchParticipants();
      fetchOrders();
      fetchHoldings();
    }
  }, [tgid]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      // Fetch group details with Telegram info included
      const response = await fetch(`http://localhost:8000/api/groups/${tgid}?includeGroupInfo=true`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch group details");
      }

      const data = await response.json();
      
      if (data.success) {
        setGroup(data.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/groups/${tgid}/participants`);
      const data = await response.json();
      console.log("Participants API Response:", data);
      if (data.success) {
        console.log("Participants data:", data.data);
        setParticipants(data.data);
      } else {
        console.log("Participants API returned success: false");
      }
    } catch (err) {
      console.error("Failed to fetch participants:", err);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/groups/${tgid}/orders`);
      const data = await response.json();
      console.log("Orders API Response:", data);
      if (data.success) {
        console.log("Orders data:", data.data);
        setOrders(data.data);
      } else {
        console.log("Orders API returned success: false");
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  };

  const fetchHoldings = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/groups/${tgid}/holdings`);
      const data = await response.json();
      console.log("Holdings API Response:", data);
      if (data?.success && data.data) {
        const h = data.data;
        const wSol = Number(h.group?.wallet_balance_sol ?? 0);
        const wLamports = Number(h.group?.wallet_balance_lamports ?? 0);
        const invested = Number(h.statistics?.total_sol_invested ?? 0);
        const active = Number(h.statistics?.total_active_orders ?? 0);
        const sold = Number(h.statistics?.total_sold_orders ?? 0);
        const participantsCount = Number(h.statistics?.total_participants ?? 0);
        const uniqueTokens = Number(h.statistics?.unique_tokens ?? 0);
        const tokens = (h.token_holdings ?? []) as TokenHolding[];
        const net = h.network as string | undefined;

        setWalletBalanceSol(wSol);
        setWalletBalanceLamports(wLamports);
        setStatsInvestedSol(invested);
        setStatsActiveOrders(active);
        setStatsSoldOrders(sold);
        setStatsParticipants(participantsCount);
        setStatsUniqueTokens(uniqueTokens);
        setTokenHoldings(tokens);
        setNetwork(net);

        // If total_members is missing on group but stats provides it, backfill
        if (!group?.total_members && participantsCount && setGroup) {
          setGroup((prev) => (prev ? { ...prev, total_members: participantsCount } : prev));
        }
      } else {
        console.log("Holdings API returned success: false");
      }
    } catch (err) {
      console.error("Failed to fetch holdings:", err);
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
      const resp = await fetch(`http://localhost:8000/api/groups/${encodeURIComponent(tgid)}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinRequest: true }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success || !data?.invite_link) {
        throw new Error(data?.error || 'Failed to create invite link');
      }
      window.location.href = data.invite_link as string;
    } catch (err) {
      console.error('Join error:', err);
      alert(err instanceof Error ? err.message : 'Failed to create invite link');
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
              <CardTitle className="text-red-400">Error Loading Group</CardTitle>
              <CardDescription className="text-red-300">{error || "Group not found"}</CardDescription>
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

  const profitLoss = Number(group.profit_loss);
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
                <span className="text-blue-400 text-sm">@{group.telegram.username}</span>
              )}
            </div>
            {group.telegram?.description && (
              <p className="text-foreground/70 text-sm mt-2 max-w-2xl">{group.telegram.description}</p>
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
              {joining ? 'Joining…' : 'Join Group'}
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
                    <div className={`text-2xl font-bold flex items-center gap-2 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                      {isProfit ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                      {isProfit ? '+' : ''}{profitLoss}%
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
                    {group.total_pool !== undefined ? `${group.total_pool} SOL` : 'N/A'}
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
                  <p className="text-sm text-foreground/60 mb-1">Total Members</p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {group.total_members !== undefined ? group.total_members : 'N/A'}
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
                    {group.fee_percentage !== undefined ? `${group.fee_percentage}%` : 'N/A'}
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
            <CardTitle className="text-2xl text-purple-300">Group Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pool PDA */}
              <div>
                <label className="text-sm text-foreground/60 mb-2 block">Pool PDA</label>
                <div className="flex items-center gap-2 bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                  <span className="flex-1 font-mono text-sm break-all text-foreground/90">
                    {group.pool_pda}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(group.pool_pda, 'pool_pda')}
                    className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30"
                  >
                    {copiedField === 'pool_pda' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Relay Account */}
              <div>
                <label className="text-sm text-foreground/60 mb-2 block">Relay Account</label>
                <div className="flex items-center gap-2 bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                  <span className="flex-1 font-mono text-sm break-all text-foreground/90">
                    {group.relay_account}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(group.relay_account, 'relay_account')}
                    className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30"
                  >
                    {copiedField === 'relay_account' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Min Stake */}
              <div>
                <label className="text-sm text-foreground/60 mb-2 block">Minimum Stake</label>
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                  <span className="font-semibold text-lg text-foreground">{group.min_stake} SOL</span>
                </div>
              </div>

              {/* Cooldown Period */}
              <div>
                <label className="text-sm text-foreground/60 mb-2 block">Cooldown Period</label>
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                  <span className="font-semibold text-lg text-foreground">{formatCooldown(group.cooldown_period)}</span>
                </div>
              </div>

              {/* Subscription Model */}
              <div>
                <label className="text-sm text-foreground/60 mb-2 block">Subscription Model</label>
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                  {group.subscription_model !== undefined ? (
                    <Badge className={group.subscription_model ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                      {group.subscription_model ? (
                        <><CheckCircle className="w-4 h-4 mr-1" /> Yes</>
                      ) : (
                        <><XCircle className="w-4 h-4 mr-1" /> No</>
                      )}
                    </Badge>
                  ) : (
                    <span className="text-foreground/40">N/A</span>
                  )}
                </div>
              </div>

              {/* Created Date */}
              <div>
                <label className="text-sm text-foreground/60 mb-2 block">Created Date</label>
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-400" />
                    <span className="font-semibold text-foreground">{formatDate(group.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Admin Names */}
              <div className="md:col-span-2">
                <label className="text-sm text-foreground/60 mb-2 block">Admins ({group.admin.length})</label>
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex flex-wrap gap-2">
                    {group.admin.map((adminId, index) => (
                      <Badge key={index} className="bg-purple-600/20 text-purple-300 border-purple-500/30">
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
                  <p className="text-sm text-foreground/60 mb-1">Active Members</p>
                  <p className="text-2xl font-bold text-green-400">
                    {participants.filter(p => p.user_status === "active").length}
                  </p>
                </div>
                <Users className="w-8 h-8 text-green-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60 mb-1">Total Orders</p>
                  <p className="text-2xl font-bold text-blue-400">{orders.length}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60 mb-1">Completed Orders</p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {orders.filter(o => o.status === "completed").length}
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
            <CardTitle className="text-2xl text-purple-300">Holdings Overview {network ? <span className="text-sm text-foreground/50">({network})</span> : null}</CardTitle>
            <CardDescription className="text-foreground/60">Aggregated balances and activity from holdings API</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-4">
                <p className="text-sm text-foreground/60 mb-1">Wallet (SOL)</p>
                <p className="text-2xl font-bold text-foreground">{walletBalanceSol !== undefined ? walletBalanceSol.toFixed(4) : 'N/A'}</p>
              </div>
              <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-4">
                <p className="text-sm text-foreground/60 mb-1">Invested (SOL)</p>
                <p className="text-2xl font-bold text-foreground">{statsInvestedSol !== undefined ? statsInvestedSol.toFixed(2) : 'N/A'}</p>
              </div>
              <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-4">
                <p className="text-sm text-foreground/60 mb-1">Active / Sold Orders</p>
                {statsActiveOrders !== undefined && statsSoldOrders !== undefined ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{statsActiveOrders} active</Badge>
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{statsSoldOrders} sold</Badge>
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
                    <TableHead className="text-purple-300">Total Tokens</TableHead>
                    <TableHead className="text-purple-300">Invested (SOL)</TableHead>
                    <TableHead className="text-purple-300">Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!tokenHoldings || tokenHoldings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-foreground/60">No token holdings available</TableCell>
                    </TableRow>
                  ) : (
                    tokenHoldings.map((t, idx) => {
                      const label = (t.token_symbol || t.symbol || t.token || t.mint || 'Token');
                      return (
                        <TableRow key={`${label}-${idx}`} className="border-purple-500/10">
                          <TableCell>
                            <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/30">{label}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{Number(t.total_tokens ?? 0).toFixed(4)}</TableCell>
                          <TableCell className="font-mono text-sm">{Number(t.total_invested ?? 0).toFixed(4)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-blue-400" />
                              <span className="font-semibold text-blue-400">{Number(t.order_count ?? 0)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Participants and Orders */}
        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="bg-purple-950/20 border border-purple-500/20 backdrop-blur-md">
            <TabsTrigger value="participants">
              Participants ({participants.length})
            </TabsTrigger>
            <TabsTrigger value="orders">
              Trading History ({orders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="participants">
            <Card className="border-purple-500/20 backdrop-blur-md bg-gradient-to-br from-purple-950/10 to-transparent">
              <CardHeader>
                <CardTitle className="text-xl text-purple-300">Group Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-purple-500/20">
                        <TableHead className="text-purple-300">User ID</TableHead>
                        <TableHead className="text-purple-300">Role</TableHead>
                        <TableHead className="text-purple-300">Joined</TableHead>
                        <TableHead className="text-purple-300">Left</TableHead>
                        <TableHead className="text-purple-300">Status</TableHead>
                        <TableHead className="text-purple-300">Custodial Key</TableHead>
                        <TableHead className="text-purple-300">Main Key</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-foreground/60">
                            No participants found for this group
                          </TableCell>
                        </TableRow>
                      ) : (
                        participants.map((participant) => (
                          <TableRow key={participant.utgid} className="border-purple-500/10">
                            <TableCell className="font-mono text-sm">{participant.utgid}</TableCell>
                            <TableCell>
                              <Badge className={
                                participant.role === "owner" 
                                  ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                  : participant.role === "admin"
                                  ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                                  : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                              }>
                                {participant.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{formatDate(participant.joined_at)}</TableCell>
                            <TableCell className="text-sm">
                              {participant.left_at ? (
                                <span className="text-red-400">{formatDate(participant.left_at)}</span>
                              ) : (
                                <span className="text-foreground/40">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                participant.user_status === "active"
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                              }>
                                {participant.user_status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{truncateAddress(participant.custodial_pkey, 4)}</span>
                                <Button
                                  size="sm"
                                  onClick={() => copyToClipboard(participant.custodial_pkey, `custodial_${participant.utgid}`)}
                                  className="h-6 w-6 p-0 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30"
                                >
                                  {copiedField === `custodial_${participant.utgid}` ? (
                                    <CheckCircle className="w-3 h-3 text-green-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{truncateAddress(participant.main_pkey, 4)}</span>
                                <Button
                                  size="sm"
                                  onClick={() => copyToClipboard(participant.main_pkey, `main_${participant.utgid}`)}
                                  className="h-6 w-6 p-0 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30"
                                >
                                  {copiedField === `main_${participant.utgid}` ? (
                                    <CheckCircle className="w-3 h-3 text-green-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </Button>
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
          </TabsContent>

          <TabsContent value="orders">
            <Card className="border-purple-500/20 backdrop-blur-md bg-gradient-to-br from-purple-950/10 to-transparent">
              <CardHeader>
                <CardTitle className="text-xl text-purple-300">Order History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-purple-500/20">
                        <TableHead className="text-purple-300">Order ID</TableHead>
                        <TableHead className="text-purple-300">Proposal ID</TableHead>
                        <TableHead className="text-purple-300">Token</TableHead>
                        <TableHead className="text-purple-300">Amount Spent</TableHead>
                        <TableHead className="text-purple-300">Token Amount</TableHead>
                        <TableHead className="text-purple-300">Fees</TableHead>
                        <TableHead className="text-purple-300">Participants</TableHead>
                        <TableHead className="text-purple-300">Executed By</TableHead>
                        <TableHead className="text-purple-300">Transaction</TableHead>
                        <TableHead className="text-purple-300">Status</TableHead>
                        <TableHead className="text-purple-300">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8 text-foreground/60">
                            No orders found for this group
                          </TableCell>
                        </TableRow>
                      ) : (
                        orders.map((order) => (
                          <TableRow key={order.order_id} className="border-purple-500/10">
                            <TableCell className="font-mono text-sm">#{order.order_id}</TableCell>
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
                              {typeof order.total_amount_spent === 'number' 
                                ? order.total_amount_spent.toFixed(2) 
                                : Number(order.total_amount_spent || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {typeof order.token_amount === 'number' 
                                ? order.token_amount.toFixed(2) 
                                : Number(order.token_amount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm text-foreground/60">
                              {typeof order.fees === 'number' 
                                ? order.fees.toFixed(4) 
                                : Number(order.fees || 0).toFixed(4)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4 text-cyan-400" />
                                <span className="font-semibold text-cyan-400">{order.participant_count}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {order.executed_by}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{truncateAddress(order.transaction_hash, 4)}</span>
                                <Button
                                  size="sm"
                                  onClick={() => copyToClipboard(order.transaction_hash, `tx_${order.order_id}`)}
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
                              <Badge className={
                                order.status === "completed"
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : order.status === "pending"
                                  ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                  : "bg-red-500/20 text-red-400 border-red-500/30"
                              }>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{formatDate(order.created_at)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
