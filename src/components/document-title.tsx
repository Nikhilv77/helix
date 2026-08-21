"use client";

import { useEffect } from "react";
import { pageTitle } from "@/lib/shared/seo";

export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);

  return null;
}
