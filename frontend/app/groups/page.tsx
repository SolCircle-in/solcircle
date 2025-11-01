"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, TrendingUp, TrendingDown, ArrowUpDown, Eye, Shield } from "lucide-react";
import { GL } from "@/components/gl";

interface TokenOrderSummary {
  order_id: string;
  tokens: number;
  invested: number;
  bought_at_price: number;
  participants: number;
  date: string;
}

interface TokenHolding {
  token_symbol: string;
  total_tokens: number;
  total_invested: number;
  order_count: number;
  orders: TokenOrderSummary[];
}

interface TelegramInfo {
  title: string;
  description?: string;
  username?: string;
  memberCount?: number;
  type?: string;
}

interface Group {
  tgid: string;
  relay_account: string;
  pool_pda: string;
  owner: string;
  admin: string[];
  cooldown_period: number;
  min_stake: number;
  status: string;
  created_at: string;
  // derived / optional
  total_members?: number;
  profit_loss?: number;
  // holdings endpoint derived fields
  wallet_balance_sol?: number;
  wallet_balance_lamports?: number;
  stats_total_sol_invested?: number;
  stats_total_active_orders?: number;
  stats_total_sold_orders?: number;
  stats_total_participants?: number;
  stats_unique_tokens?: number;
  token_holdings?: TokenHolding[];
  network?: string;
  // Telegram info
  telegram?: TelegramInfo;
}

