"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, UserCircle } from "lucide-react";
import { GL } from "@/components/gl";

// Declare Telegram widget callback as global
declare global {
  interface Window {
    onTelegramAuthLogin: (user: any) => void;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginData, setLoginData] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [hovering, setHovering] = useState(false);
  const tgContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Define the Telegram auth callback globally
    window.onTelegramAuthLogin = async (user: any) => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "https://sol-circle.vercel.app/api/users/login",
          {
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
            }),
          }
        );

        const data = await response.json();

        if (data.success) {
          setLoginData(data.data);

          // Store user data
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

          setStep(2);
        } else {
          if (data.needsRegistration) {
            setError("Account not found. Redirecting to registration...");
            setTimeout(() => {
              router.push("/register");
            }, 2000);
          } else {
            setError(data.error || "Login failed");
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || "Network error during login");
      } finally {
        setLoading(false);
      }
    };

    return () => {
      window.onTelegramAuthLogin = undefined as any;
    };
  }, [router]);

  // Inject Telegram widget script into the DOM
  useEffect(() => {
    if (step !== 1) return;

    // clear previous widget + script if any
    if (tgContainerRef.current) {
      tgContainerRef.current.innerHTML = "";
    }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    const botUsername =
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "YOUR_BOT_USERNAME";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuthLogin(user)");
    script.setAttribute("data-request-access", "write");

    // Append script to container
    tgContainerRef.current?.appendChild(script);

    return () => {
      // cleanup
      if (tgContainerRef.current) {
        tgContainerRef.current.innerHTML = "";
      }
    };
  }, [step]);

  useEffect(() => {
    if (step === 2 && loginData) {
      const timer = setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, loginData, router]);

  return (
    <main className="min-h-screen flex flex-col">
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
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-mono text-sm">Back</span>
        </Link>
        <div className="flex items-center gap-3">
          <Image
            src="/solcircle.png"
            alt="SolCircle Logo"
            width={40}
            height={40}
          />
          <span className="text-xl font-sentient font-bold tracking-tight">
            SolCircle
          </span>
        </div>
        <Link
          href="/register"
          className="font-mono text-sm text-primary hover:text-primary/80 transition-colors"
        >
          Register
        </Link>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {step === 1 && (
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <div className="inline-block p-4 bg-primary/10 border border-primary/30 rounded-full">
                  <UserCircle className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-4xl font-sentient font-bold">
                  Welcome Back
                </h1>
                <p className="font-mono text-sm text-primary">
                  Login with Telegram to continue
                </p>
              </div>

              <div className="space-y-4">
                {error && (
                  <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 font-mono text-sm">{error}</p>
                  </div>
                )}

                <div className="p-6 bg-background border border-border rounded-lg flex flex-col items-center justify-center min-h-[200px]">
                  {loading ? (
                    <div className="flex flex-col items-center gap-4">
                      <span className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="font-mono text-sm text-foreground/60">
                        Logging you in...
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <p className="font-mono text-sm text-foreground/60 mb-2">
                        Click below to authenticate:
                      </p>
                      <div id="telegram-login-container" ref={tgContainerRef} />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-background border border-border rounded-lg text-center">
                <p className="font-mono text-sm text-foreground/60">
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/register"
                    className="text-primary hover:underline font-semibold"
                  >
                    Register here
                  </Link>
                </p>
              </div>
            </div>
          )}

          {step === 2 && loginData && (
            <div className="space-y-8 text-center">
              <div className="inline-block p-6 bg-primary/10 border border-primary/30 rounded-full mx-auto">
                <Check className="w-12 h-12 text-primary" />
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-sentient font-bold">
                  Login Successful!
                </h1>
                <p className="font-mono text-foreground/60 text-lg">
                  Welcome back, @{loginData.telegram.username}!
                </p>
              </div>

              <div className="p-6 bg-background border border-primary/30 rounded-xl space-y-4 text-left">
                <div className="space-y-3">
                  <div>
                    <div className="font-mono text-xs text-foreground/60 mb-1">
                      User ID
                    </div>
                    <div className="font-mono font-semibold">
                      {loginData.telegram.userId}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-xs text-foreground/60 mb-1">
                      Username
                    </div>
                    <div className="font-mono font-semibold text-primary">
                      @{loginData.telegram.username}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-3">
                  <div>
                    <div className="font-mono text-xs text-foreground/60 mb-1">
                      Custodial Wallet
                    </div>
                    <div className="font-mono text-xs break-all text-primary">
                      {loginData.wallets.custodial.publicKey}
                    </div>
                    <div className="font-mono text-sm mt-1">
                      Balance:{" "}
                      <span className="font-semibold">
                        {loginData.wallets.custodial.balanceSOL} SOL
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="font-mono text-xs text-foreground/60 mb-1">
                      Main Wallet
                    </div>
                    <div className="font-mono text-xs break-all text-primary">
                      {loginData.wallets.main.publicKey}
                    </div>
                    <div className="font-mono text-sm mt-1">
                      Balance:{" "}
                      <span className="font-semibold">
                        {loginData.wallets.main.balanceSOL} SOL
                      </span>
                    </div>
                  </div>

                  {loginData.groups.count > 0 && (
                    <div>
                      <div className="font-mono text-xs text-foreground/60 mb-1">
                        Your Groups
                      </div>
                      <div className="font-mono text-sm font-semibold">
                        {loginData.groups.count} group(s)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <p className="font-mono text-sm text-foreground/60">
                Redirecting to dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
