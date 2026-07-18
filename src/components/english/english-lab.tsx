"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, AlertCircle, History, ArrowLeft } from "lucide-react";
import { useEnglish } from "@/lib/english/use-english";
import { SetupScreen } from "@/components/english/setup-screen";
import { GreenRoom } from "@/components/english/green-room";
import { LiveScreen } from "@/components/english/live-screen";
import { ReportScreen } from "@/components/english/report-screen";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/auth/user-menu";
import { XpBadge } from "@/components/gamification/xp-badge";
import { Logo } from "@/components/brand/logo";
import { resolveErrorCopy } from "@/lib/interview/errors";

export function EnglishLab({ userName }: { userName?: string }) {
  const en = useEnglish();

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">English Lab</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">
              Spoken English for developers
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/#labs">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Labs</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/labs/english/history">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </Link>
            </Button>
            <AnimatedThemeToggler />
            <XpBadge />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl dark:bg-teal-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-500/10"
          aria-hidden
        />

        <AnimatePresence mode="wait">
          {en.phase === "idle" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SetupScreen onContinue={en.enterGreenRoom} greeting={userName} />
            </motion.div>
          )}

          {en.phase === "greenroom" && (
            <motion.div
              key="greenroom"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GreenRoom
                scenario={en.scenario}
                connecting={false}
                onStart={en.start}
                onBack={en.reset}
              />
            </motion.div>
          )}

          {(en.phase === "connecting" ||
            en.phase === "live" ||
            en.phase === "reconnecting") && (
            <motion.div
              key="live"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LiveScreen
                scenario={en.scenario}
                secondsLeft={en.secondsLeft}
                roundTotal={en.roundTotal}
                transcript={en.transcript}
                muted={en.muted}
                coachSpeaking={en.coachSpeaking}
                micAnalyser={en.micAnalyser}
                outputAnalyser={en.outputAnalyser}
                connecting={en.phase === "connecting"}
                reconnecting={en.phase === "reconnecting"}
                onMute={en.toggleMute}
                onEnd={en.endEarly}
              />
            </motion.div>
          )}

          {en.phase === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
            >
              <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
              <div>
                <p className="text-lg font-semibold">Reviewing your English…</p>
                <p className="text-sm text-muted-foreground">
                  Checking fluency, clarity and how to say things better.
                </p>
              </div>
            </motion.div>
          )}

          {en.phase === "report" && en.report && (
            <motion.div
              key="report"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ReportScreen
                report={en.report}
                scenario={en.scenario}
                onNew={en.reset}
                onRetry={() => {
                  if (en.scenario) en.enterGreenRoom(en.scenario);
                }}
              />
            </motion.div>
          )}

          {en.phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/50">
                <AlertCircle className="h-6 w-6 text-rose-500" />
              </div>
              <div className="max-w-md">
                <p className="text-lg font-semibold">
                  {resolveErrorCopy(en.errorCode).title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {en.error ?? resolveErrorCopy(en.errorCode).message}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {en.errorCode === "REPORT_FAILED" && en.canRetryReport && (
                  <Button onClick={en.retryReport}>Try scoring again</Button>
                )}
                <Button
                  variant={
                    en.errorCode === "REPORT_FAILED" ? "outline" : "default"
                  }
                  onClick={en.reset}
                >
                  Back to start
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
