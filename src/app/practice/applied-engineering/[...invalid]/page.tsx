import { redirect } from "next/navigation";

/** Unknown Applied Engineering child paths return to the session home. */
export default function InvalidAppliedEngineeringPath() {
  redirect("/practice/applied-engineering");
}
