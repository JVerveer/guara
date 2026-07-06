import { useTranslation } from "react-i18next";
import { useLocale } from "@/i18n/hooks/useLocale";
import { fonts } from "@/theme/tokens";
import { ConnectorCard } from "@/features/sources/components/ConnectorCard";
import { useConnectors } from "@/features/sources/hooks/useConnectors";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

export function SourceBrowserScreen() {
  const { t } = useTranslation();
  const { formatNumber } = useLocale();
  const { connectors, totalDatasets, isLoading, error, retry } = useConnectors();

  if (isLoading) return <LoadingState message={t("common.loading")} className="flex-1" />;

  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={retry}
        retryLabel={t("errors.retry")}
        className="flex-1"
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-8 py-10">
        <header className="mb-8">
          <h1
            className="text-3xl text-foreground mb-1"
            style={{ fontFamily: fonts.display, fontWeight: 400 }}
          >
            {t("sources.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("sources.headerDescription", {
              providers: connectors.length,
              total: formatNumber(totalDatasets),
            })}
          </p>
        </header>

        {connectors.length === 0 ? (
          <EmptyState title={t("errors.noSources")} />
        ) : (
          <ul className="grid grid-cols-2 gap-4 list-none">
            {connectors.map((connector) => (
              <li key={connector.id}>
                <ConnectorCard connector={connector} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
