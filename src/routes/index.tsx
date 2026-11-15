import { createFileRoute } from "@tanstack/react-router";
import { GameShell } from "@/components/game/GameShell";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Aethelgard: Abismo de Cinzas" },
      { name: "description", content: "Plataforma 2D pixel art cinematográfica com biomas, heróis e chefões." },
      { property: "og:title", content: "Aethelgard: Abismo de Cinzas" },
      { property: "og:description", content: "Plataforma 2D pixel art cinematográfica com biomas, heróis e chefões." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="h-screen w-screen overflow-hidden select-none">
      <GameShell />
    </div>
  ),
});
