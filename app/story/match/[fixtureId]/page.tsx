import type { Metadata } from "next";
import { MatchStoryExperience } from "@/components/story/MatchStoryExperience";

export const metadata: Metadata = {
  title: "Match Data | Atlas",
  description: "Inspect TxLINE fixture and score coverage for a World Cup match.",
};

export default async function MatchStoryPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;

  return <MatchStoryExperience fixtureId={fixtureId} />;
}
