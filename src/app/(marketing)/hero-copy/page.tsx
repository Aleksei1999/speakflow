import type { Metadata } from "next";
import { HeroCopyPage } from "./HeroCopyPage";

export const metadata: Metadata = {
  title: "RAW English — Hero Copy",
  description: "Alternative RAW English hero concept with the table photo.",
};

export default function Page() {
  return <HeroCopyPage />;
}
