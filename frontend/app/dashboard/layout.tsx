'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { PriceWidget } from '@/components/ticker/PriceWidget';
import { MarketStatus } from '@/components/ticker/MarketStatus';
import { useMarketStore } from '@/store/marketStore';
import {
  LayoutDashboard,
  TrendingUp,
  Newspaper,
  Brain,
  FlaskConical,
  Briefcase,
  Settings,
  Search,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { name: 'Markets', icon: TrendingUp, href: '/dashboard/markets' },
  { name: 'News Intelligence', icon: Newspaper, href: '/dashboard/news' },
  { name: 'Agent Insights', icon: Brain, href: '/dashboard/agents' },
  { name: 'Backtesting', icon: FlaskConical, href: '/dashboard/backtest' },
  { name: 'Portfolio', icon: Briefcase, href: '/dashboard/portfolio' },
  { name: 'Settings', icon: Settings, href: '/dashboard/settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const indices = useMarketStore((state) => state.indices);

  return (
    <SidebarProvider defaultOpen>
      <div className="flex w-full min-h-screen bg-background">
        <Sidebar className="border-r border-border/50">
          <SidebarHeader className="border-b border-border/50 p-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm">FintelliAI</span>
                <span className="text-xs text-muted-foreground">Intelligence Platform</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild>
                        <a href={item.href} className="flex items-center gap-3">
                          <item.icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          {/* Top Navbar */}
          <header className="h-16 border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-40">
            <div className="h-full px-6 flex items-center justify-between gap-4">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search stocks, indices, news..."
                    className="pl-10 bg-background/50"
                  />
                </div>
              </div>

              {/* Market Status & Price Widgets */}
              <div className="flex items-center gap-3">
                <MarketStatus />
                {indices.slice(0, 4).map((index) => (
                  <PriceWidget
                    key={index.symbol}
                    symbol={index.symbol}
                    price={index.price}
                    change={index.change}
                    changePercent={index.changePercent}
                  />
                ))}
              </div>

              {/* User Actions */}
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs">
                    3
                  </Badge>
                </Button>
                <Avatar className="w-8 h-8 cursor-pointer ring-2 ring-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                    AI
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
