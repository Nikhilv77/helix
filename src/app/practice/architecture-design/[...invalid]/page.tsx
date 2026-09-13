import { redirect } from "next/navigation";

/** Unknown Architecture & Design child paths return to the session home. */
export default function InvalidArchitectureDesignPath() {
  redirect("/practice/architecture-design");
}
