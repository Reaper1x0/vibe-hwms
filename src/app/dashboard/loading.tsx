import { Loader } from "@/components/Loader";

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-20">
      <Loader variant="page" />
    </div>
  );
}
