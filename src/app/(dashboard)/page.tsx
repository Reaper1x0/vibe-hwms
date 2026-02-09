import { redirect } from "next/navigation";

export default function LegacyDashboardHomePage() {
  redirect("/dashboard");
}
