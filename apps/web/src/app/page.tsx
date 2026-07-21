import { ApiHealth } from "@/components/api-health";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Yung-chaAnts</h1>
      <p className="opacity-70">
        pnpm 워크스페이스 모노레포 · Next.js(web) + Fastify(api) + 공유 스키마(shared)
      </p>
      <ApiHealth />
    </main>
  );
}
