import { redirect } from "next/navigation";

export default function LegacyHospitalsPage() {
  redirect("/dashboard/hospitals");
}
