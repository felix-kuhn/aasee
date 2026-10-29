import {
    BotMessageSquare,
    Brain,
    BookOpen,
    History,
    Settings,
} from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
    {
        id: "chat",
        label: "Chat",
        icon: BotMessageSquare,
    },
    {
        id: "history",
        label: "History",
        icon: History,
    },
    {
        id: "resources",
        label: "Resources",
        icon: BookOpen,
    },
    {
        id: "theories",
        label: "Theories",
        icon: Brain,
    },
    {
        id: "settings",
        label: "Settings",
        icon: Settings,
    },
];

export function AppSidebar({ activeView, onViewChange }) {
    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="p-2">
                <div className="flex items-center gap-2">
                    <SidebarTrigger className="size-8 shrink-0" />

                    <div className="flex min-w-0 items-center gap-2 group-data-[collapsible=icon]:hidden">
                        <BotMessageSquare className="size-5 shrink-0" />
                        <span className="truncate font-semibold">
                            Research Assistant
                        </span>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:hidden">
                        Workspace
                    </SidebarGroupLabel>

                    <SidebarMenu>
                        {navigationItems.map((item) => {
                            const Icon = item.icon;

                            return (
                                <SidebarMenuItem key={item.id}>
                                    <SidebarMenuButton
                                        isActive={activeView === item.id}
                                        onClick={() => onViewChange(item.id)}
                                        tooltip={item.label}
                                    >
                                        <Icon />
                                        <span>{item.label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="group-data-[collapsible=icon]:hidden">
                <p className="px-2 py-2 text-xs text-muted-foreground">
                    Local-first workspace
                </p>
            </SidebarFooter>
        </Sidebar>
    );
}
