"use client";

import dynamic from "next/dynamic";
const VideoGenerator = dynamic(() => import("../components/VideoGenerator"), { ssr: false });

export default function Page() {
  return (
    <section>
      <VideoGenerator />
    </section>
  );
}
