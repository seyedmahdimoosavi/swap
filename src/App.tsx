import Footer from "./components/Footer";
import Header from "./components/Header";
import NetworkInfo from "./components/NetworkInfo";
import { StatusProvider } from "./context/StatusContext";
import V2Section from "./features/v2/V2Section";
import V3Section from "./features/v3/V3Section";
import type { Version } from "./types";
import VersionSwitcher from "./components/VersionSwitcher";
import { Web3Provider } from "./context/Web3Context";
import { useState } from "react";

function Shell() {
  const [version, setVersion] = useState<Version>("v2");

  return (
    <div className="relative z-[1] flex min-h-screen flex-col">
      {/* Full-width header (108px side padding on desktop) */}
      <Header />

      {/* Centered app content */}
      <main className="max-w-[570px] min-w-[450px] sm:min-w-[570px] mx-auto flex-1">
        <VersionSwitcher version={version} onChange={setVersion} />

        <div id="v2Section" className={version === "v2" ? "" : "hidden"}>
          <V2Section />
        </div>
        <div id="v3Section" className={version === "v3" ? "" : "hidden"}>
          {/* Mounted only when active so canvas charts size correctly. */}
          {version === "v3" && <V3Section />}
        </div>

        {/* <NetworkInfo /> */}
      </main>

      {/* Full-width footer */}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <StatusProvider>
      <Web3Provider>
        <Shell />
      </Web3Provider>
    </StatusProvider>
  );
}
