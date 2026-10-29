// import { useState } from "react";
// import reactLogo from "./assets/react.svg";
// import { invoke } from "@tauri-apps/api/core";
// import "./App.css";
// import { TooltipProvider } from "@/components/ui/tooltip"

// function App() {
//   const [greetMsg, setGreetMsg] = useState("");
//   const [name, setName] = useState("");

//   async function greet() {
//     // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//     setGreetMsg(await invoke("greet", { name }));
//   }

//   return (
//     <main className="container">
//       <TooltipProvider>Hallo</TooltipProvider>
//     </main>
//   );
// }

import "./App.css";
import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

import Chat from "@/views/Chat";
import Resources from "@/views/Resources";
import Settings from "@/views/Settings";
import History from "@/views/History";
import Theories from "@/views/Theories";

const views = {
  chat: Chat,
  history: History,
  resources: Resources,
  settings: Settings,
  theories: Theories,
};

const titles = {
  chat: "Chat",
  history: "History",
  resources: "Resources",
  settings: "Settings",
  theories: "Theories",
};

export default function App() {
  const [activeView, setActiveView] = useState("chat");

  const ActiveView = views[activeView];

  return (
    <SidebarProvider>
      <AppSidebar
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <SidebarInset>
        {/* <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4"> */}
        {/* <SidebarTrigger /> */}

        {/* <Separator orientation="vertical" className="h-5" /> */}

        {/* <h1 className="text-base font-semibold"> */}
        {/* {titles[activeView]} */}
        {/* </h1> */}
        {/* </header> */}

        <main className="flex-1 overflow-auto p-6">
          {activeView === "history" ? (
            <History onOpenChat={() => setActiveView("chat")} />
          ) : (
            <ActiveView />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
