import {
  Plus,
  Bookmark,
  Database,
  Settings,
  Globe,
  Compass,
  Moon,
  Sun,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { fonts } from "@/theme/tokens";
import { useTheme } from "@/app/providers/ThemeProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { Screen } from "@/types";

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function NavItem({ label, icon, active, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 text-left",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      <span className="opacity-60 flex-shrink-0" aria-hidden="true">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

interface SidebarProps {
  screen: Screen;
  setScreen: (s: Screen) => void;
}

export function Sidebar({ screen, setScreen }: SidebarProps) {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();

  return (
    <nav aria-label="Main navigation" className="w-56 flex-shrink-0 flex flex-col border-r border-border bg-sidebar h-full">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary" aria-hidden="true">
          <Compass size={14} className="text-primary-foreground" />
        </div>
        <span
          className="text-[15px] font-semibold tracking-tight text-sidebar-foreground"
          style={{ fontFamily: fonts.display }}
        >
          {t("nav.guara")}
        </span>
      </div>

      {/* New Research */}
      <div className="px-3 pt-4 pb-2">
        <button
          type="button"
          onClick={() => setScreen("home")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-sidebar-border text-sm font-medium text-sidebar-foreground hover:bg-muted transition-colors duration-150"
        >
          <Plus size={14} className="text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{t("nav.newResearch")}</span>
        </button>
      </div>

      <div className="h-px bg-sidebar-border mx-3 my-4" aria-hidden="true" />

      {/* Main nav */}
      <ul className="px-3 space-y-0.5 list-none">
        {[
          { label: t("nav.savedReports"), icon: <Bookmark size={14} />, screen: "home" as Screen },
          { label: t("nav.datasetExplorer"), icon: <Database size={14} />, screen: "datasets" as Screen },
          { label: t("nav.sourceBrowser"), icon: <Globe size={14} />, screen: "sources" as Screen },
        ].map(({ label, icon, screen: target }) => (
          <li key={label}>
            <NavItem
              label={label}
              icon={icon}
              active={screen === target && target !== "home"}
              onClick={() => setScreen(target)}
            />
          </li>
        ))}
      </ul>

      <div className="flex-1" aria-hidden="true" />
      <div className="h-px bg-sidebar-border mx-3 mb-2" aria-hidden="true" />

      <div className="px-3 pb-4 space-y-0.5">
        <LanguageSwitcher />

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? t("settings.lightMode") : t("settings.darkMode")}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
        >
          <span className="opacity-60 flex-shrink-0" aria-hidden="true">
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </span>
          <span className="truncate">
            {isDark ? t("settings.lightMode") : t("settings.darkMode")}
          </span>
        </button>

        <NavItem
          label={t("nav.settings")}
          icon={<Settings size={14} />}
          active={false}
          onClick={() => setScreen("home")}
        />
      </div>
    </nav>
  );
}