interface GroupsResponse {
  success: boolean;
  count: number;
  data: Group[];
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      // Fetch groups with Telegram info included
      const response = await fetch("http://localhost:8000/api/groups?includeGroupInfo=true");
      
      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }

      const data: GroupsResponse = await response.json();
      
      if (data.success) {
        // Fetch participant counts and holdings for each group
        const enrichedGroups = await Promise.all(
          data.data.map(async (group) => {
            let total_members = 0;
            let wallet_balance_sol: number | undefined;
            let wallet_balance_lamports: number | undefined;
            let stats_total_sol_invested: number | undefined;
            let stats_total_active_orders: number | undefined;
            let stats_total_sold_orders: number | undefined;
            let stats_total_participants: number | undefined;
            let stats_unique_tokens: number | undefined;
            let token_holdings: TokenHolding[] | undefined;
            let network: string | undefined;

            try {
              // Fetch participants
              const participantsResponse = await fetch(
                `http://localhost:8000/api/groups/${group.tgid}/participants`
              );
              const participantsData = await participantsResponse.json();
              if (participantsData?.success) {
                total_members = participantsData.count || participantsData.data?.length || 0;
              }
            } catch (err) {
              console.error(`Failed to fetch participants for group ${group.tgid}:`, err);
            }

            try {
              // Fetch holdings
              const holdingsResponse = await fetch(
                `http://localhost:8000/api/groups/${group.tgid}/holdings`
              );
              const holdingsJson = await holdingsResponse.json();
              if (holdingsJson?.success && holdingsJson.data) {
                const h = holdingsJson.data;
                wallet_balance_sol = Number(h.group?.wallet_balance_sol ?? 0);
                wallet_balance_lamports = Number(h.group?.wallet_balance_lamports ?? 0);
                stats_total_sol_invested = Number(h.statistics?.total_sol_invested ?? 0);
                stats_total_active_orders = Number(h.statistics?.total_active_orders ?? 0);
                stats_total_sold_orders = Number(h.statistics?.total_sold_orders ?? 0);
                stats_total_participants = Number(h.statistics?.total_participants ?? 0);
                stats_unique_tokens = Number(h.statistics?.unique_tokens ?? 0);
                token_holdings = (h.token_holdings ?? []) as TokenHolding[];
                network = h.network;

                // Prefer API-provided participants count if we didn't get it above
                if (!total_members && stats_total_participants) {
                  total_members = stats_total_participants;
                }
              }
            } catch (err) {
              console.error(`Failed to fetch holdings for group ${group.tgid}:`, err);
            }

            return {
              ...group,
              total_members,
              wallet_balance_sol,
              wallet_balance_lamports,
              stats_total_sol_invested,
              stats_total_active_orders,
              stats_total_sold_orders,
              stats_total_participants,
              stats_unique_tokens,
              token_holdings,
              network,
            };
          })
        );
        
        setGroups(enrichedGroups);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (tgid: string) => {
    try {
      setJoining(tgid);
      const response = await fetch(`http://localhost:8000/api/groups/${encodeURIComponent(tgid)}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinRequest: true }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success || !data?.invite_link) {
        throw new Error(data?.error || 'Failed to create invite link');
      }
      // Redirect the user to Telegram invite link
      window.location.href = data.invite_link as string;
    } catch (err) {
      console.error('Join error:', err);
      alert(err instanceof Error ? err.message : 'Failed to create invite link');
    } finally {
      setJoining(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
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

  if (loading) {
    return (
      <>
        <GL hovering={false} />
        <div className="relative z-10 container mx-auto px-4 py-8 pt-24 md:pt-32">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-4" />
            <Skeleton className="h-6 w-96" />
          </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-purple-500/20 backdrop-blur-md bg-gradient-to-br from-purple-950/10 to-transparent">
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <GL hovering={false} />
        <div className="relative z-10 container mx-auto px-4 py-8 pt-24 md:pt-32">
          <Card className="border-red-500/20 bg-red-950/10 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-red-400">Error Loading Groups</CardTitle>
              <CardDescription className="text-red-300">{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={fetchGroups} className="border-red-500/50">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <GL hovering={false} />
      <div className="relative z-10 container mx-auto px-4 py-8 pt-24 md:pt-32 min-h-screen">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 font-mono">
            Verified Groups
          </h1>
        <p className="text-foreground/60 text-lg">
          Explore {groups.length} active trading groups on SolCircle
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/60 mb-1">Total Groups</p>
                <p className="text-3xl font-bold text-purple-400">{groups.length}</p>
              </div>
              <Users className="w-8 h-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/60 mb-1">Active Status</p>
                <p className="text-3xl font-bold text-green-400">
                  {groups.filter((g) => g.status === "active").length}
                </p>
              </div>
              <Shield className="w-8 h-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/60 mb-1">Total Admins</p>
                <p className="text-3xl font-bold text-blue-400">
                  {groups.reduce((acc, g) => acc + g.admin.length, 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups Table */}
      <Card className="border-purple-500/20 backdrop-blur-md bg-gradient-to-br from-purple-950/10 to-transparent">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-purple-500/20 hover:bg-purple-500/5">
                  <TableHead className="text-purple-300 font-semibold">Rank</TableHead>
                  <TableHead className="text-purple-300 font-semibold">Group Name</TableHead>
                  <TableHead className="text-purple-300 font-semibold">Group ID</TableHead>
                  <TableHead className="text-purple-300 font-semibold">
                    <div className="flex items-center gap-2">
                      P/L (%)
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-purple-300 font-semibold">Total Members</TableHead>
                  <TableHead className="text-purple-300 font-semibold">Wallet (SOL)</TableHead>
                  <TableHead className="text-purple-300 font-semibold">Invested (SOL)</TableHead>
                  <TableHead className="text-purple-300 font-semibold">Active/Sold</TableHead>
                  <TableHead className="text-purple-300 font-semibold">Tokens</TableHead>
                  <TableHead className="text-purple-300 font-semibold">Created</TableHead>
                  <TableHead className="text-purple-300 font-semibold">Status</TableHead>
                  <TableHead className="text-purple-300 font-semibold text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups
                  .sort((a, b) => {
                    const aProfit = a.profit_loss !== undefined ? Number(a.profit_loss) : -Infinity;
                    const bProfit = b.profit_loss !== undefined ? Number(b.profit_loss) : -Infinity;
                    return bProfit - aProfit;
                  })
                  .map((group, index) => {
                    const profitLoss = group.profit_loss !== undefined ? Number(group.profit_loss) : 0;
                    const isProfit = profitLoss >= 0;
                    
                    return (
                      <TableRow 
                        key={group.tgid} 
                        className="border-purple-500/10 hover:bg-purple-500/5 transition-colors"
                      >
                        <TableCell className="font-mono text-purple-400 font-bold">
                          #{index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-foreground font-semibold">
                              {group.telegram?.title || `Group ${group.tgid.slice(-6)}`}
                            </span>
                            {group.telegram?.username && (
                              <span className="text-xs text-blue-400">@{group.telegram.username}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          <div className="flex flex-col">
                            <span className="text-foreground/90">{group.tgid.slice(-8)}</span>
                            <span className="text-xs text-foreground/40">{group.tgid}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {group.profit_loss !== undefined ? (
                            <div className={`flex items-center gap-1 font-semibold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                              {isProfit ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              {isProfit ? '+' : ''}{profitLoss}%
                            </div>
                          ) : (
                            <span className="text-foreground/40 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {group.total_members !== undefined ? (
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-blue-400" />
                              <span className="font-semibold">{group.total_members}</span>
                            </div>
                          ) : (
                            <span className="text-foreground/40 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          {group.wallet_balance_sol !== undefined ? (
                            <span className="text-foreground font-semibold">
                              {Number(group.wallet_balance_sol).toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-foreground/40 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          {group.stats_total_sol_invested !== undefined ? (
                            <span className="text-foreground font-semibold">
                              {Number(group.stats_total_sol_invested).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-foreground/40 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {group.stats_total_active_orders !== undefined && group.stats_total_sold_orders !== undefined ? (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{group.stats_total_active_orders} active</Badge>
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{group.stats_total_sold_orders} sold</Badge>
                            </div>
                          ) : (
                            <span className="text-foreground/40 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {group.token_holdings && group.token_holdings.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {group.token_holdings.slice(0, 3).map((t, idx) => {
                                const anyT = t as any;
                                const label: string = anyT.token_symbol ?? anyT.symbol ?? anyT.token ?? anyT.mint ?? "Token";
                                return (
                                  <Badge key={`${label}-${idx}`} className="bg-purple-600/20 text-purple-300 border-purple-500/30">
                                    {label}
                                  </Badge>
                                );
                              })}
                              {group.token_holdings.length > 3 && (
                                <span className="text-xs text-foreground/60">+{group.token_holdings.length - 3} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-foreground/40 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-foreground/80">
                          {formatDate(group.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={group.status === "active" ? "default" : "secondary"}
                            className={
                              group.status === "active"
                                ? "bg-green-500/20 text-green-400 border-green-500/30"
                                : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                            }
                          >
                            {group.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link href={`/groups/${encodeURIComponent(group.tgid)}`}>
                              <Button
                                size="sm"
                                className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              disabled={joining === group.tgid}
                              onClick={() => handleJoin(group.tgid)}
                              className="bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300"
                            >
                              {joining === group.tgid ? 'Joining…' : 'Join'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {groups.length === 0 && !loading && (
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/10 to-transparent backdrop-blur-md">
          <CardContent className="py-16 text-center">
            <Users className="w-16 h-16 text-purple-400/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground/80 mb-2">
              No Groups Found
            </h3>
            <p className="text-foreground/60">
              There are no verified groups available at the moment.
            </p>
          </CardContent>
        </Card>
      )}
      </div>
    </>
  );
}
