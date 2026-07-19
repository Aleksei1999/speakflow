import type { Metadata } from "next";
import LandingRaw2 from "../_landing/raw2/LandingRaw2";

export const metadata: Metadata = {
  title: "Raw English — превратить сырой английский в сочный разговорный",
  description:
    "Онлайн-школа Raw English: индивидуальные уроки, разговорные клубы с носителями, игровой формат. Узнай свой уровень прожарки бесплатно.",
};

// Static landing — no per-request work.
export const revalidate = 3600;

export default function NewLandingPage() {
  return <LandingRaw2 />;
}
