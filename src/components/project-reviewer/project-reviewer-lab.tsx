"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ExternalLink,
  FolderTree,
  Gauge,
  LayoutGrid,
  Loader2,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { UserMenu } from "@/components/auth/user-menu";
import { XpBadge } from "@/components/gamification/xp-badge";
import { FaGithub } from "react-icons/fa";

type ReviewScores = {
  folderStructure: number;
  componentSeparation: number;
  namingConvention: number;
  responsiveness: number;
  seo: number;
  accessibility: number;
  performance: number;
};

type ReviewResult = {
  overallScore: number;
  verdict: string;
  scores: ReviewScores;
  strengths: string[];
  weaknesses: string[];
  summary: string;
};

const CATEGORIES: { label: string; key: keyof ReviewScores }[] = [
  { label: "Folder structure", key: "folderStructure" },
  { label: "Component separation", key: "componentSeparation" },
  { label: "Naming convention", key: "namingConvention" },
  { label: "Responsiveness", key: "responsiveness" },
  { label: "SEO", key: "seo" },
  { label: "Accessibility", key: "accessibility" },
  { label: "Performance", key: "performance" },
];

function parseUrl(value: string): URL | null {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

function isReadyForReview(github: string, liveLink: string): boolean {
  const githubUrl = parseUrl(github);
  const liveUrl = parseUrl(liveLink);
  return Boolean(
    githubUrl?.hostname.includes("github.com") &&
    githubUrl.pathname.split("/").filter(Boolean).length >= 2 &&
    liveUrl &&
    ["http:", "https:"].includes(liveUrl.protocol),
  );
}

function formatScore(value: number): string {
  return (value / 10).toFixed(1);
}

function ReviewPreview({
  result,
  pending,
  error,
  ready,
}: {
  result: ReviewResult | null;
  pending: boolean;
  error: string | null;
  ready: boolean;
}) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-lg backdrop-blur">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          Live AI review
        </CardTitle>
        <CardDescription>
          The AI reads the repo tree and the live site, then scores the
          submission in real time.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {pending && (
          <div className="flex items-center gap-3 rounded-2xl border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            AI is reviewing the submission now.
          </div>
        )}

        {error && !pending && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200">
            {error}
          </div>
        )}

        {ready && result ? (
          <>
            <div className="flex items-end justify-between gap-3 rounded-2xl border bg-linear-to-br from-emerald-50 via-background to-background p-4 dark:from-emerald-950/30">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Overall
                </p>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-4xl font-black tracking-tight tabular-nums text-foreground">
                    {formatScore(result.overallScore)}
                  </span>
                  <span className="pb-1 text-lg font-semibold text-muted-foreground">
                    /10
                  </span>
                </div>
              </div>
              <div className="rounded-full border bg-background px-3 py-2 text-right shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Verdict
                </p>
                <p className="mt-1 max-w-40 text-sm font-medium">
                  {result.verdict}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {CATEGORIES.map(({ label, key }) => (
                <div
                  key={label}
                  className="rounded-xl border bg-background/70 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {result.scores[key].toFixed(1)}
                    </span>
                  </div>
                  <Progress value={result.scores[key] * 10} className="h-2" />
                </div>
              ))}
            </div>

            <div className="rounded-2xl border bg-muted/35 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Weaknesses
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {result.weaknesses.map((weakness) => (
                  <li key={weakness} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border bg-background/80 p-4 text-sm text-muted-foreground shadow-sm">
              <span className="font-medium text-foreground">Summary:</span>{" "}
              {result.summary}
            </div>

            {result.strengths.length > 0 && (
              <div className="rounded-2xl border bg-background/80 p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Strengths
                </div>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  {result.strengths.map((strength) => (
                    <li key={strength} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
            Paste a public GitHub repository and a live URL. The AI review
            appears as soon as both are valid.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RubricItem({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof LayoutGrid;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border bg-background/70 p-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

export function ProjectReviewerLab({ userName }: { userName?: string }) {
  const [github, setGithub] = useState("");
  const [liveLink, setLiveLink] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const ready = isReadyForReview(github, liveLink);

  const runReview = useCallback(async () => {
    if (!ready) {
      setResult(null);
      setError(null);
      setPending(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/project-reviewer/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github, liveLink }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data?.message === "string"
            ? data.message
            : `Request failed (${res.status})`,
        );
      }

      const data = (await res.json()) as ReviewResult;
      if (requestId !== requestIdRef.current) return;
      setResult(data);
    } catch (err) {
      console.log("err ->>>", { err });
      if (requestId !== requestIdRef.current) return;
      setResult(null);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate the AI review.",
      );
    } finally {
      if (requestId === requestIdRef.current) setPending(false);
    }
  }, [github, liveLink, ready]);

  useEffect(() => {
    if (!ready) return;

    const handle = window.setTimeout(() => {
      void runReview();
    }, 900);

    return () => window.clearTimeout(handle);
  }, [ready, runReview]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-background/75 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
              <SearchCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold leading-tight">
                Project Reviewer Lab
              </h1>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                Submit a GitHub repo and a live link. The AI scores both in real
                time.
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/#labs">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Labs</span>
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
          className="pointer-events-none absolute -top-24 -left-20 h-80 w-80 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-1/3 -right-28 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/10"
          aria-hidden
        />

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-10">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="space-y-6"
          >
            <div className="rounded-3xl border bg-card/90 p-6 shadow-lg backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 text-xs font-medium"
                >
                  AI review
                </Badge>
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 text-xs font-medium"
                >
                  GitHub
                </Badge>
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 text-xs font-medium"
                >
                  Live link
                </Badge>
              </div>

              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="github" className="text-sm font-medium">
                    GitHub repository
                  </label>
                  <div className="relative">
                    <FaGithub className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="github"
                      value={github}
                      onChange={(event) => setGithub(event.target.value)}
                      placeholder="https://github.com/owner/repo"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="live-link" className="text-sm font-medium">
                    Live link
                  </label>
                  <div className="relative">
                    <ExternalLink className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="live-link"
                      value={liveLink}
                      onChange={(event) => setLiveLink(event.target.value)}
                      placeholder="https://your-app.vercel.app"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    onClick={() => void runReview()}
                    disabled={pending || !ready}
                    className="min-w-40"
                  >
                    {pending ? "Reviewing…" : "Run review"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {userName ? `Hi ${userName}, ` : ""}the reviewer checks
                    structure, polish and release readiness.
                  </p>
                </div>
              </div>
            </div>

            <Card className="border-border/70 bg-card/90 shadow-lg backdrop-blur">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  What the AI checks
                </CardTitle>
                <CardDescription>
                  Seven signals that usually decide whether a project feels
                  finished.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
                <RubricItem
                  icon={FolderTree}
                  title="Folder structure"
                  body="Are files grouped by feature instead of being scattered everywhere?"
                />
                <RubricItem
                  icon={LayoutGrid}
                  title="Component separation"
                  body="Do components stay small, or does one file do everything?"
                />
                <RubricItem
                  icon={BadgeCheck}
                  title="Naming convention"
                  body="Are names predictable enough that another developer can navigate fast?"
                />
                <RubricItem
                  icon={Gauge}
                  title="Performance"
                  body="Is the app loading fast enough that the first interaction feels immediate?"
                />
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
          >
            <ReviewPreview
              result={result}
              pending={pending}
              error={error}
              ready={ready}
            />
          </motion.section>
        </div>
      </main>
    </div>
  );
}
