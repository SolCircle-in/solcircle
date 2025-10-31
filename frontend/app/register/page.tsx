// ...existing code...
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Wallet, Send, Check } from "lucide-react";

// removed Header import to hide it on this page
import { GL } from "@/components/gl";

declare global {
  interface Window {
    onTelegramAuth: (user: any) => void;
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registrationData, setRegistrationData] = useState<any>(null);
  const tgContainerRef = useRef<HTMLDivElement | null>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    window.onTelegramAuth = async (user: any) => {
      if (!walletAddress) {
        setError("Please enter your Solana wallet address first!");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            auth_date: user.auth_date,
            hash: user.hash,
            main_pkey: walletAddress,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setRegistrationData(data.data);

          const userData = {
            walletAddress: data.data.wallets.main.publicKey,
            telegramHandle: data.data.telegram.username,
            telegramId: data.data.telegram.userId,
            connectedAt: new Date().toISOString(),
            custodial_pub: data.data.wallets.custodial.publicKey,
            custodial_balance: data.data.wallets.custodial.balanceSOL,
            groups: data.data.groups,
            telegramusername: data.data.telegram.username,
          };
          localStorage.setItem("solana_vote_user", JSON.stringify(userData));

          setStep(3);
        } else {
          setError(data.error || "Registration failed");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || "Network error during registration");
      } finally {
        setLoading(false);
      }
    };

    return () => {
      window.onTelegramAuth = undefined as any;
    };
  }, [walletAddress]);

  useEffect(() => {
    if (step !== 2) return;

    if (tgContainerRef.current) {
      tgContainerRef.current.innerHTML = "";
    }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    const botUsername =
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "groupsoltrade_bot";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    tgContainerRef.current?.appendChild(script);

    return () => {
      if (tgContainerRef.current) {
        tgContainerRef.current.innerHTML = "";
      }
    };
  }, [step]);

  const handleConnectWallet = async () => {
    setLoading(true);
    setError("");

    await new Promise((resolve) => setTimeout(resolve, 500));

    if (!walletAddress.trim()) {
      setError("Please enter a wallet address");
      setLoading(false);
      return;
    }

    if (walletAddress.length < 32 || walletAddress.length > 44) {
      setError("Invalid Solana wallet address");
      setLoading(false);
      return;
    }

    setStep(2);
    setLoading(false);
  };

  useEffect(() => {
    if (step === 3 && registrationData) {
      const timer = setTimeout(() => {
        router.push("/dashboard");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [step, registrationData, router]);

  return (
    <>
      {/* keep site visual continuity: animated GL background (header intentionally removed) */}
      <GL hovering={hovering} />

      <main className="min-h-screen bg-background text-foreground overflow-hidden flex flex-col pt-[92px]">
        <div className="container relative z-10 flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {/* Back + step row preserved but now inside site container for consistency */}
            <div className="flex items-center justify-between mb-6">
              <Link
                href="/"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </Link>

              <div className="flex items-center gap-3">
                <Image
                  src="/solcircle.png"
                  alt="SolCircle Logo"
                  width={28}
                  height={28}
                />
                <span className="text-lg font-display font-bold tracking-tight">
                  SolCircle
                </span>
              </div>

              <div className="text-sm font-semibold text-muted-foreground">
                Step {step} of 3
              </div>
            </div>

            {/* registration flow cards */}
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="text-center space-y-4">
                  <div className="inline-block p-4 bg-primary/10 border border-primary/30 rounded-full neon-accent">
                    <Wallet className="w-8 h-8 text-primary" />
                  </div>
                  <h1 className="text-4xl font-display font-bold">
                    Connect Wallet
                  </h1>
                  <p className="text-muted-foreground">
                    Link your Solana wallet to get started
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-3">
                      Solana Wallet Address
                    </label>
                    <input
                      type="text"
                      placeholder="Enter your Solana wallet address"
                      value={walletAddress}
                      onChange={(e) => {
                        setWalletAddress(e.target.value);
                        setError("");
                      }}
                      className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    {error && (
                      <p className="text-destructive text-sm mt-2">{error}</p>
                    )}
                  </div>

                  <button
                    onClick={handleConnectWallet}
                    disabled={loading}
                    className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span className="inline-flex items-center gap-2">
                      {loading ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4" />
                          <span>Connect Wallet</span>
                        </>
                      )}
                    </span>
                  </button>
                </div>

                <div className="p-4 bg-card border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Don&apos;t have a Solana wallet? Create one with Phantom,
                    Solflare, or Magic Eden.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="text-center space-y-4">
                  <div className="inline-block p-4 bg-secondary/10 border border-secondary/30 rounded-full neon-accent">
                    <Send className="w-8 h-8 text-secondary" />
                  </div>
                  <h1 className="text-4xl font-display font-bold">
                    Connect Telegram
                  </h1>
                  <p className="text-muted-foreground">
                    Login with Telegram to complete registration
                  </p>
                </div>

                <div className="space-y-4">
                  {error && (
                    <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                      <p className="text-destructive text-sm">{error}</p>
                    </div>
                  )}

                  <div className="p-6 bg-card border border-border rounded-lg flex flex-col items-center justify-center min-h-[200px]">
                    {loading ? (
                      <div className="flex flex-col items-center gap-4">
                        <span className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground">
                          Processing registration...
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-sm text-muted-foreground mb-2">
                          Click below to authenticate with Telegram:
                        </p>
                        <div
                          id="telegram-login-container"
                          ref={tgContainerRef}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="flex-1 py-3 border-2 border-border text-foreground rounded-lg font-bold hover:border-primary/50 transition-colors disabled:opacity-50"
                  >
                    Back
                  </button>
                </div>

                <div className="p-4 bg-card border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Your data is encrypted and stored securely. We never share
                    your information.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && registrationData && (
              <div className="space-y-8 animate-in fade-in duration-500 text-center">
                <div className="inline-block p-6 bg-primary/10 border border-primary/30 rounded-full mx-auto neon-pulse">
                  <Check className="w-12 h-12 text-primary" />
                </div>

                <div className="space-y-4">
                  <h1 className="text-4xl font-display font-bold">
                    Registration Successful!
                  </h1>
                  <p className="text-muted-foreground text-lg">
                    Your account has been created successfully.
                  </p>
                </div>

                <div className="p-6 bg-card border border-primary/30 rounded-xl space-y-4 neon-accent text-left">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        User ID
                      </div>
                      <div className="font-semibold">
                        {registrationData.telegram.userId}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Username
                      </div>
                      <div className="font-semibold text-secondary">
                        @{registrationData.telegram.username}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        🔐 Custodial Wallet
                      </div>
                      <div className="font-mono text-xs break-all text-primary">
                        {registrationData.wallets.custodial.publicKey}
                      </div>
                      <div className="text-sm mt-1">
                        Balance:{" "}
                        <span className="font-semibold">
                          {registrationData.wallets.custodial.balanceSOL}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        💼 Main Wallet
                      </div>
                      <div className="font-mono text-xs break-all text-primary">
                        {registrationData.wallets.main.publicKey}
                      </div>
                      <div className="text-sm mt-1">
                        Balance:{" "}
                        <span className="font-semibold">
                          {registrationData.wallets.main.balanceSOL}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Redirecting to dashboard...
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
// ...existing code...
