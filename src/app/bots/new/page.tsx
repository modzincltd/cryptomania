import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { BotForm } from "@/components/bot-form";
export default function NewBot() {
  return (<><PageHeader title="New bot" sub="Pick a market, a strategy and the rules it must obey." /><Suspense><BotForm /></Suspense></>);
}
