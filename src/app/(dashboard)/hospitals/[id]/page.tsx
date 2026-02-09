import { redirect } from "next/navigation";

export default function LegacyHospitalDetailPage({ params }: { params: { id: string } }) {
  redirect(`/dashboard/hospitals/${params.id}`);
}
