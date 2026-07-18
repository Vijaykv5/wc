import type { Metadata } from "next";
import { CreateMemoryExperience } from "@/components/globe/CreateMemoryExperience";

export const metadata: Metadata = {
  title: "Create Memory | Atlas",
  description: "Create and prepare an Atlas fan memory for minting.",
};

export default function CreateMemoryPage() {
  return <CreateMemoryExperience />;
}
