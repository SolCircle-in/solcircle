"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { LogOut, Wallet, Send, X } from "lucide-react"
import { GL } from "@/components/gl"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from "@solana/web3.js"

interface UserData {
  walletAddress: string
  telegramHandle: string
  telegramId: string
  connectedAt: string
  custodial_pub: string
  custodial_balance: string
  groups: any[]
  telegramusername: string
}

const TABS = [
  { key: "orders", label: "Current Orders" },
  { key: "proposals", label: "Last Proposals" },
];

const REGISTRATION_API_URL = process.env.NEXT_PUBLIC_REGISTRATION_API_URL || "";

export default function DashboardPage() {
  const router = useRouter()
  const { connection } = useConnection()
  const { publicKey, sendTransaction, connected } = useWallet()
  const { setVisible } = useWalletModal()

  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovering, setHovering] = useState(false)
  const [custodials, setCustodials] = useState<Array<any>>([])
  const [custLoading, setCustLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [proposals, setProposals] = useState<any[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);

  // Modal states
  const [showAddFundsModal, setShowAddFundsModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [amount, setAmount] = useState("")
  const [txLoading, setTxLoading] = useState(false)
  const [txError, setTxError] = useState("")
  const [txSuccess, setTxSuccess] = useState("")

  useEffect(() => {
    const stored = localStorage.getItem("solana_vote_user")
    if (stored) {
      setUserData(JSON.parse(stored))
    } else {
      router.push("/register")
    }
    setLoading(false)
    fetchCustodials()
  }, [router])

  async function fetchCustodials() {
    setCustLoading(true)
    try {
      const telegram = JSON.parse(localStorage.getItem("solana_vote_user") || "{}").telegramHandle
      const q = telegram ? `?telegram_user_id=${encodeURIComponent(telegram)}` : ""
      const res = await fetch(`/api/custodial-wallets${q}`)
      if (!res.ok) throw new Error("Failed to fetch custodials")
      const data = await res.json()
      setCustodials(data.wallets || [])
    } catch (e) {
      // ignore
    } finally {
      setCustLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("solana_vote_user")
    router.push("/")
  }

  const handleAddFunds = async () => {
    if (!connected || !publicKey) {
      setVisible(true)
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setTxError("Please enter a valid amount")
      return
    }

    setTxLoading(true)
    setTxError("")
    setTxSuccess("")

    try {
      const custodialPubkey = new PublicKey(userData?.custodial_pub || "")
      const lamports = parseFloat(amount) * LAMPORTS_PER_SOL

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: custodialPubkey,
          lamports,
        })
      )

      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, "confirmed")

      setTxSuccess(`Successfully added ${amount} SOL! Tx: ${signature.slice(0, 8)}...`)
      setAmount("")

      // Refresh balance after successful transaction
      setTimeout(() => {
        setShowAddFundsModal(false)
        setTxSuccess("")
        window.location.reload()
      }, 3000)
    } catch (error: any) {
      console.error("Add funds error:", error)
      setTxError(error.message || "Transaction failed")
    } finally {
      setTxLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (!connected || !publicKey) {
      setVisible(true)
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setTxError("Please enter a valid amount")
      return
    }

    setTxLoading(true)
    setTxError("")
    setTxSuccess("")

    try {
      // Call your backend API to initiate withdrawal from custodial wallet
      const response = await fetch(`${REGISTRATION_API_URL}/api/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telegram_user_id: userData?.telegramHandle,
          amount: parseFloat(amount),
          destination: publicKey.toString(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setTxSuccess(`Successfully withdrew ${amount} SOL!`)
        setAmount("")

        setTimeout(() => {
          setShowWithdrawModal(false)
          setTxSuccess("")
          window.location.reload()
        }, 3000)
      } else {
        throw new Error(data.error || "Withdrawal failed")
      }
    } catch (error: any) {
      console.error("Withdraw error:", error)
      setTxError(error.message || "Withdrawal failed")
    } finally {
      setTxLoading(false)
    }
  }

  useEffect(() => {
    if (!userData) return;
    if (activeTab === "orders") {
      setOrdersLoading(true);
      fetch(`${REGISTRATION_API_URL}/api/orders?telegram_user_id=${encodeURIComponent(userData.telegramHandle)}`)
        .then(res => res.json())
        .then(data => {
          setOrders(data.data || []);
        })
        .finally(() => setOrdersLoading(false));
    } else if (activeTab === "proposals") {
      setProposalsLoading(true);
      fetch(`${REGISTRATION_API_URL}/api/proposals/participated/${encodeURIComponent(userData.telegramId)}`)
        .then(res => res.json())
        .then(data => {
          setProposals(data.data || []);
        })
        .finally(() => setProposalsLoading(false));
    }
  }, [activeTab, userData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!userData) {
    return null
  }

  return (
    <main className="min-h-screen">
      <GL hovering={hovering} />

      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(0deg, transparent 24%, rgba(85, 85, 85, 0.05) 25%, rgba(85, 85, 85, 0.05) 26%, transparent 27%, transparent 74%, rgba(85, 85, 85, 0.05) 75%, rgba(85, 85, 85, 0.05) 76%, transparent 77%, transparent),
              linear-gradient(90deg, transparent 24%, rgba(85, 85, 85, 0.05) 25%, rgba(85, 85, 85, 0.05) 26%, transparent 27%, transparent 74%, rgba(85, 85, 85, 0.05) 75%, rgba(85, 85, 85, 0.05) 76%, transparent 77%, transparent)
            `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6 border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/assets/logo.png"
            alt="SolCircle Logo"
            width={40}
            height={40}
          />
          <span className="text-xl font-sentient font-bold tracking-tight">
            SolCircle
          </span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 font-mono text-sm text-red-400 hover:bg-red-950/30 border border-red-500/30 rounded-lg transition-all"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-6 md:px-12 py-12 max-w-7xl mx-auto">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div>
            <h1 className="text-4xl font-sentient font-bold mb-2">
              Welcome back!
            </h1>
            <p className="font-mono text-sm text-foreground/60">
              Your trading dashboard is ready
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Main Wallet */}
            <div className="p-6 bg-background border border-primary/30 rounded-lg">
              <div className="flex items-center gap-3 mb-4">
                <Wallet className="w-6 h-6 text-primary" />
                <h2 className="font-sentient font-bold text-lg">Main Wallet</h2>
              </div>
              <p className="font-mono text-sm text-primary break-all">
                {userData.walletAddress}
              </p>
            </div>

            {/* Telegram Linked */}
            <div className="p-6 bg-background border border-primary/30 rounded-lg">
              <div className="flex items-center gap-3 mb-4">
                <Send className="w-6 h-6 text-primary" />
                <h2 className="font-sentient font-bold text-lg">
                  Telegram Linked
                </h2>
              </div>
              <p className="font-mono font-semibold text-primary">
                @{userData.telegramHandle}
              </p>
              <p className="font-mono text-xs text-foreground/60 mt-1">
                ID: {userData.telegramId}
              </p>
            </div>

            {/* SolCircle Balance */}
            <div className="p-6 bg-background border border-primary/30 rounded-lg">
              <div className="flex items-center gap-3 mb-4">
                <Wallet className="w-6 h-6 text-primary" />
                <h2 className="font-sentient font-bold text-lg">
                  SolCircle Balance
                </h2>
              </div>
              <p className="text-2xl font-sentient font-semibold mb-4">
                {userData.custodial_balance}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddFundsModal(true)}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                  onMouseEnter={() => setHovering(true)}
                  onMouseLeave={() => setHovering(false)}
                >
                  Add Funds
                </button>
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="flex-1 px-4 py-2 border border-primary text-primary font-mono text-sm font-semibold rounded-lg hover:bg-primary/5 transition-colors"
                  onMouseEnter={() => setHovering(true)}
                  onMouseLeave={() => setHovering(false)}
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>

          {/* Your Groups */}
          {userData.groups && userData.groups.length > 0 && (
            <div className="mt-6">
              <h3 className="font-sentient text-lg font-bold mb-3">
                Your Groups
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userData.groups.map((group: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 bg-background border border-border rounded-lg"
                  >
                    <div className="font-mono font-semibold">
                      {group.name || `Group ${idx + 1}`}
                    </div>
                    <div className="font-mono text-xs text-foreground/60 mt-1">
                      {group.description || "No description"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs Section */}
          <div className="mt-8">
            <div className="flex gap-2 mb-4">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`px-4 py-2 font-mono text-sm font-semibold rounded-lg transition-colors ${
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border text-foreground hover:border-primary/30"
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                  onMouseEnter={() => setHovering(true)}
                  onMouseLeave={() => setHovering(false)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === "orders" && (
                <div>
                  {ordersLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="p-6 bg-background border border-border rounded-lg text-center">
                      <p className="font-mono text-sm text-foreground/60">
                        No current orders.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {orders.map((order) => (
                        <div
                          key={order.order_id}
                          className="p-5 bg-gradient-to-br from-primary/10 to-background border border-primary/30 rounded-lg hover:border-primary/50 transition-all duration-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono font-bold text-primary">
                              #{order.order_id.slice(-6)}
                            </span>
                            <span
                              className={`px-2 py-1 rounded font-mono text-xs font-bold ${
                                order.status === "sold"
                                  ? "bg-red-950/30 text-red-400"
                                  : "bg-green-950/30 text-green-400"
                              }`}
                            >
                              {order.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="mb-2">
                            <span className="font-mono text-lg font-bold">
                              {order.token_symbol}
                            </span>
                            <span className="ml-2 font-mono text-xs text-foreground/60">
                              ({order.token_amount})
                            </span>
                          </div>
                          <div className="flex justify-between font-mono text-sm mb-2">
                            <span className="text-foreground/60">Spent:</span>
                            <span className="font-semibold">
                              {order.total_amount_spent} SOL
                            </span>
                          </div>
                          <div className="flex justify-between font-mono text-sm mb-2">
                            <span className="text-foreground/60">Fees:</span>
                            <span className="font-semibold">{order.fees}</span>
                          </div>
                          <div className="flex justify-between font-mono text-xs text-foreground/60 mb-1">
                            <span>Created:</span>
                            <span>
                              {new Date(order.created_at).toLocaleString()}
                            </span>
                          </div>
                          {order.closed_at && (
                            <div className="flex justify-between font-mono text-xs text-foreground/60 mb-1">
                              <span>Closed:</span>
                              <span>
                                {new Date(order.closed_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="font-mono text-xs text-foreground/60 truncate mt-2">
                            Tx: {order.transaction_hash}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "proposals" && (
                <div>
                  {proposalsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : proposals.length === 0 ? (
                    <div className="p-6 bg-background border border-border rounded-lg text-center">
                      <p className="font-mono text-sm text-foreground/60">
                        No proposals found.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {proposals.map((proposal) => (
                        <div
                          key={proposal.proposal_id}
                          className="p-5 bg-gradient-to-br from-primary/10 to-background border border-primary/30 rounded-lg hover:border-primary/50 transition-all duration-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono font-bold text-primary">
                              #{proposal.proposal_id.slice(-6)}
                            </span>
                            <span
                              className={`px-2 py-1 rounded font-mono text-xs font-bold ${
                                proposal.status === "approved"
                                  ? "bg-green-950/30 text-green-400"
                                  : proposal.status === "rejected"
                                  ? "bg-red-950/30 text-red-400"
                                  : "bg-foreground/10 text-foreground/60"
                              }`}
                            >
                              {proposal.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="mb-2">
                            <span className="font-mono text-lg font-bold">
                              {proposal.type.toUpperCase()}
                            </span>
                            <span className="ml-2 font-mono text-xs text-foreground/60">
                              {proposal.target_token || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between font-mono text-sm mb-2">
                            <span className="text-foreground/60">
                              Requested:
                            </span>
                            <span className="font-semibold">
                              {proposal.amount_requested || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between font-mono text-sm mb-2">
                            <span className="text-foreground/60">
                              Duration:
                            </span>
                            <span className="font-semibold">
                              {proposal.duration} min
                            </span>
                          </div>
                          <div className="flex justify-between font-mono text-xs text-foreground/60 mb-1">
                            <span>Created:</span>
                            <span>
                              {new Date(proposal.created_at).toLocaleString()}
                            </span>
                          </div>
                          {proposal.ended_at && (
                            <div className="flex justify-between font-mono text-xs text-foreground/60 mb-1">
                              <span>Ended:</span>
                              <span>
                                {new Date(proposal.ended_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="font-mono text-xs text-foreground/60 mb-1">
                            Text: {proposal.proposal_text}
                          </div>
                          <div className="font-mono text-xs text-foreground/60 truncate">
                            Participants:{" "}
                            {proposal.participants &&
                            proposal.participants.length > 0
                              ? proposal.participants.join(", ")
                              : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative w-full max-w-md p-6 bg-background border border-primary/30 rounded-lg mx-4">
            <button
              onClick={() => {
                setShowAddFundsModal(false)
                setAmount("")
                setTxError("")
                setTxSuccess("")
              }}
              className="absolute top-4 right-4 text-foreground/60 hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-sentient font-bold mb-2">Add Funds</h2>
            <p className="font-mono text-sm text-foreground/60 mb-6">
              Transfer SOL from your Phantom wallet to your custodial wallet
            </p>

            {!connected ? (
              <div className="text-center py-4">
                <p className="font-mono text-sm text-foreground/60 mb-4">
                  Connect your Phantom wallet to continue
                </p>
                <button
                  onClick={() => setVisible(true)}
                  className="px-6 py-3 bg-primary text-primary-foreground font-mono font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-sm text-foreground/60 block mb-2">
                    Amount (SOL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg font-mono text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                  <p className="font-mono text-xs text-foreground/60 mb-1">
                    From: {publicKey?.toString().slice(0, 8)}...
                    {publicKey?.toString().slice(-8)}
                  </p>
                  <p className="font-mono text-xs text-foreground/60">
                    To: {userData?.custodial_pub.slice(0, 8)}...
                    {userData?.custodial_pub.slice(-8)}
                  </p>
                </div>

                {txError && (
                  <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-lg">
                    <p className="font-mono text-sm text-red-400">{txError}</p>
                  </div>
                )}

                {txSuccess && (
                  <div className="p-3 bg-green-950/30 border border-green-500/30 rounded-lg">
                    <p className="font-mono text-sm text-green-400">
                      {txSuccess}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleAddFunds}
                  disabled={txLoading}
                  className="w-full px-6 py-3 bg-primary text-primary-foreground font-mono font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {txLoading ? "Processing..." : "Add Funds"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative w-full max-w-md p-6 bg-background border border-primary/30 rounded-lg mx-4">
            <button
              onClick={() => {
                setShowWithdrawModal(false)
                setAmount("")
                setTxError("")
                setTxSuccess("")
              }}
              className="absolute top-4 right-4 text-foreground/60 hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-sentient font-bold mb-2">
              Withdraw Funds
            </h2>
            <p className="font-mono text-sm text-foreground/60 mb-6">
              Transfer SOL from your custodial wallet to your Phantom wallet
            </p>

            {!connected ? (
              <div className="text-center py-4">
                <p className="font-mono text-sm text-foreground/60 mb-4">
                  Connect your Phantom wallet to continue
                </p>
                <button
                  onClick={() => setVisible(true)}
                  className="px-6 py-3 bg-primary text-primary-foreground font-mono font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-sm text-foreground/60 block mb-2">
                    Amount (SOL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg font-mono text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                  <p className="font-mono text-xs text-foreground/60 mb-1">
                    From: {userData?.custodial_pub.slice(0, 8)}...
                    {userData?.custodial_pub.slice(-8)}
                  </p>
                  <p className="font-mono text-xs text-foreground/60">
                    To: {publicKey?.toString().slice(0, 8)}...
                    {publicKey?.toString().slice(-8)}
                  </p>
                </div>

                {txError && (
                  <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-lg">
                    <p className="font-mono text-sm text-red-400">{txError}</p>
                  </div>
                )}

                {txSuccess && (
                  <div className="p-3 bg-green-950/30 border border-green-500/30 rounded-lg">
                    <p className="font-mono text-sm text-green-400">
                      {txSuccess}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleWithdraw}
                  disabled={txLoading}
                  className="w-full px-6 py-3 bg-primary text-primary-foreground font-mono font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {txLoading ? "Processing..." : "Withdraw"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
