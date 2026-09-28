import type { Metadata } from "next";
import { StaffInvitation } from "@/components/staff-invitation";
export const metadata: Metadata = {
  title: "Complete seu cadastro · Bonamassa",
  referrer: "no-referrer",
};
export default function Page() {
  return <StaffInvitation />;
}
